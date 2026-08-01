# -*- coding: utf-8 -*-
"""Обложка для соцсетей и мессенджеров (og:image) 1200x630."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = Path(r"C:\Users\revol\Projects\freelance\clients\rost-volgograd\site")
OUT = BASE / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1200, 630
photo = Image.open(BASE / "assets/photo/objects/partizanskaya/partizanskaya-01.jpg").convert("RGB")

# кадрируем по центру под 1200x630
scale = max(W / photo.width, H / photo.height)
photo = photo.resize((round(photo.width * scale), round(photo.height * scale)), Image.LANCZOS)
left = (photo.width - W) // 2
top = (photo.height - H) // 3
canvas = photo.crop((left, top, left + W, top + H))
canvas = canvas.filter(ImageFilter.GaussianBlur(3))

# затемняющий градиент слева, как в первом экране сайта
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for x in range(W):
    a = int(238 - 150 * min(1.0, x / (W * 0.85)))
    od.line([(x, 0), (x, H)], fill=(16, 19, 21, max(a, 60)))
canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")

d = ImageDraw.Draw(canvas)


def font(name, size):
    for p in (rf"C:\Windows\Fonts\{name}", ):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


f_big = font("segoeuib.ttf", 60)
f_mid = font("segoeui.ttf", 27)
f_small = font("segoeui.ttf", 22)

x0, y = 72, 130
d.text((x0, y), "Ремонт и стройка", font=f_big, fill="#EEEBE5")
d.text((x0, y + 74), "в Волгограде", font=f_big, fill="#EEEBE5")
d.text((x0, y + 148), "работу и материалы считаем", font=f_big, fill="#2FB3A8")
d.text((x0, y + 222), "в одной смете", font=f_big, fill="#2FB3A8")

# световая линия, тот же приём, что на сайте
d.rectangle([x0, y + 312, x0 + 120, y + 315], fill="#09F3DB")

d.text((x0, y + 344), "РОСТ · РЕМОПТСТРОЙТОРГ · с 2000 года", font=f_mid, fill="#9BA3A8")
d.text((x0, y + 384), "Волгоград, Циолковского, 1А · +7 927 528-60-47", font=f_small, fill="#7C858B")

# знак в правом верхнем углу
mark = Image.open(BASE / "assets/logo/mark-white.png")
mark.thumbnail((84, 110), Image.LANCZOS)
alpha = mark.getchannel("A").point(lambda v: int(v * 0.85))
mark.putalpha(alpha)
canvas.paste(mark, (W - mark.size[0] - 64, 58), mark)

canvas.save(OUT / "og-cover.jpg", "JPEG", quality=88, optimize=True, progressive=True)
print("og-cover.jpg", canvas.size)
