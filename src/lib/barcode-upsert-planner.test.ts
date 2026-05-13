import { describe, expect, it } from "vitest";

import { normalizeBarcodeInput } from "@/lib/barcode-normalization";
import { buildBarcodeUpsertPlan } from "@/lib/barcode-upsert-planner";

describe("normalizeBarcodeInput", () => {
  it("normalizes unicode forms, separators, case, and arabic digits", () => {
    expect(normalizeBarcodeInput("  AB-12/34 ")).toBe("ab1234");
    expect(normalizeBarcodeInput("۰۰١٢-٣٤")).toBe("001234");
    expect(normalizeBarcodeInput("ＡＢ１２３")).toBe("ab123");
  });

  it("returns null for empty or separator-only values", () => {
    expect(normalizeBarcodeInput(null)).toBeNull();
    expect(normalizeBarcodeInput("   ")).toBeNull();
    expect(normalizeBarcodeInput("- / _")).toBeNull();
  });
});

describe("buildBarcodeUpsertPlan", () => {
  it("decides update when barcode matches existing after normalization", () => {
    const plan = buildBarcodeUpsertPlan({
      rows: [{ rowNumber: 2, barcode: "۰۰١٢-٣٤" }],
      existingRecords: [{ id: "existing-1", barcode: "001234" }],
    });

    expect(plan.uniqueRows).toHaveLength(1);
    expect(plan.decideOperation(plan.uniqueRows[0])).toBe("update");
  });

  it("keeps one row per normalized barcode to prevent duplicate inserts", () => {
    const plan = buildBarcodeUpsertPlan({
      rows: [
        { rowNumber: 2, barcode: "AB-123", nameEn: "Old" },
        { rowNumber: 3, barcode: "ab123", nameEn: "Latest" },
      ],
      existingRecords: [],
    });

    expect(plan.uniqueRows).toHaveLength(1);
    expect(plan.uniqueRows[0].rowNumber).toBe(3);
    expect(plan.decideOperation(plan.uniqueRows[0])).toBe("insert");
  });

  it("skips rows with missing barcode and emits warnings", () => {
    const plan = buildBarcodeUpsertPlan({
      rows: [
        { rowNumber: 2, barcode: null },
        { rowNumber: 3, barcode: "   " },
      ],
      existingRecords: [],
    });

    expect(plan.uniqueRows).toHaveLength(0);
    expect(plan.warnings).toHaveLength(2);
    expect(plan.warnings[0]).toContain("Row 2");
    expect(plan.warnings[1]).toContain("Row 3");
  });
});
