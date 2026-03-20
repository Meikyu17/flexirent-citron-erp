#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

APP_PORT="${APP_PORT:-3000}"
DB_PORT="${DB_PORT:-5432}"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Fichier .env cree depuis .env.example"
fi

if [ ! -f ".env.db" ]; then
  cp .env.db.example .env.db
  echo "Fichier .env.db cree depuis .env.db.example"
fi

kill_port_if_used() {
  port="$1"
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"

  if [ -n "$pids" ]; then
    echo "Arret des processus sur le port ${port}: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

echo "Nettoyage des serveurs Next en doublon..."
kill_port_if_used "$APP_PORT"
kill_port_if_used "$((APP_PORT + 1))"
kill_port_if_used "$((APP_PORT + 2))"

echo "Demarrage de la base Docker locale..."
docker compose -f docker-compose.db.yml --env-file .env.db up -d

echo "Attente de PostgreSQL sur le port ${DB_PORT}..."
i=0
until docker compose -f docker-compose.db.yml --env-file .env.db exec -T db \
  pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-citron_erp}" >/dev/null 2>&1
do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "PostgreSQL ne repond pas apres 30 tentatives."
    exit 1
  fi
  sleep 2
done

echo "Application des migrations Prisma..."
npx prisma migrate deploy

echo "Injection des donnees de demonstration..."
npm run db:seed:demo-fleet

echo "Sync initiale Fleetee..."
npm run fleetee:sync || echo "Sync Fleetee ignoree (credentials manquants ou erreur reseau)"

echo "Lancement du front local sur le port ${APP_PORT}..."
exec npm run dev -- --port "$APP_PORT"
