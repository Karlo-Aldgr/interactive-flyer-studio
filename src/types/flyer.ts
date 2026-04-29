// FlyerFlow shared domain types

export type LayerType = "text" | "image" | "icon" | "shape" | "button" | "hotspot";

export type ActionType =
  | "open_url"
  | "popup"
  | "video"
  | "call"
  | "sms"
  | "form"
  | "navigate"
  | "reveal"
  | "add_to_calendar"
  | "buy_ticket"
  | "rsvp"
  | "checkout"
  | "coupon"
  | "map";

export interface PopupButton {
  id: string;
  label: string;
  style?: "primary" | "secondary";
  action: LayerAction;
}

export interface ActionPayload {
  // open_url
  url?: string;
  newTab?: boolean;
  // popup
  title?: string;
  body?: string;
  mediaUrl?: string;
  buttons?: PopupButton[];
  // video
  videoUrl?: string;
  // call / sms
  phone?: string;
  message?: string;
  // form
  fields?: Array<"name" | "email" | "phone">;
  successMessage?: string;
  // navigate
  pageId?: string;
  // reveal
  targetLayerIds?: string[];
  // add_to_calendar
  eventTitle?: string;
  eventDescription?: string;
  eventLocation?: string;
  startISO?: string;
  endISO?: string;
  allDay?: boolean;
  timezone?: string;
  calendarMode?: "ics" | "google" | "both";
  // buy_ticket
  ticketImageUrl?: string;
  checkoutUrl?: string;
  ticketCtaLabel?: string;
  // rsvp
  rsvpFields?: Array<"name" | "email" | "phone">;
  rsvpAddToCalendar?: boolean;
  // coupon
  couponImageUrl?: string;
  couponCode?: string;
  couponUnlock?: boolean;
  couponUnlockCode?: string;
  couponRedeemUrl?: string;
  // map / GPS
  mapAddress?: string;
  mapLat?: number;
  mapLng?: number;
  mapProvider?: "google" | "apple" | "auto";
}

export interface LayerStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number;
  shadow?: boolean;
  // text
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  align?: "left" | "center" | "right";
  color?: string;
  // shape
  shape?: "rect" | "circle" | "line";
  // icon
  iconName?: string;
  // button
  label?: string;
}

export interface LayerContent {
  text?: string;
  src?: string; // image url
  iconName?: string;
  label?: string;
  shape?: "rect" | "circle" | "line";
  hidden?: boolean; // for reveal action targets
  hotspotShape?: "rect" | "ellipse";
}

export type HighlightStyle = "none" | "pulse" | "solid" | "dashed" | "glow" | "corners";

export interface HighlightConfig {
  enabled?: boolean;        // default true
  style?: HighlightStyle;   // default "pulse"
  color?: string;           // default "#7c3aed"
  thickness?: number;       // default 3
  opacity?: number;         // 0..1, default 0.85
}

export interface LayerAction {
  id: string;
  type: ActionType;
  payload: ActionPayload;
  highlight?: HighlightConfig;
}

export interface Layer {
  id: string;
  page_id: string;
  type: LayerType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  z_index: number;
  style: LayerStyle;
  content: LayerContent;
  action?: LayerAction | null;
}

export interface FlyerPage {
  id: string;
  flyer_id: string;
  index: number;
  name: string;
  background: { color?: string; image?: string };
  layers: Layer[];
}

export interface FlyerSettings {
  width: number;
  height: number;
  background: string;
}

export interface Flyer {
  id: string;
  owner_id: string;
  title: string;
  status: "draft" | "published";
  public_slug: string | null;
  settings: FlyerSettings;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  pages?: FlyerPage[];
}
