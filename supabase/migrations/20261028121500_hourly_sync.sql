-- Hourly sync, staggered so sources do not run at once. WordPress daily.
-- The shared secret lives in Vault (name: sync_secret); the Edge Function checks it.
create or replace function hub.trigger_sync(src text) returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://whdgxzsuuyyvymnkdhli.supabase.co/functions/v1/sync?source=' || src,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$$;
revoke all on function hub.trigger_sync(text) from public, anon, authenticated;

select cron.schedule('sync-current-rms', '7 * * * *',  $$select hub.trigger_sync('current_rms')$$);
select cron.schedule('sync-brighthr',    '17 * * * *', $$select hub.trigger_sync('brighthr')$$);
select cron.schedule('sync-wordpress',   '27 5 * * *', $$select hub.trigger_sync('wordpress')$$);


-- TODO: log pruning job (needs owner approval in Supabase before applying).
