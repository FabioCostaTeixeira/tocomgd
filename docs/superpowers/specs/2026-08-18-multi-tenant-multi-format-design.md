# Multi-tenant + Multi-formato — Design

Data: 2026-08-18

## Objetivo

Permitir um único deploy atender múltiplos clientes via slug de URL
(`avatar.app.br/joao`, `avatar.app.br/pablo`), cada um com sua identidade
visual (nome, logo, cores, textos) e conjunto próprio de máscaras — mas
todos compartilhando o mesmo core do editor (zoom, rotação, EXIF, export).

Ao mesmo tempo, o editor passa a suportar 3 formatos de exportação
(quadrado, feed, story) em vez de apenas 1080×1080 fixo.

Preparar tudo para hospedagem em Cloudflare Pages, sem realizar o deploy
nesta entrega.

## Regra central

O core do editor nunca deve conhecer um cliente específico. Identidade
visual, textos e máscaras entram exclusivamente via configuração de tenant
carregada antes da inicialização do editor.

## Formatos suportados

Enum fixo, dimensões definidas no core (não no tenant):

| format     | dimensões  | proporção |
|------------|------------|-----------|
| `quadrado` | 1080×1080  | 1:1       |
| `feed`     | 1080×1350  | 4:5       |
| `story`    | 1080×1920  | 9:16      |

Tenant habilita um subset (mínimo 1) e fornece a arte (PNG) de cada
formato habilitado. Tenant não pode inventar dimensão nova.

## Estrutura de arquivos

```
static/
├── tenants/
│   ├── _template/
│   │   ├── config.json
│   │   ├── logo.png
│   │   └── masks/{quadrado,feed,story}.png
│   ├── gd/                    # cliente atual, migrado
│   │   ├── config.json        # 3 formatos habilitados
│   │   ├── logo.png
│   │   └── masks/{quadrado,feed,story}.png  # artes rosa/azul viram 2 variações por formato — ver nota
│   └── joao/                  # tenant fictício, prova de isolamento
│       ├── config.json        # 1-2 formatos habilitados, cores/logo diferentes
│       ├── logo.png
│       └── masks/...
├── js/
│   ├── tenant.js       # NOVO — resolve slug, fetch/valida config
│   ├── bootstrap.js    # NOVO — orquestra tenant → brand → masks → editor
│   └── editor.js       # core, generalizado p/ formato variável
index.html               # genérico, sem radio/img fixos
_redirects                # NOVO — Cloudflare Pages SPA fallback
wrangler.toml (ou equivalente Pages config) # NOVO, preparado, sem deploy
```

**Nota sobre `gd`**: hoje existem 2 modelos (rosa/azul), cada um só em
quadrado. Ao migrar, `gd` recebe os 3 formatos com a arte disponível
adaptada/replicada para feed e story (trabalho de arte, não só código).
Se a arte não estiver pronta a tempo, `gd` pode ir para produção só com
`quadrado` habilitado — o contrato já suporta isso.

## Contrato `config.json`

```json
{
  "slug": "joao",
  "version": "1",
  "brand": {
    "name": "João",
    "title": "Monte sua foto com João!",
    "description": "Escolha um modelo e personalize sua foto.",
    "primaryColor": "#2458ff",
    "secondaryColor": "#ffffff",
    "logo": "logo.png"
  },
  "masks": [
    { "format": "quadrado", "name": "Quadrado", "file": "masks/quadrado.png" },
    { "format": "story", "name": "Story", "file": "masks/story.png" }
  ],
  "defaults": {
    "mask": "quadrado"
  }
}
```

Campos obrigatórios: `slug`, `brand.name`, `brand.primaryColor`, `masks[]`
(mínimo 1), `masks[].format` (enum válido), `masks[].name`, `masks[].file`,
`defaults.mask` (deve apontar para um `format` presente em `masks[]`).

## Fluxo de bootstrap

```
location.pathname
  → slug (primeiro segmento da URL)
  → validar contra regex ^[a-z0-9-]+$ e lista de reservados
  → fetch /static/tenants/{slug}/config.json?v={version}
  → validar contrato (Task 3)
  → aplicar CSS variables (--brand-primary, --brand-secondary)
  → gerar cards de máscara dinamicamente a partir de tenant.masks
  → initEditor({ masks: tenant.masks, defaultMask: tenant.defaults.mask })
```

Falha em qualquer etapa (slug reservado, tenant inexistente, config
inválido) → tela "Cliente não encontrado", editor nunca inicializa.

Raiz (`/`) sem slug → placeholder comercial estático simples ("Produto
Avatar em breve"), servido antes do bootstrap rodar — não passa pelo fluxo
de erro de tenant.

Slugs reservados: `admin, api, assets, static, tenants, login`.

## Mudanças no core (`editor.js`)

- `SIZE` (constante 1080) vira `currentFormat.width/height`, resolvido a
  partir do formato ativo (`FORMAT_DIMS` fixo no core: quadrado/feed/story).
- `bboxGirado`, `clamp` (posição/zoom da pessoa), `fitInside`, export
  (`canvas.width/height`) passam a usar as dimensões do formato ativo em
  vez da constante fixa.
- Trocar de formato reseta/recalcula fit e posição da pessoa — mesma
  lógica hoje aplicada à troca de máscara, generalizada para formato.
- Preview: `aspect-ratio` do container CSS muda conforme o formato ativo
  (hoje fixo 1:1).
- Nome do arquivo exportado: `arte-campanha-{tenant}-{format}-{w}x{h}.png`.
- `maskImages`, `maskReady` fixos (`rosa`/`azul`) somem — passam a ser
  construídos dinamicamente a partir de `tenant.masks` recebido via
  `initEditor()`.
- Zoom, rotação manual, EXIF, invalidação de resultado (state versioning)
  e a correção de race condition da entrega anterior **não mudam de
  lógica** — só passam a operar sobre dimensões variáveis em vez de fixas.

## Validação (Task 3)

`tenant.js` valida o config antes de qualquer chamada de bootstrap.
Qualquer campo obrigatório ausente, `format` fora do enum, ou
`defaults.mask` sem correspondência em `masks[]` → erro tratado, mensagem
clara ao usuário, editor não inicializa.

## Cache (Task 10)

`config.json` carrega `version`. Assets (logo, máscaras) são referenciados
com `?v={version}` para evitar cache stale de CDN/navegador quando o
cliente troca uma arte.

## Testes

Estende `tests/run.js` / `tests/harness.js`:

- WYSIWYG pixel-perfect por formato habilitado no tenant `gd` (que terá os
  3 formatos) — reaproveita fixtures existentes, adiciona parâmetro
  `format` em `runCase()`.
- Race condition (canvas.toBlob() + mutação durante export) — já coberta,
  roda contra pelo menos 1 formato não-quadrado para confirmar que a
  correção não dependia de `SIZE` fixo.
- Casos de tenant: `/gd` (ok), `/joao` (ok), `/inexistente` (erro), slug
  reservado (erro), config inválido (campo obrigatório faltando, `format`
  inválido, `defaults.mask` sem correspondência), asset de máscara/logo
  inexistente (erro tratado, não crash).
- Isolamento: `/joao` não pode carregar logo, cores, textos ou máscaras de
  `/gd`, e vice-versa.
- `python tests/verify_migration.py` estendido para confirmar ausência de
  `rosa`/`azul` hardcoded em `editor.js` e ausência de `/api/*` (regra já
  existente, mantida).

## Cloudflare Pages — preparação (sem deploy)

- `_redirects`: `/* /index.html 200` (SPA fallback, slug resolvido em JS).
- Config de Pages (`wrangler.toml` ou equivalente) commitada, apontando
  build/output estático (sem functions/workers nesta fase — decisão do
  design: roteamento client-side puro).
- README ganha seção "Deploy Cloudflare Pages" com passo a passo, mas
  nenhum deploy real é executado nesta entrega.

## Fora de escopo desta entrega

- Deploy real em Cloudflare (Task 8-10 do plano do cliente ficam
  preparados, não executados).
- Painel administrativo / cadastro de clientes via banco de dados.
- Autenticação/login de tenant.
- Mais de 3 formatos ou formatos customizáveis por tenant.
