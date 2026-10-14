# Deploying a match worker

A worker is a Linux VM (or any Linux machine with Docker) that makes outbound
connections only: to the Supabase database and storage. It has no public
ports. Several workers can run at once; they pull from the same queue, and a
match whose worker dies is requeued when its lease expires.

## Google Cloud (about 10 minutes)

On your own machine:

```bash
gcloud auth login
gcloud config set project <your-project-id>
SPOT=0 MACHINE=e2-standard-2 bash deploy/gcp/create-vm.sh     # asks before creating anything
```

This creates a private network where SSH is only reachable through Google's
Identity-Aware Proxy, and an Ubuntu 24.04 VM that has no Google credentials.
On first boot it installs Docker and uv, clones this repo, builds the
`papersseum-sandbox` image and installs the systemd units.

Then, on the VM:

```bash
gcloud compute ssh papersseum-worker-1 --zone asia-south1-a --tunnel-through-iap
sudo journalctl -u google-startup-scripts -f       # wait for "[setup] DONE"
sudo cp /etc/papersseum/worker.env.example /etc/papersseum/worker.env
sudo nano /etc/papersseum/worker.env               # fill in the secrets
sudo systemctl enable --now papersseum-worker papersseum-ping.timer
journalctl -u papersseum-worker -f
```

`DATABASE_URL` must be Supabase's **session pooler** string (Dashboard >
Connect), not the direct `db.<ref>.supabase.co` host: the direct host is
IPv6-only on the free plan and a GCE VM only has IPv4.

## Any other Linux machine (lab PC, AWS EC2, ...)

Ubuntu 22.04+ with sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/dhairya-pandya/papersseum/main/deploy/vm/setup.sh | sudo bash
```

then create `/etc/papersseum/worker.env` and enable the units as above.

## Day to day

| Task | Command (on the VM) |
|---|---|
| Deploy new code or a new engine | `sudo bash /opt/papersseum/deploy/vm/update.sh` |
| Logs | `journalctl -u papersseum-worker -f` |
| Stop (finishes the current match first) | `sudo systemctl stop papersseum-worker` |
| Save money between events | `gcloud compute instances stop papersseum-worker-1 --zone asia-south1-a` |

After any change to the engine (`ENGINE_HASH` changes), run `update.sh` on
every worker and set `season.engine_hash` to the new value
(`papersseum version`). A worker whose image or code is out of date refuses to
start or to claim jobs.

## Cost control

- `e2-standard-2` is about $50 a month if left running; `SPOT=1` is far
  cheaper but Google can stop it (the queue copes: the lease expires and
  another worker takes the match).
- Set a budget alert under Billing > Budgets (for example at 50% and 90% of
  the credit).
- A stopped VM costs only its disk and address.

## Security notes

- The worker holds a database connection with full rights. Keep the env file
  readable only by root and the `papersseum` user, and never commit it.
- Uploaded bots run in containers with no network, no environment and a
  read-only root. They cannot see the worker's secrets.
- The service user is in the `docker` group, which is root-equivalent on the
  VM. That is acceptable because only the worker (our code) uses it; do not
  run anything else on this machine.
