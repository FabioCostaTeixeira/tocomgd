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
das etapas seguintes: procura os quatro marcadores de canto (ver
CORNER_COLORS) NA IMAGEM INTEIRA -- não assume onde eles estão, porque numa
arte composta a foto é redimensionada/posicionada dentro do canvas e uma
máscara pode cobrir parte dela -- e reporta se cada um foi encontrado e em
que posição:

    python tests/compare.py --corners arte.png

Saída (stdout, exit code 0):

    {"image_size": [1080, 1080], "markers": {
        "verde": {"found": true, "x": 141, "y": 420, "pixels": 13216},
        "vermelho": {"found": true, "x": 938, "y": 420, "pixels": 12934},
        "azul": {"found": false},
        "magenta": {"found": false}
    }}

Um teste de orientação compara as posições (x, y) dos marcadores
encontrados entre si (qual está mais à esquerda/direita, mais acima/abaixo)
para decidir qual das 8 orientações EXIF foi aplicada -- inclusive os
espelhamentos, já que cada canto tem uma cor distinta.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import NamedTuple

from PIL import Image, ImageChops

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


# Limiar de distância euclidiana RGB para um pixel contar como "provável
# marcador" de uma das quatro cores de CORNER_COLORS.
#
# Medido nas fixtures reais (tests/fixtures/*.jpg cru) e em artes 1080x1080
# compostas com static/img/mascara-rosa-v1.png e mascara-azul-v1.png (foto
# redimensionada/posicionada como o app faz de verdade, máscara por cima):
#
#   - Ruído de compressão JPEG dentro do bloco de um marcador real: a grande
#     maioria dos pixels (>97%) fica a distância < 15 da cor nominal; mesmo
#     nas bordas anti-aliasadas do bloco, o pior valor observado em qualquer
#     uma das 8 fixtures exif*.jpg foi ~88.
#   - A cor de máscara mais próxima de qualquer marcador (nas duas máscaras
#     do projeto, cruas e redimensionadas para 1080x1080 via LANCZOS como a
#     app faz) é o rosa/vermelho da mascara-rosa-v1.png, a ~60 de distância do
#     "vermelho" alvo -- todas as outras combinações máscara×cor ficam acima
#     de ~73. Branco puro (fundo do canvas) fica a ~219 de qualquer marcador.
#
# 40 cobre com folga o ruído esperado dentro de um marcador real e ainda
# sobra ~20 de margem abaixo da colisão real mais próxima (a máscara rosa a
# ~60). Pixels isolados que passam por acaso desse limiar (ruído aleatório,
# artefato de máscara) são descartados por MARKER_MIN_COMPONENT_SIZE abaixo,
# não por este limiar.
MARKER_COLOR_DISTANCE_THRESHOLD = 40

# Lado máximo (em pixels) para o qual a imagem é reduzida (NEAREST, mantém
# proporção) antes do escaneamento pixel a pixel em Python puro.
#
# Os marcadores ocupam uma fração fixa do lado menor da FOTO (~16%,
# fixtures.py), então reduzir a escala preserva essa proporção -- o
# marcador continua um bloco grande e sólido depois do downsample. Sem
# isso, escanear uma fixture de 8000x6000 (48mp.jpg) pixel a pixel em
# Python puro, por cor, seria lento; com o downsample as 4 cores de
# 48mp.jpg escaneiam em <1s (medido).
MARKER_SCAN_MAX_DIM = 400

# Tamanho mínimo (em pixels, já na escala reduzida por MARKER_SCAN_MAX_DIM)
# do MAIOR COMPONENTE CONECTADO (4-vizinhos) de pixels dentro do limiar de
# cor para contar como marcador de verdade, em vez de ruído ou coincidência
# de cor na máscara.
#
# Medido nas 13 fixtures cruas e em artes 1080x1080 compostas: o marcador
# real forma, depois do downsample, um único componente conectado sólido de
# pelo menos 576 pixels (pior caso medido: pesada.jpg, onde o padrão com
# marcadores ocupa só 1/4 do canvas) até ~2304 pixels (12mp.jpg, 48mp.jpg,
# exif*.jpg). Já o ruído puro (pesada.jpg é ~75% dados aleatórios de
# os.urandom, o pior caso possível) nunca forma componente conectado maior
# que 3 pixels: pixels que batem por acaso com uma cor-alvo são
# estatisticamente isolados uns dos outros (a chance de N vizinhos baterem
# em cadeia cai exponencialmente com N), então mesmo com milhares de pixels
# "quase-cor" espalhados pela imagem, o maior blob de ruído medido continua
# de tamanho 2-3.
#
# 150 fica ~4x abaixo do pior caso real (576) e ~50x acima do maior blob de
# ruído observado (3).
MARKER_MIN_COMPONENT_SIZE = 150


def _color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def _downsample_for_scan(img: Image.Image, max_dim: int = MARKER_SCAN_MAX_DIM):
    """Reduz `img` para no máximo `max_dim` no maior lado (NEAREST, mantém
    proporção -- não borra a borda do bloco de cor). Devolve (imagem, escala)
    onde escala é o fator aplicado (1.0 se a imagem já era pequena)."""
    w, h = img.size
    scale = min(1.0, max_dim / max(w, h))
    if scale >= 1.0:
        return img, 1.0
    new_size = (max(1, round(w * scale)), max(1, round(h * scale)))
    return img.resize(new_size, Image.Resampling.NEAREST), scale


def _largest_connected_component(
    match: list[list[bool]], w: int, h: int
) -> dict[str, object] | None:
    """Busca em largura 4-conectada sobre a matriz booleana `match`
    (indexada [y][x]) e devolve o maior componente conectado encontrado,
    como {"size", "cx", "cy"} (centroide em coordenadas de `match`), ou
    None se não houver nenhum pixel marcado."""
    visited = [[False] * w for _ in range(h)]
    best: dict[str, object] | None = None

    for start_y in range(h):
        for start_x in range(w):
            if not match[start_y][start_x] or visited[start_y][start_x]:
                continue

            stack = [(start_x, start_y)]
            visited[start_y][start_x] = True
            size = 0
            sum_x = 0
            sum_y = 0

            while stack:
                x, y = stack.pop()
                size += 1
                sum_x += x
                sum_y += y
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if (
                        0 <= nx < w
                        and 0 <= ny < h
                        and match[ny][nx]
                        and not visited[ny][nx]
                    ):
                        visited[ny][nx] = True
                        stack.append((nx, ny))

            if best is None or size > best["size"]:
                best = {"size": size, "cx": sum_x / size, "cy": sum_y / size}

    return best


def find_markers(path: str | Path) -> dict[str, object]:
    """Procura cada uma das quatro cores de marcador NA IMAGEM INTEIRA (não
    assume onde elas estão -- ver defeito 2 no cabeçalho do módulo) e
    devolve, para cada cor, se foi encontrada e em que posição.

    Um marcador pode legitimamente não aparecer (a máscara cobre parte da
    arte e pode esconder um ou dois cantos da foto); isso é reportado como
    `"found": False`, não como erro.
    """
    img = Image.open(path).convert("RGB")
    width, height = img.size
    small, scale = _downsample_for_scan(img)
    sw, sh = small.size
    px = small.load()

    markers: dict[str, dict[str, object]] = {}
    for name, target in CORNER_COLORS.items():
        match = [[False] * sw for _ in range(sh)]
        for y in range(sh):
            row = match[y]
            for x in range(sw):
                if _color_distance(px[x, y], target) < MARKER_COLOR_DISTANCE_THRESHOLD:
                    row[x] = True

        component = _largest_connected_component(match, sw, sh)

        if component is None or component["size"] < MARKER_MIN_COMPONENT_SIZE:
            markers[name] = {"found": False}
        else:
            markers[name] = {
                "found": True,
                "x": round(component["cx"] / scale),
                "y": round(component["cy"] / scale),
                "pixels": component["size"],
            }

    return {"image_size": [width, height], "markers": markers}


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
        result = find_markers(path)
    except FileNotFoundError:
        print(f"ERRO: arquivo não encontrado: {path}", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
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
