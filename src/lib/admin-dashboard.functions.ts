import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_RECEIPT_ADDRESS,
  DEFAULT_RECEIPT_FOOTER_CONTENT,
  DEFAULT_RECEIPT_FOOTER_MESSAGE,
  DEFAULT_RECEIPT_HEADER_CONTENT,
  DEFAULT_RECEIPT_PHONE,
  DEFAULT_RECEIPT_SLOGAN,
  DEFAULT_RECEIPT_SOCIAL_SUPPORT,
  DEFAULT_RECEIPT_STORE_NAME,
  DEFAULT_RECEIPT_WEBSITE,
} from "@/lib/receipt-settings.defaults";

type AdminOrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "delivering"
  | "delivered"
  | "delivered_cash_with_cyclist"
  | "cash_transferred_to_vendor"
  | "cancelled";

type AdminOrderRow = {
  id: string;
  vendor_id: string;
  customer_phone: string;
  total_price: number;
  status: AdminOrderStatus;
  created_at: string;
};

type AdminVendorRow = {
  id: string;
  store_name: string;
};

type InvoiceSettingsRow = {
  id: string;
  store_name: string;
  address: string;
  phone: string;
  tax_id: string | null;
  footer_message: string;
  receipt_logo_url: string | null;
  receipt_store_name: string;
  receipt_slogan: string;
  receipt_phone: string;
  receipt_address: string;
  receipt_website: string;
  receipt_footer_message: string;
  receipt_social_support: string;
  created_at: string;
  updated_at: string;
};

type AdminCustomerProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
};

type AdminCustomerOrderAggregateRow = {
  customer_phone: string | null;
  total_price: number | null;
  delivery_fee: number | null;
};

type GlobalSettingsRow = {
  id: string;
  global_delivery_fee: number;
  minimum_order_amount: number;
  free_delivery_threshold: number;
  marketplace_active: boolean;
  site_name: string;
  site_logo_url: string | null;
  created_at: string;
  updated_at: string;
};

const GLOBAL_SETTINGS_SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

function normalizeInvoiceSettingsRow(row: any): InvoiceSettingsRow {
  return {
    id: row.id,
    store_name: row.store_name ?? DEFAULT_RECEIPT_HEADER_CONTENT,
    address: row.address ?? DEFAULT_RECEIPT_ADDRESS,
    phone: row.phone ?? DEFAULT_RECEIPT_PHONE,
    tax_id: row.tax_id ?? null,
    footer_message: row.footer_message ?? DEFAULT_RECEIPT_FOOTER_CONTENT,
    receipt_logo_url: row.receipt_logo_url ?? null,
    receipt_store_name: row.receipt_store_name ?? DEFAULT_RECEIPT_STORE_NAME,
    receipt_slogan: row.receipt_slogan ?? DEFAULT_RECEIPT_SLOGAN,
    receipt_phone: row.receipt_phone ?? DEFAULT_RECEIPT_PHONE,
    receipt_address: row.receipt_address ?? DEFAULT_RECEIPT_ADDRESS,
    receipt_website: row.receipt_website ?? DEFAULT_RECEIPT_WEBSITE,
    receipt_footer_message: row.receipt_footer_message ?? DEFAULT_RECEIPT_FOOTER_MESSAGE,
    receipt_social_support: row.receipt_social_support ?? DEFAULT_RECEIPT_SOCIAL_SUPPORT,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeGlobalSettingsRow(row: any): GlobalSettingsRow {
  return {
    id: row.id,
    global_delivery_fee: Number(row.global_delivery_fee ?? 10),
    minimum_order_amount: Number(row.minimum_order_amount ?? 50),
    free_delivery_threshold: Number(row.free_delivery_threshold ?? 500),
    marketplace_active: Boolean(row.marketplace_active ?? true),
    site_name: typeof row.site_name === "string" && row.site_name.trim().length > 0 ? row.site_name.trim() : "Bzaf Fresh",
    site_logo_url: typeof row.site_logo_url === "string" && row.site_logo_url.trim().length > 0 ? row.site_logo_url.trim() : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const uploadSiteLogoInputSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  dataUrl: z.string().trim().min(1).max(10_000_000),
});

export const getAdminOverviewAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();

  const [ordersTodayRes, activeVendorsRes, revenueRes, weeklyOrdersRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart)
      .lt("created_at", tomorrowStart),
    (supabaseAdmin as any)
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    (supabaseAdmin as any)
      .from("orders")
      .select("total_price")
      .in("status", ["delivered", "cash_transferred_to_vendor"]),
    (supabaseAdmin as any)
      .from("orders")
      .select("created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true }),
  ]);

  if (ordersTodayRes.error) throw new Error(ordersTodayRes.error.message);
  if (activeVendorsRes.error) throw new Error(activeVendorsRes.error.message);
  if (revenueRes.error) throw new Error(revenueRes.error.message);
  if (weeklyOrdersRes.error) throw new Error(weeklyOrdersRes.error.message);

  const weeklyCounts = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const dayKey = day.toISOString().slice(0, 10);
    weeklyCounts.set(dayKey, 0);
  }

  for (const row of (weeklyOrdersRes.data ?? []) as Array<{ created_at: string }>) {
    const dayKey = row.created_at.slice(0, 10);
    if (weeklyCounts.has(dayKey)) {
      weeklyCounts.set(dayKey, (weeklyCounts.get(dayKey) ?? 0) + 1);
    }
  }

  const weeklyTrends = Array.from(weeklyCounts.entries()).map(([day, count]) => ({
    day,
    label: new Date(day).toLocaleDateString("en-US", { weekday: "short" }),
    orders: count,
  }));

  const totalRevenueMad = ((revenueRes.data ?? []) as Array<{ total_price: number | null }>).reduce(
    (sum, row) => sum + Number(row.total_price ?? 0),
    0,
  );

  return {
    totalOrdersToday: ordersTodayRes.count ?? 0,
    activeVendors: activeVendorsRes.count ?? 0,
    totalRevenueMad,
    weeklyTrends,
  };
});

export const listAdminOrders = createServerFn({ method: "GET" }).handler(async () => {
  const [ordersRes, vendorsRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("orders")
      .select("id, vendor_id, customer_phone, total_price, status, created_at")
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any).from("vendors").select("id, store_name"),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (vendorsRes.error) throw new Error(vendorsRes.error.message);

  const vendorMap = new Map(
    ((vendorsRes.data ?? []) as AdminVendorRow[]).map((vendor) => [vendor.id, vendor.store_name]),
  );

  return ((ordersRes.data ?? []) as AdminOrderRow[]).map((order) => ({
    id: order.id,
    createdAt: order.created_at,
    customerPhone: order.customer_phone,
    totalPrice: Number(order.total_price ?? 0),
    status: order.status,
    vendorName: vendorMap.get(order.vendor_id) ?? "Unknown Vendor",
  }));
});

export const getAdminInvoiceSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("invoice_settings")
    .select(
      "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load receipt settings.");
  }

  if (data?.id) {
    const normalizedDefaultsPatch = {
      store_name: data.store_name?.trim() ? data.store_name : DEFAULT_RECEIPT_HEADER_CONTENT,
      address: data.address?.trim() ? data.address : DEFAULT_RECEIPT_ADDRESS,
      phone: data.phone?.trim() ? data.phone : DEFAULT_RECEIPT_PHONE,
      footer_message: data.footer_message?.trim() ? data.footer_message : DEFAULT_RECEIPT_FOOTER_CONTENT,
      receipt_store_name: data.receipt_store_name?.trim() ? data.receipt_store_name : DEFAULT_RECEIPT_STORE_NAME,
      receipt_slogan: data.receipt_slogan?.trim() ? data.receipt_slogan : DEFAULT_RECEIPT_SLOGAN,
      receipt_phone: data.receipt_phone?.trim() ? data.receipt_phone : DEFAULT_RECEIPT_PHONE,
      receipt_address: data.receipt_address?.trim() ? data.receipt_address : DEFAULT_RECEIPT_ADDRESS,
      receipt_website: data.receipt_website?.trim() ? data.receipt_website : DEFAULT_RECEIPT_WEBSITE,
      receipt_footer_message: data.receipt_footer_message?.trim()
        ? data.receipt_footer_message
        : DEFAULT_RECEIPT_FOOTER_MESSAGE,
      receipt_social_support: data.receipt_social_support?.trim()
        ? data.receipt_social_support
        : DEFAULT_RECEIPT_SOCIAL_SUPPORT,
    };

    if (
      normalizedDefaultsPatch.store_name !== data.store_name ||
      normalizedDefaultsPatch.address !== data.address ||
      normalizedDefaultsPatch.phone !== data.phone ||
      normalizedDefaultsPatch.footer_message !== data.footer_message ||
      normalizedDefaultsPatch.receipt_store_name !== data.receipt_store_name ||
      normalizedDefaultsPatch.receipt_slogan !== data.receipt_slogan ||
      normalizedDefaultsPatch.receipt_phone !== data.receipt_phone ||
      normalizedDefaultsPatch.receipt_address !== data.receipt_address ||
      normalizedDefaultsPatch.receipt_website !== data.receipt_website ||
      normalizedDefaultsPatch.receipt_footer_message !== data.receipt_footer_message ||
      normalizedDefaultsPatch.receipt_social_support !== data.receipt_social_support
    ) {
      const { data: patchedRow, error: patchError } = await (supabaseAdmin as any)
        .from("invoice_settings")
        .update(normalizedDefaultsPatch)
        .eq("id", data.id)
        .select(
          "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
        )
        .single();

      if (patchError || !patchedRow?.id) {
        throw new Error(patchError?.message ?? "Failed to apply default receipt settings.");
      }

      return normalizeInvoiceSettingsRow(patchedRow);
    }

    return normalizeInvoiceSettingsRow(data);
  }

  const { data: inserted, error: insertError } = await (supabaseAdmin as any)
    .from("invoice_settings")
    .insert({
      store_name: DEFAULT_RECEIPT_HEADER_CONTENT,
      address: DEFAULT_RECEIPT_ADDRESS,
      phone: DEFAULT_RECEIPT_PHONE,
      tax_id: null,
      footer_message: DEFAULT_RECEIPT_FOOTER_CONTENT,
      receipt_logo_url: null,
      receipt_store_name: DEFAULT_RECEIPT_STORE_NAME,
      receipt_slogan: DEFAULT_RECEIPT_SLOGAN,
      receipt_phone: DEFAULT_RECEIPT_PHONE,
      receipt_address: DEFAULT_RECEIPT_ADDRESS,
      receipt_website: DEFAULT_RECEIPT_WEBSITE,
      receipt_footer_message: DEFAULT_RECEIPT_FOOTER_MESSAGE,
      receipt_social_support: DEFAULT_RECEIPT_SOCIAL_SUPPORT,
    })
    .select(
      "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
    )
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message ?? "Failed to initialize receipt settings.");
  }

  return normalizeInvoiceSettingsRow(inserted);
});

export const updateAdminInvoiceSettings = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        receiptLogoUrl: z.string().trim().url().max(2000).nullable(),
        receiptStoreName: z.string().trim().min(1).max(120),
        receiptSlogan: z.string().trim().min(1).max(240),
        receiptPhone: z.string().trim().min(3).max(30),
        receiptAddress: z.string().trim().min(1).max(220),
        receiptWebsite: z.string().trim().min(1).max(200),
        taxId: z.string().trim().max(120).nullable(),
        receiptFooterMessage: z.string().trim().min(1).max(500),
        receiptSocialSupport: z.string().trim().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("invoice_settings")
      .update({
        store_name: data.receiptStoreName,
        address: data.receiptAddress,
        phone: data.receiptPhone,
        tax_id: data.taxId,
        footer_message: data.receiptFooterMessage,
        receipt_logo_url: data.receiptLogoUrl,
        receipt_store_name: data.receiptStoreName,
        receipt_slogan: data.receiptSlogan,
        receipt_phone: data.receiptPhone,
        receipt_address: data.receiptAddress,
        receipt_website: data.receiptWebsite,
        receipt_footer_message: data.receiptFooterMessage,
        receipt_social_support: data.receiptSocialSupport,
      })
      .eq("id", data.id)
      .select(
        "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
      )
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to save receipt settings.");
    }

    return updated as InvoiceSettingsRow;
  });

export const getGlobalSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data: singletonRow, error: singletonError } = await (supabaseAdmin as any)
    .from("global_settings")
    .select("id, global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active, site_name, site_logo_url, created_at, updated_at")
    .eq("id", GLOBAL_SETTINGS_SINGLETON_ID)
    .maybeSingle();

  if (singletonError) {
    throw new Error(singletonError.message ?? "Failed to load global settings.");
  }

  if (singletonRow?.id) {
    return normalizeGlobalSettingsRow(singletonRow);
  }

  const { data: fallbackRow, error: fallbackError } = await (supabaseAdmin as any)
    .from("global_settings")
    .select("global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active, site_name, site_logo_url")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw new Error(fallbackError.message ?? "Failed to load global settings.");
  }

  const { data: upserted, error: upsertError } = await (supabaseAdmin as any)
    .from("global_settings")
    .upsert(
      {
        id: GLOBAL_SETTINGS_SINGLETON_ID,
        global_delivery_fee: Number(fallbackRow?.global_delivery_fee ?? 10),
        minimum_order_amount: Number(fallbackRow?.minimum_order_amount ?? 50),
        free_delivery_threshold: Number(fallbackRow?.free_delivery_threshold ?? 500),
        marketplace_active: Boolean(fallbackRow?.marketplace_active ?? true),
        site_name: typeof fallbackRow?.site_name === "string" && fallbackRow.site_name.trim() ? fallbackRow.site_name.trim() : "Bzaf Fresh",
        site_logo_url:
          typeof fallbackRow?.site_logo_url === "string" && fallbackRow.site_logo_url.trim()
            ? fallbackRow.site_logo_url.trim()
            : null,
      },
      { onConflict: "id" },
    )
    .select("id, global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active, site_name, site_logo_url, created_at, updated_at")
    .single();

  if (upsertError || !upserted?.id) {
    throw new Error(upsertError?.message ?? "Failed to initialize global settings.");
  }

  return normalizeGlobalSettingsRow(upserted);
});

export const updateGlobalSettings = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        globalDeliveryFee: z.coerce.number().min(0).max(100000),
        minimumOrderAmount: z.coerce.number().min(0).max(100000),
        freeDeliveryThreshold: z.coerce.number().min(0).max(1000000),
        marketplaceActive: z.boolean(),
        siteName: z.string().trim().min(1).max(120),
        siteLogoUrl: z.string().trim().url().max(2000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("global_settings")
      .upsert(
        {
          id: GLOBAL_SETTINGS_SINGLETON_ID,
          global_delivery_fee: data.globalDeliveryFee,
          minimum_order_amount: data.minimumOrderAmount,
          free_delivery_threshold: data.freeDeliveryThreshold,
          marketplace_active: data.marketplaceActive,
          site_name: data.siteName,
          site_logo_url: data.siteLogoUrl,
        },
        { onConflict: "id" },
      )
      .select("id, global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active, site_name, site_logo_url, created_at, updated_at")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to save global settings.");
    }

    return normalizeGlobalSettingsRow(updated);
  });

const resetFactoryDataInputSchema = z.object({
  confirmationText: z.literal("RESET_ALL"),
});

export const resetFactoryData = createServerFn({ method: "POST" })
  .inputValidator((input) => resetFactoryDataInputSchema.parse(input))
  .handler(async () => {
    const wipeTable = async (tableName: string) => {
      const { error } = await (supabaseAdmin as any)
        .from(tableName)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        throw new Error(`Failed while clearing ${tableName}: ${error.message}`);
      }
    };

    const tablesInDeleteOrder = ["carnet_transactions", "carnet_payments", "orders"] as const;

    for (const tableName of tablesInDeleteOrder) {
      await wipeTable(tableName);
    }

    const { error: resetVendorsError } = await (supabaseAdmin as any)
      .from("vendors")
      .update({
        vendor_earnings: 0,
        platform_dues: 0,
        total_cash_received: 0,
        updated_at: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (resetVendorsError) {
      throw new Error(`Failed while resetting vendor balances: ${resetVendorsError.message}`);
    }

    const { error: resetCarnetError } = await (supabaseAdmin as any)
      .from("vendor_carnet")
      .update({
        current_debt: 0,
        updated_at: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (resetCarnetError) {
      throw new Error(`Failed while resetting carnet balances: ${resetCarnetError.message}`);
    }

    return {
      ok: true,
      message: "Orders and Carnet data reset completed, with vendor and carnet balances reset.",
    };
  });

export const uploadSiteLogo = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadSiteLogoInputSchema.parse(input))
  .handler(async ({ data }) => {
    if (!data.contentType.startsWith("image/")) {
      throw new Error("Only image uploads are allowed.");
    }

    const commaIndex = data.dataUrl.indexOf(",");
    if (commaIndex === -1) {
      throw new Error("Invalid image payload.");
    }

    const base64Payload = data.dataUrl.slice(commaIndex + 1);
    const bytes = Uint8Array.from(Buffer.from(base64Payload, "base64"));
    const extensionFromName = data.fileName.split(".").pop()?.toLowerCase() ?? "png";
    const safeBaseName = data.fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);
    const generatedFileName = `${crypto.randomUUID()}-${safeBaseName || "site-logo"}.${extensionFromName}`;
    const path = `branding/${generatedFileName}`;

    const { data: uploadData, error: uploadError } = await (supabaseAdmin as any).storage
      .from("public-assets")
      .upload(path, bytes, {
        contentType: data.contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError || !uploadData?.path) {
      throw new Error(uploadError?.message ?? "Image upload failed.");
    }

    const { data: publicUrlData } = (supabaseAdmin as any).storage.from("public-assets").getPublicUrl(uploadData.path);

    return {
      path: uploadData.path,
      publicUrl: publicUrlData.publicUrl,
    };
  });

export const listAdminCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const [profilesRes, ordersRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("profiles")
      .select("id, full_name, phone, address, created_at")
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any)
      .from("orders")
      .select("customer_phone, total_price, delivery_fee")
      .in("status", ["delivered", "cash_transferred_to_vendor"]),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const orderMetricsByPhone = new Map<string, { totalOrders: number; ltvMad: number }>();

  for (const row of (ordersRes.data ?? []) as AdminCustomerOrderAggregateRow[]) {
    const phone = row.customer_phone?.trim();
    if (!phone) continue;

    const current = orderMetricsByPhone.get(phone) ?? { totalOrders: 0, ltvMad: 0 };
    orderMetricsByPhone.set(phone, {
      totalOrders: current.totalOrders + 1,
      ltvMad: current.ltvMad + Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0),
    });
  }

  return ((profilesRes.data ?? []) as AdminCustomerProfileRow[]).map((profile) => {
    const phone = profile.phone?.trim() ?? "";
    const metrics = phone ? orderMetricsByPhone.get(phone) : undefined;

    return {
      id: profile.id,
      fullName: profile.full_name?.trim() || "—",
      phone: phone || "—",
      address: profile.address?.trim() || "—",
      joinedAt: profile.created_at,
      totalOrders: metrics?.totalOrders ?? 0,
      ltvMad: metrics?.ltvMad ?? 0,
    };
  });
});
