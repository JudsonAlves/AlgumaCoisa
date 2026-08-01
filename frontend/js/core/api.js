// frontend/js/core/api.js
// Funções de API

// Detecta o formato de erro do backend GAS: { error: '...' } com HTTP 200.
function checkGasError(json) {
    if (json && typeof json === 'object' && !Array.isArray(json) && 'error' in json) {
        throw new Error(json.error);
    }
    return json;
}

async function apiGet(endpoint) {
    try {
        const response = await fetch(`/api${endpoint}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return checkGasError(await response.json());
    } catch (error) {
        console.error('❌ Erro na API GET:', error);
        mostrarToast('Erro ao carregar dados: ' + error.message, 'error');
        return [];
    }
}

async function apiPost(endpoint, data) {
    try {
        const response = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return checkGasError(await response.json());
    } catch (error) {
        console.error('❌ Erro na API POST:', error);
        mostrarToast('Erro ao salvar dados: ' + error.message, 'error');
        return null;
    }
}

async function apiPut(endpoint, data) {
    try {
        const response = await fetch(`/api${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return checkGasError(await response.json());
    } catch (error) {
        console.error('❌ Erro na API PUT:', error);
        mostrarToast('Erro ao atualizar: ' + error.message, 'error');
        return null;
    }
}

async function apiDelete(endpoint) {
    try {
        const response = await fetch(`/api${endpoint}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return checkGasError(await response.json());
    } catch (error) {
        console.error('❌ Erro na API DELETE:', error);
        mostrarToast('Erro ao excluir: ' + error.message, 'error');
        return null;
    }
}

// Exportar
window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiPut = apiPut;
window.apiDelete = apiDelete;