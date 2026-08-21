export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "x",
  "youtube",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type ConnectionStatus =
  | "connected"
  | "reconnect_required"
  | "permission_missing"
  | "revoked"
  | "error";

export type SocialAccount = {
  id: string;
  platform: SocialPlatform;
  platform_account_id: string;
  account_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  connection_status: ConnectionStatus;
  status_detail: string | null;
  scopes: string[];
  connected_at: string;
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
};

export type SocialMediaItem = {
  type: "image" | "video";
  path?: string;
  url?: string;
  mime_type?: string;
  asset_id?: string;
  file_name?: string;
};

export type VariantStatus =
  | "draft"
  | "queued"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled"
  | "skipped";

export type PostStatus =
  | "draft"
  | "queued"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed"
  | "cancelled";

export type SocialVariant = {
  id: string;
  post_id: string;
  social_account_id: string | null;
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  media: SocialMediaItem[];
  link_url: string | null;
  platform_options: Record<string, unknown>;
  status: VariantStatus;
  remote_post_id: string | null;
  remote_post_url: string | null;
  published_at: string | null;
  last_error: string | null;
};

export type SocialPost = {
  id: string;
  title: string | null;
  content: string;
  link_url: string | null;
  hashtags: string[];
  media: SocialMediaItem[];
  status: PostStatus;
  scheduled_at: string | null;
  schedule_timezone: string | null;
  published_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type PostWithVariants = SocialPost & { variants: SocialVariant[] };

export type PlatformIntegrationStatus = {
  platform: SocialPlatform;
  configured: boolean;
  missing_secrets: string[];
  required_secrets: string[];
  default_scopes: string[];
  approval_notes: string;
  developer_console_url: string;
  capabilities: import("./capabilities").PlatformCapabilities;
  globally_enabled: boolean;
  admin_notes: string | null;
};

export type IntegrationStatusResponse = {
  encryption_configured: boolean;
  callback_url: string;
  scheduler_configured: boolean;
  platforms: PlatformIntegrationStatus[];
};

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

export const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  reconnect_required: "Reconnect required",
  permission_missing: "Permission missing",
  revoked: "Disconnected at platform",
  error: "Error",
};
