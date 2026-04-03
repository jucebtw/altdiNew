#!/usr/bin/env bash
# Запуск на сервере после доставки файлов (вручную или из CI).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# shellcheck source=ensure-toolchain.sh
# Node.js + pm2 в $HOME/.local/share/altdi-ru (без apt для самого Node)
source "$SCRIPT_DIR/ensure-toolchain.sh"

NODE_BIN="$(command -v node)"
if command -v readlink >/dev/null 2>&1; then
  NODE_BIN="$(readlink -f "$NODE_BIN" 2>/dev/null || echo "$NODE_BIN")"
fi
printf '%s\n' "$NODE_BIN" > "$ROOT/.node-bin"
export TOOLCHAIN_NODE="$NODE_BIN"

export NODE_ENV=production

npm ci
npx prisma generate
npx prisma db push
npm run build

if pm2 describe altdi-ru >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi
