// ============================================================
// SOLAR PRO 2.0 — app.js
// Bootstrap da aplicação: shell (sidebar/topbar) + página Dashboard.
// ============================================================

const NAV_ITEMS = [
  { section:'Vender' },
  { route:'/dashboard', icon:'layout-dashboard', label:'Visão Geral' },
  { route:'/orcamento', icon:'banknote', label:'Orçamento' },
  { route:'/gerador', icon:'sparkles', label:'Gerador de Kits' },
  { section:'Catálogo' },
  { route:'/cadastro/placas', icon:'grid-3x2', label:'Placas' },
  { route:'/cadastro/inversores', icon:'zap', label:'Inversores' },
  { route:'/cadastro/baterias', icon:'battery-full', label:'Baterias' },
  { route:'/cadastro/outros', icon:'package', label:'Outros Equip.' },
  { route:'/cadastro/clientes', icon:'contact', label:'Clientes' },
  { section:'Configurações' },
  { route:'/configuracoes/proposta', icon:'palette', label:'Proposta' },
  { route:'/configuracoes/calculo', icon:'calculator', label:'Cálculo' },
  { route:'/configuracoes/estruturas', icon:'building-2', label:'Estruturas' },
  { route:'/configuracoes/vendedores', icon:'users', label:'Vendedores' },
  { route:'/cadastro/materiais', icon:'receipt', label:'Materiais/Serviços' },
  { section:'Gestão' },
  { route:'/acompanhamento', icon:'kanban', label:'Acompanhamento' },
  { route:'/documentos', icon:'file-signature', label:'Modelos de Documento' },
  { route:'/historico', icon:'folder-clock', label:'Histórico' },
];

function renderShell(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <button class="sidebar-toggle" id="sidebarToggle">${icon('chevron-left', 'id="sidebarToggleIcon"')}</button>
        <div class="brand">
          <div class="brand-mark">${icon('sun')}</div>
          <div class="brand-text">
            <h1>Solar Pro</h1>
            <p>2.0 · Orçamentos</p>
          </div>
        </div>
        <nav class="nav-scroll" id="navScroll"></nav>
        <div class="sidebar-foot">
          <div class="sync-row"><span class="sync-dot"></span><span>Sincronizado com Drive</span></div>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="btn btn-icon btn-ghost mobile-toggle" id="mobileToggle">${icon('menu')}</button>
          <div class="topbar-title" id="topbarTitle"><h2>Visão Geral</h2><p>Carregando…</p></div>
          <div class="search-trigger" id="searchTrigger">
            ${icon('search')}<span>Buscar ou navegar...</span><span class="kbd">Ctrl K</span>
          </div>
          <div class="topbar-actions">
            <button class="btn btn-icon btn-ghost" id="btnRefreshAll" title="Atualizar dados">${icon('refresh-cw')}</button>
            <button class="btn btn-primary btn-sm" id="btnNovoOrc">${icon('plus')} Novo Orçamento</button>
          </div>
        </header>
        <main class="view" id="view"></main>
      </div>
    </div>
  `;

  const nav = document.getElementById('navScroll');
  nav.innerHTML = NAV_ITEMS.map(item => {
    if(item.section) return `<div class="nav-section-title">${item.section}</div>`;
    return `<div class="nav-item" data-route="${item.route}">${icon(item.icon)}<span class="nav-label">${item.label}</span></div>`;
  }).join('');
  nav.querySelectorAll('.nav-item[data-route]').forEach(el => {
    el.addEventListener('click', () => Router.go(el.getAttribute('data-route')));
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    document.getElementById('sidebarToggleIcon').setAttribute('data-lucide', sb.classList.contains('collapsed') ? 'chevron-right' : 'chevron-left');
    refreshIcons();
  });
  document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });
  document.getElementById('searchTrigger').addEventListener('click', openCommandPalette);
  document.getElementById('btnNovoOrc').addEventListener('click', () => Router.go('/orcamento'));
  document.getElementById('btnRefreshAll').addEventListener('click', async () => {
    invalidateCache();
    toast('Dados atualizados a partir do servidor', 'success', 2000);
    await Router.render(location.hash.slice(1) || '/dashboard');
  });

  refreshIcons();
}

// ---------------------------------------------------------------
// DASHBOARD — página nova (não existia na v1)
// ---------------------------------------------------------------
async function pageDashboard(){
  const view = document.getElementById('view');
  const [placas, clientes, logs, orcamentos, acompanhamentos] = await Promise.all([
    apiGetCached('/equipamentos/placas'),
    apiGetCached('/clientes'),
    apiGetCached('/log'),
    apiGetCached('/orcamentos'),
    apiGetCached('/acompanhamentos'),
  ]);

  const potenciaMedia = placas.length ? placas.reduce((a,p)=>a+(+p.potencia||0),0)/placas.length : 0;
  const orcamentosRecentes = (Array.isArray(orcamentos) ? orcamentos : []).slice(0, 30);
  const valorTotalRecente = orcamentosRecentes.reduce((acc,o) => acc + (+o.valor_final || 0), 0);
  const listaAcomp = Array.isArray(acompanhamentos) ? acompanhamentos : [];

  // Etapa 5 (V3) — Resumo do pipeline: conta quantos acompanhamentos
  // ativos estão em cada macro-coluna (mesma classificação do Kanban
  // da Etapa 3 — reaproveita ACOMP_MACRO_COLUNAS/acompColunaAtual de
  // acompanhamento.js, sem duplicar a lógica).
  const ativosPipeline = listaAcomp.filter(a => a.status_geral !== 'cancelado');
  const contagemColuna = Object.fromEntries(ACOMP_MACRO_COLUNAS.map(c => [c, 0]));
  ativosPipeline.forEach(a => { contagemColuna[acompColunaAtual(a)]++; });
  const maxColuna = Math.max(1, ...Object.values(contagemColuna));

  // Etapa 5 (V3) — Pendências/atrasos: top 5 acompanhamentos atrasados
  // (usa etapaAtrasada/acompanhamentoTemAtraso da Etapa 4, em core.js).
  const atrasados = ativosPipeline.filter(acompanhamentoTemAtraso).slice(0, 5);

  // Etapa 5 (V3) — Conversão: dos últimos orçamentos exibidos no
  // Histórico (mesmo recorte que já existia aqui), quantos já viraram
  // acompanhamento. getOrcamentos() é limitado aos últimos 50 (ver
  // getOrcamentosJoined no GAS), então a taxa é "dos recentes", não
  // do total histórico — por isso o rótulo deixa isso explícito.
  const idsComAcompanhamento = new Set(listaAcomp.map(a => String(a.orcamento_id)));
  const convertidos = orcamentosRecentes.filter(o => idsComAcompanhamento.has(String(o.id))).length;
  const taxaConversao = orcamentosRecentes.length ? (convertidos / orcamentosRecentes.length) * 100 : 0;

  view.innerHTML = `
    <div class="view-head">
      <div>
        <h1>Bem-vindo de volta ⚡</h1>
        <p>Aqui está o pulso do seu negócio.</p>
      </div>
      <div class="view-head-actions">
        <button class="btn btn-secondary" data-go="/gerador">${icon('sparkles')} Gerar Kits</button>
        <button class="btn btn-primary" data-go="/orcamento">${icon('banknote')} Novo Orçamento</button>
      </div>
    </div>

    <div class="dash-strip mt-16">
      <div class="dash-strip-item"><span class="v">${placas.length}</span><span class="l">Placas cadastradas</span></div>
      <div class="dash-strip-item"><span class="v">${clientes.length}</span><span class="l">Clientes</span></div>
      <div class="dash-strip-item"><span class="v">${formatarNumero(potenciaMedia,0)}W</span><span class="l">Potência média das placas</span></div>
    </div>

    <div class="grid grid-2 mt-20">
      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('kanban')}</div>
          <div class="grow"><h3>Resumo do pipeline</h3><div class="sub">${ativosPipeline.length} projeto(s) em execução</div></div>
          <button class="btn btn-ghost btn-sm" data-go="/acompanhamento">Ver Kanban ${icon('arrow-right')}</button>
        </div>
        ${ativosPipeline.length ? `
        <div style="display:flex;flex-direction:column;gap:9px">
          ${ACOMP_MACRO_COLUNAS.map(col => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px">
                <span>${col}</span><span class="text-faint">${contagemColuna[col]}</span>
              </div>
              <div class="progress-bar"><div style="width:${(contagemColuna[col]/maxColuna)*100}%"></div></div>
            </div>
          `).join('')}
        </div>` : `<div class="empty-state">${icon('inbox')}<p>Nenhum projeto no pipeline ainda</p></div>`}
      </div>

      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('alert-triangle')}</div>
          <div class="grow"><h3>Pendências / atrasos</h3><div class="sub">${atrasados.length} de ${ativosPipeline.length} projeto(s) com etapa atrasada</div></div>
        </div>
        <div class="data-grid">
          ${atrasados.length ? atrasados.map(a => `
            <div class="item-row" style="cursor:pointer" data-abrir-pendencia="${a.id}">
              <div class="icon-sm">${icon('alert-triangle')}</div>
              <div class="main">
                <div class="title">${a.cliente_nome || a.orcamento_nome_arquivo || `Projeto #${a.id}`}</div>
                <div class="subtitle">Etapa atual: ${(a.etapas || []).find(e => e.status !== 'concluido')?.nome_etapa || '—'}</div>
              </div>
              <span class="badge badge-red">Atrasado</span>
            </div>
          `).join('') : `<div class="empty-state">${icon('circle-check')}<p>Nenhuma pendência no momento 🎉</p></div>`}
        </div>
      </div>
    </div>

    <div class="grid grid-2 mt-20">
      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('trending-up')}</div>
          <div><h3>Últimos orçamentos gerados</h3><div class="sub">${orcamentosRecentes.length} registro(s) recentes · soma R$</div></div>
        </div>
        <div style="font-size:34px;font-weight:800;color:var(--green)">${formatarMoeda(valorTotalRecente)}</div>
        <p class="text-faint mt-8" style="font-size:11.5px;">Somatório dos valores dos últimos orçamentos registrados no histórico.</p>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('percent')}</div>
          <div><h3>Conversão de propostas</h3><div class="sub">Dos últimos ${orcamentosRecentes.length} orçamento(s)</div></div>
        </div>
        <div style="font-size:34px;font-weight:800;">${formatarNumero(taxaConversao,0)}<span style="font-size:15px;color:var(--text-faint);font-weight:600">%</span></div>
        <div class="progress-bar mt-16"><div style="width:${taxaConversao}%"></div></div>
        <p class="text-faint mt-8" style="font-size:11.5px;">${convertidos} de ${orcamentosRecentes.length} viraram acompanhamento (negócio fechado).</p>
      </div>
    </div>

    <div class="card mt-20">
      <div class="card-head">
        <div class="ico">${icon('folder-clock')}</div>
        <div class="grow"><h3>Atividade recente</h3><div class="sub">Últimas ações registradas no sistema</div></div>
        <button class="btn btn-ghost btn-sm" data-go="/historico">Ver tudo ${icon('arrow-right')}</button>
      </div>
      <div class="data-grid">
        ${(logs||[]).slice(-6).reverse().map(l => `
          <div class="item-row">
            <div class="icon-sm">${icon('zap')}</div>
            <div class="main">
              <div class="title">${l.acao || 'Ação registrada'}</div>
              <div class="subtitle">${fmtDate(l.data_registro)}</div>
            </div>
          </div>
        `).join('') || `<div class="empty-state">${icon('inbox')}<p>Nenhuma atividade registrada ainda</p></div>`}
      </div>
    </div>
  `;
  view.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => Router.go(el.getAttribute('data-go'))));

  // Etapa 5 (V3): clicar numa pendência manda pro Kanban já com a
  // gaveta de detalhe daquele projeto aberta (não só destacada).
  view.querySelectorAll('[data-abrir-pendencia]').forEach(el => el.addEventListener('click', () => {
    window._acompHighlightId = el.getAttribute('data-abrir-pendencia');
    window._acompAutoOpenId = el.getAttribute('data-abrir-pendencia');
    Router.go('/acompanhamento');
  }));
}
function statCard(label, value, ic, color){
  return `
    <div class="stat" style="--stat-color:${color}">
      <div class="ico-badge">${icon(ic)}</div>
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>`;
}
window.statCard = statCard;

// ---------------------------------------------------------------
// BOOTSTRAP
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  renderShell();

  // Registro de todas as rotas
  Router.register('/dashboard', pageDashboard);
  Router.register('/orcamento', window.pageOrcamento);
  Router.register('/gerador', window.pageGerador);
  Router.register('/cadastro', () => Router.go('/cadastro/placas'));
  Router.register('/cadastro/placas', () => window.pageCadastro('placas'));
  Router.register('/cadastro/inversores', () => window.pageCadastro('inversores'));
  Router.register('/cadastro/baterias', () => window.pageCadastro('baterias'));
  Router.register('/cadastro/outros', () => window.pageCadastro('outros_equipamentos'));
  Router.register('/cadastro/clientes', () => window.pageCadastro('clientes'));
  Router.register('/configuracoes', () => Router.go('/configuracoes/proposta'));
  Router.register('/configuracoes/proposta', window.pagePersonalizacaoProposta);
  Router.register('/configuracoes/calculo', window.pageConfiguracoesCalculo);
  Router.register('/configuracoes/estruturas', () => window.pageConfiguracoes('estruturas'));
  Router.register('/configuracoes/vendedores', () => window.pageConfiguracoes('vendedores'));
  Router.register('/configuracoes/fornecedores', () => window.pageConfiguracoes('fornecedores'));
  Router.register('/cadastro/materiais', () => window.pageCadastro('materiais'));
  Router.register('/documentos', window.pageDocumentos);
  Router.register('/historico', window.pageHistorico);
  Router.register('/acompanhamento', window.pageAcompanhamento);

  Router.start();
  console.log('%c⚡ Solar Pro 2.0 pronto!', 'color:#22d3a0;font-weight:bold;font-size:13px');
});
