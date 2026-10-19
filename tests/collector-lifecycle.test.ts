import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("recuperacao do coletor", () => {
  it("nao permite que o Agendador encerre o coletor por tempo de execucao", () => {
    const installer = readFileSync("collector/instalar-inicializacao.ps1", "utf8");
    expect(installer).toContain("ExecutionTimeLimit ([TimeSpan]::Zero)");
    expect(installer).not.toContain("ExecutionTimeLimit (New-TimeSpan -Minutes 5)");
  });

  it("mantem uma vigilancia interna e repara tarefas antigas", () => {
    const collector = readFileSync("collector/main.cjs", "utf8");
    expect(collector).toContain("startRecoveryWatchdog()");
    expect(collector).toContain("repairScheduledTaskSettings()");
    expect(collector).toContain("--watchdog-parent=");
    expect(collector).toContain("ExecutionTimeLimit = 'PT0S'");
  });

  it("preserva o identificador do computador entre verificacoes e reinicios", () => {
    const collector = readFileSync("collector/main.cjs", "utf8");
    expect(collector).toContain("coletor-machine-id.txt");
    expect(collector).toContain("stableMachineId(value.machineId)");
    expect(collector).not.toContain("machineId: String(value.machineId || `graobase-${randomUUID()}`)");
  });
});
