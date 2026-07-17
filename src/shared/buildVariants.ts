import type { AppVariant } from "./types/domain.js";

export interface BuildVariantConfig {
  variant: AppVariant;
  appId: string;
  productName: string;
  displayName: string;
  executableName: string;
  artifactPrefix: string;
  iconPath: string;
  userDataDirectoryName: string;
  copyright: string;
  description: string;
}

export const buildVariantConfigs: Record<AppVariant, BuildVariantConfig> = {
  villa: {
    variant: "villa",
    appId: "br.com.operacoescafe.villa",
    productName: "Villa Coffee",
    displayName: "Villa Coffee Operacoes",
    executableName: "VillaCoffeeOperacoes",
    artifactPrefix: "VillaCoffee-Operacoes",
    iconPath: "build/icons/villa.ico",
    userDataDirectoryName: "Villa Coffee Operacoes",
    copyright: "Copyright (c) 2026 Sistema Operacoes Cafe",
    description: "Aplicativo desktop offline-first para operacoes da Villa Coffee."
  },
  grao: {
    variant: "grao",
    appId: "br.com.operacoescafe.graoegrao",
    productName: "Grao & Grao",
    displayName: "Grao & Grao Operacoes",
    executableName: "GraoEGraoOperacoes",
    artifactPrefix: "GraoEGrao-Operacoes",
    iconPath: "build/icons/grao.ico",
    userDataDirectoryName: "Grao & Grao Operacoes",
    copyright: "Copyright (c) 2026 Sistema Operacoes Cafe",
    description: "Aplicativo desktop offline-first para operacoes da Grao & Grao."
  },
  multiempresa: {
    variant: "multiempresa",
    appId: "br.com.operacoescafe.multiempresa",
    productName: "Sistema de Operacoes de Cafe",
    displayName: "Sistema de Operacoes de Cafe Multiempresa",
    executableName: "SistemaOperacoesCafe",
    artifactPrefix: "SistemaOperacoesCafe-Multiempresa",
    iconPath: "build/icons/multiempresa.ico",
    userDataDirectoryName: "Sistema de Operacoes de Cafe Multiempresa",
    copyright: "Copyright (c) 2026 Sistema Operacoes Cafe",
    description: "Aplicativo desktop offline-first multiempresa para operacoes de cafe."
  }
};

export function getBuildVariantConfig(value: string | undefined): BuildVariantConfig {
  if (value === "villa" || value === "grao" || value === "multiempresa") {
    return buildVariantConfigs[value];
  }
  return buildVariantConfigs.multiempresa;
}
