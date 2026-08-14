import { useEffect } from "react";
import { LegalLayout } from "@/components/LegalLayout";

export default function AffiliateTerms() {
  useEffect(() => {
    document.title = "Affiliate Agreement | TapThatFlyer";
    const desc = document.querySelector('meta[name="description"]');
    if (desc)
      desc.setAttribute(
        "content",
        "Terms and conditions of the TapThatFlyer affiliate program: commissions, payouts, tracking and conduct rules.",
      );
  }, []);

  return (
    <LegalLayout title="Affiliate Agreement" updated="August 14, 2026">
      <p className="rounded-md border border-amber-400/50 bg-amber-500/10 p-3 text-sm">
        <strong>Placeholder legal text.</strong> This agreement is a working draft for testing the affiliate program.
        BOWEN ENTERPRISES LLC should replace it with counsel-reviewed terms before public launch.
      </p>

      <h2 className="text-lg font-semibold">1. The program</h2>
      <p>
        The TapThatFlyer Affiliate Program lets approved participants ("Affiliates") earn a commission for referring
        new paying customers to TapThatFlyer, operated by BOWEN ENTERPRISES LLC ("we", "us").
      </p>

      <h2 className="text-lg font-semibold">2. Acceptance and approval</h2>
      <p>
        Participation requires an approved application. We may approve, pause, or terminate any affiliate account at
        our discretion, including for violations of these terms.
      </p>

      <h2 className="text-lg font-semibold">3. Tracking and attribution</h2>
      <p>
        Each Affiliate receives a unique referral code and link. A referral is attributed when a visitor arrives via
        that link and creates an account within the attribution window of <strong>14 days</strong>. Attribution is
        first-touch and is stored in the visitor's browser. We do not guarantee attribution where cookies or local
        storage are cleared, blocked, or where the visitor uses a different device or browser.
      </p>

      <h2 className="text-lg font-semibold">4. Commissions</h2>
      <p>
        The default commission rate is <strong>20%</strong> of the net amount paid by a referred customer, unless a
        different rate is set for your account. Commissions are recorded when we confirm a qualifying payment.
        Refunded, charged-back, fraudulent or cancelled orders are reversed.
      </p>

      <h2 className="text-lg font-semibold">5. Payouts</h2>
      <p>
        Affiliates may request a payout once their approved balance reaches the minimum of <strong>$50 USD</strong>.
        Payouts are currently issued manually via PayPal to the payout email on file. Allow up to 30 days for
        processing. You are responsible for all taxes on amounts you receive.
      </p>

      <h2 className="text-lg font-semibold">6. Prohibited conduct</h2>
      <ul className="list-disc pl-5">
        <li>Self-referral, or referring accounts you control or share an email with.</li>
        <li>Paid search bidding on TapThatFlyer brand terms without written permission.</li>
        <li>Spam, unsolicited bulk email or SMS, and misleading claims about the product or pricing.</li>
        <li>Coupon-scraping sites, cookie stuffing, iframes, forced clicks, or any automated click generation.</li>
        <li>Impersonating TapThatFlyer or presenting yourself as an employee or official representative.</li>
      </ul>
      <p>
        Referrals that trigger our fraud checks are flagged for manual review and may be withheld or voided.
      </p>

      <h2 className="text-lg font-semibold">7. Brand and promo materials</h2>
      <p>
        We grant a limited, revocable, non-exclusive license to use the banners, copy and marks we provide in your
        affiliate dashboard, solely to promote TapThatFlyer. Do not alter logos or create derivative branding.
      </p>

      <h2 className="text-lg font-semibold">8. Changes and termination</h2>
      <p>
        We may modify commission rates, the attribution window, the payout minimum, or these terms at any time.
        Material changes will be reflected on this page. Either party may terminate at any time; approved commissions
        earned before termination remain payable unless the account was terminated for fraud or abuse.
      </p>

      <h2 className="text-lg font-semibold">9. Contact</h2>
      <p>Questions about the program can be sent to the TapThatFlyer team via the contact details on our website.</p>
    </LegalLayout>
  );
}
