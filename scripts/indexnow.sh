#!/usr/bin/env bash
# ==========================================================================
# IndexNow — Bing va Yandex'ga "sahifa o'zgardi" deb darhol xabar beradi.
#
# Google IndexNow'ni qo'llab-quvvatlamaydi (u sitemap va crawl'ga tayanadi),
# lekin O'zbekistonda Yandex ulushi katta, shuning uchun bu Google'dan kam
# ahamiyatli emas.
#
#   ./scripts/indexnow.sh                  → sitemap'dagi hamma manzil
#   ./scripts/indexnow.sh /aloqa/ /        → faqat ko'rsatilganlari
#
# Kalit fayli saytda turishi shart: /aadbf93700f7c63be3658b7dcb7dd34a.txt
# ==========================================================================
set -euo pipefail

HOST="tadam.uz"
KEY="aadbf93700f7c63be3658b7dcb7dd34a"

if [ $# -gt 0 ]; then
  URLS=()
  for p in "$@"; do URLS+=("https://${HOST}${p}"); done
else
  # Manzillarni sitemap'ning o'zidan olamiz — ro'yxatni ikki joyda
  # saqlash kerak emas, sitemap yagona haqiqat manbai bo'lib qoladi.
  # `mapfile` macOS'dagi bash 3.2 da yo'q — oddiy o'qish halqasi bilan.
  URLS=()
  while IFS= read -r u; do [ -n "$u" ] && URLS+=("$u"); done < <(
    curl -fsS "https://${HOST}/sitemap.xml" \
      | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g')
fi

[ ${#URLS[@]} -gt 0 ] || { echo "Manzil topilmadi" >&2; exit 1; }

echo "IndexNow'ga yuborilmoqda (${#URLS[@]} ta manzil):"
printf '  %s\n' "${URLS[@]}"

BODY=$(python3 - "$HOST" "$KEY" "${URLS[@]}" <<'PY'
import json, sys
host, key, *urls = sys.argv[1:]
print(json.dumps({
    "host": host,
    "key": key,
    "keyLocation": f"https://{host}/{key}.txt",
    "urlList": urls,
}))
PY
)

CODE=$(curl -sS -o /tmp/indexnow-javob.txt -w '%{http_code}' \
  -X POST 'https://api.indexnow.org/indexnow' \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data "$BODY")

echo "Javob: $CODE"
# 200 = qabul qilindi, 202 = qabul qilindi lekin kalit hali tekshirilmoqda
case "$CODE" in
  200|202) echo "Yuborildi." ;;
  *) echo "Xatolik:"; cat /tmp/indexnow-javob.txt; exit 1 ;;
esac
