export function PartnerHistory({ events }: { events: string[] }): JSX.Element {
  return <div className="timeline">{events.map((event) => <span key={event}>{event}</span>)}</div>;
}
