// Secure Zernio bridge. Every privileged Zernio call happens here; the browser
// only ever receives sanitized data and authorization URLs.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient } from "../_shared/social/store.ts";
import {
  unwrapList,
  unwrapOne,
  zernio,
  zernioConfigured,
  type ZernioAccount,
  type ZernioFailure,
  type ZernioProfile,
} from "../_shared/zernio/client.ts";

/** Platforms TapThatFlyer is prepared to surface. Availability comes from Zernio. */
const KNOWN_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
  "x",
  "pinterest",
  "threads",
  "bluesky",
  "reddit",
  "google_business",
  "telegram",
  "snapchat",
  "whatsapp",
  "discord",
  "slack",
] as const;

type Supabase = ReturnType<typeof serviceClient>;

async function logEvent(
  supabase: Supabase,
  entry: {
    user_id: string | null;
    operation: string;
    zernio_profile_id?: string | null;
    zernio_account_id?: string | null;
    platform?: string | null;
    success: boolean;
    http_status?: number | null;
    error_category?: string | null;
    detail?: string | null;
  },
) {
  // Structured, secret-free audit trail.
  console.log(
    JSON.stringify({
      scope: "zernio",
      operation: entry.operation,
      user_id: entry.user_id,
      profile: entry.zernio_profile_id ?? null,
      account: entry.zernio_account_id ?? null,
      platform: entry.platform ?? null,
      success: entry.success,
      status: entry.http_status ?? null,
      error_category: entry.error_category ?? null,
      at: new Date().toISOString(),
    }),
  );
  await supabase.from("zernio_events").insert({
    user_id: entry.user_id,
    operation: entry.operation,
    zernio_profile_id: entry.zernio_profile_id ?? null,
    zernio_account_id: entry.zernio_account_id ?? null,
    platform: entry.platform ?? null,
    success: entry.success,
    http_status: entry.http_status ?? null,
    error_category: entry.error_category ?? null,
    detail: entry.detail?.slice(0, 500) ?? null,
  });
}

function failureBody(f: ZernioFailure) {
  return { error: f.message, code: f.category };
}

function normalizePlatform(value: unknown) {
  const raw = String(value ?? "").toLowerCase().trim();
  if (!raw) return "unknown";
  if (raw === "twitter") return "x";
  if (raw === "gmb" || raw === "google-business" || raw === "google_my_business") {
    return "google_business";
  }
  return raw.replace(/[\s-]+/g, "_");
}

/** Finds, or securely creates, the caller's Zernio profile. */
async function ensureProfile(supabase: Supabase, userId: string) {
  const { data: existing } = await supabase
    .from("zernio_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return { row: existing };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const name = (profileRow?.full_name || profileRow?.email || `Client ${userId.slice(0, 8)}`) as string;

  const created = await zernio.createProfile({ name, external_id: userId });
  if (created.ok === false) {
    await logEvent(supabase, {
      user_id: userId,
      operation: "create_profile",
      success: false,
      http_status: created.status,
      error_category: created.category,
    });
    return { failure: created };
  }

  const remote = unwrapOne<ZernioProfile>(created.data);
  const remoteId = String(remote.id ?? "");
  if (!remoteId) {
    await logEvent(supabase, {
      user_id: userId,
      operation: "create_profile",
      success: false,
      error_category: "unknown",
      detail: "Zernio returned no profile id",
    });
    return {
      failure: {
        ok: false as const,
        category: "unknown" as const,
        status: 0,
        message: "Zernio did not return a profile. Please try again.",
      },
    };
  }

  const { data: inserted, error } = await supabase
    .from("zernio_profiles")
    .insert({
      user_id: userId,
      zernio_profile_id: remoteId,
      profile_name: (remote.name as string) ?? name,
      status: "active",
    })
    .select("*")
    .single();
  if (error) {
    // Lost a race: re-read the winning row.
    const { data: retry } = await supabase
      .from("zernio_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (retry) return { row: retry };
    return {
      failure: {
        ok: false as const,
        category: "unknown" as const,
        status: 0,
        message: "Could not save your Zernio profile. Please try again.",
      },
    };
  }

  await logEvent(supabase, {
    user_id: userId,
    operation: "create_profile",
    zernio_profile_id: remoteId,
    success: true,
    http_status: created.status,
  });
  return { row: inserted };
}

/** Pulls the live account list from Zernio and mirrors it onto our tables. */
async function syncAccounts(
  supabase: Supabase,
  userId: string,
  profile: { id: string; zernio_profile_id: string },
) {
  const result = await zernio.listAccounts(profile.zernio_profile_id);
  if (result.ok === false) {
    await logEvent(supabase, {
      user_id: userId,
      operation: "sync_accounts",
      zernio_profile_id: profile.zernio_profile_id,
      success: false,
      http_status: result.status,
      error_category: result.category,
    });
    return { failure: result };
  }

  const now = new Date().toISOString();
  const remote = unwrapList<ZernioAccount>(result.data);
  const keep: string[] = [];

  for (const account of remote) {
    const remoteId = String(account.id ?? "");
    if (!remoteId) continue;
    keep.push(remoteId);
    await supabase.from("zernio_accounts").upsert(
      {
        user_id: userId,
        profile_id: profile.id,
        zernio_profile_id: profile.zernio_profile_id,
        zernio_account_id: remoteId,
        platform: normalizePlatform(account.platform ?? account.provider),
        account_name: (account.name ?? account.display_name ?? null) as string | null,
        username: (account.username ?? account.handle ?? null) as string | null,
        avatar_url: (account.avatar_url ?? account.avatar ?? account.picture ?? null) as string | null,
        status: String(account.status ?? "connected"),
        connected_at: (account.connected_at as string) ?? now,
        last_synced_at: now,
        metadata: account as Record<string, unknown>,
      },
      { onConflict: "zernio_profile_id,zernio_account_id" },
    );
  }

  // Anything Zernio no longer reports is marked disconnected (never deleted,
  // so historical posts keep their reference).
  let stale = supabase
    .from("zernio_accounts")
    .update({ status: "disconnected", last_synced_at: now })
    .eq("profile_id", profile.id)
    .neq("status", "disconnected");
  if (keep.length) stale = stale.not("zernio_account_id", "in", `(${keep.join(",")})`);
  await stale;

  await logEvent(supabase, {
    user_id: userId,
    operation: "sync_accounts",
    zernio_profile_id: profile.zernio_profile_id,
    success: true,
    http_status: result.status,
    detail: `${remote.length} account(s)`,
  });
  return { count: remote.length };
}

async function listStoredAccounts(supabase: Supabase, profileId: string) {
  const { data } = await supabase
    .from("zernio_accounts")
    .select(
      "id, platform, account_name, username, avatar_url, status, status_detail, connected_at, last_synced_at, zernio_account_id",
    )
    .eq("profile_id", profileId)
    .order("platform");
  return data ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "status");
  const supabase = serviceClient();

  const configured = await zernioConfigured();
  if (!configured && action !== "status") {
    return json({
      error:
        "Social publishing is not configured yet. An administrator needs to add the Zernio API key.",
      code: "not_configured",
    }, 400);
  }

  try {
    if (action === "status") {
      const { data: profile } = await supabase
        .from("zernio_profiles")
        .select("id, zernio_profile_id, profile_name, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      const accounts = profile ? await listStoredAccounts(supabase, profile.id) : [];
      return json({
        configured,
        profile: profile
          ? { profile_name: profile.profile_name, status: profile.status }
          : null,
        has_profile: Boolean(profile),
        platforms: KNOWN_PLATFORMS,
        accounts,
      });
    }

    if (action === "ensure_profile" || action === "connect" || action === "sync") {
      const ensured = await ensureProfile(supabase, user.id);
      if (ensured.failure) return json(failureBody(ensured.failure), 400);
      const profile = ensured.row!;

      if (action === "ensure_profile") {
        return json({ ok: true, has_profile: true });
      }

      if (action === "sync") {
        const synced = await syncAccounts(supabase, user.id, profile);
        if (synced.failure) return json(failureBody(synced.failure), 400);
        return json({ ok: true, accounts: await listStoredAccounts(supabase, profile.id) });
      }

      // connect
      const platform = body.platform ? normalizePlatform(body.platform) : undefined;
      const redirectPath = typeof body.redirect_path === "string" && body.redirect_path.startsWith("/")
        ? body.redirect_path
        : "/dashboard/social";
      const appBase = (Deno.env.get("SOCIAL_APP_BASE_URL")?.trim() || "https://tapthatflyer.com")
        .replace(/\/$/, "");
      const link = await zernio.createConnectionUrl({
        profileId: profile.zernio_profile_id,
        platform,
        redirectUrl: `${appBase}${redirectPath}?zernio_connected=1`,
      });
      if (link.ok === false) {
        await logEvent(supabase, {
          user_id: user.id,
          operation: "connect_url",
          zernio_profile_id: profile.zernio_profile_id,
          platform: platform ?? null,
          success: false,
          http_status: link.status,
          error_category: link.category,
        });
        return json(failureBody(link), 400);
      }
      const payload = unwrapOne<Record<string, unknown>>(link.data);
      const authorizeUrl = [payload.url, payload.connect_url, payload.authorize_url, payload.link]
        .find((v) => typeof v === "string" && v);
      if (!authorizeUrl) {
        await logEvent(supabase, {
          user_id: user.id,
          operation: "connect_url",
          zernio_profile_id: profile.zernio_profile_id,
          platform: platform ?? null,
          success: false,
          error_category: "unknown",
          detail: "no url in response",
        });
        return json({
          error: "Zernio did not return a connection link. Please try again.",
          code: "unknown",
        }, 400);
      }
      await logEvent(supabase, {
        user_id: user.id,
        operation: "connect_url",
        zernio_profile_id: profile.zernio_profile_id,
        platform: platform ?? null,
        success: true,
        http_status: link.status,
      });
      return json({ authorize_url: String(authorizeUrl) });
    }

    if (action === "disconnect") {
      const accountId = String(body.account_id ?? "");
      // Ownership is enforced server-side: the row must belong to the caller.
      const { data: row } = await supabase
        .from("zernio_accounts")
        .select("id, user_id, zernio_account_id, zernio_profile_id, platform, profile_id")
        .eq("id", accountId)
        .maybeSingle();
      if (!row || row.user_id !== user.id) {
        return json({ error: "That account was not found on your workspace.", code: "not_found" }, 404);
      }
      const result = await zernio.disconnectAccount(row.zernio_account_id);
      if (result.ok === false && result.category !== "not_found") {
        await logEvent(supabase, {
          user_id: user.id,
          operation: "disconnect",
          zernio_profile_id: row.zernio_profile_id,
          zernio_account_id: row.zernio_account_id,
          platform: row.platform,
          success: false,
          http_status: result.status,
          error_category: result.category,
        });
        return json(failureBody(result), 400);
      }
      await supabase
        .from("zernio_accounts")
        .update({ status: "disconnected", last_synced_at: new Date().toISOString() })
        .eq("id", row.id);
      await logEvent(supabase, {
        user_id: user.id,
        operation: "disconnect",
        zernio_profile_id: row.zernio_profile_id,
        zernio_account_id: row.zernio_account_id,
        platform: row.platform,
        success: true,
      });
      return json({ ok: true, accounts: await listStoredAccounts(supabase, row.profile_id) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[zernio-accounts]", err instanceof Error ? err.message : "unknown error");
    return json({ error: "Something went wrong. Please try again.", code: "unknown" }, 500);
  }
});
