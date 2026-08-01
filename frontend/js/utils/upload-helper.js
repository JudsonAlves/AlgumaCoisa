// upload-helper.js — Upload de imagens via ImgBB (mesmo padrão do Scriptorium)

const IMGBB_API_KEY = 'c9fc3adf34b93c481b948602cc9b73e7';

function _dataURLtoBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime  = parts[0].match(/:(.*?);/)[1];
  const bytes = atob(parts[1]);
  const buf   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

// Redimensiona imagem para 500x500 mantendo proporção
async function redimensionarImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const TARGET = 500;
        const canvas = document.createElement('canvas');
        canvas.width = TARGET;
        canvas.height = TARGET;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, TARGET, TARGET);

        let w = TARGET, h = TARGET;
        if (img.width > img.height) { h = (img.height / img.width) * TARGET; }
        else                         { w = (img.width / img.height) * TARGET; }
        const x = (TARGET - w) / 2;
        const y = (TARGET - h) / 2;
        ctx.drawImage(img, x, y, w, h);

        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao converter')), 'image/png', 0.9);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload para ImgBB — retorna { success, url } 
async function uploadParaImgBB(blob) {
  const formData = new FormData();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', blob);

  try {
    const res    = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
    const result = await res.json();
    if (result.success) {
      return { success: true, url: result.data.url };
    }
    return { success: false, error: result.error?.message || 'Erro ImgBB' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Função principal: processa arquivo e faz upload para ImgBB.
 * Retorna a URL pública ou null em caso de falha.
 * 
 * @param {File} file - Arquivo selecionado pelo usuário
 * @param {string} previewImgId - ID do elemento <img> de preview
 * @param {string} previewDivId - ID do container do preview
 * @param {string} statusDivId  - ID do elemento de status
 * @returns {Promise<string|null>} URL pública da imagem ou null
 */
async function processarEFazerUpload(file, previewImgId, previewDivId, statusDivId) {
  const previewImg = document.getElementById(previewImgId);
  const previewDiv = document.getElementById(previewDivId);
  const statusDiv  = document.getElementById(statusDivId);

  function setStatus(msg, cor) {
    if (!statusDiv) return;
    statusDiv.style.display = 'block';
    statusDiv.style.backgroundColor = cor;
    statusDiv.style.color = cor === '#fff3cd' ? '#856404' : cor === '#cce5ff' ? '#004085' : cor === '#d4edda' ? '#155724' : '#721c24';
    statusDiv.innerHTML = msg;
  }

  if (!file || !file.type.startsWith('image/')) {
    mostrarToast('Selecione uma imagem válida', 'error');
    return null;
  }

  // Mostra loading
  setStatus('🔄 Redimensionando imagem...', '#cce5ff');
  if (previewDiv) previewDiv.style.display = 'block';
  if (previewImg) {
    previewImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="none" stroke="%232ecc71" stroke-width="4"%3E%3CanimateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1s" repeatCount="indefinite"/%3E%3C/circle%3E%3C/svg%3E';
    previewImg.style.cssText = 'max-width:100px;max-height:100px;object-fit:contain';
  }

  try {
    // 1. Redimensiona
    const blob = await redimensionarImagem(file);

    // 2. Preview local imediato
    const localUrl = URL.createObjectURL(blob);
    if (previewImg) previewImg.src = localUrl;

    // 3. Faz upload para ImgBB
    setStatus('☁️ Enviando para ImgBB...', '#cce5ff');
    const result = await uploadParaImgBB(blob);

    if (result.success) {
      setStatus(`✅ Imagem enviada! (${(blob.size/1024).toFixed(0)} KB)`, '#d4edda');
      setTimeout(() => { if (statusDiv) statusDiv.style.display = 'none'; }, 4000);
      mostrarToast('✅ Imagem carregada com sucesso!', 'success');
      return result.url;
    } else {
      setStatus('❌ Falha no upload: ' + result.error, '#f8d7da');
      mostrarToast('Erro ao enviar imagem: ' + result.error, 'error');
      return null;
    }
  } catch (e) {
    setStatus('❌ Erro: ' + e.message, '#f8d7da');
    mostrarToast('Erro ao processar imagem', 'error');
    return null;
  }
}

function mostrarToastProgresso(msg, tipo = 'info', timeout = 2000) {
  if (typeof mostrarToast === 'function') mostrarToast(msg, tipo);
}

window.processarEFazerUpload   = processarEFazerUpload;
window.uploadParaImgBB         = uploadParaImgBB;
window.redimensionarImagem     = redimensionarImagem;
window.mostrarToastProgresso   = mostrarToastProgresso;

console.log('✅ upload-helper.js (ImgBB) carregado');
