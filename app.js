const K='studyflow.v1',$=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,9),
day=t=>new Date(t).toLocaleDateString('sv'),pad=n=>String(n).padStart(2,'0'),
fmt=s=>{s=Math.max(0,Math.round(s));return pad(s/60|0)+':'+pad(s%60)},
hm=s=>{const m=Math.round(s/60);return m>=60?(m/60|0)+'h'+pad(m%60)+'min':m+'min'},
esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
add=(d,n)=>day(Date.now()+n*864e5);
let S,page='home',sub='',tab='hoje',done=null,chat=[];
function demo(){const m=[['Matemática','#2f6bff'],['Português','#c24bd6'],['História','#f5a623'],['Geografia','#19b6c9'],['Biologia','#22c58b'],['Física','#ef4b5b'],['Química','#8b5cf6'],['Inglês','#ec7a3c']].map(([name,color])=>({id:uid(),name,color}));
const id=n=>m.find(x=>x.name==n).id,ses=[];[[0,'Matemática',1500],[0,'História',1200],[1,'Biologia',1800],[2,'Matemática',2400],[3,'Português',1500],[4,'Física',1200],[5,'Matemática',3000]].forEach(([d,n,s])=>{const t=Date.now()-d*864e5-36e5;ses.push({id:uid(),subject:id(n),topic:'Revisão',startedAt:t,endedAt:t+s*1e3,duration:s,status:'completed'})});
return{user:{name:'Dudu',year:'',school:''},subjects:m,tasks:[['Revisar matemática','Matemática',0,40,'Alta'],['Fazer trabalho de história','História',0,90,'Média'],['Estudar biologia','Biologia',0,30,'Média'],['Ler capítulo de português','Português',2,40,'Baixa']].map(([title,s,d,min,pr])=>({id:uid(),title,subject:id(s),due:add(0,d),min,pr,done:false})),
grades:[['Matemática','Prova 1',8.5,2],['Matemática','Trabalho',7.5,1],['Português','Prova 1',7.8,2],['História','Prova 1',9,2],['Biologia','Prova 1',8.2,2]].map(([s,name,v,w])=>({id:uid(),subject:id(s),name,v,w})),
exams:[{id:uid(),subject:id('Matemática'),date:add(0,8)}],sessions:ses,reviews:[['Revolução Industrial','História',0],['Equações do 2º grau','Matemática',1],['Célula eucarionte','Biologia',3]].map(([topic,s,d])=>({id:uid(),topic,subject:id(s),due:add(0,d),done:false})),active:null}}
const empty=()=>({user:{name:'Dudu',year:'',school:''},subjects:[],tasks:[],grades:[],exams:[],sessions:[],reviews:[],active:null});
try{S=JSON.parse(localStorage[K])}catch(e){}S=S||demo();
const save=()=>localStorage[K]=JSON.stringify(S),sj=id=>S.subjects.find(s=>s.id==id)||{name:'—',color:'#888'};
const opts=(sel)=>S.subjects.map(s=>`<option value="${s.id}" ${s.id==sel?'selected':''}>${esc(s.name)}</option>`).join('');
// ---- sessões: tempo real = soma dos segmentos [início, fim]
const elapsed=a=>a.segs.reduce((t,[s,e])=>t+((e??Date.now())-s),0)/1e3,running=a=>a&&a.segs.at(-1)[1]==null;
function startS(){const subject=$('#ss').value,topic=$('#st').value.trim()||'Estudo livre';let min=+$('#sd').value;if(min==0)min=+prompt('Minutos:','30')||25;if(!subject)return alert('Crie uma matéria primeiro.');
S.active={subject,topic,planned:min*60,startedAt:Date.now(),segs:[[Date.now(),null]],seen:Date.now()};save();render()}
function pause(){const a=S.active;if(running(a))a.segs.at(-1)[1]=Date.now();else a.segs.push([Date.now(),null]);save();render()}
function finish(cancel){const a=S.active;if(!a)return;if(running(a))a.segs.at(-1)[1]=Date.now();S.active=null;
if(cancel||elapsed(a)<5){save();return render()}
const r={id:uid(),subject:a.subject,topic:a.topic,startedAt:a.startedAt,endedAt:a.segs.at(-1)[1],duration:Math.round(elapsed(a)),status:'completed'};S.sessions.push(r);done=r;save();render()}
function rate(n){const d=[1,2,4,7,14][n-1];S.reviews.push({id:uid(),topic:done.topic,subject:done.subject,due:add(0,d),done:false});done=null;save();render()}
setInterval(()=>{const a=S.active;if(!a)return;if(running(a)){a.seen=Date.now();localStorage[K]=JSON.stringify(S);if(elapsed(a)>=a.planned)return finish()}const t=$('#tm');if(t)t.textContent=fmt(a.planned-elapsed(a))},1000);
// recuperação: se a aba foi fechada com sessão rodando, o tempo conta só até o último sinal de vida
if(S.active&&running(S.active)){S.active.segs.at(-1)[1]=S.active.seen;S.active.recover=true;save()}
// ---- métricas
const dur=(f)=>S.sessions.filter(f).reduce((t,s)=>t+s.duration,0),today=()=>day(Date.now());
function streak(){let n=0,i=0;const ds=new Set(S.sessions.map(s=>day(s.startedAt)));if(!ds.has(add(0,0)))i=-1;while(ds.has(add(0,i-n)))n++;return n}
function avg(id){const g=S.grades.filter(g=>g.subject==id),w=g.reduce((t,x)=>t+x.w,0);return w?g.reduce((t,x)=>t+x.v*x.w,0)/w:null}
const f1=v=>v==null?'—':v.toFixed(1).replace('.',',');
const week=()=>[...Array(7)].map((_,i)=>{const d=add(0,i-6);return[new Date(d+'T12:00').toLocaleDateString('pt-BR',{weekday:'short'}).slice(0,3),dur(s=>day(s.startedAt)==d)/60]});
const chart=()=>{const w=week(),m=Math.max(30,...w.map(x=>x[1]));return`<div class="chart">${w.map(([l,v])=>`<div><b style="height:${v/m*80}px"></b>${l}</div>`).join('')}</div>`};
// ---- tarefas
const T={toggle(id){const t=S.tasks.find(t=>t.id==id);t.done=!t.done;save();render()},del(id){S.tasks=S.tasks.filter(t=>t.id!=id);save();render()},edit(id){const t=S.tasks.find(t=>t.id==id),n=prompt('Editar tarefa:',t.title);if(n){t.title=n;save();render()}},
add(){const title=$('#tt').value.trim();if(!title)return;S.tasks.push({id:uid(),title,subject:$('#ts').value,due:$('#td').value||today(),min:+$('#tm2').value||30,pr:$('#tp').value,done:false});save();render()}};
const taskRow=t=>`<div class="card t ${t.done?'d':''}"><input type="checkbox" ${t.done?'checked':''} onchange="T.toggle('${t.id}')"><div class="grow" style="flex:1"><span>${esc(t.title)}</span><br><small>${esc(sj(t.subject).name)} · ${t.min}min · ${t.pr} · ${t.due.slice(8)}/${t.due.slice(5,7)}</small></div><button onclick="T.edit('${t.id}')">✎</button><button onclick="T.del('${t.id}')">🗑</button></div>`;
// ---- páginas
const P={
home(){const pend=S.tasks.filter(t=>!t.done),hj=pend.filter(t=>t.due<=today()),ex=S.exams.filter(e=>e.date>=today()).sort((a,b)=>a.date>b.date?1:-1)[0],rv=S.reviews.filter(r=>!r.done&&r.due<=today());
const dl=ex?Math.round((new Date(ex.date)-new Date(today()))/864e5):0;
return`<h1>Olá, ${esc(S.user.name)}!</h1><small>Seu futuro depende do que você faz hoje.</small>
<div class="card row" style="margin-top:12px">🔥<div><b>${streak()} dias</b> de sequência<br><small>Estude hoje para mantê-la</small></div></div>
<div class="grid"><div class="card"><div class="big">${hm(dur(s=>day(s.startedAt)==today()))}</div><small>hoje</small></div><div class="card"><div class="big">${pend.length}</div><small>tarefas pendentes</small></div><div class="card"><div class="big">${S.exams.filter(e=>e.date>=today()).length}</div><small>provas próximas</small></div></div>
<h2>Próxima prova</h2>${ex?`<div class="card"><b>${esc(sj(ex.subject).name)}</b><br><small>${ex.date.slice(8)}/${ex.date.slice(5,7)} · em ${dl} dias</small></div>`:'<div class="card mu">Nenhuma prova cadastrada.</div>'}
<form class="card row" onsubmit="event.preventDefault();addExam()"><select id="es">${opts()}</select><input id="ed" type="date" required><button class="p" style="width:auto">+ Prova</button></form>
<button class="p" onclick="go('study')">Começar a estudar</button>
<h2>Tarefas de hoje</h2>${hj.map(taskRow).join('')||'<div class="card mu">Nada para hoje 🎉</div>'}
<h2>Progresso da semana</h2><div class="card">${chart()}</div>
<h2>Revisões de hoje</h2>${rv.map(r=>`<div class="card">${esc(r.topic)} <small>· ${esc(sj(r.subject).name)}</small></div>`).join('')||'<div class="card mu">Sem revisões para hoje.</div>'}`},
subjects(){return`<h1>Matérias & notas</h1>${S.subjects.map(s=>{const a=avg(s.id),n=S.sessions.filter(x=>x.subject==s.id);return`<div class="card"><div class="row"><span style="width:12px;height:12px;border-radius:4px;background:${s.color}"></span><b class="grow">${esc(s.name)}</b><span class="big">${f1(a)}</span></div><small>${hm(n.reduce((t,x)=>t+x.duration,0))} estudados · ${n.length} sessões</small><div class="bar" style="margin-top:8px"><i style="width:${(a||0)*10}%;background:${s.color}"></i></div>${need(s.id)}</div>`}).join('')}
<form class="card row" onsubmit="event.preventDefault();addSub()"><input id="sn" placeholder="Nova matéria" required style="flex:1"><button class="p" style="width:auto">+</button></form>
<h2>Registrar nota</h2><form class="card f" onsubmit="event.preventDefault();addGrade()"><select id="gs">${opts()}</select><input id="gn" placeholder="Avaliação (ex: Prova 1)" required><div class="row"><input id="gv" type="number" step="0.1" min="0" max="10" placeholder="Nota" required><input id="gw" type="number" step="0.5" min="0.5" value="1" placeholder="Peso"></div><button class="p">Salvar nota</button></form>`},
tasks(){const p=S.tasks.filter(t=>!t.done),L={hoje:p.filter(t=>t.due==today()),proximas:p.filter(t=>t.due>today()),atrasadas:p.filter(t=>t.due<today()),concluidas:S.tasks.filter(t=>t.done)};
return`<h1>Tarefas</h1><form class="card f" onsubmit="event.preventDefault();T.add()"><input id="tt" placeholder="Nova tarefa" required><div class="row"><select id="ts">${opts()}</select><input id="td" type="date" value="${today()}"></div><div class="row"><input id="tm2" type="number" placeholder="Minutos" value="30"><select id="tp"><option>Alta</option><option selected>Média</option><option>Baixa</option></select></div><button class="p">Adicionar</button></form>
<div class="tabs">${Object.keys(L).map(k=>`<button class="${tab==k?'on':''}" onclick="tab='${k}';render()">${k} ${L[k].length}</button>`).join('')}</div>${L[tab]?.map(taskRow).join('')||'<div class="card mu">Vazio.</div>'}`},
study(){const a=S.active;
if(done)return`<div class="card c"><h1>Estudo concluído!</h1><p class="mu">${esc(sj(done.subject).name)} · ${esc(done.topic)}<br>${hm(done.duration)} estudados</p><h2>Como você se sente sobre esse conteúdo?</h2>${['Não entendi','Entendi pouco','Entendi razoavelmente','Entendi bem','Dominei'].map((t,i)=>`<button class="g" onclick="rate(${i+1})">${i+1} · ${t}</button>`).join('')}</div>`;
if(a)return`${a.recover?`<div class="card">Sessão interrompida (aba fechada). Contamos só até ${new Date(a.seen).toLocaleTimeString('pt-BR')}.<button class="p" style="margin-top:8px" onclick="S.active.recover=0;pause()">Recuperar e continuar</button><button class="g" onclick="finish()">Encerrar e salvar</button></div>`:''}<div class="card c"><b>${esc(sj(a.subject).name).toUpperCase()}</b><br><span class="mu">${esc(a.topic)}</span><div class="timer" id="tm">${fmt(a.planned-elapsed(a))}</div><small>${running(a)?'Tempo restante':'Pausado'}</small></div>${a.recover?'':`<button class="p" onclick="pause()">${running(a)?'Pausar':'Continuar'}</button><button class="g" onclick="finish()">Finalizar sessão</button><button class="g" onclick="finish(1)">Cancelar</button>`}`;
const t=today(),all=S.sessions;
return`<h1>Estudos</h1><div class="card f"><select id="ss">${opts()}</select><input id="st" placeholder="Conteúdo (ex: Equações do 2º grau)"><select id="sd"><option>15</option><option selected>25</option><option>45</option><option>60</option><option value="0">Personalizado</option></select><button class="p" onclick="startS()">Começar estudo</button></div>
<div class="grid"><div class="card"><div class="big">${hm(dur(s=>day(s.startedAt)==t))}</div><small>hoje</small></div><div class="card"><div class="big">${hm(dur(s=>s.startedAt>Date.now()-6048e5))}</div><small>7 dias</small></div><div class="card"><div class="big">${hm(dur(()=>1))}</div><small>total</small></div></div>
<h2>Últimos 7 dias</h2><div class="card">${chart()}</div><h2>Por matéria</h2>${S.subjects.map(s=>[s,dur(x=>x.subject==s.id)]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).map(([s,v])=>`<div class="card"><div class="row"><b class="grow">${esc(s.name)}</b>${hm(v)}</div><div class="bar"><i style="width:${v/dur(()=>1)*100}%;background:${s.color}"></i></div></div>`).join('')}
<div class="card"><small>${all.length} sessões · média ${all.length?hm(dur(()=>1)/all.length):'—'} · sequência ${streak()} dias</small></div>`},
more(){const rv=S.reviews.filter(r=>!r.done).sort((a,b)=>a.due>b.due?1:-1);
if(sub=='tutor')return`<h1>Tutor</h1><div id="ch">${[{u:0,t:'Oi, Dudu! O que você quer aprender hoje?'},...chat].map(m=>`<div class="msg ${m.u?'u':''}">${esc(m.t)}</div>`).join('')}</div><div class="row" style="flex-wrap:wrap;margin:10px 0">${['Explicar conteúdo','Criar exercícios','Fazer resumo','Revisar assunto','Simulado'].map(b=>`<button onclick="$('#ti').value='${b}: '">${b}</button>`).join('')}</div><form class="row" onsubmit="event.preventDefault();ask()"><input id="ti" style="flex:1" placeholder="Digite sua dúvida..."><button class="p" style="width:auto">➤</button></form><button class="g" onclick="sub='';render()">← Voltar</button>`;
return`<h1>Mais</h1><h2>Revisões</h2>${rv.map(r=>`<div class="card row"><div class="grow">${esc(r.topic)}<br><small>${r.due<=today()?'Hoje':r.due.slice(8)+'/'+r.due.slice(5,7)} · ${esc(sj(r.subject).name)}</small></div><button onclick="S.reviews.find(x=>x.id=='${r.id}').done=true;save();render()">✓</button></div>`).join('')||'<div class="card mu">Termine uma sessão para criar revisões.</div>'}
<button class="g" onclick="sub='tutor';render()">🤖 Abrir Tutor</button>
<h2>Perfil</h2><div class="card f"><input value="${esc(S.user.name)}" onchange="S.user.name=this.value;save()"><small>${hm(dur(()=>1))} estudados · ${S.sessions.length} sessões · sequência ${streak()} dias</small></div>
<h2>Dados</h2><button class="g" onclick="if(confirm('Apagar tudo e começar do zero?')){S=empty();save();render()}">Apagar dados de demonstração</button><button class="g" onclick="if(confirm('Restaurar demonstração?')){S=demo();save();render()}">Restaurar demonstração</button>`}};
function need(id){const g=S.grades.filter(g=>g.subject==id);if(!g.length)return'';const W=g.reduce((t,x)=>t+x.w,0),sum=g.reduce((t,x)=>t+x.v*x.w,0),n=(8*(W+1)-sum);return`<small class="mu">Para fechar com 8,0, tire ~${f1(Math.max(0,n))} na próxima avaliação (peso 1).</small>`}
const addSub=()=>{S.subjects.push({id:uid(),name:$('#sn').value,color:'#2f6bff'});save();render()},addGrade=()=>{S.grades.push({id:uid(),subject:$('#gs').value,name:$('#gn').value,v:+$('#gv').value,w:+$('#gw').value||1});save();render()},addExam=()=>{S.exams.push({id:uid(),subject:$('#es').value,date:$('#ed').value});save();render()};
// IA: ponto de conexão futuro (API não configurada)
async function askAI(msg){return null}
async function ask(){const t=$('#ti').value.trim();if(!t)return;chat.push({u:1,t});const r=await askAI(t);chat.push({u:0,t:r||'IA ainda não configurada. Conecte uma API na função askAI() em app.js.'});render()}
const go=p=>{page=p;sub='';render()};
function render(){const items=[['home','⌂','Início'],['subjects','▤','Matérias'],['tasks','☑','Tarefas'],['study','⏱','Estudos'],['more','⋯','Mais']];
$('#nav').innerHTML=items.map(([k,i,l])=>`<a class="${page==k?'on':''}" onclick="go('${k}')"><b>${i}</b>${l}</a>`).join('');$('#app').innerHTML=P[page]();}
render();
