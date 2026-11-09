// Totais no rodape das tabelas do site. Soma as colunas de valor (Valor,
// Total, Saldo, Pago, Sacas...) das linhas que estao na tela e mostra uma linha
// "Total" no fim da tabela. So muda a exibicao; a tela do app nao sabe dessa linha.

const SUMMABLE = /valor|total|saldo|pago|aberto|sacas|quantidade|receber|desconto|acr[eé]scimo|cr[eé]dito|d[eé]bito|servi[cç]o|frete|dae/i;
const TOTAL_CLASS = "site-table-total";

function parseCell(text: string): { value: number; money: boolean } | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || clean === "-" || clean === "—") return { value: 0, money: false };
  const money = clean.includes("R$");
  const negative = /^[-−]/.test(clean);
  const core = clean.replace(/^[+−-]\s*/, "").replace("R$", "").replace(/\s*(sc|sacas|kg|un)$/i, "").trim();
  if (!/^-?[\d.]+(,\d+)?$/.test(core)) return null;
  const value = Number(core.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? { value: negative ? -value : value, money } : null;
}

function format(value: number, money: boolean): string {
  return money
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

interface Grid { headers: string[]; rows: string[][]; build: (cells: string[], count: number) => HTMLElement | null; existing: HTMLElement | null; place: (row: HTMLElement) => void }

function computeTotals(grid: Grid): string[] | null {
  if (grid.rows.length < 2) return null;
  let found = false;
  const cells = grid.headers.map((header, index) => {
    if (index === 0 || !SUMMABLE.test(header)) return "";
    let total = 0;
    let money = false;
    let parsed = 0;
    for (const row of grid.rows) {
      const cell = parseCell(row[index] ?? "");
      if (!cell) continue;
      parsed += 1;
      total += cell.value;
      money ||= cell.money;
    }
    if (parsed < grid.rows.length * 0.8) return "";
    found = true;
    return format(Math.round(total * 1000) / 1000, money);
  });
  return found ? cells : null;
}

function divGrids(): Grid[] {
  return [...document.querySelectorAll<HTMLElement>(".content-section .table")].flatMap((table) => {
    const head = [...table.children].find((child) => child.classList.contains("table-head")) as HTMLElement | undefined;
    if (!head || table.offsetParent === null) return [];
    const rows = [...table.children].filter((child): child is HTMLElement => child.classList.contains("table-row") && !child.classList.contains(TOTAL_CLASS) && (child as HTMLElement).offsetParent !== null);
    const existing = [...table.children].find((child) => child.classList.contains(TOTAL_CLASS)) as HTMLElement | undefined;
    return [{
      headers: [...head.children].map((cell) => (cell.textContent ?? "").trim()),
      rows: rows.map((row) => [...row.children].map((cell) => (cell.textContent ?? "").trim())),
      existing: existing ?? null,
      build: () => {
        const row = document.createElement("div");
        row.className = `${[...head.classList].filter((name) => name !== "table-head").join(" ")} table-row ${TOTAL_CLASS}`;
        return row;
      },
      place: (row) => { if (table.lastElementChild !== row) table.appendChild(row); }
    }];
  });
}

function htmlGrids(): Grid[] {
  return [...document.querySelectorAll<HTMLTableElement>(".content-section table")].flatMap((table) => {
    const headRow = table.tHead?.rows[0];
    const body = table.tBodies[0];
    if (!headRow || !body || table.offsetParent === null) return [];
    const existing = table.querySelector<HTMLElement>(`tfoot.${TOTAL_CLASS}`);
    return [{
      headers: [...headRow.cells].map((cell) => (cell.textContent ?? "").trim()),
      rows: [...body.rows].filter((row) => row.offsetParent !== null && row.cells.length === headRow.cells.length).map((row) => [...row.cells].map((cell) => (cell.textContent ?? "").trim())),
      existing,
      build: () => {
        const foot = document.createElement("tfoot");
        foot.className = TOTAL_CLASS;
        return foot;
      },
      place: (foot) => { if (foot.parentElement !== table) table.appendChild(foot); }
    }];
  });
}

function render(grid: Grid): void {
  const totals = computeTotals(grid);
  if (!totals) { grid.existing?.remove(); return; }
  const signature = JSON.stringify([grid.rows.length, totals]);
  if (grid.existing?.dataset.signature === signature) { grid.place(grid.existing); return; }
  const element = grid.existing ?? grid.build(totals, grid.rows.length);
  if (!element) return;
  element.dataset.signature = signature;
  const label = `Total · ${grid.rows.length} linhas`;
  if (element.tagName === "TFOOT") {
    const tr = document.createElement("tr");
    totals.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = index === 0 ? label : value;
      tr.appendChild(td);
    });
    element.replaceChildren(tr);
  } else {
    element.replaceChildren(...totals.map((value, index) => {
      const span = document.createElement("span");
      span.textContent = index === 0 ? label : value;
      return span;
    }));
  }
  element.setAttribute("aria-label", label);
  grid.place(element);
}

export function startSiteTables(): void {
  let timer = 0;
  const run = () => { [...divGrids(), ...htmlGrids()].forEach(render); };
  // A linha de total so e reescrita quando os numeros mudam, entao a observacao nao entra em ciclo.
  new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 250);
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  run();
}
