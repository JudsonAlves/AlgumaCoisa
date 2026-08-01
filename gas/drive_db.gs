/**
 * drive_db.gs — Google Apps Script
 * Banco de dados no Google Drive usando planilhas + JSONs sincronizados.
 *
 * Estrutura no Drive:
 *   SolarOrcamento/
 *     ├── SolarOrcamentoDB        (planilha com todos os dados)
 *     ├── placas.json             (sincronizado a cada escrita)
 *     ├── inversores.json
 *     ├── baterias.json
 *     ├── estruturas.json
 *     └── vendedores.json
 *
 * Imagens ficam no ImgBB — apenas a URL é salva no campo imagem_url.
 * (Logos de bancos, cadastradas em Configurações de Cálculo →
 * Financiamento, seguem o mesmo padrão: só o link fica salvo.)
 *
 * Deploy:
 *  1. script.google.com → Novo projeto → cole este código
 *  2. Implantar → Novo deploy → Aplicativo da Web
 *     Executar como: Eu | Acesso: Qualquer pessoa
 *  3. Copie a URL e configure como GAS_URL no Cloudflare Pages
 *
 * VERSÃO 3.0 - ATUALIZADA COM:
 *  - Arredondamento mesclado (geração + placas)
 *  - Pisos de lucro configuráveis
 *  - Financiamento (bancos, exceções, simulações ativas)
 *  - Vendedor e estrutura padrão
 *  - Parâmetros de cálculo (imposto, reajuste, margem)
 *
 * VERSÃO 3.1 - CORREÇÃO PARA PROPOSTA BNB:
 *  - Schema de `clientes` ganhou as colunas `unidadeConsumidora` e
 *    `historico_consumo`, usadas pelo cadastro de Clientes (bloco
 *    "Histórico de Consumo") e consumidas por montarDadosPropostaBNB()
 *    em pages/proposta-completa-bnb.js. Sem essas colunas na planilha,
 *    o `insert`/`update` genérico descartava esses dois campos
 *    silenciosamente (só grava o que existe no cabeçalho da aba).
 *  - Migração não-destrutiva: getSheet('clientes') agora chama
 *    ensureSheetHeaders(sheet, ['unidadeConsumidora','historico_consumo'])
 *    pra acrescentar as colunas em planilhas já existentes, sem tocar
 *    nas colunas/linhas atuais (mesmo padrão já usado em placas/
 *    inversores/vendedores).
 */

// ── Configuração ──────────────────────────────────────────────────────────────

const ROOT_FOLDER_NAME = 'SolarOrcamento';
const SPREADSHEET_NAME = 'SolarOrcamentoDB';
const JSON_COLLECTIONS = ['placas', 'inversores', 'baterias', 'outros_equipamentos', 'estruturas', 'vendedores', 'tipos_servico'];

// ── Pastas ────────────────────────────────────────────────────────────────────

function getRootFolder() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(ROOT_FOLDER_NAME);
}

// Subpasta onde ficam os .docx enviados em "Modelos de Documento"
// (contrato, procuração, etc). Arquivos binários ficam no Drive de
// verdade — só cabe base64 pequeno numa célula de planilha (~50k chars),
// um .docx real estoura isso fácil.
function getTemplatesFolder() {
  const root = getRootFolder();
  const it = root.getFoldersByName('Templates');
  if (it.hasNext()) return it.next();
  return root.createFolder('Templates');
}

// Subpasta onde ficam os documentos GERADOS (contrato/procuração já
// preenchidos) vinculados a um cliente — um documento por geração,
// não sobrescreve o anterior (histórico).
function getDocumentosGeradosFolder() {
  const root = getRootFolder();
  const it = root.getFoldersByName('DocumentosGerados');
  if (it.hasNext()) return it.next();
  return root.createFolder('DocumentosGerados');
}

// Subpasta onde ficam os anexos do cliente (fatura de energia,
// identidade, outros documentos enviados manualmente).
function getAnexosClientesFolder() {
  const root = getRootFolder();
  const it = root.getFoldersByName('AnexosClientes');
  if (it.hasNext()) return it.next();
  return root.createFolder('AnexosClientes');
}

// ── Planilha ──────────────────────────────────────────────────────────────────

function getDB() {
  const root  = getRootFolder();
  const files = root.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());

  const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(root);
  initSheets(ss);
  return ss;
}

function initSheets(ss) {
  // Trava a criação das planilhas: o dashboard dispara várias chamadas em
  // paralelo (Promise.all) e, sem lock, duas execuções concorrentes podem
  // checar "a planilha X não existe" ao mesmo tempo e ambas tentarem criar
  // a mesma aba — a segunda falha com "Já existe uma página chamada X".
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    initSheetsUnlocked(ss);
  } finally {
    lock.releaseLock();
  }
}

function initSheetsUnlocked(ss) {
  const schemas = {
    placas: [
      'id','marca','modelo','potencia','tipo','ativo','altura','largura','garantia',
      'garantiager','inmetro','outros','horas_efetivas','dias_geracao',
      'fator_percentual','margem_percentual','area','nome_completo',
      'fator_geracao','imagem_url','created_at','updated_at'
    ],
    inversores: [
      'id','marca','modelo','tipo','ativo','potencia','garantia','inmetro','outros',
      'tensao','fase','potencia_min','potencia_max','nome_completo',
      'potencia_formatada','imagem_url','created_at','updated_at'
    ],
    baterias: [
      'id','nome','tipo','garantia','capacidade','tensao','inmetro','outros',
      'imagem_url','created_at','updated_at'
    ],
    outros_equipamentos: [
      'id','nome','modelo','categoria','descricao','potencia','tensao','corrente',
      'garantia','imagem_url','ativo','created_at','updated_at'
    ],
    // v3.1: + unidadeConsumidora + historico_consumo (Proposta BNB)
    clientes: [
      'id','nome','cpf_cnpj','telefone','email','endereco','numero',
      'complemento','bairro','cidade','estado','cep',
      'unidadeConsumidora','historico_consumo',
      'created_at','updated_at'
    ],
    orcamentos: [
      'id','cliente_id','vendedor_id','vendedor_nome','estrutura_id','estrutura_nome',
      'estrutura_tipo','estrutura_imagem','placa_id','inversor_id','bateria_id',
      'quantidade_placas','quantidade_inversores','quantidade_baterias',
      'geracao_requerida','geracao_estimada','potencia_kit',
      'valor_fornecimento','margem_percentual','imposto_percentual',
      'reajuste','desconto','acrescimo','frete',
      'valor_equipamentos','total_materiais','valor_final',
      'itens_placas_json','itens_inversores_json','itens_baterias_json','itens_materiais_json',
      'estrutura_fixa','recall_inversor','vendedor','data_orcamento'
    ],
    log_orcamentos: [
      'id','orcamento_id','acao','detalhes','data_registro'
    ],
    estruturas: [
      'id','nome','tipo','descricao','preco_base','imagem_url','created_at','updated_at'
    ],
    vendedores: [
  'id','codigo','nome','email','telefone','comissao','observacao','created_at','updated_at'
    ],
    // ============================================================
    // ORCAMENTO_CLIENTES — Etapa 1 do roadmap V3: tabela de junção N:N
    // entre orçamentos e clientes (ex.: Contratante + Titular da Conta
    // com procuração). Sheet 100% NOVA e aditiva — não toca em nenhuma
    // coluna/linha de `orcamentos` ou `clientes`. `orcamento.cliente_id`
    // continua sendo escrito do jeito de sempre (sempre = Contratante),
    // então nada que já lê esse campo (proposta-completa, histórico
    // etc.) quebra. Ver getClientesDoOrcamento/getProjetosDoCliente/
    // saveVinculoCliente/removeVinculoCliente mais abaixo.
    // ============================================================
    orcamento_clientes: [
      'id','orcamento_id','cliente_id','papel','created_at'
    ],
    // Fornecedores — usado nas autorizações de faturamento do Dimensionamento
    // BNB (fornecedor de material) e para qualquer outro fornecedor que a
    // empresa queira ter salvo (evita digitar nome/CNPJ toda vez).
    fornecedores: [
      'id','nome_empresarial','cnpj','contato','email','endereco','observacao',
      'created_at','updated_at'
    ],
    // ============================================================
    // ETAPA 2 (V3) — ACOMPANHAMENTO: modelo de dados
    // tipos_servico: catálogo configurável (mesmo padrão de
    // estruturas/vendedores) — cada tipo de serviço de engenharia
    // elétrica (instalação solar completa, laudo técnico, SPDA,
    // ampliação, carregador veicular etc.) tem seu próprio conjunto
    // ordenado de etapas-padrão.
    // ============================================================
    tipos_servico: [
      'id','nome','etapas_padrao_json','ativo','created_at','updated_at'
    ],
    // acompanhamentos: 1 registro por projeto que entrou no pipeline
    // de execução (reaproveita orcamento_id → cliente(s)/endereço já
    // resolvidos na Etapa 1).
    acompanhamentos: [
      'id','orcamento_id','tipo_servico_id','status_geral','data_inicio','data_fim','token_publico'
    ],
    // acompanhamento_etapas: o checklist propriamente dito. nome_etapa
    // é copiado do template NO MOMENTO da criação (não referencia
    // tipos_servico depois), pra não quebrar histórico se o template
    // mudar depois.
    acompanhamento_etapas: [
      'id','acompanhamento_id','nome_etapa','ordem','status','data_prevista',
      'data_conclusao','responsavel_id','observacao'
    ],
    materiais_avulsos: [
      'id','nome','descricao','unidade','preco_unitario','estoque','categoria','created_at','updated_at'
    ],
    // ============================================================
    // DOCUMENTOS_TEMPLATES — modelos .docx enviados pelo usuário
    // (contrato, procuração, etc). O ARQUIVO em si fica no Drive
    // (pasta SolarOrcamento/Templates); aqui só ficam os metadados.
    // Nunca entra em JSON_COLLECTIONS: não é catálogo público.
    // ============================================================
    documentos_templates: [
      'id','nome','drive_file_id','tamanho_bytes','distribuidora','created_at','updated_at'
    ],
    // ============================================================
    // DOCUMENTOS_GERADOS — cópia de cada documento (.docx/.pdf) gerado
    // pra um cliente específico (contrato, procuração...), vinculada
    // ao cliente (e opcionalmente ao orçamento de origem). O ARQUIVO
    // fica no Drive (pasta SolarOrcamento/DocumentosGerados); aqui só
    // ficam os metadados — mesmo padrão de documentos_templates.
    // ============================================================
    documentos_gerados: [
      'id','cliente_id','orcamento_id','template_id','nome','tipo_arquivo','drive_file_id',
      'tamanho_bytes','created_at'
    ],
    // ============================================================
    // ANEXOS_CLIENTES — arquivos anexados pelo usuário a um cliente
    // (fatura de energia, identidade, outros documentos). Imagens
    // vão pro ImgBB (campo `url`, mesmo pipeline de placas/inversores
    // — nunca base64 no Drive); arquivos não-imagem (PDF etc, que o
    // ImgBB não aceita) vão pro Drive (campo `drive_file_id`).
    // Cada linha usa só um dos dois campos.
    // ============================================================
    anexos_clientes: [
      'id','cliente_id','nome','categoria','tipo_mime','url','drive_file_id',
      'tamanho_bytes','created_at'
    ],
    // ============================================================
    // PROPOSTA_CONFIG - VERSÃO 3.0 (ATUALIZADA)
    // ============================================================
    proposta_config: [
      // ---- IDENTIDADE VISUAL ----
      'id',
      'logo_url',
      'marca_dagua_ativa',
      'capa_titulo',
      'capa_subtitulo',
      'capa_frase_cliente',
      'capa_foto_fundo',
      'capa_tema',
      'capa_cor_primaria',
      'capa_cor_secundaria',
      'capa_template_id',
      'capa_ocultar_logo',
      'capa_ocultar_textos',
      'empresa_nome',
      'rodape_telefone',
      'rodape_instagram',
      'rodape_endereco',
      'rodape_site',
      'assinatura_nome',
      'assinatura_papeis',
      'forma_pagamento_opcoes',
      'forma_pagamento_avista',
      'forma_pagamento_obs',
      'validade_dias',
      'whatsapp_numero',
      'whatsapp_mensagem',
      
      // ---- ARREDONDAMENTO MESCLADO (JSON) ----
      'arredondamento_json',
      
      // ---- PADRÕES ----
      'vendedor_padrao_id',
      'estrutura_padrao_id',
      
      // ---- PARÂMETROS DE CÁLCULO ----
      'imposto_percentual_base',
      'reajuste_padrao',
      'margem_padrao',
      'margem_perca',
      'comissao_percentual',
      
      // ---- PISOS DE LUCRO (JSON) ----
      'pisos_lucro_json',
      
      // ---- FINANCIAMENTO (JSON) ----
      'financas_json',
      
      // ---- TIMESTAMP ----
      'updated_at'
    ]
  };

  const defaultSheet = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');

  Object.entries(schemas).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  });

  if (defaultSheet) try { ss.deleteSheet(defaultSheet); } catch(e) {}
}

// ── JSON sync ─────────────────────────────────────────────────────────────────

function syncJson(colecao) {
  if (!JSON_COLLECTIONS.includes(colecao)) return;

  const dados    = getAll(colecao);
  const root     = getRootFolder();
  const nome     = colecao + '.json';
  const conteudo = JSON.stringify(dados, null, 2);

  const files = root.getFilesByName(nome);
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(conteudo);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } else {
    const blob = Utilities.newBlob(conteudo, 'application/json', nome);
    const file = root.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
}

function getJsonUrl(colecao) {
  const root  = getRootFolder();
  const nome  = colecao + '.json';
  const files = root.getFilesByName(nome);
  if (!files.hasNext()) {
    syncJson(colecao);
    return getJsonUrl(colecao);
  }
  const file = files.next();
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/uc?export=download&id=${file.getId()}`;
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    let action, data;
    if (e.postData) {
      const body = JSON.parse(e.postData.contents);
      action = body.action;
      data   = body.data || {};
    } else {
      action = e.parameter.action;
      data   = {
        id: e.parameter.id ? parseInt(e.parameter.id) : undefined,
        cliente_id: e.parameter.cliente_id ? parseInt(e.parameter.cliente_id) : undefined,
        // Etapa 1 (V3): getClientesDoOrcamento usa orcamento_id
        orcamento_id: e.parameter.orcamento_id ? parseInt(e.parameter.orcamento_id) : undefined,
        // Etapa 7 (V3): token do link público de acompanhamento — texto
        // livre (UUID), não é número, então não passa por parseInt.
        token: e.parameter.token || undefined,
      };
    }
    const result = dispatch(action, data);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function dispatch(action, data) {
  const map = {
    // Placas
    getPlacas:         () => getAll('placas'),
    getPlacasById:     () => getById('placas', data.id),
    savePlaca:         () => insertAndSync('placas', data),
    updatePlaca:       () => updateAndSync('placas', data),
    deletePlaca:       () => removeAndSync('placas', data.id),
    // Inversores
    getInversores:     () => getAll('inversores'),
    getInversoresById: () => getById('inversores', data.id),
    saveInversor:      () => insertAndSync('inversores', data),
    updateInversor:    () => updateAndSync('inversores', data),
    deleteInversor:    () => removeAndSync('inversores', data.id),
    // Baterias
    getBaterias:       () => getAll('baterias'),
    getBateriasById:   () => getById('baterias', data.id),
    saveBateria:       () => insertAndSync('baterias', data),
    updateBateria:     () => updateAndSync('baterias', data),
    deleteBateria:     () => removeAndSync('baterias', data.id),
    // Outros
    getOutrosEquipamentos:         () => getAll('outros_equipamentos'),
    getOutrosEquipamentosById:     () => getById('outros_equipamentos', data.id),
    saveOutrosEquipamentos:        () => insertAndSync('outros_equipamentos', data),
    updateOutrosEquipamentos:      () => updateAndSync('outros_equipamentos', data),
    deleteOutrosEquipamentos:      () => removeAndSync('outros_equipamentos', data.id),
    // Clientes
    getClientes:       () => getAll('clientes'),
    getClienteById:    () => getById('clientes', data.id),
    saveCliente:       () => insert('clientes', data),
    updateCliente:     () => update('clientes', data),
    deleteCliente:     () => remove('clientes', data.id),
    // Orçamentos
    getOrcamentos:     () => getOrcamentosJoined(),
    getOrcamentoById:  () => getById('orcamentos', data.id),
    saveOrcamento:     () => insert('orcamentos', data),
    updateOrcamento:   () => update('orcamentos', data),
    deleteOrcamento:   () => remove('orcamentos', data.id),
    // Etapa 1 (V3) — Cliente ↔ Projeto (N:N)
    getClientesDoOrcamento: () => getClientesDoOrcamento(data.orcamento_id),
    getProjetosDoCliente:   () => getProjetosDoCliente(data.cliente_id),
    saveVinculoCliente:     () => saveVinculoCliente(data),
    removeVinculoCliente:   () => removeVinculoCliente(data.id),
    // Estruturas
    getEstruturas:         () => getAll('estruturas'),
    getEstruturasById:     () => getById('estruturas', data.id),
    saveEstrutura:         () => insertAndSync('estruturas', data),
    updateEstrutura:       () => updateAndSync('estruturas', data),
    deleteEstrutura:       () => removeAndSync('estruturas', data.id),
    // Vendedores
    getVendedores:         () => getAll('vendedores'),
    getVendedoresById:     () => getById('vendedores', data.id),
    saveVendedor:          () => insertAndSync('vendedores', data),
    updateVendedor:        () => updateAndSync('vendedores', data),
    deleteVendedor:        () => removeAndSync('vendedores', data.id),
    // Fornecedores (não entra em JSON_COLLECTIONS — cadastro interno,
    // igual clientes, não é catálogo público)
    getFornecedores:       () => getAll('fornecedores'),
    getFornecedoresById:   () => getById('fornecedores', data.id),
    saveFornecedor:        () => insert('fornecedores', data),
    updateFornecedor:      () => update('fornecedores', data),
    deleteFornecedor:      () => remove('fornecedores', data.id),
    // Etapa 2 (V3) — Tipos de Serviço (catálogo público, mesmo padrão
    // de estruturas/vendedores)
    getTiposServico:       () => getAll('tipos_servico'),
    getTiposServicoById:   () => getById('tipos_servico', data.id),
    saveTipoServico:       () => insertAndSync('tipos_servico', data),
    updateTipoServico:     () => updateAndSync('tipos_servico', data),
    deleteTipoServico:     () => removeAndSync('tipos_servico', data.id),
    // Etapa 2/3 (V3) — Acompanhamento (modelo de dados; tela é a Etapa 3)
    iniciarAcompanhamento:         () => iniciarAcompanhamento(data),
    getAcompanhamentos:            () => getAcompanhamentosComEtapas(),
    getAcompanhamentoCompleto:     () => getAcompanhamentoCompleto(data.id),
    updateAcompanhamento:          () => update('acompanhamentos', data),
    atualizarEtapaAcompanhamento:  () => atualizarEtapaAcompanhamento(data),
    garantirTokenPublico:          () => garantirTokenPublico(data.id),
    getAcompanhamentoPublico:      () => getAcompanhamentoPublico(data.token),
    // Materiais Avulsos
    getMateriaisAvulsos:         () => getAll('materiais_avulsos'),
    getMateriaisAvulsosById:     () => getById('materiais_avulsos', data.id),
    saveMateriaisAvulsos:        () => insertAndSync('materiais_avulsos', data),
    updateMateriaisAvulsos:      () => updateAndSync('materiais_avulsos', data),
    deleteMateriaisAvulsos:      () => removeAndSync('materiais_avulsos', data.id),
    // Log
    getLogs:           () => getAll('log_orcamentos'),
    saveLog:           () => insert('log_orcamentos', data),
    // Documentos (modelos .docx — contrato, procuração, etc.)
    getDocumentosTemplates:     () => getAll('documentos_templates'),
    getDocumentoTemplateById:   () => getById('documentos_templates', data.id),
    getDocumentoTemplateArquivo:() => getDocumentoTemplateArquivoBase64(data.id),
    saveDocumentoTemplate:      () => salvarDocumentoTemplate(data),
    updateDocumentoTemplate:    () => atualizarDocumentoTemplate(data),
    deleteDocumentoTemplate:    () => excluirDocumentoTemplate(data.id),
    // Documentos gerados (vinculados a um cliente/orçamento)
    getDocumentosGeradosCliente: () => getDocumentosGeradosPorCliente(data.cliente_id),
    salvarDocumentoGerado:       () => salvarDocumentoGerado(data),
    excluirDocumentoGerado:      () => excluirDocumentoGerado(data.id),
    getDocumentoGeradoArquivo:   () => getDocumentoGeradoArquivoBase64(data.id),
    // Anexos do cliente (fatura de energia, identidade, outros)
    getAnexosCliente:   () => getAnexosPorCliente(data.cliente_id),
    salvarAnexoCliente: () => salvarAnexoCliente(data),
    excluirAnexoCliente:() => excluirAnexoCliente(data.id),
    getAnexoClienteArquivo: () => getAnexoClienteArquivoBase64(data.id),
    // Personalização global da Proposta (singleton, id=1)
    getPropostaConfig:  () => getPropostaConfig(),
    savePropostaConfig: () => upsertPropostaConfig(data),
    // URLs dos JSONs públicos (para o frontend buscar catálogo diretamente)
    getJsonUrls:       () => ({
      placas:    getJsonUrl('placas'),
      inversores: getJsonUrl('inversores'),
      baterias:  getJsonUrl('baterias'),
      estruturas: getJsonUrl('estruturas'),
      vendedores: getJsonUrl('vendedores'),
    }),
    // Forçar sync manual de todos os JSONs
    syncAllJson:       () => {
      JSON_COLLECTIONS.forEach(c => syncJson(c));
      return { message: 'Sync concluído' };
    },
  };

  if (!map[action]) throw new Error('Ação desconhecida: ' + action);
  return map[action]();
}

// ── CRUD com sync de JSON ─────────────────────────────────────────────────────

function insertAndSync(colecao, data) {
  const result = insert(colecao, data);
  syncJson(colecao);
  return result;
}

function updateAndSync(colecao, data) {
  const result = update(colecao, data);
  syncJson(colecao);
  return result;
}

function removeAndSync(colecao, id) {
  const result = remove(colecao, id);
  syncJson(colecao);
  return result;
}

// ── CRUD genérico ─────────────────────────────────────────────────────────────

function getSheet(name) {
  const ss = getDB();
  let sheet = ss.getSheetByName(name);
  if (!sheet) { initSheets(ss); sheet = ss.getSheetByName(name); }
  if (name === 'orcamentos') ensureOrcamentosSchema(sheet);
  if (name === 'proposta_config') ensurePropostaConfigSchema(sheet);
  // Etapa 6 (V3): documentos por distribuidora
  if (name === 'documentos_templates') ensureSheetHeaders(sheet, ['id','nome','drive_file_id','tamanho_bytes','distribuidora','created_at','updated_at']);
  if (name === 'documentos_gerados') ensureSheetHeaders(sheet, ['id','cliente_id','orcamento_id','template_id','nome','tipo_arquivo','drive_file_id','tamanho_bytes','created_at']);
  // Etapa 7 (V3): link público de acompanhamento
  if (name === 'acompanhamentos') ensureSheetHeaders(sheet, ['id','orcamento_id','tipo_servico_id','status_geral','data_inicio','data_fim','token_publico']);
  if (name === 'placas') ensureSheetHeaders(sheet, ['ativo']);
  if (name === 'inversores') ensureSheetHeaders(sheet, ['ativo']);
  if (name === 'vendedores') ensureSheetHeaders(sheet, ['codigo']);
  // v3.1: garante as colunas usadas pela Proposta BNB (histórico de
  // consumo + UC do cliente) em planilhas de clientes já existentes,
  // sem tocar no que já está cadastrado.
  if (name === 'clientes') ensureSheetHeaders(sheet, ['unidadeConsumidora', 'historico_consumo']);
  return sheet;
}

// ============================================================
// MIGRAÇÃO GENÉRICA: acrescenta ao final da planilha as colunas
// que ainda não existirem, sem tocar nas colunas/linhas já existentes.
// ============================================================
function ensureSheetHeaders(sheet, requiredHeaders) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = requiredHeaders.filter(h => headers.indexOf(h) === -1);

  if (missing.length) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, lastCol + 1, 1, missing.length).setFontWeight('bold');
  }
}

// ============================================================
// MIGRAÇÃO: PROPOSTA_CONFIG - VERSÃO 3.1
// ============================================================
function ensurePropostaConfigSchema(sheet) {
  ensureSheetHeaders(sheet, [
    'id',
    'logo_url',
    'marca_dagua_ativa',
    'capa_titulo',
    'capa_subtitulo',
    'capa_frase_cliente',
    'capa_foto_fundo',
    'capa_tema',
    'capa_cor_primaria',
    'capa_cor_secundaria',
    'capa_template_id',
    'capa_ocultar_logo',
    'capa_ocultar_textos',
    'empresa_nome',
    'rodape_telefone',
    'rodape_instagram',
    'rodape_endereco',
    'rodape_site',
    'assinatura_nome',
    'assinatura_papeis',
    'forma_pagamento_opcoes',
    'forma_pagamento_avista',
    'forma_pagamento_obs',
    'validade_dias',
    'whatsapp_numero',
    'whatsapp_mensagem',
    'arredondamento_json',
    'vendedor_padrao_id',
    'estrutura_padrao_id',
    'imposto_percentual_base',
    'reajuste_padrao',
    'margem_padrao',
    'margem_perca',
    'comissao_percentual',
    'pisos_lucro_json',
    'financas_json',
    'updated_at'
  ]);
}

// Migração automática e não-destrutiva: se a planilha "orcamentos" já existia
// antes das colunas de múltiplos itens (v2.0), acrescenta as colunas que
// faltarem ao final, sem tocar nas colunas/linhas já existentes.
function ensureOrcamentosSchema(sheet) {
  ensureSheetHeaders(sheet, [
    'id','cliente_id','vendedor_id','vendedor_nome','estrutura_id','estrutura_nome',
    'estrutura_tipo','estrutura_imagem','placa_id','inversor_id','bateria_id',
    'quantidade_placas','quantidade_inversores','quantidade_baterias',
    'geracao_requerida','geracao_estimada','potencia_kit',
    'valor_fornecimento','margem_percentual','imposto_percentual',
    'reajuste','desconto','acrescimo','frete',
    'valor_equipamentos','total_materiais','valor_final',
    'itens_placas_json','itens_inversores_json','itens_baterias_json','itens_materiais_json','itens_outros_json',
    'estrutura_fixa','recall_inversor','vendedor','data_orcamento',
    'nome_arquivo',
    // Etapa 1 (V3): endereço do PROJETO, independente do endereço
    // cadastral do cliente (um cliente pode ter N projetos em N
    // endereços diferentes). JSON: {apelido,logradouro,numero,
    // complemento,bairro,cidade,estado,cep}. Mesmo padrão de
    // serialização de financas_json/pisos_lucro_json.
    'endereco_projeto_json'
  ]);
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function getAll(sheetName) {
  const sheet = getSheet(sheetName);
  if (sheet.getLastRow() <= 1) return [];
  const headers = getHeaders(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return rows
    .filter(r => r[0] !== '' && r[0] !== null)
    .map(r => rowToObj(headers, r));
}

function getById(sheetName, id) {
  const row = getAll(sheetName).find(r => r.id == id);
  if (!row) throw new Error(`Registro ${id} não encontrado em ${sheetName}`);
  return row;
}

function nextId(sheet, headers) {
  if (sheet.getLastRow() <= 1) return 1;
  const idCol = headers.indexOf('id') + 1;
  const ids = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1)
    .getValues().flat().filter(v => v !== '');
  return ids.length ? Math.max(...ids) + 1 : 1;
}

function insert(sheetName, data) {
  const sheet   = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const id      = nextId(sheet, headers);
  const now     = new Date().toISOString();

  const row = headers.map(h => {
    if (h === 'id')                         return id;
    if (h === 'created_at')                 return now;
    if (h === 'updated_at')                 return now;
    if (h === 'data_orcamento' && !data[h]) return now;
    if (h === 'data_registro'  && !data[h]) return now;
    if (h === 'nome_arquivo')               return data[h] || '';
    const v = data[h];
    return (v !== undefined && v !== null) ? v : '';
  });

  sheet.appendRow(row);
  return { id, message: 'Criado com sucesso' };
}

function update(sheetName, data) {
  const sheet   = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const idCol   = headers.indexOf('id') + 1;

  if (!data.id) throw new Error('id obrigatório para update');

  const ids    = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getValues().flat();
  const rowIdx = ids.findIndex(v => v == data.id);
  if (rowIdx === -1) throw new Error(`id ${data.id} não encontrado`);

  const sheetRow = rowIdx + 2;
  const now      = new Date().toISOString();

  headers.forEach((h, i) => {
    if (h === 'id' || h === 'created_at') return;
    const val = h === 'updated_at' ? now : (data[h] !== undefined ? data[h] : null);
    if (val !== null) sheet.getRange(sheetRow, i + 1).setValue(val);
  });

  return { id: data.id, message: 'Atualizado com sucesso' };
}

function remove(sheetName, id) {
  if (!id) throw new Error('id obrigatório para delete');
  const sheet   = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const idCol   = headers.indexOf('id') + 1;

  const ids    = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getValues().flat();
  const rowIdx = ids.findIndex(v => v == id);
  if (rowIdx === -1) throw new Error(`id ${id} não encontrado`);

  sheet.deleteRow(rowIdx + 2);
  return { message: 'Excluído com sucesso' };
}

// ============================================================
// ETAPA 1 (V3) — CLIENTE ↔ PROJETO (N:N)
// orcamento.cliente_id continua sempre apontando pro Contratante
// (V2 não muda em nada); esta tabela de junção é um complemento
// que permite vincular participantes extras (ex.: Titular da Conta/
// Procuração) a um mesmo orçamento/projeto, cada um com seu papel.
// ============================================================
function getClientesDoOrcamento(orcamentoId) {
  if (!orcamentoId) throw new Error('orcamento_id é obrigatório');
  return getAll('orcamento_clientes').filter(v => String(v.orcamento_id) === String(orcamentoId));
}

function getProjetosDoCliente(clienteId) {
  if (!clienteId) throw new Error('cliente_id é obrigatório');
  const vinculos   = getAll('orcamento_clientes').filter(v => String(v.cliente_id) === String(clienteId));
  const orcamentos = getAll('orcamentos');
  const todosVinculos = getAll('orcamento_clientes');

  return vinculos.map(v => {
    const orc = orcamentos.find(o => String(o.id) === String(v.orcamento_id));
    const outrosParticipantes = todosVinculos.filter(x =>
      String(x.orcamento_id) === String(v.orcamento_id) && String(x.id) !== String(v.id)
    );
    return { orcamento: orc || null, papel: v.papel, outrosParticipantes };
  });
}

function saveVinculoCliente(data) {
  if (!data.orcamento_id || !data.cliente_id) throw new Error('orcamento_id e cliente_id são obrigatórios');
  return insert('orcamento_clientes', {
    orcamento_id: data.orcamento_id,
    cliente_id: data.cliente_id,
    papel: data.papel || 'contratante'
  });
}

function removeVinculoCliente(id) {
  return remove('orcamento_clientes', id);
}

// ============================================================
// ETAPA 2 (V3) — ACOMPANHAMENTO (modelo de dados, sem tela ainda —
// a tela/Kanban é a Etapa 3). Cria o pipeline de execução de um
// projeto a partir de um tipo de serviço já cadastrado.
// ============================================================
function iniciarAcompanhamento(data) {
  if (!data.orcamento_id || !data.tipo_servico_id) throw new Error('orcamento_id e tipo_servico_id são obrigatórios');
  const tipo = getById('tipos_servico', data.tipo_servico_id);
  const etapasTemplate = JSON.parse(tipo.etapas_padrao_json || '[]');
  const agora = new Date().toISOString();

  const acompanhamento = insert('acompanhamentos', {
    orcamento_id: data.orcamento_id,
    tipo_servico_id: data.tipo_servico_id,
    status_geral: 'em_andamento',
    data_inicio: agora,
    data_fim: '',
    token_publico: Utilities.getUuid(),
  });

  etapasTemplate.forEach((nome, i) => {
    insert('acompanhamento_etapas', {
      acompanhamento_id: acompanhamento.id,
      nome_etapa: nome,
      ordem: i + 1,
      status: 'pendente',
      data_prevista: '',
      data_conclusao: '',
      responsavel_id: '',
      observacao: '',
    });
  });

  return acompanhamento;
}

function getAcompanhamentoCompleto(id) {
  const acomp = getById('acompanhamentos', id);
  const etapas = getAll('acompanhamento_etapas')
    .filter(e => String(e.acompanhamento_id) === String(id))
    .sort((a, b) => (+a.ordem) - (+b.ordem));
  return { ...acomp, etapas };
}

// Etapa 7 (V3) — acompanhamentos criados antes desta etapa não têm
// token_publico ainda; gera e salva na hora (idempotente: se já tem,
// só devolve o que já existe, nunca troca — trocar invalidaria um
// link que já pode ter sido compartilhado com o cliente).
function garantirTokenPublico(id) {
  const acomp = getById('acompanhamentos', id);
  if (acomp.token_publico) return { token_publico: acomp.token_publico };
  const token = Utilities.getUuid();
  update('acompanhamentos', { id: acomp.id, token_publico: token });
  return { token_publico: token };
}

// Etapa 7 (V3) — rota PÚBLICA (sem login, mesmo padrão de
// getJsonUrls): só devolve o essencial pro cliente acompanhar o
// status do projeto dele, nenhum dado sensível (valores, endereço,
// documentos, outros participantes).
function getAcompanhamentoPublico(token) {
  if (!token) throw new Error('Link inválido ou expirado');
  const acomp = getAll('acompanhamentos').find(a => a.token_publico === token);
  if (!acomp) throw new Error('Link inválido ou expirado');
  const etapas = getAll('acompanhamento_etapas')
    .filter(e => String(e.acompanhamento_id) === String(acomp.id))
    .sort((a, b) => (+a.ordem) - (+b.ordem))
    .map(e => ({ nome_etapa: e.nome_etapa, status: e.status })); // só o essencial, sem dado sensível
  return { status_geral: acomp.status_geral, etapas };
}

function atualizarEtapaAcompanhamento(data) {
  if (!data.id) throw new Error('id da etapa é obrigatório');
  return update('acompanhamento_etapas', data); // status, data_conclusao, observacao, etc.
}

// Etapa 3 (V3) — usado pela tela de Acompanhamento (Kanban). Diferente
// de getOrcamentosJoined() (que corta nos últimos 50 orçamentos, pensado
// pro Histórico), aqui buscamos o orçamento/cliente de CADA
// acompanhamento sem limite, porque um projeto em execução pode
// referenciar um orçamento bem mais antigo que os últimos 50.
function getAcompanhamentosComEtapas() {
  const etapas    = getAll('acompanhamento_etapas');
  const orcamentos = getAll('orcamentos');
  const clientes   = getAll('clientes');
  const orcMap = Object.fromEntries(orcamentos.map(o => [o.id, o]));
  const cliMap = Object.fromEntries(clientes.map(c => [c.id, c]));

  return getAll('acompanhamentos').map(a => {
    const orc = orcMap[a.orcamento_id] || null;
    const cliente = orc ? cliMap[orc.cliente_id] : null;
    return {
      ...a,
      etapas: etapas
        .filter(e => String(e.acompanhamento_id) === String(a.id))
        .sort((x, y) => (+x.ordem) - (+y.ordem)),
      orcamento_nome_arquivo: orc?.nome_arquivo || '',
      orcamento_endereco_projeto_json: orc?.endereco_projeto_json || '',
      cliente_nome: cliente?.nome || '',
    };
  });
}

// Migração manual e não-destrutiva (rodar UMA VEZ pelo editor do Apps
// Script, nunca automática): preenche orcamento_clientes com o vínculo
// "Contratante" pra todo orçamento já existente que ainda não tenha
// nenhum vínculo, e copia o endereço cadastral do cliente pro
// endereco_projeto_json do orçamento. Idempotente — pode rodar de novo
// sem duplicar (pula orçamentos que já têm vínculo).
function migrarClientesParaJuncao() {
  const orcamentos = getAll('orcamentos');
  const clientes    = getAll('clientes');
  const vinculos    = getAll('orcamento_clientes');
  let criados = 0;

  orcamentos.forEach(orc => {
    const jaTemVinculo = vinculos.some(v => String(v.orcamento_id) === String(orc.id));
    if (jaTemVinculo || !orc.cliente_id) return;

    insert('orcamento_clientes', {
      orcamento_id: orc.id,
      cliente_id: orc.cliente_id,
      papel: 'contratante'
    });
    criados++;

    if (!orc.endereco_projeto_json) {
      const cli = clientes.find(c => String(c.id) === String(orc.cliente_id));
      if (cli) {
        const enderecoProjeto = {
          apelido: '', logradouro: cli.endereco || '', numero: cli.numero || '',
          complemento: cli.complemento || '', bairro: cli.bairro || '',
          cidade: cli.cidade || '', estado: cli.estado || '', cep: cli.cep || ''
        };
        update('orcamentos', { id: orc.id, endereco_projeto_json: JSON.stringify(enderecoProjeto) });
      }
    }
  });

  return { message: `Migração concluída: ${criados} vínculo(s) criado(s).` };
}

// ============================================================
// CONFIGURAÇÃO GLOBAL DA PROPOSTA (VERSÃO 3.0)
// ============================================================

function getPropostaConfig() {
  const sheet = getSheet('proposta_config');
  if (sheet.getLastRow() <= 1) return {}; // ainda não configurado — frontend usa defaults
  
  const data = getById('proposta_config', 1);
  
  // Desserializa JSONs
  const result = { ...data };
  
  try {
    if (data.arredondamento_json) {
      result.arredondamento = JSON.parse(data.arredondamento_json);
    }
  } catch(e) { /* ignorar */ }
  
  try {
    if (data.pisos_lucro_json) {
      result.pisos_lucro = JSON.parse(data.pisos_lucro_json);
    }
  } catch(e) { /* ignorar */ }
  
  try {
    if (data.financas_json) {
      result.financas = JSON.parse(data.financas_json);
    }
  } catch(e) { /* ignorar */ }
  
  return result;
}

function upsertPropostaConfig(data) {
  const sheet   = getSheet('proposta_config');
  const headers = getHeaders(sheet);
  const now     = new Date().toISOString();

  // Serializa objetos JSON
  const payload = { ...data };
  
  // Arredondamento
  if (payload.arredondamento) {
    payload.arredondamento_json = JSON.stringify(payload.arredondamento);
    delete payload.arredondamento;
  }
  
  // Pisos de lucro
  if (payload.pisos_lucro) {
    payload.pisos_lucro_json = JSON.stringify(payload.pisos_lucro);
    delete payload.pisos_lucro;
  }
  
  // Financiamento
  if (payload.financas) {
    payload.financas_json = JSON.stringify(payload.financas);
    delete payload.financas;
  }

  if (sheet.getLastRow() <= 1) {
    const row = headers.map(h => {
      if (h === 'id')         return 1;
      if (h === 'updated_at') return now;
      const v = payload[h];
      return (v !== undefined && v !== null) ? v : '';
    });
    sheet.appendRow(row);
    return { id: 1, message: 'Configuração salva com sucesso' };
  }
  return update('proposta_config', { ...payload, id: 1 });
}

// ============================================================
// ORÇAMENTOS COM JOIN
// ============================================================

function getOrcamentosJoined() {
  const orcamentos = getAll('orcamentos');
  const clientes   = getAll('clientes');
  const placas     = getAll('placas');
  const inversores = getAll('inversores');

  const clienteMap  = Object.fromEntries(clientes.map(c  => [c.id, c]));
  const placaMap    = Object.fromEntries(placas.map(p    => [p.id, p]));
  const inversorMap = Object.fromEntries(inversores.map(i => [i.id, i]));

  return orcamentos
    .slice(-50)
    .reverse()
    .map(o => ({
      ...o,
      cliente_nome:  clienteMap[o.cliente_id]?.nome || '',
      placa_nome:    placaMap[o.placa_id]
                       ? `${placaMap[o.placa_id].marca} ${placaMap[o.placa_id].modelo} ${placaMap[o.placa_id].potencia}W`
                       : '',
      inversor_nome: inversorMap[o.inversor_id]
                       ? `${inversorMap[o.inversor_id].marca} ${inversorMap[o.inversor_id].modelo}`
                       : '',
    }));
}

// ============================================================
// DOCUMENTOS_TEMPLATES — upload/leitura/exclusão de modelos .docx
// O arquivo em si vai pro Drive (pasta Templates); a planilha só
// guarda metadados (nome, id do arquivo no Drive). O conteúdo
// binário só trafega quando o frontend pede explicitamente
// (getDocumentoTemplateArquivo), pra não pesar a listagem.
// ============================================================
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function salvarDocumentoTemplate(data) {
  if (!data.nome || !data.arquivo_base64) throw new Error('Nome e arquivo (.docx) são obrigatórios');

  const bytes  = Utilities.base64Decode(data.arquivo_base64);
  const blob   = Utilities.newBlob(bytes, DOCX_MIME, data.nome + '.docx');
  const file   = getTemplatesFolder().createFile(blob);
  const agora  = new Date().toISOString();

  return insert('documentos_templates', {
    nome: data.nome,
    drive_file_id: file.getId(),
    tamanho_bytes: bytes.length,
    distribuidora: data.distribuidora || '',
    created_at: agora,
    updated_at: agora,
  });
}

function atualizarDocumentoTemplate(data) {
  const existente = getById('documentos_templates', data.id);
  let driveFileId = existente.drive_file_id;
  let tamanho = existente.tamanho_bytes;

  // Trocou o arquivo: descarta o antigo no Drive e sobe um novo
  // (DriveApp não tem "substituir conteúdo binário" direto).
  if (data.arquivo_base64) {
    try { DriveApp.getFileById(driveFileId).setTrashed(true); } catch (e) { /* já pode não existir mais */ }
    const bytes = Utilities.base64Decode(data.arquivo_base64);
    const blob  = Utilities.newBlob(bytes, DOCX_MIME, (data.nome || existente.nome) + '.docx');
    const file  = getTemplatesFolder().createFile(blob);
    driveFileId = file.getId();
    tamanho = bytes.length;
  } else if (data.nome && data.nome !== existente.nome) {
    try { DriveApp.getFileById(driveFileId).setName(data.nome + '.docx'); } catch (e) { /* ignora */ }
  }

  return update('documentos_templates', {
    id: data.id,
    nome: data.nome || existente.nome,
    drive_file_id: driveFileId,
    tamanho_bytes: tamanho,
    distribuidora: data.distribuidora !== undefined ? data.distribuidora : (existente.distribuidora || ''),
    created_at: existente.created_at,
    updated_at: new Date().toISOString(),
  });
}

function excluirDocumentoTemplate(id) {
  const row = getById('documentos_templates', id);
  if (row && row.drive_file_id) {
    try { DriveApp.getFileById(row.drive_file_id).setTrashed(true); } catch (e) { /* ignora */ }
  }
  return remove('documentos_templates', id);
}

// Devolve o .docx em base64 — só chamado quando o usuário realmente
// vai gerar um documento a partir desse modelo (não na listagem).
function getDocumentoTemplateArquivoBase64(id) {
  const row = getById('documentos_templates', id);
  const file = DriveApp.getFileById(row.drive_file_id);
  const bytes = file.getBlob().getBytes();
  return { id: row.id, nome: row.nome, arquivo_base64: Utilities.base64Encode(bytes) };
}

// ============================================================
// DOCUMENTOS_GERADOS — cada documento (.docx/.pdf) gerado a partir
// de um modelo, pra um cliente específico, fica guardado aqui
// (histórico completo, não sobrescreve). O arquivo vai pro Drive;
// a planilha só guarda metadados.
// ============================================================
const PDF_MIME  = 'application/pdf';

function salvarDocumentoGerado(data) {
  if (!data.cliente_id || !data.nome || !data.arquivo_base64) {
    throw new Error('cliente_id, nome e arquivo são obrigatórios');
  }
  const tipoArquivo = (data.tipo_arquivo === 'pdf') ? 'pdf' : 'docx';
  const mime = tipoArquivo === 'pdf' ? PDF_MIME : DOCX_MIME;
  const extensao = tipoArquivo === 'pdf' ? '.pdf' : '.docx';

  const bytes = Utilities.base64Decode(data.arquivo_base64);
  const blob  = Utilities.newBlob(bytes, mime, data.nome + extensao);
  const file  = getDocumentosGeradosFolder().createFile(blob);
  const agora = new Date().toISOString();

  return insert('documentos_gerados', {
    cliente_id: data.cliente_id,
    orcamento_id: data.orcamento_id || '',
    template_id: data.template_id || '',
    nome: data.nome,
    tipo_arquivo: tipoArquivo,
    drive_file_id: file.getId(),
    tamanho_bytes: bytes.length,
    created_at: agora,
  });
}

function excluirDocumentoGerado(id) {
  const row = getById('documentos_gerados', id);
  if (row && row.drive_file_id) {
    try { DriveApp.getFileById(row.drive_file_id).setTrashed(true); } catch (e) { /* ignora */ }
  }
  return remove('documentos_gerados', id);
}

function getDocumentosGeradosPorCliente(clienteId) {
  if (!clienteId) return [];
  return getAll('documentos_gerados')
    .filter(d => String(d.cliente_id) === String(clienteId))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getDocumentoGeradoArquivoBase64(id) {
  const row = getById('documentos_gerados', id);
  const file = DriveApp.getFileById(row.drive_file_id);
  const bytes = file.getBlob().getBytes();
  return { id: row.id, nome: row.nome, tipo_arquivo: row.tipo_arquivo, arquivo_base64: Utilities.base64Encode(bytes) };
}

// ============================================================
// ANEXOS_CLIENTES — arquivos anexados manualmente a um cliente
// (fatura de energia, identidade, outros). Qualquer tipo de
// arquivo é aceito; o arquivo vai pro Drive, a planilha só guarda
// metadados (mesmo padrão de documentos_templates/gerados).
// ============================================================
function salvarAnexoCliente(data) {
  if (!data.cliente_id || !data.nome) throw new Error('cliente_id e nome são obrigatórios');
  const agora = new Date().toISOString();

  // Imagem: o upload pro ImgBB já foi feito no navegador (mesmo
  // pipeline usado nas fotos de placas/inversores) — aqui só grava
  // a URL, nunca passa base64 de imagem pelo Drive.
  if (data.url) {
    return insert('anexos_clientes', {
      cliente_id: data.cliente_id,
      nome: data.nome,
      categoria: data.categoria || 'outro',
      tipo_mime: data.tipo_mime || 'image/*',
      url: data.url,
      drive_file_id: '',
      tamanho_bytes: 0,
      created_at: agora,
    });
  }

  // Não-imagem (PDF, etc. — o ImgBB não aceita): vai pro Drive.
  if (!data.arquivo_base64) throw new Error('Envie "url" (imagem) ou "arquivo_base64" (outros tipos)');
  const mime = data.tipo_mime || 'application/octet-stream';
  const bytes = Utilities.base64Decode(data.arquivo_base64);
  const blob  = Utilities.newBlob(bytes, mime, data.nome);
  const file  = getAnexosClientesFolder().createFile(blob);

  return insert('anexos_clientes', {
    cliente_id: data.cliente_id,
    nome: data.nome,
    categoria: data.categoria || 'outro',
    tipo_mime: mime,
    url: '',
    drive_file_id: file.getId(),
    tamanho_bytes: bytes.length,
    created_at: agora,
  });
}

function excluirAnexoCliente(id) {
  const row = getById('anexos_clientes', id);
  // Só existe arquivo no Drive pra anexos não-imagem — imagens (ImgBB)
  // não têm drive_file_id, então não há nada pra "trashear" no Drive.
  if (row && row.drive_file_id) {
    try { DriveApp.getFileById(row.drive_file_id).setTrashed(true); } catch (e) { /* ignora */ }
  }
  return remove('anexos_clientes', id);
}

function getAnexosPorCliente(clienteId) {
  if (!clienteId) return [];
  return getAll('anexos_clientes')
    .filter(a => String(a.cliente_id) === String(clienteId))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getAnexoClienteArquivoBase64(id) {
  const row = getById('anexos_clientes', id);
  if (!row.drive_file_id) {
    throw new Error('Este anexo é uma imagem hospedada por URL — use o campo "url" direto, sem buscar arquivo.');
  }
  const file = DriveApp.getFileById(row.drive_file_id);
  const bytes = file.getBlob().getBytes();
  return { id: row.id, nome: row.nome, tipo_mime: row.tipo_mime, arquivo_base64: Utilities.base64Encode(bytes) };
}
