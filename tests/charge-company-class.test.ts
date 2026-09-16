import { expect, it } from "vitest";
import { chargeCompanyClass } from "../src/shared/utils/chargeCompanyClass";

it.each([
  "BOM DO GRAOS EXPORTACAO E COMERCIALIZACAO LTDA",
  "GRÃOS REIS",
  "PRIME COFFEE",
  "VILLA CEREAIS LTDA",
  "",
  null,
  undefined
])("shows external issuer %s in blue", (name) => {
  expect(chargeCompanyClass(name)).toBe("charge-row--third-party");
});

it.each(["GRAO & GRAO COMERCIO EXP LTDA", "Grão & Grão Minas Gerais", "Grão e Grão São Paulo"])("keeps own issuer %s green", (name) => {
  expect(chargeCompanyClass(name)).toBe("charge-row--grao");
});

it("preserves Villa identity and the external/triangulated override", () => {
  expect(chargeCompanyClass("Villa Coffee Minas Gerais")).toBe("charge-row--villa");
  expect(chargeCompanyClass("Grão & Grão Minas Gerais", true)).toBe("charge-row--third-party");
  expect(chargeCompanyClass("Villa Coffee Minas Gerais", true)).toBe("charge-row--third-party");
});
