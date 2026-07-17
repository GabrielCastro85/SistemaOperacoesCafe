import { useCallback, useEffect, useState } from "react";
import type { Product } from "../../../../shared/types/domain";

export function useProducts(organizationId: string): { products: Product[]; reload: () => Promise<void> } {
  const [products, setProducts] = useState<Product[]>([]);
  const reload = useCallback(async () => {
    setProducts(await window.operationsCafe.listProducts({ organizationId, status: "all" }));
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { products, reload };
}
