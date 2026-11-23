// 서바이버 던전 (서바이버 플레이 · 골드 · 영혼) — 컨텐츠 목록 카드 'sv'. 값: G.svd = {k:날짜, n:{play,gold,soul 오늘 들어간 횟수}, best:{...}, c:오늘 번 코인, xp:오늘 받은 경험치, fc:오늘 첫 클리어, buy:{오늘 산 것}} · G.svc = 서바이버 코인 · G.svClr = 난이도 첫 클리어 기록
(function(){try{
const DG={
 play:{n:'서바이버 플레이',e:'🗡',c:'#4cc9f0',d:'경험치 구슬을 모아요. 횟수 제한 없이 마음껏! 경험치와 🪙서바이버 코인을 줘요.'},
 gold:{n:'골드 던전',e:'💰',c:'#ffd60a',d:'금화를 모아요. 골드를 제일 많이 줘요 (경험치 · 영혼도 조금).'},
 soul:{n:'영혼 던전',e:'👻',c:'#b388ff',d:'영혼 불꽃을 모아요. 영혼을 제일 많이 줘요 (경험치 · 골드도 조금).'}};
const DAILY=3,DUR=90,$=id=>document.getElementById(id);
// 서바이버 코인 · 경험치 한도 (숫자만 바꾸면 돼요)
const COIN_DAY=400,COIN_FC_DAY=20,COIN_FC_TIER=[40,25],XP_RUN_LV=3,XP_DAY_RUNS=10,PERF_KILLS=150;
// 코인 상점: [아이템, 코인, 하루 구매 한도(0=없음), 천계 이상만(1)]
const SHOP=[['cube',20,0,0],['cube2',80,0,0],['cube4',80,0,1],['candy',12,0,0],['cube6',600,2,0],['cube7',600,2,1]];
const rnd=(a,b)=>a+Math.random()*(b-a);
function sv(){G.svd=G.svd||{};if(G.svd.k!==dayKey())G.svd={k:dayKey(),n:{play:0,gold:0,soul:0},best:G.svd.best||{}};const s=G.svd;s.n=s.n||{play:0,gold:0,soul:0};s.c=s.c|0;s.xp=s.xp|0;s.fc=s.fc|0;s.buy=s.buy||{};return s}
const pool=()=>Object.keys(META).filter(k=>META[k].dex<=386&&META[k].stats);
const lead=()=>G.party.find(m=>m.hp>0)||G.party[0];
const avgLv=()=>Math.max(1,Math.round(G.party.reduce((a,m)=>a+m.lv,0)/Math.max(1,G.party.length)));
const IMG={};function img(n){if(!IMG[n]){const i=new Image();i.src=faceUrl(n);i.onerror=()=>{i._bad=1};IMG[n]=i}return IMG[n]}

function open(){
 const s=sv();
 const rows=Object.keys(DG).map(k=>{const d=DG[k],lim=k!=='play',left=DAILY-s.n[k],b=s.best[k]||0;
  return `<div class="row"><span>${d.e} <b>${d.n}</b><br><small>${d.d}<br>${lim?'오늘 남은 횟수 '+left+'/'+DAILY:'횟수 제한 없음'} · 최고 ${b}마리</small></span><button data-k="${k}" ${lim&&left<=0?'disabled':''}>들어가기</button></div>`}).join('');
 const coinRow='<div class="row"><span>🪙 <b>서바이버 코인 '+(G.svc|0)+'</b><br><small>서바이버 플레이를 끝까지 하면 받아요 · 오늘 번 코인 '+s.c+'/'+COIN_DAY+'</small></span><button id="svShop">코인 상점</button></div>';
 openPanel('🗡 서바이버 던전','<div style="padding:6px;font-size:14px">'+DUR+'초 동안 살아남아요! 손가락(또는 방향키·WASD)으로 움직이면 공격은 자동이에요. 맨 앞 포켓몬이 싸워요.</div>'+coinRow+rows);
 const p=document.querySelector('.panel');if(!p)return;
 p.querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>pickTier(b.dataset.k));
 const sb=p.querySelector('#svShop');if(sb)sb.onclick=shop;
}

function shop(){
 const s=sv(),art=!!(window.artOn&&window.artOn());
 const rows=SHOP.filter(x=>ITEMS[x[0]]&&(!x[3]||art)).map(([id,pr,lim])=>{const left=lim?lim-(s.buy[id]|0):99,it=ITEMS[id];
  return `<div class="row"><span>${it.e} <b>${it.n}</b><br><small>🪙 ${pr}${lim?' · 오늘 남은 '+left+'/'+lim:''} · 가진 것 ${G.bag[id]||0}</small></span><button data-b="${id}" ${(G.svc|0)<pr||left<=0?'disabled':''}>사기</button></div>`}).join('');
 openPanel('🪙 코인 상점 · 가진 코인 '+(G.svc|0),'<div style="padding:6px;font-size:14px">서바이버 플레이로 번 코인으로 바꿔요. 앱솔루트 · 어메이징 큐브는 하루 2개까지예요.</div>'+rows+'<div class="row"><button id="svBack">← 던전 목록</button></div>');
 const p=document.querySelector('.panel');if(!p)return;
 p.querySelectorAll('button[data-b]').forEach(b=>b.onclick=()=>{const id=b.dataset.b,x=SHOP.find(y=>y[0]===id);if(!x)return;const s2=sv(),lim=x[2];
  if((G.svc|0)<x[1]){toast('코인이 모자라요');return}if(lim&&(s2.buy[id]|0)>=lim){toast('오늘은 더 못 사요');return}
  G.svc=(G.svc|0)-x[1];addItem(id,1);if(lim)s2.buy[id]=(s2.buy[id]|0)+1;save();try{sfx('get')}catch(e){}toast(ITEMS[id].n+' 1개를 샀어요!');shop()});
 const bk=p.querySelector('#svBack');if(bk)bk.onclick=open;
}
const TN=()=>typeof DNAME!=='undefined'?DNAME:['쉬움','보통','어려움','지옥','나이트메어','종말','천계','천상계','하계','명계'];
const mulT=t=>typeof DMONEY!=='undefined'?DMONEY[t]:1;
function pickTier(k){
 const mx=Math.min(9,DIFF()),D=DG[k];
 if(mx<=0){closePanel(1);start(k,0);return}
 const rows=TN().slice(0,mx+1).map((n,t)=>`<div class="row"><span><b>${n}</b><br><small>적 체력 ×${(1+t*.9).toFixed(1)} · 보상 ×${mulT(t)}</small></span><button data-t="${t}">들어가기</button></div>`).join('');
 openPanel(D.e+' '+D.n+' · 난이도 고르기','<div style="padding:6px;font-size:14px">지금 게임 난이도('+TN()[DIFF()]+')까지 고를 수 있어요. 어려울수록 보상이 커져요.</div>'+rows);
 const p=document.querySelector('.panel');if(!p)return;
 p.querySelectorAll('button[data-t]').forEach(b=>b.onclick=()=>{closePanel(1);start(k,+b.dataset.t)});
}
function start(k,tier){tier=tier|0;
 const s=sv();if((k!=='play'&&s.n[k]>=DAILY)||!G.party.length)return;if(k!=='play')s.n[k]++;save();
 const m=lead(),M=META[m.n];let S=[100,50];try{S=stOf(m)}catch(e){}
 const D=DG[k],pl=pool();
 const ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;z-index:99999;background:#000;touch-action:none';
 const cv=document.createElement('canvas');ov.appendChild(cv);
 const ex=document.createElement('button');ex.textContent='✕ 나가기';ex.style.cssText='position:absolute;right:8px;top:8px;z-index:2;padding:8px 12px';ov.appendChild(ex);
 document.body.appendChild(ov);const c=cv.getContext('2d');
 const fit=()=>{cv.width=innerWidth;cv.height=innerHeight};fit();addEventListener('resize',fit);
 const dm=1+(S[1]||50)/80,df=1+tier*.9,dd=1+tier*.5;
 const H={x:0,y:0,hp:100+Math.min(300,(S[0]||100)/4),mx:0,sp:150,dmg:10*dm,cd:.7,t:0,n:1,mag:70,lv:1,xp:0,inv:0,fx:1,fy:0};H.mx=H.hp;
 const E=[],B=[],P=[];let t=0,spawn=0,kills=0,got=0,end=0,pause=0,boss=0,keys={},joy=null,last=performance.now();
 const kd=e=>keys[e.key.toLowerCase()]=1,ku=e=>keys[e.key.toLowerCase()]=0;addEventListener('keydown',kd);addEventListener('keyup',ku);
 cv.onpointerdown=e=>{joy={x:e.clientX,y:e.clientY,dx:0,dy:0}};
 cv.onpointermove=e=>{if(!joy)return;let dx=e.clientX-joy.x,dy=e.clientY-joy.y;const l=Math.hypot(dx,dy);if(l>50){dx*=50/l;dy*=50/l}joy.dx=dx/50;joy.dy=dy/50};
 cv.onpointerup=cv.onpointercancel=()=>{joy=null};
 function mk(big){const a=rnd(0,6.283),R=Math.max(cv.width,cv.height)/2+50,n=pl[Math.random()*pl.length|0];
  const hp=(big?12:1)*(12+t*.9)*df;E.push({x:H.x+Math.cos(a)*R,y:H.y+Math.sin(a)*R,hp,mh:hp,r:big?44:rnd(14,20),sp:(big?55:rnd(45,75))+t*.4,n,big,dm:(big?2:1)*(8+t*.15)*dd})}
 function drop(e){const n=e.big?10:(Math.random()<.4?1:0);for(let i=0;i<n;i++)P.push({x:e.x+rnd(-20,20),y:e.y+rnd(-20,20),n:e.n})}
 function fire(){const T=E.slice().sort((a,b)=>Math.hypot(a.x-H.x,a.y-H.y)-Math.hypot(b.x-H.x,b.y-H.y));if(!T.length)return;
  for(let i=0;i<H.n;i++){const e=T[i%Math.min(T.length,H.n)],a=Math.atan2(e.y-H.y,e.x-H.x)+(H.n>1?(i-(H.n-1)/2)*.12:0);B.push({x:H.x,y:H.y,vx:Math.cos(a)*420,vy:Math.sin(a)*420,l:1.2,d:H.dmg})}}
 function lvUp(){pause=1;H.xp-=5+H.lv*4;H.lv++;
  const O=[['⚔ 공격력 +30%',()=>H.dmg*=1.3],['⚡ 연사 +20%',()=>H.cd*=.8],['✨ 발사체 +1',()=>H.n++],['👟 이동속도 +12%',()=>H.sp*=1.12],['🧲 끌어당김 +50%',()=>H.mag*=1.5],['❤ 체력 회복 +40%',()=>H.hp=Math.min(H.mx,H.hp+H.mx*.4)]].sort(()=>Math.random()-.5).slice(0,3);
  const d=document.createElement('div');d.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:#000a;z-index:3;color:#fff';
  d.innerHTML='<b style="font-size:20px">레벨 '+H.lv+'! 하나를 골라요</b>';
  O.forEach(o=>{const b=document.createElement('button');b.textContent=o[0];b.style.cssText='padding:14px 24px;font-size:18px;min-width:240px';b.onclick=()=>{o[1]();d.remove();pause=0;last=performance.now()};d.appendChild(b)});ov.appendChild(d)}
 function step(dt){
  t+=dt;spawn-=dt;if(spawn<=0&&E.length<120){spawn=Math.max(.12,.7-t*.006);const n=1+(t/25|0);for(let i=0;i<n;i++)mk(0)}
  if(!boss&&t>=DUR-25){boss=1;mk(1)}
  let ix=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),iy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);if(joy){ix=joy.dx;iy=joy.dy}
  const il=Math.hypot(ix,iy);if(il>0){const f=Math.min(1,il)/il;H.x+=ix*f*H.sp*dt;H.y+=iy*f*H.sp*dt}
  H.t-=dt;if(H.t<=0){H.t=H.cd;fire()}H.inv-=dt;
  for(const e of E){const a=Math.atan2(H.y-e.y,H.x-e.x);e.x+=Math.cos(a)*e.sp*dt;e.y+=Math.sin(a)*e.sp*dt;
   if(H.inv<=0&&Math.hypot(e.x-H.x,e.y-H.y)<e.r+16){H.hp-=e.dm;H.inv=.5;if(H.hp<=0)finish(0)}}
  for(const b of B){b.x+=b.vx*dt;b.y+=b.vy*dt;b.l-=dt;for(const e of E)if(e.hp>0&&b.l>0&&Math.hypot(e.x-b.x,e.y-b.y)<e.r+6){e.hp-=b.d;b.l=0;if(e.hp<=0){kills++;H.xp++;drop(e)}}}
  for(let i=E.length-1;i>=0;i--)if(E[i].hp<=0)E.splice(i,1);for(let i=B.length-1;i>=0;i--)if(B[i].l<=0)B.splice(i,1);
  for(let i=P.length-1;i>=0;i--){const p=P[i],d=Math.hypot(H.x-p.x,H.y-p.y);if(d<H.mag){p.x+=(H.x-p.x)/d*260*dt;p.y+=(H.y-p.y)/d*260*dt}if(d<18){got++;P.splice(i,1)}}
  if(H.xp>=5+H.lv*4)lvUp();
  if(t>=DUR)finish(1)}
 function draw(){const W=cv.width,Hh=cv.height,ox=W/2-H.x,oy=Hh/2-H.y;
  c.fillStyle='#10131c';c.fillRect(0,0,W,Hh);c.strokeStyle=D.c+'33';c.lineWidth=1;
  for(let x=-((H.x%64)+64)%64;x<W;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x,Hh);c.stroke()}
  for(let y=-((H.y%64)+64)%64;y<Hh;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke()}
  const face=(n,x,y,r,col)=>{const i=img(n);c.save();c.beginPath();c.arc(x,y,r,0,6.283);c.clip();c.fillStyle=col;c.fillRect(x-r,y-r,r*2,r*2);if(i.complete&&!i._bad&&i.naturalWidth)c.drawImage(i,x-r,y-r,r*2,r*2);c.restore();c.beginPath();c.arc(x,y,r,0,6.283);c.strokeStyle=col;c.lineWidth=2;c.stroke()};
  for(const p of P){c.fillStyle=D.c;c.beginPath();c.arc(p.x+ox,p.y+oy,6,0,6.283);c.fill()}
  for(const e of E){face(e.n,e.x+ox,e.y+oy,e.r,e.big?'#f55':'#889');if(e.big){c.fillStyle='#f55';c.fillRect(e.x+ox-e.r,e.y+oy-e.r-8,e.r*2*e.hp/e.mh,4)}}
  c.fillStyle='#fff';for(const b of B){c.beginPath();c.arc(b.x+ox,b.y+oy,5,0,6.283);c.fill()}
  if(H.inv>0&&Math.floor(H.inv*20)%2)c.globalAlpha=.4;face(m.n,W/2,Hh/2,20,D.c);c.globalAlpha=1;
  c.fillStyle='#333';c.fillRect(W/2-30,Hh/2+26,60,6);c.fillStyle='#3be06a';c.fillRect(W/2-30,Hh/2+26,60*Math.max(0,H.hp)/H.mx,6);
  c.fillStyle='#fff';c.font='bold 16px system-ui';c.textAlign='left';c.fillText(D.e+' '+D.n+'·'+TN()[tier]+'  ⏱ '+Math.max(0,Math.ceil(DUR-t))+'초  Lv.'+H.lv+'  처치 '+kills+'  모은 것 '+got,10,26);
  if(joy){c.strokeStyle='#fff6';c.beginPath();c.arc(joy.x,joy.y,50,0,6.283);c.stroke();c.fillStyle='#fff5';c.beginPath();c.arc(joy.x+joy.dx*50,joy.y+joy.dy*50,18,0,6.283);c.fill()}}
 function loop(now){if(end)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!pause)step(dt);draw();requestAnimationFrame(loop)}
 ex.onclick=()=>finish(2);
 function finish(r){if(end)return;end=1;removeEventListener('keydown',kd);removeEventListener('keyup',ku);removeEventListener('resize',fit);ov.remove();reward(k,got,kills,r,tier)}
 requestAnimationFrame(loop);
}

async function reward(k,got,kills,r,tier){
 const s=sv(),mul=r===1?1.5:.5,D=DG[k],tm=mulT(tier),lv=avgLv(),pl=pool();
 s.best[k]=Math.max(s.best[k]||0,kills);
 const n=got*mul,out=[];
 // 자기 던전 보상은 100%, 나머지 둘은 30% (그래도 셋 다 받아요)
 const w=x=>k==='play'?(x==='exp'?1:0):(x===k?1:.3);
 const GOLD_MAX=1000000,GOLD_FULL=100;// 명계에서 모은 게 100개 이상이면 한 판 최대 100만원 · 쉬운 난이도는 본편 상금 배율만큼 줄어요
 const gold=Math.round(GOLD_MAX*(tm/mulT(9))*w('gold')*Math.min(1,n/GOLD_FULL));
 let souls=Math.min(30+tier*5,Math.ceil(n*w('soul')/4*(1+tier*.15)));
 const M=META[lead().n];
 const base=Math.max(50,Math.round(bst(M.stats)/4.2*lv/7*(1+.05*(typeof rbTier==='function'?rbTier():0))));
 let xp=Math.round(base*4*n*w('exp')*tm);
 // 경험치 한도: 한 판 최대 '지금 레벨에서 XP_RUN_LV 레벨 올리는 양' · 하루 합계는 그 XP_DAY_RUNS 판 분량
 const lv0=Math.max(1,(lead().lv|0)||1),xcap=Math.max(100,expAt(lv0+XP_RUN_LV)-expAt(lv0)),xcut=xp>xcap||xp>Math.max(0,xcap*XP_DAY_RUNS-s.xp);
 xp=Math.max(0,Math.min(xp,xcap,xcap*XP_DAY_RUNS-s.xp));s.xp+=xp;
 const dr=typeof DRARE!=='undefined'?DRARE[tier]:1;
 const roll=()=>{const W=RW.slice(0,7).map((x,i)=>i?x*dr:x),T=W.reduce((a,b)=>a+b,0);let u=Math.random()*T;for(let i=0;i<7;i++){u-=W[i];if(u<0)return i}return 0};
 if(gold>0){G.money+=gold;out.push('💰 '+gold+'원')}
 if(souls>0){G.dupes=G.dupes||[];for(let i=0;i<souls;i++){const m2=META[pl[Math.random()*pl.length|0]];G.dupes.push({kind:'P',id:m2.dex,rar:roll(),lv:lv,sh:0,soul:1})}out.push('👻 영혼 '+souls+'개')}
 // 🪙 서바이버 코인 (서바이버 플레이만): 기본 (4+2·난이도) × 보상배율 × 처치 비율 · 하루 한도 · 오늘 첫 클리어 · 난이도 첫 클리어
 if(k==='play'){const perf=Math.min(1,kills/PERF_KILLS);let c0=Math.round((4+2*tier)*mul*perf);if(r===1)c0=Math.max(1,c0);
  const room=Math.max(0,COIN_DAY-s.c);const capHit=c0>room;c0=Math.min(c0,room);let fc=0,tb=0;
  if(r===1&&!s.fc){s.fc=1;fc=COIN_FC_DAY}
  G.svClr=G.svClr||{};if(r===1&&!G.svClr[tier]){G.svClr[tier]=1;tb=COIN_FC_TIER[0]+COIN_FC_TIER[1]*tier}
  const tot=c0+fc+tb;if(tot>0){G.svc=(G.svc|0)+tot;s.c+=c0+fc;out.push('🪙 서바이버 코인 +'+tot+(fc||tb?' ('+(c0?'기본 '+c0:'')+(fc?(c0?' · ':'')+'오늘 첫 클리어 '+fc:'')+(tb?' · '+TN()[tier]+' 첫 클리어 '+tb:'')+')':'')+' · 지금 '+G.svc)}
  if(capHit)out.push('<small>오늘 코인 한도('+COIN_DAY+')를 다 채웠어요</small>')}
 if(xp>0){for(const m of G.party){if(m.hp<=0)continue;if(m.exp<expAt(m.lv))m.exp=expAt(m.lv);m.exp+=xp;const cap=lvCapOf(m);while(m.exp>=expAt(m.lv+1)&&m.lv<cap){await gainLv(m,1)}if(m.lv>=cap)m.exp=Math.min(m.exp,expAt(m.lv+1)-1)}out.push('🧪 경험치 '+xp+' (파티 전원)'+(xcut?' <small>(한도까지만 받았어요)</small>':''))}
 save();
 openPanel(D.e+' '+D.n+' 결과','<div style="padding:10px;font-size:15px"><b>'+(r===1?'🎉 끝까지 살아남았어요! (보상 ×1.5)':r===0?'💀 쓰러졌어요 (보상 ×0.5)':'🚪 나왔어요 (보상 ×0.5)')+'</b><br><small>난이도 '+TN()[tier]+' (보상 ×'+tm+')</small><br>처치 '+kills+'마리 · 모은 것 '+got+'개<br>'+(out.length?out.join('<br>'):'받을 게 없어요')+'</div><div class="row"><button id="svAgain">던전 목록</button></div>');
 const b=$('svAgain');if(b)b.onclick=open;
}

const card={k:'sv',n:'🗡 서바이버 던전',d:'손가락으로 움직이고 공격은 자동! 서바이버 플레이(경험치 · 🪙코인 · 제한 없음) · 골드 던전 · 영혼 던전(하루 '+DAILY+'번)에서 '+DUR+'초 버티면 보상을 받아요.',st:()=>{const s=sv();return '오늘 남은 횟수 '+Object.keys(DG).map(k=>DG[k].e+(k==='play'?'∞':DAILY-s.n[k])).join(' ')},go:[['던전 고르기',()=>open()]]};
const i=HUB.findIndex(h=>h.k==='tg'),j=HUB.findIndex(h=>h.k==='wb');const at=i>=0?i:j;
if(at>=0)HUB.splice(at+1,0,card);else HUB.push(card);
window.svOpen=open;
}catch(e){console.warn('survivor',e)}})();
