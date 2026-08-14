import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { attributeSignupIfPending, captureReferralFromUrl } from "@/lib/affiliateTracking";

/**
 * Global, invisible affiliate attribution:
 *  - captures ?ref=CODE on any route and records a click
 *  - attributes the signed-in user to the stored code (14-day window)
 */
export function AffiliateTracker() {
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!location.search.includes("ref=")) return;
    captureReferralFromUrl().catch(() => {});
  }, [location.search]);

  useEffect(() => {
    if (loading || !user) return;
    attributeSignupIfPending().catch(() => {});
  }, [user, loading]);

  return null;
}
