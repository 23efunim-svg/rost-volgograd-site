# -*- coding: utf-8 -*-
"""Конвертация HEIC-фото объектов в JPG + сборка контактных листов для отбора."""
import sys, os, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import pillow_heif

pillow_heif.register_heif_opener()

SRC = Path(r"C:\Users\revol\Desktop\Виталя, помоги!\Рост\САЙТ\Работы по объектам")
OUT = Path(r"C:\Users\revol\Projects\freelance\clients\rost-volgograd\site\_photos_raw")
SHEETS = OUT / "_contact_sheets"


def convert():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for obj_dir in sorted([p for p in SRC.iterdir() if p.is_dir()]):
        files = sorted([p for p in obj_dir.rglob("*") if p.suffix.lower() == ".heic"])
        if not files:
            continue
        dst_dir = OUT / obj_dir.name
        dst_dir.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(files, 1):
            dst = dst_dir / (f.stem + ".jpg")
            if dst.exists():
                index.append({"obj": obj_dir.name, "src": str(f), "jpg": str(dst)})
                continue
            try:
                im = Image.open(f)
                im = im.convert("RGB")
                # длинная сторона максимум 2400 — хватит для сайта с запасом
                w, h = im.size
                scale = 2400 / max(w, h)
                if scale < 1:
                    im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                im.save(dst, "JPEG", quality=92, optimize=True)
                index.append({"obj": obj_dir.name, "src": str(f), "jpg": str(dst),
                              "w": im.size[0], "h": im.size[1]})
                print("ok", dst.name, im.size)
            except Exception as e:
                print("ERR", f, e)
    (OUT / "_index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Всего:", len(index))


def sheets(cols=4, rows=4, cell=460):
    """Контактные листы с подписью имени файла — чтобы визуально отобрать."""
    SHEETS.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except Exception:
        font = ImageFont.load_default()
    for obj_dir in sorted([p for p in OUT.iterdir() if p.is_dir() and not p.name.startswith("_")]):
        files = sorted(obj_dir.glob("*.jpg"))
        per = cols * rows
        for page in range(0, len(files), per):
            chunk = files[page:page + per]
            sheet = Image.new("RGB", (cols * cell, rows * (cell + 28)), "#1a1c1f")
            d = ImageDraw.Draw(sheet)
            for k, f in enumerate(chunk):
                im = Image.open(f)
                im.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
                x = (k % cols) * cell + (cell - im.size[0]) // 2
                y = (k // cols) * (cell + 28) + (cell - im.size[1]) // 2
                sheet.paste(im, (x, y))
                d.text(((k % cols) * cell + 6, (k // cols) * (cell + 28) + cell + 2),
                       f.stem, fill="#4be2d8", font=font)
            name = f"{obj_dir.name}_{page // per + 1}.jpg"
            sheet.save(SHEETS / name, "JPEG", quality=82)
            print("sheet", name)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "sheets":
        sheets()
    else:
        convert()
        sheets()
