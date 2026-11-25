// 포켓몬 어드벤처 오프라인: 화면 파일은 새 버전을 먼저, 그림은 받아 둔 것을 먼저
const V='pka-core-202611252540';const CORE=['./','index.html','manifest.json','poke_meta.json','icon-192.png','icon-512.png','assets.json','fxed.html','fxed.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(K=>Promise.all(K.filter(k=>k.startsWith('pka-core-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  const pg=/\/(pack|fxed)\.html$/.test(u.pathname);const K=u.pathname.split('/').pop();const nav=r.mode==='navigate'&&r.destination!=='iframe'&&!pg;   // 서바이버 던전(iframe)이 본편 index.html 캐시를 덮어쓰지 않게const core=r.mode==='navigate'||/\/(index\.html|rzmap\.json|rzforms\.json|rzmoves\.json|rzdex\.json|rzlearn\.json|rtbattle\.js|gymfx\.js|rtteam\.js|wbswarm\.js|beamfx\.js|rtbrawl\.js|tierfx\.js|poke_meta\.json|empress-fx\.js|assets\.json|fxed\.json|manifest\.json|fxcustom\.json|gmax-core\.js|gmax-battle\.js|pk-patch\.js|pk-hudx\.js|pk-fix2\.js|gmaxmap\.json|survivor\.js|ncsched\.json|newchars\.json)$/.test(u.pathname)||u.pathname.endsWith('/');
  if(core){const key=nav?'index.html':pg?K:r;
    // 새 파일을 먼저 받되, 4초 안에 안 오면(느린 와이파이 · 깃허브 배포 중) 받아 둔 파일로 먼저 열고 뒤에서 새로 받아 둬요 → 시작 화면에서 멈추는 것 방지
    const net=fetch(r,{cache:'no-cache'}).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(key,cp))}return res});
    const slow=new Promise(ok=>setTimeout(()=>ok(null),4000));
    e.waitUntil(net.catch(()=>0));
    e.respondWith(Promise.race([net.catch(()=>null),slow]).then(res=>res||caches.match(key).then(x=>x||caches.match(r)).then(x=>x||net)))}
  else e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open('pka-assets').then(c=>c.put(r,cp))}return res})))});
