"""Verificações rápidas dos contratos da migração client-side."""
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    html = read("index.html")
    js = read("static/js/editor.js")
    harness = read("tests/harness.js")
    vercel = json.loads(read("vercel.json"))
    vercelignore = read(".vercelignore").splitlines()

    require("{{ url_for" not in html, "HTML ainda contém Jinja")
    require("Monte sua foto com GD!" in html, "título da aplicação ausente")
    require("processada no seu próprio aparelho e não é enviada" in html, "privacidade ausente")
    require('id="rotateButton"' in html, "botão de rotação ausente")
    require('id="resultCard"' in html and 'id="resultImage"' in html, "result card ausente")
    require('<script src="/static/js/editor.js" defer></script>' in html, "script não estático")

    require('const ALLOWED_TYPES = new Set([' in js, "allowlist de MIME ausente")
    require("const MAX_FILE_BYTES = 15 * 1024 * 1024;" in js, "limite de arquivo ausente")
    require("const resultUrl = null" not in js, "resultUrl não é estado mutável")
    require(re.search(r"let resultUrl\s*=", js) is not None, "estado resultUrl ausente")
    require("canvas.toBlob" in js, "exportação não usa canvas.toBlob")
    require("fetch(\"/api/render\")" not in js and "new FormData" not in js, "backend ainda é usado")
    require("processedBlob" not in js and "responseError" not in js, "estado/código legado de render ainda existe")
    require("function rotatePersonBy90" in js, "handler de rotação de 90 graus ausente")
    require("Math.atan2" in js, "gesto não calcula ângulo")
    require("ROTATION_DEAD_ZONE" in js and "ROTATION_SNAP" in js, "zona morta/encaixe ausentes")
    require("invalidateResult" in js, "invalidação centralizada do resultado ausente")
    require(
        re.search(
            r"function showResult\(blob, expectedStateVersion\).*?"
            r"if \(expectedStateVersion !== editorStateVersion\) return false;",
            js,
            re.S,
        ) is not None,
        "showResult não rejeita blob de versão obsoleta",
    )
    require(
        "if (!showResult(resultBlob, exportStateVersion)) return;" in js,
        "exportação não valida a versão ao exibir o blob",
    )
    require("personImage.naturalWidth" not in js and "personImage.naturalHeight" not in js, "editor depende de dimensões naturais")

    require("builds" not in vercel and "app.py" not in json.dumps(vercel), "Vercel ainda aponta para Python")
    for entry in (".venv/", "__pycache__/", "tests/", "requirements-dev.txt", ".superpowers/"):
        require(entry in vercelignore, f"{entry} ausente do .vercelignore")

    require((ROOT / "index.html").is_file(), "index.html não existe")
    require((ROOT / "tests/run.js").is_file(), "runner da matriz ausente")
    require(not (ROOT / "templates").exists(), "templates/ ainda existe")
    for legacy in ("app.py", "Dockerfile", "Procfile", "requirements.txt"):
        require(not (ROOT / legacy).exists(), f"backend legado ainda existe: {legacy}")
    require((ROOT / "static/img/mascara-rosa-v1.png").is_file(), "máscara rosa versionada ausente")
    require((ROOT / "static/img/mascara-azul-v1.png").is_file(), "máscara azul versionada ausente")
    require(not (ROOT / "static/img/mascara-rosa.png").exists(), "máscara rosa sem versão ainda existe")
    require(not (ROOT / "static/img/mascara-azul.png").exists(), "máscara azul sem versão ainda existe")

    require("/api/" not in harness, "harness ainda contém rota de API")
    print("OK: contratos da migração client-side")


if __name__ == "__main__":
    main()
