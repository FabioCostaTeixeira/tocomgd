# Migração para Render no Cliente — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** Eliminar o backend Python, passando a gerar o PNG final no próprio navegador, para que o site suporte picos de 2.500 acessos e deixe de esbarrar no limite de 4,5 MB das Vercel Functions.

**Arquitetura:** O `<canvas>` de 1080×1080 já contém exatamente a imagem final. Em vez de reenviar a foto ao servidor para o Pillow recompor tudo, o download passa a sair de `canvas.toBlob()`. O site vira conteúdo estático servido pela CDN da Vercel, sem nenhuma Function.

**Stack:** HTML + CSS + JavaScript puro (sem framework, sem build). Testes automatizados via Chrome DevTools Protocol dirigido por Node. Fixtures de imagem geradas com Pillow em um virtualenv local (dependência apenas de desenvolvimento, fora do deploy).

## Restrições Globais

- **Nada de backend em produção.** Ao final não pode restar `app.py`, `requirements.txt`, `Dockerfile`, `Procfile` nem qualquer rota `/api/*`.
- **Decodificação da foto pelo elemento `<img>`**, nunca por `createImageBitmap`. Motivo: o `<img>` aplica a orientação EXIF via default do CSS `image-orientation: from-image`, com suporte mais amplo (`createImageBitmap` com `imageOrientation:'from-image'` cobre só 92,84% e falha em Samsung Internet <23, UC Browser e QQ Browser).
- **Cap de lado da imagem de trabalho: 2560 px.** Saída é 1080; o auto-fit encaixa em 972 px e o zoom máximo é 250%, logo 972 × 2,5 = 2430 px é o máximo que chega a aparecer. 2560 dá margem sem desperdiçar memória.
- **Limite de upload permanece 15 MB**, validado no cliente antes de decodificar.
- **Máscaras seguem same-origin** em `/static/img/`. Movê-las para outro domínio contamina o canvas e faz `toBlob()` lançar `SecurityError`.
- **Formatos aceitos:** `image/jpeg`, `image/png`, `image/webp`.
- **Saída:** PNG 1080×1080, nome `arte-campanha-<mascara>-1080x1080.png`.
- **Textos em português do Brasil**, mantendo o tom já usado na interface.
- **Branch de trabalho:** `dev`. Merge em `master` só após teste em dispositivo real. Rollback = commit `8886dd1`.

---

## Estrutura de Arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `index.html` | Página única, sem Jinja, na raiz (Vercel serve a raiz como estático) | Criar (a partir de `templates/index.html`) |
| `static/js/editor.js` | Todo o editor: carregar, enquadrar, exportar | Modificar |
| `static/css/style.css` | Estilos; ganha o bloco do resultado para salvar no iOS | Modificar |
| `vercel.json` | Config estática + cache das máscaras | Reescrever |
| `.vercelignore` | Mantém `docs/`, `tests/` e o venv fora do deploy | Criar |
| `requirements-dev.txt` | Pillow, só para gerar fixtures e comparar imagens nos testes | Criar |
| `tests/harness.js` | Runner CDP reaproveitável (abre Chrome, sobe foto, captura canvas e download) | Criar |
| `tests/fixtures.py` | Gera as fotos-problema do plano do cliente | Criar |
| `tests/run.js` | Executa a matriz de testes e emite veredito | Criar |
| `app.py` | — | **Apagar** |
| `requirements.txt` | — | **Apagar** |
| `Dockerfile` | — | **Apagar** |
| `Procfile` | — | **Apagar** |
| `templates/index.html` | — | **Apagar** (vira `index.html`) |

---

### Task 1: Infra de testes no navegador

Sem isto as tarefas seguintes não têm como ser verificadas. O runner é o mesmo mecanismo já usado para provar a correção do WYSIWYG.

**Files:**
- Create: `tests/harness.js`
- Create: `tests/fixtures.py`
- Create: `requirements-dev.txt`

**Interfaces:**
- Produz: `runCase({ url, photoPath, viewport })` → `Promise<{ previewPng: Buffer, downloadPng: Buffer }>`, usada pelas Tasks 2, 3 e 5.

- [ ] **Step 1: Declarar a dependência de desenvolvimento**

`requirements-dev.txt`:

```
Pillow>=12,<13
```

- [ ] **Step 2: Escrever o gerador de fixtures**

`tests/fixtures.py`:

```python
"""Gera as fotos-problema usadas na matriz de testes."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "fixtures"
OUT.mkdir(exist_ok=True)


def _padrao(w: int, h: int) -> Image.Image:
    """Imagem com marcos geométricos, para medir posição e orientação."""
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for i in range(0, h, 4):
        c = int(255 * i / h)
        d.rectangle([0, i, w, i + 4], fill=(c, 80, 255 - c))
    d.ellipse([w * 0.25, h * 0.15, w * 0.75, h * 0.85],
              fill=(255, 240, 0), outline=(0, 0, 0), width=max(4, w // 100))
    # Marco no CANTO SUPERIOR ESQUERDO: revela rotação EXIF errada.
    d.rectangle([w * 0.03, h * 0.03, w * 0.18, h * 0.18], fill=(0, 200, 60))
    return img


def _exif(orientation: int) -> Image.Exif:
    exif = Image.Exif()
    exif[0x0112] = orientation  # tag Orientation
    return exif


def main() -> None:
    _padrao(4000, 3000).save(OUT / "12mp.jpg", quality=88)
    _padrao(8000, 6000).save(OUT / "48mp.jpg", quality=85)

    retrato = _padrao(3000, 4000)
    retrato.save(OUT / "exif6.jpg", quality=88, exif=_exif(6))
    retrato.save(OUT / "exif8.jpg", quality=88, exif=_exif(8))

    transp = _padrao(1200, 1600).convert("RGBA")
    transp.putalpha(Image.new("L", transp.size, 255))
    borda = Image.new("RGBA", (1800, 2000), (0, 0, 0, 0))
    borda.paste(transp, (300, 200), transp)
    borda.save(OUT / "transparente.png")

    _padrao(2000, 1500).save(OUT / "foto.webp", format="WEBP", quality=85)

    # Arquivo perto do teto de 15 MB: ruído aleatório não comprime, então o
    # JPEG fica grande de verdade e mede o tempo de decodificação no aparelho.
    import os

    ruido = Image.frombytes("RGB", (6000, 4500), os.urandom(6000 * 4500 * 3))
    ruido.paste(_padrao(6000, 4500).crop((0, 0, 3000, 2250)), (0, 0))
    ruido.save(OUT / "pesada.jpg", quality=97, subsampling=0)

    for f in sorted(OUT.iterdir()):
        print(f"{f.name:20} {f.stat().st_size / 1024:8.0f} KB")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Gerar as fixtures e conferir**

```bash
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
./.venv/Scripts/python.exe tests/fixtures.py
```

Esperado: sete arquivos listados — `12mp.jpg`, `48mp.jpg`, `exif6.jpg`, `exif8.jpg`, `transparente.png`, `foto.webp`, `pesada.jpg`.

- [ ] **Step 4: Escrever o runner CDP**

`tests/harness.js`:

```js
// Runner de testes: abre o Chrome headless, sobe uma foto pela interface real,
// e devolve os pixels da prévia e os do arquivo baixado.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_PATH
  || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function conectar(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pendentes = {};
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendentes[m.id]) { pendentes[m.id](m); delete pendentes[m.id]; }
  });
  const pronto = new Promise((r) => ws.addEventListener("open", r));
  const call = (method, params) => new Promise((resolve) => {
    const meu = id++;
    ws.send(JSON.stringify({ id: meu, method, params }));
    pendentes[meu] = resolve;
  });
  return { pronto, call, fechar: () => ws.close() };
}

async function abrirChrome(url, porta) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfil}`, "--no-first-run", url,
  ], { stdio: "ignore" });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`http://127.0.0.1:${porta}/json`);
      const alvo = (await res.json())
        .find((t) => t.type === "page" && t.url.startsWith(url.split("?")[0]));
      if (alvo) return { proc, wsUrl: alvo.webSocketDebuggerUrl };
    } catch { /* ainda subindo */ }
  }
  proc.kill();
  throw new Error("Chrome não respondeu na porta " + porta);
}

/**
 * Sobe uma foto pela interface e captura prévia + download.
 * @returns {Promise<{previewPng: Buffer, downloadPng: Buffer}>}
 */
async function runCase({ url, photoPath, viewport = { width: 900, height: 1000 }, porta = 9400 }) {
  const { proc, wsUrl } = await abrirChrome(url, porta);
  const cdp = conectar(wsUrl);
  await cdp.pronto;

  const evalJs = async (expression, awaitPromise = false) => {
    const r = await cdp.call("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise,
    });
    if (r.result.exceptionDetails) {
      throw new Error(JSON.stringify(r.result.exceptionDetails));
    }
    return r.result.result.value;
  };

  try {
    await cdp.call("Emulation.setDeviceMetricsOverride", {
      ...viewport, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.call("DOM.enable", {});
    const doc = await cdp.call("DOM.getDocument", { depth: -1, pierce: true });
    const no = await cdp.call("DOM.querySelector", {
      nodeId: doc.result.root.nodeId, selector: "#photoInput",
    });
    await cdp.call("DOM.setFileInputFiles", {
      files: [photoPath], nodeId: no.result.nodeId,
    });
    await evalJs(
      `document.getElementById('photoInput')`
      + `.dispatchEvent(new Event('change',{bubbles:true}))`
    );

    const inicio = Date.now();
    let pronto = false;
    while (Date.now() - inicio < 60000) {
      await new Promise((r) => setTimeout(r, 500));
      if (await evalJs(`document.getElementById('adjustments').hidden===false`)) {
        pronto = true;
        break;
      }
    }
    if (!pronto) throw new Error("foto não carregou em 60s");

    const previa = await evalJs(
      `document.getElementById('artCanvas').toDataURL('image/png')`
    );

    const baixado = await evalJs(`(async () => {
      const btn = document.getElementById('downloadButton');
      if (btn.disabled) throw new Error('botão de download desabilitado');
      const orig = URL.createObjectURL;
      let capturado = null;
      URL.createObjectURL = function (b) { capturado = b; return orig.call(URL, b); };
      btn.click();
      for (let i = 0; i < 200 && !capturado; i++) {
        await new Promise(r => setTimeout(r, 100));
      }
      URL.createObjectURL = orig;
      if (!capturado) throw new Error('nenhum blob gerado');
      return await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(capturado);
      });
    })()`, true);

    return {
      previewPng: Buffer.from(previa.split(",")[1], "base64"),
      downloadPng: Buffer.from(baixado.split(",")[1], "base64"),
    };
  } finally {
    cdp.fechar();
    proc.kill();
  }
}

module.exports = { runCase };
```

- [ ] **Step 5: Commit**

```bash
git add tests/harness.js tests/fixtures.py requirements-dev.txt
git commit -m "test: adiciona runner CDP e gerador de fixtures"
```

---

### Task 2: Reduzir a foto uma única vez ao carregar

Hoje `personImage` é o `<img>` no tamanho original. Cada `pointermove` redesenha a partir dele, o que trava o arrasto em fotos grandes. Passa a existir uma imagem de trabalho limitada a 2560 px.

**Files:**
- Modify: `static/js/editor.js` (bloco de estado e `loadPersonFromBlob`)
- Test: `tests/run.js` (criado na Task 5; nesta task a verificação é manual pelo runner)

**Interfaces:**
- Consome: `runCase()` da Task 1.
- Produz: variáveis de módulo `personW` e `personH` (números, dimensões da imagem de trabalho) e `personImage` (`HTMLImageElement` **ou** `HTMLCanvasElement`). Todo consumidor deve usar `personW`/`personH`, nunca `naturalWidth`/`naturalHeight`, já que um canvas não possui essas propriedades.

- [ ] **Step 1: Declarar o cap e as dimensões de trabalho**

Em `static/js/editor.js`, logo após `const SIZE = 1080;`:

```js
  // Saída é 1080; o auto-fit encaixa em 972px e o zoom vai até 250%,
  // logo 972 * 2.5 = 2430px é o máximo que chega a aparecer na arte.
  // Guardar mais que isso só consome memória e trava o arrasto.
  const MAX_WORK_SIDE = 2560;
```

E, junto das demais variáveis de estado (perto de `let personImage = null;`):

```js
  let personW = 0;
  let personH = 0;
```

- [ ] **Step 2: Trocar todas as leituras de `naturalWidth`/`naturalHeight`**

São cinco pontos. Em `clampPerson()`:

```js
  function clampPerson() {
    if (!personImage) return;
    const width = personW * person.scale;
    const height = personH * person.scale;
    const minVisible = SIZE * 0.16;

    person.x = clamp(person.x, minVisible - width / 2, SIZE - minVisible + width / 2);
    person.y = clamp(person.y, minVisible - height / 2, SIZE - minVisible + height / 2);
  }
```

Em `draw()`:

```js
    if (personImage) {
      const width = personW * person.scale;
      const height = personH * person.scale;
      ctx.drawImage(
        personImage,
        person.x - width / 2,
        person.y - height / 2,
        width,
        height
      );
    }
```

Em `autoFitPerson()`:

```js
    const scaleByWidth = (SIZE * 0.90) / personW;
    const scaleByHeight = (SIZE * 0.94) / personH;
    baseScale = Math.min(scaleByWidth, scaleByHeight);

    person.scale = baseScale;
    person.x = SIZE / 2;

    const renderedHeight = personH * person.scale;
```

- [ ] **Step 3: Reduzir a imagem ao carregar**

Substituir `loadPersonFromBlob` inteira:

```js
  async function loadPersonFromBlob(blob) {
    if (personUrl) URL.revokeObjectURL(personUrl);
    personUrl = URL.createObjectURL(blob);

    // A decodificação passa pelo elemento <img> de propósito: é ele que aplica
    // a orientação EXIF, pelo padrão do CSS image-orientation: from-image.
    // createImageBitmap teria a mesma função, mas a opção imageOrientation
    // não existe em Samsung Internet antigo, UC Browser e QQ Browser.
    const image = new Image();
    image.decoding = "async";
    image.src = personUrl;
    await image.decode();

    const maior = Math.max(image.naturalWidth, image.naturalHeight);

    if (maior > MAX_WORK_SIDE) {
      // Reduz uma única vez: o arrasto redesenha a cada quadro e não pode
      // reamostrar uma foto de 48 MP a cada movimento do dedo.
      const fator = MAX_WORK_SIDE / maior;
      const work = document.createElement("canvas");
      work.width = Math.max(1, Math.round(image.naturalWidth * fator));
      work.height = Math.max(1, Math.round(image.naturalHeight * fator));
      work.getContext("2d").drawImage(image, 0, 0, work.width, work.height);

      personImage = work;
      personW = work.width;
      personH = work.height;

      // Libera a foto original assim que a versão reduzida existe.
      URL.revokeObjectURL(personUrl);
      personUrl = null;
    } else {
      personImage = image;
      personW = image.naturalWidth;
      personH = image.naturalHeight;
    }

    emptyState.hidden = true;
    adjustments.hidden = false;
    primaryControls.hidden = true;
    downloadButton.disabled = false;
    autoFitPerson();
  }
```

- [ ] **Step 4: Verificar que nada ficou para trás**

```bash
grep -n "naturalWidth\|naturalHeight" static/js/editor.js
```

Esperado: apenas as ocorrências **dentro** de `loadPersonFromBlob` (as que leem `image.naturalWidth`). Qualquer outra é bug — um canvas não tem essa propriedade e o resultado seria `NaN`.

- [ ] **Step 5: Testar com a foto de 48 MP**

Com o servidor Flask ainda de pé (`./.venv/Scripts/python.exe app.py`):

```bash
node -e "
const { runCase } = require('./tests/harness');
runCase({ url:'http://127.0.0.1:5000/', photoPath: require('path').resolve('tests/fixtures/48mp.jpg') })
  .then(r => { require('fs').writeFileSync('/tmp/t2.png', r.previewPng); console.log('prévia OK', r.previewPng.length, 'bytes'); })
  .catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
"
```

Esperado: `prévia OK` com tamanho não nulo. Se sair `NaN` na tela ou o canvas vier em branco, algum `naturalWidth` escapou do Step 2.

- [ ] **Step 6: Commit**

```bash
git add static/js/editor.js
git commit -m "perf: reduz a foto uma vez ao carregar, com limite de 2560px"
```

---

### Task 3: Gerar o PNG no navegador

**Files:**
- Modify: `static/js/editor.js` (handler do botão de download)
- Modify: `static/css/style.css` (bloco do resultado)
- Modify: `templates/index.html` (bloco do resultado)

**Interfaces:**
- Consome: `personW`/`personH` da Task 2.
- Produz: função `exportarArte(): Promise<Blob>` e o elemento `#resultCard`, usados pela Task 5.

- [ ] **Step 1: Adicionar o bloco de resultado ao HTML**

Em `templates/index.html`, logo **depois** do `</section>` do `editor-card` e **antes** do `<button ... id="downloadButton">`:

```html
      <div class="result-card" id="resultCard" hidden>
        <img id="resultImage" alt="Arte pronta para salvar">
        <p id="resultHint">Toque e segure na imagem para salvar em Fotos.</p>
      </div>
```

- [ ] **Step 2: Estilizar o bloco**

Ao final de `static/css/style.css`, antes do bloco `@media (min-width: 960px)`:

```css
.result-card {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  text-align: center;
}

.result-card img {
  display: block;
  width: 100%;
  border-radius: var(--radius-lg);
}

.result-card p {
  margin: 10px 4px 0;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.45;
}
```

- [ ] **Step 3: Substituir o handler de download**

Trocar todo o bloco `downloadButton.addEventListener("click", ...)` por:

```js
  const resultCard = document.getElementById("resultCard");
  const resultImage = document.getElementById("resultImage");
  const resultHint = document.getElementById("resultHint");

  // iOS Safari costuma ignorar o atributo download e abrir a imagem em vez de
  // salvá-la. Nesses aparelhos o caminho confiável é exibir o resultado para o
  // usuário segurar e escolher "Salvar em Fotos".
  const ehIOS = /iP(hone|ad|od)/.test(navigator.platform)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function exportarArte() {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível gerar o PNG."));
      }, "image/png");
    });
  }

  downloadButton.addEventListener("click", async () => {
    if (!personImage || isBusy) return;

    setBusy(true, "Gerando a arte…", "Preparando o PNG em 1080×1080.");

    try {
      draw();
      const blob = await exportarArte();
      const url = URL.createObjectURL(blob);
      const nome = `arte-campanha-${selectedMask}-1080x1080.png`;

      if (ehIOS) {
        resultImage.src = url;
        resultCard.hidden = false;
        resultHint.textContent = "Toque e segure na imagem para salvar em Fotos.";
        resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast("Arte pronta. Segure na imagem para salvar.", "success");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = nome;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 3000);
        showToast("Imagem gerada com sucesso.", "success");
      }
    } catch (error) {
      showToast(error.message || "Não foi possível gerar a imagem.", "error");
    } finally {
      setBusy(false);
    }
  });
```

- [ ] **Step 4: Remover o que ficou órfão**

`processedBlob` e `responseError` deixam de ter uso. Conferir e apagar:

```bash
grep -n "processedBlob\|responseError\|/api/render" static/js/editor.js
```

Apagar a declaração `let processedBlob = null;`, a atribuição `processedBlob = blob;` dentro de `loadPersonFromBlob` e a função `responseError` inteira. Rodar o `grep` de novo — deve não retornar nada.

- [ ] **Step 5: Testar que o download não toca mais a rede**

```bash
node -e "
const { runCase } = require('./tests/harness');
const path = require('path');
runCase({ url:'http://127.0.0.1:5000/', photoPath: path.resolve('tests/fixtures/12mp.jpg') })
  .then(r => {
    const fs = require('fs');
    fs.writeFileSync('/tmp/t3-previa.png', r.previewPng);
    fs.writeFileSync('/tmp/t3-baixado.png', r.downloadPng);
    console.log('prévia', r.previewPng.length, '| baixado', r.downloadPng.length);
    if (!r.previewPng.equals(r.downloadPng)) throw new Error('prévia e download diferem');
    console.log('IDÊNTICOS byte a byte');
  })
  .catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
"
```

Esperado: `IDÊNTICOS byte a byte`. Agora os dois saem do mesmo `canvas`, então a igualdade é exata — diferente da comparação com o Pillow, que tinha 1px de antialiasing.

- [ ] **Step 6: Commit**

```bash
git add static/js/editor.js static/css/style.css templates/index.html
git commit -m "feat: gera o PNG final no navegador, sem passar pelo servidor"
```

---

### Task 4: Virar site estático

**Files:**
- Create: `index.html`
- Create: `.vercelignore`
- Modify: `vercel.json`
- Delete: `app.py`, `requirements.txt`, `Dockerfile`, `Procfile`, `templates/index.html`

- [ ] **Step 1: Converter o template**

```bash
git mv templates/index.html index.html
rmdir templates
```

Trocar as cinco chamadas Jinja por caminhos diretos:

```bash
sed -i \
  -e "s|{{ url_for('static', filename='css/style.css') }}|static/css/style.css|g" \
  -e "s|{{ url_for('static', filename='js/editor.js') }}|static/js/editor.js|g" \
  -e "s|{{ url_for('static', filename='img/mascara-rosa.png') }}|static/img/mascara-rosa.png|g" \
  -e "s|{{ url_for('static', filename='img/mascara-azul.png') }}|static/img/mascara-azul.png|g" \
  index.html
grep -c "url_for" index.html
```

Esperado: `0`.

- [ ] **Step 2: Atualizar o aviso de privacidade**

A foto deixa de sair do aparelho. Em `index.html`, substituir o texto dentro de `<p class="privacy-note">`:

```html
      A foto é processada no seu próprio aparelho e não é enviada para nenhum servidor.
```

- [ ] **Step 3: Reescrever a configuração da Vercel**

`vercel.json`:

```json
{
  "cleanUrls": true,
  "headers": [
    {
      "source": "/static/img/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/static/(css|js)/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

As máscaras somam 630 KB e nunca mudam — cache imutável tira esse peso de quem volta ao site. Já o CSS e o JS revalidam sempre, para que uma correção chegue ao usuário no próximo carregamento.

- [ ] **Step 4: Manter o material de desenvolvimento fora do deploy**

`.vercelignore`:

```
.venv/
__pycache__/
docs/
tests/
requirements-dev.txt
```

- [ ] **Step 5: Apagar o backend**

```bash
git rm app.py requirements.txt Dockerfile Procfile
```

- [ ] **Step 6: Conferir que não sobrou nenhuma referência**

```bash
grep -rn "api/render\|flask\|Flask\|gunicorn\|rembg" --include=*.js --include=*.html --include=*.json . | grep -v node_modules | grep -v "^./docs/"
```

Esperado: nenhuma saída.

- [ ] **Step 7: Servir localmente e validar**

```bash
python -m http.server 8000 &
node -e "
const { runCase } = require('./tests/harness');
const path = require('path');
runCase({ url:'http://127.0.0.1:8000/', photoPath: path.resolve('tests/fixtures/12mp.jpg'), porta: 9401 })
  .then(r => {
    if (!r.previewPng.equals(r.downloadPng)) throw new Error('prévia e download diferem');
    console.log('site estático OK — prévia == download');
  })
  .catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
"
```

Esperado: `site estático OK — prévia == download`, servido sem nenhum processo Python envolvido no request.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove o backend Python e serve o site como estático"
```

---

### Task 5: Matriz de testes das fotos-problema

**Files:**
- Create: `tests/run.js`
- Create: `tests/compare.py`

**Interfaces:**
- Consome: `runCase()` (Task 1), fixtures (Task 1), site estático (Task 4).

- [ ] **Step 1: Escrever o comparador de imagens**

`tests/compare.py`:

```python
"""Confere geometria e orientação de uma arte gerada."""
import sys

from PIL import Image

CANVAS = 1080


def marco_verde(caminho: str):
    """Devolve o centro do quadrado verde, que fica no canto superior esquerdo
    da foto original. Se a orientação EXIF for ignorada, ele aparece em outro
    canto e o teste acusa."""
    im = Image.open(caminho).convert("RGB")
    if im.size != (CANVAS, CANVAS):
        print(f"ERRO: esperado {CANVAS}x{CANVAS}, veio {im.size}")
        sys.exit(1)
    px = im.load()
    xs, ys = [], []
    for y in range(0, CANVAS, 2):
        for x in range(0, CANVAS, 2):
            r, g, b = px[x, y]
            if g > 150 and r < 110 and b < 110:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (sum(xs) // len(xs), sum(ys) // len(ys))


if __name__ == "__main__":
    caminho = sys.argv[1]
    centro = marco_verde(caminho)
    print(f"{caminho}: marco verde em {centro}")
```

- [ ] **Step 2: Escrever a matriz**

`tests/run.js`:

```js
// Roda a matriz de fotos-problema contra o site e emite um veredito.
const fs = require("fs");
const path = require("path");
const { runCase } = require("./harness");

const URL_BASE = process.env.TEST_URL || "http://127.0.0.1:8000/";
const FIX = path.join(__dirname, "fixtures");
const SAIDA = path.join(__dirname, "saida");

const CASOS = [
  { arquivo: "12mp.jpg", desc: "foto típica de celular (4000x3000)" },
  { arquivo: "48mp.jpg", desc: "foto de 48 MP (8000x6000)" },
  { arquivo: "exif6.jpg", desc: "retrato com EXIF 6 (girado 90° horário)" },
  { arquivo: "exif8.jpg", desc: "retrato com EXIF 8 (girado 90° anti-horário)" },
  { arquivo: "transparente.png", desc: "PNG com margens transparentes" },
  { arquivo: "foto.webp", desc: "WEBP" },
  { arquivo: "pesada.jpg", desc: "arquivo perto do teto de 15 MB" },
];

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  let falhas = 0;
  let porta = 9410;

  for (const caso of CASOS) {
    const foto = path.join(FIX, caso.arquivo);
    process.stdout.write(`${caso.arquivo.padEnd(20)} ${caso.desc.padEnd(42)} `);
    const t0 = Date.now();
    try {
      const r = await runCase({ url: URL_BASE, photoPath: foto, porta: porta++ });
      const base = path.join(SAIDA, caso.arquivo.replace(/\.\w+$/, ""));
      fs.writeFileSync(`${base}-previa.png`, r.previewPng);
      fs.writeFileSync(`${base}-baixado.png`, r.downloadPng);

      if (!r.previewPng.equals(r.downloadPng)) {
        console.log(`FALHOU (prévia != download)`);
        falhas++;
        continue;
      }
      console.log(`OK  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.log(`FALHOU (${e.message})`);
      falhas++;
    }
  }

  console.log(`\n${CASOS.length - falhas}/${CASOS.length} casos passaram`);
  console.log(`imagens em ${SAIDA} — conferir orientação com tests/compare.py`);
  process.exit(falhas ? 1 : 0);
})();
```

- [ ] **Step 3: Rodar a matriz**

```bash
node tests/run.js
```

Esperado: `7/7 casos passaram`. Qualquer `FALHOU` aponta o caso e a causa.

- [ ] **Step 4: Conferir orientação de cada saída**

```bash
for f in tests/saida/*-baixado.png; do ./.venv/Scripts/python.exe tests/compare.py "$f"; done
```

O quadrado verde marca o canto **superior esquerdo** da foto original. Em `exif6` e `exif8` ele precisa aparecer em cantos **diferentes** entre si — se cair no mesmo lugar nos dois, a orientação EXIF foi ignorada.

- [ ] **Step 5: Inspecionar visualmente as sete artes**

Abrir cada `tests/saida/*-baixado.png` e confirmar: pessoa enquadrada, máscara por cima, sem distorção de proporção e sem faixa transparente ou preta.

- [ ] **Step 6: Commit**

```bash
git add tests/run.js tests/compare.py
git commit -m "test: matriz de fotos-problema com verificação de orientação"
```

---

### Task 6: Deploy de Preview e teste em aparelho real

**Files:** nenhum arquivo de código; esta task é o portão antes da produção.

- [ ] **Step 1: Publicar a branch**

```bash
git push origin dev
```

A Vercel cria um deploy de Preview automaticamente para a branch `dev`.

- [ ] **Step 2: Confirmar que o deploy não tem Function**

Consultar o deployment da branch `dev` e verificar que `lambdaRuntimeStats` está vazio e `type` não é `LAMBDAS`. Se ainda aparecer runtime Python, o `vercel.json` da Task 4 não foi aplicado.

- [ ] **Step 3: Rodar a matriz contra o Preview**

```bash
TEST_URL="https://<url-do-preview>/" node tests/run.js
```

Esperado: `7/7 casos passaram`.

- [ ] **Step 4: Testar em aparelho real**

Abrir a URL de Preview e percorrer o fluxo completo — enviar foto, arrastar, dar zoom, trocar máscara, baixar — em:

- iPhone (Safari) — confirmar que o bloco de resultado aparece e que segurar a imagem oferece "Salvar em Fotos"
- Android intermediário (Chrome) — confirmar que o arquivo cai na pasta de downloads
- Android básico — enviar a foto de 48 MP e confirmar que a aba não recarrega por falta de memória

- [ ] **Step 5: Merge em produção**

Só após os três aparelhos passarem:

```bash
git checkout master
git merge dev
git push origin master
```

- [ ] **Step 6: Verificar produção**

```bash
TEST_URL="https://tocomgd.vercel.app/" node tests/run.js
curl -s -o /dev/null -w "%{http_code}\n" https://tocomgd.vercel.app/api/render
```

Esperado: `7/7 casos passaram` e `404` na rota antiga — prova de que não existe mais Function.

---

## Rollback

O commit `8886dd1` (`master` antes da migração) contém a versão Flask com o WYSIWYG já corrigido. Para voltar:

```bash
git checkout master
git reset --hard 8886dd1
git push --force origin master
```

A Vercel refaz o deploy sozinho a partir do push.
