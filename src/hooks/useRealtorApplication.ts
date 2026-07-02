import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type RealtorApplicationStatus = {
  id: string;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
};

export function useRealtorApplication() {
  const { user, loading: authLoading } = useAuth();
  const [application, setApplication] = useState<RealtorApplicationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setApplication(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const loadApplication = async () => {
      const { data: byUser } = await supabase
        .from("realtor_applications")
        .select("id, status, review_notes, created_at")
        .eq("applicant_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byUser) return byUser as RealtorApplicationStatus;

      if (user!.email) {
        const { data: byEmail } = await supabase
          .from("realtor_applications")
          .select("id, status, review_notes, created_at")
          .ilike("email", user!.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return (byEmail as RealtorApplicationStatus | null) ?? null;
      }

      return null;
    };

    loadApplication().then((data) => {
      if (cancelled) return;
      setApplication(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { application, loading: authLoading || loading };
}
