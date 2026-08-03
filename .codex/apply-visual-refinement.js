const fs = require("fs");
const path = require("path");

const root = process.cwd();
const skip = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-electron",
  "release",
  "out",
  "build",
  "coverage",
  ".vite",
]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const filePath = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(filePath, acc);
    else acc.push(filePath);
  }
  return acc;
}

function read(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

const css = `/* Shared responsive polish for the desktop UI.
   Uses the current theme variables so Villa and Grao & Grao keep distinct branding. */
:root {
  --ui-surface: var(--surface, var(--card, #fffaf1));
  --ui-surface-strong: var(--surface-strong, #fffdf8);
  --ui-soft: var(--surface-soft, #f6eedf);
  --ui-border: var(--border, #d9c7aa);
  --ui-border-strong: var(--border-strong, #b79a6d);
  --ui-accent: var(--accent, var(--brand-accent, var(--color-accent, #19b875)));
  --ui-danger: var(--danger, #9b2c1f);
  --ui-text: var(--text, #080705);
  --ui-muted: var(--muted, #625647);
  --ui-radius: 8px;
  --ui-shadow: 0 18px 40px rgba(30, 18, 8, 0.08);
}

*, *::before, *::after {
  box-sizing: border-box;
}

html,
body,
#root {
  min-width: 0;
  overflow-x: hidden;
}

body {
  text-rendering: geometricPrecision;
}

:where(main, .app-main, .app-content, .page, .page-shell, .page-content, .workspace, .content, .content-area, .scroll-area) {
  min-width: 0;
}

:where(.page, .page-shell, .page-content, .content-area) {
  padding-inline: clamp(18px, 2.3vw, 40px);
}

:where(.page-header, .section-header, .screen-header) {
  margin-block-end: clamp(16px, 2vw, 28px);
}

:where(.page-content, .content-area, main) > * + * {
  margin-top: clamp(16px, 2vw, 24px);
}

:where(.page-spacer, .section-spacer, .hero-spacer, .empty-spacer, [class*="Spacer"]) {
  min-height: 0 !important;
  height: auto !important;
}

:where(button, .btn, .button, [role="button"]) {
  min-height: 40px;
  padding: 10px 16px;
  border: 1px solid var(--ui-border-strong);
  border-radius: var(--ui-radius);
  background: var(--ui-surface-strong);
  color: var(--ui-text);
  font-weight: 700;
  line-height: 1.15;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background 160ms ease;
}

:where(button, .btn, .button, [role="button"]):hover:not(:disabled):not([aria-disabled="true"]) {
  border-color: var(--ui-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-accent) 18%, transparent);
  transform: translateY(-1px);
}

:where(button, .btn, .button, [role="button"]):focus-visible,
:where(input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--ui-accent) 72%, white);
  outline-offset: 2px;
}

:where(button, .btn, .button, [role="button"]):disabled,
:where(button, .btn, .button, [role="button"])[aria-disabled="true"] {
  opacity: 0.58;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

:where(.danger, .btn-danger, .button-danger, [data-variant="danger"]) {
  border-color: color-mix(in srgb, var(--ui-danger) 70%, white);
  color: var(--ui-danger);
  background: color-mix(in srgb, var(--ui-danger) 8%, var(--ui-surface-strong));
}

:where(input, select, textarea) {
  min-height: 40px;
  max-width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-surface-strong);
  color: var(--ui-text);
  padding: 10px 12px;
  line-height: 1.25;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

:where(input, select, textarea):focus {
  border-color: var(--ui-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-accent) 18%, transparent);
}

textarea {
  min-height: 96px;
  resize: vertical;
}

input[type="checkbox"],
input[type="radio"] {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  padding: 0 !important;
  accent-color: var(--ui-accent);
}

label:has(input[type="checkbox"]),
label:has(input[type="radio"]) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

:where(.card, .panel, .summary-card, .metric-card, .section-card, .form-card, .table-card, .empty-state, [class*="Card"], [class*="Panel"]) {
  min-width: 0;
  border-radius: var(--ui-radius);
  border-color: var(--ui-border);
}

:where(.metric-card, .summary-card, .section-card, .form-card) {
  box-shadow: var(--ui-shadow);
}

:where(.form-grid, .filters-grid, .filter-grid, .field-grid, .input-grid, .controls-grid, .toolbar, .actions, .button-row, .tabs, .segmented-control, [class*="Grid"], [class*="Toolbar"], [class*="Actions"]) {
  gap: clamp(10px, 1.2vw, 18px);
}

:where(.toolbar, .actions, .button-row, .tabs, .segmented-control, [class*="Actions"]) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

table {
  width: 100%;
  max-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
}

th,
td {
  padding: 12px 14px;
  vertical-align: middle;
  overflow-wrap: anywhere;
}

th {
  color: var(--ui-muted);
}

td:last-child,
th:last-child {
  width: 1%;
  white-space: nowrap;
}

td:last-child button,
td:last-child .btn,
td:last-child .button {
  margin: 2px;
}

:where(.table-wrap, .table-container, .table-scroll, [class*="Table"], [class*="table"]) {
  min-width: 0;
  max-width: 100%;
}

:where(.table-wrap, .table-container, .table-scroll) {
  overflow-x: auto;
}

:where(.modal, .dialog, [role="dialog"], [class*="Modal"], [class*="Dialog"]) {
  max-width: min(1120px, calc(100vw - 32px));
}

:where(.modal, .dialog, [role="dialog"], [class*="Modal"], [class*="Dialog"]) :where(.actions, .button-row, [class*="Actions"]) {
  justify-content: flex-end;
  padding-top: 12px;
}

@media (max-width: 1440px) {
  :where(.page, .page-shell, .page-content, .content-area) {
    padding-inline: clamp(16px, 2vw, 28px);
  }

  th,
  td {
    padding: 10px 12px;
  }
}

@media (max-width: 1366px) {
  :where(button, .btn, .button, [role="button"]) {
    min-height: 38px;
    padding: 9px 13px;
    font-size: 14px;
  }

  :where(input, select, textarea) {
    min-height: 38px;
    padding: 9px 11px;
  }

  :where(.card, .panel, .summary-card, .metric-card, .section-card, .form-card, .table-card, .empty-state, [class*="Card"], [class*="Panel"]) {
    padding: min(18px, max(12px, 1.2vw));
  }

  th,
  td {
    padding: 9px 10px;
  }
}

@media (max-width: 1180px) {
  :where(.metrics-grid, .summary-grid, .cards-grid, .dashboard-grid, .form-grid, .filters-grid, .filter-grid, [class*="Grid"]) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 900px) {
  :where(.metrics-grid, .summary-grid, .cards-grid, .dashboard-grid, .form-grid, .filters-grid, .filter-grid, [class*="Grid"]) {
    grid-template-columns: 1fr !important;
  }

  :where(.toolbar, .actions, .button-row, .tabs, .segmented-control, [class*="Actions"]) {
    align-items: stretch;
  }

  :where(.toolbar, .actions, .button-row, .tabs, .segmented-control, [class*="Actions"]) > * {
    flex: 1 1 auto;
  }
}
`;

const files = walk(root);
const candidates = files
  .filter((filePath) => /main\.(tsx|jsx|ts|js)$/.test(filePath))
  .filter((filePath) => /(createRoot|ReactDOM)/.test(read(filePath)));

candidates.sort((a, b) => {
  const score = (filePath) =>
    (filePath.includes(`${path.sep}renderer${path.sep}`) ? 0 : 10) +
    (filePath.includes(`${path.sep}src${path.sep}`) ? 0 : 2) +
    filePath.length / 10000;
  return score(a) - score(b);
});

if (!candidates.length) {
  throw new Error("React entry not found");
}

const entry = candidates[0];
const baseDir = path.dirname(entry);
const stylesDir = path.join(baseDir, "styles");
fs.mkdirSync(stylesDir, { recursive: true });

const cssFile = path.join(stylesDir, "ui-refinement.css");
fs.writeFileSync(cssFile, css, "utf8");

const importPath = "./" + path.relative(baseDir, cssFile).replace(/\\/g, "/");
let source = read(entry);
if (!source.includes(importPath)) {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  let insertAt = 0;
  while (insertAt < lines.length && /^import\b/.test(lines[insertAt])) insertAt += 1;
  lines.splice(insertAt, 0, `import "${importPath}";`);
  fs.writeFileSync(entry, lines.join(eol), "utf8");
}
