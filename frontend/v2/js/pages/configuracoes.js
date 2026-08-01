// ============================================================
// SOLAR PRO 2.0 — pages/configuracoes.js
// Cadastro de Estruturas de Fixação e Vendedores
// ============================================================

const CONFIG_SCHEMA = {
  estruturas: {
    title: 'Estruturas de Fixação',
    icon: 'building-2',
    endpoint: '/configuracoes/estruturas',
    hasImage: true,
    searchKeys: ['nome', 'tipo'],
    fields: [
      { key: 'nome', label: 'Nome da estrutura', type: 'text', required: true },
      { key: 'tipo', label: 'Categoria (livre)', type: 'text', hint: 'Ex: Telhado Cerâmico, Carport, Solo com lastro... o que você quiser' },
      { key: 'descricao', label: 'Descrição detalhada', type: 'textarea', span: 2 },
      { key: 'preco_base', label: 'Preço base (R$)', type: 'number', step: 0.01, default: 0 },
    ],
    cardTitle(d) { return d.nome || 'Estrutura sem nome'; },
    cardMeta(d) { return `${d.tipo || '-'} · ${formatarMoeda(d.preco_base || 0)}`; }
  },
vendedores: {
  title: 'Vendedores',
  icon: 'users',
  endpoint: '/configuracoes/vendedores',
  hasImage: false,
  searchKeys: ['nome', 'email', 'telefone', 'codigo'],
  fields: [
    { key: 'codigo', label: 'Código (2 dígitos)', type: 'text', required: true,
      hint: 'Usado no nome do arquivo da proposta — ex: 01, 02, 03... (mesma lógica do VBA)' },
    { key: 'nome', label: 'Nome completo', type: 'text', required: true },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'telefone', label: 'Telefone', type: 'text' },
    { key: 'comissao', label: 'Comissão padrão (%)', type: 'number', step: 0.01, default: 0 },
    { key: 'observacao', label: 'Observação', type: 'textarea', span: 2 },
  ],
  cardTitle(d) { return d.nome || 'Vendedor sem nome'; },
  cardMeta(d) { return `${d.codigo || '--'} · ${d.telefone || '-'} · ${d.email || '-'}`; }
},
// ============================================================
// FORNECEDORES — usado nas autorizações de faturamento do
// Dimensionamento BNB (fornecedor de material). Cadastrado uma vez,
// selecionado depois no modal do Dimensionamento em vez de digitar
// nome/CNPJ toda hora. Também serve pra qualquer outro fornecedor
// (estrutura, distribuidora etc.) que a empresa queira guardar.
// ============================================================
fornecedores: {
  title: 'Fornecedores',
  icon: 'truck',
  endpoint: '/configuracoes/fornecedores',
  hasImage: false,
  searchKeys: ['nome_empresarial', 'cnpj', 'contato'],
  fields: [
    { key: 'nome_empresarial', label: 'Nome empresarial (razão social)', type: 'text', required: true,
      hint: 'Ex: FORTLEV ENERGIA SOLAR LTDA' },
    { key: 'cnpj', label: 'CNPJ', type: 'text', required: true, hint: '00.000.000/0000-00' },
    { key: 'contato', label: 'Contato (telefone/WhatsApp)', type: 'text' },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'endereco', label: 'Endereço', type: 'text', span: 2 },
    { key: 'observacao', label: 'Observação', type: 'textarea', span: 2 },
  ],
  cardTitle(d) { return d.nome_empresarial || 'Fornecedor sem nome'; },
  cardMeta(d) { return `${d.cnpj || '-'} · ${d.contato || d.email || 'sem contato'}`; }
}
};

let _configState = { tipo: null, items: [], editingId: null, imageUrl: null, search: '', filters: {} };

async function pageConfiguracoes(tipo = 'estruturas') {
  const schema = CONFIG_SCHEMA[tipo];
  if (!schema) { toast('Tipo de configuração inválido', 'error'); return; }

  _configState = { tipo, items: [], editingId: null, imageUrl: null, search: '', filters: {} };
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando ${schema.title}...</div>`;

  const items = await apiGetCached(schema.endpoint);
  _configState.items = Array.isArray(items) ? items : [];

  view.innerHTML = `
    <div class="view-head">
      <div><h1>${schema.title}</h1><p>${_configState.items.length} registro(s) cadastrado(s)</p></div>
      <div class="view-head-actions">
        <button class="btn btn-ghost" id="btnRefreshConfig">${icon('refresh-cw')} Atualizar</button>
        <button class="btn btn-primary" id="btnAddNew">${icon('plus')} Adicionar</button>
      </div>
    </div>

    <div class="tabs" id="configTabs">
      <div class="tab ${tipo === 'estruturas' ? 'active' : ''}" data-tipo="estruturas">🏗️ Estruturas</div>
      <div class="tab ${tipo === 'vendedores' ? 'active' : ''}" data-tipo="vendedores">👤 Vendedores</div>
      <div class="tab ${tipo === 'fornecedores' ? 'active' : ''}" data-tipo="fornecedores">🚚 Fornecedores</div>
    </div>

    <div class="grid grid-2 mt-16" style="align-items:start;">
      <div class="card" id="configFormCard">
        <div class="card-head">
          <div class="ico">${icon(schema.icon)}</div>
          <div><h3 id="formTitle">Novo registro</h3><div class="sub">Preencha os campos abaixo</div></div>
        </div>
        <div class="form-grid1" id="formFields"></div>
        ${schema.hasImage ? `
        <div class="field span-full mt-16" style="grid-column:1/-1">
          <label>Imagem da estrutura</label>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn btn-secondary btn-sm" id="btnUploadImg">${icon('image')} Selecionar imagem</button>
            <input type="file" id="fileImg" accept="image/*" style="display:none">
            <img id="imgPreview" style="display:none;width:64px;height:64px;object-fit:contain;background:var(--surface-3);border-radius:9px;border:1px solid var(--border)">
            <span id="imgStatus" class="text-faint" style="font-size:11.5px"></span>
          </div>
          <div class="hint">A imagem será usada na proposta completa para ilustrar o tipo de estrutura</div>
        </div>` : ''}
        <div class="flex-between mt-20">
          <button class="btn btn-ghost btn-sm" id="btnCancelEdit" style="display:none">Cancelar edição</button>
          <button class="btn btn-primary" id="btnSave" style="margin-left:auto">${icon('check')} Salvar</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('list-filter')}</div>
          <div class="grow"><h3>Lista</h3><div class="sub">Busque e gerencie</div></div>
        </div>
        <input class="input" id="searchInput" placeholder="🔎 Buscar..." style="margin-bottom:12px">
        <div class="data-grid" id="listContainer" style="max-height:500px;overflow-y:auto;padding-right:4px"></div>
      </div>
    </div>
  `;

  renderConfigForm(schema);
  renderConfigList(schema);
  refreshIcons();

  // Tabs
  document.querySelectorAll('#configTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tipo = tab.getAttribute('data-tipo');
      document.querySelectorAll('#configTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      pageConfiguracoes(tipo);
    });
  });

  document.getElementById('btnAddNew').addEventListener('click', () => resetConfigForm(schema));
  document.getElementById('btnRefreshConfig').addEventListener('click', async () => {
    invalidateCache(schema.endpoint);
    toast('Atualizando lista...', 'info', 1500);
    pageConfiguracoes(tipo);
  });
  document.getElementById('btnCancelEdit').addEventListener('click', () => resetConfigForm(schema));
  document.getElementById('btnSave').addEventListener('click', () => saveConfigItem(schema));
  document.getElementById('searchInput').addEventListener('input', (e) => {
    _configState.search = e.target.value;
    renderConfigList(schema);
  });

  if (schema.hasImage) {
    document.getElementById('btnUploadImg').addEventListener('click', () => document.getElementById('fileImg').click());
    document.getElementById('fileImg').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('imgStatus');
      statusEl.textContent = '⏳ Enviando...';
      try {
        const blob = await redimensionarImagem(file);
        document.getElementById('imgPreview').src = URL.createObjectURL(blob);
        document.getElementById('imgPreview').style.display = 'block';
        const result = await uploadParaImgBB(blob);
        if (result.success) {
          _configState.imageUrl = result.url;
          statusEl.textContent = '✅ Imagem carregada!';
          toast('Imagem carregada com sucesso!', 'success');
        } else {
          statusEl.textContent = '❌ Falha no upload';
          toast('Erro ao enviar imagem: ' + result.error, 'error');
        }
      } catch (err) {
        statusEl.textContent = '❌ Erro ao processar';
        toast('Erro ao processar imagem', 'error');
      }
    });
  }
}
window.pageConfiguracoes = pageConfiguracoes;

function renderConfigForm(schema) {
  const wrap = document.getElementById('formFields');
  wrap.innerHTML = schema.fields.map(f => fieldConfigHtml(f)).join('');
  refreshIcons();
}

function fieldConfigHtml(f) {
  const spanClass = f.span === 2 ? 'span-2' : '';
  let control;
  if (f.type === 'select') {
    control = `<select class="select" id="f_${f.key}">
      <option value="">— selecione —</option>
      ${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}
    </select>`;
  } else if (f.type === 'textarea') {
    control = `<textarea class="input" id="f_${f.key}" rows="3"></textarea>`;
  } else {
    control = `<input class="input" id="f_${f.key}" type="${f.type}" ${f.step ? `step="${f.step}"` : ''} ${f.default !== undefined ? `value="${f.default}"` : ''}>`;
  }
  return `<div class="field ${spanClass}"><label>${f.label}${f.required ? ' *' : ''}</label>${control}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
}

function resetConfigForm(schema) {
  _configState.editingId = null;
  _configState.imageUrl = null;
  document.getElementById('formTitle').textContent = 'Novo registro';
  document.getElementById('btnCancelEdit').style.display = 'none';
  document.getElementById('btnSave').innerHTML = `${icon('check')} Salvar`;
  schema.fields.forEach(f => {
    const el = document.getElementById(`f_${f.key}`);
    if (!el) return;
    el.value = f.default !== undefined ? f.default : '';
  });
  const imgP = document.getElementById('imgPreview');
  if (imgP) { imgP.style.display = 'none'; imgP.src = ''; }
  const st = document.getElementById('imgStatus');
  if (st) st.textContent = '';
  refreshIcons();
}

function fillConfigForm(schema, item) {
  _configState.editingId = item.id;
  _configState.imageUrl = item.imagem_url || null;
  document.getElementById('formTitle').textContent = `Editando: ${schema.cardTitle(item)}`;
  document.getElementById('btnCancelEdit').style.display = 'inline-flex';
  document.getElementById('btnSave').innerHTML = `${icon('check')} Salvar alterações`;
  schema.fields.forEach(f => {
    const el = document.getElementById(`f_${f.key}`);
    if (!el) return;
    el.value = item[f.key] !== undefined && item[f.key] !== null ? item[f.key] : (f.default !== undefined ? f.default : '');
  });
  if (schema.hasImage && item.imagem_url) {
    const imgP = document.getElementById('imgPreview');
    imgP.src = item.imagem_url;
    imgP.style.display = 'block';
  }
  refreshIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveConfigItem(schema) {
  const data = {};
  let missingRequired = false;
  schema.fields.forEach(f => {
    const el = document.getElementById(`f_${f.key}`);
    if (!el) return;
    let v = el.value;
    if (f.required && !String(v).trim()) missingRequired = true;
    if (f.type === 'number') v = v === '' ? (f.default !== undefined ? f.default : 0) : parseFloat(v);
    data[f.key] = v;
  });
  if (missingRequired) { toast('Preencha os campos obrigatórios (*)', 'error'); return; }

  if (_configState.imageUrl) data.imagem_url = _configState.imageUrl;

  const btn = document.getElementById('btnSave');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon('loader')} Salvando...`;
  refreshIcons();

  let result;
  if (_configState.editingId) {
    result = await apiPut(`${schema.endpoint}/${_configState.editingId}`, data);
    if (result) toast('Registro atualizado com sucesso!', 'success');
  } else {
    result = await apiPost(schema.endpoint, data);
    if (result) toast('Registro cadastrado com sucesso!', 'success');
  }

  btn.disabled = false;
  btn.innerHTML = original;
  refreshIcons();

  if (result) {
    invalidateCache(schema.endpoint);
    resetConfigForm(schema);
    const items = await apiGet(schema.endpoint);
    _configState.items = Array.isArray(items) ? items : [];
    Store.cache[schema.endpoint] = { data: _configState.items, ts: Date.now() };
    renderConfigList(schema);
    const headP = document.querySelector('.view-head p');
    if (headP) headP.textContent = `${_configState.items.length} registro(s) cadastrado(s)`;
  }
}

function renderConfigList(schema) {
  const container = document.getElementById('listContainer');
  if (!container) return; // usuário já navegou pra outra tela — nada a fazer
  let items = [..._configState.items];

  if (_configState.search.trim()) {
    const s = _configState.search.toLowerCase();
    items = items.filter(it => schema.searchKeys.some(k => String(it[k] || '').toLowerCase().includes(s)));
  }
  items = items.slice().reverse();

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">${icon('inbox')}<p>Nenhum registro encontrado</p></div>`;
    refreshIcons();
    return;
  }

  container.innerHTML = items.map(it => `
    <div class="item-row">
      ${schema.hasImage && it.imagem_url
        ? `<img class="thumb-sm" src="${it.imagem_url}" style="border-radius:6px;object-fit:cover;">`
        : `<div class="icon-sm">${icon(schema.icon)}</div>`}
      <div class="main">
        <div class="title">${schema.cardTitle(it)}</div>
        <div class="subtitle">${schema.cardMeta(it)}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-icon btn-ghost" data-edit="${it.id}" title="Editar">${icon('pencil')}</button>
        <button class="btn btn-icon btn-danger" data-del="${it.id}" title="Excluir">${icon('trash-2')}</button>
      </div>
    </div>
  `).join('');
  refreshIcons();

  container.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
    const item = _configState.items.find(i => i.id == el.getAttribute('data-edit'));
    if (item) fillConfigForm(schema, item);
  }));
  container.querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', async () => {
    const id = el.getAttribute('data-del');
    const item = _configState.items.find(i => i.id == id);
    const ok = await confirmDialog({
      title: 'Excluir registro',
      msg: `Tem certeza que deseja excluir "${schema.cardTitle(item || {})}"? Esta ação não pode ser desfeita.`
    });
    if (!ok) return;
    const result = await apiDelete(`${schema.endpoint}/${id}`);
    if (result) {
      toast('Registro excluído', 'success');
      _configState.items = _configState.items.filter(i => i.id != id);
      Store.cache[schema.endpoint] = { data: _configState.items, ts: Date.now() };
      renderConfigList(schema);
      const headP = document.querySelector('.view-head p');
      if (headP) headP.textContent = `${_configState.items.length} registro(s) cadastrado(s)`;
    }
  }));
}
