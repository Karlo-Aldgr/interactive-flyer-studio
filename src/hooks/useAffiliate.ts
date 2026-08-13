import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { loadMyAffiliate, loadMyAffiliateApplication, type Affiliate, type AffiliateApplication } from "@/lib/affiliates";

export function useAffiliate() {
  const { user, loading: authLoading } = useAuth();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [application, setApplication] = useState<AffiliateApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAffiliate(null);
      setApplication(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([loadMyAffiliate(user.id), loadMyAffiliateApplication(user.id)]).then(([a, app]) => {
      if (cancelled) return;
      setAffiliate(a);
      setApplication(app);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { affiliate, application, loading, isAffiliate: !!affiliate && affiliate.status === "active" };
}
