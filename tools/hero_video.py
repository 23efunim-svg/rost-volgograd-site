# -*- coding: utf-8 -*-
"""Фоновое видео первого экрана из реальных съёмок клиента.

Берём несколько .mov с объектов, режем спокойные куски, склеиваем,
убираем звук, жмём под веб. Никаких стоков: только то, что снято на объектах.
"""
import subprocess, json, shutil
from pathlib import Path

SRC = Path(r"C:\Users\revol\Desktop\Виталя, помоги!\Рост\САЙТ\Работы по объектам")
OUT = Path(r"C:\Users\revol\Projects\freelance\clients\rost-volgograd\site\assets\video")
TMP = Path(r"C:\Users\revol\AppData\Local\Temp\claude\rost-video")

# по 4 секунды из середины каждого ролика: начало и конец обычно смазаны
CLIPS = [
    ("Арбат/IMG_2809.mov", 2.0, 4.0),
    ("Арбат/IMG_2813.mov", 1.5, 4.0),
    ("Коттедж. Партизанская/IMG_5955.mov", 1.0, 4.0),
    ("Арбат/IMG_2816.mov", 1.5, 4.0),
]


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height,duration",
                        "-of", "json", str(p)], capture_output=True, text=True)
    try:
        return json.loads(r.stdout)["streams"][0]
    except Exception:
        return None


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    parts = []

    for i, (rel, start, dur) in enumerate(CLIPS):
        src = SRC / rel
        if not src.exists():
            print("нет файла:", rel)
            continue
        info = probe(src)
        if not info:
            print("не читается:", rel)
            continue
        dst = TMP / f"p{i}.mp4"
        # кадрируем в 16:9, приводим к 1280x720, снимаем звук
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-ss", str(start), "-t", str(dur), "-i", str(src),
            "-an", "-vf",
            "scale=1280:-2:flags=lanczos,crop=1280:720:0:(ih-720)/2,fps=24",
            "-c:v", "libx264", "-preset", "slow", "-crf", "30",
            "-pix_fmt", "yuv420p", str(dst)
        ], check=True)
        parts.append(dst)
        print("нарезан", rel, info.get("width"), "x", info.get("height"))

    if not parts:
        print("нечего склеивать")
        return

    lst = TMP / "list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")

    final = OUT / "hero.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", str(lst), "-an",
        "-c:v", "libx264", "-preset", "slow", "-crf", "31",
        "-profile:v", "main", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(final)
    ], check=True)

    size = final.stat().st_size / 1024 / 1024
    print(f"hero.mp4 готов: {size:.1f} МБ")
    if size > 4:
        print("ВНИМАНИЕ: тяжелее 4 МБ, стоит поднять crf или сократить длительность")

    # постер на случай, если видео не запустится
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(final),
        "-vframes", "1", "-q:v", "3", str(OUT / "hero-poster.jpg")
    ], check=True)
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == "__main__":
    build()
