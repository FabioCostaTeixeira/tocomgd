"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createServer, pathDentroDaRaiz } = require("./server.js");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { hostname: "127.0.0.1", port, path: pathname },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve({
          status: response.statusCode,
          headers: new Headers(response.headers),
          text: Buffer.concat(chunks).toString("utf8"),
        }));
      }
    );
    request.on("error", reject);
  });
}

test("pathDentroDaRaiz rejeita saída e aceita raiz/filhos", () => {
  const base = path.resolve("C:/avatar-root");
  assert.equal(pathDentroDaRaiz(base, base), true);
  assert.equal(pathDentroDaRaiz(base, path.join(base, "index.html")), true);
  assert.equal(pathDentroDaRaiz(base, path.resolve(base, "..", "outside.html")), false);
  assert.equal(pathDentroDaRaiz(base, "C:/avatar-rooted/file.html"), false);
});

test("servidor serve SPA, estáticos, 404 e protege traversal", async (t) => {
  const server = createServer(path.resolve(__dirname, "..", "public"));
  const port = await listen(server);
  t.after(() => server.close());

  const landing = await request(port, "/gd");
  assert.equal(landing.status, 200);
  assert.match(landing.text, /<!doctype html>/i);

  const tenantJs = await request(port, "/static/js/tenant.js");
  assert.equal(tenantJs.status, 200);
  assert.match(tenantJs.text, /resolveAssetPath/);

  const missing = await request(port, "/static/js/inexistente.js");
  assert.equal(missing.status, 404);

  const traversal = await request(port, "/%2e%2e/index.html");
  assert.ok([403, 404].includes(traversal.status));
});

test("config recebe cache revalidável", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "avatar-server-"));
  fs.mkdirSync(path.join(tempRoot, "static", "tenants", "joao"), { recursive: true });
  fs.writeFileSync(
    path.join(tempRoot, "static", "tenants", "joao", "config.json"),
    "{}"
  );
  const server = createServer(tempRoot);
  const port = await listen(server);
  t.after(() => {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const response = await request(port, "/static/tenants/joao/config.json");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
});
