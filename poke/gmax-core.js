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
  T_FIRE:3.6,            // 발사 연출 길이(초): 컷인 0~1.0 · 충전 0.75~1.45 · 빔 1.45~ · 명중 1.85 · 여운 ~3.6 (gmax-battle.js 와 맞춰 둠)
  T_RETURN:.6,           // 복귀 연출 길이(초)
  AFTER_INV:.5,          // 복귀 뒤 추가 무적(초)
  POWER_GMAX:190,        // 거다이맥스 전용기 위력
  POWER_DMAX:180,        // 일반 다이기술 위력
  JOIN_WINDOW:1.5,       // 상대가 같이 변신할 수 있는 시간(양쪽 거다이 정면충돌용, 3단계)
  // ---- 2단계에서 추가: 실시간 배틀 연결·연출용 ----
  FIRE_AK:.5,            // 실시간 배틀 피해 배율 (일반 기술은 게임이 .33 을 곱해요. 거다이 발사는 한 방 크게라서 .5)
  SCALE:3.2,             // 거다이 몸 크기(= 게임 기본 캐릭터 크기 ×3.2, 화면 높이 절반까지만)
  IMPACT_AT:1.85,        // 발사 시작 뒤 몇 초에 명중(피해)하는가
  CHARGE_AT:.75, BEAM_AT:1.45, CUT_END:1.0,   // 충전 시작 · 빔 발사 · 컷인 끝 (발사 시작 기준 초)
  AUTO_MIN_T:5,          // 자동 배틀이 변신하기 전 기다리는 시간(초)
  AUTO_GAP:10,           // 자동 배틀이 변신을 또 쓰기까지 기다리는 시간(초)
  AUTO_TRAINER_ONLY:1,   // 1이면 자동 배틀은 트레이너·보스·월드보스 때만 알아서 변신
  // ---- 3단계 마무리: 양쪽 거다이 정면충돌 · AI 변신/합류 ----
  CLASH_T:2.0,           // 정면충돌(빔 맞대기) 지속 시간(초)
  CLASH_PUSH:.35,        // 승부가 난 뒤 이긴 쪽 빔이 상대까지 밀고 들어가는 시간(초)
  CLASH_LOSER_K:.25,     // 진 쪽 기술이 들어가는 피해 비율 (0이면 완전히 막힘, 부가효과는 이긴 쪽만)
  CLASH_NOISE:.12,       // 승부에 섞이는 운(±). 공격력이 비슷할수록 결과가 갈려요
  AI_THINK:1,            // 상대 AI가 변신할지 생각하는 간격(초)
  AI_MIN_T:6,            // 배틀 시작 뒤 이 시간이 지나야 변신 생각을 시작
  AI_GAP:14,             // 직전 변신이 끝나고 다시 변신하기까지 기다리는 시간(초)
  AI_HP_LOW:.55,         // 상대 AI 체력이 이 비율 이하면 변신 확률이 높아져요
  AI_KILL_HP:.3,         // 내 체력이 이 비율 이하면 마무리하려고 변신
  AI_JOIN:.7             // 한쪽이 변신했을 때 다른 쪽(AI·자동 배틀)이 같이 변신할 확률
};

// ---------- 타입 → 다이기술 이름 (물리/특수 기술은 이 이름으로 바뀜, 변화기는 선택 불가) ----------
const TYPE_KO={NORMAL:'노말',FIRE:'불꽃',WATER:'물',ELECTRIC:'전기',GRASS:'풀',ICE:'얼음',FIGHTING:'격투',POISON:'독',GROUND:'땅',FLYING:'비행',PSYCHIC:'에스퍼',BUG:'벌레',ROCK:'바위',GHOST:'고스트',DRAGON:'드래곤',DARK:'악',STEEL:'강철',FAIRY:'페어리'};
const DMAX_NAME={NORMAL:'다이어택',FIRE:'다이번',WATER:'다이스트림',ELECTRIC:'다이썬더',GRASS:'다이그래스',ICE:'다이아이스',FIGHTING:'다이너클',POISON:'다이애시드',GROUND:'다이어스',FLYING:'다이제트',PSYCHIC:'다이사이코',BUG:'다이웜',ROCK:'다이록',GHOST:'다이할로우',DRAGON:'다이드라군',DARK:'다이아크',STEEL:'다이스틸',FAIRY:'다이페어리'};
// 거다이맥스 전용기 — 레조넌스(Pokemon-Resonance)의 전용기 표를 그대로 옮겼어요 (이름·타입·위력·맞았을 때 부가효과).
//  n=이름 t=타입 p=위력(없으면 CFG.POWER_GMAX) fx=부가효과 d=화면에 보여줄 설명
//  fx 종류(게임의 실시간 배틀에 맞게 옮긴 것):
//   dot   {sec,frac,spare}  맞은 뒤 sec초 동안 1초마다 최대HP×frac 피해 (spare 타입이면 안 입음)   ← 레조넌스 "side" 효과
//   bind  {sec,frac}        가두기: 움직임 크게 둔해지고 지속 피해                                  ← 사진·백화
//   poison/par/conf/snooze/terror/cuddle/befuddle  상태이상 (게임에 상태이상 시스템이 없어서 배틀 파일 안에서 따로 처리)
//   slow {sec,k}            상대 움직임이 k배로 느려짐 (속도·회피↓·중력 대신)
//   cdAdd {sec}/torment{sec} 상대 기술 대기시간 연장 (PP 감소·트집 대신)
//   heal/cure/buff/guard/replenish/defog  내 쪽 효과
const GMAX_MOVE={
  GMAXVINELASH:{n:'거다이편달',t:'GRASS',fx:{k:'dot',sec:8,frac:1/32,spare:'GRASS'},d:'8초간 지속 피해 (풀 타입은 안 입음)'},
  GMAXWILDFIRE:{n:'거다이옥염',t:'FIRE',fx:{k:'dot',sec:8,frac:1/32,spare:'FIRE'},d:'8초간 지속 피해 (불꽃 타입은 안 입음)'},
  GMAXCANNONADE:{n:'거다이포격',t:'WATER',fx:{k:'dot',sec:8,frac:1/32,spare:'WATER'},d:'8초간 지속 피해 (물 타입은 안 입음)'},
  GMAXVOLCALITH:{n:'거다이분석',t:'ROCK',fx:{k:'dot',sec:8,frac:1/32,spare:'ROCK'},d:'8초간 지속 피해 (바위 타입은 안 입음)'},
  GMAXDRUMSOLO:{n:'거다이난타',t:'GRASS',p:160,d:'위력 160 고정 · 부가효과 없음'},
  GMAXFIREBALL:{n:'거다이화염구',t:'FIRE',p:160,d:'위력 160 고정 · 부가효과 없음'},
  GMAXHYDROSNIPE:{n:'거다이저격',t:'WATER',p:160,d:'위력 160 고정 · 부가효과 없음'},
  GMAXVOLTCRASH:{n:'거다이만뢰',t:'ELECTRIC',fx:{k:'par'},d:'상대 마비 (느려지고 잠깐 굳음)'},
  GMAXSTUNSHOCK:{n:'거다이감전',t:'ELECTRIC',fx:{k:'par'},d:'상대 마비 (느려지고 잠깐 굳음)'},
  GMAXMALODOR:{n:'거다이악취',t:'POISON',fx:{k:'poison',sec:10,frac:1/16},d:'상대 독 (10초간 지속 피해)'},
  GMAXBEFUDDLE:{n:'거다이고혹',t:'BUG',fx:{k:'befuddle'},d:'상대를 독·마비·잠 중 하나로'},
  GMAXSMITE:{n:'거다이천벌',t:'FAIRY',fx:{k:'conf',sec:6},d:'상대 혼란 (6초간 헤매고 공격 약해짐)'},
  GMAXGOLDRUSH:{n:'거다이금화',t:'NORMAL',fx:{k:'conf',sec:6},d:'상대 혼란 (6초간 헤매고 공격 약해짐)'},
  GMAXCUDDLE:{n:'거다이포옹',t:'NORMAL',fx:{k:'cuddle',sec:6,pulse:1.5,chance:.5,stagger:.6},d:'6초간 헤롱헤롱 (1.5초마다 50%로 멈칫)'},
  GMAXSTONESURGE:{n:'거다이암진',t:'WATER',fx:{k:'dot',sec:8,frac:1/32,spare:'',label:'스텔스락'},d:'뾰족한 바위 함정 (8초간 지속 피해)'},
  GMAXSTEELSURGE:{n:'거다이강철진',t:'STEEL',fx:{k:'dot',sec:8,frac:1/32,spare:'STEEL',label:'강철 압정'},d:'강철 함정 (8초간 지속 피해)'},
  GMAXCENTIFERNO:{n:'거다이백화',t:'FIRE',fx:{k:'bind',sec:6,frac:1/32,label:'불꽃 소용돌이'},d:'6초간 가둠 (움직임 둔화 + 지속 피해)'},
  GMAXSANDBLAST:{n:'거다이사진',t:'GROUND',fx:{k:'bind',sec:6,frac:1/32,label:'모래 지옥'},d:'6초간 가둠 (움직임 둔화 + 지속 피해)'},
  GMAXFOAMBURST:{n:'거다이포말',t:'WATER',fx:{k:'slow',sec:10,k2:.45,label:'스피드 DOWN'},d:'상대 속도 크게 DOWN (10초)'},
  GMAXWINDRAGE:{n:'거다이풍격',t:'FLYING',fx:{k:'defog'},d:'상대 방어 효과·내 불리한 효과 제거'},
  GMAXGRAVITAS:{n:'거다이천도',t:'PSYCHIC',fx:{k:'slow',sec:10,k2:.7,label:'중력'},d:'10초간 중력 (상대 둔해짐)'},
  GMAXFINALE:{n:'거다이단원',t:'FAIRY',fx:{k:'heal',frac:1/6},d:'내 HP 최대치의 1/6 회복'},
  GMAXSWEETNESS:{n:'거다이감로',t:'GRASS',fx:{k:'cure'},d:'내 약화 효과 해제'},
  GMAXTARTNESS:{n:'거다이산격',t:'GRASS',fx:{k:'slow',sec:8,k2:.8,label:'회피 DOWN'},d:'상대 회피 DOWN (8초간 둔해짐)'},
  GMAXREPLENISH:{n:'거다이재생',t:'NORMAL',fx:{k:'replenish',chance:.5},d:'50% 확률로 내 기술 대기시간 초기화'},
  GMAXDEPLETION:{n:'거다이감쇠',t:'DRAGON',fx:{k:'cdAdd',sec:5},d:'상대 기술 대기시간 +5초'},
  GMAXRESONANCE:{n:'거다이선율',t:'ICE',fx:{k:'guard',sec:8,label:'오로라베일'},d:'8초간 오로라베일 (받는 피해 감소)'},
  GMAXCHISTRIKE:{n:'거다이회심격',t:'FIGHTING',fx:{k:'buff',sec:12,label:'급소 집중'},d:'내 공격 UP (12초)'},
  GMAXTERROR:{n:'거다이환영',t:'GHOST',fx:{k:'terror',sec:4},d:'4초간 상대가 도망 못 침 (제자리에 붙잡음)'},
  GMAXSNOOZE:{n:'거다이수마',t:'DARK',fx:{k:'snooze',wait:3,sleep:2.5},d:'3초 뒤 상대가 잠듦 (2.5초)'},
  GMAXMELTDOWN:{n:'거다이융격',t:'STEEL',fx:{k:'torment',sec:8},d:'8초간 트집 (상대 기술 대기시간 2배로)'},
  GMAXONEBLOW:{n:'거다이일격',t:'DARK',d:'방어·회피 무시 · 부가효과 없음'},
  GMAXRAPIDFLOW:{n:'거다이연격',t:'WATER',d:'방어·회피 무시 · 부가효과 없음'}
};
// 거다이 폼 → 전용기 (공식 대응, 레조넌스와 같음)
const GMAX_FORM={VENUSAUR_2:'GMAXVINELASH',CHARIZARD_3:'GMAXWILDFIRE',BLASTOISE_2:'GMAXCANNONADE',BUTTERFREE_1:'GMAXBEFUDDLE',PIKACHU_17:'GMAXVOLTCRASH',MEOWTH_3:'GMAXGOLDRUSH',MACHAMP_1:'GMAXCHISTRIKE',GENGAR_2:'GMAXTERROR',KINGLER_1:'GMAXFOAMBURST',LAPRAS_1:'GMAXRESONANCE',EEVEE_2:'GMAXCUDDLE',SNORLAX_1:'GMAXREPLENISH',GARBODOR_1:'GMAXMALODOR',MELMETAL_1:'GMAXMELTDOWN',RILLABOOM_1:'GMAXDRUMSOLO',CINDERACE_1:'GMAXFIREBALL',INTELEON_1:'GMAXHYDROSNIPE',CORVIKNIGHT_1:'GMAXWINDRAGE',ORBEETLE_1:'GMAXGRAVITAS',DREDNAW_1:'GMAXSTONESURGE',COALOSSAL_1:'GMAXVOLCALITH',FLAPPLE_1:'GMAXTARTNESS',APPLETUN_1:'GMAXSWEETNESS',SANDACONDA_1:'GMAXSANDBLAST',TOXTRICITY_2:'GMAXSTUNSHOCK',TOXTRICITY_3:'GMAXSTUNSHOCK',CENTISKORCH_1:'GMAXCENTIFERNO',HATTERENE_1:'GMAXSMITE',GRIMMSNARL_1:'GMAXSNOOZE',COPPERAJAH_1:'GMAXSTEELSURGE',DURALUDON_1:'GMAXDEPLETION',URSHIFU_2:'GMAXONEBLOW',URSHIFU_3:'GMAXRAPIDFLOW',ALCREMIE_63:'GMAXFINALE'};
const GMAX_SIG={};for(const k in GMAX_FORM)GMAX_SIG[k.replace(/_\d+$/,'')]=GMAX_MOVE[GMAX_FORM[k]].n;
// 일반 다이기술(전용기 아닌 것)의 부가효과 — 레조넌스의 능력치 변화를 실시간 배틀에 맞게 옮긴 것 (날씨·필드는 이 게임에 없어서 뺐어요)
const DMAX_FX={FIGHTING:{k:'buff',sec:10,d:'내 공격 UP'},POISON:{k:'buff',sec:10,d:'내 공격 UP'},STEEL:{k:'guard',sec:8,d:'받는 피해 감소'},GROUND:{k:'guard',sec:8,d:'받는 피해 감소'},DRAGON:{k:'debuff',sec:10,d:'상대 공격 DOWN'},BUG:{k:'debuff',sec:10,d:'상대 공격 DOWN'},NORMAL:{k:'slow',sec:8,k2:.7,d:'상대 속도 DOWN'}};

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
  const id=GMAX_FORM[formKey],M=id&&GMAX_MOVE[id];
  if(M)return{id,name:M.n,type:M.t,p:M.p||0,fx:M.fx||null,d:M.d||''};
  const t=(I.types||[])[0];   // 표에 없는 폼은 「거다이+속성」
  return{id:null,name:'거다이'+(TYPE_KO[t]||''),type:t,p:0,fx:null,d:''};
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
  // 상대가 먼저 변신한 뒤에 같이 변신(합류): 연출 시간을 상대와 똑같이 맞춰서 시작해요 (t = 상대의 변신 경과 시간)
  M.startAt=t=>{if(!M.start())return false;M.t=Math.max(0,t||0);return true};
  M.fireLen=0;   // 0이면 CFG.T_FIRE. 정면충돌이면 게임이 더 길게 잡아요
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
    else if(M.st===ST.FIRE&&M.t>=(M.fireLen||CFG.T_FIRE)){go(ST.RETURN);emit('hit')}
    else if(M.st===ST.RETURN&&M.t>=CFG.T_RETURN){M.inv=CFG.AFTER_INV;M.fireLen=0;go(ST.NORMAL);emit('done')}
  };
  // 배틀이 새로 시작할 때 / 쓰러졌을 때
  M.reset=()=>{M.st=ST.NORMAL;M.t=0;M.uses=CFG.USES_PER_SIDE;M.pick=-1;M.inv=0;M.alive=true;M.fireLen=0};
  M.setAlive=a=>{M.alive=!!a;if(!a&&M.st!==ST.NORMAL){M.st=ST.NORMAL;M.t=0}};
  return M;
}


// ---------- 정면충돌 (양쪽 거다이가 같이 발사) ----------
// a,b = 각자 기술의 예상 피해(상성·능력치 반영) → 내 몫 0~1. 둘 다 0이면 .5
function clashShare(a,b){a=Math.max(0,+a||0);b=Math.max(0,+b||0);return a+b>0?a/(a+b):.5}
// r = 내 몫, rnd = 0~1 난수 → 'me' | 'foe'  (몫이 .5 를 넘으면 유리하지만 운도 섞여요)
function clashWinner(r,rnd){const n=((rnd==null?.5:rnd)-.5)*2*CFG.CLASH_NOISE;return r+n>=.5?'me':'foe'}
// 충돌 중 게이지 위치 g (0=내 입 끝, 1=상대 입 끝), u = 충돌 진행 0~1. 시작은 정중앙, 몫이 큰 쪽으로 서서히 밀려요.
function clashGauge(r,u,wob){u=Math.max(0,Math.min(1,u));const e=1-(1-u)*(1-u);const g=.5+(r-.5)*1.5*e+(wob||0);return Math.max(.1,Math.min(.9,g))}
// ---------- 상대 AI 의 변신 판단 ----------
// c: {usesLeft, selfHp(0~1, 변신하려는 쪽), otherHp(0~1), t(배틀 시간), since(직전 변신 뒤 시간), rnd}
function aiWantsGmax(c){
  if(!(c.usesLeft>0))return false;
  if(c.t<CFG.AI_MIN_T||c.since<CFG.AI_GAP)return false;
  const r=c.rnd==null?Math.random():c.rnd;
  if(c.selfHp<=CFG.AI_HP_LOW)return r<.55;     // 몰리면 변신
  if(c.otherHp<=CFG.AI_KILL_HP)return r<.35;   // 상대를 마무리할 때
  if(c.usesLeft>=CFG.USES_PER_SIDE&&c.t>=12)return r<.12;   // 아직 한 번도 안 썼으면 가끔 그냥 변신
  return false}
// 상대(또는 자동 배틀의 나)가 변신하는 걸 보고 같이 변신할까?
function aiWantsJoin(c){
  if(!(c.usesLeft>0))return false;
  const r=c.rnd==null?Math.random():c.rnd,p=c.selfHp<=.5?Math.min(1,CFG.AI_JOIN+.2):CFG.AI_JOIN;
  return r<p}

const API={CFG,ST,clashShare,clashWinner,clashGauge,aiWantsGmax,aiWantsJoin,TYPE_KO,DMAX_NAME,GMAX_SIG,GMAX_MOVE,GMAX_FORM,DMAX_FX,setMap,formsForDex,infoOf,sigOf,convertMove,convertAll,autoPick,machine,
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
  // 3단계 마무리 시험: 정면충돌·AI 판단·합류 시작
  assert.strictEqual(API.clashShare(100,100),.5);assert.strictEqual(API.clashShare(0,0),.5);assert(API.clashShare(300,100)>.7);
  assert.strictEqual(API.clashWinner(.9,.5),'me');assert.strictEqual(API.clashWinner(.1,.5),'foe');
  assert.strictEqual(API.clashWinner(.5,.99),'me');assert.strictEqual(API.clashWinner(.5,.01),'foe');   // 막상막하면 운이 갈라요
  assert.strictEqual(API.clashWinner(.9,0),'me');  // 몫이 압도적이면 운이 나빠도 이김
  assert(Math.abs(API.clashGauge(.5,.5,0)-.5)<1e-9);assert(API.clashGauge(.9,1,0)>.8&&API.clashGauge(.1,1,0)<.2);assert(API.clashGauge(1,1,.5)<=.9);
  const base={usesLeft:2,selfHp:1,otherHp:1,t:20,since:99,rnd:0};
  assert(!API.aiWantsGmax(Object.assign({},base,{usesLeft:0})));assert(!API.aiWantsGmax(Object.assign({},base,{t:3})));assert(!API.aiWantsGmax(Object.assign({},base,{since:3})));
  assert(API.aiWantsGmax(Object.assign({},base,{selfHp:.4})));assert(API.aiWantsGmax(Object.assign({},base,{otherHp:.2,usesLeft:1})));
  assert(!API.aiWantsGmax(Object.assign({},base,{rnd:.99,selfHp:.4})));assert(!API.aiWantsGmax(Object.assign({},base,{usesLeft:1})));
  assert(API.aiWantsJoin({usesLeft:1,selfHp:1,rnd:.1}));assert(!API.aiWantsJoin({usesLeft:0,selfHp:1,rnd:0}));assert(!API.aiWantsJoin({usesLeft:1,selfHp:1,rnd:.95}));
  {const a=API.machine({canForm:true}),b=API.machine({canForm:true});assert(a.start());for(let i=0;i<30;i++){a.tick(1/60);b.tick(1/60)}
   assert(b.startAt(a.t));assert(Math.abs(a.t-b.t)<1e-9);
   for(let i=0;i<200;i++){a.tick(1/60);b.tick(1/60)}assert.strictEqual(a.st,'PICK');assert.strictEqual(b.st,'PICK');   // 같이 선택 단계로
   a.choose(0);b.choose(0);a.fireLen=b.fireLen=API.CFG.T_FIRE+API.CFG.CLASH_T+API.CFG.CLASH_PUSH;
   for(let i=0;i<60*API.CFG.T_FIRE+20;i++){a.tick(1/60);b.tick(1/60)}assert.strictEqual(a.st,'FIRE');   // 충돌 때문에 평소 길이로는 안 끝나요
   while(a.st!=='NORMAL'||b.st!=='NORMAL'){a.tick(1/60);b.tick(1/60)}assert.strictEqual(a.fireLen,0)}
  console.log('gmax-core 시험 통과');
}
})(typeof window!=='undefined'?window:globalThis);
