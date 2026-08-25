#!/usr/bin/env bash
# Domen ulangach bir marta ishga tushiriladi:
#   ./scripts/domen.sh https://lahzam.uz
# Barcha sahifalardagi mutlaq manzillarni yangilaydi (og:image, canonical, JSON-LD).
set -euo pipefail
[ $# -eq 1 ] || { echo "Foydalanish: $0 https://yangi-domen"; exit 1; }
YANGI="${1%/}"
cd "$(dirname "$0")/.."
ESKI=$(grep -ho 'https://[a-z0-9.-]*\(workers\.dev\|lahzam\.uz\|[a-z]*\.uz\)' public/index.html | head -1)
[ -n "$ESKI" ] || { echo "Eski domen topilmadi"; exit 1; }
echo "  $ESKI  →  $YANGI"
grep -rl "$ESKI" public/ | while read -r f; do
  perl -pi -e "s|\Q$ESKI\E|$YANGI|g" "$f"
  echo "    $f"
done
echo "Tayyor. Endi: git add -A && git commit && git push"
