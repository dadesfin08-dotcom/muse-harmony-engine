import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  formatMoroccoPhoneForPayload,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import type { AppLanguage } from "@/lib/i18n";
import { getLocalizedValue, localizeText, resolveAppLanguage } from "@/lib/localization";
import { processPendingOrderPushEvents } from "@/lib/push-notifications.server";
import { evaluateCustomerBehavior } from "@/utils/customerAlgorithm";

const moroccoPhoneSchema = z
  .string()
  .trim()
  .transform((value) => formatMoroccoPhoneForPayload(normalizeMoroccoPhoneInput(value)))
  .refine((value) => /^\+212[0-9]{9}$/.test(value), {
    message: "Invalid phone number",
  });

const orderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  selectedVariant: z.string().trim().min(1).max(120).nullable().optional(),
  brandName: z.string().trim().min(1).max(160).nullable().optional(),
  measurementValue: z.number().positive().max(10_000).nullable().optional(),
  measurementUnit: z.string().trim().min(1).max(30).nullable().optional(),
  quantity: z.number().int().min(1).max(99),
  basePriceMad: z.number().min(0).max(100000).optional(),
  unitPriceMad: z.number().min(0).max(100000),
});

const createCustomerOrderInputSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerPhone: moroccoPhoneSchema,
  neighborhoodId: z.string().uuid(),
  deliveryNotes: z.string().max(600),
  paymentMethod: z.enum(["COD", "Carnet"]).default("COD"),
  deliveryFee: z.number().min(0).default(0),
  totalPrice: z.number().min(0),
  itemCount: z.number().int().min(1),
  items: z.array(orderItemSchema).min(1),
});

const createPlatformSubscriptionOrderInputSchema = z.object({
  packId: z.string().uuid(),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: moroccoPhoneSchema,
  contactPhone: moroccoPhoneSchema,
  deliveryAddress: z.string().trim().min(5).max(280),
  packQuantity: z.number().int().min(1).max(99).default(1),
  neighborhoodId: z.string().uuid(),
  deliveryNotes: z.string().trim().max(600).optional(),
  preferredStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredDeliveryTime: z.string().trim().min(1).max(80),
});

const vendorDashboardInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  locale: z.enum(["ar", "fr", "en"]).optional(),
});

const updateOrderStatusInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  orderId: z.string().uuid(),
  nextStatus: z.enum(["preparing", "ready"]),
});

const upsertCustomerProfileInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  fullName: z.string().trim().min(1).max(120),
  address: z.string().trim().max(220),
  savedInstructions: z.string().trim().max(600).optional(),
  neighborhoodId: z.string().uuid().nullable(),
});

const getCustomerOrdersInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
});

const getCustomerSubscriptionsInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
});

const updateCustomerSubscriptionStatusInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  subscriptionId: z.string().uuid(),
  status: z.enum(["active", "paused"]),
});

const vendorSettlementSummaryInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
});

const vendorOrderDetailsInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  orderId: z.string().uuid(),
  locale: z.enum(["ar", "fr", "en"]).optional(),
});

const customerOrderDetailsInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  orderId: z.string().uuid(),
});

const settleCyclistCashHandoverInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  cyclistId: z.string().uuid(),
  expectedAmount: z.number(),
});

type VendorRow = {
  id: string;
  store_name: string;
  phone_number?: string;
  total_cash_received?: number | null;
  vendor_earnings?: number | null;
};

type OrderRow = {
  id: string;
  vendor_id: string;
  customer_user_id?: string | null;
  cyclist_id?: string | null;
  specific_address?: string | null;
  neighborhood_id?: string | null;
  neighborhood_name?: string | null;
  commune_name?: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_notes: string;
  payment_method: "COD" | "Carnet";
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "picked_up"
    | "in_transit"
    | "in_delivery"
    | "delivered"
    | "delivered_cash_with_cyclist"
    | "cash_transferred_to_vendor";
  delivery_auth_code: string;
  delivery_fee: number;
  total_price: number;
  vendor_revenue?: number;
  platform_profit?: number;
  platform_markup?: number;
  subtotal_base_price?: number;
  item_count: number;
  order_items: Array<{
    name: string;
    quantity: number;
    unitPriceMad: number;
      selectedVariant?: string | null;
    imageUrl?: string | null;
    brandName?: string | null;
    measurementValue?: number | null;
    measurementUnit?: string | null;
  }>;
  cyclist?: {
    id: string;
    name: string;
    phoneNumber: string;
    avatarUrl?: string | null;
  } | null;
  vendor_settlement_status?: "pending" | "settled";
  created_at: string;
};

export type CustomerOrderRow = OrderRow;

export type VendorSettlementSummary = {
  totalCashInHandMad: number;
  myNetProfitMad: number;
  platformDuesMad: number;
  unsettledCashWithCyclistsMad: number;
  owedToCyclistMad: number;
  totalReceivedTodayMad: number;
  lifetimeEarningsMad: number;
  pendingCyclistCount: number;
};

function roundMoney(value: number) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function localizeDbName(
  language: AppLanguage,
  row: { name_ar?: string | null; name_fr?: string | null; name_en?: string | null } | null | undefined,
): string {
  if (!row) return "";

  return localizeText(language, {
    ar: row.name_ar,
    fr: row.name_fr,
    en: row.name_en,
  });
}

async function getVendorPendingCommissionMad(vendorId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("platform_commission_ledger")
    .select("amount")
    .eq("vendor_id", vendorId);

  if (error) {
    throw new Error(error.message);
  }

  return roundMoney(
    ((data ?? []) as Array<{ amount: number | null }>).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    ),
  );
}

export type VendorOrderDetails = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  specialInstructions: string;
  paymentMethod: "COD" | "Carnet";
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "in_delivery"
    | "delivered"
    | "delivered_cash_with_cyclist"
    | "cash_transferred_to_vendor";
  createdAt: string;
  deliveryFeeMad: number;
  subtotalMad: number;
  grandTotalMad: number;
  items: Array<{
    productName: string;
    selectedVariant?: string | null;
    quantity: number;
    unitPriceMad: number;
    lineTotalMad: number;
  }>;
};

export type CustomerOrderDetails = {
  id: string;
  paymentMethod: "COD" | "Carnet";
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "in_delivery"
    | "delivered"
    | "delivered_cash_with_cyclist"
    | "cash_transferred_to_vendor"
    | "cancelled";
  deliveryAuthCode: string | null;
  communeName: string;
  neighborhoodName: string;
  specialInstructions: string;
  createdAt: string;
  deliveryFeeMad: number;
  subtotalMad: number;
  grandTotalMad: number;
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceMad: number;
    lineTotalMad: number;
  }>;
};

async function resolveVendorByPhone(phoneNumber: string) {
  const normalizedInput = normalizeMoroccoPhoneInput(phoneNumber);
  const candidatePhones = Array.from(
    new Set([
      phoneNumber.trim(),
      formatMoroccoPhoneForPayload(normalizedInput),
      `0${normalizedInput}`,
      normalizedInput,
    ]).values(),
  ).filter((value) => value.length > 0);

  const { data: vendor, error } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, phone_number, total_cash_received, vendor_earnings, platform_dues")
    .in("phone_number", candidatePhones)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Vendor session is invalid.");
  }

  if (vendor?.id) {
    return vendor as VendorRow;
  }

  const { data: activeVendors, error: fallbackError } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, phone_number, total_cash_received, vendor_earnings, platform_dues")
    .eq("is_active", true);

  if (fallbackError) {
    throw new Error("Vendor session is invalid.");
  }

  const matchedVendor = ((activeVendors ?? []) as Array<VendorRow>).find((row) => {
    const normalizedVendorPhone = normalizeMoroccoPhoneInput(String(row.phone_number ?? ""));
    return normalizedVendorPhone.length > 0 && normalizedVendorPhone === normalizedInput;
  });

  if (!matchedVendor?.id) {
    throw new Error("Vendor session is invalid.");
  }

  return matchedVendor as VendorRow;
}

async function resolveVendorsForNeighborhood(neighborhoodId: string) {
  const { data: zoneRows, error: zonesError } = await (supabaseAdmin as any)
    .from("vendor_service_zones")
    .select("vendor_id")
    .eq("neighborhood_id", neighborhoodId);

  if (zonesError) {
    throw new Error(zonesError.message);
  }

  let vendorIds = ((zoneRows ?? []) as Array<{ vendor_id: string | null }>)
    .map((row) => row.vendor_id)
    .filter((value): value is string => Boolean(value));

  if (vendorIds.length === 0) {
    const { data: neighborhood, error: neighborhoodError } = await (supabaseAdmin as any)
      .from("neighborhoods")
      .select("vendor_id")
      .eq("id", neighborhoodId)
      .maybeSingle();

    if (neighborhoodError) {
      throw new Error(neighborhoodError.message);
    }

    const fallbackVendorId = (neighborhood as { vendor_id?: string | null } | null)?.vendor_id ?? null;
    vendorIds = fallbackVendorId ? [fallbackVendorId] : [];
  }

  if (vendorIds.length === 0) {
    return [] as Array<{ id: string }>;
  }

  const { data: vendors, error: vendorsError } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id")
    .in("id", vendorIds)
    .eq("is_active", true);

  if (vendorsError) {
    throw new Error(vendorsError.message);
  }

  return (vendors ?? []) as Array<{ id: string }>;
}

export const createCustomerOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => createCustomerOrderInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: existingProfile, error: profileLookupError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("phone", data.customerPhone)
        .maybeSingle();

      if (profileLookupError) {
        throw new Error(profileLookupError.message);
      }

      let customerUserId = (existingProfile as { id?: string } | null)?.id ?? null;

      if (!customerUserId) {
        const phoneSlug = data.customerPhone.replace(/\D/g, "");
        const syntheticEmail = `customer-${phoneSlug}@checkout.local`;
        const syntheticPassword = `${crypto.randomUUID()}A!1`;

        const { data: createdUserData, error: createUserError } = await (supabaseAdmin as any).auth.admin.createUser({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: {
            name: data.customerName,
            phone: data.customerPhone,
          },
        });

        if (createUserError) {
          const { data: listedUsers, error: listUsersError } = await (supabaseAdmin as any).auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

          if (listUsersError) {
            throw new Error(createUserError.message);
          }

          const existingUser = (listedUsers?.users ?? []).find(
            (user: { email?: string | null; id: string }) =>
              typeof user.email === "string" && user.email.toLowerCase() === syntheticEmail.toLowerCase(),
          );

          if (!existingUser?.id) {
            throw new Error(createUserError.message);
          }

          customerUserId = existingUser.id;
        } else {
          customerUserId = createdUserData?.user?.id ?? null;
        }

        if (!customerUserId) {
          throw new Error("Customer profile not found.");
        }

        const { error: profileUpsertError } = await (supabaseAdmin as any).from("profiles").upsert(
          {
            id: customerUserId,
            phone: data.customerPhone,
            full_name: data.customerName,
            display_name: data.customerName,
          },
          {
            onConflict: "id",
            ignoreDuplicates: false,
          },
        );

        if (profileUpsertError) {
          throw new Error(profileUpsertError.message);
        }
      }

      if (!customerUserId) {
        throw new Error("Customer profile not found.");
      }

      const activeVendors = await resolveVendorsForNeighborhood(data.neighborhoodId);
      if (activeVendors.length === 0) {
        throw new Error("No active vendor available in selected neighborhood.");
      }

      const vendorIds = new Set(activeVendors.map((vendor) => vendor.id));
      const itemsByVendor = new Map<
        string,
        Array<{
          productId?: string;
          vendorId?: string;
          name: string;
          selectedVariant?: string | null;
          brandName?: string | null;
          measurementValue?: number | null;
          measurementUnit?: string | null;
          quantity: number;
          basePriceMad?: number;
          unitPriceMad: number;
        }>
      >();

      for (const item of data.items) {
        const preferredVendorId = item.vendorId && vendorIds.has(item.vendorId) ? item.vendorId : null;
        const resolvedVendorId = preferredVendorId ?? activeVendors[0]!.id;
        const current = itemsByVendor.get(resolvedVendorId) ?? [];
        current.push(item);
        itemsByVendor.set(resolvedVendorId, current);
      }

      if (itemsByVendor.size === 0) {
        throw new Error("Order has no routable items.");
      }

      const insertedOrderIds: string[] = [];
      const vendorEntries = Array.from(itemsByVendor.entries());
      const vendorOrderBreakdown = vendorEntries.map(([vendorId, vendorItems]) => {
        const totalPrice = vendorItems.reduce((sum, item) => sum + Number(item.unitPriceMad ?? 0) * Number(item.quantity ?? 0), 0);
        const subtotalBasePrice = vendorItems.reduce(
          (sum, item) => sum + Number(item.basePriceMad ?? item.unitPriceMad ?? 0) * Number(item.quantity ?? 0),
          0,
        );
        const itemCount = vendorItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
        const deliveryFee = vendorEntries.length > 1 ? 0 : data.deliveryFee;
        const orderTotalWithDelivery = roundMoney(totalPrice + deliveryFee);

        return {
          vendorId,
          vendorItems,
          totalPrice,
          subtotalBasePrice,
          platformProfit: roundMoney(totalPrice - subtotalBasePrice),
          vendorRevenue: roundMoney(subtotalBasePrice),
          itemCount,
          deliveryFee,
          orderTotalWithDelivery,
        };
      });

      const carnetEligibilityByVendor = new Map<
        string,
        { vendorCarnetId: string; newDebt: number; maxLimit: number }
      >();

      if (data.paymentMethod === "Carnet") {
        for (const row of vendorOrderBreakdown) {
          const { data: carnetRow, error: carnetLookupError } = await (supabaseAdmin as any)
            .from("vendor_carnet")
            .select("id, current_debt, max_limit")
            .eq("vendor_id", row.vendorId)
            .eq("customer_phone", data.customerPhone)
            .maybeSingle();

          if (carnetLookupError) {
            throw new Error(carnetLookupError.message);
          }

          if (!carnetRow?.id) {
            throw new Error("Customer is not on trusted carnet list.");
          }

          const currentDebt = Number(carnetRow.current_debt ?? 0);
          const maxLimit = Number(carnetRow.max_limit ?? 0);
          const projectedDebt = roundMoney(currentDebt + row.orderTotalWithDelivery);

          if (projectedDebt > maxLimit) {
            throw new Error("This order would exceed your carnet limit.");
          }

          carnetEligibilityByVendor.set(row.vendorId, {
            vendorCarnetId: String(carnetRow.id),
            newDebt: projectedDebt,
            maxLimit,
          });
        }
      }

      for (const row of vendorOrderBreakdown) {
        const { data: inserted, error } = await (supabaseAdmin as any)
          .from("orders")
          .insert({
            customer_user_id: customerUserId,
            vendor_id: row.vendorId,
            customer_name: data.customerName,
            customer_phone: data.customerPhone,
            neighborhood_id: data.neighborhoodId,
            delivery_notes: data.deliveryNotes,
            payment_method: data.paymentMethod,
            status: "pending",
            delivery_fee: row.deliveryFee,
            subtotal_base_price: roundMoney(row.subtotalBasePrice),
            platform_profit: row.platformProfit,
            platform_markup: row.platformProfit,
            vendor_revenue: row.vendorRevenue,
            total_price: row.totalPrice,
            item_count: row.itemCount,
            order_items: row.vendorItems,
          })
          .select("id")
          .single();

        if (error || !inserted?.id) {
          throw new Error(error?.message ?? "Order insert failed.");
        }

        const insertedOrderId = String(inserted.id);
        insertedOrderIds.push(insertedOrderId);

        if (data.paymentMethod === "Carnet") {
          const carnetMeta = carnetEligibilityByVendor.get(row.vendorId);
          if (!carnetMeta) {
            throw new Error("Carnet eligibility check failed.");
          }

          const { error: updateCarnetDebtError } = await (supabaseAdmin as any)
            .from("vendor_carnet")
            .update({
              current_debt: carnetMeta.newDebt,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", carnetMeta.vendorCarnetId);

          if (updateCarnetDebtError) {
            throw new Error(updateCarnetDebtError.message);
          }

          const { error: ledgerInsertError } = await (supabaseAdmin as any).from("carnet_transactions").insert({
            vendor_id: row.vendorId,
            vendor_carnet_id: carnetMeta.vendorCarnetId,
            customer_phone: data.customerPhone,
            order_id: insertedOrderId,
            transaction_type: "CREDIT_ISSUED",
            amount: row.orderTotalWithDelivery,
            metadata: {
              source: "order_creation",
              status: "pending",
            },
          });

          if (ledgerInsertError) {
            throw new Error(ledgerInsertError.message);
          }
        }

      }

      void processPendingOrderPushEvents(30).catch((pushQueueError) => {
        console.error("Push queue processing after order creation failed:", pushQueueError);
      });

      return { id: insertedOrderIds[0] as string, orderIds: insertedOrderIds };
    } catch (error) {
      console.error("createCustomerOrder failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Order confirmation failed: ${message}`);
    }
  });

export const createPlatformSubscriptionOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => createPlatformSubscriptionOrderInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const [packResult] = await Promise.all([
        (supabaseAdmin as any)
          .from("platform_packs")
          .select("id, name_en, name_fr, name_ar, base_price_mad, billing_cycle, is_active")
          .eq("id", data.packId)
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      if (packResult.error) {
        throw new Error(packResult.error.message);
      }

      const pack = packResult.data as {
        id: string;
        name_en: string;
        name_fr: string | null;
        name_ar: string | null;
        base_price_mad: number;
        billing_cycle: "DAILY" | "WEEKLY" | "MONTHLY";
        is_active: boolean;
      } | null;

      if (!pack?.id || !pack.is_active) {
        throw new Error("Selected subscription pack is not available.");
      }

      const { data: existingProfile, error: profileLookupError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("phone", data.customerPhone)
        .maybeSingle();

      if (profileLookupError) {
        throw new Error(profileLookupError.message);
      }

      let customerUserId = (existingProfile as { id?: string } | null)?.id ?? null;

      if (!customerUserId) {
        const phoneSlug = data.customerPhone.replace(/\D/g, "");
        const syntheticEmail = `customer-${phoneSlug}@checkout.local`;
        const syntheticPassword = `${crypto.randomUUID()}A!1`;

        const { data: createdUserData, error: createUserError } = await (supabaseAdmin as any).auth.admin.createUser({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: {
            name: data.customerName,
            phone: data.customerPhone,
          },
        });

        if (createUserError) {
          const { data: listedUsers, error: listUsersError } = await (supabaseAdmin as any).auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

          if (listUsersError) {
            throw new Error(createUserError.message);
          }

          const existingUser = (listedUsers?.users ?? []).find(
            (user: { email?: string | null; id: string }) =>
              typeof user.email === "string" && user.email.toLowerCase() === syntheticEmail.toLowerCase(),
          );

          if (!existingUser?.id) {
            throw new Error(createUserError.message);
          }

          customerUserId = existingUser.id;
        } else {
          customerUserId = createdUserData?.user?.id ?? null;
        }
      }

      if (!customerUserId) {
        throw new Error("Customer profile not found.");
      }

      const { error: profileUpsertError } = await (supabaseAdmin as any).from("profiles").upsert(
        {
          id: customerUserId,
          phone: data.contactPhone,
          full_name: data.customerName,
          address: data.deliveryAddress,
          display_name: data.customerName,
          neighborhood_id: data.neighborhoodId,
        },
        {
          onConflict: "id",
          ignoreDuplicates: false,
        },
      );

      if (profileUpsertError) {
        throw new Error(profileUpsertError.message);
      }

      const { data: insertedSubscription, error: subscriptionError } = await (supabaseAdmin as any)
        .from("platform_subscriptions")
        .insert({
          customer_user_id: customerUserId,
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          contact_phone: data.contactPhone,
          delivery_address: data.deliveryAddress,
          pack_quantity: data.packQuantity,
          pack_id: pack.id,
          status: "pending",
          start_date: data.preferredStartDate,
          next_scheduled_delivery_date: data.preferredStartDate,
          deliveries_expected: 0,
          deliveries_completed: 0,
          completed_deliveries: 0,
          total_deliveries: null,
          agreed_price: null,
          lifetime_revenue_mad: 0,
          notes: `Preferred delivery time: ${data.preferredDeliveryTime}`,
        })
        .select("id")
        .single();

      if (subscriptionError || !insertedSubscription?.id) {
        throw new Error(subscriptionError?.message ?? "Failed to create subscription.");
      }

      return {
        subscriptionId: String(insertedSubscription.id),
      };
    } catch (error) {
      console.error("createPlatformSubscriptionOrder failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Subscription checkout failed: ${message}`);
    }
  });

export const getVendorDashboardData = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorDashboardInputSchema.parse(input))
  .handler(async ({ data }) => {
  try {
    let vendor: VendorRow;
    try {
      vendor = await resolveVendorByPhone(data.phoneNumber);
    } catch (error) {
      if (error instanceof Error && error.message === "Vendor session is invalid.") {
        return {
          vendor: {
            id: "",
            storeName: "Vendor Store",
          },
          orders: [] as Array<OrderRow>,
        };
      }
      throw error;
    }

    const { data: orders, error: ordersError } = await (supabaseAdmin as any)
      .from("orders")
      .select(
        "id, vendor_id, customer_user_id, cyclist_id, neighborhood_id, customer_name, customer_phone, delivery_notes, payment_method, status, delivery_auth_code, delivery_fee, total_price, subtotal_base_price, vendor_revenue, platform_profit, platform_markup, item_count, order_items, vendor_settlement_status, created_at",
      )
      .eq("vendor_id", vendor.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (ordersError) {
      throw new Error(ordersError.message);
    }

    const preferredLocale = resolveAppLanguage(data.locale);

    const orderItemNames = Array.from(
      new Set(
        (orders ?? []).flatMap((order: any) =>
          Array.isArray(order?.order_items)
            ? order.order_items
                .map((item: any) => (typeof item?.name === "string" ? item.name.trim() : null))
                .filter(Boolean)
            : [],
        ),
      ),
    ) as string[];

    const orderItemProductIds = Array.from(
      new Set(
        (orders ?? []).flatMap((order: any) =>
          Array.isArray(order?.order_items)
            ? order.order_items
                .map((item: any) => (typeof item?.productId === "string" ? item.productId.trim() : null))
                .filter(Boolean)
            : [],
        ),
      ),
    ) as string[];

    let productDetailsByName = new Map<
      string,
      {
        localizedName: string;
        imageUrl: string | null;
        category: string | null;
        brandName: string | null;
        measurementValue: number | null;
        measurementUnit: string | null;
      }
    >();
    let productDetailsById = new Map<
      string,
      {
        localizedName: string;
        imageUrl: string | null;
        category: string | null;
        brandName: string | null;
        measurementValue: number | null;
        measurementUnit: string | null;
      }
    >();
    if (orderItemNames.length > 0 || orderItemProductIds.length > 0) {
      const [productsByNameRes, productsByIdRes] = await Promise.all([
        orderItemNames.length > 0
          ? (supabaseAdmin as any)
              .from("master_products")
              .select("id, product_name, name_fr, name_ar, category, image_url, measurement_value, measurement_unit, brand_id")
              .in("product_name", orderItemNames)
          : Promise.resolve({ data: [], error: null }),
        orderItemProductIds.length > 0
          ? (supabaseAdmin as any)
              .from("master_products")
              .select("id, product_name, name_fr, name_ar, category, image_url, measurement_value, measurement_unit, brand_id")
              .in("id", orderItemProductIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (productsByNameRes.error) {
        throw new Error(productsByNameRes.error.message);
      }

      if (productsByIdRes.error) {
        throw new Error(productsByIdRes.error.message);
      }

      const products = [
        ...((productsByNameRes.data ?? []) as Array<any>),
        ...((productsByIdRes.data ?? []) as Array<any>),
      ];

      const brandIds = Array.from(
        new Set(
          products
            .map((product: any) => (typeof product?.brand_id === "string" ? product.brand_id : null))
            .filter((value: string | null): value is string => Boolean(value)),
        ),
      );

      const brandsQuery =
        brandIds.length > 0
          ? await (supabaseAdmin as any).from("brands").select("id, name_ar, name_fr, name_en").in("id", brandIds)
          : { data: [], error: null };

      if (brandsQuery.error) {
        throw new Error(brandsQuery.error.message);
      }

      const brandsById = new Map(
        ((brandsQuery.data ?? []) as Array<{ id: string; name_ar?: string | null; name_fr?: string | null; name_en?: string | null }>).map(
          (brand) => [brand.id, brand],
        ),
      );

      const toProductDetails = (product: any) => {
        const brand = typeof product?.brand_id === "string" ? brandsById.get(product.brand_id) : undefined;
        const brandName = localizeDbName(preferredLocale, brand);
        const localizedName = localizeText(
          preferredLocale,
          {
            ar: typeof product?.name_ar === "string" ? product.name_ar : null,
            fr: typeof product?.name_fr === "string" ? product.name_fr : null,
            en: typeof product?.product_name === "string" ? product.product_name : null,
          },
          typeof product?.product_name === "string" ? product.product_name : "",
        );

        return {
          localizedName,
          imageUrl: product.image_url ?? null,
          category: typeof product?.category === "string" ? product.category : null,
          brandName: brandName || null,
          measurementValue:
            typeof product?.measurement_value === "number"
              ? product.measurement_value
              : typeof product?.measurement_value === "string"
                ? Number(product.measurement_value)
                : null,
          measurementUnit:
            typeof product?.measurement_unit === "string" && product.measurement_unit.trim().length > 0
              ? product.measurement_unit.trim()
              : null,
        };
      };

      productDetailsByName = new Map(
        products
          .filter((product: any) => typeof product?.product_name === "string")
          .map((product: any) => [product.product_name.trim().toLowerCase(), toProductDetails(product)]),
      );

      productDetailsById = new Map(
        products
          .filter((product: any) => typeof product?.id === "string")
          .map((product: any) => [product.id, toProductDetails(product)]),
      );
    }

    const customerUserIds = Array.from(
      new Set(
        (orders ?? [])
          .map((order: any) => (typeof order?.customer_user_id === "string" ? order.customer_user_id : null))
          .filter((value: string | null): value is string => Boolean(value)),
      ),
    );

    const cyclistIds = Array.from(
      new Set(
        (orders ?? [])
          .map((order: any) => (typeof order?.cyclist_id === "string" ? order.cyclist_id : null))
          .filter((value: string | null): value is string => Boolean(value)),
      ),
    );

    const profilesQuery =
      customerUserIds.length > 0
        ? await (supabaseAdmin as any).from("profiles").select("id, address").in("id", customerUserIds)
        : { data: [], error: null };

    if (profilesQuery.error) {
      throw new Error(profilesQuery.error.message);
    }

    const cyclistsQuery =
      cyclistIds.length > 0
        ? await (supabaseAdmin as any)
            .from("cyclists")
            .select("id, user_id, full_name, phone_number")
            .in("id", cyclistIds)
        : { data: [], error: null };

    if (cyclistsQuery.error) {
      throw new Error(cyclistsQuery.error.message);
    }

    const cyclistUserIds = Array.from(
      new Set(
        ((cyclistsQuery.data ?? []) as Array<{ user_id?: string | null }>)
          .map((row) => (typeof row.user_id === "string" ? row.user_id : null))
          .filter((value: string | null): value is string => Boolean(value)),
      ),
    );

    const cyclistProfilesQuery =
      cyclistUserIds.length > 0
        ? await (supabaseAdmin as any).from("profiles").select("id, avatar_url").in("id", cyclistUserIds)
        : { data: [], error: null };

    if (cyclistProfilesQuery.error) {
      throw new Error(cyclistProfilesQuery.error.message);
    }

    const profileAddressById = new Map(
      ((profilesQuery.data ?? []) as Array<{ id: string; address?: string | null }>).map((row) => [
        row.id,
        typeof row.address === "string" ? row.address.trim() : null,
      ]),
    );

    const cyclistById = new Map(
      ((cyclistsQuery.data ?? []) as Array<{
        id: string;
        user_id?: string | null;
        full_name?: string | null;
        phone_number?: string | null;
      }>).map((row) => [row.id, row]),
    );

    const cyclistAvatarByUserId = new Map(
      ((cyclistProfilesQuery.data ?? []) as Array<{ id: string; avatar_url?: string | null }>).map((row) => [
        row.id,
        typeof row.avatar_url === "string" ? row.avatar_url : null,
      ]),
    );

    const neighborhoodIds = Array.from(
      new Set(
        (orders ?? [])
          .map((order: any) => (typeof order?.neighborhood_id === "string" ? order.neighborhood_id : null))
          .filter((value: string | null): value is string => Boolean(value)),
      ),
    );

    const neighborhoodsQuery =
      neighborhoodIds.length > 0
        ? await (supabaseAdmin as any)
            .from("neighborhoods")
            .select("id, commune_id, name_ar, name_fr, name_en")
            .in("id", neighborhoodIds)
        : { data: [], error: null };

    if (neighborhoodsQuery.error) {
      throw new Error(neighborhoodsQuery.error.message);
    }

    const communeIds = Array.from(
      new Set(
        ((neighborhoodsQuery.data ?? []) as Array<{ commune_id?: string | null }>)
          .map((row) => (typeof row?.commune_id === "string" ? row.commune_id : null))
          .filter((value: string | null): value is string => Boolean(value)),
      ),
    );

    const communesQuery =
      communeIds.length > 0
        ? await (supabaseAdmin as any)
            .from("communes")
            .select("id, name_ar, name_fr, name_en")
            .in("id", communeIds)
        : { data: [], error: null };

    if (communesQuery.error) {
      throw new Error(communesQuery.error.message);
    }

    const neighborhoodsById = new Map(
      ((neighborhoodsQuery.data ?? []) as Array<{
        id: string;
        commune_id?: string | null;
        name_ar?: string | null;
        name_fr?: string | null;
        name_en?: string | null;
      }>).map((row) => [row.id, row]),
    );

    const communesById = new Map(
      ((communesQuery.data ?? []) as Array<{ id: string; name_ar?: string | null; name_fr?: string | null; name_en?: string | null }>).map(
        (row) => [row.id, row],
      ),
    );

    const hydratedOrders = (orders ?? []).map((order: any) => {
      const items = Array.isArray(order?.order_items)
        ? order.order_items.map((item: any) => {
            const productDetailsByItemId =
              typeof item?.productId === "string" ? productDetailsById.get(item.productId.trim()) : undefined;
            const productDetailsByItemName =
              typeof item?.name === "string" ? productDetailsByName.get(item.name.trim().toLowerCase()) : undefined;
            const productDetails = productDetailsByItemId ?? productDetailsByItemName;
            const localizedName =
              productDetails?.localizedName || getLocalizedValue(item?.name, preferredLocale, "");
            const localizedVariant = getLocalizedValue(item?.selectedVariant, preferredLocale, "");
            const localizedItemBrand =
              productDetails?.brandName || getLocalizedValue(item?.brandName, preferredLocale, "");
            const localizedItemCategory =
              getLocalizedValue(item?.categoryName, preferredLocale, "") ||
              getLocalizedValue(item?.category, preferredLocale, "") ||
              productDetails?.category ||
              null;

            return {
              ...item,
              name: localizedName || (typeof item?.name === "string" ? item.name : ""),
              selectedVariant: localizedVariant || null,
              imageUrl: productDetails?.imageUrl ?? null,
              brandName: localizedItemBrand || null,
              categoryLabel: localizedItemCategory,
              measurementValue: productDetails?.measurementValue ?? null,
              measurementUnit: productDetails?.measurementUnit ?? null,
            };
          })
        : [];

      const neighborhoodRow =
        typeof order?.neighborhood_id === "string" ? neighborhoodsById.get(order.neighborhood_id) : undefined;
      const communeRow =
        neighborhoodRow && typeof neighborhoodRow.commune_id === "string"
          ? communesById.get(neighborhoodRow.commune_id)
          : undefined;
      const specificAddress =
        typeof order?.customer_user_id === "string" ? profileAddressById.get(order.customer_user_id) ?? null : null;
      const cyclist =
        typeof order?.cyclist_id === "string" ? cyclistById.get(order.cyclist_id) : undefined;

      return {
        ...order,
        order_items: items,
        specific_address: specificAddress,
        neighborhood_name: localizeDbName(preferredLocale, neighborhoodRow) || null,
        commune_name: localizeDbName(preferredLocale, communeRow) || null,
        cyclist:
          cyclist && typeof cyclist.full_name === "string" && typeof cyclist.phone_number === "string"
            ? {
                id: cyclist.id,
                name: cyclist.full_name,
                phoneNumber: cyclist.phone_number,
                avatarUrl:
                  typeof cyclist.user_id === "string" ? cyclistAvatarByUserId.get(cyclist.user_id) ?? null : null,
              }
            : null,
        platform_markup: Number(order?.platform_markup ?? order?.platform_profit ?? 0),
        subtotal_base_price: Number(order?.subtotal_base_price ?? 0),
      };
    });

    const platformDuesMad = await getVendorPendingCommissionMad(vendor.id);

    return {
      vendor: {
        id: (vendor as VendorRow).id,
        storeName: (vendor as VendorRow).store_name,
        totalCashInHandMad: Number((vendor as VendorRow).total_cash_received ?? 0),
        myNetProfitMad: Number((vendor as VendorRow).vendor_earnings ?? 0),
        platformDuesMad,
      },
      orders: hydratedOrders as Array<OrderRow>,
    };
  } catch (error) {
    console.error("getVendorDashboardData failed:", error);
    throw new Error("Failed to load vendor queue.");
  }
});

export const updateVendorOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => updateOrderStatusInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await resolveVendorByPhone(data.phoneNumber);
      const { data: order, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, status, customer_user_id")
        .eq("id", data.orderId)
        .eq("vendor_id", vendor.id)
        .single();

      if (orderError || !order?.id) {
        throw new Error("Order not found.");
      }

      const currentStatus = String((order as { status: string }).status ?? "")
        .trim()
        .toLowerCase();
      const targetStatus = String(data.nextStatus).trim().toLowerCase() as "preparing" | "ready";

      if (currentStatus === targetStatus) {
        return { ok: true };
      }

      const allowed =
        ((currentStatus === "pending" || currentStatus === "new") && targetStatus === "preparing") ||
        (currentStatus === "preparing" && targetStatus === "ready");

      if (!allowed) {
        throw new Error("Invalid status transition.");
      }

      const { data: updatedOrder, error: updateError } = await (supabaseAdmin as any)
        .from("orders")
        .update({ status: targetStatus })
        .eq("id", data.orderId)
        .eq("status", currentStatus)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (!updatedOrder?.id) {
        throw new Error("Order status changed. Please refresh and try again.");
      }

      if (typeof order.customer_user_id === "string" && order.customer_user_id.length > 0) {
        await evaluateCustomerBehavior(order.customer_user_id);
      }

      void processPendingOrderPushEvents(20).catch((pushQueueError) => {
        console.error("Push queue processing after vendor status update failed:", pushQueueError);
      });

      return { ok: true };
    } catch (error) {
      console.error("updateVendorOrderStatus failed:", error);
      throw new Error(error instanceof Error ? error.message : "Order status update failed.");
    }
  });

export const getVendorOrderDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorOrderDetailsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await resolveVendorByPhone(data.phoneNumber);
      const preferredLocale = resolveAppLanguage(data.locale);

      const { data: orderRow, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select(
          "id, vendor_id, customer_user_id, neighborhood_id, customer_name, customer_phone, delivery_notes, payment_method, status, created_at, delivery_fee, total_price, order_items",
        )
        .eq("id", data.orderId)
        .eq("vendor_id", vendor.id)
        .maybeSingle();

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!orderRow?.id) {
        throw new Error("Order not found.");
      }

      const [profileQuery, neighborhoodQuery] = await Promise.all([
        orderRow.customer_user_id
          ? (supabaseAdmin as any)
              .from("profiles")
              .select("address")
              .eq("id", orderRow.customer_user_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        orderRow.neighborhood_id
          ? (supabaseAdmin as any)
              .from("neighborhoods")
              .select("name_en, name_fr, name_ar, commune_id")
              .eq("id", orderRow.neighborhood_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (profileQuery.error) {
        throw new Error(profileQuery.error.message);
      }

      if (neighborhoodQuery.error) {
        throw new Error(neighborhoodQuery.error.message);
      }

      const communeQuery = neighborhoodQuery.data?.commune_id
        ? await (supabaseAdmin as any)
            .from("communes")
            .select("name_en, name_fr, name_ar")
            .eq("id", neighborhoodQuery.data.commune_id)
            .maybeSingle()
        : { data: null, error: null };

      if (communeQuery.error) {
        throw new Error(communeQuery.error.message);
      }

      const rawItems = Array.isArray(orderRow.order_items) ? orderRow.order_items : [];

      const productIds = Array.from(
        new Set(
          rawItems
            .map((item: any) => (typeof item?.productId === "string" ? item.productId : null))
            .filter((value: string | null): value is string => Boolean(value)),
        ),
      );

      const productNames = Array.from(
        new Set(
          rawItems
            .map((item: any) => (typeof item?.name === "string" ? item.name.trim() : null))
            .filter((value: string | null): value is string => Boolean(value)),
        ),
      );

      const [byIdQuery, byNameQuery] = await Promise.all([
        productIds.length > 0
          ? (supabaseAdmin as any)
              .from("master_products")
              .select("id, product_name, name_fr, name_ar")
              .in("id", productIds)
          : Promise.resolve({ data: [], error: null }),
        productNames.length > 0
          ? (supabaseAdmin as any)
              .from("master_products")
              .select("id, product_name, name_fr, name_ar")
              .in("product_name", productNames)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (byIdQuery.error) {
        throw new Error(byIdQuery.error.message);
      }

      if (byNameQuery.error) {
        throw new Error(byNameQuery.error.message);
      }

      const productsById = new Map(
        ((byIdQuery.data ?? []) as Array<{ id: string; product_name: string; name_fr: string | null; name_ar: string | null }>).map((row) => [
          row.id,
          {
            en: row.product_name,
            fr: row.name_fr,
            ar: row.name_ar,
          },
        ]),
      );
      const productsByName = new Map(
        ((byNameQuery.data ?? []) as Array<{ id: string; product_name: string; name_fr: string | null; name_ar: string | null }>).map((row) => [
          row.product_name.trim().toLowerCase(),
          {
            en: row.product_name,
            fr: row.name_fr,
            ar: row.name_ar,
          },
        ]),
      );

      const items: VendorOrderDetails["items"] = rawItems.map((item: any) => {
        const quantity = Number(item?.quantity ?? 0);
        const unitPriceMad = Number(item?.unitPriceMad ?? 0);
        const fallbackName = typeof item?.name === "string" ? item.name.trim() : "-";
        const normalizedFallbackName = fallbackName.toLowerCase();
        const localizedProduct =
          (typeof item?.productId === "string" ? productsById.get(item.productId) : null) ??
          productsByName.get(normalizedFallbackName) ??
          null;
        const productName =
          getLocalizedValue(localizedProduct, preferredLocale, "") ||
          getLocalizedValue(item?.name, preferredLocale, fallbackName) ||
          fallbackName;
        const selectedVariant = getLocalizedValue(item?.selectedVariant, preferredLocale, "") || null;
        const lineTotalMad = roundMoney(unitPriceMad * quantity);

        return {
          productName,
          selectedVariant,
          quantity,
          unitPriceMad,
          lineTotalMad,
        };
      });

      const localizedAddressFromProfile = getLocalizedValue(profileQuery.data?.address, preferredLocale, "");
      const localizedNeighborhoodName = localizeText(preferredLocale, {
        en: neighborhoodQuery.data?.name_en,
        fr: neighborhoodQuery.data?.name_fr,
        ar: neighborhoodQuery.data?.name_ar,
      });
      const localizedCommuneName = localizeText(preferredLocale, {
        en: communeQuery.data?.name_en,
        fr: communeQuery.data?.name_fr,
        ar: communeQuery.data?.name_ar,
      });
      const customerAddressParts = [
        localizedAddressFromProfile,
        localizedNeighborhoodName,
        localizedCommuneName,
      ].filter((part) => part.length > 0);
      const customerAddress =
        customerAddressParts.length > 0
          ? Array.from(new Set(customerAddressParts)).join(preferredLocale === "ar" ? "، " : ", ")
          : "-";

      const computedSubtotalMad = items.reduce((sum, item) => sum + Number(item.lineTotalMad ?? 0), 0);
      const subtotalMad = roundMoney(Number(orderRow.total_price ?? computedSubtotalMad));
      const deliveryFeeMad = roundMoney(Number(orderRow.delivery_fee ?? 0));

      return {
        id: String(orderRow.id),
        customerName: String(orderRow.customer_name ?? "-"),
        customerPhone: String(orderRow.customer_phone ?? "-"),
        customerAddress,
        specialInstructions:
          getLocalizedValue(orderRow.delivery_notes, preferredLocale, "").trim() || "",
        paymentMethod: (orderRow.payment_method ?? "COD") as "COD" | "Carnet",
        status: (orderRow.status ?? "pending") as VendorOrderDetails["status"],
        createdAt: String(orderRow.created_at ?? new Date().toISOString()),
        deliveryFeeMad,
        subtotalMad,
        grandTotalMad: roundMoney(subtotalMad + deliveryFeeMad),
        items,
      } satisfies VendorOrderDetails;
    } catch (error) {
      console.error("getVendorOrderDetails failed:", error);
      throw new Error("Failed to load order details.");
    }
  });

export const getCustomerOrderDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => customerOrderDetailsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: profile, error: profileError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("phone", data.phoneNumber)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      const customerUserId = profile?.id ? String(profile.id) : null;
      if (!customerUserId) {
        throw new Error("Customer session is invalid.");
      }

      const { data: orderRow, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select(
          "id, customer_user_id, neighborhood_id, delivery_notes, payment_method, status, delivery_auth_code, created_at, delivery_fee, total_price, order_items",
        )
        .eq("id", data.orderId)
        .eq("customer_user_id", customerUserId)
        .maybeSingle();

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!orderRow?.id) {
        throw new Error("Order not found.");
      }

      const rawItems = Array.isArray(orderRow.order_items) ? orderRow.order_items : [];

      const productIds = Array.from(
        new Set(
          rawItems
            .map((item: any) => (typeof item?.productId === "string" ? item.productId : null))
            .filter((value: string | null): value is string => Boolean(value)),
        ),
      );

      const productNames = Array.from(
        new Set(
          rawItems
            .map((item: any) => (typeof item?.name === "string" ? item.name.trim() : null))
            .filter((value: string | null): value is string => Boolean(value)),
        ),
      );

      const [byIdQuery, byNameQuery] = await Promise.all([
        productIds.length > 0
          ? (supabaseAdmin as any).from("master_products").select("id, product_name").in("id", productIds)
          : Promise.resolve({ data: [], error: null }),
        productNames.length > 0
          ? (supabaseAdmin as any)
              .from("master_products")
              .select("id, product_name")
              .in("product_name", productNames)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (byIdQuery.error) {
        throw new Error(byIdQuery.error.message);
      }

      if (byNameQuery.error) {
        throw new Error(byNameQuery.error.message);
      }

      const productsById = new Map(
        ((byIdQuery.data ?? []) as Array<{ id: string; product_name: string }>).map((row) => [row.id, row.product_name]),
      );
      const productsByName = new Map(
        ((byNameQuery.data ?? []) as Array<{ id: string; product_name: string }>).map((row) => [
          row.product_name.trim().toLowerCase(),
          row.product_name,
        ]),
      );

      const items: CustomerOrderDetails["items"] = rawItems.map((item: any) => {
        const quantity = Number(item?.quantity ?? 0);
        const unitPriceMad = Number(item?.unitPriceMad ?? 0);
        const fallbackName = typeof item?.name === "string" ? item.name.trim() : "-";
        const normalizedFallbackName = fallbackName.toLowerCase();
        const productName =
          (typeof item?.productId === "string" ? productsById.get(item.productId) : null) ??
          productsByName.get(normalizedFallbackName) ??
          fallbackName;
        const lineTotalMad = roundMoney(unitPriceMad * quantity);

        return {
          productName,
          quantity,
          unitPriceMad,
          lineTotalMad,
        };
      });

      const computedSubtotalMad = items.reduce((sum, item) => sum + Number(item.lineTotalMad ?? 0), 0);
      const subtotalMad = roundMoney(Number(orderRow.total_price ?? computedSubtotalMad));
      const deliveryFeeMad = roundMoney(Number(orderRow.delivery_fee ?? 0));
      const normalizedStatus = String(orderRow.status ?? "pending").toLowerCase();
      const neighborhoodQuery =
        typeof (orderRow as { neighborhood_id?: unknown }).neighborhood_id === "string"
          ? await (supabaseAdmin as any)
              .from("neighborhoods")
              .select("name_en, name_fr, name_ar, commune_id")
              .eq("id", (orderRow as { neighborhood_id: string }).neighborhood_id)
              .maybeSingle()
          : { data: null, error: null };

      if (neighborhoodQuery.error) {
        throw new Error(neighborhoodQuery.error.message);
      }

      const communeQuery = neighborhoodQuery.data?.commune_id
        ? await (supabaseAdmin as any)
            .from("communes")
            .select("name_en, name_fr, name_ar")
            .eq("id", neighborhoodQuery.data.commune_id)
            .maybeSingle()
        : { data: null, error: null };

      if (communeQuery.error) {
        throw new Error(communeQuery.error.message);
      }

      const neighborhoodName =
        typeof neighborhoodQuery.data?.name_ar === "string"
          ? neighborhoodQuery.data.name_ar.trim()
          : typeof neighborhoodQuery.data?.name_fr === "string"
            ? neighborhoodQuery.data.name_fr.trim()
            : typeof neighborhoodQuery.data?.name_en === "string"
              ? neighborhoodQuery.data.name_en.trim()
              : "-";

      const communeName =
        typeof communeQuery.data?.name_ar === "string"
          ? communeQuery.data.name_ar.trim()
          : typeof communeQuery.data?.name_fr === "string"
            ? communeQuery.data.name_fr.trim()
            : typeof communeQuery.data?.name_en === "string"
              ? communeQuery.data.name_en.trim()
              : "-";

      return {
        id: String(orderRow.id),
        paymentMethod: (orderRow.payment_method ?? "COD") as "COD" | "Carnet",
        status: (normalizedStatus === "cancelled" ? "cancelled" : orderRow.status ?? "pending") as CustomerOrderDetails["status"],
        deliveryAuthCode:
          typeof (orderRow as { delivery_auth_code?: unknown }).delivery_auth_code === "string"
            ? ((orderRow as { delivery_auth_code: string }).delivery_auth_code ?? null)
            : null,
        communeName,
        neighborhoodName,
        specialInstructions:
          typeof (orderRow as { delivery_notes?: unknown }).delivery_notes === "string" &&
          (orderRow as { delivery_notes: string }).delivery_notes.trim().length > 0
            ? (orderRow as { delivery_notes: string }).delivery_notes.trim()
            : "None / لا توجد",
        createdAt: String(orderRow.created_at ?? new Date().toISOString()),
        deliveryFeeMad,
        subtotalMad,
        grandTotalMad: roundMoney(subtotalMad + deliveryFeeMad),
        items,
      } satisfies CustomerOrderDetails;
    } catch (error) {
      console.error("getCustomerOrderDetails failed:", error);
      throw new Error("Failed to load order details.");
    }
  });

export const getVendorSettlementSummary = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorSettlementSummaryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await resolveVendorByPhone(data.phoneNumber);

      const isCashPayment = (paymentMethod: string | null | undefined) => {
        const normalized = String(paymentMethod ?? "").trim().toLowerCase();
        return normalized === "cash" || normalized === "cod";
      };

      const isCreditPayment = (paymentMethod: string | null | undefined) => {
        const normalized = String(paymentMethod ?? "").trim().toLowerCase();
        return normalized === "credit" || normalized === "carnet";
      };

      const [
        { data: pendingRows, error: pendingError },
        { data: receivedRows, error: receivedError },
        { data: lifetimeRows, error: lifetimeError },
      ] = await Promise.all([
        (supabaseAdmin as any)
          .from("orders")
          .select("cyclist_id, total_price, delivery_fee, payment_method")
          .eq("vendor_id", vendor.id)
          .eq("status", "delivered_cash_with_cyclist")
          .eq("vendor_settlement_status", "pending")
          .not("cyclist_id", "is", null),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, payment_method")
          .eq("vendor_id", vendor.id)
          .eq("status", "cash_transferred_to_vendor")
          .eq("vendor_settlement_status", "settled")
          .gte("updated_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          .lt("updated_at", new Date(new Date().setHours(24, 0, 0, 0)).toISOString()),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, payment_method")
          .eq("vendor_id", vendor.id)
          .eq("status", "cash_transferred_to_vendor")
          .eq("vendor_settlement_status", "settled"),
      ]);

      if (pendingError) {
        throw new Error(pendingError.message);
      }

      if (receivedError) {
        throw new Error(receivedError.message);
      }

      if (lifetimeError) {
        throw new Error(lifetimeError.message);
      }

      const pending = (pendingRows ?? []) as Array<{
        cyclist_id: string | null;
        total_price: number;
        delivery_fee: number;
        payment_method: string;
      }>;
      const received = (receivedRows ?? []) as Array<{ total_price: number; payment_method: string }>;
      const lifetime = (lifetimeRows ?? []) as Array<{ total_price: number; payment_method: string }>;

      const pendingCashRows = pending.filter((row) => isCashPayment(row.payment_method));
      const pendingCreditRows = pending.filter((row) => isCreditPayment(row.payment_method));

      const unsettledCashWithCyclistsMad = pendingCashRows.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);

      const owedToCyclistMad = pendingCreditRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0);

      const totalReceivedTodayMad = received.reduce(
        (sum, row) => (isCashPayment(row.payment_method) ? sum + Number(row.total_price ?? 0) : sum),
        0,
      );

      const lifetimeEarningsMad = lifetime.reduce(
        (sum, row) => (isCashPayment(row.payment_method) ? sum + Number(row.total_price ?? 0) : sum),
        0,
      );

      const pendingCyclistCount = new Set(pending.map((row) => row.cyclist_id).filter(Boolean)).size;

      const platformDuesMad = await getVendorPendingCommissionMad(vendor.id);

      return {
        totalCashInHandMad: roundMoney(Number((vendor as VendorRow).total_cash_received ?? 0)),
        myNetProfitMad: roundMoney(Number((vendor as VendorRow).vendor_earnings ?? 0)),
        platformDuesMad,
        unsettledCashWithCyclistsMad,
        owedToCyclistMad,
        totalReceivedTodayMad,
        lifetimeEarningsMad,
        pendingCyclistCount,
      } satisfies VendorSettlementSummary;
    } catch (error) {
      console.error("getVendorSettlementSummary failed:", error);
      throw new Error("Failed to load vendor settlement summary.");
    }
  });

export const settleCyclistCashHandover = createServerFn({ method: "POST" })
  .inputValidator((input) => settleCyclistCashHandoverInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await resolveVendorByPhone(data.phoneNumber);
      const { data: pendingRows, error: pendingError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, total_price, delivery_fee, payment_method")
        .eq("vendor_id", vendor.id)
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered_cash_with_cyclist")
        .eq("vendor_settlement_status", "pending");

      if (pendingError) {
        throw new Error(pendingError.message);
      }

      const rows = (pendingRows ?? []) as Array<{
        id: string;
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

      const cashToRemitMad = rows
        .filter((row) => isCashPayment(row.payment_method))
        .reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);

      const owedByVendorMad = rows
        .filter((row) => isCreditPayment(row.payment_method))
        .reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0);

      const computedAmount = cashToRemitMad;

      if (Math.abs(computedAmount - data.expectedAmount) > 0.5) {
        throw new Error("Settlement amount mismatch. Please refresh and scan again.");
      }

      const { data: settleResult, error: settleError } = await (supabaseAdmin as any).rpc(
        "confirm_cash_transferred_to_vendor",
        {
          p_cyclist_id: data.cyclistId,
          p_vendor_id: vendor.id,
        },
      );

      if (settleError) {
        throw new Error(settleError.message);
      }

      const settleRow = Array.isArray(settleResult) ? settleResult[0] : null;

      return {
        ok: true,
        settledAmountMad: computedAmount,
        settledOrdersCount: Number(settleRow?.settled_orders_count ?? 0),
      };
    } catch (error) {
      console.error("settleCyclistCashHandover failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to settle cyclist handover.");
    }
  });

export const upsertCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertCustomerProfileInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: profileRow, error: profileLookupError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("phone", data.phoneNumber)
        .maybeSingle();

      if (profileLookupError) {
        throw new Error(profileLookupError.message);
      }

      let profileId = (profileRow as { id?: string } | null)?.id ?? null;

      if (!profileId) {
        const phoneSlug = data.phoneNumber.replace(/\D/g, "");
        const syntheticEmail = `customer-${phoneSlug}@checkout.local`;
        const syntheticPassword = `${crypto.randomUUID()}A!1`;

        const { data: createdUserData, error: createUserError } = await (supabaseAdmin as any).auth.admin.createUser({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: {
            name: data.fullName,
            phone: data.phoneNumber,
          },
        });

        if (createUserError) {
          const { data: listedUsers, error: listUsersError } = await (supabaseAdmin as any).auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

          if (listUsersError) {
            throw new Error(createUserError.message);
          }

          const existingUser = (listedUsers?.users ?? []).find(
            (user: { email?: string | null; id: string }) =>
              typeof user.email === "string" && user.email.toLowerCase() === syntheticEmail.toLowerCase(),
          );

          if (!existingUser?.id) {
            throw new Error(createUserError.message);
          }

          profileId = existingUser.id;
        } else {
          profileId = createdUserData?.user?.id ?? null;
        }

        if (!profileId) {
          throw new Error("Customer profile not found.");
        }
      }

      const { error: profileUpsertError } = await (supabaseAdmin as any).from("profiles").upsert(
        {
          id: profileId,
          phone: data.phoneNumber,
          full_name: data.fullName,
          address: data.address,
          neighborhood_id: data.neighborhoodId,
          display_name: data.fullName,
        },
        {
          onConflict: "id",
          ignoreDuplicates: false,
        },
      );

      if (profileUpsertError) {
        throw new Error(profileUpsertError.message);
      }

      const { error: legacyError } = await (supabaseAdmin as any).from("customers").upsert(
        {
          user_id: profileId,
          phone_number: data.phoneNumber,
          full_name: data.fullName,
          saved_instructions: data.savedInstructions ?? null,
          neighborhood_id: data.neighborhoodId,
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        },
      );

      if (legacyError) {
        console.error("Legacy customer profile sync failed:", legacyError.message);
      }

      return { ok: true, updatedCount: 1 };
    } catch (error) {
      console.error("upsertCustomerProfile failed:", error);
      throw new Error("Failed to save customer profile.");
    }
  });

export const getCustomerOrders = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerOrdersInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: orders, error } = await (supabaseAdmin as any)
        .from("orders")
        .select(
          "id, vendor_id, subscription_id, order_category, customer_name, customer_phone, delivery_notes, payment_method, status, delivery_auth_code, delivery_fee, total_price, item_count, order_items, created_at",
        )
        .eq("customer_phone", data.phoneNumber)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (orders ?? []) as Array<CustomerOrderRow & { subscription_id?: string | null; order_category?: string | null }>;
      const subscriptionIds = Array.from(
        new Set(
          rows
            .map((row) => row.subscription_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );

      const subscriptionStatusById = new Map<string, string>();
      if (subscriptionIds.length > 0) {
        const { data: subscriptions, error: subscriptionsError } = await (supabaseAdmin as any)
          .from("platform_subscriptions")
          .select("id, status")
          .in("id", subscriptionIds);

        if (subscriptionsError) {
          throw new Error(subscriptionsError.message);
        }

        for (const row of (subscriptions ?? []) as Array<{ id: string; status: string }>) {
          subscriptionStatusById.set(row.id, row.status);
        }
      }

      return rows.map((row) => ({
        ...row,
        subscription_status:
          typeof row.subscription_id === "string" && row.subscription_id.length > 0
            ? (subscriptionStatusById.get(row.subscription_id) ?? null)
            : null,
      })) as Array<CustomerOrderRow>;
    } catch (error) {
      console.error("getCustomerOrders failed:", error);
      throw new Error("Failed to load customer orders.");
    }
  });

export const getCustomerSubscriptions = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerSubscriptionsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const [subscriptionsRes, packsRes] = await Promise.all([
        (supabaseAdmin as any)
          .from("platform_subscriptions")
          .select(
            "id, customer_name, customer_phone, pack_id, status, start_date, expiration_date, next_scheduled_delivery_date, agreed_price, total_deliveries, completed_deliveries, created_at",
          )
          .eq("customer_phone", data.phoneNumber)
          .order("created_at", { ascending: false }),
        (supabaseAdmin as any).from("platform_packs").select("id, name_en, name_fr, name_ar"),
      ]);

      if (subscriptionsRes.error) {
        throw new Error(subscriptionsRes.error.message);
      }
      if (packsRes.error) {
        throw new Error(packsRes.error.message);
      }

      const packNameById = new Map(
        ((packsRes.data ?? []) as Array<{ id: string; name_en: string; name_fr: string | null; name_ar: string | null }>).map((pack) => [
          pack.id,
          (pack.name_en?.trim() || pack.name_fr?.trim() || pack.name_ar?.trim() || "Unknown Pack"),
        ]),
      );

      return ((subscriptionsRes.data ?? []) as Array<{
        id: string;
        customer_name: string;
        customer_phone: string | null;
        pack_id: string;
        status: "pending" | "active" | "paused" | "expired" | "cancelled" | "completed";
        start_date: string;
        expiration_date: string | null;
        next_scheduled_delivery_date: string | null;
        agreed_price: number | null;
        total_deliveries: number | null;
        completed_deliveries: number | null;
        created_at: string;
      }>).map((row) => {
        const completed = Number(row.completed_deliveries ?? 0);
        const total = Number(row.total_deliveries ?? 0);
        const completionPercent = total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0;

        return {
          id: row.id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          packId: row.pack_id,
          packName: packNameById.get(row.pack_id) ?? "Unknown Pack",
          status: row.status,
          startDate: row.start_date,
          expirationDate: row.expiration_date,
          nextScheduledDeliveryDate: row.next_scheduled_delivery_date,
          agreedPriceMad: Number(row.agreed_price ?? 0),
          totalDeliveries: total,
          completedDeliveries: completed,
          completionPercent,
          createdAt: row.created_at,
        };
      });
    } catch (error) {
      console.error("getCustomerSubscriptions failed:", error);
      throw new Error("Failed to load customer subscriptions.");
    }
  });

export const updateCustomerSubscriptionStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => updateCustomerSubscriptionStatusInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: updatedRow, error } = await (supabaseAdmin as any)
        .from("platform_subscriptions")
        .update({ status: data.status })
        .eq("id", data.subscriptionId)
        .eq("customer_phone", data.phoneNumber)
        .select("id")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!updatedRow?.id) {
        throw new Error("Subscription not found for this customer.");
      }

      return { ok: true };
    } catch (error) {
      console.error("updateCustomerSubscriptionStatus failed:", error);
      throw new Error("Failed to update subscription status.");
    }
  });