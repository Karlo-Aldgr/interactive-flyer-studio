import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CustomerPortalShell } from "@/components/portal-customer/CustomerPortalShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutomationBuilderForm } from "@/components/automation/AutomationBuilderForm";
import { useAutomation } from "@/hooks/useAutomations";

export default function AutomationBuilder() {
  const { automationId } = useParams<{ automationId: string }>();
  const navigate = useNavigate();
  const isNew = !automationId;
  const { data: automation, isLoading, error } = useAutomation(automationId);

  return (
    <CustomerPortalShell maxWidth="6xl">
      <div className="space-y-6">
        <PageHeader title={<span className="flex flex-wrap items-center gap-2">{isNew ? "New automation" : "Edit automation"}{automation && <Badge variant={automation.status === "active" ? "default" : automation.status === "paused" ? "secondary" : "outline"}>{automation.status}</Badge>}</span>} description="Build the workflow visually. Saving or activating never changes another account’s data." actions={<Button asChild variant="outline"><Link to="/automations"><ArrowLeft className="mr-1 h-4 w-4" />All automations</Link></Button>} />
        {!isNew && isLoading ? <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : !isNew && (error || !automation) ? <Card><CardContent className="p-6"><p className="text-sm text-destructive">{error?.message ?? "Automation not found or you do not have access."}</p></CardContent></Card> : <AutomationBuilderForm automation={automation} onSaved={(saved) => { if (isNew) navigate(`/automations/${saved.id}`, { replace: true }); }} />}
      </div>
    </CustomerPortalShell>
  );
}
