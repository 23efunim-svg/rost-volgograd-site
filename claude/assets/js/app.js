/* РОСТ — интерфейс. Всё как progressive enhancement: без JS страница читается полностью. */
(function () {
  'use strict';

  document.body.classList.add('js');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var isPreview = window.__demo === true ||
    location.hostname === '127.0.0.1' ||
    location.hostname === 'localhost' ||
    /\.(?:netlify\.app|github\.io)$/i.test(location.hostname);

  /* ---------- цели Метрики ----------
     Вызываются на каждое целевое действие. Если счётчик не подключён, молчат. */
  function goal(name, params) {
    try { if (window.ym && window.__ymId) window.ym(window.__ymId, 'reachGoal', name, params || {}); } catch (e) {}
  }
  window.rostGoal = goal;

  /* ---------- тема: день и ночь ----------
     Выбор пользователя важнее системного, поэтому храним его отдельно. */
  var THEME_KEY = 'rost_theme';
  var root = document.documentElement;
  function applyTheme(t) {
    t = t === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', t);
    root.style.colorScheme = t;
    var meta = $('[data-theme-color]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#101215' : '#FFFFFF');
  }
  (function () {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') applyTheme(saved);
    else applyTheme(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  })();
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      goal('theme_switch', { to: next });
    });
  });

  /* ---------- скролл: прогресс чтения, тень шапки, кнопка наверх, параллакс ---------- */
  var hdr = $('.hdr'), prog = $('[data-prog]'), up = $('[data-up]'), scrolled = false;
  var prlx = $$('[data-prlx]');
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (prog) {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (docH > 0 ? Math.min(100, Math.max(0, y / docH * 100)) : 0) + '%';
    }
    if (hdr) {
      // гистерезис, иначе тень мигает на границе
      if (!scrolled && y > 90) { scrolled = true; hdr.classList.add('is-scrolled'); }
      else if (scrolled && y < 40) { scrolled = false; hdr.classList.remove('is-scrolled'); }
    }
    if (up) up.classList.toggle('on', y > 700);
    if (prlx.length) {
      var vh = window.innerHeight || 800;
      prlx.forEach(function (el) {
        var k = parseFloat(el.getAttribute('data-prlx')) || 0;
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate3d(0,' + (((r.top + r.height / 2) - vh / 2) * -k).toFixed(1) + 'px,0)';
      });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  if (up) up.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    goal('scroll_up');
  });

  /* ---------- счётчики цифр ---------- */
  function animateCount(el) {
    var to = parseFloat(el.getAttribute('data-count')) || 0;
    if (to <= 0) return;
    var pre = el.getAttribute('data-pre') || '', suf = el.getAttribute('data-suf') || '';
    var st = null, dur = 1500;
    function step(ts) {
      if (!st) st = ts;
      var p = Math.min((ts - st) / dur, 1);
      el.textContent = pre + Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('ru-RU') + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = $$('[data-count]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); } });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cio.observe(el); });
      // страховка: если наблюдатель не сработал, показываем итоговые числа
      setTimeout(function () { counters.forEach(function (el) { if (!el.textContent.trim()) animateCount(el); }); }, 4000);
    } else {
      counters.forEach(animateCount);
    }
  }

  /* ---------- лайтбокс галереи ---------- */
  var lb = $('[data-lb]');
  if (lb) {
    var lbImg = $('[data-lb-img]', lb), lbNum = $('[data-lb-num]', lb);
    var figs = $$('.gal figure'), idx = 0;
    var openLb = function (i) {
      idx = (i + figs.length) % figs.length;
      var im = figs[idx].querySelector('img');
      lbImg.src = im.getAttribute('data-full') || im.src;
      lbImg.alt = im.alt || '';
      if (lbNum) lbNum.textContent = (idx + 1) + ' из ' + figs.length + '. Стрелки листают, Esc закрывает';
      lb.classList.add('on');
      document.documentElement.style.overflow = 'hidden';
    };
    var closeLb = function () { lb.classList.remove('on'); document.documentElement.style.overflow = ''; };
    figs.forEach(function (f, i) { f.addEventListener('click', function () { openLb(i); goal('gallery_open'); }); });
    $$('[data-lb-x]', lb).forEach(function (b) { b.addEventListener('click', closeLb); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('on')) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight') openLb(idx + 1);
      if (e.key === 'ArrowLeft') openLb(idx - 1);
    });
  }

  /* ---------- фоновое видео первого экрана ----------
     Не грузим на узком экране, при экономии трафика и на медленном соединении. */
  (function () {
    var v = $('[data-hero-video]');
    if (!v) return;
    var conn = navigator.connection || {};
    var slow = conn.saveData || /2g/.test(conn.effectiveType || '');
    if (slow || window.innerWidth < 861) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.src = v.getAttribute('data-hero-video');
    var pr = v.play();
    if (pr && pr.then) pr.then(function () { v.classList.add('on'); }).catch(function () {});
  })();

  /* ---------- клики по телефону и мессенджерам в цели ---------- */
  $$('a[href^="tel:"]').forEach(function (a) { a.addEventListener('click', function () { goal('phone_click'); }); });
  $$('a[href*="vk.ru"], a[href*="max.ru"]').forEach(function (a) {
    a.addEventListener('click', function () { goal('messenger', { type: a.href.indexOf('max.ru') > -1 ? 'max' : 'vk' }); });
  });

  /* ---------- мобильное меню ---------- */
  var brg = $('[data-brg]'), mnav = $('[data-mnav]');
  if (brg && mnav) {
    brg.addEventListener('click', function () {
      var open = mnav.classList.toggle('on');
      brg.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- модальное окно ---------- */
  var mdl = $('[data-mdl]'), lastFocus = null;

  function openMdl() {
    if (!mdl) return;
    lastFocus = document.activeElement;
    mdl.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    var f = mdl.querySelector('input[name="phone"]');
    if (f) setTimeout(function () { f.focus(); }, 60);
  }
  function closeMdl() {
    if (!mdl) return;
    mdl.classList.remove('on');
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  $$('[data-modal]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openMdl(); });
  });
  $$('[data-mdl-x]').forEach(function (b) { b.addEventListener('click', closeMdl); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mdl && mdl.classList.contains('on')) closeMdl();
  });

  /* ---------- появление блоков ----------
     Скролл-обработчик надёжнее IntersectionObserver, плюс обязательная
     страховка по таймеру: без неё контент может остаться невидимым. */
  var rv = $$('.rv');
  function showAll() { rv.forEach(function (el) { el.classList.add('in'); }); }
  function tick() {
    var vh = window.innerHeight;
    rv.forEach(function (el) {
      if (el.classList.contains('in')) return;
      if (el.getBoundingClientRect().top < vh - 40) el.classList.add('in');
    });
  }
  if (rv.length) {
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('load', tick);
    tick();
    setTimeout(showAll, 4000);
  }

  /* ---------- калькулятор ремонта ---------- */
  var RATES = {
    econom:   { 'new': 10000, old: 12000, cosm: 7000 },
    standart: { 'new': 15000, old: 18000, cosm: 7000 },
    elit:     { 'new': 20000, old: 23000, cosm: 7000 }
  };
  var area = $('#calc-area'), sumEl = $('[data-calc-sum]'), rateEl = $('[data-calc-rate]'),
      areaEl = $('[data-calc-area]'), noteEl = $('[data-calc-note]');

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function calcRemont() {
    if (!area || !sumEl) return;
    var a = parseInt(area.value, 10);
    var obj = ($('input[name="obj"]:checked') || {}).value || 'new';
    var lvl = ($('input[name="lvl"]:checked') || {}).value || 'econom';
    var rate = RATES[lvl][obj];
    if (areaEl) areaEl.textContent = a + ' м²';
    sumEl.textContent = 'от ' + fmt(a * rate) + ' ₽';
    if (rateEl) rateEl.textContent = 'по ставке ' + fmt(rate) + ' ₽ за м²';
    var qn = $('[data-quiz-note]');
    if (qn) {
      var oName = { 'new': 'новостройка', old: 'вторичка', cosm: 'косметика' }[obj];
      var lName = { econom: 'эконом', standart: 'стандарт', elit: 'элит' }[lvl];
      qn.value = 'Квиз: ' + oName + ', ' + lName + ', ' + a + ' м², ориентировочно от ' + fmt(a * rate) + ' ₽';
    }
    if (noteEl) {
      var short = noteEl.classList.contains('quiz__note');
      noteEl.textContent = (obj === 'cosm')
        ? (short ? 'Косметика считается по ставке 7 000 ₽ за м² на любом уровне. Точную сумму дадим после замера.'
                 : 'Мелкий косметический ремонт считается по одной ставке 7 000 ₽ за м² независимо от уровня отделки. Точная стоимость зависит от объёма и сложности работ и определяется после осмотра объекта.')
        : (short ? 'Порядок суммы по нашему прайсу. Точную считаем после замера.'
                 : 'Расчёт по прайсу компании. Точная стоимость зависит от объёма и сложности работ и определяется после осмотра объекта.');
    }
  }
  if (area) {
    area.addEventListener('input', calcRemont);
    $$('input[name="obj"], input[name="lvl"]').forEach(function (r) { r.addEventListener('change', calcRemont); });
    calcRemont();
  }

  /* ---------- калькуляторы справочника ---------- */
  var STEEL = 7850;
  function num(id) {
    var el = $('[data-cf="' + id + '"]');
    return el ? parseFloat(String(el.value).replace(',', '.')) || 0 : 0;
  }
  function fmt2(n) { return n.toFixed(n < 10 ? 3 : n < 100 ? 2 : 1).replace('.', ','); }

  var CALCS = {
    'ves-armatury': function () {
      var d = num('d'), len = num('len');
      if (!d) return ['—', ''];
      var m = Math.PI / 4 * d * d * STEEL / 1e6;
      return [fmt2(m) + ' кг/м',
        'Партия ' + fmt(len) + ' м весит ' + fmt(m * len) + ' кг. В тонне ' + fmt(1000 / m) + ' м'];
    },
    'ves-profilnoy-truby': function () {
      var a = num('a'), b = num('b'), t = num('t'), len = num('len');
      if (!a || !b || !t || t * 2 >= Math.min(a, b)) return ['—', 'Проверьте размеры: стенка не может быть толще половины сечения'];
      var m = (2 * (a + b) - 4 * t) * t * STEEL / 1e6;
      return [fmt2(m) + ' кг/м',
        'Партия ' + fmt(len) + ' м весит ' + fmt(m * len) + ' кг. В тонне ' + fmt(1000 / m) + ' м'];
    },
    'raschet-listovogo-materiala': function () {
      var len = num('len'), wide = num('wide'), h = num('h'), zap = num('zap');
      if (!len || !wide || !h) return ['—', ''];
      var n = Math.ceil(len / (wide / 1000) * (1 + zap / 100));
      var s = n * (wide / 1000) * h;
      return [fmt(n) + ' шт',
        'Это ' + fmt2(s) + ' м² покрытия при высоте листа ' + String(h).replace('.', ',') + ' м. Запас ' + zap + '% учтён'];
    }
  };

  var cbox = $('[data-calc]');
  if (cbox) {
    var kind = cbox.getAttribute('data-calc');
    var o1 = $('[data-cres]'), o2 = $('[data-cres2]');
    var run = function () {
      var fn = CALCS[kind];
      if (!fn) return;
      var r = fn();
      o1.textContent = r[0];
      o2.textContent = r[1];
    };
    $$('[data-cf]').forEach(function (el) {
      el.addEventListener('input', run);
      el.addEventListener('change', run);
    });
    run();
  }

  /* ---------- телефон ---------- */
  function digits(v) { return (v || '').replace(/\D/g, ''); }
  function mask(v) {
    var d = digits(v);
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 5) out += ') ' + d.slice(4, 7);
    if (d.length >= 8) out += '-' + d.slice(7, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 11);
    return out;
  }
  function validPhone(v) {
    var d = digits(v);
    return d.length === 11 && (d[0] === '7' || d[0] === '8');
  }
  $$('input[name="phone"]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      var atEnd = inp.selectionStart === inp.value.length;
      inp.value = mask(inp.value);
      if (atEnd) inp.setSelectionRange(inp.value.length, inp.value.length);
    });
  });

  /* ---------- отправка формы ---------- */
  $$('[data-lead]').forEach(function (form) {
    var p = form.querySelector('[data-page]'), t = form.querySelector('[data-ts]');
    if (p) p.value = location.pathname + location.search;
    if (t) t.value = String(Date.now());
    var u = form.querySelector('[data-utm]');
    if (u) {
      // метки рекламы держим весь визит: человек может уйти на другую страницу и вернуться
      var qs = new URLSearchParams(location.search), keep = [];
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid'].forEach(function (k) {
        if (qs.get(k)) keep.push(k + '=' + qs.get(k));
      });
      var saved = '';
      try {
        if (keep.length) sessionStorage.setItem('rost_utm', keep.join('&'));
        saved = sessionStorage.getItem('rost_utm') || '';
      } catch (e) { saved = keep.join('&'); }
      var ref = document.referrer ? 'ref: ' + document.referrer.slice(0, 180) : '';
      u.value = [saved, ref].filter(Boolean).join(' | ');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('[data-msg]');
      var fld = form.querySelector('[data-fld]');
      var phone = form.querySelector('input[name="phone"]');
      var consent = form.querySelector('input[name="consent"]');
      var btn = form.querySelector('button[type="submit"]');
      var lbl = btn.querySelector('span') || btn;

      if (msg) msg.className = 'msg';

      if (!validPhone(phone.value)) { fld.classList.add('err'); phone.focus(); return; }
      fld.classList.remove('err');

      if (consent && !consent.checked) {
        if (msg) { msg.className = 'msg no'; msg.textContent = 'Отметьте согласие на обработку персональных данных'; }
        return;
      }

      if (isPreview) {
        // витрина без серверной части: не делаем вид, что заявка ушла
        if (msg) {
          msg.className = 'msg ok';
          msg.innerHTML = 'Это витрина для показа. Заявки принимает боевой сайт. ' +
            'Позвоните: <a href="tel:+79275286047" style="color:inherit;text-decoration:underline">+7 927 528-60-47</a>';
        }
        return;
      }
      var data = new FormData(form);
      var old = lbl.textContent;
      btn.disabled = true;
      lbl.textContent = 'Отправляем…';

      fetch(form.action, { method: 'POST', body: data })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (res) {
          if (res && res.ok) {
            if (msg) { msg.className = 'msg ok'; msg.textContent = 'Заявка ушла. Менеджер перезвонит в рабочее время: будни 9:00–18:00, суббота 9:00–14:00.'; }
            var src = (form.querySelector('[name="source"]') || {}).value || '';
            goal('lead_any');
            goal(/[Кк]виз/.test(src) ? 'lead_quiz' : 'lead_form', { src: src });
            form.reset();
          } else { throw new Error('bad'); }
        })
        .catch(function () {
          if (msg) {
            msg.className = 'msg no';
            msg.innerHTML = 'Не получилось отправить. Позвоните: <a href="tel:+79275286047" style="color:inherit;text-decoration:underline">+7 927 528-60-47</a>';
          }
        })
        .then(function () { btn.disabled = false; lbl.textContent = old; });
    });
  });

  /* ---------- cookie ---------- */
  var KEY = 'rost_cookie_choice', bar = $('[data-ck]');
  function loadMetrika() {
    if (!window.__ymId || window.__ymLoaded) return;
    window.__ymLoaded = true;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(window.__ymId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  if (bar) {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (err) { saved = null; }
    if (!saved) { setTimeout(function () { bar.classList.add('on'); }, 1200); }
    else if (saved === 'yes') { loadMetrika(); }
    var set = function (v) {
      try { localStorage.setItem(KEY, v); } catch (err) {}
      bar.classList.remove('on');
      if (v === 'yes') loadMetrika();
    };
    var y = $('[data-ck-yes]'), n = $('[data-ck-no]');
    if (y) y.addEventListener('click', function () { set('yes'); });
    if (n) n.addEventListener('click', function () { set('no'); });
  }
})();
