# Rasmlar manbasi

Saytdagi barcha to'y suratlari **Wikimedia Commons** dan olingan —
haqiqiy O'zbekiston to'ylarida tushirilgan va erkin litsenziya ostida
tarqatilgan.

Mualliflar va litsenziyalar to'liq ro'yxati saytning
**/manbalar/** sahifasida ko'rsatilgan. CC BY va CC BY-SA litsenziyalari
muallifni ko'rsatishni **majburiy** qiladi — o'sha sahifani o'chirmang.

## Nima uchun stok suratlar emas

Avval Pexels'dan G'arb/Osiyo to'ylarining suratlari ishlatilgan edi.
Ikkita muammo chiqdi:

1. **O'zbek to'yiga o'xshamasdi.** Kelin-kuyov saytga kirib, o'z to'yini
   ko'rmasdi — bu ishonchni yo'qotadi.
2. **Bir qismi sun'iy intellekt yaratgani ma'lum bo'ldi.** Pexels'da
   bunday suratlar ko'paygan.

Endi barcha rasmlar — karnay-surnay, bezatilgan to'y mashinasi, milliy
kelin libosi, dasturxan, to'yxona — haqiqiy O'zbekiston to'ylaridan.

## Sun'iy emasligini QANDAY TEKSHIRISH (eng ishonchli yo'l)

Ko'z bilan taxmin qilmang — **EXIF** ma'lumotini so'rang. Commons asl
fayl bilan birga kamera ma'lumotini ham saqlaydi:

```
curl -s -G "https://commons.wikimedia.org/w/api.php" \
  --data-urlencode "titles=File:Kelinsalom.jpg" \
  -d "action=query&format=json&prop=imageinfo&iiprop=size|metadata"
```

Javobda `Make`, `Model`, `ExposureTime`, `ISOSpeedRatings`,
`DateTimeOriginal` bo'lsa — bu **haqiqiy fotoapparatdan olingan surat**.
Sun'iy intellekt bunday ma'lumotni yaratmaydi.

**Diqqat:** Wikimedia'ning kichraytirilgan nusxalarida (`thumburl`)
EXIF o'chirilgan bo'ladi. Shuning uchun EXIF'ni **API orqali**, asl fayl
uchun so'rash kerak — yuklab olingan nusxadan qaralmaydi.

Shubhali belgilar: kamera ma'lumoti umuman yo'q · o'lcham aniq dumaloq
son (1024x1024, 1920x1080) · PNG formatida "surat" · yuklovchi juda
yangi va faqat shunday fayllar joylagan.

Saytdagi barcha suratlar shu usulda tekshirilgan (2026-08-25):
NIKON D780, NIKON D3300, Canon EOS 5D Mark II va III. Bittasi —
`Uzbek Bukhara Wedding` — EPSON skaneridan o'tgan bosma surat
(shuning uchun sifati past). Karnay surati (`band`) 2012-yilgi Flickr
yuklamasi: EXIF yo'q, lekin sana rasm generatorlari paydo bo'lishidan
o'n yil oldin.

Ishlatilmagan, shubhali topilganlar: `AIDEPCUL` yuklagan `Kelin salom*.png`
va `Wedding Portrait in Old Khiva.png` — kamera ma'lumoti yo'q, PNG,
aniq 1920x1080. Olinmadi.

## Sun'iy rasmni qanday ajratish (ko'z bilan)

Shubhali belgilar: teri juda silliq · yuzlar simmetrik · qo'llarda
barmoqlar noto'g'ri · olomondagi yuzlar loyqa yoki bir xil · hamma
joyda tushdek yumshoq yorug'lik · fon detallari mantiqsiz.

Haqiqiy suratda: kadr nomukammal · tabiiy harakat va shovqin ·
fonda mantiqiy narsalar (stol, ovqat, telefon ekrani, chiroq) ·
odamlar turli yoshda va turlicha kiyingan.

## Google qidiruvidan rasm OLINMAYDI

U yerdagi suratlar fotograflar, oilalar va nashrlarning mulki
(Instagram, YouTube, Gazeta.uz, Xabar.uz). Tijorat saytida ruxsatsiz
ishlatish — huquqbuzarlik.

Kelajakda eng kuchli variant: haqiqiy mijozning to'y suratlari,
kelin-kuyovdan **yozma ruxsat** olingan holda.
