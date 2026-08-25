export function toEmbedVideoUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  if (raw.includes("youtube.com/watch")) {
    const id = new URL(raw).searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : raw;
  }
  if (raw.includes("youtu.be/")) {
    const id = raw.split("youtu.be/")[1]?.split(/[?#]/)[0];
    return id ? `https://www.youtube.com/embed/${id}` : raw;
  }
  return raw;
}

export function BizadVideoEmbed({ url, className = "" }: { url: string; className?: string }) {
  const embed = toEmbedVideoUrl(url);
  if (!embed) return null;

  const isDirect = /\.(mp4|webm|mov)(\?|$)/i.test(embed) || embed.startsWith("blob:");

  return (
    <section className={`w-full overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5 ${className}`}>
      {isDirect ? (
        <video src={embed} controls playsInline className="aspect-video w-full bg-black" />
      ) : (
        <iframe
          src={embed}
          title="Business video"
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </section>
  );
}
