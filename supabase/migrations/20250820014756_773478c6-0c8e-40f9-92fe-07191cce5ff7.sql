-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reset of user limits at midnight UTC
SELECT cron.schedule(
  'reset-daily-limits',
  '0 0 * * *', -- At midnight every day
  $$
  SELECT public.reset_daily_limits();
  $$
);