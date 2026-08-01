import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVariantConfigs, getBuildVariantConfig } from "../src/shared/buildVariants";

const root = process.cwd();

describe("Windows distribution", () => {
  it("keeps brand variants available inside the single multiempresa app", () => {
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
    expect(pkg.version).toBe("1.0.1");
    expect(pkg.author).toBeTruthy();
    expect(pkg.license).toBe("UNLICENSED");
    expect(pkg.engines?.node).toContain(">=20.19.0");
    expect(pkg.scripts.package).toContain("multiempresa");
    expect(pkg.scripts.dist).toContain("multiempresa");
    expect(pkg.scripts["package:villa"]).toBeUndefined();
    expect(pkg.scripts["package:grao"]).toBeUndefined();
    expect(pkg.scripts["release:villa"]).toBeUndefined();
    expect(pkg.scripts["release:grao"]).toBeUndefined();
    expect(buildVariantConfigs.multiempresa.artifactPrefix).toBe("SistemaOperacoesCafe");
    expect(pkg.scripts["release:verify"]).toContain("verify-release");
    expect(pkg.scripts["smoke:packaged"]).toContain("smoke-packaged");
    expect(pkg.scripts["homologation:check"]).toContain("release-readiness");
    expect(pkg.scripts["security:review"]).toContain("security-check");
    expect(pkg.scripts["migrations:check"]).toContain("migration-check");
    expect(pkg.scripts["performance:baseline"]).toContain("performance-baseline");
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
      "docs/BUILD_VARIANTS.md",
      "docs/USER_MANUAL.md",
      "docs/QUICK_START.md",
      "docs/DAILY_OPERATION_CHECKLIST.md",
      "docs/USER_ACCEPTANCE_TEST.md",
      "docs/RELEASE_1_0_CHECKLIST.md",
      "docs/RELEASE_1_0_ISSUES.md",
      "docs/SECURITY_REVIEW_1_0.md",
      "docs/HOMOLOGATION_REPORT_1_0.md"
    ]) {
      expect(existsSync(join(root, doc))).toBe(true);
    }
  });
});
