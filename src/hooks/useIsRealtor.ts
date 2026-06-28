import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useIsRealtor() {
  const { user, loading: authLoading } = useAuth();
  const [isRealtor, setIsRealtor] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsRealtor(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const roles = (data ?? []).map((r: any) => r.role);
        setIsRealtor(roles.includes("realtor") || roles.includes("admin"));
      });
  }, [user, authLoading]);

  return { isRealtor: isRealtor ?? false, loading: isRealtor === null };
}
