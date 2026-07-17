import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVariantConfigs, getBuildVariantConfig } from "../src/shared/buildVariants";

const root = process.cwd();

describe("Windows distribution variants", () => {
  it("keeps app IDs, executables and userData directories isolated", () => {
    const variants = Object.values(buildVariantConfigs);
    expect(new Set(variants.map((variant) => variant.appId))).toHaveLength(variants.length);
    expect(new Set(variants.map((variant) => variant.executableName))).toHaveLength(variants.length);
    expect(new Set(variants.map((variant) => variant.userDataDirectoryName))).toHaveLength(variants.length);
    expect(getBuildVariantConfig("unknown").variant).toBe("multiempresa");
  });

  it("ships Windows icons with multiple embedded sizes", () => {
    for (const variant of Object.values(buildVariantConfigs)) {
      const icon = readFileSync(join(root, variant.iconPath));
      expect(icon.readUInt16LE(0)).toBe(0);
      expect(icon.readUInt16LE(2)).toBe(1);
      expect(icon.readUInt16LE(4)).toBeGreaterThanOrEqual(7);
      expect(icon.length).toBeGreaterThan(10_000);
    }
  });

  it("exposes package scripts and metadata for release automation", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
      author?: string;
      license?: string;
      engines?: Record<string, string>;
      scripts: Record<string, string>;
      build: { appId: string; win: { icon: string; requestedExecutionLevel: string } };
    };
    expect(pkg.version).toBe("0.13.0");
    expect(pkg.author).toBeTruthy();
    expect(pkg.license).toBe("UNLICENSED");
    expect(pkg.engines?.node).toContain(">=20.19.0");
    expect(pkg.scripts["package:villa"]).toContain("villa");
    expect(pkg.scripts["package:grao"]).toContain("grao");
    expect(pkg.scripts["release:verify"]).toContain("verify-release");
    expect(pkg.scripts["smoke:packaged"]).toContain("smoke-packaged");
    expect(pkg.build.appId).toBe(buildVariantConfigs.multiempresa.appId);
    expect(pkg.build.win.icon).toBe(buildVariantConfigs.multiempresa.iconPath);
    expect(pkg.build.win.requestedExecutionLevel).toBe("asInvoker");
  });

  it("documents release and installation procedures", () => {
    for (const doc of [
      "docs/INSTALLATION_WINDOWS.md",
      "docs/UPDATE_GUIDE.md",
      "docs/UNINSTALLATION.md",
      "docs/RELEASE_PROCESS.md",
      "docs/CODE_SIGNING.md",
      "docs/BUILD_VARIANTS.md"
    ]) {
      expect(existsSync(join(root, doc))).toBe(true);
    }
  });
});
