/* ==========================================================================
   Rasm quvuri — brauzerda siqish.
   Bu faylning butun mahsulot uchun ahamiyati: 3 MB rasm to'yxonaning sekin
   mobil internetida 5-12 soniya yuklanadi. 350 KB — bir soniyadan kam.
   Shu sababli siqish yuborishdan OLDIN, mijoz tomonida bajariladi.
   ========================================================================== */

export const FULL_EDGE = 1920;   // galereya va yuklab olish uchun
export const THUMB_EDGE = 400;   // katakcha uchun
export const FULL_Q  = 0.82;
export const THUMB_Q = 0.7;

/** OffscreenCanvas eski Safari'da yo'q — shuning uchun ikkala yo'l ham bor. */
const hasOffscreen =
  typeof OffscreenCanvas !== 'undefined' &&
  typeof OffscreenCanvas.prototype.convertToBlob === 'function';

/**
 * Faylni ImageBitmap'ga aylantiradi.
 * imageOrientation: 'from-image' — EXIF burilishini hisobga oladi, aks holda
 * iPhone'dan kelgan rasmlar yonboshlab tushadi.
 */
async function toBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Ba'zi brauzerlar ikkinchi argumentni qo'llab-quvvatlamaydi.
    return await createImageBitmap(file);
  }
}

function fit(w, h, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

function makeCanvas(w, h) {
  if (hasOffscreen) return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function paint(canvas, source, w, h) {
  canvas.getContext('2d', { alpha: false }).drawImage(source, 0, 0, w, h);
  return canvas;
}

function encode(canvas, quality) {
  if (hasOffscreen) return canvas.convertToBlob({ type: 'image/jpeg', quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob bo\'sh qaytardi'))),
      'image/jpeg',
      quality
    );
  });
}

/**
 * Bitta fayldan ikkita JPEG chiqaradi: to'liq (1920px) va eskiz (400px).
 *
 * Tartib ataylab shunday:
 *   1) faylni bir marta dekodlaymiz,
 *   2) 1920px kanvasga chizamiz,
 *   3) katta bitmap'ni DARHOL yopamiz — 12 MP surat xotirada ~48 MB egallaydi
 *      va arzon telefonda buni ushlab turish ilovani o'ldiradi,
 *   4) eskizni 1920px kanvasdan chizamiz, aslidan emas — bu ancha arzon.
 */
export async function processImage(file) {
  const bitmap = await toBitmap(file);
  let fullCanvas;
  try {
    const f = fit(bitmap.width, bitmap.height, FULL_EDGE);
    fullCanvas = paint(makeCanvas(f.w, f.h), bitmap, f.w, f.h);
    var dims = f;
  } finally {
    if (typeof bitmap.close === 'function') bitmap.close();
  }

  const t = fit(dims.w, dims.h, THUMB_EDGE);
  const thumbCanvas = paint(makeCanvas(t.w, t.h), fullCanvas, t.w, t.h);

  const [full, thumb] = await Promise.all([
    encode(fullCanvas, FULL_Q),
    encode(thumbCanvas, THUMB_Q),
  ]);
  return { full, thumb, w: dims.w, h: dims.h };
}

/**
 * Bir vaqtning o'zida faqat bitta rasm dekodlanadi.
 *
 * Siqish protsessorga bog'liq — uni parallel qilish tezlashtirmaydi, lekin
 * uchta 12 MP bitmap bir vaqtda xotirada tursa (~150 MB) arzon telefonning
 * brauzeri yopilib qoladi. Yuklash esa tarmoqqa bog'liq va parallel bo'lishi
 * kerak — shuning uchun qulf faqat siqishni o'rab turadi.
 */
let cpuChain = Promise.resolve();
export function withCpuLock(task) {
  const run = cpuChain.then(task, task);
  cpuChain = run.then(() => {}, () => {});
  return run;
}

/**
 * Dekodlash ishlamasa (masalan Chrome'da HEIC), faylni o'zini yuboramiz —
 * mehmon rasmini yo'qotgandan ko'ra sekinroq yuklagan afzal.
 */
export async function processImageSafe(file) {
  try {
    return await processImage(file);
  } catch (e) {
    console.warn('Siqib bo\'lmadi, asl fayl yuboriladi:', file.name, e);
    return { full: file, thumb: null, w: 0, h: 0, raw: true };
  }
}

/** Bir vaqtda nechta rasm yuklanadi. Sekin tarmoqda 3 — eng barqaror qiymat. */
export const CONCURRENCY = 3;

/**
 * Vazifalarni cheklangan parallellik bilan bajaradi.
 * Navbat bilan bajarish 10 ta rasm uchun ~3x sekinroq; cheksiz parallel esa
 * mobil tarmoqni bo'g'ib qo'yadi va xatolik ko'payadi.
 */
export async function pool(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

export function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
