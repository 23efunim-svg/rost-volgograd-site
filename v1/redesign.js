document.documentElement.classList.add("js");

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const header = qs("[data-header]");
const menuButton = qs("[data-menu-button]");
const mobileMenu = qs("[data-mobile-menu]");

const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 20);
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const setMenu = (open) => {
  if (!menuButton || !mobileMenu) return;
  const label = open ? "Закрыть меню" : "Открыть меню";
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", label);
  const hiddenLabel = qs(".sr-only", menuButton);
  if (hiddenLabel) hiddenLabel.textContent = label;
  mobileMenu.setAttribute("aria-hidden", String(!open));
  mobileMenu.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
};
menuButton?.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
qsa("a", mobileMenu || document).forEach((link) => link.addEventListener("click", () => setMenu(false)));

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const reveals = qsa("[data-reveal]");
if (!reduceMotion.matches && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      instance.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -6%" });
  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add("is-visible"));
}

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const prices = {
  new: { econom: 10000, standard: 15000, elite: 20000 },
  secondary: { econom: 12000, standard: 18000, elite: 23000 },
  cosmetic: { econom: 7000, standard: null, elite: null }
};
const propertyNames = { new: "Новостройка", secondary: "Вторичка", cosmetic: "Косметический ремонт" };
const levelNames = { econom: "Эконом", standard: "Стандарт", elite: "Элит" };

qsa("[data-calc]").forEach((calc) => {
  const update = () => {
    const property = qs("input[name='property']:checked", calc)?.value || "new";
    let level = qs("input[name='level']:checked", calc)?.value || "econom";
    const areaInput = qs("input[name='area']", calc);
    qsa("input[name='level']", calc).forEach((input) => {
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
    const min = Number(areaInput?.min || 20);
    const max = Number(areaInput?.max || 250);
    const progress = ((area - min) / (max - min)) * 100;
    if (areaInput) areaInput.style.background = `linear-gradient(to right,var(--teal) ${progress}%,rgba(16,25,23,.14) ${progress}%)`;
    const areaOutput = qs("[data-area-output]", calc);
    const totalOutput = qs("[data-calc-total]", calc);
    const rateOutput = qs("[data-rate]", calc);
    const note = qs("[data-calc-note]", calc);
    if (areaOutput) areaOutput.textContent = `${area} м²`;
    if (totalOutput) totalOutput.textContent = `от ${money.format(total)} ₽`;
    if (rateOutput) rateOutput.textContent = `${money.format(rate)} ₽/м²`;
    if (note) note.value = `Расчёт: ${propertyNames[property]}, уровень ${levelNames[level]}, ${area} м², ориентир от ${money.format(total)} ₽ (${money.format(rate)} ₽/м²)`;
  };
  calc.addEventListener("input", update);
  update();
});

const phoneDigits = (value) => {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith("7")) digits = `7${digits}`;
  return digits.slice(0, 11);
};
const formatPhone = (value) => {
  const digits = phoneDigits(value);
  if (!digits) return "";
  const rest = digits.slice(1);
  let formatted = "+7";
  if (rest.length) formatted += ` ${rest.slice(0, 3)}`;
  if (rest.length >= 4) formatted += ` ${rest.slice(3, 6)}`;
  if (rest.length >= 7) formatted += `-${rest.slice(6, 8)}`;
  if (rest.length >= 9) formatted += `-${rest.slice(8, 10)}`;
  return formatted;
};

qsa("[data-lead-form]").forEach((form) => {
  const phone = qs("input[name='phone']", form);
  const consent = qs("input[name='consent']", form);
  const message = qs("[data-form-message]", form);
  const submit = qs("button[type='submit']", form);
  const params = new URLSearchParams(location.search);
  const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .filter((key) => params.has(key))
    .map((key) => `${key}=${params.get(key)}`)
    .join("&");
  const utmInput = qs("input[name='utm']", form);
  const pageInput = qs("input[name='page']", form);
  const tsInput = qs("input[name='ts']", form);
  if (utmInput) utmInput.value = utm;
  if (pageInput) pageInput.value = location.pathname;
  if (tsInput) tsInput.value = String(Date.now());

  phone?.addEventListener("focus", () => { if (!phone.value) phone.value = "+7 "; });
  phone?.addEventListener("input", () => {
    phone.value = formatPhone(phone.value);
    phone.closest(".field")?.classList.remove("has-error");
    phone.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const digits = phoneDigits(phone?.value || "");
    const phoneValid = digits.length === 11;
    const consentValid = Boolean(consent?.checked);
    phone?.closest(".field")?.classList.toggle("has-error", !phoneValid);
    consent?.closest(".consent")?.classList.toggle("has-error", !consentValid);
    phone?.setAttribute("aria-invalid", String(!phoneValid));
    consent?.setAttribute("aria-invalid", String(!consentValid));
    if (!phoneValid || !consentValid) {
      (phoneValid ? consent : phone)?.focus();
      return;
    }

    if (phone) phone.value = formatPhone(digits);
    const originalLabel = submit?.innerHTML || "";
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Отправляем…";
    }
    if (message) message.className = "form-message";
    const productionHosts = ["rem-opt-stroy-torg.ru", "www.rem-opt-stroy-torg.ru"];
    const isPreview = !productionHosts.includes(location.hostname);

    try {
      if (!isPreview) {
        const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error("submit");
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      if (message) {
        message.textContent = isPreview
          ? "Это ссылка для просмотра. На основном домене заявка будет отправлена менеджеру."
          : "Спасибо! Менеджер свяжется с вами в рабочее время.";
        message.className = "form-message is-visible";
      }
      form.reset();
      if (tsInput) tsInput.value = String(Date.now());
      form.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {
      if (message) {
        message.textContent = "Не удалось отправить. Позвоните: +7 927 528-60-47.";
        message.className = "form-message is-visible is-error";
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = originalLabel;
      }
    }
  });
});

const gallery = qs("[data-gallery-modal]");
const galleryImage = qs("[data-gallery-image]", gallery || document);
const galleryTitle = qs("[data-gallery-title]", gallery || document);
const galleryCount = qs("[data-gallery-count]", gallery || document);
let galleryItems = [];
let galleryIndex = 0;
let lastTrigger = null;

const renderGallery = () => {
  const item = galleryItems[galleryIndex];
  if (!item) return;
  if (galleryImage) {
    galleryImage.src = item.dataset.gallerySrc;
    galleryImage.alt = item.dataset.galleryAlt || "";
  }
  if (galleryTitle) galleryTitle.textContent = item.dataset.galleryTitle || "Работы РОСТ";
  if (galleryCount) galleryCount.textContent = `${galleryIndex + 1} / ${galleryItems.length}`;
};
const setBackgroundInert = (inert) => {
  qsa("body > :not(.gallery)").forEach((node) => {
    if (node instanceof HTMLElement) node.inert = inert;
  });
};
const openGallery = (trigger) => {
  if (!gallery) return;
  lastTrigger = trigger;
  const group = trigger.dataset.galleryGroup;
  galleryItems = qsa(`[data-gallery-item][data-gallery-group="${CSS.escape(group)}"]`);
  galleryIndex = Math.max(0, galleryItems.indexOf(trigger));
  renderGallery();
  gallery.classList.add("is-open");
  gallery.setAttribute("aria-hidden", "false");
  document.body.classList.add("gallery-open");
  setBackgroundInert(true);
  qs("[data-gallery-close]", gallery)?.focus();
};
const closeGallery = () => {
  if (!gallery?.classList.contains("is-open")) return;
  gallery.classList.remove("is-open");
  gallery.setAttribute("aria-hidden", "true");
  document.body.classList.remove("gallery-open");
  setBackgroundInert(false);
  lastTrigger?.focus();
};
const moveGallery = (direction) => {
  if (!galleryItems.length) return;
  galleryIndex = (galleryIndex + direction + galleryItems.length) % galleryItems.length;
  renderGallery();
};
qsa("[data-gallery-item]").forEach((item) => item.addEventListener("click", () => openGallery(item)));
qs("[data-gallery-close]", gallery || document)?.addEventListener("click", closeGallery);
qs("[data-gallery-prev]", gallery || document)?.addEventListener("click", () => moveGallery(-1));
qs("[data-gallery-next]", gallery || document)?.addEventListener("click", () => moveGallery(1));
gallery?.addEventListener("click", (event) => { if (event.target === gallery) closeGallery(); });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenu(false);
    closeGallery();
  }
  if (!gallery?.classList.contains("is-open")) return;
  if (event.key === "ArrowLeft") moveGallery(-1);
  if (event.key === "ArrowRight") moveGallery(1);
  if (event.key !== "Tab") return;
  const controls = qsa("button", gallery).filter((item) => !item.disabled);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
