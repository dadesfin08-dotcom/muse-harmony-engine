import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CustomerStatus = "active" | "vip" | "warning" | "suspicious" | "blocked";
type CustomerRisk = "low" | "medium" | "high";

const DELIVERED_STATUSES = ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"] as const;

export async function evaluateCustomerBehavior(userId: string) {
  const normalizedUserId = String(userId ?? "").trim();
  if (!normalizedUserId) {
    throw new Error("evaluateCustomerBehavior requires a valid userId.");
  }

  const [profileRes, totalOrdersRes, deliveredOrdersRes, cancelledOrdersRes, codRejectedOrdersRes, fakeReportsRes, complaintsRes] =
    await Promise.all([
      (supabaseAdmin as any)
        .from("profiles")
        .select("id, cod_rejections, fake_orders, cancelled_orders")
        .eq("id", normalizedUserId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_user_id", normalizedUserId),
      (supabaseAdmin as any)
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_user_id", normalizedUserId)
        .in("status", [...DELIVERED_STATUSES]),
      (supabaseAdmin as any)
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_user_id", normalizedUserId)
        .eq("status", "cancelled"),
      (supabaseAdmin as any)
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_user_id", normalizedUserId)
        .eq("status", "cancelled")
        .in("payment_method", ["COD", "cod", "Cash", "cash"]),
      (supabaseAdmin as any)
        .from("customer_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", normalizedUserId)
        .or("event_type.ilike.%fake%,event_type.ilike.%spam%"),
      (supabaseAdmin as any)
        .from("customer_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", normalizedUserId)
        .or("event_type.ilike.%complaint%,event_type.ilike.%annoying%"),
    ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (!profileRes.data?.id) throw new Error("Customer profile not found.");
  if (totalOrdersRes.error) throw new Error(totalOrdersRes.error.message);
  if (deliveredOrdersRes.error) throw new Error(deliveredOrdersRes.error.message);
  if (cancelledOrdersRes.error) throw new Error(cancelledOrdersRes.error.message);
  if (codRejectedOrdersRes.error) throw new Error(codRejectedOrdersRes.error.message);
  if (fakeReportsRes.error) throw new Error(fakeReportsRes.error.message);
  if (complaintsRes.error) throw new Error(complaintsRes.error.message);

  const totalOrders = Number(totalOrdersRes.count ?? 0);
  const deliveredOrders = Number(deliveredOrdersRes.count ?? 0);
  const cancelledOrders = Math.max(
    Number(cancelledOrdersRes.count ?? 0),
    Number(profileRes.data.cancelled_orders ?? 0),
  );
  const codRejectedOrders = Number(codRejectedOrdersRes.count ?? 0);
  const fakeOrders = Math.max(Number(fakeReportsRes.count ?? 0), Number(profileRes.data.fake_orders ?? 0));
  const complaintsCount = Number(complaintsRes.count ?? 0);

  const codRejected = Math.max(Number(profileRes.data.cod_rejections ?? 0), codRejectedOrders);
  const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;

  const isVip = deliveredOrders >= 5 && cancellationRate < 0.1;
  const hasFrequentCancellations = cancelledOrders >= 3 || cancellationRate > 0.3;
  const hasMultipleComplaints = complaintsCount >= 2;
  const hasCodRejection = codRejected >= 1;
  const shouldBlock = codRejected >= 2 || fakeOrders >= 1;

  const tags = new Set<string>();
  if (isVip) tags.add("عميل موثوق");
  if (deliveredOrders > 0 && !isVip && !hasFrequentCancellations && !hasMultipleComplaints) tags.add("عميل نشيط");
  if (hasFrequentCancellations) tags.add("إلغاء متكرر");
  if (hasMultipleComplaints) tags.add("عميل مزعج");
  if (hasCodRejection) tags.add("رفض COD");
  if (shouldBlock) {
    tags.add("طلبات وهمية");
    tags.add("سبام");
  }

  let status: CustomerStatus = isVip ? "vip" : "active";
  let risk: CustomerRisk = "low";

  if (hasFrequentCancellations || hasMultipleComplaints) {
    status = "warning";
    risk = "medium";
  }

  if (hasCodRejection) {
    risk = "high";
  }

  if (shouldBlock) {
    status = "blocked";
    risk = "high";
  }

  const { error: updateError } = await (supabaseAdmin as any)
    .from("profiles")
    .update({
      status,
      risk_score: risk,
      system_tags: Array.from(tags),
      cod_rejections: codRejected,
      fake_orders: fakeOrders,
      cancelled_orders: cancelledOrders,
    })
    .eq("id", normalizedUserId);

  if (updateError) throw new Error(updateError.message);

  return {
    userId: normalizedUserId,
    status,
    risk,
    systemTags: Array.from(tags),
    metrics: {
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      codRejected,
      fakeOrders,
      complaintsCount,
      cancellationRate,
    },
  };
}

export async function evaluateCustomersBehavior(userIds: string[]) {
  const uniqueIds = Array.from(new Set((userIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean)));

  for (const userId of uniqueIds) {
    await evaluateCustomerBehavior(userId);
  }

  return { processed: uniqueIds.length };
}