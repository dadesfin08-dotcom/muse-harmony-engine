import { getActiveMarkupRulesCached } from "@/lib/markup-rules.server";

type PricingRule = {
  minPrice: number;
  maxPrice: number;
  markupType: "fixed" | "percentage";
  markupValue: number;
};

function resolveMarkupFromRules(basePrice: number, rules: PricingRule[]) {
  const matchedRule = rules.find((rule) => basePrice >= rule.minPrice && basePrice < rule.maxPrice);
  if (!matchedRule) return 0;

  if (matchedRule.markupType === "percentage") {
    return (basePrice * matchedRule.markupValue) / 100;
  }

  return matchedRule.markupValue;
}

export async function calculateMarkup(basePrice: number) {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;

  const rules = await getActiveMarkupRulesCached();
  if (rules.length === 0) {
    return 0;
  }

  return resolveMarkupFromRules(basePrice, rules);
}

export async function calculateFinalPrice(basePrice: number, applyMarkup: boolean) {
  const normalizedBase = Number(basePrice ?? 0);
  const markup = applyMarkup ? await calculateMarkup(normalizedBase) : 0;

  return {
    basePrice: normalizedBase,
    markup,
    finalPrice: normalizedBase + markup,
  };
}
