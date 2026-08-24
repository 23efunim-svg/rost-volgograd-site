document.documentElement.classList.add("js");

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

// Header and mobile navigation
const header = qs("[data-header]");
const menuButton = qs("[data-menu-button]");
const mobileMenu = qs("[data-mobile-menu]");

const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 24);
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const setMenu = (open) => {
  if (!menuButton || !mobileMenu) return;
  menuButton.setAttribute("aria-expanded", String(open));
  mobileMenu.setAttribute("aria-hidden", String(!open));
  mobileMenu.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
};

menuButton?.addEventListener("click", () => {
  setMenu(menuButton.getAttribute("aria-expanded") !== "true");
});

qsa("a[href^='#']", mobileMenu || document).forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

// Scroll reveal keeps the page readable when JS or observers are unavailable.
const revealItems = qsa("[data-reveal]");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -7%" });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

// Hero video controls and reduced-motion preference.
const heroVideo = qs(".hero__media video");
const videoToggle = qs("[data-video-toggle]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const setVideoState = (paused) => {
  if (!heroVideo || !videoToggle) return;
  if (paused) heroVideo.pause();
  else heroVideo.play().catch(() => {});
  videoToggle.classList.toggle("is-paused", paused);
  videoToggle.setAttribute("aria-label", paused ? "Включить фоновое видео" : "Остановить фоновое видео");
};

if (reduceMotion.matches) setVideoState(true);
videoToggle?.addEventListener("click", () => setVideoState(!heroVideo?.paused));

// Services accordion
qsa("[data-service]").forEach((service) => {
  const trigger = qs("button", service);
  trigger?.addEventListener("click", () => {
    const willOpen = !service.classList.contains("is-open");
    qsa("[data-service]").forEach((item) => {
      item.classList.remove("is-open");
      qs("button", item)?.setAttribute("aria-expanded", "false");
      qs(".service-line__body", item)?.setAttribute("aria-hidden", "true");
    });
    if (willOpen) {
      service.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      qs(".service-line__body", service)?.setAttribute("aria-hidden", "false");
    }
  });
});

// Price calculator. Values are taken from the client's source price image.
const calc = qs("[data-calc]");
const prices = {
  new: { econom: 10000, standard: 15000, elite: 20000 },
  secondary: { econom: 12000, standard: 18000, elite: 23000 },
  cosmetic: { econom: 7000, standard: null, elite: null }
};

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

const updateCalc = () => {
  if (!calc) return;
  const property = qs("input[name='property']:checked", calc)?.value || "new";
  let level = qs("input[name='level']:checked", calc)?.value || "econom";
  const areaInput = qs("input[name='area']", calc);
  const levelInputs = qsa("input[name='level']", calc);

  levelInputs.forEach((input) => {
    input.disabled = prices[property][input.value] === null;
  });

  if (prices[property][level] === null) {
    const economy = qs("input[name='level'][value='econom']", calc);
    if (economy) economy.checked = true;
    level = "econom";
  }

  const area = Number(areaInput?.value || 54);
  const rate = prices[property][level];
  const total = area * rate;
  const progress = ((area - Number(areaInput.min)) / (Number(areaInput.max) - Number(areaInput.min))) * 100;

  if (areaInput) {
    areaInput.style.background = `linear-gradient(to right, var(--accent) ${progress}%, rgba(17, 21, 20, 0.18) ${progress}%)`;
  }
  const areaOutput = qs("[data-area-output]", calc);
  const totalOutput = qs("[data-calc-total]", calc);
  const rateOutput = qs("[data-rate]", calc);
  if (areaOutput) areaOutput.textContent = `${area} м²`;
  if (totalOutput) totalOutput.textContent = `от ${money.format(total)} ₽`;
  if (rateOutput) rateOutput.textContent = `${money.format(rate)} ₽/м²`;
};

calc?.addEventListener("input", updateCalc);
updateCalc();

// Gallery: public titles are intentionally anonymized; filenames remain local implementation details.
const gallerySets = {
  cottage: {
    title: "Готовый коттедж · Волгоград",
    images: [
      ["assets/images/project-cottage-bedroom.webp", "Готовая спальня в коттедже"],
      ["assets/images/project-cottage-living.webp", "Гостиная и обеденная зона"],
      ["assets/images/project-cottage-bath.webp", "Санузел с подсветкой зеркала"]
    ]
  },
  panorama: {
    title: "Квартира с панорамными окнами · Волгоград",
    images: [
      ["assets/images/project-panoramic-windows.webp", "Панорамные окна и трековое освещение"],
      ["assets/images/project-decorative-wall.webp", "Декоративное покрытие и скрытая дверь"]
    ]
  },
  house: {
    title: "Частный дом и участок · Волгоград",
    images: [
      ["assets/images/project-house-facade.webp", "Готовый фасад частного дома"],
      ["assets/images/project-house-gate.webp", "Забор, ворота и мощение участка"]
    ]
  },
  all: {
    title: "Работы РОСТ · Волгоград",
    images: [
      ["assets/images/project-cottage-living.webp", "Готовая гостиная"],
      ["assets/images/project-decorative-wall.webp", "Декоративная отделка"],
      ["assets/images/project-apartment-light.webp", "Чистовая отделка и освещение"],
      ["assets/images/project-apartment-engineering.webp", "Инженерные выводы и трековый свет"],
      ["assets/images/project-house-facade.webp", "Фасад частного дома"],
      ["assets/images/project-rough-electrics.webp", "Электромонтаж на черновом этапе"],
      ["assets/images/project-soundproofing.webp", "Шумоизоляция и обшивка стен"]
    ]
  }
};

const gallery = qs("[data-gallery-modal]");
const galleryImage = qs("[data-gallery-image]");
const galleryTitle = qs("[data-gallery-title]");
const galleryCount = qs("[data-gallery-count]");
let activeGallery = gallerySets.all;
let activeIndex = 0;
let lastGalleryTrigger = null;

const renderGallery = () => {
  const [src, alt] = activeGallery.images[activeIndex];
  if (galleryImage) {
    galleryImage.src = src;
    galleryImage.alt = alt;
  }
  if (galleryTitle) galleryTitle.textContent = activeGallery.title;
  if (galleryCount) galleryCount.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(activeGallery.images.length).padStart(2, "0")}`;
};

const openGallery = (key, trigger) => {
  if (!gallery) return;
  lastGalleryTrigger = trigger || document.activeElement;
  activeGallery = gallerySets[key] || gallerySets.all;
  activeIndex = 0;
  renderGallery();
  gallery.classList.add("is-open");
  gallery.setAttribute("aria-hidden", "false");
  document.body.classList.add("gallery-open");
  qs("[data-gallery-close]", gallery)?.focus();
};

const closeGallery = () => {
  if (!gallery) return;
  gallery.classList.remove("is-open");
  gallery.setAttribute("aria-hidden", "true");
  document.body.classList.remove("gallery-open");
  lastGalleryTrigger?.focus?.();
};

const moveGallery = (direction) => {
  activeIndex = (activeIndex + direction + activeGallery.images.length) % activeGallery.images.length;
  renderGallery();
};

qsa("[data-gallery]").forEach((trigger) => trigger.addEventListener("click", () => openGallery(trigger.dataset.gallery, trigger)));
qs("[data-gallery-close]")?.addEventListener("click", closeGallery);
qs("[data-gallery-prev]")?.addEventListener("click", () => moveGallery(-1));
qs("[data-gallery-next]")?.addEventListener("click", () => moveGallery(1));
gallery?.addEventListener("click", (event) => { if (event.target === gallery) closeGallery(); });

// Lead form and Russian phone formatting
const leadForm = qs("[data-lead-form]");
const phoneInput = qs("input[name='phone']", leadForm || document);

const phoneDigits = (value) => {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith("7")) digits = `7${digits}`;
  return digits.slice(0, 11);
};

const formatPhone = (value) => {
  const digits = phoneDigits(value);
  const rest = digits.slice(1);
  let formatted = "+7";
  if (rest.length) formatted += ` ${rest.slice(0, 3)}`;
  if (rest.length >= 4) formatted += ` ${rest.slice(3, 6)}`;
  if (rest.length >= 7) formatted += `-${rest.slice(6, 8)}`;
  if (rest.length >= 9) formatted += `-${rest.slice(8, 10)}`;
  return formatted;
};

phoneInput?.addEventListener("focus", () => {
  if (!phoneInput.value) phoneInput.value = "+7 ";
});
phoneInput?.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
  phoneInput.closest(".field")?.classList.remove("has-error");
  phoneInput.removeAttribute("aria-invalid");
});

if (leadForm) {
  const params = new URLSearchParams(location.search);
  const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .filter((key) => params.has(key))
    .map((key) => `${key}=${params.get(key)}`)
    .join("&");
  qs("input[name='utm']", leadForm).value = utm;
  qs("input[name='page']", leadForm).value = location.pathname;
  qs("input[name='ts']", leadForm).value = String(Date.now());

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const consent = qs("input[name='consent']", leadForm);
    const digits = phoneDigits(phoneInput?.value || "");
    const phoneField = phoneInput?.closest(".field");
    const consentField = consent?.closest(".consent");
    const message = qs("[data-form-message]", leadForm);
    const submit = qs("button[type='submit']", leadForm);
    const phoneValid = digits.length === 11;
    const consentValid = Boolean(consent?.checked);

    phoneField?.classList.toggle("has-error", !phoneValid);
    consentField?.classList.toggle("has-error", !consentValid);
    phoneInput?.setAttribute("aria-invalid", String(!phoneValid));
    consent?.setAttribute("aria-invalid", String(!consentValid));
    if (!phoneValid || !consentValid) return;

    if (phoneInput) phoneInput.value = formatPhone(digits);
    submit.disabled = true;
    submit.firstChild.textContent = "Готовим расчёт… ";
    message.className = "form-message";

    const productionHosts = ["rem-opt-stroy-torg.ru", "www.rem-opt-stroy-torg.ru"];
    const isPreview = !productionHosts.includes(location.hostname);
    try {
      if (!isPreview) {
        const response = await fetch(leadForm.action, { method: "POST", body: new FormData(leadForm) });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "submit");
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }

      message.textContent = isPreview
        ? "Это ссылка для просмотра. На основном домене расчёт уйдёт менеджеру на почту."
        : "Спасибо! Заявка отправлена. Менеджер свяжется с вами в рабочее время.";
      message.className = "form-message is-visible";
      leadForm.reset();
      qs("input[name='ts']", leadForm).value = String(Date.now());
    } catch {
      message.textContent = "Не удалось отправить. Позвоните по номеру +7 927 528-60-47.";
      message.className = "form-message is-visible is-error";
    } finally {
      submit.disabled = false;
      submit.firstChild.textContent = "Получить расчёт ";
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenu(false);
    closeGallery();
  }
  if (!gallery?.classList.contains("is-open")) return;
  if (event.key === "ArrowLeft") moveGallery(-1);
  if (event.key === "ArrowRight") moveGallery(1);
  if (event.key === "Tab") {
    const controls = qsa("button", gallery).filter((control) => !control.disabled);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
