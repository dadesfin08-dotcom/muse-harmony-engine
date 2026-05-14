import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_RECEIPT_ADDRESS,
  DEFAULT_RECEIPT_FOOTER_CONTENT,
  DEFAULT_RECEIPT_HEADER_CONTENT,
  DEFAULT_RECEIPT_PHONE,
} from "@/lib/receipt-settings.defaults";

const updateInvoiceSettingsInputSchema = z.object({
  id: z.string().uuid(),
  storeName: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(220),
  phone: z.string().trim().min(3).max(30),
  taxId: z.string().trim().max(120).nullable(),
  footerMessage: z.string().trim().min(1).max(240),
});

export type InvoiceSettingsRecord = {
  id: string;
  store_name: string;
  address: string;
  phone: string;
  tax_id: string | null;
  footer_message: string;
  created_at: string;
  updated_at: string;
};

const DEFAULT_INVOICE_SETTINGS = {
  store_name: DEFAULT_RECEIPT_HEADER_CONTENT,
  address: DEFAULT_RECEIPT_ADDRESS,
  phone: DEFAULT_RECEIPT_PHONE,
  tax_id: null,
  footer_message: DEFAULT_RECEIPT_FOOTER_CONTENT,
};

export const getInvoiceSettings = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data: row, error } = await (supabaseAdmin as any)
      .from("invoice_settings")
      .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (row) {
      const normalizedDefaultsPatch = {
        store_name: row.store_name?.trim() ? row.store_name : DEFAULT_RECEIPT_HEADER_CONTENT,
        address: row.address?.trim() ? row.address : DEFAULT_RECEIPT_ADDRESS,
        phone: row.phone?.trim() ? row.phone : DEFAULT_RECEIPT_PHONE,
        footer_message: row.footer_message?.trim() ? row.footer_message : DEFAULT_RECEIPT_FOOTER_CONTENT,
      };

      if (
        normalizedDefaultsPatch.store_name !== row.store_name ||
        normalizedDefaultsPatch.address !== row.address ||
        normalizedDefaultsPatch.phone !== row.phone ||
        normalizedDefaultsPatch.footer_message !== row.footer_message
      ) {
        const { data: patchedRow, error: patchError } = await (supabaseAdmin as any)
          .from("invoice_settings")
          .update(normalizedDefaultsPatch)
          .eq("id", row.id)
          .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
          .single();

        if (patchError || !patchedRow?.id) {
          throw new Error(patchError?.message ?? "Unable to apply default receipt settings.");
        }

        return patchedRow as InvoiceSettingsRecord;
      }

      return row as InvoiceSettingsRecord;
    }

    const { data: inserted, error: insertError } = await (supabaseAdmin as any)
      .from("invoice_settings")
      .insert(DEFAULT_INVOICE_SETTINGS)
      .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message ?? "Unable to initialize invoice settings.");
    }

    return inserted as InvoiceSettingsRecord;
  } catch (error) {
    console.error("getInvoiceSettings failed:", error);
    throw new Error("Failed to load receipt settings.");
  }
});

export const updateInvoiceSettings = createServerFn({ method: "POST" })
  .inputValidator((input) => updateInvoiceSettingsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const payload = {
        store_name: data.storeName,
        address: data.address,
        phone: data.phone,
        tax_id: data.taxId,
        footer_message: data.footerMessage,
      };

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("invoice_settings")
        .update(payload)
        .eq("id", data.id)
        .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Receipt settings update failed.");
      }

      return updated as InvoiceSettingsRecord;
    } catch (error) {
      console.error("updateInvoiceSettings failed:", error);
      throw new Error("Failed to save receipt settings.");
    }
  });
