#!/usr/bin/env bash

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
ROLE="${ROLE:-ADMIN}"

EMAIL="${1:-}"
PASSWORD="${2:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Kullanim:"
  echo "  ./scripts/createAdmin.sh <email> <password>"
  echo
  echo "Opsiyonel env:"
  echo "  API_URL=http://localhost:3000"
  echo "  ROLE=ADMIN|SUPER_ADMIN|SUPPORT (varsayilan: ADMIN)"
  exit 1
fi

if [[ ${#PASSWORD} -lt 8 ]]; then
  echo "Hata: sifre en az 8 karakter olmali."
  exit 1
fi

payload="$(printf '{"email":"%s","password":"%s","role":"%s"}' "$EMAIL" "$PASSWORD" "$ROLE")"

response_with_code="$(
  curl -sS -X POST "${API_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    -w $'\n%{http_code}'
)"

http_code="$(printf '%s\n' "$response_with_code" | awk 'END{print $0}')"
response_body="$(printf '%s\n' "$response_with_code" | sed '$d')"

if [[ "$http_code" == "201" || "$http_code" == "200" ]]; then
  echo "Admin olusturuldu:"
  echo "$response_body"
  exit 0
fi

echo "Admin olusturma basarisiz (HTTP $http_code):"
echo "$response_body"
exit 1
