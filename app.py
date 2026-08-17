from __future__ import annotations

import io
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageOps, UnidentifiedImageError

BASE_DIR = Path(__file__).resolve().parent
CANVAS_SIZE = 1080
MAX_UPLOAD_MB = 15
MAX_SOURCE_SIDE = 3000
MAX_RENDER_SIDE = 12000
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
DEFAULT_MASK = "rosa"
MASKS = {
    "rosa": BASE_DIR / "static" / "img" / "mascara-rosa.png",
    "azul": BASE_DIR / "static" / "img" / "mascara-azul.png",
}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024


def normalize_source_image(file_storage) -> Image.Image:
    image = Image.open(file_storage.stream)
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGBA")

    if max(image.size) > MAX_SOURCE_SIDE:
        image.thumbnail((MAX_SOURCE_SIDE, MAX_SOURCE_SIDE), Image.Resampling.LANCZOS)

    return image


def get_mask_name() -> str:
    mask_name = request.form.get("mask", DEFAULT_MASK).strip().lower()
    if mask_name not in MASKS:
        raise ValueError("Modelo de máscara inválido.")
    return mask_name


def load_mask(mask_name: str) -> Image.Image:
    path = MASKS.get(mask_name)
    if path is None:
        raise ValueError("Modelo de máscara inválido.")

    if not path.exists():
        raise FileNotFoundError(f"Máscara não encontrada: {path.name}")

    with Image.open(path) as mask_file:
        mask = mask_file.convert("RGBA")

    if mask.size != (CANVAS_SIZE, CANVAS_SIZE):
        mask = mask.resize((CANVAS_SIZE, CANVAS_SIZE), Image.Resampling.LANCZOS)

    return mask


def parse_float(name: str, minimum: float, maximum: float) -> float:
    raw = request.form.get(name, "")
    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError(f"Parâmetro inválido: {name}") from exc

    if not minimum <= value <= maximum:
        raise ValueError(f"Parâmetro fora do limite: {name}")

    return value


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "masks": list(MASKS)})


@app.post("/api/render")
def render_art():
    foreground_file = request.files.get("foreground")
    if foreground_file is None or not foreground_file.filename:
        return jsonify({"error": "Selecione uma foto."}), 400

    if foreground_file.mimetype not in ALLOWED_MIME_TYPES:
        return jsonify({"error": "Formato não suportado. Use JPG, PNG ou WEBP."}), 415

    try:
        x = parse_float("x", -CANVAS_SIZE * 2, CANVAS_SIZE * 3)
        y = parse_float("y", -CANVAS_SIZE * 2, CANVAS_SIZE * 3)
        # Tamanho final em pixels do canvas 1080x1080, medido pelo navegador.
        # Receber o tamanho absoluto (em vez de um fator de escala relativo às
        # dimensões da imagem enviada) mantém o download idêntico à prévia,
        # mesmo quando o servidor redimensiona a origem por limite de memória.
        target_width = max(1, round(parse_float("w", 1, MAX_RENDER_SIDE)))
        target_height = max(1, round(parse_float("h", 1, MAX_RENDER_SIDE)))
        mask_name = get_mask_name()

        foreground = normalize_source_image(foreground_file)

        foreground = foreground.resize(
            (target_width, target_height), Image.Resampling.LANCZOS
        )

        left = round(x - target_width / 2)
        top = round(y - target_height / 2)

        final_image = Image.new(
            "RGBA", (CANVAS_SIZE, CANVAS_SIZE), (255, 255, 255, 255)
        )
        final_image.paste(foreground, (left, top), foreground)
        final_image.alpha_composite(load_mask(mask_name))

        output = io.BytesIO()
        final_image.convert("RGB").save(output, format="PNG", optimize=True)
        output.seek(0)

        return send_file(
            output,
            mimetype="image/png",
            as_attachment=True,
            download_name=f"arte-campanha-{mask_name}-1080x1080.png",
            max_age=0,
        )
    except (UnidentifiedImageError, OSError, FileNotFoundError):
        return jsonify({"error": "Não foi possível gerar a imagem com os arquivos enviados."}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Erro ao gerar arte")
        return jsonify({"error": f"Falha ao gerar a arte: {exc}"}), 500


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": f"A foto excede o limite de {MAX_UPLOAD_MB} MB."}), 413


if __name__ == "__main__":
    import os

    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
