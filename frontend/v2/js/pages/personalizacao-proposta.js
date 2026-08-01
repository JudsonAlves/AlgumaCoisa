// ============================================================
// SOLAR PRO 2.0 — pages/personalizacao-proposta.js
// Formulário singleton para a identidade visual e os dados
// institucionais usados na Proposta Completa (6 folhas).
//
// VERSÃO 5.0 — DIVIDIDO:
// Este arquivo cuida SOMENTE de:
//   - Logo e marca d'água
//   - Capa (modelo, cores, foto, título, subtítulo)
//   - Dados da empresa / rodapé
//   - Responsável técnico (assinatura)
//   - Forma de pagamento (textos)
//   - Validade da proposta
//   - WhatsApp do site público
//
// Regras de cálculo (arredondamento, pisos de lucro, financiamento,
// imposto/margem/reajuste, vendedor/estrutura padrão) foram movidas
// para pages/configuracoes-calculo.js.
//
// DEPENDE DE: proposta-config-shared.js (deve ser carregado antes)
// ============================================================

// ============================================================
// VARIÁVEIS GLOBAIS DO FORMULÁRIO (estado visual em memória)
// ============================================================

let _ppLogoUrl = null;
let _ppCapaFotoUrl = null;
let _ppCapaTemplateId = null;
let _ppOcultarLogo = false;
let _ppOcultarTextos = false;

// ============================================================
// CSS PARA PREVIEW DA CAPA
// ============================================================

function _cssBaseCapaPreview() {
  return `
:root{--orange:#E8672B;--dark:#2A1B10;}
*{margin:0;padding:0;box-sizing:border-box;font-family:'Barlow',sans-serif;}
h1,.cp-sub{font-family:'Barlow Condensed',sans-serif;}
`;
}

function _previewIframeSrcdoc(capa, dadosCapa) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;600&display=swap" rel="stylesheet">
<style>${_cssBaseCapaPreview()}${capa.css}
body{overflow:hidden;}
.pp-scaler{width:794px;height:1123px;transform:scale(.185);transform-origin:top left;}
</style></head>
<body>
<div class="pp-scaler"><div style="width:794px;height:1123px;">${capa.render(dadosCapa)}</div></div>
</body></html>`;
}

function _renderGaleriaCapas(cfgAtual) {
  const dadosPreview = {
    logoUrl: _ppLogoUrl || (window.LOGO_PADRAO_URL || ''),
    titulo: cfgAtual.capa_titulo,
    subtitulo: cfgAtual.capa_subtitulo,
    fraseCliente: cfgAtual.capa_frase_cliente,
    clienteNome: 'Cliente Exemplo',
    vendedorNome: null,
    corPrimaria: cfgAtual.capa_cor_primaria,
    corSecundaria: cfgAtual.capa_cor_secundaria,
    fotoFundo: cfgAtual.capa_tema === 'foto' ? (_ppCapaFotoUrl || null) : null,
    telefone: cfgAtual.rodape_telefone,
    instagram: cfgAtual.rodape_instagram,
    endereco: cfgAtual.rodape_endereco,
    site: cfgAtual.rodape_site,
    ocultarLogo: _ppOcultarLogo,
    ocultarTextos: _ppOcultarTextos,
  };

  return CAPAS_PROPOSTA.map(capa => {
    const selecionada = capa.id === _ppCapaTemplateId;
    return `
    <div class="capa-card ${selecionada ? 'is-selected' : ''}" data-capa-id="${capa.id}">
      <div class="capa-card-preview">
        <iframe scrolling="no" title="${capa.nome}" srcdoc="${_previewIframeSrcdoc(capa, dadosPreview).replace(/"/g, '&quot;')}"></iframe>
      </div>
      <div class="capa-card-foot">
        <span>${capa.nome}</span>
        ${selecionada ? `<span class="capa-check">${icon('check')}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function _renderOpcoesEspeciaisCapa() {
  if (_ppCapaTemplateId !== 'apenas_foto') return '';
  return `
  <div class="mt-16" style="padding:12px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border)">
    <div class="text-faint" style="font-size:11.5px;margin-bottom:8px">Esse modelo é só a foto — use as opções abaixo pra remover o que não quiser mostrar. Com as duas marcadas, fica só a imagem.</div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px">
      <input type="checkbox" id="ppCapaOcultarLogo" ${_ppOcultarLogo ? 'checked' : ''}>
      <span>Ocultar logo</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
      <input type="checkbox" id="ppCapaOcultarTextos" ${_ppOcultarTextos ? 'checked' : ''}>
      <span>Ocultar título, cliente e rodapé</span>
    </label>
  </div>`;
}

// ============================================================
// PÁGINA PRINCIPAL: pagePersonalizacaoProposta
// ============================================================

async function pagePersonalizacaoProposta() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="loader"><div class="spin"></div> Carregando personalização...</div>`;

  const cfg = await carregarPropostaConfigMesclada();

  _ppLogoUrl = cfg.logo_url || null;
  _ppCapaFotoUrl = cfg.capa_foto_fundo || null;
  _ppCapaTemplateId = cfg.capa_template_id || 'diagonal_classica';
  _ppOcultarLogo = !!cfg.capa_ocultar_logo;
  _ppOcultarTextos = !!cfg.capa_ocultar_textos;

  view.innerHTML = `
    <style>
      .capa-galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:14px;}
      .capa-card{border:2px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;background:var(--surface-2);transition:border-color .15s;}
      .capa-card:hover{border-color:var(--orange, #E8672B);}
      .capa-card.is-selected{border-color:var(--orange, #E8672B);box-shadow:0 0 0 2px rgba(232,103,43,.25);}
      .capa-card-preview{width:100%;aspect-ratio:794/1123;background:#fff;overflow:hidden;position:relative;}
      .capa-card-preview iframe{width:794px;height:1123px;transform:scale(1);border:0;pointer-events:none;position:absolute;top:0;left:0;}
      .capa-card-foot{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;font-size:12px;font-weight:600;}
      .capa-check{color:var(--orange, #E8672B);display:flex;}
    </style>

    <div class="view-head">
      <div><h1>Personalização da Proposta</h1><p>Identidade visual e textos institucionais</p></div>
      <div class="view-head-actions">
        <button class="btn btn-primary" id="btnSalvarPP">${icon('check')} Salvar</button>
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div>
        <!-- CARD: Logo e Marca d'água -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('image')}</div><div><h3>Logo e Marca d'água</h3><div class="sub">Aparece na capa e no cabeçalho de cada folha</div></div></div>
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <button type="button" class="btn btn-secondary btn-sm" id="btnUploadLogo">${icon('upload')} Enviar logo</button>
            <input type="file" id="fileLogo" accept="image/*" style="display:none">
            <img id="logoPreview" src="${_ppLogoUrl || ''}" style="display:${_ppLogoUrl ? 'block' : 'none'};height:44px;max-width:180px;object-fit:contain;background:var(--surface-3);border-radius:8px;padding:4px">
            <span id="logoStatus" class="text-faint" style="font-size:11.5px">${_ppLogoUrl ? '' : 'Nenhum logo enviado — usando o padrão do sistema'}</span>
          </div>
          <div class="checkbox-row mt-16">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="ppMarcaDaguaGlobal" ${cfg.marca_dagua_ativa !== false ? 'checked' : ''}>
              <span>Exibir marca d'água por padrão nas propostas novas</span>
            </label>
          </div>
        </div>

        <!-- CARD: Capa -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('layout-template')}</div><div><h3>Capa</h3><div class="sub">Escolha o modelo de capa e ajuste os textos/cores</div></div></div>
          <div class="form-grid1">
            <div class="field"><label>Título</label><input class="input" id="ppCapaTitulo" value="${esc(cfg.capa_titulo)}"></div>
            <div class="field"><label>Subtítulo</label><input class="input" id="ppCapaSubtitulo" value="${esc(cfg.capa_subtitulo)}"></div>
            <div class="field span-2"><label>Frase antes do nome do cliente</label><input class="input" id="ppCapaFrase" value="${esc(cfg.capa_frase_cliente)}"><div class="hint">Ex: "${esc(cfg.capa_frase_cliente)}" <b>Nome do Cliente</b></div></div>
          </div>

          <div class="form-grid1 mt-16">
            <div class="field"><label>Cor primária</label><input class="input" id="ppCapaCor1" type="color" value="${esc(cfg.capa_cor_primaria || '#1F140B')}" style="height:42px;padding:4px"></div>
            <div class="field"><label>Cor secundária</label><input class="input" id="ppCapaCor2" type="color" value="${esc(cfg.capa_cor_secundaria || '#5A3A22')}" style="height:42px;padding:4px"></div>
          </div>

          <div class="mt-16">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="ppCapaUsaFoto" ${cfg.capa_tema === 'foto' ? 'checked' : ''}>
              <span>Usar foto de fundo em vez das cores</span>
            </label>
            <div id="ppCapaFotoWrap" style="display:${cfg.capa_tema === 'foto' ? 'flex' : 'none'};align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px">
              <button type="button" class="btn btn-secondary btn-sm" id="btnUploadCapaFoto">${icon('image')} Selecionar imagem</button>
              <input type="file" id="fileCapaFoto" accept="image/*" style="display:none">
              <img id="capaFotoPreview" src="${_ppCapaFotoUrl || ''}" style="display:${_ppCapaFotoUrl ? 'block' : 'none'};width:52px;height:52px;object-fit:cover;background:var(--surface-3);border-radius:9px">
              <span id="capaFotoStatus" class="text-faint" style="font-size:11.5px">${_ppCapaFotoUrl ? '✅ Foto definida' : ''}</span>
              <button type="button" class="btn btn-ghost btn-sm" id="btnRemoverCapaFoto" style="display:${_ppCapaFotoUrl ? 'inline-flex' : 'none'}">${icon('x')} Remover</button>
            </div>
          </div>

          <div class="mt-16">
            <label>Modelo de capa</label>
            <div class="capa-galeria" id="ppCapaGaleria">${_renderGaleriaCapas(cfg)}</div>
            <div id="ppCapaOpcoesEspeciais">${_renderOpcoesEspeciaisCapa()}</div>
          </div>
        </div>

        <!-- CARD: Dados da empresa -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('building')}</div><div><h3>Dados da empresa / Rodapé</h3><div class="sub">Aparece na capa e no rodapé das folhas internas</div></div></div>
          <div class="form-grid1">
            <div class="field"><label>Nome da empresa</label><input class="input" id="ppEmpresaNome" value="${esc(cfg.empresa_nome)}"></div>
            <div class="field"><label>Telefone / contato</label><input class="input" id="ppTelefone" value="${esc(cfg.rodape_telefone)}"></div>
            <div class="field"><label>Instagram / rede social</label><input class="input" id="ppInstagram" value="${esc(cfg.rodape_instagram)}"></div>
            <div class="field"><label>Site</label><input class="input" id="ppSite" value="${esc(cfg.rodape_site)}"></div>
            <div class="field span-2"><label>Endereço</label><input class="input" id="ppEndereco" value="${esc(cfg.rodape_endereco)}"></div>
          </div>
        </div>
      </div>

      <div>
        <!-- CARD: Responsável Técnico -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('user-check')}</div><div><h3>Responsável Técnico</h3><div class="sub">Assinatura na última página</div></div></div>
          <div class="form-grid1">
            <div class="field span-2"><label>Nome completo</label><input class="input" id="ppAssinaturaNome" value="${esc(cfg.assinatura_nome)}"></div>
            <div class="field span-2"><label>Cargos / registros (um por linha)</label><textarea class="input" id="ppAssinaturaPapeis" rows="3">${esc(cfg.assinatura_papeis)}</textarea></div>
          </div>
        </div>

        <!-- CARD: Forma de Pagamento -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('credit-card')}</div><div><h3>Forma de Pagamento</h3><div class="sub">Textos exibidos na página de itens do orçamento</div></div></div>
          <div class="form-grid1">
            <div class="field span-2"><label>Opções de pagamento</label><input class="input" id="ppPagOpcoes" value="${esc(cfg.forma_pagamento_opcoes)}"></div>
            <div class="field span-2"><label>Condição à vista</label><input class="input" id="ppPagAvista" value="${esc(cfg.forma_pagamento_avista)}"></div>
            <div class="field span-2"><label>Observação</label><textarea class="input" id="ppPagObs" rows="2">${esc(cfg.forma_pagamento_obs)}</textarea></div>
          </div>
        </div>

        <!-- CARD: Validade -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('calendar-clock')}</div><div><h3>Validade da proposta</h3></div></div>
          <div class="field"><label>Dias de validade</label><input class="input" id="ppValidadeDias" type="number" min="1" value="${cfg.validade_dias}"></div>
        </div>

        <!-- CARD: WhatsApp -->
        <div class="card">
          <div class="card-head"><div class="ico">${icon('message-circle')}</div><div><h3>WhatsApp (site público)</h3><div class="sub">Usado no botão da página inicial pública</div></div></div>
          <div class="form-grid1">
            <div class="field"><label>Número (DDI + DDD + número, só dígitos)</label><input class="input" id="ppWhatsappNumero" placeholder="5599912345678" value="${esc(cfg.whatsapp_numero)}"><div class="hint">Ex: 55 (Brasil) + 99 (DDD) + número. Sem espaços, traços ou parênteses.</div></div>
            <div class="field"><label>Mensagem pré-preenchida</label><textarea class="input" id="ppWhatsappMensagem" rows="2">${esc(cfg.whatsapp_mensagem)}</textarea></div>
          </div>
        </div>

        <div class="card" style="background:var(--surface-2);border:1px dashed var(--border);">
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-faint);">
            ${icon('calculator', 'style="width:14px;height:14px;flex-shrink:0"')}
            <span>Arredondamento, pisos de lucro, imposto/margem e financiamento agora ficam em <b>Configurações de Cálculo</b>.</span>
          </div>
        </div>
      </div>
    </div>
  `;
  refreshIcons();

  // ============================================================
  // EVENTOS DO FORMULÁRIO
  // ============================================================

  // ---- Galeria de capas ----
  function atualizarGaleria() {
    document.getElementById('ppCapaGaleria').innerHTML = _renderGaleriaCapas(_configAtualDoForm());
    document.getElementById('ppCapaOpcoesEspeciais').innerHTML = _renderOpcoesEspeciaisCapa();
    ligarCliqueGaleria();
    ligarOpcoesEspeciais();
  }

  function ligarCliqueGaleria() {
    document.querySelectorAll('#ppCapaGaleria .capa-card').forEach(card => {
      card.addEventListener('click', () => {
        _ppCapaTemplateId = card.dataset.capaId;
        atualizarGaleria();
      });
    });
  }

  function ligarOpcoesEspeciais() {
    const elLogo = document.getElementById('ppCapaOcultarLogo');
    const elTextos = document.getElementById('ppCapaOcultarTextos');
    if (elLogo) elLogo.addEventListener('change', () => { _ppOcultarLogo = elLogo.checked; atualizarGaleria(); });
    if (elTextos) elTextos.addEventListener('change', () => { _ppOcultarTextos = elTextos.checked; atualizarGaleria(); });
  }

  function _configAtualDoForm() {
    return {
      capa_titulo: document.getElementById('ppCapaTitulo').value || cfg.capa_titulo,
      capa_subtitulo: document.getElementById('ppCapaSubtitulo').value || cfg.capa_subtitulo,
      capa_frase_cliente: document.getElementById('ppCapaFrase').value || cfg.capa_frase_cliente,
      capa_cor_primaria: document.getElementById('ppCapaCor1').value,
      capa_cor_secundaria: document.getElementById('ppCapaCor2').value,
      capa_tema: document.getElementById('ppCapaUsaFoto').checked ? 'foto' : 'gradiente_marca',
      rodape_telefone: document.getElementById('ppTelefone').value,
      rodape_instagram: document.getElementById('ppInstagram').value,
      rodape_endereco: document.getElementById('ppEndereco').value,
      rodape_site: document.getElementById('ppSite').value,
    };
  }

  ligarCliqueGaleria();
  ligarOpcoesEspeciais();

  ['ppCapaTitulo', 'ppCapaSubtitulo', 'ppCapaFrase', 'ppCapaCor1', 'ppCapaCor2', 'ppTelefone', 'ppInstagram', 'ppEndereco', 'ppSite']
    .forEach(id => document.getElementById(id).addEventListener('input', atualizarGaleria));

  document.getElementById('ppCapaUsaFoto').addEventListener('change', (e) => {
    document.getElementById('ppCapaFotoWrap').style.display = e.target.checked ? 'flex' : 'none';
    atualizarGaleria();
  });

  // ---- Upload de logo ----
  document.getElementById('btnUploadLogo').addEventListener('click', () => document.getElementById('fileLogo').click());
  document.getElementById('fileLogo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('logoStatus');
    statusEl.textContent = '⏳ Enviando...';
    try {
      const blob = await redimensionarImagem2(file);
      const result = await uploadParaImgBB(blob);
      if (result.success) {
        _ppLogoUrl = result.url;
        const preview = document.getElementById('logoPreview');
        preview.src = _ppLogoUrl;
        preview.style.display = 'block';
        statusEl.textContent = '✅ Logo atualizado';
        toast('Logo enviado!', 'success');
        atualizarGaleria();
      } else {
        statusEl.textContent = '❌ Falha no upload';
        toast('Erro ao enviar imagem: ' + result.error, 'error');
      }
    } catch (err) {
      statusEl.textContent = '❌ Erro ao processar';
      toast('Erro ao processar imagem', 'error');
    }
  });

  // ---- Upload de foto da capa ----
  document.getElementById('btnUploadCapaFoto').addEventListener('click', () => document.getElementById('fileCapaFoto').click());
  document.getElementById('fileCapaFoto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('capaFotoStatus');
    statusEl.textContent = '⏳ Enviando...';
    try {
      const blob = await redimensionarImagem2(file);
      const result = await uploadParaImgBB(blob);
      if (result.success) {
        _ppCapaFotoUrl = result.url;
        const preview = document.getElementById('capaFotoPreview');
        preview.src = _ppCapaFotoUrl;
        preview.style.display = 'block';
        document.getElementById('btnRemoverCapaFoto').style.display = 'inline-flex';
        statusEl.textContent = '✅ Foto definida';
        toast('Foto enviada!', 'success');
        atualizarGaleria();
      } else {
        statusEl.textContent = '❌ Falha no upload';
        toast('Erro ao enviar imagem: ' + result.error, 'error');
      }
    } catch (err) {
      statusEl.textContent = '❌ Erro ao processar';
      toast('Erro ao processar imagem', 'error');
    }
  });

  document.getElementById('btnRemoverCapaFoto').addEventListener('click', () => {
    _ppCapaFotoUrl = null;
    document.getElementById('capaFotoPreview').style.display = 'none';
    document.getElementById('capaFotoStatus').textContent = '';
    document.getElementById('btnRemoverCapaFoto').style.display = 'none';
    atualizarGaleria();
  });

  // ---- Botão Salvar ----
  document.getElementById('btnSalvarPP').addEventListener('click', () => salvarPersonalizacaoProposta());
}
window.pagePersonalizacaoProposta = pagePersonalizacaoProposta;

// ============================================================
// FUNÇÃO: SALVAR PERSONALIZAÇÃO (só campos visuais/institucionais)
// ============================================================

async function salvarPersonalizacaoProposta() {
  const camposVisuais = {
    logo_url: _ppLogoUrl || '',
    marca_dagua_ativa: document.getElementById('ppMarcaDaguaGlobal').checked,
    capa_titulo: document.getElementById('ppCapaTitulo').value.trim(),
    capa_subtitulo: document.getElementById('ppCapaSubtitulo').value.trim(),
    capa_frase_cliente: document.getElementById('ppCapaFrase').value.trim(),
    capa_cor_primaria: document.getElementById('ppCapaCor1').value,
    capa_cor_secundaria: document.getElementById('ppCapaCor2').value,
    capa_tema: document.getElementById('ppCapaUsaFoto').checked ? 'foto' : 'gradiente_marca',
    capa_foto_fundo: _ppCapaFotoUrl || '',
    capa_template_id: _ppCapaTemplateId || 'diagonal_classica',
    capa_ocultar_logo: !!_ppOcultarLogo,
    capa_ocultar_textos: !!_ppOcultarTextos,
    empresa_nome: document.getElementById('ppEmpresaNome').value.trim(),
    rodape_telefone: document.getElementById('ppTelefone').value.trim(),
    rodape_instagram: document.getElementById('ppInstagram').value.trim(),
    rodape_endereco: document.getElementById('ppEndereco').value.trim(),
    rodape_site: document.getElementById('ppSite').value.trim(),
    assinatura_nome: document.getElementById('ppAssinaturaNome').value.trim(),
    assinatura_papeis: document.getElementById('ppAssinaturaPapeis').value.trim(),
    forma_pagamento_opcoes: document.getElementById('ppPagOpcoes').value.trim(),
    forma_pagamento_avista: document.getElementById('ppPagAvista').value.trim(),
    forma_pagamento_obs: document.getElementById('ppPagObs').value.trim(),
    validade_dias: parseInt(document.getElementById('ppValidadeDias').value) || 7,
    whatsapp_numero: document.getElementById('ppWhatsappNumero').value.trim().replace(/\D/g, ''),
    whatsapp_mensagem: document.getElementById('ppWhatsappMensagem').value.trim(),
  };

  const btn = document.getElementById('btnSalvarPP');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon('loader')} Salvando...`;
  refreshIcons();

  // Mescla com o config mais recente do servidor, preservando o que
  // pertence a Configurações de Cálculo (não sobrescreve essas chaves).
  const result = await salvarPropostaConfigParcial(camposVisuais);

  btn.disabled = false;
  btn.innerHTML = original;
  refreshIcons();

  if (result) {
    toast('Personalização salva! Novas propostas já usam esses dados.', 'success');
  }
}
window.salvarPersonalizacaoProposta = salvarPersonalizacaoProposta;

console.log('%c⚡ Solar Pro 2.0 — personalizacao-proposta.js v5.0 carregado', 'color:#ffb020;font-weight:bold');
