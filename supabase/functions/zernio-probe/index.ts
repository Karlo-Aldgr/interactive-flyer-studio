// TEMPORARY diagnostic: verifies profile creation + OAuth URL generation.
// Returns statuses only — never the key.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { remoteId, unwrapOne, zernio, type ZernioProfile } from "../_shared/zernio/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const verify = await zernio.verify();
  const name = `TTF Probe ${Date.now()}`;
  const created = await zernio.createProfile({ name });
  const profileId = created.ok ? remoteId(unwrapOne<ZernioProfile>(created.data, "profile")) : "";

  let connect: unknown = null;
  let accounts: unknown = null;
  if (profileId) {
    const link = await zernio.connectUrl({
      profileId,
      platform: "instagram",
      redirectUrl: "https://tapthatflyer.com/dashboard/social?zernio_return=1",
    });
    connect = link.ok
      ? { ok: true, hasAuthUrl: Boolean(link.data?.authUrl), host: link.data?.authUrl?.slice(0, 60) }
      : { ok: false, status: link.status, message: link.message };
    const acc = await zernio.listAccounts(profileId);
    accounts = acc.ok ? { ok: true, body: JSON.stringify(acc.data).slice(0, 200) } : { ok: false, message: acc.message };
    await zernio.deleteProfile(profileId);
  }

  return json({
    verify: { ok: verify.ok, status: verify.status },
    create_profile: created.ok ? { ok: true, profileId } : { ok: false, status: created.status, message: created.message },
    connect,
    accounts,
  });
});
