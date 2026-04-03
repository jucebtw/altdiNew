#!/usr/bin/env bash
# Подключать через source из deploy-on-server.sh.
# Ставит Node.js (официальный linux-x64 tarball) и pm2 в ~/.local/share/altdi-ru — без root.
# Нужны: curl или wget, tar, gzip.
set -euo pipefail

# Ubuntu 24.04: если нет curl/wget, но есть безпарольный sudo — ставим curl через apt.
if [ -r /etc/os-release ] && grep -qi '^ID=ubuntu' /etc/os-release; then
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    if sudo -n true 2>/dev/null; then
      echo "[toolchain] Ubuntu: apt install curl ca-certificates"
      sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates
    else
      echo "[toolchain] Нужен curl или wget. Выполните: sudo apt update && sudo apt install -y curl"
      exit 1
    fi
  fi
fi

NODE_VERSION="${NODE_VERSION:-20.18.1}"
TOOLCHAIN_ROOT="${TOOLCHAIN_ROOT:-$HOME/.local/share/altdi-ru}"
NODE_NAME="node-v${NODE_VERSION}-linux-x64"
NODE_DIR="${TOOLCHAIN_ROOT}/${NODE_NAME}"
NPM_GLOBAL="${TOOLCHAIN_ROOT}/npm-global"

mkdir -p "$TOOLCHAIN_ROOT"

need_install=0
if [ ! -x "${NODE_DIR}/bin/node" ]; then
  need_install=1
elif [ "$("${NODE_DIR}/bin/node" -v)" != "v${NODE_VERSION}" ]; then
  need_install=1
fi

if [ "$need_install" = "1" ]; then
  echo "[toolchain] Устанавливаю Node.js ${NODE_VERSION} → ${NODE_DIR}"
  tmp="$(mktemp -d)"
  url="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_NAME}.tar.gz"
  archive="${tmp}/node.tar.gz"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$archive"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$archive"
  else
    echo "[toolchain] Нужны curl или wget. На Ubuntu 24.04: sudo apt update && sudo apt install -y curl"
    exit 1
  fi

  rm -rf "${NODE_DIR}"
  mkdir -p "${tmp}/extract"
  tar -xzf "$archive" -C "${tmp}/extract"
  mv "${tmp}/extract/${NODE_NAME}" "${NODE_DIR}"
  rm -rf "$tmp"
fi

export PATH="${NODE_DIR}/bin:${PATH}"
export PATH="${NPM_GLOBAL}/bin:${PATH}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[toolchain] Устанавливаю pm2 → ${NPM_GLOBAL}"
  mkdir -p "${NPM_GLOBAL}"
  npm install -g pm2 --prefix "${NPM_GLOBAL}"
fi
