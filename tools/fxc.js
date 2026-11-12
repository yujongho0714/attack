(()=>{try{if(window.__fxc){window.__fxc.ui.style.display='block';return}
try{performance.setResourceTimingBufferSize(50000)}catch(e){}
const S=new Set(),H=location.hostname,EXT=/\.(png|webp|gif|jpe?g|avif|json|atlas|plist|fnt|svg|mp4|webm|ogg|mp3|wav|m4a|txt|bin|ktx2?|basis|js|mjs|css|wasm|woff2?|ttf|otf|glb|gltf|xml|csv|html?)(\?|#|$)/i,TXT=/\.(js|mjs|css|json|atlas|plist|fnt|txt|xml|csv|html?|gltf|svg)(\?|#|$)/i;
const add=u=>{try{if(!u||/^(data|blob|javascript|about):/.test(u))return;const U=new URL(u,location.href);U.hash='';const h=U.href;if(!S.has(h)&&(EXT.test(U.pathname)||(U.hostname===H&&/\.[a-z0-9]{1,5}$/i.test(U.pathname)))){S.add(h);upd()}}catch(e){}};
const scan=()=>{performance.getEntriesByType('resource').forEach(e=>add(e.name));document.querySelectorAll('img,source,video,audio,script[src],link[href],iframe[src]').forEach(e=>add(e.currentSrc||e.src||e.href));document.querySelectorAll('*').forEach(e=>{const b=getComputedStyle(e).backgroundImage;if(b&&b!=='none')(b.match(/url\(["']?([^"')]+)/g)||[]).forEach(x=>add(x.replace(/^url\(["']?/,'')))});add(location.href.split('#')[0].replace(/\/?$/,'/index.html'))};
try{new PerformanceObserver(l=>l.getEntries().forEach(e=>add(e.name))).observe({type:'resource',buffered:true})}catch(e){}
const _f=window.fetch.bind(window);window.fetch=function(i){try{add(typeof i==='string'?i:i.url)}catch(e){}return _f.apply(this,arguments)};
const _o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){add(u);return _o.apply(this,arguments)};
const d=document.createElement('div');d.style.cssText='position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#1c2550;color:#fff;font:700 14px sans-serif;padding:10px;border-radius:12px;border:3px solid #ffd23f;box-shadow:0 4px 14px #000a;max-width:92vw';
const E=(t,id,txt,css)=>{const e=document.createElement(t);if(id)e.id=id;if(txt)e.textContent=txt;if(css)e.style.cssText=css;return e};const bs='font:900 15px sans-serif;padding:8px 12px;border-radius:10px;border:0;margin:2px;';
const ck=(id,txt,on)=>{const l=E('label',null,null,'display:block;margin:4px 0;font-weight:600');const c=E('input',id);c.type='checkbox';c.checked=on;l.append(c,document.createTextNode(' '+txt));return l};
d.append(E('div','fxN','찾은 파일 0개'),ck('fxD','코드 안에 적힌 파일까지 전부 (사이트 전체)',true),ck('fxO','다른 사이트(CDN) 파일도',false),E('button','fxZ','전부 ZIP 저장',bs+'background:#ffd23f;color:#1c2550'),E('button','fxX','숨기기',bs),E('div','fxM','저장을 누르면 이 사이트 파일을 전부 모아요. 크면 25MB씩 나눠 받아요','font-weight:600;font-size:12px;margin-top:6px;opacity:.9'));
(document.body||document.documentElement).appendChild(d);const $=i=>d.querySelector('#'+i);
function upd(){if($('fxN'))$('fxN').textContent='찾은 파일 '+S.size+'개'}
$('fxX').onclick=()=>d.style.display='none';
const T=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0});const crc=b=>{let c=~0;for(let i=0;i<b.length;i++)c=T[(c^b[i])&255]^(c>>>8);return(~c)>>>0};
function zip(F){const enc=new TextEncoder(),parts=[],cen=[];let off=0;for(const [name,data] of F){const nb=enc.encode(name),c=crc(data),h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,c,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nb.length,true);parts.push(new Uint8Array(h.buffer),nb,data);
  const e=new DataView(new ArrayBuffer(46));e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint32(16,c,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,nb.length,true);e.setUint32(42,off,true);cen.push(new Uint8Array(e.buffer),nb);off+=30+nb.length+data.length}
  const cs=cen.reduce((a,b)=>a+b.length,0),z=new DataView(new ArrayBuffer(22));z.setUint32(0,0x06054b50,true);z.setUint16(8,F.length,true);z.setUint16(10,F.length,true);z.setUint32(12,cs,true);z.setUint32(16,off,true);return new Blob([...parts,...cen,new Uint8Array(z.buffer)],{type:'application/zip'})}
// 코드·데이터 안에 적힌 파일 이름 찾기
const REF=/["'`(\s,]((?:https?:\/\/[^"'`()\s]+|\.{0,2}\/?[\w\-.@%~]+(?:\/[\w\-.@%~]+)*)\.(?:png|webp|gif|jpe?g|avif|json|atlas|plist|fnt|svg|mp4|webm|ogg|mp3|wav|m4a|bin|ktx2?|basis|js|mjs|css|wasm|woff2?|ttf|otf|glb|gltf|xml|csv)(?:\?[^"'`()\s]*)?)(?=["'`)\s,])/gi;
function refs(txt,base){const out=[];let m;REF.lastIndex=0;while((m=REF.exec(txt))){let u=m[1];if(u.length>300)continue;try{const a=new URL(u,base).href,b=u.startsWith('/')||/^https?:/.test(u)?null:new URL(u,location.origin+'/').href;out.push(a);if(b&&b!==a)out.push(b)}catch(e){}}
  // 템플릿처럼 숫자로 된 폴더 (예: sprites/0006/...) 는 그대로만
  return out}
const dt=new Date(),ds=dt.getFullYear()+String(dt.getMonth()+1).padStart(2,'0')+String(dt.getDate()).padStart(2,'0'),base='site-'+H.replace(/\W/g,'-')+'-'+ds;
function save(F,k){const a=document.createElement('a');a.href=URL.createObjectURL(zip(F));a.download=base+(k?'-part'+k:'')+'.zip';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},60000)}
$('fxZ').onclick=async()=>{scan();const deep=$('fxD').checked,other=$('fxO').checked;$('fxZ').disabled=true;
  const Q=[...S],QS=new Set(Q),done=new Set(),bad=[],seen=new Set();let F=[],size=0,part=0,tot=0,nf=0;const LIM=25*1024*1024;
  const ok=u=>{try{const U=new URL(u);return other||U.hostname===H||U.hostname.endsWith('.'+H.split('.').slice(-2).join('.'))}catch(e){return false}};
  const one=async u=>{if(done.has(u))return;done.add(u);if(!ok(u))return;try{const r=await _f(u,{credentials:'include'});if(!r.ok)throw r.status;const b=new Uint8Array(await r.arrayBuffer());
    const U=new URL(u);let p=(U.hostname+U.pathname).replace(/[^a-zA-Z0-9._\/@-]/g,'_');if(p.endsWith('/'))p+='index.html';while(seen.has(p))p=p.replace(/(\.[^.\/]*)?$/,'_'+nf+'$1');seen.add(p);F.push([p,b]);size+=b.length;tot+=b.length;nf++;
    if(deep&&(TXT.test(U.pathname)||(r.headers.get('content-type')||'').match(/text|javascript|json|css|xml/))&&b.length<30*1024*1024){const t=new TextDecoder().decode(b);for(const x of refs(t,u))if(!QS.has(x)){QS.add(x);Q.push(x)}}
    if(size>=LIM){part++;save(F,part);F=[];size=0;await new Promise(z=>setTimeout(z,800))}}catch(e){bad.push(u+'  ('+e+')')}};
  let qi=0;const W=async()=>{while(qi<Q.length){const u=Q[qi++];await one(u);$('fxM').textContent='받는 중 '+nf+'개 · '+(tot/1048576).toFixed(1)+'MB · 남은 후보 '+(Q.length-qi)+(part?' · 저장한 zip '+part+'개':'')}};
  await Promise.all([W(),W(),W(),W(),W(),W()]);
  F.push(['_list.txt',new TextEncoder().encode('page: '+location.href+'\nfiles: '+nf+'  total: '+(tot/1048576).toFixed(1)+'MB\n\n'+[...done].join('\n')+'\n\n--- 못 받은 것 ---\n'+bad.join('\n'))]);
  part=part?part+1:0;save(F,part);$('fxZ').disabled=false;
  $('fxM').textContent='끝! 파일 '+nf+'개 · '+(tot/1048576).toFixed(1)+'MB'+(part?' · zip '+part+'개로 나눠 받았어요':'')+(bad.length?' · 못 받은 것 '+bad.length+'개':'')+' → zip을 전부 채팅에 올려 주세요'};
window.__fxc={ui:d,S};scan();upd();
try{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js';s.onload=()=>{try{eruda.init()}catch(e){}};document.body.appendChild(s)}catch(e){}
}catch(e){alert('fx수집 오류: '+(e&&e.message||e))}})();
