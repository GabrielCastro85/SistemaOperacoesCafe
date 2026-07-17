import { PageHeader } from "../../../design-system";
import type { SettingsPageProps } from "../types";
export function LocationDetailsPage({ data }: SettingsPageProps): JSX.Element { const item = data.locations[0]; return <section className="content-section"><PageHeader eyebrow="Local" title={item?.name ?? "Local"} description={item ? `${item.city ?? "-"} / ${item.state ?? "-"}` : "Selecione um local."} /></section>; }
