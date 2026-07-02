import { supabase } from "@/integrations/supabase/client";

export type AdminUserRow = {
  user_id: string;
  email: string;
  roles: string[];
  job_count: number;
  flyer_count: number;
  signed_up_at: string;
};

export async function loadAdminUsers() {
  const { data, error } = await supabase.rpc("list_users_with_roles");
  if (error) return { users: [] as AdminUserRow[], error };
  return { users: (data ?? []) as AdminUserRow[], error: null };
}

export function primaryRoleLabel(roles: string[]) {
  if (roles.includes("admin")) return "Admin";
  if (roles.includes("editor")) return "Editor";
  return "Customer";
}

export function roleBadgeClass(role: string) {
  switch (role) {
    case "admin":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "editor":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    case "realtor":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}
