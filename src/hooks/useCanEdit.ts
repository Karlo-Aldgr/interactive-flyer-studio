import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { checkCanEdit } from "@/lib/roles";

export function useCanEdit() {
  const { user, loading: authLoading } = useAuth();
  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCanEdit(false);
      return;
    }
    checkCanEdit().then(setCanEdit);
  }, [user, authLoading]);

  return { canEdit, loading: canEdit === null };
}
