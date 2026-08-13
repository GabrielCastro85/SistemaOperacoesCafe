import { Button } from "./Button";

export function Pagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }): JSX.Element {
  return (
    <div className="ui-pagination">
      <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</Button>
      <span>Página {page} de {Math.max(1, pageCount)}</span>
      <Button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Próxima</Button>
    </div>
  );
}
