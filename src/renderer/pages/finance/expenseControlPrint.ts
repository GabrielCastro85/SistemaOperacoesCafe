// Folha "CONTROLE DE DESPESAS" (modelo das planilhas NOV/NOV 2): faixa verde,
// colunas DATA | FAVORECIDO | VALOR | STATUS | CHAVE PIX, parcela destacada
// em roxo e TOTAL em amarelo. Contas pagas saem com STATUS "PAGO".

export interface ExpenseControlRow {
  dueDate: string; // AAAA-MM-DD
  description: string;
  payee: string;
  installment: string | null; // "17/22"
  amountCents: number;
  paidCents: number;
  status: "PAID" | "PARTIAL" | "OPEN";
  pixKey: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char] ?? char);
const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function favorecido(row: ExpenseControlRow): string {
  // Descricao como no modelo; o favorecido entra quando nao estiver no texto.
  const text = row.payee && !row.description.toLocaleUpperCase("pt-BR").includes(row.payee.toLocaleUpperCase("pt-BR")) ? `${row.description} — ${row.payee}` : row.description;
  return `${escapeHtml(text.toLocaleUpperCase("pt-BR"))}${row.installment ? ` <span class="parcela">${escapeHtml(row.installment)}</span>` : ""}`;
}

export function buildExpenseControlHtml(rows: ExpenseControlRow[], options: { title: string; subtitle: string }): string {
  const sorted = [...rows].sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.description.localeCompare(right.description, "pt-BR"));
  const total = sorted.reduce((sum, row) => sum + row.amountCents, 0);
  const paid = sorted.reduce((sum, row) => sum + Math.min(row.paidCents, row.amountCents), 0);
  const body = sorted.map((row) => {
    const status = row.status === "PAID" ? `<span class="pago">PAGO</span>` : row.status === "PARTIAL" ? `<span class="parcial">PAGO ${money(row.paidCents)}</span>` : "";
    return `<tr class="${row.status === "PAID" ? "linha-paga" : ""}"><td class="data">${brDate(row.dueDate)}</td><td class="fav">${favorecido(row)}</td><td class="rs">R$</td><td class="valor">${row.amountCents ? money(row.amountCents) : "-"}</td><td class="status">${status}</td><td class="pix">${escapeHtml(row.pixKey ?? "")}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(options.title)}</title><style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .sub { margin: 0 0 6px; font-size: 11px; color: #444; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; font-weight: 700; }
    thead tr.titulo th { background: #1e7a34; color: #fff; font-size: 11.5px; padding: 4px; text-align: center; letter-spacing: .02em; }
    thead tr.colunas th { background: #000; color: #fff; padding: 3px 4px; font-size: 11px; }
    td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; }
    td.data { width: 70px; white-space: nowrap; }
    td.rs { width: 22px; border-right: 0; color: #1e7a34; }
    td.valor { width: 80px; border-left: 0; text-align: right; white-space: nowrap; }
    td.status { width: 64px; text-align: center; }
    td.pix { width: 30%; }
    .parcela { color: #9b2fae; }
    .pago { color: #1e7a34; }
    .parcial { color: #b36b00; font-size: 9.5px; }
    tr.linha-paga td { background: #eaf6ec; }
    tfoot td { border: 0; padding-top: 4px; }
    tfoot .rotulo { background: #fff200; text-align: center; border: 1px solid #000; }
    tfoot .num { background: #fff200; text-align: right; border: 1px solid #000; white-space: nowrap; }
    tfoot .resumo td { font-size: 10px; font-weight: 700; color: #333; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  </style></head><body>
  <p class="sub">${escapeHtml(options.subtitle)}</p>
  <table>
    <thead>
      <tr class="titulo"><th colspan="6">CONTROLE DE DESPESAS</th></tr>
      <tr class="colunas"><th>DATA</th><th>FAVORECIDO</th><th colspan="2">VALOR</th><th>STATUS</th><th>CHAVE PIX</th></tr>
    </thead>
    <tbody>${body || `<tr><td colspan="6" style="text-align:center;padding:14px">Nenhuma conta no período.</td></tr>`}</tbody>
    <tfoot>
      <tr><td></td><td class="rotulo">TOTAL</td><td class="num" colspan="2">R$ ${money(total)}</td><td></td><td></td></tr>
      <tr class="resumo"><td></td><td style="text-align:right">Já pago</td><td colspan="2" style="text-align:right">R$ ${money(paid)}</td><td></td><td></td></tr>
      <tr class="resumo"><td></td><td style="text-align:right">Falta pagar</td><td colspan="2" style="text-align:right">R$ ${money(total - paid)}</td><td></td><td></td></tr>
    </tfoot>
  </table>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });</script>
  </body></html>`;
}
