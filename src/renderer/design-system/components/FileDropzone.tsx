import { useState, type DragEvent, type ReactNode } from "react";

interface FileDropzoneProps {
  title: string;
  description: string;
  actions?: ReactNode;
  dropHint?: string;
  onDropFiles?: (files: File[]) => void;
}

export function FileDropzone({ title, description, actions, dropHint, onDropFiles }: FileDropzoneProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);

  function handleDrag(event: DragEvent<HTMLDivElement>): void {
    if (!onDropFiles) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") setIsDragging(true);
    if (event.type === "dragleave") setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    if (!onDropFiles) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onDropFiles(files);
  }

  return (
    <div
      className={`ui-dropzone${isDragging ? " is-dragging" : ""}${onDropFiles ? " is-interactive" : ""}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <strong>{title}</strong>
      <p>{description}</p>
      {dropHint ? <span>{dropHint}</span> : null}
      {actions ? <div className="inline-actions">{actions}</div> : null}
    </div>
  );
}
