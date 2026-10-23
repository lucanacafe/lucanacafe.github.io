"""PWA ikonlarını, favicon'u ve sosyal paylaşım görselini üretir.

Gereken: pip install pillow fonttools
Çalıştır: python scripts/gen-icons.py
Logo harfi: Lobster fontu (node_modules/@fontsource/lobster) — Lucana'nın altın script logosuna en yakın font.
"""
import io
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
WOFF = ROOT / "node_modules/@fontsource/lobster/files/lobster-latin-400-normal.woff"

NIGHT = (12, 9, 7)
GOLD_A = (246, 231, 193)
GOLD_B = (196, 143, 53)


def load_font():
    f = TTFont(str(WOFF))
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    return f, buf


def gold_gradient(size):
    w, h = size
    g = Image.new("RGB", size)
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.5 + y / h * 0.5)
            # parlak → koyu → parlak (pirinç parıltısı)
            k = abs(t - 0.55) * 1.6
            k = min(1, k)
            px[x, y] = tuple(int(GOLD_B[i] + (GOLD_A[i] - GOLD_B[i]) * k) for i in range(3))
    return g


def icon(size, maskable=False):
    s = size * 4  # süpersampling
    img = Image.new("RGBA", (s, s), NIGHT + (255,))
    d = ImageDraw.Draw(img)
    # sıcak ışık halesi
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((s * 0.15, s * 0.1, s * 0.85, s * 0.8), fill=(196, 120, 40, 90))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(s * 0.12)))
    d = ImageDraw.Draw(img)
    pad = s * (0.2 if maskable else 0.09)
    ring_w = max(4, int(s * 0.022))
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((pad, pad, s - pad, s - pad), outline=255, width=ring_w)
    md.ellipse((pad + ring_w * 2.2, pad + ring_w * 2.2, s - pad - ring_w * 2.2, s - pad - ring_w * 2.2), outline=255, width=max(2, ring_w // 3))
    _, ttf = load_font()
    font = ImageFont.truetype(ttf, int(s * (0.46 if maskable else 0.58)))
    bbox = md.textbbox((0, 0), "L", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    md.text(((s - tw) / 2 - bbox[0] + s * 0.01, (s - th) / 2 - bbox[1]), "L", font=font, fill=255)
    img.paste(gold_gradient((s, s)), (0, 0), mask)
    if not maskable:
        # köşeleri yuvarlatılmış kare
        rmask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(rmask).rounded_rectangle((0, 0, s, s), radius=int(s * 0.22), fill=255)
        out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        out.paste(img, (0, 0), rmask)
        img = out
    return img.resize((size, size), Image.LANCZOS)


def favicon_svg():
    f, _ = load_font()
    gs = f.getGlyphSet()
    gname = f.getBestCmap()[ord("L")]
    pen = SVGPathPen(gs)
    gs[gname].draw(pen)
    bp = BoundsPen(gs)
    gs[gname].draw(bp)
    xmin, ymin, xmax, ymax = bp.bounds
    upm = f["head"].unitsPerEm
    scale = 34 / upm
    w, h = (xmax - xmin) * scale, (ymax - ymin) * scale
    tx = 32 - w / 2 - xmin * scale + 1
    ty = 32 + h / 2 + ymin * scale
    path = pen.getCommands()
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e7c1"/><stop offset=".55" stop-color="#c48f35"/><stop offset="1" stop-color="#f0d48e"/></linearGradient></defs>
<rect width="64" height="64" rx="14" fill="#0c0907"/>
<circle cx="32" cy="32" r="26" fill="none" stroke="url(#g)" stroke-width="2.2"/>
<path transform="translate({tx:.2f} {ty:.2f}) scale({scale:.5f} {-scale:.5f})" d="{path}" fill="url(#g)"/>
</svg>
"""


def og_image():
    base = Image.open(PUB / "images/nargile-gece.webp").convert("RGB")
    W, H = 1200, 630
    r = max(W / base.width, H / base.height)
    base = base.resize((int(base.width * r), int(base.height * r)), Image.LANCZOS)
    base = base.crop(((base.width - W) // 2, (base.height - H) // 2 - 80, (base.width + W) // 2, (base.height + H) // 2 - 80))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for x in range(W):
        a = int(235 * max(0, 1 - x / (W * 0.75)))
        sd.line([(x, 0), (x, H)], fill=NIGHT + (a,))
    img = Image.alpha_composite(base.convert("RGBA"), shade)
    _, ttf = load_font()
    font = ImageFont.truetype(ttf, 170)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).text((70, 150), "Lucana", font=font, fill=255)
    img.paste(gold_gradient((W, H)), (0, 0), mask)
    d = ImageDraw.Draw(img)
    try:
        sub = ImageFont.truetype("arialbd.ttf", 30)
    except OSError:
        sub = ImageFont.load_default()
    d.text((80, 390), "CAFE  ·  NARGİLE  ·  OKEY", font=sub, fill=(232, 193, 112))
    d.text((80, 440), "Çağlayan, Kağıthane  ·  10:00 – 04:00", font=sub, fill=(221, 209, 191))
    img.convert("RGB").save(PUB / "og-image.jpg", quality=86)


if __name__ == "__main__":
    (PUB / "icons").mkdir(parents=True, exist_ok=True)
    icon(192).save(PUB / "icons/icon-192.png")
    icon(512).save(PUB / "icons/icon-512.png")
    icon(512, maskable=True).save(PUB / "icons/icon-maskable-512.png")
    ap = icon(180, maskable=True)
    ap.save(PUB / "icons/apple-touch-icon.png")
    (PUB / "favicon.svg").write_text(favicon_svg(), encoding="utf-8")
    og_image()
    print("ikonlar üretildi")
