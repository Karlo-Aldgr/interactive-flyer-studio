import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Home } from "lucide-react";
import { checkIsAdmin } from "@/lib/roles";
import { AdminLayout } from "@/components/admin/AdminLayout";

type Editor = { user_id: string; email: string; granted_at: string };

export default function AdminEditors() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [realtorEmail, setRealtorEmail] = useState("");
  const [realtorBusy, setRealtorBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkIsAdmin(user.id).then((ok) => {
        setIsAdmin(ok);
        if (!ok) navigate("/dashboard");
      });
  }, [user, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_editors" as any);
    if (error) toast.error(error.message);
    else setEditors((data ?? []) as Editor[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("grant_editor_by_email" as any, { _email: email.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) return toast.error(res?.error ?? "Failed");
    toast.success("Editor access granted");
    setEmail("");
    load();
  };

  const revoke = async (em: string) => {
    if (!confirm(`Revoke editor access for ${em}?`)) return;
    const { data, error } = await supabase.rpc("revoke_editor_by_email" as any, { _email: em });
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) return toast.error(res?.error ?? "Failed");
    toast.success("Revoked");
    load();
  };

  if (isAdmin === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <AdminLayout active="editors">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Editor access</h1>
        <p className="mt-1 text-muted-foreground">
          New customers sign up to submit a job and don't get editor access by default.
          Grant editor access here by email after you've reviewed their order.
        </p>

        <Card className="mt-8 p-6">
          <Label htmlFor="email">Grant editor access by email</Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && grant()}
            />
            <Button onClick={grant} disabled={busy || !email.trim()} className="w-full sm:w-auto">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Grant
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">The email must belong to an account that has already signed up.</p>
        </Card>

        <Card className="mt-6 p-6">
          <Label htmlFor="realtor-email" className="flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />Grant realtor access by email
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">Realtors get their own portal at <code>/realtor</code> with listings and a per-property photo gallery.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="realtor-email"
              type="email"
              placeholder="agent@example.com"
              value={realtorEmail}
              onChange={(e) => setRealtorEmail(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={realtorBusy || !realtorEmail.trim()}
              onClick={async () => {
                setRealtorBusy(true);
                const { data, error } = await supabase.rpc("grant_realtor_by_email" as any, { _email: realtorEmail.trim() });
                setRealtorBusy(false);
                if (error) return toast.error(error.message);
                const res = data as { ok: boolean; error?: string };
                if (!res?.ok) return toast.error(res?.error ?? "Failed");
                toast.success("Realtor access granted");
                setRealtorEmail("");
              }}
              className="w-full sm:w-auto"
            >
              {realtorBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Home className="mr-2 h-4 w-4" />}
              Grant realtor
            </Button>
          </div>
        </Card>

        <h2 className="mt-10 font-display text-xl font-semibold">Editors ({editors.length})</h2>
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : editors.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No editors yet.</Card>
          ) : (
            editors.map((e) => (
              <Card key={e.user_id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.email}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke(e.email)} className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" />Revoke
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
