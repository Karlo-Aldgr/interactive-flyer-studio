import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Home, CheckCircle2, XCircle, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptRealtorInvite,
  resolveRealtorInvite,
} from "@/lib/realtorInvites";

type ResolvedInvite = {
  status: "pending" | "accepted" | "revoked" | "expired";
  email?: string | null;
  invited_name?: string | null;
  note?: string | null;
  expires_at?: string;
};

export default function RealtorAcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<ResolvedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing invite token.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await resolveRealtorInvite(token);
        if (!res.ok) {
          setError(res.error ?? "Invalid invite");
        } else {
          setInvite({
            status: res.status ?? "pending",
            email: res.email,
            invited_name: res.invited_name,
            note: res.note,
            expires_at: res.expires_at,
          });
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to load invite");
      }
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (user) {
      supabase.auth.getUser().then(({ data }) => setSignedInEmail(data.user?.email ?? null));
    }
  }, [user]);

  const accept = async () => {
    setAccepting(true);
    try {
      const res = await acceptRealtorInvite(token);
      if (!res.ok) {
        toast.error(res.error ?? "Could not accept invite");
        setAccepting(false);
        return;
      }
      toast.success("Welcome to the Realtor Portal!");
      navigate("/realtor", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
      setAccepting(false);
    }
  };

  const nextUrl = `/realtor/accept?token=${token}`;
  const signInHref = `/auth?next=${encodeURIComponent(nextUrl)}`;
  const signUpHref = `/auth?mode=signup&next=${encodeURIComponent(nextUrl)}${
    invite?.email ? `&email=${encodeURIComponent(invite.email)}` : ""
  }`;

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-md">
        <Card className="space-y-5 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Realtor Portal invite</h1>
          </div>

          {error ? (
            <div className="space-y-3 text-center">
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
              <p className="text-muted-foreground">{error}</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Back to home</Link>
              </Button>
            </div>
          ) : invite?.status === "accepted" ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <p>This invite has already been used.</p>
              <Button asChild className="w-full">
                <Link to="/realtor">Go to Realtor Portal</Link>
              </Button>
            </div>
          ) : invite?.status === "revoked" || invite?.status === "expired" ? (
            <div className="space-y-3 text-center">
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
              <p>
                This invite {invite.status === "expired" ? "has expired" : "was revoked"}. Please ask the
                admin to send a new one.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  {invite?.invited_name ? `Hi ${invite.invited_name}, ` : ""}you've been invited to join
                  TapThatFlyer as a realtor. Accepting will unlock the Realtor Portal — manage listings,
                  photo galleries, and leads.
                </p>
                {invite?.email && (
                  <Badge variant="outline">
                    Sent to <span className="ml-1 font-medium">{invite.email}</span>
                  </Badge>
                )}
                {invite?.note && (
                  <p className="rounded-md border-l-4 border-primary/40 bg-muted/40 p-3 text-sm italic">
                    "{invite.note}"
                  </p>
                )}
              </div>

              {!user ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {invite?.email
                      ? `Sign in or create an account using ${invite.email} to accept.`
                      : "Sign in or create an account to accept this invite."}
                  </p>
                  <Button asChild className="w-full">
                    <Link to={signUpHref}>
                      <UserPlus className="mr-2 h-4 w-4" /> Create account & accept
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={signInHref}>
                      <LogIn className="mr-2 h-4 w-4" /> I already have an account
                    </Link>
                  </Button>
                </div>
              ) : invite?.email && signedInEmail && signedInEmail.toLowerCase() !== invite.email.toLowerCase() ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">
                    This invite is for <strong>{invite.email}</strong>, but you're signed in as{" "}
                    <strong>{signedInEmail}</strong>.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate(signInHref);
                    }}
                  >
                    Sign out & switch accounts
                  </Button>
                </div>
              ) : (
                <Button className="w-full" onClick={accept} disabled={accepting}>
                  {accepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Accept & enter portal
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
