import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2, Plus, RefreshCw, Table2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTOMATION_STATUSES,
  createAutomationRequest,
  deleteAutomationRequest,
  generateAutomationScripts,
  loadAutomationRequests,
  syncAutomationRequestToSheet,
  updateAutomationRequest,
  type AutomationScriptRequest,
} from "@/lib/automationScripts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyerId: string;
  ownerId: string;
  /** Staff (admin/editor) get status + internal notes controls. */
  isStaff?: boolean;
};

const FIELDS: Array<{ key: keyof AutomationScriptRequest; label: string; rows?: number }> = [
  { key: "facebook_post", label: "Facebook post", rows: 4 },
  { key: "instagram_caption", label: "Instagram caption", rows: 4 },
  { key: "tiktok_caption", label: "TikTok caption", rows: 3 },
  { key: "email_subject", label: "Email subject", rows: 2 },
  { key: "email_body", label: "Email body", rows: 5 },
  { key: "sms_body", label: "SMS message", rows: 3 },
];

export function AutomationScriptsDialog({ open, onOpenChange, flyerId, ownerId, isStaff }: Props) {
  const [requests, setRequests] = useState<AutomationScriptRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRequest, setNewRequest] = useState("");
  const [priority, setPriority] = useState("normal");
  const [drafts, setDrafts] = useState<Record<string, Partial<AutomationScriptRequest>>>({});

  const load = async () => {
    setLoading(true);
    try {
      setRequests(await loadAutomationRequests(flyerId));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flyerId]);

  const patch = (id: string, key: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  const valueOf = (req: AutomationScriptRequest, key: keyof AutomationScriptRequest) => {
    const draft = drafts[req.id] as Record<string, unknown> | undefined;
    const v = draft && key in draft ? draft[key as string] : req[key];
    return (v as string) ?? "";
  };

  const submitNew = async () => {
    setCreating(true);
    try {
      await createAutomationRequest({
        flyerId,
        ownerId,
        customRequest: newRequest.trim(),
        priority,
      });
      setNewRequest("");
      setPriority("normal");
      toast.success("Automation request submitted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const run = async (id: string, fn: () => Promise<unknown>, okMessage: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMessage);
      setDrafts((d) => ({ ...d, [id]: {} }));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Automation scripts</DialogTitle>
          <DialogDescription>
            Request marketing scripts for this flyer. AI drafts captions for every channel, you can
            edit them, and each request is exported to the master Google Sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <Label htmlFor="automation-request">New automation request</Label>
          <Textarea
            id="automation-request"
            rows={3}
            value={newRequest}
            maxLength={2000}
            placeholder="Tell us what you want automated — e.g. weekly specials posts, event countdown, follow-up SMS after orders…"
            onChange={(e) => setNewRequest(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40 space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={submitNew} disabled={creating || !newRequest.trim()}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Submit request
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No automation requests yet for this flyer.
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={req.status === "fulfilled" ? "default" : "secondary"}>
                      {req.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline">{req.priority}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleString()}
                    </span>
                    {req.sheet_synced_at && (
                      <span className="text-xs text-muted-foreground">
                        · Sheet row {req.sheet_row ?? "—"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === req.id}
                      onClick={() =>
                        run(req.id, () => generateAutomationScripts(req.id), "Scripts drafted")
                      }
                    >
                      {busyId === req.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-4 w-4" />
                      )}
                      AI draft
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === req.id}
                      onClick={() =>
                        run(req.id, () => syncAutomationRequestToSheet(req.id), "Synced to sheet")
                      }
                    >
                      <Table2 className="mr-1 h-4 w-4" />
                      Sync
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={busyId === req.id}
                      onClick={() =>
                        run(req.id, () => deleteAutomationRequest(req.id), "Request deleted")
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {req.custom_request && (
                  <p className="rounded-md bg-muted p-3 text-sm">{req.custom_request}</p>
                )}
                {req.sheet_error && (
                  <p className="text-xs text-destructive">Sheet sync: {req.sheet_error}</p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <div key={f.key as string} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      {f.key === "email_subject" ? (
                        <Input
                          value={valueOf(req, f.key)}
                          onChange={(e) => patch(req.id, f.key as string, e.target.value)}
                        />
                      ) : (
                        <Textarea
                          rows={f.rows}
                          value={valueOf(req, f.key)}
                          onChange={(e) => patch(req.id, f.key as string, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {isStaff && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={(valueOf(req, "status") as string) || req.status}
                        onValueChange={(v) => patch(req.id, "status", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AUTOMATION_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Internal notes</Label>
                      <Textarea
                        rows={2}
                        value={valueOf(req, "staff_notes")}
                        onChange={(e) => patch(req.id, "staff_notes", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={busyId === req.id || !drafts[req.id]}
                    onClick={() =>
                      run(
                        req.id,
                        async () => {
                          await updateAutomationRequest(req.id, drafts[req.id] ?? {});
                          await syncAutomationRequestToSheet(req.id).catch(() => undefined);
                        },
                        "Saved",
                      )
                    }
                  >
                    {busyId === req.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-4 w-4" />
                    )}
                    Save changes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
