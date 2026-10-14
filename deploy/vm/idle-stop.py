"""Power the VM off when the whole platform has been idle, so it stops costing money.

Run by papersseum-idle.timer every 5 minutes. Idle means: no round can be
scheduled (the season is frozen, or no active player bot exists), no job is queued
or running, and the newest job activity is older than IDLE_STOP_MINUTES. While a
season is live the 15-minute rounds keep the queue refilling, so the VM never
powers off between rounds, whatever IDLE_STOP_MINUTES is. The VM must
also have been up that long, so a fresh boot gets time to see the next 15-minute
round. A powered-off GCE VM keeps billing only for its disk. Disabled when
IDLE_STOP_MINUTES is 0 or unset.
"""
import os
import subprocess
import sys

import psycopg

minutes = int(os.environ.get("IDLE_STOP_MINUTES") or 0)
if minutes <= 0:
    sys.exit(0)

with open("/proc/uptime") as fh:
    if float(fh.read().split()[0]) < minutes * 60:
        sys.exit(0)

with psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=15) as conn:
    busy, idle_for = conn.execute(
        """
        select count(*) filter (where status in ('queued', 'running')),
               coalesce(extract(epoch from now() - max(greatest(created_at, coalesce(finished_at, created_at)))),
                        1e9)
          from public.jobs
        """
    ).fetchone()
    live = conn.execute(
        """
        select not (select frozen from public.season where id = 1)
               and exists (select 1 from public.bots
                            where not is_house and not banned and active_submission_id is not null)
        """
    ).fetchone()[0]

if live:
    sys.exit(0)
if busy == 0 and idle_for > minutes * 60:
    print(f"idle for {idle_for / 60:.0f} min (limit {minutes}); powering off", flush=True)
    subprocess.run(["systemctl", "poweroff"], check=False)
