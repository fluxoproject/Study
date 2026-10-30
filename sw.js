// Service worker do EstudoLógico: deixa o app abrir mesmo sem internet.
// Arquivos do app: tenta a rede primeiro (para receber atualizações) e usa a cópia guardada se estiver offline.
const V='studyflow-v12',AUD='studyflow-audio-v2',SHELL=['./','index.html','style.css','app.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','favicon-32.png','logo-mask.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!==AUD).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api'))return;
if(u.pathname.endsWith('.m4a')){/* áudio: toca a cópia guardada na hora e confere em segundo plano se o arquivo mudou (basta substituir o .m4a na raiz do GitHub) */const p=caches.open(AUD).then(async c=>{const m=await c.match(u.origin+u.pathname);const net=fetch(u.origin+u.pathname,{cache:'no-cache'}).then(res=>{if(res.ok&&res.status===200)c.put(u.origin+u.pathname,res.clone());return res});if(m){net.catch(()=>{});return m}return net});e.respondWith(p.catch(()=>fetch(r)));e.waitUntil(p.catch(()=>{}));return}
e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res}).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):Response.error()))))});

// Notificações push (vêm do servidor, mesmo com o app fechado)
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){d={title:'EstudoLógico',body:e.data?e.data.text():''}}
e.waitUntil(self.registration.showNotification(d.title||'EstudoLógico',{body:d.body||'',icon:'icon-192.png',badge:'favicon-32.png',tag:d.tag||undefined,data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'./',go=(new URL(url,self.registration.scope).searchParams.get('go'))||'';
e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus' in c){c.postMessage({go});return c.focus()}}return self.clients.openWindow(new URL(url,self.registration.scope).href)}))});
