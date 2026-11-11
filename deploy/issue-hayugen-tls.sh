#!/bin/bash
# Poll until hayugen.com points at this VPS, then issue Let's Encrypt and enable HTTPS.
set -euo pipefail
IP="95.111.233.120"
EMAIL="armeniangene@gmail.com"
HTTP_CONF="/etc/nginx/sites-available/hayugen.com"
SSL_CONF_SRC="/var/www/hayugen-maison/deploy/nginx-hayugen.com.ssl.conf"

for _ in $(seq 1 360); do
  APEX="$(dig +short hayugen.com A | tail -n 1)"
  WWW="$(dig +short www.hayugen.com A | tail -n 1)"
  echo "$(date -u +%FT%TZ) apex=${APEX:-none} www=${WWW:-none}"
  if [ "$APEX" = "$IP" ] && { [ "$WWW" = "$IP" ] || [ -z "$WWW" ]; }; then
    sleep 15
    certbot certonly --webroot -w /var/www/letsencrypt \
      -d hayugen.com -d www.hayugen.com \
      --non-interactive --agree-tos --email "$EMAIL" --keep-until-expiring
    cp "$SSL_CONF_SRC" "$HTTP_CONF"
    nginx -t
    systemctl reload nginx
    echo "hayugen.com TLS is live"
    exit 0
  fi
  sleep 20
done
echo "timed out waiting for hayugen.com DNS" >&2
exit 1
