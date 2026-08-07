import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import {
  type ApiKeyRow,
  type ApiRequestLogRow,
  createApiKey,
  externalApiEndpoint,
  listApiKeys,
  listApiRequestLogs,
  revokeApiKey,
} from "@/lib/apiKeys";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
}

export function ApiManagementDialog({ open, onOpenChange, ownerId }: Props) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [logs, setLogs] = useState<ApiRequestLogRow[]>([]);
  const [label, setLabel] = useState("Make.com");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [k, l] = await Promise.all([listApiKeys(ownerId), listApiRequestLogs(ownerId)]);
      setKeys(k);
      setLogs(l);
    } catch (err) {
      toast({ title: "Could not load API keys", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (open) void refresh();
    if (!open) setNewKey(null);
  }, [open, refresh]);

  async function handleCreate() {
    setCreating(true);
    try {
      const { rawKey } = await createApiKey(ownerId, label);
      setNewKey(rawKey);
      await refresh();
    } catch (err) {
      toast({ title: "Could not create key", description: String(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeApiKey(id);
      toast({ title: "Key revoked" });
      await refresh();
    } catch (err) {
      toast({ title: "Could not revoke key", description: String(err), variant: "destructive" });
    }
  }

  function copy(value: string, what: string) {
    navigator.clipboard.writeText(value).then(
      () => toast({ title: `${what} copied` }),
      () => toast({ title: "Copy failed", variant: "destructive" }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            External publishing API
          </DialogTitle>
          <DialogDescription>
            Create API keys so Make.com, n8n, Zapier or your own app can publish to your connected
            Facebook, Instagram and TikTok accounts. No re-connecting needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
            <div className="mb-1 font-medium text-foreground">Endpoint</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-muted-foreground">
                POST {externalApiEndpoint()}
              </code>
              <Button size="sm" variant="ghost" onClick={() => copy(externalApiEndpoint(), "Endpoint")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-1 text-muted-foreground">
              Send your key in the <code>X-API-Key</code> header.
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="api-key-label">Key label</Label>
              <Input
                id="api-key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Make.com scenario"
                maxLength={60}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create key
            </Button>
          </div>

          {newKey && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <div className="mb-1 text-sm font-medium">
                Copy this key now — it is shown only once.
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs">{newKey}</code>
                <Button size="sm" variant="secondary" onClick={() => copy(newKey, "API key")}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>
          )}

          <Separator />

          <div>
            <div className="mb-2 text-sm font-medium">Your keys</div>
            {loading && keys.length === 0 && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && keys.length === 0 && (
              <div className="text-sm text-muted-foreground">No keys yet.</div>
            )}
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{k.label}</span>
                      {k.revoked_at
                        ? <Badge variant="outline">Revoked</Badge>
                        : <Badge variant="secondary">Active</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {k.key_prefix}… · created {new Date(k.created_at).toLocaleDateString()}
                      {k.last_used_at
                        ? ` · last used ${new Date(k.last_used_at).toLocaleString()}`
                        : " · never used"}
                    </div>
                  </div>
                  {!k.revoked_at && (
                    <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 text-sm font-medium">Recent API calls</div>
            {logs.length === 0
              ? <div className="text-sm text-muted-foreground">No calls yet.</div>
              : (
                <div className="space-y-1 text-xs">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1"
                    >
                      <span className="truncate">
                        {new Date(log.created_at).toLocaleString()} · {log.platforms.join(", ") || "—"}
                      </span>
                      <span className="flex items-center gap-2">
                        {log.duration_ms != null && (
                          <span className="text-muted-foreground">{log.duration_ms}ms</span>
                        )}
                        <Badge variant={log.status === "success" ? "secondary" : "outline"}>
                          {log.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
