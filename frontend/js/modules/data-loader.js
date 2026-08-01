// frontend/js/modules/data-loader.js
// Gerenciador universal de carregamento de dados

class DataLoader {
    constructor() {
        this.carregando = false;
        this.dadosCarregados = {
            placas: false,
            inversores: false,
            baterias: false,
            clientes: false,
            logs: false
        };
    }

    // ============================================
    // FUNÇÕES DE CARREGAMENTO POR TIPO
    // ============================================

    async carregarPlacas() {
        console.log('📡 Carregando placas...');
        try {
            const placas = await apiGet('/equipamentos/placas');
            window.AppState.placas = placas;
            window.placasCompletas = [...placas];
            this.dadosCarregados.placas = true;
            console.log(`✅ ${placas.length} placas carregadas`);
            return placas;
        } catch (error) {
            console.error('❌ Erro ao carregar placas:', error);
            this.dadosCarregados.placas = false;
            return [];
        }
    }

    async carregarInversores() {
        console.log('📡 Carregando inversores...');
        try {
            const inversores = await apiGet('/equipamentos/inversores');
            window.AppState.inversores = inversores;
            this.dadosCarregados.inversores = true;
            console.log(`✅ ${inversores.length} inversores carregados`);
            return inversores;
        } catch (error) {
            console.error('❌ Erro ao carregar inversores:', error);
            this.dadosCarregados.inversores = false;
            return [];
        }
    }

    async carregarBaterias() {
        console.log('📡 Carregando baterias...');
        try {
            const baterias = await apiGet('/equipamentos/baterias');
            window.AppState.baterias = baterias;
            this.dadosCarregados.baterias = true;
            console.log(`✅ ${baterias.length} baterias carregadas`);
            return baterias;
        } catch (error) {
            console.error('❌ Erro ao carregar baterias:', error);
            this.dadosCarregados.baterias = false;
            return [];
        }
    }

    async carregarClientes() {
        console.log('📡 Carregando clientes...');
        try {
            const clientes = await apiGet('/clientes');
            window.AppState.clientes = clientes;
            this.dadosCarregados.clientes = true;
            console.log(`✅ ${clientes.length} clientes carregados`);
            return clientes;
        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            this.dadosCarregados.clientes = false;
            return [];
        }
    }

    async carregarLogs() {
        console.log('📡 Carregando logs...');
        try {
            const logs = await apiGet('/log');
            window.AppState.logs = logs;
            this.dadosCarregados.logs = true;
            console.log(`✅ ${logs.length} logs carregados`);
            return logs;
        } catch (error) {
            console.error('❌ Erro ao carregar logs:', error);
            this.dadosCarregados.logs = false;
            return [];
        }
    }

    // ============================================
    // FUNÇÃO UNIVERSAL - CARREGA TUDO
    // ============================================

    async carregarTodosDados() {
        if (this.carregando) {
            console.log('⏳ Carregamento já em andamento...');
            return;
        }
        
        this.carregando = true;
        console.log('🚀 Iniciando carregamento de todos os dados...');
        
        // Mostrar loading em todos os containers
        this.mostrarLoadingEmTodosContainers();
        
        try {
            // Carregar todos os dados em paralelo
            const [placas, inversores, baterias, clientes, logs] = await Promise.all([
                this.carregarPlacas(),
                this.carregarInversores(),
                this.carregarBaterias(),
                this.carregarClientes(),
                this.carregarLogs()
            ]);
            
            // Atualizar as listas na interface
            this.atualizarListasNaInterface();
            
            console.log('✅ Todos os dados carregados com sucesso!');
            return { success: true, placas, inversores, baterias, clientes, logs };
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            mostrarToast('Erro ao carregar dados do servidor', 'error');
            return { success: false, error: error.message };
            
        } finally {
            this.carregando = false;
        }
    }

    // ============================================
    // FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE
    // ============================================

    mostrarLoadingEmTodosContainers() {
        const containers = [
            'listaPlacasContent',
            'listaInversoresContent',
            'listaBateriasContent',
            'listaClientesContent',
            'listaLogContent'
        ];
        
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container && container.innerHTML === '') {
                container.innerHTML = '<div class="loading">Carregando dados... <span class="loader"></span></div>';
            }
        });
    }

    atualizarListasNaInterface() {
        // Atualizar lista de placas
        if (typeof window.filtrarPlacas === 'function') {
            window.filtrarPlacas();
        } else if (typeof window.carregarPlacas === 'function') {
            window.carregarPlacas();
        } else if (document.getElementById('listaPlacasContent')) {
            this.exibirListaPlacas();
        }
        
        // Atualizar lista de inversores
        if (typeof window.carregarInversores === 'function') {
            window.carregarInversores();
        } else if (document.getElementById('listaInversoresContent')) {
            this.exibirListaInversores();
        }
        
        // Atualizar lista de baterias
        if (typeof window.carregarBaterias === 'function') {
            window.carregarBaterias();
        } else if (document.getElementById('listaBateriasContent')) {
            this.exibirListaBaterias();
        }
        
        // Atualizar lista de clientes
        if (typeof window.carregarClientes === 'function') {
            window.carregarClientes();
        } else if (document.getElementById('listaClientesContent')) {
            this.exibirListaClientes();
        }
        
        // Atualizar lista de logs
        if (typeof window.carregarLog === 'function') {
            window.carregarLog();
        } else if (document.getElementById('listaLogContent')) {
            this.exibirListaLogs();
        }
    }

    exibirListaPlacas() {
        const container = document.getElementById('listaPlacasContent');
        if (!container) return;
        
        const placas = window.AppState.placas || [];
        
        if (placas.length === 0) {
            container.innerHTML = '<div class="empty-list">Nenhuma placa cadastrada</div>';
            return;
        }
        
        container.innerHTML = placas.map(placa => `
            <div class="list-item" onclick="selecionarPlacaLista(${placa.id})">
                <div class="item-info">
                    <div class="item-title">PAINEL SOLAR ${placa.marca || ''} ${placa.modelo || ''} ${placa.potencia || 0}W ${placa.tipo || ''}</div>
                    <div class="item-subtitle">Garantia: ${placa.garantia || 0} anos</div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editarPlaca(${placa.id})">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); clonarPlaca(${placa.id})">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); excluirPlaca(${placa.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    exibirListaInversores() {
        const container = document.getElementById('listaInversoresContent');
        if (!container) return;
        
        const inversores = window.AppState.inversores || [];
        
        if (inversores.length === 0) {
            container.innerHTML = '<div class="empty-list">Nenhum inversor cadastrado</div>';
            return;
        }
        
        container.innerHTML = inversores.map(inv => `
            <div class="list-item" onclick="selecionarInversorLista(${inv.id})">
                <div class="item-info">
                    <div class="item-title">${inv.marca || ''} ${inv.modelo || ''}</div>
                    <div class="item-subtitle">${inv.tipo || 'ONGRID'} | ${inv.potencia || 0}W</div>
                </div>
                <div class="item-value">${inv.garantia || 0} anos</div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editarInversor(${inv.id})">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); clonarInversor(${inv.id})">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); excluirInversor(${inv.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    exibirListaBaterias() {
        const container = document.getElementById('listaBateriasContent');
        if (!container) return;
        
        const baterias = window.AppState.baterias || [];
        
        if (baterias.length === 0) {
            container.innerHTML = '<div class="empty-list">Nenhuma bateria cadastrada</div>';
            return;
        }
        
        container.innerHTML = baterias.map(bat => `
            <div class="list-item" onclick="selecionarBateriaLista(${bat.id})">
                <div class="item-info">
                    <div class="item-title">${bat.nome || ''}</div>
                    <div class="item-subtitle">Capacidade: ${bat.capacidade || '-'} Ah | ${bat.tensao || '-'}V</div>
                </div>
                <div class="item-value">${bat.garantia || 0} anos</div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editarBateria(${bat.id})">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); clonarBateria(${bat.id})">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); excluirBateria(${bat.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    exibirListaClientes() {
        const container = document.getElementById('listaClientesContent');
        if (!container) return;
        
        const clientes = window.AppState.clientes || [];
        
        if (clientes.length === 0) {
            container.innerHTML = '<div class="empty-list">Nenhum cliente cadastrado</div>';
            return;
        }
        
        container.innerHTML = clientes.map(cliente => `
            <div class="list-item" onclick="selecionarCliente(${cliente.id})">
                <div class="item-info">
                    <div class="item-title">${cliente.nome || ''}</div>
                    <div class="item-subtitle">${cliente.telefone || ''} | ${cliente.email || ''}</div>
                </div>
                <div class="item-value">${cliente.cpf_cnpj || ''}</div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editarCliente(${cliente.id})">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); clonarCliente(${cliente.id})">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); excluirCliente(${cliente.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    exibirListaLogs() {
        const container = document.getElementById('listaLogContent');
        if (!container) return;
        
        const logs = window.AppState.logs || [];
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-list">Nenhum registro encontrado</div>';
            return;
        }
        
        container.innerHTML = logs.map(log => `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-title">${new Date(log.data_registro).toLocaleDateString('pt-BR')}</div>
                    <div class="item-subtitle">${log.acao || 'Orçamento gerado'}</div>
                </div>
                <div class="item-value">${log.detalhes || '-'}</div>
            </div>
        `).join('');
    }

    // ============================================
    // FUNÇÃO PARA CARREGAR APENAS UMA PÁGINA ESPECÍFICA
    // ============================================

    async carregarDadosPagina(pagina) {
        console.log(`📡 Carregando dados para página: ${pagina}`);
        
        switch(pagina) {
            case 'placas':
                await this.carregarPlacas();
                if (typeof window.filtrarPlacas === 'function') window.filtrarPlacas();
                break;
            case 'inversores':
                await this.carregarInversores();
                if (typeof window.carregarInversores === 'function') window.carregarInversores();
                break;
            case 'baterias':
                await this.carregarBaterias();
                if (typeof window.carregarBaterias === 'function') window.carregarBaterias();
                break;
            case 'clientes':
                await this.carregarClientes();
                if (typeof window.carregarClientes === 'function') window.carregarClientes();
                break;
            case 'log':
                await this.carregarLogs();
                if (typeof window.carregarLog === 'function') window.carregarLog();
                break;
            case 'orcamento':
            case 'gerador':
                // Orçamento e gerador não precisam de listas
                console.log(`📄 Página ${pagina} carregada, dados não necessários`);
                break;
            default:
                // Carregar todos os dados
                await this.carregarTodosDados();
        }
    }
}

// ============================================
// INICIALIZAR
// ============================================

let dataLoader = null;

document.addEventListener('DOMContentLoaded', () => {
    dataLoader = new DataLoader();
    window.dataLoader = dataLoader;
    console.log('✅ DataLoader inicializado');
    
    // Carregar dados iniciais
    setTimeout(() => {
        dataLoader.carregarTodosDados();
    }, 500);
});

// Exportar
window.dataLoader = dataLoader;

console.log('✅ data-loader.js carregado');