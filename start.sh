#!/bin/sh
echo "Initializing database schema..."
npx prisma db push

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
