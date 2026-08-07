import { z } from "https://esm.sh/zod@3.23.8";

export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const MAX_CAPTION_LENGTH = 2200;

const platformSchema = z.enum(["facebook", "instagram", "tiktok"]);

const httpsUrl = z
  .string()
  .url({ message: "Must be a valid URL" })
  .refine((v) => v.startsWith("https://"), { message: "Media URLs must use https" });

const mediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  url: httpsUrl,
});

const mediaSchema = z
  .union([mediaItemSchema, z.array(mediaItemSchema).min(1).max(10)])
  .transform((v) => (Array.isArray(v) ? v : [v]));

export const manualRequestSchema = z.object({
  mode: z.literal("manual").optional(),
  platforms: z.array(platformSchema).min(1, "Pick at least one platform"),
  caption: z.string().trim().min(1, "Caption is required").max(MAX_CAPTION_LENGTH),
  media: mediaSchema.optional(),
  link: z.string().url().optional(),
  draft_id: z.undefined({
    invalid_type_error: "draft_id cannot be combined with manual content",
  }).optional(),
});

export const draftRequestSchema = z.object({
  mode: z.literal("draft"),
  platforms: z.array(platformSchema).min(1, "Pick at least one platform"),
  draft_id: z.string().uuid("draft_id must be a valid id"),
  caption: z.undefined({ invalid_type_error: "caption cannot be used in draft mode" }).optional(),
  media: z.undefined({ invalid_type_error: "media cannot be used in draft mode" }).optional(),
  link: z.undefined({ invalid_type_error: "link cannot be used in draft mode" }).optional(),
});

export const postRequestSchema = z.discriminatedUnion("mode", [
  manualRequestSchema.extend({ mode: z.literal("manual") }),
  draftRequestSchema,
]);

export type PostRequestInput = z.infer<typeof postRequestSchema>;

export function parsePostRequest(raw: unknown) {
  const body = (raw ?? {}) as Record<string, unknown>;
  const normalized = { mode: body.mode ?? "manual", ...body };
  return postRequestSchema.safeParse(normalized);
}

export function fieldErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

/** HEAD-check that media is reachable and of the declared type. */
export async function verifyMediaReachable(url: string, type: "image" | "video") {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!res.ok) return { ok: false as const, message: `Media URL returned HTTP ${res.status}` };
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.startsWith(type === "image" ? "image/" : "video/")) {
      return {
        ok: false as const,
        message: `Media URL content-type "${contentType}" does not match declared type "${type}"`,
      };
    }
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, message: `Media URL is not reachable: ${String(err).slice(0, 200)}` };
  }
}
