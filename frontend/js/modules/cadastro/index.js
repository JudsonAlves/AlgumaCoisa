// frontend/js/modules/cadastro/index.js
// Arquivo principal que importa todos os módulos de cadastro

// ============================================
// FUNÇÕES COMUNS
// ============================================

function mostrarQuantidadePlaca(mostrar) {
    const grupo = document.getElementById('placaQuantidadeGroup');
    if (grupo) grupo.style.display = mostrar ? 'block' : 'none';
}

function mostrarQuantidadeInversor(mostrar) {
    const grupo = document.getElementById('inversorQuantidadeGroup');
    if (grupo) grupo.style.display = mostrar ? 'block' : 'none';
}

function mostrarQuantidadeBateria(mostrar) {
    const grupo = document.getElementById('bateriaQuantidadeGroup');
    if (grupo) grupo.style.display = mostrar ? 'block' : 'none';
}

function atualizarQuantidadePlaca() {
    const input = document.getElementById('placaQuantidade');
    if (!input) return;
    const novaQuantidade = parseInt(input.value) || 1;
    window.quantidadePlacaManual = novaQuantidade;
    if (typeof recalcularOrcamento === 'function') recalcularOrcamento();
}

function atualizarQuantidadeInversor() {
    const input = document.getElementById('inversorQuantidade');
    if (!input) return;
    const novaQuantidade = parseInt(input.value) || 1;
    window.quantidadeInversorManual = novaQuantidade;
    if (typeof recalcularOrcamento === 'function') recalcularOrcamento();
}

function atualizarQuantidadeBateria() {
    const input = document.getElementById('bateriaQuantidade');
    if (!input) return;
    const novaQuantidade = parseInt(input.value) || 0;
    window.quantidadeBateriaManual = novaQuantidade;
    if (typeof recalcularOrcamento === 'function') recalcularOrcamento();
}

function fecharModal() {
    const modal = document.getElementById('modalSelecao');
    if (modal) modal.classList.remove('active');
}

// ============================================
// EXPORTAR FUNÇÕES COMUNS
// ============================================

window.mostrarQuantidadePlaca = mostrarQuantidadePlaca;
window.mostrarQuantidadeInversor = mostrarQuantidadeInversor;
window.mostrarQuantidadeBateria = mostrarQuantidadeBateria;
window.atualizarQuantidadePlaca = atualizarQuantidadePlaca;
window.atualizarQuantidadeInversor = atualizarQuantidadeInversor;
window.atualizarQuantidadeBateria = atualizarQuantidadeBateria;
window.fecharModal = fecharModal;

console.log('✅ cadastro/index.js carregado');