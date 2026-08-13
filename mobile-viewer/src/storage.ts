import { CONFIRMATION_FILES_BUCKET, supabase } from "./supabaseClient";

export async function openStorageFile(path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(CONFIRMATION_FILES_BUCKET).createSignedUrl(path, 60);
  if (error || !data) {
    window.alert(`Nao foi possivel gerar o link de download: ${error?.message ?? "erro desconhecido"}`);
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function formatDateBr(value: string | null): string {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function formatCurrencyBr(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
