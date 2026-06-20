import { supabase } from "@/integrations/supabase/client";
import { sha256Hex } from "@/lib/sha256";

function pinInput(flyerId: string, pin: string) {
  return `${flyerId}::${pin}::tap-that-flyer`;
}

/** Same hash as supabase/functions/waiter-master-auth */
export async function hashWaiterPin(flyerId: string, pin: string): Promise<string> {
  const input = pinInput(flyerId, pin);
  // crypto.subtle only works in secure contexts (HTTPS or localhost).
  // LAN testing at http://192.168.x.x fails without this fallback.
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256Hex(input);
}
export async function masterPinIsSet(flyerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("flyer_master_auth")
    .select("flyer_id")
    .eq("flyer_id", flyerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Owner portal — uses RLS (no edge function required). */
export async function setMasterPin(flyerId: string, pin: string): Promise<void> {
  if (pin.length < 4) throw new Error("PIN must be at least 4 digits");
  if (pin.length > 8) throw new Error("PIN must be at most 8 digits");
  const master_pin_hash = await hashWaiterPin(flyerId, pin);
  const { error } = await supabase
    .from("flyer_master_auth")
    .upsert({ flyer_id: flyerId, master_pin_hash });
  if (error) throw new Error(error.message);
}

export async function verifyMasterPin(flyerId: string, pin: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("flyer_master_auth")
    .select("master_pin_hash")
    .eq("flyer_id", flyerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.master_pin_hash) return false;
  const h = await hashWaiterPin(flyerId, pin);
  return h === data.master_pin_hash;
}

export async function createWaiterWithPin(opts: {
  flyerId: string;
  name: string;
  pin: string;
  color?: string;
}): Promise<void> {
  if (opts.pin.length < 4) throw new Error("PIN must be at least 4 digits");
  const pin_hash = await hashWaiterPin(opts.flyerId, opts.pin);
  const { error } = await supabase.from("waiters").insert({
    flyer_id: opts.flyerId,
    name: opts.name.trim(),
    color: opts.color || "#3b82f6",
    pin_hash,
  });
  if (error) throw new Error(error.message);
}

export async function updateWaiterPin(flyerId: string, waiterId: string, pin: string): Promise<void> {
  if (pin.length < 4) throw new Error("PIN must be at least 4 digits");
  const pin_hash = await hashWaiterPin(flyerId, pin);
  const { error } = await supabase
    .from("waiters")
    .update({ pin_hash })
    .eq("id", waiterId)
    .eq("flyer_id", flyerId);
  if (error) throw new Error(error.message);
}
