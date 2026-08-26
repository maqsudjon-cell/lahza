/* ==========================================================================
   Chaqnoq API sinovlari.

   Ishga tushirish:
     npx wrangler dev --port 8791     (boshqa oynada)
     npm test

   Boshqa manzilga qarshi ham ishlaydi:
     BASE=https://chaqnoq.uz npm test        <- FAQAT o'qish sinovlari
     BASE=... WRITE=1 npm test               <- yozadigan sinovlar ham

   Ataylab hech qanday kutubxona ishlatilmagan: loyihada build bosqichi
   yo'q, sinov ham shunday bo'lgani ma'qul.
   ========================================================================== */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.BASE || 'http://localhost:8791').replace(/\/$/, '');
const WRITE = process.env.BASE ? process.env.WRITE === '1' : true;

let passed = 0;
const failures = [];
let group = '';

function section(name) { group = name; console.log(`\n\x1b[1m${name}\x1b[0m`); }

function ok(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures.push(`${group} → ${label}${detail ? ` (${detail})` : ''}`);
    console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`);
  }
}

const eq = (label, actual, expected) =>
  ok(label, actual === expected, `kutilgan ${JSON.stringify(expected)}, keldi ${JSON.stringify(actual)}`);

/* --- Sinov fayllari ------------------------------------------------------ */

const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'));

// 1x1 haqiqiy JPEG va PNG — sehrli baytlar tekshiruvi uchun.
const JPEG_1PX = b64(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAA' +
  'AQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh' +
  'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpT' +
  'VFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5' +
  'usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iii' +
  'gD//2Q=='
);
const PNG_1PX = b64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM' +
  'IQAAAABJRU5ErkJggg=='
);
const NOT_IMAGE = new TextEncoder().encode('<html><script>alert(1)</script></html>');

/** Kattaroq, lekin haqiqiy JPEG: oxiriga izoh qo'shamiz, sarlavha o'zgarmaydi. */
function bigJpeg(extra) {
  const out = new Uint8Array(JPEG_1PX.length + extra);
  out.set(JPEG_1PX, 0);
  out.fill(0x20, JPEG_1PX.length);
  return out;
}

const file = (bytes, name, type) => new File([bytes], name, { type });

async function req(path, init) {
  const res = await fetch(BASE + path, init);
  return res;
}

/* --- 1. Xavfsizlik sarlavhalari ------------------------------------------ */

async function testHeaders() {
  section('Xavfsizlik sarlavhalari');

  const html = await req('/', { cache: 'no-store' });
  eq('bosh sahifa 200', html.status, 200);
  ok('CSP bor', (html.headers.get('content-security-policy') || '').includes("default-src 'self'"));
  ok('CSP begona skriptni bloklaydi',
    !(html.headers.get('content-security-policy') || '').includes('script-src *'));
  eq('nosniff', html.headers.get('x-content-type-options'), 'nosniff');
  eq('frame-ancestors', html.headers.get('x-frame-options'), 'DENY');
  ok('referrer-policy', !!html.headers.get('referrer-policy'));
  ok('HSTS', (html.headers.get('strict-transport-security') || '').includes('max-age=31536000'));
  ok('permissions-policy kamerani yopadi',
    (html.headers.get('permissions-policy') || '').includes('camera=()'));

  const api = await req('/robots.txt', { cache: 'no-store' });
  eq('robots.txt ham nosniff oladi', api.headers.get('x-content-type-options'), 'nosniff');
  ok('robots.txt da /e/ yopiq', (await api.text()).includes('Disallow: /e/'));

  const sm = await req('/sitemap.xml', { cache: 'no-store' });
  const smText = await sm.text();
  ok('sitemap XML', smText.startsWith('<?xml'));
  ok('sitemap shaxsiy sahifalarni bermaydi', !smText.includes('/e/') && !smText.includes('/boshqarish/'));
}

/* --- 2. Albom yaratish --------------------------------------------------- */

const post = (path, body) => req(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

async function testCreate() {
  section('Albom yaratish');

  eq('nom yo\'q → 400', (await post('/api/event', { date: '2026-09-12' })).status, 400);
  eq('nom qisqa → 400', (await post('/api/event', { title: 'a', date: '2026-09-12' })).status, 400);
  eq('sana yo\'q → 400', (await post('/api/event', { title: 'Aziza va Bekzod' })).status, 400);
  eq('sana formati noto\'g\'ri → 400',
    (await post('/api/event', { title: 'Aziza va Bekzod', date: '12.09.2026' })).status, 400);
  eq('sana mavjud emas → 400',
    (await post('/api/event', { title: 'Aziza va Bekzod', date: '2026-13-45' })).status, 400);

  const broken = await req('/api/event', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'bu json emas',
  });
  eq('buzuq JSON → 400', broken.status, 400);

  eq('GET bilan yaratib bo\'lmaydi', (await req('/api/event')).status, 404);

  // Ko'rinmas belgilar tozalanadi
  const rtl = 'Aziza‮ va Bekzod';
  const res = await post('/api/event', { title: rtl, date: '2026-09-12' });
  eq('to\'g\'ri so\'rov → 201', res.status, 201);
  const album = await res.json();
  eq('nomdagi yo\'nalish belgisi olib tashlandi', album.title, 'Aziza va Bekzod');
  ok('id 9 belgi', album.id.length === 9, album.id);
  ok('boshqaruv kaliti 28 belgi', album.manageKey.length === 28, String(album.manageKey.length));
  ok('id da chalkash belgi yo\'q (0,1,l,o,i)', !/[01loi]/.test(album.id), album.id);
  ok('muddat ~60 kun',
    Math.round((new Date(album.expiresAt) - Date.now()) / 86400000) === 60);

  const uzun = await post('/api/event', { title: 'x'.repeat(300), date: '2026-09-12' });
  eq('juda uzun nom qirqiladi', (await uzun.json()).title.length, 70);

  return album;
}

/* --- 3. Albomni o'qish --------------------------------------------------- */

async function testRead(album) {
  section('Albomni o\'qish');

  const got = await req(`/api/event/${album.id}`);
  eq('mavjud albom → 200', got.status, 200);
  const meta = await got.json();
  eq('nom mos', meta.title, album.title);
  ok('boshqaruv kaliti OCHIQ javobda YO\'Q', meta.manageKey === undefined,
    JSON.stringify(Object.keys(meta)));

  eq('yo\'q albom → 404', (await req('/api/event/zzzzzzzzz')).status, 404);
  eq('noto\'g\'ri id → 404', (await req('/api/event/AAA-BBB')).status, 404);
  eq('bo\'sh ro\'yxat', (await (await req(`/api/photos/${album.id}`)).json()).photos.length, 0);
}

/* --- 4. Rasm yuklash ----------------------------------------------------- */

async function testUpload(album) {
  section('Rasm yuklash');

  const send = (parts, id = album.id) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(parts)) fd.append(k, v);
    return req(`/api/upload/${id}`, { method: 'POST', body: fd });
  };

  eq('rasm yo\'q → 400', (await send({})).status, 400);
  eq('bo\'sh fayl → 400', (await send({ full: file(new Uint8Array(0), 'a.jpg', 'image/jpeg') })).status, 400);

  // Eng muhim tekshiruv: mijoz "image/jpeg" desa ham, baytlar rasm bo'lmasa rad etiladi.
  const yolgon = await send({ full: file(NOT_IMAGE, 'a.jpg', 'image/jpeg') });
  eq('HTML ni "image/jpeg" deb yuborish → 415', yolgon.status, 415);

  eq('yo\'q albomga yuklash → 404', (await send({ full: file(JPEG_1PX, 'a.jpg', 'image/jpeg') }, 'zzzzzzzzz')).status, 404);

  const jpeg = await send({
    full: file(bigJpeg(4000), 'a.jpg', 'image/jpeg'),
    thumb: file(JPEG_1PX, 't.jpg', 'image/jpeg'),
  });
  eq('to\'g\'ri JPEG → 201', jpeg.status, 201);
  const photo = await jpeg.json();
  ok('rasm id 16 belgi', photo.id.length === 16, photo.id);

  // MIME turi umuman yozilmagan bo'lsa ham baytlardan aniqlanadi
  const pngNoType = await send({ full: file(PNG_1PX, 'a', '') });
  eq('turi yozilmagan PNG → 201', pngNoType.status, 201);

  const png = await send({ full: file(PNG_1PX, 'a.png', 'image/png') });
  eq('PNG → 201', png.status, 201);

  // Ikki xil hajm to'sig'i.
  // (a) So'rovning o'zi juda katta — tanani o'qishdan oldin `content-length`
  //     bo'yicha rad etiladi (12 MB + 1 MB eskiz + chegaralar).
  const juda = await send({ full: file(bigJpeg(15 * 1024 * 1024), 'a.jpg', 'image/jpeg') });
  eq('so\'rov chegaradan katta → 413 (tana o\'qilmasdan)', juda.status, 413);

  // (b) So'rov chegaradan o'tadi, lekin faylning o'zi 12 MB dan katta.
  const chegara = await send({ full: file(bigJpeg(12.4 * 1024 * 1024), 'a.jpg', 'image/jpeg') });
  eq('fayl 12 MB dan katta → 413', chegara.status, 413);

  const list = await (await req(`/api/photos/${album.id}`)).json();
  eq('ro\'yxatda 3 ta rasm', list.photos.length, 3);
  ok('ro\'yxatda faqat id bor', Object.keys(list.photos[0]).join() === 'id',
    Object.keys(list.photos[0]).join());

  return { photoId: photo.id, count: list.photos.length };
}

/* --- 5. Rasm berish ------------------------------------------------------ */

async function testServe(album, photoId) {
  section('Rasm berish');

  const r = await req(`/f/${album.id}/p/${photoId}`);
  eq('rasm → 200', r.status, 200);
  eq('turi JPEG', r.headers.get('content-type'), 'image/jpeg');
  ok('uzoq kesh', (r.headers.get('cache-control') || '').includes('immutable'));
  eq('foydalanuvchi fayliga qat\'iy CSP', r.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  eq('foydalanuvchi fayliga nosniff', r.headers.get('x-content-type-options'), 'nosniff');
  eq('CORP same-origin', r.headers.get('cross-origin-resource-policy'), 'same-origin');

  const etag = r.headers.get('etag');
  ok('etag bor', !!etag);
  const again = await req(`/f/${album.id}/p/${photoId}`, { headers: { 'if-none-match': etag } });
  eq('shartli so\'rov → 304', again.status, 304);
  const weak = await req(`/f/${album.id}/p/${photoId}`, { headers: { 'if-none-match': `W/${etag}, "boshqa"` } });
  ok('W/ prefiks va ro\'yxat ham tushuniladi', weak.status === 304, String(weak.status));

  eq('yo\'q rasm → 404', (await req(`/f/${album.id}/p/zzzzzzzzzzzzzzzz`)).status, 404);
  eq('noto\'g\'ri id shakli → 404', (await req('/f/../p/x')).status, 404);
  eq('noto\'g\'ri tur → 404', (await req(`/f/${album.id}/q/${photoId}`)).status, 404);
  eq('POST bilan bo\'lmaydi', (await req(`/f/${album.id}/p/${photoId}`, { method: 'POST' })).status, 405);
}

/* --- 6. QR --------------------------------------------------------------- */

async function testQr(album) {
  section('QR kod');
  const r = await req(`/api/qr/${album.id}`);
  eq('QR → 200', r.status, 200);
  eq('SVG', (r.headers.get('content-type') || '').split(';')[0], 'image/svg+xml');
  const svg = await r.text();
  ok('SVG tanasi to\'g\'ri', svg.startsWith('<svg') && svg.includes('</svg>'));
  eq('yo\'q albom → 404', (await req('/api/qr/zzzzzzzzz')).status, 404);
}

/* --- 7. ZIP -------------------------------------------------------------- */

async function testZip(album, expectedCount) {
  section('ZIP arxivi');

  eq('kalitsiz → 403', (await req(`/api/zip/${album.id}`)).status, 403);
  eq('noto\'g\'ri kalit → 403', (await req(`/api/zip/${album.id}?k=notogri`)).status, 403);

  const r = await req(`/api/zip/${album.id}?k=${album.manageKey}`);
  eq('to\'g\'ri kalit → 200', r.status, 200);
  eq('turi zip', r.headers.get('content-type'), 'application/zip');

  const declared = Number(r.headers.get('content-length'));
  ok('content-length e\'lon qilingan', Number.isFinite(declared) && declared > 0, String(declared));

  const bytes = new Uint8Array(await r.arrayBuffer());
  eq('e\'lon qilingan hajm haqiqiy hajmga teng', bytes.length, declared);

  const dir = mkdtempSync(join(tmpdir(), 'chaqnoq-'));
  const zipPath = join(dir, 'albom.zip');
  try {
    writeFileSync(zipPath, bytes);
    const out = execFileSync('unzip', ['-t', zipPath], { encoding: 'utf8' });
    ok('unzip -t: arxiv butun (CRC to\'g\'ri)', out.includes('No errors detected'));
    const listed = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
    const names = listed.match(/\d{4}\.(jpg|png|webp|heic)/g) || [];
    eq('arxivda rasm soni to\'g\'ri', names.length, expectedCount);
    ok('PNG o\'z kengaytmasi bilan turibdi', names.some((n) => n.endsWith('.png')), names.join(' '));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  eq('yo\'q albom → 404', (await req('/api/zip/zzzzzzzzz?k=x')).status, 404);
}

/* --- 8. Chastota chegarasi ----------------------------------------------- */

async function testRateLimit() {
  section('Chastota chegarasi');

  let limited = 0;
  for (let i = 0; i < 20; i++) {
    const r = await post('/api/event', { title: `Sinov ${i}`, date: '2026-09-12' });
    if (r.status === 429) {
      limited++;
      if (limited === 1) eq('429 da retry-after bor', r.headers.get('retry-after'), '60');
    }
  }
  ok('ketma-ket 12 ta so\'rovdan keyin chegara ishladi', limited > 0,
    limited === 0 ? 'chegara ishlamadi — bog\'lanish bormi?' : `${limited} ta rad etildi`);
}

/* --- Yurgizish ----------------------------------------------------------- */

console.log(`\x1b[2mManzil: ${BASE}${WRITE ? '' : '  (faqat o\'qish)'}\x1b[0m`);

try {
  await req('/');
} catch {
  console.error(`\n\x1b[31mServer javob bermadi: ${BASE}\x1b[0m\nAvval "npx wrangler dev --port 8791" ni ishga tushiring.\n`);
  process.exit(1);
}

await testHeaders();

if (WRITE) {
  const album = await testCreate();
  await testRead(album);
  const { photoId, count } = await testUpload(album);
  await testServe(album, photoId);
  await testQr(album);
  await testZip(album, count);
  await testRateLimit();
} else {
  console.log('\n\x1b[2mYozadigan sinovlar o\'tkazib yuborildi (WRITE=1 bilan yoqiladi).\x1b[0m');
}

console.log(`\n${'─'.repeat(52)}`);
if (failures.length) {
  console.log(`\x1b[31m${failures.length} ta sinov yiqildi\x1b[0m, ${passed} tasi o'tdi:\n`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`\x1b[32mHammasi o'tdi: ${passed} ta sinov\x1b[0m`);
