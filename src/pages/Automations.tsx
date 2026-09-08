import { Link, useNavigate } from "react-router-dom";
import { Archive, Copy, History, Loader2, Pause, Play, Plus, Send, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { CustomerPortalShell } from "@/components/portal-customer/CustomerPortalShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useActivateAutomation, useArchiveAutomation, useAutomations, useDeleteAutomation, useDuplicateAutomation,
  useLatestAutomationExecutions, usePauseAutomation, usePublishAutomation,
} from "@/hooks/useAutomations";
import { ACTION_REGISTRY, TRIGGER_REGISTRY } from "@/lib/automations/registry";
import type { Automation } from "@/lib/automations/types";

const statusVariant = { active: "default", paused: "secondary", draft: "outline", archived: "outline" } as const;

export default function Automations() {
  const navigate = useNavigate();
  const { data: automations = [], isLoading, error } = useAutomations();
  const duplicateMutation = useDuplicateAutomation();
  const deleteMutation = useDeleteAutomation();
  const activateMutation = useActivateAutomation();
  const pauseMutation = usePauseAutomation();
  const archiveMutation = useArchiveAutomation();
  const publishMutation = usePublishAutomation();
  const { data: latestExecutions = [] } = useLatestAutomationExecutions();

  const run = async (operation: () => Promise<unknown>, success: string) => {
    try { await operation(); toast.success(success); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not update automation"); }
  };

  const duplicate = async (automation: Automation) => {
    try {
      const copy = await duplicateMutation.mutateAsync(automation);
      toast.success("Automation duplicated as a draft");
      navigate(`/automations/${copy.id}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not duplicate automation");
    }
  };

  return (
    <CustomerPortalShell maxWidth="6xl">
      <div className="space-y-6">
        <PageHeader title="Automations" description="Build simple IF → THEN workflows for your flyers, leads, bookings, and business cards." actions={<div className="flex gap-2"><Button asChild variant="outline"><Link to="/automation-history"><History className="mr-1 h-4 w-4" />History</Link></Button><Button asChild><Link to="/automations/new"><Plus className="mr-1 h-4 w-4" />New automation</Link></Button></div>} />
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">Automation execution is available for connected trusted events. Provider-backed and scheduled actions clearly remain configuration-dependent until staging validation and provider setup are complete.</div>
        {isLoading ? <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : error ? <Card><CardContent className="p-6 text-sm text-destructive">{error.message}</CardContent></Card> : automations.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><div className="rounded-2xl bg-primary/10 p-4 text-primary"><Workflow className="h-8 w-8" /></div><h2 className="mt-4 text-xl font-semibold">Create your first automation</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Choose a trigger, add optional conditions, and stack actions in the order they should happen.</p><Button asChild className="mt-5"><Link to="/automations/new"><Plus className="mr-1 h-4 w-4" />Create automation</Link></Button></CardContent></Card> : <div className="grid gap-4">
          {automations.map((automation) => {
            const trigger = TRIGGER_REGISTRY.find((item) => item.type === automation.trigger_type)?.label ?? automation.trigger_type;
            const actionLabels = automation.draft_definition.steps.map((step) => ACTION_REGISTRY.find((item) => item.type === step.actionType)?.label ?? step.actionType).filter(Boolean);
            const latest = latestExecutions.find((execution) => execution.automation_id === automation.id);
            const busy = duplicateMutation.isPending || deleteMutation.isPending || activateMutation.isPending || pauseMutation.isPending || archiveMutation.isPending || publishMutation.isPending;
            return <Card key={automation.id}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link to={`/automations/${automation.id}`} className="truncate text-lg font-semibold hover:text-primary hover:underline">{automation.name}</Link><Badge variant={statusVariant[automation.status]}>{automation.status[0].toUpperCase() + automation.status.slice(1)}</Badge></div>{automation.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{automation.description}</p>}<div className="mt-3 grid gap-2 text-sm sm:grid-cols-4"><div><span className="text-xs uppercase tracking-wide text-muted-foreground">IF</span><p className="font-medium">{trigger}</p></div><div><span className="text-xs uppercase tracking-wide text-muted-foreground">THEN</span><p className="font-medium">{actionLabels.length ? actionLabels.join(" → ") : "No actions"}</p></div><div><span className="text-xs uppercase tracking-wide text-muted-foreground">Last run</span><p className="font-medium">{latest ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(latest.created_at)) : "Never"}</p>{latest && <Badge className="mt-1" variant={latest.status === "failed" ? "destructive" : "secondary"}>{latest.status}</Badge>}</div><div><span className="text-xs uppercase tracking-wide text-muted-foreground">Updated</span><p className="font-medium">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(automation.updated_at))}</p></div></div></div><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to={`/automations/${automation.id}`}>Edit</Link></Button><Button asChild size="sm" variant="outline"><Link to={`/automation-history?automation=${automation.id}`}><History className="mr-1 h-4 w-4" />History</Link></Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void duplicate(automation)}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>{automation.status === "draft" && <Button size="sm" variant="outline" disabled={busy || automation.draft_definition.steps.length === 0} onClick={() => void run(() => publishMutation.mutateAsync(automation.id), "New version published")}><Send className="mr-1 h-4 w-4" />Publish</Button>}{automation.status === "active" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => pauseMutation.mutateAsync(automation.id), "Automation paused")}><Pause className="mr-1 h-4 w-4" />Pause</Button> : automation.status !== "archived" && <Button size="sm" disabled={busy || automation.draft_definition.steps.length === 0} onClick={() => void run(() => activateMutation.mutateAsync(automation.id), "Automation activated")}><Play className="mr-1 h-4 w-4" />Activate</Button>}{automation.status === "draft" && !automation.published_version_id ? <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive" disabled={busy}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete “{automation.name}”?</AlertDialogTitle><AlertDialogDescription>This permanently deletes this unpublished draft. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void run(() => deleteMutation.mutateAsync(automation.id), "Automation deleted")}>Delete draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : automation.status !== "archived" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => archiveMutation.mutateAsync(automation.id), "Automation archived")}><Archive className="mr-1 h-4 w-4" />Archive</Button>}</div></div></CardContent></Card>;
          })}
        </div>}
      </div>
    </CustomerPortalShell>
  );
}
