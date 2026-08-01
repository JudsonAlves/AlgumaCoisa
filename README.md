# Solar Orçamento — Deploy Guide

Stack: **Cloudflare Pages** (frontend) + **Cloudflare Worker** (API) + **Google Apps Script** (banco no Drive)

---

## Estrutura do repositório

```
/
├── frontend/          ← arquivos do site (HTML, CSS, JS)
│   ├── index.html
│   ├── _routes.json   ← diz ao Cloudflare Pages para rotear /api/* ao Worker
│   └── js/core/api.js ← adaptado para o Worker
├── worker/
│   └── worker.js      ← substitui o Express
├── gas/
│   └── drive_db.gs    ← Google Apps Script (banco no Drive)
└── wrangler.toml      ← config do Worker
```

---

## Passo 1 — Criar o repositório no GitHub

1. Acesse https://github.com/new
2. Nome: `solar-orcamento` (ou outro)
3. Visibilidade: **Privado** (recomendado)
4. Não inicialize com README
5. Siga as instruções do GitHub para fazer push do código:

```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/solar-orcamento.git
git push -u origin main
```

---

## Passo 2 — Configurar o Google Apps Script

1. Acesse https://script.google.com
2. Clique em **Novo projeto**
3. Delete o código de exemplo e cole o conteúdo de `gas/drive_db.gs`
4. Salve (Ctrl+S), nomeie o projeto como `SolarOrcamentoDB`
5. Clique em **Implantar → Novo deploy**
6. Configurações:
   - Tipo: **Aplicativo da Web**
   - Executar como: **Eu (seu e-mail)**
   - Quem tem acesso: **Qualquer pessoa**
7. Clique **Implantar** → autorize as permissões solicitadas
8. **Copie a URL do Web App** — você vai precisar dela no próximo passo

> A URL tem o formato: `https://script.google.com/macros/s/XXXXXXXXXXX/exec`

> Uma planilha chamada `SolarOrcamentoDB` será criada automaticamente no seu Drive
> na primeira requisição.

---

## Passo 3 — Deploy do Cloudflare Worker

### Instalar o Wrangler (CLI do Cloudflare):

```bash
npm install -g wrangler
wrangler login
```

### Configurar a URL do GAS como secret:

```bash
wrangler secret put GAS_URL
# Quando solicitado, cole a URL do Web App do GAS
```

### Deploy do Worker:

```bash
wrangler deploy
```

> Anote a URL do Worker, ex: `https://solar-orcamento-api.SEU_USUARIO.workers.dev`

---

## Passo 4 — Deploy do Cloudflare Pages

1. Acesse https://dash.cloudflare.com → **Pages**
2. Clique **Create a project → Connect to Git**
3. Selecione seu repositório `solar-orcamento`
4. Configurações de build:
   - **Production branch:** `main`
   - **Build command:** *(deixe vazio)*
   - **Build output directory:** `frontend`
5. Clique **Save and Deploy**

### Conectar o Worker ao Pages:

1. No painel do Cloudflare Pages → seu projeto → **Settings → Functions**
2. Em **KV namespace bindings** — pule
3. Em **Service bindings** — Clique **Add binding**:
   - Variable name: `WORKER`
   - Service: selecione `solar-orcamento-api`
4. Salve e faça **redeploy** (Deployments → Retry deployment)

> Alternativamente, no `wrangler.toml` você pode adicionar:
> ```toml
> [env.production]
> routes = [{ pattern = "SEU-DOMINIO.pages.dev/api/*", zone_name = "..." }]
> ```

---

## Passo 5 — Verificar se está funcionando

Acesse: `https://SEU-SITE.pages.dev/api/teste`

Deve retornar: `{"message":"Worker funcionando!"}`

---

## Desenvolvimento local

Para testar localmente sem o Cloudflare, você ainda pode rodar o servidor Node.js original:

```bash
cd sistema-orcamento-original
npm install
npm start
# Acesse http://localhost:3000
```

Para testar o Worker localmente:
```bash
wrangler dev
# Worker em http://localhost:8787
```

No `index.html`, adicione temporariamente antes do `</head>`:
```html
<script>window.API_BASE = 'http://localhost:8787';</script>
```

---

## Fluxo de dados

```
Browser
  → GET /api/equipamentos/placas
  → Cloudflare Pages (serve HTML/CSS/JS estático)
  → /api/* roteia para o Worker
  → Worker faz fetch para o GAS
  → GAS lê/escreve na Planilha do Drive
  → resposta volta até o Browser
```

---

## Atualizar o site (após o setup)

Basta fazer `git push`:

```bash
git add .
git commit -m "minha alteração"
git push
# Cloudflare Pages faz o redeploy automaticamente
```

---

## 🚀 v2.0 — Nova versão (index2.html)

Uma reconstrução completa do frontend, mantendo 100% intacto o backend (Google Apps Script + Google Drive), o Cloudflare Worker (`worker.js`) e as rotas `/api/*` (`functions/`).

**Acesse:** abra `frontend/index2.html` (mesmo domínio/deploy da v1 — nenhuma mudança de infraestrutura necessária).

### O que mudou
- **Dashboard novo** com KPIs em tempo real (placas, inversores, baterias, clientes, geração média, atividade recente).
- **CRUD unificado orientado a schema** (`v2/js/pages/cadastro.js`): Placas, Inversores, Baterias e Clientes usam o mesmo motor genérico, ao invés de 4 módulos duplicados.
- **Command Palette (Ctrl+K)** para navegar/buscar instantaneamente.
- **Gerador de Kits** redesenhado: cruza automaticamente placas × inversores compatíveis e ordena por R$/Wp.
- **Orçamento**: seleção via modal com busca, cálculo em tempo real, lista de orçamentos e **proposta comercial imprimível** (substitui o antigo botão de PDF que estava desativado).
- **Design system novo** (`v2/css/app.css`): tema escuro "solar", sidebar retrátil, responsivo mobile.
- **Campos avançados de placa** (horas efetivas, dias de geração, fator de perdas, margem de segurança) agora editáveis via UI — antes só existiam no banco.

### O que NÃO mudou (propositalmente)
- Endpoints, verbos HTTP e nomes de campos do `worker.js` e `gas/drive_db.gs`.
- Fórmulas de cálculo (`calcFatorGeracao`, `calcValorFinal`, `calcQtdModulos`, `calcQtdInversores`, lógica do gerador de kits) — preservadas para não alterar valores de orçamentos já em uso.
- Chave do ImgBB e fluxo de upload/redimensionamento de imagens.

A v1 (`index.html`) continua funcionando normalmente, sem qualquer alteração.
