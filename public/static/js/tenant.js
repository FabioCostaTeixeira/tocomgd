"use strict";

  export const FORMAT_IDS = Object.freeze(["quadrado", "feed", "story"]);
  export const RESERVED_SLUGS = new Set([
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
    if (typeof pathname !== "string" || !pathname.startsWith("/")) {
      throw new TenantError("slug_invalido", "Caminho de tenant inválido.");
    }

    if (pathname === "/") return null;

    const slug = pathname.split("/")[1];
    if (!slug || !SLUG_PATTERN.test(slug)) {
      throw new TenantError("slug_invalido", "Slug de tenant inválido.");
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new TenantError("slug_reservado", "Slug de tenant reservado.");
    }

    return slug;
  }

  export function resolveAssetPath(slug, assetPath, version) {
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

  const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const TEMPLATE_ID_PATTERN = /^[a-z0-9-]+$/;

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function requireString(value, code, message) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TenantError(code, message);
    }
    return value;
  }

  function requireColor(value, field) {
    if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
      throw new TenantError("config_invalida", `Cor inválida: ${field}.`);
    }
    return value;
  }

  function validateSlugValue(slug) {
    requireString(slug, "slug_invalido", "Slug de tenant inválido.");
    if (!SLUG_PATTERN.test(slug)) {
      throw new TenantError("slug_invalido", "Slug de tenant inválido.");
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new TenantError("slug_reservado", "Slug de tenant reservado.");
    }
    return slug;
  }

  export function validateConfig(raw, slug) {
    if (!isRecord(raw)) {
      throw new TenantError("config_invalida", "Configuração de tenant inválida.");
    }

    validateSlugValue(slug);
    if (typeof raw.slug !== "string" || raw.slug !== slug) {
      throw new TenantError("config_invalida", "Slug da configuração não corresponde à rota.");
    }
    const version = requireString(raw.version, "config_invalida", "Versão do tenant ausente.");

    if (!isRecord(raw.brand)) {
      throw new TenantError("config_invalida", "Brand do tenant ausente.");
    }
    const name = requireString(raw.brand.name, "config_invalida", "Nome do tenant ausente.");
    const primaryColor = requireColor(raw.brand.primaryColor, "primaryColor");
    const title = raw.brand.title === undefined
      ? name
      : requireString(raw.brand.title, "config_invalida", "Título do tenant inválido.");
    const description = raw.brand.description === undefined
      ? ""
      : typeof raw.brand.description === "string"
        ? raw.brand.description
        : requireString(raw.brand.description, "config_invalida", "Descrição do tenant inválida.");
    const secondaryColor = raw.brand.secondaryColor === undefined
      ? primaryColor
      : requireColor(raw.brand.secondaryColor, "secondaryColor");

    if (!Array.isArray(raw.formats) || raw.formats.length === 0) {
      throw new TenantError("config_invalida", "Tenant precisa de ao menos um formato.");
    }
    const formats = [...raw.formats];
    const formatSet = new Set();
    for (const formatId of formats) {
      if (!FORMAT_IDS.includes(formatId)) {
        throw new TenantError("formato_invalido", `Formato inválido: ${formatId}.`);
      }
      if (formatSet.has(formatId)) {
        throw new TenantError("formato_duplicado", `Formato duplicado: ${formatId}.`);
      }
      formatSet.add(formatId);
    }

    if (!Array.isArray(raw.templates) || raw.templates.length < 1 || raw.templates.length > 20) {
      throw new TenantError("config_invalida", "Tenant precisa ter de 1 a 20 templates.");
    }
    const templateIds = new Set();
    const templates = raw.templates.map((template) => {
      if (!isRecord(template)) {
        throw new TenantError("config_invalida", "Template inválido.");
      }
      const id = requireString(template.id, "config_invalida", "ID de template ausente.");
      if (!TEMPLATE_ID_PATTERN.test(id)) {
        throw new TenantError("template_id_invalido", `ID de template inválido: ${id}.`);
      }
      if (templateIds.has(id)) {
        throw new TenantError("template_duplicado", `Template duplicado: ${id}.`);
      }
      templateIds.add(id);

      const templateName = requireString(template.name, "config_invalida", "Nome de template ausente.");
      if (!isRecord(template.assets)) {
        throw new TenantError("asset_invalido", `Assets ausentes no template: ${id}.`);
      }
      for (const formatId of formats) {
        if (!hasOwn(template.assets, formatId)) {
          throw new TenantError(
            "asset_invalido",
            `Asset ausente para ${id}/${formatId}.`
          );
        }
        if (typeof template.assets[formatId] !== "string" || template.assets[formatId].length === 0) {
          throw new TenantError(
            "asset_invalido",
            `Asset inválido para ${id}/${formatId}.`
          );
        }
      }

      return { id, name: templateName, assets: template.assets };
    });

    if (!isRecord(raw.defaults)) {
      throw new TenantError("config_invalida", "Defaults do tenant ausentes.");
    }
    const defaultTemplate = requireString(
      raw.defaults.template,
      "config_invalida",
      "Template default ausente."
    );
    const defaultFormat = requireString(
      raw.defaults.format,
      "config_invalida",
      "Formato default ausente."
    );
    if (!templateIds.has(defaultTemplate)) {
      throw new TenantError("default_invalido", "Template default inexistente.");
    }
    if (!formatSet.has(defaultFormat)) {
      throw new TenantError("default_invalido", "Formato default não habilitado.");
    }

    const resolvedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      assets: Object.fromEntries(
        formats.map((formatId) => [
          formatId,
          resolveAssetPath(slug, template.assets[formatId], version),
        ])
      ),
    }));
    const logo = raw.brand.logo === undefined || raw.brand.logo === null
      ? null
      : resolveAssetPath(slug, raw.brand.logo, version);

    return {
      slug,
      version,
      brand: {
        name,
        title,
        description,
        primaryColor,
        secondaryColor,
        logo,
      },
      formats,
      templates: resolvedTemplates,
      defaults: {
        template: defaultTemplate,
        format: defaultFormat,
      },
    };
  }

  export async function loadTenant(slug, fetchImpl = fetch) {
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
