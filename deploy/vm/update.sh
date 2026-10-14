#!/usr/bin/env bash
# Pull the latest code, refresh the systemd units, rebuild the sandbox image and
# restart the worker.   Run on the VM:  sudo bash /opt/papersseum/deploy/vm/update.sh
# The worker finishes its current match before stopping (up to ~5 minutes).
set -euo pipefail
bash /opt/papersseum/deploy/vm/setup.sh
systemctl restart papersseum-worker.service
sleep 5
systemctl --no-pager --lines=15 status papersseum-worker.service || true
