#!/usr/bin/env bash
# Pull the latest code, rebuild the sandbox image and restart the worker.
# Run on the VM:  sudo bash /opt/papersseum/deploy/vm/update.sh
# The worker finishes its current match before stopping (up to ~5 minutes).
set -euo pipefail
BRANCH="${BRANCH:-main}"
git -C /opt/papersseum fetch -q origin "$BRANCH"
git -C /opt/papersseum checkout -q "$BRANCH"
git -C /opt/papersseum reset -q --hard "origin/$BRANCH"
bash /opt/papersseum/deploy/vm/build-image.sh
systemctl restart papersseum-worker.service
sleep 5
systemctl --no-pager --lines=15 status papersseum-worker.service || true
