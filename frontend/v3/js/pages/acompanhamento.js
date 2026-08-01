// ============================================================
// SOLAR PRO 2.0 — pages/acompanhamento.js  (Etapa 3 do roadmap V3)
// Kanban do pipeline de execução dos projetos + gaveta de detalhe
// com o checklist completo de etapas.
//
// Depende do modelo de dados da Etapa 2 (tipos_servico,
// acompanhamentos, acompanhamento_etapas) e do vínculo cliente↔projeto
// da Etapa 1 (usado na gaveta pra listar todos os participantes).
// ============================================================

// ---------------------------------------------------------------
// MACRO-COLUNAS — agrupar por etapa individual ficaria granular
// demais; cada nome de etapa (texto livre, definido em Tipos de
// Serviço) é classificado numa destas 5 colunas fixas por palavra-chave.
// ---------------------------------------------------------------
const ACOMP_MACRO_COLUNAS = ['Documentação', 'Projeto/Execução', 'Protocolo/Vistoria', 'Pagamento', 'Concluído'];

const ACOMP_MACRO_KEYWORDS = {
  'Documentação':        ['contrato', 'assinatura', 'document', 'art'],
  'Projeto/Execução':    ['projeto', 'memorial', 'fornecedor', 'compra', 'instala'],
  'Protocolo/Vistoria':  ['protocolo', 'concession', 'vistoria', 'homolog'],
  'Pagamento':           ['pagamento', 'fatura', 'cobran'],
  'Concluído':           ['encerramento', 'conclu', 'finaliza'],
};

function acompMacroColunaDaEtapa(nomeEtapa){
  const n = (nomeEtapa || '').toLowerCase();
  for (const col of ACOMP_MACRO_COLUNAS){
    if (ACOMP_MACRO_KEYWORDS[col].some(k => n.includes(k))) return col;
  }
  return 'Projeto/Execução'; // fallback neutro pra etapa sem palavra-chave reconhecida
}

// Etapa "atual" de um acompanhamento = primeira não concluída, na ordem.
// Se todas concluídas (ou não há etapas), cai em "Concluído".
function acompEtapaAtual(acomp){
  const etapas = acomp.etapas || [];
  return etapas.find(e => e.status !== 'concluido') || null;
}

function acompColunaAtual(acomp){
  const atual = acompEtapaAtual(acomp);
  if (!atual) return 'Concluído';
  return acompMacroColunaDaEtapa(atual.nome_etapa);
}

// ---------------------------------------------------------------
// ATRASO — helper canônico mora em core.js desde a Etapa 4
// (etapaAtrasada/acompanhamentoTemAtraso), reaproveitado aqui pelo
// badge do card e pelo dashboard (Etapa 5). Aliases mantidos pra não
// precisar trocar todas as chamadas já escritas neste arquivo.
// ---------------------------------------------------------------
const acompEtapaAtrasada = etapaAtrasada;
const acompTemAtraso = acompanhamentoTemAtraso;

let _acompState = { acompanhamentos: [], tiposServico: [], vendedores: [], clientes: [] };

async function pageAcompanhamento(){
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando Acompanhamento...</div>`;

  const [acompanhamentos, tiposServico, vendedores, clientes] = await Promise.all([
    apiGetCached('/acompanhamentos'),
    apiGetCached('/configuracoes/tipos_servico'),
    apiGetCached('/configuracoes/vendedores'),
    apiGetCached('/clientes'),
  ]);
  _acompState.acompanhamentos = Array.isArray(acompanhamentos) ? acompanhamentos : [];
  _acompState.tiposServico = Array.isArray(tiposServico) ? tiposServico : [];
  _acompState.vendedores = Array.isArray(vendedores) ? vendedores : [];
  _acompState.clientes = Array.isArray(clientes) ? clientes : [];

  view.innerHTML = `
    <style>
      .acomp-board{ display:flex; gap:14px; overflow-x:auto; padding-bottom:10px; }
      .acomp-col{ flex:0 0 268px; background:var(--surface-2); border-radius:14px; padding:10px; display:flex; flex-direction:column; gap:8px; max-height:calc(100vh - 220px); }
      .acomp-col-head{ display:flex; align-items:center; justify-content:space-between; padding:4px 6px 8px; font-size:12.5px; font-weight:700; }
      .acomp-col-count{ background:var(--surface-3); color:var(--text-faint); border-radius:99px; padding:1px 8px; font-size:11px; }
      .acomp-col-body{ display:flex; flex-direction:column; gap:8px; overflow-y:auto; }
      .acomp-card{ background:var(--surface); border:1px solid var(--border-soft); border-radius:10px; padding:10px 11px; cursor:pointer; transition:border-color .15s; }
      .acomp-card:hover{ border-color:var(--accent, #E8672B); }
      .acomp-card .t{ font-size:12.5px; font-weight:700; margin-bottom:3px; }
      .acomp-card .s{ font-size:11px; color:var(--text-faint); margin-bottom:2px; }
      .acomp-card .etapa-atual{ font-size:11px; margin-top:6px; padding:3px 8px; background:var(--surface-3); border-radius:99px; display:inline-block; }
      .acomp-card .btn-avancar{ width:100%; margin-top:8px; }
      .acomp-empty-col{ font-size:11px; color:var(--text-faint); text-align:center; padding:14px 4px; }
      .acomp-card.acomp-destaque{ animation: acompPulso 1.6s ease-in-out 2; border-color:var(--accent, #E8672B) !important; }
      @keyframes acompPulso{ 0%,100%{ box-shadow:0 0 0 0 rgba(232,103,43,.4); } 50%{ box-shadow:0 0 0 6px rgba(232,103,43,0); } }
    </style>

    <div class="view-head">
      <div><h1>Acompanhamento</h1><p>${_acompState.acompanhamentos.filter(a => a.status_geral !== 'concluido' && a.status_geral !== 'cancelado').length} projeto(s) em andamento</p></div>
      <div class="view-head-actions">
        <button class="btn btn-ghost" id="btnRefreshAcomp">${icon('refresh-cw')} Atualizar</button>
      </div>
    </div>

    <div class="acomp-board" id="acompBoard"></div>
  `;
  refreshIcons();

  renderAcompBoard();

  document.getElementById('btnRefreshAcomp').addEventListener('click', () => {
    invalidateCache('/acompanhamentos');
    toast('Atualizando...', 'info', 1500);
    pageAcompanhamento();
  });
}
window.pageAcompanhamento = pageAcompanhamento;

function renderAcompBoard(){
  const board = document.getElementById('acompBoard');
  if(!board) return;

  const ativos = _acompState.acompanhamentos.filter(a => a.status_geral !== 'cancelado');
  const porColuna = Object.fromEntries(ACOMP_MACRO_COLUNAS.map(c => [c, []]));
  ativos.forEach(a => { porColuna[acompColunaAtual(a)].push(a); });

  board.innerHTML = ACOMP_MACRO_COLUNAS.map(col => `
    <div class="acomp-col">
      <div class="acomp-col-head"><span>${col}</span><span class="acomp-col-count">${porColuna[col].length}</span></div>
      <div class="acomp-col-body">
        ${porColuna[col].length
          ? porColuna[col].map(a => renderAcompCard(a)).join('')
          : `<div class="acomp-empty-col">Nenhum projeto aqui</div>`}
      </div>
    </div>
  `).join('');
  refreshIcons();

  board.querySelectorAll('[data-abrir-acomp]').forEach(el => el.addEventListener('click', (e) => {
    if(e.target.closest('[data-avancar-acomp]')) return; // botão avançar tem seu próprio handler
    const acomp = _acompState.acompanhamentos.find(a => String(a.id) === el.dataset.abrirAcomp);
    if(acomp) abrirGavetaAcompanhamento(acomp);
  }));
  board.querySelectorAll('[data-avancar-acomp]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const acomp = _acompState.acompanhamentos.find(a => String(a.id) === btn.dataset.avancarAcomp);
    if(acomp) await avancarEtapaAcompanhamento(acomp);
  }));

  // Etapa 4 (V3): destaca o card recém-criado ao vir do gatilho
  // "Fechar negócio → Iniciar acompanhamento" no Histórico.
  if(window._acompHighlightId){
    const cardEl = board.querySelector(`[data-abrir-acomp="${window._acompHighlightId}"]`);
    if(cardEl){
      cardEl.classList.add('acomp-destaque');
      cardEl.scrollIntoView({ behavior:'smooth', block:'center' });
    }
    window._acompHighlightId = null;
  }

  // Etapa 5 (V3): veio do card de Pendências/atrasos do Dashboard —
  // abre a gaveta de detalhe direto, sem precisar clicar no card.
  if(window._acompAutoOpenId){
    const acomp = _acompState.acompanhamentos.find(a => String(a.id) === String(window._acompAutoOpenId));
    if(acomp) abrirGavetaAcompanhamento(acomp);
    window._acompAutoOpenId = null;
  }
}

function renderAcompCard(acomp){
  const tipo = _acompState.tiposServico.find(t => String(t.id) === String(acomp.tipo_servico_id));
  const atual = acompEtapaAtual(acomp);
  const atrasado = acompTemAtraso(acomp);

  let endereco = '';
  try {
    const ep = JSON.parse(acomp.orcamento_endereco_projeto_json || '{}');
    endereco = [ep.logradouro, ep.numero, ep.cidade].filter(Boolean).join(', ');
  } catch(e){ /* sem endereço de projeto salvo — segue sem quebrar */ }

  return `
    <div class="acomp-card" data-abrir-acomp="${acomp.id}">
      <div class="t">${acomp.cliente_nome || acomp.orcamento_nome_arquivo || `Projeto #${acomp.id}`}</div>
      <div class="s">${tipo?.nome || 'Tipo de serviço não encontrado'}</div>
      ${endereco ? `<div class="s">📍 ${endereco}</div>` : ''}
      ${atrasado ? `<span class="badge badge-red">${icon('alert-triangle')} Etapa atrasada</span>` : ''}
      ${atual ? `<div class="etapa-atual">${atual.nome_etapa}</div>` : `<div class="etapa-atual">✅ Concluído</div>`}
      ${atual ? `<button type="button" class="btn btn-secondary btn-sm btn-avancar" data-avancar-acomp="${acomp.id}">${icon('arrow-right')} Avançar etapa</button>` : ''}
    </div>
  `;
}

// ---------------------------------------------------------------
// AVANÇAR ETAPA — marca a etapa atual como concluída; se houver
// próxima, marca como 'andamento'; se não houver, fecha o
// acompanhamento (status_geral='concluido', data_fim=agora).
// ---------------------------------------------------------------
async function avancarEtapaAcompanhamento(acomp){
  const etapas = (acomp.etapas || []).slice().sort((a,b) => (+a.ordem)-(+b.ordem));
  const idxAtual = etapas.findIndex(e => e.status !== 'concluido');
  if(idxAtual === -1) return;

  const agora = new Date().toISOString();
  const etapaAtual = etapas[idxAtual];
  await apiPut(`/acompanhamentos/${acomp.id}/etapas/${etapaAtual.id}`, { status: 'concluido', data_conclusao: agora });
  etapaAtual.status = 'concluido';
  etapaAtual.data_conclusao = agora;

  const proxima = etapas[idxAtual + 1];
  if(proxima){
    await apiPut(`/acompanhamentos/${acomp.id}/etapas/${proxima.id}`, { status: 'andamento' });
    proxima.status = 'andamento';
    toast(`Etapa concluída! Próxima: ${proxima.nome_etapa}`, 'success');
  } else {
    await apiPut(`/acompanhamentos/${acomp.id}`, { status_geral: 'concluido', data_fim: agora });
    acomp.status_geral = 'concluido';
    acomp.data_fim = agora;
    toast('Projeto concluído! 🎉', 'success');
  }

  invalidateCache('/acompanhamentos');
  renderAcompBoard();
}

// ---------------------------------------------------------------
// GAVETA DE DETALHE — checklist completo, cada etapa editável.
// ---------------------------------------------------------------
async function abrirGavetaAcompanhamento(acomp){
  const tipo = _acompState.tiposServico.find(t => String(t.id) === String(acomp.tipo_servico_id));

  const linhasEtapas = (acomp.etapas || []).slice().sort((a,b) => (+a.ordem)-(+b.ordem)).map(et => `
    <tr data-etapa-row="${et.id}">
      <td style="font-size:12px;font-weight:600">${et.nome_etapa}</td>
      <td>
        <select class="select" data-f="status" style="font-size:12px">
          <option value="pendente" ${et.status==='pendente'?'selected':''}>Pendente</option>
          <option value="andamento" ${et.status==='andamento'?'selected':''}>Em andamento</option>
          <option value="concluido" ${et.status==='concluido'?'selected':''}>Concluído</option>
          <option value="bloqueado" ${et.status==='bloqueado'?'selected':''}>Bloqueado</option>
        </select>
      </td>
      <td><input class="input" type="date" data-f="data_prevista" value="${(et.data_prevista||'').substring(0,10)}" style="font-size:12px"></td>
      <td><input class="input" type="date" data-f="data_conclusao" value="${(et.data_conclusao||'').substring(0,10)}" style="font-size:12px"></td>
      <td>
        <select class="select" data-f="responsavel_id" style="font-size:12px">
          <option value="">—</option>
          ${_acompState.vendedores.map(v => `<option value="${v.id}" ${String(et.responsavel_id)===String(v.id)?'selected':''}>${v.nome}</option>`).join('')}
        </select>
      </td>
      <td><input class="input" data-f="observacao" value="${(et.observacao||'').replace(/"/g,'&quot;')}" placeholder="Observação" style="font-size:12px"></td>
      <td><button type="button" class="btn btn-icon btn-ghost btn-sm" data-salvar-etapa="${et.id}" title="Salvar">${icon('check')}</button></td>
    </tr>
  `).join('');

  // Etapa 1: lista todos os participantes do projeto (contratante + extras)
  let participantesHtml = '<div class="text-faint" style="font-size:12px">Carregando participantes...</div>';

  openModal({
    id: 'modalGavetaAcomp',
    title: acomp.cliente_nome || acomp.orcamento_nome_arquivo || `Projeto #${acomp.id}`,
    sub: `${tipo?.nome || 'Tipo de serviço'} · iniciado em ${acomp.data_inicio ? new Date(acomp.data_inicio).toLocaleDateString('pt-BR') : '—'}`,
    width: 880,
    bodyHtml: `
      <div id="gavetaParticipantes" style="margin-bottom:14px">${participantesHtml}</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="text-align:left;color:var(--text-faint);font-size:11px;text-transform:uppercase">
              <th style="padding:6px 8px">Etapa</th><th style="padding:6px 8px">Status</th>
              <th style="padding:6px 8px">Prevista</th><th style="padding:6px 8px">Conclusão</th>
              <th style="padding:6px 8px">Responsável</th><th style="padding:6px 8px">Observação</th><th></th>
            </tr>
          </thead>
          <tbody>${linhasEtapas}</tbody>
        </table>
      </div>
    `,
    footHtml: `
      <button class="btn btn-secondary" id="btnCopiarLinkPublico">${icon('link')} Copiar link do cliente</button>
      <button class="btn btn-secondary" id="btnFecharGavetaAcomp">Fechar</button>
    `
  });
  refreshIcons();

  document.getElementById('btnFecharGavetaAcomp').addEventListener('click', () => closeModal('modalGavetaAcomp'));

  // Etapa 7 (V3): garante (ou reaproveita) o token público e monta o
  // link — funciona tanto pra acompanhamentos novos (já nascem com
  // token) quanto pros antigos, gerados antes desta etapa existir.
  document.getElementById('btnCopiarLinkPublico').addEventListener('click', async () => {
    const btn = document.getElementById('btnCopiarLinkPublico');
    const original = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `${icon('loader')} Gerando link...`; refreshIcons();
    try{
      const result = await apiPost(`/acompanhamentos/${acomp.id}/link-publico`, {});
      if(result && result.token_publico){
        const url = `${window.location.origin}/acompanhamento-publico.html?token=${result.token_publico}`;
        await navigator.clipboard.writeText(url);
        toast('Link copiado! Já pode enviar pro cliente.', 'success');
      } else {
        toast('Não foi possível gerar o link agora.', 'error');
      }
    } catch(e){
      toast('Não foi possível copiar automaticamente — tente novamente.', 'warning');
    } finally {
      btn.disabled = false; btn.innerHTML = original; refreshIcons();
    }
  });

  document.querySelectorAll('[data-salvar-etapa]').forEach(btn => btn.addEventListener('click', async () => {
    const etapaId = btn.dataset.salvarEtapa;
    const row = document.querySelector(`[data-etapa-row="${etapaId}"]`);
    const payload = {};
    row.querySelectorAll('[data-f]').forEach(el => { payload[el.dataset.f] = el.value; });
    btn.disabled = true;
    const result = await apiPut(`/acompanhamentos/${acomp.id}/etapas/${etapaId}`, payload);
    btn.disabled = false;
    if(result){
      toast('Etapa atualizada', 'success');
      invalidateCache('/acompanhamentos');
      const etapaLocal = (acomp.etapas || []).find(e => String(e.id) === String(etapaId));
      if(etapaLocal) Object.assign(etapaLocal, payload);
      renderAcompBoard();
    }
  }));

  // Etapa 1 (V3): busca os participantes vinculados a este orçamento
  apiGet(`/orcamentos/${acomp.orcamento_id}/clientes`).then(vinculos => {
    const wrap = document.getElementById('gavetaParticipantes');
    if(!wrap) return; // gaveta já foi fechada
    if(!Array.isArray(vinculos) || !vinculos.length){
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = vinculos.map(v => {
      const cli = (_acompState.clientes || []).find(c => String(c.id) === String(v.cliente_id));
      const papelLabel = v.papel === 'contratante' ? 'Contratante' : (v.papel === 'titular_conta' ? 'Titular da Conta' : 'Outro');
      return `<span class="badge badge-neutral" style="margin-right:6px">${papelLabel}: ${cli?.nome || `cliente #${v.cliente_id}`}</span>`;
    }).join('');
  }).catch(() => {
    const wrap = document.getElementById('gavetaParticipantes');
    if(wrap) wrap.innerHTML = '';
  });
}

console.log('%c⚡ Solar Pro 2.0 — acompanhamento.js v1.0 (Etapa 3) carregado', 'color:#ffb020;font-weight:bold');
