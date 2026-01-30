/**
 * Theme Utilities for MCP Server Addon
 *
 * Provides theme detection and color management to match Local's theme preference.
 * Local uses CSS classes on document.documentElement: .Theme__Dark or .Theme__Light
 */

/**
 * Theme color palette for consistent styling across components.
 */
export interface ThemeColors {
  // Backgrounds
  panelBg: string;
  panelBgSecondary: string;
  panelBgCode: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;
  borderLight: string;

  // Status colors
  successBg: string;
  successText: string;
  errorBg: string;
  errorText: string;
  infoBg: string;
  infoBorder: string;
  infoText: string;

  // Interactive elements
  inputBg: string;
  inputBorder: string;

  // Brand/accent colors
  primary: string;
  primaryHover: string;
}

/**
 * Light theme color palette.
 */
const LIGHT_COLORS: ThemeColors = {
  // Backgrounds
  panelBg: '#ffffff',
  panelBgSecondary: '#f5f5f5',
  panelBgCode: '#2d2d2d',

  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',

  // Borders
  border: '#dddddd',
  borderLight: '#eeeeee',

  // Status colors
  successBg: '#d4edda',
  successText: '#28a745',
  errorBg: '#f8d7da',
  errorText: '#dc3545',
  infoBg: '#e7f3ff',
  infoBorder: '#b3d9ff',
  infoText: '#333333',

  // Interactive elements
  inputBg: '#ffffff',
  inputBorder: '#cccccc',

  // Brand/accent colors
  primary: '#007bff',
  primaryHover: '#0056b3',
};

/**
 * Dark theme color palette.
 */
const DARK_COLORS: ThemeColors = {
  // Backgrounds
  panelBg: '#2d2d2d',
  panelBgSecondary: '#3d3d3d',
  panelBgCode: '#1a1a1a',

  // Text
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textMuted: '#808080',

  // Borders
  border: '#4a4a4a',
  borderLight: '#3d3d3d',

  // Status colors
  successBg: '#1a4d2e',
  successText: '#68d391',
  errorBg: '#4d1a1a',
  errorText: '#fc8181',
  infoBg: '#1a3a4d',
  infoBorder: '#2d5a7b',
  infoText: '#e0e0e0',

  // Interactive elements
  inputBg: '#3d3d3d',
  inputBorder: '#5a5a5a',

  // Brand/accent colors
  primary: '#4da3ff',
  primaryHover: '#2d8aff',
};

/**
 * Check if Local is currently in dark mode.
 *
 * Local sets CSS classes on document.documentElement:
 * - .Theme__Dark for dark mode
 * - .Theme__Light for light mode
 *
 * @returns true if dark mode is active, false otherwise
 */
export function isDarkMode(): boolean {
  // Guard for SSR/Node environment
  if (typeof document === 'undefined') {
    return false;
  }

  return document.documentElement.classList.contains('Theme__Dark');
}

/**
 * Get theme-appropriate colors based on current Local theme.
 *
 * @returns ThemeColors object with colors for the current theme
 */
export function getThemeColors(): ThemeColors {
  return isDarkMode() ? DARK_COLORS : LIGHT_COLORS;
}

/**
 * Subscribe to theme changes via MutationObserver.
 *
 * Local toggles CSS classes on document.documentElement when theme changes.
 * This function watches for those changes and calls the callback.
 *
 * @param callback Function called when theme changes
 * @returns Cleanup function to stop observing
 */
export function onThemeChange(callback: () => void): () => void {
  // Guard for SSR/Node environment
  if (typeof document === 'undefined') {
    return () => {};
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        callback();
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => observer.disconnect();
}

/**
 * Export color constants for direct access if needed.
 */
export { LIGHT_COLORS, DARK_COLORS };
