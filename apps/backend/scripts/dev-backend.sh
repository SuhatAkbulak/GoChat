#!/usr/bin/env bash
# Nest öncesi PORT (varsayılan 3000) dinleyen süreçleri sonlandırır — EADDRINUSE ve eski backend kalıntısını önler.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

PORT="${PORT:-3000}"

cleanup_port_listeners() {
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids:-}" ]]; then
      echo "[backend] Port ${PORT} kullanımda — süreç sonlandırılıyor: ${pids}" >&2
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

cleanup_port_listeners

exec npx nest start --watch
