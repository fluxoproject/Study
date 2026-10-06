const express=require('express'),path=require('path'),{Pool}=require('pg'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),{OAuth2Client}=require('google-auth-library');
const {DATABASE_URL,JWT_SECRET,GEMINI_API_KEY,GEMINI_MODEL='gemini-flash-latest',GOOGLE_CLIENT_ID='',PORT=3000}=process.env;
const googleClient=new OAuth2Client();
if(!DATABASE_URL||!JWT_SECRET){console.error('Faltam variáveis de ambiente: DATABASE_URL e JWT_SECRET');process.exit(1)}
const pool=new Pool({connectionString:DATABASE_URL,ssl:/\.render\.com|neon\.tech|supabase\.|sslmode=/.test(DATABASE_URL)?{rejectUnauthorized:false}:false,idleTimeoutMillis:30000,connectionTimeoutMillis:15000,max:5});
pool.on('error',e=>console.error('Conexão ociosa do banco encerrada:',e.message));
const app=express();app.set('trust proxy',1);app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:{policy:'cross-origin'}}));
// CORS: permite que o site no GitHub Pages converse com este servidor. Outros sites: variável ALLOWED_ORIGINS (separados por vírgula).
const ORIGINS=(process.env.ALLOWED_ORIGINS||'https://fluxoproject.github.io').split(',').map(x=>x.trim().replace(/\/+$/,''));
app.use('/api',(q,s,n)=>{const o=q.headers.origin;if(o&&ORIGINS.includes(o)){s.set({'Access-Control-Allow-Origin':o,'Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Vary':'Origin'})}if(q.method==='OPTIONS')return s.sendStatus(204);n()});app.use(express.json({limit:'2mb'}));
const lim=rateLimit({windowMs:15*60*1000,max:40,standardHeaders:true,legacyHeaders:false,message:{error:'Muitas tentativas. Aguarde alguns minutos.'}});
const tlim=rateLimit({windowMs:5*60*1000,max:30,standardHeaders:true,legacyHeaders:false,keyGenerator:q=>'u'+((q.user&&q.user.id)||'anon'),message:{error:'Muitas perguntas seguidas. Espere um pouquinho e tente de novo.'}});
const w=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(500).json({error:'Erro no servidor. Tente novamente.'})});
const sign=u=>jwt.sign({id:u.id,email:u.email},JWT_SECRET,{expiresIn:'60d'});
const auth=(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),JWT_SECRET);n()}catch{s.status(401).json({error:'Sessão expirada. Entre novamente.'})}};
const mail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
app.get('/api/health',(q,s)=>s.json({ok:true}));
app.post('/api/register',lim,w(async(q,s)=>{const email=String(q.body.email||'').trim().toLowerCase(),pw=String(q.body.password||''),name=String(q.body.name||'').slice(0,60);
if(!mail(email))return s.status(400).json({error:'E-mail inválido.'});if(pw.length<6)return s.status(400).json({error:'A senha precisa ter pelo menos 6 caracteres.'});
if((await pool.query('SELECT 1 FROM users WHERE email=$1',[email])).rowCount)return s.status(409).json({error:'E-mail já cadastrado.'});
const r=await pool.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email',[email,name,await bcrypt.hash(pw,10)]);s.json({token:sign(r.rows[0]),email})}));
app.post('/api/login',lim,w(async(q,s)=>{const email=String(q.body.email||'').trim().toLowerCase(),r=await pool.query('SELECT * FROM users WHERE email=$1',[email]),u=r.rows[0];
if(!u||!(await bcrypt.compare(String(q.body.password||''),u.password_hash)))return s.status(401).json({error:'E-mail ou senha incorretos.'});s.json({token:sign(u),email:u.email})}));
// O token do Google é conferido aqui no servidor. Nunca confie apenas no nome/foto enviados pelo navegador.
app.post('/api/google',lim,w(async(q,s)=>{if(!GOOGLE_CLIENT_ID)return s.status(503).json({error:'Login Google ainda não foi configurado no servidor.'});
const ticket=await googleClient.verifyIdToken({idToken:String(q.body.credential||''),audience:GOOGLE_CLIENT_ID}),p=ticket.getPayload();
if(!p||!p.email||!p.email_verified)return s.status(401).json({error:'Não foi possível confirmar esta conta Google.'});
const email=p.email.toLowerCase(),name=String(p.name||'').slice(0,60),photo=String(p.picture||'').slice(0,500);
let r=await pool.query('SELECT id,email FROM users WHERE email=$1',[email]);let u=r.rows[0];
if(!u){r=await pool.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email',[email,name,await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'),10)]);u=r.rows[0]}
s.json({token:sign(u),email:u.email,name,photo})}));
app.get('/api/state',auth,w(async(q,s)=>{const r=await pool.query('SELECT data,updated_at FROM app_state WHERE user_id=$1',[q.user.id]);s.json(r.rows[0]?{data:r.rows[0].data,updatedAt:Number(r.rows[0].updated_at)}:{data:null,updatedAt:0})}));
app.put('/api/state',auth,w(async(q,s)=>{const{data,updatedAt}=q.body||{};if(!data||typeof data!=='object'||!Number.isFinite(updatedAt))return s.status(400).json({error:'Dados inválidos.'});
const r=await pool.query('INSERT INTO app_state(user_id,data,updated_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at WHERE app_state.updated_at<=EXCLUDED.updated_at RETURNING updated_at',[q.user.id,JSON.stringify(data),updatedAt]);
if(r.rowCount)return s.json({ok:true,updatedAt});const c=await pool.query('SELECT data,updated_at FROM app_state WHERE user_id=$1',[q.user.id]);s.status(409).json({error:'Há uma versão mais recente na nuvem.',data:c.rows[0].data,updatedAt:Number(c.rows[0].updated_at)})}));
// Gemini às vezes responde 503 (sobrecarga) ou 429: tenta 2x em cada modelo e, se falhar, usa o modelo reserva.
// Pensar demais deixa o tutor lento: pedimos "sem pensar" (thinkingBudget 0). Se o modelo não aceitar (erro 400), repete sem esse ajuste.
const MODELS=[GEMINI_MODEL,...(process.env.GEMINI_FALLBACK||'gemini-flash-lite-latest').split(',').map(x=>x.trim())].filter((x,i,a)=>x&&a.indexOf(x)===i);
const noThink=new Set(),sleep=ms=>new Promise(z=>setTimeout(z,ms));
async function gemini(obj,stream){let last={status:0};
for(const mod of MODELS)for(let t=0;t<2;t++){
const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),15000);
try{const o=noThink.has(mod)?obj:{...obj,generationConfig:{...obj.generationConfig,thinkingConfig:{thinkingBudget:0}}};
const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(mod)+(stream?':streamGenerateContent?alt=sse':':generateContent'),{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify(o),signal:ac.signal});
clearTimeout(tm);
if(r.ok)return stream?r:await r.json();
const j=await r.json().catch(()=>({}));last={status:r.status};console.error('Gemini',mod,r.status,JSON.stringify(j).slice(0,300));
if(r.status==400&&!noThink.has(mod)){noThink.add(mod);t--;continue}
if(![429,500,502,503,504].includes(r.status))break}
catch(e){clearTimeout(tm);last={status:0};console.error('Gemini',mod,e.message)}
await sleep(500*(t+1))}
throw Object.assign(new Error('gemini'),last)}
const SYS='Você é a IA central do StudyFlow, um assistente de estudos e de organização do aplicativo. Responda em português do Brasil. Você pode conversar sobre estudos e controlar quase todo o app quando o usuário pedir claramente. REGRA CRÍTICA DE PRIVACIDADE: você NÃO recebe, não vê e não pode inferir as notas, médias ou valores de avaliações do usuário. Nunca peça notas para agir no app. REGRA CRÍTICA DO CRONÔMETRO: você pode iniciar um foco, navegar até o cronômetro e orientar o estudo, mas NUNCA pode pausar, parar, cancelar ou finalizar um cronômetro em andamento. Se já houver cronômetro ativo e o usuário pedir para iniciar outro, explique e peça para ele decidir manualmente. Ao executar uma ação que precisa de informações ausentes, faça uma pergunta objetiva antes de criar a ACTION. Exemplo: se pedirem para iniciar um estudo sem duração, pergunte quantos minutos; se pedirem tarefa sem data e isso for necessário, pergunte a data; se faltarem matéria ou conteúdo, pergunte. Não invente valores só para executar mais rápido. Seja breve, normalmente 5 a 8 linhas. Só aprofunde quando pedirem. NUNCA use LaTeX nem o símbolo $ para fórmulas. Use matemática em texto simples com Δ, √, x², ×, ÷, ±, π, ≤, ≥ e frações como a/b. Evite tabelas. Ao criar exercícios, não entregue o gabarito junto. Depois da resposta humana, coloque UMA linha exatamente no formato [[ACTION:{"type":"..."}]] somente quando todos os dados necessários estiverem confirmados pelo usuário. Tipos permitidos: add_task {title,subject,due,min,pr}, complete_task {title}, remove_task {title}, add_subject {name}, add_review {topic,subject,due}, add_exam {subject,due}, set_goal {minutes}, start_focus {subject,topic,minutes}, set_name {name}, set_theme {theme}, set_accent {color}, set_background {background}, set_preference {key,value}, navigate {page}. NUNCA use add_grade. NUNCA crie uma ACTION para pausar/parar/cancelar/finalizar o cronômetro. Se o pedido for apenas uma explicação, não envie ACTION.';
function prep(q){const msg=String(q.body.message||'').slice(0,2000);if(!msg.trim())return{err:'Escreva sua dúvida.'};
const c=q.body.appContext||{},ctx=JSON.stringify({materias:Array.isArray(c.subjects)?c.subjects.slice(0,20):[],tarefas:Array.isArray(c.tasks)?c.tasks.slice(0,30):[],meta:Number(c.goal)||60}).slice(0,3000);
const hist=(Array.isArray(q.body.history)?q.body.history:[]).slice(-6).map(m=>({role:m.u?'user':'model',text:String(m.t||'').slice(0,1200)})).filter(m=>m.text);
const turns=[...hist,{role:'user',text:msg}].reduce((a,m)=>{a.at(-1)?.role===m.role?a.at(-1).text+='\n'+m.text:a.push({...m});return a},[]);while(turns[0].role!=='user')turns.shift();
return{obj:{systemInstruction:{parts:[{text:SYS+'\nContexto atual do app (use apenas para atender pedidos de organização): '+ctx}]},contents:turns.map(t=>({role:t.role,parts:[{text:t.text}]})),generationConfig:{maxOutputTokens:1500,temperature:.6}}}}
const textOf=j=>{const c=j&&j.candidates&&j.candidates[0];return((c&&c.content&&c.content.parts)||[]).filter(p=>!p.thought).map(p=>p.text||'').join('')};
const blocked=j=>!!((j&&j.promptFeedback&&j.promptFeedback.blockReason)||(j&&j.candidates&&j.candidates[0]&&j.candidates[0].finishReason==='SAFETY'));
const BLOCKMSG='Não consigo ajudar com esse pedido. Tente perguntar de outro jeito, focado nos estudos.',EMPTY='Não consegui responder essa. Tente reformular a pergunta.';
const errOf=st=>({status:st==429?429:502,error:st==429?'Limite do tutor atingido. Tente de novo em instantes.':'O tutor está sobrecarregado agora. Tente de novo em alguns segundos.'});
// Versão em tempo real: o texto vai chegando aos poucos (muito mais rápido de ver) em vez de esperar a resposta inteira.
app.post('/api/tutor/stream',auth,tlim,async(q,s)=>{try{
if(!GEMINI_API_KEY)return s.status(503).json({error:'Tutor ainda não configurado no servidor.'});
const pr=prep(q);if(pr.err)return s.status(400).json({error:pr.err});
let r;try{r=await gemini(pr.obj,true)}catch(e){const x=errOf(e.status||0);return s.status(x.status).json({error:x.error})}
s.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});s.flushHeaders();
const send=o=>{if(!s.writableEnded)s.write('data: '+JSON.stringify(o)+'\n\n')};
const rd=r.body.getReader(),dec=new TextDecoder();let buf='',any=0,blk=0,gone=false;s.on('close',()=>{gone=true;rd.cancel().catch(()=>{})});
try{for(;;){const{done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});
let i;while((i=buf.search(/\r?\n\r?\n/))>=0){const ev=buf.slice(0,i);buf=buf.slice(i).replace(/^\r?\n\r?\n/,'');
for(const ln of ev.split(/\r?\n/)){if(!ln.startsWith('data:'))continue;let j;try{j=JSON.parse(ln.slice(5))}catch(e){continue}
if(blocked(j))blk=1;const t=textOf(j);if(t){any=1;send({t})}}}}}
catch(e){if(!gone){console.error('Stream:',e.message);send({err:any?'A resposta foi cortada no meio.':'O tutor está sobrecarregado agora. Tente de novo.'})}}
if(!any&&!gone)send({t:blk?BLOCKMSG:EMPTY});send({done:1});s.end()}
catch(e){console.error(e);if(!s.headersSent)s.status(500).json({error:'Erro no servidor. Tente novamente.'});else s.end()}});
// Versão normal (usada se o tempo real falhar)
app.post('/api/tutor',auth,tlim,w(async(q,s)=>{if(!GEMINI_API_KEY)return s.status(503).json({error:'Tutor ainda não configurado no servidor.'});
const pr=prep(q);if(pr.err)return s.status(400).json({error:pr.err});
let j;try{j=await gemini(pr.obj,false)}catch(e){const x=errOf(e.status||0);return s.status(x.status).json({error:x.error})}
const reply=textOf(j).trim();if(!reply&&blocked(j))return s.json({reply:BLOCKMSG});
s.json({reply:reply||EMPTY})}));
// Site (front-end) na mesma raiz do servidor. Só esta lista explícita é pública.
const pub={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/favicon-32.png':'favicon-32.png','/apple-touch-icon.png':'apple-touch-icon.png','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/icon-maskable-512.png':'icon-maskable-512.png','/logo-mask.png':'logo-mask.png'};
app.get(Object.keys(pub),(q,s)=>{s.set('Cache-Control','no-cache');if(q.path.endsWith('.webmanifest'))s.type('application/manifest+json');s.sendFile(path.join(__dirname,pub[q.path]))});
app.use((q,s)=>s.status(404).type('text').send('Não encontrado'));
(async()=>{await pool.query(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS app_state(user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data JSONB NOT NULL,updated_at BIGINT NOT NULL)`);
app.listen(PORT,()=>console.log('StudyFlow rodando na porta '+PORT))})().catch(e=>{console.error('Falha ao iniciar:',e.message);process.exit(1)});
