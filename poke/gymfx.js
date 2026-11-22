/* gymfx.js — 체육관 경기장 장치 (레조넌스 1번 자료의 규칙을 읽어 새로 짠 것)
   1/3: 공통 엔진 + 관동 8곳 (회색·블루·갈색·무지개·연분홍·노랑·홍련·상록)
   2/3: 호연 8곳 (rustboro·dewford·mauville·lavaridge·petalburg·fortree·mossdeep·sootopolis)
   쓰는 법: rtbattle.js가 start()에서 GYMFX.make(key,H) → 매 틱 GYMFX.tick(g,W) → render에서 GYMFX.draw(g,cx,W)
   H = rtbattle가 넘겨 주는 도구(floatTxt, setAil, fmtN, kOf, cancelCast, rnd) */
(function(){
'use strict';
const AW=1200,AH=760,CX=600,CY=380,TICK=1/60;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const has=(e,l)=>!!l&&l.some(t=>e.types&&e.types.includes(t));
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);

// ───────── 장치 정의 (좌표는 1200×760 경기장 기준) ─────────
const CYC_PLATE={period:6,warn:1.2,fire:.3};
const CYC_VENT={period:7,warn:1.4,fire:.6};
const boulder=(x,y,r,hp)=>({k:'boulder',x,y,r,hp:hp||3,respawn:12});
const pool=(x,y,r)=>({k:'pool',x,y,r});
const plate=(x,y,w,off)=>({k:'plate',x,y,w,h:w,cyc:Object.assign({off:off||0},CYC_PLATE)});
const grass=(x,y,r)=>({k:'grass',x,y,r});
const puddle=(x,y,r)=>({k:'puddle',x,y,r});
const vent=(x,y,r,off)=>({k:'vent',x,y,r,cyc:Object.assign({off:off||0},CYC_VENT)});
const sand=(x,y,r)=>({k:'sand',x,y,r});
const pad=(x,y,to)=>({k:'pad',x,y,r:38,to});
// 2/3 호연용
const sandbag=(x,y)=>({k:'sandbag',x,y,r:26});
const lamp=(x,y)=>({k:'lamp',x,y,r:22});
const pole=(x,y)=>({k:'pole',x,y,r:24});
const arcb=(y,off)=>({k:'arc',x:CX,y,w:64,h:202,cyc:{period:6,warn:1,fire:2.5,off:off||0}});
const spring=(x,y,r)=>({k:'spring',x,y,r});
const gust=(y,dx,off)=>({k:'gust',y,h:120,dx,sign:1,cyc:{period:8,warn:1.3,fire:.4,off:off||0}});
const cloudpad=(x,y)=>({k:'cloudpad',x,y,r:58});
const wpad=(x,y,to,mir)=>Object.assign(pad(x,y,to),{wander:{ax:110,ay:70,per:16,mir:mir||0}});

const DEF={
  pewter:{img:'gym-pewter',info:'바위를 부수며 싸워요 (맞히면 3~4번에 부서지고 12초 뒤 다시 생겨요)',
    f:[boulder(CX,CY,50,4),boulder(430,190,38),boulder(770,570,38),boulder(430,570,38),boulder(770,190,38)]},
  cerulean:{img:'gym-cerulean',info:'물웅덩이 안에서는 느려져요 (물 타입은 괜찮고, 물 기술이 세져요)',
    f:[pool(CX,200,115),pool(CX,560,115),pool(330,120,70),pool(870,640,70)]},
  vermilion:{img:'gym-vermilion',info:'전기 발판이 번쩍이면 감전! 기둥 스위치를 맞히면 12초 동안 꺼져요',
    f:[plate(430,200,120,0),plate(770,560,120,0),plate(430,560,120,3),plate(770,200,120,3),plate(CX,CY,140,1.5),
       {k:'breaker',x:CX,y:96,r:26},{k:'breaker',x:CX,y:664,r:26}]},
  celadon:{img:'gym-celadon',info:'풀밭에서는 풀 타입이 회복해요 · 꽃가루에 닿으면 잠들어요',
    f:[grass(420,190,105),grass(780,570,105),grass(420,570,105),grass(780,190,105),grass(CX,CY,80),
       {k:'pollen',ph:.25,mir:0},{k:'pollen',ph:.25,mir:1}]},
  fuchsia:{img:'gym-fuchsia',info:'독웅덩이는 조금씩 아프고 중독돼요 · 독가시가 가끔 솟아요',
    f:[puddle(CX,CY,80),puddle(420,200,72),puddle(780,560,72),puddle(420,560,72),puddle(780,200,72),{k:'spikes'}]},
  saffron:{img:'gym-saffron',info:'순간이동 발판을 밟으면 다른 발판으로 날아가요 (3초 뒤 다시 쓸 수 있어요)',
    f:[pad(340,150,1),pad(860,610,0),pad(340,610,3),pad(860,150,2)]},
  cinnabar:{img:'gym-cinnabar',info:'분화구가 달아오르면 불기둥! 불 타입은 괜찮아요',
    f:[vent(440,210,72,0),vent(760,550,72,0),vent(440,550,72,3.5),vent(760,210,72,3.5),vent(CX,CY,82,1.75)]},
  viridian:{img:'gym-viridian',info:'모래늪은 느려지고 빨려 들어가요 · 땅이 흔들리면 서 있던 곳이 아파요',
    f:[sand(CX,CY,110),sand(390,170,85),sand(810,590,85),{k:'tremor'}]},
  // ── 호연 (2/3) ──
  rustboro:{img:'gym-pewter',info:'낙석 주의! 빨간 원을 피하세요 (떨어진 바위는 10초 동안 몸을 숨길 수 있어요 · 바위·땅·강철은 덜 아파요)',
    f:[{k:'rockfall'}]},
  dewford:{img:'gym-violet',info:'어두운 도장이에요 · 램프와 내 몸 주변만 밝아요 · 샌드백에 닿으면 튕겨 나가요 (격투 타입은 안 튕겨요)',
    f:[{k:'dark'},lamp(420,CY),lamp(780,CY),sandbag(450,190),sandbag(750,570),sandbag(450,570),sandbag(750,190)]},
  mauville:{img:'gym-vermilion',info:'전봇대 사이로 전류가 번갈아 흘러요 · 빛나는 줄을 피하세요 (전기·땅 타입은 괜찮아요)',
    f:[pole(CX,130),pole(CX,CY),pole(CX,630),arcb(255,0),arcb(505,3)]},
  lavaridge:{img:'gym-cinnabar',info:'뜨거운 모래에 조금씩 깎여요 · 온천에 들어가면 회복하지만 느려져요 (불·땅 타입은 안 깎여요)',
    f:[{k:'heat'},spring(CX,CY,78),spring(400,180,64),spring(800,580,64)]},
  petalburg:{img:'gym-violet',info:'15초마다 훈련 메뉴가 바뀌어요 · 처음은 스피드 훈련 (스피드 → 회피 → 노말 기술 강화)',
    f:[{k:'drill'}]},
  fortree:{img:'gym-violet',info:'바람길이 번갈아 불어요 · 맞으면 밀려나요 (비행 타입은 괜찮아요) · 구름 발판 위에서는 구르기가 멀리 가요',
    f:[gust(190,1,0),gust(570,-1,0),gust(CY,1,4),cloudpad(430,CY),cloudpad(770,CY)]},
  mossdeep:{img:'gym-saffron',info:'가끔 트릭룸이 펼쳐져요 (느린 쪽이 빨라져요) · 순간이동 발판이 천천히 움직여요',
    f:[{k:'mirror'},wpad(440,230,1,0),wpad(760,530,0,1)]},
  sootopolis:{img:'gym-cerulean',info:'얼음판을 오래 밟으면 깨져서 물웅덩이가 돼요 (물·얼음 타입은 안 깨져요) · 웅덩이에선 느려져요',
    f:[{k:'crackice'}]},
};

function key(k){return DEF[k]?k:null}
function info(k){return DEF[k]?DEF[k].info:''}

const _img={};
function bg(k){const d=DEF[k];if(!d)return null;if(_img[k])return _img[k];const im=new Image();im.src='arena/'+d.img+'.webp';_img[k]=im;return im}

// 주기 계산: 한 주기의 끝쪽 fire초 동안 발동, 그 앞 warn초는 예고
function phase(c,t){const u=(((t-(c.off||0))%c.period)+c.period)%c.period,fs=c.period-c.fire;
  if(u>=fs)return{p:'fire',u:u-fs,n:Math.floor((t-(c.off||0))/c.period)};
  if(u>=fs-c.warn)return{p:'warn',k:(u-(fs-c.warn))/c.warn,n:Math.floor((t-(c.off||0))/c.period)};
  return{p:'idle',n:-1}}

// ───────── 만들기 ─────────
function make(k,H){
  const d=DEF[k];if(!d)return null;
  const g={key:k,H,t:0,img:bg(k),powerOff:0,msgT:0,fx:[],feats:[],slides:[]};
  for(const f of d.f){
    const o=Object.assign({},f);
    if(o.k==='boulder'){o.maxhp=o.hp;o.dead=0;o.rt=0}
    if(o.k==='rockfall'){o.marks=[];o.lastW=-9;o.lastN=-9}
    if(o.k==='sandbag'){o.sw=0}
    if(o.k==='pad'&&o.wander){o.bx=o.x;o.by=o.y}
    if(o.k==='gust'){o.lastN=-9}
    if(o.k==='mirror'){o.on=0;o.lastN=-9}
    if(o.k==='drill'){o.step=-1}
    if(o.k==='crackice'){o.cols=12;o.rows=8;o.x0=CX-480;o.y0=CY-300;o.cw=80;o.ch=75;o.p=new Array(96).fill(0);o.br=new Array(96).fill(0)}
    if(o.k==='pollen'){o.life=0;o.rest=1;o.x=-999;o.y=-999;o.vis=0}
    if(o.k==='spikes'){o.spots=[];o.pend=[];o.next=2.6}
    if(o.k==='tremor'){o.marks=[];o.lastN=-9}
    if(o.k==='breaker'){o.flash=0}
    if(o.cyc)o.lastN=-9;
    g.feats.push(o)}
  g.pads=g.feats.filter(f=>f.k==='pad');
  const SOL=['boulder','breaker','pole','sandbag','lamp'];
  g.solids=g.feats.filter(f=>SOL.includes(f.k));
  for(const s of g.solids)s.tall=s.k!=='lamp'?1:0;
  return g}

// ───────── 피해 도우미 ─────────
function hurt(g,e,frac,col){
  if(e.hp<=0||e.inv>0||e.hidden||g.W.tut)return 0;
  const H=g.H,d=Math.max(1,Math.round((e.pctMax||e.max)*frac));
  e.hp=Math.max(0,e.hp-d);e.flash=.12;
  H.floatTxt(e.x,e.y-70,H.fmtN(d*H.kOf(e)),col||'#ff8a4a');return d}
const ground=e=>!(e.types&&e.types.includes('FLYING'));

// ───────── 한 틱 ─────────
function tick(g,W){
  g.W=W;g.t+=TICK;const t=g.t,H=g.H,ents=[W.me,W.foe].filter(e=>e&&e.hp>0&&!e.hidden);
  if(g.powerOff>0)g.powerOff=Math.max(0,g.powerOff-TICK);
  for(const e of [W.me,W.foe]){e.gxMul=1;e.gxPow=null;e.gxRoll=1;e.gxRc=1;if(e.padCd>0)e.padCd-=TICK;if(e.sbCd>0)e.sbCd-=TICK;e.gxT=(e.gxT||0)-TICK;e.gxTk=e.gxT<=0}
  for(const e of ents)if(e.gxTk)e.gxT=.5;   // 0.5초마다 바닥 효과 한 번

  for(const f of g.feats){
    switch(f.k){
    case 'boulder':{
      if(f.flash>0)f.flash-=TICK;if(f.dead){f.rt-=TICK;if(f.rt<=0){f.dead=0;f.hp=f.maxhp}}break}
    case 'breaker':{if(f.flash>0)f.flash-=TICK;break}
    case 'pool':
      for(const e of ents){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3){
        if(!has(e,['WATER']))e.gxMul*=.6;e.gxPow={t:'WATER',m:1.25}}}
      break;
    case 'grass':
      for(const e of ents){if(e.gxTk&&has(e,['GRASS'])&&dist(e.x,e.y,f.x,f.y)<=f.r){
        const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.006)));
        if(h>0&&e.hp<e.max){e.hp+=h;H.floatTxt(e.x,e.y-80,'+'+H.fmtN(h*H.kOf(e)),'#7dff8a')}}}
      break;
    case 'puddle':
      for(const e of ents){if(!has(e,['POISON','STEEL'])&&dist(e.x,e.y,f.x,f.y)<=f.r){
        if(e.gxTk){hurt(g,e,.006,'#c77dd8');e.pdT=(e.pdT||0)+.5;if(e.pdT>=3){e.pdT=0;H.setAil(e,'poison',100)}}}}
      break;
    case 'sand':
      for(const e of ents){if(!has(e,['GROUND'])&&dist(e.x,e.y,f.x,f.y)<=f.r){
        e.gxMul*=.55;const dx=f.x-e.x,dy=f.y-e.y,L=Math.hypot(dx,dy)||1,p=55*TICK;e.x+=dx/L*p;e.y+=dy/L*p}}
      break;
    case 'pad':
      if(f.wander){const w=f.wander,a=(t/w.per)*6.2832,sg=w.mir?-1:1;f.x=f.bx+sg*w.ax*Math.sin(a);f.y=f.by+sg*w.ay*Math.sin(a)}
      for(const e of ents){if(e.padCd>0||e.rollT>0)continue;
        if(dist(e.x,e.y,f.x,f.y)<=f.r){const to=g.pads[f.to];if(!to)continue;
          g.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.4,c:'#ff7ad0'},{k:'ring',x:to.x,y:to.y,t:0,life:.4,c:'#ff7ad0'});
          e.x=to.x;e.y=to.y;e.padCd=3;e.vx=e.vy=0;H.floatTxt(e.x,e.y-90,'순간이동!','#ff9ae0')}}
      break;
    case 'plate':case 'vent':{
      const ph=phase(f.cyc,t);f.ph=ph;
      const live=f.k==='vent'||g.powerOff<=0;
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        if(live){
          for(const e of ents){
            const inside=f.k==='plate'?(Math.abs(e.x-f.x)<=f.w/2+e.r*.4&&Math.abs(e.y-f.y)<=f.h/2+e.r*.4):dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.4;
            if(!inside||!ground(e))continue;
            if(f.k==='plate'){if(has(e,['ELECTRIC','GROUND']))continue;hurt(g,e,.08,'#ffe14a');H.setAil(e,'paralysis',35)}
            else{if(has(e,['FIRE']))continue;hurt(g,e,.1,'#ff7a30');H.setAil(e,'burn',35)}}
          g.fx.push({k:f.k==='plate'?'zap':'boom',x:f.x,y:f.y,w:f.w||f.r*2,t:0,life:.35})}}
      break}
    case 'pollen':{
      if(f.vis){
        f.life-=TICK;const a=(t/22)*6.2832+f.ph*6.2832;let x=CX+330*Math.sin(a),y=CY+210*Math.sin(a*1.5);
        if(f.mir){x=AW-x;y=AH-y}f.x=x;f.y=y;
        for(const e of ents){if(has(e,['GRASS']))continue;
          if(dist(e.x,e.y,f.x,f.y)<=28+e.r*.5){H.setAil(e,'sleep',100);f.vis=0;f.rest=2;g.fx.push({k:'ring',x:f.x,y:f.y,t:0,life:.4,c:'#ffd0f0'});break}}
        if(f.life<=0){f.vis=0;f.rest=1}
      }else{f.rest-=TICK;if(f.rest<=0){f.vis=1;f.life=8}}
      break}
    case 'spikes':{
      if(t>=f.next){f.next+=9;for(let i=0;i<2;i++)f.pend.push({x:clamp(160+H.rnd()*880,160,1040),y:clamp(130+H.rnd()*500,130,630),t:1.2})}
      for(const p of f.pend)p.t-=TICK;
      for(const p of f.pend)if(p.t<=0){f.spots.push({x:p.x,y:p.y,life:14,cd:0});g.fx.push({k:'ring',x:p.x,y:p.y,t:0,life:.3,c:'#c77dd8'})}
      f.pend=f.pend.filter(p=>p.t>0);
      while(f.spots.length>6)f.spots.shift();
      for(const s of f.spots){s.life-=TICK;if(s.cd>0)s.cd-=TICK;
        if(s.cd<=0)for(const e of ents){if(!ground(e)||has(e,['STEEL']))continue;
          if(dist(e.x,e.y,s.x,s.y)<=34+e.r*.4){
            if(has(e,['POISON'])){s.life=0;H.floatTxt(s.x,s.y-30,'독 흡수','#c77dd8');break}
            hurt(g,e,.03,'#c77dd8');H.setAil(e,'poison',100);s.cd=1}}}
      f.spots=f.spots.filter(s=>s.life>0);
      break}
    case 'rock':{f.life-=TICK;break}
    case 'rockfall':{
      const ph=phase({period:12,warn:1.6,fire:.3,off:4.4},t);f.ph=ph;
      if(ph.p==='warn'&&f.lastW!==ph.n){f.lastW=ph.n;f.marks=ents.map(e=>({x:e.x,y:e.y}))}
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        for(const e of ents){if(!f.marks.some(m=>dist(e.x,e.y,m.x,m.y)<=56+e.r*.3))continue;
          hurt(g,e,has(e,['ROCK','GROUND','STEEL'])?.05:.1,'#c8a878');e.stun=Math.max(e.stun,24);try{H.cancelCast(e,false)}catch(er){}}
        W.qk=Math.max(W.qk||0,.4);
        for(const m of f.marks){g.fx.push({k:'boom',x:m.x,y:m.y,w:120,t:0,life:.35});
          const r={k:'rock',x:m.x,y:m.y,r:32,life:10,hp:1,maxhp:1,tall:1,dead:0,flash:0};
          const old=g.feats.filter(q=>q.k==='rock');if(old.length>=6)old[0].life=0;
          g.feats.push(r);g.solids.push(r)}
        f.marks=[]}
      break}
    case 'sandbag':{if(f.sw>0)f.sw-=TICK;break}
    case 'arc':{
      const ph=phase(f.cyc,t);f.ph=ph;
      const inside=e=>Math.abs(e.x-f.x)<=f.w/2+e.r*.3&&Math.abs(e.y-f.y)<=f.h/2+e.r*.3;
      if(ph.p==='fire'){
        if(f.lastN!==ph.n){f.lastN=ph.n;
          for(const e of ents){if(!inside(e)||has(e,['ELECTRIC','GROUND']))continue;hurt(g,e,.04,'#ffe14a');H.setAil(e,'paralysis',30)}}
        for(const e of ents){if(e.gxTk&&inside(e)&&!has(e,['ELECTRIC','GROUND']))hurt(g,e,.03,'#ffe14a')}}
      break}
    case 'heat':
      for(const e of ents){if(has(e,['FIRE','GROUND']))continue;
        if(g.feats.some(q=>q.k==='spring'&&dist(e.x,e.y,q.x,q.y)<=q.r))continue;
        e.heatT=(e.heatT||0)+TICK;if(e.heatT>=2){e.heatT=0;hurt(g,e,.012,'#ff9a50')}}
      break;
    case 'spring':
      for(const e of ents){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3){
        if(!has(e,['FIRE']))e.gxMul*=.65;
        if(e.gxTk){const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.006)));
          if(h>0&&e.hp<e.max){e.hp+=h;H.floatTxt(e.x,e.y-80,'+'+H.fmtN(h*H.kOf(e)),'#7dff8a')}}}}
      break;
    case 'drill':{
      const st=Math.floor(t/15)%3;
      if(st!==f.step){f.step=st;H.floatTxt(CX,150,['⚡ 스피드 훈련! 모두 빨라져요','💨 회피 훈련! 구르기가 빨리 차올라요','💪 노말 훈련! 노말 기술이 세져요'][st],'#ffe14a',true)}
      for(const e of ents){if(st===0)e.gxMul*=1.3;else if(st===1)e.gxRc=1.6;else e.gxPow={t:'NORMAL',m:1.2}}
      break}
    case 'gust':{
      const ph=phase(f.cyc,t);f.ph=ph;
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        const dx=f.dx*f.sign;
        for(const e of ents){if(has(e,['FLYING'])||Math.abs(e.y-f.y)>60+e.r*.3)continue;
          g.slides.push({e,dx:dx*140,dy:0,t:.25,tt:.25});H.floatTxt(e.x,e.y-80,'바람!','#bfe8ff')}
        f.sign*=-1;g.fx.push({k:'ring',x:CX,y:f.y,t:0,life:.4,c:'#bfe8ff'})}
      break}
    case 'cloudpad':
      for(const e of ents){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3)e.gxRoll=1.25}
      break;
    case 'mirror':{
      const ph=phase({period:20,warn:2,fire:10,off:0},t);f.ph=ph;f.on=ph.p==='fire';
      if(f.on&&f.lastN!==ph.n){f.lastN=ph.n;H.floatTxt(CX,150,'🌀 트릭룸! 느린 쪽이 빨라져요','#d08cff',true)}
      if(f.on&&W.me&&W.foe&&W.me.spd>0&&W.foe.spd>0){
        W.me.gxMul*=clamp(W.foe.spd/W.me.spd,.5,2);W.foe.gxMul*=clamp(W.me.spd/W.foe.spd,.5,2)}
      break}
    case 'crackice':{
      const occ={};
      for(const e of ents){if(has(e,['WATER','ICE','FLYING']))continue;
        const c=Math.floor((e.x-f.x0)/f.cw),r=Math.floor((e.y-f.y0)/f.ch);
        if(c<0||r<0||c>=f.cols||r>=f.rows)continue;const i=r*f.cols+c;occ[i]=1;
        if(f.br[i]>0)e.gxMul*=.6;
        else{f.p[i]+=TICK;if(f.p[i]>=3){f.p[i]=0;f.br[i]=10;g.fx.push({k:'ring',x:f.x0+(c+.5)*f.cw,y:f.y0+(r+.5)*f.ch,t:0,life:.4,c:'#bfe8ff'});H.floatTxt(e.x,e.y-80,'쩍!','#bfe8ff')}}}
      for(let i=0;i<96;i++){if(f.br[i]>0){f.br[i]-=TICK}else if(!occ[i]&&f.p[i]>0)f.p[i]=Math.max(0,f.p[i]-.25*TICK)}
      break}
    case 'tremor':{
      const ph=phase({period:8,warn:1.4,fire:.3,off:.3},t);f.ph=ph;
      if(ph.p==='warn'&&f.lastW!==ph.n){f.lastW=ph.n;f.marks=ents.filter(e=>ground(e)&&!has(e,['GROUND'])).map(e=>({x:e.x,y:e.y}))}
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        for(const e of ents){if(!ground(e)||has(e,['GROUND']))continue;
          if(f.marks.some(m=>dist(e.x,e.y,m.x,m.y)<=72+e.r*.3)){hurt(g,e,.09,'#d2a24a');e.stun=Math.max(e.stun,21);try{H.cancelCast(e,false)}catch(er){}}}
        W.qk=Math.max(W.qk||0,.5);for(const m of f.marks)g.fx.push({k:'boom',x:m.x,y:m.y,w:140,t:0,life:.35});f.marks=[]}
      break}
    }
  }
  // 단단한 것(바위·기둥): 몸 밀어내기 + 발사체 막기
  if(g.feats.some(q=>q.k==='rock'&&q.life<=0)){g.feats=g.feats.filter(q=>!(q.k==='rock'&&q.life<=0));g.solids=g.solids.filter(q=>!(q.k==='rock'&&q.life<=0))}
  for(const s of g.solids){
    if(s.dead)continue;
    for(const e of ents){let dx=e.x-s.x,dy=e.y-s.y,L=Math.hypot(dx,dy);if(L<1e-3){dx=1;dy=0;L=1}const min=s.r+e.r*.55;
      if(s.k==='sandbag'&&L<min+4&&!has(e,['FIGHTING'])&&!(e.sbCd>0)&&e.rollT<=0){e.sbCd=.6;s.sw=.5;g.slides.push({e,dx:dx/L*150,dy:dy/L*150,t:.2,tt:.2});H.floatTxt(e.x,e.y-70,'퉁!','#ffd29a')}
      if(L<min){e.x=s.x+dx/L*min;e.y=s.y+dy/L*min}}
    if(s.tall)for(const p of W.proj){if(p.dead||p.wait>0)continue;
      if(dist(p.x,p.y,s.x,s.y)<=s.r+p.r*.6){p.dead=1;
        g.fx.push({k:'ring',x:p.x,y:p.y,t:0,life:.2,c:'#fff'});
        if(s.k==='boulder'){s.hp--;s.flash=.15;if(s.hp<=0){s.dead=1;s.rt=s.respawn;g.fx.push({k:'boom',x:s.x,y:s.y,w:s.r*3,t:0,life:.35})}}
        else if(s.k==='breaker'&&g.powerOff<=0){g.powerOff=12;s.flash=.4;H.floatTxt(s.x,s.y-50,'전기 꺼짐! 12초','#ffe14a',true)}}}}
  for(const s of g.slides){const k=Math.min(s.t,TICK)/s.tt;s.e.x+=s.dx*k;s.e.y+=s.dy*k;s.t-=TICK}
  g.slides=g.slides.filter(s=>s.t>0&&s.e.hp>0);
  for(const f of g.fx)f.t+=TICK;g.fx=g.fx.filter(f=>f.t<f.life);
  // 경기장 밖으로 안 나가게 다시 한 번
  for(const e of [W.me,W.foe]){e.x=clamp(e.x,18+e.r*.5,AW-18-e.r*.5);e.y=clamp(e.y,18+e.r*.5,AH-18-e.r*.5)}
}

// ───────── 그리기 (월드 좌표, 포켓몬 아래) ─────────
function draw(g,cx,W){
  const t=g.t;cx.save();
  for(const f of g.feats){
    switch(f.k){
    case 'pool':{cx.globalAlpha=.45;cx.fillStyle='#3a9ee8';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      cx.globalAlpha=.6;cx.strokeStyle='#bfe8ff';cx.lineWidth=3;for(let i=0;i<2;i++){cx.beginPath();cx.arc(f.x,f.y,f.r*(.5+.4*((t*.5+i*.5)%1)),0,7);cx.stroke()}break}
    case 'grass':{cx.globalAlpha=.4;cx.fillStyle='#4cc04c';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      cx.globalAlpha=.75;cx.strokeStyle='#d8ffd0';cx.lineWidth=3;cx.setLineDash([10,8]);cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.stroke();cx.setLineDash([]);
      cx.globalAlpha=.9;cx.font='22px sans-serif';cx.textAlign='center';cx.fillText('🌿',f.x,f.y+8);break}
    case 'puddle':{cx.globalAlpha=.5;cx.fillStyle='#9a3ec0';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      cx.globalAlpha=.7;cx.strokeStyle='#e0a8f0';cx.lineWidth=3;cx.beginPath();cx.arc(f.x,f.y,f.r*(.6+.1*Math.sin(t*3)),0,7);cx.stroke();break}
    case 'sand':{cx.globalAlpha=.55;cx.fillStyle='#a8823a';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      cx.globalAlpha=.7;cx.strokeStyle='#e8c878';cx.lineWidth=3;for(let i=0;i<3;i++){cx.beginPath();cx.arc(f.x,f.y,f.r*(.3+.22*i),t*(i%2?1:-1),t*(i%2?1:-1)+4);cx.stroke()}break}
    case 'pad':{cx.globalAlpha=.55;cx.fillStyle='#e870c8';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      cx.globalAlpha=.9;cx.strokeStyle='#fff';cx.lineWidth=4;cx.beginPath();cx.arc(f.x,f.y,f.r*(.55+.1*Math.sin(t*4)),0,7);cx.stroke();
      cx.font='900 20px sans-serif';cx.fillStyle='#fff';cx.textAlign='center';cx.fillText('✦',f.x,f.y+7);break}
    case 'plate':{const off=g.powerOff>0,ph=f.ph||{p:'idle'};
      cx.globalAlpha=off?.25:(ph.p==='fire'?.95:.45+(ph.p==='warn'?.3*Math.sin(t*28):0));
      cx.fillStyle=off?'#555':(ph.p==='fire'?'#fff6a0':'#e8c020');cx.fillRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);
      cx.globalAlpha=.9;cx.strokeStyle=ph.p==='warn'?'#ff4040':'#6a5000';cx.lineWidth=4;cx.strokeRect(f.x-f.w/2,f.y-f.h/2,f.w,f.h);
      cx.font='900 34px sans-serif';cx.textAlign='center';cx.fillStyle=off?'#999':'#6a5000';cx.fillText('⚡',f.x,f.y+12);break}
    case 'vent':{const ph=f.ph||{p:'idle'};
      cx.globalAlpha=.5;cx.fillStyle=ph.p==='fire'?'#ff7a20':'#6a2a1a';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      if(ph.p==='warn'){cx.globalAlpha=.4+.4*Math.sin(t*30);cx.strokeStyle='#ff3030';cx.lineWidth=5;cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.stroke()}
      if(ph.p==='fire'){cx.globalAlpha=.8;cx.fillStyle='#ffd060';cx.beginPath();cx.arc(f.x,f.y,f.r*.7,0,7);cx.fill()}
      cx.globalAlpha=.9;cx.font='26px sans-serif';cx.textAlign='center';cx.fillText('🔥',f.x,f.y+9);break}
    case 'spikes':{
      for(const p of f.pend){cx.globalAlpha=.5+.4*Math.sin(t*20);cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([8,6]);cx.beginPath();cx.arc(p.x,p.y,34,0,7);cx.stroke();cx.setLineDash([])}
      for(const s of f.spots){cx.globalAlpha=s.life<2?.5+.4*Math.sin(t*20):1;cx.fillStyle='#b85ad8';cx.strokeStyle='#2a0a3a';cx.lineWidth=2;
        for(let i=0;i<5;i++){const a=i*1.2566+.3,x=s.x+Math.cos(a)*18,y=s.y+Math.sin(a)*14;cx.beginPath();cx.moveTo(x-8,y+8);cx.lineTo(x,y-16);cx.lineTo(x+8,y+8);cx.closePath();cx.fill();cx.stroke()}}
      break}
    case 'tremor':{const ph=f.ph;
      if(ph&&ph.p==='warn')for(const m of f.marks){cx.globalAlpha=.35+.3*Math.sin(t*26);cx.fillStyle='#d2a24a';cx.beginPath();cx.arc(m.x,m.y,72,0,7);cx.fill();cx.globalAlpha=.9;cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([10,8]);cx.stroke();cx.setLineDash([])}
      break}
    case 'rockfall':{const ph=f.ph;
      if(ph&&ph.p==='warn')for(const m of f.marks){cx.globalAlpha=.3+.3*Math.sin(t*26);cx.fillStyle='#8a6a40';cx.beginPath();cx.arc(m.x,m.y,56,0,7);cx.fill();cx.globalAlpha=.9;cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([10,8]);cx.stroke();cx.setLineDash([]);cx.font='22px sans-serif';cx.textAlign='center';cx.fillText('🪨',m.x,m.y+8)}
      break}
    case 'sandbag':{cx.globalAlpha=1;const sw=f.sw>0?.25*Math.sin(f.sw/.5*9.4):0;
      cx.fillStyle='rgba(0,0,0,.3)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.3,f.r*1.05,f.r*.45,0,0,7);cx.fill();
      cx.save();cx.translate(f.x,f.y-70);cx.rotate(sw);
      cx.strokeStyle='#d8c8a0';cx.lineWidth=3;cx.beginPath();cx.moveTo(0,-24);cx.lineTo(0,0);cx.stroke();
      cx.fillStyle='#b0783e';cx.strokeStyle='#6e4422';cx.lineWidth=4;cx.beginPath();cx.ellipse(0,38,f.r*.8,f.r*1.4,0,0,7);cx.fill();cx.stroke();
      cx.fillStyle='#6e4422';cx.fillRect(-f.r*.8,26,f.r*1.6,8);cx.restore();break}
    case 'lamp':{cx.globalAlpha=1;const gr=cx.createRadialGradient(f.x,f.y-30,2,f.x,f.y-30,60);gr.addColorStop(0,'rgba(255,240,170,.9)');gr.addColorStop(1,'rgba(255,200,90,0)');cx.fillStyle=gr;cx.beginPath();cx.arc(f.x,f.y-30,60,0,7);cx.fill();
      cx.fillStyle='#4a3420';cx.fillRect(f.x-4,f.y-30,8,32);cx.fillStyle='#ffe9a0';cx.strokeStyle='#4a3420';cx.lineWidth=3;cx.beginPath();cx.arc(f.x,f.y-34,11,0,7);cx.fill();cx.stroke();break}
    case 'pole':{cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.3)';cx.beginPath();cx.ellipse(f.x,f.y+6,f.r*.95,f.r*.4,0,0,7);cx.fill();
      cx.fillStyle='#7a5a3a';cx.strokeStyle='#4a3420';cx.lineWidth=3;cx.fillRect(f.x-8,f.y-80,16,86);cx.strokeRect(f.x-8,f.y-80,16,86);
      cx.fillStyle='#5a4028';cx.fillRect(f.x-26,f.y-72,52,8);cx.fillStyle='#ffe14a';cx.beginPath();cx.arc(f.x,f.y-84,9,0,7);cx.fill();cx.stroke();break}
    case 'arc':{const ph=f.ph||{p:'idle'};
      if(ph.p==='idle')break;
      const x=f.x-f.w/2,y=f.y-f.h/2;
      if(ph.p==='warn'){cx.globalAlpha=.25+.3*Math.sin(t*28);cx.fillStyle='#ffe14a';cx.fillRect(x,y,f.w,f.h);cx.globalAlpha=.9;cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([10,8]);cx.strokeRect(x,y,f.w,f.h);cx.setLineDash([])}
      else{cx.globalAlpha=.85;cx.fillStyle='#fff6a0';cx.fillRect(x+10,y,f.w-20,f.h);cx.globalAlpha=.95;cx.strokeStyle='#ffe14a';cx.lineWidth=5;cx.beginPath();
        for(let i=0;i<=8;i++){const yy=y+f.h*i/8,xx=f.x+(i%2?10:-10)*Math.sin(t*40+i);i?cx.lineTo(xx,yy):cx.moveTo(xx,yy)}cx.stroke()}
      break}
    case 'heat':{cx.globalAlpha=.10;cx.fillStyle='#ff6a20';cx.fillRect(0,0,AW,AH);cx.globalAlpha=.16;cx.strokeStyle='#ffb070';cx.lineWidth=2;
      for(let i=0;i<14;i++){const x=(i*173+((t*30)|0)*0)%AW,y=60+((i*97)%640);cx.beginPath();for(let k=0;k<=8;k++){const xx=x+k*7,yy=y+3*Math.sin(t*4+k+i);k?cx.lineTo(xx,yy):cx.moveTo(xx,yy)}cx.stroke()}break}
    case 'spring':{cx.globalAlpha=.6;cx.fillStyle='#78c8d2';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      cx.globalAlpha=.9;cx.strokeStyle='#8a6a4a';cx.lineWidth=6;cx.stroke();
      cx.globalAlpha=.5;cx.strokeStyle='#fff';cx.lineWidth=3;for(let i=0;i<3;i++){const u=(t*.6+i/3)%1;cx.beginPath();cx.arc(f.x,f.y,f.r*(.3+.6*u),0,7);cx.globalAlpha=.5*(1-u);cx.stroke()}
      cx.globalAlpha=.9;cx.font='22px sans-serif';cx.textAlign='center';cx.fillText('♨',f.x,f.y+8);break}
    case 'drill':{const names=['스피드','회피','노말'],cols=['#5ad0ff','#7cf08a','#ffb04a'];
      cx.globalAlpha=.9;cx.fillStyle='rgba(20,16,10,.7)';cx.fillRect(CX-130,18,260,40);cx.strokeStyle='#c8a868';cx.lineWidth=3;cx.strokeRect(CX-130,18,260,40);
      for(let i=0;i<3;i++){const on=i===f.step;cx.globalAlpha=on?1:.35;cx.fillStyle=on?cols[i]:'#aaa';cx.beginPath();cx.arc(CX-80+i*80,38,13,0,7);cx.fill();
        cx.globalAlpha=on?1:.55;cx.font='bold 12px sans-serif';cx.textAlign='center';cx.fillStyle='#fff';cx.fillText(names[i],CX-80+i*80,56+0)}
      break}
    case 'gust':{const ph=f.ph||{p:'idle'},dx=f.dx*f.sign,y0=f.y-f.h/2;
      if(ph.p==='warn'||ph.p==='fire'){cx.globalAlpha=ph.p==='fire'?.5:.2+.15*Math.sin(t*26);cx.fillStyle='#bfe8ff';cx.fillRect(40,y0,AW-80,f.h)}
      cx.globalAlpha=.5;cx.strokeStyle='#e8f6ff';cx.lineWidth=3;cx.font='900 30px sans-serif';cx.textAlign='center';cx.fillStyle='#e8f6ff';
      for(let i=0;i<6;i++){const x=((i*200+t*(dx>0?60:-60))%1100+1100)%1100+50;cx.globalAlpha=.25+(ph.p!=='idle'?.35:0);cx.fillText(dx>0?'➤':'⬅',x,f.y+10)}
      break}
    case 'cloudpad':{cx.globalAlpha=.85;cx.fillStyle='rgba(170,190,220,.6)';cx.beginPath();cx.ellipse(f.x,f.y+10,f.r,f.r*.45,0,0,7);cx.fill();
      cx.fillStyle='rgba(250,252,255,.9)';for(const [a,b,c] of [[-.45,0,.5],[0,-.15,.62],[.45,0,.5]]){cx.beginPath();cx.ellipse(f.x+a*f.r,f.y+b*f.r+Math.sin(t*2)*2,f.r*c,f.r*c*.7,0,0,7);cx.fill()}break}
    case 'mirror':{const ph=f.ph;if(!ph||ph.p==='idle')break;
      cx.globalAlpha=ph.p==='warn'?.15+.12*Math.sin(t*20):.14;cx.fillStyle='#a05ae6';cx.fillRect(0,0,AW,AH);
      cx.globalAlpha=.5;cx.strokeStyle='#d8a8ff';cx.lineWidth=4;cx.strokeRect(30,30,AW-60,AH-60);
      if(ph.p==='fire'){cx.globalAlpha=.8;cx.font='900 22px sans-serif';cx.textAlign='center';cx.fillStyle='#f0d8ff';cx.fillText('트릭룸 '+Math.ceil(10-ph.u)+'초',CX,64)}
      break}
    case 'crackice':{const x0=f.x0,y0=f.y0,w=f.cols*f.cw,h=f.rows*f.ch;
      cx.globalAlpha=.22;cx.fillStyle='#c8ebff';cx.fillRect(x0,y0,w,h);cx.globalAlpha=.35;cx.strokeStyle='#f0fcff';cx.lineWidth=1;cx.strokeRect(x0,y0,w,h);
      for(let i=0;i<96;i++){const c=i%f.cols,r=(i/f.cols)|0,x=x0+c*f.cw,y=y0+r*f.ch;
        if(f.br[i]>0){cx.globalAlpha=f.br[i]<1.5?.3+.2*Math.sin(t*20):.5;cx.fillStyle='#3c78c8';cx.fillRect(x+2,y+2,f.cw-4,f.ch-4);cx.globalAlpha=.7;cx.fillStyle='#dcf0ff';cx.fillRect(x+2,y+2,f.cw-4,6)}
        else if(f.p[i]>=1.2){cx.globalAlpha=.85;cx.strokeStyle='#5078a0';cx.lineWidth=2;cx.beginPath();const k=f.p[i]/3;cx.moveTo(x+f.cw*.2,y+f.ch*.3);cx.lineTo(x+f.cw*.55,y+f.ch*.55);cx.lineTo(x+f.cw*.4,y+f.ch*.85);if(k>.6){cx.moveTo(x+f.cw*.55,y+f.ch*.55);cx.lineTo(x+f.cw*.9,y+f.ch*.7)}cx.stroke()}}
      break}
    case 'pollen':{if(!f.vis)break;cx.globalAlpha=.85;const gr=cx.createRadialGradient(f.x,f.y,2,f.x,f.y,34);gr.addColorStop(0,'#fff6c0');gr.addColorStop(1,'rgba(255,170,220,0)');cx.fillStyle=gr;cx.beginPath();cx.arc(f.x,f.y,34,0,7);cx.fill();
      cx.font='20px sans-serif';cx.textAlign='center';cx.fillText('🌸',f.x,f.y+7);break}
    case 'boulder':case 'rock':{if(f.dead)break;if(f.k==='rock'&&f.life<2)cx.globalAlpha=.5+.4*Math.sin(t*20);cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.7,f.r*.95,f.r*.4,0,0,7);cx.fill();
      const dmg=1-f.hp/f.maxhp;cx.fillStyle=dmg>.5?'#8a7a68':'#a08a70';cx.strokeStyle='#4a3a2a';cx.lineWidth=4;cx.beginPath();cx.moveTo(f.x-f.r,f.y+f.r*.5);cx.lineTo(f.x-f.r*.7,f.y-f.r*.6);cx.lineTo(f.x,f.y-f.r);cx.lineTo(f.x+f.r*.8,f.y-f.r*.5);cx.lineTo(f.x+f.r,f.y+f.r*.5);cx.closePath();cx.fill();cx.stroke();
      if(dmg>0){cx.strokeStyle='#2a1a0a';cx.lineWidth=3;cx.beginPath();cx.moveTo(f.x-f.r*.2,f.y-f.r*.8);cx.lineTo(f.x+f.r*.1,f.y-f.r*.1);cx.lineTo(f.x-f.r*.2,f.y+f.r*.3);cx.stroke()}
      if(f.flash>0){cx.globalAlpha=.5;cx.fillStyle='#fff';cx.fill()}break}
    case 'breaker':{cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+14,f.r*.9,f.r*.4,0,0,7);cx.fill();
      cx.fillStyle=g.powerOff>0?'#555':'#e8c020';cx.strokeStyle='#2a2000';cx.lineWidth=4;cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();cx.stroke();
      cx.font='900 22px sans-serif';cx.textAlign='center';cx.fillStyle='#2a2000';cx.fillText(g.powerOff>0?Math.ceil(g.powerOff):'⚡',f.x,f.y+8);break}
    }
  }
  // 반짝 효과
  for(const e of g.fx){const u=e.t/e.life;cx.globalAlpha=1-u;
    if(e.k==='ring'){cx.strokeStyle=e.c||'#fff';cx.lineWidth=5;cx.beginPath();cx.arc(e.x,e.y,20+u*60,0,7);cx.stroke()}
    else{cx.fillStyle=e.k==='zap'?'#fff6a0':'#ffb060';cx.beginPath();cx.arc(e.x,e.y,(e.w||100)*.5*(.6+u*.5),0,7);cx.fill()}}
  cx.restore()}

// ───────── 포켓몬 위에 덮는 것 (어둠) ─────────
let _dk=null;
function over(g,cx,W){
  if(!g.feats.some(f=>f.k==='dark'))return;
  if(!_dk){_dk=document.createElement('canvas');_dk.width=600;_dk.height=380}
  const c=_dk.getContext('2d');c.globalCompositeOperation='source-over';c.clearRect(0,0,600,380);
  c.fillStyle='rgba(4,6,26,.64)';c.fillRect(0,0,600,380);c.globalCompositeOperation='destination-out';
  const hole=(x,y,r)=>{const gr=c.createRadialGradient(x/2,y/2,r*.45/2,x/2,y/2,r/2);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.beginPath();c.arc(x/2,y/2,r/2,0,7);c.fill()};
  const me=W.me,foe=W.foe,lit=[];
  if(me)hole(me.x,me.y-20,180);
  for(const f of g.feats)if(f.k==='lamp'){hole(f.x,f.y-30,170);lit.push(f)}
  cx.save();cx.globalAlpha=1;cx.drawImage(_dk,0,0,AW,AH);
  // 불빛 밖의 상대는 흐릿하게
  if(foe&&foe.hp>0&&me){const seen=dist(foe.x,foe.y,me.x,me.y)<=180||lit.some(f=>dist(foe.x,foe.y,f.x,f.y)<=170);
    if(!seen){cx.fillStyle='rgba(4,6,26,.5)';cx.beginPath();cx.ellipse(foe.x,foe.y-40,(foe.r||40)*1.7,(foe.r||40)*2.2,0,0,7);cx.fill()}}
  cx.restore()}

window.GYMFX={make,tick,draw,over,key,info,bg,DEF};
})();
