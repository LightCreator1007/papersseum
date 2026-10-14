#!/usr/bin/env bash
# Build the sandbox image from the checked-out repo. The worker refuses to start
# if the image's engine hash differs from its own, so rebuild after every pull.
set -euo pipefail
APP=/opt/papersseum
cd "$APP"
rm -rf dist
uv build --wheel --package papersseum
docker build -q -f docker/Dockerfile -t papersseum-sandbox .
echo "[image] built, engine: $(docker run --rm --network none --entrypoint python papersseum-sandbox -c 'import papersseum; print(papersseum.ENGINE_HASH)')"
