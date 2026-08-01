// ============================================================
// SOLAR PRO 2.0 — proposta-config-shared.js
// Núcleo COMPARTILHADO entre:
//   - pages/personalizacao-proposta.js (visual/institucional)
//   - pages/configuracoes-calculo.js   (regras de cálculo)
//
// Ambas as páginas leem e escrevem no MESMO documento singleton
// (/proposta-config). Este arquivo centraliza:
//   1. Defaults do config completo
//   2. Carregamento + merge + migração automática
//   3. Funções de cálculo (arredondamento, piso de lucro, financiamento)
//   4. Utilitários pequenos usados nas duas páginas (esc, fmtMoeda)
//
// IMPORTANTE: este arquivo deve ser carregado ANTES de
// personalizacao-proposta.js e configuracoes-calculo.js.
// ============================================================

// ============================================================
// CONFIGURAÇÕES DEFAULTS (documento completo, visual + cálculo)
// ============================================================

const PROPOSTA_CONFIG_DEFAULTS = {
  // ===== IDENTIDADE VISUAL ===== (gerenciado por personalizacao-proposta.js)
  logo_url: '',
  marca_dagua_ativa: true,
  capa_titulo: 'ORÇAMENTO',
  capa_subtitulo: 'Projeto Solar Fotovoltaico',
  capa_frase_cliente: 'Preparado para',
  capa_foto_fundo: '',
  capa_tema: 'gradiente_marca',
  capa_template_id: 'diagonal_classica',
  capa_ocultar_logo: false,
  capa_ocultar_textos: false,
  capa_cor_primaria: '#1F140B',
  capa_cor_secundaria: '#5A3A22',
  empresa_nome: 'Rocha Engenharia',
  rodape_telefone: '(99) 98491-0412 · @rocha_engenharia_juan',
  rodape_instagram: '@rocha_engenharia_juan',
  rodape_endereco: 'Rua Benedito Leite, 994D — Imperatriz/MA',
  rodape_site: 'www.rochaengenhariasolar.com.br',
  assinatura_nome: 'Juan Francisco Gabriel Rocha de Sousa',
  assinatura_papeis: 'Engenheiro Eletricista\nEngenheiro de Segurança do Trabalho\nEngenheiro Clínico e Hospitalar',
  forma_pagamento_opcoes: 'À vista, financiamento ou cartão de crédito em até 12x.',
  forma_pagamento_avista: '75% antes da execução · 25% após instalação.',
  forma_pagamento_obs: 'Este documento não tem validade de registro; é uma forma objetiva e prática de apresentar o orçamento.',
  validade_dias: 7,
  whatsapp_numero: '',
  whatsapp_mensagem: 'Olá! Vi a proposta e gostaria de falar sobre energia solar.',

  // ===== ARREDONDAMENTO MESCLADO ===== (gerenciado por configuracoes-calculo.js)
  arredondamento: {
    ativado: true,
    limite_kwh: 1500,
    limiar_ate_1500: 10,
    limiar_acima_1500: 20,
    placa_limiar_ate_1500: 9,
    placa_limiar_acima_1500: 15,
    multiplicador_geracao: 100,
  },

  // ===== PADRÕES ===== (gerenciado por configuracoes-calculo.js)
  vendedor_padrao_id: null,
  estrutura_padrao_id: null,

  // ===== PARÂMETROS DE CÁLCULO ===== (gerenciado por configuracoes-calculo.js)
  reajuste_padrao: 150,
  margem_padrao: 4,
  imposto_percentual_base: 43,
  margem_perca: 100,
  comissao_percentual: 0,

  // ===== PISOS DE LUCRO CONFIGURÁVEIS ===== (gerenciado por configuracoes-calculo.js)
  pisos_lucro: [],

  // ===== FINANCIAMENTO ===== (gerenciado por configuracoes-calculo.js)
  financas: {
    bancos: [],
    bancos_selecionados: [],
    excecoes: [],
    entrada_percentual: 0,
    carencia_meses: 3,
    taxa_base: 0,
  }
};
window.PROPOSTA_CONFIG_DEFAULTS = PROPOSTA_CONFIG_DEFAULTS;

// Chaves que pertencem a cada página — usado pelas funções de salvar
// para não sobrescrever a parte que a outra página é dona.
const PROPOSTA_CONFIG_CHAVES_VISUAL = [
  'logo_url', 'marca_dagua_ativa', 'capa_titulo', 'capa_subtitulo', 'capa_frase_cliente',
  'capa_foto_fundo', 'capa_tema', 'capa_template_id', 'capa_ocultar_logo', 'capa_ocultar_textos',
  'capa_cor_primaria', 'capa_cor_secundaria', 'empresa_nome', 'rodape_telefone', 'rodape_instagram',
  'rodape_endereco', 'rodape_site', 'assinatura_nome', 'assinatura_papeis', 'forma_pagamento_opcoes',
  'forma_pagamento_avista', 'forma_pagamento_obs', 'validade_dias', 'whatsapp_numero', 'whatsapp_mensagem'
];
const PROPOSTA_CONFIG_CHAVES_CALCULO = [
  'arredondamento', 'vendedor_padrao_id', 'estrutura_padrao_id', 'reajuste_padrao',
  'margem_padrao', 'imposto_percentual_base', 'margem_perca', 'comissao_percentual',
  'pisos_lucro', 'financas'
];
window.PROPOSTA_CONFIG_CHAVES_VISUAL = PROPOSTA_CONFIG_CHAVES_VISUAL;
window.PROPOSTA_CONFIG_CHAVES_CALCULO = PROPOSTA_CONFIG_CHAVES_CALCULO;

// ============================================================
// FUNÇÃO: CARREGAR E MESCLAR CONFIG (com migração automática)
// ============================================================

async function carregarPropostaConfigMesclada() {
  const salvo = await apiGetCached('/proposta-config');
  const merged = { ...PROPOSTA_CONFIG_DEFAULTS, ...(salvo && typeof salvo === 'object' ? salvo : {}) };

  // Migração automática: converte campos antigos para o novo formato
  if (salvo && salvo.placa_arred_ativado !== undefined) {
    merged.arredondamento = {
      ativado: salvo.placa_arred_ativado,
      limite_kwh: salvo.placa_arred_limite || 1500,
      placa_limiar_ate_1500: salvo.placa_arred_valor_ate || 9,
      placa_limiar_acima_1500: salvo.placa_arred_valor_acima || 15,
      limiar_ate_1500: salvo.geracao_arred_limiar_ate_1500 || 10,
      limiar_acima_1500: salvo.geracao_arred_limiar_acima_1500 || 20,
    };
  }

  return merged;
}
window.carregarPropostaConfigMesclada = carregarPropostaConfigMesclada;

/**
 * Salva um subconjunto de chaves do config, mesclando com a versão mais
 * recente do servidor — para que a página de Personalização não apague
 * o que foi salvo em Configurações de Cálculo, e vice-versa.
 * @param {object} camposAtualizados - apenas os campos que esta página gerencia
 * @returns {Promise<object|null>} resultado do apiPost
 */
async function salvarPropostaConfigParcial(camposAtualizados) {
  invalidateCache('/proposta-config'); // garante que buscamos o mais recente
  const atual = await carregarPropostaConfigMesclada();
  const payload = { ...atual, ...camposAtualizados };
  const result = await apiPost('/proposta-config', payload);
  if (result) invalidateCache('/proposta-config');
  return result;
}
window.salvarPropostaConfigParcial = salvarPropostaConfigParcial;

// ============================================================
// FUNÇÃO: CALCULAR ARREDONDAMENTO (MESCLADO)
// ============================================================

function calcularArredondamento(gerReq, config) {
  const cfg = config?.arredondamento || PROPOSTA_CONFIG_DEFAULTS.arredondamento;

  if (cfg.ativado === false) {
    return { valorArredon: 0, geracaoArredondada: Math.round(gerReq || 0) };
  }

  const limite = cfg.limite_kwh || 1500;
  const isAbaixo = gerReq < limite;

  const valorArredon = isAbaixo
    ? (cfg.placa_limiar_ate_1500 || 9)
    : (cfg.placa_limiar_acima_1500 || 15);

  const limiarGeracao = isAbaixo
    ? (cfg.limiar_ate_1500 || 10)
    : (cfg.limiar_acima_1500 || 20);

  let geracaoArredondada = Math.round(gerReq || 0);
  if (geracaoArredondada > 0) {
    const proximoMultiplo = Math.ceil(geracaoArredondada / 100) * 100;
    const falta = proximoMultiplo - geracaoArredondada;
    if (falta > 0 && falta <= limiarGeracao) {
      geracaoArredondada = proximoMultiplo;
    }
  }

  return { valorArredon, geracaoArredondada };
}
window.calcularArredondamento = calcularArredondamento;

// ============================================================
// FUNÇÃO: CALCULAR PISO DE LUCRO
// ============================================================

// ============================================================
// FUNÇÃO: CALCULAR PISO DE LUCRO
// ============================================================

function calcularPisoLucro(valorForn, percMargem, reajuste, placa, inversor, config) {
  const pisos = config?.pisos_lucro || PROPOSTA_CONFIG_DEFAULTS.pisos_lucro || [];

  // 🔴 Se não tem pisos configurados, usa o padrão
  if (pisos.length === 0) {
    const isMicro = inversor?.tipo?.toUpperCase() === 'MICRO';
    return isMicro ? 3500 : 4500;
  }

  const placaNome = placa?.marca || placa?.modelo || '';
  const inversorTipo = inversor?.tipo || inversor?.marca || '';
  const inversorPotencia = inversor?.potencia || 0;
  const placaPotencia = placa?.potencia || 0;

  // 🔴 CORREÇÃO: Ordena os pisos: primeiro os mais específicos, depois os genéricos
  const pisosOrdenados = [...pisos].sort((a, b) => {
    // Prioriza pisos com regras específicas
    const aEspecifico = (a.placas && a.placas.length > 0 && !a.placas.includes('todos')) || 
                         (a.inversores && a.inversores.length > 0 && !a.inversores.includes('todos'));
    const bEspecifico = (b.placas && b.placas.length > 0 && !b.placas.includes('todos')) || 
                         (b.inversores && b.inversores.length > 0 && !b.inversores.includes('todos'));
    
    if (aEspecifico && !bEspecifico) return -1;
    if (!aEspecifico && bEspecifico) return 1;
    return 0;
  });

  // 🔴 CORREÇÃO: Verifica cada piso na ordem de prioridade
  for (const piso of pisosOrdenados) {
    let matchPlaca = true;
    let matchInversor = true;

    // Verifica regras de placa
    if (piso.placas && piso.placas.length > 0 && !piso.placas.includes('todos')) {
      matchPlaca = piso.placas.some(regra => {
        if (regra.startsWith('>=')) {
          const valor = parseFloat(regra.replace('>=', ''));
          return placaPotencia >= valor;
        }
        if (regra.startsWith('<=')) {
          const valor = parseFloat(regra.replace('<=', ''));
          return placaPotencia <= valor;
        }
        if (regra.startsWith('marca:')) {
          const marca = regra.replace('marca:', '').toUpperCase();
          return (placa?.marca || '').toUpperCase().includes(marca);
        }
        if (regra.startsWith('modelo:')) {
          const modelo = regra.replace('modelo:', '').toUpperCase();
          return (placa?.modelo || '').toUpperCase().includes(modelo);
        }
        return placaNome.toUpperCase().includes(regra.toUpperCase());
      });
    }

    // Verifica regras de inversor
    if (piso.inversores && piso.inversores.length > 0 && !piso.inversores.includes('todos')) {
      matchInversor = piso.inversores.some(regra => {
        if (regra.startsWith('>=')) {
          const valor = parseFloat(regra.replace('>=', ''));
          return inversorPotencia >= valor;
        }
        if (regra.startsWith('<=')) {
          const valor = parseFloat(regra.replace('<=', ''));
          return inversorPotencia <= valor;
        }
        if (regra.startsWith('marca:')) {
          const marca = regra.replace('marca:', '').toUpperCase();
          return (inversor?.marca || '').toUpperCase().includes(marca);
        }
        if (regra.startsWith('modelo:')) {
          const modelo = regra.replace('modelo:', '').toUpperCase();
          return (inversor?.modelo || '').toUpperCase().includes(modelo);
        }
        if (regra.startsWith('tipo:')) {
          const tipo = regra.replace('tipo:', '').toUpperCase();
          return (inversor?.tipo || '').toUpperCase() === tipo;
        }
        return inversorTipo.toUpperCase().includes(regra.toUpperCase());
      });
    }

    // 🔴 Se o piso se aplica, retorna o valor dele
    if (matchPlaca && matchInversor) {
      return piso.valor || 4500;
    }
  }

  // 🔴 Se nenhum piso específico se aplicou, usa o primeiro piso (genérico) ou o padrão
  if (pisos.length > 0) {
    // Procura um piso sem regras específicas (genérico)
    const pisoGenerico = pisos.find(p => 
      (!p.placas || p.placas.length === 0 || p.placas.includes('todos')) &&
      (!p.inversores || p.inversores.length === 0 || p.inversores.includes('todos'))
    );
    if (pisoGenerico) {
      return pisoGenerico.valor || 4750;
    }
    // Se não tem genérico, usa o primeiro piso da lista
    return pisos[0]?.valor || 4750;
  }

  return 4500; // fallback
}
window.calcularPisoLucro = calcularPisoLucro;

// ============================================================
// FUNÇÃO: OBTER SIMULAÇÕES DE FINANCIAMENTO
// ============================================================

function getSimulacoesFinanciamento(placa, inversor, config) {
  const financas = config?.financas || PROPOSTA_CONFIG_DEFAULTS.financas || {};
  const bancos = financas.bancos || [];
  const excecoes = financas.excecoes || [];

  // Bancos selecionados globalmente
  const bancosSelecionados = financas.bancos_selecionados || bancos.map(b => b.id);
  let bancosPermitidos = bancos.filter(b => bancosSelecionados.includes(b.id));

  const placaNome = placa?.marca || placa?.modelo || '';
  const inversorNome = inversor?.marca || inversor?.modelo || inversor?.tipo || '';
  const inversorPotencia = inversor?.potencia || 0;
  const placaPotencia = placa?.potencia || 0;

  for (const excecao of excecoes) {
    let matchPlaca = true;
    let matchInversor = true;

    if (excecao.placas && excecao.placas.length > 0 && !excecao.placas.includes('todos')) {
      matchPlaca = excecao.placas.some(regra => {
        if (regra.startsWith('>=')) {
          const valor = parseFloat(regra.replace('>=', ''));
          return placaPotencia >= valor;
        }
        if (regra.startsWith('<=')) {
          const valor = parseFloat(regra.replace('<=', ''));
          return placaPotencia <= valor;
        }
        if (regra.startsWith('marca:')) {
          const marca = regra.replace('marca:', '').toUpperCase();
          return (placa?.marca || '').toUpperCase().includes(marca);
        }
        if (regra.startsWith('modelo:')) {
          const modelo = regra.replace('modelo:', '').toUpperCase();
          return (placa?.modelo || '').toUpperCase().includes(modelo);
        }
        return placaNome.toUpperCase().includes(regra.toUpperCase());
      });
    }

    if (excecao.inversores && excecao.inversores.length > 0 && !excecao.inversores.includes('todos')) {
      matchInversor = excecao.inversores.some(regra => {
        if (regra.startsWith('>=')) {
          const valor = parseFloat(regra.replace('>=', ''));
          return inversorPotencia >= valor;
        }
        if (regra.startsWith('<=')) {
          const valor = parseFloat(regra.replace('<=', ''));
          return inversorPotencia <= valor;
        }
        if (regra.startsWith('marca:')) {
          const marca = regra.replace('marca:', '').toUpperCase();
          return (inversor?.marca || '').toUpperCase().includes(marca);
        }
        if (regra.startsWith('modelo:')) {
          const modelo = regra.replace('modelo:', '').toUpperCase();
          return (inversor?.modelo || '').toUpperCase().includes(modelo);
        }
        if (regra.startsWith('tipo:')) {
          const tipo = regra.replace('tipo:', '').toUpperCase();
          return (inversor?.tipo || '').toUpperCase() === tipo;
        }
        return inversorNome.toUpperCase().includes(regra.toUpperCase());
      });
    }

    if (matchPlaca && matchInversor) {
      if (excecao.bancos_ids && excecao.bancos_ids.length > 0) {
        bancosPermitidos = bancos.filter(b => excecao.bancos_ids.includes(b.id));
      } else {
        bancosPermitidos = [];
      }
      break;
    }
  }

  const bancosFiltrados = bancosPermitidos.slice(0, 4);

  return {
    bancos: bancosFiltrados,
    ativas: bancosFiltrados.map((_, i) => i + 1),
    entrada_percentual: financas.entrada_percentual || 0,
    carencia_meses: financas.carencia_meses || 3,
    taxa_base: financas.taxa_base || 0,
  };
}
window.getSimulacoesFinanciamento = getSimulacoesFinanciamento;

// ============================================================
// FUNÇÃO: CALCULAR PARCELA (PRICE)
// ============================================================

function calcularParcelaPrice(valor, taxaPercentualMensal, n) {
  const i = taxaPercentualMensal / 100;
  if (!valor || !i || !n) return null;
  if (i === 0) return valor / n;
  const parcela = valor * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  return parcela;
}
window.calcularParcelaPrice = calcularParcelaPrice;

// ============================================================
// UTILITÁRIOS COMPARTILHADOS
// ============================================================

function fmtMoeda(v) {
  return v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
window.fmtMoeda = fmtMoeda;

function esc(v) { return String(v ?? '').replace(/"/g, '&quot;'); }
window.esc = esc;

console.log('%c⚡ Solar Pro 2.0 — proposta-config-shared.js v1.0 carregado', 'color:#ffb020;font-weight:bold');
