import { safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface StoredCredentials {
  version: 1;
  passwords: Record<string, string>;
}

function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase("pt-BR");
}

export class CentralCredentialStore {
  private readonly path: string;

  constructor(settingsDir: string) {
    this.path = join(settingsDir, "central-credentials.json");
  }

  load(username: string): string | null {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const encrypted = this.read().passwords[normalizeUsername(username)];
    if (!encrypted) return null;
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    } catch {
      return null;
    }
  }

  save(username: string, password: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("O Windows nao disponibilizou o armazenamento seguro de credenciais.");
    }
    const contents = this.read();
    contents.passwords[normalizeUsername(username)] = safeStorage.encryptString(password).toString("base64");
    mkdirSync(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(contents), { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.path);
  }

  private read(): StoredCredentials {
    if (!existsSync(this.path)) return { version: 1, passwords: {} };
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as Partial<StoredCredentials>;
      return parsed.version === 1 && parsed.passwords && typeof parsed.passwords === "object"
        ? { version: 1, passwords: parsed.passwords }
        : { version: 1, passwords: {} };
    } catch {
      return { version: 1, passwords: {} };
    }
  }
}
