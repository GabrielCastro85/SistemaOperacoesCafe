import type { PartnerContact } from "../../../../shared/types/domain";

export function PartnerContacts({ contacts }: { contacts: PartnerContact[] }): JSX.Element {
  return <div className="table">{contacts.map((contact) => <div key={contact.id} className="table-row"><span>{contact.name}</span><span>{contact.phone ?? contact.email ?? "-"}</span></div>)}</div>;
}
