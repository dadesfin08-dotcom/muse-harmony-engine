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

const updateInvoiceSettingsInputSchema = z.object({
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
});

const uploadReceiptLogoInputSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  dataUrl: z.string().trim().min(1).max(10_000_000),
});

export type InvoiceSettingsRecord = {
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

const DEFAULT_INVOICE_SETTINGS = {
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
};

export const getInvoiceSettings = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data: row, error } = await (supabaseAdmin as any)
      .from("invoice_settings")
      .select(
        "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
      )
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
        receipt_store_name: row.receipt_store_name?.trim() ? row.receipt_store_name : DEFAULT_RECEIPT_STORE_NAME,
        receipt_slogan: row.receipt_slogan?.trim() ? row.receipt_slogan : DEFAULT_RECEIPT_SLOGAN,
        receipt_phone: row.receipt_phone?.trim() ? row.receipt_phone : DEFAULT_RECEIPT_PHONE,
        receipt_address: row.receipt_address?.trim() ? row.receipt_address : DEFAULT_RECEIPT_ADDRESS,
        receipt_website: row.receipt_website?.trim() ? row.receipt_website : DEFAULT_RECEIPT_WEBSITE,
        receipt_footer_message: row.receipt_footer_message?.trim()
          ? row.receipt_footer_message
          : DEFAULT_RECEIPT_FOOTER_MESSAGE,
        receipt_social_support: row.receipt_social_support?.trim()
          ? row.receipt_social_support
          : DEFAULT_RECEIPT_SOCIAL_SUPPORT,
      };

      if (
        normalizedDefaultsPatch.store_name !== row.store_name ||
        normalizedDefaultsPatch.address !== row.address ||
        normalizedDefaultsPatch.phone !== row.phone ||
        normalizedDefaultsPatch.footer_message !== row.footer_message ||
        normalizedDefaultsPatch.receipt_store_name !== row.receipt_store_name ||
        normalizedDefaultsPatch.receipt_slogan !== row.receipt_slogan ||
        normalizedDefaultsPatch.receipt_phone !== row.receipt_phone ||
        normalizedDefaultsPatch.receipt_address !== row.receipt_address ||
        normalizedDefaultsPatch.receipt_website !== row.receipt_website ||
        normalizedDefaultsPatch.receipt_footer_message !== row.receipt_footer_message ||
        normalizedDefaultsPatch.receipt_social_support !== row.receipt_social_support
      ) {
        const { data: patchedRow, error: patchError } = await (supabaseAdmin as any)
          .from("invoice_settings")
          .update(normalizedDefaultsPatch)
          .eq("id", row.id)
          .select(
            "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
          )
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
      .select(
        "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
      )
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
      };

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("invoice_settings")
        .update(payload)
        .eq("id", data.id)
        .select(
          "id, store_name, address, phone, tax_id, footer_message, receipt_logo_url, receipt_store_name, receipt_slogan, receipt_phone, receipt_address, receipt_website, receipt_footer_message, receipt_social_support, created_at, updated_at",
        )
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

export const uploadReceiptLogo = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadReceiptLogoInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
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
      const generatedFileName = `${crypto.randomUUID()}-${safeBaseName || "receipt-logo"}.${extensionFromName}`;
      const path = `receipts/${generatedFileName}`;

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
    } catch (error) {
      console.error("uploadReceiptLogo failed:", error);
      throw new Error("Failed to upload receipt logo.");
    }
  });
