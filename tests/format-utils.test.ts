import { describe, expect, it } from "vitest";
import { formatDateBr, parseCurrencyToCents } from "../src/shared/utils/format";

describe("parseCurrencyToCents", () => {
  it("parses a plain reais value with comma decimals", () => {
    expect(parseCurrencyToCents("2175,00")).toBe(217500);
  });

  it("parses a value with a thousands separator", () => {
    expect(parseCurrencyToCents("1.234,56")).toBe(123456);
  });

  it("parses an integer reais value with no decimals", () => {
    expect(parseCurrencyToCents("5000")).toBe(500000);
  });

  it("returns 0 for empty or invalid input instead of throwing", () => {
    expect(parseCurrencyToCents("")).toBe(0);
    expect(parseCurrencyToCents("abc")).toBe(0);
  });
});

describe("formatDateBr", () => {
  it("converts ISO UTC timestamps to the local display time", () => {
    expect(formatDateBr("2026-07-23T22:39:00.000Z")).toBe("23-07-2026 19:39");
  });
});
