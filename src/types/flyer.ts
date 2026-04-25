// FlyerFlow shared domain types

export type LayerType = "text" | "image" | "icon" | "shape" | "button";

export type ActionType =
  | "open_url"
  | "popup"
  | "video"
  | "call"
  | "sms"
  | "form"
  | "navigate"
  | "reveal";

export interface ActionPayload {
  // open_url
  url?: string;
  newTab?: boolean;
  // popup
  title?: string;
  body?: string;
  mediaUrl?: string;
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
}

export interface LayerAction {
  id: string;
  type: ActionType;
  payload: ActionPayload;
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
