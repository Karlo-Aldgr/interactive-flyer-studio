import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtorApplication } from "@/hooks/useRealtorApplication";
import { useIsRealtor } from "@/hooks/useIsRealtor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2, Home } from "lucide-react";

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Valid email required").max(255),
  brokerage: z.string().trim().max(150).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export default function RealtorApply() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRealtor } = useIsRealtor();
  const { application } = useRealtorApplication();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: user?.email ?? "",
    brokerage: "",
    license_number: "",
    phone: "",
    website: "",
    message: "",
  });

  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email! }));
    }
  }, [user?.email, form.email]);

  if (isRealtor) return <Navigate to="/realtor" replace />;

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("realtor_applications").insert({
      ...parsed.data,
      applicant_user_id: user?.id ?? null,
    } as any);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">Application received</h1>
          <p className="text-muted-foreground">
            Thanks! Our team will review your application and grant you Realtor Portal access shortly. If you don't already have an account, sign up using <strong>{form.email}</strong> so we can link them automatically.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild>
              <Link to={`/auth?mode=signup&next=/realtor&email=${encodeURIComponent(form.email)}`}>
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
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Apply for Realtor access</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Get a dedicated portal to manage your listings, photo galleries, and lead capture. We'll review your application and unlock your portal within 1 business day.
            </p>
          </div>

          {application?.status === "pending" && (
            <Card className="border-amber-400/50 bg-amber-500/5 p-4 text-sm">
              Your application is pending review. We'll email you once a decision is made.
            </Card>
          )}

          {application?.status === "rejected" && (
            <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Your previous application was not approved.</p>
              {application.review_notes?.trim() && (
                <p className="mt-1 text-muted-foreground">{application.review_notes}</p>
              )}
              <p className="mt-2 text-muted-foreground">You may submit a new application below.</p>
            </Card>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name *</Label>
                <Input id="full_name" value={form.full_name} onChange={update("full_name")} required maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={update("email")} required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brokerage">Brokerage</Label>
                <Input id="brokerage" value={form.brokerage} onChange={update("brokerage")} maxLength={150} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="license_number">License #</Label>
                <Input id="license_number" value={form.license_number} onChange={update("license_number")} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={update("phone")} maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" placeholder="https://" value={form.website} onChange={update("website")} maxLength={255} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Anything else? (optional)</Label>
              <Textarea id="message" value={form.message} onChange={update("message")} maxLength={1000} rows={3} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit application
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <Link to="/auth" className="underline">Sign in</Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
