import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { getOnboardingForJob, type OnboardingSubmission } from "@/lib/onboarding";

type Props = { jobId: string };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === false) return null;
  return (
    <div className="grid grid-cols-3 gap-2 py-1 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words">{value}</div>
    </div>
  );
}

function link(url: string | null) {
  if (!url) return null;
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline break-all">
      {url}
    </a>
  );
}

const HELP_LABEL: Record<string, string> = {
  yes: "Yes — please help",
  more_info: "Wants more info",
  no: "Not now",
};

export function OnboardingSubmissionCard({ jobId }: Props) {
  const [sub, setSub] = useState<OnboardingSubmission | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getOnboardingForJob(jobId).then((s) => {
      setSub(s);
      setLoaded(true);
    });
  }, [jobId]);

  if (!loaded || !sub) return null;

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Client onboarding info</h2>
      <p className="mt-1 text-xs text-muted-foreground">Submitted through the onboarding form.</p>

      <div className="mt-4 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</div>
          <Row label="Name" value={sub.full_name} />
          <Row label="Phone" value={sub.phone} />
          <Row label="Email" value={sub.email} />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business</div>
          <Row label="Business" value={sub.business_name} />
          <Row label="Slogan" value={sub.business_slogan} />
          <Row label="Address" value={sub.business_address} />
          <Row label="Description" value={sub.business_description && <span className="whitespace-pre-wrap">{sub.business_description}</span>} />
          <Row label="AI description" value={sub.ai_description && <span className="whitespace-pre-wrap">{sub.ai_description}</span>} />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Web & social</div>
          <Row label="Website" value={link(sub.website_url)} />
          <Row label="Facebook" value={link(sub.facebook_url)} />
          <Row label="Instagram" value={link(sub.instagram_url)} />
          <Row label="TikTok" value={link(sub.tiktok_url)} />
          <Row label="Other" value={link(sub.other_social_url)} />
          {sub.website_help && <Row label="Website help" value={HELP_LABEL[sub.website_help]} />}
          {sub.social_help && <Row label="Social help" value="Yes — wants help setting up" />}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assets</div>
          {sub.logo_url && (
            <Row
              label="Logo"
              value={<img src={sub.logo_url} alt="Logo" className="h-16 w-16 rounded border object-contain" />}
            />
          )}
          {sub.logo_help && <Row label="Logo help" value={HELP_LABEL[sub.logo_help]} />}
        </div>

        {sub.hotspot_suggestions && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI hotspot suggestions</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-scanned when the flyer was uploaded. The editor can accept these inside the flyer editor.
            </p>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">
              {JSON.stringify(sub.hotspot_suggestions, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
