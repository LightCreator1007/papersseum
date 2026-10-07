-- Failure handling: retry jobs after worker errors, and recover jobs whose
-- worker vanished (power cut, crash). requeue_expired is run by pg_cron.

-- Internal helper: mark a job failed and propagate to its match/submission.
create or replace function internal.mark_job_failed(p_job bigint, p_error text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  update public.jobs
     set status = 'failed', finished_at = now(), lease_until = null, last_error = p_error
   where id = p_job
  returning * into v_job;

  if v_job.kind = 'match' then
    update public.matches set status = 'failed', error = p_error, finished_at = now()
     where id = v_job.match_id;
  else
    update public.submissions
       set status = 'rejected', error = 'Validation could not run: ' || coalesce(p_error, 'unknown error')
     where id = v_job.submission_id;
  end if;
end;
$$;

-- The worker hit an infrastructure problem (not the agent's fault). Retry
-- until max_attempts, then give up.
create or replace function internal.fail_job(p_job bigint, p_worker text, p_error text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  v_job := internal.own_running_job(p_job, p_worker);
  if v_job.attempts >= v_job.max_attempts then
    perform internal.mark_job_failed(p_job, p_error);
  else
    update public.jobs
       set status = 'queued', worker_id = null, lease_until = null, last_error = p_error
     where id = p_job;
    if v_job.kind = 'match' then
      update public.matches set status = 'queued', started_at = null where id = v_job.match_id;
    else
      update public.submissions set status = 'pending' where id = v_job.submission_id;
    end if;
  end if;
  update public.workers set current_job = null where id = p_worker;
end;
$$;

-- pg_cron, every minute: jobs whose worker vanished (power cut, crash) go back
-- in the queue, or fail after max_attempts.
create or replace function internal.requeue_expired()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_n   integer := 0;
begin
  for v_job in
    select * from public.jobs
     where status = 'running' and lease_until < now()
     for update skip locked
  loop
    v_n := v_n + 1;
    if v_job.attempts >= v_job.max_attempts then
      perform internal.mark_job_failed(v_job.id, 'Worker stopped responding');
    else
      update public.jobs
         set status = 'queued', worker_id = null, lease_until = null,
             last_error = 'Worker ' || coalesce(v_job.worker_id, '?') || ' stopped responding'
       where id = v_job.id;
      if v_job.kind = 'match' then
        update public.matches set status = 'queued', started_at = null where id = v_job.match_id;
      else
        update public.submissions set status = 'pending' where id = v_job.submission_id;
      end if;
    end if;
  end loop;
  return v_n;
end;
$$;
