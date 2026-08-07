import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { checkIsAdmin } from "@/lib/roles";

const SETTING_KEY = "automation_master_sheet_id";

type Row = {
  id: string;
  flyer_id: string;
  status: string;
  priority: string;
  custom_request: string | null;
  sheet_row: number | null;
  sheet_synced_at: string | null;
  sheet_error: string | null;
  created_at: string;
};

export default function AdminAutomation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    checkIsAdmin(user.id).then(setIsAdmin);
  }, [user]);

  useEffect(() => {
    if (isAdmin === false) navigate("/dashboard", { replace: true });
    if (!isAdmin) return;
    (async () => {
      const [{ data: setting }, { data: reqs }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle(),
        supabase
          .from("automation_script_requests")
          .select("id, flyer_id, status, priority, custom_request, sheet_row, sheet_synced_at, sheet_error, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      setSpreadsheetId(((setting?.value as any)?.spreadsheet_id as string) ?? "");
      setRows((reqs ?? []) as Row[]);
      setLoading(false);
    })();
  }, [isAdmin, navigate]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: SETTING_KEY, value: { spreadsheet_id: spreadsheetId.trim() } });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Master spreadsheet saved");
  };

  if (!isAdmin || loading) {
    return (
      <AdminLayout active="automation" title="Automation">
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="automation" title="Automation">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Master Google Sheet</CardTitle>
            <CardDescription>
              Every automation script request is appended to the tab “Automation Requests” in this
              spreadsheet. Paste the spreadsheet ID from its URL
              (docs.google.com/spreadsheets/d/<strong>ID</strong>/edit).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="sheet-id">Spreadsheet ID</Label>
              <Input
                id="sheet-id"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent script requests</CardTitle>
            <CardDescription>{rows.length} most recent requests across all flyers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No automation requests yet.</p>
            )}
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{r.custom_request || "AI-drafted scripts"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · flyer {r.flyer_id.slice(0, 8)}
                  </p>
                  {r.sheet_error && <p className="text-xs text-destructive">{r.sheet_error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.priority}</Badge>
                  <Badge>{r.status.replace("_", " ")}</Badge>
                  <Badge variant="secondary">
                    {r.sheet_synced_at ? `Sheet row ${r.sheet_row ?? "—"}` : "Not synced"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
