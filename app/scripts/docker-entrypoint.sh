#!/bin/sh
set -eu

# [WHY] Prisma 8's non-interactive apply is `db migrate --yes`, not `migrate deploy`
i=0
until npx prisma db migrate --yes --db "$DATABASE_URL"; do
  i=$((i + 1))
  if [ "$i" -ge 20 ]; then
    echo "prisma db migrate failed after ${i} attempts" >&2
    exit 1
  fi
  echo "waiting for postgres before migrate (attempt ${i})"
  sleep 2
done

exec node dist/server.js
