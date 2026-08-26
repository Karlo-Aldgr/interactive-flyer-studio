import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AudienceRules,
  AudienceScope,
  EMPTY_RULES,
  MarketingAudience,
  MarketingClient,
  deleteAudience,
  evaluateClientRules,
  evaluateSubscriberRules,
  fetchAudiences,
  fetchSubscribers,
  saveAudience,
} from "@/lib/marketing";
import { AudienceRulesEditor } from "./AudienceRulesEditor";

type Props = {
  clientId: string | null | undefined;
  isAdmin?: boolean;
  clients?: MarketingClient[];
};

export function AudiencesPanel({ clientId, isAdmin, clients = [] }: Props) {
  const [rows, setRows] = useState<MarketingAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingAudience | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<AudienceScope>("subscriber");
  const [rules, setRules] = useState<AudienceRules>(EMPTY_RULES);
  const [preview, setPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAudiences(clientId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load audiences");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setScope("subscriber");
    setRules(EMPTY_RULES);
    setPreview(null);
    setOpen(true);
  };

  const openEdit = (a: MarketingAudience) => {
    setEditing(a);
    setName(a.name);
    setDescription(a.description ?? "");
    setScope(a.scope);
    setRules((a.rules as AudienceRules) ?? EMPTY_RULES);
    setPreview(null);
    setOpen(true);
  };

  const runPreview = async () => {
    try {
      if (scope === "client") {
        setPreview(evaluateClientRules(clients, rules).length);
        return;
      }
      const subs = await fetchSubscribers({ clientId });
      setPreview(evaluateSubscriberRules(subs, rules).length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give this audience a name");
      return;
    }
    setSaving(true);
    try {
      await saveAudience({
        id: editing?.id,
        client_id: clientId === undefined ? null : clientId,
        name,
        description: description.trim() || null,
        scope,
        rules,
      });
      toast.success("Audience saved");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save audience");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: MarketingAudience) => {
    if (!confirm(`Delete audience "${a.name}"?`)) return;
    try {
      await deleteAudience(a.id);
      toast.success("Audience deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete audience");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Saved filters you can target when sending a campaign.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New audience
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="py-14 text-center text-sm text-muted-foreground">
          No audiences yet. Create one to target campaigns.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{a.name}</p>
                  {a.description && (
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                  )}
                </div>
                <Badge variant="outline">
                  {a.scope === "client" ? "Clients" : "Subscribers"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {(a.rules as AudienceRules)?.conditions?.length ?? 0} condition(s) ·{" "}
                {(a.rules as AudienceRules)?.match === "any" ? "match any" : "match all"}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove(a)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit audience" : "New audience"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {isAdmin && (
                <div>
                  <Label>Targets</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as AudienceScope)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscriber">Subscribers</SelectItem>
                      <SelectItem value="client">Clients</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <AudienceRulesEditor scope={scope} rules={rules} onChange={setRules} />
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={runPreview}>
                Preview matches
              </Button>
              {preview !== null && (
                <span className="text-sm text-muted-foreground">
                  {preview} {scope === "client" ? "client(s)" : "subscriber(s)"} match
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save audience"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
