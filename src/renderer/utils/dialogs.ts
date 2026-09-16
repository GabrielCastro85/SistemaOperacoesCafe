export type DialogRequest =
  | {
      id: string;
      kind: "text";
      title: string;
      label: string;
      required: boolean;
      initialValue?: string;
      resolve: (value: string | null) => void;
    }
  | {
      id: string;
      kind: "decision";
      title: string;
      message: string;
      resolve: (value: boolean) => void;
    };

type DialogListener = (request: DialogRequest) => void;

let listener: DialogListener | null = null;

export function registerDialogListener(nextListener: DialogListener | null): void {
  listener = nextListener;
}

export async function requestTextInput({ title, label, required = true, initialValue }: { title: string; label: string; required?: boolean; initialValue?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    listener?.({ id: crypto.randomUUID(), kind: "text", title, label, required, initialValue, resolve });
  });
}

export async function requestDecision({ title, message }: { title: string; message: string }): Promise<boolean> {
  return new Promise((resolve) => {
    listener?.({ id: crypto.randomUUID(), kind: "decision", title, message, resolve });
  });
}
