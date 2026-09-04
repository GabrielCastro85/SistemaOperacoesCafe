import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../design-system";
import { registerDialogListener, type DialogRequest } from "../utils/dialogs";

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return (
    <DialogProvider>
      {children}
      <LoadingOverlay />
    </DialogProvider>
  );
}

// Acende sozinho sempre que alguma chamada de window.operationsCafe demora --
// nao precisa marcar botao por botao. So' aparece depois de 250ms (chamadas
// rapidas nao piscam a tela a toa) e bloqueia clique na janela inteira
// enquanto estiver visivel, pra impedir clique duplo duplicando o que o
// botao faz (ver withLoadingTracking em electron/preload/index.ts[.cts]).
function LoadingOverlay(): JSX.Element | null {
  const [pendingCount, setPendingCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => window.operationsCafeLoading.subscribe(setPendingCount), []);

  useEffect(() => {
    if (pendingCount > 0) {
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setVisible(true);
      }, 250);
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, [pendingCount]);

  if (!visible) return null;

  return (
    <div className="ui-loading-overlay" role="status" aria-live="polite" aria-label="Carregando, aguarde">
      <div className="ui-loading-overlay__spinner" aria-hidden="true" />
    </div>
  );
}

function DialogProvider({ children }: { children: ReactNode }): JSX.Element {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    registerDialogListener((nextRequest) => {
      setValue("");
      setRequest(nextRequest);
    });
    return () => registerDialogListener(null);
  }, []);

  function close(): void {
    setRequest(null);
    setValue("");
  }

  function cancel(): void {
    const currentRequest = request;
    if (!currentRequest) return;
    if (currentRequest.kind === "decision") {
      currentRequest.resolve(false);
    } else {
      currentRequest.resolve(null);
    }
    close();
  }

  function confirm(): void {
    if (!request) return;
    if (request.kind === "decision") {
      request.resolve(true);
      close();
      return;
    }
    const trimmed = value.trim();
    if (request.required && !trimmed) return;
    request.resolve(trimmed);
    close();
  }

  return (
    <>
      {children}
      {request ? (
        <div className="ui-dialog" role="dialog" aria-modal="true" aria-label={request.title} onKeyDown={(event) => { if (event.key === "Escape") cancel(); }}>
          <section>
            <h2>{request.title}</h2>
            {request.kind === "text" ? (
              <label className="ui-field">
                <span className="ui-field__label">{request.label}</span>
                <textarea className="ui-input" rows={4} value={value} autoFocus onChange={(event) => setValue(event.target.value)} />
              </label>
            ) : (
              <p>{request.message}</p>
            )}
            <footer>
              <Button onClick={cancel}>Cancelar</Button>
              <Button variant="primary" onClick={confirm}>Confirmar</Button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
