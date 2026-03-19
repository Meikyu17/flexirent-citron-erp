#!/usr/bin/env sh
set -eu

if [ ! -f ".env.docker" ]; then
  echo "Fichier .env.docker introuvable."
  echo "Copie d'abord .env.docker.example vers .env.docker et configure les secrets."
  exit 1
fi

echo "Build des nouvelles images..."
docker compose --env-file .env.docker build app_blue app_green

echo "Mise a jour rolling: app_blue..."
docker compose --env-file .env.docker up -d --no-deps app_blue

echo "Mise a jour rolling: app_green..."
docker compose --env-file .env.docker up -d --no-deps app_green

echo "Verification finale:"
docker compose ps
