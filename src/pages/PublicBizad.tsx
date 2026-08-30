import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BizadPageContent } from "@/components/bizad/BizadPageContent";
import { FlyerChatbot } from "@/components/viewer/FlyerChatbot";
import { loadPublicBizad, DEMO_BIZAD, type BizadRecord } from "@/lib/bizad";
import { BizadLayoutView, isBizadLayout } from "@/components/viewer/BizadLayoutView";
import { BizadAudio } from "@/components/viewer/BizadAudio";
import type { BizadAudioSettings } from "@/lib/bizadPage";
import { buildPublicBizadUrl } from "@/lib/utils";
import { deliverAutomationResults, ingestAutomationEvent } from "@/lib/automations/ingestion";
import { toast } from "sonner";

function setPageMeta(selector: string, attr: string, name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

export default function PublicBizad() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [bizad, setBizad] = useState<BizadRecord | null>(null);

  useEffect(() => {
    if (!slug) return;
    if (slug === "demo") {
      setBizad(DEMO_BIZAD);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const row = await loadPublicBizad(slug);
      setBizad(row);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!bizad) return;
    const title = bizad.business_name
      ? `${bizad.business_name} — Digital Card`
      : "Digital Business Card";
    const description =
      bizad.about_text?.trim() ||
      `${bizad.business_name || "Business"} — digital business card on TapThatFlyer.`;
    const image =
      bizad.share_image_url ||
      bizad.flyer_image_url ||
      bizad.logo_url ||
      `${window.location.origin}/og.png`;
    const canonical = buildPublicBizadUrl(bizad.slug);

    const prevTitle = document.title;
    document.title = title;

    setPageMeta(`meta[property="og:title"]`, "property", "og:title", title);
    setPageMeta(`meta[property="og:description"]`, "property", "og:description", description);
    setPageMeta(`meta[property="og:image"]`, "property", "og:image", image);
    setPageMeta(`meta[property="og:url"]`, "property", "og:url", canonical);
    setPageMeta(`meta[property="og:type"]`, "property", "og:type", "website");
    setPageMeta(`meta[name="description"]`, "name", "description", description);
    setPageMeta(`meta[name="twitter:card"]`, "name", "twitter:card", "summary_large_image");
    setPageMeta(`meta[name="twitter:title"]`, "name", "twitter:title", title);
    setPageMeta(`meta[name="twitter:description"]`, "name", "twitter:description", description);
    setPageMeta(`meta[name="twitter:image"]`, "name", "twitter:image", image);

    return () => {
      document.title = prevTitle;
    };
  }, [bizad]);

  useEffect(() => {
    if (!bizad || slug === "demo") return;
    void ingestAutomationEvent({
      eventType: "bizad_viewed",
      sourceType: "bizad",
      sourceId: bizad.id,
      clientEventId: `view:${bizad.id}:${crypto.randomUUID()}`,
    }).then((deliveries) => deliverAutomationResults(deliveries, (title, message) => toast.info(title, { description: message })));
  }, [bizad, slug]);

  const handleBizadAction = useCallback((action: { id?: string; type: string }) => {
    if (!bizad || slug === "demo") return;
    void ingestAutomationEvent({
      eventType: "bizad_action_clicked",
      sourceType: "bizad",
      sourceId: bizad.id,
      metadata: { interaction_id: action.id || "", action_type: action.type },
    }).then((deliveries) => deliverAutomationResults(deliveries, (title, message) => toast.info(title, { description: message })));
  }, [bizad, slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!bizad) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Card not found</h1>
        <p className="text-sm text-muted-foreground">This digital business card doesn&apos;t exist or isn&apos;t published yet.</p>
        <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  const audio = (bizad.layout as { audio?: BizadAudioSettings } | null)?.audio ?? null;
  const chatTitle = bizad.business_name || "Business";

  if (isBizadLayout(bizad.layout)) {
    return (
      <>
        <BizadAudio audio={audio} />
        <BizadLayoutView layout={bizad.layout} bizad={bizad} onAutomationAction={handleBizadAction} />
        {slug !== "demo" && <FlyerChatbot flyerId={bizad.flyer_id} flyerTitle={chatTitle} />}
      </>
    );
  }

  return (
    <>
      <BizadAudio audio={audio} />
      <BizadPageContent bizad={bizad} />
      {slug !== "demo" && <FlyerChatbot flyerId={bizad.flyer_id} flyerTitle={chatTitle} />}
    </>
  );
}
