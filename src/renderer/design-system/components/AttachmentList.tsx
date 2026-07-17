import { DocumentPreviewCard } from "./DocumentPreviewCard";

export function AttachmentList({ items }: { items: Array<{ id: string; title: string; type: string; hash?: string | null }> }): JSX.Element {
  return <div className="ui-attachment-list">{items.map((item) => <DocumentPreviewCard key={item.id} title={item.title} type={item.type} hash={item.hash} />)}</div>;
}
