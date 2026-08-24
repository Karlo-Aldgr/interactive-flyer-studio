import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PublicWebsite } from "@/components/website/PublicWebsite";
import { loadPublishedWebsite, loadWebsiteByFlyerId, type LoadedWebsite } from "@/lib/websiteLoader";

/**
 * Public / preview website page.
 *  - /site/:slug            → published website only (anonymous visitors)
 *  - /website-preview/:id   → the owner's saved draft (preview, not public)
 *
 * Renders nothing from the editor: no toolbar, no pages panel, no inspector.
 */
export default function PublicWebsitePage({ previewMode = false }: { previewMode?: boolean }) {
  const { slug, flyerId } = useParams();
  const [site, setSite] = useState<LoadedWebsite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const result = previewMode
        ? flyerId
          ? await loadWebsiteByFlyerId(flyerId)
          : null
        : slug
          ? await loadPublishedWebsite(slug)
          : null;
      if (cancelled) return;
      setSite(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [previewMode, slug, flyerId]);

  useEffect(() => {
    if (site?.doc?.brandName) document.title = site.doc.brandName;
  }, [site]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#070B16", color: "#94A3B8" }}>
        Loading…
      </div>
    );
  }

  if (!site) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#070B16",
          color: "#E2E8F0",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Website not available</h1>
          <p style={{ color: "#94A3B8", margin: 0 }}>
            {previewMode ? "This project has no saved website page yet." : "This website has not been published."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {previewMode && site.status !== "published" && (
        <div
          style={{
            position: "fixed",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15,23,42,0.92)",
            color: "#E2E8F0",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 13,
            zIndex: 70,
          }}
        >
          Draft preview — not public yet
        </div>
      )}
      <PublicWebsite doc={site.doc} page={site.page} flyerId={site.flyerId} canSubmitForms={site.status === "published"} />
    </>
  );
}
