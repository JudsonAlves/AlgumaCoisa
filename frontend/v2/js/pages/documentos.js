// ============================================================
// SOLAR PRO 2.0 — pages/documentos.js
// "Modelos de Documento": upload de QUALQUER .docx (contrato,
// procuração, o que for) contendo códigos <<assim>> em qualquer
// lugar do texto. Na hora de gerar, cada <<codigo>> é trocado
// pelo valor real do cliente/orçamento selecionado, e o .docx
// preenchido é baixado — sem precisar tocar em código pra cada
// novo modelo.
//
// Arquitetura:
//  - Os .docx ficam no Drive (endpoint /documentos-templates no
//    GAS); o navegador só baixa o arquivo quando vai gerar.
//  - A substituição roda 100% no navegador via JSZip: abre o
//    .docx como zip, edita o XML interno (word/document.xml +
//    headers/footers), refaz o zip e devolve como download.
//  - CATALOGO_VARIAVEIS é a lista fixa de <<códigos>> que o
//    sistema reconhece. montarValoresDocumento() é quem de fato
//    calcula o valor de cada um a partir do orçamento atual.
// ============================================================

// ---------------------------------------------------------------
// CATÁLOGO DE VARIÁVEIS — referência exibida na tela e usada como
// validação (códigos digitados no Word que não estiverem aqui são
// avisados ao usuário, não silenciosamente ignorados).
// ---------------------------------------------------------------
const CATALOGO_VARIAVEIS = [
  { categoria: 'Cliente', codigo: 'cliente_nome', label: 'Nome do cliente' },
  { categoria: 'Cliente', codigo: 'cliente_pessoa', label: 'Rótulo do documento — "CPF" ou "CNPJ"' },
  { categoria: 'Cliente', codigo: 'cliente_documento', label: 'Número do CPF/CNPJ formatado' },
  { categoria: 'Cliente', codigo: 'cliente_endereco', label: 'Endereço (rua/avenida)' },
  { categoria: 'Cliente', codigo: 'cliente_numero', label: 'Número' },
  { categoria: 'Cliente', codigo: 'cliente_complemento', label: 'Complemento' },
  { categoria: 'Cliente', codigo: 'cliente_bairro', label: 'Bairro' },
  { categoria: 'Cliente', codigo: 'cliente_cep', label: 'CEP' },
  { categoria: 'Cliente', codigo: 'cliente_cidade', label: 'Cidade' },
  { categoria: 'Cliente', codigo: 'cliente_estado', label: 'Estado' },
  { categoria: 'Cliente', codigo: 'cliente_telefone', label: 'Telefone' },
  { categoria: 'Cliente', codigo: 'cliente_email', label: 'E-mail' },
  { categoria: 'Cliente', codigo: 'cliente_endereco_completo', label: 'Endereço todo junto, já formatado numa linha' },

  { categoria: 'Kit / Equipamentos', codigo: 'potencia_kit', label: 'Potência total do kit (kWp)' },
  { categoria: 'Kit / Equipamentos', codigo: 'geracao_estimada', label: 'Geração estimada (kWh/mês)' },
  { categoria: 'Kit / Equipamentos', codigo: 'placas_descricao', label: 'Descrição das placas (marca/modelo/potência)' },
  { categoria: 'Kit / Equipamentos', codigo: 'placas_qtd', label: 'Quantidade total de placas' },
  { categoria: 'Kit / Equipamentos', codigo: 'inversores_descricao', label: 'Descrição dos inversores' },
  { categoria: 'Kit / Equipamentos', codigo: 'inversores_qtd', label: 'Quantidade total de inversores' },
  { categoria: 'Kit / Equipamentos', codigo: 'baterias_descricao', label: 'Descrição das baterias' },
  { categoria: 'Kit / Equipamentos', codigo: 'baterias_qtd', label: 'Quantidade total de baterias' },
  { categoria: 'Kit / Equipamentos', codigo: 'garantia_placa', label: 'Garantia de fabricação da placa (anos, menor entre os modelos)' },
  { categoria: 'Kit / Equipamentos', codigo: 'garantia_placa_geracao', label: 'Garantia de geração/potência linear da placa (anos)' },
  { categoria: 'Kit / Equipamentos', codigo: 'garantia_inversor', label: 'Garantia do inversor (anos, menor entre os modelos)' },
  { categoria: 'Kit / Equipamentos', codigo: 'estrutura_nome', label: 'Nome da estrutura de fixação escolhida' },
  { categoria: 'Kit / Equipamentos', codigo: 'estrutura_tipo', label: 'Tipo da estrutura (telhado cerâmico, metálico, solo...)' },

  { categoria: 'Financeiro', codigo: 'valor_total', label: 'Valor total do orçamento (ex: 53.200,00)' },
  { categoria: 'Financeiro', codigo: 'valor_total_extenso', label: 'Valor total por extenso' },
  { categoria: 'Financeiro', codigo: 'forma_pagamento', label: 'Texto da forma de pagamento (você digita/ajusta ao gerar)' },
  { categoria: 'Financeiro', codigo: 'recall_texto', label: 'Texto de recall/troca de equipamento (você monta ao gerar, se houver)' },

  { categoria: 'Vendedor', codigo: 'vendedor_nome', label: 'Nome do vendedor responsável' },
  { categoria: 'Vendedor', codigo: 'vendedor_telefone', label: 'Telefone do vendedor' },

  { categoria: 'Empresa', codigo: 'empresa_nome', label: 'Nome da empresa (Personalização da Proposta)' },
  { categoria: 'Empresa', codigo: 'empresa_endereco', label: 'Endereço da empresa' },
  { categoria: 'Empresa', codigo: 'empresa_telefone', label: 'Telefone da empresa' },
  { categoria: 'Empresa', codigo: 'empresa_site', label: 'Site da empresa' },

  { categoria: 'Data', codigo: 'data_atual', label: 'Data de hoje (01/07/2026)' },
  { categoria: 'Data', codigo: 'data_extenso', label: 'Data de hoje por extenso (01 de julho de 2026)' },
];
window.CATALOGO_VARIAVEIS = CATALOGO_VARIAVEIS;

// ---------------------------------------------------------------
// NÚMERO POR EXTENSO (reais/centavos, pt-BR)
// ---------------------------------------------------------------
const _EXT_UNIDADES = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez',
  'onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const _EXT_DEZENAS = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const _EXT_CENTENAS = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];

function _extensoGrupo(n){
  if(n === 0) return '';
  if(n === 100) return 'cem';
  const partes = [];
  const c = Math.floor(n/100), resto = n % 100;
  if(c > 0) partes.push(_EXT_CENTENAS[c]);
  if(resto > 0){
    if(resto < 20) partes.push(_EXT_UNIDADES[resto]);
    else {
      const d = Math.floor(resto/10), u = resto % 10;
      partes.push(u > 0 ? `${_EXT_DEZENAS[d]} e ${_EXT_UNIDADES[u]}` : _EXT_DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

function _extensoInteiro(n){
  if(n === 0) return 'zero';
  const escalaSing = ['', 'mil', 'milhão', 'bilhão'];
  const escalaPlur = ['', 'mil', 'milhões', 'bilhões'];
  const blocos = [];
  let resto = n;
  while(resto > 0){ blocos.push(resto % 1000); resto = Math.floor(resto/1000); }

  const partes = [];
  for(let i = blocos.length-1; i >= 0; i--){
    const v = blocos[i];
    if(v === 0) continue;
    let texto = _extensoGrupo(v);
    if(i === 1) texto = (v === 1) ? 'mil' : `${texto} mil`;
    else if(i >= 2) texto = `${texto} ${v === 1 ? escalaSing[i] : escalaPlur[i]}`;
    partes.push({ texto, v, i });
  }

  let resultado = '';
  partes.forEach((p, idx) => {
    if(idx === 0){ resultado = p.texto; return; }
    const isLast = idx === partes.length - 1;
    const usaE = isLast && p.i === 0 && (p.v < 100 || p.v % 100 === 0);
    resultado += (usaE ? ' e ' : ', ') + p.texto;
  });
  return resultado;
}

function numeroPorExtenso(valor){
  const v = Math.round((valor || 0) * 100) / 100;
  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);
  let texto = _extensoInteiro(inteiro) + (inteiro === 1 ? ' real' : ' reais');
  if(centavos > 0) texto += ' e ' + _extensoInteiro(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  return texto;
}
window.numeroPorExtenso = numeroPorExtenso;

// ---------------------------------------------------------------
// CPF/CNPJ — infere o tipo pelo tamanho, formata com máscara
// ---------------------------------------------------------------
function inferirPessoa(cpfCnpj){
  const digitos = String(cpfCnpj || '').replace(/\D/g, '');
  return digitos.length > 11 ? 'CNPJ' : 'CPF';
}
function formatarCpfCnpj(cpfCnpj){
  const d = String(cpfCnpj || '').replace(/\D/g, '');
  if(d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if(d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cpfCnpj || '';
}
window.inferirPessoa = inferirPessoa;
window.formatarCpfCnpj = formatarCpfCnpj;

// ---------------------------------------------------------------
// MONTAR VALORES — o mapa código → valor real, a partir dos
// mesmos objetos que orcamento.js já usa (OS / data)
// ---------------------------------------------------------------
function montarValoresDocumento(data, extras, config){
  const r = data.resultado || {};
  const cliente = data.cliente || {};
  const vendedor = data.vendedor || {};
  const cfg = config || {};
  const ex = extras || {};

  const potenciaKit = (data.itensPlaca || []).reduce((acc,i) => acc + Calc.potenciaKit(i.placa, i.qtd), 0);

  const placasDesc = (data.itensPlaca || [])
    .map(i => `PAINEL SOLAR ${i.placa.marca||''} ${i.placa.potencia||0}W ${i.placa.tipo||''}`.replace(/\s+/g,' ').trim())
    .join(' + ') || '—';
  const placasQtd = (data.itensPlaca || []).reduce((a,i) => a+i.qtd, 0);

  const inversoresDesc = (data.itensInversor || [])
    .map(i => `INVERSOR SOLAR ${i.inversor.marca||''} ${i.inversor.tipo||''} ${i.inversor.potencia ? (i.inversor.potencia/1000)+'kW' : ''} ${i.inversor.tensao||''}V`.replace(/\s+/g,' ').trim())
    .join(' + ') || '—';
  const inversoresQtd = (data.itensInversor || []).reduce((a,i) => a+i.qtd, 0);

  const bateriasDesc = (data.itensBateria || [])
    .map(i => `${i.qtd}x ${i.bateria.nome||'Bateria'}`.trim())
    .join(' + ') || '—';
  const bateriasQtd = (data.itensBateria || []).reduce((a,i) => a+i.qtd, 0);

  const garantiaPlaca = (data.itensPlaca||[]).length
    ? Math.min(...data.itensPlaca.map(i => parseInt(i.placa.garantia) || 12)) : 12;
  const garantiaPlacaGer = (data.itensPlaca||[]).length
    ? Math.min(...data.itensPlaca.map(i => parseInt(i.placa.garantiager) || 25)) : 25;
  const garantiaInversor = (data.itensInversor||[]).length
    ? Math.min(...data.itensInversor.map(i => parseInt(i.inversor.garantia) || 10)) : 10;

  const enderecoCompleto = [
    [cliente.endereco, cliente.numero].filter(Boolean).join(', '),
    cliente.complemento,
    cliente.bairro,
    cliente.cep ? `CEP ${cliente.cep}` : '',
    [cliente.cidade, cliente.estado].filter(Boolean).join('/'),
  ].filter(Boolean).join(', ');

  const hoje = new Date();

  return {
    cliente_nome: cliente.nome || '',
    cliente_pessoa: inferirPessoa(cliente.cpf_cnpj),
    cliente_documento: formatarCpfCnpj(cliente.cpf_cnpj),
    cliente_endereco: cliente.endereco || '',
    cliente_numero: cliente.numero || '',
    cliente_complemento: cliente.complemento || '',
    cliente_bairro: cliente.bairro || '',
    cliente_cep: cliente.cep || '',
    cliente_cidade: cliente.cidade || '',
    cliente_estado: cliente.estado || '',
    cliente_telefone: cliente.telefone || '',
    cliente_email: cliente.email || '',
    cliente_endereco_completo: enderecoCompleto,

    potencia_kit: formatarNumero(potenciaKit, 2),
    geracao_estimada: formatarNumero(r.geracaoExibida || r.geracaoReal || 0, 0),
    placas_descricao: placasDesc,
    placas_qtd: String(placasQtd),
    inversores_descricao: inversoresDesc,
    inversores_qtd: String(inversoresQtd),
    baterias_descricao: bateriasDesc,
    baterias_qtd: String(bateriasQtd),
    garantia_placa: String(garantiaPlaca),
    garantia_placa_geracao: String(garantiaPlacaGer),
    garantia_inversor: String(garantiaInversor),
    estrutura_nome: data.estrutura?.nome || '',
    estrutura_tipo: data.estrutura?.tipo || '',

    valor_total: formatarNumero(r.totalGeral || 0, 2),
    valor_total_extenso: numeroPorExtenso(r.totalGeral || 0),
    forma_pagamento: ex.formaPagamento || '',
    recall_texto: ex.recallTexto || '',

    vendedor_nome: vendedor.nome || '',
    vendedor_telefone: vendedor.telefone || '',

    empresa_nome: cfg.empresa_nome || 'Rocha Engenharia',
    empresa_endereco: cfg.rodape_endereco || '',
    empresa_telefone: cfg.rodape_telefone || '',
    empresa_site: cfg.rodape_site || '',

    data_atual: hoje.toLocaleDateString('pt-BR'),
    data_extenso: hoje.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }),
  };
}
window.montarValoresDocumento = montarValoresDocumento;

// ---------------------------------------------------------------
// JUROS NO PARCELAMENTO (boleto) — mesma regra de 3 opções usada
// nos sistemas de orçamento em VBA que este projeto substitui:
//   'nenhum'     -> parcela = base / n
//   'percentual' -> parcela = (base / n) * (1 + jurosValor)   [jurosValor decimal, ex: 0.0163 = 1,63%]
//   'fixo'       -> parcela = jurosValor (valor digitado direto, ignora base/n)
// ---------------------------------------------------------------
function calcularValorParcelaComJuros(base, n, jurosTipo, jurosValor){
  const qtd = n > 0 ? n : 1;
  switch(jurosTipo){
    case 'percentual':
      return (base / qtd) * (1 + (jurosValor || 0));
    case 'fixo':
      return (jurosValor > 0) ? jurosValor : base / qtd;
    default: // 'nenhum'
      return base / qtd;
  }
}
window.calcularValorParcelaComJuros = calcularValorParcelaComJuros;

// ---------------------------------------------------------------
// Texto padrão de forma de pagamento — só um ponto de partida,
// sempre editável antes de gerar o documento.
//
// tipo cobre as 12 formas de pagamento:
//   avista, avista_entrada_restante, boleto_parcelado, entrada_boleto,
//   financiamento, entrada_financiamento, financiamento_proprio,
//   cartao, cartao_restante, entrada_cartao, cartao_financiamento,
//   dividido_primeira
//
// jurosTipo/jurosValor só valem pra tipos com boleto (boleto_parcelado,
// entrada_boleto, dividido_primeira). primeiraParcela só vale pra
// dividido_primeira (valor da 1ª parcela, diferente das demais).
// ---------------------------------------------------------------
function gerarTextoPagamentoPadrao(tipo, valorTotal, entrada, parcelas, jurosTipo, jurosValor, primeiraParcela){
  const fmt = v => formatarNumero(v, 2);
  const ext = v => numeroPorExtenso(v);
  const restante = Math.max(0, valorTotal - (entrada||0));
  jurosTipo = jurosTipo || 'nenhum';
  jurosValor = jurosValor || 0;

  switch(tipo){
    case 'avista':
      return `Pagamento à vista no valor de ${fmt(valorTotal)} (${ext(valorTotal)}).`;

    case 'avista_entrada_restante':
      return `Entrada de ${fmt(entrada)} (${ext(entrada)}) e o restante de ${fmt(restante)} (${ext(restante)}) será pago mediante a última etapa (ligação/vistoria) do projeto.`;

    case 'boleto_parcelado': {
      const parcela = calcularValorParcelaComJuros(valorTotal, parcelas, jurosTipo, jurosValor);
      return `Pagamento de ${fmt(valorTotal)} (${ext(valorTotal)}) dividido em ${parcelas} vezes no boleto, no valor de ${fmt(parcela)} (${ext(parcela)}).`;
    }

    case 'entrada_boleto': {
      const parcela = calcularValorParcelaComJuros(restante, parcelas, jurosTipo, jurosValor);
      return `Entrada de ${fmt(entrada)} (${ext(entrada)}) e o restante de ${fmt(restante)} (${ext(restante)}) dividido em ${parcelas} vezes no boleto, no valor de ${fmt(parcela)} (${ext(parcela)}).`;
    }

    case 'financiamento':
      return `Financiamento Bancário de ${fmt(valorTotal)} (${ext(valorTotal)}).`;

    case 'entrada_financiamento':
      return `Entrada de ${fmt(entrada)} (${ext(entrada)}) e o restante de ${fmt(restante)} (${ext(restante)}) via Financiamento Bancário.`;

    case 'financiamento_proprio':
      return `Financiamento Próprio de ${fmt(valorTotal)} (${ext(valorTotal)}).`;

    case 'cartao':
      return `Pagamento de ${fmt(valorTotal)} (${ext(valorTotal)}) via Cartão de Crédito.`;

    case 'cartao_restante':
      return `Pagamento de ${fmt(entrada)} (${ext(entrada)}) via Cartão de Crédito e o restante de ${fmt(restante)} (${ext(restante)}) será pago mediante a última etapa (ligação/vistoria) do projeto.`;

    case 'entrada_cartao':
      return `Entrada de ${fmt(entrada)} (${ext(entrada)}) e o restante de ${fmt(restante)} (${ext(restante)}) via Cartão de Crédito.`;

    case 'cartao_financiamento':
      return `Entrada de ${fmt(entrada)} (${ext(entrada)}) via Cartão de Crédito e o restante de ${fmt(restante)} (${ext(restante)}) via Financiamento Bancário.`;

    case 'dividido_primeira': {
      const primeira = primeiraParcela || 0;
      const nRestantes = Math.max(1, (parcelas || 1) - 1);
      const baseRestante = Math.max(0, valorTotal - primeira);
      const parcela = calcularValorParcelaComJuros(baseRestante, nRestantes, jurosTipo, jurosValor);
      return `Pagamento de ${fmt(valorTotal)} (${ext(valorTotal)}) dividido em ${parcelas} vezes, sendo a primeira no valor de ${fmt(primeira)} (${ext(primeira)}) e o restante em ${nRestantes} vezes no valor de ${fmt(parcela)} (${ext(parcela)}).`;
    }

    default:
      return '';
  }
}
window.gerarTextoPagamentoPadrao = gerarTextoPagamentoPadrao;

// ---------------------------------------------------------------
// RECALL / TROCA DE EQUIPAMENTO — quando o contratante entrega um
// inversor e/ou placas usados como parte do pagamento, visando
// receber equipamento mais atualizado com desconto. `itens` é uma
// lista de { tipo:'inversor'|'placa', qtd, descricao }, montada a
// partir dos equipamentos cadastrados no sistema (ver
// abrirModalGerarDocumento). Gera um texto único, corrido, mesmo
// quando há mais de um item (inversor + placas juntos).
// ---------------------------------------------------------------
const _QTD_POR_EXTENSO_RECALL = {1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez'};

function gerarTextoRecallPadrao(itens, empresaNome){
  const lista = (itens || []).filter(it => it && it.qtd > 0 && it.descricao);
  if(!lista.length) return '';

  const empresa = (empresaNome || '').trim() || 'a CONTRATADA';

  const partes = lista.map(it => {
    const qtdExt = _QTD_POR_EXTENSO_RECALL[it.qtd] || String(it.qtd);
    const qtdTxt = `${it.qtd} (${qtdExt})`;
    if(it.tipo === 'inversor'){
      return `${qtdTxt} inversor${it.qtd > 1 ? 'es' : ''} ${it.descricao}`;
    }
    return `${qtdTxt} placa${it.qtd > 1 ? 's' : ''} solar${it.qtd > 1 ? 'es' : ''} ${it.descricao}`;
  });

  const listaTexto = partes.length === 1
    ? partes[0]
    : partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];

  const plural = lista.length > 1 || lista.some(it => it.qtd > 1);

  return `O CONTRATANTE entregará à ${empresa}, a título de troca, ${listaTexto}.`;
}
window.gerarTextoRecallPadrao = gerarTextoRecallPadrao;

// ---------------------------------------------------------------
// MOTOR DE SUBSTITUIÇÃO — troca <<codigo>> pelo valor real dentro
// do XML do .docx, mesmo quando o Word quebra o texto do código
// em runs (<w:t>) diferentes por causa de autocorreção/edições.
//
// Estratégia: processa parágrafo por parágrafo. Dentro de cada
// parágrafo, reconstrói o texto visível juntando todos os <w:t>,
// acha o primeiro <<codigo>> válido, e substitui só os runs que
// aquele token específico atravessa — os demais runs do parágrafo
// (antes/depois, sem token) não são tocados, preservando a
// formatação original deles.
// ---------------------------------------------------------------
function _escapeXmlTexto(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _decodeXmlTexto(s){
  return String(s ?? '')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}

function _substituirTokensNoParagrafo(paragrafoXml, valores, codigosNaoReconhecidos){
  let xml = paragrafoXml;
  // eslint-disable-next-line no-constant-condition
  while(true){
    const tRegex = /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g;
    const runs = [];
    let m;
    while((m = tRegex.exec(xml))){
      runs.push({ attrs: m[1], text: _decodeXmlTexto(m[2]), start: m.index, end: m.index + m[0].length });
    }
    if(!runs.length) break;

    let flat = '';
    const runStartPos = [];
    runs.forEach(r => { runStartPos.push(flat.length); flat += r.text; });

    const tokenRegex = /<<\s*([a-zA-Z0-9_]+)\s*>>/g;
    let tm, achou = null;
    while((tm = tokenRegex.exec(flat))){
      if(Object.prototype.hasOwnProperty.call(valores, tm[1])){ achou = tm; break; }
      codigosNaoReconhecidos.add(tm[1]);
    }
    if(!achou) break;

    const matchStart = achou.index;
    const matchEnd = matchStart + achou[0].length;

    const runDoIndex = (pos) => {
      for(let i = runs.length - 1; i >= 0; i--){ if(runStartPos[i] <= pos) return i; }
      return 0;
    };
    const riIni = runDoIndex(matchStart);
    const riFim = runDoIndex(matchEnd - 1);

    const offIni = matchStart - runStartPos[riIni];
    const offFim = (matchEnd - 1) - runStartPos[riFim] + 1;

    const antes  = runs[riIni].text.slice(0, offIni);
    const depois = runs[riFim].text.slice(offFim);
    const novoTexto = antes + String(valores[achou[1]] ?? '') + depois;

    let attrsIni = runs[riIni].attrs;
    if(!attrsIni.includes('xml:space')) attrsIni += ' xml:space="preserve"';
    const novoRunXml = `<w:t${attrsIni}>${_escapeXmlTexto(novoTexto)}</w:t>`;

    const spanStart = runs[riIni].start;
    const spanEnd = runs[riFim].end;
    xml = xml.slice(0, spanStart) + novoRunXml + xml.slice(spanEnd);
    // repete o while: pode haver mais de um <<codigo>> no mesmo parágrafo
  }
  return xml;
}

function substituirVariaveisXml(xmlDoc, valores){
  const codigosNaoReconhecidos = new Set();
  const xml = xmlDoc.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => _substituirTokensNoParagrafo(p, valores, codigosNaoReconhecidos));
  return { xml, codigosNaoReconhecidos: Array.from(codigosNaoReconhecidos) };
}
window.substituirVariaveisXml = substituirVariaveisXml;

// ---------------------------------------------------------------
// DETECÇÃO DE CÓDIGOS — varre o .docx (sem substituir nada) e
// devolve quais <<codigo>> aparecem nele. Usado pra só perguntar
// "forma de pagamento" quando o modelo realmente tem essa variável
// (nem todo modelo tem campo de preço — laudo, procuração etc.).
// ---------------------------------------------------------------
function _detectarTokensNoXml(xmlString){
  const codigos = new Set();
  const paragrafos = xmlString.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  paragrafos.forEach(p => {
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let flat = '', m;
    while((m = tRegex.exec(p))){ flat += _decodeXmlTexto(m[1]); }
    const tokenRegex = /<<\s*([a-zA-Z0-9_]+)\s*>>/g;
    let tm;
    while((tm = tokenRegex.exec(flat))){ codigos.add(tm[1]); }
  });
  return codigos;
}

async function detectarCodigosNoTemplate(templateArrayBuffer){
  const zip = await JSZip.loadAsync(templateArrayBuffer);
  const alvos = Object.keys(zip.files).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/.test(p));
  const codigos = new Set();
  for(const caminho of alvos){
    const arquivo = zip.file(caminho);
    if(!arquivo) continue;
    const xml = await arquivo.async('string');
    _detectarTokensNoXml(xml).forEach(c => codigos.add(c));
  }
  return codigos;
}
window.detectarCodigosNoTemplate = detectarCodigosNoTemplate;

// ---------------------------------------------------------------
// Gera o .docx final a partir do template (ArrayBuffer) + valores.
// montarDocumentoDocxBlob() só MONTA (retorna o blob, sem baixar) —
// serve tanto pra "Baixar" quanto pra "Visualizar"/"gerar PDF".
// gerarDocumentoDocx() é o atalho que monta E já baixa (uso antigo).
// ---------------------------------------------------------------
function baixarBlob(blob, nomeArquivo){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function montarDocumentoDocxBlob(templateArrayBuffer, valores){
  const zip = await JSZip.loadAsync(templateArrayBuffer);
  const alvos = Object.keys(zip.files).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/.test(p));
  const codigosNaoReconhecidos = new Set();

  for(const caminho of alvos){
    const arquivo = zip.file(caminho);
    if(!arquivo) continue;
    const xmlOriginal = await arquivo.async('string');
    const { xml, codigosNaoReconhecidos: naoReconhecidos } = substituirVariaveisXml(xmlOriginal, valores);
    naoReconhecidos.forEach(c => codigosNaoReconhecidos.add(c));
    zip.file(caminho, xml);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  return { blob, codigosNaoReconhecidos: Array.from(codigosNaoReconhecidos) };
}
window.montarDocumentoDocxBlob = montarDocumentoDocxBlob;

async function gerarDocumentoDocx(templateArrayBuffer, valores, nomeArquivoSaida){
  const { blob, codigosNaoReconhecidos } = await montarDocumentoDocxBlob(templateArrayBuffer, valores);
  baixarBlob(blob, nomeArquivoSaida.endsWith('.docx') ? nomeArquivoSaida : nomeArquivoSaida + '.docx');
  return codigosNaoReconhecidos;
}
window.gerarDocumentoDocx = gerarDocumentoDocx;

// ---------------------------------------------------------------
// docx (Blob) -> HTML (mammoth) — usado tanto pra "Visualizar"
// quanto como base pra gerar o PDF.
// ---------------------------------------------------------------
async function converterDocxParaHtml(docxBlob){
  const arrayBuffer = await docxBlob.arrayBuffer();
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });
  return { html, messages };
}
window.converterDocxParaHtml = converterDocxParaHtml;

// ---------------------------------------------------------------
// docx (Blob) -> PDF (Blob): renderiza o HTML (via mammoth) numa
// folha A4 escondida e "tira um print" página a página com
// html2canvas + jsPDF (mesma técnica do Print Screen já usado no
// projeto). Não é uma conversão pixel-perfect do layout original
// do Word, mas preserva texto, títulos, negrito/itálico e listas.
// ---------------------------------------------------------------
async function converterDocxParaPdfBlob(docxBlob){
  const { html } = await converterDocxParaHtml(docxBlob);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;padding:56px;background:#fff;font-family:Georgia,\'Times New Roman\',serif;font-size:14px;line-height:1.6;color:#111;';
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  try{
    const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * (imgWidth / canvas.width);
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while(heightLeft > 0){
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    return pdf.output('blob');
  } finally {
    wrapper.remove();
  }
}
window.converterDocxParaPdfBlob = converterDocxParaPdfBlob;

// ============================================================
// PÁGINA: /documentos — upload, lista e catálogo de referência
// ============================================================
async function pageDocumentos(){
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando modelos...</div>`;

  const templates = await apiGetCached('/documentos-templates');
  const lista = Array.isArray(templates) ? templates : [];

  view.innerHTML = `
    <div class="view-head">
      <div><h1>Modelos de Documento</h1><p>Envie um .docx (contrato, procuração, o que precisar) com códigos <<code>>assim<</code>> — o sistema troca pelo valor real na hora de gerar</p></div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div>
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('upload')}</div>
            <div><h3>Enviar novo modelo</h3><div class="sub">Formato .docx (Word)</div></div>
          </div>
          <div class="form-grid1">
            <div class="field"><label>Nome do modelo</label><input class="input" id="docNome" placeholder="Ex: Contrato de Instalação, Procuração"></div>
            <div class="field">
              <label>Arquivo (.docx)</label>
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <button type="button" class="btn btn-secondary btn-sm" id="btnEscolherArquivo">${icon('file-plus')} Escolher arquivo</button>
                <input type="file" id="docArquivo" accept=".docx" style="display:none">
                <span id="docArquivoNome" class="text-faint" style="font-size:12px">Nenhum arquivo selecionado</span>
              </div>
            </div>
          </div>
          <button class="btn btn-primary mt-16" id="btnEnviarTemplate" style="width:100%">${icon('upload')} Enviar modelo</button>
        </div>

        <div class="card">
          <div class="card-head"><div class="ico">${icon('folder')}</div><div class="grow"><h3>Modelos enviados</h3><div class="sub">${lista.length} modelo(s)</div></div></div>
          <div id="listaTemplates"></div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-head">
            <div class="ico">${icon('code')}</div>
            <div><h3>Códigos disponíveis</h3><div class="sub">Digite exatamente assim no Word — clique pra copiar</div></div>
          </div>
          <div id="catalogoVariaveis"></div>
        </div>
      </div>
    </div>
  `;
  refreshIcons();

  renderListaTemplates(lista);
  renderCatalogoVariaveis();

  document.getElementById('btnEscolherArquivo').addEventListener('click', () => document.getElementById('docArquivo').click());
  document.getElementById('docArquivo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    document.getElementById('docArquivoNome').textContent = f ? f.name : 'Nenhum arquivo selecionado';
    if(f && !document.getElementById('docNome').value){
      document.getElementById('docNome').value = f.name.replace(/\.docx$/i, '');
    }
  });

  document.getElementById('btnEnviarTemplate').addEventListener('click', enviarNovoTemplate);
}
window.pageDocumentos = pageDocumentos;

function renderCatalogoVariaveis(){
  const el = document.getElementById('catalogoVariaveis');
  if(!el) return;
  const categorias = [...new Set(CATALOGO_VARIAVEIS.map(v => v.categoria))];
  el.innerHTML = categorias.map(cat => `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-faint);margin-bottom:8px">${cat}</div>
      ${CATALOGO_VARIAVEIS.filter(v => v.categoria === cat).map(v => `
        <div class="item-row" data-copy-codigo="${v.codigo}" style="cursor:pointer;padding:8px 10px">
          <div class="main">
            <div class="title" style="font-family:monospace;font-size:12.5px">&lt;&lt;${v.codigo}&gt;&gt;</div>
            <div class="subtitle">${v.label}</div>
          </div>
          <div class="icon-sm">${icon('copy')}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
  refreshIcons();

  el.querySelectorAll('[data-copy-codigo]').forEach(row => {
    row.addEventListener('click', async () => {
      const codigo = row.getAttribute('data-copy-codigo');
      const texto = `<<${codigo}>>`;
      try{
        await navigator.clipboard.writeText(texto);
        toast(`Copiado: ${texto}`, 'success', 1800);
      }catch(e){
        toast('Não foi possível copiar automaticamente — selecione o texto manualmente', 'warning');
      }
    });
  });
}

function renderListaTemplates(lista){
  const el = document.getElementById('listaTemplates');
  if(!el) return;
  if(lista.length === 0){
    el.innerHTML = `<div class="empty-state" style="padding:22px">${icon('file-x')}<p style="font-size:12.5px">Nenhum modelo enviado ainda</p></div>`;
    refreshIcons();
    return;
  }
  el.innerHTML = `<div class="data-grid">${lista.slice().reverse().map(t => `
    <div class="item-row">
      <div class="icon-sm">${icon('file-text')}</div>
      <div class="main">
        <div class="title">${t.nome}</div>
        <div class="subtitle">${t.tamanho_bytes ? formatarNumero(t.tamanho_bytes/1024,0) + ' KB' : ''} ${t.created_at ? '· ' + fmtDate(t.created_at) : ''}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-icon btn-ghost" data-gerar="${t.id}" title="Gerar documento">${icon('file-output')}</button>
        <button class="btn btn-icon btn-ghost" data-renomear="${t.id}" title="Renomear">${icon('pencil')}</button>
        <button class="btn btn-icon btn-danger" data-excluir="${t.id}" title="Excluir">${icon('trash-2')}</button>
      </div>
    </div>
  `).join('')}</div>`;
  refreshIcons();

  el.querySelectorAll('[data-gerar]').forEach(btn => btn.addEventListener('click', () => {
    const t = lista.find(x => x.id == btn.getAttribute('data-gerar'));
    abrirModalGerarDocumento(t);
  }));
  el.querySelectorAll('[data-renomear]').forEach(btn => btn.addEventListener('click', () => {
    const t = lista.find(x => x.id == btn.getAttribute('data-renomear'));
    renomearTemplate(t);
  }));
  el.querySelectorAll('[data-excluir]').forEach(btn => btn.addEventListener('click', () => {
    const t = lista.find(x => x.id == btn.getAttribute('data-excluir'));
    excluirTemplate(t);
  }));
}

async function enviarNovoTemplate(){
  const nome = document.getElementById('docNome').value.trim();
  const fileInput = document.getElementById('docArquivo');
  const file = fileInput.files[0];

  if(!nome){ toast('Dê um nome para o modelo', 'warning'); return; }
  if(!file){ toast('Selecione um arquivo .docx', 'warning'); return; }
  if(!file.name.toLowerCase().endsWith('.docx')){ toast('O arquivo precisa ser .docx', 'error'); return; }

  const btn = document.getElementById('btnEnviarTemplate');
  const original = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = `${icon('loader')} Enviando...`; refreshIcons();

  try{
    const arrayBuffer = await file.arrayBuffer();
    const base64 = _arrayBufferParaBase64(arrayBuffer);
    const result = await apiPost('/documentos-templates', { nome, arquivo_base64: base64 });
    if(result){
      invalidateCache('/documentos-templates');
      toast('Modelo enviado com sucesso!', 'success');
      pageDocumentos();
    }
  } finally {
    btn.disabled = false; btn.innerHTML = original; refreshIcons();
  }
}

function _arrayBufferParaBase64(buffer){
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for(let i = 0; i < bytes.length; i += chunk){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function _base64ParaArrayBuffer(base64){
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function renomearTemplate(t){
  if(!t) return;
  const novoNome = prompt('Novo nome do modelo:', t.nome);
  if(!novoNome || !novoNome.trim() || novoNome.trim() === t.nome) return;
  const result = await apiPut(`/documentos-templates/${t.id}`, { nome: novoNome.trim() });
  if(result){
    invalidateCache('/documentos-templates');
    toast('Modelo renomeado', 'success');
    pageDocumentos();
  }
}

async function excluirTemplate(t){
  if(!t) return;
  const ok = confirm(`Excluir o modelo "${t.nome}"? Essa ação não pode ser desfeita.`);
  if(!ok) return;
  const result = await apiDelete(`/documentos-templates/${t.id}`);
  if(result){
    invalidateCache('/documentos-templates');
    toast('Modelo excluído', 'success');
    pageDocumentos();
  }
}

// ============================================================
// MODAL: gerar documento a partir de um modelo + dados do
// orçamento atual (OS). Chamado tanto da página de Documentos
// quanto do botão "Gerar Documento" no Orçamento.
// ============================================================
async function abrirModalGerarDocumento(templateOverride){
  const temItens = (typeof OS !== 'undefined') && (OS.itensPlaca?.length || OS.itensInversor?.length || OS.itensBateria?.length || OS.itensMateriais?.length);
  if(!temItens){
    toast('Monte um orçamento primeiro (placas, inversores, materiais...) — os códigos do documento vêm de lá', 'warning');
    return;
  }
  if(!OS.cliente){
    toast('Nenhum cliente selecionado no orçamento — os campos de cliente ficarão em branco no documento', 'info', 5000);
  }

  const templates = templateOverride ? [templateOverride] : (await apiGetCached('/documentos-templates') || []);
  if(!templates.length){
    toast('Nenhum modelo de documento cadastrado ainda. Vá em "Modelos de Documento" no menu.', 'warning');
    return;
  }

  const valorTotal = OS.resultado?.totalGeral || 0;

  const html = `
    <div class="form-grid1">
      ${!templateOverride ? `
      <div class="field">
        <label>Modelo</label>
        <select class="select" id="gdTemplate">
          ${templates.map(t => `<option value="${t.id}">${t.nome}</option>`).join('')}
        </select>
      </div>` : `<input type="hidden" id="gdTemplate" value="${templateOverride.id}">`}

      <div id="gdFormaPagamentoSection" style="display:none">
        <div class="field">
          <label>Forma de pagamento</label>
          <select class="select" id="gdTipoPag">
            <option value="avista">À vista</option>
            <option value="avista_entrada_restante">À vista — entrada + restante na vistoria</option>
            <option value="boleto_parcelado">Parcelado no boleto (sem entrada)</option>
            <option value="entrada_boleto">Entrada + boleto</option>
            <option value="financiamento">Financiamento bancário</option>
            <option value="entrada_financiamento">Entrada + financiamento</option>
            <option value="financiamento_proprio">Financiamento próprio</option>
            <option value="cartao">Cartão de crédito</option>
            <option value="cartao_restante">Cartão de crédito + restante na vistoria</option>
            <option value="entrada_cartao">Entrada + cartão de crédito</option>
            <option value="cartao_financiamento">Cartão de crédito + financiamento</option>
            <option value="dividido_primeira">Dividido em X vezes + 1ª parcela diferente</option>
          </select>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="field" id="gdEntradaWrap" style="display:none">
            <label>Entrada</label>
            <div style="display:flex;gap:6px">
              <select class="select" id="gdEntradaModo" style="max-width:88px">
                <option value="valor">R$</option>
                <option value="percentual">%</option>
              </select>
              <input class="input" id="gdEntrada" type="text" placeholder="0,00" style="flex:1">
            </div>
          </div>
          <div class="field" id="gdParcelasWrap" style="display:none"><label>Parcelas</label><input class="input" id="gdParcelas" type="number" min="1" value="12"></div>
        </div>
        <div class="field" id="gdPrimeiraParcelaWrap" style="display:none">
          <label>Valor da 1ª parcela</label>
          <div style="display:flex;gap:6px">
            <select class="select" id="gdPrimeiraParcelaModo" style="max-width:88px">
              <option value="valor">R$</option>
              <option value="percentual">%</option>
            </select>
            <input class="input" id="gdPrimeiraParcela" type="text" placeholder="0,00" style="flex:1">
          </div>
        </div>
        <div class="grid" id="gdJurosWrap" style="grid-template-columns:1fr 1fr;gap:10px;display:none">
          <div class="field">
            <label>Juros no boleto</label>
            <select class="select" id="gdJurosTipo">
              <option value="nenhum">Sem juros</option>
              <option value="percentual">Percentual ao mês</option>
              <option value="fixo">Valor fixo da parcela</option>
            </select>
          </div>
          <div class="field" id="gdJurosValorWrap" style="display:none">
            <label id="gdJurosValorLabel">Percentual (%)</label>
            <input class="input" id="gdJurosValor" type="text" placeholder="0,00">
          </div>
        </div>
        <div class="field">
          <label>Texto final da forma de pagamento <span class="text-faint" style="font-weight:400">(editável)</span></label>
          <textarea class="input" id="gdTextoPagamento" rows="3"></textarea>
        </div>
      </div>

      <div id="gdRecallSection" style="display:none">
        <div class="field" style="margin:6px 0 4px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
            <input type="checkbox" id="gdRecallAtivo" style="width:16px;height:16px">
            Houve troca de equipamento (recall)?
          </label>
        </div>
        <div id="gdRecallBody" style="display:none;border:1px solid var(--border);border-radius:10px;padding:10px;margin-top:6px">
          <div class="grid" style="grid-template-columns:1fr 1.6fr 70px auto;gap:8px;align-items:end">
            <div class="field" style="margin:0">
              <label>Tipo</label>
              <select class="select" id="gdRecallTipo">
                <option value="placa">Placa</option>
                <option value="inversor">Inversor</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Modelo cadastrado</label>
              <select class="select" id="gdRecallModelo"></select>
            </div>
            <div class="field" style="margin:0">
              <label>Qtd</label>
              <input class="input" id="gdRecallQtd" type="number" min="1" value="1">
            </div>
            <button type="button" class="btn btn-secondary btn-icon" id="btnAddRecallItem" title="Adicionar">${icon('plus')}</button>
          </div>
          <div id="gdRecallLista" style="margin-top:10px;display:flex;flex-direction:column;gap:6px"></div>
          <div class="field" style="margin-top:10px">
            <label>Texto final do recall/troca <span class="text-faint" style="font-weight:400">(editável)</span></label>
            <textarea class="input" id="gdTextoRecall" rows="3"></textarea>
          </div>
        </div>
      </div>

      <div id="gdFormaPagamentoLoading" class="text-faint" style="font-size:12px">Verificando variáveis do modelo...</div>
    </div>
  `;

  openModal({
    id: 'modalGerarDocumento',
    title: templateOverride ? `Gerar: ${templateOverride.nome}` : 'Gerar documento',
    width: 620,
    bodyHtml: html,
    footHtml: `
      <button class="btn btn-secondary" id="btnCancelGerarDoc">Cancelar</button>
      <button class="btn btn-secondary" id="btnVisualizarDoc">${icon('eye')} Visualizar</button>
      <button class="btn btn-primary" id="btnConfirmarGerarDoc">${icon('download')} Baixar documento</button>
    `
  });
  refreshIcons();

  const elTipo = document.getElementById('gdTipoPag');
  const elEntrada = document.getElementById('gdEntrada');
  const elEntradaModo = document.getElementById('gdEntradaModo');
  const elParcelas = document.getElementById('gdParcelas');
  const elPrimeiraParcela = document.getElementById('gdPrimeiraParcela');
  const elPrimeiraParcelaModo = document.getElementById('gdPrimeiraParcelaModo');
  const elJurosTipo = document.getElementById('gdJurosTipo');
  const elJurosValor = document.getElementById('gdJurosValor');
  const elTexto = document.getElementById('gdTextoPagamento');
  const elEntradaWrap = document.getElementById('gdEntradaWrap');
  const elParcelasWrap = document.getElementById('gdParcelasWrap');
  const elPrimeiraParcelaWrap = document.getElementById('gdPrimeiraParcelaWrap');
  const elJurosWrap = document.getElementById('gdJurosWrap');
  const elJurosValorWrap = document.getElementById('gdJurosValorWrap');
  const elJurosValorLabel = document.getElementById('gdJurosValorLabel');
  const elFormaPagSection = document.getElementById('gdFormaPagamentoSection');
  const elFormaPagLoading = document.getElementById('gdFormaPagamentoLoading');

  // ---------------------------------------------------------------
  // RECALL / TROCA DE EQUIPAMENTO — mesmo padrão da forma de
  // pagamento: a seção só aparece se o modelo tiver <<recall_texto>>.
  // Dentro dela, um checkbox desativado por padrão; quando o usuário
  // ativa, monta a lista de itens (placa/inversor + modelo cadastrado
  // + quantidade) e gera o texto final automaticamente.
  // ---------------------------------------------------------------
  const elRecallSection = document.getElementById('gdRecallSection');
  const elRecallAtivo = document.getElementById('gdRecallAtivo');
  const elRecallBody = document.getElementById('gdRecallBody');
  const elRecallTipo = document.getElementById('gdRecallTipo');
  const elRecallModelo = document.getElementById('gdRecallModelo');
  const elRecallQtd = document.getElementById('gdRecallQtd');
  const elRecallLista = document.getElementById('gdRecallLista');
  const elTextoRecall = document.getElementById('gdTextoRecall');

  let _recallItens = [];
  let _recallCatalogos = null; // { placa: [...], inversor: [...] }

  async function carregarCatalogosRecall(){
    if(_recallCatalogos) return _recallCatalogos;
    const [placas, inversores] = await Promise.all([
      apiGetCached('/equipamentos/placas'),
      apiGetCached('/equipamentos/inversores'),
    ]);
    _recallCatalogos = { placa: placas || [], inversor: inversores || [] };
    return _recallCatalogos;
  }

  function descricaoModeloRecall(tipo, modelo){
    if(!modelo) return '';
    if(tipo === 'placa'){
      return `${modelo.marca||''} ${modelo.modelo||''} ${modelo.potencia?modelo.potencia+'W':''}`.replace(/\s+/g,' ').trim();
    }
    return `${modelo.marca||''} ${modelo.modelo||''} ${modelo.potencia?(modelo.potencia/1000)+'kW':''}`.replace(/\s+/g,' ').trim();
  }

  async function preencherSelectModeloRecall(){
    const cat = await carregarCatalogosRecall();
    const lista = cat[elRecallTipo.value] || [];
    elRecallModelo.innerHTML = lista.length
      ? lista.map(m => `<option value="${m.id}">${esc(descricaoModeloRecall(elRecallTipo.value, m))}</option>`).join('')
      : `<option value="">Nenhum ${elRecallTipo.value} cadastrado</option>`;
  }

  function renderizarListaRecall(){
    if(!_recallItens.length){
      elRecallLista.innerHTML = `<div class="text-faint" style="font-size:11.5px">Nenhum equipamento adicionado ainda.</div>`;
    } else {
      elRecallLista.innerHTML = _recallItens.map((it, i) => `
        <div class="banco-item" data-recall-idx="${i}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--surface-3);border-radius:8px">
          <span style="font-size:12.5px">${it.qtd}x ${it.tipo === 'placa' ? 'Placa' : 'Inversor'} — ${esc(it.descricao)}</span>
          <button type="button" class="btn btn-icon btn-ghost btn-sm" data-rm-recall="${i}">${icon('trash-2')}</button>
        </div>
      `).join('');
      elRecallLista.querySelectorAll('[data-rm-recall]').forEach(btn => {
        btn.addEventListener('click', () => {
          _recallItens.splice(parseInt(btn.dataset.rmRecall), 1);
          renderizarListaRecall();
          atualizarTextoRecall();
        });
      });
    }
    refreshIcons();
  }

  function atualizarTextoRecall(){
    if(elTextoRecall.dataset.manual === 'true') return;
    const empresaNome = (window._recallEmpresaNomeCache || '').trim();
    elTextoRecall.value = gerarTextoRecallPadrao(_recallItens, empresaNome);
  }
  elTextoRecall.addEventListener('input', () => { elTextoRecall.dataset.manual = 'true'; });

  elRecallAtivo.addEventListener('change', () => {
    elRecallBody.style.display = elRecallAtivo.checked ? '' : 'none';
    if(elRecallAtivo.checked) preencherSelectModeloRecall();
  });
  elRecallTipo.addEventListener('change', preencherSelectModeloRecall);

  document.getElementById('btnAddRecallItem').addEventListener('click', async () => {
    const cat = await carregarCatalogosRecall();
    const lista = cat[elRecallTipo.value] || [];
    const modelo = lista.find(m => String(m.id) === elRecallModelo.value);
    if(!modelo){ toast('Cadastre pelo menos um modelo antes de adicionar', 'warning'); return; }
    const qtd = parseInt(elRecallQtd.value) || 1;
    _recallItens.push({
      tipo: elRecallTipo.value,
      id: modelo.id,
      qtd,
      descricao: descricaoModeloRecall(elRecallTipo.value, modelo),
    });
    renderizarListaRecall();
    atualizarTextoRecall();
  });

  renderizarListaRecall();

  // Tipos que usam "entrada" (valor pago antes do restante)
  const TIPOS_COM_ENTRADA = ['avista_entrada_restante','entrada_boleto','entrada_financiamento','cartao_restante','entrada_cartao','cartao_financiamento'];
  // Tipos que têm parcelamento em boleto (por isso podem ter juros)
  const TIPOS_COM_BOLETO = ['boleto_parcelado','entrada_boleto','dividido_primeira'];

  // Converte o valor de um campo pro R$ real, considerando o modo
  // escolhido (valor fixo ou percentual do total do orçamento).
  function calcularValorComModo(valorCampo, modo){
    if(modo === 'percentual') return valorTotal * (parsePercent(valorCampo) || 0);
    return parseMoney(valorCampo) || 0;
  }

  function atualizarVisibilidade(){
    const tipo = elTipo.value;
    elEntradaWrap.style.display = TIPOS_COM_ENTRADA.includes(tipo) ? '' : 'none';
    elParcelasWrap.style.display = TIPOS_COM_BOLETO.includes(tipo) ? '' : 'none';
    elPrimeiraParcelaWrap.style.display = (tipo === 'dividido_primeira') ? '' : 'none';
    elJurosWrap.style.display = TIPOS_COM_BOLETO.includes(tipo) ? '' : 'none';
    atualizarVisibilidadeJurosValor();
  }
  function atualizarVisibilidadeJurosValor(){
    const jurosTipo = elJurosTipo.value;
    elJurosValorWrap.style.display = (jurosTipo === 'percentual' || jurosTipo === 'fixo') ? '' : 'none';
    elJurosValorLabel.textContent = (jurosTipo === 'percentual') ? 'Percentual ao mês (%)' : 'Valor fixo da parcela (R$)';
  }
  function atualizarPlaceholders(){
    elEntrada.placeholder = elEntradaModo.value === 'percentual' ? '0,00%' : '0,00';
    elPrimeiraParcela.placeholder = elPrimeiraParcelaModo.value === 'percentual' ? '0,00%' : '0,00';
  }
  function atualizarTexto(){
    if(elTexto.dataset.manual === 'true') return;
    const entrada = calcularValorComModo(elEntrada.value, elEntradaModo.value);
    const parcelas = parseInt(elParcelas.value) || 0;
    const primeiraParcela = calcularValorComModo(elPrimeiraParcela.value, elPrimeiraParcelaModo.value);
    const jurosTipo = elJurosTipo.value;
    // percentual vem digitado como "1,63" (%) -> converte pra decimal 0.0163;
    // fixo já vem em R$ (parseMoney direto)
    const jurosValor = (jurosTipo === 'percentual') ? (parsePercent(elJurosValor.value) || 0) : (parseMoney(elJurosValor.value) || 0);
    elTexto.value = gerarTextoPagamentoPadrao(elTipo.value, valorTotal, entrada, parcelas, jurosTipo, jurosValor, primeiraParcela);
  }

  elTipo.addEventListener('change', () => { atualizarVisibilidade(); atualizarTexto(); });
  elEntrada.addEventListener('input', atualizarTexto);
  elEntradaModo.addEventListener('change', () => { atualizarPlaceholders(); atualizarTexto(); });
  elParcelas.addEventListener('input', atualizarTexto);
  elPrimeiraParcela.addEventListener('input', atualizarTexto);
  elPrimeiraParcelaModo.addEventListener('change', () => { atualizarPlaceholders(); atualizarTexto(); });
  elJurosTipo.addEventListener('change', () => { atualizarVisibilidadeJurosValor(); atualizarTexto(); });
  elJurosValor.addEventListener('input', atualizarTexto);
  elTexto.addEventListener('input', () => { elTexto.dataset.manual = 'true'; });

  atualizarVisibilidade();
  atualizarPlaceholders();
  atualizarTexto();

  // ---------------------------------------------------------------
  // Detecta se o modelo selecionado tem a variável <<forma_pagamento>>
  // — se não tiver (laudo, procuração, doc sem preço...), a seção
  // inteira fica escondida e não incomoda o usuário à toa.
  // Resultado fica em cache por template.id pra não rebaixar o
  // arquivo de novo se o usuário trocar de modelo e voltar.
  // ---------------------------------------------------------------
  const _cacheCodigosPorTemplate = {};
  function templateAtual(){
    const templateId = document.getElementById('gdTemplate').value;
    return templates.find(t => t.id == templateId) || templateOverride;
  }
  async function obterCodigosDoTemplate(template){
    if(!template) return new Set();
    if(_cacheCodigosPorTemplate[template.id]) return _cacheCodigosPorTemplate[template.id];
    const arquivoResp = await apiGet(`/documentos-templates/${template.id}/arquivo`);
    if(!arquivoResp || !arquivoResp.arquivo_base64) return new Set();
    const arrayBuffer = _base64ParaArrayBuffer(arquivoResp.arquivo_base64);
    const codigos = await detectarCodigosNoTemplate(arrayBuffer);
    _cacheCodigosPorTemplate[template.id] = codigos;
    return codigos;
  }
  async function atualizarSecaoFormaPagamento(){
    elFormaPagSection.style.display = 'none';
    elRecallSection.style.display = 'none';
    elFormaPagLoading.style.display = '';
    const template = templateAtual();
    const codigos = await obterCodigosDoTemplate(template);
    elFormaPagLoading.style.display = 'none';
    if(codigos.has('forma_pagamento')){
      elFormaPagSection.style.display = '';
      atualizarVisibilidade();
      atualizarTexto();
    }
    if(codigos.has('recall_texto')){
      elRecallSection.style.display = '';
      // reseta a seleção ao trocar de modelo — evita levar itens de
      // um modelo de documento pra outro por engano
      elRecallAtivo.checked = false;
      elRecallBody.style.display = 'none';
      _recallItens = [];
      elTextoRecall.value = '';
      elTextoRecall.dataset.manual = '';
      renderizarListaRecall();
      if(!window._recallEmpresaNomeCache){
        const cfgGlobal = (typeof carregarPropostaConfigMesclada === 'function') ? await carregarPropostaConfigMesclada() : {};
        window._recallEmpresaNomeCache = cfgGlobal?.empresa_nome || '';
      }
    }
  }
  atualizarSecaoFormaPagamento();
  if(!templateOverride){
    document.getElementById('gdTemplate').addEventListener('change', atualizarSecaoFormaPagamento);
  }

  // ---------------------------------------------------------------
  // Monta os {valores} do documento a partir do estado atual do
  // orçamento + do texto de forma de pagamento (se a seção estiver
  // visível). Compartilhado entre "Visualizar" e "Baixar".
  // ---------------------------------------------------------------
  async function montarValoresAtuais(){
    const cfgGlobal = (typeof carregarPropostaConfigMesclada === 'function') ? await carregarPropostaConfigMesclada() : {};
    const data = {
      itensPlaca: OS.itensPlaca, itensInversor: OS.itensInversor, itensBateria: OS.itensBateria,
      itensMateriais: OS.itensMateriais, cliente: OS.cliente, vendedor: OS.vendedor,
      estrutura: OS.estrutura, resultado: OS.resultado
    };
    const formaPagamento = (elFormaPagSection.style.display !== 'none') ? elTexto.value : '';
    const recallTexto = (elRecallSection.style.display !== 'none' && elRecallAtivo.checked) ? elTextoRecall.value : '';
    return montarValoresDocumento(data, { formaPagamento, recallTexto }, cfgGlobal);
  }

  function nomeArquivoAtual(template){
    return `${template.nome}${OS.cliente ? ' - ' + OS.cliente.nome : ''} - ${new Date().toLocaleDateString('pt-BR').split('/').join('.')}`;
  }

  document.getElementById('btnCancelGerarDoc').addEventListener('click', () => closeModal('modalGerarDocumento'));

  // ---------------------------------------------------------------
  // VISUALIZAR — monta o .docx com os valores atuais e mostra o
  // conteúdo (via mammoth) num modal de leitura, sem baixar nada.
  // ---------------------------------------------------------------
  document.getElementById('btnVisualizarDoc').addEventListener('click', async () => {
    const template = templateAtual();
    if(!template){ toast('Selecione um modelo', 'warning'); return; }

    const btn = document.getElementById('btnVisualizarDoc');
    const original = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `${icon('loader')} Carregando...`; refreshIcons();

    try{
      const arquivoResp = await apiGet(`/documentos-templates/${template.id}/arquivo`);
      if(!arquivoResp || !arquivoResp.arquivo_base64){ toast('Não foi possível baixar o modelo', 'error'); return; }

      const valores = await montarValoresAtuais();
      const arrayBuffer = _base64ParaArrayBuffer(arquivoResp.arquivo_base64);
      const { blob, codigosNaoReconhecidos } = await montarDocumentoDocxBlob(arrayBuffer, valores);
      const { html } = await converterDocxParaHtml(blob);

      openModal({
        id: 'modalVisualizarDocumento',
        title: `Visualizar: ${template.nome}`,
        width: 820,
        bodyHtml: `<div style="background:#fff;color:#111;padding:32px;border-radius:6px;max-height:70vh;overflow:auto;font-family:Georgia,'Times New Roman',serif;line-height:1.6">${html}</div>`,
        footHtml: `<button class="btn btn-secondary" data-close>Fechar</button>`
      });

      if(codigosNaoReconhecidos.length){
        toast(`Código(s) não reconhecido(s) no modelo: ${codigosNaoReconhecidos.map(c=>'<<'+c+'>>').join(', ')}`, 'warning', 7000);
      }
    } catch(e){
      console.error(e);
      toast('Erro ao gerar a visualização: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = original; refreshIcons();
    }
  });

  // ---------------------------------------------------------------
  // BAIXAR — pergunta o formato (Word ou PDF) antes de gerar.
  // ---------------------------------------------------------------
  document.getElementById('btnConfirmarGerarDoc').addEventListener('click', () => {
    const template = templateAtual();
    if(!template){ toast('Selecione um modelo', 'warning'); return; }

    openModal({
      id: 'modalEscolherFormato',
      title: 'Baixar como...',
      width: 380,
      bodyHtml: `
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-secondary" id="btnFormatoWord" style="justify-content:flex-start">${icon('file-text')} Word (.docx) — editável</button>
          <button class="btn btn-secondary" id="btnFormatoPdf" style="justify-content:flex-start">${icon('file')} PDF — pronto pra enviar</button>
        </div>
      `,
      footHtml: `<button class="btn btn-secondary" data-close>Cancelar</button>`
    });
    refreshIcons();

    async function gerarEBaixar(formato, btnId){
      const btn = document.getElementById(btnId);
      const original = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = `${icon('loader')} Gerando...`; refreshIcons();

      try{
        const arquivoResp = await apiGet(`/documentos-templates/${template.id}/arquivo`);
        if(!arquivoResp || !arquivoResp.arquivo_base64){ toast('Não foi possível baixar o modelo', 'error'); return; }

        const valores = await montarValoresAtuais();
        const arrayBuffer = _base64ParaArrayBuffer(arquivoResp.arquivo_base64);
        const { blob, codigosNaoReconhecidos } = await montarDocumentoDocxBlob(arrayBuffer, valores);
        const nomeArquivo = nomeArquivoAtual(template);

        let blobParaBaixar;
        if(formato === 'pdf'){
          blobParaBaixar = await converterDocxParaPdfBlob(blob);
          baixarBlob(blobParaBaixar, nomeArquivo + '.pdf');
        } else {
          blobParaBaixar = blob;
          baixarBlob(blob, nomeArquivo + '.docx');
        }

        // Vincula uma cópia ao cliente (histórico "Documentos gerados"),
        // se houver cliente selecionado no orçamento atual.
        if(OS.cliente && OS.cliente.id){
          try{
            const arrayBufferSalvar = await blobParaBaixar.arrayBuffer();
            const base64Salvar = _arrayBufferParaBase64(arrayBufferSalvar);
            await apiPost(`/clientes/${OS.cliente.id}/documentos`, {
              nome: nomeArquivo,
              tipo_arquivo: formato === 'pdf' ? 'pdf' : 'docx',
              arquivo_base64: base64Salvar
            });
          } catch(e){
            console.error('Falha ao vincular documento ao cliente:', e);
            toast('Documento baixado, mas não consegui salvar uma cópia no histórico do cliente.', 'warning', 6000);
          }
        }

        closeModal('modalEscolherFormato');
        closeModal('modalGerarDocumento');
        if(codigosNaoReconhecidos.length){
          toast(`Documento gerado, mas encontrei código(s) não reconhecido(s) no modelo: ${codigosNaoReconhecidos.map(c=>'<<'+c+'>>').join(', ')}`, 'warning', 7000);
        }else{
          toast('Documento gerado com sucesso!', 'success');
        }
      } catch(e){
        console.error(e);
        toast('Erro ao gerar documento: ' + e.message, 'error');
      } finally {
        btn.disabled = false; btn.innerHTML = original; refreshIcons();
      }
    }

    document.getElementById('btnFormatoWord').addEventListener('click', () => gerarEBaixar('word', 'btnFormatoWord'));
    document.getElementById('btnFormatoPdf').addEventListener('click', () => gerarEBaixar('pdf', 'btnFormatoPdf'));
  });
}
window.abrirModalGerarDocumento = abrirModalGerarDocumento;

// ============================================================
// MODAL: documentos e anexos vinculados a um cliente — orçamentos
// salvos, documentos gerados (contrato/procuração já preenchidos)
// e anexos manuais (fatura de energia, identidade, outros).
// Aberto a partir da tela de Clientes (cadastro.js).
// ============================================================
function _mimeParaIcone(mime){
  if(!mime) return 'file';
  if(mime.startsWith('image/')) return 'image';
  if(mime === 'application/pdf') return 'file-text';
  return 'file';
}
function _categoriaAnexoLabel(c){
  return { fatura_energia:'Fatura de energia', identidade:'Identidade', outro:'Outro documento' }[c] || 'Outro documento';
}

// Abre (preview) ou baixa um arquivo a partir do base64 vindo da API,
// escolhendo o comportamento pelo tipo: imagem -> mostra num modal,
// PDF -> abre em nova aba, .docx -> preview via mammoth, qualquer
// outro tipo -> baixa direto (não dá pra prever visualização).
async function _abrirOuBaixarArquivo(base64, mime, nomeArquivo){
  const arrayBuffer = _base64ParaArrayBuffer(base64);
  const blob = new Blob([arrayBuffer], { type: mime || 'application/octet-stream' });

  if(mime && mime.startsWith('image/')){
    const url = URL.createObjectURL(blob);
    openModal({
      id: 'modalVisualizarAnexo', title: nomeArquivo, width: 700,
      bodyHtml: `<img src="${url}" style="max-width:100%;display:block;margin:0 auto;border-radius:6px">`,
      footHtml: `<button class="btn btn-secondary" data-close>Fechar</button>`
    });
    return;
  }
  if(mime === 'application/pdf'){
    window.open(URL.createObjectURL(blob), '_blank');
    return;
  }
  if(mime === DOCX_MIME || /\.docx$/i.test(nomeArquivo)){
    const { html } = await converterDocxParaHtml(blob);
    openModal({
      id: 'modalVisualizarAnexo', title: nomeArquivo, width: 820,
      bodyHtml: `<div style="background:#fff;color:#111;padding:32px;border-radius:6px;max-height:70vh;overflow:auto;font-family:Georgia,'Times New Roman',serif;line-height:1.6">${html}</div>`,
      footHtml: `<button class="btn btn-secondary" data-close>Fechar</button>`
    });
    return;
  }
  baixarBlob(blob, nomeArquivo);
  toast('Esse tipo de arquivo não tem visualização — baixei direto', 'info');
}

async function abrirModalDocumentosCliente(cliente){
  if(!cliente || !cliente.id){ toast('Cliente inválido', 'error'); return; }

  openModal({
    id: 'modalDocumentosCliente',
    title: `Documentos — ${cliente.nome || 'Cliente'}`,
    width: 680,
    bodyHtml: `
      <div class="tabs" id="cliDocTabs">
        <div class="tab active" data-tab="orcamentos">Orçamentos</div>
        <div class="tab" data-tab="documentos">Documentos gerados</div>
        <div class="tab" data-tab="anexos">Anexos</div>
      </div>
      <div class="mt-16" id="cliDocBody"><div class="loader"><div class="spin"></div> Carregando...</div></div>
    `,
    footHtml: `<button class="btn btn-secondary" data-close>Fechar</button>`
  });
  refreshIcons();

  let abaAtual = 'orcamentos';

  async function renderAba(){
    const body = document.getElementById('cliDocBody');
    if(!body) return;
    body.innerHTML = `<div class="loader"><div class="spin"></div> Carregando...</div>`;

    if(abaAtual === 'orcamentos'){
      const todos = await apiGetCached('/orcamentos') || [];
      const lista = todos.filter(o => String(o.cliente_id) === String(cliente.id))
        .sort((a,b) => String(b.data_orcamento||'').localeCompare(String(a.data_orcamento||'')));

      body.innerHTML = !lista.length
        ? `<div class="empty-state">${icon('inbox')}<p>Nenhum orçamento salvo para este cliente</p></div>`
        : lista.map(o => `
          <div class="item-row">
            <div class="icon-sm">${icon('sun')}</div>
            <div class="main">
              <div class="title">${formatarMoeda(o.valor_final || 0)}</div>
              <div class="subtitle">${fmtDate(o.data_orcamento)}${o.codigo_proposta ? ' · '+o.codigo_proposta : ''}</div>
            </div>
            <div class="row-actions">
              <button class="btn btn-icon btn-ghost" data-import-orc="${o.id}" title="Importar para o Orçamento">${icon('download')}</button>
              <button class="btn btn-icon btn-ghost" data-ver-proposta="${o.id}" title="Ver proposta (resumida ou completa)">${icon('file-text')}</button>
              <button class="btn btn-icon btn-danger" data-del-orc="${o.id}" title="Excluir orçamento">${icon('trash-2')}</button>
            </div>
          </div>
        `).join('');
      refreshIcons();

      body.querySelectorAll('[data-import-orc]').forEach(el => el.addEventListener('click', () => {
        const o = lista.find(x => x.id == el.getAttribute('data-import-orc'));
        if(o && typeof importarOrcamentoHistorico === 'function'){
          closeModal('modalDocumentosCliente');
          importarOrcamentoHistorico(o);
        }
      }));
      // Mesma escolha (resumida/completa) usada na página de Histórico.
      body.querySelectorAll('[data-ver-proposta]').forEach(el => el.addEventListener('click', () => {
        const o = lista.find(x => x.id == el.getAttribute('data-ver-proposta'));
        if(o && typeof abrirEscolhaProposta === 'function') abrirEscolhaProposta(o);
      }));
      body.querySelectorAll('[data-del-orc]').forEach(el => el.addEventListener('click', async () => {
        const id = el.getAttribute('data-del-orc');
        const o = lista.find(x => x.id == id);
        const ok = await confirmDialog({
          title: 'Excluir orçamento',
          msg: `Tem certeza que deseja excluir este orçamento (${formatarMoeda(o?.valor_final||0)})? Esta ação não pode ser desfeita.`
        });
        if(!ok) return;
        const result = await apiDelete(`/orcamentos/${id}`);
        if(result){
          toast('Orçamento excluído', 'success');
          invalidateCache('/orcamentos');
          renderAba();
        }
      }));
    }

    if(abaAtual === 'documentos'){
      const lista = await apiGet(`/clientes/${cliente.id}/documentos`) || [];

      body.innerHTML = !lista.length
        ? `<div class="empty-state">${icon('inbox')}<p>Nenhum documento gerado ainda para este cliente</p></div>`
        : lista.map(d => `
          <div class="item-row">
            <div class="icon-sm">${icon(d.tipo_arquivo === 'pdf' ? 'file-text' : 'file')}</div>
            <div class="main">
              <div class="title">${d.nome}</div>
              <div class="subtitle">${fmtDate(d.created_at)} · ${(d.tipo_arquivo||'').toUpperCase()}</div>
            </div>
            <div class="row-actions">
              <button class="btn btn-icon btn-ghost" data-baixar-doc="${d.id}" title="Baixar">${icon('download')}</button>
              <button class="btn btn-icon btn-danger" data-del-doc="${d.id}" title="Excluir">${icon('trash-2')}</button>
            </div>
          </div>
        `).join('');
      refreshIcons();

      body.querySelectorAll('[data-baixar-doc]').forEach(el => el.addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        const id = btn.getAttribute('data-baixar-doc');
        const original = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = icon('loader'); refreshIcons();
        try{
          const resp = await apiGet(`/clientes/${cliente.id}/documentos/${id}/arquivo`);
          if(!resp || !resp.arquivo_base64){ toast('Não foi possível baixar o documento', 'error'); return; }
          const mime = resp.tipo_arquivo === 'pdf' ? 'application/pdf' : DOCX_MIME;
          const extensao = resp.tipo_arquivo === 'pdf' ? '.pdf' : '.docx';
          const arrayBuffer = _base64ParaArrayBuffer(resp.arquivo_base64);
          baixarBlob(new Blob([arrayBuffer], { type: mime }), resp.nome + extensao);
        } finally {
          btn.disabled = false; btn.innerHTML = original; refreshIcons();
        }
      }));
      body.querySelectorAll('[data-del-doc]').forEach(el => el.addEventListener('click', async () => {
        const id = el.getAttribute('data-del-doc');
        const ok = await confirmDialog({ title:'Excluir documento', msg:'Remover este documento do histórico do cliente? Essa ação não pode ser desfeita.' });
        if(!ok) return;
        const result = await apiDelete(`/clientes/${cliente.id}/documentos/${id}`);
        if(result){ toast('Documento removido', 'success'); renderAba(); }
      }));
    }

    if(abaAtual === 'anexos'){
      const lista = await apiGet(`/clientes/${cliente.id}/anexos`) || [];
      const listaHtml = !lista.length
        ? `<div class="empty-state">${icon('inbox')}<p>Nenhum anexo enviado ainda</p></div>`
        : lista.map(a => `
          <div class="item-row">
            ${a.url ? `<img class="thumb-sm" src="${a.url}">` : `<div class="icon-sm">${icon(_mimeParaIcone(a.tipo_mime))}</div>`}
            <div class="main">
              <div class="title">${a.nome}</div>
              <div class="subtitle">${_categoriaAnexoLabel(a.categoria)} · ${fmtDate(a.created_at)}</div>
            </div>
            <div class="row-actions">
              <button class="btn btn-icon btn-ghost" data-ver-anexo="${a.id}" title="Abrir">${icon('eye')}</button>
              <button class="btn btn-icon btn-danger" data-del-anexo="${a.id}" title="Excluir">${icon('trash-2')}</button>
            </div>
          </div>
        `).join('');

      body.innerHTML = `
        <div class="field" style="margin-bottom:14px">
          <label>Anexar arquivo (fatura de energia, identidade, outros...)</label>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
            <select class="select" id="cliAnexoCategoria">
              <option value="fatura_energia">Fatura de energia</option>
              <option value="identidade">Identidade (RG/CNH)</option>
              <option value="outro">Outro documento</option>
            </select>
            <input type="file" class="input" id="cliAnexoArquivo">
          </div>
          <button class="btn btn-primary mt-8" id="btnEnviarAnexo" style="width:100%">${icon('upload')} Enviar anexo</button>
        </div>
        <div id="cliAnexosLista">${listaHtml}</div>
      `;
      refreshIcons();

      document.getElementById('btnEnviarAnexo').addEventListener('click', async () => {
        const fileInput = document.getElementById('cliAnexoArquivo');
        const file = fileInput.files[0];
        if(!file){ toast('Escolha um arquivo primeiro', 'warning'); return; }
        const categoria = document.getElementById('cliAnexoCategoria').value;

        const btn = document.getElementById('btnEnviarAnexo');
        const original = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = `${icon('loader')} Enviando...`; refreshIcons();

        try{
          const ehImagem = (file.type || '').startsWith('image/');
          const payload = { nome: file.name, categoria, tipo_mime: file.type || 'application/octet-stream' };

          if(ehImagem){
            // Mesmo pipeline das fotos de placas/inversores: redimensiona
            // e sobe pro ImgBB — imagem NUNCA vira base64 pro Drive.
            const blobRedimensionado = await redimensionarImagem2(file);
            const resultImg = await uploadParaImgBB(blobRedimensionado);
            if(!resultImg.success){ toast('Erro ao enviar imagem: ' + resultImg.error, 'error'); return; }
            payload.url = resultImg.url;
          } else {
            // PDF e outros tipos que o ImgBB não aceita: Drive, via base64.
            const arrayBuffer = await file.arrayBuffer();
            payload.arquivo_base64 = _arrayBufferParaBase64(arrayBuffer);
          }

          const result = await apiPost(`/clientes/${cliente.id}/anexos`, payload);
          if(result){ toast('Anexo enviado', 'success'); renderAba(); }
        } catch(e){
          console.error(e);
          toast('Erro ao enviar anexo: ' + e.message, 'error');
        } finally {
          btn.disabled = false; btn.innerHTML = original; refreshIcons();
        }
      });

      document.querySelectorAll('[data-ver-anexo]').forEach(el => el.addEventListener('click', async () => {
        const id = el.getAttribute('data-ver-anexo');
        const anexo = lista.find(a => a.id == id);

        // Imagem hospedada no ImgBB: já temos a URL, mostra direto
        // (sem round-trip pro Drive/base64).
        if(anexo && anexo.url){
          openModal({
            id: 'modalVisualizarAnexo', title: anexo.nome, width: 700,
            bodyHtml: `<img src="${anexo.url}" style="max-width:100%;display:block;margin:0 auto;border-radius:6px">`,
            footHtml: `<button class="btn btn-secondary" data-close>Fechar</button>`
          });
          return;
        }

        const resp = await apiGet(`/clientes/${cliente.id}/anexos/${id}/arquivo`);
        if(!resp || !resp.arquivo_base64){ toast('Não foi possível abrir o anexo', 'error'); return; }
        _abrirOuBaixarArquivo(resp.arquivo_base64, resp.tipo_mime, resp.nome);
      }));
      document.querySelectorAll('[data-del-anexo]').forEach(el => el.addEventListener('click', async () => {
        const id = el.getAttribute('data-del-anexo');
        const ok = await confirmDialog({ title:'Excluir anexo', msg:'Remover este anexo do cliente? Essa ação não pode ser desfeita.' });
        if(!ok) return;
        const result = await apiDelete(`/clientes/${cliente.id}/anexos/${id}`);
        if(result){ toast('Anexo removido', 'success'); renderAba(); }
      }));
    }
  }

  document.querySelectorAll('#cliDocTabs .tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('#cliDocTabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    abaAtual = t.getAttribute('data-tab');
    renderAba();
  }));

  renderAba();
}
window.abrirModalDocumentosCliente = abrirModalDocumentosCliente;

console.log('%c⚡ Solar Pro 2.0 — documentos.js carregado', 'color:#ffb020;font-weight:bold');
