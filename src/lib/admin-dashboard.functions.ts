import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateCustomerBehavior, evaluateCustomersBehavior } from "@/utils/customerAlgorithm";
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
  vendor_id: string | null;
  subscription_id?: string | null;
  customer_name: string | null;
  customer_phone: string;
  contact_phone?: string | null;
  delivery_address?: string | null;
  pack_quantity?: number | null;
  total_price: number;
  item_count?: number;
  order_items?: unknown;
  status: AdminOrderStatus;
  created_at: string;
  order_category?: "MARKETPLACE" | "PLATFORM_SUBSCRIPTION";
  cyclist_id?: string | null;
  neighborhood_id?: string | null;
  delivery_fee?: number;
  cash_to_collect_from_customer?: number;
};

type PlatformPackRow = {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
  description: string | null;
  base_price_mad: number;
  billing_cycle: "DAILY" | "WEEKLY" | "MONTHLY";
  price_per_unit: number;
  unit_type: string;
  delivery_window: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PlatformPackItemRow = {
  id: string;
  pack_id: string;
  item_label: string;
  item_data?: unknown;
  sort_order: number;
};

type PlatformPackItemInput = {
  nameEn: string;
  nameFr?: string | null;
  nameAr?: string | null;
  imageUrl?: string | null;
  quantity?: number | null;
  unit?: string | null;
};

type PlatformPackItemValue = {
  nameEn: string;
  nameFr: string | null;
  nameAr: string | null;
  imageUrl: string | null;
  quantity: number | null;
  unit: string | null;
};

const platformPackItemInputSchema = z.object({
  nameEn: z.string().trim().min(1).max(200),
  nameFr: z.string().trim().max(200).nullable().optional(),
  nameAr: z.string().trim().max(200).nullable().optional(),
  imageUrl: z
    .string()
    .trim()
    .max(3_000_000)
    .refine((value) => {
      if (!value) return true;
      if (value.startsWith("data:image/")) return true;
      return z.string().url().max(2000).safeParse(value).success;
    }, "Must be a valid URL or image data URL.")
    .nullable()
    .optional(),
  quantity: z.number().min(0).max(100_000).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
});

function normalizePlatformPackItem(row: { item_label: string; item_data?: unknown }): PlatformPackItemValue {
  const data = row.item_data && typeof row.item_data === "object" && !Array.isArray(row.item_data)
    ? (row.item_data as Record<string, unknown>)
    : null;

  const nameEnFromData = typeof data?.name_en === "string"
    ? data.name_en.trim()
    : typeof data?.name === "string"
      ? data.name.trim()
      : "";
  const nameFrFromData = typeof data?.name_fr === "string" ? data.name_fr.trim() : "";
  const nameArFromData = typeof data?.name_ar === "string" ? data.name_ar.trim() : "";
  const nameFromLabel = typeof row.item_label === "string" ? row.item_label.trim() : "";

  const imageUrlRaw = typeof data?.image_url === "string" ? data.image_url.trim() : "";
  const unitRaw = typeof data?.unit === "string" ? data.unit.trim() : "";

  const quantitySource = data?.qty ?? data?.quantity;
  const quantityParsed =
    typeof quantitySource === "number"
      ? quantitySource
      : typeof quantitySource === "string"
        ? Number(quantitySource)
        : Number.NaN;

  return {
    nameEn: nameEnFromData || nameFromLabel,
    nameFr: nameFrFromData || null,
    nameAr: nameArFromData || null,
    imageUrl: imageUrlRaw || null,
    quantity: Number.isFinite(quantityParsed) && quantityParsed >= 0 ? Number(quantityParsed) : null,
    unit: unitRaw || null,
  };
}

function serializePlatformPackItem(item: PlatformPackItemInput) {
  return {
    name_en: item.nameEn,
    name_fr: item.nameFr ?? null,
    name_ar: item.nameAr ?? null,
    image_url: item.imageUrl ?? null,
    qty: item.quantity ?? null,
    unit: item.unit ?? null,
  };
}

type PlatformPackFeatureRow = {
  id: string;
  pack_id: string;
  feature_label: string;
  feature_data?: unknown;
  sort_order: number;
};

type PlatformPackFeatureInput = {
  textEn: string;
  textFr?: string | null;
  textAr?: string | null;
};

type PlatformPackFeatureValue = {
  textEn: string;
  textFr: string | null;
  textAr: string | null;
};

const platformPackFeatureInputSchema = z.object({
  textEn: z.string().trim().min(1).max(200),
  textFr: z.string().trim().max(200).nullable().optional(),
  textAr: z.string().trim().max(200).nullable().optional(),
});

function normalizePlatformPackFeature(row: { feature_label: string; feature_data?: unknown }): PlatformPackFeatureValue {
  const data = row.feature_data && typeof row.feature_data === "object" && !Array.isArray(row.feature_data)
    ? (row.feature_data as Record<string, unknown>)
    : null;

  const textEnFromData = typeof data?.text_en === "string" ? data.text_en.trim() : "";
  const textFrFromData = typeof data?.text_fr === "string" ? data.text_fr.trim() : "";
  const textArFromData = typeof data?.text_ar === "string" ? data.text_ar.trim() : "";
  const textFromLabel = typeof row.feature_label === "string" ? row.feature_label.trim() : "";

  return {
    textEn: textEnFromData || textFromLabel,
    textFr: textFrFromData || null,
    textAr: textArFromData || null,
  };
}

function serializePlatformPackFeature(feature: PlatformPackFeatureInput) {
  return {
    text_en: feature.textEn,
    text_fr: feature.textFr ?? null,
    text_ar: feature.textAr ?? null,
  };
}

type PlatformSubscriptionStatus = "pending" | "active" | "paused" | "expired" | "cancelled" | "completed";

type PlatformSubscriptionRow = {
  id: string;
  customer_user_id: string;
  customer_name: string;
  customer_phone: string | null;
  contact_phone: string | null;
  delivery_address: string | null;
  pack_quantity: number | null;
  pack_id: string;
  status: PlatformSubscriptionStatus;
  start_date: string;
  expiration_date: string | null;
  next_scheduled_delivery_date: string | null;
  lifetime_revenue_mad: number;
  agreed_price: number | null;
  total_deliveries: number | null;
  completed_deliveries: number;
  deliveries_completed: number;
  deliveries_expected: number;
  created_at: string;
};

type PlatformSubscriptionOrderHistoryRow = {
  id: string;
  created_at: string;
  delivered_at: string | null;
  status: AdminOrderStatus;
  cyclist_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  item_count: number | null;
  total_price: number | null;
  cash_to_collect_from_customer: number | null;
  order_items: unknown;
};

const platformPackInputSchema = z.object({
  nameEn: z.string().trim().min(1).max(160),
  nameFr: z.string().trim().max(160).nullable().optional(),
  nameAr: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(1200).nullable().optional(),
  basePriceMad: z.number().min(0).max(1_000_000),
  billingCycle: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  unitType: z.string().trim().min(1).max(40),
  deliveryWindow: z.string().trim().max(120).nullable().optional(),
  packItems: z.array(platformPackItemInputSchema).max(80).default([]),
  packFeatures: z.array(platformPackFeatureInputSchema).max(80).default([]),
  imageUrl: z.string().trim().url().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
});

const updatePlatformPackInputSchema = platformPackInputSchema.extend({
  id: z.string().uuid(),
});

const deletePlatformPackInputSchema = z.object({
  id: z.string().uuid(),
});

const assignSubscriptionOrderCyclistInputSchema = z.object({
  orderId: z.string().uuid(),
  cyclistId: z.string().uuid(),
});

const autoDispatchSubscriptionOrderInputSchema = z.object({
  orderId: z.string().uuid(),
});

const updateSubscriptionOrderStatusInputSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["new", "preparing", "ready", "delivering", "delivered", "cancelled"]),
});

const updatePlatformSubscriberStatusInputSchema = z.object({
  subscriptionId: z.string().uuid(),
  status: z.enum(["pending", "active", "paused", "expired", "cancelled", "completed"]),
});

const activatePlatformSubscriberInputSchema = z.object({
  subscriptionId: z.string().uuid(),
  agreedPriceMad: z.number().positive().max(1_000_000),
  totalDeliveries: z.number().int().min(1).max(365),
});

const getPlatformSubscriberHistoryInputSchema = z.object({
  subscriptionId: z.string().uuid(),
});

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
  status: "active" | "vip" | "warning" | "suspicious" | "blocked";
  risk_score: "low" | "medium" | "high";
  strikes: number;
  cod_rejections: number;
  admin_notes: string | null;
  lifetime_value: number | null;
  system_tags: string[] | null;
};

type AdminCustomerOrderAggregateRow = {
  id: string;
  customer_user_id: string | null;
  status: string;
  customer_phone: string | null;
  total_price: number | null;
  delivery_fee: number | null;
  created_at: string;
};

const adminCustomerListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["all", "active", "vip", "warning", "suspicious", "blocked"]).default("all"),
  risk: z.enum(["all", "low", "medium", "high"]).default("all"),
  sortBy: z.enum(["newest", "highest_ltv", "most_strikes"]).default("newest"),
});

const updateAdminCustomerStateInputSchema = z.object({
  customerId: z.string().uuid(),
  status: z.enum(["active", "vip", "warning", "suspicious", "blocked"]),
  riskScore: z.enum(["low", "medium", "high"]).optional(),
  strikesDelta: z.number().int().min(-10).max(10).optional(),
  resetStrikes: z.boolean().optional(),
  addCodRejection: z.boolean().optional(),
});

const updateAdminCustomerNotesInputSchema = z.object({
  customerId: z.string().uuid(),
  adminNotes: z.string().trim().max(5_000),
});

const getAdminCustomerProfileInputSchema = z.object({
  customerId: z.string().uuid(),
});

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

const uploadPlatformPackAssetInputSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  dataUrl: z.string().trim().min(1).max(12_000_000),
  folder: z.enum(["platform-packs", "platform-packs/items"]),
});

export const getAdminOverviewAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const now = new Date();
  const todayStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const tomorrowStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const weekStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const todayStartIso = todayStartDate.toISOString();
  const yesterdayStartIso = yesterdayStartDate.toISOString();
  const tomorrowStartIso = tomorrowStartDate.toISOString();
  const weekStartIso = weekStartDate.toISOString();
  const todayStartMs = todayStartDate.getTime();

  const [ordersRes, neighborhoodsRes, vendorsRes, masterProductsRes, brandsRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("orders")
      .select(
        "id, vendor_id, total_price, vendor_revenue, delivery_fee, platform_profit, created_at, delivered_at, neighborhood_id, status, order_items",
      )
      .gte("created_at", yesterdayStartIso)
      .lt("created_at", tomorrowStartIso),
    (supabaseAdmin as any).from("neighborhoods").select("id, zone_code, name_en"),
    (supabaseAdmin as any).from("vendors").select("id, store_name"),
    (supabaseAdmin as any).from("master_products").select("id, category, brand_id"),
    (supabaseAdmin as any).from("brands").select("id, name_en"),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (neighborhoodsRes.error) throw new Error(neighborhoodsRes.error.message);
  if (vendorsRes.error) throw new Error(vendorsRes.error.message);
  if (masterProductsRes.error) throw new Error(masterProductsRes.error.message);
  if (brandsRes.error) throw new Error(brandsRes.error.message);

  type DashboardOrderRow = {
    id: string;
    vendor_id: string | null;
    total_price: number | null;
    vendor_revenue: number | null;
    delivery_fee: number | null;
    platform_profit: number | null;
    created_at: string;
    delivered_at: string | null;
    neighborhood_id: string | null;
    status: string;
    order_items: unknown;
  };

  const orders = (ordersRes.data ?? []) as DashboardOrderRow[];
  const neighborhoods = (neighborhoodsRes.data ?? []) as Array<{ id: string; zone_code: string | null; name_en: string | null }>;
  const vendors = (vendorsRes.data ?? []) as Array<{ id: string; store_name: string | null }>;
  const products = (masterProductsRes.data ?? []) as Array<{ id: string; category: string | null; brand_id: string | null }>;
  const brands = (brandsRes.data ?? []) as Array<{ id: string; name_en: string | null }>;

  const fetchLedgerTotals = async () => {
    const pageSize = 1000;
    let from = 0;
    let total = 0;
    let beforeToday = 0;

    while (true) {
      const to = from + pageSize - 1;
      const ledgerPageRes = await (supabaseAdmin as any)
        .from("platform_commission_ledger")
        .select("amount, created_at")
        .order("created_at", { ascending: true })
        .range(from, to);

      if (ledgerPageRes.error) {
        throw new Error(ledgerPageRes.error.message);
      }

      const rows = (ledgerPageRes.data ?? []) as Array<{ amount: number | null; created_at: string | null }>;
      if (rows.length === 0) break;

      for (const row of rows) {
        const amount = Number(row.amount ?? 0);
        total += amount;

        const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
        if (Number.isFinite(createdAtMs) && createdAtMs < todayStartMs) {
          beforeToday += amount;
        }
      }

      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return { total, beforeToday };
  };

  const { total: ledgerGrandTotal, beforeToday: ledgerBeforeToday } = await fetchLedgerTotals();

  const neighborhoodById = new Map(
    neighborhoods.map((neighborhood) => [
      neighborhood.id,
      {
        zoneCode: neighborhood.zone_code?.trim() || "Unassigned",
        neighborhoodName: neighborhood.name_en?.trim() || "Unknown",
      },
    ]),
  );

  const vendorNameById = new Map(vendors.map((vendor) => [vendor.id, vendor.store_name?.trim() || "Unknown Vendor"]));
  const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name_en?.trim() || "Unknown Brand"]));
  const productMetaById = new Map(
    products.map((product) => [
      product.id,
      {
        category: product.category?.trim() || "Unknown Category",
        brandName: product.brand_id ? (brandNameById.get(product.brand_id) ?? "Unknown Brand") : "Unknown Brand",
      },
    ]),
  );

  const isInWindow = (createdAt: string, start: Date, end: Date) => {
    const date = new Date(createdAt);
    return date >= start && date < end;
  };

  const sumBy = (rows: DashboardOrderRow[], selector: (row: DashboardOrderRow) => number) =>
    rows.reduce((sum, row) => sum + selector(row), 0);

  const todayOrders = orders.filter((order) => isInWindow(order.created_at, todayStartDate, tomorrowStartDate));
  const yesterdayOrders = orders.filter((order) => isInWindow(order.created_at, yesterdayStartDate, todayStartDate));
  const last7DaysOrders = orders.filter((order) => isInWindow(order.created_at, weekStartDate, tomorrowStartDate));

  const buildKpi = (
    todayValue: number,
    previousValue: number,
    format: "integer" | "currency",
  ) => {
    const change = todayValue - previousValue;
    const changePercentage = previousValue > 0 ? (change / previousValue) * 100 : todayValue > 0 ? 100 : 0;

    return {
      value: todayValue,
      previousValue,
      change,
      changePercentage,
      format,
    };
  };

  const todayActiveVendorIds = new Set(todayOrders.map((order) => order.vendor_id).filter((vendorId): vendorId is string => !!vendorId));
  const yesterdayActiveVendorIds = new Set(
    yesterdayOrders.map((order) => order.vendor_id).filter((vendorId): vendorId is string => !!vendorId),
  );

  const finalizedStatuses = new Set(["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"]);
  const todaySuccessfulOrders = todayOrders.filter((order) => finalizedStatuses.has(order.status));
  const yesterdaySuccessfulOrders = yesterdayOrders.filter((order) => finalizedStatuses.has(order.status));

  const totalOrdersKpi = buildKpi(todayOrders.length, yesterdayOrders.length, "integer");
  const activeVendorsKpi = buildKpi(todayActiveVendorIds.size, yesterdayActiveVendorIds.size, "integer");
  const totalGrossVolumeKpi = buildKpi(
    sumBy(todaySuccessfulOrders, (order) => Number(order.total_price ?? 0)),
    sumBy(yesterdaySuccessfulOrders, (order) => Number(order.total_price ?? 0)),
    "currency",
  );
  const vendorsRevenueKpi = buildKpi(
    sumBy(todayOrders, (order) => Number(order.vendor_revenue ?? 0)),
    sumBy(yesterdayOrders, (order) => Number(order.vendor_revenue ?? 0)),
    "currency",
  );
  const cyclistsEarningsKpi = buildKpi(
    sumBy(todaySuccessfulOrders, (order) => Number(order.delivery_fee ?? 0)),
    sumBy(yesterdaySuccessfulOrders, (order) => Number(order.delivery_fee ?? 0)),
    "currency",
  );
  const platformProfitKpi = buildKpi(ledgerGrandTotal, ledgerBeforeToday, "currency");

  const dayMap = new Map<string, { day: string; label: string; orders: number; revenue: number }>();
  for (let i = 0; i < 7; i += 1) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const dayKey = dayDate.toISOString().slice(0, 10);
    dayMap.set(dayKey, {
      day: dayKey,
      label: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
      orders: 0,
      revenue: 0,
    });
  }

  for (const order of last7DaysOrders) {
    const dayKey = order.created_at.slice(0, 10);
    const bucket = dayMap.get(dayKey);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue += Number(order.total_price ?? 0);
  }
  const salesOrdersTrends = Array.from(dayMap.values());

  const zonePerformanceMap = new Map<string, { zone: string; orders: number; revenue: number; vendorIds: Set<string> }>();
  const zoneSpeedMap = new Map<string, { zone: string; neighborhood: string; totalMinutes: number; deliveries: number }>();
  const neighborhoodHotspotMap = new Map<string, { neighborhood: string; zone: string; orders: number; revenue: number }>();
  const brandInsightsMap = new Map<string, { name: string; orders: number; revenue: number; quantity: number }>();
  const categoryInsightsMap = new Map<string, { name: string; orders: number; revenue: number; quantity: number }>();

  for (const order of last7DaysOrders) {
    const neighborhoodMeta = order.neighborhood_id ? neighborhoodById.get(order.neighborhood_id) : null;
    const zoneName = neighborhoodMeta?.zoneCode ?? "Unassigned";
    const neighborhoodName = neighborhoodMeta?.neighborhoodName ?? "Unknown";

    const zoneBucket = zonePerformanceMap.get(zoneName) ?? {
      zone: zoneName,
      orders: 0,
      revenue: 0,
      vendorIds: new Set<string>(),
    };
    zoneBucket.orders += 1;
    zoneBucket.revenue += Number(order.total_price ?? 0);
    if (order.vendor_id) {
      zoneBucket.vendorIds.add(order.vendor_id);
    }
    zonePerformanceMap.set(zoneName, zoneBucket);

    const hotspotBucket = neighborhoodHotspotMap.get(neighborhoodName) ?? {
      neighborhood: neighborhoodName,
      zone: zoneName,
      orders: 0,
      revenue: 0,
    };
    hotspotBucket.orders += 1;
    hotspotBucket.revenue += Number(order.total_price ?? 0);
    neighborhoodHotspotMap.set(neighborhoodName, hotspotBucket);

    if (order.delivered_at && finalizedStatuses.has(order.status)) {
      const createdAtMs = new Date(order.created_at).getTime();
      const deliveredAtMs = new Date(order.delivered_at).getTime();
      if (Number.isFinite(createdAtMs) && Number.isFinite(deliveredAtMs) && deliveredAtMs >= createdAtMs) {
        const durationMinutes = (deliveredAtMs - createdAtMs) / (1000 * 60);
        const zoneSpeed = zoneSpeedMap.get(zoneName) ?? {
          zone: zoneName,
          neighborhood: neighborhoodName,
          totalMinutes: 0,
          deliveries: 0,
        };
        zoneSpeed.totalMinutes += durationMinutes;
        zoneSpeed.deliveries += 1;
        zoneSpeedMap.set(zoneName, zoneSpeed);
      }
    }

    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
    const seenBrandsForOrder = new Set<string>();
    const seenCategoriesForOrder = new Set<string>();

    for (const rawItem of orderItems) {
      const item = typeof rawItem === "object" && rawItem !== null ? (rawItem as Record<string, unknown>) : null;
      if (!item) continue;
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unitPriceMad ?? item.unit_price_mad ?? item.price ?? 0);
      const itemRevenue = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
      const productId = typeof item.productId === "string" ? item.productId : null;

      const fallbackBrand = typeof item.brandName === "string" && item.brandName.trim().length > 0 ? item.brandName.trim() : "Unknown Brand";
      const mappedBrand = productId ? productMetaById.get(productId)?.brandName : null;
      const brandName = mappedBrand ?? fallbackBrand;
      const brandBucket = brandInsightsMap.get(brandName) ?? { name: brandName, orders: 0, revenue: 0, quantity: 0 };
      if (!seenBrandsForOrder.has(brandName)) {
        brandBucket.orders += 1;
        seenBrandsForOrder.add(brandName);
      }
      brandBucket.revenue += itemRevenue;
      brandBucket.quantity += Number.isFinite(quantity) ? quantity : 0;
      brandInsightsMap.set(brandName, brandBucket);

      const mappedCategory = productId ? productMetaById.get(productId)?.category : null;
      const categoryName = mappedCategory ?? "Unknown Category";
      const categoryBucket = categoryInsightsMap.get(categoryName) ?? {
        name: categoryName,
        orders: 0,
        revenue: 0,
        quantity: 0,
      };
      if (!seenCategoriesForOrder.has(categoryName)) {
        categoryBucket.orders += 1;
        seenCategoriesForOrder.add(categoryName);
      }
      categoryBucket.revenue += itemRevenue;
      categoryBucket.quantity += Number.isFinite(quantity) ? quantity : 0;
      categoryInsightsMap.set(categoryName, categoryBucket);
    }
  }

  const zonePerformance = Array.from(zonePerformanceMap.values())
    .map((zone) => ({
      zone: zone.zone,
      orders: zone.orders,
      revenue: zone.revenue,
      activeVendors: zone.vendorIds.size,
    }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

  const topZones = zonePerformance.slice(0, 3);
  const bottomZones = [...zonePerformance].sort((a, b) => a.orders - b.orders || a.revenue - b.revenue).slice(0, 3);

  const deliverySpeedByZone = Array.from(zoneSpeedMap.values())
    .map((zone) => ({
      zone: zone.zone,
      neighborhood: zone.neighborhood,
      avgMinutes: zone.deliveries > 0 ? zone.totalMinutes / zone.deliveries : 0,
      deliveries: zone.deliveries,
    }))
    .sort((a, b) => a.avgMinutes - b.avgMinutes);

  const fastestZoneNames = new Set(deliverySpeedByZone.slice(0, 2).map((zone) => zone.zone));
  const slowestZoneNames = new Set([...deliverySpeedByZone].reverse().slice(0, 2).map((zone) => zone.zone));

  const deliverySpeedMetrics: Array<{
    zone: string;
    neighborhood: string;
    avgMinutes: number;
    deliveries: number;
    performance: "fast" | "slow" | "normal";
  }> = deliverySpeedByZone.map((zone) => ({
    ...zone,
    performance: fastestZoneNames.has(zone.zone)
      ? "fast"
      : slowestZoneNames.has(zone.zone)
        ? "slow"
        : "normal",
  }));

  const topNeighborhoods = Array.from(neighborhoodHotspotMap.values())
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
    .slice(0, 6);

  const topBrands = Array.from(brandInsightsMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, 6);

  const topCategories = Array.from(categoryInsightsMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, 6);

  return {
    kpis: {
      totalOrders: totalOrdersKpi,
      activeVendors: activeVendorsKpi,
      totalGrossVolume: totalGrossVolumeKpi,
      vendorsRevenue: vendorsRevenueKpi,
      cyclistsEarnings: cyclistsEarningsKpi,
      platformProfit: platformProfitKpi,
    },
    salesOrdersTrends,
    zonePerformance: {
      top: topZones,
      bottom: bottomZones,
    },
    deliverySpeedMetrics,
    marketInsights: {
      topNeighborhoods,
      topBrands,
      topCategories,
    },
    metadata: {
      generatedAt: now.toISOString(),
      vendorNames: Object.fromEntries(vendorNameById.entries()),
    },
  };
});

type BrandScoreRow = {
  brand_id: string;
  base_score: number;
  trending_velocity: number;
  active_until: string;
  is_trending: boolean;
  is_blacklisted: boolean;
  manual_boost_until: string | null;
  last_updated: string;
};

type BrandCatalogRow = {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
  logo_url: string | null;
  created_at: string;
};

type BrandEventRow = {
  brand_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const brandScoreActionInputSchema = z.object({
  brandId: z.string().uuid(),
});

const brandBlacklistActionInputSchema = z.object({
  brandId: z.string().uuid(),
  blacklisted: z.boolean(),
});

const BRAND_TRENDING_THRESHOLD = 120;

const BRAND_ENGINE_DEMO_DATA: Array<{
  id: string;
  brandName: string;
  baseScore: number;
  activeDays: number;
  trendingVelocity: number;
}> = [
  {
    id: "7b3db6ba-7932-4d5f-8f85-58f2efc7fb71",
    brandName: "Atlas Fresh",
    baseScore: 154,
    activeDays: 12,
    trendingVelocity: 24.8,
  },
  {
    id: "cd4704e8-4f4d-4a53-91c3-4efe124ea462",
    brandName: "Casablanca Market",
    baseScore: 131,
    activeDays: 8,
    trendingVelocity: 11.2,
  },
  {
    id: "9d8b5fdf-6a75-4095-aab8-76be260f7b96",
    brandName: "Sahara Select",
    baseScore: 96,
    activeDays: 4,
    trendingVelocity: -6.5,
  },
];

export const getBrandEngineAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  await (supabaseAdmin as any).rpc("refresh_brand_scores");

  const now = Date.now();
  const in24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const in48h = new Date(now - 48 * 60 * 60 * 1000).toISOString();

  const [scoresRes, brandsRes, eventsRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("brand_scores")
      .select(
        "brand_id, base_score, trending_velocity, active_until, is_trending, is_blacklisted, manual_boost_until, last_updated",
      )
      .order("base_score", { ascending: false }),
    (supabaseAdmin as any).from("brands").select("id, name_en, name_fr, name_ar, logo_url, created_at"),
    (supabaseAdmin as any)
      .from("brand_analytics_events")
      .select("brand_id, event_type, metadata, created_at")
      .gte("created_at", in48h),
  ]);

  if (scoresRes.error) throw new Error(scoresRes.error.message);
  if (brandsRes.error) throw new Error(brandsRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const scores = (scoresRes.data ?? []) as BrandScoreRow[];
  const brands = (brandsRes.data ?? []) as BrandCatalogRow[];
  const events = (eventsRes.data ?? []) as BrandEventRow[];

  const brandById = new Map(brands.map((brand) => [brand.id, brand]));

  const metricsByBrand = new Map<
    string,
    {
      orders24h: number;
      ordersPrev24h: number;
      cart24h: number;
      search24h: number;
      views24h: number;
      suspiciousClicks24h: number;
    }
  >();

  for (const event of events) {
    const eventMs = new Date(event.created_at).getTime();
    const isIn24h = Number.isFinite(eventMs) && eventMs >= new Date(in24h).getTime();
    const isInPrev24h = Number.isFinite(eventMs) && eventMs >= new Date(in48h).getTime() && eventMs < new Date(in24h).getTime();

    const current = metricsByBrand.get(event.brand_id) ?? {
      orders24h: 0,
      ordersPrev24h: 0,
      cart24h: 0,
      search24h: 0,
      views24h: 0,
      suspiciousClicks24h: 0,
    };

    const normalizedType = event.event_type?.toLowerCase();
    const suspicious = event.metadata && (event.metadata.suspicious === true || event.metadata.rate_limited === true);

    if (isIn24h) {
      if (normalizedType === "order") current.orders24h += 1;
      if (normalizedType === "cart") current.cart24h += 1;
      if (normalizedType === "search") current.search24h += 1;
      if (normalizedType === "view") {
        current.views24h += 1;
        if (suspicious) current.suspiciousClicks24h += 1;
      }
    }

    if (isInPrev24h && normalizedType === "order") {
      current.ordersPrev24h += 1;
    }

    metricsByBrand.set(event.brand_id, current);
  }

  const rows = scores
    .map((score) => {
      const brand = brandById.get(score.brand_id);
      if (!brand) return null;

      const metrics = metricsByBrand.get(score.brand_id) ?? {
        orders24h: 0,
        ordersPrev24h: 0,
        cart24h: 0,
        search24h: 0,
        views24h: 0,
        suspiciousClicks24h: 0,
      };

      const activeMs = new Date(score.active_until).getTime() - now;
      const activeDays = Math.max(activeMs / (1000 * 60 * 60 * 24), 0);
      const velocityRatio = metrics.ordersPrev24h > 0
        ? (metrics.orders24h - metrics.ordersPrev24h) / metrics.ordersPrev24h
        : metrics.orders24h > 0
          ? 1
          : 0;

      return {
        id: score.brand_id,
        name: brand.name_en,
        logoUrl: brand.logo_url,
        createdAt: brand.created_at,
        score: Number(score.base_score ?? 0),
        activeUntil: score.active_until,
        activeDays,
        isTrending: Boolean(score.is_trending),
        isBlacklisted: Boolean(score.is_blacklisted),
        manualBoostUntil: score.manual_boost_until,
        trendingVelocity: Number(score.trending_velocity ?? 0),
        orders24h: metrics.orders24h,
        cart24h: metrics.cart24h,
        search24h: metrics.search24h,
        views24h: metrics.views24h,
        suspiciousClicks24h: metrics.suspiciousClicks24h,
        orderVelocityRatio24h: velocityRatio,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const top5 = rows
    .filter((row) => !row.isBlacklisted)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const discoveryCandidates = rows.filter((row) => {
    const createdAtMs = new Date(row.createdAt).getTime();
    const isNewBrand = Number.isFinite(createdAtMs) && createdAtMs >= now - 30 * 24 * 60 * 60 * 1000;
    return isNewBrand || (!row.isTrending && row.score < BRAND_TRENDING_THRESHOLD);
  });

  const discoveryOrders = discoveryCandidates.reduce((sum, row) => sum + row.orders24h, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.orders24h, 0);

  const activeTrendingBrands = rows.filter(
    (row) => row.isTrending && row.score > BRAND_TRENDING_THRESHOLD && !row.isBlacklisted,
  ).length;
  const conversionVelocity = top5.length > 0
    ? top5.reduce((sum, row) => sum + row.trendingVelocity, 0) / top5.length
    : 0;
  const expiringSoon = rows.filter((row) => {
    const diff = new Date(row.activeUntil).getTime() - now;
    return diff > 0 && diff <= 6 * 60 * 60 * 1000;
  }).length;
  const discoveryRate = totalOrders > 0 ? (discoveryOrders / totalOrders) * 100 : 0;

  const chartData = top5.map((row) => ({
    brand: row.name,
    orderVelocity: Number((row.orderVelocityRatio24h * 100).toFixed(2)),
    searchVolume: row.search24h,
  }));

  return {
    kpis: {
      activeTrendingBrands,
      conversionVelocity,
      expiringSoon,
      discoveryRate,
    },
    chartData,
    tableRows: rows,
    generatedAt: new Date().toISOString(),
    threshold: BRAND_TRENDING_THRESHOLD,
  };
});

export const manualBoostBrandScore = createServerFn({ method: "POST" })
  .inputValidator((input) => brandScoreActionInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("brand_scores")
      .update({
        base_score: 50,
        manual_boost_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        active_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        last_updated: new Date().toISOString(),
      })
      .eq("brand_id", data.brandId)
      .select("brand_id")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Failed to apply manual boost.");
    }

    return { ok: true };
  });

export const setBrandBlacklistState = createServerFn({ method: "POST" })
  .inputValidator((input) => brandBlacklistActionInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("brand_scores")
      .update({
        is_blacklisted: data.blacklisted,
        last_updated: new Date().toISOString(),
      })
      .eq("brand_id", data.brandId)
      .select("brand_id")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Failed to update blacklist state.");
    }

    return { ok: true };
  });

export const resetBrandEngineScore = createServerFn({ method: "POST" })
  .inputValidator((input) => brandScoreActionInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("brand_scores")
      .update({
        base_score: 0,
        trending_velocity: 0,
        is_trending: false,
        is_blacklisted: false,
        manual_boost_until: null,
        active_until: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        last_updated: new Date().toISOString(),
      })
      .eq("brand_id", data.brandId)
      .select("brand_id")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Failed to reset score.");
    }

    return { ok: true };
  });

export const seedBrandEngineDemoData = createServerFn({ method: "POST" }).handler(async () => {
  const now = Date.now();

  const { error: brandsError } = await (supabaseAdmin as any).from("brands").upsert(
    BRAND_ENGINE_DEMO_DATA.map((brand) => ({
      id: brand.id,
      name_en: brand.brandName,
      name_fr: brand.brandName,
      name_ar: brand.brandName,
      logo_url: null,
      created_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" },
  );

  if (brandsError) {
    throw new Error(brandsError.message ?? "Failed to seed demo brands.");
  }

  const { error: scoresError } = await (supabaseAdmin as any).from("brand_scores").upsert(
    BRAND_ENGINE_DEMO_DATA.map((brand) => ({
      brand_id: brand.id,
      base_score: brand.baseScore,
      trending_velocity: brand.trendingVelocity,
      active_until: new Date(now + brand.activeDays * 24 * 60 * 60 * 1000).toISOString(),
      is_trending: brand.baseScore >= BRAND_TRENDING_THRESHOLD,
      is_blacklisted: false,
      manual_boost_until: null,
      last_updated: new Date().toISOString(),
    })),
    { onConflict: "brand_id" },
  );

  if (scoresError) {
    throw new Error(scoresError.message ?? "Failed to seed demo brand scores.");
  }

  return { ok: true };
});

export const listAdminOrders = createServerFn({ method: "GET" }).handler(async () => {
  const [ordersRes, vendorsRes, cyclistsRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("orders")
      .select(
        "id, vendor_id, subscription_id, customer_name, customer_phone, total_price, item_count, order_items, status, created_at, order_category, cyclist_id, neighborhood_id, cash_to_collect_from_customer, delivery_notes",
      )
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any).from("vendors").select("id, store_name"),
    (supabaseAdmin as any).from("cyclists").select("id, full_name"),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (vendorsRes.error) throw new Error(vendorsRes.error.message);
  if (cyclistsRes.error) throw new Error(cyclistsRes.error.message);

  const vendorMap = new Map(
    ((vendorsRes.data ?? []) as AdminVendorRow[]).map((vendor) => [vendor.id, vendor.store_name]),
  );
  const cyclistMap = new Map(
    ((cyclistsRes.data ?? []) as Array<{ id: string; full_name: string }>).map((cyclist) => [
      cyclist.id,
      cyclist.full_name,
    ]),
  );

  const orders = (ordersRes.data ?? []) as AdminOrderRow[];
  const subscriptionIds = Array.from(
    new Set(
      orders
        .map((order) => order.subscription_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  let subscriptionStatusById = new Map<string, PlatformSubscriptionStatus>();
  let subscriptionMetaById = new Map<string, { contactPhone: string | null; deliveryAddress: string | null; packQuantity: number | null }>();
  if (subscriptionIds.length > 0) {
    const { data: subscriptions, error: subscriptionsError } = await (supabaseAdmin as any)
      .from("platform_subscriptions")
      .select("id, status, contact_phone, delivery_address, pack_quantity")
      .in("id", subscriptionIds);

    if (subscriptionsError) {
      throw new Error(subscriptionsError.message);
    }

    subscriptionStatusById = new Map(
      ((subscriptions ?? []) as Array<{ id: string; status: PlatformSubscriptionStatus }>).map((row) => [row.id, row.status]),
    );
    subscriptionMetaById = new Map(
      ((subscriptions ?? []) as Array<{ id: string; contact_phone: string | null; delivery_address: string | null; pack_quantity: number | null }>).map((row) => [
        row.id,
        {
          contactPhone: row.contact_phone,
          deliveryAddress: row.delivery_address,
          packQuantity: row.pack_quantity,
        },
      ]),
    );
  }

  return orders.map((order) => ({
    ...(order.subscription_id ? subscriptionMetaById.get(order.subscription_id) ?? { contactPhone: null, deliveryAddress: null, packQuantity: null } : { contactPhone: null, deliveryAddress: null, packQuantity: null }),
    id: order.id,
    subscriptionId: order.subscription_id ?? null,
    subscriptionStatus:
      typeof order.subscription_id === "string" && order.subscription_id.length > 0
        ? (subscriptionStatusById.get(order.subscription_id) ?? null)
        : null,
    createdAt: order.created_at,
    customerName: order.customer_name?.trim() || "Unknown Customer",
    customerPhone: order.customer_phone ?? "—",
    totalPrice: Number(order.total_price ?? 0),
    itemCount: Number(order.item_count ?? 0),
    orderItems: Array.isArray(order.order_items) ? order.order_items : [],
    status: order.status,
    orderCategory: order.order_category ?? "MARKETPLACE",
    cyclistId: order.cyclist_id ?? null,
    cyclistName: order.cyclist_id ? (cyclistMap.get(order.cyclist_id) ?? "Unknown Cyclist") : null,
    neighborhoodId: order.neighborhood_id ?? null,
    cashToCollectFromCustomer: Number(order.cash_to_collect_from_customer ?? 0),
    vendorName: order.vendor_id ? (vendorMap.get(order.vendor_id) ?? "Unknown Vendor") : "Platform Direct",
  }));
});

export const listPlatformPacks = createServerFn({ method: "GET" }).handler(async () => {
  const [packsRes, itemsRes, featuresRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("platform_packs")
      .select(
        "id, name_en, name_fr, name_ar, description, base_price_mad, billing_cycle, price_per_unit, unit_type, delivery_window, image_url, is_active, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any).from("pack_items").select("id, pack_id, item_label, item_data, sort_order").order("sort_order", { ascending: true }),
    (supabaseAdmin as any)
      .from("pack_features")
      .select("id, pack_id, feature_label, feature_data, sort_order")
      .order("sort_order", { ascending: true }),
  ]);

  if (packsRes.error) throw new Error(packsRes.error.message ?? "Failed to load platform packs.");
  if (itemsRes.error) throw new Error(itemsRes.error.message ?? "Failed to load pack items.");
  if (featuresRes.error) throw new Error(featuresRes.error.message ?? "Failed to load pack features.");

  const itemMap = new Map<string, PlatformPackItemValue[]>();
  for (const row of (itemsRes.data ?? []) as PlatformPackItemRow[]) {
    const current = itemMap.get(row.pack_id) ?? [];
    current.push(normalizePlatformPackItem(row));
    itemMap.set(row.pack_id, current);
  }

  const featureMap = new Map<string, PlatformPackFeatureValue[]>();
  for (const row of (featuresRes.data ?? []) as PlatformPackFeatureRow[]) {
    const current = featureMap.get(row.pack_id) ?? [];
    current.push(normalizePlatformPackFeature(row));
    featureMap.set(row.pack_id, current);
  }

  return ((packsRes.data ?? []) as PlatformPackRow[]).map((row) => ({
    id: row.id,
    nameEn: row.name_en,
    nameFr: row.name_fr,
    nameAr: row.name_ar,
    description: row.description,
    basePriceMad: Number(row.base_price_mad ?? row.price_per_unit ?? 0),
    billingCycle: row.billing_cycle,
    unitType: row.unit_type,
    deliveryWindow: row.delivery_window,
    packItems: itemMap.get(row.id) ?? [],
    packFeatures: featureMap.get(row.id) ?? [],
    imageUrl: row.image_url,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

export const createPlatformPack = createServerFn({ method: "POST" })
  .inputValidator((input) => platformPackInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("platform_packs")
      .insert({
        name_en: data.nameEn,
        name_fr: data.nameFr ?? null,
        name_ar: data.nameAr ?? null,
        description: data.description ?? null,
        base_price_mad: data.basePriceMad,
        billing_cycle: data.billingCycle,
        price_per_unit: data.basePriceMad,
        unit_type: data.unitType,
        delivery_window: data.deliveryWindow ?? null,
        image_url: data.imageUrl ?? null,
        is_active: data.isActive,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      throw new Error(error?.message ?? "Failed to create platform pack.");
    }

    if (data.packItems.length > 0) {
      const { error: packItemsError } = await (supabaseAdmin as any).from("pack_items").insert(
        data.packItems.map((item, index) => ({
          pack_id: inserted.id,
          item_label: item.nameEn,
          item_data: serializePlatformPackItem(item),
          sort_order: index,
        })),
      );

      if (packItemsError) throw new Error(packItemsError.message ?? "Failed to create pack items.");
    }

    if (data.packFeatures.length > 0) {
      const { error: packFeaturesError } = await (supabaseAdmin as any).from("pack_features").insert(
        data.packFeatures.map((feature, index) => ({
          pack_id: inserted.id,
          feature_label: feature.textEn,
          feature_data: serializePlatformPackFeature(feature),
          sort_order: index,
        })),
      );

      if (packFeaturesError) throw new Error(packFeaturesError.message ?? "Failed to create pack features.");
    }

    return { ok: true, id: inserted.id };
  });

export const updatePlatformPack = createServerFn({ method: "POST" })
  .inputValidator((input) => updatePlatformPackInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("platform_packs")
      .update({
        name_en: data.nameEn,
        name_fr: data.nameFr ?? null,
        name_ar: data.nameAr ?? null,
        description: data.description ?? null,
        base_price_mad: data.basePriceMad,
        billing_cycle: data.billingCycle,
        price_per_unit: data.basePriceMad,
        unit_type: data.unitType,
        delivery_window: data.deliveryWindow ?? null,
        image_url: data.imageUrl ?? null,
        is_active: data.isActive,
      })
      .eq("id", data.id)
      .select("id")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to update platform pack.");
    }

    const [{ error: deleteItemsError }, { error: deleteFeaturesError }] = await Promise.all([
      (supabaseAdmin as any).from("pack_items").delete().eq("pack_id", data.id),
      (supabaseAdmin as any).from("pack_features").delete().eq("pack_id", data.id),
    ]);

    if (deleteItemsError) throw new Error(deleteItemsError.message ?? "Failed to refresh pack items.");
    if (deleteFeaturesError) throw new Error(deleteFeaturesError.message ?? "Failed to refresh pack features.");

    if (data.packItems.length > 0) {
      const { error: insertItemsError } = await (supabaseAdmin as any).from("pack_items").insert(
        data.packItems.map((item, index) => ({
          pack_id: data.id,
          item_label: item.nameEn,
          item_data: serializePlatformPackItem(item),
          sort_order: index,
        })),
      );

      if (insertItemsError) throw new Error(insertItemsError.message ?? "Failed to save pack items.");
    }

    if (data.packFeatures.length > 0) {
      const { error: insertFeaturesError } = await (supabaseAdmin as any).from("pack_features").insert(
        data.packFeatures.map((feature, index) => ({
          pack_id: data.id,
          feature_label: feature.textEn,
          feature_data: serializePlatformPackFeature(feature),
          sort_order: index,
        })),
      );

      if (insertFeaturesError) throw new Error(insertFeaturesError.message ?? "Failed to save pack features.");
    }

    return { ok: true };
  });

export const deletePlatformPack = createServerFn({ method: "POST" })
  .inputValidator((input) => deletePlatformPackInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: linkedSubscriptions, count: linkedSubscriptionsCount, error: linkedSubscriptionsError } = await (supabaseAdmin as any)
      .from("platform_subscriptions")
      .select("id", { count: "exact" })
      .eq("pack_id", data.id);

    if (linkedSubscriptionsError) {
      throw new Error(linkedSubscriptionsError.message ?? "Failed to inspect linked subscriptions.");
    }

    if ((linkedSubscriptionsCount ?? 0) > 0) {
      const linkedSubscriptionIds = (linkedSubscriptions ?? []).map((row: { id: string }) => row.id);

      const { error: deleteOrdersError } = await (supabaseAdmin as any)
        .from("orders")
        .delete()
        .in("subscription_id", linkedSubscriptionIds);

      if (deleteOrdersError) {
        throw new Error(deleteOrdersError.message ?? "Failed to delete linked subscription orders.");
      }

      const { error: deleteSubscriptionsError } = await (supabaseAdmin as any)
        .from("platform_subscriptions")
        .delete()
        .eq("pack_id", data.id);

      if (deleteSubscriptionsError) {
        throw new Error(deleteSubscriptionsError.message ?? "Failed to delete linked subscriptions.");
      }
    }

    const [{ error: deleteItemsError }, { error: deleteFeaturesError }] = await Promise.all([
      (supabaseAdmin as any).from("pack_items").delete().eq("pack_id", data.id),
      (supabaseAdmin as any).from("pack_features").delete().eq("pack_id", data.id),
    ]);

    if (deleteItemsError) {
      throw new Error(deleteItemsError.message ?? "Failed to delete linked pack items.");
    }

    if (deleteFeaturesError) {
      throw new Error(deleteFeaturesError.message ?? "Failed to delete linked pack features.");
    }

    const { error } = await (supabaseAdmin as any).from("platform_packs").delete().eq("id", data.id);

    if (error) {
      throw new Error(error.message ?? "Failed to delete platform pack.");
    }

    return { ok: true, archived: false, linkedSubscriptionsCount: linkedSubscriptionsCount ?? 0 };
  });

export const assignSubscriptionOrderCyclist = createServerFn({ method: "POST" })
  .inputValidator((input) => assignSubscriptionOrderCyclistInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: currentOrder, error: currentOrderError } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, subscription_id, customer_user_id")
      .eq("id", data.orderId)
      .eq("order_category", "PLATFORM_SUBSCRIPTION")
      .single();

    if (currentOrderError || !currentOrder?.id) {
      throw new Error(currentOrderError?.message ?? "Subscription order not found.");
    }

    if (!currentOrder.subscription_id) {
      throw new Error("Order is not linked to a platform subscription.");
    }

    const { data: subscription, error: subscriptionError } = await (supabaseAdmin as any)
      .from("platform_subscriptions")
      .select("status")
      .eq("id", currentOrder.subscription_id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(subscriptionError.message ?? "Failed to validate subscription status.");
    }

    if (!subscription || subscription.status !== "active") {
      throw new Error("Assign cyclist is only allowed after admin approval.");
    }

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("orders")
      .update({ cyclist_id: data.cyclistId, status: "delivering" })
      .eq("id", data.orderId)
      .eq("order_category", "PLATFORM_SUBSCRIPTION")
      .select("id")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to assign cyclist to subscription order.");
    }

    if (typeof currentOrder.customer_user_id === "string" && currentOrder.customer_user_id.length > 0) {
      await evaluateCustomerBehavior(currentOrder.customer_user_id);
    }

    return { ok: true };
  });

export const autoDispatchSubscriptionOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => autoDispatchSubscriptionOrderInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error: orderError } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, neighborhood_id, subscription_id, customer_user_id")
      .eq("id", data.orderId)
      .eq("order_category", "PLATFORM_SUBSCRIPTION")
      .single();

    if (orderError || !order?.id) {
      throw new Error(orderError?.message ?? "Subscription order not found.");
    }

    const neighborhoodId = order.neighborhood_id as string | null;
    if (!neighborhoodId) {
      throw new Error("Order has no neighborhood assigned.");
    }

    if (!order.subscription_id) {
      throw new Error("Order is not linked to a platform subscription.");
    }

    const { data: subscription, error: subscriptionError } = await (supabaseAdmin as any)
      .from("platform_subscriptions")
      .select("status")
      .eq("id", order.subscription_id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(subscriptionError.message ?? "Failed to validate subscription status.");
    }

    if (!subscription || subscription.status !== "active") {
      throw new Error("Auto-dispatch is only allowed after admin approval.");
    }

    const { data: coverageRows, error: coverageError } = await (supabaseAdmin as any)
      .from("cyclist_coverage")
      .select("cyclist_id")
      .eq("neighborhood_id", neighborhoodId);

    if (coverageError) {
      throw new Error(coverageError.message);
    }

    const candidateCyclistIds = Array.from(
      new Set(((coverageRows ?? []) as Array<{ cyclist_id: string }>).map((row) => row.cyclist_id)),
    );

    if (candidateCyclistIds.length === 0) {
      throw new Error("No cyclist coverage available for this neighborhood.");
    }

    const { data: cyclistRows, error: cyclistsError } = await (supabaseAdmin as any)
      .from("cyclists")
      .select("id")
      .eq("is_active", true)
      .in("id", candidateCyclistIds)
      .limit(1);

    if (cyclistsError) {
      throw new Error(cyclistsError.message);
    }

    const selectedCyclistId = (cyclistRows?.[0]?.id as string | undefined) ?? null;
    if (!selectedCyclistId) {
      throw new Error("No active cyclist available for this neighborhood.");
    }

    const { data: updated, error: updateError } = await (supabaseAdmin as any)
      .from("orders")
      .update({ cyclist_id: selectedCyclistId, status: "delivering" })
      .eq("id", data.orderId)
      .eq("order_category", "PLATFORM_SUBSCRIPTION")
      .select("id")
      .single();

    if (updateError || !updated?.id) {
      throw new Error(updateError?.message ?? "Failed to auto-dispatch subscription order.");
    }

    if (typeof order.customer_user_id === "string" && order.customer_user_id.length > 0) {
      await evaluateCustomerBehavior(order.customer_user_id);
    }

    return { ok: true, cyclistId: selectedCyclistId };
  });

export const updateSubscriptionOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => updateSubscriptionOrderStatusInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: currentOrder, error: currentOrderError } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, subscription_id, customer_user_id")
      .eq("id", data.orderId)
      .eq("order_category", "PLATFORM_SUBSCRIPTION")
      .single();

    if (currentOrderError || !currentOrder?.id) {
      throw new Error(currentOrderError?.message ?? "Subscription order not found.");
    }

    if (!currentOrder.subscription_id) {
      throw new Error("Order is not linked to a platform subscription.");
    }

    const { data: subscription, error: subscriptionError } = await (supabaseAdmin as any)
      .from("platform_subscriptions")
      .select("status")
      .eq("id", currentOrder.subscription_id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(subscriptionError.message ?? "Failed to validate subscription status.");
    }

    if (!subscription || subscription.status !== "active") {
      throw new Error("Status updates are only allowed after admin approval.");
    }

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.orderId)
      .eq("order_category", "PLATFORM_SUBSCRIPTION")
      .select("id, status")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to update subscription order status.");
    }

    if (data.status === "delivered") {
      const { data: subscriptionRow, error: progressError } = await (supabaseAdmin as any)
        .from("platform_subscriptions")
        .select("id, total_deliveries, completed_deliveries")
        .eq("id", currentOrder.subscription_id)
        .single();

      if (progressError) {
        throw new Error(progressError.message ?? "Failed to sync subscription progress.");
      }

      const totalDeliveries = Number(subscriptionRow?.total_deliveries ?? 0);
      const completedDeliveries = Number(subscriptionRow?.completed_deliveries ?? 0);
      const nextCompleted = completedDeliveries + 1;
      const isCycleComplete = totalDeliveries > 0 && nextCompleted >= totalDeliveries;

      const { error: subscriptionUpdateError } = await (supabaseAdmin as any)
        .from("platform_subscriptions")
        .update({
          completed_deliveries: nextCompleted,
          deliveries_completed: nextCompleted,
          status: isCycleComplete ? "completed" : "active",
        })
        .eq("id", currentOrder.subscription_id);

      if (subscriptionUpdateError) {
        throw new Error(subscriptionUpdateError.message ?? "Failed to update subscription completion progress.");
      }
    }

    if (typeof currentOrder.customer_user_id === "string" && currentOrder.customer_user_id.length > 0) {
      await evaluateCustomerBehavior(currentOrder.customer_user_id);
    }

    return { ok: true, status: updated.status };
  });

export const listPlatformSubscribers = createServerFn({ method: "GET" }).handler(async () => {
  const [subscriptionsRes, packsRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("platform_subscriptions")
      .select(
        "id, customer_user_id, customer_name, customer_phone, contact_phone, delivery_address, pack_quantity, pack_id, status, start_date, expiration_date, next_scheduled_delivery_date, lifetime_revenue_mad, agreed_price, total_deliveries, completed_deliveries, deliveries_completed, deliveries_expected, created_at",
      )
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any).from("platform_packs").select("id, name_en, name_fr, name_ar"),
  ]);

  if (subscriptionsRes.error) {
    throw new Error(subscriptionsRes.error.message ?? "Failed to load platform subscribers.");
  }
  if (packsRes.error) {
    throw new Error(packsRes.error.message ?? "Failed to load platform packs.");
  }

  const packNameById = new Map(
    ((packsRes.data ?? []) as Array<{ id: string; name_en: string; name_fr: string | null; name_ar: string | null }>).map((pack) => [
      pack.id,
      (pack.name_en?.trim() || pack.name_fr?.trim() || pack.name_ar?.trim() || "Unknown Pack"),
    ]),
  );

  return ((subscriptionsRes.data ?? []) as PlatformSubscriptionRow[]).map((row) => {
    const deliveriesCompleted = Number(row.completed_deliveries ?? row.deliveries_completed ?? 0);
    const deliveriesExpected = Number(row.total_deliveries ?? row.deliveries_expected ?? 0);
    const completionPct =
      deliveriesExpected > 0
        ? Math.max(0, Math.min(100, Math.round((deliveriesCompleted / deliveriesExpected) * 100)))
        : 0;

    return {
      id: row.id,
      customerUserId: row.customer_user_id,
      customerName: row.customer_name?.trim() || "Unknown Subscriber",
      customerPhone: row.customer_phone?.trim() || "—",
      contactPhone: row.contact_phone?.trim() || row.customer_phone?.trim() || "—",
      deliveryAddress: row.delivery_address?.trim() || "—",
      packQuantity: Math.max(1, Number(row.pack_quantity ?? 1)),
      packId: row.pack_id,
      packName: packNameById.get(row.pack_id) ?? "Unknown Pack",
      status: row.status,
      startDate: row.start_date,
      expirationDate: row.expiration_date,
      nextScheduledDeliveryDate: row.next_scheduled_delivery_date,
      lifetimeRevenueMad: Number(row.lifetime_revenue_mad ?? 0),
      agreedPriceMad: Number(row.agreed_price ?? 0),
      deliveriesCompleted,
      deliveriesExpected,
      deliveryCompletionPercent: completionPct,
      createdAt: row.created_at,
    };
  });
});

export const getPlatformPacksAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const [subscriptionsRes, packsRes, ordersRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("platform_subscriptions")
      .select("id, pack_id, status, created_at, start_date"),
    (supabaseAdmin as any)
      .from("platform_packs")
      .select("id, name_en, name_fr, name_ar, base_price_mad, billing_cycle, is_active"),
    (supabaseAdmin as any)
      .from("orders")
      .select("id, status, created_at, delivered_at, cash_to_collect_from_customer, order_category")
      .eq("order_category", "PLATFORM_SUBSCRIPTION"),
  ]);

  if (subscriptionsRes.error) {
    throw new Error(subscriptionsRes.error.message ?? "Failed to load platform subscriptions analytics.");
  }
  if (packsRes.error) {
    throw new Error(packsRes.error.message ?? "Failed to load platform packs analytics.");
  }
  if (ordersRes.error) {
    throw new Error(ordersRes.error.message ?? "Failed to load platform orders analytics.");
  }

  const subscriptions = (subscriptionsRes.data ?? []) as Array<{
    id: string;
    pack_id: string;
    status: "pending" | "active" | "paused" | "expired" | "cancelled";
    created_at: string;
    start_date: string;
  }>;
  const packs = (packsRes.data ?? []) as Array<{
    id: string;
    name_en: string | null;
    name_fr: string | null;
    name_ar: string | null;
    base_price_mad: number | null;
    billing_cycle: "DAILY" | "WEEKLY" | "MONTHLY";
    is_active: boolean;
  }>;
  const subscriptionOrders = (ordersRes.data ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
    delivered_at: string | null;
    cash_to_collect_from_customer: number | null;
    order_category: "MARKETPLACE" | "PLATFORM_SUBSCRIPTION";
  }>;

  const packById = new Map(
    packs.map((pack) => [
      pack.id,
      {
        name: pack.name_en?.trim() || pack.name_fr?.trim() || pack.name_ar?.trim() || "Unknown Pack",
        basePriceMad: Number(pack.base_price_mad ?? 0),
        billingCycle: pack.billing_cycle,
        isActive: Boolean(pack.is_active),
      },
    ]),
  );

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "active");
  const churnedSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "paused" || subscription.status === "cancelled",
  );

  const mrr = activeSubscriptions.reduce((sum, subscription) => {
    const pack = packById.get(subscription.pack_id);
    if (!pack) return sum;
    const monthlyMultiplier = pack.billingCycle === "DAILY" ? 30 : pack.billingCycle === "WEEKLY" ? 4 : 1;
    return sum + pack.basePriceMad * monthlyMultiplier;
  }, 0);

  const deliveredStatuses = new Set(["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"]);
  const totalPacksDelivered = subscriptionOrders.filter(
    (order) =>
      deliveredStatuses.has(order.status) &&
      Number(order.cash_to_collect_from_customer ?? 0) === 0 &&
      order.order_category === "PLATFORM_SUBSCRIPTION",
  ).length;

  const now = new Date();
  const growthBuckets = new Map<string, { key: string; label: string; subscriptions: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = bucketDate.toISOString().slice(0, 10);
    growthBuckets.set(key, {
      key,
      label: bucketDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      subscriptions: 0,
    });
  }

  for (const subscription of subscriptions) {
    const createdAt = subscription.created_at || subscription.start_date;
    if (!createdAt) continue;
    const key = createdAt.slice(0, 10);
    const bucket = growthBuckets.get(key);
    if (!bucket) continue;
    bucket.subscriptions += 1;
  }

  const packPopularityMap = new Map<string, { packId: string; packName: string; activeSubscribers: number; isActive: boolean }>();
  for (const subscription of activeSubscriptions) {
    const packMeta = packById.get(subscription.pack_id);
    const bucket = packPopularityMap.get(subscription.pack_id) ?? {
      packId: subscription.pack_id,
      packName: packMeta?.name ?? "Unknown Pack",
      activeSubscribers: 0,
      isActive: packMeta?.isActive ?? false,
    };
    bucket.activeSubscribers += 1;
    packPopularityMap.set(subscription.pack_id, bucket);
  }

  const packPopularity = Array.from(packPopularityMap.values()).sort((a, b) => b.activeSubscribers - a.activeSubscribers);
  const churnRate = subscriptions.length > 0 ? (churnedSubscriptions.length / subscriptions.length) * 100 : 0;

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      totalActiveSubscribers: activeSubscriptions.length,
      monthlyRecurringRevenueMad: Number(mrr.toFixed(2)),
      totalPacksDelivered,
      churnRate: Number(churnRate.toFixed(2)),
      churnedCount: churnedSubscriptions.length,
      totalSubscriptions: subscriptions.length,
    },
    subscriptionGrowth: Array.from(growthBuckets.values()),
    packPopularity,
  };
});

export const activatePlatformSubscriber = createServerFn({ method: "POST" })
  .inputValidator((input) => activatePlatformSubscriberInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [subscriptionRes, packItemsRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("platform_subscriptions")
        .select("id, customer_user_id, customer_name, customer_phone, contact_phone, delivery_address, pack_quantity, pack_id, status, start_date, next_scheduled_delivery_date")
        .eq("id", data.subscriptionId)
        .single(),
      (supabaseAdmin as any)
        .from("orders")
        .select("id")
        .eq("subscription_id", data.subscriptionId)
        .eq("order_category", "PLATFORM_SUBSCRIPTION")
        .limit(1),
    ]);

    if (subscriptionRes.error || !subscriptionRes.data?.id) {
      throw new Error(subscriptionRes.error?.message ?? "Subscription not found.");
    }

    if (subscriptionRes.data.status !== "pending") {
      throw new Error("Only pending subscriptions can be activated.");
    }

    const firstOrderExists = Array.isArray(packItemsRes.data) && packItemsRes.data.length > 0;

    const { error: updateError } = await (supabaseAdmin as any)
      .from("platform_subscriptions")
      .update({
        status: "active",
        agreed_price: data.agreedPriceMad,
        total_deliveries: data.totalDeliveries,
        completed_deliveries: 0,
        deliveries_expected: data.totalDeliveries,
        deliveries_completed: 0,
        lifetime_revenue_mad: data.agreedPriceMad,
      })
      .eq("id", data.subscriptionId);

    if (updateError) {
      throw new Error(updateError.message ?? "Failed to activate subscription.");
    }

    if (!firstOrderExists) {
      const { data: profileRow, error: profileError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("neighborhood_id")
        .eq("id", subscriptionRes.data.customer_user_id)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message ?? "Failed to resolve delivery neighborhood for subscription.");
      }

      const { data: packItemsRows, error: packItemsError } = await (supabaseAdmin as any)
        .from("pack_items")
        .select("item_label, item_data, sort_order")
        .eq("pack_id", subscriptionRes.data.pack_id)
        .order("sort_order", { ascending: true });

      if (packItemsError) {
        throw new Error(packItemsError.message ?? "Failed to prepare first delivery order.");
      }

      const orderItems = ((packItemsRows ?? []) as Array<{ item_label: string; item_data?: unknown; sort_order: number }>).length
        ? ((packItemsRows ?? []) as Array<{ item_label: string; item_data?: unknown; sort_order: number }>).map((item) => {
            const normalized = normalizePlatformPackItem(item);
            const requestedQuantity = Math.max(1, Number(subscriptionRes.data.pack_quantity ?? 1));
            return {
              name: normalized.nameEn || item.item_label,
              quantity: (normalized.quantity ?? 1) * requestedQuantity,
              unit: normalized.unit ?? null,
              imageUrl: normalized.imageUrl ?? null,
              unitPriceMad: 0,
              selectedVariant: null,
              brandName: null,
              measurementValue: null,
              measurementUnit: null,
            };
          })
        : [
            {
              name: "Subscription Pack Delivery",
              quantity: 1,
              unit: "Pack",
              imageUrl: null,
              unitPriceMad: 0,
              selectedVariant: null,
              brandName: null,
              measurementValue: null,
              measurementUnit: "Pack",
            },
          ];

      const orderNotes = [
        `Subscription activation order`,
        `Contract price: ${Number(data.agreedPriceMad).toFixed(2)} MAD`,
        `Requested quantity: ${Math.max(1, Number(subscriptionRes.data.pack_quantity ?? 1))}`,
        subscriptionRes.data.delivery_address ? `Address: ${subscriptionRes.data.delivery_address}` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" | ");

      const { data: insertedOrder, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .insert({
          customer_user_id: subscriptionRes.data.customer_user_id,
          vendor_id: null,
          subscription_id: data.subscriptionId,
          customer_name: subscriptionRes.data.customer_name,
          customer_phone: subscriptionRes.data.contact_phone || subscriptionRes.data.customer_phone,
          delivery_notes: orderNotes,
          payment_method: "COD",
          status: "new",
          delivery_fee: 0,
          subtotal_base_price: 0,
          platform_profit: Number(data.agreedPriceMad),
          platform_markup: Number(data.agreedPriceMad),
          vendor_revenue: 0,
          total_price: Number(data.agreedPriceMad),
          item_count: orderItems.length,
          order_items: orderItems,
          order_category: "PLATFORM_SUBSCRIPTION",
          cash_to_collect_from_customer: 0,
          neighborhood_id: profileRow?.neighborhood_id ?? null,
        })
        .select("id")
        .single();

      if (orderError || !insertedOrder?.id) {
        throw new Error(orderError?.message ?? "Failed to create first dispatch order.");
      }
    }

    return { ok: true };
  });

export const updatePlatformSubscriberStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => updatePlatformSubscriberStatusInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("platform_subscriptions")
      .update({ status: data.status })
      .eq("id", data.subscriptionId)
      .select("id")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to update subscriber status.");
    }

    return { ok: true };
  });

export const getPlatformSubscriberHistory = createServerFn({ method: "POST" })
  .inputValidator((input) => getPlatformSubscriberHistoryInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [ordersRes, cyclistsRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("orders")
        .select(
          "id, created_at, delivered_at, status, cyclist_id, customer_name, customer_phone, item_count, total_price, cash_to_collect_from_customer, order_items",
        )
        .eq("subscription_id", data.subscriptionId)
        .eq("order_category", "PLATFORM_SUBSCRIPTION")
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any).from("cyclists").select("id, full_name"),
    ]);

    if (ordersRes.error) {
      throw new Error(ordersRes.error.message ?? "Failed to load subscriber delivery history.");
    }
    if (cyclistsRes.error) {
      throw new Error(cyclistsRes.error.message ?? "Failed to load cyclist history metadata.");
    }

    const cyclistNameById = new Map(
      ((cyclistsRes.data ?? []) as Array<{ id: string; full_name: string }>).map((cyclist) => [cyclist.id, cyclist.full_name]),
    );

    return ((ordersRes.data ?? []) as PlatformSubscriptionOrderHistoryRow[]).map((row) => {
      const firstItem = Array.isArray(row.order_items) ? row.order_items[0] : null;
      const item = firstItem && typeof firstItem === "object" ? (firstItem as Record<string, unknown>) : null;
      const snapshotName =
        (typeof item?.packName === "string" && item.packName.trim().length > 0 && item.packName.trim()) ||
        (typeof item?.name === "string" && item.name.trim().length > 0 && item.name.trim()) ||
        (typeof item?.title === "string" && item.title.trim().length > 0 && item.title.trim()) ||
        null;

      return {
        id: row.id,
        createdAt: row.created_at,
        deliveredAt: row.delivered_at,
        status: row.status,
        cyclistName: row.cyclist_id ? (cyclistNameById.get(row.cyclist_id) ?? "Unknown Cyclist") : "Unassigned",
        customerName: row.customer_name?.trim() || "Unknown Subscriber",
        customerPhone: row.customer_phone?.trim() || "—",
        itemCount: Number(row.item_count ?? 0),
        totalPriceMad: Number(row.total_price ?? 0),
        cashToCollectMad: Number(row.cash_to_collect_from_customer ?? 0),
        packSnapshotName: snapshotName,
      };
    });
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

    const tablesInDeleteOrder = [
      "platform_collections",
      "order_audit_logs",
      "carnet_payments",
      "carnet_transactions",
      "orders",
    ] as const;

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

    return {
      ok: true,
      message: "Transactional data was reset (orders, collections, carnet/accounting logs) and vendor balances were recalculated to zero.",
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

export const uploadPlatformPackAsset = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadPlatformPackAssetInputSchema.parse(input))
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
    const generatedFileName = `${crypto.randomUUID()}-${safeBaseName || "asset"}.${extensionFromName}`;
    const path = `${data.folder}/${generatedFileName}`;

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
  });

export const getAdminCustomerKpis = createServerFn({ method: "GET" }).handler(async () => {
  const [profilesRes, ltvRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("profiles")
      .select("id, status, risk_score"),
    (supabaseAdmin as any)
      .from("profiles")
      .select("lifetime_value"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (ltvRes.error) throw new Error(ltvRes.error.message);

  const profiles = (profilesRes.data ?? []) as Array<{
    id: string;
    status: "active" | "vip" | "warning" | "suspicious" | "blocked";
    risk_score: "low" | "medium" | "high";
  }>;
  const ltvRows = (ltvRes.data ?? []) as Array<{ lifetime_value: number | null }>;

  const totalCustomers = profiles.length;
  const vipCustomers = profiles.filter((profile) => profile.status === "vip").length;
  const highRiskOrBlocked = profiles.filter(
    (profile) => profile.risk_score === "high" || profile.status === "blocked",
  ).length;
  const ltvValues = ltvRows.map((row) => Number(row.lifetime_value ?? 0));
  const averageLtv = ltvValues.length > 0 ? ltvValues.reduce((sum, value) => sum + value, 0) / ltvValues.length : 0;

  return {
    totalCustomers,
    vipCustomers,
    highRiskOrBlocked,
    averageLtv,
  };
});

export const listAdminCustomers = createServerFn({ method: "POST" })
  .inputValidator((input) => adminCustomerListInputSchema.parse(input))
  .handler(async ({ data }) => {
    const page = Math.max(1, data.page ?? 1);
    const pageSize = data.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let profilesQuery = (supabaseAdmin as any)
      .from("profiles")
      .select(
        "id, full_name, phone, address, created_at, status, risk_score, strikes, cod_rejections, admin_notes, lifetime_value, system_tags",
        { count: "exact" },
      );

    if (data.status !== "all") {
      profilesQuery = profilesQuery.eq("status", data.status);
    }

    if (data.risk !== "all") {
      profilesQuery = profilesQuery.eq("risk_score", data.risk);
    }

    if (data.search && data.search.trim().length > 0) {
      const query = data.search.trim();
      profilesQuery = profilesQuery.or(
        `full_name.ilike.%${query}%,phone.ilike.%${query}%,address.ilike.%${query}%,id.ilike.%${query}%`,
      );
    }

    if (data.sortBy === "highest_ltv") {
      profilesQuery = profilesQuery.order("lifetime_value", { ascending: false }).order("created_at", { ascending: false });
    } else if (data.sortBy === "most_strikes") {
      profilesQuery = profilesQuery.order("strikes", { ascending: false }).order("created_at", { ascending: false });
    } else {
      profilesQuery = profilesQuery.order("created_at", { ascending: false });
    }

    const profilesRes = await profilesQuery.range(from, to);

    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const profiles = (profilesRes.data ?? []) as AdminCustomerProfileRow[];
    const profileIds = profiles.map((profile) => profile.id);
    const profilePhones = profiles
      .map((profile) => profile.phone?.trim() ?? "")
      .filter((phone): phone is string => phone.length > 0);

    const [ordersByUserRes, ordersByPhoneRes] = await Promise.all([
      profileIds.length > 0
        ? (supabaseAdmin as any)
            .from("orders")
            .select("id, customer_user_id, customer_phone, status, total_price, delivery_fee, created_at")
            .in("status", ["delivered", "cash_transferred_to_vendor"])
            .in("customer_user_id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      profilePhones.length > 0
        ? (supabaseAdmin as any)
            .from("orders")
            .select("id, customer_user_id, customer_phone, status, total_price, delivery_fee, created_at")
            .in("status", ["delivered", "cash_transferred_to_vendor"])
            .in("customer_phone", profilePhones)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (ordersByUserRes.error) throw new Error(ordersByUserRes.error.message);
    if (ordersByPhoneRes.error) throw new Error(ordersByPhoneRes.error.message);

    const scopedOrders = [
      ...((ordersByUserRes.data ?? []) as AdminCustomerOrderAggregateRow[]),
      ...((ordersByPhoneRes.data ?? []) as AdminCustomerOrderAggregateRow[]),
    ];

    const orderMetricsByProfileId = new Map<string, { totalOrders: number; ltvMad: number }>();
    const orderMetricsByPhone = new Map<string, { totalOrders: number; ltvMad: number }>();
    const seenOrderIds = new Set<string>();

    for (const row of scopedOrders) {
      if (seenOrderIds.has(row.id)) continue;
      seenOrderIds.add(row.id);

      const value = Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0);

      if (row.customer_user_id) {
        const current = orderMetricsByProfileId.get(row.customer_user_id) ?? { totalOrders: 0, ltvMad: 0 };
        orderMetricsByProfileId.set(row.customer_user_id, {
          totalOrders: current.totalOrders + 1,
          ltvMad: current.ltvMad + value,
        });
      }

      const phone = row.customer_phone?.trim();
      if (phone) {
        const current = orderMetricsByPhone.get(phone) ?? { totalOrders: 0, ltvMad: 0 };
        orderMetricsByPhone.set(phone, {
          totalOrders: current.totalOrders + 1,
          ltvMad: current.ltvMad + value,
        });
      }
    }

    return {
      page,
      pageSize,
      total: Number(profilesRes.count ?? 0),
      rows: profiles.map((profile) => {
        const phone = profile.phone?.trim() ?? "";
        const profileMetrics = orderMetricsByProfileId.get(profile.id);
        const phoneMetrics = phone ? orderMetricsByPhone.get(phone) : undefined;
        const totalOrders = profileMetrics?.totalOrders ?? phoneMetrics?.totalOrders ?? 0;
        const derivedLtv = profileMetrics?.ltvMad ?? phoneMetrics?.ltvMad ?? 0;
        const lifetimeValue = Number(profile.lifetime_value ?? 0);

        return {
          id: profile.id,
          fullName: profile.full_name?.trim() || "—",
          phone: phone || "—",
          address: profile.address?.trim() || "—",
          joinedAt: profile.created_at,
          totalOrders,
          ltvMad: lifetimeValue > 0 ? lifetimeValue : derivedLtv,
          status: profile.status,
          riskScore: profile.risk_score,
          strikes: Number(profile.strikes ?? 0),
          codRejections: Number(profile.cod_rejections ?? 0),
          adminNotes: profile.admin_notes ?? "",
          systemTags: Array.isArray(profile.system_tags) ? profile.system_tags : [],
        };
      }),
    };
  });

export const getAdminCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => getAdminCustomerProfileInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [profileRes, ordersRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("profiles")
        .select("id, full_name, phone, address, created_at, status, risk_score, strikes, cod_rejections, admin_notes, lifetime_value, system_tags")
        .eq("id", data.customerId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("orders")
        .select("id, customer_user_id, customer_name, customer_phone, status, total_price, delivery_fee, created_at")
        .eq("customer_user_id", data.customerId)
        .order("created_at", { ascending: false }),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (ordersRes.error) throw new Error(ordersRes.error.message);
    if (!profileRes.data?.id) throw new Error("Customer not found.");

    const profile = profileRes.data as AdminCustomerProfileRow;
    const orders = (ordersRes.data ?? []) as AdminCustomerOrderAggregateRow[];
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter((order) => ["delivered", "cash_transferred_to_vendor"].includes(order.status)).length;
    const cancelledOrders = orders.filter((order) => order.status === "cancelled").length;
    const totalSpent = orders
      .filter((order) => ["delivered", "cash_transferred_to_vendor"].includes(order.status))
      .reduce((sum, order) => sum + Number(order.total_price ?? 0) + Number(order.delivery_fee ?? 0), 0);
    const averageOrderValue = deliveredOrders > 0 ? totalSpent / deliveredOrders : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const lifetimeValue = Number(profile.lifetime_value ?? 0) > 0 ? Number(profile.lifetime_value ?? 0) : totalSpent;

    return {
      id: profile.id,
      fullName: profile.full_name?.trim() || "—",
      phone: profile.phone?.trim() || "—",
      address: profile.address?.trim() || "—",
      joinedAt: profile.created_at,
      status: profile.status,
      riskScore: profile.risk_score,
      strikes: Number(profile.strikes ?? 0),
      codRejections: Number(profile.cod_rejections ?? 0),
      adminNotes: profile.admin_notes ?? "",
      systemTags: Array.isArray(profile.system_tags) ? profile.system_tags : [],
      lifetimeValue,
      metrics: {
        totalSpent: lifetimeValue,
        averageOrderValue,
        totalOrders,
        deliveredOrders,
        cancellationRate,
        codRejections: Number(profile.cod_rejections ?? 0),
      },
      recentOrders: orders.slice(0, 10).map((order) => ({
        id: order.id,
        createdAt: order.created_at,
        status: order.status,
        amount: Number(order.total_price ?? 0) + Number(order.delivery_fee ?? 0),
      })),
    };
  });

export const updateAdminCustomerState = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAdminCustomerStateInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: existingProfile, error: existingError } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, strikes, cod_rejections")
      .eq("id", data.customerId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (!existingProfile?.id) throw new Error("Customer not found.");

    const currentStrikes = Number(existingProfile.strikes ?? 0);
    const nextStrikes = data.resetStrikes
      ? 0
      : Math.max(0, currentStrikes + Number(data.strikesDelta ?? 0));

    const patch: Record<string, unknown> = { strikes: nextStrikes };

    if (data.addCodRejection) {
      patch.cod_rejections = Number(existingProfile.cod_rejections ?? 0) + 1;
    }

    const { error } = await (supabaseAdmin as any).from("profiles").update(patch).eq("id", data.customerId);

    if (error) {
      throw new Error(error.message);
    }

    await evaluateCustomerBehavior(data.customerId);

    return { ok: true };
  });

export const updateAdminCustomerNotes = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAdminCustomerNotesInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ admin_notes: data.adminNotes })
      .eq("id", data.customerId);

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });
