// ============================================================
// SOLAR PRO 2.0 — pages/historico.js
// Histórico de orçamentos salvos + log geral de atividades.
// Lê os nomes de coluna reais do GAS (valor_final, quantidade_placas,
// data_orcamento etc.) e reconstrói o detalhamento multi-item a
// partir das colunas itens_*_json para permitir reimportação.
// ============================================================

async function pageHistorico(){
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando histórico...</div>`;

  const [logs, orcamentos] = await Promise.all([apiGetCached('/log'), apiGetCached('/orcamentos')]);
  const logsList = Array.isArray(logs) ? logs : [];
  const orcList = Array.isArray(orcamentos) ? orcamentos : [];

  view.innerHTML = `
    <div class="view-head">
      <div><h1>Histórico</h1><p>${orcList.length} orçamento(s) salvo(s) · ${logsList.length} evento(s) de log</p></div>
    </div>

    <div class="tabs" id="histTabs">
      <div class="tab active" data-tab="orcamentos">Orçamentos salvos</div>
      <div class="tab" data-tab="log">Log de atividades</div>
    </div>

    <div class="mt-16" id="histSearchWrap">
      <input type="text" id="histSearchOrc" class="input" placeholder="Buscar por cliente ou número da proposta..." style="width:100%">
    </div>

    <div class="card mt-16" id="histBody"></div>
  `;

  function resumoItens(o){
    const partes = [];
    if(+o.quantidade_placas > 0) partes.push(`${o.quantidade_placas} placa(s)`);
    if(+o.quantidade_inversores > 0) partes.push(`${o.quantidade_inversores} inversor(es)`);
    if(+o.quantidade_baterias > 0) partes.push(`${o.quantidade_baterias} bateria(s)`);
    try{ if(JSON.parse(o.itens_materiais_json||'[]').length) partes.push(`materiais/serviços`); }catch{}
    return partes.join(' · ') || 'Sem itens';
  }

  function filtrarOrcamentos(termo){
    const t = (termo || '').trim().toLowerCase();
    if(!t) return orcList;
    return orcList.filter(o => {
      const nome = (o.cliente_nome || '').toLowerCase();
      const codigo = (o.codigo_proposta || '').toLowerCase();
      return nome.includes(t) || codigo.includes(t);
    });
  }

  function renderOrcamentos(){
    const body = document.getElementById('histBody');
    const searchEl = document.getElementById('histSearchOrc');
    const termo = searchEl ? searchEl.value : '';
    const lista = filtrarOrcamentos(termo);

    if(orcList.length === 0){
      body.innerHTML = `<div class="empty-state">${icon('inbox')}<p>Nenhum orçamento salvo ainda. Gere uma proposta e clique em "Salvar no histórico".</p></div>`;
      refreshIcons(); return;
    }
    if(lista.length === 0){
      body.innerHTML = `<div class="empty-state">${icon('search')}<p>Nenhum orçamento encontrado para "${termo}".</p></div>`;
      refreshIcons(); return;
    }
    
    const hoje = new Date();
    
    body.innerHTML = `<div class="data-grid">${lista.map(o => {
      const dataOrc = new Date(o.data_orcamento);
      const diasDiff = (hoje - dataOrc) / (1000 * 60 * 60 * 24);
      const isDesatualizado = diasDiff > 7;
      const statusBadge = isDesatualizado 
        ? '<span class="badge" style="font-size:9px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;margin-left:6px;">📅 Desatualizado</span>' 
        : '';
      
      return `
      <div class="item-row" style="${isDesatualizado ? 'opacity:0.7;' : ''}">
        <div class="icon-sm">${icon('sun')}</div>
        <div class="main">
          <div class="title">${o.codigo_proposta || 'Sem código'} ${statusBadge}</div>
          <div class="subtitle">${o.cliente_nome || 'Sem cliente'} · ${resumoItens(o)} · ${fmtDate(o.data_orcamento)}</div>
          ${o.nome_arquivo ? `<div class="subtitle" style="font-size:10px;color:var(--text-faint);">📄 ${o.nome_arquivo}</div>` : ''}
          ${isDesatualizado ? `<div class="subtitle" style="font-size:10px;color:#92400e;">⚠️ Orçamento com mais de 7 dias</div>` : ''}
        </div>
        <div class="amount">${formatarMoeda(o.valor_final||0)}</div>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost" data-import="${o.id}" title="Importar para orçamento">${icon('download')}</button>
          <button class="btn btn-icon btn-ghost" data-reprint="${o.id}" title="Ver / reimprimir proposta">${icon('file-text')}</button>
          <button class="btn btn-icon btn-danger" data-del-hist="${o.id}" title="Excluir do histórico">${icon('trash-2')}</button>
        </div>
      </div>
    `}).join('')}</div>`;
    refreshIcons();
    
    body.querySelectorAll('[data-import]').forEach(btn => btn.addEventListener('click', () => {
      const o = orcList.find(x => x.id == btn.getAttribute('data-import'));
      if(o) importarOrcamentoHistorico(o);
    }));
    
    body.querySelectorAll('[data-reprint]').forEach(btn => btn.addEventListener('click', () => {
      const o = orcList.find(x => x.id == btn.getAttribute('data-reprint'));
      if(o) abrirEscolhaProposta(o);
    }));

    body.querySelectorAll('[data-del-hist]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-hist');
      const o = orcList.find(x => x.id == id);
      const ok = await confirmDialog({
        title: 'Excluir orçamento do histórico',
        msg: `Tem certeza que deseja excluir o orçamento de "${o?.cliente_nome || 'sem cliente'}" (${formatarMoeda(o?.valor_final||0)})? Esta ação não pode ser desfeita.`
      });
      if(!ok) return;
      const result = await apiDelete(`/orcamentos/${id}`);
      if(result){
        toast('Orçamento excluído do histórico', 'success');
        const idx = orcList.findIndex(x => x.id == id);
        if(idx > -1) orcList.splice(idx, 1);
        invalidateCache('/orcamentos');
        const headP = document.querySelector('.view-head p');
        if(headP) headP.textContent = `${orcList.length} orçamento(s) salvo(s) · ${logsList.length} evento(s) de log`;
        renderOrcamentos();
      }
    }));
  }

  function renderLog(){
    const body = document.getElementById('histBody');
    if(logsList.length === 0){
      body.innerHTML = `<div class="empty-state">${icon('inbox')}<p>Nenhum evento registrado ainda</p></div>`;
      refreshIcons(); return;
    }
    body.innerHTML = `<div class="data-grid">${logsList.slice().reverse().map(l => `
      <div class="item-row">
        <div class="icon-sm">${icon('activity')}</div>
        <div class="main">
          <div class="title">${l.acao || 'Ação registrada'}</div>
          <div class="subtitle">${fmtDate(l.data_registro)}</div>
        </div>
      </div>
    `).join('')}</div>`;
    refreshIcons();
  }

  document.querySelectorAll('#histTabs .tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('#histTabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const isOrc = t.getAttribute('data-tab') === 'orcamentos';
    const searchWrap = document.getElementById('histSearchWrap');
    if(searchWrap) searchWrap.style.display = isOrc ? '' : 'none';
    isOrc ? renderOrcamentos() : renderLog();
  }));

  document.getElementById('histSearchOrc').addEventListener('input', () => renderOrcamentos());

  renderOrcamentos();
}
window.pageHistorico = pageHistorico;

// ============================================================
// RECONSTRÓI ITENS (PLACA/INVERSOR/BATERIA/OUTROS) A PARTIR DO SNAPSHOT
// ============================================================
// Compartilhado entre "Importar para orçamento" e "Ver/reimprimir proposta".
// IMPORTANTE: nunca usa só o snapshot salvo no histórico (que só tem
// marca/modelo/tipo/potência) — sempre busca o item CADASTRADO de verdade
// pelo id no catálogo atual (placas, inversores, baterias, outros), que tem
// os campos completos (imagem, garantia, horas_efetivas, dias_geracao,
// fator_percentual etc.) necessários tanto para os cálculos quanto para as
// imagens aparecerem na proposta. Se o item cadastrado tiver sido excluído
// desde então, cai para os dados do snapshot como último recurso.
async function reconstruirItensDoHistorico(o){
  let placasSnap = [], inversoresSnap = [], bateriasSnap = [], outrosSnap = [], materiais = [];
  try{ placasSnap = JSON.parse(o.itens_placas_json || '[]'); }catch(e){ console.warn('Erro ao parse placas:', e); }
  try{ inversoresSnap = JSON.parse(o.itens_inversores_json || '[]'); }catch(e){ console.warn('Erro ao parse inversores:', e); }
  try{ bateriasSnap = JSON.parse(o.itens_baterias_json || '[]'); }catch(e){ console.warn('Erro ao parse baterias:', e); }
  try{ outrosSnap = JSON.parse(o.itens_outros_json || '[]'); }catch(e){ console.warn('Erro ao parse outros itens:', e); }
  try{ materiais = JSON.parse(o.itens_materiais_json || '[]'); }catch(e){ console.warn('Erro ao parse materiais:', e); }

  const [placasCat, inversoresCat, bateriasCat, outrosCat] = await Promise.all([
    apiGetCached('/equipamentos/placas'),
    apiGetCached('/equipamentos/inversores'),
    apiGetCached('/equipamentos/baterias'),
    apiGetCached('/equipamentos/outros_equipamentos'),
  ]);

  let itensNaoEncontrados = 0;

  const itensPlaca = placasSnap.map(p => {
    const real = placasCat.find(cat => cat.id == p.id);
    if(!real) itensNaoEncontrados++;
    return {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      placa: real || { id: p.id || '', marca: p.marca || '', modelo: p.modelo || '', potencia: p.potencia || 0, tipo: p.tipo || '' },
      qtd: p.qtd || 1
    };
  });

  const itensInversor = inversoresSnap.map(i => {
    const real = inversoresCat.find(cat => cat.id == i.id);
    if(!real) itensNaoEncontrados++;
    return {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      inversor: real || { id: i.id || '', marca: i.marca || '', modelo: i.modelo || '', tipo: i.tipo || '', potencia: i.potencia || 0 },
      qtd: i.qtd || 1
    };
  });

  const itensBateria = bateriasSnap.map(b => {
    const real = bateriasCat.find(cat => cat.id == b.id);
    if(!real) itensNaoEncontrados++;
    return {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      bateria: real || { id: b.id || '', nome: b.nome || '', tipo: b.tipo || '', capacidade: b.capacidade || 0 },
      qtd: b.qtd || 1
    };
  });

  const itensOutros = outrosSnap.map(e => {
    const real = outrosCat.find(cat => cat.id == e.id);
    if(!real) itensNaoEncontrados++;
    return {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      outros: real || { id: e.id || '', nome: e.nome || '', modelo: e.modelo || '', categoria: e.categoria || '', garantia: e.garantia || '' },
      qtd: e.qtd || 1
    };
  });

  const itensMateriais = materiais.map(m => ({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    descricao: m.descricao || '',
    qtd: m.qtd || 1,
    unidade: m.unidade || 'UNI',
    valorUnit: m.valorUnit || 0,
    mostrarProposta: true
  }));

  return { itensPlaca, itensInversor, itensBateria, itensOutros, itensMateriais, itensNaoEncontrados };
}
window.reconstruirItensDoHistorico = reconstruirItensDoHistorico;

// ============================================================
// Busca o CLIENTE e o VENDEDOR de verdade no cadastro (por id),
// em vez de usar só o nome congelado que fica salvo na linha do
// orçamento (cliente_nome/vendedor_nome). Sem isso, OS.cliente e
// OS.vendedor ficavam só com {id, nome} — faltava CPF, telefone,
// endereço, e-mail, código do vendedor etc, que os documentos e a
// proposta completa precisam. Mesmo padrão de fallback já usado
// pra placas/inversores/baterias: se o registro não existir mais
// no cadastro (foi excluído), cai pro snapshot {id, nome}.
// ============================================================
async function _resolverClienteVendedorHistorico(o){
  const [clientesCat, vendedoresCat] = await Promise.all([
    apiGetCached('/clientes'),
    apiGetCached('/configuracoes/vendedores'),
  ]);

  let cliente = null;
  if(o.cliente_id){
    const real = clientesCat.find(c => c.id == o.cliente_id);
    cliente = real || { id: o.cliente_id, nome: o.cliente_nome || '' };
  }

  let vendedor = null;
  if(o.vendedor_id){
    const real = vendedoresCat.find(v => v.id == o.vendedor_id);
    vendedor = real || { id: o.vendedor_id, nome: o.vendedor_nome || '' };
  }

  return { cliente, vendedor };
}
window._resolverClienteVendedorHistorico = _resolverClienteVendedorHistorico;

// ============================================================
// IMPORTAR ORÇAMENTO DO HISTÓRICO PARA O FORMULÁRIO
// ============================================================
async function importarOrcamentoHistorico(o){
  toast('Importando orçamento...', 'info', 1500);

  const [{ itensPlaca, itensInversor, itensBateria, itensOutros, itensMateriais, itensNaoEncontrados }, { cliente, vendedor }] = await Promise.all([
    reconstruirItensDoHistorico(o),
    _resolverClienteVendedorHistorico(o),
  ]);

  // Estrutura
  const estrutura = o.estrutura_id ? { 
    id: o.estrutura_id, 
    nome: o.estrutura_nome || '',
    tipo: o.estrutura_tipo || '',
    imagem_url: o.estrutura_imagem || ''
  } : null;

  // Resultado (valores e taxas do orçamento salvo)
  const resultado = {
    potenciaKit: +o.potencia_kit || 0,
    geracaoReal: +o.geracao_estimada || 0,
    qtdPlacasTotal: +o.quantidade_placas || 0,
    qtdInversoresTotal: +o.quantidade_inversores || 0,
    qtdBateriasTotal: +o.quantidade_baterias || 0,
    totalMateriais: +o.total_materiais || 0,
    valorForn: +o.valor_fornecimento || 0,
    imposto: +o.imposto_percentual || 0,
    margem: +o.margem_percentual || 0,
    reajuste: +o.reajuste || 0,
    desconto: +o.desconto || 0,
    acrescimo: +o.acrescimo || 0,
    frete: +o.frete || 0,
    valorEquipamentos: +o.valor_equipamentos || 0,
    totalGeral: +o.valor_final || 0,
  };

  // 🔴 PREENCHE O OS COM TODOS OS DADOS
  OS.itensPlaca = itensPlaca;
  OS.itensInversor = itensInversor;
  OS.itensBateria = itensBateria;
  OS.itensOutros = itensOutros;  // 🔴 NOVO
  OS.itensMateriais = itensMateriais;
  OS.cliente = cliente;
  OS.vendedor = vendedor;
  OS.estrutura = estrutura;
  OS.resultado = resultado;

  // 🔴 CORREÇÃO: valores e taxas vão pelo prefill — os campos do formulário
  // só existem depois que pageOrcamento() renderizar (após o Router.go abaixo),
  // então setar document.getElementById aqui não tinha efeito nenhum. O
  // pageOrcamento() lê OS.prefill e aplica nos inputs assim que a tela abre.
  OS.prefill = {
    geracao: resultado.geracaoReal,
    valorSugerido: resultado.totalGeral,
    fonte: 'historico',
    valorForn: resultado.valorForn,
    imposto: resultado.imposto,
    margem: resultado.margem,
    reajuste: resultado.reajuste,
    desconto: resultado.desconto,
    acrescimo: resultado.acrescimo,
    frete: resultado.frete,
  };

  const avisoItens = itensNaoEncontrados > 0
    ? ` ⚠️ ${itensNaoEncontrados} item(ns) não encontrado(s) no catálogo atual (pode ter sido excluído) — dados básicos foram mantidos.`
    : '';
  toast(`✅ Orçamento importado! ${itensPlaca.length} placa(s), ${itensInversor.length} inversor(es), ${itensOutros.length} outro(s), ${itensMateriais.length} material(is).${avisoItens}`, itensNaoEncontrados > 0 ? 'warning' : 'success', 5000);
  
  // Navega para o orçamento
  Router.go('/orcamento');
}
window.importarOrcamentoHistorico = importarOrcamentoHistorico;

// ============================================================
// RECONSTRUIR DADOS DO HISTÓRICO PARA VISUALIZAÇÃO
// ============================================================
async function montarDadosPropostaHistorico(o){
  const [{ itensPlaca, itensInversor, itensBateria, itensOutros, itensMateriais }, { cliente, vendedor }] = await Promise.all([
    reconstruirItensDoHistorico(o),
    _resolverClienteVendedorHistorico(o),
  ]);

  const data = {
    itensPlaca,
    itensInversor,
    itensBateria,
    itensOutros,
    itensMateriais,
    cliente,
    vendedor,
    estrutura: o.estrutura_nome ? { 
      nome:o.estrutura_nome, 
      id: o.estrutura_id,
      tipo: o.estrutura_tipo || '',
      imagem_url: o.estrutura_imagem || ''
    } : null,
    codigoProposta: o.codigo_proposta || '',
    _readonly: true,
    resultado: {
      potenciaKit: +o.potencia_kit || 0, 
      geracaoReal: +o.geracao_estimada || 0,
      qtdPlacasTotal: +o.quantidade_placas || 0,
      qtdInversoresTotal: +o.quantidade_inversores || 0,
      qtdBateriasTotal: +o.quantidade_baterias || 0,
      totalMateriais: +o.total_materiais || 0, 
      valorEquipamentos: +o.valor_equipamentos || 0,
      valorForn: +o.valor_fornecimento || 0,
      imposto: +o.imposto_percentual || 0,
      margem: +o.margem_percentual || 0,
      reajuste: +o.reajuste || 0,
      desconto: +o.desconto || 0,
      acrescimo: +o.acrescimo || 0,
      frete: +o.frete || 0,
      totalGeral: +o.valor_final || 0,
    }
  };

  return data;
}
window.montarDadosPropostaHistorico = montarDadosPropostaHistorico;

// Mantido por compatibilidade (abre direto a versão resumida)
async function reabrirPropostaHistorico(o){
  const data = await montarDadosPropostaHistorico(o);
  if(typeof abrirProposta === 'function') abrirProposta(data);
}
window.reabrirPropostaHistorico = reabrirPropostaHistorico;

// ============================================================
// ESCOLHA: PROPOSTA RESUMIDA OU COMPLETA (ao clicar em "Ver proposta")
// ============================================================
async function abrirEscolhaProposta(o){
  toast('Carregando orçamento...', 'info', 1500);
  const data = await montarDadosPropostaHistorico(o);

  openModal({
    id: 'escolhaPropostaModal',
    title: 'Ver proposta',
    sub: 'Escolha o formato para visualizar este orçamento salvo',
    width: 460,
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">
        <button class="btn btn-secondary btn-block" id="btnVerResumida" style="justify-content:flex-start;padding:14px 16px;height:auto">
          <div style="display:flex;align-items:center;gap:12px;text-align:left">
            <div class="icon-sm">${icon('file-text')}</div>
            <div>
              <div style="font-weight:700">Proposta resumida</div>
              <div style="font-size:11.5px;color:var(--text-faint);font-weight:400">Uma página, com o essencial — cliente, equipamentos e valor total</div>
            </div>
          </div>
        </button>
        <button class="btn btn-primary btn-block" id="btnVerCompleta" style="justify-content:flex-start;padding:14px 16px;height:auto">
          <div style="display:flex;align-items:center;gap:12px;text-align:left">
            <div class="icon-sm">${icon('layout-template')}</div>
            <div>
              <div style="font-weight:700">Proposta completa (6 folhas)</div>
              <div style="font-size:11.5px;font-weight:400;opacity:.85">Capa, itens, payback, financiamento, estrutura e legislação</div>
            </div>
          </div>
        </button>
      </div>
    `
  });
  refreshIcons();

  document.getElementById('btnVerResumida').addEventListener('click', () => {
    closeModal('escolhaPropostaModal');
    if(typeof abrirProposta === 'function') abrirProposta(data);
  });
  document.getElementById('btnVerCompleta').addEventListener('click', () => {
    closeModal('escolhaPropostaModal');
    // salvarHistorico:false — é só reabertura de um orçamento já salvo,
    // não deve criar um novo registro duplicado no histórico.
    if(typeof abrirPropostaCompleta === 'function') abrirPropostaCompleta({ ...data, salvarHistorico:false });
  });
}
window.abrirEscolhaProposta = abrirEscolhaProposta;
