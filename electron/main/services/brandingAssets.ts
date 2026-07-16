import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { AppDirectories, BrandingAssetKind } from "../../../src/shared/types/domain.js";

const allowedExtensions = new Set([".png", ".svg", ".webp"]);
const maxBytes = 5 * 1024 * 1024;

const names: Record<BrandingAssetKind, string> = {
  logo: "logo",
  compactLogo: "compact-logo",
  icon: "icon"
};

export function copyBrandingAssetFromPath(
  directories: AppDirectories,
  organizationId: string,
  kind: BrandingAssetKind,
  sourcePath: string
): string {
  const extension = extname(sourcePath).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw new Error("Formato de imagem invalido. Use PNG, SVG ou WebP.");
  }
  const stats = statSync(sourcePath);
  if (!stats.isFile()) {
    throw new Error("Arquivo de imagem nao encontrado.");
  }
  if (stats.size > maxBytes) {
    throw new Error("Arquivo de imagem maior que 5 MB.");
  }
  const targetDir = join(directories.settingsDir, "branding", organizationId);
  mkdirSync(targetDir, { recursive: true });
  const targetPath = join(targetDir, `${names[kind]}${extension}`);
  copyFileSync(sourcePath, targetPath);
  return targetPath;
}

export function getBrandingDialogFilters(): Electron.FileFilter[] {
  return [{ name: "Imagens", extensions: ["png", "svg", "webp"] }];
}

export function describeBrandingAsset(path: string): string {
  return basename(path);
}
