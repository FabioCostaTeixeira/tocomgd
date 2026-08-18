# Multi-tenant + Multi-formato — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um único deploy atende múltiplos clientes por slug de URL, com identidade e templates próprios, sobre um core de editor genérico que exporta em três formatos oficiais.

**Architecture:** O core (`editor.js`) deixa de conhecer cliente, template ou dimensão fixa: recebe tudo por `initEditor()`. Um módulo `tenant.js` resolve o slug da URL, carrega e valida `config.json`, e um `bootstrap.js` aplica marca, renderiza templates/formatos e inicializa o editor. Sem backend, sem banco, sem build step.

**Tech Stack:** HTML/CSS/JS puro (ES modules), Canvas 2D, Node 18+ para testes (CDP sobre Chrome headless), Python 3 + Pillow para fixtures e comparação pixel-perfect, Cloudflare Workers Static Assets para hospedagem.

**Spec:** `docs/superpowers/specs/2026-08-18-multi-tenant-multi-format-design.md`

## Global Constraints

- Formatos são enum fechado do core: `quadrado` 1080×1080, `feed` 1080×1350, `story` 1080×1920. Tenant só habilita, nunca define dimensão.
- O core nunca pode conter `'gd'`, `'rosa'`, `'azul'` ou qualquer nome de cliente/template hardcoded.
- Template e formato são conceitos distintos. `quadrado`/`feed`/`story` nunca são templates.
- Trocar template preserva `x`, `y`, `scale`, `rotation`. Trocar formato executa reset + `autoFit`, sempre.
- Não existe `transformByFormat`. Decisão consciente (spec §11).
- `templates[]` é a whitelist de publicação. Sem campo `enabled`. Mínimo 1, máximo recomendado 20.
- Configuração parcial é proibida: todo template deve ter asset para todo formato habilitado.
- Fail closed: qualquer erro de slug, config ou asset obrigatório impede a inicialização do editor.
- Assets sempre relativos ao tenant. Proibido `../`, caminho absoluto e URL externa.
- `config.json` é público. Nunca conterá segredo, token ou credencial.
- Nenhuma configuração de tenant pode executar código (`eval`, `Function()`, import dinâmico).
- `config.json` é carregado sem query string; `version` só é lido depois. Assets recebem `?v={version}`.
- Preview e export usam a mesma matemática. WYSIWYG pixel-perfect é inegociável.
- Não introduzir framework, bundler, build step, backend, banco ou autenticação.
- Não alterar a lógica já validada de EXIF, rotação e race condition sem necessidade.

## Regra global de progresso

Vale para qualquer agente que execute este plano, incluindo Codex e Claude Code.

**Fonte de verdade:** este arquivo. Antes de atualizar, ler o estado existente. Não manter contagem paralela.

**Cálculo:** exclusivamente por tasks concluídas.

```text
progresso = tasks_concluidas / total_tasks * 100
```

Nunca usar estimativa subjetiva.

**Barra:** 10 posições, cada uma valendo 10%. Concluída `//`, pendente `..`.

**Quando atualizar:** somente quando (1) uma task for concluída, (2) uma task concluída voltar a pendente por falha ou revisão, (3) o plano ganhar ou perder tasks, (4) houver mudança real no total de trabalho. Nunca durante passos internos da mesma task.

**Uma task só conta como concluída** depois de atender seus critérios de aceite e passar nos testes previstos. Task parcialmente executada continua pendente.

**Ao concluir uma task,** atualizar o quadro abaixo e exibir no final da resposta apenas:

```text
✓ Task X concluída
Progresso: [////////////........] 60%
Tasks: 12/20
```

Máximo 3 linhas. Não narrar percentual durante a execução, não repetir lista de tasks concluídas, não regerar roadmap para informar progresso.

## Quadro de progresso

```text
Progresso: [....................] 0%
Tasks: 0/16
```

| # | Fase | Task | Status |
|---|------|------|--------|
| 1 | 0 | Fixtures multi-formato | pendente |
| 2 | 1 | FORMAT_DIMS e geometria variável | pendente |
| 3 | 1 | Seletor de formato e preview responsivo | pendente |
| 4 | 1 | Exportação multi-formato | pendente |
| 5 | 1 | Matriz de teste multi-formato | pendente |
| 6 | 3 | tenant.js — slug e resolução de assets | pendente |
| 7 | 3 | tenant.js — validação de schema | pendente |
| 8 | 3 | Servidor de desenvolvimento com SPA fallback | pendente |
| 9 | 3 | Tenants gd, joao e _template | pendente |
| 10 | 2+3 | Virada: initEditor, templates dinâmicos e bootstrap | pendente |
| 11 | 2 | Regra de preservação de enquadramento | pendente |
| 12 | 3 | Raiz do domínio | pendente |
| 13 | 4 | Testes de tenant e isolamento | pendente |
| 14 | 4 | Verificador de migração | pendente |
| 15 | 5 | Cloudflare Workers Static Assets | pendente |
| 16 | 6 | README | pendente |

**Nota de ordenação:** a Fase 3 (infraestrutura de tenant) vem antes da Fase 2 (templates dinâmicos) de propósito. `tenant.js`, o servidor com SPA fallback e os arquivos de tenant são independentes do core e precisam existir antes da virada, senão o `index.html` passaria várias tasks apontando para um `bootstrap.js` inexistente e o app ficaria inexecutável no meio do plano. A Task 10 é a única virada e é atômica por necessidade: separar HTML, `initEditor` e `bootstrap` deixaria o produto quebrado entre commits.

---

## Estrutura de arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `static/js/tenant.js` | Slug, fetch, validação de contrato, resolução de caminho de asset. Sem DOM. |
| `static/js/bootstrap.js` | Orquestra: slug → tenant → marca → templates/formatos → `initEditor`. Único dono da tela de erro. |
| `tests/server.js` | Servidor estático local com SPA fallback, para testar `/gd` e `/joao`. |
| `tests/tenant.test.js` | Testes unitários em Node das funções puras de `tenant.js`. |
| `static/tenants/{_template,gd,joao}/config.json` + assets | Configuração por cliente. |
| `public/_headers` | CSP, cache do `config.json`, headers de segurança. |
| `wrangler.toml` | Configuração Workers Static Assets. |

**Modificados**

| Arquivo | Mudança |
|---|---|
| `static/js/editor.js` | Deixa de ser IIFE auto-executável e passa a exportar `initEditor()`. Dimensões variáveis, templates dinâmicos. |
| `index.html` | Remove radios e `<img>` de máscara fixos. Ganha containers vazios, tela de erro e landing. |
| `static/css/style.css` | `aspect-ratio` via variável, limite de altura para story, cores via variáveis de marca. |
| `tests/fixtures.py` | Gera molduras sintéticas por formato. |
| `tests/harness.js` | `runCase()` aceita `format`; novo `inspectTenant()`. |
| `tests/run.js` | Matriz 13+3+3, race em formato não quadrado, casos de tenant. |
| `tests/compare.py` | Modo `--centro` para comparar enquadramento. |
| `tests/verify_migration.py` | Verificação por string delimitada. |
| `README.md` | Arquitetura, onboarding de cliente, deploy. |

---

# FASE 0 — Fixtures

### Task 1: Fixtures multi-formato

Molduras sintéticas de teste para que o desenvolvimento do core não dependa das artes definitivas do designer.

**Files:**
- Modify: `tests/fixtures.py`
- Create: `tests/test_fixtures_masks.py`
- Create (gerados): `tests/fixtures/masks/{quadrado,feed,story}.png`

**Interfaces:**
- Consumes: nada.
- Produces: `gerar_mascaras()` grava três PNGs RGBA em `tests/fixtures/masks/`, um por formato, nomeados com o id do formato.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/test_fixtures_masks.py`:

```python
from pathlib import Path

from PIL import Image

import fixtures

MASKS = Path(__file__).parent / "fixtures" / "masks"
ESPERADO = {
    "quadrado.png": (1080, 1080),
    "feed.png": (1080, 1350),
    "story.png": (1080, 1920),
}


def test_gera_mascara_por_formato():
    fixtures.gerar_mascaras()

    for nome, (largura, altura) in ESPERADO.items():
        caminho = MASKS / nome
        assert caminho.exists(), f"{nome} não foi gerado"
        with Image.open(caminho) as img:
            assert img.size == (largura, altura)
            assert img.mode == "RGBA", "máscara precisa de canal alfa"


def test_mascara_tem_centro_transparente():
    """A moldura não pode cobrir o centro, senão a pessoa some do preview."""
    fixtures.gerar_mascaras()

    with Image.open(MASKS / "quadrado.png") as img:
        assert img.getpixel((540, 540))[3] == 0
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `python -m pytest tests/test_fixtures_masks.py -v`
Expected: FAIL com `AttributeError: module 'fixtures' has no attribute 'gerar_mascaras'`

- [ ] **Step 3: Implementar `gerar_mascaras()`**

Acrescentar a `tests/fixtures.py`, antes do bloco `if __name__ == "__main__":`:

```python
MASKS_OUT = OUT / "masks"

# Formatos oficiais. Precisa espelhar FORMAT_DIMS de static/js/editor.js.
FORMATOS = {
    "quadrado": (1080, 1080),
    "feed": (1080, 1350),
    "story": (1080, 1920),
}


def gerar_mascaras() -> None:
    """Molduras sintéticas de teste, uma por formato.

    Borda opaca colorida + faixa inferior + centro transparente. A borda
    prova que a máscara foi desenhada nas dimensões certas; a faixa dá
    assimetria vertical, denunciando flip de eixo; o centro transparente
    garante que a pessoa continua visível no preview.
    """
    MASKS_OUT.mkdir(parents=True, exist_ok=True)

    for nome, (w, h) in FORMATOS.items():
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        borda = max(8, min(w, h) // 40)
        d.rectangle([0, 0, w - 1, h - 1], outline=(255, 90, 160, 255), width=borda)

        faixa = h // 12
        d.rectangle([0, h - faixa, w, h], fill=(36, 88, 255, 255))

        img.save(MASKS_OUT / f"{nome}.png")
```

E acrescentar a chamada dentro do `if __name__ == "__main__":` existente, junto das demais gerações:

```python
    gerar_mascaras()
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `python -m pytest tests/test_fixtures_masks.py -v`
Expected: PASS, 2 testes

- [ ] **Step 5: Gerar as fixtures e conferir no disco**

Run: `python tests/fixtures.py && python -c "import os;print(sorted(os.listdir('tests/fixtures/masks')))"`
Expected: `['feed.png', 'quadrado.png', 'story.png']`

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures.py tests/test_fixtures_masks.py tests/fixtures/masks
git commit -m "test: molduras sinteticas por formato (fase 0)"
```

---

# FASE 1 — Core multi-formato

### Task 2: FORMAT_DIMS e geometria variável

Elimina a premissa de canvas quadrado. Nenhuma fórmula pode assumir `SIZE`.

**Files:**
- Modify: `static/js/editor.js:4` (constante `SIZE`), `:62` (estado inicial), `:83-95` (`clampPerson`), `:157-179` (`draw`), `:203-222` (`autoFitPerson`), `:227-232` (`pointInCanvas`)

**Interfaces:**
- Consumes: nada.
- Produces: `FORMAT_DIMS` (objeto congelado com `quadrado`/`feed`/`story`, cada um `{width, height}`); `currentFormat` (string); `dims` (dimensões do formato ativo); `setFormat(formatId)` que troca o canvas e reenquadra.

- [ ] **Step 1: Substituir `SIZE` pelas dimensões do formato**

Em `static/js/editor.js`, trocar a linha 4:

```js
  const SIZE = 1080;
```

por:

```js
  // Formatos oficiais. Enum fechado: o tenant habilita, nunca define dimensão.
  const FORMAT_DIMS = Object.freeze({
    quadrado: Object.freeze({ width: 1080, height: 1080 }),
    feed: Object.freeze({ width: 1080, height: 1350 }),
    story: Object.freeze({ width: 1080, height: 1920 }),
  });

  let currentFormat = "quadrado";
  let dims = FORMAT_DIMS[currentFormat];
```

- [ ] **Step 2: Corrigir o estado inicial da pessoa**

Trocar a linha 62:

```js
  let person = { x: SIZE / 2, y: SIZE / 2, scale: 1, rotation: 0 };
```

por:

```js
  let person = { x: dims.width / 2, y: dims.height / 2, scale: 1, rotation: 0 };
```

- [ ] **Step 3: Corrigir `clampPerson()`**

Substituir o corpo de `clampPerson()` por:

```js
  function clampPerson() {
    if (!personImage) return;
    const { w: width, h: height } = bboxGirado(
      personW * person.scale,
      personH * person.scale,
      person.rotation
    );
    // Referência de "quanto precisa continuar visível" usa o menor lado:
    // em story, 16% da altura seria uma margem grande demais na horizontal.
    const minVisible = Math.min(dims.width, dims.height) * 0.16;

    person.x = clamp(person.x, minVisible - width / 2, dims.width - minVisible + width / 2);
    person.y = clamp(person.y, minVisible - height / 2, dims.height - minVisible + height / 2);
  }
```

- [ ] **Step 4: Corrigir `draw()`**

Em `draw()`, trocar `ctx.fillRect(0, 0, SIZE, SIZE);` por:

```js
    ctx.fillRect(0, 0, dims.width, dims.height);
```

e trocar `ctx.drawImage(mask, 0, 0, SIZE, SIZE);` por:

```js
      ctx.drawImage(mask, 0, 0, dims.width, dims.height);
```

- [ ] **Step 5: Corrigir `autoFitPerson()`**

Substituir as linhas que usam `SIZE` dentro de `autoFitPerson()` por:

```js
    const scaleByWidth = (dims.width * 0.90) / personW;
    const scaleByHeight = (dims.height * 0.94) / personH;
    baseScale = Math.min(scaleByWidth, scaleByHeight);

    person.scale = baseScale;
    person.x = dims.width / 2;

    const renderedHeight = bboxGirado(
      personW * person.scale,
      personH * person.scale,
      person.rotation
    ).h;
    const bottomMargin = 18;
    person.y = dims.height - bottomMargin - renderedHeight / 2;
```

- [ ] **Step 6: Corrigir `pointInCanvas()`**

```js
  function pointInCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * dims.width,
      y: ((event.clientY - rect.top) / rect.height) * dims.height,
    };
  }
```

- [ ] **Step 7: Adicionar `setFormat()`**

Logo depois de `autoFitPerson()`, acrescentar:

```js
  // Trocar formato SEMPRE reseta o enquadramento. Coordenadas salvas em um
  // aspect ratio não são válidas em outro; guardar e restaurar exigiria
  // re-clamp de posição, de zoom e de bbox rotacionada. Decisão da spec §11.
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
      person = { x: dims.width / 2, y: dims.height / 2, scale: 1, rotation: 0 };
      draw();
    }
  }
```

- [ ] **Step 8: Confirmar que nenhum `SIZE` sobrou**

Run: `grep -nE "\bSIZE\b" static/js/editor.js`
Expected: nenhuma saída (`MAX_WORK_SIDE`, `MAX_FALLBACK_SIDE` e `MAX_FILE_BYTES` não casam com `\bSIZE\b`)

- [ ] **Step 9: Rodar a suíte existente sem regressão**

Run: `python -m http.server 8000 --directory . & sleep 1 && node tests/run.js http://127.0.0.1:8000/`
Expected: 13 casos, todos com `0 pixels diferentes`

- [ ] **Step 10: Commit**

```bash
git add static/js/editor.js
git commit -m "feat: FORMAT_DIMS e geometria de canvas variavel"
```

---

### Task 3: Seletor de formato e preview responsivo

**Files:**
- Modify: `index.html` (nova seção de formato), `static/css/style.css:258` (`aspect-ratio`), `static/js/editor.js` (renderização dos chips)

**Interfaces:**
- Consumes: `setFormat(formatId)`, `currentFormat` da Task 2.
- Produces: `renderFormats(formatIds)` popula `#formatGrid` com botões `.format-chip[data-format]`; `syncFormatChips()` mantém `aria-checked` coerente; variável CSS `--canvas-aspect` em `.canvas-wrap`.

- [ ] **Step 1: Adicionar o container de formato ao HTML**

Em `index.html`, logo após o `</section>` da `template-section`, inserir:

```html
    <section class="format-section" aria-labelledby="formatTitle">
      <div class="section-heading">
        <strong id="formatTitle">2. Escolha o formato</strong>
        <span>A troca de formato reenquadra a foto</span>
      </div>

      <div class="format-grid" id="formatGrid" role="radiogroup" aria-label="Formatos de exportação"></div>
    </section>
```

Renumerar o título seguinte: `2. Ajuste a foto` passa a `3. Ajuste a foto`.

- [ ] **Step 2: Tornar o preview proporcional ao formato**

Em `static/css/style.css`, na regra `.canvas-wrap` (linha 258), substituir:

```css
  width: 100%;
  aspect-ratio: 1;
```

por:

```css
  width: 100%;
  aspect-ratio: var(--canvas-aspect, 1 / 1);
  /* Story é 9:16: sem teto de altura o canvas empurra os controles para
     fora da dobra em telas baixas. Com aspect-ratio, limitar a altura faz
     o navegador reduzir a largura — a resolução do canvas não muda, então
     o WYSIWYG continua intacto. */
  max-height: 68dvh;
  margin-inline: auto;
```

E acrescentar, ao lado das regras de `.template-grid`:

```css
.format-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.format-chip {
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  background: transparent;
  color: inherit;
}

.format-chip[aria-checked="true"] {
  border-color: var(--brand-primary, #ff4fa3);
  background: color-mix(in srgb, var(--brand-primary, #ff4fa3) 18%, transparent);
}
```

- [ ] **Step 3: Renderizar os chips de formato**

Em `static/js/editor.js`, junto das demais referências de elemento (perto da linha 38):

```js
  const formatGrid = document.getElementById("formatGrid");
```

E, próximo a `setFormat()`:

```js
  const FORMAT_LABELS = {
    quadrado: "Quadrado",
    feed: "Feed",
    story: "Story",
  };

  function renderFormats(formatIds) {
    formatGrid.replaceChildren();

    formatIds.forEach((formatId) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "format-chip";
      chip.dataset.format = formatId;
      chip.setAttribute("role", "radio");
      chip.setAttribute("aria-checked", String(formatId === currentFormat));
      chip.textContent = FORMAT_LABELS[formatId] || formatId;

      chip.addEventListener("click", () => {
        if (isBusy || formatId === currentFormat) return;
        setFormat(formatId);
        syncFormatChips();
        showToast(`Formato ${FORMAT_LABELS[formatId] || formatId} selecionado.`);
      });

      formatGrid.append(chip);
    });
  }

  function syncFormatChips() {
    [...formatGrid.querySelectorAll(".format-chip")].forEach((chip) => {
      chip.setAttribute("aria-checked", String(chip.dataset.format === currentFormat));
    });
  }
```

- [ ] **Step 4: Chamar `renderFormats()` na inicialização provisória**

O editor ainda é uma IIFE auto-executável; a chamada definitiva vem de `initEditor()` na Task 10. Por ora, no bloco final do arquivo, antes de `draw();`, acrescentar:

```js
  // Provisório: na Task 10 quem informa os formatos é o tenant.
  renderFormats(Object.keys(FORMAT_DIMS));
```

- [ ] **Step 5: Verificar manualmente os três formatos**

Run: subir o servidor local, abrir `http://127.0.0.1:8000/`, enviar `tests/fixtures/12mp.jpg`, clicar em cada chip.
Expected: o preview muda de proporção, a foto é reenquadrada e o card de resultado some a cada troca.

- [ ] **Step 6: Commit**

```bash
git add index.html static/css/style.css static/js/editor.js
git commit -m "feat: seletor de formato e preview proporcional"
```

---

### Task 4: Exportação multi-formato

**Files:**
- Modify: `static/js/editor.js` (handler do `#downloadButton`, por volta da linha 946), `index.html` (rótulo do botão)

**Interfaces:**
- Consumes: `dims`, `currentFormat` da Task 2; `setFormat()` da Task 2.
- Produces: PNG com exatamente as dimensões do formato ativo, nomeado `avatar-{tenant}-{template}-{format}-{w}x{h}.png`.

- [ ] **Step 1: Declarar as variáveis de identificação provisórias**

Perto do topo do arquivo, junto de `let selectedMask`, acrescentar:

```js
  // Provisório: na Task 10 estes dois valores passam a vir de initEditor().
  let tenantSlug = "cliente";
  let currentTemplateId = "modelo";
```

- [ ] **Step 2: Ajustar mensagem de progresso e nome do arquivo**

No handler de `downloadButton`, trocar:

```js
    setBusy(true, "Gerando a arte…", "Preparando o PNG em 1080×1080.");
```

por:

```js
    setBusy(true, "Gerando a arte…", `Preparando o PNG em ${dims.width}×${dims.height}.`);
```

E trocar:

```js
      link.download = `arte-campanha-${selectedMask}-1080x1080.png`;
```

por:

```js
      link.download =
        `avatar-${tenantSlug}-${currentTemplateId}-${currentFormat}` +
        `-${dims.width}x${dims.height}.png`;
```

- [ ] **Step 3: Tornar o rótulo do botão dinâmico**

Em `index.html`, trocar:

```html
        <span>Baixar imagem 1080×1080</span>
```

por:

```html
        <span id="downloadLabel">Baixar imagem</span>
```

E em `setFormat()`, ao final, acrescentar:

```js
    const downloadLabel = document.getElementById("downloadLabel");
    if (downloadLabel) {
      downloadLabel.textContent = `Baixar imagem ${dims.width}×${dims.height}`;
    }
```

- [ ] **Step 4: Verificar o PNG exportado em cada formato**

Run: abrir o app, enviar uma foto, exportar nos três formatos e inspecionar os arquivos.
Expected: `1080x1080`, `1080x1350` e `1080x1920`, com nome no padrão `avatar-...`.

- [ ] **Step 5: Commit**

```bash
git add static/js/editor.js index.html
git commit -m "feat: exportacao com dimensoes e nome por formato"
```

---

### Task 5: Matriz de teste multi-formato

Baseline completo em quadrado, amostra estratégica nos demais. 19 execuções, não 39.

**Files:**
- Modify: `tests/harness.js` (`runCase`), `tests/run.js` (constantes e `main()`)

**Interfaces:**
- Consumes: `runCase({url, photoPath, viewport, timeoutMs, raceDuringExport})` existente.
- Produces: `runCase()` aceita `format` (string opcional) e clica no chip correspondente antes de capturar; `selectFormat(cdp, formatId, timeoutMs)` reutilizável.

- [ ] **Step 1: Escrever o helper de seleção de formato**

Em `tests/harness.js`, antes de `runCase`:

```js
async function selectFormat(cdp, formatId, timeoutMs) {
  const expression = `
    (function () {
      const chip = document.querySelector('.format-chip[data-format="${formatId}"]');
      if (!chip) return "chip-ausente";
      chip.click();
      return "ok";
    })()
  `;
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.result.value !== "ok") {
    throw new Error(`formato ${formatId} não encontrado na interface`);
  }
  await waitForCondition(
    cdp,
    `document.querySelector('.format-chip[data-format="${formatId}"]').getAttribute('aria-checked') === 'true'`,
    timeoutMs
  );
}
```

- [ ] **Step 2: Aceitar `format` em `runCase()`**

Na assinatura:

```js
async function runCase({
  url,
  photoPath,
  viewport,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headless = true,
  raceDuringExport = false,
  format = null,
} = {}) {
```

E, dentro do `try`, logo depois do `waitForCondition` que espera `#adjustments` e antes de `capturePreviewPng`:

```js
    if (format) {
      await selectFormat(cdp, format, timeoutMs);
    }
```

- [ ] **Step 3: Definir a matriz em `run.js`**

Substituir a constante `DEFAULT_CASES` por:

```js
const BASELINE_CASES = [
  "12mp.jpg",
  "48mp.jpg",
  "exif1.jpg",
  "exif2.jpg",
  "exif3.jpg",
  "exif4.jpg",
  "exif5.jpg",
  "exif6.jpg",
  "exif7.jpg",
  "exif8.jpg",
  "transparente.png",
  "foto.webp",
  "pesada.jpg",
];

// Baseline completo em quadrado; amostra estratégica nos demais formatos.
// As três fixtures cobrem eixos distintos: imagem normal, orientação EXIF
// e arquivo pesado com enquadramento complexo. Triplicar as 13 custaria
// 39 execuções sem cobrir nada que estas três já não denunciem.
const SAMPLE_CASES = ["12mp.jpg", "exif6.jpg", "pesada.jpg"];

const MATRIX = [
  ...BASELINE_CASES.map((name) => ({ name, format: "quadrado" })),
  ...SAMPLE_CASES.map((name) => ({ name, format: "feed" })),
  ...SAMPLE_CASES.map((name) => ({ name, format: "story" })),
];
```

- [ ] **Step 4: Percorrer a matriz em `main()`**

Substituir o laço de casos por:

```js
  const matrix = process.env.CASES
    ? process.env.CASES.split(",").map((name) => ({ name, format: "quadrado" }))
    : MATRIX;

  for (const { name: caseName, format } of matrix) {
    const photoPath = path.join(FIXTURES, caseName);
    const label = `${caseName} [${format}]`;
    const caseDir = path.join(
      outDir,
      `${path.basename(caseName, path.extname(caseName))}-${format}`
    );
    fs.mkdirSync(caseDir, { recursive: true });
    process.stdout.write(`\n> ${label}\n`);

    const result = await runCase({
      url,
      photoPath,
      viewport: { width: 1280, height: 1024, deviceScaleFactor: 1 },
      timeoutMs,
      format,
    });
    assertNoApiRequests(result.networkRequests, label);

    const previewPath = path.join(caseDir, "preview.png");
    const downloadPath = path.join(caseDir, "download.png");
    fs.writeFileSync(previewPath, result.previewPng);
    fs.writeFileSync(downloadPath, result.downloadPng);
    runPythonCompare(previewPath, downloadPath);
    assertExifMarkers(caseName, previewPath);
  }
```

- [ ] **Step 5: Rodar a race condition também em formato não quadrado**

Substituir o bloco da corrida por:

```js
  for (const raceFormat of ["quadrado", "story"]) {
    process.stdout.write(`\n> corrida de exportação com zoom [${raceFormat}]\n`);
    const race = await runCase({
      url,
      photoPath: path.join(FIXTURES, "12mp.jpg"),
      viewport: { width: 1280, height: 1024, deviceScaleFactor: 1 },
      timeoutMs,
      format: raceFormat,
      raceDuringExport: true,
    });
    if (!race.raceState || race.raceState.resultHidden !== true || race.raceState.resultImageSrc) {
      throw new Error(`corrida [${raceFormat}]: resultCard exibiu blob obsoleto após mudança de zoom`);
    }
    if (race.raceState.zoomValue !== "150") {
      throw new Error(`corrida [${raceFormat}]: mudança de zoom não foi aplicada`);
    }
  }

  console.log(`\nOK: ${matrix.length} casos, corrida em 2 formatos, WYSIWYG e rede verificados`);
```

- [ ] **Step 6: Rodar a matriz completa**

Run: `node tests/run.js http://127.0.0.1:8000/`
Expected: `OK: 19 casos, corrida em 2 formatos, WYSIWYG e rede verificados`, todos com `0 pixels diferentes`

- [ ] **Step 7: Commit**

```bash
git add tests/harness.js tests/run.js
git commit -m "test: matriz WYSIWYG 13+3+3 e corrida em formato nao quadrado"
```

---

# FASE 3 — Infraestrutura de tenant

### Task 6: tenant.js — slug e resolução de assets

Funções puras, testáveis em Node sem browser.

**Files:**
- Create: `static/js/tenant.js`, `tests/tenant.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:

```js
export class TenantError extends Error   // campos: name, code, message
export const FORMAT_IDS      // ["quadrado", "feed", "story"]
export const RESERVED_SLUGS  // ["admin","api","assets","static","tenants","login"]
export function readSlug(pathname)                          // -> string | null, lança TenantError
export function resolveAssetPath(slug, assetPath, version)  // -> string, lança TenantError
```

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/tenant.test.js`:

```js
"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const MODULE_URL = pathToFileURL(
  path.join(__dirname, "..", "static", "js", "tenant.js")
).href;

test("readSlug extrai o primeiro segmento", async () => {
  const { readSlug } = await import(MODULE_URL);
  assert.equal(readSlug("/gd"), "gd");
  assert.equal(readSlug("/joao-silva/"), "joao-silva");
  assert.equal(readSlug("/gd/qualquer/coisa"), "gd");
});

test("readSlug devolve null na raiz", async () => {
  const { readSlug } = await import(MODULE_URL);
  assert.equal(readSlug("/"), null);
  assert.equal(readSlug(""), null);
});

test("readSlug rejeita slug fora do padrão", async () => {
  const { readSlug, TenantError } = await import(MODULE_URL);
  for (const invalido of ["/Joao", "/joao_silva", "/joão", "/joao silva"]) {
    assert.throws(() => readSlug(invalido), TenantError, invalido);
  }
});

test("readSlug rejeita slug reservado", async () => {
  const { readSlug, TenantError } = await import(MODULE_URL);
  for (const reservado of ["/admin", "/api", "/static", "/tenants", "/login", "/assets"]) {
    assert.throws(() => readSlug(reservado), TenantError, reservado);
  }
});

test("resolveAssetPath monta o caminho versionado do próprio tenant", async () => {
  const { resolveAssetPath } = await import(MODULE_URL);
  assert.equal(
    resolveAssetPath("gd", "masks/rosa/story.png", "3"),
    "/static/tenants/gd/masks/rosa/story.png?v=3"
  );
  assert.equal(resolveAssetPath("gd", "logo.png", "1"), "/static/tenants/gd/logo.png?v=1");
});

test("resolveAssetPath bloqueia fuga do diretório do tenant", async () => {
  const { resolveAssetPath, TenantError } = await import(MODULE_URL);
  const proibidos = [
    "../gd/logo.png",
    "masks/../../gd/logo.png",
    "/static/tenants/gd/logo.png",
    "https://externo.com/imagem.png",
    "//externo.com/imagem.png",
    "",
  ];
  for (const caminho of proibidos) {
    assert.throws(() => resolveAssetPath("joao", caminho, "1"), TenantError, caminho);
  }
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test tests/tenant.test.js`
Expected: FAIL, módulo `tenant.js` inexistente

- [ ] **Step 3: Implementar `tenant.js`**

Criar `static/js/tenant.js`:

```js
"use strict";

export const FORMAT_IDS = Object.freeze(["quadrado", "feed", "story"]);

// Reservados para uso futuro do produto: painel, API, landing.
export const RESERVED_SLUGS = Object.freeze([
  "admin",
  "api",
  "assets",
  "static",
  "tenants",
  "login",
]);

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export class TenantError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TenantError";
    this.code = code;
  }
}

export function readSlug(pathname) {
  const segments = String(pathname || "")
    .split("/")
    .filter(Boolean);

  if (segments.length === 0) return null;

  const slug = segments[0];

  if (!SLUG_PATTERN.test(slug)) {
    throw new TenantError("slug_invalido", `Slug fora do padrão: ${slug}`);
  }
  if (RESERVED_SLUGS.includes(slug)) {
    throw new TenantError("slug_reservado", `Slug reservado: ${slug}`);
  }

  return slug;
}

// O config declara caminhos relativos e o sistema monta a URL final. Um
// caminho absoluto ou externo permitiria um tenant referenciar assets de
// outro — ou de fora do domínio — e furar o isolamento.
export function resolveAssetPath(slug, assetPath, version) {
  if (typeof assetPath !== "string" || assetPath.length === 0) {
    throw new TenantError("asset_invalido", "Caminho de asset vazio.");
  }
  if (assetPath.startsWith("/") || assetPath.includes("://")) {
    throw new TenantError("asset_invalido", `Caminho de asset não relativo: ${assetPath}`);
  }
  if (assetPath.split("/").includes("..")) {
    throw new TenantError("asset_invalido", `Caminho de asset com "..": ${assetPath}`);
  }

  return `/static/tenants/${slug}/${assetPath}?v=${encodeURIComponent(version)}`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/tenant.test.js`
Expected: PASS, 6 testes

- [ ] **Step 5: Commit**

```bash
git add static/js/tenant.js tests/tenant.test.js
git commit -m "feat: tenant.js com slug e resolucao segura de assets"
```

---

### Task 7: tenant.js — validação de schema

Fail closed. Config inválido nunca inicializa o editor.

**Files:**
- Modify: `static/js/tenant.js`, `tests/tenant.test.js`

**Interfaces:**
- Consumes: `TenantError`, `FORMAT_IDS`, `resolveAssetPath` da Task 6.
- Produces:

```js
export function validateConfig(raw, slug)                  // -> TenantConfig, lança TenantError
export async function loadTenant(slug, fetchImpl = fetch)  // -> TenantConfig
```

`TenantConfig`:

```js
{
  slug: string,
  version: string,
  brand: { name, title, description, primaryColor, secondaryColor, logo },  // logo: URL versionada ou null
  formats: string[],
  templates: Array<{ id: string, name: string, assets: Record<formatId, string> }>,  // assets: URLs versionadas
  defaults: { template: string, format: string }
}
```

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/tenant.test.js`:

```js
function configValido() {
  return {
    slug: "gd",
    version: "1",
    brand: {
      name: "GD",
      title: "Monte sua foto com GD!",
      description: "Escolha um modelo.",
      primaryColor: "#ff4fa3",
      secondaryColor: "#2458ff",
      logo: "logo.png",
    },
    formats: ["quadrado", "story"],
    templates: [
      {
        id: "rosa",
        name: "Modelo Rosa",
        assets: { quadrado: "masks/rosa/quadrado.png", story: "masks/rosa/story.png" },
      },
    ],
    defaults: { template: "rosa", format: "quadrado" },
  };
}

test("validateConfig aceita config completo e resolve assets", async () => {
  const { validateConfig } = await import(MODULE_URL);
  const tenant = validateConfig(configValido(), "gd");

  assert.equal(tenant.slug, "gd");
  assert.equal(tenant.brand.logo, "/static/tenants/gd/logo.png?v=1");
  assert.equal(
    tenant.templates[0].assets.story,
    "/static/tenants/gd/masks/rosa/story.png?v=1"
  );
});

test("validateConfig exige campos obrigatórios", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);
  const caminhos = [
    ["slug"],
    ["version"],
    ["brand", "name"],
    ["brand", "primaryColor"],
    ["formats"],
    ["templates"],
    ["defaults", "template"],
    ["defaults", "format"],
  ];

  for (const caminho of caminhos) {
    const config = configValido();
    let alvo = config;
    for (const chave of caminho.slice(0, -1)) alvo = alvo[chave];
    delete alvo[caminho.at(-1)];
    assert.throws(() => validateConfig(config, "gd"), TenantError, caminho.join("."));
  }
});

test("validateConfig rejeita formato fora do enum", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);
  const config = configValido();
  config.formats = ["quadrado", "banner"];
  assert.throws(() => validateConfig(config, "gd"), TenantError);
});

test("validateConfig rejeita slug divergente da URL", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);
  assert.throws(() => validateConfig(configValido(), "joao"), TenantError);
});

test("validateConfig rejeita id de template duplicado", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);
  const config = configValido();
  config.templates.push({ ...config.templates[0] });
  assert.throws(() => validateConfig(config, "gd"), TenantError);
});

test("validateConfig proíbe configuração parcial de assets", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);
  const config = configValido();
  delete config.templates[0].assets.story;
  assert.throws(() => validateConfig(config, "gd"), TenantError);
});

test("validateConfig rejeita defaults inexistentes", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);

  const semTemplate = configValido();
  semTemplate.defaults.template = "inexistente";
  assert.throws(() => validateConfig(semTemplate, "gd"), TenantError);

  const formatoNaoHabilitado = configValido();
  formatoNaoHabilitado.defaults.format = "feed";
  assert.throws(() => validateConfig(formatoNaoHabilitado, "gd"), TenantError);
});

test("validateConfig exige ao menos um formato e um template", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);

  const semFormato = configValido();
  semFormato.formats = [];
  assert.throws(() => validateConfig(semFormato, "gd"), TenantError);

  const semTemplate = configValido();
  semTemplate.templates = [];
  assert.throws(() => validateConfig(semTemplate, "gd"), TenantError);
});

test("validateConfig rejeita asset com caminho de fuga", async () => {
  const { validateConfig, TenantError } = await import(MODULE_URL);
  const config = configValido();
  config.templates[0].assets.quadrado = "../joao/masks/principal/quadrado.png";
  assert.throws(() => validateConfig(config, "gd"), TenantError);
});

test("loadTenant busca config.json sem query string", async () => {
  const { loadTenant } = await import(MODULE_URL);
  const chamadas = [];
  const fetchFake = async (url) => {
    chamadas.push(url);
    return { ok: true, json: async () => configValido() };
  };

  await loadTenant("gd", fetchFake);
  assert.deepEqual(chamadas, ["/static/tenants/gd/config.json"]);
});

test("loadTenant transforma 404 em TenantError", async () => {
  const { loadTenant, TenantError } = await import(MODULE_URL);
  const fetchFake = async () => ({ ok: false, status: 404 });
  await assert.rejects(() => loadTenant("inexistente", fetchFake), TenantError);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test tests/tenant.test.js`
Expected: FAIL, `validateConfig is not a function`

- [ ] **Step 3: Implementar validação e carga**

Acrescentar a `static/js/tenant.js`:

```js
const MAX_TEMPLATES = 20;
const COR_HEX = /^#[0-9a-fA-F]{3,8}$/;

function exigir(condicao, code, message) {
  if (!condicao) throw new TenantError(code, message);
}

function texto(valor) {
  return typeof valor === "string" && valor.trim().length > 0;
}

export function validateConfig(raw, slug) {
  exigir(raw && typeof raw === "object", "config_invalido", "config.json não é um objeto.");

  exigir(texto(raw.slug), "campo_ausente", "Campo obrigatório ausente: slug");
  exigir(
    raw.slug === slug,
    "slug_divergente",
    `config.json declara slug "${raw.slug}" mas foi carregado como "${slug}".`
  );
  exigir(texto(raw.version), "campo_ausente", "Campo obrigatório ausente: version");

  const brand = raw.brand;
  exigir(brand && typeof brand === "object", "campo_ausente", "Campo obrigatório ausente: brand");
  exigir(texto(brand.name), "campo_ausente", "Campo obrigatório ausente: brand.name");
  exigir(
    texto(brand.primaryColor) && COR_HEX.test(brand.primaryColor),
    "campo_invalido",
    "brand.primaryColor precisa ser uma cor hexadecimal."
  );

  const formats = raw.formats;
  exigir(
    Array.isArray(formats) && formats.length > 0,
    "campo_ausente",
    "formats[] precisa de ao menos um formato."
  );
  formats.forEach((formatId) => {
    exigir(
      FORMAT_IDS.includes(formatId),
      "formato_invalido",
      `Formato fora do enum oficial: ${formatId}`
    );
  });

  const templates = raw.templates;
  exigir(
    Array.isArray(templates) && templates.length > 0,
    "campo_ausente",
    "templates[] precisa de ao menos um template."
  );
  exigir(
    templates.length <= MAX_TEMPLATES,
    "campo_invalido",
    `templates[] excede o máximo de ${MAX_TEMPLATES}.`
  );

  const vistos = new Set();
  const templatesResolvidos = templates.map((template) => {
    exigir(template && typeof template === "object", "campo_invalido", "Template não é um objeto.");
    exigir(texto(template.id), "campo_ausente", "Campo obrigatório ausente: templates[].id");
    exigir(texto(template.name), "campo_ausente", "Campo obrigatório ausente: templates[].name");
    exigir(!vistos.has(template.id), "template_duplicado", `Id de template repetido: ${template.id}`);
    vistos.add(template.id);

    const assets = template.assets;
    exigir(
      assets && typeof assets === "object",
      "campo_ausente",
      `Campo obrigatório ausente: templates[${template.id}].assets`
    );

    // Configuração parcial é proibida: se o formato está habilitado, todo
    // template precisa da arte correspondente. Senão o cliente descobre o
    // buraco só quando um usuário clicar no formato.
    const resolvidos = {};
    formats.forEach((formatId) => {
      exigir(
        texto(assets[formatId]),
        "asset_ausente",
        `Template "${template.id}" não tem asset para o formato "${formatId}".`
      );
      resolvidos[formatId] = resolveAssetPath(raw.slug, assets[formatId], raw.version);
    });

    return { id: template.id, name: template.name, assets: resolvidos };
  });

  const defaults = raw.defaults;
  exigir(defaults && typeof defaults === "object", "campo_ausente", "Campo obrigatório ausente: defaults");
  exigir(texto(defaults.template), "campo_ausente", "Campo obrigatório ausente: defaults.template");
  exigir(texto(defaults.format), "campo_ausente", "Campo obrigatório ausente: defaults.format");
  exigir(
    vistos.has(defaults.template),
    "default_invalido",
    `defaults.template aponta para template inexistente: ${defaults.template}`
  );
  exigir(
    formats.includes(defaults.format),
    "default_invalido",
    `defaults.format aponta para formato não habilitado: ${defaults.format}`
  );

  return {
    slug: raw.slug,
    version: raw.version,
    brand: {
      name: brand.name,
      title: texto(brand.title) ? brand.title : brand.name,
      description: texto(brand.description) ? brand.description : "",
      primaryColor: brand.primaryColor,
      secondaryColor: texto(brand.secondaryColor) ? brand.secondaryColor : "#ffffff",
      logo: texto(brand.logo) ? resolveAssetPath(raw.slug, brand.logo, raw.version) : null,
    },
    formats: [...formats],
    templates: templatesResolvidos,
    defaults: { template: defaults.template, format: defaults.format },
  };
}

export async function loadTenant(slug, fetchImpl = fetch) {
  // Sem query string: version só é conhecido depois de ler o próprio
  // arquivo. A revalidação fica a cargo do header declarado em _headers.
  const url = `/static/tenants/${slug}/config.json`;

  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new TenantError("rede", `Falha de rede ao carregar ${url}: ${error.message}`);
  }

  if (!response.ok) {
    throw new TenantError(
      "tenant_inexistente",
      `Tenant não encontrado: ${slug} (HTTP ${response.status})`
    );
  }

  let raw;
  try {
    raw = await response.json();
  } catch {
    throw new TenantError("json_invalido", `config.json de "${slug}" não é JSON válido.`);
  }

  return validateConfig(raw, slug);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/tenant.test.js`
Expected: PASS, 17 testes

- [ ] **Step 5: Commit**

```bash
git add static/js/tenant.js tests/tenant.test.js
git commit -m "feat: validacao fail-closed do contrato de tenant"
```

---

### Task 8: Servidor de desenvolvimento com SPA fallback

Sem ele, `/gd` devolve 404 localmente e nenhum teste de tenant roda.

**Files:**
- Create: `tests/server.js`

**Interfaces:**
- Consumes: nada.
- Produces: `node tests/server.js [porta] [raiz]` serve arquivos estáticos e devolve `index.html` com HTTP 200 para qualquer rota sem extensão, espelhando `not_found_handling = "single-page-application"`. Exporta `criarServidor(raiz)`.

- [ ] **Step 1: Implementar o servidor**

Criar `tests/server.js`:

```js
"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function criarServidor(raiz) {
  const base = path.resolve(raiz);

  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const relativo = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const alvo = path.resolve(base, relativo);

    // Nunca servir nada acima da raiz, mesmo que a URL tente escapar.
    if (!alvo.startsWith(base)) {
      res.writeHead(403).end("forbidden");
      return;
    }

    if (relativo && fs.existsSync(alvo) && fs.statSync(alvo).isFile()) {
      const tipo = TIPOS[path.extname(alvo).toLowerCase()] || "application/octet-stream";
      const headers = { "Content-Type": tipo };
      // Espelha a política de _headers: config de tenant sempre revalidável.
      if (alvo.endsWith("config.json")) {
        headers["Cache-Control"] = "public, max-age=0, must-revalidate";
      }
      res.writeHead(200, headers).end(fs.readFileSync(alvo));
      return;
    }

    // SPA fallback: rota sem arquivo correspondente devolve o index com 200,
    // para que /gd e /joao cheguem ao bootstrap no cliente.
    if (!path.extname(relativo)) {
      res.writeHead(200, { "Content-Type": TIPOS[".html"] })
        .end(fs.readFileSync(path.join(base, "index.html")));
      return;
    }

    res.writeHead(404).end("not found");
  });
}

if (require.main === module) {
  const porta = Number(process.argv[2] || 8000);
  const raiz = path.resolve(process.argv[3] || path.join(__dirname, ".."));
  criarServidor(raiz).listen(porta, "127.0.0.1", () => {
    console.log(`servindo ${raiz} em http://127.0.0.1:${porta}/`);
  });
}

module.exports = { criarServidor };
```

- [ ] **Step 2: Verificar o fallback**

Run:
```bash
node tests/server.js 8000 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/gd
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/static/js/tenant.js
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/static/js/nao-existe.js
```
Expected: `200`, `200`, `404`

- [ ] **Step 3: Commit**

```bash
git add tests/server.js
git commit -m "test: servidor local com SPA fallback"
```

---

### Task 9: Tenants gd, joao e _template

**Files:**
- Create: `static/tenants/{_template,gd,joao}/config.json` e assets
- Move: `static/img/mascara-{rosa,azul}-v1.png` → `static/tenants/gd/masks/{rosa,azul}/quadrado.png`

**Interfaces:**
- Consumes: contrato validado por `validateConfig` (Task 7).
- Produces: três diretórios de tenant. `gd` habilita apenas `quadrado`; `joao` habilita os três formatos com um único template.

- [ ] **Step 1: Mover as artes do GD para o tenant**

```bash
mkdir -p static/tenants/gd/masks/rosa static/tenants/gd/masks/azul
git mv static/img/mascara-rosa-v1.png static/tenants/gd/masks/rosa/quadrado.png
git mv static/img/mascara-azul-v1.png static/tenants/gd/masks/azul/quadrado.png
```

- [ ] **Step 2: Escrever `static/tenants/gd/config.json`**

```json
{
  "slug": "gd",
  "version": "1",
  "brand": {
    "name": "GD",
    "title": "Monte sua foto com GD!",
    "description": "Escolha um modelo e envie uma foto já com fundo branco, transparente ou recortada. Depois é só ajustar o enquadramento.",
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
```

`formats` traz apenas `quadrado` porque só existem artes quadradas. Quando o designer entregar feed e story, acrescentar os formatos ao array, subir os arquivos em `masks/<template>/` e incrementar `version`.

- [ ] **Step 3: Criar o tenant fictício `joao` com os três formatos**

```bash
mkdir -p static/tenants/joao/masks/principal
cp tests/fixtures/masks/quadrado.png static/tenants/joao/masks/principal/quadrado.png
cp tests/fixtures/masks/feed.png static/tenants/joao/masks/principal/feed.png
cp tests/fixtures/masks/story.png static/tenants/joao/masks/principal/story.png
```

`static/tenants/joao/config.json`:

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
  "formats": ["quadrado", "feed", "story"],
  "templates": [
    {
      "id": "principal",
      "name": "Modelo Principal",
      "assets": {
        "quadrado": "masks/principal/quadrado.png",
        "feed": "masks/principal/feed.png",
        "story": "masks/principal/story.png"
      }
    }
  ],
  "defaults": {
    "template": "principal",
    "format": "quadrado"
  }
}
```

`joao` prova isolamento e é o único tenant com os três formatos — por isso a matriz WYSIWYG das tasks seguintes roda contra `/joao`, não contra `/gd`.

- [ ] **Step 4: Criar o template oficial de novo cliente**

```bash
mkdir -p static/tenants/_template/masks/principal
cp tests/fixtures/masks/quadrado.png static/tenants/_template/masks/principal/quadrado.png
cp tests/fixtures/masks/feed.png static/tenants/_template/masks/principal/feed.png
cp tests/fixtures/masks/story.png static/tenants/_template/masks/principal/story.png
```

`static/tenants/_template/config.json`:

```json
{
  "slug": "_template",
  "version": "1",
  "brand": {
    "name": "Nome do Cliente",
    "title": "Monte sua foto com o Cliente!",
    "description": "Escolha um modelo e personalize sua foto.",
    "primaryColor": "#2458ff",
    "secondaryColor": "#ffffff",
    "logo": "logo.png"
  },
  "formats": ["quadrado", "feed", "story"],
  "templates": [
    {
      "id": "principal",
      "name": "Modelo Principal",
      "assets": {
        "quadrado": "masks/principal/quadrado.png",
        "feed": "masks/principal/feed.png",
        "story": "masks/principal/story.png"
      }
    }
  ],
  "defaults": {
    "template": "principal",
    "format": "quadrado"
  }
}
```

O slug `_template` não casa com `^[a-z0-9-]+$`, então a pasta nunca é servível como cliente real — é modelo de cópia, não tenant navegável.

- [ ] **Step 5: Gerar as logos**

```bash
python - <<'PY'
from PIL import Image, ImageDraw

LOGOS = [
    ("gd", "GD", (255, 79, 163)),
    ("joao", "JOAO", (36, 88, 255)),
    ("_template", "CLIENTE", (120, 120, 120)),
]

for slug, texto, cor in LOGOS:
    img = Image.new("RGBA", (240, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 239, 63], outline=cor, width=3)
    d.text((16, 24), texto, fill=cor)
    img.save(f"static/tenants/{slug}/logo.png")
PY
```

Substituir `static/tenants/gd/logo.png` pela logo real do cliente quando ela estiver disponível.

- [ ] **Step 6: Validar os três configs contra o schema**

```bash
node --input-type=module -e "
import { validateConfig } from './static/js/tenant.js';
import { readFileSync } from 'node:fs';
for (const slug of ['gd', 'joao']) {
  const raw = JSON.parse(readFileSync(\`static/tenants/\${slug}/config.json\`, 'utf8'));
  validateConfig(raw, slug);
  console.log(slug, 'OK');
}
"
```
Expected: `gd OK` e `joao OK`

O `_template` não passa por essa validação de propósito: seu slug tem underscore e é recusado por construção.

- [ ] **Step 7: Commit**

```bash
git add static/tenants static/img
git commit -m "feat: tenants gd, joao e _template"
```

---

# FASE 2 — Templates dinâmicos (virada)

### Task 10: Virada — initEditor, templates dinâmicos e bootstrap

Remove `rosa` e `azul` do core e liga o editor ao tenant. Task atômica: separar HTML, `initEditor` e `bootstrap` deixaria o produto quebrado entre commits.

**Files:**
- Modify: `static/js/editor.js` (IIFE → módulo com `initEditor`), `index.html` (containers, tela de erro, script), `static/css/style.css` (variáveis de marca)
- Create: `static/js/bootstrap.js`

**Interfaces:**
- Consumes: `readSlug`, `loadTenant`, `TenantError` de `tenant.js` (Tasks 6-7); `renderFormats`, `syncFormatChips`, `setFormat` das Tasks 2-3.
- Produces:

```js
// editor.js
export function initEditor({ slug, templates, formats, defaultTemplate, defaultFormat })
```

`templates`: `Array<{ id, name, assets: Record<formatId, string> }>` com URLs já resolvidas e versionadas. `formats`: `Array<formatId>` na ordem de exibição. Internamente expõe `setTemplate(templateId)` (comportamento definido na Task 11), `applyMask(templateId, formatId)` e `renderTemplates()`.

- [ ] **Step 1: Converter o arquivo em módulo**

Em `static/js/editor.js`, trocar a abertura:

```js
(() => {
  "use strict";
```

por:

```js
"use strict";

export function initEditor({ slug, templates, formats, defaultTemplate, defaultFormat }) {
```

E o fechamento:

```js
})();
```

por:

```js
}
```

Remover as instruções finais de inicialização da IIFE (`applyMaskAccent();`, `renderFormats(Object.keys(FORMAT_DIMS));`, `draw();`) — a inicialização definitiva entra no Step 5.

- [ ] **Step 2: Substituir o estado de máscara por estado de template**

Remover as referências fixas: a linha `const maskRadios = [...]`, o objeto `maskImages`, o objeto `maskReady` e as declarações provisórias `let tenantSlug = "cliente";` / `let currentTemplateId = "modelo";` criadas na Task 4.

No lugar, acrescentar:

```js
  const templateGrid = document.getElementById("templateGrid");

  // Cache de imagem por par template+formato. Um tenant com 10 templates e
  // 3 formatos tem 30 artes; carregar tudo de uma vez desperdiça banda em
  // celular, então a carga é sob demanda e o resultado fica em cache.
  const maskCache = new Map();
  const templateById = new Map(templates.map((template) => [template.id, template]));

  let currentMask = null;
  let tenantSlug = slug;
  let currentTemplateId = defaultTemplate;

  function maskKey(templateId, formatId) {
    return `${templateId}/${formatId}`;
  }
```

Remover também `let selectedMask = ...` e qualquer uso remanescente dele.

- [ ] **Step 3: Carregar a máscara sob demanda**

Substituir `currentMaskImage()` e `applyMaskAccent()` por:

```js
  function loadMask(templateId, formatId) {
    const key = maskKey(templateId, formatId);
    const cached = maskCache.get(key);
    if (cached) return cached;

    const src = templateById.get(templateId)?.assets?.[formatId];
    if (!src) {
      return Promise.reject(new Error(`asset ausente para ${key}`));
    }

    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", () => reject(new Error(`falha ao carregar ${src}`)));
      image.src = src;
    });

    maskCache.set(key, promise);
    return promise;
  }

  async function applyMask(templateId, formatId) {
    try {
      const image = await loadMask(templateId, formatId);
      // Outra troca pode ter acontecido durante o await; descartar se a
      // seleção mudou, pelo mesmo motivo do versionamento de exportação.
      if (templateId !== currentTemplateId || formatId !== currentFormat) return;
      currentMask = image;
    } catch (error) {
      if (templateId !== currentTemplateId || formatId !== currentFormat) return;
      currentMask = null;
      showToast("Não foi possível carregar a arte deste modelo.", "error");
    }
    draw();
  }
```

- [ ] **Step 4: Usar `currentMask` no `draw()`**

Substituir o bloco de máscara dentro de `draw()`:

```js
    const mask = currentMaskImage();
    if (mask && maskReady[selectedMask]) {
      ctx.drawImage(mask, 0, 0, dims.width, dims.height);
    }
```

por:

```js
    if (currentMask) {
      ctx.drawImage(currentMask, 0, 0, dims.width, dims.height);
    }
```

E remover o bloco `Object.entries(maskImages).forEach(...)` do final do arquivo, que registrava os listeners de `load`/`error` das imagens fixas.

- [ ] **Step 5: Renderizar os cards de template e inicializar**

Substituir o bloco de listeners de `maskRadios` por:

```js
  function renderTemplates() {
    templateGrid.replaceChildren();

    templates.forEach((template) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "template-card";
      card.dataset.template = template.id;
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(template.id === currentTemplateId));

      const preview = document.createElement("img");
      preview.className = "template-preview-img";
      preview.src = template.assets[defaultFormat];
      preview.alt = `Prévia do ${template.name}`;
      preview.loading = "lazy";

      const nome = document.createElement("span");
      nome.className = "template-name";
      nome.textContent = template.name;

      card.append(preview, nome);
      card.addEventListener("click", () => {
        if (isBusy || template.id === currentTemplateId) return;
        setTemplate(template.id);
      });

      templateGrid.append(card);
    });
  }

  function syncTemplateCards() {
    [...templateGrid.querySelectorAll(".template-card")].forEach((card) => {
      card.setAttribute("aria-checked", String(card.dataset.template === currentTemplateId));
    });
  }

  // Comportamento completo definido na Task 11. Aqui basta trocar a arte.
  function setTemplate(templateId) {
    if (!templateById.has(templateId)) return;
    currentTemplateId = templateId;
    syncTemplateCards();
    invalidateResult();
    applyMask(currentTemplateId, currentFormat);
  }
```

E, ao final do corpo de `initEditor`, antes do fechamento:

```js
  renderTemplates();
  renderFormats(formats);
  setFormat(defaultFormat);
  applyMask(currentTemplateId, currentFormat);
```

Acrescentar também, ao final de `setFormat()`, a recarga da arte do formato novo:

```js
    applyMask(currentTemplateId, currentFormat);
```

- [ ] **Step 6: Reescrever o HTML**

Em `index.html`:

Trocar o conteúdo de `.template-grid` por um container vazio:

```html
      <div class="template-grid" id="templateGrid" role="radiogroup" aria-label="Modelos de campanha"></div>
```

Remover as tags `<img id="maskRosa">` e `<img id="maskAzul">`.

Remover `data-mask="rosa"` de `<body>`.

Envolver o app e acrescentar a tela de erro, logo depois de `<body>`:

```html
  <section class="tenant-error" id="tenantError" hidden>
    <h1 id="tenantErrorTitle">Cliente não encontrado</h1>
    <p id="tenantErrorText">Verifique o endereço e tente novamente.</p>
  </section>

  <main class="app-shell" id="appShell" hidden>
```

Dar ids aos textos de marca dentro de `.app-header`:

```html
      <img class="brand-logo" id="brandLogo" alt="" hidden>
      <h1 id="brandTitle">Monte sua foto</h1>
      <p id="brandDescription"></p>
```

Trocar o carregamento do script:

```html
  <script type="module" src="/static/js/bootstrap.js"></script>
```

- [ ] **Step 7: Declarar as variáveis de marca no CSS**

Em `static/css/style.css`, no bloco `:root`:

```css
  --brand-primary: #ff4fa3;
  --brand-secondary: #ffffff;
```

E acrescentar:

```css
.brand-logo {
  max-height: 48px;
  width: auto;
  margin-bottom: 12px;
}

.tenant-error {
  max-width: 460px;
  margin: 18vh auto;
  padding: 0 24px;
  text-align: center;
}

.template-preview-img {
  width: 100%;
  border-radius: 12px;
  display: block;
}
```

Trocar as cores de destaque fixas por `var(--brand-primary)` e remover os seletores `[data-mask="rosa"]` / `[data-mask="azul"]`, que deixam de existir. Localizar as ocorrências com:

Run: `grep -n "#ff4fa3\|#2458ff\|\[data-mask" static/css/style.css`

- [ ] **Step 8: Implementar `bootstrap.js`**

Criar `static/js/bootstrap.js`:

```js
"use strict";

import { readSlug, loadTenant, TenantError } from "./tenant.js";
import { initEditor } from "./editor.js";

const MENSAGENS = {
  slug_invalido: "Cliente não encontrado",
  slug_reservado: "Cliente não encontrado",
  tenant_inexistente: "Cliente não encontrado",
  padrao: "Não foi possível carregar esta configuração.",
};

function mostrarErro(code) {
  // Detalhe técnico fica no console; o usuário final vê texto controlado.
  const titulo = MENSAGENS[code] || MENSAGENS.padrao;
  document.getElementById("tenantErrorTitle").textContent = titulo;
  document.getElementById("tenantError").hidden = false;
  document.getElementById("appShell").hidden = true;
  document.title = titulo;
}

function aplicarMarca(brand) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", brand.primaryColor);
  root.style.setProperty("--brand-secondary", brand.secondaryColor);

  document.title = brand.title;
  document.getElementById("brandTitle").textContent = brand.title;
  document.getElementById("brandDescription").textContent = brand.description;

  const logo = document.getElementById("brandLogo");
  if (brand.logo) {
    // Logo ausente não derruba o editor: some da interface e segue o jogo.
    logo.addEventListener("error", () => {
      logo.hidden = true;
    });
    logo.src = brand.logo;
    logo.alt = brand.name;
    logo.hidden = false;
  }
}

async function bootstrap() {
  let slug;
  try {
    slug = readSlug(window.location.pathname);
  } catch (error) {
    console.error(error);
    mostrarErro(error.code);
    return;
  }

  if (slug === null) {
    // Raiz do domínio não resolve tenant. Placeholder chega na Task 12.
    document.getElementById("appShell").hidden = true;
    const landing = document.getElementById("landing");
    if (landing) landing.hidden = false;
    return;
  }

  let tenant;
  try {
    tenant = await loadTenant(slug);
  } catch (error) {
    console.error(error);
    mostrarErro(error instanceof TenantError ? error.code : "padrao");
    return;
  }

  aplicarMarca(tenant.brand);
  document.getElementById("appShell").hidden = false;

  initEditor({
    slug: tenant.slug,
    templates: tenant.templates,
    formats: tenant.formats,
    defaultTemplate: tenant.defaults.template,
    defaultFormat: tenant.defaults.format,
  });
}

bootstrap();
```

- [ ] **Step 9: Confirmar que o core não conhece cliente nem template**

Run: `grep -nE "['\"](gd|rosa|azul)['\"]" static/js/editor.js`
Expected: nenhuma saída

- [ ] **Step 10: Rodar a matriz completa contra o tenant com três formatos**

Run:
```bash
node tests/server.js 8000 &
sleep 1
node tests/run.js http://127.0.0.1:8000/joao
```
Expected: `OK: 19 casos, corrida em 2 formatos, WYSIWYG e rede verificados`

- [ ] **Step 11: Commit**

```bash
git add static/js/editor.js static/js/bootstrap.js index.html static/css/style.css
git commit -m "refactor: initEditor com templates dinamicos e bootstrap de tenant"
```

---

### Task 11: Regra de preservação de enquadramento

Trocar template preserva. Trocar formato reseta. Comportamento verificado por teste.

**Files:**
- Modify: `static/js/editor.js` (`setTemplate`), `tests/harness.js`, `tests/run.js`, `tests/compare.py`

**Interfaces:**
- Consumes: `setTemplate`, `applyMask`, `syncTemplateCards` da Task 10; `selectFormat` da Task 5.
- Produces: `captureSwitchBehavior(cdp, {templateB, formatB}, timeoutMs)` no harness, devolvendo `{antes, aposTemplate, aposFormato}` (buffers PNG); modo `--centro` em `compare.py` devolvendo `{centroIgual, pixelsDiferentes}` em JSON.

- [ ] **Step 1: Completar `setTemplate()` com o toast**

Substituir `setTemplate()` por:

```js
  // Trocar template NÃO toca em person: a arte sobreposta muda, o
  // enquadramento escolhido pelo usuário permanece. Contrapartida
  // deliberada de setFormat(), que sempre reseta.
  function setTemplate(templateId) {
    const template = templateById.get(templateId);
    if (!template) return;

    currentTemplateId = templateId;
    syncTemplateCards();
    invalidateResult();
    applyMask(currentTemplateId, currentFormat);
    showToast(`${template.name} selecionado.`);
  }
```

- [ ] **Step 2: Implementar o modo `--centro` no comparador**

Em `tests/compare.py`, acrescentar:

```python
def comparar_centro(caminho_a: str, caminho_b: str) -> dict:
    """Compara só o miolo, onde a moldura não desenha.

    Trocar de template muda a arte nas bordas de propósito. O que não pode
    mudar é a pessoa — e ela vive no centro.
    """
    from PIL import Image, ImageChops

    with Image.open(caminho_a) as a, Image.open(caminho_b) as b:
        a = a.convert("RGB")
        b = b.convert("RGB")
        if a.size != b.size:
            return {"centroIgual": False, "motivo": "dimensoes diferentes"}

        w, h = a.size
        caixa = (w // 4, h // 4, w - w // 4, h - h // 4)
        diff = ImageChops.difference(a.crop(caixa), b.crop(caixa))
        diferentes = sum(1 for pixel in diff.getdata() if max(pixel) > 6)

    return {"centroIgual": diferentes == 0, "pixelsDiferentes": diferentes}
```

E, no despacho de argumentos, antes do fluxo padrão:

```python
    if sys.argv[1] == "--centro":
        print(json.dumps(comparar_centro(sys.argv[2], sys.argv[3])))
        raise SystemExit(0)
```

Garantir que `import json` e `import sys` estão presentes no topo do arquivo.

- [ ] **Step 3: Implementar a captura no harness**

Em `tests/harness.js`, antes de `runCase`:

```js
async function captureSwitchBehavior(cdp, { templateB, formatB }, timeoutMs) {
  const antes = await capturePreviewPng(cdp);

  await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector('.template-card[data-template="${templateB}"]').click()`,
    returnByValue: true,
  });
  await waitForCondition(
    cdp,
    `document.querySelector('.template-card[data-template="${templateB}"]').getAttribute('aria-checked') === 'true'`,
    timeoutMs
  );
  // A arte carrega de forma assíncrona; sem a folga o preview pode ser
  // capturado antes de o novo template aparecer no canvas.
  await sleep(400);
  const aposTemplate = await capturePreviewPng(cdp);

  await selectFormat(cdp, formatB, timeoutMs);
  await sleep(400);
  const aposFormato = await capturePreviewPng(cdp);

  return { antes, aposTemplate, aposFormato };
}
```

Aceitar o parâmetro em `runCase`:

```js
  switchBehavior = null,
```

e, dentro do `try`, antes de `captureDownloadPng`:

```js
    if (switchBehavior) {
      const switchState = await captureSwitchBehavior(cdp, switchBehavior, timeoutMs);
      return { previewPng, switchState, networkRequests };
    }
```

Exportar:

```js
module.exports = { runCase, captureSwitchBehavior };
```

- [ ] **Step 4: Escrever a asserção em `run.js`**

Acrescentar o helper:

```js
function runPythonCompareCentro(a, b) {
  const result = spawnSync(
    process.env.PYTHON || "python",
    [path.join(__dirname, "compare.py"), "--centro", a, b],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`comparação de enquadramento falhou: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}
```

E, antes do `console.log` final de `main()`:

```js
  process.stdout.write("\n> troca de template preserva, troca de formato reseta\n");
  const troca = await runCase({
    url,
    photoPath: path.join(FIXTURES, "12mp.jpg"),
    viewport: { width: 1280, height: 1024, deviceScaleFactor: 1 },
    timeoutMs,
    switchBehavior: { templateB: process.env.TEMPLATE_B || "principal", formatB: "story" },
  });

  const trocaDir = path.join(outDir, "troca");
  fs.mkdirSync(trocaDir, { recursive: true });
  const antesPath = path.join(trocaDir, "antes.png");
  const aposTemplatePath = path.join(trocaDir, "apos-template.png");
  fs.writeFileSync(antesPath, troca.switchState.antes);
  fs.writeFileSync(aposTemplatePath, troca.switchState.aposTemplate);

  // A pessoa tem de ocupar exatamente os mesmos pixels depois da troca de
  // template; só a arte sobreposta muda. Comparar a região central, que a
  // moldura não cobre, isola a pessoa da arte.
  const enquadramento = runPythonCompareCentro(antesPath, aposTemplatePath);
  if (!enquadramento.centroIgual) {
    throw new Error(
      `troca de template alterou o enquadramento (${enquadramento.pixelsDiferentes} pixels)`
    );
  }

  // Troca de formato muda as dimensões: o reset é o comportamento correto.
  const aposFormatoPath = path.join(trocaDir, "apos-formato.png");
  fs.writeFileSync(aposFormatoPath, troca.switchState.aposFormato);
```

Nota: `/joao` tem um único template, então a "troca" recai sobre o mesmo id e o teste só prova que a arte recarrega sem mexer no enquadramento. Para exercitar dois templates de verdade, rodar com `TEMPLATE_B=azul` contra `/gd`.

- [ ] **Step 5: Rodar nos dois tenants**

Run:
```bash
node tests/run.js http://127.0.0.1:8000/joao
CASES=12mp.jpg TEMPLATE_B=azul node tests/run.js http://127.0.0.1:8000/gd
```
Expected: ambos PASS, sem `troca de template alterou o enquadramento`

- [ ] **Step 6: Commit**

```bash
git add static/js/editor.js tests/harness.js tests/run.js tests/compare.py
git commit -m "feat: template preserva enquadramento, formato reseta"
```

---

### Task 12: Raiz do domínio

**Files:**
- Modify: `index.html` (bloco `#landing`), `static/css/style.css`

**Interfaces:**
- Consumes: `bootstrap()` já trata `slug === null` e procura `#landing` (Task 10).
- Produces: elemento `#landing`, exibido apenas na raiz.

- [ ] **Step 1: Adicionar o placeholder comercial**

Em `index.html`, ao lado de `#tenantError`:

```html
  <section class="landing" id="landing" hidden>
    <h1>Avatar</h1>
    <p>Personalize sua campanha.</p>
    <p class="landing-soon">Em breve.</p>
  </section>
```

- [ ] **Step 2: Estilizar**

```css
.landing {
  max-width: 460px;
  margin: 18vh auto;
  padding: 0 24px;
  text-align: center;
}

.landing-soon {
  opacity: .6;
}
```

- [ ] **Step 3: Verificar**

Run: abrir `http://127.0.0.1:8000/`
Expected: "Avatar / Personalize sua campanha. / Em breve." — sem editor, sem requisição a `config.json`.

- [ ] **Step 4: Commit**

```bash
git add index.html static/css/style.css
git commit -m "feat: placeholder comercial na raiz do dominio"
```

---

# FASE 4 — Validação e isolamento

### Task 13: Testes de tenant e isolamento

**Files:**
- Modify: `tests/harness.js`, `tests/run.js`

**Interfaces:**
- Consumes: infraestrutura de Chrome do harness (`launchChrome`, `connectToPage`, `waitForCondition`, `withTimeout`, `killChromeTree`, `removeDirWithRetry`, `DEFAULT_TIMEOUT_MS`).
- Produces: `inspectTenant({url, viewport, timeoutMs, headless})` devolvendo `{state, networkRequests}`, onde `state` é `{editorVisivel, erroVisivel, landingVisivel, erroTitulo, titulo, primaryColor, templates: string[], formats: string[]}`.

- [ ] **Step 1: Implementar a inspeção de tenant**

Em `tests/harness.js`:

```js
async function captureTenantState(cdp, timeoutMs) {
  // O bootstrap é assíncrono: esperar o desfecho, sucesso ou erro.
  await waitForCondition(
    cdp,
    "!!document.getElementById('appShell') && (" +
      "!document.getElementById('appShell').hidden || " +
      "!document.getElementById('tenantError').hidden || " +
      "!document.getElementById('landing').hidden)",
    timeoutMs
  );

  const expression = `
    (function () {
      const estilo = getComputedStyle(document.documentElement);
      return JSON.stringify({
        editorVisivel: !document.getElementById('appShell').hidden,
        erroVisivel: !document.getElementById('tenantError').hidden,
        landingVisivel: !document.getElementById('landing').hidden,
        erroTitulo: document.getElementById('tenantErrorTitle').textContent,
        titulo: document.title,
        primaryColor: estilo.getPropertyValue('--brand-primary').trim(),
        templates: [...document.querySelectorAll('.template-card')].map((c) => c.dataset.template),
        formats: [...document.querySelectorAll('.format-chip')].map((c) => c.dataset.format),
      });
    })()
  `;
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  return JSON.parse(result.result.value);
}

async function inspectTenant({ url, viewport, timeoutMs = DEFAULT_TIMEOUT_MS, headless = true }) {
  const { child, port, userDataDir } = await launchChrome({ headless, viewport });
  const networkRequests = [];

  try {
    const cdp = await connectToPage(port);
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    await cdp.send("Runtime.enable");
    cdp.on("Network.requestWillBeSent", (params) => {
      if (params?.request?.url) networkRequests.push(params.request.url);
    });

    const loadEventFired = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url });
    await withTimeout(loadEventFired, timeoutMs, `carregamento de ${url}`);

    const state = await captureTenantState(cdp, timeoutMs);
    return { state, networkRequests };
  } finally {
    await killChromeTree(child);
    await removeDirWithRetry(userDataDir);
  }
}

module.exports = { runCase, captureSwitchBehavior, inspectTenant };
```

- [ ] **Step 2: Escrever as asserções em `run.js`**

Ajustar o import no topo:

```js
const { runCase, inspectTenant } = require("./harness");
```

E apontar o default da URL para o tenant com três formatos:

```js
  const [url = "http://127.0.0.1:8000/joao", outDirArg = "tests/.tmp-matrix", timeoutArg] =
    process.argv.slice(2);
```

Antes do `console.log` final:

```js
  process.stdout.write("\n> tenants e isolamento\n");
  const base = new URL(url).origin;

  const gd = await inspectTenant({ url: `${base}/gd`, timeoutMs });
  if (!gd.state.editorVisivel) throw new Error("/gd não inicializou o editor");
  if (gd.state.templates.join(",") !== "rosa,azul") {
    throw new Error(`/gd templates inesperados: ${gd.state.templates}`);
  }
  if (gd.state.formats.join(",") !== "quadrado") {
    throw new Error(`/gd formatos inesperados: ${gd.state.formats}`);
  }

  const joao = await inspectTenant({ url: `${base}/joao`, timeoutMs });
  if (!joao.state.editorVisivel) throw new Error("/joao não inicializou o editor");
  if (joao.state.templates.join(",") !== "principal") {
    throw new Error(`/joao templates inesperados: ${joao.state.templates}`);
  }
  if (joao.state.formats.join(",") !== "quadrado,feed,story") {
    throw new Error(`/joao formatos inesperados: ${joao.state.formats}`);
  }

  // Isolamento: nenhum request de /joao pode tocar assets de outro tenant.
  const vazamento = joao.networkRequests.filter((requestUrl) => {
    const { pathname } = new URL(requestUrl, base);
    return pathname.startsWith("/static/tenants/") && !pathname.startsWith("/static/tenants/joao/");
  });
  if (vazamento.length) {
    throw new Error(`/joao carregou assets de outro tenant: ${vazamento.join(", ")}`);
  }

  if (gd.state.primaryColor === joao.state.primaryColor) {
    throw new Error("tenants diferentes com a mesma cor de marca — brand não foi aplicada");
  }
  if (gd.state.titulo === joao.state.titulo) {
    throw new Error("tenants diferentes com o mesmo título");
  }

  for (const rota of ["/inexistente", "/admin", "/Joao"]) {
    const erro = await inspectTenant({ url: `${base}${rota}`, timeoutMs });
    if (erro.state.editorVisivel) {
      throw new Error(`${rota} inicializou o editor — fail closed violado`);
    }
    if (!erro.state.erroVisivel) {
      throw new Error(`${rota} não exibiu a tela de erro`);
    }
  }

  const raiz = await inspectTenant({ url: `${base}/`, timeoutMs });
  if (!raiz.state.landingVisivel || raiz.state.editorVisivel) {
    throw new Error("raiz do domínio não exibiu o placeholder comercial");
  }
```

- [ ] **Step 3: Rodar a suíte completa**

Run:
```bash
node tests/server.js 8000 &
sleep 1
node --test tests/tenant.test.js
node tests/run.js http://127.0.0.1:8000/joao
```
Expected: unitários PASS; matriz com 19 casos, corrida em 2 formatos, tenants e isolamento OK

- [ ] **Step 4: Commit**

```bash
git add tests/harness.js tests/run.js
git commit -m "test: tenants, fail closed e isolamento entre clientes"
```

---

### Task 14: Verificador de migração

**Files:**
- Modify: `tests/verify_migration.py`

**Interfaces:**
- Consumes: `static/js/{editor,tenant,bootstrap}.js`.
- Produces: `verificar_core_sem_tenant()`, `verificar_sem_premissa_quadrada()`, `verificar_sem_execucao_de_config()`, registradas no `main()` existente.

- [ ] **Step 1: Acrescentar as verificações**

Em `tests/verify_migration.py`:

```python
import re

CORE = ROOT / "static" / "js" / "editor.js"

# String delimitada por aspas, não substring solta: "gd" casa dentro de
# qualquer identificador e geraria falso positivo em código legítimo.
NOMES_PROIBIDOS = ["gd", "rosa", "azul"]


def verificar_core_sem_tenant() -> None:
    fonte = CORE.read_text(encoding="utf-8")
    for nome in NOMES_PROIBIDOS:
        padrao = re.compile(rf"""['"]{re.escape(nome)}['"]""")
        encontrados = padrao.findall(fonte)
        assert not encontrados, (
            f"editor.js contém o literal {nome!r}: cliente ou template "
            f"hardcoded no core ({len(encontrados)} ocorrência(s))"
        )


def verificar_sem_premissa_quadrada() -> None:
    fonte = CORE.read_text(encoding="utf-8")
    assert "const SIZE" not in fonte, "editor.js ainda declara SIZE fixo"

    # 1080 é legítimo dentro de FORMAT_DIMS e em lugar nenhum mais.
    fora_do_enum = [
        linha.strip()
        for linha in fonte.splitlines()
        if "1080" in linha
        and not re.search(r"(quadrado|feed|story):\s*Object\.freeze", linha)
    ]
    assert not fora_do_enum, "1080 fora de FORMAT_DIMS: " + "; ".join(fora_do_enum)


def verificar_sem_execucao_de_config() -> None:
    """Config de tenant é dado público: nunca pode virar código."""
    for arquivo in ["tenant.js", "bootstrap.js", "editor.js"]:
        fonte = (ROOT / "static" / "js" / arquivo).read_text(encoding="utf-8")
        for perigoso in ["eval(", "new Function("]:
            assert perigoso not in fonte, f"{arquivo} usa {perigoso}"
```

Registrar as três funções na lista de verificações executadas pelo `main()`.

- [ ] **Step 2: Confirmar o escopo das verificações existentes**

Conferir que as checagens de `/api/render` e `FormData` continuam ativas e que a busca de nomes proibidos olha apenas para `static/js/`, nunca para `static/tenants/` nem `tests/` — onde `gd`, `rosa` e `azul` são legítimos.

- [ ] **Step 3: Rodar**

Run: `python tests/verify_migration.py`
Expected: todas as verificações OK

- [ ] **Step 4: Commit**

```bash
git add tests/verify_migration.py
git commit -m "test: verificador por literal delimitado, sem falso positivo"
```

---

# FASE 5 — Cloudflare

### Task 15: Cloudflare Workers Static Assets

Estrutura e configuração. Sem deploy.

**Files:**
- Create: `wrangler.toml`, `public/_headers`
- Move: `index.html` e `static/` para `public/`
- Delete: `vercel.json`, `.vercelignore`
- Modify: `tests/server.js` (raiz default)

**Interfaces:**
- Consumes: estrutura estática das fases anteriores.
- Produces: `public/` como raiz publicável; `tests/server.js` passa a servir `public/` por padrão.

- [ ] **Step 1: Mover os arquivos publicáveis**

```bash
mkdir -p public
git mv index.html public/index.html
git mv static public/static
```

- [ ] **Step 2: Escrever `public/_headers`**

```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'

/static/tenants/:slug/config.json
  Cache-Control: public, max-age=0, must-revalidate

/static/css/*
  Cache-Control: public, max-age=0, must-revalidate

/static/js/*
  Cache-Control: public, max-age=0, must-revalidate
```

`img-src` precisa de `blob:` e `data:`: preview e exportação criam object URLs a partir do canvas. Sem isso o produto quebra.

O `config.json` já é revalidável por padrão no Workers Static Assets; o header está declarado para tornar a política parte do contrato da aplicação e sobreviver a qualquer tentativa futura de otimizar cache.

- [ ] **Step 3: Escrever `wrangler.toml`**

```toml
name = "avatar"
compatibility_date = "2026-08-18"

[assets]
directory = "./public"
not_found_handling = "single-page-application"
```

`single-page-application` faz `/gd` e `/joao` devolverem o mesmo `index.html` com HTTP 200; o tenant é resolvido no cliente.

- [ ] **Step 4: Remover a configuração da Vercel**

```bash
git rm vercel.json
git rm --ignore-unmatch .vercelignore
```

- [ ] **Step 5: Apontar o servidor de teste para `public/`**

Em `tests/server.js`, trocar o default da raiz:

```js
  const raiz = path.resolve(process.argv[3] || path.join(__dirname, "..", "public"));
```

- [ ] **Step 6: Rodar tudo contra a nova estrutura**

Run:
```bash
node tests/server.js 8000 &
sleep 1
node --test tests/tenant.test.js
node tests/run.js http://127.0.0.1:8000/joao
python tests/verify_migration.py
```
Expected: tudo PASS

Ajustar em `tests/verify_migration.py` os caminhos que apontavam para `static/` na raiz, que agora vivem em `public/static/`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: estrutura public/ e config Cloudflare Workers Static Assets"
```

---

# FASE 6 — Documentação

### Task 16: README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: tudo.
- Produces: procedimento replicável de onboarding de cliente.

- [ ] **Step 1: Reescrever o README**

Substituir o conteúdo por estas seções, nesta ordem:

1. **O que é** — editor de arte de campanha, 100% client-side, multi-tenant.
2. **Arquitetura** — core genérico + `TenantConfig`; diagrama da spec §28; regra de ouro: adicionar cliente, template ou asset nunca exige alterar o core.
3. **Estrutura de diretórios** — `public/` publicável; `tests/`, `docs/`, `wrangler.toml` fora.
4. **Como rodar localmente** — `node tests/server.js 8000` e abrir `http://127.0.0.1:8000/gd`.
5. **Formatos oficiais** — tabela `quadrado` 1080×1080, `feed` 1080×1350, `story` 1080×1920; o tenant habilita, não define.
6. **Como adicionar um novo cliente** — os 11 passos abaixo.
7. **Como adicionar um template a um cliente existente** — nova pasta em `masks/`, nova entrada em `templates[]`, um asset por formato habilitado, incrementar `version`.
8. **Como habilitar um formato novo** — acrescentar ao array `formats` **e** o asset correspondente em todo template, senão a validação recusa o config.
9. **Cache** — `version` é o que quebra cache de asset; incrementar sempre que trocar arte.
10. **Regras de segurança** — `config.json` é público; nunca guardar segredo; assets sempre relativos; nada de `../`, caminho absoluto ou URL externa.
11. **Testes** — o que cada comando cobre.
12. **Deploy Cloudflare** — `wrangler deploy`, `public/` como diretório de assets, SPA fallback; deixar explícito que o deploy ainda não foi executado.

Os 11 passos da seção 6:

```text
1.  copiar static/tenants/_template para public/static/tenants/<slug>
2.  escolher o slug (a-z, 0-9, hífen; sem maiúscula, espaço ou acento)
3.  editar config.json (slug, brand, formats, templates, defaults)
4.  substituir logo.png
5.  adicionar os templates em masks/<template-id>/
6.  adicionar o asset de cada formato habilitado
7.  conferir defaults.template e defaults.format
8.  incrementar version ao substituir qualquer asset
9.  rodar node --test tests/tenant.test.js e node tests/run.js
10. commit
11. push
```

- [ ] **Step 2: Adicionar o checklist de publicação**

```markdown
## Checklist antes de publicar um cliente

- [ ] slug em minúsculas, sem acento, sem espaço, fora da lista de reservados
- [ ] `config.json` valida (`node --test tests/tenant.test.js`)
- [ ] logo carrega
- [ ] todos os templates aparecem
- [ ] todos os formatos habilitados aparecem
- [ ] cada template tem asset para cada formato habilitado
- [ ] `defaults.template` e `defaults.format` existem
- [ ] upload de foto, zoom, rotação, centralizar e download funcionam
- [ ] o PNG sai com as dimensões do formato escolhido
- [ ] nenhum asset de outro tenant é carregado (aba Network)
- [ ] `version` incrementado se algum asset foi substituído
```

- [ ] **Step 3: Confirmar que o README não documenta mais o stack removido**

Run: `grep -niE "flask|gunicorn|/api/render|vercel" README.md`
Expected: nenhuma saída, ou apenas menção histórica explícita

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README multi-tenant com onboarding de cliente"
```

---

## Critérios finais de aceite

- [ ] `/gd` e `/joao` funcionam e usam o mesmo core
- [ ] identidade e assets isolados entre tenants
- [ ] nenhum literal `'gd'`, `'rosa'`, `'azul'` em `editor.js`
- [ ] templates dinâmicos: 1, 2 e 5+ funcionam sem tocar no core
- [ ] `quadrado` exporta 1080×1080, `feed` 1080×1350, `story` 1080×1920
- [ ] preview e download continuam pixel-perfect equivalentes
- [ ] EXIF, zoom, rotação e a correção de race condition seguem funcionando
- [ ] trocar template preserva o enquadramento
- [ ] trocar formato executa reset + autoFit
- [ ] config inválida nunca inicializa o editor nem parcialmente
- [ ] raiz do domínio mostra o placeholder comercial
- [ ] novo cliente pode ser criado sem alterar `editor.js`
- [ ] `public/`, `_headers` e `wrangler.toml` prontos, sem deploy executado
- [ ] README documenta o onboarding completo
