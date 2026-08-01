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
  const [placas, inversores, baterias, clientes, logs, orcamentos, estruturas, vendedores] = await Promise.all([
    apiGetCached('/equipamentos/placas'), 
    apiGetCached('/equipamentos/inversores'),
    apiGetCached('/equipamentos/baterias'), 
    apiGetCached('/clientes'), 
    apiGetCached('/log'), 
    apiGetCached('/orcamentos'),
    apiGetCached('/configuracoes/estruturas'),
    apiGetCached('/configuracoes/vendedores')
  ]);

  const potenciaMedia = placas.length ? placas.reduce((a,p)=>a+(+p.potencia||0),0)/placas.length : 0;
  const orcamentosRecentes = (Array.isArray(orcamentos) ? orcamentos : []).slice(0, 30);
  const valorTotalRecente = orcamentosRecentes.reduce((acc,o) => acc + (+o.valor_final || 0), 0);

  view.innerHTML = `
    <div class="view-head">
      <div>
        <h1>Bem-vindo de volta ⚡</h1>
        <p>Aqui está o pulso do seu catálogo e das suas propostas.</p>
      </div>
      <div class="view-head-actions">
        <button class="btn btn-secondary" data-go="/gerador">${icon('sparkles')} Gerar Kits</button>
        <button class="btn btn-primary" data-go="/orcamento">${icon('banknote')} Novo Orçamento</button>
      </div>
    </div>

    <div class="grid grid-4">
      ${statCard('Placas Cadastradas', placas.length, 'grid-3x2', 'var(--amber)')}
      ${statCard('Inversores', inversores.length, 'zap', 'var(--blue)')}
      ${statCard('Baterias', baterias.length, 'battery-full', 'var(--green)')}
      ${statCard('Clientes', clientes.length, 'contact', 'var(--purple)')}
    </div>

    <div class="grid grid-2 mt-20">
      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('activity')}</div>
          <div><h3>Potência média das placas</h3><div class="sub">Baseado em ${placas.length} módulo(s) cadastrado(s)</div></div>
        </div>
        <div style="font-size:34px;font-weight:800;">${formatarNumero(potenciaMedia,0)} <span style="font-size:15px;color:var(--text-faint);font-weight:600">W</span></div>
        <div class="progress-bar mt-16"><div style="width:${Math.min(100,(potenciaMedia/700)*100)}%"></div></div>
        <p class="text-faint mt-8" style="font-size:11.5px;">Módulos atuais no mercado variam entre 400W e 700W+.</p>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('trending-up')}</div>
          <div><h3>Últimos orçamentos gerados</h3><div class="sub">${orcamentosRecentes.length} registro(s) recentes · soma R$</div></div>
        </div>
        <div style="font-size:34px;font-weight:800;color:var(--green)">${formatarMoeda(valorTotalRecente)}</div>
        <p class="text-faint mt-8" style="font-size:11.5px;">Somatório dos valores dos últimos orçamentos registrados no histórico.</p>
      </div>
    </div>

    <div class="grid grid-3 mt-20">
      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('building-2')}</div>
          <div><h3>Estruturas</h3><div class="sub">${estruturas.length} cadastrada(s)</div></div>
        </div>
        <div class="detail-line" style="font-size:12px;">
          <span>Última:</span>
          <span>${estruturas.length ? estruturas[estruturas.length-1].nome : 'Nenhuma'}</span>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('users')}</div>
          <div><h3>Vendedores</h3><div class="sub">${vendedores.length} cadastrado(s)</div></div>
        </div>
        <div class="detail-line" style="font-size:12px;">
          <span>Último:</span>
          <span>${vendedores.length ? vendedores[vendedores.length-1].nome : 'Nenhum'}</span>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="ico">${icon('package')}</div>
          <div><h3>Materiais no orçamento</h3><div class="sub">Itens avulsos cadastrados</div></div>
        </div>
        <div class="detail-line" style="font-size:12px;">
          <span>Disponíveis:</span>
          <span>Adicione no orçamento</span>
        </div>
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

  Router.start();
  console.log('%c⚡ Solar Pro 2.0 pronto!', 'color:#22d3a0;font-weight:bold;font-size:13px');
});
