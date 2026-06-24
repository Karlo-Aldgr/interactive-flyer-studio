import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type MiniAd = {
  id: string;
  image_url: string;
  click_url: string;
  alt_text: string | null;
};

type Props = { flyerId: string; previewMode?: boolean };

function getSessionId() {
  try {
    const KEY = "mini_ad_sid";
    let sid = sessionStorage.getItem(KEY);
    if (!sid) {
      sid = `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      sessionStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    return `s_${Date.now()}`;
  }
}

export function MiniAdBanner({ flyerId, previewMode = false }: Props) {
  const [ad, setAd] = useState<MiniAd | null>(null);
  const [enabled, setEnabled] = useState(false);
  const impressionLogged = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: en } = await supabase.rpc("flyer_mini_ad_enabled", { _flyer_id: flyerId });
      if (cancelled || !en) return;
      setEnabled(true);
      const { data: picked } = await supabase.rpc("pick_mini_ad");
      const row = Array.isArray(picked) ? picked[0] : picked;
      if (cancelled || !row) return;
      setAd(row as MiniAd);
    })();
    return () => {
      cancelled = true;
    };
  }, [flyerId]);

  useEffect(() => {
    if (!ad || impressionLogged.current) return;
    impressionLogged.current = true;
    if (previewMode) return;
    supabase.from("mini_ad_events").insert({
      mini_ad_id: ad.id,
      flyer_id: flyerId,
      event_type: "impression",
      session_id: getSessionId(),
    }).then(() => {});
  }, [ad, flyerId, previewMode]);

  if (!enabled || !ad) return null;

  const handleClick = () => {
    if (previewMode) return;
    supabase.from("mini_ad_events").insert({
      mini_ad_id: ad.id,
      flyer_id: flyerId,
      event_type: "click",
      session_id: getSessionId(),
    }).then(() => {});
  };

  return (
    <a
      href={ad.click_url}
      target="_blank"
      rel="noopener sponsored noreferrer"
      onClick={handleClick}
      className="fixed bottom-0 left-0 right-0 z-40 block w-full bg-black/90 shadow-2xl"
      style={{ lineHeight: 0 }}
      aria-label={ad.alt_text || "Sponsored"}
    >
      <div className="relative mx-auto w-full max-w-3xl">
        <img
          src={ad.image_url}
          alt={ad.alt_text || "Sponsored"}
          className="block w-full h-auto max-h-[110px] object-cover"
          loading="lazy"
        />
        <span className="absolute top-1 right-1 rounded-sm bg-white/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black/80">
          Ad
        </span>
      </div>
    </a>
  );
}
