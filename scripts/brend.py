#!/usr/bin/env python3
"""
Brendni to'liq almashtirish: nom + domen + brauzerdagi kalitlar.

    ./scripts/brend.py            faqat ko'rsatadi, hech narsa yozmaydi
    ./scripts/brend.py --yoz      o'zgartiradi

`domen.sh` faqat mutlaq manzillarni almashtiradi. Bu skript brendning HAMMA
ko'rinishini oladi va har birini ALOHIDA qoida bilan almashtiradi.

Nega alohida qoidalar? Oldin bir marta `lahza.` -> `pufak.` deb ko'r-ko'rona
almashtirilgan va u `workers.dev` host nomini ham buzgan: canonical, og:image
va JSON-LD mavjud bo'lmagan manzilga ishora qilib qolgan, Telegram oldindan
ko'rishi ishlamagan. Shuning uchun bu yerda hech qachon `chaqnoq.` kabi
umumiy naqsh ishlatilmaydi — har bir qoida o'z kontekstini biladi.
"""
import re
import subprocess
import sys
from pathlib import Path

ESKI_NOM, YANGI_NOM = "Chaqnoq", "Tadam"
ESKI_DOMEN, YANGI_DOMEN = "chaqnoq.uz", "tadam.uz"
ESKI_KOD, YANGI_KOD = "chaqnoq", "tadam"        # GoatCounter va localStorage

ROOT = Path(__file__).resolve().parent.parent

# Tartib muhim: aniqroq qoida umumiyroqdan OLDIN turishi kerak.
QOIDALAR = [
    ("Manzillar", [
        (f"https://{re.escape(ESKI_DOMEN)}", f"https://{YANGI_DOMEN}",
         f"https://{ESKI_DOMEN} -> https://{YANGI_DOMEN}"),
        # Matn ichidagi domen: oldida `/` yoki `.` bo'lmasligi kerak,
        # aks holda yuqoridagi qoida tegib bo'lgan manzilga ikkinchi marta
        # tegib ketadi.
        (rf"(?<![/.\w]){re.escape(ESKI_DOMEN)}", YANGI_DOMEN,
         f"matndagi {ESKI_DOMEN} -> {YANGI_DOMEN}"),
    ]),
    ("GoatCounter — yangi sayt kodi ro'yxatdan o'tkazilishi shart", [
        (rf"{re.escape(ESKI_KOD)}\.goatcounter\.com", f"{YANGI_KOD}.goatcounter.com",
         f"{ESKI_KOD}.goatcounter.com -> {YANGI_KOD}.goatcounter.com"),
    ]),
    ("Brend nomi", [
        (rf"{re.escape(ESKI_NOM)}'ni", f"{YANGI_NOM}'ni", f"{ESKI_NOM}'ni -> {YANGI_NOM}'ni"),
        (re.escape(ESKI_NOM), YANGI_NOM, f"{ESKI_NOM} -> {YANGI_NOM}"),
    ]),
    ("Brauzerdagi kalitlar va yuklab olingan fayl nomi", [
        (rf"{re.escape(ESKI_KOD)}\.albums", f"{YANGI_KOD}.albums",
         f"{ESKI_KOD}.albums -> {YANGI_KOD}.albums"),
        (rf"{re.escape(ESKI_KOD)}\.del\.", f"{YANGI_KOD}.del.",
         f"{ESKI_KOD}.del. -> {YANGI_KOD}.del."),
        # Yuklab olingan surat nomi va sinovdagi vaqtinchalik papka nomi.
        (rf"{re.escape(ESKI_KOD)}-", f"{YANGI_KOD}-",
         f"{ESKI_KOD}- (fayl va papka nomi) -> {YANGI_KOD}-"),
    ]),
]


def fayllar():
    out = subprocess.run(
        ["grep", "-rl", "-i", ESKI_KOD, "public", "src", "lib", "scripts",
         "test", "wrangler.toml"],
        cwd=ROOT, capture_output=True, text=True).stdout.split()
    return [ROOT / f for f in out if not f.endswith("brend.py")]


def main():
    yoz = "--yoz" in sys.argv
    if not yoz:
        print("── QURUQ YURISH: hech narsa yozilmaydi (--yoz bilan yozadi) ──\n")

    fs = fayllar()
    if not fs:
        print("Almashtiriladigan narsa topilmadi.")
        return

    matn = {f: f.read_text() for f in fs}

    for bolim, qoidalar in QOIDALAR:
        print(bolim)
        for naqsh, urniga, izoh in qoidalar:
            jami = 0
            for f in fs:
                yangi, n = re.subn(naqsh, urniga, matn[f])
                if n:
                    jami += n
                    matn[f] = yangi
            print(f"  {izoh:<52} {jami:>3} ta")
        print()

    if yoz:
        for f in fs:
            f.write_text(matn[f])

        # Eski albomlar yo'qolmasligi kerak — kalit ro'yxatiga eskisini
        # qo'shamiz. Brend uch marta o'zgargan, ro'yxat shuning uchun uzun.
        b = ROOT / "public/boshqarish/index.html"
        s = b.read_text()
        if f"'{ESKI_KOD}.albums'" not in s:
            s = s.replace("const ESKI_KALITLAR = [",
                          f"const ESKI_KALITLAR = ['{ESKI_KOD}.albums', ", 1)
            b.write_text(s)
            print(f"ESKI_KALITLAR ro'yxatiga '{ESKI_KOD}.albums' qo'shildi\n")

    print("Qo'lda tekshirilishi kerak")
    for fayl, naqsh in [("wrangler.toml", r'PRIMARY_HOST\s*='),
                        ("scripts/indexnow.sh", r'^HOST='),
                        ("scripts/og.sh", r'^BRAND=')]:
        p = ROOT / fayl
        if not p.exists():
            continue
        for i, qator in enumerate(p.read_text().splitlines(), 1):
            if re.search(naqsh, qator):
                print(f"  {fayl}:{i}  {qator.strip()[:72]}")

    qolgan = re.findall(r"[\w.@/-]*chaqnoq[\w.@/'-]*",
                        "\n".join(matn.values()), re.I)
    print(f"\nQolgan 'chaqnoq' izlari: {len(qolgan)} ta")
    for iz in sorted(set(qolgan)):
        print(f"  {qolgan.count(iz):>3}  {iz}")

    print()
    if yoz:
        print("Yozildi. Endi:\n"
              "  1. wrangler.toml -> PRIMARY_HOST\n"
              "  2. scripts/indexnow.sh -> faqat HOST (kalit fayli o'zgarmaydi:\n"
              "     uni Worker istalgan domen uchun beradi)\n"
              "  3. scripts/og.sh -> BRAND, keyin ./scripts/og.sh\n"
              "  4. lib/headers.js -> CSP dagi goatcounter manzili\n"
              "  5. npm test")
    else:
        print("Yozish uchun: ./scripts/brend.py --yoz")


if __name__ == "__main__":
    main()
