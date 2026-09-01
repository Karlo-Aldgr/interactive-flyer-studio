// Secure Zernio bridge. Every privileged Zernio call happens here; the browser
// only ever receives sanitized data and authorization URLs.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient } from "../_shared/social/store.ts";
import {
  normalizePlatform,
  remoteId,
  unwrapList,
  unwrapOne,
  zernio,
  ZERNIO_PLATFORMS,
  zernioConfigured,
  type ZernioAccount,
  type ZernioFailure,
  type ZernioProfile,
} from "../_shared/zernio/client.ts";
import { logZernioEvent, planLimits } from "../_shared/zernio/tenancy.ts";

type Supabase = ReturnType<typeof serviceClient>;

function failureBody(f: ZernioFailure) {
  return { error: f.message, code: f.category };
}

/** Finds, or securely creates, the caller's Zernio profile (exactly one per client). */
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
  const base = (profileRow?.full_name || profileRow?.email || `Client ${userId.slice(0, 8)}`) as string;
  // Zernio profile names are unique per workspace: suffix keeps clients distinct.
  const name = `${base} (${userId.slice(0, 6)})`;

  const created = await zernio.createProfile({ name }, `ttf-profile-${userId}`);

  let remoteProfileId = "";
  let remoteName = name;

  if (created.ok === false) {
    // A duplicate name means the profile already exists remotely — recover it.
    const details = (created as ZernioFailure & { details?: { existingProfileId?: string } }).details;
    if (details?.existingProfileId) {
      remoteProfileId = String(details.existingProfileId);
    } else {
      const lookup = await zernio.listProfiles(name);
      if (lookup.ok) {
        const match = unwrapList<ZernioProfile>(lookup.data, "profiles")[0];
        remoteProfileId = remoteId(match);
      }
    }
    if (!remoteProfileId) {
      await logZernioEvent(supabase, {
        user_id: userId,
        operation: "create_profile",
        success: false,
        http_status: created.status,
        error_category: created.category,
        detail: created.message,
      });
      return { failure: created };
    }
  } else {
    const remote = unwrapOne<ZernioProfile>(created.data, "profile");
    remoteProfileId = remoteId(remote);
    remoteName = (remote.name as string) ?? name;
  }

  if (!remoteProfileId) {
    return {
      failure: {
        ok: false as const,
        category: "unknown" as const,
        status: 0,
        message: "The publishing service did not return a profile. Please try again.",
      },
    };
  }

  const { data: inserted, error } = await supabase
    .from("zernio_profiles")
    .insert({
      user_id: userId,
      zernio_profile_id: remoteProfileId,
      profile_name: remoteName,
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
        message: "Could not save your publishing profile. Please try again.",
      },
    };
  }

  await logZernioEvent(supabase, {
    user_id: userId,
    operation: "create_profile",
    zernio_profile_id: remoteProfileId,
    success: true,
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
    await logZernioEvent(supabase, {
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
  const remote = unwrapList<ZernioAccount>(result.data, "accounts").filter((a) => {
    const owner = remoteId(a.profileId);
    return !owner || owner === profile.zernio_profile_id;
  });
  const keep: string[] = [];

  for (const account of remote) {
    const accountId = remoteId(account);
    if (!accountId) continue;
    keep.push(accountId);
    const healthy = account.needsReconnection ? false : account.isActive !== false;
    await supabase.from("zernio_accounts").upsert(
      {
        user_id: userId,
        profile_id: profile.id,
        zernio_profile_id: profile.zernio_profile_id,
        zernio_account_id: accountId,
        platform: normalizePlatform(account.platform),
        account_name: (account.displayName ?? account.name ?? null) as string | null,
        username: (account.username ?? null) as string | null,
        avatar_url: (account.profileImageUrl ?? account.avatar ?? null) as string | null,
        status: healthy ? "connected" : "reconnect_required",
        status_detail: account.needsReconnection ? "This account needs to be reconnected." : null,
        connected_at: (account.createdAt as string) ?? now,
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

  await logZernioEvent(supabase, {
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
        "Social publishing is not configured yet. An administrator needs to finish the setup.",
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
        profile: profile ? { profile_name: profile.profile_name, status: profile.status } : null,
        has_profile: Boolean(profile),
        platforms: ZERNIO_PLATFORMS,
        accounts,
        limits: await planLimits(supabase, user.id),
      });
    }

    if (action === "ensure_profile" || action === "connect" || action === "sync") {
      const ensured = await ensureProfile(supabase, user.id);
      if (ensured.failure) return json(failureBody(ensured.failure), 400);
      const profile = ensured.row!;

      if (action === "ensure_profile") return json({ ok: true, has_profile: true });

      if (action === "sync") {
        const synced = await syncAccounts(supabase, user.id, profile);
        if (synced.failure) return json(failureBody(synced.failure), 400);
        return json({
          ok: true,
          accounts: await listStoredAccounts(supabase, profile.id),
          limits: await planLimits(supabase, user.id),
        });
      }

      // ---- connect: server-side plan enforcement before handing out a URL --
      const platform = normalizePlatform(body.platform);
      if (!ZERNIO_PLATFORMS.includes(platform as typeof ZERNIO_PLATFORMS[number])) {
        return json({ error: "That platform is not available yet.", code: "invalid_request" }, 400);
      }

      const limits = await planLimits(supabase, user.id);
      const max = limits.plan?.max_social_accounts ?? 0;
      if (max > 0 && limits.usage.connected_accounts >= max) {
        return json({
          error:
            "You've reached your social account limit. Upgrade your plan to connect more accounts.",
          code: "limit_reached",
          limits,
        }, 402);
      }

      const redirectPath =
        typeof body.redirect_path === "string" && body.redirect_path.startsWith("/")
          ? body.redirect_path
          : "/dashboard/social";
      const appBase = (Deno.env.get("SOCIAL_APP_BASE_URL")?.trim() || "https://tapthatflyer.com")
        .replace(/\/$/, "");

      const link = await zernio.connectUrl({
        profileId: profile.zernio_profile_id,
        platform,
        redirectUrl: `${appBase}${redirectPath}?zernio_return=1`,
      });
      if (link.ok === false) {
        await logZernioEvent(supabase, {
          user_id: user.id,
          operation: "connect_url",
          zernio_profile_id: profile.zernio_profile_id,
          platform,
          success: false,
          http_status: link.status,
          error_category: link.category,
          detail: link.message,
        });
        return json(failureBody(link), 400);
      }
      const authorizeUrl = (link.data as { authUrl?: string })?.authUrl;
      if (!authorizeUrl) {
        await logZernioEvent(supabase, {
          user_id: user.id,
          operation: "connect_url",
          zernio_profile_id: profile.zernio_profile_id,
          platform,
          success: false,
          error_category: "unknown",
          detail: "no authUrl in response",
        });
        return json({
          error: "We could not start that connection. Please try again.",
          code: "unknown",
        }, 400);
      }
      await logZernioEvent(supabase, {
        user_id: user.id,
        operation: "connect_url",
        zernio_profile_id: profile.zernio_profile_id,
        platform,
        success: true,
        http_status: link.status,
      });
      await supabase.from("usage_events").insert({
        user_id: user.id,
        event_type: "social_connect_started",
        metadata: { platform },
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
        await logZernioEvent(supabase, {
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
      await logZernioEvent(supabase, {
        user_id: user.id,
        operation: "disconnect",
        zernio_profile_id: row.zernio_profile_id,
        zernio_account_id: row.zernio_account_id,
        platform: row.platform,
        success: true,
      });
      return json({
        ok: true,
        accounts: await listStoredAccounts(supabase, row.profile_id),
        limits: await planLimits(supabase, user.id),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_err) {
    console.error(JSON.stringify({ scope: "zernio", operation: action, success: false }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
