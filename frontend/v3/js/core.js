// ============================================================
// SOLAR PRO 2.0 — core.js
// API + formatação + cálculo + upload + estado global.
// IMPORTANTE: contrato de API idêntico ao worker/GAS originais.
// Nenhuma rota, action ou nome de campo foi alterado.
//
// VERSÃO 3.0 - ATUALIZADA COM:
// 1. Suporte a arredondamento mesclado (configuração)
// 2. Suporte a pisos de lucro configuráveis
// 3. Funções auxiliares para financiamento
// 4. Integração com personalizacao-proposta.js
// ============================================================

// ---------------------------------------------------------------
// STORE
// ---------------------------------------------------------------
const Store = {
  state: {
    placas: [], inversores: [], baterias: [], clientes: [], logs: [],
    estruturas: [], vendedores: [],
    placaSel: null, inversorSel: null, bateriaSel: null,
    listaResumo: JSON.parse(sessionStorage.getItem('sp2_lista') || '[]'),
    orcamentoCalc: null,
    qtdPlacaManual: null, qtdInversorManual: null,
  },
  cache: {}, // { endpoint: { data, ts } } — evita rebaixar o mesmo catálogo a cada troca de aba
  set(k, v){ this.state[k] = v; },
  get(k){ return this.state[k]; },
  persistLista(){ sessionStorage.setItem('sp2_lista', JSON.stringify(this.state.listaResumo)); }
};
window.Store = Store;

// ---------------------------------------------------------------
// API — mesmos endpoints do worker.js (/api/equipamentos/*, /api/clientes, /api/orcamentos, /api/log, /api/configuracoes/*)
// ---------------------------------------------------------------
async function apiGet(endpoint){
  try{
    const r = await fetch(`/api${endpoint}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return checkGasError(await r.json());
  }catch(e){ console.error('GET', endpoint, e); toast('Erro ao carregar: ' + e.message, 'error'); return []; }
}
async function apiPost(endpoint, data){
  try{
    const r = await fetch(`/api${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return checkGasError(await r.json());
  }catch(e){ console.error('POST', endpoint, e); toast('Erro ao salvar: ' + e.message, 'error'); return null; }
}
async function apiPut(endpoint, data){
  try{
    const r = await fetch(`/api${endpoint}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return checkGasError(await r.json());
  }catch(e){ console.error('PUT', endpoint, e); toast('Erro ao atualizar: ' + e.message, 'error'); return null; }
}
async function apiDelete(endpoint){
  try{
    const r = await fetch(`/api${endpoint}`, { method:'DELETE', headers:{'Content-Type':'application/json'} });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return checkGasError(await r.json());
  }catch(e){ console.error('DELETE', endpoint, e); toast('Erro ao excluir: ' + e.message, 'error'); return null; }
}
function checkGasError(json){
  if(json && typeof json === 'object' && !Array.isArray(json) && 'error' in json) throw new Error(json.error);
  return json;
}
window.apiGet = apiGet; window.apiPost = apiPost; window.apiPut = apiPut; window.apiDelete = apiDelete;

// ---------------------------------------------------------------
// CACHE — evita rebaixar o mesmo catálogo toda vez que o usuário
// troca de aba. TTL generoso porque toda escrita já invalida a
// entrada correspondente (ver invalidateCache abaixo).
// ---------------------------------------------------------------
const CACHE_TTL_DEFAULT = 10 * 60 * 1000; // 10 min

async function apiGetCached(endpoint, ttl = CACHE_TTL_DEFAULT){
  const cached = Store.cache[endpoint];
  if(cached && (Date.now() - cached.ts) < ttl) return cached.data;
  const data = await apiGet(endpoint);
  if(data !== null && data !== undefined) Store.cache[endpoint] = { data, ts: Date.now() };
  return data;
}
function invalidateCache(endpoint){
  if(endpoint){ delete Store.cache[endpoint]; }
  else { Store.cache = {}; }
}
window.apiGetCached = apiGetCached;
window.invalidateCache = invalidateCache;

// ---------------------------------------------------------------
// FORMATTERS (idêntico ao formatters.js original)
// ---------------------------------------------------------------
function formatarMoeda(v){ return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v || 0); }
function formatarNumero(v, d=2){ return new Intl.NumberFormat('pt-BR', { minimumFractionDigits:d, maximumFractionDigits:d }).format(v || 0); }
function parseMoney(v){ if(!v) return 0; let s = String(v).trim().replace('R$','').replace(/\s/g,'').replace(/\./g,'').replace(',', '.'); return parseFloat(s) || 0; }
function parsePercent(v){ if(!v) return 0; let s = String(v).trim().replace('%','').replace(/\s/g,'').replace(',', '.'); return (parseFloat(s) || 0) / 100; }
function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }catch{ return iso || '-'; } }
window.formatarMoeda = formatarMoeda; window.formatarNumero = formatarNumero;
window.parseMoney = parseMoney; window.parsePercent = parsePercent; window.fmtDate = fmtDate;

// ---------------------------------------------------------------
// FILTRO DE ATIVOS/ESTOQUE — usado por gerador, orçamento e cadastro
// Um item é considerado ativo a menos que 'ativo' esteja EXPLICITAMENTE
// como false — assim registros antigos (sem o campo) continuam visíveis.
// ---------------------------------------------------------------
function itemEstaAtivo(item){ return item?.ativo !== false; }
function filtrarAtivos(items){ return (items || []).filter(itemEstaAtivo); }
window.itemEstaAtivo = itemEstaAtivo;
window.filtrarAtivos = filtrarAtivos;

// ---------------------------------------------------------------
// CALC — FÓRMULAS 100% ALINHADAS COM O VBA + CONFIGURAÇÕES
// ---------------------------------------------------------------
const Calc = {
  /**
   * FATOR DE GERAÇÃO POR PLACA (kWh/mês)
   * Fórmula VBA: PotenciaPlaca * 5 * 30 * 0.85 * PERCENTUAL_GERACAO / 1000
   * @param {object} placa - Objeto da placa com potencia, horas_efetivas, dias_geracao, fator_percentual
   * @param {number} percentualGeracao - Percentual de geração (0.98 = 98%, 1.0 = 100%)
   * @returns {number} Fator de geração em kWh/mês por placa
   */
  fatorGeracao(placa, percentualGeracao = 1.0){
    const he = placa.horas_efetivas || 5;
    const dg = placa.dias_geracao || 30;
    const fator = placa.fator_percentual || 0.85;
    return (placa.potencia * he * dg * fator * percentualGeracao) / 1000;
  },

  /**
   * VALOR DE ARREDONDAMENTO AUTOMÁTICO (9 ou 15) - COM CONFIGURAÇÃO
   * Fórmula VBA: If gerReq < 1500 Then valorArredon = 9 Else valorArredon = 15
   * @param {number} gerReq - Geração requerida em kWh
   * @param {object} config - Configuração de personalização (opcional)
   * @returns {number} Valor de arredondamento (0 = desativado)
   */
  valorArredonAutomatico(gerReq, config = null){
    // Se tem a função global, usa ela (prioridade)
    if (typeof window.calcularArredondamento === 'function') {
      const result = window.calcularArredondamento(gerReq, config);
      return result.valorArredon;
    }
    
    // Fallback: lê da configuração diretamente
    const arred = config?.arredondamento || {};
    if (arred.ativado === false) return 0;
    
    const limite = arred.limite_kwh || 1500;
    const valorAte = arred.placa_limiar_ate_1500 || 9;
    const valorAcima = arred.placa_limiar_acima_1500 || 15;
    return gerReq < limite ? valorAte : valorAcima;
  },

  /**
   * QUANTIDADE DE MÓDULOS (PLACAS)
   * Fórmula VBA: 
   *   calcBase = RoundUp(gerReq / fatorPlaca, 0)
   *   If (gerReq - valorArredon) <= ((calcBase - 1) * fatorPlaca) Then
   *       QtdModulos = calcBase - 1
   *   Else
   *       QtdModulos = calcBase
   *   End If
   * @param {number} gerReq - Geração requerida em kWh
   * @param {number} fator - Fator de geração por placa
   * @param {number} valorArredon - Valor de arredondamento (0 = desativado)
   * @returns {number} Quantidade de placas
   */
  qtdModulos(gerReq, fator, valorArredon){
    if(fator <= 0 || gerReq <= 0) return 0;
    const base = Math.ceil(gerReq / fator);
    let qtd = base;
    
    // Só aplica a subtração se valorArredon > 0
    if(valorArredon > 0 && (gerReq - valorArredon) <= ((base - 1) * fator)) {
      qtd = base - 1;
    }
    return qtd > 0 ? qtd : 0;
  },

  /**
   * GERAÇÃO REAL POR PLACAS
   * Fórmula VBA: gerReal = QtdModulos * FatorPlaca
   * @param {number} qtd - Quantidade de placas
   * @param {number} fator - Fator de geração por placa
   * @returns {number} Geração real em kWh
   */
  geracaoPorPlacas(qtd, fator){ 
    return qtd * fator; 
  },

  /**
   * ARREDONDAR PARA MÚLTIPLO DE 50 (MROUND no Excel)
   * @param {number} v - Valor a ser arredondado
   * @returns {number} Valor arredondado para múltiplo de 50
   */
  arredondar50(v){ 
    return Math.round(v / 50) * 50; 
  },

  /**
   * GERAÇÃO FINAL (com arredondamento condicional) - COM CONFIGURAÇÃO
   * Fórmula VBA:
   *   gerReal = QtdModulos * FatorPlaca
   *   gerArred50 = MROUND(gerReal, 50)
   *   If (gerArred50 - gerReal) > 0 And (gerArred50 - gerReal) <= valorArredon Then
   *       lblGerFinal = gerArred50
   *   Else
   *       lblGerFinal = gerReal
   *   End If
   * @param {number} qtdPlacas - Quantidade de placas
   * @param {number} fatorPlaca - Fator de geração por placa
   * @param {number} valorArredon - Valor de arredondamento
   * @returns {number} Geração final arredondada
   */
  geracaoFinal(qtdPlacas, fatorPlaca, valorArredon, config = null){
  const gerReal = qtdPlacas * fatorPlaca;
  
  const arred = config?.arredondamento || {};
  const multiplo = arred.multiplicador_geracao || 100;  // 🔴 NOVO: lê o múltiplo da configuração
  
  // Arredonda para o múltiplo configurado (ex: 50, 100, etc.)
  const gerArred = Math.round(gerReal / multiplo) * multiplo;
  
  if ((gerArred - gerReal) > 0 && (gerArred - gerReal) <= valorArredon) {
    return gerArred;
  }
  return gerReal;
},

  /**
   * ARREDONDAMENTO DA GERAÇÃO (para números redondos) - COM CONFIGURAÇÃO
   * Se estiver perto de completar a próxima centena, arredonda pra cima
   * @param {number} valor - Valor a ser arredondado
   * @param {object} config - Configuração de personalização (opcional)
   * @returns {number} Valor arredondado
   */
arredondarGeracaoKwh(valor, config = null){
  let v = Math.round(valor || 0);
  if(v <= 0) return 0;
  
  const arred = config?.arredondamento || {};
  const limiarAte1500 = arred.limiar_ate_1500 || 10;
  const limiarAcima1500 = arred.limiar_acima_1500 || 20;
  const multiplo = arred.multiplicador_geracao || 100;  // 🔴 NOVO: lê o múltiplo da configuração
  
  const limiar = v <= 1500 ? limiarAte1500 : limiarAcima1500;
  const proximoMultiplo = Math.ceil(v / multiplo) * multiplo;  // 🔴 USA O MÚLTIPLO CONFIGURADO
  const falta = proximoMultiplo - v;
  if(falta > 0 && falta <= limiar) return proximoMultiplo;
  return v;
},

  /**
   * POTÊNCIA DO KIT (kWp)
   * Fórmula VBA: (PotenciaPlaca * QtdModulos) / 1000
   * @param {object} placa - Objeto da placa
   * @param {number} qtd - Quantidade de placas
   * @returns {number} Potência do kit em kWp
   */
  potenciaKit(placa, qtd){ 
    return (placa.potencia * qtd) / 1000; 
  },

  /**
   * QUANTIDADE DE INVERSORES
   * Fórmula VBA:
   *   If InStr(tipoInversor, "MICRO") > 0 Then
   *       QtInversores = RoundUp(QtdModulos / 4, 0)
   *   Else
   *       QtInversores = IIf(QtdModulos > 0, 1, 0)
   *   End If
   * @param {number} qtdModulos - Quantidade de módulos (placas)
   * @param {string} tipoInv - Tipo do inversor
   * @returns {number} Quantidade de inversores
   */
  qtdInversores(qtdModulos, tipoInv){
    if(!tipoInv || qtdModulos <= 0) return 0;
    if(tipoInv.toUpperCase() === 'MICRO') return Math.ceil(qtdModulos / 4);
    return 1;
  },

  /**
   * VALOR FINAL (com MROUND 500)
   * Fórmula VBA:
   *   ValorComImposto = ValorFornecimento * (1 + PercentualImposto)
   *   BaseFinanceira = (ValorComImposto * (1 + PercentualMargem)) + ReajusteFixo
   *   ValorFinal = MROUND(BaseFinanceira, 500)
   *   ValorOrcamento = ValorFinal - Desconto + Transporte + Acrescimo
   * @param {number} vFornec - Valor de fornecimento
   * @param {number} imp - Percentual de imposto (decimal)
   * @param {number} marg - Percentual de margem (decimal)
   * @param {number} reaj - Reajuste fixo
   * @param {number} desc - Desconto
   * @param {number} acresc - Acréscimo
   * @param {number} frete - Frete
   * @returns {number} Valor final
   */
  valorFinal(vFornec, imp, marg, reaj, desc, acresc, frete){
    const vComImposto = vFornec * (1 + imp);
    const baseFin = (vComImposto * (1 + marg)) + reaj;
    // MROUND 500 (mais próximo)
    let vFinal = Math.round(baseFin / 500) * 500;
    vFinal = vFinal - desc + acresc + frete;
    return vFinal;
  },

  /**
   * VALOR FINAL COMPLETO (para o gerador de kits)
   * Fórmula VBA com valores fixos: imposto=43%, margem=4%, reajuste=150
   * @param {number} valorForn - Valor de fornecimento
   * @returns {number} Valor final completo
   */
  valorFinalCompleto(valorForn){
    const imposto = 0.43, margem = 0.04, reajuste = 150;
    const vComImposto = valorForn * (1 + imposto);
    const baseFin = (vComImposto * (1 + margem)) + reajuste;
    // MROUND 500 (mais próximo) — NÃO usar Math.ceil!
    return Math.round(baseFin / 500) * 500;
  },

  /**
   * AJUSTE AUTOMÁTICO DO PERCENTUAL DE IMPOSTO - COM PISOS CONFIGURÁVEIS
   * Fórmula VBA adaptada para pisos dinâmicos:
   *   piso = calcularPisoLucro(placa, inversor, config)
   *   ValorBase = ValorFornecimento * (1 + Margem) + Reajuste
   *   Se (ValorBase * (1 + impostoBase) - ValorBase) >= piso Então
   *       Imposto = impostoBase
   *   Senão
   *       Para perc = impostoBase + 0.01 até 1.00 passo 0.01:
   *           Se (ValorBase * (1 + perc) - ValorBase) >= piso Então
   *               Imposto = perc
   *               Sair
   *           Fim Se
   *       Próximo
   *   Fim Se
   * @param {number} valorForn - Valor de fornecimento
   * @param {number} percMargem - Percentual de margem (decimal)
   * @param {number} reajuste - Reajuste fixo
   * @param {object} placa - Objeto da placa (para regras de piso)
   * @param {object} inversor - Objeto do inversor (para regras de piso)
   * @param {object} config - Configuração de personalização (opcional)
   * @returns {number} Percentual de imposto ajustado (decimal)
   */
  ajustarPercentualImposto(valorForn, percMargem, reajuste, placa, inversor, config = null){
    // Calcula o piso de lucro usando a função global ou fallback
    let piso = 4750; // padrão VBA
    
    if (typeof window.calcularPisoLucro === 'function') {
      piso = window.calcularPisoLucro(valorForn, percMargem, reajuste, placa, inversor, config);
    } else {
      // Fallback: verifica se é MICRO
      const isMicro = inversor?.tipo?.toUpperCase() === 'MICRO';
      piso = isMicro ? (config?.imposto_piso_micro || 3500) : (config?.imposto_piso_padrao || 4750);
    }
    
    const impostoBase = (config?.imposto_percentual_base || 43) / 100;
    const valorBase = valorForn * (1 + percMargem) + reajuste;
    
    // Testa o imposto base
    if ((valorBase * (1 + impostoBase) - valorBase) >= piso) {
      return impostoBase;
    }
    
    // Sobe de 1% em 1% até atingir o piso
    for (let perc = impostoBase + 0.01; perc <= 1.00; perc += 0.01) {
      if ((valorBase * (1 + perc) - valorBase) >= piso) {
        return perc;
      }
    }
    
    return 1.00; // 100%
  },

  /**
   * VALOR APROXIMADO (para o gerador de kits)
   * Estima o valor de fornecimento baseado na potência dos equipamentos
   * @param {object} placa - Objeto da placa
   * @param {object} inversor - Objeto do inversor
   * @param {number} qtdPlacas - Quantidade de placas
   * @param {number} qtdInversores - Quantidade de inversores
   * @returns {number} Valor aproximado de fornecimento
   */
  valorAproximado(placa, inversor, qtdPlacas, qtdInversores = 1){
    let precoPlaca = placa.potencia >= 600 ? placa.potencia * 1.2 : placa.potencia * 1.5;
    let precoInversor = inversor.potencia * 0.9;
    if(inversor.tipo === 'MICRO') precoInversor = inversor.potencia * 1.1;
    if(inversor.tipo === 'HIBRIDO') precoInversor = inversor.potencia * 1.2;
    if(inversor.tipo === 'OFFGRID') precoInversor = inversor.potencia * 1.15;
    
    // Multiplica pela quantidade de inversores
    return ((precoPlaca * qtdPlacas) + (precoInversor * qtdInversores)) * 1.1;
  },

  /**
   * COMPATIBILIDADE ENTRE PLACA E INVERSOR
   * Regras do VBA: 
   *   - MICRO sempre compatível
   *   - Para 380V, inversor precisa ter potência >= 10000W
   * @param {object} placa - Objeto da placa
   * @param {object} inversor - Objeto do inversor
   * @returns {boolean} True se compatível
   */
  compativel(placa, inversor){
    if(inversor.tipo === 'MICRO') return true;
    const tensao = inversor.tensao || '220V';
    if(String(tensao) === '380' && inversor.potencia < 12000) {
      return inversor.potencia >= 10000;
    }
    return true;
  },

  /**
   * CALCULAR PARCELA (PRICE) - PARA FINANCIAMENTO
   * @param {number} valor - Valor financiado
   * @param {number} taxaPercentualMensal - Taxa mensal em percentual (ex: 2.35)
   * @param {number} n - Número de parcelas
   * @returns {number|null} Valor da parcela
   */
  calcularParcelaPrice(valor, taxaPercentualMensal, n){
    const i = taxaPercentualMensal / 100;
    if(!valor || !i || !n) return null;
    if (i === 0) return valor / n;
    const parcela = valor * (i * Math.pow(1+i, n)) / (Math.pow(1+i, n) - 1);
    return parcela;
  },

  /**
   * FORMATAR MOEDA (REUTILIZÁVEL)
   * @param {number} v - Valor a ser formatado
   * @returns {string} Valor formatado em R$
   */
  fmtMoeda(v){ 
    return v == null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); 
  },

  /**
   * FORMATAR PERCENTUAL
   * @param {number} v - Valor a ser formatado (decimal)
   * @returns {string} Valor formatado com %
   */
  fmtPct(v){ 
    return v == null ? '—' : (v * 100).toFixed(2).replace('.', ',') + '%'; 
  }
};
window.Calc = Calc;

// ---------------------------------------------------------------
// UPLOAD — ImgBB (mesma chave/processo do upload-helper.js original)
// ---------------------------------------------------------------
const IMGBB_API_KEY = 'c9fc3adf34b93c481b948602cc9b73e7';

function redimensionarImagem(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const T = 500;
        const canvas = document.createElement('canvas');
        canvas.width = T; canvas.height = T;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,T,T);
        let w=T,h=T;
        if(img.width > img.height) h = (img.height/img.width)*T; else w = (img.width/img.height)*T;
        ctx.drawImage(img, (T-w)/2, (T-h)/2, w, h);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao converter')), 'image/png', 0.9);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function redimensionarImagem2(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const T = 2000;
        const canvas = document.createElement('canvas');
        canvas.width = T; canvas.height = T;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,T,T);
        let w=T,h=T;
        if(img.width > img.height) h = (img.height/img.width)*T; else w = (img.width/img.height)*T;
        ctx.drawImage(img, (T-w)/2, (T-h)/2, w, h);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao converter')), 'image/png', 0.9);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadParaImgBB(blob){
  const fd = new FormData();
  fd.append('key', IMGBB_API_KEY);
  fd.append('image', blob);
  try{
    const res = await fetch('https://api.imgbb.com/1/upload', { method:'POST', body: fd });
    const result = await res.json();
    if(result.success) return { success:true, url: result.data.url };
    return { success:false, error: result.error?.message || 'Erro ImgBB' };
  }catch(e){ return { success:false, error: e.message }; }
}
window.redimensionarImagem2 = redimensionarImagem2;
window.redimensionarImagem = redimensionarImagem;
window.uploadParaImgBB = uploadParaImgBB;

// ---------------------------------------------------------------
// CONFIGURAÇÕES - helpers para estruturas e vendedores
// ---------------------------------------------------------------
async function carregarEstruturas() {
  const estruturas = await apiGetCached('/configuracoes/estruturas');
  Store.set('estruturas', Array.isArray(estruturas) ? estruturas : []);
  return Store.get('estruturas');
}

async function carregarVendedores() {
  const vendedores = await apiGetCached('/configuracoes/vendedores');
  Store.set('vendedores', Array.isArray(vendedores) ? vendedores : []);
  return Store.get('vendedores');
}

async function carregarConfiguracoes() {
  const [estruturas, vendedores] = await Promise.all([
    carregarEstruturas(),
    carregarVendedores()
  ]);
  return { estruturas, vendedores };
}

// ---------------------------------------------------------------
// CARREGAR CONFIGURAÇÃO GLOBAL (da personalização)
// ---------------------------------------------------------------
async function carregarConfigGlobal() {
  try {
    // Tenta usar a função do personalizacao-proposta.js
    if (typeof window.carregarPropostaConfigMesclada === 'function') {
      return await window.carregarPropostaConfigMesclada();
    }
  } catch(e) {
    console.warn('Erro ao carregar configuração global:', e);
  }
  return null;
}
window.carregarConfigGlobal = carregarConfigGlobal;

window.carregarEstruturas = carregarEstruturas;
window.carregarVendedores = carregarVendedores;
window.carregarConfiguracoes = carregarConfiguracoes;

// ---------------------------------------------------------------
// ATRASO DE ACOMPANHAMENTO — Etapa 4 (V3). Reaproveitado pelo badge
// do card no Kanban (Etapa 3) e pelo widget de pendências do
// dashboard (Etapa 5). Uma etapa está atrasada se tem data prevista
// no passado e ainda não foi concluída.
// ---------------------------------------------------------------
function etapaAtrasada(etapa) {
  if (!etapa.data_prevista || etapa.status === 'concluido') return false;
  return new Date(etapa.data_prevista) < new Date();
}
function acompanhamentoTemAtraso(acomp) {
  return (acomp.etapas || []).some(etapaAtrasada);
}
window.etapaAtrasada = etapaAtrasada;
window.acompanhamentoTemAtraso = acompanhamentoTemAtraso;

console.log('%c⚡ Solar Pro 2.0 — core.js v3.0 carregado', 'color:#ffb020;font-weight:bold');
