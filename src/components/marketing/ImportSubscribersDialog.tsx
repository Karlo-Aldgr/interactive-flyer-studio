import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseSubscriberCsv, type ParsedImportRow } from "@/lib/marketing";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | null;
  onImported: () => void;
};

type Summary = { imported: number; updated: number; skipped: number; failed: number };

export function ImportSubscribersDialog({ open, onOpenChange, clientId, onImported }: Props) {
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseSubscriberCsv(text);
    if (parsed.rows.length === 0 && parsed.invalid === 0) {
      toast.error("Could not find an Email column in that CSV.");
      return;
    }
    setRows(parsed.rows);
    setInvalid(parsed.invalid);
    setSummary(null);
  };

  const runImport = async () => {
    setBusy(true);
    const result: Summary = { imported: 0, updated: 0, skipped: 0, failed: invalid };
    try {
      let existingQ = supabase.from("marketing_subscribers").select("id, email").limit(5000);
      existingQ = clientId ? existingQ.eq("client_id", clientId) : existingQ.is("client_id", null);
      const { data: existing } = await existingQ;
      const byEmail = new Map(
        (existing ?? []).map((r: any) => [String(r.email).toLowerCase(), r.id as string]),
      );

      const seen = new Set<string>();
      for (const row of rows) {
        if (seen.has(row.email)) {
          result.skipped++;
          continue;
        }
        seen.add(row.email);
        const existingId = byEmail.get(row.email);
        if (existingId) {
          const { error } = await supabase
            .from("marketing_subscribers")
            .update({
              first_name: row.first_name || null,
              last_name: row.last_name || null,
              phone: row.phone || null,
              tags: row.tags,
            })
            .eq("id", existingId);
          error ? result.failed++ : result.updated++;
        } else {
          const { data, error } = await supabase
            .from("marketing_subscribers")
            .insert({
              client_id: clientId,
              email: row.email,
              first_name: row.first_name || null,
              last_name: row.last_name || null,
              phone: row.phone || null,
              tags: row.tags,
              source: "import",
              status: "active",
            })
            .select("id")
            .single();
          if (error || !data) result.failed++;
          else {
            result.imported++;
            await supabase.from("marketing_subscriber_events").insert({
              subscriber_id: data.id,
              client_id: clientId,
              event_type: "subscribed",
              description: "Imported from CSV",
            });
          }
        }
      }
      setSummary(result);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import subscribers</DialogTitle>
          <DialogDescription>
            CSV with columns: First Name, Last Name, Email, Phone, Tags. Existing emails are updated,
            not duplicated.
          </DialogDescription>
        </DialogHeader>

        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />

        {rows.length > 0 && !summary && (
          <p className="text-sm text-muted-foreground">
            {rows.length} valid row{rows.length === 1 ? "" : "s"} ready
            {invalid > 0 ? ` · ${invalid} invalid row(s) will be skipped` : ""}.
          </p>
        )}

        {summary && (
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["Imported", summary.imported],
              ["Updated", summary.updated],
              ["Skipped", summary.skipped],
              ["Failed", summary.failed],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-border/60 p-3">
                <p className="text-lg font-semibold">{value as number}</p>
                <p className="text-xs text-muted-foreground">{label as string}</p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={runImport} disabled={busy || rows.length === 0 || !!summary}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
