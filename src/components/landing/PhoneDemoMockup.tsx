import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_VIDEO = "/interaction.mp4";
/** HTML volume is capped at 1; Web Audio gain boosts quiet source tracks. */
const VOLUME_GAIN = 2.5;

const BACK_FLYERS = [
  {
    src: "/landing/flyer-fish-house.png",
    alt: "Big Ed's Fish House menu flyer",
    className:
      "left-[-2%] top-[6%] w-[46%] rotate-[14deg] sm:left-[-6%] sm:w-[48%]",
  },
  {
    src: "/landing/flyer-warrior.png",
    alt: "God's Warrior apparel flyer",
    className:
      "bottom-[8%] left-[2%] w-[48%] -rotate-[16deg] sm:left-[-2%] sm:w-[50%]",
  },
  {
    src: "/landing/flyer-container-home.png",
    alt: "Modern container home real estate flyer",
    className:
      "right-[-2%] top-[14%] w-[50%] rotate-[10deg] sm:right-[-8%] sm:w-[52%]",
  },
] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

function BackFlyer({
  src,
  alt,
  className,
  reducedMotion,
}: {
  src: string;
  alt: string;
  className: string;
  reducedMotion: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute z-0 origin-center rounded-lg shadow-2xl transition-transform duration-300 ease-out",
        !reducedMotion && "hover:z-20 hover:scale-[1.08] sm:hover:scale-110",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        className="w-full rounded-lg border border-white/30 bg-card object-cover shadow-lg"
      />
    </div>
  );
}

export function PhoneDemoMockup() {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioBoostRef = useRef<AudioContext | null>(null);
  const [videoSrc] = useState(DEMO_VIDEO);
  const [muted, setMuted] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const applyLoudAudio = (video: HTMLVideoElement) => {
    video.volume = 1;

    if (!audioBoostRef.current) {
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(video);
        const gain = ctx.createGain();
        gain.gain.value = VOLUME_GAIN;
        source.connect(gain);
        gain.connect(ctx.destination);
        audioBoostRef.current = ctx;
      } catch {
        /* MediaElementSource already attached or unsupported — volume=1 only */
      }
    }

    void audioBoostRef.current?.resume();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    const tryAutoplay = async () => {
      applyLoudAudio(video);
      video.muted = true;
      setMuted(true);

      try {
        await video.play();
      } catch {
        return;
      }

      video.muted = false;
      setMuted(false);
      try {
        await video.play();
        setAutoplayBlocked(false);
      } catch {
        video.muted = true;
        setMuted(true);
        setAutoplayBlocked(true);
      }
    };

    void tryAutoplay();
  }, [reducedMotion, videoSrc]);

  useEffect(
    () => () => {
      audioBoostRef.current?.close();
      audioBoostRef.current = null;
    },
    [],
  );

  const toggleMute = async () => {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !muted;
    applyLoudAudio(video);
    video.muted = nextMuted;
    setMuted(nextMuted);

    if (!nextMuted) {
      setAutoplayBlocked(false);
      try {
        await video.play();
      } catch {
        video.muted = true;
        setMuted(true);
      }
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-[440px] justify-center lg:justify-end">
      <div className="relative flex min-h-[500px] w-full items-center justify-center sm:min-h-[560px]">
        <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-tr from-primary/15 via-[hsl(var(--primary-glow)/0.1)] to-transparent blur-2xl sm:-inset-10" />

        {BACK_FLYERS.map((flyer) => (
          <BackFlyer
            key={flyer.src}
            src={flyer.src}
            alt={flyer.alt}
            className={flyer.className}
            reducedMotion={reducedMotion}
          />
        ))}

        <div className="relative z-10 aspect-[9/19] w-[min(260px,72vw)] rotate-[-2deg] rounded-[2.5rem] border-[8px] border-foreground bg-foreground p-1 shadow-2xl sm:w-[280px] sm:rotate-[-4deg] sm:border-[10px] md:w-[300px]">
          <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-foreground [transform:translateZ(0)]">
            <video
              key={videoSrc}
              ref={videoRef}
              src={videoSrc}
              autoPlay={!reducedMotion}
              muted={muted}
              loop={!reducedMotion}
              playsInline
              preload="metadata"
              aria-label="Interactive flyer demo playing inside a phone"
              className="absolute inset-0 h-full w-full rounded-[1.75rem] object-cover object-top [clip-path:inset(0_round_1.75rem)]"
            />
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-3 min-w-14 w-[28%] max-w-20 -translate-x-1/2 rounded-full bg-foreground sm:h-4" />

            {!reducedMotion && (
              <button
                type="button"
                onClick={() => void toggleMute()}
                aria-label={muted ? "Unmute demo video" : "Mute demo video"}
                title={
                  muted
                    ? autoplayBlocked
                      ? "Tap to turn sound on"
                      : "Unmute"
                    : "Mute"
                }
                className="absolute bottom-4 right-3 z-30 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm transition hover:scale-105 hover:bg-black/70"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
