import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { loadMyAffiliate, loadMyAffiliateApplication, type Affiliate, type AffiliateApplication } from "@/lib/affiliates";

export function useAffiliate() {
  const { user, loading: authLoading } = useAuth();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [application, setApplication] = useState<AffiliateApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setAffiliate(null);
      setApplication(null);
      setLoading(false);
      return;
    }
    const [a, app] = await Promise.all([
      loadMyAffiliate(user.id),
      loadMyAffiliateApplication(user.id, user.email ?? null),
    ]);
    setAffiliate(a);
    setApplication(app);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    load();
  }, [authLoading, load]);

  return {
    affiliate,
    application,
    loading,
    reload: load,
    isAffiliate: !!affiliate && affiliate.status === "active",
  };
}
