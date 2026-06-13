-- Add 'editor' role so admins can grant editor access to specific accounts.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'editor';
