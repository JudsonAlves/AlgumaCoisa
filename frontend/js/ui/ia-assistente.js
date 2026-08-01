// frontend/js/ui/ia-assistente.js
// Assistente de Vendas

class AssistenteSolar {
    constructor() {
        this.historico = [];
        this.inicializado = false;
    }

    async inicializar() {
        if (this.inicializado) return;
        
        await this.carregarDados();
        this.criarInterface();
        this.inicializado = true;
        
        console.log('🤖 Assistente Solar pronto!');
        this.adicionarMensagem('assistente', 
            'Olá! 👋 Sou seu assistente de vendas.\n\n' +
            '**Comandos que funcionam:**\n' +
            '• "500kWh com 8kW" (cria orçamento)\n' +
            '• "8kWp com micro" (kit com microinversor)\n' +
            '• "comparar preço 500kWh com 8kW" (compara com histórico)\n' +
            '• "quantas placas de 580W cabem 8kW" (calcula quantidade)\n' +
            '• "mostra histórico" (últimos orçamentos)\n' +
            '• "ajuda" (lista todos os comandos)');
    }

    async carregarDados() {
        try {
            const [placas, inversores, orcamentos] = await Promise.all([
                apiGet('/equipamentos/placas'),
                apiGet('/equipamentos/inversores'),
                apiGet('/orcamentos')
            ]);
            
            this.placas = placas;
            this.inversores = inversores;
            this.historicoOrcamentos = orcamentos;
            
            console.log(`📊 Dados: ${this.placas.length} placas, ${this.inversores.length} inversores, ${this.historicoOrcamentos.length} orçamentos`);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.placas = [];
            this.inversores = [];
            this.historicoOrcamentos = [];
        }
    }

    criarInterface() {
        if (document.getElementById('chatAssistente')) return;
        
        const chat = document.createElement('div');
        chat.id = 'chatAssistente';
        chat.className = 'chat-window';
        chat.innerHTML = `
            <div class="chat-header">
                <span>🤖 Assistente Solar</span>
                <button class="chat-close" onclick="assistenteSolar.fecharChat()">×</button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="message assistente">
                    <div class="message-content">Carregando...</div>
                </div>
            </div>
            <div class="chat-input">
                <input type="text" id="chatInput" placeholder="Digite sua pergunta..." onkeypress="if(event.key==='Enter') assistenteSolar.processarComando()">
                <button onclick="assistenteSolar.processarComando()">Enviar</button>
            </div>
        `;
        document.body.appendChild(chat);
        
        this.adicionarEstilos();
    }
    
    adicionarEstilos() {
        if (document.getElementById('chatStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'chatStyles';
        style.textContent = `
            .chat-window {
                position: fixed;
                bottom: 90px;
                right: 20px;
                width: 500px;
                height: 600px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 5px 25px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                z-index: 1001;
                transform: scale(0);
                opacity: 0;
                transition: all 0.3s;
                transform-origin: bottom right;
            }
            .chat-window.open {
                transform: scale(1);
                opacity: 1;
            }
            .chat-header {
                background: linear-gradient(135deg, #2ecc71, #27ae60);
                color: white;
                padding: 12px 16px;
                font-weight: 600;
                display: flex;
                justify-content: space-between;
            }
            .chat-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
            }
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
                background: #f8f9fa;
            }
            .message {
                margin-bottom: 12px;
                display: flex;
            }
            .message.usuario {
                justify-content: flex-end;
            }
            .message-content {
                max-width: 85%;
                padding: 8px 12px;
                border-radius: 12px;
                font-size: 13px;
                line-height: 1.4;
                white-space: pre-wrap;
            }
            .message.usuario .message-content {
                background: #2ecc71;
                color: white;
            }
            .message.assistente .message-content {
                background: white;
                color: #333;
                border: 1px solid #e0e0e0;
            }
            .chat-input {
                display: flex;
                padding: 12px;
                border-top: 1px solid #e0e0e0;
                background: white;
            }
            .chat-input input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 20px;
                outline: none;
                font-size: 13px;
            }
            .chat-input button {
                margin-left: 8px;
                padding: 8px 16px;
                background: #2ecc71;
                color: white;
                border: none;
                border-radius: 20px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    toggleChat() {
        const chat = document.getElementById('chatAssistente');
        chat.classList.toggle('open');
        if (chat.classList.contains('open')) {
            document.getElementById('chatInput')?.focus();
        }
    }
    
    fecharChat() {
        const chat = document.getElementById('chatAssistente');
        chat.classList.remove('open');
    }

    adicionarMensagem(tipo, texto, htmlExtra = null) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        const div = document.createElement('div');
        div.className = `message ${tipo}`;
        
        let textoFormatado = texto
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        
        if (htmlExtra) {
            div.innerHTML = `<div class="message-content">${textoFormatado}${htmlExtra}</div>`;
        } else {
            div.innerHTML = `<div class="message-content">${textoFormatado}</div>`;
        }
        
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    async processarComando() {
        const input = document.getElementById('chatInput');
        const texto = input.value.trim();
        if (!texto) return;
        
        this.adicionarMensagem('usuario', texto);
        input.value = '';
        
        this.adicionarMensagem('assistente', '🤔 Processando...');
        
        setTimeout(async () => {
            const messages = document.getElementById('chatMessages');
            if (messages.lastChild && messages.lastChild.querySelector('.message-content')?.innerHTML === '🤔 Processando...') {
                messages.lastChild.remove();
            }
            await this.interpretarComando(texto.toLowerCase());
        }, 100);
    }
    
    async interpretarComando(texto) {
        console.log('🔍 Analisando:', texto);
        
        if (texto.includes('comparar preço') || texto.includes('comparar')) {
            await this.compararPrecoHistorico(texto);
            return;
        }
        
        if (texto.includes('quantas placas') || (texto.includes('placas') && texto.includes('cabem'))) {
            await this.calcularQuantidadePlacas(texto);
            return;
        }
        
        let geracao = 0;
        let potenciaKit = 0;
        let potenciaInversor = 0;
        
        const kwhMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*kwh/);
        if (kwhMatch) geracao = parseFloat(kwhMatch[1].replace(',', '.'));
        
        const kwpMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*kwp/);
        if (kwpMatch) potenciaKit = parseFloat(kwpMatch[1].replace(',', '.'));
        
        const kwMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*kw(?!p)/);
        if (kwMatch) potenciaInversor = parseFloat(kwMatch[1].replace(',', '.'));
        
        if (geracao > 0 || potenciaKit > 0) {
            const comMicro = texto.includes('micro');
            const hibrido = texto.includes('híbrido') || texto.includes('hibrido');
            await this.criarOrcamento(geracao, potenciaKit, potenciaInversor, comMicro, hibrido);
            return;
        }
        
        if (texto.includes('histórico') || texto.includes('ultimos') || texto.includes('últimos')) {
            this.mostrarHistorico();
            return;
        }
        
        if (texto.includes('ajuda') || texto.includes('help')) {
            this.mostrarAjuda();
            return;
        }
        
        this.adicionarMensagem('assistente', 
            '❓ **Não entendi. Tente:**\n\n' +
            '• "500kWh com 8kW" (cria orçamento)\n' +
            '• "8kWp com micro" (kit com microinversor)\n' +
            '• "comparar preço 500kWh com 8kW" (compara com histórico)\n' +
            '• "quantas placas de 580W cabem 8kW" (calcula quantidade)\n' +
            '• "mostra histórico" (últimos orçamentos)\n' +
            '• "ajuda" (lista comandos)');
    }
    
    async compararPrecoHistorico(texto) {
        let geracao = 0;
        let potenciaInversor = 0;
        
        const kwhMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*kwh/);
        if (kwhMatch) geracao = parseFloat(kwhMatch[1].replace(',', '.'));
        
        const kwMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*kw(?!p)/);
        if (kwMatch) potenciaInversor = parseFloat(kwMatch[1].replace(',', '.'));
        
        if (geracao === 0) {
            this.adicionarMensagem('assistente', '❓ Para comparar, informe a geração. Ex: "comparar preço 500kWh com 8kW"');
            return;
        }
        
        this.adicionarMensagem('assistente', `🔍 Buscando orçamentos similares a ${geracao} kWh...`);
        
        const similares = this.historicoOrcamentos.filter(o => 
            Math.abs(o.geracao_requerida - geracao) / geracao < 0.2
        );
        
        if (similares.length === 0) {
            this.adicionarMensagem('assistente', `📊 Não encontrei orçamentos similares a ${geracao} kWh no histórico.`);
            return;
        }
        
        const precos = similares.map(o => o.valor_final);
        const media = precos.reduce((a, b) => a + b, 0) / precos.length;
        const menor = Math.min(...precos);
        const maior = Math.max(...precos);
        
        let precoAtual = 0;
        if (potenciaInversor > 0) {
            for (const placa of this.placas) {
                const fator = this.calcularFatorGeracao(placa);
                const qtd = Math.ceil(geracao / fator);
                if (qtd <= 50) {
                    const inversor = this.inversores.find(i => 
                        Math.abs(i.potencia - potenciaInversor * 1000) / (potenciaInversor * 1000) < 0.2
                    );
                    if (inversor) {
                        precoAtual = this.calcularPreco(placa, inversor, qtd);
                        break;
                    }
                }
            }
        }
        
        let mensagem = `📊 **Comparação para ${geracao} kWh**\n\n`;
        mensagem += `📈 **Base em ${similares.length} orçamentos similares:**\n`;
        mensagem += `   💰 Média: ${formatarMoeda(media)}\n`;
        mensagem += `   🏆 Menor: ${formatarMoeda(menor)}\n`;
        mensagem += `   📈 Maior: ${formatarMoeda(maior)}\n\n`;
        
        if (precoAtual > 0) {
            mensagem += `💰 **Seu preço estimado:** ${formatarMoeda(precoAtual)}\n`;
            const diferenca = ((precoAtual - media) / media * 100).toFixed(1);
            if (precoAtual <= menor) {
                mensagem += `🔥 **Excelente!** ${diferenca}% abaixo da média.`;
            } else if (precoAtual <= media) {
                mensagem += `👍 **Bom!** ${Math.abs(diferenca)}% abaixo da média.`;
            } else if (precoAtual <= media * 1.1) {
                mensagem += `📊 **Na média.** ${diferenca}% acima.`;
            } else {
                mensagem += `⚠️ **Acima da média.** ${diferenca}% acima. Reveja sua margem.`;
            }
        } else {
            mensagem += `💡 **Referência:** Para ${geracao} kWh, preços variam entre ${formatarMoeda(menor)} e ${formatarMoeda(maior)}.`;
        }
        
        this.adicionarMensagem('assistente', mensagem);
    }
    
    async calcularQuantidadePlacas(texto) {
        let potenciaPlaca = 0;
        let potenciaSistema = 0;
        
        const placaMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*w/);
        if (placaMatch) potenciaPlaca = parseFloat(placaMatch[1].replace(',', '.'));
        
        const sistemaMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*kw/);
        if (sistemaMatch) potenciaSistema = parseFloat(sistemaMatch[1].replace(',', '.'));
        
        if (potenciaPlaca === 0 || potenciaSistema === 0) {
            this.adicionarMensagem('assistente', '❓ Exemplo: "quantas placas de 580W cabem 8kW"');
            return;
        }
        
        const potenciaSistemaW = potenciaSistema * 1000;
        const qtdMinima = Math.ceil(potenciaSistemaW / potenciaPlaca);
        const qtdMaxima = Math.floor(potenciaSistemaW * 1.2 / potenciaPlaca);
        
        let mensagem = `📐 **Cálculo para placas de ${potenciaPlaca}W em sistema de ${potenciaSistema}kW**\n\n`;
        mensagem += `⚡ **Potência do sistema:** ${potenciaSistema}kW (${potenciaSistemaW}W)\n`;
        mensagem += `🔌 **Potência por placa:** ${potenciaPlaca}W\n\n`;
        mensagem += `📊 **Quantidades:**\n`;
        mensagem += `   • **Mínimo:** ${qtdMinima} placas (${(qtdMinima * potenciaPlaca / 1000).toFixed(2)} kW)\n`;
        mensagem += `   • **Recomendado:** ${qtdMinima + 1} a ${qtdMaxima} placas\n`;
        mensagem += `   • **Máximo:** ${qtdMaxima} placas (${(qtdMaxima * potenciaPlaca / 1000).toFixed(2)} kW)\n\n`;
        mensagem += `💡 **Recomendação:** Use ${qtdMinima} a ${qtdMinima + 2} placas de ${potenciaPlaca}W.`;
        
        this.adicionarMensagem('assistente', mensagem);
    }
    
    async criarOrcamento(geracao, potenciaKit, potenciaInversor, comMicro, hibrido) {
        let alvo = 0;
        let tipo = '';
        
        if (geracao > 0) {
            alvo = geracao;
            tipo = 'kWh';
        } else if (potenciaKit > 0) {
            alvo = potenciaKit;
            tipo = 'kWp';
        } else {
            this.adicionarMensagem('assistente', '❓ Qual valor? Ex: "500kWh" ou "8kWp"');
            return;
        }
        
        if (!this.placas || this.placas.length === 0) {
            this.adicionarMensagem('assistente', '⚠️ Nenhuma placa cadastrada.');
            return;
        }
        
        if (!this.inversores || this.inversores.length === 0) {
            this.adicionarMensagem('assistente', '⚠️ Nenhum inversor cadastrado.');
            return;
        }
        
        this.adicionarMensagem('assistente', `🔍 Procurando opções para ${alvo} ${tipo}...`);
        
        const kits = [];
        const invPotMin = potenciaInversor > 0 ? potenciaInversor * 1000 : 0;
        
        for (const placa of this.placas) {
            const fatorGeracao = this.calcularFatorGeracao(placa);
            
            for (const inversor of this.inversores) {
                if (comMicro && inversor.tipo !== 'MICRO') continue;
                if (hibrido && inversor.tipo !== 'HIBRIDO') continue;
                if (invPotMin > 0 && Math.abs(inversor.potencia - invPotMin) / invPotMin > 0.2) continue;
                
                let qtdPlacas = 0;
                let potenciaCalc = 0;
                let geracaoCalc = 0;
                
                if (tipo === 'kWh') {
                    qtdPlacas = Math.ceil(alvo / fatorGeracao);
                    if (qtdPlacas < 1) qtdPlacas = 1;
                    potenciaCalc = (placa.potencia * qtdPlacas) / 1000;
                    geracaoCalc = qtdPlacas * fatorGeracao;
                } else {
                    potenciaCalc = alvo;
                    qtdPlacas = Math.ceil((alvo * 1000) / placa.potencia);
                    if (qtdPlacas < 1) qtdPlacas = 1;
                    geracaoCalc = qtdPlacas * fatorGeracao;
                }
                
                if (qtdPlacas > 50) continue;
                
                const overload = ((potenciaCalc * 1000) / inversor.potencia - 1) * 100;
                if (overload < -30 || overload > 30) continue;
                
                const preco = this.calcularPreco(placa, inversor, qtdPlacas);
                
                kits.push({
                    placaId: placa.id,
                    inversorId: inversor.id,
                    placaMarca: placa.marca,
                    placaModelo: placa.modelo,
                    inversorMarca: inversor.marca,
                    inversorModelo: inversor.modelo,
                    inversorTipo: inversor.tipo,
                    inversorPotencia: inversor.potencia,
                    qtdPlacas: qtdPlacas,
                    potenciaKit: potenciaCalc.toFixed(2),
                    geracaoEstimada: Math.round(geracaoCalc),
                    overload: overload.toFixed(1),
                    preco: preco
                });
            }
        }
        
        kits.sort((a, b) => a.preco - b.preco);
        
        if (kits.length === 0) {
            this.adicionarMensagem('assistente', `❌ Nenhum kit encontrado para ${alvo} ${tipo}.`);
            return;
        }
        
        let mensagem = `🎯 **Encontrei ${kits.length} opções!**\n\n`;
        mensagem += `**Top ${Math.min(5, kits.length)} recomendações:**\n\n`;
        
        const topKits = kits.slice(0, 5);
        topKits.forEach((kit, i) => {
            mensagem += `${i + 1}. **${kit.potenciaKit} kWp** | ${kit.qtdPlacas}x ${kit.placaMarca} ${kit.placaModelo}\n`;
            mensagem += `   📊 ${kit.geracaoEstimada} kWh/mês | ⚡ Overload: ${kit.overload}%\n`;
            mensagem += `   💰 ${formatarMoeda(kit.preco)}\n\n`;
        });
        
        this.adicionarMensagem('assistente', mensagem);
    }
    
    usarKit(kit) {
        const placa = this.placas.find(p => p.id === kit.placaId);
        const inversor = this.inversores.find(i => i.id === kit.inversorId);
        
        if (placa && typeof window.selecionarPlacaLista === 'function') {
            window.selecionarPlacaLista(placa.id);
        }
        
        if (inversor && typeof window.selecionarInversorLista === 'function') {
            window.selecionarInversorLista(inversor.id);
        }
        
        const geracaoInput = document.getElementById('geracaoRequerida');
        if (geracaoInput) {
            geracaoInput.value = kit.geracaoEstimada;
        }
        
        if (typeof window.recalcularOrcamento === 'function') {
            setTimeout(() => window.recalcularOrcamento(), 100);
        }
        
        this.adicionarMensagem('assistente', `✅ Kit **${kit.potenciaKit} kWp** aplicado!`);
        setTimeout(() => this.fecharChat(), 1500);
    }
    
    mostrarHistorico() {
        if (!this.historicoOrcamentos || this.historicoOrcamentos.length === 0) {
            this.adicionarMensagem('assistente', '📭 Nenhum orçamento no histórico.');
            return;
        }
        
        const ultimos = this.historicoOrcamentos.slice(-5).reverse();
        let mensagem = '📋 **Últimos orçamentos:**\n\n';
        
        ultimos.forEach(orc => {
            const data = new Date(orc.data_orcamento).toLocaleDateString('pt-BR');
            mensagem += `📅 ${data} | ${orc.geracao_requerida} kWh\n`;
            mensagem += `   💰 ${formatarMoeda(orc.valor_final)}\n\n`;
        });
        
        const total = this.historicoOrcamentos.reduce((s, o) => s + o.valor_final, 0);
        mensagem += `---\n💰 Total: ${formatarMoeda(total)} | 📝 ${this.historicoOrcamentos.length} orçamentos`;
        
        this.adicionarMensagem('assistente', mensagem);
    }
    
    mostrarAjuda() {
        this.adicionarMensagem('assistente', 
            '📖 **Comandos que funcionam:**\n\n' +
            '**Orçamentos:**\n' +
            '• "500kWh com 8kW" (cria orçamento)\n' +
            '• "8kWp com micro" (kit com microinversor)\n\n' +
            '**Comparação:**\n' +
            '• "comparar preço 500kWh com 8kW" (compara com histórico)\n\n' +
            '**Cálculo de Placas:**\n' +
            '• "quantas placas de 580W cabem 8kW" (calcula quantidade)\n\n' +
            '**Histórico:**\n' +
            '• "mostra histórico" (últimos orçamentos)\n\n' +
            '**Ajuda:**\n' +
            '• "ajuda" ou "help"');
    }
    
    calcularFatorGeracao(placa) {
        const he = placa.horas_efetivas || 5;
        const dg = placa.dias_geracao || 30;
        const fator = placa.fator_percentual || 0.85;
        const margem = placa.margem_percentual || 0.98;
        return (placa.potencia * he * dg * fator * margem) / 1000;
    }
    
    calcularPreco(placa, inversor, qtdPlacas) {
        let precoPlaca = placa.potencia * 1.4;
        let precoInversor = inversor.potencia * 0.9;
        if (inversor.tipo === 'MICRO') precoInversor = inversor.potencia * 1.1;
        if (inversor.tipo === 'HIBRIDO') precoInversor = inversor.potencia * 1.2;
        
        const total = (precoPlaca * qtdPlacas) + precoInversor;
        const valorComImposto = total * 1.43;
        const valorFinal = Math.ceil((valorComImposto * 1.04) / 500) * 500;
        return valorFinal;
    }
}

// ============================================
// INICIALIZAR
// ============================================
let assistenteSolar = null;

document.addEventListener('DOMContentLoaded', async () => {
    assistenteSolar = new AssistenteSolar();
    await assistenteSolar.inicializar();
    window.assistenteSolar = assistenteSolar;
    console.log('✅ AssistenteSolar inicializado');
});

if (document.readyState === 'loading') {
    // já tem o listener acima
} else {
    (async () => {
        assistenteSolar = new AssistenteSolar();
        await assistenteSolar.inicializar();
        window.assistenteSolar = assistenteSolar;
        console.log('✅ AssistenteSolar inicializado (pronto)');
    })();
}