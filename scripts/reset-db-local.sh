#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env.db" ]; then
  cp .env.db.example .env.db
  echo "Fichier .env.db cree depuis .env.db.example"
fi

echo "Arret et suppression du volume de la base locale..."
docker compose -f docker-compose.db.yml --env-file .env.db down -v
