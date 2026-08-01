// frontend/js/modules/cadastro/baterias.js
// Funções de cadastro e gerenciamento de baterias

console.log('🔋 baterias.js carregado');

let bateriasCompletas = [];
let bateriaEditandoId = null;
let imagemSelecionadaBateria = null;
let imagemSelecionadaUrlBateria = null;

// ============================================
// FUNÇÕES DE IMAGEM
// ============================================

function gerarNomeImagemBateria(bateria) {
    let nome = (bateria.nome || '').trim();
    let tipo = (bateria.tipo || '').trim();
    let capacidade = bateria.capacidade || 0;
    let tensao = bateria.tensao || 0;
    
    nome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    nome = nome.replace(/[^A-Za-z0-9]/g, '');
    tipo = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    tipo = tipo.replace(/[^A-Za-z0-9]/g, '');
    
    let nomeImagem = `BATERIA${nome}${tipo}${capacidade}AH${tensao}V`;
    nomeImagem = nomeImagem.toUpperCase();
    console.log(`📸 Nome gerado: ${nomeImagem}.png`);
    return `${nomeImagem}.png`;
}

function removerImagemBateria() {
    imagemSelecionadaBateria = null;
    imagemSelecionadaUrlBateria = null;
    const preview = document.getElementById('previewImagemBateria');
    const previewImg = document.getElementById('previewImgBateria');
    const statusDiv = document.getElementById('statusUploadBateria');
    
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (statusDiv) statusDiv.style.display = 'none';
    document.getElementById('batImagem').value = '';
    
    mostrarToast('Imagem removida', 'info');
}

function abrirSelecaoImagemBateria() {
    const input = document.getElementById('batImagem');
    const statusDiv = document.getElementById('statusUploadBateria');
    const previewDiv = document.getElementById('previewImagemBateria');
    const previewImg = document.getElementById('previewImgBateria');
    
    if (!input) {
        console.error('Elemento batImagem não encontrado');
        mostrarToast('Erro: elemento de imagem não encontrado', 'error');
        return;
    }
    
    // Resetar status
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#fff3cd';
        statusDiv.style.color = '#856404';
        statusDiv.innerHTML = '🔄 Aguardando seleção de arquivo...';
    }
    
    input.value = '';
    input.click();
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) {
            if (statusDiv) {
                statusDiv.style.display = 'none';
            }
            return;
        }
        
        console.log(`📸 Arquivo selecionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        
        // Atualizar status
        if (statusDiv) {
            statusDiv.style.backgroundColor = '#cce5ff';
            statusDiv.style.color = '#004085';
            statusDiv.innerHTML = '🔄 Processando imagem... (redimensionando)';
        }
        
        // Mostrar loading no preview
        if (previewDiv) {
            previewDiv.style.display = 'block';
            if (previewImg) {
                previewImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="none" stroke="%232ecc71" stroke-width="4"%3E%3CanimateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1s" repeatCount="indefinite"/%3E%3C/circle%3E%3C/svg%3E';
                previewImg.style.maxWidth = '100px';
                previewImg.style.maxHeight = '100px';
                previewImg.style.objectFit = 'contain';
            }
        }
        
        try {
            // Processar imagem
            const url = await window.processarEFazerUpload(
                file,
                'previewImgBateria',
                'previewImagemBateria',
                'statusUploadBateria'
            );
            if (url) {
                imagemSelecionadaUrlBateria = url;
                imagemSelecionadaBateria = true;
            }
        } catch (error) {
            console.error('❌ Erro ao processar imagem:', error);
            if (statusDiv) {
                statusDiv.style.backgroundColor = '#f8d7da';
                statusDiv.style.color = '#721c24';
                statusDiv.innerHTML = `❌ Erro: ${error.message}`;
                setTimeout(() => {
                    if (statusDiv) statusDiv.style.display = 'none';
                }, 5000);
            }
            mostrarToast(`❌ Erro ao processar imagem: ${error.message}`, 'error');
        }
    };
}

// ============================================
// FILTRAR BATERIAS
// ============================================

function filtrarBaterias() {
    const tipoFiltro = document.getElementById('filtroTipoBateria')?.value || '';
    const capacidadeFiltro = document.getElementById('filtroCapacidadeBateria')?.value || '';
    
    let bateriasFiltradas = [...bateriasCompletas];
    
    if (tipoFiltro) {
        bateriasFiltradas = bateriasFiltradas.filter(b => b.tipo === tipoFiltro);
    }
    
    if (capacidadeFiltro) {
        bateriasFiltradas = bateriasFiltradas.filter(b => {
            const cap = b.capacidade || 0;
            switch(capacidadeFiltro) {
                case '0-50': return cap <= 50;
                case '51-100': return cap >= 51 && cap <= 100;
                case '101-200': return cap >= 101 && cap <= 200;
                case '201+': return cap >= 201;
                default: return true;
            }
        });
    }
    
    const container = document.getElementById('listaBateriasContent');
    if (!container) return;
    
    if (bateriasFiltradas.length === 0) {
        container.innerHTML = '<div class="empty-list">Nenhuma bateria encontrada</div>';
        return;
    }
    
    container.innerHTML = bateriasFiltradas.map(bat => {
        const nomeImagem = gerarNomeImagemBateria(bat);
        const imagemSrc = bat.imagem_url || '/assets/images/baterias/padraoestacionaria.png';
        const tipoLabel = bat.tipo === 'CHUMBO' ? 'Chumbo Ácido' : bat.tipo === 'LITIO' ? 'Lítio' : 'Estacionária';
        
        const infoAdicional = [
            `${tipoLabel}`,
            `${bat.capacidade || '-'}Ah`,
            `${bat.tensao || '-'}V`,
            `Garantia: ${bat.garantia || 0} anos`
        ];
        if (bat.inmetro) infoAdicional.push(`INMETRO: ${bat.inmetro}`);
        
        return `
            <div class="list-item" onclick="selecionarBateriaLista(${bat.id})">
                <div class="item-imagem">
                    <img src="${imagemPath}" 
                         onerror="this.src='/assets/images/baterias/${window.imageProcessor.getImagemPadrao(bat.tipo, 'baterias').split('/').pop()}'"
                         style="width: 70px; height: 70px; object-fit: contain;">
                </div>
                <div class="item-info">
                    <div class="item-title">${bat.nome || ''}</div>
                    <div class="item-subtitle">${infoAdicional.join(' | ')}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editarBateria(${bat.id})">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); clonarBateria(${bat.id})">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); excluirBateria(${bat.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// CARREGAR BATERIAS
// ============================================

async function carregarBaterias() {
    try {
        const baterias = await apiGet('/equipamentos/baterias');
        window.AppState.baterias = baterias;
        bateriasCompletas = [...baterias];
        
        filtrarBaterias();
        
    } catch (error) {
        console.error('❌ Erro ao carregar baterias:', error);
    }
}

// ============================================
// SELEÇÃO
// ============================================

function selecionarBateriaLista(id) {
    const bateria = window.AppState.baterias.find(b => b.id === id);
    if (!bateria) return;
    
    window.AppState.bateriaSelecionada = bateria;
    
    const batDiv = document.getElementById('bateriaSelecionada');
    const detalhesDiv = document.getElementById('detalhesBateria');
    
    if (batDiv) {
        const tipoLabel = bateria.tipo === 'CHUMBO' ? 'Chumbo Ácido' : bateria.tipo === 'LITIO' ? 'Lítio' : 'Estacionária';
        batDiv.innerHTML = `${bateria.nome} (${tipoLabel})`;
        batDiv.classList.remove('empty');
    }
    
    if (detalhesDiv) {
        detalhesDiv.style.display = 'block';
        atualizarDetalhesBateria(bateria);
    }
    
    if (typeof window.mostrarQuantidadeBateria === 'function') window.mostrarQuantidadeBateria(true);
    window.quantidadeBateriaManual = null;
    const qtdInput = document.getElementById('bateriaQuantidade');
    if (qtdInput) qtdInput.value = '0';
    
    if (typeof window.fecharModal === 'function') window.fecharModal();
    if (typeof window.recalcularOrcamento === 'function') window.recalcularOrcamento();
    mostrarToast(`Bateria ${bateria.nome} selecionada!`, 'success');
}

// ============================================
// MODAL
// ============================================

function abrirModalBaterias() {
    const modal = document.getElementById('modalSelecao');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal) {
        console.error('Modal não encontrado');
        mostrarToast('Erro ao abrir modal', 'error');
        return;
    }
    
    modalTitle.innerHTML = 'Selecionar Bateria';
    modal.classList.add('active');
    
    if (!window.AppState.baterias || window.AppState.baterias.length === 0) {
        modalBody.innerHTML = `
            <div class="empty-list">
                <i data-lucide="alert-circle"></i>
                <p>Nenhuma bateria cadastrada</p>
                <small>Cadastre uma bateria no menu "Baterias"</small>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    modalBody.innerHTML = `
        <div class="modal-filtros">
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Tipo:</label>
                <select id="modalFiltroTipoBateria" class="filtro-select">
                    <option value="">Todos os Tipos</option>
                    <option value="CHUMBO">Chumbo Ácido</option>
                    <option value="LITIO">Lítio</option>
                    <option value="ESTACIONARIA">Estacionária</option>
                </select>
            </div>
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Capacidade:</label>
                <select id="modalFiltroCapacidadeBateria" class="filtro-select">
                    <option value="">Todas as Capacidades</option>
                    <option value="0-50">Até 50Ah</option>
                    <option value="51-100">51Ah - 100Ah</option>
                    <option value="101-200">101Ah - 200Ah</option>
                    <option value="201+">Acima de 200Ah</option>
                </select>
            </div>
            <div class="filtro-actions">
                <button class="btn-small" onclick="limparFiltrosModalBaterias()">Limpar Filtros</button>
                <span class="contador-placas" id="contadorBateriasModal">${window.AppState.baterias.length} baterias</span>
            </div>
        </div>
        <div class="lista-itens-container" id="modalListaBaterias">
            ${renderizarListaBateriasModal(window.AppState.baterias)}
        </div>
    `;
    
    const filtroTipo = document.getElementById('modalFiltroTipoBateria');
    const filtroCapacidade = document.getElementById('modalFiltroCapacidadeBateria');
    
    if (filtroTipo) filtroTipo.addEventListener('change', () => filtrarBateriasModal());
    if (filtroCapacidade) filtroCapacidade.addEventListener('change', () => filtrarBateriasModal());
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarListaBateriasModal(baterias) {
    if (!baterias || baterias.length === 0) return '<div class="empty-list">Nenhuma bateria encontrada</div>';
    
    return baterias.map(bat => {
        const tipoLabel = bat.tipo === 'CHUMBO' ? 'Chumbo Ácido' : bat.tipo === 'LITIO' ? 'Lítio' : 'Estacionária';
        return `
            <div class="list-item" onclick="selecionarBateriaLista(${bat.id})">
                <div class="item-info">
                    <div class="item-title">${bat.nome || ''}</div>
                    <div class="item-subtitle">${tipoLabel} | ${bat.capacidade || '-'}Ah | ${bat.tensao || '-'}V</div>
                </div>
                <div class="item-value">${bat.garantia || 0} anos</div>
            </div>
        `;
    }).join('');
}

function filtrarBateriasModal() {
    const filtroTipo = document.getElementById('modalFiltroTipoBateria')?.value || '';
    const filtroCapacidade = document.getElementById('modalFiltroCapacidadeBateria')?.value || '';
    
    let bateriasFiltradas = [...window.AppState.baterias];
    
    if (filtroTipo) {
        bateriasFiltradas = bateriasFiltradas.filter(b => b.tipo === filtroTipo);
    }
    
    if (filtroCapacidade) {
        bateriasFiltradas = bateriasFiltradas.filter(b => {
            const cap = b.capacidade || 0;
            switch(filtroCapacidade) {
                case '0-50': return cap <= 50;
                case '51-100': return cap >= 51 && cap <= 100;
                case '101-200': return cap >= 101 && cap <= 200;
                case '201+': return cap >= 201;
                default: return true;
            }
        });
    }
    
    const container = document.getElementById('modalListaBaterias');
    const contador = document.getElementById('contadorBateriasModal');
    
    if (container) container.innerHTML = renderizarListaBateriasModal(bateriasFiltradas);
    if (contador) contador.innerHTML = `${bateriasFiltradas.length} baterias`;
}

function limparFiltrosModalBaterias() {
    const filtroTipo = document.getElementById('modalFiltroTipoBateria');
    const filtroCapacidade = document.getElementById('modalFiltroCapacidadeBateria');
    
    if (filtroTipo) filtroTipo.value = '';
    if (filtroCapacidade) filtroCapacidade.value = '';
    
    filtrarBateriasModal();
}

function abrirCadastroBateria() {
    const batNav = document.querySelector('[data-page="baterias"]');
    if (batNav) batNav.click();
}

// ============================================
// CADASTRO
// ============================================

async function cadastrarBateria() {
    const nome = document.getElementById('batNome')?.value.trim();
    const tipo = document.getElementById('batTipo')?.value;
    const garantia = parseInt(document.getElementById('batGarantia')?.value);
    const capacidade = parseFloat(document.getElementById('batCapacidade')?.value);
    const tensao = parseFloat(document.getElementById('batTensao')?.value);
    const inmetro = document.getElementById('batInmetro')?.value.trim();
    const outros = document.getElementById('batOutros')?.value.trim();
    
    if (!nome) {
        mostrarToast('❌ Preencha o nome da bateria!', 'error');
        return;
    }
    
    const dados = { nome, tipo, garantia, capacidade, tensao, inmetro, outros };
    const btn = document.getElementById('btnCadastrarBateria');
    const textoOriginal = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '⏳ Salvando...';
        btn.disabled = true;
    }
    
    try {
        let result;
        let bateriaId;
        if (bateriaEditandoId) {
            result = await apiPut(`/equipamentos/baterias/${bateriaEditandoId}`, dados);
            if (result) {
                bateriaId = bateriaEditandoId;
                mostrarToast('✅ Bateria atualizada!', 'success');
                bateriaEditandoId = null;
                if (btn) btn.innerHTML = 'Cadastrar';
            }
        } else {
            result = await apiPost('/equipamentos/baterias', dados);
            if (result) {
                bateriaId = result.id;
                mostrarToast('✅ Bateria cadastrada!', 'success');
            }
        }
        
        if (result && bateriaId) {
            if (imagemSelecionadaUrlBateria) {
                await apiPut(`/equipamentos/baterias/${bateriaId}`, { ...dados, imagem_url: imagemSelecionadaUrlBateria });
            }
            imagemSelecionadaUrlBateria = null;
            
            document.getElementById('batNome').value = '';
            document.getElementById('batGarantia').value = '5';
            document.getElementById('batCapacidade').value = '';
            document.getElementById('batTensao').value = '';
            document.getElementById('batInmetro').value = '';
            document.getElementById('batOutros').value = '';
            removerImagemBateria();
            
            await carregarBaterias();
        }
    } catch (error) {
        mostrarToast('Erro ao salvar bateria', 'error');
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

async function editarBateria(id) {
    const bateria = window.AppState.baterias.find(b => b.id === id);
    if (!bateria) return;
    
    bateriaEditandoId = id;
    
    document.getElementById('batNome').value = bateria.nome || '';
    document.getElementById('batTipo').value = bateria.tipo || 'ESTACIONARIA';
    document.getElementById('batGarantia').value = bateria.garantia || 5;
    document.getElementById('batCapacidade').value = bateria.capacidade || '';
    document.getElementById('batTensao').value = bateria.tensao || '';
    document.getElementById('batInmetro').value = bateria.inmetro || '';
    document.getElementById('batOutros').value = bateria.outros || '';
    
    imagemSelecionadaBateria = null;
    removerImagemBateria();
    
    const btn = document.getElementById('btnCadastrarBateria');
    if (btn) btn.innerHTML = 'Atualizar';
    
    document.querySelector('.card.compact').scrollIntoView({ behavior: 'smooth' });
    mostrarToast('Edite os campos e clique em Atualizar', 'info');
}

async function clonarBateria(id) {
    const bateria = window.AppState.baterias.find(b => b.id === id);
    if (!bateria) return;
    
    bateriaEditandoId = null;
    
    document.getElementById('batNome').value = (bateria.nome || '') + ' (Cópia)';
    document.getElementById('batTipo').value = bateria.tipo || 'ESTACIONARIA';
    document.getElementById('batGarantia').value = bateria.garantia || 5;
    document.getElementById('batCapacidade').value = bateria.capacidade || '';
    document.getElementById('batTensao').value = bateria.tensao || '';
    document.getElementById('batInmetro').value = bateria.inmetro || '';
    document.getElementById('batOutros').value = bateria.outros || '';
    
    imagemSelecionadaBateria = null;
    removerImagemBateria();
    
    const btn = document.getElementById('btnCadastrarBateria');
    if (btn) btn.innerHTML = 'Cadastrar Cópia';
    
    mostrarToast('Clone criado, clique em Cadastrar Cópia para salvar', 'info');
}

async function excluirBateria(id) {
    if (confirm('Tem certeza que deseja excluir esta bateria?')) {
        try {
            const bateria = window.AppState.baterias.find(b => b.id === id);

            await apiDelete(`/equipamentos/baterias/${id}`);
            mostrarToast('Bateria excluída!', 'success');
            await carregarBaterias();
            if (window.AppState.bateriaSelecionada?.id === id) {
                window.AppState.bateriaSelecionada = null;
                const batDiv = document.getElementById('bateriaSelecionada');
                if (batDiv) {
                    batDiv.innerHTML = 'Opcional';
                    batDiv.classList.add('empty');
                }
                if (typeof window.mostrarQuantidadeBateria === 'function') window.mostrarQuantidadeBateria(false);
            }
        } catch (error) {
            mostrarToast('Erro ao excluir', 'error');
        }
    }
}

// ============================================
// INICIALIZAR
// ============================================

function inicializarFiltrosBaterias() {
    const filtroTipo = document.getElementById('filtroTipoBateria');
    const filtroCapacidade = document.getElementById('filtroCapacidadeBateria');
    
    if (filtroTipo) {
        filtroTipo.removeEventListener('change', filtrarBaterias);
        filtroTipo.addEventListener('change', filtrarBaterias);
    }
    if (filtroCapacidade) {
        filtroCapacidade.removeEventListener('change', filtrarBaterias);
        filtroCapacidade.addEventListener('change', filtrarBaterias);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Não precisa mais de configuração extra
    console.log('✅ Upload de imagem para baterias configurado');
});

// ============================================
// EXPORTAR
// ============================================

window.selecionarBateriaLista = selecionarBateriaLista;
window.abrirModalBaterias = abrirModalBaterias;
window.abrirCadastroBateria = abrirCadastroBateria;
window.carregarBaterias = carregarBaterias;
window.cadastrarBateria = cadastrarBateria;
window.editarBateria = editarBateria;
window.clonarBateria = clonarBateria;
window.excluirBateria = excluirBateria;
window.filtrarBaterias = filtrarBaterias;
window.inicializarFiltrosBaterias = inicializarFiltrosBaterias;
window.removerImagemBateria = removerImagemBateria;
window.abrirSelecaoImagemBateria = abrirSelecaoImagemBateria;
window.filtrarBateriasModal = filtrarBateriasModal;
window.limparFiltrosModalBaterias = limparFiltrosModalBaterias;

console.log('✅ cadastro/baterias.js carregado com sucesso!');