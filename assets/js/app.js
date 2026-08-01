/* РОСТ — интерфейс сайта. Всё внутри progressive enhancement: без JS страница читается полностью. */
(function () {
  'use strict';

  document.body.classList.add('js');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- мобильное меню ---------- */
  var burger = $('[data-burger]');
  var mnav = $('[data-mnav]');
  if (burger && mnav) {
    burger.addEventListener('click', function () {
      var open = mnav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- модальное окно ---------- */
  var modal = $('[data-modal-box]');
  var lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    var f = modal.querySelector('input[name="phone"]');
    if (f) setTimeout(function () { f.focus(); }, 60);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  $$('[data-modal]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
  });
  $$('[data-modal-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) closeModal();
  });

  /* ---------- появление блоков ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
    // страховка: если наблюдатель по какой-то причине не сработал,
    // блоки всё равно показываются, а не остаются пустыми
    setTimeout(function () {
      $$('.reveal:not(.is-in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight * 2) el.classList.add('is-in');
      });
    }, 2500);
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- калькулятор ---------- */
  var RATES = {
    econom: { 'new': 10000, old: 12000, cosm: 7000 },
    standart: { 'new': 15000, old: 18000, cosm: 7000 },
    elit: { 'new': 20000, old: 23000, cosm: 7000 }
  };

  var area = $('#calc-area');
  var sumEl = $('[data-calc-sum]');
  var rateEl = $('[data-calc-rate]');
  var areaEl = $('[data-calc-area]');
  var noteEl = $('[data-calc-note]');

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function calc() {
    if (!area || !sumEl) return;
    var a = parseInt(area.value, 10);
    var obj = ($('input[name="obj"]:checked') || {}).value || 'new';
    var lvl = ($('input[name="lvl"]:checked') || {}).value || 'econom';
    var rate = RATES[lvl][obj];

    if (areaEl) areaEl.textContent = a + ' м²';
    sumEl.textContent = 'от ' + fmt(a * rate) + ' ₽';
    if (rateEl) rateEl.textContent = 'по ставке ' + fmt(rate) + ' ₽ за м²';

    if (noteEl) {
      noteEl.textContent = (obj === 'cosm')
        ? 'Мелкий косметический ремонт считается по одной ставке 7 000 ₽ за м² независимо от уровня отделки. Точная стоимость зависит от объёма и сложности работ и определяется после осмотра объекта.'
        : 'Расчёт по прайсу компании. Точная стоимость зависит от объёма и сложности работ и определяется после осмотра объекта.';
    }
  }

  if (area) {
    area.addEventListener('input', calc);
    $$('input[name="obj"], input[name="lvl"]').forEach(function (r) { r.addEventListener('change', calc); });
    calc();
  }

  /* ---------- калькуляторы справочника ----------
     Считают по открытым формулам и показывают цифру сразу,
     без «оставьте телефон, посчитаем» — это ломает доверие. */
  var STEEL = 7850; // кг/м³

  function num(id) {
    var el = document.querySelector('[data-cf="' + id + '"]');
    return el ? parseFloat(String(el.value).replace(',', '.')) || 0 : 0;
  }

  function fmt2(n) {
    return n.toFixed(n < 10 ? 3 : n < 100 ? 2 : 1).replace('.', ',');
  }

  var CALCS = {
    'ves-armatury': function () {
      var d = num('d'), len = num('len');
      var m = Math.PI / 4 * d * d * STEEL / 1e6;
      if (!d) return ['—', ''];
      var total = m * len;
      var perTon = m > 0 ? 1000 / m : 0;
      return [fmt2(m) + ' кг/м',
        'Партия ' + fmt(len) + ' м весит ' + fmt(Math.round(total)) + ' кг. В тонне ' + fmt(Math.round(perTon)) + ' м'];
    },
    'ves-profilnoy-truby': function () {
      var a = num('a'), b = num('b'), t = num('t'), len = num('len');
      if (!a || !b || !t || t * 2 >= Math.min(a, b)) return ['—', 'Проверьте размеры: стенка не может быть толще половины сечения'];
      var m = (2 * (a + b) - 4 * t) * t * STEEL / 1e6;
      var total = m * len;
      var perTon = m > 0 ? 1000 / m : 0;
      return [fmt2(m) + ' кг/м',
        'Партия ' + fmt(len) + ' м весит ' + fmt(Math.round(total)) + ' кг. В тонне ' + fmt(Math.round(perTon)) + ' м'];
    },
    'raschet-listovogo-materiala': function () {
      var len = num('len'), wide = num('wide'), h = num('h'), zap = num('zap');
      if (!len || !wide || !h) return ['—', ''];
      var n = Math.ceil(len / (wide / 1000) * (1 + zap / 100));
      var area = n * (wide / 1000) * h;
      return [fmt(n) + ' шт',
        'Это ' + fmt2(area) + ' м² покрытия при высоте листа ' + String(h).replace('.', ',') + ' м. Запас ' + zap + '% уже учтён'];
    }
  };

  var calcBox = $('[data-calc]');
  if (calcBox) {
    var kind = calcBox.getAttribute('data-calc');
    var out1 = $('[data-cres]'), out2 = $('[data-cres2]');
    var run = function () {
      var fn = CALCS[kind];
      if (!fn) return;
      var r = fn();
      out1.textContent = r[0];
      out2.textContent = r[1];
    };
    $$('[data-cf]').forEach(function (el) {
      el.addEventListener('input', run);
      el.addEventListener('change', run);
    });
    run();
  }

  /* ---------- телефон: маска и проверка ---------- */
  function digits(v) { return (v || '').replace(/\D/g, ''); }

  function maskPhone(v) {
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
    // маску применяем по input и по paste, вставку из буфера не блокируем
    inp.addEventListener('input', function () {
      var pos = inp.selectionStart === inp.value.length;
      inp.value = maskPhone(inp.value);
      if (pos) inp.setSelectionRange(inp.value.length, inp.value.length);
    });
  });

  /* ---------- отправка формы ---------- */
  $$('[data-lead-form]').forEach(function (form) {
    var pageInp = form.querySelector('[data-fill-page]');
    var tsInp = form.querySelector('[data-fill-ts]');
    if (pageInp) pageInp.value = location.pathname + location.search;
    if (tsInp) tsInp.value = String(Date.now());

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('[data-form-msg]');
      var phoneField = form.querySelector('[data-field]');
      var phone = form.querySelector('input[name="phone"]');
      var consent = form.querySelector('input[name="consent"]');
      var btn = form.querySelector('button[type="submit"]');

      if (msg) msg.className = 'form-msg';

      if (!validPhone(phone.value)) {
        phoneField.classList.add('field--err');
        phone.focus();
        return;
      }
      phoneField.classList.remove('field--err');

      if (consent && !consent.checked) {
        if (msg) { msg.className = 'form-msg is-err'; msg.textContent = 'Отметьте согласие на обработку персональных данных'; }
        return;
      }

      var data = new FormData(form);
      var oldText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Отправляем…';

      fetch(form.action, { method: 'POST', body: data })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (res) {
          if (res && res.ok) {
            if (msg) { msg.className = 'form-msg is-ok'; msg.textContent = 'Заявка ушла. Менеджер перезвонит в рабочее время: будни с 9:00 до 18:00, суббота с 9:00 до 14:00.'; }
            form.reset();
            if (typeof window.ym === 'function' && window.__ymId) window.ym(window.__ymId, 'reachGoal', 'lead');
          } else {
            throw new Error('bad');
          }
        })
        .catch(function () {
          if (msg) {
            msg.className = 'form-msg is-err';
            msg.innerHTML = 'Не получилось отправить. Позвоните, пожалуйста: <a href="tel:+79275286047" style="color:inherit;text-decoration:underline">+7 927 528-60-47</a>';
          }
        })
        .then(function () { btn.disabled = false; btn.textContent = oldText; });
    });
  });

  /* ---------- cookie ---------- */
  var KEY = 'rost_cookie_choice';
  var bar = $('[data-cookie]');

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
    if (!saved) {
      // показываем не сразу: сначала человек должен увидеть контент, а не перехватчик
      var shown = false;
      var reveal = function () {
        if (shown) return;
        shown = true;
        bar.classList.add('is-show');
        window.removeEventListener('scroll', onScroll);
      };
      var onScroll = function () { if (window.scrollY > 500) reveal(); };
      window.addEventListener('scroll', onScroll, { passive: true });
      setTimeout(reveal, 9000);
    } else if (saved === 'yes') {
      loadMetrika();
    }
    var set = function (val) {
      try { localStorage.setItem(KEY, val); } catch (err) { /* приватный режим */ }
      bar.classList.remove('is-show');
      if (val === 'yes') loadMetrika();
    };
    var yes = $('[data-cookie-yes]');
    var no = $('[data-cookie-no]');
    if (yes) yes.addEventListener('click', function () { set('yes'); });
    if (no) no.addEventListener('click', function () { set('no'); });
  }
})();
