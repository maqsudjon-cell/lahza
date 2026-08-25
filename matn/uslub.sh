#!/usr/bin/env bash
# Bosh sahifa matn uslubini almashtirish:
#   ./matn/uslub.sh oddiy   — tinch, tushuntiruvchi uslub
#   ./matn/uslub.sh saul    — to'g'ridan-to'g'ri, reklama uslubi
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  oddiy) cp matn/index.oddiy.html public/index.html; echo "→ oddiy uslub tiklandi";;
  saul)  cp matn/index.saul.html  public/index.html; echo "→ Saul uslubi tiklandi";;
  *) echo "Foydalanish: $0 oddiy|saul"; exit 1;;
esac
echo "Endi: git add -A && git commit -m 'matn uslubi' && git push"
