import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../design-system";
import { registerDialogListener, type DialogRequest } from "../utils/dialogs";

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return (
    <DialogProvider>
      {children}
    </DialogProvider>
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
