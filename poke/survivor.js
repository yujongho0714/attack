// 서바이버 던전 (경험치 · 골드 · 영혼 · 월드보스) — 게임 본체는 poke/sb/ 의 「서바이버 버스트」(sb/game.src.html 수정 → python3 build.py)
// 컨텐츠 카드 svx(경험치) svg(골드) svs(영혼) svb(월드보스) svk(코인 상점) · 일일 숙제 팝업(드래그 · 접기 · 다 하면 사라짐)
// 소탕: G.svRec = {던전:{난이도:{got,kills,bdmg,r}}} 난이도별 최고 기록 (날이 바뀌어도 안 지워짐) · 소탕은 그 기록 그대로 보상 + 하루 횟수 1번 사용 · 자동 조종은 sb/ 안의 🤖 버튼(localStorage 'sb-auto')
// 값: G.svd = {k:날짜, n:{play,gold,soul,boss 오늘 들어간 횟수}, best:{...}, c:오늘 번 코인, xp:오늘 받은 경험치, fc:오늘 첫 클리어, buy:{오늘 산 것}} · G.svc = 서바이버 코인 · G.svClr = 난이도 첫 클리어 기록 · G.svLast = 마지막에 고른 난이도
(function(){try{
const DG={
 play:{key:'svx',m:'exp',n:'경험치 던전',e:'🧪',c:'#4cc9f0',dur:150,d:'경험치 구슬을 모아요. 경험치와 🪙서바이버 코인을 줘요. (경험치는 하루 한도까지)'},
 gold:{key:'svg',m:'gold',n:'골드 던전',e:'💰',c:'#ffd60a',dur:150,d:'적을 쓰러뜨리면 금화가 떨어져요. 골드를 제일 많이 줘요 (경험치 · 영혼도 조금).'},
 soul:{key:'svs',m:'soul',n:'영혼 던전',e:'👻',c:'#b388ff',dur:150,d:'적을 쓰러뜨리면 영혼 불꽃이 떨어져요. 영혼을 제일 많이 줘요 (경험치 · 골드도 조금).'},
 boss:{key:'svb',m:'boss',n:'일일보스',e:'👑',c:'#ff6a5a',dur:75,d:'매일 열리는 거대한 보스예요! 난이도가 높을수록 내 파티 화력만큼 단단하고 사나워져요 (체력이 절반 아래면 더 화내요). 졸개들을 피하면서 보스에게 최대한 많은 피해를 줘요. 쓰러뜨리면 ×1.5, 피해를 준 만큼 골드 · 영혼 · 경험치를 줘요.'}};
const DAILY=3,$=id=>document.getElementById(id);
// ★ 보상 한도 (밸런스 5차 · 숫자만 바꾸면 돼요 · 괄호 안은 5차 전 값)
// 경험치: 한 판 = 파티 전원 +XP_RUN_LV 레벨(각자 자기 레벨 기준) · 하루 합계 XP_DAY_RUNS 판 분량 · XP_FULL 마리(월드보스는 피해 100%)를 잡아야 100%
const XP_RUN_LV=1,XP_DAY_RUNS=5,XP_FULL=300;                       // (3레벨 · 10판 · 처치 수 상관없이 항상 꽉 참)
// 골드: 명계에서 GOLD_FULL 개 이상 모으면 한 판 최대 GOLD_MAX (쉬운 난이도는 본편 상금 배율만큼 줄어요)
const GOLD_MAX=2000000,GOLD_FULL=150;                              // (5차 밸런스 300,000 · 150개)
// 영혼: 한 판 최대 SOUL_BASE+난이도·SOUL_TIER 개 · SOUL_DIV 마리당 1개
//  등급: 본편 난이도 보너스(DRARE)는 희귀·에픽에만, 그것도 SOUL_RAR 비율만큼 반영 · 전설 이상(레전드리·신화·환상·유일)은 기본 확률 × SOUL_HI
const SOUL_BASE=30,SOUL_TIER=5,SOUL_DIV=4,SOUL_RAR=1,SOUL_HI=1;   // (5차 밸런스: 10+2·난이도 · 6 / 그 전: 보너스 100%를 전 등급에 · 전설 이상도 난이도 배율을 그대로 받음)
// 보스 처치 보너스: 던전 안에서 보스(👑)를 한 마리 잡을 때마다 골드 · 영혼 +BOSS_BONUS (골드·영혼 던전만)
const BOSS_BONUS=.5;
// 서바이버 코인
const COIN_DAY=200,COIN_FC_DAY=10,COIN_FC_TIER=[20,10],PERF_KILLS=150;  // (400 · 20 · [40,25])
// 코인 상점: [아이템, 코인, 하루 구매 한도(0=없음), 천계 이상만(1)]
const SHOP=[['cube',30,10,0],['cube2',100,3,0],['cube4',100,3,1],['candy',60,3,0],['cube6',800,2,0],['cube7',800,2,1]];   // (큐브 20·80·80 코인 무제한 · 이상한사탕 12코인 무제한 · 앱솔/어메이징 600코인)
const KEYS=['play','gold','soul','boss'];
function sv(){G.svd=G.svd||{};if(G.svd.k!==dayKey())G.svd={k:dayKey(),n:{play:0,gold:0,soul:0,boss:0},best:G.svd.best||{}};const s=G.svd;s.n=s.n||{};KEYS.forEach(k=>s.n[k]=s.n[k]|0);s.best=s.best||{};s.c=s.c|0;s.xp=s.xp|0;s.xr=s.xr|0;s.fc=s.fc|0;s.buy=s.buy||{};return s}
const pool=()=>Object.keys(META).filter(k=>META[k].dex<=386&&META[k].stats);
const lead=()=>G.party.find(m=>m.hp>0)||G.party[0];
const avgLv=()=>Math.max(1,Math.round(G.party.reduce((a,m)=>a+m.lv,0)/Math.max(1,G.party.length)));
const TN=()=>typeof DNAME!=='undefined'?DNAME:['쉬움','보통','어려움','지옥','나이트메어','종말','천계','천상계','하계','명계'];
const mulT=t=>typeof DMONEY!=='undefined'?DMONEY[t]:1;
const lim=k=>true;   // 모든 던전 하루 DAILY번 (경험치 던전도 포함)

// ---------- 코인 상점 ----------
function shop(){
 const s=sv(),art=!!(window.artOn&&window.artOn());
 const rows=SHOP.filter(x=>ITEMS[x[0]]&&(!x[3]||art)).map(([id,pr,l])=>{const left=l?l-(s.buy[id]|0):99,it=ITEMS[id];
  return `<div class="row"><span>${it.e} <b>${it.n}</b><br><small>🪙 ${pr}${l?' · 오늘 남은 '+left+'/'+l:''} · 가진 것 ${G.bag[id]||0}</small></span><button data-b="${id}" ${(G.svc|0)<pr||left<=0?'disabled':''}>사기</button></div>`}).join('');
 openPanel('🪙 코인 상점 · 가진 코인 '+(G.svc|0),'<div style="padding:6px;font-size:14px">경험치 던전을 끝까지 하면 받는 코인으로 바꿔요. 물건마다 하루에 살 수 있는 수가 정해져 있어요.</div>'+rows);
 const p=document.querySelector('.panel');if(!p)return;
 p.querySelectorAll('button[data-b]').forEach(b=>b.onclick=()=>{const id=b.dataset.b,x=SHOP.find(y=>y[0]===id);if(!x)return;const s2=sv(),l=x[2];
  if((G.svc|0)<x[1]){toast('코인이 모자라요');return}if(l&&(s2.buy[id]|0)>=l){toast('오늘은 더 못 사요');return}
  G.svc=(G.svc|0)-x[1];addItem(id,1);if(l)s2.buy[id]=(s2.buy[id]|0)+1;save();try{sfx('get')}catch(e){}toast(ITEMS[id].n+' 1개를 샀어요!');shop()});
}

// ---------- 난이도 고르기 · 들어가기 ----------
function pickTier(k){
 const mx=Math.min(9,DIFF()),D=DG[k];
 if(mx<=0){closePanel(1);start(k,0);return}
 const left=lim(k)?DAILY-sv().n[k]:99;
 const rows=TN().slice(0,mx+1).map((n,t)=>`<div class="row"><span><b>${n}</b><br><small>적 체력 ×${(1+t*.9).toFixed(1)} · 보상 ×${mulT(t)}</small></span><button data-t="${t}" ${left<=0?'disabled':''}>들어가기</button></div>`).join('');
 let au=0;try{au=localStorage.getItem('sb-auto')==='1'?1:0}catch(e){}
 openPanel(D.e+' '+D.n+' · 난이도 고르기','<div class="row"><span><b>🤖 자동 조종</b><br><small>켜면 알아서 피해 다니고 구슬을 주워요 · 레벨업도 알아서 골라요 (직접 움직이면 내 조작이 먼저)</small></span><button id="svAu">'+(au?'켜짐 (끄기)':'꺼짐 (켜기)')+'</button></div><div style="padding:6px;font-size:14px">'+(lim(k)?'오늘 남은 횟수 '+left+'/'+Math.max(DAILY,left)+' · ':'횟수 제한 없음 · ')+'지금 게임 난이도('+TN()[DIFF()]+')까지 고를 수 있어요. 어려울수록 보상이 커져요.</div>'+rows);
 const p=document.querySelector('.panel');if(!p)return;
 p.querySelectorAll('button[data-t]').forEach(b=>b.onclick=()=>{closePanel(1);start(k,+b.dataset.t)});
 const au2=p.querySelector('#svAu');if(au2)au2.onclick=()=>{let v=0;try{v=localStorage.getItem('sb-auto')==='1'?0:1;localStorage.setItem('sb-auto',v?'1':'0')}catch(e){}au2.textContent=v?'켜짐 (끄기)':'꺼짐 (켜기)';try{toast(v?'자동 조종을 켰어요':'자동 조종을 껐어요')}catch(e){}};
}
function quick(k){const mx=Math.min(9,DIFF());G.svLast=G.svLast||{};const t=Math.min(mx,G.svLast[k]!=null?G.svLast[k]:mx);start(k,t)}

// ---------- 내 파티를 던전으로 (최대 6마리: 능력치 · 기술 · 그림을 sb/ 게임에 넘겨줘요) ----------
// sb/ 안에서는 1번 포켓몬을 내가 움직이고, 나머지는 알아서 돌아다니며 자기 기술로 적을 베요. 데미지 공식은 실시간 전투(wbswarm)와 같아요 (방어 100짜리 허수아비 기준).
const SB_MAX=6;
async function packParty(){
 try{
  if(!window.rtCtxBase)return null;
  try{await rzMovesLoad()}catch(e){}
  const C=window.rtCtxBase(),TC=C.TCOL||{};
  let mons=(G.party||[]).filter(m=>m&&m.hp>0&&C.META[m.n]);if(!mons.length)mons=(G.party||[]).filter(m=>m&&C.META[m.n]);
  mons=mons.slice(0,SB_MAX);
  const rgbOf=h=>{const n=parseInt(String(h||'#ffffff').replace('#','').slice(0,6),16)||16777215;return((n>>16)&255)+','+((n>>8)&255)+','+(n&255)};
  const mvOf=id=>{
   let d=(C.RZM&&C.RZM[id])||(C.SGD&&C.SGD[id])||null,name,type,p,c,k;
   if(d){name=d.n;type=d.t;p=d.p|0;c=d.c;k=d.k||'projectile'}
   else{const g=(C.mv&&C.mv(id))||{};name=g.name||id;type=g.type||'NORMAL';p=g.pw|0;c=g.ph?0:1;k=g.ph?'melee':'projectile'}
   const st=c===2||!(p>0),col=TC[type]||'#ffffff';
   return{id,name,type,p:st?0:p,phys:c===0,melee:k==='melee'||k==='leap',k,col,rgb:rgbOf(col)}};
  const out=[];
  for(const m of mons){try{
   const st=C.stOf(m),M=C.META[m.n],types=(M&&M.types)||['NORMAL'];
   let g=null,cx={c:0,d:0};try{g=C.gearOf(m)}catch(e){}try{cx=C.critOf(m)||cx}catch(e){}
   const aA=(g&&g.aA)||{},ign=Math.min(.9,(aA.ign||0)/100),lv=Math.min(100,m.lv||50);
   if(g&&(g.crt||g.cdm))cx={c:Math.min(.75,(cx.c||0)+(g.crt||0)/100),d:(cx.d||0)+(g.cdm||0)/100};
   const calc=mv=>{const A=mv.phys?st[1]:st[3],stab=types.includes(mv.type)?1.5:1;
    let d=((2*lv/5+2)*mv.p*A/Math.max(1,100*(1-ign))/50+2)*.52*stab*(mv.melee&&mv.phys?1.15:1);
    if(g&&g.atk)d*=1+g.atk/100;
    d*=(1+(aA.tatk||0)/100)*(1+(aA.tdmg||0)/100)*(1+(aA.elem||0)/100)*(1+(aA.aB||0)/100);
    try{d*=+C.dmgMul(m,m,mv.id)||1}catch(e){}
    return Math.max(1,Math.round(d))};
   let moves=(m.moves||[]).slice(0,4).map(mvOf);moves.forEach(x=>{x.d=x.p>0?calc(x):0});
   if(!moves.some(x=>x.p>0)){const x=mvOf('struggle');x.p=x.p||40;x.melee=true;x.k='melee';x.d=calc(x);moves.push(x)}
   let S0=null;try{S0=await Promise.race([C.getSpr(C.sprKey(m)),new Promise(r=>setTimeout(()=>r(null),4000))])}catch(e){}
   out.push({uid:m.uid,n:m.n,name:C.nm(m),lv,types,hp:Math.max(1,Math.round(st[0]*(1+(((g&&g.hp)||0)+(aA.hp||0))/100))),spd:Math.max(120,Math.min(230,110+.55*(st[5]||60))),
    crit:cx,aw:(()=>{try{return typeof awEff==='function'?awEff(m):((m.aw|0)||0)}catch(e){return m.aw|0}})(),best:Math.max(1,...moves.map(x=>x.d||0)),moves,S:S0})
  }catch(e){console.warn('sb party',e)}}
  return out
 }catch(e){console.warn('packParty',e);return null}
}

function start(k,tier){tier=tier|0;
 const s=sv();if(!G.party.length)return;
 if(document.getElementById('svOv')||window.__svBusy)return;
 if(lim(k)&&s.n[k]>=DAILY){toast('오늘은 다 했어요 (하루 '+DAILY+'번)');return}
 if(lim(k))s.n[k]++;G.svLast=G.svLast||{};G.svLast[k]=tier;save();
 const D=DG[k];let done=0;window.__svBusy=1;
 const run=()=>{window.__svBusy=0;
 try{BGM.play(null)}catch(e){}
 const ov=document.createElement('div');ov.id='svOv';ov.style.cssText='position:fixed;inset:0;z-index:99999;background:#000';
 const ifr=document.createElement('iframe');ifr.setAttribute('allow','autoplay');
 ifr.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#000';
 ifr.src='sb/index.html?mode='+D.m+'&tier='+tier+'&dur='+D.dur+'&t='+Date.now();
 const ex=document.createElement('button');ex.textContent='✕ 나가기';
 ex.style.cssText='position:absolute;left:8px;top:calc(env(safe-area-inset-top,0px) + 28px);z-index:2;padding:6px 10px;font-size:13px';
 ov.appendChild(ifr);ov.appendChild(ex);document.body.appendChild(ov);
 const finish=res=>{if(done)return;done=1;window.__SBP=null;removeEventListener('message',onMsg);ov.remove();try{BGM.area()}catch(e){}try{saveRec(k,res)}catch(e){}reward(k,res);pop()};
 const onMsg=e=>{if(e.source!==ifr.contentWindow)return;const d=e.data;if(d&&d.sb)finish(d)};
 addEventListener('message',onMsg);
 ex.onclick=()=>{try{ifr.contentWindow.postMessage({cmd:'quit'},'*')}catch(e){}setTimeout(()=>finish({sb:1,mode:D.m,tier,r:2,kills:0,got:0,bdmg:0}),1200)};
 };
 packParty().then(P=>{window.__SBP=(P&&P.length)?P:null},()=>{window.__SBP=null}).then(run,run);
}


// ---------- 소탕: 난이도마다 내 최고 기록을 그대로 보상으로 (하루 횟수 1번 사용 · 첫 클리어 보너스는 직접 해야 받아요) ----------
const mulR=r=>r===1?1.5:r===3?1:.5;
const scoreOf=x=>(x.got|0)*mulR(x.r|0);
const tieOf=(k,x)=>k==='boss'?(x.bdmg|0):(x.kills|0);
const recs=k=>(G.svRec&&G.svRec[k])||{};
const hasRec=k=>Object.keys(recs(k)).some(t=>+t<=Math.min(9,DIFF()));
function saveRec(k,res){
 const got=res.got|0,kills=res.kills|0,bdmg=res.bdmg|0;if(!got&&!kills&&!bdmg)return;
 G.svRec=G.svRec||{};const m=G.svRec[k]=G.svRec[k]||{},t=res.tier|0,nw={got,kills,bdmg,r:res.r|0,bk:res.bk|0},o=m[t];
 if(!o||scoreOf(nw)>scoreOf(o)||(scoreOf(nw)===scoreOf(o)&&tieOf(k,nw)>tieOf(k,o)))m[t]=nw;save();
}
// 예상 보상이 제일 큰 난이도 (난이도 배율 × 기록이 꽉 찬 정도)
function bestTier(k){
 const R=recs(k),mx=Math.min(9,DIFF()),F=k==='boss'?100:k==='play'?300:GOLD_FULL;let bt=-1,bv=-1;
 Object.keys(R).forEach(t=>{t=+t;if(t>mx)return;const v=mulT(t)*Math.max(.05,Math.min(1,scoreOf(R[t])/F));if(v>bv){bv=v;bt=t}});return bt;
}
const recTxt=(k,x)=>k==='boss'?'보스 피해 '+(x.bdmg|0).toLocaleString()+' ('+(x.got|0)+'%)':'모은 것 '+(x.got|0)+' · 처치 '+(x.kills|0);
async function sweepRun(k,tier,quiet){
 const s=sv(),x=(G.svRec&&G.svRec[k]&&G.svRec[k][tier])||null;if(!x)return null;
 if(lim(k)&&s.n[k]>=DAILY){toast('오늘은 다 했어요 (하루 '+DAILY+'번)');return null}
 if(lim(k))s.n[k]++;G.svLast=G.svLast||{};G.svLast[k]=tier;save();
 return await reward(k,{sb:1,mode:DG[k].m,tier,r:x.r,kills:x.kills,got:x.got,bdmg:x.bdmg,bk:x.bk|0},{sw:1,quiet});
}
async function sweepAll(k){
 const s=sv(),left=lim(k)?DAILY-s.n[k]:1,t=bestTier(k);if(t<0||left<=0)return;
 const lines=[];for(let i=0;i<left;i++){const r=await sweepRun(k,t,true);if(r==null)break;lines.push((i+1)+'번째 · '+r)}
 pop();if(!lines.length)return;const D=DG[k];
 openPanel('⚡ '+D.n+' 소탕 결과','<div style="padding:10px;font-size:14px"><b>난이도 '+TN()[t]+'의 최고 기록으로 '+lines.length+'번 소탕했어요</b><br><small>'+recTxt(k,recs(k)[t])+'</small><br>'+lines.join('<br>')+'</div>');
}
function sweepPick(k){
 const D=DG[k],s=sv(),R=recs(k),mx=Math.min(9,DIFF());
 if(!hasRec(k)){toast('먼저 한 번 직접 해야 소탕할 수 있어요 (그 기록으로 소탕해요)');return}
 const left=lim(k)?DAILY-s.n[k]:99,bt=bestTier(k);
 const rows=TN().slice(0,mx+1).map((n,t)=>R[t]?`<div class="row"><span><b>${n}</b>${t===bt?' ⭐':''}<br><small>${recTxt(k,R[t])} · 보상 ×${mulT(t)}</small></span><button data-t="${t}" ${left<=0?'disabled':''}>소탕</button></div>`:'').join('');
 openPanel('⚡ '+D.n+' · 소탕','<div style="padding:6px;font-size:14px">직접 해서 세운 <b>난이도별 최고 기록</b> 그대로 바로 보상을 받아요.'+(lim(k)?' 소탕도 하루 '+DAILY+'번에 들어가요 (오늘 남은 횟수 '+left+'/'+Math.max(DAILY,left)+').':' 횟수 제한은 없지만 경험치·코인 하루 한도는 그대로예요.')+' 기록은 더 잘하면 자동으로 올라가요.</div>'+(lim(k)?`<div class="row"><span><b>⭐ 남은 횟수 모두 소탕</b><br><small>예상 보상이 제일 큰 난이도 (${TN()[bt]}) 기록으로 ${Math.max(0,left)}번</small></span><button id="svAll" ${left<=0?'disabled':''}>모두 소탕</button></div>`:'')+rows);
 const p=document.querySelector('.panel');if(!p)return;
 const a=p.querySelector('#svAll');if(a)a.onclick=()=>{closePanel(1);sweepAll(k)};
 p.querySelectorAll('button[data-t]').forEach(b=>b.onclick=async()=>{closePanel(1);await sweepRun(k,+b.dataset.t,false);pop()});
}

// ---------- 보상 ----------
async function reward(k,res,opt){opt=opt||{};
 const s=sv(),r=res.r|0,got=res.got|0,kills=res.kills|0,tier=res.tier|0,mul=r===1?1.5:r===3?1:.5,D=DG[k],tm=mulT(tier),lv=avgLv(),pl=pool();
 s.best[k]=Math.max(s.best[k]||0,k==='boss'?(res.bdmg|0):kills);
 const n=got*mul,out=[],bk=(k==='gold'||k==='soul')?(res.bk|0):0,bb=1+BOSS_BONUS*bk;
 // 자기 던전 보상은 100%, 나머지 둘은 30% (월드보스는 셋 다 70%)
 const w=x=>k==='play'?(x==='exp'?1:0):k==='boss'?.7:(x===k?1:.3);
 const gold=Math.round(GOLD_MAX*(tm/mulT(9))*w('gold')*Math.min(1,n/GOLD_FULL)*bb);
 let souls=Math.ceil(Math.min(SOUL_BASE+tier*SOUL_TIER,Math.ceil(n*w('soul')/SOUL_DIV*(1+tier*.1)))*bb);
 // 경험치: f = 이번 판이 '꽉 찬 한 판'의 몇 %인지(0~1) · 많이 잡을수록 · 어려울수록 커짐 · 하루 합계 XP_DAY_RUNS 판까지
 const perf=Math.min(1,n/(k==='boss'?100:XP_FULL)),tierF=.6+.4*tier/9;
 let f=Math.max(0,perf*w('exp')*tierF);const fWant=f;
 f=Math.max(0,Math.min(f,XP_DAY_RUNS-s.xr/1000));s.xr+=Math.round(f*1000);const xcut=f<fWant-1e-6;
 // 영혼 등급 확률: 희귀·영웅은 난이도 보너스(DRARE)×SOUL_RAR, 전설 이상은 ×SOUL_HI 만큼 받아요 (둘 다 1이면 난이도 배율을 그대로 · 어려울수록 높은 등급)
 const dr=typeof DRARE!=='undefined'?1+(DRARE[tier]-1)*SOUL_RAR:1;
 const dh=typeof DRARE!=='undefined'?1+(DRARE[tier]-1)*SOUL_HI:1;
 const roll=()=>{const W=RW.slice(0,7).map((x,i)=>i===0?x:i<=2?x*dr:x*dh),T=W.reduce((a,b)=>a+b,0);let u=Math.random()*T;for(let i=0;i<7;i++){u-=W[i];if(u<0)return i}return 0};
 if(bk>0)out.push('👑 보스 '+bk+'마리 처치 보너스 (골드·영혼 ×'+bb.toFixed(2)+')');
 if(gold>0){G.money+=gold;out.push('💰 '+gold+'원')}
 if(souls>0){G.dupes=G.dupes||[];for(let i=0;i<souls;i++){const m2=META[pl[Math.random()*pl.length|0]];G.dupes.push({kind:'P',id:m2.dex,rar:roll(),lv:lv,sh:0,soul:1})}out.push('👻 영혼 '+souls+'개')}
 // 🪙 서바이버 코인 (경험치 던전만): 기본 (4+2·난이도) × 보상배율 × 처치 비율 · 하루 한도 · 오늘 첫 클리어 · 난이도 첫 클리어
 if(k==='play'){const perf=Math.min(1,kills/PERF_KILLS);let c0=Math.round((4+2*tier)*mul*perf);if(r===1)c0=Math.max(1,c0);
  const room=Math.max(0,COIN_DAY-s.c);const capHit=c0>room;c0=Math.min(c0,room);let fc=0,tb=0;
  if(r===1&&!s.fc&&!opt.sw){s.fc=1;fc=COIN_FC_DAY}
  G.svClr=G.svClr||{};if(r===1&&!G.svClr[tier]&&!opt.sw){G.svClr[tier]=1;tb=COIN_FC_TIER[0]+COIN_FC_TIER[1]*tier}
  const tot=c0+fc+tb;if(tot>0){G.svc=(G.svc|0)+tot;s.c+=c0+fc;out.push('🪙 서바이버 코인 +'+tot+(fc||tb?' ('+(c0?'기본 '+c0:'')+(fc?(c0?' · ':'')+'오늘 첫 클리어 '+fc:'')+(tb?' · '+TN()[tier]+' 첫 클리어 '+tb:'')+')':'')+' · 지금 '+G.svc)}
  if(capHit)out.push('<small>오늘 코인 한도('+COIN_DAY+')를 다 채웠어요</small>')}
 if(f>0.0005){for(const m of G.party){if(m.hp<=0)continue;if(m.exp<expAt(m.lv))m.exp=expAt(m.lv);m.exp+=Math.round(f*(expAt(m.lv+XP_RUN_LV)-expAt(m.lv)));const cap=lvCapOf(m);while(m.exp>=expAt(m.lv+1)&&m.lv<cap){await gainLv(m,1)}if(m.lv>=cap)m.exp=Math.min(m.exp,expAt(m.lv+1)-1)}out.push('🧪 경험치 레벨 약 +'+(f*XP_RUN_LV).toFixed(2)+' (파티 전원)'+(xcut?' <small>(오늘 한도까지만 받았어요)</small>':''))}
 else if(fWant>0&&xcut)out.push('<small>오늘 경험치 한도를 다 채웠어요</small>')
 save();
 if(opt.quiet)return out.filter(x=>!/^<small>/.test(x)).join(' · ')||'받을 게 없어요';
 const head=(opt.sw?'⚡ 소탕 완료 · ':'')+(k==='boss'?(r===1?'🎉 일일보스를 쓰러뜨렸어요! (보상 ×1.5)':r===0?'💀 쓰러졌어요 (보상 ×0.5)':r===3?'⏱ 시간이 끝났어요 (보상 ×1)':'🚪 나왔어요 (보상 ×0.5)')
  :(r===1?'🎉 끝까지 살아남았어요! (보상 ×1.5)':r===0?'💀 쓰러졌어요 (보상 ×0.5)':'🚪 나왔어요 (보상 ×0.5)'));
 const line=k==='boss'?'보스에게 준 피해 '+(res.bdmg|0).toLocaleString()+' ('+got+'%) · 처치 '+kills+'마리':'처치 '+kills+'마리 · 모은 것 '+got+'개';
 openPanel(D.e+' '+D.n+' 결과','<div style="padding:10px;font-size:15px"><b>'+head+'</b><br><small>난이도 '+TN()[tier]+' (보상 ×'+tm+')</small><br>'+line+'<br>'+(out.length?out.join('<br>'):'받을 게 없어요')+'</div><div class="row"><button id="svAgain">한 번 더</button><button id="svSw">⚡ 소탕</button></div>');
 const b=$('svAgain');if(b){if(lim(k)&&sv().n[k]>=DAILY){b.disabled=true;b.textContent='오늘은 다 했어요'}else b.onclick=()=>pickTier(k)}
 const bs=$('svSw');if(bs){if(!hasRec(k)||(lim(k)&&sv().n[k]>=DAILY))bs.disabled=true;else bs.onclick=()=>sweepPick(k)}
}

// ---------- 컨텐츠 카드: 던전마다 따로 바로 보이게 ----------
const stOf=k=>()=>{const s=sv(),b=s.best[k]||0;return (lim(k)?'오늘 남은 횟수 '+(DAILY-s.n[k])+'/'+Math.max(DAILY,DAILY-s.n[k]):'오늘 '+s.n[k]+'번 · 횟수 제한 없음')+' · 최고 '+(k==='boss'?b.toLocaleString()+' 피해':b+'마리')};
const cards=KEYS.map(k=>{const D=DG[k];return{k:D.key,n:D.e+' '+D.n+' (매일)',d:D.d+' '+(lim(k)?'하루 '+DAILY+'번까지, ':'')+(D.dur)+'초 동안 손가락(또는 방향키·WASD)으로 움직이면 공격은 자동이에요. 🤖 자동 조종을 켜면 움직임과 기술 고르기까지 알아서 해요. 한 번 해 보면 최고 기록으로 ⚡소탕할 수 있어요.',st:stOf(k),go:[['들어가기',()=>quick(k)],['난이도 고르기',()=>pickTier(k)],['⚡ 소탕',()=>sweepPick(k)]]}});
cards.push({k:'svk',n:'🪙 서바이버 코인 상점',d:'경험치 던전을 끝까지 해서 받은 🪙코인으로 수상한 · 명장의 큐브, 이상한사탕, 앱솔루트 · 어메이징 큐브를 사요.',st:()=>'가진 코인 '+(G.svc|0)+' · 오늘 번 코인 '+sv().c+'/'+COIN_DAY,go:[['코인 상점 열기',()=>shop()]]});
{const i=HUB.findIndex(h=>h.k==='tg'),j=HUB.findIndex(h=>h.k==='wb'),at=i>=0?i:j;if(at>=0)HUB.splice(at+1,0,...cards);else HUB.push(...cards)}
window.svOpen=()=>pickTier('play');window.svStart=start;

// ---------- 일일 숙제 팝업 (게임 화면 위 · 끌어서 옮기기 · 접고 펴기 · 다 하면 사라짐) ----------
function tasks(){
 const out=[],s=sv();
 for(const k of ['gold','soul','boss','play']){const D=DG[k],n=s.n[k]|0;if(n<DAILY)out.push({id:k,t:D.e+' '+D.n,c:n+'/'+DAILY,go:()=>pickTier(k)})}
 try{if(typeof wbS==='function'&&typeof WB_TRY!=='undefined'){const n=wbS().tries[dayKey()]||0;if(n<WB_TRY)out.push({id:'wb',t:'🐉 월드보스',c:n+'/'+WB_TRY,go:()=>wbOpen()})}}catch(e){}
 try{const h=HUB.find(x=>x.k==='dq');if(h){const m=String(h.st()||'').match(/(\d+)\/3/);if(m&&+m[1]<3)out.push({id:'dq',t:'📜 천계 의뢰',c:m[1]+'/3',go:()=>h.go[0][1]()})}}catch(e){}
 return out;
}
const css=document.createElement('style');css.textContent=`
#svHw{position:fixed;z-index:12;width:188px;background:#fffbe8;border:3px solid #1c2550;box-shadow:0 4px 0 #0b0f24;font:800 13px 'Galmuri11',system-ui,sans-serif;color:#1c2550;user-select:none;-webkit-user-select:none}
#svHw .hwh{display:flex;align-items:center;gap:6px;padding:6px 8px;background:linear-gradient(#2c3a7a,#1c2550);color:#ffd23f;cursor:grab;touch-action:none}
#svHw .hwh b{flex:1}#svHw .hwh i{font-style:normal;min-width:20px;text-align:center;padding:0 5px;background:#e5482f;color:#fff;border-radius:9px}
#svHw .hwb{padding:4px}#svHw.cl .hwb{display:none}
#svHw .hwr{display:flex;align-items:center;gap:6px;padding:5px 4px;border-bottom:1px dashed #1c255055}#svHw .hwr:last-child{border:0}
#svHw .hwr span{flex:1;min-width:0}#svHw .hwr small{display:block;font-size:11px;opacity:.75}
#svHw .hwr button{padding:5px 9px!important;border:2px solid #0b0f24!important;background:#ffd23f!important;color:#1c2550!important;font:900 12px 'Galmuri11',system-ui!important;box-shadow:0 2px 0 #0b0f24!important;border-radius:0!important;min-height:0!important;height:auto!important;width:auto!important}`;
document.head.appendChild(css);
let hw=null,sig='';
const POSK='sv-hw-pos',CLK='sv-hw-cl';
function clampPos(){if(!hw)return;const w=hw.offsetWidth||188,h=hw.offsetHeight||40;let x=parseFloat(hw.style.left)||0,y=parseFloat(hw.style.top)||0;
 x=Math.max(0,Math.min(innerWidth-w,x));y=Math.max(0,Math.min(innerHeight-h,y));hw.style.left=x+'px';hw.style.top=y+'px'}
function build(){
 hw=document.createElement('div');hw.id='svHw';
 let pos=null;try{pos=JSON.parse(localStorage.getItem(POSK)||'null')}catch(e){}
 hw.style.left=(pos?pos.x:Math.max(0,innerWidth-200))+'px';hw.style.top=(pos?pos.y:90)+'px';
 try{if(localStorage.getItem(CLK)==='1')hw.classList.add('cl')}catch(e){}
 hw.innerHTML='<div class="hwh"><b>📋 일일 숙제</b><i></i><span class="hwa">▾</span></div><div class="hwb"></div>';
 document.body.appendChild(hw);
 const h=hw.querySelector('.hwh');let drag=null;
 h.onpointerdown=e=>{drag={sx:e.clientX,sy:e.clientY,x:parseFloat(hw.style.left)||0,y:parseFloat(hw.style.top)||0,moved:0};try{h.setPointerCapture(e.pointerId)}catch(_){}};
 h.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=1;hw.style.left=(drag.x+dx)+'px';hw.style.top=(drag.y+dy)+'px';clampPos()};
 h.onpointerup=h.onpointercancel=()=>{if(!drag)return;if(drag.moved){try{localStorage.setItem(POSK,JSON.stringify({x:parseFloat(hw.style.left),y:parseFloat(hw.style.top)}))}catch(e){}}
  else{const c=hw.classList.toggle('cl');try{localStorage.setItem(CLK,c?'1':'0')}catch(e){}arrow();clampPos()}drag=null};
 addEventListener('resize',clampPos);
}
const arrow=()=>{if(hw)hw.querySelector('.hwa').textContent=hw.classList.contains('cl')?'▸':'▾'};
function pop(){try{
 const ok=G&&G.party&&G.party.length&&(typeof SCENE==='undefined'||SCENE==='over')&&!document.getElementById('svOv');
 const T=ok?tasks():[];
 if(!T.length){if(hw)hw.style.display='none';return}
 if(!hw)build();
 hw.style.display='';
 const sg=T.map(x=>x.id+x.c).join('|');
 if(sg!==sig){sig=sg;
  hw.querySelector('.hwh i').textContent=T.length;
  const b=hw.querySelector('.hwb');b.innerHTML='';
  T.forEach(x=>{const r=document.createElement('div');r.className='hwr';r.innerHTML='<span>'+x.t+'<small>'+x.c+'</small></span><button>하기</button>';
   r.querySelector('button').onclick=()=>{try{sfx('tap')}catch(e){}x.go()};b.appendChild(r)});
  arrow();clampPos()}
}catch(e){}}
setInterval(pop,1500);setTimeout(pop,800);
}catch(e){console.warn('survivor',e)}})();
