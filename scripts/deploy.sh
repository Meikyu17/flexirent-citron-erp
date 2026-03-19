#!/usr/bin/env sh
set -eu

if [ ! -f ".env.docker" ]; then
  echo "Fichier .env.docker introuvable."
  echo "Copie d'abord .env.docker.example vers .env.docker et configure les secrets."
  exit 1
fi

echo "Build et demarrage de Citron ERP..."
docker compose --env-file .env.docker up -d --build

echo "Stack active. Verification rapide:"
docker compose ps
