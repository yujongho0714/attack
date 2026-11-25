/* pk-hudx.js — ① 전투 화면 체력바에 타입 칩 · 각성 별 · 받은 각성 효과 표시 (rtbattle · rtbrawl · rtteam 공용)
 *              ② 마을에서 캐릭터가 멈춰 버리는 것(걷기 잠금이 안 풀리는 경우) 자동 복구
 * index.html 맨 끝에서 불러와요. 전부 try/catch — 실패해도 게임은 계속 돌아가요. */
(function(){'use strict';
const T=f=>{try{return f()}catch(e){return null}};
const H=window.PKHX={};
// ---------- ① 전투 HUD ----------
H.h=n=>(n|0)<=3?72:61;   // 체력바 한 칸 높이(한쪽이 3마리 이하면 받은 효과 줄까지)
const effText=m=>T(()=>{const i=window.awBirth&&awBirth.info(m);if(!i||!i.from)return '';
  return '🤝 '+nm(i.from)+' 각성 '+i.st+'★ ×'+Math.round(awBirth.SHR[awBirth.bo(i.from)]*100)+'% → 능력치 +'+(i.v*6).toFixed(1)+'%'})||'';
const rr=(c,x,y,w,h,r)=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()};
H.draw=(cx,x,y,w,e,right,u,n)=>T(()=>{
  const m=e&&e.mon;if(!m)return;const M=META[m.n];
  const types=(M&&M.types)||[];
  cx.save();cx.textBaseline='middle';
  // 타입 칩 (아군은 왼쪽부터, 상대는 오른쪽부터)
  const cy=y+7*u,ch=12*u;let px=right?x+w-8*u:x+8*u;
  cx.font='bold '+(9.5*u)+'px sans-serif';
  const chips=right?types.slice().reverse():types;
  for(const t of chips){const nmT=TN[t]||t,cw=cx.measureText(nmT).width+10*u;const cx0=right?px-cw:px;
    rr(cx,cx0,cy-ch/2,cw,ch,4*u);cx.fillStyle=TCOL[t]||'#888';cx.fill();cx.lineWidth=1;cx.strokeStyle='rgba(0,0,0,.55)';cx.stroke();
    cx.fillStyle='#fff';cx.shadowColor='rgba(0,0,0,.8)';cx.shadowBlur=2;cx.textAlign='center';cx.fillText(nmT,cx0+cw/2,cy+.5*u);cx.shadowBlur=0;
    px+=right?-(cw+3*u):(cw+3*u)}
  // 각성 별 (5칸: 보라=받은/내 각성, 6번째부터 빨강, 빈 칸은 어둡게) — 편성 화면과 같은 규칙
  const aw=T(()=>window.awDisp?awDisp(m):(m.aw|0))|0,lb=Math.max((m.lb|0),aw);
  if(aw>0||lb>0){
    cx.font='bold '+(12*u)+'px sans-serif';cx.textAlign='center';
    const sw=12*u,tot=5*sw,sx=right?x+8*u:x+w-8*u-tot;
    for(let i=0;i<5;i++){let col;
      if(aw>5)col=i<aw-5?'#ff4a5a':'#b070ff';else if(i<aw)col='#b070ff';else if(lb>5)col=i<lb-5?'#9a7a1a':'#ffc933';else col=i<lb?'#ffc933':'#3a3f55';
      cx.fillStyle=col;if(i<aw){cx.shadowColor=col;cx.shadowBlur=6*u}cx.fillText('★',sx+i*sw+sw/2,cy);cx.shadowBlur=0}
  }
  // 받은 각성 효과 (팀 효과 부여) — 한 줄
  if((n|0)<=3){const tx=effText(m);if(tx){cx.font='bold '+(9*u)+'px sans-serif';cx.fillStyle='#d9b8ff';cx.textAlign=right?'right':'left';
    cx.fillText(tx,right?x+w-8*u:x+8*u,y+(46+14+5)*u,w-16*u)}}
  cx.restore()});

// ---------- ② 걷기 멈춤 복구 ----------
// 걷는 방향을 누르고 있는데도 몇 초째 안 움직이면, 보이지 않는 잠금(P.busy · EVB.n · 끝난 이동 · 남은 장면 막)을 풀어요.
(function(){let stuck=0,last=performance.now();
  const bigOverlay=()=>{try{for(const el of document.body.children){if(!el.id||el.tagName==='CANVAS'||el.tagName==='SCRIPT')continue;
      const cs=getComputedStyle(el);if(cs.position!=='fixed'||cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<.2)continue;
      if((+cs.zIndex||0)<50)continue;const r=el.getBoundingClientRect();
      if(r.width>=innerWidth*.6&&r.height>=innerHeight*.5)return el}}catch(e){}return null};
  setInterval(()=>{T(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;
    if(typeof G==='undefined'||!G||typeof SCENE==='undefined'||SCENE!=='over'){stuck=0;return}
    const want=(typeof KEY!=='undefined'&&KEY.dir>=0);
    const blocked=!!(P.busy||(EVB&&EVB.n>0)||P.mv);
    if(!want||!blocked||PANEL||DLG.on||(typeof BS!=='undefined'&&BS.on)){stuck=0;return}
    const ov=bigOverlay();const ts=document.getElementById('trScene');
    if(ov&&ov!==ts){stuck=0;return}   // 진짜 화면(상점·도감·연출)이 떠 있으면 건드리지 않음
    stuck+=dt;
    if(stuck>=3.5){stuck=0;
      if(ts)ts.remove();
      P.busy=0;if(EVB)EVB.n=0;P.mv=null;
      try{console.warn('[pk-hudx] 걷기 잠금 풀었어요')}catch(e){}}
  })},500);
  // 앱을 잠깐 나갔다 오면 눌린 채로 남은 방향 지우기
  const clr=()=>T(()=>{if(typeof KEY!=='undefined'){KEY.dir=-1;KEY.dir2=-1}const z=document.getElementById('joyZ');if(z)z.classList.remove('on')});
  addEventListener('blur',clr);document.addEventListener('visibilitychange',()=>{if(document.hidden)clr()});
})();
})();
