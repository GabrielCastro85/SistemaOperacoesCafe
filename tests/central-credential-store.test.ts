import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`protected:${value}`, "utf8"),
    decryptString: (value: Buffer) => value.toString("utf8").replace(/^protected:/, "")
  }
}));

import { CentralCredentialStore } from "../electron/main/services/centralCredentialStore";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("CentralCredentialStore", () => {
  it("never reuses another user's credential when the requested user is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "central-credentials-"));
    directories.push(directory);
    const store = new CentralCredentialStore(directory);

    store.save("gabriel", "senha-gabriel");

    expect(store.isConfigured()).toBe(true);
    expect(store.load("gabriel")).toEqual({ username: "gabriel", password: "senha-gabriel" });
    expect(store.load("rogerio")).toBeNull();

    store.save("rogerio", "senha-rogerio");
    expect(store.load("rogerio")).toEqual({ username: "rogerio", password: "senha-rogerio" });
    expect(store.load("gabriel")).toEqual({ username: "gabriel", password: "senha-gabriel" });
  });
});
