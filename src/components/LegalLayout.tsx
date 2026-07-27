import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-sm font-semibold tracking-tight hover:opacity-80">
            TapThatFlyer
          </Link>
          <nav className="flex gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/data-deletion" className="hover:text-foreground">Data deletion</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground dark:prose-invert">
          {children}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          BOWEN ENTERPRISES LLC · 513 13th Ave S, Columbus, MS 39701
        </p>
      </main>
    </div>
  );
}
