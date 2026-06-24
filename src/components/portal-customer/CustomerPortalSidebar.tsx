import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, Sparkles } from "lucide-react";
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

const items = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, match: "exact" as const },
  { title: "My projects", url: "/my-jobs", icon: FolderKanban, match: "prefix" as const },
  { title: "New project", url: "/submit-job", icon: Plus, match: "exact" as const },
  { title: "Examples", url: "/examples", icon: Sparkles, match: "exact" as const },
];

export function CustomerPortalSidebar() {
  const { pathname } = useLocation();
  const isActive = (url: string, match: "exact" | "prefix") =>
    match === "exact" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

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
                    <NavLink to={item.url} end={item.match === "exact"} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
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
