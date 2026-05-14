import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  formatMoroccoPhoneForPayload,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";

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
  quantity: z.number().int().min(1).max(99),
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

const vendorDashboardInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
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

const vendorSettlementSummaryInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
});

const vendorOrderDetailsInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
  orderId: z.string().uuid(),
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
};

type OrderRow = {
  id: string;
  vendor_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_notes: string;
  payment_method: "COD" | "Carnet";
  status: "new" | "preparing" | "ready" | "delivering" | "delivered";
  delivery_auth_code: string;
  delivery_fee: number;
  total_price: number;
  item_count: number;
  order_items: Array<{ name: string; quantity: number; unitPriceMad: number; imageUrl?: string | null }>;
  vendor_settlement_status?: "pending" | "settled";
  created_at: string;
};

export type CustomerOrderRow = OrderRow;

export type VendorSettlementSummary = {
  unsettledCashWithCyclistsMad: number;
  owedToCyclistMad: number;
  totalReceivedTodayMad: number;
  lifetimeEarningsMad: number;
  pendingCyclistCount: number;
};

export type VendorOrderDetails = {
  id: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "COD" | "Carnet";
  status: "new" | "preparing" | "ready" | "delivering" | "delivered";
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

export type CustomerOrderDetails = {
  id: string;
  paymentMethod: "COD" | "Carnet";
  status: "new" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";
  deliveryAuthCode: string | null;
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
  const { data: vendor, error } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, phone_number")
    .eq("phone_number", phoneNumber)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !vendor?.id) {
    throw new Error("Vendor session is invalid.");
  }

  return vendor as VendorRow;
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
      const itemsByVendor = new Map<string, Array<{ productId?: string; vendorId?: string; name: string; quantity: number; unitPriceMad: number }>>();

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

      for (const [vendorId, vendorItems] of vendorEntries) {
        const totalPrice = vendorItems.reduce((sum, item) => sum + Number(item.unitPriceMad ?? 0) * Number(item.quantity ?? 0), 0);
        const itemCount = vendorItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
        const deliveryFee = vendorEntries.length > 1 ? 0 : data.deliveryFee;

        const { data: inserted, error } = await (supabaseAdmin as any)
          .from("orders")
          .insert({
            customer_user_id: customerUserId,
            vendor_id: vendorId,
            customer_name: data.customerName,
            customer_phone: data.customerPhone,
            neighborhood_id: data.neighborhoodId,
            delivery_notes: data.deliveryNotes,
            payment_method: data.paymentMethod,
            status: "new",
            delivery_fee: deliveryFee,
            total_price: totalPrice,
            item_count: itemCount,
            order_items: vendorItems,
          })
          .select("id")
          .single();

        if (error || !inserted?.id) {
          throw new Error(error?.message ?? "Order insert failed.");
        }

        insertedOrderIds.push(String(inserted.id));
      }

      return { id: insertedOrderIds[0] as string, orderIds: insertedOrderIds };
    } catch (error) {
      console.error("createCustomerOrder failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Order confirmation failed: ${message}`);
    }
  });

export const getVendorDashboardData = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorDashboardInputSchema.parse(input))
  .handler(async ({ data }) => {
  try {
    const vendor = await resolveVendorByPhone(data.phoneNumber);

    const { data: orders, error: ordersError } = await (supabaseAdmin as any)
      .from("orders")
      .select(
        "id, vendor_id, customer_name, customer_phone, delivery_notes, payment_method, status, delivery_auth_code, delivery_fee, total_price, item_count, order_items, vendor_settlement_status, created_at",
      )
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      throw new Error(ordersError.message);
    }

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

    let productImageMap = new Map<string, string | null>();
    if (orderItemNames.length > 0) {
      const { data: products, error: productsError } = await (supabaseAdmin as any)
        .from("master_products")
        .select("product_name, image_url")
        .in("product_name", orderItemNames);

      if (productsError) {
        throw new Error(productsError.message);
      }

      productImageMap = new Map(
        (products ?? [])
          .filter((product: any) => typeof product?.product_name === "string")
          .map((product: any) => [product.product_name.trim().toLowerCase(), product.image_url ?? null]),
      );
    }

    const hydratedOrders = (orders ?? []).map((order: any) => {
      const items = Array.isArray(order?.order_items)
        ? order.order_items.map((item: any) => ({
            ...item,
            imageUrl:
              typeof item?.name === "string"
                ? productImageMap.get(item.name.trim().toLowerCase()) ?? null
                : null,
          }))
        : [];

      return {
        ...order,
        order_items: items,
      };
    });

    return {
      vendor: {
        id: (vendor as VendorRow).id,
        storeName: (vendor as VendorRow).store_name,
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
        .select("id, status")
        .eq("id", data.orderId)
        .eq("vendor_id", vendor.id)
        .single();

      if (orderError || !order?.id) {
        throw new Error("Order not found.");
      }

      const currentStatus = (order as { status: string }).status;
      const allowed =
        (currentStatus === "new" && data.nextStatus === "preparing") ||
        (currentStatus === "preparing" && data.nextStatus === "ready");

      if (!allowed) {
        throw new Error("Invalid status transition.");
      }

      const { error: updateError } = await (supabaseAdmin as any)
        .from("orders")
        .update({ status: data.nextStatus })
        .eq("id", data.orderId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("updateVendorOrderStatus failed:", error);
      throw new Error("Order status update failed.");
    }
  });

export const getVendorOrderDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorOrderDetailsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await resolveVendorByPhone(data.phoneNumber);

      const { data: orderRow, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, vendor_id, customer_name, customer_phone, payment_method, status, created_at, delivery_fee, order_items")
        .eq("id", data.orderId)
        .eq("vendor_id", vendor.id)
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

      const items: VendorOrderDetails["items"] = rawItems.map((item: any) => {
        const quantity = Number(item?.quantity ?? 0);
        const unitPriceMad = Number(item?.unitPriceMad ?? 0);
        const fallbackName = typeof item?.name === "string" ? item.name.trim() : "-";
        const normalizedFallbackName = fallbackName.toLowerCase();
        const productName =
          (typeof item?.productId === "string" ? productsById.get(item.productId) : null) ??
          productsByName.get(normalizedFallbackName) ??
          fallbackName;
        const lineTotalMad = quantity * unitPriceMad;

        return {
          productName,
          quantity,
          unitPriceMad,
          lineTotalMad,
        };
      });

      const subtotalMad = items.reduce((sum, item) => sum + item.lineTotalMad, 0);
      const deliveryFeeMad = Number(orderRow.delivery_fee ?? 0);

      return {
        id: String(orderRow.id),
        customerName: String(orderRow.customer_name ?? "-"),
        customerPhone: String(orderRow.customer_phone ?? "-"),
        paymentMethod: (orderRow.payment_method ?? "COD") as "COD" | "Carnet",
        status: (orderRow.status ?? "new") as "new" | "preparing" | "ready" | "delivering" | "delivered",
        createdAt: String(orderRow.created_at ?? new Date().toISOString()),
        deliveryFeeMad,
        subtotalMad,
        grandTotalMad: subtotalMad + deliveryFeeMad,
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
        .select("id, customer_user_id, payment_method, status, delivery_auth_code, created_at, delivery_fee, order_items")
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
        const lineTotalMad = quantity * unitPriceMad;

        return {
          productName,
          quantity,
          unitPriceMad,
          lineTotalMad,
        };
      });

      const subtotalMad = items.reduce((sum, item) => sum + item.lineTotalMad, 0);
      const deliveryFeeMad = Number(orderRow.delivery_fee ?? 0);
      const normalizedStatus = String(orderRow.status ?? "new").toLowerCase();

      return {
        id: String(orderRow.id),
        paymentMethod: (orderRow.payment_method ?? "COD") as "COD" | "Carnet",
        status: (normalizedStatus === "cancelled" ? "cancelled" : orderRow.status ?? "new") as CustomerOrderDetails["status"],
        deliveryAuthCode:
          typeof (orderRow as { delivery_auth_code?: unknown }).delivery_auth_code === "string"
            ? ((orderRow as { delivery_auth_code: string }).delivery_auth_code ?? null)
            : null,
        createdAt: String(orderRow.created_at ?? new Date().toISOString()),
        deliveryFeeMad,
        subtotalMad,
        grandTotalMad: subtotalMad + deliveryFeeMad,
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
          .eq("status", "delivered")
          .eq("vendor_settlement_status", "pending")
          .not("cyclist_id", "is", null),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, payment_method")
          .eq("vendor_id", vendor.id)
          .eq("status", "delivered")
          .eq("vendor_settlement_status", "settled")
          .gte("updated_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          .lt("updated_at", new Date(new Date().setHours(24, 0, 0, 0)).toISOString()),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, payment_method")
          .eq("vendor_id", vendor.id)
          .eq("status", "delivered")
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

      return {
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
        .eq("status", "delivered")
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

      const computedAmount = cashToRemitMad - owedByVendorMad;

      if (Math.abs(computedAmount - data.expectedAmount) > 0.5) {
        throw new Error("Settlement amount mismatch. Please refresh and scan again.");
      }

      const { data: updatedRows, error: updateError } = await (supabaseAdmin as any)
        .from("orders")
        .update({ vendor_settlement_status: "settled" })
        .eq("vendor_id", vendor.id)
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered")
        .eq("vendor_settlement_status", "pending")
        .select("id");

      if (updateError) {
        throw new Error(updateError.message);
      }

      return {
        ok: true,
        settledAmountMad: computedAmount,
        settledOrdersCount: (updatedRows ?? []).length,
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
          "id, vendor_id, customer_name, customer_phone, delivery_notes, payment_method, status, delivery_auth_code, delivery_fee, total_price, item_count, order_items, created_at",
        )
        .eq("customer_phone", data.phoneNumber)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (orders ?? []) as Array<CustomerOrderRow>;
    } catch (error) {
      console.error("getCustomerOrders failed:", error);
      throw new Error("Failed to load customer orders.");
    }
  });