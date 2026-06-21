#!/bin/sh
PLACEHOLDER="/__NEXT_BASE_PATH_PLACEHOLDER__"
ACTUAL_BASE_PATH="${URL_BASE_PATH:-}"

if grep -q "$PLACEHOLDER" /app/server.js; then
    echo "Configuring Next.js basePath at runtime to: '$ACTUAL_BASE_PATH'"
    find /app -type f \( -name "*.js" -o -name "*.html" -o -name "*.json" \) -exec sed -i "s|$PLACEHOLDER|$ACTUAL_BASE_PATH|g" {} +
fi

echo "Initializing database schema..."
npx prisma db push

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
