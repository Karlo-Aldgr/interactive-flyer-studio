-- Fresh-chain compatibility for the next historical migration.
--
-- 20260825152400_customer_portal_link_rpc.sql contains the obsolete job_status
-- literal "completed". Keep that historical migration unchanged, defer SQL
-- function-body validation for its session, and let the immediately following
-- migration install the corrected body before validation is restored.
SET check_function_bodies = off;
