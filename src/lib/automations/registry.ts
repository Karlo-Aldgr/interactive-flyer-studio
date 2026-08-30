import type { AutomationActionType, AutomationConditionOperator, AutomationTriggerType } from "./types";

type RegistryItem<T extends string> = {
  type: T;
  label: string;
  category: string;
  phase: "foundation" | "future";
  execution: "client" | "server" | "scheduler";
};
export const TRIGGER_REGISTRY: readonly RegistryItem<AutomationTriggerType>[] = [
  { type: "flyer_viewed", label: "Flyer viewed", category: "Flyer", phase: "foundation", execution: "server" },
  { type: "flyer_tapped", label: "Flyer tapped", category: "Flyer", phase: "foundation", execution: "server" },
  { type: "hotspot_clicked", label: "Hotspot clicked", category: "Flyer", phase: "foundation", execution: "server" },
  { type: "qr_scanned", label: "QR code scanned", category: "QR", phase: "future", execution: "server" },
  { type: "form_submitted", label: "Form submitted", category: "Lead", phase: "foundation", execution: "server" },
  { type: "lead_created", label: "Lead created", category: "Lead", phase: "foundation", execution: "server" },
  { type: "appointment_booked", label: "Appointment booked", category: "Booking", phase: "foundation", execution: "server" },
  { type: "flyer_shared", label: "Flyer shared", category: "Flyer", phase: "future", execution: "server" },
  { type: "bizad_viewed", label: "Business card viewed", category: "Business card", phase: "future", execution: "server" },
  { type: "bizad_action_clicked", label: "Business card action clicked", category: "Business card", phase: "future", execution: "server" },
  { type: "date_time_reached", label: "Date or time reached", category: "Schedule", phase: "future", execution: "scheduler" },
  { type: "customer_action_completed", label: "Customer action completed", category: "Customer", phase: "future", execution: "server" },
];

export const ACTION_REGISTRY: readonly RegistryItem<AutomationActionType>[] = [
  { type: "show_popup", label: "Show popup", category: "Display", phase: "foundation", execution: "client" },
  { type: "open_url", label: "Open URL", category: "Navigation", phase: "foundation", execution: "client" },
  { type: "open_internal_page", label: "Open Tap That Flyer page", category: "Navigation", phase: "foundation", execution: "client" },
  { type: "open_bizad", label: "Open digital business card", category: "Navigation", phase: "foundation", execution: "client" },
  { type: "open_phone_dialer", label: "Open phone dialer", category: "Contact", phase: "foundation", execution: "client" },
  { type: "open_email", label: "Open email", category: "Contact", phase: "foundation", execution: "client" },
  { type: "open_sms", label: "Open SMS", category: "Contact", phase: "foundation", execution: "client" },
  { type: "save_lead", label: "Save lead", category: "Lead", phase: "future", execution: "server" },
  { type: "update_lead", label: "Update lead", category: "Lead", phase: "future", execution: "server" },
  { type: "send_notification", label: "Send notification", category: "Messaging", phase: "future", execution: "server" },
  { type: "send_email", label: "Send email", category: "Messaging", phase: "future", execution: "server" },
  { type: "trigger_webhook", label: "Trigger webhook", category: "Integration", phase: "future", execution: "server" },
  { type: "update_record", label: "Update approved record", category: "Data", phase: "future", execution: "server" },
  { type: "wait", label: "Wait", category: "Flow", phase: "future", execution: "scheduler" },
  { type: "continue_workflow", label: "Continue workflow", category: "Flow", phase: "future", execution: "server" },
];

export const CONDITION_OPERATOR_LABELS: Record<AutomationConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  exists: "exists",
  not_exists: "does not exist",
  greater_than: "is greater than",
  greater_than_or_equal: "is at least",
  less_than: "is less than",
  less_than_or_equal: "is at most",
  before: "is before",
  after: "is after",
  in: "is one of",
  not_in: "is not one of",
};
