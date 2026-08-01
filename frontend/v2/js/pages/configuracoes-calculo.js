// ============================================================
// SOLAR PRO 2.0 — pages/configuracoes-calculo.js
// Formulário singleton para as REGRAS DE CÁLCULO usadas no
// Gerador de Kits e na Proposta Completa.
//
// VERSÃO 1.0 — EXTRAÍDO DE personalizacao-proposta.js v4.0
// Este arquivo cuida SOMENTE de:
//   1. Arredondamento mesclado (geração + placas)
//   2. Parâmetros de cálculo (imposto, reajuste, margem, % de geração)
//   3. Vendedor e estrutura padrão
//   4. Pisos de lucro configuráveis por equipamento
//   5. Financiamento (CRUD de bancos, seleção, exceções)
//
// Identidade visual e textos institucionais ficaram em
// pages/personalizacao-proposta.js.
//
// DEPENDE DE: proposta-config-shared.js (deve ser carregado antes)
// ============================================================

// ============================================================
// CACHE DOS DADOS EM MEMÓRIA (estado desta página)
// ============================================================

window._pisosLucroCache = [];
window._bancosCache = [];
window._excecoesCache = [];
window._bancosSelecionados = [];

// ============================================================
// FUNÇÃO: CARREGAR DADOS DO CONFIG PARA O CACHE
// ============================================================

function carregarDadosDoConfig(cfg) {
  window._pisosLucroCache = Array.isArray(cfg.pisos_lucro) ? cfg.pisos_lucro : [];
  window._bancosCache = Array.isArray(cfg.financas?.bancos) ? cfg.financas.bancos : [];
  window._excecoesCache = Array.isArray(cfg.financas?.excecoes) ? cfg.financas.excecoes : [];

  if (Array.isArray(cfg.financas?.bancos_selecionados)) {
    window._bancosSelecionados = cfg.financas.bancos_selecionados;
  } else if (Array.isArray(cfg.financas?.bancos)) {
    window._bancosSelecionados = cfg.financas.bancos.map(b => b.id);
  } else {
    window._bancosSelecionados = [];
  }
}

// ============================================================
// RENDER: LISTA DE BANCOS PARA SELEÇÃO
// ============================================================

function renderizarListaBancosSelecao() {
  const container = document.getElementById('listaBancosSelecao');
  const contador = document.getElementById('totalBancosSelecionados');
  if (!container) return;

  const bancos = window._bancosCache || [];
  const bancosSelecionados = window._bancosSelecionados || [];

  if (bancos.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:12px;grid-column:1/-1;"><p style="font-size:11px;">Nenhum banco cadastrado. Clique em "Adicionar banco" para criar.</p></div>`;
    if (contador) contador.textContent = '0 de 0 selecionados';
    return;
  }

  container.innerHTML = bancos.map(b => {
    const checked = bancosSelecionados.includes(b.id);
    return `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:6px 8px;background:${checked ? 'var(--surface-3)' : 'transparent'};border-radius:4px;border:1px solid ${checked ? 'var(--orange)' : 'var(--border)'};">
        <input type="checkbox" class="banco-selecao-check" value="${b.id}" ${checked ? 'checked' : ''}>
        ${b.nome}
        <span style="font-size:10px;color:var(--text-faint);margin-left:auto;">
          ${Object.keys(b.taxas || {}).length} prazos
        </span>
      </label>
    `;
  }).join('');

  const checked = document.querySelectorAll('.banco-selecao-check:checked');
  if (contador) {
    contador.textContent = `${checked.length} de ${bancos.length} selecionados`;
  }

  refreshIcons();

  document.querySelectorAll('.banco-selecao-check').forEach(chk => {
    chk.addEventListener('change', function() {
      const checked = document.querySelectorAll('.banco-selecao-check:checked');
      if (checked.length > 4) {
        this.checked = false;
        toast('Máximo 4 bancos podem ser selecionados', 'warning');
      }

      const ids = [];
      document.querySelectorAll('.banco-selecao-check:checked').forEach(c => {
        ids.push(c.value);
      });
      window._bancosSelecionados = ids;

      const total = document.querySelectorAll('.banco-selecao-check').length;
      const contadorEl = document.getElementById('totalBancosSelecionados');
      if (contadorEl) {
        contadorEl.textContent = `${ids.length} de ${total} selecionados`;
      }

      document.querySelectorAll('.banco-selecao-check').forEach(c => {
        const label = c.closest('label');
        if (label) {
          if (c.checked) {
            label.style.background = 'var(--surface-3)';
            label.style.borderColor = 'var(--orange)';
          } else {
            label.style.background = 'transparent';
            label.style.borderColor = 'var(--border)';
          }
        }
      });
    });
  });
}

// ============================================================
// RENDER: LISTA DE BANCOS CADASTRADOS (CRUD)
// ============================================================

function renderizarListaBancos() {
  const container = document.getElementById('listaBancos');
  if (!container) return;

  const bancos = window._bancosCache || [];

  renderizarListaBancosSelecao();

  if (bancos.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:12px"><p style="font-size:11px">Nenhum banco cadastrado</p></div>`;
    return;
  }

  container.innerHTML = bancos.map((b, i) => `
    <div class="banco-item" data-banco-idx="${i}">
      <span class="banco-nome">${b.nome || 'Banco'}</span>
      <span class="banco-taxas">
        ${Object.entries(b.taxas || {}).map(([p, t]) => `${p}x ${t}%`).join(' · ')}
      </span>
      <button class="btn btn-icon btn-ghost btn-sm" data-edit-banco="${i}">${icon('pencil')}</button>
      <button class="btn btn-icon btn-danger btn-sm" data-rm-banco="${i}">${icon('trash-2')}</button>
    </div>
  `).join('');

  refreshIcons();

  container.querySelectorAll('[data-edit-banco]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.editBanco);
      abrirModalBanco(idx);
    });
  });

  container.querySelectorAll('[data-rm-banco]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.rmBanco);
      if (confirm(`Deseja remover o banco "${window._bancosCache[idx]?.nome}"?`)) {
        window._bancosCache.splice(idx, 1);
        window._bancosSelecionados = window._bancosSelecionados.filter(id =>
          window._bancosCache.some(b => b.id === id)
        );
        renderizarListaBancos();
        toast('Banco removido!', 'success');
      }
    });
  });
}

// ============================================================
// RENDER: LISTA DE EXCEÇÕES
// ============================================================

function renderizarListaExcecoes() {
  const container = document.getElementById('listaExcecoesFin');
  const totalSpan = document.getElementById('totalExcecoes');
  if (!container) return;

  const excecoes = window._excecoesCache || [];
  const bancos = window._bancosCache || [];

  if (totalSpan) {
    totalSpan.textContent = `${excecoes.length} exceção(ões)`;
  }

  if (excecoes.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:12px"><p style="font-size:11px;">Nenhuma exceção cadastrada</p></div>`;
    return;
  }

  container.innerHTML = excecoes.map((e, i) => {
    const bancosNomes = (e.bancos_ids || [])
      .map(id => bancos.find(b => b.id === id)?.nome || id)
      .join(', ');

    const totalBancos = (e.bancos_ids || []).length;

    return `
      <div class="banco-item" data-exc-idx="${i}">
        <span style="font-size:12px;flex:1;">
          ${e.placas?.includes('todos') ? 'Placas: todos' : 'Placas: ' + (e.placas?.join(', ') || '—')}
          ${e.inversores?.includes('todos') ? ' · Inv: todos' : ' · Inv: ' + (e.inversores?.join(', ') || '—')}
        </span>
        <span style="font-size:11px;color:var(--text-faint);" title="${bancosNomes}">
          ${totalBancos} banco(s) selecionado(s)
        </span>
        <button class="btn btn-icon btn-ghost btn-sm" data-edit-exc="${i}">${icon('pencil')}</button>
        <button class="btn btn-icon btn-danger btn-sm" data-rm-exc="${i}">${icon('trash-2')}</button>
      </div>
    `;
  }).join('');

  refreshIcons();

  container.querySelectorAll('[data-edit-exc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.editExc);
      abrirModalExcecao(idx);
    });
  });

  container.querySelectorAll('[data-rm-exc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.rmExc);
      if (confirm(`Deseja remover esta exceção?`)) {
        window._excecoesCache.splice(idx, 1);
        renderizarListaExcecoes();
        toast('Exceção removida!', 'success');
      }
    });
  });
}

// ============================================================
// RENDER: LISTA DE PISOS
// ============================================================

function renderizarListaPisos() {
  const container = document.getElementById('listaPisos');
  if (!container) return;

  const pisos = window._pisosLucroCache || [];

  if (pisos.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:16px"><p style="font-size:12px">Nenhum piso configurado. Clique em "Adicionar" para criar.</p></div>`;
    return;
  }

  container.innerHTML = pisos.map((p, i) => `
    <div class="piso-item" data-piso-idx="${i}">
      <span class="piso-badge">R$ ${p.valor || 0}</span>
      <span style="font-size:12px;flex:1">${p.nome || 'Sem nome'}</span>
      <span style="font-size:10px;color:var(--text-faint)">${p.placas?.includes('todos') ? 'Placas: todos' : 'Placas: ' + (p.placas?.join(', ') || '—')}</span>
      <span style="font-size:10px;color:var(--text-faint)">${p.inversores?.includes('todos') ? 'Inv: todos' : 'Inv: ' + (p.inversores?.join(', ') || '—')}</span>
      <button class="btn btn-icon btn-ghost btn-sm" data-edit-piso="${i}">${icon('pencil')}</button>
      <button class="btn btn-icon btn-danger btn-sm" data-rm-piso="${i}">${icon('trash-2')}</button>
    </div>
  `).join('');

  refreshIcons();

  container.querySelectorAll('[data-edit-piso]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.editPiso);
      abrirModalPiso(idx);
    });
  });

  container.querySelectorAll('[data-rm-piso]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.rmPiso);
      if (confirm(`Deseja remover o piso "${window._pisosLucroCache[idx]?.nome}"?`)) {
        window._pisosLucroCache.splice(idx, 1);
        renderizarListaPisos();
        toast('Piso removido!', 'success');
      }
    });
  });
}

// ============================================================
// MODAL: BANCO
// ============================================================

let _modalBancoLogoUrl = null;

function abrirModalBanco(idx) {
  const bancos = window._bancosCache || [];
  const banco = idx !== null ? bancos[idx] : { nome: '', taxas: {} };

  _modalBancoLogoUrl = banco.logo_url || banco.logo || banco.logoUrl || null;

  const taxaHtml = [12, 24, 36, 48, 60, 72, 84].map(p => `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:12px;width:30px;">${p}x</span>
      <input class="input" style="width:70px;padding:4px 6px;" type="number" step="0.01"
             id="modalBancoTaxa_${p}" value="${banco.taxas[p] || ''}" placeholder="%">
    </div>
  `).join('');

  const html = `
    <div class="form-grid1">
      <div class="field"><label>Nome do banco</label><input class="input" id="modalBancoNome" value="${esc(banco.nome || '')}" placeholder="Ex: BTG, Banco do Brasil"></div>
      <div class="field span-2">
        <label>Logo do banco</label>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:4px">
          <button type="button" class="btn btn-secondary btn-sm" id="btnUploadLogoBanco">${icon('upload')} Enviar logo</button>
          <input type="file" id="fileLogoBanco" accept="image/*" style="display:none">
          <img id="logoBancoPreview" src="${_modalBancoLogoUrl || ''}" style="display:${_modalBancoLogoUrl ? 'block' : 'none'};height:40px;max-width:120px;object-fit:contain;background:var(--surface-3);border-radius:8px;padding:4px">
          <span id="logoBancoStatus" class="text-faint" style="font-size:11.5px">${_modalBancoLogoUrl ? '' : 'Sem logo — a bolinha do financiamento mostrará as iniciais do banco'}</span>
        </div>
      </div>
      <div class="field span-2">
        <label>Taxas mensais por prazo</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">${taxaHtml}</div>
      </div>
    </div>
  `;

  openModal({
    id: 'modalBanco',
    title: idx !== null ? 'Editar banco' : 'Novo banco',
    width: 560,
    bodyHtml: html,
    footHtml: `
      <button class="btn btn-secondary" id="btnCancelBanco">Cancelar</button>
      <button class="btn btn-primary" id="btnSaveBanco">${icon('check')} Salvar</button>
    `
  });
  refreshIcons();

  document.getElementById('btnUploadLogoBanco').addEventListener('click', () => document.getElementById('fileLogoBanco').click());
  document.getElementById('fileLogoBanco').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('logoBancoStatus');
    statusEl.textContent = '⏳ Enviando...';
    try {
      const blob = await redimensionarImagem(file);
      // Logo do banco sobe pro ImgBB — mesmo pipeline usado em
      // placas/inversores/estruturas — e só a URL fica salva no
      // cadastro do banco (financas.bancos), nunca o arquivo em si.
      const result = await uploadParaImgBB(blob);
      if (result.success) {
        _modalBancoLogoUrl = result.url;
        const preview = document.getElementById('logoBancoPreview');
        preview.src = _modalBancoLogoUrl;
        preview.style.display = 'block';
        statusEl.textContent = '✅ Logo pronta';
        toast('Logo do banco enviada!', 'success');
      } else {
        statusEl.textContent = '❌ Falha no upload';
        toast('Erro ao enviar imagem: ' + result.error, 'error');
      }
    } catch (err) {
      statusEl.textContent = '❌ Erro ao processar';
      toast('Erro ao processar imagem', 'error');
    }
  });

  document.getElementById('btnSaveBanco').addEventListener('click', () => {
    const nome = document.getElementById('modalBancoNome').value.trim() || 'Banco';
    const taxas = {};
    [12, 24, 36, 48, 60, 72, 84].forEach(p => {
      const val = parseFloat(document.getElementById(`modalBancoTaxa_${p}`).value);
      if (val && val > 0) taxas[p] = val;
    });

    const novoBanco = {
      id: banco.id || (Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      nome,
      logo_url: _modalBancoLogoUrl || '',
      taxas
    };

    if (idx !== null) {
      window._bancosCache[idx] = novoBanco;
    } else {
      window._bancosCache.push(novoBanco);
    }

    closeModal('modalBanco');
    renderizarListaBancos();
    toast('Banco salvo com sucesso!', 'success');
  });

  document.getElementById('btnCancelBanco').addEventListener('click', () => closeModal('modalBanco'));
}

// ============================================================
// MODAL: EXCEÇÃO DE FINANCIAMENTO
// ============================================================

function abrirModalExcecao(idx) {
  const excecoes = window._excecoesCache || [];
  const bancos = window._bancosCache || [];

  const exc = idx !== null ? excecoes[idx] : {
    placas: [],
    inversores: [],
    bancos_ids: []
  };

  const bancosSelecionados = (exc.bancos_ids || []).length;
  const totalBancos = bancos.length;

  const bancosCheckboxHtml = bancos.length === 0
    ? '<p style="color:var(--text-faint);font-size:12px;">Nenhum banco cadastrado. <a href="#" onclick="document.getElementById(\'btnAddBanco\').click(); return false;" style="color:var(--orange);">Cadastre bancos primeiro.</a></p>'
    : bancos.map(b => `
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:4px 0;">
        <input type="checkbox" class="exc-banco-check" value="${b.id}"
               ${(exc.bancos_ids || []).includes(b.id) ? 'checked' : ''}>
        ${b.nome}
        <span style="font-size:10px;color:var(--text-faint);margin-left:4px;">
          (${Object.keys(b.taxas || {}).length} prazos)
        </span>
      </label>
    `).join('');

  const html = `
    <div class="form-grid1">
      <div class="field span-2">
        <label>Regras para placas (separadas por vírgula)</label>
        <input class="input" id="modalExcPlacas" value="${(exc.placas || []).join(', ')}" placeholder="Ex: todos, marca:JINKO, >=600">
        <div class="hint">Use: "todos", ">=600", "<=500", "marca:JINKO", "modelo:Solar"</div>
      </div>
      <div class="field span-2">
        <label>Regras para inversores (separadas por vírgula)</label>
        <input class="input" id="modalExcInversores" value="${(exc.inversores || []).join(', ')}" placeholder="Ex: todos, tipo:MICRO, marca:DEYE">
        <div class="hint">Use: "todos", ">=5000", "<=3000", "marca:DEYE", "tipo:MICRO"</div>
      </div>

      <div class="field span-2">
        <label style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
          <span>Bancos que serão exibidos (selecione até 4)</span>
          <span style="font-size:12px;font-weight:600;color:var(--orange);" id="contadorBancosExc">
            ${bancosSelecionados} de ${totalBancos} selecionados
          </span>
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:8px 12px;background:var(--surface-2);border-radius:6px;max-height:200px;overflow-y:auto;">
          ${bancosCheckboxHtml}
        </div>
        <div class="hint">Selecione quais bancos serão exibidos para esta exceção. Máximo 4 bancos.</div>
      </div>
    </div>
  `;

  openModal({
    id: 'modalExcecao',
    title: idx !== null ? 'Editar exceção' : 'Nova exceção',
    width: 620,
    bodyHtml: html,
    footHtml: `
      <button class="btn btn-secondary" id="btnCancelExc">Cancelar</button>
      <button class="btn btn-primary" id="btnSaveExc">${icon('check')} Salvar</button>
    `
  });
  refreshIcons();

  function atualizarContadorBancos() {
    const checked = document.querySelectorAll('.exc-banco-check:checked');
    const total = document.querySelectorAll('.exc-banco-check').length;
    const contador = document.getElementById('contadorBancosExc');
    if (contador) {
      contador.textContent = `${checked.length} de ${total} selecionados`;
    }
  }

  document.querySelectorAll('.exc-banco-check').forEach(chk => {
    chk.addEventListener('change', function() {
      const checked = document.querySelectorAll('.exc-banco-check:checked');
      if (checked.length > 4) {
        this.checked = false;
        toast('Máximo 4 bancos podem ser selecionados', 'warning');
      }
      atualizarContadorBancos();
    });
  });

  atualizarContadorBancos();

  document.getElementById('btnSaveExc').addEventListener('click', () => {
    const placas = document.getElementById('modalExcPlacas').value.split(',').map(s => s.trim()).filter(Boolean);
    const inversores = document.getElementById('modalExcInversores').value.split(',').map(s => s.trim()).filter(Boolean);

    const bancos_ids = [];
    document.querySelectorAll('.exc-banco-check:checked').forEach(chk => {
      bancos_ids.push(chk.value);
    });

    if (bancos_ids.length === 0) {
      toast('Selecione pelo menos um banco', 'error');
      return;
    }

    const novaExcecao = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      placas,
      inversores,
      bancos_ids
    };

    if (idx !== null) {
      window._excecoesCache[idx] = novaExcecao;
    } else {
      window._excecoesCache.push(novaExcecao);
    }

    closeModal('modalExcecao');
    renderizarListaExcecoes();
    toast('Exceção salva com sucesso!', 'success');
  });

  document.getElementById('btnCancelExc').addEventListener('click', () => closeModal('modalExcecao'));
}

// ============================================================
// MODAL: PISO DE LUCRO
// ============================================================

function abrirModalPiso(idx) {
  const pisos = window._pisosLucroCache || [];
  const piso = idx !== null ? pisos[idx] : { nome: '', valor: 4750, placas: [], inversores: [] };

  const html = `
    <div class="form-grid1">
      <div class="field"><label>Nome do piso</label><input class="input" id="modalPisoNome" value="${esc(piso.nome || '')}" placeholder="Ex: Padrão, MICRO, Alta Potência"></div>
      <div class="field"><label>Valor mínimo de lucro (R$)</label><input class="input" id="modalPisoValor" type="number" min="0" step="100" value="${piso.valor || 4750}"></div>
      <div class="field span-2">
        <label>Regras para placas (separadas por vírgula)</label>
        <input class="input" id="modalPisoPlacas" value="${(piso.placas || []).join(', ')}" placeholder="Ex: todos, >=600, marca:JINKO, modelo:Solar">
        <div class="hint">Use: "todos", ">=600", "<=500", "marca:JINKO", "modelo:Solar"</div>
      </div>
      <div class="field span-2">
        <label>Regras para inversores (separadas por vírgula)</label>
        <input class="input" id="modalPisoInversores" value="${(piso.inversores || []).join(', ')}" placeholder="Ex: todos, tipo:MICRO, marca:DEYE">
        <div class="hint">Use: "todos", ">=5000", "<=3000", "marca:DEYE", "tipo:MICRO"</div>
      </div>
    </div>
  `;

  openModal({
    id: 'modalPiso',
    title: idx !== null ? 'Editar piso de lucro' : 'Novo piso de lucro',
    width: 580,
    bodyHtml: html,
    footHtml: `
      <button class="btn btn-secondary" id="btnCancelPiso">Cancelar</button>
      <button class="btn btn-primary" id="btnSavePiso">${icon('check')} Salvar</button>
    `
  });
  refreshIcons();

  document.getElementById('btnSavePiso').addEventListener('click', () => {
    const nome = document.getElementById('modalPisoNome').value.trim() || 'Sem nome';
    const valor = parseFloat(document.getElementById('modalPisoValor').value) || 4750;
    const placas = document.getElementById('modalPisoPlacas').value.split(',').map(s => s.trim()).filter(Boolean);
    const inversores = document.getElementById('modalPisoInversores').value.split(',').map(s => s.trim()).filter(Boolean);

    const novoPiso = { id: Date.now() + '_' + Math.random().toString(36).slice(2, 6), nome, valor, placas, inversores };

    if (idx !== null) {
      window._pisosLucroCache[idx] = novoPiso;
    } else {
      window._pisosLucroCache.push(novoPiso);
    }

    closeModal('modalPiso');
    renderizarListaPisos();
    toast('Piso salvo com sucesso!', 'success');
  });

  document.getElementById('btnCancelPiso').addEventListener('click', () => closeModal('modalPiso'));
}

// ============================================================
// FUNÇÃO: CARREGAR VENDEDORES E ESTRUTURAS NOS SELECTS
// ============================================================

async function carregarVendedoresEstruturas(cfg) {
  try {
    const [vendedores, estruturas] = await Promise.all([
      apiGetCached('/configuracoes/vendedores'),
      apiGetCached('/configuracoes/estruturas')
    ]);

    const selVendedor = document.getElementById('ppVendedorPadrao');
    if (selVendedor) {
      (vendedores || []).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.nome;
        if (v.id == cfg.vendedor_padrao_id) opt.selected = true;
        selVendedor.appendChild(opt);
      });
    }

    const selEstrutura = document.getElementById('ppEstruturaPadrao');
    if (selEstrutura) {
      (estruturas || []).forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nome;
        if (e.id == cfg.estrutura_padrao_id) opt.selected = true;
        selEstrutura.appendChild(opt);
      });
    }
  } catch (e) {
    console.warn('Erro ao carregar vendedores/estruturas:', e);
  }
}

// ============================================================
// PÁGINA PRINCIPAL: pageConfiguracoesCalculo
// ============================================================

async function pageConfiguracoesCalculo() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando configurações de cálculo...</div>`;

  const cfg = await carregarPropostaConfigMesclada();

  carregarDadosDoConfig(cfg);

  const arred = cfg.arredondamento || PROPOSTA_CONFIG_DEFAULTS.arredondamento;
  const financas = cfg.financas || PROPOSTA_CONFIG_DEFAULTS.financas;
  const bancos = window._bancosCache || [];
  const bancosSelecionados = window._bancosSelecionados || [];

  view.innerHTML = `
    <style>
      .piso-item{display:flex;gap:8px;align-items:center;padding:6px 10px;background:var(--surface-2);border-radius:6px;margin-bottom:4px;flex-wrap:wrap;}
      .piso-item .piso-badge{font-size:10px;font-weight:700;color:var(--orange);}
      .banco-item{display:flex;gap:8px;align-items:center;padding:6px 10px;background:var(--surface-2);border-radius:6px;margin-bottom:4px;flex-wrap:wrap;}
      .banco-item .banco-nome{font-weight:600;font-size:13px;}
      .banco-item .banco-taxas{font-size:11px;color:var(--text-faint);}
    </style>

    <div class="view-head">
      <div><h1>Configurações de Cálculo</h1><p>Arredondamento, imposto, margem, pisos de lucro e financiamento</p></div>
      <div class="view-head-actions">
        <button class="btn btn-primary" id="btnSalvarCC">${icon('check')} Salvar</button>
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div>
        <!-- CARD: Arredondamento (MESCLADO) -->
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('sliders-horizontal')}</div>
            <div><h3>Arredondamento</h3>
              <div class="sub">Controla o arredondamento da geração (kWh) e da quantidade de placas</div>
            </div>
          </div>

          <div class="form-grid1">
            <div class="field span-2">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="ppArredAtivado" ${arred.ativado !== false ? 'checked' : ''}>
                <span><strong>Ativar arredondamento</strong></span>
              </label>
            </div>
            <div class="field">
              <label>Percentual de geração (%)</label>
              <input class="input" id="gPercGeracao" type="number" min="1" max="100"
                     value="${cfg.margem_perca || 100}">
              <div class="hint">98% = ajuste para perdas; 100% = sem ajuste</div>
            </div>
            <div class="field">
              <label>Limite de geração (kWh)</label>
              <input class="input" id="ppArredLimite" type="number" min="0" step="100"
                     value="${arred.limite_kwh || 1500}">
              <div class="hint">Abaixo deste valor, usa o limiar "até"; acima, usa "acima"</div>
            </div>

            <div class="field">
              <label>Limiar para geração (até 1500 kWh)</label>
              <input class="input" id="ppArredGerAte" type="number" min="0" step="1"
                     value="${arred.limiar_ate_1500 || 10}">
              <div class="hint">Ex: 490 com limiar 10 vira 500</div>
            </div>

            <div class="field">
              <label>Limiar para geração (acima 1500 kWh)</label>
              <input class="input" id="ppArredGerAcima" type="number" min="0" step="1"
                     value="${arred.limiar_acima_1500 || 20}">
            </div>

            <div class="field">
              <label>Limiar para placas (até 1500 kWh)</label>
              <input class="input" id="ppArredPlacaAte" type="number" min="0" step="1"
                     value="${arred.placa_limiar_ate_1500 || 9}">
              <div class="hint">Ex: 9 = se faltar menos de 9 kWh, usa 1 placa a menos</div>
            </div>

            <div class="field">
              <label>Limiar para placas (acima 1500 kWh)</label>
              <input class="input" id="ppArredPlacaAcima" type="number" min="0" step="1"
                     value="${arred.placa_limiar_acima_1500 || 15}">
            </div>
            <div class="field">
              <label>Arredondamento da geração (múltiplos)</label>
              <input class="input" id="ppArredGerMultiplo" type="number" min="1" step="1"
                     value="${arred.multiplicador_geracao || 100}">
              <div class="hint">Ex: 50 → arredonda para múltiplos de 50; 100 → arredonda para múltiplos de 100</div>
            </div>
          </div>
        </div>


        <!-- CARD: Parâmetros de Cálculo -->
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('calculator')}</div>
            <div><h3>Parâmetros de Cálculo</h3>
              <div class="sub">Valores padrão usados em novos orçamentos</div>
            </div>
          </div>

          <div class="form-grid1">
            <div class="field">
              <label>Imposto base (%)</label>
              <input class="input" id="ppImpostoBase" type="number" min="0" max="100"
                     value="${cfg.imposto_percentual_base || 43}">
              <div class="hint">Percentual inicial (sobe automaticamente se necessário)</div>
            </div>
            <div class="field">
              <label>Reajuste padrão (R$)</label>
              <input class="input" id="ppReajustePadrao" type="number" min="0" step="10"
                     value="${cfg.reajuste_padrao || 150}">
            </div>
            <div class="field">
              <label>Margem padrão (%)</label>
              <input class="input" id="ppMargemPadrao" type="number" min="0" max="100" step="0.1"
                     value="${cfg.margem_padrao || 4}">
            </div>
            <div class="field">
              <label>Comissão do vendedor (%)</label>
              <input class="input" id="ppComissaoPercentual" type="number" min="0" max="100" step="0.1"
                     value="${cfg.comissao_percentual || 0}">
              <div class="hint">Calculada sobre o valor total do orçamento e exibida no Resumo da Proposta</div>
            </div>
            <div class="field">
              <label>Vendedor padrão</label>
              <select class="select" id="ppVendedorPadrao">
                <option value="">— Selecione —</option>
              </select>
            </div>
            <div class="field">
              <label>Estrutura padrão</label>
              <select class="select" id="ppEstruturaPadrao">
                <option value="">— Selecione —</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <!-- CARD: Pisos de Lucro -->
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('coins')}</div>
            <div><h3>Pisos de Lucro</h3>
              <div class="sub">Defina regras para ajuste automático do imposto</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btnAddPiso">${icon('plus')} Adicionar</button>
          </div>
          <div id="listaPisos"></div>
        </div>

        <!-- CARD: Financiamento -->
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('landmark')}</div>
            <div><h3>Financiamento</h3>
              <div class="sub">Bancos e exceções para a página de financiamento</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btnAddBanco">${icon('plus')} Adicionar banco</button>
          </div>

          <div class="form-grid1">
            <div class="field span-2">
              <label style="display:flex;justify-content:space-between;align-items:center;">
                <span>Bancos disponíveis para simulação</span>
                <span style="font-size:12px;font-weight:600;color:var(--orange);" id="totalBancosSelecionados">${bancosSelecionados.length} de ${bancos.length} selecionados</span>
              </label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 12px;background:var(--surface-2);border-radius:6px;max-height:200px;overflow-y:auto;" id="listaBancosSelecao">
                ${bancos.length === 0 ? `<div class="empty-state" style="padding:12px;grid-column:1/-1;"><p style="font-size:11px;">Nenhum banco cadastrado. Clique em "Adicionar banco" para criar.</p></div>` : bancos.map(b => {
                  const checked = bancosSelecionados.includes(b.id);
                  return `
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:6px 8px;background:${checked ? 'var(--surface-3)' : 'transparent'};border-radius:4px;border:1px solid ${checked ? 'var(--orange)' : 'var(--border)'};">
                      <input type="checkbox" class="banco-selecao-check" value="${b.id}" ${checked ? 'checked' : ''}>
                      ${b.nome}
                      <span style="font-size:10px;color:var(--text-faint);margin-left:auto;">
                        ${Object.keys(b.taxas || {}).length} prazos
                      </span>
                    </label>
                  `;
                }).join('')}
              </div>
              <div class="hint">Selecione até 4 bancos para exibir na proposta. Os bancos marcados serão as simulações disponíveis.</div>
            </div>

            <div class="field">
              <label>Entrada (%)</label>
              <input class="input" id="ppFinEntrada" type="number" min="0" max="100" value="${financas.entrada_percentual || 0}">
            </div>
            <div class="field">
              <label>Carência (meses)</label>
              <input class="input" id="ppFinCarencia" type="number" min="0" value="${financas.carencia_meses || 3}">
            </div>
          </div>

          <div class="mt-16">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <label style="font-size:12px;font-weight:600;color:var(--text-faint);">Bancos cadastrados</label>
              <span style="font-size:11px;color:var(--text-faint);" id="totalBancos">${bancos.length} banco(s)</span>
            </div>
            <div id="listaBancos"></div>
          </div>

          <div class="mt-16">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <label style="font-size:12px;font-weight:600;color:var(--text-faint);">Exceções por equipamento</label>
              <span style="font-size:11px;color:var(--text-faint);" id="totalExcecoes">${(financas.excecoes || []).length} exceção(ões)</span>
            </div>
            <div id="listaExcecoesFin"></div>
            <button class="btn btn-ghost btn-sm mt-8" id="btnAddExcecao">${icon('plus')} Adicionar exceção</button>
          </div>
        </div>
      </div>
    </div>
  `;
  refreshIcons();

  // ============================================================
  // EVENTOS DO FORMULÁRIO
  // ============================================================

  await carregarVendedoresEstruturas(cfg);

  renderizarListaPisos();
  renderizarListaBancos();
  renderizarListaExcecoes();

  document.getElementById('btnAddPiso').addEventListener('click', () => abrirModalPiso(null));
  document.getElementById('btnAddBanco').addEventListener('click', () => abrirModalBanco(null));
  document.getElementById('btnAddExcecao').addEventListener('click', () => abrirModalExcecao(null));

  document.getElementById('btnSalvarCC').addEventListener('click', () => salvarConfiguracoesCalculo());
}
window.pageConfiguracoesCalculo = pageConfiguracoesCalculo;

// ============================================================
// FUNÇÃO: SALVAR CONFIGURAÇÕES DE CÁLCULO (só campos desta página)
// ============================================================

async function salvarConfiguracoesCalculo() {
  const arredondamento = {
    ativado: document.getElementById('ppArredAtivado').checked,
    limite_kwh: parseInt(document.getElementById('ppArredLimite').value) || 1500,
    limiar_ate_1500: parseInt(document.getElementById('ppArredGerAte').value) || 10,
    limiar_acima_1500: parseInt(document.getElementById('ppArredGerAcima').value) || 20,
    placa_limiar_ate_1500: parseInt(document.getElementById('ppArredPlacaAte').value) || 9,
    placa_limiar_acima_1500: parseInt(document.getElementById('ppArredPlacaAcima').value) || 15,
    multiplicador_geracao: parseInt(document.getElementById('ppArredGerMultiplo').value) || 100,
  };

  const imposto_percentual_base = parseFloat(document.getElementById('ppImpostoBase').value) || 43;
  const reajuste_padrao = parseFloat(document.getElementById('ppReajustePadrao').value) || 150;
  const margem_padrao = parseFloat(document.getElementById('ppMargemPadrao').value) || 4;
  const comissao_percentual = parseFloat(document.getElementById('ppComissaoPercentual').value) || 0;
  const margem_perca = parseFloat(document.getElementById('gPercGeracao').value) || 100;
  const vendedor_padrao_id = document.getElementById('ppVendedorPadrao').value || null;
  const estrutura_padrao_id = document.getElementById('ppEstruturaPadrao').value || null;

  const entrada_percentual = parseFloat(document.getElementById('ppFinEntrada').value) || 0;
  const carencia_meses = parseInt(document.getElementById('ppFinCarencia').value) || 3;

  const pisos_lucro = window._pisosLucroCache || [];
  const bancos = window._bancosCache || [];
  const bancos_selecionados = window._bancosSelecionados || [];
  const excecoes = window._excecoesCache || [];

  const camposCalculo = {
    arredondamento,
    vendedor_padrao_id,
    estrutura_padrao_id,
    imposto_percentual_base,
    reajuste_padrao,
    margem_padrao,
    comissao_percentual,
    margem_perca,
    pisos_lucro,
    financas: {
      bancos,
      bancos_selecionados,
      excecoes,
      entrada_percentual,
      carencia_meses,
      taxa_base: 0,
    }
  };

  const btn = document.getElementById('btnSalvarCC');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon('loader')} Salvando...`;
  refreshIcons();

  // Mescla com o config mais recente do servidor, preservando o que
  // pertence a Personalização da Proposta (não sobrescreve essas chaves).
  const result = await salvarPropostaConfigParcial(camposCalculo);

  btn.disabled = false;
  btn.innerHTML = original;
  refreshIcons();

  if (result) {
    toast('Configurações de cálculo salvas! Novos orçamentos já usam esses valores.', 'success');
  }
}
window.salvarConfiguracoesCalculo = salvarConfiguracoesCalculo;

console.log('%c⚡ Solar Pro 2.0 — configuracoes-calculo.js v1.0 carregado', 'color:#ffb020;font-weight:bold');
