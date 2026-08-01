# -*- coding: utf-8 -*-
"""Сборка статического сайта РОСТ из данных и шаблонов Jinja2."""
import json, shutil, re
from pathlib import Path
from datetime import date
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
DATA = ROOT / "data"
DIST = ROOT / "dist"
DOMAIN = "rem-opt-stroy-torg.ru"
TODAY = date.today().isoformat()


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


site = load("site.json")
services = load("services.json")
catalog = load("catalog.json")
content = load("content.json")
objects = json.loads((ROOT / "assets" / "photo" / "manifest.json").read_text(encoding="utf-8"))
objects_meta = load("objects.json")
faq_extra = load("faq_extra.json")
calcs_data = load("calcs.json")
FAQ_ALL = content["home"]["faq"] + faq_extra["extra"]

NAV = [
    {"label": "Услуги", "url": "/uslugi/"},
    {"label": "Цены", "url": "/ceny/"},
    {"label": "Стройматериалы", "url": "/stroymaterialy/"},
    {"label": "Работы", "url": "/raboty/"},
    {"label": "Справочник", "url": "/spravochnik/"},
    {"label": "О компании", "url": "/o-kompanii/"},
    {"label": "Контакты", "url": "/kontakty/"},
]

env = Environment(
    loader=FileSystemLoader(ROOT / "templates"),
    autoescape=select_autoescape(["html", "j2"]),
    trim_blocks=True, lstrip_blocks=True,
)
env.globals.update(site=site, nav=NAV, services=services, catalog=catalog,
                   content=content, objects=objects, objects_meta=objects_meta,
                   faq_all=FAQ_ALL, calcs=calcs_data["calcs"],
                   domain=DOMAIN, today=TODAY)


def nbsp(text):
    """Неразрывные пробелы после одиночных предлогов и союзов."""
    return re.sub(r"(?<=[\s>(«„—])([а-яА-Яa-zA-Z]{1,2})\s", r"\1 ", text)


env.filters["nbsp"] = nbsp
env.filters["money"] = lambda v: f"{v:,}".replace(",", " ")


# ---------- JSON-LD ----------
ORG_ID = f"https://{DOMAIN}/#org"


def org_jsonld():
    tels = [p["tel"] for p in site["phones"]["works"] + site["phones"]["sales"]]
    return {
        "@type": "GeneralContractor",
        "@id": ORG_ID,
        "name": "РОСТ · РЕМОПТСТРОЙТОРГ",
        "legalName": site["legal"]["name"],
        "taxID": site["legal"]["inn"],
        "url": f"https://{DOMAIN}/",
        "image": f"https://{DOMAIN}/assets/img/og-cover.jpg",
        "logo": f"https://{DOMAIN}/assets/logo/logo-brand.png",
        "email": site["email"],
        "telephone": tels[0],
        "contactPoint": [
            {"@type": "ContactPoint", "telephone": p["tel"], "contactType": "sales",
             "name": p["name"], "areaServed": "RU", "availableLanguage": "Russian"}
            for p in site["phones"]["works"] + site["phones"]["sales"]
        ],
        "address": {
            "@type": "PostalAddress", "addressLocality": "Волгоград",
            "addressRegion": "Волгоградская область", "postalCode": "400001",
            "streetAddress": "улица Циолковского, 1А", "addressCountry": "RU",
        },
        "areaServed": [{"@type": "City", "name": "Волгоград"},
                       {"@type": "AdministrativeArea", "name": "Волгоградская область"}],
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification",
             "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
             "opens": "09:00", "closes": "18:00"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Saturday"],
             "opens": "09:00", "closes": "14:00"},
        ],
        "foundingDate": "2000",
        "sameAs": [site["social"]["vk"]],
        "priceRange": "от 7000 ₽/м²",
    }


def breadcrumbs(trail):
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n,
             "item": f"https://{DOMAIN}{u}"} for i, (n, u) in enumerate(trail)
        ],
    }


def faq_jsonld(items):
    return {
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q["q"],
             "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in items
        ],
    }


def graph(*nodes):
    return json.dumps({"@context": "https://schema.org", "@graph": [n for n in nodes if n]},
                      ensure_ascii=False)


# ---------- рендер ----------
PAGES = []


NBSP = " "
_TAGS = re.compile(r"<(script|style|pre|code)[^>]*>.*?</\1>|<[^>]+>", re.S | re.I)


def typo(html):
    """Типографика по живому HTML: разряды чисел и одиночные предлоги не рвутся переносом."""
    def fix(text):
        # 15 000 ₽, 7 000 м² — разряд к числу
        text = re.sub(r"(?<=\d)\s(?=\d{3}\b)", NBSP, text)
        # число и единица измерения вместе
        text = re.sub(r"(\d)\s(₽|м²|м³|мм|см|м/п|шт|кг|т|%)", r"\1" + NBSP + r"\2", text)
        # одиночные предлоги и союзы прилипают к следующему слову
        text = re.sub(r"(?<=[\s>(«„])([а-яА-ЯёЁ]{1,2})\s(?=[а-яА-ЯёЁ0-9«])", r"\1" + NBSP, text)
        return text

    out, pos = [], 0
    for m in _TAGS.finditer(html):
        out.append(fix(html[pos:m.start()]))
        out.append(m.group(0))
        pos = m.end()
    out.append(fix(html[pos:]))
    return "".join(out)


def render(tpl, url, title_tag, description, jsonld, **ctx):
    out = DIST / url.strip("/") / "index.html" if url != "/" else DIST / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    page = {"url": url, "title_tag": title_tag, "description": description, "jsonld": jsonld}
    html = typo(env.get_template(tpl).render(page=page, **ctx))
    out.write_text(html, encoding="utf-8")
    PAGES.append(url)
    print("  ", url)


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    print("Страницы:")

    # главная
    render("index.html.j2", "/",
           content["home"]["title_tag"], content["home"]["description"],
           graph(org_jsonld(), faq_jsonld(content["home"]["faq"]),
                 {"@type": "WebSite", "@id": f"https://{DOMAIN}/#site",
                  "url": f"https://{DOMAIN}/", "name": "РОСТ · РЕМОПТСТРОЙТОРГ",
                  "publisher": {"@id": ORG_ID}, "inLanguage": "ru-RU"}))

    # хаб услуг
    render("uslugi.html.j2", "/uslugi/",
           "Услуги и цены: ремонт, строительство, инженерные работы в Волгограде | РОСТ",
           "Все виды строительных и ремонтных работ в Волгограде: ремонт квартир от 7 000 ₽ за м², строительство домов, электрика, сантехника, кровля, заборы. Гарантия 12 месяцев по договору.",
           graph(org_jsonld(), breadcrumbs([("Главная", "/"), ("Услуги и цены", "/uslugi/")])))

    # страницы услуг
    for s in services["services"]:
        url = f"/uslugi/{s['slug']}/"
        svc_ld = {
            "@type": "Service", "name": s["nav"], "serviceType": s["nav"],
            "provider": {"@id": ORG_ID},
            "areaServed": {"@type": "City", "name": "Волгоград"},
            "description": s["lead"],
            "hasOfferCatalog": {
                "@type": "OfferCatalog", "name": s["nav"],
                "itemListElement": [
                    {"@type": "Offer", "itemOffered": {"@type": "Service", "name": w}}
                    for w in s["works"]
                ],
            },
        }
        if s.get("price_ref") == "remont":
            svc_ld["offers"] = {"@type": "Offer", "priceCurrency": "RUB",
                                "price": "7000", "priceSpecification": {
                                    "@type": "UnitPriceSpecification",
                                    "price": "7000", "priceCurrency": "RUB",
                                    "unitText": "м²", "minPrice": "7000"}}
        render("service.html.j2", url, s["title_tag"], s["lead"][:300],
               graph(org_jsonld(), svc_ld,
                     breadcrumbs([("Главная", "/"), ("Услуги и цены", "/uslugi/"), (s["nav"], url)])),
               svc=s)

    # цены
    render("ceny.html.j2", "/ceny/",
           "Цены на ремонт и отделочные работы в Волгограде: прайс 2026 | РОСТ",
           "Прайс на ремонт квартир в Волгограде: эконом от 7 000 ₽ за м², стандарт от 15 000 ₽, элит от 20 000 ₽. Калькулятор стоимости и объяснение, что входит в смету.",
           graph(org_jsonld(), breadcrumbs([("Главная", "/"), ("Цены", "/ceny/")]),
                 faq_jsonld(content["home"]["faq"][:3])))

    # вопросы и ответы
    render("voprosy.html.j2", "/voprosy/",
           "Вопросы и ответы: ремонт, материалы, документы | РОСТ, Волгоград",
           "Сколько стоит ремонт, как проходит работа, сколько длится, можно ли купить материалы отдельно, как работаем с организациями. Ответы на частые вопросы компании РОСТ.",
           graph(org_jsonld(), breadcrumbs([("Главная", "/"), ("Вопросы", "/voprosy/")]),
                 faq_jsonld(FAQ_ALL)))

    # справочник и калькуляторы
    render("spravochnik.html.j2", "/spravochnik/",
           "Справочник и калькуляторы: вес арматуры, профтрубы, расчёт листов | РОСТ",
           "Калькуляторы для стройки, которые показывают цифру сразу: вес арматуры и профильной трубы, расчёт количества листов на кровлю и забор. Формулы открыты.",
           graph(org_jsonld(), breadcrumbs([("Главная", "/"), ("Справочник", "/spravochnik/")]),
                 {"@type": "ItemList", "name": "Калькуляторы",
                  "itemListElement": [
                      {"@type": "ListItem", "position": i + 1, "name": c["name"],
                       "url": f"https://{DOMAIN}/spravochnik/{c['slug']}/"}
                      for i, c in enumerate(calcs_data["calcs"])]}))

    for c in calcs_data["calcs"]:
        url = f"/spravochnik/{c['slug']}/"
        render("calc.html.j2", url,
               f"{c['name']}: расчёт онлайн | РОСТ, Волгоград",
               c["lead"][:300],
               graph(org_jsonld(),
                     breadcrumbs([("Главная", "/"), ("Справочник", "/spravochnik/"), (c["name"], url)]),
                     {"@type": "HowTo", "name": c["h1"], "description": c["lead"],
                      "step": [{"@type": "HowToStep", "text": f["label"]} for f in c["fields"]]}),
               calc=c)

    # каталог материалов
    render("catalog.html.j2", "/stroymaterialy/",
           "Стройматериалы в Волгограде: своя база на Циолковского | РОСТ",
           "Продажа стройматериалов в Волгограде со своей базы на Циолковского, 1А. Считаем количество под объект, собираем комплект целиком, режем в размер. Работаем с организациями по безналу.",
           graph(org_jsonld(),
                 breadcrumbs([("Главная", "/"), ("Стройматериалы", "/stroymaterialy/")]),
                 {"@type": "ItemList", "name": "Категории стройматериалов",
                  "itemListElement": [
                      {"@type": "ListItem", "position": i + 1, "name": c["name"],
                       "url": f"https://{DOMAIN}/stroymaterialy/{c['slug']}/"}
                      for i, c in enumerate(catalog["categories"])]}))

    for c in catalog["categories"]:
        url = f"/stroymaterialy/{c['slug']}/"
        render("catalog-cat.html.j2", url,
               f"{c['name']} в Волгограде: цена и наличие | РОСТ",
               f"{c['lead']} База на Циолковского, 1А. Считаем количество под объект, работаем с организациями по безналу.",
               graph(org_jsonld(),
                     breadcrumbs([("Главная", "/"), ("Стройматериалы", "/stroymaterialy/"), (c["name"], url)]),
                     {"@type": "ItemList", "name": c["name"],
                      "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n}
                                          for i, n in enumerate(c["items"])]}),
               cat=c)

    # портфолио
    render("works.html.j2", "/raboty/",
           "Наши работы: ремонт квартир и дома в Волгограде | РОСТ",
           "Фотографии реальных объектов компании РОСТ в Волгограде: ремонт квартир, коттеджи, инженерные сети, заборы и фасады. Съёмка на объектах, без стоковых картинок.",
           graph(org_jsonld(), breadcrumbs([("Главная", "/"), ("Работы", "/raboty/")])))

    for slug, obj in objects.items():
        meta = objects_meta["objects"].get(slug, {})
        url = f"/raboty/{slug}/"
        render("work.html.j2", url,
               f"{obj['title']}: фото работ | РОСТ, Волгоград",
               meta.get("lead", obj["title"])[:300],
               graph(org_jsonld(),
                     breadcrumbs([("Главная", "/"), ("Работы", "/raboty/"), (obj["title"], url)]),
                     {"@type": "ImageGallery", "name": obj["title"],
                      "about": {"@id": ORG_ID}}),
               slug=slug, obj=obj, meta=meta)

    # статические страницы
    render("about.html.j2", "/o-kompanii/",
           "О компании РОСТ: строим и ремонтируем в Волгограде с 2000 года",
           "РЕМОПТСТРОЙТОРГ работает в Волгограде с 2000 года: строительно-ремонтные работы и продажа стройматериалов. 291 объект за последние четыре года, гарантия 12 месяцев по договору.",
           graph(org_jsonld(), breadcrumbs([("Главная", "/"), ("О компании", "/o-kompanii/")]),
                 {"@type": "AboutPage", "mainEntity": {"@id": ORG_ID}}))

    render("contacts.html.j2", "/kontakty/",
           "Контакты РОСТ в Волгограде: база на Циолковского, 1А, телефоны, реквизиты",
           "Волгоград, улица Циолковского, 1А. Телефоны отдела продаж и отдела ремонта, почта, реквизиты ИП Палферова Д. В., режим работы, схема проезда.",
           graph(org_jsonld(), breadcrumbs([("Главная", "/"), ("Контакты", "/kontakty/")]),
                 {"@type": "ContactPage", "mainEntity": {"@id": ORG_ID}}))

    render("legal.html.j2", "/politika/",
           "Политика обработки персональных данных | РОСТ, Волгоград",
           "Политика обработки персональных данных ИП Палферова Дениса Витальевича: цели обработки, правовые основания, категории данных, сроки хранения и права субъектов.",
           graph(org_jsonld()), doc="policy")

    render("legal.html.j2", "/soglasie/",
           "Согласие на обработку персональных данных | РОСТ, Волгоград",
           "Текст согласия на обработку персональных данных, которое даёт пользователь при отправке формы на сайте РОСТ.",
           graph(org_jsonld()), doc="consent")

    # служебные файлы
    (DIST / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n"
        f"Sitemap: https://{DOMAIN}/sitemap.xml\n"
        f"Host: https://{DOMAIN}\n", encoding="utf-8")

    urls = "\n".join(
        f"  <url><loc>https://{DOMAIN}{u}</loc><lastmod>{TODAY}</lastmod>"
        f"<changefreq>{'weekly' if u == '/' else 'monthly'}</changefreq>"
        f"<priority>{'1.0' if u == '/' else '0.8' if u.count('/') <= 2 else '0.6'}</priority></url>"
        for u in PAGES)
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n</urlset>\n", encoding="utf-8")

    # ассеты и серверная часть
    shutil.copytree(ROOT / "assets", DIST / "assets",
                    ignore=shutil.ignore_patterns("*.py", "__pycache__"))
    if (ROOT / "server").exists():
        shutil.copytree(ROOT / "server", DIST, dirs_exist_ok=True)

    # страница 404 на том же шаблоне
    render("notfound.html.j2", "/404", "Страница не найдена | РОСТ, Волгоград",
           "Такой страницы на сайте нет. Перейдите в каталог материалов или к услугам.",
           graph(org_jsonld()))
    shutil.move(DIST / "404" / "index.html", DIST / "404.html")
    shutil.rmtree(DIST / "404")
    PAGES.remove("/404")

    print(f"\nГотово: {len(PAGES)} страниц в {DIST}")


if __name__ == "__main__":
    build()
