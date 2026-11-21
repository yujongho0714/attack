/* 월보 떼전투 (WBSW) — 내 포켓몬 최대 20마리가 작게 나와서 보스 1마리와 한꺼번에 싸워요
 * 사용: WBSW.start(ctx) -> Promise<'win'|'lose'|'quit'>  ·  결과는 WBSW.last 에
 *   ctx = {allies:[mon×≤20], boss:mon, SC, getSpr, sprKey, drawPm, stOf, eff, RZM, mv, META, TCOL, nm, thumb(n), sfx, bg(),
 *          dmgMul, gearOf, critOf, numK, bossHit, bossName, minSkip(120), maxTime(300), bossLook, toast}
 * 규칙
 *  - 내가 고른 1마리(▼ 화살표)는 직접 움직이고 기술 버튼으로 공격 · 나머지는 반투명 자동 · 3초 안 만지면 그 포켓몬도 자동
 *  - [교체]를 누르면 일시정지 → 고른 포켓몬이 내 캐릭터가 돼요
 *  - [건너뛰기]는 2분(minSkip) 뒤부터 · 끝까지 빠르게 감아서 결과만 봐요 · 시간 제한 5분(maxTime)
 *  - 전투 안 숫자는 월보 단위 ÷ SC · 화면에는 ×SC 로 보여 줘요 (rtbattle 과 같은 약속)
 */
(function(){
'use strict';
const TICK=1/60, AW=1200, AH=760;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const len=(x,y)=>Math.hypot(x,y);
const dirRow=(dx,dy)=>{const a=Math.atan2(dy,dx);const o=((Math.round(a/(Math.PI/4))%8)+8)%8;return[2,1,0,7,6,5,4,3][o]};
let C=null,W=null;

// ---- 조정값 (밸런스는 여기만 고치면 돼요) ----
const CFG={
  allyPx:58,            // 내 포켓몬 그림 높이(경기장 기준 px) — 작게
  bossPx:400,           // 보스 그림 높이
  allyAlpha:.55,        // 자동으로 움직이는 애들 투명도
  meleeRange:105, rangedRange:300,
  bossEvery:2.3,        // 보스 공격 간격(초) — 시간이 갈수록 빨라져요
  bossRage:.0045,       // 1초마다 공격이 이만큼 더 빨라지고 세져요
  bossAoe:150,          // 보스 장판 반지름
  bossRoarEvery:7,      // 포효(보스 주변 전체) 간격
  autoIdle:3            // 내 캐릭터를 이 시간(초) 안 만지면 자동
};

const fmtN=v=>{v=Math.max(0,Math.round(v));if(v<1e4)return v.toLocaleString('en-US');if(v<1e8){const q=v/1e4;return (q<100?q.toFixed(1):Math.round(q))+'만'}const q=v/1e8;return (q<100?q.toFixed(1):Math.round(q))+'억'};
const rr=(a,b)=>a+Math.random()*(b-a);

// ---- 기술 정보 (rtbattle 의 RZM 그대로 읽기) ----
function moveOf(id){
  let d=(C.RZM&&C.RZM[id])||null,name,type,p,c,k,ex=0;
  if(d){name=d.n;type=d.t;p=d.p|0;c=d.c;k=d.k||'projectile'}
  else{const g=(C.mv&&C.mv(id))||{};name=g.name||id;type=g.type||'NORMAL';p=g.pw|0;c=g.ph?0:1;k=g.ph?'melee':'projectile'}
  const st=c===2||!(p>0);
  const melee=k==='melee'||k==='leap';
  const cd=clamp(1.0+p/75+(melee?0:.25),1.1,4.2);
  return{id,name,type,p:st?0:p,phys:c===0,st,melee,k,cd,range:melee?CFG.meleeRange:k==='pulse'?200:CFG.rangedRange,t:0};
}

function mkEnt(mon,S,side){
  const s=C.stOf(mon);
  const A=S&&S.meta&&S.meta.anims&&S.meta.anims.idle;
  const px=side?CFG.bossPx:CFG.allyPx;
  const sc=A?clamp(px/Math.max(1,A.h),.4,8):2;
  const e={mon,S,side,x:0,y:0,face:{x:side?-1:1,y:0},st:s,hp:s[0],max:s[0],
    lv:Math.min(100,mon.lv||50),types:(C.META[mon.n]||{types:['NORMAL']}).types,
    sc,vis:A?A.h*sc:px,r:side?Math.max(70,px*.28):Math.max(11,px*.22),
    spd:clamp(110+.55*(s[5]||60),110,230),
    moves:(mon.moves||[]).slice(0,4).map(moveOf).filter(m=>m&&m.id),
    anim:'idle',at:Math.random()*2,row:side?6:2,flash:0,cast:0,atkT:0,alive:1,
    dodgeP:clamp((s[5]||60)/190,.25,.8),react:0,seed:Math.random()*6.28};
  if(!e.moves.some(m=>m.p>0))e.moves.push(moveOf('struggle'));
  e.moves.forEach((m,i)=>{m.t=rr(0,m.cd*.6)});
  try{e.critX=C.critOf?C.critOf(mon)||{c:0,d:0}:{c:0,d:0}}catch(er){e.critX={c:0,d:0}}
  try{const g=C.gearOf?C.gearOf(mon):null;if(g){e.gear=g;const hm=1+((g.hp||0)+((g.aA&&g.aA.hp)||0))/100;e.max=Math.round(e.max*hm);e.hp=e.max;e.critX={c:Math.min(.75,e.critX.c+(g.crt||0)/100),d:e.critX.d+(g.cdm||0)/100}}}catch(er){}
  if(!e.side&&mon.hp!=null&&isFinite(mon.hp)){const hm=e.max/(e.st[0]||1);e.hp=clamp(mon.hp*hm,1,e.max)}
  return e;
}

// ---- 데미지 (rtbattle 공식 그대로 · 상대는 보스 1마리) ----
function calcDmg(att,def,m){
  const A=m.phys?att.st[1]:att.st[3],D=m.phys?def.st[2]:def.st[4];
  const e=m.type&&m.id!=='struggle'?C.eff(m.type,def.types):1;
  const stab=att.types.includes(m.type)?1.5:1;
  const cx=att.critX||{c:0,d:0};
  const crit=Math.random()<(1/24+cx.c);
  const _ign=Math.min(.9,((att.gear&&att.gear.aA&&att.gear.aA.ign)||0)/100);   // 9BZ 아티팩트 방어력 무시
  let base=((2*att.lv/5+2)*m.p*A/Math.max(1,D*(1-_ign))/50+2);
  let dmg=base*.52*stab*e*(.85+Math.random()*.15)*(crit?1.5*(1+cx.d):1)*(m.melee&&m.phys?1.15:1);
  if(att.gear&&att.gear.atk)dmg*=1+att.gear.atk/100;
  if(att.gear&&att.gear.aA){const q=att.gear.aA;dmg*=(1+(q.tatk||0)/100)*(1+(q.tdmg||0)/100)*(1+(q.elem||0)/100)*(1+(q.aB||0)/100)}   // 9BZ 아티팩트
  if(C.dmgMul){try{dmg*=+C.dmgMul(att.mon,def.mon,m.id)||1}catch(er){}}
  if(e===0)dmg=0;
  return{d:Math.max(e===0?0:1,Math.round(dmg)),e,crit};
}
function bossDmg(def,e0,pw){
  const hit=(C.bossHit||.08)*(1+W.time*CFG.bossRage);
  const e=Math.min(2,Math.max(.5,C.eff(W.boss.types[0]||'NORMAL',def.types)||1));
  let d=def.max*hit*pw*e*(.85+Math.random()*.15);
  {const _dd=((def.gear&&def.gear.def)||0)+((def.gear&&def.gear.aA&&def.gear.aA.def)||0);if(_dd)d*=1-Math.min(.6,_dd/100)}
  return Math.max(1,Math.round(Math.min(d,def.max*.6)));
}

function pop(x,y,s,col,big){if(W.fx.length>70)W.fx.shift();W.fx.push({k:'txt',x,y,t:0,life:big?1.1:.8,s,c:col||'#fff',big:!!big})}
function ring(x,y,r,col,life){W.fx.push({k:'ring',x,y,t:0,life:life||.4,r,c:col||'#fff'})}

// ---- 한 틱 ----
function update(){
  const B=W.boss;W.tick++;W.time+=TICK;
  for(const e of W.ents){e.at+=TICK;if(e.flash>0)e.flash-=TICK}
  // 투사체
  for(let i=W.proj.length-1;i>=0;i--){
    const p=W.proj[i];p.t+=TICK;
    const dx=B.x-p.x,dy=B.y-p.y,L=len(dx,dy);
    const stp=p.sp*TICK;
    if(L<=stp+B.r*.7||p.t>2){hitBoss(p.o,p.m);if(p.fx&&window.BEAMFX&&!W.ff)try{if(p.wv)BEAMFX.waveCrash(p.x,p.y+10,90,p.x>B.x);else BEAMFX.pimpact(p.m.type,p.x,p.y,p.o===W.me?.5:.3)}catch(er){}W.proj.splice(i,1);continue}
    p.x+=dx/L*stp;p.y+=dy/L*stp;
  }
  // 아군
  const live=W.allies.filter(e=>e.hp>0);
  for(const e of W.allies){
    if(e.hp<=0){if(e.alive){e.alive=0;e.anim='faint';e.at=0;ring(e.x,e.y,50,'#ffffff',.5);if(e===W.me)meDied()}continue}
    const isMe=e===W.me;
    const manual=isMe&&!W.ff&&(W.in.hold||W.keys.l||W.keys.r||W.keys.u||W.keys.d||(W.time-W.touch)<CFG.autoIdle);
    for(const m of e.moves)if(m.t>0)m.t-=TICK;
    if(e.cast>0){e.cast-=TICK;if(e.cast<=0)e.anim='idle'}
    // 이동
    let vx=0,vy=0;
    const dxb=B.x-e.x,dyb=B.y-e.y,Lb=len(dxb,dyb)||1;
    if(manual){const s=W.in;vx=s.x;vy=s.y;if(s.dx||s.dy){vx=s.dx;vy=s.dy}}
    else{
      const best=e.moves.filter(m=>m.p>0).sort((a,b)=>b.p-a.p)[0];
      const want=(best&&best.melee?CFG.meleeRange:CFG.rangedRange*.8)+B.r;
      // 보스 둘레에 자기 자리(각도)를 잡고 흩어져서 싸워요
      const ang=Math.atan2(e.y-B.y,e.x-B.x),idx=W.allies.indexOf(e),n=W.allies.length;
      const slot=Math.PI+((idx+.5)/n-.5)*3.6+Math.sin(W.time*.35+e.seed)*.18;
      const dist=want+(idx%3)*26;
      const gx=B.x+Math.cos(slot)*dist,gy=B.y+Math.sin(slot)*dist*.8;
      const gdx=gx-e.x,gdy=gy-e.y,gl=len(gdx,gdy);
      if(gl>10){const k=Math.min(1,gl/80);vx=gdx/gl*k;vy=gdy/gl*k}
      // 서로 겹치지 않게
      for(const o of live){if(o===e)continue;const ddx=e.x-o.x,ddy=e.y-o.y,d=len(ddx,ddy);if(d>0&&d<e.r*3.4){vx+=ddx/d*1.3;vy+=ddy/d*1.3}}
      // 장판 피하기
      for(const z of W.tel){const dz=len(e.x-z.x,e.y-z.y);if(dz<z.r+14){if(e.react===0)e.react=Math.random()<e.dodgeP?1:2;if(e.react===1){const k=dz||1;vx+=(e.x-z.x)/k*3;vy+=(e.y-z.y)/k*3}}else if(!W.tel.length)e.react=0}
      if(!W.tel.length)e.react=0;
    }
    const sp=len(vx,vy);
    if(sp>.05){const n=manual?Math.min(1,sp*1.6):Math.min(1,sp),v=manual?e.spd*1.5:e.spd;e.x+=vx/sp*v*n*TICK;e.y+=vy/sp*v*n*TICK;e.face.x=vx;e.face.y=vy;e.row=dirRow(vx,vy);if(e.cast<=0)e.anim='walk'}
    else if(e.cast<=0)e.anim='idle';
    e.x=clamp(e.x,24,AW-24);e.y=clamp(e.y,60,AH-24);
    // 공격
    if(e.cast<=0){
      if(manual){const k=W.in.fire;W.in.fire=-1;if(k>=0&&e.moves[k]&&e.moves[k].t<=0&&e.moves[k].p>0)doAttack(e,e.moves[k],Lb-B.r)}
      else{
        const ok=e.moves.filter(m=>m.p>0&&m.t<=0&&Lb-B.r<=m.range+6).sort((a,b)=>b.p-a.p);
        if(ok.length&&Math.random()<.2)doAttack(e,ok[0],Lb-B.r);
      }
    }
  }
  // 보스
  bossAI(live);
  // 장판
  for(let i=W.tel.length-1;i>=0;i--){const z=W.tel[i];z.t+=TICK;
    if(z.t>=z.life){W.tel.splice(i,1);boom(z)}}
  // 이펙트
  for(let i=W.fx.length-1;i>=0;i--){const f=W.fx[i];f.t+=TICK;if(f.t>=f.life)W.fx.splice(i,1)}
  for(let i=W.beams.length-1;i>=0;i--){const b=W.beams[i];b.t+=TICK;if(b.t>=b.life||b.o.hp<=0)W.beams.splice(i,1)}
  // 끝났는지
  if(!W.over){
    if(B.hp<=0){finish('win')}
    else if(!W.allies.some(e=>e.hp>0)){finish('lose')}
    else if(W.time>=C.maxTime){finish('lose',1)}
  }
}
function doAttack(e,m,dist){
  m.t=m.cd;e.cast=.28;e.anim=m.melee?'attack':'shoot';e.at=0;
  const B=W.boss;e.row=dirRow(B.x-e.x,B.y-e.y);
  const BX=window.BEAMFX,FX=!!BX&&!W.ff&&(e===W.me||W.proj.filter(p=>p.fx).length+W.beams.length<10),big=e===W.me;
  if(m.melee){
    if(FX){W.delays.push({t:.12,f:()=>{hitBoss(e,m);try{const mm=BX.meleeMode(m.name,m.type);BX.melee(m.type,mm,e.x,e.y-30,B.x,B.y-B.vis*.3,mm==='slash'?2:1,big?.6:.38)}catch(er){}}})}
    else{ring(B.x-(B.x-e.x)/(len(B.x-e.x,B.y-e.y)||1)*B.r*.9,B.y-(B.y-e.y)/(len(B.x-e.x,B.y-e.y)||1)*B.r*.9,26,C.TCOL[m.type]||'#fff',.25);W.delays.push({t:.12,f:()=>hitBoss(e,m)})}
    return}
  const sk=FX?BX.sprKind(m.name,m.type,m.k):null;
  if(sk&&sk.k==='target'){W.delays.push({t:.22,f:()=>{hitBoss(e,m);try{if(sk.spr==='quake')BX.quake(m.type,B.x,B.y-10,big?.6:.42);else BX.sprite(sk.spr,B.x,B.y+20,(sk.spr==='thunder'?190:170)*(big?1:.7))}catch(er){}}});return}
  if(FX&&m.k==='beam'){W.beams.push({o:e,m,t:0,life:.45});W.delays.push({t:.25,f:()=>hitBoss(e,m)});return}
  W.proj.push({x:e.x,y:e.y-e.vis*.4,o:e,m,t:0,sp:m.k==='pulse'?900:640,col:C.TCOL[m.type]||'#fff',fx:FX?1:0,wv:!!(sk&&sk.spr==='wave')});
  if(!FX&&(m.k==='pulse'||m.melee===false&&m.p>=100))ring(e.x,e.y,36,C.TCOL[m.type]||'#fff',.3);
}
function hitBoss(e,m){
  const B=W.boss;if(B.hp<=0||W.over)return;
  const r=calcDmg(e,B,m);
  B.hp=Math.max(0,B.hp-r.d);B.flash=.08;W.dealt+=r.d;
  e.dealt=(e.dealt||0)+r.d;
  if(r.d>0&&e.gear&&e.gear.aA&&e.gear.aA.vamp&&e.hp>0&&e.max){const vh=Math.min(e.max-e.hp,e.max*.05,r.d*e.gear.aA.vamp/100);if(vh>0){e.hp+=vh;if(e===W.me)pop(e.x,e.y-60,'+'+fmtN(vh*(C.SC||1)),'#6f6')}}   // 9BZ 아티팩트 흡혈 (한 번에 최대 체력의 5%까지)
  const me=e===W.me;
  if(me)try{window.PKS&&!W.ff&&PKS.hit(m,r.e,r.crit,true)}catch(er){}
  if(me||r.crit||r.e>1)pop(B.x+rr(-60,60),B.y-B.vis*.45+rr(-20,20),fmtN(r.d*(C.SC||1)),r.e>1?'#ffb030':r.crit?'#ffe14a':(C.TCOL[m.type]||'#fff'),me&&(r.crit||r.e>1));
  else if(W.fx.length<30)pop(B.x+rr(-80,80),B.y-B.vis*.4+rr(-30,30),fmtN(r.d*(C.SC||1)),'rgba(255,255,255,.7)');
}
function bossAI(live){
  const B=W.boss;if(B.hp<=0||!live.length)return;
  // 천천히 아군 쪽으로
  let cx=0,cy=0;for(const e of live){cx+=e.x;cy+=e.y}cx/=live.length;cy/=live.length;
  const tx=clamp(AW*.62+(cx-AW*.5)*.25,AW*.45,AW*.82),ty=clamp(AH*.5+(cy-AH*.5)*.35,200,AH-160);
  B.x+=(tx-B.x)*.004;B.y+=(ty-B.y)*.004;
  B.row=dirRow(cx-B.x,cy-B.y);
  W.bt-=TICK;W.roar-=TICK;
  if(W.bt<=0){
    W.bt=CFG.bossEvery/(1+W.time*CFG.bossRage*1.2)*rr(.8,1.2);
    const t=(Math.random()<.35&&W.me&&W.me.hp>0)?W.me:live[Math.floor(Math.random()*live.length)];
    W.tel.push({x:t.x,y:t.y,r:CFG.bossAoe,t:0,life:.95,pw:1,col:'#ff3b3b'});
    B.anim='attack';B.at=0;B.cast=.5;
  }
  if(W.roar<=0){
    W.roar=CFG.bossRoarEvery*rr(.9,1.1);
    W.tel.push({x:B.x,y:B.y,r:B.r*2.2+90,t:0,life:1.3,pw:.7,col:'#ff9b3b',roar:1});
  }
  if(B.cast>0){B.cast-=TICK;if(B.cast<=0)B.anim='idle'}
}
function boom(z){
  ring(z.x,z.y,z.r,'#ff5a3a',.5);let n=0;
  for(const e of W.allies){if(e.hp<=0)continue;
    if(len(e.x-z.x,e.y-z.y)<=z.r+e.r*.5){const d=bossDmg(e,0,z.pw);e.hp=Math.max(0,e.hp-d);e.flash=.15;n++;e.anim='hurt';e.at=0;e.cast=.2;
      if(e===W.me)pop(e.x,e.y-60,'-'+fmtN(d*(C.SC||1)),'#ff6a6a',true)}}
  if(n&&C.sfx&&!W.ff)try{C.sfx('hit')}catch(er){}
}
function meDied(){
  const nx=W.allies.find(e=>e.hp>0);
  if(nx&&!W.over){W.me=nx;W.touch=-99;try{window.PKS&&!W.ff&&PKS.cry(nx.mon,.8,300)}catch(er){}if(C.toast&&!W.ff)C.toast('내 캐릭터가 쓰러져서 '+C.nm(nx.mon)+'(으)로 바뀌었어요')}
}
function finish(r,timeout){
  if(W.over)return;W.over=r;W.overT=0;W.timeout=!!timeout;W.ff=0;
  if(r==='win')ring(W.boss.x,W.boss.y,300,'#fff',1);
}

// ---- 그리기 ----
function render(){
  const cv=W.ui.cv,cx=W.cx,Wd=cv.width,Hd=cv.height;
  const sc=Math.min(Wd/AW,Hd/AH),ox=(Wd-AW*sc)/2,oy=(Hd-AH*sc)/2;W.sc=sc;W.ox=ox;W.oy=oy;
  cx.setTransform(1,0,0,1,0,0);cx.fillStyle='#10142a';cx.fillRect(0,0,Wd,Hd);
  cx.setTransform(sc,0,0,sc,ox,oy);cx.save();cx.beginPath();cx.rect(0,0,AW,AH);cx.clip();
  try{const bg=C.bg&&C.bg();if(bg&&bg.naturalWidth){const k=Math.max(AW/bg.naturalWidth,AH/bg.naturalHeight);cx.drawImage(bg,(AW-bg.naturalWidth*k)/2,(AH-bg.naturalHeight*k)/2,bg.naturalWidth*k,bg.naturalHeight*k);cx.fillStyle='rgba(0,0,0,.25)';cx.fillRect(0,0,AW,AH)}else{cx.fillStyle='#223';cx.fillRect(0,0,AW,AH)}}catch(er){cx.fillStyle='#223';cx.fillRect(0,0,AW,AH)}
  // 장판
  for(const z of W.tel){const u=z.t/z.life;cx.save();cx.globalAlpha=.18+.25*u;cx.fillStyle=z.col;cx.beginPath();cx.arc(z.x,z.y,z.r,0,7);cx.fill();cx.globalAlpha=.9;cx.strokeStyle='#fff';cx.lineWidth=3;cx.setLineDash([12,8]);cx.beginPath();cx.arc(z.x,z.y,z.r*u,0,7);cx.stroke();cx.setLineDash([]);cx.strokeStyle=z.col;cx.lineWidth=4;cx.beginPath();cx.arc(z.x,z.y,z.r,0,7);cx.stroke();cx.restore()}
  // 그림 (y 순서)
  const L=W.ents.slice().sort((a,b)=>a.y-b.y);
  for(const e of L)drawEnt(cx,e);
  // 투사체
  const BX=window.BEAMFX;
  if(BX){const B=W.boss;for(const b of W.beams){try{const ox=b.o.x,oy=b.o.y-b.o.vis*.4;BX.live(b,b.m.type,ox,oy,B.x,B.y-B.vis*.3,1,1,0)}catch(er){}}}
  for(const p of W.proj){if(p.fx&&BX){try{const B=W.boss,a=Math.atan2(B.y-p.y,B.x-p.x);if(p.wv)BX.waveLive(p,p.x,p.y+10,a,80);else BX.proj(p,p.m.type,p.x,p.y,a,p.o===W.me?11:8,p.sp,0,0)}catch(er){}continue}cx.save();cx.globalAlpha=.95;cx.fillStyle=p.col;cx.shadowColor=p.col;cx.shadowBlur=14;cx.beginPath();cx.arc(p.x,p.y,7,0,7);cx.fill();cx.restore()}
  // 이펙트
  for(const f of W.fx){const u=f.t/f.life;
    if(f.k==='ring'){cx.save();cx.globalAlpha=1-u;cx.strokeStyle=f.c;cx.lineWidth=5*(1-u)+1;cx.beginPath();cx.arc(f.x,f.y,f.r*(.3+.7*u),0,7);cx.stroke();cx.restore()}
    else if(f.k==='txt'){cx.save();cx.globalAlpha=1-u*u;cx.font='900 '+(f.big?30:18)+'px "Galmuri11",sans-serif';cx.textAlign='center';cx.lineWidth=5;cx.strokeStyle='#0a0d18';cx.strokeText(f.s,f.x,f.y-u*50);cx.fillStyle=f.c;cx.fillText(f.s,f.x,f.y-u*50);cx.restore()}}
  try{if(BX)BX.render(cx)}catch(er){}
  // 내 캐릭터 화살표
  const me=W.me;if(me&&me.hp>0){const y=me.y-me.vis*.95-18+Math.sin(W.time*7)*5;cx.save();cx.fillStyle='#ffe14a';cx.strokeStyle='#0a0d18';cx.lineWidth=4;cx.beginPath();cx.moveTo(me.x,y+14);cx.lineTo(me.x-14,y-10);cx.lineTo(me.x+14,y-10);cx.closePath();cx.stroke();cx.fill();cx.restore()}
  cx.restore();
  hud();
}
function drawEnt(cx,e){
  const dead=e.hp<=0,isMe=e===W.me;
  if(dead&&!e.side&&e.at>1.2)return;
  cx.save();
  // 그림자
  cx.globalAlpha=(dead?.2:.35)*(isMe||e.side?1:.7);cx.fillStyle='#000';cx.beginPath();cx.ellipse(e.x,e.y+2,e.r*1.15,e.r*.45,0,0,7);cx.fill();
  const a=e.side?1:(isMe?1:CFG.allyAlpha);
  cx.globalAlpha=dead?Math.max(0,.5-e.at*.4):a;
  let S=e.S;try{if(e.side&&window.TFX&&C.bossLook>0)S=TFX.spr(e.S,C.bossLook)}catch(er){}
  const st=dead?'faint':e.anim;
  try{C.drawPm(cx,S,st,e.row,e.at,e.x,e.y,e.sc,{loop:!(st==='attack'||st==='hurt'||st==='shoot'||st==='faint'),white:e.flash>0,alpha:cx.globalAlpha})}catch(er){cx.fillStyle='#fff';cx.beginPath();cx.arc(e.x,e.y-20,e.r,0,7);cx.fill()}
  cx.restore();
  // 작은 체력 바 (아군)
  if(!e.side&&!dead){const w=34,h=5,x=e.x-w/2,y=e.y+8;cx.save();cx.globalAlpha=isMe?1:.6;cx.fillStyle='#0a0d18';cx.fillRect(x-1,y-1,w+2,h+2);const r=e.hp/e.max;cx.fillStyle=r>.5?'#5be05b':r>.2?'#f0c030':'#ee4040';cx.fillRect(x,y,w*r,h);cx.restore()}
}

// ---- 화면 위 글자·버튼 ----
function buildUI(){
  const root=document.createElement('div');root.id='wbsw';
  root.style.cssText='position:fixed;inset:0;z-index:60;background:#0a0d18;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Galmuri11",sans-serif';
  root.innerHTML=`<canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas>
  <div class="wbtop" style="position:absolute;left:0;right:0;top:calc(6px + env(safe-area-inset-top));padding:0 8px;pointer-events:none">
    <div style="display:flex;align-items:center;gap:8px;color:#fff;font:900 14px 'Galmuri11',sans-serif;text-shadow:0 2px 0 #000">
      <b id="wbN" style="white-space:nowrap"></b><div style="flex:1;height:16px;background:#0a0d18;border:3px solid #0a0d18;box-shadow:0 0 0 2px #56627f;position:relative"><i id="wbB" style="display:block;height:100%;width:100%;background:linear-gradient(#ff7a5a,#d4142e)"></i><span id="wbH" style="position:absolute;inset:0;text-align:center;font:900 11px/16px sans-serif;color:#fff"></span></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:5px;color:#fff;font:900 13px 'Galmuri11',sans-serif;text-shadow:0 2px 0 #000"><span id="wbA"></span><span id="wbT"></span></div>
  </div>
  <div id="wbMsg" style="position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);padding:14px 22px;background:rgba(0,0,0,.7);border:3px solid #ffd23f;color:#fff;font:900 24px 'Galmuri11',sans-serif;display:none;text-align:center;pointer-events:none"></div>
  <div id="wbSide" style="position:absolute;right:8px;top:calc(64px + env(safe-area-inset-top));display:flex;flex-direction:column;gap:7px;align-items:flex-end"></div>
  <div id="wbStick" style="position:absolute;left:calc(14px + env(safe-area-inset-left));bottom:calc(20px + env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;background:rgba(255,255,255,.12);border:3px solid rgba(255,255,255,.35)"><i style="position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(255,255,255,.5)"></i></div>
  <div id="wbMv" style="position:absolute;right:calc(10px + env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px;width:min(290px,58vw)"></div>`;
  document.body.appendChild(root);
  const U={root,cv:root.querySelector('canvas'),n:root.querySelector('#wbN'),b:root.querySelector('#wbB'),h:root.querySelector('#wbH'),a:root.querySelector('#wbA'),t:root.querySelector('#wbT'),msg:root.querySelector('#wbMsg'),side:root.querySelector('#wbSide'),stick:root.querySelector('#wbStick'),mv:root.querySelector('#wbMv')};
  const bs='padding:9px 12px;font:900 14px "Galmuri11",sans-serif;color:#fff;border:3px solid #0a0d18;box-shadow:0 3px 0 #0a0d18,inset 0 0 0 2px #56627f;background:#2a3256;cursor:pointer';
  const mk=(txt,fn,bg)=>{const b=document.createElement('button');b.style.cssText=bs+(bg?';background:'+bg:'');b.innerHTML=txt;b.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();fn(b)});U.side.appendChild(b);return b};
  U.bSw=mk('🔄 교체',()=>openSwitch(),'#2f6fb3');
  U.bSk=mk('⏭ 건너뛰기',()=>trySkip(),'#6a4a2a');
  U.bQ=mk('나가기',()=>quitAsk(),'#5a2a3a');
  // 조이스틱
  const st=U.stick,knob=st.querySelector('i');let id=null;
  const mv=ev=>{const r=st.getBoundingClientRect(),cx0=r.left+r.width/2,cy0=r.top+r.height/2;let dx=ev.clientX-cx0,dy=ev.clientY-cy0;const L=Math.hypot(dx,dy),R=r.width/2;if(L>R){dx*=R/L;dy*=R/L}knob.style.transform='translate('+dx+'px,'+dy+'px)';W.in.x=dx/R;W.in.y=dy/R;W.touch=W.time};
  st.addEventListener('pointerdown',ev=>{ev.preventDefault();id=ev.pointerId;W.in.hold=1;try{st.setPointerCapture(id)}catch(e){}mv(ev)});
  // 왼쪽 화면 아무 데나 누르면 그 자리에 조이스틱이 생겨요
  U.cv.addEventListener('pointerdown',ev=>{if(id!==null||ev.clientX>innerWidth*.5||W.paused||W.over)return;ev.preventDefault();const R=st.offsetWidth/2;st.style.left=(ev.clientX-R)+'px';st.style.top=(ev.clientY-R)+'px';st.style.bottom='auto';id=ev.pointerId;W.in.hold=1;try{U.cv.setPointerCapture(id)}catch(e){}mv(ev)});
  U.cv.addEventListener('pointermove',ev=>{if(ev.pointerId===id)mv(ev)});
  st.addEventListener('pointermove',ev=>{if(ev.pointerId===id)mv(ev)});
  const up=ev=>{if(ev.pointerId!==id)return;id=null;W.in.hold=0;W.touch=W.time;knob.style.transform='';W.in.x=0;W.in.y=0};
  st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);U.cv.addEventListener('pointerup',up);U.cv.addEventListener('pointercancel',up);
  // 키보드
  W.kd=ev=>{if(W.over||W.paused)return;const k=ev.key;const M={ArrowLeft:'l',a:'l',ArrowRight:'r',d:'r',ArrowUp:'u',w:'u',ArrowDown:'d',s:'d'}[k];
    if(M){W.keys[M]=1;ev.preventDefault();W.touch=W.time}
    if(k>='1'&&k<='4'){W.in.fire=+k-1;W.touch=W.time}};
  W.ku=ev=>{const M={ArrowLeft:'l',a:'l',ArrowRight:'r',d:'r',ArrowUp:'u',w:'u',ArrowDown:'d',s:'d'}[ev.key];if(M)W.keys[M]=0};
  addEventListener('keydown',W.kd);addEventListener('keyup',W.ku);
  W.rs=()=>fit();addEventListener('resize',W.rs);
  W.ui=U;fit();
}
function fit(){const U=W.ui,d=Math.min(2,devicePixelRatio||1);U.cv.width=Math.round(innerWidth*d);U.cv.height=Math.round(innerHeight*d);W.cx=U.cv.getContext('2d')}
function setMoveBtns(){
  const U=W.ui,me=W.me;U.mv.innerHTML='';W.mbtn=[];
  if(!me)return;
  me.moves.forEach((m,i)=>{
    const b=document.createElement('button');
    b.style.cssText='position:relative;overflow:hidden;padding:12px 6px;font:900 13px "Galmuri11",sans-serif;color:#fff;border:3px solid #0a0d18;box-shadow:0 3px 0 #0a0d18;background:'+(C.TCOL[m.type]||'#56627f')+';text-shadow:0 1px 0 #000;cursor:pointer';
    b.innerHTML='<span>'+(m.name||m.id)+'</span><i style="position:absolute;left:0;bottom:0;height:100%;width:0;background:rgba(0,0,0,.55)"></i>';
    b.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();if(W.paused||W.over||W.ff)return;W.in.fire=i;W.touch=W.time});
    U.mv.appendChild(b);W.mbtn.push(b);
  });
}
function hud(){
  const U=W.ui,B=W.boss,SC=C.SC||1;
  if(C.onProg&&W.time-(W._pt||0)>=5){W._pt=W.time;try{C.onProg(W.dealt)}catch(e){}}
  const r=clamp(B.hp/B.max,0,1);U.b.style.width=(r*100)+'%';U.h.textContent=Math.round(B.hp*SC).toLocaleString('en-US')+' / '+Math.round(B.max*SC).toLocaleString('en-US')+(W.dealt>0?'   (이번 전투 -'+Math.round(W.dealt*SC).toLocaleString('en-US')+')':'');
  if(U.n._t!==C.bossName){U.n._t=C.bossName;U.n.textContent=C.bossName}
  const al=W.allies.filter(e=>e.hp>0).length;U.a.textContent='🐾 '+al+' / '+W.allies.length;
  const left=Math.max(0,C.maxTime-W.time),mm=Math.floor(left/60),ss=Math.floor(left%60);
  U.t.textContent='⏱ '+mm+':'+String(ss).padStart(2,'0');
  // 건너뛰기 잠금
  const wait=C.minSkip-W.time;
  if(wait>0){U.bSk.style.opacity='.55';U.bSk.innerHTML='⏭ 건너뛰기 <small>('+Math.ceil(wait)+'초 뒤)</small>'}else{U.bSk.style.opacity='1';U.bSk.innerHTML='⏭ 건너뛰기'}
  U.bSk.style.display=(W.ff||W.over)?'none':'';
  // 기술 쿨타임
  const me=W.me;if(me&&W.mbtnFor!==me){W.mbtnFor=me;setMoveBtns()}
  if(me&&W.mbtn)me.moves.forEach((m,i)=>{const b=W.mbtn[i];if(!b)return;const f=m.t>0?clamp(m.t/m.cd,0,1):0;b.lastChild.style.width=(f*100)+'%';b.style.opacity=m.p>0?1:.4});
  U.stick.style.display=W.ff?'none':'';U.mv.style.display=W.ff?'none':'grid';
  if(W.ff){U.msg.style.display='block';U.msg.textContent='⏩ 끝까지 빠르게 보는 중…'}
  else if(W.over){U.msg.style.display='block';U.msg.innerHTML=W.over==='win'?'🎉 보스를 쓰러뜨렸다!':(W.timeout?'⏱ 시간이 다 됐다!':'모두 쓰러졌다…')}
  else if(W.time<2.2){U.msg.style.display='block';U.msg.innerHTML='🐾 '+W.allies.length+'마리 출격!<br><small style="font-size:13px">▼ 노란 화살표가 내 캐릭터 · 3초 안 만지면 자동</small>'}
  else U.msg.style.display='none';
}

// ---- 교체 · 건너뛰기 · 나가기 ----
function openSwitch(){
  if(W.over||W.ff||W.sp)return;
  W.paused=1;
  const p=document.createElement('div');W.sp=p;
  p.style.cssText='position:absolute;inset:0;z-index:5;background:rgba(6,8,20,.9);overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 12px 18px;color:#fff;font-family:"Galmuri11",sans-serif';
  let h='<div style="font:900 17px sans-serif;margin-bottom:4px">🔄 교체 <small style="font-weight:400;font-size:12px">· 지금은 일시정지 · 고른 포켓몬을 내가 움직여요</small></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin-top:8px">';
  W.allies.forEach((e,i)=>{const dead=e.hp<=0,on=e===W.me;
    h+=`<button data-i="${i}" ${dead?'disabled':''} style="padding:6px 4px;border:3px solid ${on?'#ffe14a':'#1c2550'};background:${on?'#3a3a1a':'#222a52'};color:#fff;font:700 11px 'Galmuri11',sans-serif;opacity:${dead?.35:1};cursor:pointer"><img src="${(C.thumb&&C.thumb(e.mon.n))||''}" style="width:52px;height:52px;object-fit:contain;display:block;margin:0 auto"><div style="margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${C.nm(e.mon)}</div><div style="height:5px;background:#0a0d18;margin-top:3px"><i style="display:block;height:100%;width:${clamp(e.hp/e.max,0,1)*100}%;background:#5be05b"></i></div></button>`});
  h+='</div><div style="text-align:center;margin-top:14px"><button id="wbBack" style="padding:10px 26px;font:900 15px sans-serif;border:3px solid #0a0d18;background:#2a3256;color:#fff;cursor:pointer">계속 싸우기</button></div>';
  p.innerHTML=h;W.ui.root.appendChild(p);
  const close=()=>{p.remove();W.sp=null;W.paused=0};
  p.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const e=W.allies[+b.dataset.i];if(e&&e.hp>0){W.me=e;W.touch=W.time;try{window.PKS&&!W.ff&&PKS.cry(e.mon,.8,200)}catch(er){}try{C.sfx&&C.sfx('tap')}catch(er){}}close()});
  p.querySelector('#wbBack').onclick=close;
}
function trySkip(){
  if(W.over||W.ff)return;
  const wait=C.minSkip-W.time;
  if(wait>0){C.toast&&C.toast('건너뛰기는 '+Math.ceil(wait)+'초 뒤에 할 수 있어요 (2분 뒤부터)');return}
  W.ff=1;if(W.sp){W.sp.remove();W.sp=null;W.paused=0}
}
function quitAsk(){
  if(W.over||W.qp)return;W.paused=1;
  const p=document.createElement('div');W.qp=p;
  p.style.cssText='position:absolute;inset:0;z-index:6;background:rgba(6,8,20,.85);display:flex;align-items:center;justify-content:center;padding:20px';
  p.innerHTML=`<div style="background:#1c2550;border:3px solid #56627f;padding:18px;max-width:320px;color:#fff;font:700 14px/1.5 'Galmuri11',sans-serif;text-align:center">${C.quitText||'그만 싸울까요?'}<div style="display:flex;gap:10px;margin-top:14px"><button id="wq1" style="flex:1;padding:10px;font:900 14px sans-serif;background:#5a2a3a;color:#fff;border:3px solid #0a0d18;cursor:pointer">나가기</button><button id="wq2" style="flex:1;padding:10px;font:900 14px sans-serif;background:#2a3256;color:#fff;border:3px solid #0a0d18;cursor:pointer">계속</button></div></div>`;
  W.ui.root.appendChild(p);
  p.querySelector('#wq2').onclick=()=>{p.remove();W.qp=null;W.paused=W.sp?1:0};
  p.querySelector('#wq1').onclick=()=>{p.remove();W.qp=null;stop('quit')};
}

function stop(r){
  if(!W||W.stopped)return;W.stopped=1;try{C.onProg&&C.onProg(W.dealt)}catch(e){}cancelAnimationFrame(W.raf);
  removeEventListener('keydown',W.kd);removeEventListener('keyup',W.ku);removeEventListener('resize',W.rs);
  const hpBy={};for(const e of W.allies)hpBy[e.mon.uid]=Math.max(0,e.hp/(e.max/(e.st[0]||1)));   // 장비 전 체력으로 되돌려 저장
  window.WBSW.last={r,bossHp:W.boss.hp,bossMax:W.boss.max,time:W.time,hpBy,meUid:W.me&&W.me.mon.uid,dealt:W.dealt,timeout:W.timeout};
  try{const E=window.BEAMFX&&BEAMFX.engine;if(E&&E.config&&window._wbWS)E.config.widthScale=window._wbWS}catch(er){}W.ui.root.remove();const res=W.res;W=null;res(r);
}

async function start(ctx){
  if(W)return 'quit';
  C=Object.assign({minSkip:120,maxTime:300,SC:1},ctx);
  const SA=await Promise.all(C.allies.map(m=>C.getSpr(C.sprKey(m)))),SB=await C.getSpr(C.sprKey(C.boss));
  W={tick:0,time:0,proj:[],tel:[],fx:[],delays:[],beams:[],_c:(()=>{try{if(window.BEAMFX){BEAMFX.clear();const E=BEAMFX.engine;if(E&&E.config){window._wbWS=E.config.widthScale;E.config.widthScale=.6}}}catch(er){}return 0})(),over:null,overT:0,paused:0,ff:0,touch:-99,dealt:0,bt:2.2,roar:CFG.bossRoarEvery,keys:{l:0,r:0,u:0,d:0},in:{x:0,y:0,dx:0,dy:0,fire:-1}};
  W.allies=C.allies.map((m,i)=>mkEnt(m,SA[i],0));
  W.boss=mkEnt(C.boss,SB,1);
  { // 보스 체력은 호출한 쪽이 넘긴 값 그대로 (월보 단위 ÷ SC)
    const B=W.boss;B.max=Math.max(1,C.bossMax||B.st[0]);B.hp=clamp(C.boss.hp,1,B.max);B.x=AW*.68;B.y=AH*.5;B.row=6}
  const n=W.allies.length;
  W.allies.forEach((e,i)=>{const col=i%5,row=Math.floor(i/5);e.x=130+col*46+(row%2)*20;e.y=AH*.5-((Math.ceil(n/5)-1)*42)/2+row*42;e.row=2;e.alive=1});
  W.ents=W.allies.concat([W.boss]);
  const first=C.firstUid&&W.allies.find(e=>e.mon.uid===C.firstUid&&e.hp>0);
  W.me=first||W.allies.find(e=>e.hp>0)||W.allies[0];
  try{window.PKS&&!W.ff&&PKS.cry(W.me.mon,.85,500)}catch(er){}
  buildUI();
  return new Promise(res=>{
    W.res=res;let last=performance.now(),acc=0;
    const loop=now=>{
      if(!W||W.stopped)return;
      const dt=Math.min(.1,(now-last)/1000);last=now;
      if(W.ff&&!W.over){ // 건너뛰기: 화면 한 번 그릴 때마다 6초치씩 감기
        let k=0;while(!W.over&&k<360&&W.ff){W.delays=W.delays.filter(d=>{d.t-=TICK;if(d.t<=0){d.f();return false}return true});update();k++}
      }else if(!W.paused){
        acc+=dt;let n=0;
        while(acc>=TICK&&n<5){
          // 키보드 방향 합치기
          const K=W.keys;W.in.dx=(K.r-K.l);W.in.dy=(K.d-K.u);if(W.in.dx||W.in.dy){const L=Math.hypot(W.in.dx,W.in.dy);W.in.dx/=L;W.in.dy/=L}
          if(!W.over){W.delays=W.delays.filter(d=>{d.t-=TICK;if(d.t<=0){d.f();return false}return true});update()}else W.overT+=TICK;
          acc-=TICK;n++}
        if(n>=5)acc=0;
      }else acc=0;
      if(W.over&&W.overT>1.8){stop(W.over);return}
      if(W.over&&W.ff)W.ff=0;
      render();
      W.raf=requestAnimationFrame(loop)};
    W.raf=requestAnimationFrame(loop);
  });
}
window.WBSW={start,CFG,_dbg:()=>W,_step:n=>{for(let i=0;i<n&&W&&!W.over;i++)update()}};
})();
