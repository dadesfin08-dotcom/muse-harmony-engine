import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { getPlatformPackDetails } from "@/lib/catalog.functions";
import { getCustomerProfileByPhone } from "@/lib/customers.functions";
import {
  createPlatformSubscriptionOrder,
  getCustomerSubscriptions,
  updateCustomerSubscriptionStatus,
  upsertCustomerProfile,
} from "@/lib/orders.functions";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { useAppLanguage } from "@/hooks/use-localization";
import { localizeText } from "@/lib/localization";

export const Route = createFileRoute("/customer/platform-packs/$packId")({
  component: PlatformPackDetailsPage,
});

type CustomerSession = {
  phoneNumber: string;
};

type LocationStorage = {
  neighborhoodId?: string;
};

type PackStatus = "pending" | "active" | "paused";

const CUSTOMER_SESSION_STORAGE_KEY = "bzaf.customerSession";
const LOCATION_STORAGE_KEY = "bzaf_fresh_location";

function PlatformPackDetailsPage() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { packId } = Route.useParams();
  const navigate = useNavigate({ from: "/customer/platform-packs/$packId" });
  const queryClient = useQueryClient();

  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [fullName, setFullName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [packQuantity, setPackQuantity] = useState(1);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [subscriptionStartDate, setSubscriptionStartDate] = useState("");
  const [subscriptionDeliveryTime, setSubscriptionDeliveryTime] = useState("");
  const [subscriptionNotes, setSubscriptionNotes] = useState("");

  const fetchPackDetails = useServerFn(getPlatformPackDetails);
  const fetchCustomerSubscriptions = useServerFn(getCustomerSubscriptions);
  const fetchCustomerProfileByPhone = useServerFn(getCustomerProfileByPhone);
  const saveCustomerProfile = useServerFn(upsertCustomerProfile);
  const submitPlatformSubscriptionOrder = useServerFn(createPlatformSubscriptionOrder);
  const submitCustomerSubscriptionStatus = useServerFn(updateCustomerSubscriptionStatus);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSubscriptionStartDate(tomorrow.toISOString().slice(0, 10));
    setSubscriptionDeliveryTime(language === "ar" ? "الصباح" : "Morning");

    const persistedSession = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
    if (persistedSession) {
      try {
        const parsed = JSON.parse(persistedSession) as CustomerSession;
        if (parsed?.phoneNumber) {
          setCustomerSession(parsed);
          setContactPhone((current) => current || parsed.phoneNumber);
        }
      } catch {
        localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
      }
    }

    const persistedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (persistedLocation) {
      try {
        const parsed = JSON.parse(persistedLocation) as LocationStorage;
        if (parsed?.neighborhoodId) {
          setSelectedNeighborhoodId(parsed.neighborhoodId);
        }
      } catch {
        localStorage.removeItem(LOCATION_STORAGE_KEY);
      }
    }
  }, [language]);

  const packDetailsQuery = useQuery({
    queryKey: ["customer", "platform-pack-details", packId],
    queryFn: () => fetchPackDetails({ data: { packId } }),
  });

  const customerProfileQuery = useQuery({
    queryKey: ["customer", "profile", customerSession?.phoneNumber ?? null],
    queryFn: () => fetchCustomerProfileByPhone({ data: { phoneNumber: customerSession!.phoneNumber } }),
    enabled: !!customerSession?.phoneNumber,
  });

  const customerSubscriptionsQuery = useQuery({
    queryKey: ["customer", "subscriptions", customerSession?.phoneNumber ?? null],
    queryFn: () => fetchCustomerSubscriptions({ data: { phoneNumber: customerSession!.phoneNumber } }),
    enabled: !!customerSession?.phoneNumber,
    placeholderData: (previousData) => previousData,
    refetchInterval: customerSession?.phoneNumber ? 7_000 : false,
  });

  useEffect(() => {
    if (!customerProfileQuery.data) return;

    setFullName((current) => current || customerProfileQuery.data?.fullName || "");
    setContactPhone((current) => current || customerProfileQuery.data?.phoneNumber || customerSession?.phoneNumber || "");
    setDeliveryAddress((current) => current || customerProfileQuery.data?.address || "");
    setSelectedNeighborhoodId((current) => current || customerProfileQuery.data?.neighborhoodId || "");
  }, [customerProfileQuery.data, customerSession?.phoneNumber]);

  const createSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!customerSession?.phoneNumber) {
        throw new Error("Please login first.");
      }
      if (!fullName.trim()) {
        throw new Error("Please add your full name before subscribing.");
      }
      if (!contactPhone.trim()) {
        throw new Error("Please add a contact phone number.");
      }
      if (!deliveryAddress.trim()) {
        throw new Error("Please add the delivery address.");
      }
      if (!selectedNeighborhoodId) {
        throw new Error("Please set your delivery location from the home page first.");
      }
      if (!subscriptionStartDate || !subscriptionDeliveryTime.trim()) {
        throw new Error("Please complete start date and preferred delivery time.");
      }

      await saveCustomerProfile({
        data: {
          phoneNumber: contactPhone.trim(),
          fullName: fullName.trim(),
          address: deliveryAddress.trim(),
          savedInstructions: "",
          neighborhoodId: selectedNeighborhoodId,
        },
      });

      await submitPlatformSubscriptionOrder({
        data: {
          packId,
          customerName: fullName.trim(),
          customerPhone: customerSession.phoneNumber,
          contactPhone: contactPhone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          packQuantity,
          neighborhoodId: selectedNeighborhoodId,
          deliveryNotes: subscriptionNotes.trim(),
          preferredStartDate: subscriptionStartDate,
          preferredDeliveryTime: subscriptionDeliveryTime.trim(),
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer", "subscriptions", customerSession?.phoneNumber ?? null] });
      await queryClient.invalidateQueries({ queryKey: ["customer", "orders", customerSession?.phoneNumber ?? null] });
      toast.success("Subscription request sent for admin review.");
      setSubscriptionNotes("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create subscription.");
    },
  });

  const subscriptionStatusMutation = useMutation({
    mutationFn: ({ subscriptionId, status }: { subscriptionId: string; status: "active" | "paused" }) =>
      submitCustomerSubscriptionStatus({
        data: {
          phoneNumber: customerSession!.phoneNumber,
          subscriptionId,
          status,
        },
      }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["customer", "subscriptions", customerSession?.phoneNumber ?? null] });
      toast.success(variables.status === "paused" ? "Subscription paused." : "Subscription resumed.");
    },
    onError: () => {
      toast.error("Failed to update subscription status.");
    },
  });

  const subscriptionState = useMemo(() => {
    const subscriptions = (customerSubscriptionsQuery.data ?? []) as Array<{
      id: string;
      packId: string;
      status: "pending" | "active" | "paused" | "expired" | "cancelled" | "completed";
      completedDeliveries: number;
      totalDeliveries: number;
    }>;

    let best: {
      id: string;
      status: PackStatus;
      completedDeliveries: number;
      totalDeliveries: number;
      priority: number;
    } | null = null;

    for (const subscription of subscriptions) {
      if (subscription.packId !== packId) continue;
      if (subscription.status !== "pending" && subscription.status !== "active" && subscription.status !== "paused") continue;

      const priority = subscription.status === "active" ? 3 : subscription.status === "paused" ? 2 : 1;
      if (!best || priority > best.priority) {
        best = {
          id: subscription.id,
          status: subscription.status,
          completedDeliveries: Math.max(0, Number(subscription.completedDeliveries ?? 0)),
          totalDeliveries: Math.max(0, Number(subscription.totalDeliveries ?? 0)),
          priority,
        };
      }
    }

    return best;
  }, [customerSubscriptionsQuery.data, packId]);

  const localizedName = useMemo(() => {
    const pack = packDetailsQuery.data;
    if (!pack) return "";

    return localizeText(language, { en: pack.name, fr: pack.nameFr, ar: pack.nameAr }, pack.name);
  }, [language, packDetailsQuery.data]);

  const billingLabel = useMemo(() => {
    const cycle = packDetailsQuery.data?.billingCycle;
    if (cycle === "DAILY") return language === "ar" ? "يومي" : language === "fr" ? "Quotidien" : "Daily";
    if (cycle === "WEEKLY") return language === "ar" ? "أسبوعي" : language === "fr" ? "Hebdomadaire" : "Weekly";
    if (cycle === "MONTHLY") return language === "ar" ? "شهري" : language === "fr" ? "Mensuel" : "Monthly";
    return "";
  }, [language, packDetailsQuery.data?.billingCycle]);

  const completedDeliveries = Math.max(0, Number(subscriptionState?.completedDeliveries ?? 0));
  const totalDeliveries = Math.max(0, Number(subscriptionState?.totalDeliveries ?? 0));
  const nextDeliveryNumber = Math.min(completedDeliveries + 1, Math.max(totalDeliveries, 1));
  const quantityEstimateMad = Math.max(0, Number(packDetailsQuery.data?.basePriceMad ?? 0)) * packQuantity;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-14 pt-5 sm:px-6">
      <div className="mb-5">
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-2 rounded-xl"
          onClick={() => {
            void navigate({ to: "/customer" });
          }}
        >
          <ArrowLeft className="size-4" />
          زر الرجوع
        </Button>
      </div>

      {packDetailsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : !packDetailsQuery.data ? (
        <AppEmptyState
          title="Pack not found"
          subtitle="This subscription pack may be unavailable now."
          className="rounded-2xl border border-border bg-card"
        />
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative h-64 w-full overflow-hidden sm:h-80">
              <img
                src={packDetailsQuery.data.imageUrl || fallbackProductImage}
                alt={`${localizedName} subscription pack`}
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute left-4 top-4">
                <Badge className="border border-success/30 bg-success/15 text-success">
                  {Number(packDetailsQuery.data.basePriceMad).toFixed(0)} MAD / {billingLabel}
                </Badge>
              </div>
            </div>

            <div className="space-y-2 p-5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{localizedName}</h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                {packDetailsQuery.data.description || "Direct prepaid platform subscription with contract-first activation."}
              </p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pack Contents</h2>
              {packDetailsQuery.data.packItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {packDetailsQuery.data.packItems.map((item, index) => {
                    const itemName = (
                      (language === "ar" ? item?.nameAr : language === "fr" ? item?.nameFr : item?.nameEn) ??
                      item?.nameEn ??
                      ""
                    ).trim() || "Pack item";
                    const itemImageUrl = (item?.imageUrl ?? "").trim();
                    const quantityText = item?.quantity != null && Number.isFinite(item.quantity) ? String(item.quantity) : "";
                    const unitText = (item?.unit ?? "").trim();
                    const qtyLabel = [quantityText, unitText].filter((value) => value.length > 0).join(" ");

                    return (
                      <div
                        key={`pack-item-${index}-${itemName}`}
                        className="overflow-hidden rounded-xl border border-border/70 bg-background/70 shadow-sm"
                      >
                        {itemImageUrl ? (
                          <img src={itemImageUrl} alt={itemName} className="h-24 w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-24 w-full items-center justify-center bg-muted px-2 text-center text-xs text-muted-foreground">
                            {itemName}
                          </div>
                        )}
                        <div className="space-y-1 p-2.5">
                          <p className="line-clamp-2 text-xs font-semibold text-foreground">{itemName}</p>
                          {qtyLabel ? (
                            <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[11px] font-medium">
                              {qtyLabel}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No items defined yet.</p>
              )}
            </article>

            <article className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pack Features</h2>
              {packDetailsQuery.data.packFeatures.length > 0 ? (
                <ul className="space-y-2">
                  {packDetailsQuery.data.packFeatures.map((feature, index) => {
                    const featureText = (
                      (language === "ar" ? feature.textAr : language === "fr" ? feature.textFr : feature.textEn) ??
                      feature.textEn ??
                      ""
                    ).trim();

                    return (
                    <li key={`pack-feature-${index}-${featureText}`} className="inline-flex items-center gap-2 text-sm text-foreground">
                      <Check className="size-4 text-primary" />
                      <span>{featureText || "Feature"}</span>
                    </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No features defined yet.</p>
              )}
            </article>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            {!customerSession?.phoneNumber ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Please login or register to subscribe to this pack.</p>
                <Button asChild className="rounded-xl">
                  <Link to="/customer" hash="auth">Go to Login / Register</Link>
                </Button>
              </div>
            ) : subscriptionState?.status === "pending" ? (
              <div className="rounded-xl border border-chart-4/35 bg-chart-4/15 p-4">
                <p className="text-sm font-semibold text-chart-4">Your subscription is currently under review.</p>
              </div>
            ) : subscriptionState?.status === "active" ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-success">
                  Delivery {nextDeliveryNumber} of {Math.max(totalDeliveries, 1)}
                </p>
                <div className="flex items-center gap-1.5">
                  {(totalDeliveries > 0 ? Array.from({ length: totalDeliveries }) : Array.from({ length: 4 })).map((_, index) => {
                    const isDone = index < completedDeliveries;
                    return (
                      <span
                        key={`pack-progress-${index}`}
                        className={[
                          "h-2.5 flex-1 rounded-sm border transition-colors",
                          isDone ? "border-success bg-success" : "border-border bg-muted",
                        ].join(" ")}
                      />
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    if (!subscriptionState?.id) return;
                    void subscriptionStatusMutation.mutateAsync({
                      subscriptionId: subscriptionState.id,
                      status: "paused",
                    });
                  }}
                  disabled={subscriptionStatusMutation.isPending}
                >
                  <PauseCircle className="size-4" />
                  Pause Subscription
                </Button>
              </div>
            ) : subscriptionState?.status === "paused" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-muted p-4">
                  <p className="text-sm font-semibold text-foreground">Your subscription is paused.</p>
                </div>
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => {
                    if (!subscriptionState?.id) return;
                    void subscriptionStatusMutation.mutateAsync({
                      subscriptionId: subscriptionState.id,
                      status: "active",
                    });
                  }}
                  disabled={subscriptionStatusMutation.isPending}
                >
                  <PlayCircle className="size-4" />
                  Resume Subscription
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-success/30 bg-success/10 p-4">
                  <p className="text-sm font-semibold text-success">
                    This is a prepaid subscription. 0.00 MAD will be collected upon delivery.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pack-full-name">Full Name</Label>
                  <Input
                    id="pack-full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={t("customer.checkout.fullNamePlaceholder")}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="subscription-contact-phone">Phone</Label>
                    <Input
                      id="subscription-contact-phone"
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+212XXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subscription-pack-quantity">Quantity</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl px-3"
                        onClick={() => setPackQuantity((current) => Math.max(1, current - 1))}
                      >
                        -
                      </Button>
                      <Input
                        id="subscription-pack-quantity"
                        type="number"
                        min={1}
                        value={packQuantity}
                        onChange={(event) => setPackQuantity(Math.max(1, Number(event.target.value) || 1))}
                        className="text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl px-3"
                        onClick={() => setPackQuantity((current) => Math.min(99, current + 1))}
                      >
                        +
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Estimated contract value: {quantityEstimateMad.toFixed(2)} MAD</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subscription-delivery-address">Address</Label>
                  <Input
                    id="subscription-delivery-address"
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Delivery address"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="subscription-start-date">Start Date</Label>
                    <Input
                      id="subscription-start-date"
                      type="date"
                      value={subscriptionStartDate}
                      onChange={(event) => setSubscriptionStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subscription-delivery-time">Preferred Delivery Time</Label>
                    <Input
                      id="subscription-delivery-time"
                      placeholder="Morning / Afternoon"
                      value={subscriptionDeliveryTime}
                      onChange={(event) => setSubscriptionDeliveryTime(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subscription-notes">Notes (optional)</Label>
                  <Input
                    id="subscription-notes"
                    placeholder="Any preferred delivery instructions"
                    value={subscriptionNotes}
                    onChange={(event) => setSubscriptionNotes(event.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => {
                    void createSubscriptionMutation.mutateAsync();
                  }}
                  disabled={createSubscriptionMutation.isPending}
                >
                  {createSubscriptionMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Confirm Subscription
                    </>
                  )}
                </Button>
              </div>
            )}
          </section>
        </motion.div>
      )}
    </main>
  );
}