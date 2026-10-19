import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const requireFromTest = createRequire(import.meta.url);
const { compareVersions, powershellLiteral, sha256File } = requireFromTest("../collector/update-utils.cjs") as {
  compareVersions: (left: string, right: string) => number;
  powershellLiteral: (value: string) => string;
  sha256File: (path: string) => Promise<string>;
};

describe("atualizacao do coletor", () => {
  it("compara versoes numericas sem confundir 1.1.10 com 1.1.9", () => {
    expect(compareVersions("1.1.10", "1.1.9")).toBe(1);
    expect(compareVersions("v2.0.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.2.0", "1.10.0")).toBe(-1);
  });

  it("protege caminhos usados no script PowerShell", () => {
    expect(powershellLiteral("C:\\Pasta do João\\coletor.exe")).toBe("'C:\\Pasta do João\\coletor.exe'");
    expect(powershellLiteral("C:\\D'agua\\coletor.exe")).toBe("'C:\\D''agua\\coletor.exe'");
  });

  it("calcula o hash do arquivo baixado", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "collector-update-")), "hash.txt");
    writeFileSync(path, "coletor-graobase", "utf8");
    expect(await sha256File(path)).toBe(createHash("sha256").update("coletor-graobase").digest("hex"));
  });

  it("so procura atualizacao quando recebe o comando remoto e preserva a versao anterior como retorno", () => {
    const source = readFileSync(join(process.cwd(), "collector", "main.cjs"), "utf8");
    expect(source.match(/await checkForUpdate\(config\)/g)).toHaveLength(1);
    expect(source).toContain('if (command.command === "UPDATE_NOW")');
    expect(source).toContain("retornando ao coletor anterior");
    expect(source).toContain("Start-Process -FilePath $oldExecutable");
  });
});
