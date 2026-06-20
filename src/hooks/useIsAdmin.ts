import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { checkIsAdmin } from "@/lib/roles";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin(user.id).then(setIsAdmin);
  }, [user, authLoading]);

  return { isAdmin: isAdmin ?? false, loading: isAdmin === null };
}
