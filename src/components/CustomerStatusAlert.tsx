import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Ban, ShieldCheck, X, XOctagon } from "lucide-react";

import { useAppLanguage } from "@/hooks/use-localization";
import { getCustomerProfileByPhone } from "@/lib/customers.functions";
import { cn } from "@/lib/utils";
import { statusContent, type CustomerAlertState } from "@/utils/statusTranslations";

const CUSTOMER_SESSION_STORAGE_KEY = "bzaf.customerSession";
const DISMISSED_ALERT_STATE_KEY = "dismissed_alert_state";

const iconMap = {
  ShieldCheck,
  AlertTriangle,
  Ban,
  XOctagon,
} as const;

type CustomerProfileState = {
  status?: "active" | "vip" | "warning" | "suspicious" | "blocked" | null;
  systemTags?: string[];
  codRejections?: number;
  fakeOrders?: number;
  cancelledOrders?: number;
} | null;

function resolveAlertState(profile: CustomerProfileState): CustomerAlertState | null {
  if (!profile) return null;

  const status = String(profile.status ?? "").toLowerCase();
  const tags = new Set((profile.systemTags ?? []).map((tag) => String(tag).toLowerCase()));
  const codRejections = Number(profile.codRejections ?? 0);
  const fakeOrders = Number(profile.fakeOrders ?? 0);
  const cancelledOrders = Number(profile.cancelledOrders ?? 0);

  const hasSpamTag = Array.from(tags).some((tag) => tag.includes("سبام") || tag.includes("spam"));
  const hasCodTag = Array.from(tags).some((tag) => tag.includes("رفض cod") || tag.includes("cod"));
  const hasCancelTag = Array.from(tags).some((tag) => tag.includes("إلغاء") || tag.includes("cancel"));
  const hasVipTag = Array.from(tags).some((tag) => tag.includes("موثوق") || tag.includes("vip"));

  if (status === "blocked" || status === "suspicious") {
    if (fakeOrders >= 1 || hasSpamTag) return "blocked_spam";
    if (codRejections >= 1 || hasCodTag) return "blocked_cod";
    return "blocked_spam";
  }

  if (status === "warning" || cancelledOrders >= 3 || hasCancelTag) {
    return "warning_cancel";
  }

  if (status === "vip" || hasVipTag) {
    return "vip";
  }

  return null;
}

export function CustomerStatusAlert() {
  const { language, isRtl } = useAppLanguage();
  const fetchCustomerProfileByPhone = useServerFn(getCustomerProfileByPhone);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [dismissedState, setDismissedState] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      const rawSession = window.localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
      if (!rawSession) {
        setCustomerPhone(null);
        return;
      }

      const parsedSession = JSON.parse(rawSession) as { phoneNumber?: string };
      setCustomerPhone(typeof parsedSession.phoneNumber === "string" ? parsedSession.phoneNumber : null);
    } catch {
      setCustomerPhone(null);
    }

    try {
      setDismissedState(window.localStorage.getItem(DISMISSED_ALERT_STATE_KEY));
    } catch {
      setDismissedState(null);
    }
  }, []);

  const profileQuery = useQuery({
    queryKey: ["customer", "status-alert", customerPhone],
    queryFn: () => fetchCustomerProfileByPhone({ data: { phoneNumber: customerPhone! } }),
    enabled: !!customerPhone,
    refetchInterval: customerPhone ? 10_000 : false,
  });

  const alertState = useMemo(
    () => resolveAlertState((profileQuery.data as CustomerProfileState) ?? null),
    [profileQuery.data],
  );

  const isHardBlocked = alertState === "blocked_cod" || alertState === "blocked_spam";

  useEffect(() => {
    if (!alertState) {
      setIsDismissed(false);
      return;
    }

    if (isHardBlocked) {
      setIsDismissed(false);
      return;
    }

    setIsDismissed(dismissedState === alertState);
  }, [alertState, dismissedState, isHardBlocked]);

  if (!alertState || !customerPhone || profileQuery.isLoading || isDismissed) {
    return null;
  }

  const content = statusContent[alertState][language];
  const ActiveIcon = iconMap[content.icon];

  const handleDismiss = () => {
    if (!alertState || isHardBlocked) return;

    window.localStorage.setItem(DISMISSED_ALERT_STATE_KEY, alertState);
    setDismissedState(alertState);
    setIsDismissed(true);
  };

  return (
    <div className={cn("relative mb-6 flex items-start gap-4 rounded-xl border p-4 shadow-sm", content.color)}>
      <div className="mt-0.5 shrink-0">
        <ActiveIcon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h4 className="mb-1 text-sm font-bold">{content.title}</h4>
        <p className="text-xs leading-relaxed opacity-90">{content.desc}</p>
      </div>
      {!isHardBlocked ? (
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "absolute top-3 opacity-60 transition-opacity hover:opacity-100",
            isRtl ? "left-3" : "right-3",
          )}
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
