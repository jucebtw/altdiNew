#!/usr/bin/env bash
# Скрипт заливки на Ubuntu. Подправь DOMAIN и REMOTE.
# 1) chmod +x deploy-ubuntu.sh
# 2) с локали: rsync -avz --delete ./ user@server:/var/www/yoursite/
#
# Nginx: location / { root /var/www/yoursite; try_files $uri $uri/ /index.html; }
# Установка nginx: sudo apt update && sudo apt install -y nginx
# Права: sudo chown -R www-data:www-data /var/www/yoursite
#
set -euo pipefail
echo "Read comments at top of deploy-ubuntu.sh for rsync / nginx. No remote deploy run by default."
exit 0
