// Service worker do StudyFlow: deixa o app abrir mesmo sem internet.
// Arquivos do app: tenta a rede primeiro (para receber atualizações) e usa a cópia guardada se estiver offline.
const V='studyflow-v2',SHELL=['./','index.html','style.css','app.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','favicon-32.png','logo-mask.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api'))return;
e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res}).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):Response.error()))))});
