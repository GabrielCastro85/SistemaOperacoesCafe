import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const keptLocales = new Set(["pt-BR.pak"]);

export default async function afterPack(context) {
  const localesDir = join(context.appOutDir, "locales");
  let entries = [];
  try {
    entries = readdirSync(localesDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || keptLocales.has(entry.name)) continue;
    rmSync(join(localesDir, entry.name), { force: true });
  }
}
