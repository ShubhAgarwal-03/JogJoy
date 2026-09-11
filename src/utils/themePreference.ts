export type ThemeMode = "auto" | "dark";

const THEME_KEY = "plexqo_theme_preference";

/** "auto" = contextual (dark on Start/Run, light on Home/Summary/History).
 *  "dark" = force dark everywhere, overriding the contextual default. */
export function getThemePreference(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" ? "dark" : "auto";
}

export function setThemePreference(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
  applyThemePreference();
}

/** Applies a body-level class; CSS handles the actual override (see style.css). */
export function applyThemePreference(): void {
  document.body.classList.toggle("force-dark", getThemePreference() === "dark");
}