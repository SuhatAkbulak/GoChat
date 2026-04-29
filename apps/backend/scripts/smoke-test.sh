#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
MOCK_URL="${MOCK_URL:-http://localhost:4000}"

echo "==> Health checks"
curl -fsS "${BACKEND_URL}/health" >/dev/null
curl -fsS "${MOCK_URL}/health" >/dev/null
echo "OK: backend (${BACKEND_URL}) and mock (${MOCK_URL}) are reachable."

EVENT_ID="evt_smoke_$(date +%s)"
CLIENT_MESSAGE_ID="${CLIENT_MESSAGE_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"

echo "==> 1) Duplicate webhook simulation via mock provider"
curl -fsS -X POST "${MOCK_URL}/simulate/inbound" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"${EVENT_ID}\",\"channel\":\"whatsapp\",\"from\":\"user-smoke\",\"text\":\"hello smoke\",\"duplicate\":true}" >/dev/null
echo "OK: simulate/inbound sent."

echo "==> 2) Idempotent send test via backend"
RESP1=$(curl -fsS -X POST "${BACKEND_URL}/messages/send" \
  -H "Content-Type: application/json" \
  -d "{\"channel\":\"whatsapp\",\"to\":\"user-smoke\",\"text\":\"idempotent test\",\"clientMessageId\":\"${CLIENT_MESSAGE_ID}\"}")
RESP2=$(curl -fsS -X POST "${BACKEND_URL}/messages/send" \
  -H "Content-Type: application/json" \
  -d "{\"channel\":\"whatsapp\",\"to\":\"user-smoke\",\"text\":\"idempotent test\",\"clientMessageId\":\"${CLIENT_MESSAGE_ID}\"}")

echo "First response:  ${RESP1}"
echo "Second response: ${RESP2}"

echo "==> 3) Conversation list snapshot"
curl -fsS "${BACKEND_URL}/conversations"
echo
echo "Smoke test completed."
