import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import {
  RESET_EMAIL_SENT_MESSAGE,
  buildPasswordResetRedirectUrl,
  sanitizeNextPath,
} from "@/lib/authUtils";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

export default function ForgotPassword() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const next = sanitizeNextPath(params.get("next"));

  if (loading) return null;
  if (user) return <Navigate to={next} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: buildPasswordResetRedirectUrl(next),
      });
      setSubmitted(true);
    } catch {
      // Always show the same message — never reveal whether the email exists.
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout
        title="Check your email"
        description={RESET_EMAIL_SENT_MESSAGE}
      >
        <div className="mt-6 space-y-4">
          <div className="flex justify-center">
            <MailCheck className="h-10 w-10 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Sent to <span className="font-medium text-foreground">{email}</span>
          </p>
          <Button asChild className="w-full">
            <Link to={`/auth?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password"
      description="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your registered email address"
          />
        </div>
        <Button type="submit" className="w-full shadow-glow" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reset link
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link to={`/auth?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
