// ============================================================
// SOLAR PRO 2.0 — pages/cadastro.js
// CRUD único, orientado a schema, para Placas / Inversores / Baterias / Clientes.
// Substitui 4 módulos quase-duplicados da v1 por 1 motor genérico.
// Endpoints e nomes de campos idênticos ao backend original.
//
// v1.1 — NOVIDADE: cadastro de Clientes ganhou um bloco especial de
// "Histórico de Consumo" (12 meses), usado pela Proposta BNB para montar
// a tabela de consumo x geração e calcular o consumo médio real do
// cliente. É um campo de tipo especial ('consumo_historico') que foge do
// padrão genérico de <input>/<select> — por isso tem tratamento próprio
// em fieldHtml/renderFormFields/resetForm/fillForm/saveItem, isolado com
// comentários "BNB:" para facilitar manutenção futura.
// ============================================================

const CADASTRO_SCHEMA = {
  placas: {
    title: 'Placas Solares', icon: 'grid-3x2', endpoint: '/equipamentos/placas',
    hasImage: true, estoqueToggle: true,
    searchKeys: ['marca','modelo'],
    filters: [
      { key:'marca', label:'Marca' },
      { key:'tipo', label:'Tipo', options:['MONOFACIAL','BIFACIAL','MONOCRISTALINO','N TYPE','N TYPE BIFACIAL'] },
    ],
    fields: [
      { key:'marca', label:'Marca', type:'text', required:true },
      { key:'modelo', label:'Modelo', type:'text' },
      { key:'potencia', label:'Potência (W)', type:'number', required:true },
      { key:'tipo', label:'Tipo', type:'select', required:true, options:['MONOFACIAL','BIFACIAL','MONOCRISTALINO','N TYPE','N TYPE BIFACIAL'] },
      { key:'ativo', label:'Ativo / Em estoque', type:'checkbox', default:true, hint:'Desmarque para parar de mostrar no Gerador de Kits e no Orçamento' },
      { key:'altura', label:'Altura (m)', type:'number', step:0.001, default:2.382 },
      { key:'largura', label:'Largura (m)', type:'number', step:0.001, default:1.134 },
      { key:'garantia', label:'Garantia (anos)', type:'number', default:12 },
      { key:'garantiager', label:'Garantia de Geração (anos)', type:'number', default:25 },
      { key:'inmetro', label:'INMETRO', type:'text', default:'000000/2000' },
      { key:'outros', label:'Outras informações', type:'text', span:2 },
      { key:'horas_efetivas', label:'Horas efetivas/dia', type:'number', step:0.1, default:5, advanced:true },
      { key:'dias_geracao', label:'Dias de geração/mês', type:'number', default:30, advanced:true },
      { key:'fator_percentual', label:'Fator de perdas (0–1)', type:'number', step:0.01, default:0.85, advanced:true },
      { key:'margem_percentual', label:'Margem de segurança (0.98–1)', type:'number', step:0.01, default:1, advanced:true },
    ],
    computed(d){
      d.area = +(((+d.altura||0) * (+d.largura||0)).toFixed(3)) || 0;
      d.nome_completo = `${d.marca||''} ${d.modelo||''} ${d.potencia||''}W`.trim();
      d.fator_geracao = +Calc.fatorGeracao(d).toFixed(2);
      return d;
    },
    cardMeta(d){ return `${d.potencia||0}W · ${d.tipo||'-'} · Garantia ${d.garantia||'-'}a · Geração ${d.garantiager||'-'}a`; },
    cardTitle(d){ return `${d.marca||''} ${d.modelo||''}`.trim() || 'Placa sem nome'; },
  },
  inversores: {
    title: 'Inversores', icon: 'zap', endpoint: '/equipamentos/inversores',
    hasImage: true, estoqueToggle: true,
    searchKeys: ['marca','modelo'],
    filters: [
      { key:'marca', label:'Marca' },
      { key:'tipo', label:'Tipo', options:['ONGRID','OFFGRID','HIBRIDO','MICRO','CONTROLADOR OFFGRID'] },
    ],
    fields: [
      { key:'marca', label:'Marca', type:'text', required:true },
      { key:'modelo', label:'Modelo', type:'text' },
      { key:'tipo', label:'Tipo', type:'select', required:true, options:['ONGRID','OFFGRID','HIBRIDO','MICRO','CONTROLADOR OFFGRID'] },
      { key:'ativo', label:'Ativo / Em estoque', type:'checkbox', default:true, hint:'Desmarque para parar de mostrar no Gerador de Kits e no Orçamento' },
      { key:'potencia', label:'Potência (W)', type:'number', required:true, step:100 },
      { key:'potencia_min', label:'Potência mínima (W)', type:'number', hint:'Auto: 70% da potência se vazio' },
      { key:'potencia_max', label:'Potência máxima (W)', type:'number', hint:'Auto: 150% da potência se vazio' },
      { key:'tensao', label:'Tensão', type:'select', options:['','220','380','127'], hint:'Auto se vazio' },
      { key:'fase', label:'Fase', type:'select', options:['','MONOFÁSICO','BIFÁSICO','TRIFÁSICO'], hint:'Auto se vazio' },
      { key:'garantia', label:'Garantia (anos)', type:'number', default:10 },
      { key:'inmetro', label:'INMETRO', type:'text' },
      { key:'outros', label:'Outros', type:'text', span:2 },
    ],
    computed(d){
      const pot = +d.potencia || 0;
      if(!d.potencia_min) d.potencia_min = Math.round(pot * 0.7);
      if(!d.potencia_max) d.potencia_max = Math.round(pot * 1.5);
      if(!d.tensao) d.tensao = pot <= 12000 ? '220' : '380';
      if(!d.fase) d.fase = pot <= 12000 ? 'MONOFÁSICO' : 'TRIFÁSICO';
      d.nome_completo = `${d.marca||''} ${d.modelo||''}`.trim();
      d.potencia_formatada = `${pot}W`;
      return d;
    },
    cardMeta(d){ return `${d.tipo||'-'} · ${d.potencia||0}W · ${d.tensao||''}V ${d.fase||''} · Garantia ${d.garantia||'-'}a`; },
    cardTitle(d){ return `${d.marca||''} ${d.modelo||''}`.trim() || 'Inversor sem nome'; },
  },
  baterias: {
    title: 'Baterias', icon: 'battery-full', endpoint: '/equipamentos/baterias',
    hasImage: true,
    searchKeys: ['nome'],
    filters: [
      { key:'tipo', label:'Tipo', options:['CHUMBO','LITIO','ESTACIONARIA'] },
    ],
    fields: [
      { key:'nome', label:'Nome / Modelo', type:'text', required:true },
      { key:'tipo', label:'Tipo da bateria', required:true, type:'select', options:['CHUMBO','LITIO','ESTACIONARIA'], optionLabels:{CHUMBO:'Chumbo Ácido',LITIO:'Lítio',ESTACIONARIA:'Estacionária'} },
      { key:'garantia', label:'Garantia (anos)', type:'number', default:5 },
      { key:'capacidade', label:'Capacidade (Ah)', type:'number' },
      { key:'tensao', label:'Tensão (V)', type:'number' },
      { key:'inmetro', label:'INMETRO', type:'text' },
      { key:'outros', label:'Outros', type:'text', span:2 },
    ],
    computed(d){ return d; },
    cardMeta(d){ return `${d.tipo||'-'} · ${d.capacidade||'-'}Ah · ${d.tensao||'-'}V · Garantia ${d.garantia||'-'}a`; },
    cardTitle(d){ return d.nome || 'Bateria sem nome'; },
  },
    outros_equipamentos: {
    title: 'Outros Equipamentos',
    icon: 'package',
    endpoint: '/equipamentos/outros_equipamentos',
    hasImage: true,
    estoqueToggle: true,
    searchKeys: ['nome', 'modelo', 'categoria'],
    filters: [
      { key: 'categoria', label: 'Categoria' },
    ],
    fields: [
      { key: 'nome', label: 'Nome do equipamento', type: 'text', required: true, hint: 'Ex: Bomba Solar, Controlador de Carga...' },
      { key: 'modelo', label: 'Modelo', type: 'text' },
      { key: 'categoria', label: 'Categoria', type: 'select', options: ['Bomba Solar', 'Controlador de Carga', 'Estrutura', 'Cabos', 'Conectores', 'Outros'] },
      { key: 'ativo', label: 'Ativo / Em estoque', type: 'checkbox', default: true },
      { key: 'descricao', label: 'Descrição detalhada', type: 'textarea', span: 2 },
      { key: 'potencia', label: 'Potência (W)', type: 'number', step: 10 },
      { key: 'tensao', label: 'Tensão (V)', type: 'number', step: 1 },
      { key: 'corrente', label: 'Corrente (A)', type: 'number', step: 0.1 },
      { key: 'garantia', label: 'Garantia (meses)', type: 'number', default: 12 },
    ],
    computed(d){ return d; },
    cardMeta(d){ return `${d.categoria || '-'} ${d.modelo || ''}`.trim() || 'Sem detalhes'; },
    cardTitle(d){ return d.nome || 'Equipamento sem nome'; },
  },
  clientes: {
    title: 'Clientes', icon: 'contact', endpoint: '/clientes', altEndpointBase:'/clientes',
    hasImage: false,
    searchKeys: ['nome','cpf_cnpj','telefone','email'],
    filters: [],
    fields: [
      { key:'nome', label:'Nome', type:'text', required:true },
      { key:'cpf_cnpj', label:'CPF/CNPJ', type:'text' },
      { key:'telefone', label:'Telefone', type:'text' },
      { key:'email', label:'Email', type:'email' },
      { key:'endereco', label:'Endereço', type:'text', span:2 },
      { key:'numero', label:'Número', type:'text' },
      { key:'complemento', label:'Complemento', type:'text' },
      { key:'bairro', label:'Bairro', type:'text' },
      { key:'cidade', label:'Cidade', type:'text' },
      { key:'estado', label:'UF', type:'text', hint:'Usada para estimar a irradiância solar da região na Proposta BNB' },
      { key:'cep', label:'CEP', type:'text' },
      { key:'unidadeConsumidora', label:'Unidade Consumidora (UC)', type:'text', hint:'Número da UC na fatura de energia — usado na Proposta BNB' },
      // BNB: campo especial — 12 meses de consumo (kWh), o mês e a geração
      // são sempre calculados (não cadastrados aqui). Ver tratamento
      // específico em fieldHtml/renderFormFields/resetForm/fillForm/saveItem.
      { key:'historico_consumo', label:'Histórico de Consumo (Proposta BNB)', type:'consumo_historico', span:2 },
    ],
    computed(d){ return d; },
    cardMeta(d){ return [d.telefone, d.email, d.cidade].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'; },
    cardTitle(d){ return d.nome || 'Cliente sem nome'; },
  },
  materiais: {
    title: 'Materiais e Serviços', icon: 'receipt', endpoint: '/configuracoes/materiais_avulsos',
    hasImage: false,
    searchKeys: ['nome','categoria'],
    filters: [
      { key:'categoria', label:'Categoria' },
    ],
    fields: [
      { key:'nome', label:'Nome do item/serviço', type:'text', required:true },
      { key:'descricao', label:'Descrição', type:'text', span:2 },
      { key:'unidade', label:'Unidade', type:'select', options:['UNI','METRO','KG','M²','CX','PC','SC','ROLO','KIT'], default:'UNI' },
      { key:'preco_unitario', label:'Preço unitário (R$)', type:'number', step:0.01, default:0 },
      { key:'categoria', label:'Categoria', type:'text', hint:'Ex: Cabos, Conectores, Estrutura, Mão de obra...' },
      { key:'estoque', label:'Estoque (opcional)', type:'number' },
    ],
    computed(d){ return d; },
    cardMeta(d){ return `${formatarMoeda(d.preco_unitario||0)} / ${d.unidade||'UNI'} ${d.categoria ? '· '+d.categoria : ''}`; },
    cardTitle(d){ return d.nome || 'Item sem nome'; },
  }
};
window.CADASTRO_SCHEMA = CADASTRO_SCHEMA;

// ============================================================
// BNB: helpers para o bloco de "Histórico de Consumo" do cliente
// (mesma lógica de geração de rótulos de mês usada em
// pages/proposta-completa-bnb.js — duplicada aqui de propósito, pra este
// arquivo não depender de proposta-completa-bnb.js estar carregado).
// ============================================================
const MESES_PT_CADASTRO = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Últimos `qtd` meses terminando no mês ANTERIOR ao atual (index 0 = mais
// antigo, último index = mês passado). Ex.: hoje em julho → último = junho.
function gerarMesesHistoricoCadastro(qtd){
  const hoje = new Date();
  const labels = [];
  for(let i = qtd; i >= 1; i--){
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    labels.push(MESES_PT_CADASTRO[d.getMonth()]);
  }
  return labels;
}

function _atualizarMediaConsumoHistorico(wrapEl){
  const inputs = wrapEl.querySelectorAll('[data-consumo-idx]');
  const vals = Array.from(inputs).map(inp => parseFloat(inp.value)).filter(v => !isNaN(v));
  const media = vals.length ? Math.round(vals.reduce((a,v)=>a+v,0) / vals.length) : null;
  const disp = wrapEl.querySelector('#consumoMedioDisplay');
  if(disp) disp.textContent = media != null ? `${media} kWh (${vals.length}/12 meses preenchidos)` : '—';
}

let _cadastroState = { tipo:null, items:[], editingId:null, imageUrl:null, search:'', filters:{}, advancedOpen:false, somenteAtivos:true };

async function pageCadastro(tipo){
  const schema = CADASTRO_SCHEMA[tipo];
  _cadastroState = { tipo, items:[], editingId:null, imageUrl:null, search:'', filters:{}, advancedOpen:false, somenteAtivos:true };
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando ${schema.title}...</div>`;

  const items = await apiGetCached(schema.endpoint);
  _cadastroState.items = Array.isArray(items) ? items : [];

  view.innerHTML = `
    <div class="view-head">
      <div><h1>${schema.title}</h1><p>${_cadastroState.items.length} registro(s) cadastrado(s)</p></div>
      <div class="view-head-actions">
        <button class="btn btn-ghost" id="btnRefreshCadastro">${icon('refresh-cw')} Atualizar</button>
        <button class="btn btn-primary" id="btnAddNew">${icon('plus')} Adicionar</button>
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start;">
      <div class="card" id="cadastroFormCard">
        <div class="card-head">
          <div class="ico">${icon(schema.icon)}</div>
          <div><h3 id="formTitle">Novo registro</h3><div class="sub">Preencha os campos abaixo</div></div>
        </div>
        <div class="form-grid1" id="formFields"></div>
        ${schema.hasImage ? `
        <div class="field span-full mt-16" style="grid-column:1/-1">
          <label>Imagem</label>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn btn-secondary btn-sm" id="btnUploadImg">${icon('image')} Selecionar imagem</button>
            <input type="file" id="fileImg" accept="image/*" style="display:none">
            <img id="imgPreview" style="display:none;width:52px;height:52px;object-fit:contain;background:var(--surface-3);border-radius:9px">
            <span id="imgStatus" class="text-faint" style="font-size:11.5px"></span>
          </div>
        </div>` : ''}
        <div class="flex-between mt-20">
          <button class="btn btn-ghost btn-sm" id="btnCancelEdit" style="display:none">Cancelar edição</button>
          <button class="btn btn-primary" id="btnSave" style="margin-left:auto">${icon('check')} Salvar</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('list-filter')}</div>
          <div class="grow"><h3>Lista</h3><div class="sub">Busque, filtre e gerencie</div></div>
        </div>
        <input class="input" id="searchInput" placeholder="🔎 Buscar..." style="margin-bottom:12px">
        ${schema.estoqueToggle ? `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;margin-bottom:12px;color:var(--text-faint);">
          <input type="checkbox" id="filtroSomenteAtivos" ${_cadastroState.somenteAtivos ? 'checked' : ''}>
          <span>Mostrar somente ativos / em estoque</span>
        </label>` : ''}
        ${schema.filters.length ? `
        <div class="grid" style="grid-template-columns:repeat(${schema.filters.length},1fr);gap:10px;margin-bottom:14px">
          ${schema.filters.map(f => `
            <select class="select" data-filter="${f.key}">
              <option value="">${f.label}: Todos</option>
              ${(f.options || uniqueValues(_cadastroState.items, f.key)).map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>
          `).join('')}
        </div>` : ''}
        <div class="data-grid" id="listContainer" style="max-height:640px;overflow-y:auto;padding-right:4px"></div>
      </div>
    </div>
  `;

  renderFormFields(schema);
  renderList(schema);
  refreshIcons();

  document.getElementById('btnAddNew').addEventListener('click', () => resetForm(schema));
  document.getElementById('btnRefreshCadastro').addEventListener('click', async () => {
    invalidateCache(schema.endpoint);
    toast('Atualizando lista...', 'info', 1500);
    pageCadastro(tipo);
  });
  document.getElementById('btnCancelEdit').addEventListener('click', () => resetForm(schema));
  document.getElementById('btnSave').addEventListener('click', () => saveItem(schema));
  document.getElementById('searchInput').addEventListener('input', (e) => { _cadastroState.search = e.target.value; renderList(schema); });
  view.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('change', () => {
    _cadastroState.filters[el.getAttribute('data-filter')] = el.value;
    renderList(schema);
  }));
  const elSomenteAtivos = document.getElementById('filtroSomenteAtivos');
  if(elSomenteAtivos) elSomenteAtivos.addEventListener('change', () => {
    _cadastroState.somenteAtivos = elSomenteAtivos.checked;
    renderList(schema);
  });

  if(schema.hasImage){
    document.getElementById('btnUploadImg').addEventListener('click', () => document.getElementById('fileImg').click());
    document.getElementById('fileImg').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const statusEl = document.getElementById('imgStatus');
      statusEl.textContent = '⏳ Enviando...';
      try{
        const blob = await redimensionarImagem(file);
        document.getElementById('imgPreview').src = URL.createObjectURL(blob);
        document.getElementById('imgPreview').style.display = 'block';
        const result = await uploadParaImgBB(blob);
        if(result.success){
          _cadastroState.imageUrl = result.url;
          statusEl.textContent = '✅ Imagem pronta';
          toast('Imagem carregada com sucesso!', 'success');
        }else{
          statusEl.textContent = '❌ Falha no upload';
          toast('Erro ao enviar imagem: ' + result.error, 'error');
        }
      }catch(err){
        statusEl.textContent = '❌ Erro ao processar';
        toast('Erro ao processar imagem', 'error');
      }
    });
  }
}
window.pageCadastro = pageCadastro;

function uniqueValues(items, key){
  return [...new Set(items.map(i => i[key]).filter(Boolean))].sort();
}

function renderFormFields(schema){
  const wrap = document.getElementById('formFields');
  const basics = schema.fields.filter(f => !f.advanced);
  const advanced = schema.fields.filter(f => f.advanced);

  wrap.innerHTML = basics.map(f => fieldHtml(f)).join('') +
    (advanced.length ? `
      <div class="advanced-toggle" id="advToggle">${icon('chevron-right', 'id="advIcon"')}<span>Configurações avançadas de cálculo</span></div>
      <div class="advanced-wrap" id="advWrap">${advanced.map(f => fieldHtml(f)).join('')}</div>
    ` : '');

  refreshIcons();
  if(advanced.length){
    document.getElementById('advToggle').addEventListener('click', () => {
      _cadastroState.advancedOpen = !_cadastroState.advancedOpen;
      document.getElementById('advWrap').classList.toggle('open', _cadastroState.advancedOpen);
      document.getElementById('advIcon').setAttribute('data-lucide', _cadastroState.advancedOpen ? 'chevron-down' : 'chevron-right');
      refreshIcons();
    });
  }

  // BNB: liga o cálculo ao vivo da média de consumo sempre que algum dos
  // 12 campos de consumo mensal for editado.
  const consumoInputs = wrap.querySelectorAll('[data-consumo-idx]');
  if(consumoInputs.length){
    consumoInputs.forEach(inp => inp.addEventListener('input', () => _atualizarMediaConsumoHistorico(wrap)));
  }
}

function fieldHtml(f){
  const spanClass = f.span === 2 ? 'span-2' : '';

  // BNB: campo especial de histórico de consumo — foge do padrão de
  // <input>/<select> único, então tem seu próprio bloco com 12 campos
  // (um por mês) + exibição de média ao vivo.
  if(f.type === 'consumo_historico'){
    const meses = gerarMesesHistoricoCadastro(12);
    return `<div class="field span-full" style="grid-column:1/-1">
      <label>${f.label}</label>
      <div class="hint">Preencha o consumo (kWh) de cada mês, com base nas últimas faturas de energia do cliente. O mês mais recente é sempre o mês anterior ao atual — os demais são calculados automaticamente. Deixe em branco os meses sem fatura disponível.</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px">
        ${meses.map((mes,i)=>`
          <div>
            <label style="font-size:10px;text-transform:uppercase;color:var(--text-faint);display:block;margin-bottom:2px">${mes}</label>
            <input class="input" type="number" min="0" step="1" id="f_${f.key}_${i}" data-consumo-idx="${i}" placeholder="kWh">
          </div>
        `).join('')}
      </div>
      <div class="mt-8" style="font-size:12px;color:var(--text-faint)">Consumo médio: <b id="consumoMedioDisplay">—</b></div>
    </div>`;
  }

  let control;
  if(f.type === 'select'){
    control = `<select class="select" id="f_${f.key}">
      ${f.options.map(o => `<option value="${o}">${f.optionLabels?.[o] || (o === '' ? '— selecione —' : o)}</option>`).join('')}
    </select>`;
  }else if(f.type === 'checkbox'){
    return `<div class="field ${spanClass}"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:22px">
      <input type="checkbox" id="f_${f.key}" ${f.default ? 'checked' : ''}>
      <span>${f.label}${f.required?' *':''}</span>
    </label>${f.hint?`<div class="hint">${f.hint}</div>`:''}</div>`;
  }else if(f.type === 'textarea'){
    control = `<textarea class="input" id="f_${f.key}" rows="3" placeholder="${f.default !== undefined ? f.default : ''}"></textarea>`;
  }else{
    control = `<input class="input" id="f_${f.key}" type="${f.type}" ${f.step?`step="${f.step}"`:''} placeholder="${f.default !== undefined ? f.default : ''}">`;
  }
  return `<div class="field ${spanClass}"><label>${f.label}${f.required?' *':''}</label>${control}${f.hint?`<div class="hint">${f.hint}</div>`:''}</div>`;
}

function resetForm(schema){
  _cadastroState.editingId = null;
  _cadastroState.imageUrl = null;
  document.getElementById('formTitle').textContent = 'Novo registro';
  document.getElementById('btnCancelEdit').style.display = 'none';
  document.getElementById('btnSave').innerHTML = `${icon('check')} Salvar`;
  schema.fields.forEach(f => {
    // BNB: limpa os 12 campos de consumo e a média exibida.
    if(f.type === 'consumo_historico'){
      for(let i=0;i<12;i++){
        const inp = document.getElementById(`f_${f.key}_${i}`);
        if(inp) inp.value = '';
      }
      const disp = document.getElementById('consumoMedioDisplay');
      if(disp) disp.textContent = '—';
      return;
    }
    const el = document.getElementById(`f_${f.key}`);
    if(!el) return;
    if(f.type === 'checkbox'){ el.checked = f.default !== undefined ? !!f.default : true; return; }
    el.value = f.default !== undefined ? f.default : '';
  });
  const imgP = document.getElementById('imgPreview');
  if(imgP){ imgP.style.display = 'none'; imgP.src=''; }
  const st = document.getElementById('imgStatus'); if(st) st.textContent = '';
  refreshIcons();
}

function fillForm(schema, item){
  _cadastroState.editingId = item.id;
  _cadastroState.imageUrl = item.imagem_url || null;
  document.getElementById('formTitle').textContent = `Editando: ${schema.cardTitle(item)}`;
  document.getElementById('btnCancelEdit').style.display = 'inline-flex';
  document.getElementById('btnSave').innerHTML = `${icon('check')} Salvar alterações`;
  schema.fields.forEach(f => {
    // BNB: distribui o array de 12 valores (ou string JSON) nos 12 campos,
    // e recalcula a média exibida.
    if(f.type === 'consumo_historico'){
      let arr = item[f.key];
      if(typeof arr === 'string'){ try{ arr = JSON.parse(arr); }catch(e){ arr = []; } }
      arr = Array.isArray(arr) ? arr : [];
      for(let i=0;i<12;i++){
        const inp = document.getElementById(`f_${f.key}_${i}`);
        if(inp) inp.value = (arr[i] != null && arr[i] !== '') ? arr[i] : '';
      }
      const vals = arr.map(v => parseFloat(v)).filter(v => !isNaN(v));
      const media = vals.length ? Math.round(vals.reduce((a,v)=>a+v,0)/vals.length) : null;
      const disp = document.getElementById('consumoMedioDisplay');
      if(disp) disp.textContent = media != null ? `${media} kWh (${vals.length}/12 meses preenchidos)` : '—';
      return;
    }
    const el = document.getElementById(`f_${f.key}`);
    if(!el) return;
    if(f.type === 'checkbox'){
      el.checked = item[f.key] !== undefined && item[f.key] !== null ? !!item[f.key] : (f.default !== undefined ? !!f.default : true);
      return;
    }
    el.value = item[f.key] !== undefined && item[f.key] !== null ? item[f.key] : (f.default !== undefined ? f.default : '');
  });
  if(schema.hasImage && item.imagem_url){
    const imgP = document.getElementById('imgPreview');
    imgP.src = item.imagem_url; imgP.style.display = 'block';
  }
  refreshIcons();
  window.scrollTo({ top:0, behavior:'smooth' });
}

async function saveItem(schema){
  const data = {};
  let missingRequired = false;
  schema.fields.forEach(f => {
    // BNB: junta os 12 campos de consumo num único array (com null pros
    // meses vazios) e salva como JSON string (mesmo formato lido em
    // proposta-completa-bnb.js).
    if(f.type === 'consumo_historico'){
      const arr = [];
      for(let i=0;i<12;i++){
        const inp = document.getElementById(`f_${f.key}_${i}`);
        const v = inp ? inp.value : '';
        arr.push(v !== '' ? parseFloat(v) : null);
      }
      data[f.key] = JSON.stringify(arr);
      return;
    }
    const el = document.getElementById(`f_${f.key}`);
    if(!el) return;
    if(f.type === 'checkbox'){ data[f.key] = el.checked; return; }
    let v = el.value;
    if(f.required && !String(v).trim()) missingRequired = true;
    if(f.type === 'number') v = v === '' ? (f.default !== undefined ? f.default : '') : parseFloat(v);
    data[f.key] = v;
  });
  if(missingRequired){ toast('Preencha os campos obrigatórios (*)', 'error'); return; }

  const finalData = schema.computed(data);
  if(_cadastroState.imageUrl) finalData.imagem_url = _cadastroState.imageUrl;

  const btn = document.getElementById('btnSave');
  const original = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `${icon('loader')} Salvando...`; refreshIcons();

  let result;
  if(_cadastroState.editingId){
    result = await apiPut(`${schema.endpoint}/${_cadastroState.editingId}`, finalData);
    if(result) toast('Registro atualizado com sucesso!', 'success');
  }else{
    result = await apiPost(schema.endpoint, finalData);
    if(result) toast('Registro cadastrado com sucesso!', 'success');
  }

  btn.disabled = false; btn.innerHTML = original; refreshIcons();

  if(result){
    invalidateCache(schema.endpoint);
    resetForm(schema);
    const items = await apiGet(schema.endpoint);
    _cadastroState.items = Array.isArray(items) ? items : [];
    Store.cache[schema.endpoint] = { data: _cadastroState.items, ts: Date.now() };
    renderList(schema);
    document.querySelector('.view-head p').textContent = `${_cadastroState.items.length} registro(s) cadastrado(s)`;
  }

  // BNB: se a página chamou pageCadastro('clientes') vinda do orçamento
  // (ex.: botão "+ Adicionar novo cliente" dentro do seletor), sinaliza
  // pra quem quiser escutar (ex.: reabrir o seletor já com o novo cliente).
  if(result && schema.endpoint === '/clientes' && typeof window.onClienteCadastradoBNB === 'function'){
    try{ window.onClienteCadastradoBNB({ ...finalData, id: result.id }); }catch(e){ /* ignora */ }
  }
}

function renderList(schema){
  const container = document.getElementById('listContainer');
  let items = [..._cadastroState.items];

  if(_cadastroState.search.trim()){
    const s = _cadastroState.search.toLowerCase();
    items = items.filter(it => schema.searchKeys.some(k => String(it[k]||'').toLowerCase().includes(s)));
  }
  Object.entries(_cadastroState.filters).forEach(([k,v]) => { if(v) items = items.filter(it => String(it[k]) === v); });
  if(schema.estoqueToggle && _cadastroState.somenteAtivos){ items = items.filter(itemEstaAtivo); }
  items = items.slice().reverse();

  if(items.length === 0){
    container.innerHTML = `<div class="empty-state">${icon('inbox')}<p>Nenhum registro encontrado</p></div>`;
    refreshIcons();
    return;
  }

  container.innerHTML = items.map(it => {
    const ativo = itemEstaAtivo(it);
    const dimStyle = schema.estoqueToggle && !ativo ? 'opacity:.55' : '';
    return `
    <div class="item-row" style="${dimStyle}">
      ${schema.estoqueToggle ? `
        <label class="btn-icon" style="cursor:pointer;flex-shrink:0" title="${ativo ? 'Ativo — clique para desativar' : 'Inativo — clique para ativar'}">
          <input type="checkbox" class="toggle-ativo-check" data-toggle-ativo="${it.id}" ${ativo ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer">
        </label>` : ''}
      ${schema.hasImage
        ? (it.imagem_url ? `<img class="thumb-sm" src="${it.imagem_url}">` : `<div class="icon-sm">${icon(schema.icon)}</div>`)
        : `<div class="icon-sm">${icon(schema.icon)}</div>`}
      <div class="main">
        <div class="title">${schema.cardTitle(it)}${schema.estoqueToggle && !ativo ? ' <span class="badge" style="font-size:9px;background:var(--surface-3);color:var(--text-faint);padding:1px 6px;border-radius:4px;vertical-align:middle;">Inativo</span>' : ''}</div>
        <div class="subtitle">${schema.cardMeta(it)}</div>
      </div>
      <div class="row-actions">
        ${schema.endpoint === '/clientes' ? `<button class="btn btn-icon btn-ghost" data-docs="${it.id}" title="Documentos e anexos">${icon('folder-open')}</button>` : ''}
        <button class="btn btn-icon btn-ghost" data-edit="${it.id}" title="Editar">${icon('pencil')}</button>
        <button class="btn btn-icon btn-danger" data-del="${it.id}" title="Excluir">${icon('trash-2')}</button>
      </div>
    </div>
  `;
  }).join('');
  refreshIcons();

  container.querySelectorAll('[data-docs]').forEach(el => el.addEventListener('click', () => {
    const item = _cadastroState.items.find(i => i.id == el.getAttribute('data-docs'));
    if(item && typeof abrirModalDocumentosCliente === 'function') abrirModalDocumentosCliente(item);
  }));

  container.querySelectorAll('[data-toggle-ativo]').forEach(chk => chk.addEventListener('change', async () => {
    const id = chk.getAttribute('data-toggle-ativo');
    const item = _cadastroState.items.find(i => i.id == id);
    if(!item) return;
    const novoValor = chk.checked;
    chk.disabled = true;
    const result = await apiPut(`${schema.endpoint}/${id}`, { ...item, ativo: novoValor });
    chk.disabled = false;
    if(result){
      item.ativo = novoValor;
      Store.cache[schema.endpoint] = { data: _cadastroState.items, ts: Date.now() };
      toast(novoValor ? 'Marcado como ativo/em estoque' : 'Marcado como inativo', 'success', 1800);
      renderList(schema);
    }else{
      chk.checked = !novoValor; // reverte se falhar
    }
  }));

  container.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
    const item = _cadastroState.items.find(i => i.id == el.getAttribute('data-edit'));
    if(item) fillForm(schema, item);
  }));
  container.querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', async () => {
    const id = el.getAttribute('data-del');
    const item = _cadastroState.items.find(i => i.id == id);
    const ok = await confirmDialog({ title:'Excluir registro', msg:`Tem certeza que deseja excluir "${schema.cardTitle(item||{})}"? Esta ação não pode ser desfeita.` });
    if(!ok) return;
    const result = await apiDelete(`${schema.endpoint}/${id}`);
    if(result){
      toast('Registro excluído', 'success');
      _cadastroState.items = _cadastroState.items.filter(i => i.id != id);
      Store.cache[schema.endpoint] = { data: _cadastroState.items, ts: Date.now() };
      renderList(schema);
      document.querySelector('.view-head p').textContent = `${_cadastroState.items.length} registro(s) cadastrado(s)`;
    }
  }));
}
