import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, Sparkles, Home } from "lucide-react";
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

const baseItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, match: "exact" as const },
  { title: "My projects", url: "/my-jobs", icon: FolderKanban, match: "prefix" as const },
  { title: "New project", url: "/submit-job", icon: Plus, match: "exact" as const },
  { title: "Examples", url: "/examples", icon: Sparkles, match: "exact" as const },
];

export function CustomerPortalSidebar() {
  const { pathname } = useLocation();
  const { isRealtor } = useIsRealtor();
  const { application } = useRealtorApplication();
  const isActive = (url: string, match: "exact" | "prefix") =>
    match === "exact" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  const realtorPortalItem = isRealtor
    ? { title: "Realtor portal", url: "/realtor", icon: Home, match: "prefix" as const }
    : {
        title: "Realtor portal",
        url: "/realtor/apply",
        icon: Home,
        match: "prefix" as const,
        subtitle:
          application?.status === "rejected"
            ? application.review_notes?.trim() || "Application not approved"
            : application?.status === "pending"
              ? "Application pending review"
              : undefined,
        muted: application?.status === "rejected",
      };

  const items = [...baseItems, realtorPortalItem];

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
