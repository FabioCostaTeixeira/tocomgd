Multi-tenant + Multi-formato — Plano de Implementação Definitivo

Data: 2026-08-18
Projeto: Avatar
Fonte de verdade da implementação: este arquivo
Spec de design: docs/superpowers/specs/2026-08-18-multi-tenant-multi-format-design.md

Este plano deve ser executado task por task. Codex, Claude Code ou qualquer outro agente deve ler as Global Constraints, a task atual e suas dependências antes de alterar código. Não regenerar o roadmap em cada task.

1. Objetivo

Permitir que um único código e um único deploy atendam múltiplos clientes por slug:

avatar.app.br/gd
avatar.app.br/joao
avatar.app.br/pablo

Cada tenant possui identidade, textos, templates e formatos habilitados próprios.

Todos compartilham o mesmo core do editor:

importação e normalização de imagem;

EXIF;

movimento;

zoom;

rotação;

enquadramento;

Canvas;

preview;

exportação PNG;

invalidação de resultado;

proteção contra race conditions.

O produto suporta somente estes formatos oficiais:

ID

Dimensão

Proporção

quadrado

1080×1080

1:1

feed

1080×1350

4:5

story

1080×1920

9:16

Tenant habilita um subset. Tenant nunca define novas dimensões.

2. Arquitetura alvo

URL
│
├── /
│   └── landing comercial
│
└── /{slug}
    │
    ├── tenant.js
    │   ├── valida slug
    │   ├── carrega config
    │   ├── valida contrato
    │   └── resolve assets
    │
    └── bootstrap.js
        ├── aplica brand
        ├── inicia UI
        └── initEditor()
             │
             ├── templates[]
             ├── formats[]
             ├── FORMAT_DIMS
             ├── EXIF
             ├── zoom/rotação
             ├── Canvas
             └── PNG

Regra de ouro

O core não conhece nenhum cliente.

gd é apenas um tenant comum.

Logo, editor.js não pode conhecer:

gd
joao
pablo
rosa
azul
qualquer outro cliente ou template

Adicionar cliente, template ou asset não pode exigir alteração do core.

3. Global Constraints

Estas regras valem para todas as tasks.

3.1 Core

FORMAT_DIMS é o único dono das dimensões oficiais.

Nenhuma fórmula pode assumir canvas quadrado.

Template e formato são conceitos diferentes.

templates[] é a whitelist de publicação.

Mínimo de 1 template por tenant.

Máximo operacional recomendado: 20 templates.

Não criar enabled.

Não criar transformByFormat.

Troca de template preserva x, y, scale, rotation.

Troca de formato executa reset + autoFit.

Preview e export usam a mesma matemática.

WYSIWYG pixel-perfect permanece obrigatório.

3.2 Compatibilidade

Não alterar sem necessidade a lógica já validada de:

EXIF;

normalização de orientação;

rotação;

pinch/gestos;

zoom;

export com canvas.toBlob();

state/version invalidation;

race condition de exportação.

3.3 Tenant

slug: ^[a-z0-9-]+$;

reservados: admin, api, assets, static, tenants, login;

template id: ^[a-z0-9-]+$;

formatos não podem se repetir;

template ids não podem se repetir;

todo template deve possuir asset para cada formato habilitado;

defaults precisam existir;

config.json é dado público;

nenhum segredo pode existir em config;

config nunca pode executar código.

3.4 Assets

Asset declarado pelo tenant:

deve ser relativo;

não pode começar com /;

não pode conter \;

não pode conter ?, #, % ou :;

não pode conter segmentos . ou ..;

não pode ser URL externa;

deve ser montado internamente como /static/tenants/{slug}/{asset}?v={version}.

Não usar eval, Function, script em config ou import dinâmico dirigido pelo tenant.

3.5 Runtime e deploy

sem backend;

sem banco;

sem autenticação;

sem framework;

sem bundler;

sem build step;

hospedagem alvo: Cloudflare Workers Static Assets;

nenhum deploy real nesta entrega.

3.6 Política de falha

Build/release: todos os assets declarados por tenants reais precisam existir. O validator/gate final bloqueia a entrega se faltar arquivo.

Runtime:

config inválido → editor não inicia;

slug inválido/reservado → editor não inicia;

máscara default ausente → editor não inicia;

asset não-default que falhar durante seleção → seleção falha de forma controlada; download permanece bloqueado até existir uma máscara válida;

logo é opcional e não derruba o editor.

Essa distinção preserva fail-closed sem obrigar 60 downloads/HEAD requests no boot de um tenant com muitos templates.

4. Invariante de executabilidade

Obrigatória para o plano inteiro:

Ao final de cada task, o projeto deve continuar executável e testável.

Antes de cada commit:

toda dependência usada já precisa existir;

nenhuma importação pode apontar para arquivo futuro;

nenhuma rota pode depender de configuração futura;

implementação nova entra antes da antiga ser removida;

qualquer “virada” que não possa ser dividida com segurança deve ser uma única task atômica;

os testes previstos da task precisam passar.

Nunca criar a sequência:

Task A começa a usar X
...
Task F cria X

Sempre:

Task A cria X
Task B valida X
Task C passa a usar X

4.1. Implementation Lock

O plano continua orientado por contrato para economizar tokens, mas decisões cuja rederivação poderia gerar implementações diferentes entre Codex e Claude Code devem conter um bloco Implementation Lock.

Um Implementation Lock:

fixa a sequência semântica obrigatória;

pode usar pseudocódigo ou código canônico curto;

não precisa ser copiado literalmente se o código existente exigir adaptação;

não pode ter ordem/comportamento alterado sem atualizar a spec/plano;

existe apenas nos pontos arquiteturalmente sensíveis.

Tasks com Implementation Lock:

Task 2  — setFormat / geometria
Task 6  — resolveAssetPath
Task 7  — validateConfig / loadTenant
Task 8  — containment do servidor
Task 10 — bootstrap / initEditor / loading / race de máscara
Task 11 — regras de troca e sincronização de testes

O restante permanece diretivo para reduzir contexto e consumo de tokens.

5. Regra global de progresso

Vale para Codex, Claude Code ou qualquer agente.

Fonte de verdade

Este arquivo.

Antes de trabalhar:

ler o quadro de progresso;

identificar a primeira task pendente cujas dependências estejam concluídas;

não manter contagem paralela em conversa/memória.

Cálculo

progresso = tasks_concluidas / total_tasks * 100

O plano possui 16 tasks.

A barra possui 16 posições, uma por task.

concluída: //

pendente: ..

Assim não há arredondamento visual subjetivo.

Exemplo 4/16:

Progresso: [////////........................] 25%
Tasks: 4/16

Atualização

Atualizar somente quando:

uma task concluir;

uma task concluída voltar a pendente;

o número total de tasks mudar.

Uma task só fica concluída depois dos testes e critérios de aceite.

Resposta do agente ao concluir

Máximo 3 linhas:

✓ Task X concluída
Progresso: [////////........................] 25%
Tasks: 4/16

Não repetir roadmap.

Persistência obrigatória

A marcação da task e a barra devem ser alteradas antes do commit.

O arquivo deste plano deve entrar no mesmo commit da task.

Nunca:

código commitado
plano ainda antigo

6. Quadro de progresso

Progresso: [//..............................] 6.25%
Tasks: 1/16

#

Fase

Task

Status

1

0

Fixtures multi-formato

concluída

2

1

FORMAT_DIMS e geometria variável

pendente

3

1

Seletor de formato e preview responsivo

pendente

4

1

Exportação multi-formato

pendente

5

1

Matriz WYSIWYG multi-formato

pendente

6

2

tenant.js — slug e assets seguros

pendente

7

2

tenant.js — schema e carga

pendente

8

2

Servidor SPA local seguro

pendente

9

2

Tenants de referência + validator

pendente

10

3

Virada atômica: initEditor + templates + bootstrap + landing

pendente

11

3

Comportamento de troca sem sleeps

pendente

12

4

Testes de tenant, escala e isolamento

pendente

13

4

Verificador de migração

pendente

14

5

Cloudflare Workers Static Assets + public/

pendente

15

6

README e onboarding

pendente

16

7

Gate final de entrega

pendente

7. Estrutura alvo

Após a Task 14:

project/
├── public/
│   ├── index.html
│   ├── _headers
│   └── static/
│       ├── css/
│       │   └── style.css
│       ├── js/
│       │   ├── editor.js
│       │   ├── tenant.js
│       │   └── bootstrap.js
│       └── tenants/
│           ├── _template/
│           ├── gd/
│           └── joao/
│
├── tests/
│   ├── server.js
│   ├── tenant.test.js
│   ├── validate-tenant.js
│   ├── verify_migration.py
│   ├── harness.js
│   ├── run.js
│   ├── fixtures.py
│   └── fixtures/
│
├── docs/
├── wrangler.toml
├── requirements-dev.txt
└── README.md

gd não possui qualquer posição especial nessa estrutura.

FASE 0 — Base de teste

Task 1 — Fixtures multi-formato

Objetivo

Permitir desenvolver e testar feed e story sem depender das artes reais de cliente.

Dependências

Nenhuma.

Alterar

tests/fixtures.py

Criar

tests/test_fixtures_masks.py

tests/fixtures/masks/quadrado.png

tests/fixtures/masks/feed.png

tests/fixtures/masks/story.png

Implementação

Adicionar gerar_mascaras() com dimensões:

quadrado 1080×1080
feed     1080×1350
story    1080×1920

Cada fixture deve ter:

RGBA;

centro transparente;

bordas/elementos assimétricos suficientes para detectar flip/crop incorreto.

Testes

Preferir unittest da stdlib para não adicionar pytest só por esta task:

python -m unittest tests/test_fixtures_masks.py -v
python tests/fixtures.py

Validar:

os 3 arquivos existem;

dimensões corretas;

modo RGBA;

centro transparente.

Não alterar

editor.js;

EXIF;

export;

tenant.

Aceite

Fixtures determinísticas e testes verdes.

Commit

test: fixtures sinteticas por formato

FASE 1 — Core multi-formato

Task 2 — FORMAT_DIMS e geometria variável

Objetivo

Eliminar a premissa global SIZE = 1080.

Dependências

Task 1.

Alterar

static/js/editor.js

Produzir

FORMAT_DIMS = {
  quadrado: { width: 1080, height: 1080 },
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 }
}

e estado:

currentFormat
dims

Generalizar

tamanho do canvas;

centro inicial;

draw;

pointInCanvas;

autoFit;

clamp;

bbox rotacionada;

limites baseados em width/height.

Regra de troca

setFormat(formatId):

valida enum;

atualiza currentFormat/dims;

atualiza canvas;

invalida resultado;

zera rotação;

executa autoFit se houver pessoa;

desenha.

Nesta fase ainda não mexer em tenant.

Implementation Lock

A sequência semântica de setFormat() é obrigatória:

function setFormat(formatId) {
  if (!FORMAT_DIMS[formatId]) return;

  currentFormat = formatId;
  dims = FORMAT_DIMS[formatId];

  canvas.width = dims.width;
  canvas.height = dims.height;
  canvasWrap.style.setProperty("--canvas-aspect", `${dims.width} / ${dims.height}`);

  invalidateResult();

  if (personImage) {
    person.rotation = 0;
    autoFitPerson();
  } else {
    person = {
      x: dims.width / 2,
      y: dims.height / 2,
      scale: 1,
      rotation: 0,
    };
    draw();
  }
}

Nesta task ainda não existe máscara dinâmica. A recarga de máscara do novo formato entra somente na Task 10.

Não inverter a ordem entre atualização de dims, resize do canvas, invalidação e autoFit.

Testes

busca por \bSIZE\b deve retornar zero;

baseline quadrado existente continua pixel-perfect;

app continua executável após commit.

Não alterar

lógica EXIF;

algoritmo de rotação;

race condition;

templates fixos ainda existentes.

Aceite

Quadrado continua sem regressão e core aceita dimensões variáveis.

Commit

feat: geometria de canvas por formato

Task 3 — Seletor de formato e preview responsivo

Objetivo

Adicionar UI provisória para alternar os três formatos antes do multi-tenant.

Dependências

Task 2.

Alterar

index.html

static/css/style.css

static/js/editor.js

Implementar

#formatGrid;

chips/botões com data-format;

renderFormats(formatIds);

syncFormatChips();

--canvas-aspect.

Acessibilidade

role="radiogroup";

botões nativos;

role="radio";

aria-checked.

Preview

Proporção deriva do formato ativo.

Story não deve tornar controles inutilizáveis em tela baixa.

Evitar CSS que dependa de viewport de forma incompatível com navegadores móveis antigos; usar fallback seguro se dvh for usado.

Inicialização provisória

Até a Task 10:

renderFormats(Object.keys(FORMAT_DIMS))

Essa chamada provisória deve ser explicitamente removida na virada.

Testes

Manualmente/automação:

1:1;

4:5;

9:16;

troca executa autoFit;

resultado anterior é invalidado.

Aceite

Três formatos alternáveis, app executável.

Commit

feat: seletor de formato e preview responsivo

Task 4 — Exportação multi-formato

Objetivo

Exportar PNG nas dimensões do formato ativo.

Dependências

Tasks 2–3.

Alterar

static/js/editor.js

index.html

Regras

PNG final:

quadrado 1080×1080
feed     1080×1350
story    1080×1920

Rótulo de download acompanha dimensão.

Até a Task 10 podem existir identificadores provisórios neutros:

tenantSlug = cliente
currentTemplateId = modelo

Eles são obrigatoriamente removidos na Task 10.

Nome final

avatar-{tenant}-{template}-{format}-{width}x{height}.png

Testes

Exportar os três formatos e validar dimensão real do PNG.

Não alterar

A matemática da renderização entre preview e export.

Aceite

Dimensão e nome corretos, sem regressão no quadrado.

Commit

feat: exportacao png por formato

Task 5 — Matriz WYSIWYG multi-formato

Objetivo

Cobrir dimensões variáveis sem triplicar inutilmente a suíte.

Dependências

Tasks 1–4.

Alterar

tests/harness.js

tests/run.js

Matriz

Baseline quadrado:

13 fixtures

Amostra feed:

3 fixtures

Amostra story:

3 fixtures

Total:

19

A amostra deve cobrir:

imagem normal;

EXIF/orientação;

caso pesado/complexo.

Race condition

Executar em:

quadrado;

story.

Harness

runCase() recebe format.

selectFormat() deve esperar estado real do chip, não timeout fixo.

Aceite

19 casos
0 pixels diferentes
race verde em quadrado e story
nenhuma chamada /api

Commit

test: matriz wysiwyg multi-formato

FASE 2 — Infraestrutura de tenant

Task 6 — tenant.js: slug e resolução segura de assets

Objetivo

Criar primitivas puras de tenant antes de qualquer integração com o editor.

Dependências

Task 5.

Criar

static/js/tenant.js

tests/tenant.test.js

Exportar

TenantError
FORMAT_IDS
RESERVED_SLUGS
readSlug(pathname)
resolveAssetPath(slug, assetPath, version)

Slug

Aceitar somente:

^[a-z0-9-]+$

Template/asset safety

resolveAssetPath deve rejeitar:

vazio;

/...;

\;

?;

#;

%;

:;

//;

. como segmento;

.. como segmento;

URLs externas.

Cada segmento aceito deve usar somente caracteres seguros de arquivo:

^[A-Za-z0-9._-]+$

e não pode ser . ou ...

Produzir

/static/tenants/{slug}/{asset}?v={version}

Implementation Lock

A resolução de asset deve seguir esta lógica, sem normalizar silenciosamente entrada inválida:

function resolveAssetPath(slug, assetPath, version) {
  if (typeof assetPath !== "string" || assetPath.length === 0) {
    throw new TenantError("asset_invalido", "Asset vazio.");
  }

  if (
    assetPath.startsWith("/") ||
    assetPath.includes("\\") ||
    assetPath.includes("?") ||
    assetPath.includes("#") ||
    assetPath.includes("%") ||
    assetPath.includes(":") ||
    assetPath.startsWith("//")
  ) {
    throw new TenantError("asset_invalido", "Asset não relativo ou inseguro.");
  }

  const segments = assetPath.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        !/^[A-Za-z0-9._-]+$/.test(segment)
    )
  ) {
    throw new TenantError("asset_invalido", "Segmento de asset inválido.");
  }

  return `/static/tenants/${slug}/${assetPath}?v=${encodeURIComponent(version)}`;
}

Não usar new URL(assetPath, ...) para “corrigir” input do tenant. Entrada inválida deve falhar, não ser normalizada.

Testes mínimos

raiz → null;

primeiro segmento;

maiúscula rejeitada;

acento rejeitado;

reservado rejeitado;

path válido;

traversal simples;

barra invertida;

query/hash;

URL;

%2e%2e rejeitado por conter %.

Aceite

Testes Node verdes sem browser.

Commit

feat: primitivas seguras de tenant

Task 7 — tenant.js: schema e loadTenant

Objetivo

Validar integralmente o contrato de configuração.

Dependências

Task 6.

Alterar

static/js/tenant.js

tests/tenant.test.js

Produzir

validateConfig(raw, slug)
loadTenant(slug, fetchImpl)

Contrato

{
  "slug": "cliente",
  "version": "1",
  "brand": {},
  "formats": [],
  "templates": [],
  "defaults": {}
}

Regras

Obrigatórios:

slug;

version;

brand.name;

brand.primaryColor;

formats[];

templates[];

templates[].id;

templates[].name;

templates[].assets;

defaults.template;

defaults.format.

Cores

Aceitar somente HEX válido com:

3;

4;

6;

8 dígitos.

Regex equivalente:

^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$

IDs

Template id:

^[a-z0-9-]+$

Sem duplicados.

Formats:

ao menos 1;

enum válido;

sem duplicados.

Templates:

1..20;

todo formato habilitado precisa de asset.

Defaults:

template existente;

formato habilitado.

Brand

title fallback para name;

description fallback para vazio;

secondaryColor fallback seguro;

logo opcional.

loadTenant

Buscar exatamente:

/static/tenants/{slug}/config.json

Sem ?v.

Tratar:

rede;

404;

JSON inválido;

schema inválido.

Implementation Lock

validateConfig() deve executar validação antes de produzir URLs finais.

Sequência obrigatória:

raw é objeto
→ slug/version
→ brand
→ formats
→ templates + ids
→ assets completos por formato
→ defaults
→ resolver logo/assets
→ retornar TenantConfig normalizado

Não resolver assets antes de validar slug, version, formatos e ids.

loadTenant() deve seguir:

async function loadTenant(slug, fetchImpl = fetch) {
  const url = `/static/tenants/${slug}/config.json`;

  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new TenantError("rede", "Falha ao carregar tenant.");
  }

  if (!response.ok) {
    throw new TenantError(
      response.status === 404 ? "tenant_inexistente" : "http",
      `Falha HTTP ${response.status}`
    );
  }

  let raw;
  try {
    raw = await response.json();
  } catch {
    throw new TenantError("json_invalido", "config.json inválido.");
  }

  return validateConfig(raw, slug);
}

Não adicionar query string ao config.json.

Testes

Cobrir todos os erros acima e confirmar que assets resolvidos recebem version.

Aceite

Schema fail-closed e teste unitário verde.

Commit

feat: contrato fail-closed de tenant

Task 8 — Servidor SPA local seguro

Objetivo

Testar /gd, /joao e / localmente sem depender de Cloudflare.

Dependências

Task 7.

Criar

tests/server.js

tests/server.test.js se necessário para manter verificação pequena e determinística.

Regras

servir arquivo existente;

rota sem extensão inexistente → index.html, HTTP 200;

arquivo inexistente com extensão → 404;

config → Cache-Control: public, max-age=0, must-revalidate;

impedir saída da raiz.

Segurança de path

Não usar somente:

alvo.startsWith(base)

Usar path.relative() e rejeitar quando:

resultado inicia em ..;

resultado é absoluto.

Implementation Lock

Containment da raiz deve usar path.relative():

function pathDentroDaRaiz(base, alvo) {
  const relativo = path.relative(base, alvo);
  return relativo === "" || (!relativo.startsWith("..") && !path.isAbsolute(relativo));
}

Fluxo do servidor:

parse URL
→ decode pathname
→ resolver alvo
→ containment check
→ arquivo existente: servir
→ rota sem extensão: index.html
→ restante: 404

Não usar alvo.startsWith(base) como controle de segurança.

Testes

/gd → 200 index
/static/js/tenant.js → 200
/static/js/inexistente.js → 404
traversal → 403/404

Aceite

SPA local espelha comportamento futuro sem path traversal.

Commit

test: servidor spa local seguro

Task 9 — Tenants de referência + validator real

Objetivo

Criar tenants reais/fictícios antes da virada do editor e validar configs/assets no disco.

Dependências

Tasks 1, 7 e 8.

Criar

static/tenants/gd/
static/tenants/joao/
static/tenants/_template/
tests/validate-tenant.js

GD

Tenant comum.

Publicar inicialmente:

formats: ["quadrado"]
templates:
- rosa
- azul

Mover artes quadradas existentes para dentro de static/tenants/gd.

Nenhum tratamento especial no core.

João

Tenant fictício de teste.

Publicar:

formats:
- quadrado
- feed
- story

templates:
- principal

Usar fixtures sintéticas.

_template

Modelo de cópia operacional.

Não precisa ser tenant navegável.

Seu slug interno pode continuar _template, desde que o validator tenha modo explícito de template ou não tente tratá-lo como URL real.

Validator

Criar:

node tests/validate-tenant.js gd
node tests/validate-tenant.js joao

Ele deve:

localizar config real;

executar validateConfig;

converter URLs resolvidas novamente para caminhos locais de forma controlada ou validar a partir do raw config;

confirmar existência de todos os assets declarados;

confirmar logo se declarada;

sair != 0 em erro.

Esse validator é o responsável por garantir todos os assets sem custo de preflight no browser.

Aceite

gd OK
joao OK

e validator falha ao remover artificialmente um asset em teste.

Commit

feat: tenants de referencia e validator

FASE 3 — Virada multi-tenant

Task 10 — Virada atômica: initEditor + templates dinâmicos + bootstrap + landing

Objetivo

Remover clientes/templates hardcoded e ligar a aplicação ao TenantConfig sem deixar commit intermediário quebrado.

Dependências

Tasks 2–9.

Esta task é atômica

Ela pode ser maior que as demais porque separar suas mudanças faria o index.html apontar para módulos incompletos.

Não quebrar em commits intermediários.

Alterar

static/js/editor.js

index.html

static/css/style.css

Criar

static/js/bootstrap.js

editor.js

Converter para ES module:

export async function initEditor({
  slug,
  templates,
  formats,
  defaultTemplate,
  defaultFormat
})

Remover do core

rosa;

azul;

gd;

radios fixos;

maskImages fixo;

maskReady fixo;

selectedMask;

valores provisórios cliente/modelo;

inicialização automática da IIFE.

Estado genérico

templateById
currentTemplateId
currentFormat
currentMask
maskCache
maskRequestVersion
maskState

Loading seguro da máscara

Obrigatório para evitar nova race condition.

Ao iniciar troca de template/formato:

incrementar maskRequestVersion;

definir currentMask = null;

maskState = loading;

invalidar resultado;

bloquear download;

iniciar loadMask(template, format);

no retorno, comparar requestVersion e seleção atual;

resposta obsoleta é descartada;

resposta atual define currentMask;

maskState = ready;

desenhar;

liberar download.

Em erro atual:

maskState = error
currentMask = null
download bloqueado
mensagem controlada

Não permitir exportar com máscara antiga.

Sinal observável

Manter um estado DOM simples para testes, por exemplo:

canvas.dataset.maskState = loading|ready|error

Isso substitui sleep(400) em testes.

Templates

renderTemplates() usa templates[].

Quantidade variável:

1
2
5
10
...

Sem alteração do core.

Carregamento de máscaras sob demanda; não baixar 20×3 PNGs no boot.

setTemplate

valida id;

preserva person;

atualiza seleção;

carrega máscara do mesmo formato;

não executa autoFit.

setFormat

valida enum habilitado;

muda dims;

reset + autoFit;

carrega máscara do template atual;

não restaura estado anterior.

HTML

Na mesma task:

#appLoading;

#templateGrid vazio;

#formatGrid;

#tenantError;

#landing;

#appShell;

#brandLogo;

#brandTitle;

#brandDescription;

script type="module" apontando para bootstrap.js.

Estado inicial do documento:

appLoading visível
appShell oculto
landing oculta
tenantError oculto

Exemplo mínimo:

<section id="appLoading" class="app-loading" aria-live="polite">
  <p>Carregando editor...</p>
</section>

<section id="tenantError" hidden>
  <h1 id="tenantErrorTitle">Cliente não encontrado</h1>
  <p id="tenantErrorText">Verifique o endereço e tente novamente.</p>
</section>

<section id="landing" hidden>
  <h1>Avatar</h1>
  <p>Personalize sua campanha.</p>
  <p>Em breve.</p>
</section>

<main id="appShell" hidden>
  ...
</main>

Não é necessário spinner sofisticado.

Landing entra nesta task, não em task posterior, para que / nunca fique em branco após a virada.

Loading também entra nesta task para que rede lenta ou download da máscara default nunca resulte em tela branca.

CSS

--brand-primary;

--brand-secondary;

remover seletores de rosa/azul;

tela de erro;

landing;

template cards dinâmicos.

bootstrap.js

Responsabilidades exclusivas:

mostrar loading imediatamente;

readSlug;

se raiz → encerrar loading e mostrar landing;

loadTenant;

aplicar brand;

await initEditor;

mostrar app somente após inicialização bem-sucedida e máscara default pronta;

erro técnico no console;

encerrar loading e mostrar erro controlado em qualquer falha.

Default mask ausente deve impedir abertura do app.

Logo ausente é não-bloqueante.

Implementation Lock — estado global da aplicação

Estados permitidos:

loading
landing
app
error

Somente um pode estar visível por vez.

Funções canônicas:

function showLoading() {
  appLoading.hidden = false;
  appShell.hidden = true;
  landing.hidden = true;
  tenantError.hidden = true;
}

function showLanding() {
  appLoading.hidden = true;
  appShell.hidden = true;
  tenantError.hidden = true;
  landing.hidden = false;
}

function showApp() {
  appLoading.hidden = true;
  landing.hidden = true;
  tenantError.hidden = true;
  appShell.hidden = false;
}

function showError(code) {
  appLoading.hidden = true;
  landing.hidden = true;
  appShell.hidden = true;
  tenantError.hidden = false;
  // mensagem pública controlada; detalhe técnico fica no console
}

Fluxo obrigatório do bootstrap:

async function bootstrap() {
  showLoading();

  try {
    const slug = readSlug(window.location.pathname);

    if (slug === null) {
      showLanding();
      return;
    }

    const tenant = await loadTenant(slug);

    applyBrand(tenant.brand);

    await initEditor({
      slug: tenant.slug,
      templates: tenant.templates,
      formats: tenant.formats,
      defaultTemplate: tenant.defaults.template,
      defaultFormat: tenant.defaults.format,
    });

    showApp();
  } catch (error) {
    console.error(error);
    showError(error instanceof TenantError ? error.code : "padrao");
  }
}

Não exibir appShell antes de await initEditor() resolver.

Implementation Lock — inicialização do editor

initEditor() só pode resolver quando a máscara default estiver pronta:

export async function initEditor({
  slug,
  templates,
  formats,
  defaultTemplate,
  defaultFormat,
}) {
  // construir estado genérico
  // registrar listeners
  // renderizar templates/formatos

  renderTemplates();
  renderFormats(formats);

  setFormatState(defaultFormat); // estado/dimensões, sem carga duplicada
  currentTemplateId = defaultTemplate;

  await applyMask(currentTemplateId, currentFormat);

  if (maskState !== "ready" || !currentMask) {
    throw new Error("Máscara default não ficou pronta.");
  }

  draw();
}

Evitar chamar applyMask() duas vezes durante bootstrap.

Implementation Lock — race da máscara

let maskRequestVersion = 0;
let maskState = "idle";

async function applyMask(templateId, formatId) {
  const requestVersion = ++maskRequestVersion;

  currentMask = null;
  maskState = "loading";
  canvas.dataset.maskState = "loading";
  invalidateResult();
  syncDownloadAvailability();

  try {
    const image = await loadMask(templateId, formatId);

    if (
      requestVersion !== maskRequestVersion ||
      templateId !== currentTemplateId ||
      formatId !== currentFormat
    ) {
      return false;
    }

    currentMask = image;
    maskState = "ready";
    canvas.dataset.maskState = "ready";
    draw();
    syncDownloadAvailability();
    return true;
  } catch (error) {
    if (requestVersion !== maskRequestVersion) return false;

    currentMask = null;
    maskState = "error";
    canvas.dataset.maskState = "error";
    syncDownloadAvailability();

    // O throw é intencional:
    // - initEditor aguarda a máscara default e deve falhar fechado;
    // - trocas posteriores tratam a Promise no chamador.
    throw error;
  }
}

syncDownloadAvailability() deve impedir download quando:

maskState !== ready
ou
currentMask === null
ou
isBusy === true

Não manter a máscara anterior visível durante uma troca em andamento.

Implementation Lock — tratamento de erro por contexto

applyMask() não deve engolir a falha, porque a máscara default faz parte da inicialização fail-closed.

Na inicialização:

await applyMask(defaultTemplate, defaultFormat);

Se falhar, a rejeição sobe para initEditor() e depois para bootstrap(), que encerra o loading e mostra tenantError.

Em ações do usuário, a falha deve ser tratada pelo chamador para nunca gerar unhandled promise rejection.

setTemplate() permanece síncrona:

function setTemplate(templateId) {
  const template = templateById.get(templateId);
  if (!template || templateId === currentTemplateId) return;

  currentTemplateId = templateId;
  syncTemplateCards();
  invalidateResult();

  applyMask(currentTemplateId, currentFormat).catch((error) => {
    console.error(error);
    showToast("Não foi possível carregar a arte deste modelo.", "error");
  });
}

setFormat() segue a mesma regra:

function setFormat(formatId) {
  if (!formats.includes(formatId) || formatId === currentFormat) return;

  currentFormat = formatId;
  dims = FORMAT_DIMS[formatId];

  canvas.width = dims.width;
  canvas.height = dims.height;
  canvasWrap.style.setProperty("--canvas-aspect", `${dims.width} / ${dims.height}`);

  invalidateResult();

  if (personImage) {
    person.rotation = 0;
    autoFitPerson();
  } else {
    person = {
      x: dims.width / 2,
      y: dims.height / 2,
      scale: 1,
      rotation: 0,
    };
    draw();
  }

  syncFormatChips();

  applyMask(currentTemplateId, currentFormat).catch((error) => {
    console.error(error);
    showToast("Não foi possível carregar a arte deste formato.", "error");
  });
}

Não transformar setTemplate()/setFormat() em async apenas por conveniência se os handlers de UI não precisarem aguardar seu retorno. O contrato é: iniciar a troca, bloquear download via maskState, e tratar a Promise explicitamente.

Uma falha em template/formato não-default deve resultar em:

maskState = error
currentMask = null
download bloqueado
toast controlado
erro técnico no console
app continua ativo
nenhuma unhandled promise rejection

Testes

Antes do commit:

node tests/server.js 8000
node tests/run.js http://127.0.0.1:8000/joao

e:

grep -nE "['\"](gd|rosa|azul)['\"]" static/js/editor.js

esperado: zero.

Adicionar teste de bootstrap com fetch/carregamento deliberadamente atrasado ou inspeção via CDP para provar:

durante carga → appLoading visível
antes da máscara default pronta → appShell oculto
sucesso → appLoading oculto + appShell visível
erro → appLoading oculto + tenantError visível
raiz → appLoading oculto + landing visível

Aceite

/ mostra landing;

/joao inicia;

/gd inicia;

rede lenta nunca produz tela branca;

appShell só aparece após máscara default pronta;

máscara default está ready antes de download;

nenhum cliente/template no core;

19 WYSIWYG continuam verdes.

Commit

refactor: core multi-tenant com bootstrap atomico

Task 11 — Comportamento de troca sem sleeps

Objetivo

Provar explicitamente as duas regras de UX sem depender de waits arbitrários.

Dependências

Task 10.

Alterar

tests/harness.js

tests/run.js

tests/compare.py somente se a comparação visual continuar sendo a forma mais simples.

Não usar

sleep(400)
setTimeout arbitrário

Esperar:

data-mask-state === "ready"

e estado do seletor.

Implementation Lock

Os testes não podem inferir “pronto” por tempo.

Helper canônico:

async function waitForMaskReady(cdp, timeoutMs) {
  await waitForCondition(
    cdp,
    `document.querySelector("canvas")?.dataset.maskState === "ready"`,
    timeoutMs
  );
}

Após clicar em template ou formato:

esperar aria-checked correto
→ esperar maskState ready
→ somente então capturar preview/estado

Não usar sleep(400) ou timeout equivalente.

A implementação de produção deve obedecer:

setTemplate:
  não toca em person
  muda template
  invalida resultado
  inicia applyMask do mesmo formato
  trata rejeição com catch + toast

setFormat:
  muda formato/dims
  reset rotation
  autoFit
  invalida resultado
  inicia applyMask do novo formato
  trata rejeição com catch + toast

Somente initEditor() aguarda applyMask() diretamente, porque a máscara default precisa participar do fail-closed de inicialização.

Teste A — template preserva

Rodar contra:

/gd

porque possui dois templates reais:

rosa → azul

No mesmo quadrado.

Comparar pessoa/enquadramento antes/depois, ignorando a região da moldura.

Não trocar formato neste teste.

Teste B — formato reseta

Rodar contra:

/joao

porque possui:

quadrado
feed
story

Fluxo:

quadrado
→ alterar zoom/posição/rotação
→ story

Confirmar:

dimensões mudaram;

rotação volta ao default;

estado foi autoFit;

não houve restore de coordenadas anteriores.

Aceite

As duas regras passam de forma independente.

Commit

test: regras deterministicas de troca

FASE 4 — Validação, escala e isolamento

Task 12 — Testes de tenant, escala e isolamento

Objetivo

Validar isolamento entre clientes e comportamento com diferentes quantidades de templates.

Dependências

Task 11.

Alterar

tests/harness.js

tests/run.js

tests/tenant.test.js quando for teste puramente estrutural.

Casos de rota

/gd → sucesso
/joao → sucesso
/inexistente → erro
/admin → erro reservado
/Joao → erro slug
/ → landing

Isolamento bidirecional

Validar:

/joao não requisita /tenants/gd/
/gd não requisita /tenants/joao/

Também comparar:

título;

primaryColor;

templates;

formatos.

Quantidade de templates

Não criar novo tenant físico apenas para isso.

Usar config sintético/unitário ou fixture temporária para validar:

1 template
2 templates
5 templates

Se útil, testar 10 sem pixel matrix.

Objetivo: garantir que core/renderização não dependa de quantidade fixa.

Config inválido

Cobrir:

campo obrigatório ausente;

formato inválido;

formato duplicado;

template duplicado;

template id inválido;

asset parcial;

default inexistente;

cor inválida;

asset path inseguro.

Asset inexistente

validator de tenant precisa falhar;

runtime default inexistente precisa falhar fechado;

asset lazy inexistente precisa gerar erro controlado e manter download bloqueado;

asset lazy inexistente deve exibir toast apropriado;

não pode ocorrer unhandledrejection.

No teste browser, registrar temporariamente:

window.__unhandledRejections = [];
window.addEventListener("unhandledrejection", (event) => {
  window.__unhandledRejections.push(String(event.reason));
});

Após forçar falha de template/formato não-default, o array deve permanecer vazio.

Aceite

Unitários + integração verdes, isolamento nos dois sentidos.

Commit

test: tenant escala fail-closed e isolamento

Task 13 — Verificador de migração

Objetivo

Criar guardrails estáticos para impedir regressões arquiteturais.

Dependências

Task 12.

Alterar

tests/verify_migration.py

Verificações

Core sem tenant

Buscar somente literais delimitados no core:

"gd"
"rosa"
"azul"

Não procurar substring solta.

Não buscar em tenants/tests onde são legítimos.

Sem SIZE fixo

const SIZE proibido;

dimensões oficiais só em FORMAT_DIMS.

A checagem deve ser robusta o suficiente para não reprovar texto de UI legítimo como nome de download; prefira parsing/regex do bloco quando necessário em vez de “qualquer linha contendo 1080”.

Sem backend antigo em runtime

Proibir no app:

/api/render
FormData usado para render server-side
fetch de endpoint de render

Config não executa código

Proibir:

eval(
new Function(

e qualquer import dinâmico derivado de config.

Core sem caminhos de tenant

editor.js não deve montar /static/tenants/....

Isso pertence a tenant.js.

Aceite

python tests/verify_migration.py verde.

Commit

test: guardrails de arquitetura multi-tenant

FASE 5 — Cloudflare

Task 14 — Workers Static Assets + public/

Objetivo

Preparar estrutura de produção sem executar deploy.

Dependências

Task 13.

Esta task é uma migração de caminhos

Antes do commit, fazer inventário de todos os consumidores de:

index.html
static/

e atualizar todos no mesmo commit.

Mover

index.html → public/index.html
static/ → public/static/

Criar

public/_headers

wrangler.toml

requirements-dev.txt se Python/Pillow continuar necessário somente para testes.

Remover legado de runtime

Se ainda existirem e não forem usados por testes:

app.py;

Dockerfile;

Procfile;

vercel.json;

.vercelignore.

requirements.txt de produção deve ser removido/substituído por requirements-dev.txt se suas únicas dependências restantes forem ferramentas de teste como Pillow.

Não remover Python/Pillow dos testes.

Atualizar obrigatoriamente

tests/server.js → default public/;

tests/tenant.test.js → import de public/static/js/tenant.js;

tests/validate-tenant.js → raiz public/static/tenants;

tests/verify_migration.py → public/static/js;

qualquer script/comando que leia static/ diretamente.

Antes do commit:

grep -R "static/js\|static/tenants\|index.html" tests -n

revisar cada ocorrência conscientemente.

wrangler.toml

name = "avatar"
compatibility_date = "2026-08-18"

[assets]
directory = "./public"
not_found_handling = "single-page-application"

_headers

Incluir no mínimo:

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'

/static/tenants/:slug/config.json
  Cache-Control: public, max-age=0, must-revalidate

JS/CSS também podem permanecer revalidáveis.

Não aplicar immutable ao config.json.

CSP

Testar efetivamente:

upload;

preview;

object URLs;

download;

máscaras;

logo.

Não endurecer CSP além do que o app testado suporta nesta entrega.

Testes

Após mover:

node tests/server.js 8000
node --test tests/tenant.test.js
node tests/validate-tenant.js gd
node tests/validate-tenant.js joao
node tests/run.js http://127.0.0.1:8000/joao
python tests/verify_migration.py

Aceite

Tudo verde depois da mudança para public/.

Commit

chore: preparar workers static assets

FASE 6 — Documentação

Task 15 — README e onboarding

Objetivo

Transformar cadastro de cliente em procedimento operacional replicável.

Dependências

Task 14.

Alterar

README.md

Seções

O que é Avatar.

Arquitetura.

gd como tenant comum, sem tratamento especial.

Estrutura de diretórios.

Como rodar localmente.

Formatos oficiais.

Contrato config.json.

Como adicionar cliente.

Como adicionar template.

Como habilitar formato.

Version/cache.

Segurança.

Testes.

Cloudflare Workers Static Assets.

Deploy futuro — deixar claro que não foi executado.

Onboarding correto após public/

1. copiar public/static/tenants/_template para public/static/tenants/<slug>
2. definir slug
3. editar config
4. trocar logo
5. adicionar templates
6. adicionar um asset por formato habilitado em cada template
7. revisar defaults
8. incrementar version se asset mudou
9. rodar node tests/validate-tenant.js <slug>
10. rodar testes focados
11. commit/push

Não usar o caminho antigo static/tenants/_template.

Checklist

Incluir:

slug;

config válido;

assets existentes;

logo;

templates;

formatos;

defaults;

upload;

zoom;

rotação;

export;

isolamento;

version.

Remover documentação obsoleta

Não deixar instrução operacional de:

Flask;

Gunicorn;

/api/render;

Vercel;

backend Python.

Pode existir apenas menção histórica claramente marcada, se realmente útil.

Aceite

Uma pessoa técnica consegue cadastrar novo tenant sem editar editor.js.

Commit

docs: onboarding multi-tenant do avatar

FASE 7 — Gate final

Task 16 — Gate final de entrega

Objetivo

Garantir que 100% significa feature validada, não apenas “último arquivo editado”.

Dependências

Tasks 1–15.

Não implementar feature nova

Se algo falhar:

corrigir a task responsável;

se necessário, reabrir a task correspondente;

não esconder correção dentro do gate.

Rodar

Unitários

node --test tests/tenant.test.js

e demais unitários existentes.

Validator

node tests/validate-tenant.js gd
node tests/validate-tenant.js joao

WYSIWYG

node tests/run.js http://127.0.0.1:8000/joao

Esperado:

13 quadrado
3 feed
3 story
race quadrado/story
0 pixels diferentes

Tenant real de dois templates

Executar teste focado de:

/gd
rosa → azul

confirmando preservação de enquadramento.

Formato

Executar teste focado de:

/joao
quadrado → story

confirmando reset + autoFit.

Guardrails

python tests/verify_migration.py

Rotas

Confirmar:

/             landing
/gd           editor
/joao         editor
/inexistente  erro
/admin        erro
/Joao         erro

Segurança/runtime

Confirmar:

sem request /api/*;

sem asset cross-tenant;

CSP não quebra preview/download;

default mask ausente falha fechado;

lazy mask ausente bloqueia download;

nenhum segredo em configs.

Git

git status --short

Esperado: apenas alterações conscientemente previstas; idealmente limpo após commit.

Critérios finais

/gd e /joao usam o mesmo core.

gd não possui regra especial no core.

nenhum tenant/template hardcoded em editor.js.

1, 2 e 5 templates funcionam.

quadrado 1080×1080.

feed 1080×1350.

story 1080×1920.

WYSIWYG pixel-perfect.

EXIF preservado.

zoom preservado.

rotação preservada.

race de export preservada.

race de máscara protegida.

nenhuma falha de máscara não-default gera unhandled promise rejection.

loading global evita tela branca e app parcial.

app só aparece após máscara default pronta.

template preserva enquadramento.

formato reseta + autoFit.

configs inválidos falham fechado.

isolamento bidirecional.

validator confirma assets reais.

landing funciona.

public/ é única raiz publicável.

Workers Static Assets preparado.

backend legado removido.

README correto.

deploy não executado.

Conclusão

Somente após tudo verde:

Progresso: [////////////////////////////////] 100%
Tasks: 16/16

Commit

test: gate final multi-tenant e multi-formato

O arquivo deste plano precisa ser incluído no mesmo commit com Task 16 marcada como concluída.

8. Política de execução para agentes

Para economizar tokens:

Antes de uma task

Ler apenas:

Global Constraints;

Invariante de executabilidade;

Regra de progresso;

task atual;

interfaces/arquivos diretamente consumidos.

Não reler o plano inteiro salvo se houver conflito.

Durante

se a task possuir Implementation Lock, seguir sua sequência semântica obrigatória;

não rederivar outra arquitetura para o mesmo comportamento;

alterar somente arquivos da task;

exceção: correção mínima indispensável para manter executabilidade;

não refatorar “por oportunidade”;

não introduzir dependência nova sem necessidade;

não reescrever lógica validada;

executar teste focado primeiro;

suíte ampla somente quando a task exigir.

Depois

verificar aceite;

rodar testes;

atualizar task/barra;

incluir plano no commit;

responder em até 3 linhas.

Quando descobrir problema no plano

Não improvisar uma arquitetura nova.

Procedimento:

parar a task
→ registrar conflito objetivo
→ propor menor correção de plano
→ corrigir ordem/contrato
→ só então continuar

Exceção: correção trivial dentro do escopo que não muda contrato.

9. Fora de escopo

Não implementar:

painel admin;

cadastro em banco;

autenticação;

login;

cobrança;

API;

KV;

D1;

R2;

domínio próprio por tenant;

formato customizado;

editor de template;

persistência de enquadramento por formato;

deploy Cloudflare real.

A decisão de não persistir enquadramento por formato é consciente:

quadrado → story → quadrado

executa novo autoFit ao voltar.

Se usuários reais considerarem isso ruim, transformByFormat poderá ser uma feature separada no futuro.

10. Contrato final de exemplo

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
  "formats": ["quadrado"],
  "templates": [
    {
      "id": "rosa",
      "name": "Modelo Rosa",
      "assets": {
        "quadrado": "masks/rosa/quadrado.png"
      }
    },
    {
      "id": "azul",
      "name": "Modelo Azul",
      "assets": {
        "quadrado": "masks/azul/quadrado.png"
      }
    }
  ],
  "defaults": {
    "template": "rosa",
    "format": "quadrado"
  }
}

Este exemplo pertence ao tenant gd; não constitui regra do core.

11. Definição de sucesso

A implementação estará pronta quando:

novo cliente
     ↓
copiar _template
     ↓
editar config
     ↓
adicionar logo/templates/assets
     ↓
validar
     ↓
commit/push
     ↓
avatar.app.br/<slug>

sem qualquer alteração no editor.js.

Esse é o critério arquitetural principal da feature.
