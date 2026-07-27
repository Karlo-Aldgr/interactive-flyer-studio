import { LegalLayout } from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="July 18, 2026">
      <p>
        By using TapThatFlyer you agree to these terms. TapThatFlyer is operated by{" "}
        <strong>BOWEN ENTERPRISES LLC</strong>. If you do not agree, do not use the service.
      </p>

      <h2 className="text-lg font-semibold">The service</h2>
      <p>
        TapThatFlyer lets you create interactive digital flyers, collect leads, view analytics, and
        (optionally) publish marketing content to channels you connect, such as Facebook Pages.
      </p>

      <h2 className="text-lg font-semibold">Your account</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>You must provide accurate account information and keep credentials secure.</li>
        <li>You are responsible for activity under your account.</li>
        <li>You must have rights to content you upload and to Pages/accounts you connect.</li>
      </ul>

      <h2 className="text-lg font-semibold">Acceptable use</h2>
      <p>
        Do not use TapThatFlyer for unlawful content, spam, malware, harassment, or to violate Meta or
        other platform policies. We may suspend accounts that abuse the service.
      </p>

      <h2 className="text-lg font-semibold">Third-party platforms</h2>
      <p>
        Social posting depends on third parties (for example Meta). Their terms apply. Features may change
        or break if those platforms change APIs or revoke access.
      </p>

      <h2 className="text-lg font-semibold">Disclaimer</h2>
      <p>
        The service is provided “as is.” We do not guarantee uninterrupted availability or specific
        marketing results.
      </p>

      <h2 className="text-lg font-semibold">Contact</h2>
      <p>
        Questions: <a className="text-primary underline" href="mailto:itocarlosj.algordo@yahoo.com">itocarlosj.algordo@yahoo.com</a>
      </p>
    </LegalLayout>
  );
}
