import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { checkIsAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, MailCheck, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import {
  LOGIN_ERROR_MESSAGE,
  SIGNUP_DUPLICATE_MESSAGE,
  buildAuthRedirectUrl,
  buildPasswordResetRedirectUrl,
  clearAuthCallbackErrorFromUrl,
  isPasswordRecoveryUrl,
  isSignupDuplicate,
  parseAuthCallbackError,
  passwordRecoveryRedirectPath,
  sanitizeNextPath,
  resolveAuthNext,
} from "@/lib/authUtils";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const signupSchema = loginSchema
  .extend({
    fullName: z.string().trim().min(1, "Enter your full name").max(120),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function Auth() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verificationPending, setVerificationPending] = useState<string | null>(null);

  const next = resolveAuthNext(params);
  const nextIsExplicit = !!params.get("next");
  const [adminRedirect, setAdminRedirect] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user || nextIsExplicit) return;
    checkIsAdmin(user.id).then((isAdmin) => {
      if (!cancelled && isAdmin) setAdminRedirect("/admin/jobs");
    });
    return () => { cancelled = true; };
  }, [user, nextIsExplicit]);

  const resolveDestination = async (): Promise<string> => {
    if (nextIsExplicit && next !== "/dashboard") return next;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && (await checkIsAdmin(session.user.id))) return "/admin/jobs";
    } catch {/* ignore */}
    return next;
  };

  useEffect(() => {
    const oauthError = parseAuthCallbackError();
    if (oauthError) {
      toast.error(oauthError);
      clearAuthCallbackErrorFromUrl();
    }
  }, []);

  if (verificationPending) {
    return (
      <AuthLayout
        title="Check your email"
        description="We sent a verification link to complete your registration."
      >
        <div className="mt-6 space-y-4">
          <div className="flex justify-center">
            <MailCheck className="h-10 w-10 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Open the link sent to{" "}
            <span className="font-medium text-foreground">{verificationPending}</span>{" "}
            to verify your account, then you&apos;ll be redirected to continue.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setVerificationPending(null);
              setTab("signin");
            }}
          >
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isPasswordRecoveryUrl()) {
    return <Navigate to={passwordRecoveryRedirectPath()} replace />;
  }
  if (user) return <Navigate to={adminRedirect ?? next} replace />;

  const handleSignIn = async () => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        toast.error(LOGIN_ERROR_MESSAGE);
        return;
      }
      navigate(await resolveDestination());
    } catch {
      toast.error(LOGIN_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    const parsed = signupSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: buildAuthRedirectUrl(next),
          data: { full_name: parsed.data.fullName.trim() },
        },
      });

      if (isSignupDuplicate(data.user, error)) {
        toast.error(SIGNUP_DUPLICATE_MESSAGE);
        setTab("signin");
        return;
      }

      if (error) {
        toast.error(error.message ?? "Unable to create account. Please try again.");
        return;
      }

      // Prevent immediate dashboard access when email confirmation is disabled in dev.
      if (data.session) {
        await supabase.auth.signOut();
      }

      setVerificationPending(parsed.data.email);
    } catch {
      toast.error("Unable to create account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgotHref = `/auth/forgot-password?next=${encodeURIComponent(next)}`;

  return (
    <AuthLayout
      title="Welcome to TapThatFlyer"
      description="Sign in or create an account to start designing."
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your existing email address"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="signin-pw">Password</Label>
              <Link to={forgotHref} className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="signin-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
            />
          </div>
          <Button className="w-full shadow-glow" disabled={busy} onClick={handleSignIn}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignInButton next={next} busy={busy} setBusy={setBusy} />
        </TabsContent>

        <TabsContent value="signup" className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-name">Full name</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your existing email address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-pw">Password</Label>
            <Input
              id="signup-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-confirm">Confirm password</Label>
            <Input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
            />
          </div>
          <Button className="w-full shadow-glow" disabled={busy} onClick={handleSignUp}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignInButton next={next} busy={busy} setBusy={setBusy} />
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
}
