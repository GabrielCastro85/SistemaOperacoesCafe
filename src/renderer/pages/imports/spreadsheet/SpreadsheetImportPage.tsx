import type { BootstrapData } from "../../../../shared/types/domain";
import { OperationsPage } from "../../operations/OperationsPage";

export function SpreadsheetImportPage({ data }: { data: BootstrapData }): JSX.Element {
  return <OperationsPage data={data} />;
}
