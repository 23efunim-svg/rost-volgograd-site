/* РОСТ — интерфейс. Всё как progressive enhancement: без JS страница читается полностью. */
(function () {
  'use strict';

  document.body.classList.add('js');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

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
        ? (short ? 'Косметика считается по ставке 7 000 ₽ за м² на любом уровне. Ориентир, а не смета.'
                 : 'Мелкий косметический ремонт считается по одной ставке 7 000 ₽ за м² независимо от уровня отделки. Точная стоимость зависит от объёма и сложности работ и определяется после осмотра объекта.')
        : (short ? 'Ориентир, а не смета: точная сумма после осмотра объекта.'
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

      var data = new FormData(form);
      var old = lbl.textContent;
      btn.disabled = true;
      lbl.textContent = 'Отправляем…';

      fetch(form.action, { method: 'POST', body: data })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (res) {
          if (res && res.ok) {
            if (msg) { msg.className = 'msg ok'; msg.textContent = 'Заявка ушла. Менеджер перезвонит в рабочее время: будни 9:00–18:00, суббота 9:00–14:00.'; }
            form.reset();
            if (typeof window.ym === 'function' && window.__ymId) window.ym(window.__ymId, 'reachGoal', 'lead');
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
