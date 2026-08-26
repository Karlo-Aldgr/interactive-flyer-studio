import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Copy, Loader2, IdCard, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getOnboardingForFlyer, type OnboardingSubmission } from "@/lib/onboarding";
import {
  buildBizadPayloadFromOnboarding,
  getBizadForFlyer,
  rebuildAndSaveBizadLayout,
  upsertBizad,
  updateBizadLayout,
  type BizadRecord,
} from "@/lib/bizad";
import { BIZAD_DEFAULT_BACKGROUND_COLOR, BIZAD_DEFAULT_BUTTON_COLOR } from "@/lib/bizadDefaults";
import { shouldOfferBizadLayoutReset } from "@/lib/bizadLayoutUtils";
import { buildBizadPage, layoutFromPage } from "@/lib/bizadPage";
import {
  BIZAD_TEMPLATES,
  CLEAN_GRID_DEFAULT_ACCENT,
  GRADIENT_PROFILE_DEFAULT_FROM,
  GRADIENT_PROFILE_DEFAULT_TO,
  GRADIENT_PROFILE_TEMPLATE_ID,
  CLEAN_GRID_TEMPLATE_ID,
  VONTASTIC_TEMPLATE_ID,
} from "@/lib/bizadTemplates";
import { buildBizadSocialShareUrl, buildPublicBizadUrl } from "@/lib/utils";
import { uploadBizadShareImage } from "@/lib/thumbnail";
import { useEditorStore } from "@/store/editorStore";
import type { Flyer } from "@/types/flyer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BizadLayoutView } from "@/components/viewer/BizadLayoutView";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  flyer: Flyer;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function BizadDialog({ flyer, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const addBizadPage = useEditorStore((s) => s.addBizadPage);
  const replaceBizadPage = useEditorStore((s) => s.replaceBizadPage);
  const setBizadPageHidden = useEditorStore((s) => s.setBizadPageHidden);
  const pages = useEditorStore((s) => s.pages);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [uploadingShare, setUploadingShare] = useState(false);
  const [bizad, setBizad] = useState<BizadRecord | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingSubmission | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [buttonColor, setButtonColor] = useState(BIZAD_DEFAULT_BUTTON_COLOR);
  const [backgroundColor, setBackgroundColor] = useState(BIZAD_DEFAULT_BACKGROUND_COLOR);
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [copyrightText, setCopyrightText] = useState("");
  const [shareImageUrl, setShareImageUrl] = useState("");
  const [templateId, setTemplateId] = useState<string>(VONTASTIC_TEMPLATE_ID);
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [customLinkLabel, setCustomLinkLabel] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [accentColor, setAccentColor] = useState(CLEAN_GRID_DEFAULT_ACCENT);
  const [gradientFrom, setGradientFrom] = useState(GRADIENT_PROFILE_DEFAULT_FROM);
  const [gradientTo, setGradientTo] = useState(GRADIENT_PROFILE_DEFAULT_TO);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const shareFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const flyerContext = useMemo(() => ({
    id: flyer.id,
    public_slug: flyer.public_slug,
    thumbnail_url: flyer.thumbnail_url,
    title: flyer.title,
  }), [flyer.id, flyer.public_slug, flyer.thumbnail_url, flyer.title]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const [existing, onboardingRow] = await Promise.all([
          getBizadForFlyer(flyer.id),
          getOnboardingForFlyer(flyer.id),
        ]);
        setOnboarding(onboardingRow);
        if (existing) {
          setBizad(existing);
          setEnabled(existing.enabled);
          setButtonColor(existing.button_color);
          setBackgroundColor(existing.background_color);
          setOwnerName(existing.owner_name ?? "");
          setPhone(existing.phone ?? "");
          setEmail(existing.email ?? "");
          setAboutText(existing.about_text ?? "");
          setVideoUrl(existing.video_url ?? "");
          setCopyrightText(existing.copyright_text ?? "");
          setShareImageUrl(existing.share_image_url ?? "");
          setTemplateId(existing.template_id || VONTASTIC_TEMPLATE_ID);
          setJobTitle(existing.job_title ?? "");
          setCompanyName(existing.company_name ?? existing.business_name ?? "");
          setCoverImageUrl(existing.cover_image_url ?? "");
          setCustomLinkLabel(existing.custom_link_label ?? "");
          setCustomLinkUrl(existing.custom_link_url ?? "");
          setBookingUrl(existing.booking_url ?? "");
          setAccentColor(existing.accent_color || CLEAN_GRID_DEFAULT_ACCENT);
          setGradientFrom(existing.gradient_from || GRADIENT_PROFILE_DEFAULT_FROM);
          setGradientTo(existing.gradient_to || GRADIENT_PROFILE_DEFAULT_TO);
          setWebsiteUrl(existing.social_links?.website ?? "");
          setFacebookUrl(existing.social_links?.facebook ?? "");
          setInstagramUrl(existing.social_links?.instagram ?? "");
          setYoutubeUrl(existing.social_links?.youtube ?? "");
          setTiktokUrl(existing.social_links?.tiktok ?? "");
        } else {
          setBizad(null);
          setEnabled(false);
          setButtonColor(BIZAD_DEFAULT_BUTTON_COLOR);
          setBackgroundColor(BIZAD_DEFAULT_BACKGROUND_COLOR);
          setOwnerName("");
          setPhone("");
          setEmail("");
          setAboutText("");
          setVideoUrl("");
          setShareImageUrl(flyer.thumbnail_url ?? "");
          const draft = buildBizadPayloadFromOnboarding(onboardingRow, flyerContext, null);
          setOwnerName(draft.owner_name ?? "");
          setPhone(draft.phone ?? "");
          setEmail(draft.email ?? "");
          setAboutText(draft.about_text ?? "");
          setCopyrightText(draft.copyright_text ?? "");
          setTemplateId(VONTASTIC_TEMPLATE_ID);
          setJobTitle("");
          setCompanyName(draft.company_name ?? draft.business_name ?? "");
          setCoverImageUrl("");
          setCustomLinkLabel("");
          setCustomLinkUrl("");
          setBookingUrl("");
          setAccentColor(CLEAN_GRID_DEFAULT_ACCENT);
          setGradientFrom(GRADIENT_PROFILE_DEFAULT_FROM);
          setGradientTo(GRADIENT_PROFILE_DEFAULT_TO);
          setWebsiteUrl(draft.social_links?.website ?? "");
          setFacebookUrl(draft.social_links?.facebook ?? "");
          setInstagramUrl(draft.social_links?.instagram ?? "");
          setYoutubeUrl(draft.social_links?.youtube ?? "");
          setTiktokUrl(draft.social_links?.tiktok ?? "");
        }
      } catch (e: any) {
        toast.error(e?.message || "Could not load bizad settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, flyer.id, flyerContext, flyer.thumbnail_url]);

  /** Field overrides from the form, applied on top of the onboarding-derived base record. */
  const overrides = useMemo(
    () => (base: Omit<BizadRecord, "id" | "created_at" | "updated_at">) => ({
      ...base,
      button_color: buttonColor,
      background_color: backgroundColor,
      owner_name: ownerName.trim() || base.owner_name,
      phone: phone.trim() || base.phone,
      email: email.trim() || base.email,
      about_text: aboutText.trim() || base.about_text,
      video_url: videoUrl.trim() || null,
      copyright_text: copyrightText.trim() || base.copyright_text,
      share_image_url: shareImageUrl.trim() || base.share_image_url,
      template_id: templateId,
      job_title: jobTitle.trim() || null,
      company_name: companyName.trim() || base.company_name,
      cover_image_url: coverImageUrl.trim() || null,
      custom_link_label: customLinkLabel.trim() || null,
      custom_link_url: customLinkUrl.trim() || null,
      booking_url: bookingUrl.trim() || null,
      accent_color: accentColor,
      gradient_from: gradientFrom,
      gradient_to: gradientTo,
      social_links: {
        ...(base.social_links || {}),
        website: websiteUrl.trim() || null,
        facebook: facebookUrl.trim() || null,
        instagram: instagramUrl.trim() || null,
        youtube: youtubeUrl.trim() || null,
        tiktok: tiktokUrl.trim() || null,
      },
    }),
    [
      buttonColor, backgroundColor, ownerName, phone, email, aboutText, videoUrl, copyrightText,
      shareImageUrl, templateId, jobTitle, companyName, coverImageUrl, customLinkLabel, customLinkUrl,
      bookingUrl, accentColor, gradientFrom, gradientTo, websiteUrl, facebookUrl, instagramUrl,
      youtubeUrl, tiktokUrl,
    ],
  );

  const previewBizad = useMemo((): BizadRecord | null => {
    if (!open || loading) return null;
    const base = buildBizadPayloadFromOnboarding(onboarding, flyerContext, bizad);
    return {
      ...overrides(base),
      id: bizad?.id ?? "preview",
      created_at: bizad?.created_at ?? new Date().toISOString(),
      updated_at: bizad?.updated_at ?? new Date().toISOString(),
      enabled,
    };
  }, [open, loading, onboarding, flyerContext, bizad, enabled, overrides]);

  const previewLayout = useMemo(() => {
    if (!open || !previewBizad) return null;
    const page = buildBizadPage(flyer.id, 0, previewBizad);
    return layoutFromPage(page, flyer.settings);
  }, [open, previewBizad, flyer.id, flyer.settings]);

  const publicUrl = previewBizad?.slug ? buildPublicBizadUrl(previewBizad.slug) : null;
  const socialShareUrl = previewBizad?.slug ? buildBizadSocialShareUrl(previewBizad.slug) : null;
  const showLayoutReset = bizad ? shouldOfferBizadLayoutReset(bizad.layout) : true;

  async function persistLayout(saved: BizadRecord) {
    if (!saved.enabled) {
      await updateBizadLayout(flyer.id, null);
      return;
    }
    const hasPage = useEditorStore.getState().pages.some((p) => p.background?.bizadPage);
    if (!hasPage) {
      addBizadPage(saved);
    } else {
      replaceBizadPage(saved);
    }
    await rebuildAndSaveBizadLayout(saved, flyer.settings);
  }

  async function save(nextEnabled = enabled) {
    if (!user) return toast.error("Sign in to enable your digital card");
    setSaving(true);
    try {
      const onboardingRow = onboarding ?? await getOnboardingForFlyer(flyer.id);
      const base = buildBizadPayloadFromOnboarding(onboardingRow, flyerContext, bizad);

      const saved = await upsertBizad({
        ...overrides(base),
        enabled: nextEnabled,
      });
      setBizad(saved);
      setEnabled(saved.enabled);

      const hadPage = pages.some((p) => p.background?.bizadPage);
      if (saved.enabled) {
        await persistLayout(saved);
        if (!hadPage) {
          toast.success("Digital business card page added to your flyer pages");
        }
      } else {
        setBizadPageHidden(true);
        await updateBizadLayout(flyer.id, null);
      }
      toast.success(nextEnabled ? "Digital business card enabled" : "Digital business card saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save bizad");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(checked: boolean) {
    if (checked && !shareImageUrl.trim() && !flyer.thumbnail_url) {
      toast.message("Add a share preview image so your card looks right when shared.");
    }
    setEnabled(checked);
    await save(checked);
  }

  async function handleResetLayout() {
    if (!previewBizad || !user) return;
    setResetting(true);
    try {
      const base = buildBizadPayloadFromOnboarding(onboarding, flyerContext, bizad);
      const saved = await upsertBizad({ ...overrides(base), enabled });
      setBizad(saved);
      replaceBizadPage(saved);
      await rebuildAndSaveBizadLayout(saved, flyer.settings);
      toast.success("Template layout applied");
    } catch (e: any) {
      toast.error(e?.message || "Could not reset layout");
    } finally {
      setResetting(false);
    }
  }

  async function handleShareImageUpload(file: File) {
    setUploadingShare(true);
    try {
      const url = await uploadBizadShareImage(file, flyer.id);
      setShareImageUrl(url);
      if (bizad) {
        const base = buildBizadPayloadFromOnboarding(onboarding, flyerContext, bizad);
        const saved = await upsertBizad({ ...overrides(base), enabled, share_image_url: url });
        setBizad(saved);
      }
      toast.success("Share preview image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingShare(false);
    }
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    try {
      const url = await uploadBizadShareImage(file, flyer.id);
      setCoverImageUrl(url);
      toast.success("Cover image uploaded — save to apply");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingCover(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  }

  async function copySocialLink() {
    if (!socialShareUrl) return;
    await navigator.clipboard.writeText(socialShareUrl);
    toast.success("Social share link copied");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-4 w-4" /> Digital business card
          </DialogTitle>
          <DialogDescription>
            Pick a card template, then edit your details, colors, images and links. Every button uses your own
            project data — nothing is shared between projects.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
            <div className="min-w-0 space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="bizad-enabled" className="text-sm font-medium">Add bizad to this flyer</Label>
                  <p className="text-xs text-muted-foreground">Creates a public /bizads page from this project&apos;s onboarding data</p>
                </div>
                <Switch
                  id="bizad-enabled"
                  checked={enabled}
                  disabled={saving}
                  onCheckedChange={handleToggle}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium">Card template</p>
                <div className="grid grid-cols-3 gap-2">
                  {BIZAD_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      title={t.description}
                      className={`overflow-hidden rounded-md border text-left transition ${
                        templateId === t.id ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div
                        className="flex h-16 flex-col items-center justify-center gap-1"
                        style={{ background: t.preview.background }}
                      >
                        <span className="h-3 w-3 rounded-full" style={{ background: t.preview.accent }} />
                        <span className="h-1.5 w-10 rounded-full" style={{ background: t.preview.accent }} />
                        <span className="h-1.5 w-8 rounded-full opacity-60" style={{ background: t.preview.text }} />
                      </div>
                      <span className="block px-1.5 py-1 text-[10px] font-medium leading-tight">{t.name}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {BIZAD_TEMPLATES.find((t) => t.id === templateId)?.description}
                </p>
              </div>

              {showLayoutReset && enabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={resetting || saving}
                  onClick={() => void handleResetLayout()}
                >
                  {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Apply selected template layout
                </Button>
              )}

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-medium">Identity</p>
                <div className="space-y-1.5">
                  <Label htmlFor="bizad-title" className="text-xs">Job title</Label>
                  <Input id="bizad-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Owner / Realtor" className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bizad-company" className="text-xs">Company</Label>
                  <Input id="bizad-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Business name" className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cover / header image</Label>
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover" className="h-24 w-full rounded-md border bg-muted object-cover" />
                  ) : null}
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleCoverUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" disabled={uploadingCover}
                      onClick={() => coverFileRef.current?.click()}>
                      {uploadingCover ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload cover
                    </Button>
                    {coverImageUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCoverImageUrl("")}>Remove</Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-medium">Links &amp; socials</p>
                <p className="text-[11px] text-muted-foreground">
                  Empty social links show a “Setup Required” tile instead of a dead button.
                </p>
                {([
                  ["Website", websiteUrl, setWebsiteUrl, "https://yourbusiness.com"],
                  ["Facebook", facebookUrl, setFacebookUrl, "https://facebook.com/yourpage"],
                  ["Instagram", instagramUrl, setInstagramUrl, "https://instagram.com/you"],
                  ["YouTube", youtubeUrl, setYoutubeUrl, "https://youtube.com/@you"],
                  ["TikTok", tiktokUrl, setTiktokUrl, "https://tiktok.com/@you"],
                  ["Booking link", bookingUrl, setBookingUrl, "https://calendly.com/you (optional)"],
                ] as Array<[string, string, (v: string) => void, string]>).map(([label, value, setter, ph]) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input value={value} onChange={(e) => setter(e.target.value)} placeholder={ph} className="h-8 text-xs" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Custom link label</Label>
                    <Input value={customLinkLabel} onChange={(e) => setCustomLinkLabel(e.target.value)}
                      placeholder="Our menu" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Custom link URL</Label>
                    <Input value={customLinkUrl} onChange={(e) => setCustomLinkUrl(e.target.value)}
                      placeholder="https://…" className="h-8 text-xs" />
                  </div>
                </div>
              </div>

              {templateId === GRADIENT_PROFILE_TEMPLATE_ID && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Gradient start</Label>
                    <Input type="color" value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)}
                      className="h-10 cursor-pointer p-1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Gradient end</Label>
                    <Input type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)}
                      className="h-10 cursor-pointer p-1" />
                  </div>
                </div>
              )}

              {templateId === CLEAN_GRID_TEMPLATE_ID && (
                <div className="space-y-1.5 rounded-lg border border-border p-3">
                  <Label className="text-xs">Accent color</Label>
                  <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 cursor-pointer p-1" />
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-medium">Contact info</p>
                <p className="text-[11px] text-muted-foreground">
                  Phone and email power the CALL, TEXT, and EMAIL buttons on your live card.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="bizad-owner" className="text-xs">Owner / contact name</Label>
                  <Input
                    id="bizad-owner"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Jane Smith"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bizad-phone" className="text-xs">Phone</Label>
                  <Input
                    id="bizad-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bizad-email" className="text-xs">Email</Label>
                  <Input
                    id="bizad-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@business.com"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bizad-about" className="text-xs">Business description</Label>
                <Textarea
                  id="bizad-about"
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  placeholder="Short description shown on your card"
                  className="min-h-[72px] resize-y text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bizad-btn-color" className="text-xs">Button color</Label>
                  <Input
                    id="bizad-btn-color"
                    type="color"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="h-10 cursor-pointer p-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bizad-bg-color" className="text-xs">Background color</Label>
                  <Input
                    id="bizad-bg-color"
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-10 cursor-pointer p-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Share preview image</Label>
                <p className="text-[11px] text-muted-foreground">
                  Shown when you share your card link on Facebook, WhatsApp, and iMessage.
                </p>
                {shareImageUrl ? (
                  <img
                    src={shareImageUrl}
                    alt="Share preview"
                    className="h-28 w-full rounded-md border bg-muted object-contain p-1"
                  />
                ) : null}
                <input
                  ref={shareFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleShareImageUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={uploadingShare}
                  onClick={() => shareFileRef.current?.click()}
                >
                  {uploadingShare ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload share image
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bizad-video" className="text-xs">Video URL (optional)</Label>
                <Input
                  id="bizad-video"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="YouTube or direct .mp4 link"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bizad-copyright" className="text-xs">Copyright footer</Label>
                <Input
                  id="bizad-copyright"
                  value={copyrightText}
                  onChange={(e) => setCopyrightText(e.target.value)}
                  placeholder="© Your Business Name"
                  className="h-8 text-xs"
                />
              </div>

              {publicUrl && enabled && (
                <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                  <Label className="text-xs">Public link</Label>
                  <div className="flex min-w-0 gap-2">
                    <Input
                      readOnly
                      value={publicUrl}
                      title={publicUrl}
                      className="h-8 min-w-0 flex-1 text-[11px] font-mono"
                    />
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyLink}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" asChild>
                      <a href={publicUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                  {socialShareUrl && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copySocialLink}>
                      Copy social share link
                    </Button>
                  )}
                </div>
              )}

              {!flyer.public_slug && enabled && (
                <p className="text-xs text-amber-700">
                  Publish this flyer to get a stable public slug. Flyer button links to the interactive flyer.
                </p>
              )}
            </div>

            <div className="min-w-0 space-y-2 lg:sticky lg:top-0">
              <Label className="text-xs">Page preview</Label>
              <div className="isolate overflow-hidden rounded-xl border border-border bg-muted/30">
                {previewBizad && previewLayout ? (
                  <div className="max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain">
                    <BizadLayoutView layout={previewLayout} bizad={previewBizad} embedded />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => save()} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
