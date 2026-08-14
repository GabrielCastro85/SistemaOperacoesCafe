// import.meta.env.BASE_URL ja' vem com barra final ("/" localmente,
// "/SistemaOperacoesCafe/" no build do GitHub Pages -- ver vite.config.ts).
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
