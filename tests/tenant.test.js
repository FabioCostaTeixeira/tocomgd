"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  TenantError,
  FORMAT_IDS,
  RESERVED_SLUGS,
  readSlug,
  resolveAssetPath,
  validateConfig,
  loadTenant,
} = require("../static/js/tenant.js");

function assertTenantError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof TenantError, true);
    assert.equal(error.code, code);
    return true;
  });
}

function config(overrides = {}) {
  const value = {
    slug: "joao",
    version: "7",
    brand: {
      name: "João",
      primaryColor: "#123456",
      logo: "logo.png",
    },
    formats: ["quadrado", "story"],
    templates: [
      {
        id: "principal",
        name: "Principal",
        assets: {
          quadrado: "masks/principal/quadrado.png",
          story: "masks/principal/story.png",
        },
      },
    ],
    defaults: {
      template: "principal",
      format: "quadrado",
    },
  };
  return Object.assign(value, overrides);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

test("validateConfig normaliza defaults de brand e resolve assets após validar contrato", () => {
  const tenant = validateConfig(config(), "joao");

  assert.equal(tenant.slug, "joao");
  assert.equal(tenant.brand.title, "João");
  assert.equal(tenant.brand.description, "");
  assert.equal(tenant.brand.secondaryColor, "#123456");
  assert.equal(tenant.brand.logo, "/static/tenants/joao/logo.png?v=7");
  assert.equal(
    tenant.templates[0].assets.story,
    "/static/tenants/joao/masks/principal/story.png?v=7"
  );
});

test("validateConfig aceita cores HEX de 3, 4, 6 e 8 dígitos", () => {
  for (const color of ["#abc", "#abcd", "#abcdef", "#abcdef12"]) {
    const raw = config();
    raw.brand.primaryColor = color;
    assert.equal(validateConfig(raw, "joao").brand.primaryColor, color);
  }
});

test("validateConfig rejeita contrato incompleto e cores inválidas", () => {
  const requiredCases = [
    [null, "config_invalida"],
    [{ ...config(), slug: "outro" }, "config_invalida"],
    [{ ...config(), brand: undefined }, "config_invalida"],
    [{ ...config(), formats: [] }, "config_invalida"],
    [{ ...config(), templates: [] }, "config_invalida"],
    [{ ...config(), defaults: undefined }, "config_invalida"],
  ];

  for (const [raw, code] of requiredCases) {
    assertTenantError(() => validateConfig(raw, "joao"), code);
  }

  for (const color of ["#12", "#12345", "red", "#123456789"]) {
    const raw = config();
    raw.brand.primaryColor = color;
    assertTenantError(() => validateConfig(raw, "joao"), "config_invalida");
  }
});

test("validateConfig rejeita formatos, templates, assets e defaults inválidos", () => {
  const formatCases = [
    [raw => { raw.formats = ["banner"]; }, "formato_invalido"],
    [raw => { raw.formats = ["quadrado", "quadrado"]; }, "formato_duplicado"],
    [raw => { raw.templates[0].id = "Modelo 1"; }, "template_id_invalido"],
    [raw => { raw.templates.push(clone(raw.templates[0])); }, "template_duplicado"],
    [raw => { delete raw.templates[0].assets.story; }, "asset_invalido"],
    [raw => { raw.defaults.template = "inexistente"; }, "default_invalido"],
    [raw => { raw.defaults.format = "feed"; }, "default_invalido"],
  ];

  for (const [mutate, code] of formatCases) {
    const raw = config();
    mutate(raw);
    assertTenantError(() => validateConfig(raw, "joao"), code);
  }
});

test("validateConfig suporta quantidade variável de templates", () => {
  for (const count of [1, 2, 5, 10]) {
    const raw = config();
    raw.templates = Array.from({ length: count }, (_, index) => ({
      id: `modelo-${index + 1}`,
      name: `Modelo ${index + 1}`,
      assets: {
        quadrado: "masks/principal/quadrado.png",
        story: "masks/principal/story.png",
      },
    }));
    raw.defaults.template = "modelo-1";
    const tenant = validateConfig(raw, "joao");
    assert.equal(tenant.templates.length, count);
  }
});

test("loadTenant busca config sem query e trata rede, HTTP, JSON e schema", async () => {
  const calls = [];
  const response = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  const tenant = await loadTenant("joao", async (url) => {
    calls.push(url);
    return response(config());
  });
  assert.deepEqual(calls, ["/static/tenants/joao/config.json"]);
  assert.equal(tenant.version, "7");

  await assert.rejects(
    () => loadTenant("sumido", async () => response({}, 404)),
    (error) => error instanceof TenantError && error.code === "tenant_inexistente"
  );
  await assert.rejects(
    () => loadTenant("erro", async () => response({}, 500)),
    (error) => error instanceof TenantError && error.code === "http"
  );
  await assert.rejects(
    () => loadTenant("rede", async () => { throw new Error("offline"); }),
    (error) => error instanceof TenantError && error.code === "rede"
  );
  await assert.rejects(
    () => loadTenant("json", async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } })),
    (error) => error instanceof TenantError && error.code === "json_invalido"
  );
  await assert.rejects(
    () => loadTenant("schema", async () => response({})),
    (error) => error instanceof TenantError && error.code === "config_invalida"
  );
});
