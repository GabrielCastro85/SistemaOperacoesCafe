import { getBrandingConfig } from "../../../shared/branding/branding";
import type { AppVariant, Organization } from "../../../shared/types/domain";
import type { CSSProperties } from "react";

export interface UiTheme {
  variant: AppVariant;
  appName: string;
  organizationName: string;
  logoPath: string | null;
  colors: {
    primary: string;
    primaryText: string;
    accent: string;
    accentText: string;
    sidebar: string;
    sidebarText: string;
    background: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
}

export function getReadableTextColor(hexColor: string): "#111111" | "#ffffff" {
  const normalized = hexColor.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.58 ? "#111111" : "#ffffff";
}

export function buildUiTheme(variant: AppVariant, organization?: Organization | null): UiTheme {
  const branding = getBrandingConfig(variant);
  const primary = organization?.primaryColor ?? branding.colors.primary;
  const accent = organization?.accentColor ?? branding.colors.accent;
  const isVilla = variant === "villa";
  const isGrao = variant === "grao";

  return {
    variant,
    appName: organization?.appDisplayName ?? branding.appDisplayName,
    organizationName: organization?.displayName ?? branding.name,
    logoPath: organization?.logoPath ?? null,
    colors: {
      primary,
      primaryText: getReadableTextColor(primary),
      accent,
      accentText: getReadableTextColor(accent),
      sidebar: isVilla ? "#171614" : isGrao ? "#1f3b2c" : "#263238",
      sidebarText: "#fffaf0",
      background: isVilla ? "#f7f2e8" : isGrao ? "#f5f6ef" : "#f6f6f2",
      surface: "#ffffff",
      surfaceMuted: isVilla ? "#fbf7ee" : isGrao ? "#f0f4ea" : "#f2f4f1",
      text: branding.colors.text,
      textMuted: "#5f6b63",
      border: "#ddd8cc",
      success: "#2f7d4f",
      warning: "#ad741f",
      danger: "#b43d36",
      info: "#2f6598"
    }
  };
}

export function themeToCssVariables(theme: UiTheme): CSSProperties {
  return {
    "--color-primary": theme.colors.primary,
    "--color-primary-text": theme.colors.primaryText,
    "--color-accent": theme.colors.accent,
    "--color-accent-text": theme.colors.accentText,
    "--color-sidebar": theme.colors.sidebar,
    "--color-sidebar-text": theme.colors.sidebarText,
    "--color-background": theme.colors.background,
    "--color-surface": theme.colors.surface,
    "--color-surface-muted": theme.colors.surfaceMuted,
    "--color-text": theme.colors.text,
    "--color-text-muted": theme.colors.textMuted,
    "--color-border": theme.colors.border,
    "--color-success": theme.colors.success,
    "--color-warning": theme.colors.warning,
    "--color-danger": theme.colors.danger,
    "--color-info": theme.colors.info,
    "--brand-primary": theme.colors.primary,
    "--brand-accent": theme.colors.accent,
    "--brand-secondary": theme.colors.background,
    "--text": theme.colors.text,
    "--muted": theme.colors.textMuted
  } as CSSProperties;
}
