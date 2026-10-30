-- Current RMS is read through the WA Staff MCP (which already caches it). Direct pulls would eat Current's API rate limit.
select cron.unschedule('sync-current-rms');
