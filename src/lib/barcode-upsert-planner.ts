import { normalizeBarcodeInput } from "@/lib/barcode-normalization";

type ExistingBarcodeRecord = {
  id: string;
  barcode: string | null;
};

type ImportRow = {
  rowNumber: number;
  barcode: string | null;
};

export type BarcodeUpsertPlan<Row extends ImportRow> = {
  warnings: string[];
  uniqueRows: Row[];
  existingByNormalizedBarcode: Map<string, string>;
  decideOperation: (row: Row) => "update" | "insert" | "skip";
};

export function buildBarcodeUpsertPlan<Row extends ImportRow>(params: {
  rows: Row[];
  existingRecords: ExistingBarcodeRecord[];
}) {
  const warnings: string[] = [];
  const dedupedRowsByBarcode = new Map<string, Row>();

  for (const row of params.rows) {
    const normalizedBarcode = normalizeBarcodeInput(row.barcode);
    if (!normalizedBarcode) {
      warnings.push(`Row ${row.rowNumber}: barcode is required for duplicate-safe import.`);
      continue;
    }

    dedupedRowsByBarcode.set(normalizedBarcode, row);
  }

  const existingByNormalizedBarcode = new Map<string, string>();
  for (const record of params.existingRecords) {
    const normalizedBarcode = normalizeBarcodeInput(record.barcode);
    if (normalizedBarcode && !existingByNormalizedBarcode.has(normalizedBarcode)) {
      existingByNormalizedBarcode.set(normalizedBarcode, record.id);
    }
  }

  const uniqueRows = Array.from(dedupedRowsByBarcode.values());

  const decideOperation = (row: Row) => {
    const normalizedBarcode = normalizeBarcodeInput(row.barcode);
    if (!normalizedBarcode) return "skip";
    return existingByNormalizedBarcode.has(normalizedBarcode) ? "update" : "insert";
  };

  return {
    warnings,
    uniqueRows,
    existingByNormalizedBarcode,
    decideOperation,
  } satisfies BarcodeUpsertPlan<Row>;
}
