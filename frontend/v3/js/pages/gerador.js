// ============================================================
// SOLAR PRO 2.0 — pages/gerador.js
// Gerador automático de kits: combina placas + inversores compatíveis
// por faixa de geração/potência desejada. O valor final é uma
// RECOMENDAÇÃO: sempre que houver orçamentos parecidos no histórico,
// o preço é baseado neles (média de R$/kWp dos mais próximos em
// tamanho); só cai para a fórmula fixa quando não há histórico suficiente.
//
// VERSÃO 4.0 - ATUALIZADA COM:
// 1. Motor e filtros DESACOPLADOS: "Gerar Kits" roda o motor uma vez
//    (cruza TODAS as placas ativas com TODOS os inversores compatíveis,
//    sem restringir por marca/tipo/tensão/fase). Os filtros de marca/
//    tipo/tensão/fase são aplicados em memória, em tempo real, sem
//    precisar rodar o motor de novo a cada mudança de filtro.
// 2. Filtros de marca/tipo agora são multi-seleção (checkbox), não mais
//    dropdown de opção única.
// 3. Dimensionamento por kWh/mês (padrão, como antes) OU por kWp
//    (potência desejada direta) — alternável.
//
// VERSÃO 4.1 - PRECIFICAÇÃO POR MARCA/POTÊNCIA (patch):
// 4. Como não há custo unitário de placa/inversor cadastrado (só o
//    valor final fechado do fornecedor chega até o sistema), a
//    estimativa por histórico deixou de olhar SÓ o tamanho do kit
//    (potência total) e passou a também considerar QUAL placa e QUAL
//    inversor (marca + potência) foram usados nos orçamentos
//    anteriores — já que kits do mesmo tamanho custam diferente
//    dependendo da marca/potência dos equipamentos. A hierarquia:
//      1) Histórico com a MESMA marca+potência de placa E de inversor
//      2) Histórico com a MESMA marca+potência de placa (ignora inversor)
//      3) Fallback antigo: só por tamanho (potência do kit)
//    Isso é 100% orientado a dado (nada é "inventado" por fórmula) —
//    só funciona a partir de orçamentos salvos que já tragam essas
//    informações, o que já acontece hoje via salvarOrcamentoHistorico
//    em pages/orcamento.js (itens_placas_json / itens_inversores_json).
//
// VERSÃO 4.2 - AJUSTE PERCENTUAL FIXO POR MARCA/POTÊNCIA (patch):
// 5. Quando a MARCA bate mas a POTÊNCIA exata não existe no histórico
//    (ex: você tem histórico da marca X com inversor de 8000W, mas está
//    gerando um kit com a marca X e inversor de 6000W ou 10000W), em vez
//    de simplesmente cair pro fallback de "só tamanho do kit" (nível
//    'geral', que ignora completamente a marca), agora existe um nível
//    intermediário 'ajustado': usa o R$/kWp médio dos orçamentos com a
//    MESMA marca de placa E de inversor, mas corrige esse valor por uma
//    taxa fixa e proporcional (não é regressão nem estimativa estatística
//    — é uma regra definida manualmente):
//      • Inversor: 5% de ajuste a cada 1000W de diferença de potência
//        (fracionado — 500W de diferença já ajusta 2,5%)
//      • Placa:    2% de ajuste a cada 10W de diferença de potência
//                  (fracionado — 5W de diferença já ajusta 1%)
//    O ajuste é sempre relativo à amostra histórica de MESMA marca com
//    potência mais próxima da desejada (nunca mistura marcas diferentes).
//    Nova hierarquia completa:
//      1) 'exato'    — mesma placa E mesmo inversor (marca+potência)
//      2) 'ajustado' — mesma marca de placa E de inversor, potência(s)
//                       diferentes, com ajuste percentual fixo aplicado
//      3) 'placa'    — mesma placa exata, ignora o inversor
//      4) 'geral'    — fallback por tamanho do kit
//
// VERSÃO 4.3 - FIX LIMITE DE OVERSIZING (DC/AC RATIO):
// 6. A checagem de compatibilidade kit×inversor comparava a potência do
//    INVERSOR contra 0,5x–1,5x da potência do KIT — invertido. A regra
//    correta é o teto de 1,5x (e piso de 0,5x) ser sobre a potência do
//    INVERSOR: um inversor de 5000W aceita no máximo 7500W de painéis
//    (5000×1,5), nunca 8000W. Corrigido em rodarMotorGerador().
//
// VERSÃO 4.4 - TRAVAS DE SEGURANÇA NA ESTIMATIVA POR HISTÓRICO:
// 7. Detectado que kits de tamanhos próximos (ex: 8000W e 10000W) podiam
//    receber estimativas MUITO desproporcionais entre si (ex: R$21.350
//    vs R$110.800) — causa provável: (a) o ajuste percentual do nível
//    'ajustado' não tinha teto, então uma diferença de potência grande
//    o bastante gerava um ajuste desproporcional; (b) uma média simples
//    é vulnerável a um único orçamento do histórico fora do padrão
//    (preço digitado errado, ou de porte muito diferente) dominando o
//    resultado quando a amostra tem poucos registros. Duas travas:
//      • _dentroDaFaixaDeConfianca(): uma amostra só entra no nível
//        'ajustado' se a diferença de potência (relativa ao maior dos
//        dois valores) não passar de 60% — não extrapola a partir de
//        um equipamento muito diferente da mesma marca.
//      • _ajustePercentPlaca/_ajustePercentInversor agora têm teto de
//        ±40% cada, mesmo dentro da faixa de confiança.
//      • _removerOutliers(): antes de tirar a média (em QUALQUER
//        nível), descarta valores de R$/kWp abaixo de metade ou acima
//        do dobro da mediana da amostra.
// ============================================================

// ---------------------------------------------------------------
// ESTADO DO GERADOR (persiste entre re-renders da mesma visita à página)
// ---------------------------------------------------------------
let _geradorState = {
  dimensionType: 'kwh', // 'kwh' | 'kwp'
  kitsBrutos: [],       // resultado bruto do motor (sem filtro de marca/tipo/tensão/fase)
  placasAtivas: [],
  inversoresAtivos: [],
  historico: [],
  config: null,
};

const TIPO_INV_LABELS = { ONGRID:'On-Grid', HIBRIDO:'Híbrido', MICRO:'Micro', OFFGRID:'Off-Grid' };

async function pageGerador(){
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando catálogo e histórico...</div>`;

  const [placas, inversores, orcamentos, config] = await Promise.all([
    apiGetCached('/equipamentos/placas'),
    apiGetCached('/equipamentos/inversores'),
    apiGetCached('/orcamentos'),
    carregarPropostaConfigMesclada()
  ]);

  Store.set('placas', placas);
  Store.set('inversores', inversores);

  // <--- Só entram no gerador equipamentos marcados como ativos/em estoque
  const placasAtivas = filtrarAtivos(placas);
  const inversoresAtivos = filtrarAtivos(inversores);
  const totalInativos = (placas.length - placasAtivas.length) + (inversores.length - inversoresAtivos.length);

  const historico = Array.isArray(orcamentos) ? orcamentos.filter(o => (+o.potencia_kit > 0) && (+o.valor_final > 0)) : [];

  // <--- PATCH 4.1: pré-parseia os snapshots de equipamentos (marca/potência
  // de cada placa/inversor usado) de cada orçamento do histórico UMA vez só,
  // aqui — em vez de fazer JSON.parse a cada combinação testada pelo motor
  // (que roda centenas/milhares de combinações placa×inversor por geração).
  prepararHistoricoEquipamentos(historico);

  // Reseta o estado (mas mantém o dimensionType escolhido anteriormente nesta sessão)
  _geradorState.kitsBrutos = [];
  _geradorState.placasAtivas = placasAtivas;
  _geradorState.inversoresAtivos = inversoresAtivos;
  _geradorState.historico = historico;
  _geradorState.config = config;

  const marcasPlaca = uniqueValues(placasAtivas, 'marca');
  const tiposPlaca = uniqueValues(placasAtivas, 'tipo');
  const marcasInversor = uniqueValues(inversoresAtivos, 'marca');
  const tiposInversorRaw = uniqueValues(inversoresAtivos, 'tipo');
  const tensoesInversor = uniqueValues(inversoresAtivos, 'tensao');
  const fasesInversor = uniqueValues(inversoresAtivos, 'fase');

  // <--- Status das configurações
  const arred = config?.arredondamento || {};
  const arredStatus = arred.ativado !== false
    ? `✅ Arredondamento ativo (limite: ${arred.limite_kwh || 1500} kWh → placas: ${arred.placa_limiar_ate_1500 || 9}/${arred.placa_limiar_acima_1500 || 15})`
    : `⛔ Arredondamento desativado`;

  const pisos = config?.pisos_lucro || [];
  const pisoStatus = pisos.length > 0
    ? `💰 ${pisos.length} piso(s) de lucro configurado(s)`
    : `💰 Piso padrão: MICRO=R$ 3.500, OUTROS=R$ 4.750`;

  view.innerHTML = `
    <style>
      .dim-toggle-options{ display:flex; gap:8px; }
      .dim-option{
        flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;
        padding:12px 10px; border:1.5px solid var(--border); border-radius:10px;
        cursor:pointer; font-size:12.5px; font-weight:700; color:var(--text-faint);
        background:var(--surface-2); transition:.15s;
      }
      .dim-option:hover{ border-color:var(--amber); }
      .dim-option.selected{ border-color:var(--amber); background:var(--amber-soft); color:var(--amber); }
      .dim-option svg{ width:18px; height:18px; }

      .filtros-live-bar{ display:flex; flex-wrap:wrap; gap:10px; align-items:flex-start; }
      .filtro-multi{ position:relative; min-width:190px; }
      .filtro-multi-trigger{
        display:flex; align-items:center; gap:8px; padding:10px 12px; border:1.5px dashed var(--border);
        border-radius:9px; cursor:pointer; background:var(--surface-2); font-size:12.5px; user-select:none;
      }
      .filtro-multi-trigger:hover{ border-color:var(--amber); }
      .filtro-multi.has-selection .filtro-multi-trigger{ border-style:solid; border-color:var(--amber); background:var(--amber-soft); }
      .filtro-multi-label{ font-weight:700; color:var(--text); }
      .filtro-multi-summary{ color:var(--text-faint); margin-left:auto; font-size:11.5px; }
      .filtro-multi.has-selection .filtro-multi-summary{ color:var(--amber); font-weight:700; }
      .filtro-multi-chevron svg{ width:14px; height:14px; transition:transform .15s; }
      .filtro-multi.open .filtro-multi-chevron svg{ transform:rotate(180deg); }
      .filtro-multi-panel{
        display:none; position:absolute; top:calc(100% + 6px); left:0; z-index:50; min-width:240px; max-width:300px;
        max-height:340px; overflow-y:auto; background:var(--surface); border:1px solid var(--border);
        border-radius:10px; box-shadow:var(--shadow-md,0 8px 24px rgba(0,0,0,.35)); padding:10px;
      }
      .filtro-multi.open .filtro-multi-panel{ display:block; }
      .filtro-multi-group{ margin-bottom:8px; }
      .filtro-multi-group:last-of-type{ margin-bottom:0; }
      .filtro-multi-group-title{ font-size:10.5px; font-weight:800; text-transform:uppercase; color:var(--text-faint); margin-bottom:4px; padding:0 4px; }
      .filtro-multi-item{ display:flex; align-items:center; gap:8px; padding:6px 4px; border-radius:6px; cursor:pointer; font-size:12.5px; }
      .filtro-multi-item:hover{ background:var(--surface-2); }
      .filtro-multi-item input{ width:15px; height:15px; accent-color:var(--amber); cursor:pointer; }
      .filtro-multi-empty{ font-size:11.5px; color:var(--text-faint); padding:4px; }
      .filtro-multi-actions{ margin-top:8px; padding-top:8px; border-top:1px solid var(--border-soft); text-align:right; }
      .kits-live-count{ font-size:11.5px; color:var(--text-faint); }
    </style>

    <div class="view-head">
      <div><h1>Gerador de Kits</h1><p>Informe a geração/potência desejada — depois filtre os resultados livremente, sem precisar gerar de novo</p></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="ico">${icon('sparkles')}</div>
        <div><h3>Parâmetros de dimensionamento</h3><div class="sub">O motor cruza todas as placas com todos os inversores compatíveis</div></div>
      </div>

      <div class="form-flex">
        <div class="field" style="grid-column:span 2">
          <label>Tipo de dimensionamento</label>
          <div class="dim-toggle-options">
            <div class="dim-option ${_geradorState.dimensionType === 'kwh' ? 'selected' : ''}" data-dim="kwh">
              ${icon('bar-chart-3')} <span>kWh/mês (geração)</span>
            </div>
            <div class="dim-option ${_geradorState.dimensionType === 'kwp' ? 'selected' : ''}" data-dim="kwp">
              ${icon('zap')} <span>kWp (potência do sistema)</span>
            </div>
          </div>
        </div>
        <div class="field">
          <label id="gValorLabel">${_geradorState.dimensionType === 'kwp' ? 'Potência desejada (kWp)' : 'Geração desejada (kWh/mês)'}</label>
          <input class="input" id="gValor" type="number" step="any" placeholder="${_geradorState.dimensionType === 'kwp' ? 'Ex: 5.5' : 'Ex: 500'}">
        </div>
        <div class="field" style="display:flex;align-items:flex-end">
          <button class="btn btn-primary btn-block" id="btnGerar">${icon('sparkles')} Gerar Kits</button>
        </div>
      </div>

      <div style="margin-top:12px;padding:10px 14px;background:var(--surface-2);border-radius:6px;border:1px solid var(--border);font-size:11.5px;color:var(--text-faint);display:flex;flex-wrap:wrap;gap:12px;">
        ${_geradorState.dimensionType === 'kwh' ? `<span>${arredStatus}</span>` : ''}
        <span>${pisoStatus}</span>
        ${historico.length > 0 ? `<span>📊 ${historico.length} orçamento(s) no histórico</span>` : ''}
        ${totalInativos > 0 ? `<span>🚫 ${totalInativos} equipamento(s) inativo(s) ocultado(s)</span>` : ''}
      </div>
    </div>

    <div class="card" id="cardFiltrosLive" style="display:none">
      <div class="card-head">
        <div class="ico">${icon('list-filter')}</div>
        <div class="grow"><h3>Filtrar resultados</h3><div class="sub">Aplicado em tempo real — não precisa gerar de novo</div></div>
        <button class="btn btn-ghost btn-sm" id="btnLimparFiltrosLive">${icon('x')} Limpar filtros</button>
      </div>
      <div class="filtros-live-bar">
        ${renderFiltroMultiSelect('filtroPlacas', 'Placas', [
          { key:'marcaPlaca', titulo:'Marca', opcoes: marcasPlaca.map(m => ({ value:m, label:m })) },
          { key:'tipoPlaca', titulo:'Tipo', opcoes: tiposPlaca.map(t => ({ value:t, label:t })) },
        ])}
        ${renderFiltroMultiSelect('filtroInversores', 'Inversores', [
          { key:'marcaInversor', titulo:'Marca', opcoes: marcasInversor.map(m => ({ value:m, label:m })) },
          { key:'tipoInversor', titulo:'Tipo', opcoes: tiposInversorRaw.map(t => ({ value:t, label: TIPO_INV_LABELS[String(t).toUpperCase()] || t })) },
          { key:'tensaoInversor', titulo:'Tensão', opcoes: tensoesInversor.map(t => ({ value:t, label:`${t}V` })) },
          { key:'faseInversor', titulo:'Fase', opcoes: fasesInversor.map(f => ({ value:f, label:f })) },
        ])}
      </div>
    </div>

    <div id="kitsResult"></div>
  `;
  refreshIcons();

  // --- Toggle kWh/kWp ---
  view.querySelectorAll('[data-dim]').forEach(el => {
    el.addEventListener('click', () => {
      _geradorState.dimensionType = el.getAttribute('data-dim');
      view.querySelectorAll('[data-dim]').forEach(o => o.classList.toggle('selected', o === el));
      const isKwp = _geradorState.dimensionType === 'kwp';
      document.getElementById('gValorLabel').textContent = isKwp ? 'Potência desejada (kWp)' : 'Geração desejada (kWh/mês)';
      document.getElementById('gValor').placeholder = isKwp ? 'Ex: 5.5' : 'Ex: 500';
    });
  });

  wireFiltroMultiSelect('filtroPlacas', aplicarFiltrosERenderizar);
  wireFiltroMultiSelect('filtroInversores', aplicarFiltrosERenderizar);

  document.getElementById('btnLimparFiltrosLive').addEventListener('click', () => {
    ['filtroPlacas','filtroInversores'].forEach(id => {
      const root = document.getElementById(id);
      root.querySelectorAll('input[type=checkbox]:checked').forEach(c => c.checked = false);
      root.classList.remove('has-selection');
      root.querySelector('[data-summary]').textContent = 'Todos';
    });
    aplicarFiltrosERenderizar();
  });

  document.getElementById('btnGerar').addEventListener('click', () => rodarMotorGerador());

  bindFechamentoGlobalFiltroMultiSelect();
}
window.pageGerador = pageGerador;

// ============================================================
// COMPONENTE: MULTI-SELECT (checkboxes agrupados, tempo real)
// ============================================================
function renderFiltroMultiSelect(id, titulo, grupos){
  return `
    <div class="filtro-multi" id="${id}">
      <div class="filtro-multi-trigger" data-trigger>
        <span class="filtro-multi-label">${titulo}</span>
        <span class="filtro-multi-summary" data-summary>Todos</span>
        <span class="filtro-multi-chevron">${icon('chevron-down')}</span>
      </div>
      <div class="filtro-multi-panel" data-panel>
        ${grupos.map(g => `
          <div class="filtro-multi-group">
            <div class="filtro-multi-group-title">${g.titulo}</div>
            ${g.opcoes.length === 0
              ? `<div class="filtro-multi-empty">Nenhuma opção cadastrada</div>`
              : g.opcoes.map(op => `
                <label class="filtro-multi-item">
                  <input type="checkbox" data-grupo="${g.key}" value="${String(op.value).replace(/"/g,'&quot;')}">
                  <span>${op.label}</span>
                </label>
              `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function wireFiltroMultiSelect(id, onChange){
  const root = document.getElementById(id);
  if(!root) return;
  const trigger = root.querySelector('[data-trigger]');
  const summary = root.querySelector('[data-summary]');

  function updateSummary(){
    const totalSelecionado = root.querySelectorAll('input[type=checkbox]:checked').length;
    summary.textContent = totalSelecionado > 0 ? `${totalSelecionado} selecionado(s)` : 'Todos';
    root.classList.toggle('has-selection', totalSelecionado > 0);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = !root.classList.contains('open');
    document.querySelectorAll('.filtro-multi.open').forEach(o => o.classList.remove('open'));
    if(abrir) root.classList.add('open');
  });

  root.querySelectorAll('input[type=checkbox]').forEach(chk => {
    chk.addEventListener('change', () => {
      updateSummary();
      onChange();
    });
  });

  updateSummary();
}

function bindFechamentoGlobalFiltroMultiSelect(){
  if(window.__filtroMultiGlobalClickBound) return;
  window.__filtroMultiGlobalClickBound = true;
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.filtro-multi.open').forEach(root => {
      if(!root.contains(e.target)) root.classList.remove('open');
    });
  });
}

function getFiltroSelecionados(id, grupoKey){
  const root = document.getElementById(id);
  if(!root) return [];
  return Array.from(root.querySelectorAll(`input[data-grupo="${grupoKey}"]:checked`)).map(c => c.value);
}

// ============================================================
// PRECIFICAÇÃO POR HISTÓRICO
// ============================================================
// PATCH 4.1 — Antes, a estimativa olhava só `potencia_kit` (o tamanho
// físico do kit), então dois kits do mesmo tamanho com placas/inversores
// de marcas totalmente diferentes recebiam o MESMO valor recomendado —
// o que não reflete a realidade, já que cada marca/potência tem seu
// próprio preço de fornecedor. Como não existe custo unitário cadastrado
// (só chega até o sistema o valor final fechado do kit), a única fonte de
// verdade disponível é o próprio histórico de orçamentos já salvos — que
// já guarda, por item, marca/modelo/tipo/potência (ver itens_placas_json /
// itens_inversores_json em pages/orcamento.js → salvarOrcamentoHistorico).
//
// PATCH 4.2 — Quando a marca bate mas a potência exata não está no
// histórico, em vez de descartar a diferença (nível 'placa', que ignora
// o inversor) ou cair direto pro fallback genérico (nível 'geral', que
// ignora a marca inteira), existe agora o nível 'ajustado': usa a MESMA
// marca de placa e de inversor, corrigindo o R$/kWp da amostra por uma
// taxa fixa e proporcional (2%/10W placa, 5%/1000W inversor — ver
// _ajustePercentPlaca / _ajustePercentInversor abaixo).
//
// A estimativa agora tenta, nessa ordem, e usa a primeira que tiver
// pelo menos 1 amostra:
//   1) 'exato'    — histórico com a MESMA marca+potência de placa
//                   E a MESMA marca+potência de inversor
//   2) 'ajustado' — histórico com a MESMA marca de placa E de inversor,
//                   mas com potência(s) diferente(s) — ajuste percentual
//                   fixo aplicado sobre o R$/kWp da amostra
//   3) 'placa'    — histórico com a MESMA marca+potência de placa
//                   (ignora o inversor usado)
//   4) 'geral'    — fallback antigo: só por tamanho do kit (potência),
//                   sem olhar marca de nada — última opção, quando não
//                   há nenhum histórico com essa placa específica.
//
// Cada nível usa até 5 amostras mais próximas em TAMANHO (dist), pra que
// dentro do mesmo nível de match ainda se priorize kits de porte parecido.

// Tolerância pra considerar duas potências "a mesma" (linhas de produto
// às vezes têm variações de wattagem entre lotes/anos do mesmo modelo).
const HIST_TOLERANCIA_POTENCIA = 0.03; // 3%

// Taxas de ajuste — DEFINIDAS MANUALMENTE pelo usuário, não são
// calculadas nem estimadas estatisticamente. Aplicadas apenas ENTRE
// potências de uma MESMA marca (nunca comparando marcas diferentes).
// Fracionável: uma diferença de 500W de inversor já ajusta 2,5%, não
// precisa completar os 1000W inteiros pra "destravar" o ajuste.
const AJUSTE_PCT_POR_1000W_INVERSOR = 5; // 5% a cada 1000W de diferença
const AJUSTE_PCT_POR_10W_PLACA = 2;      // 2% a cada 10W de diferença

// PATCH 4.4 — Travas de segurança pro ajuste percentual. Extrapolar um
// preço a partir de uma diferença de potência MUITO grande (ex: comparar
// um inversor de 3000W com um de 10000W da mesma marca) produz um ajuste
// desproporcional e deixa de ser confiável — é extrapolação linear fora
// da faixa observada, não interpolação dentro dela. Duas travas:
//   (a) cada ajuste individual (placa/inversor) tem um teto/piso — nunca
//       passa de ±40%, mesmo que a diferença de potência seja gigante;
//   (b) uma amostra só entra no nível 'ajustado' se a diferença de
//       potência (relativa ao equipamento desejado) não passar de 60% —
//       acima disso ela é descartada, não é usada pra "inventar" preço
//       a partir de um equipamento fisicamente muito diferente.
const AJUSTE_PCT_TETO_PLACA = 40;
const AJUSTE_PCT_TETO_INVERSOR = 40;
const AJUSTE_DIST_MAX_RELATIVA = 0.6;

function _normMarcaHist(m){
  return String(m || '').trim().toLowerCase();
}

function _potenciaBateHist(a, b){
  a = +a || 0; b = +b || 0;
  if(a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= HIST_TOLERANCIA_POTENCIA;
}

// Pré-parseia (uma única vez, em pageGerador) os snapshots de equipamento
// de cada orçamento do histórico, guardando o resultado em campos privados
// (_placasSnap / _inversoresSnap) no próprio objeto do histórico — evita
// refazer JSON.parse a cada combinação placa×inversor testada pelo motor.
function prepararHistoricoEquipamentos(historico){
  (historico || []).forEach(o => {
    if(o._placasSnap && o._inversoresSnap) return; // já preparado
    try{ o._placasSnap = JSON.parse(o.itens_placas_json || '[]'); }
    catch(e){ o._placasSnap = []; }
    try{ o._inversoresSnap = JSON.parse(o.itens_inversores_json || '[]'); }
    catch(e){ o._inversoresSnap = []; }
  });
  return historico;
}

// Verifica se um orçamento do histórico usou uma placa/inversor com a
// mesma marca+potência do equipamento informado (compara contra TODOS
// os itens daquele tipo salvos no orçamento, já que um orçamento pode
// ter mais de uma placa/inversor diferente).
function _historicoUsouEquipamento(snapArray, marca, potencia){
  if(!marca || !potencia) return false;
  return (snapArray || []).some(eq => _normMarcaHist(eq.marca) === _normMarcaHist(marca) && _potenciaBateHist(eq.potencia, potencia));
}

// PATCH 4.2 — Dentro dos itens de um orçamento do histórico, procura o
// item da MESMA marca (independente da potência bater ou não) com a
// potência mais PRÓXIMA da desejada. É essa a referência usada pro
// ajuste percentual — evita comparar contra o item errado quando um
// orçamento tem mais de uma placa/inversor da mesma marca cadastrados.
function _itemMesmaMarcaMaisProximo(snapArray, marcaAlvo, potenciaAlvo){
  if(!marcaAlvo) return null;
  const mesmaMarca = (snapArray || []).filter(eq => _normMarcaHist(eq.marca) === _normMarcaHist(marcaAlvo));
  if(!mesmaMarca.length) return null;
  mesmaMarca.sort((a,b) => Math.abs((+a.potencia||0) - potenciaAlvo) - Math.abs((+b.potencia||0) - potenciaAlvo));
  return mesmaMarca[0];
}

// PATCH 4.4 — Só confia na extrapolação de preço se a diferença de
// potência (relativa ao maior dos dois valores) não passar de
// AJUSTE_DIST_MAX_RELATIVA. Acima disso, a amostra é descartada do nível
// 'ajustado' — comparar um equipamento MUITO diferente da mesma marca
// não é uma extrapolação confiável, é um chute.
function _dentroDaFaixaDeConfianca(potenciaAlvo, potenciaHist){
  const alvo = +potenciaAlvo || 0, hist = +potenciaHist || 0;
  if(!alvo || !hist) return false;
  return Math.abs(alvo - hist) / Math.max(alvo, hist) <= AJUSTE_DIST_MAX_RELATIVA;
}

// Ajuste percentual (pode ser negativo) pela diferença de potência da
// PLACA, dentro da mesma marca: 2% a cada 10W, fracionado, com teto de
// ±40% (PATCH 4.4) pra nunca extrapolar um valor absurdo.
function _ajustePercentPlaca(potenciaAlvo, potenciaHist){
  const alvo = +potenciaAlvo || 0, hist = +potenciaHist || 0;
  if(!alvo || !hist) return 0;
  const diff = alvo - hist; // positivo = alvo é maior que o do histórico
  const pct = (diff / 10) * AJUSTE_PCT_POR_10W_PLACA;
  return Math.max(-AJUSTE_PCT_TETO_PLACA, Math.min(AJUSTE_PCT_TETO_PLACA, pct));
}

// Ajuste percentual (pode ser negativo) pela diferença de potência do
// INVERSOR, dentro da mesma marca: 5% a cada 1000W, fracionado, com teto
// de ±40% (PATCH 4.4).
function _ajustePercentInversor(potenciaAlvo, potenciaHist){
  const alvo = +potenciaAlvo || 0, hist = +potenciaHist || 0;
  if(!alvo || !hist) return 0;
  const diff = alvo - hist;
  const pct = (diff / 1000) * AJUSTE_PCT_POR_1000W_INVERSOR;
  return Math.max(-AJUSTE_PCT_TETO_INVERSOR, Math.min(AJUSTE_PCT_TETO_INVERSOR, pct));
}

// PATCH 4.4 — Mediana + remoção de outliers: descarta valores de R$/kWp
// abaixo de metade ou acima do dobro da mediana da amostra ANTES de
// tirar a média. Um único orçamento histórico com preço muito fora do
// padrão (digitado errado, ou de porte muito diferente) deixa de
// distorcer sozinho a estimativa — é isso que provavelmente explicava
// um "8000W" e um "10000W" darem valores desproporcionais entre si.
function _medianaDe(numeros){
  const s = numeros.slice().sort((a,b) => a-b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio-1] + s[meio]) / 2;
}

function _removerOutliers(valores){
  if(valores.length < 3) return valores; // amostra pequena demais pra filtrar com segurança
  const mediana = _medianaDe(valores);
  if(mediana <= 0) return valores;
  const filtrados = valores.filter(v => v >= mediana * 0.5 && v <= mediana * 2);
  return filtrados.length ? filtrados : valores; // nunca fica sem nenhuma amostra
}

function _mediaRsPorKwp(amostra, potenciaKit){
  const brutos = amostra.map(o => o.rsPorKwp);
  const limpos = _removerOutliers(brutos);
  const media = limpos.reduce((acc,v) => acc + v, 0) / limpos.length;
  return {
    valor: Math.round((media * potenciaKit) / 50) * 50,
    amostras: limpos.length,
    rsPorKwp: media
  };
}

// PATCH 4.2/4.4 — Mesmo cálculo de _mediaRsPorKwp, mas corrigindo o
// R$/kWp de CADA amostra pela diferença de potência (placa e inversor)
// antes de tirar a média, usando a taxa fixa definida pelo usuário (já
// com teto de ±40% cada, ver _ajustePercentPlaca/_ajustePercentInversor).
// Um piso de 10% do valor original evita que o fator caia a zero ou
// negativo. Depois de ajustar, ainda passa pela remoção de outliers —
// duas camadas de proteção contra um valor esquisito dominar a média.
function _mediaRsPorKwpAjustado(amostra, potenciaKit, placa, inversor){
  const valoresAjustados = amostra.map(o => {
    const ajustePlacaPct = _ajustePercentPlaca(placa.potencia, o.placaMesmaMarca?.potencia);
    const ajusteInvPct = _ajustePercentInversor(inversor.potencia, o.inversorMesmaMarca?.potencia);
    const fator = Math.max(0.1, 1 + (ajustePlacaPct + ajusteInvPct) / 100);
    return o.rsPorKwp * fator;
  });
  const limpos = _removerOutliers(valoresAjustados);
  const media = limpos.reduce((a,b) => a+b, 0) / limpos.length;
  return {
    valor: Math.round((media * potenciaKit) / 50) * 50,
    amostras: limpos.length,
    rsPorKwp: media
  };
}

function estimarValorPorHistorico(historico, potenciaKit, placa, inversor){
  if(!historico.length || potenciaKit <= 0) return null;

  const comDados = historico.map(o => ({
    o,
    rsPorKwp: (+o.valor_final) / (+o.potencia_kit),
    dist: Math.abs((+o.potencia_kit) - potenciaKit) / potenciaKit,
    mesmaPlaca: placa ? _historicoUsouEquipamento(o._placasSnap, placa.marca, placa.potencia) : false,
    mesmoInversor: inversor ? _historicoUsouEquipamento(o._inversoresSnap, inversor.marca, inversor.potencia) : false,
    // PATCH 4.2: item de mesma marca (potência mais próxima), usado só
    // quando cair no nível 'ajustado' abaixo.
    placaMesmaMarca: placa ? _itemMesmaMarcaMaisProximo(o._placasSnap, placa.marca, placa.potencia) : null,
    inversorMesmaMarca: inversor ? _itemMesmaMarcaMaisProximo(o._inversoresSnap, inversor.marca, inversor.potencia) : null,
  }));

  // 1) Match exato: mesma placa E mesmo inversor (marca+potência)
  const matchExato = comDados.filter(o => o.mesmaPlaca && o.mesmoInversor);
  if(matchExato.length){
    matchExato.sort((a,b) => a.dist - b.dist);
    return { ..._mediaRsPorKwp(matchExato.slice(0,5), potenciaKit), nivel:'exato' };
  }

  // 2) Match ajustado: mesma MARCA de placa E de inversor, potência(s)
  //    diferentes — aplica o ajuste percentual fixo (ver PATCH 4.2), mas
  //    só se a diferença de potência estiver dentro da faixa de confiança
  //    (PATCH 4.4) — não extrapola a partir de um equipamento muito
  //    diferente da mesma marca.
  const matchAjustado = comDados.filter(o =>
    o.placaMesmaMarca && o.inversorMesmaMarca &&
    _dentroDaFaixaDeConfianca(placa.potencia, o.placaMesmaMarca.potencia) &&
    _dentroDaFaixaDeConfianca(inversor.potencia, o.inversorMesmaMarca.potencia)
  );
  if(matchAjustado.length){
    matchAjustado.sort((a,b) => a.dist - b.dist);
    return { ..._mediaRsPorKwpAjustado(matchAjustado.slice(0,5), potenciaKit, placa, inversor), nivel:'ajustado' };
  }

  // 3) Match por placa: mesma placa exata, ignora o inversor
  const matchPlaca = comDados.filter(o => o.mesmaPlaca);
  if(matchPlaca.length){
    matchPlaca.sort((a,b) => a.dist - b.dist);
    return { ..._mediaRsPorKwp(matchPlaca.slice(0,5), potenciaKit), nivel:'placa' };
  }

  // 4) Fallback: comportamento antigo — só por tamanho do kit
  const proximos = comDados.filter(o => o.dist <= 0.6).sort((a,b) => a.dist - b.dist);
  const amostra = (proximos.length ? proximos : comDados.slice().sort((a,b) => a.dist - b.dist)).slice(0, 5);
  if(!amostra.length) return null;
  return { ..._mediaRsPorKwp(amostra, potenciaKit), nivel:'geral' };
}

// Texto exibido no card do kit, explicando de onde veio o valor —
// importante pro vendedor entender o nível de confiança da estimativa.
function _labelFonteValorKit(k){
  if(k.fonte !== 'historico'){
    return `${icon('calculator','style="width:10px;height:10px;vertical-align:-1px"')} estimativa por fórmula (sem histórico)`;
  }
  const rotulos = {
    exato: 'mesma placa e inversor no histórico',
    ajustado: 'mesma marca de placa/inversor, ajustado pela diferença de potência',
    placa: 'mesma placa no histórico (inversor variou)',
    geral: 'orçamentos de tamanho semelhante (sem essa placa no histórico)',
  };
  const rotulo = rotulos[k.nivel] || 'orçamentos similares';
  return `${icon('bar-chart-3','style="width:10px;height:10px;vertical-align:-1px"')} baseado em ${k.amostras} orçamento(s) — ${rotulo}`;
}

// ============================================================
// QUANTIDADE DE PLACAS PARA DIMENSIONAMENTO POR kWp
// (o alvo é a potência do kit, não a geração mensal)
// ============================================================
function qtdPlacasPorPotencia(potenciaDesejadaKwp, potenciaPlacaW){
  if(!potenciaPlacaW || potenciaPlacaW <= 0 || potenciaDesejadaKwp <= 0) return 0;
  return Math.max(1, Math.round((potenciaDesejadaKwp * 1000) / potenciaPlacaW));
}

// ============================================================
// MOTOR: cruza TODAS as placas ativas com TODOS os inversores
// compatíveis — sem aplicar filtro de marca/tipo/tensão/fase (isso é
// feito depois, em memória, por aplicarFiltrosERenderizar).
// ============================================================
function rodarMotorGerador(){
  const valorDesejado = parseFloat(document.getElementById('gValor').value) || 0;
  const isKwp = _geradorState.dimensionType === 'kwp';
  const { placasAtivas: placas, inversoresAtivos: inversores, historico, config } = _geradorState;

  if(valorDesejado <= 0){
    toast(isKwp ? 'Informe a potência desejada em kWp' : 'Informe a geração desejada em kWh/mês', 'warning');
    return;
  }
  if(placas.length === 0 || inversores.length === 0){
    toast('Cadastre ao menos uma placa e um inversor', 'error');
    return;
  }

  const percentualGeracao = (config?.margem_perca || 100) / 100;
  const margemInput = (config?.margem_padrao || 4) / 100;

  const kits = [];
  let totalEconomizado = 0;

  placas.forEach(placa => {
    const fator = Calc.fatorGeracao(placa, percentualGeracao);
    if(fator <= 0) return;

    let qtdPlacas, economizado = 0;

    if(isKwp){
      qtdPlacas = qtdPlacasPorPotencia(valorDesejado, placa.potencia);
    }else{
      const valorArredon = Calc.valorArredonAutomatico(valorDesejado, config);
      qtdPlacas = Calc.qtdModulos(valorDesejado, fator, valorArredon);
      const qtdSemArredon = Math.ceil(valorDesejado / fator);
      economizado = Math.max(0, qtdSemArredon - qtdPlacas);
      if(economizado > 0) totalEconomizado += economizado;
    }
    if(qtdPlacas <= 0) return;

    const potenciaKit = Calc.potenciaKit(placa, qtdPlacas);

    inversores.forEach(inversor => {
      if(!Calc.compativel(placa, inversor)) return;

      const qtdInversores = Calc.qtdInversores(qtdPlacas, inversor.tipo);
      if(qtdInversores <= 0) return;

      const potenciaInvKw = (inversor.potencia || 0) / 1000;
      const potenciaTotalInversores = potenciaInvKw * qtdInversores;

      // 🔴 FIX: o limite de oversizing (DC/AC ratio) é sobre a potência do
      // INVERSOR, não do kit. Antes a fórmula checava se o inversor estava
      // entre 0,5x e 1,5x do kit — isso permitia, por exemplo, um inversor
      // de 5000W (5kW) casar com um kit de 8kWp, porque 5kW cai dentro de
      // 0,5x–1,5x de 8kWp (4kW–12kW). Mas a regra real é o contrário: um
      // inversor de 5000W só aceita até 5000×1,5 = 7500W de painéis, nunca
      // 8000W. Agora o teto/piso são calculados em cima do inversor.
      const kitMaximoParaInversor = potenciaTotalInversores * 1.5;
      const kitMinimoParaInversor = potenciaTotalInversores * 0.5;
      if(potenciaKit > kitMaximoParaInversor || potenciaKit < kitMinimoParaInversor) return;

      const geracaoReal = Calc.geracaoPorPlacas(qtdPlacas, fator);
      const valorFornecTotal = Calc.valorAproximado(placa, inversor, qtdPlacas, qtdInversores);

      // <--- PATCH 4.1/4.2: agora passa a placa e o inversor sendo
      // testados, pra estimativa priorizar histórico com essa marca
      // exata (4.1) e, se a potência exata não existir, aplicar o
      // ajuste percentual fixo por marca (4.2), em vez de ignorar a
      // diferença ou cair direto pro fallback genérico por tamanho.
      const estHistorico = estimarValorPorHistorico(historico, potenciaKit, placa, inversor);
      let valorFinal, fonte, amostras, nivel;

      if(estHistorico){
        valorFinal = estHistorico.valor;
        fonte = 'historico';
        amostras = estHistorico.amostras;
        nivel = estHistorico.nivel;
      }else{
        const reajuste = config?.reajuste_padrao || 150;
        const imposto = Calc.ajustarPercentualImposto(valorFornecTotal, margemInput, reajuste, placa, inversor, config);
        valorFinal = Calc.valorFinal(valorFornecTotal, imposto, margemInput, reajuste, 0, 0, 0);
        fonte = 'formula';
        amostras = 0;
        nivel = null;
      }
      const custoWp = valorFinal / (potenciaKit * 1000);

      kits.push({
        placa, inversor, qtdPlacas, qtdInversores, potenciaKit, geracaoReal,
        valorFinal, custoWp, fonte, amostras, nivel, economizado,
        valorDesejado, dimensionType: _geradorState.dimensionType,
      });
    });
  });

  _geradorState.kitsBrutos = kits;
  _geradorState.totalEconomizado = totalEconomizado;

  if(kits.length === 0){
    document.getElementById('cardFiltrosLive').style.display = 'none';
    document.getElementById('kitsResult').innerHTML = `<div class="empty-state">${icon('search-x')}<p>Nenhuma combinação compatível encontrada para esse valor. Tente ajustar o número.</p></div>`;
    refreshIcons();
    return;
  }

  document.getElementById('cardFiltrosLive').style.display = 'block';
  aplicarFiltrosERenderizar();
}

// ============================================================
// FILTRAGEM EM MEMÓRIA + RENDERIZAÇÃO (não recalcula nada do motor)
// ============================================================
function aplicarFiltrosERenderizar(){
  const resultEl = document.getElementById('kitsResult');
  if(!resultEl) return;

  const brutos = _geradorState.kitsBrutos;
  if(!brutos.length){
    resultEl.innerHTML = '';
    return;
  }

  const marcasPlaca = getFiltroSelecionados('filtroPlacas', 'marcaPlaca');
  const tiposPlaca = getFiltroSelecionados('filtroPlacas', 'tipoPlaca');
  const marcasInversor = getFiltroSelecionados('filtroInversores', 'marcaInversor');
  const tiposInversor = getFiltroSelecionados('filtroInversores', 'tipoInversor');
  const tensoesInversor = getFiltroSelecionados('filtroInversores', 'tensaoInversor');
  const fasesInversor = getFiltroSelecionados('filtroInversores', 'faseInversor');

  const bate = (selecionados, valor) => selecionados.length === 0 || selecionados.includes(String(valor));

  const filtrados = brutos.filter(k =>
    bate(marcasPlaca, k.placa.marca) &&
    bate(tiposPlaca, k.placa.tipo) &&
    bate(marcasInversor, k.inversor.marca) &&
    bate(tiposInversor, k.inversor.tipo) &&
    bate(tensoesInversor, k.inversor.tensao) &&
    bate(fasesInversor, k.inversor.fase)
  );

  if(filtrados.length === 0){
    resultEl.innerHTML = `<div class="empty-state">${icon('search-x')}<p>Nenhum kit gerado corresponde aos filtros selecionados. Tente remover algum filtro.</p></div>`;
    refreshIcons();
    return;
  }

  filtrados.sort((a,b) => a.custoWp - b.custoWp);
  const melhores = filtrados.slice(0, 24);
  const bestIdx = 0;

  const totalEconomizado = _geradorState.totalEconomizado || 0;
  const econMsg = totalEconomizado > 0
    ? `<br><span style="color:var(--green);font-weight:600;">💡 ${totalEconomizado} placa(s) economizada(s) pelo arredondamento!</span>`
    : '';

  const config = _geradorState.config;
  const percentualGeracao = (config?.margem_perca || 100) / 100;
  const margemInput = (config?.margem_padrao || 4) / 100;
  const arred = config?.arredondamento || {};
  const arredInfo = _geradorState.dimensionType === 'kwh'
    ? (arred.ativado !== false
        ? `Arredondamento: limite ${arred.limite_kwh || 1500} kWh → ${arred.placa_limiar_ate_1500 || 9}/${arred.placa_limiar_acima_1500 || 15}`
        : 'Arredondamento desativado')
    : 'Dimensionado por potência (kWp)';

  resultEl.innerHTML = `
    <div class="view-head" style="margin-top:26px;margin-bottom:14px">
      <div>
        <h1 style="font-size:18px">${melhores.length} kit(s) exibidos <span class="kits-live-count">de ${filtrados.length} encontrado(s) · ${brutos.length} gerado(s) no total</span></h1>
        <p>
          Ordenados pelo melhor custo por Wp instalado · valores são recomendações, ajustáveis no orçamento
          ${econMsg}
          <br><span style="font-size:11px;color:var(--text-faint);">${arredInfo} · ${(percentualGeracao * 100).toFixed(0)}% de geração · ${(margemInput * 100).toFixed(1)}% de margem</span>
        </p>
      </div>
    </div>
    <div class="grid grid-3">
      ${melhores.map((k, i) => `
        <div class="kit-card ${i===bestIdx?'best':''}" data-kit-idx="${i}">
          <div class="kit-top">
            <div>
              <div class="kit-power">${formatarNumero(k.potenciaKit,2)} kWp</div>
              <div class="kit-gen">${formatarNumero(k.geracaoReal,0)} kWh/mês estimados</div>
              ${k.economizado > 0 ? `<div class="kit-gen" style="color:var(--green);">💡 ${k.economizado} placa(s) economizada(s)</div>` : ''}
            </div>
            <div class="badge badge-amber">${formatarNumero(k.custoWp,2)} R$/Wp</div>
          </div>
          <div class="kit-comp">
            <div class="item">
              <div class="ico">${k.placa.imagem_url ? `<img src="${k.placa.imagem_url}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span style="display:none">${icon('grid-3x2')}</span>` : icon('grid-3x2')}</div>
              <div class="t">${k.qtdPlacas}× ${k.placa.marca}</div>
              <div class="s">${k.placa.potencia}W ${k.placa.tipo||''}</div>
            </div>
            <div class="item">
              <div class="ico">${k.inversor.imagem_url ? `<img src="${k.inversor.imagem_url}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span style="display:none">${icon('zap')}</span>` : icon('zap')}</div>
              <div class="t">${k.qtdInversores}× ${k.inversor.marca}</div>
              <div class="s">${k.inversor.tipo} ${k.inversor.potencia}W</div>
            </div>
          </div>
          <div class="kit-bottom">
            <div>
              <span class="kit-price">${formatarMoeda(k.valorFinal)}</span>
              <span class="kit-price-wp">${_labelFonteValorKit(k)}</span>
            </div>
            <button class="btn btn-secondary btn-sm" data-use-kit="${i}">Usar no orçamento ${icon('arrow-right')}</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  refreshIcons();

  resultEl.querySelectorAll('[data-use-kit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +btn.getAttribute('data-use-kit');
      const k = melhores[idx];
      OS.itensPlaca = [{ id:_uid(), placa:k.placa, qtd:k.qtdPlacas }];
      OS.itensInversor = [{ id:_uid(), inversor:k.inversor, qtd:k.qtdInversores }];
      OS.itensBateria = [];
      OS.itensMateriais = [];
      OS.cliente = null;
      OS.prefill = {
        geracao: k.geracaoReal,
        valorSugerido: k.valorFinal,
        fonte: k.fonte,
        percentualGeracao: percentualGeracao * 100,
        margem: margemInput * 100
      };
      toast('Kit carregado com quantidades! Ajuste os parâmetros comerciais no orçamento.', 'success');
      Router.go('/orcamento');
    });
  });
}

console.log('%c⚡ Solar Pro 2.0 — gerador.js v4.4 carregado (travas de segurança na estimativa por histórico)', 'color:#ffb020;font-weight:bold');
