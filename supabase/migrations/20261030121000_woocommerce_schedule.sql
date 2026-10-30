-- WooCommerce hourly at :37 (recent changes only). WordPress pages are covered by WA Staff marketing_content.
select cron.schedule('sync-woocommerce', '37 * * * *', $$select hub.trigger_sync('woocommerce')$$);
select cron.unschedule('sync-wordpress');
