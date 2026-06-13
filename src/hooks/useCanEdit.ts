import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCanEdit() {
  const { user, loading: authLoading } = useAuth();
  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setCanEdit(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "editor"])
      .maybeSingle()
      .then(({ data }) => setCanEdit(!!data));
  }, [user, authLoading]);

  return { canEdit, loading: canEdit === null };
}
