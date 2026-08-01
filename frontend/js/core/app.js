// frontend/js/core/app.js
// Inicialização e Navegação

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Sistema iniciado');
    
    inicializarNavegacao();
    inicializarSidebar();
    
    // Carregar dados - usando as funções do cadastro.js
    if (typeof carregarPlacas === 'function') carregarPlacas();
    if (typeof carregarInversores === 'function') carregarInversores();
    if (typeof carregarBaterias === 'function') carregarBaterias();
    if (typeof carregarClientes === 'function') carregarClientes();
    if (typeof carregarLog === 'function') carregarLog();
    
    console.log('✅ Sistema pronto!');
});

function inicializarNavegacao() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    
    navItems.forEach(item => {
        const pageId = item.getAttribute('data-page');
        
        if (pageId === 'gerador') {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof abrirGeradorKits === 'function') {
                    abrirGeradorKits();
                }
            });
        } else if (pageId) {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Usar page-loader se disponível
                if (typeof window.pageLoader !== 'undefined' && window.pageLoader) {
                    window.pageLoader.loadPage(pageId);
                }
            });
        }
    });
}

function inicializarSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    if (!sidebar || !toggleBtn) return;
    
    let isCollapsed = false;
    toggleBtn.onclick = () => {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            toggleBtn.innerHTML = '▶';
        } else {
            sidebar.classList.remove('collapsed');
            toggleBtn.innerHTML = '◀';
        }
    };
}

console.log('✅ app.js carregado');