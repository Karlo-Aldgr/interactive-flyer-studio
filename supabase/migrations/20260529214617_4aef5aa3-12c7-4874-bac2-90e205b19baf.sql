-- Remove sensitive tables from Realtime publication to prevent broadcasting
-- row data (including waiter pin_hash and customer PII) to any subscriber.
ALTER PUBLICATION supabase_realtime DROP TABLE public.waiters;
ALTER PUBLICATION supabase_realtime DROP TABLE public.menu_orders;