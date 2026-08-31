import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AdminNavKey = "users" | "jobs" | "editors" | "analytics" | "contacts" | "examples" | "mini-ads" | "automation" | "realtor-applications" | "realtor-portal" | "affiliates" | "marketing" | "social-accounts";

type AdminNavProps = {
  active?: AdminNavKey;
  variant?: "bar" | "drawer" | "menu";
};

export const ADMIN_NAV_LINKS: { key: AdminNavKey; to: string; label: string }[] = [
  { key: "users", to: "/admin/users", label: "Users" },
  { key: "jobs", to: "/admin/jobs", label: "Jobs" },
  { key: "editors", to: "/admin/editors", label: "Editors" },
  { key: "marketing", to: "/admin/marketing", label: "Marketing" },
  { key: "social-accounts", to: "/admin/social-accounts", label: "Social accounts" },

  { key: "realtor-applications", to: "/admin/realtor-applications", label: "Listings overview" },
  { key: "realtor-portal", to: "/realtor", label: "Realtor portal" },
  { key: "affiliates", to: "/admin/affiliates", label: "Affiliates" },
  { key: "examples", to: "/admin/examples", label: "Examples" },
  { key: "mini-ads", to: "/admin/mini-ads", label: "Mini-ads" },
  { key: "automation", to: "/admin/automation", label: "Automation" },
  { key: "analytics", to: "/admin/analytics", label: "Analytics" },
  { key: "contacts", to: "/admin/contacts", label: "Contacts" },
];
const PRIMARY_NAV_KEYS: AdminNavKey[] = ["users", "jobs"];

const NAV_GROUPS: { label: string; keys: AdminNavKey[] }[] = [
  { label: "Operations", keys: ["editors", "contacts", "automation", "affiliates"] },
  { label: "Marketing", keys: ["marketing"] },
  { label: "Realtor", keys: ["realtor-applications", "realtor-portal"] },
  { label: "Content", keys: ["examples", "mini-ads"] },
];

const TOOL_LINKS = [
  { to: "/admin/analytics", label: "Analytics", key: "analytics" as AdminNavKey },
  { to: "/dashboard?studio=1", label: "Editor studio" },
  { to: "/dashboard?view=customer", label: "Customer view" },
];

function findNavLink(key: AdminNavKey) {
  return ADMIN_NAV_LINKS.find((l) => l.key === key)!;
}
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
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link to="/dashboard?view=customer">Customer view</Link>
        </Button>
      </>
    );
  }

  if (isDrawer) {
    return (
      <nav className="flex flex-col gap-1">
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
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link to="/dashboard?view=customer">Customer view</Link>
        </Button>
      </nav>
    );
  }


  // Desktop bar: primary buttons + dropdown groups
  return (
    <nav className="flex max-w-full items-center justify-end gap-1.5">
      {/* Always-visible: Users + Jobs */}
      {PRIMARY_NAV_KEYS.map((key) => {
        const { to, label } = findNavLink(key);
        return (
          <Button key={key} asChild variant={linkVariant(key)} size="sm" className="shrink-0">
            <Link to={to}>{label}</Link>
          </Button>
        );
      })}

      {/* Dropdown groups */}
      {NAV_GROUPS.map((group) => {
        const items = group.keys.map(findNavLink);
        const isGroupActive = items.some((item) => item.key === active);
        return (
          <DropdownMenu key={group.label}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isGroupActive ? "secondary" : "outline"}
                size="sm"
                className="shrink-0 gap-1"
              >
                {group.label}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {items.map(({ key, to, label }) => (
                <DropdownMenuItem key={key} asChild>
                  <Link to={to} className={active === key ? "font-semibold" : ""}>
                    {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}

      {/* Tools dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={active === "analytics" ? "secondary" : "outline"}
            size="sm"
            className="shrink-0 gap-1"
          >
            Tools
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {TOOL_LINKS.map(({ to, label, key }) => (
            <DropdownMenuItem key={to} asChild>
              <Link to={to} className={key && active === key ? "font-semibold" : ""}>
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
