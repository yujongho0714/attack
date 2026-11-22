/* gymfx.js — 체육관 경기장 장치 (레조넌스 1번 자료의 규칙을 읽어 새로 짠 것)
   1/3: 공통 엔진 + 관동 8곳 (회색·블루·갈색·무지개·연분홍·노랑·홍련·상록)
   2/3: 호연 8곳 (rustboro·dewford·mauville·lavaridge·petalburg·fortree·mossdeep·sootopolis)
   3/3: 신오 8곳 (oreburgh·eterna·hearthome·veilstone·pastoria·canalave·snowpoint·sunyshore) + 바다(sea, 장치 없는 바닥 그림)
   4/4: 성도 8곳 (violet·azalea·goldenrod·ecruteak·cianwood·olivine·mahogany·blackthorn) — 하계(난이도 8)에서 씀
   쓰는 법: rtbattle.js가 start()에서 GYMFX.make(key,H) → 매 틱 GYMFX.tick(g,W) → render에서 GYMFX.draw(g,cx,W)
   H = rtbattle가 넘겨 주는 도구(floatTxt, setAil, fmtN, kOf, cancelCast, rnd)
   ★ 유저 편들기(2026-11-22, 사용자 결정): 장치는 난이도 6(천계) 이상에서만 켜지고, '해로운 효과는 상대(CPU)만 · 이로운 효과는 내 포켓몬만' 받는다.
     eb = 해로운 장치를 받는 쪽(상대), eg = 이로운 장치를 받는 쪽(나). 끄고 싶으면 H.pro=false (기본 켜짐) */
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
// 3/3 신오용
const vein=(x,y)=>({k:'orevein',x,y,r:34,hp:1,maxhp:1,dead:0,rt:0,flash:0});
const snowb=(x,y)=>({k:'snowb',x0:x,y0:y,x,y,r:22,st:0,vx:0,vy:0,d:0,rt:0,hit:{}});
const VINE_GROUPS=[[[420,200]],[[420,560]],[[552,250],[600,250],[648,250]],[[480,380]],[[300,170]],[[300,590]]];
// 4/4 성도용
const SW_SPD=320;   // 지나가는 것(실·공·파도·불길)의 속도(px/초) — 원본 sweep speedPx
const vg=(x,dy,off)=>({k:'vgust',x,w:120,dy,sign:1,cyc:{period:8,warn:1.3,fire:.4,off:off||0}});
const web=(x,y,r)=>({k:'web',x,y,r});
const bumper=(x,y)=>({k:'bumper',x,y,r:30,sw:0});
const wisp=(ph,mir)=>({k:'wisp',per:20,ph,mir:mir||0,x:-999,y:-999});
const magnet=(x,y,off)=>({k:'magnet',x,y,r:30,cyc:{period:10,warn:1.5,fire:3,off:off||0}});
const crate=(x,y)=>({k:'boulder',x,y,r:34,hp:1,respawn:10,crate:1});
const icep=(x,y)=>({k:'boulder',x,y,r:40,hp:2,respawn:14,ice:1});
// 지나가는 것: mv='x'면 가로로(줄 높이 th, 가운데 y=fix), mv='y'면 세로로(줄 너비 th, 가운데 x=fix). dir=1이면 오른쪽/아래로
const swp=(mv,fix,dir,eff,per,off,th,bw)=>{const L=mv==='x'?AW:AH;return{k:'sweep',mv,fix,dir,eff,th,bw,L,cyc:{period:per,warn:1.5,fire:(L+bw)/SW_SPD,off:off||0}}};

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
  // ── 신오 (3/3) ──
  oreburgh:{img:'gym-oreburgh',info:'5초마다 낙석! 빨간 원을 피하세요 (바위 타입은 괜찮아요) · 광맥을 맞혀 부수면 광석이 나와요 (주우면 받는 피해가 줄어요)',
    f:[{k:'rockfall2'},vein(420,74),vein(780,686),vein(420,686),vein(780,74)]},
  eterna:{img:'gym-eterna',info:'덩굴벽이 자라나요 · 총알을 막고 닿으면 아파요 (풀 타입은 지나가고, 불 기술은 바로 태워요)',
    f:[{k:'vinemgr'}]},
  hearthome:{img:'gym-hearthome',info:'어두운 무대예요 · 조명 안에서는 기술이 세져요 · 조명 밖의 고스트 타입은 상대가 노리지 못해요 (고스트 기술도 세져요)',
    f:[{k:'spot',ph:.25,mir:0},{k:'spot',ph:.25,mir:1}]},
  veilstone:{img:'gym-veilstone',info:'링이 점점 좁아져요 · 로프에 닿으면 튕겨나요 (격투 타입은 안 아프고 다음 근접이 세져요) · 근접으로 때리면 상대가 멀리 날아가요',
    f:[{k:'ring'}]},
  pastoria:{img:'gym-pastoria',info:'10초마다 물이 차올라요 · 물 타입이 아니면 느려져요 · 양쪽 끝 스위치를 밟으면 물이 빠져요',
    f:[{k:'tide'},{k:'tsw',x:110,y:CY,r:40,cd:0},{k:'tsw',x:1090,y:CY,r:40,cd:0}]},
  canalave:{img:'gym-canalave',info:'가운데 판이 올라왔다 내려가요 · 강철 타입만 올라탈 수 있어요 · 판이 올라올 때 밑에 있으면 아파요',
    f:[{k:'lift'}]},
  snowpoint:{img:'gym-snowpoint',info:'눈덩이가 굴러다녀요 · 맞으면 아프고 느려져요 (얼음 타입은 안 맞아요) · 몸이나 기술로 밀면 굴러가요',
    f:[snowb(CX,150),snowb(CX,CY),snowb(CX,610),{k:'snowmgr'}]},
  sunyshore:{img:'gym-sunyshore',info:'등대 빛줄기가 빙글빙글 돌아요 · 닿으면 마비! (전기 타입은 충전돼요)',
    f:[{k:'beacon',x:CX,y:CY,r:30}]},
  // ── 성도 (4/4) ──
  violet:{img:'gym-violet',info:'바람이 일렁인 뒤 돌풍이 위아래로 번갈아 몰아쳐요 · 맞으면 밀려나요 (비행 타입은 괜찮아요)',
    f:[vg(330,1,0),vg(870,-1,0),vg(CX,1,4)]},
  azalea:{img:'gym-azalea',info:'거미줄을 밟으면 느려져요 · 끈끈한 실이 줄줄이 날아와요 (맞으면 한참 느려져요) · 표시된 줄을 피하세요 (벌레 타입은 괜찮아요)',
    f:[web(420,190,90),web(780,570,90),web(420,570,90),web(780,190,90),web(CX,CY,70),
       swp('x',200,1,'web',14,0,80,80),swp('x',560,-1,'web',14,0,80,80),swp('x',300,-1,'web',14,3.5,80,80),swp('x',460,1,'web',14,3.5,80,80)]},
  goldenrod:{img:'gym-goldenrod',info:'범퍼에 닿으면 튕겨 나가요 · 커다란 공이 굴러와요 · 표시된 줄을 피하세요 (노말 타입은 괜찮아요)',
    f:[bumper(450,240),bumper(750,520),bumper(450,520),bumper(750,240),bumper(CX,120),bumper(CX,640),
       swp('y',360,1,'ball',14,0,100,100),swp('y',840,-1,'ball',14,0,100,100),swp('y',110,-1,'ball',14,5,100,100),swp('y',1090,1,'ball',14,5,100,100)]},
  ecruteak:{img:'gym-ecruteak',info:'어두운 곳이에요 · 램프와 내 몸 주변만 밝아요 · 도깨비불에 닿으면 화상! (불꽃·고스트 타입은 괜찮아요)',
    f:[{k:'dark'},lamp(CX,150),lamp(CX,610),wisp(0,0),wisp(.5,1)]},
  cianwood:{img:'gym-cianwood',info:'상자가 기술을 막아 줘요 (한 번 맞으면 부서지고 10초 뒤 다시 놓여요) · 파도가 경기장을 휩쓸어요 (휩쓸리면 밀려나요, 격투 타입은 괜찮아요)',
    f:[crate(450,170),crate(750,590),crate(450,590),crate(750,170),crate(CX,300),crate(CX,460),
       swp('x',CY,1,'wave',16,0,AH,80),swp('x',CY,-1,'wave',16,8,AH,80)]},
  olivine:{img:'gym-olivine',info:'자석 기둥이 웅웅거린 뒤 주변을 끌어당겨요 · 그때 기둥 사이로 전류가 흘러요 (강철·전기 타입은 괜찮아요)',
    f:[magnet(CX,200,0),magnet(CX,560,0),{k:'mcur',x:CX,y1:200,y2:560,w:70,cyc:{period:10,warn:1.5,fire:3,off:0}}]},
  mahogany:{img:'gym-mahogany',info:'바닥이 미끄러워요 · 싸라기눈에 조금씩 깎여요 · 얼음 기둥은 두 번 맞히면 부서져요 (얼음 타입은 괜찮아요)',
    f:[{k:'icefloor'},icep(CX,220),icep(CX,540)]},
  blackthorn:{img:'gym-blackthorn',info:'가운데를 두른 불길이 때때로 치솟아요 · 석상이 용의 숨결을 내뿜어요 · 표시된 줄을 피하세요 (드래곤·불꽃 타입은 괜찮아요)',
    f:[{k:'flamering'},swp('x',190,1,'flame',24,0,110,90),swp('x',570,-1,'flame',24,0,110,90),swp('x',CY,-1,'flame',24,6,110,90),swp('x',CY,1,'flame',24,12,110,90)]},
  // 바다: 장치 없이 바닥 그림만 (물 위 야생 전투)
  sea:{img:'sea',info:'',f:[]},
};

function key(k){return DEF[k]?k:null}
function info(k){const i=DEF[k]?DEF[k].info:'';return i?i+' ★ 해로운 장치는 상대에게만, 이로운 장치는 나에게만 걸려요':''}

const _img={};
function bg(k){const d=DEF[k];if(!d)return null;const RC=window.REGCUR,pre=(RC==='d')?'d_':(RC==='u')?'u_':'',ck=pre?k+'#'+pre:k;if(_img[ck])return _img[ck];const im=new Image();if(pre){im.onerror=()=>{im.onerror=null;im.src='arena/'+d.img+'.webp'};im.src='arena/'+pre+k+'.webp'}else im.src='arena/'+d.img+'.webp';_img[ck]=im;return im}   // 명계(9)=arena/d_<장치>.webp · 하계(8)=arena/u_<장치>.webp 먼저(바다 포함), 없으면 예전 그림

// 주기 계산: 한 주기의 끝쪽 fire초 동안 발동, 그 앞 warn초는 예고
function phase(c,t){const u=(((t-(c.off||0))%c.period)+c.period)%c.period,fs=c.period-c.fire;
  if(u>=fs)return{p:'fire',u:u-fs,n:Math.floor((t-(c.off||0))/c.period)};
  if(u>=fs-c.warn)return{p:'warn',k:(u-(fs-c.warn))/c.warn,n:Math.floor((t-(c.off||0))/c.period)};
  return{p:'idle',n:-1}}

// ───────── 만들기 ─────────
function make(k,H){
  const d=DEF[k];if(!d)return null;
  const pro=!(H&&H.pro===false);
  const g={key:k,H,pro,t:0,img:bg(k),powerOff:0,msgT:0,fx:[],feats:[],slides:[]};
  if(pro&&H&&H.setAil){const sa=H.setAil;g.H=Object.assign({},H,{setAil:(e,st,c)=>{if(g.W&&e===g.W.me)return;return sa(e,st,c)}})}   // 안전망: 내 몸에는 장치 상태이상 안 걸림
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
    if(o.k==='rockfall2'){o.marks=[];o.lastW=-9;o.lastN=-9}
    if(o.k==='vinemgr'){o.pend=[];o.next=6;o.n=0}
    if(o.k==='ring'){o.L=100;o.R=1100;o.T=80;o.B=680;o.st=0;o.warn=0}
    if(o.k==='tide'){o.lvl=0;o.next=10;o.block=0;o.warn=0}
    if(o.k==='lift'){o.up=0;o.w=320;o.h=220;o.x=CX;o.y=CY;o.u=0}
    if(o.k==='snowmgr'){o.next=14;o.pend=null}
    if(o.k==='beacon'){o.ang=0;o.sign=1;o.len=560;o.wid=34;o.sw=0}
    if(o.cyc)o.lastN=-9;
    o.id=g.feats.length;
    g.feats.push(o)}
  g.pads=g.feats.filter(f=>f.k==='pad');
  const SOL=['boulder','breaker','pole','sandbag','lamp','orevein','beacon','bumper','magnet'];
  g.solids=g.feats.filter(f=>SOL.includes(f.k));
  for(const s of g.solids)s.tall=s.k!=='lamp'?1:0;
  return g}

// ───────── 피해 도우미 ─────────
function hurt(g,e,frac,col){
  if(e.hp<=0||e.inv>0||e.hidden||g.W.tut)return 0;
  if(g.pro&&e===g.W.me)return 0;   // 유저 편들기: 장치 피해는 상대만
  const H=g.H,d=Math.max(1,Math.round((e.pctMax||e.max)*frac));
  e.hp=Math.max(0,e.hp-d);e.flash=.12;
  H.floatTxt(e.x,e.y-70,H.fmtN(d*H.kOf(e)),col||'#ff8a4a');return d}
const ground=e=>!(e.types&&e.types.includes('FLYING'));

// ───────── 한 틱 ─────────
function tick(g,W){
  g.W=W;g.t+=TICK;const t=g.t,H=g.H,ents=[W.me,W.foe].filter(e=>e&&e.hp>0&&!e.hidden);
  const PRO=g.pro,eb=ents.filter(e=>!PRO||e===W.foe),eg=ents.filter(e=>!PRO||e===W.me);   // eb: 해로운 장치 대상(상대) · eg: 이로운 장치 대상(나)
  if(g.powerOff>0)g.powerOff=Math.max(0,g.powerOff-TICK);
  for(const e of [W.me,W.foe]){e.gxMul=1;e.gxPow=null;e.gxRoll=1;e.gxRc=1;e.gxTake=1;e.gxHide=0;if(e.gxMelT>0)e.gxMelT-=TICK;if(e.gxChgT>0)e.gxChgT-=TICK;if(e.vnCd>0)e.vnCd-=TICK;if(e.ropeCd>0)e.ropeCd-=TICK;if(e.bmCd>0)e.bmCd-=TICK;
    if(e.gxB&&e.gxB.t>0){e.gxB.t-=TICK;e.gxTake*=e.gxB.m}if(e.slowT>0){e.slowT-=TICK;e.gxMul*=.5}if(e.gxMelT<=0)e.gxMelT=0;if(e.gxChgT<=0)e.gxChgT=0;if(e.padCd>0)e.padCd-=TICK;if(e.sbCd>0)e.sbCd-=TICK;e.gxT=(e.gxT||0)-TICK;e.gxTk=e.gxT<=0}
  for(const e of ents)if(e.gxTk)e.gxT=.5;   // 0.5초마다 바닥 효과 한 번

  for(const f of g.feats){
    switch(f.k){
    case 'boulder':{
      if(f.flash>0)f.flash-=TICK;if(f.dead){f.rt-=TICK;if(f.rt<=0){f.dead=0;f.hp=f.maxhp}}break}
    case 'breaker':{if(f.flash>0)f.flash-=TICK;break}
    case 'pool':
      for(const e of eb){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3&&!has(e,['WATER']))e.gxMul*=.6}
      for(const e of eg){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3)e.gxPow={t:'WATER',m:1.25}}
      break;
    case 'grass':
      for(const e of eg){if(e.gxTk&&has(e,['GRASS'])&&dist(e.x,e.y,f.x,f.y)<=f.r){
        const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.006)));
        if(h>0&&e.hp<e.max){e.hp+=h;H.floatTxt(e.x,e.y-80,'+'+H.fmtN(h*H.kOf(e)),'#7dff8a')}}}
      break;
    case 'puddle':
      for(const e of eb){if(!has(e,['POISON','STEEL'])&&dist(e.x,e.y,f.x,f.y)<=f.r){
        if(e.gxTk){hurt(g,e,.006,'#c77dd8');e.pdT=(e.pdT||0)+.5;if(e.pdT>=3){e.pdT=0;H.setAil(e,'poison',100)}}}}
      break;
    case 'sand':
      for(const e of eb){if(!has(e,['GROUND'])&&dist(e.x,e.y,f.x,f.y)<=f.r){
        e.gxMul*=.55;const dx=f.x-e.x,dy=f.y-e.y,L=Math.hypot(dx,dy)||1,p=55*TICK;e.x+=dx/L*p;e.y+=dy/L*p}}
      break;
    case 'pad':
      if(f.wander){const w=f.wander,a=(t/w.per)*6.2832,sg=w.mir?-1:1;f.x=f.bx+sg*w.ax*Math.sin(a);f.y=f.by+sg*w.ay*Math.sin(a)}
      for(const e of eb){if(e.padCd>0||e.rollT>0)continue;
        if(dist(e.x,e.y,f.x,f.y)<=f.r){const to=g.pads[f.to];if(!to)continue;
          g.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.4,c:'#ff7ad0'},{k:'ring',x:to.x,y:to.y,t:0,life:.4,c:'#ff7ad0'});
          e.x=to.x;e.y=to.y;e.padCd=3;e.vx=e.vy=0;H.floatTxt(e.x,e.y-90,'순간이동!','#ff9ae0')}}
      break;
    case 'plate':case 'vent':{
      const ph=phase(f.cyc,t);f.ph=ph;
      const live=f.k==='vent'||g.powerOff<=0;
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        if(live){
          for(const e of eb){
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
        for(const e of eb){if(has(e,['GRASS']))continue;
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
        if(s.cd<=0)for(const e of eb){if(!ground(e)||has(e,['STEEL']))continue;
          if(dist(e.x,e.y,s.x,s.y)<=34+e.r*.4){
            if(has(e,['POISON'])){s.life=0;H.floatTxt(s.x,s.y-30,'독 흡수','#c77dd8');break}
            hurt(g,e,.03,'#c77dd8');H.setAil(e,'poison',100);s.cd=1}}}
      f.spots=f.spots.filter(s=>s.life>0);
      break}
    case 'rockfall2':{
      const ph=phase({period:5,warn:1,fire:.3,off:2.3},t);f.ph=ph;
      if(ph.p==='warn'&&f.lastW!==ph.n){f.lastW=ph.n;f.marks=eb.map(e=>({x:e.x,y:e.y}))}
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        for(const e of eb){if(has(e,['ROCK'])||!f.marks.some(m=>dist(e.x,e.y,m.x,m.y)<=100+e.r*.3))continue;
          hurt(g,e,.14,'#c8a878');e.stun=Math.max(e.stun,24);try{H.cancelCast(e,false)}catch(er){}}
        W.qk=Math.max(W.qk||0,.4);for(const m of f.marks)g.fx.push({k:'boom',x:m.x,y:m.y,w:200,t:0,life:.35});f.marks=[]}
      break}
    case 'orevein':{
      if(f.flash>0)f.flash-=TICK;
      if(f.dead){f.rt-=TICK;if(f.rt<=0){f.dead=0;f.hp=f.maxhp}}
      break}
    case 'ore':{
      for(const e of eg){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3){
        e.gxB=has(e,['ROCK'])?{m:.7,t:16}:{m:.9,t:6};f.gone=1;
        g.fx.push({k:'ring',x:f.x,y:f.y,t:0,life:.4,c:'#ffd27a'});H.floatTxt(e.x,e.y-80,'광석! 받는 피해 감소','#ffd27a');break}}
      break}
    case 'vinemgr':{
      if(t>=f.next){f.next+=7;f.n++;
        const cnt=g.feats.filter(q=>q.k==='vine').length+f.pend.length;
        const free=VINE_GROUPS.filter(gr=>5-cnt>=gr.length&&!gr.some(([x,y])=>g.feats.some(q=>q.k==='vine'&&dist(q.x,q.y,x,y)<30)||f.pend.some(p=>dist(p.x,p.y,x,y)<30)));
        if(free.length){const gr=free[Math.floor(H.rnd()*free.length)%free.length];for(const [x,y] of gr)f.pend.push({x,y,t:1})}}
      for(const p of f.pend)p.t-=TICK;
      for(const p of f.pend)if(p.t<=0){const v={k:'vine',x:p.x,y:p.y,r:24,hp:3,maxhp:3,tall:1,flash:0};g.feats.push(v);g.solids.push(v);g.fx.push({k:'ring',x:p.x,y:p.y,t:0,life:.3,c:'#7dff8a'})}
      f.pend=f.pend.filter(p=>p.t>0);
      break}
    case 'vine':{if(f.flash>0)f.flash-=TICK;break}
    case 'spot':{
      const a=(t/24)*6.2832+f.ph*6.2832;let x=CX+320*Math.sin(a),y=CY+190*Math.sin(a*1.5);
      if(f.mir){x=AW-x;y=AH-y}f.x=x;f.y=y;
      if(f===g.feats.find(q=>q.k==='spot')){
        const L=g.feats.filter(q=>q.k==='spot');
        for(const e of ents){const lit=L.some(q=>dist(e.x,e.y,q.x,q.y)<=120+e.r*.3);e.gxLit=lit;if(!eg.includes(e))continue;
          if(lit)e.gxPow={all:1,m:1.2};else if(has(e,['GHOST'])){e.gxPow={t:'GHOST',m:1.2};e.gxHide=1}}}
      break}
    case 'ring':{
      f.st=t>=24?2:t>=12?1:0;f.warn=(t>=11&&t<12)||(t>=23&&t<24);
      if(f.lastSt!==f.st&&f.lastSt!=null){H.floatTxt(CX,150,'🥊 링이 좁아졌어요!','#ffb0b0',true);W.qk=Math.max(W.qk||0,.3)}f.lastSt=f.st;
      const L=f.L+90*f.st,R=f.R-90*f.st,T=f.T+90*f.st,B=f.B-90*f.st;f.cL=L;f.cR=R;f.cT=T;f.cB=B;
      for(const e of ents){const m=e.r*.35;let side=0;
        if(e.x<=L+m+1)side=1;else if(e.x>=R-m-1)side=2;else if(e.y<=T+m+1)side=3;else if(e.y>=B-m-1)side=4;
        e.x=clamp(e.x,L+m,R-m);e.y=clamp(e.y,T+m,B-m);
        if(side&&!(e.ropeCd>0)){e.ropeCd=.8;
          const dx=side===1?1:side===2?-1:0,dy=side===3?1:side===4?-1:0;
          if(eb.includes(e))g.slides.push({e,dx:dx*120,dy:dy*120,t:.25,tt:.25});
          if(has(e,['FIGHTING'])){if(eg.includes(e)){e.gxMelT=2;H.floatTxt(e.x,e.y-80,'로프 반동! 다음 근접 강화','#ffd27a')}}
          else if(eb.includes(e)){hurt(g,e,.1,'#ff8a8a');e.stun=Math.max(e.stun,60);try{H.cancelCast(e,false)}catch(er){}}
          g.fx.push({k:'ring',x:e.x,y:e.y,t:0,life:.3,c:'#ff8a8a'})}}
      break}
    case 'tide':{
      if(f.block>0)f.block-=TICK;
      else if(f.lvl<2){f.next-=TICK;f.warn=f.next<=1;
        if(f.next<=0){f.lvl++;f.next=10;f.warn=0;H.floatTxt(CX,150,f.lvl===1?'💧 물이 차올랐어요':'🌊 물이 깊어졌어요!','#7ad0ff',true)}}
      else f.warn=0;
      for(const e of ents){const w=has(e,['WATER']),G=eg.includes(e),B=eb.includes(e);
        if(f.lvl===1){if(w){if(G)e.gxMul*=1.1}else if(B)e.gxMul*=.8}
        else if(f.lvl===2){if(w){if(G)e.gxMul*=1.3}else if(B)e.gxMul*=.55;if(B&&has(e,['GROUND']))e.gxMul*=.7;if(B&&!w&&e.gxTk)hurt(g,e,.01,'#7ad0ff')}}
      break}
    case 'tsw':{
      if(f.cd>0)f.cd-=TICK;
      const td=g.feats.find(q=>q.k==='tide');
      if(td&&td.lvl>=2&&f.cd<=0)for(const e of ents){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3){
        td.lvl=0;td.next=10;td.block=8;td.warn=0;for(const q of g.feats)if(q.k==='tsw')q.cd=2;
        if(!has(e,['WATER'])&&eb.includes(e))e.stun=Math.max(e.stun,60);
        g.fx.push({k:'ring',x:f.x,y:f.y,t:0,life:.5,c:'#7ad0ff'});H.floatTxt(f.x,f.y-60,'물이 빠졌어요!','#7ad0ff',true);break}}
      break}
    case 'lift':{
      const u=t%8,up=u>=4;f.u=u;f.warn=u>=3&&u<4;
      const inside=e=>Math.abs(e.x-f.x)<=f.w/2+e.r*.3&&Math.abs(e.y-f.y)<=f.h/2+e.r*.3;
      if(up&&!f.up){   // 올라오는 순간: 밑에 있던 몸은 눌림
        for(const e of eb){if(!has(e,['STEEL'])&&inside(e)){hurt(g,e,.12,'#bcc8d8');e.stun=Math.max(e.stun,24);try{H.cancelCast(e,false)}catch(er){}}}
        W.qk=Math.max(W.qk||0,.3);g.fx.push({k:'boom',x:f.x,y:f.y,w:260,t:0,life:.35})}
      f.up=up;
      if(up)for(const e of ents){
        if(has(e,['STEEL'])){if(inside(e)&&eg.includes(e)){e.gxTake*=.85;e.gxPow={all:1,m:1.3}}}
        else if(inside(e)){const dl=e.x-(f.x-f.w/2),dr=(f.x+f.w/2)-e.x,dt=e.y-(f.y-f.h/2),db=(f.y+f.h/2)-e.y,mn=Math.min(dl,dr,dt,db),m=e.r*.4;
          if(mn===dl)e.x=f.x-f.w/2-m;else if(mn===dr)e.x=f.x+f.w/2+m;else if(mn===dt)e.y=f.y-f.h/2-m;else e.y=f.y+f.h/2+m}}
      break}
    case 'snowb':{
      const roll=(dx,dy)=>{const L=Math.hypot(dx,dy)||1;f.st=1;f.vx=dx/L*480;f.vy=dy/L*480;f.d=0;f.hit={}};
      if(f.st===2){f.rt-=TICK;if(f.rt<=0){f.st=0;f.x=f.x0;f.y=f.y0;f.r=22;f.d=0}break}
      if(f.st===0){
        for(const e of ents){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.5){roll(f.x-e.x,f.y-e.y);break}}
        if(f.st===0)for(const p of W.proj){if(p.dead||p.wait>0)continue;
          if(dist(p.x,p.y,f.x,f.y)<=f.r+(p.r||10)*.6){roll(p.dx||0,p.dy||1);p.dead=1;break}}
      }else{
        f.x+=f.vx*TICK;f.y+=f.vy*TICK;f.d+=480*TICK;f.r=22+26*Math.min(1,f.d/520);
        for(const e of eb){if(has(e,['ICE'])||f.hit[e.side])continue;
          if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.4){f.hit[e.side]=1;
            hurt(g,e,.08+.04*(f.r-22)/26,'#bfe8ff');e.stun=Math.max(e.stun,24);e.slowT=2;try{H.cancelCast(e,false)}catch(er){}
            g.fx.push({k:'boom',x:f.x,y:f.y,w:f.r*3,t:0,life:.35});f.st=2;f.rt=6;break}}
        if(f.st===1&&(f.x<40||f.x>AW-40||f.y<40||f.y>AH-40)){g.fx.push({k:'boom',x:f.x,y:f.y,w:f.r*3,t:0,life:.35});f.st=2;f.rt=6}
      }
      break}
    case 'snowmgr':{
      if(!f.pend&&t>=f.next){f.next+=14;
        const balls=g.feats.filter(q=>q.k==='snowb'&&q.st===0);
        if(balls.length&&eb.length){const e=eb[Math.floor(H.rnd()*eb.length)%eb.length];
          balls.sort((a,b)=>dist(a.x,a.y,e.x,e.y)-dist(b.x,b.y,e.x,e.y));f.pend={b:balls[0],e,t:1}}}
      if(f.pend){f.pend.t-=TICK;if(f.pend.t<=0){const b=f.pend.b,e=f.pend.e;
        if(b.st===0){const dx=e.x-b.x,dy=e.y-b.y,L=Math.hypot(dx,dy)||1;b.st=1;b.vx=dx/L*480;b.vy=dy/L*480;b.d=0;b.hit={}}f.pend=null}}
      break}
    case 'beacon':{
      if(f.sw>0)f.sw-=TICK;
      f.sign=(Math.floor(t/15)%2)?-1:1;f.warn=(t%15)>=14;
      f.ang+=f.sign*(6.2832/10)*TICK;
      for(const bm of [0,3.14159]){const a=f.ang+bm,ex=f.x+Math.cos(a)*f.len,ey=f.y+Math.sin(a)*f.len;
        for(const e of ents){if(e.bmCd>0)continue;
          const vx=ex-f.x,vy=ey-f.y,wx=e.x-f.x,wy=e.y-f.y,u=clamp((wx*vx+wy*vy)/(vx*vx+vy*vy),0,1),d=dist(e.x,e.y,f.x+vx*u,f.y+vy*u);
          if(d<=f.wid/2+e.r*.3){e.bmCd=1.5;
            if(has(e,['ELECTRIC'])){if(eg.includes(e)){e.gxChgT=20;H.floatTxt(e.x,e.y-80,'⚡ 충전! 다음 전기 기술 강화','#ffe14a')}}
            else if(eb.includes(e)){H.setAil(e,'paralysis',100);e.stun=Math.max(e.stun,48);try{H.cancelCast(e,false)}catch(er){}H.floatTxt(e.x,e.y-80,'빛줄기!','#fff6a0')}}}}
      break}
    case 'rock':{f.life-=TICK;break}
    case 'rockfall':{
      const ph=phase({period:12,warn:1.6,fire:.3,off:4.4},t);f.ph=ph;
      if(ph.p==='warn'&&f.lastW!==ph.n){f.lastW=ph.n;f.marks=eb.map(e=>({x:e.x,y:e.y}))}
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        for(const e of eb){if(!f.marks.some(m=>dist(e.x,e.y,m.x,m.y)<=56+e.r*.3))continue;
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
          for(const e of eb){if(!inside(e)||has(e,['ELECTRIC','GROUND']))continue;hurt(g,e,.04,'#ffe14a');H.setAil(e,'paralysis',30)}}
        for(const e of eb){if(e.gxTk&&inside(e)&&!has(e,['ELECTRIC','GROUND']))hurt(g,e,.03,'#ffe14a')}}
      break}
    case 'heat':
      for(const e of eb){if(has(e,['FIRE','GROUND']))continue;
        if(g.feats.some(q=>q.k==='spring'&&dist(e.x,e.y,q.x,q.y)<=q.r))continue;
        e.heatT=(e.heatT||0)+TICK;if(e.heatT>=2){e.heatT=0;hurt(g,e,.012,'#ff9a50')}}
      break;
    case 'spring':
      for(const e of ents){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3){
        if(!has(e,['FIRE'])&&eb.includes(e))e.gxMul*=.65;
        if(e.gxTk&&eg.includes(e)){const h=Math.min(e.max-e.hp,Math.max(1,Math.round((e.pctMax||e.max)*.006)));
          if(h>0&&e.hp<e.max){e.hp+=h;H.floatTxt(e.x,e.y-80,'+'+H.fmtN(h*H.kOf(e)),'#7dff8a')}}}}
      break;
    case 'drill':{
      const st=Math.floor(t/15)%3;
      if(st!==f.step){f.step=st;H.floatTxt(CX,150,['⚡ 스피드 훈련! 모두 빨라져요','💨 회피 훈련! 구르기가 빨리 차올라요','💪 노말 훈련! 노말 기술이 세져요'][st],'#ffe14a',true)}
      for(const e of eg){if(st===0)e.gxMul*=1.3;else if(st===1)e.gxRc=1.6;else e.gxPow={t:'NORMAL',m:1.2}}
      break}
    case 'gust':{
      const ph=phase(f.cyc,t);f.ph=ph;
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        const dx=f.dx*f.sign;
        for(const e of eb){if(has(e,['FLYING'])||Math.abs(e.y-f.y)>60+e.r*.3)continue;
          g.slides.push({e,dx:dx*140,dy:0,t:.25,tt:.25});H.floatTxt(e.x,e.y-80,'바람!','#bfe8ff')}
        f.sign*=-1;g.fx.push({k:'ring',x:CX,y:f.y,t:0,life:.4,c:'#bfe8ff'})}
      break}
    case 'cloudpad':
      for(const e of eg){if(dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3)e.gxRoll=1.25}
      break;
    case 'mirror':{
      const ph=phase({period:20,warn:2,fire:10,off:0},t);f.ph=ph;f.on=ph.p==='fire';
      if(f.on&&f.lastN!==ph.n){f.lastN=ph.n;H.floatTxt(CX,150,'🌀 트릭룸! 느린 쪽이 빨라져요','#d08cff',true)}
      if(f.on&&W.me&&W.foe&&W.me.spd>0&&W.foe.spd>0&&(!PRO||W.foe.spd>W.me.spd)){
        W.me.gxMul*=clamp(W.foe.spd/W.me.spd,.5,2);W.foe.gxMul*=clamp(W.me.spd/W.foe.spd,.5,2)}
      break}
    case 'crackice':{
      const occ={};
      for(const e of eb){if(has(e,['WATER','ICE','FLYING']))continue;
        const c=Math.floor((e.x-f.x0)/f.cw),r=Math.floor((e.y-f.y0)/f.ch);
        if(c<0||r<0||c>=f.cols||r>=f.rows)continue;const i=r*f.cols+c;occ[i]=1;
        if(f.br[i]>0)e.gxMul*=.6;
        else{f.p[i]+=TICK;if(f.p[i]>=3){f.p[i]=0;f.br[i]=10;g.fx.push({k:'ring',x:f.x0+(c+.5)*f.cw,y:f.y0+(r+.5)*f.ch,t:0,life:.4,c:'#bfe8ff'});H.floatTxt(e.x,e.y-80,'쩍!','#bfe8ff')}}}
      for(let i=0;i<96;i++){if(f.br[i]>0){f.br[i]-=TICK}else if(!occ[i]&&f.p[i]>0)f.p[i]=Math.max(0,f.p[i]-.25*TICK)}
      break}
    case 'tremor':{
      const ph=phase({period:8,warn:1.4,fire:.3,off:.3},t);f.ph=ph;
      if(ph.p==='warn'&&f.lastW!==ph.n){f.lastW=ph.n;f.marks=eb.filter(e=>ground(e)&&!has(e,['GROUND'])).map(e=>({x:e.x,y:e.y}))}
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        for(const e of eb){if(!ground(e)||has(e,['GROUND']))continue;
          if(f.marks.some(m=>dist(e.x,e.y,m.x,m.y)<=72+e.r*.3)){hurt(g,e,.09,'#d2a24a');e.stun=Math.max(e.stun,21);try{H.cancelCast(e,false)}catch(er){}}}
        W.qk=Math.max(W.qk||0,.5);for(const m of f.marks)g.fx.push({k:'boom',x:m.x,y:m.y,w:140,t:0,life:.35});f.marks=[]}
      break}
    // ── 성도 (4/4): 해로운 건 상대(eb)만 ──
    case 'vgust':{
      const ph=phase(f.cyc,t);f.ph=ph;
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        const dy=f.dy*f.sign;
        for(const e of eb){if(has(e,['FLYING'])||Math.abs(e.x-f.x)>f.w/2+e.r*.3)continue;
          g.slides.push({e,dx:0,dy:dy*140,t:.25,tt:.25});H.floatTxt(e.x,e.y-80,'돌풍!','#bfe8ff')}
        f.sign*=-1;g.fx.push({k:'ring',x:f.x,y:CY,t:0,life:.4,c:'#bfe8ff'})}
      break}
    case 'web':
      for(const e of eb){if(!has(e,['BUG'])&&dist(e.x,e.y,f.x,f.y)<=f.r+e.r*.3)e.gxMul*=.6}
      break;
    case 'bumper':{if(f.sw>0)f.sw-=TICK;break}
    case 'sweep':{
      const ph=phase(f.cyc,t);f.ph=ph;
      if(ph.p!=='fire')break;
      const a=f.dir>0?-f.bw/2+ph.u*SW_SPD:f.L+f.bw/2-ph.u*SW_SPD;f.a=a;
      for(const e of eb){
        const along=f.mv==='x'?e.x:e.y,cross=f.mv==='x'?e.y:e.x;
        if(Math.abs(along-a)>f.bw/2+e.r*.3||Math.abs(cross-f.fix)>f.th/2+e.r*.3)continue;
        if(e.swN&&e.swN[f.id]===ph.n)continue;
        const ax=f.mv==='x'?f.dir:0,ay=f.mv==='y'?f.dir:0;
        if(f.eff==='web'){if(has(e,['BUG']))continue;e.slowT=Math.max(e.slowT||0,4);H.floatTxt(e.x,e.y-80,'실에 감겼다!','#e8e8f0')}
        else if(f.eff==='ball'){if(has(e,['NORMAL']))continue;hurt(g,e,.05,'#ffb04a');g.slides.push({e,dx:ax*150,dy:ay*150,t:.25,tt:.25});H.floatTxt(e.x,e.y-100,'쾅!','#ffd29a')}
        else if(f.eff==='wave'){if(has(e,['FIGHTING']))continue;hurt(g,e,.03,'#5ab8ff');g.slides.push({e,dx:ax*220,dy:ay*220,t:.3,tt:.3});H.floatTxt(e.x,e.y-100,'휩쓸렸다!','#bfe8ff')}
        else if(f.eff==='flame'){if(has(e,['DRAGON','FIRE']))continue;hurt(g,e,.07,'#ff7a30');H.setAil(e,'burn',35);H.floatTxt(e.x,e.y-100,'용의 숨결!','#ffb070')}
        e.swN=e.swN||{};e.swN[f.id]=ph.n}
      break}
    case 'wisp':{
      const a=(t/f.per)*6.2832+f.ph*6.2832;let x=CX+330*Math.sin(a),y=CY+210*Math.sin(a*1.5);
      if(f.mir){x=AW-x;y=AH-y}f.x=x;f.y=y;
      for(const e of eb){if(has(e,['FIRE','GHOST']))continue;if(e.wsCd>0){e.wsCd-=TICK;continue}
        if(dist(e.x,e.y,f.x,f.y)<=30+e.r*.5){e.wsCd=3;hurt(g,e,.03,'#c9a0ff');H.setAil(e,'burn',40);
          g.fx.push({k:'ring',x:f.x,y:f.y,t:0,life:.4,c:'#c9a0ff'});H.floatTxt(e.x,e.y-80,'도깨비불!','#c9a0ff')}}
      break}
    case 'magnet':{
      const ph=phase(f.cyc,t);f.ph=ph;
      if(ph.p==='fire')for(const e of eb){if(has(e,['STEEL']))continue;
        const dx=f.x-e.x,dy=f.y-e.y,L=Math.hypot(dx,dy);if(L>420||L<f.r+e.r*.55+6)continue;
        const p=90*TICK;e.x+=dx/L*p;e.y+=dy/L*p}
      break}
    case 'mcur':{
      const ph=phase(f.cyc,t);f.ph=ph;
      if(ph.p==='fire'){
        const inside=e=>Math.abs(e.x-f.x)<=f.w/2+e.r*.3&&e.y>=f.y1-e.r*.3&&e.y<=f.y2+e.r*.3;
        if(f.lastN!==ph.n){f.lastN=ph.n;
          for(const e of eb){if(!inside(e)||has(e,['STEEL','ELECTRIC']))continue;hurt(g,e,.04,'#ffe14a');H.setAil(e,'paralysis',30)}}
        for(const e of eb){if(e.gxTk&&inside(e)&&!has(e,['STEEL','ELECTRIC']))hurt(g,e,.03,'#ffe14a')}}
      break}
    case 'icefloor':{
      for(const e of eb){if(has(e,['ICE']))continue;
        if(e.mpx==null){e.mpx=e.x;e.mpy=e.y;e.ivx=0;e.ivy=0;continue}
        const vx=e.x-e.mpx,vy=e.y-e.mpy;
        if(Math.hypot(vx,vy)>60){e.ivx=vx;e.ivy=vy;continue}   // 순간이동처럼 큰 움직임은 그대로
        e.ivx=(e.ivx||0)+(vx-(e.ivx||0))*.12;e.ivy=(e.ivy||0)+(vy-(e.ivy||0))*.12;   // 방향을 바꾸거나 멈추기가 느려짐(미끄러짐)
        e.x=e.mpx+e.ivx;e.y=e.mpy+e.ivy}
      for(const e of eb){if(has(e,['ICE'])||!e.gxTk)continue;
        e.snT=(e.snT||0)+.5;if(e.snT>=2){e.snT=0;hurt(g,e,.02,'#bfe8ff')}}   // 싸라기눈: 초당 약 1%
      break}
    case 'flamering':{
      const ph=phase({period:9,warn:1.4,fire:.6,off:2},t);f.ph=ph;
      if(ph.p==='fire'&&f.lastN!==ph.n){f.lastN=ph.n;
        for(const e of eb){if(has(e,['DRAGON','FIRE']))continue;const d=dist(e.x,e.y,CX,CY);
          if(d<=190+e.r*.3&&d>=100-e.r*.3){hurt(g,e,.08,'#ff7a30');H.setAil(e,'burn',35)}}
        g.fx.push({k:'boom',x:CX,y:CY,w:380,t:0,life:.35})}
      break}
    }
  }
  // 단단한 것(바위·기둥): 몸 밀어내기 + 발사체 막기
  if(g.feats.some(q=>(q.k==='rock'&&q.life<=0)||q.gone)){g.feats=g.feats.filter(q=>!((q.k==='rock'&&q.life<=0)||q.gone));g.solids=g.solids.filter(q=>!((q.k==='rock'&&q.life<=0)||q.gone))}
  for(const s of g.solids){
    if(s.dead)continue;
    for(const e of ents){if(s.k==='vine'&&has(e,['GRASS']))continue;let dx=e.x-s.x,dy=e.y-s.y,L=Math.hypot(dx,dy);if(L<1e-3){dx=1;dy=0;L=1}const min=s.r+e.r*.55;
      if(s.k==='sandbag'&&L<min+4&&eb.includes(e)&&!has(e,['FIGHTING'])&&!(e.sbCd>0)&&e.rollT<=0){e.sbCd=.6;s.sw=.5;g.slides.push({e,dx:dx/L*150,dy:dy/L*150,t:.2,tt:.2});H.floatTxt(e.x,e.y-70,'퉁!','#ffd29a')}
      if(s.k==='bumper'&&L<min+6&&eb.includes(e)&&!has(e,['NORMAL'])&&!(e.sbCd>0)&&e.rollT<=0){e.sbCd=.5;s.sw=.5;g.slides.push({e,dx:dx/L*200,dy:dy/L*200,t:.2,tt:.2});H.floatTxt(e.x,e.y-70,'뿅!','#ffd29a')}
      if(L<min){e.x=s.x+dx/L*min;e.y=s.y+dy/L*min}
      if(s.k==='vine'&&L<min+8&&eb.includes(e)&&!(e.vnCd>0)){e.vnCd=1.5;hurt(g,e,.06,'#7dd05a');e.stun=Math.max(e.stun,24);try{H.cancelCast(e,false)}catch(er){}H.floatTxt(e.x,e.y-70,'가시!','#7dd05a')}}
    if(s.tall)for(const p of W.proj){if(p.dead||p.wait>0)continue;
      if(dist(p.x,p.y,s.x,s.y)<=s.r+p.r*.6){p.dead=1;
        g.fx.push({k:'ring',x:p.x,y:p.y,t:0,life:.2,c:'#fff'});
        if(s.k==='boulder'){s.hp--;s.flash=.15;if(s.hp<=0){s.dead=1;s.rt=s.respawn;g.fx.push({k:'boom',x:s.x,y:s.y,w:s.r*3,t:0,life:.35})}}
        else if(s.k==='orevein'){s.flash=.15;s.dead=1;s.rt=20;g.fx.push({k:'boom',x:s.x,y:s.y,w:s.r*3,t:0,life:.35});
          const dx=CX-s.x,dy=CY-s.y,L=Math.hypot(dx,dy)||1;g.feats.push({k:'ore',x:s.x+dx/L*46,y:s.y+dy/L*46,r:22})}
        else if(s.k==='vine'){let fire=false;try{fire=p.o.moves[p.mi].type==='FIRE'}catch(er){}
          if(fire){s.gone=1;g.fx.push({k:'boom',x:s.x,y:s.y,w:s.r*3,t:0,life:.35});H.floatTxt(s.x,s.y-40,'불타요!','#ff9a50')}
          else{s.hp--;s.flash=.15;if(s.hp<=0){s.gone=1;g.fx.push({k:'boom',x:s.x,y:s.y,w:s.r*3,t:0,life:.35})}}}
        else if(s.k==='breaker'&&g.powerOff<=0){g.powerOff=12;s.flash=.4;H.floatTxt(s.x,s.y-50,'전기 꺼짐! 12초','#ffe14a',true)}}}}
  for(const s of g.slides){const k=Math.min(s.t,TICK)/s.tt;s.e.x+=s.dx*k;s.e.y+=s.dy*k;s.t-=TICK}
  g.slides=g.slides.filter(s=>s.t>0&&s.e.hp>0);
  for(const f of g.fx)f.t+=TICK;g.fx=g.fx.filter(f=>f.t<f.life);
  // 경기장 밖으로 안 나가게 다시 한 번
  for(const e of [W.me,W.foe]){e.x=clamp(e.x,18+e.r*.5,AW-18-e.r*.5);e.y=clamp(e.y,18+e.r*.5,AH-18-e.r*.5)}
  if(g.feats.some(q=>q.k==='icefloor'))for(const e of [W.me,W.foe]){e.mpx=e.x;e.mpy=e.y}   // 미끄러운 바닥: 이번 틱 끝 자리 기억
}

// 성도: 상자(cianwood)·얼음 기둥(mahogany) 그림 — 부서진 정도(hp)에 따라 금이 가요
function drawBlock(cx,f){
  cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.7,f.r*.95,f.r*.4,0,0,7);cx.fill();
  const dmg=1-f.hp/f.maxhp,r=f.r;
  if(f.crate){
    cx.fillStyle=dmg>0?'#a8783c':'#c08a48';cx.strokeStyle='#4a2c10';cx.lineWidth=4;
    cx.fillRect(f.x-r,f.y-r*.9,r*2,r*1.7);cx.strokeRect(f.x-r,f.y-r*.9,r*2,r*1.7);
    cx.lineWidth=3;cx.beginPath();cx.moveTo(f.x-r,f.y-r*.9);cx.lineTo(f.x+r,f.y+r*.8);cx.moveTo(f.x+r,f.y-r*.9);cx.lineTo(f.x-r,f.y+r*.8);
    cx.moveTo(f.x,f.y-r*.9);cx.lineTo(f.x,f.y+r*.8);cx.stroke();
  }else{
    cx.fillStyle=dmg>0?'#9ccfe8':'#bfe8ff';cx.strokeStyle='#4a7a98';cx.lineWidth=4;
    cx.beginPath();cx.moveTo(f.x-r*.8,f.y+r*.6);cx.lineTo(f.x-r*.5,f.y-r*.5);cx.lineTo(f.x-r*.1,f.y-r*1.15);cx.lineTo(f.x+r*.45,f.y-r*.6);cx.lineTo(f.x+r*.85,f.y+r*.6);cx.closePath();cx.fill();cx.stroke();
    cx.strokeStyle='rgba(255,255,255,.8)';cx.lineWidth=3;cx.beginPath();cx.moveTo(f.x-r*.25,f.y-r*.7);cx.lineTo(f.x-r*.2,f.y+r*.2);cx.stroke();
    if(dmg>0){cx.strokeStyle='#2a5a78';cx.lineWidth=3;cx.beginPath();cx.moveTo(f.x+r*.1,f.y-r*.9);cx.lineTo(f.x+r*.3,f.y-r*.1);cx.lineTo(f.x+r*.05,f.y+r*.4);cx.stroke()}
  }
  if(f.flash>0){cx.globalAlpha=.5;cx.fillStyle='#fff';cx.fillRect(f.x-r,f.y-r,r*2,r*1.8)}
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
    case 'rockfall2':{const ph=f.ph;
      if(ph&&ph.p==='warn')for(const m of f.marks){cx.globalAlpha=.3+.3*Math.sin(t*26);cx.fillStyle='#8a6a40';cx.beginPath();cx.arc(m.x,m.y,100,0,7);cx.fill();cx.globalAlpha=.9;cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([10,8]);cx.stroke();cx.setLineDash([]);cx.font='26px sans-serif';cx.textAlign='center';cx.fillText('🪨',m.x,m.y+9)}
      break}
    case 'orevein':{if(f.dead)break;cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.7,f.r*.95,f.r*.4,0,0,7);cx.fill();
      cx.fillStyle='#7a6a5a';cx.strokeStyle='#3a2a1a';cx.lineWidth=4;cx.beginPath();cx.moveTo(f.x-f.r,f.y+f.r*.5);cx.lineTo(f.x-f.r*.6,f.y-f.r*.7);cx.lineTo(f.x+f.r*.1,f.y-f.r);cx.lineTo(f.x+f.r*.9,f.y-f.r*.3);cx.lineTo(f.x+f.r,f.y+f.r*.5);cx.closePath();cx.fill();cx.stroke();
      cx.fillStyle='#ffd27a';for(const [a,b] of [[-.3,-.2],[.3,.1],[0,.35]]){cx.beginPath();cx.moveTo(f.x+a*f.r,f.y+b*f.r-8);cx.lineTo(f.x+a*f.r+6,f.y+b*f.r);cx.lineTo(f.x+a*f.r,f.y+b*f.r+8);cx.lineTo(f.x+a*f.r-6,f.y+b*f.r);cx.closePath();cx.fill()}
      if(f.flash>0){cx.globalAlpha=.5;cx.fillStyle='#fff';cx.fillRect(f.x-f.r,f.y-f.r,f.r*2,f.r*2)}break}
    case 'ore':{cx.globalAlpha=1;const gr=cx.createRadialGradient(f.x,f.y,2,f.x,f.y,f.r+10);gr.addColorStop(0,'rgba(255,230,140,.9)');gr.addColorStop(1,'rgba(255,200,90,0)');cx.fillStyle=gr;cx.beginPath();cx.arc(f.x,f.y,f.r+10,0,7);cx.fill();
      cx.fillStyle='#ffd27a';cx.strokeStyle='#8a5a1a';cx.lineWidth=3;cx.beginPath();cx.moveTo(f.x,f.y-f.r*.8);cx.lineTo(f.x+f.r*.6,f.y);cx.lineTo(f.x,f.y+f.r*.8);cx.lineTo(f.x-f.r*.6,f.y);cx.closePath();cx.fill();cx.stroke();break}
    case 'vinemgr':{for(const p of f.pend){cx.globalAlpha=.5+.4*Math.sin(t*20);cx.strokeStyle='#7dff8a';cx.lineWidth=4;cx.setLineDash([8,6]);cx.beginPath();cx.arc(p.x,p.y,26,0,7);cx.stroke();cx.setLineDash([])}break}
    case 'vine':{cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.7,f.r*1.05,f.r*.4,0,0,7);cx.fill();
      cx.fillStyle=f.hp<=1?'#5a8a3a':'#3f9a3a';cx.strokeStyle='#1a3a14';cx.lineWidth=3;cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();cx.stroke();
      cx.strokeStyle='#bfffa0';cx.lineWidth=3;for(let i=0;i<6;i++){const a=i*1.047+.3;cx.beginPath();cx.moveTo(f.x+Math.cos(a)*f.r*.5,f.y+Math.sin(a)*f.r*.5);cx.lineTo(f.x+Math.cos(a)*(f.r+8),f.y+Math.sin(a)*(f.r+8));cx.stroke()}
      if(f.flash>0){cx.globalAlpha=.5;cx.fillStyle='#fff';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill()}break}
    case 'spot':{cx.globalAlpha=.35;const gr=cx.createRadialGradient(f.x,f.y,10,f.x,f.y,125);gr.addColorStop(0,'rgba(255,240,200,.9)');gr.addColorStop(1,'rgba(255,240,200,0)');cx.fillStyle=gr;cx.beginPath();cx.arc(f.x,f.y,125,0,7);cx.fill();
      cx.globalAlpha=.6;cx.strokeStyle='#fff3c0';cx.lineWidth=3;cx.setLineDash([10,8]);cx.beginPath();cx.arc(f.x,f.y,120,0,7);cx.stroke();cx.setLineDash([]);break}
    case 'ring':{const L=f.cL!=null?f.cL:f.L,R=f.cR!=null?f.cR:f.R,T=f.cT!=null?f.cT:f.T,B=f.cB!=null?f.cB:f.B;
      cx.globalAlpha=.38;cx.fillStyle='#000';cx.beginPath();cx.rect(0,0,AW,AH);cx.rect(L,T,R-L,B-T);cx.fill('evenodd');
      cx.globalAlpha=1;cx.lineWidth=7;cx.strokeStyle=f.warn?(Math.sin(t*30)>0?'#ff4040':'#fff'):'#e8e8e8';cx.beginPath();cx.moveTo(L,T);cx.lineTo(R,T);cx.lineTo(R,B);cx.lineTo(L,B);cx.closePath();cx.stroke();
      cx.lineWidth=3;cx.strokeStyle='#d83a3a';cx.beginPath();cx.moveTo(L+6,T+6);cx.lineTo(R-6,T+6);cx.lineTo(R-6,B-6);cx.lineTo(L+6,B-6);cx.closePath();cx.stroke();
      cx.fillStyle='#444';for(const [x,y] of [[L,T],[R,T],[R,B],[L,B]]){cx.beginPath();cx.arc(x,y,12,0,7);cx.fill()}break}
    case 'tide':{const a=f.lvl===0?0:f.lvl===1?.2:.38;
      if(a>0){cx.globalAlpha=a;cx.fillStyle='#3a8ee0';cx.fillRect(0,0,AW,AH);cx.globalAlpha=a+.15;cx.strokeStyle='#bfe8ff';cx.lineWidth=3;for(let i=0;i<8;i++){const y=60+i*95+Math.sin(t*2+i)*6;cx.beginPath();for(let k=0;k<=12;k++){const x=k*100,yy=y+Math.sin(t*3+k+i)*5;k?cx.lineTo(x,yy):cx.moveTo(x,yy)}cx.stroke()}}
      if(f.warn){cx.globalAlpha=.25+.2*Math.sin(t*24);cx.fillStyle='#7ad0ff';cx.fillRect(0,0,AW,AH)}
      cx.globalAlpha=.95;cx.font='bold 18px sans-serif';cx.textAlign='center';cx.fillStyle='#e8f6ff';cx.fillText('💧'.repeat(f.lvl)+(f.lvl===0?'물 없음':''),CX,34);break}
    case 'tsw':{const td=g.feats.find(q=>q.k==='tide'),deep=td&&td.lvl>=2;
      cx.globalAlpha=deep?.9:.5;cx.fillStyle=deep?'#ffe14a':'#9aa';cx.strokeStyle='#2a3a4a';cx.lineWidth=4;cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();cx.stroke();
      cx.globalAlpha=1;cx.font='900 20px sans-serif';cx.textAlign='center';cx.fillStyle='#2a3a4a';cx.fillText('⏏',f.x,f.y+7);break}
    case 'lift':{const x=f.x-f.w/2,y=f.y-f.h/2;
      if(f.up){cx.globalAlpha=1;cx.fillStyle='#8a98a8';cx.strokeStyle='#2a3a4a';cx.lineWidth=6;cx.fillRect(x,y,f.w,f.h);cx.strokeRect(x,y,f.w,f.h);cx.strokeStyle='#c8d4e0';cx.lineWidth=3;cx.strokeRect(x+10,y+10,f.w-20,f.h-20);cx.font='900 36px sans-serif';cx.textAlign='center';cx.fillStyle='#2a3a4a';cx.fillText('⚙',f.x,f.y+12)}
      else{cx.globalAlpha=f.warn?.35+.3*Math.sin(t*26):.18;cx.fillStyle=f.warn?'#ff6a4a':'#8a98a8';cx.fillRect(x,y,f.w,f.h);cx.globalAlpha=.7;cx.strokeStyle=f.warn?'#ff4040':'#c8d4e0';cx.lineWidth=4;cx.setLineDash([12,8]);cx.strokeRect(x,y,f.w,f.h);cx.setLineDash([])}break}
    case 'snowb':{if(f.st===2)break;cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.25)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.7,f.r*.95,f.r*.4,0,0,7);cx.fill();
      cx.fillStyle='#f2f8ff';cx.strokeStyle='#8aa8c8';cx.lineWidth=3;cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();cx.stroke();
      cx.strokeStyle='#cfe0f0';cx.lineWidth=2;cx.beginPath();cx.arc(f.x-f.r*.2,f.y-f.r*.1,f.r*.55,.4,4.2);cx.stroke();break}
    case 'snowmgr':{if(f.pend&&f.pend.b){const b=f.pend.b;cx.globalAlpha=.5+.4*Math.sin(t*24);cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([8,6]);cx.beginPath();cx.arc(b.x,b.y,b.r+8,0,7);cx.stroke();cx.setLineDash([])}break}
    case 'beacon':{cx.globalAlpha=1;
      for(const bm of [0,3.14159]){const a=f.ang+bm,ex=f.x+Math.cos(a)*f.len,ey=f.y+Math.sin(a)*f.len;
        cx.globalAlpha=f.warn?.25+.2*Math.sin(t*26):.42;cx.strokeStyle='#fff6a0';cx.lineWidth=f.wid;cx.lineCap='round';cx.beginPath();cx.moveTo(f.x,f.y);cx.lineTo(ex,ey);cx.stroke();
        cx.globalAlpha=.85;cx.strokeStyle='#fffbe0';cx.lineWidth=f.wid*.4;cx.beginPath();cx.moveTo(f.x,f.y);cx.lineTo(ex,ey);cx.stroke()}
      cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.7,f.r*1.1,f.r*.45,0,0,7);cx.fill();
      cx.fillStyle='#e8e0d0';cx.strokeStyle='#4a4030';cx.lineWidth=4;cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();cx.stroke();
      cx.fillStyle='#d83a3a';cx.beginPath();cx.arc(f.x,f.y,f.r*.5,0,7);cx.fill();cx.font='900 20px sans-serif';cx.textAlign='center';cx.fillStyle='#fff';cx.fillText('💡',f.x,f.y+7);break}
    case 'boulder':case 'rock':{if(f.dead)break;if(f.crate||f.ice){drawBlock(cx,f);break}if(f.k==='rock'&&f.life<2)cx.globalAlpha=.5+.4*Math.sin(t*20);cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.7,f.r*.95,f.r*.4,0,0,7);cx.fill();
      const dmg=1-f.hp/f.maxhp;cx.fillStyle=dmg>.5?'#8a7a68':'#a08a70';cx.strokeStyle='#4a3a2a';cx.lineWidth=4;cx.beginPath();cx.moveTo(f.x-f.r,f.y+f.r*.5);cx.lineTo(f.x-f.r*.7,f.y-f.r*.6);cx.lineTo(f.x,f.y-f.r);cx.lineTo(f.x+f.r*.8,f.y-f.r*.5);cx.lineTo(f.x+f.r,f.y+f.r*.5);cx.closePath();cx.fill();cx.stroke();
      if(dmg>0){cx.strokeStyle='#2a1a0a';cx.lineWidth=3;cx.beginPath();cx.moveTo(f.x-f.r*.2,f.y-f.r*.8);cx.lineTo(f.x+f.r*.1,f.y-f.r*.1);cx.lineTo(f.x-f.r*.2,f.y+f.r*.3);cx.stroke()}
      if(f.flash>0){cx.globalAlpha=.5;cx.fillStyle='#fff';cx.fill()}break}
    case 'breaker':{cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+14,f.r*.9,f.r*.4,0,0,7);cx.fill();
      cx.fillStyle=g.powerOff>0?'#555':'#e8c020';cx.strokeStyle='#2a2000';cx.lineWidth=4;cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();cx.stroke();
      cx.font='900 22px sans-serif';cx.textAlign='center';cx.fillStyle='#2a2000';cx.fillText(g.powerOff>0?Math.ceil(g.powerOff):'⚡',f.x,f.y+8);break}
    // ── 성도 (4/4) ──
    case 'vgust':{const ph=f.ph||{p:'idle'},dy=f.dy*f.sign,x0=f.x-f.w/2;
      if(ph.p==='warn'||ph.p==='fire'){cx.globalAlpha=ph.p==='fire'?.5:.2+.15*Math.sin(t*26);cx.fillStyle='#bfe8ff';cx.fillRect(x0,40,f.w,AH-80)}
      cx.font='900 30px sans-serif';cx.textAlign='center';cx.fillStyle='#e8f6ff';
      for(let i=0;i<5;i++){const y=((i*180+t*(dy>0?60:-60))%700+700)%700+50;cx.globalAlpha=.25+(ph.p!=='idle'?.35:0);cx.fillText(dy>0?'⬇':'⬆',f.x,y)}
      break}
    case 'web':{cx.globalAlpha=.3;cx.fillStyle='#e8e8f0';cx.beginPath();cx.arc(f.x,f.y,f.r,0,7);cx.fill();
      cx.globalAlpha=.75;cx.strokeStyle='#f4f4fa';cx.lineWidth=2;
      for(let i=0;i<8;i++){const a=i*Math.PI/4;cx.beginPath();cx.moveTo(f.x,f.y);cx.lineTo(f.x+Math.cos(a)*f.r,f.y+Math.sin(a)*f.r);cx.stroke()}
      for(const q of [.35,.65,1]){cx.beginPath();cx.arc(f.x,f.y,f.r*q,0,7);cx.stroke()}break}
    case 'bumper':{cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.28)';cx.beginPath();cx.ellipse(f.x,f.y+f.r*.6,f.r*.95,f.r*.4,0,0,7);cx.fill();
      const sc=1+(f.sw>0?.18*Math.sin(f.sw/.5*9.4):0);cx.fillStyle='#ff7a9a';cx.strokeStyle='#8a2a4a';cx.lineWidth=4;
      cx.beginPath();cx.arc(f.x,f.y,f.r*sc,0,7);cx.fill();cx.stroke();
      cx.fillStyle='#ffd0dc';cx.beginPath();cx.arc(f.x,f.y,f.r*.55*sc,0,7);cx.fill();
      cx.font='900 20px sans-serif';cx.textAlign='center';cx.fillStyle='#8a2a4a';cx.fillText('★',f.x,f.y+7);break}
    case 'sweep':{const ph=f.ph||{p:'idle'};if(ph.p==='idle')break;
      const col={web:'#f0f0f8',ball:'#ffb04a',wave:'#5ab8ff',flame:'#ff6a20'}[f.eff]||'#fff';
      const lane=f.mv==='x'?[40,f.fix-f.th/2,AW-80,f.th]:[f.fix-f.th/2,40,f.th,AH-80];
      if(ph.p==='warn'){cx.globalAlpha=.18+.15*Math.sin(t*26);cx.fillStyle=col;cx.fillRect(lane[0],lane[1],lane[2],lane[3]);
        cx.globalAlpha=.9;cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([10,8]);cx.strokeRect(lane[0],lane[1],lane[2],lane[3]);cx.setLineDash([]);break}
      const a=f.a==null?-999:f.a,bx=f.mv==='x'?a:f.fix,by=f.mv==='x'?f.fix:a;
      cx.globalAlpha=.85;
      if(f.eff==='ball'){cx.fillStyle='#ffb04a';cx.strokeStyle='#7a4010';cx.lineWidth=5;cx.beginPath();cx.arc(bx,by,f.th*.42,0,7);cx.fill();cx.stroke();
        cx.strokeStyle='#fff3d0';cx.lineWidth=4;cx.beginPath();cx.arc(bx,by,f.th*.42,t*8,t*8+2.2);cx.stroke()}
      else if(f.eff==='wave'){const gr=cx.createLinearGradient(bx-f.bw/2,0,bx+f.bw/2,0);gr.addColorStop(0,'rgba(90,184,255,.2)');gr.addColorStop(.7,'rgba(90,184,255,.85)');gr.addColorStop(1,'rgba(240,250,255,.95)');
        cx.save();if(f.dir<0){cx.translate(bx*2,0);cx.scale(-1,1)}cx.fillStyle=gr;cx.fillRect(bx-f.bw/2,18,f.bw,AH-36);cx.restore()}
      else if(f.eff==='web'){cx.fillStyle='rgba(244,244,250,.55)';cx.strokeStyle='#fff';cx.lineWidth=3;
        const w=f.mv==='x'?f.bw:f.th,h=f.mv==='x'?f.th:f.bw;cx.fillRect(bx-w/2,by-h/2,w,h);cx.strokeRect(bx-w/2,by-h/2,w,h);
        cx.beginPath();cx.moveTo(bx-w/2,by-h/2);cx.lineTo(bx+w/2,by+h/2);cx.moveTo(bx+w/2,by-h/2);cx.lineTo(bx-w/2,by+h/2);cx.stroke()}
      else{for(let i=0;i<3;i++){const r=f.th*(.42-i*.1)*(1+.1*Math.sin(t*30+i));cx.fillStyle=['#ff4a10','#ff9a30','#ffe070'][i];cx.beginPath();cx.arc(bx+(f.mv==='x'?-f.dir*i*10:0),by+(f.mv==='y'?-f.dir*i*10:0),r,0,7);cx.fill()}}
      break}
    case 'wisp':{if(f.x<-100)break;cx.globalAlpha=.9;const gr=cx.createRadialGradient(f.x,f.y,2,f.x,f.y,40);gr.addColorStop(0,'rgba(230,200,255,1)');gr.addColorStop(.5,'rgba(160,100,255,.6)');gr.addColorStop(1,'rgba(120,60,220,0)');
      cx.fillStyle=gr;cx.beginPath();cx.arc(f.x,f.y,40,0,7);cx.fill();cx.fillStyle='#f0e0ff';cx.beginPath();cx.ellipse(f.x,f.y+2,10,14+2*Math.sin(t*12),0,0,7);cx.fill();break}
    case 'magnet':{const ph=f.ph||{p:'idle'};cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.3)';cx.beginPath();cx.ellipse(f.x,f.y+8,f.r,f.r*.4,0,0,7);cx.fill();
      if(ph.p==='fire'){cx.strokeStyle='#8ac8ff';cx.lineWidth=3;for(let i=0;i<3;i++){const u=1-((t*1.2+i/3)%1);cx.globalAlpha=.6*(1-u);cx.beginPath();cx.arc(f.x,f.y,40+u*380,0,7);cx.stroke()}}
      else if(ph.p==='warn'){cx.globalAlpha=.3+.3*Math.sin(t*28);cx.fillStyle='#8ac8ff';cx.beginPath();cx.arc(f.x,f.y,f.r+16,0,7);cx.fill()}
      cx.globalAlpha=1;cx.fillStyle='#6a7a98';cx.strokeStyle='#2a3248';cx.lineWidth=4;cx.fillRect(f.x-12,f.y-70,24,76);cx.strokeRect(f.x-12,f.y-70,24,76);
      cx.fillStyle='#ff5a5a';cx.fillRect(f.x-22,f.y-92,16,26);cx.fillStyle='#5a8aff';cx.fillRect(f.x+6,f.y-92,16,26);cx.strokeRect(f.x-22,f.y-92,44,26);break}
    case 'mcur':{const ph=f.ph||{p:'idle'};if(ph.p==='idle')break;const x=f.x-f.w/2,y=f.y1,h=f.y2-f.y1;
      if(ph.p==='warn'){cx.globalAlpha=.25+.3*Math.sin(t*28);cx.fillStyle='#ffe14a';cx.fillRect(x,y,f.w,h);cx.globalAlpha=.9;cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([10,8]);cx.strokeRect(x,y,f.w,h);cx.setLineDash([])}
      else{cx.globalAlpha=.8;cx.fillStyle='#fff6a0';cx.fillRect(x+10,y,f.w-20,h);cx.globalAlpha=.95;cx.strokeStyle='#ffe14a';cx.lineWidth=5;cx.beginPath();
        for(let i=0;i<=10;i++){const yy=y+h*i/10,xx=f.x+(i%2?10:-10)*Math.sin(t*40+i);i?cx.lineTo(xx,yy):cx.moveTo(xx,yy)}cx.stroke()}
      break}
    case 'icefloor':{cx.globalAlpha=.16;cx.fillStyle='#bfe8ff';cx.fillRect(0,0,AW,AH);
      cx.globalAlpha=.55;cx.fillStyle='#fff';for(let i=0;i<46;i++){const x=((i*131+t*(20+i%5*6))%AW+AW)%AW,y=((i*89+t*(40+i%4*12))%AH+AH)%AH;cx.beginPath();cx.arc(x,y,2+i%3,0,7);cx.fill()}
      break}
    case 'flamering':{const ph=f.ph||{p:'idle'};if(ph.p==='idle')break;
      if(ph.p==='warn'){cx.globalAlpha=.25+.3*Math.sin(t*28);cx.strokeStyle='#ff6a20';cx.lineWidth=90;cx.beginPath();cx.arc(CX,CY,145,0,7);cx.stroke();
        cx.globalAlpha=.9;cx.strokeStyle='#ff4040';cx.lineWidth=4;cx.setLineDash([10,8]);for(const r of [100,190]){cx.beginPath();cx.arc(CX,CY,r,0,7);cx.stroke()}cx.setLineDash([])}
      else{cx.globalAlpha=.85;cx.lineWidth=90;cx.strokeStyle='#ff7a20';cx.beginPath();cx.arc(CX,CY,145,0,7);cx.stroke();cx.lineWidth=46;cx.strokeStyle='#ffd060';cx.beginPath();cx.arc(CX,CY,145,0,7);cx.stroke()}
      break}
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
  const spots=g.feats.filter(f=>f.k==='spot');
  if(!spots.length&&!g.feats.some(f=>f.k==='dark'))return;
  if(!_dk){_dk=document.createElement('canvas');_dk.width=600;_dk.height=380}
  const c=_dk.getContext('2d');c.globalCompositeOperation='source-over';c.clearRect(0,0,600,380);
  c.fillStyle=spots.length?'rgba(10,4,26,.6)':'rgba(4,6,26,.64)';c.fillRect(0,0,600,380);c.globalCompositeOperation='destination-out';
  const hole=(x,y,r)=>{const gr=c.createRadialGradient(x/2,y/2,r*.45/2,x/2,y/2,r/2);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.beginPath();c.arc(x/2,y/2,r/2,0,7);c.fill()};
  const me=W.me,foe=W.foe,lit=[];
  if(me)hole(me.x,me.y-20,spots.length?110:180);
  for(const f of spots)hole(f.x,f.y,250);
  for(const f of g.feats)if(f.k==='lamp'){hole(f.x,f.y-30,170);lit.push(f)}
  for(const f of g.feats)if(f.k==='wisp'&&f.x>-100)hole(f.x,f.y,120)   // 도깨비불 둘레도 밝게
  cx.save();cx.globalAlpha=1;cx.drawImage(_dk,0,0,AW,AH);
  // 불빛 밖의 상대는 흐릿하게
  if(foe&&foe.hp>0&&me){const seen=dist(foe.x,foe.y,me.x,me.y)<=180||lit.some(f=>dist(foe.x,foe.y,f.x,f.y)<=170);
    if(!seen){cx.fillStyle='rgba(4,6,26,.5)';cx.beginPath();cx.ellipse(foe.x,foe.y-40,(foe.r||40)*1.7,(foe.r||40)*2.2,0,0,7);cx.fill()}}
  cx.restore()}

// 근접 기술이 맞은 뒤 (veilstone 링: 때리면 상대가 200px 날아감)
function melee(g,att,def){
  if(!g||!g.feats.some(f=>f.k==='ring')||!att||!def||def.hp<=0)return;
  if(g.pro&&g.W&&att!==g.W.me)return;   // 유저 편들기: 링에서 날려 보내기는 내가 때릴 때만
  const dx=def.x-att.x,dy=def.y-att.y,L=Math.hypot(dx,dy)||1;
  g.slides.push({e:def,dx:dx/L*200,dy:dy/L*200,t:.25,tt:.25});
  g.fx.push({k:'ring',x:def.x,y:def.y,t:0,life:.3,c:'#ffd0a0'})}

window.GYMFX={make,tick,draw,over,melee,key,info,bg,DEF};
})();
