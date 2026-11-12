import { describe, expect, it } from "vitest";
import { parseCepeaTable } from "../server/src/market";

const html = `
<table id="imagenet-indicador1" class="imagenet-table">
  <thead><tr><th>Data</th><th>Valor R$*</th><th>Var./Dia</th><th>Var./Mês</th><th>Valor US$*</th></tr></thead>
  <tbody>
    <tr><td>11/11/2026</td><td>1.593,28</td><td>-1,12%</td><td>-0,32%</td><td>286,43</td></tr>
    <tr><td>10/11/2026</td><td>1.611,30</td><td>0,90%</td><td>0,81%</td><td>288,51</td></tr>
  </tbody>
</table>
<table id="imagenet-indicador2" class="imagenet-table">
  <tbody><tr><td>11/11/2026</td><td>974,24</td><td>-0,38%</td><td>0,19%</td><td>175,14</td></tr></tbody>
</table>`;

describe("cotacoes do carrossel", () => {
  it("le a linha mais recente de cada indicador do CEPEA", () => {
    expect(parseCepeaTable(html, "imagenet-indicador1")).toEqual({ date: "2026-11-11", value: 1593.28, changePercent: -1.12 });
    expect(parseCepeaTable(html, "imagenet-indicador2")).toEqual({ date: "2026-11-11", value: 974.24, changePercent: -0.38 });
    expect(parseCepeaTable(html, "imagenet-indicador9")).toBeNull();
  });
});
