"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  TenantError,
  resolveAssetPath,
  validateConfig,
} = require("../static/js/tenant.js");

const ROOT = path.resolve(__dirname, "..");
const TENANTS_ROOT = path.join(ROOT, "static", "tenants");

function fail(message) {
  throw new Error(message);
}

function pathDentroDaRaiz(base, alvo) {
  const relativo = path.relative(base, alvo);
  return relativo === "" || (!relativo.startsWith("..") && !path.isAbsolute(relativo));
}

function readConfig(slug) {
  const tenantRoot = path.join(TENANTS_ROOT, slug);
  const configPath = path.join(tenantRoot, "config.json");
  if (!fs.existsSync(configPath)) fail(`config.json não encontrado: ${configPath}`);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`config.json inválido: ${error.message}`);
  }
  return { raw, tenantRoot };
}

function validateAssets(raw, slug, tenantRoot) {
  for (const template of raw.templates) {
    for (const formatId of raw.formats) {
      const assetPath = template.assets[formatId];
      const resolved = resolveAssetPath(slug, assetPath, raw.version);
      const prefix = `/static/tenants/${slug}/`;
      if (!resolved.startsWith(`${prefix}${assetPath}?v=`)) {
        fail(`resolução inesperada para ${template.id}/${formatId}`);
      }

      const localPath = path.resolve(tenantRoot, ...assetPath.split("/"));
      if (!pathDentroDaRaiz(tenantRoot, localPath) || !fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
        fail(`asset não encontrado: ${slug}/${assetPath}`);
      }
    }
  }

  if (raw.brand.logo !== undefined && raw.brand.logo !== null) {
    const localLogo = path.resolve(tenantRoot, ...raw.brand.logo.split("/"));
    if (!pathDentroDaRaiz(tenantRoot, localLogo) || !fs.existsSync(localLogo) || !fs.statSync(localLogo).isFile()) {
      fail(`logo não encontrado: ${slug}/${raw.brand.logo}`);
    }
  }
}

function main() {
  const [slug] = process.argv.slice(2);
  if (!slug || slug === "_template") {
    fail("uso: node tests/validate-tenant.js <slug real>");
  }

  const { raw, tenantRoot } = readConfig(slug);
  const tenant = validateConfig(raw, slug);
  validateAssets(raw, tenant.slug, tenantRoot);
  console.log(`OK: tenant ${slug} (${tenant.templates.length} templates, ${tenant.formats.length} formatos)`);
}

try {
  main();
} catch (error) {
  if (error instanceof TenantError) {
    console.error(`ERRO [${error.code}]: ${error.message}`);
  } else {
    console.error(`ERRO: ${error.message || error}`);
  }
  process.exitCode = 1;
}
