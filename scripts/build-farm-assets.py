"""Lucana Bahçesi oyun görsellerini üretir → public/game/

Kaynak: "Farming crops 16x16" — josehzz, CC0 (https://opengameart.org/content/farming-crops-16x16)
  Sayfa düzeni: 12×10 karo (16 px). Her satırda 2 ürün; her ürün 6 sütun:
  [ürün görseli, olgun, …, tohum]  (soldan sağa olgundan tohuma)

Çıktı:
  public/game/crops.png  → satır başına bir ürün, 6 sütun: [görsel, tohum, filiz, büyüyor, gelişiyor, olgun]
  public/game/soil.png, soil-wet.png, grass.png → aynı paletle üretilmiş 16 px karolar

Kullanım:  python scripts/build-farm-assets.py <Crop_Spritesheet.png yolu>
"""
import sys
from pathlib import Path
from random import Random

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "game"
T = 16

# Kaynak sırası (README): satır×2 + (0 sol / 1 sağ)
SOURCE = [
    "turnip", "rose", "cucumber", "tulip", "tomato", "melon", "eggplant", "lemon", "pineapple", "rice",
    "wheat", "grapes", "strawberry", "cassava", "potato", "coffee", "orange", "avocado", "corn", "sunflower",
]
# Oyundaki ürünler (sıra = crops.png satırı) — supabase/migrations/0010 ile aynı
GAME = ["wheat", "strawberry", "tomato", "lemon", "melon", "grapes", "orange", "coffee"]
# Kaynakta "ürün görseli" tohum paketi olanlar → simge olarak olgun hâli kullanılır
PACKET = {"wheat", "coffee", "rice", "cassava"}


def tile(sheet: Image.Image, col: int, row: int) -> Image.Image:
    return sheet.crop((col * T, row * T, (col + 1) * T, (row + 1) * T))


def build_crops(src: Path):
    sheet = Image.open(src).convert("RGBA")
    atlas = Image.new("RGBA", (6 * T, len(GAME) * T), (0, 0, 0, 0))
    for r, name in enumerate(GAME):
        i = SOURCE.index(name)
        row, base = i // 2, (i % 2) * 6
        icon = tile(sheet, base + 1 if name in PACKET else base, row)
        atlas.paste(icon, (0, r * T))  # ürün görseli
        for s in range(5):  # tohum → olgun
            atlas.paste(tile(sheet, base + 5 - s, row), ((1 + s) * T, r * T))
    atlas.save(OUT / "crops.png", optimize=True)


def build_tiles():
    rnd = Random(7)
    # sürülmüş toprak: koyu/açık sıra çizgileri (karık) + taneler
    def soil(wet: bool):
        base = (92, 58, 33) if not wet else (61, 38, 24)
        furrow = (70, 43, 24) if not wet else (44, 27, 17)
        light = (118, 77, 45) if not wet else (82, 52, 33)
        im = Image.new("RGBA", (T, T), base + (255,))
        px = im.load()
        for y in range(T):
            for x in range(T):
                if y % 4 == 3:
                    px[x, y] = furrow + (255,)
                elif y % 4 == 0:
                    px[x, y] = light + (255,)
                if rnd.random() < 0.06:
                    px[x, y] = (light if rnd.random() < 0.5 else furrow) + (255,)
        if wet:
            for _ in range(5):
                x, y = rnd.randrange(T), rnd.randrange(T)
                px[x, y] = (96, 140, 176, 255)
        return im

    def grass():
        im = Image.new("RGBA", (T, T), (74, 122, 52, 255))
        px = im.load()
        for _ in range(40):
            x, y = rnd.randrange(T), rnd.randrange(T)
            px[x, y] = rnd.choice([(92, 145, 62), (60, 104, 44), (104, 158, 70)]) + (255,)
        for _ in range(3):  # küçük çiçek
            x, y = rnd.randrange(T), rnd.randrange(T)
            px[x, y] = rnd.choice([(232, 193, 112), (240, 236, 220)]) + (255,)
        return im

    soil(False).save(OUT / "soil.png")
    soil(True).save(OUT / "soil-wet.png")
    grass().save(OUT / "grass.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    build_crops(Path(sys.argv[1]))
    build_tiles()
    (OUT / "CREDITS.txt").write_text(
        "Ürün sprite'ları: \"Farming crops 16x16\" — josehzz (https://opengameart.org/users/josehzz)\n"
        "Lisans: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/\n"
        "Kaynak: https://opengameart.org/content/farming-crops-16x16\n\n"
        "Toprak/çimen karoları: Lucana için üretildi (scripts/build-farm-assets.py).\n",
        encoding="utf-8",
    )
    print("public/game hazır")
