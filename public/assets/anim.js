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

  [...grid.children].forEach((img, i) => img.style.setProperty('--d', (i * 90) + 'ms'));

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      grid.classList.add('filled');
      io.disconnect();
    }
  }, { threshold: 0.25 });

  io.observe(grid);
}
