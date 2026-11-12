import { describe, expect, it } from "vitest";
import { currencyInWords } from "../src/shared/utils/currencyInWords";

describe("valor por extenso", () => {
  it("escreve valores de recibo", () => {
    expect(currencyInWords(72_450_000)).toBe("setecentos e vinte e quatro mil e quinhentos reais");
    expect(currencyInWords(100)).toBe("um real");
    expect(currencyInWords(10_000)).toBe("cem reais");
    expect(currencyInWords(150_050)).toBe("mil e quinhentos reais e cinquenta centavos");
    expect(currencyInWords(123_456_789)).toBe("um milhão, duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos");
    expect(currencyInWords(200_000_000)).toBe("dois milhões de reais");
    expect(currencyInWords(203_000_00)).toBe("duzentos e três mil reais");
    expect(currencyInWords(2_030_000)).toBe("vinte mil e trezentos reais");
    expect(currencyInWords(1)).toBe("um centavo");
    expect(currencyInWords(148_500_000)).toBe("um milhão, quatrocentos e oitenta e cinco mil reais");
    expect(currencyInWords(101_100_000)).toBe("um milhão e onze mil reais");
  });
});
