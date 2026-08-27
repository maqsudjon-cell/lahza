/* ==========================================================================
   Animatsiyalar.

   Bu faylning butun tuzilishi bitta qoidaga bo'ysunadi:
   **animatsiya hech qachon kontentni yashirib qo'ymasligi kerak.**

   Shu sababli uch qavatli himoya bor:
     1. `.anim` klassi <head> dagi kichik skript orqali qo'yiladi — faqat
        IntersectionObserver bor va foydalanuvchi harakatni cheklamagan bo'lsa.
     2. Bu yerdagi har qanday xato `.anim` ni olib tashlaydi, ya'ni sahifa
        oddiy holicha ko'rinadi.
     3. 2.5 soniyadan keyin qolgan hamma narsa majburan ko'rsatiladi.
   ========================================================================== */

let started = false;

boot();

function boot() {
  if (!document.documentElement.classList.contains('anim')) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function start() {
  if (started) return;
  started = true;
  try {
    setupReveals();
    setupPhoneGrid();
    setupCounters();
    setupScrollState();
    setupProgress();
    setupLiveAlbum();
    setupBeats();
    setTimeout(revealEverything, 2500);
  } catch (e) {
    // Animatsiya kontentdan muhimroq emas — xato bo'lsa, oddiy sahifa qoladi.
    console.error('Animatsiya ishga tushmadi:', e);
    document.documentElement.classList.remove('anim');
  }
}

/* --- Bo'limlarning paydo bo'lishi ---------------------------------------- */

function setupReveals() {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      show(en.target);
      io.unobserve(en.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  for (const el of targets) io.observe(el);
}

function show(el) {
  el.classList.add('shown');
  // Animatsiya tugagach qatlamni bo'shatamiz — `will-change` xotirada
  // qatlam ushlab turadi va uzun sahifada telefonni sekinlashtiradi.
  el.addEventListener('transitionend', () => el.classList.add('done'), { once: true });
}

function revealEverything() {
  for (const el of document.querySelectorAll('.reveal:not(.shown)')) show(el);
  document.querySelector('.mini-grid')?.classList.add('filled');
  for (const el of document.querySelectorAll('.count[data-to]')) el.textContent = el.dataset.to;
}

/* --- Raqamlarning sanalishi ---------------------------------------------- */

/**
 * Telefondagi rasmlar soni noldan sanab chiqadi. Bu albom to'lib
 * borayotgani hissini beradi — statik raqam buni bermaydi.
 */
function setupCounters() {
  const nodes = document.querySelectorAll('.count[data-to]');
  if (!nodes.length) return;

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      countUp(en.target);
      io.unobserve(en.target);
    }
  }, { threshold: 0.4 });

  for (const n of nodes) io.observe(n);
}

function countUp(el) {
  const target = Number(el.dataset.to) || 0;
  // Boshlang'ich qiymat HTML'da to'g'ri raqam turadi (JS ishlamasa ham
  // "0 ta rasm" ko'rinmasligi uchun) — sanashni shu yerda noldan boshlaymiz.
  el.textContent = '0';
  const duration = 1100;
  const started = performance.now();

  const step = (now) => {
    const t = Math.min(1, (now - started) / duration);
    // Oxiriga borib sekinlashadi — bir tekis sanash mexanik ko'rinadi.
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

/* --- Aylantirish holati -------------------------------------------------- */

/** Sahifa aylantirilganda yuqori panel ajralib turadi. */
function setupScrollState() {
  const root = document.documentElement;
  let ticking = false;
  const update = () => {
    root.classList.toggle('scrolled', window.scrollY > 8);
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}

/* --- Telefondagi galereya ------------------------------------------------ */

/**
 * Suratlar birin-ketin paydo bo'ladi — to'yda mehmonlar rasm qo'shayotgani
 * shunday ko'rinadi. Bu bezak emas: sahifaga kirgan odam mahsulot nima
 * qilishini matnni o'qimasdan tushunadi.
 */
function setupPhoneGrid() {
  const grid = document.querySelector('.mini-grid');
  if (!grid) return;

  [...grid.children].forEach((img, i) => img.style.setProperty('--d', (i * 55) + 'ms'));

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      grid.classList.add('filled');
      io.disconnect();
    }
  }, { threshold: 0.25 });

  io.observe(grid);
}

/* --- Aylantirish ko'rsatkichi -------------------------------------------- */

/**
 * Panel ostidagi ingichka chiziq sahifaning qancha qismi o'qilganini
 * ko'rsatadi. Uzun sahifada "yana qancha qoldi" degan savolga javob beradi.
 */
function setupProgress() {
  const bar = document.getElementById('progress');
  if (!bar) return;

  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
}

/* --- Jonli albom --------------------------------------------------------- */

/**
 * Telefondagi albom "to'lib turadi": vaqti-vaqti bilan bitta katakcha
 * yangi kelgandek chaqnaydi va rasm soni oshadi.
 *
 * Bu bezak emas. Telegram guruhidagi havolani bosib kelgan odam matnni
 * o'qimasdan turib ham mahsulot nima qilishini ko'radi: mehmonlar rasm
 * qo'shyapti, albom to'lyapti.
 *
 * Ekrandan chiqib ketganda to'xtaydi — fon rejimida telefon batareyasini
 * bekorga yeydigan animatsiya kerak emas.
 */
function setupLiveAlbum() {
  const grid  = document.querySelector('.mini-grid');
  const count = document.querySelector('.phone .count');
  if (!grid || !count) return;

  const tiles = [...grid.children];
  if (!tiles.length) return;

  let i = 0;
  let timer = null;
  let total = 0;
  let boshlangich = 0;

  const tick = () => {
    const tile = tiles[i % tiles.length];
    i++;
    tile.classList.remove('just-in');
    // Klassni qayta qo'yish uchun brauzerni oraliq holatni hisoblashga
    // majburlaymiz — aks holda animatsiya qaytadan boshlanmaydi.
    void tile.offsetWidth;
    tile.classList.add('just-in');

    // Cheksiz o'smasin: sahifa uzoq ochiq qolsa raqam haqiqatga
    // o'xshamay qoladi. Bir necha o'nlab rasm — yetarli taassurot.
    if (total < boshlangich + 60) total += 1;
    count.textContent = total;
  };

  // Boshlashdan oldin ikkita animatsiya tugashi kerak: suratlar navbat
  // bilan chiqishi (9 x 90ms) va raqamning noldan sanalishi (1100ms).
  // Aks holda uchalasi bir vaqtda ishlab, katakchalar yarim ochilgan
  // holatda qolib ketadi.
  const KIRISH_TUGASHI = 2400;
  let boshlandi = false;

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        if (timer) continue;
        const kechikish = boshlandi ? 0 : KIRISH_TUGASHI;
        setTimeout(() => {
          if (!grid.isConnected) return;
          total = Number(count.textContent.replace(/\D/g, '')) || Number(count.dataset.to) || 0;
          boshlangich = boshlangich || total;
          boshlandi = true;
          timer = setInterval(tick, 2600);
        }, kechikish);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  }, { threshold: 0.2 });

  io.observe(grid);
}

/* --- "Tanish holat" chizig'i --------------------------------------------- */

/**
 * Ro'yxatning chap chizig'i aylantirish bilan birga to'ladi.
 *
 * Maqsadi bezak emas: bu sahifadagi eng kuchli ilgak va uni odam
 * O'QISHI kerak. To'lib boruvchi chiziq ko'zni pastga, keyingi qatorga
 * tortadi — xuddi barmoq bilan kuzatib borgandek.
 */
function setupBeats() {
  const list = document.getElementById('beats');
  const rail = document.getElementById('beatsRail');
  if (!list || !rail) return;

  const qatorlar = [...list.querySelectorAll('li')];

  let ticking = false;
  const update = () => {
    ticking = false;
    const r = list.getBoundingClientRect();
    // "O'qish chizig'i" — ekranning 62% i. Ro'yxatning tepasi shu
    // chiziqqa yetganda to'lish boshlanadi, pastki cheti yetganda
    // tugaydi. Ya'ni chiziq ko'zdan bir oz oldinda yuradi.
    const chiziq = innerHeight * 0.62;
    const ulush = Math.max(0, Math.min(1, (chiziq - r.top) / Math.max(1, r.height)));
    // `clip-path` — `scaleY` emas: ikkinchisi gradientni siqib qo'yadi.
    rail.style.clipPath = `inset(0 0 ${((1 - ulush) * 100).toFixed(2)}% 0)`;

    // Chiziqning uchi qaysi qatorga yetgan bo'lsa, o'sha qatorning yon
    // chiziqchasi ham yonadi. Orqaga aylantirilsa qaytib o'chadi.
    const uch = r.top + r.height * ulush;
    for (const li of qatorlar) {
      const b = li.getBoundingClientRect();
      li.classList.toggle('otildi', uch >= b.top + 26);
    }
  };

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
}
