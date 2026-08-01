// ============================================================
// SOLAR PRO 2.0 — pages/dimensionamento-bnb.js
// "Dimensionamento BNB": formulário de UMA página só (igual ao
// modelo Excel/Word usado hoje manualmente para pedir as duas
// autorizações de faturamento — fornecedor de material e prestador
// de serviço — junto ao Banco do Nordeste).
//
// DIFERENÇA em relação à "Proposta BNB" (proposta-completa-bnb.js):
// aquela é o LAUDO TÉCNICO narrativo (várias folhas, justificativa
// de payback, histórico de consumo mês a mês, normas/garantias).
// Este aqui é a GRADE COMPACTA de dados que acompanha o laudo — uma
// tabela só, pensada pra imprimir/anexar ao processo de crédito.
//
// Reaproveita 100% o motor de cálculo já validado em
// montarDadosPropostaBNB() (proposta-completa-bnb.js): kWp do kit,
// payback, redução mensal esperada e — o mais importante — o rateio
// material/serviço (orcamentoDetalhado), que já bate exatamente com
// os valores do modelo original (97.000,00 × 30% = 29.100,00 de
// serviço → 67.900,00 de material). Este arquivo só ACRESCENTA o que
// não existe em outro lugar do sistema: área requerida, consumo
// adicional + levantamento de cargas, telhado x solo, e as duas
// autorizações de faturamento (CNPJ do fornecedor de material —
// perguntado toda vez que o usuário gera o dimensionamento — e do
// prestador de serviço, que por padrão é a própria empresa).
// ============================================================

// ---------------------------------------------------------------
// CONSUMO ADICIONAL AUTOMÁTICO (G25 do modelo Excel original) —
// o BNB exige que toda a geração do kit esteja "justificada" por
// consumo. Quando o kit gera mais do que a média de consumo atual
// do cliente (geracaoEstimadaKwhMes > consumoMedioMes), a diferença
// (G25) precisa ser preenchida com um eletrodoméstico adicional que
// o cliente pretende instalar — senão o dimensionamento fica com
// geração "sobrando" sem justificativa.
//
// Fórmulas replicadas 1:1 do Excel original (linha 32 do modelo):
//   Quantidade        = SE(G25="";""; SES(G25<400;1;G25<800;2;G25<1200;3;G25<1600;4;G25<2000;5;G25<2400;6))
//   Potência unitária  = SE(G25="";"";2600)                          [W, fixo — padrão ar-condicionado]
//   Dias por mês       = SE(G25="";"";ARREDONDAR.PARA.CIMA(((G25*1000)/(qtd*pot*8));1))
//   Consumo mensal      = SE(G25="";"";qtd*dias*pot*8/1000)           [kWh — já soma todas as unidades]
//
// Só entra em ação se G25 > 0. Se o kit gera igual ou menos que o
// consumo médio, não há nada a justificar e a linha fica vazia.
// ---------------------------------------------------------------
function calcularEletrodomesticoAutomaticoDimBNB(g25){
  if(!(g25 > 0)) return null;

  let qtd;
  if(g25 < 400) qtd = 1;
  else if(g25 < 800) qtd = 2;
  else if(g25 < 1200) qtd = 3;
  else if(g25 < 1600) qtd = 4;
  else if(g25 < 2000) qtd = 5;
  else qtd = 6; // 2400+ — fora da tabela original, usa o maior bloco previsto

  const potenciaW = 2600;
  const diasMes = Math.ceil(((g25 * 1000) / (qtd * potenciaW * 8)) * 10) / 10;
  const consumoMensalKwh = (qtd * diasMes * potenciaW * 8) / 1000;

  return {
    equipamento: 'Ar-condicionado 9.000 BTUs',
    qtd, diasMes, potenciaW,
    consumoMensalKwh,
    totalKwh: consumoMensalKwh,
    automatico: true
  };
}
window.calcularEletrodomesticoAutomaticoDimBNB = calcularEletrodomesticoAutomaticoDimBNB;

// ---------------------------------------------------------------
// COMENTÁRIOS/JUSTIFICATIVAS — sempre traz as duas notas padrão
// exigidas pelo BNB (emissão das 2 cartas de autorização + consumo
// adicional, quando houver). Se o cliente vai dar entrada com
// recurso próprio, acrescenta a terceira nota com os valores.
// ---------------------------------------------------------------
function montarComentariosAutomaticosDimBNB({ consumoAdicional, valorEntrada, investimentoTotal }){
  const notas = [
    'Emitir duas cartas de autorização de faturamento, uma destinada ao Fornecedor e outra destinada ao Prestador de Serviço.'
  ];

  if(consumoAdicional > 0){
    notas.push(`O cliente pretende adicionar eletrodomésticos com consumo adicional de ${fmtNumDimBNB(consumoAdicional, 2)} kWh.`);
  }

  if(valorEntrada > 0){
    const valorFinanciado = Math.max(0, (investimentoTotal || 0) - valorEntrada);
    notas.push(`O cliente oferecerá ${fmtMoedaDimBNB(valorEntrada)} como recurso próprio (entrada) e financiará apenas o valor restante de ${fmtMoedaDimBNB(valorFinanciado)}.`);
  }

  return notas.join(' ');
}
window.montarComentariosAutomaticosDimBNB = montarComentariosAutomaticosDimBNB;

// ---------------------------------------------------------------
// ÁREA REQUERIDA (m²) — soma da área de cada placa (já calculada e
// salva no cadastro, ver pages/cadastro.js: area = altura × largura)
// multiplicada pela quantidade de cada item do orçamento.
// ---------------------------------------------------------------
function calcularAreaRequeridaDimBNB(data){
  return (data.itensPlaca || []).reduce((acc, it) => {
    const area = +it.placa?.area || 0;
    return acc + (area * (it.qtd || 0));
  }, 0);
}

// ---------------------------------------------------------------
// MONTA OS DADOS DO DIMENSIONAMENTO — reaproveita montarDadosPropostaBNB
// (mesmo motor da Proposta BNB) e acrescenta os campos exclusivos
// deste formulário, vindos de `extras` (preenchidos no modal).
// ---------------------------------------------------------------
function montarDadosDimensionamentoBNB(data, extras, config){
  const cfg = config || {};
  const ex = extras || {};

  const base = (typeof window.montarDadosPropostaBNB === 'function')
    ? window.montarDadosPropostaBNB(data, cfg)
    : {};

  const areaRequerida = calcularAreaRequeridaDimBNB(data);
  const kwp = base.kwpKit || 0;

  // Telhado x solo: 100% automático, puxado da estrutura de fixação
  // escolhida no kit do orçamento — por padrão tudo no telhado, a
  // menos que a estrutura selecionada já seja de solo (mesma
  // detecção usada em montarDadosPropostaBNB → orcamentoDetalhado).
  const ehEstruturaSolo = !!(base.estruturaSelecionada?.nome || '').toString().toUpperCase().includes('SOLO');
  const potenciaTelhado = ehEstruturaSolo ? 0 : kwp;
  const potenciaSolo = ehEstruturaSolo ? kwp : 0;

  const consumoAtual = ex.consumoAtual != null ? +ex.consumoAtual : Math.round(base.potenciaGerador?.consumoMedioMes || 0);

  // Consumo adicional (G25 do modelo Excel): diferença entre a geração
  // estimada do kit e o consumo médio atual do cliente. Se positiva, o
  // BNB exige justificar essa "sobra" de geração com um eletrodoméstico
  // adicional — calculado 100% automático (ver calcularEletrodomesticoAutomaticoDimBNB).
  const geracaoEstimadaMes = base.reducaoMensal?.geracaoEstimadaKwhMes || 0;
  const g25 = geracaoEstimadaMes - (base.potenciaGerador?.consumoMedioMes || 0);
  const eletrodomesticoAutomatico = calcularEletrodomesticoAutomaticoDimBNB(g25);
  const levantamentoCargas = eletrodomesticoAutomatico ? [eletrodomesticoAutomatico] : [];
  const consumoAdicional = eletrodomesticoAutomatico ? eletrodomesticoAutomatico.totalKwh : 0;

  const orc = base.orcamentoDetalhado || { linhasMateriais: [], valorMaterial: 0, valorServicoInstalacao: 0, valorTotalFinal: 0 };

  const fornecedorMaterial = {
    nome: ex.fornecedorNome || '',
    cnpj: ex.fornecedorCnpj || '',
    valor: ex.valorAutorizacaoMaterial != null ? +ex.valorAutorizacaoMaterial : (orc.valorMaterial || 0)
  };
  const prestadorServico = {
    nome: ex.prestadorNome || base.empresa?.razaoSocial || 'Rocha Engenharia',
    cnpj: ex.prestadorCnpj || base.empresa?.cnpj || '',
    valor: ex.valorAutorizacaoServico != null ? +ex.valorAutorizacaoServico : (orc.valorServicoInstalacao || 0)
  };

  const tipoInstalacao = ex.tipoInstalacao || (ehEstruturaSolo ? 'SOLO' : 'TELHADO');
  const localInstalacao = ex.localInstalacao || `${tipoInstalacao} - ${base.identificacao?.endereco || ''}`;

  const investimentoTotalPrevia = orc.valorTotalFinal || (orc.valorMaterial + orc.valorServicoInstalacao) || 0;
  const valorEntrada = ex.valorEntrada != null ? +ex.valorEntrada : 0;
  // Comentários: sempre as notas padrão exigidas pelo BNB (2 cartas +
  // consumo adicional, se houver), mais a nota de entrada quando o
  // cliente vai financiar só parte do valor. Editável manualmente se
  // o usuário digitar algo diferente do texto sugerido.
  const comentarios = ex.comentarios || montarComentariosAutomaticosDimBNB({
    consumoAdicional, valorEntrada, investimentoTotal: investimentoTotalPrevia
  });

  // Linhas do orçamento exibidas no formulário: as mesmas do rateio
  // material (estrutura/inversor/painel) + a linha de serviço, que no
  // motor de cálculo fica separada (orc.valorServicoInstalacao).
  const linhasOrcamento = [
    ...(orc.linhasMateriais || []),
    {
      material: 'SERVIÇO DE INSTALAÇÃO (PROJETO, INSTALAÇÃO E HOMOLOGAÇÃO JUNTO A DISTRIBUIDORA)',
      unidade: 1,
      valor: orc.valorServicoInstalacao || 0
    }
  ];

  return {
    ...base,
    areaRequerida,
    potenciaTelhado,
    potenciaSolo,
    consumoAtual,
    consumoAdicional,
    levantamentoCargas,
    fornecedorMaterial,
    prestadorServico,
    localInstalacao,
    tipoInstalacao,
    prazoDias: ex.prazoDias != null ? +ex.prazoDias : (base.prazoExecucao?.diasMin || 90),
    comentarios,
    valorEntrada,
    eletrodomesticoAutomatico,
    g25,
    linhasOrcamento,
    investimentoTotal: investimentoTotalPrevia
  };
}
window.montarDadosDimensionamentoBNB = montarDadosDimensionamentoBNB;

// ---------------------------------------------------------------
// NOME DO ARQUIVO
// ---------------------------------------------------------------
function montarNomeDimensionamentoArquivoBNB(dados){
  const cliente = (dados.cliente?.nome || dados.identificacao?.nome || 'CLIENTE').toUpperCase();
  const dataStr = new Date().toLocaleDateString('pt-BR').split('/').join('.');
  return `DIMENSIONAMENTO - ${cliente} - ${dataStr}`.replace(/[\\/:*?"<>|]/g,'').trim();
}
window.montarNomeDimensionamentoArquivoBNB = montarNomeDimensionamentoArquivoBNB;

// ---------------------------------------------------------------
// FORMATAÇÃO (reaproveita as globais BNB se existirem)
// ---------------------------------------------------------------
function fmtMoedaDimBNB(v){ return (typeof fmtMoedaBNB === 'function') ? fmtMoedaBNB(v) : `R$ ${(+v||0).toFixed(2)}`; }
function fmtNumDimBNB(v, c){ return (typeof fmtNumBNB === 'function') ? fmtNumBNB(v, c) : (+v||0).toFixed(c ?? 0); }

// ---------------------------------------------------------------
// CSS — grade compacta de uma página, imitando o modelo original
// (barras laranja de seção, tabelas com bordas, tudo em uma folha).
// ---------------------------------------------------------------
function dimensionamentoBNBCss(){
  return `
:root{--orange:#E8672B;--dark:#2A1B10;--line:#C9BFAF;--light:#F3EFE9;}
*{margin:0;padding:0;box-sizing:border-box;font-family:'Barlow',sans-serif;}
body{background:#DCD6C8;}
.dim-page{width:210mm;min-height:297mm;margin:20px auto;background:#fff;padding:10mm 12mm;box-shadow:0 4px 24px rgba(0,0,0,.2);}
.dim-title{background:var(--orange);color:#fff;text-align:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;letter-spacing:.5px;text-transform:uppercase;padding:8px;margin-bottom:6px;}
.dim-bar{background:var(--orange);color:#fff;font-weight:700;font-size:11.5px;text-transform:uppercase;padding:5px 10px;letter-spacing:.3px;}
table.dim-table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:11px;}
table.dim-table td, table.dim-table th{border:1px solid var(--line);padding:5px 8px;}
table.dim-table td.lbl{background:var(--light);font-weight:700;width:22%;}
table.dim-table td.val{background:#fff;}
table.dim-table th{background:var(--light);font-weight:700;text-align:left;text-transform:uppercase;font-size:10px;}
table.dim-table td.num, table.dim-table th.num{text-align:center;}
table.dim-table tfoot td{font-weight:800;background:var(--light);}
.dim-two-col{display:grid;grid-template-columns:1fr 1fr;}
.dim-two-col > div{border:1px solid var(--line);border-top:none;}
.dim-two-col .dim-bar{margin:0;}
.dim-two-col table.dim-table{margin:0;border:none;}
.dim-two-col table.dim-table td{border-left:none;border-right:none;}
.dim-comentarios{border:1px solid var(--line);border-top:none;padding:8px 10px;font-size:11px;font-weight:600;text-align:center;color:var(--dark);}
.dim-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;font-size:10.5px;color:#6B5C4C;}
.dim-footer p{margin-bottom:2px;}
.dim-total-row td{background:var(--orange)!important;color:#fff;font-size:12px;}
@media print{
  body{background:#fff;}
  .dim-page{box-shadow:none;margin:0;width:auto;min-height:0;}
  .dim-toolbar{display:none!important;}
}
.dim-toolbar{max-width:210mm;margin:14px auto;display:flex;gap:10px;justify-content:flex-end;}
.dim-toolbar button{font-family:'Barlow',sans-serif;font-weight:700;font-size:13px;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;background:var(--orange);color:#fff;}
`;
}

// ---------------------------------------------------------------
// RENDER — monta a página inteira do dimensionamento
// ---------------------------------------------------------------
function renderDimensionamentoBNBHTML(dados){
  const emp = dados.empresa || {};
  const cli = dados.cliente || {};
  const id = dados.identificacao || {};

  const linhasCargasHtml = (dados.levantamentoCargas || []).map(l => `
    <tr>
      <td>${l.equipamento || ''}</td>
      <td class="num">${l.qtd || 0}</td>
      <td class="num">${l.diasMes || 0}</td>
      <td class="num">${fmtNumDimBNB(l.potenciaW, 0)}</td>
      <td class="num">${fmtNumDimBNB(l.consumoMensalKwh, 0)}</td>
      <td class="num">${fmtNumDimBNB(l.totalKwh, 0)}</td>
    </tr>`).join('');

  const blocoLevantamentoCargas = (dados.consumoAdicional > 0 || (dados.levantamentoCargas || []).length) ? `
  <div class="dim-bar">Levantamento de Cargas (preencher somente se houver consumo adicional)</div>
  <table class="dim-table">
    <thead><tr><th>Equipamentos</th><th class="num">Quantidade</th><th class="num">Dias por mês</th><th class="num">Potência unitária (W)</th><th class="num">Consumo mensal (kWh)</th><th class="num">Total (kWh)</th></tr></thead>
    <tbody>${linhasCargasHtml || '<tr><td colspan="6" style="text-align:center;color:#999">Nenhum equipamento informado</td></tr>'}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right">Total</td><td class="num">${fmtNumDimBNB(dados.consumoAdicional, 0)}</td></tr></tfoot>
  </table>` : '';

  const linhasOrcamentoHtml = (dados.linhasOrcamento || []).map(l => `
    <tr>
      <td>${l.material}</td>
      <td class="num">${fmtNumDimBNB(l.unidade, l.unidade % 1 === 0 ? 0 : 2)}</td>
      <td class="num">${fmtMoedaDimBNB(l.valor)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>${montarNomeDimensionamentoArquivoBNB(dados)}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;600;700&display=swap" rel="stylesheet">
<style>${dimensionamentoBNBCss()}</style>
</head>
<body>
<div class="dim-toolbar">
  <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="dim-page">
  <div class="dim-title">Dimensionamento do Sistema Fotovoltaico</div>

  <div class="dim-bar">Dados da Empresa</div>
  <table class="dim-table">
    <tr><td class="lbl">Nome</td><td class="val" colspan="3">${emp.nomeFantasia || ''}</td></tr>
    <tr><td class="lbl">Endereço</td><td class="val" colspan="3">${emp.endereco || ''}</td></tr>
    <tr><td class="lbl">CNPJ</td><td class="val">${emp.cnpj || ''}</td><td class="lbl">Contato</td><td class="val">${dados.empresaContato || ''}</td></tr>
    <tr><td class="lbl">E-mail</td><td class="val" colspan="3">${dados.empresaEmail || ''}</td></tr>
  </table>

  <div class="dim-bar">Dados do Cliente</div>
  <table class="dim-table">
    <tr><td class="lbl">Nome</td><td class="val" colspan="3">${id.nome || ''}</td></tr>
    <tr><td class="lbl">Endereço</td><td class="val" colspan="3">${id.endereco || ''}</td></tr>
    <tr><td class="lbl">CPF/CNPJ</td><td class="val">${cli.cpf_cnpj || ''}</td><td class="lbl">Contato</td><td class="val">${cli.telefone || ''}</td></tr>
    <tr><td class="lbl">E-mail</td><td class="val" colspan="3">${cli.email || ''}</td></tr>
  </table>

  <div class="dim-bar">Dados do Fornecedor/Serviço para Autorização de Faturamento</div>
  <div class="dim-two-col">
    <div>
      <div class="dim-bar" style="background:var(--dark)">1° Aut. de Faturamento: Fornecedor Material</div>
      <table class="dim-table">
        <tr><td class="lbl">CNPJ</td><td class="val">${dados.fornecedorMaterial?.cnpj || ''}</td></tr>
        <tr><td class="lbl">Nome Empresarial</td><td class="val">${dados.fornecedorMaterial?.nome || ''}</td></tr>
        <tr><td class="lbl">Valor da Autorização</td><td class="val">${fmtMoedaDimBNB(dados.fornecedorMaterial?.valor)}</td></tr>
      </table>
    </div>
    <div>
      <div class="dim-bar" style="background:var(--dark)">2° Aut. de Faturamento: Prestador de Serviço</div>
      <table class="dim-table">
        <tr><td class="lbl">CNPJ</td><td class="val">${dados.prestadorServico?.cnpj || ''}</td></tr>
        <tr><td class="lbl">Nome Empresarial</td><td class="val">${dados.prestadorServico?.nome || ''}</td></tr>
        <tr><td class="lbl">Valor da Autorização</td><td class="val">${fmtMoedaDimBNB(dados.prestadorServico?.valor)}</td></tr>
      </table>
    </div>
  </div>

  <div class="dim-bar">Dados do Dimensionamento</div>
  <table class="dim-table">
    <thead><tr><th>Unidade Consumidora (código da conta)</th><th class="num">Consumo Atual (kWh)</th><th class="num">Consumo Adicional (kWh)</th></tr></thead>
    <tbody><tr><td>${id.unidadeConsumidora || ''}</td><td class="num">${fmtNumDimBNB(dados.consumoAtual, 0)}</td><td class="num">${fmtNumDimBNB(dados.consumoAdicional, 0)}</td></tr></tbody>
  </table>

  ${blocoLevantamentoCargas}

  <div class="dim-bar">Características Gerais do Sistema</div>
  <table class="dim-table">
    <thead><tr><th>Potência do Sistema Fotovoltaico (kW)</th><th>Área requerida pelo sistema (m²)</th><th>Potência instalada em telhado (kW)</th><th>Potência instalada em solo (kW)</th></tr></thead>
    <tbody><tr><td class="num">${fmtNumDimBNB(dados.kwpKit, 2)}</td><td class="num">${fmtNumDimBNB(dados.areaRequerida, 0)}</td><td class="num">${fmtNumDimBNB(dados.potenciaTelhado, 2)}</td><td class="num">${fmtNumDimBNB(dados.potenciaSolo, 2)}</td></tr></tbody>
  </table>
  <table class="dim-table">
    <thead><tr><th>Local da Instalação</th><th>Redução Mensal Esperada (R$)</th><th>Tempo de Retorno (Payback)</th><th>Prazo para Funcionamento do Sistema</th></tr></thead>
    <tbody><tr><td>${dados.localInstalacao || ''}</td><td class="num">${fmtMoedaDimBNB(dados.reducaoMensal?.valorEconomia)}</td><td class="num">${fmtNumDimBNB(dados.payback?.meses, 2)} MESES</td><td class="num">${dados.prazoDias} DIAS</td></tr></tbody>
  </table>

  <div class="dim-bar">Orçamento</div>
  <table class="dim-table">
    <thead><tr><th>Equipamentos</th><th class="num">Quantidade</th><th class="num">Investimento</th></tr></thead>
    <tbody>${linhasOrcamentoHtml}</tbody>
    <tfoot><tr class="dim-total-row"><td colspan="2" style="text-align:right">Investimento Total</td><td class="num">${fmtMoedaDimBNB(dados.investimentoTotal)}</td></tr></tfoot>
  </table>

  <div class="dim-bar">Comentários/Justificativas</div>
  <div class="dim-comentarios">${dados.comentarios || '—'}</div>

  <div class="dim-footer">
    <div>
      <p><b>${emp.nomeFantasia || 'Rocha Engenharia'}</b></p>
      <p>${emp.endereco || ''}</p>
      <p>${dados.empresaContato || ''}</p>
    </div>
    <div style="text-align:right">
      <p>${dados.dataProposta || ''}</p>
    </div>
  </div>
</div>
</body></html>`;
}
window.renderDimensionamentoBNBHTML = renderDimensionamentoBNBHTML;

// ---------------------------------------------------------------
// ABRIR — monta dados, renderiza e abre em nova aba (sem Paged.js:
// é uma página só, o botão de imprimir usa o print nativo do
// navegador, que já dá pra "Salvar como PDF").
// ---------------------------------------------------------------
async function abrirDimensionamentoBNB(data, extras, config){
  if(!data.cliente || !data.cliente.id){
    toast('Selecione um cliente antes de gerar o Dimensionamento BNB.', 'warning');
    return;
  }
  if(!extras.fornecedorNome || !extras.fornecedorCnpj){
    toast('Selecione um fornecedor de material com nome e CNPJ cadastrados.', 'warning');
    return;
  }

  const cfgGlobal = (typeof carregarPropostaConfigMesclada === 'function') ? await carregarPropostaConfigMesclada() : {};
  const cfg = { ...cfgGlobal, ...(config || {}) };

  const dados = montarDadosDimensionamentoBNB(data, extras, cfg);
  // Contato/e-mail da empresa — mesmos dados usados no rodapé das outras propostas.
  dados.empresaContato = cfg.rodape_telefone || '';
  dados.empresaEmail = cfg.empresa?.email || '';

  const html = renderDimensionamentoBNBHTML(dados);
  const blob = new Blob([html], { type:'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
window.abrirDimensionamentoBNB = abrirDimensionamentoBNB;

// ---------------------------------------------------------------
// MODAL — pergunta o fornecedor de material (toda vez, a pedido) e
// os demais campos que não existem em outro lugar do orçamento.
// Os valores de material/serviço/redução/payback já vêm calculados
// automaticamente, mas ficam editáveis aqui pra ajuste fino.
// ---------------------------------------------------------------
function abrirModalDimensionamentoBNB(){
  if (!OS.cliente) {
    toast('Selecione um cliente antes de gerar o Dimensionamento BNB.', 'warning', 5000);
    const pickCliente = document.getElementById('pickCliente');
    if (pickCliente) { pickCliente.scrollIntoView({ behavior:'smooth', block:'center' }); pickCliente.click(); }
    return;
  }
  if (!OS.resultado || !(OS.resultado.totalGeral > 0)) {
    toast('Preencha o "Valor Fornecedor" no orçamento antes de gerar o Dimensionamento BNB.', 'warning');
    return;
  }

  const html = `
    <div class="form-grid1">
      <div class="field span-2">
        <label>Fornecedor de material</label>
        <select class="input" id="dimFornecedorSelect">
          <option value="">Carregando fornecedores…</option>
        </select>
        <div class="hint">Perguntado toda vez que o Dimensionamento é gerado — cadastre novos fornecedores em Configurações &gt; Fornecedores, ou pelo atalho abaixo.</div>
      </div>

      <div class="field span-2" id="dimNovoFornecedorWrap" style="display:none;border:1px dashed var(--border);border-radius:10px;padding:12px;margin-top:-6px">
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="field" style="margin:0"><label>Nome empresarial</label><input class="input" id="dimNovoFornecedorNome" placeholder="Ex: FORTLEV ENERGIA SOLAR LTDA"></div>
          <div class="field" style="margin:0"><label>CNPJ</label><input class="input" id="dimNovoFornecedorCnpj" placeholder="00.000.000/0000-00"></div>
          <div class="field" style="margin:0"><label>Contato</label><input class="input" id="dimNovoFornecedorContato" placeholder="(99) 99999-9999"></div>
          <div class="field" style="margin:0"><label>E-mail</label><input class="input" id="dimNovoFornecedorEmail" placeholder="contato@fornecedor.com"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
          <button type="button" class="btn btn-ghost btn-sm" id="btnCancelNovoFornecedor">Cancelar</button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnSalvarNovoFornecedor">${icon('check')} Salvar fornecedor</button>
        </div>
      </div>

      <div class="field span-2" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
        <div class="hint" style="margin-bottom:6px">Calculado automaticamente a partir do orçamento e da estrutura do kit — nada aqui precisa ser digitado:</div>
        <div id="dimResumoAutomatico" style="display:flex;flex-direction:column;gap:4px;font-size:12px;background:var(--surface-3);border-radius:8px;padding:10px 12px;color:var(--text-faint)">
          Calculando…
        </div>
      </div>

      <div class="field">
        <label>Prazo para funcionamento (dias)</label>
        <input class="input" id="dimPrazoDias" type="number" min="1" value="90">
      </div>
      <div class="field">
        <label>Local da instalação <span class="text-faint" style="font-weight:400">(auto-preenchido, editável)</span></label>
        <input class="input" id="dimLocalInstalacao" placeholder="TELHADO - endereço do cliente">
      </div>

      <div class="field span-2" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
        <label>Valor da autorização — Material <span class="text-faint" style="font-weight:400">(calculado automaticamente, editável)</span></label>
        <input class="input" id="dimValorMaterial" type="text" placeholder="0,00">
      </div>
      <div class="field span-2">
        <label>Valor da autorização — Serviço <span class="text-faint" style="font-weight:400">(calculado automaticamente, editável)</span></label>
        <input class="input" id="dimValorServico" type="text" placeholder="0,00">
      </div>

      <div class="field span-2">
        <label>Valor de entrada <span class="text-faint" style="font-weight:400">— opcional, só se o cliente for dar entrada com recurso próprio</span></label>
        <input class="input" id="dimValorEntrada" type="text" placeholder="0,00 (deixe em branco se não houver entrada)">
      </div>

      <div class="field span-2">
        <label>Comentários/Justificativas <span class="text-faint" style="font-weight:400">(preenchido automaticamente com as notas obrigatórias — editável)</span></label>
        <textarea class="input" id="dimComentarios" rows="3"></textarea>
      </div>
    </div>
  `;

  openModal({
    id: 'modalDimensionamentoBNB',
    title: 'Dimensionamento BNB',
    sub: 'Preencha o que não vem automático do orçamento — o resto (kWp, área, payback, redução mensal) já vem calculado',
    width: 680,
    bodyHtml: html,
    footHtml: `
      <button class="btn btn-secondary" id="btnCancelDimBNB">Cancelar</button>
      <button class="btn btn-primary" id="btnGerarDimBNB">${icon('file-output')} Gerar Dimensionamento</button>
    `
  });
  refreshIcons();

  // ---- Fornecedores: carrega a lista cadastrada e preenche o <select> ----
  // (perguntado toda vez que o Dimensionamento é gerado, como pedido —
  // mas agora escolhendo de uma lista já cadastrada em vez de digitar).
  let _fornecedoresDim = [];

  function popularSelectFornecedoresDim(selecionarId){
    const sel = document.getElementById('dimFornecedorSelect');
    if(!sel) return;
    const opts = _fornecedoresDim.map(f =>
      `<option value="${f.id}">${(f.nome_empresarial || 'Sem nome')} — ${f.cnpj || 'sem CNPJ'}</option>`
    ).join('');
    sel.innerHTML = `<option value="">Selecione o fornecedor…</option>${opts}<option value="__novo__">+ Cadastrar novo fornecedor</option>`;
    // Com fornecedor(es) já cadastrado(s), seleciona o primeiro automaticamente
    // — o usuário ainda pode trocar, mas não precisa escolher manualmente
    // toda vez que só existe (ou costuma existir) uma opção óbvia.
    if(selecionarId){
      sel.value = String(selecionarId);
    } else if(_fornecedoresDim.length){
      sel.value = String(_fornecedoresDim[0].id);
    }
  }

  async function carregarFornecedoresDim(selecionarId){
    try {
      const lista = await apiGetCached('/configuracoes/fornecedores');
      _fornecedoresDim = Array.isArray(lista) ? lista : [];
    } catch(e) {
      _fornecedoresDim = [];
    }
    popularSelectFornecedoresDim(selecionarId);
  }
  carregarFornecedoresDim();

  document.getElementById('dimFornecedorSelect').addEventListener('change', (e) => {
    const wrap = document.getElementById('dimNovoFornecedorWrap');
    wrap.style.display = e.target.value === '__novo__' ? 'block' : 'none';
  });

  document.getElementById('btnCancelNovoFornecedor').addEventListener('click', () => {
    document.getElementById('dimNovoFornecedorWrap').style.display = 'none';
    document.getElementById('dimFornecedorSelect').value = '';
  });

  document.getElementById('btnSalvarNovoFornecedor').addEventListener('click', async () => {
    const nome_empresarial = document.getElementById('dimNovoFornecedorNome').value.trim();
    const cnpj = document.getElementById('dimNovoFornecedorCnpj').value.trim();
    const contato = document.getElementById('dimNovoFornecedorContato').value.trim();
    const email = document.getElementById('dimNovoFornecedorEmail').value.trim();
    if(!nome_empresarial || !cnpj){
      toast('Informe ao menos o nome empresarial e o CNPJ do fornecedor.', 'warning');
      return;
    }
    const result = await apiPost('/configuracoes/fornecedores', { nome_empresarial, cnpj, contato, email });
    if(result){
      invalidateCache('/configuracoes/fornecedores');
      toast('Fornecedor cadastrado!', 'success');
      document.getElementById('dimNovoFornecedorWrap').style.display = 'none';
      ['dimNovoFornecedorNome','dimNovoFornecedorCnpj','dimNovoFornecedorContato','dimNovoFornecedorEmail'].forEach(id => document.getElementById(id).value = '');
      await carregarFornecedoresDim(result.id);
    } else {
      toast('Erro ao cadastrar fornecedor.', 'error');
    }
  });

  // Pré-preenche os valores calculados automaticamente (telhado/solo,
  // consumo adicional/eletrodoméstico, comentários) e deixa só os campos
  // realmente manuais (fornecedor, prazo, valores de autorização, entrada)
  // para o usuário olhar/ajustar.
  let _previaDimAtual = null;
  const elComentarios = document.getElementById('dimComentarios');
  const elValorEntrada = document.getElementById('dimValorEntrada');

  function atualizarResumoAutomatico(previa){
    const resumoEl = document.getElementById('dimResumoAutomatico');
    if(!resumoEl) return;
    const linhas = [
      `Instalação: <b>${previa.tipoInstalacao === 'SOLO' ? 'Solo' : 'Telhado'}</b> — ${formatarNumero(previa.potenciaTelhado,2)} kW no telhado / ${formatarNumero(previa.potenciaSolo,2)} kW no solo`,
    ];
    if(previa.eletrodomesticoAutomatico){
      const e = previa.eletrodomesticoAutomatico;
      linhas.push(`Consumo adicional: <b>${formatarNumero(previa.consumoAdicional,2)} kWh</b> — justificado com ${e.qtd}x ${e.equipamento} (${e.diasMes} dias/mês, ${e.potenciaW}W)`);
    } else {
      linhas.push(`Consumo adicional: <b>nenhum</b> — geração do kit não ultrapassa o consumo médio do cliente`);
    }
    resumoEl.innerHTML = linhas.map(l => `<div>${l}</div>`).join('');
  }

  function atualizarComentariosAuto(){
    if(elComentarios.dataset.manual === 'true' || !_previaDimAtual) return;
    const valorEntrada = parseMoney(elValorEntrada.value) || 0;
    elComentarios.value = montarComentariosAutomaticosDimBNB({
      consumoAdicional: _previaDimAtual.consumoAdicional,
      valorEntrada,
      investimentoTotal: _previaDimAtual.investimentoTotal
    });
  }

  (async () => {
    try {
      const cfgGlobal = (typeof carregarPropostaConfigMesclada === 'function') ? await carregarPropostaConfigMesclada() : {};
      // 🔴 CORREÇÃO: sem isso, "consumo médio" (usado no cálculo do G25) caía
      // no fallback = própria geração do kit sempre que o cliente não tinha
      // Histórico de Consumo cadastrado — G25 dava ~0 e o eletrodoméstico
      // automático nunca aparecia. geracaoDesejada é o valor que o usuário
      // digitou em "Geração desejada (kWh/mês)" ao montar o kit — é o
      // consumo real que está sendo usado como alvo do dimensionamento.
      const geracaoDesejada = parseFloat(document.getElementById('pGeracao')?.value) || 0;
      const dataPrevia = {
        itensPlaca: OS.itensPlaca, itensInversor: OS.itensInversor, itensBateria: OS.itensBateria,
        itensOutros: OS.itensOutros, itensMateriais: OS.itensMateriais, cliente: OS.cliente,
        vendedor: OS.vendedor, estrutura: OS.estrutura, resultado: OS.resultado, geracaoDesejada
      };
      const cfgPrevia = { ...cfgGlobal, ...OS.propostaConfig, estrutura: OS.estrutura, vendedor: OS.vendedor };
      const previa = montarDadosDimensionamentoBNB(dataPrevia, {}, cfgPrevia);
      _previaDimAtual = previa;

      document.getElementById('dimLocalInstalacao').value = previa.localInstalacao || '';
      document.getElementById('dimValorMaterial').value = formatarNumero(previa.fornecedorMaterial.valor, 2);
      document.getElementById('dimValorServico').value = formatarNumero(previa.prestadorServico.valor, 2);
      atualizarResumoAutomatico(previa);
      atualizarComentariosAuto();
    } catch(err) {
      // Nunca deixa o modal "travado" sem comentário/resumo por causa de um
      // erro no meio do cálculo — cai pro texto padrão mínimo e avisa no console.
      console.error('Erro ao pré-calcular Dimensionamento BNB:', err);
      _previaDimAtual = _previaDimAtual || { consumoAdicional: 0, investimentoTotal: OS.resultado?.totalGeral || 0 };
      if(elComentarios.dataset.manual !== 'true' && !elComentarios.value){
        elComentarios.value = montarComentariosAutomaticosDimBNB({ consumoAdicional: 0, valorEntrada: 0, investimentoTotal: _previaDimAtual.investimentoTotal });
      }
      const resumoEl = document.getElementById('dimResumoAutomatico');
      if(resumoEl) resumoEl.innerHTML = `<div style="color:var(--danger,#c0392b)">Não foi possível calcular automaticamente — confira o kit/cliente selecionado.</div>`;
    }
  })();

  elValorEntrada.addEventListener('input', atualizarComentariosAuto);
  elComentarios.addEventListener('input', () => { elComentarios.dataset.manual = 'true'; });

  document.getElementById('btnCancelDimBNB').addEventListener('click', () => closeModal('modalDimensionamentoBNB'));

  document.getElementById('btnGerarDimBNB').addEventListener('click', async () => {
    const fornecedorId = document.getElementById('dimFornecedorSelect').value;
    if(!fornecedorId || fornecedorId === '__novo__'){
      toast('Selecione o fornecedor de material (ou cadastre um novo).', 'warning');
      return;
    }
    const fornecedorSelecionado = _fornecedoresDim.find(f => String(f.id) === String(fornecedorId));
    if(!fornecedorSelecionado){
      toast('Fornecedor selecionado não encontrado — tente novamente.', 'warning');
      return;
    }

    const extras = {
      fornecedorNome: fornecedorSelecionado.nome_empresarial || '',
      fornecedorCnpj: fornecedorSelecionado.cnpj || '',
      // Consumo adicional, eletrodoméstico automático e telhado/solo NÃO
      // entram mais aqui — são recalculados 100% automático dentro de
      // montarDadosDimensionamentoBNB (a partir do orçamento/estrutura).
      prazoDias: parseInt(document.getElementById('dimPrazoDias').value) || 90,
      localInstalacao: document.getElementById('dimLocalInstalacao').value.trim(),
      valorAutorizacaoMaterial: parseMoney(document.getElementById('dimValorMaterial').value) || 0,
      valorAutorizacaoServico: parseMoney(document.getElementById('dimValorServico').value) || 0,
      valorEntrada: parseMoney(elValorEntrada.value) || 0,
      comentarios: elComentarios.value.trim()
    };

    if(!extras.fornecedorNome || !extras.fornecedorCnpj){
      toast('O fornecedor selecionado está sem nome ou CNPJ cadastrado — edite-o em Configurações > Fornecedores.', 'warning');
      return;
    }

    const cfgGlobal = (typeof carregarPropostaConfigMesclada === 'function') ? await carregarPropostaConfigMesclada() : {};
    const geracaoDesejada = parseFloat(document.getElementById('pGeracao')?.value) || 0;
    const data = {
      itensPlaca: OS.itensPlaca, itensInversor: OS.itensInversor, itensBateria: OS.itensBateria,
      itensOutros: OS.itensOutros, itensMateriais: OS.itensMateriais, cliente: OS.cliente,
      vendedor: OS.vendedor, estrutura: OS.estrutura, resultado: OS.resultado, geracaoDesejada
    };
    const cfg = { ...cfgGlobal, ...OS.propostaConfig, estrutura: OS.estrutura, vendedor: OS.vendedor };

    closeModal('modalDimensionamentoBNB');
    await abrirDimensionamentoBNB(data, extras, cfg);
  });
}
window.abrirModalDimensionamentoBNB = abrirModalDimensionamentoBNB;

console.log('%c⚡ Solar Pro 2.0 — dimensionamento-bnb.js v1.0 carregado', 'color:#ffb020;font-weight:bold');
