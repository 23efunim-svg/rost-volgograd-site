# -*- coding: utf-8 -*-
"""Трассировка логотипа РОСТ в SVG: контуры из альфа-канала PNG в полигоны."""
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

BASE = Path(r"C:\Users\revol\Projects\freelance\clients\rost-volgograd\site\assets\logo")


def trace(png_name, svg_name, eps=1.1, min_area=28):
    im = Image.open(BASE / png_name)
    a = np.asarray(im.getchannel("A"))
    # лёгкое сглаживание, чтобы убрать «лесенку» от джипега исходника
    a = cv2.medianBlur(a, 5)
    _, mask = cv2.threshold(a, 110, 255, cv2.THRESH_BINARY)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    h, w = mask.shape
    paths = []
    for cnt in contours:
        if cv2.contourArea(cnt) < min_area:
            continue
        approx = cv2.approxPolyDP(cnt, eps, True)
        pts = approx.reshape(-1, 2)
        if len(pts) < 3:
            continue
        d = "M" + " L".join(f"{x} {y}" for x, y in pts) + " Z"
        paths.append(d)

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="currentColor">'
           f'<path fill-rule="evenodd" d="{" ".join(paths)}"/></svg>')
    (BASE / svg_name).write_text(svg, encoding="utf-8")
    print(svg_name, f"{len(svg) / 1024:.1f} КБ,", len(paths), "контуров,", w, "x", h)


trace("mark-brand.png", "mark-brand.svg")
trace("logo-brand.png", "logo-brand.svg")

# favicon: только знак, фирменная бирюза на графите
mark = (BASE / "mark-brand.svg").read_text(encoding="utf-8")
inner = mark.split(">", 1)[1].rsplit("</svg>", 1)[0]
vb = mark.split('viewBox="')[1].split('"')[0]
_, _, vw, vh = [float(x) for x in vb.split()]
side = max(vw, vh) * 1.26
dx, dy = (side - vw) / 2, (side - vh) / 2
fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side:.0f} {side:.0f}">'
       f'<rect width="{side:.0f}" height="{side:.0f}" rx="{side * 0.19:.0f}" fill="#101315"/>'
       f'<g transform="translate({dx:.0f} {dy:.0f})" fill="#09F3DB">{inner}</g></svg>')
(BASE / "favicon.svg").write_text(fav, encoding="utf-8")
print("favicon.svg", f"{len(fav) / 1024:.1f} КБ")

# apple-touch-icon 180x180 из того же знака
img = Image.new("RGB", (180, 180), "#101315")
mk = Image.open(BASE / "mark-brand.png")
mk.thumbnail((116, 140), Image.LANCZOS)
img.paste(mk, ((180 - mk.size[0]) // 2, (180 - mk.size[1]) // 2), mk)
img.save(BASE / "apple-touch-icon.png", "PNG")
print("apple-touch-icon.png", mk.size)
