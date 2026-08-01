// frontend/js/utils/formatters.js
// Funções de Formatação

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarNumero(valor, decimais = 2) {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimais,
        maximumFractionDigits: decimais
    }).format(valor);
}

function parseMoney(valor) {
    if (!valor) return 0;
    let v = String(valor).trim();
    v = v.replace('R$', '').replace(' ', '').replace(/\./g, '');
    v = v.replace(',', '.');
    return parseFloat(v) || 0;
}

function parsePercent(valor) {
    if (!valor) return 0;
    let v = String(valor).trim();
    v = v.replace('%', '').replace(' ', '');
    v = v.replace(',', '.');
    return (parseFloat(v) || 0) / 100;
}

// Exportar
window.formatarMoeda = formatarMoeda;
window.formatarNumero = formatarNumero;
window.parseMoney = parseMoney;
window.parsePercent = parsePercent;