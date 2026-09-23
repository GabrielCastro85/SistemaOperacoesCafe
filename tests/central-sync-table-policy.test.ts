import { describe, expect, it } from "vitest";
import { isAcceptedSyncTable, isCentralSynchronizedTable } from "../server/src/sync.js";

describe("politica de tabelas da sincronizacao central", () => {
  it("descarta silenciosamente jobs XML enviados por clientes antigos", () => {
    expect(isAcceptedSyncTable("xml_import_jobs")).toBe(true);
    expect(isAcceptedSyncTable("xml_import_files")).toBe(true);
    expect(isCentralSynchronizedTable("xml_import_jobs")).toBe(false);
    expect(isCentralSynchronizedTable("xml_import_files")).toBe(false);
    expect(isCentralSynchronizedTable("fiscal_documents")).toBe(true);
  });
});
