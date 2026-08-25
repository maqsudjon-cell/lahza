#!/usr/bin/env bash
# Domen ulangach bir marta ishga tushiriladi:
#   ./scripts/domen.sh https://chaqnoq.uz
#
# Sahifalardagi MUTLAQ manzillarni yangilaydi (canonical, og:url, og:image,
# twitter:image, JSON-LD). Faqat to'liq `https://host` shaklini almashtiradi —
# brend nomini yoki matnni o'zgartirmaydi.
set -euo pipefail
[ $# -eq 1 ] || { echo "Foydalanish: $0 https://yangi-domen"; exit 1; }
YANGI="${1%/}"
cd "$(dirname "$0")/.."

ESKI=$(grep -ho 'https://[a-z0-9.-]*\(workers\.dev\|\.uz\)' public/index.html | head -1)
[ -n "$ESKI" ] || { echo "Eski manzil topilmadi"; exit 1; }
echo "  $ESKI  →  $YANGI"
echo

for f in $(grep -rl "$ESKI" public/ matn/ 2>/dev/null); do
  perl -pi -e "s|\Q$ESKI\E|$YANGI|g" "$f"
  echo "    $f"
done

echo
echo "  Tekshiruv — qolgan manzillar:"
grep -rho 'https://[a-z0-9.-]*\(workers\.dev\|\.uz\)' public/ | sort -u | sed 's/^/    /'
echo
echo "  Tayyor. Endi: git add -A && git commit -m 'domen' && git push"
