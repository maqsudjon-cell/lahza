import { json, err, metaKey, countPhotos, sameSecret } from '../../lib/store.js';

/**
 * GET /api/nazorat?k=<ADMIN_KEY> — sayt egasi uchun barcha albomlar ro'yxati.
 *
 * `ADMIN_KEY` Cloudflare panelidagi SHIFRLANGAN o'zgaruvchi. Repo ochiq,
 * shuning uchun kalit hech qachon kodda turmaydi. Kalit qo'yilmagan bo'lsa
 * bu yo'l umuman yo'q — 404 qaytadi, ya'ni tashqaridan borligi bilinmaydi.
 *
 * Nega kerak: mehmon albom yaratganda uni ko'rish va kerak bo'lsa yordam
 * berish uchun. Xizmat egasi R2'dagi ma'lumotga baribir kira oladi — bu
 * sahifa yangi ruxsat ochmaydi, faqat mavjudini ko'rinadigan qiladi.
 * Shu sabab maxfiylik siyosatida ham ochiq yozilgan.
 */

const KORSATILADI = 40;   // nechta albom uchun surat soni sanaladi
const BIRVAQTDA  = 12;   // R2'ga bir vaqtda nechta so'rov

/**
 * Vazifalarni cheklangan parallellik bilan bajaradi.
 *
 * Ketma-ket bajarilganda 200 ta albom uchun 200 ta R2 so'rovi navbat bilan
 * ketadi va sahifa ochilmay qoladi. Cheksiz parallel esa R2 chegarasiga
 * uriladi. O'n ikkitasi — ishonchli o'rta.
 */
async function pool(items, limit, worker) {
  const natija = new Array(items.length);
  let kursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (kursor < items.length) {
      const i = kursor++;
      natija[i] = await worker(items[i]);
    }
  }));
  return natija;
}

export async function nazorat(request, env) {
  if (!env.ADMIN_KEY) return err('Bunday manzil yo\'q', 404);

  const kalit = new URL(request.url).searchParams.get('k') || '';
  if (!sameSecret(kalit, env.ADMIN_KEY)) return err('Ruxsat yo\'q', 403);

  // `delimiter` bilan faqat albom papkalari qaytadi, ichidagi suratlar emas.
  const idlar = [];
  let cursor;
  do {
    const page = await env.PHOTOS.list({ prefix: 'e/', delimiter: '/', cursor, limit: 1000 });
    for (const p of page.delimitedPrefixes) idlar.push(p.slice(2, -1));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const oqilgan = await pool(idlar, BIRVAQTDA, async (id) => {
    const obj = await env.PHOTOS.get(metaKey(id));
    if (!obj) return null;
    try {
      const m = await obj.json();
      return {
        id: m.id,
        title: m.title,
        date: m.date,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
        manageKey: m.manageKey,
      };
    } catch {
      return null;   // buzuq meta — o'tkazib yuboramiz
    }
  });

  const albomlar = oqilgan.filter(Boolean);
  albomlar.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Surat sonini sanash har bir albom uchun alohida so'rov. Eng yangi
  // qirqtasi bilan cheklaymiz — qolganida raqam o'rniga `null` turadi.
  const yangilar = albomlar.slice(0, KORSATILADI);
  await pool(yangilar, BIRVAQTDA, async (a) => {
    a.photos = await countPhotos(env.PHOTOS, a.id);
  });

  return json({ jami: albomlar.length, albomlar }, 200, { 'cache-control': 'no-store' });
}

/**
 * Yangi albom yaratilganda Telegram'ga xabar yuboradi.
 *
 * Ikkala o'zgaruvchi ham qo'yilmagan bo'lsa jimgina o'tkazib yuboriladi —
 * xabar yuborilmagani albom yaratilishiga xalaqit bermasligi kerak.
 * Shuning uchun xato ham yutiladi va `waitUntil` ichida ishlaydi:
 * foydalanuvchi Telegram javobini kutib turmaydi.
 */
export function telegramXabar(env, ctx, meta, origin) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT) return;

  const matn = [
    '🎉 *Yangi albom*',
    '',
    `*${qochir(meta.title)}*`,
    `Sana: ${qochir(meta.date)}`,
    '',
    `Mehmon: ${origin}/e/${meta.id}`,
    `Boshqaruv: ${origin}/boshqarish/?i=${meta.id}&k=${meta.manageKey}`,
  ].join('\n');

  ctx.waitUntil(
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT,
        text: matn,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    }).catch((e) => console.error('Telegram xabari ketmadi:', e)),
  );
}

/** MarkdownV2 uchun maxsus belgilarni qochiradi. */
function qochir(s) {
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => '\\' + c);
}
