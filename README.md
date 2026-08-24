# Lahza

To'y va tadbir mehmonlarining suratlarini bitta QR kod orqali umumiy albomga
yig'adigan xizmat. Mehmon ilova o'rnatmaydi, ro'yxatdan o'tmaydi — kamerani
QR'ga tutadi va rasm qo'shadi.

---

## Ishga tushirish

Deploy **GitHub orqali** boradi: `main` ga push qilsangiz Cloudflare o'zi
qayta quradi. Terminaldan hech narsa qilish shart emas.

> **GitHub Pages'da ishlamaydi.** Rasm yuklash, ZIP va QR uchun server tomoni
> kerak. U Cloudflare **Worker**da turadi, statik sahifalar esa o'sha
> Worker'ning `[assets]` sozlamasidan beriladi — bitta loyiha, bitta deploy.

Quyidagilar Cloudflare panelida ([dash.cloudflare.com](https://dash.cloudflare.com))
bir marta bajariladi.

### 1. R2 bucket

**R2 → Create bucket**, nomi aynan: `lahza-photos`

(Nomni o'zgartirsangiz, `wrangler.toml` dagi `bucket_name` ni ham o'zgartiring.)

> R2 birinchi marta yoqilganda karta so'raydi. 10 GB saqlash va **cheksiz
> yuklab olish** bepul — pul yechilishi uchun shundan oshish kerak. Narxlarni
> yoqishdan oldin o'zingiz tasdiqlab oling.

### 2. Avtomatik o'chirish qoidasi

**Eng muhim qadam.** Usiz saqlash hajmi cheksiz o'sadi va hisob oyma-oy ko'payadi.

**R2 → lahza-photos → Settings → Object lifecycle rules → Add rule**

| Maydon | Qiymat |
|---|---|
| Rule name | `60-kun` |
| Prefix | `e/` |
| Action | Delete objects |
| After | `60` days from upload |

Bu son `lib/store.js` dagi `RETENTION_DAYS` bilan bir xil bo'lishi shart.

### 3. Repoga ulash

**Workers & Pages → Create → Workers → Connect to Git**
→ `maqsudjon-cell/lahza`

| Sozlama | Qiymat |
|---|---|
| Build command | (bo'sh) |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

Boshqa hech narsa kiritish shart emas: `wrangler.toml` da kirish nuqtasi
(`src/index.js`), statik papka (`public`) va R2 ulanishi (`PHOTOS`) yozilgan.

### 4. Tekshirish

`<loyiha>.pages.dev` ochiladi. Albom yarating, telefondan QR'ni skanerlab
rasm qo'shing, keyin ZIP'ni yuklab oling.

Domen keyin ulanadi: **Custom domains → Set up a domain**.

---

## Lokal ishlash (ixtiyoriy)

```bash
npm install
npx wrangler dev                    # localhost:8787
npx wrangler dev --ip 0.0.0.0       # telefondan sinash uchun
```

R2 lokal rejimda `.wrangler/` papkasiga yozadi, haqiqiy bucket'ga tegmaydi.

---

## Tuzilma

```
public/                 statik sahifalar ([assets] orqali beriladi)
  index.html            bosh sahifa (SEO)
  yaratish/             albom yaratish
  e/                    mehmon sahifasi — yuklash va galereya
  boshqarish/           kelin-kuyov paneli: havola, QR, ZIP
  qr/                   chop etiladigan A5 QR varaqasi
  assets/
    base.css            dizayn tizimi (ranglar, tipografika, komponentlar)
    compress.js         rasm quvuri — brauzerda siqish
src/
  index.js              Worker kirish nuqtasi va yo'naltirish
  routes/
    event.js            POST /api/event · GET /api/event/:id
    photos.js           GET  /api/photos/:id
    upload.js           POST /api/upload/:id
    zip.js              GET  /api/zip/:id   (kalit talab qiladi)
    qr.js               GET  /api/qr/:id
    file.js             GET  /f/:albom/:tur/:rasm
lib/store.js            umumiy backend mantiq
```

Statik faylga mos kelgan so'rov Worker'gacha yetib bormaydi — bosh sahifa va
galereya CDN tezligida ochiladi, Worker faqat API uchun uyg'onadi.

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
- Workers'ga o'tkazilgach barcha yo'llar qayta sinovdan o'tkazildi

## Hali qilinmagan

- To'lov (hozircha albom yaratish bepul)
- Rasmni o'chirish / shikoyat qilish tugmasi
- Yuklash tezligini cheklash (bitta IP'dan suiiste'mol qilishga qarshi)
- Sitemap va `robots.txt`
