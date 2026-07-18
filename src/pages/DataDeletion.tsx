import { LegalLayout } from "@/components/LegalLayout";

export default function DataDeletion() {
  return (
    <LegalLayout title="Data Deletion Instructions" updated="July 18, 2026">
      <p>
        If you used TapThatFlyer with Facebook Login or otherwise want your data deleted, follow these
        steps. This page also satisfies Meta’s “User data deletion” instructions URL requirement.
      </p>

      <h2 className="text-lg font-semibold">Delete flyer / subscriber data yourself</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Sign in to TapThatFlyer.</li>
        <li>Open your dashboard and delete flyers you no longer need.</li>
        <li>In a flyer’s Subscribers list, delete or mark leads unsubscribed as needed.</li>
        <li>Disconnect Facebook from Facebook Post Now / connected accounts if shown.</li>
      </ol>

      <h2 className="text-lg font-semibold">Request full account deletion</h2>
      <p>
        Email <a className="text-primary underline" href="mailto:itocarlosj.algordo@yahoo.com">itocarlosj.algordo@yahoo.com</a> from
        the email on your TapThatFlyer account with subject <strong>Data deletion request</strong>.
      </p>
      <p>Include:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your account email</li>
        <li>Whether you also want Meta/Facebook connection tokens removed</li>
        <li>Any flyer IDs or Page names if relevant</li>
      </ul>
      <p>
        We will confirm and delete associated personal data within a reasonable period, except where we
        must retain records for legal or security reasons.
      </p>

      <h2 className="text-lg font-semibold">Facebook / Meta users</h2>
      <p>
        Removing TapThatFlyer access in Facebook settings stops future posting. For deletion of data
        stored in TapThatFlyer from Meta Login, send the email request above.
      </p>
    </LegalLayout>
  );
}
