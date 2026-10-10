const express=require('express'),path=require('path'),{Pool}=require('pg'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),{OAuth2Client}=require('google-auth-library');
const {DATABASE_URL,JWT_SECRET,GEMINI_API_KEY,GEMINI_MODEL='gemini-flash-latest',GOOGLE_CLIENT_ID='',PORT=3000}=process.env;
const googleClient=new OAuth2Client();
// Push no celular: precisa de VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (veja o LEIA-ME). Sem elas, o push fica desligado e o resto funciona normal.
const {VAPID_PUBLIC_KEY='',VAPID_PRIVATE_KEY='',VAPID_SUBJECT='mailto:contato@studyflow.app'}=process.env;
let webpush=null;try{webpush=require('web-push')}catch(e){console.error('Pacote web-push não instalado: push desligado.')}
const PUSH=!!(webpush&&VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY);if(PUSH)webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
if(!DATABASE_URL||!JWT_SECRET){console.error('Faltam variáveis de ambiente: DATABASE_URL e JWT_SECRET');process.exit(1)}
const pool=new Pool({connectionString:DATABASE_URL,ssl:/\.render\.com|neon\.tech|supabase\.|sslmode=/.test(DATABASE_URL)?{rejectUnauthorized:false}:false,idleTimeoutMillis:30000,connectionTimeoutMillis:15000,max:5});
pool.on('error',e=>console.error('Conexão ociosa do banco encerrada:',e.message));
const app=express();app.set('trust proxy',1);app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:{policy:'cross-origin'}}));
// CORS: permite que o site no GitHub Pages converse com este servidor. Outros sites: variável ALLOWED_ORIGINS (separados por vírgula).
const ORIGINS=(process.env.ALLOWED_ORIGINS||'https://fluxoproject.github.io').split(',').map(x=>x.trim().replace(/\/+$/,''));
app.use('/api',(q,s,n)=>{const o=q.headers.origin;if(o&&ORIGINS.includes(o)){s.set({'Access-Control-Allow-Origin':o,'Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Vary':'Origin'})}if(q.method==='OPTIONS')return s.sendStatus(204);n()});app.use(express.json({limit:'4mb'}));
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
async function photoData(url){url=String(url||'');try{if(!/^https:\/\/[a-z0-9.-]*googleusercontent\.com\//i.test(url))return url.slice(0,500);
const r=await fetch(url.replace(/=s\d+-c$/,'=s192-c'),{signal:AbortSignal.timeout(6000)});if(!r.ok)return url.slice(0,500);const b=Buffer.from(await r.arrayBuffer());if(!b.length||b.length>150000)return url.slice(0,500);
return 'data:'+((r.headers.get('content-type')||'image/jpeg').split(';')[0])+';base64,'+b.toString('base64')}catch(e){return url.slice(0,500)}}
app.post('/api/google',lim,w(async(q,s)=>{if(!GOOGLE_CLIENT_ID)return s.status(503).json({error:'Login Google ainda não foi configurado no servidor.'});
const ticket=await googleClient.verifyIdToken({idToken:String(q.body.credential||''),audience:GOOGLE_CLIENT_ID}),p=ticket.getPayload();
if(!p||!p.email||!p.email_verified)return s.status(401).json({error:'Não foi possível confirmar esta conta Google.'});
const email=p.email.toLowerCase(),name=String(p.name||'').slice(0,60),photo=await photoData(p.picture);
let r=await pool.query('SELECT id,email FROM users WHERE email=$1',[email]);let u=r.rows[0];
if(!u){r=await pool.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email',[email,name,await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'),10)]);u=r.rows[0]}
try{await pool.query('UPDATE users SET photo=$1,name=COALESCE(name,$2) WHERE id=$3',[photo.slice(0,200000),name,u.id])}catch(e){console.error('photo',e.message)}
s.json({token:sign(u),email:u.email,name,photo})}));
app.get('/api/me',auth,w(async(q,s)=>{const r=await pool.query('SELECT email,name,photo FROM users WHERE id=$1',[q.user.id]);const u=r.rows[0]||{};s.json({email:u.email||'',name:u.name||'',photo:u.photo||''})}));
app.get('/api/state',auth,w(async(q,s)=>{const since=Number(q.query.since)||0;if(since){const c=await pool.query('SELECT updated_at FROM app_state WHERE user_id=$1',[q.user.id]);if(c.rows[0]&&Number(c.rows[0].updated_at)<=since)return s.json({same:true,updatedAt:Number(c.rows[0].updated_at)})}
const r=await pool.query('SELECT data,updated_at FROM app_state WHERE user_id=$1',[q.user.id]);s.json(r.rows[0]?{data:r.rows[0].data,updatedAt:Number(r.rows[0].updated_at)}:{data:null,updatedAt:0})}));
app.put('/api/state',auth,w(async(q,s)=>{const{data,updatedAt}=q.body||{};if(!data||typeof data!=='object'||!Number.isFinite(updatedAt))return s.status(400).json({error:'Dados inválidos.'});
const r=await pool.query('INSERT INTO app_state(user_id,data,updated_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at WHERE app_state.updated_at<=EXCLUDED.updated_at RETURNING updated_at',[q.user.id,JSON.stringify(data),updatedAt]);
if(r.rowCount)return s.json({ok:true,updatedAt});const c=await pool.query('SELECT data,updated_at FROM app_state WHERE user_id=$1',[q.user.id]);s.status(409).json({error:'Há uma versão mais recente na nuvem.',data:c.rows[0].data,updatedAt:Number(c.rows[0].updated_at)})}));
// Gemini às vezes responde 503 (sobrecarga) ou 429: tenta 2x em cada modelo e, se falhar, usa o modelo reserva.
// Pensar demais deixa o tutor lento: pedimos "sem pensar" (thinkingBudget 0). Se o modelo não aceitar (erro 400), repete sem esse ajuste.
const MODELS=[GEMINI_MODEL,...(process.env.GEMINI_FALLBACK||'gemini-flash-lite-latest,gemini-2.5-flash').split(',').map(x=>x.trim())].filter((x,i,a)=>x&&a.indexOf(x)===i);
const noThink=new Set(),sleep=ms=>new Promise(z=>setTimeout(z,ms));
const TUTOR_THINK=Math.max(0,Math.min(8000,Number(process.env.TUTOR_THINKING??0)||0));
// Uma tentativa em um modelo. Se o modelo não aceitar "pensar 0" (erro 400), repete sem esse ajuste.
async function geminiTry(mod,obj,stream,ms,think,ac){
for(let n=0;n<2;n++){const tm=setTimeout(()=>ac.abort(),ms);
try{const o=noThink.has(mod)?obj:{...obj,generationConfig:{...obj.generationConfig,maxOutputTokens:((obj.generationConfig||{}).maxOutputTokens||1500)+think,thinkingConfig:{thinkingBudget:think}}};
const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(mod)+(stream?':streamGenerateContent?alt=sse':':generateContent'),{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify(o),signal:ac.signal});
if(r.ok){if(stream){clearTimeout(tm);return r}const j=await r.json();clearTimeout(tm);return j}
clearTimeout(tm);const j=await r.json().catch(()=>({}));console.error('Gemini',mod,r.status,JSON.stringify(j).slice(0,300));
if(r.status==400&&!noThink.has(mod)){noThink.add(mod);continue}
throw{status:r.status}}
catch(e){clearTimeout(tm);if(e&&e.status!=null)throw e;console.error('Gemini',mod,e&&e.message);throw{status:0}}}
throw{status:400}}
// Corrida entre modelos: se o principal falha na hora (429/503) o reserva já entra; com "hedge" (ms) o reserva também entra se o principal estiver lento.
// No máximo 2 rodadas, então o aluno nunca fica esperando minutos.
async function gemini(obj,stream,ms=12000,think=0,hedge=0){let last={status:0};
for(let round=0;round<2;round++){const acs=[];
const res=await new Promise(resolve=>{let started=0,failed=0,fin=false,timer=null;
const startNext=()=>{if(fin||started>=MODELS.length)return;const ac=new AbortController();acs.push(ac);const mod=MODELS[started++];
geminiTry(mod,obj,stream,ms,think,ac).then(r=>{if(fin)return;fin=true;clearTimeout(timer);acs.forEach(x=>x!==ac&&x.abort());resolve(r)},e=>{last=e&&e.status!=null?e:{status:0};if(fin)return;failed++;if(failed>=MODELS.length){fin=true;clearTimeout(timer);resolve(null)}else startNext()})};
startNext();if(hedge&&MODELS.length>1)timer=setTimeout(startNext,hedge)});
if(res)return res;
if(round==0&&[0,429,500,502,503,504].includes(last.status))await sleep(700);else break}
throw Object.assign(new Error('gemini'),last)}
const readT=(rd,ms=20000)=>{let t;return Promise.race([rd.read(),new Promise((_,j)=>{t=setTimeout(()=>j(new Error('stall')),ms)})]).finally(()=>clearTimeout(t))};
const SYS="Você é o tutor e o assistente do StudyFlow, para estudantes do Ensino Médio no Brasil. Responda em português do Brasil. SEJA BREVE: vá direto ao ponto, em no máximo 5 a 8 linhas. Só se aprofunde se o aluno pedir mais. NUNCA use LaTeX nem o símbolo $. Escreva matemática em texto simples: Δ, √, x², ×, ÷, ±, π, ≤, ≥, frações como a/b. Evite tabelas e títulos com #; use no máximo **negrito** e listas simples com \"-\". Ao criar exercícios, não entregue o gabarito junto. VOCÊ CONTROLA O APP INTEIRO. No contexto você vê: matérias com médias, tarefas, notas, provas, revisões, o foco (timer) em andamento, meta, nível e aparência. Quando o aluno pedir uma ação, faça. Para cada ação coloque, DEPOIS da resposta, uma linha no formato [[ACTION:{\"type\":\"...\"}]]. Pode mandar várias linhas (uma por ação). Diga em uma frase o que vai fazer, mas NUNCA afirme que já deu certo: o app confirma sozinho. FALTOU INFORMAÇÃO? PERGUNTE. Se faltar algo essencial (minutos do foco, matéria, data, valor da nota, nome da avaliação), faça UMA pergunta curta e NÃO envie ACTION ainda. Logo depois da pergunta, sugira respostas rápidas em uma linha [[OPTIONS:opção 1|opção 2|opção 3]] (até 5, curtas; ex.: [[OPTIONS:15 min|25 min|45 min|60 min]]). Se o aluno já deu tudo, não pergunte: execute. Se o pedido for vago (\"coloque nota na prova\"), pergunte a matéria e a nota. Se a matéria não existir no contexto, pergunte se deve criar. AÇÕES (JSON; datas em YYYY-MM-DD, use \"hoje\" do contexto para calcular amanhã, sexta etc.; notas de 0 a 10 com ponto): add_task {title,subject,due,min,pr} | edit_task {title,new_title,due,min,pr,subject} | complete_task {title} | uncomplete_task {title} | remove_task {title} | add_subject {name} | rename_subject {subject,new_name} | remove_subject {subject} | add_review {topic,subject,due} | complete_review {topic} | remove_review {topic} | add_exam {subject,due,topics} | remove_exam {subject,due} | add_grade {subject,name,value} | edit_grade {subject,name,value,new_name} | remove_grade {subject,name} | set_goal {minutes} | set_target {value} | start_focus {subject,topic,minutes} | pause_focus {} | resume_focus {} | stop_focus {save} (save true guarda o tempo estudado, false descarta) | make_pack {subject,topic} (prepara uma revisão completa com resumo e questões difíceis) | open_pack {topic} | navigate {page,subject} (páginas: inicio, materias, tarefas, estudos, timer, mais, perfil, notificacoes, revisoes, progresso, tutor, personalizacao, conta, novidades) | set_style {mode: dark|light|auto, accent: nome da cor ou #hex, bg: pad|cor|graf|puro, anim: off|soft|normal|full} | set_name {name}. REVISE ANTES DE RESPONDER (em silêncio, sem escrever a revisão): (1) a resposta está correta e responde exatamente o que foi pedido? Em contas e fatos, confira passo a passo. (2) Olhei o contexto: a matéria, tarefa, prova, revisão ou nota JÁ EXISTE? NUNCA crie de novo o que já existe (veja materiasQueJaExistem); adicione só o que falta e diga em uma frase o que já existia. (3) As ações usam os nomes exatamente como estão no contexto, com datas e notas válidas, e só o que o aluno pediu? (4) Está curta, em português, sem LaTeX? Se algo falhar, corrija antes de responder. Se o pedido for vago (ex.: \"coloque umas matérias\"), não invente: pergunte quais, com [[OPTIONS:...]]. Para abrir telas use navigate: \"abre minhas notas de matemática\" = navigate {page:\"materias\",subject:\"Matemática\"}; \"abre as configurações\" = personalizacao; \"abre o timer\" = timer; \"abre as notificações\" = notificacoes; \"mostra meu progresso\" = progresso; \"abre a revisão de X\" = open_pack {topic:\"X\"}. Você pode apagar tarefas, matérias, notas, provas e revisões quando o aluno pedir claramente. Nunca invente uma ação que o aluno não pediu. Para pedidos só de explicação, não envie ACTION. Se o aluno perguntar sobre notas, médias, provas, tarefas, revisões ou o foco, responda usando o contexto, sem inventar dados que não estejam nele.";
function prep(q){const msg=String(q.body.message||'').slice(0,2000);if(!msg.trim())return{err:'Escreva sua dúvida.'};
const c=q.body.appContext&&typeof q.body.appContext==='object'?q.body.appContext:{},ctx=JSON.stringify(c).slice(0,9000);
const hist=(Array.isArray(q.body.history)?q.body.history:[]).slice(-8).map(m=>({role:m.u?'user':'model',text:String(m.t||'').slice(0,1200)})).filter(m=>m.text);
const turns=[...hist,{role:'user',text:msg}].reduce((a,m)=>{a.at(-1)?.role===m.role?a.at(-1).text+='\n'+m.text:a.push({...m});return a},[]);while(turns[0].role!=='user')turns.shift();
return{obj:{systemInstruction:{parts:[{text:SYS+'\nContexto atual do app (JSON): '+ctx}]},contents:turns.map(t=>({role:t.role,parts:[{text:t.text}]})),generationConfig:{maxOutputTokens:1500,temperature:.6}}}}
const textOf=j=>{const c=j&&j.candidates&&j.candidates[0];return((c&&c.content&&c.content.parts)||[]).filter(p=>!p.thought).map(p=>p.text||'').join('')};
const blocked=j=>!!((j&&j.promptFeedback&&j.promptFeedback.blockReason)||(j&&j.candidates&&j.candidates[0]&&j.candidates[0].finishReason==='SAFETY'));
const BLOCKMSG='Não consigo ajudar com esse pedido. Tente perguntar de outro jeito, focado nos estudos.',EMPTY='Não consegui responder essa. Tente reformular a pergunta.';
const errOf=st=>({status:st==429?429:502,error:st==429?'Limite do tutor atingido. Tente de novo em instantes.':'O tutor está sobrecarregado agora. Tente de novo em alguns segundos.'});
// Versão em tempo real: o texto vai chegando aos poucos (muito mais rápido de ver) em vez de esperar a resposta inteira.
app.post('/api/tutor/stream',auth,tlim,async(q,s)=>{try{
if(!GEMINI_API_KEY)return s.status(503).json({error:'Tutor ainda não configurado no servidor.'});
const pr=prep(q);if(pr.err)return s.status(400).json({error:pr.err});
let r;try{r=await gemini(pr.obj,true,12000,TUTOR_THINK,4500)}catch(e){const x=errOf(e.status||0);return s.status(x.status).json({error:x.error})}
s.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});s.flushHeaders();
const send=o=>{if(!s.writableEnded)s.write('data: '+JSON.stringify(o)+'\n\n')};
const rd=r.body.getReader(),dec=new TextDecoder();let buf='',any=0,blk=0,gone=false;s.on('close',()=>{gone=true;rd.cancel().catch(()=>{})});
try{for(;;){const{done,value}=await readT(rd);if(done)break;buf+=dec.decode(value,{stream:true});
let i;while((i=buf.search(/\r?\n\r?\n/))>=0){const ev=buf.slice(0,i);buf=buf.slice(i).replace(/^\r?\n\r?\n/,'');
for(const ln of ev.split(/\r?\n/)){if(!ln.startsWith('data:'))continue;let j;try{j=JSON.parse(ln.slice(5))}catch(e){continue}
if(blocked(j))blk=1;const t=textOf(j);if(t){any=1;send({t})}}}}}
catch(e){if(!gone){console.error('Stream:',e.message);send({err:any?'A resposta foi cortada no meio.':'O tutor está sobrecarregado agora. Tente de novo.'})}}
if(!any&&!gone)send({t:blk?BLOCKMSG:EMPTY});send({done:1});s.end()}
catch(e){console.error(e);if(!s.headersSent)s.status(500).json({error:'Erro no servidor. Tente novamente.'});else s.end()}});
// Versão normal (usada se o tempo real falhar)
app.post('/api/tutor',auth,tlim,w(async(q,s)=>{if(!GEMINI_API_KEY)return s.status(503).json({error:'Tutor ainda não configurado no servidor.'});
const pr=prep(q);if(pr.err)return s.status(400).json({error:pr.err});
let j;try{j=await gemini(pr.obj,false,20000,TUTOR_THINK,6000)}catch(e){const x=errOf(e.status||0);return s.status(x.status).json({error:x.error})}
const reply=textOf(j).trim();if(!reply&&blocked(j))return s.json({reply:BLOCKMSG});
s.json({reply:reply||EMPTY})}));

// ================= Revisão completa feita pela IA =================
const PACKSYS="Você é um professor experiente do Ensino Médio brasileiro (nível ENEM e vestibular). Monte uma REVISÃO COMPLETA do conteúdo pedido. Responda APENAS com JSON válido, sem texto fora do JSON e sem LaTeX (escreva fórmulas em texto simples: x², √, ÷, ×, a/b). Formato: {\"summary\":\"resumo completo e organizado do conteúdo, de 10 a 18 linhas, com conceitos, fórmulas e exemplos; pode usar **negrito**\",\"points\":[\"6 a 10 pontos-chave curtos\"],\"qs\":[...]}. Em qs coloque 10 questões de dificuldade FÁCIL, claramente mais fáceis que as do ENEM: as 6 primeiras bem diretas (lembrar um conceito, definição ou fórmula do resumo), as demais com raciocínio de apenas 1 passo; sem pegadinhas, sem contas longas, enunciados curtos; as questões abertas pedem respostas curtas (1 a 3 frases); use linguagem simples e clara: 6 de múltipla escolha {\"type\":\"mc\",\"q\":\"enunciado\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":0 a 3,\"explain\":\"explicação do porquê da certa e do erro das outras\"} e 4 abertas {\"type\":\"open\",\"q\":\"pergunta\",\"model\":\"resposta esperada com os pontos que valem nota\"}. Intercale os tipos. As alternativas erradas devem ser plausíveis. Confira as contas e os fatos.";
function parsePack(t){try{const d=JSON.parse(String(t).replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim());if(!d||typeof d.summary!=='string'||!Array.isArray(d.qs))return null;
const qs=d.qs.map(q=>{if(!q||typeof q.q!=='string')return null;if(q.type==='mc'){const o=Array.isArray(q.options)?q.options.map(x=>String(x).slice(0,300)).slice(0,4):[],a=Number(q.answer);if(o.length<4||!(a>=0&&a<=3))return null;return{type:'mc',q:q.q.slice(0,900),options:o,answer:Math.round(a),explain:String(q.explain||'').slice(0,900)}}
if(q.type==='open')return{type:'open',q:q.q.slice(0,900),model:String(q.model||'').slice(0,1200)};return null}).filter(Boolean);
if(qs.length<4)return null;return{summary:d.summary.slice(0,4500),points:(Array.isArray(d.points)?d.points:[]).map(x=>String(x).slice(0,300)).slice(0,10),qs:qs.slice(0,12)}}catch(e){return null}}
async function genPack(topic,subject,kind){const ask='Matéria: '+subject+'\nConteúdo: '+topic+'\nObjetivo: '+(kind==='exam'?'revisão para uma prova':'revisão do conteúdo')+'\nMonte a revisão completa em JSON.';
for(let t=0;t<2;t++){const j=await gemini({systemInstruction:{parts:[{text:PACKSYS}]},contents:[{role:'user',parts:[{text:ask}]}],generationConfig:{maxOutputTokens:8000,temperature:.7,responseMimeType:'application/json'}},false,80000,1024),d=parsePack(textOf(j));if(d)return d}
throw new Error('pack inválido')}
const packKey=(rid,due)=>(String(rid).slice(0,40)+'_'+String(due).slice(0,10)).replace(/[^\w-]/g,'');
const packBusy=new Map();
async function packFor(uid,b){const key=packKey(b.rid,b.due),ex=await pool.query('SELECT data FROM packs WHERE user_id=$1 AND key=$2',[uid,key]);if(ex.rowCount)return ex.rows[0].data;
const k=uid+':'+key;if(packBusy.has(k))return packBusy.get(k);
const pr=(async()=>{const d=await genPack(String(b.topic).slice(0,300),String(b.subject).slice(0,80),b.kind),data={key,rid:String(b.rid).slice(0,40),due:String(b.due).slice(0,10),kind:b.kind==='exam'?'exam':b.kind==='topic'?'topic':'review',topic:String(b.topic).slice(0,200),subject:String(b.subject).slice(0,80),sid:String(b.sid||'').slice(0,40),created:Date.now(),...d};
await pool.query('INSERT INTO packs(user_id,key,data,created_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[uid,key,JSON.stringify(data),data.created]);return data})();
packBusy.set(k,pr);try{return await pr}finally{packBusy.delete(k)}}
app.post('/api/pack',auth,tlim,w(async(q,s)=>{if(!GEMINI_API_KEY)return s.status(503).json({error:'A IA ainda não foi configurada no servidor.'});const b=q.body||{};
if(!String(b.topic||'').trim()||!String(b.subject||'').trim()||!/^\d{4}-\d\d-\d\d$/.test(String(b.due||'')))return s.status(400).json({error:'Faltou o conteúdo, a matéria ou a data.'});
try{s.json({pack:await packFor(q.user.id,b)})}catch(e){console.error('Pack:',e.message);s.status(502).json({error:'Não consegui montar a revisão agora. Tente de novo em instantes.'})}}));
app.post('/api/pack/grade',auth,tlim,w(async(q,s)=>{if(!GEMINI_API_KEY)return s.status(503).json({error:'A IA ainda não foi configurada no servidor.'});const b=q.body||{},ans=String(b.answer||'').slice(0,2000);
if(ans.trim().length<2)return s.status(400).json({error:'Escreva sua resposta primeiro.'});
let j;try{j=await gemini({systemInstruction:{parts:[{text:'Você corrige respostas de alunos do Ensino Médio no Brasil, comparando com a resposta esperada. Seja justo, específico e generoso: se a ideia principal estiver certa, dê nota alta (7 ou mais), mesmo que falte algum detalhe. Responda APENAS com JSON: {"score": número de 0 a 10 (até 1 casa decimal), "feedback": "2 a 4 frases em português: o que acertou, o que faltou e como melhorar"}. Sem LaTeX.'}]},contents:[{role:'user',parts:[{text:'Conteúdo: '+String(b.topic||'').slice(0,200)+'\nPergunta: '+String(b.q||'').slice(0,900)+'\nResposta esperada: '+String(b.model||'').slice(0,1200)+'\nResposta do aluno: '+ans}]}],generationConfig:{maxOutputTokens:700,temperature:.2,responseMimeType:'application/json'}},false,30000)}
catch(e){return s.status(502).json({error:'Não consegui corrigir agora. Tente de novo.'})}
try{const d=JSON.parse(textOf(j).replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim());s.json({score:Math.max(0,Math.min(10,Number(d.score)||0)),feedback:String(d.feedback||'').slice(0,800)})}catch(e){s.status(502).json({error:'Não consegui corrigir agora. Tente de novo.'})}}));
app.post('/api/packs/clear',auth,w(async(q,s)=>{await pool.query('DELETE FROM packs WHERE user_id=$1',[q.user.id]);s.json({ok:true})}));
app.get('/api/packs',auth,w(async(q,s)=>{const r=await pool.query('SELECT data FROM packs WHERE user_id=$1 AND created_at>$2 ORDER BY created_at LIMIT 20',[q.user.id,Number(q.query.since)||0]);s.json({packs:r.rows.map(x=>x.data)})}));

// ================= Push no celular =================
app.get('/api/push/key',auth,(q,s)=>PUSH?s.json({key:VAPID_PUBLIC_KEY}):s.status(503).json({error:'Push ainda não configurado no servidor.'}));
app.post('/api/push/subscribe',auth,w(async(q,s)=>{if(!PUSH)return s.status(503).json({error:'Push ainda não configurado no servidor.'});const sub=q.body&&q.body.subscription,tz=Math.max(-840,Math.min(840,Math.round(Number(q.body&&q.body.tz))||0));
if(!sub||typeof sub.endpoint!=='string'||!sub.keys||!sub.keys.p256dh||!sub.keys.auth)return s.status(400).json({error:'Inscrição inválida.'});
await pool.query('INSERT INTO push_subs(user_id,endpoint,p256dh,auth,tz) VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,tz=EXCLUDED.tz',[q.user.id,sub.endpoint.slice(0,1000),String(sub.keys.p256dh).slice(0,200),String(sub.keys.auth).slice(0,100),tz]);s.json({ok:true})}));
app.post('/api/push/unsubscribe',auth,w(async(q,s)=>{await pool.query('DELETE FROM push_subs WHERE user_id=$1 AND endpoint=$2',[q.user.id,String((q.body&&q.body.endpoint)||'')]);s.json({ok:true})}));
async function pushTo(row,payload){try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload),{TTL:6*3600});return true}
catch(e){if(e.statusCode===404||e.statusCode===410)await pool.query('DELETE FROM push_subs WHERE endpoint=$1',[row.endpoint]).catch(()=>{});else console.error('Push:',e.statusCode||e.message);return false}}
app.post('/api/push/test',auth,w(async(q,s)=>{if(!PUSH)return s.status(503).json({error:'Push ainda não configurado no servidor.'});const rows=(await pool.query('SELECT * FROM push_subs WHERE user_id=$1',[q.user.id])).rows;
if(!rows.length)return s.status(404).json({error:'Este aparelho ainda não está inscrito. Ative o push primeiro.'});let ok=0;for(const r of rows)if(await pushTo(r,{title:'StudyFlow',body:'Notificações funcionando! Você receberá avisos de revisões, provas e sequência.',url:'./?go=notifs',tag:'test'}))ok++;
ok?s.json({ok:true}):s.status(502).json({error:'Não consegui enviar. Desative e ative o push de novo.'})}));
// Agendador: a cada 10 minutos olha o app de cada pessoa inscrita e avisa (das 8h às 21h, no horário dela). Cada aviso sai uma vez só.
const ymdOf=ms=>new Date(ms).toISOString().slice(0,10),addD=(y,n)=>ymdOf(Date.parse(y+'T12:00:00Z')+n*864e5),packFail=new Map();let pushing=false;
async function runPush(){if(!PUSH||pushing)return;pushing=true;
try{const subs=(await pool.query('SELECT * FROM push_subs')).rows,by={};subs.forEach(r=>(by[r.user_id]=by[r.user_id]||[]).push(r));
for(const uid of Object.keys(by)){const rows=by[uid],tz=rows[0].tz||0,local=Date.now()-tz*60000,hour=new Date(local).getUTCHours(),t=ymdOf(local);const st=(await pool.query('SELECT data FROM app_state WHERE user_id=$1',[uid])).rows[0];if(!st||!st.data)continue;const d=st.data,qh=(d.set&&Array.isArray(d.set.qh)&&d.set.qh.length==2)?d.set.qh.map(Number):[8,21],nt=(d.set&&d.set.nt)||{};if(hour<qh[0]||hour>=qh[1])continue;const sn=id=>((d.subjects||[]).find(x=>x.id===id)||{}).name||'',ev=[];
const rv=(d.reviews||[]).filter(r=>!r.done&&r.due<=t);if(rv.length)ev.push({cat:'rev',key:'rv:'+t,title:rv.length===1?'1 revisão para hoje':rv.length+' revisões para hoje',body:rv.slice(0,3).map(r=>r.topic).join(', ')});
(d.exams||[]).forEach(e=>{if(e.date===addD(t,1))ev.push({cat:'rev',key:'ex1:'+e.id,title:'Prova amanhã: '+sn(e.subject),body:e.topics||'Hora da revisão final!'});if(e.date===t)ev.push({cat:'rev',key:'ex0:'+e.id,title:'Prova hoje: '+sn(e.subject),body:'Boa sorte!'})});
const tk=(d.tasks||[]).filter(x=>!x.done&&x.due===t);if(tk.length)ev.push({cat:'rot',key:'tk:'+t,title:tk.length===1?'1 tarefa para hoje':tk.length+' tarefas para hoje',body:tk.slice(0,3).map(x=>x.title).join(', ')});
if(hour>=19){const days=new Set((d.sessions||[]).map(x=>ymdOf((x.startedAt||0)-tz*60000)));if(!days.has(t)&&days.has(addD(t,-1)))ev.push({cat:'rot',key:'st:'+t,title:'Sua sequência está em risco',body:'Estude um pouquinho hoje para não perder os dias seguidos.'})}
if(GEMINI_API_KEY&&nt.rev!==0){const want=[...(d.reviews||[]).filter(r=>!r.done&&r.due<=addD(t,1)&&r.due>=addD(t,-2)).map(r=>({rid:r.id,kind:'review',topic:r.topic,subject:sn(r.subject),sid:r.subject,due:r.due})),...(d.exams||[]).filter(e=>e.date<=addD(t,1)&&e.date>=t).map(e=>({rid:e.id,kind:'exam',topic:e.topics||'Conteúdo geral da prova',subject:sn(e.subject),sid:e.subject,due:e.date}))];let made=0;
for(const x of want){if(made>=2)break;const key=packKey(x.rid,x.due),fk=uid+':'+key;if((packFail.get(fk)||0)>Date.now()-6e5*3)continue;if((await pool.query('SELECT 1 FROM packs WHERE user_id=$1 AND key=$2',[uid,key])).rowCount)continue;
try{await packFor(uid,x);made++;ev.push({cat:'rev',key:'pk:'+key,title:'Sua revisão completa está pronta',body:x.topic+(x.subject?' · '+x.subject:'')})}catch(e){packFail.set(fk,Date.now());console.error('Pack agendado:',e.message)}}}
for(const e of ev.filter(x=>nt[x.cat]!==0)){const ins=await pool.query('INSERT INTO push_sent(user_id,key) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING 1',[uid,e.key]);if(ins.rowCount)for(const r of rows)await pushTo(r,{title:e.title,body:e.body,url:'./?go=notifs',tag:e.key})}}
await pool.query("DELETE FROM push_sent WHERE ts<now()-interval '60 days'").catch(()=>{})}
catch(e){console.error('runPush:',e.message)}pushing=false}
// Site (front-end) na mesma raiz do servidor. Só esta lista explícita é pública.
const pub={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/favicon-32.png':'favicon-32.png','/apple-touch-icon.png':'apple-touch-icon.png','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/icon-maskable-512.png':'icon-maskable-512.png','/logo-mask.png':'logo-mask.png'};
app.get(Object.keys(pub),(q,s)=>{s.set('Cache-Control','no-cache');if(q.path.endsWith('.webmanifest'))s.type('application/manifest+json');s.sendFile(path.join(__dirname,pub[q.path]))});
app.use((q,s)=>s.status(404).type('text').send('Não encontrado'));
(async()=>{await pool.query(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;
CREATE TABLE IF NOT EXISTS app_state(user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data JSONB NOT NULL,updated_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS packs(user_id INT REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,data JSONB NOT NULL,created_at BIGINT NOT NULL,PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS push_subs(id SERIAL PRIMARY KEY,user_id INT REFERENCES users(id) ON DELETE CASCADE,endpoint TEXT UNIQUE NOT NULL,p256dh TEXT NOT NULL,auth TEXT NOT NULL,tz INT DEFAULT 0,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS push_sent(user_id INT REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,ts TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,key))`);
app.listen(PORT,()=>{console.log('StudyFlow rodando na porta '+PORT+(PUSH?' (push ligado)':' (push desligado)'));if(PUSH){setInterval(runPush,10*60*1000);setTimeout(runPush,30000)}})})().catch(e=>{console.error('Falha ao iniciar:',e.message);process.exit(1)});
