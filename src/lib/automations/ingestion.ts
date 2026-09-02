import { supabase } from "@/integrations/supabase/client";

export type AutomationDelivery =
  | { type: "show_popup"; title?: string; message: string }
  | { type: "open_url"; url: string };

type PublicAutomationEvent = {
  eventType: string;
  sourceType: "flyer" | "bizad" | "appointment" | "subscriber" | "form_submission" | "qr";
  sourceId: string;
  clientEventId?: string;
  occurredAt?: string;
  actor?: Record<string, string | undefined>;
  metadata?: Record<string, string | number | boolean | undefined>;
};

export async function ingestAutomationEvent(event: PublicAutomationEvent): Promise<AutomationDelivery[]> {
  const clientEventId = event.clientEventId || crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke("automation-engine", {
    body: { ...event, clientEventId },
  });
  if (error) {
    console.warn("[automation] event ingestion failed", error.message);
    return [];
  }
  return Array.isArray(data?.deliveries) ? data.deliveries : [];
}

export function deliverAutomationResults(deliveries: AutomationDelivery[], showMessage: (title: string, message: string) => void) {
  for (const delivery of deliveries) {
    if (delivery.type === "show_popup") showMessage(delivery.title || "Message", delivery.message);
    if (delivery.type === "open_url") {
      const url = delivery.url;
      if (url.startsWith("/") && !url.startsWith("//")) window.location.assign(url);
      else {
        try {
          const parsed = new URL(url);
          if (parsed.protocol === "https:" || parsed.protocol === "http:") window.open(parsed.toString(), "_blank", "noopener,noreferrer");
        } catch { /* server delivery is ignored if malformed */ }
      }
    }
  }
}
