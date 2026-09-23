import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("electron preload parity", () => {
  it("keeps the runtime CommonJS bridge equal to the typed bridge", () => {
    const typed = readFileSync(new URL("../electron/preload/index.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const runtime = readFileSync(new URL("../electron/preload/index.cts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    expect(runtime).toBe(typed);
    expect(runtime).toContain("listTransferReconciliationInvoices");
    expect(runtime).toContain('new Set(["getDiagnostics", "getBillingSummary"])');
    expect(runtime).toContain("nonBlockingLoadingMethods.has(key)");
  });
});
