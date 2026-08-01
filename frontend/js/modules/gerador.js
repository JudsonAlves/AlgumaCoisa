// frontend/js/gerador.js

// ============================================
// VARIÁVEIS DO GERADOR
// ============================================
let geradorState = {
    dimensionType: 'kwh',
    potencia: 0,
    consumo: 0,
    fase: 'MONOFASICO 220V',
    cidade: 'Imperatriz - MA',
    estrutura: 'TELHADO CERÂMICO / COLONIAL',
    kitsGerados: [],
    kitSelecionado: null
};

// ============================================
// GERAÇÃO DE KITS
// ============================================

function alterarTipoDimensionamento(tipo) {
    geradorState.dimensionType = tipo;
    
    const btns = document.querySelectorAll('.opcao-btn');
    btns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(tipo === 'kwh' ? 'kWh' : 'kWp')) {
            btn.classList.add('active');
        }
    });
    
    const label = document.getElementById('dimensionamentoLabel');
    const unidade = document.getElementById('dimensionamentoUnidade');
    const input = document.getElementById('dimensionamentoValor');
    
    if (tipo === 'kwh') {
        if (label) label.innerHTML = 'Consumo Médio Mensal (kWh)';
        if (unidade) unidade.innerHTML = 'kWh';
        if (input) { input.placeholder = 'Ex: 500'; input.step = '10'; }
    } else {
        if (label) label.innerHTML = 'Potência Desejada (kWp)';
        if (unidade) unidade.innerHTML = 'kWp';
        if (input) { input.placeholder = 'Ex: 5.5'; input.step = '0.5'; }
    }
    
    if (input) input.value = '';
}

function calcularFatorGeracaoPlaca(placa) {
    const he = placa.horas_efetivas || 5;
    const dg = placa.dias_geracao || 30;
    const fator = placa.fator_percentual || 0.85;
    const margem = placa.margem_percentual || 0.98;
    return (placa.potencia * he * dg * fator * margem) / 1000;
}

async function gerarKits() {
    console.log('🔍 Gerando kits...');
    
    const valorInput = document.getElementById('dimensionamentoValor');
    const valor = parseFloat(valorInput?.value);
    
    if (!valor || valor <= 0) {
        mostrarToast('❌ Preencha o valor de dimensionamento!', 'error');
        return;
    }
    
    if (geradorState.dimensionType === 'kwh') {
        geradorState.consumo = valor;
        geradorState.potencia = 0;
    } else {
        geradorState.potencia = valor;
        geradorState.consumo = 0;
    }
    
    geradorState.fase = document.getElementById('geradorFase')?.value || 'MONOFASICO 220V';
    geradorState.cidade = document.getElementById('geradorCidade')?.value || 'Imperatriz - MA';
    geradorState.estrutura = document.getElementById('geradorEstrutura')?.value || 'TELHADO CERÂMICO / COLONIAL';
    
    const btnGerar = document.getElementById('btnGerarKits');
    const originalText = btnGerar.innerHTML;
    btnGerar.innerHTML = '⏳ Gerando combinações...';
    btnGerar.disabled = true;
    
    const listaContainer = document.getElementById('listaKitsGerados');
    if (listaContainer) {
        listaContainer.innerHTML = '<div class="loading">⏳ Gerando combinações de kits...</div>';
    }
    
    try {
        const placas = await apiGet('/equipamentos/placas');
        const inversores = await apiGet('/equipamentos/inversores');
        
        if (placas.length === 0) {
            mostrarToast('❌ Nenhuma placa cadastrada!', 'error');
            btnGerar.innerHTML = originalText;
            btnGerar.disabled = false;
            if (listaContainer) listaContainer.innerHTML = '<div class="no-results"><span>🔌</span><p>Nenhuma placa cadastrada</p></div>';
            return;
        }
        
        if (inversores.length === 0) {
            mostrarToast('❌ Nenhum inversor cadastrado!', 'error');
            btnGerar.innerHTML = originalText;
            btnGerar.disabled = false;
            if (listaContainer) listaContainer.innerHTML = '<div class="no-results"><span>⚡</span><p>Nenhum inversor cadastrado</p></div>';
            return;
        }
        
        const kits = [];
        
        for (const placa of placas) {
            const fatorGeracao = calcularFatorGeracaoPlaca(placa);
            
            for (const inversor of inversores) {
                if (!verificarCompatibilidade(placa, inversor)) continue;
                
                let qtdPlacas = 0;
                let potenciaKit = 0;
                let geracaoEstimada = 0;
                let overload = 0;
                
                if (geradorState.dimensionType === 'kwh') {
                    qtdPlacas = Math.ceil(geradorState.consumo / fatorGeracao);
                    if (qtdPlacas < 1) qtdPlacas = 1;
                    potenciaKit = (placa.potencia * qtdPlacas) / 1000;
                    geracaoEstimada = qtdPlacas * fatorGeracao;
                    overload = ((potenciaKit * 1000) / inversor.potencia - 1) * 100;
                } else {
                    potenciaKit = geradorState.potencia;
                    qtdPlacas = Math.ceil((potenciaKit * 1000) / placa.potencia);
                    geracaoEstimada = qtdPlacas * fatorGeracao;
                    overload = ((potenciaKit * 1000) / inversor.potencia - 1) * 100;
                }
                
                if (qtdPlacas > 100) continue;
                if (overload < -50 || overload > 50) continue;
                
                const valorForn = calcularValorAproximado(placa, inversor, qtdPlacas);
                const precoFinal = calcularValorFinalCompleto(valorForn);
                
                kits.push({
                    id: `${placa.id}_${inversor.id}`,
                    potenciaKit: potenciaKit.toFixed(2),
                    geracaoEstimada: Math.round(geracaoEstimada),
                    qtdPlacas: qtdPlacas,
                    placa: {
                        id: placa.id,
                        marca: placa.marca,
                        modelo: placa.modelo,
                        potencia: placa.potencia,
                        garantia: placa.garantia
                    },
                    inversor: {
                        id: inversor.id,
                        marca: inversor.marca,
                        modelo: inversor.modelo,
                        tipo: inversor.tipo,
                        potencia: inversor.potencia
                    },
                    overload: overload.toFixed(2),
                    preco: precoFinal,
                    precoPorWp: (precoFinal / parseFloat(potenciaKit)).toFixed(2)
                });
            }
        }
        
        kits.sort((a, b) => a.preco - b.preco);
        geradorState.kitsGerados = kits.slice(0, 50);
        
        atualizarFiltros(geradorState.kitsGerados);
        exibirKitsGerados(geradorState.kitsGerados);
        
        const tabResultadosBtn = document.getElementById('tabResultadosBtn');
        const qtdKitsSpan = document.getElementById('qtdKits');
        if (tabResultadosBtn) {
            if (qtdKitsSpan) qtdKitsSpan.innerHTML = geradorState.kitsGerados.length;
            tabResultadosBtn.style.display = 'block';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tabResultadosBtn.classList.add('active');
            const tabResultados = document.getElementById('tabResultados');
            if (tabResultados) tabResultados.classList.add('active');
        }
        
        if (geradorState.kitsGerados.length === 0) {
            mostrarToast('⚠️ Nenhuma combinação encontrada!', 'warning');
            if (listaContainer) {
                listaContainer.innerHTML = '<div class="no-results"><span>🔍</span><p>Nenhum kit encontrado</p></div>';
            }
        } else {
            mostrarToast(`✅ ${geradorState.kitsGerados.length} kits gerados!`, 'success');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarToast('Erro ao gerar kits', 'error');
        if (listaContainer) {
            listaContainer.innerHTML = `<div class="no-results"><span>⚠️</span><p>Erro: ${error.message}</p></div>`;
        }
    } finally {
        btnGerar.innerHTML = originalText;
        btnGerar.disabled = false;
    }
}

function calcularValorAproximado(placa, inversor, qtdPlacas) {
    let precoPlaca = placa.potencia >= 600 ? placa.potencia * 1.2 : placa.potencia * 1.5;
    let precoInversor = inversor.potencia * 0.9;
    if (inversor.tipo === 'MICRO') precoInversor = inversor.potencia * 1.1;
    if (inversor.tipo === 'HIBRIDO') precoInversor = inversor.potencia * 1.2;
    if (inversor.tipo === 'OFFGRID') precoInversor = inversor.potencia * 1.15;
    const total = (precoPlaca * qtdPlacas) + precoInversor;
    return total * 1.1;
}

function calcularValorFinalCompleto(valorForn) {
    const imposto = 0.43;
    const margem = 0.04;
    const reajuste = 150;
    const valorComImposto = valorForn * (1 + imposto);
    const baseFin = (valorComImposto * (1 + margem)) + reajuste;
    return Math.ceil(baseFin / 500) * 500;
}

function verificarCompatibilidade(placa, inversor) {
    if (inversor.tipo === 'MICRO') return true;
    const tensaoInversor = inversor.tensao || '220V';
    if (tensaoInversor === '380V' && inversor.potencia < 12000) {
        return inversor.potencia >= 10000;
    }
    return true;
}

function atualizarFiltros(kits) {
    const inversoresUnicos = [];
    const inversoresMap = new Map();
    for (const kit of kits) {
        if (!inversoresMap.has(kit.inversor.id)) {
            inversoresMap.set(kit.inversor.id, kit.inversor);
            inversoresUnicos.push(kit.inversor);
        }
    }
    
    const placasUnicas = [];
    const placasMap = new Map();
    for (const kit of kits) {
        if (!placasMap.has(kit.placa.id)) {
            placasMap.set(kit.placa.id, kit.placa);
            placasUnicas.push(kit.placa);
        }
    }
    
    const filtroInversor = document.getElementById('filtroInversor');
    const filtroPlaca = document.getElementById('filtroPlaca');
    
    if (filtroInversor) {
        filtroInversor.innerHTML = '<option value="">Todos os Inversores</option>' +
            inversoresUnicos.map(inv => `<option value="${inv.id}">${inv.marca} ${inv.modelo} (${inv.potencia}W)</option>`).join('');
    }
    
    if (filtroPlaca) {
        filtroPlaca.innerHTML = '<option value="">Todas as Placas</option>' +
            placasUnicas.map(pl => `<option value="${pl.id}">${pl.marca} ${pl.modelo} (${pl.potencia}W)</option>`).join('');
    }
}

function filtrarKits() {
    const filtroInversor = document.getElementById('filtroInversor')?.value;
    const filtroPlaca = document.getElementById('filtroPlaca')?.value;
    let kitsFiltrados = [...geradorState.kitsGerados];
    if (filtroInversor) kitsFiltrados = kitsFiltrados.filter(k => k.inversor.id == filtroInversor);
    if (filtroPlaca) kitsFiltrados = kitsFiltrados.filter(k => k.placa.id == filtroPlaca);
    exibirKitsGerados(kitsFiltrados);
}

function exibirKitsGerados(kits) {
    const container = document.getElementById('listaKitsGerados');
    if (!container) return;
    
    if (kits.length === 0) {
        container.innerHTML = `<div class="no-results"><span>🔍</span><p>Nenhum kit encontrado</p></div>`;
        return;
    }
    
    container.innerHTML = kits.map(kit => `
        <div class="kit-card" onclick="mostrarDetalhesKit(${JSON.stringify(kit).replace(/"/g, '&quot;')})">
            <div class="kit-header">
                <div class="kit-potencia">
                    <span class="potencia-valor">${kit.potenciaKit} kWp</span>
                    <span class="potencia-geracao">~${kit.geracaoEstimada} kWh/mês</span>
                </div>
                ${parseFloat(kit.overload) > 15 ? 
                    `<span class="kit-badge warning">⚠️ Overload: ${kit.overload}%</span>` : 
                    `<span class="kit-badge success">✓ OK: ${Math.abs(kit.overload)}%</span>`
                }
            </div>
            <div class="kit-body">
                <div class="kit-placa">
                    <div class="kit-icon">🔌</div>
                    <div class="kit-info">
                        <div class="kit-title">Placa Solar</div>
                        <div class="kit-detail">${kit.placa.marca} ${kit.placa.modelo}</div>
                        <div class="kit-spec">${kit.placa.potencia}W | ${kit.qtdPlacas}x unidades</div>
                    </div>
                </div>
                <div class="kit-inversor">
                    <div class="kit-icon">⚡</div>
                    <div class="kit-info">
                        <div class="kit-title">Inversor</div>
                        <div class="kit-detail">${kit.inversor.marca} ${kit.inversor.modelo}</div>
                        <div class="kit-spec">${kit.inversor.tipo} | ${kit.inversor.potencia}W</div>
                    </div>
                </div>
            </div>
            <div class="kit-footer">
                <div class="kit-price">
                    <span class="price-value">${formatarMoeda(kit.preco)}</span>
                    <span class="price-wp">R$ ${kit.precoPorWp}/Wp</span>
                </div>
                <button class="btn-select-kit" onclick="selecionarKitParaOrcamento(${kit.placa.id}, ${kit.inversor.id}, ${kit.qtdPlacas}); event.stopPropagation();">Usar este kit</button>
            </div>
        </div>
    `).join('');
}

function mostrarDetalhesKit(kit) {
    const detalhesHTML = `
        <div id="modalDetalhesKit" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header"><h3>📦 Detalhes do Kit</h3><button class="modal-close" onclick="fecharModalDetalhesKit()">×</button></div>
                <div class="modal-body">
                    <div class="kit-detalhes">
                        <div class="detalhe-item"><strong>Potência do Kit:</strong><span>${kit.potenciaKit} kWp</span></div>
                        <div class="detalhe-item"><strong>Geração Estimada:</strong><span>${kit.geracaoEstimada} kWh/mês</span></div>
                        <div class="detalhe-item"><strong>Overload:</strong><span class="${parseFloat(kit.overload) > 0 ? 'text-warning' : 'text-success'}">${kit.overload}%</span></div>
                        <hr>
                        <div class="detalhe-item"><strong>Placa:</strong><span>${kit.placa.marca} ${kit.placa.modelo}</span></div>
                        <div class="detalhe-item"><strong>Quantidade:</strong><span>${kit.qtdPlacas} unidades</span></div>
                        <div class="detalhe-item"><strong>Potência por Placa:</strong><span>${kit.placa.potencia} W</span></div>
                        <div class="detalhe-item"><strong>Garantia:</strong><span>${kit.placa.garantia} anos</span></div>
                        <hr>
                        <div class="detalhe-item"><strong>Inversor:</strong><span>${kit.inversor.marca} ${kit.inversor.modelo}</span></div>
                        <div class="detalhe-item"><strong>Tipo:</strong><span>${kit.inversor.tipo}</span></div>
                        <div class="detalhe-item"><strong>Potência:</strong><span>${kit.inversor.potencia} W</span></div>
                        <div class="detalhe-item"><strong>Garantia:</strong><span>${kit.inversor.garantia || 10} anos</span></div>
                        <hr>
                        <div class="detalhe-item"><strong>Preço Total:</strong><span class="price-highlight">${formatarMoeda(kit.preco)}</span></div>
                        <div class="detalhe-item"><strong>Preço por Wp:</strong><span>R$ ${kit.precoPorWp}/Wp</span></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="fecharModalDetalhesKit()">Fechar</button>
                    <button class="btn btn-primary" onclick="selecionarKitParaOrcamento(${kit.placa.id}, ${kit.inversor.id}, ${kit.qtdPlacas})">Usar este kit</button>
                </div>
            </div>
        </div>
    `;
    const existingModal = document.getElementById('modalDetalhesKit');
    if (existingModal) existingModal.remove();
    const div = document.createElement('div');
    div.innerHTML = detalhesHTML;
    document.body.appendChild(div.firstElementChild);
}

function fecharModalDetalhesKit() {
    const modal = document.getElementById('modalDetalhesKit');
    if (modal) modal.remove();
}

function selecionarKitParaOrcamento(placaId, inversorId, qtdPlacas) {
    console.log('📦 Selecionando kit:', { placaId, inversorId, qtdPlacas });
    const placa = window.AppState.placas.find(p => p.id === placaId);
    const inversor = window.AppState.inversores.find(i => i.id === inversorId);
    if (!placa || !inversor) {
        mostrarToast('❌ Erro ao selecionar kit!', 'error');
        return;
    }
    if (typeof window.selecionarPlacaLista === 'function') window.selecionarPlacaLista(placaId);
    if (typeof window.selecionarInversorLista === 'function') window.selecionarInversorLista(inversorId);
    const fatorGeracao = calcularFatorGeracaoPlaca(placa);
    const geracaoRequerida = qtdPlacas * fatorGeracao;
    const geracaoInput = document.getElementById('geracaoRequerida');
    if (geracaoInput) geracaoInput.value = Math.round(geracaoRequerida);
    fecharModalGerador();
    const detalhesModal = document.getElementById('modalDetalhesKit');
    if (detalhesModal) detalhesModal.remove();
    setTimeout(() => {
        if (typeof window.recalcularOrcamento === 'function') window.recalcularOrcamento();
        mostrarToast('✅ Kit carregado no orçamento!', 'success');
        const orcamentoNav = document.querySelector('[data-page="orcamento"]');
        if (orcamentoNav) orcamentoNav.click();
    }, 100);
}

function fecharModalGerador() {
    const modal = document.getElementById('modalGerador');
    if (modal) modal.classList.remove('active');
}

window.abrirGeradorKits = abrirGeradorKits;
window.alterarTipoDimensionamento = alterarTipoDimensionamento;
window.gerarKits = gerarKits;
window.fecharModalGerador = fecharModalGerador;
window.filtrarKits = filtrarKits;
window.selecionarKitParaOrcamento = selecionarKitParaOrcamento;
window.mostrarDetalhesKit = mostrarDetalhesKit;
window.fecharModalDetalhesKit = fecharModalDetalhesKit;

console.log('✅ gerador.js carregado com sucesso!');
