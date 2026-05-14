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
const customerCinSchema = z.string().trim().regex(/^[A-Za-z0-9-]{4,30}$/);

const upsertCarnetCustomerInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema.optional(),
  customerPhone: moroccoPhoneSchema,
  maxLimit: z.number().min(0).max(100000),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerCin: customerCinSchema,
});

const clearCarnetDebtInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema.optional(),
  customerPhone: moroccoPhoneSchema,
});

const getCheckoutPaymentOptionsInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
  neighborhoodId: z.string().uuid(),
  cartTotal: z.number().positive(),
});

const lookupCustomerByPhoneInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema.optional(),
  customerPhone: moroccoPhoneSchema,
});

const verifyAndAddVendorCarnetCustomerInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema.optional(),
  customerPhone: moroccoPhoneSchema,
  maxLimit: z.number().min(0).max(100000),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerCin: customerCinSchema,
  otpCode: z.string().trim().regex(/^[0-9]{4}$/),
});

const getCarnetCustomerLedgerInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
  phoneNumber: moroccoPhoneSchema.optional(),
});

const vendorSessionInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema.optional(),
});

const recordVendorCarnetPaymentInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema.optional(),
  customerPhone: moroccoPhoneSchema,
  amountPaid: z.number().positive().max(100000),
});

const getCustomerCarnetOverviewInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
});

const getCustomerCarnetBalanceInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
});

const getCustomerCarnetStatementInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
});

type VendorCarnetRow = {
  id: string;
  customer_phone: string;
  current_debt: number;
  max_limit: number;
  customer_name: string | null;
  customer_cin: string | null;
  status: string;
};

const getActiveVendor = async (phoneNumber?: string) => {
  if (!phoneNumber) {
    const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
      .from("vendors")
      .select("id, store_name")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (vendorError || !vendor?.id) {
      return null;
    }

    return {
      id: vendor.id as string,
      storeName: vendor.store_name as string,
    };
  }

  const normalizedInput = normalizeMoroccoPhoneInput(phoneNumber);
  const candidatePhones = Array.from(
    new Set([
      phoneNumber.trim(),
      formatMoroccoPhoneForPayload(normalizedInput),
      `0${normalizedInput}`,
      normalizedInput,
    ]).values(),
  ).filter((value) => value.length > 0);

  const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, phone_number")
    .eq("is_active", true)
    .in("phone_number", candidatePhones)
    .limit(1)
    .maybeSingle();

  if (vendorError) {
    return null;
  }

  if (vendor?.id) {
    return {
      id: vendor.id as string,
      storeName: vendor.store_name as string,
    };
  }

  const { data: activeVendors, error: fallbackError } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, phone_number")
    .eq("is_active", true);

  if (fallbackError) {
    return null;
  }

  const matchedVendor = ((activeVendors ?? []) as Array<{ id: string; store_name: string; phone_number?: string | null }>).find(
    (row) => {
      const normalizedVendorPhone = normalizeMoroccoPhoneInput(String(row.phone_number ?? ""));
      return normalizedVendorPhone.length > 0 && normalizedVendorPhone === normalizedInput;
    },
  );

  if (!matchedVendor?.id) {
    return null;
  }

  return {
    id: matchedVendor.id,
    storeName: matchedVendor.store_name,
  };
};

const getDynamicDebtForVendorCustomer = async (vendorId: string, customerPhone: string) => {
  const [ordersResult, carnetRowsResult] = await Promise.all([
    (supabaseAdmin as any)
      .from("orders")
      .select("total_price, delivery_fee")
      .eq("vendor_id", vendorId)
      .eq("customer_phone", customerPhone)
      .eq("payment_method", "Carnet")
      .neq("status", "cancelled"),
    (supabaseAdmin as any)
      .from("vendor_carnet")
      .select("id")
      .eq("vendor_id", vendorId)
      .eq("customer_phone", customerPhone)
      .order("updated_at", { ascending: false }),
  ]);

  if (ordersResult.error) {
    throw new Error(ordersResult.error.message);
  }

  if (carnetRowsResult.error) {
    throw new Error(carnetRowsResult.error.message);
  }

  const totalIssued = ((ordersResult.data ?? []) as Array<{ total_price?: number | null; delivery_fee?: number | null }>).reduce(
    (sum, row) => sum + Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0),
    0,
  );

  const carnetIds = Array.from(
    new Set(((carnetRowsResult.data ?? []) as Array<{ id?: string | null }>).map((row) => row.id).filter(Boolean) as string[]),
  );

  let totalRepaid = 0;
  if (carnetIds.length > 0) {
    const { data: paymentRows, error: paymentError } = await (supabaseAdmin as any)
      .from("carnet_payments")
      .select("amount")
      .eq("vendor_id", vendorId)
      .in("vendor_carnet_id", carnetIds);

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    totalRepaid = (paymentRows ?? []).reduce(
      (sum: number, row: { amount?: number | null }) => sum + Number(row.amount ?? 0),
      0,
    );
  }

  return Number((totalIssued - totalRepaid).toFixed(2));
};

const getDynamicDebtForCustomerAcrossVendors = async (customerPhone: string) => {
  const { data: vendorRows, error: vendorError } = await (supabaseAdmin as any)
    .from("vendor_carnet")
    .select("vendor_id")
    .eq("customer_phone", customerPhone)
    .eq("status", "active");

  if (vendorError) {
    throw new Error(vendorError.message);
  }

  const vendorIds = Array.from(new Set(((vendorRows ?? []) as Array<{ vendor_id?: string | null }>).map((row) => row.vendor_id).filter(Boolean) as string[]));

  if (vendorIds.length === 0) {
    return { hasCarnet: false as const, totalDebtMad: 0 };
  }

  const debtList = await Promise.all(
    vendorIds.map((vendorId) => getDynamicDebtForVendorCustomer(vendorId, customerPhone)),
  );

  return {
    hasCarnet: true as const,
    totalDebtMad: Number(debtList.reduce((sum, value) => sum + value, 0).toFixed(2)),
  };
};

export const getVendorCarnetData = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorSessionInputSchema.parse(input))
  .handler(async ({ data }) => {
  try {
    const vendor = await getActiveVendor(data.phoneNumber);

    if (!vendor?.id) {
      return {
        vendor: null,
        carnetCustomers: [] as Array<{
          id: string;
          customerPhone: string;
          currentDebt: number;
          maxLimit: number;
          customerName: string | null;
          customerCin: string | null;
          status: string;
        }>,
      };
    }

    const { data: rows, error: carnetError } = await (supabaseAdmin as any)
      .from("vendor_carnet")
      .select("id, customer_phone, max_limit, customer_name, customer_cin, status")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    if (carnetError) {
      throw new Error(carnetError.message);
    }

    const rawRows = (rows ?? []) as Array<VendorCarnetRow>;
    const uniqueCustomers = Array.from(new Set(rawRows.map((row) => row.customer_phone).filter(Boolean)));

    const [orderRowsResult, paymentRowsResult] = await Promise.all([
      (supabaseAdmin as any)
        .from("orders")
        .select("customer_phone, total_price, delivery_fee, created_at")
        .eq("vendor_id", vendor.id)
        .eq("payment_method", "Carnet")
        .neq("status", "cancelled"),
      (supabaseAdmin as any)
        .from("carnet_payments")
        .select("vendor_carnet_id, amount")
        .eq("vendor_id", vendor.id),
    ]);

    if (orderRowsResult.error) {
      throw new Error(orderRowsResult.error.message);
    }

    if (paymentRowsResult.error) {
      throw new Error(paymentRowsResult.error.message);
    }

    const carnetIdToPhone = new Map<string, string>();
    for (const row of rawRows) {
      if (row.id && row.customer_phone) {
        carnetIdToPhone.set(row.id, row.customer_phone);
      }
    }

    const issuedByPhone = new Map<string, number>();
    for (const row of (orderRowsResult.data ?? []) as Array<{ customer_phone?: string | null; total_price?: number | null; delivery_fee?: number | null }>) {
      const phone = String(row.customer_phone ?? "");
      if (!phone) continue;
      const next = Number((issuedByPhone.get(phone) ?? 0) + Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0));
      issuedByPhone.set(phone, next);
    }

    const repaidByPhone = new Map<string, number>();
    for (const row of (paymentRowsResult.data ?? []) as Array<{ vendor_carnet_id?: string | null; amount?: number | null }>) {
      const phone = row.vendor_carnet_id ? carnetIdToPhone.get(String(row.vendor_carnet_id)) : null;
      if (!phone) continue;
      const next = Number((repaidByPhone.get(phone) ?? 0) + Number(row.amount ?? 0));
      repaidByPhone.set(phone, next);
    }

    const carnetCustomers = uniqueCustomers.map((customerPhone) => {
      const latestRow = rawRows.find((row) => row.customer_phone === customerPhone)!;
      const issued = Number(issuedByPhone.get(customerPhone) ?? 0);
      const repaid = Number(repaidByPhone.get(customerPhone) ?? 0);
      const dynamicDebt = Number((issued - repaid).toFixed(2));

      return {
        id: latestRow.id,
        customerPhone,
        currentDebt: dynamicDebt,
        maxLimit: Number(latestRow.max_limit ?? 0),
        customerName: latestRow.customer_name,
        customerCin: latestRow.customer_cin,
        status: latestRow.status,
      };
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const totalOutstandingCreditMad = carnetCustomers.reduce(
      (sum, customer) => sum + Number(customer.currentDebt ?? 0),
      0,
    );

    const creditIssuedTodayMad = ((orderRowsResult.data ?? []) as Array<{ total_price?: number | null; delivery_fee?: number | null; created_at?: string | null }>)
      .filter((row) => {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        return createdAt ? createdAt.getTime() >= startOfToday.getTime() : false;
      })
      .reduce((sum, row) => sum + Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0), 0);

    const settledCreditMad = ((paymentRowsResult.data ?? []) as Array<{ amount?: number | null }>).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    );

    return {
      vendor,
      carnetCustomers,
      kpis: {
        totalOutstandingCreditMad: Number(totalOutstandingCreditMad.toFixed(2)),
        creditIssuedTodayMad: Number(creditIssuedTodayMad.toFixed(2)),
        settledCreditMad: Number(settledCreditMad.toFixed(2)),
      },
    };
  } catch (error) {
    console.error("getVendorCarnetData failed:", error);
    throw new Error("Failed to load carnet data.");
  }
});

export const upsertVendorCarnetCustomer = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertCarnetCustomerInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor(data.phoneNumber);

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { error } = await (supabaseAdmin as any).from("vendor_carnet").upsert(
        {
          vendor_id: vendor.id,
          customer_phone: data.customerPhone,
          max_limit: data.maxLimit,
          customer_name: data.customerName ?? null,
          customer_cin: data.customerCin,
          status: "active",
        },
        {
          onConflict: "vendor_id,customer_phone",
          ignoreDuplicates: false,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("upsertVendorCarnetCustomer failed:", error);
      throw new Error("Failed to save trusted customer.");
    }
  });

export const clearVendorCarnetDebt = createServerFn({ method: "POST" })
  .inputValidator((input) => clearCarnetDebtInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor(data.phoneNumber);

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { error } = await (supabaseAdmin as any).rpc("clear_vendor_carnet_debt", {
        p_vendor_id: vendor.id,
        p_customer_phone: data.customerPhone,
      });

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("clearVendorCarnetDebt failed:", error);
      throw new Error("Failed to clear customer debt.");
    }
  });

export const getCheckoutPaymentOptions = createServerFn({ method: "POST" })
  .inputValidator((input) => getCheckoutPaymentOptionsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: neighborhood, error: neighborhoodError } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .select("vendor_id")
        .eq("id", data.neighborhoodId)
        .maybeSingle();

      if (neighborhoodError) {
        throw new Error(neighborhoodError.message);
      }

      const vendorId = (neighborhood as { vendor_id?: string | null } | null)?.vendor_id ?? null;
      const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
        .from("vendors")
        .select("id")
        .eq("is_active", true)
        .eq("id", vendorId)
        .maybeSingle();

      if (vendorError || !vendor?.id) {
        return {
          canUseCarnet: false,
          reason: "No active vendor found for this neighborhood.",
        };
      }

      const { data: carnetRow, error: carnetError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("max_limit")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .maybeSingle();

      if (carnetError) {
        throw new Error(carnetError.message);
      }

      if (!carnetRow) {
        return { canUseCarnet: false, reason: "Customer is not on trusted carnet list." };
      }

      const currentDebt = await getDynamicDebtForVendorCustomer(String(vendor.id), data.customerPhone);
      const maxLimit = Number(carnetRow.max_limit ?? 0);
      const projectedDebt = currentDebt + Number(data.cartTotal ?? 0);

      if (projectedDebt > maxLimit) {
        return {
          canUseCarnet: false,
          reason: "This order would exceed your carnet limit.",
          currentDebt,
          maxLimit,
        };
      }

      return {
        canUseCarnet: true,
        currentDebt,
        maxLimit,
      };
    } catch (error) {
      console.error("getCheckoutPaymentOptions failed:", error);
      throw new Error("Failed to check payment options.");
    }
  });

export const lookupCustomerByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => lookupCustomerByPhoneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      await getActiveVendor(data.phoneNumber);
      const { data: customer, error } = await (supabaseAdmin as any)
        .from("customers")
        .select("id, full_name")
        .eq("phone_number", data.customerPhone)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!customer) {
        return { found: false as const };
      }

      return {
        found: true as const,
        customer: {
          id: customer.id as string,
          fullName: (customer.full_name as string | null) ?? null,
        },
      };
    } catch (error) {
      console.error("lookupCustomerByPhone failed:", error);
      throw new Error("Failed to lookup customer.");
    }
  });

export const verifyAndAddVendorCarnetCustomer = createServerFn({ method: "POST" })
  .inputValidator((input) => verifyAndAddVendorCarnetCustomerInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor(data.phoneNumber);

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { data: existingCarnet, error: existingError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("id")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existingCarnet) {
        throw new Error("This customer is already in your carnet list.");
      }

      const { data: otpRequest, error: otpFetchError } = await (supabaseAdmin as any)
        .from("otp_requests")
        .select("id, otp_code")
        .eq("phone_number", data.customerPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpFetchError) {
        throw new Error(otpFetchError.message);
      }

      if (!otpRequest || otpRequest.otp_code !== data.otpCode) {
        return { verified: false as const };
      }

      const { error: deleteError } = await (supabaseAdmin as any)
        .from("otp_requests")
        .delete()
        .eq("id", otpRequest.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const { data: customerProfile } = await (supabaseAdmin as any)
        .from("customers")
        .select("full_name")
        .eq("phone_number", data.customerPhone)
        .maybeSingle();

      const resolvedName =
        (customerProfile?.full_name as string | null | undefined) ?? data.customerName ?? null;

      if (!resolvedName) {
        throw new Error("Customer name is required.");
      }

      const { error: insertError } = await (supabaseAdmin as any).from("vendor_carnet").insert({
        vendor_id: vendor.id,
        customer_phone: data.customerPhone,
        max_limit: data.maxLimit,
        customer_name: resolvedName,
        customer_cin: data.customerCin,
        status: "active",
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      return { verified: true as const, ok: true as const };
    } catch (error) {
      console.error("verifyAndAddVendorCarnetCustomer failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to verify and add customer.");
    }
  });

export const getCarnetCustomerLedger = createServerFn({ method: "POST" })
  .inputValidator((input) => getCarnetCustomerLedgerInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor(data.phoneNumber);

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { data: customer, error: customerError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("id, customer_phone, customer_name, customer_cin, max_limit")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .maybeSingle();

      if (customerError) {
        throw new Error(customerError.message);
      }

      if (!customer?.id) {
        throw new Error("Carnet customer not found.");
      }

      const dynamicDebt = await getDynamicDebtForVendorCustomer(vendor.id, data.customerPhone);

      const { data: ledgerRows, error: ledgerError } = await (supabaseAdmin as any)
        .from("carnet_transactions")
        .select("id, order_id, payment_id, transaction_type, amount, created_at")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .order("created_at", { ascending: false });

      if (ledgerError) {
        throw new Error(ledgerError.message);
      }

      const transactions = ((ledgerRows ?? []) as Array<{
        id: string;
        order_id?: string | null;
        payment_id?: string | null;
        transaction_type: "CREDIT_ISSUED" | "CREDIT_REPAID";
        amount?: number | null;
        created_at: string;
      }>)
        .map((row) => {
          const isIssued = row.transaction_type === "CREDIT_ISSUED";
          const orderId = row.order_id ? String(row.order_id) : null;
          const paymentId = row.payment_id ? String(row.payment_id) : null;

          return {
            id: isIssued
              ? `order:${orderId ?? row.id}`
              : `payment:${paymentId ?? row.id}`,
            createdAt: row.created_at,
            description: isIssued
              ? `Order placed #${String(orderId ?? row.id).slice(0, 8).toUpperCase()}`
              : "Payment recorded",
            amount: Number(row.amount ?? 0),
            kind: isIssued ? ("debt" as const) : ("payment" as const),
          };
        })
        .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
        });

      return {
        customer: {
          id: customer.id as string,
          phone: customer.customer_phone as string,
          name: (customer.customer_name as string | null) ?? "Unnamed Customer",
          cin: (customer.customer_cin as string | null) ?? "—",
          currentDebt: dynamicDebt,
          maxLimit: Number(customer.max_limit ?? 0),
        },
        transactions,
      };
    } catch (error) {
      console.error("getCarnetCustomerLedger failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to load customer ledger.");
    }
  });

export const recordVendorCarnetPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => recordVendorCarnetPaymentInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor(data.phoneNumber);

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { data: carnetRow, error: carnetError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("id, current_debt")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (carnetError) {
        throw new Error(carnetError.message);
      }

      const latestDebt = Number(carnetRow?.current_debt ?? 0);
      if (!carnetRow?.id || latestDebt <= 0.01) {
        throw new Error("No outstanding debt for this customer.");
      }

      if (data.amountPaid > latestDebt + 0.01) {
        throw new Error(`Payment amount exceeds current debt (${latestDebt.toFixed(2)} MAD).`);
      }

      const { data: rpcResult, error } = await (supabaseAdmin as any).rpc("record_vendor_carnet_payment", {
        p_vendor_id: vendor.id,
        p_customer_phone: data.customerPhone,
        p_amount: data.amountPaid,
      });

      if (error) {
        if (error.message.includes("Payment amount exceeds current debt")) {
          const { data: freshestRow } = await (supabaseAdmin as any)
            .from("vendor_carnet")
            .select("current_debt")
            .eq("vendor_id", vendor.id)
            .eq("customer_phone", data.customerPhone)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const freshestDebt = Number(freshestRow?.current_debt ?? 0);
          throw new Error(`Payment amount exceeds current debt (${freshestDebt.toFixed(2)} MAD).`);
        }

        throw new Error(error.message);
      }

      const row = Array.isArray(rpcResult) ? rpcResult[0] : null;

      return {
        ok: true as const,
        paymentId: (row?.payment_id as string | undefined) ?? null,
        newCurrentDebt: Number(row?.remaining_debt ?? 0),
      };
    } catch (error) {
      console.error("recordVendorCarnetPayment failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to record payment.");
    }
  });

export const getCustomerCarnetStatement = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerCarnetStatementInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: profile, error: profileError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("phone", data.customerPhone)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      const customerUserId = profile?.id ? String(profile.id) : null;
      if (!customerUserId) {
        throw new Error("Customer session is invalid.");
      }

      const { data: orderRows, error: ordersError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, vendor_id, customer_user_id, payment_method, status, total_price, delivery_fee, created_at")
        .eq("customer_user_id", customerUserId)
        .eq("status", "delivered")
        .order("created_at", { ascending: false });

      if (ordersError) {
        throw new Error(ordersError.message);
      }

      const isCreditPayment = (paymentMethod: string | null | undefined) => {
        const normalized = String(paymentMethod ?? "").trim().toLowerCase();
        return normalized === "credit" || normalized === "carnet";
      };

      const creditRows = ((orderRows ?? []) as Array<{
        id: string;
        vendor_id: string | null;
        payment_method: string | null;
        total_price: number | null;
        delivery_fee: number | null;
        created_at: string;
      }>).filter((row) => isCreditPayment(row.payment_method));

      const vendorIds = Array.from(new Set(creditRows.map((row) => row.vendor_id).filter(Boolean) as string[]));
      const vendorNameMap = new Map<string, string>();

      if (vendorIds.length > 0) {
        const { data: vendors, error: vendorsError } = await (supabaseAdmin as any)
          .from("vendors")
          .select("id, store_name")
          .in("id", vendorIds);

        if (vendorsError) {
          throw new Error(vendorsError.message);
        }

        for (const row of (vendors ?? []) as Array<{ id: string; store_name: string | null }>) {
          vendorNameMap.set(row.id, row.store_name?.trim() || "Unknown Store");
        }
      }

      const entries = creditRows.map((row) => {
        const amountMad = Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0);
        return {
          orderId: row.id,
          orderDate: row.created_at,
          vendorName: row.vendor_id ? vendorNameMap.get(row.vendor_id) ?? "Unknown Store" : "Unknown Store",
          amountMad,
          status: "unpaid" as const,
        };
      });

      const totalOutstandingDebtMad = entries.reduce((sum, row) => sum + row.amountMad, 0);

      return {
        totalOutstandingDebtMad,
        entries,
      };
    } catch (error) {
      console.error("getCustomerCarnetStatement failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to load customer carnet statement.");
    }
  });

export const getCustomerCarnetOverview = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerCarnetOverviewInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: carnetRows, error: carnetError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("id, vendor_id, customer_phone, current_debt, max_limit, status")
        .eq("customer_phone", data.customerPhone)
        .eq("status", "active")
        .order("updated_at", { ascending: false });

      if (carnetError) {
        throw new Error(carnetError.message);
      }

      const activeRows = (carnetRows ?? []) as Array<{
        id?: string | null;
        vendor_id?: string | null;
        customer_phone?: string | null;
        current_debt?: number | null;
        max_limit?: number | null;
      }>;

      const vendorIds = Array.from(new Set(activeRows.map((row) => row.vendor_id).filter(Boolean) as string[]));
      const carnetIds = Array.from(new Set(activeRows.map((row) => row.id).filter(Boolean) as string[]));

      if (vendorIds.length === 0 || carnetIds.length === 0) {
        return { carnet: null, transactions: [] as Array<any> };
      }

      const { data: ledgerRows, error: ledgerError } = await (supabaseAdmin as any)
        .from("carnet_transactions")
        .select("id, order_id, payment_id, vendor_carnet_id, transaction_type, amount, created_at")
        .in("vendor_id", vendorIds)
        .eq("customer_phone", data.customerPhone)
        .order("created_at", { ascending: false });

      if (ledgerError) {
        throw new Error(ledgerError.message);
      }

      const transactions = ((ledgerRows ?? []) as Array<{
        id: string;
        order_id?: string | null;
        payment_id?: string | null;
        transaction_type: "CREDIT_ISSUED" | "CREDIT_REPAID";
        amount?: number | null;
        created_at: string;
      }>)
        .map((row) => {
          const isIssued = row.transaction_type === "CREDIT_ISSUED";
          const orderId = row.order_id ? String(row.order_id) : null;
          const paymentId = row.payment_id ? String(row.payment_id) : null;

          return {
            id: isIssued
              ? `order:${orderId ?? row.id}`
              : `payment:${paymentId ?? row.id}`,
            createdAt: row.created_at,
            description: isIssued
              ? `Order placed #${String(orderId ?? row.id).slice(0, 8).toUpperCase()}`
              : "Payment recorded",
            amount: Number(row.amount ?? 0),
            kind: isIssued ? ("debt" as const) : ("payment" as const),
          };
        })
        .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
        });

      const totalCurrentDebtMad = activeRows.reduce(
        (sum, row) => sum + Number(row.current_debt ?? 0),
        0,
      );

      const totalMaxLimitMad = activeRows.reduce(
        (sum, row) => sum + Number(row.max_limit ?? 0),
        0,
      );

      return {
        carnet: {
          customerPhone: data.customerPhone,
          currentDebt: totalCurrentDebtMad,
          maxLimit: totalMaxLimitMad,
        },
        transactions,
      };
    } catch (error) {
      console.error("getCustomerCarnetOverview failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to load your carnet.");
    }
  });

export const getCustomerCarnetBalance = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerCarnetBalanceInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("current_debt")
        .eq("customer_phone", data.customerPhone)
        .eq("status", "active");

      if (error) {
        throw new Error(error.message);
      }

      const totalDebtMad = (rows ?? []).reduce(
        (sum: number, row: { current_debt?: number | null }) => sum + Number(row.current_debt ?? 0),
        0,
      );

      return {
        hasCarnet: (rows ?? []).length > 0,
        totalDebtMad,
      };
    } catch (error) {
      console.error("getCustomerCarnetBalance failed:", error);
      throw new Error("Failed to load carnet balance.");
    }
  });
