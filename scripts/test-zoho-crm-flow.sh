#!/usr/bin/env bash
# Test Zoho flow: refresh_token → access_token → GET Lead
# Requires in .env: ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
# ZOHO_ACCOUNTS_URL, ZOHO_API_BASE

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env at $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

LEAD_ID="${1:-1126054000006691002}"

for var in ZOHO_REFRESH_TOKEN ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET ZOHO_ACCOUNTS_URL ZOHO_API_BASE; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: $var is not set in .env"
    echo ""
    echo "Zoho refresh requires refresh_token + client_id + client_secret."
    echo "See: https://www.zoho.com/crm/developer/docs/api/v8/refresh.html"
    exit 1
  fi
done

echo "=== Step 1: Refresh access token ==="
TOKEN_RESPONSE=$(curl -s -X POST "${ZOHO_ACCOUNTS_URL}/oauth/v2/token" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=${ZOHO_REFRESH_TOKEN}" \
  -d "client_id=${ZOHO_CLIENT_ID}" \
  -d "client_secret=${ZOHO_CLIENT_SECRET}")

if echo "$TOKEN_RESPONSE" | grep -q '"access_token"'; then
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.access_token||'')})")
  EXPIRES_IN=$(echo "$TOKEN_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.expires_in||'')})")
  echo "OK: access_token received (expires_in=${EXPIRES_IN}s)"
else
  echo "FAILED to refresh access token:"
  echo "$TOKEN_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
  exit 1
fi

echo ""
echo "=== Step 2: GET Lead ${LEAD_ID} ==="
LEAD_RESPONSE=$(curl -s -w "\n__HTTP_STATUS__:%{http_code}" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  "${ZOHO_API_BASE}/crm/v8/Leads/${LEAD_ID}")

HTTP_STATUS=$(echo "$LEAD_RESPONSE" | sed -n 's/.*__HTTP_STATUS__://p')
BODY=$(echo "$LEAD_RESPONSE" | sed '/__HTTP_STATUS__/d')

echo "HTTP ${HTTP_STATUS}"
echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2))}catch{console.log(d)}})"

if [[ "$HTTP_STATUS" != "200" ]]; then
  exit 1
fi

echo ""
echo "Done."
