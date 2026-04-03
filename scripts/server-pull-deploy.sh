#!/usr/bin/env bash
# Запуск на сервере в корне репозитория: подтянуть код с origin и задеплоить.
# Пример: cd /path/to/altdi.ru && ./scripts/server-pull-deploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"

test -d .git || { echo "Запускай из клона git-репозитория"; exit 1; }

git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

chmod +x scripts/deploy-on-server.sh 2>/dev/null || true
./scripts/deploy-on-server.sh
