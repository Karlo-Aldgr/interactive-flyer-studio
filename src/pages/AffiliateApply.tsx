import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, BadgeDollarSign, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliate } from "@/hooks/useAffiliate";
import { submitAffiliateApplication } from "@/lib/affiliates";

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  audience: z.string().trim().max(500).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export default function AffiliateApply() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAffiliate, application } = useAffiliate();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: user?.email ?? "",
    phone: "",
    website: "",
    audience: "",
    message: "",
  });

  useEffect(() => {
    document.title = "Apply as an affiliate | TapThatFlyer";
    if (user?.email) setForm((f) => (f.email ? f : { ...f, email: user.email! }));
  }, [user?.email]);

  if (isAffiliate) return <Navigate to="/affiliate/dashboard" replace />;

  const update =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    try {
      await submitAffiliateApplication({
        ...(parsed.data as {
          full_name: string;
          email: string;
          phone?: string;
          website?: string;
          audience?: string;
          message?: string;
        }),
        applicant_user_id: user?.id ?? null,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not submit application");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md space-y-4 p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">Application received</h1>
          <p className="text-muted-foreground">
            Thanks! We'll review your application and unlock your affiliate dashboard shortly. If you don't have an
            account yet, sign up with <strong>{form.email}</strong> so we can link them automatically.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild>
              <Link to={`/auth?mode=signup&next=/affiliate/dashboard&email=${encodeURIComponent(form.email)}`}>
                Create an account
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Card className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Apply for the affiliate program</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Share TapThatFlyer with your network and earn commissions. We review applications within 1 business day.
            </p>
          </div>

          {application?.status === "pending" ? (
            <div className="space-y-4">
              <Card className="border-amber-400/50 bg-amber-500/5 p-4 text-sm">
                Your application is <strong>under review</strong>. We'll email you once a decision is made.
              </Card>
              <Button asChild variant="outline" className="w-full">
                <Link to="/affiliate/dashboard">Go to affiliate dashboard</Link>
              </Button>
            </div>
          ) : (
          <>
          {application?.status === "rejected" && (
            <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm">
              {application.review_notes?.trim() || "Your previous application was not approved."}
            </Card>
          )}

          <form onSubmit={submit} className="space-y-4">

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name *</Label>
                <Input id="full_name" value={form.full_name} onChange={update("full_name")} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={update("email")} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={update("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website or social profile</Label>
                <Input id="website" value={form.website} onChange={update("website")} placeholder="https://" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audience">Who is your audience?</Label>
              <Textarea
                id="audience"
                value={form.audience}
                onChange={update("audience")}
                rows={3}
                placeholder="Local restaurants, realtors, event promoters…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Anything else?</Label>
              <Textarea id="message" value={form.message} onChange={update("message")} rows={3} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit application
            </Button>
          </form>
          </>
          )}
        </Card>

      </div>
    </div>
  );
}
