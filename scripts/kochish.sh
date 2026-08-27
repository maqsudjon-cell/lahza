#!/usr/bin/env bash
# ==========================================================================
# chaqnoq.uz -> tadam.uz ko'chishini yakunlaydi.
#
#   ./scripts/kochish.sh
#
# FAQAT delegatsiya kelgach ishlaydi. Tekshiruvsiz ishga tushirilsa jonli
# sayt o'lik domenga 301 qilib yiqilardi — shuning uchun birinchi ish
# delegatsiyani tekshirish.
#
# chaqnoq.uz O'CHIRILMAYDI: Worker'dagi PRIMARY_HOST mantig'i uni
# avtomatik yangi domenga yo'naltiradi, shu sababli chop etilgan QR
# kodlar va tarqatilgan havolalar ishlashda davom etadi.
# ==========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ESKI="chaqnoq.uz"
YANGI="tadam.uz"

echo "1. Delegatsiya tekshirilmoqda…"
NS=$(dig +short NS "$YANGI" | tr '\n' ' ')
if [ -z "$NS" ]; then
  echo "   TO'XTATILDI: $YANGI hali delegatsiya qilinmagan." >&2
  echo "   .uz registri zonani chiqarmagan. Keyinroq qayta urining." >&2
  exit 1
fi
case "$NS" in
  *cloudflare*) echo "   OK: $NS" ;;
  *) echo "   TO'XTATILDI: NS Cloudflare emas — $NS" >&2; exit 1 ;;
esac

echo "2. Yangi domen javob beryaptimi…"
KOD=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "https://$YANGI/" || echo 000)
if [ "$KOD" != "200" ]; then
  echo "   TO'XTATILDI: https://$YANGI -> $KOD" >&2
  echo "   Avval Cloudflare'da Worker'ga Custom Domain qo'shing." >&2
  exit 1
fi
echo "   OK: 200"

echo "3. Manzillar ko'chirilmoqda…"
./scripts/domen.sh "https://$YANGI" | sed 's/^/   /'

echo "4. Sozlamalar…"
perl -pi -e "s/PRIMARY_HOST = \"\Q$ESKI\E\"/PRIMARY_HOST = \"$YANGI\"/" wrangler.toml
perl -pi -e "s/^HOST=\"\Q$ESKI\E\"/HOST=\"$YANGI\"/" scripts/indexnow.sh
echo "   wrangler.toml: $(grep -m1 PRIMARY_HOST wrangler.toml)"
echo "   indexnow.sh:   $(grep -m1 '^HOST=' scripts/indexnow.sh)"

echo
echo "Tayyor. Qolgani qo'lda:"
echo "  · GoatCounter'da 'tadam' sayt kodini oching, keyin:"
echo "      grep -rl 'chaqnoq.goatcounter' public lib | xargs perl -pi -e 's/chaqnoq\\.goatcounter/tadam.goatcounter/g'"
echo "  · npm test"
echo "  · git add -A && git commit && git push"
echo "  · Search Console'da $YANGI domen mulkini qo'shing"
