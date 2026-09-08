import { Link, useSearchParams } from "react-router-dom";
import { History, Workflow } from "lucide-react";
import { AutomationHistoryPanel } from "@/components/automation/AutomationHistoryPanel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { useAutomations } from "@/hooks/useAutomations";

export default function AutomationHistory() {
  const [searchParams] = useSearchParams();
  const { data: automations = [] } = useAutomations();
  return <DashboardShell><main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6"><PageHeader title="Automation history" description="Review authorized workflow executions and each ordered action result." actions={<Button asChild variant="outline"><Link to="/automations"><Workflow className="mr-1 h-4 w-4" />Automations</Link></Button>} /><div className="flex items-center gap-2 text-sm text-muted-foreground"><History className="h-4 w-4" />Sensitive provider data is redacted.</div><AutomationHistoryPanel automations={automations} initialAutomationId={searchParams.get("automation") ?? "all"} /></main></DashboardShell>;
}
