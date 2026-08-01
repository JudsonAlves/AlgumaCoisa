// frontend/js/modules/cadastro/placas.js
// Funções de cadastro e gerenciamento de placas com imagens

console.log('🔍 placas.js carregado');

let placasCompletas = [];
let imagemSelecionada = null;
let placaEditandoId = null;

// ============================================
// FUNÇÕES DE IMAGEM
// ============================================

function gerarNomeImagem(placa) {
    // Remove acentos e caracteres especiais
    let marca = (placa.marca || '').trim();
    let modelo = (placa.modelo || '').trim();
    let tipo = (placa.tipo || '').trim();
    let potencia = placa.potencia || 0;
    
    // Limpa a string: remove acentos, espaços, caracteres especiais
    marca = marca.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    modelo = modelo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    tipo = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Remove caracteres especiais mantendo apenas letras e números
    marca = marca.replace(/[^A-Za-z0-9]/g, '');
    modelo = modelo.replace(/[^A-Za-z0-9]/g, '');
    tipo = tipo.replace(/[^A-Za-z0-9]/g, '');
    
    // Concatena: MARCA + MODELO + TIPO + POTENCIA + W
    let nome = `${marca}${modelo}${tipo}${potencia}W`;
    
    // Se ficou vazio, usa um fallback
    if (nome.length < 3) {
        nome = `PLACA${placa.id || Date.now()}${tipo}${potencia}W`;
    }
    
    nome = nome.toUpperCase();
    console.log(`📸 Nome gerado: ${nome}.jpg`);
    return `${nome}.jpg`;
}

function removerImagem() {
    imagemSelecionada = null;
    const preview = document.getElementById('previewImagem');
    const previewImg = document.getElementById('previewImg');
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    document.getElementById('placaImagem').value = '';
}

function configurarUploadImagem() {
    const inputFile = document.getElementById('placaImagem');
    if (!inputFile) return;
    
    // Não precisa do listener aqui porque a função abrirSelecaoImagemPlaca vai cuidar
}

function abrirSelecaoImagemPlaca() {
    const input = document.getElementById('placaImagem');
    const statusDiv = document.getElementById('statusUploadPlaca');
    const previewDiv = document.getElementById('previewImagem');
    const previewImg = document.getElementById('previewImg');
    
    if (!input) {
        console.error('Elemento placaImagem não encontrado');
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
            // Processa + faz upload para ImgBB, retorna URL pública
            const url = await window.processarEFazerUpload(
                file,
                'previewImg',
                'previewImagem',
                'statusUploadPlaca'
            );
            if (url) {
                imagemSelecionadaUrl = url;
                imagemSelecionada = true; // flag de compatibilidade
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

function removerImagem() {
    imagemSelecionada = null;
    imagemSelecionadaUrl = null;
    const preview = document.getElementById('previewImagem');
    const previewImg = document.getElementById('previewImg');
    const statusDiv = document.getElementById('statusUploadPlaca');
    
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (statusDiv) statusDiv.style.display = 'none';
    const input = document.getElementById('placaImagem');
    if (input) input.value = '';
    
    mostrarToast('Imagem removida', 'info');
}

// ============================================
// IMAGEM — ImgBB (upload direto, sem backend)
// imagemSelecionadaUrl armazena a URL retornada pelo ImgBB após seleção
// ============================================

let imagemSelecionadaUrl = null; // URL pública do ImgBB após upload

async function renomearImagemExistente(placaId, nomeAntigo, nomeNovo) {
    // No padrão ImgBB as URLs são permanentes — rename não necessário
    return true;
}

// ============================================
// SALVAR IMAGEM — retorna URL ImgBB ou null
// ============================================

async function salvarImagemPlaca(placaId, placaDados, nomeImagemAntiga = null) {
    // Se o usuário selecionou nova imagem, a URL já está em imagemSelecionadaUrl
    if (imagemSelecionadaUrl) {
        console.log(`📸 URL ImgBB disponível: ${imagemSelecionadaUrl}`);
        return imagemSelecionadaUrl;
    }
    // Sem imagem nova e sem URL anterior — não faz nada
    return null;
}

// ============================================
// FUNÇÃO PARA ATUALIZAR DETALHES DA PLACA
// ============================================

function atualizarDetalhesPlaca(placa) {
    const detalhesDiv = document.getElementById('detalhesPlaca');
    if (!detalhesDiv) return;
    
    // Calcula o fator de geração mensal da placa
    const he = placa.horas_efetivas || 5;
    const dg = placa.dias_geracao || 30;
    const fator = placa.fator_percentual || 0.85;
    const margem = placa.margem_percentual || 0.98;
    const fatorGeracao = (placa.potencia * he * dg * fator * margem) / 1000;
    
    const potDetalhe = document.getElementById('placaPotenciaDetalhe');
    const garantiaDetalhe = document.getElementById('placaGarantiaDetalhe');
    const garantiaGerDetalhe = document.getElementById('placaGarantiaGerDetalhe');
    const fatorGeracaoDetalhe = document.getElementById('placaFatorGeracaoDetalhe');
    const dimensoesDetalhe = document.getElementById('placaDimensoes');
    const outrosDetalhe = document.getElementById('placaOutrosDetalhe');
    
    if (potDetalhe) potDetalhe.innerHTML = `${placa.potencia} W`;
    if (garantiaDetalhe) garantiaDetalhe.innerHTML = `${placa.garantia || 12} anos`;
    if (garantiaGerDetalhe) garantiaGerDetalhe.innerHTML = `${placa.garantiager || 25} anos`;
    if (fatorGeracaoDetalhe) fatorGeracaoDetalhe.innerHTML = `${fatorGeracao.toFixed(2).replace('.', ',')} kWh`;
    if (dimensoesDetalhe) dimensoesDetalhe.innerHTML = `${placa.altura || '?'} x ${placa.largura || '?'} m`;
    if (outrosDetalhe) outrosDetalhe.innerHTML = placa.outros || '-';
}

// ============================================
// FUNÇÃO PARA ATUALIZAR FILTRO DE MARCAS
// ============================================

function atualizarFiltrosPlacas() {
    // Extrai marcas únicas (ignorando vazias)
    const marcas = [...new Set(placasCompletas.map(p => p.marca).filter(marca => marca && marca.trim() !== ''))];
    
    const selectMarca = document.getElementById('filtroMarcaPlaca');
    if (selectMarca) {
        // Mantém a opção "Todas as Marcas" e adiciona as marcas
        const opcoes = ['<option value="">Todas as Marcas</option>'];
        marcas.forEach(marca => {
            opcoes.push(`<option value="${marca}">${marca}</option>`);
        });
        selectMarca.innerHTML = opcoes.join('');
        
        console.log(`📊 Filtro de marcas atualizado: ${marcas.length} marcas encontradas`);
    }
    
    // Também atualiza o filtro de tipos se necessário
    const tipos = [...new Set(placasCompletas.map(p => p.tipo).filter(tipo => tipo && tipo.trim() !== ''))];
    const selectTipo = document.getElementById('filtroTipoPlaca');
    if (selectTipo && tipos.length > 0) {
        // Se já tem opções, não recria para não perder o valor selecionado
        if (selectTipo.options.length <= 1) {
            const opcoesTipo = ['<option value="">Todos os Tipos</option>'];
            tipos.forEach(tipo => {
                opcoesTipo.push(`<option value="${tipo}">${tipo}</option>`);
            });
            selectTipo.innerHTML = opcoesTipo.join('');
            console.log(`📊 Filtro de tipos atualizado: ${tipos.length} tipos encontrados`);
        }
    }
}

// ============================================
// FILTROS
// ============================================

function filtrarPlacas() {
    const marcaFiltro = document.getElementById('filtroMarcaPlaca')?.value || '';
    const tipoFiltro = document.getElementById('filtroTipoPlaca')?.value || '';
    
    let placasFiltradas = [...placasCompletas];
    
    if (marcaFiltro) {
        placasFiltradas = placasFiltradas.filter(p => p.marca === marcaFiltro);
    }
    
    if (tipoFiltro) {
        placasFiltradas = placasFiltradas.filter(p => p.tipo === tipoFiltro);
    }
    
    const container = document.getElementById('listaPlacasContent');
    if (!container) return;
    
    if (placasFiltradas.length === 0) {
        container.innerHTML = '<div class="empty-list">Nenhuma placa encontrada</div>';
        return;
    }
    
    container.innerHTML = placasFiltradas.map(placa => {
        // Calcula o fator de geração mensal da placa
        const he = placa.horas_efetivas || 5;
        const dg = placa.dias_geracao || 30;
        const fator = placa.fator_percentual || 0.85;
        const margem = placa.margem_percentual || 0.98;
        const fatorGeracao = (placa.potencia * he * dg * fator * margem) / 1000;
        
        // Formata o fator de geração com 2 casas decimais
        const fatorGeracaoFormatado = fatorGeracao.toFixed(2).replace('.', ',');
        
        const infoAdicional = [
            `Garantia: ${placa.garantia || 12} anos`,
            `Garantia Geração: ${placa.garantiager || 25} anos`,
            `Fator de Geração: ${fatorGeracaoFormatado} kWh`
        ];
        
        // Monta o título completo: PAINEL SOLAR MARCA MODELO POTENCIAW TIPO OUTROS
        const marca = placa.marca || '';
        const modelo = placa.modelo || '';
        const potencia = placa.potencia || 0;
        const tipo = placa.tipo || '';
        const outros = placa.outros || '';
        
        let tituloCompleto = `PAINEL SOLAR ${marca}`;
        if (modelo) tituloCompleto += ` ${modelo}`;
        tituloCompleto += ` ${potencia}W`;
        if (tipo) tituloCompleto += ` ${tipo}`;
        if (outros) tituloCompleto += ` ${outros}`;
        
        const imagemSrc = placa.imagem_url || '/assets/images/placas/modelo.jpg';
        
        return `
            <div class="list-item" onclick="selecionarPlacaLista(${placa.id})">
                <div class="item-imagem">
                    <img src="${imagemSrc}" 
                         onerror="this.src='/assets/images/placas/modelo.jpg'"
                         style="width:70px;height:70px;object-fit:contain">
                </div>
                <div class="item-info">
                    <div class="item-title">${tituloCompleto}</div>
                    <div class="item-subtitle">${infoAdicional.join(' | ')}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editarPlaca(${placa.id})" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); clonarPlaca(${placa.id})" title="Clonar">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); excluirPlaca(${placa.id})" title="Excluir">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// CARREGAR
// ============================================

async function carregarPlacas() {
    try {
        console.log('📡 Buscando placas na API...');
        const placas = await apiGet('/equipamentos/placas');
        console.log('✅ Placas recebidas:', placas.length);
        
        window.AppState.placas = placas;
        placasCompletas = [...placas];
        
        // Atualiza os filtros ANTES de filtrar as placas
        atualizarFiltrosPlacas();
        
        // Agora filtra e exibe as placas
        filtrarPlacas();
        
    } catch (error) {
        console.error('❌ Erro ao carregar placas:', error);
        mostrarToast('Erro ao carregar placas do servidor', 'error');
    }
}

// ============================================
// SELEÇÃO
// ============================================

function selecionarPlacaLista(id) {
    const placa = window.AppState.placas.find(p => p.id === id);
    if (!placa) return;
    
    window.AppState.placaSelecionada = placa;
    
    const placaDiv = document.getElementById('placaSelecionada');
    const detalhesDiv = document.getElementById('detalhesPlaca');
    
    if (placaDiv) {
        // Monta o título completo com OUTROS
        const marca = placa.marca || '';
        const modelo = placa.modelo || '';
        const potencia = placa.potencia || 0;
        const tipo = placa.tipo || '';
        const outros = placa.outros || '';
        
        let tituloCompleto = `PAINEL SOLAR ${marca}`;
        if (modelo) tituloCompleto += ` ${modelo}`;
        tituloCompleto += ` ${potencia}W`;
        if (tipo) tituloCompleto += ` ${tipo}`;
        if (outros) tituloCompleto += ` ${outros}`;
        
        placaDiv.innerHTML = tituloCompleto;
        placaDiv.classList.remove('empty');
    }
    
    if (detalhesDiv) {
        detalhesDiv.style.display = 'block';
        atualizarDetalhesPlaca(placa);
    }
    
    if (typeof window.mostrarQuantidadePlaca === 'function') window.mostrarQuantidadePlaca(true);
    window.quantidadePlacaManual = null;
    const qtdInput = document.getElementById('placaQuantidade');
    if (qtdInput) qtdInput.value = '1';
    
    if (typeof window.fecharModal === 'function') window.fecharModal();
    if (typeof window.recalcularOrcamento === 'function') window.recalcularOrcamento();
    mostrarToast(`PAINEL SOLAR ${placa.marca} ${placa.modelo} ${placa.potencia}W selecionado!`, 'success');
}

// ============================================
// MODAL
// ============================================

function abrirModalPlacas() {
    const modal = document.getElementById('modalSelecao');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal) {
        console.error('Modal não encontrado');
        mostrarToast('Erro ao abrir modal', 'error');
        return;
    }
    
    modalTitle.innerHTML = 'Selecionar Placa Solar';
    modal.classList.add('active');
    
    if (!window.AppState.placas || window.AppState.placas.length === 0) {
        modalBody.innerHTML = `
            <div class="empty-list">
                <i data-lucide="alert-circle"></i>
                <p>Nenhuma placa cadastrada</p>
                <small>Cadastre uma placa no menu "Placas"</small>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    // Extrai marcas únicas para o filtro
    const marcas = [...new Set(window.AppState.placas.map(p => p.marca).filter(m => m && m.trim() !== ''))];
    
    // Monta o HTML do modal com filtro
    modalBody.innerHTML = `
        <div class="modal-filtros">
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Marca:</label>
                <select id="modalFiltroMarca" class="filtro-select">
                    <option value="">Todas as Marcas</option>
                    ${marcas.map(marca => `<option value="${marca}">${marca}</option>`).join('')}
                </select>
            </div>
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Potência:</label>
                <select id="modalFiltroPotencia" class="filtro-select">
                    <option value="">Todas as Potências</option>
                    <option value="300-400">300W - 400W</option>
                    <option value="401-500">401W - 500W</option>
                    <option value="501-600">501W - 600W</option>
                    <option value="601-700">601W - 700W</option>
                    <option value="701+">Acima de 700W</option>
                </select>
            </div>
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Tipo:</label>
                <select id="modalFiltroTipo" class="filtro-select">
                    <option value="">Todos os Tipos</option>
                    <option value="MONOFACIAL">MONOFACIAL</option>
                    <option value="BIFACIAL">BIFACIAL</option>
                    <option value="MONOCRISTALINO">MONOCRISTALINO</option>
                    <option value="N TYPE">N TYPE</option>
                    <option value="N TYPE BIFACIAL">N TYPE BIFACIAL</option>
                </select>
            </div>
            <div class="filtro-actions">
                <button class="btn-small" onclick="limparFiltrosModalPlacas()">Limpar Filtros</button>
                <span class="contador-placas" id="contadorPlacasModal">${window.AppState.placas.length} placas</span>
            </div>
        </div>
        <div class="lista-itens-container" id="modalListaPlacas">
            ${renderizarListaPlacasModal(window.AppState.placas)}
        </div>
    `;
    
    // Adicionar listeners para os filtros
    const filtroMarca = document.getElementById('modalFiltroMarca');
    const filtroPotencia = document.getElementById('modalFiltroPotencia');
    const filtroTipo = document.getElementById('modalFiltroTipo');
    
    if (filtroMarca) filtroMarca.addEventListener('change', () => filtrarPlacasModal());
    if (filtroPotencia) filtroPotencia.addEventListener('change', () => filtrarPlacasModal());
    if (filtroTipo) filtroTipo.addEventListener('change', () => filtrarPlacasModal());
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Função para renderizar a lista de placas no modal
function renderizarListaPlacasModal(placas) {
    if (!placas || placas.length === 0) {
        return '<div class="empty-list">Nenhuma placa encontrada</div>';
    }
    
    return placas.map(placa => {
        // Monta o título completo
        const marca = placa.marca || '';
        const modelo = placa.modelo || '';
        const potencia = placa.potencia || 0;
        const tipo = placa.tipo || '';
        const outros = placa.outros || '';
        
        let tituloCompleto = `PAINEL SOLAR ${marca}`;
        if (modelo) tituloCompleto += ` ${modelo}`;
        tituloCompleto += ` ${potencia}W`;
        if (tipo) tituloCompleto += ` ${tipo}`;
        if (outros) tituloCompleto += ` ${outros}`;
        
        const infoAdicional = [];
        if (placa.garantia) infoAdicional.push(`Garantia: ${placa.garantia} anos`);
        if (placa.garantiager) infoAdicional.push(`Geração: ${placa.garantiager} anos`);
        
        return `
            <div class="list-item" onclick="selecionarPlacaLista(${placa.id})">
                <div class="item-info">
                    <div class="item-title">${tituloCompleto}</div>
                    <div class="item-subtitle">${infoAdicional.join(' | ')}</div>
                </div>
                <div class="item-value">${potencia}W</div>
            </div>
        `;
    }).join('');
}

// Função para filtrar placas no modal
function filtrarPlacasModal() {
    const filtroMarca = document.getElementById('modalFiltroMarca')?.value || '';
    const filtroPotencia = document.getElementById('modalFiltroPotencia')?.value || '';
    const filtroTipo = document.getElementById('modalFiltroTipo')?.value || '';
    
    let placasFiltradas = [...window.AppState.placas];
    
    // Filtrar por marca
    if (filtroMarca) {
        placasFiltradas = placasFiltradas.filter(p => p.marca === filtroMarca);
    }
    
    // Filtrar por tipo
    if (filtroTipo) {
        placasFiltradas = placasFiltradas.filter(p => p.tipo === filtroTipo);
    }
    
    // Filtrar por potência
    if (filtroPotencia) {
        placasFiltradas = placasFiltradas.filter(p => {
            const potencia = p.potencia || 0;
            switch(filtroPotencia) {
                case '300-400': return potencia >= 300 && potencia <= 400;
                case '401-500': return potencia >= 401 && potencia <= 500;
                case '501-600': return potencia >= 501 && potencia <= 600;
                case '601-700': return potencia >= 601 && potencia <= 700;
                case '701+': return potencia >= 701;
                default: return true;
            }
        });
    }
    
    // Atualizar a lista
    const container = document.getElementById('modalListaPlacas');
    const contador = document.getElementById('contadorPlacasModal');
    
    if (container) {
        container.innerHTML = renderizarListaPlacasModal(placasFiltradas);
    }
    
    if (contador) {
        contador.innerHTML = `${placasFiltradas.length} placas`;
    }
}

// Função para limpar filtros do modal
function limparFiltrosModalPlacas() {
    const filtroMarca = document.getElementById('modalFiltroMarca');
    const filtroPotencia = document.getElementById('modalFiltroPotencia');
    const filtroTipo = document.getElementById('modalFiltroTipo');
    
    if (filtroMarca) filtroMarca.value = '';
    if (filtroPotencia) filtroPotencia.value = '';
    if (filtroTipo) filtroTipo.value = '';
    
    filtrarPlacasModal();
}

function abrirCadastroPlaca() {
    const placaNav = document.querySelector('[data-page="placas"]');
    if (placaNav) placaNav.click();
}

// ============================================
// CADASTRO (CRIAR/ATUALIZAR)
// ============================================

async function cadastrarPlaca() {
    const marca = document.getElementById('placaMarca')?.value.trim();
    const modelo = document.getElementById('placaModelo')?.value.trim();
    const potencia = parseFloat(document.getElementById('placaPotencia')?.value);
    const tipo = document.getElementById('placaTipo')?.value;
    const altura = parseFloat(document.getElementById('placaAltura')?.value);
    const largura = parseFloat(document.getElementById('placaLargura')?.value);
    const garantia = parseInt(document.getElementById('placaGarantia')?.value);
    const garantiaGer = parseInt(document.getElementById('placaGarantiaGer')?.value);
    const inmetro = document.getElementById('placaInmetro')?.value;
    const outros = document.getElementById('placaOutros')?.value;
    
    if (!marca || !potencia) {
        mostrarToast('❌ Preencha marca e potência!', 'error');
        return;
    }
    
    const dados = { 
        marca, modelo, potencia, tipo, altura, largura, 
        garantia, garantiager: garantiaGer, inmetro, outros 
    };
    
    const btn = document.getElementById('btnCadastrarPlaca');
    const textoOriginal = btn?.innerHTML || 'Cadastrar';
    if (btn) {
        btn.innerHTML = '⏳ Salvando...';
        btn.disabled = true;
    }
    
    try {
        let result;
        let placaId;
        if (placaEditandoId) {
            result = await apiPut(`/equipamentos/placas/${placaEditandoId}`, dados);
            if (result) {
                placaId = placaEditandoId;
                mostrarToast('✅ Placa atualizada!', 'success');
                placaEditandoId = null;
                if (btn) btn.innerHTML = 'Cadastrar';
            }
        } else {
            console.log('➕ Criando nova placa');
            result = await apiPost('/equipamentos/placas', dados);
            if (result) {
                placaId = result.id;
                console.log(`✅ Placa criada com ID: ${placaId}`);
                mostrarToast('✅ Placa cadastrada!', 'success');
            }
        }
        
        if (result && placaId) {
            // Se há URL de imagem nova, atualiza o registro com a URL
            if (imagemSelecionadaUrl) {
                await apiPut(`/equipamentos/placas/${placaId}`, { ...dados, imagem_url: imagemSelecionadaUrl });
                console.log('✅ URL da imagem salva:', imagemSelecionadaUrl);
            }
            
            // Limpar formulário
            document.getElementById('placaMarca').value = '';
            document.getElementById('placaModelo').value = '';
            document.getElementById('placaPotencia').value = '';
            document.getElementById('placaAltura').value = '';
            document.getElementById('placaLargura').value = '';
            document.getElementById('placaGarantia').value = '12';
            document.getElementById('placaGarantiaGer').value = '25';
            document.getElementById('placaInmetro').value = '000000/2000';
            document.getElementById('placaOutros').value = '';
            imagemSelecionadaUrl = null;
            removerImagem();
            
            await carregarPlacas();
        }
    } catch (error) {
        console.error('❌ Erro ao salvar placa:', error);
        mostrarToast(`Erro ao salvar: ${error.message}`, 'error');
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

async function editarPlaca(id) {
    const placa = window.AppState.placas.find(p => p.id === id);
    if (!placa) return;
    
    console.log('✏️ Editando placa:', placa);
    
    placaEditandoId = id;
    
    document.getElementById('placaMarca').value = placa.marca || '';
    document.getElementById('placaModelo').value = placa.modelo || '';
    document.getElementById('placaPotencia').value = placa.potencia || '';
    document.getElementById('placaTipo').value = placa.tipo || 'MONOFACIAL';
    document.getElementById('placaAltura').value = placa.altura || '';
    document.getElementById('placaLargura').value = placa.largura || '';
    document.getElementById('placaGarantia').value = placa.garantia || 12;
    document.getElementById('placaGarantiaGer').value = placa.garantiager || 25;
    document.getElementById('placaInmetro').value = placa.inmetro || '';
    document.getElementById('placaOutros').value = placa.outros || '';
    
    imagemSelecionada = null;
    removerImagem();
    
    const btn = document.getElementById('btnCadastrarPlaca');
    if (btn) btn.innerHTML = 'Atualizar';
    
    document.querySelector('.card.compact').scrollIntoView({ behavior: 'smooth' });
    mostrarToast(`Editando placa: ${placa.marca} ${placa.modelo}`, 'info');
}

async function clonarPlaca(id) {
    const placa = window.AppState.placas.find(p => p.id === id);
    if (!placa) return;
    
    console.log('📋 Clonando placa:', placa);
    
    placaEditandoId = null;
    
    document.getElementById('placaMarca').value = placa.marca || '';
    document.getElementById('placaModelo').value = (placa.modelo || '') + ' (Cópia)';
    document.getElementById('placaPotencia').value = placa.potencia || '';
    document.getElementById('placaTipo').value = placa.tipo || 'MONOFACIAL';
    document.getElementById('placaAltura').value = placa.altura || '';
    document.getElementById('placaLargura').value = placa.largura || '';
    document.getElementById('placaGarantia').value = placa.garantia || 12;
    document.getElementById('placaGarantiaGer').value = placa.garantiager || 25;
    document.getElementById('placaInmetro').value = placa.inmetro || '';
    document.getElementById('placaOutros').value = placa.outros || '';
    
    imagemSelecionada = null;
    removerImagem();
    
    const btn = document.getElementById('btnCadastrarPlaca');
    if (btn) btn.innerHTML = 'Cadastrar Cópia';
    
    document.querySelector('.card.compact').scrollIntoView({ behavior: 'smooth' });
    mostrarToast('Clone criado, clique em Cadastrar Cópia para salvar', 'info');
}

async function excluirPlaca(id) {
    if (confirm('Tem certeza que deseja excluir esta placa?')) {
        try {
            const placa = window.AppState.placas.find(p => p.id === id);
            // Imagem está no ImgBB — não há deleção necessária no backend
            
            await apiDelete(`/equipamentos/placas/${id}`);
            mostrarToast('Placa excluída!', 'success');
            await carregarPlacas();
            if (window.AppState.placaSelecionada?.id === id) {
                window.AppState.placaSelecionada = null;
                const placaDiv = document.getElementById('placaSelecionada');
                if (placaDiv) {
                    placaDiv.innerHTML = 'Clique para selecionar uma placa';
                    placaDiv.classList.add('empty');
                }
                if (typeof window.mostrarQuantidadePlaca === 'function') window.mostrarQuantidadePlaca(false);
            }
        } catch (error) {
            console.error('❌ Erro ao excluir:', error);
            mostrarToast('Erro ao excluir placa', 'error');
        }
    }
}

// ============================================
// INICIALIZAR
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Upload de imagem configurado');
});

// ============================================
// INICIALIZAR FILTROS DA PÁGINA PLACAS
// ============================================

function inicializarFiltrosPlacas() {
    console.log('🎨 Inicializando filtros de placas...');
    
    // Verificar se os elementos existem
    const filtroMarca = document.getElementById('filtroMarcaPlaca');
    const filtroTipo = document.getElementById('filtroTipoPlaca');
    
    if (!filtroMarca && !filtroTipo) {
        console.log('⚠️ Filtros não encontrados na página atual');
        return;
    }
    
    // Se já tem placas carregadas, atualiza os filtros
    if (placasCompletas && placasCompletas.length > 0) {
        console.log(`📊 Atualizando filtros com ${placasCompletas.length} placas`);
        atualizarFiltrosPlacas();
    } else {
        console.log('📊 Nenhuma placa carregada ainda, aguardando...');
    }
    
    // Adicionar listeners para os filtros
    if (filtroMarca) {
        // Remove listener antigo se existir
        filtroMarca.removeEventListener('change', filtrarPlacas);
        filtroMarca.addEventListener('change', filtrarPlacas);
        console.log('✅ Listener do filtro de marca adicionado');
    }
    
    if (filtroTipo) {
        filtroTipo.removeEventListener('change', filtrarPlacas);
        filtroTipo.addEventListener('change', filtrarPlacas);
        console.log('✅ Listener do filtro de tipo adicionado');
    }
}

// Modifique a função carregarPlacas para também chamar inicializarFiltrosPlacas
async function carregarPlacas() {
    try {
        console.log('📡 Buscando placas na API...');
        const placas = await apiGet('/equipamentos/placas');
        console.log('✅ Placas recebidas:', placas.length);
        
        window.AppState.placas = placas;
        placasCompletas = [...placas];
        
        // Atualiza os filtros ANTES de filtrar as placas
        atualizarFiltrosPlacas();
        
        // Agora filtra e exibe as placas
        filtrarPlacas();
        
        // Garantir que os filtros estão configurados
        inicializarFiltrosPlacas();
        
    } catch (error) {
        console.error('❌ Erro ao carregar placas:', error);
        mostrarToast('Erro ao carregar placas do servidor', 'error');
    }
}

// Modifique a função atualizarFiltrosPlacas para garantir que os selects existem
function atualizarFiltrosPlacas() {
    // Extrai marcas únicas (ignorando vazias)
    const marcas = [...new Set(placasCompletas.map(p => p.marca).filter(marca => marca && marca.trim() !== ''))];
    
    const selectMarca = document.getElementById('filtroMarcaPlaca');
    if (selectMarca) {
        // Guarda o valor selecionado atual
        const valorSelecionado = selectMarca.value;
        
        // Mantém a opção "Todas as Marcas" e adiciona as marcas
        const opcoes = ['<option value="">Todas as Marcas</option>'];
        marcas.forEach(marca => {
            opcoes.push(`<option value="${marca}">${marca}</option>`);
        });
        selectMarca.innerHTML = opcoes.join('');
        
        // Restaura o valor selecionado se ainda existir
        if (valorSelecionado && marcas.includes(valorSelecionado)) {
            selectMarca.value = valorSelecionado;
        }
        
        console.log(`📊 Filtro de marcas atualizado: ${marcas.length} marcas encontradas`);
    }
    
    // Extrai tipos únicos
    const tipos = [...new Set(placasCompletas.map(p => p.tipo).filter(tipo => tipo && tipo.trim() !== ''))];
    const selectTipo = document.getElementById('filtroTipoPlaca');
    if (selectTipo) {
        const valorSelecionado = selectTipo.value;
        const opcoesTipo = ['<option value="">Todos os Tipos</option>'];
        tipos.forEach(tipo => {
            opcoesTipo.push(`<option value="${tipo}">${tipo}</option>`);
        });
        selectTipo.innerHTML = opcoesTipo.join('');
        
        if (valorSelecionado && tipos.includes(valorSelecionado)) {
            selectTipo.value = valorSelecionado;
        }
        
        console.log(`📊 Filtro de tipos atualizado: ${tipos.length} tipos encontrados`);
    }
}

// ============================================
// EXPORTAR (adicione inicializarFiltrosPlacas)
// ============================================

window.selecionarPlacaLista = selecionarPlacaLista;
window.abrirModalPlacas = abrirModalPlacas;
window.abrirCadastroPlaca = abrirCadastroPlaca;
window.carregarPlacas = carregarPlacas;
window.cadastrarPlaca = cadastrarPlaca;
window.editarPlaca = editarPlaca;
window.clonarPlaca = clonarPlaca;
window.excluirPlaca = excluirPlaca;
window.filtrarPlacas = filtrarPlacas;
window.removerImagem = removerImagem;
window.inicializarFiltrosPlacas = inicializarFiltrosPlacas;
window.filtrarPlacasModal = filtrarPlacasModal;
window.limparFiltrosModalPlacas = limparFiltrosModalPlacas;
window.renderizarListaPlacasModal = renderizarListaPlacasModal;
window.abrirSelecaoImagemPlaca = abrirSelecaoImagemPlaca;

console.log('✅ cadastro/placas.js carregado com sucesso!');