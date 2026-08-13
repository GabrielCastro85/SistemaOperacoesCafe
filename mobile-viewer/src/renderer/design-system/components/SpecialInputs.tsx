import type { InputHTMLAttributes } from "react";
import { Input } from "./Input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string | null; hint?: string };

export function DateInput(props: Props): JSX.Element {
  return <Input type="date" {...props} />;
}

export function CurrencyInput(props: Props): JSX.Element {
  return <Input inputMode="decimal" placeholder="0,00" {...props} />;
}

export function DecimalInput(props: Props): JSX.Element {
  return <Input inputMode="decimal" placeholder="0,000000" {...props} />;
}

export function CnpjInput(props: Props): JSX.Element {
  return <Input inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" {...props} />;
}

export function SearchInput(props: Props): JSX.Element {
  return <Input type="search" placeholder="Buscar..." {...props} />;
}
