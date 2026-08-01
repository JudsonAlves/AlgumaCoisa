// frontend/js/ui/theme-manager.js
// Gerenciador de Temas

class ThemeManager {
    constructor() {
        this.themes = [
            { id: 'dark', nome: '🌙 Dark Modern', cor: '#2ecc71', icone: '🌙' },
            { id: 'green', nome: '🌿 Nature Green', cor: '#3b7a17', icone: '🌿' },
            { id: 'orange', nome: '🌅 Sunset Orange', cor: '#f1be49', icone: '🌅' },
            { id: 'earth', nome: '🏔️ Earth Tones', cor: '#6a7553', icone: '🏔️' },
            { id: 'blue', nome: '🌊 Ocean Blue', cor: '#3e564f', icone: '🌊' },
            { id: 'copper', nome: '🔶 Copper Rose', cor: '#b87333', icone: '🔶' }
        ];
        
        this.temaAtual = localStorage.getItem('solar-theme') || 'dark';
        this.aplicarTema(this.temaAtual);
    }
    
    aplicarTema(temaId) {
        document.body.classList.remove('theme-dark', 'theme-green', 'theme-orange', 'theme-earth', 'theme-blue', 'theme-copper');
        document.body.classList.add(`theme-${temaId}`);
        localStorage.setItem('solar-theme', temaId);
        this.temaAtual = temaId;
        console.log(`🎨 Tema aplicado: ${temaId}`);
        this.atualizarElementosDinamicos();
    }
    
    atualizarElementosDinamicos() {
        const cards = document.querySelectorAll('.card');
        if (cards.length) cards[0].style.display = 'none';
        setTimeout(() => {
            if (cards.length) cards[0].style.display = '';
        }, 10);
    }
    
    criarSeletorTemas() {
        if (document.getElementById('themeSelector')) return;
        
        const container = document.createElement('div');
        container.id = 'themeSelector';
        container.className = 'theme-selector';
        container.innerHTML = `
            <div class="theme-selector-header">
                <span>🎨 Temas</span>
                <button class="theme-selector-close" onclick="window.themeManager.fecharSeletor()">×</button>
            </div>
            <div class="theme-selector-body">
                ${this.themes.map(theme => `
                    <div class="theme-option ${theme.id === this.temaAtual ? 'active' : ''}" 
                         onclick="window.themeManager.aplicarTema('${theme.id}'); window.themeManager.fecharSeletor();">
                        <div class="theme-preview" style="background: ${theme.cor}"></div>
                        <div class="theme-name">${theme.icone} ${theme.nome}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.body.appendChild(container);
        this.adicionarEstilos();
    }
    
    adicionarEstilos() {
        if (document.getElementById('themeStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'themeStyles';
        style.textContent = `
            .theme-selector {
                position: fixed;
                bottom: 100px;
                left: 20px;
                width: 260px;
                background: var(--bg-card);
                border-radius: 16px;
                box-shadow: var(--shadow-lg);
                z-index: 1002;
                overflow: hidden;
                border: 1px solid var(--primary-green);
                display: none;
            }
            .theme-selector.open { display: block; animation: slideUp 0.3s ease; }
            .theme-selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: var(--primary-green);
                color: white;
                font-weight: 600;
            }
            .theme-selector-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
            }
            .theme-selector-body { padding: 12px; max-height: 400px; overflow-y: auto; }
            .theme-option {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                margin: 6px 0;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                background: var(--bg-light);
            }
            .theme-option:hover { transform: translateX(5px); background: var(--primary-green); }
            .theme-option.active { background: var(--primary-green); border-left: 3px solid white; }
            .theme-preview { width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; box-shadow: var(--shadow-sm); }
            .theme-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-dark); }
            .theme-option.active .theme-name, .theme-option:hover .theme-name { color: white; }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    abrirSeletor() {
        const selector = document.getElementById('themeSelector');
        if (selector) selector.classList.add('open');
    }
    
    fecharSeletor() {
        const selector = document.getElementById('themeSelector');
        if (selector) selector.classList.remove('open');
    }
    
    toggleSeletor() {
        const selector = document.getElementById('themeSelector');
        if (selector) {
            selector.classList.toggle('open');
        } else {
            this.criarSeletorTemas();
            setTimeout(() => this.abrirSeletor(), 100);
        }
    }
    
    getTemaAtual() {
        return this.themes.find(t => t.id === this.temaAtual);
    }
}

// Inicializar e EXPORTAR GLOBALMENTE
let themeManager = null;

document.addEventListener('DOMContentLoaded', () => {
    themeManager = new ThemeManager();
    themeManager.criarSeletorTemas();
    window.themeManager = themeManager;
    console.log('✅ ThemeManager inicializado');
});

// Garantir que mesmo se o DOMContentLoaded já tiver ocorrido
if (document.readyState === 'loading') {
    // já tem o listener acima
} else {
    themeManager = new ThemeManager();
    themeManager.criarSeletorTemas();
    window.themeManager = themeManager;
    console.log('✅ ThemeManager inicializado (pronto)');
}