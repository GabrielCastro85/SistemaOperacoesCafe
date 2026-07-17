import type { DealConfirmationDetail } from "../../../shared/types/domain";
import { PageHeader } from "../../design-system";
import { ConfirmationDocuments } from "./components/ConfirmationDocuments";
import { ConfirmationItemsTable } from "./components/ConfirmationItemsTable";

export function ConfirmationDetailsPage({ detail }: { detail: DealConfirmationDetail }): JSX.Element {
  return <section className="content-section"><PageHeader title={detail.confirmation.confirmationNumber ?? detail.confirmation.temporaryReference} /><ConfirmationItemsTable items={detail.items} /><ConfirmationDocuments documents={detail.documents} /></section>;
}
