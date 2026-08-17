"""Gera as fotos-problema usadas na matriz de testes.

Os marcadores de canto existem para identificar orientação: cada canto tem uma cor
distinta, então o par de cores que aparece no topo — e a ordem esquerda/direita —
identifica sozinho qual das oito orientações EXIF foi aplicada. Sem isso, um erro
de sinal no espelhamento (2, 4, 5, 7) passaria despercebido.
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "fixtures"
OUT.mkdir(exist_ok=True)

# canto -> cor. Escolhidas bem separadas em RGB para sobreviver ao JPEG.
CANTOS = {
    "TL": (0, 210, 60),     # verde
    "TR": (230, 30, 30),    # vermelho
    "BL": (30, 90, 240),    # azul
    "BR": (230, 40, 220),   # magenta
}


def padrao(w: int, h: int) -> Image.Image:
    """Imagem sem nenhuma simetria, para que as 8 orientações sejam distinguíveis."""
    img = Image.new("RGB", (w, h), (250, 250, 250))
    d = ImageDraw.Draw(img)

    # gradiente de fundo, dá referência de topo/base mesmo sem os marcadores
    for i in range(0, h, 4):
        c = int(200 * i / h)
        d.rectangle([0, i, w, i + 4], fill=(250 - c, 250 - c // 2, 250))

    # elipse central: marca a proporção, denuncia distorção de eixo
    d.ellipse([w * 0.28, h * 0.30, w * 0.72, h * 0.70],
              fill=(255, 235, 0), outline=(20, 20, 20), width=max(3, w // 150))

    lado = int(min(w, h) * 0.16)
    m = int(min(w, h) * 0.04)
    d.rectangle([m, m, m + lado, m + lado], fill=CANTOS["TL"])
    d.rectangle([w - m - lado, m, w - m, m + lado], fill=CANTOS["TR"])
    d.rectangle([m, h - m - lado, m + lado, h - m], fill=CANTOS["BL"])
    d.rectangle([w - m - lado, h - m - lado, w - m, h - m], fill=CANTOS["BR"])
    return img


def exif_com_orientacao(orientation: int) -> Image.Exif:
    exif = Image.Exif()
    exif[0x0112] = orientation  # tag Orientation
    return exif


def gerar_pesada(destino: Path, alvo_min: int, alvo_max: int) -> int:
    """JPEG entre 14 e 15 MB.

    Ruído aleatório não comprime, então o tamanho vem das dimensões e da qualidade.
    Uma configuração fixa erraria o alvo e o teste acabaria exercitando a rejeição
    por tamanho em vez do caminho de decodificação, que é o que interessa aqui.
    """
    import os

    for lado in (7200, 6600, 6000, 5400, 4800, 4200):
        alt = int(lado * 0.75)
        base = Image.frombytes("RGB", (lado, alt), os.urandom(lado * alt * 3))
        # um quadrante com o padrão, para inspeção visual continuar possível
        base.paste(padrao(lado // 2, alt // 2), (0, 0))

        for q in (98, 96, 94, 92, 90, 86, 82):
            base.save(destino, quality=q, subsampling=0)
            tam = destino.stat().st_size
            if alvo_min <= tam < alvo_max:
                return tam
            if tam < alvo_min:
                break  # qualidade só cai daqui pra frente; troca de dimensão

    raise SystemExit(
        f"não foi possível gerar {destino.name} entre "
        f"{alvo_min / 1024 / 1024:.0f} e {alvo_max / 1024 / 1024:.0f} MB"
    )


def main() -> None:
    padrao(4000, 3000).save(OUT / "12mp.jpg", quality=88)
    padrao(8000, 6000).save(OUT / "48mp.jpg", quality=85)

    # Retrato gravado deitado, como sai de celular: 1200x900 de pixels crus.
    # A orientação é só metadata; os pixels são os mesmos nos oito arquivos.
    deitada = padrao(1200, 900)
    for o in range(1, 9):
        deitada.save(OUT / f"exif{o}.jpg", quality=92, exif=exif_com_orientacao(o))

    transp = padrao(1200, 1600).convert("RGBA")
    moldura = Image.new("RGBA", (1800, 2000), (0, 0, 0, 0))
    moldura.paste(transp, (300, 200), transp)
    moldura.save(OUT / "transparente.png")

    padrao(2000, 1500).save(OUT / "foto.webp", format="WEBP", quality=85)

    MB = 1024 * 1024
    tam = gerar_pesada(OUT / "pesada.jpg", 14 * MB, 15 * MB)
    assert 14 * MB <= tam < 15 * MB, f"pesada.jpg ficou com {tam} bytes"

    for f in sorted(OUT.iterdir()):
        print(f"  {f.name:20} {f.stat().st_size / 1024:9.0f} KB")


if __name__ == "__main__":
    main()
