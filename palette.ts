/**
 * Theme palette pairs (FR-041, SC-008).
 *
 * The runtime tokens live in `themes/tokens.css` as CSS custom properties;
 * this module mirrors the same color values so the contrast requirement can
 * be asserted with real WCAG ratio math in the automated suite (jest-axe
 * cannot resolve CSS custom properties in jsdom).
 *
 * `contrast.test.tsx` asserts every pair below is >= 4.5:1 for normal text in
 * both resolved themes, and asserts each value is actually present in
 * tokens.css so the two cannot drift.
 */

export interface ContrastPair {
  readonly name: string;
  readonly foreground: string;
  readonly background: string;
}

export interface ThemePalette {
  readonly background: string;
  readonly backgroundElevated: string;
  readonly pairs: readonly ContrastPair[];
}

export const LIGHT_PALETTE: ThemePalette = {
  background: "#ffffff",
  backgroundElevated: "#f8fafc",
  pairs: [
    { name: "normal text", foreground: "#0f172a", background: "#ffffff" },
    { name: "normal text on elevated surface", foreground: "#0f172a", background: "#f8fafc" },
    { name: "muted text", foreground: "#475569", background: "#ffffff" },
    { name: "muted text on elevated surface", foreground: "#475569", background: "#f8fafc" },
    { name: "subtle text", foreground: "#64748b", background: "#ffffff" },
    { name: "accent text", foreground: "#1d4ed8", background: "#ffffff" },
    { name: "text on accent", foreground: "#ffffff", background: "#1d4ed8" },
    { name: "loading state text", foreground: "#1d4ed8", background: "#eff6ff" },
    { name: "empty state text", foreground: "#475569", background: "#f8fafc" },
    { name: "error state text", foreground: "#b91c1c", background: "#fef2f2" },
    { name: "unavailable state text", foreground: "#6d28d9", background: "#f5f3ff" },
    { name: "offline state text", foreground: "#92400e", background: "#fffbeb" },
  ],
};

export const DARK_PALETTE: ThemePalette = {
  background: "#09090b",
  backgroundElevated: "#18181b",
  pairs: [
    { name: "normal text", foreground: "#fafafa", background: "#09090b" },
    { name: "normal text on elevated surface", foreground: "#fafafa", background: "#18181b" },
    { name: "muted text", foreground: "#d4d4d8", background: "#18181b" },
    { name: "subtle text", foreground: "#a1a1aa", background: "#18181b" },
    { name: "accent text", foreground: "#93c5fd", background: "#09090b" },
    { name: "text on accent", foreground: "#0b1120", background: "#93c5fd" },
    { name: "loading state text", foreground: "#93c5fd", background: "#172554" },
    { name: "empty state text", foreground: "#d4d4d8", background: "#18181b" },
    { name: "error state text", foreground: "#fca5a5", background: "#450a0a" },
    { name: "unavailable state text", foreground: "#d8b4fe", background: "#2e1065" },
    { name: "offline state text", foreground: "#fcd34d", background: "#451a03" },
  ],
};

export const PALETTES = {
  light: LIGHT_PALETTE,
  dark: DARK_PALETTE,
} as const;

/** The WCAG 2.1 AA threshold for normal text (FR-041, A-06). */
export const CONTRAST_THRESHOLD = 4.5;

function channel(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const integer = Number.parseInt(value.length === 3 ? value.replace(/(.)/g, "$1$1") : value, 16);
  const red = (integer >> 16) & 0xff;
  const green = (integer >> 8) & 0xff;
  const blue = integer & 0xff;
  return [red, green, blue];
}

function luminance(hex: string): number {
  const [red, green, blue] = channel(hex);
  const toLinear = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
  );
}

/** The WCAG contrast ratio between two colors, as `x:1`. */
export function contrastRatio(foreground: string, background: string): number {
  const light = luminance(foreground);
  const dark = luminance(background);
  const [higher, lower] = light > dark ? [light, dark] : [dark, light];
  return (higher + 0.05) / (lower + 0.05);
}
