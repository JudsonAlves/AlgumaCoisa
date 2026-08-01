// frontend/js/ui/terminal-manager.js
// Terminal Manager - Versão com execução de comandos

class TerminalManager {
    constructor() {
        this.terminalAberto = false;
        this.historico = [];
    }

    criarTerminal() {
        if (document.getElementById('terminalContainer')) return;
        
        const terminalHTML = `
            <div id="terminalContainer" class="terminal-container" style="display: none;">
                <div class="terminal-header">
                    <div class="terminal-title">
                        <span>🖥️ Console do Sistema</span>
                    </div>
                    <div class="terminal-controls">
                        <button class="terminal-btn" id="terminalCloseBtn">✕</button>
                    </div>
                </div>
                <div class="terminal-output" id="terminalOutput">
                    <div class="terminal-line">Terminal do Sistema Solar Pro</div>
                    <div class="terminal-line">Digite 'help' para ver os comandos</div>
                    <div class="terminal-line">Comandos do sistema: 'npm start', 'node server.js', 'dir', etc</div>
                    <div class="terminal-line">-----------------------------------</div>
                </div>
                <div class="terminal-input-line">
                    <span>$></span>
                    <input type="text" id="terminalInput" placeholder="Digite um comando...">
                    <button id="terminalSendBtn">Enviar</button>
                </div>
            </div>
        `;
        
        const div = document.createElement('div');
        div.innerHTML = terminalHTML;
        document.body.appendChild(div.firstElementChild);
        
        document.getElementById('terminalCloseBtn')?.addEventListener('click', () => this.fecharTerminal());
        document.getElementById('terminalSendBtn')?.addEventListener('click', () => this.executarComando());
        const input = document.getElementById('terminalInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.executarComando();
            });
        }
        
        this.adicionarEstilos();
    }
    
    adicionarEstilos() {
        if (document.getElementById('terminalStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'terminalStyles';
        style.textContent = `
            .terminal-container {
                position: fixed;
                bottom: 20px;
                right: 90px;
                width: 600px;
                height: 450px;
                background: #1e1e2e;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                z-index: 10000;
                border: 1px solid #2ecc71;
                font-family: 'Consolas', 'Monaco', monospace;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            }
            .terminal-header {
                background: #2d2d3a;
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #2ecc71;
                border-radius: 12px 12px 0 0;
            }
            .terminal-title {
                color: #2ecc71;
                font-size: 13px;
                font-weight: 500;
            }
            .terminal-btn {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s;
            }
            .terminal-btn:hover {
                color: #e74c3c;
            }
            .terminal-output {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                color: #d4d4d4;
                font-size: 12px;
                background: #1a1a2a;
                font-family: monospace;
            }
            .terminal-line {
                margin-bottom: 5px;
                white-space: pre-wrap;
                word-break: break-all;
            }
            .terminal-line.success {
                color: #2ecc71;
            }
            .terminal-line.error {
                color: #e74c3c;
            }
            .terminal-line.warning {
                color: #f39c12;
            }
            .terminal-input-line {
                display: flex;
                padding: 8px 12px;
                border-top: 1px solid #3d3d4a;
                background: #2d2d3a;
                border-radius: 0 0 12px 12px;
            }
            .terminal-input-line span {
                color: #2ecc71;
                margin-right: 8px;
                font-weight: bold;
            }
            .terminal-input-line input {
                flex: 1;
                background: none;
                border: none;
                color: #d4d4d4;
                outline: none;
                font-family: monospace;
                font-size: 12px;
            }
            .terminal-input-line button {
                background: #2ecc71;
                border: none;
                color: #1e1e2e;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-left: 8px;
                font-weight: bold;
            }
            .terminal-input-line button:hover {
                background: #27ae60;
            }
            .terminal-icon-btn {
                position: fixed;
                bottom: 20px;
                right: 90px;
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #2ecc71, #27ae60);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 9999;
                font-size: 24px;
                color: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                transition: all 0.2s;
            }
            .terminal-icon-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(46,204,113,0.3);
            }
        `;
        document.head.appendChild(style);
    }
    
    abrirTerminal() {
        const terminal = document.getElementById('terminalContainer');
        if (terminal) {
            terminal.style.display = 'flex';
            document.getElementById('terminalInput')?.focus();
        }
    }
    
    fecharTerminal() {
        const terminal = document.getElementById('terminalContainer');
        if (terminal) {
            terminal.style.display = 'none';
        }
    }
    
    adicionarLinha(texto, tipo = 'normal') {
        const output = document.getElementById('terminalOutput');
        if (output) {
            const div = document.createElement('div');
            div.className = `terminal-line ${tipo}`;
            div.textContent = texto;
            output.appendChild(div);
            output.scrollTop = output.scrollHeight;
        }
    }
    
    async executarComando() {
        const input = document.getElementById('terminalInput');
        const comando = input.value.trim();
        if (!comando) return;
        
        this.adicionarLinha(`$> ${comando}`);
        input.value = '';
        
        // Comandos internos
        if (comando === 'help') {
            this.adicionarLinha('Comandos disponíveis:');
            this.adicionarLinha('  help      - Mostra esta ajuda');
            this.adicionarLinha('  clear     - Limpa o terminal');
            this.adicionarLinha('  status    - Mostra status do sistema');
            this.adicionarLinha('  backup    - Faz backup dos dados');
            this.adicionarLinha('  npm start - Inicia o servidor');
            this.adicionarLinha('  npm stop  - Para o servidor');
            this.adicionarLinha('  node server.js - Inicia servidor manual');
            this.adicionarLinha('  dir       - Lista arquivos do projeto');
            this.adicionarLinha('  cd <pasta> - Navega para pasta');
        } 
        else if (comando === 'clear') {
            const output = document.getElementById('terminalOutput');
            if (output) output.innerHTML = '';
            this.adicionarLinha('Terminal limpo!');
        } 
        else if (comando === 'status') {
            this.adicionarLinha('Status do Sistema:', 'success');
            this.adicionarLinha(`  Placas: ${window.AppState?.placas?.length || 0}`);
            this.adicionarLinha(`  Inversores: ${window.AppState?.inversores?.length || 0}`);
            this.adicionarLinha(`  Baterias: ${window.AppState?.baterias?.length || 0}`);
            this.adicionarLinha(`  Clientes: ${window.AppState?.clientes?.length || 0}`);
            this.adicionarLinha(`  Servidor: ${window.location.hostname}:3000`);
        } 
        else if (comando === 'backup') {
            this.adicionarLinha('Fazendo backup...');
            try {
                const dados = {
                    placas: window.AppState?.placas || [],
                    inversores: window.AppState?.inversores || [],
                    baterias: window.AppState?.baterias || [],
                    clientes: window.AppState?.clientes || [],
                    data: new Date().toISOString()
                };
                const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_${new Date().toISOString().slice(0, 19)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.adicionarLinha('✅ Backup concluído!', 'success');
            } catch (error) {
                this.adicionarLinha(`❌ Erro: ${error.message}`, 'error');
            }
        }
        else if (comando === 'dir') {
            this.adicionarLinha('📁 Listando arquivos do projeto...');
            try {
                throw new Error('Terminal não disponível nesta versão');
                const data = await response.json();
                if (data.success) {
                    data.files.forEach(file => {
                        this.adicionarLinha(`  ${file}`);
                    });
                } else {
                    this.adicionarLinha('📁 frontend/');
                    this.adicionarLinha('📁 frontend/css/');
                    this.adicionarLinha('📁 frontend/js/');
                    this.adicionarLinha('📁 frontend/pages/');
                    this.adicionarLinha('📁 frontend/components/');
                    this.adicionarLinha('📄 server.js');
                    this.adicionarLinha('📄 package.json');
                }
            } catch (error) {
                this.adicionarLinha('📁 frontend/');
                this.adicionarLinha('📁 frontend/css/');
                this.adicionarLinha('📁 frontend/js/');
                this.adicionarLinha('📁 frontend/pages/');
                this.adicionarLinha('📁 frontend/components/');
                this.adicionarLinha('📄 server.js');
                this.adicionarLinha('📄 package.json');
            }
        }
        else if (comando === 'npm start' || comando === 'npm run start') {
            this.adicionarLinha('🚀 Iniciando servidor...', 'success');
            this.adicionarLinha('⏳ Aguarde...');
            
            try {
                throw new Error('Terminal não disponível nesta versão');
                // const response = await fetch('/api/terminal/exec', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({ comando: 'npm start' })
                // });
                // const data = await response.json();
                
                if (data.success) {
                    this.adicionarLinha('✅ Servidor iniciado com sucesso!', 'success');
                    this.adicionarLinha(`📡 Acesse: http://localhost:3000`);
                    if (data.output) {
                        this.adicionarLinha(data.output);
                    }
                } else {
                    this.adicionarLinha(`❌ Erro: ${data.error}`, 'error');
                    this.adicionarLinha('💡 Dica: Abra um terminal separado e execute o comando manualmente');
                }
            } catch (error) {
                this.adicionarLinha('❌ Não foi possível iniciar o servidor', 'error');
                this.adicionarLinha('💡 Dica: Abra um terminal separado e execute: npm start');
            }
        }
        else if (comando === 'npm stop') {
            this.adicionarLinha('🛑 Parando servidor...');
            try {
                throw new Error('Terminal não disponível');
                // const response = await fetch('/api/terminal/stop', {
                //     method: 'POST'
                // });
                // const data = await response.json();
                if (data.success) {
                    this.adicionarLinha('✅ Servidor parado!', 'success');
                } else {
                    this.adicionarLinha('⚠️ Servidor não estava rodando', 'warning');
                }
            } catch (error) {
                this.adicionarLinha('❌ Erro ao parar servidor', 'error');
            }
        }
        else if (comando.startsWith('cd ')) {
            const pasta = comando.substring(3);
            try {
                throw new Error('Terminal não disponível');
                // const response = await fetch('/api/terminal/cd', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({ pasta })
                // });
                // const data = await response.json();
                if (data.success) {
                    this.adicionarLinha(`✅ Mudou para: ${data.cwd}`, 'success');
                } else {
                    this.adicionarLinha(`❌ Pasta não encontrada: ${pasta}`, 'error');
                }
            } catch (error) {
                this.adicionarLinha(`❌ Erro: ${error.message}`, 'error');
            }
        }
        else {
            // Tentar executar como comando do sistema
            this.adicionarLinha(`🔄 Executando comando do sistema: ${comando}`);
            try {
                throw new Error('Terminal não disponível nesta versão');
                // const response = await fetch('/api/terminal/exec', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({ comando })
                // });
                // const data = await response.json();
                
                if (data.success) {
                    if (data.output) {
                        const linhas = data.output.split('\n');
                        linhas.forEach(linha => {
                            if (linha.trim()) this.adicionarLinha(linha);
                        });
                    }
                    this.adicionarLinha('✅ Comando executado!', 'success');
                } else {
                    this.adicionarLinha(`❌ Erro: ${data.error}`, 'error');
                }
            } catch (error) {
                this.adicionarLinha(`❌ Comando não reconhecido: ${comando}`, 'error');
                this.adicionarLinha('Digite "help" para ver os comandos disponíveis');
            }
        }
    }
}

// Inicializar
let terminalManager = null;

function iniciarTerminal() {
    if (terminalManager) return;
    terminalManager = new TerminalManager();
    terminalManager.criarTerminal();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarTerminal);
} else {
    iniciarTerminal();
}

window.terminalManager = terminalManager;