const STORAGE_KEY = "dimensuti_mobile_v30";
let deferredPrompt = null;

const state = {
  config: {
    hospital:"", setor:"", data:new Date().toISOString().slice(0,10),
    turno:"Diurno", enfermeiro:"", coren:"", qtdLeitos:10,
    tipoLeito:"numerico", identificadores:""
  },
  leitos:[],
  profissionais:[
    {nome:"Enfermeiro",tipo:"Enfermeiro",ativo:true},
    {nome:"Técnico 1",tipo:"Técnico",ativo:true},
    {nome:"Técnico 2",tipo:"Técnico",ativo:true},
    {nome:"Técnico 3",tipo:"Técnico",ativo:true},
    {nome:"Técnico 4",tipo:"Técnico",ativo:true},
    {nome:"Técnico 5",tipo:"Técnico",ativo:true}
  ],
  dimensionamento:null,
  plantao:{acontecimentos:"",passagem:""},
  historico:[],
  rodizio:{ultimoPreDimensionamento:null, proximo:null},
  ui:{dark:false}
};

const GRAVIDADES={0:"Mínima",1:"Baixa",2:"Moderada",3:"Alta",4:"Muito alta",5:"Crítico"};
const RESPIRACOES=["AA","AA/CN","AA/Máscara","TOT VM","TQT VM","TQT Tenda","TQT AA"];
const DISPOSITIVOS=["AVP","SVD","CVC","CDL","PAI","GTT","SNE","SNG"];
const PRECAUCOES=["Padrão","Vigilância","Contato","Aerossóis","Gotículas"];

function gerarIdentificadores(config){
  const qtd=Math.max(1,Math.min(30,Number(config.qtdLeitos)||10));
  if(config.tipoLeito==="alfabetico") return Array.from({length:qtd},(_,i)=>String.fromCharCode(65+i));
  if(config.tipoLeito==="personalizado"){
    const lista=(config.identificadores||"").split(",").map(x=>x.trim()).filter(Boolean);
    if(lista.length)return lista.slice(0,qtd);
  }
  return Array.from({length:qtd},(_,i)=>String(i+1));
}
function criarLeito(id){return {id,diagnostico:"",gravidade:2,respiracao:"AA",dispositivos:[],precaucoes:["Padrão"],pendenciasExames:"",acontecimentos:"",condutas:"",passagem:""};}
function normalizarLeitos(){
  const ids=gerarIdentificadores(state.config);
  const antigos=Object.fromEntries(state.leitos.map(l=>[String(l.id),l]));
  state.leitos=ids.map(id=>antigos[String(id)]?{...criarLeito(id),...antigos[String(id)],id}:criarLeito(id));
}
function carregarDados(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem("dimensuti_mobile_v2"));
    if(saved){
      state.config={...state.config,...saved.config};
      state.leitos=saved.leitos||[];
      state.profissionais=saved.profissionais||state.profissionais;
      state.plantao={...state.plantao,...saved.plantao};
      state.dimensionamento=saved.dimensionamento||null;
      state.historico=saved.historico||[];
      state.rodizio={...state.rodizio,...(saved.rodizio||{})};
      state.ui={...state.ui,...(saved.ui||{})};
      // Migração dos nomes antigos
      state.profissionais.forEach(p=>{
        if(p.tipo==="Assistencial")p.tipo="Técnico";
        if(!p.tipo)p.tipo="Técnico";
      });
    }
  }catch(e){console.warn(e);}
  normalizarLeitos();
}
function salvarDados(mensagem=true){
  lerConfiguracoesDaTela();
  const a=document.getElementById("plantao-acontecimentos"),p=document.getElementById("plantao-passagem");
  if(a)state.plantao.acontecimentos=a.value;
  if(p)state.plantao.passagem=p.value;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  if(mensagem)toast("Dados salvos neste dispositivo.");
  atualizarDashboard();
}
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function showTab(id){
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.getElementById("tab-"+id)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.tab===id));
  if(id==="leitos")renderizarLeitos();
  if(id==="dimensionamento"){renderizarProfissionais();renderizarResultadoDimensionamento();}
  if(id==="plantao")renderizarPreviaPlantao();
  if(id==="config")preencherConfiguracoes();
  if(id==="historico")renderizarHistorico();
  if(id==="inicio")atualizarDashboard();
  window.scrollTo({top:0,behavior:"smooth"});
}
function preencherConfiguracoes(){
  const c=state.config;
  ["hospital","setor","data","turno","enfermeiro","coren","qtdLeitos","tipoLeito","identificadores"].forEach(k=>{
    const el=document.getElementById("cfg-"+k);if(el)el.value=c[k]??"";
  });alternarPersonalizado();
}
function lerConfiguracoesDaTela(){
  const g=id=>document.getElementById(id);if(!g("cfg-hospital"))return;
  state.config={
    hospital:g("cfg-hospital").value.trim(),setor:g("cfg-setor").value.trim(),data:g("cfg-data").value,
    turno:g("cfg-turno").value,enfermeiro:g("cfg-enfermeiro").value.trim(),coren:g("cfg-coren").value.trim(),
    qtdLeitos:Number(g("cfg-qtd-leitos").value)||10,tipoLeito:g("cfg-tipo-leito").value,identificadores:g("cfg-identificadores").value.trim()
  };
}
function alternarPersonalizado(){document.getElementById("identificadores-personalizados")?.classList.toggle("hidden",document.getElementById("cfg-tipo-leito")?.value!=="personalizado");}
function aplicarConfiguracaoLeitos(){lerConfiguracoesDaTela();normalizarLeitos();state.dimensionamento=null;salvarDados(false);renderizarLeitos();atualizarDashboard();toast("Configuração dos leitos aplicada.");}

function gravidadeClasse(g){if(g>=5)return"critical";if(g>=4)return"high";if(g>=2)return"moderate";return"low";}
function calcularIndiceOperacional(l){
  const base=Number(l.gravidade)||0;
  const resp={"AA":0,"AA/CN":1,"AA/Máscara":1,"TQT AA":1,"TQT Tenda":2,"TOT VM":3,"TQT VM":3}[l.respiracao]??0;
  const dispositivos=Math.min((l.dispositivos||[]).length,4)*0.5;
  const prec=(l.precaucoes||[]).filter(x=>x!=="Padrão").length*0.5;
  return Math.round((base+resp+dispositivos+prec)*10)/10;
}
function nivelIndice(v){if(v>=7)return"Alta complexidade";if(v>=4)return"Complexidade intermediária";return"Menor carga registrada";}
function renderizarLeitos(){
  const filtro=document.getElementById("filtro-gravidade")?.value??"";
  const busca=(document.getElementById("busca-leito")?.value||"").trim().toLowerCase();
  const lista=state.leitos.filter(l=>(filtro===""||String(l.gravidade)===filtro)&&(!busca||String(l.id).toLowerCase().includes(busca)));
  const el=document.getElementById("lista-leitos");
  el.innerHTML=lista.map(l=>{
    const pend=[l.pendenciasExames,l.condutas,l.passagem].filter(x=>x?.trim()).length;
    const indice=calcularIndiceOperacional(l);
    return `<article class="bed-card ${gravidadeClasse(l.gravidade)}">
      <div class="bed-head"><h3>🛏️ LEITO ${escapeHtml(l.id)}</h3><span class="badge ${gravidadeClasse(l.gravidade)}">${GRAVIDADES[l.gravidade]}</span></div>
      <div class="bed-meta">
        <span class="meta-pill">🫁 ${escapeHtml(l.respiracao||"Não informado")}</span>
        <span class="meta-pill">💉 ${l.dispositivos.length} dispositivo(s)</span>
        <span class="meta-pill">⚠️ ${pend} pendência(s)</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(indice/10*100,100)}%"></div></div>
      <div class="severity-score">Índice operacional: <strong>${indice}</strong> • ${nivelIndice(indice)}</div>
      <button class="secondary-btn" onclick="abrirLeito('${encodeURIComponent(String(l.id))}')">📝 Avaliar / Editar</button>
    </article>`;
  }).join("")||`<div class="card"><p class="muted">Nenhum leito encontrado.</p></div>`;
}
function abrirLeito(encodedId){
  const id=decodeURIComponent(encodedId),l=state.leitos.find(x=>String(x.id)===String(id));if(!l)return;
  const radios=RESPIRACOES.map(r=>`<label class="choice radio-choice"><input type="radio" name="respiracao" value="${r}" ${l.respiracao===r?"checked":""}>${r}</label>`).join("");
  const checks=(items,selected,name)=>items.map(x=>`<label class="choice"><input type="checkbox" name="${name}" value="${x}" ${(selected||[]).includes(x)?"checked":""}>${x}</label>`).join("");
  document.getElementById("detalhe-leito").innerHTML=`
    <div class="detail-title"><div class="hero-icon">🛏️</div><div><p class="eyebrow">AVALIAÇÃO CLÍNICA OPERACIONAL</p><h2>LEITO ${escapeHtml(l.id)}</h2></div></div>
    <div class="alert-box">🔒 Não utilize nomes, documentos ou outros identificadores pessoais do paciente.</div>
    <div class="card form-card">
      <label>Gravidade</label><select id="det-gravidade">${Object.entries(GRAVIDADES).map(([v,n])=>`<option value="${v}" ${Number(v)===Number(l.gravidade)?"selected":""}>${v} - ${n}</option>`).join("")}</select>
      <label>Diagnóstico / descrição clínica</label><textarea id="det-diagnostico" rows="3" placeholder="Descrição sem identificação nominal...">${escapeHtml(l.diagnostico||"")}</textarea>
      <div class="subhead">🫁 Respiração</div><div class="option-grid">${radios}</div>
      <div class="subhead">💉 Dispositivos em uso</div><div class="option-grid">${checks(DISPOSITIVOS,l.dispositivos,"dispositivo")}</div>
      <div class="subhead">🦠 Precaução</div><div class="option-grid">${checks(PRECAUCOES,l.precaucoes,"precaucao")}</div>
      <div class="subhead">📋 Pendências e passagem de plantão</div>
      <label>Pendências de exames</label><textarea id="det-exames" rows="3">${escapeHtml(l.pendenciasExames||"")}</textarea>
      <label>Acontecimentos do plantão</label><textarea id="det-acontecimentos" rows="3">${escapeHtml(l.acontecimentos||"")}</textarea>
      <label>Condutas / pendências</label><textarea id="det-condutas" rows="3">${escapeHtml(l.condutas||"")}</textarea>
      <label>Informações para o próximo plantão</label><textarea id="det-passagem" rows="4">${escapeHtml(l.passagem||"")}</textarea>
      <button class="primary-btn full" onclick="salvarLeito('${encodeURIComponent(String(l.id))}')">💾 Salvar avaliação do leito</button>
    </div>`;
  showTab("leito-detalhe");
}
function salvarLeito(encodedId){
  const id=decodeURIComponent(encodedId),l=state.leitos.find(x=>String(x.id)===String(id));if(!l)return;
  const checked=name=>Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(i=>i.value);
  l.gravidade=Number(document.getElementById("det-gravidade").value);
  l.diagnostico=document.getElementById("det-diagnostico").value.trim();
  l.respiracao=document.querySelector('input[name="respiracao"]:checked')?.value||"AA";
  l.dispositivos=checked("dispositivo");l.precaucoes=checked("precaucao");
  l.pendenciasExames=document.getElementById("det-exames").value.trim();
  l.acontecimentos=document.getElementById("det-acontecimentos").value.trim();
  l.condutas=document.getElementById("det-condutas").value.trim();
  l.passagem=document.getElementById("det-passagem").value.trim();
  state.dimensionamento=null;salvarDados(false);toast(`Leito ${id} salvo com sucesso.`);showTab("leitos");
}

function renderizarProfissionais(){
  const el=document.getElementById("lista-profissionais");
  el.innerHTML=state.profissionais.map((p,i)=>`<div class="staff-row">
    <input value="${escapeHtml(p.nome)}" onchange="state.profissionais[${i}].nome=this.value" placeholder="Identificação profissional">
    <select onchange="state.profissionais[${i}].tipo=this.value">
      ${["Enfermeiro","Técnico","Apoio"].map(t=>`<option ${p.tipo===t?"selected":""}>${t}</option>`).join("")}
    </select>
    <button class="small-btn" onclick="removerProfissional(${i})">✕</button></div>`).join("");
}
function adicionarProfissional(){state.profissionais.push({nome:"",tipo:"Técnico",ativo:true});renderizarProfissionais();}
function removerProfissional(i){state.profissionais.splice(i,1);renderizarProfissionais();}


function tecnicosAtuais(){
  return state.profissionais.filter(p=>p.nome?.trim()&&p.tipo==="Técnico").map(p=>p.nome.trim());
}
function proximoIdLeito(id, passos=1){
  const ids=state.leitos.map(l=>String(l.id));
  const i=ids.indexOf(String(id));
  if(i<0||!ids.length)return String(id);
  return ids[(i+passos)%ids.length];
}
function obterUltimoGrupoPorTecnico(){
  const ultimo=state.rodizio?.ultimoPreDimensionamento || state.dimensionamento;
  const mapa={};
  (ultimo?.grupos||[]).forEach(g=>{if(g.tipo==="Técnico")mapa[g.profissional]=(g.leitos||[]).map(x=>String(x.id));});
  return mapa;
}
function equipeCompativelComRodizio(){
  const mapa=obterUltimoGrupoPorTecnico(), atuais=tecnicosAtuais();
  const anteriores=Object.keys(mapa);
  return atuais.length>0&&atuais.length===anteriores.length&&atuais.every(n=>anteriores.includes(n));
}
function preDimensionarProximoPlantao(){
  const el=document.getElementById("resultado-rodizio");
  const atuais=tecnicosAtuais();
  if(!atuais.length){toast("Cadastre os técnicos disponíveis antes de pré-dimensionar.");return;}
  const mapaAnterior=obterUltimoGrupoPorTecnico();
  let grupos=[], modo="";
  if(Object.keys(mapaAnterior).length&&equipeCompativelComRodizio()){
    grupos=atuais.map(nome=>({
      profissional:nome,tipo:"Técnico",
      leitos:(mapaAnterior[nome]||[]).map(id=>({id:proximoIdLeito(id,1),peso:calcularIndiceOperacional(state.leitos.find(l=>String(l.id)===proximoIdLeito(id,1))||{})}))
    }));
    grupos.forEach(g=>g.carga=Math.round(g.leitos.reduce((s,x)=>s+(Number(x.peso)||0),0)*10)/10);
    modo="Rodízio automático aplicado: cada técnico avançou seus leitos para as posições subsequentes.";
  }else{
    const leitos=[...state.leitos].sort((a,b)=>calcularIndiceOperacional(b)-calcularIndiceOperacional(a));
    grupos=atuais.map(nome=>({profissional:nome,tipo:"Técnico",leitos:[],carga:0}));
    leitos.forEach(l=>{grupos.sort((a,b)=>a.carga-b.carga);const g=grupos[0],peso=calcularIndiceOperacional(l);g.leitos.push({id:l.id,peso});g.carga+=peso;});
    grupos.forEach(g=>g.carga=Math.round(g.carga*10)/10);
    modo=Object.keys(mapaAnterior).length?"Equipe alterada (desfalque/remanejamento): redistribuição inteligente por carga operacional.":"Sem escala anterior compatível: distribuição inicial por carga operacional.";
  }
  state.rodizio.proximo={geradoEm:new Date().toLocaleString("pt-BR"),modo,grupos};
  salvarDados(false);
  if(el){
    el.classList.remove("hidden");
    el.innerHTML=`<div class="alert-box">🔄 ${escapeHtml(modo)}</div>`+
      grupos.map(g=>`<div class="rotation-card"><h4>👤 ${escapeHtml(g.profissional)}</h4><div class="beds-line">🛏️ ${g.leitos.map(x=>escapeHtml(x.id)).join(" • ")||"Sem leitos"}</div><small>Índice operacional estimado: ${g.carga}</small></div>`).join("")+
      `<button class="primary-btn full" onclick="aplicarPreDimensionamento()">✅ Aplicar como dimensionamento atual</button>`;
  }
}
function aplicarPreDimensionamento(){
  if(!state.rodizio?.proximo){toast("Gere primeiro o pré-dimensionamento.");return;}
  state.dimensionamento={geradoEm:new Date().toLocaleString("pt-BR"),grupos:state.rodizio.proximo.grupos,enfermeiros:state.profissionais.filter(p=>p.nome?.trim()&&p.tipo==="Enfermeiro").map(p=>p.nome)};
  state.rodizio.ultimoPreDimensionamento=JSON.parse(JSON.stringify(state.dimensionamento));
  salvarDados(false);renderizarResultadoDimensionamento();toast("Pré-dimensionamento aplicado.");
}
function encerrarPlantaoEPrepararProximo(){
  salvarPlantaoHistorico();
  if(!state.dimensionamento){gerarDimensionamento();}
  if(state.dimensionamento)state.rodizio.ultimoPreDimensionamento=JSON.parse(JSON.stringify(state.dimensionamento));
  state.rodizio.proximo=null;
  salvarDados(false);
  preDimensionarProximoPlantao();
  showTab("dimensionamento");
  toast("Plantão salvo e próximo plantão preparado.");
}

function gerarDimensionamento(){
  document.querySelectorAll("#lista-profissionais input").forEach((input,i)=>{if(state.profissionais[i])state.profissionais[i].nome=input.value.trim();});
  const assistenciais=state.profissionais.filter(p=>p.nome.trim()&&(p.tipo==="Técnico"||p.tipo==="Enfermeiro"));
  const tecnicos=state.profissionais.filter(p=>p.nome.trim()&&p.tipo==="Técnico");
  if(!assistenciais.length){toast("Adicione pelo menos um profissional assistencial.");return;}
  const distribuiveis=tecnicos.length?tecnicos:assistenciais;
  const leitos=[...state.leitos].sort((a,b)=>calcularIndiceOperacional(b)-calcularIndiceOperacional(a));
  const grupos=distribuiveis.map(p=>({profissional:p.nome,tipo:p.tipo,leitos:[],carga:0}));
  leitos.forEach(l=>{
    grupos.sort((a,b)=>a.carga-b.carga);
    const g=grupos[0],peso=calcularIndiceOperacional(l);
    g.leitos.push({id:l.id,peso});g.carga+=peso;
  });
  state.dimensionamento={geradoEm:new Date().toLocaleString("pt-BR"),grupos:grupos.map(g=>({...g,carga:Math.round(g.carga*10)/10})),enfermeiros:state.profissionais.filter(p=>p.nome.trim()&&p.tipo==="Enfermeiro").map(p=>p.nome)};
  state.rodizio.ultimoPreDimensionamento=JSON.parse(JSON.stringify(state.dimensionamento));
  state.rodizio.proximo=null;
  salvarDados(false);renderizarResultadoDimensionamento();toast("Dimensionamento gerado.");
}
function renderizarResultadoDimensionamento(){
  const el=document.getElementById("resultado-dimensionamento");
  if(!state.dimensionamento){el.classList.add("hidden");return;}
  const grupos=state.dimensionamento.grupos||[];
  const cargas=grupos.map(g=>g.carga);
  const total=cargas.reduce((a,b)=>a+b,0),max=Math.max(...cargas,0),min=Math.min(...cargas,0);
  el.classList.remove("hidden");
  el.innerHTML=`<div class="card"><div class="section-head"><div><h3>📊 Distribuição sugerida</h3><p class="muted">Gerado em ${escapeHtml(state.dimensionamento.geradoEm||"")}</p></div></div>
    <div class="assignment-summary"><div><strong>${grupos.length}</strong><small>Profissionais</small></div><div><strong>${total.toFixed(1)}</strong><small>Carga total</small></div><div><strong>${(max-min).toFixed(1)}</strong><small>Diferença de carga</small></div></div>
    ${state.dimensionamento.enfermeiros?.length?`<div class="alert-box">👩‍⚕️ Enfermeiro(s) registrado(s): ${state.dimensionamento.enfermeiros.map(escapeHtml).join(", ")}</div>`:""}
    ${grupos.map(g=>`<div class="assignment-card"><h4>👤 ${escapeHtml(g.profissional)}</h4><p>🛏️ Leitos: <strong>${g.leitos.map(x=>escapeHtml(x.id)).join(", ")||"Sem leitos"}</strong></p><span class="workload-score">Índice operacional: ${g.carga}</span></div>`).join("")}
    <p class="muted">⚠️ Esta distribuição é apenas uma sugestão operacional. Revise conforme protocolos institucionais, competências profissionais, legislação aplicável e condições reais da unidade.</p>
  </div>`;
}

function renderizarPreviaPlantao(){
  const a=document.getElementById("plantao-acontecimentos"),p=document.getElementById("plantao-passagem");
  if(a)a.value=state.plantao.acontecimentos||"";if(p)p.value=state.plantao.passagem||"";
  const el=document.getElementById("previa-plantao");
  const itens=state.leitos.filter(l=>[l.pendenciasExames,l.acontecimentos,l.condutas,l.passagem].some(x=>x?.trim()));
  el.innerHTML=itens.length?itens.map(l=>`<div class="handover-item"><h4>🛏️ LEITO ${escapeHtml(l.id)} — ${GRAVIDADES[l.gravidade]}</h4>
  ${l.pendenciasExames?`<p><strong>Exames:</strong> ${escapeHtml(l.pendenciasExames)}</p>`:""}
  ${l.acontecimentos?`<p><strong>Acontecimentos:</strong> ${escapeHtml(l.acontecimentos)}</p>`:""}
  ${l.condutas?`<p><strong>Pendências:</strong> ${escapeHtml(l.condutas)}</p>`:""}
  ${l.passagem?`<p><strong>Próximo turno:</strong> ${escapeHtml(l.passagem)}</p>`:""}</div>`).join(""):`<p class="muted">Nenhuma pendência registrada nos leitos.</p>`;
}
function salvarPlantaoHistorico(){
  salvarDados(false);
  state.historico.unshift({id:Date.now(),salvoEm:new Date().toLocaleString("pt-BR"),config:{...state.config},dimensionamento:state.dimensionamento,resumo:{criticos:state.leitos.filter(l=>Number(l.gravidade)===5).length,pendencias:contarPendencias()}});
  state.historico=state.historico.slice(0,50);salvarDados(false);renderizarHistorico();toast("Plantão salvo no histórico.");
}
function renderizarHistorico(){
  const el=document.getElementById("lista-historico");
  el.innerHTML=state.historico.length?state.historico.map(h=>`<div class="history-card"><h3>📋 ${escapeHtml(h.config.setor||"Setor não informado")}</h3><p>${escapeHtml(h.config.hospital||"Instituição não informada")} • ${escapeHtml(h.config.data||"")}</p><p>🕒 ${escapeHtml(h.config.turno||"")} • 🔴 ${h.resumo?.criticos||0} crítico(s) • ⚠️ ${h.resumo?.pendencias||0} pendência(s)</p><p><small>Salvo em ${h.salvoEm}</small></p></div>`).join(""):`<div class="card"><p class="muted">Nenhum plantão salvo neste dispositivo.</p></div>`;
}
function limparHistorico(){if(confirm("Deseja apagar todo o histórico deste dispositivo?")){state.historico=[];salvarDados(false);renderizarHistorico();toast("Histórico apagado.");}}
function contarPendencias(){return state.leitos.reduce((n,l)=>n+[l.pendenciasExames,l.condutas,l.passagem].filter(x=>x?.trim()).length,0);}
function atualizarDashboard(){
  const ativos=state.profissionais.filter(p=>p.nome?.trim()).length,crit=state.leitos.filter(l=>Number(l.gravidade)===5).length;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set("stat-leitos",state.leitos.length);set("stat-equipe",ativos);set("stat-criticos",crit);set("stat-pendencias",contarPendencias());
  const resumo=document.getElementById("inicio-resumo");
  if(resumo)resumo.innerHTML=`<div>🏥 <strong>${escapeHtml(state.config.hospital||"Instituição não configurada")}</strong></div><div>📍 ${escapeHtml(state.config.setor||"Setor não configurado")}</div><div>📅 ${escapeHtml(state.config.data||"")} • ${escapeHtml(state.config.turno||"")}</div><div>👩‍⚕️ ${escapeHtml(state.config.enfermeiro||"Responsável não informado")}</div>`;
  const mapa=document.getElementById("mapa-gravidade");
  if(mapa)mapa.innerHTML=state.leitos.map(l=>`<div class="severity-dot g${Number(l.gravidade)}"><strong>${escapeHtml(l.id)}</strong><span>${l.gravidade}</span></div>`).join("");
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

async function gerarPDF(){
  salvarDados(false);
  if(!window.jspdf){toast("Biblioteca de PDF não carregada. Verifique a conexão.");return;}
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:"mm",format:"a4"});let y=15;
  const add=(text,size=10,bold=false)=>{
    doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);
    doc.splitTextToSize(text,180).forEach(line=>{if(y>280){doc.addPage();y=15;}doc.text(line,15,y);y+=size*.55+2;});
  };
  doc.setFillColor(17,24,39);doc.rect(0,0,210,30,"F");doc.setTextColor(255,255,255);doc.setFontSize(20);doc.setFont("helvetica","bold");doc.text("DIMENSUTI MOBILE 2.1",15,14);doc.setFontSize(10);doc.text("by Dia de Treinamento | Relatório Final do Plantão",15,22);doc.setTextColor(20,30,45);y=40;
  add(`Instituição: ${state.config.hospital||"Não informado"}`,11,true);add(`Setor: ${state.config.setor||"Não informado"}`);add(`Data: ${state.config.data||""} | Turno: ${state.config.turno||""}`);add(`Responsável: ${state.config.enfermeiro||"Não informado"} | COREN: ${state.config.coren||"Não informado"}`);y+=3;
  add("AVALIAÇÃO DOS LEITOS",14,true);y+=2;
  state.leitos.forEach(l=>{add(`LEITO ${l.id} — Gravidade: ${GRAVIDADES[l.gravidade]} — Índice operacional: ${calcularIndiceOperacional(l)}`,11,true);if(l.diagnostico)add(`Diagnóstico/descrição: ${l.diagnostico}`);add(`Respiração: ${l.respiracao||"Não informado"}`);add(`Dispositivos: ${(l.dispositivos||[]).join(", ")||"Nenhum registrado"}`);add(`Precauções: ${(l.precaucoes||[]).join(", ")||"Não informado"}`);if(l.pendenciasExames)add(`Exames pendentes: ${l.pendenciasExames}`);if(l.acontecimentos)add(`Acontecimentos: ${l.acontecimentos}`);if(l.condutas)add(`Condutas/pendências: ${l.condutas}`);if(l.passagem)add(`Próximo plantão: ${l.passagem}`);y+=3;});
  if(state.dimensionamento?.grupos?.length){if(y>240){doc.addPage();y=15;}add("DIMENSIONAMENTO SUGERIDO",14,true);state.dimensionamento.grupos.forEach(g=>add(`${g.profissional}: Leitos ${g.leitos.map(x=>x.id).join(", ")||"Sem leitos"} | Índice ${g.carga}`));}
  if(state.plantao.acontecimentos||state.plantao.passagem){if(y>245){doc.addPage();y=15;}add("INFORMAÇÕES GERAIS DO PLANTÃO",14,true);if(state.plantao.acontecimentos)add(`Acontecimentos gerais: ${state.plantao.acontecimentos}`);if(state.plantao.passagem)add(`Passagem geral: ${state.plantao.passagem}`);}
  doc.setFontSize(8);doc.setTextColor(100,116,139);const pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.text(`DimensUTI Mobile • Dia de Treinamento • Página ${i}/${pages}`,15,290);}
  doc.save(`DimensUTI_${(state.config.setor||"Plantao").replace(/\s+/g,"_")}_${state.config.data||"relatorio"}.pdf`);toast("PDF gerado com sucesso.");
}

function exportarBackup(){
  salvarDados(false);
  const payload={app:"DimensUTI Mobile",versao:"3.0",exportadoEm:new Date().toISOString(),dados:state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`backup_dimensuti_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
  toast("Backup exportado.");
}
function importarBackup(event){
  const file=event.target.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const payload=JSON.parse(reader.result);
      const dados=payload.dados||payload;
      if(!dados.config||!Array.isArray(dados.leitos))throw new Error("Formato inválido");
      Object.assign(state,dados);
      state.rodizio={ultimoPreDimensionamento:null,proximo:null,...(dados.rodizio||{})};
      state.ui={dark:false,...(dados.ui||{})};
      normalizarLeitos();salvarDados(false);aplicarTema();preencherConfiguracoes();atualizarDashboard();renderizarLeitos();renderizarHistorico();
      toast("Backup restaurado com sucesso.");
    }catch(e){toast("Não foi possível restaurar este arquivo.");}
  };
  reader.readAsText(file);
  event.target.value="";
}
function aplicarTema(){
  document.body.classList.toggle("dark-mode",!!state.ui.dark);
  const btn=document.getElementById("btn-theme");if(btn)btn.textContent=state.ui.dark?"☀️":"🌙";
}
function alternarTema(){state.ui.dark=!state.ui.dark;aplicarTema();salvarDados(false);}

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("btn-install").hidden=false;});
document.getElementById("btn-install")?.addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("btn-install").hidden=true;});
document.addEventListener("DOMContentLoaded",()=>{
  carregarDados();aplicarTema();preencherConfiguracoes();atualizarDashboard();renderizarLeitos();renderizarHistorico();
  document.getElementById("cfg-tipo-leito")?.addEventListener("change",alternarPersonalizado);
  document.getElementById("btn-theme")?.addEventListener("click",alternarTema);
  if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(console.warn);
});
