# Migração para Render Client-Side — Plano Consolidado

## Objetivo

Converter o `tocomgd` em site 100% estático:

```text
Vercel CDN
   ↓
HTML / CSS / JS / máscaras
   ↓
navegador do usuário
   ↓
foto → edição → canvas 1080×1080 → PNG → download
```

Eliminar:

* Flask;
* Pillow em produção;
* Vercel Functions;
* `/api/render`;
* upload da foto;
* limite de payload de Function;
* divergência entre preview e download.

O **mesmo canvas exibido ao usuário deve ser a fonte do arquivo exportado**.

---

# Regras globais

## Arquitetura

* [ ] Nenhum backend em produção.
* [ ] Nenhuma rota `/api/*`.
* [ ] Foto nunca sai do aparelho.
* [ ] Preview e exportação usam o mesmo `<canvas>`.
* [ ] Saída: PNG 1080×1080.
* [ ] Nome: `arte-campanha-<mascara>-1080x1080.png`.
* [ ] Formatos aceitos: JPEG, PNG e WEBP.
* [ ] Limite de arquivo: 15 MB antes de qualquer processamento.
* [ ] Não recortar margens transparentes automaticamente.
* [ ] Máscaras permanecem same-origin.

## Imagem de trabalho

Usar:

```js
const MAX_WORK_SIDE = 2800;
```

Justificativa:

```text
1080 × 0,94 × 2,5 ≈ 2538 px
```

2800 mantém margem sem carregar desnecessariamente imagens de 12–48 MP durante a edição.

### Pipeline preferencial

```text
arquivo
→ validar MIME/tamanho
→ ler dimensões + orientação sem decodificar pixels
→ neutralizar a tag Orientation para 1 (sem tocar nos pixels)
→ calcular dimensões <= 2800
→ createImageBitmap com resize
→ canvas intermediário aplica a orientação lida
→ imagem de trabalho, fisicamente correta
→ canvas do editor
```

Preferir:

```js
createImageBitmap(arquivoNeutralizado, {
  resizeWidth,
  resizeHeight,
  resizeQuality: "high",
});
```

`resizeWidth` e `resizeHeight` devem preservar proporção.

**Nunca passar `imageOrientation`.** O valor `"none"` foi removido da especificação — o
HTML Standard registra que ele "foi renomeado para `from-image`" e que "no futuro, `none`
será readicionado com um significado diferente". Usá-lo hoje é um erro que muda de
comportamento sozinho amanhã. E `"from-image"` também não serve como fluxo principal:
o suporte é de 92,84% (Safari 16+, Chrome 112+), enquanto o resize existe desde
Safari 15 e Chrome 54. Na faixa entre os dois — Safari 15, Chrome 54–111 — o resize
funciona, o app não cai no fallback, e o EXIF é ignorado em silêncio.

O motivo de neutralizar não é a rotação em si, e sim o **resize**: sem saber se o
navegador vai girar a imagem, não há como calcular `resizeWidth`/`resizeHeight`. Errar o
eixo não deixa a foto girada, deixa **distorcida**. Com a tag zerada, a saída do decode é
sempre igual às dimensões cruas, em qualquer navegador.

Não usar como fluxo principal:

```js
img.src = blobUrl;
await img.decode();
```

para fotos gigantes, pois a imagem original pode ser materializada em memória antes da redução.

### A orientação continua sendo aplicada automaticamente

Neutralizar a tag **não** significa entregar a foto deitada ao usuário. Depois do resize, a
orientação lida na Task 4 é aplicada por nós em um canvas intermediário.

Motivo: foto de retrato de iPhone é gravada deitada com `Orientation = 6`. É o caso
comum, não a exceção. Entregar essa foto deitada obrigaria praticamente todo usuário de
iPhone a girar na mão — regressão frente ao comportamento atual em produção, onde o
`<img>` orienta sozinho. Como a orientação já foi lida, aplicá-la custa um `switch` curto.

A rotação manual (gesto e botão) existe como **correção**, para fotos sem EXIF ou com EXIF
errado — não como substituto da orientação automática.

### Compatibilidade

Implementar feature detection.

Se `createImageBitmap`/resize seguro não estiver disponível:

* usar `<img>` somente para imagens de tamanho considerado seguro;
* não decodificar foto gigante integralmente;
* para arquivos muito grandes, mostrar mensagem amigável pedindo uma foto menor.

Sugestão conservadora para o fallback:

```js
const MAX_FALLBACK_PIXELS = 16_000_000;
const MAX_FALLBACK_SIDE = 4096;
```

Fotos acima disso podem ser recusadas apenas no caminho legado de compatibilidade.

Mensagem:

> Não foi possível processar esta foto neste aparelho. Tente usar uma foto menor ou uma captura de tela da foto.

---

# Regra de eficiência para o agente

**Minimizar custo de tokens e contexto durante toda a execução.**

* Não repetir objetivo, arquitetura ou decisões já aprovadas.
* Ler somente arquivos/trechos necessários para a tarefa atual.
* Preferir `diff`/patch a reproduzir arquivos inteiros.
* Não reexplicar passos triviais.
* Agrupar comandos e verificações relacionadas.
* Após cada tarefa, relatar somente:

  * arquivos alterados;
  * testes executados;
  * resultado;
  * erro/bloqueio, se houver.
* Não repetir resultados já confirmados.
* Comentários no código apenas quando explicarem uma decisão não óbvia.
* Não criar abstrações ou dependências sem necessidade.
* Ao delegar para subagente, fornecer somente o contexto específico daquela tarefa.
* Se um teste passar, registrar de forma curta e prosseguir.
* Não ampliar escopo.

---

# Estratégia Git / rollback

Antes de modificar produção:

```bash
git checkout master
git pull --ff-only
git branch legacy-server
git tag pre-client-render
git push origin legacy-server
git push origin pre-client-render
```

Criar ou atualizar a branch de implementação:

```bash
git checkout -b dev
```

Se `dev` já existir, sincronizá-la intencionalmente com `master`.

O backend antigo é:

> **rollback operacional manual**

e não fallback automático.

Proibido criar:

```js
try {
  gerarLocalmente();
} catch {
  fetch("/api/render");
}
```

Uma falha comum de browser poderia jogar muitos usuários simultaneamente na Function antiga.

Também evitar `git push --force` como procedimento normal de rollback.

Se necessário:

1. usar rollback de deployment da Vercel quando disponível; ou
2. restaurar `pre-client-render`/`legacy-server` por commit/revert normal.

---

# Estrutura final

```text
/
├── index.html
├── vercel.json
├── .vercelignore
├── requirements-dev.txt
│
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── editor.js
│   └── img/
│       ├── mascara-rosa-v1.png
│       └── mascara-azul-v1.png
│
└── tests/
    ├── harness.js
    ├── fixtures.py
    ├── compare.py
    ├── run.js
    ├── fixtures/
    └── saida/
```

Remover:

```text
app.py
requirements.txt
Dockerfile
Procfile
templates/
```

---

# Task 1 — Preservar legado

* [ ] Criar `legacy-server`.
* [ ] Criar tag `pre-client-render`.
* [ ] Fazer push dos dois.
* [ ] Criar/usar `dev`.
* [ ] Confirmar working tree limpa.

Critério:

```bash
git status
```

deve mostrar nenhuma alteração antes da implementação.

---

# Task 2 — Infraestrutura de testes

Criar:

```text
requirements-dev.txt
tests/fixtures.py
tests/harness.js
tests/compare.py
```

## Dependência

`requirements-dev.txt`:

```text
Pillow>=12,<13
```

Pillow existe **somente para testes locais**.

---

## Fixtures obrigatórias

Gerar:

```text
12mp.jpg          4000×3000
48mp.jpg          8000×6000
exif1.jpg         normal
exif2.jpg         espelho horizontal
exif3.jpg         180°
exif4.jpg         espelho vertical
exif5.jpg         transpose
exif6.jpg         90° horário
exif7.jpg         transverse
exif8.jpg         90° anti-horário
transparente.png
foto.webp
pesada.jpg        entre 14 MB e 15 MB
```

As oito orientações são geradas porque o transform passa a ser nosso: sem fixture para um
caso, um erro de sinal no espelhamento passa despercebido. São arquivos pequenos.

As fixtures visuais devem possuir marcas geométricas claras, incluindo um marcador no canto superior esquerdo, para detectar orientação incorreta.

### Fixture pesada

Não usar configuração fixa que possa produzir arquivo muito acima de 15 MB.

O gerador deve ajustar qualidade/dimensões iterativamente até obter:

```python
14 * 1024 * 1024 <= tamanho < 15 * 1024 * 1024
```

E finalizar com:

```python
assert 14 * 1024 * 1024 <= tamanho < 15 * 1024 * 1024
```

Falhar se não conseguir produzir a fixture correta.

---

# Task 3 — Harness de navegador

`tests/harness.js` deve automatizar Chrome via CDP e expor:

```js
runCase({
  url,
  photoPath,
  viewport,
})
```

Retorno mínimo:

```js
{
  previewPng: Buffer,
  downloadPng: Buffer,
  networkRequests: []
}
```

Fluxo:

```text
abrir site
→ selecionar arquivo no #photoInput
→ esperar editor ficar pronto
→ capturar canvas
→ acionar botão de download
→ capturar Blob exportado
→ registrar requests de rede
```

O teste deve conseguir afirmar que nenhum download gerou chamada para:

```text
/api/*
```

Timeout máximo por foto grande deve ser explícito.

---

# Task 4 — Leitura leve de metadados

Implementar helper para obter antes da decodificação pesada:

```js
{
  rawWidth,            // dimensões como os pixels estão gravados
  rawHeight,
  orientation,         // 1..8, ou 1 quando ausente/ilegível
  orientedWidth,       // dimensões depois de aplicada a orientação
  orientedHeight,
  orientationTagOffset, // byte do VALOR da tag, ou null
  littleEndian
}
```

Regra das dimensões orientadas:

```js
const swapsAxes = [5, 6, 7, 8].includes(orientation);

orientedWidth  = swapsAxes ? rawHeight : rawWidth;
orientedHeight = swapsAxes ? rawWidth  : rawHeight;
```

Exemplo — JPEG físico 4000×3000 com `Orientation = 6`:

```text
rawWidth       = 4000
rawHeight      = 3000
orientation    = 6
orientedWidth  = 3000
orientedHeight = 4000
```

Suportar:

```text
JPEG
PNG
WEBP
```

Para JPEG, ler também EXIF Orientation quando presente.

`orientationTagOffset` deve apontar para o **campo de valor** da tag, não para o início dela:
numa IFD entry o valor começa em `entryOffset + 8` (2 bytes de tag, 2 de tipo, 4 de contagem).
Escrever nos 2 primeiros bytes desse campo, respeitando `littleEndian`.

Se o arquivo não for JPEG, ou o EXIF não for legível, devolver `orientation = 1` e
`orientationTagOffset = null`. Nunca lançar exceção por metadata malformada — foto com
EXIF quebrado deve carregar e ser corrigível pela rotação manual.

Essa etapa deve trabalhar sobre `ArrayBuffer`/headers do arquivo e **não materializar todos os pixels da foto**.

---

# Task 5 — Imagem de trabalho otimizada

Em `static/js/editor.js`:

```js
const SIZE = 1080;
const MAX_WORK_SIDE = 2800;

let personImage = null;
let personW = 0;
let personH = 0;
```

Nenhuma parte do editor deve depender diretamente de:

```js
personImage.naturalWidth
personImage.naturalHeight
```

Os cálculos devem usar:

```js
personW
personH
```

Isso permite que `personImage` seja `ImageBitmap`, `<img>` ou outro source válido de `drawImage()`.

---

## Calcular resize

A partir das dimensões já orientadas:

```text
se maior eixo <= 2800
    manter dimensões
senão
    maior eixo = 2800
    outro eixo proporcional
```

Exemplo:

```js
function fitInside(width, height, maxSide) {
  const ratio = Math.min(1, maxSide / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
```

---

## Caminho principal

Usar `createImageBitmap` quando suportado.

Garantir:

```text
resize
+
orientação EXIF
+
aspect ratio
```

antes de entregar a imagem ao editor.

Liberar recursos antigos ao trocar foto:

```js
bitmap.close?.();
URL.revokeObjectURL(...);
```

quando aplicável.

---

## Fallback

Se a pipeline otimizada não existir:

```text
imagem segura
→ <img>
→ decode
→ redução
```

Se dimensões/pixels excederem o limite de fallback:

```text
não decodificar
→ mostrar erro amigável
```

---

# Task 6 — Atualizar cálculos do editor

Usar `personW/personH` em:

* `clampPerson()`;
* `draw()`;
* `autoFitPerson()`;
* qualquer cálculo de zoom/tamanho.

Exemplo:

```js
const width = personW * person.scale;
const height = personH * person.scale;
```

Auto-fit:

```js
const scaleByWidth = (SIZE * 0.90) / personW;
const scaleByHeight = (SIZE * 0.94) / personH;

baseScale = Math.min(scaleByWidth, scaleByHeight);
```

---

# Task 6b — Rotação manual

Correção para foto sem EXIF ou com EXIF errado. A orientação automática continua valendo;
isto é a saída de emergência.

Estado da pessoa ganha um campo:

```js
person = { x, y, scale, rotation };   // rotation em radianos
```

## Desenho

```js
ctx.save();
ctx.translate(person.x, person.y);
ctx.rotate(person.rotation);
ctx.drawImage(
  personImage,
  -personW * person.scale / 2,
  -personH * person.scale / 2,
  personW * person.scale,
  personH * person.scale
);
ctx.restore();
```

Preview e exportação saem do mesmo canvas, então a rotação é preservada sem código extra.

## Botão de 90°

```html
<button type="button" class="text-button" id="rotateButton">
  <span>Girar 90°</span>
</button>
```

Um toque, ângulo exato. É o caminho principal: muita gente não descobre que dois dedos
também giram, e em aparelho básico o gesto combinado é impreciso.

Teclado: tecla `r` gira 90° no sentido horário, mantendo paridade com as setas já existentes.

## Gesto de dois dedos

No gesto de pinça já se calcula distância e ponto médio. Acrescentar o ângulo:

```js
const angulo = Math.atan2(b.y - a.y, b.x - a.x);
```

Durante o gesto: distância → zoom, ângulo → rotação, ponto médio → movimento.

### Zona morta e encaixe

Sem proteção, quem só quer dar zoom termina com a foto 2° torta e não percebe.

```js
const ZONA_MORTA = 8 * Math.PI / 180;   // engata só depois de 8°
const ENCAIXE    = 5 * Math.PI / 180;   // gruda em 0/90/180/270 dentro de 5°
```

A rotação só passa a acompanhar o gesto depois que o giro acumulado ultrapassa a zona
morta. Ao soltar os dedos, se o ângulo estiver a menos de `ENCAIXE` de um múltiplo de 90°,
encaixa nele.

## Clamp com imagem girada

`clampPerson()` usa largura e altura para manter a pessoa dentro do canvas. Imagem girada
ocupa uma caixa maior, e ignorar isso faz a trava errar perto de 45°.

```js
function bboxGirado(w, h, rotation) {
  const c = Math.abs(Math.cos(rotation));
  const s = Math.abs(Math.sin(rotation));
  return { w: w * c + h * s, h: w * s + h * c };
}
```

`clampPerson()` deve usar essas medidas, não `personW * scale` direto.

## Invalidação

Girar altera o canvas, então entra na lista da Task 9: esconde o `resultCard`.

## Centralizar

O botão "Centralizar" reposiciona e reenquadra, mas **preserva a rotação** — o usuário a
escolheu de propósito.

---

# Task 7 — Validação de arquivo

Criar:

```js
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_BYTES = 15 * 1024 * 1024;
```

Validar **antes** de ler/decodificar.

Aplicar igualmente em:

* file input;
* drag-and-drop.

Não usar apenas:

```js
file.type.startsWith("image/")
```

---

# Task 8 — Exportar diretamente do canvas

Eliminar totalmente:

```text
processedBlob
responseError()
fetch("/api/render")
FormData
```

Implementar:

```js
function exportarArte() {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a imagem."));
    }, "image/png");
  });
}
```

Antes da exportação:

```js
draw();
```

O Blob deve representar exatamente o canvas atual.

---

# Task 9 — Resultado e iOS

Adicionar:

```html
<div class="result-card" id="resultCard" hidden>
  <img id="resultImage" alt="Arte pronta para salvar">
  <p id="resultHint">Toque e segure na imagem para salvar em Fotos.</p>
</div>
```

Manter estado:

```js
let resultUrl = null;
```

Ao gerar nova imagem:

```js
if (resultUrl) {
  URL.revokeObjectURL(resultUrl);
}

resultUrl = URL.createObjectURL(blob);
```

### iOS

Quando necessário:

```text
mostrar imagem
→ orientar usuário a tocar e segurar
→ "Salvar em Fotos"
```

### Outros navegadores

Usar download:

```js
const link = document.createElement("a");
link.href = url;
link.download = nome;
link.click();
```

Revoke do URL após uso.

---

## Invalidar resultado antigo

Ocultar `resultCard` quando ocorrer:

* nova foto;
* drag/movimento;
* zoom;
* rotação (gesto ou botão);
* centralização;
* troca de máscara.

O resultado exibido nunca pode representar um estado anterior do canvas.

---

# Task 10 — Converter HTML para estático

Mover:

```text
templates/index.html
→
index.html
```

Remover todas as chamadas Jinja:

```text
{{ url_for(...) }}
```

Usar caminhos estáticos:

```html
<link rel="stylesheet" href="/static/css/style.css">
<script src="/static/js/editor.js" defer></script>

<img src="/static/img/mascara-rosa-v1.png">
<img src="/static/img/mascara-azul-v1.png">
```

---

# Task 11 — Atualizar privacidade

Substituir o texto atual por:

> A foto é processada no seu próprio aparelho e não é enviada para nenhum servidor.

---

# Task 12 — Versionar máscaras

Renomear:

```text
mascara-rosa.png
→ mascara-rosa-v1.png

mascara-azul.png
→ mascara-azul-v1.png
```

Atualizar todas as referências.

Mudanças futuras devem gerar:

```text
mascara-rosa-v2.png
mascara-azul-v2.png
```

Não substituir silenciosamente conteúdo de arquivo marcado como `immutable`.

---

# Task 13 — Vercel estática

Reescrever `vercel.json` sem Python/build de Function.

Exemplo:

```json
{
  "cleanUrls": true,
  "headers": [
    {
      "source": "/static/img/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/static/(css|js)/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

O cache `immutable` só é permitido porque as máscaras agora possuem versionamento no nome.

---

# Task 14 — Remover backend

Excluir:

```bash
git rm app.py
git rm requirements.txt
git rm Dockerfile
git rm Procfile
```

Remover `templates/` após mover o HTML.

Conferir:

```bash
grep -RniE "api/render|Flask|flask|gunicorn|Pillow|send_file" \
  --include="*.js" \
  --include="*.html" \
  --include="*.json" .
```

Ignorar deliberadamente:

```text
tests/
docs/
legacy references
```

Produção não pode conter nenhuma referência ativa ao backend.

---

# Task 15 — `.vercelignore`

Criar:

```text
.venv/
__pycache__/
tests/
docs/
requirements-dev.txt
```

Fixtures e Pillow não entram no deploy.

---

# Task 16 — Teste WYSIWYG correto

Não comparar PNGs pelos bytes do arquivo.

Errado:

```js
previewPng.equals(downloadPng)
```

Duas codificações PNG podem representar pixels idênticos usando bytes diferentes.

O teste obrigatório é:

```text
preview PNG
→ decodificar

download PNG
→ decodificar

comparar pixels RGBA
```

Critério:

```text
largura = 1080
altura = 1080
pixels diferentes = 0
```

`tests/compare.py` deve falhar no primeiro/total de pixels divergentes e retornar exit code diferente de zero.

Interface:

```bash
python tests/compare.py preview.png download.png
```

Esperado:

```text
OK: 1080x1080, 0 pixels diferentes
```

---

# Task 17 — Matriz automatizada

Casos obrigatórios:

| Caso                | Objetivo                                 |
| ------------------- | ---------------------------------------- |
| `12mp.jpg`          | provar correção do bug WYSIWYG atual     |
| `48mp.jpg`          | memória/performance                      |
| retrato + zoom 250% | validar qualidade com cap 2800           |
| `exif1.jpg` … `exif8.jpg` | as oito orientações, transform próprio |
| rotação manual      | gesto e botão preservados na exportação  |
| `transparente.png`  | preservar margens/transparência da fonte |
| `foto.webp`         | compatibilidade                          |
| `pesada.jpg`        | arquivo real entre 14–15 MB              |
| MIME inválido       | rejeição antes da decodificação          |
| >15 MB              | rejeição imediata                        |

Para todos os casos aceitos:

```text
preview pixels == download pixels
```

Também verificar:

```text
nenhum request /api/*
```

---

# Task 18 — Teste específico de EXIF

Usar os marcadores geométricos das fixtures.

Confirmar que:

```text
EXIF 6
≠
EXIF 8
```

em orientação visual correta.

Não considerar sucesso apenas porque a imagem carregou.

---

# Task 19 — Teste de memória

## Desktop

Executar `48mp.jpg` e confirmar:

* carrega;
* editor continua responsivo;
* drag fluido;
* zoom funciona;
* exportação funciona.

## Android básico

Teste obrigatório com:

```text
48 MP
```

Resultado aceitável:

### Caminho A

```text
carrega usando pipeline otimizada
→ aba permanece estável
```

### Caminho B

```text
browser incompatível
→ app recusa de forma controlada
→ mostra mensagem amigável
```

Resultado inaceitável:

```text
aba fecha
aba recarrega
browser mata processo
interface congela
```

---

# Task 20 — Servir localmente como site estático

Executar um servidor estático apenas para teste:

```bash
python -m http.server 8000
```

Python aqui é ferramenta local, não parte da aplicação.

Executar a matriz contra:

```text
http://127.0.0.1:8000/
```

Critério:

```text
todos os casos automatizados aprovados
/api/render inexistente
```

---

# Task 21 — Inspeção visual

Abrir as artes geradas e verificar:

* máscara correta;
* posição correta;
* zoom correto;
* sem distorção;
* sem faixas pretas;
* PNG transparente com geometria esperada;
* foto 12 MP igual ao preview;
* retrato no zoom máximo sem degradação inesperada.

---

# Task 22 — Preview Vercel

Após todos os testes locais:

```bash
git push origin dev
```

Usar o Preview criado pela Vercel.

Confirmar:

```text
site servido estaticamente
nenhuma Function Python
nenhuma Function para /api/render
```

Rodar a matriz automatizada contra a URL do Preview.

---

# Task 23 — Testes em dispositivos reais

## iPhone / Safari

* [ ] selecionar foto;
* [ ] mover;
* [ ] zoom;
* [ ] trocar máscara;
* [ ] gerar;
* [ ] visualizar resultado;
* [ ] salvar em Fotos.

## Android intermediário / Chrome

* [ ] fluxo completo;
* [ ] download;
* [ ] 12 MP;
* [ ] WEBP.

## Android básico

* [ ] fluxo normal;
* [ ] 48 MP;
* [ ] foto 14–15 MB;
* [ ] confirmar ausência de crash/reload;
* [ ] validar rejeição segura caso necessário.

---

# Task 24 — Critério de GO

Só liberar produção quando todos forem verdadeiros:

```text
✓ site 100% estático
✓ nenhuma Function
✓ /api/render inexistente
✓ foto nunca enviada
✓ JPEG OK
✓ PNG OK
✓ WEBP OK
✓ EXIF 1–8 OK
✓ rotação manual preservada na exportação
✓ zona morta impede rotação acidental no pinch
✓ 12 MP OK
✓ 48 MP OK ou rejeição segura em browser incompatível
✓ arquivo 14–15 MB OK
✓ >15 MB rejeitado antes da decodificação
✓ MIME inválido rejeitado
✓ zoom 250% OK
✓ WYSIWYG com 0 pixels diferentes
✓ nenhuma chamada /api/*
✓ iPhone real OK
✓ Android intermediário OK
✓ Android básico OK
✓ legacy-server preservado
✓ tag pre-client-render preservada
```

Qualquer falha acima bloqueia produção.

---

# Task 25 — Merge

Após GO:

```bash
git checkout master
git pull --ff-only
git merge dev
git push origin master
```

Aguardar o deployment de produção finalizar.

---

# Task 26 — Verificação pós-deploy

Executar a matriz contra:

```text
https://tocomgd.vercel.app/
```

Verificar:

```bash
curl -i https://tocomgd.vercel.app/api/render
```

Esperado:

```text
404
```

Também confirmar na Vercel que não existem invocações de Function para o novo deployment.

Fazer um teste manual final de download.

---

# Rollback

Se surgir problema grave em produção:

1. interromper novas mudanças;
2. identificar o deployment anterior ou tag `pre-client-render`;
3. restaurar a versão anterior usando rollback/redeploy ou commit de reversão;
4. não usar fallback automático para `/api/render`;
5. não fazer force-push salvo situação excepcional e deliberada.

Preservar:

```text
legacy-server
pre-client-render
```

até o evento terminar e a nova versão estar comprovadamente estável.

---

# Fora do escopo

Não adicionar durante esta migração:

* banco de dados;
* autenticação;
* galeria;
* backend de analytics;
* JPEG como novo formato de saída;
* framework;
* build system;
* novas funcionalidades visuais;
* refatorações não necessárias.

Primeiro objetivo:

> **corrigir WYSIWYG, remover backend e tornar o sistema seguro para o pico.**

Melhorias posteriores ficam para outro ciclo.
