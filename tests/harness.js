"use strict";

/**
 * Harness de navegador para testar o gerador de arte de campanha ponta a
 * ponta, automatizando o Chrome via CDP (Chrome DevTools Protocol) puro —
 * sem dependências npm, usando apenas `fetch`/`WebSocket` globais do Node.
 *
 * Uso programático:
 *
 *   const { runCase } = require("./harness");
 *   const { previewPng, downloadPng, networkRequests } = await runCase({
 *     url: "http://127.0.0.1:5000/",
 *     photoPath: "tests/fixtures/12mp.jpg",
 *   });
 *
 * Fluxo de um caso:
 *   1. abre o Chrome (perfil e porta de depuração isolados por execução)
 *   2. navega até `url`
 *   3. seleciona `photoPath` em #photoInput (via DOM.setFileInputFiles)
 *   4. espera #adjustments sair de `hidden` (sinal de "editor pronto")
 *   5. captura #artCanvas via toDataURL (previewPng)
 *   6. intercepta URL.createObjectURL, clica em #downloadButton e lê o
 *      Blob resultante via FileReader (downloadPng)
 *   7. devolve todas as URLs requisitadas durante o caso (networkRequests)
 *
 * CLI (para verificação manual/pontas-a-ponta):
 *
 *   node tests/harness.js <url> <photoPath> [outDir] [timeoutMs]
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

const DEFAULT_TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------
// Cliente CDP mínimo: envia comandos JSON-RPC-like sobre WebSocket e
// distribui eventos assíncronos (que não têm `id`) para quem se inscreveu.
// ---------------------------------------------------------------------

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this._nextId = 1;
    this._pending = new Map();
    this._listeners = new Map();
    ws.addEventListener("message", (event) => this._onMessage(event));
    ws.addEventListener("close", () => this._onClose());
  }

  _onMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.id !== undefined && this._pending.has(msg.id)) {
      const { resolve, reject } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(`CDP ${msg.error.code}: ${msg.error.message}`));
      } else {
        resolve(msg.result);
      }
      return;
    }

    if (msg.method) {
      const handlers = this._listeners.get(msg.method);
      if (handlers) {
        for (const handler of [...handlers]) handler(msg.params || {});
      }
    }
  }

  _onClose() {
    const err = new Error("Conexão CDP fechada antes da resposta.");
    for (const { reject } of this._pending.values()) reject(err);
    this._pending.clear();
  }

  send(method, params = {}) {
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this._listeners.has(method)) this._listeners.set(method, []);
    this._listeners.get(method).push(handler);
  }

  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        const arr = this._listeners.get(method);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx >= 0) arr.splice(idx, 1);
        }
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout após ${ms}ms esperando: ${label}`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function describeException(exceptionDetails) {
  if (!exceptionDetails) return "erro desconhecido";
  return (
    exceptionDetails.exception?.description ||
    exceptionDetails.text ||
    JSON.stringify(exceptionDetails)
  );
}

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error(
      `Esperava uma data URL, recebi: ${JSON.stringify(dataUrl).slice(0, 200)}`
    );
  }
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("Data URL malformada (sem vírgula).");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Mata a árvore de processos do Chrome e só resolve quando ela já morreu —
// importante porque o chamador precisa apagar o --user-data-dir logo em
// seguida, e no Windows os arquivos de perfil (ex.: lock files) só soltam
// depois que o processo realmente sai. Resolver antes disso faz o rmSync
// falhar silenciosamente (EBUSY/EPERM) e acumular diretórios órfãos em
// %TEMP% a cada execução.
function killChromeTree(child) {
  return new Promise((resolve) => {
    if (!child || child.pid === undefined) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      // child.kill() no Windows não derruba os processos filhos que o
      // Chrome abre (GPU, renderer, etc.) — usa taskkill /T para matar a
      // árvore inteira, e espera o próprio taskkill terminar.
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    } else {
      try {
        child.kill("SIGKILL");
      } catch {
        // processo já pode ter saído
      }
      child.once("exit", () => resolve());
      // segurança: nunca travar a limpeza esperando um evento que não vem.
      setTimeout(resolve, 2000).unref?.();
    }
  });
}

// Remove o diretório de perfil com algumas tentativas: no Windows, mesmo
// depois do processo do Chrome sair, o SO pode levar um instante para
// liberar handles de arquivo (antivírus, indexação, etc.).
async function removeDirWithRetry(dir, attempts = 5, delayMs = 200) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      if (attempt === attempts) return; // limpeza é best-effort
      await sleep(delayMs);
    }
  }
}

// ---------------------------------------------------------------------
// Ciclo de vida do Chrome
// ---------------------------------------------------------------------

async function waitForDevtools(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
      lastError = new Error(`status HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(100);
  }

  throw new Error(
    `Chrome DevTools não respondeu em http://127.0.0.1:${port} dentro de ${timeoutMs}ms` +
      (lastError ? ` (último erro: ${lastError.message})` : "")
  );
}

async function launchChrome({ headless = true, viewport } = {}) {
  const port = await getFreePort();
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tocomgd-harness-")
  );

  const width = viewport?.width || 1280;
  const height = viewport?.height || 1024;

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-popup-blocking",
    "--disable-background-networking",
    `--window-size=${width},${height}`,
    "about:blank",
  ];
  if (headless) args.push("--headless=new", "--disable-gpu");

  const child = spawn(CHROME_PATH, args, { stdio: "ignore" });

  const earlyExit = new Promise((_resolve, reject) => {
    child.once("error", (err) => {
      reject(new Error(`Falha ao iniciar o Chrome (${CHROME_PATH}): ${err.message}`));
    });
    child.once("exit", (code, signal) => {
      reject(
        new Error(
          `Chrome encerrou antes do DevTools responder (code=${code}, signal=${signal}). ` +
            `Verifique CHROME_PATH (atual: ${CHROME_PATH}).`
        )
      );
    });
  });

  try {
    await Promise.race([waitForDevtools(port, 15000), earlyExit]);
  } catch (err) {
    await killChromeTree(child);
    await removeDirWithRetry(userDataDir);
    throw err;
  }

  return { child, port, userDataDir };
}

async function connectToPage(port) {
  const list = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  const target = list.find((t) => t.type === "page");
  if (!target) {
    throw new Error("Nenhuma aba do tipo 'page' encontrada no Chrome lançado.");
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", (event) => reject(new Error(`Falha ao conectar ao CDP: ${event.message || event}`)), {
      once: true,
    });
  });

  return new CDPClient(ws);
}

// ---------------------------------------------------------------------
// Passos do caso de teste
// ---------------------------------------------------------------------

async function waitForCondition(cdp, expression, timeoutMs, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `Erro ao avaliar condição de espera "${expression}": ${describeException(result.exceptionDetails)}`
      );
    }
    if (result.result && result.result.value) return;
    if (Date.now() > deadline) {
      throw new Error(`Timeout (${timeoutMs}ms) esperando condição: ${expression}`);
    }
    await sleep(intervalMs);
  }
}

async function selectPhotoFile(cdp, absPhotoPath) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "#photoInput",
  });
  if (!nodeId) {
    throw new Error("#photoInput não encontrado na página.");
  }
  // DOM.setFileInputFiles dispara os eventos 'input'/'change' do input,
  // exatamente como uma seleção real de arquivo pelo usuário.
  await cdp.send("DOM.setFileInputFiles", {
    files: [absPhotoPath],
    nodeId,
  });
}

async function capturePreviewPng(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: "document.getElementById('artCanvas').toDataURL('image/png')",
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`Falha ao capturar #artCanvas: ${describeException(result.exceptionDetails)}`);
  }
  return dataUrlToBuffer(result.result.value);
}

// Envolve URL.createObjectURL ANTES de clicar em #downloadButton: o app cria
// um Blob e chama URL.createObjectURL para expô-lo como link de download.
// Interceptando essa chamada e lendo o Blob via FileReader conseguimos o
// arquivo gerado sem depender do gerenciador de downloads do navegador.
const DOWNLOAD_CAPTURE_EXPRESSION = `
  (function () {
    return new Promise((resolve, reject) => {
      const button = document.getElementById('downloadButton');
      if (!button) {
        reject(new Error("#downloadButton não encontrado"));
        return;
      }
      if (button.disabled) {
        reject(new Error("#downloadButton está desabilitado"));
        return;
      }

      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        const objectUrl = originalCreateObjectURL.call(URL, blob);
        const reader = new FileReader();
        reader.onload = () => {
          URL.createObjectURL = originalCreateObjectURL;
          resolve(String(reader.result));
        };
        reader.onerror = () => {
          URL.createObjectURL = originalCreateObjectURL;
          reject(reader.error || new Error("FileReader falhou ao ler o Blob do download"));
        };
        reader.readAsDataURL(blob);
        return objectUrl;
      };

      button.click();
    });
  })()
`;

async function captureDownloadPng(cdp, timeoutMs) {
  const evalPromise = cdp.send("Runtime.evaluate", {
    expression: DOWNLOAD_CAPTURE_EXPRESSION,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  const result = await withTimeout(
    evalPromise,
    timeoutMs,
    "captura do download (clique em #downloadButton + URL.createObjectURL)"
  );
  if (result.exceptionDetails) {
    throw new Error(`Falha ao capturar download: ${describeException(result.exceptionDetails)}`);
  }
  return dataUrlToBuffer(result.result.value);
}

async function captureStaleExportState(cdp, timeoutMs) {
  // Deixa um resultado anterior visível para garantir que a corrida não
  // apenas evite o primeiro resultado, mas também não ressuscite um Blob
  // obsoleto sobre um card já preenchido.
  await captureDownloadPng(cdp, timeoutMs);
  await waitForCondition(
    cdp,
    "document.getElementById('resultCard').hidden === false && !!document.getElementById('resultImage').getAttribute('src')",
    timeoutMs,
    10
  );

  const installResult = await cdp.send("Runtime.evaluate", {
    expression: `
      (function () {
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        window.__lunaToBlobCompleted = false;
        HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
          originalToBlob.call(this, (blob) => {
            setTimeout(() => {
              window.__lunaToBlobCompleted = true;
              callback(blob);
            }, 250);
          }, type, quality);
        };
        return true;
      })()
    `,
    returnByValue: true,
  });
  if (installResult.exceptionDetails) {
    throw new Error(`Falha ao atrasar toBlob: ${describeException(installResult.exceptionDetails)}`);
  }

  await cdp.send("Runtime.evaluate", {
    expression: "document.getElementById('downloadButton').click()",
    userGesture: true,
  });
  await waitForCondition(
    cdp,
    "document.getElementById('downloadButton').disabled === true",
    timeoutMs,
    10
  );

  const mutateResult = await cdp.send("Runtime.evaluate", {
    expression: `
      (function () {
        const zoom = document.getElementById('zoomRange');
        zoom.value = '150';
        zoom.dispatchEvent(new Event('input', { bubbles: true }));
        return zoom.value;
      })()
    `,
    returnByValue: true,
  });
  if (mutateResult.exceptionDetails) {
    throw new Error(`Falha ao alterar zoom durante exportação: ${describeException(mutateResult.exceptionDetails)}`);
  }

  await waitForCondition(
    cdp,
    "window.__lunaToBlobCompleted === true && document.getElementById('downloadButton').disabled === false",
    timeoutMs,
    10
  );

  const stateResult = await cdp.send("Runtime.evaluate", {
    expression: `
      ({
        resultHidden: document.getElementById('resultCard').hidden,
        resultImageSrc: document.getElementById('resultImage').getAttribute('src'),
        zoomValue: document.getElementById('zoomRange').value,
      })
    `,
    returnByValue: true,
  });
  if (stateResult.exceptionDetails) {
    throw new Error(`Falha ao ler resultado da corrida: ${describeException(stateResult.exceptionDetails)}`);
  }
  return stateResult.result.value;
}

// ---------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------

/**
 * Executa um caso completo: abre `url`, seleciona `photoPath`, espera o
 * editor ficar pronto, captura a prévia do canvas e o PNG do download, e
 * devolve também todas as URLs requisitadas durante o caso.
 *
 * @param {object} options
 * @param {string} options.url - URL da aplicação sob teste.
 * @param {string} options.photoPath - caminho (relativo ou absoluto) da foto a enviar.
 * @param {{width?: number, height?: number}} [options.viewport] - viewport do Chrome.
 * @param {number} [options.timeoutMs] - timeout explícito para cada etapa assíncrona
 *   (carregar página, editor ficar pronto, gerar download). Fotos grandes (48mp.jpg,
 *   pesada.jpg) podem precisar de um valor maior que o default.
 * @param {boolean} [options.headless] - roda o Chrome headless (default: true).
 * @returns {Promise<{previewPng: Buffer, downloadPng: Buffer, networkRequests: string[]}>}
 */
async function runCase({
  url,
  photoPath,
  viewport,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headless = true,
  raceDuringExport = false,
} = {}) {
  if (!url) throw new Error("runCase: parâmetro 'url' é obrigatório.");
  if (!photoPath) throw new Error("runCase: parâmetro 'photoPath' é obrigatório.");

  const absPhotoPath = path.resolve(photoPath);
  if (!fs.existsSync(absPhotoPath)) {
    throw new Error(`runCase: arquivo de foto não encontrado: ${absPhotoPath}`);
  }

  const { child, port, userDataDir } = await launchChrome({ headless, viewport });
  const networkRequests = [];

  try {
    const cdp = await connectToPage(port);

    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");

    cdp.on("Network.requestWillBeSent", (params) => {
      if (params?.request?.url) networkRequests.push(params.request.url);
    });

    try {
      await cdp.send("Page.setDownloadBehavior", { behavior: "deny" });
    } catch {
      // Método pode não existir em todas as versões do Chrome; não é
      // crítico — a captura do arquivo não depende do download real
      // completar, apenas da interceptação de URL.createObjectURL.
    }

    if (viewport) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width || 1280,
        height: viewport.height || 1024,
        deviceScaleFactor: viewport.deviceScaleFactor || 1,
        mobile: Boolean(viewport.mobile),
      });
    }

    const loadEventFired = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url });
    await withTimeout(loadEventFired, timeoutMs, `carregamento de ${url}`);

    await selectPhotoFile(cdp, absPhotoPath);

    await waitForCondition(
      cdp,
      "!!(document.getElementById('adjustments') && !document.getElementById('adjustments').hidden)",
      timeoutMs
    );

    const previewPng = await capturePreviewPng(cdp);
    if (raceDuringExport) {
      const raceState = await captureStaleExportState(cdp, timeoutMs);
      return { previewPng, raceState, networkRequests };
    }
    const downloadPng = await captureDownloadPng(cdp, timeoutMs);

    return { previewPng, downloadPng, networkRequests };
  } finally {
    await killChromeTree(child);
    await removeDirWithRetry(userDataDir);
  }
}

module.exports = { runCase };

// ---------------------------------------------------------------------
// CLI: node tests/harness.js <url> <photoPath> [outDir] [timeoutMs]
// Usado para verificação manual ponta a ponta do harness.
// ---------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    const [url, photoPath, outDir = "tests/.tmp", timeoutMsArg] = process.argv.slice(2);

    if (!url || !photoPath) {
      console.error("uso: node tests/harness.js <url> <photoPath> [outDir] [timeoutMs]");
      process.exit(2);
    }

    const timeoutMs = timeoutMsArg ? Number(timeoutMsArg) : DEFAULT_TIMEOUT_MS;

    console.log(`> runCase({ url: ${JSON.stringify(url)}, photoPath: ${JSON.stringify(photoPath)}, timeoutMs: ${timeoutMs} })`);
    const startedAt = Date.now();

    try {
      const { previewPng, downloadPng, networkRequests } = await runCase({
        url,
        photoPath,
        timeoutMs,
      });

      fs.mkdirSync(outDir, { recursive: true });
      const previewPath = path.join(outDir, "preview.png");
      const downloadPath = path.join(outDir, "download.png");
      fs.writeFileSync(previewPath, previewPng);
      fs.writeFileSync(downloadPath, downloadPng);

      console.log(`OK em ${Date.now() - startedAt}ms`);
      console.log(`  previewPng  -> ${previewPath} (${previewPng.length} bytes)`);
      console.log(`  downloadPng -> ${downloadPath} (${downloadPng.length} bytes)`);
      console.log(`  networkRequests (${networkRequests.length}):`);
      for (const reqUrl of networkRequests) console.log(`    ${reqUrl}`);
    } catch (err) {
      console.error(`FALHOU em ${Date.now() - startedAt}ms`);
      console.error(err.stack || err.message || err);
      process.exit(1);
    }
  })();
}
