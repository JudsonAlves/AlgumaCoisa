// frontend/js/modules/cadastro/clientes.js
// Funções de cadastro e gerenciamento de clientes

let clienteEditandoId = null;

// ============================================
// CARREGAR
// ============================================

async function carregarClientes() {
    try {
        const clientes = await apiGet('/clientes');
        window.AppState.clientes = clientes;
        
        const container = document.getElementById('listaClientesContent');
        if (container) {
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
                        <button class="btn-icon" onclick="event.stopPropagation(); editarCliente(${cliente.id})" title="Editar">✏️</button>
                        <button class="btn-icon" onclick="event.stopPropagation(); clonarCliente(${cliente.id})" title="Clonar">📋</button>
                        <button class="btn-icon" onclick="event.stopPropagation(); excluirCliente(${cliente.id})" title="Excluir">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar clientes:', error);
    }
}

// ============================================
// SELEÇÃO
// ============================================

function selecionarCliente(id) {
    const cliente = window.AppState.clientes.find(c => c.id === id);
    if (!cliente) return;
    
    window.AppState.clienteSelecionado = cliente;
    
    const clienteDiv = document.getElementById('clienteSelecionado');
    if (clienteDiv) {
        clienteDiv.innerHTML = `${cliente.nome} - ${cliente.telefone || 'Sem telefone'}`;
        clienteDiv.classList.remove('empty');
    }
    
    if (typeof window.fecharModal === 'function') window.fecharModal();
    mostrarToast(`Cliente ${cliente.nome} selecionado!`, 'success');
}

// ============================================
// MODAL
// ============================================

function abrirModalClientes() {
    const modal = document.getElementById('modalSelecao');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal) {
        console.error('Modal não encontrado');
        mostrarToast('Erro ao abrir modal', 'error');
        return;
    }
    
    modalTitle.innerHTML = 'Selecionar Cliente';
    modal.classList.add('active');
    
    if (!window.AppState.clientes || window.AppState.clientes.length === 0) {
        modalBody.innerHTML = `
            <div class="empty-list">
                <i data-lucide="alert-circle"></i>
                <p>Nenhum cliente cadastrado</p>
                <small>Cadastre um cliente no menu "Clientes"</small>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    modalBody.innerHTML = `
        <div class="lista-itens-container">
            ${window.AppState.clientes.map(cliente => `
                <div class="list-item" onclick="selecionarCliente(${cliente.id})">
                    <div class="item-info">
                        <div class="item-title">${cliente.nome || 'Sem nome'}</div>
                        <div class="item-subtitle">${cliente.telefone || ''} | ${cliente.email || ''}</div>
                    </div>
                    <div class="item-value">${cliente.cpf_cnpj || ''}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// CADASTRO
// ============================================

async function cadastrarCliente() {
    const nome = document.getElementById('clienteNome')?.value.trim();
    const cpf_cnpj = document.getElementById('clienteCpf')?.value;
    const telefone = document.getElementById('clienteTelefone')?.value;
    const email = document.getElementById('clienteEmail')?.value;
    const endereco = document.getElementById('clienteEndereco')?.value;
    const cidade = document.getElementById('clienteCidade')?.value;
    
    if (!nome) {
        mostrarToast('❌ Preencha o nome do cliente!', 'error');
        return;
    }
    
    const dados = { nome, cpf_cnpj, telefone, email, endereco, cidade };
    const btn = document.getElementById('btnCadastrarCliente');
    const textoOriginal = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '⏳ Salvando...';
        btn.disabled = true;
    }
    
    try {
        let result;
        if (clienteEditandoId) {
            result = await apiPut(`/clientes/${clienteEditandoId}`, dados);
            if (result) {
                mostrarToast('✅ Cliente atualizado!', 'success');
                clienteEditandoId = null;
                if (btn) btn.innerHTML = 'Cadastrar';
            }
        } else {
            result = await apiPost('/clientes', dados);
            if (result) {
                mostrarToast('✅ Cliente cadastrado!', 'success');
            }
        }
        
        if (result) {
            document.getElementById('clienteNome').value = '';
            document.getElementById('clienteCpf').value = '';
            document.getElementById('clienteTelefone').value = '';
            document.getElementById('clienteEmail').value = '';
            document.getElementById('clienteEndereco').value = '';
            document.getElementById('clienteCidade').value = '';
            await carregarClientes();
        }
    } catch (error) {
        mostrarToast('Erro ao salvar cliente', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    }
}

// ============================================
// EDIÇÃO, CLONAR, EXCLUIR
// ============================================

async function editarCliente(id) {
    const cliente = window.AppState.clientes.find(c => c.id === id);
    if (!cliente) return;
    
    clienteEditandoId = id;
    
    document.getElementById('clienteNome').value = cliente.nome || '';
    document.getElementById('clienteCpf').value = cliente.cpf_cnpj || '';
    document.getElementById('clienteTelefone').value = cliente.telefone || '';
    document.getElementById('clienteEmail').value = cliente.email || '';
    document.getElementById('clienteEndereco').value = cliente.endereco || '';
    document.getElementById('clienteCidade').value = cliente.cidade || '';
    
    const btn = document.getElementById('btnCadastrarCliente');
    if (btn) btn.innerHTML = 'Atualizar';
    
    document.querySelector('.card.compact').scrollIntoView({ behavior: 'smooth' });
    mostrarToast('Edite os campos e clique em Atualizar', 'info');
}

async function clonarCliente(id) {
    const cliente = window.AppState.clientes.find(c => c.id === id);
    if (!cliente) return;
    
    clienteEditandoId = null;
    
    document.getElementById('clienteNome').value = (cliente.nome || '') + ' (Cópia)';
    document.getElementById('clienteCpf').value = cliente.cpf_cnpj || '';
    document.getElementById('clienteTelefone').value = cliente.telefone || '';
    document.getElementById('clienteEmail').value = cliente.email || '';
    document.getElementById('clienteEndereco').value = cliente.endereco || '';
    document.getElementById('clienteCidade').value = cliente.cidade || '';
    
    const btn = document.getElementById('btnCadastrarCliente');
    if (btn) btn.innerHTML = 'Cadastrar Cópia';
    
    mostrarToast('Clone criado, clique em Cadastrar Cópia para salvar', 'info');
}

async function excluirCliente(id) {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        try {
            await apiDelete(`/clientes/${id}`);
            mostrarToast('Cliente excluído!', 'success');
            await carregarClientes();
            if (window.AppState.clienteSelecionado?.id === id) {
                window.AppState.clienteSelecionado = null;
                const clienteDiv = document.getElementById('clienteSelecionado');
                if (clienteDiv) {
                    clienteDiv.innerHTML = 'Clique para selecionar um cliente';
                    clienteDiv.classList.add('empty');
                }
            }
        } catch (error) {
            mostrarToast('Erro ao excluir', 'error');
        }
    }
}

// ============================================
// EXPORTAR
// ============================================

window.selecionarCliente = selecionarCliente;
window.abrirModalClientes = abrirModalClientes;
window.carregarClientes = carregarClientes;
window.cadastrarCliente = cadastrarCliente;
window.editarCliente = editarCliente;
window.clonarCliente = clonarCliente;
window.excluirCliente = excluirCliente;

console.log('✅ cadastro/clientes.js carregado');