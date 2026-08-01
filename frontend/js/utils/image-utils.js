// frontend/js/utils/image-utils.js
// Utilitários para processamento de imagens

console.log('🖼️ Carregando ImageProcessor...');

class ImageProcessor {
    constructor() {
        this.TARGET_SIZE = 500; // 500px
        this.FORMAT = 'image/png';
        this.QUALITY = 0.9;
        
        // Mapeamento de imagens padrão por categoria e tipo
        this.imagensPadrao = {
            placas: {
                default: 'modelo.jpg'
            },
            inversores: {
                'ONGRID': 'padraoongrid.png',
                'OFFGRID': 'padraooffgrid.png',
                'MICRO': 'padraomicro.png',
                'HIBRIDO': 'padraohibrido.png',
                'CONTROLADOR OFFGRID': 'padraocontrolador.png',
                'default': 'padraoongrid.png'
            },
            baterias: {
                'CHUMBO': 'padraochumbo.png',
                'LITIO': 'padraolitio.png',
                'ESTACIONARIA': 'padraoestacionaria.png',
                'default': 'padraoestacionaria.png'
            }
        };
    }

    async processImage(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Arquivo inválido'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    let width = this.TARGET_SIZE;
                    let height = this.TARGET_SIZE;
                    
                    if (img.width > img.height) {
                        width = this.TARGET_SIZE;
                        height = (img.height / img.width) * this.TARGET_SIZE;
                    } else {
                        height = this.TARGET_SIZE;
                        width = (img.width / img.height) * this.TARGET_SIZE;
                    }
                    
                    canvas.width = this.TARGET_SIZE;
                    canvas.height = this.TARGET_SIZE;
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    const x = (this.TARGET_SIZE - width) / 2;
                    const y = (this.TARGET_SIZE - height) / 2;
                    ctx.drawImage(img, x, y, width, height);
                    
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, this.FORMAT, this.QUALITY);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async removeBackground(imageBlob) {
        // Remoção de fundo não disponível nesta versão — retorna imagem original
        return imageBlob;
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    base64ToBlob(base64) {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
    }

    getImagemPadrao(tipo, categoria) {
        const categoriaMap = this.imagensPadrao[categoria];
        if (!categoriaMap) {
            return `/assets/images/${categoria}/modelo.jpg`;
        }
        
        const nomeArquivo = categoriaMap[tipo] || categoriaMap.default;
        return `/assets/images/${categoria}/${nomeArquivo}`;
    }

    getImagensPadraoPorCategoria(categoria) {
        const categoriaMap = this.imagensPadrao[categoria];
        if (!categoriaMap) return {};
        
        const imagens = {};
        for (const [tipo, nomeArquivo] of Object.entries(categoriaMap)) {
            if (tipo !== 'default') {
                imagens[tipo] = `/assets/images/${categoria}/${nomeArquivo}`;
            }
        }
        return imagens;
    }
}

window.imageProcessor = new ImageProcessor();
console.log('✅ ImageProcessor carregado');