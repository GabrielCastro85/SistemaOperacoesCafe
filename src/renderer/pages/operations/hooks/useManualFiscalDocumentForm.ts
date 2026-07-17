import { useState } from "react";

export function useManualFiscalDocumentForm(): { number: string; setNumber: (value: string) => void; total: string; setTotal: (value: string) => void } {
  const [number, setNumber] = useState("");
  const [total, setTotal] = useState("1000.00");
  return { number, setNumber, total, setTotal };
}
