#!/usr/bin/env bash
# Remove EVERYTHING create-vm.sh made, so nothing bills at all (not even the disk).
# Safe to do between events: create-vm.sh rebuilds an identical worker in ~3 minutes.
# The worker keeps no data of its own (everything lives in Supabase).
#
#   bash deploy/gcp/delete-vm.sh          # asks first; YES=1 skips the question
set -euo pipefail
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
NAME="${NAME:-papersseum-worker-1}"
ZONE="${ZONE:-asia-south1-a}"
REGION="${ZONE%-*}"
echo "Will delete VM $NAME, its disk, the SSH firewall rule, subnet and network in $PROJECT."
if [ "${YES:-0}" != "1" ]; then
  read -r -p "Delete them? [y/N] " ok
  [ "$ok" = "y" ] || exit 1
fi
gcloud compute instances delete "$NAME" --zone "$ZONE" --project "$PROJECT" --delete-disks=all --quiet || true
gcloud compute firewall-rules delete papersseum-allow-iap-ssh --project "$PROJECT" --quiet || true
gcloud compute networks subnets delete papersseum-subnet --region "$REGION" --project "$PROJECT" --quiet || true
gcloud compute networks delete papersseum-net --project "$PROJECT" --quiet || true
echo "Done. Remaining billable items in the project:"
gcloud compute instances list --project "$PROJECT"
gcloud compute disks list --project "$PROJECT"
gcloud compute addresses list --project "$PROJECT"
