import { currentPaletteMeta, type PaletteColors } from '../../../../theme';

/**
 * Pantry status colors, derived from the active palette.
 *
 * This file used to export a fixed teal palette, which meant the whole feature
 * ignored the user's theme (and was unreadable on the dark one). The names here
 * are deliberately semantic rather than color words — "urgent" is red in most
 * palettes but the point is the meaning, not the hue.
 *
 * Call this from inside a `makeStyles` factory so the values are re-read whenever
 * the palette changes; `useThemedStyles` rebuilds the StyleSheet on that event.
 */

/**
 * Builds an rgba tint from a palette hex. Every palette defines these as 6-digit
 * hex, but a non-hex value is passed through so a future rgba token can't produce
 * a malformed color string.
 */
function tint(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface PantryTokens {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  textOnPrimary: string;
  textOnPrimaryMuted: string;
  urgent: string;
  urgentBg: string;
  urgentBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  safe: string;
  safeBg: string;
  safeBorder: string;
  info: string;
  infoBg: string;
  infoBorder: string;
  scrim: string;
  scannerScrim: string;
  scannerSurface: string;
  scannerBorder: string;
  scannerLens: string;
  scannerAccent: string;
  scannerAccentFill: string;
  scannerAccentLine: string;
  scannerTrack: string;
  live: string;
  textOnDark: string;
  textOnDarkMuted: string;
  textOnDarkFaint: string;
}

export function makePantryTokens(colors: PaletteColors): PantryTokens {
  // Tints need more alpha to read against a dark ground than a light one.
  const fill = currentPaletteMeta.isDark ? 0.18 : 0.1;
  const line = currentPaletteMeta.isDark ? 0.38 : 0.22;

  return {
    primary: colors.primary,
    primaryDark: colors.primaryDark,
    primarySoft: colors.blush,
    textOnPrimary: colors.textOnPrimary,
    textOnPrimaryMuted: colors.textOnPrimaryMuted,

    // Expiring today / out of stock. dangerSoft and dangerBorder are the only
    // status tints the global palette defines, so they're used as-is.
    urgent: colors.danger,
    urgentBg: colors.dangerSoft,
    urgentBorder: tint(colors.dangerBorder, line),

    // Expiring soon / low stock.
    warning: colors.turmeric,
    warningBg: colors.turmericSoft,
    warningBorder: tint(colors.turmeric, line),

    // Fresh / in stock.
    safe: colors.forest,
    safeBg: tint(colors.forest, fill),
    safeBorder: tint(colors.forest, line),

    // Neutral informational accents (tips, AI notes).
    info: colors.accentIndigo,
    infoBg: tint(colors.accentIndigo, fill),
    infoBorder: tint(colors.accentIndigo, line),

    // Scrim behind bottom sheets.
    scrim: 'rgba(0, 0, 0, 0.5)',

    // --- Scanner chrome -------------------------------------------------
    // The AI scanner is camera chrome, not a page surface: it stays dark in every
    // palette so the capture preview keeps its contrast, the same way the app's
    // bottom nav and the Medicine/Family hero stay on `navBackground` even on the
    // light palettes. Only the accent follows the theme.
    //
    // The accent is `accentCyan` rather than `primary` deliberately: `primary` is
    // pure black on the default palette, which would be invisible on this card.
    // `accentCyan` is a legible mid-tone in all three palettes.
    scannerScrim: 'rgba(0, 0, 0, 0.88)',
    scannerSurface: colors.navBackground,
    scannerBorder: tint(colors.accentCyan, 0.35),
    scannerLens: '#050507',
    scannerAccent: colors.accentCyan,
    scannerAccentFill: tint(colors.accentCyan, 0.12),
    scannerAccentLine: tint(colors.accentCyan, 0.3),
    scannerTrack: 'rgba(255, 255, 255, 0.14)',
    live: colors.forest,

    // Text sitting on that permanently-dark chrome, so it cannot use textPrimary.
    textOnDark: '#FFFFFF',
    textOnDarkMuted: 'rgba(255, 255, 255, 0.72)',
    textOnDarkFaint: 'rgba(255, 255, 255, 0.45)',
  };
}
