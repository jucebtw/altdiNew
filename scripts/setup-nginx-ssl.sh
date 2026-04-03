#!/usr/bin/env bash
# Nginx как reverse proxy на Next.js (PM2) + Let's Encrypt (certbot).
# Запуск с sudo. CERTBOT_EMAIL обязателен. PUBLIC_DOMAIN по умолчанию altdi.ru.
# После первого выпуска сертификата конфиг не перезаписывается (Certbot правит файл под SSL).
set -euo pipefail

: "${CERTBOT_EMAIL:?Укажите CERTBOT_EMAIL (email для Let's Encrypt)}"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-altdi.ru}"
APP_PORT="${APP_PORT:-3000}"
INCLUDE_WWW="${INCLUDE_WWW:-false}"

if [ "${EUID:-$(id -u)}" -eq 0 ]; then
  SUDO=()
elif command -v sudo >/dev/null 2>&1; then
  SUDO=(sudo)
else
  echo "Нужен root или sudo"
  exit 1
fi

echo "[nginx-ssl] Установка пакетов..."
"${SUDO[@]}" apt-get update -qq
DEBIAN_FRONTEND=noninteractive "${SUDO[@]}" apt-get install -y -qq nginx certbot python3-certbot-nginx

if command -v ufw >/dev/null 2>&1; then
  "${SUDO[@]}" ufw allow 80/tcp comment "nginx HTTP" 2>/dev/null || true
  "${SUDO[@]}" ufw allow 443/tcp comment "nginx HTTPS" 2>/dev/null || true
fi

if [ "$INCLUDE_WWW" = "true" ] || [ "$INCLUDE_WWW" = "1" ]; then
  SERVER_NAMES="${PUBLIC_DOMAIN} www.${PUBLIC_DOMAIN}"
else
  SERVER_NAMES="${PUBLIC_DOMAIN}"
fi

CONF_PATH="/etc/nginx/sites-available/${PUBLIC_DOMAIN}.conf"
LE_LIVE="/etc/letsencrypt/live/${PUBLIC_DOMAIN}"

write_http_only_config() {
  echo "[nginx-ssl] Запись HTTP-конфига → ${CONF_PATH}"
  "${SUDO[@]}" tee "$CONF_PATH" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAMES};

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
}

if [ ! -d "$LE_LIVE" ]; then
  write_http_only_config
  if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "[nginx-ssl] Отключаю default (бэкап .bak)"
    "${SUDO[@]}" mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak 2>/dev/null || true
  fi
  "${SUDO[@]}" ln -sf "$CONF_PATH" "/etc/nginx/sites-enabled/${PUBLIC_DOMAIN}.conf"
  "${SUDO[@]}" nginx -t
  "${SUDO[@]}" systemctl enable nginx
  "${SUDO[@]}" systemctl reload nginx

  echo "[nginx-ssl] Получение сертификата Let's Encrypt..."
  CERTBOT_ARGS=(--nginx -d "$PUBLIC_DOMAIN")
  if [ "$INCLUDE_WWW" = "true" ] || [ "$INCLUDE_WWW" = "1" ]; then
    CERTBOT_ARGS+=(-d "www.${PUBLIC_DOMAIN}")
  fi
  CERTBOT_ARGS+=(--non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect)
  "${SUDO[@]}" certbot "${CERTBOT_ARGS[@]}"
else
  echo "[nginx-ssl] Сертификат уже есть (${LE_LIVE}) — только renew, конфиг Nginx не трогаю"
  "${SUDO[@]}" certbot renew --quiet || true
  "${SUDO[@]}" nginx -t
  "${SUDO[@]}" systemctl reload nginx
fi

echo "[nginx-ssl] Готово: https://${PUBLIC_DOMAIN}"
