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
