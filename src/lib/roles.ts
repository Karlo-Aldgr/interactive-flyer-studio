import { supabase } from "@/integrations/supabase/client";

async function getSessionUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Read roles from user_roles (RLS: own rows only). Works without has_role RPC. */
async function readOwnRoles(userId: string) {
  return supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const uid = (await getSessionUserId()) ?? userId;

  const { data: rows, error } = await readOwnRoles(uid);
  if (error) {
    console.error("Admin role lookup failed:", error.message);
    return false;
  }
  if (rows?.some((r) => r.role === "admin")) return true;

  // Optional RPC when EXECUTE is granted on the database
  const { data, error: rpcError } = await supabase.rpc("has_role", {
    _user_id: uid,
    _role: "admin",
  });
  if (rpcError) {
    console.warn("has_role RPC unavailable:", rpcError.message);
    return false;
  }
  return !!data;
}

export async function checkCanEdit(): Promise<boolean> {
  const uid = await getSessionUserId();
  if (!uid) return false;

  const { data: rows, error } = await readOwnRoles(uid);
  if (error) {
    console.error("Editor access lookup failed:", error.message);
    return false;
  }
  if (rows?.some((r) => r.role === "admin" || r.role === "editor")) return true;

  const { data, error: rpcError } = await supabase.rpc("current_user_can_edit");
  if (rpcError) {
    console.warn("current_user_can_edit RPC unavailable:", rpcError.message);
    return false;
  }
  return !!data;
}

export async function debugRoleAccess(userId: string) {
  const { data: rows, error } = await readOwnRoles(userId);
  return {
    userId,
    roles: rows?.map((r) => r.role) ?? [],
    error: error?.message ?? null,
  };
}
