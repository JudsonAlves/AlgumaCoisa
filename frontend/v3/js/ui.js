// ============================================================
// SOLAR PRO 2.0 — ui.js
// Toasts, modais, router (hash), command palette, helpers de render.
// ============================================================

// ---------------------------------------------------------------
// ICONS (lucide) helper
// ---------------------------------------------------------------
function icon(name, attrs=''){ return `<i data-lucide="${name}" ${attrs}></i>`; }
function refreshIcons(){ if(window.lucide) lucide.createIcons(); }

// ---------------------------------------------------------------
// TOAST
// ---------------------------------------------------------------
function ensureToastWrap(){
  let w = document.getElementById('toastWrap');
  if(!w){ w = document.createElement('div'); w.id='toastWrap'; w.className='toast-wrap'; document.body.appendChild(w); }
  return w;
}
function toast(msg, type='info', ms=4200){
  const wrap = ensureToastWrap();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = type==='success' ? 'check-circle' : type==='error' ? 'alert-circle' : type==='warning' ? 'alert-triangle' : 'info';
  el.innerHTML = `${icon(ic)}<span>${msg}</span>`;
  wrap.appendChild(el);
  refreshIcons();
  setTimeout(() => { el.style.transition='opacity .25s'; el.style.opacity='0'; setTimeout(()=>el.remove(), 250); }, ms);
}
window.toast = toast;
window.mostrarToast = toast; // compat com nomes usados no domínio original

// ---------------------------------------------------------------
// MODAL genérico
// ---------------------------------------------------------------
function openModal({ title, sub='', bodyHtml, footHtml='', width=560, id='dynModal', onClose=null }){
  closeModal(id);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = id;
  backdrop.innerHTML = `
    <div class="modal" style="--modal-w:${width}px">
      <div class="modal-head">
        <div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
        <button class="modal-close" data-close>${icon('x')}</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => { if(e.target === backdrop || e.target.closest('[data-close]')) closeModal(id, onClose); });
  document.addEventListener('keydown', escHandler);
  function escHandler(e){ if(e.key === 'Escape'){ closeModal(id, onClose); document.removeEventListener('keydown', escHandler); } }
  requestAnimationFrame(() => backdrop.classList.add('open'));
  refreshIcons();
  return backdrop;
}
function closeModal(id='dynModal', onClose=null){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove('open');
  setTimeout(() => el.remove(), 180);
  if(onClose) onClose();
}
window.openModal = openModal;
window.closeModal = closeModal;

// ---------------------------------------------------------------
// SELECT-MODAL: escolher item (placa/inversor/bateria/cliente) de uma lista
// ---------------------------------------------------------------
function openPickerModal({ title, items, renderOpt, onPick, emptyMsg='Nenhum item cadastrado', searchKeys=['marca','modelo','nome'] }){
  const bodyId = 'pickList_' + Math.random().toString(36).slice(2,8);
  const searchId = 'pickSearch_' + Math.random().toString(36).slice(2,8);

  function renderList(filter=''){
    const f = filter.trim().toLowerCase();
    const filtered = !f ? items : items.filter(it => searchKeys.some(k => String(it[k]||'').toLowerCase().includes(f)));
    if(filtered.length === 0){
      return `<div class="empty-state">${icon('search-x')}<p>${emptyMsg}</p></div>`;
    }
    return `<div class="pick-grid">${filtered.map((it, i) => renderOpt(it, filtered.indexOf(it))).join('')}</div>`;
  }

  const backdrop = openModal({
    id: 'pickerModal',
    title,
    width: 640,
    bodyHtml: `
      <div class="modal-search">
        <input class="input" id="${searchId}" placeholder="🔎 Buscar por marca ou modelo..." autocomplete="off">
      </div>
      <div id="${bodyId}">${renderList()}</div>
    `
  });

  const listEl = document.getElementById(bodyId);
  const searchEl = document.getElementById(searchId);
  searchEl.addEventListener('input', () => { listEl.innerHTML = renderList(searchEl.value); refreshIcons(); bindPickClicks(); });
  searchEl.focus();

  function bindPickClicks(){
    listEl.querySelectorAll('[data-pick-idx]').forEach(elm => {
      elm.addEventListener('click', () => {
        const idx = parseInt(elm.getAttribute('data-pick-idx'));
        const f = searchEl.value.trim().toLowerCase();
        const filtered = !f ? items : items.filter(it => searchKeys.some(k => String(it[k]||'').toLowerCase().includes(f)));
        onPick(filtered[idx]);
        closeModal('pickerModal');
      });
    });
  }
  bindPickClicks();
}
window.openPickerModal = openPickerModal;

// ---------------------------------------------------------------
// CONFIRM dialog
// ---------------------------------------------------------------
function confirmDialog({ title='Confirmar', msg, danger=true, okText='Confirmar' }){
  return new Promise((resolve) => {
    openModal({
      id: 'confirmModal', title, width: 420,
      bodyHtml: `<p style="font-size:13.5px;color:var(--text-dim)">${msg}</p>`,
      footHtml: `
        <button class="btn btn-ghost" data-cancel>Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${okText}</button>
      `
    });
    const modal = document.getElementById('confirmModal');
    modal.querySelector('[data-cancel]').addEventListener('click', () => { closeModal('confirmModal'); resolve(false); });
    modal.querySelector('[data-ok]').addEventListener('click', () => { closeModal('confirmModal'); resolve(true); });
  });
}
window.confirmDialog = confirmDialog;

// ---------------------------------------------------------------
// ROUTER — hash based
// ---------------------------------------------------------------
const Router = {
  routes: {},
  register(path, handler){ this.routes[path] = handler; },
  async go(path){
    if(location.hash !== `#${path}`) { location.hash = path; return; }
    await this.render(path);
  },
  async render(path){
    const [base, param] = path.split('/').filter(Boolean).reduce((acc, seg, i, arr) => {
      return acc; // not used, kept simple below
    }, []) || [];
    const handler = this.routes[path] || this.routes[path.split('/')[0]] || this.routes['/dashboard'];
    const container = document.getElementById('view');
    container.innerHTML = `<div class="loader"><div class="spin"></div> Carregando...</div>`;
    setActiveNav(path);
    try{
      await handler(path);
    }catch(e){
      console.error(e);
      container.innerHTML = `<div class="empty-state">${icon('alert-triangle')}<p>Erro ao carregar página: ${e.message}</p></div>`;
    }
    refreshIcons();
    window.scrollTo({top:0});
    if(window.innerWidth <= 920) document.getElementById('sidebar')?.classList.remove('mobile-open');
  },
  start(){
    window.addEventListener('hashchange', () => this.render(location.hash.slice(1) || '/dashboard'));
    this.render(location.hash.slice(1) || '/dashboard');
  }
};
window.Router = Router;

function setActiveNav(path){
  document.querySelectorAll('.nav-item[data-route]').forEach(el => {
    const r = el.getAttribute('data-route');
    el.classList.toggle('active', path === r || path.startsWith(r + '/'));
  });
  const titles = {
    '/dashboard': ['Visão Geral', 'Resumo do seu negócio solar em tempo real'],
    '/orcamento': ['Orçamento', 'Monte e envie propostas comerciais em segundos'],
    '/gerador': ['Gerador de Kits', 'Combinações otimizadas de placas + inversores'],
    '/cadastro/placas': ['Placas Solares', 'Catálogo de módulos fotovoltaicos'],
    '/cadastro/inversores': ['Inversores', 'Catálogo de inversores'],
    '/cadastro/baterias': ['Baterias', 'Catálogo de baterias / bancos de energia'],
    '/cadastro/clientes': ['Clientes', 'Base de clientes e contatos'],
    '/cadastro/materiais': ['Materiais e Serviços', 'Catálogo de itens avulsos para o orçamento'],
    '/configuracoes/proposta': ['Personalização da Proposta', 'Logo, capa, rodapé e dados institucionais'],
    '/configuracoes/estruturas': ['Estruturas de Fixação', 'Catálogo de estruturas de instalação'],
    '/configuracoes/vendedores': ['Vendedores', 'Equipe de vendas'],
    '/historico': ['Histórico', 'Registro de orçamentos gerados'],
  };
  const [t, s] = titles[path] || titles['/dashboard'];
  const th = document.getElementById('topbarTitle');
  if(th) th.innerHTML = `<h2>${t}</h2><p>${s}</p>`;
}

// ---------------------------------------------------------------
// COMMAND PALETTE (Ctrl+K)
// ---------------------------------------------------------------
const CMDK_ITEMS = [
  { label:'Visão Geral', route:'/dashboard', icon:'layout-dashboard' },
  { label:'Novo Orçamento', route:'/orcamento', icon:'banknote' },
  { label:'Gerador de Kits', route:'/gerador', icon:'sparkles' },
  { label:'Placas Solares', route:'/cadastro/placas', icon:'grid-3x2' },
  { label:'Inversores', route:'/cadastro/inversores', icon:'zap' },
  { label:'Baterias', route:'/cadastro/baterias', icon:'battery-full' },
  { label:'Clientes', route:'/cadastro/clientes', icon:'contact' },
  { label:'Histórico de Orçamentos', route:'/historico', icon:'folder-clock' },
];
function openCommandPalette(){
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop cmdk';
  backdrop.id = 'cmdkModal';
  backdrop.innerHTML = `
    <div class="modal">
      <input class="cmdk-input" id="cmdkInput" placeholder="Digite um comando ou busque uma página..." autocomplete="off">
      <div class="cmdk-list" id="cmdkList"></div>
    </div>`;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));
  const input = backdrop.querySelector('#cmdkInput');
  const list = backdrop.querySelector('#cmdkList');
  let sel = 0;

  function render(filter=''){
    const f = filter.toLowerCase();
    const items = CMDK_ITEMS.filter(i => i.label.toLowerCase().includes(f));
    list.innerHTML = items.map((i, idx) => `
      <div class="cmdk-item ${idx===sel?'sel':''}" data-route="${i.route}">
        ${icon(i.icon)}<span>${i.label}</span><span class="k">↵</span>
      </div>`).join('') || `<div class="cmdk-item">Nada encontrado</div>`;
    refreshIcons();
    list.querySelectorAll('[data-route]').forEach(el => el.addEventListener('click', () => {
      Router.go(el.getAttribute('data-route')); closeCmdk();
    }));
  }
  function closeCmdk(){
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 180);
    document.removeEventListener('keydown', keyHandler);
  }
  function keyHandler(e){
    if(e.key === 'Escape') closeCmdk();
  }
  backdrop.addEventListener('click', (e) => { if(e.target === backdrop) closeCmdk(); });
  input.addEventListener('input', () => render(input.value));
  document.addEventListener('keydown', keyHandler);
  render(); input.focus();
}
window.openCommandPalette = openCommandPalette;

document.addEventListener('keydown', (e) => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    openCommandPalette();
  }
});

console.log('%c⚡ Solar Pro 2.0 — ui carregado', 'color:#3aa7ff;font-weight:bold');
