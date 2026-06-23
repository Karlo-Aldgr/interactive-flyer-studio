import { supabase } from "@/integrations/supabase/client";

export type UserJobFlyer = {
  public_slug: string | null;
  status: string | null;
};

export type UserJob = {
  id: string;
  user_id: string;
  customer_email?: string | null;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  type: string;
  brief: string | null;
  price_cents: number | null;
  payment_link: string | null;
  preview_ready: boolean;
  upload_url: string | null;
  selected_actions: string[];
  admin_notes: string | null;
  flyer_id: string | null;
  flyer: UserJobFlyer | null;
  deleted_at?: string | null;
  customer_deletion_reason?: string | null;
  customer_updated_at?: string | null;
  staff_content_seen_at?: string | null;
  staff_acknowledged_at?: string | null;
  share_unlocked?: boolean | null;
  flyer_active?: boolean | null;
  assigned_editor_id?: string | null;
  assigned_at?: string | null;
  editor_started_at?: string | null;
  assigned_editor_email?: string | null;
};

type LoadOptions = {
  limit?: number;
  jobId?: string;
};

async function attachFlyers(rows: Record<string, unknown>[]): Promise<UserJob[]> {
  const flyerIds = [...new Set(rows.map((j) => j.flyer_id).filter(Boolean))] as string[];

  if (flyerIds.length === 0) {
    return rows.map((j) => normalizeJob(j, null));
  }

  const { data: flyers } = await supabase
    .from("flyers")
    .select("id, public_slug, status")
    .in("id", flyerIds);

  const flyerById = new Map((flyers ?? []).map((f) => [f.id, f]));
  return rows.map((j) => {
    const flyerId = j.flyer_id as string | null;
    const flyer = flyerId ? flyerById.get(flyerId) ?? null : null;
    return normalizeJob(j, flyer);
  });
}

function normalizeJob(row: Record<string, unknown>, flyer: { public_slug: string | null; status: string | null } | null): UserJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    customer_email: (row.customer_email as string | null) ?? null,
    title: row.title as string,
    status: row.status as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    type: row.type as string,
    brief: (row.brief as string | null) ?? null,
    price_cents: (row.price_cents as number | null) ?? null,
    payment_link: (row.payment_link as string | null) ?? null,
    preview_ready: !!row.preview_ready,
    upload_url: (row.upload_url as string | null) ?? null,
    selected_actions: (row.selected_actions as string[]) ?? [],
    admin_notes: (row.admin_notes as string | null) ?? null,
    flyer_id: (row.flyer_id as string | null) ?? null,
    flyer: flyer
      ? { public_slug: flyer.public_slug, status: flyer.status }
      : null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    customer_deletion_reason: (row.customer_deletion_reason as string | null) ?? null,
    customer_updated_at: (row.customer_updated_at as string | null) ?? null,
    staff_content_seen_at: (row.staff_content_seen_at as string | null) ?? null,
    staff_acknowledged_at: (row.staff_acknowledged_at as string | null) ?? null,
    share_unlocked: (row.share_unlocked as boolean | null) ?? false,
    flyer_active: (row.flyer_active as boolean | null) ?? true,
  };
}

export async function loadUserJobs(userId: string, options: LoadOptions = {}) {
  let query = supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options.jobId) {
    query = query.eq("id", options.jobId).limit(1);
  } else if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) return { jobs: [] as UserJob[], error };

  const jobs = await attachFlyers((data ?? []) as Record<string, unknown>[]);
  return { jobs, error: null };
}

/** All customer jobs — for editors (and admins via separate policies). */
export async function loadEditorJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { jobs: [] as UserJob[], error };

  const jobs = await attachFlyers((data ?? []) as Record<string, unknown>[]);
  return { jobs, error: null };
}

export function formatJobPrice(cents?: number | null) {
  return typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : null;
}
