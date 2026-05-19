import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bike,
  Check,
  CheckCheck,
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
  Headset,
  SendHorizontal,
  Paperclip,
  ClipboardList,
  BookOpen,
  Share2,
  ArrowRight,
  Flame,
  Clock3,
  ChevronLeft,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { getActiveHeroSection, getGlobalSettings } from "@/lib/admin-dashboard.functions";
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
import {
  createSupportTicket,
  listCustomerSupportMessages,
  listCustomerSupportTickets,
  sendCustomerSupportMessage,
} from "@/lib/support.functions";
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
import productDairyImage from "@/assets/product-dairy.jpg";
import productKhobzImage from "@/assets/product-khobz.jpg";
import productMintTeaImage from "@/assets/product-mint-tea.jpg";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import { type CustomerPanelView, useCustomerPanelStore } from "@/lib/customer-panel-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useAppLanguage, useLocalizedText } from "@/hooks/use-localization";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toPublicOrderCode } from "@/lib/order-code";

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
  descriptionFr?: string | null;
  descriptionAr?: string | null;
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

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

const normalizeSearchText = (value: string) => value.trim().toLocaleLowerCase();

const normalizeScannedOrderToken = (value: string) =>
  value
    .trim()
    .replace(/^order[:\-_]*/i, "")
    .replace(/^#/, "")
    .trim();

const extractOrderIdentifierFromQrPayload = (rawValue: string): string | null => {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const readFromPlainToken = (candidate: string) => {
    const normalized = normalizeScannedOrderToken(candidate);
    return /^[a-zA-Z0-9-]{6,64}$/.test(normalized) ? normalized : null;
  };

  const plainToken = readFromPlainToken(trimmed);
  if (plainToken) return plainToken;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const fromPath = pathParts[pathParts.length - 1] ?? "";
      const fromPathToken = readFromPlainToken(fromPath);
      if (fromPathToken) return fromPathToken;
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      orderId?: string;
      order_id?: string;
      id?: string;
      order?: string;
      receiptUrl?: string;
      receipt_url?: string;
      url?: string;
    };

    const directCandidate =
      parsed.orderId ??
      parsed.order_id ??
      parsed.id ??
      parsed.order ??
      parsed.receiptUrl ??
      parsed.receipt_url ??
      parsed.url;

    if (typeof directCandidate !== "string") return null;
    if (/^https?:\/\//i.test(directCandidate.trim())) {
      return extractOrderIdentifierFromQrPayload(directCandidate);
    }

    return readFromPlainToken(directCandidate);
  } catch {
    const regexMatch = trimmed.match(/(?:order(?:Id)?|receipt)[\s:=/#-]*([a-zA-Z0-9-]{6,64})/i);
    return regexMatch?.[1] ? normalizeScannedOrderToken(regexMatch[1]) : null;
  }
};

const shouldFallbackToLatestOrderFromQrPayload = (rawValue: string) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return false;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const lastPath = pathParts[pathParts.length - 1] ?? "";
      return !/^[a-zA-Z0-9-]{6,64}$/.test(normalizeScannedOrderToken(lastPath));
    } catch {
      return false;
    }
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
};

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
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const getLocalizedText = useLocalizedText();
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
  const supportContext = useCustomerPanelStore((state) => state.supportContext);
  const setCustomerPanelView = useCustomerPanelStore((state) => state.setCustomerPanelView);
  const openSupportPanel = useCustomerPanelStore((state) => state.openSupportPanel);
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
  const isMobile = useIsMobile();
  const isArabic = language === "ar";
  const [isCategoryTickerPaused, setIsCategoryTickerPaused] = useState(false);
  const [isBottomPromoDismissed, setIsBottomPromoDismissed] = useState(false);
  const [desktopSearchInput, setDesktopSearchInput] = useState("");
  const [mobileSearchInput, setMobileSearchInput] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileHeroScrollProgress, setMobileHeroScrollProgress] = useState(0);
  const [isMobileSearchSticky, setIsMobileSearchSticky] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isSubInteracting, setIsSubInteracting] = useState(false);
  const [isBannerInteracting, setIsBannerInteracting] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannerStatusMessage, setScannerStatusMessage] = useState("");
  const [isProcessingQrResult, setIsProcessingQrResult] = useState(false);
  const scannerInstanceRef = useRef<any>(null);
  const scannerMountedRef = useRef(false);
  const [authKeyboardInset, setAuthKeyboardInset] = useState(0);
  const [supportMessageInput, setSupportMessageInput] = useState("");
  const [supportImageDataUrl, setSupportImageDataUrl] = useState<string | null>(null);
  const [isSupportAttachmentUploading, setIsSupportAttachmentUploading] = useState(false);
  const [supportActiveTicketId, setSupportActiveTicketId] = useState<string | null>(null);
  const [supportIsTyping, setSupportIsTyping] = useState(false);
  const [supportPriority, setSupportPriority] = useState<"normal" | "high">("normal");
  const [supportFloatingNotification, setSupportFloatingNotification] = useState<string | null>(null);
  const supportToastTimerRef = useRef<number | null>(null);
  const lastNotifiedSupportMessageIdRef = useRef<string | null>(null);
  const supportNotificationTicketRef = useRef<string | null>(null);
  const primedSupportToastTicketsRef = useRef<Set<string>>(new Set());
  const supportMessagesScrollRef = useRef<HTMLDivElement | null>(null);
  const [authSheetMaxHeight, setAuthSheetMaxHeight] = useState<number | null>(null);
  const [supportViewportHeight, setSupportViewportHeight] = useState<number | null>(null);
  const [authSheetCanScrollUp, setAuthSheetCanScrollUp] = useState(false);
  const [authSheetCanScrollDown, setAuthSheetCanScrollDown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchAnchorRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileStickySearchRef = useRef<HTMLDivElement | null>(null);
  const authSheetScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const subScrollRef = useRef<HTMLDivElement>(null);
  const bannerScrollRef = useRef<HTMLDivElement>(null);
  const activeSearchTerm = isMobile ? mobileSearchInput : desktopSearchInput;
  const debouncedSearchTerm = useDebouncedValue(activeSearchTerm, 300);
  const customerTypography = useMemo(
    () => ({
      textAlign: isArabic ? "text-right" : "text-left",
      heroTitle: "text-balance font-sans text-[clamp(1.18rem,5.2vw,1.46rem)] font-bold leading-[1.08] text-foreground",
      heroSubtitle: "text-[clamp(0.78rem,3.2vw,0.92rem)] font-normal leading-[1.5] text-muted-foreground",
      sectionTitle: "text-[clamp(1.2rem,4.6vw,1.55rem)] font-bold leading-tight tracking-tight text-foreground",
      sectionMeta: "text-[11px] font-medium leading-4 text-muted-foreground",
      eyebrow: "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90",
      cardTitle: "min-h-[2.8rem] break-words line-clamp-2 text-[14px] font-semibold leading-[1.28] text-foreground",
      cardBody: "text-xs leading-5 text-muted-foreground",
      priceMain: "whitespace-nowrap text-[clamp(1.02rem,4.5vw,1.22rem)] font-extrabold leading-none tracking-tight text-primary",
      priceCurrency: "text-[11px] font-semibold leading-none",
      cta: "inline-flex h-9 items-center gap-1.5 rounded-[16px] px-3 text-xs font-semibold leading-none",
      flashTitle: "text-[15px] font-extrabold uppercase tracking-wide leading-tight",
    }),
    [isArabic],
  );
  const bottomPromoAutoplayRef = useRef(
    Autoplay({ delay: 4500, stopOnMouseEnter: true, stopOnFocusIn: true, stopOnInteraction: false }),
  );

  const getScrollTravelDistance = (element: HTMLDivElement) => {
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const traveled = Math.min(maxScroll, Math.abs(element.scrollLeft));
    return { maxScroll, traveled };
  };

  const updateAuthSheetScrollState = (element: HTMLDivElement | null) => {
    if (!element) return;
    const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
    const topOffset = element.scrollTop;
    setAuthSheetCanScrollUp(topOffset > 6);
    setAuthSheetCanScrollDown(maxScroll - topOffset > 6);
  };

  const getLocalizedNeighborhoodName = (zone: { nameEn: string; nameFr: string | null; nameAr: string | null; name: string }) =>
    getLocalizedText({ en: zone.nameEn || zone.name, fr: zone.nameFr, ar: zone.nameAr }, zone.name);
  const getLocalizedCommuneName = (zone: { nameEn?: string | null; nameFr?: string | null; nameAr?: string | null; name: string }) =>
    getLocalizedText({ en: zone.nameEn || zone.name, fr: zone.nameFr, ar: zone.nameAr }, zone.name);
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
  const fetchActiveHeroSection = useServerFn(getActiveHeroSection);
  const fetchActiveAdsAndAnnouncements = useServerFn(getActiveAdsAndAnnouncements);
  const fetchActiveCategories = useServerFn(listActiveCategories);
  const fetchActivePlatformPacks = useServerFn(listActivePlatformPacks);
  const fetchActiveFlashDeals = useServerFn(listActiveFlashDeals);
  const searchProductsFn = useServerFn(searchCustomerProducts);
  const fetchCustomerSupportTickets = useServerFn(listCustomerSupportTickets);
  const fetchCustomerSupportMessages = useServerFn(listCustomerSupportMessages);
  const createCustomerSupportTicket = useServerFn(createSupportTicket);
  const sendSupportMessage = useServerFn(sendCustomerSupportMessage);
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
    refetchInterval: customerSession?.phoneNumber ? 5_000 : false,
    refetchIntervalInBackground: true,
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
  const activeHeroSectionQuery = useQuery({
    queryKey: ["customer", "active-hero"],
    queryFn: () => fetchActiveHeroSection(),
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
  const supportTicketsQuery = useQuery({
    queryKey: ["customer", "support", "tickets", customerSession?.phoneNumber ?? null],
    queryFn: () => fetchCustomerSupportTickets({ data: { phoneNumber: customerSession!.phoneNumber } }),
    enabled: !!customerSession?.phoneNumber,
    refetchInterval: customerSession?.phoneNumber ? 6_000 : false,
    refetchIntervalInBackground: true,
  });
  const supportMessagesQuery = useQuery({
    queryKey: ["customer", "support", "messages", customerSession?.phoneNumber ?? null, supportActiveTicketId ?? null],
    queryFn: () => {
      const phoneNumber = customerSession?.phoneNumber;
      const ticketId = supportActiveTicketId;

      if (!phoneNumber || !ticketId) {
        return Promise.resolve([]);
      }

      return fetchCustomerSupportMessages({
        data: {
          phoneNumber,
          ticketId,
        },
      });
    },
    enabled: !!customerSession?.phoneNumber && !!supportActiveTicketId,
    refetchInterval: customerSession?.phoneNumber && supportActiveTicketId ? 4_000 : false,
    refetchIntervalInBackground: true,
  });
  const supportTickets = supportTicketsQuery.data ?? [];
  const supportMessages = supportMessagesQuery.data ?? [];
  const supportActiveTicket = supportTickets.find((ticket) => ticket.id === supportActiveTicketId) ?? null;
  const supportUnreadCount = supportTickets.filter((ticket) => ticket.lastSenderType === "admin" && ticket.status === "open").length;
  const supportHasAdminUnread = supportActiveTicket?.lastSenderType === "admin";
  const isSupportPanelActive = Boolean(customerSession && customerPanelView === "support");
  const supportMessagesWithDateMarkers = useMemo(() => {
    const rows: Array<{ type: "date" | "message"; key: string; label?: string; message?: (typeof supportMessages)[number] }> = [];
    let previousDateKey: string | null = null;

    supportMessages.forEach((message) => {
      const date = new Date(message.createdAt);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (dateKey !== previousDateKey) {
        rows.push({
          type: "date",
          key: `date-${dateKey}`,
          label: date.toLocaleDateString(language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-US", {
            weekday: "short",
            day: "numeric",
            month: "short",
          }),
        });
        previousDateKey = dateKey;
      }

      rows.push({ type: "message", key: `message-${message.id}`, message });
    });

    return rows;
  }, [language, supportMessages]);
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
  const pushCustomerId =
    typeof customerProfileQuery.data?.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerProfileQuery.data.id)
      ? customerProfileQuery.data.id
      : null;

  usePushNotifications({
    enabled: Boolean(customerSession?.phoneNumber),
    role: "customer",
    userId: pushCustomerId,
    locationLabel: selectedNeighborhoodOption?.name ?? selectedNeighborhoodId ?? null,
  });

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideDesktopSearch = searchContainerRef.current?.contains(target);
      const insideMobileInlineSearch = mobileSearchContainerRef.current?.contains(target);
      const insideMobileStickySearch = mobileStickySearchRef.current?.contains(target);

      if (!insideDesktopSearch && !insideMobileInlineSearch && !insideMobileStickySearch) {
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
    if (customerPanelView !== "support") return;
    if (supportActiveTicketId) return;
    if (supportTickets.length === 0) return;
    setSupportActiveTicketId(supportTickets[0]?.id ?? null);
  }, [customerPanelView, supportActiveTicketId, supportTickets]);

  useEffect(() => {
    if (customerPanelView !== "support" || !customerSession?.phoneNumber) return;

    const ticketsChannel = supabase
      .channel(`customer-support-tickets-${customerSession.phoneNumber}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["customer", "support", "tickets", customerSession.phoneNumber] });
      })
      .subscribe();

    const messagesChannel = supabase
      .channel(`customer-support-messages-${customerSession.phoneNumber}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["customer", "support", "tickets", customerSession.phoneNumber] });
        if (supportActiveTicketId) {
          void queryClient.invalidateQueries({
            queryKey: ["customer", "support", "messages", customerSession.phoneNumber, supportActiveTicketId],
          });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ticketsChannel);
      void supabase.removeChannel(messagesChannel);
    };
  }, [customerPanelView, customerSession?.phoneNumber, queryClient, supportActiveTicketId]);

  useEffect(() => {
    if (!supportMessagesScrollRef.current) return;
    supportMessagesScrollRef.current.scrollTop = supportMessagesScrollRef.current.scrollHeight;
  }, [supportMessages, supportIsTyping]);

  useEffect(() => {
    if (supportNotificationTicketRef.current !== supportActiveTicketId) {
      supportNotificationTicketRef.current = supportActiveTicketId;
      const latestAdminMessage = [...supportMessages]
        .reverse()
        .find((message) => message.senderType === "admin");
      lastNotifiedSupportMessageIdRef.current = latestAdminMessage ? String(latestAdminMessage.id) : null;
      if (supportToastTimerRef.current) {
        window.clearTimeout(supportToastTimerRef.current);
        supportToastTimerRef.current = null;
      }
      setSupportFloatingNotification(null);
    }

    if (customerPanelView !== "support") return;
    if (!supportActiveTicketId) return;
    const latestMessage = supportMessages[supportMessages.length - 1];
    if (!latestMessage || latestMessage.senderType !== "admin") return;

    if (!primedSupportToastTicketsRef.current.has(supportActiveTicketId)) {
      const latestAdminMessage = [...supportMessages]
        .reverse()
        .find((message) => message.senderType === "admin");
      lastNotifiedSupportMessageIdRef.current = latestAdminMessage ? String(latestAdminMessage.id) : null;
      primedSupportToastTicketsRef.current.add(supportActiveTicketId);
      return;
    }

    const latestMessageId = String(latestMessage.id ?? "");
    if (!latestMessageId) return;
    if (lastNotifiedSupportMessageIdRef.current === latestMessageId) return;

    lastNotifiedSupportMessageIdRef.current = latestMessageId;
    setSupportFloatingNotification(
      language === "ar" ? "رد جديد من الدعم" : language === "fr" ? "Nouvelle réponse du support" : "New support reply",
    );

    if (supportToastTimerRef.current) {
      window.clearTimeout(supportToastTimerRef.current);
    }

    supportToastTimerRef.current = window.setTimeout(() => {
      setSupportFloatingNotification(null);
      supportToastTimerRef.current = null;
    }, 1800);
  }, [customerPanelView, language, supportActiveTicketId, supportMessages]);

  useEffect(() => {
    return () => {
      if (supportToastTimerRef.current) {
        window.clearTimeout(supportToastTimerRef.current);
        supportToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!customerSession?.phoneNumber) return;

    const ordersChannel = supabase
      .channel(`customer-orders-${customerSession.phoneNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `customer_phone=eq.${customerSession.phoneNumber}` },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new && typeof (payload.new as { id?: unknown }).id === "string") {
            queryClient.setQueryData(
              ["customer", "orders", customerSession.phoneNumber],
              (current: Array<Record<string, unknown>> | undefined) => {
                if (!Array.isArray(current)) return current;
                const updatedId = (payload.new as { id: string }).id;
                return current.map((order) =>
                  String(order.id ?? "") === updatedId
                    ? {
                        ...order,
                        ...(payload.new as Record<string, unknown>),
                      }
                    : order,
                );
              },
            );
          }

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
        ["in_delivery", "delivering", "out_for_delivery", "picked_up", "on_the_way", "delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor", "completed"].includes(
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
    if (!selectedCommuneId) {
      return t("header.locationFallback");
    }

    if (!selectedCommune) {
      return t("header.locationFallback");
    }

    return getLocalizedCommuneName(selectedCommune);
  }, [getLocalizedCommuneName, selectedCommune, selectedCommuneId, t]);

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
      description: getLocalizedText(
        {
          en: pack.description,
          fr: pack.descriptionFr ?? (pack as { description_fr?: string | null }).description_fr,
          ar: pack.descriptionAr ?? (pack as { description_ar?: string | null }).description_ar,
        },
        pack.description ?? "",
      ),
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

  const subscriptionSectionCopy = useMemo(() => {
    if (language === "ar") {
      return {
        eyebrow: "خطط التوفير",
        title: "باقات التوفير",
        emptyTitle: "لا توجد باقات اشتراك متاحة حاليًا.",
        emptySubtitle: "ستظهر باقات التوفير المدفوعة مسبقًا هنا قريبًا.",
        bestValue: "أفضل قيمة",
        fallbackDescription: "منتجات موسمية طازجة تُسلَّم إلى باب منزلك",
        subscribe: "اشترك",
        pending: "قيد المراجعة",
        paused: "متوقف",
        pricingPrefix: "/",
        packAltSuffix: "باقة اشتراك",
      };
    }

    if (language === "fr") {
      return {
        eyebrow: "Plans premium",
        title: "Abonnements Économies",
        emptyTitle: "Aucun pack d'abonnement disponible pour le moment.",
        emptySubtitle: "Les packs prépayés apparaîtront ici prochainement.",
        bestValue: "Meilleure offre",
        fallbackDescription: "Produits saisonniers frais livrés à votre porte",
        subscribe: "S’abonner",
        pending: "En attente",
        paused: "En pause",
        pricingPrefix: "/",
        packAltSuffix: "pack d’abonnement",
      };
    }

    return {
      eyebrow: "Premium plans",
      title: "Saving Subscriptions",
      emptyTitle: "No subscription packs available yet.",
      emptySubtitle: "New prepaid savings packs will appear here soon.",
      bestValue: "Best value",
      fallbackDescription: "Fresh seasonal essentials delivered to your door",
      subscribe: "Subscribe",
      pending: "Pending",
      paused: "Paused",
      pricingPrefix: "/",
      packAltSuffix: "subscription pack",
    };
  }, [language]);

  const homepageUiCopy = useMemo(() => {
    if (language === "ar") {
      return {
        currency: "د.م",
        noSearchResults: "لم يتم العثور على منتجات",
        categoriesEmptySubtitle: "نُحضّر كتالوج حيك الآن.",
        productsEmptySubtitle: "جرّب تغيير الفئة أو عبارة البحث.",
        brandSlogan: "طازج. محلي. ليك.",
        flashTitle: "عروض اليوم",
        flashSubtitle: "عروض يومية طازجة",
        viewAll: "عرض الكل",
      };
    }

    if (language === "fr") {
      return {
        currency: "MAD",
        noSearchResults: "Aucun produit trouvé",
        categoriesEmptySubtitle: "Nous préparons le catalogue de votre quartier.",
        productsEmptySubtitle: "Essayez de changer la catégorie ou la recherche.",
        brandSlogan: "Frais. Local. Pour vous.",
        flashTitle: "Offres du jour",
        flashSubtitle: "Promos fraîches quotidiennes",
        viewAll: "Voir tout",
      };
    }

    return {
      currency: "MAD",
      noSearchResults: "No products found",
      categoriesEmptySubtitle: "We’re preparing your neighborhood catalog.",
      productsEmptySubtitle: "Try changing category or search terms.",
      brandSlogan: "Fresh. Local. Yours.",
      flashTitle: "Today’s Deals",
      flashSubtitle: "Fresh daily flash deals",
      viewAll: "View all",
    };
  }, [language]);

  const customerUiCopy = useMemo(() => {
    if (language === "ar") {
      return {
        orderPlaced: "تم إنشاء الطلب",
        preparing: "قيد التحضير",
        outForDelivery: "في طريقه للتوصيل",
        delivered: "تم التسليم",
        statusPendingReview: "قيد المراجعة",
        statusActive: "نشط",
        statusFinished: "مكتمل",
        statusPaused: "متوقف",
        statusExpired: "منتهي",
        statusCancelled: "ملغي",
        toastSelectLocationFirst: "اختَر موقع التوصيل أولاً.",
        toastAddedToCart: "تمت الإضافة إلى السلة",
        toastLoginRequired: "تسجيل الدخول مطلوب قبل إتمام الطلب.",
        toastAccountRestricted: "تم تقييد الحساب بسبب مخالفة السياسات. تواصل مع الدعم.",
        toastPleaseLoginFirst: "يرجى تسجيل الدخول أولاً.",
        toastEnterFullName: "يرجى إدخال الاسم الكامل.",
        toastOrderConfirmed: "تم تأكيد الطلب بنجاح.",
        toastOrderFailed: "تعذر تأكيد الطلب. حاول مرة أخرى.",
        toastSelectCommuneNeighborhood: "يرجى اختيار الجماعة والحي.",
        toastInvalidLocation: "اختيار الموقع غير صالح. حاول مجددًا.",
        toastLocationSyncFailed: "تم حفظ الموقع محليًا لكن فشلت المزامنة السحابية. حاول مرة أخرى.",
        toastLocationSaved: "تم حفظ موقع التوصيل.",
        toastCompleteProfile: "يرجى إكمال بيانات الحساب أولاً.",
        toastProfileUpdated: "تم تحديث الحساب.",
        toastProfileUpdateFailed: "تعذر تحديث الحساب.",
        account: "الحساب",
        welcomeBack: "مرحبًا بعودتك",
        signedIn: "أنت مسجل الدخول حاليًا.",
        enterPhoneToContinue: "أدخل رقم هاتفك للمتابعة",
        fullName: "الاسم الكامل",
        phoneNumber: "رقم الهاتف",
        address: "العنوان",
        fullNamePlaceholder: "أدخل اسمك الكامل",
        addressPlaceholder: "الشارع، العمارة، الشقة...",
        saveProfile: "حفظ الملف",
        backToAccount: "الرجوع إلى الحساب",
        mySubscriptions: "اشتراكاتي",
        loadingSubscriptions: "جارٍ تحميل الاشتراكات...",
        syncingSubscriptions: "جارٍ مزامنة حالة الاشتراك.",
        loadingOrders: "جارٍ تحميل الطلبات...",
        pleaseWait: "يرجى الانتظار قليلًا.",
        noOrdersYet: "لا توجد طلبات بعد.",
        orderHistoryHint: "سيظهر سجل الطلبات هنا بعد إتمام أول طلب.",
        activeOrders: "الطلبات النشطة",
        orderHistory: "سجل الطلبات",
        openDigitalReceipt: "فتح الفاتورة الرقمية",
        unpaidCarnet: "غير مدفوع / كارني",
        items: "منتجات",
        deliveries: "توصيلات",
        awaitingApproval: "بانتظار موافقة المنصة قبل التفعيل.",
        activeTracking: "الاشتراك نشط ويتم تتبع التوصيلات مباشرة.",
        loadingCarnet: "جارٍ تحميل الكارني...",
        fetchingCarnet: "جارٍ جلب آخر تفاصيل السجل.",
        noCarnet: "لا يوجد كارني نشط لهذا الحساب.",
        askVendorCarnet: "اطلب من البائع تفعيل الكارني لرقمك.",
        transactionHistory: "سجل المعاملات",
        noTransactions: "لا توجد معاملات كارني بعد.",
        sending: "جارٍ الإرسال...",
        sendCodeWhatsapp: "إرسال الرمز عبر واتساب",
        enterOtp: "أدخل رمز 4 أرقام المرسل عبر واتساب",
        verifying: "جارٍ التحقق...",
        verifyLogin: "تأكيد وتسجيل الدخول",
        changePhone: "تغيير رقم الهاتف",
        selectDeliveryLocation: "حدد موقع التوصيل",
        locationHint: "اختر الجماعة الترابية والحي قبل الطلب.",
        communeLabel: "الجماعة الترابية",
        neighborhoodLabel: "الحي / الدوار",
        searchCommunePlaceholder: "ابحث عن الجماعة...",
        searchDouarPlaceholder: "ابحث عن الحي...",
        selectCommuneFirst: "اختر جماعة أولًا.",
        startTyping: "ابدأ بالكتابة للبحث...",
        loadingCommunes: "جارٍ تحميل الجماعات...",
        noCommune: "لم يتم العثور على جماعة.",
        loadingDouars: "جارٍ تحميل الأحياء...",
        noDouar: "لم يتم العثور على حي في هذه الجماعة.",
        deliveryFeeHint: "سيتم إضافة هذا الرسم إلى الإجمالي النهائي.",
        closeModal: "إغلاق نافذة اختيار الموقع",
        confirmLocation: "تأكيد الموقع",
        scannerPermissionDenied: "يرجى السماح باستخدام الكاميرا لمسح رمز الطلب.",
        scannerCameraUnavailable: "تعذر فتح الكاميرا. حاول مرة أخرى.",
        scannerPointToQr: "وجّه الكاميرا نحو رمز QR الخاص بالطلب.",
        scannerSuccess: "تم التعرّف على الطلب بنجاح",
        scannerInvalidQr: "رمز QR غير صالح",
        scannerOrderNotFound: "الطلب غير موجود",
      };
    }

    if (language === "fr") {
      return {
        orderPlaced: "Commande créée",
        preparing: "Préparation",
        outForDelivery: "En livraison",
        delivered: "Livrée",
        statusPendingReview: "En attente de validation",
        statusActive: "Actif",
        statusFinished: "Terminé",
        statusPaused: "En pause",
        statusExpired: "Expiré",
        statusCancelled: "Annulé",
        toastSelectLocationFirst: "Sélectionnez d'abord votre zone de livraison.",
        toastAddedToCart: "Ajouté au panier",
        toastLoginRequired: "Connexion requise avant le paiement.",
        toastAccountRestricted: "Votre compte est restreint. Veuillez contacter le support.",
        toastPleaseLoginFirst: "Veuillez vous connecter d'abord.",
        toastEnterFullName: "Veuillez saisir votre nom complet.",
        toastOrderConfirmed: "Commande confirmée avec succès.",
        toastOrderFailed: "Impossible de confirmer la commande. Réessayez.",
        toastSelectCommuneNeighborhood: "Veuillez sélectionner la commune et le quartier.",
        toastInvalidLocation: "Sélection de zone invalide. Réessayez.",
        toastLocationSyncFailed: "Zone enregistrée localement, mais synchronisation cloud échouée.",
        toastLocationSaved: "Zone de livraison enregistrée.",
        toastCompleteProfile: "Complétez d'abord les informations du profil.",
        toastProfileUpdated: "Profil mis à jour.",
        toastProfileUpdateFailed: "Échec de la mise à jour du profil.",
        account: "Compte",
        welcomeBack: "Bon retour",
        signedIn: "Vous êtes actuellement connecté.",
        enterPhoneToContinue: "Entrez votre numéro pour continuer",
        fullName: "Nom complet",
        phoneNumber: "Numéro de téléphone",
        address: "Adresse",
        fullNamePlaceholder: "Entrez votre nom complet",
        addressPlaceholder: "Rue, immeuble, appartement...",
        saveProfile: "Enregistrer le profil",
        backToAccount: "Retour au compte",
        mySubscriptions: "Mes abonnements",
        loadingSubscriptions: "Chargement des abonnements...",
        syncingSubscriptions: "Synchronisation du statut du contrat.",
        loadingOrders: "Chargement des commandes...",
        pleaseWait: "Veuillez patienter un instant.",
        noOrdersYet: "Aucune commande pour le moment.",
        orderHistoryHint: "Votre historique apparaîtra ici après votre premier achat.",
        activeOrders: "Commandes actives",
        orderHistory: "Historique des commandes",
        openDigitalReceipt: "Ouvrir le reçu numérique",
        unpaidCarnet: "Impayé / Carnet",
        items: "articles",
        deliveries: "livraisons",
        awaitingApproval: "En attente d'approbation avant activation.",
        activeTracking: "Abonnement actif — livraisons suivies en direct.",
        loadingCarnet: "Chargement du carnet...",
        fetchingCarnet: "Récupération des derniers détails du registre.",
        noCarnet: "Aucun carnet actif pour ce compte.",
        askVendorCarnet: "Demandez au vendeur d'activer l'accès carnet.",
        transactionHistory: "Historique des transactions",
        noTransactions: "Aucune transaction carnet pour le moment.",
        sending: "Envoi...",
        sendCodeWhatsapp: "Envoyer le code via WhatsApp",
        enterOtp: "Entrez le code à 4 chiffres reçu sur WhatsApp",
        verifying: "Vérification...",
        verifyLogin: "Vérifier et se connecter",
        changePhone: "Changer le numéro",
        selectDeliveryLocation: "Sélectionnez votre zone de livraison",
        locationHint: "Choisissez votre commune et quartier avant de commander.",
        communeLabel: "Commune",
        neighborhoodLabel: "Hay / Douar",
        searchCommunePlaceholder: "Rechercher une commune...",
        searchDouarPlaceholder: "Rechercher un quartier...",
        selectCommuneFirst: "Sélectionnez d'abord une commune.",
        startTyping: "Commencez à taper pour rechercher...",
        loadingCommunes: "Chargement des communes...",
        noCommune: "Aucune commune trouvée.",
        loadingDouars: "Chargement des quartiers...",
        noDouar: "Aucun quartier trouvé dans cette commune.",
        deliveryFeeHint: "Ces frais seront ajoutés au total de la commande.",
        closeModal: "Fermer la fenêtre de sélection de zone",
        confirmLocation: "Confirmer la zone",
        scannerPermissionDenied: "Veuillez autoriser la caméra pour scanner le code de commande.",
        scannerCameraUnavailable: "Impossible d’ouvrir la caméra. Veuillez réessayer.",
        scannerPointToQr: "Pointez votre caméra vers le QR de la commande.",
        scannerSuccess: "Commande détectée avec succès",
        scannerInvalidQr: "Code QR invalide",
        scannerOrderNotFound: "Commande introuvable",
      };
    }

    return {
      orderPlaced: "Order Placed",
      preparing: "Preparing",
      outForDelivery: "Out for Delivery",
      delivered: "Delivered",
      statusPendingReview: "Pending Admin Review",
      statusActive: "Active",
      statusFinished: "Subscription finished",
      statusPaused: "Paused",
      statusExpired: "Expired",
      statusCancelled: "Cancelled",
      toastSelectLocationFirst: "Select your delivery location first.",
      toastAddedToCart: "Added to cart",
      toastLoginRequired: "Login is required before checkout.",
      toastAccountRestricted: "Your account has been restricted due to policy violations. Please contact support.",
      toastPleaseLoginFirst: "Please login first.",
      toastEnterFullName: "Please enter your full name.",
      toastOrderConfirmed: "Order confirmed successfully.",
      toastOrderFailed: "Failed to confirm order. Please try again.",
      toastSelectCommuneNeighborhood: "Please select both commune and neighborhood.",
      toastInvalidLocation: "Invalid location selection. Please try again.",
      toastLocationSyncFailed: "Location saved locally, but cloud sync failed. Please retry.",
      toastLocationSaved: "Delivery location saved.",
      toastCompleteProfile: "Please complete profile details first.",
      toastProfileUpdated: "Profile updated.",
      toastProfileUpdateFailed: "Failed to update profile.",
      account: "Account",
      welcomeBack: "Welcome Back",
      signedIn: "You are currently signed in.",
      enterPhoneToContinue: "Enter your phone number to continue",
      fullName: "Full Name",
      phoneNumber: "Phone Number",
      address: "Address",
      fullNamePlaceholder: "Enter your full name",
      addressPlaceholder: "Street, building, apartment...",
      saveProfile: "Save Profile",
      backToAccount: "Back to Account",
      mySubscriptions: "My Subscriptions",
      loadingSubscriptions: "Loading subscriptions...",
      syncingSubscriptions: "Syncing your contract status.",
      loadingOrders: "Loading your orders...",
      pleaseWait: "Please wait a moment.",
      noOrdersYet: "No orders yet.",
      orderHistoryHint: "Your order history will appear here after checkout.",
      activeOrders: "Active Orders",
      orderHistory: "Order History",
      openDigitalReceipt: "Open digital receipt",
      unpaidCarnet: "Unpaid / Carnet",
      items: "items",
      deliveries: "deliveries",
      awaitingApproval: "Awaiting platform approval before activation.",
      activeTracking: "Subscription active — deliveries are being tracked live.",
      loadingCarnet: "Loading your carnet...",
      fetchingCarnet: "Fetching your latest ledger details.",
      noCarnet: "No active carnet found for your account.",
      askVendorCarnet: "Ask your vendor to enable carnet access for your phone number.",
      transactionHistory: "Transaction History",
      noTransactions: "No carnet transactions yet.",
      sending: "Sending...",
      sendCodeWhatsapp: "Send Code via WhatsApp",
      enterOtp: "Enter the 4-digit code sent to WhatsApp",
      verifying: "Verifying...",
      verifyLogin: "Verify & Login",
      changePhone: "Change phone number",
      selectDeliveryLocation: "Select Your Delivery Location",
      locationHint: "Choose your Jamaa Tourabiya and Hay / Douar before placing orders.",
      communeLabel: "Jamaa Tourabiya",
      neighborhoodLabel: "Hay / Douar",
      searchCommunePlaceholder: "Search commune...",
      searchDouarPlaceholder: "Search neighborhood...",
      selectCommuneFirst: "Select a commune first.",
      startTyping: "Start typing to search...",
      loadingCommunes: "Loading communes...",
      noCommune: "No commune found.",
      loadingDouars: "Loading neighborhoods...",
      noDouar: "No neighborhood found in this commune.",
      deliveryFeeHint: "This fee will be added to your total.",
      closeModal: "Close location selection",
      confirmLocation: "Confirm Location",
      scannerPermissionDenied: "Please allow camera access to scan the order QR code.",
      scannerCameraUnavailable: "Unable to open camera. Please try again.",
      scannerPointToQr: "Point your camera at the order QR code.",
      scannerSuccess: "Order detected successfully",
      scannerInvalidQr: "Invalid QR code",
      scannerOrderNotFound: "Order not found",
    };
  }, [language]);

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
    const interval = setInterval(() => {
      if (scrollContainerRef.current && !isInteracting) {
        const { scrollWidth, clientWidth } = scrollContainerRef.current;
        const { traveled } = getScrollTravelDistance(scrollContainerRef.current);
        const cardWidth = 180 + 12;
        const scrollStep = isArabic ? -cardWidth : cardWidth;

        if (traveled + clientWidth >= scrollWidth - 10) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scrollContainerRef.current.scrollBy({ left: scrollStep, behavior: "smooth" });
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isArabic, isInteracting]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (subScrollRef.current && !isSubInteracting) {
        const { scrollWidth, clientWidth } = subScrollRef.current;
        const { traveled } = getScrollTravelDistance(subScrollRef.current);
        const cardWidth = 280 + 16;
        const scrollStep = isArabic ? -cardWidth : cardWidth;

        if (traveled + clientWidth >= scrollWidth - 10) {
          subScrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          subScrollRef.current.scrollBy({ left: scrollStep, behavior: "smooth" });
        }
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isArabic, isSubInteracting]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (bannerScrollRef.current && !isBannerInteracting) {
        const { scrollWidth, clientWidth } = bannerScrollRef.current;
        const { traveled } = getScrollTravelDistance(bannerScrollRef.current);
        const scrollStep = isArabic ? -clientWidth : clientWidth;

        if (traveled + clientWidth >= scrollWidth - 5) {
          bannerScrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          bannerScrollRef.current.scrollBy({ left: scrollStep, behavior: "smooth" });
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isArabic, isBannerInteracting]);

  useEffect(() => {
    if (!isMobile || typeof window === "undefined") {
      setMobileHeroScrollProgress(0);
      setIsMobileSearchSticky(false);
      return;
    }

    let rafId = 0;
    let ticking = false;
    const stickyThreshold = 84;

    const syncHeroProgress = () => {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const nextProgress = Math.min(1, Math.max(0, y / 120));
        const searchAnchorTop = mobileSearchAnchorRef.current?.getBoundingClientRect().top ?? 9999;
        const nextSticky = searchAnchorTop <= stickyThreshold;

        setMobileHeroScrollProgress((prev) => (Math.abs(prev - nextProgress) > 0.01 ? nextProgress : prev));
        setIsMobileSearchSticky((prev) => (prev === nextSticky ? prev : nextSticky));
        ticking = false;
      });
    };

    syncHeroProgress();
    window.addEventListener("scroll", syncHeroProgress, { passive: true });
    window.addEventListener("resize", syncHeroProgress);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", syncHeroProgress);
      window.removeEventListener("resize", syncHeroProgress);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !isCustomerAuthModalOpen || typeof window === "undefined") {
      setAuthKeyboardInset(0);
      setAuthSheetMaxHeight(null);
      setSupportViewportHeight(null);
      setAuthSheetCanScrollUp(false);
      setAuthSheetCanScrollDown(false);
      return;
    }

    const viewport = window.visualViewport;

    const syncSheetViewport = () => {
      const layoutHeight = window.innerHeight;
      const visualHeight = viewport?.height ?? layoutHeight;
      const visualTop = viewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(0, layoutHeight - (visualHeight + visualTop));
      const topGap = Math.round(layoutHeight * 0.15);
      const boundedHeight = Math.max(320, Math.round(visualHeight - topGap));

      setAuthKeyboardInset(Math.round(keyboardInset));
      setAuthSheetMaxHeight(boundedHeight);
      setSupportViewportHeight(Math.max(320, Math.round(visualHeight)));
    };

    syncSheetViewport();

    if (viewport) {
      viewport.addEventListener("resize", syncSheetViewport);
      viewport.addEventListener("scroll", syncSheetViewport);
    }
    window.addEventListener("resize", syncSheetViewport);

    return () => {
      if (viewport) {
        viewport.removeEventListener("resize", syncSheetViewport);
        viewport.removeEventListener("scroll", syncSheetViewport);
      }
      window.removeEventListener("resize", syncSheetViewport);
    };
  }, [isCustomerAuthModalOpen, isMobile, customerPanelView]);

  useEffect(() => {
    if (!isMobile || !isCustomerAuthModalOpen) return;

    const scrollElement = authSheetScrollRef.current;
    if (!scrollElement) return;

    const syncGlow = () => updateAuthSheetScrollState(scrollElement);
    syncGlow();
    scrollElement.addEventListener("scroll", syncGlow, { passive: true });
    window.addEventListener("resize", syncGlow);

    return () => {
      scrollElement.removeEventListener("scroll", syncGlow);
      window.removeEventListener("resize", syncGlow);
    };
  }, [authKeyboardInset, authStep, customerPanelView, customerSession, isCustomerAuthModalOpen, isMobile]);

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
    { label: customerUiCopy.orderPlaced, statuses: ["pending", "new"] },
    { label: customerUiCopy.preparing, statuses: ["preparing", "ready", "accepted", "processing"] },
    {
      label: customerUiCopy.outForDelivery,
      statuses: ["in_delivery", "in_transit", "out_for_delivery", "picked_up", "on_the_way", "delivering"],
    },
    {
      label: customerUiCopy.delivered,
      statuses: ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor", "completed"],
    },
  ];

  const deliveredStatuses = new Set(statusSteps[3].statuses);

  const getOrderStepIndex = (status: string) => {
    const normalizedStatus = String(status ?? "").trim().toLowerCase();
    const index = statusSteps.findIndex((step) => step.statuses.includes(normalizedStatus));
    return index < 0 ? 0 : index;
  };

  const isDeliveredOrderStatus = (status: string) => deliveredStatuses.has(String(status ?? "").trim().toLowerCase());
  const isCarnetUnpaidOrder = (paymentMethod: string | null | undefined) => {
    const normalized = String(paymentMethod ?? "").trim().toLowerCase();
    return normalized === "carnet" || normalized === "credit";
  };
  const getOrderGrandTotalMad = (order: {
    total_price?: unknown;
    delivery_fee?: unknown;
    extra_fees?: unknown;
    extra_fee?: unknown;
    service_fee?: unknown;
    additional_fee?: unknown;
  }) => {
    const subtotalMad = Number(order.total_price ?? 0);
    const deliveryFeeMad = Number(order.delivery_fee ?? 0);
    const extraFeesMad = [order.extra_fees, order.extra_fee, order.service_fee, order.additional_fee].reduce<number>((sum, fee) => {
      const parsed = Number(fee ?? 0);
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);

    return Math.round((subtotalMad + deliveryFeeMad + extraFeesMad) * 100) / 100;
  };

  const allCustomerOrders = customerOrdersQuery.data ?? [];
  const activeCustomerOrders = allCustomerOrders.filter((order) => !isDeliveredOrderStatus(order.status));
  const deliveredCustomerOrders = allCustomerOrders.filter((order) => isDeliveredOrderStatus(order.status));
  const resolveOrderIdFromScan = (decodedOrderToken: string, allowFallbackToLatestOrder: boolean): string | null => {
    const normalizedToken = normalizeScannedOrderToken(decodedOrderToken).toLowerCase();
    if (!normalizedToken) return null;

    const matchedOrder = allCustomerOrders.find((order) => {
      const orderId = String(order.id ?? "").trim().toLowerCase();
      const publicCode = toPublicOrderCode(order.id).replace("#", "").toLowerCase();
      const legacyShortOrderId = orderId.slice(0, 8);
      return normalizedToken === orderId || normalizedToken === publicCode || normalizedToken === legacyShortOrderId;
    });

    if (matchedOrder?.id) return matchedOrder.id;
    if (!allowFallbackToLatestOrder) return null;

    return activeCustomerOrders[0]?.id ?? allCustomerOrders[0]?.id ?? null;
  };

  const openOrderQrScanner = () => {
    setScannerStatusMessage(customerUiCopy.scannerPointToQr);
    setIsProcessingQrResult(false);
    setIsQrScannerOpen(true);
  };

  const openSupportCenter = () => {
    const activeOrder = activeCustomerOrders[0] ?? allCustomerOrders[0] ?? null;
    openSupportPanel({
      source: "home",
      orderId: activeOrder?.id ?? null,
      pickupCode: activeOrder?.id ? toPublicOrderCode(activeOrder.id) : null,
    });
  };

  const handleSupportAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(language === "ar" ? "الرجاء اختيار صورة فقط." : language === "fr" ? "Veuillez choisir une image." : "Please choose an image only.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    setIsSupportAttachmentUploading(true);
    reader.onload = () => {
      setSupportImageDataUrl(typeof reader.result === "string" ? reader.result : null);
      setIsSupportAttachmentUploading(false);
    };
    reader.onerror = () => {
      setIsSupportAttachmentUploading(false);
      toast.error(language === "ar" ? "تعذر تحميل الصورة." : language === "fr" ? "Impossible de charger l'image." : "Failed to load image.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const sendSupportMessageNow = async () => {
    if (!customerSession?.phoneNumber) return;

    const trimmedMessage = supportMessageInput.trim();
    const hasAttachment = Boolean(supportImageDataUrl);
    const attachmentOnlyFallback = language === "ar" ? "مرفق صورة" : language === "fr" ? "Image jointe" : "Image attached";

    if (!hasAttachment && trimmedMessage.length === 0) {
      return;
    }

    if (!supportActiveTicketId && !hasAttachment && trimmedMessage.length < 3) {
      toast.error(
        language === "ar"
          ? "الرسالة الأولى يجب أن تحتوي على 3 أحرف على الأقل."
          : language === "fr"
            ? "Le premier message doit contenir au moins 3 caractères."
            : "The first message must be at least 3 characters.",
      );
      return;
    }

    const initialTicketMessage = trimmedMessage.length >= 3 ? trimmedMessage : attachmentOnlyFallback;
    const followupMessage = trimmedMessage || attachmentOnlyFallback;

    try {
      setSupportIsTyping(true);
      if (!supportActiveTicketId) {
        const created = await createCustomerSupportTicket({
          data: {
            phoneNumber: customerSession.phoneNumber,
            subject:
              language === "ar"
                ? "طلب دعم جديد"
                : language === "fr"
                  ? "Nouvelle demande de support"
                  : "New support request",
            category: supportPriority === "high" ? "order_problem" : "other",
            message: initialTicketMessage,
            imageDataUrl: supportImageDataUrl,
            orderId: supportContext?.orderId ?? null,
          },
        });
        setSupportActiveTicketId(created.id);
      } else {
        await sendSupportMessage({
          data: {
            phoneNumber: customerSession.phoneNumber,
            ticketId: supportActiveTicketId,
            message: followupMessage,
            imageDataUrl: supportImageDataUrl,
          },
        });
      }

      setSupportMessageInput("");
      setSupportImageDataUrl(null);
      setSupportPriority("normal");
      await Promise.all([supportTicketsQuery.refetch(), supportMessagesQuery.refetch()]);
    } catch (error) {
      console.error("Failed to send support message:", error);
      toast.error(language === "ar" ? "تعذر إرسال الرسالة." : language === "fr" ? "Échec d'envoi du message." : "Failed to send message.");
    } finally {
      setSupportIsTyping(false);
    }
  };

  const handleScannedOrderNavigation = async (decodedText: string) => {
    const extractedOrderId = extractOrderIdentifierFromQrPayload(decodedText);
    const shouldUseFallback = shouldFallbackToLatestOrderFromQrPayload(decodedText);

    if (!extractedOrderId && shouldUseFallback) {
      const fallbackOrderId = activeCustomerOrders[0]?.id ?? allCustomerOrders[0]?.id ?? null;
      if (!fallbackOrderId) {
        toast.error(customerUiCopy.scannerOrderNotFound);
        return;
      }

      setIsProcessingQrResult(true);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(18);
      }
      toast.success(customerUiCopy.scannerSuccess);
      setIsQrScannerOpen(false);

      const goToReceipt = () => void navigate({ to: "/customer/order/$orderId", params: { orderId: fallbackOrderId } });
      const startViewTransition = (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition;
      if (typeof startViewTransition === "function") {
        startViewTransition(() => {
          goToReceipt();
        });
        return;
      }
      goToReceipt();
      return;
    }

    if (!extractedOrderId) {
      toast.error(customerUiCopy.scannerInvalidQr);
      return;
    }

    const resolvedOrderId = resolveOrderIdFromScan(extractedOrderId, shouldUseFallback);
    if (!resolvedOrderId) {
      toast.error(customerUiCopy.scannerOrderNotFound);
      return;
    }

    setIsProcessingQrResult(true);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(18);
    }

    toast.success(customerUiCopy.scannerSuccess);
    setIsQrScannerOpen(false);

    const goToReceipt = () => void navigate({ to: "/customer/order/$orderId", params: { orderId: resolvedOrderId } });
    const startViewTransition = (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition;

    if (typeof startViewTransition === "function") {
      startViewTransition(() => {
        goToReceipt();
      });
      return;
    }

    goToReceipt();
  };

  useEffect(() => {
    if (!isQrScannerOpen) return;

    let mounted = true;
    scannerMountedRef.current = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        const scanner = new Html5Qrcode("customer-order-qr-reader");
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            if (!scannerMountedRef.current || isProcessingQrResult) return;
            void handleScannedOrderNavigation(decodedText);
          },
          () => undefined,
        );
      } catch (error) {
        const message = String((error as Error)?.message ?? "").toLowerCase();
        const denied =
          message.includes("notallowed") || message.includes("permission") || message.includes("denied") || message.includes("not readable");
        const nextMessage = denied ? customerUiCopy.scannerPermissionDenied : customerUiCopy.scannerCameraUnavailable;
        setScannerStatusMessage(nextMessage);
        toast.error(nextMessage);
      }
    };

    setScannerStatusMessage(customerUiCopy.scannerPointToQr);
    void startScanner();

    return () => {
      mounted = false;
      scannerMountedRef.current = false;
      const scanner = scannerInstanceRef.current;
      scannerInstanceRef.current = null;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            void scanner.clear().catch(() => undefined);
          });
      }
    };
  }, [customerUiCopy.scannerCameraUnavailable, customerUiCopy.scannerPermissionDenied, customerUiCopy.scannerPointToQr, isProcessingQrResult, isQrScannerOpen]);

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
    if (status === "pending") return customerUiCopy.statusPendingReview;
    if (status === "active") return customerUiCopy.statusActive;
    if (status === "completed") return customerUiCopy.statusFinished;
    if (status === "paused") return customerUiCopy.statusPaused;
    if (status === "expired") return customerUiCopy.statusExpired;
    return customerUiCopy.statusCancelled;
  };

  const addToCart = (product: Product, selectedVariant?: string | null) => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error(customerUiCopy.toastSelectLocationFirst);
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

    toast.success(customerUiCopy.toastAddedToCart, {
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
      toast.error(customerUiCopy.toastSelectLocationFirst);
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

    toast.success(customerUiCopy.toastAddedToCart, {
      description: deal.name,
      duration: 1400,
    });
  };

  const openCheckout = () => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error(customerUiCopy.toastSelectLocationFirst);
      return;
    }

    if (!customerSession?.phoneNumber) {
      closeCart();
      setIsCustomerAuthModalOpen(true);
      toast.error(customerUiCopy.toastLoginRequired);
      return;
    }

    const accountStatus = customerProfileQuery.data?.status;
    const isRestricted = accountStatus === "blocked" || accountStatus === "suspicious";
    if (isRestricted) {
      closeCart();
      toast.error(customerUiCopy.toastAccountRestricted);
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
      toast.error(customerUiCopy.toastPleaseLoginFirst);
      return;
    }

    const accountStatus = customerProfileQuery.data?.status;
    const isRestricted = accountStatus === "blocked" || accountStatus === "suspicious";
    if (isRestricted) {
      toast.error(customerUiCopy.toastAccountRestricted);
      return;
    }

    if (!fullName.trim()) {
      toast.error(customerUiCopy.toastEnterFullName);
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
      toast.success(customerUiCopy.toastOrderConfirmed);
    } catch (error) {
      console.error("Failed to confirm order:", error);
      toast.error(customerUiCopy.toastOrderFailed);
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
  const accountStatus = customerProfileQuery.data?.status;
  const isAccountRestricted = accountStatus === "blocked" || accountStatus === "suspicious";
  const accountRestrictionMessage = "Your account has been restricted due to policy violations. Please contact support.";

  const canConfirmOrder =
    !isSubmittingOrder &&
    !isCheckoutProfileHydrating &&
    !isAccountRestricted &&
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
      alt:
        language === "ar"
          ? "بانر عرض ترويجي"
          : language === "fr"
            ? "Bannière promotionnelle"
            : "Promotional ad banner",
      headline:
        language === "ar"
          ? "عرض خاص"
          : language === "fr"
            ? "Offre spéciale"
            : "Special Offer",
      copy:
        ad.link_url
          ? language === "ar"
            ? "اضغط لاكتشاف هذا العرض"
            : language === "fr"
              ? "Touchez pour découvrir cette promotion"
              : "Tap to discover this promotion"
          : language === "ar"
            ? "عرض مميز"
            : language === "fr"
              ? "Promotion mise en avant"
              : "Featured promotion",
      tag: ad.campaign_type === "NEWS" ? "Featured" : "AD",
    })) || [];
  const displayAdSlides = dynamicAdSlides.length > 0 ? dynamicAdSlides : adSlides;
  const activeHeroSection = activeHeroSectionQuery.data as any;
  const localizedHeroBadge = getLocalizedText(
    { en: activeHeroSection?.badge_en ?? activeHeroSection?.greeting_en, fr: activeHeroSection?.badge_fr ?? activeHeroSection?.greeting_fr, ar: activeHeroSection?.badge_ar ?? activeHeroSection?.greeting_ar },
    activeHeroSection?.badge_en ?? activeHeroSection?.greeting_en ?? "Bicycle delivery across Morocco",
  );
  const localizedHeroTitle = getLocalizedText(
    { en: activeHeroSection?.title_en ?? activeHeroSection?.headline_en, fr: activeHeroSection?.title_fr ?? activeHeroSection?.headline_fr, ar: activeHeroSection?.title_ar ?? activeHeroSection?.headline_ar },
    activeHeroSection?.title_en ?? activeHeroSection?.headline_en ?? "Fresh groceries, delivered in 15 min",
  );
  const localizedHeroSubtitle = getLocalizedText(
    { en: activeHeroSection?.subtitle_en ?? activeHeroSection?.description_en, fr: activeHeroSection?.subtitle_fr ?? activeHeroSection?.description_fr, ar: activeHeroSection?.subtitle_ar ?? activeHeroSection?.description_ar },
    activeHeroSection?.subtitle_en ?? activeHeroSection?.description_en ?? "Local produce, fast riders, and trusted vendors near you.",
  );
  const localizedHeroCta = getLocalizedText(
    { en: activeHeroSection?.cta_text_en, fr: activeHeroSection?.cta_text_fr, ar: activeHeroSection?.cta_text_ar },
    activeHeroSection?.cta_text_en ?? "Start shopping",
  );
  const localizedHeroDeliveryTiming = getLocalizedText(
    { en: activeHeroSection?.delivery_timing_en, fr: activeHeroSection?.delivery_timing_fr, ar: activeHeroSection?.delivery_timing_ar },
    activeHeroSection?.delivery_timing_en ?? "Avg. delivery: 18 min",
  );
  const heroImageUrl = activeHeroSection?.image_url || fallbackProductImage;

  const saveLocationSelection = async () => {
    if (!selectedCommuneId || !selectedNeighborhoodId) {
      toast.error(customerUiCopy.toastSelectCommuneNeighborhood);
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
      toast.error(customerUiCopy.toastInvalidLocation);
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
        toast.error(customerUiCopy.toastLocationSyncFailed);
      }
    }

    setIsLocationModalOpen(false);
    toast.success(customerUiCopy.toastLocationSaved);
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

  const renderSupportPanel = () => {
    const supportTitle = language === "ar" ? "مركز الدعم" : language === "fr" ? "Centre d’assistance" : "Support Center";
    const supportSubtitle =
      language === "ar"
        ? "دردشة مباشرة مع فريق الدعم"
        : language === "fr"
          ? "Chat en direct avec l’équipe support"
          : "Live chat with the support team";
    const supportSendDisabled =
      isSupportAttachmentUploading ||
      supportIsTyping ||
      (!supportImageDataUrl && (supportActiveTicketId ? supportMessageInput.trim().length === 0 : supportMessageInput.trim().length < 3));

    return (
      <section className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden bg-card/90 backdrop-blur-xl md:my-3 md:rounded-3xl md:border md:border-border/70 md:shadow-xl">
        <header className="sticky top-0 z-50 shrink-0 border-b border-border/60 bg-background/92 px-4 pb-3 pt-3 backdrop-blur md:px-5">
          <div className={`flex items-center justify-between gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
            <div className={`flex min-w-0 items-center gap-2.5 ${isArabic ? "flex-row-reverse" : ""}`}>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-sm">
                <Headset className="size-4" />
              </span>
              <div className={`min-w-0 ${isArabic ? "text-right" : "text-left"}`}>
                <p className="truncate text-sm font-semibold text-foreground">{supportTitle}</p>
                <div className={`mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground ${isArabic ? "flex-row-reverse" : ""}`}>
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.12)]" aria-hidden="true" />
                  <span>{language === "ar" ? "الدعم متصل" : language === "fr" ? "Support en ligne" : "Support online"}</span>
                </div>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
              {supportUnreadCount > 0 ? <Badge className="rounded-full bg-primary/15 text-primary">{supportUnreadCount}</Badge> : null}
              <div className={`inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-gradient-to-r from-success/20 via-success/12 to-primary/12 px-3 py-1 text-[11px] font-medium text-success shadow-[0_8px_18px_-14px_hsl(var(--success)/0.95)] ${isArabic ? "flex-row-reverse" : ""}`}>
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
                <span>{language === "ar" ? "الدعم المباشر" : language === "fr" ? "Support en direct" : "LIVE SUPPORT"}</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 p-1 shadow-sm backdrop-blur ${isArabic ? "flex-row-reverse" : ""}`}>
              <Button
                type="button"
                size="icon"
                variant="soft"
                className="h-10 w-10 rounded-full border border-border/70 bg-background/80 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-md active:translate-y-0 active:scale-[0.97] active:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => setCustomerPanelView("account")}
                aria-label={language === "ar" ? "الرجوع" : language === "fr" ? "Retour" : "Back"}
              >
                <ChevronLeft className={`size-4 ${isArabic ? "rotate-180" : ""}`} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="soft"
                className="h-10 w-10 rounded-full border border-border/70 bg-background/80 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-md active:translate-y-0 active:scale-[0.97] active:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => {
                  setIsCustomerAuthModalOpen(false);
                  setCustomerPanelView("account");
                  void navigate({ to: "/customer" });
                }}
                aria-label={language === "ar" ? "العودة للرئيسية" : language === "fr" ? "Retour à l'accueil" : "Back to homepage"}
              >
                <House className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full border border-border/70 bg-background/80 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-md active:translate-y-0 active:scale-[0.97] active:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => setIsCustomerAuthModalOpen(false)}
                aria-label={language === "ar" ? "إغلاق" : language === "fr" ? "Fermer" : "Close"}
              >
                <X className="size-4" />
              </Button>
              </div>
            </div>
          </div>

          <div className={`mt-2 text-xs text-muted-foreground ${isArabic ? "text-right" : "text-left"}`}>{supportSubtitle}</div>

          {supportContext?.orderId ? (
            <div className={`mt-2 flex flex-wrap gap-2 ${isArabic ? "justify-end" : ""}`}>
              <Badge variant="outline" className="h-8 rounded-full px-3 text-[11px] font-semibold tracking-wide">#{supportContext.orderId.slice(0, 8).toUpperCase()}</Badge>
              {supportContext.pickupCode ? <Badge className="h-8 rounded-full bg-primary/10 px-3 text-[11px] font-medium text-primary">{supportContext.pickupCode}</Badge> : null}
              {supportActiveTicket?.status ? <Badge variant="secondary" className="h-8 rounded-full px-3 text-[11px] font-medium">{supportActiveTicket.status}</Badge> : null}
            </div>
          ) : null}
        </header>

        {supportTickets.length > 0 ? (
          <section className="border-b border-border/50 bg-background/65 px-3 py-2 md:px-4">
            <div className={`no-scrollbar flex gap-1.5 overflow-x-auto ${isArabic ? "flex-row-reverse" : ""}`}>
              {supportTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSupportActiveTicketId(ticket.id)}
                  className={`min-w-fit rounded-full border px-3 py-1.5 text-xs transition ${
                    supportActiveTicketId === ticket.id
                      ? "border-primary/40 bg-primary/12 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {ticket.subject}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div ref={supportMessagesScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background/35 px-4 py-4 md:px-5 md:py-5">
          {supportMessagesQuery.isLoading ? (
            <AppEmptyState title={language === "ar" ? "جاري تحميل المحادثة..." : language === "fr" ? "Chargement de la conversation..." : "Loading conversation..."} className="p-4" />
          ) : supportMessagesWithDateMarkers.length === 0 ? (
            <div className="mx-auto flex max-w-sm flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/80 px-5 py-8 text-center">
              <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <MessageCircle className="size-5" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {language === "ar" ? "ابدأ محادثة جديدة" : language === "fr" ? "Commencez une nouvelle conversation" : "Start a new conversation"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {language === "ar"
                  ? "اكتب سؤالك أو أرسل صورة، وسيرد فريق الدعم بسرعة."
                  : language === "fr"
                    ? "Écrivez votre question ou envoyez une image, l’équipe répondra rapidement."
                    : "Write your question or share an image and our team will reply quickly."}
              </p>
            </div>
          ) : (
            <>
              {supportHasAdminUnread ? (
                <div className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-center text-[11px] font-medium text-primary">
                  {language === "ar" ? "رسائل جديدة" : language === "fr" ? "Nouveaux messages" : "Unread replies"}
                </div>
              ) : null}

              {supportMessagesWithDateMarkers.map((entry) => {
                if (entry.type === "date") {
                  return (
                    <div key={entry.key} className="text-center text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-border bg-background px-2.5 py-1">{entry.label}</span>
                    </div>
                  );
                }

                const message = entry.message!;
                const isMine = message.senderType === "user";
                const messageStatus = isMine
                  ? !message.deliveredAt
                    ? "sent"
                    : !message.readAt
                      ? "delivered"
                      : "read"
                  : null;

                return (
                  <motion.div
                    key={entry.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`flex ${isMine ? (isArabic ? "justify-start" : "justify-end") : isArabic ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] space-y-2 rounded-3xl px-3.5 py-3 shadow-sm sm:max-w-[80%] ${
                        isMine
                          ? "border border-success/30 bg-success/15 text-foreground shadow-[0_10px_25px_-18px_hsl(var(--success)/0.95)]"
                          : "border border-border/60 bg-card text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                      {message.imageUrl ? (
                        <img src={message.imageUrl} alt="support attachment" className="max-h-44 w-full rounded-xl object-cover" loading="lazy" />
                      ) : null}
                      <div
                        className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-medium tabular-nums ${
                          isMine ? "text-foreground/65" : "text-muted-foreground"
                        } ${isArabic ? "flex-row-reverse" : ""}`}
                      >
                        <span>{new Date(message.createdAt).toLocaleTimeString(language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                        {isMine && messageStatus ? (
                          <span
                            className={`inline-flex items-center ${messageStatus === "read" ? "text-primary" : "text-muted-foreground"}`}
                            aria-label={messageStatus}
                            title={messageStatus}
                          >
                            {messageStatus === "sent" ? <Check className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </>
          )}

          {supportIsTyping ? (
            <div className={`inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground ${isArabic ? "flex-row-reverse" : ""}`}>
              <Loader2 className="size-3 animate-spin" />
              {language === "ar" ? "يتم الإرسال..." : language === "fr" ? "Envoi..." : "Sending..."}
            </div>
          ) : null}
        </div>

        <footer className="sticky bottom-0 z-50 shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur md:px-5 md:py-3.5">
          {supportImageDataUrl ? (
            <div className="relative mb-2 overflow-hidden rounded-xl border border-border">
              <img src={supportImageDataUrl} alt="attachment preview" className="max-h-32 w-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7 rounded-full"
                onClick={() => setSupportImageDataUrl(null)}
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}

          <div className={`flex items-center gap-2.5 ${isArabic ? "flex-row-reverse" : ""}`}>
            <label className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/85 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-muted active:scale-[0.97]">
              <Paperclip className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handleSupportAttachmentChange} />
            </label>
            <div className="min-w-0 flex-1 rounded-3xl border border-border/70 bg-card/90 px-2.5 py-1.5 shadow-sm">
              <Textarea
                value={supportMessageInput}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setSupportMessageInput(event.target.value)}
                placeholder={language === "ar" ? "اكتب رسالتك..." : language === "fr" ? "Écrivez votre message..." : "Write your message..."}
                rows={2}
                className={`min-h-[48px] max-h-32 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed shadow-none focus-visible:ring-0 ${isArabic ? "text-right" : "text-left"}`}
                onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendSupportMessageNow();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="hero"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full border border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow"
              disabled={supportSendDisabled}
              onClick={() => void sendSupportMessageNow()}
            >
              {isSupportAttachmentUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>

          <div className={`mt-2 flex flex-wrap items-center justify-between gap-1.5 ${isArabic ? "flex-row-reverse" : ""}`}>
            <Button type="button" size="sm" variant={supportPriority === "high" ? "default" : "soft"} className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setSupportPriority(supportPriority === "high" ? "normal" : "high")}>
              {language === "ar" ? "أولوية عالية" : language === "fr" ? "Priorité haute" : "High priority"}
            </Button>
            <Button variant="soft" className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setCustomerPanelView("account")}>
              {customerUiCopy.backToAccount}
            </Button>
          </div>
        </footer>
      </section>
    );
  };

  return (
    <>
      <main dir={isArabic ? "rtl" : "ltr"} className="app-shell min-h-screen bg-background pb-24 text-foreground md:pb-0">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl md:z-50">
          <div className="mx-auto flex h-16 w-full max-w-6xl flex-nowrap items-center gap-2 px-[clamp(0.7rem,2.8vw,1.5rem)] sm:h-[4.25rem] sm:gap-2.5">
            <a href="#" className="inline-flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-[clamp(2.15rem,5.9vw,2.55rem)] w-[clamp(2.15rem,5.9vw,2.55rem)] shrink-0 items-center justify-center text-primary">
                {dynamicSiteLogoUrl ? (
                  <img
                    src={dynamicSiteLogoUrl}
                    alt={dynamicSiteName}
                    className="h-[clamp(1.82rem,5.7vw,2.22rem)] w-[clamp(1.82rem,5.7vw,2.22rem)] object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Bike className="size-[clamp(1.42rem,4.95vw,1.7rem)]" />
                )}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[clamp(1rem,3.25vw,1.22rem)] font-extrabold tracking-tight text-gradient-brand">
                  {dynamicSiteName}
                </span>
                <span className="block truncate text-[clamp(0.56rem,2.05vw,0.68rem)] font-medium text-muted-foreground/80">
                  {homepageUiCopy.brandSlogan}
                </span>
              </span>
            </a>

            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="ml-auto inline-flex min-w-0 max-w-[52vw] items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-[clamp(0.58rem,2.1vw,0.85rem)] py-[clamp(0.37rem,1.25vw,0.55rem)] text-[clamp(0.68rem,2.25vw,0.82rem)] font-medium text-muted-foreground transition hover:bg-muted sm:max-w-[16.75rem]"
            >
              <MapPin className="size-[clamp(0.78rem,2.8vw,0.95rem)] shrink-0 text-primary" />
              <span className="min-w-0 truncate">{selectedLocationLabel}</span>
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
                className="h-11 w-full rounded-2xl border border-border/70 bg-card pl-9 pr-24 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />

              <div className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-1 sm:inline-flex">
                <button
                  type="button"
                  aria-label="Voice search"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground"
                >
                  <Mic className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={language === "ar" ? "مركز الدعم" : language === "fr" ? "Centre d'assistance" : "Support Center"}
                  onClick={openSupportCenter}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground"
                >
                  <MessageCircle className="size-3.5" />
                </button>
              </div>

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
                          className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted ${isArabic ? "text-right" : "text-left"}`}
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
                            {Number(item.finalVendorPrice ?? item.vendorPrice ?? 0)} {homepageUiCopy.currency}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">{homepageUiCopy.noSearchResults}</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <LanguageSwitcher className="inline-flex h-[clamp(2rem,7vw,2.35rem)] w-[clamp(2rem,7vw,2.35rem)] shrink-0 rounded-full border border-border/70 bg-card text-foreground transition hover:bg-muted" />

            <button
              aria-label={t("header.userProfile")}
              onClick={() => {
                openCustomerPanel("account");
              }}
              className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card text-foreground transition hover:bg-muted md:inline-flex"
            >
              <UserCircle2 className="size-5" />
            </button>

            {customerSession ? (
              <button
                aria-label={t("header.myOrders")}
                onClick={() => {
                  openCustomerPanel("orders");
                }}
                className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card text-foreground transition hover:bg-muted md:inline-flex"
              >
                <ClipboardList className="size-5" />
              </button>
            ) : null}

            <button
              aria-label={cartLabel}
              onClick={openCart}
              className="relative hidden h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card text-foreground transition hover:bg-muted md:inline-flex"
            >
              <ShoppingCart className="size-5" />
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
                {cartCount}
              </span>
            </button>
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

        <div
          ref={mobileStickySearchRef}
          className="pointer-events-none fixed inset-x-0 top-[4.55rem] z-[60] px-3.5 md:hidden"
          style={{
            opacity: isMobileSearchSticky ? 1 : 0,
            transform: `translateY(${isMobileSearchSticky ? 0 : -18}px)`,
            transition: "opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "opacity, transform",
          }}
        >
          <div
            className="pointer-events-auto relative rounded-[20px] border border-border/45 bg-background/62 p-1.5 backdrop-blur-2xl"
            style={{
              boxShadow:
                "0 18px 34px -22px color-mix(in oklab, var(--foreground) 34%, transparent), 0 8px 16px -14px color-mix(in oklab, var(--foreground) 22%, transparent)",
              transition: "box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1), background-color 320ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <Search className="pointer-events-none absolute left-4.5 top-1/2 z-10 size-[15px] -translate-y-1/2 text-muted-foreground" />
            {predictiveSearchQuery.isFetching && hasSearchTerm ? (
              <Loader2 className="pointer-events-none absolute right-5 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
            <input
              aria-label="Search products"
              value={mobileSearchInput}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(event) => {
                setMobileSearchInput(event.target.value);
                setIsSearchOpen(true);
              }}
              placeholder={t("header.searchPlaceholder", { defaultValue: "Search essentials" })}
              className="h-11 w-full rounded-[18px] border border-border/45 bg-card/95 pl-10 pr-21 text-sm outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-ring/30"
            />

            <div className="absolute right-3 top-1/2 z-10 inline-flex -translate-y-1/2 items-center gap-1">
              <button
                type="button"
                aria-label="Voice search"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground"
              >
                <Mic className="size-[13px]" />
              </button>
              <button
                type="button"
                aria-label={language === "ar" ? "مركز الدعم" : language === "fr" ? "Centre d'assistance" : "Support Center"}
                onClick={openSupportCenter}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground"
              >
                <MessageCircle className="size-[13px]" />
              </button>
            </div>

            <AnimatePresence>
              {isSearchOpen && hasSearchTerm ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="no-scrollbar absolute left-0 right-0 top-[3.35rem] z-[100] max-h-[350px] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                >
                  {predictiveSearchResults.length > 0 ? (
                    predictiveSearchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSearchResultClick(item.id)}
                        className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted ${isArabic ? "text-right" : "text-left"}`}
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
                          {Number(item.finalVendorPrice ?? item.vendorPrice ?? 0)} {homepageUiCopy.currency}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-3 text-sm text-muted-foreground">{homepageUiCopy.noSearchResults}</p>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pt-5 sm:px-6 md:grid-cols-2 md:gap-8 md:pt-9">
          <article className="relative mx-auto mb-0 w-full overflow-visible px-0 pb-2 pt-0 md:hidden">
            <img
              src={heroImageUrl}
              alt="Fresh groceries"
              className={`pointer-events-none absolute top-0 h-[88px] w-[88px] rounded-2xl object-cover opacity-95 ${isArabic ? "left-1" : "right-1"}`}
              loading="lazy"
            />
            <div
              className={`max-w-[70%] transition-[opacity,transform] duration-300 ease-out ${isArabic ? "ml-auto text-right" : "text-left"}`}
              style={{
                opacity: 1 - mobileHeroScrollProgress * 0.55,
                transform: `translateY(${-mobileHeroScrollProgress * 16}px) scale(${1 - mobileHeroScrollProgress * 0.03})`,
                transformOrigin: isArabic ? "top right" : "top left",
              }}
            >
              <p className="text-[13px] font-medium text-foreground">{localizedHeroBadge}</p>
              <h1 className={`mt-1 ${customerTypography.heroTitle} ${customerTypography.textAlign}`}>
                {localizedHeroTitle}
              </h1>
              <p className={`mt-1.5 ${customerTypography.heroSubtitle}`}>{localizedHeroSubtitle}</p>
            </div>

            <div ref={mobileSearchAnchorRef} className="h-px w-full" />
            <div
              ref={mobileSearchContainerRef}
              className="relative z-20 mt-3 px-0.5 transition-[transform,opacity] duration-300 ease-out"
              style={{
                opacity: isMobileSearchSticky ? 0 : 1,
                transform: `translateY(${(1 - mobileHeroScrollProgress) * 16}px)`,
                pointerEvents: isMobileSearchSticky ? "none" : "auto",
              }}
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-[15px] -translate-y-1/2 text-muted-foreground" />
              {predictiveSearchQuery.isFetching && hasSearchTerm ? (
                <Loader2 className="pointer-events-none absolute right-4 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
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
                className="h-11 w-full rounded-[18px] border border-border/45 bg-card/95 pl-10 pr-21 text-sm shadow-[0_20px_36px_-24px_color-mix(in_oklab,var(--foreground)_30%,transparent)] backdrop-blur-xl outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-ring/30"
              />

              <div className="absolute right-2.5 top-1/2 z-10 inline-flex -translate-y-1/2 items-center gap-1">
                <button
                  type="button"
                  aria-label="Voice search"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground"
                >
                  <Mic className="size-[13px]" />
                </button>
                <button
                  type="button"
                  aria-label={language === "ar" ? "مركز الدعم" : language === "fr" ? "Centre d'assistance" : "Support Center"}
                  onClick={openSupportCenter}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground"
                >
                  <MessageCircle className="size-[13px]" />
                </button>
              </div>

              <AnimatePresence>
                {isSearchOpen && hasSearchTerm ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="no-scrollbar absolute left-0 right-0 top-11 z-[100] max-h-[350px] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl"
                  >
                    {predictiveSearchResults.length > 0 ? (
                      predictiveSearchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSearchResultClick(item.id)}
                          className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted ${isArabic ? "text-right" : "text-left"}`}
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
                            {Number(item.finalVendorPrice ?? item.vendorPrice ?? 0)} {homepageUiCopy.currency}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">{homepageUiCopy.noSearchResults}</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </article>

          <div className={`animate-fade-in hidden flex-col justify-center gap-5 md:flex ${isArabic ? "md:order-2 md:items-end" : "md:order-1 md:items-start"}`}>
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              {localizedHeroBadge}
            </p>
            <h1 className={`${customerTypography.heroTitle} ${customerTypography.textAlign} sm:text-[2.05rem]`}>
              {localizedHeroTitle}
            </h1>
            <p className={`max-w-xl ${customerTypography.heroSubtitle} ${customerTypography.textAlign} sm:text-[1rem]`}>
              {localizedHeroSubtitle}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="hero"
                size="xl"
                className="rounded-2xl"
                onClick={() => {
                  const target = activeHeroSection?.cta_link;
                  if (typeof target === "string" && target.trim().length > 0) {
                    if (target.startsWith("/")) window.location.assign(target);
                    else window.open(target, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                {localizedHeroCta}
              </Button>
              <span className="text-sm font-medium text-muted-foreground">{localizedHeroDeliveryTiming}</span>
            </div>
          </div>

          <div
            ref={bannerScrollRef}
            className={`flex w-full snap-x snap-mandatory flex-row overflow-x-auto pb-2 scrollbar-hide ${isArabic ? "md:order-1" : "md:order-2"}`}
            onMouseEnter={() => setIsBannerInteracting(true)}
            onMouseLeave={() => setIsBannerInteracting(false)}
            onTouchStart={() => setIsBannerInteracting(true)}
            onTouchEnd={() => setIsBannerInteracting(false)}
          >
            {displayAdSlides.map((slide) => (
              <div key={slide.id} className="w-full flex-shrink-0 snap-center">
                <article className="signature-tilt animate-enter relative h-[28vh] min-h-[190px] max-h-[34vh] w-full overflow-hidden rounded-[24px] border border-border/70 bg-card md:h-[410px] md:max-h-none">
                  <img
                    src={slide.image}
                    alt={slide.alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    width={1920}
                    height={1080}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-background md:p-5">
                    <span className="mb-2 inline-flex rounded-full border border-background/60 bg-foreground/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-background">
                      {slide.tag}
                    </span>
                    <p className="text-base font-extrabold leading-tight md:text-lg">{slide.headline}</p>
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
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-7 w-full max-w-6xl px-4 sm:px-6 md:mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className={customerTypography.sectionTitle}>
              {t("categories.title", { defaultValue: "Quick categories" })}
            </h2>
            <div className="flex items-center gap-3">
              <span className={customerTypography.sectionMeta}>
                {t("categories.subtitleDefault", { defaultValue: "Essentials first" })}
              </span>
              <Link to="/customer/categories" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {t("categories.viewAll", { defaultValue: "View All" })}
              </Link>
            </div>
          </div>
          <div
            className="category-scroll overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onMouseEnter={() => setIsCategoryTickerPaused(true)}
            onMouseLeave={() => setIsCategoryTickerPaused(false)}
            onTouchStart={() => setIsCategoryTickerPaused(true)}
            onTouchEnd={() => setIsCategoryTickerPaused(false)}
          >
            {categories.length === 0 ? (
              <AppEmptyState
                title={t("categories.noCategories", { defaultValue: "No categories available in your area yet." })}
                subtitle={homepageUiCopy.categoriesEmptySubtitle}
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
                      className={`mx-1 inline-flex min-w-[96px] snap-start flex-col items-center gap-2 rounded-[22px] border px-2.5 py-2.5 text-center transition-all ${index % categories.length === 0 ? "border-primary/45 bg-primary/10 shadow-[0_10px_24px_-18px_rgba(24,181,106,0.6)]" : "border-border/70 bg-card shadow-[0_10px_24px_-20px_rgba(17,24,39,0.35)]"}`}
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

        <section className="mx-auto mt-7 w-full max-w-6xl px-4 pb-9 sm:px-6 md:mt-10">
          <div className="mb-5 flex items-center justify-between">
            <Link to="/customer/all-products" className={customerTypography.sectionTitle}>
              {t("products.title")}
            </Link>
            <div className="flex items-center gap-3">
              <span className={customerTypography.sectionMeta}>{t("products.pricesInMad")}</span>
              <Link to="/customer/all-products" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {t("categories.viewAll", { defaultValue: "View All" })}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:gap-4.5 lg:grid-cols-4">
            {teaserProducts.map((product) => (
              <article
                key={product.id}
                className="group relative flex min-h-[258px] flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_12px_24px_-18px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-0.5"
              >
                <Link to="/customer/product/$id" params={{ id: product.id }} className="block">
                  <div className="relative aspect-square overflow-hidden bg-muted/35">
                    <img
                      src={product.image}
                      alt={product.alt}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      width={1024}
                      height={768}
                    />
                  </div>
                </Link>

                <button
                  type="button"
                  aria-label="Wishlist"
                  className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-background/95 leading-none shadow-sm"
                >
                  <Heart className="size-4 text-teal-700" />
                </button>

                <div className="flex flex-1 flex-col p-3">
                  <div className="mb-2 flex w-full items-center justify-between gap-2">
                    <span className="inline-block rounded-full bg-primary/12 px-2.5 py-1 text-[10px] font-bold leading-none text-primary">
                      {getLocalizedText({
                        en: product.brandNameEn || product.brand || "",
                        fr: product.brandNameFr || product.brandNameEn || product.brand || "",
                        ar: product.brandNameAr || product.brandNameEn || product.brand || "",
                      }) || "—"}
                    </span>

                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs leading-none text-muted-foreground">
                      <Package className="size-3.5" />
                      {product.measurementValue != null ? `${product.measurementValue} ` : ""}
                      {product.measurementUnit}
                    </span>
                  </div>

                  <Link to="/customer/product/$id" params={{ id: product.id }} className="block w-full min-w-0">
                    <h3 className={`w-full ${customerTypography.cardTitle}`}>
                      {product.name}
                    </h3>
                  </Link>

                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <p className={customerTypography.priceMain}>
                      {product.price} <span className={customerTypography.priceCurrency}>{homepageUiCopy.currency}</span>
                    </p>

                    {getCartQuantity(product.id, product.productVariants?.[0] ?? null) > 0 ? (
                      <div className="inline-flex h-9 items-center rounded-full border border-border/80 bg-muted/40 px-1.5">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center leading-none text-primary"
                          onClick={() =>
                            decreaseItem(
                              product.productVariants?.[0] ? `${product.id}::${product.productVariants[0]}` : product.id,
                            )
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold text-foreground">
                          {getCartQuantity(product.id, product.productVariants?.[0] ?? null)}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center leading-none text-primary"
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
                        className={`${customerTypography.cta} bg-primary text-primary-foreground shadow-[0_10px_20px_-15px_rgba(24,181,106,0.95)] transition hover:brightness-95`}
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
                className="group relative flex w-full items-center justify-center rounded-[18px] border border-primary/25 bg-card py-4 text-[15px] font-bold text-primary shadow-[0_8px_20px_-16px_rgba(24,181,106,0.75)] transition-all duration-300 hover:bg-primary/5 active:scale-[0.98]"
              >
                <span>{t("home.view_all_products")}</span>
                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 rtl:ml-0 rtl:mr-2 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>
            </div>
          ) : null}

          {teaserProducts.length === 0 ? (
            <AppEmptyState title={t("products.empty")} subtitle={homepageUiCopy.productsEmptySubtitle} className="mt-4" />
          ) : null}
        </section>

        <section className="mx-auto mt-6 w-full max-w-6xl px-4 pb-7 sm:px-6 md:mt-8">
          <div className={`mb-4 space-y-1.5 ${isArabic ? "text-right" : "text-left"}`}>
            <p className={customerTypography.eyebrow}>
              {subscriptionSectionCopy.eyebrow}
            </p>
            <h2 className={`flex items-center gap-2 ${customerTypography.sectionTitle} ${isArabic ? "flex-row-reverse" : ""}`}>
              <Sparkles className="size-4 text-primary" />
              <span>{subscriptionSectionCopy.title}</span>
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
              title={subscriptionSectionCopy.emptyTitle}
              subtitle={subscriptionSectionCopy.emptySubtitle}
            />
          ) : (
            <div
              ref={subScrollRef}
              className="flex w-full snap-x snap-mandatory flex-row gap-3 overflow-x-auto pb-3.5 pt-1.5 scrollbar-hide"
              onMouseEnter={() => setIsSubInteracting(true)}
              onMouseLeave={() => setIsSubInteracting(false)}
              onTouchStart={() => setIsSubInteracting(true)}
              onTouchEnd={() => setIsSubInteracting(false)}
            >
              {platformPacks.map((pack) => {
                const packSubscriptionState = activeOrPendingSubscriptionByPackId.get(pack.id) ?? null;
                const completedDeliveries = Math.max(0, Number(packSubscriptionState?.completedDeliveries ?? 0));
                const totalDeliveries = Math.max(0, Number(packSubscriptionState?.totalDeliveries ?? 0));

                return (
                <article
                  key={pack.id}
                  className="w-[min(92vw,360px)] flex-shrink-0 snap-center overflow-hidden rounded-[22px] border border-border/60 bg-[color:color-mix(in_oklab,var(--card)_88%,white)] shadow-[0_12px_28px_-20px_rgba(15,23,42,0.45)] sm:w-[380px]"
                >
                  <button
                    type="button"
                    onClick={() => openSubscriptionCheckout(pack)}
                    className="group block w-full"
                  >
                    <div className={`flex min-h-[132px] w-full ${isArabic ? "flex-row-reverse" : "flex-row"}`}>
                      <div className="relative h-auto w-[42%] min-w-[132px] max-w-[156px] overflow-hidden">
                        <img
                          src={pack.imageUrl || productFallbackImage}
                          alt={`${pack.name} ${subscriptionSectionCopy.packAltSuffix}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        <span className={`absolute top-2 inline-flex items-center rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground shadow-sm ${isArabic ? "right-2" : "left-2"}`}>
                          {subscriptionSectionCopy.bestValue}
                        </span>
                      </div>

                      <div className={`flex flex-1 flex-col justify-between px-3.5 py-3 ${isArabic ? "text-right" : "text-left"}`}>
                        <div className="space-y-1">
                          <h3 className="line-clamp-1 text-[14px] font-semibold leading-[1.25] text-foreground">{pack.name}</h3>
                          <p className={customerTypography.cardBody}>
                            {pack.description || subscriptionSectionCopy.fallbackDescription}
                          </p>
                        </div>

                        <div className={`mt-2 flex items-end justify-between gap-2 ${isArabic ? "flex-row-reverse" : "flex-row"}`}>
                          <div className={`min-w-0 ${isArabic ? "text-right" : "text-left"}`}>
                            <p className="whitespace-nowrap text-[13px] font-semibold text-success">
                              {Number(pack.basePriceMad).toFixed(0)} <span className="font-bold">{homepageUiCopy.currency}</span>
                              <span className="ml-1 text-[11px] font-medium text-muted-foreground rtl:ml-0 rtl:mr-1">
                                {subscriptionSectionCopy.pricingPrefix} {pack.billingLabel.toLowerCase()}
                              </span>
                            </p>
                          </div>

                          {packSubscriptionState?.status === "pending" ? (
                            <span className="inline-flex h-8 items-center rounded-full border border-amber-500/35 bg-amber-500/12 px-3 text-[11px] font-semibold text-amber-500">
                              {subscriptionSectionCopy.pending}
                            </span>
                          ) : packSubscriptionState?.status === "active" ? (
                            <span className="inline-flex h-8 items-center rounded-full border border-success/35 bg-success/12 px-3 text-[11px] font-semibold text-success">
                              {Math.min(completedDeliveries + 1, Math.max(totalDeliveries, 1))}/{Math.max(totalDeliveries, 1)}
                            </span>
                          ) : packSubscriptionState?.status === "paused" ? (
                            <span className="inline-flex h-8 items-center rounded-full border border-border bg-muted px-3 text-[11px] font-semibold text-muted-foreground">
                              {subscriptionSectionCopy.paused}
                            </span>
                          ) : (
                            <span className="inline-flex h-8 items-center rounded-full border border-success/45 bg-success/10 px-3.5 text-[11px] font-semibold text-success transition-colors group-hover:bg-success/20">
                              {subscriptionSectionCopy.subscribe}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </article>
                );
              })}
            </div>
          )}
        </section>

        {flashDeals.length > 0 ? (
        <section className="mx-auto mt-4 w-full max-w-6xl px-4 pb-4 sm:px-6 md:mt-6">
          <div className="mb-4 overflow-hidden rounded-[24px] border border-red-900/20 bg-gradient-to-r from-red-950 via-red-900 to-red-800 p-3.5 text-white shadow-[0_10px_26px_-16px_rgba(127,29,29,0.55)]">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2.5">
                <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm">
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/15 to-transparent" />
                  <ShieldCheck className="relative size-4 text-white" />
                  <Flame className="absolute -right-0.5 -top-0.5 size-3.5 text-red-200" />
                </span>
                <div className="leading-tight">
                  <h2 className={customerTypography.flashTitle}>{homepageUiCopy.flashTitle}</h2>
                  <p className="text-[10px] font-medium uppercase text-white/85">{homepageUiCopy.flashSubtitle}</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white">
                  <Clock3 className="size-3" />
                  <span>{countdownLabel}</span>
                </div>
                <Link
                  to="/customer/flash-deals"
                  className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                >
                  <span>{homepageUiCopy.viewAll}</span>
                  <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
                </Link>
              </div>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex snap-x snap-mandatory flex-row gap-3 overflow-x-auto pb-4.5 pt-1.5 scrollbar-hide"
            onMouseEnter={() => setIsInteracting(true)}
            onMouseLeave={() => setIsInteracting(false)}
            onTouchStart={() => setIsInteracting(true)}
            onTouchEnd={() => setIsInteracting(false)}
          >
            {flashDeals.slice(0, 4).map((product) => {
              const cartQty = getCartQuantity(product.id);

              return (
                <article
                  key={`flash-grid-${product.id}`}
                  className="group flex min-h-[236px] w-[172px] flex-shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-18px_rgba(15,23,42,0.55)] sm:w-[188px]"
                >
                  <Link
                    to="/customer/product/$id"
                    params={{ id: product.id }}
                    search={(prev: Record<string, unknown>) => ({ ...prev, deal: true })}
                    className="relative block"
                  >
                     <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/25">
                      <img
                        src={product.image}
                        alt={product.alt}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/18 to-transparent" />
                      {product.discountPercent > 0 ? (
                        <span className="absolute left-2 top-2 inline-flex h-6 items-center rounded-full border border-red-200/70 bg-red-600/95 px-2 text-[10px] font-extrabold leading-none text-white shadow-sm">
                          -{product.discountPercent}%
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        aria-label="Favorite"
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/92 text-muted-foreground shadow-sm backdrop-blur"
                      >
                        <Heart className="size-3.5" />
                      </button>
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-3.5">
                    <div className="mb-1.5 inline-flex h-5 w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {language === "ar" ? "عرض سريع" : language === "fr" ? "Flash" : "Flash Deal"}
                    </div>

                    <h3 className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-[1.2] text-foreground">
                      {product.name}
                    </h3>

                    <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                      {product.measurementUnit}
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-[15px] font-extrabold leading-none text-[#2A7543]">
                            {Number(product.dealPrice ?? 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] font-bold leading-none text-[#2A7543]">{homepageUiCopy.currency}</span>
                        </div>
                        <span className="mt-0.5 block text-[11px] leading-none text-muted-foreground line-through">
                          {Number(product.price ?? 0).toFixed(2)}
                        </span>
                      </div>

                       {cartQty > 0 ? (
                        <div className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-1.5 leading-none shadow-sm">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground leading-none"
                            onClick={() => decreaseItem(product.id)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-xs font-semibold text-foreground">{cartQty}</span>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground leading-none"
                            onClick={() => increaseItem(product.id)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                         <button
                          type="button"
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#2A7543] px-3 text-xs font-semibold text-white shadow-[0_10px_18px_-12px_rgba(42,117,67,0.8)] transition-all hover:brightness-105 active:scale-[0.98]"
                          onClick={() => addFlashDealToCart(product)}
                        >
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#2A7543] leading-none">
                            <Plus className="size-3" />
                          </span>
                          {t("products.add")}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!isBottomPromoDismissed ? (
            <div className="relative mb-20 overflow-hidden rounded-[24px] border border-success/30 bg-card">
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

              <div className="grid grid-cols-2 gap-2 border-t border-border/60 bg-muted/20 p-3">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2">
                  <Bike className="size-4 text-primary" />
                  <p className="text-xs font-medium text-foreground">15-min delivery</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <p className="text-xs font-medium text-foreground">Trusted vendors</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-xs font-medium text-foreground">Daily freshness</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2">
                  <HandCoins className="size-4 text-primary" />
                  <p className="text-xs font-medium text-foreground">Fair local pricing</p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
        ) : null}
      </main>

      <AnimatePresence>
        {supportFloatingNotification ? (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+7.25rem)] left-1/2 z-[95] inline-flex w-[min(90vw,23rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-success/35 bg-background/78 px-3.5 py-2 text-sm font-medium text-foreground shadow-[0_14px_34px_-20px_hsl(var(--success)/0.7)] backdrop-blur-xl md:bottom-7"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-success/25 bg-success/12 text-success">
              <MessageCircle className="size-3.5" />
            </span>
            <span className={`min-w-0 truncate ${isArabic ? "text-right" : "text-left"}`}>{supportFloatingNotification}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
                            {language === "ar" ? "أضف إلى الكارني (الدفع لاحقًا)" : language === "fr" ? "Ajouter au carnet (payer plus tard)" : "Add to Carnet (Pay Later)"}
                          </span>
                          <RadioGroupItem id="payment-carnet" value="Carnet" />
                        </Label>
                      ) : null}
                    </RadioGroup>
                    {paymentOptionsQuery.isFetching ? (
                      <p className="text-xs text-muted-foreground">{language === "ar" ? "جارٍ التحقق من أهلية الكارني..." : language === "fr" ? "Vérification de l'éligibilité carnet..." : "Checking carnet eligibility..."}</p>
                    ) : !paymentOptionsQuery.data?.canUseCarnet && paymentOptionsQuery.data?.reason ? (
                      <p className="text-xs text-muted-foreground">{paymentOptionsQuery.data.reason}</p>
                    ) : null}
                  </section>

                  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">{language === "ar" ? "ملخص الطلب" : language === "fr" ? "Résumé de la commande" : "Order Summary"}</h3>
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
                        <p className="text-sm text-muted-foreground">{language === "ar" ? "رسوم التوصيل" : language === "fr" ? "Frais de livraison" : "Delivery Fee"}</p>
                        <p className="text-sm font-medium text-foreground">
                          {selectedNeighborhoodId
                            ? `${calculatedDeliveryFeeMad.toFixed(2)} MAD`
                            : language === "ar"
                              ? "قيد التحديد"
                              : language === "fr"
                                ? "En attente"
                                : "Pending"}
                        </p>
                      </div>
                      {selectedNeighborhoodId ? (
                        <div className="mb-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold text-success">
                            <Gift className="size-3.5" />
                            {amountToFreeDeliveryMad > 0
                              ? language === "ar"
                                ? `زيد ${amountToFreeDeliveryMad.toFixed(2)} درهم باش تستافد من توصيل فابور!`
                                : language === "fr"
                                  ? `Ajoutez ${amountToFreeDeliveryMad.toFixed(2)} MAD pour débloquer la livraison offerte !`
                                  : `Spend ${amountToFreeDeliveryMad.toFixed(2)} MAD more to get FREE Delivery!`
                              : language === "ar"
                                ? "مبروك! عندك توصيل فابور"
                                : language === "fr"
                                  ? "Félicitations ! Livraison offerte débloquée !"
                                  : "You have unlocked Free Delivery! 🎉"}
                          </p>
                        </div>
                      ) : null}
                      {!isMinimumOrderMet ? (
                        <p className="mb-2 text-xs font-medium text-destructive">
                          {language === "ar"
                            ? `الحد الأدنى للطلب هو ${minimumOrderMad.toFixed(2)} درهم.`
                            : language === "fr"
                              ? `Le montant minimum de commande est ${minimumOrderMad.toFixed(2)} MAD.`
                              : `Minimum order amount is ${minimumOrderMad.toFixed(2)} MAD.`}
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{language === "ar" ? "الإجمالي النهائي" : language === "fr" ? "Total final" : "Final Total"}</p>
                        <p className="text-lg font-semibold text-foreground">{finalTotalMad.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur">
                  {isAccountRestricted ? (
                    <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
                      <p className="text-sm font-semibold text-destructive">{accountRestrictionMessage}</p>
                    </div>
                  ) : null}
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={confirmOrder}
                    disabled={!canConfirmOrder}
                  >
                    {isAccountRestricted
                      ? language === "ar"
                        ? "الحساب مقيّد"
                        : language === "fr"
                          ? "Compte restreint"
                          : "Account Restricted"
                      : isSubmittingOrder
                        ? language === "ar"
                          ? "جارٍ التأكيد..."
                          : language === "fr"
                            ? "Confirmation..."
                            : "Confirming..."
                        : language === "ar"
                          ? "تأكيد الطلب"
                          : language === "fr"
                            ? "Confirmer la commande"
                            : "Confirm Order"}
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
            <DrawerContent
              className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl border-border bg-background shadow-2xl ${
                customerPanelView === "support" ? "h-[100dvh] max-h-[100dvh] rounded-none border-0" : "max-h-[85vh] sm:max-h-[90vh]"
              } ${customerPanelView === "support" ? "transition-none" : "transition-[max-height,padding-bottom] duration-300 ease-out"}`}
              style={{
                height: isSupportPanelActive ? (supportViewportHeight ? `${supportViewportHeight}px` : "100dvh") : undefined,
                maxHeight: isSupportPanelActive
                  ? supportViewportHeight
                    ? `${supportViewportHeight}px`
                    : "100dvh"
                  : authSheetMaxHeight
                    ? `${authSheetMaxHeight}px`
                    : undefined,
                paddingBottom: isSupportPanelActive ? undefined : authKeyboardInset > 0 ? `${authKeyboardInset}px` : undefined,
              }}
            >
              <div
                className={`relative shrink-0 border-b border-border/60 bg-background px-6 pb-4 ${customerPanelView === "support" ? "hidden" : ""}`}
                style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
              >
                <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
                  style={{ top: "max(0.375rem, env(safe-area-inset-top))" }}
                  onClick={() => setIsCustomerAuthModalOpen(false)}
                  aria-label="Close login prompt"
                >
                  <X className="h-5 w-5" />
                </Button>

                <div className="pt-3 text-center">
                  <UserCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <h2 className="text-xl font-bold text-foreground">{customerSession ? customerUiCopy.account : customerUiCopy.welcomeBack}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {customerSession ? customerUiCopy.signedIn : customerUiCopy.enterPhoneToContinue}
                  </p>
                </div>
              </div>

              <div className={`pointer-events-none absolute inset-x-0 top-[126px] z-10 h-8 bg-gradient-to-b from-background/95 to-transparent transition-opacity duration-200 ${customerPanelView === "support" ? "hidden" : ""}`} style={{ opacity: authSheetCanScrollUp ? 1 : 0 }} />
              <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-background/95 via-background/60 to-transparent transition-opacity duration-200 ${customerPanelView === "support" ? "hidden" : ""}`} style={{ opacity: authSheetCanScrollDown ? 1 : 0 }} />

              <div
                ref={authSheetScrollRef}
                onScroll={(event) => updateAuthSheetScrollState(event.currentTarget)}
                className={`flex-1 overflow-y-auto overscroll-contain ${customerPanelView === "support" ? "overflow-hidden px-0 pb-0 pt-0 transition-none" : "px-6 pb-8 pb-[env(safe-area-inset-bottom)] pt-2 transition-[padding-bottom] duration-300 ease-out"}`}
                style={{
                  paddingBottom:
                    customerPanelView === "support"
                      ? undefined
                      : authKeyboardInset > 0
                        ? `max(${authKeyboardInset + 96}px, calc(env(safe-area-inset-bottom) + 120px))`
                        : undefined,
                  WebkitOverflowScrolling: "touch",
                  scrollBehavior: "smooth",
                }}
              >
                <div className={`flex flex-col ${isSupportPanelActive ? "h-full min-h-0 gap-0" : "gap-5"}`}>
                {customerSession && customerPanelView === "account" ? (
                  <div className="space-y-3">
                  <section className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{customerUiCopy.phoneNumber}</p>
                    <p className="text-sm font-medium text-foreground">{customerSession.phoneNumber}</p>
                  </section>
                  <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {language === "ar" ? "رصيد الكارني" : language === "fr" ? "Solde Carnet" : "My Carnet"}
                    </p>
                    <p className="text-lg font-semibold text-destructive">{Number(carnetCurrentDebt ?? 0).toFixed(2)} MAD</p>
                  </section>
                    <Button variant="hero" className="w-full rounded-xl" onClick={() => setCustomerPanelView("profile")}>
                      {language === "ar" ? "عرض وتعديل الحساب" : language === "fr" ? "Voir et modifier le profil" : "View & Edit Profile"}
                    </Button>
                  <Button
                    variant="soft"
                    className="w-full rounded-xl"
                    onClick={() => {
                      setCustomerPanelView("carnet");
                    }}
                    >
                      {language === "ar" ? "تفاصيل الكارني" : language === "fr" ? "Détails du carnet" : "Carnet Details"}
                    </Button>
                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setIsCustomerAuthModalOpen(false)}>
                      {language === "ar" ? "إغلاق" : language === "fr" ? "Fermer" : "Close"}
                  </Button>
                  <Button variant="destructive" className="w-full rounded-xl" onClick={logoutCustomer}>
                      {language === "ar" ? "تسجيل الخروج" : language === "fr" ? "Déconnexion" : "Logout"}
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
                            <article key={subscription.id} className={`space-y-2.5 rounded-xl border border-border bg-background ${isArabic ? "p-3.5" : "p-3"}`}>
                              <div className={`flex items-start justify-between ${isArabic ? "flex-row-reverse gap-4" : "gap-3"}`}>
                                <div className={`min-w-0 ${isArabic ? "text-right" : "text-left"}`}>
                                  <p className={`text-sm text-foreground ${isArabic ? "font-medium leading-6" : "font-semibold"}`}>{subscription.packName}</p>
                                  <p className="text-xs text-muted-foreground">#{subscription.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <Badge
                                  className={`inline-flex h-8 min-w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-[12px] leading-none ${
                                    isArabic ? "font-medium" : "font-semibold"
                                  } ${
                                    isPending
                                      ? "border border-chart-4/40 bg-chart-4/20 text-chart-4"
                                      : isCompleted
                                        ? "bg-success/20 text-success"
                                        : "bg-primary/15 text-primary"
                                  }`}
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
                                <div className={`flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground ${isArabic ? "flex-row-reverse text-right" : ""}`}>
                                  <span className={isArabic ? "text-right" : ""}>
                                    {subscription.completedDeliveries}/{Math.max(subscription.totalDeliveries, 0)} deliveries
                                  </span>
                                  <span className="shrink-0 whitespace-nowrap">{subscription.completionPercent}%</span>
                                </div>
                              </div>

                              {isPending ? (
                                <p className={`text-xs font-medium text-chart-4 ${isArabic ? "text-right" : ""}`}>Awaiting platform approval before activation.</p>
                              ) : null}
                              {isActive ? (
                                <p className={`text-xs font-medium text-success ${isArabic ? "text-right" : ""}`}>Subscription active — deliveries are being tracked live.</p>
                              ) : null}
                              {isCompleted ? (
                                <p className={`text-xs font-medium text-success ${isArabic ? "text-right" : ""}`}>Subscription finished.</p>
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
                                          {customerUiCopy.unpaidCarnet}
                                        </Badge>
                                      ) : null}
                                      <p className="text-sm font-semibold text-foreground">{getOrderGrandTotalMad(order).toFixed(2)} MAD</p>
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
                                          {customerUiCopy.unpaidCarnet}
                                        </Badge>
                                      ) : null}
                                      <p className="text-sm font-semibold text-foreground">{getOrderGrandTotalMad(order).toFixed(2)} MAD</p>
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
                ) : customerSession && customerPanelView === "support" ? (
                  renderSupportPanel()
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
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isCustomerAuthModalOpen} onOpenChange={setIsCustomerAuthModalOpen}>
            <DialogContent
              className={`[&>button]:hidden w-[95vw] border border-border bg-background shadow-2xl ${
                customerSession && customerPanelView === "support"
                  ? "left-1/2 top-1/2 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 p-0"
                  : "max-w-md p-8"
              }`}
            >
              <DialogTitle className="sr-only">
                {customerSession && customerPanelView === "support"
                  ? language === "ar"
                    ? "مركز الدعم"
                    : language === "fr"
                      ? "Centre d’assistance"
                      : "Support Center"
                  : customerSession
                    ? customerUiCopy.account
                    : customerUiCopy.welcomeBack}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {customerSession && customerPanelView === "support"
                  ? language === "ar"
                    ? "دردشة مباشرة مع فريق الدعم"
                    : language === "fr"
                      ? "Chat en direct avec l’équipe support"
                      : "Live chat with the support team"
                  : customerSession
                    ? customerUiCopy.signedIn
                    : customerUiCopy.enterPhoneToContinue}
              </DialogDescription>
              <div className={`relative flex flex-col gap-5 ${isSupportPanelActive ? "h-full gap-0" : ""}`}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground ${isSupportPanelActive ? "hidden" : ""}`}
                  onClick={() => setIsCustomerAuthModalOpen(false)}
                  aria-label="Close login prompt"
                >
                  <X className="h-5 w-5" />
                </Button>

                <div className={`text-center ${isSupportPanelActive ? "hidden" : ""}`}>
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
                        {language === "ar" ? "رصيد الكارني" : language === "fr" ? "Solde Carnet" : "My Carnet"}
                      </p>
                      <p className="text-lg font-semibold text-destructive">{Number(carnetCurrentDebt ?? 0).toFixed(2)} MAD</p>
                    </section>
                    <Button variant="hero" className="w-full rounded-xl" onClick={() => setCustomerPanelView("profile")}>
                      {language === "ar" ? "عرض وتعديل الحساب" : language === "fr" ? "Voir et modifier le profil" : "View & Edit Profile"}
                    </Button>
                    <Button
                      variant="soft"
                      className="w-full rounded-xl"
                      onClick={() => {
                        setCustomerPanelView("carnet");
                      }}
                    >
                      {language === "ar" ? "تفاصيل الكارني" : language === "fr" ? "Détails du carnet" : "Carnet Details"}
                    </Button>
                    <Button variant="soft" className="w-full rounded-xl" onClick={() => setIsCustomerAuthModalOpen(false)}>
                      {language === "ar" ? "إغلاق" : language === "fr" ? "Fermer" : "Close"}
                    </Button>
                    <Button variant="destructive" className="w-full rounded-xl" onClick={logoutCustomer}>
                      {language === "ar" ? "تسجيل الخروج" : language === "fr" ? "Déconnexion" : "Logout"}
                    </Button>
                  </div>
                ) : customerSession && customerPanelView === "profile" ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label htmlFor="profile-full-name" className="text-xs font-medium text-muted-foreground">
                      {customerUiCopy.fullName}
                      </label>
                      <input
                        id="profile-full-name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder={customerUiCopy.fullNamePlaceholder}
                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-phone" className="text-xs font-medium text-muted-foreground">
                      {customerUiCopy.phoneNumber}
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
                      {customerUiCopy.address}
                      </label>
                      <textarea
                        id="profile-address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder={customerUiCopy.addressPlaceholder}
                        className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                      />
                    </div>
                    <Button
                      variant="hero"
                      className="w-full rounded-xl"
                      onClick={async () => {
                        if (!customerSession?.phoneNumber || !fullName.trim()) {
                          toast.error(customerUiCopy.toastCompleteProfile);
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
                          toast.success(customerUiCopy.toastProfileUpdated);
                          setCustomerPanelView("account");
                        } catch (error) {
                          console.error("Failed to update customer profile:", error);
                          toast.error(customerUiCopy.toastProfileUpdateFailed);
                        }
                      }}
                    >
                      {customerUiCopy.saveProfile}
                    </Button>
                    <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                      {customerUiCopy.backToAccount}
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
                              <article key={subscription.id} className={`space-y-2.5 rounded-xl border border-border bg-background ${isArabic ? "p-3.5" : "p-3"}`}>
                                <div className={`flex items-start justify-between ${isArabic ? "flex-row-reverse gap-4" : "gap-3"}`}>
                                  <div className={`min-w-0 ${isArabic ? "text-right" : "text-left"}`}>
                                    <p className={`text-sm text-foreground ${isArabic ? "font-medium leading-6" : "font-semibold"}`}>{subscription.packName}</p>
                                    <p className="text-xs text-muted-foreground">#{subscription.id.slice(0, 8).toUpperCase()}</p>
                                  </div>
                                  <Badge
                                    className={`inline-flex h-8 min-w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-[12px] leading-none ${
                                      isArabic ? "font-medium" : "font-semibold"
                                    } ${
                                      isPending
                                        ? "border border-chart-4/40 bg-chart-4/20 text-chart-4"
                                        : isCompleted
                                          ? "bg-success/20 text-success"
                                          : "bg-primary/15 text-primary"
                                    }`}
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
                                  <div className={`flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground ${isArabic ? "flex-row-reverse text-right" : ""}`}>
                                    <span className={isArabic ? "text-right" : ""}>
                                      {subscription.completedDeliveries}/{Math.max(subscription.totalDeliveries, 0)} deliveries
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap">{subscription.completionPercent}%</span>
                                  </div>
                                </div>

                                {isPending ? (
                                  <p className={`text-xs font-medium text-chart-4 ${isArabic ? "text-right" : ""}`}>Awaiting platform approval before activation.</p>
                                ) : null}
                                {isActive ? (
                                  <p className={`text-xs font-medium text-success ${isArabic ? "text-right" : ""}`}>Subscription active — deliveries are being tracked live.</p>
                                ) : null}
                                {isCompleted ? (
                                  <p className={`text-xs font-medium text-success ${isArabic ? "text-right" : ""}`}>Subscription finished.</p>
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
                                        <p className="text-sm font-semibold text-foreground">{getOrderGrandTotalMad(order).toFixed(2)} MAD</p>
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
                                        <p className="text-sm font-semibold text-foreground">{getOrderGrandTotalMad(order).toFixed(2)} MAD</p>
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
                ) : customerSession && customerPanelView === "support" ? (
                  renderSupportPanel()
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

      <Dialog
        open={isQrScannerOpen}
        onOpenChange={(open) => {
          setIsQrScannerOpen(open);
          if (!open) setIsProcessingQrResult(false);
        }}
      >
        <DialogContent className={`w-[95vw] max-w-md rounded-2xl ${isArabic ? "text-right" : "text-left"}`} dir={isArabic ? "rtl" : "ltr"}>
          <DialogTitle className="sr-only">{language === "ar" ? "ماسح رمز الطلب" : language === "fr" ? "Scanner de commande" : "Order QR scanner"}</DialogTitle>
          <DialogDescription className="sr-only">
            {language === "ar"
              ? "وجّه الكاميرا إلى رمز الطلب"
              : language === "fr"
                ? "Pointez la caméra vers le QR de la commande"
                : "Point the camera at your order QR code"}
          </DialogDescription>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{scannerStatusMessage || customerUiCopy.scannerPointToQr}</p>
            <div id="customer-order-qr-reader" className="min-h-[320px] overflow-hidden rounded-xl border border-border" />
            {isProcessingQrResult ? (
              <div className={`inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary ${isArabic ? "flex-row-reverse" : ""}`}>
                <CheckCircle2 className="size-4" />
                {customerUiCopy.scannerSuccess}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {isLocationModalOpen ? (
          <motion.div
            className="fixed inset-0 z-[90]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-black/38 backdrop-blur-[4px]" />
            <section className="absolute inset-0 flex items-center justify-center px-3 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-4 sm:px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className={`w-full max-w-[620px] rounded-[30px] border border-border/70 bg-[color-mix(in_oklab,var(--color-background)_90%,var(--color-secondary)_10%)] p-4 shadow-[0_26px_70px_-34px_rgba(23,34,29,0.56)] sm:p-6 ${isArabic ? "text-right" : "text-left"}`}
                dir={isArabic ? "rtl" : "ltr"}
              >
                <div className={`flex items-start justify-between gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
                  <div className={`flex min-w-0 items-start gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-primary/22 to-primary/10 text-primary shadow-[0_12px_24px_-14px_rgba(24,181,106,0.7)]">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[clamp(1.1rem,4.8vw,1.55rem)] font-bold leading-tight text-foreground">
                        {customerUiCopy.selectDeliveryLocation}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{customerUiCopy.locationHint}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-all hover:border-primary/30 hover:text-primary active:scale-95"
                    onClick={closeLocationModal}
                    aria-label={customerUiCopy.closeModal}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[12px] font-semibold text-primary/90">{customerUiCopy.communeLabel}</label>
                    <div className="relative">
                      <Search
                        className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ${isArabic ? "right-4" : "left-4"}`}
                      />
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
                        placeholder={customerUiCopy.searchCommunePlaceholder}
                        className={`h-12 rounded-2xl border-border/70 bg-card/75 text-[14px] shadow-[0_10px_28px_-20px_rgba(20,37,30,0.45)] ${isArabic ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left"}`}
                        role="combobox"
                        aria-expanded={hasEnoughCommuneChars}
                        aria-controls="commune-results"
                      />
                    </div>
                    <div
                      id="commune-results"
                      className="max-h-[24vh] overflow-y-auto rounded-2xl border border-border/70 bg-background/85 p-1"
                    >
                      {!hasEnoughCommuneChars ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{customerUiCopy.startTyping}</p>
                      ) : communeSearchQuery.isLoading ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{customerUiCopy.loadingCommunes}</p>
                      ) : filteredCommuneOptions.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{customerUiCopy.noCommune}</p>
                      ) : (
                        <ul className="space-y-1">
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
                                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all hover:bg-secondary/70 active:scale-[0.99] ${isArabic ? "flex-row-reverse text-right" : "text-left"}`}
                              >
                                <Check
                                  className={`size-4 ${selectedCommuneId === commune.id ? "text-primary opacity-100" : "opacity-35"}`}
                                />
                                <span className="truncate font-medium text-foreground">{getLocalizedCommuneName(commune)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {selectedCommuneOption ? (
                      <div
                        className={`flex items-center gap-2 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/16 to-secondary/60 px-3 py-2.5 ${isArabic ? "flex-row-reverse" : ""}`}
                      >
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Check className="size-4" />
                        </span>
                        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                          {getLocalizedCommuneName(selectedCommuneOption)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-semibold text-primary/90">{customerUiCopy.neighborhoodLabel}</label>
                    <div className="relative">
                      <Search
                        className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ${isArabic ? "right-4" : "left-4"}`}
                      />
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
                        placeholder={selectedCommuneId ? customerUiCopy.searchDouarPlaceholder : customerUiCopy.selectCommuneFirst}
                        className={`h-12 rounded-2xl border-border/70 bg-card/75 text-[14px] shadow-[0_10px_28px_-20px_rgba(20,37,30,0.45)] ${isArabic ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left"}`}
                        role="combobox"
                        aria-expanded={!!selectedCommuneId && hasEnoughNeighborhoodChars}
                        aria-controls="douar-results"
                        disabled={!selectedCommuneId}
                      />
                    </div>
                    <div
                      id="douar-results"
                      className="max-h-[24vh] overflow-y-auto rounded-2xl border border-border/70 bg-background/85 p-1"
                    >
                      {!selectedCommuneId ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{customerUiCopy.selectCommuneFirst}</p>
                      ) : !hasEnoughNeighborhoodChars ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{customerUiCopy.startTyping}</p>
                      ) : neighborhoodSearchQuery.isLoading ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{customerUiCopy.loadingDouars}</p>
                      ) : !selectedNeighborhoodId && filteredNeighborhoodOptions.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">{customerUiCopy.noDouar}</p>
                      ) : (
                        <ul className="space-y-1">
                          {filteredNeighborhoodOptions.map((neighborhood) => (
                            <li key={neighborhood.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedNeighborhoodId(neighborhood.id);
                                  setSelectedNeighborhoodOption(neighborhood);
                                  setNeighborhoodSearchInput(getLocalizedNeighborhoodName(neighborhood));
                                }}
                                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all hover:bg-secondary/70 active:scale-[0.99] ${isArabic ? "flex-row-reverse text-right" : "text-left"}`}
                              >
                                <Check
                                  className={`size-4 ${selectedNeighborhoodId === neighborhood.id ? "text-primary opacity-100" : "opacity-35"}`}
                                />
                                <span className="truncate font-medium text-foreground">
                                  {getLocalizedNeighborhoodName(neighborhood)} ({getLocalizedDeliveryLabel()}: {Number(neighborhood.deliveryFee ?? 0).toFixed(0)} MAD)
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {selectedNeighborhoodOption ? (
                      <div className="space-y-2 pt-1">
                        <div
                          className={`flex items-center gap-2 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/16 to-secondary/60 px-3 py-2.5 ${isArabic ? "flex-row-reverse" : ""}`}
                        >
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="size-4" />
                          </span>
                          <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                            {getLocalizedNeighborhoodName(selectedNeighborhoodOption)} ({getLocalizedDeliveryLabel()}: {Number(selectedNeighborhoodOption.deliveryFee ?? 0).toFixed(0)} MAD)
                          </p>
                        </div>

                        <div
                          className={`rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/18 via-secondary/65 to-primary/10 px-3 py-3 ${isArabic ? "text-right" : "text-left"}`}
                        >
                          <div className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/18 text-primary">
                              <Bike className="size-4" />
                            </span>
                            <p className="text-sm font-bold text-foreground">
                              {getLocalizedDeliveryFeeToLocationLabel()}: {Number(selectedNeighborhoodOption.deliveryFee ?? 0).toFixed(0)} MAD
                            </p>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{customerUiCopy.deliveryFeeHint}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <Button
                  variant="hero"
                  className="mt-5 h-12 w-full rounded-full bg-gradient-to-r from-primary to-highlight text-primary-foreground shadow-[0_16px_28px_-16px_rgba(24,181,106,0.85)] transition-all hover:opacity-95 active:scale-[0.99]"
                  onClick={saveLocationSelection}
                  disabled={!selectedCommuneId || !selectedNeighborhoodId || communeSearchQuery.isLoading || neighborhoodSearchQuery.isLoading}
                >
                  <MapPin className={`size-4 ${isArabic ? "ml-1" : "mr-1"}`} />
                  {customerUiCopy.confirmLocation}
                </Button>
              </motion.div>
            </section>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </>
  );
}
