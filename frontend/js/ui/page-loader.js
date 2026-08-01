// frontend/js/ui/page-loader.js

class PageLoader {
    constructor() {
        this.currentPage = 'orcamento';
        this.pageContainer = document.getElementById('pageContainer');
        this.pageLoader = document.getElementById('pageLoader');
        this.init();
    }

    init() {
        this.loadPage('orcamento');
        this.setupNavigation();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item[data-page]');
        
        navItems.forEach(item => {
            const pageId = item.getAttribute('data-page');
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                this.loadPage(pageId);
            });
        });
    }

    async loadPage(pageName) {
        this.showLoader(true);
        
        try {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            this.pageContainer.innerHTML = html;
            this.currentPage = pageName;
            
            // Disparar evento de página carregada
            const event = new CustomEvent('pageLoaded', { detail: { page: pageName } });
            document.dispatchEvent(event);
            
            // CARREGAR DADOS ESPECÍFICOS DA PÁGINA
            if (window.dataLoader && typeof window.dataLoader.carregarDadosPagina === 'function') {
                console.log(`📡 Carregando dados para página: ${pageName}`);
                await window.dataLoader.carregarDadosPagina(pageName);
            }
            
            // INICIALIZAR COMPONENTES ESPECÍFICOS DA PÁGINA
            if (pageName === 'placas') {
                // Aguardar um momento para o DOM ser atualizado
                setTimeout(() => {
                    if (typeof window.inicializarFiltrosPlacas === 'function') {
                        window.inicializarFiltrosPlacas();
                    }
                    if (typeof window.carregarPlacas === 'function') {
                        window.carregarPlacas();
                    }
                }, 100);
            }
            if (pageName === 'inversores') {
				setTimeout(() => {
					if (typeof window.inicializarFiltrosInversores === 'function') {
						window.inicializarFiltrosInversores();
					}
					if (typeof window.carregarInversores === 'function') {
						window.carregarInversores();
					}
				}, 100);
			}
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
            console.log(`✅ Página carregada: ${pageName}`);
        } catch (error) {
            console.error('❌ Erro ao carregar página:', error);
            this.pageContainer.innerHTML = `
                <div class="error-page">
                    <i data-lucide="alert-triangle"></i>
                    <h3>Erro ao carregar página</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Recarregar</button>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } finally {
            this.showLoader(false);
        }
    }

    showLoader(show) {
        if (this.pageLoader) this.pageLoader.style.display = show ? 'flex' : 'none';
    }
}

let pageLoader = null;
document.addEventListener('DOMContentLoaded', () => { 
    pageLoader = new PageLoader(); 
    window.pageLoader = pageLoader;
});