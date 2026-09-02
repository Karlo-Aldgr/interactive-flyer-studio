import { AutomationHistoryPanel } from "@/components/automation/AutomationHistoryPanel";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAutomations } from "@/hooks/useAutomations";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function AdminAutomationHistory() {
  const { isAdmin, loading } = useIsAdmin();
  const { data: automations = [] } = useAutomations();
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <AdminLayout active="automation-history"><div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6"><div><h1 className="text-2xl font-bold">Automation support history</h1><p className="text-sm text-muted-foreground">Read-only execution visibility across customer accounts for support.</p></div><AutomationHistoryPanel automations={automations} supportMode /></div></AdminLayout>;
}
