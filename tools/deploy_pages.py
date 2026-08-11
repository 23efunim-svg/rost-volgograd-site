# -*- coding: utf-8 -*-
"""Публикация витрины на GitHub Pages.

Собирает демо-вариант, кладёт его в отдельный каталог с собственным git
и пушит в ветку gh-pages. Отдельный каталог нужен потому, что build.py
пересоздаёт dist целиком и снёс бы служебную папку .git.
"""
import re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DIST = ROOT / "dist"
PAGES = ROOT / "_pages"
REPO = "https://github.com/23efunim-svg/rost-volgograd-site.git"
BRANCH = "gh-pages"


def run(args, cwd=None, check=True):
    return subprocess.run(args, cwd=cwd or PAGES, check=check,
                          capture_output=True, text=True, encoding="utf-8", errors="replace")


def main():
    print("Собираю демо-вариант…")
    subprocess.run([sys.executable, "build.py", "--demo"], cwd=ROOT, check=True,
                   capture_output=True, text=True, encoding="utf-8", errors="replace")

    # витрина не должна попадать в поиск и конкурировать с боевым доменом
    for f in list(DIST.rglob("index.html")) + [DIST / "404.html"]:
        if f.exists():
            s = f.read_text(encoding="utf-8")
            s = re.sub(r'<meta name="robots" content="[^"]*">',
                       '<meta name="robots" content="noindex, nofollow">', s)
            f.write_text(s, encoding="utf-8")

    git_dir = PAGES / ".git"
    keep = None
    if git_dir.exists():
        keep = ROOT / "_git_tmp"
        if keep.exists():
            shutil.rmtree(keep)
        shutil.move(str(git_dir), str(keep))
    if PAGES.exists():
        shutil.rmtree(PAGES)
    shutil.copytree(DIST, PAGES)
    # серверная часть на статическом хостинге не работает, не публикуем
    for junk in ["api", "zayavki.php", ".htaccess"]:
        p = PAGES / junk
        if p.is_dir():
            shutil.rmtree(p)
        elif p.exists():
            p.unlink()
    if keep:
        shutil.move(str(keep), str(git_dir))
    else:
        run(["git", "init", "-q"])
        run(["git", "remote", "add", "origin", REPO])

    run(["git", "checkout", "-q", "-B", BRANCH], check=False)
    run(["git", "add", "-A"])
    st = run(["git", "status", "--porcelain"])
    if not st.stdout.strip():
        print("Изменений нет, публикация не нужна")
        return
    run(["git", "-c", "user.name=Vitaly Grankin", "-c", "user.email=vitalya-pomogi@yandex.ru",
         "commit", "-qm", "Витрина сайта РОСТ"])
    run(["git", "push", "-q", "-f", "origin", BRANCH])
    print("Опубликовано: https://23efunim-svg.github.io/rost-volgograd-site/")


if __name__ == "__main__":
    main()
