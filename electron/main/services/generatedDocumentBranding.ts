import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

export const GRAONEX_GENERATED_BY = "Gerado por Grãonex";
export const GRAONEX_WEBSITE = "graonex.com.br";
export const GRAONEX_FOOTER_TEXT = `${GRAONEX_GENERATED_BY}  •  ${GRAONEX_WEBSITE}`;

function resolveGraonexIconPath(): string | null {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const appRoot = join(moduleDir, "..", "..", "..", "..");
  const candidates = [
    join(appRoot, "dist", "assets", "branding", "graonex", "icon.png"),
    join(appRoot, "public", "assets", "branding", "graonex", "icon.png"),
    join(process.cwd(), "dist", "assets", "branding", "graonex", "icon.png"),
    join(process.cwd(), "public", "assets", "branding", "graonex", "icon.png")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function graonexIconDataUrl(): string | null {
  const iconPath = resolveGraonexIconPath();
  return iconPath ? `data:image/png;base64,${readFileSync(iconPath).toString("base64")}` : null;
}

interface GraonexPdfFooterOptions {
  text?: string;
  textSize?: number;
  iconSize?: number;
  opacity?: number;
}

export async function addGraonexPdfFooter(doc: PDFDocument, preferredFont?: PDFFont, options: GraonexPdfFooterOptions = {}): Promise<void> {
  doc.setCreator("Grãonex");
  doc.setProducer("Grãonex - graonex.com.br");
  const font = preferredFont ?? await doc.embedFont(StandardFonts.Helvetica);
  const iconPath = resolveGraonexIconPath();
  const icon = iconPath ? await doc.embedPng(readFileSync(iconPath)).catch(() => null) : null;
  const footerText = options.text ?? GRAONEX_FOOTER_TEXT;
  const textSize = options.textSize ?? 6.5;
  const iconSize = options.iconSize ?? 12;
  const opacity = options.opacity ?? 0.82;
  const gap = 5;
  const textWidth = font.widthOfTextAtSize(footerText, textSize);
  const groupWidth = textWidth + (icon ? iconSize + gap : 0);
  const color = rgb(0.32, 0.38, 0.34);

  for (const page of doc.getPages()) {
    const pageWidth = page.getWidth();
    const startX = Math.max(18, (pageWidth - groupWidth) / 2);
    if (icon) {
      page.drawImage(icon, { x: startX, y: 4.5, width: iconSize, height: iconSize, opacity });
    }
    page.drawText(footerText, {
      x: startX + (icon ? iconSize + gap : 0),
      y: 7.2,
      size: textSize,
      font,
      color,
      opacity
    });
  }
}

export function graonexSvgFooter(width: number, baselineY: number): string {
  const iconDataUrl = graonexIconDataUrl();
  const text = `${GRAONEX_GENERATED_BY}  •  ${GRAONEX_WEBSITE}`;
  const estimatedTextWidth = 208;
  const iconSize = 22;
  const gap = 9;
  const groupWidth = estimatedTextWidth + (iconDataUrl ? iconSize + gap : 0);
  const startX = Math.max(20, (width - groupWidth) / 2);
  return `<g opacity="0.72">${iconDataUrl ? `<image href="${iconDataUrl}" x="${startX}" y="${baselineY - 17}" width="${iconSize}" height="${iconSize}"/>` : ""}<text x="${startX + (iconDataUrl ? iconSize + gap : 0)}" y="${baselineY}" style="font:14px Arial,sans-serif;fill:#43554a">${text}</text></g>`;
}
