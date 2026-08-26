import { err, readEvent, listPhotos, fullKey, safeFilename, extForType } from '../../lib/store.js';

/* ==========================================================================
   GET /api/zip/:id?k=manageKey
   Butun albomni bitta ZIP qilib beradi.

   ZIP oqim bilan yasaladi: har bir rasm R2'dan olinadi, arxivga yoziladi va
   xotiradan chiqariladi. Shuning uchun 500 ta rasmli albom ham Worker'ning
   xotira chegarasiga urilmaydi.

   Siqish yo'q ("store" usuli) — JPEG allaqachon siqilgan, uni qayta siqish
   protsessor vaqtini yeydi, hajmni esa ~1% ham kamaytirmaydi.

   Siqish yo'qligining ikkinchi foydasi: arxivning aniq hajmini oldindan
   hisoblab, `content-length` qo'yish mumkin. Shunda brauzer haqiqiy
   ko'rsatkich va qolgan vaqtni ko'rsatadi — 300 MB lik albomni sekin
   internetda yuklab olayotgan odam uchun bu "qotib qoldimi yoki
   yuklanyaptimi" degan savolga javob.
   ========================================================================== */

const MAX_ENTRIES = 65535;            // ZIP64'siz chegara
const MAX_TOTAL   = 3.5 * 1024 ** 3;  // 4 GB chegarasidan xavfsiz masofa

/* --- CRC32 --------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* --- Kichik yordamchilar ------------------------------------------------- */

function dosDateTime(date) {
  const y = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((y - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

class Writer {
  constructor(size) {
    this.buf = new Uint8Array(size);
    this.view = new DataView(this.buf.buffer);
    this.at = 0;
  }
  u16(v) { this.view.setUint16(this.at, v, true); this.at += 2; return this; }
  u32(v) { this.view.setUint32(this.at, v >>> 0, true); this.at += 4; return this; }
  raw(bytes) { this.buf.set(bytes, this.at); this.at += bytes.length; return this; }
  done() { return this.buf; }
}

/* --- Yo'l ---------------------------------------------------------------- */

export async function zipAlbum(request, env, id) {
  const meta = await readEvent(env.PHOTOS, id);
  if (!meta) return err('Albom topilmadi', 404);

  const key = new URL(request.url).searchParams.get('k') || '';
  if (key !== meta.manageKey) return err('Ruxsat yo\'q', 403);

  const photos = await listPhotos(env.PHOTOS, meta.id, { withType: true });
  if (!photos.length) return err('Albom bo\'sh', 404);
  if (photos.length > MAX_ENTRIES) return err('Albom juda katta', 413);

  // Eng eskisidan boshlab — arxivda tadbir tartibida tursin.
  const ordered = photos.slice().reverse();
  const encoder = new TextEncoder();
  const stamp = dosDateTime(new Date(meta.date + 'T12:00:00Z'));

  // Nom va hajm oldindan ma'lum (R2 ro'yxati ikkalasini ham beradi), siqish
  // esa yo'q — demak arxivning baytdagi uzunligi aniq hisoblanadi.
  const entries = ordered.map((p, i) => ({
    ...p,
    name: encoder.encode(`${String(i + 1).padStart(4, '0')}.${extForType(p.type)}`),
  }));

  let dataTotal = 0, zipSize = 22; // 22 = EOCD
  for (const e of entries) {
    dataTotal += e.size;
    zipSize += 30 + e.name.length + e.size   // lokal sarlavha + fayl
             + 46 + e.name.length;           // markaziy katalog yozuvi
  }
  if (dataTotal > MAX_TOTAL || zipSize > 0xffffffff) {
    return err('Albom juda katta', 413);
  }

  // Oddiy ReadableStream bilan Workers javobni `chunked` qilib yuboradi va
  // qo'yilgan `content-length` ni tashlab yuboradi. `FixedLengthStream`
  // uzunlikni oldindan e'lon qiladi — brauzer ko'rsatkichi shundan chiqadi.
  // Qo'shimcha foyda: va'da qilingandan kam yoki ko'p bayt yozilsa, ish
  // vaqti oqimni xatoga chiqaradi, ya'ni jim buzilgan arxiv chiqmaydi.
  const { readable, writable } = new FixedLengthStream(zipSize);
  const writer = writable.getWriter();

  (async () => {
      const central = [];
      let offset = 0;
      let total = 0;

      try {
        for (const entry of entries) {
          const object = await env.PHOTOS.get(fullKey(meta.id, entry.id));

          // `content-length` va'da qilingani uchun endi rasmni "o'tkazib
          // yuborish" mumkin emas: arxiv va'da qilingan uzunlikdan qisqa
          // chiqadi va brauzer buzuq fayl saqlaydi. Ochiq uzilish — jim
          // buzilgan arxivdan yaxshiroq.
          if (!object) throw new Error(`Rasm yo'q: ${entry.id}`);

          const bytes = new Uint8Array(await object.arrayBuffer());
          if (bytes.length !== entry.size) {
            throw new Error(`Rasm hajmi mos kelmadi: ${entry.id}`);
          }
          total += bytes.length;

          const name = entry.name;
          const crc = crc32(bytes);

          const header = new Writer(30 + name.length)
            .u32(0x04034b50)   // local file header signature
            .u16(20)           // version needed
            .u16(0x0800)       // flag: nom UTF-8'da
            .u16(0)            // method: store
            .u16(stamp.time).u16(stamp.date)
            .u32(crc)
            .u32(bytes.length) // compressed
            .u32(bytes.length) // uncompressed
            .u16(name.length).u16(0)
            .raw(name)
            .done();

          await writer.write(header);
          await writer.write(bytes);

          central.push({ name, crc, size: bytes.length, offset });
          offset += header.length + bytes.length;
        }

        // Markaziy katalog
        const cdStart = offset;
        for (const e of central) {
          const rec = new Writer(46 + e.name.length)
            .u32(0x02014b50)   // central file header signature
            .u16(20).u16(20)
            .u16(0x0800).u16(0)
            .u16(stamp.time).u16(stamp.date)
            .u32(e.crc)
            .u32(e.size).u32(e.size)
            .u16(e.name.length).u16(0).u16(0)
            .u16(0).u16(0).u32(0)
            .u32(e.offset)
            .raw(e.name)
            .done();
          await writer.write(rec);
          offset += rec.length;
        }

        const eocd = new Writer(22)
          .u32(0x06054b50)
          .u16(0).u16(0)
          .u16(central.length).u16(central.length)
          .u32(offset - cdStart)
          .u32(cdStart)
          .u16(0)
          .done();
        await writer.write(eocd);
        await writer.close();
      } catch (e) {
        console.error('ZIP yasashda xatolik:', meta.id, e);
        await writer.abort(e);
      }
  })();

  const filename = `${safeFilename(meta.title)}-${meta.date}.zip`;
  return new Response(readable, {
    headers: {
      'content-type': 'application/zip',
      'content-length': String(zipSize),
      'content-disposition': `attachment; filename="albom.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}
