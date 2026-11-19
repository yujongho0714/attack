/* 거다이맥스 배틀 연결 (2단계) — gmax-core.js 의 규칙 모듈을 "실시간 배틀(ACT)"에 붙여요.
 *
 *  흐름:  일반 전투 ─(변신 버튼 / F키 / 패드 R3)→ 변신 연출 → 기술 선택(3초) → 발사 연출·명중 → 복귀 → 일반 전투
 *  - 변신~발사 동안(복귀 뒤 0.5초 더) 변신한 쪽은 무적: 피해·상태이상·넉백 전부 무시
 *  - 연출 동안 월드(내 움직임·상대 AI·쿨타임·타이머)는 멈추고, 연출 그림만 움직여요
 *  - 상대가 거다이맥스가 아니어도 연출은 생략 없이 전부 나와요 (3단계에서 양쪽 거다이 정면충돌을 얹어요)
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
const DEF={T_FIRE:3.6,IMPACT_AT:1.85,FIRE_AK:.5,SCALE:3.2,AUTO_MIN_T:5,AUTO_GAP:10,AUTO_TRAINER_ONLY:1,CUT_END:1.0,CHARGE_AT:.75,BEAM_AT:1.45};
const C=k=>CFG[k]!=null?CFG[k]:DEF[k];
const BASE='gmax/';
const SFX_PLAN=[{at:0,k:'gather',g:.7},{at:.4,k:'surge',g:.55},{at:1.42,k:'land',g:.8},{at:1.55,k:'clouds',g:.6},{at:1.55,k:'crackle',g:.5},{at:1.67,cry:1}];

const B={mach:null,fk:null,assets:{},opts:[],pick:-1,want:0,wantT:0,hold:null,holdT:0,hitDone:0,sfxI:0,cs:null,dmg:0,foeHpFrom:0,shk:0,
  pad:0,rowMe:2,btn:null,pickEl:null,css:0,faintAfter:0};

// ---------- 작은 도우미 ----------
const inBattle=()=>{try{return SCENE==='battle'&&BS.on&&ACT.on&&BS.me&&BS.foe&&BS.me.m&&BS.foe.m}catch(e){return false}};
const active=()=>!!B.mach&&B.mach.st!==ST.NORMAL;
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
const IMG={};function loadImg(url){return IMG[url]||(IMG[url]=new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=url}))}
function loadAssets(fk){
  if(B.assets[fk]!==undefined)return;B.assets[fk]='loading';
  const I=GM.infoOf(fk);if(!I){B.assets[fk]=null;return}
  (async()=>{const o={fk,info:I,anims:null,img:{},front:null,fn:I.frontFrames||1};
    try{if(I.gmaxSet){const r=await fetch(BASE+'sets/'+I.gmaxSet+'.json');if(r.ok){const j=await r.json();o.anims=j.anims;
        await Promise.all(Object.keys(j.anims).map(async k=>{o.img[k]=await loadImg(BASE+I.gmaxSet+'/'+j.anims[k].f+'-Anim.png')}));if(!o.img.idle)o.anims=null}}}catch(e){o.anims=null}
    try{if(I.front)o.front=await loadImg(BASE+'gmax-front/'+I.front)}catch(e){}
    if(!o.anims&&!o.front){B.assets[fk]=null;return}
    if(!o.cloudB){o.cloudB=await loadImg(BASE+'dynamax-cloud/cloud-back.png');o.cloudF=await loadImg(BASE+'dynamax-cloud/cloud-front.png')}
    B.assets[fk]=o})().catch(()=>{B.assets[fk]=null})}
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
function tryStart(){
  const M=B.mach;if(!M||!inBattle()||active())return;
  if(!M.canForm){try{toast(M.why()||'변신할 수 없어요')}catch(e){}return}
  if(M.uses<=0){try{toast('더 이상 변신할 수 없어요')}catch(e){}return}
  if(!canStartNow()){B.want=1;B.wantT=1.2;return}   // 기술 쓰는 중이면 끝나자마자 시작
  B.want=0;M.auto=!!(typeof actAuto==='function'&&actAuto());preloadSfx();
  M.start()}

// ---------- 상태가 바뀔 때 ----------
function onState(s,p){
  const me=BS.me,foe=BS.foe;
  if(s===ST.TRANSFORM){
    B.cs={t0:performance.now()};B.sfxI=0;B.hitDone=0;B.pick=-1;B.faintAfter=0;B.seed=Math.random()*100;
    // 무적 · 월드 정지 준비
    B.hold=me.m.hp;ACT.inv=99;try{ACT.ai.tel=0;ACT.ai.m=null}catch(e){}
    try{ACT.stick.on=0;ACT.stick.x=ACT.stick.y=0;ACT.aim=null;ACT.buf=null;ACT.roll=0}catch(e){}
    me.vx=me.vy=0;me.kx=me.ky=0;me.alpha=1;me.rot=0;me.trail=0;me.row=dirRow(foe.ax-me.ax,foe.ay-me.ay);B.rowMe=me.row;
    B.opts=buildOptions(me.m,B.fk);
    document.body.classList.add('gmxcine');
    try{FX2.flash('#ffffff',.5)}catch(e){}
    ui(1)}
  else if(s===ST.FIRE){
    B.shk=0;closePick();
    const o=B.opts[B.pick]||B.opts[0];B.sel=o;B.foeHpFrom=foe.m.hp;
    try{callout&&0}catch(e){}
    me.lastMv={name:o.name,type:o.type};
    ui(1)}
  else if(s===ST.RETURN){
    if(!B.hitDone)applyHit()}
  else if(s===ST.NORMAL&&p===ST.RETURN){
    finish()}}
function onPickOpen(){openPick()}
function onAutoPick(){const M=B.mach;if(M.st!==ST.PICK)return;let i=autoIndex();if(i<0)i=B.opts.findIndex(o=>o&&o.ok);if(i<0)i=0;B.pick=i;M.choose(i)}
function finish(){
  const me=BS.me,foe=BS.foe;if(!me)return;
  me.hide=0;me.glow=0;me.sc=1;document.body.classList.remove('gmxcine');closePick();
  B.tDone=ACT.t;ACT.inv=Math.max(0,CFG.AFTER_INV);B.holdT=.2;   // 복귀 뒤 0.5초 더 무적 (남은 투사체가 늦게 닿아도 HP 유지)
  try{FX2.flash('#ffffff',.35)}catch(e){}
  if(foe&&foe.m&&foe.m.hp<=0&&ACT.on){try{banner('기절!','#ff5a5a')}catch(e){}setTimeout(()=>{if(ACT.on&&BS.foe&&BS.foe.m.hp<=0)actEnd({t:'rt'})},700)}
  ui(1)}
function abort(){   // 배틀이 갑자기 끝나면 정리
  B.st=null;B.faintT=0;
  try{const M=B.mach;if(M){M.st=ST.NORMAL;M.t=0}}catch(e){}
  document.body.classList.remove('gmxcine');closePick();
  try{if(BS.me){BS.me.hide=0;BS.me.glow=0}}catch(e){}B.hold=null;B.want=0}

// ---------- 명중 ----------
function applyHit(){
  if(B.hitDone)return;B.hitDone=1;
  const me=BS.me,foe=BS.foe,atk=me.m,def=foe.m,o=B.sel||B.opts[0],S=bsz();
  const r=dmgOfOpt(o,atk,def);let dmg=Math.max(1,Math.floor(r.d*C('FIRE_AK')*(0.9+R()*.1)*(()=>{try{return rzMul(me,foe)}catch(e){return 1}})()));
  if(r.e===0)dmg=0;
  try{if(OPER.on&&OPER.one)dmg=def.hp;if(OPER.on&&OPER.god)0}catch(e){}
  B.dmg=dmg;   // 회피·무적 무시: 판정 없이 무조건 맞아요
  def.hp=Math.max(0,def.hp-dmg);try{bbox()}catch(e){}
  const x=foe.ax,y=foe.ay-S*.6,st=(()=>{try{return stopsOf(o.type)}catch(e){return['#1c2550','#f08030','#f08030','#ffe0a0','#ffffff']}})();
  try{FX2.flash('#ffffff',.9);FX2.hit(22,.16)}catch(e){}
  try{shardBurst(x,y,46,st[2],S*7,1,st);hitSpark(x,y,o.type,S*2,1);SH.lt.push({x,y,r:S*4.5,c:st[3],t:0,life:.9});for(let i=0;i<3;i++)pAdd({x,y,s:S*.3,s1:S*(2.4+i*1.1),life:.45+i*.12,st:['#ffffff',st[3],st[2],st[1],st[0]],k:'ring',glow:1})}catch(e){}
  try{sfx('hit');snd('hit_heavy',.9);if(r.e>=2)snd('super_eff',.6)}catch(e){}
  if(dmg>0){foe.dlt={v:dmg,t:1.6};try{FX2.num(foe.ax,foe.ay-S*1.5,String(dmg),r.e>=2?'#ffb030':'#ffffff',1,dskin())}catch(e){}}
  else{try{FX2.num(foe.ax,foe.ay-S*1.5,'효과 없음','#9be7ff',1)}catch(e){}}
  foe.st='hurt';foe.t=0;foe.blink=.5;foe.shake=.7;
  try{if(r.e>=2)superPop()}catch(e){}
  try{applyFx(o,me,foe)}catch(e){console.warn('gmax fx',e)}}


// ---------- 전용기 부가효과 (레조넌스 효과를 이 게임의 실시간 배틀에 맞게 옮김) ----------
// 이 게임 실시간 배틀에는 상태이상 시스템이 없어서, 거다이 효과만 여기서 시간으로 따로 관리해요.
//  상대에게: dots(지속 피해) · stun(완전히 멈춤) · root(제자리) · slow(둔화) · conf(혼란) · torment(기술 대기 느려짐) · drowsy(곧 잠듦) · cud(헤롱헤롱)
//  나에게: 회복 · 공격 UP(buffUntil) · 방어(guardUntil) · 약화 해제 · 대기시간 초기화  (게임이 이미 쓰는 buffUntil/guardUntil/debuffUntil 을 그대로 써요)
const FXC={SLOW_MIN:.2};   // 둔화가 아무리 겹쳐도 이보다 느려지진 않아요
function fxState(){const f=BS.foe;if(!B.st||B.st.f!==f)B.st={f,on:0,dots:[],stun:0,root:0,slow:0,slowK:1,conf:0,torment:0,drowsy:0,sleepFor:0,cud:0,cudT:0};return B.st}
function fxTxt(who,t,c){try{FX2.num(who.ax,who.ay-bsz()*1.9,t,c||'#ffffff',1)}catch(e){}}
function foeTypes(f){try{return META[f.m.n].types||[]}catch(e){return[]}}
function addSlow(s,sec,k){const cur=s.slow>0?s.slowK:1;s.slowK=Math.max(FXC.SLOW_MIN,Math.min(cur,k));s.slow=Math.max(s.slow,sec)}
function addDot(s,o,sec,frac,col){let st=null;try{st=stopsOf(o.type)}catch(e){}s.dots.push({left:sec,acc:0,frac,col:col||(TCOL[o.type]||'#ffffff'),st})}
function faintCheck(foe){
  if(foe&&foe.m&&foe.m.hp<=0&&ACT.on&&!B.faintT){B.faintT=1;try{banner('기절!','#ff5a5a')}catch(e){}
    setTimeout(()=>{B.faintT=0;if(ACT.on&&BS.foe&&BS.foe.m.hp<=0)actEnd({t:'rt'})},700)}}
function applyFx(o,me,foe){
  const fx=o&&o.fx;if(!fx||!fx.k||!foe||!me)return;
  const s=fxState(),now=performance.now();
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
    case 'cdAdd':try{ACT.ai.cd+=fx.sec}catch(e){}fxTxt(foe,'기술 지연!','#c0c0d8');break;
    case 'slow':addSlow(s,fx.sec,fx.k2);fxTxt(foe,fx.label||'느려졌다!','#9bd0ff');break;
    case 'debuff':foe.debuffUntil=now+fx.sec*1000;fxTxt(foe,'상대 약화!','#c79bff');break;
    case 'heal':{const mx=stOf(me.m)[0];me.m.hp=Math.min(mx,me.m.hp+Math.ceil(mx*fx.frac));try{bbox()}catch(e){}fxTxt(me,'회복!','#7dff9b');break}
    case 'cure':me.debuffUntil=0;fxTxt(me,'약화 해제!','#7dff9b');break;
    case 'buff':me.buffUntil=now+(fx.sec||12)*1000;fxTxt(me,fx.label||'공격 UP!','#ffd060');break;
    case 'guard':me.guardUntil=now+(fx.sec||8)*1000;fxTxt(me,fx.label||'방어!','#9bd0ff');break;
    case 'replenish':if(R()<(fx.chance==null?.5:fx.chance)){try{for(const k in ACT.cd)ACT.cd[k]=0;ACT.dcd=0}catch(e){}fxTxt(me,'기술 재충전!','#ffd060')}else fxTxt(me,'…','#cccccc');break;
    case 'defog':foe.guardUntil=0;me.debuffUntil=0;fxTxt(foe,'방어 해제!','#9bd0ff');break;
  }
  s.on=1}
// 월드가 돌아가는 동안(연출 중이 아닐 때) 매 프레임 진행: 지속 피해 · 멈춤 · 둔화 · 혼란
function fxRun(dt,run){
  const f=BS.foe,ai=ACT.ai,s=B.st,fr=(FX2.stop>0?0:dt);
  if(!s||s.f!==f){B.st=null;return run()}
  if(!fr||f.m.hp<=0)return run();
  const px=f.ax,py=f.ay,cd=ai?ai.cd:0,tel=ai?ai.tel:0,S=bsz();
  const r=run();
  // 지속 피해 (1초마다)
  for(let i=s.dots.length-1;i>=0;i--){const d=s.dots[i];d.left-=fr;d.acc+=fr;
    while(d.acc>=1&&f.m.hp>0){d.acc-=1;const mx=stOf(f.m)[0],dm=Math.max(1,Math.floor(mx*d.frac));f.m.hp=Math.max(0,f.m.hp-dm);try{bbox()}catch(e){}
      try{FX2.num(f.ax,f.ay-S*1.5,String(dm),d.col,1,dskin())}catch(e){}
      try{const st=d.st||['#202020',d.col,d.col,d.col,'#ffffff'];pAdd({x:f.ax,y:f.ay-S*.5,s:S*.2,s1:S*1.3,life:.4,st:['#ffffff',st[3],st[2],st[1],st[0]],k:'ring',glow:1})}catch(e){}}
    if(d.left<=0)s.dots.splice(i,1)}
  // 멈춤 · 가둠 · 둔화
  const stunned=s.stun>0,rooted=s.root>0;
  if(stunned||rooted){f.ax=px;f.ay=py;f.vx=f.vy=0;if(stunned)f.shake=Math.max(f.shake||0,.12)}
  else if(s.slow>0){f.ax=px+(f.ax-px)*s.slowK;f.ay=py+(f.ay-py)*s.slowK;f.vx*=s.slowK;f.vy*=s.slowK}
  if(stunned&&ai){if(ai.cd<cd)ai.cd=cd;if(tel>0&&ai.tel<tel)ai.tel=tel}   // 멈춰 있는 동안엔 기술도 못 써요
  if(s.torment>0&&ai&&ai.cd<cd)ai.cd=cd-(cd-ai.cd)*.5               // 트집: 기술 대기가 절반 속도로만 줄어요
  if(s.conf>0&&!stunned){f.ax+=(R()-.5)*S*.14*fr*60;f.ay+=(R()-.5)*S*.09*fr*60}
  // 시간 흐름
  s.stun=Math.max(0,s.stun-fr);s.root=Math.max(0,s.root-fr);s.conf=Math.max(0,s.conf-fr);s.torment=Math.max(0,s.torment-fr);
  if(s.slow>0){s.slow-=fr;if(s.slow<=0){s.slow=0;s.slowK=1}}
  if(s.drowsy>0){s.drowsy-=fr;if(s.drowsy<=0){s.drowsy=0;s.stun=Math.max(s.stun,s.sleepFor||2.5);fxTxt(f,'zzz…','#9bb8ff')}}
  if(s.cud>0){s.cud-=fr;s.cudT-=fr;if(s.cudT<=0){s.cudT=s.cudP||1.5;if(R()<(s.cudC==null?.5:s.cudC)){s.stun=Math.max(s.stun,s.cudS||.6);fxTxt(f,'헤롱헤롱…','#ff7ab0')}}}
  s.on=(s.dots.length||s.stun>0||s.root>0||s.slow>0||s.conf>0||s.torment>0||s.drowsy>0||s.cud>0)?1:0;
  if(f.m.hp<=0)faintCheck(f);
  return r}

// ---------- 게임 함수 감싸기 ----------
{const _au=actUpdate;actUpdate=function(dt){
  if(ACT.on&&B.mach){
    if(B.hold!=null&&BS.me&&BS.me.m&&BS.me.m.hp<B.hold){BS.me.m.hp=B.hold;try{bbox()}catch(e){}}   // 무적: 남아 있던 상대 공격이 와도 HP 유지
    if(B.mach.invincible()&&BS.me){BS.me.kx=BS.me.ky=0}
    if(active()){try{arenaHud()}catch(e){}return}}   // 월드 정지 (연출 중)
  if(ACT.on&&B.mach&&B.st&&B.st.on&&inBattle())return fxRun(dt,()=>_au.apply(this,arguments));   // 걸려 있는 부가효과가 있으면 같이 진행
  return _au.apply(this,arguments)}}
for(const nme of ['actPress','actRoll']){const f=window[nme];if(typeof f==='function')window[nme]=function(){if(active())return;return f.apply(this,arguments)}}
if(typeof actSwitch==='function'){const _sw=actSwitch;actSwitch=function(){if(active())return;return _sw.apply(this,arguments)}}
if(typeof rzStatus==='function'){const _rs=rzStatus;rzStatus=function(mine,m,AB,DB){try{if(!mine&&B.mach&&B.mach.invincible()&&DB===BS.me)return}catch(e){}return _rs.apply(this,arguments)}}   // 상태이상도 무시
{const _b=battle;battle=async function(){B.mach=null;initMach();B.hold=null;B.fk=null;B.want=0;B.tDone=null;closePick();document.body.classList.remove('gmxcine');return _b.apply(this,arguments)}}
{const _ae=actEnd;actEnd=function(){if(active())abort();return _ae.apply(this,arguments)}}

function initMach(){
  const M=GM.machine({canForm:false});B.mach=M;
  M.on('state',onState);M.on('pickOpen',onPickOpen);M.on('autoPick',onAutoPick);return M}
initMach();

// ---------- 매 프레임 ----------
{const _d=drawBattle;drawBattle=function(dt){_d.apply(this,arguments);try{frame(dt)}catch(e){if(!B.err){B.err=1;console.warn('gmax-battle',e)}}}}
function frame(dt){
  dt=Math.min(.05,dt||0);const M=B.mach;if(!M)return;
  if(!inBattle()){if(active())abort();ui(0);return}
  refreshForm();padPoll();
  // 기술 쓰는 중에 눌렀으면 끝나자마자
  if(B.want){B.wantT-=dt;if(canStartNow()){tryStart()}else if(B.wantT<=0)B.want=0}
  autoTrigger();
  const was=M.st;M.tick(dt);
  if(B.holdT>0&&!M.invincible()){B.holdT-=dt;if(B.holdT<=0)B.hold=null}
  else if(!active()&&M.inv<=0&&B.holdT<=0)B.hold=null;
  if(active()||fadeOut>0)cine(dt);
  ui(0)}
let fadeOut=0;

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
    if(B.mach.st===ST.PICK){const i='qwer'.indexOf(k),j='1234'.indexOf(k);const n=i>=0?i:j;if(n>=0){e.preventDefault();e.stopImmediatePropagation();pickIdx(n);return}}
    if(k!=='f5'&&k!=='f12'){e.stopImmediatePropagation()}return}
  if(k==='f'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||'')){e.preventDefault();tryStart()}},true);
function padPoll(){try{const gp=(navigator.getGamepads&&navigator.getGamepads())||[];let on=0;for(const g of gp){if(g&&g.buttons&&g.buttons[11]&&g.buttons[11].pressed)on=1}if(on&&!B.pad)tryStart();B.pad=on}catch(e){}}

// ---------- 화면 UI (버튼 · 기술 고르기) ----------
function css(){if(B.css)return;B.css=1;const s=document.createElement('style');s.textContent=`
body.gmxcine #actUI #aStickZ,body.gmxcine #actUI #aStick,body.gmxcine #actUI #aSk,body.gmxcine #actUI #aRoll,body.gmxcine #actUI #aTop,body.gmxcine #actUI #aParty,body.gmxcine #teraBtn,body.gmxcine #dxBtn,body.gmxcine #bAutoB,body.gmxcine #gmxBtn{visibility:hidden!important;pointer-events:none!important}
#gmxBtn{position:fixed;left:10px;top:calc(44% + 132px + env(safe-area-inset-top));z-index:46;display:none;flex-direction:column;align-items:center;gap:1px;min-width:78px;padding:6px 8px;border:3px solid #2c3050;border-radius:12px;background:linear-gradient(#e0405a,#9a1f5a);color:#fff;text-shadow:0 1px 2px #000a;font-weight:900;font-size:13px;line-height:1.15;box-shadow:0 3px 0 #2c3050}
#gmxBtn.off{background:#6b6f86;color:#d8dbe8;box-shadow:0 3px 0 #2c3050}
#gmxBtn small{font-weight:700;font-size:11px}
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
    b.innerHTML=left>0?'<span>🌩 거다이맥스</span><small>남은 '+left+'번 · F</small>':'<span>🌩 거다이맥스</span><small>더 이상 변신할 수 없어요</small>'}}
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
function drawG(kind,t,row,x,y,size,o){
  o=o||{};const as=A_();if(!as)return;cx.save();cx.imageSmoothingEnabled=false;
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

function cine(dt){
  const M=B.mach,me=BS.me,foe=BS.foe,as=A_();if(!as||!me||!foe)return;
  const st=M.st,t=M.t,S=bsz(),size=gSize(),type=(B.sel&&B.sel.type)||GM.sigOf(B.fk).type;
  const stops=(()=>{try{return stopsOf(type)}catch(e){return['#1c2550','#f08030','#f08030','#ffe0a0','#ffffff']}})();
  const now=performance.now()/1000,gx=me.ax,gy=me.ay;
  // 효과음
  if(st===ST.TRANSFORM){while(B.sfxI<SFX_PLAN.length&&SFX_PLAN[B.sfxI].at<=t){const p=SFX_PLAN[B.sfxI++];if(p.cry)cry(me.m);else play(p.k,p.g)}}
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
  cx.save();cx.setTransform(DPR,0,0,DPR,0,0);
  const g=cx.createRadialGradient(VW/2,VH*.55,Math.min(VW,VH)*.2,VW/2,VH*.55,Math.max(VW,VH)*.75);g.addColorStop(0,hex2rgba('#0a0618',dim*.7));g.addColorStop(1,hex2rgba(stops[0]||'#0a0618',Math.min(.92,dim*1.25)));
  cx.fillStyle=g;cx.fillRect(0,0,VW,VH);cx.restore();
  // 월드 좌표 (카메라 적용): 상대 · 구름 · 내 거다이 · 빔
  cx.save();camT();
  // 상대는 어둠 위에 다시 그려서 밝게 (피격 모션 그대로)
  try{if(foe._rd)foe._rd()}catch(e){}
  const bob=Math.sin(now*3.2)*size*.012,fy=gy+bob;
  const row=dirRow(foe.ax-me.ax,foe.ay-me.ay);B.rowMe=row;
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
    for(let i=0;i<22;i++){const a=i*2.4+B.seed,r0=size*(.25+1.1*k)*(.6+.4*((i*37)%10)/10),r1=r0*.72;cx.strokeStyle=hex2rgba(stops[3],.55*(1-k*.3));cx.lineWidth=Math.max(2,size*.012);cx.beginPath();cx.moveTo(gx+Math.cos(a)*r0,gy-size*.45+Math.sin(a)*r0*.7);cx.lineTo(gx+Math.cos(a)*r1,gy-size*.45+Math.sin(a)*r1*.7);cx.stroke()}cx.restore()}
  // 거다이 몸
  if(vis){
    let kind='idle',tt=now,loop=true,lunge=0;
    if(st===ST.FIRE&&as.anims&&as.anims.attack){const a0=C('BEAM_AT')-(((as.anims.attack.hit||4)>0?(as.anims.attack.d.slice(0,as.anims.attack.hit||4).reduce((a,b)=>a+b,0)/60):.4));if(t>=a0&&t<a0+animLen(as.anims.attack)/60+.05){kind='attack';tt=t-a0;loop=false}}
    if(st===ST.FIRE&&!as.anims){lunge=t>C('BEAM_AT')&&t<C('BEAM_AT')+.35?Math.sin((t-C('BEAM_AT'))/.35*Math.PI)*size*.06:0}
    const ux=Math.sign(foe.ax-me.ax)||1;
    const chargeShake=(st===ST.FIRE&&t>C('CHARGE_AT')&&t<C('BEAM_AT'))?(Math.sin(now*70)*size*.008):0;
    drawG(kind,tt,row,gx+lunge*ux+chargeShake,fy,size*pop,{loop,flipX:!as.anims&&ux<0});
  }
  wisps(as.cloudF,1);
  // ----- 발사 -----
  if(st===ST.FIRE)fireFx(dt,t,gx,fy,size,type,stops,now);
  cx.restore();
  // ----- 화면 위 글자 · 컷인 -----
  cx.save();cx.setTransform(DPR,0,0,DPR,0,0);
  if(st===ST.TRANSFORM)titleBar(nm(me.m)+'은(는) 거다이맥스했다!',ease.cl(t,.15,.4)*(1-ease.cl(t,1.3,1.5)),'#ffd23f');
  if(st===ST.PICK){const left=Math.max(0,M.pickLeft);const el=B.pickEl;if(el){const h=el.querySelector('.gh');if(h){h.querySelector('b').textContent=Math.ceil(left);h.querySelector('i').style.width=(left/CFG.PICK_SECONDS*100)+'%'}}
    titleBar('거다이맥스!',.9,'#ffd23f',.55)}
  if(st===ST.FIRE)fireUI(t,type,stops);
  if(flashW>0){cx.fillStyle='rgba(255,255,255,'+Math.min(1,flashW)+')';cx.fillRect(0,0,VW,VH)}
  cx.restore();
  cx.setTransform(1,0,0,1,0,0)}

const topY=fs=>Math.max(VH*.2,100+fs*.95+6);   // 위쪽 체력바(HUD) 아래에 오게
function titleBar(text,a,col,scale){
  if(a<=0)return;const fs=Math.round(Math.min(VW*.065,46)*(scale||1)),y=topY(fs);cx.save();cx.globalAlpha=a;
  const w=Math.min(VW*.96,VW*.9);cx.fillStyle='rgba(8,6,24,.55)';cx.fillRect(0,y-fs*.95,VW,fs*1.7);
  cx.strokeStyle=col;cx.globalAlpha=a*.8;cx.lineWidth=3;cx.beginPath();cx.moveTo(0,y-fs*.95);cx.lineTo(VW,y-fs*.95);cx.moveTo(0,y+fs*.75);cx.lineTo(VW,y+fs*.75);cx.stroke();cx.globalAlpha=a;
  cx.font='italic 900 '+fs+'px system-ui,sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.lineJoin='round';cx.lineWidth=fs*.16;cx.strokeStyle='#2c3050';cx.strokeText(text,VW/2+(1-a)*40,y);cx.fillStyle=col;cx.fillText(text,VW/2+(1-a)*40,y);cx.restore()}

// 컷인(큰 앞모습) + 기술 이름 배너 (화면 위 · 아래)
function fireUI(t,type,stops){
  const me=BS.me,as=A_(),o=B.sel,col=TCOL[type]||'#fff';
  // 기술 이름 배너 (위에서 내려옴, 빔 쏠 때까지 유지)
  const aIn=ease.out(ease.cl(t,0,.25)),aOut=1-ease.cl(t,C('BEAM_AT')+.4,C('BEAM_AT')+.7);
  if(aIn*aOut>0){const fs=Math.round(Math.min(VW*.07,52)),y=topY(fs)+(1-aIn)*-80;cx.save();cx.globalAlpha=aIn*aOut;
    const tx=nm(me.m)+'의 '+o.name+'!';cx.fillStyle='rgba(8,6,24,.7)';cx.fillRect(0,y-fs*.9,VW,fs*1.8);cx.fillStyle=col;cx.globalAlpha=aIn*aOut*.9;cx.fillRect(0,y+fs*.9,VW,5);cx.fillRect(0,y-fs*.9-5,VW,5);cx.globalAlpha=aIn*aOut;
    cx.font='italic 900 '+fs+'px system-ui,sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.lineJoin='round';cx.lineWidth=fs*.16;cx.strokeStyle='#2c3050';cx.strokeText(tx,VW/2,y);cx.fillStyle='#ffffff';cx.fillText(tx,VW/2,y);cx.restore()}
  // 컷인: 비스듬한 띠 + 큰 앞모습이 옆에서 미끄러져 들어옴
  const ce=C('CUT_END'),u=ease.cl(t,0,.32),uo=ease.cl(t,ce-.25,ce);
  if(t<ce&&as){const k=ease.out(u)*(1-ease.out(uo)),H=VH*.62,bandY=VH*.5;cx.save();cx.globalAlpha=Math.min(1,k*1.4);
    cx.translate(VW/2,bandY);cx.rotate(-.13);const bw=VW*1.5,bh=H*.78,off=(1-ease.out(u))*-VW*.9+ease.out(uo)*VW*.9;
    const g=cx.createLinearGradient(-bw/2,0,bw/2,0);g.addColorStop(0,hex2rgba(stops[1],0));g.addColorStop(.25,hex2rgba(stops[1],.85));g.addColorStop(.75,hex2rgba(stops[2],.85));g.addColorStop(1,hex2rgba(stops[2],0));
    cx.translate(off*.4,0);cx.fillStyle=g;cx.fillRect(-bw/2,-bh/2,bw,bh);
    cx.fillStyle='rgba(255,255,255,.35)';for(let i=0;i<14;i++){const yy=((i*53+t*900)%(bh))-bh/2;cx.fillRect(-bw/2+((i*131)%bw)*.2,yy,bw*(.2+((i*17)%10)/30),3)}
    cx.restore();
    // 앞모습 (거다이맥스 컷인)
    const src=as.front;if(src){const n=as.fn,fw=src.width/n,fh=src.height,f=Math.floor(t*10)%n,s=H/fh,x=VW*.5+off+(1-ease.out(u))*0;cx.save();cx.globalAlpha=Math.min(1,k*1.4);cx.imageSmoothingEnabled=false;cx.translate(VW*.5+off*.9,bandY+H*.08);cx.rotate(-.05);cx.drawImage(src,f*fw,0,fw,fh,-fw*s/2,-fh*s/2,fw*s,fh*s);cx.restore()}}
}

// 충전 · 빔 · 명중 (월드 좌표)
function fireFx(dt,t,gx,gy,size,type,stops,now){
  const me=BS.me,foe=BS.foe,S=bsz(),ux0=foe.ax-me.ax,uy0=(foe.ay-S*.55)-(gy-size*.46),L=Math.hypot(ux0,uy0)||1,ux=ux0/L,uy=uy0/L;
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
  if(t>=ba){
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
    if(t>=ia&&!B.hitDone)applyHit();
    // 명중 뒤 불꽃 기둥 (잠깐)
    if(t>=ia&&t<ia+.9){const u=ease.cl(t,ia,ia+.9);cx.save();cx.globalCompositeOperation='lighter';const r=size*.55*(.4+ease.out(u));
      const g=cx.createRadialGradient(tx,ty,0,tx,ty,r);g.addColorStop(0,'rgba(255,255,255,'+(.9*(1-u))+')');g.addColorStop(.4,hex2rgba(stops[3],.6*(1-u)));g.addColorStop(1,hex2rgba(stops[1],0));cx.fillStyle=g;cx.beginPath();cx.arc(tx,ty,r,0,7);cx.fill();cx.restore()}}
}

// 바깥에서 쓸 수 있게
window.GMXB={B,state:()=>B.mach&&B.mach.st,start:tryStart,machine:()=>B.mach,formKeyOf,loadAssets,ready,buildOptions,applyHit,cfg:C};
})();
