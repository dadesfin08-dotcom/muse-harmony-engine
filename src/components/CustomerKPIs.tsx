import { useAppLanguage } from "@/hooks/use-localization";

type CustomerKpis = {
  totalCustomers: number;
  vipCustomers: number;
  highRiskOrBlocked: number;
  averageLtv: number;
};

function formatMad(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} MAD`;
}

export function CustomerKPIs({ kpis }: { kpis: CustomerKpis | null | undefined }) {
  const { intlLocale, isRtl } = useAppLanguage();

  const cards = [
    { label: "Total Customers", value: String(kpis?.totalCustomers ?? 0) },
    { label: "VIP Customers", value: String(kpis?.vipCustomers ?? 0) },
    { label: "High Risk / Blocked", value: String(kpis?.highRiskOrBlocked ?? 0) },
    { label: "Average LTV", value: formatMad(Number(kpis?.averageLtv ?? 0), intlLocale) },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
        </article>
      ))}
    </div>
  );
}
