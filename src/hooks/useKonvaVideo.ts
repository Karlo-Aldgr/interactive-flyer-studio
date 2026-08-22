import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";

interface Options {
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  poster?: string;
}

/**
 * Creates an HTMLVideoElement for a video URL and keeps the Konva layer
 * repainting while it plays, so the frames show up on the canvas.
 */
export function useKonvaVideo(src: string | undefined, opts: Options = {}) {
  const { autoplay = true, loop = true, muted = true } = opts;
  const nodeRef = useRef<Konva.Image | null>(null);
  const [ready, setReady] = useState(false);

  const video = useMemo(() => {
    if (!src || typeof document === "undefined") return null;
    const el = document.createElement("video");
    el.src = src;
    el.crossOrigin = "anonymous";
    el.playsInline = true;
    el.preload = "auto";
    return el;
  }, [src]);

  useEffect(() => {
    if (!video) return;
    video.loop = loop;
    video.muted = muted;
    const onLoaded = () => setReady(true);
    video.addEventListener("loadeddata", onLoaded);
    if (autoplay) video.play().catch(() => undefined);
    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [video, autoplay, loop, muted]);

  useEffect(() => {
    if (!video || !ready) return;
    const node = nodeRef.current;
    const layer = node?.getLayer();
    if (!layer) return;
    const anim = new Konva.Animation(() => {}, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [video, ready]);

  return { video, ready, nodeRef };
}
