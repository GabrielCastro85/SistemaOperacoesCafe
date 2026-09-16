import { describe, expect, it } from "vitest";
import { formatDateTimeBr } from "../src/shared/utils/format";

describe("formatDateTimeBr", () => {
  it("converte horarios UTC para o fuso de Brasilia", () => {
    const formatted = formatDateTimeBr("2026-09-16T12:58:54.000Z");
    expect(formatted).toContain("16/09/2026");
    expect(formatted).toContain("09:58:54");
  });
});
