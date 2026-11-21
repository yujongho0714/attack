/* pk-patch.js — 전투 소리(기술·타격·울음소리) + 상성 안 맞으면 자동 교체 + 포켓몬 메뉴 비행/수영 지정
 * index.html 맨 끝에서 불러와요. 다른 파일은 PKS(window.PKS)만 불러 쓰면 돼요.
 * 하나가 실패해도 나머지는 계속 돌아가게 전부 try/catch로 감쌌어요. */
(function(){'use strict';
  const T=f=>{try{return f()}catch(e){try{console.warn('[pk-patch]',e)}catch(_){}}};
  const VOL=()=>{try{return G&&G.opt&&G.opt.vol!=null?G.opt.vol:1}catch(e){return 1}};
  const swapOn=()=>{try{return !(G&&G.opt&&G.opt.autoSwap===0)}catch(e){return true}};
  const pad4=n=>String(n).padStart(4,'0');
  const now=()=>(typeof performance!=='undefined'?performance.now():Date.now());

  // ---------- 소리 ----------
  // 기술 쓸 때 나는 소리 (타입별) — sfx 폴더에 실제로 있는 파일만 써요
  const TS={FIRE:'flame_start',WATER:'splash',ELECTRIC:'elec_charge',ICE:'ice_charge',GRASS:'leaf',PSYCHIC:'psychic',GHOST:'ghost',POISON:'poison',ROCK:'rock',GROUND:'quake',FLYING:'mf4_whoosh',DRAGON:'roar',FIGHTING:'claw',STEEL:'blade',BUG:'rb9_buzz',DARK:'slash',FAIRY:'twinkle',NORMAL:'mf4_whoosh'};
  const last={};
  const gate=(k,ms)=>{const t=now();if(t-(last[k]||0)<ms)return false;last[k]=t;return true};
  const S=(k,v)=>{T(()=>{if(typeof snd==='function')snd(k,v)})};

  // 미리 받아 두기 (처음 소리가 늦지 않게)
  function preload(k){T(()=>{
    if(SBUF[k]||SLOAD[k])return;
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    SLOAD[k]=fetch(SFXP+k+'.mp3').then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(a=>new Promise((ok,no)=>AC.decodeAudioData(a,ok,no))).then(b=>{SBUF[k]=b}).catch(()=>{delete SLOAD[k]});
  })}
  setTimeout(()=>{Object.values(TS).concat(['hit_light','hit_heavy','crit','super_eff','not_eff','ko','shatter','twinkle']).forEach(preload)},3500);

  // 폰/브라우저는 첫 터치 전엔 소리를 막아요 → 첫 터치 때 오디오를 깨워요
  const unlock=()=>{T(()=>{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state!=='running')AC.resume()})};
  ['pointerdown','touchstart','keydown','click'].forEach(ev=>addEventListener(ev,unlock,{passive:true,capture:true}));

  // 울음소리: cries/0001.mp3 … (도감 번호)
  const dexOf=x=>{try{if(typeof x==='number')return x;const n=(x&&x.n)||x;const M=META[n];return M&&M.dex?M.dex:0}catch(e){return 0}};
  const crying=[];
  function cry(x,vol,delay){
    const d=dexOf(x);if(!(d>=1&&d<=1025))return;
    const go=()=>T(()=>{
      const a=new Audio('cries/'+pad4(d)+'.mp3');a.volume=Math.max(0,Math.min(1,(vol==null?.8:vol)*VOL()));
      crying.push(a);if(crying.length>4){const o=crying.shift();try{o.pause()}catch(e){}}
      const p=a.play();if(p&&p.catch)p.catch(()=>{});
    });
    if(delay>0)setTimeout(go,delay);else go();
  }

  const PKS=window.PKS={
    swapOn,cry,
    cast(m,mine){
      if(!m||!gate('cast'+(mine?1:0),120))return;
      S(m.st&&m.k==='self'?'twinkle':(TS[m.type]||'mf4_whoosh'),mine?.45:.3);
    },
    hit(m,e,crit,mine){
      if(!gate('hit',55))return;
      const heavy=!!crit||e>=2||(m&&m.p>=90),v=mine?.55:.45;
      S(crit?'crit':heavy?'hit_heavy':'hit_light',v);
      if(e>=2)setTimeout(()=>S('super_eff',.45),70);
      else if(e>0&&e<1)setTimeout(()=>S('not_eff',.4),70);
    },
    ko(ent){
      if(!gate('ko',300))return;
      S('ko',.6);
      if(ent&&ent.mon)cry(ent.mon,.55,180);
    }
  };

  // 예전에 파일이 없어서 안 나던 소리 이름 → 있는 파일로
  T(()=>{const _s=snd;snd=function(k,v){const R={zap:'thunder',wing_flap:'mf4_whoosh'};return _s.call(this,R[k]||k,v)}});

  // ---------- 공통: 지금 포켓몬이 상대한테 대미지를 줄 수 있나 ----------
  const hurts=(mon,foeMon)=>{           // true = 대미지를 줄 수 있음(또는 공격기술이 없어서 상성 문제가 아님) → 교체 안 함
    const ft=META[foeMon.n].types;
    const dm=(mon.moves||[]).map(mv).filter(m=>m&&!m.st&&(m.pw||0)>0);
    return !dm.length||dm.some(m=>eff(m.type,ft)>0);
  };
  const swapPick=(cur,foeMon)=>{          // 교체할 파티 번호 (대미지가 들어가는 포켓몬 중 제일 센 포켓몬), 없으면 -1
    const ft=META[foeMon.n].types;let bi=-1,bs=0;
    G.party.forEach((m,i)=>{
      if(m===cur||!m||m.hp<=0)return;
      const mt=META[m.n].types;let s=0;
      for(const id of m.moves||[]){const x=mv(id);if(!x||x.st||!(x.pw>0))continue;const e=eff(x.type,ft);if(e<=0)continue;s=Math.max(s,x.pw*e*(mt.includes(x.type)?1.5:1))}
      if(s>bs){bs=s;bi=i}
    });
    return bi;
  };
  PKS.hurts=hurts;PKS.swapPick=swapPick;

  // ---------- 어드벤처(실시간) 전투 ----------
  T(()=>{const _u=actUpdate;let acc=0;
    actUpdate=function(dt){
      const r=_u.apply(this,arguments);
      T(()=>{
        acc+=dt;if(acc<.7)return;acc=0;
        if(!swapOn()||!ACT.on||SCENE!=='battle'||ACT.down||ACT.busy||ACT.fbusy||ACT.pause||(ACT.swcd||0)>0)return;
        const me=BS.me,f=BS.foe;if(!me||!f||!me.m||!f.m||me.m.hp<=0||f.m.hp<=0)return;
        const forced=!!BS._noEff;BS._noEff=0;
        if(!forced&&hurts(me.m,f.m))return;
        const i=swapPick(me.m,f.m);if(i<0)return;
        toast('🔄 상성이 안 맞아서 '+nm(G.party[i])+'(으)로 교체!');actSwitch(i);
      });
      return r;
    }});
  // 새 포켓몬이 나올 때 울음소리
  T(()=>{const _a=actSwitch;actSwitch=async function(i){const m=G.party[i],cur=BS.me&&BS.me.m;const r=await _a.apply(this,arguments);T(()=>{if(m&&BS.me&&BS.me.m===m&&m!==cur)cry(m,.8,200)});return r}});
  T(()=>{const _c=actChoose;const seen=new WeakSet();
    actChoose=function(){T(()=>{if(BS.foe&&BS.foe.m&&!seen.has(BS.foe.m)){seen.add(BS.foe.m);cry(BS.foe.m,.8,300)}if(BS.me&&BS.me.m&&!seen.has(BS.me.m)){seen.add(BS.me.m);cry(BS.me.m,.8,1100)}});return _c.apply(this,arguments)}});

  // ---------- 턴제 전투 ----------
  T(()=>{const _ch=choose;
    choose=function(sub){
      const r=T(()=>{
        if(!swapOn()||(typeof advOn==='function'&&advOn()))return null;
        if(!BS||!BS.me||!BS.foe||!BS.me.m||!BS.foe.m||BS.me.m.hp<=0)return null;
        const forced=!!BS._noEff;BS._noEff=0;
        if(!forced&&hurts(BS.me.m,BS.foe.m))return null;
        const i=swapPick(BS.me.m,BS.foe.m);if(i<0)return null;
        return new Promise(ok=>{toast('🔄 상성이 안 맞아서 '+nm(G.party[i])+'(으)로 교체!');setTimeout(()=>ok({t:'switch',i}),FAST()?300:700)});
      });
      return r||_ch.apply(this,arguments);
    }});
  T(()=>{const _sm=sendMe;sendMe=function(m){setTimeout(()=>cry(m,.8),250);return _sm.apply(this,arguments)}});
  T(()=>{const _sf=sendFoe;sendFoe=function(m){setTimeout(()=>cry(m,.8),150);return _sf.apply(this,arguments)}});

  // ---------- 전투가 끝나면 얻은 아이템을 1초 보여줘요 ----------
  // 전투 전에 가방 · 장비를 적어 두고, 끝난 뒤 늘어난 것만 (등급 높은 순) 띄워요. 화면을 누르면 바로 닫혀요.
  T(()=>{const c=document.createElement('style');c.textContent='#pkGot{position:fixed;z-index:9999;left:50%;top:22%;transform:translateX(-50%);min-width:210px;max-width:88vw;max-height:56vh;overflow:auto;padding:10px 14px;border:3px solid #1c2550;background:#141a38f2;color:#fff;box-shadow:0 4px 0 #0b0f24,0 0 0 3px #ffd23f;font:900 13px Galmuri11,sans-serif;text-align:center}#pkGot h4{margin:0 0 6px;color:#ffd23f;font-size:14px}#pkGot div{padding:3px 0;border-top:1px solid #ffffff22;text-align:left}#pkGot div:first-of-type{border-top:0}#pkGot small{color:#9fb0ff}';document.head.appendChild(c)});
  const gotLines=L=>{const R=[];for(const x of L){
    if(x.gear){const k=x.gear,it=gItem(k),n=(meItem(k)||{}).n||k;R.push({g:it.g,h:`<div><b style="color:${GGC[it.g]}">[${GGR[it.g]}]</b> ${esc(n)}</div>`})}
    else if(x.item){const I=ITEMS[x.item]||{};R.push({g:-1,h:`<div>${I.e||'🎁'} ${esc(I.n||x.item)} <b>×${x.n}</b></div>`})}}
    R.sort((a,b)=>b.g-a.g);return R.map(r=>r.h).join('')};
  window.pkGotShow=function(L,ms){return new Promise(ok=>{T(()=>{
    document.querySelectorAll('#pkGot').forEach(e=>e.remove());
    if(!L||!L.length){ok();return}
    const d=document.createElement('div');d.id='pkGot';d.innerHTML='<h4>🎁 획득한 아이템</h4>'+gotLines(L);document.body.appendChild(d);
    let done=0;const fin=()=>{if(done)return;done=1;d.remove();ok()};
    d.onclick=fin;setTimeout(fin,ms||1000)})||ok()})};
  T(()=>{const _b=battle;battle=async function(o){
    let snap=null,own0=null;
    T(()=>{snap=Object.assign({},G.bag||{});own0=new Set((G.me&&G.me.own)||[])});
    const r=await _b.apply(this,arguments);
    try{if(o&&!o.pvp&&snap){const L=[];
      for(const k in (G.bag||{})){const n=(G.bag[k]||0)-(snap[k]||0);if(n>0&&ITEMS[k])L.push({item:k,n})}
      for(const k of ((G.me&&G.me.own)||[]))if(!own0.has(k))L.push({gear:k});
      if(L.length)await window.pkGotShow(L,1000)}}catch(e){console.warn('[pk-patch] got',e)}
    return r}});

  // ---------- 포켓몬 메뉴: 비행 · 수영 지정 ----------
  const fidOf=m=>{m.fid=m.fid||('f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));return m.fid};
  const types=m=>(META[m.n]&&META[m.n].types)||[];
  const canFlyM=m=>types(m).includes('FLYING')||(types(m).includes('DRAGON')&&(m.lv||0)>=30);
  const canSwimM=m=>types(m).includes('WATER');
  T(()=>{const _f=flyMon;flyMon=function(){const m=T(()=>G.party.find(x=>x.fid&&x.fid===G.flyFid&&x.hp>0&&canFlyM(x)));return m||_f.apply(this,arguments)}});
  T(()=>{const _s=surfMon;surfMon=function(){const m=T(()=>G.party.find(x=>x.fid&&x.fid===G.surfFid&&x.hp>0&&canSwimM(x)));return m?{m,nm:nm(m)}:_s.apply(this,arguments)}});

  let inMenu=false;
  T(()=>{const _mr=monRow;monRow=function(m,i,box){
    const h=_mr.apply(this,arguments);
    if(!inMenu||box||!m||!META[m.n])return h;
    const b=[];
    const st='margin:3px 4px 0 0;padding:3px 8px;border-radius:8px;border:1px solid #0004;font:900 12px sans-serif;';
    if(canFlyM(m)){const on=m.fid&&m.fid===G.flyFid;b.push(`<button type="button" data-pkabil="fly:${i}" style="${st}background:${on?'#7fb4ff':'#e8f1ff'}">🕊 비행${on?' ✓ 지정됨':' 지정'}</button>`)}
    if(canSwimM(m)){const on=m.fid&&m.fid===G.surfFid;b.push(`<button type="button" data-pkabil="surf:${i}" style="${st}background:${on?'#5fd0d8':'#e0fbff'}">🌊 수영${on?' ✓ 지정됨':' 지정'}</button>`)}
    if(!b.length)return h;
    const k=h.lastIndexOf('</small></div></div>');
    return k<0?h:h.slice(0,k)+'</small><div>'+b.join('')+'</div></div></div>';
  }});

  T(()=>{const _mo=menuOpen;menuOpen=function(){
    inMenu=true;let r;try{r=_mo.apply(this,arguments)}finally{inMenu=false}
    T(()=>{
      document.querySelectorAll('[data-pkabil]').forEach(b=>{b.onclick=ev=>{
        ev.stopPropagation();ev.preventDefault();
        const [k,i]=b.dataset.pkabil.split(':');const m=G.party[+i];if(!m)return;
        try{sfx('tap')}catch(e){}
        const key=k==='fly'?'flyFid':'surfFid';
        if(m.fid&&G[key]===m.fid){G[key]=null;toast((k==='fly'?'🕊 비행':'🌊 수영')+' 지정을 풀었어요')}
        else{G[key]=fidOf(m);toast((k==='fly'?'🕊 ':'🌊 ')+nm(m)+'(이)가 '+(k==='fly'?'비행':'수영')+' 담당!')}
        try{save()}catch(e){}
        T(()=>{refreshSpr()});
        menuOpen();
      }});
      // 설정에 자동 교체 스위치
      const rt=document.getElementById('oRT');
      if(rt&&!document.getElementById('pkAS')){
        const host=rt.closest('label')||rt.parentElement,lb=document.createElement('label');
        lb.innerHTML='<input type="checkbox" id="pkAS" '+(swapOn()?'checked':'')+'> 🔄 상성이 안 맞으면 자동 교체 <small>(공격이 하나도 안 들어갈 때)</small>';
        host.after(lb);
        lb.querySelector('input').onchange=e=>{G.opt.autoSwap=e.target.checked?1:0;try{save()}catch(_){}toast(G.opt.autoSwap?'🔄 자동 교체 켰어요':'자동 교체 껐어요')};
      }
    });
    return r;
  }});
})();
