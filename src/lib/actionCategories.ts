import type { ActionType } from "@/types/flyer";

export const ACTION_LABELS: Record<ActionType, string> = {
  open_url: "Open URL",
  download_vcard: "Download contact card",
  popup: "Show popup",
  video: "Play video",
  audio: "Play audio",
  call: "Call phone",
  sms: "Send SMS",
  form: "Capture form",
  navigate: "Go to page",
  reveal: "Reveal layer",
  add_to_calendar: "Add to calendar",
  buy_ticket: "Buy ticket",
  rsvp: "RSVP",
  checkout: "Link to checkout",
  coupon: "Coupon",
  map: "Open in maps (GPS)",
  buy_product: "Buy product",
  air_messages: "Air messages (chat bubbles)",
  poll: "Poll",
  subscribe: "Subscribe (email signup)",
  book_appointment: "Book appointment",
  gallery: "Photo gallery",
  survey: "Survey",
  testimonial: "Testimonials",
  reserve_table: "Reserve a table",
  schedule_consultation: "Schedule consultation",
  show_menu: "Show menu",
  join_challenge: "Join challenge",
  business_rating: "Business rating (5 stars)",
  menu_add_item: "Add menu item to cart",
  product_grid: "Multi-product shop",
  novel: "Novel / Story (paid chapters)",
  realtor_gallery: "Realtor gallery (link to listing photos)",
  carousel: "Carousel (scrolling video / flyer gallery)",
};

/** Grouped action types for the editor dropdown (excludes internal menu_add_item). */
export const ACTION_TYPE_GROUPS: { label: string; types: ActionType[] }[] = [
  {
    label: "Links & navigation",
    types: ["open_url", "navigate", "map", "checkout"],
  },
  {
    label: "Media & display",
    types: ["popup", "video", "audio", "gallery", "carousel", "realtor_gallery", "reveal", "air_messages"],
  },
  {
    label: "Contact",
    types: ["call", "sms"],
  },
  {
    label: "Lead capture",
    types: ["form", "rsvp", "subscribe", "survey", "join_challenge"],
  },
  {
    label: "Feedback & engagement",
    types: ["poll", "testimonial", "business_rating"],
  },
  {
    label: "Scheduling & bookings",
    types: ["book_appointment", "schedule_consultation", "reserve_table"],
  },
  {
    label: "Commerce & payments",
    types: ["buy_product", "product_grid", "buy_ticket", "show_menu", "novel", "coupon"],
  },
  {
    label: "Utility",
    types: ["add_to_calendar"],
  },
];

export const PAYMENT_ACTION_TYPES = new Set<ActionType>([
  "buy_product",
  "product_grid",
  "buy_ticket",
  "checkout",
  "show_menu",
  "novel",
  "coupon",
]);
