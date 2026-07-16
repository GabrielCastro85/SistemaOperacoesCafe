import { describe, expect, it } from "vitest";
import { getAllBrandingConfigs, getBrandingConfig } from "../src/shared/branding/branding";

describe("branding", () => {
  it("loads all supported variants", () => {
    expect(getAllBrandingConfigs().map((item) => item.variant)).toEqual(["villa", "grao", "multiempresa"]);
  });

  it("loads Villa Coffee colors and asset candidates", () => {
    const branding = getBrandingConfig("villa");
    expect(branding.appDisplayName).toBe("Villa Coffee Operacoes");
    expect(branding.logoCandidates[0]).toContain("assets/branding/villa");
  });
});
