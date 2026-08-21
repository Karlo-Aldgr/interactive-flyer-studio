import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import type { BizadAudioSettings } from "@/lib/bizadPage";

/**
 * Mirrors the flyer viewer's audio behaviour on the digital business card:
 * an intro sound that plays once on open and a looping background soundtrack.
 * Both fall back to a tap-to-start prompt when the browser blocks autoplay.
 */
export function BizadAudio({ audio }: { audio: BizadAudioSettings | null | undefined }) {
  const introRef = useRef<HTMLAudioElement | null>(null);
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [muted, setMuted] = useState(false);

  const introUrl = audio?.introAudioUrl;
  const bgUrl = audio?.bgAudioUrl;
  const hasAudio = !!introUrl || !!bgUrl;

  useEffect(() => {
    if (!hasAudio) return;

    const introVol = Math.max(0, Math.min(1, audio?.introAudioVolume ?? 1));
    const bgVol = Math.max(0, Math.min(1, audio?.bgAudioVolume ?? 0.5));
    const bgAutoplay = audio?.bgAudioAutoplay ?? true;

    if (introUrl) {
      const el = new Audio(introUrl);
      el.loop = !!audio?.introAudioLoop;
      el.volume = introVol;
      introRef.current = el;
    }
    if (bgUrl) {
      const el = new Audio(bgUrl);
      el.loop = audio?.bgAudioLoop ?? true;
      el.volume = bgVol;
      bgRef.current = el;
    }

    const start = () => {
      if (startedRef.current) return;
      const players = [introRef.current, bgAutoplay ? bgRef.current : null].filter(Boolean) as HTMLAudioElement[];
      if (!players.length) return;
      Promise.all(players.map((p) => p.play()))
        .then(() => {
          startedRef.current = true;
          setNeedsTap(false);
        })
        .catch(() => setNeedsTap(true));
    };

    start();

    const onGesture = () => start();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      introRef.current?.pause();
      bgRef.current?.pause();
      introRef.current = null;
      bgRef.current = null;
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introUrl, bgUrl]);

  useEffect(() => {
    if (introRef.current) introRef.current.muted = muted;
    if (bgRef.current) bgRef.current.muted = muted;
  }, [muted]);

  if (!hasAudio) return null;

  const showControl = (audio?.bgAudioShowControl ?? true) || (audio?.introAudioShowControl ?? true);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {needsTap && (
        <button
          type="button"
          onClick={() => {
            const players = [introRef.current, bgRef.current].filter(Boolean) as HTMLAudioElement[];
            Promise.all(players.map((p) => p.play()))
              .then(() => {
                startedRef.current = true;
                setNeedsTap(false);
              })
              .catch(() => undefined);
          }}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur"
        >
          <Play className="h-3.5 w-3.5" /> Tap for sound
        </button>
      )}
      {showControl && !needsTap && (
        <button
          type="button"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted((m) => !m)}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
