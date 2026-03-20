#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${IMAGE_NAME:-flexirent-citron-erp:local}"

echo "Build de l'image Docker ${IMAGE_NAME}..."
docker build -t "$IMAGE_NAME" .
