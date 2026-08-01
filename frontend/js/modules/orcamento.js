// frontend/js/modules/orcamento.js
// Funções de cálculo do orçamento

// NÃO declarar novamente as variáveis - elas já estão no state.js
// let orcamentoCalculado = null;  ← REMOVER
// let invQuantidadeManual = null;  ← REMOVER
// let placaQuantidadeManual = null; ← REMOVER

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

function calcFatorGeracao(placa) {
    const he = placa.horas_efetivas || 5;
    const dg = placa.dias_geracao || 30;
    const fator = placa.fator_percentual || 0.85;
    const margem = placa.margem_percentual || 0.98;
    return (placa.potencia * he * dg * fator * margem) / 1000;
}

function calcGeracaoPorPlacas(qtd, fator) {
    return qtd * fator;
}

function calcPlacasPorGeracao(geracao, fator) {
    if (fator <= 0 || geracao <= 0) return 1;
    return Math.ceil(geracao / fator);
}

function calcPotenciaKit(placa, qtd) {
    return (placa.potencia * qtd) / 1000;
}

function calcValorFinal(vFornec, imp, marg, reaj, desc, acresc, frete) {
    const vComImposto = vFornec * (1 + imp);
    const baseFin = (vComImposto * (1 + marg)) + reaj;
    let vFinal = Math.round(baseFin / 500) * 500;
    if (vFinal < baseFin && (baseFin - vFinal) > 250) {
        vFinal = vFinal + 500;
    }
    vFinal = vFinal - desc + acresc + frete;
    return vFinal;
}

function arredondar50(valor) {
    return Math.round(valor / 50) * 50;
}

function calcQtdModulos(gerReq, fator, valorArredon) {
    if (fator <= 0 || gerReq <= 0) return 0;
    let calcBase = Math.ceil(gerReq / fator);
    let qtd = calcBase;
    if (valorArredon > 0 && (gerReq - valorArredon) <= ((calcBase - 1) * fator)) {
        qtd = calcBase - 1;
    }
    return qtd > 0 ? qtd : 0;
}

function calcQtdInversores(qtdModulos, tipoInv) {
    if (!tipoInv) return 1;
    if (tipoInv.toUpperCase() === 'MICRO') {
        return Math.ceil(qtdModulos / 4);
    }
    return 1;
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

function recalcularOrcamento() {
    console.log('🔄 Recalculando orçamento...');
    
    if (!window.AppState.placaSelecionada) {
        console.log('Sem placa selecionada');
        return;
    }
    
    const elGerReq = document.getElementById('geracaoRequerida');
    const elQtdPlacas = document.getElementById('placaQuantidade');
    const elValorForn = document.getElementById('valorFornecimento');
    const elMargem = document.getElementById('margem');
    const elImposto = document.getElementById('imposto');
    const elReajuste = document.getElementById('reajuste');
    const elDesconto = document.getElementById('desconto');
    const elAcrescimo = document.getElementById('acrescimo');
    const elFrete = document.getElementById('frete');
    const chkArredondar = document.getElementById('arredondamentoAuto')?.checked;
    
    let gerReq = parseFloat(elGerReq?.value) || 0;
    let qtdPlacas = parseInt(elQtdPlacas?.value) || 1;
    
    const valorForn = parseMoney(elValorForn?.value);
    const margem = parsePercent(elMargem?.value);
    const imposto = parsePercent(elImposto?.value);
    const reajuste = parseMoney(elReajuste?.value);
    const desconto = parseMoney(elDesconto?.value);
    const acrescimo = parseMoney(elAcrescimo?.value);
    const frete = parseMoney(elFrete?.value);
    
    const fator = calcFatorGeracao(window.AppState.placaSelecionada);
    
    let qtdModulos;
    let gerFinal;
    
    if (gerReq > 0) {
        let valorArredon = 0;
        if (chkArredondar) {
            valorArredon = gerReq < 1500 ? 9 : 15;
        }
        qtdModulos = calcQtdModulos(gerReq, fator, valorArredon);
        if (qtdModulos === 0 && gerReq > 0) qtdModulos = 1;
        
        if (window.quantidadePlacaManual === null && elQtdPlacas && elQtdPlacas.value != qtdModulos) {
            elQtdPlacas.value = qtdModulos;
        }
        
        const gerReal = calcGeracaoPorPlacas(qtdModulos, fator);
        gerFinal = gerReal;
        
        const gerArred = arredondar50(gerReal);
        if (chkArredondar && (gerArred - gerReal) > 0 && (gerArred - gerReal) <= valorArredon) {
            gerFinal = gerArred;
        }
        
        console.log(`📊 ${gerReq} kWh → ${qtdModulos} placas → ${gerFinal.toFixed(0)} kWh`);
        
    } else {
        qtdModulos = qtdPlacas;
        gerFinal = calcGeracaoPorPlacas(qtdModulos, fator);
        console.log(`📊 ${qtdModulos} placas → ${gerFinal.toFixed(0)} kWh`);
    }
    
    const potenciaKit = calcPotenciaKit(window.AppState.placaSelecionada, qtdModulos);
    
    let qtdInversores;
    const tipoInv = window.AppState.inversorSelecionado?.tipo || '';
    const elInvQtd = document.getElementById('inversorQuantidade');
    
    if (window.quantidadeInversorManual !== null && window.quantidadeInversorManual > 0) {
        qtdInversores = window.quantidadeInversorManual;
    } else {
        qtdInversores = calcQtdInversores(qtdModulos, tipoInv);
        if (elInvQtd && elInvQtd.value != qtdInversores) {
            elInvQtd.value = qtdInversores;
        }
    }
    
    let qtdBaterias = parseInt(document.getElementById('bateriaQuantidade')?.value) || 0;
    
    const vComImposto = valorForn * (1 + imposto);
    const vFinal = calcValorFinal(valorForn, imposto, margem, reajuste, desconto, acrescimo, frete);
    
    // Atualizar campos
    document.getElementById('qtdePlacas').innerHTML = qtdModulos;
    document.getElementById('potenciaKit').innerHTML = `${formatarNumero(potenciaKit, 2)} kWp`;
    document.getElementById('geracaoEstimada').innerHTML = `${Math.round(gerFinal)} kWh`;
    document.getElementById('qtdeInversores').innerHTML = qtdInversores;
    document.getElementById('valorComImposto').innerHTML = formatarMoeda(vComImposto);
    document.getElementById('valorFinal').innerHTML = formatarMoeda(vFinal);
    document.getElementById('valorTotalOrc').innerHTML = formatarMoeda(vFinal);
    
    // Salvar dados
    window.orcamentoCalculado = {
        qtdModulos,
        potenciaKit,
        qtdInversores,
        qtdBaterias,
        gerFinal,
        vComImposto,
        vFinal,
        gerReq: gerReq,
        valorForn,
        margem,
        imposto,
        reajuste,
        desconto,
        acrescimo,
        frete,
        fator
    };
    
    console.log('✅ Cálculo concluído');
    return window.orcamentoCalculado;
}

// ============================================
// EVENTOS
// ============================================

function aoMudarGeracao() {
    console.log('📝 Geração alterada');
    window.quantidadePlacaManual = null;
    recalcularOrcamento();
}

function aoMudarPlacas() {
    console.log('📝 Placas alteradas');
    const input = document.getElementById('placaQuantidade');
    if (input) {
        window.quantidadePlacaManual = parseInt(input.value) || 1;
    }
    recalcularOrcamento();
}

function aoMudarInversorQuantidade() {
    console.log('📝 Inversor quantidade alterada');
    const input = document.getElementById('inversorQuantidade');
    let valor = parseInt(input.value);
    if (isNaN(valor) || valor < 1) {
        valor = 1;
        input.value = 1;
    }
    window.quantidadeInversorManual = valor;
    recalcularOrcamento();
}

function aoMudarParametro() {
    recalcularOrcamento();
}

function resetarInvManual() {
    window.quantidadeInversorManual = null;
    const input = document.getElementById('inversorQuantidade');
    if (input && window.AppState.inversorSelecionado) {
        const tipoInv = window.AppState.inversorSelecionado.tipo || '';
        const qtdPlacas = parseInt(document.getElementById('placaQuantidade')?.value) || 1;
        let qtdAuto = calcQtdInversores(qtdPlacas, tipoInv);
        input.value = qtdAuto;
    }
}

// Exportar funções
window.recalcularOrcamento = recalcularOrcamento;
window.aoMudarGeracao = aoMudarGeracao;
window.aoMudarPlacas = aoMudarPlacas;
window.aoMudarInversorQuantidade = aoMudarInversorQuantidade;
window.aoMudarParametro = aoMudarParametro;
window.resetarInvManual = resetarInvManual;

console.log('✅ orcamento.js carregado');