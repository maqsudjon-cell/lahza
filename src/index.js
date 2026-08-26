/* ==========================================================================
   Chaqnoq — Worker kirish nuqtasi.

   `run_worker_first` yoqilgani uchun har bir so'rov shu yerdan o'tadi:
   avval domen tekshiriladi, keyin API va rasm yo'llari, oxirida statik
   fayl `env.ASSETS.fetch()` orqali beriladi.
   ========================================================================== */

import { err } from '../lib/store.js';
import { harden, isHtml } from '../lib/headers.js';
import { createEvent, getEvent } from './routes/event.js';
import { listPhotos } from './routes/photos.js';
import { uploadPhoto } from './routes/upload.js';
import { zipAlbum } from './routes/zip.js';
import { qrSvg } from './routes/qr.js';
import { deletePhoto } from './routes/photo.js';
import { serveFile } from './routes/file.js';
import { robots, sitemap, indexNowKey } from './routes/seo.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Xavfsizlik sarlavhalari bitta joyda qo'yiladi. Har bir yo'lda alohida
    // yozilsa, yangi yo'l qo'shilganda unutiladi — shuning uchun tashqarida.
    const response = await route(request, env, url);
    if (url.pathname.startsWith('/f/')) return harden(response, { userContent: true });
    return harden(response, { html: isHtml(response) });
  },
};

async function route(request, env, url) {
  const seg = url.pathname.split('/').filter(Boolean);
  const method = request.method;

  // Asosiy domen belgilangan bo'lsa, boshqa manzillar o'shanga yo'naltiriladi.
  // Usiz Google bitta saytni ikki manzilda ko'radi (workers.dev va o'z
  // domeni) va reyting ikkiga bo'linadi.
  const primary = env.PRIMARY_HOST;
  if (primary && url.hostname !== primary && !url.hostname.endsWith('.localhost')
      && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    const target = new URL(request.url);
    target.hostname = primary;
    target.protocol = 'https:';
    target.port = '';
    return Response.redirect(target.toString(), 301);
  }

  try {
    if (url.pathname === '/robots.txt')  return robots(request);
    if (url.pathname === '/sitemap.xml') return sitemap(request);
    // IndexNow kaliti — Bing va Yandex shu faylni tekshiradi
    if (url.pathname === '/aadbf93700f7c63be3658b7dcb7dd34a.txt') return indexNowKey();

    // /f/{eventId}/{p|t}/{photoId}
    if (seg[0] === 'f' && seg.length === 4) {
      if (method !== 'GET' && method !== 'HEAD') return err('Faqat GET', 405);
      return await serveFile(request, env, {
        eventId: seg[1], kind: seg[2], photoId: seg[3],
      });
    }

    if (seg[0] === 'api') {
      const [, resource, id] = seg;

      if (resource === 'event' && seg.length === 2 && method === 'POST') {
        return await createEvent(request, env);
      }
      if (resource === 'event' && seg.length === 3 && method === 'GET') {
        return await getEvent(request, env, id);
      }
      if (resource === 'photos' && seg.length === 3 && method === 'GET') {
        return await listPhotos(request, env, id);
      }
      if (resource === 'upload' && seg.length === 3 && method === 'POST') {
        return await uploadPhoto(request, env, id);
      }
      if (resource === 'zip' && seg.length === 3 && method === 'GET') {
        return await zipAlbum(request, env, id);
      }
      if (resource === 'qr' && seg.length === 3 && method === 'GET') {
        return await qrSvg(request, env, id);
      }
      // /api/photo/{eventId}/{photoId}
      if (resource === 'photo' && seg.length === 4 && method === 'DELETE') {
        return await deletePhoto(request, env, seg[2], seg[3]);
      }
      return err('Bunday manzil yo\'q', 404);
    }

    // Statik faylga ham, API'ga ham tushmadi.
    return env.ASSETS
      ? env.ASSETS.fetch(request)
      : new Response('Topilmadi', { status: 404 });
  } catch (e) {
    console.error('So\'rovda xatolik:', url.pathname, e);
    return err('Serverda xatolik', 500);
  }
}
