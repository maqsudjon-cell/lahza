#!/usr/bin/env bash
# ==========================================================================
# Ijtimoiy tarmoq uchun ko'rinish rasmi (og:image) — 1200x630.
#
# Telegram'da havola ulashilganda ko'rinadigan yagona rasm shu bo'lgani
# uchun u aniq va o'qilishi oson bo'lishi kerak.
#
# Rasm ikki barobar kattaroq yasalib, keyin kichraytiriladi — shrift
# chetlari shunda silliq chiqadi.
#
#   ./scripts/og.sh            → public/assets/img/og.jpg
#
# Brend nomi yoki sarlavha o'zgarsa, faqat quyidagi o'zgaruvchilarni
# tahrirlab, skriptni qayta ishga tushiring.
# ==========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BRAND="C H A Q N O Q"
LINE1="Suratlaringiz mehmonlarning"
LINE2="telefonida qolib ketmasin"
FOOT="Stolga bitta QR kod   ·   ilova o'rnatmasdan   ·   bepul"

SRC="${1:-tools/og-src.jpg}"      # manba surat (yuqori aniqlikda)
OUT="public/assets/img/og.jpg"
F_REG="tools/fonts/Inter-Regular.ttf"
F_SEM="tools/fonts/Inter-SemiBold.ttf"
F_BLD="tools/fonts/Inter-Bold.ttf"

[ -f "$SRC" ] || { echo "Manba topilmadi: $SRC" >&2; exit 1; }

W=2400; H=1260; CROP_Y=230   # ikki barobar o'lcham; CROP_Y — kesim balandligi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# 1. Fon — suratni kesib, o'lchamga solamiz
magick "$SRC" -resize "${W}x^" -gravity north -crop "${W}x${H}+0+${CROP_Y}" +repage "$TMP/bg.png"

# 2. Pastki qorayish — matn o'qilishi uchun (gradient egri chiziq bilan)
magick -size "${W}x832" gradient:black-white -evaluate pow 0.55 \
       -evaluate multiply 0.93 "$TMP/m_bot.png"
magick -size "${W}x832" xc:black "$TMP/m_bot.png" -alpha off \
       -compose CopyOpacity -composite "$TMP/bot.png"

# 3. Yuqori qorayish — brend nomi uchun
magick -size "${W}x380" gradient:white-black -evaluate multiply 0.72 "$TMP/m_top.png"
magick -size "${W}x380" xc:black "$TMP/m_top.png" -alpha off \
       -compose CopyOpacity -composite "$TMP/top.png"

magick "$TMP/bg.png" \
  "$TMP/top.png" -gravity north -composite \
  "$TMP/bot.png" -gravity south -composite "$TMP/base.png"

# 4. Matnlar
magick "$TMP/base.png" \
  -fill white -font "$F_SEM" -pointsize 42 -kerning 17 \
    -gravity northwest -annotate +132+104 "$BRAND" \
  -font "$F_BLD" -pointsize 120 -kerning -3 \
    -gravity southwest -annotate +132+330 "$LINE1" \
    -gravity southwest -annotate +132+196 "$LINE2" \
  -fill "rgba(255,255,255,0.86)" -font "$F_REG" -pointsize 46 -kerning 0 \
    -gravity southwest -annotate +132+96 "$FOOT" \
  "$TMP/full.png"

# 5. Yakuniy o'lcham va sifat (4:4:4 — oltin ranglarda dog' chiqmasligi uchun)
magick "$TMP/full.png" -resize 1200x630 -strip \
       -sampling-factor 4:4:4 -quality 90 "$OUT"

magick identify -format "%f — %wx%h, %b\n" "$OUT"
