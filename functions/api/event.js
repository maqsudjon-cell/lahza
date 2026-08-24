import {
  json, err, newEventId, newManageKey, metaKey,
  cleanTitle, cleanDate, RETENTION_DAYS,
} from '../../lib/store.js';

/** POST /api/event — yangi albom yaratadi. */
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return err('Ma\'lumot noto\'g\'ri yuborildi');
  }

  const title = cleanTitle(body.title);
  const date  = cleanDate(body.date);

  if (title.length < 2) return err('Tadbir nomini kiriting');
  if (!date)            return err('Sanani tanlang');

  const id        = newEventId();
  const manageKey = newManageKey();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 86400000);

  const meta = {
    id,
    title,
    date,
    manageKey,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await env.PHOTOS.put(metaKey(id), JSON.stringify(meta), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  return json({ id, manageKey, title, date, expiresAt: meta.expiresAt }, 201);
}
