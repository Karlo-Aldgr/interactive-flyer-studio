import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { isPasswordRecoveryUrl, sanitizeNextPath } from "@/lib/authUtils";

const passwordSchema = z
  .object({
    password: z.string().min(6, "At least 6 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function authHashError(): string | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const description = params.get("error_description");
  const code = params.get("error_code") || params.get("error");
  if (!description && !code) return null;
  if (description) return description.replace(/\+/g, " ");
  return code?.replace(/_/g, " ") ?? "Invalid reset link";
}

export default function ResetPassword() {
  const { user, loading, passwordRecovery } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [isRecovery, setIsRecovery] = useState(
    () => isPasswordRecoveryUrl() || passwordRecovery,
  );
  const [checking, setChecking] = useState(true);
  const [hashError, setHashError] = useState<string | null>(authHashError());

  const next = sanitizeNextPath(params.get("next"));

  useEffect(() => {
    const linkError = authHashError();
    if (linkError) {
      setHashError(linkError);
      setIsRecovery(false);
      setChecking(false);
      return;
    }

    if (isPasswordRecoveryUrl() || passwordRecovery) {
      setIsRecovery(true);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setHashError(null);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(() => {
      if (isPasswordRecoveryUrl()) {
        setIsRecovery(true);
      }
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [passwordRecovery]);

  useEffect(() => {
    if (passwordRecovery) setIsRecovery(true);
  }, [passwordRecovery]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Password updated. Please sign in with your new password.");
      navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
    } catch {
      toast.error("Unable to update password. Please request a new reset link.");
    } finally {
      setBusy(false);
    }
  };

  if (!isRecovery) {
    if (user) {
      return <Navigate to={next} replace />;
    }

    return (
      <AuthLayout
        title="Reset link expired"
        description={
          hashError ||
          "This password reset link is invalid or has expired. Request a new link from the same site where you signed in."
        }
      >
        <div className="mt-6 space-y-3">
          <Button asChild className="w-full">
            <Link to={`/auth/forgot-password?next=${encodeURIComponent(next)}`}>
              Request a new link
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to={`/auth?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" description="Choose a new password for your account.">
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full shadow-glow" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
