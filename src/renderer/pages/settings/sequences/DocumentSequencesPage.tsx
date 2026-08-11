import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Input, PageHeader } from "../../../design-system";
import type { DealConfirmationSequenceStatus } from "../../../../shared/types/domain";

export function DocumentSequencesPage(): JSX.Element {
  const [rows, setRows] = useState<DealConfirmationSequenceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [floorDrafts, setFloorDrafts] = useState<Record<string, string>>({});
  const [bulkFloor, setBulkFloor] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const status = await window.operationsCafe.listDealConfirmationSequenceStatus();
      setRows(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar as numeracoes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function applyFloor(row: DealConfirmationSequenceStatus): Promise<void> {
    const raw = floorDrafts[row.ownLegalEntityId] ?? "";
    const floor = Number(raw);
    if (!raw || !Number.isInteger(floor) || floor < 0) {
      setError("Informe um numero inteiro valido.");
      return;
    }
    if (floor <= row.currentNumber) {
      setError(`O piso precisa ser maior que o numero atual (${row.currentNumber}) -- numeros ja emitidos nunca sao reduzidos.`);
      return;
    }
    const confirmed = window.confirm(
      `Confirma que a proxima confirmacao de "${row.tradeName}" deve comecar em ${row.prefix}${String(floor + 1).padStart(4, "0")}?\n\nNumeros abaixo de ${floor} nao serao mais preenchidos automaticamente.`
    );
    if (!confirmed) return;
    setError(null);
    setMessage(null);
    setSavingId(row.ownLegalEntityId);
    try {
      const updated = await window.operationsCafe.setDealConfirmationSequenceFloor(row.ownLegalEntityId, floor);
      setRows((prev) => prev.map((item) => (item.ownLegalEntityId === row.ownLegalEntityId ? updated : item)));
      setFloorDrafts((prev) => ({ ...prev, [row.ownLegalEntityId]: "" }));
      setMessage(`Proxima confirmacao de "${row.tradeName}" sera ${updated.nextNumber}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao definir o piso.");
    } finally {
      setSavingId(null);
    }
  }

  async function applyBulkFloor(): Promise<void> {
    const floor = Number(bulkFloor);
    if (!bulkFloor || !Number.isInteger(floor) || floor < 0) {
      setError("Informe um numero inteiro valido.");
      return;
    }
    const confirmed = window.confirm(
      `Confirma aplicar o piso ${floor} a TODAS as empresas? A proxima confirmacao emitida por cada uma comecara em ${floor + 1} (numeros ja emitidos acima disso sao mantidos).`
    );
    if (!confirmed) return;
    setError(null);
    setMessage(null);
    setBulkSaving(true);
    try {
      const updated = await window.operationsCafe.setDealConfirmationSequenceFloorForAllEntities(floor);
      setRows(updated);
      setBulkFloor("");
      setMessage(`Piso ${floor} aplicado a ${updated.length} empresa(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aplicar o piso a todas as empresas.");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <section className="content-section">
      <PageHeader
        eyebrow="Numeracoes"
        title="Numeracoes de documentos"
        description="Configuracoes de sequencia sao sensiveis e nao devem reduzir numeros ja emitidos."
      />
      <Alert variant="warning" title="Edicao protegida">
        Definir um piso so aumenta o numero atual (nunca reduz) e nao afeta confirmacoes ja emitidas. Numeros abaixo do piso
        deixam de ser preenchidos automaticamente.
      </Alert>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card title="Aplicar a todas as empresas" eyebrow="Acao em lote">
        <Input
          label="Comecar a contar a partir de"
          type="number"
          min={0}
          step={1}
          value={bulkFloor}
          onChange={(event) => setBulkFloor(event.target.value)}
          hint="Ex.: 20 faz a proxima confirmacao de cada empresa sair como 21."
        />
        <div className="actions">
          <Button variant="primary" loading={bulkSaving} onClick={() => void applyBulkFloor()}>
            Aplicar a todas
          </Button>
        </div>
      </Card>

      <DataTable
        rows={rows}
        getRowKey={(row) => row.ownLegalEntityId}
        emptyLabel={loading ? "Carregando..." : "Nenhuma empresa ativa encontrada."}
        columns={[
          { key: "entity", header: "CNPJ proprio", render: (row) => row.tradeName },
          { key: "prefix", header: "Prefixo", render: (row) => row.prefix },
          { key: "year", header: "Ano", render: (row) => row.year },
          { key: "number", header: "Numero atual", render: (row) => row.currentNumber },
          { key: "next", header: "Proxima", render: (row) => row.nextNumber },
          {
            key: "setFloor",
            header: "Definir piso",
            render: (row) => (
              <div className="actions">
                <input
                  className="ui-input"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ex.: 20"
                  value={floorDrafts[row.ownLegalEntityId] ?? ""}
                  onChange={(event) => setFloorDrafts((prev) => ({ ...prev, [row.ownLegalEntityId]: event.target.value }))}
                />
                <Button
                  variant="secondary"
                  loading={savingId === row.ownLegalEntityId}
                  onClick={() => void applyFloor(row)}
                >
                  Aplicar
                </Button>
              </div>
            )
          }
        ]}
      />
    </section>
  );
}
