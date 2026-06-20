import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminNavKey = "jobs" | "editors" | "analytics" | "contacts" | "examples";

type AdminNavProps = {
  active?: AdminNavKey;
  variant?: "bar" | "drawer" | "menu";
};

export const ADMIN_NAV_LINKS: { key: AdminNavKey; to: string; label: string }[] = [
  { key: "jobs", to: "/admin/jobs", label: "Jobs" },
  { key: "editors", to: "/admin/editors", label: "Editors" },
  { key: "examples", to: "/admin/examples", label: "Examples" },
  { key: "analytics", to: "/admin/analytics", label: "Analytics" },
  { key: "contacts", to: "/admin/contacts", label: "Contacts" },
];

export function AdminNav({ active, variant = "bar" }: AdminNavProps) {
  const isDrawer = variant === "drawer";
  const isMenu = variant === "menu";

  const linkVariant = (key: AdminNavKey) => (active === key ? "secondary" : "outline");

  if (isMenu) {
    return (
      <>
        {ADMIN_NAV_LINKS.map(({ key, to, label }) => (
          <Button
            key={key}
            asChild
            variant={linkVariant(key)}
            size="sm"
            className="w-full justify-start"
          >
            <Link to={to}>{label}</Link>
          </Button>
        ))}
        <Button asChild variant="outline" size="sm" className="mt-2 w-full justify-start">
          <Link to="/dashboard?studio=1">Editor studio</Link>
        </Button>
      </>
    );
  }

  return (
    <nav
      className={cn(
        isDrawer
          ? "flex flex-col gap-1"
          : "flex max-w-full flex-wrap items-center justify-end gap-1",
      )}
    >
      {ADMIN_NAV_LINKS.map(({ key, to, label }) => (
        <Button
          key={key}
          asChild
          variant={linkVariant(key)}
          size="sm"
          className={cn(isDrawer && "w-full justify-start", !isDrawer && "shrink-0")}
        >
          <Link to={to}>{label}</Link>
        </Button>
      ))}
      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn(isDrawer ? "mt-2 w-full justify-start" : "shrink-0")}
      >
        <Link to="/dashboard?studio=1">Editor studio</Link>
      </Button>
    </nav>
  );
}
