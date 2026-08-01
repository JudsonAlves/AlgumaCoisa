// ============================================================
// SOLAR PRO 2.0 — pages/proposta-completa.js
// Proposta comercial completa (6 folhas, estilo Rocha Engenharia),
// gerada 100% a partir dos dados reais do orçamento.
//
// VERSÃO 3.0 - ATUALIZADA COM:
// 1. Financiamento dinâmico (1-4 simulações)
// 2. Bancos cadastrados via personalização
// 3. Exceções por equipamento
// 4. Garantias dinâmicas dos cadastros
//
// VERSÃO 3.1 - PATCH PAGINAÇÃO:
// 5. Paged.js aplicado ao documento inteiro para que qualquer
//    página que "estoure" o limite A4 (ex: página de Itens com
//    muitos materiais) seja dividida automaticamente MANTENDO
//    margem e cabeçalho (logo + section-bar) repetidos em cada
//    folha gerada, igual ao 21_export_pdf.js.
//
// VERSÃO 3.2 - FIX GRÁFICO DE PAYBACK DENTRO DO PAGED.JS:
// 6. O Paged.js reconstrói o documento em páginas CLONANDO os nós
//    originais para dentro de `.pagedjs_pages`. Clonar um <canvas>
//    não copia os pixels já desenhados nele — então se o gráfico
//    era desenhado ANTES do Paged.js terminar de paginar (como
//    estava na 3.1), o clone que ia pra página final ficava em
//    branco. Agora o desenho do gráfico só acontece DEPOIS que o
//    Paged.js termina (via `window.PagedConfig.after`), e é feito
//    diretamente no canvas que já está dentro de `.pagedjs_pages`
//    (o que de fato será exibido/impresso). Mantém um fallback de
//    6s caso o Paged.js não carregue (ex: sem internet / CDN bloqueado).
// ============================================================

// ---- resolve caminhos relativos (assets/...) para URL absoluta -----------
function assetUrl(caminhoRelativo){
  try{ return new URL(caminhoRelativo, document.baseURI).href; }
  catch{ return caminhoRelativo; }
}
const LOGO_PADRAO_URL = assetUrl('assets/images/logo-rocha.png');
window.LOGO_PADRAO_URL = LOGO_PADRAO_URL;

// ---- Estrutura de fixação: 100% cadastrada pelo usuário, sem presets. ----
function getEstruturaInfo(estruturaSelecionada){
  if(!estruturaSelecionada) return null;
  return {
    label: estruturaSelecionada.nome || 'Estrutura',
    img: estruturaSelecionada.imagem_url || null,
    tipo: estruturaSelecionada.tipo || '',
    descricao: estruturaSelecionada.descricao || ''
  };
}

// ============================================================
// FUNÇÃO: CALCULAR PARCELA (PRICE) - REUTILIZA Calc
// ============================================================
function calcularParcelaPrice(valor, taxaPercentualMensal, n){
  return Calc.calcularParcelaPrice(valor, taxaPercentualMensal, n);
}
window.calcularParcelaPrice = calcularParcelaPrice;

function fmtMoedaProp(v){ return v==null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); }
function fmtPctProp(v){ return v==null ? '—' : v.toFixed(2).replace('.',',') + '%'; }

// ============================================================
// FUNÇÃO: MONTAR DADOS DA PROPOSTA (COM FINANCIAMENTO DINÂMICO) - CORRIGIDA
// ============================================================
function montarDadosProposta(data, config){
  const r = data.resultado || {};

  // 🔴 CORREÇÃO: GARANTE QUE FRETE, ACRÉSCIMO E DESCONTO ESTEJAM NO RESULTADO
  // Se não estiverem no objeto passado, busca dos inputs
  if (r.frete === undefined || r.frete === null) {
    const elFrete = document.getElementById('pFrete');
    r.frete = elFrete ? parseMoney(elFrete.value) || 0 : 0;
  }
  if (r.acrescimo === undefined || r.acrescimo === null) {
    const elAcrescimo = document.getElementById('pAcrescimo');
    r.acrescimo = elAcrescimo ? parseMoney(elAcrescimo.value) || 0 : 0;
  }
  if (r.desconto === undefined || r.desconto === null) {
    const elDesconto = document.getElementById('pDesconto');
    r.desconto = elDesconto ? parseMoney(elDesconto.value) || 0 : 0;
  }

  // 🔴 ATUALIZA OS.resultado TAMBÉM
  if (!OS.resultado) OS.resultado = {};
  OS.resultado.frete = r.frete || 0;
  OS.resultado.acrescimo = r.acrescimo || 0;
  OS.resultado.desconto = r.desconto || 0;

  const cfg = config || {};

  const estruturaSelecionada = cfg.estrutura || data.estrutura || null;
  const temEstrutura = !!(estruturaSelecionada && !estruturaSelecionada._semEstrutura);
  const estruturaInfo = temEstrutura ? getEstruturaInfo(estruturaSelecionada) : null;

  const geracaoMediaMensal = Math.round(r.geracaoReal || 0);

  // 🔴 CORREÇÃO: Calcula a geração arredondada igual ao orçamento
  let geracaoExibida = r.geracaoReal || 0;
  if (data.itensPlaca && data.itensPlaca.length > 0 && cfg?.arredondamento?.ativado !== false) {
    const gerReq = data.geracaoDesejada || geracaoMediaMensal || 0;
    const valorArredon = Calc.valorArredonAutomatico(gerReq, cfg);
    const primeiraPlacaCalc = data.itensPlaca[0]?.placa;
    if (primeiraPlacaCalc) {
      const fator = Calc.fatorGeracao(primeiraPlacaCalc, 1.0);
      const qtdTotal = data.itensPlaca.reduce((acc, i) => acc + (i.qtd || 0), 0);
      geracaoExibida = Calc.geracaoFinal(qtdTotal, fator, valorArredon, cfg);
    }
  }
  geracaoExibida = Math.round(geracaoExibida || 0);

  const contaMediaMensal = (+cfg.contaMediaMensal || geracaoMediaMensal) || 0;
  const rentabilidadeAA = (+cfg.rentabilidadeAA || 6.70) / 100;
  const aumentoContaAA = (+cfg.aumentoContaAA || 10) / 100;
  // 🔴 FIX (payback 30 anos): "simultaneidade" é o quanto da conta de
  // energia vira economia mensal real. Estava com padrão de 50%, bem
  // abaixo do que a rede de compensação de energia costuma entregar —
  // ajustado para 75% (ainda editável por orçamento no campo
  // "Simultaneidade").
  const simultaneidade = (+cfg.simultaneidade || 75) / 100;

  const temEquipamentoSolar = (data.itensPlaca && data.itensPlaca.length > 0)
    || (data.itensInversor && data.itensInversor.length > 0)
    || (data.itensBateria && data.itensBateria.length > 0)
    || (data.itensOutros && data.itensOutros.length > 0);

  // ---- GARANTIAS DINÂMICAS ----
  const garantias = {
    placas: (data.itensPlaca || []).map(item => ({
      nome: `${item.placa.marca || ''} ${item.placa.modelo || ''}`.trim() || 'Placa Solar',
      garantia: item.placa.garantia || '12 anos',
      garantiaGeracao: item.placa.garantiager || '25 anos',
      potencia: item.placa.potencia || 0
    })),
    inversores: (data.itensInversor || []).map(item => ({
      nome: `${item.inversor.marca || ''} ${item.inversor.modelo || ''}`.trim() || 'Inversor',
      garantia: item.inversor.garantia || '10 anos',
      tipo: item.inversor.tipo || '',
      potencia: item.inversor.potencia || 0
    })),
    baterias: (data.itensBateria || []).map(item => ({
      nome: item.bateria.nome || 'Bateria',
      garantia: item.bateria.garantia || '5 anos'
    })),
    outros: (data.itensOutros || [])
      .filter(item => item.outros?.garantia)
      .map(item => ({
        nome: `${item.outros.nome || ''} ${item.outros.modelo || ''}`.trim() || 'Equipamento',
        garantia: `${item.outros.garantia} meses`
      }))
  };

  // ---- VALIDADE ----
  const validadeDias = cfg.validade_dias || 7;

  // ---- FORMAS DE PAGAMENTO ----
  const formasPagamento = {
    opcoes: cfg.forma_pagamento_opcoes || 'À vista, financiamento ou cartão de crédito em até 12x.',
    aVista: cfg.forma_pagamento_avista || '75% antes da execução · 25% após instalação.',
    observacao: cfg.forma_pagamento_obs || 'Este documento não tem validade de registro; é uma forma objetiva e prática de apresentar o orçamento.'
  };

  // ---- ASSINATURA ----
  const engenheiro = {
    nome: cfg.assinatura_nome || 'Juan Francisco Gabriel Rocha de Sousa',
    papeis: (cfg.assinatura_papeis || 'Engenheiro Eletricista\nEngenheiro de Segurança do Trabalho\nEngenheiro Clínico e Hospitalar').split('\n').filter(Boolean)
  };

  // ---- MARCA D'ÁGUA ----
  const marcaDagua = cfg.marca_dagua_ativa !== false;

  // ---- FINANCIAMENTO DINÂMICO ----
  // Usa a função do personalizacao-proposta.js se disponível
  let financasData = { bancos: [], ativas: [], entrada_percentual: 0, carencia_meses: 3 };

  if (typeof window.getSimulacoesFinanciamento === 'function') {
    const primeiraPlaca = data.itensPlaca?.[0]?.placa || null;
    const primeiroInversor = data.itensInversor?.[0]?.inversor || null;
    financasData = window.getSimulacoesFinanciamento(primeiraPlaca, primeiroInversor, cfg);
  } else {
    // Fallback: bancos padrão
    const bancosPadrao = [
      { id: 'b1', nome: 'BTG', taxas: {12:2.35, 24:1.98, 36:1.79, 48:1.68, 60:1.61, 72:1.56, 84:1.52} },
      { id: 'b2', nome: 'Banco do Brasil', taxas: {12:2.52, 24:2.11, 36:1.91, 48:1.79, 60:1.72, 72:1.66, 84:1.62} },
      { id: 'b3', nome: 'BV', taxas: {12:2.61, 24:2.19, 36:1.98, 48:1.85, 60:1.78, 72:1.72} },
      { id: 'b4', nome: 'Sol Agora', taxas: {12:2.76, 24:2.23, 36:1.99, 48:1.84, 60:1.42, 72:1.62, 84:1.56} },
    ];
    financasData.bancos = bancosPadrao;
    financasData.ativas = [1, 2, 3, 4];
    financasData.entrada_percentual = 0;
    financasData.carencia_meses = 3;
  }

  // Processa os bancos com cálculo de parcelas
  // 🔴 mantém todos os campos originais do banco (inclusive logo_url,
  // se cadastrado em personalizacao-proposta.js) via spread `...b`,
  // para que a bolinha de logo do financiamento (.f2-bank-logo) possa
  // exibir a logo real do banco quando existir.
  const bancosProcessados = financasData.bancos.map(b => ({
    ...b,
    parcelas: Object.keys(b.taxas || {})
      .map(Number)
      .sort((a,z) => a-z)
      .map(prazo => ({
        prazo,
        taxa: b.taxas[prazo],
        parcela: calcularParcelaPrice(r.totalGeral, b.taxas[prazo], prazo)
      }))
  }));

  return {
    tipoProposta: temEquipamentoSolar ? 'solar' : 'material_servico',
    codigoProposta: data.codigoProposta || '',
    cliente: data.cliente,
    vendedor: data.vendedor || cfg.vendedor || null,
    estrutura: estruturaInfo ? {
      ...estruturaInfo,
      id: estruturaSelecionada?.id || null,
      nome: estruturaSelecionada?.nome || estruturaInfo.label,
      tipo: estruturaSelecionada?.tipo || estruturaInfo.tipo,
      descricao: estruturaSelecionada?.descricao || estruturaInfo.descricao,
    } : null,
    geracaoMediaMensal: Math.round(r.geracaoReal || 0),
    geracaoExibida: geracaoExibida,
    capaTemplateId: cfg.capa_template_id || 'diagonal_classica',
    capaDados: montarDadosCapa(cfg, {
      clienteNome: data.cliente?.nome || null,
      vendedorNome: (data.vendedor || cfg.vendedor)?.nome || null
    }),
    marcaDagua: marcaDagua,
    formasPagamento: formasPagamento,
    itensPlaca: data.itensPlaca || [],
    itensInversor: data.itensInversor || [],
    itensBateria: data.itensBateria || [],
    itensOutros: data.itensOutros || [],
    itensMateriais: data.itensMateriais || [],
    valorTotal: r.totalGeral || 0,
    payback: {
      investimento: r.totalGeral || 0,
      contaMediaMensal, rentabilidadeAA, aumentoContaAA, simultaneidade
    },
    financiamento: {
      entrada_percentual: financasData.entrada_percentual || 0,
      carencia_meses: financasData.carencia_meses || 3,
      bancos: bancosProcessados,
      ativas: financasData.ativas || [1, 2, 3, 4]
    },
    engenheiro: engenheiro,
    garantias: garantias,
    validadeDias: validadeDias,
    dataProposta: new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }),
    // 🔴 FIX: sem isso, `dados.resultado` chegava undefined em renderPropostaCompletaHTML
    // e o nome do arquivo nunca via os extras (frete/acréscimo/desconto), mesmo eles
    // aparecendo corretamente no valor total (r.totalGeral já os inclui).
    resultado: {
      ...r,
      frete: r.frete || 0,
      acrescimo: r.acrescimo || 0,
      desconto: r.desconto || 0,
      totalGeral: r.totalGeral || 0
    }
  };
}
window.montarDadosProposta = montarDadosProposta;

// ============================================================
// FUNÇÃO: RENDERIZAR GARANTIAS DINÂMICAS
// ============================================================
function renderGarantiasHtml(garantias){
  const temPlacas = garantias.placas && garantias.placas.length > 0;
  const temInversores = garantias.inversores && garantias.inversores.length > 0;
  const temBaterias = garantias.baterias && garantias.baterias.length > 0;
  const temOutros = garantias.outros && garantias.outros.length > 0;
  const temAlgumEquipamento = temPlacas || temInversores || temBaterias || temOutros;

  let html = '<div class="garantia-item">';

  if (!temAlgumEquipamento) {
    html += `<h4>Garantia de Prestação de Serviço</h4>`;
    html += `<p>1 ano contra defeitos na execução do serviço, conforme especificado no contrato.</p>`;
    html += '</div>';
    return html;
  }

  if (temPlacas) {
    const placa = garantias.placas[0];
    html += `<h4>Painéis Solares (${placa.nome})</h4>`;
    html += `<p>${placa.garantia} contra defeitos de fabricação · potência linear garantida por ${placa.garantiaGeracao}.</p>`;
    if (garantias.placas.length > 1) {
      const piores = garantias.placas.map(p => parseInt(p.garantia) || 0);
      const pior = Math.min(...piores);
      html += `<p style="font-size:11px;color:#8A7A6A;">* Garantia mínima entre os modelos: ${pior} anos.</p>`;
    }
  }

  if (temInversores) {
    const inversor = garantias.inversores[0];
    html += `<h4>Inversor (${inversor.nome})</h4>`;
    html += `<p>${inversor.garantia} contra defeitos de fabricação.</p>`;
  }

  if (temBaterias) {
    const bateria = garantias.baterias[0];
    html += `<h4>Bateria (${bateria.nome})</h4>`;
    html += `<p>${bateria.garantia} contra defeitos de fabricação.</p>`;
  }

  if (temOutros) {
    garantias.outros.forEach(o => {
      html += `<h4>${o.nome}</h4>`;
      html += `<p>${o.garantia} contra defeitos de fabricação.</p>`;
    });
  }

  if (temPlacas || temInversores) {
    html += `<h4>Cabos e Conectores</h4><p>2 anos contra defeitos de fabricação.</p>`;
  }

  html += '</div>';
  return html;
}

// ============================================================
// FUNÇÃO: RENDERIZAR ITENS DA PROPOSTA
// ============================================================
function itemCardProp(equip, qtd, titleFn, metaFn){
  if(!equip) return '';
  return `<div class="item-card">
    ${equip.imagem_url
      ? `<img class="item-thumb" src="${equip.imagem_url}" alt="${titleFn(equip)}" onerror="this.outerHTML='<div class=&quot;item-noimg&quot;>Sem imagem cadastrada</div>'">`
      : `<div class="item-noimg">Sem imagem cadastrada</div>`}
    <div class="item-main"><div class="item-title">${titleFn(equip)}</div><div class="item-meta">${metaFn(equip)}</div></div>
    <div class="item-qtd">${qtd}×</div>
  </div>`;
}

function renderItensGroupProp(titulo, itens, chave, titleFn, metaFn){
  if(!itens || itens.length === 0) return '';
  const cardsHtml = itens.map(it => itemCardProp(it[chave], it.qtd, titleFn, metaFn)).join('');
  if(!cardsHtml) return '';
  return `<div class="itens-group"><h4>${titulo}</h4>${cardsHtml}</div>`;
}

// ============================================================
// FUNÇÃO: RENDERIZAR COLUNAS DOS MATERIAIS
// ============================================================
function getColunasVisiveis() {
  try {
    const salvo = localStorage.getItem('sp2_colunas_materiais');
    if (salvo) {
      return JSON.parse(salvo);
    }
  } catch(e) { /* fallback */ }
  return { descricao: true, qtd: true, unidade: true, valorUnit: true, total: true };
}

// ============================================================
// FINANCIAMENTO V2 — helpers (iniciais + card + comparativo)
// ============================================================

// Gera as iniciais do banco para exibir no lugar da logo
// quando não houver banco.logo_url/logo cadastrado.
function iniciaisBancoProp(nome){
  if(!nome) return '?';
  return nome
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

// Renderiza o selo de logo do banco: usa banco.logo_url (ou
// banco.logo / banco.logoUrl, para compatibilidade com diferentes
// nomes de campo no cadastro). Antes era uma bolinha pequena (36px)
// e a logo ficava minúscula/imperceptível; agora é um retângulo
// branco de cantos arredondados, largura flexível, posicionado do
// lado oposto ao nome do banco (ver .f2-bank-head com
// justify-content:space-between). Cai para as iniciais em texto
// quando não houver imagem cadastrada ou se ela falhar ao carregar.
function renderBankLogoCircle(banco){
  const logoUrl = banco.logo_url || banco.logo || banco.logoUrl || null;
  const iniciais = iniciaisBancoProp(banco.nome);
  if(logoUrl){
    return `<div class="f2-bank-logo">
      <img src="${logoUrl}" alt="${banco.nome || 'Banco'}"
           onerror="this.parentElement.innerHTML='${iniciais}';this.parentElement.classList.add('f2-bank-logo--fallback');">
    </div>`;
  }
  return `<div class="f2-bank-logo f2-bank-logo--fallback">${iniciais}</div>`;
}

// ============================================================
// FUNÇÃO: ESCOLHER A MELHOR PARCELA DO BANCO (PRIORIZA 60x)
// ============================================================
function melhorParcelaBanco(banco){
  const parcelas = banco.parcelas || [];
  if(!parcelas.length) return null;
  
  // PRIORIZA 60x SE DISPONÍVEL
  const parcela60 = parcelas.find(p => p.prazo === 60);
  if (parcela60) return parcela60;
  
  // SE NÃO TIVER 60x, PEGA O MAIOR PRAZO DISPONÍVEL
  return parcelas[parcelas.length - 1];
}

// ---- MODO 1/2/3: card individual do banco ----
function renderBankCardProp(banco, destaque){
  const melhor = melhorParcelaBanco(banco);
  if(!melhor){
    return `<div class="f2-card">
      <div class="f2-bank-head">
        <div class="f2-bank-name">${banco.nome || 'Banco'}</div>
        ${renderBankLogoCircle(banco)}
      </div>
      <div class="f2-card-body">
        <p style="font-size:12px;color:#8A7A6A;">Nenhuma condição cadastrada para este banco.</p>
      </div>
    </div>`;
  }

  const outras = (banco.parcelas || [])
    .filter(p => p.prazo !== melhor.prazo)
    .slice(-4);

  return `<div class="f2-card">
    <div class="f2-bank-head">
      <div class="f2-bank-name">${banco.nome || 'Banco'}</div>
      ${renderBankLogoCircle(banco)}
    </div>
    <div class="f2-card-body">
      <div class="f2-main-offer">
        <div class="f2-term"><small>Prazo</small>${melhor.prazo}x</div>
        <div class="f2-installment"><small>Parcela</small>${fmtMoedaProp(melhor.parcela)}</div>
      </div>
      ${outras.length ? `
      <div class="f2-other-title">Outras condições</div>
      <div class="f2-options-grid">
        ${outras.map(p => `
          <div class="f2-option">
            <div class="f2-prazo">${p.prazo}x</div>
            <div class="f2-taxa">${fmtPctProp(p.taxa)} a.m.</div>
            <div class="f2-parcela">${fmtMoedaProp(p.parcela)}</div>
          </div>
        `).join('')}
      </div>` : ''}
    </div>
  </div>`;
}

// ---- MODO 4: quadro comparativo executivo ----
function renderComparativoBancosProp(bancos){
  // prazos em comum entre todos os bancos selecionados (só faz
  // sentido comparar prazo a prazo quando o prazo existe nos dois)
  const listasPrazos = bancos.map(b => (b.parcelas || []).map(p => p.prazo));
  let prazosComuns = listasPrazos[0] || [];
  for(let i = 1; i < listasPrazos.length; i++){
    prazosComuns = prazosComuns.filter(p => listasPrazos[i].includes(p));
  }

  if(!prazosComuns.length){
    return `<div style="padding:20px;text-align:center;color:#8A7A6A;font-size:13px;">
      Os bancos selecionados não possuem prazos em comum para comparação.
    </div>`;
  }

  // banco recomendado = menor parcela no maior prazo em comum
  const prazoReferencia = prazosComuns[prazosComuns.length - 1];
  let melhorBancoId = null;
  let menorParcelaRef = Infinity;
  bancos.forEach(b => {
    const info = (b.parcelas || []).find(p => p.prazo === prazoReferencia);
    if(info && info.parcela < menorParcelaRef){
      menorParcelaRef = info.parcela;
      melhorBancoId = b.id;
    }
  });

  const headCells = bancos.map(b => `
    <th class="${b.id === melhorBancoId ? 'f2-best-col' : ''}">
      ${b.nome || 'Banco'}
    </th>
  `).join('');

  const rows = prazosComuns.map(prazo => {
    let menorValor = Infinity;
    bancos.forEach(b => {
      const info = (b.parcelas || []).find(p => p.prazo === prazo);
      if(info && info.parcela < menorValor) menorValor = info.parcela;
    });
    const cells = bancos.map(b => {
      const info = (b.parcelas || []).find(p => p.prazo === prazo);
      if(!info) return `<td>—</td>`;
      const isBest = Math.abs(info.parcela - menorValor) < 0.01;
      return `
        <td class="${isBest ? 'f2-best-cell' : ''}">
          <span class="f2-parcela-val">${fmtMoedaProp(info.parcela)}</span>
          <span class="f2-taxa-val">${fmtPctProp(info.taxa)} a.m.</span>
        </td>
      `;
    }).join('');
    return `<tr><th>${prazo}x</th>${cells}</tr>`;
  }).join('');

  const footCells = bancos.map(b => `
    <td>${b.id === melhorBancoId ? '<span class="f2-check">&#10003;</span> Recomendado' : '&#8212;'}</td>
  `).join('');

  return `
  <div class="f2-compare-wrap">
    <table class="f2-compare-table">
      <thead>
        <tr>
          <th class="f2-rowlabel-th">Prazo</th>
          ${headCells}
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="f2-compare-footrow">
          <th>Condição</th>
          ${footCells}
        </tr>
      </tbody>
    </table>
  </div>`;
}

// ---- Dispatcher: escolhe o layout certo conforme a quantidade de bancos ----
function renderFinanciamentoBancosHtml(bancosAtivos){
  const qtd = (bancosAtivos || []).length;

  if(qtd === 0){
    return `<div style="padding:20px;text-align:center;color:#8A7A6A;font-size:13px;">
      Nenhum banco cadastrado para esta simulação.
    </div>`;
  }

  if(qtd >= 4){
    // quadro comparativo executivo — usa no máximo os 4 primeiros
    // bancos ativos para manter o quadro legível em uma folha A4.
    return `<div class="f2-mode-4">${renderComparativoBancosProp(bancosAtivos.slice(0, 4))}</div>`;
  }

  const modeClass = `f2-mode-${qtd}`;
  const cardsHtml = bancosAtivos
    .map((b, idx) => renderBankCardProp(b, qtd === 1 || idx === 0))
    .join('');

  return `<div class="${modeClass}">${cardsHtml}</div>`;
}
window.renderFinanciamentoBancosHtml = renderFinanciamentoBancosHtml;

// ============================================================
// CSS BASE DA PROPOSTA
// ============================================================
function propostaBaseCss(){
  return `
:root{--orange:#E8672B;--brown:#3E2818;--dark:#2A1B10;--light-gray:#F3EFE9;--green-row:#DDEFDD;--line:#E6E0D5;--paper:#FFFFFF;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Barlow',sans-serif;background:#DCD6C8;color:var(--dark);}
nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:var(--dark);display:flex;gap:2px;padding:10px 24px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,.3);}
nav a{color:#D8C9BB;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;padding:7px 14px;white-space:nowrap;}
nav a:hover,nav a.active{color:#fff;background:var(--orange);border-radius:4px;}
.page{margin:80px auto 32px;background:var(--paper);box-shadow:0 4px 32px rgba(0,0,0,.22);position:relative;overflow:hidden;padding: 10mm;}
.page > *:not(.watermark){position:relative;z-index:1;}
.watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;overflow:hidden;}
.watermark img{width:520px;opacity:.05;transform:rotate(-18deg);filter:grayscale(1);}
.sheet{padding:34px 40px 96px;}
.logo-header{padding:18px 40px 6px;}
.logo-header img{height:34px;}
.running-header{padding:18px 40px 6px;}
.running-header img{height:34px;}
.section-bar{margin:0 40px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--orange);padding-bottom:8px;}
.section-bar .title{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;text-transform:uppercase;color:var(--dark);letter-spacing:.5px;}
.section-bar .sub{font-family:'Barlow Condensed',sans-serif;font-size:12px;color:var(--orange);font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.section-bar2{margin:0 40px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid var(--line);padding-bottom:8px;}
.section-bar2 .title{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;text-transform:uppercase;color:var(--dark);letter-spacing:.5px;}
.section-bar2 .sub{font-family:'Barlow Condensed',sans-serif;font-size:12px;color:var(--orange);font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.page-footer{position:absolute;bottom:0;left:0;right:0;background:var(--dark);color:#D8C9BB;font-size:10px;padding:12px 40px;display:flex;justify-content:space-between;}
#page1{padding:0;}
#page1 .page-capa{width:100%;height:1123px;}
.gen-bar{align-items: center;display:flex;margin:0 40px 4px;background:var(--light-gray);border-left:4px solid var(--orange);padding:0 16px;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--dark);}
.gen-bar-valor{color:var(--orange);font-size:24px;margin: 10px;}
.itens-group{margin:0 40px 4px;}
.itens-group h4{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--brown);margin-bottom:10px;border-bottom:1px solid var(--line);padding-bottom:6px;}
.item-card{display:flex;gap:14px;align-items:center;padding:8px 12px;border:1px solid var(--line);border-radius:6px;margin-bottom:8px;background:#fff;}
.item-card img.item-thumb{width:100px;height:100px;object-fit:contain;border-radius:4px;background:var(--light-gray);flex-shrink:0;}
.item-card .item-noimg{width:64px;height:64px;border-radius:4px;background:var(--light-gray);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#B7ADA0;font-size:10px;text-align:center;}
.item-card .item-main{flex:1;}
.item-card .item-title{font-size:13.5px;font-weight:600;color:var(--dark);}
.item-card .item-meta{font-size:11.5px;color:#8A7A6A;margin-top:2px;}
.item-card .item-qtd{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;color:var(--black);white-space:nowrap;}
.mat-table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:12.5px;}
.mat-table thead{display:table-header-group;}
.mat-table thead th{text-align:left;font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#8A7A6A;border-bottom:2px solid var(--dark);padding:6px 8px;}
.mat-table thead th.num{text-align:right;}
.mat-table tbody td{padding:8px;border-bottom:1px solid var(--line);}
.mat-table tbody td.num{text-align:right;font-weight:600;}
.mat-table tbody tr{page-break-inside:avoid;break-inside:avoid;}
.price-banner{margin:14px 40px 0;background:var(--dark);color:#fff;display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-radius:6px;}
.price-banner .por{font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--orange);}
.price-banner .value{font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:800;}
.note-grid{margin:16px 40px 0;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.note-card{background:var(--light-gray);border-left:3px solid var(--orange);border-radius:4px;padding:10px 14px;}
.note-card h5{font-family:'Barlow Condensed',sans-serif;font-size:11.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--dark);margin-bottom:3px;}
.note-card p{font-size:11.5px;color:#6B5C4C;line-height:1.5;}
.struct-pick-card{display:flex;gap:14px;align-items:center;padding:10px 12px;border:1px solid var(--orange);border-radius:6px;margin-bottom:8px;background:#FFF7F0;}
.struct-pick-card .sp-ico{width:64px;height:64px;border-radius:4px;background:var(--light-gray);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px;}
.struct-pick-card .sp-ico img{width:100%;height:100%;object-fit:contain;border-radius:4px;}
.struct-pick-card .sp-label{font-size:10.5px;color:var(--orange);text-transform:uppercase;letter-spacing:.5px;font-weight:700;}
.struct-pick-card .sp-title{font-size:13.5px;font-weight:600;color:var(--dark);margin-top:1px;}
.inv-grid{margin:0 40px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.inv-row{background:var(--light-gray);display:flex;justify-content:space-between;padding:10px 18px;border-radius:4px;}
.inv-row .label{font-size:12px;color:#8A7A6A;text-transform:uppercase;letter-spacing:.5px;}
.inv-row .val{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:800;color:var(--dark);}
.pb-metrics{margin:0 40px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.pb-metric{background:var(--orange);color:#fff;padding:12px 16px;border-radius:4px;}
.pb-metric .pl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.85;}
.pb-metric .pv{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:800;}
.pb-rows{margin:0 40px 16px;}
.pb-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--line);font-size:12.5px;}
.pb-row .rv{font-family:'Barlow Condensed',sans-serif;font-weight:800;color:var(--dark);}
.chart-wrap{margin:0 40px 0;border:1px solid var(--line);border-radius:6px;padding:16px;}
.chart-wrap h3{text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;color:var(--dark);margin-bottom:10px;text-transform:uppercase;}
.fin-top{margin:0 40px 18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
.fin-box{background:var(--light-gray);padding:12px 14px;border-radius:6px;}
.fin-box .fl{font-size:10.5px;color:#8A7A6A;text-transform:uppercase;letter-spacing:.5px;}
.fin-box .fv{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:var(--dark);}
.fin-note{margin:16px 40px 0;font-size:11px;color:#8A7A6A;}
.struct-example{margin:0 40px 22px;border:1px solid var(--line);border-radius:6px;overflow:hidden;height:200px;display:flex;align-items:center;justify-content:center;background:var(--light-gray);}
.struct-example img{width:100%;height:100%;object-fit:none;}
.struct-caption{margin:-16px 40px 22px;font-size:11px;color:#8A7A6A;text-align:center;font-style:italic;}
.two-col{margin:0 40px 0;display:grid;grid-template-columns:1fr 1fr;gap:24px;}
.garantia-item{margin-bottom:14px;}
.garantia-item h4{font-family:'Barlow Condensed',sans-serif;font-size:13.5px;font-weight:700;color:var(--dark);}
.garantia-item p{font-size:12px;color:#6B5C4C;margin-top:2px;}
.garantia-wrap{margin:0 40px 4px;}
.crono-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.crono-item{background:var(--dark);color:#fff;padding:10px 14px;border-radius:4px;}
.crono-item .cn{font-family:'Barlow Condensed',sans-serif;color:var(--orange);font-weight:800;font-size:17px;}
.crono-item .ct{font-size:10.5px;font-weight:600;}
.crono-item .ctime{font-size:9.5px;color:#D8C9BB;}
.two-col-eq{margin:0 40px 20px;display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.benefit-item{display:flex;gap:8px;margin-bottom:8px;font-size:12.5px;color:#3A2E22;}
.benefit-item .ck{color:var(--orange);font-weight:800;}
.resp-sub{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:var(--dark);margin:8px 0 4px;text-transform:uppercase;}
.resp-list li{font-size:12px;color:#6B5C4C;padding:3px 0;list-style:none;padding-left:14px;position:relative;}
.resp-list li::before{content:'—';position:absolute;left:0;color:var(--orange);}
.legis-box{margin:0 40px 16px;border:1px solid var(--line);border-radius:6px;padding:16px 20px;}
.legis-box h4{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:var(--dark);text-transform:uppercase;margin-bottom:8px;}
.legis-box p{font-size:12.5px;color:#6B5C4C;line-height:1.7;}
.validity-box{margin:0 40px 16px;background:var(--light-gray);padding:12px 18px;border-left:4px solid var(--orange);font-size:12.5px;font-style:italic;text-align:center;}
.sign-block{margin:0 40px;text-align:right;font-size:12.5px;color:#6B5C4C;}
.prop-code-footer{margin:24px 40px 0;text-align:left;font-size:8px;color:#c2b8aa;letter-spacing:.5px;}
.sign-block .name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;color:var(--dark);}

/* ============================================================
   FINANCIAMENTO V2 — layout executivo (estilo concessionária)
   Namespace "f2-" para não colidir com nenhuma classe existente.
   ============================================================ */
.f2-mode-1, .f2-mode-2, .f2-mode-3{ margin:0 40px 4px; }
.f2-mode-1{ display:block; }
.f2-mode-2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:stretch; }
.f2-mode-3{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.f2-mode-3 .f2-card:nth-child(3){ grid-column:1 / -1; }
.f2-mode-3 .f2-card:nth-child(3) .f2-card-body{
  display:grid; grid-template-columns:1fr 1.3fr; gap:22px; align-items:center;
}
.f2-mode-3 .f2-card:nth-child(3) .f2-main-offer{ margin-bottom:0; }
.f2-mode-3 .f2-card:nth-child(3) .f2-other-title{ display:none; }

.f2-card{
  border:1px solid var(--line); border-radius:8px; overflow:hidden;
  background:#fff; display:flex; flex-direction:column;
  page-break-inside:avoid; break-inside:avoid;
}
.f2-bank-head{
  background:var(--dark); color:#fff; padding:12px 18px;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
}
.f2-bank-name{
  font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:800;
  letter-spacing:.5px; text-transform:uppercase;
}
/* 🔴 Selo de logo do banco: antes era uma bolinha de 36px (a logo ficava
   minúscula e imperceptível). Agora é um retângulo branco de cantos
   arredondados, com largura flexível e altura maior, posicionado do lado
   oposto ao nome do banco (justify-content:space-between no .f2-bank-head
   acima cuida do posicionamento). */
.f2-bank-logo{
  height:38px; min-width:64px; max-width:120px; padding:5px 12px;
  border-radius:8px; background:#fff; color:var(--dark);
  display:flex; align-items:center; justify-content:center; overflow:hidden;
  font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:800;
  letter-spacing:.5px; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,.18);
}
.f2-bank-logo img{ max-width:100%; object-fit:contain; }
/* fallback com iniciais: um pouco mais compacto que quando há imagem real */
.f2-bank-logo--fallback{ min-width:40px; padding:5px 10px; }
.f2-card-body{ padding:18px; flex:1; display:flex; flex-direction:column; }
.f2-badge{
  display:inline-block; background:var(--orange); color:#fff;
  font-family:'Barlow Condensed',sans-serif; font-size:10.5px; font-weight:700;
  letter-spacing:1px; text-transform:uppercase; padding:4px 12px; border-radius:20px;
  margin-bottom:12px; width:fit-content;
}
.f2-main-offer{
  display:flex; align-items:baseline; justify-content:space-between;
  background:var(--green-row); border-left:4px solid var(--orange);
  padding:12px 16px; border-radius:6px; margin-bottom:14px;
}
.f2-term, .f2-installment{ font-family:'Barlow Condensed',sans-serif; font-weight:800; line-height:1; }
.f2-term{ color:var(--orange); font-size:32px; }
.f2-installment{ color:var(--dark); font-size:22px; text-align:right; }
.f2-term small, .f2-installment small{
  display:block; font-size:9.5px; color:#8A7A6A; font-weight:700;
  letter-spacing:.5px; text-transform:uppercase; margin-bottom:2px;
}
.f2-other-title{
  font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700;
  letter-spacing:.5px; text-transform:uppercase; color:#8A7A6A; margin-bottom:8px;
}
.f2-options-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
.f2-option{ background:var(--light-gray); border-radius:6px; padding:8px 4px; text-align:center; }
.f2-prazo{ font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:800; color:var(--dark); }
.f2-taxa{ font-size:8.5px; color:#8A7A6A; margin:1px 0 2px; }
.f2-parcela{ font-size:10.5px; font-weight:700; color:var(--brown); }

/* Modo 1 — hero premium */
.f2-mode-1 .f2-card{ min-height:280px; }
.f2-mode-1 .f2-bank-head{ padding:16px 26px; }
.f2-mode-1 .f2-bank-name{ font-size:24px; }
.f2-mode-1 .f2-bank-logo{ height:50px; min-width:84px; max-width:160px; padding:7px 16px; font-size:13px; }
.f2-mode-1 .f2-bank-logo--fallback{ min-width:52px; }
.f2-mode-1 .f2-card-body{ padding:22px 26px; }
.f2-mode-1 .f2-term{ font-size:44px; }
.f2-mode-1 .f2-installment{ font-size:32px; }
.f2-mode-1 .f2-options-grid{ gap:10px; }
.f2-mode-1 .f2-option{ padding:12px 6px; }
.f2-mode-1 .f2-prazo{ font-size:17px; }
.f2-mode-1 .f2-parcela{ font-size:12px; }

/* Comparativo executivo (4 bancos) */
.f2-mode-4{ margin:0 40px 4px; }
.f2-compare-wrap{ border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.f2-compare-table{ width:100%; border-collapse:collapse; }
.f2-compare-table thead th{
  background:var(--dark); color:#fff; font-family:'Barlow Condensed',sans-serif;
  font-size:14px; font-weight:800; letter-spacing:.5px; text-transform:uppercase;
  padding:14px 8px 10px; text-align:center; position:relative;
}
.f2-compare-table thead th.f2-rowlabel-th{ background:var(--brown); }
.f2-compare-table thead th .f2-best-seal{
  position:absolute; top:-11px; left:50%; transform:translateX(-50%);
  background:var(--orange); color:#fff; font-size:8.5px; font-weight:800;
  letter-spacing:.6px; text-transform:uppercase; padding:3px 10px; border-radius:20px;
  white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,.25);
}
.f2-compare-table thead th.f2-best-col{ background:var(--orange); }
.f2-compare-table tbody td, .f2-compare-table tbody th{
  padding:9px 8px; border-bottom:1px solid var(--line); font-size:11.5px; text-align:center;
  page-break-inside:avoid; break-inside:avoid;
}
.f2-compare-table tbody th{
  text-align:left; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11.5px;
  letter-spacing:.3px; text-transform:uppercase; color:#8A7A6A; background:var(--light-gray);
}
.f2-compare-table tbody tr:last-child td, .f2-compare-table tbody tr:last-child th{ border-bottom:none; }
.f2-compare-table td.f2-best-cell{ background:var(--green-row); font-weight:800; color:var(--brown); }
.f2-parcela-val{ display:block; font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:800; color:var(--dark); }
.f2-best-cell .f2-parcela-val{ color:var(--brown); }
.f2-taxa-val{ display:block; font-size:9.5px; color:#8A7A6A; margin-top:1px; }
.f2-compare-footrow th, .f2-compare-footrow td{
  background:#fff !important; border-top:2px solid var(--dark); font-size:11px; padding:12px 8px;
}
.f2-check{ color:var(--orange); font-weight:800; }

@media print{
  body{background:#fff;}
  nav{display:none;}
  @page{ size:A4; margin:10mm; }
  @page :first{ margin:0; }
  .page{margin:0;box-shadow:none;page-break-after:always;overflow:visible;padding:0;}
  .item-card,.struct-pick-card,.garantia-item h4,.crono-item,.note-card,
  .f2-card,.f2-compare-table tbody tr{page-break-inside:avoid;break-inside:avoid;}
}
`;
}

// ============================================================
// PATCH PAGINAÇÃO — Paged.js aplicado à proposta
// ============================================================
// `propostaPagedLoader()` injeta o polyfill do Paged.js dentro do HTML
// gerado. Antes de carregar o script, define `window.PagedConfig.after`,
// que é o hook OFICIAL do Paged.js disparado assim que ele termina de
// reconstruir o documento em `.pagedjs_pages`. É só a partir desse ponto
// que faz sentido desenhar o gráfico de payback: como o Paged.js clona
// os nós originais pra montar as páginas, e clonar um <canvas> não copia
// os pixels já desenhados nele, desenhar ANTES (como estava no patch
// anterior) resultava num canvas em branco na versão paginada.
function propostaPagedLoader(){
  return `<script>
  window.PagedConfig = {
    after: function(flow){
      try { document.body.classList.add('pagedjs-ready'); } catch(e){}
      // só desenha o gráfico de payback depois que o Paged.js
      // termina de clonar/paginar o documento inteiro
      if (typeof window.__renderPaybackChart === 'function') {
        window.__renderPaybackChart();
      }
    }
  };
  (function() {
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js';
    script.defer = true;
    document.head.appendChild(script);
  })();
<\/script>`;
}

function propostaPagedCss(){
  return `
/* ===== PATCH PAGINAÇÃO (Paged.js) =====
   Ativo apenas na hora da impressão/PDF (dentro de @media print),
   igual ao restante do CSS existente. Em tela, o layout continua
   exatamente como já era (scroll com nav fixo). */
@media print {

  .running-header{
    padding:18px 40px 6px;
    position: running(propostaRunningHeader);
  }
  .running-header img{ height: 34px; }

  body.pagedjs-ready .logo-header{ display:none; }

  @page {
    size: A4;
    margin: 22mm 10mm 14mm 10mm;
    @top-left {
      content: element(propostaRunningHeader);
      vertical-align: middle;
    }
    @bottom-center {
      content: "Página " counter(page) " de " counter(pages);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      letter-spacing: .5px;
      color: #8A7A6A;
    }
  }

  @page :first {
    margin: 0;
  }

  .page{
    break-after: page;
  }
  .page:last-child{
    break-after: auto;
  }

  .item-card, .struct-pick-card, .garantia-item, .crono-item,
  .note-card, .bank-card, .mat-table tbody tr, .inv-row, .pb-row,
  .f2-card, .f2-compare-table tbody tr {
    break-inside: avoid;
  }
  .mat-table thead{
    display: table-header-group;
  }
}
`;
}

function aguardarPagedJsEPreparar(win){
  const check = setInterval(() => {
    try {
      const pagedReady = win.document.body?.classList.contains('pagedjs_ready')
        || win.document.body?.classList.contains('pagedjs-ready')
        || win.document.querySelectorAll('.pagedjs_page').length > 0;
      if (pagedReady) {
        clearInterval(check);
        try { win.document.body.classList.add('pagedjs-ready'); } catch(e) {}
      }
    } catch(e) { clearInterval(check); }
  }, 200);
  setTimeout(() => { clearInterval(check); }, 6000);
}

// ============================================================
// RENDER: PROPOSTA DE MATERIAIS E SERVIÇOS (DEFINIDA ANTES DE SER USADA)
// ============================================================
function renderPropostaMaterialServicoHTML(dados){
  const wm = dados.marcaDagua !== false ? `<div class="watermark"><img src="${LOGO_PADRAO_URL}" alt=""></div>` : '';
  const capaTemplate = getCapaById(dados.capaTemplateId);
  const capaHtml = `<style>${capaTemplate.css}</style><div class="page-capa">${capaTemplate.render({ ...dados.capaDados, subtitulo: 'Materiais e Serviços' })}</div>`;

  const colunasVisiveis = getColunasVisiveis();

  const materiaisHtml = (dados.itensMateriais && dados.itensMateriais.length) ? `
    <div class="itens-group">
      <h4>Materiais e Serviços</h4>
      <table class="mat-table">
        <thead>
          <tr>
            ${colunasVisiveis.descricao !== false ? `<th>Descrição</th>` : ''}
            ${colunasVisiveis.qtd !== false ? `<th class="num">Qtd.</th>` : ''}
            ${colunasVisiveis.unidade !== false ? `<th class="num">Uni.</th>` : ''}
            ${colunasVisiveis.valorUnit !== false ? `<th class="num">Valor Unit.</th>` : ''}
            ${colunasVisiveis.total !== false ? `<th class="num">Subtotal</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${dados.itensMateriais
            .filter(m => m.mostrarProposta !== false)
            .map(m => {
              const qtd = m.qtd || 1;
              const valorUnit = m.valorUnit || 0;
              return `<tr>
                ${colunasVisiveis.descricao !== false ? `<td>${m.descricao}</td>` : ''}
                ${colunasVisiveis.qtd !== false ? `<td class="num">${formatarNumero(qtd, qtd%1===0?0:2)}</td>` : ''}
                ${colunasVisiveis.unidade !== false ? `<td class="num">${m.unidade || 'UNI'}</td>` : ''}
                ${colunasVisiveis.valorUnit !== false ? `<td class="num">${fmtMoedaProp(valorUnit)}</td>` : ''}
                ${colunasVisiveis.total !== false ? `<td class="num">${fmtMoedaProp(qtd * valorUnit)}</td>` : ''}
              </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>` : '';

  const pagamentoHtml = dados.formasPagamento ? `
    <div class="note-grid">
      <div class="note-card"><h5>Forma de pagamento</h5><p>${dados.formasPagamento.opcoes}</p></div>
      <div class="note-card"><h5>Pagamento à vista</h5><p>${dados.formasPagamento.aVista}</p></div>
      <div class="note-card" style="grid-column:1/-1"><h5>Observação</h5><p>${dados.formasPagamento.observacao}</p></div>
    </div>` : '';

  const validadeDias = dados.validadeDias || 7;

  let nomeProposta = 'Proposta - Materiais e Serviços';
  try {
    if (typeof montarNomePropostaArquivo === 'function') {
      const nomeGerado = montarNomePropostaArquivo(dados);
      if (nomeGerado) {
        nomeProposta = nomeGerado;
      }
    }
  } catch(e) {
    nomeProposta = dados.cliente?.nome
      ? `Proposta - ${dados.cliente.nome}`
      : 'Proposta - Materiais e Serviços';
  }

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>${nomeProposta}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${propostaBaseCss()}
${propostaPagedCss()}
</style>
${propostaPagedLoader()}
</head>
<body>
<nav>
  <a href="#page1" class="active">Capa</a><a href="#page2">Itens</a><a href="#page3">Encerramento</a>
</nav>

<div class="page" id="page1">
  ${wm}
  ${capaHtml}
</div>

<div class="page" id="page2">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="section-bar"><span class="title">Itens do Orçamento</span><span class="sub">Materiais e Serviços</span></div>
  ${materiaisHtml}
  <div class="price-banner"><span class="por">Valor total</span><span class="value">${fmtMoedaProp(dados.valorTotal)}</span></div>
  ${pagamentoHtml}
</div>

<div class="page" id="page3">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="two-col-eq">
    <div>
      <div class="section-bar2" style="margin:0 0 14px"><span class="title" style="font-size:20px">Garantias</span></div>
      ${renderGarantiasHtml(dados.garantias)}
    </div>
    <div>
      <div class="section-bar2" style="margin:0 0 14px"><span class="title" style="font-size:20px">Responsabilidades</span></div>
      <div class="resp-sub">Contratante</div>
      <ul class="resp-list"><li>Fornecer informações e acessos necessários à execução do serviço.</li></ul>
      <div class="resp-sub">Contratada</div>
      <ul class="resp-list"><li>Executar o serviço no prazo proposto, seguindo as normas vigentes no Brasil.</li></ul>
    </div>
  </div>
  <div class="legis-box">
    <h4>Legislação</h4>
    <p>O serviço proposto neste documento será elaborado com base na legislação vigente, nas normas e especificações da ABNT e nas normas do Ministério do Trabalho, mais precisamente a NR-10.</p>
  </div>
  <div class="validity-box">A proposta terá validade de até <b>${validadeDias} dias</b>, a partir da data de apresentação.</div>
  <div class="sign-block">
    <p style="margin-bottom:20px">Imperatriz, ${dados.dataProposta}.</p>
    <p class="name">${dados.engenheiro.nome}</p>
    ${dados.engenheiro.papeis.map(r=>`<p>${r}</p>`).join('')}
  </div>
  ${dados.codigoProposta ? `<div class="prop-code-footer">${dados.codigoProposta}</div>` : ''}
</div>

<script>
(function(){
  var links = document.querySelectorAll('nav a');
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ links.forEach(function(a){a.classList.remove('active');}); var l=document.querySelector('nav a[href="#'+e.target.id+'"]'); if(l) l.classList.add('active'); } });
  }, { threshold:.4 });
  document.querySelectorAll('.page').forEach(function(p){obs.observe(p);});
})();
<\/script>
</body></html>`;
}
window.renderPropostaMaterialServicoHTML = renderPropostaMaterialServicoHTML;

// ============================================================
// RENDER: PROPOSTA COMPLETA HTML (CORRIGIDA - TÍTULO FORÇADO)
// ============================================================
function renderPropostaCompletaHTML(dados){
  if(dados.tipoProposta === 'material_servico') return renderPropostaMaterialServicoHTML(dados);

  const struct = dados.estrutura || null;
  const wm = dados.marcaDagua !== false ? `<div class="watermark"><img src="${LOGO_PADRAO_URL}" alt=""></div>` : '';

  const temPlacasR = !!(dados.itensPlaca && dados.itensPlaca.length > 0);
  const temInversoresR = !!(dados.itensInversor && dados.itensInversor.length > 0);
  const temGeracaoSolar = temPlacasR && temInversoresR;

  const capaTemplate = getCapaById(dados.capaTemplateId);
  const capaHtml = `<style>${capaTemplate.css}</style><div class="page-capa">${capaTemplate.render(dados.capaDados)}</div>`;

  // 🔴 CORREÇÃO: GERA O NOME DA PROPOSTA DIRETAMENTE AQUI
  let nomeProposta = 'Proposta - Projeto Solar';

  // Tenta gerar o nome com os dados atuais
  try {
    if (typeof montarNomePropostaArquivo === 'function') {
      // 🔴 GARANTE QUE OS EXTRAS ESTEJAM NO RESULTADO
      const r = dados.resultado || {};

      // 🔴 FORÇA OS VALORES DOS EXTRAS NO OBJETO
      const dadosParaNome = {
        ...dados,
        resultado: {
          ...r,
          frete: r.frete || 0,
          acrescimo: r.acrescimo || 0,
          desconto: r.desconto || 0
        }
      };

      // 🔴 DEBUG: MOSTRA O QUE ESTÁ SENDO PASSADO
      console.log('📝 Gerando nome da proposta com:');
      console.log('   - frete:', dadosParaNome.resultado.frete);
      console.log('   - acrescimo:', dadosParaNome.resultado.acrescimo);
      console.log('   - desconto:', dadosParaNome.resultado.desconto);

      const nomeGerado = montarNomePropostaArquivo(dadosParaNome);
      console.log('📄 Nome gerado:', nomeGerado);

      if (nomeGerado && nomeGerado !== 'Proposta - Projeto Solar') {
        nomeProposta = nomeGerado;
      }
    }
  } catch(e) {
    console.warn('Erro ao gerar nome da proposta:', e);
    nomeProposta = dados.cliente?.nome
      ? `Proposta - ${dados.cliente.nome}`
      : 'Proposta - Projeto Solar';
  }

  // 🔴 DEBUG FINAL
  console.log('✅ Nome final da proposta:', nomeProposta);

  // ===== RESTANTE DA FUNÇÃO (CONSTRUÇÃO DO HTML) =====
  const estruturaSelecionadaHtml = (struct && temPlacasR) ? `
  <div class="itens-group">
    <h4>Estrutura de Fixação</h4>
    <div class="struct-pick-card">
      <div class="sp-ico">${struct.img ? `<img src="${struct.img}" alt="${struct.label}">` : '<span style="font-size:26px">🏗️</span>'}</div>
      <div>
        <div class="sp-label">${struct.tipo || 'Estrutura'}</div>
        <div class="sp-title">${struct.label}</div>
        ${struct.descricao ? `<div style="font-size:11px;color:#6B5C4C;margin-top:2px;">${struct.descricao}</div>` : ''}
      </div>
    </div>
  </div>` : '';

  const temCronograma = temGeracaoSolar;
  const validadeDias = dados.validadeDias || 7;

  const cronogramaHtml = temCronograma ? `
    <div>
      <div class="section-bar2" style="margin:0 0 14px"><span class="title" style="font-size:20px">Cronograma</span></div>
      <div class="crono-grid">
        <div class="crono-item"><div class="cn">1</div><div class="ct">Orçamento</div></div>
        <div class="crono-item"><div class="cn">2</div><div class="ct">Assinatura do contrato</div></div>
        <div class="crono-item"><div class="cn">3</div><div class="ct">Emissão de documentos</div><div class="ctime">Até 7 dias</div></div>
        <div class="crono-item"><div class="cn">4</div><div class="ct">Entrega dos equipamentos</div><div class="ctime">Até 20 dias após faturamento</div></div>
        <div class="crono-item"><div class="cn">5</div><div class="ct">Projeto e aprovação</div><div class="ctime">Até 30 dias</div></div>
        <div class="crono-item"><div class="cn">6</div><div class="ct">Instalação</div><div class="ctime">Até 14 dias após chegada</div></div>
        <div class="crono-item"><div class="cn">7</div><div class="ct">Vistoria da concessionária</div><div class="ctime">Até 15 dias após instalação</div></div>
        <div class="crono-item"><div class="cn">8</div><div class="ct">Sistema operando</div><div class="ctime">Até 7 dias após vistoria</div></div>
      </div>
    </div>` : '';

  const condicoesFinaisHtml = `
  <div class="two-col-eq" ${temCronograma ? '' : 'style="margin-top:18px"'}>
    <div>
      <div class="section-bar2" style="margin:0 0 14px"><span class="title" style="font-size:20px">Benefícios</span></div>
      <div class="benefit-item"><span class="ck">✓</span><span>A geração de energia solar <b>não está associada</b> à emissão de poluentes.</span></div>
      <div class="benefit-item"><span class="ck">✓</span><span>Retorno do valor investido em até <b>3 anos</b>.</span></div>
      <div class="benefit-item"><span class="ck">✓</span><span><b>Baixo custo</b> de manutenção.</span></div>
      <div class="benefit-item"><span class="ck">✓</span><span><b>Economia</b> direta na conta de energia.</span></div>
    </div>
    <div>
      <div class="section-bar2" style="margin:0 0 14px"><span class="title" style="font-size:20px">Responsabilidades</span></div>
      <div class="resp-sub">Contratante</div>
      <ul class="resp-list"><li>Fornecer o projeto referente à construção civil, se existir.</li><li>Fornecer todos os desenhos e informações necessárias.</li></ul>
      <div class="resp-sub">Contratada</div>
      <ul class="resp-list"><li>Executar o serviço no tempo proposto, seguindo as normas vigentes no Brasil.</li></ul>
    </div>
  </div>
  <div class="legis-box">
    <h4>Legislação</h4>
    <p>O serviço proposto neste documento será elaborado com base na legislação vigente, nas normas e especificações da ABNT e nas normas do Ministério do Trabalho, mais precisamente a NR-10.</p>
  </div>
  <div class="validity-box">A proposta terá validade de até <b>${validadeDias} dias</b>, a partir da data de apresentação.</div>
  <div class="sign-block">
    <p style="margin-bottom:20px">Imperatriz, ${dados.dataProposta}.</p>
    <p class="name">${dados.engenheiro.nome}</p>
    ${dados.engenheiro.papeis.map(r=>`<p>${r}</p>`).join('')}
  </div>
  ${dados.codigoProposta ? `<div class="prop-code-footer">${dados.codigoProposta}</div>` : ''}`;

  const paginaFinalHtml = temCronograma ? `
<div class="page" id="page5">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="section-bar"><span class="title">Informações</span><span class="sub">${(struct && temPlacasR) ? struct.label : 'Condições e Cronograma'}</span></div>
  ${(struct && temPlacasR) ? `
  <div class="section-bar2"><span class="title" style="font-size:20px">Estrutura de Fixação</span></div>
  <div class="struct-example">${struct.img ? `<img src="${struct.img}" alt="${struct.label}">` : ''}</div>
  <div class="struct-caption">Ilustração de referência — ${struct.label.toLowerCase()}</div>` : ''}
  <div class="two-col">
    <div>
      <div class="section-bar2" style="margin:0 0 14px"><span class="title" style="font-size:20px">Garantias</span></div>
      ${renderGarantiasHtml(dados.garantias)}
    </div>
    ${cronogramaHtml}
  </div>
</div>

<div class="page" id="page6">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  ${condicoesFinaisHtml}
</div>` : `
<div class="page" id="page5">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="section-bar"><span class="title">Informações</span><span class="sub">Condições Gerais</span></div>
  <div class="section-bar2"><span class="title" style="font-size:20px">Garantias</span></div>
  <div class="garantia-wrap">${renderGarantiasHtml(dados.garantias)}</div>
  ${condicoesFinaisHtml}
</div>`;

  const navEstruturaHtml = `<a href="#page5">Informações</a>`;
  const navLegislacaoHtml = temCronograma ? `<a href="#page6">Legislação</a>` : '';
  const navPaybackHtml = temGeracaoSolar ? `<a href="#page3">Payback</a>` : '';
  const navFinanciamentoHtml = temGeracaoSolar ? `<a href="#page4">Financiamento</a>` : '';

  const itensPlacaHtml = renderItensGroupProp('Placas Solares', dados.itensPlaca, 'placa',
    p=>`${p.marca||''} ${p.potencia||0}W ${p.tipo||''}`.trim(),
    p=>`${p.outros ?`· ${p.outros}`:''}`);

  const itensInversorHtml = renderItensGroupProp('Inversores', dados.itensInversor, 'inversor',
    p=>`${p.marca||''} ${(p.potencia/1000)||0}kW ${p.fase||''} `.trim(),
    p=>`${p.tipo||''} · ${p.tensao||0}V ${p.outros ?`· ${p.outros}`:''}`);

  const itensBateriaHtml = renderItensGroupProp('Baterias', dados.itensBateria, 'bateria',
    p=>p.nome||'Bateria',
    p=>`${p.tipo||''} · ${p.capacidade||'-'}Ah`);

  const itensOutrosHtml = renderItensGroupProp('Outros Equipamentos', dados.itensOutros, 'outros',
    p=>`${p.nome||''} ${p.modelo||''}`.trim(),
    p=>`${p.categoria||''} ${p.descricao ?`· ${p.descricao}`:''}`);

  const colunasVisiveis = getColunasVisiveis();
  const materiaisHtml = (dados.itensMateriais && dados.itensMateriais.length) ? `
    <div class="itens-group">
      <h4>Materiais Diversos e Serviços</h4>
      <table class="mat-table">
        <thead>
          <tr>
            ${colunasVisiveis.descricao !== false ? `<th>Descrição</th>` : ''}
            ${colunasVisiveis.qtd !== false ? `<th class="num">Qtd.</th>` : ''}
            ${colunasVisiveis.unidade !== false ? `<th class="num">Uni.</th>` : ''}
            ${colunasVisiveis.valorUnit !== false ? `<th class="num">Valor Unit.</th>` : ''}
            ${colunasVisiveis.total !== false ? `<th class="num">Subtotal</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${dados.itensMateriais
            .filter(m => m.mostrarProposta !== false)
            .map(m => {
              const qtd = m.qtd || 1;
              const valorUnit = m.valorUnit || 0;
              return `<tr>
                ${colunasVisiveis.descricao !== false ? `<td>${m.descricao}</td>` : ''}
                ${colunasVisiveis.qtd !== false ? `<td class="num">${formatarNumero(qtd, qtd%1===0?0:2)}</td>` : ''}
                ${colunasVisiveis.unidade !== false ? `<td class="num">${m.unidade || 'UNI'}</td>` : ''}
                ${colunasVisiveis.valorUnit !== false ? `<td class="num">${fmtMoedaProp(valorUnit)}</td>` : ''}
                ${colunasVisiveis.total !== false ? `<td class="num">${fmtMoedaProp(qtd * valorUnit)}</td>` : ''}
              </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>` : '';

  const pagamentoHtml = dados.formasPagamento ? `
    <div class="note-grid">
      <div class="note-card"><h5>Forma de pagamento</h5><p>${dados.formasPagamento.opcoes}</p></div>
      <div class="note-card"><h5>Pagamento à vista</h5><p>${dados.formasPagamento.aVista}</p></div>
      <div class="note-card" style="grid-column:1/-1"><h5>Observação</h5><p>${dados.formasPagamento.observacao}</p></div>
    </div>` : '';

  const financas = dados.financiamento || { bancos: [], ativas: [1, 2, 3, 4], entrada_percentual: 0, carencia_meses: 3 };
  const bancosAtivos = financas.bancos || [];

  const entradaValor = dados.valorTotal * (financas.entrada_percentual / 100);
  const valorFinanciado = dados.valorTotal - entradaValor;

  // 🔴 NOVO LAYOUT EXECUTIVO: 1 banco = hero premium; 2 = dois cards;
  // 3 = dois cards + um horizontal; 4 = quadro comparativo executivo
  // com selo "Melhor Opção" automático. Ver renderFinanciamentoBancosHtml().
  const bancosHtml = renderFinanciamentoBancosHtml(bancosAtivos);

  const finTopHtml = `
    <div class="fin-top">
      <div class="fin-box">
        <div class="fl">Entrada (${financas.entrada_percentual || 0}%)</div>
        <div class="fv">${fmtMoedaProp(entradaValor)}</div>
      </div>
      <div class="fin-box">
        <div class="fl">Valor financiado</div>
        <div class="fv">${fmtMoedaProp(valorFinanciado)}</div>
      </div>
      <div class="fin-box">
        <div class="fl">Carência</div>
        <div class="fv">${financas.carencia_meses || 3} meses</div>
      </div>
    </div>
  `;

  const finDetailHtml = `
    <div class="fin-note" style="margin:16px 40px 0;padding:10px 14px;background:var(--light-gray);border-radius:6px;text-align:center;">
      Os valores e taxas apresentados na simulação podem variar conforme o CPF/CNPJ de cada cliente.
    </div>
  `;

  const paybackPageHtml = temGeracaoSolar ? `
<div class="page" id="page3">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="section-bar"><span class="title">Payback</span><span class="sub">Retorno do Investimento</span></div>
  <div class="inv-grid">
    <div class="inv-row"><span class="label">Valor do investimento</span><span class="val">${fmtMoedaProp(dados.payback.investimento)}</span></div>
    <div class="inv-row"><span class="label">Retorno em 30 anos</span><span class="val" id="pbRetorno30">—</span></div>
  </div>
  <div class="pb-metrics">
    <div class="pb-metric"><div class="pl">Payback (meses)</div><div class="pv" id="pbMeses">—</div></div>
    <div class="pb-metric"><div class="pl">Payback (anos)</div><div class="pv" id="pbAnos">—</div></div>
  </div>
  <div class="pb-rows">
    <div class="pb-row"><span>Valor médio da conta de energia mensal</span><span class="rv">${fmtMoedaProp(dados.payback.contaMediaMensal)}</span></div>
    <div class="pb-row"><span>Rentabilidade a.a.</span><span class="rv">${(dados.payback.rentabilidadeAA*100).toFixed(2).replace('.',',')}%</span></div>
    <div class="pb-row"><span>Aumento na conta de energia a.a.</span><span class="rv">${(dados.payback.aumentoContaAA*100).toFixed(2).replace('.',',')}%</span></div>
    <div class="pb-row"><span>Simultaneidade</span><span class="rv">${(dados.payback.simultaneidade*100).toFixed(2).replace('.',',')}%</span></div>
  </div>
  <div class="chart-wrap"><h3>Economia Anual Acumulada (R$/ano)</h3><canvas id="paybackChart" height="200"></canvas></div>
</div>` : '';

  const financiamentoPageHtml = temGeracaoSolar ? `
<div class="page" id="page4">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="section-bar"><span class="title">Financiamento</span><span class="sub">Propostas de Bancos e Financeiras</span></div>

  <!-- TOPO -->
  ${finTopHtml}

  <!-- BANCOS (layout executivo: hero / duplo / duplo+horizontal / comparativo) -->
  ${bancosHtml}

  <!-- RODAPÉ -->
  ${finDetailHtml}
</div>` : '';

  // 🔴 RETORNA O HTML COMPLETO COM O TÍTULO CORRETO
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>${nomeProposta}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"><\/script>
<style>
${propostaBaseCss()}
${propostaPagedCss()}
</style>
${propostaPagedLoader()}
</head><body>
<nav>
  <a href="#page1" class="active">Capa</a>
  <a href="#page2">Itens</a>
  ${navPaybackHtml}
  ${navFinanciamentoHtml}
  ${navEstruturaHtml}
  ${navLegislacaoHtml}
</nav>

<!-- PAGE 1: CAPA -->
<div class="page" id="page1">
  ${wm}
  ${capaHtml}
</div>

<!-- PAGE 2: ITENS -->
<div class="page" id="page2">
  ${wm}
  <div class="running-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="logo-header"><img src="${LOGO_PADRAO_URL}" alt="Rocha Engenharia"></div>
  <div class="section-bar"><span class="title">Itens do Orçamento</span><span class="sub">Kit Solar</span></div>
 ${temGeracaoSolar ? `<div class="gen-bar">Geração média mensal projetada: <div class="gen-bar-valor">${formatarNumero(dados.geracaoExibida || dados.geracaoMediaMensal || 0, 0)} kWh</div></div>` : ''}
  ${itensPlacaHtml}
  ${itensInversorHtml}
  ${estruturaSelecionadaHtml}
  ${itensBateriaHtml}
  ${itensOutrosHtml}
  ${materiaisHtml}
  <div class="price-banner"><span class="por">Valor total</span><span class="value">${fmtMoedaProp(dados.valorTotal)}</span></div>
  ${pagamentoHtml}
</div>

<!-- PAGE 3: PAYBACK -->
${paybackPageHtml}

<!-- PAGE 4: FINANCIAMENTO DINÂMICO - LAYOUT EXECUTIVO -->
${financiamentoPageHtml}

<!-- PAGE 5/6: GARANTIAS, CRONOGRAMA (se ongrid/híbrido) E CONDIÇÕES FINAIS -->
${paginaFinalHtml}

<script>
(function(){
  // 🔴 FIX 3.2: o desenho do gráfico foi isolado numa função nomeada
  // (window.__renderPaybackChart) e NÃO é mais chamado aqui direto.
  // Quem dispara essa função é o hook window.PagedConfig.after (ver
  // propostaPagedLoader), garantindo que o Paged.js já terminou de
  // clonar/paginar o documento antes de qualquer pixel ser desenhado
  // no canvas — senão o clone que vai pra página final fica em branco.
  window.__paybackChartDrawn = false;

  function getPaybackCanvas(){
    var scoped = document.querySelector('.pagedjs_pages canvas#paybackChart');
    if (scoped) return scoped;
    return document.getElementById('paybackChart');
  }

  // No script do gráfico (proposta-completa.js)
window.__renderPaybackChart = function(){
  if (window.__paybackChartDrawn) return;
  var pbCanvas = getPaybackCanvas();
  if (!pbCanvas) return;

  var d = ${JSON.stringify(dados.payback)};
  var labels = [], serie = [];
  var investimento = d.investimento || 0;
  var contaMensal = d.contaMediaMensal || 0;
  var aumentoAA = d.aumentoContaAA || 0.1;
  var simultaneidade = d.simultaneidade || 0.75;

  var cum = 0;
  var mesesPayback = null;
  var cumMensal = 0;

  // 🔴 CORREÇÃO: economia com reajuste, mas SOMA SIMPLES
  for(var y=1; y<=30; y++){
    // Conta anual com reajuste
    var contaAnual = contaMensal * 12 * Math.pow(1 + aumentoAA, y - 1);
    // Economia anual (só a parte que economiza)
    var economiaAno = contaAnual * simultaneidade;
    
    // 🔴 SOMA SIMPLES - sem juros compostos
    cum += economiaAno;
    
    // Calcula payback (com crescimento mensal)
    for(var m=1; m<=12 && mesesPayback === null; m++){
      var contaMes = (contaAnual / 12) * (1 + aumentoAA * ((m-1)/12));
      var economiaMes = contaMes * simultaneidade;
      cumMensal += economiaMes;
      if(cumMensal >= investimento){
        mesesPayback = (y - 1) * 12 + m;
      }
    }
    
    labels.push(y);
    serie.push(parseFloat(cum.toFixed(2)));
  }

  var fmt = function(v){
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
  };

  var elRetorno = document.querySelector('.pagedjs_pages #pbRetorno30') || document.getElementById('pbRetorno30');
  var elMeses = document.querySelector('.pagedjs_pages #pbMeses') || document.getElementById('pbMeses');
  var elAnos = document.querySelector('.pagedjs_pages #pbAnos') || document.getElementById('pbAnos');
  
  if (elRetorno) elRetorno.textContent = fmt(cum);
  if (elMeses) elMeses.textContent = (mesesPayback || '—') + ' MESES';
  if (elAnos) elAnos.textContent = mesesPayback ? (mesesPayback/12).toFixed(1).replace('.',',') + ' ANOS' : '—';

  window.__paybackChartDrawn = true;

  var ctx = pbCanvas.getContext('2d');
  new Chart(ctx, {
    type:'bar',
    data:{
      labels:labels,
      datasets:[{
        data:serie,
        backgroundColor:serie.map(function(v){return v < investimento ? '#E6E0D5' : '#E8672B';}),
        borderRadius:2
      }]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            label:function(c){return fmt(c.raw);}
          }
        }
      },
      scales:{
        y:{
          ticks:{
            callback:function(v){return 'R$ '+(v/1000).toFixed(0)+'k';},
            font:{size:10}
          },
          grid:{color:'#E6E0D5'}
        },
        x:{ grid:{display:false} }
      }
    }
  });
};

  // Fallback: se o Paged.js não carregar (ex: sem internet / CDN
  // bloqueado), o hook window.PagedConfig.after nunca dispara — então,
  // depois de 6s sem gráfico desenhado, desenha direto no canvas
  // "normal" (visão em tela, sem paginação), igual era no 3.0. Isso
  // garante que o gráfico NUNCA fica ausente, com ou sem Paged.js.
  setTimeout(function(){ window.__renderPaybackChart(); }, 6000);

  var links = document.querySelectorAll('nav a');
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        links.forEach(function(a){a.classList.remove('active');});
        var l=document.querySelector('nav a[href="#'+e.target.id+'"]');
        if(l) l.classList.add('active');
      }
    });
  }, { threshold:.4 });
  document.querySelectorAll('.page').forEach(function(p){obs.observe(p);});
})();
<\/script>
</body></html>`;
}
window.renderPropostaCompletaHTML = renderPropostaCompletaHTML;
// ============================================================
// FUNÇÃO: CÓDIGO DE PROPOSTA (controle interno)
// Formato: [ID do vendedor][DIA][MÊS][ANO 2 díg][HORA][MIN][SEG]
// Ex.: vendedor 01, 13/07/26 12:38:59 -> 01130726123859
// Gerado UMA VEZ por proposta e reaproveitado em qualquer reabertura/
// reimpressão (nunca é regerado para o mesmo orçamento salvo).
// ============================================================
function gerarCodigoProposta(vendedor){
  const pad2 = n => String(n).padStart(2, '0');
  const idVendedor = vendedor?.codigo
    ? String(vendedor.codigo).trim().padStart(2, '0').slice(-2)
    : pad2(vendedor?.id || 0);
  const d = new Date();
  return `${idVendedor}${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${pad2(d.getFullYear() % 100)}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}
window.gerarCodigoProposta = gerarCodigoProposta;

// ============================================================
// FUNÇÃO: ABRIR PROPOSTA COMPLETA (VERSÃO CORRIGIDA E SIMPLIFICADA)
// ============================================================
async function abrirPropostaCompleta(data){
  // 🔴 GARANTE QUE O RESULTADO EXISTA
  if (!data.resultado) data.resultado = {};

  // 🔴 BUSCA OS VALORES DOS INPUTS (SEMPRE OS MAIS ATUAIS)
  const elFrete = document.getElementById('pFrete');
  const elAcrescimo = document.getElementById('pAcrescimo');
  const elDesconto = document.getElementById('pDesconto');

  // 🔴 ATUALIZA COM OS VALORES DOS INPUTS (SOBRESCREVE QUALQUER VALOR ANTERIOR)
  data.resultado.frete = elFrete ? parseMoney(elFrete.value) || 0 : 0;
  data.resultado.acrescimo = elAcrescimo ? parseMoney(elAcrescimo.value) || 0 : 0;
  data.resultado.desconto = elDesconto ? parseMoney(elDesconto.value) || 0 : 0;

  // 🔴 ATUALIZA OS.resultado TAMBÉM
  if (!OS.resultado) OS.resultado = {};
  OS.resultado.frete = data.resultado.frete;
  OS.resultado.acrescimo = data.resultado.acrescimo;
  OS.resultado.desconto = data.resultado.desconto;

  // 🔴 DEBUG
  console.log('📊 abrirPropostaCompleta - valores:');
  console.log('   - frete:', data.resultado.frete);
  console.log('   - acrescimo:', data.resultado.acrescimo);
  console.log('   - desconto:', data.resultado.desconto);

  // 🔴 VALIDA SE TEM VALOR PARA GERAR PROPOSTA
  if(!data.resultado || data.resultado.totalGeral <= 0){
    toast('Preencha o "Valor Fornecedor" no orçamento antes de gerar a proposta (nenhum item tem preço próprio — o valor do kit vem desse campo)', 'warning');
    return;
  }

  const salvarHistorico = data.salvarHistorico !== false;

  const vendedorComCodigo = data.vendedor || OS.vendedor || null;
  if (vendedorComCodigo && !vendedorComCodigo.codigo) {
    vendedorComCodigo.codigo = String(vendedorComCodigo.id).padStart(2, '0');
  }

  // 🔴 Código de controle interno da proposta
  const codigoProposta = data.codigoProposta || gerarCodigoProposta(vendedorComCodigo);

  const dadosParaHistorico = {
    itensPlaca: JSON.parse(JSON.stringify(data.itensPlaca || OS.itensPlaca || [])),
    itensInversor: JSON.parse(JSON.stringify(data.itensInversor || OS.itensInversor || [])),
    itensBateria: JSON.parse(JSON.stringify(data.itensBateria || OS.itensBateria || [])),
    itensOutros: JSON.parse(JSON.stringify(data.itensOutros || OS.itensOutros || [])),
    itensMateriais: JSON.parse(JSON.stringify(data.itensMateriais || OS.itensMateriais || [])),
    cliente: data.cliente || OS.cliente || null,
    vendedor: vendedorComCodigo,
    estrutura: data.estrutura || OS.estrutura || null,
    resultado: data.resultado || OS.resultado || {},
    codigoProposta: codigoProposta,
    salvarHistorico: salvarHistorico
  };

  OS.propostaConfig.vendedor = dadosParaHistorico.vendedor || OS.vendedor || null;
  OS.propostaConfig.estrutura = dadosParaHistorico.estrutura || OS.estrutura || null;

  const cfgGlobal = await carregarPropostaConfigMesclada();
  const cfg = {
    ...cfgGlobal,
    ...OS.propostaConfig,
    marca_dagua_ativa: OS.propostaConfig.marcaDagua !== false,
  };

  const dados = montarDadosProposta(dadosParaHistorico, cfg);
  const html = renderPropostaCompletaHTML(dados);
  const blob = new Blob([html], { type:'text/html' });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, '_blank');

  if (win) {
    aguardarPagedJsEPreparar(win);
  }

  if (salvarHistorico && typeof salvarOrcamentoHistorico === 'function') {
    setTimeout(async () => {
      try {
        await salvarOrcamentoHistorico(dadosParaHistorico);
      } catch(e) {
        console.warn('Erro ao salvar histórico:', e);
      }
    }, 100);
  }
}
window.abrirPropostaCompleta = abrirPropostaCompleta;

// ============================================================
// FUNÇÃO: MONTAR NOME DO ARQUIVO DA PROPOSTA (COM DEBUG)
// ============================================================
function montarNomePropostaArquivo(data){
  // 🔴 DEBUG: MOSTRA O QUE ESTÁ CHEGANDO
  console.log('🔍 montarNomePropostaArquivo recebeu:');
  console.log('   - data.resultado:', data.resultado);
  console.log('   - frete:', data.resultado?.frete);
  console.log('   - acrescimo:', data.resultado?.acrescimo);
  console.log('   - desconto:', data.resultado?.desconto);

  const r = data.resultado || {};

  const temPlacas = data.itensPlaca && data.itensPlaca.length > 0;
  const temInversores = data.itensInversor && data.itensInversor.length > 0;
  const temBaterias = data.itensBateria && data.itensBateria.length > 0;
  const temEquipamentoSolar = temPlacas || temInversores || temBaterias;

  const cod = data.vendedor?.codigo ? String(data.vendedor.codigo).trim().padStart(2, '0') : 'XX';

  const dataStr = new Date().toLocaleDateString('pt-BR').split('/').join('.');

  if (!temEquipamentoSolar) {
    return `${cod} - ORÇAMENTO MATERIAL E SERVIÇOS - ${dataStr}`;
  }

  const p = data.itensPlaca[0]?.placa;
  const marcaPlaca = p?.marca || '';
  const tipoPlaca = p?.tipo || '';
  const potW = p?.potencia || '';
  const gerKwh = data.geracaoExibida || data.geracaoMediaMensal || Math.round(r.geracaoReal || 0);

  const qtdInvTotal = data.itensInversor.reduce((a, i) => a + (i.qtd || 0), 0);
  const blocoQtdInv = qtdInvTotal > 1 ? `${qtdInvTotal}X ` : '';
  const i0 = data.itensInversor[0]?.inversor;
  const marcaInv = i0?.marca || '';
  const tipoInv = i0?.tipo || '';
  const potInv2 = i0?.potencia ? `${(i0.potencia / 1000 )}KW` : '';

  let blocoEstrutura = '';
  const nomeEstrutura = data.estrutura?.nome || '';
  const idEstrutura = data.estrutura?.id || null;

  const estruturasPadrao = _estruturasCache || [];
  const estruturaPadrao = estruturasPadrao.find(e => e.id == _configGlobal?.estrutura_padrao_id);

  if (nomeEstrutura && idEstrutura && estruturaPadrao) {
    const isEstruturaPadrao = idEstrutura == estruturaPadrao.id;
    if (!isEstruturaPadrao) {
      blocoEstrutura = ` - ${nomeEstrutura.toUpperCase()}`;
    }
  } else if (nomeEstrutura && !estruturaPadrao) {
    blocoEstrutura = ` - ${nomeEstrutura.toUpperCase()}`;
  }

  // ===== CONSTRÓI STRING DE ADICIONAIS =====
  let extras = '';
  // 🔴 GARANTE QUE OS VALORES SÃO NÚMEROS
  const frete = parseFloat(r.frete) || 0;
  const acrescimo = parseFloat(r.acrescimo) || 0;
  const desconto = parseFloat(r.desconto) || 0;

  const temFrete = frete > 0;
  const temAcrescimo = acrescimo > 0;
  const temDesconto = desconto > 0;

  // 🔴 DEBUG DOS VALORES
  console.log('💰 Valores dos extras:');
  console.log('   - frete:', frete, '→', temFrete ? '+' : '');
  console.log('   - acrescimo:', acrescimo, '→', temAcrescimo ? '+' : '');
  console.log('   - desconto:', desconto, '→', temDesconto ? '-' : '');

  if (temFrete || temAcrescimo || temDesconto) {
    let simbolos = '';
    if (temFrete) simbolos += '+';
    if (temAcrescimo) simbolos += '+';
    if (temDesconto) simbolos += '-';
    extras = ` ${simbolos}`;
    console.log('🔤 Símbolos gerados:', simbolos);
    console.log('📝 Extras final:', extras);
  }

  const nome = `${cod} - ORÇAMENTO ${marcaPlaca} ${tipoPlaca} ${potW}W ${gerKwh}KWH - ${blocoQtdInv} ${tipoInv} ${marcaInv} ${potInv2} - ${dataStr}${extras}`;

  console.log('📄 Nome final gerado:', nome);

  return String(nome).replace(/[\\/:*?"<>|]/g,'').trim();
}
window.montarNomePropostaArquivo = montarNomePropostaArquivo;

console.log('%c⚡ Solar Pro 2.0 — proposta-completa.js v3.3 (financiamento executivo + logo do banco) carregado', 'color:#ffb020;font-weight:bold');
