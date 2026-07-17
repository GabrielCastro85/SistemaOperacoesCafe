import type { Product } from "../../../shared/types/domain";
import { PageHeader } from "../../design-system";

export function ProductDetailsPage({ product }: { product: Product | null }): JSX.Element {
  return <PageHeader eyebrow="Produto" title={product?.name ?? "Produto"} description={product ? `Codigo ${product.code ?? "-"}` : "Selecione um produto para visualizar detalhes."} />;
}
