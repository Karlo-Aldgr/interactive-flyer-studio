import { Link } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/button";
import { displayFirstName } from "@/lib/displayName";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <div className="min-h-screen w-full min-w-0 bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl min-w-0 items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="shrink-0">
            <img src={logo} alt="TapThatFlyer logo" className="h-8 w-auto sm:h-9" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
            {isAdmin && (
              <>
                <div className="hidden lg:block">
                  <AdminNav variant="bar" />
                </div>
                <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 lg:hidden">
                      <Menu className="h-4 w-4" />
                      <span className="sr-only">Admin menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[min(100vw-2rem,18rem)]">
                    <SheetHeader>
                      <SheetTitle>Admin menu</SheetTitle>
                    </SheetHeader>
                    <nav className="mt-6 flex flex-col gap-1" onClick={() => setAdminOpen(false)}>
                      <AdminNav variant="drawer" />
                    </nav>
                  </SheetContent>
                </Sheet>
              </>
            )}
            <span className="hidden max-w-[8rem] truncate text-sm text-muted-foreground md:inline">
              {displayFirstName(user?.email)}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0 px-2 sm:px-3">
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
