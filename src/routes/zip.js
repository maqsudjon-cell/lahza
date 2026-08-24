import { err, readEvent, listPhotos, fullKey, safeFilename } from '../../lib/store.js';

/* ==========================================================================
   GET /api/zip/:id?k=manageKey
   Butun albomni bitta ZIP qilib beradi.

   ZIP oqim bilan yasaladi: har bir rasm R2'dan olinadi, arxivga yoziladi va
   xotiradan chiqariladi. Shuning uchun 500 ta rasmli albom ham Worker'ning
   xotira chegarasiga urilmaydi.

   Siqish yo'q ("store" usuli) — JPEG allaqachon siqilgan, uni qayta siqish
   protsessor vaqtini yeydi, hajmni esa ~1% ham kamaytirmaydi.
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

  const photos = await listPhotos(env.PHOTOS, meta.id);
  if (!photos.length) return err('Albom bo\'sh', 404);
  if (photos.length > MAX_ENTRIES) return err('Albom juda katta', 413);

  // Eng eskisidan boshlab — arxivda tadbir tartibida tursin.
  const ordered = photos.slice().reverse();
  const encoder = new TextEncoder();
  const stamp = dosDateTime(new Date(meta.date + 'T12:00:00Z'));

  const stream = new ReadableStream({
    async start(controller) {
      const central = [];
      let offset = 0;
      let total = 0;

      try {
        for (let i = 0; i < ordered.length; i++) {
          const object = await env.PHOTOS.get(fullKey(meta.id, ordered[i].id));
          if (!object) continue; // muddati o'tib o'chirilgan bo'lishi mumkin

          const bytes = new Uint8Array(await object.arrayBuffer());
          total += bytes.length;
          if (total > MAX_TOTAL) throw new Error('ZIP hajmi chegaradan oshdi');

          const name = encoder.encode(`${String(i + 1).padStart(4, '0')}.jpg`);
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

          controller.enqueue(header);
          controller.enqueue(bytes);

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
          controller.enqueue(rec);
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
        controller.enqueue(eocd);
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const filename = `${safeFilename(meta.title)}-${meta.date}.zip`;
  return new Response(stream, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="albom.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}
