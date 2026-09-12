export const OPERATION_INVOICE_TYPES = ["electricidade", "agua_potavel", "agua_industrial", "hvo", "gasoleo", "outro"] as const;
export type OperationInvoiceType = typeof OPERATION_INVOICE_TYPES[number];

export const OPERATION_INVOICE_LABELS: Record<OperationInvoiceType, string> = { electricidade: "Eletricidade", agua_potavel: "Água potável", agua_industrial: "Água industrial", hvo: "HVO", gasoleo: "Gasóleo", outro: "Outro" };

function normalizeText(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }

export function normalizeOperationInvoiceType(value: string): OperationInvoiceType | null {
  if ((OPERATION_INVOICE_TYPES as readonly string[]).includes(value)) return value as OperationInvoiceType;
  const normalized = normalizeText(value);
  const entry = Object.entries(OPERATION_INVOICE_LABELS).find(([, label]) => normalizeText(label) === normalized);
  return entry ? entry[0] as OperationInvoiceType : null;
}

export function operationInvoiceLabel(value: string) { return OPERATION_INVOICE_LABELS[value as OperationInvoiceType] || value; }

export function buildOperationInvoicePayload<T extends Record<string, unknown>>(input: T & { invoiceType: string }) {
  const invoiceType = normalizeOperationInvoiceType(input.invoiceType);
  return invoiceType ? { ...input, invoiceType } : null;
}
