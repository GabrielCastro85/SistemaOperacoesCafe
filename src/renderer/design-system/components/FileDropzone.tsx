import type { ReactNode } from "react";

export function FileDropzone({ title, description, actions }: { title: string; description: string; actions?: ReactNode }): JSX.Element {
  return (
    <div className="ui-dropzone">
      <strong>{title}</strong>
      <p>{description}</p>
      {actions ? <div className="inline-actions">{actions}</div> : null}
    </div>
  );
}
