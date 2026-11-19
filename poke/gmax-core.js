/* 거다이맥스 핵심 모듈 (1단계) — 게임 화면과 상관없는 "규칙·상태·계산"만 들어 있어요.
 * 2단계에서 index.html 의 실시간 배틀(ACT)과 연결하고, 연출(그림)은 2~3단계에서 붙여요.
 * 게임 없이도 node 로 시험할 수 있어요:  node gmax-core.js  (맨 아래 자체 시험)
 *
 * 규칙 출처: 거다이맥스_구현_명세.md (resonance-ref/ 안에 있어요)
 *   - 변신은 한 배틀에서 한 쪽당 최대 2번, 발사 한 번으로 끝 (20초 지속 같은 장기 거대화 없음)
 *   - 흐름: NORMAL → TRANSFORM → PICK → FIRE → RETURN → NORMAL
 *   - TRANSFORM~FIRE 동안 변신한 쪽은 무적, RETURN 뒤에도 0.5초 더 무적
 *   - 기술 선택 제한시간 3초, 시간이 끝나면 가장 센 기술 자동 선택 (자동 배틀이면 바로)
 */
(function(root){
'use strict';

// ---------- 밸런스 상수 (한곳에 모음) ----------
const CFG={
  USES_PER_SIDE:2,       // 한 배틀에서 한 쪽당 변신 가능 횟수
  PICK_SECONDS:3,        // 기술 선택 제한시간
  T_TRANSFORM:1.5,       // 변신 연출 길이(초)  (레조넌스: gather 0 → surge .4 → land 1.42 → clouds 1.55 → 울음 1.67)
  T_FIRE:2.2,            // 발사 연출 길이(초) — 2단계에서 실제 연출에 맞춰 조정
  T_RETURN:.6,           // 복귀 연출 길이(초)
  AFTER_INV:.5,          // 복귀 뒤 추가 무적(초)
  POWER_GMAX:190,        // 거다이맥스 전용기 위력
  POWER_DMAX:180,        // 일반 다이기술 위력
  JOIN_WINDOW:1.5        // 상대가 같이 변신할 수 있는 시간(양쪽 거다이 정면충돌용, 3단계)
};

// ---------- 타입 → 다이기술 이름 (물리/특수 기술은 이 이름으로 바뀜, 변화기는 선택 불가) ----------
const TYPE_KO={NORMAL:'노말',FIRE:'불꽃',WATER:'물',ELECTRIC:'전기',GRASS:'풀',ICE:'얼음',FIGHTING:'격투',POISON:'독',GROUND:'땅',FLYING:'비행',PSYCHIC:'에스퍼',BUG:'벌레',ROCK:'바위',GHOST:'고스트',DRAGON:'드래곤',DARK:'악',STEEL:'강철',FAIRY:'페어리'};
const DMAX_NAME={NORMAL:'다이어택',FIRE:'다이번',WATER:'다이스트림',ELECTRIC:'다이썬더',GRASS:'다이그래스',ICE:'다이아이스',FIGHTING:'다이너클',POISON:'다이애시드',GROUND:'다이어스',FLYING:'다이제트',PSYCHIC:'다이사이코',BUG:'다이웜',ROCK:'다이록',GHOST:'다이할로우',DRAGON:'다이드라군',DARK:'다이아크',STEEL:'다이스틸',FAIRY:'다이페어리'};
// 거다이맥스 전용기 이름 — 확실한 것(명세서 기준 리자몽)만 적어 뒀어요. 나머지는 「거다이+속성」으로 나오고, 공식 이름을 알면 여기에 추가하면 돼요.
const GMAX_SIG={CHARIZARD:'거다이옥염'};

// ---------- 거다이맥스 가능 종 표 (gmaxmap.json 을 읽어서 채움) ----------
// 키: 게임의 거다이 폼 키(예: CHARIZARD_3). 값: {dex,name,types,baseKey,gmaxSet,front,frontFrames,hasMotion}
let MAP={forms:{}};
const byBase={};   // 일반폼 포켓몬(도감번호) → [거다이 폼 키들]
function setMap(j){
  MAP=j&&j.forms?j:{forms:{}};
  for(const k in byBase)delete byBase[k];
  for(const k in MAP.forms){const d=MAP.forms[k].dex;(byBase[d]||(byBase[d]=[])).push(k)}
}
function formsForDex(dex){return byBase[dex]||[]}
function infoOf(formKey){return MAP.forms[formKey]||null}

// ---------- 기술 변환 ----------
// move: {id,name,type,pw,ph,st?}  (게임의 MOVES 항목 모양)  → 다이기술 또는 null(선택 불가)
function convertMove(move,opt){
  opt=opt||{};
  if(!move)return null;
  const status=move.st===1||!(move.pw>0);
  if(status)return{src:move.id,ok:false,name:move.name,reason:'변화기',pw:0,type:move.type};
  const sigType=opt.sigType||null;   // 거다이 폼의 대표 타입
  const isSig=sigType&&move.type===sigType&&opt.sigName;
  return{src:move.id,ok:true,type:move.type,ph:!!move.ph,
    name:isSig?opt.sigName:(DMAX_NAME[move.type]||'다이어택'),
    pw:isSig?CFG.POWER_GMAX:CFG.POWER_DMAX,
    gmax:!!isSig,acc:100,pierce:true};   // 회피·무적 무시
}
// 한 포켓몬의 기술 4개 전체를 변환. sig 는 {name,type}
function convertAll(moves,sig){
  return moves.map(m=>convertMove(m,sig?{sigName:sig.name,sigType:sig.type}:{}));
}
// 거다이 폼 키 → 전용기 {name,type}  (대표 타입 = 폼의 첫 번째 타입)
function sigOf(formKey){
  const I=infoOf(formKey);if(!I)return null;
  const base=(I.baseKey||'').toUpperCase(),t=(I.types||[])[0];
  return{name:GMAX_SIG[base]||('거다이'+(TYPE_KO[t]||'')),type:t};
}

// ---------- 자동 선택 ----------
// opts: 변환된 기술 목록, score(opt)=예상 피해(상성·능력치 반영은 게임이 계산해서 넘김). 선택 불가는 건너뜀. 같으면 앞쪽.
function autoPick(opts,score){
  let best=-1,bs=-1;
  opts.forEach((o,i)=>{if(!o||!o.ok)return;const s=score?score(o,i):o.pw;if(s>bs){bs=s;best=i}});
  return best;   // -1 이면 쓸 수 있는 기술이 없음
}

// ---------- 상태 머신 ----------
const ST={NORMAL:'NORMAL',TRANSFORM:'TRANSFORM',PICK:'PICK',FIRE:'FIRE',RETURN:'RETURN'};
// 한 쪽(내 쪽 / 상대 쪽)마다 하나씩 만들어요.
//  const g=GMX.machine({canForm:true, auto:false});   g.start(); … 매 프레임 g.tick(dt)
//  이벤트는 g.on('state',fn) 처럼 받아요: state(새상태,이전상태) · pickOpen · pickDone(index) · fire · done
function machine(o){
  o=o||{};
  const M={
    st:ST.NORMAL,t:0,uses:o.uses!=null?o.uses:CFG.USES_PER_SIDE,
    canForm:o.canForm!==false,   // 이 포켓몬이 거다이 폼이 있는가
    auto:!!o.auto,               // 자동 선택 여부
    pick:-1,pickLeft:0,inv:0,    // inv: 복귀 뒤 남은 추가 무적 시간
    alive:true,world:true,       // 월드가 멈춘 상태인지(연출 중)는 frozen 으로 알려 줘요
    _h:{}
  };
  const emit=(k,a,b)=>{const L=M._h[k];if(L)for(const f of L)try{f(a,b)}catch(e){console.warn('gmax',e)}};
  M.on=(k,f)=>{(M._h[k]||(M._h[k]=[])).push(f);return M};
  const go=s=>{const p=M.st;M.st=s;M.t=0;emit('state',s,p)};
  // 변신 가능한가 (연출 중이 아니고, 살아 있고, 횟수 남고, 폼이 있을 때)
  M.can=()=>M.canForm&&M.alive&&M.uses>0&&M.st===ST.NORMAL;
  // 안 되는 이유(버튼 안내용) — 가능하면 ''
  M.why=()=>!M.canForm?'거다이맥스 폼이 없어요':!M.alive?'쓰러졌어요':M.uses<=0?'더 이상 변신할 수 없어요':M.st!==ST.NORMAL?'지금은 안 돼요':'';
  M.start=()=>{if(!M.can())return false;M.uses--;go(ST.TRANSFORM);return true};
  // 연출 중에는 월드(투사체·쿨다운·타이머)를 멈춰요
  M.frozen=()=>M.st!==ST.NORMAL;
  // 무적: 변신~발사 동안 + 복귀 뒤 추가 시간
  M.invincible=()=>M.st===ST.TRANSFORM||M.st===ST.PICK||M.st===ST.FIRE||M.st===ST.RETURN||M.inv>0;
  // 선택 (수동: 키/탭이 부르고, 시간이 끝나면 tick 이 자동으로 불러요)
  M.choose=i=>{if(M.st!==ST.PICK)return false;M.pick=i;emit('pickDone',i);go(ST.FIRE);emit('fire',i);return true};
  M.tick=dt=>{
    if(M.inv>0&&M.st===ST.NORMAL)M.inv=Math.max(0,M.inv-dt);
    if(M.st===ST.NORMAL)return;
    M.t+=dt;
    if(M.st===ST.TRANSFORM&&M.t>=CFG.T_TRANSFORM){go(ST.PICK);M.pickLeft=CFG.PICK_SECONDS;emit('pickOpen');if(M.auto)emit('autoPick')}
    else if(M.st===ST.PICK){M.pickLeft=Math.max(0,CFG.PICK_SECONDS-M.t);if(M.pickLeft<=0)emit('autoPick')}   // 시간 초과 → 게임이 autoPick 결과로 choose 를 불러요
    else if(M.st===ST.FIRE&&M.t>=CFG.T_FIRE){go(ST.RETURN);emit('hit')}
    else if(M.st===ST.RETURN&&M.t>=CFG.T_RETURN){M.inv=CFG.AFTER_INV;go(ST.NORMAL);emit('done')}
  };
  // 배틀이 새로 시작할 때 / 쓰러졌을 때
  M.reset=()=>{M.st=ST.NORMAL;M.t=0;M.uses=CFG.USES_PER_SIDE;M.pick=-1;M.inv=0;M.alive=true};
  M.setAlive=a=>{M.alive=!!a;if(!a&&M.st!==ST.NORMAL){M.st=ST.NORMAL;M.t=0}};
  return M;
}

const API={CFG,ST,TYPE_KO,DMAX_NAME,GMAX_SIG,setMap,formsForDex,infoOf,sigOf,convertMove,convertAll,autoPick,machine,
  // 지도 파일 읽기 (브라우저)
  load(url){return fetch(url||'gmaxmap.json').then(r=>r.ok?r.json():null).then(j=>{if(j)setMap(j);return j}).catch(()=>null)}};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
root.GMX=API;

// ---------- 자체 시험 (node gmax-core.js) ----------
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
  const assert=require('assert');
  const fs=require('fs');
  API.setMap(JSON.parse(fs.readFileSync(__dirname+'/gmaxmap.json','utf8')));
  assert(API.formsForDex(6).includes('CHARIZARD_3'),'리자몽 폼');
  assert.strictEqual(API.sigOf('CHARIZARD_3').name,'거다이옥염');
  const mv=[{id:'flamethrower',name:'화염방사',type:'FIRE',pw:90,ph:false},{id:'airslash',name:'에어슬래시',type:'FLYING',pw:75,ph:false},{id:'dragonpulse',name:'용의파동',type:'DRAGON',pw:85,ph:false},{id:'willowisp',name:'도깨비불',type:'FIRE',pw:0,st:1}];
  const c=API.convertAll(mv,API.sigOf('CHARIZARD_3'));
  assert.strictEqual(c[0].name,'거다이옥염');assert.strictEqual(c[0].pw,190);
  assert.strictEqual(c[1].name,'다이제트');assert.strictEqual(c[1].pw,180);
  assert.strictEqual(c[2].name,'다이드라군');assert.strictEqual(c[3].ok,false);
  assert.strictEqual(API.autoPick(c),0);                       // 위력 기준
  assert.strictEqual(API.autoPick(c,(o,i)=>[10,99,50,0][i]),1); // 점수 기준
  const g=API.machine({canForm:true});const ev=[];['state','pickOpen','fire','hit','done','autoPick'].forEach(k=>g.on(k,(a)=>ev.push(k+(k==='state'?':'+a:''))));
  assert(g.can());assert(g.start());assert(!g.can());assert.strictEqual(g.uses,1);
  assert(g.invincible()&&g.frozen());
  for(let i=0;i<200;i++)g.tick(1/60);                     // 변신 1.5초 → PICK
  assert.strictEqual(g.st,'PICK');
  for(let i=0;i<200;i++)g.tick(1/60);                     // 3초 지나도 안 고르면 autoPick 이벤트
  assert(ev.includes('autoPick'));assert(g.choose(0));assert.strictEqual(g.st,'FIRE');
  while(g.st!=='NORMAL')g.tick(1/60);
  assert.strictEqual(g.st,'NORMAL');assert(g.invincible(),'복귀 뒤 추가 무적');
  for(let i=0;i<40;i++)g.tick(1/60);assert(!g.invincible());
  assert(g.start());for(let i=0;i<800;i++)g.tick(1/60);assert.strictEqual(g.uses,0);
  assert(!g.can());assert.strictEqual(g.why(),'더 이상 변신할 수 없어요');   // 3번째 변신 막힘
  const g2=API.machine({canForm:false});assert(!g2.start());
  console.log('gmax-core 시험 통과');
}
})(typeof window!=='undefined'?window:globalThis);
