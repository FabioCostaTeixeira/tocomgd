"""Compara duas imagens PIXEL A PIXEL — nunca por bytes.

Dois encodes PNG podem ter bytes diferentes (compressão, metadata, ordem de
chunks) mas pixels idênticos. Comparar bytes geraria falsos positivos de
divergência. Este script decodifica as duas imagens e compara os valores de
cor de cada pixel.

Uso:

    python tests/compare.py preview.png download.png

Saída em caso de sucesso (stdout, exit code 0):

    OK: 1080x1080, 0 pixels diferentes

Saída em caso de divergência (stderr, exit code != 0):

    DIFF: 1080x1080, 43210 pixels diferentes

Também expõe um modo de diagnóstico usado pelos testes de orientação EXIF
das etapas seguintes, que reporta a cor detectada em cada canto de uma arte:

    python tests/compare.py --corners arte.png
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import NamedTuple

from PIL import Image, ImageChops, ImageStat

# Mesmas cores usadas em fixtures.py para os marcadores de canto. Duplicadas
# aqui (em vez de importadas) para que este script continue funcionando
# mesmo se fixtures.py mudar ou não estiver disponível no ambiente que roda
# os testes de orientação.
CORNER_COLORS = {
    "verde": (0, 210, 60),
    "vermelho": (230, 30, 30),
    "azul": (30, 90, 240),
    "magenta": (230, 40, 220),
}


class CompareResult(NamedTuple):
    dimensions_match: bool
    size_a: tuple[int, int]
    size_b: tuple[int, int]
    diff_pixels: int | None  # None quando as dimensões não batem


def compare_images(path_a: str | Path, path_b: str | Path) -> CompareResult:
    """Compara duas imagens pixel a pixel, ignorando o canal alfa.

    O canvas da app é criado com `{ alpha: false }` e o download final é
    convertido para RGB antes de salvar, então alfa nunca carrega
    informação relevante para esta comparação — comparar em RGB evita
    falsos positivos de imagens visualmente idênticas com canais alfa
    diferentes (ex.: totalmente opaco vs. alfa=255 explícito).
    """
    img_a = Image.open(path_a).convert("RGB")
    img_b = Image.open(path_b).convert("RGB")

    if img_a.size != img_b.size:
        return CompareResult(False, img_a.size, img_b.size, None)

    diff = ImageChops.difference(img_a, img_b)
    r, g, b = diff.split()
    # Máscara binária: 255 onde QUALQUER canal difere, 0 onde os três batem.
    mask = ImageChops.lighter(ImageChops.lighter(r, g), b)
    histogram = mask.histogram()
    total_pixels = img_a.size[0] * img_a.size[1]
    diff_pixels = total_pixels - histogram[0]

    return CompareResult(True, img_a.size, img_b.size, diff_pixels)


def sample_corner_colors(
    path: str | Path, inset_frac: float = 0.06, block_frac: float = 0.04
) -> dict[str, dict[str, object]]:
    """Detecta a cor média em cada canto de uma imagem.

    Os marcadores de fixtures.py ocupam um quadrado de ~16% do menor lado,
    com margem de ~4%. Uma amostra de bloco pequeno (4% do menor lado),
    afastada 6% da borda, cai com folga dentro do marcador mesmo se a
    composição (zoom/posição/máscara) deslocar levemente os cantos, e a
    média do bloco absorve ruído de compressão JPEG.
    """
    img = Image.open(path).convert("RGB")
    w, h = img.size
    side = max(4, int(min(w, h) * block_frac))
    inset = int(min(w, h) * inset_frac)

    boxes = {
        "TL": (inset, inset),
        "TR": (w - inset - side, inset),
        "BL": (inset, h - inset - side),
        "BR": (w - inset - side, h - inset - side),
    }

    result: dict[str, dict[str, object]] = {}
    for name, (x, y) in boxes.items():
        region = img.crop((x, y, x + side, y + side))
        mean_r, mean_g, mean_b = ImageStat.Stat(region).mean
        avg = (round(mean_r), round(mean_g), round(mean_b))
        result[name] = {"rgb": list(avg), "label": nearest_label(avg)}

    return result


def nearest_label(rgb: tuple[int, int, int]) -> str:
    best_name = "desconhecido"
    best_dist = None
    for name, color in CORNER_COLORS.items():
        dist = sum((a - b) ** 2 for a, b in zip(rgb, color))
        if best_dist is None or dist < best_dist:
            best_dist = dist
            best_name = name
    return best_name


def cmd_compare(path_a: str, path_b: str) -> int:
    result = compare_images(path_a, path_b)

    if not result.dimensions_match:
        wa, ha = result.size_a
        wb, hb = result.size_b
        print(
            f"ERRO: dimensões diferentes: {wa}x{ha} vs {wb}x{hb}",
            file=sys.stderr,
        )
        return 1

    w, h = result.size_a
    n = result.diff_pixels or 0

    if n == 0:
        print(f"OK: {w}x{h}, {n} pixels diferentes")
        return 0

    print(f"DIFF: {w}x{h}, {n} pixels diferentes", file=sys.stderr)
    return 1


def cmd_corners(path: str) -> int:
    try:
        corners = sample_corner_colors(path)
    except FileNotFoundError:
        print(f"ERRO: arquivo não encontrado: {path}", file=sys.stderr)
        return 1

    print(json.dumps(corners, ensure_ascii=False))
    return 0


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv

    if args and args[0] == "--corners":
        if len(args) != 2:
            print("uso: compare.py --corners <imagem>", file=sys.stderr)
            return 2
        return cmd_corners(args[1])

    if len(args) != 2:
        print("uso: compare.py <imagem_a> <imagem_b>", file=sys.stderr)
        print("     compare.py --corners <imagem>", file=sys.stderr)
        return 2

    return cmd_compare(args[0], args[1])


if __name__ == "__main__":
    raise SystemExit(main())
