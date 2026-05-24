import { createHash, randomBytes } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const generateMobileApiKeyInputSchema = z.object({
  keyName: z.string().trim().min(1).max(120).optional(),
});

const revokeMobileApiKeyInputSchema = z.object({
  id: z.string().uuid(),
});

type MobileApiKeyRow = {
  id: string;
  key_name: string;
  key_prefix: string;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
};

export const listMobileApiKeys = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("mobile_api_keys")
    .select("id, key_name, key_prefix, is_active, revoked_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load mobile API keys: ${error.message}`);
  }

  return (data ?? []) as MobileApiKeyRow[];
});

export const generateMobileApiKey = createServerFn({ method: "POST" })
  .inputValidator((input) => generateMobileApiKeyInputSchema.parse(input))
  .handler(async ({ data }) => {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const keyPrefix = token.slice(0, 12);

    const fallbackName = `Mobile Key ${new Date().toISOString().slice(0, 10)}`;
    const keyName = data.keyName?.trim() || fallbackName;

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("mobile_api_keys")
      .insert({
        key_name: keyName,
        key_prefix: keyPrefix,
        api_key_hash: tokenHash,
        is_active: true,
      })
      .select("id, key_name, key_prefix, is_active, revoked_at, created_at")
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to generate mobile API key: ${error?.message ?? "Unknown error"}`);
    }

    return {
      id: inserted.id as string,
      keyName: inserted.key_name as string,
      keyPrefix: inserted.key_prefix as string,
      token,
      createdAt: inserted.created_at as string,
    };
  });

export const revokeMobileApiKey = createServerFn({ method: "POST" })
  .inputValidator((input) => revokeMobileApiKeyInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("mobile_api_keys")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to revoke mobile API key: ${error.message}`);
    }

    if (!updated) {
      throw new Error("Mobile API key was not found or is already revoked.");
    }

    return { success: true as const };
  });