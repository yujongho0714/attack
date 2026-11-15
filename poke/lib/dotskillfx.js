/* DotSkillFX — 도트 스킬 이펙트 엔진 (18속성 × 도트/검기 × 탄·빔·참격·광역·필살 × 홀드 다단히트)
 * 환생(0~6): 연기가 점점 늘어남 / 각성(별 0~6): 스파이크가 솟고 연기는 사라짐
 *
 * 게임 적용:
 *   lib/dotskillfx.js 를 script 태그로 불러오기
 *   const fx = DotSkillFX.create({px:3});
 *   차징: const c = fx.charge({...cast와 같은 옵션, full:true, onLevel:n=>{}, onFire:n=>{}}); ... c.release();
 *        full:true = 끝까지(MAX) 눌러야 발사, 중간에 떼면 불발(onFire(0)) / full 생략 = Lv1~3 중간에 떼도 발사
 *   캐릭터 오라: DotSkillFX.aura(ctx, x, y, 캐릭터크기, 환생수, 각성수, 초단위시간, [주색,밝은색,어두운색]);  // 각성>0이면 스파이크(연기 없음), 아니면 환생 연기
 *   별 표시: DotSkillFX.stars(ctx, x, y, 환생수, 각성수, {px:3});  // 2.5D 별 6칸, 매 프레임 호출 (각성=이중테두리 보라, 환생=노랑)
 *               // px = 도트 1칸의 화면 픽셀 크기
 *   fx.cast({type:'FIRE', style:'blade', kind:'slash', from:{x,y}, to:{x,y}, rebirth:3, awake:0, lv:2, onHit:p=>{}});
 *   const h = fx.hold({type:'WATER', style:'dot', from, to, rebirth, awake, interval:.12, onHit:(n,p)=>{}, onFinish:n=>{}});
 *   h.release();                                      // 손 떼면 마무리 일격(5히트 이상)
 *   매 프레임: fx.update(dt); fx.draw(ctx);           // 게임 그리기 맨 위에 한 번
 */
(function(G){'use strict';
const TAU=Math.PI*2,rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.random()*a.length|0],cl=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,u)=>a+(b-a)*u,eo=u=>1-(1-u)*(1-u);
// 속성: [이름, 부제, 팔레트(어두움→밝음), 모티프1, 모티프2, 형 이름 3개, 참격 패턴, 특성]
const TY={
NORMAL:['노말','노말 기세',['#7a3a10','#e0701a','#ffc03a','#fff6d0'],'spark','swirl',['일섬','연속 베기','필살 · 일섬'],'x',''],
FIRE:['불꽃','화염 기세',['#6a1010','#e0321a','#ff9a2a','#ffe89a'],'flame','spark',['불꽃 베기','화염 연무','필살 · 업화'],'x',''],
WATER:['물','파도 기세',['#102a6a','#2a6ae0','#5ac8ff','#e8fbff'],'drop','swirl',['물결 베기','소용돌이','필살 · 해일'],'c',''],
GRASS:['풀','신록 기세',['#1c5a2c','#46b84a','#a6ec6a','#f4ffd0'],'petal','swirl',['잎새 베기','꽃보라','필살 · 만개'],'f',''],
ELECTRIC:['전기','번개 기세',['#6a5a00','#f0c800','#fff04a','#ffffff'],'bolt','spark',['뇌광 일섬','뇌격','필살 · 신뢰'],'l','j'],
ICE:['얼음','서리 기세',['#2a5a7a','#7ad0f0','#c8f4ff','#ffffff'],'shard','swirl',['서리 베기','눈보라','필살 · 빙결'],'f',''],
FIGHTING:['격투','투지 기세',['#5a1a10','#c04028','#f08a50','#ffe0c0'],'spark','shard',['맹호 일격','질주','필살 · 파쇄'],'l',''],
POISON:['독','맹독 기세',['#2a1a4a','#7a3aa8','#b8e04a','#f4ffc0'],'wisp','drop',['독니 베기','독안개','필살 · 독룡'],'x','w'],
GROUND:['땅','대지 기세',['#4a3016','#a87a3a','#e0b868','#fff0c8'],'shard','swirl',['지진 베기','대지 가르기','필살 · 지맥'],'x',''],
FLYING:['비행','질풍 기세',['#2a5a4a','#5ac8a8','#b8f4e0','#ffffff'],'swirl','petal',['선풍 베기','질풍','필살 · 폭풍'],'c',''],
PSYCHIC:['에스퍼','염력 기세',['#5a1a4a','#d83a9a','#ff8ad0','#ffe8f8'],'wisp','spark',['파동 베기','굉음','필살 · 심연'],'c','j'],
BUG:['벌레','벌레 기세',['#2a4a1a','#7ac03a','#c0f060','#f8ffd0'],'spark','wisp',['나비 베기','독침 연무','필살 · 독침'],'l',''],
ROCK:['바위','바위 기세',['#3a3a4a','#8a8a9a','#c8c0a8','#f4f0e0'],'shard','spark',['암석 베기','낙석','필살 · 거암'],'x',''],
GHOST:['고스트','달빛 기세',['#2a1038','#7a2a9a','#d08aff','#f4e4ff'],'wisp','swirl',['달 베기','초승달','필살 · 보름달'],'f','i'],
DRAGON:['드래곤','용의 기세',['#0e2a5a','#2a5ae0','#ffb02a','#fff2c0'],'flame','bolt',['용아','용린','필살 · 승룡'],'c',''],
DARK:['악','그림자 기세',['#08080e','#3a3a4a','#e03a3a','#ffb0b0'],'wisp','shard',['그림자 베기','흑월','필살 · 월식'],'x','i'],
STEEL:['강철','강철 기세',['#3a4a5a','#8a9aaa','#d0e0f0','#ffffff'],'spark','shard',['철 베기','강철 연격','필살 · 철검'],'l',''],
FAIRY:['페어리','요정 기세',['#8a2a5a','#ff6aa8','#ffb0d8','#fff0f8'],'petal','spark',['꽃빛 베기','연심','필살 · 달빛'],'f','']
};
const SM=['#9a9aa8','#6a6a78','#44444f'],KINDS=['shot','beam','slash','area','ult'];

function create(opt){
const E={px:(opt&&opt.px)||3,P:[],Q:[],shake:0,flash:0,stop:0,banner:null,TY,KINDS};
const add=o=>(E.P.push(o),o);
E.add=add;E.after=(d,fn)=>E.Q.push({d,fn});

function mkq(o){const t=TY[o.type]?o.type:'NORMAL',aw=+o.awake||0,rb=+o.rebirth||0,k=o.style==='blade';
 const q={type:t,T:TY[t],p:TY[t][2],k,kind:o.kind||'shot',a:o.from,b:o.to,rb,aw,lv:cl(o.lv||1,1,3),
  S:(1+Math.min(rb,6)*.1)*(aw?1+Math.min(aw,6)*.07+.2:1)*(o.scale||1),smoke:aw?0:rb*.2,
  onHit:o.onHit,onFinish:o.onFinish};q.dir=Math.atan2(q.b.y-q.a.y,q.b.x-q.a.x);return q}

/* ---------- 모티프 입자 ---------- */
function mo(m,x,y,q,o){o=o||{};const p=q.p,S=q.S,v=o.v||1,n=o.n||1,s=E.px;
 for(let i=0;i<n;i++)switch(m){
 case'flame':add({q,x:x+rnd(-4,4)*s,y,vx:rnd(-20,20),vy:rnd(-90,-40)*v,g:-30,life:rnd(.35,.7),s0:rnd(2,4)*S,s1:0,ramp:1,add:1});break;
 case'drop':add({x,y,vx:rnd(-80,80)*v,vy:rnd(-130,-30)*v,g:280,life:rnd(.4,.7),s0:rnd(1.5,2.6)*S,s1:1,c:pick([p[2],p[3],p[2]])});break;
 case'bolt':bolt(x,y,x+rnd(-22,22)*s*S,y+rnd(-22,22)*s*S,q,.14,3);break;
 case'petal':add({x,y,vx:rnd(-50,50)*v,vy:rnd(-70,-10)*v,g:35,wob:1,life:rnd(.7,1.2),s0:rnd(1.5,2.6)*S,s1:1,c:pick([p[2],p[3],p[1]])});break;
 case'shard':{const a=rnd(0,TAU),sp=rnd(40,150)*v;add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-50,g:320,life:rnd(.4,.8),s0:rnd(2,3.4)*S,s1:1,c:pick([p[1],p[2],p[3]])})}break;
 case'wisp':add({x:x+rnd(-5,5)*s,y,vx:rnd(-15,15),vy:rnd(-55,-15)*v,wob:1,life:rnd(.6,1.1),s0:rnd(2,3.6)*S,s1:0,c:pick([p[2],p[1]]),add:1});break;
 case'swirl':add({x,y,orb:{cx:x,cy:y,r0:rnd(2,6)*s,r1:rnd(14,26)*s*S,w:rnd(7,12)*(Math.random()<.5?1:-1),a0:rnd(0,TAU)},life:rnd(.4,.7),s0:rnd(1.5,2.6)*S,s1:0,c:pick([p[2],p[3]]),add:1});break;
 default:{const a=rnd(0,TAU),sp=rnd(60,200)*v;add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,drag:3,life:rnd(.2,.4),s0:rnd(1.5,3)*S,s1:0,c:p[3],add:1,sh:'+'})}}}
function smoke(x,y,q,n){let k=q.smoke*(n||1),c=k|0;if(Math.random()<k-c)c++;const s=E.px;
 for(let i=0;i<c;i++)add({x:x+rnd(-3,3)*s,y:y+rnd(-2,2)*s,vx:rnd(-14,14),vy:rnd(-40,-12),g:-6,life:rnd(.8,1.5),s0:rnd(2,3)*q.S,s1:(4+q.rb*.9)*q.S,sh:'puff',z:0,a0:.6})}
function bolt(x0,y0,x1,y1,q,life,w){const s=E.px,n=Math.max(3,Math.hypot(x1-x0,y1-y0)/(s*5)|0),pts=[];
 for(let i=0;i<=n;i++){const u=i/n,j=(i&&i<n)?rnd(-4,4)*s:0;pts.push([lerp(x0,x1,u)+j,lerp(y0,y1,u)+(i&&i<n?rnd(-4,4)*s:0)])}
 add({k:'bolt',pts,life:life||.2,w:w||2,q})}
function ring(x,y,r1,q,life,ry){add({k:'ring',x,y,r1:r1*E.px*q.S,ry:ry||.5,life:life||.4,q})}
function spikes(x,y,q,n,len,life){n=n||(4+q.aw*2);for(let i=0;i<n;i++)add({k:'spike',x,y,ang:i/n*TAU+rnd(-.2,.2),len:len*E.px*q.S*rnd(.7,1.2),w:rnd(2,3.5)*q.S,life:life||.45,q,z:1})}
function txt(x,y,s,col,sz,life){add({k:'txt',x,y,s,col,sz:sz||5,life:life||.8,z:2})}

/* ---------- 충돌/타격 ---------- */
function impact(x,y,q,big,quiet){const p=q.p,n=(big?26:14)*q.S|0;
 mo(q.T[3],x,y,q,{n,v:big?1.6:1});mo(q.T[4],x,y,q,{n:n>>1,v:big?1.6:1});
 ring(x,y,big?30:18,q,big?.55:.4);if(big)ring(x,y,44,q,.7,.4);
 add({x,y,life:.12,s0:(big?14:8)*q.S,s1:0,c:p[3],add:1,z:1});
 if(q.aw)spikes(x,y,q,0,big?26:16);
 if(q.smoke)for(let i=0;i<(big?7:3);i++)smoke(x+rnd(-8,8)*E.px,y,q,2);
 if(!quiet){E.shake=Math.max(E.shake,big?3:1.4);E.stop=Math.max(E.stop,big?.09:.035);if(big)E.flash=Math.max(E.flash,.5)}
 q.onHit&&q.onHit({x,y},big)}

/* ---------- 참격 호 ---------- */
function arc(q,bx,by,phi,span,R,th,delay,rev,life){const s=E.px,r=R*s*q.S,c={x:bx-Math.cos(phi)*r*.9,y:by-Math.sin(phi)*r*.9};
 const f=()=>add({k:'arc',cx:c.x,cy:c.y,r,a0:rev?phi+span:phi-span,a1:rev?phi-span:phi+span,th:th*q.S,life:life||.38,q,z:1});
 delay?E.after(delay,f):f()}
function slashSet(q,x,y,lv,scale){const pt=q.T[6],k=q.k,th=(k?7:4)*(scale||1),R=(k?30:22)*(scale||1),b=q.dir,d=.075;
 const A=(phi,sp,r,t,dl,rv)=>arc(q,x,y,phi,sp,r,t,dl,rv);
 if(pt==='x'){A(b-.9,.95,R,th,0);if(lv>1)A(b+Math.PI+.9,.95,R,th,d);if(lv>2)A(b-Math.PI/2,.8,R*1.3,th*1.2,d*2)}
 else if(pt==='c'){A(b-.6,2.3,R*.8,th,0);if(lv>1)A(b+2.4,2.2,R*.5,th*.8,d,1);if(lv>2)A(b-1.2,1.6,R*1.2,th*1.2,d*2)}
 else if(pt==='l'){const n=lv>1?3:1;for(let i=0;i<n;i++){const o=(i-(n-1)/2)*9*E.px*q.S*(scale||1),px=x-Math.sin(b-.5)*o,py=y+Math.cos(b-.5)*o;arc(q,px,py,b-.5,.36,R*2.3,th*.9,i*d)}if(lv>2)A(b+1.2,.4,R*2.4,th*1.2,d*3)}
 else{const n=2+lv;for(let i=0;i<n;i++)A(b+i*TAU/n+.5,.8,R*.7,th*.9,i*d)}
 E.after(d*(lv>1?2:1)+.12,()=>impact(x,y,q,false))}

/* ---------- 발동 ---------- */
const CAST={
shot(q){add({k:'orb',x:q.a.x,y:q.a.y,t:0,life:.5,q,z:1})},
beam(q){if(q.k){const h=hold(q,{auto:.9,interval:.07});return}add({k:'beam',life:.8,q,z:1,tick:0})},
slash(q){slashSet(q,q.b.x,q.b.y,q.lv,1)},
area(q){const{x,y}=q.b,s=E.px;ring(x,y,26,q,.5);ring(x,y,40,q,.7,.4);
 add({k:'em',life:.7,q,z:1,fn(dt,e){mo(q.T[3],x+rnd(-24,24)*s*q.S,y,q,{n:2,v:1.5});if(Math.random()<.5)mo(q.T[4],x+rnd(-24,24)*s*q.S,y,q,{v:1.2});
  if(q.T[3]==='bolt'&&Math.random()<.4)bolt(x+rnd(-26,26)*s,y-110*s,x+rnd(-26,26)*s,y,q,.2,3);if(q.smoke)smoke(x+rnd(-20,20)*s,y,q,1);if(q.aw&&Math.random()<.12)spikes(x+rnd(-24,24)*s,y,q,1,rnd(14,26),.4)}});
 E.after(.05,()=>impact(x,y,q,false))},
ult(q){const{x,y}=q.a,s=E.px,p=q.p;
 add({k:'em',life:.55,q,z:1,fn(){const a=rnd(0,TAU),r=rnd(30,60)*s,l=.3;add({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,vx:-Math.cos(a)*r/l,vy:-Math.sin(a)*r/l,life:l,s0:2.5*q.S,s1:1,c:p[3],add:1})}});
 if(q.aw)spikes(x,y,q,6+q.aw,22,.55);E.flash=Math.max(E.flash,.25);
 E.after(.58,()=>{E.banner={t:0,life:1.4,s:q.T[5][2],b:q.T[1],p};E.flash=.9;E.shake=5;E.stop=.12;
  if(q.k){slashSet(q,q.b.x,q.b.y,3,1.7);E.after(.2,()=>{arc(q,q.b.x,q.b.y,q.dir+Math.PI/2,1.1,40,13,0);impact(q.b.x,q.b.y,q,true)})}
  else{add({k:'beam',life:1,q,z:1,w:3.4,tick:0});E.after(.15,()=>impact(q.b.x,q.b.y,q,true));E.after(.5,()=>impact(q.b.x,q.b.y,q,true,true))}})}
};

/* ---------- 홀드 다단히트 ---------- */
function hold(q,o){const h={n:0,q,alive:true,auto:o.auto||0,iv:o.interval||.12,acc:0,t:0,onHit:o.onHit,onFinish:o.onFinish,
 release(){if(!h.alive)return;h.alive=false;if(h.n>=5)fin();else h.onFinish&&h.onFinish(h.n)},stop(){h.alive=false}};
 function fin(){const{x,y}=q.b,q2=Object.assign({},q,{S:q.S*1.4});
  E.banner={t:0,life:1,s:h.n+' HIT',b:q.T[5][1],p:q.p};E.flash=.6;E.shake=4;E.stop=.1;
  if(q.k){slashSet(q2,x,y,3,1.3);E.after(.25,()=>impact(x,y,q2,true))}else{impact(x,y,q2,true);ring(x,y,46,q2,.8)}
  h.onFinish&&h.onFinish(h.n)}
 function tick(){h.n++;const s=E.px,g=1+Math.min(h.n,24)*.05,qq=Object.assign({},q,{S:q.S*g}),x=q.b.x+rnd(-12,12)*s,y=q.b.y+rnd(-12,12)*s;
  if(q.k)arc(qq,x,y,rnd(0,TAU),rnd(.5,.9),rnd(13,22),3+Math.min(h.n,16)*.18,0,Math.random()<.5,.26);
  else{add({x,y,life:.1,s0:8*qq.S,s1:0,c:q.p[3],add:1,z:1});ring(x,y,12,qq,.25)}
  mo(q.T[3],x,y,qq,{n:4,v:1.3});mo(q.T[4],x,y,qq,{n:2});if(q.smoke)smoke(x,y,q,2);if(q.aw&&h.n%3==0)spikes(x,y,q,3,12,.3);
  E.shake=Math.max(E.shake,.5+Math.min(h.n,20)*.05);if(h.n%5==0){E.stop=Math.max(E.stop,.03);txt(x,y-14*s,h.n+'',q.p[3],5+Math.min(h.n,15)*.2,.6)}
  q.onHit&&q.onHit({x,y},false,h.n);h.onHit&&h.onHit(h.n,{x,y})}
 add({k:'hold',h,q,life:1e9,z:1,tick});return h}

function charge(q,o){const h={t:0,lv:1,alive:true,release(){if(!h.alive)return;h.alive=false;const lv=h.lv;if(o.full&&lv<3){for(let i=0;i<8;i++)mo(q.T[3],q.a.x,q.a.y,q,{});txt(q.a.x,q.a.y-24*E.px,'끝까지!',q.p[2],5,.8);E.shake=.6;o.onFire&&o.onFire(0);return}const q2=Object.assign({},q,{lv:Math.min(3,lv),S:q.S*(1+(lv-1)*.35)});
  E.shake=1+lv;E.flash=Math.max(E.flash,.12*lv);(CAST[q.kind]||CAST.shot)(q2);o.onFire&&o.onFire(lv)},stop(){h.alive=false}};
 add({k:'chg',h,q,life:1e9,z:1,o});return h}
E.charge=o=>{const q=mkq(Object.assign({},o,{onFire:null,onLevel:null}));return charge(q,o)};
E.cast=o=>{const q=mkq(o);(CAST[q.kind]||CAST.shot)(q)};
E.hold=o=>{const q=mkq(Object.assign({},o,{onHit:null,onFinish:null}));return hold(q,o)};
E.clear=()=>{E.P.length=0;E.Q.length=0;E.banner=null;E.flash=0};
E.busy=()=>E.P.length>0||E.Q.length>0;

/* ---------- 업데이트 ---------- */
E.update=function(dt){dt=Math.min(dt,.05);E.shake=Math.max(0,E.shake-dt*9);E.flash=Math.max(0,E.flash-dt*2.2);
 if(E.banner&&(E.banner.t+=dt)>E.banner.life)E.banner=null;
 if(E.stop>0){E.stop-=dt;return}
 for(let i=E.Q.length-1;i>=0;i--){const e=E.Q[i];if((e.d-=dt)<=0){E.Q.splice(i,1);e.fn()}}
 const P=E.P,s=E.px;
 for(let i=P.length-1;i>=0;i--){const e=P[i];e.t=(e.t||0)+dt;const u=e.t/e.life;
  if(e.k==='hold'){const h=e.h;if(!h.alive){P.splice(i,1);continue}h.t+=dt;h.acc+=dt;while(h.acc>=h.iv){h.acc-=h.iv;e.tick()}
   if(h.auto&&h.t>=h.auto)h.release();
   if(!e.q.k&&Math.random()<.7)mo(e.q.T[3],lerp(e.q.a.x,e.q.b.x,Math.random()),lerp(e.q.a.y,e.q.b.y,Math.random()),e.q,{});continue}
  if(e.k==='chg'){const h=e.h,q=e.q;if(!h.alive){P.splice(i,1);continue}h.t+=dt;const lv=1+(h.t>.55)+(h.t>1.3);
   if(lv>h.lv){h.lv=lv;ring(q.a.x,q.a.y,16+lv*8,q,.45);txt(q.a.x,q.a.y-26*s,lv>2?'MAX!':'LV'+lv,q.p[3],lv>2?8:6,.8);E.flash=Math.max(E.flash,lv>2?.35:.12);if(lv>2)E.shake=3;if(q.aw)spikes(q.a.x,q.a.y,q,0,10+lv*4,.4);e.o.onLevel&&e.o.onLevel(lv)}
   const a=rnd(0,TAU),r=rnd(24,46)*s*(.7+lv*.25),l=.28;add({x:q.a.x+Math.cos(a)*r,y:q.a.y+Math.sin(a)*r,vx:-Math.cos(a)*r/l,vy:-Math.sin(a)*r/l,life:l,s0:2*q.S,s1:1,c:q.p[3],add:1});
   if(Math.random()<.5)mo(q.T[q.k?4:3],q.a.x,q.a.y,q,{v:.5});smoke(q.a.x,q.a.y+4*s,q,1);if(lv>1)E.shake=Math.max(E.shake,.4*lv);continue}
  if(u>=1){P.splice(i,1);continue}
  if(e.k==='orb'){const q=e.q,v=Math.pow(u,1.4);e.x=lerp(q.a.x,q.b.x,v);e.y=lerp(q.a.y,q.b.y,v);
   mo(q.T[3],e.x,e.y,q,{n:2,v:.5});if(Math.random()<.5)mo(q.T[4],e.x,e.y,q);smoke(e.x,e.y,q,1.5);if(q.aw&&Math.random()<.5)spikes(e.x,e.y,q,1,8,.22);
   if(u>.97){P.splice(i,1);impact(q.b.x,q.b.y,q,q.lv>2)}continue}
  if(e.k==='beam'){const q=e.q;e.tick-=dt;if(e.tick<=0){e.tick=.09;impact(q.b.x,q.b.y,q,false,true)}
   for(let j=0;j<2;j++){const v=Math.random();mo(q.T[3],lerp(q.a.x,q.b.x,v),lerp(q.a.y,q.b.y,v),q,{})}smoke(q.b.x,q.b.y,q,1);continue}
  if(e.k==='arc'){const q=e.q,hd=Math.min(1,u/.45),a=lerp(e.a0,e.a1,hd);
   if(u<.5){const X=e.cx+Math.cos(a)*e.r,Y=e.cy+Math.sin(a)*e.r;mo(q.T[3],X,Y,q,{n:1,v:.6});if(Math.random()<.4)mo(q.T[4],X,Y,q);smoke(X,Y,q,.6);if(q.aw&&Math.random()<.18)spikes(X,Y,q,1,9,.22)}continue}
  if(e.k==='em'){e.fn(dt,e);continue}
  if(e.k)continue;
  if(e.orb){const o=e.orb,r=lerp(o.r0,o.r1,u),a=o.a0+o.w*e.t;e.x=o.cx+Math.cos(a)*r;e.y=o.cy+Math.sin(a)*r*.5-u*14*s;continue}
  if(e.drag){const f=Math.max(0,1-e.drag*dt);e.vx*=f;e.vy*=f}
  e.vy+=(e.g||0)*dt;if(e.wob)e.vx+=Math.sin(e.t*9+e.life*7)*60*dt;e.x+=e.vx*dt;e.y+=e.vy*dt}};

/* ---------- 그리기 ---------- */
let c,cs;
const snap=v=>Math.round(v/cs)*cs;
function sq(x,y,n,col){n=Math.max(1,Math.round(n));const h=(n>>1)*cs;c.fillStyle=col;c.fillRect(snap(x)-h,snap(y)-h,n*cs,n*cs)}
function lineD(x0,y0,x1,y1,w,col,jit,t){const n=Math.max(1,Math.hypot(x1-x0,y1-y0)/cs|0),nx=-(y1-y0),ny=x1-x0,l=Math.hypot(nx,ny)||1;
 for(let i=0;i<=n;i++){const u=i/n,o=jit?Math.sin(i*.45+t*40)*jit*cs:0,tp=Math.sin(Math.PI*Math.min(1,u*6+.0))*0+1;sq(lerp(x0,x1,u)+nx/l*o,lerp(y0,y1,u)+ny/l*o,w*tp,col)}}
function arcSeg(q,cx,cy,r,a0,a1,th,tail,head,al){const T=q.T,p=q.p,N=Math.max(8,(r*Math.abs(a1-a0)*(head-tail))/cs|0),inv=T[7].includes('i'),jt=T[7].includes('j'),wg=T[7].includes('w');
 c.globalAlpha=al;
 for(let k=0;k<=N;k++){const u=lerp(tail,head,k/N),up=k/N,w=th*Math.pow(Math.sin(Math.PI*Math.min(1,up*.92+.04)),.8),ang=lerp(a0,a1,u);
  let rr=r+(wg?Math.sin(u*22)*2.2*cs:0)+(jt?rnd(-1.6,1.6)*cs:0);
  for(let o=-w;o<=w;o+=1){const f=w?Math.abs(o)/w:0,col=inv?(f<.45?p[0]:f<.75?p[1]:p[2]):(f<.3?p[3]:f<.62?p[2]:f<.88?p[1]:p[0]);
   const R=rr+o*cs;c.fillStyle=col;c.fillRect(snap(cx+Math.cos(ang)*R),snap(cy+Math.sin(ang)*R),cs,cs)}
  if(inv&&w>2){const R=rr+w*cs;c.fillStyle=p[3];c.fillRect(snap(cx+Math.cos(ang)*R),snap(cy+Math.sin(ang)*R),cs,cs)}}
 c.globalAlpha=1}
function disk(x,y,r,col){x=snap(x);y=snap(y);c.fillStyle=col;for(let dy=-r;dy<=r;dy++){const w=Math.round(Math.sqrt(r*r-dy*dy));c.fillRect(x-w*cs,y+dy*cs,(w*2+1)*cs,cs)}}
function draw1(e){const t=e.t||0,u=t/e.life,q=e.q;
 switch(e.k){
 case'arc':{const tp=u,head=Math.min(1,tp/.45),tail=tp<.3?0:(tp-.3)/.7;if(tail>=head)return;arcSeg(q,e.cx,e.cy,e.r,e.a0,e.a1,e.th,tail*head,head,1-Math.max(0,u-.6)*1.6);return}
 case'orb':{const p=q.p,r=Math.round(4*q.S);
  if(q.k){const R=14*cs*q.S;arcSeg(q,e.x-Math.cos(q.dir)*R*.9,e.y-Math.sin(q.dir)*R*.9,R,q.dir-.95,q.dir+.95,4*q.S,0,1,1)}
  else{c.globalAlpha=.25;c.globalCompositeOperation='lighter';disk(e.x,e.y,r+3,p[1]);c.globalCompositeOperation='source-over';c.globalAlpha=1;disk(e.x,e.y,r+1,p[0]);disk(e.x,e.y,r,p[1]);disk(e.x-cs,e.y-cs,Math.max(1,r*.65|0),p[2]);disk(e.x-cs,e.y-cs,Math.max(1,r*.3|0),p[3])}return}
 case'chg':{const p=q.p,lv=e.h.lv,r=Math.round((2+lv*2.2)*q.S+Math.sin(t*14)),x=q.a.x,y=q.a.y;c.globalAlpha=.25;c.globalCompositeOperation='lighter';disk(x,y,r+3,p[1]);c.globalCompositeOperation='source-over';c.globalAlpha=1;disk(x,y,r+1,p[0]);disk(x,y,r,p[1]);disk(x-cs,y-cs,Math.max(1,r*.65|0),p[2]);disk(x-cs,y-cs,Math.max(1,r*.3|0),p[3]);return}
 case'beam':{const p=q.p,w=(e.w||2)*q.S,j=q.T[7].includes('j')?2:q.T[7].includes('w')?1.5:.8,al=1-Math.max(0,u-.7)*3.3;c.globalAlpha=Math.max(0,al);
  const ex=lerp(q.a.x,q.b.x,Math.min(1,u*6)),ey=lerp(q.a.y,q.b.y,Math.min(1,u*6));
  lineD(q.a.x,q.a.y,ex,ey,w*2.6,p[0],j,t);lineD(q.a.x,q.a.y,ex,ey,w*1.9,p[1],j,t);lineD(q.a.x,q.a.y,ex,ey,w*1.1,p[2],j*.6,t);lineD(q.a.x,q.a.y,ex,ey,w*.45,p[3],0,t);c.globalAlpha=1;return}
 case'ring':{const r=e.r1*eo(u),p=q.p;c.globalAlpha=1-u;const n=Math.max(10,r*TAU/cs/1.4|0);
  for(let i=0;i<n;i++){const a=i/n*TAU;sq(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r*e.ry,Math.max(1,3*(1-u)),i%3?p[2]:p[3])}c.globalAlpha=1;return}
 case'bolt':{const p=q.p;c.globalAlpha=1-u*.6;for(let i=1;i<e.pts.length;i++){const a=e.pts[i-1],b=e.pts[i];lineD(a[0],a[1],b[0],b[1],e.w+1,p[1],0,0);lineD(a[0],a[1],b[0],b[1],Math.max(1,e.w-1),p[3],0,0)}c.globalAlpha=1;return}
 case'spike':{const g=u<.3?eo(u/.3):1-Math.pow((u-.3)/.7,2),L=e.len*g,p=q.p,ca=Math.cos(e.ang),sa=Math.sin(e.ang),n=Math.max(2,L/cs|0);
  for(let i=0;i<n;i++){const f=i/n,w=Math.round(e.w*(1-f)),x=e.x+ca*L*f,y=e.y+sa*L*f;
   for(let o=-w;o<=w;o++){const col=Math.abs(o)===w?p[0]:o===0?p[3]:o<0?p[1]:p[2];c.fillStyle=col;c.fillRect(snap(x-sa*o*cs),snap(y+ca*o*cs),cs,cs)}}return}
 case'txt':{c.globalAlpha=1-u*u;c.font='bold '+Math.round(e.sz*cs)+'px monospace';c.textAlign='center';c.lineWidth=cs;c.strokeStyle='#000';c.strokeText(e.s,e.x,e.y-u*18*cs);c.fillStyle=e.col;c.fillText(e.s,e.x,e.y-u*18*cs);c.globalAlpha=1;return}}
 if(e.k)return;
 const sz=Math.max(0,lerp(e.s0,e.s1,u)),n=Math.round(sz);if(n<1)return;
 if(e.sh==='puff'){c.globalAlpha=lerp(e.a0,0,u);const col=SM[Math.min(2,u*3|0)],h=Math.max(1,n>>1);sq(e.x,e.y,n,col);sq(e.x-h*cs,e.y+cs,h+1,col);sq(e.x+h*cs,e.y,h+1,col);sq(e.x,e.y-h*cs,h+1,SM[0]);c.globalAlpha=1;return}
 const col=e.ramp?(TYP[3-Math.min(3,u*4|0)]):e.c;
 if(e.add){c.globalCompositeOperation='lighter';if(n>=2){c.globalAlpha=.16;sq(e.x,e.y,n+3,col)}c.globalAlpha=1}
 if(e.sh==='+'){sq(e.x,e.y,1,col);sq(e.x+cs,e.y,1,col);sq(e.x-cs,e.y,1,col);sq(e.x,e.y+cs,1,col);sq(e.x,e.y-cs,1,col)}else sq(e.x,e.y,n,col);
 if(e.add)c.globalCompositeOperation='source-over'}
let TYP=TY.FIRE[2];
E.draw=function(ctx){c=ctx;cs=E.px;ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.translate(Math.round(rnd(-1,1)*E.shake)*cs,Math.round(rnd(-1,1)*E.shake)*cs);
 for(const z of[0,1,2])for(const e of E.P){if((e.z===undefined?1:e.z)!==z||e.k==='hold'||e.k==='em')continue;
  if(e.ramp)TYP=e.q.p;draw1(e)}
 ctx.restore();ctx.globalAlpha=1;
 const W=ctx.canvas.width,H=ctx.canvas.height;
 if(E.flash>0){ctx.fillStyle='rgba(255,255,255,'+Math.min(.85,E.flash)+')';ctx.fillRect(0,0,W,H)}
 const b=E.banner;if(b){const u=b.t/b.life,a=u<.15?u/.15:u>.7?(1-u)/.3:1;ctx.save();ctx.globalAlpha=a;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,H*.36,W,cs*18);ctx.fillStyle=b.p[2];ctx.fillRect(0,H*.36,W,cs);ctx.fillRect(0,H*.36+cs*17,W,cs);
  ctx.textAlign='center';ctx.font='bold '+cs*9+'px monospace';ctx.lineWidth=cs*2;ctx.strokeStyle=b.p[0];ctx.strokeText(b.s,W/2+(1-a)*40,H*.36+cs*11);ctx.fillStyle=b.p[3];ctx.fillText(b.s,W/2+(1-a)*40,H*.36+cs*11);
  ctx.font='bold '+cs*4+'px monospace';ctx.fillStyle=b.p[2];ctx.fillText(b.b,W/2,H*.36+cs*5.5);ctx.restore()}};
return E}

/* ---------- 2.5D 도트 별 (환생=노랑 / 각성=이중테두리 보라 / off=빈 칸) ---------- */
const SC={rebirth:{o:'#5a3000',L:'#ffe45a',D:'#e09a00',H:'#fffbd0',X:'#3a2000',G:'255,215,60'},
 awake:{o:'#14083a',o2:'#efe0ff',L:'#c090ff',D:'#6a2ad8',H:'#ffffff',X:'#220e55',G:'170,110,255'},
 off:{o:'#222230',L:'#3a3a4c',D:'#2a2a38',H:'#4a4a5c',X:'#16161f',G:null}},SPR={};
function starSpr(kind){if(SPR[kind])return SPR[kind];const C=SC[kind],aw=kind==='awake',dp=aw?2:1,N=aw?19:15,cx=(N-1)/2-dp/2,cy=cx+.4,R=cx-.2,pts=[];
 for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?R*.45:R;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r])}
 const inside=(x,y)=>{let w=false;for(let i=0,j=9;i<10;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])w=!w}return w};
 const M=[],E1=[],E2=[],g=(A,x,y)=>!!(A[y]&&A[y][x]);
 for(let y=0;y<N;y++){M[y]=[];for(let x=0;x<N;x++)M[y][x]=inside(x,y)}
 const er=(A,x,y)=>g(A,x,y)&&g(A,x-1,y)&&g(A,x+1,y)&&g(A,x,y-1)&&g(A,x,y+1);
 for(let y=0;y<N;y++){E1[y]=[];for(let x=0;x<N;x++)E1[y][x]=er(M,x,y)}
 for(let y=0;y<N;y++){E2[y]=[];for(let x=0;x<N;x++)E2[y][x]=er(E1,x,y)}
 const L=[],EX=[],seen={};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(M[y][x]){let col,k;
  if(!E1[y][x]){col=C.o;k=1}else if(aw&&!E2[y][x]){col=C.o2;k=2}
  else{const th=((Math.atan2(y-cy,x-cx)+Math.PI/2)%TAU+TAU)%TAU,sc=Math.floor(th/(Math.PI/5)),d=Math.hypot(x-cx,y-cy);col=d<R*.22?C.H:(sc&1)?C.L:C.D;k=3}
  L.push({x,y,col,k});
  for(let d=1;d<=dp;d++){const X=x+d,Y=y+d;if(X<N&&Y<N&&!M[Y][X]&&!seen[Y*99+X]){seen[Y*99+X]=1;EX.push({x:X,y:Y})}}}
 return SPR[kind]={N,L,EX,tip:pts[8],C}}
function dk(ctx,x,y,r,s){for(let dy=-r;dy<=r;dy++){const w=Math.round(Math.sqrt(r*r-dy*dy));ctx.fillRect(x-w*s,y+dy*s,(w*2+1)*s,s)}}
function star(ctx,x,y,kind,o){o=o||{};if(!SC[kind])kind='rebirth';const s=o.px||2,t=o.t!==undefined?o.t:performance.now()/1000,ph=o.ph||0,S=starSpr(kind),C=S.C,N=S.N,ox=Math.round(x-N*s/2),oy=Math.round(y-N*s/2),on=kind!=='off';
 ctx.save();
 if(on){const a=.1+.07*Math.sin(t*1.5+ph),cx=ox+N*s/2,cy=oy+N*s/2;ctx.globalCompositeOperation='lighter';
  for(const f of[.62,.85,1.1]){ctx.fillStyle='rgba('+C.G+','+a.toFixed(3)+')';dk(ctx,Math.round(cx/s)*s,Math.round(cy/s)*s,Math.round(N*.5*f),s)}ctx.globalCompositeOperation='source-over'}
 ctx.fillStyle=C.X;for(const p of S.EX)ctx.fillRect(ox+p.x*s,oy+p.y*s,s,s);
 const sp=((t*.4+ph*.3)%2)*N*2.2-N*.6;
 for(const p of S.L){ctx.fillStyle=p.col;ctx.fillRect(ox+p.x*s,oy+p.y*s,s,s);
  if(on&&p.k>1){const d=Math.abs(p.x+p.y-sp);if(d<2.6){ctx.globalAlpha=(1-d/2.6)*.7;ctx.fillStyle='#fff';ctx.fillRect(ox+p.x*s,oy+p.y*s,s,s);ctx.globalAlpha=1}}}
 const tw=(Math.sin(t*1.1+ph*3)+1)/2;
 if(on&&tw>.72){const k=(tw-.72)/.28,n=Math.max(1,Math.round(1+k*3)),px=ox+Math.round(S.tip[0])*s,py=oy+Math.round(S.tip[1])*s;ctx.globalAlpha=k;ctx.fillStyle='#fff';ctx.fillRect(px-n*s,py,(2*n+1)*s,s);ctx.fillRect(px,py-n*s,s,(2*n+1)*s);ctx.globalAlpha=1}
 ctx.restore()}
function stars(ctx,x,y,rb,aw,o){o=o||{};const s=o.px||2,gap=(starSpr('awake').N)*s+4,t=o.t!==undefined?o.t:performance.now()/1000;
 for(let i=0;i<6;i++)star(ctx,x+(i-2.5)*gap,y,i<aw?'awake':i<rb?'rebirth':'off',{px:s,t,ph:i*.9})}

/* ---------- 캐릭터 오라: 환생 = 도트 연기(환생 수만큼 늘어남) / 각성 = 도트 스파이크 (연기 없음) ---------- */
const AWD=['#9a4dff','#e0c8ff','#4b1a99'],SMK=['#a8a8b6','#7a7a8a','#4c4c5a'];
function spikeD(c,bx,by,ang,len,w0,p,pal){const ca=Math.cos(ang),sa=Math.sin(ang),n=Math.max(2,len/p|0);
 for(let i=0;i<n;i++){const f=i/n,w=Math.round(w0*(1-f)),x=bx+ca*len*f,y=by+sa*len*f;
  for(let o=-w;o<=w;o++){c.fillStyle=Math.abs(o)===w?pal[0]:o===0?pal[3]:o<0?pal[1]:pal[2];c.fillRect(Math.round((x-sa*o*p)/p)*p,Math.round((y+ca*o*p)/p)*p,p,p)}}}
function aura(c,x,y,S,rb,aw,T,A){if(!(aw>0||rb>0))return;const p=Math.max(2,Math.round(S/36)),R=S*.5,sn=v=>Math.round(v/p)*p;
 const B=(X,Y,n,col)=>{n=Math.max(1,Math.round(n));const h=(n>>1)*p;c.fillStyle=col;c.fillRect(sn(X)-h,sn(Y)-h,n*p,n*p)};
 c.save();
 if(aw>0){const A2=A||AWD,hh=(T*70)%360,rain=aw>=6,
   pal=rain?['hsl('+hh+',80%,18%)','hsl('+hh+',95%,52%)','hsl('+((hh+45)%360)+',100%,82%)','#fff']:[A2[2],A2[0],A2[1],'#fff'],n=6+aw*2;
  c.globalCompositeOperation='lighter';const g=c.createRadialGradient(x,y,R*.2,x,y,R*1.6);g.addColorStop(0,rain?'hsl('+hh+',95%,60%)':A2[0]);g.addColorStop(1,'rgba(0,0,0,0)');c.globalAlpha=.2;c.fillStyle=g;c.fillRect(x-R*1.7,y-R*1.7,R*3.4,R*3.4);
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  for(let k=0;k<n;k++){const ph=(T*.45+k*.618)%1,gr=ph<.22?1-Math.pow(1-ph/.22,2):ph<.7?1:1-Math.pow((ph-.7)/.3,2),
    ang=k/n*TAU+Math.sin(k*2.3)*.25+T*.12,len=S*(.28+.1*((k*7)%3)/2)*(1+aw*.05)*gr,w0=Math.max(2,Math.round(S*.045/p));
   if(len>p*2)spikeD(c,x+Math.cos(ang)*R*.55,y+Math.sin(ang)*R*.6,ang,len,w0,p,pal)}
  for(let k=0;k<4;k++){const ph=(T*.35+k*.27)%1;if(ph<.5){const a=Math.sin(ph/.5*Math.PI),gx=x+Math.cos(k*2.4+T*.2)*R*1.05,gy=y+Math.sin(k*1.7)*R*.9,L=Math.max(1,Math.round(1+a*2));
   c.globalAlpha=a;c.fillStyle='#fff';c.fillRect(sn(gx)-L*p,sn(gy),(2*L+1)*p,p);c.fillRect(sn(gx),sn(gy)-L*p,p,(2*L+1)*p)}}}
 else{const r=Math.min(rb,10),n=Math.min(18,3+r*2);
  for(let i=0;i<n;i++){const hs=((i*97+13)%100)/100,u=(T*(.28+.06*hs)+i/n+hs)%1,sd=i%2?1:-1,
    px=x+sd*R*(.25+.55*hs)*(.4+u*.9)+Math.sin(T*1.4+i*1.9)*R*.07,py=y+R*.8-u*R*(1.35+.2*hs),
    sz=2+r*.35+u*(3+r*.8);c.globalAlpha=Math.min(1,u*5)*Math.pow(1-u,1.1)*.62;
   const col=SMK[Math.min(2,u*3|0)],h2=Math.max(1,Math.round(sz)>>1);B(px,py,sz,col);B(px-h2*p,py+p,h2+1,col);B(px+h2*p,py,h2+1,col);B(px,py-h2*p,h2+1,SMK[0])}}
 c.restore()}

/* ---------- DOM용 2.5D 별 (게임 UI의 ★ 줄을 대체) ---------- */
const URLS={};
function starURL(kind){if(URLS[kind])return URLS[kind];const S=starSpr(kind),cv=document.createElement('canvas');cv.width=cv.height=S.N;const x=cv.getContext('2d');
 x.fillStyle=S.C.X;for(const p of S.EX)x.fillRect(p.x,p.y,1,1);for(const p of S.L){x.fillStyle=p.col;x.fillRect(p.x,p.y,1,1)}return URLS[kind]=cv.toDataURL()}
function starHTML(kind,i){if(!SC[kind])kind='rebirth';const u=starURL(kind);return '<i class="ds ds-'+kind+'" style="--m:url('+u+');--d:'+((i||0)*-.9).toFixed(1)+'s"><img src="'+u+'" alt=""></i>'}
if(typeof document!=='undefined'){const st=document.createElement('style');st.textContent=
'.aws .ds{position:relative;display:inline-block;width:15px;height:15px;line-height:0;font-style:normal}.aws .ds-awake{width:19px;height:19px}'+
'.ds img{width:100%;height:100%;display:block;image-rendering:pixelated}.ds-off{opacity:.5}'+
'.ds-awake img{animation:dsA 3.8s ease-in-out infinite var(--d)}.ds-rebirth img{animation:dsR 3.8s ease-in-out infinite var(--d)}'+
'@keyframes dsA{0%,100%{filter:drop-shadow(0 0 2px #9a4dff) brightness(1)}50%{filter:drop-shadow(0 0 6px #d0a0ff) brightness(1.3)}}'+
'@keyframes dsR{0%,100%{filter:drop-shadow(0 0 2px #ffc933) brightness(1)}50%{filter:drop-shadow(0 0 6px #fff09a) brightness(1.3)}}'+
'.ds-awake::after,.ds-rebirth::after{content:"";position:absolute;inset:0;-webkit-mask:var(--m) center/100% 100% no-repeat;mask:var(--m) center/100% 100% no-repeat;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.9) 50%,transparent 62%) 0 0/250% 100%;animation:dsS 5s linear infinite var(--d)}'+
'@keyframes dsS{0%{background-position:100% 0}55%,100%{background-position:0 0}}'+
'.ds-awake::before,.ds-rebirth::before{content:"";position:absolute;left:-3px;top:2px;width:7px;height:7px;z-index:1;opacity:0;background:linear-gradient(#fff,#fff) 50% 0/1px 100% no-repeat,linear-gradient(#fff,#fff) 0 50%/100% 1px no-repeat;animation:dsT 5.7s ease-in-out infinite var(--d)}'+
'@keyframes dsT{0%,60%,100%{opacity:0;transform:scale(.4)}78%{opacity:1;transform:scale(1)}}';
 (document.head||document.documentElement).appendChild(st)}

G.DotSkillFX={aura,starURL,starHTML,star,stars,create,TYPES:TY,KINDS,KIND_KO:{shot:'원거리 탄',beam:'빔·연속',slash:'근접 참격',area:'광역',ult:'오의'}};
})(typeof window!=='undefined'?window:globalThis);
