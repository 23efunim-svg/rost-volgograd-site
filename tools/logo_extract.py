# -*- coding: utf-8 -*-
"""Вытащить бирюзовую монограмму РОСТ из Лого.jpg (фон-самолёт убрать), собрать чистые версии."""
from pathlib import Path
import numpy as np
from PIL import Image

SRC = Path(r"C:\Users\revol\Desktop\Виталя, помоги!\Рост\САЙТ\Лого.jpg")
OUT = Path(r"C:\Users\revol\Projects\freelance\clients\rost-volgograd\site\assets\logo")
OUT.mkdir(parents=True, exist_ok=True)

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.int16)
R, G, B = a[..., 0], a[..., 1], a[..., 2]

# бирюза: зелёный и синий заметно выше красного, и сама точка яркая
mask = (G - R > 55) & (B - R > 45) & (G > 120) & (B > 110)

ys, xs = np.nonzero(mask)
print("пикселей маски:", mask.sum(), "bbox:", xs.min(), ys.min(), xs.max(), ys.max())

# средний цвет логотипа (фирменная бирюза)
brand = a[mask].mean(axis=0).round().astype(int)
print("средний цвет логотипа RGB:", brand, "HEX: #%02X%02X%02X" % tuple(brand))

# сглаженная альфа: считаем «бирюзовость» непрерывно, чтобы края не были рваными
score = np.minimum(G - R, B - R).astype(np.float32)
alpha = np.clip((score - 35) / 45.0, 0, 1)
alpha[~mask] = np.minimum(alpha[~mask], 0.0)
alpha = (alpha * 255).astype(np.uint8)

# 1) версия в фирменной бирюзе на прозрачном
col = np.zeros(a.shape[:2] + (4,), dtype=np.uint8)
col[..., 0], col[..., 1], col[..., 2] = brand[0], brand[1], brand[2]
col[..., 3] = alpha
Image.fromarray(col).save(OUT / "logo-brand.png")

# 2) белая версия (для тёмного фона)
w = col.copy(); w[..., 0:3] = 255
Image.fromarray(w).save(OUT / "logo-white.png")

# 3) графитовая версия (для светлого фона)
g = col.copy(); g[..., 0], g[..., 1], g[..., 2] = 0x22, 0x26, 0x2A
Image.fromarray(g).save(OUT / "logo-dark.png")

# 4) только монограмма без подписи РЕМОПТСТРОЙТОРГ (обрезка по строке текста)
h = a.shape[0]
rowsum = alpha.sum(axis=1)
# ищем пустую полосу между знаком и подписью в нижней трети
zone = rowsum[int(h * 0.80):int(h * 0.92)]
cut = int(h * 0.80) + int(np.argmin(zone))
print("линия реза знак/подпись:", cut, "из", h)
Image.fromarray(col[:cut]).save(OUT / "mark-brand.png")
Image.fromarray(w[:cut]).save(OUT / "mark-white.png")

# 5) обрезать поля у каждого файла
for f in OUT.glob("*.png"):
    img = Image.open(f)
    bbox = img.getchannel("A").getbbox()
    img.crop(bbox).save(f)
    print("crop", f.name, Image.open(f).size)
