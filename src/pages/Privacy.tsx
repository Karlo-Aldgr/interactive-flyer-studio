import { LegalLayout } from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 18, 2026">
      <p>
        TapThatFlyer (“we”, “us”) is operated by <strong>BOWEN ENTERPRISES LLC</strong>. We provide
        interactive flyer and marketing tools. This policy explains what information we collect and how
        we use it when you use tapthatflyer.com and related apps.
      </p>

      <h2 className="text-lg font-semibold">Information we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Account details you provide (name, email, password/auth data).</li>
        <li>Flyer content, media, and settings you create or upload.</li>
        <li>Subscriber and lead info collected via flyer actions or Ask AI (such as name, email, optional phone).</li>
        <li>Usage and analytics events (views, clicks, device/source metadata).</li>
        <li>When you connect Facebook/Instagram, tokens and Page/account IDs needed to post on your behalf.</li>
      </ul>

      <h2 className="text-lg font-semibold">How we use information</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>To operate the product (edit, publish, analytics, portals).</li>
        <li>To send messages you request (email/SMS campaigns, notifications).</li>
        <li>To publish or schedule social posts you explicitly start after connecting your accounts.</li>
        <li>To improve reliability, security, and support.</li>
      </ul>

      <h2 className="text-lg font-semibold">Facebook / Meta</h2>
      <p>
        If you connect a Facebook Page, we request permissions to list your Pages and publish posts you
        approve in TapThatFlyer. We store access tokens securely on our servers and use them only for
        those posting features. We do not sell your Meta data.
      </p>

      <h2 className="text-lg font-semibold">Sharing</h2>
      <p>
        We use infrastructure providers (hosting, database, email/SMS, AI, analytics) to run the service.
        We do not sell personal information. We may disclose information if required by law or to protect
        the service and users.
      </p>

      <h2 className="text-lg font-semibold">Retention</h2>
      <p>
        We keep account and flyer data while your account is active. Leads/subscribers remain until you
        delete them or they unsubscribe. You may request deletion (see Data Deletion).
      </p>

      <h2 className="text-lg font-semibold">Contact</h2>
      <p>
        Privacy questions: <a className="text-primary underline" href="mailto:itocarlosj.algordo@yahoo.com">itocarlosj.algordo@yahoo.com</a>
      </p>
    </LegalLayout>
  );
}
