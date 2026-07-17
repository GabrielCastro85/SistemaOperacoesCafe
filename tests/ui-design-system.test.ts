import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Button, ConfirmationDialog, DataTable, DocumentPreviewCard, EmptyState, FileDropzone, Input, Pagination, ProgressBar, StatusBadge, Stepper, Tabs, buildUiTheme, getReadableTextColor } from "../src/renderer/design-system/index.js";
import { legacyMenuFromPath, navigationGroups, pathFromLegacyMenu, routeIdFromLegacyMenu } from "../src/renderer/app/navigation.js";

describe("renderer design system", () => {
  it("renders accessible basic controls without browser APIs", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Button, { variant: "primary" }, "Salvar"),
        React.createElement(Input, { label: "CNPJ próprio", value: "", onChange: () => undefined }),
        React.createElement(StatusBadge, { status: "ISSUED", label: "Emitida" }),
        React.createElement(Tabs, { items: [{ id: "a", label: "Aba A" }], active: "a", onChange: () => undefined }),
        React.createElement(EmptyState, { title: "Sem dados", description: "Cadastre o primeiro registro." })
      )
    );

    expect(html).toContain("Salvar");
    expect(html).toContain("CNPJ próprio");
    expect(html).toContain("Emitida");
    expect(html).toContain("role=\"tab\"");
    expect(html).toContain("Sem dados");
  });

  it("renders tables with empty and filled states", () => {
    const columns = [{ key: "name", header: "Nome", render: (row: { name: string }) => row.name }];
    const empty = renderToStaticMarkup(React.createElement(DataTable<{ name: string }>, { columns, rows: [], getRowKey: (row) => row.name }));
    const filled = renderToStaticMarkup(React.createElement(DataTable<{ name: string }>, { columns, rows: [{ name: "Villa Coffee" }], getRowKey: (row) => row.name }));

    expect(empty).toContain("Nenhum registro encontrado.");
    expect(filled).toContain("Villa Coffee");
  });

  it("maps branding themes and navigation consistently", () => {
    const villaTheme = buildUiTheme("villa", null);
    const graoTheme = buildUiTheme("grao", null);

    expect(villaTheme.colors.sidebar).not.toBe(graoTheme.colors.sidebar);
    expect(getReadableTextColor("#ffffff")).toBe("#111111");
    expect(getReadableTextColor("#111111")).toBe("#ffffff");
    expect(navigationGroups.flatMap((group) => group.items).some((item) => item.legacyMenu === "Confirmacoes")).toBe(true);
    expect(routeIdFromLegacyMenu("Financeiro")).toBe("finance");
    expect(pathFromLegacyMenu("Notas e operacoes")).toBe("/operations");
    expect(pathFromLegacyMenu("Produtos")).toBe("/products");
    expect(pathFromLegacyMenu("Regras por saca")).toBe("/billing/rates");
    expect(legacyMenuFromPath("/imports/xml/history")).toBe("Notas e operacoes");
    expect(legacyMenuFromPath("/products/details")).toBe("Produtos");
    expect(legacyMenuFromPath("/billing/rates/active")).toBe("Regras por saca");
    expect(legacyMenuFromPath("/charges/issued")).toBe("Cobrancas");
    expect(legacyMenuFromPath("/client-ledger/client")).toBe("Conta-corrente");
    expect(legacyMenuFromPath("/confirmations/templates")).toBe("Confirmacoes");
  });

  it("renders migration components for operational workflows", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Stepper, { activeId: "origin", steps: [{ id: "origin", label: "Origem", status: "current" }] }),
        React.createElement(FileDropzone, { title: "Arquivo", description: "Selecione ou arraste arquivos." }),
        React.createElement(ProgressBar, { value: 45, label: "Progresso" }),
        React.createElement(Pagination, { page: 1, pageCount: 3, onPageChange: () => undefined }),
        React.createElement(DocumentPreviewCard, { title: "CONF-001.pdf", type: "ISSUED_ORIGINAL", hash: "abcdef1234567890" }),
        React.createElement(ConfirmationDialog, { open: true, title: "Confirmar", onConfirm: () => undefined, onCancel: () => undefined }, "Deseja continuar?")
      )
    );

    expect(html).toContain("Origem");
    expect(html).toContain("Selecione ou arraste");
    expect(html).toContain("progressbar");
    expect(html).toContain("CONF-001.pdf");
    expect(html).toContain("Deseja continuar?");
  });

  it("keeps all migrated routes out of LegacyWorkspace", () => {
    const appSource = readFileSync("src/renderer/app/App.tsx", "utf8");

    expect(existsSync("src/renderer/pages/legacy/LegacyWorkspace.tsx")).toBe(false);
    expect(appSource).not.toContain("LegacyWorkspace");
    expect(appSource).toContain('path.startsWith("/operations")');
    expect(appSource).toContain('path.startsWith("/partners")');
    expect(appSource).toContain('path.startsWith("/products")');
    expect(appSource).toContain('path.startsWith("/billing/rates")');
    expect(appSource).toContain('path.startsWith("/charges")');
    expect(appSource).toContain('path.startsWith("/client-ledger")');
    expect(appSource).toContain('path.startsWith("/confirmations")');
    expect(appSource).toContain('path.startsWith("/finance/payables")');
    expect(appSource).toContain('path.startsWith("/finance/recurring")');
    expect(appSource).toContain('path.startsWith("/finance/installments")');
    expect(appSource).toContain('path.startsWith("/finance/payments")');
    expect(appSource).toContain('path.startsWith("/finance/calendar")');
    expect(appSource).toContain('path.startsWith("/finance/categories")');
    expect(appSource).toContain('path.startsWith("/finance/reports")');
    expect(appSource).toContain('path.startsWith("/settings/organizations")');
    expect(appSource).toContain('path.startsWith("/settings/legal-entities")');
    expect(appSource).toContain('path.startsWith("/settings/locations")');
    expect(appSource).toContain('path.startsWith("/settings/branding")');
    expect(appSource).toContain('path.startsWith("/settings/diagnostics")');
    expect(appSource).toContain("<NotFoundPage />");
  });

  it("uses the React dialog provider instead of native or manual DOM dialogs", () => {
    const dialogSource = readFileSync("src/renderer/utils/dialogs.ts", "utf8");
    const providersSource = readFileSync("src/renderer/app/providers.tsx", "utf8");

    expect(dialogSource).not.toContain("window.prompt");
    expect(dialogSource).not.toContain("window.alert");
    expect(dialogSource).not.toContain("window.confirm");
    expect(dialogSource).not.toContain("document.createElement");
    expect(providersSource).toContain("DialogProvider");
    expect(providersSource).toContain("registerDialogListener");
  });
});
