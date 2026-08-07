import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks whether the signed-in user has finished the onboarding intake form.
 * `completed` is null while loading.
 */
export function useOnboardingStatus() {
  const { user } = useAuth();
  const [completed, setCompleted] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCompleted(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    setCompleted(Boolean(data?.onboarding_completed_at));
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { completed, loading: completed === null, refresh };
}
