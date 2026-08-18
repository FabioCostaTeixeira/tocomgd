# Multi-tenant + Multi-formato — Design e Plano de Implementação

**Data:** 2026-08-18

## 1. Objetivo

Evoluir o Avatar para que **um único código e um único deploy** atendam múltiplos clientes por URL:

```text
avatar.app.br/gd
avatar.app.br/joao
avatar.app.br/pablo
```

Cada tenant terá:

* identidade visual própria;
* nome, logo, cores e textos;
* templates/modelos próprios;
* formatos habilitados próprios.

Todos compartilharão o mesmo core:

* carregamento e normalização de imagem;
* EXIF;
* movimentação;
* zoom;
* rotação;
* enquadramento;
* exportação;
* tratamento de concorrência/race condition.

O editor também passa a suportar três formatos oficiais.

---

# 2. Princípios obrigatórios

## 2.1 Core independente de tenant

O core nunca deve conhecer:

```text
gd
joao
pablo
rosa
azul
```

Nenhum nome, cor, logo ou template específico pode ficar hardcoded no editor.

Toda personalização entra através de `TenantConfig`.

---

## 2.2 Separar template de formato

São conceitos diferentes.

### Template

Exemplo:

```text
Rosa
Azul
Principal
Campanha A
```

### Formato

```text
quadrado
feed
story
```

Uma combinação final é:

```text
Template Rosa + Story
Template Rosa + Feed
Template Azul + Story
```

Nunca tratar `quadrado`, `feed` ou `story` como se fossem templates.

---

## 2.3 Formatos são definidos pelo core

Enum fechado:

| ID         |  Dimensão | Proporção |
| ---------- | --------: | --------: |
| `quadrado` | 1080×1080 |       1:1 |
| `feed`     | 1080×1350 |       4:5 |
| `story`    | 1080×1920 |      9:16 |

O tenant apenas habilita formatos.

Ele **não define dimensões arbitrárias**.

```javascript
FORMAT_DIMS = {
  quadrado: { width: 1080, height: 1080 },
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 }
}
```

---

# 3. Contrato do tenant

Estrutura recomendada:

```json
{
  "slug": "gd",
  "version": "1",

  "brand": {
    "name": "GD",
    "title": "Monte sua foto com GD!",
    "description": "Escolha um modelo e personalize sua foto.",
    "primaryColor": "#ff4fa3",
    "secondaryColor": "#2458ff",
    "logo": "logo.png"
  },

  "formats": [
    "quadrado",
    "feed",
    "story"
  ],

  "templates": [
    {
      "id": "rosa",
      "name": "Modelo Rosa",
      "assets": {
        "quadrado": "masks/rosa/quadrado.png",
        "feed": "masks/rosa/feed.png",
        "story": "masks/rosa/story.png"
      }
    },
    {
      "id": "azul",
      "name": "Modelo Azul",
      "assets": {
        "quadrado": "masks/azul/quadrado.png",
        "feed": "masks/azul/feed.png",
        "story": "masks/azul/story.png"
      }
    }
  ],

  "defaults": {
    "template": "rosa",
    "format": "quadrado"
  }
}
```

## 3.1 Templates são uma lista aberta

A quantidade de templates não é fixa. Um tenant pode ter 1, 2, 8 ou 10.

A própria lista `templates[]` funciona como whitelist de publicação:

```text
está em templates[]  → publicado, aparece na interface
não está            → não existe para o cliente final
```

Não existe campo `enabled`. Isso economiza código, validação e estado.

Limites: mínimo 1, máximo recomendado 20.

## 3.2 Situação inicial do tenant `gd`

Hoje existem apenas `rosa/quadrado.png` e `azul/quadrado.png`.

Como configuração parcial é proibida (§4), `gd` entra em produção com:

```json
"formats": ["quadrado"]
```

Quando as artes de feed e story ficarem prontas, basta acrescentá-las ao
array e subir os assets. O desenvolvimento do core não depende do
designer — as fixtures sintéticas da Fase 0 cobrem feed e story.

---

# 4. Regras de validação

`tenant.js` deve validar completamente o arquivo antes de inicializar o editor.

Obrigatórios:

```text
slug
version

brand.name
brand.primaryColor

formats[]

templates[]
templates[].id
templates[].name
templates[].assets

defaults.template
defaults.format
```

## Regras adicionais

### Slug

Regex:

```text
^[a-z0-9-]+$
```

Reservados:

```text
admin
api
assets
static
tenants
login
```

---

### Formats

Todos devem existir em `FORMAT_DIMS`.

Exemplo inválido:

```json
"formats": ["quadrado", "banner"]
```

---

### Templates

`id` deve ser único dentro do tenant.

Para cada formato habilitado, todo template deve possuir um asset correspondente.

Exemplo:

```text
Tenant habilita:
quadrado
story
```

Então:

```text
rosa
├── quadrado
└── story

azul
├── quadrado
└── story
```

Não permitir configuração parcial.

---

### Defaults

```text
defaults.template
```

deve apontar para um template existente.

```text
defaults.format
```

deve apontar para um formato habilitado.

---

# 5. Segurança do TenantConfig

`config.json` é **público**.

Nunca armazenar nele:

* senhas;
* tokens;
* API keys;
* credenciais;
* dados pessoais privados;
* secrets.

Assets devem usar caminhos relativos ao próprio tenant.

Permitido:

```text
masks/rosa/story.png
logo.png
```

Não permitir:

```text
../gd/logo.png
/static/tenants/gd/...
https://externo.com/imagem.png
```

O sistema deve montar internamente:

```text
/static/tenants/{slug}/{asset}
```

Isso reduz:

* path traversal;
* acesso acidental entre tenants;
* dependência externa;
* erro operacional.

Nenhuma configuração de tenant pode executar código.

Proibido:

```text
eval
Function()
scripts definidos em config
dynamic import vindo do config
```

---

# 6. Estrutura de arquivos

Estrutura final (após a Fase 5, que move os arquivos publicáveis para
`public/` — ver §18):

```text
public/
│
├── index.html
├── _headers
│
└── static/
    │
    ├── tenants/
    │   │
    │   ├── _template/
    │   │   ├── config.json
    │   │   ├── logo.png
    │   │   └── masks/
    │   │       └── principal/
    │   │           ├── quadrado.png
    │   │           ├── feed.png
    │   │           └── story.png
    │   │
    │   ├── gd/
    │   │   ├── config.json
    │   │   ├── logo.png
    │   │   └── masks/
    │   │       ├── rosa/
    │   │       │   └── quadrado.png
    │   │       └── azul/
    │   │           └── quadrado.png
    │   │
    │   └── joao/
    │       ├── config.json
    │       ├── logo.png
    │       └── masks/
    │
    ├── js/
    │   ├── tenant.js
    │   ├── bootstrap.js
    │   └── editor.js
    │
    └── css/
        └── style.css
```

Fora de `public/` (não publicado):

```text
tests/
docs/
wrangler.toml
README.md
```

O `gd` aparece acima apenas com `quadrado.png` por template — reflete o
estado real dos assets hoje (§3.2). As artes de feed e story entram
quando o designer entregar.

---

# 7. Fluxo de inicialização

```text
location.pathname
        ↓
extrair primeiro segmento
        ↓
validar slug
        ↓
loadTenant(slug)
        ↓
fetch config.json
        ↓
validar contrato
        ↓
resolver assets
        ↓
aplicar brand
        ↓
renderizar templates
        ↓
renderizar formatos
        ↓
initEditor()
```

Contrato:

```javascript
const tenant = await loadTenant(slug);

initEditor({
  tenant,
  formats: tenant.formats,
  templates: tenant.templates,
  defaultFormat: tenant.defaults.format,
  defaultTemplate: tenant.defaults.template
});
```

---

# 8. Tratamento de erro

Aplicar política **fail closed**.

Se ocorrer:

* tenant inexistente;
* slug inválido;
* slug reservado;
* JSON inválido;
* contrato incompleto;
* formato inválido;
* default inexistente;
* template incompleto;
* asset obrigatório ausente;

então:

```text
editor NÃO inicializa
```

Exibir uma tela controlada:

```text
Cliente não encontrado
ou
Não foi possível carregar esta configuração.
```

Não exibir stack trace ou detalhes internos para o usuário final.

Detalhes técnicos podem ir para `console.error()` em desenvolvimento.

---

# 9. Raiz do domínio

```text
avatar.app.br/
```

não deve tentar resolver tenant.

Mostrar página comercial mínima:

```text
Avatar
Personalize sua campanha.

Em breve.
```

Isso preserva `/` para futura landing page do produto.

---

# 10. Multi-formato no core

Remover dependência da constante fixa:

```javascript
SIZE = 1080
```

Toda matemática deve receber:

```javascript
currentFormat.width
currentFormat.height
```

Revisar:

* canvas;
* preview;
* `fitInside`;
* `autoFit`;
* clamp de posição;
* clamp de zoom;
* `bboxGirado`;
* centralização;
* exportação;
* guides;
* cálculo de escala.

Nenhuma fórmula deve assumir canvas quadrado.

---

# 11. Estado de edição entre formatos

Regra única e explícita:

```text
trocar TEMPLATE  → preserva x, y, scale, rotation
trocar FORMATO   → reset + autoFit, sempre
```

Não existe `transformByFormat`. Voltar de `story` para `quadrado`
executa um novo `autoFit` — não restaura o enquadramento anterior.

## Por que

Coordenadas salvas em um aspect ratio não são válidas em outro. Guardar e
restaurar exigiria re-clamp de posição, re-clamp de zoom, revalidação de
bbox rotacionada e uma classe inteira de casos de teste de coordenadas
incompatíveis. O ganho de UX não paga esse custo nesta fase.

## Decisão consciente

O usuário perde o enquadramento ao alternar formatos. Isso é aceito
deliberadamente, não é um esquecimento. Se em uso real isso se mostrar
incômodo, `transformByFormat` pode voltar depois como feature isolada — o
contrato do tenant e a arquitetura do core não impedem essa evolução.

---

# 12. Troca de template

Trocar:

```text
Rosa → Azul
```

dentro do mesmo formato não deve alterar:

```text
posição
zoom
rotação
```

Apenas a arte sobreposta muda.

---

# 13. Troca de formato

Exemplo:

```text
Quadrado → Story
```

Procedimento:

```text
alterar dimensões do canvas
↓
carregar asset Story do template atual
↓
reset do estado (x, y, scale, rotation)
↓
autoFit
↓
redesenhar
```

Sempre reset + autoFit, independentemente de o formato já ter sido
visitado antes. Ver §11.

---

# 14. Interface

Separar claramente:

## 1. Modelo

```text
[ Rosa ] [ Azul ]
```

## 2. Formato

```text
[ Quadrado ] [ Feed ] [ Story ]
```

Mostrar apenas formatos habilitados pelo tenant.

## 3. Editor

```text
Canvas
Zoom
Rotação
Centralizar
Trocar foto
Download
```

---

# 15. Preview responsivo

O preview deve acompanhar a proporção ativa:

```text
quadrado → 1 / 1
feed     → 4 / 5
story    → 9 / 16
```

Evitar dimensões CSS hardcoded duplicadas.

O CSS deve receber uma variável ou atributo derivado do formato ativo.

---

# 16. Exportação

O canvas usado para export deve ter exatamente:

```text
quadrado → 1080×1080
feed     → 1080×1350
story    → 1080×1920
```

Nome:

```text
avatar-{tenant}-{template}-{format}-{width}x{height}.png
```

Exemplo:

```text
avatar-gd-rosa-story-1080x1920.png
```

Preview e export devem continuar usando a mesma matemática.

---

# 17. Cache

## Ordem de carregamento

```text
config.json (sem query string)
      ↓
lê tenant.version
      ↓
logo.png?v={version}
masks/rosa/story.png?v={version}
```

Nunca requisitar `config.json?v={version}` — `version` só é conhecido
depois de ler o próprio arquivo.

## Política do config.json

O `config.json` deve permanecer sempre revalidável. Não aplicar cache
`immutable` nem TTL longo a configurações de tenant.

O Workers Static Assets já serve por padrão com revalidação e `ETag`.
Ainda assim, declarar a política explicitamente em `_headers`, para que
ela faça parte do contrato da aplicação e sobreviva a qualquer tentativa
futura de "otimizar o cache":

```text
/static/tenants/:slug/config.json
  Cache-Control: public, max-age=0, must-revalidate
```

## Assets

Assets (logo, máscaras) recebem `?v={tenant.version}`. O `version` deve
ser incrementado sempre que um asset do tenant for substituído.

---

# 18. Cloudflare

Preparar para:

```text
Cloudflare Workers + Static Assets
```

Não usar Cloudflare Pages como arquitetura nova principal.

## Diretório público

Os arquivos publicáveis passam a viver em `public/`, separados de código,
testes e documentação:

```text
public/
├── index.html
├── _headers
└── static/
    ├── js/
    ├── css/
    ├── img/
    └── tenants/
```

Fora de `public/` (não publicado): `tests/`, `docs/`, `__pycache__/`,
`requirements-dev.txt`, `README.md`.

Isso evita publicar acidentalmente arquivos do repositório e não
introduz framework, bundler ou build step.

## wrangler.toml

```toml
[assets]
directory = "./public"
not_found_handling = "single-page-application"
```

O `single-page-application` faz `/gd` e `/joao` retornarem o mesmo
`index.html`, com o tenant resolvido no cliente.

Não executar deploy real nesta entrega.

---

# 19. Segurança de hospedagem

Headers declarados em `public/_headers`.

## Content-Security-Policy

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:;
connect-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
```

`img-src` precisa de `blob:` e `data:` — o app manipula URLs de blob no
preview e na exportação. `img-src 'self'` sozinho quebraria o produto.

Validar a CSP no navegador antes de endurecê-la mais.

## Demais headers

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Evitar dependências externas. HTML, CSS, JS, fonts, logos e máscaras
devem ser servidos pelo próprio domínio.

---

# 20. Ordem de implementação

A entrega deve ser dividida internamente para facilitar diagnóstico e reduzir retrabalho.

## Fase 0 — Fixtures multi-formato

Criar molduras sintéticas de teste, sem depender do designer:

```text
tests/fixtures/masks/
├── quadrado.png   1080×1080
├── feed.png       1080×1350
└── story.png      1080×1920
```

PNGs simples (moldura de teste com marcadores geométricos, no mesmo
padrão já usado para validar orientação EXIF).

### Critério

Desenvolvimento do core deixa de depender das artes definitivas do GD.

---

## Fase 1 — Multi-formato

Alterar apenas o core.

Implementar:

```text
FORMAT_DIMS
canvas variável
bbox variável
clamp variável
fit variável
preview variável
export variável
```

Manter inicialmente os templates atuais.

### Critério

Os três formatos funcionam sem regressão no editor.

---

## Fase 2 — Templates dinâmicos

Remover:

```text
rosa
azul
```

hardcoded do core.

Criar estrutura genérica:

```javascript
templates[]
currentTemplate
```

### Critério

Editor funciona com 1, 2, 5 ou 10 templates sem alteração do core.

---

## Fase 3 — Multi-tenant

Criar:

```text
tenant.js
bootstrap.js
TenantConfig
```

Implementar:

```text
/gd
/joao
```

### Critério

Mesmo core, identidades completamente diferentes.

---

## Fase 4 — Validação e isolamento

Implementar:

* schema;
* slugs;
* reservados;
* assets relativos;
* validação de templates;
* validação de formatos;
* erros controlados.

### Critério

Config inválida nunca inicializa parcialmente o editor.

---

## Fase 5 — Cloudflare Workers + Static Assets

Adicionar somente estrutura e configuração:

```text
public/
_headers
wrangler.toml
SPA fallback
documentação
```

Sem deploy.

---

## Fase 6 — README

Documentar:

```text
arquitetura
estrutura
como rodar
como adicionar tenant
como adicionar template
como trocar assets
como habilitar formatos
como incrementar version
como testar
como publicar
```

---

# 21. Testes

Manter testes pequenos e focados.

Evitar duplicar casos que exercitam a mesma lógica.

## Matriz WYSIWYG

Não triplicar a suíte existente. Baseline completo em quadrado, amostra
estratégica nos demais:

```text
QUADRADO → 13 fixtures  (baseline completo de regressão)
FEED     →  3 fixtures
STORY    →  3 fixtures
─────────────────────────
total    → 19 execuções   (em vez de 39)
```

As 3 fixtures de feed e story devem ser escolhidas para cobrir eixos
distintos:

```text
1. imagem normal
2. caso EXIF/orientação relevante
3. rotação + zoom + enquadramento complexo
```

Cobrir em todos os formatos: fit, clamp, rotação, export, WYSIWYG.

---

## Race condition

Executar pelo menos:

```text
1 formato quadrado
1 formato não quadrado
```

para confirmar independência de dimensões fixas.

---

## Tenants

```text
/gd
→ sucesso

/joao
→ sucesso

/inexistente
→ erro controlado

/admin
→ slug reservado

/Joao
→ slug inválido
```

---

## Configuração

Testar:

* campo obrigatório ausente;
* format inválido;
* template duplicado;
* template sem asset obrigatório;
* default template inexistente;
* default format inexistente;
* asset inválido;
* tentativa de `../`;
* URL externa.

---

## Isolamento

`/joao` nunca pode carregar:

```text
logo GD
cores GD
textos GD
templates GD
```

E vice-versa.

---

## Quantidades

Testar tenants com:

```text
1 formato
3 formatos

1 template
2 templates
5 templates
```

Testes de tenant, configuração, isolamento e quantidades são estruturais.
Não repetir comparação pixel-perfect para cada cliente.

---

# 22. Verificação de migração

Estender os verificadores existentes.

Objetivo: detectar **tenant ou template hardcoded no core**, não qualquer
sequência de letras.

Buscar strings delimitadas por aspas, não substrings soltas:

```text
["']gd["']
["']rosa["']
["']azul["']
```

Nunca fazer `if "gd" in editor_js` — `gd` casa dentro de identificadores
comuns e gera falso positivo.

Confirmar também ausência de:

```text
/api/
1080×1080 como premissa fixa
```

A dimensão `1080` pode continuar presente dentro de `FORMAT_DIMS`.

Não bloquear strings que apareçam apenas em fixtures ou em arquivos de
tenant — a verificação se aplica ao core.

---

# 23. README — cadastro de novo cliente

O README deve estabelecer o procedimento oficial:

```text
1. copiar tenants/_template
2. escolher slug
3. editar config.json
4. adicionar logo
5. adicionar templates
6. adicionar assets de cada formato
7. definir defaults
8. incrementar version quando necessário
9. rodar validação/testes
10. commit
11. push
```

Adicionar checklist antes da publicação.

---

# 24. Template oficial

Criar:

```text
static/tenants/_template/
```

O template deve ser válido e mínimo.

Objetivo:

> cadastrar cliente novo sem modificar código do core.

---

# 25. Otimização de implementação

Para reduzir custo, tokens e risco durante desenvolvimento:

1. não refatorar arquivos não relacionados;
2. não alterar lógica de EXIF/rotação já validada sem necessidade;
3. reutilizar funções existentes;
4. criar funções pequenas com responsabilidade única;
5. evitar abstrações prematuras;
6. não introduzir framework novo;
7. não introduzir banco;
8. não introduzir backend;
9. não introduzir autenticação;
10. não introduzir build complexo se não for necessário;
11. executar testes focados após cada fase;
12. atualizar documentação junto da feature, não depois.

---

# 26. Estratégia para agentes de IA

Cada etapa deve ser fornecida ao agente como tarefa isolada.

Evitar prompts como:

> Implemente todo o multi-tenant e multi-formato.

Preferir:

```text
Task 1:
generalizar dimensões do canvas.

Não alterar tenant.
Não alterar EXIF.
Não alterar export além do necessário.
Execute os testes X e Y.
```

Depois:

```text
Task 2:
remover templates hardcoded.

Não implementar tenant ainda.
```

Isso reduz:

* tokens;
* diffs grandes;
* regressões;
* contexto desnecessário;
* chance de o agente reescrever código funcionando.

---

# 27. Fora de escopo

Não implementar nesta entrega:

* painel administrativo;
* banco de dados;
* login;
* autenticação;
* cadastro via interface;
* cobrança;
* API;
* Cloudflare KV;
* Cloudflare D1;
* Cloudflare R2;
* deploy real;
* domínio customizado por cliente;
* formatos arbitrários;
* templates criados pelo usuário.

---

# 28. Critérios finais de aceite

A entrega só está concluída quando:

* `/gd` funciona;
* `/joao` funciona;
* ambos usam o mesmo editor;
* identidade e assets ficam isolados;
* nenhum tenant está hardcoded no core;
* templates são dinâmicos;
* formatos são dinâmicos dentro do enum oficial;
* quadrado exporta 1080×1080;
* feed exporta 1080×1350;
* story exporta 1080×1920;
* preview e download continuam equivalentes;
* EXIF continua funcionando;
* zoom continua funcionando;
* rotação continua funcionando;
* race condition continua corrigida;
* trocar template preserva enquadramento;
* trocar formato executa reset + autoFit;
* configurações inválidas falham de forma controlada;
* novo cliente pode ser criado sem alterar `editor.js`;
* README documenta completamente o onboarding técnico;
* arquivos publicáveis estão isolados em `public/`;
* `_headers` declara CSP compatível com `blob:`/`data:` e política de
  revalidação do `config.json`;
* projeto está preparado para Cloudflare Workers + Static Assets;
* nenhum backend é necessário.

## Arquitetura final esperada

```text
                    AVATAR CORE
                        │
        ┌───────────────┼────────────────┐
        │               │                │
       GD             João             Pablo
        │               │                │
   TenantConfig     TenantConfig      TenantConfig
        │               │                │
        └───────────────┬────────────────┘
                        │
                 Template selecionado
                        │
                   Formato ativo
                        │
               ┌────────┼─────────┐
               │        │         │
           Quadrado    Feed      Story
               │        │         │
               └────────┼─────────┘
                        │
                     Editor
                        │
          x / y / scale / rotation
                        │
                     Canvas
                        │
                    PNG final
```

**Regra de ouro:** adicionar cliente, template ou asset nunca deve exigir alterar o core do editor.
