import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bike,
  Check,
  Search,
  Loader2,
  ShoppingCart,
  Heart,
  Package,
  Minus,
  UserCircle2,
  Plus,
  X,
  MapPin,
  HandCoins,
  CreditCard,
  CheckCircle2,
  House,
  Gift,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  ClipboardList,
  BookOpen,
  Share2,
  Flame,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import {
  getCustomerCatalogByNeighborhood,
  listActiveFlashDeals,
  listActivePlatformPacks,
  searchCustomerProducts,
} from "@/lib/catalog.functions";
import type { ProductCategory } from "@/lib/catalog.functions";
import { listActiveCategories } from "@/lib/categories.functions";
import {
  createOtpRequest,
  getCustomerProfileByPhone,
  upsertCustomerNeighborhood,
  verifyOtpCode,
} from "@/lib/customers.functions";
import { getCheckoutPaymentOptions, getCustomerCarnetOverview } from "@/lib/carnet.functions";
import { getGlobalSettings } from "@/lib/admin-dashboard.functions";
import { getActiveAdsAndAnnouncements } from "@/lib/ads-content.functions";
import {
  getLocationByNeighborhoodId,
  searchCommunes,
  searchNeighborhoodsByCommune,
  type CommuneSearchResult,
  type NeighborhoodSearchResult,
} from "@/lib/locations.functions";
import {
  createCustomerOrder,
  getCustomerSubscriptions,
  getCustomerOrders,
  upsertCustomerProfile,
} from "@/lib/orders.functions";
import { playSuccessSound } from "@/lib/sound-alerts";
import { CategoryIcon } from "@/lib/lucide-category-icons";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/morocco-cyclist-hero.jpg";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Progress } from "@/components/ui/progress";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/ProductCard";
import productDairyImage from "@/assets/product-dairy.jpg";
import productKhobzImage from "@/assets/product-khobz.jpg";
import productMintTeaImage from "@/assets/product-mint-tea.jpg";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import { type CustomerPanelView, useCustomerPanelStore } from "@/lib/customer-panel-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/customer/")({
  head: () => ({
    meta: [
      { title: "Bzaf Fresh — Grocery Delivery Morocco" },
      {
        name: "description",
        content:
          "Fast, eco-friendly daily grocery delivery across Morocco with bicycle couriers and fresh essentials in minutes.",
      },
      { property: "og:title", content: "Bzaf Fresh — Grocery Delivery Morocco" },
      {
        property: "og:description",
        content:
          "Order Moroccan essentials with zero-emission bicycle delivery, curated categories, and fresh products every day.",
      },
      { name: "twitter:title", content: "Bzaf Fresh — Grocery Delivery Morocco" },
      {
        name: "twitter:description",
        content: "Moroccan daily essentials delivered by bicycle with zero emissions.",
      },
    ],
    links: [{ rel: "canonical", href: "https://id-preview--d3fabfd6-6e10-4019-b625-dad909d25879.lovable.app/" }],
  }),
  component: Index,
});

type Product = {
  id: string;
  productVariants?: string[];
  name: string;
  nameFr?: string | null;
  nameAr?: string | null;
  brand?: string | null;
  brandNameEn?: string | null;
  brandNameFr?: string | null;
  brandNameAr?: string | null;
  category: ProductCategory;
  categoryId?: string | null;
  price: number;
  basePrice?: number;
  measurementValue?: number | null;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
  image: string;
  alt: string;
};

type SearchResultProduct = {
  id: string;
  name: string;
  nameFr?: string | null;
  nameAr?: string | null;
  category: ProductCategory;
  imageUrl: string | null;
  vendorPrice: number;
  finalVendorPrice?: number;
  brandNameEn?: string | null;
  brandNameFr?: string | null;
  brandNameAr?: string | null;
};

type PlatformPack = {
  id: string;
  name: string;
  nameFr?: string | null;
  nameAr?: string | null;
  description?: string | null;
  basePriceMad: number;
  billingCycle: "DAILY" | "WEEKLY" | "MONTHLY";
  pricePerUnit: number;
  unitType: string;
  deliveryWindow?: string | null;
  imageUrl?: string | null;
  packItems: Array<{
    name: string;
    imageUrl: string | null;
    quantity: number | null;
    unit: string | null;
  }>;
  packFeatures: string[];
};

const productFallbackImage = heroImage;

type AdSlide = {
  id: string;
  image: string;
  linkUrl: string | null;
  alt: string;
  headline: string;
  copy: string;
  tag: "Featured" | "AD";
};

type AnnouncementRow = {
  id: string;
  content: string;
  content_fr: string | null;
  content_ar: string | null;
  bg_color: string;
  text_color: string;
};

type SiteAdRow = {
  id: string;
  image_url: string;
  link_url: string | null;
  target_zone_ids?: string[] | null;
  campaign_type?: "AD" | "PROMO" | "NEWS";
  views_count?: number;
};

const adSlides: AdSlide[] = [
  {
    id: "hero",
    image: heroImage,
    linkUrl: null,
    alt: "Bicycle courier delivering groceries in Morocco",
    headline: "Daily groceries delivered in minutes",
    copy: "Fast local essentials with clean bicycle delivery across Morocco.",
    tag: "Featured",
  },
  {
    id: "mint-tea-ad",
    image: productMintTeaImage,
    linkUrl: null,
    alt: "Promotional poster for Moroccan mint tea offer",
    headline: "Mint Tea Week Offer",
    copy: "Buy 2 packs and get 15% off this week only.",
    tag: "AD",
  },
  {
    id: "bakery-ad",
    image: productKhobzImage,
    linkUrl: null,
    alt: "Promotional poster for fresh bakery essentials",
    headline: "Fresh Bakery Every Morning",
    copy: "Priority delivery slots for breakfast essentials.",
    tag: "AD",
  },
  {
    id: "dairy-ad",
    image: productDairyImage,
    linkUrl: null,
    alt: "Promotional poster for dairy bundle offer",
    headline: "Family Dairy Bundle",
    copy: "Save more on milk, yogurt, and cheese bundles.",
    tag: "AD",
  },
];

type CategoryChip = {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url: string | null;
  icon_name: string | null;
  accent_color: string;
  sort_order: number;
  product_count: number;
};

type CartItem = Product & {
  quantity: number;
};

type CheckoutStep = "details" | "success";
const LOCATION_STORAGE_KEY = "bzaf_fresh_location";
const CUSTOMER_SESSION_STORAGE_KEY = "bzaf.customerSession";
const CHECKOUT_PREFS_STORAGE_KEY = "bzaf.checkout_prefs";
const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";

type PersistedLocation = {
  communeId: string;
  neighborhoodId: string;
  locationLabel?: string;
};

type CustomerAuthStep = "phone" | "otp";

type CustomerSession = {
  phoneNumber: string;
};

type CheckoutPrefs = {
  phoneNumber: string;
  fullName: string;
  address: string;
  deliveryNotes: string;
  communeId: string;
  neighborhoodId: string;
  communeLabel: string | null;
  neighborhoodLabel: string | null;
};

type AppLanguage = "en" | "fr" | "ar";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

const normalizeSearchText = (value: string) => value.trim().toLocaleLowerCase();

function useCustomerCarnet(
  customerPhone: string | null,
  fetchCustomerCarnetOverview: (input: { data: { customerPhone: string } }) => Promise<any>,
) {
  return useQuery({
    queryKey: ["customer", "carnet", customerPhone],
    queryFn: () =>
      fetchCustomerCarnetOverview({
        data: {
          customerPhone: customerPhone!,
        },
      }),
    enabled: !!customerPhone,
    refetchInterval: customerPhone ? 8_000 : false,
  });
}

function Index() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate({ from: "/customer/" });
  const location = useLocation();
  const queryClient = useQueryClient();
  const cartItems = useCustomerCartStore((state) => state.items);
  const addCartItem = useCustomerCartStore((state) => state.addItem);
  const increaseItem = useCustomerCartStore((state) => state.increaseItem);
  const decreaseItem = useCustomerCartStore((state) => state.decreaseItem);
  const clearCart = useCustomerCartStore((state) => state.clearCart);
  const openCart = useCustomerCartStore((state) => state.openCart);
  const closeCart = useCustomerCartStore((state) => state.closeCart);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const isCustomerAuthModalOpen = useCustomerPanelStore((state) => state.isCustomerAuthModalOpen);
  const setIsCustomerAuthModalOpen = useCustomerPanelStore((state) => state.setIsCustomerAuthModalOpen);
  const customerPanelView = useCustomerPanelStore((state) => state.customerPanelView);
  const setCustomerPanelView = useCustomerPanelStore((state) => state.setCustomerPanelView);
  const openCustomerPanel = useCustomerPanelStore((state) => state.openCustomerPanel);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("details");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"COD" | "Carnet">("COD");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [authStep, setAuthStep] = useState<CustomerAuthStep>("phone");
  const [authPhoneInput, setAuthPhoneInput] = useState("");
  const [authPhoneForOtp, setAuthPhoneForOtp] = useState("");
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [isSendingAuthCode, setIsSendingAuthCode] = useState(false);
  const [isVerifyingAuthOtp, setIsVerifyingAuthOtp] = useState(false);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const locationSyncRef = useRef<string | null>(null);
  const checkoutPrefsHydrationRef = useRef<string | null>(null);
  const locationModalHydratedRef = useRef(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [selectedCommuneId, setSelectedCommuneId] = useState("");
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [selectedCommuneOption, setSelectedCommuneOption] = useState<CommuneSearchResult | null>(null);
  const [selectedNeighborhoodOption, setSelectedNeighborhoodOption] = useState<NeighborhoodSearchResult | null>(null);
  const [communeSearchInput, setCommuneSearchInput] = useState("");
  const [neighborhoodSearchInput, setNeighborhoodSearchInput] = useState("");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [flashNowMs, setFlashNowMs] = useState(0);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const isMobile = useIsMobile();
  const isArabic = language === "ar";
  const [isCategoryTickerPaused, setIsCategoryTickerPaused] = useState(false);
  const [isBottomPromoDismissed, setIsBottomPromoDismissed] = useState(false);
  const [desktopSearchInput, setDesktopSearchInput] = useState("");
  const [mobileSearchInput, setMobileSearchInput] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const activeSearchTerm = isMobile ? mobileSearchInput : desktopSearchInput;
  const debouncedSearchTerm = useDebouncedValue(activeSearchTerm, 300);
  const flashDealsAutoplayRef = useRef(
    Autoplay({ delay: 3200, stopOnMouseEnter: true, stopOnFocusIn: true, stopOnInteraction: false }),
  );
  const bottomPromoAutoplayRef = useRef(
    Autoplay({ delay: 4500, stopOnMouseEnter: true, stopOnFocusIn: true, stopOnInteraction: false }),
  );

  const getLocalizedText = ({
    en,
    fr,
    ar,
  }: {
    en: string;
    fr?: string | null;
    ar?: string | null;
  }) => {
    const normalizedEn = en?.trim() || "";
    const normalizedFr = fr?.trim() || "";
    const normalizedAr = ar?.trim() || "";

    if (language === "ar") return normalizedAr || normalizedFr || normalizedEn;
    if (language === "fr") return normalizedFr || normalizedEn || normalizedAr;
    return normalizedEn || normalizedFr || normalizedAr;
  };
  const getLocalizedNeighborhoodName = (zone: { nameEn: string; nameFr: string | null; nameAr: string | null; name: string }) =>
    getLocalizedText({ en: zone.nameEn || zone.name, fr: zone.nameFr, ar: zone.nameAr });
  const getLocalizedCommuneName = (zone: { nameEn?: string | null; nameFr?: string | null; nameAr?: string | null; name: string }) =>
    getLocalizedText({ en: zone.nameEn || zone.name, fr: zone.nameFr, ar: zone.nameAr });
  const getLocalizedDeliveryLabel = () => {
    if (language === "ar") return "ثمن التوصيل";
    if (language === "fr") return "Livraison";
    return "Delivery";
  };
  const getLocalizedDeliveryFeeToLocationLabel = () => {
    if (language === "ar") return "ثمن التوصيل إلى هذا الحي";
    if (language === "fr") return "Frais de livraison vers cette zone";
    return "Delivery fee to this location";
  };
  const submitOrder = useServerFn(createCustomerOrder);
  const fetchCustomerOrders = useServerFn(getCustomerOrders);
  const fetchCustomerSubscriptions = useServerFn(getCustomerSubscriptions);
  const saveCustomerProfile = useServerFn(upsertCustomerProfile);
  const fetchCommuneSearchResults = useServerFn(searchCommunes);
  const fetchNeighborhoodSearchResults = useServerFn(searchNeighborhoodsByCommune);
  const fetchLocationByNeighborhoodId = useServerFn(getLocationByNeighborhoodId);
  const fetchCatalogByNeighborhood = useServerFn(getCustomerCatalogByNeighborhood);
  const fetchCustomerProfileByPhone = useServerFn(getCustomerProfileByPhone);
  const syncCustomerNeighborhood = useServerFn(upsertCustomerNeighborhood);
  const createOtpRequestFn = useServerFn(createOtpRequest);
  const verifyOtpCodeFn = useServerFn(verifyOtpCode);
  const fetchCheckoutPaymentOptions = useServerFn(getCheckoutPaymentOptions);
  const fetchCustomerCarnetOverview = useServerFn(getCustomerCarnetOverview);
  const fetchGlobalSettings = useServerFn(getGlobalSettings);
  const fetchActiveAdsAndAnnouncements = useServerFn(getActiveAdsAndAnnouncements);
  const fetchActiveCategories = useServerFn(listActiveCategories);
  const fetchActivePlatformPacks = useServerFn(listActivePlatformPacks);
  const fetchActiveFlashDeals = useServerFn(listActiveFlashDeals);
  const searchProductsFn = useServerFn(searchCustomerProducts);
  const normalizedCommuneSearch = normalizeSearchText(communeSearchInput);
  const normalizedNeighborhoodSearch = normalizeSearchText(neighborhoodSearchInput);
  const hasEnoughCommuneChars = normalizedCommuneSearch.length >= 1;
  const hasEnoughNeighborhoodChars = normalizedNeighborhoodSearch.length >= 1;
  const communeSearchQuery = useQuery({
    queryKey: ["customer", "commune-search", normalizedCommuneSearch],
    queryFn: () => fetchCommuneSearchResults({ data: { query: normalizedCommuneSearch, limit: 20 } }),
    enabled: isLocationModalOpen && hasEnoughCommuneChars,
    staleTime: 15_000,
  });
  const neighborhoodSearchQuery = useQuery({
    queryKey: ["customer", "neighborhood-search", selectedCommuneId, normalizedNeighborhoodSearch],
    queryFn: () =>
      fetchNeighborhoodSearchResults({
        data: {
          communeId: selectedCommuneId,
          query: normalizedNeighborhoodSearch,
          limit: 30,
        },
      }),
    enabled: isLocationModalOpen && !!selectedCommuneId && hasEnoughNeighborhoodChars,
    staleTime: 15_000,
  });
  const globalSettingsQuery = useQuery({
    queryKey: ["customer", "global-settings"],
    queryFn: () => fetchGlobalSettings(),
    staleTime: 30_000,
  });
  const catalogQuery = useInfiniteQuery({
    queryKey: ["customer", "catalog", selectedNeighborhoodId],
    queryFn: ({ pageParam }) =>
      fetchCatalogByNeighborhood({
        data: {
          neighborhoodId: selectedNeighborhoodId,
          page: Number(pageParam),
          pageSize: 12,
        },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage?.hasMore ? allPages.length + 1 : undefined),
    enabled: !!selectedNeighborhoodId,
    refetchInterval: selectedNeighborhoodId ? 12_000 : false,
  });
  const customerProfileQuery = useQuery({
    queryKey: ["customer", "profile", customerSession?.phoneNumber ?? null],
    queryFn: () =>
      fetchCustomerProfileByPhone({
        data: { phoneNumber: customerSession!.phoneNumber },
      }),
    enabled: !!customerSession?.phoneNumber,
  });
  const customerOrdersQuery = useQuery({
    queryKey: ["customer", "orders", customerSession?.phoneNumber ?? null],
    queryFn: () => fetchCustomerOrders({ data: { phoneNumber: customerSession!.phoneNumber } }),
    enabled: !!customerSession?.phoneNumber,
    refetchInterval: customerSession?.phoneNumber ? 7_000 : false,
  });
  const customerSubscriptionsQuery = useQuery({
    queryKey: ["customer", "subscriptions", customerSession?.phoneNumber ?? null],
    queryFn: () => fetchCustomerSubscriptions({ data: { phoneNumber: customerSession!.phoneNumber } }),
    enabled: !!customerSession?.phoneNumber,
    placeholderData: (previousData) => previousData,
    refetchInterval: customerSession?.phoneNumber ? 7_000 : false,
  });
  const customerCarnetQuery = useCustomerCarnet(
    customerSession?.phoneNumber ?? null,
    fetchCustomerCarnetOverview,
  );
  const siteContentQuery = useQuery({
    queryKey: ["customer", "site-content", selectedNeighborhoodId ?? null],
    queryFn: () =>
      fetchActiveAdsAndAnnouncements({
        data: {
          zoneId: selectedNeighborhoodId ?? null,
          campaignType: null,
        },
      }),
    refetchInterval: 8_000,
  });
  const categoriesQuery = useQuery({
    queryKey: ["customer", "categories", selectedNeighborhoodId || null],
    queryFn: () => fetchActiveCategories({ data: { neighborhoodId: selectedNeighborhoodId || null } }),
    enabled: !!selectedNeighborhoodId,
    refetchInterval: selectedNeighborhoodId ? 8_000 : false,
  });
  const flashDealsQuery = useQuery({
    queryKey: ["customer", "flash-deals", selectedNeighborhoodId || null],
    queryFn: () => fetchActiveFlashDeals({ data: { neighborhoodId: selectedNeighborhoodId } }),
    enabled: !!selectedNeighborhoodId,
    refetchInterval: selectedNeighborhoodId ? 10_000 : false,
  });
  const platformPacksQuery = useQuery({
    queryKey: ["customer", "platform-packs", selectedNeighborhoodId || null],
    queryFn: () => fetchActivePlatformPacks({ data: { neighborhoodId: selectedNeighborhoodId } }),
    enabled: !!selectedNeighborhoodId,
    staleTime: 20_000,
    refetchInterval: selectedNeighborhoodId ? 20_000 : false,
  });
  const predictiveSearchQuery = useQuery({
    queryKey: ["customer", "predictive-search", selectedNeighborhoodId, debouncedSearchTerm],
    queryFn: () =>
      searchProductsFn({
        data: {
          neighborhoodId: selectedNeighborhoodId,
          query: debouncedSearchTerm.trim(),
          limit: 6,
        },
      }),
    enabled: !!selectedNeighborhoodId && debouncedSearchTerm.trim().length > 0,
    staleTime: 8_000,
  });
  const trackedOrderStatusRef = useRef<{ orderId: string; status: string } | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    setFlashNowMs(Date.now());
    const timer = window.setInterval(() => setFlashNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const adsChannel = supabase
      .channel("site-content-ads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_ads" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "site-content"] });
        },
      )
      .subscribe();

    const announcementsChannel = supabase
      .channel("site-content-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "site-content"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(adsChannel);
      void supabase.removeChannel(announcementsChannel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!customerSession?.phoneNumber) return;

    const ordersChannel = supabase
      .channel(`customer-orders-${customerSession.phoneNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `customer_phone=eq.${customerSession.phoneNumber}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "orders", customerSession.phoneNumber] });
          void queryClient.invalidateQueries({ queryKey: ["customer", "carnet", customerSession.phoneNumber] });
        },
      )
      .subscribe();

    const subscriptionsChannel = supabase
      .channel(`customer-subscriptions-${customerSession.phoneNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_subscriptions", filter: `customer_phone=eq.${customerSession.phoneNumber}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "subscriptions", customerSession.phoneNumber] });
        },
      )
      .subscribe();

    const carnetLedgerChannel = supabase
      .channel(`customer-carnet-ledger-${customerSession.phoneNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carnet_transactions", filter: `customer_phone=eq.${customerSession.phoneNumber}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "carnet", customerSession.phoneNumber] });
        },
      )
      .subscribe();

    const carnetBalanceChannel = supabase
      .channel(`customer-carnet-balance-${customerSession.phoneNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_carnet", filter: `customer_phone=eq.${customerSession.phoneNumber}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "carnet", customerSession.phoneNumber] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(subscriptionsChannel);
      void supabase.removeChannel(carnetLedgerChannel);
      void supabase.removeChannel(carnetBalanceChannel);
    };
  }, [customerSession?.phoneNumber, queryClient]);

  useEffect(() => {
    const orders = customerOrdersQuery.data ?? [];
    if (orders.length === 0) {
      trackedOrderStatusRef.current = null;
      return;
    }

    const activeOrder =
      orders.find(
        (order) =>
          !["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor", "completed"].includes(
            String(order.status ?? "").toLowerCase(),
          ),
      ) ?? orders[0];
    const previous = trackedOrderStatusRef.current;

    if (!previous || previous.orderId !== activeOrder.id) {
      trackedOrderStatusRef.current = { orderId: activeOrder.id, status: activeOrder.status };
      return;
    }

    if (previous.status !== activeOrder.status) {
      trackedOrderStatusRef.current = { orderId: activeOrder.id, status: activeOrder.status };

      if (
        ["delivering", "out_for_delivery", "picked_up", "on_the_way", "delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor", "completed"].includes(
          String(activeOrder.status ?? "").toLowerCase(),
        )
      ) {
        void playSuccessSound({ enabled: true });
      }
    }
  }, [customerOrdersQuery.data]);

  const selectedCommune = selectedCommuneOption;
  const selectedNeighborhood = selectedNeighborhoodOption;
  const filteredCommuneOptions = useMemo(() => {
    if (!hasEnoughCommuneChars) return [];

    const source = communeSearchQuery.data ?? [];
    const query = normalizedCommuneSearch;

    return source.filter((commune) => {
      const searchable = [
        commune.name,
        commune.nameEn,
        commune.nameFr,
        commune.nameAr,
        getLocalizedCommuneName(commune),
      ]
        .map((value) => normalizeSearchText(value ?? ""))
        .filter(Boolean);

      return searchable.some((value) => value.includes(query));
    });
  }, [communeSearchQuery.data, getLocalizedCommuneName, hasEnoughCommuneChars, normalizedCommuneSearch]);
  const filteredNeighborhoodOptions = useMemo(() => {
    if (!hasEnoughNeighborhoodChars) return [];

    const source = neighborhoodSearchQuery.data ?? [];
    const query = normalizedNeighborhoodSearch;

    return source.filter((neighborhood) => {
      const feeLabel = `${Number(neighborhood.deliveryFee ?? 0).toFixed(0)} mad`;
      const searchable = [
        neighborhood.name,
        neighborhood.nameEn,
        neighborhood.nameFr,
        neighborhood.nameAr,
        getLocalizedNeighborhoodName(neighborhood),
        feeLabel,
      ]
        .map((value) => normalizeSearchText(value ?? ""))
        .filter(Boolean);

      return searchable.some((value) => value.includes(query));
    });
  }, [getLocalizedNeighborhoodName, hasEnoughNeighborhoodChars, neighborhoodSearchQuery.data, normalizedNeighborhoodSearch]);

  useEffect(() => {
    if (!selectedNeighborhoodOption) return;
    if (selectedNeighborhoodOption.communeId !== selectedCommuneId) {
      setSelectedNeighborhoodId("");
      setSelectedNeighborhoodOption(null);
    }
  }, [selectedCommuneId, selectedNeighborhoodOption]);
  const globalDeliveryFeeMad = Number(globalSettingsQuery.data?.global_delivery_fee ?? 10);
  const minimumOrderMad = Number(globalSettingsQuery.data?.minimum_order_amount ?? 50);
  const freeDeliveryThresholdMad = Number(globalSettingsQuery.data?.free_delivery_threshold ?? 500);
  const dynamicSiteName =
    typeof globalSettingsQuery.data?.site_name === "string" && globalSettingsQuery.data.site_name.trim().length > 0
      ? globalSettingsQuery.data.site_name.trim()
      : t("brand.title");
  const dynamicSiteLogoUrl =
    typeof globalSettingsQuery.data?.site_logo_url === "string" && globalSettingsQuery.data.site_logo_url.trim().length > 0
      ? globalSettingsQuery.data.site_logo_url.trim()
      : null;

  const selectedLocationLabel = useMemo(() => {
    if (!selectedCommuneId || !selectedNeighborhoodId) {
      return t("header.locationFallback");
    }

    if (!selectedCommune || !selectedNeighborhood) {
      return t("header.locationFallback");
    }

    return `${getLocalizedCommuneName(selectedCommune)} / ${getLocalizedNeighborhoodName(selectedNeighborhood)}`;
  }, [selectedCommune, selectedNeighborhood, selectedCommuneId, selectedNeighborhoodId, t]);

  const persistLocation = (location: PersistedLocation) => {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  };

  const applyLocation = (location: Pick<PersistedLocation, "communeId" | "neighborhoodId">) => {
    setSelectedCommuneId(location.communeId);
    setSelectedNeighborhoodId(location.neighborhoodId);
  };

  const resolveLocationAndApply = async (neighborhoodId: string) => {
    const resolved = await fetchLocationByNeighborhoodId({ data: { neighborhoodId } });
    if (!resolved) {
      return null;
    }

    const location = {
      communeId: resolved.commune.id,
      neighborhoodId: resolved.neighborhood.id,
      locationLabel: `${getLocalizedCommuneName(resolved.commune)} / ${getLocalizedNeighborhoodName(resolved.neighborhood)}`,
    } satisfies PersistedLocation;

    setSelectedCommuneOption(resolved.commune);
    setSelectedNeighborhoodOption(resolved.neighborhood);
    applyLocation(location);
    persistLocation(location);
    return location;
  };

  const readPersistedLocation = () => {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as
        | PersistedLocation
        | {
            communeId?: string;
            neighborhoodId?: string;
          };

      if (!parsed.neighborhoodId) {
        return null;
      }

      return { neighborhoodId: parsed.neighborhoodId, communeId: parsed.communeId ?? "" };
    } catch {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      return null;
    }
  };

  const persistCheckoutPrefs = (prefs: CheckoutPrefs) => {
    localStorage.setItem(CHECKOUT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  };

  const readPersistedCheckoutPrefs = (phoneNumber: string) => {
    const raw = localStorage.getItem(CHECKOUT_PREFS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CheckoutPrefs>;
      if (parsed.phoneNumber !== phoneNumber) {
        return null;
      }

      return {
        phoneNumber,
        fullName: typeof parsed.fullName === "string" ? parsed.fullName : "",
        address: typeof parsed.address === "string" ? parsed.address : "",
        deliveryNotes: typeof parsed.deliveryNotes === "string" ? parsed.deliveryNotes : "",
        communeId: typeof parsed.communeId === "string" ? parsed.communeId : "",
        neighborhoodId: typeof parsed.neighborhoodId === "string" ? parsed.neighborhoodId : "",
        communeLabel: typeof parsed.communeLabel === "string" ? parsed.communeLabel : null,
        neighborhoodLabel: typeof parsed.neighborhoodLabel === "string" ? parsed.neighborhoodLabel : null,
      } satisfies CheckoutPrefs;
    } catch {
      localStorage.removeItem(CHECKOUT_PREFS_STORAGE_KEY);
      return null;
    }
  };

  useEffect(() => {
    if (!isLocationModalOpen) {
      locationModalHydratedRef.current = false;
      return;
    }

    if (locationModalHydratedRef.current) {
      return;
    }

    locationModalHydratedRef.current = true;

    const hydrateLocationDrawer = async () => {
      const persistedLocation = readPersistedLocation();
      const neighborhoodIdToHydrate = selectedNeighborhoodId || persistedLocation?.neighborhoodId || "";

      if (!neighborhoodIdToHydrate) {
        return;
      }

      const resolved = await fetchLocationByNeighborhoodId({ data: { neighborhoodId: neighborhoodIdToHydrate } });
      if (!resolved) {
        return;
      }

      setSelectedCommuneId(resolved.commune.id);
      setSelectedNeighborhoodId(resolved.neighborhood.id);
      setSelectedCommuneOption(resolved.commune);
      setSelectedNeighborhoodOption(resolved.neighborhood);
      setCommuneSearchInput(getLocalizedCommuneName(resolved.commune));
      setNeighborhoodSearchInput(getLocalizedNeighborhoodName(resolved.neighborhood));
    };

    void hydrateLocationDrawer();
  }, [
    fetchLocationByNeighborhoodId,
    getLocalizedCommuneName,
    getLocalizedNeighborhoodName,
    isLocationModalOpen,
    selectedNeighborhoodId,
  ]);

  const categories = ((categoriesQuery.data ?? []) as CategoryChip[]).filter((category) => category.product_count > 0);
  const shouldAnimateCategories = categories.length > 3;

  const localizedProducts = useMemo<Product[]>(() => {
    const rows = catalogQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [];
    return rows.map((item) => {
      const nameFr = "nameFr" in item ? item.nameFr : null;
      const nameAr = "nameAr" in item ? item.nameAr : null;
      const localizedName = getLocalizedText({ en: item.name, fr: nameFr, ar: nameAr });

      return {
        id: item.id,
        productVariants: Array.isArray((item as { productVariants?: string[] }).productVariants)
          ? ((item as { productVariants?: string[] }).productVariants ?? [])
          : [],
        name: localizedName,
        nameFr,
        nameAr,
        brand: (item as { brand?: string | null }).brand ?? null,
        brandNameEn: (item as { brandNameEn?: string | null }).brandNameEn ?? null,
        brandNameFr: (item as { brandNameFr?: string | null }).brandNameFr ?? null,
        brandNameAr: (item as { brandNameAr?: string | null }).brandNameAr ?? null,
        category: item.category,
        categoryId: (item as { categoryId?: string | null }).categoryId ?? null,
        price: Number((item as { finalVendorPrice?: number }).finalVendorPrice ?? item.vendorPrice),
        basePrice: Number(item.vendorPrice ?? 0),
        measurementValue: (item as { measurementValue?: number | null }).measurementValue ?? null,
        measurementUnit: item.measurementUnit,
        image: item.imageUrl || productFallbackImage,
        alt: `${localizedName} product image`,
      };
    });
  }, [catalogQuery.data, getLocalizedText]);

  const displayedProducts = localizedProducts;
  const teaserProducts = displayedProducts.slice(0, 4);
  const hasMoreProducts = !!catalogQuery.hasNextPage;

  const flashDeals = useMemo(() => {
    const rows = (flashDealsQuery.data ?? []) as Array<{
      id: string;
      name: string;
      nameFr?: string | null;
      nameAr?: string | null;
      measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
      imageUrl?: string | null;
      vendorPrice: number;
      finalVendorPrice?: number;
      flashSalePrice: number;
      finalFlashSalePrice?: number;
      flashSaleEndTime: string;
    }>;

    return rows.map((row) => {
      const localizedName = getLocalizedText({ en: row.name, fr: row.nameFr, ar: row.nameAr });
      const discountPercent =
        Number(row.vendorPrice) > 0
          ? Math.max(
              0,
              Math.round(
                ((Number(row.vendorPrice) - Number(row.flashSalePrice)) / Number(row.vendorPrice)) * 100,
              ),
            )
          : 0;

      return {
        id: row.id,
        name: localizedName,
        nameFr: row.nameFr,
        nameAr: row.nameAr,
        category: "Groceries" as ProductCategory,
        categoryId: null,
        price: Number(row.finalVendorPrice ?? row.vendorPrice),
        dealPrice: Number(row.finalFlashSalePrice ?? row.flashSalePrice),
        baseDealPrice: Number(row.flashSalePrice),
        measurementUnit: row.measurementUnit,
        image: row.imageUrl || productFallbackImage,
        alt: `${localizedName} product image`,
        flashSaleEndTime: row.flashSaleEndTime,
        discountPercent,
      };
    });
  }, [flashDealsQuery.data, getLocalizedText]);

  const platformPacks = useMemo(() => {
    const rows = (platformPacksQuery.data ?? []) as PlatformPack[];
    return rows.map((pack) => ({
      ...pack,
      name: getLocalizedText({ en: pack.name, fr: pack.nameFr, ar: pack.nameAr }),
      billingLabel:
        pack.billingCycle === "DAILY"
          ? language === "ar"
            ? "يومي"
            : language === "fr"
              ? "Quotidien"
              : "Daily"
          : pack.billingCycle === "WEEKLY"
            ? language === "ar"
              ? "أسبوعي"
              : language === "fr"
                ? "Hebdomadaire"
                : "Weekly"
            : language === "ar"
              ? "شهري"
              : language === "fr"
                ? "Mensuel"
                : "Monthly",
    }));
  }, [getLocalizedText, language, platformPacksQuery.data]);

  const openSubscriptionCheckout = (pack: PlatformPack) => {
    void navigate({ to: "/customer/platform-packs/$packId", params: { packId: pack.id } });
  };

  const countdownLabel = useMemo(() => {
    if (flashDeals.length === 0) {
      return "00:00:00";
    }

    const nearestEndMs = Math.min(...flashDeals.map((deal) => new Date(deal.flashSaleEndTime).getTime()));
    const total = Math.max(0, Math.floor((nearestEndMs - flashNowMs) / 1000));
    const hours = Math.floor(total / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((total % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(total % 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [flashDeals, flashNowMs]);

  useEffect(() => {
    const persistedCustomerSession = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
    if (!persistedCustomerSession) {
      return;
    }

    try {
      const parsed = JSON.parse(persistedCustomerSession) as CustomerSession;
      if (typeof parsed?.phoneNumber === "string" && /^\+212[0-9]{9}$/.test(parsed.phoneNumber)) {
        setCustomerSession({ phoneNumber: parsed.phoneNumber });
      }
    } catch {
      localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (isLocationModalOpen) {
      return;
    }

    if (selectedNeighborhoodId) {
      return;
    }

    const persistedLocation = readPersistedLocation();
    if (!persistedLocation?.neighborhoodId) {
      if (!customerSession?.phoneNumber) {
        setIsLocationModalOpen(true);
      }
      return;
    }

    void resolveLocationAndApply(persistedLocation.neighborhoodId).then((resolved) => {
      if (!resolved && !customerSession?.phoneNumber) {
        setIsLocationModalOpen(true);
      }
    });
  }, [customerSession?.phoneNumber, isLocationModalOpen, selectedNeighborhoodId]);

  useEffect(() => {
    if (customerSession?.phoneNumber) {
      setPhoneNumber(customerSession.phoneNumber);
    } else {
      setPhoneNumber("");
    }
  }, [customerSession]);

  useEffect(() => {
    if (!customerSession?.phoneNumber) {
      return;
    }

    const localPrefs = readPersistedCheckoutPrefs(customerSession.phoneNumber);
    if (!localPrefs) {
      return;
    }

    setFullName(localPrefs.fullName || "");
    setAddress(localPrefs.address || "");
    setDeliveryNotes(localPrefs.deliveryNotes || "");

    if (!selectedNeighborhoodId && localPrefs.neighborhoodId) {
      void resolveLocationAndApply(localPrefs.neighborhoodId);
    }
  }, [customerSession?.phoneNumber]);

  useEffect(() => {
    const profile = customerProfileQuery.data;
    if (!customerSession?.phoneNumber) {
      checkoutPrefsHydrationRef.current = null;
      return;
    }

    if (customerProfileQuery.isLoading) {
      return;
    }

    if (checkoutPrefsHydrationRef.current === customerSession.phoneNumber) {
      return;
    }

    const localPrefs = readPersistedCheckoutPrefs(customerSession.phoneNumber);
    const profileFullName = typeof profile?.fullName === "string" ? profile.fullName : "";
    const profileAddress = typeof profile?.address === "string" ? profile.address : "";
    const profileInstructions = typeof profile?.savedInstructions === "string" ? profile.savedInstructions : "";

    setFullName(profileFullName || localPrefs?.fullName || "");
    setAddress(profileAddress || localPrefs?.address || "");
    setDeliveryNotes(profileInstructions || localPrefs?.deliveryNotes || "");

    const persistedLocation = readPersistedLocation();
    if (persistedLocation?.neighborhoodId) {
      void resolveLocationAndApply(persistedLocation.neighborhoodId);
      checkoutPrefsHydrationRef.current = customerSession.phoneNumber;

      if (
        customerSession?.phoneNumber &&
        locationSyncRef.current !== `${customerSession.phoneNumber}:${persistedLocation.neighborhoodId}` &&
        profile?.neighborhoodId !== persistedLocation.neighborhoodId
      ) {
        locationSyncRef.current = `${customerSession.phoneNumber}:${persistedLocation.neighborhoodId}`;
        void syncCustomerNeighborhood({
          data: {
            phoneNumber: customerSession.phoneNumber,
            neighborhoodId: persistedLocation.neighborhoodId,
          },
        }).catch((error) => {
          console.error("Failed to sync customer neighborhood:", error);
          locationSyncRef.current = null;
        });
      }

      return;
    }

    const fallbackNeighborhoodId = profile?.neighborhoodId ?? localPrefs?.neighborhoodId ?? "";
    if (fallbackNeighborhoodId) {
      void resolveLocationAndApply(fallbackNeighborhoodId);
      checkoutPrefsHydrationRef.current = customerSession.phoneNumber;
      return;
    }

    checkoutPrefsHydrationRef.current = customerSession.phoneNumber;
    setIsLocationModalOpen(true);
  }, [
    customerProfileQuery.data,
    customerProfileQuery.isLoading,
    customerSession?.phoneNumber,
    syncCustomerNeighborhood,
  ]);

  const normalizedAuthPhone = useMemo(
    () => normalizeMoroccoPhoneInput(authPhoneInput),
    [authPhoneInput],
  );
  const isAuthPhoneValid = isValidMoroccoPhone(normalizedAuthPhone);

  const sendCustomerOtp = async () => {
    if (!isAuthPhoneValid) {
      toast.error("Please enter a valid Moroccan phone number.");
      return;
    }

    setIsSendingAuthCode(true);
    try {
      const fullPhoneNumber = formatMoroccoPhoneForPayload(normalizedAuthPhone);
      const otpPayload = await createOtpRequestFn({
        data: { phoneNumber: fullPhoneNumber },
      });

      setAuthPhoneForOtp(fullPhoneNumber);
      toast.success("Code sent on WhatsApp.");
      setAuthStep("otp");

      fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: otpPayload.phoneNumber,
          otpCode: otpPayload.otpCode,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Webhook request failed with status ${response.status}`);
        }
      }).catch((error) => {
        console.error("OTP webhook trigger failed:", error);
        toast.error("Code generated, but WhatsApp delivery is delayed. Please retry in a moment.");
      });
    } catch {
      toast.error("Unable to send code right now. Please try again.");
    } finally {
      setIsSendingAuthCode(false);
    }
  };

  const verifyCustomerOtpAndLogin = async () => {
    if (authOtpCode.length !== 4) {
      toast.error("Please enter the 4-digit code.");
      return;
    }

    setIsVerifyingAuthOtp(true);
    try {
      const phoneNumberToVerify = authPhoneForOtp || formatMoroccoPhoneForPayload(normalizedAuthPhone);
      const verification = await verifyOtpCodeFn({
        data: {
          phoneNumber: phoneNumberToVerify,
          otpCode: authOtpCode,
        },
      });

      if (!verification.verified) {
        toast.error("Wrong Code");
        return;
      }

      const session = {
        phoneNumber: phoneNumberToVerify,
      } satisfies CustomerSession;

      setCustomerSession(session);
      localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(session));
      setIsCustomerAuthModalOpen(false);
      setAuthStep("phone");
      setAuthPhoneForOtp("");
      setAuthOtpCode("");
      toast.success("Logged in successfully.");
    } catch {
      toast.error("Unable to verify code right now. Please try again.");
    } finally {
      setIsVerifyingAuthOtp(false);
    }
  };

  const logoutCustomer = () => {
    localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    setCustomerSession(null);
    setAuthStep("phone");
    setAuthPhoneForOtp("");
    setAuthOtpCode("");
    setAuthPhoneInput("");
    setIsCustomerAuthModalOpen(false);
    toast.success("Logged out.");
  };

  const statusSteps: Array<{ label: string; statuses: string[] }> = [
    { label: "Order Placed", statuses: ["pending", "new"] },
    { label: "Preparing", statuses: ["preparing", "accepted", "processing"] },
    { label: "Out for Delivery", statuses: ["out_for_delivery", "picked_up", "on_the_way", "delivering"] },
    {
      label: "Delivered",
      statuses: ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor", "completed"],
    },
  ];

  const deliveredStatuses = new Set(statusSteps[3].statuses);

  const getOrderStepIndex = (status: string) => {
    const normalizedStatus = String(status ?? "").toLowerCase();
    const index = statusSteps.findIndex((step) => step.statuses.includes(normalizedStatus));
    return index < 0 ? 0 : index;
  };

  const isDeliveredOrderStatus = (status: string) => deliveredStatuses.has(String(status ?? "").toLowerCase());
  const isCarnetUnpaidOrder = (paymentMethod: string | null | undefined) => {
    const normalized = String(paymentMethod ?? "").trim().toLowerCase();
    return normalized === "carnet" || normalized === "credit";
  };

  const allCustomerOrders = customerOrdersQuery.data ?? [];
  const activeCustomerOrders = allCustomerOrders.filter((order) => !isDeliveredOrderStatus(order.status));
  const deliveredCustomerOrders = allCustomerOrders.filter((order) => isDeliveredOrderStatus(order.status));
  const customerSubscriptions =
    (customerSubscriptionsQuery.data ?? []) as Array<{
      id: string;
      packName: string;
      packId: string;
      status: "pending" | "active" | "paused" | "expired" | "cancelled" | "completed";
      completionPercent: number;
      completedDeliveries: number;
      totalDeliveries: number;
      agreedPriceMad: number;
      createdAt: string;
    }>;
  const activeOrPendingSubscriptionByPackId = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        status: "pending" | "active" | "paused";
        completedDeliveries: number;
        totalDeliveries: number;
      }
    >();

    for (const subscription of customerSubscriptions) {
      if (subscription.status !== "pending" && subscription.status !== "active" && subscription.status !== "paused") {
        continue;
      }

      const existing = map.get(subscription.packId);
      const shouldReplace =
        !existing ||
        (existing.status === "pending" && (subscription.status === "active" || subscription.status === "paused")) ||
        (existing.status === "paused" && subscription.status === "active");

      if (shouldReplace) {
        map.set(subscription.packId, {
          id: subscription.id,
          status: subscription.status,
          completedDeliveries: Math.max(0, Number(subscription.completedDeliveries ?? 0)),
          totalDeliveries: Math.max(0, Number(subscription.totalDeliveries ?? 0)),
        });
      }
    }

    return map;
  }, [customerSubscriptions]);
  const hasCustomerSubscriptions = customerSubscriptions.length > 0;
  const getSubscriptionStatusLabel = (status: "pending" | "active" | "paused" | "expired" | "cancelled" | "completed") => {
    if (status === "pending") return "Pending Admin Review / قيد المراجعة";
    if (status === "active") return "Active";
    if (status === "completed") return "Subscription finished";
    if (status === "paused") return "Paused";
    if (status === "expired") return "Expired";
    return "Cancelled";
  };

  const addToCart = (product: Product, selectedVariant?: string | null) => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    const normalizedVariant = selectedVariant?.trim() || null;
    const cartItemId = normalizedVariant ? `${product.id}::${normalizedVariant}` : product.id;

    addCartItem({
      id: product.id,
      cartItemId,
      productId: product.id,
      name: product.name,
      selectedVariant: normalizedVariant,
      brandName: product.brandNameEn || product.brand || null,
      measurementValue: product.measurementValue ?? null,
      price: product.price,
      basePrice: Number(product.basePrice ?? product.price ?? 0),
      measurementUnit: product.measurementUnit,
      image: product.image,
      alt: product.alt,
    });

    toast.success("Added to cart", {
      description: product.name,
      duration: 1400,
    });
  };

  const getCartQuantity = (productId: string, selectedVariant?: string | null) => {
    const normalizedVariant = selectedVariant?.trim() || null;
    const cartItemId = normalizedVariant ? `${productId}::${normalizedVariant}` : productId;
    return cartItems.find((item) => (item.cartItemId || item.id) === cartItemId)?.quantity ?? 0;
  };

  const addFlashDealToCart = (deal: {
    id: string;
    name: string;
    measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
    image: string;
    alt: string;
    dealPrice: number;
    baseDealPrice?: number;
  }) => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    addCartItem({
      id: deal.id,
      name: deal.name,
      price: deal.dealPrice,
      basePrice: Number(deal.baseDealPrice ?? deal.dealPrice ?? 0),
      measurementUnit: deal.measurementUnit,
      image: deal.image,
      alt: deal.alt,
    });

    toast.success("Added to cart", {
      description: deal.name,
      duration: 1400,
    });
  };

  const openCheckout = () => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    if (!customerSession?.phoneNumber) {
      closeCart();
      setIsCustomerAuthModalOpen(true);
      toast.error("Login is required before checkout.");
      return;
    }

    if (!isMinimumOrderMet) {
      closeCart();
      toast.error(
        isArabic
          ? `الحد الأدنى للطلب هو ${minimumOrderMad.toFixed(2)} درهم.`
          : `Minimum order amount is ${minimumOrderMad.toFixed(2)} MAD.`,
      );
      return;
    }

    closeCart();
    setCheckoutStep("details");
    setSelectedPaymentMethod("COD");
    void customerProfileQuery.refetch();
    setIsCheckoutOpen(true);
  };

  const confirmOrder = async () => {
    if (!customerSession?.phoneNumber) {
      setIsCustomerAuthModalOpen(true);
      toast.error("Please login first.");
      return;
    }

    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    if (!isMinimumOrderMet) {
      toast.error(
        isArabic
          ? `الحد الأدنى للطلب هو ${minimumOrderMad.toFixed(2)} درهم.`
          : `Minimum order amount is ${minimumOrderMad.toFixed(2)} MAD.`,
      );
      return;
    }

    try {
      setIsSubmittingOrder(true);

      try {
        await saveCustomerProfile({
          data: {
            phoneNumber: customerSession.phoneNumber,
            fullName: fullName.trim(),
            address: address.trim(),
            savedInstructions: deliveryNotes.trim(),
            neighborhoodId: selectedNeighborhoodId || null,
          },
        });
      } catch (profileSaveError) {
        console.error("Failed to persist profile before order placement:", profileSaveError);
      }

      await submitOrder({
        data: {
          customerName: fullName.trim(),
          customerPhone: customerSession.phoneNumber,
          neighborhoodId: selectedNeighborhoodId,
          deliveryNotes: deliveryNotes.trim(),
          paymentMethod: selectedPaymentMethod,
          deliveryFee: calculatedDeliveryFeeMad,
          totalPrice: finalTotalMad,
          itemCount: cartCount,
          items: cartItems.map((item) => ({
            productId: item.productId || item.id,
            name: item.name,
            selectedVariant: item.selectedVariant ?? null,
            brandName: item.brandName ?? null,
            measurementValue: item.measurementValue ?? null,
            measurementUnit: item.measurementUnit ?? null,
            quantity: item.quantity,
            unitPriceMad: item.price,
            basePriceMad: Number(item.basePrice ?? item.price ?? 0),
          })),
        },
      });

      persistCheckoutPrefs({
        phoneNumber: customerSession.phoneNumber,
        fullName: fullName.trim(),
        address: address.trim(),
        deliveryNotes: deliveryNotes.trim(),
        communeId: selectedCommuneId,
        neighborhoodId: selectedNeighborhoodId,
        communeLabel: selectedCommuneOption ? getLocalizedCommuneName(selectedCommuneOption) : null,
        neighborhoodLabel: selectedNeighborhoodOption ? getLocalizedNeighborhoodName(selectedNeighborhoodOption) : null,
      });

      setCheckoutStep("success");
      clearCart();
      toast.success("Order confirmed successfully.");
    } catch (error) {
      console.error("Failed to confirm order:", error);
      toast.error("Failed to confirm order. Please try again.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const returnToHome = () => {
    setIsCheckoutOpen(false);
    setCheckoutStep("details");
  };

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );
  const calculatedDeliveryFeeMad = useMemo(() => {
    if (cartTotal >= freeDeliveryThresholdMad) {
      return 0;
    }

    if (selectedNeighborhood) {
      return Number(selectedNeighborhood.deliveryFee ?? 0);
    }

    return globalDeliveryFeeMad;
  }, [cartTotal, freeDeliveryThresholdMad, selectedNeighborhood, globalDeliveryFeeMad]);
  const amountToFreeDeliveryMad = useMemo(
    () => Math.max(freeDeliveryThresholdMad - cartTotal, 0),
    [freeDeliveryThresholdMad, cartTotal],
  );
  const isMinimumOrderMet = cartTotal >= minimumOrderMad;
  const finalTotalMad = useMemo(() => cartTotal + calculatedDeliveryFeeMad, [cartTotal, calculatedDeliveryFeeMad]);

  const cartLabel = useMemo(() => `${cartCount} item${cartCount === 1 ? "" : "s"}`, [cartCount]);

  const paymentOptionsQuery = useQuery({
    queryKey: [
      "customer",
      "checkout-payment-options",
      customerSession?.phoneNumber ?? null,
      selectedNeighborhoodId,
      Number(finalTotalMad.toFixed(2)),
    ],
    queryFn: () =>
      fetchCheckoutPaymentOptions({
        data: {
          customerPhone: customerSession!.phoneNumber,
          neighborhoodId: selectedNeighborhoodId,
          cartTotal: finalTotalMad,
        },
      }),
    enabled: isCheckoutOpen && !!customerSession?.phoneNumber && !!selectedNeighborhoodId && finalTotalMad > 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!paymentOptionsQuery.data?.canUseCarnet && selectedPaymentMethod === "Carnet") {
      setSelectedPaymentMethod("COD");
    }
  }, [paymentOptionsQuery.data?.canUseCarnet, selectedPaymentMethod]);

  useEffect(() => {
    if (location.hash !== "checkout") {
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Your cart is empty.");
      void navigate({ to: "/customer", replace: true });
      return;
    }

    openCheckout();
    void navigate({ to: "/customer", replace: true });
  }, [cartItems.length, location.hash, navigate, openCheckout]);

  useEffect(() => {
    if (location.hash !== "auth") {
      return;
    }

    setIsCustomerAuthModalOpen(true);
    void navigate({ to: "/customer", replace: true });
  }, [location.hash, navigate, setIsCustomerAuthModalOpen]);

  const isCheckoutProfileHydrating = !!customerSession?.phoneNumber && customerProfileQuery.isLoading;

  const canConfirmOrder =
    !isSubmittingOrder &&
    !isCheckoutProfileHydrating &&
    cartItems.length > 0 &&
    fullName.trim().length > 0 &&
    address.trim().length > 0 &&
    isMinimumOrderMet &&
    !!customerSession?.phoneNumber &&
    !!selectedNeighborhoodId &&
    (selectedPaymentMethod === "COD" || paymentOptionsQuery.data?.canUseCarnet === true);

  const customerCarnet = customerCarnetQuery.data?.carnet ?? null;
  const hasVipCarnet = !!customerCarnet;
  const carnetCurrentDebt = Number(customerCarnet?.currentDebt ?? 0);
  const carnetMaxLimit = Number(customerCarnet?.maxLimit ?? 0);
  const carnetUsagePercent = carnetMaxLimit > 0 ? Math.min((carnetCurrentDebt / carnetMaxLimit) * 100, 100) : 0;
  const carnetUtilizationLabel =
    language === "ar"
      ? "استهلاك الدين"
      : language === "fr"
        ? "Utilisation de la dette"
        : "Debt Utilization";
  const carnetDebtRatioLabel =
    language === "ar"
      ? `المُستَهلَك: ${carnetCurrentDebt.toFixed(2)} درهم / السقف: ${carnetMaxLimit.toFixed(2)} درهم`
      : language === "fr"
        ? `Utilisé: ${carnetCurrentDebt.toFixed(2)} / Limite: ${carnetMaxLimit.toFixed(2)} MAD`
        : `Used: ${carnetCurrentDebt.toFixed(2)} / Limit: ${carnetMaxLimit.toFixed(2)} MAD`;
  const carnetUsagePercentLabel =
    language === "ar"
      ? `${carnetUtilizationLabel} ${carnetUsagePercent.toFixed(0)}%`
      : language === "fr"
        ? `${carnetUtilizationLabel} ${carnetUsagePercent.toFixed(0)}%`
        : `${carnetUtilizationLabel} ${carnetUsagePercent.toFixed(0)}%`;
  const carnetProgressIndicatorClassName =
    carnetUsagePercent < 50 ? "bg-success" : carnetUsagePercent <= 80 ? "bg-accent" : "bg-destructive";
  const activeAnnouncements = (siteContentQuery.data?.announcements ?? []) as AnnouncementRow[];
  const tickerText =
    activeAnnouncements.length > 0
      ? activeAnnouncements
          .map((item: AnnouncementRow) =>
            getLocalizedText({ en: item.content, fr: item.content_fr, ar: item.content_ar }),
          )
          .join("   •   ")
      : t("ticker.default");
  const tickerBgColor = activeAnnouncements[0]?.bg_color ?? "#deff9a";
  const tickerTextColor = activeAnnouncements[0]?.text_color ?? "#000000";
  const dynamicAdSlides =
    ((siteContentQuery.data?.ads ?? []) as SiteAdRow[]).map((ad: SiteAdRow) => ({
      id: ad.id,
      image: ad.image_url,
      linkUrl: ad.link_url,
      alt: "Promotional ad banner",
      headline: "Special Offer",
      copy: ad.link_url ? "Tap to discover this promotion" : "Featured promotion",
      tag: ad.campaign_type === "NEWS" ? "Featured" : "AD",
    })) || [];
  const displayAdSlides = dynamicAdSlides.length > 0 ? dynamicAdSlides : adSlides;

  const saveLocationSelection = async () => {
    if (!selectedCommuneId || !selectedNeighborhoodId) {
      toast.error("Please select both commune and neighborhood.");
      return;
    }

    let commune = selectedCommuneOption;
    let neighborhood = selectedNeighborhoodOption;

    if (!commune || !neighborhood || neighborhood.id !== selectedNeighborhoodId || commune.id !== selectedCommuneId) {
      const resolved = await fetchLocationByNeighborhoodId({ data: { neighborhoodId: selectedNeighborhoodId } });
      if (resolved) {
        commune = resolved.commune;
        neighborhood = resolved.neighborhood;
        setSelectedCommuneOption(resolved.commune);
        setSelectedNeighborhoodOption(resolved.neighborhood);
      }
    }

    if (!commune || !neighborhood) {
      toast.error("Invalid location selection. Please try again.");
      return;
    }

    const location = {
      communeId: commune.id,
      neighborhoodId: neighborhood.id,
      locationLabel: `${getLocalizedCommuneName(commune)} / ${getLocalizedNeighborhoodName(neighborhood)}`,
    } satisfies PersistedLocation;

    persistLocation(location);

    if (customerSession?.phoneNumber) {
      try {
        locationSyncRef.current = `${customerSession.phoneNumber}:${location.neighborhoodId}`;
        await syncCustomerNeighborhood({
          data: {
            phoneNumber: customerSession.phoneNumber,
            neighborhoodId: location.neighborhoodId,
          },
        });
      } catch (error) {
        console.error("Failed to sync customer neighborhood:", error);
        locationSyncRef.current = null;
        toast.error("Location saved locally, but cloud sync failed. Please retry.");
      }
    }

    setIsLocationModalOpen(false);
    toast.success("Delivery location saved.");
  };

  const closeLocationModal = () => {
    setIsLocationModalOpen(false);
    setCommuneSearchInput("");
    setNeighborhoodSearchInput("");
  };

  const predictiveSearchResults = useMemo(() => {
    const rows = (predictiveSearchQuery.data ?? []) as SearchResultProduct[];
    return rows.map((row) => ({
      ...row,
      localizedName: getLocalizedText({ en: row.name, fr: row.nameFr, ar: row.nameAr }),
      localizedBrand: getLocalizedText({
        en: row.brandNameEn || "",
        fr: row.brandNameFr || row.brandNameEn || "",
        ar: row.brandNameAr || row.brandNameEn || "",
      }),
    }));
  }, [getLocalizedText, predictiveSearchQuery.data]);

  const hasSearchTerm = debouncedSearchTerm.trim().length > 0;

  const highlightSearchMatch = (text: string, query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return text;

    const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "ig");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      part.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase() ? <strong key={`${part}-${index}`}>{part}</strong> : part,
    );
  };

  const handleSearchResultClick = (productId: string) => {
    setDesktopSearchInput("");
    setMobileSearchInput("");
    setIsSearchOpen(false);
    void navigate({ to: "/customer/product/$id", params: { id: productId } });
  };

  return (
    <>
      <main className="app-shell min-h-screen bg-muted/20 pb-24 text-foreground md:pb-0">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm md:z-50 md:border-border/70 md:glass-panel">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
            <a href="#" className="inline-flex items-center gap-2">
              {dynamicSiteLogoUrl ? (
                <img
                  src={dynamicSiteLogoUrl}
                  alt={dynamicSiteName}
                  className="h-8 w-auto max-w-28 object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Bike className="size-5" />
                </span>
              )}
              <span className="text-base font-semibold tracking-tight text-gradient-brand">{dynamicSiteName}</span>
            </a>

            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="ml-1 hidden items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted sm:inline-flex"
            >
              <MapPin className="size-3.5 text-primary" />
              {selectedLocationLabel}
            </button>

            <div ref={searchContainerRef} className="relative ml-auto hidden min-w-0 max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              {predictiveSearchQuery.isFetching && hasSearchTerm ? (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
              <input
                aria-label="Search products"
                value={desktopSearchInput}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(event) => {
                  setDesktopSearchInput(event.target.value);
                  setIsSearchOpen(true);
                }}
                placeholder={t("header.searchPlaceholder", { defaultValue: "Search essentials" })}
                className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-10 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />

              <AnimatePresence>
                {isSearchOpen && hasSearchTerm ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="no-scrollbar absolute left-0 right-0 top-12 z-[100] max-h-[350px] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                  >
                    {predictiveSearchResults.length > 0 ? (
                      predictiveSearchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSearchResultClick(item.id)}
                          className="mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted"
                        >
                          <img
                            src={item.imageUrl || productFallbackImage}
                            alt={item.localizedName}
                            className="h-11 w-11 rounded-lg border border-border object-cover"
                            loading="lazy"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 block text-sm font-semibold text-foreground">
                              {highlightSearchMatch(item.localizedName, debouncedSearchTerm)}
                            </span>
                            <span className="line-clamp-1 block text-xs text-muted-foreground">{item.localizedBrand || item.category}</span>
                          </span>
                          <span className="shrink-0 text-sm font-bold text-emerald-600">
                            {Number(item.finalVendorPrice ?? item.vendorPrice ?? 0)} MAD
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">No products found</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <button
              aria-label={t("header.userProfile")}
              onClick={() => {
                openCustomerPanel("account");
              }}
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted md:inline-flex"
            >
              <UserCircle2 className="size-5" />
            </button>

            {customerSession ? (
              <button
                aria-label={t("header.myOrders")}
                onClick={() => {
                  openCustomerPanel("orders");
                }}
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted md:inline-flex"
              >
                <ClipboardList className="size-5" />
              </button>
            ) : null}

            <button
              aria-label={cartLabel}
              onClick={openCart}
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted md:inline-flex"
            >
              <ShoppingCart className="size-5" />
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
                {cartCount}
              </span>
            </button>
          </div>
          <div className="mx-auto w-full max-w-6xl px-4 pb-3 sm:hidden">
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="mb-2 inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
            >
              <MapPin className="size-3.5 text-primary" />
              {selectedLocationLabel}
            </button>
            <div ref={searchContainerRef} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              {predictiveSearchQuery.isFetching && hasSearchTerm ? (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
              <input
                ref={mobileSearchInputRef}
                aria-label="Search products"
                value={mobileSearchInput}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(event) => {
                  setMobileSearchInput(event.target.value);
                  setIsSearchOpen(true);
                }}
                placeholder={t("header.searchPlaceholder", { defaultValue: "Search essentials" })}
                className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-10 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />

              <AnimatePresence>
                {isSearchOpen && hasSearchTerm ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="no-scrollbar absolute left-0 right-0 top-12 z-[100] max-h-[350px] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                  >
                    {predictiveSearchResults.length > 0 ? (
                      predictiveSearchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSearchResultClick(item.id)}
                          className="mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted"
                        >
                          <img
                            src={item.imageUrl || productFallbackImage}
                            alt={item.localizedName}
                            className="h-11 w-11 rounded-lg border border-border object-cover"
                            loading="lazy"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 block text-sm font-semibold text-foreground">
                              {highlightSearchMatch(item.localizedName, debouncedSearchTerm)}
                            </span>
                            <span className="line-clamp-1 block text-xs text-muted-foreground">{item.localizedBrand || item.category}</span>
                          </span>
                          <span className="shrink-0 text-sm font-bold text-emerald-600">
                            {Number(item.finalVendorPrice ?? item.vendorPrice ?? 0)} MAD
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">No products found</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <section
          className="overflow-hidden border-b border-border/70 py-2"
          style={{ backgroundColor: tickerBgColor, color: tickerTextColor }}
          aria-label="Global announcement ticker"
        >
          <div className={`marquee-track whitespace-nowrap text-sm font-medium ${isArabic ? "marquee-track-rtl" : ""}`}>
            <span className="mx-6">{tickerText}</span>
            <span className="mx-6" aria-hidden="true">
              {tickerText}
            </span>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pt-4 sm:px-6 md:grid-cols-2 md:gap-8 md:pt-10">
          <div className="animate-fade-in hidden flex-col justify-center gap-4 md:flex">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Bicycle delivery across Morocco
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Daily groceries delivered in minutes, cleanly and reliably.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Fresh essentials from bakery to vegetables, delivered by local bicycle couriers for a
              faster and zero-emission Moroccan city experience.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Button variant="hero" size="xl" className="rounded-2xl">
                Start shopping
              </Button>
              <span className="text-sm font-medium text-muted-foreground">Avg. delivery: 18 min</span>
            </div>
          </div>

          <div className="signature-tilt animate-enter h-[28vh] min-h-[170px] max-h-[30vh] overflow-hidden rounded-2xl border border-border/70 bg-card md:h-[410px] md:max-h-none">
            <Carousel opts={{ loop: true }} className="h-full">
              <CarouselContent className="h-full">
                {displayAdSlides.map((slide) => (
                  <CarouselItem key={slide.id} className="h-full pl-0">
                    <article className="relative h-full w-full overflow-hidden">
                      <img
                        src={slide.image}
                        alt={slide.alt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        width={1920}
                        height={1080}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/35 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-3 text-background md:p-5">
                        <span className="mb-2 inline-flex rounded-md border border-background/60 bg-foreground/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                          {slide.tag}
                        </span>
                        <p className="text-sm font-semibold leading-tight md:text-lg">{slide.headline}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-background/90 md:text-sm">{slide.copy}</p>
                      </div>
                      {slide.linkUrl ? (
                        <a
                          href={slide.linkUrl}
                          className="absolute inset-0"
                          aria-label="Open promotional offer"
                        />
                      ) : null}
                    </article>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </section>

        <section className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6 md:mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight font-serif">
              {t("categories.title", { defaultValue: "Quick categories" })}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("categories.subtitleDefault", { defaultValue: "Essentials first" })}
              </span>
              <Link to="/customer/categories" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {t("categories.viewAll", { defaultValue: "View All" })}
              </Link>
            </div>
          </div>
          <div
            className="category-scroll overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onMouseEnter={() => setIsCategoryTickerPaused(true)}
            onMouseLeave={() => setIsCategoryTickerPaused(false)}
            onTouchStart={() => setIsCategoryTickerPaused(true)}
            onTouchEnd={() => setIsCategoryTickerPaused(false)}
          >
            {categories.length === 0 ? (
              <AppEmptyState
                title={t("categories.noCategories", { defaultValue: "No categories available in your area yet." })}
                subtitle="We’re preparing your neighborhood catalog."
                className="w-full"
              />
            ) : (
              <div
                className={shouldAnimateCategories ? `category-marquee-track ${isArabic ? "category-marquee-track-rtl" : ""}` : "inline-flex items-stretch"}
                style={
                  shouldAnimateCategories
                    ? { animationPlayState: isCategoryTickerPaused ? "paused" : "running" }
                    : undefined
                }
              >
                {(shouldAnimateCategories ? [...categories, ...categories] : categories).map((item, index) => {
                  const categoryName = getLocalizedText({
                    en: item.name_en,
                    fr: item.name_fr,
                    ar: item.name_ar,
                  });

                  return (
                    <Link
                      to="/customer/categories/$id"
                      params={{ id: item.id }}
                      key={shouldAnimateCategories ? `${item.id}-${index}` : item.id}
                      className="mx-1 inline-flex min-w-[92px] flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-2 text-center shadow-sm"
                    >
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: item.accent_color || "var(--color-muted)" }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url || fallbackProductImage}
                            alt={categoryName}
                            className="h-8 w-8 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <CategoryIcon iconName={item.icon_name} className="h-8 w-8 text-foreground" />
                        )}
                      </span>
                      <span className="line-clamp-1 text-xs font-semibold text-foreground">{categoryName}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto mt-5 w-full max-w-6xl px-4 pb-10 sm:px-6 md:mt-8">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/customer/all-products" className="text-lg font-semibold tracking-tight text-foreground font-serif">
              {t("products.title")}
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">{t("products.pricesInMad")}</span>
              <Link to="/customer/all-products" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {t("categories.viewAll", { defaultValue: "View All" })}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {teaserProducts.map((product) => (
              <article
                key={product.id}
                className="signature-tilt group relative overflow-hidden rounded-3xl border border-gray-100 bg-white pb-1 shadow-sm"
              >
                <Link to="/customer/product/$id" params={{ id: product.id }} className="block">
                  <div className="relative">
                    <img
                      src={product.image}
                      alt={product.alt}
                      className="h-full w-full object-contain object-center"
                      loading="lazy"
                      width={1024}
                      height={768}
                    />
                  </div>
                </Link>

                <button
                  type="button"
                  aria-label="Wishlist"
                  className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white shadow-sm"
                >
                  <Heart className="size-4 text-teal-700" />
                </button>

                <div className="p-3">
                  <div className="flex flex-row justify-between items-center w-full mb-2">
                    <span className="inline-block rounded-md bg-green-100 px-2 py-1 text-xs text-green-800 font-bold">
                      {getLocalizedText({
                        en: product.brandNameEn || product.brand || "",
                        fr: product.brandNameFr || product.brandNameEn || product.brand || "",
                        ar: product.brandNameAr || product.brandNameEn || product.brand || "",
                      }) || "—"}
                    </span>

                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-700">
                      <Package className="size-3.5" />
                      {product.measurementValue != null ? `${product.measurementValue} ` : ""}
                      {product.measurementUnit}
                    </span>
                  </div>

                  <Link to="/customer/product/$id" params={{ id: product.id }} className="block w-full min-w-0">
                    <h3 className="w-full text-base font-bold line-clamp-2 min-h-[2.75rem] font-serif">{product.name}</h3>
                  </Link>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-3xl font-extrabold text-[#2A7543]">
                      {product.price} <span className="text-sm font-medium">MAD</span>
                    </p>

                    {getCartQuantity(product.id, product.productVariants?.[0] ?? null) > 0 ? (
                      <div className="flex items-center rounded-full border border-gray-200 px-3 py-1">
                        <button
                          type="button"
                          className="inline-flex size-6 items-center justify-center text-[#2A7543]"
                          onClick={() =>
                            decreaseItem(
                              product.productVariants?.[0] ? `${product.id}::${product.productVariants[0]}` : product.id,
                            )
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="min-w-7 text-center text-base font-medium text-gray-900">
                          {getCartQuantity(product.id, product.productVariants?.[0] ?? null)}
                        </span>
                        <button
                          type="button"
                          className="inline-flex size-6 items-center justify-center text-[#2A7543]"
                          onClick={() =>
                            increaseItem(
                              product.productVariants?.[0] ? `${product.id}::${product.productVariants[0]}` : product.id,
                            )
                          }
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-[#2A7543] px-5 py-2 text-white transition hover:bg-green-800 font-bold"
                         onClick={() => addToCart(product, product.productVariants?.[0] ?? null)}
                      >
                        <ShoppingCart className="size-4" />
                        {t("products.add")}
                      </button>
                    )}
                  </div>
                </div>

              </article>
            ))}
          </div>

          {teaserProducts.length > 0 ? (
            <div className="px-4 pb-6 pt-2">
              <Link
                to="/customer/all-products"
                className="flex w-full items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 py-3.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 font-serif"
              >
                {t("home.view_all_products")}
              </Link>
            </div>
          ) : null}

          {teaserProducts.length === 0 ? (
            <AppEmptyState
              title={t("products.empty")}
              subtitle="Try changing category or search terms."
              className="mt-4"
            />
          ) : null}
        </section>

        <section className="mx-auto mt-2 w-full max-w-6xl px-4 pb-4 sm:px-6 md:mt-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="line-clamp-1 text-foreground font-serif text-xl font-bold text-center shadow-lg">
              <Sparkles className="size-4 text-primary" />
              Saving Subscriptions / باكات التوفير
            </h2>
          </div>

          {platformPacksQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`platform-pack-skeleton-${index}`} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : platformPacks.length === 0 ? (
            <AppEmptyState
              title="No subscription packs available yet."
              subtitle="New prepaid savings packs will appear here soon."
            />
          ) : (
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {platformPacks.map((pack) => {
                const packSubscriptionState = activeOrPendingSubscriptionByPackId.get(pack.id) ?? null;
                const completedDeliveries = Math.max(0, Number(packSubscriptionState?.completedDeliveries ?? 0));
                const totalDeliveries = Math.max(0, Number(packSubscriptionState?.totalDeliveries ?? 0));

                return (
                <article
                  key={pack.id}
                  className="surface-panel min-w-[260px] max-w-[300px] flex-1 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => openSubscriptionCheckout(pack)}
                    className="group block w-full text-left"
                  >
                    <div className="relative h-36 w-full overflow-hidden">
                      <img
                        src={pack.imageUrl || productFallbackImage}
                        alt={`${pack.name} subscription pack`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                      <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-success/30 bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                        {Number(pack.basePriceMad).toFixed(0)} MAD / {pack.billingLabel}
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      <h3 className="line-clamp-1 text-base font-semibold text-foreground">{pack.name}</h3>
                      {pack.description ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{pack.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Direct prepaid platform subscription</p>
                      )}
                    </div>
                  </button>

                  <div className="space-y-3 px-3 pb-3">
                    {packSubscriptionState?.status === "pending" ? (
                      <div className="inline-flex w-full items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400">
                        Pending Review / قيد المراجعة
                      </div>
                    ) : packSubscriptionState?.status === "active" ? (
                      <div className="space-y-2 rounded-xl border border-success/30 bg-success/10 p-2.5">
                        <div className="flex items-center gap-1.5">
                          {(totalDeliveries > 0 ? Array.from({ length: totalDeliveries }) : Array.from({ length: 4 })).map((_, index) => {
                            const isDone = index < completedDeliveries;
                            return (
                              <span
                                key={`${pack.id}-step-${index}`}
                                className={[
                                  "h-2.5 flex-1 rounded-sm border transition-colors",
                                  isDone
                                    ? "border-success bg-success"
                                    : "border-border/80 bg-muted",
                                ].join(" ")}
                              />
                            );
                          })}
                        </div>
                        <p className="text-[11px] font-medium text-success">
                          Delivery {Math.min(completedDeliveries + 1, Math.max(totalDeliveries, 1))} of {Math.max(totalDeliveries, 1)}
                        </p>
                      </div>
                    ) : packSubscriptionState?.status === "paused" ? (
                      <div className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Paused — View details to resume
                      </div>
                    ) : (
                      <Button
                        type="button"
                        className="w-full rounded-xl border border-success/30 bg-success/15 text-success hover:bg-success/20"
                        onClick={() => openSubscriptionCheckout(pack)}
                      >
                        <Package className="size-4" />
                        Subscribe
                      </Button>
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>

        {flashDeals.length > 0 ? (
        <section className="mx-auto mt-2 w-full max-w-6xl px-4 pb-3 sm:px-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="line-clamp-1 text-foreground font-serif text-xl font-bold text-center shadow-lg">
              <Flame className="size-4 text-destructive" />
              {t("flashDeals.title")}
            </h2>
            <div className="inline-flex items-center gap-2">
              <Link
                to="/customer/flash-deals"
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t("categories.viewAll", { defaultValue: "View All" })}
              </Link>
              <div className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                <Clock3 className="size-3.5" />
                <span>{t("flashDeals.endsIn")}: {countdownLabel}</span>
              </div>
            </div>
          </div>

          <Carousel
            opts={{ loop: flashDeals.length > 1, align: "start", skipSnaps: false, dragFree: false }}
            plugins={flashDeals.length > 1 ? [flashDealsAutoplayRef.current] : []}
            className="mb-5"
            onPointerDownCapture={() => {
              try {
                flashDealsAutoplayRef.current.stop();
              } catch {
                // ignore autoplay lifecycle race conditions
              }
            }}
            onPointerUpCapture={() => {
              try {
                flashDealsAutoplayRef.current.play();
              } catch {
                // ignore autoplay lifecycle race conditions
              }
            }}
            onTouchStartCapture={() => {
              try {
                flashDealsAutoplayRef.current.stop();
              } catch {
                // ignore autoplay lifecycle race conditions
              }
            }}
            onTouchEndCapture={() => {
              try {
                flashDealsAutoplayRef.current.play();
              } catch {
                // ignore autoplay lifecycle race conditions
              }
            }}
            onMouseEnter={() => {
              try {
                flashDealsAutoplayRef.current.stop();
              } catch {
                // ignore autoplay lifecycle race conditions
              }
            }}
            onMouseLeave={() => {
              try {
                flashDealsAutoplayRef.current.play();
              } catch {
                // ignore autoplay lifecycle race conditions
              }
            }}
          >
            <CarouselContent className="-ml-0 items-stretch gap-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {flashDeals.map((product) => (
                <CarouselItem key={`flash-${product.id}`} className="basis-[170px] pl-0 h-full">
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    brand={t("flashDeals.title", { defaultValue: "Flash Deal" })}
                    measurementUnit={product.measurementUnit}
                    imageUrl={product.image}
                    productVariants={[]}
                    price={Number(product.dealPrice ?? 0)}
                    oldPrice={Number(product.price ?? 0)}
                    discountPercent={product.discountPercent}
                    isFlashDeal
                    cartQuantity={getCartQuantity(product.id)}
                    addLabel={t("products.add")}
                    onAdd={() => addFlashDealToCart(product)}
                    onIncrease={() => increaseItem(product.id)}
                    onDecrease={() => decreaseItem(product.id)}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {!isBottomPromoDismissed ? (
            <div className="relative mb-20 overflow-hidden rounded-2xl border border-success/30 bg-card">
              <button
                type="button"
                onClick={() => setIsBottomPromoDismissed(true)}
                aria-label="Dismiss promotions"
                className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground"
              >
                <X className="size-4" />
              </button>

              <Carousel
                opts={{ loop: true, align: "start", skipSnaps: false, dragFree: false }}
                plugins={[bottomPromoAutoplayRef.current]}
                className="w-full"
                onPointerDownCapture={() => bottomPromoAutoplayRef.current.stop()}
                onPointerUpCapture={() => bottomPromoAutoplayRef.current.play()}
                onTouchStartCapture={() => bottomPromoAutoplayRef.current.stop()}
                onTouchEndCapture={() => bottomPromoAutoplayRef.current.play()}
                onMouseEnter={() => bottomPromoAutoplayRef.current.stop()}
                onMouseLeave={() => bottomPromoAutoplayRef.current.play()}
              >
                <CarouselContent>
                  <CarouselItem className="pl-0">
                    <article className="surface-panel flex items-center gap-3 px-4 py-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Share2 className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{t("flashDeals.inviteTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("flashDeals.inviteCopy")}</p>
                        <p className="mt-1 text-[11px] font-semibold text-primary">{t("flashDeals.freeDelivery")}</p>
                      </div>
                      <button className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Share2 className="size-4" />
                      </button>
                    </article>
                  </CarouselItem>

                  <CarouselItem className="pl-0">
                    <article className="surface-panel flex items-center gap-3 px-4 py-2.5">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                        <ShieldCheck className="size-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t("flashDeals.ecoTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("flashDeals.ecoCopy")}</p>
                      </div>
                    </article>
                  </CarouselItem>
                </CarouselContent>
              </Carousel>
            </div>
          ) : null}
        </section>
        ) : null}
      </main>

      {isCheckoutOpen ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" />
          <section className="absolute inset-0 flex flex-col bg-background animate-in fade-in duration-300">
            <header className="flex items-start justify-between border-b border-border px-4 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Checkout</h2>
                <p className="text-sm text-muted-foreground">Review and confirm your delivery</p>
              </div>
              <button
                aria-label="Close checkout"
                onClick={() => setIsCheckoutOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </header>

            {checkoutStep === "success" ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="size-10" />
                </span>
                <h3 className="mt-6 text-2xl font-semibold text-foreground">Order Placed Successfully!</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Your cyclist is on the way.
                </p>
                <Button variant="hero" className="mt-8 rounded-xl" onClick={returnToHome}>
                  <House className="size-4" />
                  Return to Home
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-28 pt-4">
                  <section className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Delivery Location</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <MapPin className="size-4 text-primary" />
                      <span>{selectedLocationLabel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Locked from your onboarding selection</p>
                  </section>

                  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Delivery Details</h3>
                    {isCheckoutProfileHydrating ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-24 rounded-xl" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="fullName">
                            Full Name
                          </label>
                          <input
                            id="fullName"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Enter your full name"
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="phoneNumber">
                            Phone Number
                          </label>
                          <div className="flex h-10 items-center overflow-hidden rounded-xl border border-input bg-muted/60">
                            <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                            <input
                              id="phoneNumber"
                              value={phoneNumber.replace(/^\+212/, "")}
                              inputMode="numeric"
                              autoComplete="tel"
                              readOnly
                              className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm text-foreground outline-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="address">
                            Address
                          </label>
                          <input
                            id="address"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            placeholder="Street, building, apartment..."
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="deliveryNotes">
                            Delivery Instructions (Optional)
                          </label>
                          <textarea
                            id="deliveryNotes"
                            value={deliveryNotes}
                            onChange={(event) => setDeliveryNotes(event.target.value)}
                            placeholder="Example: call before arrival, leave at door, or gate code"
                            className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                      </>
                    )}
                  </section>

                  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Payment Method</h3>
                    <RadioGroup
                      value={selectedPaymentMethod}
                      onValueChange={(value) =>
                        value === "COD" || value === "Carnet" ? setSelectedPaymentMethod(value) : undefined
                      }
                      className="space-y-2"
                    >
                      <Label
                        htmlFor="payment-cod"
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left ${
                          selectedPaymentMethod === "COD"
                            ? "border-primary/30 bg-primary/10"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                            <HandCoins className="size-4" />
                          </span>
                          Cash on Delivery (COD)
                        </span>
                        <RadioGroupItem id="payment-cod" value="COD" />
                      </Label>

                      {paymentOptionsQuery.data?.canUseCarnet ? (
                        <Label
                          htmlFor="payment-carnet"
                          className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left ${
                            selectedPaymentMethod === "Carnet"
                              ? "border-primary/30 bg-primary/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                              <CreditCard className="size-4" />
                            </span>
                            Add to Carnet (Pay Later)
                          </span>
                          <RadioGroupItem id="payment-carnet" value="Carnet" />
                        </Label>
                      ) : null}
                    </RadioGroup>
                    {paymentOptionsQuery.isFetching ? (
                      <p className="text-xs text-muted-foreground">Checking carnet eligibility...</p>
                    ) : !paymentOptionsQuery.data?.canUseCarnet && paymentOptionsQuery.data?.reason ? (
                      <p className="text-xs text-muted-foreground">{paymentOptionsQuery.data.reason}</p>
                    ) : null}
                  </section>

                  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
                    <div className="space-y-2">
                      {cartItems.map((item) => (
                        <div key={item.cartItemId || item.id} className="flex items-center justify-between text-sm">
                          <p className="text-foreground">
                            {item.name}
                            {item.selectedVariant ? ` • ${item.selectedVariant}` : ""}{" "}
                            <span className="text-muted-foreground">x{item.quantity}</span>
                          </p>
                          <p className="font-medium text-foreground">{item.price * item.quantity} MAD</p>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{isArabic ? "رسوم التوصيل" : "Delivery Fee"}</p>
                        <p className="text-sm font-medium text-foreground">
                          {selectedNeighborhoodId ? `${calculatedDeliveryFeeMad.toFixed(2)} MAD` : isArabic ? "قيد التحديد" : "Pending"}
                        </p>
                      </div>
                      {selectedNeighborhoodId ? (
                        <div className="mb-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold text-success">
                            <Gift className="size-3.5" />
                            {amountToFreeDeliveryMad > 0
                              ? isArabic
                                ? `زيد ${amountToFreeDeliveryMad.toFixed(2)} درهم باش تستافد من توصيل فابور!`
                                : `Spend ${amountToFreeDeliveryMad.toFixed(2)} MAD more to get FREE Delivery!`
                              : isArabic
                                ? "مبروك! عندك توصيل فابور"
                                : "You have unlocked Free Delivery! 🎉"}
                          </p>
                        </div>
                      ) : null}
                      {!isMinimumOrderMet ? (
                        <p className="mb-2 text-xs font-medium text-destructive">
                          {isArabic
                            ? `الحد الأدنى للطلب هو ${minimumOrderMad.toFixed(2)} درهم.`
                            : `Minimum order amount is ${minimumOrderMad.toFixed(2)} MAD.`}
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Final Total</p>
                        <p className="text-lg font-semibold text-foreground">{finalTotalMad.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur">
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={confirmOrder}
                    disabled={!canConfirmOrder}
                  >
                    {isSubmittingOrder ? "Confirming..." : "Confirm Order"}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {isCustomerAuthModalOpen ? (
        isMobile ? (
          <Drawer open={isCustomerAuthModalOpen} onOpenChange={setIsCustomerAuthModalOpen}>
            <DrawerContent className="rounded-t-3xl border-border bg-background px-6 pb-6 pt-2">
              <div className="relative flex flex-col gap-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsCustomerAuthModalOpen(false)}
                  aria-label="Close login prompt"
                >
                  <X className="h-5 w-5" />
                </Button>

                <div className="pt-4 text-center">
                  <UserCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <h2 className="text-xl font-bold text-foreground">{customerSession ? "Account" : "Welcome Back"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {customerSession ? "You are currently signed in." : "Enter your phone number to continue"}
                  </p>
                </div>

                {customerSession && customerPanelView === "account" ? (
                  <div className="space-y-3">
                  <section className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Phone Number</p>
                    <p className="text-sm font-medium text-foreground">{customerSession.phoneNumber}</p>
                  </section>
                  <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {language === "ar" ? "رصيد الكارني" : language === "fr" ? "Solde Carnet" : "My Carnet / Credit Balance"}
                    </p>
                    <p className="text-lg font-semibold text-destructive">{Number(carnetCurrentDebt ?? 0).toFixed(2)} MAD</p>
                  </section>
                  <Button variant="hero" className="w-full rounded-xl" onClick={() => setCustomerPanelView("profile")}>
                    View & Edit Profile
                  </Button>
                  <Button
                    variant="soft"
                    className="w-full rounded-xl"
                    onClick={() => {
                      setCustomerPanelView("carnet");
                    }}
                  >
                    Carnet Details
                  </Button>
                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setIsCustomerAuthModalOpen(false)}>
                    Close
                  </Button>
                  <Button variant="destructive" className="w-full rounded-xl" onClick={logoutCustomer}>
                    Logout
                  </Button>
                  </div>
                ) : customerSession && customerPanelView === "profile" ? (
                  <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="profile-full-name" className="text-xs font-medium text-muted-foreground">
                      Full Name
                    </label>
                    <input
                      id="profile-full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter your full name"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="profile-phone" className="text-xs font-medium text-muted-foreground">
                      Phone Number
                    </label>
                    <input
                      id="profile-phone"
                      value={phoneNumber}
                      readOnly
                      className="h-10 w-full rounded-xl border border-input bg-muted/50 px-3 text-sm text-foreground outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="profile-address" className="text-xs font-medium text-muted-foreground">
                      Address
                    </label>
                    <textarea
                      id="profile-address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Street, building, apartment..."
                      className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <Button
                    variant="hero"
                    className="w-full rounded-xl"
                    onClick={async () => {
                      if (!customerSession?.phoneNumber || !fullName.trim()) {
                        toast.error("Please complete profile details first.");
                        return;
                      }

                      try {
                        await saveCustomerProfile({
                          data: {
                            phoneNumber: customerSession.phoneNumber,
                            fullName: fullName.trim(),
                            address: address.trim(),
                            savedInstructions: deliveryNotes.trim(),
                            neighborhoodId: selectedNeighborhoodId || null,
                          },
                        });
                        toast.success("Profile updated.");
                        setCustomerPanelView("account");
                      } catch (error) {
                        console.error("Failed to update customer profile:", error);
                        toast.error("Failed to update profile.");
                      }
                    }}
                  >
                    Save Profile
                  </Button>
                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                    Back to Account
                  </Button>
                  </div>
                ) : customerSession && customerPanelView === "orders" ? (
                  <div className="space-y-3">
                  {customerSubscriptionsQuery.isLoading ? (
                    <AppEmptyState title="Loading subscriptions..." subtitle="Syncing your contract status." className="p-4" />
                  ) : hasCustomerSubscriptions ? (
                    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Subscriptions</p>
                      <div className="space-y-2">
                        {customerSubscriptions.map((subscription) => {
                          const isPending = subscription.status === "pending";
                          const isActive = subscription.status === "active";
                          const isCompleted = subscription.status === "completed";

                          return (
                            <article key={subscription.id} className="space-y-2 rounded-xl border border-border bg-background p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{subscription.packName}</p>
                                  <p className="text-xs text-muted-foreground">#{subscription.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <Badge
                                  className={
                                    isPending
                                      ? "border border-chart-4/40 bg-chart-4/20 text-chart-4"
                                      : isCompleted
                                        ? "bg-success/20 text-success"
                                        : "bg-primary/15 text-primary"
                                  }
                                >
                                  {getSubscriptionStatusLabel(subscription.status)}
                                </Badge>
                              </div>

                              <div className="space-y-2">
                                <Progress
                                  value={subscription.completionPercent}
                                  className="h-2 bg-muted"
                                  indicatorClassName="bg-success"
                                  aria-label={`Subscription progress ${subscription.completionPercent}%`}
                                />
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>
                                    {subscription.completedDeliveries}/{Math.max(subscription.totalDeliveries, 0)} deliveries
                                  </span>
                                  <span>{subscription.completionPercent}%</span>
                                </div>
                              </div>

                              {isPending ? (
                                <p className="text-xs font-medium text-chart-4">Awaiting platform approval before activation.</p>
                              ) : null}
                              {isActive ? (
                                <p className="text-xs font-medium text-success">Subscription active — deliveries are being tracked live.</p>
                              ) : null}
                              {isCompleted ? (
                                <p className="text-xs font-medium text-success">Subscription finished.</p>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {customerOrdersQuery.isLoading ? (
                    <AppEmptyState title="Loading your orders..." subtitle="Please wait a moment." className="p-5" />
                  ) : (customerOrdersQuery.data?.length ?? 0) === 0 ? (
                    <AppEmptyState
                      title="No orders yet."
                      subtitle="Your order history will appear here after checkout."
                      className="p-5"
                    />
                  ) : (
                    <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                      {activeCustomerOrders.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Orders</p>
                          {activeCustomerOrders.map((order) => {
                            const activeStepIndex = getOrderStepIndex(order.status);
                            const isDeliveredState = isDeliveredOrderStatus(order.status);
                            const orderDate = new Date(order.created_at);

                            return (
                              <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
                                <button
                                  type="button"
                                  className="w-full text-left"
                                  onClick={() => {
                                    void navigate({ to: "/customer/order/$orderId", params: { orderId: order.id } });
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{orderDate.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                      {isCarnetUnpaidOrder(order.payment_method) ? (
                                        <Badge variant="outline" className="mb-1 border-orange-300 bg-orange-100 text-orange-800">
                                          Unpaid / Carnet (غير مدفوع / كارني)
                                        </Badge>
                                      ) : null}
                                      <p className="text-sm font-semibold text-foreground">{Number(order.total_price ?? 0).toFixed(2)} MAD</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{order.item_count} items</p>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid grid-cols-4 gap-2">
                                    {statusSteps.map((step, index) => {
                                      const reached = index <= activeStepIndex;
                                      return (
                                        <div key={step.label} className="space-y-1">
                                          <div className={`h-1.5 rounded-full ${reached ? (isDeliveredState ? "bg-success" : "bg-primary") : "bg-muted"}`} />
                                          <p className={`text-[10px] leading-tight ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                                            {step.label}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Open digital receipt</div>
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      ) : null}

                      {deliveredCustomerOrders.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order History</p>
                          {deliveredCustomerOrders.map((order) => {
                            const activeStepIndex = getOrderStepIndex(order.status);
                            const isDeliveredState = isDeliveredOrderStatus(order.status);
                            const orderDate = new Date(order.created_at);

                            return (
                              <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
                                <button
                                  type="button"
                                  className="w-full text-left"
                                  onClick={() => {
                                    void navigate({ to: "/customer/order/$orderId", params: { orderId: order.id } });
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{orderDate.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                      {isCarnetUnpaidOrder(order.payment_method) ? (
                                        <Badge variant="outline" className="mb-1 border-orange-300 bg-orange-100 text-orange-800">
                                          Unpaid / Carnet (غير مدفوع / كارني)
                                        </Badge>
                                      ) : null}
                                      <p className="text-sm font-semibold text-foreground">{Number(order.total_price ?? 0).toFixed(2)} MAD</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{order.item_count} items</p>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid grid-cols-4 gap-2">
                                    {statusSteps.map((step, index) => {
                                      const reached = index <= activeStepIndex;
                                      return (
                                        <div key={step.label} className="space-y-1">
                                          <div className={`h-1.5 rounded-full ${reached ? (isDeliveredState ? "bg-success" : "bg-primary") : "bg-muted"}`} />
                                          <p className={`text-[10px] leading-tight ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                                            {step.label}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Open digital receipt</div>
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                    Back to Account
                  </Button>
                  </div>
                ) : customerSession && customerPanelView === "carnet" ? (
                  <div className="space-y-3">
                  {customerCarnetQuery.isLoading ? (
                    <AppEmptyState title="Loading your carnet..." subtitle="Fetching your latest ledger details." className="p-5" />
                  ) : !customerCarnet ? (
                    <AppEmptyState
                      title="No active carnet found for your account."
                      subtitle="Ask your vendor to enable carnet access for your phone number."
                      className="p-5"
                    />
                  ) : (
                    <>
                      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {language === "ar" ? "الرصيد الحالي" : language === "fr" ? "Dette actuelle" : "Current Debt"}
                          </p>
                          <p className="mt-1 text-xl font-semibold text-destructive">
                            {carnetCurrentDebt.toFixed(2)} MAD
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{carnetUtilizationLabel}</span>
                            <span>{carnetUsagePercent.toFixed(0)}%</span>
                          </div>
                          <Progress
                            value={carnetUsagePercent}
                            className="h-2 bg-muted"
                            indicatorClassName={carnetProgressIndicatorClassName}
                            aria-label={carnetUsagePercentLabel}
                          />
                          <p className="text-xs text-muted-foreground">{carnetDebtRatioLabel}</p>
                        </div>
                      </section>

                      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                        <h3 className="text-sm font-semibold text-foreground">Transaction History</h3>
                        <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
                          {(customerCarnetQuery.data?.transactions ?? []).length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center text-sm text-muted-foreground">
                              No carnet transactions yet.
                            </p>
                          ) : (
                            (customerCarnetQuery.data?.transactions ?? []).map((entry: {
                              id: string;
                              kind: "debt" | "payment";
                              description: string;
                              createdAt: string;
                              amount: number;
                            }) => {
                              const isDebt = entry.kind === "debt";
                              return (
                                <article
                                  key={entry.id}
                                  className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                                  onClick={() => {
                                    if (!isDebt) return;
                                    const orderId = entry.id.startsWith("order:") ? entry.id.slice("order:".length) : entry.id;
                                    void navigate({ to: "/customer/order/$orderId", params: { orderId } });
                                  }}
                                >
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{entry.description}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(entry.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <p className={`text-sm font-semibold ${isDebt ? "text-destructive" : "text-success"}`}>
                                    {isDebt ? "+" : "-"}
                                    {Number(entry.amount ?? 0).toFixed(2)} MAD
                                  </p>
                                </article>
                              );
                            })
                          )}
                        </div>
                      </section>
                    </>
                  )}

                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                    Back to Account
                  </Button>
                  </div>
                ) : authStep === "phone" ? (
                  <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="customer-auth-phone" className="text-xs font-medium text-muted-foreground">
                      Phone Number
                    </label>
                    <div className="flex h-14 items-center overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                      <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                      <input
                        id="customer-auth-phone"
                        value={authPhoneInput}
                        onChange={(event) => setAuthPhoneInput(normalizeMoroccoPhoneInput(event.target.value))}
                        placeholder="6XXXXXXXX"
                        inputMode="numeric"
                        autoComplete="tel"
                        className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-lg outline-none"
                      />
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    className="h-12 w-full rounded-xl font-semibold"
                    onClick={sendCustomerOtp}
                    disabled={!isAuthPhoneValid || isSendingAuthCode}
                  >
                    <MessageCircle className="size-4" />
                    {isSendingAuthCode ? "Sending..." : "Send Code via WhatsApp"}
                  </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                  <p className="text-center text-sm text-muted-foreground">Enter the 4-digit code sent to WhatsApp</p>
                  <div className="flex justify-center">
                    <InputOTP
                      value={authOtpCode}
                      onChange={(value) => setAuthOtpCode(value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      inputMode="numeric"
                    >
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot index={0} className="h-12 w-12 rounded-lg border border-input text-lg" />
                        <InputOTPSlot index={1} className="h-12 w-12 rounded-lg border border-input text-lg" />
                        <InputOTPSlot index={2} className="h-12 w-12 rounded-lg border border-input text-lg" />
                        <InputOTPSlot index={3} className="h-12 w-12 rounded-lg border border-input text-lg" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    variant="hero"
                    className="w-full rounded-xl"
                    onClick={verifyCustomerOtpAndLogin}
                    disabled={authOtpCode.length !== 4 || isVerifyingAuthOtp}
                  >
                    {isVerifyingAuthOtp ? "Verifying..." : "Verify & Login"}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setAuthStep("phone");
                      setAuthPhoneForOtp("");
                      setAuthOtpCode("");
                    }}
                  >
                    Change phone number
                  </Button>
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isCustomerAuthModalOpen} onOpenChange={setIsCustomerAuthModalOpen}>
            <DialogContent className="[&>button]:hidden w-[95vw] max-w-md rounded-2xl border border-border bg-background p-8 shadow-2xl">
              <div className="relative flex flex-col gap-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsCustomerAuthModalOpen(false)}
                  aria-label="Close login prompt"
                >
                  <X className="h-5 w-5" />
                </Button>

                <div className="text-center">
                  <UserCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <h2 className="text-xl font-bold text-foreground">{customerSession ? "Account" : "Welcome Back"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {customerSession ? "You are currently signed in." : "Enter your phone number to continue"}
                  </p>
                </div>

                {customerSession && customerPanelView === "account" ? (
                  <div className="space-y-3">
                    <section className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Phone Number</p>
                      <p className="text-sm font-medium text-foreground">{customerSession.phoneNumber}</p>
                    </section>
                    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {language === "ar" ? "رصيد الكارني" : language === "fr" ? "Solde Carnet" : "My Carnet / Credit Balance"}
                      </p>
                      <p className="text-lg font-semibold text-destructive">{Number(carnetCurrentDebt ?? 0).toFixed(2)} MAD</p>
                    </section>
                    <Button variant="hero" className="w-full rounded-xl" onClick={() => setCustomerPanelView("profile")}>
                      View & Edit Profile
                    </Button>
                    <Button
                      variant="soft"
                      className="w-full rounded-xl"
                      onClick={() => {
                        setCustomerPanelView("carnet");
                      }}
                    >
                      Carnet Details
                    </Button>
                    <Button variant="soft" className="w-full rounded-xl" onClick={() => setIsCustomerAuthModalOpen(false)}>
                      Close
                    </Button>
                    <Button variant="destructive" className="w-full rounded-xl" onClick={logoutCustomer}>
                      Logout
                    </Button>
                  </div>
                ) : customerSession && customerPanelView === "profile" ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label htmlFor="profile-full-name" className="text-xs font-medium text-muted-foreground">
                        Full Name
                      </label>
                      <input
                        id="profile-full-name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Enter your full name"
                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-phone" className="text-xs font-medium text-muted-foreground">
                        Phone Number
                      </label>
                      <input
                        id="profile-phone"
                        value={phoneNumber}
                        readOnly
                        className="h-10 w-full rounded-xl border border-input bg-muted/50 px-3 text-sm text-foreground outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-address" className="text-xs font-medium text-muted-foreground">
                        Address
                      </label>
                      <textarea
                        id="profile-address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder="Street, building, apartment..."
                        className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                      />
                    </div>
                    <Button
                      variant="hero"
                      className="w-full rounded-xl"
                      onClick={async () => {
                        if (!customerSession?.phoneNumber || !fullName.trim()) {
                          toast.error("Please complete profile details first.");
                          return;
                        }

                        try {
                          await saveCustomerProfile({
                            data: {
                              phoneNumber: customerSession.phoneNumber,
                              fullName: fullName.trim(),
                              address: address.trim(),
                              savedInstructions: deliveryNotes.trim(),
                              neighborhoodId: selectedNeighborhoodId || null,
                            },
                          });
                          toast.success("Profile updated.");
                          setCustomerPanelView("account");
                        } catch (error) {
                          console.error("Failed to update customer profile:", error);
                          toast.error("Failed to update profile.");
                        }
                      }}
                    >
                      Save Profile
                    </Button>
                    <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                      Back to Account
                    </Button>
                  </div>
                ) : customerSession && customerPanelView === "orders" ? (
                  <div className="space-y-3">
                    {customerSubscriptionsQuery.isLoading ? (
                      <AppEmptyState title="Loading subscriptions..." subtitle="Syncing your contract status." className="p-4" />
                    ) : hasCustomerSubscriptions ? (
                      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Subscriptions</p>
                        <div className="space-y-2">
                          {customerSubscriptions.map((subscription) => {
                            const isPending = subscription.status === "pending";
                            const isActive = subscription.status === "active";
                            const isCompleted = subscription.status === "completed";

                            return (
                              <article key={subscription.id} className="space-y-2 rounded-xl border border-border bg-background p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{subscription.packName}</p>
                                    <p className="text-xs text-muted-foreground">#{subscription.id.slice(0, 8).toUpperCase()}</p>
                                  </div>
                                  <Badge
                                    className={
                                      isPending
                                        ? "border border-chart-4/40 bg-chart-4/20 text-chart-4"
                                        : isCompleted
                                          ? "bg-success/20 text-success"
                                          : "bg-primary/15 text-primary"
                                    }
                                  >
                                    {getSubscriptionStatusLabel(subscription.status)}
                                  </Badge>
                                </div>

                                <div className="space-y-2">
                                  <Progress
                                    value={subscription.completionPercent}
                                    className="h-2 bg-muted"
                                    indicatorClassName="bg-success"
                                    aria-label={`Subscription progress ${subscription.completionPercent}%`}
                                  />
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                      {subscription.completedDeliveries}/{Math.max(subscription.totalDeliveries, 0)} deliveries
                                    </span>
                                    <span>{subscription.completionPercent}%</span>
                                  </div>
                                </div>

                                {isPending ? (
                                  <p className="text-xs font-medium text-chart-4">Awaiting platform approval before activation.</p>
                                ) : null}
                                {isActive ? (
                                  <p className="text-xs font-medium text-success">Subscription active — deliveries are being tracked live.</p>
                                ) : null}
                                {isCompleted ? (
                                  <p className="text-xs font-medium text-success">Subscription finished.</p>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    {customerOrdersQuery.isLoading ? (
                      <AppEmptyState title="Loading your orders..." subtitle="Please wait a moment." className="p-5" />
                    ) : (customerOrdersQuery.data?.length ?? 0) === 0 ? (
                      <AppEmptyState
                        title="No orders yet."
                        subtitle="Your order history will appear here after checkout."
                        className="p-5"
                      />
                    ) : (
                      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                        {activeCustomerOrders.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Orders</p>
                            {activeCustomerOrders.map((order) => {
                              const activeStepIndex = getOrderStepIndex(order.status);
                              const isDeliveredState = isDeliveredOrderStatus(order.status);
                              const orderDate = new Date(order.created_at);

                              return (
                                <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
                                  <button
                                    type="button"
                                    className="w-full text-left"
                                    onClick={() => {
                                      void navigate({ to: "/customer/order/$orderId", params: { orderId: order.id } });
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{orderDate.toLocaleString()}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-foreground">{Number(order.total_price ?? 0).toFixed(2)} MAD</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{order.item_count} items</p>
                                      </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-4 gap-2">
                                      {statusSteps.map((step, index) => {
                                        const reached = index <= activeStepIndex;
                                        return (
                                          <div key={step.label} className="space-y-1">
                                            <div className={`h-1.5 rounded-full ${reached ? (isDeliveredState ? "bg-success" : "bg-primary") : "bg-muted"}`} />
                                            <p className={`text-[10px] leading-tight ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                                              {step.label}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Open digital receipt</div>
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        ) : null}

                        {deliveredCustomerOrders.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order History</p>
                            {deliveredCustomerOrders.map((order) => {
                              const activeStepIndex = getOrderStepIndex(order.status);
                              const isDeliveredState = isDeliveredOrderStatus(order.status);
                              const orderDate = new Date(order.created_at);

                              return (
                                <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
                                  <button
                                    type="button"
                                    className="w-full text-left"
                                    onClick={() => {
                                      void navigate({ to: "/customer/order/$orderId", params: { orderId: order.id } });
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{orderDate.toLocaleString()}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-foreground">{Number(order.total_price ?? 0).toFixed(2)} MAD</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{order.item_count} items</p>
                                      </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-4 gap-2">
                                      {statusSteps.map((step, index) => {
                                        const reached = index <= activeStepIndex;
                                        return (
                                          <div key={step.label} className="space-y-1">
                                            <div className={`h-1.5 rounded-full ${reached ? (isDeliveredState ? "bg-success" : "bg-primary") : "bg-muted"}`} />
                                            <p className={`text-[10px] leading-tight ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                                              {step.label}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Open digital receipt</div>
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    )}

                    <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                      Back to Account
                    </Button>
                  </div>
                ) : customerSession && customerPanelView === "carnet" ? (
                  <div className="space-y-3">
                    {customerCarnetQuery.isLoading ? (
                      <AppEmptyState title="Loading your carnet..." subtitle="Fetching your latest ledger details." className="p-5" />
                    ) : !customerCarnet ? (
                      <AppEmptyState
                        title="No active carnet found for your account."
                        subtitle="Ask your vendor to enable carnet access for your phone number."
                        className="p-5"
                      />
                    ) : (
                      <>
                        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                          <div className="rounded-xl border border-border bg-muted/30 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {language === "ar" ? "الرصيد الحالي" : language === "fr" ? "Dette actuelle" : "Current Debt"}
                            </p>
                            <p className="mt-1 text-xl font-semibold text-destructive">
                              {carnetCurrentDebt.toFixed(2)} MAD
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{carnetUtilizationLabel}</span>
                              <span>{carnetUsagePercent.toFixed(0)}%</span>
                            </div>
                            <Progress
                              value={carnetUsagePercent}
                              className="h-2 bg-muted"
                              indicatorClassName={carnetProgressIndicatorClassName}
                              aria-label={carnetUsagePercentLabel}
                            />
                            <p className="text-xs text-muted-foreground">{carnetDebtRatioLabel}</p>
                          </div>
                        </section>

                        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                          <h3 className="text-sm font-semibold text-foreground">Transaction History</h3>
                          <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
                            {(customerCarnetQuery.data?.transactions ?? []).length === 0 ? (
                              <p className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center text-sm text-muted-foreground">
                                No carnet transactions yet.
                              </p>
                            ) : (
                              (customerCarnetQuery.data?.transactions ?? []).map((entry: {
                                id: string;
                                kind: "debt" | "payment";
                                description: string;
                                createdAt: string;
                                amount: number;
                              }) => {
                                const isDebt = entry.kind === "debt";
                                return (
                                  <article
                                    key={entry.id}
                                    className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                                    onClick={() => {
                                      if (!isDebt) return;
                                      const orderId = entry.id.startsWith("order:") ? entry.id.slice("order:".length) : entry.id;
                                      void navigate({ to: "/customer/order/$orderId", params: { orderId } });
                                    }}
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{entry.description}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(entry.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                    <p className={`text-sm font-semibold ${isDebt ? "text-destructive" : "text-success"}`}>
                                      {isDebt ? "+" : "-"}
                                      {Number(entry.amount ?? 0).toFixed(2)} MAD
                                    </p>
                                  </article>
                                );
                              })
                            )}
                          </div>
                        </section>
                      </>
                    )}

                    <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                      Back to Account
                    </Button>
                  </div>
                ) : authStep === "phone" ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label htmlFor="customer-auth-phone" className="text-xs font-medium text-muted-foreground">
                        Phone Number
                      </label>
                      <div className="flex h-14 items-center overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                        <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                        <input
                          id="customer-auth-phone"
                          value={authPhoneInput}
                          onChange={(event) => setAuthPhoneInput(normalizeMoroccoPhoneInput(event.target.value))}
                          placeholder="6XXXXXXXX"
                          inputMode="numeric"
                          autoComplete="tel"
                          className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-lg outline-none"
                        />
                      </div>
                    </div>

                    <Button
                      variant="hero"
                      className="h-12 w-full rounded-xl font-semibold"
                      onClick={sendCustomerOtp}
                      disabled={!isAuthPhoneValid || isSendingAuthCode}
                    >
                      <MessageCircle className="size-4" />
                      {isSendingAuthCode ? "Sending..." : "Send Code via WhatsApp"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-center text-sm text-muted-foreground">Enter the 4-digit code sent to WhatsApp</p>
                    <div className="flex justify-center">
                      <InputOTP
                        value={authOtpCode}
                        onChange={(value) => setAuthOtpCode(value.replace(/\D/g, "").slice(0, 4))}
                        maxLength={4}
                        inputMode="numeric"
                      >
                        <InputOTPGroup className="gap-2">
                          <InputOTPSlot index={0} className="h-12 w-12 rounded-lg border border-input text-lg" />
                          <InputOTPSlot index={1} className="h-12 w-12 rounded-lg border border-input text-lg" />
                          <InputOTPSlot index={2} className="h-12 w-12 rounded-lg border border-input text-lg" />
                          <InputOTPSlot index={3} className="h-12 w-12 rounded-lg border border-input text-lg" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <Button
                      variant="hero"
                      className="w-full rounded-xl"
                      onClick={verifyCustomerOtpAndLogin}
                      disabled={authOtpCode.length !== 4 || isVerifyingAuthOtp}
                    >
                      {isVerifyingAuthOtp ? "Verifying..." : "Verify & Login"}
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setAuthStep("phone");
                        setAuthPhoneForOtp("");
                        setAuthOtpCode("");
                      }}
                    >
                      Change phone number
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )
      ) : null}

      {isLocationModalOpen ? (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/50" />
          <section className="absolute inset-0 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
              <div className="flex w-full items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">Select Your Delivery Location</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground"
                  onClick={closeLocationModal}
                  aria-label="Close location drawer"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose your Jamaa Tourabiya and Hay / Douar before placing orders.
              </p>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Jamaa Tourabiya</label>
                  <div className="sticky top-0 z-50 bg-background pb-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={communeSearchInput}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setCommuneSearchInput(nextValue);
                          if (selectedCommuneId) {
                            setSelectedCommuneId("");
                            setSelectedCommuneOption(null);
                            setSelectedNeighborhoodId("");
                            setSelectedNeighborhoodOption(null);
                            setNeighborhoodSearchInput("");
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.preventDefault();
                        }}
                        placeholder="Search commune (EN / FR / AR)..."
                        className="h-10 rounded-xl pl-9 pr-3 text-sm"
                        role="combobox"
                        aria-expanded={hasEnoughCommuneChars}
                        aria-controls="commune-results"
                      />
                    </div>
                  </div>
                  <div id="commune-results" className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-background">
                    {!hasEnoughCommuneChars ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        {language === "ar"
                          ? "بدا كتب باش نْقلبو ليك..."
                          : language === "fr"
                            ? "Commencez à taper pour rechercher..."
                            : "Start typing to search..."}
                      </p>
                    ) : communeSearchQuery.isLoading ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">Loading communes...</p>
                    ) : filteredCommuneOptions.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">No commune found.</p>
                    ) : (
                      <ul className="py-1">
                        {filteredCommuneOptions.map((commune) => (
                          <li key={commune.id}>
                            <button
                              type="button"
                              onClick={() => {
                                const nextCommuneId = commune.id;
                                const communeHasChanged = nextCommuneId !== selectedCommuneId;
                                setSelectedCommuneId(nextCommuneId);
                                setSelectedCommuneOption(commune);
                                if (communeHasChanged) {
                                  setSelectedNeighborhoodId("");
                                  setSelectedNeighborhoodOption(null);
                                  setNeighborhoodSearchInput("");
                                }
                                setCommuneSearchInput(getLocalizedCommuneName(commune));
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                            >
                              <Check className={`size-4 ${selectedCommuneId === commune.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{getLocalizedCommuneName(commune)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Hay / Douar</label>
                  <div className="sticky top-0 z-50 bg-background pb-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={neighborhoodSearchInput}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setNeighborhoodSearchInput(nextValue);
                          if (selectedNeighborhoodId) {
                            setSelectedNeighborhoodId("");
                            setSelectedNeighborhoodOption(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.preventDefault();
                        }}
                        placeholder={selectedCommuneId ? "Search douar (EN / FR / AR)..." : "Select a commune first"}
                        className="h-10 rounded-xl pl-9 pr-3 text-sm"
                        role="combobox"
                        aria-expanded={!!selectedCommuneId && hasEnoughNeighborhoodChars}
                        aria-controls="douar-results"
                        disabled={!selectedCommuneId}
                      />
                    </div>
                    {selectedNeighborhoodOption ? (
                      <p className="mt-2 text-sm font-medium text-primary">
                        {getLocalizedDeliveryFeeToLocationLabel()}: {Number(selectedNeighborhoodOption.deliveryFee ?? 0).toFixed(0)} MAD
                      </p>
                    ) : null}
                  </div>
                  <div id="douar-results" className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-background">
                    {!selectedCommuneId ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">Select a commune first.</p>
                    ) : !hasEnoughNeighborhoodChars ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        {language === "ar"
                          ? "بدا كتب باش نْقلبو ليك..."
                          : language === "fr"
                            ? "Commencez à taper pour rechercher..."
                            : "Start typing to search..."}
                      </p>
                    ) : neighborhoodSearchQuery.isLoading ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">Loading douars...</p>
                    ) : !selectedNeighborhoodId && filteredNeighborhoodOptions.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">No douar found in this commune.</p>
                    ) : (
                      <ul className="py-1">
                        {filteredNeighborhoodOptions.map((neighborhood) => (
                          <li key={neighborhood.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNeighborhoodId(neighborhood.id);
                                setSelectedNeighborhoodOption(neighborhood);
                                setNeighborhoodSearchInput(getLocalizedNeighborhoodName(neighborhood));
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                            >
                              <Check
                                className={`size-4 ${selectedNeighborhoodId === neighborhood.id ? "opacity-100" : "opacity-0"}`}
                              />
                              <span className="truncate">
                                {getLocalizedNeighborhoodName(neighborhood)} ({getLocalizedDeliveryLabel()}: {Number(neighborhood.deliveryFee ?? 0).toFixed(0)} MAD)
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="hero"
                className="mt-5 w-full rounded-xl"
                onClick={saveLocationSelection}
                disabled={!selectedCommuneId || !selectedNeighborhoodId || communeSearchQuery.isLoading || neighborhoodSearchQuery.isLoading}
              >
                Confirm Location
              </Button>
            </div>
          </section>
        </div>
      ) : null}

    </>
  );
}
