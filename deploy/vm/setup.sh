#!/usr/bin/env bash
# Provision a papersseum worker VM (Ubuntu 24.04). Idempotent: safe to re-run.
# Runs as root, e.g. as a GCE startup script or `sudo bash setup.sh` over SSH.
# Installs Docker, uv and the repo, builds the sandbox image and installs the
# systemd units. The worker is NOT started until /etc/papersseum/worker.env
# exists (put your secrets there, see deploy/vm/worker.env.example).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/dhairya-pandya/papersseum.git}"
# branch to deploy: env var, else the VM's "papersseum-branch" metadata, else main
BRANCH="${BRANCH:-$(curl -fs -m 3 -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/attributes/papersseum-branch 2>/dev/null || echo main)}"
APP=/opt/papersseum
STATE=/var/lib/papersseum
export DEBIAN_FRONTEND=noninteractive

log() { echo "[setup] $*"; }

log "packages"
apt-get update -qq
apt-get install -y -qq docker.io git curl ca-certificates >/dev/null

log "docker log rotation"
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'JSON'
{ "log-driver": "local", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl enable --now docker
systemctl restart docker

if ! command -v uv >/dev/null; then
  log "uv"
  curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh >/dev/null
fi

log "service user"
id papersseum >/dev/null 2>&1 || useradd --system --create-home --home-dir "$STATE" --shell /usr/sbin/nologin papersseum
usermod -aG docker papersseum        # the worker starts one container per bot
install -d -o papersseum -g papersseum "$STATE"

log "repo"
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch -q origin "$BRANCH" && git -C "$APP" checkout -q "$BRANCH" && git -C "$APP" reset -q --hard "origin/$BRANCH"
else
  git clone -q --branch "$BRANCH" "$REPO_URL" "$APP"
fi
chown -R root:root "$APP"            # the worker user can read the code, not change it

log "systemd units"
install -m 0644 "$APP/deploy/vm/papersseum-worker.service" /etc/systemd/system/
install -m 0644 "$APP/deploy/vm/papersseum-ping.service"   /etc/systemd/system/
install -m 0644 "$APP/deploy/vm/papersseum-ping.timer"     /etc/systemd/system/
install -m 0644 "$APP/deploy/vm/papersseum-idle.service"   /etc/systemd/system/
install -m 0644 "$APP/deploy/vm/papersseum-idle.timer"     /etc/systemd/system/
install -d -m 0750 -o root -g papersseum /etc/papersseum
[ -f /etc/papersseum/worker.env ] || install -m 0640 -o root -g papersseum "$APP/deploy/vm/worker.env.example" /etc/papersseum/worker.env.example
systemctl daemon-reload

log "sandbox image"
bash "$APP/deploy/vm/build-image.sh"

if [ -f /etc/papersseum/worker.env ]; then
  log "starting worker"
  systemctl enable --now papersseum-worker.service papersseum-ping.timer papersseum-idle.timer
else
  log "DONE, but no /etc/papersseum/worker.env yet. Create it from worker.env.example, then:"
  log "  sudo systemctl enable --now papersseum-worker.service papersseum-ping.timer papersseum-idle.timer"
fi
