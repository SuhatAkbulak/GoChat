#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

PORT=5180

cleanup_port_listeners() {
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids:-}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

cleanup_kill_port() {
  local kp="./node_modules/.bin/kill-port"
  if [[ -x "$kp" ]]; then
    "$kp" "${PORT}" 2>/dev/null || true
  fi
}

cleanup_next_cli_globs() {
  if command -v pkill >/dev/null 2>&1; then
    # [n] — pkill'un kendini eşleştirmesini önler
    pkill -f "[n]ode .*next.* dev.*-p ${PORT}" 2>/dev/null || true
    pkill -f "[n]ext dev.*-p ${PORT}" 2>/dev/null || true
    pkill -f "[n]ext-cli.*dev.*${PORT}" 2>/dev/null || true
  fi
}

cleanup_port_listeners
cleanup_kill_port
cleanup_next_cli_globs

if [[ "${1:-}" == "--clean" ]]; then
  rm -rf .next
fi

exec npx next dev -p "${PORT}"
