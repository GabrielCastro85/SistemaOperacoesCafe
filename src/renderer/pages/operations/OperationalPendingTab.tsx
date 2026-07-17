import { PendingTable } from "./components/PendingTable";

export function OperationalPendingTab({ pending }: { pending: string[] }): JSX.Element {
  return <PendingTable pending={pending} />;
}
