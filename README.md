# Lahza

To'y va tadbir mehmonlarining suratlarini bitta QR kod orqali umumiy albomga
yig'adigan xizmat. Mehmon ilova o'rnatmaydi, ro'yxatdan o'tmaydi — kamerani
QR'ga tutadi va rasm qo'shadi.

---

## Ishga tushirish (bir martalik, ~10 daqiqa)

### 1. Cloudflare akkaunti

[dash.cloudflare.com](https://dash.cloudflare.com) — bepul ro'yxatdan o'ting.

### 2. R2 bucket yarating

Panelda **R2 → Create bucket**, nomi: `lahza-photos`.

> R2 birinchi marta yoqilganda karta ma'lumotini so'raydi, lekin 10 GB saqlash
> va yuklab olish (egress) **bepul** — pul yechilishi uchun shu limitdan oshish
> kerak. Narxlarni yoqishdan oldin o'zingiz tasdiqlab oling: narxlar o'zgarishi
> mumkin.

### 3. Avtomatik o'chirish qoidasini qo'ying

Bu **eng muhim qadam** — usiz saqlash hajmi cheksiz o'sadi va xarajat oyma-oy
ko'payadi.

Bucket → **Settings → Object lifecycle rules → Add rule**:

| Maydon | Qiymat |
|---|---|
| Rule name | `60-kun` |
| Prefix | `e/` |
| Action | Delete objects |
| After | `60` days from upload |

Bu son `lib/store.js` dagi `RETENTION_DAYS` bilan bir xil bo'lishi shart.

### 4. Deploy

```bash
npx wrangler login
npx wrangler pages deploy public --project-name lahza
```

Birinchi deploydan keyin Cloudflare panelida:
**Workers & Pages → lahza → Settings → Bindings → Add → R2 bucket**
· Variable name: `PHOTOS` · Bucket: `lahza-photos`

Keyin domenni ulang: **Custom domains → Set up a domain**.

---

## Lokal ishlash

```bash
npm install
npx wrangler pages dev --port 8791
```

R2 lokal rejimda ishlaydi — fayllar `.wrangler/` papkasiga tushadi, haqiqiy
bucket'ga tegilmaydi.

---

## Tuzilma

```
public/                 statik sahifalar
  index.html            bosh sahifa (SEO)
  yaratish/             albom yaratish
  e/                    mehmon sahifasi — yuklash va galereya
  boshqarish/           kelin-kuyov paneli: havola, QR, ZIP
  qr/                   chop etiladigan A5 QR varaqasi
  assets/
    base.css            dizayn tizimi (ranglar, tipografika, komponentlar)
    compress.js         rasm quvuri — brauzerda siqish
functions/              Cloudflare Pages Functions (API)
  api/event.js          POST  albom yaratish
  api/event/[id].js     GET   albom ma'lumoti
  api/photos/[id].js    GET   rasmlar ro'yxati
  api/upload/[id].js    POST  rasm yuklash
  api/zip/[id].js       GET   butun albom ZIP holida (kalit talab qiladi)
  api/qr/[id].js        GET   QR kod, SVG
  f/[[path]].js         GET   R2'dan rasm berish
lib/store.js            umumiy backend mantiq
```

### R2'dagi kalitlar

```
e/{eventId}/meta.json      tadbir ma'lumoti (manageKey shu yerda)
e/{eventId}/p/{photoId}    to'liq rasm, uzun tomoni 1920px
e/{eventId}/t/{photoId}    eskiz, uzun tomoni 400px
```

Alohida ma'lumotlar bazasi yo'q — ro'yxat R2'ning `list()` chaqiruvidan olinadi.

---

## Muhim qarorlar va ularning sababi

**Siqish brauzerda, yuborishdan oldin.** To'yxonada internet sekin. 4000×3000
surat 1920px ga tushiriladi — o'lchovda bu ~4 ms chizish va ~73 ms kodlash
(ish stoli protsessorida), yuklanadigan hajm esa bir necha barobar kamayadi.

**Siqish navbat bilan, yuklash parallel.** Dekodlangan 12 MP surat xotirada
~48 MB egallaydi. Uchtasi bir vaqtda arzon telefonning brauzerini yopib
qo'yadi. Shuning uchun `withCpuLock` siqishni bittalab o'tkazadi, tarmoq
qismi esa uchta oqimda ketadi.

**Eskiz to'liq rasmdan chiziladi, asl fayldan emas.** 1920px kanvasdan 400px
ga tushirish o'lchovda ~0 ms, asl 4000px dan esa ~3 ms — va katta bitmap
tezroq bo'shatiladi.

**Saqlash vaqtinchalik (60 kun).** Bir martalik daromadga doimiy xarajat
qo'shilmasligi uchun. Bu sahifalarda ochiq yozilgan, yashirilmagan.

**ZIP siqilmaydi ("store" usuli).** JPEG allaqachon siqilgan — qayta siqish
protsessor vaqtini yeydi, hajmni esa deyarli kamaytirmaydi.

**Lightbox tartibi DOM'dan olinadi.** Rasmlar parallel yuklangani uchun
tugash tartibi ekrandagi tartibga mos kelmaydi.

---

## Sinovdan o'tgani

- Albom yaratish, meta o'qish, rasmlar ro'yxati
- Rasm yuklash (to'liq + eskiz), R2'dan berish, 404
- ZIP: `unzip -t` CRC tekshiruvidan o'tdi; noto'g'ri kalitda 403
- QR: `cv2.QRCodeDetector` bilan dekodlanib, to'g'ri havola chiqdi
- Brauzer quvuri: 4032×3024 → 1920×1440, yuklash 201

## Hali qilinmagan

- To'lov (hozircha albom yaratish bepul)
- Rasmni o'chirish / shikoyat qilish tugmasi
- Yuklash tezligini cheklash (bitta IP'dan suiiste'mol qilishga qarshi)
- Sitemap va `robots.txt`
