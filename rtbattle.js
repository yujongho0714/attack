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
  let d=C.RZM&&C.RZM[id];
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
  return {id,d,name:d.n,type:d.t,p,st,k,kd:d.kd,g,melee,su:Math.round(su),cd,hasted:cdi.hasted,phys:d.c===0,exec,fx,selfko:opsOf(d).includes('selfKO'),rech:opsOf(d).includes('recharge'),hits:hitsOf(d),mh:(d.ef||[]).find(x=>x.op==='multiHit')||null};
}

// ---------- 개체 ----------
function mkEnt(mon,S,side){
  const s=C.stOf(mon);
  let sc=2;
  try{const A=S&&S.meta&&S.meta.anims&&(S.meta.anims.idle);if(A)sc=clamp(130/Math.max(A.w,A.h),1,4)}catch(e){}
  const size=96;
  const e={mon,S,side,x:side?970:230,y:380,vx:0,vy:0,kx:0,ky:0,face:{x:side?-1:1,y:0},
    st:s,hp:s[0],max:s[0],lv:Math.min(100,mon.lv||50),types:(C.META[mon.n]||{types:['NORMAL']}).types,
    sc,r:8+.36*size*.5+10,spd:clamp(128+.65*s[5],125,250),
    moves:(mon.moves||[]).slice(0,4).map(moveInfo),cd:[0,0,0,0],cdMax:[1,1,1,1],
    rc:2,rollT:0,rdx:0,rdy:0,inv:0,stun:0,cast:null,buf:null,
    stg:{atk:0,def:0,spa:0,spd:0,spe:0},stgT:0,
    ail:{},hidden:false,protect:0,critWin:0,anim:'idle',at:0,row:side?6:2,blink:0,hold:0,beam:null,counter:0,flash:0};
  e.haste=hasteOf(s[5]);
  e.moves.forEach((m,i)=>{e.cdMax[i]=m.cd*(m.hasted?e.haste:1)});
  return e;
}
const foeOf=e=>e===W.me?W.foe:W.me;
const spdOf=e=>{let v=e.spd*stageMul(e.stg.spe);if(e.ail.paralysis)v*=.6;return clamp(v,60,320)};

// ---------- 데미지 ----------
function floatTxt(x,y,t,col,big){W.fx.push({k:'txt',x,y,t:0,life:.9,s:t,c:col||'#fff',big:!!big})}
function dealDamage(att,def,mi,opt){
  opt=opt||{};
  if(def.hp<=0)return 0;
  const m=att.moves[mi]||opt.mi;
  if(def.hidden){return 0}
  if(def.protect>0){floatTxt(def.x,def.y-60,'막았다!','#9be7ff');W.fx.push({k:'ring',x:def.x,y:def.y,t:0,life:.3,r:70,c:'#9be7ff'});return 0}
  if(def.rollT>0){
    const t=14-def.rollT; // 지난 틱 (0~13)
    if(t>=1&&t<=10){
      if(t<=4&&!def.perfect){def.perfect=1;def.rc=Math.min(2,def.rc+1);def.critWin=1;floatTxt(def.x,def.y-70,'완벽 회피!','#ffe14a',true);W.hitstop=Math.max(W.hitstop,.08)}
      return 0}
  }
  if(def.inv>0){return 0}
  const A=m.phys?att.st[1]:att.st[3], D=m.phys?def.st[2]:def.st[4];
  const Am=stageMul(m.phys?att.stg.atk:att.stg.spa), Dm=stageMul(m.phys?def.stg.def:def.stg.spd);
  const e=C.eff(m.type,def.types);
  const stab=att.types.includes(m.type)?1.5:1;
  const crit=rnd()<(att.critWin>0?.5:1/24);
  let power=m.p*(opt.pm||1);
  let base=((2*att.lv/5+2)*power*(A*Am)/Math.max(1,D*Dm)/50+2);
  let dmg=base*.52*stab*e*(.85+rnd()*.15)*(crit?1.5:1)*(m.melee&&m.phys?1.15:1);
  if(att.ail.burn&&m.phys)dmg*=.5;
  if(opt.mult)dmg*=opt.mult;
  if(m.exec&&def.lv>att.lv)dmg*=.5;               // 즉사기: 상대 레벨이 높으면 절반
  let fixedDmg=null;
  if(m.fx){const f=m.fx;
    fixedDmg=f.mode==='flat'?(f.value||0):f.mode==='level'?att.lv:f.mode==='levelRandom'?Math.floor(att.lv*(.5+rnd())):
      f.mode==='fracTargetHp'?def.hp*(f.value||.5):f.mode==='userCurrentHp'?att.hp:f.mode==='targetHpMinusUserHp'?Math.max(0,def.hp-att.hp):
      f.mode==='leaveAtLeast1Hp'?Math.min(dmg,def.hp-1):null}
  if(fixedDmg!=null)dmg=fixedDmg;
  if(opt.fixed)dmg=opt.fixed;
  const capped=fixedDmg!=null||opt.fixed?dmg:Math.min(dmg,def.max*.6);
  dmg=Math.max(e===0?0:1,Math.round(capped));
  if(e===0)dmg=0;
  def.hp=Math.max(0,def.hp-dmg);
  def.flash=.15;
  if(dmg>0){
    floatTxt(def.x+(rnd()-.5)*40,def.y-70,String(dmg),e>1?'#ffb030':crit?'#ffe14a':'#fff',e>1||crit);
    if(e>1)floatTxt(def.x,def.y-95,'효과 굉장!','#ffb030');
    if(e<1&&e>0)floatTxt(def.x,def.y-95,'별로…','#9bb');
  } else floatTxt(def.x,def.y-70,'효과 없음','#9bb');
  if(att.critWin>0&&crit)att.critWin=0;
  // 다단 기술: 첫 타가 맞으면 나머지 타를 간격(근접 8틱·원거리 6틱)으로 이어서 침
  if(dmg>0&&m.hits>1&&!opt.chain&&!opt.mult&&m.mh){const mh=m.mh;let n=m.hits;
    if(mh.n==null&&mh.min!=null){const dist=mh.dist||[.35,.35,.15,.15];let r=rnd(),i=0;for(;i<dist.length-1&&r>dist[i];i++)r-=dist[i];n=mh.min+i}
    if(n>1)W.chain.push({o:att,mi:att.moves.indexOf(m)>=0?mi:mi,n:n-1,t:m.melee?8:6,iv:m.melee?8:6,melee:m.melee})}
  // 자폭기: 쓰면 기절
  if(m.selfko&&att.hp>0&&!att._ko){att._ko=1;att.hp=0;floatTxt(att.x,att.y-90,'쓰러졌다','#f88')}
  W.hitstop=Math.max(W.hitstop,HSTOP[m.g]);
  // 경직·넉백·끊기
  const dirv=norm(def.x-att.x,def.y-att.y);
  const kb=KB[m.g]*Math.max(.4,1-(def.r-30)/160);
  const interrupt=def.cast&&def.cast.phase==='startup'&&(def.cast.mv.g>=3?m.g>=2:m.g>=1);
  const buffBreak=def.cast&&def.cast.mv.k==='self'&&def.cast.phase==='startup'&&m.g>=1;
  const beamBreak=def.cast&&def.cast.mv.k==='beam'&&def.cast.phase==='active'&&m.g>=2;
  const dc=def.cast;
  if(dc&&dc.phase==='startup'&&!interrupt&&!buffBreak){def.kx+=dirv.x*kb*2;def.ky+=dirv.y*kb*2}   // 버팀: 끊기지 않고 조금만 밀림
  else if(dc&&dc.phase==='active'&&dc.mv.k==='beam'&&!beamBreak){def.kx+=dirv.x*kb;def.ky+=dirv.y*kb}
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
  if(hurt&&i>=0)e.cd[i]=e.cdMax[i]*.5;
  e.cast=null;e.beam=null;e.hidden=false;
}
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
  return m&&e.cd[i]<=0&&!e.cast&&e.stun<=0&&e.rollT<=0&&e.hp>0&&!e.ail.sleep&&!e.ail.freeze&&!W.over;
}
function startCast(e,i,aimDir){
  const m=e.moves[i];
  const cast={mi:i,mv:m,phase:'startup',t:0,su:m.su,aim:Math.atan2(aimDir.y,aimDir.x),want:Math.atan2(aimDir.y,aimDir.x)};
  e.cast=cast;
  e.cd[i]=e.cdMax[i]; // 쏘는 순간부터 쿨타임
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
    if(c.t>=c.len){e.cast=null;e.anim='idle'}
  }
}
function toRecovery(e,c){phaseTo(e,'recovery',c.mv.rech?150:REC[c.mv.g]);c.rooted=!!c.mv.rech;e.anim='idle'}
function aimVec(c){return{x:Math.cos(c.aim),y:Math.sin(c.aim)}}
function circleHit(e,c,cx,cy,rad,tgt,opt){
  if(tgt.hp<=0)return false;
  if(len(tgt.x-cx,tgt.y-cy)<=rad+tgt.r){dealDamage(e,tgt,c.mi,opt);return true}
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
      W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.5,r:60,c:C.TCOL[m.type]||'#fff'});
      c.phase='active';c.t=0;c.len=1;toRecovery(e,c);return;
    }
  }
  if(k==='melee'){
    c.dash=120*(heavy?1.5:1);c.moved=0;c.len=Math.max(ACTIVE_MELEE[g],8);phaseTo(e,'active',c.len);c.dir=u;c.reach=70+(heavy?20:0)+10;c.half=(heavy?65:50)*Math.PI/180;
    W.fx.push({k:'slash',x:e.x,y:e.y,t:0,life:.25,a:c.aim,c:C.TCOL[m.type]||'#fff',r:c.reach+e.r});
  } else if(k==='leap'){
    let d=tgt.hp>0?clamp(len(tgt.x-e.x,tgt.y-e.y),30,175):105;
    c.tx=e.x+u.x*d;c.ty=e.y+u.y*d;c.sx=e.x;c.sy=e.y;phaseTo(e,'active',20);
  } else if(k==='roll'){
    phaseTo(e,'active',180);c.spd=350;c.hitCd=0;c.dir=u;
  } else if(k==='vanish'){
    const T=clamp(.35+m.p/120,.35,1.6);phaseTo(e,'active',Math.round(T*60));e.hidden=true;c.dir=u;
  } else if(k==='projectile'){
    const special=!m.phys;
    W.proj.push({o:e,mi:c.mi,x:e.x+u.x*e.r,y:e.y+u.y*e.r,dx:u.x,dy:u.y,sp:special?480:430,r:heavy?20:13,range:690,tr:0,col:C.TCOL[m.type]||'#fff',st:m.st});
    toRecovery(e,c);
  } else if(k==='beam'){
    const T=clamp(m.p/150,1.1,1.8);phaseTo(e,'active',Math.round(T*60));c.L=0;c.maxL=clamp(360+m.p*1.5,360,690);
    c.dmgMul=Math.min(1,12/(T*60))*1.25;
  } else if(k==='pulse'){
    const cone=m.kd==='cone';const R=205;
    W.fx.push({k:cone?'cone':'ring',x:e.x,y:e.y,a:c.aim,t:0,life:.35,r:R,c:C.TCOL[m.type]||'#fff'});
    let hit=false;
    if(tgt.hp>0){
      const dx=tgt.x-e.x,dy=tgt.y-e.y,d=len(dx,dy);
      if(d<=R+tgt.r){
        if(!cone||Math.abs(angDiff(c.aim,Math.atan2(dy,dx)))<=60*Math.PI/180||d<e.r+tgt.r+10){hit=true;dealDamage(e,tgt,c.mi)}}}
    if(hit&&m.st)applyEf(e,tgt,m,true);
    toRecovery(e,c);
  } else if(k==='zone'){
    const d=Math.min(230,tgt.hp>0?len(tgt.x-e.x,tgt.y-e.y):230);
    W.zones=W.zones.filter(z=>z.o!==e||false);
    W.zones.push({o:e,mi:c.mi,x:clamp(e.x+u.x*d,WALL,AW-WALL),y:clamp(e.y+u.y*d,WALL,AH-WALL),r:62,life:25,tick:1.5,col:C.TCOL[m.type]||'#fff',st:m.st});
    toRecovery(e,c);
  } else if(k==='delayed'){
    W.delays.push({o:e,mi:c.mi,x:tgt.x,y:tgt.y,t:2.2,r:58,col:C.TCOL[m.type]||'#fff',lock:false,tgt});
    toRecovery(e,c);
  } else if(k==='target'){
    if(tgt.hp>0&&len(tgt.x-e.x,tgt.y-e.y)<=550+tgt.r){
      W.fx.push({k:'beamline',x:e.x,y:e.y,x2:tgt.x,y2:tgt.y,t:0,life:.25,c:C.TCOL[m.type]||'#fff'});
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
      if(d<=c.reach+tgt.r&&(Math.abs(angDiff(c.aim,Math.atan2(dy,dx)))<=c.half||d<e.r+tgt.r+14)){
        c.hit=true;dealDamage(e,tgt,c.mi);if(m.st)applyEf(e,tgt,m,true)}}
    if(c.t>=c.len)toRecovery(e,c);
  } else if(k==='leap'){
    const p=c.t/20;e.x=c.sx+(c.tx-c.sx)*p;e.y=c.sy+(c.ty-c.sy)*p;e.lift=Math.sin(p*Math.PI)*48;
    if(c.t>=20){e.lift=0;W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,r:34+e.r,c:C.TCOL[m.type]||'#fff'});circleHit(e,c,e.x,e.y,34+e.r*.3,tgt);toRecovery(e,c)}
  } else if(k==='roll'){
    c.spd=Math.min(700,350*(1+Math.floor(c.t/22)*.14));
    if(tgt.hp>0){const dd=norm(tgt.x-e.x,tgt.y-e.y);const a=Math.atan2(c.dir.y,c.dir.x),b=Math.atan2(dd.y,dd.x);const na=a+clamp(angDiff(a,b),-3*TICK,3*TICK);c.dir={x:Math.cos(na),y:Math.sin(na)}}
    e.x+=c.dir.x*c.spd*TICK;e.y+=c.dir.y*c.spd*TICK;e.row=dirRow(c.dir.x,c.dir.y);
    c.hitCd--;
    if(c.hitCd<=0&&tgt.hp>0&&len(tgt.x-e.x,tgt.y-e.y)<=e.r+tgt.r+8){c.hitCd=33;dealDamage(e,tgt,c.mi)}
    if(e.x<WALL+e.r||e.x>AW-WALL-e.r||e.y<WALL+e.r||e.y>AH-WALL-e.r)c.t=Math.max(c.t,c.len-1);
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
      if(al>=0&&al<=c.L+tgt.r&&pe<=tgt.r+22){dealDamage(e,tgt,c.mi,{mult:c.dmgMul||.25,pm:1})}}
    if(c.t>=c.len){e.beam=null;toRecovery(e,c)}
  } else {toRecovery(e,c)}
}

// ---------- 진행 ----------
function update(){
  const me=W.me,foe=W.foe;
  W.tick++;
  if(W.hitstop>0){W.hitstop-=TICK;return}
  W.time+=TICK;
  playerInput(me);
  aiUpdate(foe);
  for(const e of [me,foe]){
    if(e.hp<=0)continue;
    e.at+=TICK;
    e.flash=Math.max(0,e.flash-TICK);e.critWin=Math.max(0,e.critWin-TICK);e.protect=Math.max(0,e.protect-TICK);e.counterT=Math.max(0,(e.counterT||0)-TICK);
    e.healRep=Math.max(0,(e.healRep||0)-TICK);
    {const dm=e.moves.map((m,j)=>m&&!m.st?j:-1).filter(j=>j>=0);
     const allCool=dm.length>0&&dm.every(j=>e.cd[j]>0); // 공격기가 전부 쿨타임 중이면 빨리 돈다
     for(let i=0;i<4;i++){const m=e.moves[i];const r=(e.ail.paralysis?CD.paraRate:1)*(allCool&&m&&!m.st?CD.cadence:1);e.cd[i]=Math.max(0,e.cd[i]-TICK*r)}}
    // 구르기 충전
    if(e.rc<2)e.rc=Math.min(2,e.rc+TICK/3.2);
    // 상태이상
    for(const s in e.ail){e.ail[s]-=TICK;
      if(s==='burn'&&W.tick%60===0){const d=Math.max(1,Math.round(e.max*.01));e.hp=Math.max(0,e.hp-d);floatTxt(e.x,e.y-60,String(d),'#f84')}
      if(s==='poison'&&W.tick%60===0){const d=Math.max(1,Math.round(e.max*.015));e.hp=Math.max(0,e.hp-d);floatTxt(e.x,e.y-60,String(d),'#c6c')}
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
    if(e.rollT<=0&&e.stun<=0&&!(e.cast&&e.cast.phase==='active'&&e.cast.mv.k!=='beam')){
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
    const st=p.sp*TICK;p.x+=p.dx*st;p.y+=p.dy*st;p.tr+=st;
    const tgt=foeOf(p.o);
    if(tgt.hp>0&&len(tgt.x-p.x,tgt.y-p.y)<=p.r+tgt.r*.8){
      const d=dealDamage(p.o,tgt,p.mi);if(p.st)applyEf(p.o,tgt,p.o.moves[p.mi],true);
      p.dead=1;W.fx.push({k:'burst',x:p.x,y:p.y,t:0,life:.25,r:p.r*2.2,c:p.col});
    } else if(p.tr>p.range||p.x<WALL||p.x>AW-WALL||p.y<WALL||p.y>AH-WALL){p.dead=1;W.fx.push({k:'burst',x:p.x,y:p.y,t:0,life:.2,r:p.r*1.5,c:p.col})}
  }
  // 발사체끼리 충돌 (반지름 비 1.5 이상이면 큰 쪽이 압도, 아니면 상쇄)
  for(let i=0;i<W.proj.length;i++)for(let j=i+1;j<W.proj.length;j++){
    const a=W.proj[i],b=W.proj[j];if(a.dead||b.dead||a.o===b.o)continue;
    if(len(a.x-b.x,a.y-b.y)<=a.r+b.r){const ra=a.r/b.r;if(ra>=1.5)b.dead=1;else if(ra<=1/1.5)a.dead=1;else{a.dead=b.dead=1}
      W.fx.push({k:'burst',x:(a.x+b.x)/2,y:(a.y+b.y)/2,t:0,life:.25,r:30,c:'#fff'})}
  }
  W.proj=W.proj.filter(p=>!p.dead);
  // 장판
  for(const z of W.zones){z.life-=TICK;z.tick-=TICK;
    if(z.tick<=0){z.tick=1.5;const t=foeOf(z.o);if(t.hp>0&&len(t.x-z.x,t.y-z.y)<=z.r+t.r*.5&&!t.hidden){const d=Math.max(1,Math.round(t.max*.0625));t.hp=Math.max(0,t.hp-d);floatTxt(t.x,t.y-70,String(d),z.col);if(z.st)applyEf(z.o,t,z.o.moves[z.mi],true)}}}
  W.zones=W.zones.filter(z=>z.life>0);
  // 내려찍기
  for(const d of W.delays){d.t-=TICK;
    if(d.t>.5&&d.tgt.hp>0){d.x=d.tgt.x;d.y=d.tgt.y}
    if(d.t<=0){d.dead=1;W.fx.push({k:'ring',x:d.x,y:d.y,t:0,life:.35,r:d.r,c:d.col});const t=foeOf(d.o);if(t.hp>0&&len(t.x-d.x,t.y-d.y)<=d.r+t.r*.5)dealDamage(d.o,t,d.mi)}}
  W.delays=W.delays.filter(d=>!d.dead);
  for(const h of W.chain){const t=foeOf(h.o);
    if(h.o.hp<=0||t.hp<=0||h.o.stun>0||h.o.hidden){h.dead=1;continue}
    h.t--;if(h.t>0)continue;
    const m=h.o.moves[h.mi];
    if(!h.melee||len(t.x-h.o.x,t.y-h.o.y)<=h.o.r+t.r+110){dealDamage(h.o,t,h.mi,{chain:1});if(m&&!h.melee)W.fx.push({k:'burst',x:t.x,y:t.y-20,t:0,life:.2,r:24,c:C.TCOL[m.type]||'#fff'})}
    h.n--;h.t=h.iv;if(h.n<=0)h.dead=1}
  W.chain=W.chain.filter(h=>!h.dead);
  // 효과 시간
  for(const f of W.fx)f.t+=TICK;W.fx=W.fx.filter(f=>f.t<f.life);
  // 승패
  if(!W.over){
    if(foe.hp<=0&&me.hp<=0)finish('draw');else if(foe.hp<=0)finish('win');else if(me.hp<=0)finish('lose');
    else if(W.time>=180){finish(me.hp/me.max>=foe.hp/foe.max?(me.hp/me.max===foe.hp/foe.max?'draw':'win'):'lose')}
  }
}
function finish(r){W.over=r;W.overT=0;(r==='win'?[W.foe]:[W.me]).forEach(e=>{e.anim='hurt';e.at=0})}

// ---------- 입력 ----------
const IN={keys:{},stick:{on:0,id:null,sx:0,sy:0,x:0,y:0},press:[],roll:0,btn:[null,null,null,null]};
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
  while(IN.press.length){const p=IN.press.shift();me.buf={i:p.i,aim:p.aim,t:9}}
}
function doRoll(e){
  if(e.rollT>0||e.rc<1||e.stun>0||e.hp<=0)return;
  if(e.cast&&e.cast.phase!=='recovery')return;
  let d=e.wish&&len(e.wish.x,e.wish.y)>.2?norm(e.wish.x,e.wish.y):(e.face||{x:1,y:0});
  e.cast=null;e.beam=null;e.hidden=false;
  e.rollT=14;e.rdx=d.x;e.rdy=d.y;e.rc-=1;e.perfect=0;e.row=dirRow(d.x,d.y);
  W.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.2,r:40,c:'#ffffff'});
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
  if(canCast(e,e.buf.i)){const b=e.buf;e.buf=null;startCast(e,b.i,aimFor(e,b.aim))}
}

// ---------- AI (야생 단계) ----------
function aiUpdate(a){
  const ai=W.ai,p=W.me;
  if(a.hp<=0){a.wish={x:0,y:0};return}
  ai.react=Math.max(0,ai.react-TICK);
  const d=len(p.x-a.x,p.y-a.y);
  const to=norm(p.x-a.x,p.y-a.y);
  // 회피: 상대가 준비/발동 중이면 반응 시간 뒤 구르기 확률
  const threat=p.cast&&(p.cast.phase==='startup'||p.cast.phase==='active')&&p.cast.mv.p>0||W.proj.some(q=>q.o===p&&len(q.x-a.x,q.y-a.y)<220);
  if(threat&&!ai.sawT){ai.sawT=ai.rt=.2+rnd()*.25}
  if(!threat)ai.sawT=0;
  if(ai.sawT>0){ai.sawT-=TICK;if(ai.sawT<=0&&a.rc>=1&&!a.cast){
    const k=p.cast?p.cast.mv.k:'projectile';const pr=k==='projectile'?.63:k==='melee'?.43:(k==='pulse'||k==='delayed'||k==='zone')?.73:.68;
    if(rnd()<pr*.8){const s=rnd()<.5?1:-1;a.wish={x:-to.y*s,y:to.x*s};doRoll(a)}}}
  // 이동: 가장 쓸 만한 기술의 사거리를 맞춤
  ai.t-=TICK;
  if(ai.t<=0){ai.t=.8+rnd()*.8;ai.mode=rnd()<.25?'strafe':'press';ai.s=rnd()<.5?1:-1}
  const range=ai.range||250;
  if(!a.cast&&a.stun<=0&&a.rollT<=0){
    let wx=0,wy=0;
    if(ai.mode==='strafe'){wx=-to.y*ai.s*.8+to.x*(d>range?.5:-.2);wy=to.x*ai.s*.8+to.y*(d>range?.5:-.2)}
    else if(d>range){wx=to.x;wy=to.y}else if(d<range*.5){wx=-to.x*.6;wy=-to.y*.6}
    a.wish={x:wx,y:wy};
  } else a.wish={x:0,y:0};
  // 공격
  ai.cd=Math.max(0,ai.cd-TICK);
  if(ai.cd<=0&&!a.cast&&a.stun<=0&&a.rollT<=0){
    const opts=[];
    a.moves.forEach((m,i)=>{if(!canCast(a,i))return;
      const R=m.k==='melee'?180:m.k==='leap'?220:m.k==='pulse'?205:m.k==='beam'?400:m.k==='projectile'?500:m.k==='delayed'?500:m.k==='target'?500:m.k==='zone'?230:m.k==='vanish'?300:m.k==='roll'?350:9999;
      if(m.k==='self'){if(m.d.ef&&m.d.ef.some(x=>x.op==='heal')&&a.hp<a.max*.5)opts.push([i,5]);else if(rnd()<.15)opts.push([i,1]);return}
      if(m.p<=0&&rnd()<.5)return;
      if(d<=R)opts.push([i,2+m.p/50]);
    });
    if(opts.length){let tot=opts.reduce((s,o)=>s+o[1],0),r=rnd()*tot,pick=opts[0][0];for(const o of opts){r-=o[1];if(r<=0){pick=o[0];break}}
      // 조준 오차 ±8도, 선두 조준은 생략
      const base=Math.atan2(to.y,to.x)+(rnd()-.5)*16*Math.PI/180;
      startCast(a,pick,{x:Math.cos(base),y:Math.sin(base)});ai.cd=.4+rnd()*.7}
  }
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
  cx.setTransform(sc,0,0,sc,Wd/2-W.cam.x*sc,Hd/2-W.cam.y*sc);
  // 바닥
  const g=cx.createLinearGradient(0,0,0,AH);g.addColorStop(0,'#5e8f55');g.addColorStop(1,'#487244');
  cx.fillStyle=g;cx.fillRect(0,0,AW,AH);
  cx.strokeStyle='rgba(255,255,255,.07)';cx.lineWidth=2;
  for(let x=0;x<=AW;x+=100){cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,AH);cx.stroke()}
  for(let y=0;y<=AH;y+=100){cx.beginPath();cx.moveTo(0,y);cx.lineTo(AW,y);cx.stroke()}
  cx.strokeStyle='#e8f0d8';cx.lineWidth=6;cx.strokeRect(WALL-3,WALL-3,AW-WALL*2+6,AH-WALL*2+6);
  // 장판/예고
  for(const z of W.zones){cx.globalAlpha=.35;cx.fillStyle=z.col;cx.beginPath();cx.ellipse(z.x,z.y,z.r,z.r*.7,0,0,7);cx.fill();cx.globalAlpha=1;cx.strokeStyle='#fff';cx.lineWidth=2;cx.stroke()}
  for(const d of W.delays){const al=d.t>.5?.25:.35+.3*Math.sin(W.time*30);cx.globalAlpha=al;cx.fillStyle='#ff4a3a';cx.beginPath();cx.ellipse(d.x,d.y,d.r,d.r*.7,0,0,7);cx.fill();cx.globalAlpha=1;cx.strokeStyle='#fff';cx.lineWidth=2;cx.stroke()}
  // 개체
  const ents=[me,foe].sort((a,b)=>a.y-b.y);
  for(const e of ents){
    if(e.hp<=0&&W.over&&W.overT>.8&&e!==me&&e!==foe)continue;
    cx.globalAlpha=e.hidden?.25:(e.hp<=0?Math.max(.15,1-W.overT*.8):1);
    cx.fillStyle='rgba(0,0,0,.3)';cx.beginPath();cx.ellipse(e.x,e.y+6,e.r*.9,e.r*.4,0,0,7);cx.fill();
    // 조준 예고 (준비 중, 내 것만)
    if(e.cast&&e.cast.phase==='startup'&&e===me){const c=e.cast;cx.globalAlpha=.25;cx.strokeStyle='#fff';cx.lineWidth=3;cx.setLineDash([10,8]);cx.beginPath();cx.moveTo(e.x,e.y);cx.lineTo(e.x+Math.cos(c.aim)*220,e.y+Math.sin(c.aim)*220);cx.stroke();cx.setLineDash([]);cx.globalAlpha=1}
    if(e.cast&&e.cast.phase==='startup'&&e!==me){const c=e.cast;cx.globalAlpha=.3;cx.strokeStyle='#ff6a5a';cx.lineWidth=4;cx.beginPath();cx.moveTo(e.x,e.y);cx.lineTo(e.x+Math.cos(c.aim)*200,e.y+Math.sin(c.aim)*200);cx.stroke();cx.globalAlpha=1}
    if(e.beam){const b=e.beam;cx.save();cx.translate(e.x,e.y-(e.lift||0)-20);cx.rotate(b.a);const gg=cx.createLinearGradient(0,0,b.L,0);gg.addColorStop(0,'#fff');gg.addColorStop(1,b.col);cx.globalAlpha=.85;cx.fillStyle=gg;cx.fillRect(0,-18,b.L,36);cx.globalAlpha=.9;cx.fillStyle='#fff';cx.fillRect(0,-6,b.L,12);cx.restore();cx.globalAlpha=1}
    const st=e.anim;
    try{C.drawPm(cx,e.S,st,e.row,e.at,e.x,e.y-(e.lift||0)-18,e.sc,{loop:!(st==='attack'||st==='hurt'||st==='shoot'),white:e.flash>0,alpha:cx.globalAlpha})}catch(er){cx.fillStyle='#fff';cx.beginPath();cx.arc(e.x,e.y-30,30,0,7);cx.fill()}
    cx.globalAlpha=1;
    if(e.protect>0){cx.strokeStyle='#9be7ff';cx.lineWidth=4;cx.globalAlpha=.8;cx.beginPath();cx.ellipse(e.x,e.y-30,e.r+14,e.r+14,0,0,7);cx.stroke();cx.globalAlpha=1}
    // 머리 위 작은 HP바
    const bw=90,bx=e.x-bw/2,by=e.y-e.r*1.9-28;
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(bx-2,by-2,bw+4,10);
    const rr=Math.max(0,e.hp/e.max);cx.fillStyle=rr>.5?'#3be06a':rr>.2?'#ffc83a':'#ff4a3a';cx.fillRect(bx,by,bw*rr,6);
  }
  // 발사체
  for(const p of W.proj){cx.globalAlpha=.9;cx.fillStyle=p.col;cx.beginPath();cx.arc(p.x,p.y-24,p.r,0,7);cx.fill();cx.fillStyle='#fff';cx.beginPath();cx.arc(p.x,p.y-24,p.r*.5,0,7);cx.fill();cx.globalAlpha=1}
  // 효과
  for(const f of W.fx){const u=f.t/f.life;cx.save();cx.globalAlpha=Math.max(0,1-u);
    if(f.k==='txt'){cx.font=(f.big?'bold 34px':'bold 24px')+' sans-serif';cx.textAlign='center';cx.lineWidth=5;cx.strokeStyle='#000';cx.fillStyle=f.c;const y=f.y-u*40;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='callout'){cx.font='bold 22px sans-serif';cx.textAlign='center';cx.lineWidth=4;cx.strokeStyle='#000';cx.fillStyle=f.c;const y=f.y-u*14;cx.strokeText(f.s,f.x,y);cx.fillText(f.s,f.x,y)}
    else if(f.k==='burst'){cx.fillStyle=f.c;cx.beginPath();cx.arc(f.x,f.y,f.r*(.4+u*.8),0,7);cx.fill()}
    else if(f.k==='ring'){cx.strokeStyle=f.c;cx.lineWidth=8;cx.beginPath();cx.ellipse(f.x,f.y,f.r*(.3+u*.7),f.r*(.3+u*.7)*.7,0,0,7);cx.stroke()}
    else if(f.k==='cone'){cx.fillStyle=f.c;cx.beginPath();cx.moveTo(f.x,f.y);cx.arc(f.x,f.y,f.r*(.4+u*.6),f.a-Math.PI/3,f.a+Math.PI/3);cx.closePath();cx.fill()}
    else if(f.k==='slash'){cx.strokeStyle=f.c;cx.lineWidth=14;cx.beginPath();cx.arc(f.x,f.y,f.r*.8,f.a-.9+u*.5,f.a+.9+u*.5);cx.stroke()}
    else if(f.k==='beamline'){cx.strokeStyle=f.c;cx.lineWidth=10;cx.beginPath();cx.moveTo(f.x,f.y-20);cx.lineTo(f.x2,f.y2-20);cx.stroke()}
    cx.restore()}
  // ---- 화면 고정 HUD ----
  cx.setTransform(1,0,0,1,0,0);
  hud(cx,Wd,Hd);
}
function hud(cx,Wd,Hd){
  const me=W.me,foe=W.foe,u=Math.max(1,Math.min(Wd,Hd*1.6)/700);
  const bar=(x,y,w,e,right)=>{
    cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(x,y,w,46*u);
    cx.fillStyle='#fff';cx.font='bold '+(15*u)+'px sans-serif';cx.textAlign=right?'right':'left';
    cx.fillText(C.nm(e.mon)+'  Lv.'+e.mon.lv,right?x+w-8*u:x+8*u,y+18*u);
    cx.fillStyle='#222';cx.fillRect(x+8*u,y+26*u,w-16*u,10*u);
    const r=Math.max(0,e.hp/e.max);cx.fillStyle=r>.5?'#3be06a':r>.2?'#ffc83a':'#ff4a3a';cx.fillRect(x+8*u,y+26*u,(w-16*u)*r,10*u);
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
    cx.fillText(W.over==='win'?'승리!':W.over==='lose'?'패배…':'무승부',Wd/2,Hd/2-10*u);
    cx.font=(16*u)+'px sans-serif';cx.fillText('화면을 누르면 돌아가요 (시험 전투라 저장에는 영향 없음)',Wd/2,Hd/2+26*u);
  }
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
  const qb=document.createElement('div');qb.textContent='✕';qb.style.cssText='position:absolute;left:8px;bottom:8px;width:34px;height:34px;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;font:bold 18px sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:auto';ui.appendChild(qb);
  document.body.appendChild(root);
  W.root=root;W.cv=cv;W.ctx=cv.getContext('2d');W.ui={jb,jk,btns,rb,rcnt};
  // 포인터
  const dragStart={};
  const bindBtn=(b,i)=>{
    b.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();b.setPointerCapture(ev.pointerId);dragStart[ev.pointerId]={x:ev.clientX,y:ev.clientY,i}});
    b.addEventListener('pointerup',ev=>{ev.preventDefault();const s=dragStart[ev.pointerId];delete dragStart[ev.pointerId];if(!s)return;
      const dx=ev.clientX-s.x,dy=ev.clientY-s.y;let aim=null;if(Math.hypot(dx,dy)>26)aim=norm(dx,dy);
      if(i===-1)IN.roll=1;else IN.press.push({i,aim})});
    b.addEventListener('pointercancel',ev=>{delete dragStart[ev.pointerId]});
  };
  btns.forEach((b,i)=>bindBtn(b,i));bindBtn(rb,-1);
  qb.addEventListener('pointerdown',ev=>{ev.stopPropagation();if(W.over)return;if(confirm('시험 전투를 그만둘까요?'))stop('quit')});
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
  W.kd=e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;IN.keys[k]=1;
    if(k===' '){IN.roll=1;e.preventDefault()}
    const mk={q:0,w:1,e:2,r:3,'1':0,'2':1,'3':2,'4':3};
    if(k in mk&&!e.repeat)IN.press.push({i:mk[k],aim:null})
    if(k==='Escape'&&!W.over)stop('quit')};
  W.ku=e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;IN.keys[k]=0};
  addEventListener('keydown',W.kd);addEventListener('keyup',W.ku);
  W.rs=()=>{const dpr=Math.min(2,devicePixelRatio||1);cv.width=Math.round(innerWidth*dpr);cv.height=Math.round(innerHeight*dpr)};
  W.rs();addEventListener('resize',W.rs);
}
function updBtns(){
  const me=W.me,U=W.ui;if(!U)return;
  for(let i=0;i<4;i++){const b=U.btns[i];if(!me.moves[i])continue;const r=Math.min(1,me.cd[i]/me.cdMax[i]);b._cd.style.height=(r*100)+'%';b.style.opacity=canCast(me,i)?1:.75}
  U.rb._cd.style.height=(me.rc>=1?0:(1-(me.rc%1))*100)+'%';U.rcnt.textContent='🌀 '+Math.floor(me.rc)+'/2';
}

// ---------- 실행 ----------
function stop(r){
  if(!W||W.stopped)return;W.stopped=1;cancelAnimationFrame(W.raf);
  removeEventListener('keydown',W.kd);removeEventListener('keyup',W.ku);removeEventListener('resize',W.rs);
  W.root.remove();IN.keys={};IN.stick={on:0,id:null,sx:0,sy:0,x:0,y:0};IN.press=[];IN.roll=0;
  const res=W.res;W=null;res(r);
}
async function start(ctx){
  if(W)return 'quit';
  C=ctx;
  const [S1,S2]=await Promise.all([C.getSpr(C.sprKey(C.me)),C.getSpr(C.sprKey(C.foe))]);
  W={tick:0,time:0,hitstop:0,proj:[],zones:[],delays:[],chain:[],fx:[],over:null,overT:0};
  W.me=mkEnt(C.me,S1,0);W.foe=mkEnt(C.foe,S2,1);
  W.ai={react:0,sawT:0,t:0,mode:'press',s:1,cd:1.2,range:240};
  // AI 기본 사거리: 가진 기술 중 위력 높은 기술 기준
  const best=W.foe.moves.filter(m=>m.p>0).sort((a,b)=>b.p-a.p)[0];
  if(best)W.ai.range=best.k==='melee'?120:best.k==='pulse'?150:best.k==='leap'?170:300;
  buildUI();
  return new Promise(res=>{
    W.res=res;let last=performance.now(),acc=0;
    const loop=now=>{
      if(!W||W.stopped)return;
      let dt=Math.min(.1,(now-last)/1000);last=now;acc+=dt;let n=0;
      while(acc>=TICK&&n<5){update();acc-=TICK;n++;if(W.over)W.overT+=TICK}
      if(n>=5)acc=0;
      render();
      W.raf=requestAnimationFrame(loop)};
    W.raf=requestAnimationFrame(loop);
  });
}
window.RTB={start,_dbg:()=>W,_step:n=>{for(let i=0;i<n&&W&&!W.over;i++){update();}},_press:i=>IN.press.push({i,aim:null}),_stop:r=>stop(r||'quit')};
})();
