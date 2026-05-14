import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MarkupRule = {
  id: string;
  minPrice: number;
  maxPrice: number;
  markupType: "fixed" | "percentage";
  markupValue: number;
  isActive: boolean;
};

const CACHE_TTL_MS = 60_000;

let cachedRules: MarkupRule[] | null = null;
let cachedAt = 0;

function normalizeMarkupRuleRow(row: any): MarkupRule {
  return {
    id: String(row.id),
    minPrice: Number(row.min_price ?? 0),
    maxPrice: Number(row.max_price ?? 0),
    markupType: row.markup_type === "percentage" ? "percentage" : "fixed",
    markupValue: Number(row.markup_value ?? 0),
    isActive: Boolean(row.is_active),
  };
}

export function clearMarkupRulesCache() {
  cachedRules = null;
  cachedAt = 0;
}

export async function getActiveMarkupRulesCached(): Promise<MarkupRule[]> {
  const now = Date.now();
  if (cachedRules && now - cachedAt < CACHE_TTL_MS) {
    return cachedRules;
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("markup_rules")
    .select("id, min_price, max_price, markup_type, markup_value, is_active")
    .eq("is_active", true)
    .order("min_price", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load pricing rules.");
  }

  const normalized = ((data ?? []) as any[])
    .map(normalizeMarkupRuleRow)
    .filter((rule) => rule.maxPrice > rule.minPrice)
    .sort((a, b) => a.minPrice - b.minPrice);

  cachedRules = normalized;
  cachedAt = now;
  return normalized;
}
