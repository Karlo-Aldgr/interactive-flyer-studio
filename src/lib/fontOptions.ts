export interface FontOption {
  /** Value stored on layer.style.fontFamily */
  family: string;
  label: string;
  group: "Sans" | "Serif" | "Display" | "Mono";
}

export const FONT_OPTIONS: FontOption[] = [
  { family: "Plus Jakarta Sans", label: "Plus Jakarta Sans", group: "Sans" },
  { family: "Inter", label: "Inter", group: "Sans" },
  { family: "Poppins", label: "Poppins", group: "Sans" },
  { family: "Montserrat", label: "Montserrat", group: "Sans" },
  { family: "Roboto", label: "Roboto", group: "Sans" },
  { family: "Open Sans", label: "Open Sans", group: "Sans" },
  { family: "Lato", label: "Lato", group: "Sans" },
  { family: "Raleway", label: "Raleway", group: "Sans" },
  { family: "Oswald", label: "Oswald", group: "Sans" },
  { family: "Bebas Neue", label: "Bebas Neue", group: "Display" },
  { family: "Barlow Condensed", label: "Barlow Condensed", group: "Sans" },
  { family: "Anton", label: "Anton", group: "Sans" },
  { family: "Playfair Display", label: "Playfair Display", group: "Serif" },
  { family: "Merriweather", label: "Merriweather", group: "Serif" },
  { family: "Lora", label: "Lora", group: "Serif" },
  { family: "Georgia", label: "Georgia", group: "Serif" },
  { family: "Pacifico", label: "Pacifico", group: "Display" },
  { family: "Lobster", label: "Lobster", group: "Display" },
  { family: "Great Vibes", label: "Great Vibes", group: "Display" },
  { family: "Permanent Marker", label: "Permanent Marker", group: "Display" },
  { family: "Courier New", label: "Courier New", group: "Mono" },
];

export const FONT_GROUPS: FontOption["group"][] = ["Sans", "Serif", "Display", "Mono"];

export const DEFAULT_FONT = "Plus Jakarta Sans";

/** Family names of the fonts that are loaded from Google Fonts (system fonts excluded). */
export const FONT_FAMILY_NAMES = FONT_OPTIONS.map((f) => f.family);
