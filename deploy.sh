#!/usr/bin/env sh
# Slate deploy — pull latest and rebuild the prod Docker stack.
# Run on the server (as the `ubuntu` user, which is in the docker group):
#   sh /home/ubuntu/slate/deploy.sh
# Override the repo location with SLATE_DIR=/path sh deploy.sh
set -e

REPO="${SLATE_DIR:-/home/ubuntu/slate}"
cd "$REPO"

echo "→ pulling latest (ff-only)…"
git pull --ff-only

cd server
echo "→ building + (re)starting containers…"
docker compose up -d --build

echo "→ status:"
docker compose ps

echo "✓ deployed → https://slate.ammarbrohi.com"
