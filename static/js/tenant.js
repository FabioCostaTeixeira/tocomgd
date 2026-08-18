(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.AvatarTenant = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const FORMAT_IDS = Object.freeze(["quadrado", "feed", "story"]);
  const RESERVED_SLUGS = new Set([
    "admin",
    "api",
    "assets",
    "static",
    "tenants",
    "login",
  ]);
  const SLUG_PATTERN = /^[a-z0-9-]+$/;

  class TenantError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "TenantError";
      this.code = code;
    }
  }

  function readSlug(pathname) {
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

  return {
    TenantError,
    FORMAT_IDS,
    RESERVED_SLUGS,
    readSlug,
    resolveAssetPath,
  };
});
