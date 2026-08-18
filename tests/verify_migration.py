"""Guardrails estáticos da migração multi-tenant client-side."""
from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    editor = read("public/static/js/editor.js")
    tenant = read("public/static/js/tenant.js")
    bootstrap = read("public/static/js/bootstrap.js")
    html = read("public/index.html")

    require(re.search(r"(['\"])(gd|rosa|azul)\1", editor) is None, "core contém tenant/template hardcoded")
    require(re.search(r"\bconst\s+SIZE\b", editor) is None, "core ainda usa const SIZE")
    for format_id, width, height in (
        ("quadrado", 1080, 1080),
        ("feed", 1080, 1350),
        ("story", 1080, 1920),
    ):
        require(
            re.search(
                rf"{format_id}:\s*\{{\s*width:\s*{width},\s*height:\s*{height}\s*\}}",
                editor,
            )
            is not None,
            f"dimensão oficial ausente para {format_id}",
        )

    runtime = "\n".join((editor, tenant, bootstrap))
    require("/api/render" not in runtime, "endpoint legado de render ainda existe")
    require("new FormData" not in runtime, "FormData de render server-side ainda existe")
    require("fetch(\"/api/" not in runtime and "fetch('/api/" not in runtime, "fetch de API legado ainda existe")
    require("eval(" not in runtime, "eval proibido no runtime")
    require("new Function(" not in runtime, "Function dinâmica proibida no runtime")
    require(re.search(r"import\s*\(", runtime) is None, "import dinâmico proibido no runtime")
    require("/static/tenants/" not in editor, "editor monta caminho de tenant")

    require("export async function initEditor" in editor, "initEditor não é módulo exportado")
    require('import { initEditor } from "./editor.js"' in bootstrap, "bootstrap não importa editor estaticamente")
    require('id="templateGrid"' in html and 'id="formatGrid"' in html, "grids dinâmicos ausentes")
    require('id="appLoading"' in html and 'id="tenantError"' in html and 'id="landing"' in html, "estados de bootstrap ausentes")
    require('type="module" src="/static/js/bootstrap.js"' in html, "bootstrap não está ligado como módulo")

    for relative in (
        "public/index.html",
        "public/static/js/editor.js",
        "public/static/js/tenant.js",
        "public/static/js/bootstrap.js",
        "tests/harness.js",
        "tests/run.js",
    ):
        require((ROOT / relative).is_file(), f"arquivo esperado ausente: {relative}")

    print("OK: guardrails de migração multi-tenant")


if __name__ == "__main__":
    main()
