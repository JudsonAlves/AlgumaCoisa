// frontend/js/modules/lista-resumo.js
// Funções de Lista de Resumo e Modal com Abas

function adicionarListaResumo() {
    console.log('📋 Adicionando à lista de resumo...');
    
    if (!window.AppState.placaSelecionada || !window.AppState.inversorSelecionado) {
        mostrarToast('❌ Selecione placa e inversor!', 'error');
        return;
    }
    
    if (!window.orcamentoCalculado && typeof recalcularOrcamento === 'function') {
        recalcularOrcamento();
    }
    
    if (!window.orcamentoCalculado) {
        mostrarToast('❌ Erro ao calcular orçamento!', 'error');
        return;
    }
    
    const dados = window.orcamentoCalculado;
    
    const itemResumo = {
        id: Date.now(),
        geracao: dados.gerFinal,
        potenciaKit: dados.potenciaKit,
        qtdePlacas: dados.qtdModulos,
        placa: `${window.AppState.placaSelecionada.marca} ${window.AppState.placaSelecionada.modelo}`,
        qtdeInversores: dados.qtdInversores,
        inversor: `${window.AppState.inversorSelecionado.marca} ${window.AppState.inversorSelecionado.modelo}`,
        valorFinal: dados.vFinal,
        estrutura: document.getElementById('estruturaFixa')?.value || '',
        vendedor: document.getElementById('vendedor')?.value || '',
        placaId: window.AppState.placaSelecionada.id,
        inversorId: window.AppState.inversorSelecionado.id,
        bateriaId: window.AppState.bateriaSelecionada?.id || null,
        qtdeBaterias: dados.qtdBaterias
    };
    
    if (!window.AppState.listaResumo) window.AppState.listaResumo = [];
    window.AppState.listaResumo.push(itemResumo);
    atualizarListaResumo();
    mostrarToast('✅ Item adicionado à lista!', 'success');
}

function atualizarListaResumo() {
    const container = document.getElementById('listaResumoItems');
    if (!container) return;
    
    if (!window.AppState.listaResumo || window.AppState.listaResumo.length === 0) {
        container.innerHTML = '<div class="empty-list">Nenhum item na lista</div>';
        return;
    }
    
    container.innerHTML = window.AppState.listaResumo.map(item => `
        <div class="list-item" onclick="selecionarItemResumo(${item.id})">
            <div class="item-info">
                <div class="item-title">${Math.round(item.geracao)} kWh | ${item.potenciaKit.toFixed(2)} kWp</div>
                <div class="item-subtitle">
                    ${item.qtdePlacas}x ${item.placa} | ${item.qtdeInversores}x ${item.inversor}
                </div>
            </div>
            <div class="item-value">${formatarMoeda(item.valorFinal)}</div>
            <button class="btn-remove" onclick="removerItemResumo(${item.id}); event.stopPropagation();">✗</button>
        </div>
    `).join('');
}

function removerItemResumo(id) {
    window.AppState.listaResumo = window.AppState.listaResumo.filter(item => item.id !== id);
    atualizarListaResumo();
    mostrarToast('Item removido!', 'info');
}

function selecionarItemResumo(id) {
    const item = window.AppState.listaResumo.find(i => i.id === id);
    if (!item) return;
    
    const geracaoInput = document.getElementById('geracaoRequerida');
    const valorFornInput = document.getElementById('valorFornecimento');
    
    if (geracaoInput) geracaoInput.value = Math.round(item.geracao);
    if (valorFornInput) valorFornInput.value = formatarMoeda(item.valorFinal);
    
    const placa = window.AppState.placas.find(p => p.id === item.placaId);
    if (placa && typeof window.selecionarPlacaLista === 'function') {
        window.selecionarPlacaLista(placa.id);
    }
    
    const inversor = window.AppState.inversores.find(i => i.id === item.inversorId);
    if (inversor && typeof window.selecionarInversorLista === 'function') {
        window.selecionarInversorLista(inversor.id);
    }
    
    if (item.bateriaId) {
        const bateria = window.AppState.baterias.find(b => b.id === item.bateriaId);
        if (bateria && typeof window.selecionarBateriaLista === 'function') {
            window.selecionarBateriaLista(bateria.id);
            const batQtdInput = document.getElementById('bateriaQuantidade');
            if (batQtdInput) batQtdInput.value = item.qtdeBaterias;
        }
    }
    
    const estruturaSelect = document.getElementById('estruturaFixa');
    const vendedorSelect = document.getElementById('vendedor');
    
    if (estruturaSelect) estruturaSelect.value = item.estrutura;
    if (vendedorSelect) vendedorSelect.value = item.vendedor;
    
    if (typeof window.recalcularOrcamento === 'function') {
        window.recalcularOrcamento();
    }
    mostrarToast(`Item carregado: ${Math.round(item.geracao)} kWh`, 'success');
}

async function gerarMultiplosOrcamentos() {
    if (!window.AppState.listaResumo || window.AppState.listaResumo.length === 0) {
        mostrarToast('❌ Adicione itens à lista primeiro!', 'error');
        return;
    }
    
    const modoSilencioso = confirm('Deseja gerar em MODO SILENCIOSO? (OK = Sim, Cancelar = Assistido)');
    
    for (let i = 0; i < window.AppState.listaResumo.length; i++) {
        const item = window.AppState.listaResumo[i];
        
        if (!modoSilencioso) {
            const continuar = confirm(`Gerar orçamento de ${Math.round(item.geracao)} kWh?`);
            if (!continuar) continue;
        }
        
        const placa = window.AppState.placas.find(p => p.id === item.placaId);
        const inversor = window.AppState.inversores.find(i => i.id === item.inversorId);
        
        if (placa) window.AppState.placaSelecionada = placa;
        if (inversor) window.AppState.inversorSelecionado = inversor;
        
        const geracaoInput = document.getElementById('geracaoRequerida');
        const valorFornInput = document.getElementById('valorFornecimento');
        const estruturaSelect = document.getElementById('estruturaFixa');
        const vendedorSelect = document.getElementById('vendedor');
        
        if (geracaoInput) geracaoInput.value = Math.round(item.geracao);
        if (valorFornInput) valorFornInput.value = formatarMoeda(item.valorFinal);
        if (estruturaSelect) estruturaSelect.value = item.estrutura;
        if (vendedorSelect) vendedorSelect.value = item.vendedor;
        
        if (item.bateriaId) {
            const bateria = window.AppState.baterias.find(b => b.id === item.bateriaId);
            if (bateria) {
                window.AppState.bateriaSelecionada = bateria;
                const batQtdInput = document.getElementById('bateriaQuantidade');
                if (batQtdInput) batQtdInput.value = item.qtdeBaterias;
            }
        }
        
        if (typeof window.recalcularOrcamento === 'function') {
            window.recalcularOrcamento();
        }
        await aplicarOrcamento();
        
        if (!modoSilencioso) {
            const gerarPDF = confirm(`Deseja gerar PDF para ${Math.round(item.geracao)} kWh?`);
            if (gerarPDF) await gerarPDF();
        }
    }
    
    window.AppState.listaResumo = [];
    atualizarListaResumo();
    mostrarToast('✅ Processo concluído!', 'success');
}

async function aplicarOrcamento() {
    if (!window.AppState.placaSelecionada) {
        mostrarToast('❌ Selecione uma placa solar!', 'error');
        return;
    }
    
    if (!window.AppState.inversorSelecionado) {
        mostrarToast('❌ Selecione um inversor!', 'error');
        return;
    }
    
    const gerReqInput = document.getElementById('geracaoRequerida');
    const valorFornInput = document.getElementById('valorFornecimento');
    
    const gerReq = parseFloat(gerReqInput?.value) || 0;
    if (gerReq <= 0) {
        mostrarToast('❌ Preencha a Geração Requerida!', 'error');
        return;
    }
    
    const valorForn = parseMoney(valorFornInput?.value);
    if (valorForn <= 0) {
        mostrarToast('❌ Preencha o Valor de Fornecimento!', 'error');
        return;
    }
    
    if (!window.orcamentoCalculado && typeof window.recalcularOrcamento === 'function') {
        window.recalcularOrcamento();
    }
    
    const dados = window.orcamentoCalculado;
    if (!dados) {
        mostrarToast('❌ Erro ao calcular orçamento!', 'error');
        return;
    }
    
    const orcamento = {
        placa_id: window.AppState.placaSelecionada.id,
        inversor_id: window.AppState.inversorSelecionado.id,
        bateria_id: window.AppState.bateriaSelecionada?.id || null,
        cliente_id: window.AppState.clienteSelecionado?.id || null,
        quantidade_placas: dados.qtdModulos,
        quantidade_inversores: dados.qtdInversores,
        quantidade_baterias: dados.qtdBaterias,
        geracao_requerida: dados.gerReq,
        geracao_estimada: dados.gerFinal,
        potencia_kit: dados.potenciaKit,
        valor_fornecimento: dados.valorForn,
        margem_percentual: dados.margem,
        imposto_percentual: dados.imposto,
        reajuste: dados.reajuste,
        desconto: dados.desconto,
        acrescimo: dados.acrescimo,
        frete: dados.frete,
        valor_final: dados.vFinal,
        estrutura_fixa: document.getElementById('estruturaFixa')?.value || '',
        recall_inversor: document.getElementById('recallInversor')?.value || '',
        vendedor: document.getElementById('vendedor')?.value || '01 - JUAN'
    };
    
    const btn = event?.target;
    if (btn) {
        btn.innerHTML = '⏳ Aplicando...';
        btn.disabled = true;
    }
    
    try {
        const result = await apiPost('/orcamentos', orcamento);
        if (result) {
            mostrarToast('✅ Orçamento aplicado!', 'success');
            await registrarLog(orcamento);
            if (typeof window.carregarLog === 'function') {
                window.carregarLog();
            }
        }
    } catch (error) {
        mostrarToast('Erro ao aplicar: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = '💾 Aplicar Orçamento';
            btn.disabled = false;
        }
    }
}

async function gerarPDF() {
    if (!window.orcamentoCalculado && typeof window.recalcularOrcamento === 'function') {
        window.recalcularOrcamento();
    }
    
    if (!window.orcamentoCalculado) {
        mostrarToast('❌ Calcule o orçamento primeiro!', 'error');
        return;
    }
    
    const simulacao = prompt(
        'AJUSTAR VISUALIZAÇÃO:\n\n' +
        '[1] - BNB (Ocultar FINANCEIRAS)\n' +
        '[2] - FINANCEIRAS (Ocultar BNB)\n' +
        '[3] - Exibir AMBOS\n' +
        '[4] - Ocultar AMBOS\n\n' +
        'Opção (padrão: 2):', '2'
    );
    
    let escolha = 2;
    if (simulacao && !isNaN(simulacao)) {
        escolha = parseInt(simulacao);
        if (escolha < 1 || escolha > 4) escolha = 2;
    }
    
    const dados = window.orcamentoCalculado;
    const dadosPDF = {
        ...dados,
        placa: window.AppState.placaSelecionada,
        inversor: window.AppState.inversorSelecionado,
        bateria: window.AppState.bateriaSelecionada,
        qtdeBaterias: dados.qtdBaterias,
        estrutura: document.getElementById('estruturaFixa')?.value || '',
        vendedor: document.getElementById('vendedor')?.value || '',
        escolhaSimulacao: escolha,
        data: new Date().toLocaleDateString('pt-BR')
    };
    
    mostrarToast('🔄 Gerando PDF...', 'info');
    
    try {
        mostrarToast('Geração de PDF não disponível nesta versão', 'info'); return;
        // const response = await fetch('/api/orcamentos/pdf', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(dadosPDF)
        // });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Orcamento_${Math.round(dados.gerFinal)}kWh.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
            mostrarToast('✅ PDF gerado!', 'success');
        }
    } catch (error) {
        mostrarToast('Erro ao gerar PDF', 'error');
    }
}

function limparOrcamento() {
    window.AppState.placaSelecionada = null;
    window.AppState.inversorSelecionado = null;
    window.AppState.bateriaSelecionada = null;
    window.orcamentoCalculado = null;
    window.quantidadePlacaManual = null;
    window.quantidadeInversorManual = null;
    window.quantidadeBateriaManual = null;
    
    const placaDiv = document.getElementById('placaSelecionada');
    const invDiv = document.getElementById('inversorSelecionado');
    const batDiv = document.getElementById('bateriaSelecionada');
    
    if (placaDiv) {
        placaDiv.innerHTML = 'Clique para selecionar uma placa';
        placaDiv.classList.add('empty');
    }
    if (invDiv) {
        invDiv.innerHTML = 'Clique para selecionar um inversor';
        invDiv.classList.add('empty');
    }
    if (batDiv) {
        batDiv.innerHTML = 'Opcional';
        batDiv.classList.add('empty');
    }
    
    const qtdPlacaInput = document.getElementById('placaQuantidade');
    const qtdInvInput = document.getElementById('inversorQuantidade');
    const qtdBatInput = document.getElementById('bateriaQuantidade');
    const gerReqInput = document.getElementById('geracaoRequerida');
    
    if (qtdPlacaInput) qtdPlacaInput.value = '1';
    if (qtdInvInput) qtdInvInput.value = '1';
    if (qtdBatInput) qtdBatInput.value = '0';
    if (gerReqInput) gerReqInput.value = '';
    
    const placaQtdGroup = document.getElementById('placaQuantidadeGroup');
    const invQtdGroup = document.getElementById('inversorQuantidadeGroup');
    const batQtdGroup = document.getElementById('bateriaQuantidadeGroup');
    
    if (placaQtdGroup) placaQtdGroup.style.display = 'none';
    if (invQtdGroup) invQtdGroup.style.display = 'none';
    if (batQtdGroup) batQtdGroup.style.display = 'none';
    
    const detalhesPlaca = document.getElementById('detalhesPlaca');
    const detalhesInversor = document.getElementById('detalhesInversor');
    const detalhesBateria = document.getElementById('detalhesBateria');
    
    if (detalhesPlaca) detalhesPlaca.style.display = 'none';
    if (detalhesInversor) detalhesInversor.style.display = 'none';
    if (detalhesBateria) detalhesBateria.style.display = 'none';
    
    const valorFornecimento = document.getElementById('valorFornecimento');
    const reajuste = document.getElementById('reajuste');
    const desconto = document.getElementById('desconto');
    const acrescimo = document.getElementById('acrescimo');
    const frete = document.getElementById('frete');
    const margem = document.getElementById('margem');
    const imposto = document.getElementById('imposto');
    
    if (valorFornecimento) valorFornecimento.value = '';
    if (reajuste) reajuste.value = '150';
    if (desconto) desconto.value = '0';
    if (acrescimo) acrescimo.value = '0';
    if (frete) frete.value = '0';
    if (margem) margem.value = '4';
    if (imposto) imposto.value = '43';
    
    const qtdePlacas = document.getElementById('qtdePlacas');
    const potenciaKit = document.getElementById('potenciaKit');
    const geracaoEstimada = document.getElementById('geracaoEstimada');
    const qtdeInversores = document.getElementById('qtdeInversores');
    const valorComImposto = document.getElementById('valorComImposto');
    const valorFinal = document.getElementById('valorFinal');
    const valorTotalOrc = document.getElementById('valorTotalOrc');
    
    if (qtdePlacas) qtdePlacas.innerHTML = '0';
    if (potenciaKit) potenciaKit.innerHTML = '0 kWp';
    if (geracaoEstimada) geracaoEstimada.innerHTML = '0 kWh';
    if (qtdeInversores) qtdeInversores.innerHTML = '0';
    if (valorComImposto) valorComImposto.innerHTML = 'R$ 0,00';
    if (valorFinal) valorFinal.innerHTML = 'R$ 0,00';
    if (valorTotalOrc) valorTotalOrc.innerHTML = 'R$ 0,00';
    
    mostrarToast('Orçamento limpo!', 'info');
}

async function registrarLog(orcamento) {
    const log = {
        orcamento_id: null,
        acao: 'ORÇAMENTO GERADO',
        detalhes: JSON.stringify({
            placa: window.AppState.placaSelecionada?.modelo,
            inversor: window.AppState.inversorSelecionado?.modelo,
            potencia_kit: orcamento.potencia_kit,
            valor: orcamento.valor_final
        })
    };
    
    try {
        await apiPost('/log', log);
    } catch (error) {
        console.error('Erro ao registrar log:', error);
    }
}

function configurarHibrido() {
    const tipoInversor = window.AppState.inversorSelecionado?.tipo || '';
    const isHibridoOffgrid = tipoInversor === 'HIBRIDO' || tipoInversor === 'OFFGRID';
    
    const bateriaCard = document.querySelector('.card:has(#bateriaSelecionada)');
    if (bateriaCard) {
        bateriaCard.style.opacity = isHibridoOffgrid ? '1' : '0.5';
        bateriaCard.style.pointerEvents = isHibridoOffgrid ? 'auto' : 'none';
    }
    
    if (!isHibridoOffgrid && window.AppState.bateriaSelecionada) {
        window.AppState.bateriaSelecionada = null;
        const batDiv = document.getElementById('bateriaSelecionada');
        if (batDiv) {
            batDiv.innerHTML = 'Clique para selecionar uma bateria (sistema não suporta)';
            batDiv.classList.add('empty');
        }
        const qtdBatInput = document.getElementById('bateriaQuantidade');
        if (qtdBatInput) qtdBatInput.value = '0';
        const detalhesBateria = document.getElementById('detalhesBateria');
        if (detalhesBateria) detalhesBateria.style.display = 'none';
        const batQtdGroup = document.getElementById('bateriaQuantidadeGroup');
        if (batQtdGroup) batQtdGroup.style.display = 'none';
    }
}

function fecharModal() {
    const modal = document.getElementById('modalSelecao');
    if (modal) modal.classList.remove('active');
}

// ============================================
// FUNÇÕES DO MODAL DE RESUMO COM ABAS
// ============================================

function abrirModalResumo() {
    if (!window.orcamentoCalculado && typeof recalcularOrcamento === 'function') {
        recalcularOrcamento();
    }
    
    if (!window.orcamentoCalculado) {
        mostrarToast('❌ Calcule o orçamento primeiro!', 'error');
        return;
    }
    
    if (!document.getElementById('modalResumo')) {
        fetch('components/modal-resumo.html')
            .then(response => response.text())
            .then(html => {
                const div = document.createElement('div');
                div.innerHTML = html;
                document.body.appendChild(div.firstElementChild);
                atualizarModalResumo();
                initTabs();
                if (typeof lucide !== 'undefined') lucide.createIcons();
                document.getElementById('modalResumo').classList.add('active');
            })
            .catch(error => {
                console.error('Erro ao carregar modal:', error);
                mostrarToast('Erro ao carregar resumo', 'error');
            });
    } else {
        atualizarModalResumo();
        initTabs();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        document.getElementById('modalResumo').classList.add('active');
    }
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.removeEventListener('click', tab._clickHandler);
        const handler = () => {
            const tabId = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetContent = document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
            if (targetContent) targetContent.classList.add('active');
        };
        tab._clickHandler = handler;
        tab.addEventListener('click', handler);
    });
}

async function copiarAbaAtiva() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) {
        mostrarToast('❌ Nenhuma aba ativa', 'error');
        return;
    }
    
    mostrarToast('📸 Capturando imagem...', 'info');
    
    try {
        // Usar html2canvas para capturar a aba como imagem
        const canvas = await html2canvas(activeTab, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });
        
        // Converter canvas para blob e copiar para clipboard
        canvas.toBlob(async (blob) => {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                mostrarToast('✅ Print copiado! Cole com Ctrl+V', 'success');
            } catch (err) {
                // Fallback: abrir imagem em nova aba
                const url = canvas.toDataURL();
                const a = document.createElement('a');
                a.href = url;
                a.download = `print_${new Date().toISOString().slice(0,19)}.png`;
                a.click();
                mostrarToast('✅ Print gerado! Verifique downloads', 'success');
            }
        });
        
    } catch (error) {
        console.error('Erro ao capturar print:', error);
        mostrarToast('❌ Erro ao capturar print', 'error');
    }
}
function atualizarModalResumo() {
    if (!window.orcamentoCalculado) return;
    
    const dados = window.orcamentoCalculado;
    const margemValor = dados.valorForn * dados.margem;
    const valorCustos = dados.vComImposto - dados.valorForn;
    const comissaoPercentual = 3;
    const valorComissao = dados.vFinal * (comissaoPercentual / 100);
    const totalAcrescimos = dados.desconto + dados.acrescimo + dados.frete + valorComissao;
    const parcela12 = dados.vFinal / 12;
    
    // Composição com quebra de linha e bateria
    const placaInfo = `${dados.qtdModulos}x ${window.AppState.placaSelecionada?.marca || ''} ${window.AppState.placaSelecionada?.modelo || ''} ${window.AppState.placaSelecionada?.potencia || 0}W`;
    const inversorInfo = `${dados.qtdInversores}x ${window.AppState.inversorSelecionado?.marca || ''} ${window.AppState.inversorSelecionado?.modelo || ''}`;
    let composicao = `${placaInfo}<br>${inversorInfo}`;
    if (window.AppState.bateriaSelecionada && dados.qtdBaterias > 0) {
        composicao += `<br>${dados.qtdBaterias}x ${window.AppState.bateriaSelecionada?.nome || ''}`;
    }
    
    // ========== ABA VENDEDOR ==========
    const vResumoGeracao = document.getElementById('resumoGeracaoModal');
    const vResumoPotencia = document.getElementById('resumoPotenciaModal');
    const vResumoComposicao = document.getElementById('resumoComposicaoModal');
    if (vResumoGeracao) vResumoGeracao.innerHTML = `${Math.round(dados.gerFinal)} kWh/mês`;
    if (vResumoPotencia) vResumoPotencia.innerHTML = `${formatarNumero(dados.potenciaKit, 2)} kWp`;
    if (vResumoComposicao) vResumoComposicao.innerHTML = composicao;
    
    const vInvestimentoTotal = document.getElementById('modalInvestimentoTotal');
    const vParcelaInfo = document.getElementById('modalParcelaInfo');
    if (vInvestimentoTotal) vInvestimentoTotal.innerHTML = formatarMoeda(dados.vFinal);
    if (vParcelaInfo) vParcelaInfo.innerHTML = `ou 12x de ${formatarMoeda(parcela12)} sem juros`;
    
    // Detalhamento Financeiro Vendedor
    const vPrecoKit = document.getElementById('modalDetalhePrecoKit');
    const vPrecoVenda = document.getElementById('modalDetalhePrecoVenda');
    const vCustosPercent = document.getElementById('modalDetalheCustosPercent');
    const vValorCustos = document.getElementById('modalDetalheValorCustos');
    const vDesconto = document.getElementById('modalDetalheDesconto');
    const vAcrescimo = document.getElementById('modalDetalheAcrescimo');
    const vFrete = document.getElementById('modalDetalheFrete');
    const vComissaoPercent = document.getElementById('modalDetalheComissaoPercent');
    const vValorComissao = document.getElementById('modalDetalheValorComissao');
    const vTotalAcrescimos = document.getElementById('modalDetalheTotalAcrescimos');
    
    if (vPrecoKit) vPrecoKit.innerHTML = formatarMoeda(dados.valorForn);
    if (vPrecoVenda) vPrecoVenda.innerHTML = formatarMoeda(dados.vFinal);
    if (vCustosPercent) vCustosPercent.innerHTML = `${(dados.imposto * 100).toFixed(0)}%`;
    if (vValorCustos) vValorCustos.innerHTML = formatarMoeda(valorCustos);
    if (vDesconto) vDesconto.innerHTML = formatarMoeda(dados.desconto);
    if (vAcrescimo) vAcrescimo.innerHTML = formatarMoeda(dados.acrescimo);
    if (vFrete) vFrete.innerHTML = formatarMoeda(dados.frete);
    if (vComissaoPercent) vComissaoPercent.innerHTML = `${comissaoPercentual}%`;
    if (vValorComissao) vValorComissao.innerHTML = formatarMoeda(valorComissao);
    if (vTotalAcrescimos) vTotalAcrescimos.innerHTML = formatarMoeda(totalAcrescimos);
    
    // ========== ABA CLIENTE ==========
    const cResumoGeracao = document.getElementById('clienteResumoGeracao');
    const cResumoPotencia = document.getElementById('clienteResumoPotencia');
    const cResumoComposicao = document.getElementById('clienteResumoComposicao');
    if (cResumoGeracao) cResumoGeracao.innerHTML = `${Math.round(dados.gerFinal)} kWh/mês`;
    if (cResumoPotencia) cResumoPotencia.innerHTML = `${formatarNumero(dados.potenciaKit, 2)} kWp`;
    if (cResumoComposicao) cResumoComposicao.innerHTML = composicao;
    
    const cValorFornecedor = document.getElementById('clienteValorFornecedor');
    const cValorRecomendado = document.getElementById('clienteValorRecomendado');
    const cValorMargem = document.getElementById('clienteValorMargem');
    const cValorOrcamento = document.getElementById('clienteValorOrcamento');
    
    if (cValorFornecedor) cValorFornecedor.innerHTML = formatarMoeda(dados.valorForn);
    if (cValorRecomendado) cValorRecomendado.innerHTML = `${formatarMoeda(dados.vComImposto)} <span class="percent">+${(dados.imposto * 100).toFixed(0)}%</span>`;
    if (cValorMargem) cValorMargem.innerHTML = `${formatarMoeda(margemValor)} <span class="percent">+${(dados.margem * 100).toFixed(0)}%</span>`;
    if (cValorOrcamento) cValorOrcamento.innerHTML = formatarMoeda(dados.vFinal);
    
    // ========== TABELA DE BANCOS ==========
    const taxas = { btg: [0.0199,0.0299,0.0399,0.0499,0.0599,0.0699,0.0799], bb: [0.0219,0.0319,0.0419,0.0519,0.0619,0.0719,0.0819], bv: [0.0229,0.0329,0.0429,0.0529,0.0629,0.0729,0.0829], sa: [0.0249,0.0349,0.0449,0.0549,0.0649,0.0749,0.0849] };
    const parcelas = [12,24,36,48,60,72,84];
    
    for (let i = 0; i < parcelas.length; i++) {
        const p = parcelas[i];
        const btg = dados.vFinal * (taxas.btg[i] * Math.pow(1 + taxas.btg[i], p)) / (Math.pow(1 + taxas.btg[i], p) - 1);
        const bb = dados.vFinal * (taxas.bb[i] * Math.pow(1 + taxas.bb[i], p)) / (Math.pow(1 + taxas.bb[i], p) - 1);
        const bv = dados.vFinal * (taxas.bv[i] * Math.pow(1 + taxas.bv[i], p)) / (Math.pow(1 + taxas.bv[i], p) - 1);
        const sa = dados.vFinal * (taxas.sa[i] * Math.pow(1 + taxas.sa[i], p)) / (Math.pow(1 + taxas.sa[i], p) - 1);
        
        const elBtg = document.getElementById(`clienteBtg${p}`);
        const elBb = document.getElementById(`clienteBb${p}`);
        const elBv = document.getElementById(`clienteBv${p}`);
        const elSa = document.getElementById(`clienteSa${p}`);
        if (elBtg) elBtg.innerHTML = formatarMoeda(btg);
        if (elBb) elBb.innerHTML = formatarMoeda(bb);
        if (elBv) elBv.innerHTML = formatarMoeda(bv);
        if (elSa) elSa.innerHTML = formatarMoeda(sa);
    }
}

function fecharModalResumo() {
    const modal = document.getElementById('modalResumo');
    if (modal) modal.classList.remove('active');
}

function gerarPDFResumo() {
    gerarPDF();
}

// Exportar funções
window.adicionarListaResumo = adicionarListaResumo;
window.atualizarListaResumo = atualizarListaResumo;
window.removerItemResumo = removerItemResumo;
window.selecionarItemResumo = selecionarItemResumo;
window.gerarMultiplosOrcamentos = gerarMultiplosOrcamentos;
window.aplicarOrcamento = aplicarOrcamento;
window.gerarPDF = gerarPDF;
window.limparOrcamento = limparOrcamento;
window.registrarLog = registrarLog;
window.configurarHibrido = configurarHibrido;
window.fecharModal = fecharModal;
window.abrirModalResumo = abrirModalResumo;
window.fecharModalResumo = fecharModalResumo;
window.gerarPDFResumo = gerarPDFResumo;
window.copiarAbaAtiva = copiarAbaAtiva;
window.initTabs = initTabs;



console.log('✅ lista-resumo.js carregado com sucesso!');