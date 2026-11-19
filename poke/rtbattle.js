/* 레조넌스 실시간 전투 (6B) — 야생 1대1 시험 전투
 * 규칙 출처: 레조넌스_전투규칙_명세서.md (60틱 고정, 아레나 1200x760, 구르기 2충전, 기술 4개)
 * 기존 전투는 건드리지 않고 별도 화면(캔버스)에서 돌아감. 저장 데이터(HP·경험치)는 바꾸지 않음(시험 모드).
 * 사용: RTB.start({me,foe,getSpr,sprKey,drawPm,stOf,eff,RZM,mv,META,TCOL,nm}) -> Promise('win'|'lose'|'draw'|'quit')
 */
(function(){
'use strict';
const TICK=1/60, AW=1200, AH=760, WALL=18;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=Math.random;
const GR=['L','M','H','X'];
const gradeOf=p=>p<=50?0:p<=80?1:p<=110?2:3;
const MELEE_K={melee:1,leap:1,vanish:1,roll:1};
const ST_MELEE=[12,17,24,34], ST_RANGE=[10,14,21,30];
const WALK_ST=[.6,.35,0,0];            // 준비 중 걷기 배율
const REC=[12,16,22,30], REC_MV=[.5,.5,.25,0];
const TURN=[720,540,240,150], LOCK=[3,5,9,14];
const STUN=[8,13,20,28], KB=[20,42,70,110], HSTOP=[.05,.083,.117,.15];
const ACTIVE_MELEE=[4,5,6,8];
const dirRow=(dx,dy)=>{const a=Math.atan2(dy,dx);const o=((Math.round(a/(Math.PI/4))%8)+8)%8;return[2,1,0,7,6,5,4,3][o]};
const len=(x,y)=>Math.hypot(x,y);
const norm=(x,y)=>{const L=Math.hypot(x,y)||1;return{x:x/L,y:y/L}};
const angDiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
const stageMul=s=>s>=0?(2+s)/2:2/(2-s);

let C=null, W=null; // 게임 도구 / 현재 전투 상태

// ---------- 쿨타임 (6C-1: 레조넌스 원본 공식 그대로) ----------
// 원본: sessionEnv 의 기술 쿨타임 함수 + data 설정값. 시험 모드에서 맞춘 값.
// 6C-4: 원본 설정값 — 연속기(rampage)·다단 충전(charges)·PP·발버둥·몸 크기
const RAMP={min:2,max:3,firstT:17,followT:6,gapT:8,armor:2,confuseSec:3,cdMul:2,powerMul:.75};
const CHG={max5:5,cap:5,canon:3.1,gm5Melee:[1.19,1.5,1.19,1.19],gm5Shot:1.125,gmFixMelee:1.1,gmFixShot:1,
  rs:{furyswipes:1.9,cometpunch:1.9,tailslap:2.5,doubleslap:1.3,furyattack:1.3,armthrust:1.3,doublekick:2.3,dualchop:3,doublehit:2.6,geargrind:3.6,doubleironbash:4.2,dualwingbeat:3,surgingstrikes:2.1,tripledive:2.2,triplekick:2,tripleaxel:3.3,populationbomb:1.5,furycutter:1.8,pinmissile:2.2,bulletseed:2.2,iciclespear:2.2,rockblast:2.2,bonerush:2.2,scaleshot:2.2,spikecannon:1.8,barrage:1.5,watershuriken:1.8,twineedle:2.1,bonemerang:3.9,dragondarts:3.4,twinbeam:3.2,tachyoncutter:4.3}};
const PPMUL=2,STRUGGLE={n:'발버둥',t:'NORMAL',c:0,p:40,a:100,pp:0,pr:0,k:'melee',kd:'strike',sb:'',aim:'direction',ef:[{op:'recoil',frac:.25,of:'max'}],f:'Struggle'};
const SIZE={ref:30,refH:.4,exp:.7,rf:.3,min:24,max:380,rmin:12,rmax:110,refSize:61,kbRef:30,kbExp:.5,kbMin:.4,mvRef:60,mvExp:.2,mvMin:.9,mvMax:1.3,meleeShare:.5};
const szMul=(e,melee)=>{const x=Math.pow((e.size||57)/SIZE.mvRef,SIZE.mvExp*(melee?SIZE.meleeShare:1));return melee?clamp(x,1-(1-SIZE.mvMin)*SIZE.meleeShare,1+(SIZE.mvMax-1)*SIZE.meleeShare):clamp(x,SIZE.mvMin,SIZE.mvMax)};
const CD={base:.7,perPower:.07,min:3.5,max:16,
  kind:{melee:.85,projectile:1,beam:1.15,pulse:1.15,self:1,vanish:1.25,leap:1,roll:1,zone:1,delayed:1,target:1},
  quick:.75,status:8,boost:12,protect:13,heal:20,recharge:16,rechargeNonBeam:6,rollPowerMul:4,
  cadence:1.2,paraRate:.8,hasteBase:1.05,hastePerStat:.0013,hasteMin:.88,hasteMax:1.05};
const opsOf=d=>(d.ef||[]).map(x=>x.op);
const hitsOf=d=>{const m=(d.ef||[]).find(x=>x.op==='multiHit');if(!m)return 1;if(m.n!=null)return clamp(Math.round(m.n),1,5);return 3};
const isExecute=d=>(d.ef||[]).some(x=>x.op==='fixed'&&x.mode==='execute');
// 기술 하나의 쿨타임(초, 속도 보정 전) + 속도 보정을 받는지
function cooldownOf(d,k,p,st){
  const ops=opsOf(d);
  if(st){ // 변화 기술
    const guard=ops.includes('guard');
    const heal=(d.ef||[]).some(x=>x.op==='heal'&&x.who!=='replacement'&&!x.revive&&x.frac!=null);
    const boost=(d.ef||[]).some(x=>(x.op==='stat'&&x.who!=='target')||(x.op==='crit'&&x.who!=null))&&d.tg==='User';
    return{sec:guard?CD.protect:heal?CD.heal:boost?CD.boost:CD.status,hasted:true};
  }
  const recharge=ops.includes('recharge'),exec=isExecute(d),explosive=ops.includes('selfKO')&&(d.ef||[]).some(x=>x.op==='note'&&x.t==='explosive');
  if(recharge&&d.k!=='beam')return{sec:CD.rechargeNonBeam,hasted:false};
  if(recharge||exec||explosive)return{sec:CD.recharge,hasted:false};
  const hits=hitsOf(d);
  let ep=d.p>1?(hits>1?d.p*hits:d.p):(hits>1?60*hits:60);
  if(k==='roll')ep*=CD.rollPowerMul;
  const sec=clamp(CD.base+CD.perPower*ep,CD.min,CD.max)*(CD.kind[k]||1)*(d.pr>0?CD.quick:1);
  return{sec,hasted:true};
}
// 속도 능력치 -> 쿨타임 배율 (빠를수록 짧음, 0.88~1.05)
const hasteOf=spe=>clamp(CD.hasteBase-CD.hastePerStat*spe,CD.hasteMin,CD.hasteMax);

// ---------- 기술 정보 ----------
function moveInfo(id){
  let d=id==='struggle'?STRUGGLE:((C.RZM&&C.RZM[id])||(C.SGD&&C.SGD[id]));   // 7F: 직접 만든 전설 기술(sg_*)은 host가 준 SGD 정의
  if(!d){const g=C.mv(id)||{};d={n:g.name||id,t:g.type||'NORMAL',c:g.ph?0:1,p:g.pw||0,a:g.acc||100,pr:g.pri||0,k:g.ph?'melee':'projectile',kd:'',sb:'',aim:'direction',ef:[],f:''};}
  const st=d.c===2||!(d.p>0);
  const k=d.k, exec=isExecute(d), fx=(d.ef||[]).find(x=>x.op==='fixed'&&x.mode!=='execute')||null;
  const p=st?0:exec?200:d.p<=1?60:d.p, g=gradeOf(p); // 즉사기=위력200, 위력1짜리(고정피해 등)=기본 60
  const melee=!!MELEE_K[k];
  let su=(melee?ST_MELEE:ST_RANGE)[g];
  if(k==='self'){const e=(d.ef||[]).map(x=>x.op).join(',');su=/guard/.test(e)?4:/heal/.test(e)?36:48;}
  if(st&&k!=='self')su=Math.min(su,14);
  if(d.a>0&&d.a<100)su+=Math.min(24,(100-d.a)*.4);
  if(d.pr>0)su=4;
  const cdi=cooldownOf(d,k,p,st);
  const cd=cdi.sec;
  const mh=(d.ef||[]).find(x=>x.op==='multiHit')||null,li=(d.ef||[]).find(x=>x.op==='lockIn')||null;
  const o={id,d,name:d.n,type:d.t,p,st,k,kd:d.kd,g,melee,su:Math.round(su),cd,hasted:cdi.hasted,phys:d.c===0,exec,fx,selfko:opsOf(d).includes('selfKO'),rech:opsOf(d).includes('recharge'),hits:hitsOf(d),mh};
  // 6C-4 다단 기술 = 충전(charges): 한 번 누르면 한 대, 충전이 하나씩 다시 참 (원본 multiHit.charges)
  if(mh&&!st){const five=mh.n==null&&mh.min!=null,n=five?0:Math.round(mh.n||0);
    if(five||n>=2){const mx=five?CHG.max5:Math.min(CHG.cap,n),typ=five?CHG.canon:n;
      const gm=five?(melee?CHG.gm5Melee[g]:CHG.gm5Shot):(melee?CHG.gmFixMelee:CHG.gmFixShot);
      o.chg={max:mx,per:CHG.rs[id]!=null?CHG.rs[id]:Math.max(.8,cd/typ*gm)}}}
  if(li&&li.mode==='rampage'&&melee)o.ramp=1;            // 6C-4 연속기(역린·난동부리기·꽃잎댄스·분노의붕격)
  if(li&&li.mode==='roll'&&li.powerDoublesPerHit)o.rollUp=li.maxMult||8;   // 6C-4 구르기·아이스볼: 맞힐 때마다 위력 2배(최대 8배)
  if(o.ramp)o.su=RAMP.firstT;
  o.ppMax=id==='struggle'?0:Math.max(1,(d.pp||10)*PPMUL);   // 6C-4 PP(원본 pp.maxMul 2)
  if(id==='struggle'){o.cd=2.5;o.typeless=1}
  return o;
}

// ---------- 6E: 기존 기술 이펙트(SKFX·FX2·VFX) 연결 ----------
// 그림만 재생함. 데미지·판정은 전부 위 규칙 그대로(이펙트는 판정에 영향 없음). 이펙트는 상대 위·내 포켓몬 아래에 그려 내 몸을 가리지 않음
const fxOn=()=>!!(C&&C.fxe&&C.fxe.FX2&&C.fxe.VFX&&C.fxe.SKFX&&C.fxe.MV);
const fxS=m=>50+m.g*7;                      // 이펙트 크기 기준(너무 크지 않게)
function fxActor(e){return{ox:0,oy:0,lift:0,sq:1,trail:0,st:'idle',t:0,blink:0,vx:0,vy:0,m:e.mon,S:null,get ax(){return e.x},get ay(){return e.y}}}
function skillFx(e,m,a,b,opt){
  if(!fxOn()||!m)return;opt=opt||{};
  try{
    const key=m.id,now=W.time;
    if(!opt.force&&e._fxK===key&&now-(e._fxT||0)<.4)return;   // 같은 기술 연속 재생 방지(구르기·연타)
    e._fxK=key;e._fxT=now;
    const F=C.fxe,S=opt.S||fxS(m),g=C.mv(m.id)||{id:m.id,name:m.name,type:m.type,pw:m.p};
    const tg=foeOf(e);
    const x={A:fxActor(e),B:fxActor(tg),fa:{x:a.x,y:a.y},fb:{x:b.x,y:b.y},S,d:b.x>=a.x?1:-1,a:{x:a.x,y:a.y-S*.6},b:{x:b.x,y:b.y-S*.55},pose:()=>{},hit:()=>{}};
    const id=F.MV.pick(g.id||m.id,g.type||m.type);
    Promise.resolve(F.SKFX.run(x,id,g,1,e.side===0,1)).catch(()=>{});
  }catch(err){}
}
// 6E-2: 발사체에 기존 이펙트 그림을 입혀 날아가게 함 (판정·속도는 그대로, 그림만 따라다님)
const PSKIN={FIRE:['pa2d/ember',{row:2,sc:26,fps:12}],WATER:['pa2d/pulsoagua',{row:0,sc:22,fps:12}],GRASS:['grass/energy_ball_sheet',{sc:14,fps:12}],
  ELECTRIC:['electric/thunder_wave_sheet',{sc:30,fps:14}],ICE:['pa2d/aurasphere',{row:2,sc:14,fps:12,blend:'lighter',filter:'hue-rotate(110deg)'}],
  PSYCHIC:['psychic/hypnosis_wave_sheet',{sc:10,fps:10}],GHOST:['pa2d/shadowball',{row:1,sc:20,fps:12}],DARK:['pa2d/shadowball',{row:1,sc:20,fps:12,filter:'saturate(0) brightness(.45)'}],
  FIGHTING:['pa2d/aurasphere',{row:2,sc:14,fps:12,blend:'lighter'}],FAIRY:['fairy/moonblast_sheet',{sc:12,fps:10,blend:'lighter'}],ROCK:['pa2d/roca',{row:1,sc:22,fps:8}],
  GROUND:['pa2d/lodo',{row:0,sc:30,fps:12}],POISON:['pa2d/lodo',{row:0,sc:30,fps:12,filter:'hue-rotate(250deg)'}],FLYING:['pa2d/aeroanillo',{sc:30,fps:14}],
  DRAGON:['polished-20/dracometeor',{sc:30,fps:10}],BUG:['pa2d/cuchilla',{row:0,sc:16,fps:20}],STEEL:['pa2d/cuchilla',{row:0,sc:16,fps:20,filter:'saturate(0)'}],NORMAL:['pa2d/cuchilla',{row:0,sc:16,fps:20,filter:'saturate(.2) brightness(1.3)'}]};
function projSkin(p,m){
  if(!fxOn())return null;
  try{const d=PSKIN[m.type]||PSKIN.NORMAL,S=fxS(m)*(m.p>=110?1.25:1);
    return C.fxe.VFX.anim(d[0],{loop:true,x:p.x,y:p.y-24,rot:Math.atan2(p.dy,p.dx),row:d[1].row||0,scale:S/d[1].sc,fps:d[1].fps,blend:d[1].blend,filter:d[1].filter})}catch(e){return null}
}
function fxShake(g){if(!fxOn())return;try{C.fxe.FX2.hit([3,5,8,11][g]||3,0)}catch(e){}}

// ---------- 개체 ----------
function mkEnt(mon,S,side,hp0){
  const s=C.stOf(mon);
  // 6C-4 몸 크기: 원본 sizing.power — 크기 = 30×(키/0.4m)^0.7 (24~380), 몸 반지름 = 크기×0.3 (12~110), 그림도 크기에 비례
  let size=57;try{if(C.bodySize){const b=+C.bodySize(mon);if(b>0)size=clamp(b,SIZE.min,SIZE.max)}}catch(er){}
  let sc=2,vis=110;
  try{const A=S&&S.meta&&S.meta.anims&&(S.meta.anims.idle);if(A){const tgtPx=clamp(200*Math.pow(size/SIZE.refSize,.6),160,400);/* 폰에서 작은 포켓몬도 잘 보이게 최소 100px(판정 반지름은 원본 그대로) */sc=clamp(tgtPx/Math.max(A.w,A.h),.5,6);vis=A.h*sc}}catch(e){}
  const e={mon,S,side,x:side?970:230,y:380,vx:0,vy:0,kx:0,ky:0,face:{x:side?-1:1,y:0},
    st:s,hp:s[0],max:s[0],lv:Math.min(100,mon.lv||50),types:(C.META[mon.n]||{types:['NORMAL']}).types,
    sc,vis,size,r:Math.round(clamp(SIZE.rf*size,SIZE.rmin,SIZE.rmax)),spd:clamp(128+.65*s[5],125,250),
    moves:(mon.moves||[]).slice(0,4).map(moveInfo),cd:[0,0,0,0],cdMax:[1,1,1,1],
    rc:2,rollT:0,rdx:0,rdy:0,inv:0,stun:0,cast:null,buf:null,
    stg:{atk:0,def:0,spa:0,spd:0,spe:0},stgT:0,
    ail:{},hidden:false,protect:0,critWin:0,anim:'idle',at:0,row:side?6:2,blink:0,hold:0,beam:null,counter:0,flash:0};
  e.haste=hasteOf(s[5]);
  try{e.K=C.numK?clamp(+C.numK(mon)||1,1,1e7):1}catch(er){e.K=1}   // 7D 숫자 배율
  try{e.critX=C.critOf?C.critOf(mon)||{c:0,d:0}:{c:0,d:0}}catch(er){e.critX={c:0,d:0}}
  // 8F: 장비(출결 캐릭터 장비 · 스타포스 강화 · 큐브 옵션) — 내 포켓몬에게 모든 새 전투에서 (예전엔 월드보스에서만)
  e.hm=1;e.gear=null;try{const g=C.gearOf?C.gearOf(mon):null;if(g){e.gear=g;e.hm=1+(g.hp||0)/100;e.max=Math.round(e.max*e.hm);e.hp=e.max;e.critX={c:Math.min(.75,(e.critX?e.critX.c:0)+(g.crt||0)/100),d:(e.critX?e.critX.d:0)+(g.cdm||0)/100}}}catch(er){}
  // 9F 초월 능력(위 등급은 아래 등급 능력도 가짐) — 각성 단계 e.aw(0~6)
  //  불멸: 쓰러지면 1번 부활(체력 50%) · 각성하면 부활 뒤 무적 10초 + 각성마다 3초
  //  태초: 들어오고 1초 뒤 분신 소환(같이 공격) 20초 + 각성마다 5초
  //  만제: 20초 동안 데미지 +30% 버프, 재사용 30초 − 각성마다 3초 (자동) · 파티 공격 +30%는 host(rtDmgMul)
  e.tier=0;try{e.tier=C.tierOf?(+C.tierOf(mon)||0):0}catch(er){}e.aw=Math.max(0,Math.min(6,(mon&&mon.aw)|0));
  e.undying=e.tier>=7;e.sh=0;e.shMax=0;e.cloneDur=e.tier>=8?20+5*e.aw:0;e.cloneUsed=0;e.life=0;
  e.zb=e.tier>=9?{cd:1,on:0,cdMax:Math.max(3,30-3*e.aw)}:null;
  if(e.tier>=6&&window.TFX)try{e.eng=TFX.eng()}catch(er){}
  {const h0=hp0!=null?hp0:(side?C.foeHp:C.meHp);if(h0!=null&&isFinite(h0))e.hp=clamp(h0*e.hm,1,e.max)}   // 6F-2: 지금 체력에서 시작(없으면 가득) · 저장된 체력은 장비 전 값   // 6F-2: 지금 체력에서 시작(없으면 가득)
  // 속도가 빠르면 준비동작이 줄어듦 (원본 speed.windupCut: 속도 50~150 구간, 최대 60%, 17틱 아래로는 안 줄임)
  e.moves.forEach(m=>{if(m.st||m.p<=0||m.k==='self'||m.selfko||m.su<=17)return;
    m.su=Math.max(1,Math.round(m.su-.6*clamp((s[5]-50)/100,0,1)*(m.su-17)))});
  e.moves.forEach((m,i)=>{e.cdMax[i]=m.cd*(m.hasted?e.haste:1)});
  e.ch=[0,0,0,0];e.chT=[0,0,0,0];e.pp=[0,0,0,0];
  e.moves.forEach((m,i)=>{if(m.chg){m.chg.per*=(m.hasted?e.haste:1);e.ch[i]=m.chg.max;e.cdMax[i]=m.chg.per}e.pp[i]=m.ppMax});
  return e;
}
const foeOf=e=>e.side?W.me:W.foe;   // 6F-4b: 교대로 W.me가 바뀌어도 이미 나간 공격이 제 상대를 찾도록 side 기준
const spdOf=e=>{let v=e.spd*stageMul(e.stg.spe);if(e.ail.paralysis)v*=.6;return clamp(v,60,320)};

// ---------- 데미지 ----------
function floatTxt(x,y,t,col,big){W.fx.push({k:'txt',x,y,t:0,life:.9,s:t,c:col||'#fff',big:!!big})}
// 6E-3: 데미지 숫자(통통 튀며 떠오름) · 충격파 · 불꽃 · 화면 번쩍 · 반전 (sjdhdhbd.html 방식)
// 7D: 숫자 배율 — 진행(레벨·환생)에 따라 체력·데미지 숫자만 같이 커짐(승패 밸런스는 그대로). 1만↑ '만', 1억↑ '억'
function fmtN(v){v=Math.max(0,Math.round(v));if(v<1e5)return v.toLocaleString('en-US');if(v<1e8){const q=v/1e4;return (q<1e3?q.toFixed(q<100?1:0):Math.round(q).toLocaleString('en-US'))+'만'}const q=v/1e8;return (q<100?q.toFixed(2):Math.round(q).toLocaleString('en-US'))+'억'}
const kOf=e=>(e&&e.K)||1;

// ---------- 7H: 도트 데미지 스킨 (사용자가 준 PIXEL UNIT DAMAGE SKIN ENGINE 6종 · 억/만 배지 · 크리티컬 별) ----------
const PXG = { '0': [ "..1111..", ".11..11.", "11....11", "11...111", "11..1111", "11.11.11", "1111..11", "111...11", "11....11", ".11..11.", "..1111.." ], '1': [ "...111..", "..1111..", ".11.11..", "11..11..", "....11..", "....11..", "....11..", "....11..", "....11..", "....11..", ".1111111" ], '2': [ ".111111.", "11....11", "......11", "......11", ".....11.", "...111..", ".111....", "11......", "11......", "11....11", "11111111" ], '3': [ ".111111.", "11....11", "......11", "......11", "..11111.", "......11", "......11", "......11", "......11", "11....11", ".111111." ], '4': [ "....111.", "...1111.", "..11.11.", ".11..11.", "11...11.", "11...11.", "11111111", ".....11.", ".....11.", ".....11.", "....1111" ], '5': [ "11111111", "11......", "11......", "1111111.", "......11", "......11", "......11", "......11", "......11", "11....11", ".111111." ], '6': [ "..11111.", ".11...11", "11......", "11......", "1111111.", "11....11", "11....11", "11....11", "11....11", ".11..11.", "..1111.." ], '7': [ "11111111", "11....11", ".....11.", "....11..", "....11..", "...11...", "...11...", "..11....", "..11....", "..11....", "..11...." ], '8': [ ".111111.", "11....11", "11....11", "11....11", ".111111.", "11....11", "11....11", "11....11", "11....11", "11....11", ".111111." ], '9': [ "..1111..", ".11..11.", "11....11", "11....11", ".1111111", "......11", "......11", "......11", "......11", "11...11.", ".11111.." ], '억': [ ".1111..11.", "11..11.11.", "11..11.11.", "11..11111.", ".1111..11.", ".......11.", ".11111111.", ".......11.", ".......11.", ".......11.", ".......11." ], '만': [ "11111..11.", "11..11.11.", "11..11.111", "11..11.11.", "11111..11.", ".......11.", "..11......", "..11......", "..11......", "..11111111", "..11111111" ], 'CRIT_STAR': [ ".....1.....", "....111....", ".1..111..1.", "..1111111..", "...11111...", "11111111111", "...11111...", "..1111111..", ".1..111..1.", "....111....", ".....1....." ] };
const PXSK = [ { id: "maple_classic", name: "1. 메이플 오리지널", numTop: "#fff200", numMid: "#ff9f1a", numBot: "#ff3838", outline: "#1e0900", eokBg: "#ff1e42", eokTxt: "#ffffff", manBg: "#ff7f00", manTxt: "#ffffff", critColor: "#ffea00", critSpark: "#ff3838" }, { id: "sekiro_ink", name: "2. 불사베기 칠흑혈참", numTop: "#ff1e42", numMid: "#99001a", numBot: "#1a0206", outline: "#ff4d6d", eokBg: "#080103", eokTxt: "#ff1e42", manBg: "#2b040c", manTxt: "#ff8fa3", critColor: "#ff1e42", critSpark: "#ffffff" }, { id: "xenon_cyber", name: "3. 제논 플라즈마 블루", numTop: "#ffffff", numMid: "#00f0ff", numBot: "#0066ff", outline: "#00194d", eokBg: "#00f0ff", eokTxt: "#040814", manBg: "#0052d4", manTxt: "#ffffff", critColor: "#00f0ff", critSpark: "#ffffff" }, { id: "royal_gold", name: "4. 황제 르네상스 골드", numTop: "#ffffff", numMid: "#ffd700", numBot: "#d97706", outline: "#291500", eokBg: "#ffd700", eokTxt: "#1f0f00", manBg: "#f59e0b", manTxt: "#1f0f00", critColor: "#ffd700", critSpark: "#ffffff" }, { id: "emerald_dragon", name: "5. 청룡 비취 에메랄드", numTop: "#e0fff4", numMid: "#00ff9d", numBot: "#008f5a", outline: "#022417", eokBg: "#00ff9d", eokTxt: "#022417", manBg: "#059669", manTxt: "#ffffff", critColor: "#00ff9d", critSpark: "#ffd700" }, { id: "haki_purple", name: "6. 패왕색 흑섬 보라", numTop: "#f3e5f5", numMid: "#d500f9", numBot: "#651fff", outline: "#090014", eokBg: "#aa00ff", eokTxt: "#ffffff", manBg: "#4a0072", manTxt: "#ea80fc", critColor: "#ff1744", critSpark: "#d500f9" } ];
const PXC={};
function pxGlyph(ch,skin,unit){const key=skin.id+'_'+ch+'_'+(unit||'n');if(PXC[key])return PXC[key];const M=PXG[ch];if(!M)return null;const R=M.length,Cn=M[0].length,px=3,pad=6;
  const o=document.createElement('canvas');o.width=Cn*px+pad*2;o.height=R*px+pad*2;const g=o.getContext('2d');
  if(unit==='eok'||unit==='man'){g.fillStyle='#ffffff';g.fillRect(0,0,o.width,o.height);g.fillStyle=unit==='eok'?skin.eokBg:skin.manBg;g.fillRect(px,px,o.width-px*2,o.height-px*2)}
  else if(ch!=='CRIT_STAR'){g.fillStyle=skin.outline;for(let r=0;r<R;r++)for(let c=0;c<Cn;c++)if(M[r][c]==='1')g.fillRect(pad+c*px-px,pad+r*px-px,px*3,px*3)}
  for(let r=0;r<R;r++)for(let c=0;c<Cn;c++)if(M[r][c]==='1'){g.fillStyle=unit==='eok'?skin.eokTxt:unit==='man'?skin.manTxt:ch==='CRIT_STAR'?((r>=4&&r<=6&&c>=4&&c<=6)?'#ffffff':skin.critColor):r<=2?skin.numTop:r<=6?skin.numMid:skin.numBot;g.fillRect(pad+c*px,pad+r*px,px,px)}
  return PXC[key]=o}
// 7I: 숫자 짧게 — 10만 미만은 그대로(4만5678) · 10만~1억은 만까지(175만) · 1억~10억은 억+만(9억8765만) · 10억 이상은 억만(123억)
function pxTokens(num){const n=Math.floor(Math.max(1,num)),eok=Math.floor(n/1e8),man=n>=1e9?0:Math.floor(n%1e8/1e4),rest=n>=1e5?0:n%1e4,L=[];
  if(eok>0){String(eok).split('').forEach(ch=>L.push({ch,u:null}));L.push({ch:'억',u:'eok'})}
  if(man>0){String(man).split('').forEach(ch=>L.push({ch,u:null}));L.push({ch:'만',u:'man'})}
  if((rest>0&&n<1e5)||!L.length)String(rest||n).split('').forEach(ch=>L.push({ch,u:null}));return L}
function pxDraw(cx,f){const skin=PXSK[f.sk]||PXSK[0],u=f.t/f.life,ratio=1-u;let s;
  if(f.crit){s=u<.12?.6+u/.12*.78:u<.24?1.38-(u-.12)/.12*.38:1}else s=u<.1?.7+u/.1*.3:1;
  f.cs=(f.cs||0)+((f.ts||0)-(f.cs||0))*.24;
  cx.save();cx.imageSmoothingEnabled=false;cx.globalAlpha=ratio<.25?ratio/.25:1;const k=s*(f.fin?.6:.48);   /* 7H-2: 사용자 요청 — 숫자가 길어서 전체 크기를 60%로 */const sp=f.tk.map(t=>pxGlyph(t.ch,skin,t.u)).filter(Boolean),gap=2;const tw=sp.reduce((a,q)=>a+q.width+gap,-gap);
  const hw=(tw/2+(f.crit?40:4))*k,fx0=clamp(f.x,WALL+hw,AW-WALL-hw);   /* 경기장 밖으로 잘리지 않게 */
  cx.translate(Math.round(fx0),Math.round(f.y-u*40+f.cs));cx.scale(k,k);let dx=-Math.round(tw/2);
  if(f.crit){const st=pxGlyph('CRIT_STAR',skin),ss=Math.floor(f.t*60/4)%2===0?1.15:.9;cx.save();cx.translate(dx-24,0);cx.scale(ss,ss);cx.drawImage(st,-Math.round(st.width/2),-Math.round(st.height/2));cx.restore();
    cx.fillStyle=skin.outline;cx.fillRect(dx-4,-36,76,14);cx.fillStyle=skin.critColor;cx.font='900 11px monospace';cx.textAlign='left';cx.fillText('CRITICAL!',dx,-25)}
  for(const q of sp){cx.drawImage(q,dx,-Math.round(q.height/2));dx+=q.width+gap}
  cx.restore()}
function dmgPop(x,y,txt,col,fin,val,crit,sk){
  if(val!=null){for(const q of W.fx)if(q.k==='dmg'&&q.tk&&Math.abs(q.x-x)<160&&Math.abs(q.y-y)<140)q.ts=(q.ts||0)-28;   // 먼저 뜬 숫자는 위로 밀어 겹치지 않게
    W.fx.push({k:'dmg',x:x,y:y,t:0,life:.95,tk:pxTokens(val),crit:!!crit,sk:sk|0,fin:!!fin||!!crit,ts:0,cs:0});
    if(crit){const sk0=PXSK[sk|0]||PXSK[0];for(let i=0;i<14;i++){const a=i/14*Math.PI*2+rnd()*.3,v=180+rnd()*360;W.fx.push({k:'psq',x:x,y:y-35,vx:Math.cos(a)*v,vy:Math.sin(a)*v-90,z:rnd()>.5?6:4,c:i%2?sk0.critSpark:sk0.critColor,t:0,life:.4})}}
    return}
  W.fx.push({k:'dmg',x:x+(rnd()-.5)*56,y:y+(rnd()-.5)*24,t:0,life:fin?.95:.75,s:txt,c:col||'#fff',sc:fin?1.35:1})}
function hitFx(def,col,fin){
  W.fx.push({k:'shock',sys:1,x:def.x,y:def.y-20,t:0,life:fin?.34:.22,r:fin?120:70,c:fin?'#ffffff':col,w:fin?9:5});
  const n=fin?22:10,P=[];for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,v=(fin?170:110)*(.5+rnd()*.7);P.push({vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,z:(fin?5:3.5)*(.6+rnd()*.7)})}
  W.fx.push({k:'spk',sys:1,x:def.x,y:def.y-24,t:0,life:fin?.55:.4,c:col,P});
  W.shk=Math.max(W.shk||0,fin?20:9);W.flashA=Math.max(W.flashA||0,fin?.35:.14);W.flashC=col;
  if(fin)W.inv=3;
}
function dealDamage(att,def,mi,opt){
  opt=opt||{};
  if(def.hp<=0)return 0;
  const m=att.moves[mi]||opt.mi;
  if(def.hidden){return 0}
  if(def.protect>0){floatTxt(def.x,def.y-60,'막았다!','#9be7ff');W.fx.push({k:'ring',sys:1,x:def.x,y:def.y,t:0,life:.3,r:70,c:'#9be7ff'});return 0}
  if(def.rollT>0){
    const t=14-def.rollT; // 지난 틱 (0~13)
    if(t>=1&&t<=10){
      if(t<=4&&!def.perfect){def.perfect=1;def.rc=Math.min(2,def.rc+1);def.critWin=1;floatTxt(def.x,def.y-70,'완벽 회피!','#ffe14a',true);W.hitstop=Math.max(W.hitstop,.08)}
      return 0}
  }
  if(def.inv>0){return 0}
  if(def.gear&&def.gear.eva>0&&rnd()<Math.min(.5,def.gear.eva/100)){floatTxt(def.x,def.y-70,'회피!','#9be7ff');return 0}   // 8F 장비 회피
  const A=m.phys?att.st[1]:att.st[3], D=m.phys?def.st[2]:def.st[4];
  const Am=stageMul(m.phys?att.stg.atk:att.stg.spa), Dm=stageMul(m.phys?def.stg.def:def.stg.spd);
  const e=m.typeless?1:C.eff(m.type,def.types);
  const stab=att.types.includes(m.type)?1.5:1;
  const cx0=att.critX||{c:0,d:0};   // 7G: 크리티컬 확률·데미지 보너스(접두사·먹이 아이템·내 캐릭터 접두사)
  const crit=rnd()<(att.critWin>0?.5:1/24+cx0.c);
  let power=m.p*(opt.pm||1);
  let base=((2*att.lv/5+2)*power*(A*Am)/Math.max(1,D*Dm)/50+2);
  let dmg=base*.52*stab*e*(.85+rnd()*.15)*(crit?1.5*(1+cx0.d):1)*(m.melee&&m.phys?1.15:1)*(att.zb&&att.zb.on>0?1.3:1);   // 9F 만제 버프
  if(att.ail.burn&&m.phys)dmg*=.5;
  if(opt.mult)dmg*=opt.mult;
  if(att.gear&&att.gear.atk)dmg*=1+att.gear.atk/100;if(def.gear&&def.gear.def)dmg*=1-Math.min(.6,def.gear.def/100);   // 8F 장비 공격력·방어력
  if(C.dmgMul){try{dmg*=+C.dmgMul(att.mon,def.mon,m.id)||1}catch(er){}}   // 7D: 기술 레벨 +8%/레벨 · 난이도별 상대 데미지(예전 전투 DDMG)
  if(m.exec&&def.lv>att.lv)dmg*=.5;               // 즉사기: 상대 레벨이 높으면 절반
  let fixedDmg=null;
  if(m.fx){const f=m.fx;
    fixedDmg=f.mode==='flat'?(f.value||0):f.mode==='level'?att.lv:f.mode==='levelRandom'?Math.floor(att.lv*(.5+rnd())):
      f.mode==='fracTargetHp'?def.hp*(f.value||.5):f.mode==='userCurrentHp'?att.hp:f.mode==='targetHpMinusUserHp'?Math.max(0,def.hp-att.hp):
      f.mode==='leaveAtLeast1Hp'?Math.min(dmg,def.hp-1):null}
  if(fixedDmg!=null)dmg=fixedDmg;
  if(opt.fixed)dmg=opt.fixed;
  const capped=fixedDmg!=null||opt.fixed?dmg:Math.min(dmg,def.max*.6);
  const rawD=capped;dmg=Math.max(e===0?0:1,Math.round(capped));
  if(e===0)dmg=0;
  if(def.sh>0&&dmg>0){const a=Math.min(def.sh,dmg);def.sh-=a;dmg-=a;if(def.sh<=0){def.sh=0;floatTxt(def.x,def.y-115,'보호막 깨짐','#ffe9a0')}if(dmg<=0){floatTxt(def.x,def.y-70,'보호막!','#ffe9a0');def.flash=.08;return 0}}   // 9B 태초 보호막
  def.hp=Math.max(0,def.hp-dmg);
  if(def.hp<=0&&def.undying&&!def._ud){def._ud=1;def.hp=Math.round(def.max*.5);const s=def.aw>0?10+3*(def.aw-1):1;def.inv=Math.max(def.inv||0,Math.round(s*60));def.invMax=def.inv;cancelCast&&def.cast&&cancelCast(def,true);floatTxt(def.x,def.y-125,'불멸 부활!'+(def.aw>0?' 무적 '+s+'초':''),'#8fb4ff',true);W.hitstop=Math.max(W.hitstop||0,.15);try{W.fx.push({k:'ring',sys:1,x:def.x,y:def.y,t:0,life:.5,r:110,c:'#8fb4ff'})}catch(er){}}   // 9B 불멸: 한 번 버팀
  def.flash=.15;
  if(dmg>0){
    W._dp={dmg,raw:Math.max(rawD,dmg>0?1:0),e,crit,col:e>1?'#ffb030':crit?'#ffe14a':(C.TCOL[m.type]||'#fff')};
    if(e>1)floatTxt(def.x,def.y-95,'효과 굉장!','#ffb030');
    if(e<1&&e>0)floatTxt(def.x,def.y-95,'별로…','#9bb');
  } else floatTxt(def.x,def.y-70,'효과 없음','#9bb');
  if(att.critWin>0&&crit)att.critWin=0;
  // 다단 기술: 첫 타가 맞으면 나머지 타를 간격(근접 8틱·원거리 6틱)으로 이어서 침
  if(dmg>0&&m.hits>1&&!opt.chain&&!opt.mult&&m.mh&&!m.chg){const mh=m.mh;let n=m.hits;
    if(mh.n==null&&mh.min!=null){const dist=mh.dist||[.35,.35,.15,.15];let r=rnd(),i=0;for(;i<dist.length-1&&r>dist[i];i++)r-=dist[i];n=mh.min+i}
    if(n>1){W.chain.push({o:att,mi:att.moves.indexOf(m)>=0?mi:mi,n:n-1,t:m.melee?8:6,iv:m.melee?8:6,melee:m.melee});W._more=1}}
  // 6C-4 흡수(드레인): 준 데미지의 절반 회복 · 반동: 준 데미지의 일부(발버둥은 최대 체력 1/4)를 받음
  if(dmg>0&&att.hp>0)for(const f of (m.d.ef||[])){
    if(f.op==='drain'){const h=Math.min(att.max-att.hp,Math.max(1,Math.round(dmg*(f.frac||.5))));if(h>0){att.hp+=h;floatTxt(att.x,att.y-100,'+'+fmtN(h*kOf(att)),'#6f6')}}
    if(f.op==='recoil'){const rc=Math.max(1,Math.round(f.of==='max'?att.max*(f.frac||.25):dmg*(f.frac||.25)));att.hp=Math.max(0,att.hp-rc);floatTxt(att.x,att.y-100,'반동 '+fmtN(rc*kOf(att)),'#f88')}}
  // 자폭기: 쓰면 기절
  if(m.selfko&&att.hp>0&&!att._ko){att._ko=1;att.hp=0;floatTxt(att.x,att.y-90,'쓰러졌다','#f88')}
  // 6E-3: 마지막 타(또는 치명타·효과 굉장)는 크게, 중간 타는 작게
  const fin=(opt.chain?!!opt.last:!W._more)||crit||e>1;W._more=0;
  if(dmg>0&&W._dp){const q=W._dp;W._dp=null;
    {let sk=0;try{sk=C.dmgSkin?C.dmgSkin(att.mon,m.id)|0:0}catch(er){}dmgPop(def.x,def.y-62,null,q.col,fin,Math.max(1,Math.round((fixedDmg!=null||opt.fixed?q.dmg:q.raw)*kOf(def))),crit,sk)}
    hitFx(def,C.TCOL[m.type]||'#fff',fin);
    W.hitstop=Math.max(W.hitstop,fin?Math.max(HSTOP[m.g],.1):HSTOP[m.g]*.6)}
  else W.hitstop=Math.max(W.hitstop,HSTOP[m.g]);
  if(dmg>0){fxShake(m.g);if(!opt.chain&&(m.k==='melee'||m.k==='roll'||m.k==='target'||m.k==='vanish'))skillFx(att,m,{x:att.x,y:att.y},{x:def.x,y:def.y})}
  // 경직·넉백·끊기
  const dirv=norm(def.x-att.x,def.y-att.y);
  const kb=KB[m.g]*(def.r>SIZE.kbRef?Math.max(SIZE.kbMin,Math.pow(SIZE.kbRef/def.r,SIZE.kbExp)):1);   // 6C-4 큰 몸은 덜 밀림(원본 knockbackResist)
  const rampArmor=def.cast&&(def.cast.mv.ramp||def.cast.ramp)&&m.g<=RAMP.armor;   // 6C-4 연속기 중엔 M급 이하 공격에 안 끊김
  const interrupt=!rampArmor&&def.cast&&def.cast.phase==='startup'&&(def.cast.mv.g>=3?m.g>=2:m.g>=1);
  const buffBreak=def.cast&&def.cast.mv.k==='self'&&def.cast.phase==='startup'&&m.g>=1;
  const beamBreak=def.cast&&def.cast.mv.k==='beam'&&def.cast.phase==='active'&&m.g>=2;
  const dc=def.cast;
  if(dc&&dc.phase==='startup'&&!interrupt&&!buffBreak){def.kx+=dirv.x*kb*2;def.ky+=dirv.y*kb*2}   // 버팀: 끊기지 않고 조금만 밀림
  else if(dc&&dc.phase==='active'&&dc.mv.k==='beam'&&!beamBreak){def.kx+=dirv.x*kb;def.ky+=dirv.y*kb}
  else if(rampArmor){def.kx+=dirv.x*kb;def.ky+=dirv.y*kb}
  else{
    if(dc)cancelCast(def,!!(interrupt||buffBreak||beamBreak));
    def.stun=Math.max(def.stun,STUN[m.g]);
    def.kx+=dirv.x*kb*8;def.ky+=dirv.y*kb*8;
  }
  def.sleepWake=1; if(def.ail.sleep){delete def.ail.sleep}
  if(att.counterT>0)att.counterT=0;
  // 부가효과
  if(dmg>0&&m.d.ef)applyEf(att,def,m,true);
  W.fx.push({k:'burst',x:def.x,y:def.y-20,t:0,life:.25,r:30+m.g*14,c:C.TCOL[m.type]||'#fff'});
  return dmg;
}
function cancelCast(e,hurt){
  if(!e.cast)return;
  const i=e.cast.mi;
  if(hurt&&i>=0&&!(e.cast.mv&&e.cast.mv.chg))e.cd[i]=e.cdMax[i]*.5;
  if(e.ramp){e.ramp=null}   // 연속기가 끊기면 혼란 없이 끝
  e.cast=null;e.beam=null;e.hidden=false;
}
// 6C-4 PP: 모든 기술 PP가 0이면 첫 칸이 발버둥(위력 40·쿨 2.5초·무속성·최대 체력 1/4 반동)
function ppOut(e,i){floatTxt(e.x,e.y-120,e.moves[i].name+' PP 없음','#f88');
  if(e.moves.every((m,j)=>!m||(m.ppMax>0&&e.pp[j]<=0))){e.moves[0]=moveInfo('struggle');e.cdMax[0]=2.5;e.cd[0]=Math.max(e.cd[0],.5);e.pp[0]=0;e.ch[0]=0;
    floatTxt(e.x,e.y-140,'발버둥!','#ffd23f');if(e===W.me)setTimeout(()=>{try{setMoveBtns()}catch(er){}},0)}}
function addStage(e,k,n){e.stg[k]=clamp(e.stg[k]+n,-3,3);e.stgT=8;floatTxt(e.x,e.y-90,({atk:'공격',def:'방어',spa:'특공',spd:'특방',spe:'스피드'}[k]||k)+(n>0?' ▲':' ▼'),n>0?'#8f8':'#f88')}
function setAil(def,s,chance){
  if(chance!=null&&rnd()*100>=chance)return;
  const T={burn:8,poison:8,toxic:12,paralysis:6,sleep:2.5,freeze:2,confusion:3,flinch:0};
  if(!(s in T))return;
  const IMM={burn:'FIRE',poison:'POISON',toxic:'POISON',paralysis:'ELECTRIC',freeze:'ICE'};
  if(IMM[s]&&def.types.includes(IMM[s]))return;
  if(s==='toxic')s='poison';
  if(s==='flinch'){def.stun=Math.max(def.stun,10);return}
  if(def.ail[s]!=null||def.ailImm&&def.ailImm[s]>0)return;
  def.ail[s]=T[s]==null?3:T[s];
  floatTxt(def.x,def.y-110,({burn:'화상',poison:'독',paralysis:'마비',sleep:'잠듦',freeze:'얼음',confusion:'혼란'})[s]||s,'#f9a');
  if(s==='sleep'||s==='freeze'){def.stun=Math.max(def.stun,Math.round(T[s]*60));cancelCast(def,false)}
}
function applyEf(att,def,m,hit){
  for(const f of (m.d.ef||[])){
    if(f.op==='status'&&hit&&m.k!=='self'){
      const ss=String(f.s||'').split('|');setAil(def,ss[Math.floor(rnd()*ss.length)],f.chance==null?100:f.chance)}
    else if(f.op==='stat'){
      const who=f.who==='user'?att:def;
      if(f.who!=='user'&&!hit)continue;
      if(f.chance!=null&&rnd()*100>=f.chance)continue;
      for(const k in f.stages)addStage(who,k,f.stages[k]);
    }
    else if(f.op==='heal'&&f.who==='user'){att.hp=Math.min(att.max,att.hp+Math.round(att.max*(f.frac||.5)));floatTxt(att.x,att.y-90,'회복','#8f8')}
    else if(f.op==='drain'&&hit){}
    else if(f.op==='recoil'&&hit){}
  }
}

// ---------- 기술 사용 ----------
function canCast(e,i){
  const m=e.moves[i];
  if(m&&m.ppMax>0&&e.pp&&e.pp[i]<=0)return false;   // PP 다 씀
  return m&&(m.chg?e.ch[i]>=1:e.cd[i]<=0)&&!e.cast&&e.stun<=0&&e.rollT<=0&&!(e.swapT>0)&&e.hp>0&&!e.ail.sleep&&!e.ail.freeze&&!W.over;
}
function startCast(e,i,aimDir,dist){
  const m=e.moves[i];
  const cast={mi:i,mv:m,phase:'startup',t:0,su:m.su,aim:Math.atan2(aimDir.y,aimDir.x),want:Math.atan2(aimDir.y,aimDir.x),dist:dist};
  e.cast=cast;
  if(m.chg){if(e.ch[i]>=m.chg.max)e.chT[i]=m.chg.per;e.ch[i]=Math.max(0,e.ch[i]-1);e.cd[i]=e.ch[i]>=1?0:e.chT[i]}
  else e.cd[i]=e.cdMax[i]*(m.ramp?RAMP.cdMul:1); // 쏘는 순간부터 쿨타임 (연속기는 ×2)
  if(m.ppMax>0&&e.pp){e.pp[i]=Math.max(0,e.pp[i]-1);if(e.pp[i]<=0)ppOut(e,i)}
  if(!e.side&&C.onUse){try{const up=C.onUse(e.mon,m.id);if(up)floatTxt(e.x,e.y-130,'⬆ '+m.name+' Lv.'+up,'#ffd23f',true)}catch(er){}}   // 7G 기술 레벨 올리기
  if(m.ramp){cast.pm=RAMP.powerMul;e.ramp={mi:i,left:(RAMP.min-1)+(rnd()<.5?1:0)}}   // 연속기: 2~3번, 한 번 위력 ×0.75
  e.anim=m.melee?'attack':'shoot';e.at=0;
  W.fx.push({k:'callout',x:e.x,y:e.y-120,t:0,life:.9,s:m.name,c:C.TCOL[m.type]||'#fff'});
}
function phaseTo(e,ph,ticks){e.cast.phase=ph;e.cast.t=0;e.cast.len=ticks}
function castMoveMul(e){
  if(!e.cast)return 1;
  const c=e.cast,g=c.mv.g;
  if(c.phase==='startup')return WALK_ST[g];
  if(c.phase==='recovery')return c.rooted?0:REC_MV[g];
  if(c.mv.k==='beam')return .6;
  if(c.mv.k==='vanish')return 0;
  return 0;
}
function updateCast(e){
  const c=e.cast;if(!c)return;
  const m=c.mv,g=m.g,tgt=foeOf(e);
  c.t++;
  if(c.phase==='startup'){
    // 조준 잠금 전까지 회전
    if(c.t<=LOCK[g]){
      const d=angDiff(c.aim,c.want),st=TURN[g]*Math.PI/180*TICK;c.aim+=clamp(d,-st,st)}
    if(c.t>=c.su){fire(e,c)}
  } else if(c.phase==='active'){
    activeTick(e,c,tgt);
  } else if(c.phase==='recovery'){
    if(c.t>=c.len){e.cast=null;e.anim='idle';rampNext(e)}
  }
}
// 6C-4 연속기: 다음 타를 짧은 준비(6틱)로 상대 쪽에 자동으로 이어서 침 · 다 치면 3초 혼란
function rampNext(e){const r=e.ramp;if(!r)return;
  if(r.left>0&&e.hp>0&&e.stun<=0&&foeOf(e).hp>0&&!W.over){r.left--;const m=e.moves[r.mi];if(!m){e.ramp=null;return}const t=foeOf(e),a=Math.atan2(t.y-e.y,t.x-e.x);
    e.cast={mi:r.mi,mv:m,phase:'startup',t:0,su:RAMP.followT,aim:a,want:a,pm:RAMP.powerMul,ramp:1};e.anim='attack';e.at=0;return}
  e.ramp=null;if(e.hp>0&&!e.ail.confusion){e.ail.confusion=RAMP.confuseSec;floatTxt(e.x,e.y-110,'지쳐서 혼란','#f9a')}}
function toRecovery(e,c){phaseTo(e,'recovery',c.mv.rech?150:(e.ramp&&e.ramp.left>0)?RAMP.gapT:REC[c.mv.g]);c.rooted=!!c.mv.rech;e.anim='idle'}
function aimVec(c){return{x:Math.cos(c.aim),y:Math.sin(c.aim)}}
function circleHit(e,c,cx,cy,rad,tgt,opt){
  if(tgt.hp<=0)return false;
  if(len(tgt.x-cx,tgt.y-cy)<=rad*1.15+tgt.r*1.1){dealDamage(e,tgt,c.mi,opt);return true}
  return false;
}
function fire(e,c){
  const m=c.mv,k=m.k,g=m.g,u=aimVec(c),tgt=foeOf(e),heavy=m.p>=110;
  c.hit=false;
  e.face={x:u.x,y:u.y};e.row=dirRow(u.x,u.y);
  if(m.st||k==='self'){
    // 변화기술
    const ef=m.d.ef||[];const names=ef.map(x=>x.op).join(',');
    if(k==='self'){
      if(/guard/.test(names)){e.protect=36/60;floatTxt(e.x,e.y-90,'방어!','#9be7ff')}
      for(const f of ef){
        if(f.op==='stat'&&(f.who==='user'||!f.who))for(const s in f.stages)addStage(e,s,f.stages[s]);
        if(f.op==='heal'&&f.who==='user'){const fr=e.healRep>0?.25:.5;e.hp=Math.min(e.max,e.hp+Math.round(e.max*fr));e.healRep=30;floatTxt(e.x,e.y-90,'회복','#8f8')}
        if(f.op==='stat'&&f.who==='target'&&m.d.tg!=='User'){for(const s in f.stages)addStage(tgt,s,f.stages[s])}
        if(f.op==='counter'){e.counterT=1.7}
      }
      W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.5,r:60,c:C.TCOL[m.type]||'#fff'});skillFx(e,m,{x:e.x,y:e.y},{x:e.x,y:e.y},{force:1});
      c.phase='active';c.t=0;c.len=1;toRecovery(e,c);return;
    }
  }
  if(k==='melee'){
    c.dash=120*(heavy?1.5:1);c.moved=0;c.len=Math.max(ACTIVE_MELEE[g],8);phaseTo(e,'active',c.len);c.dir=u;c.reach=(70+(heavy?20:0)+10)*szMul(e,1);c.half=(heavy?65:50)*Math.PI/180;
    W.fx.push({k:'slash',x:e.x,y:e.y,t:0,life:.25,a:c.aim,c:C.TCOL[m.type]||'#fff',r:c.reach+e.r});
  } else if(k==='leap'){
    let d=c.dist!=null?clamp(c.dist,30,175):tgt.hp>0?clamp(len(tgt.x-e.x,tgt.y-e.y),30,175):105;
    c.tx=e.x+u.x*d;c.ty=e.y+u.y*d;c.sx=e.x;c.sy=e.y;phaseTo(e,'active',20);
  } else if(k==='roll'){
    phaseTo(e,'active',180);c.spd=350;c.hitCd=0;c.dir=u;
  } else if(k==='vanish'){
    const T=clamp(.35+m.p/120,.35,1.6);phaseTo(e,'active',Math.round(T*60));e.hidden=true;c.dir=u;
  } else if(k==='projectile'){
    const special=!m.phys;
    const nF=Math.max(1,m.d.fan|0);   // 7F: fan=여러 발을 부채꼴로 한 번에(한 발 위력은 나눔)
    for(let fj=0;fj<nF;fj++){const fa=c.aim+(fj-(nF-1)/2)*.22,fu={x:Math.cos(fa),y:Math.sin(fa)};
    W.proj.push({o:e,mi:c.mi,pm:nF>1?1.6/nF:0,x:e.x+fu.x*e.r,y:e.y+fu.y*e.r,dx:fu.x,dy:fu.y,sp:(special?480:430)*(m.d.sb==='bolt'?1.1:/^homing/.test(m.d.sb||'')?.85:1),r:(m.st?16:heavy?20:13)*(m.d.sb==='bolt'?1.25:1)*szMul(e,0),range:690,tr:0,col:C.TCOL[m.type]||'#fff',st:m.st,
      hm:/^homing/.test(m.d.sb||'')?60:0});
    {const P=W.proj[W.proj.length-1];P.fxa=projSkin(P,m)}}
    toRecovery(e,c);
  } else if(k==='beam'){
    const T=clamp(m.p/150,1.1,1.8);phaseTo(e,'active',Math.round(T*60));c.L=0;c.maxL=clamp(360+m.p*1.5,360,690);
    c.dmgMul=Math.min(1,12/(T*60))*1.25;
    {const bl=c.maxL*.85;skillFx(e,m,{x:e.x,y:e.y},{x:clamp(e.x+u.x*bl,WALL,AW-WALL),y:clamp(e.y+u.y*bl,WALL,AH-WALL)},{force:1})}
  } else if(k==='pulse'){
    const cone=m.kd==='cone';const R=205*szMul(e,0);
    W.fx.push({k:cone?'cone':'ring',x:e.x,y:e.y,a:c.aim,t:0,life:.35,r:R,c:C.TCOL[m.type]||'#fff'});
    skillFx(e,m,{x:e.x,y:e.y},cone?{x:e.x+u.x*R*.6,y:e.y+u.y*R*.6}:{x:e.x,y:e.y},{force:1});
    let hit=false;
    if(tgt.hp>0){
      const dx=tgt.x-e.x,dy=tgt.y-e.y,d=len(dx,dy);
      if(d<=R+tgt.r){
        if(!cone||Math.abs(angDiff(c.aim,Math.atan2(dy,dx)))<=75*Math.PI/180||d<e.r+tgt.r+28){hit=true;dealDamage(e,tgt,c.mi)}}}
    if(hit&&m.st)applyEf(e,tgt,m,true);
    toRecovery(e,c);
  } else if(k==='zone'){
    const d=c.dist!=null?clamp(c.dist,40,230):Math.min(230,tgt.hp>0?len(tgt.x-e.x,tgt.y-e.y):230);
    W.zones=W.zones.filter(z=>z.o!==e||false);
    W.zones.push({o:e,mi:c.mi,x:clamp(e.x+u.x*d,WALL,AW-WALL),y:clamp(e.y+u.y*d,WALL,AH-WALL),r:62,life:25,tick:1.5,col:C.TCOL[m.type]||'#fff',st:m.st});
    {const z=W.zones[W.zones.length-1];skillFx(e,m,{x:e.x,y:e.y},{x:z.x,y:z.y},{force:1})}
    toRecovery(e,c);
  } else if(k==='delayed'){
    W.delays.push({o:e,mi:c.mi,x:tgt.x,y:tgt.y,t:2.2,r:58,col:C.TCOL[m.type]||'#fff',lock:false,tgt});
    toRecovery(e,c);
  } else if(k==='target'){
    if(tgt.hp>0&&len(tgt.x-e.x,tgt.y-e.y)<=550+tgt.r){
      W.fx.push({k:'beamline',x:e.x,y:e.y,x2:tgt.x,y2:tgt.y,t:0,life:.25,c:C.TCOL[m.type]||'#fff'});
      skillFx(e,m,{x:e.x,y:e.y},{x:tgt.x,y:tgt.y},{force:1});
      dealDamage(e,tgt,c.mi);if(m.st)applyEf(e,tgt,m,true)}
    toRecovery(e,c);
  } else {toRecovery(e,c)}
}
function activeTick(e,c,tgt){
  const m=c.mv,k=m.k;
  if(k==='melee'){
    const step=c.dash/c.len;
    const nx=e.x+c.dir.x*step,ny=e.y+c.dir.y*step;
    e.x=nx;e.y=ny;
    if(!c.hit&&tgt.hp>0){
      const dx=tgt.x-e.x,dy=tgt.y-e.y,d=len(dx,dy);
      if(d<=c.reach*1.2+tgt.r*1.1&&(Math.abs(angDiff(c.aim,Math.atan2(dy,dx)))<=c.half+.3||d<e.r+tgt.r+30)){
        c.hit=true;dealDamage(e,tgt,c.mi,c.pm?{pm:c.pm}:undefined);if(m.st)applyEf(e,tgt,m,true)}}
    if(c.t>=c.len)toRecovery(e,c);
  } else if(k==='leap'){
    const p=c.t/20;e.x=c.sx+(c.tx-c.sx)*p;e.y=c.sy+(c.ty-c.sy)*p;e.lift=Math.sin(p*Math.PI)*48;
    if(c.t>=20){e.lift=0;W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,r:34+e.r,c:C.TCOL[m.type]||'#fff'});skillFx(e,m,{x:e.x,y:e.y},{x:e.x,y:e.y},{force:1});circleHit(e,c,e.x,e.y,34+e.r*.3,tgt);toRecovery(e,c)}
  } else if(k==='roll'){
    c.spd=Math.min(700,350*(1+Math.floor(c.t/22)*.14));
    if(tgt.hp>0){const dd=norm(tgt.x-e.x,tgt.y-e.y);const a=Math.atan2(c.dir.y,c.dir.x),b=Math.atan2(dd.y,dd.x);const na=a+clamp(angDiff(a,b),-3*TICK,3*TICK);c.dir={x:Math.cos(na),y:Math.sin(na)}}
    e.x+=c.dir.x*c.spd*TICK;e.y+=c.dir.y*c.spd*TICK;e.row=dirRow(c.dir.x,c.dir.y);
    c.hitCd--;
    if(c.hitCd<=0&&tgt.hp>0&&len(tgt.x-e.x,tgt.y-e.y)<=e.r+tgt.r+22){c.hitCd=33;let pm=1;if(m.rollUp){const rc=e.rollCh&&W.time-e.rollCh.t<6&&e.rollCh.id===m.id?e.rollCh.n+1:0;e.rollCh={n:rc,t:W.time,id:m.id};pm=Math.min(m.rollUp,Math.pow(2,rc))}   // 6초 안에 또 맞히면 계속 2배(최대 8배)
    dealDamage(e,tgt,c.mi,{pm});if(m.rollUp&&pm>1)floatTxt(e.x,e.y-100,'위력 ×'+pm,'#ffd23f')}
    if(m.rollUp){   // 6C-4 구르기·아이스볼: 벽에 튕기며 3초 동안 계속 굴러서 여러 번 맞힘(맞힐 때마다 위력 2배)
      if(e.x<WALL+e.r||e.x>AW-WALL-e.r){c.dir={x:-c.dir.x,y:c.dir.y};e.x=clamp(e.x,WALL+e.r,AW-WALL-e.r)}
      if(e.y<WALL+e.r||e.y>AH-WALL-e.r){c.dir={x:c.dir.x,y:-c.dir.y};e.y=clamp(e.y,WALL+e.r,AH-WALL-e.r)}}
    else if(e.x<WALL+e.r||e.x>AW-WALL-e.r||e.y<WALL+e.r||e.y>AH-WALL-e.r)c.t=Math.max(c.t,c.len-1);
    if(c.t>=c.len)toRecovery(e,c);
  } else if(k==='vanish'){
    if(tgt.hp>0){const dd=norm(tgt.x-e.x,tgt.y-e.y);e.x+=dd.x*spdOf(e)*2*TICK;e.y+=dd.y*spdOf(e)*2*TICK}
    if(c.t>=c.len){e.hidden=false;W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,r:56,c:C.TCOL[m.type]||'#fff'});circleHit(e,c,e.x,e.y,56,tgt);toRecovery(e,c);c.len=18}
  } else if(k==='beam'){
    // 천천히 조준 회전
    if(tgt.hp>0){const want=Math.atan2(tgt.y-e.y,tgt.x-e.x);c.aim+=clamp(angDiff(c.aim,want),-1.1*TICK,1.1*TICK)}
    c.L=Math.min(c.maxL,c.L+1100*TICK);
    e.row=dirRow(Math.cos(c.aim),Math.sin(c.aim));
    e.beam={a:c.aim,L:c.L,col:C.TCOL[m.type]||'#fff'};
    if(c.t%12===0&&tgt.hp>0){
      const u=aimVec(c);const dx=tgt.x-e.x,dy=tgt.y-e.y;const al=dx*u.x+dy*u.y,pe=Math.abs(-dx*u.y+dy*u.x);
      if(al>=0&&al<=c.L+tgt.r&&pe<=tgt.r*1.1+32*szMul(e,0)){dealDamage(e,tgt,c.mi,{mult:c.dmgMul||.25,pm:1})}}
    if(c.t>=c.len){e.beam=null;toRecovery(e,c)}
  } else {toRecovery(e,c)}
}

// ---------- 진행 ----------
function update(){
  const me=W.me,foe=W.foe;
  W.tick++;
  if(W.hitstop>0){W.hitstop-=TICK;return}
  W.time+=TICK;
  if(W.swCd>0)W.swCd=Math.max(0,W.swCd-TICK);   // 6F-4b: 교체 쿨타임
  if(W.itCd>0)W.itCd=Math.max(0,W.itCd-TICK);   // 6F-4c: 약 쿨타임
  if(autoNow())autoMe(me,foe);else playerInput(me);
  updBall();
  aiUpdate(foe,W.ai,me);
  for(const e of [me,foe]){
    if(e.hp<=0)continue;
    e.at+=TICK;
    e.flash=Math.max(0,e.flash-TICK);e.critWin=Math.max(0,e.critWin-TICK);e.protect=Math.max(0,e.protect-TICK);e.counterT=Math.max(0,(e.counterT||0)-TICK);
    e.healRep=Math.max(0,(e.healRep||0)-TICK);
    if(e.inv>0)e.inv--;   // 9F: 무적 시간 줄어듦(전엔 안 줄어서 불멸 뒤 계속 무적이던 버그)
    e.life+=TICK;
    if(e.cloneDur>0&&!e.cloneUsed&&e.life>1){e.cloneUsed=1;W.clones.push({o:e,t:e.cloneDur,t0:e.cloneDur,cd:.6,ang:rnd()*6,x:e.x,y:e.y});floatTxt(e.x,e.y-115,'분신 소환! '+e.cloneDur+'초','#ffe14a',true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.45,r:100,c:'#ffe14a'})}
    if(e.zb){if(e.zb.on>0)e.zb.on=Math.max(0,e.zb.on-TICK);e.zb.cd-=TICK;if(e.zb.cd<=0){e.zb.on=20;e.zb.cd=e.zb.cdMax;floatTxt(e.x,e.y-120,'만제의 위엄! 데미지 +30%','#ff4060',true);W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.5,r:120,c:'#ff2040'})}}
    if(e.swapT>0)e.swapT--;   // 6F-4b: 교체 직후 잠깐 무방비(행동 불가, 무적 아님)
    {const dm=e.moves.map((m,j)=>m&&!m.st?j:-1).filter(j=>j>=0);
     const allCool=dm.length>0&&dm.every(j=>e.cd[j]>0); // 공격기가 전부 쿨타임 중이면 빨리 돈다
     for(let i=0;i<4;i++){const m=e.moves[i];const r=(e.ail.paralysis?CD.paraRate:1)*(allCool&&m&&!m.st?CD.cadence:1);
       if(m&&m.chg){if(e.ch[i]<m.chg.max){e.chT[i]-=TICK*r;if(e.chT[i]<=0){e.ch[i]++;e.chT[i]=e.ch[i]<m.chg.max?m.chg.per:0}}e.cd[i]=e.ch[i]>=1?0:Math.max(0,e.chT[i])}
       else e.cd[i]=Math.max(0,e.cd[i]-TICK*r)}}
    // 구르기 충전
    if(e.rc<2)e.rc=Math.min(2,e.rc+TICK/3.2);
    // 상태이상
    for(const s in e.ail){e.ail[s]-=TICK;
      if(s==='burn'&&W.tick%60===0){const d=Math.max(1,Math.round(e.max*.01));e.hp=Math.max(0,e.hp-d);floatTxt(e.x,e.y-60,fmtN(d*kOf(e)),'#f84')}
      if(s==='poison'&&W.tick%60===0){const d=Math.max(1,Math.round(e.max*.015));e.hp=Math.max(0,e.hp-d);floatTxt(e.x,e.y-60,fmtN(d*kOf(e)),'#c6c')}
      if(e.ail[s]<=0){delete e.ail[s];e.ailImm=e.ailImm||{};if(s==='burn')e.ailImm.burn=6;if(s==='paralysis')e.ailImm.paralysis=8}}
    if(e.ailImm)for(const s in e.ailImm)e.ailImm[s]-=TICK;
    if(e.stgT>0){e.stgT-=TICK;if(e.stgT<=0){for(const k in e.stg)e.stg[k]-=Math.sign(e.stg[k]);e.stgT=8}}
    // 구르기
    if(e.rollT>0){e.rollT--;e.x+=e.rdx*(150/14);e.y+=e.rdy*(150/14);if(e.rollT===0)e.perfect=0;e.anim='walk'}
    else{
      if(e.stun>0){e.stun--;e.anim='hurt';if(e.stun===0)e.anim='idle'}
      else{
        if(e.cast)updateCast(e);
        else tryBuffered(e);
      }
    }
    // 이동 (입력 속도)
    if(e.rollT<=0&&e.stun<=0&&!(e.swapT>0)&&!(e.cast&&e.cast.phase==='active'&&e.cast.mv.k!=='beam')){
      const mul=castMoveMul(e);
      const target=e.wish||{x:0,y:0};
      const sp=spdOf(e)*mul;
      const tx=target.x*sp,ty=target.y*sp;
      const ax=(Math.abs(tx)>Math.abs(e.vx)||Math.sign(tx)!==Math.sign(e.vx)&&tx!==0)?2600:3500;
      e.vx+=clamp(tx-e.vx,-ax*TICK,ax*TICK);e.vy+=clamp(ty-e.vy,-ax*TICK,ax*TICK);
      e.x+=e.vx*TICK;e.y+=e.vy*TICK;
      if(!e.cast&&len(e.vx,e.vy)>20){e.anim='walk';e.row=dirRow(e.vx,e.vy)}
      else if(!e.cast&&e.stun<=0)e.anim='idle';
    }
    // 넉백
    e.x+=e.kx*TICK;e.y+=e.ky*TICK;const dec=Math.exp(-8*TICK);e.kx*=dec;e.ky*=dec;
    // 혼란/자해는 생략
  }
  // 몸 겹침 밀어내기
  if(me.hp>0&&foe.hp>0&&!me.hidden&&!foe.hidden&&!(me.cast&&me.cast.mv.k==='roll'||foe.cast&&foe.cast.mv.k==='roll')){
    const dx=foe.x-me.x,dy=foe.y-me.y,d=len(dx,dy)||1,ov=me.r+foe.r-d;
    if(ov>0&&me.rollT<=0&&foe.rollT<=0){const n=norm(dx,dy);const push=Math.min(190*TICK,ov/2+1);me.x-=n.x*push;me.y-=n.y*push;foe.x+=n.x*push;foe.y+=n.y*push}
  }
  for(const e of [me,foe]){e.x=clamp(e.x,WALL+e.r*.5,AW-WALL-e.r*.5);e.y=clamp(e.y,WALL+e.r*.5,AH-WALL-e.r*.5)}
  // 발사체
  for(const p of W.proj){
    const tgt=foeOf(p.o);
    if(p.hm>0&&tgt.hp>0){p.hm--;const a=Math.atan2(p.dy,p.dx),w=angDiff(a,Math.atan2(tgt.y-p.y,tgt.x-p.x)),mx=200*Math.PI/180*TICK,na=a+clamp(w,-mx,mx);p.dx=Math.cos(na);p.dy=Math.sin(na)}  // 유도: 초당 200도, 1초
    const st=p.sp*TICK;p.x+=p.dx*st;p.y+=p.dy*st;p.tr+=st;
    if(p.fxa){p.fxa.x=p.x;p.fxa.y=p.y-24;p.fxa.rot=Math.atan2(p.dy,p.dx)}
    if(tgt.hp>0&&len(tgt.x-p.x,tgt.y-p.y)<=p.r*1.3+tgt.r*1.05){   // 9E 판정 넓힘
      const d=dealDamage(p.o,tgt,p.mi,p.pm?{pm:p.pm}:undefined);if(p.st)applyEf(p.o,tgt,p.o.moves[p.mi],true);
      p.dead=1;W.fx.push({k:'burst',x:p.x,y:p.y,t:0,life:.25,r:p.r*2.2,c:p.col});skillFx(p.o,p.o.moves[p.mi],{x:p.x,y:p.y},{x:p.x,y:p.y},{force:1});
    } else if(p.tr>p.range||p.x<WALL||p.x>AW-WALL||p.y<WALL||p.y>AH-WALL){p.dead=1;W.fx.push({k:'burst',x:p.x,y:p.y,t:0,life:.2,r:p.r*1.5,c:p.col})}
  }
  // 9F 태초 분신: 주인 옆을 돌며 가장 센 기술을 60% 위력으로 쏨 (주인이 나가거나 쓰러지면 사라짐)
  for(const c of W.clones){c.t-=TICK;const o=c.o;if(o.hp<=0||(o!==W.me&&o!==W.foe)){c.t=0;continue}
    const tg=foeOf(o);c.ang+=TICK*1.3;const tx=o.x+Math.cos(c.ang)*95,ty=o.y+Math.sin(c.ang)*55;c.x+=(tx-c.x)*.12;c.y+=(ty-c.y)*.12;
    c.cd-=TICK;if(c.cd<=0&&tg.hp>0&&!tg.hidden){c.cd=1.3;let mi=-1,bp=0;o.moves.forEach((m,j)=>{if(m&&!m.st&&(m.p||0)>bp){bp=m.p;mi=j}});
      if(mi>=0){const n=norm(tg.x-c.x,tg.y-c.y);W.proj.push({o,mi,pm:.6,x:c.x,y:c.y,dx:n.x,dy:n.y,sp:540,r:15,range:900,tr:0,col:C.TCOL[o.moves[mi].type]||'#ffe14a',st:0,clone:1})}}}
  W.clones=W.clones.filter(c=>c.t>0);
  // 발사체끼리 충돌 (반지름 비 1.5 이상이면 큰 쪽이 압도, 아니면 상쇄)
  for(let i=0;i<W.proj.length;i++)for(let j=i+1;j<W.proj.length;j++){
    const a=W.proj[i],b=W.proj[j];if(a.dead||b.dead||a.o===b.o)continue;
    if(len(a.x-b.x,a.y-b.y)<=a.r+b.r){const ra=a.r/b.r;if(ra>=1.5)b.dead=1;else if(ra<=1/1.5)a.dead=1;else{a.dead=b.dead=1}
      W.fx.push({k:'burst',x:(a.x+b.x)/2,y:(a.y+b.y)/2,t:0,life:.25,r:30,c:'#fff'})}
  }
  W.proj=W.proj.filter(p=>{if(p.dead&&p.fxa){try{C.fxe.VFX.stop(p.fxa)}catch(e){}}return !p.dead});
  // 장판
  for(const z of W.zones){z.life-=TICK;z.tick-=TICK;
    if(z.tick<=0){z.tick=1.5;const t=foeOf(z.o);if(t.hp>0&&len(t.x-z.x,t.y-z.y)<=z.r*1.1+t.r*.9&&!t.hidden){const d=Math.max(1,Math.round(t.max*.0625));t.hp=Math.max(0,t.hp-d);floatTxt(t.x,t.y-70,fmtN(d*kOf(t)),z.col);if(z.st)applyEf(z.o,t,z.o.moves[z.mi],true)}}}
  W.zones=W.zones.filter(z=>z.life>0);
  // 내려찍기
  for(const d of W.delays){d.t-=TICK;
    if(d.t>.5&&d.tgt.hp>0){d.x=d.tgt.x;d.y=d.tgt.y}
    if(d.t<=0){d.dead=1;W.fx.push({k:'ring',x:d.x,y:d.y,t:0,life:.35,r:d.r,c:d.col});skillFx(d.o,d.o.moves[d.mi],{x:d.x,y:d.y},{x:d.x,y:d.y},{force:1});const t=foeOf(d.o);if(t.hp>0&&len(t.x-d.x,t.y-d.y)<=d.r*1.1+t.r*.9)dealDamage(d.o,t,d.mi)}}
  W.delays=W.delays.filter(d=>!d.dead);
  for(const h of W.chain){const t=foeOf(h.o);
    if(h.o.hp<=0||t.hp<=0||h.o.stun>0||h.o.hidden){h.dead=1;continue}
    h.t--;if(h.t>0)continue;
    const m=h.o.moves[h.mi];
    if(!h.melee||len(t.x-h.o.x,t.y-h.o.y)<=h.o.r+t.r+140){dealDamage(h.o,t,h.mi,{chain:1,last:h.n<=1});if(m&&!h.melee)W.fx.push({k:'burst',x:t.x,y:t.y-20,t:0,life:.2,r:24,c:C.TCOL[m.type]||'#fff'})}
    h.n--;h.t=h.iv;if(h.n<=0)h.dead=1}
  W.chain=W.chain.filter(h=>!h.dead);
  // 효과 시간
  for(const f of W.fx)f.t+=TICK;W.fx=W.fx.filter(f=>f.t<f.life);
  // 승패
  if(!W.over&&(!W.ball||me.hp<=0)){
    if(foe.hp<=0&&me.hp<=0)finish('draw');else if(foe.hp<=0)finish('win');else if(me.hp<=0)finish('lose');
    else if(W.time>=(C.maxTime||180)){if(C.noTimeLimit)finish('draw');else finish(me.hp/me.max>=foe.hp/foe.max?(me.hp/me.max===foe.hp/foe.max?'draw':'win'):'lose')}
  }
}
function finish(r){W.over=r;W.overT=0;(r==='win'?[W.foe]:[W.me]).forEach(e=>{e.anim='hurt';e.at=0})}

// ---------- 6F-1: 실시간 포획 (레조넌스 방식: 전투 중 볼을 던짐) ----------
// C.balls():[{k,e,n,count}] · C.takeBall(k):볼 정보(없으면 null, 실제 모드는 가방에서 1개 차감) · C.catchP(foe,it,hpRatio):0~1
const ballList=()=>{try{return C.balls?C.balls():[]}catch(e){return[]}};
function tryThrow(){
  if(!W||W.over||W.ball||(W.ballCd||0)>0||!C.balls)return;
  const me=W.me,foe=W.foe;if(me.hp<=0||foe.hp<=0||me.stun>0||me.swapT>0||me.cast||me.rollT>0)return;
  if(C.blockBall){let bm=null;try{bm=C.blockBall()}catch(e){}if(bm){floatTxt(me.x,me.y-90,bm,'#f88');W.ballCd=1;return}}   // 6F-2
  const L=ballList();if(!L.length){floatTxt(me.x,me.y-90,'볼이 없어요','#f88');W.ballCd=.6;return}
  const sel=L[Math.min(W.ballSel||0,L.length-1)];
  const it=C.takeBall(sel.k);if(!it){floatTxt(me.x,me.y-90,'볼이 없어요','#f88');W.ballCd=.6;return}
  const p=Math.max(0,Math.min(1,C.catchP(C.foe,it,Math.max(0,foe.hp/foe.max)))),sh=Math.pow(p,.25);
  let n=0;for(;n<3;n++){if(rnd()>sh)break}
  const ok=n>=3&&rnd()<sh;
  me.anim='shoot';me.at=0;me.row=dirRow(foe.x-me.x,foe.y-me.y);
  W.ball={ph:'fly',t:0,x0:me.x,y0:me.y-34,x:me.x,y:me.y-34,rot:0,it,n,ok,k:0,col:it.col||'#e33'};
}
function updBall(){
  const B=W.ball;if(W.ballCd>0)W.ballCd-=TICK;if(!B)return;
  const foe=W.foe;B.t+=TICK;
  if(B.ph==='fly'){const u=Math.min(1,B.t/.45);B.x=B.x0+(foe.x-B.x0)*u;B.y=B.y0+(foe.y-34-B.y0)*u-Math.sin(u*Math.PI)*80;B.rot=u*10;
    if(u>=1){B.ph='in';B.t=0;if(foe.cast)cancelCast(foe,true);foe.capt=1;foe.hidden=true;foe.wish={x:0,y:0};
      W.proj=W.proj.filter(q=>q.o!==foe);W.fx.push({k:'burst',sys:1,x:foe.x,y:foe.y-20,t:0,life:.25,r:60,c:'#fff'});W.flashA=Math.max(W.flashA||0,.4);W.flashC='#fff'}}
  else if(B.ph==='in'){B.x=foe.x;B.y=foe.y-34+Math.min(34,B.t*140);B.rot=0;if(B.t>=.4){B.ph='shake';B.t=0;B.k=0}}
  else if(B.ph==='shake'){
    if(B.k>=B.n){B.ph='res';B.t=0;B.rot=0;return}
    const u=Math.min(1,B.t/.6);B.rot=Math.sin(u*Math.PI*2)*.5;
    if(B.t>=.6){B.t=0;B.k++;B.rot=0;floatTxt(B.x,B.y-30,'…','#fff')}}
  else if(B.ph==='res'){if(B.t<.35)return;
    if(B.ok){W.over='catch';W.overT=0;floatTxt(B.x,B.y-40,'잡았다!','#ffe14a',true);W.fx.push({k:'shock',sys:1,x:B.x,y:B.y,t:0,life:.4,r:110,w:8,c:'#ffe14a'});W.ball.ph='done'}
    else{foe.capt=0;foe.hidden=false;foe.stun=Math.max(foe.stun,30);foe.anim='idle';
      W.fx.push({k:'burst',sys:1,x:foe.x,y:foe.y-20,t:0,life:.25,r:60,c:'#fff'});
      floatTxt(foe.x,foe.y-90,['안 돼! 나와 버렸다!','아쉽다! 조금만 더!','으앗! 잡은 줄 알았는데!'][Math.min(2,B.n)],'#fff');
      W.ball=null;W.ballCd=1.4}}
}

// ---------- 입력 ----------
const IN={keys:{},stick:{on:0,id:null,sx:0,sy:0,x:0,y:0},press:[],roll:0,btn:[null,null,null,null],hold:{}};
function playerInput(me){
  if(me.hp<=0)return;
  let mx=0,my=0;
  const k=IN.keys;
  if(k.ArrowLeft)mx-=1;if(k.ArrowRight)mx+=1;if(k.ArrowUp)my-=1;if(k.ArrowDown)my+=1;
  if(IN.stick.on){mx+=IN.stick.x;my+=IN.stick.y}
  const L=len(mx,my);
  me.wish=L>.15?{x:mx/Math.min(1,L)*Math.min(1,L),y:my/Math.min(1,L)*Math.min(1,L)}:{x:0,y:0};
  if(L>1){me.wish={x:mx/L,y:my/L}}
  if(IN.roll){IN.roll=0;doRoll(me)}
  while(IN.press.length){const p=IN.press.shift();me.buf={i:p.i,aim:p.aim,dist:p.dist,t:9}}
}
function doRoll(e){
  if(e.rollT>0||e.rc<1||e.stun>0||e.swapT>0||e.hp<=0)return;
  if(e.cast&&e.cast.phase!=='recovery')return;
  let d=e.wish&&len(e.wish.x,e.wish.y)>.2?norm(e.wish.x,e.wish.y):(e.face||{x:1,y:0});
  e.cast=null;e.beam=null;e.hidden=false;
  e.rollT=14;e.rdx=d.x;e.rdy=d.y;e.rc-=1;e.perfect=0;e.row=dirRow(d.x,d.y);
  W.fx.push({k:'ring',sys:1,x:e.x,y:e.y,t:0,life:.2,r:40,c:'#ffffff'});
}
function aimFor(e,manual){
  const f=foeOf(e);
  const toF=f.hp>0?norm(f.x-e.x,f.y-e.y):e.face;
  if(manual)return manual;
  if(e===W.me&&e.wish&&len(e.wish.x,e.wish.y)>.4){
    const a=Math.atan2(e.wish.y,e.wish.x),b=Math.atan2(toF.y,toF.x);
    if(Math.abs(angDiff(b,a))>35*Math.PI/180)return norm(e.wish.x,e.wish.y);
  }
  return toF;
}
function tryBuffered(e){
  if(!e.buf)return;
  e.buf.t--;
  if(e.buf.t<=0){e.buf=null;return}
  if(canCast(e,e.buf.i)){const b=e.buf;e.buf=null;startCast(e,b.i,aimFor(e,b.aim),b.dist)}
}

// ---------- AI (야생 단계) ----------
// ---------- AI (6D: 레조넌스 단계별 값) ----------
// 단계: W 야생 / T1 쉬움 / T2 / G4 보통 / T4 어려움 / T5 최고 / REF 기준. 값은 원본 ai.tiers 그대로(rzsim.json)
const AI_T={"W":{"rtMeanSec":0.48,"rtSdSec":0.11,"rtFloorT":18,"thinkSec":0.3,"aimSdDeg":9,"lead":0.15,"leadNoise":0.3,"dodgeShot":0.15,"dodgeMelee":0.05,"dodgeArea":0.25,"dodgeBeam":0.2,"dodgeSdSec":0.1,"sidestepP":0.2,"hesitationsPer10Sec":1.2,"hesitationSec":0.8,"tokenRegenPerSec":0.35,"tokenCap":2,"postPauseSec":0.9,"pressMinSec":3,"pressMaxSec":5,"resetMinSec":3,"resetMaxSec":4.5,"burstMax":1},"T1":{"rtMeanSec":0.42,"rtSdSec":0.09,"rtFloorT":17,"thinkSec":0.25,"aimSdDeg":7,"lead":0.35,"leadNoise":0.25,"dodgeShot":0.3,"dodgeMelee":0.15,"dodgeArea":0.4,"dodgeBeam":0.35,"dodgeSdSec":0.085,"sidestepP":0.3,"hesitationsPer10Sec":0.9,"hesitationSec":0.7,"tokenRegenPerSec":0.45,"tokenCap":3,"postPauseSec":0.7,"pressMinSec":4,"pressMaxSec":6,"resetMinSec":2.5,"resetMaxSec":3.5,"burstMax":1},"T2":{"rtMeanSec":0.36,"rtSdSec":0.07,"rtFloorT":15,"thinkSec":0.2,"aimSdDeg":5,"lead":0.6,"leadNoise":0.2,"dodgeShot":0.5,"dodgeMelee":0.3,"dodgeArea":0.6,"dodgeBeam":0.55,"dodgeSdSec":0.065,"sidestepP":0.4,"hesitationsPer10Sec":0.6,"hesitationSec":0.5,"tokenRegenPerSec":0.6,"tokenCap":3,"postPauseSec":0.5,"pressMinSec":5,"pressMaxSec":7,"resetMinSec":2,"resetMaxSec":3,"burstMax":2},"G4":{"rtMeanSec":0.3171,"rtSdSec":0.0557,"rtFloorT":14,"thinkSec":0.1524,"aimSdDeg":3.5714,"lead":0.7929,"leadNoise":0.15,"dodgeShot":0.6514,"dodgeMelee":0.4429,"dodgeArea":0.7429,"dodgeBeam":0.6929,"dodgeSdSec":0.0507,"sidestepP":0.5429,"hesitationsPer10Sec":0.3357,"hesitationSec":0.4,"tokenRegenPerSec":0.7643,"tokenCap":4,"postPauseSec":0.3571,"pressMinSec":5,"pressMaxSec":8,"resetMinSec":1.6286,"resetMaxSec":2.2857,"burstMax":2},"T4":{"rtMeanSec":0.28,"rtSdSec":0.045,"rtFloorT":13,"thinkSec":0.117,"aimSdDeg":2.5,"lead":0.9,"leadNoise":0.12,"dodgeShot":0.8,"dodgeMelee":0.6,"dodgeArea":0.85,"dodgeBeam":0.8,"dodgeSdSec":0.04,"sidestepP":0.65,"hesitationsPer10Sec":0.2,"hesitationSec":0.35,"tokenRegenPerSec":0.95,"tokenCap":5,"postPauseSec":0.25,"pressMinSec":6,"pressMaxSec":9,"resetMinSec":1.2,"resetMaxSec":1.8,"burstMax":3},"T5":{"rtMeanSec":0.26,"rtSdSec":0.04,"rtFloorT":12,"thinkSec":0.1,"aimSdDeg":2,"lead":0.95,"leadNoise":0.1,"dodgeShot":0.85,"dodgeMelee":0.65,"dodgeArea":0.9,"dodgeBeam":0.85,"dodgeSdSec":0.035,"sidestepP":0.7,"hesitationsPer10Sec":0.15,"hesitationSec":0.3,"tokenRegenPerSec":1.05,"tokenCap":5,"postPauseSec":0.2,"pressMinSec":6,"pressMaxSec":10,"resetMinSec":1,"resetMaxSec":1.6,"burstMax":3},"REF":{"rtMeanSec":0.25,"rtSdSec":0.03,"rtFloorT":12,"thinkSec":0.083,"aimSdDeg":1.5,"lead":1,"leadNoise":0.05,"dodgeShot":1,"dodgeMelee":1,"dodgeArea":1,"dodgeBeam":1,"dodgeSdSec":0.025,"sidestepP":1,"hesitationsPer10Sec":0,"hesitationSec":0,"tokenRegenPerSec":99999,"tokenCap":99999,"postPauseSec":0,"pressMinSec":99999,"pressMaxSec":99999,"resetMinSec":0,"resetMaxSec":0,"burstMax":4}};
const AI_PLAIN={melee:'m',leap:'m',vanish:'m',roll:'m',projectile:'s',beam:'b',pulse:'a',delayed:'a',zone:'a',target:'a'};
const gauss=()=>(rnd()+rnd()+rnd()+rnd()-2)*1.732;
const tokCost=m=>m.st?.5:m.p<=60?.5:m.p<=90?.75:1;
const rr=(a,b)=>a+rnd()*(b-a);
function aiUpdate(a,ai0,p0){
  if(a.capt){a.wish={x:0,y:0};return}
  const ai=ai0||W.ai,T=ai.T,p=p0||W.me;
  if(a.hp<=0){a.wish={x:0,y:0};return}
  const d=len(p.x-a.x,p.y-a.y),to=norm(p.x-a.x,p.y-a.y);
  const low=a.hp<a.max*.3;
  // 기력(토큰): 공격할 때 쓰고 천천히 차오름 (체력이 낮으면 1.3배)
  ai.tok=Math.min(T.tokenCap,ai.tok+T.tokenRegenPerSec*TICK*(low?1.3:1));
  // 망설임: 가끔 멈칫
  if(ai.hes>0)ai.hes-=TICK;else if(rnd()<T.hesitationsPer10Sec/10*TICK)ai.hes=T.hesitationSec;
  // 압박/후퇴 번갈아
  ai.pt-=TICK;if(ai.pt<=0){ai.phase=ai.phase==='press'?'reset':'press';ai.pt=ai.phase==='press'?rr(T.pressMinSec,T.pressMaxSec):rr(T.resetMinSec,T.resetMaxSec);if(ai.pt<=0)ai.phase='press'}
  // 회피: 위협을 본 뒤 반응시간(평균±표준편차, 최소 floor틱)이 지나면 단계별 확률로 구르기, 아니면 옆걸음
  const tc=p.cast&&(p.cast.phase==='startup'||p.cast.phase==='active')&&p.cast.mv.p>0?p.cast.mv.k:null;
  const shot=W.proj.some(q=>q.o===p&&len(q.x-a.x,q.y-a.y)<220);
  const threat=tc||shot;
  if(threat&&!ai.sawT){ai.sawT=Math.max(T.rtFloorT/60,T.rtMeanSec+gauss()*T.rtSdSec);ai.kind=tc?(AI_PLAIN[tc]||'s'):'s'}
  if(!threat)ai.sawT=0;
  if(ai.sawT>0){ai.sawT-=TICK;if(ai.sawT<=0&&!a.cast){
    const pr={m:T.dodgeMelee,s:T.dodgeShot,b:T.dodgeBeam,a:T.dodgeArea}[ai.kind]+(low?.1:0);
    if(a.rc>=1&&rnd()<pr){const s=rnd()<.5?1:-1;a.wish={x:-to.y*s,y:to.x*s};doRoll(a)}
    else if(rnd()<T.sidestepP){ai.side=.5;ai.s=rnd()<.5?1:-1}}}
  // 이동
  ai.t-=TICK;if(ai.t<=0){ai.t=rr(1.2,3);ai.s=rnd()<.5?1:-1}
  const range=ai.range||250;
  if(!a.cast&&a.stun<=0&&a.rollT<=0){
    let wx=0,wy=0;
    if(ai.side>0){ai.side-=TICK;wx=-to.y*ai.s;wy=to.x*ai.s}
    else if(ai.phase==='reset'){const far=Math.min(range*1.7,520);if(d<far){wx=-to.x*.9-to.y*ai.s*.4;wy=-to.y*.9+to.x*ai.s*.4}else{wx=-to.y*ai.s*.6;wy=to.x*ai.s*.6}}
    else if(d>range){wx=to.x;wy=to.y}else if(d<range*.5){wx=-to.x*.6;wy=-to.y*.6}else{wx=-to.y*ai.s*.6;wy=to.x*ai.s*.6}
    const hm=ai.hes>0?.3:1;a.wish={x:wx*hm,y:wy*hm};
  } else a.wish={x:0,y:0};
  // 공격
  ai.cd=Math.max(0,ai.cd-TICK);
  if(ai.cd<=0&&ai.hes<=0&&!a.cast&&a.stun<=0&&a.rollT<=0&&!ai.noAtk){
    const opts=[];
    a.moves.forEach((m,i)=>{if(!canCast(a,i))return;
      const cost=tokCost(m)*(ai.burst>0?.5:1);if(ai.tok<cost)return;
      const R=m.k==='melee'?180:m.k==='leap'?220:m.k==='pulse'?205:m.k==='beam'?400:m.k==='projectile'?500:m.k==='delayed'?500:m.k==='target'?500:m.k==='zone'?230:m.k==='vanish'?300:m.k==='roll'?350:9999;
      if(m.k==='self'){if(m.d.ef&&m.d.ef.some(x=>x.op==='heal')&&a.hp<a.max*.5)opts.push([i,5,cost]);else if(rnd()<.15)opts.push([i,1,cost]);return}
      if(m.p<=0&&rnd()<.5)return;
      if(d<=R)opts.push([i,2+m.p/50,cost]);
    });
    if(opts.length&&(ai.phase==='press'||rnd()<.3)){
      let tot=opts.reduce((s,o)=>s+o[1],0),r=rnd()*tot,pk=opts[0];for(const o of opts){r-=o[1];if(r<=0){pk=o;break}}
      const m=a.moves[pk[0]];
      // 조준: 상대가 움직이는 방향을 단계별 비율(lead)만큼 앞질러 겨냥 + 단계별 오차
      const sp=m.k==='projectile'?(m.phys?430:480):0;
      const tt=sp?d/sp:0,ld=T.lead*(1+gauss()*.25);
      const px=p.x+(p.vx||0)*tt*ld,py=p.y+(p.vy||0)*tt*ld;
      const base=Math.atan2(py-a.y,px-a.x)+gauss()*T.aimSdDeg*Math.PI/180;
      startCast(a,pk[0],{x:Math.cos(base),y:Math.sin(base)});
      ai.tok-=pk[2];ai.burst++;
      if(ai.burst<T.burstMax&&ai.tok>=.5)ai.cd=.15;
      else{ai.burst=0;ai.cd=(T.postPauseSec||.5)*rr(.7,1.3)}
    }
  }
}

// ---------- 7A: 자동전투(AUTO) — 내 포켓몬도 AI가 조종 · 화면을 만지면 2.5초 동안 직접 조작 ----------
const MAN_SEC=2.5;
function touchedNow(){return IN.stick.on||IN.press.length>0||IN.roll||Object.keys(IN.hold).length>0||Object.values(IN.keys).some(Boolean)}
function autoNow(){if(!C.autoMe||!W)return false;if(touchedNow())W.manT=W.time;return W.manT==null||W.time-W.manT>MAN_SEC}
function aiRange(e){const b=e.moves.filter(m=>m&&m.p>0).sort((x,y)=>y.p-x.p)[0];return b?(b.k==='melee'?120:b.k==='pulse'?150:b.k==='leap'?170:300):240}
function mkAi(tier){const AT=AI_T[tier]||AI_T.G4;return{T:AT,tier,sawT:0,t:0,s:1,cd:1.2,range:240,tok:Math.min(AT.tokenCap,2),hes:0,burst:0,side:0,phase:'press',pt:rr(AT.pressMinSec,AT.pressMaxSec)}}
function autoMe(me,foe){
  if(me.hp<=0){me.wish={x:0,y:0};return}
  const ai=W.aiMe;if(ai.uid!==me.mon.uid){ai.uid=me.mon.uid;ai.range=aiRange(me)}   // 교대하면 사거리 다시 계산
  // 잡고 싶은 포켓몬이면(host가 볼 종류를 알려 줌) 체력을 깎다가 낮아지면 공격을 멈추고 볼을 던짐
  let bk=null;if(C.autoBall&&!W.ball&&foe.hp>0){try{bk=C.autoBall()}catch(e){}}
  const ratio=foe.max?foe.hp/foe.max:1;
  ai.noAtk=!!(bk||W.ball)&&ratio<=.45;
  if(bk&&(ratio<=.45||bk==='master'||W.time>45&&ratio<=.6)&&!(W.ballCd>0)&&!me.cast&&me.rollT<=0&&me.stun<=0){
    const L=ballList(),j=L.findIndex(x=>x.k===bk);if(j>=0){W.ballSel=j;tryThrow()}}
  // 체력 25% 아래면 약(제일 센 것부터, 한 전투 2번까지)
  if(me.hp<me.max*.25&&(W.autoHeal||0)<2&&!(W.itCd>0)&&C.useItem){const L=itemList();const it=L[L.length-1];if(it&&useItemNow(it.k))W.autoHeal=(W.autoHeal||0)+1}
  aiUpdate(me,ai,foe);
}

// ---------- 그리기 ----------
function render(){
  const cv=W.cv,cx=W.ctx,Wd=cv.width,Hd=cv.height;
  const land=Wd>=Hd;
  let viewW=land?AW:Math.min(AW,Math.max(620,Wd/Hd*520));
  let sc=Wd/viewW; if(AH*sc>Hd&&land)sc=Hd/AH;
  const viewH=Hd/sc;
  const me=W.me,foe=W.foe;
  let tx=(me.x*.6+foe.x*.4),ty=(me.y*.6+foe.y*.4);
  const vw=Wd/sc;
  tx=vw>=AW?AW/2:clamp(tx,vw/2,AW-vw/2);ty=viewH>=AH?AH/2:clamp(ty,viewH/2,AH-viewH/2);
  W.cam=W.cam||{x:tx,y:ty};W.cam.x+=(tx-W.cam.x)*.12;W.cam.y+=(ty-W.cam.y)*.12;
  cx.setTransform(1,0,0,1,0,0);
  cx.fillStyle='#0b1220';cx.fillRect(0,0,Wd,Hd);
  let shx=0,shy=0;if(fxOn()){try{const q=C.fxe.FX2.shakeXY();shx=q[0]*.5;shy=q[1]*.5}catch(er){}}
  if(W.shk>.3){shx+=(Math.random()-.5)*W.shk*sc*.6;shy+=(Math.random()-.5)*W.shk*sc*.6;W.shk*=.82}else W.shk=0;
  if(W.inv>0){cv.style.filter='invert(1) contrast(1.6)';W.inv--}else if(cv.style.filter)cv.style.filter='';
  cx.setTransform(sc,0,0,sc,Wd/2-W.cam.x*sc+shx,Hd/2-W.cam.y*sc+shy);
  // 바닥
  // 7B: 전투 배경 = 게임의 장소 배경 그림(풀숲·숲·동굴·바다·체육관…). 그림이 없거나 아직 안 받아졌으면 예전 초록 바닥
  let bim=null;try{bim=C.bg?C.bg():null}catch(er){}
  if(bim&&bim.complete&&bim.naturalWidth){
    const pad=60,BW=AW+pad*2,BH=AH+pad*2,k=Math.max(BW/bim.naturalWidth,BH/bim.naturalHeight);
    cx.drawImage(bim,-pad+(BW-bim.naturalWidth*k)/2,-pad+(BH-bim.naturalHeight*k)/2,bim.naturalWidth*k,bim.naturalHeight*k);
    cx.fillStyle='rgba(10,8,20,.18)';cx.fillRect(-pad,-pad,BW,BH);   // 포켓몬·이펙트가 잘 보이게 살짝 어둡게
  }else{
    const g=cx.createLinearGradient(0,0,0,AH);g.addColorStop(0,'#5e8f55');g.addColorStop(1,'#487244');
    cx.fillStyle=g;cx.fillRect(0,0,AW,AH);
    cx.strokeStyle='rgba(255,255,255,.07)';cx.lineWidth=2;
    for(let x=0;x<=AW;x+=100){cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,AH);cx.stroke()}
    for(let y=0;y<=AH;y+=100){cx.beginPath();cx.moveTo(0,y);cx.lineTo(AW,y);cx.stroke()}}
  cx.strokeStyle='#e8f0d8';cx.lineWidth=6;cx.strokeRect(WALL-3,WALL-3,AW-WALL*2+6,AH-WALL*2+6);
  // 장판/예고
  for(const z of W.zones){const pul=.3+.08*Math.sin(W.time*4);cx.globalAlpha=pul;cx.fillStyle=z.col;cx.beginPath();cx.arc(z.x,z.y,z.r,0,7);cx.fill();cx.globalAlpha=.9;cx.strokeStyle='#fff';cx.lineWidth=3;cx.setLineDash([14,8]);cx.stroke();cx.setLineDash([]);
    cx.font='bold 14px sans-serif';cx.textAlign='center';cx.lineWidth=3;cx.strokeStyle='#000';cx.fillStyle='#fff';const tl=Math.ceil(z.life)+'초';cx.strokeText(tl,z.x,z.y+5);cx.fillText(tl,z.x,z.y+5);cx.globalAlpha=1}
  for(const d of W.delays){const al=d.t>.5?.25:.35+.3*Math.sin(W.time*30);cx.globalAlpha=al;cx.fillStyle='#ff4a3a';cx.beginPath();cx.arc(d.x,d.y,d.r,0,7);cx.fill();cx.globalAlpha=1;cx.strokeStyle='#fff';cx.lineWidth=3;cx.stroke()}
  // 내가 누르고 있는 기술의 사용 범위 미리보기
  drawPreview(cx);
  // 개체
  if(fxOn()){try{C.fxe.VFX.drawGround(cx)}catch(er){}}
  const ents=fxOn()?[foe,me]:[me,foe].sort((a,b)=>a.y-b.y);   // 이펙트가 켜져 있으면 내 포켓몬을 맨 위에 그려 가리지 않게
  for(const e of ents){
    if(fxOn()&&e===me){cx.globalAlpha=1;try{C.fxe.VFX.draw(cx);C.fxe.FX2.draw(cx)}catch(er){}}
    if(e.hp<=0&&W.over&&W.overT>.8&&e!==me&&e!==foe)continue;
    cx.globalAlpha=e.capt?0:e.hidden?.25:(e.hp<=0?Math.max(.15,1-W.overT*.8):1);
    cx.fillStyle='rgba(0,0,0,.3)';cx.beginPath();cx.ellipse(e.x,e.y+6,e.r*.9,e.r*.4,0,0,7);cx.fill();
    // 조준 예고 (준비 중, 내 것만)
    if(e.cast&&e.cast.phase==='startup'&&e===me){const c=e.cast;cx.globalAlpha=.25;cx.strokeStyle='#fff';cx.lineWidth=3;cx.setLineDash([10,8]);cx.beginPath();cx.moveTo(e.x,e.y);cx.lineTo(e.x+Math.cos(c.aim)*220,e.y+Math.sin(c.aim)*220);cx.stroke();cx.setLineDash([]);cx.globalAlpha=1}
    if(e.cast&&e.cast.phase==='startup'&&e!==me){const c=e.cast;cx.globalAlpha=.3;cx.strokeStyle='#ff6a5a';cx.lineWidth=4;cx.beginPath();cx.moveTo(e.x,e.y);cx.lineTo(e.x+Math.cos(c.aim)*200,e.y+Math.sin(c.aim)*200);cx.stroke();cx.globalAlpha=1}
    if(e.beam){const b=e.beam;cx.save();cx.translate(e.x,e.y-(e.lift||0)-20);cx.rotate(b.a);const gg=cx.createLinearGradient(0,0,b.L,0);gg.addColorStop(0,'#fff');gg.addColorStop(1,b.col);cx.globalAlpha=fxOn()?.14:.85;cx.fillStyle=gg;cx.fillRect(0,-18,b.L,36);cx.globalAlpha=fxOn()?.2:.9;cx.fillStyle='#fff';cx.fillRect(0,-6,b.L,12);cx.restore();cx.globalAlpha=1}
    const st=e.anim;
    const TR=e.eng&&e.tier>=6&&window.TFX&&!(C.tfxOff&&C.tfxOff())&&!e.capt&&!e.hidden&&e.hp>0,ty=e.y-(e.lift||0)-18,tms=performance.now();   // 9B 등급 기운
    if(TR){const a0=cx.globalAlpha;try{TFX.back(e.eng,cx,e.S,e.x,ty,e.sc,e.tier,tms)}catch(er){}cx.globalAlpha=a0}
    try{C.drawPm(cx,TR?TFX.spr(e.S,e.tier):e.S,st,e.row,e.at,e.x,ty,e.sc,{loop:!(st==='attack'||st==='hurt'||st==='shoot'),white:e.flash>0,alpha:cx.globalAlpha})}catch(er){cx.fillStyle='#fff';cx.beginPath();cx.arc(e.x,e.y-30,30,0,7);cx.fill()}
    if(TR){try{TFX.front(e.eng,cx,e.S,e.x,ty,e.sc,e.tier,tms)}catch(er){}}
    cx.globalAlpha=1;
    if(e.inv>0&&e.invMax>60){cx.strokeStyle='#ffe14a';cx.lineWidth=4;cx.globalAlpha=.45+.35*Math.sin(W.time*12);cx.beginPath();cx.ellipse(e.x,e.y-30,e.r+20,e.r+20,0,0,7);cx.stroke();cx.globalAlpha=1}   // 9F 불멸 무적
    if(e.protect>0){cx.strokeStyle='#9be7ff';cx.lineWidth=4;cx.globalAlpha=.8;cx.beginPath();cx.ellipse(e.x,e.y-30,e.r+14,e.r+14,0,0,7);cx.stroke();cx.globalAlpha=1}
    // 머리 위 작은 HP바
    const bw=90,bx=e.x-bw/2,by=e.y-18-clamp((e.vis||110)*.78,40,150)-12;
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(bx-2,by-2,bw+4,10);
    const rr=Math.max(0,e.hp/e.max);cx.fillStyle=rr>.5?'#3be06a':rr>.2?'#ffc83a':'#ff4a3a';cx.fillRect(bx,by,bw*rr,6);
    if(e.zb&&e.zb.on>0){cx.font='bold 13px sans-serif';cx.textAlign='center';cx.fillStyle='#ff4060';cx.fillText('⚡ 데미지 +30% '+Math.ceil(e.zb.on)+'초',bx+bw/2,by-6)}   // 9F 만제 버프
    if(e.inv>0&&e.invMax>60){cx.font='bold 13px sans-serif';cx.textAlign='center';cx.fillStyle='#ffe14a';cx.fillText('무적 '+Math.ceil(e.inv/60)+'초',bx+bw/2,by-(e.zb&&e.zb.on>0?20:6))}
  }
  // 발사체
  for(const c of W.clones){const o=c.o;const a=Math.min(1,c.t)*(.5+.12*Math.sin(W.time*10));cx.globalAlpha=a;   // 9F 태초 분신 그리기
    try{const S=window.TFX?TFX.spr(o.S,o.tier):o.S;C.drawPm(cx,S,'idle',o.row,o.at,c.x,c.y-18,o.sc*.85,{loop:true,alpha:a})}catch(er){}
    cx.globalAlpha=a*.8;cx.strokeStyle='#ffe14a';cx.lineWidth=2;cx.beginPath();cx.ellipse(c.x,c.y,26,9,0,0,7);cx.stroke();
    cx.globalAlpha=1;cx.font='bold 12px sans-serif';cx.textAlign='center';cx.fillStyle='#ffe14a';cx.fillText('분신 '+Math.ceil(c.t)+'초',c.x,c.y+22)}
  for(const p of W.proj){cx.globalAlpha=p.fxa?.3:.9;cx.fillStyle=p.col;cx.beginPath();cx.arc(p.x,p.y-24,p.r,0,7);cx.fill();cx.fillStyle='#fff';cx.beginPath();cx.arc(p.x,p.y-24,p.r*.5,0,7);cx.fill();cx.globalAlpha=1}
  // 볼(6F-1)
  if(W.ball&&W.ball.ph!=='done'||W.over==='catch'&&W.ball){const B=W.ball;cx.save();cx.translate(B.x,B.y);cx.rotate(B.rot||0);
    cx.fillStyle=B.col;cx.beginPath();cx.arc(0,0,16,Math.PI,0);cx.fill();cx.fillStyle='#fff';cx.beginPath();cx.arc(0,0,16,0,Math.PI);cx.fill();
    cx.strokeStyle='#222';cx.lineWidth=3;cx.beginPath();cx.arc(0,0,16,0,7);cx.moveTo(-16,0);cx.lineTo(16,0);cx.stroke();
    cx.fillStyle='#fff';cx.beginPath();cx.arc(0,0,5,0,7);cx.fill();cx.stroke();cx.restore()}
  // 효과
  for(const f of W.fx){if(fxOn()&&(f.k==='burst'||f.k==='cone'||f.k==='slash'||f.k==='beamline'||(f.k==='ring'&&!f.sys)))continue;const u=f.t/f.life;cx.save();cx.globalAlpha=Math.max(0,1-u);
    if(f.k==='dmg'&&f.tk){pxDraw(cx,f)}
    else if(f.k==='psq'){cx.globalAlpha=Math.max(0,1-f.t/f.life);cx.fillStyle=f.c;cx.fillRect(Math.round(f.x+f.vx*f.t),Math.round(f.y+f.vy*f.t+400*f.t*f.t),f.z,f.z)}
    else if(f.k==='dmg'){const e0=1-Math.pow(1-Math.min(1,u*1.6),3),pop=1+.55*Math.max(0,1-u*7);cx.globalAlpha=Math.min(1,(1-u)*4);
      cx.font='italic 900 '+Math.round(30*f.sc*pop)+'px sans-serif';cx.textAlign='center';cx.lineJoin='round';cx.lineWidth=6;cx.strokeStyle='#000';cx.fillStyle='#fff';cx.shadowColor=f.c;cx.shadowBlur=14;
      const y=f.y-e0*46;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='shock'){cx.globalAlpha=Math.max(0,1-u);cx.strokeStyle=f.c;cx.lineWidth=Math.max(1,f.w*(1-u));const R=f.r*(.2+.8*Math.sqrt(u));cx.beginPath();cx.ellipse(f.x,f.y,R,R*.7,0,0,7);cx.stroke()}
    else if(f.k==='spk'){cx.globalAlpha=Math.max(0,1-u);cx.fillStyle=f.c;cx.shadowColor=f.c;cx.shadowBlur=8;for(const q of f.P){const px=f.x+q.vx*f.t,py=f.y+q.vy*f.t+260*f.t*f.t;cx.beginPath();cx.arc(px,py,q.z*(1-u*.6),0,7);cx.fill()}}
    else if(f.k==='txt'){cx.font=(f.big?'bold 34px':'bold 24px')+' sans-serif';cx.textAlign='center';cx.lineWidth=5;cx.strokeStyle='#000';cx.fillStyle=f.c;const y=f.y-u*40;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='callout'){cx.font='bold 22px sans-serif';cx.textAlign='center';cx.lineWidth=4;cx.strokeStyle='#000';cx.fillStyle=f.c;const y=f.y-u*14;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='burst'){cx.fillStyle=f.c;cx.beginPath();cx.arc(f.x,f.y,f.r*(.4+u*.8),0,7);cx.fill()}
    else if(f.k==='ring'){cx.strokeStyle=f.c;cx.lineWidth=8;cx.beginPath();cx.ellipse(f.x,f.y,f.r*(.3+u*.7),f.r*(.3+u*.7)*.7,0,0,7);cx.stroke()}
    else if(f.k==='cone'){cx.fillStyle=f.c;cx.beginPath();cx.moveTo(f.x,f.y);cx.arc(f.x,f.y,f.r*(.4+u*.6),f.a-Math.PI/3,f.a+Math.PI/3);cx.closePath();cx.fill()}
    else if(f.k==='slash'){cx.strokeStyle=f.c;cx.lineWidth=14;cx.beginPath();cx.arc(f.x,f.y,f.r*.8,f.a-.9+u*.5,f.a+.9+u*.5);cx.stroke()}
    else if(f.k==='beamline'){cx.strokeStyle=f.c;cx.lineWidth=10;cx.beginPath();cx.moveTo(f.x,f.y-20);cx.lineTo(f.x2,f.y2-20);cx.stroke()}
    cx.restore()}
  // ---- 화면 고정 HUD ----
  cx.setTransform(1,0,0,1,0,0);
  if(W.flashA>.01){cx.save();cx.globalAlpha=W.flashA*.3;cx.fillStyle=W.flashC||'#fff';cx.fillRect(0,0,Wd,Hd);cx.restore();W.flashA*=.82}
  hud(cx,Wd,Hd);
}
function hud(cx,Wd,Hd){
  const me=W.me,foe=W.foe,u=Math.max(1,Math.min(Wd,Hd*1.6)/700);
  const bar=(x,y,w,e,right)=>{
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(x,y,w,46*u);
    cx.fillStyle='#fff';cx.font='bold '+(15*u)+'px sans-serif';cx.textAlign=right?'right':'left';
    cx.fillText(C.nm(e.mon)+'  Lv.'+(C.dLv?C.dLv(e.mon):e.mon.lv),right?x+w-8*u:x+8*u,y+18*u);
    cx.fillStyle='#222';cx.fillRect(x+8*u,y+26*u,w-16*u,10*u);
    const r=Math.max(0,e.hp/e.max);cx.fillStyle=r>.5?'#3be06a':r>.2?'#ffc83a':'#ff4a3a';cx.fillRect(x+8*u,y+26*u,(w-16*u)*r,10*u);
    {cx.fillStyle='#fff';cx.font='bold '+(11*u)+'px sans-serif';cx.textAlign=right?'left':'right';cx.fillText(fmtN(Math.ceil(e.hp)*kOf(e))+' / '+fmtN(e.max*kOf(e)),right?x+8*u:x+w-8*u,y+44*u)}
    // 상태
    const ss=Object.keys(e.ail).map(s=>({burn:'화',poison:'독',paralysis:'마',sleep:'잠',freeze:'얼',confusion:'혼'})[s]||s).join('');
    if(ss){cx.fillStyle='#f9a';cx.textAlign=right?'left':'right';cx.fillText(ss,right?x+8*u:x+w-8*u,y+18*u)}
  };
  const bw=Math.min(Wd*.42,300*u);
  bar(8*u,8*u,bw,me,false);bar(Wd-bw-8*u,8*u,bw,foe,true);
  cx.fillStyle='rgba(0,0,0,.5)';cx.font='bold '+(16*u)+'px sans-serif';cx.textAlign='center';
  const left=Math.max(0,Math.ceil(180-W.time));cx.fillStyle='#fff';cx.fillText(Math.floor(left/60)+':'+String(left%60).padStart(2,'0'),Wd/2,24*u);
  // 구르기 충전
  cx.font='bold '+(13*u)+'px sans-serif';cx.textAlign='left';cx.fillStyle='#fff';
  // 버튼은 DOM으로 따로 그림
  updBtns();
  if(W.over){
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(0,0,Wd,Hd);
    cx.fillStyle='#fff';cx.textAlign='center';cx.font='bold '+(44*u)+'px sans-serif';
    cx.fillText(W.over==='win'?'승리!':W.over==='catch'?'포획 성공!':W.over==='lose'?(C.loseTxt||'패배…'):(C.drawTxt||'무승부'),Wd/2,Hd/2-10*u);
    cx.font=(16*u)+'px sans-serif';cx.fillText(C.endHint||'화면을 누르면 돌아가요 (시험 전투라 저장에는 영향 없음)',Wd/2,Hd/2+26*u);
  }
}

// ---------- 조준 미리보기 (버튼을 누른 채 끌면 방향·범위가 바닥에 보임) ----------
const DRAG_MIN=12, DRAG_FULL=110;
// 누르고 있는 버튼의 조준: 끌었으면 그 방향(manual), 안 끌었으면 자동 조준(상대 쪽)
function holdAim(h){
  const dx=h.x-h.sx,dy=h.y-h.sy,L=Math.hypot(dx,dy),m=W.me.moves[h.i];
  if(L>DRAG_MIN){
    const f=clamp((L-DRAG_MIN)/(DRAG_FULL-DRAG_MIN),0,1);
    let dist=null;
    if(m&&m.k==='zone')dist=40+f*190;else if(m&&m.k==='leap')dist=30+f*145;
    return{dir:norm(dx,dy),manual:true,dist,f};
  }
  return{dir:aimFor(W.me,null),manual:false,dist:null,f:0};
}
function drawPreview(cx){
  const me=W.me,foe=W.foe;if(!me||me.hp<=0)return;
  for(const id in IN.hold){
    const h=IN.hold[id],m=me.moves[h.i];if(!m)continue;
    const a=holdAim(h),u=a.dir,ang=Math.atan2(u.y,u.x),col=C.TCOL[m.type]||'#fff',heavy=m.p>=110;
    const ox=me.x,oy=me.y;
    cx.save();
    cx.lineWidth=3;cx.strokeStyle=col;cx.fillStyle='rgba(255,255,255,.2)';
    cx.setLineDash(a.manual?[]:[12,8]);
    const rectP=(L,w)=>{cx.save();cx.translate(ox,oy);cx.rotate(ang);cx.beginPath();cx.rect(0,-w,L,w*2);cx.fill();cx.stroke();cx.restore()};
    const circ=(x,y,r)=>{cx.beginPath();cx.arc(x,y,r,0,7);cx.fill();cx.stroke()};
    const sector=(r,half)=>{cx.beginPath();cx.moveTo(ox,oy);cx.arc(ox,oy,r,ang-half,ang+half);cx.closePath();cx.fill();cx.stroke()};
    const k=m.k;
    if(m.st&&k==='self'||k==='self'){circ(ox,oy,70)}
    else if(k==='melee'){const reach=70+(heavy?20:0)+10+me.r,half=(heavy?65:50)*Math.PI/180;sector(reach+(heavy?180:120)*.5,half);
      cx.setLineDash([]);cx.beginPath();cx.moveTo(ox,oy);cx.lineTo(ox+u.x*120*(heavy?1.5:1),oy+u.y*120*(heavy?1.5:1));cx.stroke()}
    else if(k==='leap'){const d=a.dist!=null?a.dist:(foe.hp>0?clamp(len(foe.x-me.x,foe.y-me.y),30,175):105);
      rectP(d,6);circ(clamp(ox+u.x*d,WALL,AW-WALL),clamp(oy+u.y*d,WALL,AH-WALL),34+me.r*.3)}
    else if(k==='roll'){rectP(330,me.r*.9)}
    else if(k==='vanish'){circ(ox,oy,56)}
    else if(k==='projectile'){const r=(m.st?16:heavy?20:13)*(m.d.sb==='bolt'?1.25:1);rectP(690,r)}
    else if(k==='beam'){rectP(clamp(360+m.p*1.5,360,690),18)}
    else if(k==='pulse'){if(m.kd==='cone')sector(205,60*Math.PI/180);else circ(ox,oy,205)}
    else if(k==='zone'){const d=a.dist!=null?a.dist:Math.min(230,foe.hp>0?len(foe.x-me.x,foe.y-me.y):230);
      cx.setLineDash([]);cx.beginPath();cx.moveTo(ox,oy);cx.lineTo(clamp(ox+u.x*d,WALL,AW-WALL),clamp(oy+u.y*d,WALL,AH-WALL));cx.stroke();
      cx.setLineDash(a.manual?[]:[12,8]);circ(clamp(ox+u.x*d,WALL,AW-WALL),clamp(oy+u.y*d,WALL,AH-WALL),62)}
    else if(k==='delayed'){circ(foe.x,foe.y,58)}
    else if(k==='target'){cx.globalAlpha=.6;cx.beginPath();cx.arc(ox,oy,550,0,7);cx.stroke();cx.globalAlpha=1;
      if(foe.hp>0){cx.setLineDash([]);cx.beginPath();cx.moveTo(ox,oy);cx.lineTo(foe.x,foe.y);cx.stroke()}}
    else{rectP(300,14)}
    // 방향 화살표 + 안내
    cx.setLineDash([]);cx.fillStyle=col;cx.beginPath();const ax=ox+u.x*90,ay=oy+u.y*90;
    cx.moveTo(ax+u.x*16,ay+u.y*16);cx.lineTo(ax-u.y*10,ay+u.x*10);cx.lineTo(ax+u.y*10,ay-u.x*10);cx.closePath();cx.fill();
    cx.font='bold 20px sans-serif';cx.textAlign='center';cx.lineWidth=4;cx.strokeStyle='#000';cx.fillStyle='#fff';
    const tx=a.manual?'손 떼면 이 방향으로 발사':'끌어서 조준 · 그냥 떼면 자동 조준';
    cx.strokeText(tx,me.x,me.y-me.r*2.2-44);cx.fillText(tx,me.x,me.y-me.r*2.2-44);
    cx.restore();
  }
}

// ---------- 6F-4a/4b: 파티 패널(일시정지) + 실제 교체 ----------
const SW_CD=5,SW_VULN=36;   // 교체 쿨타임 5초 · 교체 직후 무방비 36틱(0.6초)
function closeParty(){if(!W||!W.pp)return;W.pp.remove();W.pp=null;W.paused=0}
// ---------- 6F-4c: 전투 중 회복 아이템 (패널·일시정지 · 가방 1개 차감은 host의 C.useItem) ----------
// C.items():[{k,e,n,count,heal}] · C.useItem(k):{heal:number,cure?:1} (없으면 null, 실제 모드는 가방에서 1개 차감)
const IT_CD=4;   // 약 쓴 뒤 다시 쓰려면 4초
const itemList=()=>{try{return C.items?C.items()||[]:[]}catch(e){return[]}};
function closeItems(){if(!W||!W.ip)return;W.ip.remove();W.ip=null;W.paused=0}
function useItemNow(k){
  if(!W||W.over||W.ball||(W.itCd||0)>0||!C.useItem)return false;
  const me=W.me;if(me.hp<=0)return false;
  const hurt=me.hp<me.max-.5,ail=Object.keys(me.ail||{}).length>0;
  const it=itemList().find(x=>x.k===k);if(!it)return false;
  if(!hurt&&!(it.cure&&ail)){floatTxt(me.x,me.y-90,'체력이 가득이에요','#fff');return false}
  let r=null;try{r=C.useItem(k)}catch(e){}
  if(!r){floatTxt(me.x,me.y-90,'쓸 수 없어요','#f88');return false}
  if(r.deny){floatTxt(me.x,me.y-90,r.deny,'#f88');return false}   // 9D 물약 제한
  let got=0;if(r.heal>0){const b0=me.hp;me.hp=Math.min(me.max,me.hp+r.heal*(me.hm||1));got=Math.round(me.hp-b0)}
  if(r.cure)me.ail={};
  W.itCd=IT_CD;
  floatTxt(me.x,me.y-90,got>0?'+'+fmtN(got*kOf(me)):'회복!','#6f6',true);
  W.fx.push({k:'ring',sys:1,x:me.x,y:me.y,t:0,life:.35,r:60,c:'#6fff8a'});
  try{C.sfx&&C.sfx('heal')}catch(e){}
  return true}
function openItems(){
  if(!W||W.over||W.pp||W.ip||W.ball||!C.items)return;
  W.paused=1;IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};IN.hold={};IN.press=[];IN.roll=0;
  try{W.ui.jb.style.display='none'}catch(e){}
  const ip=document.createElement('div');
  ip.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:5;font-family:sans-serif';
  ip.addEventListener('pointerdown',ev=>ev.stopPropagation());
  const box=document.createElement('div');box.style.cssText='width:min(92vw,360px);max-height:86vh;overflow:auto;background:#1c2230;border:2px solid #56627f;border-radius:14px;padding:12px;color:#fff';
  const h=document.createElement('div');h.style.cssText='font-weight:bold;font-size:16px;margin-bottom:2px';h.textContent='회복 아이템';box.appendChild(h);
  const me=W.me;const sub=document.createElement('div');sub.style.cssText='font-size:12px;opacity:.75;margin-bottom:8px';
  sub.textContent=(W.itCd>0?'쿨타임 '+Math.ceil(W.itCd)+'초 남았어요. ':'')+'싸우는 중인 포켓몬에게 써요 ('+fmtN(me.hp*kOf(me))+'/'+fmtN(me.max*kOf(me))+'). 쓰면 '+IT_CD+'초 동안 못 써요.'+(()=>{try{const n=C.potLeft&&C.potLeft();return n==null?'':' · 이번 전투 물약 '+n+'번 남음'}catch(e){return''}})();box.appendChild(sub);
  const L=itemList();
  if(!L.length){const n=document.createElement('div');n.style.cssText='padding:12px;text-align:center;opacity:.7';n.textContent='쓸 수 있는 회복 아이템이 없어요';box.appendChild(n)}
  for(const it of L){
    const can=!(W.itCd>0)&&it.count!==0;
    const row=document.createElement('div');
    row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;border-radius:8px;background:'+(can?'#34476b':'#2b3347')+';opacity:'+(can?1:.55)+';'+(can?'cursor:pointer;border:1px solid #7fa6e8':'border:1px solid transparent');
    const l=document.createElement('div');l.innerHTML='<span style="display:inline-block;width:22px;vertical-align:middle">'+(it.e||'')+'</span> <b>'+it.n+'</b>';
    const r=document.createElement('div');r.style.cssText='font-size:12px;text-align:right';r.textContent=(it.heal?'+'+it.heal+' · ':'')+'×'+it.count;
    row.appendChild(l);row.appendChild(r);box.appendChild(row);
    if(can)row.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();if(useItemNow(it.k))closeItems()});
  }
  const cl=document.createElement('div');cl.textContent='닫기 (전투 계속)';cl.style.cssText='margin-top:8px;text-align:center;padding:10px;border-radius:8px;background:#3b6ea5;font-weight:bold';
  cl.addEventListener('pointerdown',ev=>{ev.stopPropagation();closeItems()});box.appendChild(cl);
  ip.appendChild(box);W.root.appendChild(ip);W.ip=ip;
}
const partyHp=q=>{const h=W.hpBy&&W.hpBy[q.uid];return h!=null?h:q.hp};
function setMoveBtns(){
  const U=W.ui;if(!U)return;
  for(let i=0;i<4;i++){const m=W.me.moves[i],b=U.btns[i];b._t.textContent=m?m.name:'-';b.style.background=m?(C.TCOL[m.type]||'#456'):'#333';b.style.opacity=1;b._cd.style.height='0'}
}
async function doSwitch(uid){
  const w=W;
  if(!w||w.over||w.swapping||(w.swCd||0)>0||!C.pickMon)return;
  const old=w.me;if(!old||old.hp<=0||uid===old.mon.uid)return;
  let pk=null;try{pk=C.pickMon(uid)}catch(e){}
  if(!pk||!pk.mon)return;
  const h=w.hpBy[uid]!=null?w.hpBy[uid]:pk.hp;if(!(h>0))return;
  w.swapping=1;
  let S=null;try{S=await C.getSpr(C.sprKey(pk.mon))}catch(e){}
  if(W!==w||w.stopped||w.over){w.swapping=0;return}
  w.hpBy[old.mon.uid]=old.hp/(old.hm||1);                       // 나가는 포켓몬의 지금 체력 기억
  const ne=mkEnt(pk.mon,S,0,h);
  ne.x=old.x;ne.y=old.y;ne.face=old.face;ne.row=old.row;ne.rc=old.rc;ne.vx=ne.vy=0;
  ne.swapT=SW_VULN;ne.flash=SW_VULN/60;             // 잠깐 무방비(깜박임)
  for(let i=0;i<4;i++)ne.cd[i]=Math.min(ne.cdMax[i],1.5);   // 쿨타임 초기화 꼼수 방지
  w.chain=w.chain.filter(c=>c.o!==old);w.clones=w.clones.filter(c=>c.o!==old);             // 나간 포켓몬의 연타·분신은 끊김
  w.proj=w.proj.filter(p=>{if(p.o!==old)return true;try{if(p.fxa)C.fxe.VFX.stop(p.fxa)}catch(er){}return false});w.zones=w.zones.filter(z=>z.o!==old);w.delays=w.delays.filter(d=>d.o!==old);   // 9E: 나간 포켓몬 기술 그림이 멈춰 남지 않게
  w.delays.forEach(d=>{if(d.tgt===old)d.tgt=ne});   // 상대의 내려찍기 조준은 새 포켓몬을 따라감
  w.me=ne;
  if(!w.used.includes(uid))w.used.push(uid);
  w.swCd=SW_CD;w.swapping=0;
  w.fx.push({k:'ring',sys:1,x:ne.x,y:ne.y,t:0,life:.35,r:60,c:'#ffffff'});
  floatTxt(ne.x,ne.y-80,'교대!','#9be7ff',true);
  setMoveBtns();closeParty();
}
function openParty(){
  if(!W||W.over||W.pp||W.ip||W.ball)return;
  W.paused=1;IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};IN.hold={};IN.press=[];IN.roll=0;
  try{W.ui.jb.style.display='none'}catch(e){}
  const pp=document.createElement('div');
  pp.style.cssText='position:absolute;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:5;font-family:sans-serif';
  pp.addEventListener('pointerdown',ev=>ev.stopPropagation());
  const box=document.createElement('div');box.style.cssText='width:min(92vw,360px);max-height:86vh;overflow:auto;background:#1c2230;border:2px solid #56627f;border-radius:14px;padding:12px;color:#fff';
  const h=document.createElement('div');h.style.cssText='font-weight:bold;font-size:16px;margin-bottom:2px';h.textContent='포켓몬 교대';box.appendChild(h);
  const sub=document.createElement('div');sub.style.cssText='font-size:12px;opacity:.75;margin-bottom:8px';
  sub.textContent=C.pickMon?(W.swCd>0?'교체 쿨타임 '+Math.ceil(W.swCd)+'초 남았어요.':'바꿀 포켓몬을 누르세요. 바꾸는 동안 잠깐 무방비예요.'):'전투는 멈춰 있어요. (보기만)';box.appendChild(sub);
  let L=[];try{L=C.party()||[]}catch(e){}
  const curUid=W.me.mon.uid;
  for(const q of L){
    const row=document.createElement('div');const cur=q.uid===curUid;
    const hp=cur?Math.max(0,Math.round(W.me.hp)):Math.round(partyHp(q)),mx=cur?Math.round(W.me.max):q.max,dead=hp<=0;
    const can=!!C.pickMon&&!cur&&!dead&&!(W.swCd>0);
    row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;border-radius:8px;background:'+(cur?'#2a4a2a':can?'#34476b':'#2b3347')+';opacity:'+(dead?.5:1)+';'+(can?'cursor:pointer;border:1px solid #7fa6e8':'border:1px solid transparent');
    const l=document.createElement('div');l.innerHTML='<b>'+q.name+'</b> Lv.'+q.lv;
    const r=document.createElement('div');r.style.cssText='font-size:12px;text-align:right';
    const kk=kOf(W.me),hs=fmtN(hp*kk)+'/'+fmtN(mx*kk);r.textContent=cur?'싸우는 중 '+hs:(dead?'기절':hs+(can?' · 교체':''));
    row.appendChild(l);row.appendChild(r);box.appendChild(row);
    if(can)row.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();doSwitch(q.uid)});
  }
  const cl=document.createElement('div');cl.textContent='닫기 (전투 계속)';cl.style.cssText='margin-top:8px;text-align:center;padding:10px;border-radius:8px;background:#3b6ea5;font-weight:bold';
  cl.addEventListener('pointerdown',ev=>{ev.stopPropagation();closeParty()});box.appendChild(cl);
  pp.appendChild(box);W.root.appendChild(pp);W.pp=pp;
}

// ---------- DOM(조작 UI) ----------
function buildUI(){
  const root=document.createElement('div');root.id='rtbRoot';
  root.style.cssText='position:fixed;inset:0;z-index:99999;background:#000;touch-action:none;user-select:none;-webkit-user-select:none';
  const cv=document.createElement('canvas');cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';root.appendChild(cv);
  const ui=document.createElement('div');ui.style.cssText='position:absolute;inset:0;pointer-events:none';root.appendChild(ui);
  // 조이스틱 표시
  const jb=document.createElement('div');jb.style.cssText='position:absolute;width:120px;height:120px;border-radius:50%;border:3px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);display:none;transform:translate(-50%,-50%)';
  const jk=document.createElement('div');jk.style.cssText='position:absolute;width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.55);left:50%;top:50%;transform:translate(-50%,-50%)';jb.appendChild(jk);ui.appendChild(jb);
  // 기술 4개 + 구르기
  const btns=[],mk=(label,bg)=>{const b=document.createElement('div');b.style.cssText='position:absolute;width:70px;height:70px;border-radius:50%;pointer-events:auto;display:flex;align-items:center;justify-content:center;text-align:center;font:bold 12px sans-serif;color:#fff;background:'+bg+';border:3px solid rgba(255,255,255,.6);overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.5)';const t=document.createElement('span');t.style.cssText='position:relative;z-index:2;text-shadow:0 1px 3px #000;padding:0 4px;line-height:1.1';t.textContent=label;const cd=document.createElement('i');cd.style.cssText='position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(0,0,0,.65);z-index:1';b.appendChild(cd);b.appendChild(t);ui.appendChild(b);b._cd=cd;b._t=t;return b};
  for(let i=0;i<4;i++){const m=W.me.moves[i];const b=mk(m?m.name:'-',m?(C.TCOL[m.type]||'#456'):'#333');btns.push(b)}
  // 배치: 2x2 + 구르기
  const place=(b,r,bt)=>{b.style.right=r+'px';b.style.bottom=bt+'px'};
  place(btns[0],110,20);place(btns[1],24,52);place(btns[2],24,140);place(btns[3],110,108);
  const rb=mk('🌀','#37506e');place(rb,198,28);rb.style.width=rb.style.height='62px';
  const rcnt=document.createElement('div');rcnt.style.cssText='position:absolute;right:198px;bottom:96px;width:62px;text-align:center;color:#fff;font:bold 12px sans-serif;text-shadow:0 1px 3px #000';ui.appendChild(rcnt);
  let bb=null,bsw=null;
  if(C.balls){
    bb=mk('⚪','#5a3a3a');place(bb,198,128);bb.style.width=bb.style.height='58px';bb.style.fontSize='11px';
    bsw=document.createElement('div');bsw.textContent='🔄';bsw.style.cssText='position:absolute;right:262px;bottom:136px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font:16px sans-serif;display:none;align-items:center;justify-content:center;pointer-events:auto;border:2px solid rgba(255,255,255,.5)';ui.appendChild(bsw);
    bb.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();tryThrow()});
    bsw.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();W.ballSel=((W.ballSel||0)+1)%Math.max(1,ballList().length)});
  }
  const qb=document.createElement('div');qb.textContent='✕';qb.style.cssText='position:absolute;left:8px;bottom:8px;width:34px;height:34px;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;font:bold 18px sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:auto';ui.appendChild(qb);
  // 6F-4a: 교대 버튼 + 파티 보기 패널(전투 일시정지). 실제 교체는 6F-4b
  if(C.party&&C.party().length>1){
    const sw=document.createElement('div');sw.textContent='🔄 교대';sw.style.cssText='position:absolute;left:50px;bottom:8px;height:34px;padding:0 10px;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;font:bold 13px sans-serif;display:flex;align-items:center;pointer-events:auto';
    sw.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();openParty()});ui.appendChild(sw);W.swBtn=sw;
  }
  // 6F-4c: 회복 아이템 버튼
  if(C.items&&C.useItem){
    const ib=document.createElement('div');ib.textContent='🧪 약';ib.style.cssText='position:absolute;left:'+((C.party&&C.party().length>1)?136:50)+'px;bottom:8px;height:34px;padding:0 10px;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;font:bold 13px sans-serif;display:flex;align-items:center;pointer-events:auto';
    ib.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();openItems()});ui.appendChild(ib);W.itBtn=ib;
  }
  document.body.appendChild(root);
  W.root=root;W.cv=cv;W.ctx=cv.getContext('2d');W.ui={jb,jk,btns,rb,rcnt,bb,bsw};
  // 포인터
  const bindBtn=(b,i)=>{
    b.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();try{b.setPointerCapture(ev.pointerId)}catch(e){}
      if(i>=0)IN.hold[ev.pointerId]={i,sx:ev.clientX,sy:ev.clientY,x:ev.clientX,y:ev.clientY}});
    b.addEventListener('pointermove',ev=>{const h=IN.hold[ev.pointerId];if(h){h.x=ev.clientX;h.y=ev.clientY}});
    b.addEventListener('pointerup',ev=>{ev.preventDefault();
      if(i===-1){IN.roll=1;return}
      const h=IN.hold[ev.pointerId];delete IN.hold[ev.pointerId];if(!h)return;
      h.x=ev.clientX;h.y=ev.clientY;const a=holdAim(h);
      IN.press.push({i,aim:a.manual?a.dir:null,dist:a.manual?a.dist:null})});
    b.addEventListener('pointercancel',ev=>{delete IN.hold[ev.pointerId]});
  };
  btns.forEach((b,i)=>bindBtn(b,i));bindBtn(rb,-1);
  if(C.noQuit)qb.style.display='none';   // 6F-3: 트레이너 전투는 도망 금지
  qb.addEventListener('pointerdown',ev=>{ev.stopPropagation();if(W.over)return;if(confirm(C.quitText||'시험 전투를 그만둘까요?'))stop('quit')});
  // 조이스틱 (화면 왼쪽 아무 데나)
  root.addEventListener('pointerdown',ev=>{
    if(W.over&&W.overT>.8){stop(W.over);return}
    if(ev.clientX>innerWidth*.55||IN.stick.on)return;
    IN.stick={on:1,id:ev.pointerId,sx:ev.clientX,sy:ev.clientY,x:0,y:0};
    jb.style.display='block';jb.style.left=ev.clientX+'px';jb.style.top=ev.clientY+'px';jk.style.left='50%';jk.style.top='50%'});
  root.addEventListener('pointermove',ev=>{
    if(!IN.stick.on||ev.pointerId!==IN.stick.id)return;
    let dx=ev.clientX-IN.stick.sx,dy=ev.clientY-IN.stick.sy;const R=55,L=Math.hypot(dx,dy);
    const k=Math.min(1,L/R);IN.stick.x=L?dx/L*k:0;IN.stick.y=L?dy/L*k:0;
    const sx=L>R?dx/L*R:dx,sy=L>R?dy/L*R:dy;jk.style.left=(50+sx/120*100)+'%';jk.style.top=(50+sy/120*100)+'%'});
  const up=ev=>{if(IN.stick.on&&ev.pointerId===IN.stick.id){IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};jb.style.display='none'}};
  root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
  // 키보드
  W.kd=e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(W.pp&&k!=='Escape'&&k!=='p')return;IN.keys[k]=1;
    if(k===' '){IN.roll=1;e.preventDefault()}
    const mk={q:0,w:1,e:2,r:3,'1':0,'2':1,'3':2,'4':3};
    if(k in mk&&!e.repeat)IN.press.push({i:mk[k],aim:null})
    if(k==='b'&&!e.repeat)tryThrow();
    if(k==='n'&&!e.repeat&&C.balls)W.ballSel=((W.ballSel||0)+1)%Math.max(1,ballList().length);
    if(k==='Escape'&&W.ip){closeItems();return}
    if(k==='i'&&!e.repeat&&C.items&&C.useItem){W.ip?closeItems():openItems();return}
    if(k==='Escape'&&W.pp){closeParty();return}
    if(k==='p'&&!e.repeat&&C.party&&C.party().length>1){W.pp?closeParty():openParty();return}
    if(k==='Escape'&&!W.over&&!C.noQuit)stop('quit')};
  W.ku=e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;IN.keys[k]=0};
  addEventListener('keydown',W.kd);addEventListener('keyup',W.ku);
  W.rs=()=>{const dpr=Math.min(2,devicePixelRatio||1);cv.width=Math.round(innerWidth*dpr);cv.height=Math.round(innerHeight*dpr)};
  W.rs();addEventListener('resize',W.rs);
}
function updBtns(){
  const me=W.me,U=W.ui;if(!U)return;
  for(let i=0;i<4;i++){const b=U.btns[i],m=me.moves[i];if(!m)continue;const r=Math.min(1,me.cd[i]/me.cdMax[i]);b._cd.style.height=(r*100)+'%';b.style.opacity=canCast(me,i)?1:.75;
    // 6C-4 충전 개수(다단 기술)·PP 표시
    if(!b._n){b._n=document.createElement('b');b._n.style.cssText='position:absolute;z-index:3;left:0;right:0;bottom:3px;text-align:center;font:bold 10px sans-serif;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none';b.appendChild(b._n)}
    const tx=(m.chg?'×'+me.ch[i]+' · ':'')+(m.ppMax>0?'PP '+me.pp[i]:m.id==='struggle'?'발버둥':'');if(b._n._t!==tx){b._n._t=tx;b._n.textContent=tx;b._n.style.color=m.ppMax>0&&me.pp[i]<=3?'#ff8a8a':'#fff'}}
  if(U.bb){const L=ballList(),sel=L[Math.min(W.ballSel||0,L.length-1)];
    const tx=sel?(sel.e||'⚪')+'\n'+(sel.count!=null?sel.count:''):'볼\n0';if(U.bb._tx!==tx){U.bb._tx=tx;U.bb.style.whiteSpace='pre';U.bb.innerHTML=tx.replace('\n','<br>');if(U.bb._cd)U.bb.insertBefore(U.bb._cd,U.bb.firstChild)}
    U.bb.style.opacity=(W.ball||W.ballCd>0||!sel)?.5:1;U.bsw.style.display=L.length>1?'flex':'none'}
  U.rb._cd.style.height=(me.rc>=1?0:(1-(me.rc%1))*100)+'%';U.rcnt.textContent='🌀 '+Math.floor(me.rc)+'/2';
}

// ---------- 실행 ----------
function stop(r){
  if(!W||W.stopped)return;W.stopped=1;cancelAnimationFrame(W.raf);
  removeEventListener('keydown',W.kd);removeEventListener('keyup',W.ku);removeEventListener('resize',W.rs);
  try{for(const p of W.proj)if(p.fxa)C.fxe.VFX.stop(p.fxa)}catch(er){}   // 9E: 날아가던 기술 그림(돌·소용돌이)이 다음 전투에 남던 문제
  if(fxOn()){try{for(let i=0;i<4;i++){C.fxe.VFX.update(3)}C.fxe.FX2.clear();C.fxe.VFX.clear&&C.fxe.VFX.clear()}catch(er){}}
  W.root.remove();IN.keys={};IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};IN.press=[];IN.hold={};IN.roll=0;
  try{const hpBy=Object.assign({},W.hpBy);hpBy[W.me.mon.uid]=W.me.hp/(W.me.hm||1);window.RTB.last={r,meHp:W.me.hp/(W.me.hm||1),meMax:W.me.max/(W.me.hm||1),foeHp:W.foe.hp,foeMax:W.foe.max,time:W.time,meUid:W.me.mon.uid,hpBy,used:W.used.slice()}}catch(er){}   // 6F-2: 진짜 전투가 체력을 되받아 감
  const res=W.res;W=null;res(r);
}
async function start(ctx){
  if(W)return 'quit';
  C=ctx;
  const [S1,S2]=await Promise.all([C.getSpr(C.sprKey(C.me)),C.getSpr(C.sprKey(C.foe))]);
  W={tick:0,time:0,hitstop:0,proj:[],zones:[],delays:[],chain:[],fx:[],clones:[],over:null,overT:0,hpBy:{},used:[C.me.uid],swCd:0,itCd:0};
  try{C.fxe&&C.fxe.VFX.clear&&C.fxe.VFX.clear();C.fxe&&C.fxe.FX2.clear()}catch(er){}   // 9E: 지난 전투 그림 지우고 시작
  W.me=mkEnt(C.me,S1,0);W.foe=mkEnt(C.foe,S2,1);
  const AT=AI_T[C.aiTier]||AI_T.W;
  W.ai={T:AT,tier:AI_T[C.aiTier]?C.aiTier:'W',sawT:0,t:0,s:1,cd:1.2,range:240,tok:Math.min(AT.tokenCap,2),hes:0,burst:0,side:0,phase:'press',pt:rr(AT.pressMinSec,AT.pressMaxSec)};
  // AI 기본 사거리: 가진 기술 중 위력 높은 기술 기준
  const best=W.foe.moves.filter(m=>m.p>0).sort((a,b)=>b.p-a.p)[0];
  if(best)W.ai.range=best.k==='melee'?120:best.k==='pulse'?150:best.k==='leap'?170:300;
  if(C.autoMe){W.aiMe=mkAi(AI_T[C.autoTier]?C.autoTier:'T4');W.aiMe.uid=W.me.mon.uid;W.aiMe.range=aiRange(W.me)}
  buildUI();
  if(C.autoMe){const t=document.createElement('div');t.style.cssText='position:absolute;left:50%;top:calc(8px + env(safe-area-inset-top));transform:translateX(-50%);padding:4px 12px;border-radius:8px;background:rgba(0,0,0,.55);color:#9bf0a8;font:bold 13px sans-serif;pointer-events:none;white-space:nowrap;border:2px solid #9bf0a8';W.root.appendChild(t);W.autoTag=t}
  return new Promise(res=>{
    W.res=res;let last=performance.now(),acc=0;
    const loop=now=>{
      if(!W||W.stopped)return;
      let dt=Math.min(.1,(now-last)/1000);last=now;acc+=dt;let n=0;
      if(W.paused){acc=0}else while(acc>=TICK&&n<5){update();acc-=TICK;n++;if(W.over)W.overT+=TICK}
      if(n>=5)acc=0;
      if(C.autoMe){if(W.over&&W.overT>1.6&&!W.pp&&!W.ip){stop(W.over);return}
        if(W.autoTag){const a=autoNow(),tx=a?'🤖 자동 전투 중 · 화면을 만지면 직접 조작':'✋ 직접 조작 중 · 손 떼면 자동';if(W.autoTag._t!==tx){W.autoTag._t=tx;W.autoTag.textContent=tx;W.autoTag.style.color=a?'#9bf0a8':'#ffd23f';W.autoTag.style.borderColor=a?'#9bf0a8':'#ffd23f'}}}
      if(fxOn()&&!W.paused){try{C.fxe.FX2.update(dt);C.fxe.VFX.update(dt)}catch(er){}}
      render();
      W.raf=requestAnimationFrame(loop)};
    W.raf=requestAnimationFrame(loop);
  });
}
window.RTB={_pop:(x,y,v,crit,sk)=>{if(W)dmgPop(x,y,null,'#fff',1,v,crit,sk)},start,_dbg:()=>W,_step:n=>{for(let i=0;i<n&&W&&!W.over;i++){update();}},_press:i=>IN.press.push({i,aim:null}),_stop:r=>stop(r||'quit')};
})();
