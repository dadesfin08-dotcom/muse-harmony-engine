import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createCommuneInputSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().max(120).nullable().optional(),
  nameAr: z.string().trim().max(120).nullable().optional(),
});

const createNeighborhoodInputSchema = z.object({
  communeId: z.string().uuid(),
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().max(120).nullable().optional(),
  nameAr: z.string().trim().max(120).nullable().optional(),
  deliveryFee: z.coerce.number().min(0).max(100000).default(0),
});

const updateCommuneInputSchema = z.object({
  id: z.string().uuid(),
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().max(120).nullable().optional(),
  nameAr: z.string().trim().max(120).nullable().optional(),
});

const updateNeighborhoodInputSchema = z.object({
  id: z.string().uuid(),
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().max(120).nullable().optional(),
  nameAr: z.string().trim().max(120).nullable().optional(),
  deliveryFee: z.coerce.number().min(0).max(100000).default(0),
});

const getCommuneByIdInputSchema = z.object({
  communeId: z.string().uuid(),
});

const searchCommunesInputSchema = z.object({
  query: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(25).default(15),
});

const searchNeighborhoodsByCommuneInputSchema = z.object({
  communeId: z.string().uuid(),
  query: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const getLocationByNeighborhoodIdInputSchema = z.object({
  neighborhoodId: z.string().uuid(),
});

const deleteNeighborhoodInputSchema = z.object({
  id: z.string().uuid(),
});

const deleteCommuneInputSchema = z.object({
  id: z.string().uuid(),
});

const serviceZoneImportRowSchema = z.object({
  zoneCode: z.string().trim().max(64).nullable().optional(),
  communeEn: z.string().trim().min(1).max(120),
  communeFr: z.string().trim().max(120).nullable().optional(),
  communeAr: z.string().trim().max(120).nullable().optional(),
  douarEn: z.string().trim().min(1).max(120),
  douarFr: z.string().trim().max(120).nullable().optional(),
  douarAr: z.string().trim().max(120).nullable().optional(),
  deliveryFee: z.coerce.number().min(0).max(100000).default(0),
});

const importServiceZonesBulkInputSchema = z.object({
  rows: z.array(serviceZoneImportRowSchema).min(1),
});

type CommuneRow = {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
};

type NeighborhoodRow = {
  id: string;
  zone_code: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
  commune_id: string;
  delivery_fee: number;
  vendor_id: string | null;
};

export type ServiceZoneTree = Array<{
  id: string;
  name: string;
  nameEn: string;
  nameFr: string | null;
  nameAr: string | null;
  neighborhoods: Array<{
    id: string;
    zoneCode: string;
    name: string;
    nameEn: string;
    nameFr: string | null;
    nameAr: string | null;
    communeId: string;
    deliveryFee: number;
    vendorId: string | null;
  }>;
}>;

export type CommuneProfile = {
  id: string;
  name: string;
  nameEn: string;
  nameFr: string | null;
  nameAr: string | null;
  neighborhoods: Array<{
    id: string;
    zoneCode: string;
    name: string;
    nameEn: string;
    nameFr: string | null;
    nameAr: string | null;
    communeId: string;
    deliveryFee: number;
    vendorId: string | null;
  }>;
};

export type ServiceZoneExportRow = {
  zoneCode: string;
  communeEn: string;
  communeFr: string | null;
  communeAr: string | null;
  douarEn: string;
  douarFr: string | null;
  douarAr: string | null;
  deliveryFee: number;
};

export type CommuneSearchResult = {
  id: string;
  name: string;
  nameEn: string;
  nameFr: string | null;
  nameAr: string | null;
};

export type NeighborhoodSearchResult = {
  id: string;
  zoneCode: string;
  communeId: string;
  name: string;
  nameEn: string;
  nameFr: string | null;
  nameAr: string | null;
  deliveryFee: number;
};

const createCommuneLookupKey = (nameEn: string, nameFr: string | null, nameAr: string | null) =>
  `${nameEn.trim().toLowerCase()}|${nameFr?.trim().toLowerCase() ?? ""}|${nameAr?.trim().toLowerCase() ?? ""}`;

const normalizeZoneCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeFuzzyText = (value: string | null | undefined) =>
  (value ?? "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = new Array(b.length + 1).fill(0);
  const current = new Array(b.length + 1).fill(0);

  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
};

const fuzzyScore = (queryRaw: string, labels: Array<string | null | undefined>) => {
  const query = normalizeFuzzyText(queryRaw);
  if (!query) return 0;

  const normalizedLabels = labels.map((label) => normalizeFuzzyText(label)).filter(Boolean);
  if (normalizedLabels.length === 0) return 0;

  let bestScore = 0;
  for (const label of normalizedLabels) {
    if (label.includes(query)) {
      bestScore = Math.max(bestScore, 1);
    }

    const labelTokens = label.split(" ").filter(Boolean);
    const candidates = [label, ...labelTokens];

    for (const candidate of candidates) {
      const maxLen = Math.max(query.length, candidate.length);
      if (maxLen === 0) continue;
      const distance = levenshteinDistance(query, candidate);
      const similarity = 1 - distance / maxLen;
      bestScore = Math.max(bestScore, similarity);
    }
  }

  return bestScore;
};

const extractZoneCodeSequence = (zoneCode: string) => {
  const match = zoneCode.match(/^SZ-(\d+)$/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
};

const generateNextZoneCode = (state: { nextSequence: number; reserved: Set<string> }) => {
  let candidate = `SZ-${String(state.nextSequence).padStart(6, "0")}`;
  while (state.reserved.has(candidate)) {
    state.nextSequence += 1;
    candidate = `SZ-${String(state.nextSequence).padStart(6, "0")}`;
  }
  state.reserved.add(candidate);
  state.nextSequence += 1;
  return candidate;
};

const mapNeighborhoodRow = (neighborhood: NeighborhoodRow) => ({
  id: neighborhood.id,
  zoneCode: neighborhood.zone_code,
  name: neighborhood.name_en,
  nameEn: neighborhood.name_en,
  nameFr: neighborhood.name_fr,
  nameAr: neighborhood.name_ar,
  communeId: neighborhood.commune_id,
  deliveryFee: Number(neighborhood.delivery_fee ?? 0),
  vendorId: neighborhood.vendor_id,
});

export const searchCommunes = createServerFn({ method: "GET" })
  .inputValidator((input) => searchCommunesInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const query = data.query.trim();
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("communes")
        .select("id, name_en, name_fr, name_ar")
        .order("name_en", { ascending: true })
        .limit(500);

      if (error) throw new Error(error.message);

      if (!query) {
        return ((rows ?? []) as CommuneRow[]).slice(0, data.limit).map(
          (commune) =>
            ({
              id: commune.id,
              name: commune.name_en,
              nameEn: commune.name_en,
              nameFr: commune.name_fr,
              nameAr: commune.name_ar,
            }) satisfies CommuneSearchResult,
        );
      }

      return ((rows ?? []) as CommuneRow[])
        .map((commune) => ({
          commune,
          score: fuzzyScore(query, [commune.name_en, commune.name_fr, commune.name_ar]),
        }))
        .filter(({ score }) => score >= 0.45)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.commune.name_en.localeCompare(b.commune.name_en);
        })
        .slice(0, data.limit)
        .map(
          ({ commune }) =>
            ({
              id: commune.id,
              name: commune.name_en,
              nameEn: commune.name_en,
              nameFr: commune.name_fr,
              nameAr: commune.name_ar,
            }) satisfies CommuneSearchResult,
        );
    } catch (error) {
      console.error("searchCommunes failed:", error);
      throw new Error("Failed to search communes.");
    }
  });

export const searchNeighborhoodsByCommune = createServerFn({ method: "GET" })
  .inputValidator((input) => searchNeighborhoodsByCommuneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const query = data.query.trim();
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee")
        .eq("commune_id", data.communeId)
        .order("name_en", { ascending: true })
        .limit(800);

      if (error) throw new Error(error.message);

      if (!query) {
        return ((rows ?? []) as NeighborhoodRow[]).slice(0, data.limit).map(
          (row) =>
            ({
              id: row.id,
              zoneCode: row.zone_code,
              communeId: row.commune_id,
              name: row.name_en,
              nameEn: row.name_en,
              nameFr: row.name_fr,
              nameAr: row.name_ar,
              deliveryFee: Number(row.delivery_fee ?? 0),
            }) satisfies NeighborhoodSearchResult,
        );
      }

      return ((rows ?? []) as NeighborhoodRow[])
        .map((row) => ({
          row,
          score: fuzzyScore(query, [row.name_en, row.name_fr, row.name_ar]),
        }))
        .filter(({ score }) => score >= 0.45)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.row.name_en.localeCompare(b.row.name_en);
        })
        .slice(0, data.limit)
        .map(
          ({ row }) =>
            ({
              id: row.id,
              zoneCode: row.zone_code,
              communeId: row.commune_id,
              name: row.name_en,
              nameEn: row.name_en,
              nameFr: row.name_fr,
              nameAr: row.name_ar,
              deliveryFee: Number(row.delivery_fee ?? 0),
            }) satisfies NeighborhoodSearchResult,
        );
    } catch (error) {
      console.error("searchNeighborhoodsByCommune failed:", error);
      throw new Error("Failed to search neighborhoods.");
    }
  });

export const getLocationByNeighborhoodId = createServerFn({ method: "GET" })
  .inputValidator((input) => getLocationByNeighborhoodIdInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: neighborhood, error: neighborhoodError } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee")
        .eq("id", data.neighborhoodId)
        .maybeSingle();

      if (neighborhoodError) throw new Error(neighborhoodError.message);
      if (!neighborhood?.id) return null;

      const { data: commune, error: communeError } = await (supabaseAdmin as any)
        .from("communes")
        .select("id, name_en, name_fr, name_ar")
        .eq("id", (neighborhood as NeighborhoodRow).commune_id)
        .maybeSingle();

      if (communeError) throw new Error(communeError.message);
      if (!commune?.id) return null;

      return {
        commune: {
          id: (commune as CommuneRow).id,
          name: (commune as CommuneRow).name_en,
          nameEn: (commune as CommuneRow).name_en,
          nameFr: (commune as CommuneRow).name_fr,
          nameAr: (commune as CommuneRow).name_ar,
        } satisfies CommuneSearchResult,
        neighborhood: {
          id: (neighborhood as NeighborhoodRow).id,
          zoneCode: (neighborhood as NeighborhoodRow).zone_code,
          communeId: (neighborhood as NeighborhoodRow).commune_id,
          name: (neighborhood as NeighborhoodRow).name_en,
          nameEn: (neighborhood as NeighborhoodRow).name_en,
          nameFr: (neighborhood as NeighborhoodRow).name_fr,
          nameAr: (neighborhood as NeighborhoodRow).name_ar,
          deliveryFee: Number((neighborhood as NeighborhoodRow).delivery_fee ?? 0),
        } satisfies NeighborhoodSearchResult,
      };
    } catch (error) {
      console.error("getLocationByNeighborhoodId failed:", error);
      throw new Error("Failed to resolve location.");
    }
  });

export const listServiceZones = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [{ data: communes, error: communesError }, { data: neighborhoods, error: neighborhoodsError }] =
      await Promise.all([
        (supabaseAdmin as any)
          .from("communes")
          .select("id, name_en, name_fr, name_ar")
          .order("name_en", { ascending: true }),
        (supabaseAdmin as any)
          .from("neighborhoods")
          .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee, vendor_id")
          .order("name_en", { ascending: true }),
      ]);

    if (communesError) throw new Error(communesError.message);
    if (neighborhoodsError) throw new Error(neighborhoodsError.message);

    const groupedNeighborhoods = new Map<string, ServiceZoneTree[number]["neighborhoods"]>();

    for (const neighborhood of (neighborhoods ?? []) as NeighborhoodRow[]) {
      const current = groupedNeighborhoods.get(neighborhood.commune_id) ?? [];
      current.push(mapNeighborhoodRow(neighborhood));
      groupedNeighborhoods.set(neighborhood.commune_id, current);
    }

    return ((communes ?? []) as CommuneRow[]).map((commune) => ({
      id: commune.id,
      name: commune.name_en,
      nameEn: commune.name_en,
      nameFr: commune.name_fr,
      nameAr: commune.name_ar,
      neighborhoods: groupedNeighborhoods.get(commune.id) ?? [],
    }));
  } catch (error) {
    console.error("listServiceZones failed:", error);
    throw new Error("Failed to load service zones.");
  }
});

export const listServiceZonesForExport = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [{ data: communes, error: communesError }, { data: neighborhoods, error: neighborhoodsError }] =
      await Promise.all([
        (supabaseAdmin as any).from("communes").select("id, name_en, name_fr, name_ar"),
        (supabaseAdmin as any)
          .from("neighborhoods")
          .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee"),
      ]);

    if (communesError) throw new Error(communesError.message);
    if (neighborhoodsError) throw new Error(neighborhoodsError.message);

    const communesById = new Map<string, CommuneRow>();
    for (const commune of (communes ?? []) as CommuneRow[]) {
      communesById.set(commune.id, commune);
    }

    return ((neighborhoods ?? []) as NeighborhoodRow[])
      .map((neighborhood) => {
        const commune = communesById.get(neighborhood.commune_id);
        if (!commune) return null;

        return {
          zoneCode: neighborhood.zone_code,
          communeEn: commune.name_en,
          communeFr: commune.name_fr,
          communeAr: commune.name_ar,
          douarEn: neighborhood.name_en,
          douarFr: neighborhood.name_fr,
          douarAr: neighborhood.name_ar,
          deliveryFee: Number(neighborhood.delivery_fee ?? 0),
        } satisfies ServiceZoneExportRow;
      })
      .filter((row): row is ServiceZoneExportRow => Boolean(row))
      .sort((a, b) => {
        const communeCompare = a.communeEn.localeCompare(b.communeEn);
        if (communeCompare !== 0) return communeCompare;
        return a.douarEn.localeCompare(b.douarEn);
      });
  } catch (error) {
    console.error("listServiceZonesForExport failed:", error);
    throw new Error("Failed to export service zones.");
  }
});

export const createCommune = createServerFn({ method: "POST" })
  .inputValidator((input) => createCommuneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("communes")
        .insert({
          name_en: data.nameEn,
          name_fr: data.nameFr?.trim() ? data.nameFr.trim() : null,
          name_ar: data.nameAr?.trim() ? data.nameAr.trim() : null,
        })
        .select("id, name_en, name_fr, name_ar")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Failed to create commune.");
      }

      return {
        id: (inserted as CommuneRow).id,
        name: (inserted as CommuneRow).name_en,
        nameEn: (inserted as CommuneRow).name_en,
        nameFr: (inserted as CommuneRow).name_fr,
        nameAr: (inserted as CommuneRow).name_ar,
      };
    } catch (error) {
      console.error("createCommune failed:", error);
      throw new Error("Failed to create commune.");
    }
  });

export const createNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => createNeighborhoodInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: existingZoneCodes, error: zoneCodeError } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .select("zone_code")
        .ilike("zone_code", "SZ-%")
        .order("zone_code", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (zoneCodeError) {
        throw new Error(zoneCodeError.message);
      }

      const maxSequence =
        extractZoneCodeSequence((existingZoneCodes as { zone_code?: string | null } | null)?.zone_code ?? "") ?? 0;

      const zoneCode = `SZ-${String(maxSequence + 1).padStart(6, "0")}`;

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .insert({
          zone_code: zoneCode,
          commune_id: data.communeId,
          name_en: data.nameEn,
          name_fr: data.nameFr?.trim() ? data.nameFr.trim() : null,
          name_ar: data.nameAr?.trim() ? data.nameAr.trim() : null,
          delivery_fee: data.deliveryFee,
        })
        .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Failed to create neighborhood.");
      }

      return {
        id: (inserted as NeighborhoodRow).id,
        zoneCode: (inserted as NeighborhoodRow).zone_code,
        name: (inserted as NeighborhoodRow).name_en,
        nameEn: (inserted as NeighborhoodRow).name_en,
        nameFr: (inserted as NeighborhoodRow).name_fr,
        nameAr: (inserted as NeighborhoodRow).name_ar,
        communeId: (inserted as NeighborhoodRow).commune_id,
        deliveryFee: Number((inserted as NeighborhoodRow).delivery_fee ?? 0),
      };
    } catch (error) {
      console.error("createNeighborhood failed:", error);
      throw new Error("Failed to create neighborhood.");
    }
  });

export const importServiceZonesBulk = createServerFn({ method: "POST" })
  .inputValidator((input) => importServiceZonesBulkInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const normalizedRows = data.rows.map((row, index) => ({
        rowNumber: index + 2,
        zoneCode: normalizeZoneCode(row.zoneCode),
        communeEn: row.communeEn.trim(),
        communeFr: row.communeFr?.trim() ? row.communeFr.trim() : null,
        communeAr: row.communeAr?.trim() ? row.communeAr.trim() : null,
        douarEn: row.douarEn.trim(),
        douarFr: row.douarFr?.trim() ? row.douarFr.trim() : null,
        douarAr: row.douarAr?.trim() ? row.douarAr.trim() : null,
        deliveryFee: Number(row.deliveryFee),
      }));

      if (normalizedRows.length === 0) {
        throw new Error("No valid service zone rows found in the uploaded file.");
      }

      const [{ data: communes, error: communesError }, { data: neighborhoods, error: neighborhoodsError }] =
        await Promise.all([
          (supabaseAdmin as any).from("communes").select("id, name_en, name_fr, name_ar"),
          (supabaseAdmin as any)
            .from("neighborhoods")
            .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee"),
        ]);

      if (communesError) throw new Error(communesError.message);
      if (neighborhoodsError) throw new Error(neighborhoodsError.message);

      const communeByLookup = new Map<string, CommuneRow>();
      for (const commune of (communes ?? []) as CommuneRow[]) {
        communeByLookup.set(createCommuneLookupKey(commune.name_en, commune.name_fr, commune.name_ar), commune);
      }

      const neighborhoodsByZoneCode = new Map<string, NeighborhoodRow>();
      const reservedZoneCodes = new Set<string>();
      let maxGeneratedSequence = 0;

      for (const neighborhood of (neighborhoods ?? []) as NeighborhoodRow[]) {
        const normalizedCode = normalizeZoneCode(neighborhood.zone_code);
        if (!normalizedCode) continue;
        neighborhoodsByZoneCode.set(normalizedCode, neighborhood);
        reservedZoneCodes.add(normalizedCode);
        const seq = extractZoneCodeSequence(normalizedCode);
        if (seq && seq > maxGeneratedSequence) {
          maxGeneratedSequence = seq;
        }
      }

      const generatorState = {
        nextSequence: maxGeneratedSequence + 1,
        reserved: reservedZoneCodes,
      };

      const warnings: string[] = [];
      let insertedCount = 0;
      let updatedCount = 0;

      for (const row of normalizedRows) {
        if (!row.communeEn || !row.douarEn) {
          warnings.push(`Row ${row.rowNumber}: Commune_EN and Douar_EN are required.`);
          continue;
        }

        if (!Number.isFinite(row.deliveryFee) || row.deliveryFee < 0) {
          warnings.push(`Row ${row.rowNumber}: Delivery_Fee is invalid.`);
          continue;
        }

        const existingByZone = row.zoneCode ? neighborhoodsByZoneCode.get(row.zoneCode) : null;

        let targetCommune: CommuneRow | null = null;

        if (existingByZone) {
          const { data: updatedCommune, error: updateCommuneError } = await (supabaseAdmin as any)
            .from("communes")
            .update({
              name_en: row.communeEn,
              name_fr: row.communeFr,
              name_ar: row.communeAr,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingByZone.commune_id)
            .select("id, name_en, name_fr, name_ar")
            .single();

          if (updateCommuneError || !updatedCommune?.id) {
            warnings.push(
              `Row ${row.rowNumber}: failed to update parent commune (${updateCommuneError?.message ?? "unknown error"}).`,
            );
            continue;
          }

          targetCommune = updatedCommune as CommuneRow;
          communeByLookup.set(
            createCommuneLookupKey(targetCommune.name_en, targetCommune.name_fr, targetCommune.name_ar),
            targetCommune,
          );
        } else {
          const lookupKey = createCommuneLookupKey(row.communeEn, row.communeFr, row.communeAr);
          const matchedCommune = communeByLookup.get(lookupKey);

          if (matchedCommune) {
            targetCommune = matchedCommune;
          } else {
            const { data: insertedCommune, error: insertCommuneError } = await (supabaseAdmin as any)
              .from("communes")
              .insert({
                name_en: row.communeEn,
                name_fr: row.communeFr,
                name_ar: row.communeAr,
              })
              .select("id, name_en, name_fr, name_ar")
              .single();

            if (insertCommuneError || !insertedCommune?.id) {
              warnings.push(
                `Row ${row.rowNumber}: failed to create commune (${insertCommuneError?.message ?? "unknown error"}).`,
              );
              continue;
            }

            targetCommune = insertedCommune as CommuneRow;
            communeByLookup.set(lookupKey, targetCommune);
          }
        }

        if (!targetCommune?.id) {
          warnings.push(`Row ${row.rowNumber}: unable to resolve commune.`);
          continue;
        }

        if (existingByZone) {
          const { data: updatedNeighborhood, error: updateNeighborhoodError } = await (supabaseAdmin as any)
            .from("neighborhoods")
            .update({
              commune_id: targetCommune.id,
              name_en: row.douarEn,
              name_fr: row.douarFr,
              name_ar: row.douarAr,
              delivery_fee: row.deliveryFee,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingByZone.id)
            .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee")
            .single();

          if (updateNeighborhoodError || !updatedNeighborhood?.id) {
            warnings.push(
              `Row ${row.rowNumber}: failed to update zone (${updateNeighborhoodError?.message ?? "unknown error"}).`,
            );
            continue;
          }

          neighborhoodsByZoneCode.set((updatedNeighborhood as NeighborhoodRow).zone_code, updatedNeighborhood as NeighborhoodRow);
          updatedCount += 1;
          continue;
        }

        const zoneCodeToUse = row.zoneCode ?? generateNextZoneCode(generatorState);

        if (row.zoneCode && neighborhoodsByZoneCode.has(row.zoneCode)) {
          warnings.push(`Row ${row.rowNumber}: Zone_Code '${row.zoneCode}' already exists.`);
          continue;
        }

        const { data: insertedNeighborhood, error: insertNeighborhoodError } = await (supabaseAdmin as any)
          .from("neighborhoods")
          .insert({
            zone_code: zoneCodeToUse,
            commune_id: targetCommune.id,
            name_en: row.douarEn,
            name_fr: row.douarFr,
            name_ar: row.douarAr,
            delivery_fee: row.deliveryFee,
          })
          .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee")
          .single();

        if (insertNeighborhoodError || !insertedNeighborhood?.id) {
          warnings.push(
            `Row ${row.rowNumber}: failed to create zone (${insertNeighborhoodError?.message ?? "unknown error"}).`,
          );
          continue;
        }

        neighborhoodsByZoneCode.set(zoneCodeToUse, insertedNeighborhood as NeighborhoodRow);
        reservedZoneCodes.add(zoneCodeToUse);
        insertedCount += 1;
      }

      return {
        ok: true,
        totalProcessed: normalizedRows.length,
        insertedCount,
        updatedCount,
        skippedCount: warnings.length,
        warnings,
      };
    } catch (error) {
      console.error("importServiceZonesBulk failed:", error);
      throw new Error("Failed to bulk import service zones.");
    }
  });

export const updateCommune = createServerFn({ method: "POST" })
  .inputValidator((input) => updateCommuneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: updated, error } = await (supabaseAdmin as any)
        .from("communes")
        .update({
          name_en: data.nameEn,
          name_fr: data.nameFr?.trim() ? data.nameFr.trim() : null,
          name_ar: data.nameAr?.trim() ? data.nameAr.trim() : null,
        })
        .eq("id", data.id)
        .select("id, name_en, name_fr, name_ar")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Failed to update commune.");
      }

      return {
        id: (updated as CommuneRow).id,
        name: (updated as CommuneRow).name_en,
        nameEn: (updated as CommuneRow).name_en,
        nameFr: (updated as CommuneRow).name_fr,
        nameAr: (updated as CommuneRow).name_ar,
      };
    } catch (error) {
      console.error("updateCommune failed:", error);
      throw new Error("Failed to update commune.");
    }
  });

export const updateNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => updateNeighborhoodInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: updated, error } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .update({
          name_en: data.nameEn,
          name_fr: data.nameFr?.trim() ? data.nameFr.trim() : null,
          name_ar: data.nameAr?.trim() ? data.nameAr.trim() : null,
          delivery_fee: data.deliveryFee,
        })
        .eq("id", data.id)
        .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Failed to update neighborhood.");
      }

      return {
        id: (updated as NeighborhoodRow).id,
        zoneCode: (updated as NeighborhoodRow).zone_code,
        name: (updated as NeighborhoodRow).name_en,
        nameEn: (updated as NeighborhoodRow).name_en,
        nameFr: (updated as NeighborhoodRow).name_fr,
        nameAr: (updated as NeighborhoodRow).name_ar,
        communeId: (updated as NeighborhoodRow).commune_id,
        deliveryFee: Number((updated as NeighborhoodRow).delivery_fee ?? 0),
      };
    } catch (error) {
      console.error("updateNeighborhood failed:", error);
      throw new Error("Failed to update neighborhood.");
    }
  });

export const getCommuneById = createServerFn({ method: "GET" })
  .inputValidator((input) => getCommuneByIdInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const [{ data: communeRows, error: communeError }, { data: neighborhoods, error: neighborhoodsError }] =
        await Promise.all([
          (supabaseAdmin as any)
            .from("communes")
            .select("id, name_en, name_fr, name_ar")
            .eq("id", data.communeId)
            .limit(2),
          (supabaseAdmin as any)
            .from("neighborhoods")
            .select("id, zone_code, name_en, name_fr, name_ar, commune_id, delivery_fee, vendor_id")
            .eq("commune_id", data.communeId)
            .order("name_en", { ascending: true }),
        ]);

      const commune = ((communeRows ?? []) as CommuneRow[])[0] ?? null;

      if (communeError || !commune?.id) {
        throw new Error(communeError?.message ?? "Commune not found.");
      }

      if (neighborhoodsError) {
        throw new Error(neighborhoodsError.message);
      }

      return {
        id: (commune as CommuneRow).id,
        name: (commune as CommuneRow).name_en,
        nameEn: (commune as CommuneRow).name_en,
        nameFr: (commune as CommuneRow).name_fr,
        nameAr: (commune as CommuneRow).name_ar,
        neighborhoods: ((neighborhoods ?? []) as NeighborhoodRow[]).map(mapNeighborhoodRow),
      } satisfies CommuneProfile;
    } catch (error) {
      console.error("getCommuneById failed:", error);
      throw new Error("Failed to load commune profile.");
    }
  });

export const deleteNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => deleteNeighborhoodInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any).from("neighborhoods").delete().eq("id", data.id);

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      console.error("deleteNeighborhood failed:", error);
      throw new Error("Failed to delete neighborhood.");
    }
  });

export const deleteCommune = createServerFn({ method: "POST" })
  .inputValidator((input) => deleteCommuneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error: deleteNeighborhoodsError } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .delete()
        .eq("commune_id", data.id);

      if (deleteNeighborhoodsError) {
        throw new Error(deleteNeighborhoodsError.message);
      }

      const { error } = await (supabaseAdmin as any).from("communes").delete().eq("id", data.id);

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      console.error("deleteCommune failed:", error);
      throw new Error("Failed to delete commune.");
    }
  });
