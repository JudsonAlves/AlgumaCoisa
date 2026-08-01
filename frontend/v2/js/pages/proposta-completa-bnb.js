// ============================================================
// SOLAR PRO 2.0 — pages/proposta-completa-bnb.js
// Proposta técnica completa no FORMATO BNB (Banco do Nordeste),
// gerada 100% a partir dos dados reais do orçamento.
//
// Este arquivo é um COMPANHEIRO do proposta-completa.js — reaproveita
// (via `typeof` guard, com fallback local) as funções e o CSS-base já
// existentes: propostaBaseCss(), propostaPagedCss(), propostaPagedLoader(),
// aguardarPagedJsEPreparar(), renderGarantiasHtml(), itemCardProp(),
// fmtMoedaProp(), LOGO_PADRAO_URL, Calc, getCapaById(), etc.
// Se este arquivo for carregado ANTES do proposta-completa.js, ou sozinho,
// os fallbacks locais garantem que ele funciona de forma independente.
//
// DIFERENÇA em relação à proposta "comercial" (proposta-completa.js):
// aquela é uma peça de VENDA (capa gráfica, cards de itens, financiamento
// bancário, cronograma). Esta é o LAUDO TÉCNICO/JUSTIFICATIVA no formato
// exigido pelo BNB para análise de crédito/financiamento do projeto:
// identificação do cliente e da UC, memória de cálculo da redução da
// conta, justificativa técnica do kit dimensionado, payback com fórmula
// explícita, prazo de execução, histórico de consumo x geração (tabela
// mês a mês), potência do gerador (tabela técnica), método de instalação,
// posição/inclinação solar, normas/certificações INMETRO dos equipamentos,
// garantias e o orçamento detalhado (materiais + serviço + valor total).
//
// Todas as seções abaixo replicam, seção por seção, o conteúdo do modelo
// Word "ORÇAMENTO DE ENERGIA SOLAR" usado hoje manualmente, mas com todos
// os valores calculados/preenchidos dinamicamente a partir do orçamento.
//
// v1.2 — NOVIDADES:
//  - A capa é sempre a MESMA já cadastrada na proposta comercial (nome do
//    cliente NÃO é repetido nela — já está na 1ª folha de identificação).
//  - Dados da empresa ficam na ÚLTIMA folha, ao lado da assinatura do
//    responsável técnico.
//  - Imagens do inversor/painel aparecem ao lado do texto técnico
//    (usa a classe .com-imagem já existente no CSS).
//  - Bloco de "Estrutura de Fixação Selecionada".
//
// v1.3 — CORREÇÕES DESTA VERSÃO:
//  - N° Registro INMETRO: o cadastro de equipamentos (pages/cadastro.js)
//    salva esse dado no campo `inmetro` (placas e inversores), não em
//    `registroInmetro`. O código antigo lia um campo que nunca existia,
//    então sempre caía no placeholder "XXXX" mesmo com o INMETRO já
//    cadastrado. Corrigido para ler `.inmetro` do equipamento, com
//    fallback pra override manual em `cfg` e só então o placeholder.
//  - Endereço do cliente: antes só usava `cliente.endereco` (rua/av.),
//    ignorando número, complemento, bairro, cidade, UF e CEP — que
//    existem como campos separados no cadastro. Nova função
//    montarEnderecoCompletoBNB() monta a string completa formatada
//    (ex.: "Rua Tal, 123, Bairro X, Imperatriz - MA, CEP 65900-000").
// ============================================================

// ---- resolve caminhos relativos (assets/...) para URL absoluta -----------
function assetUrlBNB(caminhoRelativo){
  if (typeof window.assetUrl === 'function') return window.assetUrl(caminhoRelativo);
  try{ return new URL(caminhoRelativo, document.baseURI).href; }
  catch{ return caminhoRelativo; }
}
const LOGO_PADRAO_URL_BNB = window.LOGO_PADRAO_URL || assetUrlBNB('assets/images/logo-rocha.png');

// ---- formatação (reaproveita as globais se existirem) --------------------
function fmtMoedaBNB(v){
  if (typeof window.fmtMoedaProp === 'function') return window.fmtMoedaProp(v);
  return v==null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
}
function fmtNumBNB(v, casas){
  if (typeof window.formatarNumero === 'function') return window.formatarNumero(v, casas ?? 0);
  const n = +v || 0;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas ?? 0, maximumFractionDigits: casas ?? 2 });
}
function fmtPctBNB(v){
  return v==null ? '—' : (+v).toFixed(2).replace('.',',') + '%';
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Placeholder genérico usado sempre que um dado obrigatório ainda não foi
// cadastrado (ex.: número de registro INMETRO, dados cadastrais do cliente).
// Fica visualmente evidente no laudo o que falta preencher, em vez de
// "adivinhar" um valor ou omitir a linha silenciosamente.
const PLACEHOLDER_BNB = 'XXXX';

// Irradiância solar média (kWh/m²/dia) por estado — usada para estimar a
// geração mês a mês do kit "baseado no estado do cliente" (valores médios
// de referência; podem ser sobrescritos via cfg.horasSolAproveitaveis).
const IRRADIANCIA_UF_BNB = {
  MA: 5.35, PI: 5.60, CE: 5.60, RN: 5.80, PB: 5.60, PE: 5.50, AL: 5.40, SE: 5.30, BA: 5.30,
  TO: 5.20, PA: 4.90, AP: 4.80, AM: 4.60, RR: 4.70, RO: 4.80, AC: 4.60,
  MT: 5.10, MS: 5.00, GO: 5.20, DF: 5.20, MG: 5.20, ES: 5.00, RJ: 4.80, SP: 4.80,
  PR: 4.60, SC: 4.30, RS: 4.50
};
function irradianciaPorEstadoBNB(estadoSigla, fallback){
  if(!estadoSigla) return fallback;
  const uf = estadoSigla.toString().trim().toUpperCase().slice(0,2);
  return IRRADIANCIA_UF_BNB[uf] || fallback;
}

// Nome por extenso de cada UF — usado só pra exibir "região" na seção
// "2. Redução Mensal Esperada" de forma coerente com o estado do cliente
// (em vez de sempre mostrar um nome fixo, ver nomeEstadoBNB() e uso em
// montarDadosPropostaBNB → reducaoMensal.regiao).
const NOME_UF_BNB = {
  MA:'Maranhão', PI:'Piauí', CE:'Ceará', RN:'Rio Grande do Norte', PB:'Paraíba', PE:'Pernambuco',
  AL:'Alagoas', SE:'Sergipe', BA:'Bahia', TO:'Tocantins', PA:'Pará', AP:'Amapá', AM:'Amazonas',
  RR:'Roraima', RO:'Rondônia', AC:'Acre', MT:'Mato Grosso', MS:'Mato Grosso do Sul', GO:'Goiás',
  DF:'Distrito Federal', MG:'Minas Gerais', ES:'Espírito Santo', RJ:'Rio de Janeiro', SP:'São Paulo',
  PR:'Paraná', SC:'Santa Catarina', RS:'Rio Grande do Sul'
};
function nomeEstadoBNB(estadoSigla){
  if(!estadoSigla) return null;
  const uf = estadoSigla.toString().trim().toUpperCase().slice(0,2);
  return NOME_UF_BNB[uf] || estadoSigla;
}

// Gera os rótulos dos últimos N meses terminando no mês ANTERIOR ao atual
// (ex.: hoje em julho → último mês da lista é junho, o mais antigo fica no
// topo). Índice 0 = mês mais antigo, último índice = mês anterior ao atual.
function gerarMesesHistoricoBNB(qtd){
  const hoje = new Date();
  const labels = [];
  for(let i = qtd; i >= 1; i--){
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    labels.push(MESES_PT[d.getMonth()].toUpperCase());
  }
  return labels;
}

// ============================================================
// v1.3: ENDEREÇO COMPLETO DO CLIENTE
// O cadastro de Clientes (pages/cadastro.js) salva o endereço em campos
// separados: endereco (rua/av.), numero, complemento, bairro, cidade,
// estado (UF) e cep. Esta função monta a string completa formatada pra
// exibir na "1. Identificação" do laudo BNB, em vez de mostrar só a rua.
// cfg.clienteEndereco continua funcionando como override manual (ex.:
// laudo avulso sem cliente cadastrado no sistema).
// ============================================================
function montarEnderecoCompletoBNB(cliente, cfg){
  if (cfg?.clienteEndereco) return cfg.clienteEndereco;
  if (!cliente) return null;

  const partes = [];

  if (cliente.endereco) {
    let linha = cliente.endereco;
    if (cliente.numero) linha += `, ${cliente.numero}`;
    partes.push(linha);
  }
  if (cliente.complemento) partes.push(cliente.complemento);
  if (cliente.bairro) partes.push(cliente.bairro);

  const cidadeUf = [cliente.cidade, cliente.estado].filter(Boolean).join(' - ');
  if (cidadeUf) partes.push(cidadeUf);

  if (cliente.cep) partes.push(`CEP ${cliente.cep}`);

  return partes.length ? partes.join(', ') : null;
}

// ============================================================
// FUNÇÃO: MONTAR DADOS DA PROPOSTA BNB
// Recebe o mesmo "data" usado na proposta comercial (cliente, itens,
// resultado) + "config" com os campos técnicos específicos do laudo
// (região, histórico de consumo, método de instalação etc.), todos
// com valores padrão sensatos para nunca quebrar caso não informados.
// ============================================================
function montarDadosPropostaBNB(data, config){
  const r = data.resultado || {};
  const cfg = config || {};

  // ---------- 1. IDENTIFICAÇÃO ----------
  const cliente = data.cliente || {};
  const identificacao = {
    nome: cliente.nome || PLACEHOLDER_BNB,
    // v1.3: endereço completo (rua, número, complemento, bairro, cidade/UF, CEP)
    endereco: montarEnderecoCompletoBNB(cliente, cfg) || PLACEHOLDER_BNB,
    unidadeConsumidora: cliente.unidadeConsumidora || cfg.unidadeConsumidora || PLACEHOLDER_BNB
  };

  // ---------- EMPRESA (exibida na ÚLTIMA folha, ao lado da assinatura —
  // a capa é a mesma já cadastrada na proposta comercial e não repete
  // esses dados) ----------
  const empresa = {
    nomeFantasia: cfg.empresa?.nomeFantasia || 'Rocha Engenharia',
    razaoSocial: cfg.empresa?.razaoSocial || 'JUAN FRANCISCO GABRIEL ROCHA DE SOUSA',
    cnpj: cfg.empresa?.cnpj || '32.014.162/0001-75',
    endereco: cfg.empresa?.endereco || 'RUA BENEDIDO LEITE, N° 994D, CENTRO, IMPERATRIZ - MA',
    cidade: cfg.empresa?.cidade || 'IMPERATRIZ'
  };

  // ---------- CAPA (reaproveita o MESMO template/dados já cadastrados na
  // proposta comercial — proposta-completa.js — em vez de uma capa própria.
  // O nome do cliente NÃO é passado aqui de propósito: a capa gráfica é
  // genérica/institucional, o nome do cliente já aparece na seção
  // "1. Identificação" da primeira folha de conteúdo) ----------
  const capaTemplateId = cfg.capa_template_id || 'diagonal_classica';
  const capaDados = (typeof window.montarDadosCapa === 'function')
    ? window.montarDadosCapa(cfg, {
        vendedorNome: (data.vendedor || cfg.vendedor)?.nome || null
      })
    : { subtitulo: 'Orçamento de Energia Solar' };

  // ---------- POTÊNCIA DO GERADOR (kWp real do kit) ----------
  const kwpKit = (data.itensPlaca || []).reduce((acc, it) => {
    const pot = (it.placa?.potencia || 0) * (it.qtd || 0);
    return acc + pot;
  }, 0) / 1000;

  // ---------- INPUTS DE FÓRMULA (kWp, irradiância, dias de sol, tarifa) ----------
  // Ficam disponíveis cedo porque alimentam tanto a geração estimada quanto o
  // histórico de consumo mais abaixo. O "consumo médio" e os objetos finais de
  // Potência do Gerador / Redução Mensal só são fechados DEPOIS do histórico,
  // pois preferem a média real apurada na tabela de consumo do cliente.
  //
  // v1.4 — CORREÇÃO: a irradiância (horasSol) agora é a MESMA em todo o
  // documento. Antes, "Redução Mensal Esperada" / "Potência do Gerador" /
  // "Payback" / "Justificativa do Kit" usavam um valor fixo (cfg.horasSolAproveitaveis
  // ou 5.50 de fallback), enquanto a tabela "Histórico de Consumo" calculava a
  // geração de cada mês com a irradiância REAL do estado do cliente — dois
  // números de geração DIFERENTES para o mesmo kit apareciam no mesmo laudo.
  // Agora horasSol já nasce baseado no estado do cliente (com
  // cfg.horasSolAproveitaveis como override manual, quando informado
  // explicitamente), e todo o resto do documento reaproveita esse único valor.
  const estadoCliente = cliente.estado || cfg.regiaoUF || null;
  const horasSol = cfg.horasSolAproveitaveis != null
    ? +cfg.horasSolAproveitaveis
    : irradianciaPorEstadoBNB(estadoCliente, 5.50); // kWh/m²/dia — real do estado do cliente, fallback 5.50
  const diasSolMes = +cfg.diasSolMes || 21;
  const horasProducaoMes = +(horasSol * diasSolMes).toFixed(2);
  const tarifaComImposto = cfg.tarifaComImposto != null ? +cfg.tarifaComImposto : 1.13; // R$/kWh, valor médio com imposto

  // ---------- 2. REDUÇÃO MENSAL ESPERADA (geração estimada) ----------
  // Fórmula: (kWp do kit) x (kWh/m² da região) x (dias de sol no mês) = geração estimada,
  // multiplicada pela tarifa com imposto = valor médio de redução na conta.
  const geracaoEstimadaKwhMes = +(kwpKit * horasSol * diasSolMes).toFixed(2);
  const economiaMediaMensal = cfg.economiaMediaMensal != null
    ? +cfg.economiaMediaMensal
    : +(geracaoEstimadaKwhMes * tarifaComImposto).toFixed(2);

  // ---------- 6. HISTÓRICO DE CONSUMO (mês a mês) ----------
  // Calculado ANTES da justificativa do kit, pois a justificativa depende
  // do consumo médio real apurado aqui. Só o CONSUMO é dado de entrada
  // (vindo do cadastro do cliente — 12 valores, o mais recente sendo o mês
  // ANTERIOR ao atual, cadastrado em Clientes > Histórico de Consumo). O mês
  // e a geração solar são calculados por fórmula:
  //   - mês: os últimos 12 meses terminando no mês anterior ao atual,
  //     mais antigo no topo, mais recente (mês passado) embaixo.
  //   - geração: kWp do kit × irradiância do ESTADO do cliente × dias de sol,
  //     a mesma fórmula da seção "Redução Mensal Esperada".
  // v1.4: reaproveita a MESMA geração mensal calculada acima (mesmo kWp,
  // mesma irradiância do estado do cliente, mesmos dias de sol) — antes esse
  // valor era recalculado aqui com uma irradiância potencialmente diferente,
  // o que gerava dois números de "geração estimada" distintos no mesmo laudo.
  const geracaoMensalPorEstado = geracaoEstimadaKwhMes;

  // Valores de consumo: cfg.historicoConsumoValores (array, mais antigo primeiro)
  // ou data.cliente.historico_consumo (mesmo formato, vindo do cadastro de
  // Clientes — coluna "Histórico de Consumo" adicionada no cadastro).
  let consumoValores = cfg.historicoConsumoValores || cliente.historico_consumo || [];
  if (typeof consumoValores === 'string') {
    try { consumoValores = JSON.parse(consumoValores); } catch(e) { consumoValores = []; }
  }
  consumoValores = Array.isArray(consumoValores) ? consumoValores : [];

  const mesesLabels = gerarMesesHistoricoBNB(12);
  // Alinha os valores informados aos meses mais recentes (da direita/baixo pra cima),
  // preenchendo com null os meses mais antigos que não tiverem valor cadastrado.
  const consumoAlinhado = Array.from({ length: 12 }, (_, idx) => {
    const posValor = idx - (12 - consumoValores.length);
    const v = posValor >= 0 ? consumoValores[posValor] : null;
    return (v != null && v !== '') ? +v : null;
  });

  const historicoConsumo = mesesLabels.map((mes, idx) => ({
    mes,
    consumoCliente: consumoAlinhado[idx],
    geracaoSolar: geracaoMensalPorEstado // mesma fórmula todo mês (aproximação; não há dado de irradiância mês a mês)
  }));

  const valoresConsumoValidos = historicoConsumo.map(h => h.consumoCliente).filter(v => v != null);
  const historicoCompleto = valoresConsumoValidos.length === 12;
  const totalConsumoHistorico = valoresConsumoValidos.length ? valoresConsumoValidos.reduce((a,v) => a+v, 0) : null;
  const totalGeracaoHistorico = geracaoMensalPorEstado * 12;
  // Consumo médio real = média dos valores efetivamente cadastrados na tabela
  // (usado na Justificativa do Kit e como padrão de "consumo médio" do gerador,
  // a menos que cfg.consumoMedioMensalKwh tenha sido explicitamente informado).
  const consumoMedioHistorico = valoresConsumoValidos.length
    ? +(valoresConsumoValidos.reduce((a,v) => a+v, 0) / valoresConsumoValidos.length).toFixed(0)
    : null;

  // ---------- 7. POTÊNCIA DO GERADOR (tabela técnica, fechada agora) ----------
  // Preferência: valor manual (cfg.consumoMedioMensalKwh) > média real do
  // histórico de consumo > geração desejada informada no orçamento > 0.
  const consumoMedioMes = cfg.consumoMedioMensalKwh != null
    ? +cfg.consumoMedioMensalKwh
    : (consumoMedioHistorico ?? (data.geracaoDesejada || Math.round(r.geracaoReal || 0)));
  const consumoMedioTaxaImposto = consumoMedioMes * tarifaComImposto;
  const potenciaGerador = {
    horasSol, diasSolMes, horasProducaoMes,
    consumoMedioMes, tarifaComImposto, consumoMedioTaxaImposto,
    kwp: kwpKit
  };

  // ---------- 2. REDUÇÃO MENSAL ESPERADA (objeto final) ----------
  const reducaoMensal = {
    // v1.4: usa o estado do cliente por extenso quando cfg.regiaoNome não
    // foi informado manualmente, em vez de um texto fixo desalinhado do
    // cliente real da proposta.
    regiao: cfg.regiaoNome || nomeEstadoBNB(estadoCliente) || 'Maranhão',
    irradiancia: horasSol,
    diasSolMes,
    tarifaComImposto,
    geracaoEstimadaKwhMes,
    valorContaAtual: consumoMedioTaxaImposto,
    valorEconomia: economiaMediaMensal
  };

  // ---------- 3. JUSTIFICATIVA DO KIT ----------
  // Regra: se a geração do kit ficar a até ~200kWh do consumo médio do cliente
  // (pra cima ou pra baixo), a justificativa é que o kit foi dimensionado para
  // DIMINUIR a conta de energia atual. Se a geração for MAIOR que o consumo em
  // mais de 200kWh, a justificativa passa a ser que o cliente pretende AUMENTAR
  // o consumo (novos eletrodomésticos) para acompanhar a geração do kit maior.
  const LIMIAR_JUSTIFICATIVA_KWH = 200;
  const consumoBaseJustificativa = consumoMedioHistorico ?? consumoMedioMes;
  const diferencaGeracaoConsumo = geracaoEstimadaKwhMes - consumoBaseJustificativa;
  const kitVisaAumentoConsumo = diferencaGeracaoConsumo > LIMIAR_JUSTIFICATIVA_KWH;
  const justificativaKit = {
    consumoMedio: consumoBaseJustificativa,
    geracaoKit: geracaoEstimadaKwhMes,
    diferenca: diferencaGeracaoConsumo,
    aumentoConsumo: kitVisaAumentoConsumo,
    texto: cfg.justificativaTexto || null // se não informado, o render monta o texto padrão (ver regra acima)
  };

  // ---------- 4. PAYBACK ----------
  const investimentoTotal = r.totalGeral || 0;
  const economiaParaPayback = economiaMediaMensal || 1;
  const paybackMeses = economiaParaPayback > 0 ? (investimentoTotal / economiaParaPayback) : 0;
  const paybackAnos = Math.floor(paybackMeses / 12);
  const paybackMesesResto = Math.round(paybackMeses - (paybackAnos * 12));
  const payback = {
    investimento: investimentoTotal,
    economiaMedia: economiaMediaMensal,
    meses: +paybackMeses.toFixed(2),
    anos: paybackAnos,
    mesesResto: paybackMesesResto
  };

  // ---------- 5. ESTIMATIVA DE PRAZO ----------
  const prazoExecucao = {
    diasMin: +cfg.prazoDiasMin || 90,
    diasMax: +cfg.prazoDiasMax || 120,
    percentualEntrada: +cfg.prazoPercentualEntrada || 85,
    kwp: kwpKit
  };

  // ---------- 8. MÉTODO DE INSTALAÇÃO ----------
  const metodoInstalacao = {
    localInstalacao: cfg.localInstalacao || 'telhado da residência do cliente',
    tipoTelhado: cfg.tipoTelhado || 'telhas de cerâmica de barro colonial',
    materialSuporte: cfg.materialSuporte || 'suporte e grampos de alumínio ou material semelhante galvanizado a fogo',
    durabilidadeAnos: cfg.durabilidadeSuporteAnos || 30
  };

  // ---------- 9. POSIÇÃO SOLAR ----------
  const posicaoSolar = {
    anguloIncidencia: cfg.anguloIncidencia || 8,
    imagemUrl: cfg.posicaoSolarImagemUrl || null,
    orgaoReferencia: cfg.orgaoReferenciaSolar || 'CRESESB - Centro de Referência para Energia Solar e Eólica Sérgio Brito'
  };

  // ---------- 10. ORÇAMENTO DETALHADO ----------
  const primeiraPlaca = data.itensPlaca?.[0]?.placa || null;
  const primeiroInversor = data.itensInversor?.[0]?.inversor || null;

  // v1.3: N° Registro INMETRO — o cadastro (pages/cadastro.js) salva esse
  // dado no campo `inmetro` de placas e inversores (não `registroInmetro`,
  // que nunca existiu). Lê o valor real cadastrado, com override manual em
  // cfg (inversorRegistroInmetro/painelRegistroInmetro) e só então o
  // placeholder, caso o equipamento realmente não tenha INMETRO cadastrado.
  const equipamentos = {
    inversor: primeiroInversor ? {
      marca: primeiroInversor.marca || '',
      modelo: primeiroInversor.modelo || '',
      potenciaKw: primeiroInversor.potencia ? primeiroInversor.potencia / 1000 : 0,
      tensao: primeiroInversor.tensao || '',
      eficiencia: primeiroInversor.eficiencia || cfg.inversorEficiencia || null,
      registroInmetro: primeiroInversor.inmetro || cfg.inversorRegistroInmetro || PLACEHOLDER_BNB,
      descricao: primeiroInversor.descricaoTecnica || cfg.inversorDescricao || null,
      garantia: primeiroInversor.garantia || '10 anos',
      imagemUrl: primeiroInversor.imagem_url || null
    } : null,
    painel: primeiraPlaca ? {
      marca: primeiraPlaca.marca || '',
      modelo: primeiraPlaca.modelo || '',
      potenciaW: primeiraPlaca.potencia || 0,
      tipo: primeiraPlaca.tipo || '',
      registroInmetro: primeiraPlaca.inmetro || cfg.painelRegistroInmetro || PLACEHOLDER_BNB,
      descricao: primeiraPlaca.descricaoTecnica || cfg.painelDescricao || null,
      garantiaProduto: primeiraPlaca.garantia || '12 anos',
      garantiaGeracao: primeiraPlaca.garantiager || '25 anos',
      imagemUrl: primeiraPlaca.imagem_url || null
    } : null
  };

  // Estrutura de fixação selecionada — exibida junto das placas/inversor,
  // no bloco de "Orçamento Detalhado / Equipamentos" (ver renderEquipamentosNormasConteudo).
  const estruturaSelBNB = cfg.estrutura || data.estrutura || null;
  const estruturaSelecionada = (estruturaSelBNB && !estruturaSelBNB._semEstrutura) ? {
    nome: estruturaSelBNB.nome || '',
    tipo: estruturaSelBNB.tipo || '',
    descricao: estruturaSelBNB.descricao || '',
    imagemUrl: estruturaSelBNB.imagem_url || null
  } : null;

  // Garantias: reaproveita a mesma estrutura já usada na proposta comercial
  const garantias = {
    placas: (data.itensPlaca || []).map(item => ({
      nome: `${item.placa?.marca || ''} ${item.placa?.modelo || ''}`.trim() || 'Placa Solar',
      garantia: item.placa?.garantia || '12 anos',
      garantiaGeracao: item.placa?.garantiager || '25 anos'
    })),
    inversores: (data.itensInversor || []).map(item => ({
      nome: `${item.inversor?.marca || ''} ${item.inversor?.modelo || ''}`.trim() || 'Inversor',
      garantia: item.inversor?.garantia || '10 anos'
    })),
    baterias: (data.itensBateria || []).map(item => ({
      nome: item.bateria?.nome || 'Bateria',
      garantia: item.bateria?.garantia || '5 anos'
    })),
    outros: (data.itensOutros || [])
      .filter(item => item.outros?.garantia)
      .map(item => ({
        nome: `${item.outros?.nome || ''} ${item.outros?.modelo || ''}`.trim() || 'Equipamento',
        garantia: `${item.outros.garantia} meses`
      }))
  };

  // Tabela de materiais do orçamento detalhado.
  //
  // IMPORTANTE: replica a fórmula REAL usada no sistema (aba DADOS_CLIENTES /
  // RecalcularSimulacoes do VBA), que NÃO soma valor unitário de cada
  // equipamento. Em vez disso, o valor é RATEADO a partir do valor total
  // já fechado do orçamento:
  //
  //   valorServico   = valorTotal × %Serviço            (txtPercServ, padrão 30%)
  //   valorMaterial  = valorTotal − valorServico          (ou valor manual "matReal")
  //   valorInversor  = valor cadastrado/config do inversor (txtValInv, padrão R$ 4.501,61)
  //   valorEstrutura = valor cadastrado/config da estrutura (txtValEstr, padrão R$ 1.000,00;
  //                    troca para txtValSolo, padrão R$ 2.000,00, quando a estrutura é
  //                    SOLO ou SOLO LASTRO)
  //   valorPainel    = valorMaterial − valorInversor − valorEstrutura   (o painel fica com o RESTANTE)
  //
  // Validado contra o modelo Word: 97.000,00 × 30% = 29.100,00 (serviço) →
  // material 67.900,00 → 67.900,00 − 3.000,00 (estrutura) − 10.501,61 (inversor)
  // = 54.398,39 (painel) — bate exatamente com o documento original.
  let orcamentoDetalhado;

  if (Array.isArray(cfg.orcamentoDetalhado) && cfg.orcamentoDetalhado.length) {
    // Override total: usuário informou as linhas exatas (ex.: vindas de um laudo já fechado).
    const linhasMateriaisManual = cfg.orcamentoDetalhado.map(l => ({
      material: l.material || '',
      unidade: l.unidade ?? 1,
      valor: +l.valor || 0
    }));
    const valorMaterialManual = linhasMateriaisManual.reduce((a, l) => a + l.valor, 0);
    const valorServicoManual = cfg.valorServicoInstalacao != null
      ? +cfg.valorServicoInstalacao
      : Math.max(0, (r.totalGeral || 0) - valorMaterialManual);
    orcamentoDetalhado = {
      linhasMateriais: linhasMateriaisManual,
      valorMaterial: valorMaterialManual,
      valorServicoInstalacao: valorServicoManual,
      descontoPercentual: +cfg.descontoPercentual || 0,
      valorTotalFinal: r.totalGeral || null
    };
  } else {
    // --- 1) % de serviço e valor do serviço ---
    const percServico = cfg.percServico != null ? +cfg.percServico : 30; // txtPercServ, padrão "30%"
    const valorTotalOrcamento = r.totalGeral || 0;
    const valorServicoInstalacao = valorTotalOrcamento * (percServico / 100);

    // --- 2) valor do material (total) ---
    // txtMatReal: se o usuário informar um valor manual de material (>1), ele prevalece;
    // senão, material = total − serviço (mesma regra do RecalcularSimulacoes do VBA).
    const valorMaterial = (cfg.valorMaterialManual != null && +cfg.valorMaterialManual > 1)
      ? +cfg.valorMaterialManual
      : Math.max(0, valorTotalOrcamento - valorServicoInstalacao);

    // --- 3) valor do inversor (dentro do material) ---
    const qtdInversorTotal = (data.itensInversor || []).reduce((a, it) => a + (it.qtd || 0), 0);
    const valorInversorTotal = cfg.valorInversor != null
      ? +cfg.valorInversor // valor TOTAL já cadastrado para o(s) inversor(es) deste orçamento
      : +(valorTotalOrcamento * 0.22); // 22% do valor total (reutiliza a variável existente)

    // --- 4) valor da estrutura (dentro do material) ---
    const estruturaSel = cfg.estrutura || data.estrutura || null;
    const nomeEstruturaUpper = (estruturaSel?.nome || cfg.estruturaTipo || '').toString().toUpperCase();
    const ehEstruturaSolo = nomeEstruturaUpper.includes('SOLO');
    const percentualEstrutura = ehEstruturaSolo ? 0.16 : 0.08; // 16% solo, 8% telhado
    const valorEstruturaTotal = cfg.valorEstrutura != null
      ? +cfg.valorEstrutura
      : +(valorTotalOrcamento * percentualEstrutura);
    // --- 5) valor do painel = RESTANTE do material, depois de tirar inversor e estrutura ---
    const valorPainelTotal = Math.max(0, valorMaterial - valorInversorTotal - valorEstruturaTotal);

    const primeiraPlacaNome = (data.itensPlaca?.[0]?.placa?.marca || '') + ' ' + (data.itensPlaca?.[0]?.placa?.tipo || '') + ' ' + (data.itensPlaca?.[0]?.placa?.potencia ? data.itensPlaca[0].placa.potencia + 'W' : '');
    const primeiroInversorNome = (data.itensInversor?.[0]?.inversor?.marca || '') + ' ' + (data.itensInversor?.[0]?.inversor?.potencia ? (data.itensInversor[0].inversor.potencia/1000)+'kW' : '') + ' ' + (data.itensInversor?.[0]?.inversor?.tensao || '');
    const qtdPlacaTotal = (data.itensPlaca || []).reduce((a, it) => a + (it.qtd || 0), 0);

    const linhasMateriais = [
      { material: `ESTRUTURA COMPLETA ${nomeEstruturaUpper || 'PARA TELHADO'}`, unidade: 1, valor: valorEstruturaTotal },
      { material: `ONGRID ${primeiroInversorNome.trim().toUpperCase() || 'INVERSOR'}`, unidade: qtdInversorTotal || 1, valor: valorInversorTotal },
      { material: `PAINEL SOLAR ${primeiraPlacaNome.trim().toUpperCase() || 'FOTOVOLTAICO'}`, unidade: qtdPlacaTotal || 1, valor: valorPainelTotal }
    ];

    const descontoPercentual = +cfg.descontoPercentual || (r.desconto ? (r.desconto / (r.totalGeral || 1) * 100) : 0);

    orcamentoDetalhado = {
      linhasMateriais,
      valorMaterial,
      valorServicoInstalacao,
      descontoPercentual,
      valorTotalFinal: r.totalGeral || null
    };
  }

  // ---------- ASSINATURA ----------
  const engenheiro = {
    nome: cfg.assinatura_nome || 'Juan Francisco Gabriel Rocha de Sousa',
    cpf: cfg.assinatura_cpf || '027.409.373-18',
    papeis: (cfg.assinatura_papeis || 'Engenheiro Eletricista\nEngenheiro de Segurança do Trabalho\nEngenheiro Clínico e Hospitalar').split('\n').filter(Boolean),
    cargo: cfg.assinatura_cargo || 'Sócio Proprietário da Rocha Engenharia'
  };

  return {
    codigoProposta: data.codigoProposta || '',
    empresa,
    cliente,
    identificacao,
    capaTemplateId,
    capaDados,
    kwpKit,
    reducaoMensal,
    justificativaKit,
    payback,
    prazoExecucao,
    historicoConsumo,
    totalConsumoHistorico,
    totalGeracaoHistorico,
    potenciaGerador,
    metodoInstalacao,
    posicaoSolar,
    equipamentos,
    estruturaSelecionada,
    garantias,
    orcamentoDetalhado,
    engenheiro,
    marcaDagua: cfg.marca_dagua_ativa !== false,
    dataProposta: new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
  };
}
window.montarDadosPropostaBNB = montarDadosPropostaBNB;

// ============================================================
// CSS — reaproveita propostaBaseCss()/propostaPagedCss() se existirem
// e adiciona apenas as classes específicas do laudo técnico BNB.
// ============================================================
function propostaBaseCssBNB(){
  const base = (typeof window.propostaBaseCss === 'function') ? window.propostaBaseCss() : `
:root{--orange:#E8672B;--brown:#3E2818;--dark:#2A1B10;--light-gray:#F3EFE9;--green-row:#DDEFDD;--line:#E6E0D5;--paper:#FFFFFF;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Barlow',sans-serif;background:#DCD6C8;color:var(--dark);}
.page{margin:80px auto 32px;background:var(--paper);box-shadow:0 4px 32px rgba(0,0,0,.22);position:relative;overflow:hidden;padding:10mm;}
.running-header{padding:18px 40px 6px;} .running-header img{height:34px;}
.logo-header{padding:18px 40px 6px;} .logo-header img{height:34px;}
.section-bar{margin:0 40px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--orange);padding-bottom:8px;}
.section-bar .title{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;text-transform:uppercase;color:var(--dark);}
.section-bar .sub{font-family:'Barlow Condensed',sans-serif;font-size:12px;color:var(--orange);font-weight:700;text-transform:uppercase;}
`;

  const extra = `
/* ===== Classes específicas do laudo técnico BNB ===== */
.bnb-capa{padding:60px 50px;height:100%;display:flex;flex-direction:column;}
.bnb-capa .empresa-block p{font-size:13px;font-weight:700;margin-bottom:2px;color:var(--dark);}
.bnb-capa .titulo-orcamento{margin-top:60px;font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:800;text-transform:uppercase;color:var(--orange);text-align:center;}
.bnb-capa .cliente-nome{margin-top:18px;font-size:16px;font-weight:700;text-align:center;color:var(--dark);text-transform:uppercase;}
.bnb-capa .capa-rodape{margin-top:auto;text-align:center;font-size:13px;color:#6B5C4C;}

.bnb-section{margin:0 40px 20px;}
.bnb-section h3{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:800;color:var(--dark);text-transform:uppercase;border-bottom:2px solid var(--orange);padding-bottom:6px;margin-bottom:10px;}
.bnb-section p{font-size:12.5px;color:#4A3B2C;line-height:1.65;margin-bottom:8px;text-align:justify;}
.bnb-section .destaque{color:var(--orange);font-weight:800;}
.bnb-formula{background:var(--light-gray);border-left:4px solid var(--orange);padding:12px 16px;font-size:13px;margin:10px 0;font-style:italic;color:var(--dark);}
.bnb-kpi-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0;}
.bnb-kpi{background:var(--dark);color:#fff;padding:10px 14px;border-radius:6px;}
.bnb-kpi .kl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#D8C9BB;}
.bnb-kpi .kv{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:800;}

.bnb-table{width:100%;border-collapse:collapse;font-size:11.5px;margin:8px 0;}
.bnb-table th{background:var(--dark);color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;padding:7px 8px;text-align:left;}
.bnb-table th.num,.bnb-table td.num{text-align:right;}
.bnb-table td{padding:6px 8px;border-bottom:1px solid var(--line);}
.bnb-table tbody tr:nth-child(even){background:var(--light-gray);}
.bnb-table tfoot td{font-weight:800;border-top:2px solid var(--dark);background:var(--light-gray);}

.bnb-tech-table{width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0;}
.bnb-tech-table td{padding:8px 12px;border-bottom:1px solid var(--line);}
.bnb-tech-table td.label{color:#8A7A6A;text-transform:uppercase;font-size:10.5px;letter-spacing:.4px;}
.bnb-tech-table td.value{text-align:right;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:15px;color:var(--dark);}

.bnb-equip-block{margin:0 40px 16px;border:1px solid var(--line);border-radius:6px;padding:14px 18px;}
.bnb-equip-block h4{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:var(--dark);text-transform:uppercase;margin-bottom:6px;}
.bnb-equip-block p{font-size:12px;color:#6B5C4C;line-height:1.6;margin-bottom:4px;}
.bnb-equip-block .norma{font-size:10.5px;color:#8A7A6A;margin-top:4px;}

.bnb-orc-total-banner{margin:14px 40px 0;background:var(--dark);color:#fff;display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-radius:6px;}
.bnb-orc-total-banner .lbl{font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--orange);}
.bnb-orc-total-banner .val{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:800;}

.bnb-sign-block{margin:24px 40px 0;text-align:right;font-size:12.5px;color:#6B5C4C;}
.bnb-sign-block .name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;color:var(--dark);}

/* Capa: reaproveita a mesma capa gráfica da proposta comercial (sem padding, altura A4 cheia) */
#pageCapa{padding:0;}
#pageCapa .page-capa{width:100%;height:1123px;}

/* Bloco final: empresa + responsável técnico lado a lado */
.bnb-final-cols{margin:0 40px;display:grid;grid-template-columns:1fr 1fr;gap:24px;}
.bnb-empresa-block p{font-size:12px;color:#6B5C4C;margin-bottom:3px;}
.bnb-empresa-block p:first-child{font-size:14px;font-weight:800;color:var(--dark);margin-bottom:6px;}

/* Bloco de equipamento com imagem ao lado do texto */
.bnb-equip-block.com-imagem{display:flex;gap:16px;align-items:flex-start;}
.bnb-equip-block.com-imagem img{width:96px;height:96px;object-fit:contain;background:var(--light-gray);border-radius:6px;flex-shrink:0;}
.bnb-equip-block.com-imagem .txt{flex:1;}
`;

  return base + extra;
}

// ============================================================
// RENDER: PÁGINA DE CAPA — reaproveita a MESMA capa gráfica já
// cadastrada/usada na proposta comercial (proposta-completa.js).
// O nome do cliente NÃO é exibido na capa: já aparece na primeira
// folha de conteúdo, na seção "1. Identificação". Se getCapaById não
// estiver disponível (arquivo usado isoladamente), cai num fallback
// simples e neutro.
// ============================================================
function renderCapaBNB(dados){
  if (typeof window.getCapaById === 'function') {
    const capaTemplate = window.getCapaById(dados.capaTemplateId);
    const capaHtml = `<style>${capaTemplate.css}</style><div class="page-capa">${capaTemplate.render({ ...dados.capaDados, subtitulo: dados.capaDados?.subtitulo || 'Orçamento de Energia Solar (BNB)' })}</div>`;
    return `<div class="page" id="pageCapa">${capaHtml}</div>`;
  }
  // Fallback (sem getCapaById carregado): capa neutra, só com o título do laudo.
  return `
<div class="page" id="pageCapa">
  <div class="bnb-capa">
    <div class="titulo-orcamento" style="margin-top:auto">Orçamento de Energia Solar</div>
    <div class="capa-rodape">${dados.empresa.cidade}/${new Date().getFullYear()}</div>
  </div>
</div>`;
}

// ============================================================
// RENDER: CONTEÚDO EM FLUXO CONTÍNUO (todas as seções em uma página)
// ============================================================

function renderIdentificacaoReducaoConteudo(dados){
  const id = dados.identificacao;
  const red = dados.reducaoMensal;
  return `
  <div class="section-bar"><span class="title">1. Identificação</span><span class="sub">Cliente e Unidade Consumidora</span></div>
  <div class="bnb-section">
    <p><b>Nome:</b> ${id.nome}</p>
    <p><b>Endereço:</b> ${id.endereco}</p>
    <p><b>Unidade Consumidora:</b> ${id.unidadeConsumidora}</p>
  </div>

  <div class="section-bar" style="margin-top:26px"><span class="title">2. Redução Mensal Esperada</span><span class="sub">Memória de Cálculo</span></div>
  <div class="bnb-section">
    <p>O cálculo empregado na geração que o projeto vai gerar leva em consideração o valor de sol pleno (kWh/m²), que na região de <span class="destaque">${red.regiao}</span> fica em ${fmtNumBNB(red.irradiancia, 2)}. A fórmula utilizada é a seguinte:</p>
    <div class="bnb-formula">(kWp do kit solar) × (kWh/m² da região) × (${red.diasSolMes} dias) = ${fmtNumBNB(red.geracaoEstimadaKwhMes, 0)} kWh/mês estimados</div>
    <p>Considerando o valor da tarifação com imposto de ${fmtMoedaBNB(red.tarifaComImposto)} (valor médio com imposto), ao multiplicar esses valores encontra-se uma média das produções ao longo dos meses do ano, baseada em dados estatísticos e nos dados do fabricante.</p>
    <div class="bnb-kpi-row">
      <div class="bnb-kpi"><div class="kl">Conta de energia atual (média)</div><div class="kv">${fmtMoedaBNB(red.valorContaAtual)}</div></div>
      <div class="bnb-kpi"><div class="kl">Redução média esperada</div><div class="kv">${fmtMoedaBNB(red.valorEconomia)}</div></div>
    </div>
    <p><b>Redução média da conta de energia:</b> ${fmtMoedaBNB(red.valorContaAtual)} a ${fmtMoedaBNB(red.valorEconomia)}</p>
  </div>`;
}

function renderJustificativaPaybackConteudo(dados){
  const j = dados.justificativaKit;
  const p = dados.payback;
  let textoJustificativa = j.texto;
  if (!textoJustificativa) {
    if (j.aumentoConsumo) {
      // Geração do kit supera o consumo médio em mais de 200kWh: kit dimensionado
      // "para cima" — a justificativa é que o cliente pretende aumentar o consumo.
      textoJustificativa = `O cliente possui um consumo médio de ${fmtNumBNB(j.consumoMedio,0)}kWh e tem planos de aumentar o consumo mensal com a adição de novos eletrodomésticos/equipamentos, saindo de ${fmtNumBNB(j.consumoMedio,0)}kWh para acompanhar a geração estimada do kit, de aproximadamente ${fmtNumBNB(j.geracaoKit,0)}kWh.`;
    } else {
      // Geração do kit fica próxima (± 200kWh) do consumo médio atual: o kit foi
      // dimensionado para reduzir/zerar a conta de energia como ela é hoje.
      textoJustificativa = `O dimensionamento do kit foi feito próximo ao consumo médio atual do cliente, de ${fmtNumBNB(j.consumoMedio,0)}kWh, com o objetivo de diminuir a conta de energia atual do cliente através da geração de energia solar.`;
    }
  }
  return `
  <div class="section-bar" style="margin-top:26px"><span class="title">3. Justificativa do Kit</span></div>
  <div class="bnb-section"><p>${textoJustificativa}</p></div>

  <div class="section-bar" style="margin-top:26px"><span class="title">4. Payback</span><span class="sub">Retorno do Investimento</span></div>
  <div class="bnb-section">
    <p>De acordo com os dados colhidos da fatura de energia do cliente, o payback (tempo de retorno do investimento) se dá conforme abaixo. A quantidade média de economia mensal considerada é de <span class="destaque">${fmtMoedaBNB(p.economiaMedia)}</span>.</p>
    <div class="bnb-formula">Payback = Investimento inicial ÷ Valor em R$ da geração = Tempo de retorno do investimento<br>
    Pb = ${fmtMoedaBNB(p.investimento)} ÷ ${fmtMoedaBNB(p.economiaMedia)} = ${fmtNumBNB(p.meses,2)} meses</div>
    <p>Que é igual a <b>${p.anos} ano(s) e ${p.mesesResto} mês(es)</b> de payback.</p>
  </div>`;
}

function renderPrazoHistoricoConteudo(dados){
  const pr = dados.prazoExecucao;
  const hist = dados.historicoConsumo;

  const linhasTabela = hist.map(h => `
    <tr>
      <td>${h.mes}</td>
      <td class="num">${h.consumoCliente != null ? fmtNumBNB(h.consumoCliente,0) : PLACEHOLDER_BNB}</td>
      <td class="num">${h.geracaoSolar != null ? fmtNumBNB(h.geracaoSolar,0) : PLACEHOLDER_BNB}</td>
    </tr>`).join('');

  return `
  <div class="section-bar" style="margin-top:26px"><span class="title">5. Estimativa de Prazo</span><span class="sub">Funcionamento do Gerador</span></div>
  <div class="bnb-section">
    <p>Estima-se um prazo de <b>${pr.diasMin} a ${pr.diasMax} dias</b> para a execução e finalização do projeto fotovoltaico de ${fmtNumBNB(pr.kwp,2)}kWp, após o recebimento da 1ª parcela de <b>${fmtPctBNB(pr.percentualEntrada)}</b> do valor estimado para a realização dele.</p>
  </div>

  <div class="section-bar" style="margin-top:26px"><span class="title">6. Histórico de Consumo</span><span class="sub">Consumo do Cliente × Geração Solar Estimada</span></div>
  <div class="bnb-section">
    <table class="bnb-table">
      <thead><tr><th>Mês</th><th class="num">Consumo do Cliente (kWh)</th><th class="num">Geração Solar (kWh)</th></tr></thead>
      <tbody>${linhasTabela}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="num">${dados.totalConsumoHistorico != null ? fmtNumBNB(dados.totalConsumoHistorico,0) : PLACEHOLDER_BNB}</td><td class="num">${dados.totalGeracaoHistorico != null ? fmtNumBNB(dados.totalGeracaoHistorico,0) : PLACEHOLDER_BNB}</td></tr></tfoot>
    </table>
  </div>`;
}

function renderPotenciaGeradorConteudo(dados){
  const pg = dados.potenciaGerador;
  return `
  <div class="section-bar" style="margin-top:26px"><span class="title">7. Potência do Gerador</span></div>
  <div class="bnb-section">
    <p>A potência para geração do sistema do cliente é baseada na média do consumo, e é de <span class="destaque">${fmtNumBNB(pg.kwp,2)}kW/Pico</span>.</p>
    <table class="bnb-tech-table">
      <tbody>
        <tr><td class="label">Horas de sol aproveitáveis (H)</td><td class="value">${fmtNumBNB(pg.horasSol,2)}</td></tr>
        <tr><td class="label">Dias de sol no mês</td><td class="value">${pg.diasSolMes}</td></tr>
        <tr><td class="label">Horas de produção no mês (H)</td><td class="value">${fmtNumBNB(pg.horasProducaoMes,2)}</td></tr>
        <tr><td class="label">Consumo médio por mês (kWh)</td><td class="value">${fmtNumBNB(pg.consumoMedioMes,0)}</td></tr>
        <tr><td class="label">Consumo médio por mês — Taxa com impostos (R$)</td><td class="value">${fmtMoedaBNB(pg.consumoMedioTaxaImposto)}</td></tr>
        <tr><td class="label">kW por hora de produção (kW)</td><td class="value">${fmtNumBNB(pg.kwp,2)}</td></tr>
      </tbody>
    </table>
  </div>`;
}

function renderInstalacaoPosicaoConteudo(dados){
  const mi = dados.metodoInstalacao;
  const ps = dados.posicaoSolar;
  return `
  <div class="section-bar" style="margin-top:26px"><span class="title">8. Método de Instalação</span></div>
  <div class="bnb-section">
    <p>A implantação dos módulos fotovoltaicos será no ${mi.localInstalacao}, o qual é de ${mi.tipoTelhado}, onde serão colocados ${mi.materialSuporte}, com durabilidade contra corrosão e ferrugem de mais de ${mi.durabilidadeAnos} anos.</p>
  </div>

  <div class="section-bar" style="margin-top:26px"><span class="title">9. Posição Solar</span></div>
  <div class="bnb-section">
    <p>A posição dos painéis solares deve levar em conta a posição solar, observando qual o melhor local na edificação que possibilita a maior exposição ao sol.</p>
    <p>A maior média anual de irradiação solar diária é atingida com o ângulo de incidência solar de ${ps.anguloIncidencia}º (segundo ${ps.orgaoReferencia}, órgão sustentado pelo Ministério de Minas e Energia). Como o telhado da edificação possui uma inclinação própria, deve ser acrescida a diferença desta angulação através dos suportes dos módulos solares, de forma que a média anual de produção seja a maior possível.</p>
    ${ps.imagemUrl ? `<div style="text-align:center;margin-top:10px;"><img src="${ps.imagemUrl}" alt="Posição solar" style="max-width:100%;max-height:220px;"></div>` : ''}
  </div>`;
}

// Bloco de um equipamento (inversor/painel) com imagem ao lado do texto,
// usando a classe .com-imagem já existente no CSS. Reaproveitado também
// pelo bloco de estrutura de fixação, logo abaixo.
function renderEquipBlocoComImagem(titulo, imagemUrl, parágrafosHtml){
  const temImagem = !!imagemUrl;
  return `
  <div class="bnb-equip-block${temImagem ? ' com-imagem' : ''}">
    ${temImagem ? `<img src="${imagemUrl}" alt="${titulo}">` : ''}
    <div class="txt">
      <h4>${titulo}</h4>
      ${parágrafosHtml}
    </div>
  </div>`;
}

function renderEquipamentosNormasConteudo(dados){
  const eq = dados.equipamentos;
  const est = dados.estruturaSelecionada;
  let html = `
  <div class="section-bar" style="margin-top:26px"><span class="title">10. Orçamento Detalhado</span><span class="sub">Equipamentos e Normas Atendidas</span></div>
  `;

  if (eq.inversor) {
    const paragrafos = `
      <p>${eq.inversor.descricao || `${eq.inversor.marca} é uma empresa focada no cliente, com sólida estrutura de pré-venda e pós-venda. O inversor ${eq.inversor.potenciaKw ? eq.inversor.potenciaKw + 'kW' : ''} ${eq.inversor.tensao || ''} é eficiente${eq.inversor.eficiencia ? ' e pode atingir ' + eq.inversor.eficiencia + '%' : ''}, com sistema de LED para visualização e monitoramento local e remoto via aplicativo ou web page.`}</p>
      <p>Certificado INMETRO, com Chave DC Switch, IP65 e garantia de ${eq.inversor.garantia} mediante troca de produto com frete terrestre pago.</p>
      ${eq.inversor.registroInmetro ? `<p class="norma">Este produto tem seu desempenho aprovado pelo INMETRO e está em conformidade com o Programa Brasileiro de Etiquetagem. N° Registro: ${eq.inversor.registroInmetro}</p>` : ''}
    `;
    html += renderEquipBlocoComImagem(`Inversor Solar On Grid — ${eq.inversor.marca} ${eq.inversor.modelo}`, eq.inversor.imagemUrl, paragrafos);
  }

  if (eq.painel) {
    const paragrafos = `
      <p>${eq.painel.descricao || `Módulo fotovoltaico ${eq.painel.marca} de ${eq.painel.potenciaW}W, tipo ${eq.painel.tipo}, distribuído por parceiros líderes em distribuição de sistemas solares no Brasil.`}</p>
      <p>Garantia do produto de ${eq.painel.garantiaProduto}, garantia de potência linear de ${eq.painel.garantiaGeracao}.</p>
      ${eq.painel.registroInmetro ? `<p class="norma">Este produto tem seu desempenho aprovado pelo INMETRO e está em conformidade com o Programa Brasileiro de Etiquetagem. N° Registro: ${eq.painel.registroInmetro}</p>` : ''}
    `;
    html += renderEquipBlocoComImagem(`Painel Solar Fotovoltaico — ${eq.painel.marca} ${eq.painel.tipo}`, eq.painel.imagemUrl, paragrafos);
  }

  // Estrutura de fixação selecionada no orçamento — mesmo padrão visual
  // (imagem ao lado do texto quando houver imagem cadastrada).
  if (est) {
    const paragrafos = `
      <p>${est.descricao || `Estrutura de fixação do tipo ${est.tipo || 'padrão'}, própria para a instalação segura dos módulos fotovoltaicos, com resistência a intempéries e fixação certificada.`}</p>
      ${est.tipo ? `<p class="norma">Tipo: ${est.tipo}</p>` : ''}
    `;
    html += renderEquipBlocoComImagem(`Estrutura de Fixação — ${est.nome}`, est.imagemUrl, paragrafos);
  }

  return html;
}

function renderGarantiasMateriaisConteudo(dados){
  const garantiasHtml = (typeof window.renderGarantiasHtml === 'function')
    ? window.renderGarantiasHtml(dados.garantias)
    : renderGarantiasFallbackBNB(dados.garantias);

  const od = dados.orcamentoDetalhado;
  const linhasHtml = od.linhasMateriais.length ? od.linhasMateriais.map(l => `
    <tr>
      <td>${l.material}</td>
      <td class="num">${l.unidade}</td>
      <td class="num">${l.valor != null ? fmtMoedaBNB(l.valor) : PLACEHOLDER_BNB}</td>
    </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;color:#8A7A6A;">${PLACEHOLDER_BNB}</td></tr>`;

  return `
  <div class="section-bar" style="margin-top:26px"><span class="title">Garantias</span></div>
  <div class="bnb-section">${garantiasHtml}</div>

  <div class="section-bar" style="margin-top:20px"><span class="title">Execução, Instalação e Compra de Materiais</span><span class="sub">Projeto de Energia Solar</span></div>
  <div class="bnb-section">
    <table class="bnb-table">
      <thead><tr><th>Material</th><th class="num">Unidade</th><th class="num">Valor R$</th></tr></thead>
      <tbody>${linhasHtml}</tbody>
      <tfoot>
        <tr><td colspan="2">Valor do material</td><td class="num">${od.valorMaterial != null ? fmtMoedaBNB(od.valorMaterial) : PLACEHOLDER_BNB}</td></tr>
        <tr><td colspan="2">Serviço de instalação (Projeto, Instalação e Homologação junto à distribuidora)</td><td class="num">${od.valorServicoInstalacao != null ? fmtMoedaBNB(od.valorServicoInstalacao) : PLACEHOLDER_BNB}</td></tr>
        <tr><td colspan="2">Desconto</td><td class="num">${fmtPctBNB(od.descontoPercentual)}</td></tr>
      </tfoot>
    </table>
  </div>
  <div class="bnb-orc-total-banner"><span class="lbl">Valor total</span><span class="val">${od.valorTotalFinal != null ? fmtMoedaBNB(od.valorTotalFinal) : PLACEHOLDER_BNB}</span></div>`;
}

function renderAssinaturaConteudo(dados){
  const eng = dados.engenheiro;
  const e = dados.empresa;
  return `
  <div class="section-bar" style="margin-top:26px"><span class="title">Empresa Responsável</span><span class="sub">Dados e Assinatura</span></div>
  <div class="bnb-final-cols">
    <div class="bnb-empresa-block">
      <p>${e.nomeFantasia.toUpperCase()}</p>
      <p>CNPJ: ${e.cnpj}</p>
      <p>Razão Social: ${e.razaoSocial}</p>
      <p>Endereço: ${e.endereco}</p>
    </div>
    <div class="bnb-sign-block" style="margin:0;">
      <p style="margin-bottom:20px">${e.cidade}, ${dados.dataProposta}.</p>
      <p>Atenciosamente,</p>
      <p class="name" style="margin-top:14px">${eng.nome}</p>
      <p>CPF: ${eng.cpf}</p>
      ${eng.papeis.map(r=>`<p>${r}</p>`).join('')}
      <p><b>${eng.cargo}</b></p>
    </div>
  </div>
  ${dados.codigoProposta ? `<div style="margin:24px 40px 0;text-align:left;font-size:8px;color:#c2b8aa;">${dados.codigoProposta}</div>` : ''}`;
}

// Fallback local de garantias, caso este arquivo seja usado isoladamente
function renderGarantiasFallbackBNB(garantias){
  let html = '';
  (garantias.placas || []).forEach(p => {
    html += `<div class="garantia-item"><h4>Painéis Solares (${p.nome})</h4><p>${p.garantia} contra defeitos de fabricação · potência linear garantida por ${p.garantiaGeracao}.</p></div>`;
  });
  (garantias.inversores || []).forEach(i => {
    html += `<div class="garantia-item"><h4>Inversor (${i.nome})</h4><p>${i.garantia} contra defeitos de fabricação.</p></div>`;
  });
  (garantias.baterias || []).forEach(b => {
    html += `<div class="garantia-item"><h4>Bateria (${b.nome})</h4><p>${b.garantia} contra defeitos de fabricação.</p></div>`;
  });
  (garantias.outros || []).forEach(o => {
    html += `<div class="garantia-item"><h4>${o.nome}</h4><p>${o.garantia} contra defeitos de fabricação.</p></div>`;
  });
  if (!html) html = `<div class="garantia-item"><h4>Garantia de Prestação de Serviço</h4><p>1 ano contra defeitos na execução do serviço, conforme especificado em contrato.</p></div>`;
  return html;
}

// ============================================================
// RENDER: DOCUMENTO COMPLETO BNB (VERSÃO FLUXO CONTÍNUO)
// ============================================================
function renderPropostaBNBHTML(dados){
  const pagedCss = (typeof window.propostaPagedCss === 'function') ? window.propostaPagedCss() : '';
  const pagedLoader = (typeof window.propostaPagedLoader === 'function') ? window.propostaPagedLoader() : '';

  const wm = dados.marcaDagua !== false ? `<div class="watermark"><img src="${LOGO_PADRAO_URL_BNB}" alt=""></div>` : '';

  let nomeProposta = `Orçamento BNB - ${dados.cliente?.nome || dados.identificacao.nome || 'Cliente'}`;

  // HTML DO CONTEÚDO FLUXO CONTÍNUO (sem quebras de página fixas)
  const conteudoHTML = `
    ${renderCapaBNB(dados)}
    
    <div class="page" id="pageConteudo">
      <div class="running-header"><img src="${LOGO_PADRAO_URL_BNB}" alt="${dados.empresa.nomeFantasia}"></div>
      <div class="logo-header"><img src="${LOGO_PADRAO_URL_BNB}" alt="${dados.empresa.nomeFantasia}"></div>
      
      ${renderIdentificacaoReducaoConteudo(dados)}
      ${renderJustificativaPaybackConteudo(dados)}
      ${renderPrazoHistoricoConteudo(dados)}
      ${renderPotenciaGeradorConteudo(dados)}
      ${renderInstalacaoPosicaoConteudo(dados)}
      ${renderEquipamentosNormasConteudo(dados)}
      ${renderGarantiasMateriaisConteudo(dados)}
      ${renderAssinaturaConteudo(dados)}
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>${nomeProposta}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${propostaBaseCssBNB()}
${pagedCss}

/* ===== CONTROLE DE QUEBRAS DE PÁGINA ===== */
/* Evita quebras no meio de elementos importantes */
.bnb-section,
.bnb-equip-block,
.bnb-kpi-row,
.bnb-formula,
.bnb-sign-block,
.garantia-item,
.bnb-orc-total-banner,
.bnb-table {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Controla linhas órfãs/viúvas */
.bnb-section p,
.bnb-equip-block p,
.bnb-sign-block p,
.garantia-item p {
  orphans: 3;
  widows: 3;
}

/* Força cabeçalhos com o conteúdo seguinte */
.section-bar,
.bnb-section h3,
.bnb-equip-block h4 {
  page-break-after: avoid;
  break-after: avoid;
}

/* Tabela: evita quebra no meio e mantém cabeçalho com corpo */
.bnb-table thead {
  display: table-header-group;
}
.bnb-table tbody tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Capa fica em página separada (primeira página) */
#pageCapa {
  page-break-after: always;
  break-after: page;
}

/* Conteúdo principal pode quebrar naturalmente */
#pageConteudo {
  page-break-before: auto;
  break-before: auto;
}

/* Remove as quebras forçadas das seções */
.bnb-section-break {
  display: none;
}

</style>
${pagedLoader}
</head>
<body>
<nav>
  <a href="#pageCapa" class="active">Capa</a>
  <a href="#pageConteudo">Conteúdo</a>
</nav>

${conteudoHTML}

<script>
(function(){
  var links = document.querySelectorAll('nav a');
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ 
      if(e.isIntersecting){ 
        links.forEach(function(a){a.classList.remove('active');}); 
        var l = document.querySelector('nav a[href="#'+e.target.id+'"]'); 
        if(l) l.classList.add('active'); 
      } 
    });
  }, { threshold:.4 });
  document.querySelectorAll('.page').forEach(function(p){obs.observe(p);});
})();
<\/script>
</body></html>`;
}
window.renderPropostaBNBHTML = renderPropostaBNBHTML;

// ============================================================
// FUNÇÃO: NOME DO ARQUIVO DA PROPOSTA BNB
// ============================================================
function montarNomePropostaArquivoBNB(dados){
  const cod = dados.codigoProposta ? '' : '';
  const cliente = (dados.cliente?.nome || dados.identificacao?.nome || 'CLIENTE').toUpperCase();
  const dataStr = new Date().toLocaleDateString('pt-BR').split('/').join('.');
  const nome = `ORÇAMENTO BNB - ${cliente} - ${dataStr}`;
  return String(nome).replace(/[\\/:*?"<>|]/g,'').trim();
}
window.montarNomePropostaArquivoBNB = montarNomePropostaArquivoBNB;

// ============================================================
// FUNÇÃO: ABRIR PROPOSTA COMPLETA BNB
// Espelha o fluxo de abrirPropostaCompleta() da proposta comercial:
// valida valor, monta dados, renderiza, abre em nova aba e salva histórico.
//
// v1.2: agora também valida que um cliente foi selecionado — o laudo
// técnico do BNB depende dos dados de identificação e do histórico de
// consumo do cliente, então não faz sentido gerar sem esse vínculo.
// (A validação "amigável", com foco no seletor de cliente, já acontece
// antes disso em pages/orcamento.js; esta aqui é a segunda barreira,
// caso a função seja chamada diretamente de outro lugar.)
// ============================================================
async function abrirPropostaCompletaBNB(data, config){
  if(!data.resultado || data.resultado.totalGeral <= 0){
    if (typeof toast === 'function') {
      toast('Preencha o "Valor Fornecedor" no orçamento antes de gerar a proposta BNB.', 'warning');
    }
    return;
  }

  if(!data.cliente || !data.cliente.id){
    if (typeof toast === 'function') {
      toast('Selecione um cliente antes de gerar a proposta BNB.', 'warning');
    }
    return;
  }

  const codigoProposta = data.codigoProposta ||
    (typeof window.gerarCodigoProposta === 'function' ? window.gerarCodigoProposta(data.vendedor) : '');

  const dadosParaHistorico = { ...data, codigoProposta };

  const dados = montarDadosPropostaBNB(dadosParaHistorico, config || {});
  const html = renderPropostaBNBHTML(dados);
  const blob = new Blob([html], { type:'text/html' });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, '_blank');
  if (win && typeof window.aguardarPagedJsEPreparar === 'function') {
    window.aguardarPagedJsEPreparar(win);
  }

  if (data.salvarHistorico !== false && typeof salvarOrcamentoHistorico === 'function') {
    setTimeout(async () => {
      try { await salvarOrcamentoHistorico(dadosParaHistorico); }
      catch(e) { console.warn('Erro ao salvar histórico (BNB):', e); }
    }, 100);
  }
}
window.abrirPropostaCompletaBNB = abrirPropostaCompletaBNB;

console.log('%c⚡ Solar Pro 2.0 — proposta-completa-bnb.js v1.4 (irradiância unificada por estado do cliente em todo o documento) carregado', 'color:#ffb020;font-weight:bold');
