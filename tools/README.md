# tools/

Bu papka **saytga chiqmaydi** — faqat rasm tayyorlash uchun.
Wrangler faqat `public/` ichidagi fayllarni tarqatadi.

## og-src.jpg

`og:image` uchun manba surat — Wikimedia Commons'dagi
[Kelinsalom.jpg](https://commons.wikimedia.org/wiki/File:Kelinsalom.jpg),
muallif **Sinchalak Musulmon**, litsenziya **CC BY-SA 4.0**.
Muallif nomi saytning `/manbalar/` sahifasida ko'rsatilgan.

## fonts/

Inter — [SIL Open Font License 1.1](fonts/LICENSE.txt).
Saytda Google Fonts orqali yuklanadi; bu yerdagi TTF nusxalari
faqat `scripts/og.sh` rasm yasashda ishlatadi.

## Rasmni qayta yasash

```
./scripts/og.sh
```

Brend nomi yoki sarlavha o'zgarsa — `scripts/og.sh` boshidagi
`BRAND`, `LINE1`, `LINE2`, `FOOT` qatorlarini tahrirlab qayta ishga tushiring.
