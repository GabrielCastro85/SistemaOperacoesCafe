import { z } from "zod";
import type { AppVariant, Organization } from "../types/domain.js";

export interface BrandingConfig {
  variant: AppVariant;
  name: string;
  appDisplayName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    text: string;
  };
  logoCandidates: string[];
  iconCandidates: string[];
}

const brandingSchema = z.object({
  variant: z.enum(["villa", "grao", "multiempresa"]),
  name: z.string().min(1),
  appDisplayName: z.string().min(1),
  colors: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    surface: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    text: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  }),
  logoCandidates: z.array(z.string()),
  iconCandidates: z.array(z.string())
});

const configs: Record<AppVariant, BrandingConfig> = {
  villa: {
    variant: "villa",
    name: "Villa Coffee",
    appDisplayName: "Villa Coffee Operacoes",
    colors: {
      primary: "#0F0D0A",
      secondary: "#D4A875",
      accent: "#16B86A",
      surface: "#F8F0E4",
      text: "#1B1712"
    },
    logoCandidates: ["assets/branding/villa/logo.svg", "assets/branding/villa/logo.png", "assets/branding/villa/logo.webp"],
    iconCandidates: ["assets/branding/villa/icon.png", "assets/branding/villa/icon.svg", "assets/branding/villa/icon.webp"]
  },
  grao: {
    variant: "grao",
    name: "Grao & Grao",
    appDisplayName: "Grao & Grao Operacoes",
    colors: {
      primary: "#073F28",
      secondary: "#9A7449",
      accent: "#05B866",
      surface: "#F7F4EA",
      text: "#17231C"
    },
    logoCandidates: ["assets/branding/grao/logo.svg", "assets/branding/grao/logo.png", "assets/branding/grao/logo.webp"],
    iconCandidates: ["assets/branding/grao/icon.png", "assets/branding/grao/icon.svg", "assets/branding/grao/icon.webp"]
  },
  multiempresa: {
    variant: "multiempresa",
    name: "Operacoes Cafe",
    appDisplayName: "Operacoes Cafe",
    colors: {
      primary: "#263238",
      secondary: "#F5F1E8",
      accent: "#3C7D54",
      surface: "#FBFAF7",
      text: "#1B1F1D"
    },
    logoCandidates: ["assets/branding/multiempresa/logo.png", "assets/branding/multiempresa/logo.svg", "assets/branding/multiempresa/logo.webp"],
    iconCandidates: ["assets/branding/multiempresa/icon.png", "assets/branding/multiempresa/icon.svg", "assets/branding/multiempresa/icon.webp"]
  }
};

export function getBrandingConfig(variant: AppVariant): BrandingConfig {
  return brandingSchema.parse(configs[variant]);
}

export function getAllBrandingConfigs(): BrandingConfig[] {
  return Object.values(configs).map((config) => brandingSchema.parse(config));
}

export function resolveOrganizationLogoSrc(organization: Organization | null, variant: AppVariant = "multiempresa"): string | null {
  if (organization?.logoPath?.startsWith("data:")) return organization.logoPath;
  const name = `${organization?.displayName ?? ""} ${organization?.appDisplayName ?? ""}`.toLowerCase();
  if (variant === "villa" || name.includes("villa")) return "assets/branding/villa/logo.svg";
  if (variant === "grao" || name.includes("grao") || name.includes("grão")) return "assets/branding/grao/logo.svg";
  return null;
}
