// ============================================================
// SOLAR PRO 2.0 — pages/proposta-resumida.js
// Modal "Resumo da Proposta" (abas Vendedor / Cliente / Itens),
// extraído de pages/orcamento.js para manter cada arquivo focado.
//
// Este arquivo cuida SOMENTE da apresentação da proposta resumida:
//   - Cálculo de exibição (valores financeiros, comissão, parcela)
//   - Tabela de financiamento com bancos parceiros (dinâmica, via
//     Configurações de Cálculo → Financiamento)
//   - Galeria com fotos dos equipamentos (placas/inversores) do kit
//   - Montagem do HTML/CSS do modal com abas
//   - Alternância de abas e captura de Print Screen (html2canvas)
//
// DEPENDE DE (devem estar carregados antes):
//   - core.js (formatarMoeda, formatarNumero, toast, apiPost, icon...)
//   - ui.js (openModal, refreshIcons)
//   - proposta-config-shared.js (getSimulacoesFinanciamento, calcularParcelaPrice)
//   - pages/orcamento.js (usa o estado global OS e _configGlobal definidos lá)
//
// abrirProposta() é chamada a partir de pages/orcamento.js
// (botão "Gerar Proposta" e clique num item da lista de resumo).
// ============================================================

// ============================================================
// GALERIA DE EQUIPAMENTOS (fotos de placas/inversores lado a lado)
// ============================================================
// Deduplica por marca+modelo (evita repetir a mesma foto quando o
// usuário adicionou o mesmo equipamento em duas linhas), e monta um
// "leque" de fotos empilhadas com leve rotação/deslocamento quando
// existe mais de um modelo diferente no kit (ex: 2 placas diferentes).
// Como as imagens são PNG (fundo transparente), a sobreposição parcial
// fica visualmente agradável, como um catálogo de produtos.

function _prTituloEquip(eq){
  return `${eq?.marca || ''} ${eq?.modelo || eq?.nome || ''}`.trim() || 'Equipamento';
}

function _prEquipUnicos(itens, chave){
  const vistos = new Set();
  const unicos = [];
  (itens || []).forEach(it => {
    const eq = it[chave];
    if (!eq) return;
    const nome = _prTituloEquip(eq);
    const dedupeKey = `${nome}|${eq.imagem_url || ''}`;
    if (vistos.has(dedupeKey)) return;
    vistos.add(dedupeKey);
    unicos.push({ eq, nome });
  });
  return unicos;
}

// Limite de fotos empilhadas por grupo — além disso, só soma um "+N"
// pra não estourar o card quando o kit tem muitos modelos diferentes.
const PR_GALLERY_MAX = 4;

function _prRenderGrupoGaleria(unicos, labelVazio){
  if (!unicos.length) {
    return `<div class="pr-gallery-empty">${labelVazio}</div>`;
  }

  const visiveis = unicos.slice(0, PR_GALLERY_MAX);
  const extras = unicos.length - visiveis.length;
  const n = visiveis.length;

  const itemsHtml = visiveis.map((u, i) => {
    // Centraliza o leque: item do meio fica parado, os demais se
    // espalham pra esquerda/direita com leve rotação alternada.
    const centro = (n - 1) / 2;
    const delta = i - centro;
    const offsetX = n > 1 ? delta * 42 : 0;
    const rotate = n > 1 ? delta * 7 : 0;
    const zIndex = 20 - Math.abs(Math.round(delta * 10)); // o do meio fica por cima

    const temImagem = !!u.eq.imagem_url;
    const conteudo = temImagem
      ? `<img src="${u.eq.imagem_url}" alt="${u.nome}" onerror="this.closest('.pr-gallery-item').classList.add('pr-gallery-noimg');this.remove();">`
      : icon('image');

    return `<div class="pr-gallery-item${temImagem ? '' : ' pr-gallery-noimg'}"
        style="transform:translateX(${offsetX}px) rotate(${rotate}deg);z-index:${zIndex};"
        title="${u.nome}">
        ${conteudo}
      </div>`;
  }).join('');

  const legendaNomes = visiveis.map(u => u.nome).join(' · ');
  const legendaExtra = extras > 0 ? ` <span class="pr-gallery-extra">+${extras}</span>` : '';

  return `
    <div class="pr-gallery-stack">${itemsHtml}</div>
    <div class="pr-gallery-caption">${legendaNomes}${legendaExtra}</div>
  `;
}

function renderGaleriaEquipamentosHtml(data){
  const uniqPlacas = _prEquipUnicos(data.itensPlaca, 'placa');
  const uniqInversores = _prEquipUnicos(data.itensInversor, 'inversor');

  // Só mostra a galeria se o kit realmente tem placa ou inversor
  // cadastrado — não faz sentido pra orçamento só de materiais/serviço.
  if (!uniqPlacas.length && !uniqInversores.length) return '';

  return `
    <div class="card1">
      <div class="card-title1">${icon('image')} EQUIPAMENTOS DO KIT</div>
      <div class="pr-gallery">
        <div class="pr-gallery-group">
          <div class="pr-gallery-group-label">${icon('solar-panel')} Placa${uniqPlacas.length > 1 ? 's' : ''} Solar${uniqPlacas.length > 1 ? 'es' : ''}</div>
          ${_prRenderGrupoGaleria(uniqPlacas, 'Sem placa cadastrada')}
        </div>
        <div class="pr-gallery-group">
          <div class="pr-gallery-group-label">${icon('zap')} Inversor${uniqInversores.length > 1 ? 'es' : ''}</div>
          ${_prRenderGrupoGaleria(uniqInversores, 'Sem inversor cadastrado')}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// PROPOSTA SIMPLES
// ============================================================
function abrirProposta(itemOverride, salvarHistorico = true){
  // 🔴 SE NÃO FOI PASSADO, USA O PADRÃO SALVO
  if (salvarHistorico === undefined || salvarHistorico === null) {
    salvarHistorico = typeof _getSalvarHistoricoPadrao === 'function' 
      ? _getSalvarHistoricoPadrao() 
      : true;
  }

  const data = itemOverride || {
    itensPlaca: OS.itensPlaca,
    itensInversor: OS.itensInversor,
    itensBateria: OS.itensBateria,
    itensOutros: OS.itensOutros,
    itensMateriais: OS.itensMateriais,
    cliente: OS.cliente,
    vendedor: OS.vendedor,
    estrutura: OS.estrutura,
    resultado: OS.resultado
  };

  // 🔴 ADICIONA A PREFERÊNCIA AOS DADOS
  data.salvarHistorico = salvarHistorico;

  if(!data.resultado){
    toast('Nenhum cálculo disponível para gerar proposta','warning');
    return;
  }

  const r = data.resultado;

  // ==========================================================
  // FINANCEIRO - CORRIGIDO
  // ==========================================================

  const valorFornecedor = r.valorForn || 0;
  const valorRecomendado = r.valorRecomendado || (valorFornecedor * (1 + (r.imposto || 0)));
  const valorOrcamentoEquipamentos = r.valorOrcamentoEquipamentos || 0;
  const valorTotalGeral = r.totalGeral || 0;
  
  const pImposto = (r.imposto || 0) * 100;
  const pMargem = (r.margem || 0) * 100;

  const valorMargem = valorRecomendado * (r.margem || 0);
  const valorCustos = valorFornecedor * (r.imposto || 0);

  const comissaoPercentual = (_configGlobal?.comissao_percentual || 0);
  const valorComissao = valorTotalGeral * comissaoPercentual / 100;
  const comissaoAcrescimo = valorComissao + (r.acrescimo || 0);

  // ==========================================================
  // INVESTIMENTO PARCELADO (aba Cliente) — mesclado do V1
  // ==========================================================
  const parcela12semJuros = valorTotalGeral / 12;

  // ==========================================================
  // FINANCIAMENTO COM BANCOS PARCEIROS — agora dinâmico, vindo de
  // Configurações de Cálculo > Financiamento (em vez das taxas fixas do V1)
  // ==========================================================
  const primeiraPlacaFin = data.itensPlaca[0]?.placa || null;
  const primeiroInversorFin = data.itensInversor[0]?.inversor || null;
  const simFin = (typeof getSimulacoesFinanciamento === 'function')
    ? getSimulacoesFinanciamento(primeiraPlacaFin, primeiroInversorFin, _configGlobal)
    : { bancos: [], entrada_percentual: 0, carencia_meses: 3 };
  const bancosFin = simFin.bancos || [];
  const valorFinanciado = valorTotalGeral * (1 - (simFin.entrada_percentual || 0) / 100);
  const prazosFin = [...new Set(bancosFin.flatMap(b => Object.keys(b.taxas || {}).map(Number)))].sort((a,b) => a-b);

  let financiamentoTableHTML = '';
  if(bancosFin.length === 0){
    financiamentoTableHTML = '<div class="pr-empty">Nenhum banco configurado em <b>Configurações de Cálculo → Financiamento</b>.</div>';
  }else{
    financiamentoTableHTML = `
    <div class="pr-table-wrap">
      <table class="pr-fin-table">
        <thead><tr><th>Parcelas</th>${bancosFin.map(b => `<th>${b.nome}</th>`).join('')}</tr></thead>
        <tbody>
          ${prazosFin.map(p => `
            <tr>
              <td>${p}x</td>
              ${bancosFin.map(b => {
                const taxa = b.taxas?.[p];
                const parcela = taxa ? calcularParcelaPrice(valorFinanciado, taxa, p) : null;
                return `<td>${parcela ? formatarMoeda(parcela) : '—'}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${simFin.entrada_percentual > 0 || simFin.carencia_meses > 0 ? `<div class="pr-obs">Entrada de ${simFin.entrada_percentual || 0}% · Carência de ${simFin.carencia_meses || 0} mês(es). Valores podem variar conforme análise de crédito.</div>` : '<div class="pr-obs">Os valores apresentados na simulação podem variar conforme análise de crédito.</div>'}
    `;
  }

  // ==========================================================
  // EQUIPAMENTOS
  // ==========================================================

  let equipamentosHTML = "";

  data.itensPlaca.forEach(i=>{
    equipamentosHTML += `
    <tr>
      <td>${icon('solar-panel')}</td>
      <td>Módulo Solar</td>
      <td>${i.placa.marca} ${i.placa.modelo}</td>
      <td>${i.qtd}</td>
    </tr>`;
  });

  data.itensInversor.forEach(i=>{
    equipamentosHTML += `
    <tr>
      <td>${icon('zap')}</td>
      <td>Inversor</td>
      <td>${i.inversor.marca} ${i.inversor.modelo}</td>
      <td>${i.qtd}</td>
    </tr>`;
  });

  data.itensBateria.forEach(i=>{
    equipamentosHTML += `
    <tr>
      <td>${icon('battery')}</td>
      <td>Bateria</td>
      <td>${i.bateria.nome}</td>
      <td>${i.qtd}</td>
    </tr>`;
  });

  (data.itensOutros || []).forEach(i=>{
    equipamentosHTML += `
    <tr>
      <td>${icon('package')}</td>
      <td>${i.outros?.categoria || 'Outro equipamento'}</td>
      <td>${i.outros?.nome || ''} ${i.outros?.modelo || ''}</td>
      <td>${i.qtd}</td>
    </tr>`;
  });

  // Composição resumida
  const itensMiniTableHTML = `
    <table class="pr-mini-table">
      <tbody>
        <tr><td class="pr-mini-ico">${icon('layout-grid')}</td><td>Estrutura</td><td>${data.estrutura?.nome || '-'}</td></tr>
        ${data.itensPlaca.map(i => `<tr><td class="pr-mini-ico">${icon('solar-panel')}</td><td>${i.qtd}x Placa</td><td>${i.placa.marca} ${i.placa.potencia || ''}W ${i.placa.tipo}</td></tr>`).join('')}
        ${data.itensInversor.map(i => `<tr><td class="pr-mini-ico">${icon('zap')}</td><td>${i.qtd}x Inversor</td><td>${i.inversor.marca} ${i.inversor.tipo} ${i.inversor.potencia || ''}W ${i.inversor.fase} ${i.inversor.tensao}</td></tr>`).join('')}
        ${data.itensBateria.map(i => `<tr><td class="pr-mini-ico">${icon('battery')}</td><td>${i.qtd}x Bateria</td><td>${i.bateria.nome}</td></tr>`).join('')}
        ${(data.itensOutros || []).map(i => `<tr><td class="pr-mini-ico">${icon('package')}</td><td>${i.qtd}x ${i.outros?.categoria || 'Outro'}</td><td>${i.outros?.nome || ''} ${i.outros?.modelo || ''}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  // ==========================================================
  // MATERIAIS
  // ==========================================================

  let materiaisHTML = "";

  data.itensMateriais
  .filter(x=>x.mostrarProposta!==false)
  .forEach(m=>{
    materiaisHTML += `
    <tr>
      <td>${m.descricao}</td>
      <td>${m.qtd}</td>
      <td>${m.unidade}</td>
      <td>${formatarMoeda(m.valorUnit)}</td>
      <td>${formatarMoeda(m.qtd*m.valorUnit)}</td>
    </tr>`;
  });

  // ==========================================================
  // GALERIA DE FOTOS DOS EQUIPAMENTOS (placas/inversores)
  // ==========================================================
  const galeriaEquipamentosHtml = renderGaleriaEquipamentosHtml(data);

  // ==========================================================
  // HTML
  // ==========================================================

  const html = `
  <style>
    .proposta{
      font-family:Inter,Arial,sans-serif;
      color:#1f2937;
      font-size:13px;
    }

    .header-proposta{ margin-bottom:14px; }
    .header-proposta h1{ font-size:20px; display:flex; align-items:center; gap:8px; }
    .header-proposta .sub{ color:#64748b; font-size:12px; margin-top:2px; }

    .pr-tabs{ display:flex; gap:4px; border-bottom:2px solid #e5e7eb; margin-bottom:14px; }
    .pr-tab-btn{
      display:flex; align-items:center; gap:6px; padding:8px 16px; font-size:12.5px; font-weight:700;
      color:#64748b; background:none; border:none; cursor:pointer; border-bottom:2px solid transparent;
      margin-bottom:-2px; border-radius:6px 6px 0 0;
    }
    .pr-tab-btn svg{ width:14px; height:14px; }
    .pr-tab-btn:hover{ background:#f8fafc; }
    .pr-tab-btn.active{ color:#E8672B; border-bottom-color:#E8672B; }
    .pr-tab-content{ display:none; }
    .pr-tab-content.active{ display:block; }

    .pr-row2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
    .card1{
      background:white; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;
    }
    .card-title1{
      padding:10px 16px; font-size:11.5px; font-weight:700; color:#64748b;
      border-bottom:1px solid #eee; letter-spacing:.02em;
    }

    .info{ padding:12px 16px; display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; }
    .kpi{ background:#f8fafc; border-radius:10px; padding:10px 12px; }
    .kpi-label{ font-size:11px; color:#64748b; }
    .kpi-value{ font-size:14px; font-weight:700; }
    .finance-value{ font-size:14px; font-weight:800; }
    .tag{
      display:inline-block; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:bold;
      background:#e8f7ee; color:#138a44; margin-left:4px;
    }
    .kpi-descricao{ padding:0 16px 12px; }
    .pr-mini-table{ width:100%; border-collapse:collapse; font-size:11.5px; }
    .pr-mini-table td{ padding:4px 6px; border-bottom:1px solid #f0f0f0; color:#374151; }
    .pr-mini-table tr:last-child td{ border-bottom:0; }
    .pr-mini-table td:nth-child(2){ color:#64748b; white-space:nowrap; font-weight:600; }
    .pr-mini-table td:nth-child(3){ font-weight:600; }
    .pr-mini-ico{ width:18px; }
    .pr-mini-ico svg{ width:13px; height:13px; color:#94a3b8; }

    .pr-investimento{ padding:14px 16px; text-align:center; }
    .pr-investimento .valor{ font-size:22px; font-weight:800; color:#138a44; }
    .pr-investimento .parcela{ font-size:12px; color:#64748b; margin-top:2px; }
    .pr-condicoes{ display:flex; flex-wrap:wrap; gap:6px 14px; justify-content:center; margin-top:10px; font-size:11px; color:#138a44; font-weight:600; }

    .detail{ padding:6px 16px 10px; }
    .detail-row{ display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f0f0f0; font-size:12px; }
    .detail-row:last-child{ border:0; font-weight:800; padding-top:6px; }
    .detail-label{ color:#64748b; }
    .detail-value{ font-weight:700; }

    table{ width:100%; border-collapse:collapse; font-size:12px; }
    th{ background:#f8fafc; text-align:left; padding:8px 10px; font-size:11px; color:#64748b; }
    td{ padding:7px 10px; border-bottom:1px solid #eee; }
    .pr-table-wrap{ overflow-x:auto; }
    .pr-fin-table th, .pr-fin-table td{ text-align:center; }
    .pr-fin-table th:first-child, .pr-fin-table td:first-child{ text-align:left; font-weight:700; }
    .pr-obs{ padding:8px 16px 12px; font-size:10.5px; color:#94a3b8; }
    .pr-empty{ padding:20px 16px; text-align:center; color:#94a3b8; font-size:12px; }

    .pr-materiais-scroll{ max-height:180px; overflow-y:auto; }

    /* ===== GALERIA DE EQUIPAMENTOS (placas/inversores lado a lado) ===== */
    .pr-gallery-card{ margin-bottom:12px; }
    .pr-gallery{
      display:grid; grid-template-columns:1fr 1fr; gap:8px;
      padding:14px 16px 16px;
    }
    .pr-gallery-group{ text-align:center; }
    .pr-gallery-group + .pr-gallery-group{
      border-left:1px dashed #e5e7eb;
    }
    .pr-gallery-group-label{
      display:flex; align-items:center; justify-content:center; gap:5px;
      font-size:10.5px; font-weight:700; color:#64748b;
      text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px;
    }
    .pr-gallery-group-label svg{ width:12px; height:12px; }
    .pr-gallery-stack{
      position:relative;
      height:104px;
      display:flex; align-items:center; justify-content:center;
    }
    .pr-gallery-item{
      position:absolute;
      width:96px; height:96px;
      display:flex; align-items:center; justify-content:center;
      transition:transform .15s ease;
    }
    .pr-gallery-item img{
      max-width:100%; max-height:100%; object-fit:contain;
      filter:drop-shadow(0 4px 8px rgba(0,0,0,.16));
    }
    .pr-gallery-item:hover{
      transform:translateY(-6px) scale(1.06) !important;
      z-index:99 !important;
    }
    .pr-gallery-item.pr-gallery-noimg{
      width:60px; height:60px;
      border-radius:10px;
      background:#f1f5f9;
      color:#cbd5e1;
    }
    .pr-gallery-item.pr-gallery-noimg svg{ width:22px; height:22px; }
    .pr-gallery-caption{
      font-size:10px; color:#64748b; line-height:1.4;
      padding:0 4px; margin-top:2px;
    }
    .pr-gallery-extra{
      display:inline-block; font-weight:700; color:#E8672B;
    }
    .pr-gallery-empty{
      font-size:11px; color:#94a3b8; padding:26px 0;
    }

    @media(max-width:900px){
      .pr-row2{ grid-template-columns:1fr; }
      .pr-gallery{ grid-template-columns:1fr; }
      .pr-gallery-group + .pr-gallery-group{ border-left:0; border-top:1px dashed #e5e7eb; padding-top:10px; }
    }
  </style>

  <div class="proposta">
    <div class="header-proposta">
      <h1>${icon('file-text')} Proposta Comercial</h1>
      <div class="sub">
        Cliente: ${data.cliente?.nome || '-'} &nbsp;·&nbsp; Vendedor: ${data.vendedor?.nome || '-'}
      </div>
    </div>

    <div class="pr-tabs">
      <button class="pr-tab-btn active" data-pr-tab="vendedor">${icon('user')} Vendedor</button>
      <button class="pr-tab-btn" data-pr-tab="cliente">${icon('users')} Cliente</button>
      <button class="pr-tab-btn" data-pr-tab="itens">${icon('box')} Itens</button>
    </div>

    <!-- ABA VENDEDOR -->
    <div class="pr-tab-content active" data-pr-content="vendedor">
      <div class="pr-row2">
        <div class="card1">
          <div class="card-title1">${icon('sun')} RESUMO DO SISTEMA</div>
          <div class="info">
            <div class="kpi">
              <div class="kpi-label">Geração</div>
              <div class="kpi-value">${formatarNumero(r.geracaoExibida || r.geracaoReal, 0)} kWh/mês</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Potência</div>
              <div class="kpi-value">${formatarNumero(r.potenciaKit)} kWp</div>
            </div>
          </div>
          <div class="kpi-descricao">${itensMiniTableHTML}</div>
        </div>

        <div class="card1">
          <div class="card-title1">${icon('wallet')} VALORES FINANCEIROS</div>
          <div class="info">
            <div class="kpi">
              <div class="kpi-label">Valor Fornecedor</div>
              <div class="finance-value">${formatarMoeda(valorFornecedor)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Valor Recomendado</div>
              <div class="finance-value">${formatarMoeda(valorRecomendado)}<span class="tag">+${pImposto.toFixed(0)}%</span></div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Margem</div>
              <div class="finance-value">${formatarMoeda(valorMargem)}<span class="tag">+${pMargem.toFixed(0)}%</span></div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Total Geral</div>
              <div class="finance-value">${formatarMoeda(valorTotalGeral)}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="pr-row2">
      ${galeriaEquipamentosHtml}

      <div class="card1">
        <div class="card-title1">${icon('calculator')} DETALHAMENTO FINANCEIRO</div>
        <div class="detail">
          ${[
            ['Preço do Kit', valorFornecedor],
            ['Preço de Venda', valorTotalGeral],
            ['Custos do Kit %', pImposto.toFixed(0)+'%'],
            ['Valor dos Custos', valorCustos],
            ['Desconto', r.desconto || 0],
            ['Acréscimo', r.acrescimo || 0],
            ['Translado', r.frete || 0],
            ['Comissão %', comissaoPercentual+'%'],
            ['Valor Comissão', valorComissao],
            ['Comis. + Acrésc.', comissaoAcrescimo]
          ]
          .map(function(x) {
            return '<div class="detail-row"><span class="detail-label">' + x[0] + '</span><span class="detail-value">' + (typeof x[1] == 'number' ? formatarMoeda(x[1]) : x[1]) + '</span></div>';
          }).join('')}
        </div>
      </div>
    </div>
    </div>

    <!-- ABA CLIENTE -->
    <div class="pr-tab-content" data-pr-content="cliente">
      <div class="pr-row2">
        <div class="card1">
          <div class="card-title1">${icon('sun')} RESUMO DO SISTEMA</div>
          <div class="info">
            <div class="kpi">
              <div class="kpi-label">Geração</div>
              <div class="kpi-value">${formatarNumero(r.geracaoExibida || r.geracaoReal, 0)} kWh/mês</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Potência</div>
              <div class="kpi-value">${formatarNumero(r.potenciaKit)} kWp</div>
            </div>
          </div>
          <div class="kpi-descricao">${itensMiniTableHTML}</div>
        </div>

        <div class="card1">
          <div class="card-title1">${icon('banknote')} INVESTIMENTO TOTAL</div>
          <div class="pr-investimento">
            <div class="valor">${formatarMoeda(valorTotalGeral)}</div>
            <div class="parcela">ou 12x de ${formatarMoeda(parcela12semJuros)} sem juros</div>
            <div class="pr-condicoes">
              <span>✓ 12x sem juros no crédito</span>
              <span>✓ Sem análise</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card1">
        <div class="card-title1">${icon('landmark')} FINANCEIRO COM BANCOS PARCEIROS</div>
        ${financiamentoTableHTML}
      </div>
    </div>

    <!-- ABA ITENS -->
    <div class="pr-tab-content" data-pr-content="itens">
      <div class="card1" style="margin-bottom:12px">
        <div class="card-title1">${icon('box')} EQUIPAMENTOS</div>
        <div class="kpi" style="margin:12px 16px 0;">
          <strong>Estrutura:</strong>
          <div class="kpi-label">${data.estrutura?.nome || '-'}</div>
        </div>
        <table>
          <thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd</th></tr></thead>
          <tbody>${equipamentosHTML}</tbody>
        </table>
      </div>

      ${materiaisHTML ? `
      <div class="card1">
        <div class="card-title1">${icon('receipt')} MATERIAIS E SERVIÇOS</div>
        <div class="pr-materiais-scroll">
          <table>
            <thead><tr><th>Descrição</th><th>Qtd</th><th>Unidade</th><th>Valor Unit.</th><th>Total</th></tr></thead>
            <tbody>${materiaisHTML}</tbody>
          </table>
        </div>
      </div>
      ` : ''}
    </div>
  </div>
  `;

  openModal({
    id:'propostaModal',
    title:'Resumo da Proposta',
    width:800,
    bodyHtml:html,
    footHtml:`
      <button class="btn btn-primary" id="btnPrintScreen">
        ${icon('printer')} Print Screen
      </button>
    `
  });

  refreshIcons();

  // Alternância de abas
  document.querySelectorAll('#propostaModal [data-pr-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var alvo = btn.getAttribute('data-pr-tab');
      document.querySelectorAll('#propostaModal [data-pr-tab]').forEach(function(b) {
        b.classList.toggle('active', b === btn);
      });
      document.querySelectorAll('#propostaModal [data-pr-content]').forEach(function(c) {
        c.classList.toggle('active', c.getAttribute('data-pr-content') === alvo);
      });
    });
  });

  // Print Screen
  document.getElementById('btnPrintScreen')?.addEventListener('click', function() {
    var content = document.querySelector('#propostaModal .modal-body .proposta');
    if (!content) {
      toast('Conteúdo não encontrado para print', 'warning');
      return;
    }

    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      toast('Seu navegador não suporta copiar imagens para a área de transferência', 'error');
      return;
    }

    var btn = this;
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = icon('loader') + ' Gerando...';
    refreshIcons();

    var blobPromise = html2canvas(content, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    }).then(function(canvas) {
      return new Promise(function(resolve, reject) {
        canvas.toBlob(function(blob) {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao gerar imagem'));
          }
        }, 'image/png');
      });
    });

    navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blobPromise })
    ]).then(function() {
      toast('✅ Print copiado! Use Ctrl+V para colar', 'success');
    }).catch(function(err) {
      console.error('Erro ao copiar print:', err);
      toast('Não foi possível copiar o print. Tente novamente.', 'error');
    }).finally(function() {
      btn.disabled = false;
      btn.innerHTML = original;
      refreshIcons();
    });
  });
}

window.abrirProposta = abrirProposta;

console.log('%c⚡ Solar Pro 2.0 — proposta-resumida.js v1.2 (galeria de equipamentos) carregado', 'color:#ffb020;font-weight:bold');
