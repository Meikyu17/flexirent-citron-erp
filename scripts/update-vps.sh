#!/usr/bin/env sh
set -eu

if [ ! -f ".env.docker" ]; then
  echo "Fichier .env.docker introuvable."
  echo "Copie d'abord .env.docker.example vers .env.docker et configure les secrets."
  exit 1
fi

echo "Build et mise a jour de Citron ERP (mode VPS partage)..."
docker compose -f docker-compose.vps.yml --env-file .env.docker up -d --build migrate app

echo "Verification finale:"
docker compose -f docker-compose.vps.yml ps
