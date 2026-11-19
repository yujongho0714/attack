/* 거다이맥스 배틀 연결 (2단계) — gmax-core.js 의 규칙 모듈을 "실시간 배틀(ACT)"에 붙여요.
 *
 *  흐름:  일반 전투 ─(변신 버튼 / F키 / 패드 R3)→ 변신 연출 → 기술 선택(3초) → 발사 연출·명중 → 복귀 → 일반 전투
 *  - 변신~발사 동안(복귀 뒤 0.5초 더) 변신한 쪽은 무적: 피해·상태이상·넉백 전부 무시
 *  - 연출 동안 월드(내 움직임·상대 AI·쿨타임·타이머)는 멈추고, 연출 그림만 움직여요
 *  - 3단계 마무리: 상대(AI)도 거다이맥스해요 (몰리거나 마무리할 때). 한쪽이 변신하면 변신 연출 1.5초 동안 다른 쪽이 같이 변신(합류)할 수 있고,
 *    둘 다 발사하면 빔이 한가운데서 부딪히는 "정면충돌" — 공격력(예상 피해) 비율로 게이지가 밀리고, 이긴 쪽만 제대로 맞혀요 (진 쪽은 CLASH_LOSER_K 만큼만)
 *
 *  게임 코드(index.html)는 건드리지 않고, 게임의 함수를 "감싸는" 방식(게임이 이미 쓰는 방식)으로 붙였어요.
 *  index.html 에서는 gmax-core.js 를 읽은 뒤 이 파일을 읽어요.
 *  그림은 gmax/ 폴더에서 읽어요 (gmax/<세트>/Idle·Attack·Hurt-Anim.png, gmax/sets/<세트>.json, gmax/gmax-front/<앞모습>.png)
 *  → 그림이 없는 종은 변신 버튼이 안 나와요. (3단계: 레조넌스의 거다이 34종 전부 연결 — 움직이는 그림이 있는 종은 대기·공격·피격, 없는 종은 앞모습 그림)
 *  → 전용기 이름·타입·위력·부가효과는 gmax-core.js 의 GMAX_MOVE 표, 효과를 실제로 거는 코드는 이 파일의 applyFx/fxRun
 *
 *  디버그: 콘솔에서 GMXB.state() / GMXB.start() / GMXB.B
 */
(function(){
'use strict';
if(window.GMXB||!window.GMX)return;
const GM=window.GMX,CFG=GM.CFG,ST=GM.ST;
// 밸런스·연출 상수 (gmax-core.js 의 CFG 에 있으면 그 값을 써요)
const DEF={T_FIRE:3.6,IMPACT_AT:1.85,FIRE_AK:.5,SCALE:3.2,AUTO_MIN_T:5,AUTO_GAP:10,AUTO_TRAINER_ONLY:1,CUT_END:1.0,CHARGE_AT:.75,BEAM_AT:1.45,CLASH_T:2,CLASH_PUSH:.35,CLASH_LOSER_K:.25,AI_THINK:1,CLASH_TAP:.025,CLASH_TAP_MAX:.2,AI_WILD:1,WILD_USES:1,AI_WILD_K:.6};
const C=k=>CFG[k]!=null?CFG[k]:DEF[k];
const BASE='gmax/';
const SFX_PLAN=[{at:0,k:'gather',g:.7},{at:.4,k:'surge',g:.55},{at:1.42,k:'land',g:.8},{at:1.55,k:'clouds',g:.6},{at:1.55,k:'crackle',g:.5},{at:1.67,cry:1}];

const B={duel:null,stMe:null,joinPlan:null,mach:null,fk:null,assets:{},opts:[],pick:-1,want:0,wantT:0,hold:null,holdT:0,hitDone:0,sfxI:0,cs:null,dmg:0,foeHpFrom:0,shk:0,
  pad:0,rowMe:2,btn:null,pickEl:null,css:0,faintAfter:0};

// ---------- 작은 도우미 ----------
const inBattle=()=>{try{return SCENE==='battle'&&BS.on&&ACT.on&&BS.me&&BS.foe&&BS.me.m&&BS.foe.m}catch(e){return false}};
// 양쪽(나 / 상대)이 거다이맥스할 수 있어서 상태를 한 벌씩 둬요. B = 내 쪽(+공용), F = 상대 쪽.
const F={mach:null,fk:null,opts:[],pick:-1,sel:null,hitDone:0,sfxI:0,seed:0,cs:null,usesBy:new Map(),curMon:null,thinkT:0,tDone:null,hold:null,holdT:0,waitPick:0};
function view(side,src){const o={side};
  for(const [k,sk] of [['M','mach'],['fk','fk'],['opts','opts'],['sel','sel'],['pick','pick'],['hitDone','hitDone'],['sfxI','sfxI'],['seed','seed'],['cs','cs']])Object.defineProperty(o,k,{get:()=>src[sk],set:v=>{src[sk]=v}});
  Object.defineProperty(o,'a',{get:()=>side==='me'?BS.me:BS.foe});   // 쏘는 쪽
  Object.defineProperty(o,'d',{get:()=>side==='me'?BS.foe:BS.me});   // 맞는 쪽
  Object.defineProperty(o,'duel',{get:()=>!!(B.duel&&B.duel.on)});
  return o}
let XS=null;const other=X=>XS[X.side==='me'?'foe':'me'];
const active=()=>!!B.mach&&(B.mach.st!==ST.NORMAL||(!!F.mach&&F.mach.st!==ST.NORMAL));   // 어느 쪽이든 연출 중이면 월드 정지
const ease={out:u=>1-(1-u)*(1-u),back:u=>{const c=1.9;return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2)},cl:(u,a,b)=>Math.max(0,Math.min(1,(u-a)/(b-a)))};
const hex2rgba=(h,a)=>{h=String(h||'#fff').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16)||0;return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'};
const volOpt=()=>{try{return G&&G.opt&&G.opt.vol!=null?G.opt.vol:1}catch(e){return 1}};

// ---------- 어떤 거다이 폼으로 변신하나 ----------
// 거다이 폼 자체(환상)면 그 폼, 일반 포켓몬이면 같은 도감번호의 거다이 폼. 메가·다른 폼은 제외.
function formKeyOf(m){
  try{const M=META[m.n];if(!M)return null;
    if(M.form==='gmax'){const k=String(m.n).replace(/^sc:/,'');return GM.infoOf(k)?k:null}
    if(M.form)return null;
    return GM.formsForDex(M.dex)[0]||null}catch(e){return null}}

// ---------- 그림·소리 읽기 ----------
const IMG={};function loadImg(url){return IMG[url]||(IMG[url]=new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>{delete IMG[url];res(null)};i.src=url}))}   // 못 받은 그림은 기억하지 않아요 (다시 시도할 수 있게)
// 그림 읽기. GitHub Pages 가 "속도 제한 초과"(요청이 너무 많음)로 막으면 못 받을 수 있어서, 실패하면 잠시 뒤 자동으로 다시 시도해요 (최대 6번, 점점 길게 기다림)
const RT={},LD={};
XS={me:view('me',B),foe:view('foe',F)};
function loadAssets(fk){
  if(LD[fk])return;
  const cur=B.assets[fk];
  if(cur!==undefined){
    if(cur&&!cur.partial)return;   // 다 받았으면 끝
    const r=RT[fk]||(RT[fk]={n:0,at:performance.now()+3000});
    if(r.n>=6||performance.now()<r.at)return;
    r.n++;r.at=performance.now()+Math.min(30000,3000*(r.n+1))}
  const I=GM.infoOf(fk);if(!I){B.assets[fk]=null;RT[fk]={n:99,at:0};return}
  LD[fk]=1;
  (async()=>{const o={fk,info:I,anims:null,img:{},front:null,fn:I.frontFrames||1};
    try{if(I.gmaxSet){const r=await fetch(BASE+'sets/'+I.gmaxSet+'.json');if(r.ok){const j=await r.json();o.anims=j.anims;
        await Promise.all(Object.keys(j.anims).map(async k=>{o.img[k]=await loadImg(BASE+I.gmaxSet+'/'+j.anims[k].f+'-Anim.png')}));if(!o.img.idle)o.anims=null}}}catch(e){o.anims=null}
    try{if(I.front)o.front=await loadImg(BASE+'gmax-front/'+I.front)}catch(e){}
    if(!o.anims&&!o.front){if(cur===undefined)B.assets[fk]=null;return}
    o.cloudB=(cur&&cur.cloudB)||await loadImg(BASE+'dynamax-cloud/cloud-back.png');o.cloudF=(cur&&cur.cloudF)||await loadImg(BASE+'dynamax-cloud/cloud-front.png');
    o.partial=(!!I.gmaxSet&&!o.anims)||!o.cloudB||!o.cloudF;   // 일부만 받았으면 나중에 다시 시도
    B.assets[fk]=o})().catch(()=>{if(B.assets[fk]===undefined)B.assets[fk]=null}).then(()=>{LD[fk]=0})}
const ready=fk=>!!fk&&B.assets[fk]&&B.assets[fk]!=='loading';
const ABUF={},ALOAD={};
function play(k,gain,rate){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state!=='running')AC.resume();
  const go=b=>{const s=AC.createBufferSource(),g=AC.createGain();s.buffer=b;if(rate)s.playbackRate.value=rate;g.gain.value=(gain||.6)*volOpt();s.connect(g);g.connect(AC.destination);s.start()};
  if(ABUF[k])return go(ABUF[k]);if(ALOAD[k])return;ALOAD[k]=fetch(BASE+'sfx/'+k+'.wav').then(r=>r.arrayBuffer()).then(a=>new Promise((ok,no)=>AC.decodeAudioData(a,ok,no))).then(b=>{ABUF[k]=b}).catch(()=>{})}catch(e){}}
function preloadSfx(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();for(const p of SFX_PLAN)if(p.k&&!ABUF[p.k]&&!ALOAD[p.k])ALOAD[p.k]=fetch(BASE+'sfx/'+p.k+'.wav').then(r=>r.arrayBuffer()).then(a=>new Promise((ok,no)=>AC.decodeAudioData(a,ok,no))).then(b=>{ABUF[p.k]=b}).catch(()=>{})}catch(e){}}
function cry(m){try{dexCry(META[m.n].dex);if(CRY)CRY.playbackRate=.8}catch(e){}}

// ---------- 기술 변환 (게임의 기술 → 다이기술) ----------
function buildOptions(m,fk){
  const sig=GM.sigOf(fk)||{name:'거다이맥스',type:META[m.n].types[0]};
  const L=m.moves.map(id=>{const x=mv(id);return{id:x.id||id,name:x.name,type:x.type,pw:x.pw||0,ph:!!x.ph,st:x.st?1:(x.pw>0?0:1)}});
  const opts=GM.convertAll(L,sig);
  // 전용기는 위력·부가효과를, 일반 다이기술은 능력치 효과를 붙여요 (레조넌스와 같은 규칙)
  opts.forEach(o=>{if(!o||!o.ok)return;if(o.gmax){if(sig.p)o.pw=sig.p;o.fx=sig.fx;o.fxd=sig.d}else{const g=GM.DMAX_FX&&GM.DMAX_FX[o.type];if(g){o.fx=g;o.fxd=g.d}}});
  if(!opts.some(o=>o&&o.ok)){   // 쓸 수 있는 공격기가 없어도 변신이 헛되지 않게 전용기 하나를 줘요
    opts.push({src:'gmax_default',ok:true,type:sig.type,ph:false,name:sig.name,pw:sig.p||CFG.POWER_GMAX,gmax:true,acc:100,pierce:true,from:'(전용기)',fx:sig.fx,fxd:sig.d})}
  opts.forEach((o,i)=>{if(L[i])o.from=L[i].name});
  return opts.slice(0,5)}
function dmgOfOpt(o,atk,def){try{const fm={id:'gmx_'+o.src,name:o.name,type:o.type,pw:o.pw,ph:o.ph,acc:100};return dmgCalc(atk,def,fm,false)}catch(e){return{d:o.pw,e:1}}}
function autoIndex(){const me=BS.me.m,foe=BS.foe.m;return GM.autoPick(B.opts,o=>dmgOfOpt(o,me,foe).d*(o.acc||100)/100)}

// ---------- 시작 조건 · 시작 ----------
function refreshForm(){
  const M=B.mach;if(!M||!inBattle())return;
  const fk=formKeyOf(BS.me.m);B.fk=fk;if(fk)loadAssets(fk);
  M.canForm=!!fk&&ready(fk);M.alive=BS.me.m.hp>0}
function canStartNow(){
  const M=B.mach;if(!M||!inBattle())return false;
  return M.can()&&!ACT.down&&!ACT.pause&&BS.me.m.hp>0&&BS.foe.m.hp>0&&!ACT.busy&&!(ACT.roll>0)}
function joinable(){const M=B.mach,N=F.mach;return !!(M&&N&&inBattle()&&N.st===ST.TRANSFORM&&M.st===ST.NORMAL&&N.t<=Math.min(CFG.JOIN_WINDOW||1.5,CFG.T_TRANSFORM-.1)&&M.can()&&!ACT.down&&BS.me.m.hp>0)}
// 상대가 변신하는 걸 보고 나도 같이 변신 (변신 연출 시간을 똑같이 맞춰서 시작 → 같이 기술 고르고 같이 발사 = 정면충돌)
function tryJoin(){
  const M=B.mach,N=F.mach;if(!M||!N||!inBattle())return;
  if(!joinable()){try{toast(M.canForm?(M.uses<=0?'더 이상 변신할 수 없어요':'이미 늦었어요'):'변신할 수 없어요')}catch(e){}return}
  M.auto=!!(typeof actAuto==='function'&&actAuto());preloadSfx();M.startAt(N.t)}
function tryStart(){
  const M=B.mach;if(!M||!inBattle())return;
  if(F.mach&&F.mach.st!==ST.NORMAL&&M.st===ST.NORMAL){tryJoin();return}
  if(active())return;
  if(!M.canForm){try{toast(M.why()||'변신할 수 없어요')}catch(e){}return}
  if(M.uses<=0){try{toast('더 이상 변신할 수 없어요')}catch(e){}return}
  if(!canStartNow()){B.want=1;B.wantT=1.2;return}   // 기술 쓰는 중이면 끝나자마자 시작
  B.want=0;M.auto=!!(typeof actAuto==='function'&&actAuto());preloadSfx();
  M.start()}

// ---------- 상태가 바뀔 때 (X = 변신한 쪽: XS.me / XS.foe) ----------
function onState(X,s,p){
  const me=X.a,foe=X.d,mine=X.side==='me';
  if(s===ST.TRANSFORM){
    X.cs={t0:performance.now()};X.sfxI=0;X.hitDone=0;X.pick=-1;X.seed=Math.random()*100;if(mine)B.faintAfter=0;
    // 무적 · 월드 정지 준비
    if(mine){B.hold=me.m.hp;ACT.inv=99;try{ACT.stick.on=0;ACT.stick.x=ACT.stick.y=0;ACT.aim=null;ACT.buf=null;ACT.roll=0}catch(e){}}
    else F.hold=me.m.hp;
    try{ACT.ai.tel=0;ACT.ai.m=null}catch(e){}
    me.vx=me.vy=0;me.kx=me.ky=0;me.alpha=1;me.rot=0;me.trail=0;me.row=dirRow(foe.ax-me.ax,foe.ay-me.ay);
    X.opts=buildOptions(me.m,X.fk);
    document.body.classList.add('gmxcine');
    try{FX2.flash('#ffffff',.5)}catch(e){}
    ui(1)}
  else if(s===ST.FIRE){
    if(mine){B.shk=0;closePick()}
    const o=X.opts[X.pick]||X.opts[0];X.sel=o;if(mine)B.foeHpFrom=foe.m.hp;
    me.lastMv={name:o.name,type:o.type};
    // 상대(AI)가 먼저 골라 놓고 기다리는 중이면 내가 고르는 순간 같이 발사
    if(mine&&F.waitPick&&F.mach.st===ST.PICK){F.waitPick=0;releaseFoePick()}
    ui(1)}
  else if(s===ST.RETURN){
    if(!X.hitDone)applyHitX(X,1)}
  else if(s===ST.NORMAL&&p===ST.RETURN){
    finish(X)}}
function onPickOpen(){openPick()}
function autoIdxFor(X){return GM.autoPick(X.opts,o=>dmgOfOpt(o,X.a.m,X.d.m).d*(o.acc||100)/100)}
function onAutoPick(X){
  const M=X.M;if(M.st!==ST.PICK)return;
  // 같이 변신해서 내가 아직 고르는 중이면, 상대는 골라 놓고 기다렸다가 같이 발사해요
  if(X.side==='foe'&&B.mach.st===ST.PICK){F.waitPick=1;return}
  let i=autoIdxFor(X);if(i<0)i=X.opts.findIndex(o=>o&&o.ok);if(i<0)i=0;X.pick=i;M.choose(i)}
function releaseFoePick(){const M=F.mach;if(M.st!==ST.PICK)return;let i=autoIdxFor(XS.foe);if(i<0)i=F.opts.findIndex(o=>o&&o.ok);if(i<0)i=0;F.pick=i;M.choose(i)}
// 기절 확인: 상대가 쓰러지면 승리, 내가 쓰러지면 게임의 "쓰러짐" 처리로 (거다이 피해는 게임의 기술 코드를 안 거치니까 여기서 불러 줘요)
function koCheck(){
  if(!ACT.on||B.faintT)return;const me=BS.me,foe=BS.foe;if(!me||!foe)return;
  if(foe.m.hp<=0){B.faintT=1;try{banner('기절!','#ff5a5a')}catch(e){}setTimeout(()=>{B.faintT=0;if(ACT.on&&BS.foe&&BS.foe.m.hp<=0)actEnd({t:'rt'})},700)}
  else if(me.m.hp<=0&&!ACT.down){B.faintT=1;setTimeout(()=>{B.faintT=0;if(ACT.on&&!ACT.down&&BS.me&&BS.me.m.hp<=0&&typeof actDowned==='function')actDowned()},500)}}
function finish(X){
  const me=X.a,mine=X.side==='me';if(!me)return;
  me.hide=0;me.glow=0;me.sc=1;if(mine)closePick();
  if(mine){B.tDone=ACT.t;ACT.inv=Math.max(0,CFG.AFTER_INV);B.holdT=.2}   // 복귀 뒤 0.5초 더 무적 (남은 투사체가 늦게 닿아도 HP 유지)
  else{F.tDone=ACT.t;F.holdT=.2}
  if(!active()){document.body.classList.remove('gmxcine');B.duel=null}
  try{FX2.flash('#ffffff',.35)}catch(e){}
  koCheck();ui(1)}
function abort(){   // 배틀이 갑자기 끝나면 정리
  B.st=null;B.stMe=null;B.faintT=0;B.duel=null;B.joinPlan=null;
  const wasF=F.mach&&F.mach.st!==ST.NORMAL;
  try{for(const M of [B.mach,F.mach]){if(M){M.st=ST.NORMAL;M.t=0;M.fireLen=0}}}catch(e){}
  document.body.classList.remove('gmxcine');closePick();
  try{if(BS.me){BS.me.hide=0;BS.me.glow=0}if(wasF&&BS.foe){BS.foe.hide=0;BS.foe.glow=0}}catch(e){}
  B.hold=null;F.hold=null;F.waitPick=0;B.want=0}

// ---------- 명중 ----------
// X 가 쏜 기술이 맞아요. K=피해 배율(정면충돌에서 진 쪽은 CLASH_LOSER_K), chip=true 면 부가효과 없이 가볍게, guard=true 면 이 피해로는 쓰러지지 않아요
function applyHitX(X,K,chip,guard){
  if(X.hitDone)return;X.hitDone=1;K=K==null?1:K;
  const me=X.a,foe=X.d,atk=me.m,def=foe.m,o=X.sel||X.opts[0],S=bsz(),mine=X.side==='me',vk=chip?.55:1;
  const r=dmgOfOpt(o,atk,def);let dmg=Math.max(1,Math.floor(r.d*C('FIRE_AK')*K*(0.9+R()*.1)*(()=>{try{return rzMul(me,foe)}catch(e){return 1}})()));
  if(r.e===0||K<=0)dmg=0;
  try{if(mine&&!chip&&OPER.on&&OPER.one)dmg=def.hp}catch(e){}
  if(guard)dmg=Math.min(dmg,Math.max(0,def.hp-1));
  X.dmg=dmg;if(mine)B.dmg=dmg;   // 회피·무적 무시: 판정 없이 무조건 맞아요
  def.hp=Math.max(0,def.hp-dmg);try{bbox()}catch(e){}
  if(mine){if(F.hold!=null)F.hold=def.hp}else{if(B.hold!=null)B.hold=def.hp}   // 맞은 만큼은 무적 보호(HP 고정)에서 빼 줘요
  const x=foe.ax,y=foe.ay-S*.6,st=(()=>{try{return stopsOf(o.type)}catch(e){return['#1c2550','#f08030','#f08030','#ffe0a0','#ffffff']}})();
  try{FX2.flash('#ffffff',.9*vk);FX2.hit(22*vk,.16*vk)}catch(e){}
  try{shardBurst(x,y,Math.round(46*vk),st[2],S*7*vk,1,st);hitSpark(x,y,o.type,S*2*vk,1);SH.lt.push({x,y,r:S*4.5*vk,c:st[3],t:0,life:.9});for(let i=0;i<3;i++)pAdd({x,y,s:S*.3,s1:S*(2.4+i*1.1)*vk,life:.45+i*.12,st:['#ffffff',st[3],st[2],st[1],st[0]],k:'ring',glow:1})}catch(e){}
  try{sfx('hit');snd('hit_heavy',.9*vk);if(r.e>=2&&!chip)snd('super_eff',.6)}catch(e){}
  if(dmg>0){foe.dlt={v:dmg,t:1.6};try{FX2.num(foe.ax,foe.ay-S*1.5,String(dmg),r.e>=2?'#ffb030':'#ffffff',1,dskin())}catch(e){}}
  else{try{FX2.num(foe.ax,foe.ay-S*1.5,K<=0?'막혔다!':'효과 없음','#9be7ff',1)}catch(e){}}
  foe.st='hurt';foe.t=0;foe.blink=.5;foe.shake=.7;
  try{if(r.e>=2&&!chip)superPop()}catch(e){}
  if(!chip){try{applyFx(o,me,foe)}catch(e){console.warn('gmax fx',e)}}}
function applyHit(){applyHitX(XS.me,1)}   // (예전 이름 — 디버그용)

// ---------- 정면충돌 (양쪽이 같이 발사) ----------
// 두 쪽이 다 FIRE 에 들어가면 시작해요. 빔이 한가운데서 맞부딪혀 게이지가 밀리고, 공격력(예상 피해)이 큰 쪽이 밀어붙여요.
function duelStart(){
  const A=XS.me,Z=XS.foe,ra=dmgOfOpt(A.sel,A.a.m,A.d.m),rz=dmgOfOpt(Z.sel,Z.a.m,Z.d.m);
  const sa=ra.e===0?0:ra.d*((A.sel.acc||100)/100),sb=rz.e===0?0:rz.d*((Z.sel.acc||100)/100);
  const r=GM.clashShare(sa,sb);
  A.M.fireLen=Z.M.fireLen=C('T_FIRE')+C('CLASH_T')+C('CLASH_PUSH');
  // win 은 충돌이 끝나는 순간 정해요 (연타로 늘린 몫 mash 가 들어가야 해서). rnd 는 미리 뽑아 둬요.
  B.duel={on:1,r,win:null,rnd:R(),mash:0,mashD:0,taps:0,tapT:0,manual:!(typeof actAuto==='function'&&actAuto()),sa,sb,ia:C('IMPACT_AT'),done:0,sfx:0}}
const rEff=(D,disp)=>Math.max(.03,Math.min(.97,D.r+(disp?D.mashD:D.mash)));   // 연타를 더한 내 몫 (disp=화면에 보이는 부드러운 값)
// 충돌 중 연타: 화면을 치거나 아무 키나 누르면 내 몫이 조금씩 늘어요 (손으로 직접 할 때만, 자동 배틀은 없음)
function duelTap(){
  const D=B.duel;if(!D||!D.on||!D.manual||D.win!=null||!B.mach)return false;
  const t=B.mach.t;if(t<D.ia-.25||t>=D.ia+C('CLASH_T'))return false;
  D.mash=Math.min(C('CLASH_TAP_MAX'),D.mash+C('CLASH_TAP'));D.taps++;D.tapT=performance.now();
  try{FX2.hit(3,0)}catch(e){}try{if(D.taps%3===1)sfx('tap')}catch(e){}return true}
function duelG(t){   // 게이지 위치 (0=내 입, 1=상대 입)
  const D=B.duel,ia=D.ia,t1=ia+C('CLASH_T'),t2=t1+C('CLASH_PUSH');
  if(t<ia)return .5;
  const re=rEff(D,1);
  if(t<t1||D.win==null)return GM.clashGauge(re,Math.min(1,(t-ia)/C('CLASH_T')),t<t1?.035*Math.sin(t*19)+.02*Math.sin(t*7.3):0);
  const g1=GM.clashGauge(re,1,0),g2=D.win==='me'?1:0,u=ease.cl(t,t1,t2);return g1+(g2-g1)*ease.out(u)}
function duelStep(){
  const D=B.duel;if(!D||!D.on||D.done)return;const t=B.mach.t,ia=D.ia,t2=ia+C('CLASH_T')+C('CLASH_PUSH');
  D.mashD+=(D.mash-D.mashD)*Math.min(1,dt60()*12);
  if(D.win==null&&t>=ia+C('CLASH_T'))D.win=GM.clashWinner(rEff(D,0),D.rnd);   // 충돌 끝 → 승부 결정
  if(t>=ia&&!D.sfx){D.sfx=1;try{FX2.flash('#ffffff',.6);FX2.hit(14,.1);snd('hit_heavy',.9)}catch(e){}}
  if(D.sfx&&t<t2&&Math.random()<dt60()*3){try{FX2.hit(4,0)}catch(e){}}
  if(t>=t2){D.done=1;resolveDuel()}}
let _dt=1/60;const dt60=()=>_dt;
function resolveDuel(){
  const D=B.duel,w=XS[D.win],l=other(w);
  applyHitX(w,1);applyHitX(l,C('CLASH_LOSER_K'),true,true);
  fxTxt(w.a,'정면충돌 승리!','#ffd23f');fxTxt(l.a,'밀렸다!','#9bd0ff')}


// ---------- 전용기 부가효과 (레조넌스 효과를 이 게임의 실시간 배틀에 맞게 옮김) ----------
// 이 게임 실시간 배틀에는 상태이상 시스템이 없어서, 거다이 효과만 여기서 시간으로 따로 관리해요.
//  상대에게: dots(지속 피해) · stun(완전히 멈춤) · root(제자리) · slow(둔화) · conf(혼란) · torment(기술 대기 느려짐) · drowsy(곧 잠듦) · cud(헤롱헤롱)
//  나에게: 회복 · 공격 UP(buffUntil) · 방어(guardUntil) · 약화 해제 · 대기시간 초기화  (게임이 이미 쓰는 buffUntil/guardUntil/debuffUntil 을 그대로 써요)
const FXC={SLOW_MIN:.2};   // 둔화가 아무리 겹쳐도 이보다 느려지진 않아요
const newSt=f=>({f,on:0,dots:[],stun:0,root:0,slow:0,slowK:1,conf:0,torment:0,drowsy:0,sleepFor:0,cud:0,cudT:0});
// 효과를 받는 쪽(v)마다 상태를 따로 둬요: 상대(AI) → B.st, 나 → B.stMe  (상대 AI 가 거다이를 쏘면 내가 받아요)
function fxState(v){if(v===BS.me){if(!B.stMe||B.stMe.f!==v)B.stMe=newSt(v);return B.stMe}if(!B.st||B.st.f!==v)B.st=newSt(v);return B.st}
function fxTxt(who,t,c){try{FX2.num(who.ax,who.ay-bsz()*1.9,t,c||'#ffffff',1)}catch(e){}}
function foeTypes(f){try{return META[f.m.n].types||[]}catch(e){return[]}}
function addSlow(s,sec,k){const cur=s.slow>0?s.slowK:1;s.slowK=Math.max(FXC.SLOW_MIN,Math.min(cur,k));s.slow=Math.max(s.slow,sec)}
function addDot(s,o,sec,frac,col){let st=null;try{st=stopsOf(o.type)}catch(e){}s.dots.push({left:sec,acc:0,frac,col:col||(TCOL[o.type]||'#ffffff'),st})}
function faintCheck(foe){
  if(foe&&foe.m&&foe.m.hp<=0&&ACT.on&&!B.faintT){B.faintT=1;try{banner('기절!','#ff5a5a')}catch(e){}
    setTimeout(()=>{B.faintT=0;if(ACT.on&&BS.foe&&BS.foe.m.hp<=0)actEnd({t:'rt'})},700)}}
function applyFx(o,me,foe){
  const fx=o&&o.fx;if(!fx||!fx.k||!foe||!me)return;
  const s=fxState(foe),now=performance.now();
  switch(fx.k){
    case 'dot':
      if(fx.spare&&foeTypes(foe).includes(fx.spare)){fxTxt(foe,'효과 없음','#9be7ff');break}
      addDot(s,o,fx.sec,fx.frac);fxTxt(foe,fx.label||'지속 피해!','#ffb060');break;
    case 'poison':addDot(s,o,fx.sec,fx.frac,'#c070ff');fxTxt(foe,'독!','#c070ff');break;
    case 'bind':addDot(s,o,fx.sec,fx.frac);addSlow(s,fx.sec,.4);fxTxt(foe,fx.label||'갇혔다!','#ffb060');break;
    case 'par':s.stun=Math.max(s.stun,.8);addSlow(s,8,.5);fxTxt(foe,'마비!','#ffe040');break;
    case 'conf':s.conf=Math.max(s.conf,fx.sec);foe.debuffUntil=now+fx.sec*1000;fxTxt(foe,'혼란!','#ff9bd8');break;
    case 'cuddle':s.cud=fx.sec;s.cudT=fx.pulse;s.cudP=fx.pulse;s.cudC=fx.chance;s.cudS=fx.stagger;fxTxt(foe,'헤롱헤롱!','#ff7ab0');break;
    case 'befuddle':{const r=R();
      if(r<1/3){addDot(s,o,10,1/16,'#c070ff');fxTxt(foe,'독!','#c070ff')}
      else if(r<2/3){s.stun=Math.max(s.stun,.8);addSlow(s,8,.5);fxTxt(foe,'마비!','#ffe040')}
      else{s.stun=Math.max(s.stun,3.5);fxTxt(foe,'잠듦!','#9bb8ff')}break}
    case 'snooze':s.drowsy=fx.wait;s.sleepFor=fx.sleep;fxTxt(foe,'졸음…','#9bb8ff');break;
    case 'terror':s.root=Math.max(s.root,fx.sec);fxTxt(foe,'붙잡혔다!','#b080ff');break;
    case 'torment':s.torment=Math.max(s.torment,fx.sec);fxTxt(foe,'트집!','#c0c0d8');break;
    case 'cdAdd':try{if(foe===BS.me){for(const k in ACT.cd)ACT.cd[k]+=fx.sec;ACT.dcd+=fx.sec}else ACT.ai.cd+=fx.sec}catch(e){}fxTxt(foe,'기술 지연!','#c0c0d8');break;
    case 'slow':addSlow(s,fx.sec,fx.k2);fxTxt(foe,fx.label||'느려졌다!','#9bd0ff');break;
    case 'debuff':foe.debuffUntil=now+fx.sec*1000;fxTxt(foe,'상대 약화!','#c79bff');break;
    case 'heal':{const mx=stOf(me.m)[0];me.m.hp=Math.min(mx,me.m.hp+Math.ceil(mx*fx.frac));try{bbox()}catch(e){}fxTxt(me,'회복!','#7dff9b');break}
    case 'cure':me.debuffUntil=0;fxTxt(me,'약화 해제!','#7dff9b');break;
    case 'buff':me.buffUntil=now+(fx.sec||12)*1000;fxTxt(me,fx.label||'공격 UP!','#ffd060');break;
    case 'guard':me.guardUntil=now+(fx.sec||8)*1000;fxTxt(me,fx.label||'방어!','#9bd0ff');break;
    case 'replenish':if(R()<(fx.chance==null?.5:fx.chance)){try{if(me===BS.me){for(const k in ACT.cd)ACT.cd[k]=0;ACT.dcd=0}else ACT.ai.cd=0}catch(e){}fxTxt(me,'기술 재충전!','#ffd060')}else fxTxt(me,'…','#cccccc');break;
    case 'defog':foe.guardUntil=0;me.debuffUntil=0;fxTxt(foe,'방어 해제!','#9bd0ff');break;
  }
  s.on=1}
// 월드가 돌아가는 동안(연출 중이 아닐 때) 매 프레임 진행: 지속 피해 · 멈춤 · 둔화 · 혼란  (상대 AI 도, 나도 같은 규칙으로 받아요)
function victimTick(v,s,fr,S,px,py){
  for(let i=s.dots.length-1;i>=0;i--){const d=s.dots[i];d.left-=fr;d.acc+=fr;
    while(d.acc>=1&&v.m.hp>0){d.acc-=1;const mx=stOf(v.m)[0],dm=Math.max(1,Math.floor(mx*d.frac));v.m.hp=Math.max(0,v.m.hp-dm);try{bbox()}catch(e){}
      try{FX2.num(v.ax,v.ay-S*1.5,String(dm),d.col,1,dskin())}catch(e){}
      try{const st=d.st||['#202020',d.col,d.col,d.col,'#ffffff'];pAdd({x:v.ax,y:v.ay-S*.5,s:S*.2,s1:S*1.3,life:.4,st:['#ffffff',st[3],st[2],st[1],st[0]],k:'ring',glow:1})}catch(e){}}
    if(d.left<=0)s.dots.splice(i,1)}
  const stunned=s.stun>0,rooted=s.root>0;
  if(stunned||rooted){v.ax=px;v.ay=py;v.vx=v.vy=0;if(stunned)v.shake=Math.max(v.shake||0,.12)}
  else if(s.slow>0){v.ax=px+(v.ax-px)*s.slowK;v.ay=py+(v.ay-py)*s.slowK;v.vx*=s.slowK;v.vy*=s.slowK}
  if(s.conf>0&&!stunned){v.ax+=(R()-.5)*S*.14*fr*60;v.ay+=(R()-.5)*S*.09*fr*60}}
function victimFlow(s,v,fr){
  s.stun=Math.max(0,s.stun-fr);s.root=Math.max(0,s.root-fr);s.conf=Math.max(0,s.conf-fr);s.torment=Math.max(0,s.torment-fr);
  if(s.slow>0){s.slow-=fr;if(s.slow<=0){s.slow=0;s.slowK=1}}
  if(s.drowsy>0){s.drowsy-=fr;if(s.drowsy<=0){s.drowsy=0;s.stun=Math.max(s.stun,s.sleepFor||2.5);fxTxt(v,'zzz…','#9bb8ff')}}
  if(s.cud>0){s.cud-=fr;s.cudT-=fr;if(s.cudT<=0){s.cudT=s.cudP||1.5;if(R()<(s.cudC==null?.5:s.cudC)){s.stun=Math.max(s.stun,s.cudS||.6);fxTxt(v,'헤롱헤롱…','#ff7ab0')}}}
  s.on=(s.dots.length||s.stun>0||s.root>0||s.slow>0||s.conf>0||s.torment>0||s.drowsy>0||s.cud>0)?1:0}
function fxRun(dt,run){
  const f=BS.foe,me=BS.me,ai=ACT.ai,fr=(FX2.stop>0?0:dt);
  if(B.st&&B.st.f!==f)B.st=null;if(B.stMe&&B.stMe.f!==me)B.stMe=null;
  const sF=B.st,sM=B.stMe;
  if(!fr||(!sF&&!sM))return run();
  const S=bsz(),px=f.ax,py=f.ay,cd=ai?ai.cd:0,tel=ai?ai.tel:0,qx=me.ax,qy=me.ay,cds=Object.assign({},ACT.cd),dcd=ACT.dcd;
  const r=run();
  if(sF&&f.m.hp>0){
    victimTick(f,sF,fr,S,px,py);
    if(sF.stun>0&&ai){if(ai.cd<cd)ai.cd=cd;if(tel>0&&ai.tel<tel)ai.tel=tel}   // 멈춰 있는 동안엔 기술도 못 써요
    if(sF.torment>0&&ai&&ai.cd<cd)ai.cd=cd-(cd-ai.cd)*.5               // 트집: 기술 대기가 절반 속도로만 줄어요
    victimFlow(sF,f,fr);if(f.m.hp<=0)faintCheck(f)}
  if(sM&&me.m.hp>0){
    victimTick(me,sM,fr,S,qx,qy);
    if(sM.stun>0){ACT.buf=null;for(const k in cds)if(ACT.cd[k]<cds[k])ACT.cd[k]=cds[k];if(ACT.dcd<dcd)ACT.dcd=dcd}   // 멈춰 있는 동안엔 내 기술 대기도 안 줄어요
    if(sM.torment>0)for(const k in cds)if(ACT.cd[k]<cds[k])ACT.cd[k]=cds[k]-(cds[k]-ACT.cd[k])*.5
    victimFlow(sM,me,fr);if(me.m.hp<=0)koCheck()}
  return r}

// ---------- 게임 함수 감싸기 ----------
{const _au=actUpdate;actUpdate=function(dt){
  if(ACT.on&&B.mach){
    if(B.hold!=null&&BS.me&&BS.me.m&&BS.me.m.hp<B.hold){BS.me.m.hp=B.hold;try{bbox()}catch(e){}}   // 무적: 남아 있던 상대 공격이 와도 HP 유지
    if(F.hold!=null&&BS.foe&&BS.foe.m&&BS.foe.m.hp<F.hold){BS.foe.m.hp=F.hold;try{bbox()}catch(e){}}   // 상대가 거다이맥스한 동안·직후도 마찬가지
    if(B.mach.invincible()&&BS.me){BS.me.kx=BS.me.ky=0}
    if(F.mach&&F.mach.invincible()&&BS.foe){BS.foe.kx=BS.foe.ky=0}
    if(active()){try{arenaHud()}catch(e){}return}}   // 월드 정지 (연출 중)
  if(ACT.on&&B.mach&&((B.st&&B.st.on)||(B.stMe&&B.stMe.on))&&inBattle())return fxRun(dt,()=>_au.apply(this,arguments));   // 걸려 있는 부가효과가 있으면 같이 진행
  return _au.apply(this,arguments)}}
for(const nme of ['actPress','actRoll']){const f=window[nme];if(typeof f==='function')window[nme]=function(){if(active()||(B.stMe&&B.stMe.stun>0&&B.stMe.f===BS.me))return;return f.apply(this,arguments)}}
if(typeof actSwitch==='function'){const _sw=actSwitch;actSwitch=function(){if(active())return;return _sw.apply(this,arguments)}}
if(typeof rzStatus==='function'){const _rs=rzStatus;rzStatus=function(mine,m,AB,DB){try{if(!mine&&B.mach&&B.mach.invincible()&&DB===BS.me)return;if(mine&&F.mach&&F.mach.invincible()&&DB===BS.foe)return}catch(e){}return _rs.apply(this,arguments)}}   // 상태이상도 무시
{const _b=battle;battle=async function(){B.mach=null;B.usesBy=new Map();B.curMon=null;initMach();B.hold=null;B.fk=null;B.want=0;B.tDone=null;closePick();document.body.classList.remove('gmxcine');return _b.apply(this,arguments)}}
{const _ae=actEnd;actEnd=function(){if(active())abort();return _ae.apply(this,arguments)}}

function initMach(){
  const M=GM.machine({canForm:false});B.mach=M;B.st=null;B.stMe=null;B.duel=null;B.joinPlan=null;
  M.on('state',(s,p)=>onState(XS.me,s,p));M.on('pickOpen',onPickOpen);M.on('autoPick',()=>onAutoPick(XS.me));
  const N=GM.machine({canForm:false,auto:true});F.mach=N;   // 상대(AI) — 늘 자동으로 기술을 골라요
  Object.assign(F,{fk:null,opts:[],pick:-1,sel:null,hitDone:0,sfxI:0,cs:null,usesBy:new Map(),curMon:null,thinkT:0,tDone:null,hold:null,holdT:0,waitPick:0});
  N.on('state',(s,p)=>onState(XS.foe,s,p));N.on('autoPick',()=>onAutoPick(XS.foe));return M}
initMach();

// ---------- 매 프레임 ----------
{const _d=drawBattle;drawBattle=function(dt){_d.apply(this,arguments);try{frame(dt)}catch(e){if(!B.err){B.err=1;console.warn('gmax-battle',e)}}}}
function frame(dt){
  dt=Math.min(.05,dt||0);const M=B.mach,N=F.mach;if(!M||!N)return;_dt=dt;
  if(!inBattle()){if(active())abort();ui(0);joinUI();return}
  syncUses();syncUsesF();refreshForm();refreshFormF();padPoll();
  // 기술 쓰는 중에 눌렀으면 끝나자마자
  if(B.want){B.wantT-=dt;if(canStartNow()){tryStart()}else if(B.wantT<=0)B.want=0}
  autoTrigger();foeThink(dt);joinStep();
  if(!B.duel&&M.st===ST.FIRE&&N.st===ST.FIRE)duelStart();   // 둘 다 발사 → 정면충돌
  M.tick(dt);N.tick(dt);duelStep();
  if(B.holdT>0&&!M.invincible()){B.holdT-=dt;if(B.holdT<=0)B.hold=null}
  else if(M.st===ST.NORMAL&&M.inv<=0&&B.holdT<=0)B.hold=null;
  if(F.holdT>0&&!N.invincible()){F.holdT-=dt;if(F.holdT<=0)F.hold=null}
  else if(N.st===ST.NORMAL&&N.inv<=0&&F.holdT<=0)F.hold=null;
  if(active()||fadeOut>0)cine(dt);
  ui(0);joinUI()}

// ---------- 상대(AI)의 거다이맥스: 언제 변신하나 · 같이 변신(합류) ----------
function refreshFormF(){
  const N=F.mach;if(!N||!inBattle())return;
  const fk=formKeyOf(BS.foe.m);F.fk=fk;if(fk)loadAssets(fk);
  N.canForm=!!fk&&ready(fk)&&!!(BS.trainer||BS.wb||C('AI_WILD'));N.alive=BS.foe.m.hp>0}   // 트레이너·보스·월드보스는 늘, 야생은 AI_WILD=1 일 때만 (횟수·확률은 따로)
const foeIsWild=()=>!(BS.trainer||BS.wb);
const foeUses=()=>foeIsWild()?Math.min(CFG.USES_PER_SIDE,C('WILD_USES')):CFG.USES_PER_SIDE;
function syncUsesF(){   // 상대도 포켓몬 한 마리당 2번
  try{const N=F.mach,m=BS.foe&&BS.foe.m;if(!N||!m)return;
    if(F.curMon!==m){if(F.curMon)F.usesBy.set(F.curMon,N.uses);F.curMon=m;N.uses=F.usesBy.has(m)?F.usesBy.get(m):foeUses();F.tDone=null}
    else F.usesBy.set(m,N.uses)}catch(e){}}
function foeBusy(){try{return !!(ACT.busy||ACT.fbusy||(ACT.ai&&ACT.ai.tel>0)||ACT.roll>0||ACT.down||ACT.pause)}catch(e){return true}}
function foeThink(dt){
  const N=F.mach;if(!N||!N.canForm||active()||!N.can())return;
  F.thinkT-=dt;if(F.thinkT>0)return;F.thinkT=C('AI_THINK');
  if(foeBusy()||BS.foe.m.hp<=0||BS.me.m.hp<=0)return;
  if(B.st&&B.st.f===BS.foe&&(B.st.stun>0||B.st.root>0))return;   // 멈춰 있을 땐 안 해요
  const fx=stOf(BS.foe.m)[0],mx=stOf(BS.me.m)[0];
  const ok=GM.aiWantsGmax({usesLeft:N.uses+(CFG.USES_PER_SIDE-foeUses()),selfHp:BS.foe.m.hp/fx,otherHp:BS.me.m.hp/mx,t:ACT.t,since:F.tDone==null?99:ACT.t-F.tDone,rnd:Math.random()/(foeIsWild()?Math.max(.05,C('AI_WILD_K')):1)});   // 야생은 확률이 AI_WILD_K 배
  if(ok){preloadSfx();N.auto=true;N.start()}}
// 한쪽이 변신을 시작하면, 다른 쪽(상대 AI / 자동 배틀의 나)이 같이 변신할지 정해요. 사람이 직접 하는 쪽은 "같이 거다이맥스!" 버튼으로.
function joinStep(){
  const M=B.mach,N=F.mach;
  const lead=M.st===ST.TRANSFORM&&N.st===ST.NORMAL?XS.me:N.st===ST.TRANSFORM&&M.st===ST.NORMAL?XS.foe:null;
  if(!lead){B.joinPlan=null;B.joinKey=null;return}
  const Y=other(lead);
  if(B.joinKey!==lead.cs){   // 이 변신에 대해 한 번만 정해요
    B.joinKey=lead.cs;B.joinPlan=null;
    if(Y.M.can()&&(Y.side==='foe'||(typeof actAuto==='function'&&actAuto()))){
      const hp=Y.a.m.hp/stOf(Y.a.m)[0];
      if(GM.aiWantsJoin({usesLeft:Y.M.uses,selfHp:hp,rnd:Math.random()}))B.joinPlan={Y,lead,at:.1+Math.random()*.6}}}
  const jp=B.joinPlan;
  if(jp&&lead.M.t>=jp.at){B.joinPlan=null;if(Y.M.can()&&lead.M.t<CFG.T_TRANSFORM-.05){Y.M.auto=(Y.side==='foe')||!!(typeof actAuto==='function'&&actAuto());preloadSfx();Y.M.startAt(lead.M.t)}}}
function joinUI(){
  let el=document.getElementById('gmxJoin');const show=joinable()&&!(typeof actAuto==='function'&&actAuto());
  if(!show){if(el&&el.style.display!=='none')el.style.display='none';return}
  css();
  if(!el){el=document.createElement('button');el.id='gmxJoin';el.innerHTML='⚡ 같이 거다이맥스! <small>F</small>';
    el.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();try{sfx('tap')}catch(e){}tryJoin()});document.body.appendChild(el)}
  if(el.style.display!=='block')el.style.display='block'}
let fadeOut=0;


// ---------- 포켓몬마다 변신 횟수 따로 (한 배틀에서 포켓몬 한 마리당 2번) ----------
// 교대하면 나온 포켓몬의 남은 횟수로 바뀌고, 들어간 포켓몬의 횟수는 기억해 둬요.
function syncUses(){
  try{const M=B.mach,m=BS.me&&BS.me.m;if(!M||!m)return;
    if(!B.usesBy)B.usesBy=new Map();
    if(B.curMon!==m){
      if(B.curMon)B.usesBy.set(B.curMon,M.uses);
      B.curMon=m;M.uses=B.usesBy.has(m)?B.usesBy.get(m):CFG.USES_PER_SIDE}
    else B.usesBy.set(m,M.uses)}catch(e){}}

// 자동 배틀이면 알아서 변신 (트레이너·보스·월드보스 때, 시작하고 몇 초 뒤)
function autoTrigger(){
  try{const M=B.mach;if(!(typeof actAuto==='function'&&actAuto())||active()||M.uses<=0||!M.canForm||ACT.down)return;
    if(C('AUTO_TRAINER_ONLY')&&!(BS.trainer||BS.wb))return;
    const mx=stOf(BS.foe.m)[0];if(ACT.t<C('AUTO_MIN_T')||BS.foe.m.hp/mx<.3||ACT.t-(B.tDone==null?-99:B.tDone)<C('AUTO_GAP'))return;
    if(canStartNow())tryStart()}catch(e){}}

// ---------- 키 · 패드 ----------
addEventListener('keydown',e=>{
  if(!inBattle())return;const k=e.key.toLowerCase();
  if(active()){
    if(B.duel&&B.duel.on&&B.duel.manual&&!e.repeat&&k!=='f5'&&k!=='f12')duelTap();   // 충돌 중엔 아무 키나 연타
    if(k==='f'&&!e.repeat&&B.mach.st===ST.NORMAL&&joinable()){e.preventDefault();e.stopImmediatePropagation();tryJoin();return}
    if(B.mach.st===ST.PICK){const i='qwer'.indexOf(k),j='1234'.indexOf(k);const n=i>=0?i:j;if(n>=0){e.preventDefault();e.stopImmediatePropagation();pickIdx(n);return}}
    if(k!=='f5'&&k!=='f12'){e.stopImmediatePropagation()}return}
  if(k==='f'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||'')){e.preventDefault();tryStart()}},true);
addEventListener('pointerdown',()=>{if(B.duel&&B.duel.on&&B.duel.manual)duelTap()},true);   // 충돌 중엔 화면 아무 데나 연타
function padPoll(){try{const gp=(navigator.getGamepads&&navigator.getGamepads())||[];let on=0;for(const g of gp){if(g&&g.buttons&&g.buttons[11]&&g.buttons[11].pressed)on=1}if(on&&!B.pad)tryStart();B.pad=on}catch(e){}}

// ---------- 화면 UI (버튼 · 기술 고르기) ----------
function css(){if(B.css)return;B.css=1;const s=document.createElement('style');s.textContent=`
body.gmxcine #actUI #aStickZ,body.gmxcine #actUI #aStick,body.gmxcine #actUI #aSk,body.gmxcine #actUI #aRoll,body.gmxcine #actUI #aTop,body.gmxcine #actUI #aParty,body.gmxcine #teraBtn,body.gmxcine #dxBtn,body.gmxcine #bAutoB,body.gmxcine #gmxBtn{visibility:hidden!important;pointer-events:none!important}
#gmxBtn{position:fixed;left:10px;top:calc(44% + 132px + env(safe-area-inset-top));z-index:46;display:none;flex-direction:column;align-items:center;gap:1px;min-width:78px;padding:6px 8px;border:3px solid #2c3050;border-radius:12px;background:linear-gradient(#e0405a,#9a1f5a);color:#fff;text-shadow:0 1px 2px #000a;font-weight:900;font-size:13px;line-height:1.15;box-shadow:0 3px 0 #2c3050}
#gmxBtn.off{background:#6b6f86;color:#d8dbe8;box-shadow:0 3px 0 #2c3050}
#gmxBtn small{font-weight:700;font-size:11px}
#gmxJoin{position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);z-index:62;display:none;padding:14px 22px;border:4px solid #2c3050;border-radius:16px;background:linear-gradient(#ffd23f,#ff8a2a);color:#2c3050;font:900 22px system-ui,sans-serif;box-shadow:0 5px 0 #2c3050,0 0 24px #ffd23f;animation:gmxJ .35s ease-in-out infinite alternate;pointer-events:auto;touch-action:manipulation}
#gmxJoin small{font-size:13px;opacity:.75;margin-left:4px}
@keyframes gmxJ{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-50%) scale(1.08)}}
#gmxPick{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));z-index:60;display:grid;grid-template-columns:1fr 1fr;gap:6px;width:min(94vw,680px);font-family:system-ui,sans-serif}
#gmxPick .gh{grid-column:1/3;display:flex;align-items:center;gap:8px;color:#fff;font-weight:900;font-size:15px;text-shadow:0 2px 0 #2c3050,0 0 8px #000}
#gmxPick .gh .gt{flex:1;height:10px;border-radius:6px;background:#0008;overflow:hidden;border:2px solid #fff8}
#gmxPick .gh .gt i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ffd23f,#ff5a5a);transition:none}
#gmxPick .gh b{min-width:2.2em;text-align:right;font-size:20px}
#gmxPick button{all:unset;box-sizing:border-box;display:grid;grid-template-columns:28px 1fr auto;grid-template-rows:auto auto;column-gap:8px;align-items:center;padding:7px 10px;border-radius:12px;border:3px solid #2c3050;background:var(--c,#888);color:#fff;text-shadow:0 1px 2px #000a;cursor:pointer;pointer-events:auto;touch-action:manipulation;box-shadow:0 3px 0 #2c3050}
#gmxPick button .k{grid-row:1/3;width:26px;height:26px;border-radius:8px;background:#fffd;color:#2c3050;text-shadow:none;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center}
#gmxPick button b{font-size:16px;font-weight:900;line-height:1.1}
#gmxPick button em{font-style:normal;font-size:11px;font-weight:900;background:#ffe14a;color:#2c3050;border-radius:6px;padding:0 5px;text-shadow:none;grid-row:1;grid-column:3}
#gmxPick button small{grid-column:2/4;font-size:11px;font-weight:700;opacity:.95}
#gmxPick button.gm b::before{content:'★ '}
#gmxPick button.no{background:#4a4d62;opacity:.55;cursor:default;box-shadow:none}
#gmxPick button:active:not(.no){transform:translateY(2px);box-shadow:0 1px 0 #2c3050}
@media (max-height:430px){#gmxPick{gap:4px}#gmxPick button{padding:3px 8px}#gmxPick button b{font-size:14px}#gmxPick .gh{font-size:13px}#gmxPick .gh b{font-size:16px}}
`;document.head.appendChild(s)}
function ui(force){
  css();const M=B.mach;let b=document.getElementById('gmxBtn');
  const show=inBattle()&&!ACT.down&&M&&B.fk&&ready(B.fk)&&(M.canForm)&&!active();
  if(!b){if(!show)return;b=document.createElement('button');b.id='gmxBtn';b.onclick=()=>{try{sfx('tap')}catch(e){}tryStart()};document.body.appendChild(b)}
  if(!show){if(b.style.display!=='none')b.style.display='none';return}
  const left=M.uses,k=left+'/'+(CFG.USES_PER_SIDE);const key=k+(left>0?'':'x');
  if(b.style.display!=='flex')b.style.display='flex';
  if(b.dataset.k!==key||force){b.dataset.k=key;b.classList.toggle('off',left<=0);
    b.innerHTML=left>0?'<span>🌩 거다이맥스</span><small>이 포켓몬 '+left+'/'+CFG.USES_PER_SIDE+' · F</small>':'<span>🌩 거다이맥스</span><small>더 이상 변신할 수 없어요</small>'}}
function openPick(){
  closePick();css();const el=document.createElement('div');el.id='gmxPick';
  const foe=BS.foe.m,ft=META[foe.n].types;
  el.innerHTML='<div class="gh"><span>기술을 골라!</span><div class="gt"><i></i></div><b>3</b></div>'+B.opts.map((o,i)=>{
    if(!o)return '';const e=o.ok?eff(o.type,ft):1;const ef=!o.ok?'':e>=2?'<em>효과 굉장</em>':e===0?'<em style="background:#9be7ff">효과 없음</em>':e<1?'<em style="background:#ddd">효과 별로</em>':'';
    return `<button data-i="${i}" class="${o.ok?'':'no'}${o.gmax?' gm':''}" style="--c:${TCOL[o.type]||'#888'}"><span class="k">${'QWER'[i]||i+1}</span><b>${o.name}</b>${ef}<small>${o.ok?'위력 '+o.pw+' · '+(TN[o.type]||'')+' · 원래 '+(o.from||'')+(o.fxd?' · ✦ '+o.fxd:''):(o.from||'')+' · 선택 불가 ('+(o.reason||'변화기')+')'}</small></button>`}).join('');
  document.body.appendChild(el);B.pickEl=el;
  el.querySelectorAll('button').forEach(bt=>{bt.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();pickIdx(+bt.dataset.i)})})}
function closePick(){if(B.pickEl){B.pickEl.remove();B.pickEl=null}}
function pickIdx(i){const M=B.mach;if(M.st!==ST.PICK)return;const o=B.opts[i];if(!o||!o.ok){try{sfx('tap')}catch(e){}return}B.pick=i;try{sfx('get')}catch(e){}M.choose(i)}

// ---------- 연출 그리기 ----------
function A_(){return B.assets[B.fk]&&B.assets[B.fk]!=='loading'?B.assets[B.fk]:null}
// 거다이 그림 한 장 그리기 (발 위치 x,y · 몸 높이 size) — 움직이는 세트가 있으면 그걸, 없으면 앞모습 스트립
function assetOf(fk){return fk&&B.assets[fk]&&B.assets[fk]!=='loading'?B.assets[fk]:null}
function drawG(as,kind,t,row,x,y,size,o){
  o=o||{};if(!as)return;cx.save();cx.imageSmoothingEnabled=false;
  if(o.alpha!=null)cx.globalAlpha=o.alpha;if(o.filter)cx.filter=o.filter;
  const an=as.anims&&as.anims[kind]&&as.img[kind]?as.anims[kind]:(as.anims&&as.anims.idle?as.anims.idle:null);
  if(an){const k=as.anims[kind]&&as.img[kind]?kind:'idle',im=as.img[k],A=as.anims[k];
    const f=frameAt(A,t,o.loop!==false),w=A.w,h=A.h;let rr=row;if(im.height<(rr+1)*h)rr=0;
    const an2=(A.a&&A.a[rr])||[w/2,h*.85],s=size/(h*.65);
    cx.translate(x,y);if(o.flipX)cx.scale(-1,1);
    cx.drawImage(im,f*w,rr*h,w,h,-an2[0]*s,-an2[1]*s,w*s,h*s)}
  else if(as.front){const n=as.fn,fw=as.front.width/n,fh=as.front.height,f=Math.floor(t*8)%n,s=size/fh*1.0;
    cx.translate(x,y);if(o.flipX)cx.scale(-1,1);cx.drawImage(as.front,f*fw,0,fw,fh,-fw*s/2,-fh*s*.96,fw*s,fh*s)}
  cx.restore()}
function gSize(){return Math.min(bsz()*C('SCALE'),VH*.5,VW*.5)}
function hasMotion(){const as=A_();return !!(as&&as.anims)}

// 연출 그리기: 변신 중인 쪽마다 한 번씩 (둘 다면 둘 다). 어두운 막은 앞선 쪽이 한 번만 그려요.
function cine(dt){
  const list=['me','foe'].map(k=>XS[k]).filter(X=>X.M.st!==ST.NORMAL);if(!list.length)return;
  const duel=list.length>1;if(duel)spreadStep(dt);
  list.forEach((X,i)=>cineSide(X,dt,i===0,duel));
  if(B.duel&&B.duel.on)clashUI()}
// 둘 다 거다이맥스하면 서로 마주 보는 자리(경기장 양쪽, 같은 높이)로 부드럽게 물러나요
function spreadStep(dt){try{const r=AR(),y=(r.y0+r.y1)/2,a=BS.me,b=BS.foe,k=Math.min(1,dt*5);
  a.ax+=(r.x0+(r.x1-r.x0)*.24-a.ax)*k;b.ax+=(r.x1-(r.x1-r.x0)*.24-b.ax)*k;a.ay+=(y-a.ay)*k;b.ay+=(y-b.ay)*k}catch(e){}}
function cineSide(X,dt,lead,duel){
  const M=X.M,me=X.a,foe=X.d,as=assetOf(X.fk),mine=X.side==='me',oth=other(X);if(!as||!me||!foe)return;
  const st=M.st,t=M.t,S=bsz(),size=gSize(),type=(X.sel&&X.sel.type)||GM.sigOf(X.fk).type;
  const stops=(()=>{try{return stopsOf(type)}catch(e){return['#1c2550','#f08030','#f08030','#ffe0a0','#ffffff']}})();
  const now=performance.now()/1000,gx=me.ax,gy=me.ay;
  // 효과음
  if(st===ST.TRANSFORM){while(X.sfxI<SFX_PLAN.length&&SFX_PLAN[X.sfxI].at<=t){const p=SFX_PLAN[X.sfxI++];if(p.cry)cry(me.m);else play(p.k,p.g)}}
  // 크기: 변신 팝업(0.4초부터) → 유지 → 복귀 때 줄어듦
  let pop=1,vis=1,flashW=0;
  if(st===ST.TRANSFORM){const u=ease.cl(t,.4,1.25);pop=.34+.66*ease.back(u);vis=t<.4?0:1;flashW=t>=.36&&t<.7?1-(t-.36)/.34:0;
    if(t<.4){me.glow='#ffffff';me.hide=0}else{me.hide=1;me.glow=0}}
  else if(st===ST.RETURN){const u=ease.cl(t,0,CFG.T_RETURN*.55);pop=1-.66*ease.out(u);vis=t<CFG.T_RETURN*.5?1:0;me.hide=vis?1:0;flashW=t<.25?1-t/.25:0;
    if(!vis&&me.hide===0){}}
  else{me.hide=1}
  // 어둡게
  let dim=0;
  if(st===ST.TRANSFORM)dim=.62*ease.cl(t,0,.45);else if(st===ST.PICK)dim=.62;
  else if(st===ST.FIRE)dim=t<C('CUT_END')?.78:t<C('BEAM_AT')+.3?.7:.62-.2*ease.cl(t,2.4,C('T_FIRE'));
  else if(st===ST.RETURN)dim=.55*(1-ease.cl(t,0,CFG.T_RETURN));
  if(lead){cx.save();cx.setTransform(DPR,0,0,DPR,0,0);
  const g=cx.createRadialGradient(VW/2,VH*.55,Math.min(VW,VH)*.2,VW/2,VH*.55,Math.max(VW,VH)*.75);g.addColorStop(0,hex2rgba('#0a0618',dim*.7));g.addColorStop(1,hex2rgba(stops[0]||'#0a0618',Math.min(.92,dim*1.25)));
  cx.fillStyle=g;cx.fillRect(0,0,VW,VH);cx.restore()}
  // 월드 좌표 (카메라 적용): 상대 · 구름 · 내 거다이 · 빔
  cx.save();camT();
  // 상대는 어둠 위에 다시 그려서 밝게 (피격 모션 그대로)
  try{if(foe._rd&&oth.M.st===ST.NORMAL)foe._rd()}catch(e){}
  const bob=Math.sin(now*3.2)*size*.012,fy=gy+bob;
  const row=dirRow(foe.ax-me.ax,foe.ay-me.ay);
  // 바닥 그림자
  if(vis){cx.save();cx.globalAlpha=.4*Math.min(1,pop);cx.fillStyle='#000';cx.beginPath();cx.ellipse(gx,gy+2,size*.42*pop,size*.11*pop,0,0,7);cx.fill();cx.restore()}
  // 구름 (뒤)
  const cloudK=st===ST.TRANSFORM?ease.cl(t,.25,.9)*(1-ease.cl(t,1.3,1.5)*.4):st===ST.PICK?.6:st===ST.RETURN?.6*(1-ease.cl(t,0,.4)):st===ST.FIRE?Math.max(0,.6-t*.4):0;
  const wisps=(im,front)=>{if(!im||cloudK<=0)return;cx.save();cx.imageSmoothingEnabled=false;cx.globalAlpha=Math.min(1,cloudK*1.3);
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2+now*(front?1.1:-.8)+(front?0:.7),rr=size*(.36+.1*Math.sin(now*2+i)),sx=Math.cos(a),sy=Math.sin(a);if((sy>0)!==!!front)continue;
      const f=Math.floor((now*10+i*3))%8,ws=size*.0085*(1+.25*Math.sin(i*2.1));cx.save();cx.translate(gx+sx*rr*1.35,gy-size*.1+sy*rr*.28-size*.06*(i%3));cx.scale(sx<0?-ws:ws,ws);cx.drawImage(im,f*96,0,96,48,-48,-30,96,48);cx.restore()}
    cx.restore()};
  wisps(as.cloudB,0);
  // 모으는 빛줄기 (변신 처음 0.4초)
  if(st===ST.TRANSFORM&&t<.5){cx.save();cx.globalCompositeOperation='lighter';const k=1-t/.5;cx.lineCap='round';
    for(let i=0;i<22;i++){const a=i*2.4+X.seed,r0=size*(.25+1.1*k)*(.6+.4*((i*37)%10)/10),r1=r0*.72;cx.strokeStyle=hex2rgba(stops[3],.55*(1-k*.3));cx.lineWidth=Math.max(2,size*.012);cx.beginPath();cx.moveTo(gx+Math.cos(a)*r0,gy-size*.45+Math.sin(a)*r0*.7);cx.lineTo(gx+Math.cos(a)*r1,gy-size*.45+Math.sin(a)*r1*.7);cx.stroke()}cx.restore()}
  // 거다이 몸
  if(vis){
    let kind='idle',tt=now,loop=true,lunge=0;
    if(st===ST.FIRE&&as.anims&&as.anims.attack){const a0=C('BEAM_AT')-(((as.anims.attack.hit||4)>0?(as.anims.attack.d.slice(0,as.anims.attack.hit||4).reduce((a,b)=>a+b,0)/60):.4));if(t>=a0&&t<a0+animLen(as.anims.attack)/60+.05){kind='attack';tt=t-a0;loop=false}}
    if(st===ST.FIRE&&!as.anims){lunge=t>C('BEAM_AT')&&t<C('BEAM_AT')+.35?Math.sin((t-C('BEAM_AT'))/.35*Math.PI)*size*.06:0}
    const ux=Math.sign(foe.ax-me.ax)||1;
    const chargeShake=(st===ST.FIRE&&t>C('CHARGE_AT')&&t<C('BEAM_AT'))?(Math.sin(now*70)*size*.008):0;
    drawG(as,kind,tt,row,gx+lunge*ux+chargeShake,fy,size*pop,{loop,flipX:!as.anims&&ux<0});
  }
  wisps(as.cloudF,1);
  // ----- 발사 -----
  if(st===ST.FIRE)fireFx(X,dt,t,gx,fy,size,type,stops,now);
  cx.restore();
  // ----- 화면 위 글자 · 컷인 -----
  cx.save();cx.setTransform(DPR,0,0,DPR,0,0);
  const tdy=(duel&&!mine)?Math.round(Math.min(VW*.065,46))*1.9:0;   // 둘 다면 상대 글자는 한 줄 아래
  if(st===ST.TRANSFORM)titleBar((mine?'':'상대 ')+nm(me.m)+'은(는) 거다이맥스했다!',ease.cl(t,.15,.4)*(1-ease.cl(t,1.3,1.5)),'#ffd23f',1,tdy);
  if(st===ST.PICK){if(mine){const left=Math.max(0,M.pickLeft);const el=B.pickEl;if(el){const h=el.querySelector('.gh');if(h){h.querySelector('b').textContent=Math.ceil(left);h.querySelector('i').style.width=(left/CFG.PICK_SECONDS*100)+'%'}}}
    titleBar(mine?'거다이맥스!':'상대도 거다이맥스!',.9,'#ffd23f',.55,tdy*.6)}
  if(st===ST.FIRE)fireUI(X,t,type,stops,duel);
  if(flashW>0){cx.fillStyle='rgba(255,255,255,'+Math.min(1,flashW)+')';cx.fillRect(0,0,VW,VH)}
  cx.restore();
  cx.setTransform(1,0,0,1,0,0)}

const topY=fs=>Math.max(VH*.2,100+fs*.95+6);   // 위쪽 체력바(HUD) 아래에 오게
function titleBar(text,a,col,scale,dy){
  if(a<=0)return;const fs=Math.round(Math.min(VW*.065,46)*(scale||1)),y=topY(fs)+(dy||0);cx.save();cx.globalAlpha=a;
  const w=Math.min(VW*.96,VW*.9);cx.fillStyle='rgba(8,6,24,.55)';cx.fillRect(0,y-fs*.95,VW,fs*1.7);
  cx.strokeStyle=col;cx.globalAlpha=a*.8;cx.lineWidth=3;cx.beginPath();cx.moveTo(0,y-fs*.95);cx.lineTo(VW,y-fs*.95);cx.moveTo(0,y+fs*.75);cx.lineTo(VW,y+fs*.75);cx.stroke();cx.globalAlpha=a;
  cx.font='italic 900 '+fs+'px system-ui,sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.lineJoin='round';cx.lineWidth=fs*.16;cx.strokeStyle='#2c3050';cx.strokeText(text,VW/2+(1-a)*40,y);cx.fillStyle=col;cx.fillText(text,VW/2+(1-a)*40,y);cx.restore()}

// 컷인(큰 앞모습) + 기술 이름 배너 (화면 위 · 아래)
function fireUI(X,t,type,stops,duel){
  const me=X.a,as=assetOf(X.fk),o=X.sel,col=TCOL[type]||'#fff',foeSide=X.side==='foe',
    dy=(duel&&foeSide)?Math.round(Math.min(VW*.07,52))*2.1:0,xc=duel?(foeSide?.74:.26):.5,sg=(duel&&foeSide)?-1:1,Hs=duel?.44:.62;
  // 기술 이름 배너 (위에서 내려옴, 빔 쏠 때까지 유지)
  const aIn=ease.out(ease.cl(t,0,.25)),aOut=1-ease.cl(t,C('BEAM_AT')+.4,C('BEAM_AT')+.7);
  if(aIn*aOut>0){const fs=Math.round(Math.min(VW*.07,52)),y=topY(fs)+dy+(1-aIn)*-80;cx.save();cx.globalAlpha=aIn*aOut;
    const tx=(foeSide?'상대 ':'')+nm(me.m)+'의 '+o.name+'!';cx.fillStyle='rgba(8,6,24,.7)';cx.fillRect(0,y-fs*.9,VW,fs*1.8);cx.fillStyle=col;cx.globalAlpha=aIn*aOut*.9;cx.fillRect(0,y+fs*.9,VW,5);cx.fillRect(0,y-fs*.9-5,VW,5);cx.globalAlpha=aIn*aOut;
    cx.font='italic 900 '+fs+'px system-ui,sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.lineJoin='round';cx.lineWidth=fs*.16;cx.strokeStyle='#2c3050';cx.strokeText(tx,VW/2,y);cx.fillStyle='#ffffff';cx.fillText(tx,VW/2,y);cx.restore()}
  // 컷인: 비스듬한 띠 + 큰 앞모습이 옆에서 미끄러져 들어옴
  const ce=C('CUT_END'),u=ease.cl(t,0,.32),uo=ease.cl(t,ce-.25,ce);
  if(t<ce&&as){const k=ease.out(u)*(1-ease.out(uo)),H=VH*Hs,bandY=VH*.5;cx.save();cx.globalAlpha=Math.min(1,k*1.4);
    cx.translate(VW*xc,bandY);cx.rotate(-.13*sg);const bw=VW*(duel?.62:1.5),bh=H*.78,off=((1-ease.out(u))*-VW*.9+ease.out(uo)*VW*.9)*sg;
    const g=cx.createLinearGradient(-bw/2,0,bw/2,0);g.addColorStop(0,hex2rgba(stops[1],0));g.addColorStop(.25,hex2rgba(stops[1],.85));g.addColorStop(.75,hex2rgba(stops[2],.85));g.addColorStop(1,hex2rgba(stops[2],0));
    cx.translate(off*.4,0);cx.fillStyle=g;cx.fillRect(-bw/2,-bh/2,bw,bh);
    cx.fillStyle='rgba(255,255,255,.35)';for(let i=0;i<14;i++){const yy=((i*53+t*900)%(bh))-bh/2;cx.fillRect(-bw/2+((i*131)%bw)*.2,yy,bw*(.2+((i*17)%10)/30),3)}
    cx.restore();
    // 앞모습 (거다이맥스 컷인)
    const src=as.front;if(src){const n=as.fn,fw=src.width/n,fh=src.height,f=Math.floor(t*10)%n,s=H/fh,x=VW*.5+off+(1-ease.out(u))*0;cx.save();cx.globalAlpha=Math.min(1,k*1.4);cx.imageSmoothingEnabled=false;cx.translate(VW*xc+off*.9,bandY+H*.08);cx.rotate(-.05);cx.drawImage(src,f*fw,0,fw,fh,-fw*s/2,-fh*s/2,fw*s,fh*s);cx.restore()}}
}

// 충전 · 빔 · 명중 (월드 좌표)
function fireFx(X,dt,t,gx,gy,size,type,stops,now){
  const me=X.a,foe=X.d,S=bsz(),ux0=foe.ax-me.ax,uy0=(foe.ay-S*.55)-(gy-size*.46),L=Math.hypot(ux0,uy0)||1,ux=ux0/L,uy=uy0/L;
  const mx=gx+Math.sign(foe.ax-me.ax||1)*size*.2,my=gy-size*.46;   // 입(앞쪽) 위치
  const tx=foe.ax,ty=foe.ay-S*.55;
  const ca=C('CHARGE_AT'),ba=C('BEAM_AT'),ia=C('IMPACT_AT');
  // 충전: 입 앞에 빛 덩어리가 커지고 빛이 빨려 들어옴 + 화면 흔들림
  if(t>=ca&&t<ba+.1){const u=ease.cl(t,ca,ba),r=size*(.05+.3*ease.out(u));
    cx.save();cx.globalCompositeOperation='lighter';
    let g=cx.createRadialGradient(mx,my,0,mx,my,r*2.2);g.addColorStop(0,'#ffffff');g.addColorStop(.25,stops[3]);g.addColorStop(.6,hex2rgba(stops[2],.55));g.addColorStop(1,hex2rgba(stops[1],0));cx.fillStyle=g;cx.beginPath();cx.arc(mx,my,r*2.2,0,7);cx.fill();
    cx.lineCap='round';cx.lineWidth=Math.max(2,size*.01);for(let i=0;i<16;i++){const a=i*2.39+now*3,rr=r*(2.2+2.8*((i*37%10)/10))*(1-u*.55),r2=rr*.7;cx.strokeStyle=hex2rgba(stops[3],.5*(1-u*.4));cx.beginPath();cx.moveTo(mx+Math.cos(a)*rr,my+Math.sin(a)*rr*.8);cx.lineTo(mx+Math.cos(a)*r2,my+Math.sin(a)*r2*.8);cx.stroke()}
    cx.restore();
    B.shk-=dt;if(B.shk<=0){B.shk=.1;try{FX2.hit(3+u*7,0)}catch(e){}}
    if(R()<.5)try{pAdd({x:mx+(R()-.5)*size*.9,y:my+(R()-.5)*size*.7,vx:0,vy:-S*.4,s:S*.07,s1:0,life:.45,st:stops,k:'star',r:R()*3,glow:1})}catch(e){}}
  // 빔: 입에서 상대까지 머리가 날아가고(ba~ia), 맞은 뒤에도 잠깐 이어짐
  if(X.duel)duelBeam(X,t,size,stops,now);
  if(t>=ba&&!X.duel){
    const head=ease.cl(t,ba,ia),tail=ease.cl(t,ia+.25,ia+.8),w0=size*(.17+.05*Math.sin(now*40));
    const hx=mx+(tx-mx)*head,hy=my+(ty-my)*head,sx=mx+(tx-mx)*tail,sy=my+(ty-my)*tail,fade=1-ease.cl(t,ia+.45,ia+1.0)*.0;
    const wk=(1-ease.cl(t,ia+.5,ia+1.0));
    if(wk>0&&head>0){cx.save();cx.globalCompositeOperation='lighter';cx.lineCap='round';
      const lw=(k)=>w0*k*wk;
      cx.strokeStyle=hex2rgba(stops[1],.35);cx.lineWidth=lw(2.2);cx.beginPath();cx.moveTo(sx,sy);cx.lineTo(hx,hy);cx.stroke();
      cx.strokeStyle=hex2rgba(stops[2],.75);cx.lineWidth=lw(1.2);cx.beginPath();cx.moveTo(sx,sy);cx.lineTo(hx,hy);cx.stroke();
      cx.strokeStyle=hex2rgba(stops[4]||'#ffffff',.92);cx.lineWidth=lw(.42);cx.beginPath();cx.moveTo(sx,sy);cx.lineTo(hx,hy);cx.stroke();
      // 빔 위를 달리는 고리
      const bl=Math.hypot(hx-sx,hy-sy);for(let i=0;i<9;i++){const p=((i/9)+now*1.8)%1,px=sx+(hx-sx)*p,py=sy+(hy-sy)*p;cx.strokeStyle=hex2rgba(stops[3],.7*wk);cx.lineWidth=Math.max(2,size*.012);cx.beginPath();cx.ellipse(px,py,w0*.45,w0*1.2*wk,Math.atan2(uy,ux),0,7);cx.stroke()}
      // 머리(앞 끝) 덩어리
      let g=cx.createRadialGradient(hx,hy,0,hx,hy,w0*1.9);g.addColorStop(0,'#ffffff');g.addColorStop(.35,stops[3]);g.addColorStop(1,hex2rgba(stops[1],0));cx.fillStyle=g;cx.beginPath();cx.arc(hx,hy,w0*1.9,0,7);cx.fill();
      // 입 쪽 번쩍임
      g=cx.createRadialGradient(sx,sy,0,sx,sy,w0*2.2);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,hex2rgba(stops[2],0));cx.fillStyle=g;cx.beginPath();cx.arc(sx,sy,w0*2.2,0,7);cx.fill();
      cx.restore();
      if(head<1&&R()<.7)try{pAdd({x:hx+(R()-.5)*w0,y:hy+(R()-.5)*w0,vx:-ux*S*2+(R()-.5)*S,vy:-uy*S*2+(R()-.5)*S,s:S*.09,s1:0,life:.35,st:stops,k:'star',r:R()*3,glow:1})}catch(e){}}
    // 명중 순간
    if(t>=ia&&!X.hitDone)applyHitX(X,1);
    // 명중 뒤 불꽃 기둥 (잠깐)
    if(t>=ia&&t<ia+.9){const u=ease.cl(t,ia,ia+.9);cx.save();cx.globalCompositeOperation='lighter';const r=size*.55*(.4+ease.out(u));
      const g=cx.createRadialGradient(tx,ty,0,tx,ty,r);g.addColorStop(0,'rgba(255,255,255,'+(.9*(1-u))+')');g.addColorStop(.4,hex2rgba(stops[3],.6*(1-u)));g.addColorStop(1,hex2rgba(stops[1],0));cx.fillStyle=g;cx.beginPath();cx.arc(tx,ty,r,0,7);cx.fill();cx.restore()}}
}

// ----- 정면충돌: 두 빔이 한가운데서 맞붙어요 -----
const mouthOf=(Y,size)=>{const a=Y.a,d=Y.d,S=bsz();return{x:a.ax+Math.sign(d.ax-a.ax||1)*size*.2,y:a.ay+Math.sin(performance.now()/1000*3.2)*size*.012-size*.46}};
function duelBeam(X,t,size,stops,now){
  const D=B.duel,ba=C('BEAM_AT'),ia=D.ia,t2=ia+C('CLASH_T')+C('CLASH_PUSH');
  const Mm=mouthOf(XS.me,size),Mf=mouthOf(XS.foe,size),g=duelG(t),P={x:Mm.x+(Mf.x-Mm.x)*g,y:Mm.y+(Mf.y-Mm.y)*g};
  const mine=X.side==='me',m0=mine?Mm:Mf,head=ease.cl(t,ba,ia);if(head<=0)return;
  const hx=m0.x+(P.x-m0.x)*head,hy=m0.y+(P.y-m0.y)*head,w0=size*(.17+.05*Math.sin(now*40)),S=bsz();
  const wk=1-ease.cl(t,t2+.1,t2+.75);if(wk<=0)return;
  const ang=Math.atan2(hy-m0.y,hx-m0.x);
  cx.save();cx.globalCompositeOperation='lighter';cx.lineCap='round';
  cx.strokeStyle=hex2rgba(stops[1],.35);cx.lineWidth=w0*2.2*wk;cx.beginPath();cx.moveTo(m0.x,m0.y);cx.lineTo(hx,hy);cx.stroke();
  cx.strokeStyle=hex2rgba(stops[2],.75);cx.lineWidth=w0*1.2*wk;cx.beginPath();cx.moveTo(m0.x,m0.y);cx.lineTo(hx,hy);cx.stroke();
  cx.strokeStyle=hex2rgba(stops[4]||'#ffffff',.92);cx.lineWidth=w0*.42*wk;cx.beginPath();cx.moveTo(m0.x,m0.y);cx.lineTo(hx,hy);cx.stroke();
  for(let i=0;i<9;i++){const p=((i/9)+now*1.8)%1,px=m0.x+(hx-m0.x)*p,py=m0.y+(hy-m0.y)*p;cx.strokeStyle=hex2rgba(stops[3],.7*wk);cx.lineWidth=Math.max(2,size*.012);cx.beginPath();cx.ellipse(px,py,w0*.45,w0*1.2*wk,ang,0,7);cx.stroke()}
  let gr=cx.createRadialGradient(m0.x,m0.y,0,m0.x,m0.y,w0*2.2);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,hex2rgba(stops[2],0));cx.fillStyle=gr;cx.beginPath();cx.arc(m0.x,m0.y,w0*2.2,0,7);cx.fill();
  // 부딪히는 점 (맞붙은 뒤): 두 빔이 만나는 자리에 큰 빛 덩어리 + 퍼지는 고리 + 불꽃 — 그리는 건 내 쪽에서 한 번만
  if(mine&&t>=ia){const u=ease.cl(t,ia,t2),R0=size*(.28+.08*Math.sin(now*30))*(1-ease.cl(t,t2,t2+.3)*.6);
    gr=cx.createRadialGradient(P.x,P.y,0,P.x,P.y,R0*1.8);gr.addColorStop(0,'#ffffff');gr.addColorStop(.3,stops[3]);gr.addColorStop(.65,hex2rgba(stops[2],.5));gr.addColorStop(1,hex2rgba(stops[1],0));cx.fillStyle=gr;cx.beginPath();cx.arc(P.x,P.y,R0*1.8,0,7);cx.fill();
    cx.lineWidth=Math.max(2,size*.012);for(let i=0;i<3;i++){const q=((now*1.6+i/3)%1);cx.strokeStyle='rgba(255,255,255,'+(.7*(1-q))+')';cx.beginPath();cx.ellipse(P.x,P.y,R0*(.6+q*1.4),R0*(.35+q*.8),0,0,7);cx.stroke()}
    cx.restore();cx.save();
    if(Math.random()<.85)try{const a=Math.random()*6.28,v=S*(2+Math.random()*3);pAdd({x:P.x,y:P.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,s:S*.1,s1:0,life:.4,st:stops,k:'star',r:Math.random()*3,glow:1})}catch(e){}}
  cx.restore()}
// 충돌 게이지 (화면 아래): 왼쪽=나 · 오른쪽=상대, 한가운데서 시작해 공격력이 큰 쪽이 밀어요
function clashUI(){
  const D=B.duel,t=B.mach.t;if(!D||!D.on)return;const ia=D.ia,t2=ia+C('CLASH_T')+C('CLASH_PUSH');
  const a=ease.cl(t,ia-.25,ia)*(1-ease.cl(t,t2+.2,t2+.7));if(a<=0)return;
  const g=duelG(t),w=Math.min(VW*.84,560),h=Math.max(16,Math.min(26,VH*.04)),x=(VW-w)/2,y=VH*.8;
  cx.save();cx.setTransform(DPR,0,0,DPR,0,0);cx.globalAlpha=a;
  const fs=Math.round(Math.min(VW*.05,30));cx.font='italic 900 '+fs+'px system-ui,sans-serif';cx.textAlign='center';cx.textBaseline='bottom';cx.lineJoin='round';cx.lineWidth=fs*.18;cx.strokeStyle='#2c3050';
  const tx=t<ia+.5?'정면충돌!':t<ia+C('CLASH_T')?(g>.55?'밀어붙인다!':g<.45?'밀리고 있다!':'팽팽하다!'):(D.win==='me'?'내가 이겼다!':'상대가 이겼다!');
  cx.strokeText(tx,VW/2,y-8);cx.fillStyle='#ffffff';cx.fillText(tx,VW/2,y-8);
  if(D.manual&&D.win==null&&t<ia+C('CLASH_T')){const pk=Math.max(0,1-(performance.now()-D.tapT)/160),f2=Math.round(fs*(.62+.14*pk));
    cx.font='italic 900 '+f2+'px system-ui,sans-serif';cx.textBaseline='top';cx.lineWidth=f2*.2;cx.strokeStyle='#2c3050';cx.fillStyle=pk>0?'#ffe14a':'#ffffff';
    const hx='👆 화면을 연타해서 밀어내!'+(D.taps?'  ×'+D.taps:'');cx.strokeText(hx,VW/2,y+h+8+fs*.5);cx.fillText(hx,VW/2,y+h+8+fs*.5);cx.textBaseline='bottom'}
  cx.fillStyle='rgba(8,6,24,.7)';cx.fillRect(x-4,y-4,w+8,h+8);
  const cm=TCOL[(XS.me.sel&&XS.me.sel.type)]||'#5ac8ff',cf=TCOL[(XS.foe.sel&&XS.foe.sel.type)]||'#ff6a6a';
  cx.fillStyle=cm;cx.fillRect(x,y,w*g,h);cx.fillStyle=cf;cx.fillRect(x+w*g,y,w*(1-g),h);
  cx.fillStyle='rgba(255,255,255,.35)';cx.fillRect(x,y,w,h*.35);
  cx.fillStyle='#fff';cx.fillRect(x+w*g-3,y-8,6,h+16);cx.strokeStyle='#2c3050';cx.lineWidth=3;cx.strokeRect(x,y,w,h);
  cx.font='900 '+Math.round(h*.8)+'px system-ui,sans-serif';cx.textBaseline='top';cx.fillStyle='#fff';cx.textAlign='left';cx.fillText('나',x+4,y+h+6);cx.textAlign='right';cx.fillText('상대',x+w-4,y+h+6);
  cx.restore()}

// 바깥에서 쓸 수 있게
window.GMXB={B,F,XS,join:tryJoin,joinable,state:()=>B.mach&&B.mach.st,foeState:()=>F.mach&&F.mach.st,foeStart:()=>{preloadSfx();F.mach.auto=true;return F.mach.start()},start:tryStart,machine:()=>B.mach,formKeyOf,loadAssets,ready,buildOptions,applyHit,cfg:C};
})();
