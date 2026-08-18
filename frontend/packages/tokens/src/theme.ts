export const themePreferences = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof themePreferences)[number];

export const qrPaletteDefaults = {
  foreground: "#10233f",
  background: "#ffffff"
} as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (themePreferences as readonly string[]).includes(value);
}

/**
 * Apply only the current visual preference. Persistence belongs to the owning
 * account/settings flow and must not be coupled to browser auth/session state.
 */
export function applyThemePreference(preference: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (preference === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", preference);
}
