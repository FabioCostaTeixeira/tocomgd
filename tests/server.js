"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "..", "public");

function pathDentroDaRaiz(base, alvo) {
  const relativo = path.relative(base, alvo);
  return relativo === "" || (!relativo.startsWith("..") && !path.isAbsolute(relativo));
}

function contentType(filePath) {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function headerPatternRegExp(pattern) {
  const expression = pattern
    .split("/")
    .map((segment) => {
      if (segment === "*") return ".*";
      if (segment.startsWith(":")) return "[^/]+";
      return segment.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${expression}$`);
}

function readHeaderRules(rootDir) {
  const headersPath = path.join(rootDir, "_headers");
  if (!fs.existsSync(headersPath)) return [];

  const rules = [];
  let currentRule = null;
  for (const line of fs.readFileSync(headersPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!/^\s/.test(line)) {
      currentRule = { pattern: trimmed, headers: {} };
      rules.push(currentRule);
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (currentRule && separator > 0) {
      const name = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      currentRule.headers[name] = value;
    }
  }

  return rules.map((rule) => ({
    ...rule,
    matcher: headerPatternRegExp(rule.pattern),
  }));
}

function headersForPath(rules, pathname) {
  return Object.assign(
    {},
    ...rules
      .filter((rule) => rule.matcher.test(pathname))
      .map((rule) => rule.headers)
  );
}

function createServer(rootDir = DEFAULT_ROOT) {
  const base = path.resolve(rootDir);
  const headerRules = readHeaderRules(base);

  return http.createServer((request, response) => {
    let pathname;
    try {
      const rawPathname = String(request.url || "").split("?", 1)[0];
      pathname = decodeURIComponent(rawPathname);
    } catch {
      response.writeHead(400);
      response.end("Bad Request");
      return;
    }

    if (!pathname.startsWith("/") || pathname.includes("\0")) {
      response.writeHead(400);
      response.end("Bad Request");
      return;
    }

    const alvo = path.resolve(base, `.${pathname}`);
    if (!pathDentroDaRaiz(base, alvo)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    let filePath = alvo;
    try {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        if (path.extname(pathname) !== "") {
          response.writeHead(404);
          response.end("Not Found");
          return;
        }
        filePath = path.join(base, "index.html");
      }

      if (!pathDentroDaRaiz(base, filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404);
        response.end("Not Found");
        return;
      }

      const headers = {
        ...headersForPath(headerRules, pathname),
        "Content-Type": contentType(filePath),
        "Content-Length": fs.statSync(filePath).size,
      };
      if (
        pathname.startsWith("/static/tenants/") &&
        path.basename(filePath) === "config.json" &&
        !headers["Cache-Control"]
      ) {
        headers["Cache-Control"] = "public, max-age=0, must-revalidate";
      }

      response.writeHead(200, headers);
      if (request.method === "HEAD") {
        response.end();
      } else {
        fs.createReadStream(filePath).pipe(response);
      }
    } catch {
      if (!response.headersSent) response.writeHead(404);
      response.end("Not Found");
    }
  });
}

if (require.main === module) {
  const port = Number(process.argv[2] || 8000);
  const root = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_ROOT;
  createServer(root).listen(port, "127.0.0.1", () => {
    console.log(`Avatar server listening on http://127.0.0.1:${port}`);
  });
}

module.exports = { createServer, pathDentroDaRaiz };
