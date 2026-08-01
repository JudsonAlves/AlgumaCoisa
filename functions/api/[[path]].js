export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // Rota de teste — mostra o que está no env
  if (path === '/api/teste') {
    return Response.json({
      message: 'Function ok',
      env_keys: Object.keys(env),
      gas_url: env.GAS_URL ? 'DEFINIDA' : 'UNDEFINED'
    });
  }

  const GAS_URL = env.GAS_URL;
  if (!GAS_URL) {
    return Response.json({ error: 'GAS_URL não configurada' }, { status: 500 });
  }

  const segments = path.replace('/api/', '').split('/').filter(Boolean);
  const method = request.method;
  let body;

  try {
    if (['POST', 'PUT'].includes(method)) {
      body = await request.json();
    } else if (method === 'DELETE') {
      // Só a rota logos-bancos manda corpo em DELETE (drive_file_id);
      // as demais rotas DELETE não mandam body, então erro de parse
      // aqui é esperado e ignorado (não é um "Body inválido" real).
      try { body = await request.clone().json(); } catch (_) { body = undefined; }
    }
  } catch (e) {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const action = resolveAction(segments, method);
  if (!action) {
    return Response.json({ error: `Rota não encontrada: ${method} ${path}` }, { status: 404 });
  }

  // Extração de id (e, pra rotas aninhadas de cliente, cliente_id):
  //  - 'documentos-templates/:id/arquivo'                -> id vem da posição 1
  //  - 'clientes/:clienteId/anexos[/:id[/arquivo]]'       -> cliente_id sempre pos.1;
  //    id do item vem da pos.3 (existe em .../anexos/:id e .../anexos/:id/arquivo)
  //  - 'clientes/:clienteId/documentos[/:id[/arquivo]]'   -> idem
  //  - demais rotas: id é sempre o último segmento (se numérico)
  let numericId;
  let clienteIdBody;

  const ehSubRecursoCliente = segments[0] === 'clientes' && ['anexos', 'documentos'].includes(segments[2]);

  if (segments[0] === 'documentos-templates' && segments[2] === 'arquivo') {
    numericId = !isNaN(segments[1]) ? parseInt(segments[1]) : undefined;
  } else if (ehSubRecursoCliente) {
    clienteIdBody = !isNaN(segments[1]) ? parseInt(segments[1]) : undefined;
    if (segments[3] !== undefined && !isNaN(segments[3])) numericId = parseInt(segments[3]);
  } else {
    const idSeg = segments[segments.length - 1];
    numericId = !isNaN(idSeg) && idSeg !== undefined ? parseInt(idSeg) : undefined;
  }

  body = { ...(body || {}) };
  if (numericId !== undefined) body.id = numericId;
  if (clienteIdBody !== undefined) body.cliente_id = clienteIdBody;

  const isWrite = ['POST', 'PUT', 'DELETE'].includes(method);

  // Leituras (GET) são idempotentes: em picos de concorrência (ex: pageOrcamento
  // dispara ~9 GETs em paralelo) o Apps Script às vezes responde com HTML/erro
  // de quota em vez de JSON, o que antes virava 502 direto. Agora tentamos
  // de novo (backoff curto) antes de desistir.
  const MAX_TENTATIVAS = isWrite ? 1 : 3;
  let lastErr;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      let gasRes;

      if (isWrite) {
        gasRes = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, data: body || {} }),
          redirect: 'follow',
        });
      } else {
        const u = new URL(GAS_URL);
        u.searchParams.set('action', action);
        if (numericId !== undefined) u.searchParams.set('id', numericId);
        if (clienteIdBody !== undefined) u.searchParams.set('cliente_id', clienteIdBody);
        gasRes = await fetch(u.toString(), { redirect: 'follow' });
      }

      const data = await gasRes.json();
      return Response.json(data, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      lastErr = e;
      if (tentativa < MAX_TENTATIVAS) {
        await new Promise(r => setTimeout(r, 300 * tentativa));
      }
    }
  }

  return Response.json({ error: 'Erro ao contatar GAS: ' + lastErr.message }, { status: 502 });
}

function resolveAction(segments, method) {
  const [resource, tipo, id] = segments;
  const hasId  = id   && !isNaN(id);
  const tipoId = tipo && !isNaN(tipo);

  const cap  = s => s.charAt(0).toUpperCase() + s.slice(1);
  // Singularização explícita: regra genérica (remover 's' final) quebra
  // 'inversores' -> 'inversor' (plural em '-es', não apenas '+s').
  const SINGULAR = {
    placas: 'Placa', inversores: 'Inversor', baterias: 'Bateria',
    estruturas: 'Estrutura', vendedores: 'Vendedor', materiais_avulsos: 'MateriaisAvulsos',
    outros_equipamentos: 'OutrosEquipamentos', fornecedores: 'Fornecedor',
  };
  const cap1 = s => SINGULAR[s] || cap(s.replace(/s$/, ''));
  // "materiais_avulsos" e "outros_equipamentos" têm underscore, que cap()
  // sozinho não resolve para o nome da action no GAS (getMateriaisAvulsos,
  // não getMateriais_avulsos; getOutrosEquipamentos, não getOutros_equipamentos).
  const PLURAL_OVERRIDE = { materiais_avulsos: 'MateriaisAvulsos', outros_equipamentos: 'OutrosEquipamentos' };
  const capPlural = s => PLURAL_OVERRIDE[s] || cap(s);

  if (resource === 'equipamentos' && tipo) {
    if (!['placas', 'inversores', 'baterias', 'outros_equipamentos'].includes(tipo)) return null;
    if (method === 'GET'    && !hasId) return `get${capPlural(tipo)}`;
    if (method === 'GET'    &&  hasId) return `get${capPlural(tipo)}ById`;
    if (method === 'POST')             return `save${cap1(tipo)}`;
    if (method === 'PUT')              return `update${cap1(tipo)}`;
    if (method === 'DELETE')           return `delete${cap1(tipo)}`;
  }
  if (resource === 'clientes') {
    const subRecurso = segments[2]; // 'anexos' | 'documentos' | undefined
    const ehArquivo = segments[4] === 'arquivo';

    if (subRecurso === 'anexos') {
      if (ehArquivo && method === 'GET') return 'getAnexoClienteArquivo';
      if (method === 'GET')    return 'getAnexosCliente';
      if (method === 'POST')   return 'salvarAnexoCliente';
      if (method === 'DELETE') return 'excluirAnexoCliente';
      return null;
    }
    if (subRecurso === 'documentos') {
      if (ehArquivo && method === 'GET') return 'getDocumentoGeradoArquivo';
      if (method === 'GET')    return 'getDocumentosGeradosCliente';
      if (method === 'POST')   return 'salvarDocumentoGerado';
      if (method === 'DELETE') return 'excluirDocumentoGerado';
      return null;
    }

    if (method === 'GET'    && !tipoId) return 'getClientes';
    if (method === 'GET'    &&  tipoId) return 'getClienteById';
    if (method === 'POST')              return 'saveCliente';
    if (method === 'PUT')               return 'updateCliente';
    if (method === 'DELETE')            return 'deleteCliente';
  }
  if (resource === 'orcamentos') {
    if (method === 'GET'    && !tipoId) return 'getOrcamentos';
    if (method === 'GET'    &&  tipoId) return 'getOrcamentoById';
    if (method === 'POST')              return 'saveOrcamento';
    if (method === 'PUT')               return 'updateOrcamento';
    if (method === 'DELETE')            return 'deleteOrcamento';
  }
  if (resource === 'log') {
    if (method === 'GET')  return 'getLogs';
    if (method === 'POST') return 'saveLog';
  }
  // ── configuracoes (estruturas, vendedores, materiais_avulsos) ──
  if (resource === 'configuracoes' && tipo) {
    if (!['estruturas', 'vendedores', 'materiais_avulsos', 'outros_equipamentos', 'fornecedores'].includes(tipo)) return null;
    if (method === 'GET'    && !hasId) return `get${capPlural(tipo)}`;
    if (method === 'GET'    &&  hasId) return `get${capPlural(tipo)}ById`;
    if (method === 'POST')             return `save${cap1(tipo)}`;
    if (method === 'PUT')              return `update${cap1(tipo)}`;
    if (method === 'DELETE')           return `delete${cap1(tipo)}`;
  }
  // ── documentos-templates (modelos .docx: contrato, procuração, etc.) ──
  if (resource === 'documentos-templates') {
    // note: para essa rota, 'tipo' na verdade é o :id (ex: documentos-templates/5)
    const hasTemplateId = tipo && !isNaN(tipo);
    if (segments[2] === 'arquivo' && method === 'GET') return 'getDocumentoTemplateArquivo';
    if (method === 'GET'    && !hasTemplateId) return 'getDocumentosTemplates';
    if (method === 'GET'    &&  hasTemplateId) return 'getDocumentoTemplateById';
    if (method === 'POST')                     return 'saveDocumentoTemplate';
    if (method === 'PUT')                      return 'updateDocumentoTemplate';
    if (method === 'DELETE')                   return 'deleteDocumentoTemplate';
  }
  // ── proposta-config (singleton, sem id — sempre 1 registro) ──
  if (resource === 'proposta-config') {
    if (method === 'GET')                              return 'getPropostaConfig';
    if (method === 'POST' || method === 'PUT')          return 'savePropostaConfig';
  }
  // ── logos-bancos (upload de logo de banco direto pro Drive) ──
  if (resource === 'logos-bancos') {
    if (method === 'POST')   return 'salvarLogoBanco';
    if (method === 'DELETE') return 'excluirLogoBanco';
  }
  return null;
}
