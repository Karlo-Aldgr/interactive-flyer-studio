import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MarketingSubscriber,
  SOURCE_LABELS,
  fetchEmailLog,
  fetchSubscriberEvents,
} from "@/lib/marketing";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subscriber: MarketingSubscriber | null;
  clientName?: string;
};

export function SubscriberProfileDialog({ open, onOpenChange, subscriber, clientName }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !subscriber) return;
    fetchSubscriberEvents(subscriber.id).then(setEvents).catch(() => setEvents([]));
    fetchEmailLog(subscriber.client_id, subscriber.id).then(setEmails).catch(() => setEmails([]));
  }, [open, subscriber]);

  if (!subscriber) return null;

  const rows: [string, string][] = [
    ["Name", [subscriber.first_name, subscriber.last_name].filter(Boolean).join(" ") || "—"],
    ["Email", subscriber.email],
    ["Phone", subscriber.phone || "—"],
    ["Status", subscriber.status],
    ["Client", clientName || (subscriber.client_id ? "This account" : "TapThatFlyer platform")],
    ["Date subscribed", format(new Date(subscriber.created_at), "PPP")],
    ["Source", SOURCE_LABELS[subscriber.source] ?? subscriber.source],
    ["Flyer", subscriber.flyer_name || "—"],
    ["Signup location", subscriber.signup_location || "—"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscriber profile</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 break-words text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tags</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(subscriber.tags ?? []).length === 0 ? (
              <span className="text-sm text-muted-foreground">No tags</span>
            ) : (
              subscriber.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))
            )}
          </div>
        </div>

        {subscriber.notes && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{subscriber.notes}</p>
          </div>
        )}

        <Separator className="my-2" />

        <div>
          <h3 className="mb-2 text-sm font-semibold">Activity</h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 text-muted-foreground">
                    {format(new Date(e.created_at), "MMM d")}
                  </span>
                  <span>{e.description || e.event_type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 mt-4 text-sm font-semibold">Email history</h3>
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails sent yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {emails.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 text-muted-foreground">
                    {format(new Date(e.created_at), "MMM d")}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.subject}</span>
                  <Badge variant={e.status === "sent" ? "secondary" : "destructive"}>
                    {e.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
