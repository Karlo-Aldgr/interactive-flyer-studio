-- Phase 2B builder catalog expansion. This migration only expands allowed
-- definition types; it does not connect events or execute actions.

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_type_check CHECK (trigger_type IN (
  'flyer_viewed', 'flyer_tapped', 'hotspot_clicked', 'qr_scanned',
  'form_submitted', 'contact_form_submitted', 'website_form_submitted',
  'lead_created', 'appointment_booked', 'appointment_request_submitted',
  'ticket_purchase_completed', 'flyer_shared', 'bizad_viewed',
  'bizad_action_clicked', 'date_time_reached', 'customer_action_completed'
));
ALTER TABLE public.automation_versions DROP CONSTRAINT IF EXISTS automation_versions_trigger_type_check;
ALTER TABLE public.automation_versions ADD CONSTRAINT automation_versions_trigger_type_check CHECK (trigger_type IN (
  'flyer_viewed', 'flyer_tapped', 'hotspot_clicked', 'qr_scanned',
  'form_submitted', 'contact_form_submitted', 'website_form_submitted',
  'lead_created', 'appointment_booked', 'appointment_request_submitted',
  'ticket_purchase_completed', 'flyer_shared', 'bizad_viewed',
  'bizad_action_clicked', 'date_time_reached', 'customer_action_completed'
));

ALTER TABLE public.automation_steps DROP CONSTRAINT IF EXISTS automation_steps_action_type_check;
ALTER TABLE public.automation_steps ADD CONSTRAINT automation_steps_action_type_check CHECK (action_type IS NULL OR action_type IN (
  'show_popup', 'open_url', 'open_internal_page', 'open_bizad',
  'open_phone_dialer', 'open_email', 'open_sms', 'send_sms',
  'save_lead', 'create_lead', 'update_lead', 'add_tag', 'remove_tag',
  'save_contact_activity', 'send_notification', 'send_email',
  'send_appointment_confirmation', 'send_ticket_confirmation',
  'trigger_webhook', 'update_record', 'wait', 'continue_workflow'
));
