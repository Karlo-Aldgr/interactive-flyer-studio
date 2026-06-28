import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Home, Image as ImageIcon, Eye } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { displayFirstName } from "@/lib/displayName";
import { cn } from "@/lib/utils";
import { loadMyRealtorProfile } from "@/lib/realtorProfile";
import { toast } from "sonner";

const NAV = [
  { to: "/realtor", label: "Listings", icon: Home, match: (p: string) => p === "/realtor" || p.startsWith("/realtor/listing") === false && p.startsWith("/realtor") },
  { to: "/realtor/gallery", label: "Photo Gallery", icon: ImageIcon, match: (p: string) => p.startsWith("/realtor/gallery") || p.includes("/photos") },
];

export function RealtorShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadMyRealtorProfile(user.id).then((p) => setSlug(p?.profile_slug ?? null));
  }, [user]);


  return (
    <div className="min-h-screen w-full bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/realtor" className="flex items-center gap-3">
            <img src={logo} alt="TapThatFlyer" className="h-8 w-auto sm:h-9" />
            <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">Realtor Portal</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.match(location.pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              asChild={!!slug}
              variant="outline"
              size="sm"
              onClick={!slug ? () => toast.error("Set a public URL in Edit profile to enable your public page") : undefined}
            >
              {slug ? (
                <Link to={`/r/${slug}`}>
                  <Eye className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Public page</span>
                </Link>
              ) : (
                <span>
                  <Eye className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Public page</span>
                </span>
              )}
            </Button>

            <span className="hidden text-sm text-muted-foreground md:inline">{displayFirstName(user?.email)}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
