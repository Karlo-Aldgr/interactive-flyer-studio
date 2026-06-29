import { Link } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import { AdminNav, type AdminNavKey } from "@/components/admin/AdminNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { displayFirstName } from "@/lib/displayName";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type AdminLayoutProps = {
  active?: AdminNavKey;
  children: React.ReactNode;
};

export function AdminLayout({ active, children }: AdminLayoutProps) {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen w-full min-w-0 bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl min-w-0 items-center justify-between gap-2 px-4 py-2 sm:min-h-16 sm:px-6 sm:py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 lg:hidden">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open admin menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100vw-2rem,18rem)]">
                <SheetHeader>
                  <SheetTitle>Admin menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1" onClick={() => setOpen(false)}>
                  <AdminNav active={active} variant="drawer" />
                </nav>
              </SheetContent>
            </Sheet>
            <Link to="/admin/users" className="shrink-0">
              <img src={logo} alt="TapThatFlyer" className="h-8 w-auto sm:h-9" />
            </Link>
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              Super admin
            </Badge>
          </div>

          <div className="hidden min-w-0 flex-1 justify-end overflow-x-auto py-1 lg:flex">
            <AdminNav active={active} variant="bar" />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
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
      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
