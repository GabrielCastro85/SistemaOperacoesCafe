import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { Button, DataTable, EmptyState, Input, StatusBadge, Tabs, buildUiTheme, getReadableTextColor } from "../src/renderer/design-system/index.js";
import { navigationGroups, routeIdFromLegacyMenu } from "../src/renderer/app/navigation.js";

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
  });
});
