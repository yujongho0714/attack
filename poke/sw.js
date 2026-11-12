// 포켓몬 어드벤처 오프라인: 화면 파일은 새 버전을 먼저, 그림은 받아 둔 것을 먼저
const V='pka-core-202611130009';const CORE=['./','index.html','manifest.json','poke_meta.json','icon-192.png','icon-512.png','assets.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(K=>Promise.all(K.filter(k=>k.startsWith('pka-core-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  const pg=/\/pack\.html$/.test(u.pathname);const nav=r.mode==='navigate'&&!pg;const core=r.mode==='navigate'||/\/(index\.html|poke_meta\.json|assets\.json|manifest\.json)$/.test(u.pathname)||u.pathname.endsWith('/');
  if(core){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(nav?'index.html':pg?'pack.html':r,cp));return res}).catch(()=>caches.match(nav?'index.html':pg?'pack.html':r).then(x=>x||caches.match(r))))}
  else e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open('pka-assets').then(c=>c.put(r,cp))}return res})))});
