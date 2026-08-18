"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  TenantError,
  FORMAT_IDS,
  RESERVED_SLUGS,
  readSlug,
  resolveAssetPath,
} = require("../static/js/tenant.js");

function assertTenantError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof TenantError, true);
    assert.equal(error.code, code);
    return true;
  });
}

test("exporta enum de formatos e slugs reservados", () => {
  assert.deepEqual(FORMAT_IDS, ["quadrado", "feed", "story"]);
  assert.equal(RESERVED_SLUGS.has("admin"), true);
  assert.equal(RESERVED_SLUGS.has("login"), true);
});

test("readSlug retorna null na raiz e primeiro segmento válido", () => {
  assert.equal(readSlug("/"), null);
  assert.equal(readSlug("/joao"), "joao");
  assert.equal(readSlug("/joao/qualquer-rota"), "joao");
  assert.equal(readSlug("/joao/"), "joao");
});

test("readSlug rejeita slug inválido e reservado", () => {
  assertTenantError(() => readSlug("/Joao"), "slug_invalido");
  assertTenantError(() => readSlug("/João"), "slug_invalido");
  assertTenantError(() => readSlug("/admin"), "slug_reservado");
  assertTenantError(() => readSlug("/api"), "slug_reservado");
  assertTenantError(() => readSlug("//joao"), "slug_invalido");
});

test("resolveAssetPath monta asset relativo com version", () => {
  assert.equal(
    resolveAssetPath("gd", "masks/rosa/quadrado.png", "v 2"),
    "/static/tenants/gd/masks/rosa/quadrado.png?v=v%202"
  );
});

test("resolveAssetPath rejeita caminhos vazios, absolutos e traversal", () => {
  const invalidPaths = [
    "",
    "/logo.png",
    "//cdn.example/logo.png",
    "../gd/logo.png",
    "masks/../logo.png",
    "masks/./logo.png",
    "masks//logo.png",
    "masks\\logo.png",
    "logo.png?cache=1",
    "logo.png#fragment",
    "masks/%2e%2e/logo.png",
    "https://externo.example/logo.png",
    "C:/logo.png",
  ];

  for (const assetPath of invalidPaths) {
    assertTenantError(() => resolveAssetPath("gd", assetPath, "1"), "asset_invalido");
  }
});
