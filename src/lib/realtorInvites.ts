import { supabase } from "@/integrations/supabase/client";

export type RealtorInvite = {
  id: string;
  token: string;
  email: string | null;
  invited_name: string | null;
  note: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

export function acceptUrlFor(token: string) {
  return `${window.location.origin}/realtor/accept?token=${token}`;
}

export async function createRealtorInvite(input: {
  email?: string | null;
  name?: string | null;
  note?: string | null;
  expires_days?: number;
}): Promise<{ id: string; token: string }> {
  const { data, error } = await supabase.rpc("admin_create_realtor_invite" as any, {
    _email: input.email ?? null,
    _name: input.name ?? null,
    _note: input.note ?? null,
    _expires_days: input.expires_days ?? 30,
  });
  if (error) throw error;
  const res = data as any;
  if (!res?.ok) throw new Error(res?.error ?? "Failed to create invite");
  return { id: res.id, token: res.token };
}

export async function listRealtorInvites(): Promise<RealtorInvite[]> {
  const { data, error } = await supabase.rpc("admin_list_realtor_invites" as any);
  if (error) throw error;
  return (data as RealtorInvite[]) ?? [];
}

export async function revokeRealtorInvite(id: string) {
  const { data, error } = await supabase.rpc("admin_revoke_realtor_invite" as any, { _id: id });
  if (error) throw error;
  const res = data as any;
  if (!res?.ok) throw new Error(res?.error ?? "Failed to revoke");
}

export async function resolveRealtorInvite(token: string) {
  const { data, error } = await supabase.rpc("resolve_realtor_invite" as any, { _token: token });
  if (error) throw error;
  return data as {
    ok: boolean;
    error?: string;
    status?: "pending" | "accepted" | "revoked" | "expired";
    email?: string | null;
    invited_name?: string | null;
    note?: string | null;
    expires_at?: string;
  };
}

export async function acceptRealtorInvite(token: string) {
  const { data, error } = await supabase.rpc("accept_realtor_invite" as any, { _token: token });
  if (error) throw error;
  return data as { ok: boolean; error?: string };
}
