// ===================== CONFIGURAÇÃO =====================
// Endereço do servidor no Render (login, nuvem e tutor). Funciona tanto pelo GitHub Pages quanto pelo próprio Render.
const API_URL='https://study-sw84.onrender.com';
// Cole aqui o mesmo Client ID Web criado no Google Cloud (termina em .apps.googleusercontent.com).
const GOOGLE_CLIENT_ID='650684317927-tg1vr1nt4opu0u5ukt2vl7t29o7qiddd.apps.googleusercontent.com';
// ========================================================

const K='studyflow.v1',$=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,9),
day=t=>new Date(t).toLocaleDateString('sv'),pad=n=>String(n).padStart(2,'0'),
fmt=s=>{s=Math.max(0,Math.round(s));return pad(s/60|0)+':'+pad(s%60)},
hm=s=>{const m=Math.round(s/60);return m>=60?(m/60|0)+'h'+pad(m%60)+'min':m+'min'},
esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
add=(d,n)=>day(Date.now()+n*864e5),today=()=>day(Date.now());
const PAL=['#3B82F6','#F59E0B','#10B981','#06B6D4','#EF4444','#F97316','#84CC16','#EC4899'];
let icPick=0,streaming=0,popId=null,busy=0,tErr=null,tmsg='Pensando…',ab=0,lp='',rvf='more',S,page='home',sub='',done=null,chat=[],ttab='d3',rtab='pend',range='semana',fm={s:'',t:''},dsel=25,showRF=0,pt,dirty=0,saveVer=0,syncing=0,syncAgain=0,remoteTs=0,pendRender=0,pendNav=null,pendOpen=null,achF='all',nfilt='all',askRes=null,lastSync=0,pushSt='off',SNAP={};

// ---------- dados ----------
// ---------- versão, novidades e base da sincronização ----------
const APP_VER='2.1',DEV=(()=>{try{return localStorage['sf.dev']||(localStorage['sf.dev']=Math.random().toString(36).slice(2,10))}catch(e){return'x'}})();
const CHANGELOG=[{v:'2.1',d:'2026-10-08',t:'Sons, revisões e avisos',it:[
'Sons no app: toques, conquistas, nível, foco e avisos (dá para desligar em Personalização)',
'Sons relaxantes infinitos para estudar: 14 sons de ambiente e 13 músicas calmas, liberados por nível',
'Revisões mais fáceis: botão Revisar agora, avaliação rápida e nova revisão em poucos toques',
'Revisão completa da IA com questões um pouco mais fáceis',
'Notificações com visual novo; os ajustes agora ficam em Mais > Ajustes de avisos',
'Personalização mais simples: a cor manual saiu e ficaram só as cores prontas']},{v:'2.0',d:'2026-10-06',t:'Grande atualização',it:[
'IA com controle total do app: lança notas, marca provas, cria tarefas, inicia e para o timer, muda o visual e pergunta o que faltar',
'Sininho virou central de notificações: notas, revisões, provas, tarefas, conquistas e novidades do app',
'Revisão completa preparada pela IA 1 dia antes, com resumo e questões difíceis (múltipla escolha e abertas)',
'Sincronização perfeita entre aparelhos: conta, conteúdo, personalização e até o timer, item por item',
'Recompensas ao subir de nível: cores, fundos, molduras de foto e títulos',
'Mais de 40 conquistas',
'Personalização completa: animações, cantos, tamanho do texto, vidro e vibração',
'Notificações push no celular (ative em Notificações)',
'Correções: foto de perfil, modo claro, "Continuar sem conta", botão do Google e janelas nativas feias']}];
// o que é sincronizado: listas (item por item, com data de alteração) e valores soltos (vale o mais recente)
const COLS=['subjects','tasks','grades','exams','sessions','reviews','notifs','packs'],SCAL=['user','goal','target','ach','set','active','lv','cnt'];
const stable=v=>JSON.stringify(v,(k,x)=>x&&typeof x=='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((r,y)=>(r[y]=x[y],r),{}):x),
strip=o=>{const c={...o};delete c.updatedAt;if(c.active){c.active={...c.active};delete c.active.seen;delete c.active.recover}return c},
sv=k=>k=='active'?(S.active?stable({...S.active,seen:0,recover:0}):'null'):stable(S[k]===undefined?null:S[k]);
function persist(){try{localStorage[K]=JSON.stringify(S)}catch(e){}}
// foto do estado atual: serve para descobrir o que mudou desde o último salvamento
function snapshot(){SNAP={};COLS.forEach(c=>(S[c]||[]).forEach(x=>SNAP[x.id]=stable({...x,_t:0})));SCAL.forEach(k=>SNAP['$'+k]=sv(k))}
// carimba a data de cada item alterado/apagado (apagados viram "lápides" para o outro aparelho também apagar)
function stamp(){const n=Date.now(),seen=new Set();S.del=S.del||{};S.st=S.st||{};
COLS.forEach(c=>S[c].forEach(x=>{seen.add(x.id);const j=stable({...x,_t:0});if(SNAP[x.id]!==j){x._t=n;SNAP[x.id]=j;delete S.del[x.id]}}));
Object.keys(SNAP).forEach(id=>{if(id[0]!='$'&&!seen.has(id)){S.del[id]=n;delete SNAP[id]}});
SCAL.forEach(k=>{const j=sv(k);if(SNAP['$'+k]!==j){S.st[k]=n;SNAP['$'+k]=j}});
const old=n-90*864e5;for(const id in S.del)if(S.del[id]<old)delete S.del[id]}
// junta dois estados sem perder nada: item mais recente vence, apagado só some se for mais novo que o item.
// "Apagar tudo" grava resetAt: tudo que é mais antigo que isso (em qualquer aparelho) é descartado.
function merge(L,R){const ra=Math.max(L.resetAt||0,R.resetAt||0),lr=L.resetAt||0,rr=R.resetAt||0,M={...L},del={...(L.del||{})};for(const k in(R.del||{}))del[k]=Math.max(del[k]||0,R.del[k]);
COLS.forEach(c=>{const m=new Map();(L[c]||[]).filter(x=>(x._t||0)>=ra).forEach(x=>m.set(x.id,x));(R[c]||[]).filter(x=>(x._t||0)>=ra).forEach(x=>{const o=m.get(x.id);if(!o||(x._t||0)>(o._t||0))m.set(x.id,x)});M[c]=[...m.values()].filter(x=>!(del[x.id]&&del[x.id]>=(x._t||0)))});
M.st={...(L.st||{})};SCAL.forEach(k=>{const l=(L.st||{})[k]||0,r=(R.st||{})[k]||0,lv=l>=ra?l:-1,rv=r>=ra?r:-1;if(rv>lv||(L[k]===undefined&&R[k]!==undefined&&(!ra||rv>=0))){M[k]=R[k];M.st[k]=r}else if(lv<0&&rv<0&&ra){M[k]=R[k]!==undefined?R[k]:L[k]}});
const f=o=>Object.fromEntries(Object.entries(o||{}).filter(([,v])=>v>=ra));
M.ach={...f(R.ach),...f(L.ach)};
if(rr>lr){M.lv=R.lv;M.cnt={...(R.cnt||{})}}else if(lr>rr){M.lv=L.lv;M.cnt={...(L.cnt||{})}}
else{M.lv=Math.max(L.lv||0,R.lv||0)||M.lv;M.cnt={...(R.cnt||{})};for(const k in(L.cnt||{}))M.cnt[k]=Math.max(M.cnt[k]||0,L.cnt[k])}
M.del=del;if(ra)M.resetAt=ra;return M}
const GLOGO='<svg class="gl" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.2 6.9-17.6z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>';

function demo(){const m=['Matemática','Português','História','Geografia','Biologia','Física','Química','Inglês'].map((name,i)=>({id:uid(),name,color:PAL[i]}));
const id=n=>m.find(x=>x.name==n).id,ses=[];
[[0,'Matemática',1500],[0,'História',1200],[1,'Biologia',1800],[2,'Matemática',2400],[3,'Português',1500],[4,'Física',1200],[5,'Matemática',3000],[6,'Química',1500]].forEach(([d,n,s])=>{const t=Date.now()-d*864e5-36e5;ses.push({id:uid(),subject:id(n),topic:'Revisão',startedAt:t,endedAt:t+s*1e3,duration:s,status:'completed'})});
return{pal:4,demo:1,user:{name:'Dudu',year:'',school:''},subjects:m,tasks:[['Revisar matemática','Matemática',0,40,'Alta'],['Fazer trabalho de história','História',1,90,'Média'],['Estudar biologia','Biologia',2,30,'Média'],['Ler capítulo de português','Português',3,40,'Baixa'],['Redação','Português',6,60,'Média']].map(([title,s,d,min,pr])=>({id:uid(),title,subject:id(s),due:add(0,d),min,pr,done:false})),
grades:[['Matemática','Prova 1',8.5],['Matemática','Trabalho',7.5],['Português','Prova 1',7.8],['História','Prova 1',9],['Biologia','Prova 1',8.2]].map(([s,name,v])=>({id:uid(),subject:id(s),name,v})),
exams:[{id:uid(),subject:id('Matemática'),date:add(0,8)},{id:uid(),subject:id('Física'),date:add(0,15)}],sessions:ses,reviews:[['Revolução Industrial','História',0],['Equações do 2º grau','Matemática',1],['Célula eucarionte','Biologia',3]].map(([topic,s,d])=>({id:uid(),topic,subject:id(s),due:add(0,d),done:false})),active:null}}
const empty=()=>({pal:4,user:{name:'Dudu',year:'',school:''},subjects:[],tasks:[],grades:[],exams:[],sessions:[],reviews:[],notifs:[],packs:[],active:null,set:{},del:{},st:{}});
// garante os campos e aplica as cores novas das matérias (uma vez)
const fix=()=>{S.user=S.user||{name:'Dudu',photo:''};S.user.photo=S.user.photo||'';S.ach=S.ach||{};S.set=S.set||{};S.del=S.del||{};S.st=S.st||{};S.cnt=S.cnt||{};COLS.forEach(k=>S[k]=S[k]||[]);
if(S.pal!=4){S.subjects.forEach((s,i)=>s.color=PAL[i%PAL.length]);S.pal=4}
const t0=S.updatedAt||0;COLS.forEach(c=>S[c].forEach(x=>{if(x._t==null)x._t=t0}));SCAL.forEach(k=>{if(S.st[k]==null)S.st[k]=t0});
if(S.set.mode==null){let p={};try{p=JSON.parse(localStorage['sf.pers']||'{}')||{}}catch(e){}S.set={...S.set,mode:localStorage['sf.theme']||'dark',acc:p.acc||null,bg:p.bg||'pad'}}};
try{S=JSON.parse(localStorage[K])}catch(e){}S=S||empty();fix();snapshot();
const save=()=>{checkAch();lvCheck();stamp();S.updatedAt=Date.now();persist();push()},sj=id=>S.subjects.find(s=>s.id==id)||{name:'—',color:'#bbb'};
const opts=sel=>S.subjects.map(s=>`<option value="${s.id}" ${s.id==sel?'selected':''}>${esc(s.name)}</option>`).join('');

// ---------- cronômetro: tempo real = soma dos trechos [início, fim] ----------
const elapsed=a=>a.segs.reduce((t,[s,e])=>t+((e??Date.now())-s),0)/1e3,running=a=>a&&a.segs.at(-1)[1]==null;
function startS(){const subject=$('#ss').value,topic=$('#st').value.trim()||'Estudo livre',min=+dsel||25;if(!subject)return alert('Crie uma matéria primeiro.');
S.active={id:uid(),dev:DEV,subject,topic,planned:min*60,startedAt:Date.now(),segs:[[Date.now(),null]],seen:Date.now()};buzz(25);Snd.ui('start');sndAuto(1);page='timer';save();render()}
function pause(){const a=S.active;Snd.ui(running(a)?'pause':'start');if(running(a)){a.segs.at(-1)[1]=Date.now();buzz(18)}else{a.segs.push([Date.now(),null]);buzz(18)}save();render(1)}
function finish(cancel){const a=S.active;if(!a)return;Snd.ui(cancel?'del':'finish');sndAuto(0);if(running(a))a.segs.at(-1)[1]=Date.now();S.active=null;
if(cancel||elapsed(a)<5){save();return go('study')}
const r={id:a.id||uid(),subject:a.subject,topic:a.topic,startedAt:a.startedAt,endedAt:a.segs.at(-1)[1],duration:Math.round(elapsed(a)),status:'completed'};S.sessions.push(r);done=r;page='timer';save();render()}
function rate(n){const d=[1,2,4,7,14][n-1];S.reviews.push({id:'rv_'+done.id,topic:done.topic,subject:done.subject,due:add(0,d),done:false});done=null;save();go('study')}
setInterval(()=>{const a=S.active;if(!a)return;if(running(a)){a.seen=Date.now();localStorage[K]=JSON.stringify(S);if(elapsed(a)>=a.planned){buzz([250,120,250]);sysNotify('Foco concluído','Você completou '+Math.round(a.planned/60)+' min de '+sj(a.subject).name+'.');return finish()}}const mt=$('#mt');if(mt)mt.textContent=fmt(a.planned-elapsed(a));const t=$('#tm');if(t){t.textContent=fmt(a.planned-elapsed(a));const g=$('#rg'),C=2*Math.PI*78;if(g)g.setAttribute('stroke-dashoffset',C*Math.min(1,elapsed(a)/a.planned))}},1000);

// ---------- métricas ----------
const dur=f=>S.sessions.filter(f).reduce((t,s)=>t+s.duration,0);
function streak(){let n=0,i=0;const ds=new Set(S.sessions.map(s=>day(s.startedAt)));if(!ds.has(add(0,0)))i=-1;while(ds.has(add(0,i-n)))n++;return n}
const longest=()=>{const d=[...new Set(S.sessions.map(s=>day(s.startedAt)))].sort();let b=0,c=0,p=null;d.forEach(x=>{c=p&&Math.round((new Date(x)-new Date(p))/864e5)==1?c+1:1;b=Math.max(b,c);p=x});return b};
function avg(id){const g=S.grades.filter(g=>g.subject==id);return g.length?g.reduce((t,x)=>t+x.v,0)/g.length:null}
// notas: a média é sempre arredondada PARA BAIXO (5,95 vira 5,9). A nota que falta tirar arredonda PARA CIMA, para não prometer o que não fecha a conta.
const fl=v=>Math.floor(v*10+1e-9)/10,ce=v=>Math.ceil(v*10-1e-9)/10,vir=v=>v.toFixed(1).replace('.',','),
f1=v=>v==null?'—':vir(fl(v)),fc=v=>vir(ce(v)),r2=v=>String(Math.round(v*100)/100).replace('.',',');
const achAll=()=>ACH().map(a=>({...a,ok:a.v>=a.t||!!(S.ach||{})[a.id],p:Math.min(1,a.v/a.t)})),
achList=()=>achAll().filter(a=>achF=='all'||(achF=='got'?a.ok:!a.ok)).sort((x,y)=>(x.ok-y.ok)||(y.p-x.p)),
achHead=()=>{const A=achAll(),g=A.filter(a=>a.ok);return`<h2 style="margin:22px 0 4px">Conquistas <small class="mu">${g.length}/${A.length} · ${g.reduce((t,a)=>t+a.x,0)} XP</small></h2><div class="strip">${[['all','Todas'],['todo','Em andamento'],['got','Conquistadas']].map(([k,l])=>`<button class="${achF==k?'on':''}" onclick="achF='${k}';render(1)">${l}</button>`).join('')}</div>`};
const rdone=()=>S.reviews.filter(r=>r.done).length,xp=()=>Math.round(dur(()=>1)/60)+rdone()*20+S.tasks.filter(t=>t.done).length*5+packXp()+chatXp()+achXp(),lvl=()=>Math.min(50,(xp()/500|0)+1),dueRev=()=>S.reviews.filter(r=>!r.done&&r.due<=today()).length;
const ACH=()=>{const m=dur(()=>1)/60,n=S.sessions.length,tp=new Set(S.sessions.map(s=>s.topic)).size,l=Math.max(longest(),streak()),tasks=S.tasks.filter(t=>t.done).length,subs=new Set(S.sessions.map(s=>s.subject)).size,
gr=S.grades.length,best=S.subjects.reduce((b,s)=>Math.max(b,avg(s.id)||0),0),pk=(S.packs||[]).filter(p=>p.result),perf=pk.filter(p=>p.result.pct>=100).length,
lg=S.sessions.reduce((b,s)=>Math.max(b,s.duration/60),0),hr=s=>new Date(s.startedAt).getHours(),dset=f=>new Set(S.sessions.filter(f).map(s=>day(s.startedAt))).size,
early=dset(s=>hr(s)<8),late=dset(s=>hr(s)>=22),dawn=dset(s=>hr(s)<5),wk=new Set(S.sessions.map(s=>day(s.startedAt)).filter(d=>[0,6].includes(new Date(d+'T12:00').getDay()))).size,
byD={};S.sessions.forEach(s=>byD[day(s.startedAt)]=(byD[day(s.startedAt)]||0)+s.duration);const G=(S.goal||60)*60,gd=Object.values(byD).filter(v=>v>=G).length,dbl=Object.values(byD).some(v=>v>=2*G)?1:0,
chat=(S.cnt&&S.cnt.chat)||0,act=(S.cnt&&S.cnt.ai)||0,st=S.set||{},wg=S.subjects.filter(s=>avg(s.id)!=null),blue=wg.length>=3&&wg.every(s=>avg(s.id)>=(S.target||8))?1:0,
cust=['mode','anim','round','font','glass','vib'].filter(k=>st[k]!==undefined&&!(k=='mode'&&st[k]=='dark')&&!(k=='anim'&&st[k]=='normal')&&!(k=='round'&&st[k]=='round')&&!(k=='font'&&st[k]=='m')&&st[k]!==1).length+(st.acc?1:0)+(st.bg&&st.bg!='pad'?1:0);
const T=(ic,v,a)=>a.map(([id,t,n,d,x])=>[id,ic,n,d,v,t,x]);
const L=[
...T('clock',m,[['h1',60,'1 hora de foco','Acumule 1h estudada',50],['h3',180,'Maratona leve','Acumule 3h estudadas',90],['h5',300,'5 horas de foco','Acumule 5h estudadas',150],['h10',600,'10 horas de foco','Acumule 10h estudadas',300],['h25',1500,'25 horas de foco','Acumule 25h estudadas',500],['h50',3000,'50 horas de foco','Acumule 50h estudadas',900],['h100',6000,'100 horas de foco','Acumule 100h estudadas',1500],['h200',12000,'200 horas de foco','Acumule 200h estudadas',2500],['h400',24000,'Mestre do tempo','Acumule 400h estudadas',4000]]),
...T('flame',l,[['s3',3,'Em sequência','Estude 3 dias em sequência',50],['s7',7,'Semana perfeita','Estude 7 dias em sequência',100],['s14',14,'Duas semanas','Estude 14 dias em sequência',200],['s30',30,'Mês imbatível','Estude 30 dias em sequência',400],['s60',60,'Dois meses de fogo','Estude 60 dias em sequência',700],['s100',100,'Centenário','Estude 100 dias em sequência',1200],['s180',180,'Meio ano sem parar','Estude 180 dias em sequência',2000],['s365',365,'Um ano inteiro','Estude 365 dias em sequência',4000]]),
...T('star',n,[['first',1,'Primeiro passo','Conclua 1 sessão de estudo',20],['ses5',5,'Pegando o jeito','Conclua 5 sessões',40],['ses10',10,'Dez sessões','Conclua 10 sessões',70],['ded',20,'Dedicado','Conclua 20 sessões',150],['fifty',50,'Ritmo forte','Conclua 50 sessões',350],['ded2',100,'Constante','Conclua 100 sessões',600],['ses250',250,'Imparável','Conclua 250 sessões',1200],['ses500',500,'Máquina de foco','Conclua 500 sessões',2500]]),
...T('check',tasks,[['tk1',1,'Tarefa feita','Conclua 1 tarefa',15],['tasks',5,'Dia em ordem','Conclua 5 tarefas',60],['tk10',10,'Pegando ritmo','Conclua 10 tarefas',90],['t25',25,'Produtivo','Conclua 25 tarefas',120],['tk50',50,'Meio centenário','Conclua 50 tarefas',250],['t100',100,'Máquina de tarefas','Conclua 100 tarefas',300],['tk250',250,'Lista zerada','Conclua 250 tarefas',700],['tk500',500,'Mestre da organização','Conclua 500 tarefas',1500]]),
...T('repeat',rdone(),[['rev1',1,'Primeira revisão','Conclua 1 revisão',30],['rv5',5,'Revisando','Conclua 5 revisões',60],['rev10',10,'Memória afiada','Conclua 10 revisões',120],['rv25',25,'Revisor nato','Conclua 25 revisões',250],['rv50',50,'Memória de elefante','Conclua 50 revisões',500],['rv100',100,'Mestre da revisão','Conclua 100 revisões',900]]),
...T('bulb',pk.length,[['pk1',1,'Simulado','Conclua 1 revisão completa da IA',60],['pk3',3,'Treino leve','Conclua 3 revisões completas',100],['pk5',5,'Treino pesado','Conclua 5 revisões completas',200],['pk10',10,'Rato de simulado','Conclua 10 revisões completas',350],['pk25',25,'Maratona de provas','Conclua 25 revisões completas',700],['pk50',50,'Veterano de simulados','Conclua 50 revisões completas',1200]]),
...T('trophy',perf,[['pk100',1,'Gabaritou','Tire 100% numa revisão completa',150],['pk100x5',5,'Gabaritador','Tire 100% em 5 revisões completas',500]]),
...T('target',gr,[['g1',1,'Nota registrada','Registre sua primeira nota',20],['g5',5,'Pegando o hábito','Registre 5 notas',40],['g10',10,'Caderno de notas','Registre 10 notas',80],['g25',25,'Boletim cheio','Registre 25 notas',150],['g50',50,'Historiador de notas','Registre 50 notas',300],['g100',100,'Arquivo completo','Registre 100 notas',600]]),
...T('star',best,[['m7',7,'Na média','Tenha média 7 numa matéria',60],['m8',8,'Boa média','Tenha média 8 numa matéria',100],['m9',9,'Excelência','Tenha média 9 numa matéria',200],['m10',10,'Nota máxima','Tenha média 10 numa matéria',500]]),
...T('layers',blue,[['blue',1,'Boletim azul','3 matérias ou mais, todas na média que você quer',250]]),
...T('calendar',S.exams.length,[['ex1',1,'De olho na prova','Marque 1 prova',30],['ex5',5,'Calendário em dia','Marque 5 provas',70],['ex10',10,'Planejador','Marque 10 provas',120],['ex25',25,'Mestre do calendário','Marque 25 provas',300]]),
...T('layers',S.subjects.length,[['sc1',1,'Primeira matéria','Crie 1 matéria',20],['sc4',4,'Organizado','Tenha 4 matérias',40],['sc8',8,'Grade completa','Tenha 8 matérias',80],['sc12',12,'Mil e uma matérias','Tenha 12 matérias',150]]),
...T('layers',subs,[['subjects',4,'Multidisciplinar','Estude 4 matérias diferentes',80],['sub8',7,'Tudo em dia','Estude 7 matérias diferentes',150],['sub10',10,'Sem deixar nenhuma','Estude 10 matérias diferentes',300]]),
...T('compass',tp,[['exp',10,'Explorador','Estude 10 conteúdos diferentes',100],['tp30',30,'Curioso demais','Estude 30 conteúdos diferentes',250],['tp60',60,'Enciclopédia','Estude 60 conteúdos diferentes',500],['tp100',100,'Biblioteca ambulante','Estude 100 conteúdos diferentes',900]]),
...T('hourglass',lg,[['lg30',30,'Meia hora firme','Estude 30 min numa sessão só',30],['lg1',60,'Foco profundo','Estude 1h numa sessão só',80],['lg90',90,'Hora e meia','Estude 1h30 numa sessão só',120],['lg2',120,'Imersão total','Estude 2h numa sessão só',150],['lg180',180,'Modo monge','Estude 3h numa sessão só',250],['lg240',240,'Resistência pura','Estude 4h numa sessão só',400]]),
...T('sun',early,[['early',1,'Madrugador','Estude antes das 8h',40],['early5',5,'Rotina matinal','Estude antes das 8h em 5 dias',150]]),
...T('moon',late,[['owl',1,'Coruja','Estude depois das 22h',40],['owl5',5,'Noturno','Estude depois das 22h em 5 dias',150]]),
...T('moon',dawn,[['dawn',1,'Insone','Estude de madrugada (antes das 5h)',60]]),
...T('flame',wk,[['wk',4,'Fim de semana focado','Estude em 4 dias de fim de semana',100],['wk10',10,'Sem folga','Estude em 10 dias de fim de semana',250]]),
...T('target',gd,[['gd1',1,'Meta batida','Bata a meta diária 1 vez',40],['gd7',7,'Meta em dia','Bata a meta diária 7 vezes',150],['gd14',14,'Meta de ferro','Bata a meta diária 14 vezes',300],['gd30',30,'Meta de aço','Bata a meta diária 30 vezes',600],['gd60',60,'Meta lendária','Bata a meta diária 60 vezes',1200]]),
...T('bolt',dbl,[['dbl',1,'Em dobro','Estude o dobro da meta num dia',100]]),
...T('bot',chat,[['ai1',1,'Papo com o tutor','Converse com a IA',30],['ai10',10,'Bate-papo','Mande 10 mensagens para a IA',60],['ai25',25,'Amigo virtual','Mande 25 mensagens para a IA',100],['ai50',50,'Dupla de estudos','Mande 50 mensagens para a IA',160],['ai100',100,'Inseparáveis','Mande 100 mensagens para a IA',300],['ai250',250,'Sócio da IA','Mande 250 mensagens para a IA',600]]),
...T('bot',act,[['act1',1,'Mãos à obra','Peça uma ação para a IA fazer no app',40],['act10',10,'Assistente em ação','A IA faz 10 ações para você',80],['ai20',20,'Dupla perfeita','A IA faz 20 ações para você',120],['act50',50,'Chefe e assistente','A IA faz 50 ações para você',250],['act100',100,'Piloto automático','A IA faz 100 ações para você',450]]),
...T('user',S.user.photo?1:0,[['ph',1,'Com a sua cara','Coloque uma foto de perfil',30]]),
...T('user',(S.user.name&&S.user.name!='Dudu'?1:0)+(S.user.photo?1:0)+(st.frame?1:0)+(st.title?1:0),[['prof',4,'Perfil completo','Foto, nome, moldura e título escolhidos',60]]),
...T('palette',(st.acc||(st.bg&&st.bg!='pad'))?1:0,[['sty',1,'Estilo próprio','Personalize a cor ou o fundo',30]]),
...T('palette',cust,[['cust5',5,'Sob medida','Mude 5 opções de personalização',80]]),
...T('cloud',S.owner?1:0,[['cloud',1,'Nas nuvens','Entre numa conta e sincronize',40]])];
// conquistas de nível usam só o XP das outras (se usassem o nível total, entrariam em loop)
const base=Math.round(m)+rdone()*20+tasks*5+chatXp()+packXp(),got=L.reduce((t,a)=>t+((S.ach||{})[a[0]]?a[6]:0),0),lv=Math.min(50,((base+got)/500|0)+1);
L.push(...T('trophy',lv,[['lv5',5,'Nível 5','Chegue ao nível 5',50],['lv10',10,'Nível 10','Chegue ao nível 10',100],['lv20',20,'Nível 20','Chegue ao nível 20',200],['lv30',30,'Nível 30','Chegue ao nível 30',400],['lv40',40,'Nível 40','Chegue ao nível 40',800],['lv50',50,'Lenda suprema','Chegue ao nível máximo (50)',2000]]));
return L.map(([id,i,n,d,v,t,x])=>({id,i,n,d,v,t,x}))};
const chatXp=()=>Math.min((S.cnt&&S.cnt.chat)||0,200)*2;
// Cada conquista dá XP (a.x) uma única vez, no momento em que é desbloqueada.
const achXp=()=>ACH().reduce((t,a)=>t+((S.ach||{})[a.id]?a.x:0),0);
function checkAch(){S.ach=S.ach||{};const nw=ACH().filter(a=>a.v>=a.t&&!S.ach[a.id]);if(!nw.length)return false;nw.forEach(a=>S.ach[a.id]=Date.now());if(nw.length>3)notify('ach',nw.length+' conquistas desbloqueadas','Veja todas em Progresso.',{p:'more',s:'prog'},'achm_'+Date.now());else nw.forEach(a=>notify('ach','Conquista: '+a.n,a.d+' · +'+a.x+' XP',{p:'more',s:'prog'},'ach_'+a.id));toast(nw.length==1?nw[0].n:nw.length+' conquistas',nw.reduce((t,a)=>t+a.x,0));return true}
// ---------- sons do app e sons relaxantes (tudo é gerado no aparelho: funciona offline e nunca acaba) ----------
// [id, nome, nível que libera, tipo ('a' ambiente, 'm' música), ícone]
const SND=[
['rain','Chuva suave',1,'a','cloud'],['brown','Ruído marrom',1,'a','layers'],['wind','Vento',2,'a','compass'],['stream','Riacho',3,'a','leaf'],
['pink','Ruído rosa',4,'a','layers'],['fire','Lareira',5,'a','flame'],['waves','Ondas do mar',6,'a','globe'],['night','Noite de grilos',8,'a','moon'],
['forest','Floresta e pássaros',10,'a','leaf'],['storm','Tempestade distante',13,'a','bolt'],['waterfall','Cachoeira',16,'a','cloud'],['cave','Caverna',20,'a','hourglass'],
['space','Espaço profundo',28,'a','star'],['snow','Noite de neve',32,'a','star'],
['piano','Piano suave',1,'m','music'],['pad','Pad calmo',3,'m','music'],['box','Caixinha de música',7,'m','music'],['lofi','Lo-fi tranquilo',9,'m','music'],
['bowls','Taças tibetanas',12,'m','music'],['aurora','Aurora',15,'m','music'],['stars','Noite estrelada',19,'m','music'],['zen','Jardim zen',23,'m','music'],
['deep','Oceano profundo',27,'m','music'],['ench','Floresta encantada',31,'m','music'],['cosmos','Cosmos',36,'m','music'],['dawn','Amanhecer',41,'m','music'],
['eternal','Eternidade',50,'m','music']];
const Snd=(()=>{
const AC=window.AudioContext||window.webkitAudioContext;
let ctx=null,mA,mM,mU,revA,revM,unlocked=false;const LY={},NB={};
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)],mf=m=>440*Math.pow(2,(m-69)/12),clp=(v,a,b)=>Math.min(b,Math.max(a,v));
const PENT=[0,2,4,7,9],pent=(lo,hi)=>{const r=[];for(let m=lo;m<=hi;m++)if(PENT.includes(m%12))r.push(m);return r};
const vol=k=>{const v=(S&&S.set)?S.set[k]:null;return (v==null?70:v)/100};
function resume(){if(ctx&&ctx.state!='running')ctx.resume().catch(()=>{})}
function applyVol(){if(!ctx)return;const t=ctx.currentTime,a=vol('va'),m=vol('vm');mA.gain.setTargetAtTime(a*a*2.2,t,.05);mM.gain.setTargetAtTime(m*m*2.2,t,.05)}
function init(){if(ctx)return true;if(!AC)return false;try{ctx=new AC()}catch(e){return false}
const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=5;comp.connect(ctx.destination);
mA=ctx.createGain();mM=ctx.createGain();mU=ctx.createGain();mU.gain.value=.9;[mA,mM,mU].forEach(g=>g.connect(comp));
const len=Math.floor(ctx.sampleRate*3.2),ir=ctx.createBuffer(2,len,ctx.sampleRate);
for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}
const mk=(bus,v)=>{const c=ctx.createConvolver();c.buffer=ir;const g=ctx.createGain();g.gain.value=v;c.connect(g);g.connect(bus);return c};
revA=mk(mA,.5);revM=mk(mM,.6);applyVol();return true}
// ruído em laço sem "tranco" (as pontas se misturam)
function noise(kind){if(NB[kind])return NB[kind];const sr=ctx.sampleRate,m=sr*6,X=Math.floor(sr*.4),n=m+X,b=ctx.createBuffer(2,m,sr);
for(let c=0;c<2;c++){const raw=new Float32Array(n);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
for(let i=0;i<n;i++){const w=Math.random()*2-1;if(kind=='white')raw[i]=w*.5;else if(kind=='pink'){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;raw[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}else{last=(last+.02*w)/1.02;raw[i]=last*3.5}}
const d=b.getChannelData(c);for(let i=0;i<m;i++){d[i]=i<X?raw[i]*(i/X)+raw[m+i]*(1-i/X):raw[i]}}
return NB[kind]=b}
const gn=(v,dest)=>{const g=ctx.createGain();g.gain.value=v;if(dest)g.connect(dest);return g};
const flt=(type,f,q)=>{const x=ctx.createBiquadFilter();x.type=type;x.frequency.value=f;if(q!=null)x.Q.value=q;return x};
function nsrc(l,kind){const s=ctx.createBufferSource();s.buffer=noise(kind);s.loop=true;s.start(0,rnd(0,4));l.nodes.push(s);return s}
function lfo(l,hz,depth,param){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=hz;g.gain.value=depth;o.connect(g);g.connect(param);o.start();l.nodes.push(o);return o}
function every(l,a,b,fn,first){let h;const f=()=>{if(l.dead)return;try{fn()}catch(e){}h=setTimeout(f,rnd(a,b)*1000)};h=setTimeout(f,(first==null?rnd(a,b)*.4:first)*1000);l.cl.push(()=>clearTimeout(h))}
function route(l,node,pan,wet){let o=node;if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan||0;node.connect(p);o=p}o.connect(l.out);if(wet)o.connect(l.send)}
// nota com envelope: ataque a, sustenta h, solta com constante r
function tone(l,f,t,dur,o){o=o||{};const x=ctx.createOscillator(),g=ctx.createGain(),a=o.a==null?.01:o.a,pk=o.g==null?.15:o.g,h=o.h==null?Math.max(0,dur-a):o.h,r=o.r||Math.max(.05,dur/4);
x.type=o.w||'sine';x.frequency.setValueAtTime(f,t);if(o.det)x.detune.value=o.det;
g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(pk,t+a);g.gain.setTargetAtTime(0,t+a+h,r);
let out=g;if(o.f){const q=flt('lowpass',o.f,.5);g.connect(q);out=q}x.connect(g);
if(o.vib){const v=ctx.createOscillator(),vg=ctx.createGain();v.frequency.value=5.2;vg.gain.value=o.vib;v.connect(vg);vg.connect(x.detune);v.start(t);v.stop(t+a+h+r*7)}
out.connect(l.out);if(o.s)out.connect(l.send);const end=t+a+h+r*7;x.start(t);x.stop(end);x.onended=()=>{try{g.disconnect();out.disconnect()}catch(e){}}}
function tick(l,f,g,d,q){const t=ctx.currentTime,s=ctx.createBufferSource(),b=flt('bandpass',f,q||2),e=ctx.createGain();s.buffer=noise('white');d=d||.04;
e.gain.setValueAtTime(g,t);e.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(b);b.connect(e);e.connect(l.out);s.start(t,rnd(0,5),d+.03)}
function chirp(l,f0,f1,t,d,g,pan,wet){const x=ctx.createOscillator(),e=ctx.createGain();x.frequency.setValueAtTime(f0,t);x.frequency.exponentialRampToValueAtTime(f1,t+d*.8);
e.gain.setValueAtTime(.0001,t);e.gain.linearRampToValueAtTime(g,t+Math.min(.015,d/3));e.gain.exponentialRampToValueAtTime(.0001,t+d);x.connect(e);route(l,e,pan,wet);x.start(t);x.stop(t+d+.05)}
function drone(l,f,g){const x=ctx.createOscillator(),a=ctx.createGain();x.frequency.value=f;a.gain.value=g;x.connect(a);a.connect(l.out);lfo(l,rnd(.04,.09),g*.5,a.gain);x.start();l.nodes.push(x)}
function padLoop(l,CH,g,len,wave){let k=0;every(l,len,len,()=>{const t=ctx.currentTime+.05;CH[k%CH.length].forEach(m=>[-1,1].forEach(s=>tone(l,mf(m),t,0,{w:wave||'sawtooth',a:len*.42,h:len*.32,r:len*.22,g:g,det:s*rnd(5,11),f:620,s:1})));k++},0)}
function kick(l,t){const x=ctx.createOscillator(),g=ctx.createGain();x.frequency.setValueAtTime(120,t);x.frequency.exponentialRampToValueAtTime(42,t+.12);g.gain.setValueAtTime(.2,t);g.gain.exponentialRampToValueAtTime(.0001,t+.3);x.connect(g);g.connect(l.out);x.start(t);x.stop(t+.35)}
function hat(l,t,v){const s=ctx.createBufferSource(),h=flt('highpass',7000),g=ctx.createGain();s.buffer=noise('white');g.gain.setValueAtTime(.05*v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05);s.connect(h);h.connect(g);g.connect(l.out);s.start(t,rnd(0,5),.08)}
function thunder(l){const t=ctx.currentTime,s=ctx.createBufferSource(),f=flt('lowpass',rnd(120,260)),g=ctx.createGain();s.buffer=noise('brown');
g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.7,t+1.3);g.gain.setTargetAtTime(0,t+1.5,2.3);s.loop=true;s.connect(f);f.connect(g);g.connect(l.out);s.start(t,rnd(0,4));s.stop(t+16)}
const A={
rain(l){const n=nsrc(l,'pink'),h=flt('highpass',420,.5),lp=flt('lowpass',7500,.5);n.connect(h);h.connect(lp);lp.connect(gn(.55,l.out));
const w=nsrc(l,'white'),bp=flt('bandpass',3800,.6);w.connect(bp);bp.connect(gn(.1,l.out));every(l,.05,.22,()=>tick(l,rnd(1800,5200),.04,.035),0)},
brown(l){const n=nsrc(l,'brown'),f=flt('lowpass',900,.4);n.connect(f);f.connect(gn(.55,l.out))},
pink(l){const n=nsrc(l,'pink'),f=flt('lowpass',9000,.3);n.connect(f);f.connect(gn(.4,l.out))},
wind(l){const n=nsrc(l,'pink'),b=flt('bandpass',500,1.1),g=gn(.5,l.out);n.connect(b);b.connect(g);lfo(l,.07,260,b.frequency);lfo(l,.045,.22,g.gain)},
stream(l){const n=nsrc(l,'pink'),b=flt('bandpass',1500,.7),g=gn(.5,l.out);n.connect(b);b.connect(g);lfo(l,.6,.12,g.gain);lfo(l,1.3,300,b.frequency);
const w=nsrc(l,'white'),h=flt('highpass',3500,.5);w.connect(h);h.connect(gn(.05,l.out));
every(l,.15,.7,()=>{const f=rnd(500,1400);chirp(l,f,f*1.8,ctx.currentTime,.09,.05,rnd(-.6,.6))},0)},
fire(l){const n=nsrc(l,'brown'),f=flt('lowpass',380,.5);n.connect(f);f.connect(gn(.6,l.out));
const h=nsrc(l,'pink'),b=flt('bandpass',900,.5),g=gn(.08,l.out);h.connect(b);b.connect(g);lfo(l,.9,.04,g.gain);
every(l,.03,.35,()=>{const big=Math.random()<.12;tick(l,rnd(1500,4500),big?.5:rnd(.08,.25),big?.05:rnd(.012,.03),1)},0)},
waves(l){const n=nsrc(l,'brown'),f=flt('lowpass',700,.4),g=gn(.35,l.out);n.connect(f);f.connect(g);lfo(l,.11,.28,g.gain);lfo(l,.11,500,f.frequency);
const w=nsrc(l,'pink'),hp=flt('highpass',1800,.5),g2=gn(.15,l.out);w.connect(hp);hp.connect(g2);lfo(l,.11,.14,g2.gain)},
night(l){const n=nsrc(l,'pink'),b=flt('lowpass',500),g=gn(.05,l.out);n.connect(b);b.connect(g);
for(let i=0;i<3;i++){const f=rnd(3900,5200),pan=rnd(-.8,.8);every(l,.6,1.6,()=>{const t=ctx.currentTime;for(let k=0;k<3;k++)chirp(l,f,f,t+k*.055,.045,.03,pan)},rnd(0,1))}},
forest(l){const n=nsrc(l,'pink'),b=flt('bandpass',650,.8),g=gn(.18,l.out);n.connect(b);b.connect(g);lfo(l,.05,.08,g.gain);
every(l,1.4,5,()=>{const t=ctx.currentTime,pan=rnd(-.9,.9),base=rnd(2200,4200),c=Math.floor(rnd(2,6)),sp=rnd(.09,.16),up=Math.random()<.5;
for(let k=0;k<c;k++)chirp(l,base*(up?1:1.25),base*(up?1.25:1),t+k*sp,sp*.8,.05,pan,1)},1)},
storm(l){A.rain(l);every(l,12,30,()=>thunder(l),6)},
waterfall(l){const w=nsrc(l,'white'),b=flt('bandpass',1700,.35),g=gn(.5,l.out);w.connect(b);b.connect(g);const p=nsrc(l,'pink'),lp=flt('lowpass',2600,.5);p.connect(lp);lp.connect(gn(.55,l.out));
nsrc(l,'brown').connect(gn(.35,l.out));lfo(l,.2,.08,g.gain)},
cave(l){const n=nsrc(l,'brown'),f=flt('lowpass',250),g=gn(.25,l.out);n.connect(f);f.connect(g);drone(l,55,.04);
every(l,1.6,5.5,()=>{const f=rnd(700,1300);chirp(l,f*1.4,f,ctx.currentTime,.3,.12,rnd(-.5,.5),1)},1)},
space(l){[55,82.41,110.3,164.8].forEach((f,i)=>{const x=ctx.createOscillator(),g=gn(.05,l.out);x.type=i%2?'triangle':'sine';x.frequency.value=f;x.detune.value=rnd(-6,6);x.connect(g);lfo(l,rnd(.03,.09),.035,g.gain);x.start();l.nodes.push(x)});
const n=nsrc(l,'pink'),f=flt('lowpass',260,.6),g=gn(.18,l.out);n.connect(f);f.connect(g);lfo(l,.04,.1,g.gain);lfo(l,.03,120,f.frequency)},
snow(l){const n=nsrc(l,'pink'),b=flt('bandpass',380,.9),g=gn(.22,l.out);n.connect(b);b.connect(g);lfo(l,.05,.1,g.gain);lfo(l,.04,120,b.frequency);
every(l,2.5,7,()=>tone(l,pick([1318.5,1568,1760,2093,2349]),ctx.currentTime,2.2,{g:.035,s:1,r:.5}),1)}};
const M={
piano(l){const N=pent(48,81);let i=Math.floor(N.length/2);every(l,1.1,3.2,()=>{i=clp(i+Math.round(rnd(-3,3)),0,N.length-1);const t=ctx.currentTime+.05,f=mf(N[i]),v=rnd(.07,.13);
tone(l,f,t,3.2,{g:v,a:.012,r:.7,w:'triangle',f:2600,s:1});tone(l,f*2,t,1.5,{g:v*.25,a:.01,r:.3,f:3000});
if(Math.random()<.28)tone(l,mf(N[Math.max(0,i-2)]),t+.02,3.2,{g:v*.7,a:.012,r:.7,w:'triangle',f:2400,s:1})},0)},
pad(l){padLoop(l,[[48,55,59,64,67],[45,52,57,60,64],[41,48,53,57,60],[43,50,55,59,62]],.018,8)},
box(l){const N=pent(72,96);let i=3;every(l,.38,.52,()=>{if(Math.random()<.22)return;i=clp(i+pick([-2,-1,-1,1,1,2]),0,N.length-1);const t=ctx.currentTime+.03,f=mf(N[i]);
tone(l,f,t,1.8,{g:.07,a:.004,r:.35,s:1});tone(l,f*3,t,.6,{g:.012,a:.003,r:.1})},0)},
lofi(l){const sp=60/74/2,CH=[[50,53,57,60,64],[43,47,50,53,57],[48,52,55,59,62],[45,48,52,55,59]];let nt=ctx.currentTime+.1,st=0;
every(l,.2,.2,()=>{while(nt<ctx.currentTime+1.2){const bar=Math.floor(st/8)%4,b=st%8,t=nt+((b%2)?sp*.12:0);
if(b==0){CH[bar].forEach((m,i)=>tone(l,mf(m+12),t+i*.012,2.4,{w:'triangle',g:.045,a:.008,r:.35,f:1800,s:1}));tone(l,mf(CH[bar][0]-12),t,2.2,{g:.16,a:.01,r:.4})}
if(b==4&&Math.random()<.7)CH[bar].slice(1,4).forEach((m,i)=>tone(l,mf(m+12),t+i*.015,1.2,{w:'triangle',g:.03,a:.008,r:.25,f:1800,s:1}));
if(b==0||b==5)kick(l,t);if(b==2||b==6)hat(l,t,.5);else if(b%2==1&&Math.random()<.5)hat(l,t,.25);
if(b%2==0&&Math.random()<.3)tone(l,mf(pick([72,74,76,79,81])),t,.9,{w:'triangle',g:.035,a:.005,r:.2,f:2200,s:1});
nt+=sp;st++}},.01)},
bowls(l){every(l,5,11,()=>{const t=ctx.currentTime+.05,f=pick([174.6,196,220,261.6,293.7]);[[1,.14,9],[2.76,.06,6],[5.4,.03,4],[8.93,.015,3]].forEach(([r,g,d])=>tone(l,f*r,t,d,{g:g,a:.01,r:d/4,s:1}))},0)},
aurora(l){const CH=[[50,57,62,66,69,74],[47,54,59,62,66,71],[43,50,55,59,62,67],[45,52,57,61,64,69]];let st=0;
every(l,.36,.36,()=>{const c=CH[Math.floor(st/16)%4],p=[0,2,4,3,5,3,4,2][st%8];if(st%16==0)tone(l,mf(c[0]-12),ctx.currentTime+.03,5,{g:.1,a:.05,r:1.2,s:1});
if(Math.random()>.12)tone(l,mf(c[p]+(Math.random()<.15?12:0)),ctx.currentTime+.03,2.2,{w:'triangle',g:.08,a:.006,r:.5,f:3000,s:1});st++},0)},
stars(l){padLoop(l,[[45,52,57,60,64],[41,48,53,57,60],[38,45,50,53,57],[40,47,52,55,59]],.014,10);
every(l,1.8,5,()=>tone(l,mf(pick([81,84,86,88,91,93])),ctx.currentTime+.02,2.6,{g:.04,a:.01,r:.6,s:1}),1)},
zen(l){const N=[];for(let m=50;m<=84;m++)if([2,4,5,9,10].includes(m%12))N.push(m);let i=8;drone(l,mf(38),.04);
every(l,1.8,5.5,()=>{i=clp(i+Math.round(rnd(-3,3)),0,N.length-1);const t=ctx.currentTime+.03,f=mf(N[i]);tone(l,f,t,1.6,{w:'triangle',g:.1,a:.004,r:.3,f:3200,s:1});
if(Math.random()<.35)tone(l,f*2.005,t+.01,.7,{g:.02,a:.003,r:.12})},0)},
deep(l){drone(l,36.7,.1);drone(l,55,.07);drone(l,73.4,.04);const n=nsrc(l,'brown'),f=flt('lowpass',200,.7),g=gn(.18,l.out);n.connect(f);f.connect(g);lfo(l,.04,.12,g.gain);lfo(l,.05,70,f.frequency);
every(l,9,18,()=>tone(l,mf(pick([38,45,50,57])),ctx.currentTime,0,{g:.08,a:4,h:2,r:2.2,s:1}),3)},
ench(l){padLoop(l,[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]],.012,10);const N=pent(60,84);let i=4;
every(l,2.2,4.5,()=>{i=clp(i+Math.round(rnd(-2,2)),0,N.length-1);const t=ctx.currentTime+.05,f=mf(N[i]);tone(l,f,t,0,{g:.07,a:.35,h:1.3,r:.5,vib:10,s:1});tone(l,f*2,t,0,{w:'triangle',g:.012,a:.35,h:1.3,r:.5})},1)},
cosmos(l){padLoop(l,[[33,45,52,57,64],[36,43,52,55,64],[29,41,48,53,60],[31,43,50,55,62]],.012,12);
every(l,5,10,()=>{const t=ctx.currentTime;tone(l,mf(pick([76,81,83,88,93])),t+.02,5,{g:.045,a:.005,r:1.1,s:1});tone(l,mf(pick([69,74])),t+.4,4,{w:'triangle',g:.03,a:.005,r:.9,s:1})},2)},
dawn(l){padLoop(l,[[48,55,60,64,67],[41,48,53,57,60],[43,50,55,59,62],[45,52,57,60,64]],.014,10);const N=pent(60,88);let i=5;
every(l,.9,2.4,()=>{i=clp(i+Math.round(rnd(-3,3)),0,N.length-1);tone(l,mf(N[i]),ctx.currentTime+.03,2.4,{w:'triangle',g:.07,a:.006,r:.55,f:3000,s:1})},0)},
eternal(l){M.cosmos(l);M.bowls(l);M.zen(l)}};
const UIS={tap:[[1100,0,.035,.03]],ok:[[660,0,.1,.07],[880,.07,.14,.07]],done:[[523,0,.12,.07],[659,.08,.12,.07],[784,.16,.22,.07]],
ach:[[784,0,.14,.08,'triangle'],[988,.1,.14,.08,'triangle'],[1175,.2,.14,.08,'triangle'],[1568,.3,.45,.08,'triangle']],
level:[[523,0,.2,.08,'triangle'],[659,.14,.2,.08,'triangle'],[784,.28,.2,.08,'triangle'],[1047,.42,.6,.08,'triangle'],[1319,.42,.6,.05,'triangle']],
start:[[440,0,.12,.07],[587,.1,.22,.07]],pause:[[587,0,.1,.06],[440,.08,.18,.06]],
finish:[[784,0,.35,.08],[659,.28,.35,.08],[523,.56,.8,.08],[1047,.56,.8,.03]],
warn:[[330,0,.13,.07,'triangle'],[262,.1,.22,.07,'triangle']],bad:[[240,0,.22,.07,'triangle']],notif:[[988,0,.1,.06],[1319,.12,.25,.06]],del:[[300,0,.08,.05,'triangle']]};
function ui(n){if(!unlocked||!S||!S.set||S.set.ui===0||(n=='notif'&&S.set.nsnd===0)||!init())return;resume();const p=UIS[n];if(!p)return;const t=ctx.currentTime+.01;
p.forEach(([f,d,du,g,w])=>{const x=ctx.createOscillator(),e=ctx.createGain();x.type=w||'sine';x.frequency.value=f;e.gain.setValueAtTime(.0001,t+d);e.gain.linearRampToValueAtTime(g||.07,t+d+.006);e.gain.exponentialRampToValueAtTime(.0001,t+d+du);x.connect(e);e.connect(mU);x.start(t+d);x.stop(t+d+du+.05)})}
function start(id){if(!init())return false;resume();if(LY[id])return true;const d=SND.find(s=>s[0]==id);if(!d)return false;const kind=d[3],fn=(kind=='m'?M:A)[id];if(!fn)return false;
const l={id,dead:false,nodes:[],cl:[],out:ctx.createGain(),send:ctx.createGain()};l.out.gain.value=0;l.out.connect(kind=='m'?mM:mA);l.send.gain.value=kind=='m'?.65:.5;l.send.connect(kind=='m'?revM:revA);
try{fn(l)}catch(e){stopLayer(l);return false}l.out.gain.setTargetAtTime(1,ctx.currentTime,.8);LY[id]=l;return true}
function stopLayer(l){l.dead=true;l.cl.forEach(f=>f());if(!ctx)return;const t=ctx.currentTime;l.out.gain.cancelScheduledValues(t);l.out.gain.setTargetAtTime(0,t,.35);l.send.gain.setTargetAtTime(0,t,.35);
setTimeout(()=>{l.nodes.forEach(n=>{try{n.stop()}catch(e){}});try{l.out.disconnect();l.send.disconnect()}catch(e){}},3000)}
function stop(id){const l=LY[id];if(!l)return;delete LY[id];stopLayer(l)}
addEventListener('pointerdown',()=>{unlocked=true;resume()},true);addEventListener('keydown',()=>{unlocked=true},true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});
return{ui,start,stop,vol:applyVol,on:id=>!!LY[id],ids:()=>Object.keys(LY),stopAll:()=>Object.keys(LY).forEach(stop),_test:{A,M,UIS}}})();

function buzz(pattern){try{if(S&&S.set&&S.set.vib===0)return;if(navigator.vibrate&&matchMedia('(prefers-reduced-motion:no-preference)').matches)navigator.vibrate(pattern)}catch(_){}}
function toast(t,x,kind='Conquista desbloqueada!'){document.querySelectorAll('.toast').forEach(e=>e.remove());{const k=kind=='Conquista desbloqueada!'?'ach':(kind=='Aviso'||/^Não consegui/.test(kind))?'warn':kind=='Nova notificação'?'notif':kind=='Boa!'?'done':['Tudo certo','Agendado','Sincronizado','Muito bem!'].includes(kind)?'ok':'';if(k)Snd.ui(k)}const e=document.createElement('div');e.className='toast';e.setAttribute('role','status');e.innerHTML=I(kind=='Conquista desbloqueada!'?'trophy':'bell',22)+'<div><b>'+esc(kind)+'</b><small>'+esc(t)+(x?(' · +'+x+' XP'):'')+'</small></div>';document.body.appendChild(e);if(x)buzz([35,55,70]);setTimeout(()=>e.classList.add('out'),3400);setTimeout(()=>e.remove(),3900)}
window.alert=message=>toast(String(message),'','Aviso');

// ---------- ícones ----------
const D={sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7c1.9 0 3.5-.5 4.9-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',book:'<path d="M4 19V5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h13"/>',tasks:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 12l2 2 4-4"/>',chart:'<path d="M5 20V10M12 20V4M19 20v-7"/>',bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',flame:'<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',back:'<path d="M15 5l-7 7 7 7"/>',chev:'<path d="M9 5l7 7-7 7"/>',send:'<path d="M3 11l18-8-8 18-2-8z"/>',play:'<path d="M7 4l13 8-13 8z"/>',pause:'<path d="M8 5v14M16 5v14"/>',bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/>',trophy:'<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 14v4M8 21h8"/>',calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',flask:'<path d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/>',atom:'<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',leaf:'<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15zM5 19l8-8"/>',bank:'<path d="M3 9l9-6 9 6M5 9v9M10 9v9M14 9v9M19 9v9M3 21h18"/>',lang:'<path d="M4 5h9M8.5 3v2M6 5c1 4 4 7 7 8M12 5c-1 4-4 7-8 9M14 21l4-10 4 10M15.5 18h5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5L13.5 13.5 8.5 15.5 10.5 10.5z"/>',repeat:'<path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',doc:'<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/>',check:'<path d="M5 12l5 5 9-10"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',layers:'<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',cloud:'<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z"/>',palette:'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.8-1.6-.8-2.6c0-1 .8-1.4 1.8-1.4H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',pen:'<path d="M3 21l3-1 13-13a2.1 2.1 0 0 0-3-3L3 17z"/><path d="M14 5l3 3"/>',code:'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',dumbbell:'<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',scale:'<path d="M12 3v18M5 21h14M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-3-5.2"/>',bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',hourglass:'<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',heart:'<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',download:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',coins:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9a3 3 0 0 0-5 1c0 3 5 1 5 4a3 3 0 0 1-5 1M12 6.5v11"/>',speech:'<path d="M4 5h16v11H9l-5 4z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="14" r="3.5"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M12 8c-3 0-5-4-2.500-4C12 4 12 8 12 8zM12 8c3 0 5-4 2.500-4C12 4 12 8 12 8z"/>',crown:'<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>',undo:'<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3"/>'};
const I=(n,s=20)=>`<svg class="i" data-i="${n}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${D[n]||''}</svg>`;
// Cada matéria tem um símbolo: o escolhido por você (s.icon) ou um automático pelo nome. Se o nome não for reconhecido, sorteia sempre o mesmo pelo nome.
const KW=[['dumbbell',/educacao fis|ed\.? ?fis|esport|ginast|treino|futebol|atletis/],['calc',/mat(e|$)|calcul|algebr|geometr|estatist|aritmet|trigon/],['book',/portug|literat|leitur|gramat/],['pen',/redac|escrit|texto/],['bank',/hist/],['hourglass',/arqueol|antiguid/],['globe',/geogr|geopol|atualid/],['leaf',/biolog|natur|ecolog|ambient|botan|zoolog/],['atom',/fisic|astronom/],['flask',/quimic|laborat/],['lang',/ingl|espanh|franc|aleman|italian|japon|idioma|lingu|english|spanish/],['palette',/arte|desenho|pintur|design/],['music',/music|canto|violao|piano|banda/],['code',/program|codigo|computa|logica|algoritm/],['monitor',/inform|tecnolog|robot/],['bulb',/filos|psicolog|ciencia/],['users',/sociolog|cidadan|projeto de vida|social/],['scale',/direit|etica|justica/],['coins',/econom|financ|contab|administ|empreend/],['heart',/saude|enferm|anatom|medic/],['speech',/oral|debate|comunic|oratori/]],
FB=['star','compass','target','layers','bulb','trophy','flame','speech'],
autoIcon=n=>{const x=String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const k=KW.find(a=>a[1].test(x));return k?k[0]:FB[[...x].reduce((t,c)=>t+c.charCodeAt(0),0)%FB.length]},
ICONS=['calc','book','bank','globe','leaf','atom','flask','lang','palette','music','pen','code','dumbbell','bulb','scale','users','bolt','hourglass','monitor','heart','coins','speech','compass','star','target','layers','trophy','flame'],
sIcon=sb=>sb.icon||autoIcon(sb.name),ic=(n,z)=>{const x=((typeof S!='undefined'&&S&&S.subjects)||[]).find(v=>v.name==n);return I(x?sIcon(x):autoIcon(n),z)};
const toggleIc=()=>{icPick=!icPick;render(1)},setIc=(id,n)=>{const x=S.subjects.find(v=>v.id==id);if(!x)return;if(n)x.icon=n;else delete x.icon;icPick=0;save();render(1)};

// ---------- tema e personalização (ficam em S.set e sincronizam entre os aparelhos) ----------
const SET=()=>S.set||(S.set={}),
TH=()=>{const m=SET().mode||'dark';return m=='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m};
const ACCS=[['Azul','#3D8BFF'],['Roxo','#8B5CF6'],['Rosa','#EC4899'],['Vermelho','#EF4444'],['Laranja','#F97316'],['Âmbar','#F59E0B'],['Verde','#22C55E'],['Lima','#84CC16'],['Turquesa','#14B8A6'],['Ciano','#06B6D4'],['Grafite','#64748B']],
BGS=[['pad','Padrão'],['cor','Colorido'],['graf','Grafite'],['puro','Puro']],
ANIMS=[['off','Nenhuma','Sem nenhum movimento'],['soft','Suave','Só o essencial, bem leve'],['normal','Normal','Equilibrado'],['full','Intensa','Cheio de vida e brilho']],
// recompensas por nível: [nível, ...]
REW={colors:[[3,'Coral','#FF6B6B'],[5,'Menta','#2DD4BF'],[7,'Lavanda','#B197FC'],[9,'Ouro','#FBBF24'],[12,'Magenta','#D946EF'],[16,'Safira','#2563EB'],[20,'Esmeralda','#10B981'],[25,'Rubi','#E11D48'],[30,'Néon','#22D3EE'],[36,'Pêssego','#FB923C'],[42,'Ametista','#9333EA'],[50,'Platina','#CBD5E1']],
bgs:[[4,'aurora','Aurora',170],[8,'sunset','Pôr do sol',18],[12,'galaxy','Galáxia',265],[18,'ocean','Oceano',205],[24,'forest','Floresta',140],[30,'volcano','Vulcão',5],[38,'nebula','Nebulosa',300],[50,'eternal','Eternidade',45]],
frames:[[3,'ring','Anel'],[5,'dual','Anel duplo'],[7,'fire','Chama'],[10,'gold','Dourada'],[14,'rainbow','Arco-íris'],[20,'neon','Neon'],[28,'galaxy','Galáxia'],[36,'diamond','Diamante'],[50,'crown','Coroa']],
titles:[[1,'Estudante'],[2,'Curioso'],[4,'Dedicado'],[6,'Focado'],[8,'Mestre dos estudos'],[11,'Lenda do foco'],[15,'Gênio'],[20,'Mentor'],[25,'Veterano'],[30,'Sábio'],[35,'Visionário'],[40,'Mestre supremo'],[45,'Imortal'],[50,'Lenda suprema']],
extras:[[50,'Selo de Lenda no perfil'],[50,'Nome dourado'],[50,'Confete dourado']]};
const MAXLV=50,isLegend=()=>lvl()>=MAXLV,xpIn=()=>lvl()>=MAXLV?500:xp()%500;
const rewardsAt=l=>[...REW.colors.filter(r=>r[0]==l).map(r=>'Cor '+r[1]),...REW.bgs.filter(r=>r[0]==l).map(r=>'Fundo '+r[2]),...REW.frames.filter(r=>r[0]==l).map(r=>'Moldura '+r[2]),...REW.titles.filter(r=>r[0]==l).map(r=>'Título "'+r[1]+'"'),...REW.extras.filter(r=>r[0]==l).map(r=>r[1]),...SND.filter(r=>r[2]==l).map(r=>'Som "'+r[1]+'"')],
nextRew=l=>{for(let i=l+1;i<=MAXLV;i++)if(rewardsAt(i).length)return i;return 0},
lockedColor=c=>{const r=REW.colors.find(x=>x[2].toLowerCase()==String(c).toLowerCase());return r&&lvl()<r[0]?r[0]:0},
lockedBg=k=>{const r=REW.bgs.find(x=>x[1]==k);return r&&lvl()<r[0]?r[0]:0},
curTitle=()=>{const L=lvl(),t=SET().title,f=REW.titles.find(x=>x[1]==t);return f&&L>=f[0]?t:REW.titles.filter(x=>L>=x[0]).pop()[1]},
frameCls=()=>{const r=REW.frames.find(x=>x[1]==SET().frame);return r&&lvl()>=r[0]?'fr-'+r[1]:''};
const okAcc=c=>c&&[...ACCS.map(a=>a[1]),...REW.colors.map(r=>r[2])].some(x=>x.toLowerCase()==String(c).toLowerCase())?c:null,
PE=()=>({acc:okAcc(SET().acc),bg:SET().bg||'pad'}),
h2r=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),r2h=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),
hsl=(h,s,l)=>{s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return r2h(f(0)*255,f(8)*255,f(4)*255)},
hs=hex=>{const[r,g,b]=h2r(hex).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=mx==r?(g-b)/d+(g<b?6:0):mx==g?(b-r)/d+2:(r-g)/d+4;h*=60}return[h,s*100,l*100]},
lum=hex=>{const[r,g,b]=h2r(hex).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b},
cl=(v,a,b)=>Math.min(b,Math.max(a,v));
function pal(t,bg,acc){const d=t=='dark',o={},[h,s,l]=hs(acc||'#3D8BFF');
if(acc){const A=hsl(h,s,d?cl(l,56,68):cl(l,38,50));o['--acc']=A;o['--onacc']=lum(A)>.4?'#0B1220':'#fff';o['--ha']=hsl(h,s,58);o['--hb']=hsl(h,s,46);o['--hc']=hsl(h,s,33)}
const tint=hh=>d?['--bg',hsl(hh,45,6),'--card',hsl(hh,38,10),'--line',hsl(hh,30,18),'--soft',hsl(hh,32,14),'--mu',hsl(hh,22,68),'--tx',hsl(hh,100,97)]:['--bg',hsl(hh,75,95),'--card','#ffffff','--line',hsl(hh,45,88),'--soft',hsl(hh,60,92),'--mu',hsl(hh,20,38),'--tx',hsl(hh,55,11)];
const pb=REW.bgs.find(x=>x[1]==bg),B={cor:d?['--bg',hsl(h,38,7),'--card',hsl(h,32,11),'--line',hsl(h,28,19),'--soft',hsl(h,30,15),'--mu',hsl(h,22,66),'--tx',hsl(h,100,97)]:['--bg',hsl(h,70,96),'--card','#ffffff','--line',hsl(h,45,89),'--soft',hsl(h,60,93),'--mu',hsl(h,18,40),'--tx',hsl(h,55,12)],
graf:d?['--bg','#121315','--card','#1B1D20','--line','#2A2D32','--soft','#23262A','--mu','#9AA0A9','--tx','#ECEEF1']:['--bg','#EEF0F2','--card','#ffffff','--line','#DADDE1','--soft','#E5E8EB','--mu','#5E6670','--tx','#181B20'],
puro:d?['--bg','#000000','--card','#0D0D0F','--line','#222226','--soft','#17171A','--mu','#9A9AA2','--tx','#F5F5F7']:['--bg','#ffffff','--card','#F6F6F8','--line','#E4E4E8','--soft','#EFEFF2','--mu','#6B6B73','--tx','#111113'],
}[bg]||(pb?tint(pb[3]):null);
if(B)for(let i=0;i<B.length;i+=2)o[B[i]]=B[i+1];return o}
const VK=['--bg','--card','--line','--tx','--mu','--soft','--acc','--onacc','--ha','--hb','--hc'];
const paintTheme=()=>{const r=document.documentElement,p=PE(),t=TH(),o=pal(t,p.bg,p.acc),s=SET();r.dataset.theme=t;
r.dataset.anim=s.anim||(matchMedia('(prefers-reduced-motion:reduce)').matches?'soft':'normal');r.dataset.round=s.round||'round';r.dataset.font=s.font||'m';r.dataset.glass=s.glass===0?'off':'on';r.dataset.bg=p.bg;{const pb=REW.bgs.find(x=>x[1]==p.bg);if(pb){r.dataset.pbg='1';r.style.setProperty('--h1',pb[3]);r.style.setProperty('--h2',(pb[3]+60)%360)}else delete r.dataset.pbg;r.dataset.legend=(()=>{try{return isLegend()?'1':'0'}catch(e){return'0'}})()}
VK.forEach(k=>o[k]?r.style.setProperty(k,o[k]):r.style.removeProperty(k));const m=document.querySelector('meta[name=theme-color]');if(m)m.content=o['--bg']||(t=='dark'?'#0A1220':'#F1F6FD')};paintTheme();
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(SET().mode=='auto'){paintTheme();render(1)}})}catch(e){}
const setSet=o=>{S.set={...SET(),...o};paintTheme();save()},
lockToast=l=>toast('Desbloqueie no nível '+l,'','Ainda bloqueado'),
theme=()=>{setSet({mode:TH()=='dark'?'light':'dark'});render(1)},
setAcc=(c,live)=>{const lk=lockedColor(c);if(lk)return lockToast(lk);setSet({acc:c.toLowerCase()=='#3d8bff'?null:c});if(!live)render(1)},
setBg=k=>{const lk=lockedBg(k);if(lk)return lockToast(lk);setSet({bg:k});render(1)},
setMode=m=>{setSet({mode:m});render(1)},
resetPers=()=>{S.set={};paintTheme();save();render(1)};

// ---------- instalar no celular ----------
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
let ip=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();ip=e;if(page=='more'&&!sub)render(1)});addEventListener('appinstalled',()=>{ip=null;render(1)});
const inst=async()=>{if(ip){ip.prompt();await ip.userChoice.catch(()=>{});ip=null;render(1)}else alert('Para instalar: no iPhone, toque em Compartilhar e depois em "Adicionar à Tela de Início". No Android, abra o menu ⋮ do navegador e escolha "Instalar app".')};
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

// ---------- peças de interface ----------
const ib=(i,fn,l)=>`<button class="circ" aria-label="${l}" onclick="${fn}">${I(i,20)}</button>`,
topbar=(t,back)=>`<div class="top">${ib('back',back,'Voltar')}<h1>${t}</h1><span></span></div>`,
ht=t=>`<p class="hint">${t}</p>`,sq=(i,c='var(--acc)')=>`<span class="sq" style="background:${c};color:${c.startsWith('var')?'var(--onacc)':'#fff'}">${i}</span>`,
name=()=>(S.user.name||'Dudu').trim()||'Dudu',inicial=()=>esc(name()[0].toUpperCase()),avatar=(big=0)=>S.user.photo?`<img class="avatar-img ${big?'avatar-big':''}" src="${esc(S.user.photo)}" alt="Foto de ${esc(name())}" referrerpolicy="no-referrer" draggable="false" onerror="this.replaceWith(document.createTextNode(this.dataset.i))" data-i="${esc([...name()][0].toUpperCase())}">`:inicial(),
dm=d=>new Date(d+'T12:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long'}),wd=d=>new Date(d+'T12:00').toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),
dd=d=>Math.round((new Date(d+'T12:00')-new Date(today()+'T12:00'))/864e5),
dl=d=>{const n=dd(d);return n<0?'Atrasada':n==0?'Hoje':n==1?'Amanhã':wd(d)+', '+d.slice(8)+'/'+d.slice(5,7)},
tmin=m=>m>=60?(m/60|0)+'h'+(m%60?pad(m%60)+'min':''):m+'min',byDue=(a,b)=>a.due>b.due?1:a.due<b.due?-1:0,
rf=()=>page=='tasks'&&$('#tlist')?tl():render(1);
const taskRow=(t,full)=>`<div class="t ${t.done?'d':''} ${t.id==popId?'pop':''}"><input type="checkbox" aria-label="Concluir tarefa" ${t.done?'checked':''} onchange="T.toggle('${t.id}')"><div class="grow"><div class="tt">${esc(t.title)}</div><div class="meta"><span><i class="dot" style="background:${sj(t.subject).color}"></i>${esc(sj(t.subject).name)}</span><span class="${!t.done&&dd(t.due)<0?'late':''}">${dl(t.due)}</span>${full?`<span>${tmin(t.min)}</span><span>Prioridade ${t.pr.toLowerCase()}</span>`:''}</div></div>${full?`${t.done?'':`<button class="mini" aria-label="Estudar esta tarefa" onclick="T.study('${t.id}')">${I('play',16)}</button>`}<button class="mini" aria-label="Editar" onclick="T.edit('${t.id}')">${I('edit',17)}</button><button class="mini" aria-label="Excluir" onclick="T.del('${t.id}')">${I('x',17)}</button>`:''}</div>`;

// ---------- barra do topo (igual à do Fluxo) ----------
const appbar=()=>{const nr=unread();return`<div class="abar"><div><button class="circ" aria-label="Notificações${nr?': '+nr+' novas':''}" onclick="go('notifs')">${I('bell',19)}${nr?`<i class="bd">${nr>99?'99+':nr}</i>`:''}</button></div><div class="brand"><span class="bm"><i class="lg"></i></span>StudyFlow</div><div class="acts"><button class="circ" aria-label="Alternar tema" onclick="theme()">${I(TH()=='dark'?'sun':'moon',18)}</button><button class="circ av ${frameCls()}" aria-label="Meu perfil" onclick="go('profile')">${avatar()}</button></div></div>`};

// ---------- tarefas ----------
const T={toggle(id){const t=S.tasks.find(t=>t.id==id);if(!t)return;t.done=!t.done;if(t.done){buzz([18,35,35]);Snd.ui('done')}popId=id;save();rf();popId=null},del(id){S.tasks=S.tasks.filter(t=>t.id!=id);save();rf()},async edit(id){const t=S.tasks.find(t=>t.id==id);if(!t)return;const n=await askText('Editar tarefa',t.title);if(n&&n.trim()){t.title=n.trim();save();rf()}},
study(id){const t=S.tasks.find(t=>t.id==id);if(!t)return;go('timer');fm={s:t.subject,t:t.title};dsel=t.min>0?t.min:25;render(1)},
add(){const title=$('#tt').value.trim();if(!title)return;S.tasks.push({id:uid(),title,subject:$('#ts').value,due:$('#td').value||today(),min:+$('#tm2').value||30,pr:$('#tp').value,done:false});save();$('#tt').value='';tl();$('#tt').focus()}};
const tasksList=()=>{const p=S.tasks.filter(t=>!t.done).sort(byDue),lim=add(0,3),L={d3:p.filter(t=>t.due<=lim),all:p,feitas:S.tasks.filter(t=>t.done)},E={d3:'Nada para os próximos 3 dias.',all:'Você não tem tarefas pendentes.',feitas:'Nenhuma tarefa concluída ainda.'};
return`<div class="tabs">${[['d3','Próximos 3 dias'],['all','Todas'],['feitas','Feitas']].map(([k,l])=>`<button class="${ttab==k?'on':''}" onclick="ttab='${k}';tl(1)">${l} (${L[k].length})</button>`).join('')}</div><div class="card list">${L[ttab].map(t=>taskRow(t,1)).join('')||`<div class="empty">${E[ttab]}</div>`}</div>`};
const tl=a=>{const e=$('#tlist');if(e){e.classList.toggle('anim',!!a);e.innerHTML=tasksList()}else render(1)};
const taskForm=()=>S.subjects.length?`<form class="card f" onsubmit="event.preventDefault();T.add()"><label for="tt">Nova tarefa</label><input id="tt" placeholder="Ex: Lista de exercícios de física" required><div class="row"><div class="grow f"><label for="ts">Matéria</label><select id="ts">${opts()}</select></div><div class="grow f"><label for="td">Para quando</label>${dateField('td',today(),'Data da tarefa')}</div></div><details><summary>Mais detalhes: tempo e prioridade</summary><div class="row"><div class="grow f"><label for="tm2">Minutos</label><input id="tm2" type="number" min="1" value="30"></div><div class="grow f"><label for="tp">Prioridade</label><select id="tp"><option>Alta</option><option selected>Média</option><option>Baixa</option></select></div></div></details><button class="p">${I('plus',18)} Adicionar tarefa</button></form>`:`<div class="card empty">Crie uma matéria primeiro, na aba Matérias.</div>`;

// ---------- matérias ----------
function need(id){const g=S.grades.filter(g=>g.subject==id),t=S.target||8,nt=h=>`<div class="note">${I('target',18)}<span>${h}</span></div>`;if(!g.length)return nt('Cadastre uma nota para ver quanto precisa tirar na próxima prova.');
const n=g.length,sum=g.reduce((a,x)=>a+x.v,0),x=t*(n+1)-sum;
return nt(x<=0?`Você já garante média ${f1(t)}, mesmo que tire 0 na próxima prova.`:x>10?`Só com mais uma prova não dá para chegar em ${f1(t)}. Precisaria de mais avaliações.`:`Para terminar com média ${f1(t)}, tire pelo menos <b>${fc(x)}</b> na próxima prova.<br><small>Conta: (${r2(sum)} + nota) ÷ ${n+1} = ${f1(t)}</small>`)}
const renSub=async id=>{const s=S.subjects.find(x=>x.id==id);if(!s)return;const n=await askText('Novo nome da matéria',s.name);if(n&&n.trim()){s.name=n.trim();save();render(1)}},
delSub=async id=>{if(S.active&&S.active.subject==id)return alert('Finalize a sessão de estudo em andamento antes de excluir esta matéria.');if(!await askYes('Excluir matéria?','Isso apaga também as notas, provas, tarefas, revisões e o histórico de estudo dela.','Excluir',1))return;
S.subjects=S.subjects.filter(x=>x.id!=id);['tasks','grades','exams','reviews','sessions','packs'].forEach(k=>S[k]=S[k].filter(x=>x.subject!=id));save();go('subjects')};
const addSub=()=>{const n=$('#sn').value.trim();if(!n)return;S.subjects.push({id:uid(),name:n,color:PAL[S.subjects.length%PAL.length]});save();render(1)},
addGrade=id=>{const v=+String($('#gv').value).replace(',','.');if($('#gv').value.trim()===''||!(v>=0&&v<=10))return alert('Digite uma nota de 0 a 10.');const g={id:uid(),subject:id,name:$('#gn').value.trim()||'Avaliação',v};S.grades.push(g);gradeNotify(g);buzz(15);save();render(1)},
delG=id=>{S.grades=S.grades.filter(g=>g.id!=id);save();render(1)},addExam=id=>{const d=$('#ed')?.dataset.date||today();S.exams.push({id:uid(),subject:id,date:d,topics:($('#et')?.value||'').trim()});buzz(20);save();render(1)},delE=id=>{S.exams=S.exams.filter(e=>e.id!=id);save();render(1)};
function subDetail(id){const s=S.subjects.find(x=>x.id==id);if(!s){sub='';return P.subjects()}
const a=avg(id),n=S.sessions.filter(x=>x.subject==id),tp=new Set(n.map(x=>x.topic)).size,gs=S.grades.filter(g=>g.subject==id),ex=S.exams.filter(e=>e.subject==id&&e.date>=today()).sort((x,y)=>x.date>y.date?1:-1),tk=S.tasks.filter(t=>t.subject==id&&!t.done).sort(byDue);
return`${topbar(esc(s.name),"go('subjects')")}<div class="strip">${S.subjects.map(x=>`<button class="${x.id==id?'on':''}" onclick="go('subjects','${x.id}')"><i class="dot" style="background:${x.color};margin:0"></i>${esc(x.name)}</button>`).join('')}</div>
<div class="cover" style="--c:${s.color}"><div class="row"><button class="icb" aria-label="Trocar o símbolo da matéria" onclick="toggleIc()">${sq(ic(s.name,24),'rgba(255,255,255,.25)')}<i class="edt">${I('edit',11)}</i></button><div class="grow"><b style="font-size:18px">Média em ${esc(s.name)}</b><br><small>${gs.length} ${gs.length==1?'nota':'notas'}</small></div><div class="big xl">${f1(a)}</div></div><div class="bar"><i style="width:${a?fl(a)*10:0}%"></i></div></div>
${icPick?`<div class="card icp"><h2>Símbolo da matéria</h2><div class="icg">${ICONS.map((n,k)=>`<button class="${sIcon(s)==n?'on':''}" style="--k:${k}" onclick="setIc('${s.id}','${n}')" aria-label="Símbolo ${n}">${I(n,22)}</button>`).join('')}</div><button class="g" onclick="setIc('${s.id}','')">Voltar ao automático</button></div>`:''}<div class="card"><h2>Notas</h2><div class="chips2">${gs.map(x=>`<span class="chip">${esc(x.name)}: ${f1(x.v)}<b onclick="delG('${x.id}')" role="button" aria-label="Remover nota">${I('x',14)}</b></span>`).join('')||'<small>Nenhuma nota ainda.</small>'}</div>${need(id)}
<form class="f" style="margin-top:14px" onsubmit="event.preventDefault();addGrade('${id}')"><div class="row"><input id="gn" placeholder="Avaliação (ex: Prova 1)" aria-label="Nome da avaliação"><input id="gv" type="text" inputmode="decimal" placeholder="Nota" aria-label="Nota de 0 a 10" style="width:96px" required></div><button class="p">${I('plus',18)} Salvar nota</button></form></div>
<div class="card"><h2>Provas</h2>${ex.length?`<div class="list" style="margin-top:8px">${ex.map(e=>{const n=dd(e.date);return`<div class="t"><div class="grow"><div class="tt">${dm(e.date)}</div><small>${n==0?'É hoje':n==1?'Falta 1 dia':'Faltam '+n+' dias'}</small>${e.topics?`<br><small>${esc(e.topics)}</small>`:''}</div><button class="mini" aria-label="Revisão completa da prova" onclick="Pk.forExam('${e.id}')">${I('bulb',18)}</button><button class="mini" aria-label="Remover prova" onclick="delE('${e.id}')">${I('x',17)}</button></div>`}).join('')}</div>`:ht('Nenhuma prova marcada.')}
<form class="f" style="margin-top:10px" onsubmit="event.preventDefault();addExam('${id}')"><input id="et" placeholder="Conteúdo da prova (a IA usa para montar a revisão)" aria-label="Conteúdo da prova"><div class="row">${dateField('ed',today(),'Data da prova')}<button class="p" style="width:auto;white-space:nowrap">Marcar prova</button></div></form></div>
<div class="card"><h2>Estudo</h2><div class="grid g3" style="margin:12px 0 0"><div class="card"><div class="big">${tp}</div><small>conteúdos</small></div><div class="card"><div class="big">${n.length}</div><small>sessões</small></div><div class="card"><div class="big" style="font-size:20px">${hm(n.reduce((t,x)=>t+x.duration,0))}</div><small>estudados</small></div></div></div>
<div class="card"><h2>Tarefas pendentes</h2><div class="list" style="margin-top:10px">${tk.map(t=>taskRow(t)).join('')||'<div class="empty">Nenhuma tarefa desta matéria.</div>'}</div></div>
<div class="row"><button class="g" style="margin:0" onclick="renSub('${id}')">${I('edit',17)} Renomear</button><button class="g danger" style="margin:0" onclick="delSub('${id}')">${I('trash',17)} Excluir matéria</button></div>`}

// ---------- estatísticas ----------
const chartN=n=>{const ds=[...Array(n)].map((_,i)=>add(0,i-n+1)),v=ds.map(d=>dur(s=>day(s.startedAt)==d)/60),m=Math.max(30,...v);return`<div class="chart ${n>7?'th':''}">${ds.map((d,i)=>`<div class="${d==today()?'now':''}" style="--k:${i}"><small>${n==7&&v[i]?Math.round(v[i]):''}</small><b style="height:${v[i]/m*80}px"></b></div>`).join('')}</div><div class="lb">${ds.map((d,i)=>`<span>${n==7?wd(d).slice(0,3):(i%5==0?d.slice(8):'')}</span>`).join('')}</div>`};

// ---------- revisões ----------
let rvD=0;const RVR=[['Esqueci','Rever amanhã',1],['Lembrei mais ou menos','Rever em 3 dias',3],['Lembrei bem','Rever em 7 dias',7]],
rvBtns=(id,cont)=>`<div class="rvr">${RVR.map(([t,d],k)=>`<button class="g" onclick="Rv.fin('${id}',${k}${cont?',1':''})"><b>${t}</b><small>${d}</small></button>`).join('')}</div>`,
rvSet=(d,el)=>{rvD=d;el.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===el))};
const Rv={toggle(id){const r=S.reviews.find(x=>x.id==id);if(!r)return;if(!r.done)return Rv.ask(id);r.done=false;save();render(1)},
ask(id){const r=S.reviews.find(x=>x.id==id);if(!r)return;modal('Como foi a revisão?',`<p class="hint" style="margin:0 0 12px"><b>${esc(r.topic)}</b> · ${esc(sj(r.subject).name)}</p>${rvBtns(id,0)}`,`<button class="g" onclick="Rv.fin('${id}',-1)">Só concluir</button>`)},
fin(id,k,cont){const r=S.reviews.find(x=>x.id==id);if(!r)return;r.done=true;if(k>=0)S.reviews.push({id:uid(),topic:r.topic,subject:r.subject,due:add(0,RVR[k][2]),done:false});buzz([18,35,35]);Snd.ui('done');save();if(cont)return Rv.now(1);closeModal();render(1)},
now(cont){const t=today(),q=S.reviews.filter(r=>!r.done&&r.due<=t).sort((a,b)=>((a.sk||0)-(b.sk||0))||(a.due>b.due?1:a.due<b.due?-1:0));
if(!q.length){closeModal();if(cont)toast('Todas as revisões de hoje foram feitas.','','Boa!');return render(1)}
const r=q[0];modal('Revisar agora',`<div class="rvc">${sq(ic(sj(r.subject).name,22),sj(r.subject).color)}<h3>${esc(r.topic)}</h3><small>${esc(sj(r.subject).name)} · ${r.due<t?'atrasada':'para hoje'} · ${q.length==1?'falta 1':'faltam '+q.length}</small></div><p class="hint c" style="margin:12px 0">Tente lembrar do conteúdo sem olhar nada. Depois diga como foi:</p>${rvBtns(r.id,1)}`,`<button class="g" onclick="Rv.skp('${r.id}')">Pular</button><button class="g" onclick="closeModal()">Sair</button>`)},
skp(id){const r=S.reviews.find(x=>x.id==id);if(r){r.sk=(r.sk||0)+1;save()}Rv.now(1)},
del(id){S.reviews=S.reviews.filter(x=>x.id!=id);save();render(1)},
add(){const topic=$('#rt').value.trim();if(!topic||!S.subjects.length)return;S.reviews.push({id:uid(),topic,subject:$('#rs').value,due:add(0,rvD),done:false});showRF=0;rvD=0;buzz(15);Snd.ui('ok');save();render(1)}};

// ---------- páginas ----------
const mrow=(i,l,d,fn,end=I('chev',18))=>`<div class="card menu" onclick="${fn}">${sq(I(i,22))}<div class="grow"><b>${l}</b><br><small>${d}</small></div>${end}</div>`,
themeRow=()=>mrow(TH()=='dark'?'moon':'sun','Modo escuro','Alterne entre claro e escuro','theme()','<span class="sw" role="switch" aria-checked="'+(TH()=='dark')+'"></span>'),
openRev=f=>{rvf=f;go('more','rev')};
const P={
home(){const lim=add(0,3),pend=S.tasks.filter(t=>!t.done&&t.due<=lim).sort(byDue),ex=S.exams.filter(e=>e.date>=today()).sort((a,b)=>a.date>b.date?1:-1)[0],nr=dueRev(),hoje=dur(s=>day(s.startedAt)==today()),gm=S.goal||60,meta=gm*60,hh=new Date().getHours(),sau=hh<12?'Bom dia':hh<18?'Boa tarde':'Boa noite',
w7=[...Array(7)].map((_,i)=>add(0,-i)),wk=dur(s=>w7.includes(day(s.startedAt))),open=S.tasks.filter(t=>!t.done).length,tot=S.tasks.length,pc=Math.min(100,Math.round(hoje/meta*100)),C2=2*Math.PI*30,
ring=`<svg class="mring" width="60" height="60" viewBox="0 0 76 76" aria-label="${pc}% da meta"><circle cx="38" cy="38" r="30" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="8"/><circle class="mr" cx="38" cy="38" r="30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C2}" stroke-dashoffset="${C2*(1-pc/100)}" transform="rotate(-90 38 38)" style="--c:${C2}"/><text x="38" y="43" text-anchor="middle">${pc}%</text></svg>`,
wave=c=>`<svg class="wave ${c}" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="wg${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M0 34 Q50 6 100 34 T200 34 T300 34 T400 34 V60 H0Z" fill="url(#wg${c})"/></svg>`,
sc=(i,l,c,fn,bd)=>`<button class="card sc" onclick="${fn}">${bd?`<i class="bd">${bd}</i>`:''}${sq(I(i,22),c)}<span>${l}</span></button>`;
return`${appbar()}<div class="card hero2"><div class="hh"><div><span class="eyb">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span><h2>${sau}, ${esc(name())}!</h2></div><button class="mini wh" aria-label="Alterar meta" onclick="setGoal()">${I('edit',17)}</button></div>
<div class="hm"><div><small>Meta de hoje: ${gm}min</small><div class="big xl" data-cu="${hoje}" data-f="hm">${hm(hoje)}</div><small>${hoje>=meta?'Meta batida! Bom trabalho.':'Faltam '+hm(meta-hoje)}</small></div>${ring}</div>
<button class="p wb" onclick="go('timer')">${I('play',17)} Começar a estudar</button>${wave('w2')}${wave('')}</div>${homePack()}
<div class="dual"><div class="card stat"><div class="row"><span class="ci">${I('clock',18)}</span><div><small>Estudo na semana</small><b data-cu="${wk}" data-f="hm">${hm(wk)}</b></div></div><div class="bar"><i style="width:${Math.min(100,wk/(meta*7)*100)}%"></i></div></div><div class="card stat"><div class="row"><span class="ci k">${I('tasks',18)}</span><div><small>Tarefas pendentes</small><b data-cu="${open}">${open}</b></div></div><div class="bar"><i style="background:var(--ok);width:${tot?(tot-open)/tot*100:0}%"></i></div></div></div>
<div class="scs">${sc('clock','Estudar','var(--acc)',"go('timer')")}${sc('repeat','Revisões',PAL[1],"openRev('home')",nr)}${sc('bot','Tutor IA',PAL[2],"go('more','tutor')")}${sc('trophy','Progresso',PAL[7],"go('more','prog')")}</div>
${S.subjects.length?`<div class="sec"><h2>Suas matérias</h2><a onclick="go('subjects')">Ver todas</a></div><div class="strip">${S.subjects.map(x=>`<button onclick="go('subjects','${x.id}')"><i class="dot" style="background:${x.color};margin:0"></i>${esc(x.name)} <small>${f1(avg(x.id))}</small></button>`).join('')}</div>`:''}
<div class="sec"><h2>Tarefas dos próximos 3 dias</h2><a onclick="go('tasks')">Ver todas</a></div>
<div class="card list">${pend.slice(0,5).map(t=>taskRow(t)).join('')||'<div class="empty">Nenhuma tarefa por enquanto.</div>'}${pend.length>5?`<div class="empty" style="padding-bottom:0"><a onclick="go('tasks')" style="color:var(--acc);font-weight:700;cursor:pointer">+ ${pend.length-5} tarefas</a></div>`:''}</div>
${ex?`<div class="sec"><h2>Próxima prova</h2></div><div class="card row" style="margin-top:8px" onclick="go('subjects','${ex.subject}')">${sq(ic(sj(ex.subject).name,20),sj(ex.subject).color)}<div class="grow"><b>${esc(sj(ex.subject).name)}</b><br><small>${dm(ex.date)}, ${dd(ex.date)==0?'é hoje':dd(ex.date)==1?'falta 1 dia':'faltam '+dd(ex.date)+' dias'}</small></div>${I('chev',18)}</div>`:''}`},
subjects(){if(sub)return subDetail(sub);
return`${appbar()}<div class="head"><h1>Matérias</h1></div>
<div class="tiles">${S.subjects.map((s,k)=>{const a=avg(s.id);return`<button class="tile" style="--c:${s.color};--k:${k}" onclick="go('subjects','${s.id}')"><span style="display:flex">${ic(s.name,22)}</span><b>${esc(s.name)}</b><span class="big">${f1(a)}</span><div class="bar"><i style="width:${a?fl(a)*10:0}%"></i></div></button>`}).join('')}</div>
<div class="card row">${sq(I('target',20))}<div class="grow"><b>Média que você quer</b></div><input type="number" step="0.5" min="1" max="10" value="${S.target||8}" aria-label="Média desejada" style="width:84px;text-align:center" onchange="S.target=+this.value||8;save();render(1)"></div>
<form class="card row" onsubmit="event.preventDefault();addSub()"><input id="sn" placeholder="Nome da nova matéria" aria-label="Nome da nova matéria" required><button class="p" style="width:auto" aria-label="Adicionar matéria">${I('plus',18)}</button></form>`},
tasks(){return`${appbar()}<div class="head"><h1>Tarefas</h1></div>${taskForm()}<div id="tlist">${tasksList()}</div>`},
study(){const a=S.active,n={hoje:1,semana:7,mes:30}[range],ds=[...Array(n)].map((_,i)=>add(0,-i)),pv=[...Array(n)].map((_,i)=>add(0,-i-n)),rs=S.sessions.filter(s=>ds.includes(day(s.startedAt))),tot=rs.reduce((t,s)=>t+s.duration,0),dif=tot-dur(s=>pv.includes(day(s.startedAt))),by={};
rs.forEach(s=>by[day(s.startedAt)]=(by[day(s.startedAt)]||0)+s.duration);const best=Object.entries(by).sort((x,y)=>y[1]-x[1])[0],bs=S.subjects.map(s=>[s,rs.filter(x=>x.subject==s.id).reduce((t,x)=>t+x.duration,0)]).filter(x=>x[1]).sort((x,y)=>y[1]-x[1]),mx=rs.reduce((m,s)=>Math.max(m,s.duration),0),sk=streak();
const mc=(l,v,h)=>`<div class="card"><small>${l}</small><div class="big" style="font-size:20px">${v}</div><small>${h}</small></div>`;
return`${appbar()}<div class="head"><h1>Estudos</h1></div>
<div class="card row">${sq(I('flame',22),'var(--acc)')}<div class="grow"><div class="big">${sk} ${sk==1?'dia':'dias'} seguidos</div><small>${sk?'Estude hoje para manter a sequência.':'Conclua uma sessão hoje para começar.'}</small></div><div class="c"><b>${Math.max(longest(),sk)}</b><br><small>recorde</small></div></div>
${a?`<div class="card row" onclick="go('timer')">${sq(I('clock',20))}<b class="grow">Sessão em andamento</b>${I('chev',18)}</div>`:`<button class="p" style="margin-bottom:18px" onclick="go('timer')">${I('play',18)} Iniciar sessão de estudo</button>`}
<div class="tabs">${[['hoje','Hoje'],['semana','Semana'],['mes','Mês']].map(([k,l])=>`<button class="${range==k?'on':''}" onclick="range='${k}';render(1)">${l}</button>`).join('')}</div>
<div class="card c"><small>Tempo total ${range=='hoje'?'hoje':range=='semana'?'nos últimos 7 dias':'nos últimos 30 dias'}</small><div class="big xl">${hm(tot)}</div><small>${dif>=0?'+':'−'}${hm(Math.abs(dif))} em relação ao período anterior</small>${chartN(range=='mes'?30:7)}</div>
<div class="grid">${mc('Média por dia',hm(tot/n),'')}${mc('Melhor dia',best?wd(best[0])+', '+hm(best[1]):'—','')}${mc('Mais estudada',bs[0]?esc(bs[0][0].name):'—',bs[0]?hm(bs[0][1]):'sem sessões')}${mc('Sessões',rs.length,'no período')}${mc('Duração média',rs.length?hm(tot/rs.length):'—','por sessão')}${mc('Maior sessão',mx?hm(mx):'—','no período')}</div>
<div class="card"><h2>Tempo por matéria</h2>${bs.map(([s,v])=>`<div style="margin-top:14px"><div class="row"><i class="dot" style="background:${s.color};margin:0"></i><span class="grow">${esc(s.name)}</span><small>${hm(v)}, ${Math.round(v/tot*100)}%</small></div><div class="bar" style="margin-top:6px"><i style="width:${v/tot*100}%;background:${s.color}"></i></div></div>`).join('')||'<p class="empty">Nenhuma sessão neste período.</p>'}</div>`},
timer(){const a=S.active;
if(done)return`${topbar('Estudo concluído',"go('study')")}<div class="card c">${sq(I('check',24),'var(--acc)').replace('class="sq"','class="sq" style="margin:0 auto 10px;background:var(--hl)"')}<b>${esc(sj(done.subject).name)}</b><br><span class="mu">${esc(done.topic)}, ${hm(done.duration)} estudados</span><h2 style="margin-top:18px">Quanto você entendeu desse conteúdo?</h2>${[['Não entendi','amanhã'],['Entendi pouco','em 2 dias'],['Entendi razoavelmente','em 4 dias'],['Entendi bem','em 7 dias'],['Dominei','em 14 dias']].map(([t,d],i)=>`<button class="g" onclick="rate(${i+1})">${t} <small>(revisar ${d})</small></button>`).join('')}</div>`;
const run=a&&running(a),pl=a?a.planned:(+dsel||25)*60,left=a?pl-elapsed(a):pl,C=2*Math.PI*78,pr=a?Math.min(1,elapsed(a)/pl):0;
const ring=`<svg class="ring" width="220" height="220" viewBox="0 0 200 200"><circle cx="100" cy="100" r="78" fill="none" stroke="var(--soft)" stroke-width="12"/><circle id="rg" cx="100" cy="100" r="78" fill="none" stroke="var(--hl)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*pr}" transform="rotate(-90 100 100)"/><text x="100" y="108" text-anchor="middle" class="tm" id="tm">${fmt(left)}</text><text x="100" y="132" text-anchor="middle" class="sb">${a?(run?'Tempo restante':'Pausado'):'Duração do foco'}</text></svg>`;
if(a)return`${topbar('Modo foco',"go('study')")}${a.recover?`<div class="card c">Sessão interrompida (aba fechada). Contamos apenas até ${new Date(a.seen).toLocaleTimeString('pt-BR')}.<button class="p" style="margin-top:12px" onclick="S.active.recover=0;pause()">Recuperar e continuar</button><button class="g" onclick="finish()">Encerrar e salvar</button></div>`:''}
<div class="row" style="justify-content:center">${sq(ic(sj(a.subject).name,22),sj(a.subject).color)}<div><b>${esc(sj(a.subject).name)}</b><br><small>${esc(a.topic)}</small></div></div>${ring}<p class="hint c">Meta de ${Math.round(pl/60)} min</p>${sndRow()}
${a.recover?'':`<button class="p" onclick="pause()">${run?I('pause',18)+' Pausar':I('play',18)+' Continuar'}</button><button class="g" onclick="finish()">Finalizar e salvar</button><button class="g danger" style="border-color:transparent" onclick="finish(1)">Cancelar sessão</button>`}`;
return`${topbar('Iniciar estudo',"go('home')")}<div class="card f"><label for="ss">Matéria</label><select id="ss">${opts(fm.s)}</select><label for="st">Conteúdo</label><input id="st" placeholder="Ex: Equações do 2º grau" value="${esc(fm.t)}"><label>Duração em minutos</label><div class="chips">${[15,25,45,60].map(m=>`<button class="${dsel==m?'on':''}" onclick="setD(${m})">${m}</button>`).join('')}<button class="${[15,25,45,60].includes(+dsel)?'':'on'}" onclick="askMin()">${[15,25,45,60].includes(+dsel)?'Outro':dsel}</button></div></div>${ring}${sndRow()}<button class="p" onclick="startS()">${I('play',18)} Começar estudo</button>`},
rev(){const t=today(),all=S.reviews,pend=all.filter(r=>!r.done).sort((x,y)=>x.due>y.due?1:x.due<y.due?-1:0),late=pend.filter(r=>r.due<t),hoje=pend.filter(r=>r.due==t),prox=pend.filter(r=>r.due>t),nd=late.length+hoje.length,dn=all.filter(r=>r.done).sort((x,y)=>x.due<y.due?1:-1),
row=r=>`<div class="t"><div class="grow"><div class="tt">${esc(r.topic)}</div><div class="meta"><span><i class="dot" style="background:${sj(r.subject).color}"></i>${esc(sj(r.subject).name)}</span><span class="${!r.done&&r.due<t?'late':''}">${r.done?dm(r.due):dl(r.due)}</span></div></div>${r.done?'':`<button class="mini" aria-label="Revisão completa com IA" onclick="Pk.forReview('${r.id}')">${I('bulb',18)}</button>`}<button class="mini" aria-label="${r.done?'Reabrir revisão':'Concluir revisão'}" style="${r.done?'':'border:2px solid var(--bd);background:var(--hl);color:#fff;width:38px;height:38px'}" onclick="Rv.toggle('${r.id}')">${I(r.done?'repeat':'check',r.done?18:20)}</button><button class="mini" aria-label="Excluir revisão" onclick="Rv.del('${r.id}')">${I('x',17)}</button></div>`,
blk=(h,a)=>a.length?`<div class="ndh">${h} <small>(${a.length})</small></div><div class="card list">${a.map(row).join('')}</div>`:'';
return`${topbar('Revisões',"go('"+rvf+"')")}<div class="card rvh"><div class="row">${sq(I('repeat',22))}<div class="grow"><div class="big">${nd?nd+(nd==1?' revisão para hoje':' revisões para hoje'):'Nada para revisar hoje'}</div><small>${late.length?late.length+(late.length==1?' atrasada · ':' atrasadas · '):''}${prox.length} agendada${prox.length==1?'':'s'} · ${dn.length} feita${dn.length==1?'':'s'}</small></div></div>${nd?`<button class="p" style="margin-top:12px" onclick="Rv.now()">${I('play',18)} Revisar agora</button>`:`<p class="hint" style="margin:10px 0 0">Depois de cada foco, o app agenda a revisão sozinho.</p>`}</div>
<button class="g" style="margin-bottom:14px" onclick="showRF=!showRF;rvD=0;render(1)">${I(showRF?'x':'plus',18)} ${showRF?'Fechar':'Nova revisão'}</button>
${showRF?`<form class="card f" onsubmit="event.preventDefault();Rv.add()"><label for="rt">O que revisar</label><input id="rt" placeholder="Ex: Revolução Industrial" required><label for="rs">Matéria</label><select id="rs">${opts()}</select><label>Quando</label><div class="chips">${[[0,'Hoje'],[1,'Amanhã'],[3,'Em 3 dias'],[7,'Em 1 semana'],[14,'Em 2 semanas']].map(([d,l])=>`<button type="button" class="${rvD==d?'on':''}" onclick="rvSet(${d},this)">${l}</button>`).join('')}</div><button class="p">Salvar revisão</button></form>`:''}
${packList()}<div class="tabs">${[['pend','Pendentes',pend.length],['conc','Concluídas',dn.length]].map(([k,l,c])=>`<button class="${rtab==k?'on':''}" onclick="rtab='${k}';render(1)">${l} (${c})</button>`).join('')}</div>
${rtab=='pend'?(blk('Atrasadas',late)+blk('Hoje',hoje)+blk('Próximas',prox)||'<div class="card empty">Nenhuma revisão pendente.</div>'):(dn.length?`<div class="card list">${dn.map(row).join('')}</div>`:'<div class="card empty">Nenhuma revisão concluída ainda.</div>')}
<p class="hint c">Você já revisou ${rdone()} ${rdone()==1?'assunto':'assuntos'}.</p>`},
more(){if(sub=='nset')return ntSettings();if(sub=='snd')return sndView();if(sub=='rev')return P.rev();if(sub=='pers')return P.pers();if(sub=='acct')return acctView();if(sub=='tutor')return tutorView();if(sub=='prog')return progView();return moreMenu()},
profile(){const L=lvl();return`${topbar('Perfil',"go('home')")}<div class="card c" style="padding:26px 16px"><span class="circ av ${frameCls()}" style="width:84px;height:84px;font-size:38px;margin:0 auto 14px">${avatar(1)}</span><div class="row" style="justify-content:center;gap:8px;margin-bottom:14px"><button class="g mini-g" onclick="pickPhoto()">${I('camera',16)} ${S.user.photo?'Trocar foto':'Adicionar foto'}</button>${S.user.photo?`<button class="g mini-g" onclick="rmPhoto()">Remover</button>`:''}</div><div class="f"><label for="nm" class="mu">Seu nome</label><input id="nm" value="${esc(name())}" style="text-align:center" onchange="S.user.name=this.value.trim()||'Dudu';save()"></div><div class="ttl ${isLegend()?'gold':''}">${isLegend()?I('crown',16)+' ':''}${esc(curTitle())}</div><div style="margin-top:14px"><b>Nível ${L}</b> <small>${lvl()>=MAXLV?'Nível máximo':xpIn()+'/500 XP'}</small></div><div class="bar"><i style="width:${xpIn()/5}%"></i></div></div>${mrow('trophy','Progresso e recompensas','Nível, molduras, títulos e medalhas',"go('more','prog')")}${mrow('bell','Notificações',unread()?unread()+' novas':'Notas, revisões e avisos',"go('notifs')")}${mrow('cloud','Conta e nuvem',TK()?'Sincronização ativa':'Entre para salvar na nuvem',"go('more','acct')")}${mrow('palette','Personalização','Cores, animações e aparência',"go('more','pers')")}${themeRow()}${TK()?`<button class="g danger" onclick="logout()">Sair da conta</button>`:''}`}};
const tgRow=(i,l,d,on,fn)=>`<div class="card menu" onclick="${fn}" role="switch" aria-checked="${on}" tabindex="0">${sq(I(i,22))}<div class="grow"><b>${l}</b><br><small>${d}</small></div><span class="tg" aria-hidden="true" data-on="${on}"></span></div>`,
seg=(key,list,cur)=>`<div class="tabs">${list.map(([k,l])=>`<button class="${cur==k?'on':''}" onclick="setSet({${key}:'${k}'});render(1)">${l}</button>`).join('')}</div>`;
// ---------- sons: telas e controles ----------
const sndOk=id=>{const d=SND.find(s=>s[0]==id);return !!d&&lvl()>=d[2]},
sndName=id=>(SND.find(s=>s[0]==id)||[0,''])[1],
sndNow=()=>{const n=Snd.ids().map(sndName);if(n.length)return n.join(' + ');const sel=(SET().sel||[]).filter(sndOk).map(sndName);return SET().sauto!==0&&sel.length?'Ao começar: '+sel.join(' + '):'Nada tocando. Toque para escolher.'},
sndAuto=on=>{if(SET().sauto===0)return;if(on)(SET().sel||[]).filter(sndOk).slice(0,4).forEach(id=>Snd.start(id));else Snd.stopAll()},
sndVol=(k,v)=>{SET()[k]=+v;Snd.vol()},
sndRefresh=()=>{const b=$('#sndbox');if(b)b.innerHTML=sndInner();const e=$('#sndnow2');if(e)e.textContent=sndNow()},
sndTog=id=>{const d=SND.find(s=>s[0]==id);if(!d)return;if(lvl()<d[2])return lockToast(d[2]);
if(Snd.on(id))Snd.stop(id);else{if(Snd.ids().length>=4)return toast('Máximo de 4 sons ao mesmo tempo. Pare um para tocar outro.','','Aviso');if(!Snd.start(id))return toast('Seu navegador não conseguiu tocar esse som.','','Aviso')}
S.set={...SET(),sel:Snd.ids()};save();sndRefresh()},
sndCard=d=>{const[id,n,lv,k,ic]=d,lock=lvl()<lv,on=Snd.on(id);return `<button class="snd ${on?'on':''} ${lock?'lk':''}" onclick="sndTog('${id}')" aria-pressed="${on}" aria-label="${esc(n)}${lock?' (nível '+lv+')':''}"><span class="si">${lock?I('lock',18):on?I('pause',18):I(ic,18)}</span><b>${esc(n)}</b><small>${lock?'Nível '+lv:on?'Tocando':k=='m'?'Música':'Ambiente'}</small>${on?'<i class="eq"><u></u><u></u><u></u></i>':''}</button>`},
sndInner=()=>{const ids=Snd.ids(),L=lvl(),nx=SND.filter(s=>s[2]>L).sort((a,b)=>a[2]-b[2])[0],got=SND.filter(s=>s[2]<=L).length,
vr=(k,l,i)=>`<div class="vrow"><span class="vl">${I(i,16)} ${l}</span><input type="range" min="0" max="100" value="${SET()[k]==null?70:SET()[k]}" aria-label="Volume: ${l}" oninput="sndVol('${k}',this.value)" onchange="save()"></div>`;
return `<div class="card"><div class="row">${sq(I('music',22))}<div class="grow"><b>Agora</b><br><small id="sndnow">${esc(sndNow())}</small></div>${ids.length?`<button class="mini" aria-label="Parar todos os sons" onclick="Snd.stopAll();S.set={...SET(),sel:[]};save();sndRefresh()">${I('pause',17)}</button>`:''}</div>${vr('vm','Música','music')}${vr('va','Ambiente','cloud')}<small class="mu" style="display:block;margin-top:10px">Misture até 4 sons. Eles tocam sem parar, sem acabar.</small></div>
<h2 style="margin:16px 0 10px">Músicas calmas</h2><div class="snds">${SND.filter(s=>s[3]=='m').map(sndCard).join('')}</div>
<h2 style="margin:16px 0 10px">Sons do ambiente</h2><div class="snds">${SND.filter(s=>s[3]=='a').map(sndCard).join('')}</div>
<p class="hint" style="margin-top:6px">${got} de ${SND.length} liberados${nx?' · próximo: '+esc(nx[1])+' no nível '+nx[2]:' · você liberou todos!'}</p>
${tgRow('play','Tocar ao iniciar o foco','Retoma sua escolha e para quando o estudo acaba',SET().sauto!==0,"setSet({sauto:SET().sauto===0?1:0});sndRefresh()")}${tgRow('bell','Sons do app','Toques, conquistas, nível e avisos',SET().ui!==0,"setSet({ui:SET().ui===0?1:0});Snd.ui('ok');sndRefresh()")}`},
sndModal=()=>modal('Sons para estudar','<div id="sndbox">'+sndInner()+'</div>','<button class="p" onclick="closeModal()">Pronto</button>'),
sndView=()=>`${topbar('Sons e música',"go('more')")}<p class="hint">Músicas calmas e sons do ambiente para estudar. Cada nível libera sons novos.</p><div id="sndbox">${sndInner()}</div>`,
sndRow=()=>`<div class="card menu" onclick="sndModal()" role="button" tabindex="0">${sq(I('music',22))}<div class="grow"><b>Sons para estudar</b><br><small id="sndnow2">${esc(sndNow())}</small></div>${I('chev',18)}</div>`;

const acctView=()=>`${topbar('Conta e nuvem',"go('more')")}${TK()?`<div class="card c"><div style="display:flex;justify-content:center;margin-bottom:10px">${sq(I('cloud',24))}</div><b>Sincronização ativa</b><br><small>${esc(localStorage['studyflow.email']||'')}</small><br><small>${lastSync?'Última sincronização às '+new Date(lastSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Sincronizando…'}</small><p class="hint" style="margin:10px 0 0">Tarefas, notas, provas, revisões, personalização e o timer ficam iguais em todos os seus aparelhos.</p><button class="p" onclick="sync(1).then(()=>toast('Tudo atualizado','','Sincronizado'))">${I('repeat',18)} Sincronizar agora</button><button class="g" onclick="logout()">Sair da conta</button></div>`:`<form class="card f" onsubmit="event.preventDefault();authDo('login')"><label for="ae">E-mail</label><input id="ae" type="email" autocomplete="email" required><label for="ap">Senha (mínimo 6 caracteres)</label><div class="pw"><input id="ap" type="password" autocomplete="current-password" required><button type="button" class="eye" aria-label="Mostrar senha" onclick="togglePw('ap',this)">${I('eye',19)}</button></div><div id="am" class="hint" style="margin:0" role="status"></div><button class="p">${I('user',18)} Entrar</button><button type="button" class="g" style="margin:0" onclick="authDo('register')">Criar conta</button><button type="button" class="google" onclick="googleLogin()">${GLOGO} Continuar com Google</button><small class="c">Ao entrar, seus dados são unidos aos da nuvem.</small></form>`}`,
progView=()=>{const L=lvl();return`${topbar('Progresso',"go('more')")}<div class="card"><div class="row">${sq(I('trophy',24))}<div class="grow"><div class="big">Nível ${L} <small class="ttl2">${esc(curTitle())}</small></div><div class="bar" style="margin-top:6px"><i style="width:${xpIn()/5}%"></i></div><small>${lvl()>=MAXLV?'Nível máximo! Você liberou tudo.':xpIn()+' / 500 XP'}${nextRew(L)&&lvl()<MAXLV?' · próxima recompensa no nível '+nextRew(L):''}</small></div></div></div>
<div class="grid"><div class="card"><div class="big">${streak()}</div><small>dias seguidos</small></div><div class="card"><div class="big">${Math.max(longest(),streak())}</div><small>melhor sequência</small></div><div class="card"><div class="big">${hm(dur(()=>1))}</div><small>total estudado</small></div><div class="card"><div class="big">${S.sessions.length}</div><small>sessões</small></div></div>
${rewardsUI()}${achHead()}<div class="grid">${achList().map(a=>{const ok=a.ok;return`<div class="card ach ${ok?'':'off'}">${sq(I(a.i,22))}<b>${a.n}</b><small>${a.d}</small><div class="bar"><i style="width:${Math.min(100,a.v/a.t*100)}%"></i></div><small>${Math.min(Math.round(a.v),a.t)}/${a.t}${ok?', concluída':''}</small><span class="xpb ${ok?'got':''}">+${a.x} XP</span></div>`}).join('')}</div>`},
moreMenu=()=>{const nr=dueRev(),nu=unread();return`${appbar()}<div class="head"><h1>Mais</h1></div>${mrow('repeat','Revisões',nr?nr+(nr==1?' conteúdo para rever hoje':' conteúdos para rever hoje'):'Conteúdos para rever',"openRev('more')")}${mrow('trophy','Progresso e recompensas','Nível, recompensas e medalhas',"go('more','prog')")}${mrow('bot','Tutor com IA','Controla o app e tira dúvidas',"go('more','tutor')")}${mrow('bell','Notificações',nu?nu+(nu==1?' nova':' novas'):'Notas, revisões e avisos',"go('notifs')")}${mrow('sliders','Ajustes de avisos','O que avisar, horários e push no celular',"go('more','nset')")}${mrow('music','Sons e música','Sons relaxantes para estudar',"go('more','snd')")}${mrow('cloud','Conta e nuvem',TK()?'Sincronização ativa':'Entre para salvar na nuvem',"go('more','acct')")}${mrow('palette','Personalização','Cores, animações e aparência',"go('more','pers')")}${mrow('info','Novidades do app','Versão '+APP_VER,"go('news')")}${standalone()?'':mrow('download','Instalar app','Adicionar à tela inicial','inst()')}${themeRow()}
<h2 style="margin:22px 0 10px">Dados</h2><button class="g" onclick="resetAll()">Apagar tudo e começar do zero</button><button class="g" onclick="loadDemo()">Carregar dados de demonstração</button>`};
async function resetAll(){if(!await askYes('Apagar tudo?',TK()?'Isso apaga TUDO: matérias, tarefas, notas, provas, revisões, histórico, conquistas, nível, cores, foto e notificações. Vale para todos os seus aparelhos e não dá para desfazer.':'Isso apaga TUDO deste aparelho: dados, conquistas, nível, cores e foto. Não dá para desfazer.','Apagar tudo',1))return;
const ra=Date.now(),o={owner:S.owner,del:S.del,st:S.st};S=empty();Object.assign(S,o);S.set={mode:'dark'};S.lv=1;S.cnt={};S.ach={};S.resetAt=ra;
['sf.theme','sf.pers','sf.pks'].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});fix();save();SCAL.forEach(k=>S.st[k]=ra);persist();paintTheme();go('home');
if(TK()){try{await api('POST','/packs/clear',{});await sync(1)}catch(e){toast('Apaguei aqui, mas não consegui avisar a nuvem agora. Abra o app de novo com internet.','','Aviso');return}}toast('Tudo apagado','','Pronto')}
async function loadDemo(){if(!await askYes('Carregar demonstração?','Seus dados atuais serão trocados por dados de exemplo.','Carregar'))return;const o={owner:S.owner,set:S.set,del:S.del,st:S.st};S=demo();Object.assign(S,o);fix();save();go('home')}
function pickPhoto(){const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=()=>{const f=i.files&&i.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const z=256,c=document.createElement('canvas'),s=Math.min(im.width,im.height);c.width=c.height=z;c.getContext('2d').drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,z,z);S.user.photo=c.toDataURL('image/jpeg',.86);S.user.ps='c';save();render(1);toast('Foto atualizada','','Tudo certo')};im.onerror=()=>toast('Não consegui abrir essa imagem.','','Aviso');im.src=r.result};r.readAsDataURL(f)};i.click()}
const rmPhoto=()=>{S.user.photo='';S.user.ps='';save();render(1)};
P.pers=()=>{const p=PE(),s=SET(),t=TH(),cur=(p.acc||'').toLowerCase(),bg=p.bg||'pad',L=lvl(),def=t=='dark'?'#3D8BFF':'#1E6FE8',all=[...ACCS.map(a=>[...a,0]),...REW.colors.map(([l,n,c])=>[n,c,l])],known=all.some(([,c])=>c.toLowerCase()==cur),custom=cur&&!known;
const sw=all.map(([n,c,lk],k)=>{const lo=lk&&L<lk?lk:0,on=c=='#3D8BFF'?!cur:cur==c.toLowerCase(),A=c=='#3D8BFF'?def:pal(t,'pad',c)['--acc'];return`<button class="sw2 ${on?'on':''} ${lo?'lk':''}" style="--c:${A};--k:${k}" aria-label="${n}${lo?' (nível '+lo+')':''}" aria-pressed="${on}" onclick="setAcc('${c}')"><span>${on?I('check',20):lo?I('lock',18):''}</span><small>${lo?'Nível '+lo:n}</small></button>`}).join('');
const bgs=[...BGS.map(([k,n])=>[k,n,0]),...REW.bgs.map(([l,k,n])=>[k,n,l])].map(([k,n,lk])=>{const lo=lk&&L<lk?lk:0,o=pal(t,k,p.acc||null),b=o['--bg']||(t=='dark'?'#0A1220':'#F1F6FD'),cd=o['--card']||(t=='dark'?'#121C30':'#fff'),ac=o['--acc']||def;return`<button class="bgo ${bg==k?'on':''} ${lo?'lk':''}" aria-label="Fundo ${n}" aria-pressed="${bg==k}" onclick="setBg('${k}')"><span class="pv" style="background:${b}"><i style="background:${cd}"></i><i style="background:${cd}"></i><i style="background:${ac};width:55%;height:8px"></i>${lo?`<em class="lko">${I('lock',18)}</em>`:''}</span><small>${lo?'Nível '+lo:n}</small></button>`}).join('');
const an=ANIMS.find(a=>a[0]==(s.anim||(matchMedia('(prefers-reduced-motion:reduce)').matches?'soft':'normal')))||ANIMS[2];
return`${topbar('Personalização',"go('more')")}<h2 style="margin:0 0 10px">Modo</h2><div class="tabs">${[['dark','moon','Escuro'],['light','sun','Claro'],['auto','monitor','Automático']].map(([k,i,l])=>`<button class="${(s.mode||'dark')==k?'on':''}" onclick="setMode('${k}')">${I(i,16)} ${l}</button>`).join('')}</div>
<h2 style="margin:20px 0 0">Cor de destaque</h2><div class="sws">${sw}</div>
<h2 style="margin:0">Fundo</h2><div class="bgs">${bgs}</div>
<h2 style="margin:20px 0 10px">Animações</h2>${seg('anim',ANIMS.map(a=>[a[0],a[1]]),an[0])}<p class="hint" style="margin:-6px 0 0">${an[2]}.</p>
<h2 style="margin:20px 0 10px">Cantos</h2>${seg('round',[['sharp','Retos'],['mid','Médios'],['round','Redondos']],s.round||'round')}
<h2 style="margin:20px 0 10px">Tamanho do texto</h2>${seg('font',[['s','Pequeno'],['m','Normal'],['l','Grande']],s.font||'m')}
<h2 style="margin:20px 0 10px">Efeitos</h2>${tgRow('layers','Efeito vidro','Fundos translúcidos com desfoque',s.glass!==0,"setSet({glass:SET().glass===0?1:0});render(1)")}${tgRow('bolt','Vibração','Vibra ao concluir, subir de nível e iniciar o foco',s.vib!==0,"setSet({vib:SET().vib===0?1:0});buzz(20);render(1)")}${tgRow('bell','Sons do app','Toques, conquistas, nível e avisos',s.ui!==0,"setSet({ui:SET().ui===0?1:0});Snd.ui('ok');render(1)")}
<h2 style="margin:20px 0 10px">Seu perfil e metas</h2>${mrow('user','Foto e nome','Moldura: '+(REW.frames.find(f=>f[1]==s.frame&&L>=f[0])?.[2]||'nenhuma')+' · título: '+curTitle(),"go('profile')")}${mrow('trophy','Molduras, fundos e títulos','Recompensas liberadas por nível',"go('more','prog')")}${mrow('clock','Meta diária',(S.goal||60)+' min por dia','setGoal()')}${mrow('target','Média desejada',vir(S.target||8)+' nas matérias','setTarget()')}${mrow('music','Sons e música','Sons do app e sons relaxantes para estudar',"go('more','snd')")}${mrow('sliders','Ajustes de avisos','O que avisar, horários e push no celular',"go('more','nset')")}
<button class="g" onclick="resetPers()">${I('repeat',17)} Restaurar padrão</button>`};
P.login=()=>`<div class="login"><div class="logo-mark"><i class="lg"></i></div><h1>StudyFlow</h1><form class="card f" onsubmit="event.preventDefault();authDo('login')"><label for="ae">E-mail</label><input id="ae" type="email" autocomplete="email" placeholder="voce@email.com" required><label for="ap">Senha</label><div class="pw"><input id="ap" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres" required><button type="button" class="eye" aria-label="Mostrar senha" onclick="togglePw('ap',this)">${I('eye',19)}</button></div><div id="am" class="hint" style="margin:0" role="status"></div><button class="p">Entrar</button><button type="button" class="g" style="margin:0" onclick="authDo('register')">Criar conta</button><button type="button" class="google" onclick="googleLogin()">${GLOGO} Continuar com Google</button></form><button class="skip" onclick="skipLogin()">Continuar sem conta</button></div>`;
const modal=(title,body,actions)=>{$('#modal-root').innerHTML=`<div class="modal-back" onclick="closeModal(event)"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" onclick="event.stopPropagation()"><button class="modal-x" aria-label="Fechar" onclick="closeModal()">${I('x',18)}</button><h2>${esc(title)}</h2>${body}<div class="modal-actions">${actions}</div></section></div>`;setTimeout(()=>$('#modal-root input')?.focus(),20)};
const closeModal=e=>{if(!e||e.target===e.currentTarget){$('#modal-root').innerHTML='';if(askRes){const r=askRes;askRes=null;r(null)}}};
const setGoal=()=>modal('Meta diária',`<p class="hint">Escolha quantos minutos você quer estudar por dia.</p><input id="goal-min" type="number" min="5" max="720" inputmode="numeric" value="${S.goal||60}" aria-label="Minutos por dia">`,`<button class="g" onclick="closeModal()">Cancelar</button><button class="p" onclick="saveGoal()">Salvar meta</button>`);
const saveGoal=()=>{const v=Math.round(+$('#goal-min').value);if(v<5||v>720)return;S.goal=v;buzz(20);save();closeModal();render(1)};
let calTarget='',calMonth=new Date();
const dateField=(id,value=today(),label='Escolher data')=>`<button type="button" id="${id}" class="date-value" aria-label="${label}" data-date="${value}" onclick="openCalendar('${id}')">${new Date(value+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}${I('calendar',17)}</button>`;
function openCalendar(id){calTarget=id;calMonth=new Date((($('#'+id)?.dataset.date)||today())+'T12:00');drawCalendar()}
function drawCalendar(){const y=calMonth.getFullYear(),m=calMonth.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),chosen=$('#'+calTarget)?.dataset.date||today(),cells=[];for(let i=0;i<first;i++)cells.push('<i></i>');for(let d=1;d<=days;d++){const v=day(new Date(y,m,d,12)),on=v==chosen,now=v==today();cells.push(`<button class="${on?'on ':''}${now?'today':''}" onclick="pickCalendar('${v}')">${d}</button>`)}modal(new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(calMonth),`<div class="cal-nav"><button class="mini" onclick="calMonth.setMonth(calMonth.getMonth()-1);drawCalendar()">${I('back',18)}</button><button class="mini" onclick="calMonth.setMonth(calMonth.getMonth()+1);drawCalendar()">${I('chev',18)}</button></div><div class="cal-week">${['D','S','T','Q','Q','S','S'].map(x=>'<b>'+x+'</b>').join('')}</div><div class="calendar">${cells.join('')}</div>`,`<button class="g" onclick="pickCalendar('${today()}')">Hoje</button><button class="p" onclick="closeModal()">Fechar</button>`)}
function pickCalendar(v){const e=$('#'+calTarget);if(e){e.dataset.date=v;e.value=v;e.innerHTML=new Date(v+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})+I('calendar',17)}buzz(12);closeModal()}
const togglePw=(id,b)=>{const i=$('#'+id),sh=i.type=='password';i.type=sh?'text':'password';b.innerHTML=I(sh?'eyeoff':'eye',19);b.setAttribute('aria-label',sh?'Ocultar senha':'Mostrar senha')};
const setD=m=>{fm={s:$('#ss').value,t:$('#st').value};dsel=m;render(1)};

// ---------- janelas próprias (no lugar de prompt/confirm do navegador) ----------
function askText(title,val,ph){return new Promise(res=>{askRes=res;modal(title,`<input id="ask-in" value="${esc(val||'')}" placeholder="${esc(ph||'')}" onkeydown="if(event.key=='Enter')askOk()">`,`<button class="g" onclick="closeModal()">Cancelar</button><button class="p" onclick="askOk()">Salvar</button>`);setTimeout(()=>{const i=$('#ask-in');if(i){i.focus();i.select()}},40)})}
function askYes(title,msg,ok='Confirmar',danger){return new Promise(res=>{askRes=res;modal(title,`<p class="hint" style="margin:0">${esc(msg)}</p>`,`<button class="g" onclick="closeModal()">Cancelar</button><button class="p ${danger?'dg':''}" onclick="askOk(1)">${esc(ok)}</button>`)})}
function askOk(yes){const r=askRes,i=$('#ask-in');askRes=null;const v=yes?true:i?i.value:true;$('#modal-root').innerHTML='';if(r)r(v)}
async function askMin(){const v=await askText('Duração em minutos','30');const n=Math.round(+v);if(n>=1&&n<=720)setD(n)}
const setTarget=()=>modal('Média desejada',`<p class="hint">Qual média você quer tirar nas matérias?</p><input id="tg-in" type="text" inputmode="decimal" value="${vir(S.target||8)}" aria-label="Média desejada">`,`<button class="g" onclick="closeModal()">Cancelar</button><button class="p" onclick="saveTarget()">Salvar</button>`),
saveTarget=()=>{const v=+String($('#tg-in').value).replace(',','.');if(!(v>=1&&v<=10))return toast('Digite uma média de 1 a 10.','','Aviso');S.target=v;save();closeModal();render(1)};
const bump=k=>{S.cnt=S.cnt||{};S.cnt[k]=(S.cnt[k]||0)+1};

// ---------- notificações do sininho ----------
const NTY={grade:['target','nota','#10B981'],review:['repeat','rev','#F59E0B'],pack:['bulb','rev','#8B5CF6'],exam:['calendar','rev','#EF4444'],task:['tasks','rot','#3B82F6'],goal:['clock','rot','#06B6D4'],focus:['clock','rot','#06B6D4'],ach:['trophy','app','#EC4899'],level:['star','app','#F97316'],update:['info','app','var(--acc)'],info:['bell','app','var(--acc)']},
NFS=[['all','Todas'],['nota','Notas'],['rev','Revisões'],['rot','Rotina'],['app','App']],
NCTA={grade:'Ver matéria',review:'Revisar',pack:'Fazer revisão',exam:'Ver prova',task:'Ver tarefas',goal:'Estudar agora',focus:'Abrir timer',ach:'Ver conquistas',level:'Ver recompensas',update:'Ver novidades',info:'Abrir'},
NCAT=[['nota','Notas','Quando uma nota é lançada','target'],['rev','Revisões e provas','Revisão do dia, prova chegando, revisão completa pronta','repeat'],['rot','Tarefas e meta','Tarefas do dia, meta e sequência em risco','tasks'],['app','Conquistas e novidades','Conquistas, níveis e atualizações do app','trophy']];
const unread=()=>(S.notifs||[]).filter(n=>!n.read).length,
ago=ts=>{const m=Math.round((Date.now()-ts)/6e4);return m<1?'agora':m<60?'há '+m+' min':m<1440?'há '+Math.round(m/60)+' h':m<2880?'ontem':dm(day(ts))};
// a chave evita avisar duas vezes a mesma coisa (nem em outro aparelho, nem depois de apagar)
function notify(type,title,body,link,key){S.notifs=S.notifs||[];if(((SET().nt||{})[(NTY[type]||NTY.info)[1]])===0)return false;const id=key?'n_'+key:'n_'+uid();if(S.notifs.some(n=>n.id==id)||(S.del&&S.del[id]))return false;
S.notifs.unshift({id,type,title,body:body||'',ts:Date.now(),read:false,link:link||null});if(S.notifs.length>120)S.notifs=S.notifs.slice().sort((a,b)=>b.ts-a.ts).slice(0,120);return true}
function checkAlerts(){if(gate())return false;let ch=false;const t=today(),h=new Date().getHours(),n=(...a)=>{if(notify(...a))ch=true};
S.reviews.filter(r=>!r.done&&r.due<=t&&dd(r.due)>=-30).forEach(r=>n('review',r.due<t?'Revisão atrasada':'Revisão para hoje',r.topic+' · '+sj(r.subject).name,{p:'more',s:'rev'},'rv_'+r.id+'_'+r.due));
S.reviews.filter(r=>!r.done&&dd(r.due)==1).forEach(r=>n('review','Revisão amanhã',r.topic+' · '+sj(r.subject).name,{p:'more',s:'rev'},'rvt_'+r.id+'_'+r.due));
S.exams.forEach(e=>{const k=dd(e.date);if([7,3,1,0].includes(k))n('exam',k==0?'Prova hoje':k==1?'Prova amanhã':'Prova em '+k+' dias',sj(e.subject).name+(e.topics?' · '+e.topics:''),{p:'subjects',s:e.subject},'ex_'+e.id+'_'+k)});
const td=S.tasks.filter(x=>!x.done&&x.due==t);if(td.length)n('task',td.length==1?'1 tarefa para hoje':td.length+' tarefas para hoje',td.slice(0,3).map(x=>x.title).join(', '),{p:'tasks'},'tk_'+t);
const od=S.tasks.filter(x=>!x.done&&x.due<t);if(od.length&&h>=8)n('task',od.length==1?'1 tarefa atrasada':od.length+' tarefas atrasadas',od.slice(0,3).map(x=>x.title).join(', '),{p:'tasks'},'od_'+t);
const hoje=dur(s=>day(s.startedAt)==t),meta=(S.goal||60)*60;
if(h>=19&&hoje==0&&streak()>0)n('goal','Sua sequência está em risco','Estude hoje para manter '+streak()+' dias seguidos.',{p:'timer'},'st_'+t);
else if(h>=18&&hoje>0&&hoje<meta)n('goal','Falta pouco para a meta','Faltam '+hm(meta-hoje)+' para bater a meta de hoje.',{p:'timer'},'gl_'+t);
if(ch){save();Snd.ui('notif')}return ch}
function updNotice(){let seen;try{seen=localStorage['sf.ver'];localStorage['sf.ver']=APP_VER}catch(e){return}
if(seen!==APP_VER&&(seen||S.sessions.length||S.tasks.length)){const c=CHANGELOG[0];if(notify('update','StudyFlow atualizado: v'+c.v,c.it.slice(0,3).join(' · '),{p:'news'},'upd_'+APP_VER))save()}}
function gradeNotify(g){const a=avg(g.subject),t=S.target||8,s=sj(g.subject).name,gs=S.grades.filter(x=>x.subject==g.subject),sum=gs.reduce((p,y)=>p+y.v,0);let b='Média em '+s+': '+f1(a)+'.';
if(a<t){const x=t*(gs.length+1)-sum;if(x>0&&x<=10)b+=' Para fechar com '+f1(t)+', tire '+fc(x)+' na próxima.'}else b+=' Acima da média que você quer ('+f1(t)+').';
notify('grade',s+': '+g.name+' '+f1(g.v),b,{p:'subjects',s:g.subject},'g_'+g.id)}
function ntOpen(id){const n=S.notifs.find(x=>x.id==id);if(!n)return;if(!n.read){n.read=true;save()}const l=n.link;if(!l)return render(1);if(l.p=='pack')return Pk.open(l.s);go(l.p,l.s||'')}
const ntDel=id=>{S.notifs=S.notifs.filter(x=>x.id!=id);save();render(1)},ntAll=()=>{S.notifs.forEach(n=>n.read=true);save();render(1)},
ntClear=async()=>{if(!S.notifs.length)return;if(await askYes('Limpar notificações?','Todas as notificações serão apagadas.','Limpar',1)){S.notifs=[];save();render(1)}};
// push no celular (com o app fechado): o servidor manda quando precisar
const pushOk=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&/^https?:$/.test(location.protocol),
u8=b=>{const p='='.repeat((4-b.length%4)%4),r=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))},
swReady=()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,j)=>setTimeout(()=>j(new Error('sw')),4000))]);
async function pushCheck(){if(!pushOk())pushSt='unsupported';else if(Notification.permission=='denied')pushSt='denied';
else{try{const reg=await swReady(),sub=await reg.pushManager.getSubscription();pushSt=sub&&Notification.permission=='granted'?'on':'off';if(pushSt=='on'&&TK())api('POST','/push/subscribe',{subscription:sub.toJSON(),tz:new Date().getTimezoneOffset()}).catch(()=>{})}catch(e){pushSt='off'}}
if(page=='notifs'||(page=='more'&&sub=='nset'))render(1)}
async function pushOn(){if(!TK())return toast('Entre na sua conta para receber push.','','Aviso');
try{const p=await Notification.requestPermission();if(p!='granted'){pushSt=p=='denied'?'denied':'off';return render(1)}
const k=await api('GET','/push/key'),reg=await swReady();let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(k.key)});
await api('POST','/push/subscribe',{subscription:sub.toJSON(),tz:new Date().getTimezoneOffset()});pushSt='on';toast('Notificações no celular ativadas','','Tudo certo')}
catch(e){pushSt=e.status==503?'noserver':'off';toast(e.status==503?'O servidor ainda não tem as chaves de push (veja o passo a passo).':e.message,'','Aviso')}render(1)}
async function pushOff(){try{const reg=await swReady(),sub=await reg.pushManager.getSubscription();if(sub){await api('POST','/push/unsubscribe',{endpoint:sub.endpoint}).catch(()=>{});await sub.unsubscribe()}}catch(e){}pushSt='off';if(page=='notifs'||(page=='more'&&sub=='nset'))render(1)}
const pushTest=async()=>{try{await api('POST','/push/test',{});toast('Enviei um teste. Já chega!','','Push')}catch(e){toast(e.message,'','Aviso')}};
function sysNotify(t,b){try{if(!('Notification' in window)||Notification.permission!='granted'||!navigator.serviceWorker)return;navigator.serviceWorker.ready.then(r=>r.showNotification(t,{body:b,icon:'icon-192.png',badge:'favicon-32.png',tag:'sf-focus',data:{url:'./'}}))}catch(e){}}
const pushCard=()=>{const m={unsupported:['Seu navegador não suporta push. No iPhone, instale o app na tela inicial primeiro.',''],denied:['As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador.',''],noserver:['O servidor ainda não tem as chaves de push configuradas.',''],off:['Receba avisos de revisões, provas e sequência mesmo com o app fechado.','on'],on:['Ativado neste aparelho. Você recebe avisos mesmo com o app fechado.','off']}[pushSt]||['',''];
return `<div class="card"><div class="row">${sq(I('bell',22))}<div class="grow"><b>Push no celular</b><br><small>${m[0]}</small></div>${m[1]?`<span class="tg" role="switch" aria-checked="${pushSt=='on'}" tabindex="0" onclick="${pushSt=='on'?'pushOff()':'pushOn()'}"></span>`:''}</div>${pushSt=='on'?`<button class="g" style="margin-top:12px" onclick="pushTest()">Enviar notificação de teste</button>`:''}</div>`};
const ntSet=k=>{const nt={...(SET().nt||{})};nt[k]=nt[k]===0?1:0;setSet({nt});render(1)},
setQH=(i,v)=>{const q=[...(SET().qh||[8,21])];q[i]=+v;if(q[0]>=q[1])return toast('O horário inicial precisa ser antes do final.','','Aviso');setSet({qh:q});render(1)},
dayHead=ts=>{const d=day(ts);return d==today()?'Hoje':d==add(0,-1)?'Ontem':dm(d)},
ntPrefs=()=>{const nt=SET().nt||{},q=SET().qh||[8,21],hrs=i=>`<select aria-label="${i?'Até':'De'}" onchange="setQH(${i},this.value)">${Array.from({length:24},(_,h)=>`<option value="${h}" ${q[i]==h?'selected':''}>${String(h).padStart(2,'0')}h</option>`).join('')}</select>`;
return `<h2 style="margin:20px 0 10px">O que avisar</h2>${NCAT.map(([k,l,d,ic])=>tgRow(ic,l,d,nt[k]!==0,`ntSet('${k}')`)).join('')}<div class="card"><div class="row">${sq(I('moon',22))}<div class="grow"><b>Horário dos avisos</b><br><small>Fora dele, o push não toca</small></div></div><div class="row qh">${hrs(0)}<span class="mu">até</span>${hrs(1)}</div></div>`};
const NFI={all:'bell',nota:'target',rev:'repeat',rot:'tasks',app:'trophy'};
P.notifs=()=>{const L=(S.notifs||[]).slice().sort((a,b)=>b.ts-a.ts),grp=k=>L.filter(n=>k=='all'||(NTY[n.type]||NTY.info)[1]==k),vis=grp(nfilt),u=unread(),tot=L.length;let last='';
return `${topbar('Notificações',"go('home')")}<div class="card ntsum"><div class="row">${sq(I('bell',22))}<div class="grow"><b>${u?u+(u==1?' nova':' novas'):'Tudo em dia'}</b><br><small>${tot?(tot==1?'1 aviso no total':tot+' avisos no total'):'Notas, revisões, provas e novidades aparecem aqui.'}</small></div>${tot?`<button class="mini" aria-label="Marcar tudo como lido" onclick="ntAll()" ${u?'':'disabled'}>${I('check',18)}</button><button class="mini" aria-label="Limpar tudo" onclick="ntClear()">${I('trash',17)}</button>`:''}</div></div>
<div class="strip">${NFS.map(([k,l])=>{const c=grp(k).filter(n=>!n.read).length;return `<button class="${nfilt==k?'on':''}" onclick="nfilt='${k}';render(1)">${I(NFI[k],15)} ${l}${c?` <i class="cnt">${c}</i>`:''}</button>`}).join('')}</div>
${vis.map(n=>{const y=NTY[n.type]||NTY.info,h=dayHead(n.ts),hd=h!=last?`<div class="ndh">${h}</div>`:'';last=h;return `${hd}<div class="card nc ${n.read?'':'nw'}" onclick="ntOpen('${n.id}')" role="button" tabindex="0">${sq(I(y[0],20),y[2])}<div class="grow"><b>${esc(n.title)}</b><div class="nb">${esc(n.body)}</div><div class="nf"><small>${ago(n.ts)}</small>${n.link?`<span class="ncta">${NCTA[n.type]||'Abrir'} ${I('chev',13)}</span>`:''}</div></div><button class="mini" aria-label="Apagar notificação" onclick="event.stopPropagation();ntDel('${n.id}')">${I('x',16)}</button></div>`}).join('')||`<div class="card c empty">${I('bell',30)}<p style="margin:8px 0 0">${L.length?'Nada neste filtro.':'Tudo em dia! Notas, revisões, provas e novidades do app aparecem aqui.'}</p></div>`}`};
const ntSettings=()=>`${topbar('Ajustes de avisos',"go('more')")}<p class="hint">Escolha o que aparece no sininho e o que chega no celular.</p>${pushCard()}${ntPrefs()}<h2 style="margin:20px 0 10px">Som</h2>${tgRow('bell','Som ao chegar aviso','Um sinal curto quando algo novo chega',SET().nsnd!==0,"setSet({nsnd:SET().nsnd===0?1:0});render(1)")}<button class="g" onclick="go('notifs')">${I('bell',17)} Abrir notificações</button>`;
P.news=()=>`${topbar('Novidades do app',"go('more')")}${CHANGELOG.map(c=>`<div class="card"><div class="row"><b class="grow">${esc(c.t)}</b><span class="xpb got">v${c.v}</span></div><small>${dm(c.d)}</small><ul class="pts">${c.it.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}`;

// ---------- subir de nível: recompensas ----------
function lvCheck(){const L=lvl();if(S.lv==null){S.lv=L;return}
if(L>S.lv){const o=S.lv;S.lv=L;setTimeout(()=>levelUp(o,L),350);for(let i=o+1;i<=L;i++){const r=rewardsAt(i);notify('level','Nível '+i+' alcançado!',r.length?'Novidades: '+r.join(', '):'Continue assim!',{p:'more',s:'prog'},'lv_'+i)}}}
function levelUp(o,L){if(gate())return;const rw=[];for(let i=o+1;i<=L;i++)rw.push(...rewardsAt(i));const nx=nextRew(L);
modal(L>=MAXLV?'NÍVEL MÁXIMO!':'Subiu de nível!',`<div class="lvup ${L>=MAXLV?'legend':''}"><div class="lvn">${L}</div><p class="hint">${L>=MAXLV?'Você virou uma Lenda do StudyFlow! Veja tudo que desbloqueou.':'Você chegou ao nível '+L+'.'}</p>${rw.length?`<div class="lvr">${rw.map(r=>`<span>${I('gift',15)} ${esc(r)}</span>`).join('')}</div>`:`<p class="hint">${nx?'Próxima recompensa no nível '+nx+'.':'Você já viu tudo. Lenda!'}</p>`}</div>`,`<button class="g" onclick="closeModal();go('more','prog')">Ver recompensas</button><button class="p" onclick="closeModal()">Continuar</button>`);bigBurst();Snd.ui('level');buzz([40,60,40,60,120])}
const equip=(k,v)=>{setSet({[k]:v});render(1)},
rewardsUI=()=>{const L=lvl(),s=SET(),p=PE(),t=TH(),
chip=(ok,on,l,click,inner,lab,sub)=>`<button class="rw ${ok?'':'lk'} ${on?'on':''}" onclick="${ok?click:`lockToast(${l})`}">${inner}<b>${lab}</b><small>${ok?(on?'Em uso':sub):'Nível '+l}</small></button>`,
cols=REW.colors.map(([l,n,c])=>chip(L>=l,(s.acc||'').toLowerCase()==c.toLowerCase(),l,`setAcc('${c}')`,`<span class="rsw" style="background:${c}">${L>=l?'':I('lock',16)}</span>`,n,'Usar')),
bgs=REW.bgs.map(([l,k,n,h])=>chip(L>=l,p.bg==k,l,`setBg('${k}')`,`<span class="rsw sq2" style="background:linear-gradient(135deg,${hsl(h,60,t=='dark'?18:88)},${hsl((h+40)%360,70,t=='dark'?30:76)})">${L>=l?'':I('lock',16)}</span>`,n,'Usar')),
frs=[[1,'','Nenhuma'],...REW.frames].map(([l,k,n])=>chip(L>=l,(s.frame||'')==k,l,`equip('frame','${k}')`,`<span class="rsw fprev ${k?'fr-'+k:''}">${S.user.photo?`<img src="${esc(S.user.photo)}" alt="" referrerpolicy="no-referrer">`:I('user',18)}</span>`,n,'Usar')),
tts=REW.titles.map(([l,n])=>chip(L>=l,curTitle()==n,l,`equip('title','${n}')`,`<span class="rsw tt">${I('star',18)}</span>`,n,'Usar')),
ext=REW.extras.map(([l,n])=>`<div class="rw ${L>=l?'on':'lk'}"><span class="rsw tt">${L>=l?I('crown',18):I('lock',16)}</span><b>${n}</b><small>${L>=l?'Liberado':'Nível '+l}</small></div>`),
snds=SND.map(([id,n,l,k,ic])=>`<div class="rw ${L>=l?'':'lk'}" onclick="go('more','snd')"><span class="rsw tt">${L>=l?I(ic,18):I('lock',16)}</span><b>${esc(n)}</b><small>${L>=l?(k=='m'?'Música':'Ambiente'):'Nível '+l}</small></div>`),
sec=(t,a)=>`<h2 style="margin:18px 0 8px">${t}</h2><div class="rws">${a.join('')}</div>`;
return `<h2 style="margin:20px 0 2px">Recompensas</h2><p class="hint">Cada nível libera novidades até o nível ${MAXLV}. ${nextRew(L)?'Próxima no nível '+nextRew(L)+'.':'Você liberou tudo!'}</p>${sec('Cores',cols)}${sec('Fundos',bgs)}${sec('Molduras da foto',frs)}${sec('Títulos',tts)}${sec('Sons e músicas',snds)}${sec('Especiais do nível '+MAXLV,ext)}`};

// ---------- revisão completa feita pela IA ----------
let pkS={id:null,i:0,tab:'res',ans:{},sel:{},fb:{},draft:'',busy:0,gen:0,fail:{},last:null};
const packXp=()=>(S.packs||[]).reduce((t,p)=>t+((p.result&&p.result.xp)||0),0),
pkFor=(rid,due)=>(S.packs||[]).find(p=>p.rid==rid&&(due==null||p.due==due)),
packList=()=>{const L=(S.packs||[]).slice().sort((a,b)=>b.created-a.created).slice(0,8);if(!L.length)return'';
return `<h2 style="margin:4px 0 8px">Revisões completas</h2><div class="card list">${L.map(p=>`<div class="t" onclick="Pk.open('${p.id}')" style="cursor:pointer"><span class="sq" style="background:var(--acc);color:var(--onacc)">${I('bulb',20)}</span><div class="grow"><div class="tt">${esc(p.topic)}</div><div class="meta"><span><i class="dot" style="background:${sj(p.subject).color}"></i>${esc(sj(p.subject).name)}</span><span>${p.result?'Feita: '+Math.round(p.result.pct)+'%':'Pronta para fazer'}</span></div></div>${I('chev',18)}</div>`).join('')}</div>`},
homePack=()=>{const p=(S.packs||[]).filter(x=>!x.result&&dd(x.due)<=1&&dd(x.due)>=-3).sort((a,b)=>a.due>b.due?1:-1)[0];if(!p)return'';
return `<div class="card row pkhome" onclick="Pk.open('${p.id}')">${sq(I('bulb',22))}<div class="grow"><b>Revisão completa pronta</b><br><small>${esc(p.topic)} · ${dl(p.due).toLowerCase()}</small></div><span class="xpb got" style="margin:0">Fazer</span></div>`};
const Pk={
open(id){const p=S.packs.find(x=>x.id==id);if(!p)return toast('Essa revisão não está mais aqui.','','Aviso');pkS={...pkS,id,i:0,tab:'res',ans:{},sel:{},fb:{},draft:'',busy:0,last:null};go('pack')},
async forReview(rid){const r=S.reviews.find(x=>x.id==rid);if(!r)return;const p=pkFor(rid,r.due);if(p)return Pk.open(p.id);await Pk.make({rid,kind:'review',topic:r.topic,subject:r.subject,due:r.due},true)},
async forExam(eid){const e=S.exams.find(x=>x.id==eid);if(!e)return;const p=pkFor(eid,e.date);if(p)return Pk.open(p.id);await Pk.make({rid:eid,kind:'exam',topic:e.topics||'Conteúdo geral da prova',subject:e.subject,due:e.date},true)},
async make(x,open){if(pkS.gen)return toast('Já estou preparando uma revisão…','','Aguarde');if(!TK())return toast('Entre na sua conta para usar a IA.','','Aviso');pkS.gen=1;
if(open)modal('Preparando sua revisão',`<p class="hint">A IA está montando o resumo e as questões. Pode levar até 1 minuto.</p><div class="c" style="padding:12px">${spin(34)}</div>`,'');
try{const r=await api('POST','/pack',{rid:x.rid,due:x.due,kind:x.kind,topic:x.topic,subject:sj(x.subject).name,sid:x.subject}),p=Pk.add(r.pack);if(open){closeModal();Pk.open(p.id)}}catch(e){if(open)closeModal();toast(e.message,'','Não consegui preparar')}pkS.gen=0},
add(d){const id='pk_'+d.key;let p=S.packs.find(x=>x.id==id);if(p)return p;
p={id,rid:d.rid,due:d.due,kind:d.kind,topic:d.topic,subject:d.sid,summary:d.summary,points:d.points||[],qs:d.qs,created:d.created||Date.now(),result:null};S.packs.push(p);
notify('pack','Sua revisão completa está pronta',d.topic,{p:'pack',s:id},'pk_'+d.key);if(S.packs.length>40)S.packs=S.packs.slice().sort((a,b)=>b.created-a.created).slice(0,40);save();toast(d.topic,'','Revisão completa pronta');return p},
pick(k){const p=S.packs.find(x=>x.id==pkS.id),q=p.qs[pkS.i];if(pkS.sel[pkS.i]!=null)return;pkS.sel[pkS.i]=k;buzz(k==q.answer?[15,30,15]:30);Snd.ui(k==q.answer?'ok':'bad');render(1)},
async grade(){const p=S.packs.find(x=>x.id==pkS.id),q=p.qs[pkS.i],a=(pkS.draft||'').trim();if(a.length<3)return toast('Escreva sua resposta primeiro.','','Aviso');pkS.busy=1;render(1);
try{const r=await api('POST','/pack/grade',{q:q.q,model:q.model,answer:a,topic:p.topic});pkS.ans[pkS.i]=a;pkS.fb[pkS.i]={score:cl(+r.score||0,0,10),feedback:r.feedback||''}}catch(e){toast(e.message,'','Não consegui corrigir')}pkS.busy=0;render(1)},
skip(){pkS.fb[pkS.i]={score:0,feedback:'Você pulou esta questão.',skip:1};pkS.ans[pkS.i]='';Pk.next()},
next(){const p=S.packs.find(x=>x.id==pkS.id);pkS.i++;pkS.draft='';if(pkS.i>=p.qs.length)Pk.finish(p);render(1);scrollTo(0,0)},
finish(p){const mc=p.qs.map((q,i)=>[q,i]).filter(x=>x[0].type=='mc'),ok=mc.filter(([q,i])=>pkS.sel[i]==q.answer).length,op=p.qs.map((q,i)=>[q,i]).filter(x=>x[0].type!='mc'),os=op.reduce((t,[q,i])=>t+((pkS.fb[i]&&pkS.fb[i].score)||0)/10,0),pct=(ok+os)/p.qs.length*100,xpg=30+Math.round(pct/5);
pkS.last={pct,ok,mc:mc.length,open:op.length,os,xp:xpg};if(!p.result||pct>p.result.pct){const gain=xpg-((p.result&&p.result.xp)||0);p.result={pct,ok,mc:mc.length,open:op.length,at:Date.now(),xp:xpg};save();toast('Revisão concluída: '+Math.round(pct)+'%',gain,'Boa!')}},
again(){pkS={...pkS,i:0,tab:'q',ans:{},sel:{},fb:{},draft:'',busy:0,last:null};render(1);scrollTo(0,0)},
schedule(d){const p=S.packs.find(x=>x.id==pkS.id);S.reviews.push({id:uid(),topic:p.topic,subject:p.subject,due:add(0,d),done:false});save();toast('Nova revisão marcada para '+dm(add(0,d)),'','Agendado')},
doneRv(){const p=S.packs.find(x=>x.id==pkS.id),r=S.reviews.find(x=>x.id==p.rid);if(r&&!r.done){r.done=true;save()}render(1)}};
async function prepPacks(){if(!TK()||pkS.gen||gate())return;
const need=[...S.reviews.filter(r=>!r.done&&dd(r.due)<=1&&dd(r.due)>=-2).map(r=>({rid:r.id,kind:'review',topic:r.topic,subject:r.subject,due:r.due})),...S.exams.filter(e=>dd(e.date)<=1&&dd(e.date)>=0).map(e=>({rid:e.id,kind:'exam',topic:e.topics||'Conteúdo geral da prova',subject:e.subject,due:e.date}))].filter(x=>!pkFor(x.rid,x.due)&&!(pkS.fail[x.rid+x.due]>Date.now()-18e5));
for(const x of need.slice(0,2)){pkS.gen=1;try{const r=await api('POST','/pack',{rid:x.rid,due:x.due,kind:x.kind,topic:x.topic,subject:sj(x.subject).name,sid:x.subject});Pk.add(r.pack)}catch(e){pkS.fail[x.rid+x.due]=Date.now()}pkS.gen=0}}
const pkQ=p=>{const n=p.qs.length,i=pkS.i;if(i>=n)return pkEnd(p);const q=p.qs[i],nx=i+1<n?'Próxima':'Ver resultado',
bar=`<div class="bar" style="margin:4px 0 8px"><i style="width:${i/n*100}%"></i></div><small class="mu" style="display:block;margin-bottom:8px">Questão ${i+1} de ${n} · ${q.type=='mc'?'múltipla escolha':'pergunta aberta'}</small>`;
if(q.type=='mc'){const s=pkS.sel[i];return bar+`<div class="card"><div class="qt">${md(q.q)}</div>${q.options.map((o,k)=>`<button class="opt ${s==null?'':k==q.answer?'ok':k==s?'bad':'dim'}" ${s==null?'':'disabled'} onclick="Pk.pick(${k})"><b>${'ABCD'[k]}</b><span>${esc(o)}</span></button>`).join('')}${s==null?'':`<div class="note">${I(s==q.answer?'check':'bulb',18)}<span><b>${s==q.answer?'Correto!':'A resposta é '+'ABCD'[q.answer]+'.'}</b><br>${md(q.explain||'')}</span></div><button class="p" style="margin-top:12px" onclick="Pk.next()">${nx}</button>`}</div>`}
const f=pkS.fb[i];return bar+`<div class="card"><div class="qt">${md(q.q)}</div>${f?`${pkS.ans[i]?`<div class="ans">${esc(pkS.ans[i])}</div>`:''}<div class="note">${I(f.score>=6?'check':'bulb',18)}<span><b>Nota ${vir(f.score)} de 10</b><br>${md(f.feedback)}</span></div><details open><summary>Resposta esperada</summary><div class="pkmd">${md(q.model||'')}</div></details><button class="p" style="margin-top:12px" onclick="Pk.next()">${nx}</button>`:`<textarea id="oa" rows="5" placeholder="Escreva sua resposta…" aria-label="Sua resposta" oninput="pkS.draft=this.value">${esc(pkS.draft)}</textarea><button class="p" style="margin-top:10px" ${pkS.busy?'disabled':''} onclick="Pk.grade()">${pkS.busy?spin(18):I('send',18)} Corrigir com a IA</button><button class="g" onclick="Pk.skip()">Pular esta</button>`}</div>`},
pkEnd=p=>{const r=pkS.last||p.result||{pct:0,ok:0,mc:0,open:0},rv=S.reviews.find(x=>x.id==p.rid),d=r.pct<50?1:r.pct<75?3:7;
return `<div class="card c"><div class="big xl">${Math.round(r.pct)}%</div><p class="hint" style="margin:6px 0 2px">${r.ok} de ${r.mc} na múltipla escolha${r.open?' · abertas: '+vir(r.os||0)+' de '+r.open:''}</p><b>${r.pct>=85?'Mandou muito bem!':r.pct>=60?'Está no caminho.':'Vale revisar de novo.'}</b><br><small>${r.xp?'+'+r.xp+' XP · ':''}Sugestão: revisar de novo em ${d==1?'1 dia':d+' dias'}.</small></div>
<button class="p" onclick="Pk.schedule(${d})">${I('repeat',18)} Agendar nova revisão</button>${rv&&!rv.done?`<button class="g" onclick="Pk.doneRv()">${I('check',18)} Marcar revisão como feita</button>`:''}<button class="g" onclick="Pk.again()">${I('repeat',18)} Refazer questões</button><button class="g" onclick="go('more','rev')">Voltar às revisões</button>`};
P.pack=()=>{const p=S.packs.find(x=>x.id==pkS.id);if(!p)return `${topbar('Revisão',"go('more','rev')")}<div class="card empty">Revisão não encontrada.</div>`;
const n=p.qs.length,done=pkS.i>=n;
return `${topbar('Revisão completa',"go('more','rev')")}<div class="card row">${sq(ic(sj(p.subject).name,20),sj(p.subject).color)}<div class="grow"><b>${esc(p.topic)}</b><br><small>${esc(sj(p.subject).name)} · ${p.kind=='exam'?'prova':'revisão'} de ${dm(p.due)}</small></div></div>
<div class="tabs">${[['res','Resumo'],['q','Questões ('+n+')']].map(([k,l])=>`<button class="${pkS.tab==k?'on':''}" onclick="pkS.tab='${k}';render(1)">${l}</button>`).join('')}</div>
${pkS.tab=='res'?`<div class="card pkmd">${md(p.summary)}</div><div class="card"><h2>Pontos-chave</h2><ul class="pts">${p.points.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><button class="p" onclick="pkS.tab='q';render(1)">${I('play',18)} ${p.result?'Fazer de novo':'Começar as questões'}</button>`:pkQ(p)}`};

// ---------- tutor ----------
// O Gemini às vezes manda fórmulas em LaTeX ($\Delta$, \frac{a}{b}...). Aqui viram símbolos normais (Δ, a/b, √, x²).
const GR={Delta:'Δ',delta:'δ',alpha:'α',beta:'β',gamma:'γ',Gamma:'Γ',theta:'θ',Theta:'Θ',lambda:'λ',mu:'μ',pi:'π',sigma:'σ',Sigma:'Σ',omega:'ω',Omega:'Ω',phi:'φ',epsilon:'ε',rho:'ρ',tau:'τ',eta:'η',kappa:'κ',nu:'ν',xi:'ξ',psi:'ψ',chi:'χ',zeta:'ζ'},
SYM={pm:'±',mp:'∓',times:'×',cdot:'·',div:'÷',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',ne:'≠',approx:'≈',infty:'∞',rightarrow:'→',to:'→',Rightarrow:'⇒',leftarrow:'←',degree:'°',sum:'∑',int:'∫',in:'∈',cup:'∪',cap:'∩',ldots:'…',dots:'…',cdots:'⋯',therefore:'∴',angle:'∠',perp:'⊥',parallel:'∥',equiv:'≡',sim:'∼',left:'',right:'',quad:' ',qquad:'  ',displaystyle:''},
SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ','(':'⁽',')':'⁾'},SUB={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'},
supT=a=>[...a].every(c=>SUP[c])?[...a].map(c=>SUP[c]).join(''):'^('+a+')',subT=a=>[...a].every(c=>SUB[c])?[...a].map(c=>SUB[c]).join(''):'_'+a,
wrapT=a=>/^[\w.,]+$/.test(a.trim())?a.trim():'('+a.trim()+')';
function tex(m){let x=m.trim();
x=x.replace(/\\(?:text|textbf|textit|mathrm|mathbf|operatorname)\{([^{}]*)\}/g,'$1');
for(let i=0;i<3;i++)x=x.replace(/\\sqrt\{([^{}]*)\}/g,'√($1)');
x=x.replace(/\\sqrt\s*([\w.])/g,'√$1');
for(let i=0;i<3;i++)x=x.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g,(_,a,b)=>wrapT(a)+'/'+wrapT(b));
x=x.replace(/\\([a-zA-Z]+)/g,(_,n)=>GR[n]!==undefined?GR[n]:SYM[n]!==undefined?SYM[n]:n).replace(/\\[,;!: ]/g,' ');
x=x.replace(/\^\{([^{}]*)\}/g,(_,a)=>supT(a)).replace(/\^([0-9n+-])/g,(_,a)=>supT(a)).replace(/_\{([^{}]*)\}/g,(_,a)=>subT(a)).replace(/_([0-9])/g,(_,a)=>SUB[a]);
return x.replace(/[{}]/g,'').replace(/ {2,}/g,' ')}
const clean=t=>String(t).replace(/\$\$([\s\S]+?)\$\$/g,(_,m)=>'\n'+tex(m)+'\n').replace(/\\\[([\s\S]+?)\\\]/g,(_,m)=>'\n'+tex(m)+'\n').replace(/\\\(([\s\S]+?)\\\)/g,(_,m)=>tex(m)).replace(/(R?)\$(?!\s)([^$\n]+?)\$/g,(a,r,m)=>r||/\s$/.test(m)?a:tex(m));
const DOTS=[...Array(8)].map((_,k)=>`<i style="--k:${k}"></i>`).join(''),spin=(z=22)=>`<span class="dots" role="status" aria-label="Carregando" style="--sz:${z}px">${DOTS}</span>`,
md=t=>esc(clean(t)).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/^#{1,3} (.+)$/gm,'<b>$1</b>').replace(/^[*-] /gm,'• ').replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g,'$1<i>$2</i>').replace(/^-{2,}$/gm,'———'),
wait=ms=>new Promise(r=>setTimeout(r,ms));
// Resposta em tempo real: o texto aparece enquanto o tutor escreve, sem esperar a resposta inteira.
async function streamOnce(q,body){const u=base();if(u===null)throw new Error('O servidor da nuvem não está configurado (API_URL).');
let r;try{r=await fetch(u+'/api/tutor/stream',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TK()},body:JSON.stringify(body),signal:AbortSignal.timeout?AbortSignal.timeout(90000):undefined})}catch(e){throw new Error('Não consegui falar com o servidor. Confira a internet: no plano grátis do Render ele demora até 1 minuto para acordar.')}
if(r.status==404)return null;
if(!r.ok||!(r.headers.get('content-type')||'').includes('event-stream')){const j=await r.json().catch(()=>null);throw Object.assign(new Error((j&&j.error)||'O servidor respondeu algo inesperado (código '+r.status+').'),{status:r.status,data:j||{}})}
const rd=r.body.getReader(),dec=new TextDecoder();let buf='',txt='',m=null,fail=null;
try{for(;;){const{done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
while((i=buf.indexOf('\n\n'))>=0){const ev=buf.slice(0,i);buf=buf.slice(i+2);
for(const ln of ev.split('\n')){if(!ln.startsWith('data:'))continue;let j;try{j=JSON.parse(ln.slice(5))}catch(e){continue}
if(j.err)fail=j.err;
if(j.t){txt+=j.t;if(!m){m={u:0,t:'',stream:1,fresh:1};chat.push(m);streaming=1;draw(1)}m.t=txt;const el=$('#sm');if(el){el.innerHTML=md(txt.replace(/\[\[[\s\S]*$/,''));if(innerHeight+scrollY>document.documentElement.scrollHeight-240)scrollTo(0,document.documentElement.scrollHeight)}}}}}}
catch(e){if(!m)throw e;fail='A resposta foi cortada.'}
if(m){delete m.stream;streaming=0}
if(fail&&!m)throw new Error(fail);
if(fail&&m)m.t+='\n\n(A resposta foi cortada. Pergunte de novo se precisar.)';
return{streamed:1,text:txt}}
// Chama o servidor. Se ele estiver acordando (Render grátis), tenta de novo sozinho algumas vezes.
async function callTutor(q){const body={message:q,history:chat.slice(0,-1).filter(m=>m.t).slice(-8).map(m=>({u:m.u,t:m.t})),appContext:aiCtx()};
for(let i=0;;i++){try{const r=await streamOnce(q,body);return r||await api('POST','/tutor',body)}catch(e){const tmp=!e.status||(!(e.data&&e.data.error)&&[502,503,504].includes(e.status));if(!tmp||i>=3)throw e;tmsg='O servidor está acordando, só um instante…';const t=$('#tkt');if(t)t.textContent=tmsg;await wait([2500,5000,9000][i])}}}
// Redesenha só a tela do tutor, sem perder o que a pessoa já digitou
function draw(sc){if(page!='more'||sub!='tutor'){chat.forEach(m=>delete m.fresh);return}const i=$('#ti'),v=i?i.value:'',f=i&&document.activeElement===i;render(1);const n=$('#ti');if(n){n.value=v;if(f)n.focus({preventScroll:true})}chat.forEach(m=>delete m.fresh);if(sc)setTimeout(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'}),30)}
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),subjectId=n=>{const q=norm(n);if(!q)return undefined;return(S.subjects.find(s=>norm(s.name)==q)||S.subjects.find(s=>norm(s.name).includes(q)||q.includes(norm(s.name))))?.id};
// telas que a IA pode abrir
const NAV={sons:['more','snd'],som:['more','snd'],musica:['more','snd'],relaxar:['more','snd'],ajustesavisos:['more','nset'],inicio:['home'],home:['home'],principal:['home'],materias:['subjects'],materia:['subjects'],subjects:['subjects'],notas:['subjects'],boletim:['subjects'],tarefas:['tasks'],tarefa:['tasks'],tasks:['tasks'],estudos:['study'],estudo:['study'],historico:['study'],study:['study'],timer:['timer'],foco:['timer'],cronometro:['timer'],pomodoro:['timer'],mais:['more'],menu:['more'],more:['more'],perfil:['profile'],profile:['profile'],notificacoes:['notifs'],notificacao:['notifs'],avisos:['notifs'],sininho:['notifs'],notifs:['notifs'],revisoes:['more','rev'],revisao:['more','rev'],rev:['more','rev'],progresso:['more','prog'],conquistas:['more','prog'],recompensas:['more','prog'],nivel:['more','prog'],prog:['more','prog'],tutor:['more','tutor'],ia:['more','tutor'],chat:['more','tutor'],personalizacao:['more','pers'],configuracoes:['more','pers'],ajustes:['more','pers'],aparencia:['more','pers'],tema:['more','pers'],cores:['more','pers'],pers:['more','pers'],conta:['more','acct'],nuvem:['more','acct'],login:['more','acct'],acct:['more','acct'],novidades:['news'],atualizacoes:['news'],news:['news']};
// tudo o que a IA enxerga do app (ela precisa disso para lançar notas, achar tarefas, ver o timer etc.)
function aiCtx(){const t=today(),a=S.active,sn=id=>sj(id).name,ex=S.exams.filter(e=>e.date>=t).sort((x,y)=>x.date>y.date?1:-1);
return{hoje:t,diaDaSemana:new Date().toLocaleDateString('pt-BR',{weekday:'long'}),nome:name(),nivel:lvl(),xp:xp(),sequenciaDias:streak(),minutosHoje:Math.round(dur(s=>day(s.startedAt)==t)/60),metaDiariaMin:S.goal||60,mediaDesejada:S.target||8,
materiasQueJaExistem:S.subjects.map(s=>s.name),materias:S.subjects.map(s=>({nome:s.name,media:avg(s.id)==null?null:+fl(avg(s.id)).toFixed(1)})),
tarefasPendentes:S.tasks.filter(x=>!x.done).slice(0,40).map(x=>({titulo:x.title,materia:sn(x.subject),para:x.due,min:x.min,prioridade:x.pr})),tarefasFeitasRecentes:S.tasks.filter(x=>x.done).slice(-6).map(x=>x.title),
notas:S.grades.slice(-60).map(g=>({materia:sn(g.subject),nome:g.name,valor:g.v})),provas:ex.slice(0,15).map(e=>({materia:sn(e.subject),data:e.date,conteudo:e.topics||''})),
revisoesPendentes:S.reviews.filter(r=>!r.done).sort(byDue).slice(0,30).map(r=>({conteudo:r.topic,materia:sn(r.subject),para:r.due})),
revisoesCompletasProntas:(S.packs||[]).slice(-8).map(p=>({conteudo:p.topic,feita:!!p.result})),
foco:a?{materia:sn(a.subject),assunto:a.topic,planejadoMin:Math.round(a.planned/60),restante:fmt(a.planned-elapsed(a)),rodando:!!running(a)}:null,
aparencia:{modo:SET().mode||'dark',animacoes:SET().anim||'normal',fundo:PE().bg}}}
const okd=d=>/^\d{4}-\d\d-\d\d$/.test(d||''),vnum=v=>{const n=+String(v).replace(',','.');return Number.isFinite(n)&&String(v).trim()!==''?n:NaN},
fnd=(arr,key,q)=>{const n=norm(q);if(!n)return null;return arr.find(x=>norm(x[key])==n)||arr.find(x=>norm(x[key]).includes(n))||arr.find(x=>n.includes(norm(x[key])))},
gfind=(a,sid)=>S.grades.filter(x=>!sid||x.subject==sid).reverse().find(x=>!a.name||norm(x.name).includes(norm(a.name))||norm(a.name).includes(norm(x.name)));
// executa UMA ação pedida pela IA. Devolve [deu certo?, mensagem que aparece no chat]
function aiExec(a){const T=a.type,sid=subjectId(a.subject),due=okd(a.due)?a.due:today(),L=x=>String(x==null?'':x).slice(0,120).trim(),sn=id=>sj(id).name,miss=()=>[0,a.subject?'Não achei a matéria "'+L(a.subject)+'".':'Faltou dizer a matéria.'],PRS=['Alta','Média','Baixa'];
switch(T){
case'add_subject':{const n=L(a.name);if(!n)return[0,'Faltou o nome da matéria.'];if(S.subjects.some(s=>norm(s.name)==norm(n)))return[2,'Já existia: '+S.subjects.find(x=>norm(x.name)==norm(n)).name];S.subjects.push({id:uid(),name:n,color:PAL[S.subjects.length%PAL.length]});return[1,'Matéria criada: '+n]}
case'rename_subject':{const s=S.subjects.find(x=>x.id==sid);if(!s)return miss();const n=L(a.new_name);if(!n)return[0,'Faltou o novo nome.'];const o=s.name;s.name=n;return[1,o+' agora é '+n]}
case'remove_subject':{const s=S.subjects.find(x=>x.id==sid);if(!s)return miss();if(S.active&&S.active.subject==s.id)return[0,'Pare o foco desta matéria antes de excluir.'];S.subjects=S.subjects.filter(x=>x.id!=s.id);['tasks','grades','exams','reviews','sessions','packs'].forEach(k=>S[k]=S[k].filter(x=>x.subject!=s.id));return[1,'Matéria excluída: '+s.name]}
case'add_task':{if(!sid)return miss();const title=L(a.title);if(!title)return[0,'Faltou o título da tarefa.'];if(S.tasks.some(x=>!x.done&&x.subject==sid&&norm(x.title)==norm(title)))return[2,'Já existia a tarefa: '+title];S.tasks.push({id:uid(),title,subject:sid,due,min:cl(Math.round(+a.min||30),5,720),pr:PRS.includes(a.pr)?a.pr:'Média',done:false});return[1,'Tarefa criada: '+title+' ('+dl(due).toLowerCase()+')']}
case'edit_task':{const t=fnd(S.tasks,'title',a.title);if(!t)return[0,'Não achei a tarefa "'+L(a.title)+'".'];if(L(a.new_title))t.title=L(a.new_title);if(okd(a.due))t.due=a.due;if(+a.min>0)t.min=cl(Math.round(+a.min),5,720);if(PRS.includes(a.pr))t.pr=a.pr;if(a.subject&&sid)t.subject=sid;return[1,'Tarefa atualizada: '+t.title]}
case'complete_task':{const t=fnd(S.tasks.filter(x=>!x.done),'title',a.title);if(!t)return[0,'Não achei essa tarefa pendente.'];t.done=true;return[1,'Tarefa concluída: '+t.title]}
case'uncomplete_task':{const t=fnd(S.tasks.filter(x=>x.done),'title',a.title);if(!t)return[0,'Não achei essa tarefa concluída.'];t.done=false;return[1,'Tarefa reaberta: '+t.title]}
case'remove_task':{const t=fnd(S.tasks,'title',a.title);if(!t)return[0,'Não achei a tarefa "'+L(a.title)+'".'];S.tasks=S.tasks.filter(x=>x.id!=t.id);return[1,'Tarefa excluída: '+t.title]}
case'add_review':{if(!sid)return miss();const topic=L(a.topic);if(!topic)return[0,'Faltou o conteúdo da revisão.'];if(S.reviews.some(x=>!x.done&&x.subject==sid&&norm(x.topic)==norm(topic)))return[2,'Já existia a revisão: '+topic];S.reviews.push({id:uid(),topic,subject:sid,due,done:false});return[1,'Revisão marcada: '+topic+' ('+dl(due).toLowerCase()+')']}
case'complete_review':{const r=fnd(S.reviews.filter(x=>!x.done),'topic',a.topic);if(!r)return[0,'Não achei essa revisão pendente.'];r.done=true;return[1,'Revisão concluída: '+r.topic]}
case'remove_review':{const r=fnd(S.reviews,'topic',a.topic);if(!r)return[0,'Não achei essa revisão.'];S.reviews=S.reviews.filter(x=>x.id!=r.id);return[1,'Revisão removida: '+r.topic]}
case'add_exam':{if(!sid)return miss();if(!okd(a.due))return[0,'Faltou a data da prova.'];if(S.exams.some(x=>x.subject==sid&&x.date==a.due))return[2,'Já existia a prova de '+sn(sid)+' em '+dm(a.due)];S.exams.push({id:uid(),subject:sid,date:a.due,topics:L(a.topics)});return[1,'Prova marcada: '+sn(sid)+' em '+dm(a.due)]}
case'remove_exam':{const e=S.exams.filter(x=>x.subject==sid&&(!okd(a.due)||x.date==a.due)).sort((x,y)=>x.date>y.date?1:-1)[0];if(!e)return[0,'Não achei essa prova.'];S.exams=S.exams.filter(x=>x.id!=e.id);return[1,'Prova removida: '+sn(e.subject)+' de '+dm(e.date)]}
case'add_grade':{if(!sid)return miss();const v=vnum(a.value);if(!(v>=0&&v<=10))return[0,'A nota precisa ser um número de 0 a 10.'];const g={id:uid(),subject:sid,name:L(a.name)||'Prova',v};S.grades.push(g);gradeNotify(g);return[1,'Nota lançada: '+sn(sid)+' · '+g.name+' · '+f1(v)+' (média '+f1(avg(sid))+')']}
case'edit_grade':{const g=gfind(a,sid);if(!g)return[0,'Não achei essa nota.'];const v=a.value==null?g.v:vnum(a.value);if(!(v>=0&&v<=10))return[0,'Nota inválida.'];g.v=v;if(L(a.new_name))g.name=L(a.new_name);return[1,'Nota atualizada: '+g.name+' = '+f1(v)]}
case'remove_grade':{const g=gfind(a,sid);if(!g)return[0,'Não achei essa nota.'];S.grades=S.grades.filter(x=>x.id!=g.id);return[1,'Nota apagada: '+g.name+' ('+sn(g.subject)+')']}
case'set_goal':{const m=Math.round(+a.minutes);if(!(m>=5&&m<=720))return[0,'A meta precisa ser de 5 a 720 minutos.'];S.goal=m;return[1,'Meta diária: '+m+' min']}
case'set_target':{const v=vnum(a.value);if(!(v>=1&&v<=10))return[0,'Média desejada inválida.'];S.target=v;return[1,'Média desejada: '+f1(v)]}
case'start_focus':{if(S.active)return[0,'Já existe um foco em andamento ('+sn(S.active.subject)+'). Quer parar ele antes?'];if(!sid)return miss();const mn=Math.round(+a.minutes);if(!(mn>=1))return[0,'Faltou dizer quantos minutos.'];const m2=cl(mn,1,720);S.active={id:uid(),dev:DEV,subject:sid,topic:L(a.topic)||'Estudo livre',planned:m2*60,startedAt:Date.now(),segs:[[Date.now(),null]],seen:Date.now()};return[1,'Foco iniciado: '+sn(sid)+' por '+m2+' min']}
case'pause_focus':{const x=S.active;if(!x)return[0,'Não há foco em andamento.'];if(!running(x))return[1,'O foco já estava pausado.'];x.segs.at(-1)[1]=Date.now();return[1,'Foco pausado (restam '+fmt(x.planned-elapsed(x))+')']}
case'resume_focus':{const x=S.active;if(!x)return[0,'Não há foco em andamento.'];if(running(x))return[1,'O foco já está rodando.'];x.segs.push([Date.now(),null]);return[1,'Foco retomado']}
case'stop_focus':{const x=S.active;if(!x)return[0,'Não há foco em andamento.'];if(running(x))x.segs.at(-1)[1]=Date.now();S.active=null;const sec=Math.round(elapsed(x));
if(String(a.save)=='false'||sec<5)return[1,'Foco cancelado (não salvei o tempo).'];S.sessions.push({id:x.id||uid(),subject:x.subject,topic:x.topic,startedAt:x.startedAt,endedAt:x.segs.at(-1)[1],duration:sec,status:'completed'});return[1,'Foco encerrado e salvo: '+hm(sec)+' de '+sn(x.subject)]}
case'navigate':{const k=norm(a.page).replace(/^(a|o|as|os|minha|minhas|meu|meus|tela|pagina)\s+/,'').replace(/^(de|da|do|dos|das)\s+/,''),sid2=sid||subjectId(a.page);let m=NAV[k]||NAV[norm(a.page)];if(!m&&sid2)m=['subjects'];if(!m)return[0,'Não conheço a tela "'+L(a.page)+'". Posso abrir: início, matérias, tarefas, estudos, timer, revisões, progresso, tutor, personalização, conta, notificações ou novidades.'];if(m[0]=='subjects'&&sid2)m=['subjects',sid2];pendNav=m;return[1,'Abrindo '+(m[0]=='subjects'&&m[1]?sn(m[1]):L(a.page))]}
case'set_style':{const o={};let note='';if(['dark','light','auto'].includes(a.mode))o.mode=a.mode;if(['off','soft','normal','full'].includes(a.anim))o.anim=a.anim;
if(a.bg){const k=norm(a.bg),f=BGS.find(b=>b[0]==k)||REW.bgs.map(b=>[b[1],b[2]]).find(b=>b[0]==k||norm(b[1])==k);if(f){const lk=lockedBg(f[0]);if(lk)note='O fundo '+f[0]+' abre no nível '+lk+'.';else o.bg=f[0]}}
if(a.accent){const f=ACCS.find(c=>norm(c[0])==norm(a.accent))||REW.colors.map(c=>[c[1],c[2]]).find(c=>norm(c[0])==norm(a.accent)),hex=f?f[1]:/^#[0-9a-f]{6}$/i.test(a.accent)?a.accent:null;if(hex){const lk=lockedColor(hex);if(lk)note=(note?note+' ':'')+'Essa cor abre no nível '+lk+'.';else o.acc=hex.toLowerCase()=='#3d8bff'?null:hex}}
if(!Object.keys(o).length)return[0,note||'Não entendi o que mudar no visual.'];S.set={...SET(),...o};paintTheme();return[1,'Visual atualizado'+(note?'. '+note:'')]}
case'set_name':{const n=L(a.name);if(!n)return[0,'Faltou o nome.'];S.user.name=n.slice(0,40);return[1,'Agora te chamo de '+S.user.name]}
case'make_pack':{if(!sid)return miss();const topic=L(a.topic);if(!topic)return[0,'Faltou o conteúdo da revisão completa.'];Pk.make({rid:'ai'+uid(),kind:'topic',topic,subject:sid,due:today()},false);return[1,'Preparando a revisão completa de '+topic+'. Aviso quando estiver pronta (leva ~1 min).']}
case'open_pack':{const p=fnd(S.packs,'topic',a.topic);if(!p)return[0,'Não achei essa revisão completa.'];pendOpen=p.id;return[1,'Abrindo a revisão: '+p.topic]}
}return[0,'Ação desconhecida: '+L(T)]}
function runActions(text){const re=/\[\[ACTION:(\{[\s\S]*?\})\]\]/g,list=[];let m;while((m=re.exec(text)))list.push(m[1]);if(!list.length)return null;
const snap=JSON.stringify(S),acts=[];pendNav=null;pendOpen=null;
list.slice(0,10).forEach(j=>{let a;try{a=JSON.parse(j)}catch(e){acts.push({ok:0,msg:'Não entendi um dos comandos da IA.'});return}try{const[r,msg]=aiExec(a);acts.push({ok:r,msg})}catch(e){acts.push({ok:0,msg:'Erro: '+e.message})}});
if(acts.some(x=>x.ok==1)){bump('ai');buzz([18,35,35])}if(acts.length)save();return{acts,snap}}
const parseOpts=t=>{const m=String(t||'').match(/\[\[OPTIONS:([^\]]*)\]\]/);return m?m[1].split('|').map(s=>s.trim()).filter(Boolean).slice(0,6):null},
cleanAction=t=>String(t||'').replace(/\s*\[\[ACTION:\{[\s\S]*?\}\]\]/g,'').replace(/\s*\[\[OPTIONS:[^\]]*\]\]/g,'').trim();
async function send(q,retry){if(busy||!q)return;if(!retry)chat.push({u:1,t:q,fresh:1});tErr=null;chat.forEach(m=>delete m.opts);
if(!TK()){tErr={q,msg:'Entre na sua conta (Mais, Conta e nuvem) para usar o tutor.',nr:1};return draw(1)}
busy=1;tmsg='Pensando…';draw(1);
try{const r=await callTutor(q),text=r.streamed?r.text:(r.reply||'Não consegui responder agora.'),ex=runActions(text),opts=parseOpts(text),clean=cleanAction(text);bump('chat');
let m=r.streamed?[...chat].reverse().find(x=>!x.u):null;if(m)m.t=clean;else{m={u:0,t:clean,fresh:1};chat.push(m)}
if(ex){m.acts=ex.acts;m.undo=ex.snap}if(opts)m.opts=opts;if(!m.t&&!m.acts)m.t='Pronto!';save()}catch(e){tErr={q,msg:e.message}}
streaming=0;busy=0;draw(1);
if(pendNav){const n=pendNav;pendNav=null;setTimeout(()=>go(n[0],n[1]||''),700)}if(pendOpen){const id=pendOpen;pendOpen=null;setTimeout(()=>Pk.open(id),700)}}
// "busy" trava o envio: apertar Enter várias vezes não duplica a pergunta
function ask(){const i=$('#ti'),t=i.value.trim();if(!t||busy)return;i.value='';send(t)}
function undoAI(i){const m=chat[i];if(!m||!m.undo)return;S=JSON.parse(m.undo);fix();delete m.undo;m.acts=[{ok:1,msg:'Desfeito. Tudo voltou como estava.'}];save();paintTheme();draw()}
const msgHtml=(m,i,la)=>`<div ${m.stream?'id="sm"':''} class="msg ${m.u?'u':''} ${m.fresh?'new':''} ${m.stream?'stream':''}">${m.u?esc(m.t):md(m.stream?String(m.t).replace(/\[\[[\s\S]*$/,''):m.t)}${m.acts?`<div class="aiacts">${m.acts.map(a=>`<div class="aiact ${a.ok==2?'inf':a.ok?'ok':'bad'}">${I(a.ok==2?'info':a.ok?'check':'x',15)}<span>${esc(a.msg)}</span></div>`).join('')}${m.undo&&i==la?`<button class="undo" onclick="undoAI(${i})">${I('undo',15)} Desfazer</button>`:''}</div>`:''}</div>`,
tutorView=()=>{const la=chat.reduce((r,m,i)=>m.undo?i:r,-1),last=chat[chat.length-1],opts=last&&!last.u&&last.opts&&!busy?last.opts:null;
return `${topbar('Tutor com IA',"go('more')")}<div class="msg ai-welcome">Olá, ${esc(name())}! Eu controlo o app inteiro: lanço notas, marco provas, crio tarefas, inicio e paro o foco, preparo revisões e até mudo o visual. Se faltar alguma informação, eu pergunto.<br><small>Ex.: “tirei 8,5 na prova de matemática”</small></div>${chat.map((m,i)=>msgHtml(m,i,la)).join('')}${busy&&!streaming?`<div class="msg think new">${spin(24)}<span id="tkt" class="shim">${tmsg}</span></div>`:''}${tErr?`<div class="msg err new"><b>Não consegui responder.</b><br><small>${esc(tErr.msg)}</small>${tErr.nr?'':`<button class="p" style="margin-top:10px" onclick="send(tErr.q,1)">${I('repeat',18)} Tentar de novo</button>`}</div>`:''}${opts?`<div class="opts">${opts.map(o=>`<button class="qb on" data-o="${esc(o)}" onclick="send(this.dataset.o)">${esc(o)}</button>`).join('')}</div>`:''}<div class="ai-tools">${[['book','Explicar conteúdo','Explicar conteúdo: '],['tasks','Adicionar tarefa','Adicionar tarefa: '],['repeat','Criar revisão','Criar revisão: '],['bulb','Revisão completa','Preparar revisão completa de '],['target','Lançar nota','Lançar nota: '],['play','Começar foco','Começar foco: '],['pause','Parar foco','']].map(([i,b,p])=>`<button class="qb" onclick="${p?`$('#ti').value='${p}';$('#ti').focus()`:`send('Parar o foco')`}">${I(i,18)} ${b}</button>`).join('')}</div><form class="row tbar" onsubmit="event.preventDefault();ask()"><input id="ti" placeholder="Peça algo ou tire uma dúvida…" aria-label="Mensagem para a IA" autocomplete="off"><button class="circ" aria-label="Enviar" ${busy?'disabled':''}>${busy?spin(20):I('send',18)}</button></form>`};

// ---------- navegação ----------
const go=(p,sb='')=>{page=p;sub=sb;icPick=0;if(sb=='tutor')wake();showRF=0;ttab='d3';rtab='pend';range='semana';fm={s:'',t:''};if(p!='timer')done=null;scrollTo(0,0);render(0)};
const mini=()=>{const a=S.active;if(!a||page=='timer'||gate())return'';const run=running(a);return`<div class="mt" role="button" tabindex="0" aria-label="Voltar ao cronômetro" onclick="go('timer')"><span class="sq" style="background:${sj(a.subject).color};color:#fff">${ic(sj(a.subject).name,20)}</span><div class="grow"><b>${esc(sj(a.subject).name)}</b><br><small>${run?'Tempo restante':'Pausado'}</small></div><b class="mtt" id="mt">${fmt(a.planned-elapsed(a))}</b><button class="mb" aria-label="${run?'Pausar':'Continuar'}" onclick="event.stopPropagation();pause()">${I(run?'pause':'play',18)}</button></div>`};
function render(keep){const A=$('#app'),nv=$('#nav');A.classList.toggle('enter',!keep);
if(gate()){nv.style.display='none';$('#mini').innerHTML='';document.body.classList.remove('hasmini');A.innerHTML=P.login();return}
nv.style.display='';const items=[['home','home','Início'],['subjects','book','Matérias'],['tasks','tasks','Tarefas'],['study','chart','Estudos'],['more','more','Mais']],cur=({timer:'study',pack:'more',news:'more'})[page]||page,ix=items.findIndex(x=>x[0]==cur);
// o menu é montado uma vez só: assim a bolinha azul desliza de um botão para o outro
if(!nv.querySelector('a'))nv.innerHTML='<i class="pill"></i>'+items.map(([k,i,l])=>`<a role="button" tabindex="0" aria-label="${l}" onclick="go('${k}')" onkeydown="if(event.key=='Enter'||event.key==' '){event.preventDefault();go('${k}')}"><span class="ni">${I(i,21)}</span><span>${l}</span></a>`).join('');
nv.style.setProperty('--n',Math.max(0,ix));nv.classList.toggle('none',ix<0);nv.querySelectorAll('a').forEach((a,k)=>a.classList.toggle('on',k==ix));
A.innerHTML=P[page]();const mn=$('#mini'),had=!!mn.innerHTML,m=mini();mn.innerHTML=m;mn.classList.toggle('in',!!m&&!had);document.body.classList.toggle('hasmini',!!m);if(!keep)cu()}

// ---------- nuvem (opcional): conta + sincronização ----------
const TK=()=>localStorage['studyflow.token'],setTK=(t,e)=>{t?(localStorage['studyflow.token']=t,localStorage['studyflow.email']=e):(localStorage.removeItem('studyflow.token'),localStorage.removeItem('studyflow.email'))};
// Endereço do servidor. No GitHub Pages não existe servidor, então só funciona com API_URL preenchido.
const base=()=>{const u=(API_URL||'').trim().replace(/\/+$/,''),pages=location.hostname.endsWith('github.io');if(!u||/(^|\/\/)[^/]*\.github\.io(\/|$)/i.test(u))return pages?null:'';return u};
async function api(m,p,b){const u=base();if(u===null)throw new Error('O servidor da nuvem não está configurado. No app.js, API_URL precisa ser o endereço do servidor no Render (termina em .onrender.com), e não o do GitHub Pages.');
let r;try{r=await fetch(u+'/api'+p,{method:m,headers:{'Content-Type':'application/json',...(TK()?{Authorization:'Bearer '+TK()}:{})},body:b?JSON.stringify(b):undefined,signal:AbortSignal.timeout?AbortSignal.timeout(p=='/tutor'?90000:60000):undefined})}catch(e){throw new Error('Não consegui falar com o servidor. Confira a internet e o endereço (API_URL). No plano grátis do Render o servidor demora até 1 minuto para acordar: tente de novo.')}
const j=await r.json().catch(()=>null);if(!r.ok||!j)throw Object.assign(new Error((j&&j.error)||'O servidor respondeu algo inesperado (código '+r.status+'). Confira se o endereço em API_URL é o do servidor.'),{status:r.status,data:j||{}});return j}
// push(): depois de qualquer mudança, sincroniza em ~1 segundo
function push(){dirty=1;saveVer++;if(!TK())return;clearTimeout(pt);pt=setTimeout(()=>sync(),1200)}
// Sincronização: baixa o que mudou na nuvem, MESCLA com o que está aqui (item por item, sem perder nada de nenhum lado) e envia o resultado.
async function sync(force){if(!TK())return;if(syncing){syncAgain=1;return}syncing=1;
try{const r=await api('GET','/state'+(force||!remoteTs?'':'?since='+remoteTs));
if(!r.same&&r.data){const M=merge(S,r.data);if(stable(strip(M))!==stable(strip(S)))adoptMerged(M)}
const need=dirty||(!r.same&&(!r.data||stable(strip(S))!==stable(strip(r.data))));
if(need){const ver=saveVer;S.updatedAt=Math.max(Date.now(),(r.updatedAt||remoteTs||0)+1);persist();await api('PUT','/state',{data:strip(S),updatedAt:S.updatedAt});remoteTs=S.updatedAt;if(saveVer===ver)dirty=0}else if(r.updatedAt)remoteTs=r.updatedAt;
lastSync=Date.now();await pullPacks()}
catch(e){if(e.status==401){setTK();render(1)}else if(e.status==409){remoteTs=0;syncAgain=1}}
syncing=0;if(syncAgain){syncAgain=0;setTimeout(()=>sync(),400)}}
function adoptMerged(M){const a=S.active,had=new Set((S.notifs||[]).map(x=>x.id));S=M;setTimeout(()=>{const nn=(S.notifs||[]).filter(x=>!x.read&&!had.has(x.id)).sort((x,y)=>y.ts-x.ts)[0];if(nn&&!document.hidden&&had.size)toast(nn.title,'','Nova notificação')},400);fix();if(S.active&&a&&S.active.id==a.id){S.active.seen=a.seen;S.active.recover=a.recover}snapshot();persist();paintTheme();softRender()}
// redesenha por causa de uma mudança vinda de outro aparelho, sem atrapalhar quem está digitando
function softRender(){if(busy||streaming)return;const e=document.activeElement;if(e&&e.matches&&e.matches('input,textarea,select')){pendRender=1;return}render(1)}
document.addEventListener('focusout',()=>{if(pendRender){pendRender=0;setTimeout(()=>{const e=document.activeElement;if(!(e&&e.matches&&e.matches('input,textarea,select')))render(1)},60)}});
// revisões completas que o servidor preparou sozinho (mesmo com o app fechado)
async function pullPacks(){try{const since=+(localStorage['sf.pks']||0),r=await api('GET','/packs?since='+since);let mx=since;(r.packs||[]).forEach(d=>{mx=Math.max(mx,d.created||0);const id='pk_'+d.key;if(S.packs.some(p=>p.id==id)||(S.del&&S.del[id])||!S.subjects.some(s=>s.id==d.sid))return;Pk.add(d)});localStorage['sf.pks']=mx}catch(e){}}
// entrar: junta os dados deste aparelho com os da conta (se for outra conta ou só a demonstração, começa limpo)
const isDemo=()=>!!S.demo||(!S.owner&&S.subjects.length==8&&S.tasks.some(t=>t.title=='Revisar matemática'));
async function afterLogin(r,g){setTK(r.token,r.email);if((S.owner&&S.owner!==r.email)||isDemo()){S=empty()}S.owner=r.email;delete S.demo;fix();snapshot();persist();remoteTs=0;await sync(true);
if(g){if(!S.user.photo&&g.photo){S.user.photo=g.photo;S.user.ps='g'}if((!S.user.name||S.user.name=='Dudu')&&g.name)S.user.name=g.name}
try{localStorage.removeItem('sf.skip')}catch(e){}save();paintTheme();pushCheck();go('home');toast('Conta conectada','','Tudo certo')}
async function googleReply(res){try{closeModal();const r=await api('POST','/google',{credential:res.credential});await afterLogin(r,{name:r.name,photo:r.photo})}catch(e){toast(e.message,'','Não consegui entrar')}}
let gInit=0;
function googleModal(){if($('#gbtn'))return;modal('Entrar com Google','<div id="gbtn" class="c" style="min-height:48px;display:flex;justify-content:center"></div>','<button class="g" onclick="closeModal()">Cancelar</button>');google.accounts.id.renderButton($('#gbtn'),{theme:'filled_black',size:'large',shape:'pill',text:'continue_with',width:260})}
function googleLogin(){if(!GOOGLE_CLIENT_ID||GOOGLE_CLIENT_ID.startsWith('COLE_'))return modal('Falta configurar o Google','<p class="hint">Antes de usar este botão, cole o Client ID do Google em <b>app.js</b> e configure a mesma chave no servidor.</p>','<button class="p" onclick="closeModal()">Entendi</button>');
if(!(window.google&&google.accounts&&google.accounts.id))return toast('O Google ainda está carregando. Tente novamente.','','Aviso');
if(!gInit){google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:googleReply,auto_select:false,cancel_on_tap_outside:true});gInit=1}
// se o Google não mostrar o pop-up (acontece depois de fechar algumas vezes), abre uma janela com o botão oficial
google.accounts.id.prompt(n=>{try{if((n.isNotDisplayed&&n.isNotDisplayed())||(n.isSkippedMoment&&n.isSkippedMoment()))googleModal()}catch(e){googleModal()}})}
async function authDo(kind){if(ab)return;ab=1;const m=$('#am');m.style.color='var(--mu)';m.innerHTML=spin(16)+' Conectando ao servidor... na primeira vez pode levar até 1 minuto.';
try{const r=await api('POST','/'+kind,{email:$('#ae').value,password:$('#ap').value,name:S.user.name});await afterLogin(r)}catch(e){m.style.color='var(--bad)';m.textContent=e.message}ab=0}
// sair: envia o que faltar, apaga os dados deste aparelho (ficam salvos na nuvem) e volta para a tela de entrada
async function logout(){if(!await askYes('Sair da conta?','Os dados deste aparelho serão apagados. Eles continuam salvos na nuvem e voltam quando você entrar de novo.','Sair',1))return;
try{if(dirty)await sync()}catch(e){}try{await pushOff()}catch(e){}setTK();try{localStorage.removeItem('sf.skip');localStorage.removeItem('sf.pks')}catch(e){}
S=empty();fix();snapshot();persist();paintTheme();remoteTs=0;dirty=0;go('home')}
// continuar sem conta: nunca herda os dados de uma conta anterior
const gate=()=>!TK()&&!localStorage['sf.skip'],skipLogin=()=>{try{localStorage['sf.skip']=1}catch(e){}
if(S.owner||isDemo()){try{if(S.owner)localStorage['studyflow.backup']=JSON.stringify(S)}catch(e){}S=empty();fix();snapshot();persist();paintTheme()}go('home')};
const wake=()=>{if(TK()&&base())fetch(base()+'/api/health').catch(()=>{})};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){wake();sync();checkAlerts();prepPacks()}});addEventListener('focus',()=>sync());addEventListener('online',()=>sync(1));
setInterval(()=>{if(!document.hidden)sync()},20000);setInterval(()=>{if(!document.hidden){checkAlerts();prepPacks()}},600000);setInterval(()=>{if(!document.hidden&&page=='more'&&sub=='tutor')wake()},240000);
// abrir pelo toque numa notificação push
const launchGo=g=>{const m=NAV[norm(g)];if(m&&!gate()){page=m[0];sub=m[1]||''}};
try{const g=new URLSearchParams(location.search).get('go');if(g){launchGo(g);history.replaceState(null,'',location.pathname)}}catch(e){}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.go){launchGo(e.data.go);render()}});
// se a aba foi fechada com o timer rodando NESTE aparelho, conta só até o último sinal de vida
if(S.active&&S.active.id==null)S.active.id=uid();
if(S.active&&running(S.active)&&(!S.active.dev||S.active.dev===DEV)){S.active.dev=DEV;S.active.segs.at(-1)[1]=S.active.seen;S.active.recover=true;save()}
render();updNotice();checkAlerts();sync(1);pushCheck();setTimeout(prepPacks,3000);if(checkAch())save();


// ---------- onda ao tocar nos botões ----------
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.p,.g,.tile,.qb,.sc,.menu,.mini,.tabs button,.chips button,.strip button');if(!b||b.disabled)return;const r=b.getBoundingClientRect(),z=Math.max(r.width,r.height)*2,w=document.createElement('span');w.className='rip';w.style.cssText=`width:${z}px;height:${z}px;left:${e.clientX-r.left-z/2}px;top:${e.clientY-r.top-z/2}px`;b.appendChild(w);setTimeout(()=>w.remove(),650)});

// ---------- números que sobem até o valor ----------
function cu(){document.querySelectorAll('[data-cu]').forEach(el=>{const n=+el.dataset.cu,f=el.dataset.f;if(!n)return;const fm=v=>f=='hm'?hm(v):Math.round(v),t0=performance.now();(function st(t){const k=Math.min(1,(t-t0)/900),e=1-Math.pow(1-k,3);el.textContent=fm(n*e);if(k<1)requestAnimationFrame(st)})(t0)})}

// ---------- confete ao concluir tarefa ----------
function bigBurst(){if(SET().anim=='off')return;const cols=isLegend()?['#FBBF24','#F59E0B','#FDE68A','#FFF7D6','#FCD34D','#D97706']:['#3D8BFF','#34D399','#F59E0B','#EC4899','#A78BFA','#FBBF24'],n=SET().anim=='soft'?24:60;for(let i=0;i<n;i++){const p=document.createElement('i'),a=Math.PI*2*i/n+Math.random()*.4,d=90+Math.random()*180;p.className='cf';p.style.cssText=`left:50%;top:38%;background:${cols[i%6]};--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-40}px;--rot:${Math.random()*720}deg`;document.body.appendChild(p);setTimeout(()=>p.remove(),900)}}
function burst(el){if(SET().anim=='off')return;const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,cols=['#3D8BFF','#34D399','#F59E0B','#EC4899','#A78BFA'];for(let i=0;i<14;i++){const p=document.createElement('i'),a=Math.PI*2*i/14+Math.random()*.4,d=34+Math.random()*34;p.className='cf';p.style.cssText=`left:${cx}px;top:${cy}px;background:${cols[i%5]};--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;--rot:${Math.random()*360}deg`;document.body.appendChild(p);setTimeout(()=>p.remove(),850)}}
document.addEventListener('change',e=>{if(e.target.matches&&e.target.matches('.t input[type=checkbox]')&&e.target.checked)burst(e.target)},true);

// ---------- som suave ao tocar ----------
document.addEventListener('pointerdown',e=>{const b=e.target.closest&&e.target.closest('.p,.g,.tile,.qb,.sc,.menu,.mini,.tabs button,.chips button,.strip button,#nav a,.circ,.opt,.rw,.sw2,.bgo,.snd');if(b&&!b.disabled)Snd.ui('tap')},true);
