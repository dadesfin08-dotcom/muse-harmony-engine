import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clearMarkupRulesCache, getActiveMarkupRulesCached } from "@/lib/markup-rules.server";

const markupRuleInputSchema = z.object({
  minPrice: z.number().min(0).max(1_000_000),
  maxPrice: z.number().gt(0).max(1_000_000),
  markupType: z.enum(["fixed", "percentage"]),
  markupValue: z.number().min(0).max(10_000),
  isActive: z.boolean().default(true),
});

const createMarkupRuleInputSchema = markupRuleInputSchema.superRefine((value, ctx) => {
  if (value.maxPrice <= value.minPrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxPrice"],
      message: "Max price must be greater than min price.",
    });
  }
});

const updateMarkupRuleInputSchema = markupRuleInputSchema
  .extend({
    id: z.string().uuid(),
  })
  .superRefine((value, ctx) => {
    if (value.maxPrice <= value.minPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxPrice"],
        message: "Max price must be greater than min price.",
      });
    }
  });

const deleteMarkupRuleInputSchema = z.object({
  id: z.string().uuid(),
});

type MarkupRuleRow = {
  id: string;
  min_price: number;
  max_price: number;
  markup_type: "fixed" | "percentage";
  markup_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function normalizeMarkupRule(row: MarkupRuleRow) {
  return {
    id: row.id,
    minPrice: Number(row.min_price ?? 0),
    maxPrice: Number(row.max_price ?? 0),
    markupType: row.markup_type,
    markupValue: Number(row.markup_value ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMin < bMax && bMin < aMax;
}

async function ensureNoActiveRangeOverlap(
  supabase: any,
  rule: { id?: string; minPrice: number; maxPrice: number; isActive: boolean },
) {
  if (!rule.isActive) return;

  const { data, error } = await (supabase as any)
    .from("markup_rules")
    .select("id, min_price, max_price, is_active")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message || "Failed to validate pricing rules.");
  }

  const overlap = ((data ?? []) as Array<{ id: string; min_price: number; max_price: number; is_active: boolean }>).find(
    (row) => row.id !== rule.id && rangesOverlap(rule.minPrice, rule.maxPrice, Number(row.min_price), Number(row.max_price)),
  );

  if (overlap) {
    throw new Error("Price range overlaps with an existing active rule.");
  }
}

export const listMarkupRules = createServerFn({ method: "GET" }).handler(async () => {
    const { data, error } = await (supabaseAdmin as any)
      .from("markup_rules")
      .select("id, min_price, max_price, markup_type, markup_value, is_active, created_at, updated_at")
      .order("min_price", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load pricing rules.");
    }
    return ((data ?? []) as MarkupRuleRow[]).map(normalizeMarkupRule);
  });

export const listPublicActiveMarkupRules = createServerFn({ method: "GET" }).handler(async () => {
  return getActiveMarkupRulesCached();
});

export const createMarkupRule = createServerFn({ method: "POST" })
  .inputValidator((input) => createMarkupRuleInputSchema.parse(input))
  .handler(async ({ data }) => {
    await ensureNoActiveRangeOverlap(supabaseAdmin as any, data);

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("markup_rules")
      .insert({
        min_price: Number(data.minPrice),
        max_price: Number(data.maxPrice),
        markup_type: data.markupType,
        markup_value: Number(data.markupValue),
        is_active: data.isActive,
      })
      .select("id, min_price, max_price, markup_type, markup_value, is_active, created_at, updated_at")
      .single();

    if (error || !inserted?.id) {
      throw new Error(error?.message || "Failed to create pricing rule.");
    }

    clearMarkupRulesCache();
    return normalizeMarkupRule(inserted as MarkupRuleRow);
  });

export const updateMarkupRule = createServerFn({ method: "POST" })
  .inputValidator((input) => updateMarkupRuleInputSchema.parse(input))
  .handler(async ({ data }) => {
    await ensureNoActiveRangeOverlap(supabaseAdmin as any, data);

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("markup_rules")
      .update({
        min_price: Number(data.minPrice),
        max_price: Number(data.maxPrice),
        markup_type: data.markupType,
        markup_value: Number(data.markupValue),
        is_active: data.isActive,
      })
      .eq("id", data.id)
      .select("id, min_price, max_price, markup_type, markup_value, is_active, created_at, updated_at")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message || "Failed to update pricing rule.");
    }

    clearMarkupRulesCache();
    return normalizeMarkupRule(updated as MarkupRuleRow);
  });

export const deleteMarkupRule = createServerFn({ method: "POST" })
  .inputValidator((input) => deleteMarkupRuleInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("markup_rules").delete().eq("id", data.id);

    if (error) {
      throw new Error(error.message || "Failed to delete pricing rule.");
    }

    clearMarkupRulesCache();
    return { success: true };
  });
