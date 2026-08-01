# -*- coding: utf-8 -*-
"""Отбор → единый цветокор → водяной знак → WebP/JPG для сайта РОСТ."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance

BASE = Path(r"C:\Users\revol\Projects\freelance\clients\rost-volgograd\site")
RAW = BASE / "_photos_raw"
DST = BASE / "assets" / "photo" / "objects"
MARK = Image.open(BASE / "assets" / "logo" / "mark-white.png")

SELECTION = {
    "arbat": {
        "dir": "Арбат",
        "title": "Квартира на Арбате",
        "shots": ["IMG_2774", "IMG_2775", "IMG_2778", "IMG_2783", "IMG_2786", "IMG_2787",
                  "IMG_2788", "IMG_2789", "IMG_2790", "IMG_2793", "IMG_2794", "IMG_2797"],
    },
    "partizanskaya": {
        "dir": "Коттедж. Партизанская",
        "title": "Коттедж на Партизанской",
        "shots": ["IMG_5921", "IMG_5922", "IMG_5925", "IMG_5926", "IMG_5930", "IMG_5932",
                  "IMG_5933", "IMG_5935", "IMG_5936", "IMG_5942", "IMG_5973", "IMG_5981",
                  "IMG_5983", "IMG_5985", "IMG_5987", "IMG_5989", "IMG_5991", "IMG_5992",
                  "IMG_5998", "IMG_6002"],
    },
    "barminy": {
        "dir": "Бармины",
        "title": "Дом с сауной",
        "shots": ["IMG_1852", "IMG_1867", "IMG_1861", "IMG_1858", "IMG_1848", "IMG_1847",
                  "IMG_1864", "IMG_1866", "IMG_1869", "IMG_1862", "IMG_1850", "IMG_1846"],
    },
    "yantarnaya": {
        "dir": "Янтарная",
        "title": "Коттедж на Янтарной",
        "shots": ["IMG_2836", "IMG_2840", "IMG_2837", "IMG_2838", "IMG_2839", "IMG_2835",
                  "IMG_2841", "IMG_2842", "IMG_2843", "IMG_2844", "IMG_2845", "IMG_2846",
                  "IMG_2847", "IMG_2851"],
    },
    "simonova": {
        "dir": "Симонова",
        "title": "Квартира на Симонова",
        "shots": ["IMG_3256", "IMG_3257", "IMG_3258", "IMG_3261", "IMG_3262", "IMG_3263",
                  "IMG_3264", "IMG_3265", "IMG_3266", "IMG_3270", "IMG_3271", "IMG_3272",
                  "IMG_3273"],
    },
    "kim": {
        "dir": "Ким",
        "title": "Квартира на Ким",
        "shots": ["IMG_8497", "IMG_8496", "IMG_8482", "IMG_8481", "IMG_8490", "IMG_8463",
                  "IMG_8464", "IMG_8466", "IMG_8468", "IMG_8461", "IMG_8462", "IMG_2765",
                  "IMG_2767", "IMG_2757"],
    },
    "nevskaya": {
        "dir": "Невская",
        "title": "Квартира на Невской",
        "shots": ["IMG_3236", "IMG_3237", "IMG_3238", "IMG_3239", "IMG_3240", "IMG_3242",
                  "IMG_3243", "IMG_3246", "IMG_3249", "IMG_3250", "IMG_3252", "IMG_3253"],
    },
    "borby": {
        "dir": "Борьбы, 12",
        "title": "Квартира на Борьбы",
        "shots": ["IMG_6423", "IMG_6413", "IMG_6408", "IMG_6402", "IMG_6405", "IMG_6409",
                  "IMG_6414", "IMG_6415", "IMG_6417", "IMG_6419", "IMG_6420", "IMG_6401"],
    },
    "goryachevodskaya": {
        "dir": "Горячеводская",
        "title": "Квартира на Горячеводской",
        "shots": ["IMG_2715", "IMG_2704", "IMG_2707", "IMG_2703", "IMG_2713", "IMG_2714",
                  "IMG_2711", "IMG_2721", "IMG_2723", "IMG_2691", "IMG_2689"],
    },
    "lipetskaya": {
        "dir": "Липецкая",
        "title": "Квартира на Липецкой",
        "shots": ["IMG_2733", "IMG_2734", "IMG_2735", "IMG_2738", "IMG_2732", "IMG_2730"],
    },
}

# единая гамма серии: приподнятая точка чёрного, притушенная белого, лёгкая S-кривая
LUT_IN = np.arange(256, dtype=np.float32) / 255.0
CURVE = np.clip(LUT_IN + 0.10 * np.sin(2 * np.pi * LUT_IN) * -1, 0, 1)   # мягкий контраст
CURVE = 0.035 + CURVE * (0.972 - 0.035)                                   # сжатие диапазона
LUT = (CURVE * 255).round().astype(np.uint8)


def grade(im):
    a = np.asarray(im.convert("RGB"))
    a = LUT[a]
    im = Image.fromarray(a)
    im = ImageEnhance.Color(im).enhance(0.93)
    im = ImageEnhance.Sharpness(im).enhance(1.12)
    return im


def watermark(im):
    w, h = im.size
    mw = int(w * 0.075)
    m = MARK.copy()
    m.thumbnail((mw, mw * 3), Image.LANCZOS)
    alpha = m.getchannel("A").point(lambda v: int(v * 0.30))
    m.putalpha(alpha)
    pad = int(w * 0.028)
    im = im.convert("RGBA")
    im.alpha_composite(m, (w - m.size[0] - pad, h - m.size[1] - pad))
    return im.convert("RGB")


def fit(im, long_side):
    w, h = im.size
    s = long_side / max(w, h)
    if s < 1:
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    return im


def run():
    manifest = {}
    for slug, obj in SELECTION.items():
        src_dir = RAW / obj["dir"]
        out_dir = DST / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        items = []
        for i, stem in enumerate(obj["shots"], 1):
            src = src_dir / f"{stem}.jpg"
            if not src.exists():
                print("НЕТ ФАЙЛА:", src)
                continue
            im = grade(Image.open(src))
            big = watermark(fit(im, 1600))
            name = f"{slug}-{i:02d}"
            big.save(out_dir / f"{name}.webp", "WEBP", quality=84, method=6)
            big.save(out_dir / f"{name}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
            th = fit(big, 720)
            th.save(out_dir / f"{name}-thumb.webp", "WEBP", quality=80, method=6)
            th.save(out_dir / f"{name}-thumb.jpg", "JPEG", quality=80, optimize=True)
            items.append({"name": name, "w": big.size[0], "h": big.size[1],
                          "orient": "v" if big.size[1] > big.size[0] else "h"})
            print(name, big.size)
        manifest[slug] = {"title": obj["title"], "photos": items}
    (BASE / "assets" / "photo" / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(len(v["photos"]) for v in manifest.values())
    print("ИТОГО фото:", total, "объектов:", len(manifest))


if __name__ == "__main__":
    run()
