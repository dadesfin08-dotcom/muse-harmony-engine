import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBarcodeInput } from "@/lib/barcode-normalization";
import { buildBarcodeUpsertPlan } from "@/lib/barcode-upsert-planner";
import { calculateFinalPrice } from "@/lib/pricing";

const measurementUnitSchema = z.enum(["Kg", "Liter", "Piece", "Pack", "Gram", "Bunch", "Tray", "Box"]);
const productCategorySchema = z.enum([
  "Groceries",
  "Vegetables & Fruits",
  "Meat & Poultry",
  "Bakery & Pastry",
  "Dairy & Eggs",
  "Drinks & Water",
  "Cleaning Supplies",
]);

const vendorInventoryInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/).optional(),
});

const createMasterProductInputSchema = z.object({
  name: z.string().trim().min(1).max(140),
  nameFr: z.string().trim().min(1).max(140),
  nameAr: z.string().trim().min(1).max(140),
  productVariants: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  brandId: z.string().uuid().nullable(),
  categoryId: z.string().uuid(),
  measurementValue: z.number().positive().max(10_000).nullable(),
  measurementUnit: measurementUnitSchema,
  popularityScore: z.number().int().min(0).max(1_000_000),
  imageUrl: z.string().url().max(2000).nullable(),
});

const uploadMasterProductImageInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  dataUrl: z.string().trim().min(1),
});

const createDbError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    if (error.message.startsWith("DB Error:")) {
      return error;
    }
    return new Error(`DB Error: ${error.message}`);
  }

  return new Error(`DB Error: ${fallback}`);
};

const updateMasterProductInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140),
  nameFr: z.string().trim().min(1).max(140),
  nameAr: z.string().trim().min(1).max(140),
  productVariants: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  brandId: z.string().uuid().nullable(),
  categoryId: z.string().uuid(),
  measurementValue: z.number().positive().max(10_000).nullable(),
  measurementUnit: measurementUnitSchema,
  popularityScore: z.number().int().min(0).max(1_000_000),
  imageUrl: z.string().url().max(2000).nullable(),
});

const archiveMasterProductInputSchema = z.object({
  id: z.string().uuid(),
});

const customerCatalogInputSchema = z.object({
  neighborhoodId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(24).default(12),
});

const customerProductDetailInputSchema = z.object({
  productId: z.string().uuid(),
  neighborhoodId: z.string().uuid().nullable().optional(),
});

const brandSuggestionsInputSchema = z.object({
  productId: z.string().uuid(),
  neighborhoodId: z.string().uuid(),
  brandId: z.string().uuid(),
});

const createBrandInputSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120).nullable(),
  nameFr: z.string().trim().max(120).nullable(),
  logoUrl: z.string().url().max(2000).nullable(),
});

const bulkImportBrandsInputSchema = z.object({
  rows: z
    .array(
      z.object({
        nameEn: z.string().trim().min(1).max(120),
        nameAr: z.string().trim().max(120).nullable(),
        nameFr: z.string().trim().max(120).nullable(),
        logoUrl: z.string().url().max(2000).nullable(),
      }),
    )
    .min(1)
    .max(5000),
});

const bulkImportMasterProductsInputSchema = z.object({
  rows: z
    .array(
      z.object({
        imageUrl: z.string().trim().max(2000).nullable(),
        nameEn: z.string().trim().min(1).max(140),
        nameFr: z.string().trim().max(140).nullable(),
        nameAr: z.string().trim().max(140).nullable(),
        category: z.string().trim().min(1).max(140),
        brand: z.string().trim().max(140).nullable(),
        productVariants: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
        measurementValue: z.string().trim().max(40).nullable(),
        measurementUnit: z.string().trim().min(1).max(30),
        barcode: z.string().trim().max(120).nullable(),
      }),
    )
    .min(1)
    .max(5000),
});

const uploadBrandLogoInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  dataUrl: z.string().trim().min(1),
});

const upsertVendorProductInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/).optional(),
  masterProductId: z.string().uuid(),
  vendorPrice: z.number().min(0),
  isAvailable: z.boolean(),
});

const updateVendorFlashSaleInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/).optional(),
  masterProductId: z.string().uuid(),
  enabled: z.boolean(),
  flashSalePrice: z.number().positive().nullable(),
  flashSaleEndTime: z.string().datetime().nullable(),
});

const activeFlashDealsInputSchema = z.object({
  neighborhoodId: z.string().uuid(),
});

const customerSearchInputSchema = z.object({
  neighborhoodId: z.string().uuid(),
  query: z.string().trim().min(1).max(80),
  limit: z.number().int().min(1).max(6).default(6),
});

type MasterProductRow = {
  id: string;
  product_name: string;
  name_fr: string | null;
  name_ar: string | null;
  product_variants: string[] | null;
  barcode: string | null;
  brand_id: string | null;
  brands: {
    id: string;
    name_en: string;
    name_fr: string | null;
    name_ar: string | null;
    logo_url: string | null;
  } | null;
  category_id: string | null;
  category: ProductCategory;
  measurement_value: number | null;
  measurement_unit: MeasurementUnit;
  image_url: string | null;
  popularity_score: number;
  is_active: boolean;
  created_at: string;
};

type MasterProductExportRow = {
  id: string;
  product_name: string;
  name_fr: string | null;
  name_ar: string | null;
  image_url: string | null;
  barcode: string | null;
  product_variants: string[];
  measurement_value: number | null;
  measurement_unit: MeasurementUnit;
  category_name: string | null;
  brand_name: string | null;
};

type VendorProductRow = {
  id: string;
  master_product_id: string;
  vendor_price: number;
  is_available: boolean;
  is_flash_sale: boolean;
  flash_sale_price: number | null;
  flash_sale_end_time: string | null;
};

type BrandRow = {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
  logo_url: string | null;
  created_at: string;
};

type VendorRow = {
  id: string;
  store_name: string;
  vendor_type: "general" | "specialized";
  assigned_categories: string[];
};

type VendorType = "general" | "specialized";

async function getNeighborhoodVendorIds(neighborhoodId: string) {
  const { data: zoneRows, error: zonesError } = await (supabaseAdmin as any)
    .from("vendor_service_zones")
    .select("vendor_id")
    .eq("neighborhood_id", neighborhoodId);

  if (zonesError) {
    throw new Error(zonesError.message);
  }

  const mappedVendorIds = ((zoneRows ?? []) as Array<{ vendor_id: string | null }>)
    .map((row) => row.vendor_id)
    .filter((value): value is string => Boolean(value));

  if (mappedVendorIds.length > 0) {
    return Array.from(new Set(mappedVendorIds));
  }

  const { data: neighborhood, error: neighborhoodError } = await (supabaseAdmin as any)
    .from("neighborhoods")
    .select("vendor_id")
    .eq("id", neighborhoodId)
    .maybeSingle();

  if (neighborhoodError) {
    throw new Error(neighborhoodError.message);
  }

  const fallbackVendorId = (neighborhood as { vendor_id?: string | null } | null)?.vendor_id ?? null;
  return fallbackVendorId ? [fallbackVendorId] : [];
}

export const listMasterProducts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("master_products")
      .select(
        "id, product_name, name_fr, name_ar, product_variants, barcode, brand_id, category_id, category, measurement_value, measurement_unit, image_url, popularity_score, is_active, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const masterProducts = (data ?? []) as Array<Omit<MasterProductRow, "brands">>;

    const brandIds = Array.from(
      new Set(masterProducts.map((row) => row.brand_id).filter((value): value is string => Boolean(value))),
    );

    const brandsById = new Map<string, MasterProductRow["brands"]>();

    if (brandIds.length > 0) {
      const { data: brands, error: brandsError } = await (supabaseAdmin as any)
        .from("brands")
        .select("id, name_en, name_fr, name_ar, logo_url")
        .in("id", brandIds);

      if (brandsError) {
        throw new Error(brandsError.message);
      }

      for (const brand of (brands ?? []) as NonNullable<MasterProductRow["brands"]>[]) {
        brandsById.set(brand.id, brand);
      }
    }

    return masterProducts.map((row) => ({
      ...row,
      brands: row.brand_id ? (brandsById.get(row.brand_id) ?? null) : null,
    })) as MasterProductRow[];
  } catch (error) {
    console.error("listMasterProducts failed:", error);
    throw new Error("Failed to load master products.");
  }
});

export const listMasterProductsForExport = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("master_products")
      .select("id, product_name, name_fr, name_ar, image_url, barcode, product_variants, measurement_value, measurement_unit, category, category_id, brand_id")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const products = (data ?? []) as Array<{
      id: string;
      product_name: string;
      name_fr: string | null;
      name_ar: string | null;
      image_url: string | null;
      barcode: string | null;
      product_variants: string[] | null;
      measurement_value: number | null;
      measurement_unit: MeasurementUnit;
      category: ProductCategory | null;
      category_id: string | null;
      brand_id: string | null;
    }>;

    const categoryIds = Array.from(new Set(products.map((row) => row.category_id).filter((value): value is string => Boolean(value))));
    const brandIds = Array.from(new Set(products.map((row) => row.brand_id).filter((value): value is string => Boolean(value))));

    const [categoriesResult, brandsResult] = await Promise.all([
      categoryIds.length > 0
        ? (supabaseAdmin as any).from("categories").select("id, name_en").in("id", categoryIds)
        : Promise.resolve({ data: [], error: null }),
      brandIds.length > 0
        ? (supabaseAdmin as any).from("brands").select("id, name_en").in("id", brandIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (categoriesResult.error) {
      throw new Error(categoriesResult.error.message);
    }

    if (brandsResult.error) {
      throw new Error(brandsResult.error.message);
    }

    const categoriesById = new Map<string, string>();
    for (const category of (categoriesResult.data ?? []) as Array<{ id: string; name_en: string }>) {
      categoriesById.set(category.id, category.name_en);
    }

    const brandsById = new Map<string, string>();
    for (const brand of (brandsResult.data ?? []) as Array<{ id: string; name_en: string }>) {
      brandsById.set(brand.id, brand.name_en);
    }

    return products.map((row) => ({
      id: row.id,
      product_name: row.product_name,
      name_fr: row.name_fr,
      name_ar: row.name_ar,
      image_url: row.image_url,
      barcode: row.barcode,
      product_variants: Array.isArray(row.product_variants) ? row.product_variants : [],
      measurement_value: row.measurement_value,
      measurement_unit: row.measurement_unit,
      category_name: (row.category_id ? categoriesById.get(row.category_id) : null) ?? row.category ?? null,
      brand_name: row.brand_id ? (brandsById.get(row.brand_id) ?? null) : null,
    })) as MasterProductExportRow[];
  } catch (error) {
    console.error("listMasterProductsForExport failed:", error);
    throw new Error("Failed to export master products.");
  }
});

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("brands")
      .select("id, name_en, name_fr, name_ar, logo_url, created_at")
      .order("name_en", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as BrandRow[];
  } catch (error) {
    console.error("listBrands failed:", error);
    throw new Error("Failed to load brands.");
  }
});

export const createBrand = createServerFn({ method: "POST" })
  .inputValidator((input) => createBrandInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("brands")
        .insert({
          name_en: data.nameEn,
          name_ar: data.nameAr,
          name_fr: data.nameFr,
          logo_url: data.logoUrl,
        })
        .select("id, name_en, name_fr, name_ar, logo_url, created_at")
        .single();

      if (error || !inserted?.id) {
        throw createDbError(error ?? new Error("Brand insert failed."), "Brand insert failed.");
      }

      return inserted as BrandRow;
    } catch (error) {
      console.error("createBrand failed:", error);
      throw createDbError(error, "Failed to create brand.");
    }
  });

export const importBrandsBulk = createServerFn({ method: "POST" })
  .inputValidator((input) => bulkImportBrandsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const normalizedRows = data.rows
        .map((row) => ({
          nameEn: row.nameEn.trim(),
          nameFr: row.nameFr?.trim() ? row.nameFr.trim() : null,
          nameAr: row.nameAr?.trim() ? row.nameAr.trim() : null,
          logoUrl: row.logoUrl?.trim() ? row.logoUrl.trim() : null,
        }))
        .filter((row) => row.nameEn.length > 0);

      if (normalizedRows.length === 0) {
        throw new Error("No valid brand rows found in the uploaded CSV.");
      }

      const rowsByName = new Map<string, (typeof normalizedRows)[number]>();
      for (const row of normalizedRows) {
        rowsByName.set(row.nameEn.toLowerCase(), row);
      }

      const uniqueRows = Array.from(rowsByName.values());
      const uniqueNames = uniqueRows.map((row) => row.nameEn);

      const { data: existingBrands, error: existingBrandsError } = await (supabaseAdmin as any)
        .from("brands")
        .select("id, name_en")
        .in("name_en", uniqueNames);

      if (existingBrandsError) {
        throw new Error(existingBrandsError.message);
      }

      const existingByName = new Map<string, { id: string; name_en: string }>();
      for (const row of (existingBrands ?? []) as Array<{ id: string; name_en: string }>) {
        existingByName.set(row.name_en.toLowerCase(), row);
      }

      const updates = uniqueRows.filter((row) => existingByName.has(row.nameEn.toLowerCase()));
      const inserts = uniqueRows.filter((row) => !existingByName.has(row.nameEn.toLowerCase()));

      let updatedCount = 0;
      for (const row of updates) {
        const existing = existingByName.get(row.nameEn.toLowerCase());
        if (!existing?.id) continue;

        const { error } = await (supabaseAdmin as any)
          .from("brands")
          .update({
            name_en: row.nameEn,
            name_fr: row.nameFr,
            name_ar: row.nameAr,
            logo_url: row.logoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          throw new Error(error.message);
        }

        updatedCount += 1;
      }

      if (inserts.length > 0) {
        const { error: insertError } = await (supabaseAdmin as any).from("brands").insert(
          inserts.map((row) => ({
            name_en: row.nameEn,
            name_fr: row.nameFr,
            name_ar: row.nameAr,
            logo_url: row.logoUrl,
          })),
        );

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      return {
        ok: true,
        insertedCount: inserts.length,
        updatedCount,
        totalProcessed: uniqueRows.length,
      };
    } catch (error) {
      console.error("importBrandsBulk failed:", error);
      throw createDbError(error, "Failed to bulk import brands.");
    }
  });

export const importMasterProductsBulk = createServerFn({ method: "POST" })
  .inputValidator((input) => bulkImportMasterProductsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const normalizedRows = data.rows
        .map((row, index) => ({
          rowNumber: index + 2,
          imageUrl: row.imageUrl?.trim() ? row.imageUrl.trim() : null,
          nameEn: row.nameEn.trim(),
          nameFr: row.nameFr?.trim() ? row.nameFr.trim() : null,
          nameAr: row.nameAr?.trim() ? row.nameAr.trim() : null,
          categoryLabel: row.category.trim(),
          brandLabel: row.brand?.trim() ? row.brand.trim() : null,
          productVariants: Array.from(
            new Set(row.productVariants.map((variant) => variant.trim()).filter((variant) => variant.length > 0)),
          ),
          measurementValueRaw: row.measurementValue?.trim() ? row.measurementValue.trim() : null,
          measurementUnitRaw: row.measurementUnit.trim(),
          barcode: row.barcode?.trim() ? row.barcode.trim() : null,
        }))
        .filter((row) => row.nameEn.length > 0);

      if (normalizedRows.length === 0) {
        throw new Error("No valid master product rows found in the uploaded file.");
      }

      const warnings: string[] = [];
      const missingCategoryRows: Array<{ rowNumber: number; category: string }> = [];
      const missingBrandRows: Array<{ rowNumber: number; brand: string }> = [];

      const [{ data: categories, error: categoriesError }, { data: brands, error: brandsError }, { data: existingProducts, error: existingProductsError }] =
        await Promise.all([
          (supabaseAdmin as any).from("categories").select("id, name_en, name_fr, name_ar"),
          (supabaseAdmin as any).from("brands").select("id, name_en, name_fr, name_ar"),
          (supabaseAdmin as any).from("master_products").select("id, product_name, barcode, image_url, is_active"),
        ]);

      if (categoriesError) {
        throw new Error(categoriesError.message);
      }

      if (brandsError) {
        throw new Error(brandsError.message);
      }

      if (existingProductsError) {
        throw new Error(existingProductsError.message);
      }

      const normalizeLookupKey = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
      const barcodeUpsertPlan = buildBarcodeUpsertPlan({
        rows: normalizedRows,
        existingRecords: (existingProducts ?? []) as Array<{ id: string; barcode: string | null }>,
      });
      warnings.push(...barcodeUpsertPlan.warnings);
      const uniqueRows = barcodeUpsertPlan.uniqueRows;

      if (uniqueRows.length === 0) {
        return {
          ok: true,
          totalProcessed: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: warnings.length,
          warnings,
        };
      }

      const categoriesByLabel = new Map<string, { id: string; name_en: string }>();
      for (const category of (categories ?? []) as Array<{ id: string; name_en: string; name_fr: string | null; name_ar: string | null }>) {
        for (const label of [category.name_en, category.name_fr, category.name_ar]) {
          const key = normalizeLookupKey(label);
          if (key && !categoriesByLabel.has(key)) {
            categoriesByLabel.set(key, { id: category.id, name_en: category.name_en });
          }
        }
      }

      const brandsByLabel = new Map<string, { id: string }>();
      for (const brand of (brands ?? []) as Array<{ id: string; name_en: string; name_fr: string | null; name_ar: string | null }>) {
        for (const label of [brand.name_en, brand.name_fr, brand.name_ar]) {
          const key = normalizeLookupKey(label);
          if (key && !brandsByLabel.has(key)) {
            brandsByLabel.set(key, { id: brand.id });
          }
        }
      }

      const productsByBarcode = new Map<string, { id: string; image_url: string | null; is_active: boolean }>();
      for (const product of (existingProducts ?? []) as Array<{ id: string; product_name: string; barcode: string | null; image_url: string | null; is_active: boolean }>) {
        const normalizedBarcode = normalizeBarcodeInput(product.barcode);
        if (normalizedBarcode && !productsByBarcode.has(normalizedBarcode)) {
          productsByBarcode.set(normalizedBarcode, {
            id: product.id,
            image_url: product.image_url,
            is_active: Boolean(product.is_active),
          });
        }
      }
      let insertedCount = 0;
      let updatedCount = 0;

      for (const row of uniqueRows) {
        const matchedCategory = categoriesByLabel.get(normalizeLookupKey(row.categoryLabel));
        if (!matchedCategory) {
          warnings.push(`Row ${row.rowNumber}: category '${row.categoryLabel}' not found.`);
          missingCategoryRows.push({
            rowNumber: row.rowNumber,
            category: row.categoryLabel,
          });
          continue;
        }

        const parsedCategory = productCategorySchema.safeParse(matchedCategory.name_en);
        if (!parsedCategory.success) {
          warnings.push(`Row ${row.rowNumber}: category '${matchedCategory.name_en}' is not supported.`);
          continue;
        }

        let matchedBrandId: string | null = null;
        if (row.brandLabel) {
          const matchedBrand = brandsByLabel.get(normalizeLookupKey(row.brandLabel));
          if (!matchedBrand) {
            warnings.push(`Row ${row.rowNumber}: brand '${row.brandLabel}' not found.`);
            missingBrandRows.push({
              rowNumber: row.rowNumber,
              brand: row.brandLabel,
            });
            continue;
          }
          matchedBrandId = matchedBrand.id;
        }

        const parsedMeasurementUnit = measurementUnitSchema.safeParse(row.measurementUnitRaw);
        if (!parsedMeasurementUnit.success) {
          warnings.push(`Row ${row.rowNumber}: measurement unit '${row.measurementUnitRaw}' is invalid.`);
          continue;
        }

        let parsedMeasurementValue: number | null = null;
        if (row.measurementValueRaw) {
          const numericValue = Number(row.measurementValueRaw.replace(",", "."));
          if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 10_000) {
            warnings.push(`Row ${row.rowNumber}: measurement value '${row.measurementValueRaw}' is invalid.`);
            continue;
          }
          parsedMeasurementValue = numericValue;
        }

        if (row.imageUrl) {
          const imageUrlValidation = z.string().url().safeParse(row.imageUrl);
          if (!imageUrlValidation.success) {
            warnings.push(`Row ${row.rowNumber}: image URL is invalid.`);
            continue;
          }
        }

        const normalizedBarcode = normalizeBarcodeInput(row.barcode);
        if (!normalizedBarcode) {
          warnings.push(`Row ${row.rowNumber}: barcode is required for duplicate-safe import.`);
          continue;
        }
        const existingProduct = productsByBarcode.get(normalizedBarcode) ?? null;

        const payload = {
          product_name: row.nameEn,
          name_fr: row.nameFr,
          name_ar: row.nameAr,
          category_id: matchedCategory.id,
          category: parsedCategory.data,
          brand_id: matchedBrandId,
          product_variants: row.productVariants,
          measurement_value: parsedMeasurementValue,
          measurement_unit: parsedMeasurementUnit.data,
          image_url: row.imageUrl,
          barcode: row.barcode,
          is_active: existingProduct?.is_active ?? true,
          updated_at: new Date().toISOString(),
        };

        if (existingProduct?.id) {
          const updatePayload = {
            ...payload,
            image_url: row.imageUrl ?? existingProduct.image_url,
          };

          const { error: updateError } = await (supabaseAdmin as any)
            .from("master_products")
            .update(updatePayload)
            .eq("id", existingProduct.id);

          if (updateError) {
            warnings.push(`Row ${row.rowNumber}: failed to update (${updateError.message}).`);
            continue;
          }

          updatedCount += 1;
          productsByBarcode.set(normalizedBarcode, {
            id: existingProduct.id,
            image_url: row.imageUrl ?? existingProduct.image_url,
            is_active: existingProduct.is_active,
          });
          continue;
        }

        const { data: inserted, error: insertError } = await (supabaseAdmin as any)
          .from("master_products")
          .insert(payload)
          .select("id")
          .single();

        if (insertError || !inserted?.id) {
          warnings.push(`Row ${row.rowNumber}: failed to insert (${insertError?.message ?? "unknown error"}).`);
          continue;
        }

        insertedCount += 1;
        productsByBarcode.set(normalizedBarcode, { id: inserted.id, image_url: row.imageUrl, is_active: true });
      }

      return {
        ok: true,
        totalProcessed: uniqueRows.length,
        insertedCount,
        updatedCount,
        skippedCount: warnings.length,
        warnings,
        missingCategoryRows,
        missingBrandRows,
      };
    } catch (error) {
      console.error("importMasterProductsBulk failed:", error);
      throw createDbError(error, "Failed to bulk import master products.");
    }
  });

export const updateBrand = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), ...createBrandInputSchema.shape }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: updated, error } = await (supabaseAdmin as any)
        .from("brands")
        .update({
          name_en: data.nameEn,
          name_ar: data.nameAr,
          name_fr: data.nameFr,
          logo_url: data.logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select("id, name_en, name_fr, name_ar, logo_url, created_at")
        .single();

      if (error || !updated?.id) {
        throw createDbError(error ?? new Error("Brand update failed."), "Brand update failed.");
      }

      return updated as BrandRow;
    } catch (error) {
      console.error("updateBrand failed:", error);
      throw createDbError(error, "Failed to update brand.");
    }
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any).from("brands").delete().eq("id", data.id);
      if (error) {
        throw new Error(error.message);
      }
      return { ok: true };
    } catch (error) {
      console.error("deleteBrand failed:", error);
      throw new Error("Failed to delete brand.");
    }
  });

export const uploadBrandLogo = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadBrandLogoInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      if (!data.contentType.startsWith("image/")) {
        throw new Error("Only image uploads are allowed.");
      }

      const commaIndex = data.dataUrl.indexOf(",");
      if (commaIndex === -1) {
        throw new Error("Invalid image payload.");
      }

      const base64Payload = data.dataUrl.slice(commaIndex + 1);
      const bytes = Uint8Array.from(Buffer.from(base64Payload, "base64"));
      const extensionFromName = data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeBaseName = data.fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 60);
      const generatedFileName = `${crypto.randomUUID()}-${safeBaseName || "brand"}.${extensionFromName}`;
      const path = `brands/${generatedFileName}`;

      const { data: uploadData, error: uploadError } = await (supabaseAdmin as any).storage
        .from("products")
        .upload(path, bytes, {
          contentType: data.contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError || !uploadData?.path) {
        throw new Error(uploadError?.message ?? "Image upload failed.");
      }

      const { data: publicUrlData } = (supabaseAdmin as any).storage.from("products").getPublicUrl(uploadData.path);

      return {
        path: uploadData.path,
        publicUrl: publicUrlData.publicUrl,
      };
    } catch (error) {
      console.error("uploadBrandLogo failed:", error);
      throw createDbError(error, "Failed to upload brand logo.");
    }
  });

export const createMasterProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => createMasterProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: categoryRow, error: categoryError } = await (supabaseAdmin as any)
        .from("categories")
        .select("name_en")
        .eq("id", data.categoryId)
        .maybeSingle();

      if (categoryError || !categoryRow?.name_en) {
        throw createDbError(categoryError ?? new Error("Invalid category selected."), "Invalid category selected.");
      }

      const parsedCategory = productCategorySchema.safeParse(categoryRow.name_en);
      if (!parsedCategory.success) {
        throw new Error(`Selected category '${categoryRow.name_en}' is not supported by master_products.category enum.`);
      }

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("master_products")
        .insert({
          product_name: data.name,
          name_fr: data.nameFr,
          name_ar: data.nameAr,
          product_variants: data.productVariants,
          brand_id: data.brandId,
          category_id: data.categoryId,
          category: parsedCategory.data,
          measurement_value: data.measurementValue,
          measurement_unit: data.measurementUnit,
          popularity_score: data.popularityScore,
          image_url: data.imageUrl,
          is_active: true,
        })
        .select(
          "id, product_name, name_fr, name_ar, product_variants, brand_id, brands:brand_id(id, name_en, name_fr, name_ar, logo_url), category_id, category, measurement_value, measurement_unit, image_url, popularity_score, is_active, created_at",
        )
        .single();

      if (error || !inserted?.id) {
        throw createDbError(error ?? new Error("Master product insert failed."), "Master product insert failed.");
      }

      return inserted as MasterProductRow;
    } catch (error) {
      console.error("createMasterProduct failed:", error);
      throw createDbError(error, "Failed to save master product.");
    }
  });

export const uploadMasterProductImage = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadMasterProductImageInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      if (!data.contentType.startsWith("image/")) {
        throw new Error("Only image uploads are allowed.");
      }

      const commaIndex = data.dataUrl.indexOf(",");
      if (commaIndex === -1) {
        throw new Error("Invalid image payload.");
      }

      const base64Payload = data.dataUrl.slice(commaIndex + 1);
      const bytes = Uint8Array.from(Buffer.from(base64Payload, "base64"));

      const extensionFromName = data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeBaseName = data.fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 60);
      const generatedFileName = `${crypto.randomUUID()}-${safeBaseName || "product"}.${extensionFromName}`;
      const path = `master-products/${generatedFileName}`;

      const { data: uploadData, error: uploadError } = await (supabaseAdmin as any).storage
        .from("products")
        .upload(path, bytes, {
          contentType: data.contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError || !uploadData?.path) {
        throw new Error(uploadError?.message ?? "Image upload failed.");
      }

      const { data: publicUrlData } = (supabaseAdmin as any).storage.from("products").getPublicUrl(uploadData.path);

      return {
        path: uploadData.path,
        publicUrl: publicUrlData.publicUrl,
      };
    } catch (error) {
      console.error("uploadMasterProductImage failed:", error);
      throw createDbError(error, "Failed to upload product image.");
    }
  });

export const updateMasterProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => updateMasterProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: categoryRow, error: categoryError } = await (supabaseAdmin as any)
        .from("categories")
        .select("name_en")
        .eq("id", data.categoryId)
        .maybeSingle();

      if (categoryError || !categoryRow?.name_en) {
        throw createDbError(categoryError ?? new Error("Invalid category selected."), "Invalid category selected.");
      }

      const parsedCategory = productCategorySchema.safeParse(categoryRow.name_en);
      if (!parsedCategory.success) {
        throw new Error(`Selected category '${categoryRow.name_en}' is not supported by master_products.category enum.`);
      }

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("master_products")
        .update({
          product_name: data.name,
          name_fr: data.nameFr,
          name_ar: data.nameAr,
          product_variants: data.productVariants,
          brand_id: data.brandId,
          category_id: data.categoryId,
          category: parsedCategory.data,
          measurement_value: data.measurementValue,
          measurement_unit: data.measurementUnit,
          popularity_score: data.popularityScore,
          image_url: data.imageUrl,
        })
        .eq("id", data.id)
        .select(
          "id, product_name, name_fr, name_ar, product_variants, brand_id, brands:brand_id(id, name_en, name_fr, name_ar, logo_url), category_id, category, measurement_value, measurement_unit, image_url, popularity_score, is_active, created_at",
        )
        .single();

      if (error || !updated?.id) {
        throw createDbError(error ?? new Error("Master product update failed."), "Master product update failed.");
      }

      return updated as MasterProductRow;
    } catch (error) {
      console.error("updateMasterProduct failed:", error);
      throw createDbError(error, "Failed to update master product.");
    }
  });

export const archiveMasterProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => archiveMasterProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any)
        .from("master_products")
        .update({ is_active: false })
        .eq("id", data.id)
        .eq("is_active", true);

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("archiveMasterProduct failed:", error);
      throw new Error("Failed to archive master product.");
    }
  });

function getCurrentVendorQuery(phoneNumber?: string) {
  const query = (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, vendor_type, assigned_categories")
    .eq("is_active", true);

  if (phoneNumber) {
    query.eq("phone_number", phoneNumber);
  }

  return query.order("created_at", { ascending: true }).limit(1).single();
}

export const getVendorInventoryData = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorInventoryInputSchema.parse(input))
  .handler(async ({ data }) => {
  try {
    const { data: vendor, error: vendorError } = await getCurrentVendorQuery(data.phoneNumber);
    const resolvedVendorType: VendorType = (vendor?.vendor_type as VendorType | undefined) ?? "general";
    const resolvedAssignedCategories =
      resolvedVendorType === "specialized" ? ((vendor?.assigned_categories ?? []) as string[]) : [];

    if (vendorError || !vendor?.id) {
      return {
        vendor: null,
        products: [] as Array<{
          id: string;
          name: string;
          category: ProductCategory;
          measurementUnit: MeasurementUnit;
          vendorProductId: string | null;
          vendorPrice: number;
          isAvailable: boolean;
        }>,
      };
    }

    if (resolvedVendorType === "specialized" && resolvedAssignedCategories.length === 0) {
      return {
        vendor: vendor as VendorRow,
        products: [] as Array<{
          id: string;
          name: string;
          category: ProductCategory;
          measurementUnit: MeasurementUnit;
          vendorProductId: string | null;
          vendorPrice: number;
          isAvailable: boolean;
        }>,
      };
    }

    const masterProductsQuery = (supabaseAdmin as any)
      .from("master_products")
      .select(
        "id, product_name, name_fr, name_ar, brand_id, brands:brand_id(id, name_en, name_fr, name_ar, logo_url), category_id, category, measurement_value, measurement_unit, image_url, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (resolvedVendorType === "specialized") {
      masterProductsQuery.in("category", resolvedAssignedCategories);
    }

    const [{ data: masterProducts, error: masterError }, { data: vendorProducts, error: vendorProductsError }] =
      await Promise.all([
        masterProductsQuery,
        (supabaseAdmin as any)
          .from("vendor_products")
          .select("id, master_product_id, vendor_price, is_available, is_flash_sale, flash_sale_price, flash_sale_end_time")
          .eq("vendor_id", vendor.id),
      ]);

    if (masterError) {
      throw new Error(masterError.message);
    }

    if (vendorProductsError) {
      throw new Error(vendorProductsError.message);
    }

    const vendorMap = new Map<string, VendorProductRow>(
      ((vendorProducts ?? []) as VendorProductRow[]).map((row) => [row.master_product_id, row]),
    );

    return {
      vendor: vendor as VendorRow,
      products: ((masterProducts ?? []) as MasterProductRow[]).map((masterProduct) => {
        const linked = vendorMap.get(masterProduct.id);
        return {
          id: masterProduct.id,
          name: masterProduct.product_name,
          nameFr: masterProduct.name_fr,
          nameAr: masterProduct.name_ar,
          brandId: masterProduct.brand_id,
          brand: masterProduct.brands?.name_en ?? null,
          brandNameEn: masterProduct.brands?.name_en ?? null,
          brandNameFr: masterProduct.brands?.name_fr ?? null,
          brandNameAr: masterProduct.brands?.name_ar ?? null,
          brandLogoUrl: masterProduct.brands?.logo_url ?? null,
          categoryId: masterProduct.category_id,
          category: masterProduct.category,
          measurementValue: masterProduct.measurement_value != null ? Number(masterProduct.measurement_value) : null,
          measurementUnit: masterProduct.measurement_unit,
          imageUrl: masterProduct.image_url,
          vendorProductId: linked?.id ?? null,
          vendorPrice: Number(linked?.vendor_price ?? 0),
          isAvailable: linked?.is_available ?? false,
          isFlashSale: linked?.is_flash_sale ?? false,
          flashSalePrice: linked?.flash_sale_price != null ? Number(linked.flash_sale_price) : null,
          flashSaleEndTime: linked?.flash_sale_end_time ?? null,
        };
      }),
    };
  } catch (error) {
    console.error("getVendorInventoryData failed:", error);
    throw new Error("Failed to load vendor inventory.");
  }
});

export const upsertVendorInventoryItem = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertVendorProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: vendor, error: vendorError } = await getCurrentVendorQuery(data.phoneNumber);

      if (vendorError || !vendor?.id) {
        throw new Error("No active vendor available.");
      }

      const { error } = await (supabaseAdmin as any).from("vendor_products").upsert(
        {
          vendor_id: (vendor as VendorRow).id,
          master_product_id: data.masterProductId,
          vendor_price: data.vendorPrice,
          is_available: data.isAvailable,
        },
        {
          onConflict: "vendor_id,master_product_id",
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("upsertVendorInventoryItem failed:", error);
      throw new Error("Failed to save vendor inventory item.");
    }
  });

export const updateVendorFlashSale = createServerFn({ method: "POST" })
  .inputValidator((input) => updateVendorFlashSaleInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: vendor, error: vendorError } = await getCurrentVendorQuery(data.phoneNumber);

      if (vendorError || !vendor?.id) {
        throw new Error("No active vendor available.");
      }

      if (data.enabled) {
        if (data.flashSalePrice == null || data.flashSaleEndTime == null) {
          throw new Error("Flash sale price and end time are required when enabling a flash sale.");
        }

        const endTime = new Date(data.flashSaleEndTime);
        if (Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
          throw new Error("Flash sale end time must be in the future.");
        }
      }

      const { data: existingVendorProduct, error: existingVendorProductError } = await (supabaseAdmin as any)
        .from("vendor_products")
        .select("vendor_price, is_available")
        .eq("vendor_id", (vendor as VendorRow).id)
        .eq("master_product_id", data.masterProductId)
        .maybeSingle();

      if (existingVendorProductError) {
        throw new Error(existingVendorProductError.message);
      }

      if (!data.enabled && !existingVendorProduct) {
        return { ok: true };
      }

      if (data.enabled) {
        const regularPrice = Number(existingVendorProduct?.vendor_price ?? 0);
        const flashPrice = Number(data.flashSalePrice ?? 0);

        if (Number.isNaN(regularPrice) || regularPrice <= 0) {
          throw new Error("Set a valid regular price before enabling a flash sale.");
        }

        if (Number.isNaN(flashPrice) || flashPrice >= regularPrice) {
          throw new Error("Flash sale price must be lower than your regular price.");
        }
      }

      const updatePayload = data.enabled
        ? {
            is_flash_sale: true,
            flash_sale_price: data.flashSalePrice,
            flash_sale_end_time: data.flashSaleEndTime,
            vendor_price: Number(existingVendorProduct?.vendor_price ?? data.flashSalePrice ?? 0),
            is_available: existingVendorProduct?.is_available ?? true,
          }
        : {
            is_flash_sale: false,
            flash_sale_price: null,
            flash_sale_end_time: null,
          };

      const { error } = await (supabaseAdmin as any).from("vendor_products").upsert(
        {
          vendor_id: (vendor as VendorRow).id,
          master_product_id: data.masterProductId,
          ...updatePayload,
        },
        {
          onConflict: "vendor_id,master_product_id",
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("updateVendorFlashSale failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to update flash sale.");
    }
  });

export const listActiveFlashDeals = createServerFn({ method: "POST" })
  .inputValidator((input) => activeFlashDealsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const nowIso = new Date().toISOString();
      const vendorIds = await getNeighborhoodVendorIds(data.neighborhoodId);
      if (vendorIds.length === 0) {
        return [] as Array<{
          id: string;
          name: string;
          nameFr: string | null;
          nameAr: string | null;
          measurementUnit: MeasurementUnit;
          imageUrl: string | null;
          vendorPrice: number;
          flashSalePrice: number;
          flashSaleEndTime: string;
        }>;
      }

      const { data: rows, error } = await (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_id, vendor_price, is_available, is_flash_sale, flash_sale_price, flash_sale_end_time, master_products:master_product_id(id, product_name, name_fr, name_ar, measurement_unit, image_url, is_active)",
        )
        .in("vendor_id", vendorIds)
        .eq("is_available", true)
        .eq("is_flash_sale", true)
        .gt("flash_sale_end_time", nowIso)
        .eq("master_products.is_active", true)
        .order("flash_sale_end_time", { ascending: true })
        .limit(4);

      if (error) {
        throw new Error(error.message);
      }

      const flashDeals = await Promise.all(
        ((rows ?? []) as Array<{
        vendor_id: string;
        vendor_price: number;
        is_available: boolean;
        is_flash_sale: boolean;
        flash_sale_price: number | null;
        flash_sale_end_time: string | null;
        master_products: {
          id: string;
          product_name: string;
          name_fr: string | null;
          name_ar: string | null;
          measurement_unit: "Kg" | "Liter" | "Piece" | "Pack";
          image_url: string | null;
          is_active: boolean;
        } | null;
      }>)
          .filter(
            (row) =>
              row.is_available === true &&
              row.is_flash_sale === true &&
              !!row.master_products &&
              row.flash_sale_price != null &&
              !!row.flash_sale_end_time,
          )
          .map(async (row) => {
            const finalVendorPricing = await calculateFinalPrice(Number(row.vendor_price ?? 0), true);
            const finalFlashPricing = await calculateFinalPrice(Number(row.flash_sale_price!), true);

            return {
              id: row.master_products!.id,
              vendorId: row.vendor_id,
              name: row.master_products!.product_name,
              nameFr: row.master_products!.name_fr,
              nameAr: row.master_products!.name_ar,
              measurementUnit: row.master_products!.measurement_unit,
              imageUrl: row.master_products!.image_url,
              vendorPrice: Number(row.vendor_price ?? 0),
              finalVendorPrice: finalVendorPricing.finalPrice,
              flashSalePrice: Number(row.flash_sale_price!),
              finalFlashSalePrice: finalFlashPricing.finalPrice,
              flashSaleEndTime: row.flash_sale_end_time!,
            };
          }),
      );

      return flashDeals;
    } catch (error) {
      console.error("listActiveFlashDeals failed:", error);
      throw new Error("Failed to load flash deals.");
    }
  });

export const searchCustomerProducts = createServerFn({ method: "POST" })
  .inputValidator((input) => customerSearchInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendorIds = await getNeighborhoodVendorIds(data.neighborhoodId);
      if (vendorIds.length === 0) return [] as Array<any>;

      const normalizedQuery = data.query.trim();
      const escapedLike = normalizedQuery.replace(/[%_]/g, "");
      const ilikePattern = `%${escapedLike}%`;
      const resultLimit = Math.min(data.limit, 6);

      const { data: matchedBrands } = await (supabaseAdmin as any)
        .from("brands")
        .select("id")
        .or(`name_en.ilike.${ilikePattern},name_fr.ilike.${ilikePattern},name_ar.ilike.${ilikePattern}`)
        .limit(24);

      const matchedBrandIds = ((matchedBrands ?? []) as Array<{ id: string }>)
        .map((brand) => brand.id)
        .filter(Boolean);

      const categoryMatches = [
        "Groceries",
        "Vegetables & Fruits",
        "Meat & Poultry",
        "Bakery & Pastry",
        "Dairy & Eggs",
        "Drinks & Water",
        "Cleaning Supplies",
      ].filter((category) => category.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()));

      const orParts = [
        `product_name.ilike.${ilikePattern}`,
        `name_fr.ilike.${ilikePattern}`,
        `name_ar.ilike.${ilikePattern}`,
      ];

      if (matchedBrandIds.length > 0) {
        orParts.push(`brand_id.in.(${matchedBrandIds.join(",")})`);
      }

      if (categoryMatches.length > 0) {
        for (const category of categoryMatches) {
          orParts.push(`category.eq.${category}`);
        }
      }

      const { data: rows, error } = await (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_id, vendor_price, master_products:master_product_id(id, product_name, name_fr, name_ar, category, image_url, brands:brand_id(name_en, name_fr, name_ar))",
        )
        .in("vendor_id", vendorIds)
        .eq("is_available", true)
        .eq("master_products.is_active", true)
        .or(orParts.join(","), { foreignTable: "master_products" })
        .order("popularity_score", { foreignTable: "master_products", ascending: false })
        .limit(6);

      if (error) throw new Error(error.message);

      const normalizedNeedle = normalizedQuery.toLocaleLowerCase();

      const pricedResult = await Promise.all(
        ((rows ?? []) as Array<any>)
          .filter((row) => row?.master_products)
          .map(async (row) => {
            const pricing = await calculateFinalPrice(Number(row.vendor_price ?? 0), true);

            return {
              id: row.master_products.id as string,
              name: row.master_products.product_name as string,
              nameFr: (row.master_products.name_fr as string | null) ?? null,
              nameAr: (row.master_products.name_ar as string | null) ?? null,
              category: row.master_products.category as ProductCategory,
              imageUrl: (row.master_products.image_url as string | null) ?? null,
              vendorPrice: Number(row.vendor_price ?? 0),
              finalVendorPrice: pricing.finalPrice,
              brandNameEn: (row.master_products.brands?.name_en as string | null) ?? null,
              brandNameFr: (row.master_products.brands?.name_fr as string | null) ?? null,
              brandNameAr: (row.master_products.brands?.name_ar as string | null) ?? null,
            };
          }),
      );

      const result = pricedResult
        .filter((item) => {
          const searchable = [
            item.name,
            item.nameFr,
            item.nameAr,
            item.brandNameEn,
            item.brandNameFr,
            item.brandNameAr,
            item.category,
          ]
            .filter(Boolean)
            .map((value) => String(value).toLocaleLowerCase());

          return searchable.some((value) => value.includes(normalizedNeedle));
        })
        .slice(0, resultLimit);

      return result;
    } catch (error) {
      console.error("searchCustomerProducts failed:", error);
      throw new Error("Failed to search products.");
    }
  });

export const getCustomerCatalogByNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => customerCatalogInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const nowIso = new Date().toISOString();
      const vendorIds = await getNeighborhoodVendorIds(data.neighborhoodId);
      if (vendorIds.length === 0) {
        return {
          vendor: null,
          items: [] as Array<{
            id: string;
            vendorId: string;
            name: string;
            nameFr: string | null;
            nameAr: string | null;
            category: ProductCategory;
            measurementUnit: MeasurementUnit;
            imageUrl: string | null;
            popularityScore: number;
            vendorPrice: number;
            isAvailable: boolean;
          }>,
          hasMore: false,
        };
      }

      const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
        .from("vendors")
        .select("id, store_name")
        .in("id", vendorIds)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (vendorError || !vendor?.id) {
        return {
          vendor: null,
          items: [] as Array<{
            id: string;
            name: string;
            nameFr: string | null;
            nameAr: string | null;
            category: ProductCategory;
            measurementUnit: MeasurementUnit;
            imageUrl: string | null;
            popularityScore: number;
            vendorPrice: number;
            isAvailable: boolean;
          }>,
          hasMore: false,
        };
      }

      const from = (data.page - 1) * data.pageSize;
      const to = from + data.pageSize;

      const { data: rows, error: rowsError } = await (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_id, vendor_price, is_available, master_products:master_product_id(id, product_name, name_fr, name_ar, product_variants, brand_id, brands:brand_id(id, name_en, name_fr, name_ar, logo_url), category_id, category, measurement_value, measurement_unit, image_url, popularity_score, is_active)",
        )
        .in("vendor_id", vendorIds)
        .eq("is_available", true)
        .or(`is_flash_sale.is.false,is_flash_sale.is.null,and(is_flash_sale.eq.true,flash_sale_end_time.lte.${nowIso})`)
        .eq("master_products.is_active", true)
        .order("popularity_score", { foreignTable: "master_products", ascending: false })
        .order("created_at", { foreignTable: "master_products", ascending: false })
        .range(from, to);

      if (rowsError) {
        throw new Error(rowsError.message);
      }

      const items = await Promise.all(
        ((rows ?? []) as Array<{
          vendor_id: string;
          vendor_price: number;
          is_available: boolean;
          master_products: {
            id: string;
            product_name: string;
            name_fr: string | null;
            name_ar: string | null;
            product_variants: string[] | null;
            brand_id: string | null;
            brands: {
              id: string;
              name_en: string;
              name_fr: string | null;
              name_ar: string | null;
              logo_url: string | null;
            } | null;
            category_id: string | null;
            category: ProductCategory;
            measurement_value: number | null;
            measurement_unit: MeasurementUnit;
            image_url: string | null;
            popularity_score: number;
            is_active: boolean;
          } | null;
        }>)
          .filter((row) => !!row.master_products)
          .slice(0, data.pageSize)
          .map(async (row) => {
            const pricing = await calculateFinalPrice(Number(row.vendor_price ?? 0), true);
            return {
              id: row.master_products!.id,
              vendorId: row.vendor_id,
              name: row.master_products!.product_name,
              nameFr: row.master_products!.name_fr,
              nameAr: row.master_products!.name_ar,
              productVariants: Array.isArray(row.master_products!.product_variants)
                ? row.master_products!.product_variants
                    .map((value) => (typeof value === "string" ? value.trim() : ""))
                    .filter((value) => value.length > 0)
                : [],
              brandId: row.master_products!.brand_id,
              brand: row.master_products!.brands?.name_en ?? null,
              brandNameEn: row.master_products!.brands?.name_en ?? null,
              brandNameFr: row.master_products!.brands?.name_fr ?? null,
              brandNameAr: row.master_products!.brands?.name_ar ?? null,
              brandLogoUrl: row.master_products!.brands?.logo_url ?? null,
              categoryId: row.master_products!.category_id,
              category: row.master_products!.category,
              measurementValue:
                row.master_products!.measurement_value != null
                  ? Number(row.master_products!.measurement_value)
                  : null,
              measurementUnit: row.master_products!.measurement_unit,
              imageUrl: row.master_products!.image_url,
              popularityScore: Number(row.master_products!.popularity_score ?? 0),
              vendorPrice: Number(row.vendor_price ?? 0),
              finalVendorPrice: pricing.finalPrice,
              isAvailable: row.is_available,
            };
          }),
      );

      return {
        vendor: vendor as VendorRow,
        items,
        hasMore: (rows?.length ?? 0) > data.pageSize,
      };
    } catch (error) {
      console.error("getCustomerCatalogByNeighborhood failed:", error);
      throw new Error("Failed to load marketplace products.");
    }
  });

export const getCustomerProductDetail = createServerFn({ method: "POST" })
  .inputValidator((input) => customerProductDetailInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      let vendorIds: string[] | null = null;

      if (data.neighborhoodId) {
        vendorIds = await getNeighborhoodVendorIds(data.neighborhoodId);
        if (vendorIds.length === 0) {
          return null;
        }
      }

      const productQuery = (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_id, vendor_price, is_available, master_products:master_product_id(id, product_name, name_fr, name_ar, product_variants, brand_id, brands:brand_id(id, name_en, name_fr, name_ar, logo_url), category_id, category, measurement_value, measurement_unit, image_url, popularity_score, is_active)",
        )
        .eq("master_product_id", data.productId)
        .eq("is_available", true)
        .eq("master_products.is_active", true)
        .limit(1)
        .maybeSingle();

      if (vendorIds) {
        productQuery.in("vendor_id", vendorIds);
      }

      const { data: row, error } = await productQuery;

      if (error) {
        throw new Error(error.message);
      }

      if (!row?.master_products) {
        return null;
      }

      const pricing = await calculateFinalPrice(Number(row.vendor_price ?? 0), true);

      return {
        id: row.master_products.id,
        vendorId: row.vendor_id,
        name: row.master_products.product_name,
        nameFr: row.master_products.name_fr,
        nameAr: row.master_products.name_ar,
          productVariants: Array.isArray(row.master_products.product_variants)
            ? row.master_products.product_variants
                .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
                .filter((value: string) => value.length > 0)
            : [],
        brandId: row.master_products.brand_id,
        brand: row.master_products.brands?.name_en ?? null,
        brandNameEn: row.master_products.brands?.name_en ?? null,
        brandNameFr: row.master_products.brands?.name_fr ?? null,
        brandNameAr: row.master_products.brands?.name_ar ?? null,
        brandLogoUrl: row.master_products.brands?.logo_url ?? null,
        categoryId: row.master_products.category_id,
        category: row.master_products.category,
        measurementValue:
          row.master_products.measurement_value != null
            ? Number(row.master_products.measurement_value)
            : null,
        measurementUnit: row.master_products.measurement_unit,
        imageUrl: row.master_products.image_url,
        popularityScore: Number(row.master_products.popularity_score ?? 0),
        vendorPrice: Number(row.vendor_price ?? 0),
        finalVendorPrice: pricing.finalPrice,
        isAvailable: row.is_available,
      };
    } catch (error) {
      console.error("getCustomerProductDetail failed:", error);
      throw new Error("Failed to load product details.");
    }
  });

export const getBrandSuggestionsForNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => brandSuggestionsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendorIds = await getNeighborhoodVendorIds(data.neighborhoodId);
      if (vendorIds.length === 0) {
        return [] as Array<{
          id: string;
          vendorId: string;
          name: string;
          nameFr: string | null;
          nameAr: string | null;
          brandId: string | null;
          brand: string | null;
          brandNameEn: string | null;
          brandNameFr: string | null;
          brandNameAr: string | null;
          brandLogoUrl: string | null;
          measurementValue: number | null;
          measurementUnit: MeasurementUnit;
          imageUrl: string | null;
          vendorPrice: number;
          finalVendorPrice: number;
        }>;
      }

      const { data: rows, error } = await (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_id, vendor_price, is_available, master_products:master_product_id(id, product_name, name_fr, name_ar, brand_id, brands:brand_id(id, name_en, name_fr, name_ar, logo_url), measurement_value, measurement_unit, image_url, is_active)",
        )
        .in("vendor_id", vendorIds)
        .eq("is_available", true)
        .eq("master_products.is_active", true)
        .eq("master_products.brand_id", data.brandId)
        .neq("master_product_id", data.productId)
        .order("popularity_score", { foreignTable: "master_products", ascending: false })
        .order("created_at", { foreignTable: "master_products", ascending: false })
        .limit(12);

      if (error) {
        throw new Error(error.message);
      }

      const seen = new Set<string>();
      const uniqueRows = ((rows ?? []) as Array<{
        vendor_id: string;
        vendor_price: number;
        is_available: boolean;
        master_products: {
          id: string;
          product_name: string;
          name_fr: string | null;
          name_ar: string | null;
          brand_id: string | null;
          brands: {
            id: string;
            name_en: string;
            name_fr: string | null;
            name_ar: string | null;
            logo_url: string | null;
          } | null;
          measurement_value: number | null;
          measurement_unit: MeasurementUnit;
          image_url: string | null;
          is_active: boolean;
        } | null;
      }>).filter((row) => {
        if (!row.master_products || seen.has(row.master_products.id)) {
          return false;
        }
        seen.add(row.master_products.id);

        return true;
      });

      return Promise.all(
        uniqueRows.map(async (row) => {
          const pricing = await calculateFinalPrice(Number(row.vendor_price ?? 0), true);

          return {
          id: row.master_products.id,
          vendorId: row.vendor_id,
          name: row.master_products.product_name,
          nameFr: row.master_products.name_fr,
          nameAr: row.master_products.name_ar,
          brandId: row.master_products.brand_id,
          brand: row.master_products.brands?.name_en ?? null,
          brandNameEn: row.master_products.brands?.name_en ?? null,
          brandNameFr: row.master_products.brands?.name_fr ?? null,
          brandNameAr: row.master_products.brands?.name_ar ?? null,
          brandLogoUrl: row.master_products.brands?.logo_url ?? null,
          measurementValue:
            row.master_products.measurement_value != null
              ? Number(row.master_products.measurement_value)
              : null,
          measurementUnit: row.master_products.measurement_unit,
          imageUrl: row.master_products.image_url,
          vendorPrice: Number(row.vendor_price ?? 0),
            finalVendorPrice: pricing.finalPrice,
          };
        }),
      );
    } catch (error) {
      console.error("getBrandSuggestionsForNeighborhood failed:", error);
      throw new Error("Failed to load suggested products.");
    }
  });

export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;
export type ProductCategory = z.infer<typeof productCategorySchema>;