import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConnectPlatformGrid } from "@/components/social/ConnectPlatformGrid";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CustomerPortalShell } from "@/components/portal-customer/CustomerPortalShell";
import { getMyOnboarding, submitOnboarding, extractSpreadsheetId, type OnboardingHelp } from "@/lib/onboarding";

const schema = z.object({
  full_name: z.string().trim().min(1, "Your name is required").max(120),
  phone: z.string().trim().min(5, "Phone number is required").max(40),
  email: z.string().trim().email("Enter a valid email").max(255),
  business_name: z.string().trim().min(1, "Business name is required").max(160),
  business_address: z.string().trim().max(300).optional().or(z.literal("")),
  business_slogan: z.string().trim().max(200).optional().or(z.literal("")),
  business_description: z.string().trim().max(2000).optional().or(z.literal("")),
  website_url: z.string().trim().max(300).optional().or(z.literal("")),
  facebook_url: z.string().trim().max(300).optional().or(z.literal("")),
  instagram_url: z.string().trim().max(300).optional().or(z.literal("")),
  tiktok_url: z.string().trim().max(300).optional().or(z.literal("")),
  other_social_url: z.string().trim().max(500).optional().or(z.literal("")),
  facebook_page_name: z.string().trim().max(160).optional().or(z.literal("")),
  instagram_handle: z.string().trim().max(120).optional().or(z.literal("")),
  posting_permission_name: z.string().trim().max(120).optional().or(z.literal("")),
  google_sheet_url: z.string().trim().max(500).optional().or(z.literal("")),
  google_sheet_tab: z.string().trim().max(80).optional().or(z.literal("")),
});

type FormState = z.infer<typeof schema>;

const emptyForm: FormState = {
  full_name: "",
  phone: "",
  email: "",
  business_name: "",
  business_address: "",
  business_slogan: "",
  business_description: "",
  website_url: "",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
  other_social_url: "",
  facebook_page_name: "",
  instagram_handle: "",
  posting_permission_name: "",
  google_sheet_url: "",
  google_sheet_tab: "",
};

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [websiteHelp, setWebsiteHelp] = useState<OnboardingHelp>(null);
  const [logoHelp, setLogoHelp] = useState<OnboardingHelp>(null);
  const [socialHelp, setSocialHelp] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const social = useSocialAccounts();
  const [postingPermission, setPostingPermission] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const existing = await getMyOnboarding(user.id);
        if (existing) {
          setForm({
            full_name: existing.full_name ?? "",
            phone: existing.phone ?? "",
            email: existing.email ?? user.email ?? "",
            business_name: existing.business_name ?? "",
            business_address: existing.business_address ?? "",
            business_slogan: existing.business_slogan ?? "",
            business_description: existing.business_description ?? "",
            website_url: existing.website_url ?? "",
            facebook_url: existing.facebook_url ?? "",
            instagram_url: existing.instagram_url ?? "",
            tiktok_url: existing.tiktok_url ?? "",
            other_social_url: existing.other_social_url ?? "",
            facebook_page_name: existing.facebook_page_name ?? "",
            instagram_handle: existing.instagram_handle ?? "",
            posting_permission_name: existing.posting_permission_name ?? "",
            google_sheet_url: existing.google_sheet_url ?? "",
            google_sheet_tab: existing.google_sheet_tab ?? "",
          });
          setPostingPermission(Boolean(existing.posting_permission));
          setWebsiteHelp(existing.website_help);
          setLogoHelp(existing.logo_help);
          setSocialHelp(existing.social_help);
          setExistingLogoUrl(existing.logo_url);
          setAlreadySubmitted(true);
        } else {
          setForm((f) => ({ ...f, email: user.email ?? "" }));
        }
      } catch (err: any) {
        toast.error(err.message || "Could not load your onboarding");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Latest flyer already in the system for this user (used by "Get info").
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("flyers")
        .select("id, title, thumbnail_url")
        .eq("owner_id", user.id)
        .not("thumbnail_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (row?.thumbnail_url) setExistingFlyer({ title: row.title ?? "Your flyer", url: row.thumbnail_url });
    })();
  }, [user]);

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("Could not read the flyer file"));
      fr.readAsDataURL(file);
    });

  const scanFlyerForInfo = async () => {
    const source = flyerFile ? await readAsDataUrl(flyerFile).catch(() => null) : existingFlyer?.url;
    if (!source) {
      toast.error("No flyer available to scan");
      return;
    }
    setScanning(true);
    try {
      const { info } = await invokeEdgeFunction<{ info: Partial<FormState> }>("flyer-info-scan", {
        imageUrl: source,
      });
      let filled = 0;
      setForm((f) => {
        const next = { ...f };
        (Object.keys(emptyForm) as (keyof FormState)[]).forEach((k) => {
          const val = (info as Record<string, unknown>)[k];
          if (typeof val === "string" && val.trim() && !String(next[k] ?? "").trim()) {
            next[k] = val.trim() as FormState[keyof FormState];
            filled += 1;
          }
        });
        return next;
      });
      toast.success(filled ? `Filled ${filled} field${filled === 1 ? "" : "s"} from your flyer` : "No new details found on the flyer");
    } catch (err: any) {
      toast.error(err.message || "Could not scan the flyer");
    } finally {
      setScanning(false);
    }
  };

  const websiteBlank = useMemo(() => !form.website_url.trim(), [form.website_url]);
  const missingSocials = useMemo(
    () => !form.facebook_url.trim() && !form.instagram_url.trim() && !form.tiktok_url.trim(),
    [form],
  );


  const onSubmit = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast.error(first || "Please review the form");
      return;
    }
    if (postingPermission && !parsed.data.posting_permission_name?.trim()) {
      toast.error("Type your full name to authorize posting on your behalf");
      return;
    }
    setSaving(true);
    try {
      const { jobId } = await submitOnboarding({
        userId: user.id,
        userEmail: user.email,
        input: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          business_name: parsed.data.business_name,
          business_address: parsed.data.business_address || null,
          business_slogan: parsed.data.business_slogan || null,
          business_description: parsed.data.business_description || null,
          website_url: parsed.data.website_url || null,
          website_help: websiteBlank ? websiteHelp : null,
          facebook_url: parsed.data.facebook_url || null,
          instagram_url: parsed.data.instagram_url || null,
          tiktok_url: parsed.data.tiktok_url || null,
          other_social_url: parsed.data.other_social_url || null,
          facebook_page_name: parsed.data.facebook_page_name || null,
          instagram_handle: parsed.data.instagram_handle || null,
          posting_permission: postingPermission,
          posting_permission_name: postingPermission
            ? parsed.data.posting_permission_name!.trim()
            : null,
          posting_permission_at: postingPermission ? new Date().toISOString() : null,
          google_sheet_url: parsed.data.google_sheet_url || null,
          google_sheet_tab: parsed.data.google_sheet_tab || null,
          social_help: missingSocials ? socialHelp : false,
          logo_url: existingLogoUrl,
          logo_help: !logoFile && !existingLogoUrl ? logoHelp : null,
        },
        logoFile,
        flyerFile,
      });
      toast.success(
        flyerFile
          ? "Thanks! Your flyer is in the queue — we'll get to work."
          : "Your project has been created. You can upload a flyer any time.",
      );
      navigate(jobId ? `/my-jobs/${jobId}` : "/dashboard?view=customer");
    } catch (err: any) {
      toast.error(err.message || "Could not submit");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CustomerPortalShell maxWidth="3xl">
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </CustomerPortalShell>
    );
  }

  return (
    <CustomerPortalShell maxWidth="3xl">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Welcome to TapThatFlyer
        </div>
        <h1 className="font-display text-3xl font-bold md:text-4xl">
          {alreadySubmitted ? "Your onboarding info" : "Let's set up your account"}
        </h1>
        <p className="text-muted-foreground">
          Thank you for choosing TapThatFlyer! Share a few details about your business and, if you have one,
          upload the flyer you'd like us to bring to life. Our AI will pre-detect hotspots so your designer
          can turn it into an interactive flyer faster.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">About you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="full_name">Your name *</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">Phone number *</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1" />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Your business</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="business_name">Business name *</Label>
              <Input id="business_name" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="business_slogan">Slogan / tagline</Label>
              <Input id="business_slogan" value={form.business_slogan} onChange={(e) => set("business_slogan", e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="business_address">Business address</Label>
              <Input id="business_address" value={form.business_address} onChange={(e) => set("business_address", e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="business_description">Describe your business</Label>
              <Textarea
                id="business_description"
                rows={4}
                value={form.business_description}
                onChange={(e) => set("business_description", e.target.value)}
                placeholder="What do you do? Who's your customer? Anything special?"
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Web & social</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="website_url">Website</Label>
              <Input id="website_url" placeholder="https://" value={form.website_url} onChange={(e) => set("website_url", e.target.value)} className="mt-1" />
            </div>
            {websiteBlank && (
              <div className="sm:col-span-2 rounded-md border border-dashed p-3">
                <Label className="text-sm">No website yet — want us to build one?</Label>
                <RadioGroup
                  value={websiteHelp ?? ""}
                  onValueChange={(v) => setWebsiteHelp((v || null) as OnboardingHelp)}
                  className="mt-2 flex flex-wrap gap-4"
                >
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="more_info" /> Tell me more</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> Not now</label>
                </RadioGroup>
              </div>
            )}
            <div>
              <Label htmlFor="facebook_url">Facebook</Label>
              <Input id="facebook_url" value={form.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="instagram_url">Instagram</Label>
              <Input id="instagram_url" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="tiktok_url">TikTok</Label>
              <Input id="tiktok_url" value={form.tiktok_url} onChange={(e) => set("tiktok_url", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="other_social_url">Other social</Label>
              <Input id="other_social_url" value={form.other_social_url} onChange={(e) => set("other_social_url", e.target.value)} className="mt-1" />
            </div>
            {missingSocials && (
              <div className="sm:col-span-2 flex items-center gap-2">
                <Checkbox id="social_help" checked={socialHelp} onCheckedChange={(v) => setSocialHelp(!!v)} />
                <Label htmlFor="social_help" className="text-sm">Help me set up my social media accounts</Label>
              </div>
            )}

            <div>
              <Label htmlFor="facebook_page_name">Facebook Page name</Label>
              <Input
                id="facebook_page_name"
                placeholder="Exact page name"
                value={form.facebook_page_name}
                onChange={(e) => set("facebook_page_name", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="instagram_handle">Instagram handle</Label>
              <Input
                id="instagram_handle"
                placeholder="@yourbusiness"
                value={form.instagram_handle}
                onChange={(e) => set("instagram_handle", e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2 rounded-md border bg-muted/40 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="posting_permission"
                  checked={postingPermission}
                  onCheckedChange={(v) => setPostingPermission(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="posting_permission" className="text-sm font-normal leading-snug">
                  I authorize TapThatFlyer to create and publish posts on my behalf to the social
                  accounts listed above.
                </Label>
              </div>
              {postingPermission && (
                <div>
                  <Label htmlFor="posting_permission_name">Type your full name to sign</Label>
                  <Input
                    id="posting_permission_name"
                    placeholder="Your full name"
                    value={form.posting_permission_name}
                    onChange={(e) => set("posting_permission_name", e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Your name and today's date are recorded as your consent. You can revoke this at
                    any time by unchecking the box and saving again.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Connect your social accounts</h2>
          <p className="text-sm text-muted-foreground">
            Optional, but it lets us publish your flyers for you. Connect now or later from the
            Social Media Manager — nothing is posted without your approval.
          </p>
          <ConnectPlatformGrid social={social} compact />
        </Card>


        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Your Google Sheet</h2>
          <p className="text-sm text-muted-foreground">
            Every customer gets their own spreadsheet. We export your automation scripts (social posts,
            email and SMS copy) into it. Create a Google Sheet, give it{" "}
            <strong>edit access to anyone with the link</strong> (or share it with your TapThatFlyer
            account manager), then paste the link below.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="google_sheet_url">Google Sheet link</Label>
              <Input
                id="google_sheet_url"
                placeholder="https://docs.google.com/spreadsheets/d/…"
                value={form.google_sheet_url}
                onChange={(e) => set("google_sheet_url", e.target.value)}
                className="mt-1"
              />
              {form.google_sheet_url.trim() && !extractSpreadsheetId(form.google_sheet_url) && (
                <p className="mt-1 text-xs text-destructive">
                  That doesn't look like a Google Sheets link — paste the full URL from your browser.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="google_sheet_tab">Tab name (optional)</Label>
              <Input
                id="google_sheet_tab"
                placeholder="Automation Requests"
                value={form.google_sheet_tab}
                onChange={(e) => set("google_sheet_tab", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </Card>



        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Assets</h2>
          <div className="space-y-4">
            <div>
              <Label>Logo</Label>
              {existingLogoUrl && !logoFile && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={existingLogoUrl} alt="Current logo" className="h-16 w-16 rounded border object-contain" />
                  <span className="text-xs text-muted-foreground">Current logo</span>
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="mt-2"
              />
              {!logoFile && !existingLogoUrl && (
                <div className="mt-3 rounded-md border border-dashed p-3">
                  <Label className="text-sm">No logo yet — want us to design one?</Label>
                  <RadioGroup
                    value={logoHelp ?? ""}
                    onValueChange={(v) => setLogoHelp((v || null) as OnboardingHelp)}
                    className="mt-2 flex flex-wrap gap-4"
                  >
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="more_info" /> Tell me more</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> Not now</label>
                  </RadioGroup>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="flyer_upload">
                <span className="inline-flex items-center gap-1"><Upload className="h-4 w-4" /> Upload a flyer <span className="text-muted-foreground font-normal">(optional)</span></span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, or PDF. Our AI will scan it and suggest hotspots (phone, links, addresses, dates)
                so your designer can turn them into interactions.
              </p>
              <Input
                id="flyer_upload"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFlyerFile(e.target.files?.[0] ?? null)}
                className="mt-2"
              />
              {flyerFile && (
                <p className="mt-2 text-xs text-muted-foreground">Selected: {flyerFile.name}</p>
              )}
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onSubmit} disabled={saving} size="lg">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {alreadySubmitted ? "Save changes" : "Submit"}
          </Button>
        </div>
      </div>
    </CustomerPortalShell>
  );
}
