import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, Sparkles, Home, ClipboardList, BarChart3, Mail, Workflow } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useIsRealtor } from "@/hooks/useIsRealtor";
import { useRealtorApplication } from "@/hooks/useRealtorApplication";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  match: "exact" | "prefix";
  subtitle?: string;
  muted?: boolean;
};

const baseItems: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, match: "exact" },
  { title: "My projects", url: "/my-jobs", icon: FolderKanban, match: "prefix" },
  { title: "New project", url: "/submit-job", icon: Plus, match: "exact" },
  { title: "Onboarding info", url: "/onboarding", icon: ClipboardList, match: "exact" },
  { title: "Marketing", url: "/marketing", icon: Mail, match: "prefix" },
  { title: "Automations", url: "/automations", icon: Workflow, match: "prefix" },
  { title: "Examples", url: "/examples", icon: Sparkles, match: "exact" },
];

export function CustomerPortalSidebar() {
  const { pathname } = useLocation();
  const { isRealtor } = useIsRealtor();
  const { application } = useRealtorApplication();
  const isActive = (url: string, match: "exact" | "prefix") =>
    match === "exact" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  const realtorPortalItem: NavItem = isRealtor
    ? { title: "Realtor portal", url: "/realtor", icon: Home, match: "prefix" }
    : {
        title: "Realtor portal",
        url: "/realtor/apply",
        icon: Home,
        match: "prefix",
        subtitle:
          application?.status === "rejected"
            ? application.review_notes?.trim() || "Application not approved"
            : application?.status === "pending"
              ? "Application pending review"
              : undefined,
        muted: application?.status === "rejected",
      };

  const clientsPortalItem: NavItem = {
    title: "Clients portal",
    url: "/client-portal",
    icon: BarChart3,
    match: "prefix",
  };

  const items: NavItem[] = [...baseItems, clientsPortalItem, realtorPortalItem];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Customer portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.match)}>
                    <NavLink
                      to={item.url}
                      end={item.match === "exact"}
                      className={cn(
                        "flex items-center gap-2",
                        "subtitle" in item && item.muted && "text-destructive",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex min-w-0 flex-col">
                        <span>{item.title}</span>
                        {"subtitle" in item && item.subtitle && (
                          <span
                            className={cn(
                              "truncate text-[10px] leading-tight",
                              item.muted ? "text-destructive/80" : "text-muted-foreground",
                            )}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
