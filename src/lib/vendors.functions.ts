import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";

export interface AdminVendorRecord {
  id: string;
  storeName: string;
  ownerName: string;
  phoneNumber: string;
  vendorEarningsMad: number;
  platformDuesMad: number;
  vendorType: "general" | "specialized";
  assignedCategories: string[];
  neighborhoodIds: string[];
  zone: string;
  status: "Active" | "Offline";
  createdAt?: string;
}

interface VendorRow {
  id: string;
  store_name: string;
  owner_name: string;
  phone_number: string;
  vendor_earnings: number | null;
  platform_dues: number | null;
  vendor_type: "general" | "specialized";
  assigned_categories: string[];
  is_active: boolean;
  created_at: string | null;
}

interface NeighborhoodRow {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
  commune_id: string;
  vendor_id: string | null;
}

interface CommuneRow {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
}

const createVendorInputSchema = z.object({
  storeName: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().min(1).max(20),
  vendorType: z.enum(["general", "specialized"]).default("general"),
  assignedCategories: z.array(z.string()).default([]),
  neighborhoodIds: z.array(z.string().uuid()).min(1),
  isActive: z.boolean(),
});

const updateVendorDetailsInputSchema = z.object({
  vendorId: z.string().uuid(),
  storeName: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
  vendorType: z.enum(["general", "specialized"]).default("general"),
  assignedCategories: z.array(z.string()).default([]),
  neighborhoodIds: z.array(z.string().uuid()).min(1),
});

const updateVendorActiveStateInputSchema = z.object({
  vendorId: z.string().uuid(),
  isActive: z.boolean(),
});

const getVendorSalesAnalyticsInputSchema = z.object({
  vendorId: z.string().uuid(),
});

const collectVendorPlatformDuesInputSchema = z.object({
  vendorId: z.string().uuid(),
  amount: z.number().positive(),
  qrPayload: z.record(z.string(), z.any()).nullable().optional(),
});

type VendorOrderRow = {
  id: string;
  status: string;
  total_price: number;
  created_at: string;
};

export type VendorSalesAnalytics = {
  todaysRevenueMad: number;
  totalAllTimeSalesMad: number;
  totalCompletedOrders: number;
  lastFiveOrders: Array<{
    id: string;
    status: string;
    totalMad: number;
    createdAt: string;
  }>;
};

export type PlatformDuesCollectionResult = {
  transactionId: string;
  collectedAmountMad: number;
  remainingDuesMad: number;
};

type PendingPlatformDuesRow = {
  vendor_id: string;
  payment_method: string | null;
  platform_markup: number | null;
  platform_profit: number | null;
  delivery_fee: number | null;
};

function roundMad(value: number) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function isCashPaymentMethod(paymentMethod: string | null | undefined) {
  const normalized = String(paymentMethod ?? "").trim().toLowerCase();
  return normalized === "cod" || normalized === "cash";
}

function platformDueFromOrder(row: {
  platform_markup?: number | null;
  platform_profit?: number | null;
  delivery_fee?: number | null;
}) {
  const markup = Number(row.platform_markup ?? Number.NaN);
  if (Number.isFinite(markup) && markup > 0) return markup;
  const profit = Number(row.platform_profit ?? Number.NaN);
  if (Number.isFinite(profit) && profit > 0) return profit;
  return Number(row.delivery_fee ?? 0);
}

async function getPendingPlatformDuesByVendorIds(vendorIds: string[]) {
  if (vendorIds.length === 0) return new Map<string, number>();

  const { data, error } = await (supabaseAdmin as any)
    .from("orders")
    .select("vendor_id, payment_method, platform_markup, platform_profit, delivery_fee")
    .in("vendor_id", vendorIds)
    .eq("status", "cash_transferred_to_vendor")
    .or("admin_settled.is.null,admin_settled.eq.false");

  if (error) {
    throw new Error(error.message);
  }

  const dueByVendor = new Map<string, number>();
  for (const row of (data ?? []) as PendingPlatformDuesRow[]) {
    if (!isCashPaymentMethod(row.payment_method)) continue;
    const current = dueByVendor.get(row.vendor_id) ?? 0;
    dueByVendor.set(row.vendor_id, current + platformDueFromOrder(row));
  }

  for (const vendorId of vendorIds) {
    dueByVendor.set(vendorId, roundMad(dueByVendor.get(vendorId) ?? 0));
  }

  return dueByVendor;
}

function zoneFromNeighborhoods(neighborhoods: NeighborhoodRow[], communeMap: Map<string, string>) {
  if (neighborhoods.length === 0) {
    return "Unassigned";
  }

  return neighborhoods
    .map((neighborhood) => {
      const communeName = communeMap.get(neighborhood.commune_id);
      return communeName ? `${communeName} / ${neighborhood.name_en}` : neighborhood.name_en;
    })
    .join(" • ");
}

async function assertNeighborhoodsAvailable(neighborhoodIds: string[], currentVendorId?: string) {
  const conflictQuery = (supabaseAdmin as any)
    .from("neighborhoods")
    .select("id, name_en, vendor_id")
    .in("id", neighborhoodIds)
    .not("vendor_id", "is", null);

  if (currentVendorId) {
    conflictQuery.neq("vendor_id", currentVendorId);
  }

  const { data: conflicts, error } = await conflictQuery;

  if (error) {
    throw new Error(error.message);
  }

  if ((conflicts ?? []).length > 0) {
    const claimed = (conflicts as Array<{ name_en: string }>).map((row) => row.name_en).join(", ");
    throw new Error(`These neighborhoods are already claimed: ${claimed}`);
  }
}

async function assignVendorNeighborhoods(vendorId: string, neighborhoodIds: string[]) {
  await assertNeighborhoodsAvailable(neighborhoodIds, vendorId);

  const { error: clearError } = await (supabaseAdmin as any)
    .from("neighborhoods")
    .update({ vendor_id: null })
    .eq("vendor_id", vendorId);

  if (clearError) {
    throw new Error(clearError.message);
  }

  const { error: assignError } = await (supabaseAdmin as any)
    .from("neighborhoods")
    .update({ vendor_id: vendorId })
    .in("id", neighborhoodIds);

  if (assignError) {
    throw new Error(assignError.message);
  }
}

async function fetchVendorRecord(vendorId: string) {
  const [{ data: vendor, error: vendorError }, { data: neighborhoods, error: neighborhoodsError }, { data: communes, error: communesError }] =
    await Promise.all([
      (supabaseAdmin as any)
        .from("vendors")
        .select(
          "id, store_name, owner_name, phone_number, vendor_earnings, platform_dues, vendor_type, assigned_categories, is_active, created_at",
        )
        .eq("id", vendorId)
        .single(),
      (supabaseAdmin as any)
        .from("neighborhoods")
        .select("id, name_en, name_fr, name_ar, commune_id, vendor_id")
        .eq("vendor_id", vendorId)
        .order("name_en", { ascending: true }),
      (supabaseAdmin as any).from("communes").select("id, name_en, name_fr, name_ar"),
    ]);

  if (vendorError || !vendor?.id) {
    throw new Error(vendorError?.message ?? "Vendor not found.");
  }

  if (neighborhoodsError) {
    throw new Error(neighborhoodsError.message);
  }

  if (communesError) {
    throw new Error(communesError.message);
  }

  const communeMap = new Map(((communes ?? []) as CommuneRow[]).map((c) => [c.id, c.name_en]));
  const dueByVendor = await getPendingPlatformDuesByVendorIds([vendorId]);
  const vendorNeighborhoods = (neighborhoods ?? []) as NeighborhoodRow[];
  const row = vendor as VendorRow;

  return {
    id: row.id,
    storeName: row.store_name,
    ownerName: row.owner_name,
    phoneNumber: row.phone_number,
    vendorEarningsMad: Number(row.vendor_earnings ?? 0),
    platformDuesMad: Number(dueByVendor.get(vendorId) ?? 0),
    vendorType: row.vendor_type ?? "general",
    assignedCategories: row.vendor_type === "specialized" ? (row.assigned_categories ?? []) : [],
    neighborhoodIds: vendorNeighborhoods.map((n) => n.id),
    zone: zoneFromNeighborhoods(vendorNeighborhoods, communeMap),
    status: row.is_active ? "Active" : "Offline",
    createdAt: row.created_at ?? undefined,
  } satisfies AdminVendorRecord;
}

export const listVendors = createServerFn({ method: "GET" }).handler(async () => {
  const [{ data: vendors, error: vendorsError }, { data: neighborhoods, error: neighborhoodsError }, { data: communes, error: communesError }] =
    await Promise.all([
      (supabaseAdmin as any)
        .from("vendors")
        .select(
          "id, store_name, owner_name, phone_number, vendor_earnings, platform_dues, vendor_type, assigned_categories, is_active, created_at",
        )
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any).from("neighborhoods").select("id, name_en, name_fr, name_ar, commune_id, vendor_id"),
      (supabaseAdmin as any).from("communes").select("id, name_en, name_fr, name_ar"),
    ]);

  if (vendorsError) {
    throw new Error(`Failed to fetch vendors: ${vendorsError.message}`);
  }
  if (neighborhoodsError) {
    throw new Error(`Failed to fetch neighborhoods: ${neighborhoodsError.message}`);
  }
  if (communesError) {
    throw new Error(`Failed to fetch communes: ${communesError.message}`);
  }

  const communeMap = new Map(((communes ?? []) as CommuneRow[]).map((c) => [c.id, c.name_en]));
  const neighborhoodsByVendor = new Map<string, NeighborhoodRow[]>();
  const dueByVendor = await getPendingPlatformDuesByVendorIds(
    ((vendors ?? []) as VendorRow[]).map((vendor) => vendor.id),
  );

  for (const neighborhood of (neighborhoods ?? []) as NeighborhoodRow[]) {
    if (!neighborhood.vendor_id) continue;
    const current = neighborhoodsByVendor.get(neighborhood.vendor_id) ?? [];
    current.push(neighborhood);
    neighborhoodsByVendor.set(neighborhood.vendor_id, current);
  }

  return ((vendors ?? []) as VendorRow[]).map((vendor): AdminVendorRecord => {
    const vendorNeighborhoods = neighborhoodsByVendor.get(vendor.id) ?? [];

    return {
      id: vendor.id,
      storeName: vendor.store_name,
      ownerName: vendor.owner_name,
      phoneNumber: vendor.phone_number,
      vendorEarningsMad: Number(vendor.vendor_earnings ?? 0),
      platformDuesMad: Number(dueByVendor.get(vendor.id) ?? 0),
      vendorType: vendor.vendor_type ?? "general",
      assignedCategories: vendor.vendor_type === "specialized" ? (vendor.assigned_categories ?? []) : [],
      neighborhoodIds: vendorNeighborhoods.map((neighborhood) => neighborhood.id),
      zone: zoneFromNeighborhoods(vendorNeighborhoods, communeMap),
      status: vendor.is_active ? "Active" : "Offline",
      createdAt: vendor.created_at ?? undefined,
    };
  });
});

export const createVendor = createServerFn({ method: "POST" })
  .inputValidator((input) => createVendorInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const normalizedPhone = normalizeMoroccoPhoneInput(data.phoneNumber);

      if (!isValidMoroccoPhone(normalizedPhone)) {
        throw new Error("Phone number must be exactly 9 digits.");
      }

      const payloadPhoneNumber = formatMoroccoPhoneForPayload(normalizedPhone);
      const normalizedVendorType = data.vendorType ?? "general";
      const normalizedAssignedCategories =
        normalizedVendorType === "specialized"
          ? Array.from(new Set((data.assignedCategories ?? []).map((value) => value.trim()).filter(Boolean)))
          : [];
      await assertNeighborhoodsAvailable(data.neighborhoodIds);

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("vendors")
        .insert({
          store_name: data.storeName,
          owner_name: data.ownerName,
          phone_number: payloadPhoneNumber,
          vendor_type: normalizedVendorType,
          assigned_categories: normalizedAssignedCategories,
          is_active: data.isActive,
        })
        .select("id")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Vendor insert failed.");
      }

      try {
        await assignVendorNeighborhoods(inserted.id as string, data.neighborhoodIds);
      } catch (territoryError) {
        await (supabaseAdmin as any).from("vendors").delete().eq("id", inserted.id as string);
        throw territoryError;
      }

      return await fetchVendorRecord(inserted.id as string);
    } catch (error) {
      console.error("createVendor failed:", error);
      throw new Error(error instanceof Error ? error.message : "Vendor save failed.");
    }
  });

export const updateVendorDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => updateVendorDetailsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      await assertNeighborhoodsAvailable(data.neighborhoodIds, data.vendorId);
      const normalizedVendorType = data.vendorType ?? "general";
      const normalizedAssignedCategories =
        normalizedVendorType === "specialized"
          ? Array.from(new Set((data.assignedCategories ?? []).map((value) => value.trim()).filter(Boolean)))
          : [];

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("vendors")
        .update({
          store_name: data.storeName,
          owner_name: data.ownerName,
          phone_number: data.phoneNumber,
          vendor_type: normalizedVendorType,
          assigned_categories: normalizedAssignedCategories,
        })
        .eq("id", data.vendorId)
        .select("id")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Vendor update failed.");
      }

      await assignVendorNeighborhoods(data.vendorId, data.neighborhoodIds);

      return await fetchVendorRecord(data.vendorId);
    } catch (error) {
      console.error("updateVendorDetails failed:", error);
      throw new Error(error instanceof Error ? error.message : "Vendor update failed.");
    }
  });

export const updateVendorActiveState = createServerFn({ method: "POST" })
  .inputValidator((input) => updateVendorActiveStateInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any)
        .from("vendors")
        .update({ is_active: data.isActive })
        .eq("id", data.vendorId);

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true, isActive: data.isActive };
    } catch (error) {
      console.error("updateVendorActiveState failed:", error);
      throw new Error("Failed to update vendor visibility.");
    }
  });

export const getVendorSalesAnalytics = createServerFn({ method: "POST" })
  .inputValidator((input) => getVendorSalesAnalyticsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday);
      endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

      const [
        { data: deliveredOrders, error: deliveredOrdersError },
        { data: deliveredOrdersToday, error: deliveredOrdersTodayError },
        { data: recentOrders, error: recentOrdersError },
      ] = await Promise.all([
        (supabaseAdmin as any)
          .from("orders")
          .select("id, total_price")
          .eq("vendor_id", data.vendorId)
          .eq("status", "delivered"),
        (supabaseAdmin as any)
          .from("orders")
          .select("id, total_price")
          .eq("vendor_id", data.vendorId)
          .eq("status", "delivered")
          .gte("created_at", startOfToday.toISOString())
          .lt("created_at", endOfToday.toISOString()),
        (supabaseAdmin as any)
          .from("orders")
          .select("id, status, total_price, created_at")
          .eq("vendor_id", data.vendorId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (deliveredOrdersError) {
        throw new Error(deliveredOrdersError.message);
      }

      if (deliveredOrdersTodayError) {
        throw new Error(deliveredOrdersTodayError.message);
      }

      if (recentOrdersError) {
        throw new Error(recentOrdersError.message);
      }

      const allTimeDeliveredRows = (deliveredOrders ?? []) as Array<{ total_price: number }>;
      const todaysDeliveredRows = (deliveredOrdersToday ?? []) as Array<{ total_price: number }>;

      const totalAllTimeSalesMad = allTimeDeliveredRows.reduce(
        (sum, row) => sum + Number(row.total_price ?? 0),
        0,
      );

      const todaysRevenueMad = todaysDeliveredRows.reduce(
        (sum, row) => sum + Number(row.total_price ?? 0),
        0,
      );

      return {
        todaysRevenueMad,
        totalAllTimeSalesMad,
        totalCompletedOrders: allTimeDeliveredRows.length,
        lastFiveOrders: ((recentOrders ?? []) as VendorOrderRow[]).map((order) => ({
          id: order.id,
          status: order.status,
          totalMad: Number(order.total_price ?? 0),
          createdAt: order.created_at,
        })),
      } satisfies VendorSalesAnalytics;
    } catch (error) {
      console.error("getVendorSalesAnalytics failed:", error);
      throw new Error("Failed to load vendor sales analytics.");
    }
  });

export const collectVendorPlatformDues = createServerFn({ method: "POST" })
  .inputValidator((input) => collectVendorPlatformDuesInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: pendingRows, error: pendingError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, payment_method, platform_markup, platform_profit, delivery_fee")
        .eq("vendor_id", data.vendorId)
        .eq("status", "cash_transferred_to_vendor")
        .or("admin_settled.is.null,admin_settled.eq.false");

      if (pendingError) {
        throw new Error(pendingError.message);
      }

      const pendingDuesMad = roundMad(
        ((pendingRows ?? []) as Array<{ payment_method?: string | null; platform_markup?: number | null; platform_profit?: number | null; delivery_fee?: number | null }>).reduce(
          (sum, row) => {
            if (!isCashPaymentMethod(row.payment_method)) return sum;
            return sum + platformDueFromOrder(row);
          },
          0,
        ),
      );

      if (pendingDuesMad <= 0) {
        throw new Error("No platform dues pending for this vendor.");
      }

      const targetAmountMad = roundMad(Number(data.amount ?? 0));
      if (Math.abs(targetAmountMad - pendingDuesMad) > 0.01) {
        throw new Error(
          `Collection amount mismatch. Expected ${pendingDuesMad.toFixed(2)} MAD, received ${targetAmountMad.toFixed(2)} MAD.`,
        );
      }

      const { data: rpcResult, error } = await (supabaseAdmin as any).rpc("collect_platform_dues", {
        p_vendor_id: data.vendorId,
        p_amount: targetAmountMad,
        p_qr_payload: data.qrPayload ?? null,
        p_collected_by_user_id: null,
      });

      if (error) {
        throw new Error(error.message);
      }

      const row = Array.isArray(rpcResult) ? rpcResult[0] : null;
      if (!row?.transaction_id) {
        throw new Error("Collection failed. Please try again.");
      }

      const pendingOrderIds = ((pendingRows ?? []) as Array<{ id: string }>).map((row) => row.id);
      if (pendingOrderIds.length > 0) {
        const { error: settleError } = await (supabaseAdmin as any)
          .from("orders")
          .update({ admin_settled: true, updated_at: new Date().toISOString() })
          .in("id", pendingOrderIds);

        if (settleError) {
          throw new Error(settleError.message);
        }
      }

      return {
        transactionId: String(row.transaction_id),
        collectedAmountMad: Number(row.collected_amount ?? 0),
        remainingDuesMad: Number(row.remaining_dues ?? 0),
      } satisfies PlatformDuesCollectionResult;
    } catch (error) {
      console.error("collectVendorPlatformDues failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to collect platform dues.");
    }
  });
