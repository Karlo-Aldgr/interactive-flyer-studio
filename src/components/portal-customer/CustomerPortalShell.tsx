import { Link } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CustomerPortalSidebar } from "./CustomerPortalSidebar";
import { displayFirstName } from "@/lib/displayName";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCanEdit } from "@/hooks/useCanEdit";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  maxWidth?: "3xl" | "4xl" | "6xl";
};

const maxWidthClass = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
};

export function CustomerPortalShell({ children, maxWidth = "4xl" }: Props) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canEdit } = useCanEdit();
  const backLink = isAdmin
    ? { to: "/admin/users", label: "Back to admin" }
    : canEdit
      ? { to: "/dashboard", label: "Back to editor" }
      : null;



  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <CustomerPortalSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <Link to="/dashboard" className="shrink-0">
                <img src={logo} alt="TapThatFlyer logo" className="h-8 w-auto" />
              </Link>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {backLink && (
                <Button asChild variant="outline" size="sm" className="shrink-0 px-2 sm:px-3">
                  <Link to={backLink.to}>
                    <ArrowLeft className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{backLink.label}</span>
                  </Link>
                </Button>
              )}
              <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground md:inline">
                {displayFirstName(user?.email)}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0 px-2 sm:px-3">
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </header>
          <main className={cn("mx-auto w-full min-w-0 px-4 py-6 sm:px-6 sm:py-10", maxWidthClass[maxWidth])}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
