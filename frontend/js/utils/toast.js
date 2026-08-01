// frontend/js/utils/toast.js
// Notificações Toast

function mostrarToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    const icone = tipo === 'success' ? '✓' : tipo === 'error' ? '✗' : tipo === 'warning' ? '⚠' : 'ℹ';
    
    toast.innerHTML = `
        <span style="font-size: 14px;">${icone}</span>
        <span>${mensagem}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.mostrarToast = mostrarToast;