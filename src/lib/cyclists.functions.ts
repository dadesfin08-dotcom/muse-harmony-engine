import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processPendingOrderPushEvents } from "@/lib/push-notifications.server";
import { evaluateCustomerBehavior, evaluateCustomersBehavior } from "@/utils/customerAlgorithm";

const moroccoPhoneSchema = z.string().trim().regex(/^\+212[0-9]{9}$/);

const createCyclistInputSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phoneNumber: moroccoPhoneSchema,
  neighborhoodIds: z.array(z.string().uuid()).min(1),
  isActive: z.boolean().default(true),
});

const cyclistLookupInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
});

const cyclistDashboardInputSchema = z.object({
  cyclistId: z.string().uuid(),
});

const cyclistWalletInputSchema = z.object({
  cyclistId: z.string().uuid(),
});

const cyclistEarningsHistoryInputSchema = z.object({
  cyclistId: z.string().uuid(),
  period: z.enum(["today", "week", "month"]),
});

const setCyclistActiveStateInputSchema = z.object({
  cyclistId: z.string().uuid(),
  isActive: z.boolean(),
});

const acceptDeliveryInputSchema = z.object({
  cyclistId: z.string().uuid(),
  orderId: z.string().uuid(),
});

const markDeliveredInputSchema = z.object({
  cyclistId: z.string().uuid(),
  orderId: z.string().uuid(),
});

const completeCustomerDeliveryInputSchema = z.object({
  cyclistId: z.string().uuid(),
  orderId: z.string().uuid(),
});

const settleVendorHandoverInputSchema = z.object({
  cyclistId: z.string().uuid(),
  vendorId: z.string().uuid(),
});

const cancelActiveDeliveryInputSchema = z.object({
  cyclistId: z.string().uuid(),
  orderId: z.string().uuid(),
  reason: z.enum(["cod_rejection", "unreachable", "fake_order"]),
});

type CyclistRow = {
  id: string;
  full_name: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
};

type CyclistCoverageRow = {
  cyclist_id: string;
  neighborhood_id: string;
};

type NeighborhoodRow = {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
  commune_id: string;
};

type CommuneRow = {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
};

type OrderRow = {
  id: string;
  cyclist_id?: string | null;
  customer_user_id?: string | null;
  subscription_id?: string | null;
  order_category?: "MARKETPLACE" | "PLATFORM_SUBSCRIPTION" | string | null;
  customer_name: string;
  customer_phone: string;
  cash_to_collect_from_customer?: number | null;
  delivery_notes: string;
  payment_method: "COD" | "Carnet";
  delivery_fee: number;
  total_price: number;
  status:
    | "ready"
    | "in_delivery"
    | "delivered"
    | "delivered_cash_with_cyclist"
    | "cash_transferred_to_vendor"
    | "pending"
    | "new"
    | "preparing";
  order_items?: Array<{
    name?: string;
    quantity?: number;
    unitPriceMad?: number;
    selectedVariant?: string | null;
    productId?: string;
    brand_name?: string;
    brandName?: string;
    measurement_value?: number | string;
    measurementValue?: number | string;
    measurement_unit?: string;
    measurementUnit?: string;
  }>;
  neighborhood_id: string;
  delivery_auth_code: string;
  created_at: string;
  delivered_at?: string | null;
  vendor_settlement_status?: "pending" | "settled";
};

type CustomerRow = {
  phone_number: string;
  saved_instructions: string | null;
};

export type AdminCyclistRecord = {
  id: string;
  fullName: string;
  phoneNumber: string;
  neighborhoodIds: string[];
  zone: string;
  status: "Active" | "Offline";
  createdAt?: string;
};

export type CyclistOrderCard = {
  id: string;
  subscriptionId: string | null;
  orderCategory: "MARKETPLACE" | "PLATFORM_SUBSCRIPTION";
  customerName: string;
  customerPhone: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryInstructions: string;
  deliveryZone: string;
  douar: string;
  deliveryFeeMad: number;
  totalMad: number;
  cashToCollectMad: number;
  paymentMethod: "COD" | "Carnet";
  packQuantity: number;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceMad: number;
    selectedVariant: string | null;
    imageUrl: string | null;
    lineTotalMad: number;
    brandName: string | null;
    measurementValue: string | null;
    measurementUnit: string | null;
  }>;
  savedInstructions: string;
  deliveryNotes: string;
  deliveryAuthCode: string;
  createdAt: string;
};

export type CyclistWalletSummary = {
  cyclist: {
    id: string;
    fullName: string;
  };
  myEarningsMad: number;
  pendingEarningsMad: number;
  cashToRemitMad: number;
  owedByVendorMad: number;
  netCashToHandoverMad: number;
  pendingSettlementOrdersCount: number;
  pendingCashSettlementOrdersCount: number;
  pendingCarnetSettlementOrdersCount: number;
};

export type EarningsHistoryPeriod = "today" | "week" | "month";

export type CyclistEarningsHistoryEntry = {
  orderId: string;
  deliveredAt: string;
  deliveryFeeMad: number;
};

export type CyclistEarningsHistoryResponse = {
  period: EarningsHistoryPeriod;
  totalEarningsMad: number;
  deliveries: CyclistEarningsHistoryEntry[];
};

export type CyclistPendingSettlement = {
  vendorId: string;
  vendorName: string;
  ordersCount: number;
  cashToHandoverMad: number;
};

async function buildServiceZoneMaps() {
  const [{ data: neighborhoods, error: neighborhoodsError }, { data: communes, error: communesError }] =
    await Promise.all([
      (supabaseAdmin as any).from("neighborhoods").select("id, name_en, name_fr, name_ar, commune_id"),
      (supabaseAdmin as any).from("communes").select("id, name_en, name_fr, name_ar"),
    ]);

  if (neighborhoodsError) {
    throw new Error(neighborhoodsError.message);
  }
  if (communesError) {
    throw new Error(communesError.message);
  }

  const communeMap = new Map(((communes ?? []) as CommuneRow[]).map((row) => [row.id, row.name_en]));
  const neighborhoodMap = new Map(
    ((neighborhoods ?? []) as NeighborhoodRow[]).map((row) => [row.id, row]),
  );

  return { communeMap, neighborhoodMap };
}

function formatCoverageZone(
  neighborhoodIds: string[],
  neighborhoodMap: Map<string, NeighborhoodRow>,
  communeMap: Map<string, string>,
) {
  if (neighborhoodIds.length === 0) {
    return "Unassigned";
  }

  const byCommune = new Map<string, string[]>();

  for (const neighborhoodId of neighborhoodIds) {
    const neighborhood = neighborhoodMap.get(neighborhoodId);
    if (!neighborhood) {
      continue;
    }

    const communeName = communeMap.get(neighborhood.commune_id) ?? "Unknown Commune";
    const current = byCommune.get(communeName) ?? [];
    current.push(neighborhood.name_en);
    byCommune.set(communeName, current);
  }

  const formatted = Array.from(byCommune.entries()).map(([communeName, neighborhoods]) => {
    const uniqueNeighborhoods = Array.from(new Set(neighborhoods));
    return `${communeName} / ${uniqueNeighborhoods.join(", ")}`;
  });

  return formatted.length ? formatted.join(" • ") : "Unassigned";
}

export const listCyclists = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data: cyclists, error } = await (supabaseAdmin as any)
      .from("cyclists")
      .select("id, full_name, phone_number, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const cyclistRows = (cyclists ?? []) as CyclistRow[];
    const cyclistIds = cyclistRows.map((row) => row.id);

    const { data: coverageRows, error: coverageError } = cyclistIds.length
      ? await (supabaseAdmin as any)
          .from("cyclist_coverage")
          .select("cyclist_id, neighborhood_id")
          .in("cyclist_id", cyclistIds)
      : { data: [], error: null };

    if (coverageError) {
      throw new Error(coverageError.message);
    }

    const coverageByCyclist = new Map<string, string[]>();
    for (const row of (coverageRows ?? []) as CyclistCoverageRow[]) {
      const current = coverageByCyclist.get(row.cyclist_id) ?? [];
      current.push(row.neighborhood_id);
      coverageByCyclist.set(row.cyclist_id, current);
    }

    const { communeMap, neighborhoodMap } = await buildServiceZoneMaps();

    return cyclistRows.map((cyclist): AdminCyclistRecord => {
      const neighborhoodIds = Array.from(new Set(coverageByCyclist.get(cyclist.id) ?? []));

      return {
        id: cyclist.id,
        fullName: cyclist.full_name,
        phoneNumber: cyclist.phone_number,
        neighborhoodIds,
        zone: formatCoverageZone(neighborhoodIds, neighborhoodMap, communeMap),
        status: cyclist.is_active ? "Active" : "Offline",
        createdAt: cyclist.created_at ?? undefined,
      };
    });
  } catch (error) {
    console.error("listCyclists failed:", error);
    throw new Error("Failed to load cyclists.");
  }
});

export const createCyclist = createServerFn({ method: "POST" })
  .inputValidator((input) => createCyclistInputSchema.parse(input))
  .handler(async ({ data }) => {
    let insertedCyclistId: string | null = null;

    try {
      const uniqueNeighborhoodIds = Array.from(new Set(data.neighborhoodIds));

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("cyclists")
        .insert({
          full_name: data.fullName,
          phone_number: data.phoneNumber,
          is_active: data.isActive,
        })
        .select("id, full_name, phone_number, is_active, created_at")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Cyclist insert failed.");
      }

      insertedCyclistId = inserted.id as string;

      const coveragePayload = uniqueNeighborhoodIds.map((neighborhoodId) => ({
        cyclist_id: insertedCyclistId,
        neighborhood_id: neighborhoodId,
      }));

      const { error: coverageInsertError } = await (supabaseAdmin as any)
        .from("cyclist_coverage")
        .insert(coveragePayload);

      if (coverageInsertError) {
        throw new Error(coverageInsertError.message);
      }

      const { communeMap, neighborhoodMap } = await buildServiceZoneMaps();
      const row = inserted as CyclistRow;

      return {
        id: row.id,
        fullName: row.full_name,
        phoneNumber: row.phone_number,
        neighborhoodIds: uniqueNeighborhoodIds,
        zone: formatCoverageZone(uniqueNeighborhoodIds, neighborhoodMap, communeMap),
        status: row.is_active ? "Active" : "Offline",
        createdAt: row.created_at ?? undefined,
      } satisfies AdminCyclistRecord;
    } catch (error) {
      if (insertedCyclistId) {
        await (supabaseAdmin as any).from("cyclists").delete().eq("id", insertedCyclistId);
      }

      console.error("createCyclist failed:", error);
      throw new Error("Cyclist save failed.");
    }
  });

export const getCyclistByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistLookupInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id, full_name, phone_number, is_active")
        .eq("phone_number", data.phoneNumber)
        .single();

      if (error || !cyclist?.id) {
        throw new Error(error?.message ?? "Cyclist not found.");
      }

      return {
        id: cyclist.id as string,
        fullName: cyclist.full_name as string,
        phoneNumber: cyclist.phone_number as string,
        isActive: Boolean(cyclist.is_active),
      };
    } catch (error) {
      console.error("getCyclistByPhone failed:", error);
      throw new Error("Cyclist account not found.");
    }
  });

export const getCyclistDashboardData = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistDashboardInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id, full_name, phone_number, is_active")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const { data: coverageRows, error: coverageError } = await (supabaseAdmin as any)
        .from("cyclist_coverage")
        .select("cyclist_id, neighborhood_id")
        .eq("cyclist_id", cyclist.id);

      if (coverageError) {
        throw new Error(coverageError.message);
      }

      const coverageNeighborhoodIds = Array.from(
        new Set(((coverageRows ?? []) as CyclistCoverageRow[]).map((row) => row.neighborhood_id)),
      );

      const [
        availableResult,
        assignedReadyResult,
        activeResult,
        deliveredResult,
        pendingSettlementResult,
        visibilityRowsResult,
      ] = await Promise.all([
        coverageNeighborhoodIds.length
          ? (supabaseAdmin as any)
              .from("orders")
              .select(
                "id, customer_user_id, subscription_id, order_category, customer_name, customer_phone, cash_to_collect_from_customer, delivery_notes, payment_method, delivery_fee, total_price, status, order_items, neighborhood_id, delivery_auth_code, created_at",
              )
              .eq("status", "ready")
              .in("neighborhood_id", coverageNeighborhoodIds)
              .is("cyclist_id", null)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        (supabaseAdmin as any)
          .from("orders")
          .select(
            "id, customer_user_id, subscription_id, order_category, customer_name, customer_phone, cash_to_collect_from_customer, delivery_notes, payment_method, delivery_fee, total_price, status, order_items, neighborhood_id, delivery_auth_code, created_at",
          )
          .eq("status", "ready")
          .eq("cyclist_id", cyclist.id)
          .order("created_at", { ascending: false }),
        (supabaseAdmin as any)
          .from("orders")
          .select(
            "id, customer_user_id, subscription_id, order_category, customer_name, customer_phone, cash_to_collect_from_customer, delivery_notes, payment_method, delivery_fee, total_price, status, order_items, neighborhood_id, delivery_auth_code, created_at",
          )
          .in("status", ["in_delivery"])
          .eq("cyclist_id", cyclist.id)
          .order("created_at", { ascending: false }),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, delivery_fee")
          .in("status", ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"])
          .eq("cyclist_id", cyclist.id),
        (supabaseAdmin as any)
          .from("orders")
          .select("vendor_id, payment_method, total_price")
          .eq("cyclist_id", cyclist.id)
          .eq("status", "delivered_cash_with_cyclist")
          .eq("vendor_settlement_status", "pending"),
        coverageNeighborhoodIds.length
          ? (supabaseAdmin as any)
              .from("orders")
              .select("status, cyclist_id, order_category")
              .in("neighborhood_id", coverageNeighborhoodIds)
              .order("created_at", { ascending: false })
              .limit(600)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const availableRows = availableResult.data;
      const availableError = availableResult.error;
      const assignedReadyRows = assignedReadyResult.data;
      const assignedReadyError = assignedReadyResult.error;
      const activeRows = activeResult.data;
      const activeError = activeResult.error;
      const deliveredRows = deliveredResult.data;
      const deliveredError = deliveredResult.error;
      const pendingSettlementRows = pendingSettlementResult.data;
      const pendingSettlementError = pendingSettlementResult.error;
      const visibilityRows = visibilityRowsResult.data;
      const visibilityRowsError = visibilityRowsResult.error;

      if (availableError) {
        throw new Error(availableError.message);
      }
      if (assignedReadyError) {
        throw new Error(assignedReadyError.message);
      }
      if (activeError) {
        throw new Error(activeError.message);
      }
      if (deliveredError) {
        throw new Error(deliveredError.message);
      }
      if (pendingSettlementError) {
        throw new Error(pendingSettlementError.message);
      }
      if (visibilityRowsError) {
        throw new Error(visibilityRowsError.message);
      }

      const lifecycleStatusesVisibleToCyclist = new Set([
        "ready",
        "in_delivery",
        "delivered",
        "delivered_cash_with_cyclist",
        "cash_transferred_to_vendor",
      ]);

      let assignedToOtherCyclistCount = 0;
      let unsupportedStatusCount = 0;
      const unsupportedStatusCounts = new Map<string, number>();
      for (const row of (visibilityRows ?? []) as Array<{
        status?: string | null;
        cyclist_id?: string | null;
        order_category?: string | null;
      }>) {
        const orderCategory = String(row.order_category ?? "").trim().toUpperCase();
        if (orderCategory === "PLATFORM_SUBSCRIPTION") {
          continue;
        }

        const normalizedStatus = String(row.status ?? "").trim().toLowerCase();
        const assignedCyclistId = row.cyclist_id ? String(row.cyclist_id).trim() : "";

        if (normalizedStatus === "ready" && assignedCyclistId && assignedCyclistId !== cyclist.id) {
          assignedToOtherCyclistCount += 1;
          continue;
        }

        if (!lifecycleStatusesVisibleToCyclist.has(normalizedStatus)) {
          unsupportedStatusCount += 1;
          unsupportedStatusCounts.set(normalizedStatus, (unsupportedStatusCounts.get(normalizedStatus) ?? 0) + 1);
        }
      }

      const pendingRows = (pendingSettlementRows ?? []) as Array<{
        vendor_id: string;
        payment_method: string;
        total_price: number;
      }>;

      const pendingCashRows = pendingRows.filter((row) => String(row.payment_method).toUpperCase() === "COD");
      const pendingVendorIds = Array.from(new Set(pendingCashRows.map((row) => row.vendor_id)));
      const { data: pendingVendors, error: pendingVendorsError } = pendingVendorIds.length
        ? await (supabaseAdmin as any).from("vendors").select("id, store_name").in("id", pendingVendorIds)
        : { data: [], error: null };

      if (pendingVendorsError) {
        throw new Error(pendingVendorsError.message);
      }

      const vendorNameMap = new Map(
        ((pendingVendors ?? []) as Array<{ id: string; store_name: string | null }>).map((vendor) => [
          vendor.id,
          vendor.store_name?.trim() || "Vendor",
        ]),
      );

      const pendingSettlementsMap = new Map<string, CyclistPendingSettlement>();
      for (const row of pendingCashRows) {
        const current = pendingSettlementsMap.get(row.vendor_id);
        if (current) {
          current.ordersCount += 1;
          current.cashToHandoverMad += Number(row.total_price ?? 0);
        } else {
          pendingSettlementsMap.set(row.vendor_id, {
            vendorId: row.vendor_id,
            vendorName: vendorNameMap.get(row.vendor_id) ?? "Vendor",
            ordersCount: 1,
            cashToHandoverMad: Number(row.total_price ?? 0),
          });
        }
      }

      const pendingSettlements = Array.from(pendingSettlementsMap.values()).sort((a, b) => b.cashToHandoverMad - a.cashToHandoverMad);

      const activeOrderRows = (activeRows ?? []) as OrderRow[];
      const shouldLockAvailableRuns = activeOrderRows.length > 0;
      const combinedAvailableRows = [
        ...((availableRows ?? []) as OrderRow[]),
        ...((assignedReadyRows ?? []) as OrderRow[]),
      ];
      const dedupedAvailableRows = Array.from(new Map(combinedAvailableRows.map((row) => [row.id, row])).values());
      const safeAvailableRows = shouldLockAvailableRuns ? [] : dedupedAvailableRows;

      const allRows = [...safeAvailableRows, ...activeOrderRows];
      const uniquePhones = Array.from(new Set(allRows.map((row) => row.customer_phone).filter(Boolean)));

      const { data: customers, error: customersError } = uniquePhones.length
        ? await (supabaseAdmin as any)
            .from("customers")
            .select("phone_number, saved_instructions")
            .in("phone_number", uniquePhones)
        : { data: [], error: null };

      const uniqueCustomerUserIds = Array.from(
        new Set(allRows.map((row) => row.customer_user_id).filter((value): value is string => Boolean(value))),
      );

      const { data: profiles, error: profilesError } = uniqueCustomerUserIds.length
        ? await (supabaseAdmin as any).from("profiles").select("id, address").in("id", uniqueCustomerUserIds)
        : { data: [], error: null };

      const uniqueSubscriptionIds = Array.from(
        new Set(
          allRows
            .map((row) => row.subscription_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );

      const { data: subscriptions, error: subscriptionsError } = uniqueSubscriptionIds.length
        ? await (supabaseAdmin as any)
            .from("platform_subscriptions")
            .select("id, contact_phone, delivery_address, pack_quantity")
            .in("id", uniqueSubscriptionIds)
        : { data: [], error: null };

      if (customersError) {
        throw new Error(customersError.message);
      }
      if (profilesError) {
        throw new Error(profilesError.message);
      }
      if (subscriptionsError) {
        throw new Error(subscriptionsError.message);
      }

      const { neighborhoodMap, communeMap } = await buildServiceZoneMaps();
      const customerInstructionMap = new Map(
        ((customers ?? []) as CustomerRow[]).map((customer) => [customer.phone_number, customer.saved_instructions]),
      );
      const profileAddressMap = new Map(
        ((profiles ?? []) as Array<{ id: string; address?: string | null }>).map((profile) => [
          profile.id,
          typeof profile.address === "string" ? profile.address.trim() : "",
        ]),
      );
      const subscriptionMetaMap = new Map(
        (
          (subscriptions ?? []) as Array<{
            id: string;
            contact_phone?: string | null;
            delivery_address?: string | null;
            pack_quantity?: number | null;
          }>
        ).map((subscription) => [
          subscription.id,
          {
            contactPhone: typeof subscription.contact_phone === "string" ? subscription.contact_phone.trim() : "",
            deliveryAddress:
              typeof subscription.delivery_address === "string" ? subscription.delivery_address.trim() : "",
            packQuantity: Number(subscription.pack_quantity ?? 1),
          },
        ]),
      );

      const mapOrder = (row: OrderRow): CyclistOrderCard => {
        const orderCategory =
          String(row.order_category ?? "").trim().toUpperCase() === "PLATFORM_SUBSCRIPTION"
            ? "PLATFORM_SUBSCRIPTION"
            : "MARKETPLACE";
        const subscriptionMeta =
          typeof row.subscription_id === "string" && row.subscription_id.length > 0
            ? subscriptionMetaMap.get(row.subscription_id)
            : null;
        const neighborhood = neighborhoodMap.get(row.neighborhood_id);
        const neighborhoodName =
          neighborhood?.name_ar?.trim() || neighborhood?.name_fr?.trim() || neighborhood?.name_en || "Unspecified";
        const communeName = neighborhood?.commune_id ? communeMap.get(neighborhood.commune_id) ?? "" : "";
        const deliveryZone = communeName ? `${communeName} / ${neighborhoodName}` : neighborhoodName;
        const savedInstructions = customerInstructionMap.get(row.customer_phone) ?? "";
        const checkoutAddress =
          typeof row.customer_user_id === "string" ? (profileAddressMap.get(row.customer_user_id) ?? "") : "";
        const deliveryAddress =
          subscriptionMeta?.deliveryAddress || checkoutAddress || neighborhoodName;
        const deliveryInstructions = (row.delivery_notes ?? "").trim();
        const items = Array.isArray(row.order_items)
          ? row.order_items.map((item) => {
              const quantity = Number(item?.quantity ?? 1);
              const unitPriceMad = Number(item?.unitPriceMad ?? 0);
              return {
                name: typeof item?.name === "string" && item.name.trim().length > 0 ? item.name.trim() : "Product",
                quantity,
                unitPriceMad,
                selectedVariant:
                  typeof item?.selectedVariant === "string" && item.selectedVariant.trim().length > 0
                    ? item.selectedVariant.trim()
                    : null,
                imageUrl: null,
                lineTotalMad: quantity * unitPriceMad,
                brandName:
                  typeof item?.brand_name === "string" && item.brand_name.trim().length > 0
                    ? item.brand_name.trim()
                    : typeof item?.brandName === "string" && item.brandName.trim().length > 0
                      ? item.brandName.trim()
                      : null,
                measurementValue:
                  item?.measurement_value !== undefined && item?.measurement_value !== null
                    ? String(item.measurement_value).trim() || null
                    : item?.measurementValue !== undefined && item?.measurementValue !== null
                      ? String(item.measurementValue).trim() || null
                      : null,
                measurementUnit:
                  typeof item?.measurement_unit === "string" && item.measurement_unit.trim().length > 0
                    ? item.measurement_unit.trim()
                    : typeof item?.measurementUnit === "string" && item.measurementUnit.trim().length > 0
                      ? item.measurementUnit.trim()
                      : null,
              };
            })
          : [];

        return {
          id: row.id,
          subscriptionId:
            typeof row.subscription_id === "string" && row.subscription_id.length > 0 ? row.subscription_id : null,
          orderCategory,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          contactPhone: subscriptionMeta?.contactPhone || row.customer_phone,
          deliveryAddress,
          deliveryInstructions,
          deliveryZone,
          douar: neighborhoodName,
          deliveryFeeMad: Number(row.delivery_fee ?? 0),
          totalMad: Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0),
          cashToCollectMad: Number(row.cash_to_collect_from_customer ?? 0),
          paymentMethod: row.payment_method === "Carnet" ? "Carnet" : "COD",
          packQuantity: Math.max(1, Math.floor(subscriptionMeta?.packQuantity ?? 1)),
          items,
          savedInstructions,
          deliveryNotes: row.delivery_notes,
          deliveryAuthCode: row.delivery_auth_code,
          createdAt: row.created_at,
        };
      };

      const totalCashCollectedMad = ((deliveredRows ?? []) as Array<{ total_price: number; delivery_fee: number }>).reduce(
        (sum, row) => sum + Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0),
        0,
      );

      return {
        cyclist: {
          id: cyclist.id as string,
          fullName: cyclist.full_name as string,
          phoneNumber: cyclist.phone_number as string,
          isActive: Boolean(cyclist.is_active),
          coverageNeighborhoodIds,
        },
        availableRuns: safeAvailableRows.map(mapOrder),
        activeDeliveries: activeOrderRows.map(mapOrder),
        pendingSettlements,
        visibilityHints: {
          assignedToOtherCyclistCount,
          unsupportedStatusCount,
          unsupportedStatuses: Array.from(unsupportedStatusCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => ({ status, count })),
        },
        totalCashCollectedMad,
      };
    } catch (error) {
      console.error("getCyclistDashboardData failed:", error);
      throw new Error("Failed to load cyclist dashboard.");
    }
  });

export const setCyclistActiveState = createServerFn({ method: "POST" })
  .inputValidator((input) => setCyclistActiveStateInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any)
        .from("cyclists")
        .update({ is_active: data.isActive })
        .eq("id", data.cyclistId);

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true, isActive: data.isActive };
    } catch (error) {
      console.error("setCyclistActiveState failed:", error);
      throw new Error("Failed to update cyclist status.");
    }
  });

export const acceptDeliveryRun = createServerFn({ method: "POST" })
  .inputValidator((input) => acceptDeliveryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { count: activeOrderCount, error: activeOrderCountError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("cyclist_id", data.cyclistId)
        .in("status", ["ready", "in_delivery"]);

      if (activeOrderCountError) {
        throw new Error(activeOrderCountError.message);
      }

      if ((activeOrderCount ?? 0) > 0) {
        throw new Error("You must finish your current delivery first.");
      }

      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const { data: coverageRows, error: coverageError } = await (supabaseAdmin as any)
        .from("cyclist_coverage")
        .select("neighborhood_id")
        .eq("cyclist_id", cyclist.id);

      if (coverageError) {
        throw new Error(coverageError.message);
      }

      const coverageNeighborhoodIds = Array.from(
        new Set(((coverageRows ?? []) as Array<{ neighborhood_id: string }>).map((row) => row.neighborhood_id)),
      );

      if (coverageNeighborhoodIds.length === 0) {
        throw new Error("No coverage areas assigned to this cyclist.");
      }

      const { error } = await (supabaseAdmin as any)
        .from("orders")
        .update({ cyclist_id: cyclist.id, status: "in_delivery" })
        .eq("id", data.orderId)
        .eq("status", "ready")
        .in("neighborhood_id", coverageNeighborhoodIds)
        .is("cyclist_id", null);

      if (error) {
        throw new Error(error.message);
      }

      const { data: acceptedOrder, error: acceptedOrderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id")
        .eq("id", data.orderId)
        .eq("cyclist_id", cyclist.id)
        .eq("status", "in_delivery")
        .maybeSingle();

      if (acceptedOrderError) {
        throw new Error(acceptedOrderError.message);
      }

      if (!acceptedOrder?.id) {
        throw new Error("Delivery was already accepted by another cyclist.");
      }

      void processPendingOrderPushEvents(20).catch((pushQueueError) => {
        console.error("Push queue processing after cyclist accept failed:", pushQueueError);
      });

      return { ok: true };
    } catch (error) {
      console.error("acceptDeliveryRun failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to accept delivery.");
    }
  });

export const getCyclistWalletSummary = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistWalletInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id, full_name")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const { data: deliveredRows, error: deliveredError } = await (supabaseAdmin as any)
        .from("orders")
        .select("delivery_fee")
        .eq("cyclist_id", data.cyclistId)
        .in("status", ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"]);

      if (deliveredError) {
        throw new Error(deliveredError.message);
      }

      const { data: pendingSettlementRows, error: pendingSettlementError } = await (supabaseAdmin as any)
        .from("orders")
        .select("delivery_fee, total_price, payment_method")
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered_cash_with_cyclist")
        .eq("vendor_settlement_status", "pending");

      if (pendingSettlementError) {
        throw new Error(pendingSettlementError.message);
      }

      const lifetimeRows = (deliveredRows ?? []) as Array<{
        delivery_fee: number;
      }>;

      const pendingRows = (pendingSettlementRows ?? []) as Array<{
        total_price: number;
        delivery_fee: number;
        payment_method: string;
      }>;

      const isCashPayment = (paymentMethod: string | null | undefined) => {
        const normalized = String(paymentMethod ?? "").trim().toLowerCase();
        return normalized === "cash" || normalized === "cod";
      };

      const isCreditPayment = (paymentMethod: string | null | undefined) => {
        const normalized = String(paymentMethod ?? "").trim().toLowerCase();
        return normalized === "credit" || normalized === "carnet";
      };

      const myEarningsMad = lifetimeRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0);
      const pendingCashRows = pendingRows.filter((row) => isCashPayment(row.payment_method));
      const pendingCreditRows = pendingRows.filter((row) => isCreditPayment(row.payment_method));

      const pendingEarningsMad = pendingCashRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0);
      const cashToRemitMad = pendingCashRows.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);
      const owedByVendorMad = pendingCreditRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0);
      const netCashToHandoverMad = cashToRemitMad - owedByVendorMad;

      return {
        cyclist: {
          id: cyclist.id as string,
          fullName: cyclist.full_name as string,
        },
        myEarningsMad,
        pendingEarningsMad,
        cashToRemitMad,
        owedByVendorMad,
        netCashToHandoverMad,
        pendingSettlementOrdersCount: pendingRows.length,
        pendingCashSettlementOrdersCount: pendingCashRows.length,
        pendingCarnetSettlementOrdersCount: pendingCreditRows.length,
      } satisfies CyclistWalletSummary;
    } catch (error) {
      console.error("getCyclistWalletSummary failed:", error);
      throw new Error("Failed to load cyclist wallet summary.");
    }
  });

export const getCyclistEarningsHistory = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistEarningsHistoryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const now = new Date();
      const start = new Date(now);

      if (data.period === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (data.period === "week") {
        start.setHours(0, 0, 0, 0);
        const currentDay = start.getDay();
        const diffToMonday = (currentDay + 6) % 7;
        start.setDate(start.getDate() - diffToMonday);
      } else {
        start.setHours(0, 0, 0, 0);
        start.setDate(1);
      }

      const { data: rows, error } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, delivered_at, delivery_fee")
        .eq("cyclist_id", data.cyclistId)
        .in("status", ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"])
        .gte("delivered_at", start.toISOString())
        .order("delivered_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      void processPendingOrderPushEvents(20).catch((pushQueueError) => {
        console.error("Push queue processing after delivery completion failed:", pushQueueError);
      });

      const deliveries = ((rows ?? []) as Array<{ id: string; delivered_at: string | null; delivery_fee: number }>).map(
        (row) => ({
          orderId: row.id,
          deliveredAt: row.delivered_at ?? new Date(0).toISOString(),
          deliveryFeeMad: Number(row.delivery_fee ?? 0),
        }),
      );

      const totalEarningsMad = deliveries.reduce((sum, row) => sum + row.deliveryFeeMad, 0);

      return {
        period: data.period,
        totalEarningsMad,
        deliveries,
      } satisfies CyclistEarningsHistoryResponse;
    } catch (error) {
      console.error("getCyclistEarningsHistory failed:", error);
      throw new Error("Failed to load cyclist earnings history.");
    }
  });

export const markDeliveryAsDelivered = createServerFn({ method: "POST" })
  .inputValidator((input) => markDeliveredInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: rpcResult, error } = await (supabaseAdmin as any).rpc("complete_delivery_and_apply_payment", {
        p_cyclist_id: data.cyclistId,
        p_order_id: data.orderId,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!Array.isArray(rpcResult) || !rpcResult[0]?.order_id) {
        throw new Error("Delivery not found or already completed.");
      }

      const deliveredOrderId = String(rpcResult[0].order_id);
      const { data: deliveredOrder } = await (supabaseAdmin as any)
        .from("orders")
        .select("customer_user_id")
        .eq("id", deliveredOrderId)
        .maybeSingle();

      if (typeof deliveredOrder?.customer_user_id === "string" && deliveredOrder.customer_user_id.length > 0) {
        await evaluateCustomerBehavior(deliveredOrder.customer_user_id);
      }

      return { ok: true };
    } catch (error) {
      console.error("markDeliveryAsDelivered failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to complete delivery.");
    }
  });

export const completeCustomerDeliveryByOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => completeCustomerDeliveryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: order, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, cyclist_id, status, payment_method, order_category, subscription_id, customer_user_id")
        .eq("id", data.orderId)
        .eq("cyclist_id", data.cyclistId)
        .in("status", ["in_delivery"])
        .maybeSingle();

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!order?.id) {
        throw new Error("Order is not an active delivery for this cyclist.");
      }

      const isPlatformSubscriptionOrder =
        String(order.order_category ?? "").trim().toUpperCase() === "PLATFORM_SUBSCRIPTION";
      const normalizedMethod = String(order.payment_method ?? "").trim().toLowerCase();
      const nextStatus =
        isPlatformSubscriptionOrder || (!(normalizedMethod === "cod" || normalizedMethod === "cash"))
          ? "delivered"
          : "delivered_cash_with_cyclist";

      const { error } = await (supabaseAdmin as any)
        .from("orders")
        .update({
          status: nextStatus,
          vendor_settlement_status: nextStatus === "delivered_cash_with_cyclist" ? "pending" : "settled",
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.orderId)
        .eq("cyclist_id", data.cyclistId)
        .in("status", ["in_delivery"]);

      if (error) {
        throw new Error(error.message);
      }

      if (typeof order.customer_user_id === "string" && order.customer_user_id.length > 0) {
        void evaluateCustomerBehavior(order.customer_user_id).catch((behaviorError) => {
          console.error("Customer behavior evaluation after delivery failed:", behaviorError);
        });
      }

      if (isPlatformSubscriptionOrder && typeof order.subscription_id === "string" && order.subscription_id.length > 0) {
        const { data: subscriptionRow, error: progressError } = await (supabaseAdmin as any)
          .from("platform_subscriptions")
          .select("id, total_deliveries, completed_deliveries")
          .eq("id", order.subscription_id)
          .single();

        if (progressError) {
          throw new Error(progressError.message ?? "Failed to sync subscription progress.");
        }

        const totalDeliveries = Number(subscriptionRow?.total_deliveries ?? 0);
        const completedDeliveries = Number(subscriptionRow?.completed_deliveries ?? 0);
        const nextCompleted = completedDeliveries + 1;
        const isCycleComplete = totalDeliveries > 0 && nextCompleted >= totalDeliveries;

        const { error: subscriptionProgressError } = await (supabaseAdmin as any)
          .from("platform_subscriptions")
          .update({
            completed_deliveries: nextCompleted,
            deliveries_completed: nextCompleted,
            status: isCycleComplete ? "completed" : "active",
          })
          .eq("id", order.subscription_id);

        if (subscriptionProgressError) {
          throw new Error(subscriptionProgressError.message ?? "Failed to update subscription completion progress.");
        }
      }

      return { ok: true, nextStatus };
    } catch (error) {
      console.error("completeCustomerDeliveryByOrder failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to complete customer delivery.");
    }
  });

export const settleVendorCashHandover = createServerFn({ method: "POST" })
  .inputValidator((input) => settleVendorHandoverInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: pendingRows, error: pendingError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, total_price, customer_user_id")
        .eq("cyclist_id", data.cyclistId)
        .eq("vendor_id", data.vendorId)
        .eq("status", "delivered_cash_with_cyclist");

      if (pendingError) {
        throw new Error(pendingError.message);
      }

      const rows = (pendingRows ?? []) as Array<{ id: string; total_price: number; customer_user_id: string | null }>;
      if (rows.length === 0) {
        return { settledOrdersCount: 0, settledCashMad: 0 };
      }

      const orderIds = rows.map((row) => row.id);
      const settledCashMad = rows.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);

      const { error: updateError } = await (supabaseAdmin as any)
        .from("orders")
        .update({
          status: "cash_transferred_to_vendor",
          vendor_settlement_status: "settled",
          updated_at: new Date().toISOString(),
        })
        .in("id", orderIds)
        .eq("cyclist_id", data.cyclistId)
        .eq("vendor_id", data.vendorId)
        .eq("status", "delivered_cash_with_cyclist");

      if (updateError) {
        throw new Error(updateError.message);
      }

      await evaluateCustomersBehavior(rows.map((row) => String(row.customer_user_id ?? "")));

      return {
        settledOrdersCount: orderIds.length,
        settledCashMad,
      };
    } catch (error) {
      console.error("settleVendorCashHandover failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to settle cash handover.");
    }
  });

export const cancelActiveDeliveryByOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => cancelActiveDeliveryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: order, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, cyclist_id, status, customer_user_id")
        .eq("id", data.orderId)
        .eq("cyclist_id", data.cyclistId)
        .in("status", ["in_delivery"])
        .maybeSingle();

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!order?.id) {
        throw new Error("Order is not an active delivery for this cyclist.");
      }

      const nowIso = new Date().toISOString();
      const { error: cancelError } = await (supabaseAdmin as any)
        .from("orders")
        .update({
          status: "cancelled",
          cyclist_id: null,
          updated_at: nowIso,
        })
        .eq("id", data.orderId)
        .eq("cyclist_id", data.cyclistId)
        .in("status", ["in_delivery"]);

      if (cancelError) {
        throw new Error(cancelError.message);
      }

      if (typeof order.customer_user_id === "string" && order.customer_user_id.length > 0) {
        const { data: existingProfile, error: existingProfileError } = await (supabaseAdmin as any)
          .from("profiles")
          .select("id, strikes, cod_rejections, fake_orders, cancelled_orders")
          .eq("id", order.customer_user_id)
          .maybeSingle();

        if (existingProfileError) {
          throw new Error(existingProfileError.message);
        }

        if (!existingProfile?.id) {
          const { error: createProfileError } = await (supabaseAdmin as any)
            .from("profiles")
            .insert({ id: order.customer_user_id })
            .select("id, strikes, cod_rejections, fake_orders, cancelled_orders")
            .single();

          if (createProfileError) {
            throw new Error(createProfileError.message);
          }
        }

        const baseStrikes = Number(existingProfile?.strikes ?? 0);
        const baseCancelledOrders = Number(existingProfile?.cancelled_orders ?? 0);
        const baseCodRejections = Number(existingProfile?.cod_rejections ?? 0);
        const baseFakeOrders = Number(existingProfile?.fake_orders ?? 0);

        const nextPatch: Record<string, unknown> = {
          strikes: baseStrikes + 1,
          cancelled_orders: baseCancelledOrders + 1,
          cod_rejections: baseCodRejections,
          fake_orders: baseFakeOrders,
          updated_at: nowIso,
        };

        if (data.reason === "cod_rejection") {
          nextPatch.cod_rejections = baseCodRejections + 1;
        }

        if (data.reason === "fake_order") {
          nextPatch.fake_orders = baseFakeOrders + 1;
        }

        const { error: profileError } = await (supabaseAdmin as any)
          .from("profiles")
          .update(nextPatch)
          .eq("id", order.customer_user_id);

        if (profileError) {
          throw new Error(profileError.message);
        }

        await evaluateCustomerBehavior(order.customer_user_id);
      }

      void processPendingOrderPushEvents(20).catch((pushQueueError) => {
        console.error("Push queue processing after cyclist cancellation failed:", pushQueueError);
      });

      return { ok: true };
    } catch (error) {
      console.error("cancelActiveDeliveryByOrder failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to cancel active delivery.");
    }
  });
