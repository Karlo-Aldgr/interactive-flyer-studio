import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BizadPageContent } from "@/components/bizad/BizadPageContent";
import { loadPublicBizad, DEMO_BIZAD, type BizadRecord } from "@/lib/bizad";
import { BizadLayoutView, isBizadLayout } from "@/components/viewer/BizadLayoutView";
import { BizadAudio } from "@/components/viewer/BizadAudio";
import type { BizadAudioSettings } from "@/lib/bizadPage";

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
    if (bizad?.business_name) {
      document.title = `${bizad.business_name} — Digital Card`;
    }
  }, [bizad]);

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

  if (isBizadLayout(bizad.layout)) {
    return (
      <>
        <BizadAudio audio={audio} />
        <BizadLayoutView layout={bizad.layout} bizad={bizad} />
      </>
    );
  }

  return (
    <>
      <BizadAudio audio={audio} />
      <BizadPageContent bizad={bizad} />
    </>
  );
}
