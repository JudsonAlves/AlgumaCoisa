// frontend/js/modules/cadastro/inversores.js
// Funções de cadastro e gerenciamento de inversores

console.log('🔌 inversores.js carregado');

let inversoresCompletos = [];
let inversorEditandoId = null;
let imagemSelecionadaInversor = null;
let imagemSelecionadaUrlInversor = null;

// ============================================
// FUNÇÕES DE IMAGEM (EXATAMENTE IGUAL AO PLACAS.JS)
// ============================================

function gerarNomeImagemInversor(inversor) {
    // Remove acentos e caracteres especiais
    let marca = (inversor.marca || '').trim();
    let modelo = (inversor.modelo || '').trim();
    let tipo = (inversor.tipo || '').trim();
    let potencia = inversor.potencia || 0;
    let tensao = inversor.tensao || (potencia <= 12000 ? '220' : '380');
    let fase = inversor.fase || (potencia <= 12000 ? 'MONOFASICO' : 'TRIFASICO');
    let outros = (inversor.outros || '').trim();
    
    // Converte potência para kW mantendo as casas decimais
    // Usamos a potência original com ponto para diferenciar 7.5 de 75
    let potenciaKW = (potencia / 1000).toString();
    // Substitui ponto por virgula? Não, mantém ponto para o nome do arquivo
    // Ex: 2250 -> 2.25, 7500 -> 7.5, 75000 -> 75
    
    // Limpa a string: remove acentos, espaços, caracteres especiais
    marca = marca.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    modelo = modelo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    tipo = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    fase = fase.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    outros = outros.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Remove caracteres especiais mantendo apenas letras e números
    marca = marca.replace(/[^A-Za-z0-9]/g, '');
    modelo = modelo.replace(/[^A-Za-z0-9]/g, '');
    tipo = tipo.replace(/[^A-Za-z0-9]/g, '');
    fase = fase.replace(/[^A-Za-z0-9]/g, '');
    outros = outros.replace(/[^A-Za-z0-9]/g, '');
    
    // Concatena: MARCA + MODELO + TIPO + POTENCIAKW + KW + TENSAO + V + FASE + OUTROS
    // Exemplos:
    // 7.5kW 220V MONOFASICO -> DEYEDONGONGRID75KW220VMONOFASICO.png
    // 75kW 220V MONOFASICO -> DEYEDONGONGRID75KW220VMONOFASICO.png (diferente? ainda igual)
    // Vamos usar a potência com ponto para diferenciar: 7.5 vs 75
    // Mas ponto não pode no nome do arquivo, então vamos usar "P" para representar ponto
    let potenciaKWFormatado = potenciaKW.replace('.', 'P');
    
    let nome = `${marca}${modelo}${tipo}${potenciaKWFormatado}KW${tensao}V${fase}`;
    if (outros) {
        nome += outros.toUpperCase();
    }
    
    // Se ficou vazio, usa um fallback
    if (nome.length < 5) {
        nome = `INVERSOR${inversor.id || Date.now()}${potenciaKWFormatado}KW`;
    }
    
    nome = nome.toUpperCase();
    console.log(`📸 Nome gerado: ${nome}.png`);
    return `${nome}.png`;
}

function removerImagemInversor() {
    imagemSelecionadaInversor = null;
    imagemSelecionadaUrlInversor = null;
    const preview = document.getElementById('previewImagemInversor');
    const previewImg = document.getElementById('previewImgInversor');
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    document.getElementById('invImagem').value = '';
}

function configurarUploadImagemInversor() {
    const inputFile = document.getElementById('invImagem');
    if (!inputFile) return;
    
    // Adicionar indicador visual no botão
    const botaoSelecionar = document.getElementById('btnSelecionarImagemInversor') || 
                            inputFile?.parentElement?.querySelector('.btn-small');
    
    inputFile.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        console.log(`📸 Arquivo selecionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        
        // Mostrar loading no preview
        const previewDiv = document.getElementById('previewImagemInversor');
        const previewImg = document.getElementById('previewImgInversor');
        
        if (previewDiv) {
            previewDiv.style.display = 'block';
            if (previewImg) {
                previewImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="none" stroke="%232ecc71" stroke-width="4"%3E%3CanimateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1s" repeatCount="indefinite"/%3E%3C/circle%3E%3C/svg%3E';
                previewImg.style.maxWidth = '100px';
                previewImg.style.maxHeight = '100px';
                previewImg.style.objectFit = 'contain';
            }
        }
        
        // Desabilitar botão durante o processamento
        if (botaoSelecionar) {
            botaoSelecionar.disabled = true;
            botaoSelecionar.innerHTML = '<i data-lucide="loader-circle"></i> Processando...';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        
        mostrarToastProgresso('🔄 Processando imagem... (redimensionando)', 'info', 2000);
        
        try {
            // Processar imagem (redimensionar para 500px)
            console.log('📸 Iniciando processamento da imagem...');
            const processedBlob = await window.imageProcessor.processImage(file);
            console.log('✅ Imagem redimensionada com sucesso');
            
            mostrarToastProgresso('🎨 Removendo fundo da imagem...', 'info', 2000);
            
            // Remover fundo
            const noBgBlob = await window.imageProcessor.removeBackground(processedBlob);
            console.log('✅ Fundo removido com sucesso');
            
            // Criar preview
            const previewUrl = URL.createObjectURL(noBgBlob);
            
            if (previewImg) {
                previewImg.src = previewUrl;
                previewImg.style.maxWidth = '100px';
                previewImg.style.maxHeight = '100px';
                previewImg.style.objectFit = 'contain';
            }
            if (previewDiv) {
                previewDiv.style.display = 'block';
                // Adicionar classe de sucesso no preview
                previewDiv.style.border = '2px solid #2ecc71';
                setTimeout(() => {
                    if (previewDiv) previewDiv.style.border = '';
                }, 1000);
            }
            
            imagemSelecionadaInversor = noBgBlob;
            console.log(`✅ Imagem processada e armazenada. Tamanho: ${(noBgBlob.size / 1024).toFixed(2)} KB`);
            mostrarToastProgresso(`✅ Imagem "${file.name}" processada com sucesso!`, 'success', 3000);
            
            // Mostrar nome do arquivo no preview
            if (previewDiv) {
                const nomeArquivoSpan = document.createElement('small');
                nomeArquivoSpan.style.display = 'block';
                nomeArquivoSpan.style.fontSize = '10px';
                nomeArquivoSpan.style.color = '#2ecc71';
                nomeArquivoSpan.innerHTML = `📷 ${file.name.substring(0, 30)}${file.name.length > 30 ? '...' : ''}`;
                
                const spanAntigo = previewDiv.querySelector('.nome-arquivo');
                if (spanAntigo) spanAntigo.remove();
                nomeArquivoSpan.className = 'nome-arquivo';
                previewDiv.appendChild(nomeArquivoSpan);
            }
            
        } catch (error) {
            console.error('❌ Erro ao processar imagem:', error);
            mostrarToastProgresso('❌ Erro ao processar imagem, usando imagem original', 'error', 3000);
            
            // Fallback: usar imagem original redimensionada
            try {
                const fallbackBlob = await window.imageProcessor.processImage(file);
                const fallbackUrl = URL.createObjectURL(fallbackBlob);
                if (previewImg) previewImg.src = fallbackUrl;
                imagemSelecionadaInversor = fallbackBlob;
                mostrarToastProgresso('⚠️ Imagem original redimensionada (sem remoção de fundo)', 'warning', 3000);
            } catch (fallbackError) {
                console.error('❌ Erro no fallback:', fallbackError);
            }
        } finally {
            // Reativar botão
            if (botaoSelecionar) {
                botaoSelecionar.disabled = false;
                botaoSelecionar.innerHTML = '<i data-lucide="image"></i> Selecionar Imagem';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    });
}

function abrirSelecaoImagemInversor() {
    const input = document.getElementById('invImagem');
    const statusDiv = document.getElementById('statusUploadInversor');
    const previewDiv = document.getElementById('previewImagemInversor');
    const previewImg = document.getElementById('previewImgInversor');
    
    if (!input) {
        console.error('Elemento invImagem não encontrado');
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
                'previewImgInversor',
                'previewImagemInversor',
                'statusUploadInversor'
            );
            if (url) {
                imagemSelecionadaUrlInversor = url;
                imagemSelecionadaInversor = true;
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

async function renomearImagemExistenteInversor(inversorId, nomeAntigo, nomeNovo) {
    if (nomeAntigo === nomeNovo) {
        console.log(`📸 Nome da imagem não mudou: ${nomeNovo}`);
        return true;
    }
    
    console.log(`🔄 Renomeando imagem: ${nomeAntigo} → ${nomeNovo}`);
    
    return true; // ImgBB — URLs permanentes, rename desnecessário
}

async function salvarImagemInversor(inversorId, inversorDados, nomeImagemAntiga = null) {
    if (imagemSelecionadaUrlInversor) {
        return imagemSelecionadaUrlInversor;
    }
    return null;
}

// ============================================
// FUNÇÃO PARA FORMATAR POTÊNCIA EM kW
// ============================================

function formatarPotenciaKW(potencia) {
    let kw = (potencia / 1000).toFixed(2);
    kw = kw.replace(/\.?0+$/, '');
    kw = kw.replace('.', ',');
    return kw;
}

// ============================================
// FUNÇÃO PARA ATUALIZAR DETALHES DO INVERSOR
// ============================================

function atualizarDetalhesInversor(inversor) {
    const detalhesDiv = document.getElementById('detalhesInversor');
    if (!detalhesDiv) return;
    
    const tipoDetalhe = document.getElementById('inversorTipoDetalhe');
    const potenciaDetalhe = document.getElementById('inversorPotenciaDetalhe');
    const potenciaMinDetalhe = document.getElementById('inversorPotenciaMinDetalhe');
    const potenciaMaxDetalhe = document.getElementById('inversorPotenciaMaxDetalhe');
    const tensaoDetalhe = document.getElementById('inversorTensaoDetalhe');
    const faseDetalhe = document.getElementById('inversorFaseDetalhe');
    const garantiaDetalhe = document.getElementById('inversorGarantiaDetalhe');
    const inmetroDetalhe = document.getElementById('inversorInmetroDetalhe');
    const outrosDetalhe = document.getElementById('inversorOutrosDetalhe');
    
    const potenciaKW = formatarPotenciaKW(inversor.potencia);
    
    if (tipoDetalhe) tipoDetalhe.innerHTML = inversor.tipo;
    if (potenciaDetalhe) potenciaDetalhe.innerHTML = `${inversor.potencia} W (${potenciaKW} kW)`;
    if (potenciaMinDetalhe) potenciaMinDetalhe.innerHTML = `${inversor.potencia_min} W (${formatarPotenciaKW(inversor.potencia_min)} kW) - 70%`;
    if (potenciaMaxDetalhe) potenciaMaxDetalhe.innerHTML = `${inversor.potencia_max} W (${formatarPotenciaKW(inversor.potencia_max)} kW) - 150%`;
    if (tensaoDetalhe) tensaoDetalhe.innerHTML = inversor.tensao;
    if (faseDetalhe) faseDetalhe.innerHTML = inversor.fase;
    if (garantiaDetalhe) garantiaDetalhe.innerHTML = `${inversor.garantia || 10} anos`;
    if (inmetroDetalhe) inmetroDetalhe.innerHTML = inversor.inmetro || '-';
    if (outrosDetalhe) outrosDetalhe.innerHTML = inversor.outros || '-';
}

// ============================================
// FUNÇÃO PARA ATUALIZAR FILTRO DE MARCAS
// ============================================

function atualizarFiltrosInversores() {
    const marcas = [...new Set(inversoresCompletos.map(i => i.marca).filter(marca => marca && marca.trim() !== ''))];
    
    const selectMarca = document.getElementById('filtroMarcaInversor');
    if (selectMarca) {
        const opcoes = ['<option value="">Todas as Marcas</option>'];
        marcas.forEach(marca => {
            opcoes.push(`<option value="${marca}">${marca}</option>`);
        });
        selectMarca.innerHTML = opcoes.join('');
        console.log(`📊 Filtro de marcas atualizado: ${marcas.length} marcas`);
    }
}

// ============================================
// FILTRAR INVERSORES (COM IMAGEM PERSONALIZADA)
// ============================================

function filtrarInversores() {
    const marcaFiltro = document.getElementById('filtroMarcaInversor')?.value || '';
    const tipoFiltro = document.getElementById('filtroTipoInversor')?.value || '';
    const potenciaFiltro = document.getElementById('filtroPotenciaInversor')?.value || '';
    
    let inversoresFiltrados = [...inversoresCompletos];
    
    if (marcaFiltro) inversoresFiltrados = inversoresFiltrados.filter(i => i.marca === marcaFiltro);
    if (tipoFiltro) inversoresFiltrados = inversoresFiltrados.filter(i => i.tipo === tipoFiltro);
    
    if (potenciaFiltro) {
        inversoresFiltrados = inversoresFiltrados.filter(i => {
            const potencia = i.potencia || 0;
            switch(potenciaFiltro) {
                case '0-3000': return potencia <= 3000;
                case '3001-5000': return potencia >= 3001 && potencia <= 5000;
                case '5001-10000': return potencia >= 5001 && potencia <= 10000;
                case '10001-15000': return potencia >= 10001 && potencia <= 15000;
                case '15000+': return potencia >= 15001;
                default: return true;
            }
        });
    }
    
    const container = document.getElementById('listaInversoresContent');
    if (!container) return;
    
    if (inversoresFiltrados.length === 0) {
        container.innerHTML = '<div class="empty-list">Nenhum inversor encontrado</div>';
        return;
    }
    
    container.innerHTML = inversoresFiltrados.map(inv => {
        // Gera o nome da imagem com base nos dados do inversor
        const imagemSrc = inv.imagem_url || '/assets/images/inversores/padraoongrid.png';
        
        const marca = inv.marca || '';
        const modelo = inv.modelo || '';
        const tipo = inv.tipo || '';
        const outros = inv.outros || '';
        const potencia = inv.potencia || 0;
        const potenciaKW = formatarPotenciaKW(potencia);
        const tensao = inv.tensao;
        
        let tituloCompleto = `INVERSOR SOLAR ${marca}`;
        if (modelo) tituloCompleto += ` ${modelo}`;
        if (tipo) tituloCompleto += ` ${tipo}`;
        tituloCompleto += ` ${potenciaKW}KW`;
        tituloCompleto += ` ${tensao}V`;
        if (outros) tituloCompleto += ` ${outros}`;
        
        const infoAdicional = [
            `Garantia: ${inv.garantia || 10} anos`,
            `Mín: ${inv.potencia_min}W (${formatarPotenciaKW(inv.potencia_min)}kW)`,
            `Máx: ${inv.potencia_max}W (${formatarPotenciaKW(inv.potencia_max)}kW)`,
            inv.fase,
            `${inv.tensao}V`
        ];
        if (inv.inmetro) infoAdicional.push(`INMETRO: ${inv.inmetro}`);
        
        return `
            <div class="list-item" onclick="selecionarInversorLista(${inv.id})">
                <div class="item-imagem">
                    <img src="${imagemSrc}" onerror="this.src='/assets/images/inversores/padraoongrid.png'" style="width:70px;height:70px;object-fit:contain">
                </div>
                <div class="item-info">
                    <div class="item-title">${tituloCompleto}</div>
                    <div class="item-subtitle">${infoAdicional.join(' | ')}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editarInversor(${inv.id})">✏️</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); clonarInversor(${inv.id})">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); excluirInversor(${inv.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// CARREGAR INVERSORES
// ============================================

async function carregarInversores() {
    try {
        console.log('📡 Buscando inversores na API...');
        const inversores = await apiGet('/equipamentos/inversores');
        console.log('✅ Inversores recebidos:', inversores.length);
        
        window.AppState.inversores = inversores;
        inversoresCompletos = [...inversores];
        
        atualizarFiltrosInversores();
        filtrarInversores();
        
    } catch (error) {
        console.error('❌ Erro ao carregar inversores:', error);
        mostrarToast('Erro ao carregar inversores do servidor', 'error');
    }
}

// ============================================
// SELEÇÃO
// ============================================

function selecionarInversorLista(id) {
    const inversor = window.AppState.inversores.find(i => i.id === id);
    if (!inversor) return;
    
    window.AppState.inversorSelecionado = inversor;
    
    const invDiv = document.getElementById('inversorSelecionado');
    const detalhesDiv = document.getElementById('detalhesInversor');
    
    if (invDiv) {
        const potenciaKW = formatarPotenciaKW(inversor.potencia);
        const outros = inversor.outros ? ` ${inversor.outros}` : '';
        invDiv.innerHTML = `INVERSOR SOLAR ${inversor.marca} ${inversor.modelo} ${inversor.tipo} ${potenciaKW}KW ${inversor.tensao}V${outros}`;
        invDiv.classList.remove('empty');
    }
    
    if (detalhesDiv) {
        detalhesDiv.style.display = 'block';
        atualizarDetalhesInversor(inversor);
    }
    
    if (typeof window.mostrarQuantidadeInversor === 'function') window.mostrarQuantidadeInversor(true);
    window.quantidadeInversorManual = null;
    const qtdInput = document.getElementById('inversorQuantidade');
    if (qtdInput) qtdInput.value = '1';
    
    if (typeof window.fecharModal === 'function') window.fecharModal();
    if (typeof window.recalcularOrcamento === 'function') window.recalcularOrcamento();
    if (typeof configurarHibrido === 'function') configurarHibrido();
    mostrarToast(`Inversor ${inversor.marca} ${inversor.modelo} selecionado!`, 'success');
}

// ============================================
// MODAL
// ============================================

function abrirModalInversores() {
    const modal = document.getElementById('modalSelecao');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal) {
        console.error('Modal não encontrado');
        mostrarToast('Erro ao abrir modal', 'error');
        return;
    }
    
    modalTitle.innerHTML = 'Selecionar Inversor';
    modal.classList.add('active');
    
    if (!window.AppState.inversores || window.AppState.inversores.length === 0) {
        modalBody.innerHTML = `
            <div class="empty-list">
                <i data-lucide="alert-circle"></i>
                <p>Nenhum inversor cadastrado</p>
                <small>Cadastre um inversor no menu "Inversores"</small>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    const marcas = [...new Set(window.AppState.inversores.map(i => i.marca).filter(m => m && m.trim() !== ''))];
    const tipos = [...new Set(window.AppState.inversores.map(i => i.tipo).filter(t => t && t.trim() !== ''))];
    
    modalBody.innerHTML = `
        <div class="modal-filtros">
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Marca:</label>
                <select id="modalFiltroMarcaInversor" class="filtro-select">
                    <option value="">Todas as Marcas</option>
                    ${marcas.map(marca => `<option value="${marca}">${marca}</option>`).join('')}
                </select>
            </div>
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Tipo:</label>
                <select id="modalFiltroTipoInversor" class="filtro-select">
                    <option value="">Todos os Tipos</option>
                    ${tipos.map(tipo => `<option value="${tipo}">${tipo}</option>`).join('')}
                </select>
            </div>
            <div class="filtro-group">
                <label class="filtro-label">Filtrar por Potência:</label>
                <select id="modalFiltroPotenciaInversor" class="filtro-select">
                    <option value="">Todas as Potências</option>
                    <option value="0-3000">Até 3kW</option>
                    <option value="3001-5000">3kW - 5kW</option>
                    <option value="5001-10000">5kW - 10kW</option>
                    <option value="10001-15000">10kW - 15kW</option>
                    <option value="15000+">Acima de 15kW</option>
                </select>
            </div>
            <div class="filtro-actions">
                <button class="btn-small" onclick="limparFiltrosModalInversores()">Limpar Filtros</button>
                <span class="contador-placas" id="contadorInversoresModal">${window.AppState.inversores.length} inversores</span>
            </div>
        </div>
        <div class="lista-itens-container" id="modalListaInversores">
            ${renderizarListaInversoresModal(window.AppState.inversores)}
        </div>
    `;
    
    const filtroMarca = document.getElementById('modalFiltroMarcaInversor');
    const filtroTipo = document.getElementById('modalFiltroTipoInversor');
    const filtroPotencia = document.getElementById('modalFiltroPotenciaInversor');
    
    if (filtroMarca) filtroMarca.addEventListener('change', () => filtrarInversoresModal());
    if (filtroTipo) filtroTipo.addEventListener('change', () => filtrarInversoresModal());
    if (filtroPotencia) filtroPotencia.addEventListener('change', () => filtrarInversoresModal());
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarListaInversoresModal(inversores) {
    if (!inversores || inversores.length === 0) return '<div class="empty-list">Nenhum inversor encontrado</div>';
    
    return inversores.map(inv => {
        const marca = inv.marca || '';
        const modelo = inv.modelo || '';
        const tipo = inv.tipo || '';
        const outros = inv.outros || '';
        const potencia = inv.potencia || 0;
        const potenciaKW = formatarPotenciaKW(potencia);
        const tensao = inv.tensao;
        
        let tituloCompleto = `INVERSOR SOLAR ${marca}`;
        if (modelo) tituloCompleto += ` ${modelo}`;
        if (tipo) tituloCompleto += ` ${tipo}`;
        tituloCompleto += ` ${potenciaKW}KW`;
        tituloCompleto += ` ${tensao}V`;
        if (outros) tituloCompleto += ` ${outros}`;
        
        return `
            <div class="list-item" onclick="selecionarInversorLista(${inv.id})">
                <div class="item-info">
                    <div class="item-title">${tituloCompleto}</div>
                    <div class="item-subtitle">Potência: ${potencia}W | Garantia: ${inv.garantia || 10} anos</div>
                </div>
                <div class="item-value">${potenciaKW}kW</div>
            </div>
        `;
    }).join('');
}

function filtrarInversoresModal() {
    const filtroMarca = document.getElementById('modalFiltroMarcaInversor')?.value || '';
    const filtroTipo = document.getElementById('modalFiltroTipoInversor')?.value || '';
    const filtroPotencia = document.getElementById('modalFiltroPotenciaInversor')?.value || '';
    
    let inversoresFiltrados = [...window.AppState.inversores];
    
    if (filtroMarca) inversoresFiltrados = inversoresFiltrados.filter(i => i.marca === filtroMarca);
    if (filtroTipo) inversoresFiltrados = inversoresFiltrados.filter(i => i.tipo === filtroTipo);
    
    if (filtroPotencia) {
        inversoresFiltrados = inversoresFiltrados.filter(i => {
            const potencia = i.potencia || 0;
            switch(filtroPotencia) {
                case '0-3000': return potencia <= 3000;
                case '3001-5000': return potencia >= 3001 && potencia <= 5000;
                case '5001-10000': return potencia >= 5001 && potencia <= 10000;
                case '10001-15000': return potencia >= 10001 && potencia <= 15000;
                case '15000+': return potencia >= 15001;
                default: return true;
            }
        });
    }
    
    const container = document.getElementById('modalListaInversores');
    const contador = document.getElementById('contadorInversoresModal');
    
    if (container) container.innerHTML = renderizarListaInversoresModal(inversoresFiltrados);
    if (contador) contador.innerHTML = `${inversoresFiltrados.length} inversores`;
}

function limparFiltrosModalInversores() {
    const filtroMarca = document.getElementById('modalFiltroMarcaInversor');
    const filtroTipo = document.getElementById('modalFiltroTipoInversor');
    const filtroPotencia = document.getElementById('modalFiltroPotenciaInversor');
    
    if (filtroMarca) filtroMarca.value = '';
    if (filtroTipo) filtroTipo.value = '';
    if (filtroPotencia) filtroPotencia.value = '';
    
    filtrarInversoresModal();
}

function abrirCadastroInversor() {
    const invNav = document.querySelector('[data-page="inversores"]');
    if (invNav) invNav.click();
}

// ============================================
// CADASTRO
// ============================================

async function cadastrarInversor() {
    const marca = document.getElementById('invMarca')?.value.trim();
    const modelo = document.getElementById('invModelo')?.value.trim();
    const tipo = document.getElementById('invTipo')?.value;
    const potencia = parseFloat(document.getElementById('invPotencia')?.value);
    const garantia = parseInt(document.getElementById('invGarantia')?.value);
    const inmetro = document.getElementById('invInmetro')?.value.trim();
    const outros = document.getElementById('invOutros')?.value.trim();
    
    let potenciaMin = document.getElementById('invPotenciaMin')?.value;
    let potenciaMax = document.getElementById('invPotenciaMax')?.value;
    let tensao = document.getElementById('invTensao')?.value;
    let fase = document.getElementById('invFase')?.value;
    
    if (!marca || !potencia) {
        mostrarToast('❌ Preencha marca e potência!', 'error');
        return;
    }
    
    // Calcular automáticos se estiverem vazios
    if (!potenciaMin) {
        potenciaMin = Math.round(potencia * 0.7);
    } else {
        potenciaMin = parseFloat(potenciaMin);
    }
    
    if (!potenciaMax) {
        potenciaMax = Math.round(potencia * 1.5);
    } else {
        potenciaMax = parseFloat(potenciaMax);
    }
    
    if (!tensao) {
        tensao = potencia <= 12000 ? '220' : '380';
    }
    
    if (!fase) {
        fase = potencia <= 12000 ? 'MONOFÁSICO' : 'TRIFÁSICO';
    }
    
    const dados = { 
        marca, modelo, tipo, potencia, garantia, inmetro, outros,
        potencia_min: potenciaMin,
        potencia_max: potenciaMax,
        tensao, fase
    };
    
    const btn = document.getElementById('btnCadastrarInversor');
    const textoOriginal = btn?.innerHTML || 'Cadastrar';
    if (btn) {
        btn.innerHTML = '⏳ Salvando...';
        btn.disabled = true;
    }
    
    try {
        let result;
        let inversorId;
        if (inversorEditandoId) {
            result = await apiPut(`/equipamentos/inversores/${inversorEditandoId}`, dados);
            if (result) {
                inversorId = inversorEditandoId;
                mostrarToast('✅ Inversor atualizado!', 'success');
                inversorEditandoId = null;
                if (btn) btn.innerHTML = 'Cadastrar';
            }
        } else {
            console.log('➕ Criando novo inversor');
            result = await apiPost('/equipamentos/inversores', dados);
            if (result) {
                inversorId = result.id;
                console.log(`✅ Inversor criado com ID: ${inversorId}`);
                mostrarToast('✅ Inversor cadastrado!', 'success');
            }
        }
        
        if (result && inversorId) {
            if (imagemSelecionadaUrlInversor) {
                await apiPut(`/equipamentos/inversores/${inversorId}`, { ...dados, imagem_url: imagemSelecionadaUrlInversor });
            }
            
            // Limpar formulário
            document.getElementById('invMarca').value = '';
            document.getElementById('invModelo').value = '';
            document.getElementById('invPotencia').value = '';
            document.getElementById('invPotenciaMin').value = '';
            document.getElementById('invPotenciaMax').value = '';
            document.getElementById('invGarantia').value = '10';
            document.getElementById('invTensao').value = '';
            document.getElementById('invFase').value = '';
            document.getElementById('invInmetro').value = '';
            document.getElementById('invOutros').value = '';
            imagemSelecionadaUrlInversor = null;
            removerImagemInversor();
            
            await carregarInversores();
        }
    } catch (error) {
        console.error('❌ Erro ao salvar inversor:', error);
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

async function editarInversor(id) {
    const inversor = window.AppState.inversores.find(i => i.id === id);
    if (!inversor) return;
    
    console.log('✏️ Editando inversor:', inversor);
    
    inversorEditandoId = id;
    
    document.getElementById('invMarca').value = inversor.marca || '';
    document.getElementById('invModelo').value = inversor.modelo || '';
    document.getElementById('invTipo').value = inversor.tipo || 'ONGRID';
    document.getElementById('invPotencia').value = inversor.potencia || '';
    document.getElementById('invPotenciaMin').value = inversor.potencia_min || '';
    document.getElementById('invPotenciaMax').value = inversor.potencia_max || '';
    document.getElementById('invGarantia').value = inversor.garantia || 10;
    document.getElementById('invTensao').value = inversor.tensao || '';
    document.getElementById('invFase').value = inversor.fase || '';
    document.getElementById('invInmetro').value = inversor.inmetro || '';
    document.getElementById('invOutros').value = inversor.outros || '';
    
    imagemSelecionadaInversor = null;
    removerImagemInversor();
    
    const btn = document.getElementById('btnCadastrarInversor');
    if (btn) btn.innerHTML = 'Atualizar';
    
    document.querySelector('.card.compact').scrollIntoView({ behavior: 'smooth' });
    mostrarToast(`Editando inversor: ${inversor.marca} ${inversor.modelo}`, 'info');
}

async function clonarInversor(id) {
    const inversor = window.AppState.inversores.find(i => i.id === id);
    if (!inversor) return;
    
    console.log('📋 Clonando inversor:', inversor);
    
    inversorEditandoId = null;
    
    document.getElementById('invMarca').value = inversor.marca || '';
    document.getElementById('invModelo').value = (inversor.modelo || '') + ' (Cópia)';
    document.getElementById('invTipo').value = inversor.tipo || 'ONGRID';
    document.getElementById('invPotencia').value = inversor.potencia || '';
    document.getElementById('invPotenciaMin').value = inversor.potencia_min || '';
    document.getElementById('invPotenciaMax').value = inversor.potencia_max || '';
    document.getElementById('invGarantia').value = inversor.garantia || 10;
    document.getElementById('invTensao').value = inversor.tensao || '';
    document.getElementById('invFase').value = inversor.fase || '';
    document.getElementById('invInmetro').value = inversor.inmetro || '';
    document.getElementById('invOutros').value = inversor.outros || '';
    
    imagemSelecionadaInversor = null;
    removerImagemInversor();
    
    const btn = document.getElementById('btnCadastrarInversor');
    if (btn) btn.innerHTML = 'Cadastrar Cópia';
    
    document.querySelector('.card.compact').scrollIntoView({ behavior: 'smooth' });
    mostrarToast('Clone criado, clique em Cadastrar Cópia para salvar', 'info');
}

async function excluirInversor(id) {
    if (confirm('Tem certeza que deseja excluir este inversor?')) {
        try {
            const inversor = window.AppState.inversores.find(i => i.id === id);
            if (inversor) {
                const nomeImagem = gerarNomeImagemInversor(inversor);
                // ImgBB — sem deleção de imagem no backend
            }
            await apiDelete(`/equipamentos/inversores/${id}`);
            mostrarToast('Inversor excluído!', 'success');
            await carregarInversores();
            if (window.AppState.inversorSelecionado?.id === id) {
                window.AppState.inversorSelecionado = null;
                const invDiv = document.getElementById('inversorSelecionado');
                if (invDiv) {
                    invDiv.innerHTML = 'Clique para selecionar um inversor';
                    invDiv.classList.add('empty');
                }
                if (typeof window.mostrarQuantidadeInversor === 'function') window.mostrarQuantidadeInversor(false);
            }
        } catch (error) {
            console.error('❌ Erro ao excluir:', error);
            mostrarToast('Erro ao excluir', 'error');
        }
    }
}

// ============================================
// INICIALIZAR
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    configurarUploadImagemInversor();
    console.log('✅ Upload de imagem para inversores configurado');
});

function inicializarFiltrosInversores() {
    const filtroMarca = document.getElementById('filtroMarcaInversor');
    const filtroTipo = document.getElementById('filtroTipoInversor');
    const filtroPotencia = document.getElementById('filtroPotenciaInversor');
    
    if (inversoresCompletos && inversoresCompletos.length > 0) {
        atualizarFiltrosInversores();
    }
    
    if (filtroMarca) {
        filtroMarca.removeEventListener('change', filtrarInversores);
        filtroMarca.addEventListener('change', filtrarInversores);
    }
    if (filtroTipo) {
        filtroTipo.removeEventListener('change', filtrarInversores);
        filtroTipo.addEventListener('change', filtrarInversores);
    }
    if (filtroPotencia) {
        filtroPotencia.removeEventListener('change', filtrarInversores);
        filtroPotencia.addEventListener('change', filtrarInversores);
    }
}

// ============================================
// EXPORTAR
// ============================================

window.selecionarInversorLista = selecionarInversorLista;
window.abrirModalInversores = abrirModalInversores;
window.abrirCadastroInversor = abrirCadastroInversor;
window.carregarInversores = carregarInversores;
window.cadastrarInversor = cadastrarInversor;
window.editarInversor = editarInversor;
window.clonarInversor = clonarInversor;
window.excluirInversor = excluirInversor;
window.filtrarInversores = filtrarInversores;
window.removerImagemInversor = removerImagemInversor;
window.abrirSelecaoImagemInversor = abrirSelecaoImagemInversor;
window.inicializarFiltrosInversores = inicializarFiltrosInversores;
window.filtrarInversoresModal = filtrarInversoresModal;
window.limparFiltrosModalInversores = limparFiltrosModalInversores;

console.log('✅ cadastro/inversores.js carregado com sucesso!');