#!/usr/bin/env bash
# Create a worker VM on Google Cloud. Run from your own machine after
#   gcloud auth login && gcloud config set project <your-project>
# Creates: a private VPC with SSH only through Identity-Aware Proxy (no public
# SSH, no other inbound ports), and one Ubuntu 24.04 VM that provisions itself
# with deploy/vm/setup.sh. The VM gets no Google credentials at all.
#
#   PROJECT=my-project bash deploy/gcp/create-vm.sh
# Options (env): NAME, ZONE, MACHINE, DISK_GB, SPOT=1 (cheaper, can be stopped by Google)
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
[ -n "$PROJECT" ] || { echo "set PROJECT or run: gcloud config set project <id>"; exit 1; }
NAME="${NAME:-papersseum-worker-1}"
ZONE="${ZONE:-asia-south1-a}"
REGION="${ZONE%-*}"
MACHINE="${MACHINE:-e2-standard-2}"     # 2 vCPU, 8 GB; e2-medium (4 GB) is the cheaper minimum
DISK_GB="${DISK_GB:-30}"
SPOT="${SPOT:-0}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "project=$PROJECT zone=$ZONE machine=$MACHINE spot=$SPOT name=$NAME"
read -r -p "Create these billable resources? [y/N] " ok
[ "$ok" = "y" ] || exit 1

gcloud services enable compute.googleapis.com iap.googleapis.com --project "$PROJECT"

gcloud compute networks describe papersseum-net --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud compute networks create papersseum-net --subnet-mode=custom --project "$PROJECT"
gcloud compute networks subnets describe papersseum-subnet --region "$REGION" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud compute networks subnets create papersseum-subnet --network papersseum-net \
    --range 10.10.0.0/24 --region "$REGION" --project "$PROJECT"
gcloud compute firewall-rules describe papersseum-allow-iap-ssh --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud compute firewall-rules create papersseum-allow-iap-ssh --network papersseum-net \
    --direction INGRESS --allow tcp:22 --source-ranges 35.235.240.0/20 --project "$PROJECT"

extra=()
[ "$SPOT" = "1" ] && extra+=(--provisioning-model=SPOT --instance-termination-action=STOP)

gcloud compute instances create "$NAME" --project "$PROJECT" --zone "$ZONE" \
  --machine-type "$MACHINE" \
  --image-family ubuntu-2404-lts-amd64 --image-project ubuntu-os-cloud \
  --boot-disk-size "${DISK_GB}GB" --boot-disk-type pd-balanced \
  --network papersseum-net --subnet papersseum-subnet \
  --no-service-account --no-scopes \
  --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring \
  --metadata-from-file startup-script="$HERE/../vm/setup.sh" \
  ${extra[@]+"${extra[@]}"}

cat <<MSG

Created $NAME. First boot takes a few minutes (installs Docker, builds the image).
Next:
  gcloud compute ssh $NAME --zone $ZONE --tunnel-through-iap
  sudo journalctl -u google-startup-scripts -f        # watch provisioning
  sudo cp /etc/papersseum/worker.env.example /etc/papersseum/worker.env
  sudo nano /etc/papersseum/worker.env                 # fill in secrets
  sudo systemctl enable --now papersseum-worker papersseum-ping.timer

To save money between events:  gcloud compute instances stop $NAME --zone $ZONE
MSG
