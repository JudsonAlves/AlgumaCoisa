// ============================================================
// SOLAR PRO 2.0 — pages/orcamento.js
// Builder de orçamento com MÚLTIPLOS itens: várias placas, vários
// inversores, baterias opcionais e uma lista livre de materiais/
// serviços (estilo planilha de custo). Nada é obrigatório — dá
// pra montar um orçamento só de placas, só de inversores, só de
// materiais, ou qualquer combinação.
//
// VERSÃO 3.0 - ATUALIZADA COM:
// 1. ppMarcaDagua removido (agora na personalização)
// 2. Tutoriais removidos
// 3. ppContaMedia automático (puxa valor em kWh)
// 4. Vendedor e estrutura padrão da configuração
// 5. Arredondamento mesclado
// 6. Pisos de lucro configuráveis
//
// VERSÃO 3.2 - BOTÃO "PROPOSTA BNB" CONECTADO:
// 7. O botão btnPropostaBNB já existia no HTML mas não tinha listener.
//    Agora ele monta o mesmo `data` usado pela Proposta Completa (itens,
//    cliente, vendedor, estrutura, resultado) e um `config` mesclado
//    (config global da conta + OS.propostaConfig deste orçamento, igual
//    ao que abrirPropostaCompleta já faz internamente pra proposta
//    comercial) e chama window.abrirPropostaCompletaBNB(data, config),
//    definida em pages/proposta-completa-bnb.js. Se esse arquivo não
//    estiver carregado na página, mostra um toast em vez de quebrar
//    silenciosamente.
//
// VERSÃO 3.3 - CLIENTE OBRIGATÓRIO PARA PROPOSTA BNB:
// 8. A Proposta BNB depende dos dados de identificação e do histórico de
//    consumo do cliente (cadastrados em Clientes), então agora o botão
//    "Proposta BNB" exige um cliente selecionado antes de gerar — se não
//    houver, mostra um aviso e abre o seletor de cliente automaticamente.
// 9. O seletor de cliente ganhou uma opção fixa "+ Adicionar novo
//    cliente", que leva direto para o cadastro de Clientes (mesmo padrão
//    já usado no seletor de Estrutura, com o item "Sem estrutura").
// ============================================================

function _uid(){ return Date.now() + '_' + Math.random().toString(36).slice(2,8); }

// GAS/Sheets às vezes devolve booleanos como string ("true"/"TRUE"/"1") —
// esta função normaliza qualquer uma dessas formas para um boolean real.
function _isPadrao(v){ return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1'; }

function propostaConfigPadrao(){
  return {
    estrutura: null,
    vendedor: null,
    marcaDagua: true,
    contaMediaMensal: 0,
    rentabilidadeAA: 6.70,
    aumentoContaAA: 1,
    simultaneidade: 65,
  };
}

let OS = {
  itensPlaca: [],      // { id, placa, qtd }
  itensInversor: [],   // { id, inversor, qtd }
  itensBateria: [],    // { id, bateria, qtd }
  itensOutros: [],
  itensMateriais: [],  // { id, descricao, qtd, unidade, valorUnit }
  cliente: null,
  vendedor: null,
  estrutura: null,
  prefill: null,
  propostaConfig: propostaConfigPadrao(),  // overrides por orçamento pra Proposta Completa (proposta-completa.js)
  participantesExtra: [], // Etapa 1 (V3): [{ cliente, papel }] — opcional, além do Contratante
};

const ORC_EQUIP_TYPES = {
  placa: { label:'Placa', icon:'grid-3x2', listKey:'itensPlaca', catalogKey:'placas',
    titleFn:(p)=>`${p.marca||''} ${p.potencia||0}W ${p.tipo||''}`.trim(), metaFn:(p)=>`${p.modelo||''} ${p.outros ?`· ${p.outros}`:''}`, searchKeys:['marca','modelo','tipo'] },
  inversor: { label:'Inversor', icon:'zap', listKey:'itensInversor', catalogKey:'inversores',
    titleFn:(p)=>`${p.marca||''} ${p.potencia||0}W ${p.fase||''} `.trim(), metaFn:(p)=>`${p.modelo||''} · ${p.tipo||''} · ${p.tensao||0}V · Mín: ${p.potencia_min||0}W · Máx: ${p.potencia_max||0}W ${p.outros ?`· ${p.outros}`:''}`, searchKeys:['marca','modelo','tipo'] },
  bateria: { label:'Bateria', icon:'battery-full', listKey:'itensBateria', catalogKey:'baterias',
    titleFn:(p)=>p.nome||'Bateria', metaFn:(p)=>`${p.tipo||''} · ${p.capacidade||'-'}Ah`, searchKeys:['nome'] },
  outros: { 
    label:'Outro Equipamento', 
    icon:'package', 
    listKey:'itensOutros', 
    catalogKey:'outros',
    titleFn:(p)=>`${p.nome||''}`.trim(), 
    metaFn:(p)=>`${p.modelo||''} ${p.categoria ?`· ${p.categoria}`:''}`, 
    searchKeys:['nome','modelo','categoria'] 
  },
};

let _estruturasCache = [];
let _vendedoresCache = [];
let _configGlobal = null;

// ============================================================
// PERSISTÊNCIA: SALVAR NO HISTÓRICO
// ============================================================
const STORAGE_KEY_SALVAR_HISTORICO = 'sp2_salvar_historico';

function _getSalvarHistoricoPadrao() {
  try {
    const valor = localStorage.getItem(STORAGE_KEY_SALVAR_HISTORICO);
    if (valor === null) return true; // padrão: salvar
    return valor === 'true';
  } catch(e) {
    return true;
  }
}

function _setSalvarHistoricoPadrao(valor) {
  try {
    localStorage.setItem(STORAGE_KEY_SALVAR_HISTORICO, String(valor));
  } catch(e) {
    // ignorar
  }
}
window._getSalvarHistoricoPadrao = _getSalvarHistoricoPadrao;
window._setSalvarHistoricoPadrao = _setSalvarHistoricoPadrao;

// ============================================================
// CARREGAR ESTRUTURAS E VENDEDORES
// ============================================================
async function carregarEstruturasEVendedores() {
  const [estruturas, vendedores] = await Promise.all([
    apiGetCached('/configuracoes/estruturas'),
    apiGetCached('/configuracoes/vendedores')
  ]);
  _estruturasCache = Array.isArray(estruturas) ? estruturas : [];
  _vendedoresCache = Array.isArray(vendedores) ? vendedores : [];

  return { estruturas: _estruturasCache, vendedores: _vendedoresCache };
}

// ============================================================
// CARREGAR CONFIGURAÇÃO GLOBAL
// ============================================================
async function carregarConfigGlobal() {
  const cfg = await carregarPropostaConfigMesclada();
  _configGlobal = cfg;
  return cfg;
}

// ============================================================
// FUNÇÃO: APLICAR VENDEDOR E ESTRUTURA PADRÃO
// ============================================================
function aplicarPadroes(cfg) {
  // Vendedor padrão
  if (!OS.vendedor && cfg?.vendedor_padrao_id) {
    const vPadrao = _vendedoresCache.find(v => v.id == cfg.vendedor_padrao_id);
    if (vPadrao) OS.vendedor = vPadrao;
  }
  
  // Estrutura padrão
  if (OS.estrutura === null && cfg?.estrutura_padrao_id) {
    const ePadrao = _estruturasCache.find(e => e.id == cfg.estrutura_padrao_id);
    if (ePadrao) OS.estrutura = ePadrao;
  }
}

// ============================================================
// PÁGINA PRINCIPAL: pageOrcamento
// ============================================================
async function pageOrcamento(){
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando catálogo...</div>`;

  const prefill = OS.prefill || null;
  OS.prefill = null;

  // Carrega catálogos e configurações em paralelo
  const [placas, inversores, baterias, outros, clientes, , configGlobal] = await Promise.all([
    apiGetCached('/equipamentos/placas'),
    apiGetCached('/equipamentos/inversores'),
    apiGetCached('/equipamentos/baterias'),
    apiGetCached('/equipamentos/outros_equipamentos'),
    apiGetCached('/clientes'),
    carregarEstruturasEVendedores(),
    carregarConfigGlobal()
  ]);
  
  Store.set('placas', placas); Store.set('inversores', inversores);
  Store.set('baterias', baterias); Store.set('clientes', clientes);
  Store.set('outros', outros);
  const catalogos = { placas, inversores, baterias, outros };

  const lista = Store.get('listaResumo') || [];

  // <--- Aplicar vendedor e estrutura padrão
  aplicarPadroes(configGlobal);

  // <--- Status do arredondamento
  const arred = configGlobal?.arredondamento || {};
  const arredStatus = arred.ativado !== false
    ? `✅ Arredondamento ativo (limite: ${arred.limite_kwh || 1500} kWh → placas: ${arred.placa_limiar_ate_1500 || 9}/${arred.placa_limiar_acima_1500 || 15})`
    : `⛔ Arredondamento desativado`;

  // <--- Status dos pisos de lucro
  const pisos = configGlobal?.pisos_lucro || [];
  const pisoStatus = pisos.length > 0
    ? `💰 ${pisos.length} piso(s) de lucro configurado(s)`
    : `💰 Piso padrão: MICRO=R$ 3.500, OUTROS=R$ 4.750`;

  view.innerHTML = `
    <div class="view-head">
      <div><h1>Novo Orçamento</h1><p>Adicione placas, inversores, baterias e materiais</p></div>
      <div class="view-head-actions">
        <button class="btn btn-ghost" id="btnLimpar">${icon('rotate-ccw')} Limpar tudo</button>
      </div>
    </div>
    
    <div class="card">
      <div class="card-head">
        <div class="ico">${icon('receipt')}</div>
        <div class="grow"><h3>Materiais e Serviços</h3><div class="sub">Itens avulsos: cabos, conectores, mão de obra, etc.</div></div>
        <button class="btn btn-secondary btn-sm" id="btnAddMaterial">${icon('plus')} Adicionar</button>
      </div>
      <div id="tabelaMateriais"></div>
    </div>
    <div class="view-head">
      <div><h1>Orçamento Solar</h1><p>Adicione placas, inversores, baterias...</p></div>
    </div>

    <div class="grid grid-2" style="align-items:start;grid-template-columns:1.15fr .85fr">
      <div>
        ${prefill ? `
        <div class="card" style="border-color:var(--amber);background:linear-gradient(180deg,var(--amber-soft),var(--surface))">
          <div class="card-head">
            <div class="ico">${icon('sparkles')}</div>
            <div class="grow"><h3>Kit carregado do Gerador</h3><div class="sub">Itens e quantidades já preenchidos abaixo</div></div>
          </div>
          <div class="detail-line">
            <span>Valor sugerido do kit</span>
            <span>${formatarMoeda(prefill.valorSugerido)} ${prefill.fonte === 'historico' ? '📊 baseado no histórico' : '🧮 estimativa por fórmula'}</span>
          </div>
          <p class="text-faint mt-8" style="font-size:11.5px">Recomendação de venda. O valor final abaixo depende do <strong>valor de fornecimento</strong> e das regras comerciais que você definir.</p>
        </div>` : ''}

        <!-- CARD: PLACAS -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('grid-3x2')}</div><div class="grow"><h3>Placas</h3><div class="sub">Opcional — pode misturar marcas/modelos diferentes</div></div>
            <button class="btn btn-secondary btn-sm" id="btnAddPlaca">${icon('plus')} Adicionar</button></div>
          <div id="listaPlacas"></div>
        </div>

        <!-- CARD: INVERSORES -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('zap')}</div><div class="grow"><h3>Inversores</h3><div class="sub">Opcional — pode misturar tipos diferentes</div></div>
            <button class="btn btn-secondary btn-sm" id="btnAddInversor">${icon('plus')} Adicionar</button></div>
          <div id="listaInversores"></div>
        </div>

        <!-- CARD: BATERIAS -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('battery-full')}</div><div class="grow"><h3>Baterias</h3><div class="sub">Opcional</div></div>
            <button class="btn btn-secondary btn-sm" id="btnAddBateria">${icon('plus')} Adicionar</button></div>
          <div id="listaBaterias"></div>
        </div>

        <!-- CARD: OUTROS EQUIPAMENTOS -->
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('package')}</div>
            <div class="grow">
              <h3>Outros Equipamentos</h3>
              <div class="sub">Bombas solares, controladores, etc.</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btnAddOutro">${icon('plus')} Adicionar</button>
          </div>
          <div id="listaOutros"></div>
        </div>

        <!-- CARD: PARÂMETROS COMERCIAIS -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('sliders-horizontal')}</div><div><h3>Parâmetros comerciais</h3><div class="sub">Aplicados sobre o valor de fornecimento dos equipamentos</div></div></div>
          <div class="form-grid2">
            <div class="field"><label>Geração desejada (kWh/mês)</label><input class="input" id="pGeracao" type="number" placeholder="Sugere qtd. da 1ª placa" value="${prefill?.geracao || ''}"></div>
            <div class="field"><label>Valor de fornecimento (R$)</label><input class="input" id="pValorForn" type="text" placeholder="Ex: 12.000,00"></div>
            <div class="field"><label>Imposto (%) <span style="font-weight:400;font-size:11px;display:inline-flex;align-items:center;gap:4px;margin-left:6px;cursor:pointer"><input type="checkbox" id="pImpostoAuto" checked style="width:auto;margin:0;cursor:pointer">Automático</span></label><input class="input" id="pImposto" type="text" value="${Math.round((configGlobal?.imposto_percentual_base || 43))}" disabled></div>
            <div class="field"><label>Margem (%)</label><input class="input" id="pMargem" type="text" value="${configGlobal?.margem_padrao || 4}"></div>
            <div class="field"><label>Reajuste (R$)</label><input class="input" id="pReajuste" type="text" value="${configGlobal?.reajuste_padrao || 150}"></div>
            <div class="field"><label>Desconto (R$)</label><input class="input" id="pDesconto" type="text" value="0"></div>
            <div class="field"><label>Acréscimo (R$)</label><input class="input" id="pAcrescimo" type="text" value="0"></div>
            <div class="field"><label>Frete (R$)</label><input class="input" id="pFrete" type="text" value="0"></div>
          </div>
          <div style="margin-top:10px;padding:8px 12px;background:var(--surface-2);border-radius:6px;font-size:11px;color:var(--text-faint);display:flex;flex-wrap:wrap;gap:12px;">
            <span>${arredStatus}</span>
            <span>${pisoStatus}</span>
          </div>
        </div>

        <!-- CARD: PERSONALIZAÇÃO DA PROPOSTA (sem ppMarcaDagua) -->
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('palette')}</div>
            <div class="grow"><h3>Personalização da Proposta</h3><div class="sub">Vendedor, estrutura e parâmetros de payback deste orçamento</div></div>
          </div>
          <div class="form-grid2">
            <div class="field">
              <label>Vendedor responsável</label>
              <div class="picker" id="pickVendedor" style="min-height:50px;padding:8px 12px;">
                <div class="ph">${icon('user-plus')} Selecionar vendedor</div>
              </div>
            </div>
            <div class="field">
              <label>Estrutura de fixação</label>
              <div class="picker" id="pickEstrutura" style="min-height:50px;padding:8px 12px;">
                <div class="ph">${icon('building-2')} Selecionar estrutura</div>
              </div>
            </div>
            <div class="field"><label>Conta de energia média mensal (R$)</label><input class="input" id="ppContaMedia" type="text" placeholder="Ex: 450,00"></div>
            <div class="field"><label>Rentabilidade estimada (% a.a.)</label><input class="input" id="ppRentabilidade" type="text" value="6,70"></div>
            <div class="field"><label>Aumento da conta de energia (% a.a.)</label><input class="input" id="ppAumentoConta" type="text" value="1"></div>
            <div class="field"><label>Economia Mensal (%)</label><input class="input" id="ppSimultaneidade" type="text" value="65"></div>
          </div>
          <p class="text-faint mt-8" style="font-size:11px">Logo, capa, marca d'água, rodapé e assinatura ficam em <b>Personalização da Proposta</b>, no menu.</p>
        </div>


      </div>

      <!-- LADO DIREITO: RESULTADO -->
<div style="position:sticky;top:86px">
  <div class="card">
    <div class="card-head">
      <div class="ico">${icon('calculator')}</div>
      <div><h3>Resultado</h3><div class="sub">Atualizado em tempo real</div></div>
    </div>
    <div id="resultBox"></div>
    
    
    
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
      <button class="btn btn-secondary" id="btnPropostaBNB">${icon('list-plus')} Proposta BNB</button>
      <button class="btn btn-primary" id="btnProposta">${icon('file-text')} Resumo Proposta</button>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:10px" id="btnPropostaCompleta">${icon('layout-template')} Gerar Proposta</button>
  <!-- CHECKBOX: Salvar no histórico -->
    <div style="display:flex;align-items:center;gap:10px;margin:12px 0 8px;padding:8px 12px;background:var(--surface-2);border-radius:6px;border:1px solid var(--border);">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;">
        <input type="checkbox" id="chkSalvarHistorico" ${_getSalvarHistoricoPadrao() ? 'checked' : ''}>
        <span>💾 Salvar no histórico</span>
      </label>
    </div>
  </div>

        <!-- CARD: CLIENTE -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('contact')}</div><div class="grow"><h3>Cliente</h3><div class="sub">Vincule um cliente à proposta — obrigatório para a Proposta BNB</div></div></div>
          <div class="picker" id="pickCliente"><div class="ph">${icon('user-plus')} Selecionar cliente</div></div>
          <button class="btn btn-secondary" style="width:100%;margin-top:10px" id="btnGerarDocumentosCliente">${icon('file-output')} Gerar Documentos</button>

          <details class="dim-collapse" style="margin-top:12px">
            <summary style="cursor:pointer;font-size:12.5px;font-weight:700;color:var(--text-faint,#8A7A6A)">+ Adicionar outro participante ao projeto</summary>
            <div style="margin-top:10px">
              <div class="picker" id="pickParticipanteExtra"><div class="ph">${icon('user-plus')} Buscar cliente</div></div>
              <select class="input" id="selPapelParticipanteExtra" style="width:100%;margin-top:8px">
                <option value="titular_conta">Titular da Conta / Procuração</option>
                <option value="outro">Outro</option>
              </select>
              <button type="button" class="btn btn-secondary" style="width:100%;margin-top:8px" id="btnAddParticipanteExtra">${icon('plus')} Adicionar participante</button>
              <div id="listaParticipantesExtras" style="margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>
            </div>
          </details>

          <details class="dim-collapse" style="margin-top:10px">
            <summary style="cursor:pointer;font-size:12.5px;font-weight:700;color:var(--text-faint,#8A7A6A)">+ Endereço do projeto (se diferente do cadastro do cliente)</summary>
            <div class="form-grid1" style="margin-top:10px">
              <div class="field"><label>Apelido</label><input class="input" id="epApelido" placeholder="Ex: Casa de praia"></div>
              <div class="field span-2"><label>Logradouro</label><input class="input" id="epLogradouro"></div>
              <div class="field"><label>Número</label><input class="input" id="epNumero"></div>
              <div class="field"><label>Complemento</label><input class="input" id="epComplemento"></div>
              <div class="field"><label>Bairro</label><input class="input" id="epBairro"></div>
              <div class="field"><label>Cidade</label><input class="input" id="epCidade"></div>
              <div class="field"><label>UF</label><input class="input" id="epEstado" maxlength="2"></div>
              <div class="field"><label>CEP</label><input class="input" id="epCep"></div>
            </div>
          </details>
        </div>
      </div>
    </div>
  `;

  const btnGerarDocsCliente = document.getElementById('btnGerarDocumentosCliente');
  if (btnGerarDocsCliente) {
    btnGerarDocsCliente.addEventListener('click', () => {
      if (typeof window.abrirModalGerarDocumento !== 'function') {
        toast('Geração de documentos indisponível: pages/documentos.js não foi carregado nesta página.', 'error');
        return;
      }
      window.abrirModalGerarDocumento();
    });
  }

  Object.keys(ORC_EQUIP_TYPES).forEach(tipo => renderEquipSection(tipo, catalogos));
  renderMateriaisTable();
  bindClientePicker(clientes);
  bindParticipantesExtra(clientes);
  bindVendedorPicker(_vendedoresCache);
  bindEstruturaPicker(_estruturasCache);

  // <--- EVENTOS COM RECÁLCULO AUTOMÁTICO
  ['pGeracao','pValorForn','pImposto','pMargem','pReajuste','pDesconto','pAcrescimo','pFrete'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcular);
  });

  // <--- RECALCULAR IMPOSTO AO MUDAR VALOR DE FORNECIMENTO, MARGEM OU REAJUSTE
  ['pValorForn', 'pMargem', 'pReajuste'].forEach(id => {
    document.getElementById(id).addEventListener('change', function() {
      if (document.getElementById('pValorForn').value) {
        aplicarAjusteImpostoAutomatico();
      }
    });
  });

  // <--- CHECKBOX: liga/desliga o cálculo automático do imposto
  const chkImpostoAuto = document.getElementById('pImpostoAuto');
  if (chkImpostoAuto) {
    chkImpostoAuto.addEventListener('change', function() {
      const elImposto = document.getElementById('pImposto');
      if (this.checked) {
        elImposto.disabled = true;
        aplicarAjusteImpostoAutomatico();
      } else {
        elImposto.disabled = false;
        elImposto.focus();
      }
      calcular();
    });
  }

  // <--- ppContaMedia automático (puxa valor em kWh)
  const elGeracao = document.getElementById('pGeracao');
  const elContaMedia = document.getElementById('ppContaMedia');
  
  function sincronizarContaComGeracao() {
    // Se o usuário não editou manualmente a conta, sincroniza
    if (!elContaMedia.dataset.manual) {
      const g = parseFloat(elGeracao?.value) || 0;
      elContaMedia.value = g ? formatarMoeda(g).replace('R$', '').trim() : '';
    }
  }
  
  // Quando o usuário editar a conta manualmente, marca como manual
  elContaMedia.addEventListener('input', () => {
    elContaMedia.dataset.manual = 'true';
  });
  
  // Quando a geração mudar, sincroniza (se não for manual)
  elGeracao.addEventListener('input', sincronizarContaComGeracao);
  
  // Sincroniza inicialmente
  sincronizarContaComGeracao();

  // <--- BOTÕES
  document.getElementById('btnAddPlaca').addEventListener('click', () => abrirPickerEquip('placa', catalogos));
  document.getElementById('btnAddInversor').addEventListener('click', () => abrirPickerEquip('inversor', catalogos));
  document.getElementById('btnAddBateria').addEventListener('click', () => abrirPickerEquip('bateria', catalogos));
  document.getElementById('btnAddOutro').addEventListener('click', () => abrirPickerEquip('outros', catalogos));
  document.getElementById('btnAddMaterial').addEventListener('click', abrirCatalogoMateriais);

  bindPropostaConfig();

  document.getElementById('btnLimpar').addEventListener('click', () => {
    OS = { itensPlaca:[], itensInversor:[], itensBateria:[], itensOutros:[], itensMateriais:[], cliente:null, vendedor:null, estrutura:null, prefill:null, propostaConfig: propostaConfigPadrao(), participantesExtra: [] };
    pageOrcamento();
  });
  
 
// Botão: Gerar Proposta (resumida)
// Botão: Gerar Proposta (resumida)
document.getElementById('btnProposta').addEventListener('click', () => {
  const chk = document.getElementById('chkSalvarHistorico');
  const salvarHistorico = chk ? chk.checked : _getSalvarHistoricoPadrao();
  _setSalvarHistoricoPadrao(salvarHistorico);
  
  // 🔴 CORREÇÃO: ATUALIZA OS VALORES NO OS.resultado ANTES DE CHAMAR
  const elFrete = document.getElementById('pFrete');
  const elAcrescimo = document.getElementById('pAcrescimo');
  const elDesconto = document.getElementById('pDesconto');
  
  if (!OS.resultado) OS.resultado = {};
  if (elFrete) OS.resultado.frete = parseMoney(elFrete.value) || 0;
  if (elAcrescimo) OS.resultado.acrescimo = parseMoney(elAcrescimo.value) || 0;
  if (elDesconto) OS.resultado.desconto = parseMoney(elDesconto.value) || 0;
  
  // 🔴 CRIA O OBJETO DATA COM OS VALORES ATUALIZADOS
  const data = { 
    itensPlaca: OS.itensPlaca, 
    itensInversor: OS.itensInversor, 
    itensBateria: OS.itensBateria, 
    itensOutros: OS.itensOutros, 
    itensMateriais: OS.itensMateriais, 
    cliente: OS.cliente, 
    vendedor: OS.vendedor, 
    estrutura: OS.estrutura, 
    resultado: { ...OS.resultado }, // 🔴 COPIA PARA GARANTIR QUE OS VALORES ESTEJAM
    salvarHistorico: salvarHistorico
  };
  
  if (typeof window.abrirProposta === 'function') {
    window.abrirProposta(data, salvarHistorico);
  }
});

// Botão: Proposta Completa
document.getElementById('btnPropostaCompleta').addEventListener('click', () => {
  const chk = document.getElementById('chkSalvarHistorico');
  const salvarHistorico = chk ? chk.checked : _getSalvarHistoricoPadrao();
  _setSalvarHistoricoPadrao(salvarHistorico);
  
  // 🔴 CORREÇÃO: ATUALIZA OS VALORES NO OS.resultado ANTES DE CHAMAR
  const elFrete = document.getElementById('pFrete');
  const elAcrescimo = document.getElementById('pAcrescimo');
  const elDesconto = document.getElementById('pDesconto');
  
  if (!OS.resultado) OS.resultado = {};
  if (elFrete) OS.resultado.frete = parseMoney(elFrete.value) || 0;
  if (elAcrescimo) OS.resultado.acrescimo = parseMoney(elAcrescimo.value) || 0;
  if (elDesconto) OS.resultado.desconto = parseMoney(elDesconto.value) || 0;
  
  // 🔴 CRIA O OBJETO DATA COM OS VALORES ATUALIZADOS
  const data = { 
    itensPlaca: OS.itensPlaca, 
    itensInversor: OS.itensInversor, 
    itensBateria: OS.itensBateria, 
    itensOutros: OS.itensOutros, 
    itensMateriais: OS.itensMateriais, 
    cliente: OS.cliente, 
    vendedor: OS.vendedor, 
    estrutura: OS.estrutura, 
    resultado: { ...OS.resultado }, // 🔴 COPIA PARA GARANTIR QUE OS VALORES ESTEJAM
    salvarHistorico: salvarHistorico
  };
  abrirPropostaCompleta(data);
});

// Botão: Proposta BNB
// v3.3: agora exige um cliente selecionado antes de gerar — a Proposta BNB
// depende da identificação e do histórico de consumo do cliente. Se não
// houver cliente, avisa e abre o seletor automaticamente em vez de deixar
// a proposta sair com dados placeholder (XXXX).
document.getElementById('btnPropostaBNB').addEventListener('click', () => {
  openModal({
    id: 'modalEscolhaBNB',
    title: 'Proposta BNB',
    sub: 'Escolha o que deseja gerar',
    width: 420,
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-secondary" style="width:100%;justify-content:flex-start" id="btnEscolherOrcamentoBNB">
          ${icon('list-plus')} Orçamento BNB
        </button>
        <button class="btn btn-secondary" style="width:100%;justify-content:flex-start" id="btnEscolherDimensionamentoBNB">
          ${icon('ruler')} Dimensionamento BNB
        </button>
      </div>
    `
  });
  refreshIcons();
  const btnOrc = document.getElementById('btnEscolherOrcamentoBNB');
  if (btnOrc) btnOrc.addEventListener('click', () => {
    closeModal('modalEscolhaBNB');
    executarPropostaBNB();
  });
  const btnDim = document.getElementById('btnEscolherDimensionamentoBNB');
  if (btnDim) btnDim.addEventListener('click', () => {
    closeModal('modalEscolhaBNB');
    if (typeof window.abrirModalDimensionamentoBNB === 'function') {
      window.abrirModalDimensionamentoBNB();
    } else {
      toast('Dimensionamento BNB indisponível: pages/dimensionamento-bnb.js não foi carregado nesta página.', 'error');
    }
  });
});

// 🔴 Lógica original do botão "Proposta BNB", agora isolada em função própria
// para poder ser chamada a partir do menu de escolha (Orçamento BNB vs.
// Dimensionamento BNB).
async function executarPropostaBNB() {
  if (typeof window.abrirPropostaCompletaBNB !== 'function') {
    toast('Proposta BNB indisponível: pages/proposta-completa-bnb.js não foi carregado nesta página.', 'error');
    return;
  }

  if (!OS.cliente) {
    toast('Selecione um cliente antes de gerar a Proposta BNB — o laudo técnico exige os dados do cliente e o histórico de consumo dele.', 'warning', 5000);
    const pickCliente = document.getElementById('pickCliente');
    if (pickCliente) {
      pickCliente.scrollIntoView({ behavior:'smooth', block:'center' });
      pickCliente.click();
    }
    return;
  }

  const chk = document.getElementById('chkSalvarHistorico');
  const salvarHistorico = chk ? chk.checked : _getSalvarHistoricoPadrao();
  _setSalvarHistoricoPadrao(salvarHistorico);

  // 🔴 CORREÇÃO: ATUALIZA OS VALORES NO OS.resultado ANTES DE CHAMAR
  const elFrete = document.getElementById('pFrete');
  const elAcrescimo = document.getElementById('pAcrescimo');
  const elDesconto = document.getElementById('pDesconto');
  
  if (!OS.resultado) OS.resultado = {};
  if (elFrete) OS.resultado.frete = parseMoney(elFrete.value) || 0;
  if (elAcrescimo) OS.resultado.acrescimo = parseMoney(elAcrescimo.value) || 0;
  if (elDesconto) OS.resultado.desconto = parseMoney(elDesconto.value) || 0;

  // 🔴 CORREÇÃO: sem geracaoDesejada aqui, "consumo médio" (usado na
  // Justificativa do Kit e no Dimensionamento BNB) caía no fallback =
  // própria geração do kit quando o cliente não tinha Histórico de Consumo
  // cadastrado — mascarando qualquer diferença real entre geração e consumo.
  const geracaoDesejada = parseFloat(document.getElementById('pGeracao')?.value) || 0;

  // 🔴 CRIA O OBJETO DATA COM OS VALORES ATUALIZADOS
  const data = {
    itensPlaca: OS.itensPlaca,
    itensInversor: OS.itensInversor,
    itensBateria: OS.itensBateria,
    itensOutros: OS.itensOutros,
    itensMateriais: OS.itensMateriais,
    cliente: OS.cliente,
    vendedor: OS.vendedor,
    estrutura: OS.estrutura,
    resultado: { ...OS.resultado }, // 🔴 COPIA PARA GARANTIR QUE OS VALORES ESTEJAM
    salvarHistorico: salvarHistorico,
    geracaoDesejada
  };

  const cfgGlobal = await carregarPropostaConfigMesclada();
  const config = {
    ...cfgGlobal,
    ...OS.propostaConfig,
    estrutura: OS.estrutura,
    vendedor: OS.vendedor,
    marca_dagua_ativa: OS.propostaConfig.marcaDagua !== false,
  };

  window.abrirPropostaCompletaBNB(data, config);
}

  // 🔴 CORREÇÃO: aplica TODOS os campos vindos do prefill (Gerador de Kits ou
  // importação do Histórico), não só a geração — valorForn/imposto/margem/
  // reajuste/desconto/acrescimo/frete precisam ser restaurados aqui porque é
  // só agora, depois do render, que esses inputs existem no DOM.
  if(prefill){
    if(prefill.geracao) document.getElementById('pGeracao').value = prefill.geracao;
    if(prefill.valorForn) document.getElementById('pValorForn').value = formatarNumero(prefill.valorForn, 2);
    if(prefill.imposto != null){
      document.getElementById('pImposto').value = Math.round(prefill.imposto * 100);
      // <--- Valor de imposto importado (ex: reabertura via Histórico): mantém
      // o valor trazido em vez de deixar o cálculo automático sobrescrevê-lo.
      const chkAuto = document.getElementById('pImpostoAuto');
      if(chkAuto){ chkAuto.checked = false; document.getElementById('pImposto').disabled = false; }
    }
    if(prefill.margem != null) document.getElementById('pMargem').value = prefill.margem;
    if(prefill.reajuste != null) document.getElementById('pReajuste').value = formatarNumero(prefill.reajuste, 2);
    if(prefill.desconto != null) document.getElementById('pDesconto').value = formatarNumero(prefill.desconto, 2);
    if(prefill.acrescimo != null) document.getElementById('pAcrescimo').value = formatarNumero(prefill.acrescimo, 2);
    if(prefill.frete != null) document.getElementById('pFrete').value = formatarNumero(prefill.frete, 2);
  }

  calcular();
  renderLista();
  refreshIcons();
}
window.pageOrcamento = pageOrcamento;

// ============================================================
// FUNÇÃO: AJUSTE AUTOMÁTICO DO IMPOSTO
// ============================================================
function aplicarAjusteImpostoAutomatico() {
  const chkAuto = document.getElementById('pImpostoAuto');
  if (chkAuto && !chkAuto.checked) return; // <--- Imposto manual: não sobrescreve

  const valorForn = parseMoney(document.getElementById('pValorForn')?.value);
  const margem = parsePercent(document.getElementById('pMargem')?.value) || (_configGlobal?.margem_padrao || 4) / 100;
  const reajuste = parseMoney(document.getElementById('pReajuste')?.value) || (_configGlobal?.reajuste_padrao || 150);
  
  // Detectar tipo do inversor (primeiro da lista)
  const primeiroInversor = OS.itensInversor[0]?.inversor;
  const primeiraPlaca = OS.itensPlaca[0]?.placa;
  
  if (valorForn > 0) {
    const impostoAjustado = Calc.ajustarPercentualImposto(
      valorForn, 
      margem, 
      reajuste, 
      primeiraPlaca,
      primeiroInversor, 
      _configGlobal
    );
    const impostoPercentual = Math.round(impostoAjustado * 100);
    document.getElementById('pImposto').value = impostoPercentual;
  }
}

// ============================================================
// PICKER: VENDEDOR
// ============================================================
function bindVendedorPicker(vendedores) {
  const el = document.getElementById('pickVendedor');
  if (!el) return;
  
  // Se já tem vendedor padrão, aplica
  if (OS.vendedor) {
    el.classList.add('filled');
    el.innerHTML = `<div class="icon-sm">${icon('user')}</div><div><div class="name">${OS.vendedor.nome}</div><div class="meta">${OS.vendedor.telefone || OS.vendedor.email || ''}</div></div>`;
    refreshIcons();
  }
  
  function paint(){
    if(OS.vendedor){
      el.classList.add('filled');
      el.innerHTML = `<div class="icon-sm">${icon('user')}</div><div><div class="name">${OS.vendedor.nome}</div><div class="meta">${OS.vendedor.telefone || OS.vendedor.email || ''}</div></div>`;
    }else{
      el.classList.remove('filled');
      el.innerHTML = `<div class="ph">${icon('user-plus')} Selecione o vendedor</div>`;
    }
    refreshIcons();
  }
  
  el.addEventListener('click', () => {
    if(vendedores.length === 0){ toast('Nenhum vendedor cadastrado. Vá em Configurações > Vendedores', 'warning'); return; }
    openPickerModal({
      title:'Selecionar vendedor', 
      items: vendedores, 
      searchKeys: ['nome','telefone','email'],
      emptyMsg:'Nenhum vendedor cadastrado',
      renderOpt:(it,idx)=>`<div class="pick-opt" data-pick-idx="${idx}"><div class="icon-sm">${icon('user')}</div><div><div class="t">${it.nome}${_isPadrao(it.padrao) ? ' ⭐' : ''}</div><div class="s">${it.telefone || it.email || ''}</div></div></div>`,
      onPick:(it)=>{ OS.vendedor = it; paint(); }
    });
  });
  paint();
}

// ============================================================
// PICKER: ESTRUTURA
// ============================================================
const SEM_ESTRUTURA = { id: '__sem_estrutura__', nome: 'Sem estrutura', tipo: '', _semEstrutura: true };

function bindEstruturaPicker(estruturas) {
  const el = document.getElementById('pickEstrutura');
  if (!el) return;
  
  // Se já tem estrutura padrão, aplica
  if (OS.estrutura && !OS.estrutura._semEstrutura) {
    el.classList.add('filled');
    el.innerHTML = `<div><div class="name">${OS.estrutura.nome}</div><div class="meta">${OS.estrutura.tipo || ''}</div></div>`;
    refreshIcons();
  }
  
  function paint(){
    if(OS.estrutura && OS.estrutura._semEstrutura){
      el.classList.add('filled');
      el.innerHTML = `<div class="icon-sm">${icon('ban')}</div><div><div class="name">Sem estrutura</div><div class="meta">Selecionado explicitamente</div></div>`;
    }else if(OS.estrutura){
      el.classList.add('filled');
      el.innerHTML = `
        <div><div class="name">${OS.estrutura.nome}</div><div class="meta">${OS.estrutura.tipo || ''}</div></div>
      `;
    }else{
      el.classList.remove('filled');
      el.innerHTML = `<div class="ph">${icon('building-2')} Selecione a estrutura de fixação</div>`;
    }
    refreshIcons();
  }
  
  el.addEventListener('click', () => {
    const itens = [SEM_ESTRUTURA, ...estruturas];
    openPickerModal({
      title:'Selecionar estrutura de fixação', 
      items: itens, 
      searchKeys: ['nome','tipo'],
      emptyMsg:'Nenhuma estrutura cadastrada',
      renderOpt:(it,idx)=> it._semEstrutura
        ? `<div class="pick-opt" data-pick-idx="${idx}"><div class="icon-sm">${icon('ban')}</div><div><div class="t">Sem estrutura</div><div class="s">Não incluir estrutura na proposta</div></div></div>`
        : `<div class="pick-opt" data-pick-idx="${idx}">
          ${it.imagem_url ? `<img src="${it.imagem_url}" style="width:38px;height:38px;border-radius:6px;object-fit:cover;flex-shrink:0;">` : `<div class="icon-sm">${icon('building-2')}</div>`}
          <div><div class="t">${it.nome}${_isPadrao(it.padrao) ? ' ⭐' : ''}</div><div class="s">${it.tipo || ''}</div></div>
        </div>`,
      onPick:(it)=>{ OS.estrutura = it; paint(); }
    });
  });
  paint();
}

// ============================================================
// PERSONALIZAÇÃO DA PROPOSTA (sem ppMarcaDagua)
// ============================================================
function bindPropostaConfig(){
  const cfg = OS.propostaConfig || (OS.propostaConfig = propostaConfigPadrao());

  const elContaMedia = document.getElementById('ppContaMedia');
  const elRentabilidade = document.getElementById('ppRentabilidade');
  const elAumentoConta = document.getElementById('ppAumentoConta');
  const elSimultaneidade = document.getElementById('ppSimultaneidade');

  if(cfg.contaMediaMensal) elContaMedia.value = formatarMoeda(cfg.contaMediaMensal).replace('R$', '').trim();
  elRentabilidade.value = String(cfg.rentabilidadeAA ?? 6.70).replace('.', ',');
  elAumentoConta.value = String(cfg.aumentoContaAA ?? 1).replace('.', ',');
  elSimultaneidade.value = String(cfg.simultaneidade ?? 65).replace('.', ',');

  // Sincroniza OS.vendedor e OS.estrutura com cfg
  cfg.vendedor = OS.vendedor;
  cfg.estrutura = OS.estrutura;
  
  // Conta manual
  if (elContaMedia) {
    elContaMedia.addEventListener('input', () => { 
      cfg._contaManual = true; 
      cfg.contaMediaMensal = parseMoney(elContaMedia.value); 
    });
  }
  
  elRentabilidade.addEventListener('input', () => { cfg.rentabilidadeAA = parseMoney(elRentabilidade.value); });
  elAumentoConta.addEventListener('input', () => { cfg.aumentoContaAA = parseMoney(elAumentoConta.value); });
  elSimultaneidade.addEventListener('input', () => { cfg.simultaneidade = parseMoney(elSimultaneidade.value); });
}

// ============================================================
// CLIENTE PICKER
// v3.3: ganhou uma opção fixa "+ Adicionar novo cliente" no topo da
// lista, que leva direto para o cadastro de Clientes (mesmo padrão do
// item "Sem estrutura" no picker de Estrutura, acima). Quando o cliente é
// cadastrado por lá e volta pro orçamento, window.onClienteCadastradoBNB
// (setado logo abaixo) seleciona o cliente recém-criado automaticamente.
// ============================================================
const NOVO_CLIENTE_OPTION = { id: '__novo_cliente__', nome: '+ Adicionar novo cliente', _novoCliente: true };

function bindClientePicker(clientes){
  const el = document.getElementById('pickCliente');
  if(!el) return;
  function paint(){
    if(OS.cliente){
      el.classList.add('filled');
      el.innerHTML = `<div class="icon-sm">${icon('check')}</div><div><div class="name">${OS.cliente.nome}</div><div class="meta">${OS.cliente.telefone||OS.cliente.email||''}</div></div>`;
    }else{
      el.classList.remove('filled');
      el.innerHTML = `<div class="ph">${icon('user-plus')} Obrigatório para a Proposta BNB — toque para selecionar</div>`;
    }
    refreshIcons();
  }
  el.addEventListener('click', () => {
    const itens = [NOVO_CLIENTE_OPTION, ...clientes];
    openPickerModal({
      title:'Selecionar cliente', 
      items: itens, 
      searchKeys: ['nome','telefone'],
      emptyMsg:'Nenhum cliente cadastrado ainda',
      renderOpt:(it,idx)=> it._novoCliente
        ? `<div class="pick-opt" data-pick-idx="${idx}" style="border-bottom:1px solid var(--border-soft)"><div class="icon-sm">${icon('plus')}</div><div><div class="t">Adicionar novo cliente</div><div class="s">Cadastrar um cliente que ainda não existe</div></div></div>`
        : `<div class="pick-opt" data-pick-idx="${idx}"><div class="icon-sm">${icon('contact')}</div><div><div class="t">${it.nome}</div><div class="s">${it.telefone||it.email||''}</div></div></div>`,
      onPick:(it)=>{
        if(it._novoCliente){
          if(typeof window.pageCadastro === 'function'){
            window.pageCadastro('clientes');
          }else{
            toast('Módulo de cadastro de clientes não encontrado nesta página.', 'error');
          }
          return;
        }
        OS.cliente = it;
        paint();
      }
    });
  });
  paint();

  // Depois de cadastrar um cliente novo em pages/cadastro.js (chamado a
  // partir da opção acima), volta pro orçamento já com o cliente
  // selecionado, sem precisar abrir o seletor de novo.
  window.onClienteCadastradoBNB = (novoCliente) => {
    OS.cliente = novoCliente;
    const clientesAtualizados = Store.get('clientes') || [];
    clientesAtualizados.push(novoCliente);
    Store.set('clientes', clientesAtualizados);
    if(typeof window.pageOrcamento === 'function') window.pageOrcamento();
  };
}

// ============================================================
// ETAPA 1 (V3) — participante extra do projeto (ex.: Titular da
// Conta/Procuração), além do Contratante escolhido em pickCliente.
// Bloco 100% opcional: quem nunca abrir o <details> nem usa isso.
// ============================================================
function bindParticipantesExtra(clientes){
  const pick = document.getElementById('pickParticipanteExtra');
  const selPapel = document.getElementById('selPapelParticipanteExtra');
  const lista = document.getElementById('listaParticipantesExtras');
  if(!pick || !lista) return;

  function renderLista(){
    if(!OS.participantesExtra.length){
      lista.innerHTML = `<div class="text-faint" style="font-size:11.5px">Nenhum participante extra adicionado.</div>`;
    } else {
      lista.innerHTML = OS.participantesExtra.map((p, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--surface-3);border-radius:8px">
          <span style="font-size:12.5px">${p.cliente.nome} — <b>${p.papel === 'titular_conta' ? 'Titular da Conta' : 'Outro'}</b></span>
          <button type="button" class="btn btn-icon btn-ghost btn-sm" data-rm-participante="${i}">${icon('trash-2')}</button>
        </div>`).join('');
      lista.querySelectorAll('[data-rm-participante]').forEach(btn => btn.addEventListener('click', () => {
        OS.participantesExtra.splice(parseInt(btn.dataset.rmParticipante), 1);
        renderLista();
      }));
      refreshIcons();
    }
  }
  renderLista();

  pick.addEventListener('click', () => {
    // Exclui o Contratante já selecionado e quem já está na lista extra,
    // pra não deixar adicionar o mesmo cliente duas vezes.
    const jaUsados = new Set([OS.cliente?.id, ...OS.participantesExtra.map(p => p.cliente.id)].filter(Boolean));
    const itens = clientes.filter(c => !jaUsados.has(c.id));
    openPickerModal({
      title: 'Adicionar participante ao projeto',
      items: itens,
      searchKeys: ['nome','telefone'],
      emptyMsg: 'Nenhum outro cliente disponível',
      renderOpt: (it, idx) => `<div class="pick-opt" data-pick-idx="${idx}"><div class="icon-sm">${icon('contact')}</div><div><div class="t">${it.nome}</div><div class="s">${it.telefone||it.email||''}</div></div></div>`,
      onPick: (it) => {
        const papel = selPapel?.value || 'outro';
        OS.participantesExtra.push({ cliente: it, papel });
        renderLista();
      }
    });
  });
}

// ============================================================
// SEÇÕES DE EQUIPAMENTO (com arredondamento)
// ============================================================
function abrirPickerEquip(tipo, catalogos){
  const cfg = ORC_EQUIP_TYPES[tipo];
  // <--- Só mostra equipamentos ativos/em estoque (placas e inversores marcados como inativos ficam de fora)
  const items = filtrarAtivos(catalogos[cfg.catalogKey] || []);
  openPickerModal({
    title:`Adicionar ${cfg.label.toLowerCase()}`, 
    items, 
    searchKeys: cfg.searchKeys,
    emptyMsg:`Nenhum(a) ${cfg.label.toLowerCase()} cadastrado(a) ainda`,
    renderOpt:(it,idx)=>`
      <div class="pick-opt" data-pick-idx="${idx}">
        ${it.imagem_url ? `<img src="${it.imagem_url}">` : `<div class="icon-sm">${icon('package')}</div>`}
        <div><div class="t">${cfg.titleFn(it)}</div><div class="s">${cfg.metaFn(it)}</div></div>
      </div>`,
    onPick:(it) => {
      let qtd = 1;
      if(tipo === 'placa'){
        const geracaoDesejada = parseFloat(document.getElementById('pGeracao')?.value) || 0;
        if(OS.itensPlaca.length === 0 && geracaoDesejada > 0){
          // <--- Usa arredondamento mesclado
          const percentualGeracao = 1.0;
          const fator = Calc.fatorGeracao(it, percentualGeracao);
          const valorArredon = Calc.valorArredonAutomatico(geracaoDesejada, _configGlobal);
          qtd = Calc.qtdModulos(geracaoDesejada, fator, valorArredon) || 1;
        }
      }else if(tipo === 'inversor'){
        const totalPlacas = OS.itensPlaca.reduce((a,i)=>a+i.qtd,0);
        if(OS.itensInversor.length === 0 && totalPlacas > 0) {
          qtd = Calc.qtdInversores(totalPlacas, it.tipo);
        }
      }
      OS[ORC_EQUIP_TYPES[tipo].listKey].push({ id:_uid(), [tipo]:it, qtd });
      renderEquipSection(tipo, catalogos);
      calcular();
    }
  });
}

function renderEquipSection(tipo, catalogos){
  const cfg = ORC_EQUIP_TYPES[tipo];
  const containerId = tipo === 'placa' ? 'listaPlacas' : tipo === 'inversor' ? 'listaInversores' : tipo === 'outros' ? 'listaOutros' : 'listaBaterias';
  const container = document.getElementById(containerId);
  const itens = OS[cfg.listKey];
  if(!container) return;

  if(itens.length === 0){
    container.innerHTML = `<div class="empty-state" style="padding:22px"><p style="font-size:12.5px">Nenhuma ${cfg.label.toLowerCase()} adicionada</p></div>`;
    refreshIcons();
    return;
  }
  container.innerHTML = `<div class="data-grid">${itens.map(item => {
    const equip = item[tipo];
    const subtotal = tipo === 'placa' ? `${formatarNumero(Calc.potenciaKit(equip, item.qtd),2)} kWp` : '';
    return `
    <div class="item-row">
      ${equip.imagem_url ? `<img class="thumb-sm" src="${equip.imagem_url}">` : `<div class="icon-sm">${icon(cfg.icon)}</div>`}
      <div class="main">
        <div class="title">${cfg.titleFn(equip)}</div>
        <div class="subtitle">${cfg.metaFn(equip)} ${subtotal ? '· ' + subtotal : ''}</div>
      </div>
      <input class="input" type="number" min="1" style="width:70px;text-align:center;padding:8px" value="${item.qtd}" data-qtd-id="${item.id}">
      <button class="btn btn-icon btn-danger" data-rm-id="${item.id}" title="Remover">${icon('trash-2')}</button>
    </div>`;
  }).join('')}</div>`;
  refreshIcons();

  container.querySelectorAll('[data-qtd-id]').forEach(inp => inp.addEventListener('input', () => {
    const item = itens.find(i => i.id === inp.getAttribute('data-qtd-id'));
    if(item){ item.qtd = Math.max(0, parseFloat(inp.value) || 0); calcular(); }
  }));
  container.querySelectorAll('[data-rm-id]').forEach(btn => btn.addEventListener('click', () => {
    OS[cfg.listKey] = itens.filter(i => i.id !== btn.getAttribute('data-rm-id'));
    renderEquipSection(tipo, catalogos);
    calcular();
  }));
}

// ============================================================
// MATERIAIS E SERVIÇOS
// ============================================================
const UNIDADES_MATERIAL = ['UNI','METRO','KG','M²','CX','PC','SC','ROLO','KIT'];

function addMaterialRow(dados={}){
  OS.itensMateriais.push({
    id:_uid(),
    descricao: dados.descricao || '',
    qtd: dados.qtd !== undefined ? dados.qtd : 1,
    unidade: dados.unidade || 'UNI',
    valorUnit: dados.valorUnit !== undefined ? dados.valorUnit : 0,
    mostrarProposta: dados.mostrarProposta !== undefined ? dados.mostrarProposta : true,
  });
  renderMateriaisTable();
  calcular();
}

// ============================================================
// RENDER: TABELA DE MATERIAIS (com seletor de colunas)
// ============================================================
let _colunasVisiveis = {
  descricao: true,
  qtd: true,
  unidade: true,
  valorUnit: true,
  total: true
};

function carregarPreferenciasColunas() {
  try {
    const salvo = localStorage.getItem('sp2_colunas_materiais');
    if (salvo) {
      _colunasVisiveis = JSON.parse(salvo);
    }
  } catch(e) { /* fallback */ }
}

function salvarPreferenciasColunas() {
  try {
    localStorage.setItem('sp2_colunas_materiais', JSON.stringify(_colunasVisiveis));
  } catch(e) { /* ignorar */ }
}

function renderMateriaisTable(){
  const container = document.getElementById('tabelaMateriais');
  if(!container) return;
  
  carregarPreferenciasColunas();
  
  if(OS.itensMateriais.length === 0){
    container.innerHTML = `
      <div class="empty-state" style="padding:22px">${icon('receipt')}
        <p style="font-size:12.5px">Nenhum item de material/serviço adicionado. Clique em "Adicionar" para escolher do catálogo ou criar um item avulso.</p>
        <button class="btn btn-ghost btn-sm mt-8" id="btnConfigColunasVazio">${icon('settings')} Configurar colunas</button>
      </div>`;
    refreshIcons();
    const btn = document.getElementById('btnConfigColunasVazio');
    if(btn) btn.addEventListener('click', abrirConfiguradorColunas);
    return;
  }

  const colunasConfig = [
    { key: 'descricao', label: 'Descrição', width: '' },
    { key: 'qtd', label: 'Qtd.', width: '70px' },
    { key: 'unidade', label: 'Uni.', width: '80px' },
    { key: 'valorUnit', label: 'Vlr. Unit.', width: '110px' },
    { key: 'total', label: 'Total', width: '110px' }
  ];

  const cabecalhoHtml = colunasConfig.map(col => {
    const visivel = _colunasVisiveis[col.key] !== false;
    return `<th style="padding:6px 6px 6px 0;${col.width ? 'width:'+col.width : ''};${!visivel ? 'display:none;' : ''}">
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;color:var(--text-faint);user-select:none;">
        <input type="checkbox" data-col="${col.key}" ${visivel ? 'checked' : ''} 
               style="width:14px;height:14px;cursor:pointer;margin:0;">
        ${col.label}
      </label>
    </th>`;
  }).join('');

  const btnConfigHtml = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">
      <button class="btn btn-ghost btn-sm" id="btnConfigColunas">${icon('settings')} Colunas</button>
    </div>
  `;

  container.innerHTML = `
    ${btnConfigHtml}
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="text-align:left;color:var(--text-faint);font-size:10.5px;text-transform:uppercase">
        ${cabecalhoHtml}
        <th style="width:60px;text-align:center" title="Aparece na proposta gerada">Proposta</th>
        <th style="width:34px"></th>
      </tr></thead>
      <tbody>
        ${OS.itensMateriais.map(m => {
          const descVisivel = _colunasVisiveis.descricao !== false;
          const qtdVisivel = _colunasVisiveis.qtd !== false;
          const unidadeVisivel = _colunasVisiveis.unidade !== false;
          const valorUnitVisivel = _colunasVisiveis.valorUnit !== false;
          const totalVisivel = _colunasVisiveis.total !== false;
          
          return `
          <tr style="border-top:1px solid var(--border-soft)" data-row-id="${m.id}">
            <td style="padding:5px 6px 5px 0;${!descVisivel ? 'display:none;' : ''}">
              <input class="input" style="padding:6px 8px" data-field="descricao" value="${(m.descricao||'').replace(/"/g,'&quot;')}">
            </td>
            <td style="${!qtdVisivel ? 'display:none;' : ''}">
              <input class="input" style="padding:6px 8px;text-align:center" type="number" step="any" data-field="qtd" value="${m.qtd}">
            </td>
            <td style="${!unidadeVisivel ? 'display:none;' : ''}">
              <select class="select" style="padding:6px 8px" data-field="unidade">
                ${UNIDADES_MATERIAL.map(u => `<option value="${u}" ${u===m.unidade?'selected':''}>${u}</option>`).join('')}
              </select>
            </td>
            <td style="${!valorUnitVisivel ? 'display:none;' : ''}">
              <input class="input" style="padding:6px 8px" data-field="valorUnit" value="${formatarNumero(m.valorUnit,2)}">
            </td>
            <td style="font-weight:700;white-space:nowrap;${!totalVisivel ? 'display:none;' : ''}">
              ${formatarMoeda(m.qtd * m.valorUnit)}
            </td>
            <td style="text-align:center">
              <input type="checkbox" data-field="mostrarProposta" title="Mostrar este item na proposta" ${m.mostrarProposta !== false ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
            </td>
            <td><button class="btn btn-icon btn-danger btn-sm" data-rm-material="${m.id}">${icon('x')}</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>
    <div class="flex-between mt-16" style="padding-top:12px;border-top:1px solid var(--border-soft)">
      <span class="text-faint" style="font-size:12px">${OS.itensMateriais.length} item(ns) · desmarque "Proposta" pra ocultar um item do documento sem tirá-lo do total</span>
      <span style="font-weight:800">Subtotal: ${formatarMoeda(totalMateriais())}</span>
    </div>
  `;
  refreshIcons();

  const btnConfig = document.getElementById('btnConfigColunas');
  if(btnConfig) btnConfig.addEventListener('click', abrirConfiguradorColunas);

  container.querySelectorAll('thead input[data-col]').forEach(chk => {
    chk.addEventListener('change', function() {
      const col = this.getAttribute('data-col');
      _colunasVisiveis[col] = this.checked;
      salvarPreferenciasColunas();
      
      const colIndex = ['descricao','qtd','unidade','valorUnit','total'].indexOf(col);
      const rows = container.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[colIndex]) {
          cells[colIndex].style.display = this.checked ? '' : 'none';
        }
      });
      
      const headerCells = container.querySelectorAll('thead th');
      if (headerCells[colIndex]) {
        headerCells[colIndex].style.display = this.checked ? '' : 'none';
      }
      
      calcular();
    });
  });

  container.querySelectorAll('tr[data-row-id]').forEach(row => {
    const id = row.getAttribute('data-row-id');
    const item = OS.itensMateriais.find(m => m.id === id);
    row.querySelectorAll('[data-field]').forEach(inp => {
      const eventName = inp.type === 'checkbox' ? 'change' : (inp.tagName === 'SELECT' ? 'change' : 'input');
      inp.addEventListener(eventName, () => {
        const field = inp.getAttribute('data-field');
        if(field === 'qtd') item.qtd = parseFloat(inp.value) || 0;
        else if(field === 'valorUnit') item.valorUnit = parseMoney(inp.value);
        else if(field === 'mostrarProposta') item.mostrarProposta = inp.checked;
        else item[field] = inp.value;
        if(field === 'qtd' || field === 'valorUnit'){
          const totalVisivel = _colunasVisiveis.total !== false;
          const totalCell = row.children[4];
          if (totalCell && totalVisivel) {
            totalCell.textContent = formatarMoeda(item.qtd * item.valorUnit);
          }
          document.querySelector('#tabelaMateriais .flex-between span:last-child').textContent = `Subtotal: ${formatarMoeda(totalMateriais())}`;
        }
        calcular();
      });
    });
  });
  
  container.querySelectorAll('[data-rm-material]').forEach(btn => btn.addEventListener('click', () => {
    OS.itensMateriais = OS.itensMateriais.filter(m => m.id !== btn.getAttribute('data-rm-material'));
    renderMateriaisTable();
    calcular();
  }));
}

function totalMateriais(){
  return OS.itensMateriais.reduce((acc,m) => acc + (m.qtd * m.valorUnit), 0);
}

// ============================================================
// CONFIGURADOR DE COLUNAS
// ============================================================
function abrirConfiguradorColunas() {
  const colunas = [
    { key: 'descricao', label: 'Descrição', desc: 'Nome do material/serviço' },
    { key: 'qtd', label: 'Quantidade', desc: 'Número de unidades' },
    { key: 'unidade', label: 'Unidade', desc: 'UNI, METRO, KG, etc.' },
    { key: 'valorUnit', label: 'Valor Unitário', desc: 'Preço por unidade' },
    { key: 'total', label: 'Total', desc: 'Qtd × Valor Unitário' }
  ];

  const modalHtml = `
    <div style="padding:8px 0;">
      <p style="margin-bottom:16px;color:var(--text-faint);font-size:13px;">
        Selecione quais colunas serão exibidas na <strong>tabela de materiais</strong> da proposta gerada.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${colunas.map(col => `
          <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);cursor:pointer;transition:border-color .15s;">
            <input type="checkbox" data-col="${col.key}" ${_colunasVisiveis[col.key] !== false ? 'checked' : ''} 
                   style="width:18px;height:18px;cursor:pointer;flex-shrink:0;">
            <div>
              <div style="font-weight:600;font-size:13px;">${col.label}</div>
              <div style="font-size:11px;color:var(--text-faint);">${col.desc}</div>
            </div>
          </label>
        `).join('')}
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" id="btnMarcarTodas">Marcar todas</button>
        <button class="btn btn-ghost btn-sm" id="btnDesmarcarTodas">Desmarcar todas</button>
        <button class="btn btn-ghost btn-sm" id="btnRestaurarPadrao">Restaurar padrão</button>
      </div>
    </div>
  `;

  openModal({
    id: 'configColunasModal',
    title: 'Configurar colunas da tabela de materiais',
    width: 580,
    bodyHtml: modalHtml,
    footHtml: `
      <button class="btn btn-secondary" id="btnFecharConfig">Fechar</button>
      <button class="btn btn-primary" id="btnSalvarConfig">${icon('check')} Salvar</button>
    `
  });
  refreshIcons();

  document.getElementById('btnMarcarTodas').addEventListener('click', () => {
    document.querySelectorAll('#configColunasModal input[data-col]').forEach(chk => chk.checked = true);
  });

  document.getElementById('btnDesmarcarTodas').addEventListener('click', () => {
    document.querySelectorAll('#configColunasModal input[data-col]').forEach(chk => chk.checked = false);
  });

  document.getElementById('btnRestaurarPadrao').addEventListener('click', () => {
    document.querySelectorAll('#configColunasModal input[data-col]').forEach(chk => chk.checked = true);
  });

  document.getElementById('btnSalvarConfig').addEventListener('click', () => {
    document.querySelectorAll('#configColunasModal input[data-col]').forEach(chk => {
      _colunasVisiveis[chk.getAttribute('data-col')] = chk.checked;
    });
    salvarPreferenciasColunas();
    closeModal('configColunasModal');
    renderMateriaisTable();
    toast('Preferências salvas!', 'success');
  });

  document.getElementById('btnFecharConfig').addEventListener('click', () => {
    closeModal('configColunasModal');
  });
}
window.abrirConfiguradorColunas = abrirConfiguradorColunas;

// ============================================================
// CATÁLOGO DE MATERIAIS
// ============================================================
async function abrirCatalogoMateriais(){
  const catalogo = await apiGetCached('/configuracoes/materiais_avulsos');
  const itens = Array.isArray(catalogo) ? catalogo : [];

  const bodyId = 'catMatList_' + Math.random().toString(36).slice(2,8);
  const searchId = 'catMatSearch_' + Math.random().toString(36).slice(2,8);

  function renderLista(filtro=''){
    const f = filtro.trim().toLowerCase();
    const filtrados = !f ? itens : itens.filter(it => (it.nome||'').toLowerCase().includes(f) || (it.categoria||'').toLowerCase().includes(f));
    if(filtrados.length === 0){
      return `<div class="empty-state" style="padding:24px">${icon('search-x')}<p style="font-size:12.5px">Nenhum item cadastrado ainda. Cadastre em <b>Materiais/Serviços</b> no menu, ou use os atalhos abaixo.</p></div>`;
    }
    return `<div class="data-grid">${filtrados.map((it,i) => `
      <div class="item-row" data-cat-idx="${itens.indexOf(it)}" style="cursor:pointer">
        <div class="icon-sm">${icon('receipt')}</div>
        <div class="main">
          <div class="title">${it.nome}</div>
          <div class="subtitle">${formatarMoeda(it.preco_unitario||0)} / ${it.unidade||'UNI'} ${it.categoria ? '· '+it.categoria : ''}</div>
        </div>
        <button class="btn btn-icon btn-secondary" title="Adicionar">${icon('plus')}</button>
      </div>
    `).join('')}</div>`;
  }

  const backdrop = openModal({
    id:'catalogoMateriaisModal', 
    title:'Adicionar Material/Serviço', 
    width:640,
    sub:'Escolha do catálogo, cole uma lista, ou adicione um item avulso',
    bodyHtml:`
      <div class="modal-search"><input class="input" id="${searchId}" placeholder="🔎 Buscar no catálogo..." autocomplete="off"></div>
      <div id="${bodyId}">${renderLista()}</div>
    `,
    footHtml:`
      <button class="btn btn-ghost" id="btnItemAvulsoModal">${icon('edit-3')} Item avulso (sem cadastro)</button>
    `
  });
  refreshIcons();

  const listEl = document.getElementById(bodyId);
  const searchEl = document.getElementById(searchId);

  function bindClicks(){
    listEl.querySelectorAll('[data-cat-idx]').forEach(row => row.addEventListener('click', () => {
      const it = itens[parseInt(row.getAttribute('data-cat-idx'))];
      addMaterialRow({ descricao: it.nome, qtd: 1, unidade: it.unidade || 'UNI', valorUnit: +it.preco_unitario || 0 });
      closeModal('catalogoMateriaisModal');
      toast('Item adicionado! Ajuste a quantidade se precisar.', 'success');
    }));
  }
  bindClicks();
  searchEl.addEventListener('input', () => { listEl.innerHTML = renderLista(searchEl.value); refreshIcons(); bindClicks(); });
  searchEl.focus();

  document.getElementById('btnItemAvulsoModal').addEventListener('click', () => {
    closeModal('catalogoMateriaisModal');
    addMaterialRow();
    toast('Item avulso adicionado — edite a descrição e o valor na tabela.', 'info');
  });
}
window.abrirCatalogoMateriais = abrirCatalogoMateriais;

// ============================================================
// CÁLCULO AGREDADO
// ============================================================
function calcularAgregados(){
  const percentualGeracao = 1.0;
  
  const potenciaKit = OS.itensPlaca.reduce((acc,i) => acc + Calc.potenciaKit(i.placa, i.qtd), 0);
  
  let geracaoReal = 0;
  OS.itensPlaca.forEach(item => {
    const fator = Calc.fatorGeracao(item.placa, percentualGeracao);
    const gerItem = Calc.geracaoPorPlacas(item.qtd, fator);
    geracaoReal += gerItem;
  });
  
  const qtdPlacasTotal = OS.itensPlaca.reduce((acc,i) => acc + i.qtd, 0);
  const qtdInversoresTotal = OS.itensInversor.reduce((acc,i) => acc + i.qtd, 0);
  const qtdBateriasTotal = OS.itensBateria.reduce((acc,i) => acc + i.qtd, 0);
  const qtdOutrosTotal = OS.itensOutros.reduce((acc,i) => acc + i.qtd, 0);
  return { potenciaKit, geracaoReal, qtdPlacasTotal, qtdInversoresTotal, qtdBateriasTotal, qtdOutrosTotal, totalMateriais: totalMateriais() };
}

// ============================================================
// CÁLCULO PRINCIPAL
// ============================================================
function calcular(){
  const box = document.getElementById('resultBox');
  if(!box) return;
  const ag = calcularAgregados();

  const valorForn = parseMoney(document.getElementById('pValorForn')?.value);
  const margem = parsePercent(document.getElementById('pMargem')?.value) || (_configGlobal?.margem_padrao || 4) / 100;
  const reajuste = parseMoney(document.getElementById('pReajuste')?.value) || (_configGlobal?.reajuste_padrao || 150);
  
  const primeiroInversor = OS.itensInversor[0]?.inversor;
  const primeiraPlaca = OS.itensPlaca[0]?.placa;
  
  let imposto;
  const impostoEhAutomatico = document.getElementById('pImpostoAuto')?.checked !== false;
  if (valorForn > 0 && impostoEhAutomatico) {
    imposto = Calc.ajustarPercentualImposto(
      valorForn, 
      margem, 
      reajuste, 
      primeiraPlaca,
      primeiroInversor, 
      _configGlobal
    );
    const impostoPercentual = Math.round(imposto * 100);
    document.getElementById('pImposto').value = impostoPercentual;
  } else {
    imposto = parsePercent(document.getElementById('pImposto')?.value) || (_configGlobal?.imposto_percentual_base || 43) / 100;
  }

  const desconto = parseMoney(document.getElementById('pDesconto')?.value);
  const acrescimo = parseMoney(document.getElementById('pAcrescimo')?.value);
  const frete = parseMoney(document.getElementById('pFrete')?.value);

  const valorRecomendado = valorForn > 0 ? valorForn * (1 + imposto) : 0;
  const valorOrcamentoEquipamentosBruto = valorForn > 0 ? 
    valorRecomendado * (1 + margem) + reajuste + acrescimo - desconto + frete : 
    0;
  const valorOrcamentoEquipamentos = Math.round(valorOrcamentoEquipamentosBruto / 500) * 500;
  const totalGeral = valorOrcamentoEquipamentos + ag.totalMateriais;

  // 🔴 DECLARA A VARIÁVEL ANTES DE USAR
  let geracaoExibida = ag.geracaoReal;
  if (OS.itensPlaca.length > 0 && _configGlobal?.arredondamento?.ativado !== false) {
    const gerReq = parseFloat(document.getElementById('pGeracao')?.value) || 0;
    const valorArredon = Calc.valorArredonAutomatico(gerReq, _configGlobal);
    const primeiraPlacaCalc = OS.itensPlaca[0]?.placa;
    if (primeiraPlacaCalc) {
      const fator = Calc.fatorGeracao(primeiraPlacaCalc, 1.0);
      const qtdTotal = OS.itensPlaca.reduce((acc, i) => acc + i.qtd, 0);
      geracaoExibida = Calc.geracaoFinal(qtdTotal, fator, valorArredon, _configGlobal);
    }
  }

  OS.resultado = { 
    ...ag, 
    valorForn,
    imposto,
    impostoManual: !impostoEhAutomatico,
    margem,
    reajuste,
    desconto,
    acrescimo,
    frete,
    valorRecomendado,
    valorOrcamentoEquipamentosBruto,
    valorOrcamentoEquipamentos,
    totalGeral,
    geracaoExibida: Math.round(geracaoExibida || 0)  // 🔴 ADICIONADO CORRETAMENTE
  };

  const temAlgumItem = OS.itensPlaca.length || OS.itensInversor.length || OS.itensBateria.length || OS.itensOutros.length || OS.itensMateriais.length;
  if(!temAlgumItem){
    box.innerHTML = `<div class="empty-state">${icon('calculator')}<p>Adicione placas, inversores, baterias, outros equipamentos ou materiais para calcular</p></div>`;
    refreshIcons();
    return;
  }

  // 🔴 USA A VARIÁVEL DECLARADA
  let geracaoExibidaFinal = ag.geracaoReal;
  if (OS.itensPlaca.length > 0 && _configGlobal?.arredondamento?.ativado !== false) {
    const gerReq = parseFloat(document.getElementById('pGeracao')?.value) || 0;
    const valorArredon = Calc.valorArredonAutomatico(gerReq, _configGlobal);
    const primeiraPlacaCalc = OS.itensPlaca[0]?.placa;
    if (primeiraPlacaCalc) {
      const fator = Calc.fatorGeracao(primeiraPlacaCalc, 1.0);
      const qtdTotal = OS.itensPlaca.reduce((acc,i) => acc + i.qtd, 0);
      geracaoExibidaFinal = Calc.geracaoFinal(qtdTotal, fator, valorArredon, _configGlobal);
    }
  }

  box.innerHTML = `
    ${ag.qtdPlacasTotal > 0 ? `<div class="detail-line"><span>Placas (total)</span><span>${ag.qtdPlacasTotal} un. · ${formatarNumero(ag.potenciaKit,2)} kWp</span></div>` : ''}
    ${ag.geracaoReal > 0 ? `<div class="detail-line"><span>Geração estimada</span><span>${formatarNumero(geracaoExibidaFinal,0)} kWh/mês</span></div>` : ''}
    ${ag.qtdInversoresTotal > 0 ? `<div class="detail-line"><span>Inversores (total)</span><span>${ag.qtdInversoresTotal} un.</span></div>` : ''}
    ${ag.qtdBateriasTotal > 0 ? `<div class="detail-line"><span>Baterias (total)</span><span>${ag.qtdBateriasTotal} un.</span></div>` : ''}
    ${ag.qtdOutrosTotal > 0 ? `<div class="detail-line"><span>Outros equipamentos (total)</span><span>${ag.qtdOutrosTotal} un.</span></div>` : ''}
    ${valorRecomendado > 0 ? `<div class="detail-line"><span>Valor recomendado (fornecedor + imposto)</span><span>${formatarMoeda(valorRecomendado)}</span></div>` : ''}
    ${valorOrcamentoEquipamentos > 0 ? `<div class="detail-line"><span>Orçamento equipamentos (com ajustes)</span><span>${formatarMoeda(valorOrcamentoEquipamentos)}</span></div>` : ''}
    ${ag.totalMateriais > 0 ? `<div class="detail-line"><span>Materiais e serviços</span><span>${formatarMoeda(ag.totalMateriais)}</span></div>` : ''}
    <div class="detail-line" style="border:none;padding-top:12px;margin-top:6px">
      <span style="font-weight:800;color:var(--text)">Total geral do orçamento</span>
      <span style="font-size:20px;font-weight:800;color:var(--green)">${formatarMoeda(totalGeral)}</span>
    </div>
  `;
  refreshIcons();
}

// ============================================================
// LISTA DE ORÇAMENTOS
// ============================================================
function addAListaResumo(){
  const ag = OS.resultado;
  if(!ag || ag.totalGeral <= 0){ toast('Adicione itens e um valor de fornecimento (ou materiais) antes de adicionar à lista', 'warning'); return; }
  const lista = Store.get('listaResumo') || [];
  lista.push({
    id: Date.now(),
    itensPlaca: OS.itensPlaca, 
    itensInversor: OS.itensInversor, 
    itensBateria: OS.itensBateria,
    itensMateriais: OS.itensMateriais, 
    cliente: OS.cliente, 
    vendedor: OS.vendedor, 
    estrutura: OS.estrutura,
    resultado: {
      ...OS.resultado,
      geracaoExibida: OS.resultado.geracaoExibida || OS.resultado.geracaoReal || 0  // 🔴 GARANTE
    }
  });
  Store.set('listaResumo', lista); 
  Store.persistLista();
  renderLista();
  toast('Adicionado à lista de orçamentos!', 'success');
}

function renderLista(){
  const el = document.getElementById('listaContainer');
  const countEl = document.getElementById('listaCount');
  const lista = Store.get('listaResumo') || [];
  if(countEl) countEl.textContent = `${lista.length} item(ns)`;
  if(!el) return;
  if(lista.length === 0){
    el.innerHTML = `<div class="empty-state">${icon('inbox')}<p>Nenhum orçamento na lista ainda</p></div>`;
    refreshIcons();
    return;
  }
  el.innerHTML = lista.slice().reverse().map(item => {
    const resumoItens = [
      item.itensPlaca.length ? `${item.itensPlaca.reduce((a,i)=>a+i.qtd,0)} placa(s)` : '',
      item.itensInversor.length ? `${item.itensInversor.reduce((a,i)=>a+i.qtd,0)} inversor(es)` : '',
      item.itensMateriais.length ? `${item.itensMateriais.length} material(is)` : '',
    ].filter(Boolean).join(' · ') || 'Sem itens';
    return `
    <div class="item-row">
      <div class="icon-sm">${icon('sun')}</div>
      <div class="main">
        <div class="title">${resumoItens}</div>
        <div class="subtitle">${item.cliente ? item.cliente.nome : 'Sem cliente'} ${item.vendedor ? '· ' + item.vendedor.nome : ''}</div>
      </div>
      <div class="amount">${formatarMoeda(item.resultado.totalGeral)}</div>
      <div class="row-actions">
        <button class="btn btn-icon btn-ghost" data-print="${item.id}" title="Gerar proposta">${icon('file-text')}</button>
        <button class="btn btn-icon btn-danger" data-rm="${item.id}" title="Remover">${icon('trash-2')}</button>
      </div>
    </div>`;
  }).join('');
  refreshIcons();
  el.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
    const id = +b.getAttribute('data-rm');
    Store.set('listaResumo', (Store.get('listaResumo')||[]).filter(i => i.id !== id));
    Store.persistLista(); 
    renderLista();
  }));
  el.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => {
    const id = +b.getAttribute('data-print');
    const item = (Store.get('listaResumo')||[]).find(i => i.id === id);
    if(item) abrirProposta(item);
  }));
}

// ============================================================
// PROPOSTA SIMPLES — movida para pages/proposta-resumida.js
// (função abrirProposta, chamada abaixo e em renderLista)
// ============================================================

// ============================================================
// SALVAR NO HISTÓRICO
// ============================================================
// ============================================================
// SALVAR NO HISTÓRICO (VERSÃO CORRIGIDA COM DEBUG)
// ============================================================
// ============================================================
// SALVAR NO HISTÓRICO (VERSÃO CORRIGIDA - VERIFICAÇÃO MAIS ABRANGENTE)
// ============================================================
async function salvarOrcamentoHistorico(data){
  // 🔴 GARANTE QUE OS VALORES DE FRETE, ACRÉSCIMO E DESCONTO ESTEJAM NO RESULTADO
  const r = data.resultado || OS.resultado || {};
  // 🔴 FIX: garante que `data.resultado` e `data.vendedor` fiquem preenchidos
  // com o mesmo objeto/valores usados abaixo, pois gerarChaveOrcamento() lê
  // diretamente de `data` (e não mais da variável de closure `r`).
  data.resultado = r;
  data.vendedor = data.vendedor || OS.vendedor || null;
  
  // 🔴 CORREÇÃO: PEGA OS VALORES DIRETAMENTE DOS INPUTS SE NÃO ESTIVEREM NO RESULTADO
  const elFrete = document.getElementById('pFrete');
  const elAcrescimo = document.getElementById('pAcrescimo');
  const elDesconto = document.getElementById('pDesconto');
  
  // SEMPRE PEGA OS VALORES ATUAIS DOS INPUTS
  if (elFrete) {
    r.frete = parseMoney(elFrete.value) || 0;
  }
  if (elAcrescimo) {
    r.acrescimo = parseMoney(elAcrescimo.value) || 0;
  }
  if (elDesconto) {
    r.desconto = parseMoney(elDesconto.value) || 0;
  }
  
  // 🔴 ATUALIZA OS.resultado TAMBÉM
  if (!OS.resultado) OS.resultado = {};
  OS.resultado.frete = r.frete || 0;
  OS.resultado.acrescimo = r.acrescimo || 0;
  OS.resultado.desconto = r.desconto || 0;
  
  // 🔴 SE FOR FALSE, NÃO SALVA
  if (data.salvarHistorico === false) {
    console.log('⏭️ Salvar no histórico desativado pelo usuário');
    return null;
  }
  
  // 🔴 VERIFICA SE JÁ EXISTE UM ORÇAMENTO IGUAL NOS ÚLTIMOS 7 DIAS
  try {
    const orcamentosExistentes = await apiGetCached('/orcamentos');
    const orcamentosRecentes = (Array.isArray(orcamentosExistentes) ? orcamentosExistentes : [])
      .filter(o => {
        const dataOrc = new Date(o.data_orcamento);
        const diasDiff = (Date.now() - dataOrc.getTime()) / (1000 * 60 * 60 * 24);
        return diasDiff <= 0;
      });

    // 🔴 FUNÇÃO CORRIGIDA: GERA CHAVE ÚNICA DO ORÇAMENTO INCLUINDO EXTRAS E VENDEDOR
    // 🔴 BUG ANTERIOR: a função usava a variável de closure `r` (sempre os valores
    // ATUAIS da tela) para frete/acréscimo/desconto/valor, tanto para a chave atual
    // quanto para a chave do item do histórico — então as duas ficavam sempre iguais
    // nesses campos, mesmo quando o orçamento salvo tinha valores diferentes.
    // Agora cada chamada usa os dados do próprio objeto `dados` recebido.
    function gerarChaveOrcamento(dados) {
      const dr = dados.resultado || {};
      const placas = (dados.itensPlaca || [])
        .map(i => `${i.placa?.id || 'id'}_${i.qtd || 0}`)
        .sort()
        .join('|');
      const inversores = (dados.itensInversor || [])
        .map(i => `${i.inversor?.id || 'id'}_${i.qtd || 0}`)
        .sort()
        .join('|');
      const baterias = (dados.itensBateria || [])
        .map(i => `${i.bateria?.id || 'id'}_${i.qtd || 0}`)
        .sort()
        .join('|');
      const outros = (dados.itensOutros || [])
        .map(i => `${i.outros?.id || 'id'}_${i.qtd || 0}`)
        .sort()
        .join('|');
      const materiais = (dados.itensMateriais || [])
        .map(m => `${m.descricao || ''}_${m.qtd || 0}_${m.valorUnit || 0}`)
        .sort()
        .join('|');
      const cliente = dados.cliente?.id || 'sem_cliente';
      const estrutura = dados.estrutura?.id || 'sem_estrutura';
      // 🔴 NOVO: vendedor entra na chave — vendedor diferente = orçamento diferente
      const vendedor = dados.vendedor?.id || 'sem_vendedor';
      const valor = Math.round((dr.totalGeral || 0) / 100) * 100;

      // 🔴 EXTRAS NA CHAVE (agora lidos do próprio orçamento, não da tela atual)
      const frete = dr.frete || 0;
      const acrescimo = dr.acrescimo || 0;
      const desconto = dr.desconto || 0;

      return `${cliente}|${vendedor}|${estrutura}|${placas}|${inversores}|${baterias}|${outros}|${materiais}|${valor}|${frete}|${acrescimo}|${desconto}`;
    }

    const chaveAtual = gerarChaveOrcamento(data);
    
    // 🔴 DEBUG: MOSTRA A CHAVE GERADA
    console.log('🔑 Chave do orçamento atual:', chaveAtual);
    
    // Verifica se já existe igual
    const duplicado = orcamentosRecentes.some(o => {
      // 🔴 RECUPERA OS EXTRAS DO HISTÓRICO
      const freteHistorico = parseFloat(o.frete) || 0;
      const acrescimoHistorico = parseFloat(o.acrescimo) || 0;
      const descontoHistorico = parseFloat(o.desconto) || 0;
      
      const oItens = {
        itensPlaca: JSON.parse(o.itens_placas_json || '[]'),
        itensInversor: JSON.parse(o.itens_inversores_json || '[]'),
        itensBateria: JSON.parse(o.itens_baterias_json || '[]'),
        itensOutros: JSON.parse(o.itens_outros_json || '[]'),
        itensMateriais: JSON.parse(o.itens_materiais_json || '[]'),
        cliente: { id: o.cliente_id },
        // 🔴 NOVO: recupera o vendedor salvo naquele registro do histórico
        vendedor: { id: o.vendedor_id },
        estrutura: { id: o.estrutura_id },
        resultado: {
          frete: freteHistorico,
          acrescimo: acrescimoHistorico,
          desconto: descontoHistorico,
          totalGeral: parseFloat(o.valor_final) || 0
        }
      };
      
      const chaveExistente = gerarChaveOrcamento({
        itensPlaca: oItens.itensPlaca.map(p => ({ placa: { id: p.id }, qtd: p.qtd })),
        itensInversor: oItens.itensInversor.map(i => ({ inversor: { id: i.id }, qtd: i.qtd })),
        itensBateria: oItens.itensBateria.map(i => ({ bateria: { id: i.id }, qtd: i.qtd })),
        itensOutros: oItens.itensOutros.map(i => ({ outros: { id: i.id }, qtd: i.qtd })),
        itensMateriais: oItens.itensMateriais,
        cliente: oItens.cliente,
        vendedor: oItens.vendedor,
        estrutura: oItens.estrutura,
        resultado: oItens.resultado
      });
      
      // 🔴 DEBUG: MOSTRA AS CHAVES PARA COMPARAÇÃO
      console.log('📋 Chave existente:', chaveExistente);
      console.log('🔄 São iguais?', chaveAtual === chaveExistente);
      
      return chaveAtual === chaveExistente;
    });

    if (duplicado) {
      toast('⚠️ Este orçamento já foi salvo nos últimos 7 dias.', 'warning', 4000);
      return null;
    }
  } catch(e) {
    // Se falhar a verificação, continua com o salvamento
    console.warn('Erro ao verificar duplicidade:', e);
  }

  const primeiraPlaca = data.itensPlaca[0]?.placa;
  const primeiroInversor = data.itensInversor[0]?.inversor;
  const primeiraBateria = data.itensBateria[0]?.bateria;

  // 🔴 CRIA OBJETO COMPLETO PARA O NOME DO ARQUIVO
  const dadosCompletos = {
    itensPlaca: data.itensPlaca || OS.itensPlaca,
    itensInversor: data.itensInversor || OS.itensInversor,
    itensBateria: data.itensBateria || OS.itensBateria,
    itensOutros: data.itensOutros || OS.itensOutros,
    itensMateriais: data.itensMateriais || OS.itensMateriais,
    cliente: data.cliente || OS.cliente,
    vendedor: data.vendedor || OS.vendedor,
    estrutura: data.estrutura || OS.estrutura,
    resultado: r,
    geracaoMediaMensal: Math.round(r.geracaoReal || 0)
  };

  // 🔴 GERA O NOME DO ARQUIVO COM OS SÍMBOLOS
  const nomeArquivo = typeof montarNomePropostaArquivo === 'function' 
    ? montarNomePropostaArquivo(dadosCompletos) 
    : '';

  // 🔴 DEBUG: MOSTRA O NOME GERADO
  console.log('📄 NOME DO ARQUIVO GERADO:', nomeArquivo);

  // 🔴 SALVA TODOS OS CAMPOS SEPARADAMENTE
  const itensPlacasJson = JSON.stringify((dadosCompletos.itensPlaca || []).map(i => ({ 
    id: i.placa?.id || '', 
    marca: i.placa?.marca || '',
    modelo: i.placa?.modelo || '',
    tipo: i.placa?.tipo || '',
    potencia: i.placa?.potencia || 0, 
    qtd: i.qtd || 0 
  })));
  
  const itensInversoresJson = JSON.stringify((dadosCompletos.itensInversor || []).map(i => ({ 
    id: i.inversor?.id || '', 
    marca: i.inversor?.marca || '',
    modelo: i.inversor?.modelo || '',
    tipo: i.inversor?.tipo || '', 
    potencia: i.inversor?.potencia || 0,
    qtd: i.qtd || 0 
  })));
  
  const itensBateriasJson = JSON.stringify((dadosCompletos.itensBateria || []).map(i => ({ 
    id: i.bateria?.id || '', 
    nome: i.bateria?.nome || '', 
    tipo: i.bateria?.tipo || '',
    capacidade: i.bateria?.capacidade || 0,
    qtd: i.qtd || 0 
  })));

  const itensOutrosJson = JSON.stringify((dadosCompletos.itensOutros || []).map(i => ({ 
    id: i.outros?.id || '', 
    nome: i.outros?.nome || '',
    modelo: i.outros?.modelo || '',
    categoria: i.outros?.categoria || '',
    garantia: i.outros?.garantia || '',
    qtd: i.qtd || 0 
  })));
  
  const itensMateriaisJson = JSON.stringify((dadosCompletos.itensMateriais || []).map(m => ({ 
    descricao: m.descricao || '', 
    qtd: m.qtd || 0, 
    unidade: m.unidade || 'UNI', 
    valorUnit: m.valorUnit || 0 
  })));

  const payload = {
    cliente_id: dadosCompletos.cliente?.id || '',
    vendedor_id: dadosCompletos.vendedor?.id || '',
    vendedor_nome: dadosCompletos.vendedor?.nome || '',
    codigo_proposta: data.codigoProposta || '',
    estrutura_id: dadosCompletos.estrutura?.id || '',
    estrutura_nome: dadosCompletos.estrutura?.nome || '',
    estrutura_tipo: dadosCompletos.estrutura?.tipo || '',
    estrutura_imagem: dadosCompletos.estrutura?.imagem_url || '',
    placa_id: primeiraPlaca?.id || '',
    inversor_id: primeiroInversor?.id || '',
    bateria_id: primeiraBateria?.id || '',
    quantidade_placas: r.qtdPlacasTotal || 0,
    quantidade_inversores: r.qtdInversoresTotal || 0,
    quantidade_baterias: r.qtdBateriasTotal || 0,
    geracao_estimada: r.geracaoReal || 0,
    potencia_kit: r.potenciaKit || 0,
    valor_fornecimento: r.valorForn || 0,
    margem_percentual: (r.margem || 0) * 100,
    imposto_percentual: r.imposto || 0,
    reajuste: r.reajuste || 0,
    desconto: r.desconto || 0,
    acrescimo: r.acrescimo || 0,
    frete: r.frete || 0,
    valor_equipamentos: r.valorEquipamentos || 0,
    total_materiais: r.totalMateriais || 0,
    valor_final: r.totalGeral || 0,
    itens_placas_json: itensPlacasJson,
    itens_inversores_json: itensInversoresJson,
    itens_baterias_json: itensBateriasJson,
    itens_materiais_json: itensMateriaisJson,
    itens_outros_json: itensOutrosJson,
    nome_arquivo: nomeArquivo
  };

  // Etapa 1 (V3): endereço do projeto — só entra no payload se o bloco
  // opcional "Endereço do projeto" foi de fato aberto/preenchido; senão
  // o campo vai vazio e o orçamento se comporta 100% como antes.
  const enderecoProjeto = {
    apelido: document.getElementById('epApelido')?.value.trim() || '',
    logradouro: document.getElementById('epLogradouro')?.value.trim() || '',
    numero: document.getElementById('epNumero')?.value.trim() || '',
    complemento: document.getElementById('epComplemento')?.value.trim() || '',
    bairro: document.getElementById('epBairro')?.value.trim() || '',
    cidade: document.getElementById('epCidade')?.value.trim() || '',
    estado: document.getElementById('epEstado')?.value.trim() || '',
    cep: document.getElementById('epCep')?.value.trim() || ''
  };
  if (Object.values(enderecoProjeto).some(v => v)) {
    payload.endereco_projeto_json = JSON.stringify(enderecoProjeto);
  }

  const result = await apiPost('/orcamentos', payload);
  if(result){
    await apiPost('/log', {
      orcamento_id: result.id, 
      acao: 'ORÇAMENTO GERADO',
      detalhes: JSON.stringify({ 
        cliente_nome: dadosCompletos.cliente?.nome || '', 
        vendedor: dadosCompletos.vendedor?.nome || '', 
        total: r.totalGeral, 
        potencia_kit: r.potenciaKit,
        nome_arquivo: nomeArquivo,
        frete: r.frete,
        acrescimo: r.acrescimo,
        desconto: r.desconto
      }),
      data_registro: new Date().toISOString()
    });

    // Etapa 1 (V3): grava o vínculo Contratante pra TODO orçamento,
    // em silêncio — não muda nada do comportamento de quem nunca usou
    // o bloco de "participante extra". Se o bloco foi usado, grava
    // também cada participante extra com o papel escolhido.
    if (dadosCompletos.cliente?.id) {
      try {
        await apiPost(`/orcamentos/${result.id}/clientes`, { cliente_id: dadosCompletos.cliente.id, papel: 'contratante' });
        for (const p of (OS.participantesExtra || [])) {
          if (p?.cliente?.id) {
            await apiPost(`/orcamentos/${result.id}/clientes`, { cliente_id: p.cliente.id, papel: p.papel || 'outro' });
          }
        }
      } catch (e) {
        console.warn('Erro ao salvar vínculo(s) cliente-projeto (Etapa 1):', e);
      }
    }

    invalidateCache('/orcamentos');
    invalidateCache('/log');
    toast('Orçamento salvo no histórico!', 'success');
    return result;
  }
  return null;
}

console.log('%c⚡ Solar Pro 2.0 — orcamento.js v3.3 carregado (cliente obrigatório na Proposta BNB + cadastro rápido)', 'color:#ffb020;font-weight:bold');
