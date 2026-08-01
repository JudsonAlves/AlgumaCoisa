// frontend/js/core/state.js
// Estado Global da Aplicação

// Estado principal
window.AppState = {
    placaSelecionada: null,
    inversorSelecionado: null,
    bateriaSelecionada: null,
    clienteSelecionado: null,
    placas: [],
    inversores: [],
    baterias: [],
    clientes: [],
    logs: [],
    listaResumo: []
};

// Variáveis globais (inicializadas aqui)
window.orcamentoCalculado = null;
window.quantidadePlacaManual = null;
window.quantidadeInversorManual = null;
window.quantidadeBateriaManual = null;

console.log('✅ state.js carregado');