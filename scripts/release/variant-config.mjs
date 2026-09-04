export const variants = {
  villa: {
    variant: "villa",
    appId: "br.com.operacoescafe.villa",
    productName: "Villa Coffee",
    displayName: "Villa Coffee Operacoes",
    executableName: "VillaCoffeeOperacoes",
    artifactPrefix: "VillaCoffee-Operacoes",
    iconPath: "build/icons/villa.ico",
    logoPath: "public/assets/branding/villa/logo.png",
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
    logoPath: "public/assets/branding/grao/logo.png",
    userDataDirectoryName: "Grao & Grao Operacoes",
    copyright: "Copyright (c) 2026 Sistema Operacoes Cafe",
    description: "Aplicativo desktop offline-first para operacoes da Grao & Grao."
  },
  multiempresa: {
    variant: "multiempresa",
    appId: "br.com.operacoescafe.multiempresa",
    productName: "Operações Café",
    displayName: "Operações Café",
    executableName: "SistemaOperacoesCafe",
    artifactPrefix: "SistemaOperacoesCafe",
    iconPath: "build/icons/multiempresa.ico",
    logoPath: "public/assets/branding/villa/logo.png",
    userDataDirectoryName: "Sistema de Operacoes de Cafe Multiempresa",
    copyright: "Copyright (c) 2026 Sistema Operacoes Cafe",
    description: "Aplicativo desktop offline-first multiempresa para operacoes de cafe."
  }
};

export function getVariant(name) {
  const variant = variants[name];
  if (!variant) throw new Error(`Variante desconhecida: ${name}`);
  return variant;
}
