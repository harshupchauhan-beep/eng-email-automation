#!/bin/sh
set -eu

web_pid=""
worker_pid=""

shutdown() {
  if [ -n "$web_pid" ]; then
    kill "$web_pid" 2>/dev/null || true
  fi
  if [ -n "$worker_pid" ]; then
    kill "$worker_pid" 2>/dev/null || true
  fi
  wait || true
  exit 0
}

trap shutdown TERM INT

npx next start -H 0.0.0.0 -p "${PORT:-3000}" &
web_pid=$!

npx tsx src/worker/index.ts &
worker_pid=$!

while kill -0 "$web_pid" 2>/dev/null && kill -0 "$worker_pid" 2>/dev/null; do
  sleep 2
done

kill "$web_pid" "$worker_pid" 2>/dev/null || true
wait || true
exit 1
