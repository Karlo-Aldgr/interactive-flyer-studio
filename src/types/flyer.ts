// TapThatFlyer shared domain types

export type LayerType = "text" | "image" | "icon" | "shape" | "button" | "hotspot" | "video";

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
  | "map"
  | "audio"
  | "buy_product"
  | "air_messages"
  | "poll"
  | "subscribe"
  | "book_appointment"
  | "download_vcard"
  | "gallery"
  | "survey"
  | "testimonial"
  | "reserve_table"
  | "schedule_consultation"
  | "show_menu"
  | "join_challenge"
  | "business_rating"
  | "menu_add_item"
  | "product_grid"
  | "novel"
  | "realtor_gallery"
  | "carousel";

/** One slide of a multi-view scrolling carousel (video or flyer image). */
export interface CarouselSlide {
  id: string;
  kind: "video" | "image";
  mediaUrl?: string;
  posterUrl?: string;      // optional poster for video slides
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaBgColor?: string;
  ctaTextColor?: string;
  ctaAction?: LayerAction | null;
  tapAction?: LayerAction | null;
  videoAutoplay?: boolean; // default true (muted)
  videoLoop?: boolean;     // default true
  videoShowMute?: boolean; // default true
}

export type CarouselDirection = "horizontal" | "vertical";

export interface NovelChapter {
  id: string;
  number: number;
  title: string;
  body: string;
  free?: boolean;            // overrides bundle/free preview
  price?: number;            // optional per-chapter price override
}


export interface ProductGridItem {
  id: string;
  name: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  description?: string;
  sizesEnabled?: boolean;
  sizes?: string[]; // subset of ["S","M","L","XL","2XL","3XL","4XL","5XL","6XL"]
}

export interface SurveyQuestion {
  id: string;
  label: string;
  type: "text" | "choice" | "rating";
  options?: string[];
  required?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: string;
  imageUrl?: string;
}
export interface MenuSection {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
  action?: LayerAction | null;
}

/** Weekly availability for slot-mode appointments. Day index 0 = Sunday. */
export interface AppointmentDayAvailability {
  enabled: boolean;
  startMinute: number; // minutes from 00:00 local (e.g. 9*60 = 540)
  endMinute: number;
}

export type AppointmentMode = "slots" | "free";

export interface PopupButton {
  id: string;
  label: string;
  style?: "primary" | "secondary";
  bgColor?: string;
  textColor?: string;
  action: LayerAction;
}

/** A clickable region drawn on top of a popup's image. Coords are 0..1 of the image. */
export interface PopupHotspot {
  id: string;
  x: number;       // 0..1
  y: number;       // 0..1
  width: number;   // 0..1
  height: number;  // 0..1
  shape?: "rect" | "ellipse";
  label?: string;
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
  hotspots?: PopupHotspot[];
  popupBgColor?: string;
  popupTextColor?: string;
  popupTitleSize?: number;
  popupBodySize?: number;
  popupAudioUrl?: string;
  popupAudioAutoplay?: boolean;
  popupAudioLoop?: boolean;
  popupAudioVolume?: number; // 0..1
  popupAudioShowControl?: boolean;
  // video
  videoUrl?: string;
  // audio
  audioUrl?: string;
  audioAutoplay?: boolean;
  audioLoop?: boolean;
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
  // buy_product (payment link based — Stripe / PayPal / Venmo / Cash App, etc.)
  productName?: string;
  productPrice?: string;        // e.g. "25" or "25.00" — free-form so users can include their own currency
  productCurrency?: string;     // e.g. "USD", "EUR", "$" — display only
  productImageUrl?: string;
  productDescription?: string;
  productPaymentUrl?: string;   // payment link the buyer is sent to
  productCtaLabel?: string;     // e.g. "Buy now"
  productCartEnabled?: boolean; // when true, shows "Add to cart" instead of opening payment link directly
  productId?: string;           // stable id used for cart de-dup; falls back to layer/action id

  // air_messages — iMessage-style bubble sequence
  bubbles?: AirMessageBubble[];
  bubbleStaggerMs?: number;     // delay between bubbles, default 900
  bubbleStartDelayMs?: number;  // delay before the FIRST bubble appears, default 0
  // Auto-trigger: fire this action automatically when the page loads
  autoTrigger?: boolean;

  // poll — anonymous, live results stored in poll_votes
  pollQuestion?: string;
  pollOptions?: PollOption[];
  pollMultiple?: boolean;       // allow voting for more than one option

  // subscribe — collects email signups into the subscribers table
  subscribeTitle?: string;
  subscribeBody?: string;
  subscribeButtonLabel?: string;
  subscribeListName?: string;        // optional tag (e.g. "VIP", "Newsletter")
  subscribePhoneEnabled?: boolean;   // collect phone (optional field)
  subscribePhoneRequired?: boolean;  // make phone required
  subscribeNameRequired?: boolean;   // default true
  subscribeSuccessMessage?: string;

  // book_appointment — calendar bookings
  apptMode?: AppointmentMode;            // "slots" | "free"
  apptTitle?: string;
  apptLocation?: string;
  apptDescription?: string;
  apptDurationMin?: number;              // 15/30/45/60/90/etc.
  apptBufferMin?: number;                // minutes between slots (slot mode)
  apptTimezone?: string;                 // IANA tz, e.g. America/New_York
  apptDateRangeDays?: number;            // how many days ahead bookable
  apptMaxPerDay?: number;                // optional cap per day
  apptWeeklyAvailability?: AppointmentDayAvailability[]; // length 7, idx 0 = Sunday
  apptBlackoutDates?: string[];          // ISO yyyy-mm-dd dates that are unavailable
  apptCollectPhone?: boolean;
  apptPhoneRequired?: boolean;
  apptCollectNote?: boolean;
  apptConfirmSubject?: string;           // email subject override
  apptConfirmIntro?: string;             // optional custom intro paragraph in email
  apptSuccessMessage?: string;           // shown after booking

  // gallery — photo gallery popup (up to 12 images)
  galleryTitle?: string;
  galleryImages?: GalleryImage[];

  // realtor_gallery — links to a realtor listing's standalone photo gallery
  realtorListingId?: string;
  realtorGalleryTitle?: string;

  // survey
  surveyTitle?: string;
  surveyDescription?: string;
  surveyQuestions?: SurveyQuestion[];
  surveySuccessMessage?: string;

  // testimonial
  testimonialTitle?: string;
  testimonialCtaLabel?: string;
  testimonialAllowPhoto?: boolean;
  testimonialAutoApprove?: boolean;
  testimonialSuccessMessage?: string;

  // reserve_table
  reserveTitle?: string;
  reserveMaxParty?: number;
  reserveOpenTime?: string;  // "11:00"
  reserveCloseTime?: string; // "22:00"
  reserveSlotMinutes?: number; // 30
  reserveDateRangeDays?: number; // 30
  reserveSuccessMessage?: string;

  // schedule_consultation
  consultTitle?: string;
  consultDescription?: string;
  consultTopics?: string[];
  consultDurations?: number[]; // [15, 30, 60]
  consultDateRangeDays?: number;
  consultSuccessMessage?: string;

  // show_menu (data stored in `menus` table; payload holds display config)
  menuTitle?: string;
  menuCtaLabel?: string;
  menuCurrency?: string;
  menuCheckoutMode?: "order_only" | "payment";
  menuPaymentLink?: string;
  menuPaymentInstructions?: string;
  menuSpecials?: { id: string; title: string; description?: string; code?: string; imageUrl?: string }[];


  // menu_add_item — clickable product hotspot on a scanned menu page
  menuItem?: {
    id?: string;
    name: string;
    price?: number;
    description?: string;
    category?: "main" | "side" | "drink" | "dessert" | "other";
    color?: string;
  };

  // product_grid — multi-product shop popup
  productGridTitle?: string;
  productGridCtaLabel?: string;
  products?: ProductGridItem[];

  // join_challenge
  challengeTitle?: string;
  challengeDescription?: string;
  challengeStartISO?: string;
  challengeEndISO?: string;
  challengeRules?: string;
  challengeCtaLabel?: string;
  challengeSuccessMessage?: string;
  challengeCollectPhone?: boolean;

  // business_rating
  ratingPrompt?: string;
  ratingAllowComment?: boolean;
  ratingThankYou?: string;

  // novel — interactive story/book reader with paid chapter unlocks
  novelBookTitle?: string;
  novelAuthor?: string;
  novelCoverUrl?: string;
  novelManuscript?: string;                // raw pasted text (kept so author can re-split)
  novelChapters?: NovelChapter[];
  novelFreeCount?: number;                 // first N chapters free (default 3) — used when chapter.free is undefined
  novelBundlePrice?: number;               // unlock-all price
  novelChapterPrice?: number;              // default per-chapter price
  novelCurrency?: string;                  // "USD", "EUR", "$"
  novelPaypalHandle?: string;              // PayPal.me handle, no leading @
  novelPaypalEmail?: string;               // PayPal business email (fallback)
  novelPaypalBundleLink?: string;          // fixed full-book PayPal payment link (optional)
  novelFollowEnabled?: boolean;            // show "Follow author (free)" button (default true)
  novelSubscribeEnabled?: boolean;         // show paid subscribe option
  novelSubscribePrice?: number;            // monthly subscribe price
  novelSubscribeUrl?: string;              // PayPal subscription button URL (author-provided)
  novelShowFlyerPrice?: boolean;           // floating price on flyer cover (default true)
  novelFlyerPriceCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";

  // carousel — multi-view scrolling video / flyer gallery
  carouselTitle?: string;
  carouselDirection?: CarouselDirection;   // default "horizontal"
  carouselStartIndex?: number;             // 0-based slide to open on
  carouselSlides?: CarouselSlide[];
  carouselHeadline?: string;               // text shown above the carousel
  carouselSubtext?: string;                // text shown below the carousel
  carouselBgColor?: string;                // background behind the carousel
  carouselTextColor?: string;              // headline / subtext color
  carouselCardRatio?: "9:16" | "4:5" | "1:1";
}

export type BubbleTextCase = "as-is" | "upper" | "lower";
export type BubbleTail = "none" | "down" | "up" | "left" | "right";

export interface AirMessageBubble {
  id: string;
  /** @deprecated kept for back-compat; new bubbles ignore left/right grey/blue split */
  side?: "left" | "right";
  text?: string;
  imageUrl?: string;
  reaction?: "heart" | "like" | "dislike" | "haha" | "exclaim" | "question" | "";
  action?: LayerAction | null;  // tap action
  // Per-bubble look (the big bright pill style)
  bgColor?: string;        // e.g. "#1d9bf0" — solid or gradient start
  bgColor2?: string;       // optional gradient end
  textColor?: string;      // default white
  textCase?: BubbleTextCase; // default "as-is"
  tail?: BubbleTail;       // default "down"
  bold?: boolean;          // default true
  fontSize?: number;       // manual font size in px; if unset, auto-fit to bubble height
  /** Manual intro time in ms from sequence start. If unset, falls back to index * bubbleStaggerMs. */
  delayMs?: number;
}

export interface PollOption {
  id: string;
  label: string;
}

export interface LayerStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number;
  shadow?: boolean;
  /** image fit: "cover" crops to fill the box (no stretching). */
  fit?: "cover" | "fill";
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
  shape?: "rect" | "circle" | "line" | "square" | "triangle" | "octagon" | "divider";
  lineStyle?: "solid" | "dashed";
  hidden?: boolean; // for reveal action targets
  hotspotShape?: "rect" | "ellipse";
  /** video layer */
  videoUrl?: string;
  posterUrl?: string;
  videoAutoplay?: boolean;
  videoLoop?: boolean;
  videoMuted?: boolean;
  /** Source image layer id when this layer is a non-destructive cutout */
  extractedFrom?: string;
  /** Normalized 0..1 region within the source image layer */
  extractionBbox?: { x: number; y: number; w: number; h: number };
  subjectLabel?: string;
}

export type HighlightStyle = "none" | "pulse" | "solid" | "dashed" | "glow" | "corners" | "circle";

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
  intro?: PageIntro | null; // per-layer intro override (takes precedence over page intro)
}

export type IntroPreset =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom"
  | "pop"
  | "blur"
  | "drop";

export interface PageIntro {
  preset: IntroPreset;
  durationMs?: number;   // default 600
  delayMs?: number;      // default 0
  stagger?: boolean;     // default false
  staggerStepMs?: number;// default 80
  loop?: boolean;        // default false — replay animation continuously
  loopDelayMs?: number;  // default 1000 — pause between loop iterations
}

export interface FlyerPage {
  id: string;
  flyer_id: string;
  index: number;
  name: string;
  background: {
    color?: string;
    image?: string;
    /** Optional per-page canvas size override. When set, this page renders at this size instead of the flyer's default. */
    size?: { width: number; height: number };
    /** When set, tapping anywhere on this page navigates to the page with this id (used for landing → flyer). */
    linkPageId?: string;
    /** Marks this page as the editable Digital business card page (editor-only, never shown in the viewer). */
    bizadPage?: boolean;
    /** Digital business card page is toggled off — kept in the editor but not published. */
    bizadHidden?: boolean;
    /** Auto-generated bizad layout version marker (e.g. vontastic_v1). */
    bizadLayoutSource?: string;
    /** Marks this page as the single long-scrolling Website page (editor-only for now). */
    websitePage?: boolean;
    /** Which responsive width the Website page is currently being edited at. */
    websiteDevice?: "desktop" | "tablet" | "mobile";
    /** Snapshot of the client/project profile the Website was generated from (used to rebuild per viewport). */
    websiteProfile?: unknown;
  };


  layers: Layer[];
  intro?: PageIntro | null;
}

export interface FlyerSettings {
  width: number;
  height: number;
  background: string;
  highlightsEnabled?: boolean; // global on/off for tap highlights (default true)
  // Intro audio: plays once on first view of the flyer
  introAudioUrl?: string;
  introAudioLoop?: boolean;
  introAudioVolume?: number; // 0..1, default 1
  introAudioShowControl?: boolean; // show viewer volume slider, default true
  // Background audio: persistent soundtrack that plays across all pages of the flyer.
  bgAudioUrl?: string;
  bgAudioLoop?: boolean;            // default true
  bgAudioVolume?: number;           // 0..1, default 0.5
  bgAudioAutoplay?: boolean;        // default true
  bgAudioShowControl?: boolean;     // viewer can adjust volume / pause, default true
  // Per-flyer payment handles for cart checkout (P2P money transfer apps)
  payVenmo?: string;             // Venmo username, no leading @
  payCashapp?: string;           // Cash App $Cashtag, no leading $
  payApplePayContact?: string;   // Phone number or email registered with Apple Cash (used via iMessage)
  // Social media slideout tab (only renders when at least one URL is filled in)
  social?: SocialSlideoutSettings;
}

export interface SocialSlideoutSettings {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;     // X
  youtube?: string;
  linkedin?: string;
  snapchat?: string;
  threads?: string;
  website?: string;
  // styling
  tabBgColor?: string;     // default "#1a1a1a"
  tabTextColor?: string;   // default "#ffffff"
  panelBgColor?: string;   // default "#1a1a1a"
  iconColor?: string;      // default "#ffffff"
  fontFamily?: string;     // default "Inter"
  label?: string;          // default "SOCIAL MEDIA"
}

export type FlyerCategory = "business" | "event";

export interface Flyer {
  id: string;
  owner_id: string;
  title: string;
  status: "draft" | "published";
  public_slug: string | null;
  /** Publishing state of this project's Website page (independent of the flyer). */
  website_status?: "draft" | "published";
  website_slug?: string | null;
  settings: FlyerSettings;

  thumbnail_url: string | null;
  category: FlyerCategory;
  event_date: string | null;        // YYYY-MM-DD
  auto_unpublish_at: string | null; // ISO timestamp
  created_at: string;
  updated_at: string;
  pages?: FlyerPage[];
}
