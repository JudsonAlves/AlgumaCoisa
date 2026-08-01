/**
 * worker.js — Cloudflare Worker
 * Substitui o backend Express + SQLite.
 * Faz proxy para o Google Apps Script (GAS) que gerencia os dados no Drive.
 *
 * Variáveis de ambiente (configure no dashboard do Cloudflare Workers):
 *   GAS_URL  — URL do Web App do Google Apps Script (Deploy > New deployment)
 *
 * VERSÃO 3.0 - ATUALIZADA COM:
 *  - Suporte a todas as novas ações do GAS
 *  - Arredondamento mesclado
 *  - Pisos de lucro
 *  - Financiamento (bancos, exceções, simulações)
 *  - Vendedor e estrutura padrão
 *  - Parâmetros de cálculo
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Só roteia /api/*
    if (!path.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    const GAS_URL = env.GAS_URL;
    if (!GAS_URL) {
      return json({ error: 'GAS_URL não configurada' }, 500);
    }

    // ── Rota de saúde ────────────────────────────────────────────────────────
    if (path === '/api/teste') {
      return json({ message: 'Worker funcionando!' });
    }

    // ── Mapeia path → action do GAS ─────────────────────────────────────────
    const method = request.method;
    const segments = path.replace('/api/', '').split('/').filter(Boolean);
    // Ex: ['equipamentos', 'placas', '42']

    let action, body;

    try {
      // Lê body apenas quando necessário
      if (['POST', 'PUT'].includes(method)) {
        body = await request.json();
      }

      // ── equipamentos ──
      // ── equipamentos ──
      if (segments[0] === 'equipamentos') {
        const tipo = segments[1]; // placas | inversores | baterias | outros_equipamentos
        const id   = segments[2];
      
        // VERIFICA TODOS OS TIPOS
        const tiposValidos = ['placas', 'inversores', 'baterias', 'outros_equipamentos'];
        if (!tiposValidos.includes(tipo)) {
          return json({ error: `Tipo inválido: ${tipo}. Permitidos: ${tiposValidos.join(', ')}` }, 400);
        }
      
        if (method === 'GET' && !id)  action = `get${capPlural(tipo)}`;
        if (method === 'GET' &&  id)  action = `get${capPlural(tipo)}ById`;
        if (method === 'POST')        action = `save${cap1(tipo)}`;
        if (method === 'PUT')         action = `update${cap1(tipo)}`;
        if (method === 'DELETE')      action = `delete${cap1(tipo)}`;
      
        if (id) body = { ...(body || {}), id: parseInt(id) };
      }

      // ── clientes ──
      else if (segments[0] === 'clientes') {
        const id = segments[1];
        const sub = segments[2];   // 'projetos' (Etapa 1) | 'documentos' (Etapa 6)
        const subId = segments[3]; // id do documento gerado
        const subSub = segments[4]; // 'arquivo'

        if (method === 'GET' && id && sub === 'projetos') {
          action = 'getProjetosDoCliente';
          body = { cliente_id: parseInt(id) };
        }
        // Etapa 6 (V3): histórico de documentos gerados pra esse cliente
        // — faltava essa rota inteira; sem ela, "Vincular cópia ao
        // cliente" em documentos.js falhava silenciosamente e nada
        // ficava salvo em documentos_gerados.
        else if (sub === 'documentos') {
          if (method === 'GET' && subId && subSub === 'arquivo') {
            action = 'getDocumentoGeradoArquivo';
            body = { id: parseInt(subId) };
          }
          else if (method === 'GET') {
            action = 'getDocumentosGeradosCliente';
            body = { cliente_id: parseInt(id) };
          }
          else if (method === 'POST') {
            action = 'salvarDocumentoGerado';
            body = { ...(body || {}), cliente_id: parseInt(id) };
          }
          else if (method === 'DELETE' && subId) {
            action = 'excluirDocumentoGerado';
            body = { id: parseInt(subId) };
          }
        }
        else if (method === 'GET' && !id)  action = 'getClientes';
        else if (method === 'GET' &&  id)  action = 'getClienteById';
        else if (method === 'POST')        action = 'saveCliente';
        else if (method === 'PUT')         action = 'updateCliente';
        else if (method === 'DELETE')      action = 'deleteCliente';

        if (id && !sub) body = { ...(body || {}), id: parseInt(id) };
      }

      // ── orcamentos ──
      else if (segments[0] === 'orcamentos') {
        const id = segments[1];
        const sub = segments[2];   // 'clientes' — Etapa 1 (V3): participantes vinculados ao projeto
        const subId = segments[3]; // id do vínculo (orcamento_clientes), só usado no DELETE

        if (sub === 'clientes') {
          if (method === 'GET') {
            action = 'getClientesDoOrcamento';
            body = { orcamento_id: parseInt(id) };
          } else if (method === 'POST') {
            action = 'saveVinculoCliente';
            body = { ...(body || {}), orcamento_id: parseInt(id) };
          } else if (method === 'DELETE') {
            action = 'removeVinculoCliente';
            body = { id: parseInt(subId) };
          }
        }
        else if (method === 'GET' && !id)  action = 'getOrcamentos';
        else if (method === 'GET' &&  id)  action = 'getOrcamentoById';
        else if (method === 'POST')        action = 'saveOrcamento';
        else if (method === 'PUT')         action = 'updateOrcamento';
        else if (method === 'DELETE')      action = 'deleteOrcamento';

        if (id && !sub) body = { ...(body || {}), id: parseInt(id) };
      }

      // ── configuracoes (estruturas, vendedores, materiais_avulsos) ──
      else if (segments[0] === 'configuracoes') {
        const tipo = segments[1]; // estruturas | vendedores | materiais_avulsos | outros_equipamentos
        const id = segments[2];

        // 🔴 CORRIGIDO: adicionado 'outros_equipamentos'
        if (!['estruturas', 'vendedores', 'materiais_avulsos', 'outros_equipamentos', 'fornecedores', 'tipos_servico'].includes(tipo)) {
          return json({ error: 'Tipo de configuração inválido' }, 400);
        }

        // Mapeamento de ações
        const actionMap = {
          'GET': id ? `get${capPlural(tipo)}ById` : `get${capPlural(tipo)}`,
          'POST': `save${cap1(tipo)}`,
          'PUT': `update${cap1(tipo)}`,
          'DELETE': `delete${cap1(tipo)}`,
        };
        action = actionMap[method];
        if (id) body = { ...(body || {}), id: parseInt(id) };
      }

      // ── log ──
      else if (segments[0] === 'log') {
        if (method === 'GET')  action = 'getLogs';
        if (method === 'POST') action = 'saveLog';
      }

      // ── documentos-templates (modelos .docx: contrato, procuração, etc.) ──
      else if (segments[0] === 'documentos-templates') {
        const id = segments[1];
        const sub = segments[2]; // 'arquivo' — só existe nessa subrota

        if (method === 'GET' && id && sub === 'arquivo') action = 'getDocumentoTemplateArquivo';
        else if (method === 'GET' && id)                 action = 'getDocumentoTemplateById';
        else if (method === 'GET')                       action = 'getDocumentosTemplates';
        else if (method === 'POST')                       action = 'saveDocumentoTemplate';
        else if (method === 'PUT')                         action = 'updateDocumentoTemplate';
        else if (method === 'DELETE')                       action = 'deleteDocumentoTemplate';

        if (id) body = { ...(body || {}), id: parseInt(id) };
      }

      // ── proposta-config (singleton, sem id — sempre 1 registro) ──
      else if (segments[0] === 'proposta-config') {
        if (method === 'GET') {
          action = 'getPropostaConfig';
        } else if (method === 'POST' || method === 'PUT') {
          action = 'savePropostaConfig';
        } else if (method === 'DELETE') {
          // Não permitimos DELETE para a config singleton
          return json({ error: 'Não é possível excluir a configuração global' }, 405);
        }
      }

      // ── json-urls (para acesso público aos catálogos) ──
      else if (segments[0] === 'json-urls') {
        if (method === 'GET') {
          action = 'getJsonUrls';
        }
      }

      // ── sync-all-json (forçar sincronização) ──
      else if (segments[0] === 'sync-all-json') {
        if (method === 'POST') {
          action = 'syncAllJson';
        }
      }

      // ── acompanhamentos (Etapa 2/V3 — pipeline de execução do projeto) ──
      else if (segments[0] === 'acompanhamentos') {
        const id = segments[1];
        const sub = segments[2];   // 'etapas' | 'link-publico'
        const etapaId = segments[3];

        if (sub === 'etapas' && etapaId) {
          if (method === 'PUT' || method === 'POST') {
            action = 'atualizarEtapaAcompanhamento';
            body = { ...(body || {}), id: parseInt(etapaId) };
          }
        }
        else if (sub === 'link-publico') {
          if (method === 'POST') { action = 'garantirTokenPublico'; body = { id: parseInt(id) }; }
        }
        else if (method === 'GET' && !id) action = 'getAcompanhamentos';
        else if (method === 'GET' &&  id) { action = 'getAcompanhamentoCompleto'; body = { id: parseInt(id) }; }
        else if (method === 'POST')       action = 'iniciarAcompanhamento';
        else if (method === 'PUT' && id)  { action = 'updateAcompanhamento'; body = { ...(body || {}), id: parseInt(id) }; }
      }

      // ── acompanhamento-publico (Etapa 7/V3 — link sem login pro
      // cliente ver o status do projeto dele, via token na URL) ──
      else if (segments[0] === 'acompanhamento-publico') {
        if (method === 'GET') {
          action = 'getAcompanhamentoPublico';
          body = { token: url.searchParams.get('token') };
        }
      }

    } catch (e) {
      return json({ error: 'Body inválido: ' + e.message }, 400);
    }

    if (!action) {
      return json({ error: `Rota não encontrada: ${method} ${path}` }, 404);
    }

    // ── Chama o GAS ──────────────────────────────────────────────────────────
    try {
      const gasRes = await proxyToGAS(GAS_URL, action, body);
      return json(gasRes);
    } catch (e) {
      return json({ error: 'Erro ao contatar GAS: ' + e.message }, 502);
    }
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function proxyToGAS(gasUrl, action, data) {
  const url = new URL(gasUrl);
  url.searchParams.set('action', action);
  
  // Para GET com id, passa como parâmetro na URL
  if (data?.id && ['get', 'update', 'delete'].some(p => action.toLowerCase().startsWith(p))) {
    url.searchParams.set('id', data.id);
  }
  // Etapa 1 (V3): getClientesDoOrcamento/getProjetosDoCliente usam
  // orcamento_id/cliente_id em vez de id — repassa também na URL
  // quando a chamada for GET (isWrite=false).
  if (data?.orcamento_id) url.searchParams.set('orcamento_id', data.orcamento_id);
  if (data?.cliente_id)   url.searchParams.set('cliente_id', data.cliente_id);
  if (data?.token)        url.searchParams.set('token', data.token);

  // Para GET sem body, usamos GET com parâmetros na URL
  const isWrite = data && !['get'].some(p => action.toLowerCase().startsWith(p));

  const res = await fetch(isWrite ? gasUrl : url.toString(), {
    method: isWrite ? 'POST' : 'GET',
    headers: isWrite ? { 'Content-Type': 'application/json' } : {},
    body: isWrite ? JSON.stringify({ action, data }) : undefined,
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`GAS retornou ${res.status}`);
  return res.json();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// MAPEAMENTO DE PLURAIS E SINGULARES
// ============================================================

const PLURAL_ACTION = { 
  materiais_avulsos: 'MateriaisAvulsos',
  outros_equipamentos: 'OutrosEquipamentos',
  tipos_servico: 'TiposServico',
};

const SINGULAR_ACTION = {
  placas: 'Placa', 
  inversores: 'Inversor', 
  baterias: 'Bateria',
  estruturas: 'Estrutura', 
  vendedores: 'Vendedor', 
  materiais_avulsos: 'MateriaisAvulsos',
  outros_equipamentos: 'OutrosEquipamentos', // 🔴 NOVO
  fornecedores: 'Fornecedor',
  tipos_servico: 'TipoServico',
};

function capPlural(s) { 
  return PLURAL_ACTION[s] || (s.charAt(0).toUpperCase() + s.slice(1)); 
}

function cap1(s) { 
  return SINGULAR_ACTION[s] || (s.charAt(0).toUpperCase() + s.slice(1).replace(/s$/, '')); 
}
