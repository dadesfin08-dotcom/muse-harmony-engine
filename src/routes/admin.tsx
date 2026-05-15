import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type Dispatch,
  type DragEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { QRCodeSVG } from "qrcode.react";
import { z } from "zod";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  LayoutDashboard,
  PackageCheck,
  Store,
  Boxes,
  Settings,
  TrendingUp,
  MapPin,
  CircleDollarSign,
  Phone,
  User,
  ImagePlus,
  Bike,
  TriangleAlert,
  Megaphone,
  Shapes,
  ChevronsUpDown,
  Users,
  LogOut,
  Download,
  FileUp,
  Search,
  Plus,
  Wallet,
  BikeIcon,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Building2,
  Clock3,
  Trophy,
  TrendingDown,
  CalendarDays,
  Eye,
  Tag,
  Pencil,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  type MasterProductEntity,
} from "@/lib/entities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import {
  createCommune,
  createNeighborhood,
  importServiceZonesBulk,
  listServiceZones,
  listServiceZonesForExport,
  type ServiceZoneTree,
} from "@/lib/locations.functions";
import {
  archiveMasterProduct,
  createBrand,
  createMasterProduct,
  importMasterProductsBulk,
  listMasterProductsForExport,
  deleteBrand,
  importBrandsBulk,
  listBrands,
  listMasterProducts,
  updateBrand,
  uploadBrandLogo,
  uploadMasterProductImage,
  updateMasterProduct,
  type MeasurementUnit,
} from "@/lib/catalog.functions";
import {
  createCategory,
  listAdminCategories,
  updateCategory,
} from "@/lib/categories.functions";
import {
  createAnnouncement,
  createSiteAd,
  deleteAnnouncement,
  deleteSiteAd,
  listAnnouncements,
  listSiteAds,
  updateAnnouncement,
  updateSiteAd,
} from "@/lib/ads-content.functions";
import { checkAdminDatabaseHealth } from "@/lib/admin-health.functions";
import {
  createVendor,
  getVendorSalesAnalytics,
  listPlatformCollectionHistory,
  listVendors,
  type AdminVendorRecord,
  type PlatformCollectionHistoryItem,
  type VendorSalesAnalytics,
  updateVendorActiveState,
  updateVendorDetails,
} from "@/lib/vendors.functions";
import {
  createCyclist,
  listCyclists,
  type AdminCyclistRecord,
} from "@/lib/cyclists.functions";
import {
  getAdminOverviewAnalytics,
  getGlobalSettings,
  listAdminCustomers,
  listAdminOrders,
  resetFactoryData,
  uploadSiteLogo,
  updateGlobalSettings,
} from "@/lib/admin-dashboard.functions";
import { getAdminInvoiceSettings, updateAdminInvoiceSettings } from "@/lib/admin-dashboard.functions";
import {
  createMarkupRule,
  deleteMarkupRule,
  listMarkupRules,
  updateMarkupRule,
} from "@/lib/markup-rules.functions";
import { uploadReceiptLogo } from "@/lib/invoice-settings.functions";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { CATEGORY_ICON_OPTIONS, CategoryIcon, type CategoryIconName } from "@/lib/lucide-category-icons";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clearRoleSessions } from "@/lib/operational-auth";
import {
  DEFAULT_RECEIPT_ADDRESS,
  DEFAULT_RECEIPT_FOOTER_MESSAGE,
  DEFAULT_RECEIPT_PHONE,
  DEFAULT_RECEIPT_SLOGAN,
  DEFAULT_RECEIPT_SOCIAL_SUPPORT,
  DEFAULT_RECEIPT_STORE_NAME,
  DEFAULT_RECEIPT_WEBSITE,
} from "@/lib/receipt-settings.defaults";
import i18n from "@/lib/i18n";

type AdminTab =
  | "overview"
  | "orders"
  | "customers"
  | "vendors"
  | "cyclists"
  | "service-zones"
  | "catalog"
  | "brands"
  | "categories"
  | "ads-content"
  | "settings";

const navItems: Array<{ label: string; tab: AdminTab; icon: ComponentType<{ className?: string }> }> = [
  { label: "admin.nav.overview", tab: "overview", icon: LayoutDashboard },
  { label: "admin.nav.orders", tab: "orders", icon: PackageCheck },
  { label: "admin.nav.customers", tab: "customers", icon: Users },
  { label: "admin.nav.vendors", tab: "vendors", icon: Store },
  { label: "admin.nav.cyclists", tab: "cyclists", icon: Bike },
  { label: "admin.nav.serviceZones", tab: "service-zones", icon: MapPin },
  { label: "admin.nav.catalog", tab: "catalog", icon: Boxes },
  { label: "admin.nav.brands", tab: "brands", icon: Shapes },
  { label: "admin.nav.categories", tab: "categories", icon: Shapes },
  { label: "admin.nav.adsContent", tab: "ads-content", icon: Megaphone },
  { label: "admin.nav.settings", tab: "settings", icon: Settings },
];

const initialVendors: AdminVendorRecord[] = [];
const initialCyclists: AdminCyclistRecord[] = [];
const emptyVendorAnalytics: VendorSalesAnalytics = {
  todaysRevenueMad: 0,
  totalAllTimeSalesMad: 0,
  totalCompletedOrders: 0,
  lastFiveOrders: [],
};

const initialMasterProducts: MasterProductEntity[] = [];
type CategoryAdminRow = {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url: string | null;
  icon_name: string | null;
  accent_color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};
type BrandAdminRow = {
  id: string;
  name_en: string;
  name_fr: string | null;
  name_ar: string | null;
  logo_url: string | null;
  created_at: string;
};
type MarkupRuleAdminRow = {
  id: string;
  minPrice: number;
  maxPrice: number;
  markupType: "fixed" | "percentage";
  markupValue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
const initialCategories: CategoryAdminRow[] = [];
const initialBrands: BrandAdminRow[] = [];
const BRANDS_CSV_HEADERS = ["Logo", "English", "Français", "العربية"] as const;
const MASTER_PRODUCTS_CSV_HEADERS = [
  "Image_URL",
  "Name_EN",
  "Name_FR",
  "Name_AR",
  "Category",
  "Brand",
  "Product_Variants",
  "Measurement_Value",
  "Measurement_Unit",
  "Barcode",
] as const;
const MASTER_PRODUCTS_CSV_EXAMPLE_ROWS = [
  [
    "https://example.com/products/olive-oil.jpg",
    "Olive Oil",
    "Huile d'olive",
    "زيت الزيتون",
    "Groceries",
    "Lesieur",
    "Extra Virgin, Light",
    "1",
    "Liter",
    "6111000010012",
  ],
  [
    "https://example.com/products/bananas.jpg",
    "Banana",
    "Banane",
    "موز",
    "Vegetables & Fruits",
    "Dole",
    "Yellow, Organic",
    "1",
    "Kg",
    "6111000010013",
  ],
  [
    "https://example.com/products/eggs.jpg",
    "Eggs 12 Pack",
    "Oeufs 12 unités",
    "بيض 12 حبة",
    "Dairy & Eggs",
    "Local Farm",
    "White, Brown",
    "12",
    "Piece",
    "6111000010014",
  ],
] as const;
const SERVICE_ZONES_BULK_HEADERS = [
  "Zone_Code",
  "Commune_EN",
  "Commune_FR",
  "Commune_AR",
  "Douar_EN",
  "Douar_FR",
  "Douar_AR",
  "Delivery_Fee",
] as const;
const initialAdminOrders: Array<{
  id: string;
  createdAt: string;
  vendorName: string;
  customerPhone: string;
  totalPrice: number;
  status:
    | "new"
    | "preparing"
    | "ready"
    | "delivering"
    | "delivered"
    | "delivered_cash_with_cyclist"
    | "cash_transferred_to_vendor"
    | "cancelled";
}> = [];
const measurementUnits: MeasurementUnit[] = ["Kg", "Liter", "Piece", "Pack", "Gram", "Bunch", "Tray", "Box"];
const specializationOptions = [
  "Groceries",
  "Vegetables & Fruits",
  "Meat & Poultry",
  "Bakery & Pastry",
  "Dairy & Eggs",
  "Drinks & Water",
  "Cleaning Supplies",
] as const;
const masterProductFormSchema = z.object({
  name: z.string().trim().min(1),
  nameFr: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  productVariants: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  brandId: z.string().uuid().nullable(),
  categoryId: z.string().uuid(),
  measurementValue: z.number().positive().max(10_000).nullable(),
  measurementUnit: z.enum(["Kg", "Liter", "Piece", "Pack", "Gram", "Bunch", "Tray", "Box"]),
  popularityScore: z.number().int().min(0).max(1_000_000),
});

const platformCommissionPaymentQrPayloadSchema = z.object({
  action: z.literal("platform_commission_payment"),
  vendor_id: z.string().uuid(),
  amount: z.number().positive(),
  timestamp: z.string(),
});

type OverviewKpiMetric = {
  value: number;
  previousValue: number;
  change: number;
  changePercentage: number;
  format: "integer" | "currency";
};

type OverviewAnalytics = {
  kpis: {
    totalOrders: OverviewKpiMetric;
    activeVendors: OverviewKpiMetric;
    totalGrossVolume: OverviewKpiMetric;
    vendorsRevenue: OverviewKpiMetric;
    cyclistsEarnings: OverviewKpiMetric;
    platformProfit: OverviewKpiMetric;
  };
  salesOrdersTrends: Array<{ day: string; label: string; orders: number; revenue: number }>;
  zonePerformance: {
    top: Array<{ zone: string; orders: number; revenue: number; activeVendors: number }>;
    bottom: Array<{ zone: string; orders: number; revenue: number; activeVendors: number }>;
  };
  deliverySpeedMetrics: Array<{
    zone: string;
    neighborhood: string;
    avgMinutes: number;
    deliveries: number;
    performance: "fast" | "slow" | "normal";
  }>;
  marketInsights: {
    topNeighborhoods: Array<{ neighborhood: string; zone: string; orders: number; revenue: number }>;
    topBrands: Array<{ name: string; orders: number; revenue: number; quantity: number }>;
    topCategories: Array<{ name: string; orders: number; revenue: number; quantity: number }>;
  };
};

const salesOrdersChartConfig = {
  orders: {
    label: "Orders",
    color: "oklch(0.58 0.18 275)",
  },
  revenue: {
    label: "Revenue",
    color: "oklch(0.66 0.15 160)",
  },
} satisfies ChartConfig;

const zonePerformanceChartConfig = {
  topOrders: {
    label: "Top zones",
    color: "oklch(0.67 0.14 160)",
  },
  bottomOrders: {
    label: "Bottom zones",
    color: "oklch(0.73 0.15 72)",
  },
} satisfies ChartConfig;

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => {
    const tab = typeof search.tab === "string" ? search.tab : "overview";
    if (
      [
        "overview",
        "orders",
        "customers",
        "vendors",
        "cyclists",
        "service-zones",
        "catalog",
        "brands",
        "categories",
        "ads-content",
        "settings",
      ].includes(tab)
    ) {
      return { tab: tab as AdminTab };
    }
    return { tab: "overview" as AdminTab };
  },
  component: AdminPage,
  head: () => ({
    meta: [
      { title: i18n.t("admin.metaTitle") },
      {
        name: "description",
        content: i18n.t("admin.metaDescription"),
      },
    ],
  }),
});

function AdminPage() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin" });
  const queryClient = useQueryClient();
  const fetchVendors = useServerFn(listVendors);
  const fetchCyclists = useServerFn(listCyclists);
  const saveCyclistToDatabase = useServerFn(createCyclist);
  const saveVendorToDatabase = useServerFn(createVendor);
  const fetchPlatformCollectionHistory = useServerFn(listPlatformCollectionHistory);
  const saveVendorDetails = useServerFn(updateVendorDetails);
  const setVendorActiveState = useServerFn(updateVendorActiveState);
  const fetchVendorSalesAnalytics = useServerFn(getVendorSalesAnalytics);
  const fetchServiceZones = useServerFn(listServiceZones);
  const fetchServiceZonesForExport = useServerFn(listServiceZonesForExport);
  const saveCommune = useServerFn(createCommune);
  const saveNeighborhood = useServerFn(createNeighborhood);
  const importServiceZonesBulkInDatabase = useServerFn(importServiceZonesBulk);
  const fetchMasterProducts = useServerFn(listMasterProducts);
  const fetchMasterProductsForExport = useServerFn(listMasterProductsForExport);
  const fetchBrands = useServerFn(listBrands);
  const fetchCategories = useServerFn(listAdminCategories);
  const fetchSiteAds = useServerFn(listSiteAds);
  const fetchAnnouncements = useServerFn(listAnnouncements);
  const fetchAdminOverviewAnalytics = useServerFn(getAdminOverviewAnalytics);
  const fetchGlobalSettings = useServerFn(getGlobalSettings);
  const resetFactoryDataInDatabase = useServerFn(resetFactoryData);
  const saveGlobalSettingsToDatabase = useServerFn(updateGlobalSettings);
  const fetchAdminOrders = useServerFn(listAdminOrders);
  const fetchAdminCustomers = useServerFn(listAdminCustomers);
  const fetchAdminInvoiceSettings = useServerFn(getAdminInvoiceSettings);
  const saveAdminInvoiceSettings = useServerFn(updateAdminInvoiceSettings);
  const uploadReceiptLogoToStorage = useServerFn(uploadReceiptLogo);
  const uploadSiteLogoToStorage = useServerFn(uploadSiteLogo);
  const fetchDatabaseHealth = useServerFn(checkAdminDatabaseHealth);
  const saveMasterProductToDatabase = useServerFn(createMasterProduct);
  const importMasterProductsBulkInDatabase = useServerFn(importMasterProductsBulk);
  const uploadMasterProductImageToStorage = useServerFn(uploadMasterProductImage);
  const updateMasterProductInDatabase = useServerFn(updateMasterProduct);
  const archiveMasterProductInDatabase = useServerFn(archiveMasterProduct);
  const createBrandInDatabase = useServerFn(createBrand);
  const importBrandsBulkInDatabase = useServerFn(importBrandsBulk);
  const updateBrandInDatabase = useServerFn(updateBrand);
  const deleteBrandInDatabase = useServerFn(deleteBrand);
  const uploadBrandLogoToStorage = useServerFn(uploadBrandLogo);
  const createCategoryInDatabase = useServerFn(createCategory);
  const updateCategoryInDatabase = useServerFn(updateCategory);
  const createSiteAdInDatabase = useServerFn(createSiteAd);
  const updateSiteAdInDatabase = useServerFn(updateSiteAd);
  const deleteSiteAdInDatabase = useServerFn(deleteSiteAd);
  const createAnnouncementInDatabase = useServerFn(createAnnouncement);
  const updateAnnouncementInDatabase = useServerFn(updateAnnouncement);
  const deleteAnnouncementInDatabase = useServerFn(deleteAnnouncement);
  const fetchMarkupRules = useServerFn(listMarkupRules);
  const createMarkupRuleInDatabase = useServerFn(createMarkupRule);
  const updateMarkupRuleInDatabase = useServerFn(updateMarkupRule);
  const deleteMarkupRuleInDatabase = useServerFn(deleteMarkupRule);
  const dbHealthQuery = useQuery({
    queryKey: ["admin", "database-health"],
    queryFn: () => fetchDatabaseHealth(),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const isAdminDataEnabled = dbHealthQuery.data?.healthy ?? false;
  const vendorsQuery = useQuery({
    queryKey: ["admin", "vendors"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchVendors(),
    placeholderData: (previousData) => previousData,
  });
  const serviceZonesQuery = useQuery({
    queryKey: ["admin", "service-zones"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchServiceZones(),
    placeholderData: (previousData) => previousData,
  });
  const cyclistsQuery = useQuery({
    queryKey: ["admin", "cyclists"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchCyclists(),
    placeholderData: (previousData) => previousData,
  });
  const masterProductsQuery = useQuery({
    queryKey: ["admin", "master-products"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchMasterProducts(),
    placeholderData: (previousData) => previousData,
  });
  const brandsQuery = useQuery({
    queryKey: ["admin", "brands"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchBrands(),
    placeholderData: (previousData) => previousData,
  });
  const siteAdsQuery = useQuery({
    queryKey: ["admin", "site-ads"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchSiteAds(),
    placeholderData: (previousData) => previousData,
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchCategories(),
    placeholderData: (previousData) => previousData,
  });
  const announcementsQuery = useQuery({
    queryKey: ["admin", "announcements"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAnnouncements(),
    placeholderData: (previousData) => previousData,
  });
  const overviewAnalyticsQuery = useQuery({
    queryKey: ["admin", "overview-analytics"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminOverviewAnalytics(),
    refetchInterval: 15_000,
    placeholderData: (previousData) => previousData,
  });
  const adminOrdersQuery = useQuery({
    queryKey: ["admin", "orders-global"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminOrders(),
    refetchInterval: 10_000,
    placeholderData: (previousData) => previousData,
  });
  const adminCustomersQuery = useQuery({
    queryKey: ["admin", "customers"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminCustomers(),
    refetchInterval: 20_000,
    placeholderData: (previousData) => previousData,
  });
  const adminInvoiceSettingsQuery = useQuery({
    queryKey: ["admin", "invoice-settings"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminInvoiceSettings(),
    placeholderData: (previousData) => previousData,
  });
  const globalSettingsQuery = useQuery({
    queryKey: ["admin", "global-settings"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchGlobalSettings(),
    placeholderData: (previousData) => previousData,
  });
  const markupRulesQuery = useQuery({
    queryKey: ["admin", "markup-rules"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchMarkupRules(),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
  const vendors = vendorsQuery.data ?? initialVendors;
  const cyclists = cyclistsQuery.data ?? initialCyclists;
  const serviceZones = serviceZonesQuery.data ?? [];
  const getLocalizedCommuneName = (commune: {
    name: string;
    nameEn?: string | null;
    nameFr?: string | null;
    nameAr?: string | null;
  }) => {
    const lang = i18n.resolvedLanguage || i18n.language || "en";
    if (lang === "ar") return commune.nameAr?.trim() || commune.nameFr?.trim() || commune.nameEn || commune.name;
    if (lang === "fr") return commune.nameFr?.trim() || commune.nameEn || commune.name;
    return commune.nameEn || commune.name;
  };
  const masterProducts =
    masterProductsQuery.data?.map(
      (row): MasterProductEntity => ({
        id: row.id,
        name: row.product_name,
        nameFr: row.name_fr,
        nameAr: row.name_ar,
        productVariants: Array.isArray(row.product_variants)
          ? row.product_variants
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter((value) => value.length > 0)
          : [],
        barcode: row.barcode,
        brandId: row.brand_id,
        brandNameEn: row.brands?.name_en,
        brandNameFr: row.brands?.name_fr,
        brandNameAr: row.brands?.name_ar,
        brandLogoUrl: row.brands?.logo_url,
        categoryId: row.category_id,
        category: row.category,
        measurementValue: row.measurement_value != null ? Number(row.measurement_value) : null,
        measurementUnit: row.measurement_unit,
        popularityScore: row.popularity_score,
        imageUrl: row.image_url,
        createdAt: row.created_at,
      }),
    ) ?? initialMasterProducts;
  const adminOrders = adminOrdersQuery.data ?? initialAdminOrders;
  const adminCustomers =
    (adminCustomersQuery.data as
      | Array<{
          id: string;
          fullName: string;
          phone: string;
          address: string;
          joinedAt: string;
          totalOrders: number;
          ltvMad: number;
        }>
      | undefined) ?? [];
  const categories = (categoriesQuery.data ?? initialCategories) as CategoryAdminRow[];
  const brands = (brandsQuery.data ?? initialBrands) as BrandAdminRow[];
  const markupRules = (markupRulesQuery.data ?? []) as MarkupRuleAdminRow[];
  const activeCategories = categories.filter((category) => category.is_active);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("all");
  const [catalogBrandFilter, setCatalogBrandFilter] = useState("all");
  const filteredMasterProducts = useMemo(() => {
    const searchTerm = catalogSearchTerm.trim().toLowerCase();

    return masterProducts.filter((product) => {
      const categoryMatch = catalogCategoryFilter === "all" || product.categoryId === catalogCategoryFilter;
      const brandMatch = catalogBrandFilter === "all" || product.brandId === catalogBrandFilter;

      if (!categoryMatch || !brandMatch) return false;
      if (!searchTerm) return true;

      return [product.name, product.nameFr ?? "", product.nameAr ?? "", product.barcode ?? ""].some((value) =>
        value.toLowerCase().includes(searchTerm),
      );
    });
  }, [masterProducts, catalogSearchTerm, catalogCategoryFilter, catalogBrandFilter]);

  const [isVendorPanelOpen, setIsVendorPanelOpen] = useState(false);
  const [isCyclistPanelOpen, setIsCyclistPanelOpen] = useState(false);
  const [isManageVendorPanelOpen, setIsManageVendorPanelOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSavingAd, setIsSavingAd] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isUpdatingVendorState, setIsUpdatingVendorState] = useState(false);
  const [isUpdatingVendorDetails, setIsUpdatingVendorDetails] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<AdminVendorRecord | null>(null);
  const [isInitiateWithdrawalOpen, setIsInitiateWithdrawalOpen] = useState(false);
  const [platformCollectionScanTargetVendor, setPlatformCollectionScanTargetVendor] = useState<AdminVendorRecord | null>(null);
  const [amountToCollectMad, setAmountToCollectMad] = useState(0);
  const [platformCollectionQrPayload, setPlatformCollectionQrPayload] = useState<string | null>(null);
  const [pendingArchiveProduct, setPendingArchiveProduct] = useState<MasterProductEntity | null>(null);

  const [vendorForm, setVendorForm] = useState({
    storeName: "",
    ownerName: "",
    phoneNumber: "",
    vendorType: "general" as "general" | "specialized",
    assignedCategories: [] as string[],
    communeId: "",
    neighborhoodIds: [] as string[],
    isActive: true,
  });
  const [cyclistForm, setCyclistForm] = useState({
    fullName: "",
    phoneNumber: "",
    communeId: "",
    neighborhoodIds: [] as string[],
    isActive: true,
  });
  const [serviceZoneForm, setServiceZoneForm] = useState({
    communeNameEn: "",
    communeNameFr: "",
    communeNameAr: "",
    neighborhoodCommuneId: "",
    neighborhoodNameEn: "",
    neighborhoodNameFr: "",
    neighborhoodNameAr: "",
    neighborhoodDeliveryFee: "0",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    nameFr: "",
    nameAr: "",
    productVariants: "",
    brandId: "",
    categoryId: "",
    measurementValue: "",
    measurementUnit: "Piece" as MeasurementUnit,
    popularityScore: "0",
  });
  const [productVariantInput, setProductVariantInput] = useState("");
  const [categoryForm, setCategoryForm] = useState({
    id: "",
    nameEn: "",
    nameFr: "",
    nameAr: "",
    imageUrl: "",
    iconName: "Carrot" as CategoryIconName,
    accentColor: "#f3f4f6",
    sortOrder: "0",
    isActive: true,
  });
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryImagePreviewUrl, setCategoryImagePreviewUrl] = useState<string | null>(null);
  const categoryImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreviewUrl, setProductImagePreviewUrl] = useState<string | null>(null);
  const [currentProductImageUrl, setCurrentProductImageUrl] = useState<string | null>(null);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState({
    nameEn: "",
    nameFr: "",
    nameAr: "",
    logoUrl: "",
  });
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [brandLogoPreviewUrl, setBrandLogoPreviewUrl] = useState<string | null>(null);
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [isImportingBrands, setIsImportingBrands] = useState(false);
  const [isImportingMasterProducts, setIsImportingMasterProducts] = useState(false);
  const [isImportingServiceZones, setIsImportingServiceZones] = useState(false);
  const brandLogoInputRef = useRef<HTMLInputElement | null>(null);
  const brandCsvInputRef = useRef<HTMLInputElement | null>(null);
  const masterProductsCsvInputRef = useRef<HTMLInputElement | null>(null);
  const serviceZonesCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [manageVendorForm, setManageVendorForm] = useState({
    vendorId: "",
    storeName: "",
    ownerName: "",
    phoneNumber: "",
    vendorType: "general" as "general" | "specialized",
    assignedCategories: [] as string[],
    communeId: "",
    neighborhoodIds: [] as string[],
    isActive: true,
  });
  const [adForm, setAdForm] = useState({
    id: "",
    campaignName: "",
    zoneId: "global",
    campaignType: "AD" as "AD" | "PROMO" | "NEWS",
    imageAr: "",
    imageFr: "",
    imageEn: "",
    targetUrl: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });
  const [announcementForm, setAnnouncementForm] = useState({
    id: "",
    title: "",
    messagesEn: [""],
    messagesFr: [""],
    messagesAr: [""],
    startDate: "",
    endDate: "",
    isActive: true,
    bgColor: "#deff9a",
    textColor: "#000000",
  });
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<
    "all" | "new" | "preparing" | "ready" | "delivering" | "delivered" | "delivered_cash_with_cyclist" | "cash_transferred_to_vendor"
  >("all");
  const [settingsForm, setSettingsForm] = useState({
    id: "",
    deliveryFeeMad: "10",
    minimumOrderMad: "50",
    freeDeliveryThresholdMad: "500",
    marketplaceActive: true,
    siteName: "Bzaf Fresh",
    siteLogoUrl: "",
  });
  const [siteLogoFile, setSiteLogoFile] = useState<File | null>(null);
  const [siteLogoPreviewUrl, setSiteLogoPreviewUrl] = useState<string | null>(null);
  const [isSavingGlobalSettings, setIsSavingGlobalSettings] = useState(false);
  const [isFactoryResetDialogOpen, setIsFactoryResetDialogOpen] = useState(false);
  const [factoryResetConfirmationText, setFactoryResetConfirmationText] = useState("");
  const [isResettingFactoryData, setIsResettingFactoryData] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    id: "",
    receiptLogoUrl: "",
    receiptStoreName: DEFAULT_RECEIPT_STORE_NAME,
    receiptSlogan: DEFAULT_RECEIPT_SLOGAN,
    receiptPhone: DEFAULT_RECEIPT_PHONE,
    receiptAddress: DEFAULT_RECEIPT_ADDRESS,
    receiptWebsite: DEFAULT_RECEIPT_WEBSITE,
    taxId: "",
    receiptFooterMessage: DEFAULT_RECEIPT_FOOTER_MESSAGE,
    receiptSocialSupport: DEFAULT_RECEIPT_SOCIAL_SUPPORT,
  });
  const [receiptLogoFile, setReceiptLogoFile] = useState<File | null>(null);
  const [receiptLogoPreviewUrl, setReceiptLogoPreviewUrl] = useState<string | null>(null);
  const [isSavingReceiptSettings, setIsSavingReceiptSettings] = useState(false);
  const [isMarkupRuleDialogOpen, setIsMarkupRuleDialogOpen] = useState(false);
  const [editingMarkupRuleId, setEditingMarkupRuleId] = useState<string | null>(null);
  const [isSavingMarkupRule, setIsSavingMarkupRule] = useState(false);
  const [markupRuleForm, setMarkupRuleForm] = useState({
    minPrice: "",
    maxPrice: "",
    markupType: "fixed" as "fixed" | "percentage",
    markupValue: "",
    isActive: true,
  });

  useEffect(() => {
    const row = globalSettingsQuery.data;
    if (!row?.id) {
      return;
    }

    setSettingsForm((current) => {
      if (current.id === row.id) {
        return current;
      }

      return {
        id: row.id,
        deliveryFeeMad: String(Number(row.global_delivery_fee ?? 10)),
        minimumOrderMad: String(Number(row.minimum_order_amount ?? 50)),
        freeDeliveryThresholdMad: String(Number(row.free_delivery_threshold ?? 500)),
        marketplaceActive: Boolean(row.marketplace_active ?? true),
        siteName: row.site_name?.trim() || "Bzaf Fresh",
        siteLogoUrl: row.site_logo_url?.trim() || "",
      };
    });

    setSiteLogoFile(null);
    setSiteLogoPreviewUrl(row.site_logo_url?.trim() || null);
  }, [globalSettingsQuery.data]);

  useEffect(() => {
    const row = adminInvoiceSettingsQuery.data;
    if (!row?.id) {
      return;
    }

    setReceiptForm((current) => {
      if (current.id === row.id) {
        return current;
      }

      return {
        id: row.id,
        receiptLogoUrl: row.receipt_logo_url ?? "",
        receiptStoreName: row.receipt_store_name ?? row.store_name ?? DEFAULT_RECEIPT_STORE_NAME,
        receiptSlogan: row.receipt_slogan ?? DEFAULT_RECEIPT_SLOGAN,
        receiptPhone: row.receipt_phone ?? row.phone ?? DEFAULT_RECEIPT_PHONE,
        receiptAddress: row.receipt_address ?? row.address ?? DEFAULT_RECEIPT_ADDRESS,
        receiptWebsite: row.receipt_website ?? DEFAULT_RECEIPT_WEBSITE,
        taxId: row.tax_id ?? "",
        receiptFooterMessage: row.receipt_footer_message ?? row.footer_message ?? DEFAULT_RECEIPT_FOOTER_MESSAGE,
        receiptSocialSupport: row.receipt_social_support ?? DEFAULT_RECEIPT_SOCIAL_SUPPORT,
      };
    });

    setReceiptLogoFile(null);
    setReceiptLogoPreviewUrl(row.receipt_logo_url ?? null);

  }, [adminInvoiceSettingsQuery.data]);

  const analyticsQuery = useQuery({
    queryKey: ["admin", "vendor-analytics", selectedVendor?.id],
    enabled: Boolean(isManageVendorPanelOpen && selectedVendor?.id),
    queryFn: () => fetchVendorSalesAnalytics({ data: { vendorId: selectedVendor!.id } }),
  });

  const platformCollectionHistoryQuery = useQuery({
    queryKey: ["admin", "platform-collections-history", platformCollectionScanTargetVendor?.id ?? null],
    enabled: isAdminDataEnabled && isInitiateWithdrawalOpen && Boolean(platformCollectionScanTargetVendor?.id),
    queryFn: () =>
      fetchPlatformCollectionHistory({
        data: { vendorId: platformCollectionScanTargetVendor!.id },
      }),
    refetchInterval: isInitiateWithdrawalOpen ? 10_000 : false,
    placeholderData: (previousData) => previousData,
  });

  const filteredOrders = useMemo(
    () =>
      ordersStatusFilter === "all"
        ? adminOrders
        : adminOrders.filter((order) => order.status === ordersStatusFilter),
    [adminOrders, ordersStatusFilter],
  );

  const communeOptions = serviceZones;
  const adTargetZones = useMemo(
    () =>
      communeOptions.flatMap((commune) =>
        commune.neighborhoods.map((zone) => ({
          id: zone.id,
          zoneCode: zone.zoneCode,
          communeName: getLocalizedCommuneName(commune),
          zoneName: zone.name,
        })),
      ),
    [communeOptions],
  );
  const neighborhoodOptions = communeOptions.find((commune) => commune.id === vendorForm.communeId)?.neighborhoods ?? [];
  const cyclistNeighborhoodOptions =
    communeOptions.find((commune) => commune.id === cyclistForm.communeId)?.neighborhoods ?? [];

  const addVendorNeighborhoodOptions = neighborhoodOptions.filter((neighborhood) => neighborhood.vendorId == null);

  const selectedVendorId = selectedVendor?.id ?? manageVendorForm.vendorId;
  const manageNeighborhoodOptions =
    communeOptions
      .find((commune) => commune.id === manageVendorForm.communeId)
      ?.neighborhoods.filter(
        (neighborhood) => neighborhood.vendorId == null || neighborhood.vendorId === selectedVendorId,
      ) ?? [];

  const vendorScopedCollectionHistory = (platformCollectionHistoryQuery.data ?? []) as PlatformCollectionHistoryItem[];

  const formatCollectionDateTime = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  const toggleVendorNeighborhood = (neighborhoodId: string, checked: boolean) => {
    setVendorForm((current) => {
      const currentSet = new Set(current.neighborhoodIds);
      if (checked) currentSet.add(neighborhoodId);
      else currentSet.delete(neighborhoodId);

      return {
        ...current,
        neighborhoodIds: Array.from(currentSet),
      };
    });
  };

  const toggleManageVendorNeighborhood = (neighborhoodId: string, checked: boolean) => {
    setManageVendorForm((current) => {
      const currentSet = new Set(current.neighborhoodIds);
      if (checked) currentSet.add(neighborhoodId);
      else currentSet.delete(neighborhoodId);

      return {
        ...current,
        neighborhoodIds: Array.from(currentSet),
      };
    });
  };

  const toggleCyclistNeighborhood = (neighborhoodId: string, checked: boolean) => {
    setCyclistForm((current) => {
      const currentSet = new Set(current.neighborhoodIds);
      if (checked) {
        currentSet.add(neighborhoodId);
      } else {
        currentSet.delete(neighborhoodId);
      }

      return {
        ...current,
        neighborhoodIds: Array.from(currentSet),
      };
    });
  };
  const openManageVendorPanel = (vendor: AdminVendorRecord) => {
    const matchingCommune = serviceZones.find((commune) =>
      commune.neighborhoods.some((neighborhood) => vendor.neighborhoodIds.includes(neighborhood.id)),
    );

    setSelectedVendor(vendor);
    setManageVendorForm({
      vendorId: vendor.id,
      storeName: vendor.storeName,
      ownerName: vendor.ownerName,
      phoneNumber: normalizeMoroccoPhoneInput(vendor.phoneNumber),
      vendorType: vendor.vendorType ?? "general",
      assignedCategories: vendor.assignedCategories ?? [],
      communeId: matchingCommune?.id ?? "",
      neighborhoodIds: vendor.neighborhoodIds,
      isActive: vendor.status === "Active",
    });
    setIsManageVendorPanelOpen(true);
  };

  const openPlatformCollectionQr = (vendor: AdminVendorRecord) => {
    const pending = Number(vendor.platformDuesMad ?? 0);
    if (!Number.isFinite(pending) || pending <= 0) {
      toast.info("No platform commission pending for this vendor.");
      return;
    }
    setPlatformCollectionScanTargetVendor(vendor);
    setAmountToCollectMad(Number(pending.toFixed(2)));
    setPlatformCollectionQrPayload(null);
    setIsInitiateWithdrawalOpen(true);
  };

  const activeCollectionVendor = platformCollectionScanTargetVendor
    ? vendors.find((vendor) => vendor.id === platformCollectionScanTargetVendor.id) ?? platformCollectionScanTargetVendor
    : null;

  const handleGenerateWithdrawalQr = () => {
    const vendor = activeCollectionVendor;
    if (!vendor) return;

    const pending = Number(vendor.platformDuesMad ?? 0);
    const amount = Number(amountToCollectMad ?? 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > pending) {
      toast.error(`Amount must be > 0 and ≤ ${pending.toFixed(2)} MAD.`);
      return;
    }

    const payload = platformCommissionPaymentQrPayloadSchema.parse({
      action: "platform_commission_payment",
      vendor_id: vendor.id,
      amount: Number(amount.toFixed(2)),
      timestamp: new Date().toISOString(),
    });

    setPlatformCollectionQrPayload(JSON.stringify(payload));
    toast.success("Commission payment QR generated.");
  };

  useEffect(() => {
    if (!isInitiateWithdrawalOpen) {
      return;
    }

    const channel = supabase
      .channel("admin-platform-commission-ledger-withdrawals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "platform_commission_ledger",
          filter: "transaction_type=eq.WITHDRAWAL",
        },
        (payload) => {
          const insertedVendorId =
            payload.new && typeof payload.new === "object" && "vendor_id" in payload.new
              ? String((payload.new as { vendor_id?: unknown }).vendor_id ?? "")
              : "";

          if (!insertedVendorId || insertedVendorId !== platformCollectionScanTargetVendor?.id) {
            return;
          }

          toast.success("Payment received successfully! تم استلام المستحقات بنجاح");

          void queryClient.invalidateQueries({ queryKey: ["admin", "vendors"] });
          void queryClient.invalidateQueries({
            queryKey: ["admin", "platform-collections-history", insertedVendorId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isInitiateWithdrawalOpen, platformCollectionScanTargetVendor?.id, queryClient]);

  useEffect(() => {
    if (!isAdminDataEnabled) return;

    const pendingViewsById = new Map<string, number>();
    let flushTimer: number | null = null;

    const flushViews = () => {
      flushTimer = null;
      if (pendingViewsById.size === 0) return;

      const nextViews = new Map(pendingViewsById);
      pendingViewsById.clear();

      queryClient.setQueryData(
        ["admin", "site-ads"],
        (current: Array<{ id: string; views_count: number } & Record<string, unknown>> | undefined) => {
          if (!current || current.length === 0) return current;

          let hasChanges = false;
          const updatedRows = current.map((row) => {
            const nextCount = nextViews.get(row.id);
            if (typeof nextCount !== "number" || row.views_count === nextCount) {
              return row;
            }
            hasChanges = true;
            return { ...row, views_count: nextCount };
          });

          return hasChanges ? updatedRows : current;
        },
      );
    };

    const queueViewUpdate = (id: string, viewsCount: number) => {
      pendingViewsById.set(id, viewsCount);
      if (flushTimer !== null) return;
      flushTimer = window.setTimeout(flushViews, 120);
    };

    const channel = supabase
      .channel("admin-site-ads-live-views")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_ads",
        },
        (payload) => {
          const updated = payload.new as { id?: string; views_count?: number } | null;
          const previous = payload.old as { views_count?: number } | null;
          if (!updated?.id || typeof updated.views_count !== "number") return;
          if (typeof previous?.views_count === "number" && previous.views_count === updated.views_count) return;
          queueViewUpdate(updated.id, updated.views_count);
        },
      )
      .subscribe();

    return () => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
      pendingViewsById.clear();
      void supabase.removeChannel(channel);
    };
  }, [isAdminDataEnabled, queryClient]);

  const handleVendorActiveStateToggle = async (isActive: boolean) => {
    if (!manageVendorForm.vendorId) {
      return;
    }

    setIsUpdatingVendorState(true);
    try {
      await setVendorActiveState({
        data: {
          vendorId: manageVendorForm.vendorId,
          isActive,
        },
      });

      setManageVendorForm((current) => ({ ...current, isActive }));
      await vendorsQuery.refetch();
      toast.success(isActive ? t("admin.toast.vendorActivated") : t("admin.toast.vendorSuspended"));
    } catch (error) {
      console.error("Failed to update vendor state:", error);
      toast.error(t("admin.toast.vendorStatusUpdateFailed"));
    } finally {
      setIsUpdatingVendorState(false);
    }
  };

  const handleUpdateVendorDetails = async () => {
    const normalizedPhone = normalizeMoroccoPhoneInput(manageVendorForm.phoneNumber);

    if (
      !manageVendorForm.vendorId ||
      !manageVendorForm.storeName.trim() ||
      !manageVendorForm.ownerName.trim() ||
      manageVendorForm.neighborhoodIds.length === 0 ||
      !isValidMoroccoPhone(normalizedPhone)
    ) {
      toast.error(t("admin.toast.completeVendorDetails"));
      return;
    }

    setIsUpdatingVendorDetails(true);
    try {
      await saveVendorDetails({
        data: {
          vendorId: manageVendorForm.vendorId,
          storeName: manageVendorForm.storeName.trim(),
          ownerName: manageVendorForm.ownerName.trim(),
          phoneNumber: formatMoroccoPhoneForPayload(normalizedPhone),
          vendorType: manageVendorForm.vendorType,
          assignedCategories: manageVendorForm.assignedCategories,
          neighborhoodIds: manageVendorForm.neighborhoodIds,
        },
      });

      await vendorsQuery.refetch();
      toast.success(t("admin.toast.vendorDetailsUpdated"));
    } catch (error) {
      console.error("Failed to update vendor details:", error);
      toast.error(t("admin.toast.vendorDetailsUpdateFailed"));
    } finally {
      setIsUpdatingVendorDetails(false);
    }
  };

  const saveVendor = async () => {
    const normalizedPhone = normalizeMoroccoPhoneInput(vendorForm.phoneNumber);

    if (
      !vendorForm.storeName ||
      !vendorForm.ownerName ||
      vendorForm.neighborhoodIds.length === 0 ||
      !isValidMoroccoPhone(normalizedPhone)
    ) {
      toast.error(t("admin.toast.completeVendorFields"));
      return;
    }

    try {
      await saveVendorToDatabase({
        data: {
          storeName: vendorForm.storeName.trim(),
          ownerName: vendorForm.ownerName.trim(),
          phoneNumber: formatMoroccoPhoneForPayload(normalizedPhone),
          vendorType: vendorForm.vendorType,
          assignedCategories: vendorForm.assignedCategories,
          neighborhoodIds: vendorForm.neighborhoodIds,
          isActive: vendorForm.isActive,
        },
      });

      await vendorsQuery.refetch();
      setVendorForm({
        storeName: "",
        ownerName: "",
        phoneNumber: "",
        vendorType: "general",
        assignedCategories: [],
        communeId: "",
        neighborhoodIds: [],
        isActive: true,
      });
      setIsVendorPanelOpen(false);
      toast.success(t("admin.toast.vendorSaved"));
    } catch (error) {
      console.error("Failed to save vendor:", error);
      toast.error(t("admin.toast.vendorSaveFailed"));
    }
  };

  const saveCyclist = async () => {
    const normalizedPhone = normalizeMoroccoPhoneInput(cyclistForm.phoneNumber);

    if (
      !cyclistForm.fullName.trim() ||
      !cyclistForm.communeId ||
      cyclistForm.neighborhoodIds.length === 0 ||
      !isValidMoroccoPhone(normalizedPhone)
    ) {
      toast.error(t("admin.toast.completeCyclistFields"));
      return;
    }

    try {
      const created = await saveCyclistToDatabase({
        data: {
          fullName: cyclistForm.fullName.trim(),
          phoneNumber: formatMoroccoPhoneForPayload(normalizedPhone),
          neighborhoodIds: cyclistForm.neighborhoodIds,
          isActive: cyclistForm.isActive,
        },
      });

      queryClient.setQueryData(["admin", "cyclists"], (current: AdminCyclistRecord[] | undefined) => [
        created,
        ...(current ?? []),
      ]);
      setCyclistForm({
        fullName: "",
        phoneNumber: "",
        communeId: "",
        neighborhoodIds: [],
        isActive: true,
      });
      setIsCyclistPanelOpen(false);
      toast.success(t("admin.toast.cyclistSaved"));
    } catch (error) {
      console.error("Failed to save cyclist:", error);
      toast.error(t("admin.toast.cyclistSaveFailed"));
    }
  };

  const saveCommuneHandler = async () => {
    if (!serviceZoneForm.communeNameEn.trim()) {
      toast.error(t("admin.toast.communeNameRequired"));
      return;
    }

    try {
      await saveCommune({
        data: {
          nameEn: serviceZoneForm.communeNameEn.trim(),
          nameFr: serviceZoneForm.communeNameFr.trim() || null,
          nameAr: serviceZoneForm.communeNameAr.trim() || null,
        },
      });
      await serviceZonesQuery.refetch();
      setServiceZoneForm((current) => ({ ...current, communeNameEn: "", communeNameFr: "", communeNameAr: "" }));
      toast.success(t("admin.toast.communeCreated"));
    } catch (error) {
      console.error("Failed to create commune:", error);
      toast.error(t("admin.toast.communeCreateFailed"));
    }
  };

  const saveNeighborhoodHandler = async () => {
    const parsedDeliveryFee = Number(serviceZoneForm.neighborhoodDeliveryFee);

    if (
      !serviceZoneForm.neighborhoodCommuneId ||
      !serviceZoneForm.neighborhoodNameEn.trim() ||
      Number.isNaN(parsedDeliveryFee) ||
      parsedDeliveryFee < 0
    ) {
      toast.error(t("admin.toast.neighborhoodRequired"));
      return;
    }

    try {
      await saveNeighborhood({
        data: {
          communeId: serviceZoneForm.neighborhoodCommuneId,
          nameEn: serviceZoneForm.neighborhoodNameEn.trim(),
          nameFr: serviceZoneForm.neighborhoodNameFr.trim() || null,
          nameAr: serviceZoneForm.neighborhoodNameAr.trim() || null,
          deliveryFee: parsedDeliveryFee,
        },
      });
      await serviceZonesQuery.refetch();
      setServiceZoneForm((current) => ({
        ...current,
        neighborhoodNameEn: "",
        neighborhoodNameFr: "",
        neighborhoodNameAr: "",
        neighborhoodDeliveryFee: "0",
      }));
      toast.success(t("admin.toast.neighborhoodCreated"));
    } catch (error) {
      console.error("Failed to create neighborhood:", error);
      toast.error(t("admin.toast.neighborhoodCreateFailed"));
    }
  };

  const downloadServiceZonesExport = async () => {
    try {
      const rows = await fetchServiceZonesForExport();
      const csvRows = [
        SERVICE_ZONES_BULK_HEADERS.join(";"),
        ...rows.map((row) =>
          [
            row.zoneCode,
            row.communeEn,
            row.communeFr ?? "",
            row.communeAr ?? "",
            row.douarEn,
            row.douarFr ?? "",
            row.douarAr ?? "",
            String(Number(row.deliveryFee ?? 0)),
          ]
            .map((cell) => {
              const value = String(cell ?? "");
              if (value.includes(";") || value.includes("\n") || value.includes('"')) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(";"),
        ),
      ];

      const csvContent = `\uFEFF${csvRows.join("\n")}\n`;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "service-zones-export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Service zones export ready: ${rows.length} douars.`);
    } catch (error) {
      console.error("Failed to export service zones:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export service zones.");
    }
  };

  const importServiceZonesFromSheet = async (file: File) => {
    const lowerCaseName = file.name.toLowerCase();
    const isCsv = lowerCaseName.endsWith(".csv");
    const isXlsx = lowerCaseName.endsWith(".xlsx");

    if (!isCsv && !isXlsx) {
      toast.error(t("admin.toast.uploadXlsxOrCsv"));
      return;
    }

    try {
      setIsImportingServiceZones(true);

      const parseSpreadsheetRows = async () => {
        if (isCsv) {
          const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
            Papa.parse<Record<string, string>>(file, {
              header: true,
              delimiter: ";",
              transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
              skipEmptyLines: true,
              complete: resolve,
              error: reject,
            });
          });

          return {
            uploadedHeaders: parsed.meta.fields ?? [],
            rows: parsed.data,
          };
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error("The uploaded XLSX file has no worksheet.");
        }

        const headerRow = worksheet.getRow(1);
        const uploadedHeaders = SERVICE_ZONES_BULK_HEADERS.map((_, index) =>
          String(headerRow.getCell(index + 1).text ?? "")
            .replace(/^\uFEFF/, "")
            .trim(),
        );

        const rows: Array<Record<string, string>> = [];
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
          const row = worksheet.getRow(rowNumber);
          const mappedRow: Record<string, string> = {};
          let hasAnyValue = false;

          SERVICE_ZONES_BULK_HEADERS.forEach((header, headerIndex) => {
            const rawValue = String(row.getCell(headerIndex + 1).text ?? "").trim();
            mappedRow[header] = rawValue;
            if (rawValue.length > 0) hasAnyValue = true;
          });

          if (hasAnyValue) rows.push(mappedRow);
        }

        return { uploadedHeaders, rows };
      };

      const parsedSpreadsheet = await parseSpreadsheetRows();
      const missingHeaders = SERVICE_ZONES_BULK_HEADERS.filter(
        (header) => !parsedSpreadsheet.uploadedHeaders.includes(header),
      );

      if (missingHeaders.length > 0) {
        toast.error(`Missing required headers: ${missingHeaders.join(", ")}`);
        return;
      }

      const preparedRows = parsedSpreadsheet.rows
        .map((row) => ({
          zoneCode: row.Zone_Code?.trim() || null,
          communeEn: row.Commune_EN?.trim() || "",
          communeFr: row.Commune_FR?.trim() || null,
          communeAr: row.Commune_AR?.trim() || null,
          douarEn: row.Douar_EN?.trim() || "",
          douarFr: row.Douar_FR?.trim() || null,
          douarAr: row.Douar_AR?.trim() || null,
          deliveryFee: row.Delivery_Fee?.trim() || "0",
        }))
        .filter((row) => row.communeEn.length > 0 && row.douarEn.length > 0);

      if (preparedRows.length === 0) {
        toast.error(t("admin.toast.noValidServiceZonesRows"));
        return;
      }

      const result = await importServiceZonesBulkInDatabase({ data: { rows: preparedRows } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "service-zones"] });

      const summary = t("admin.toast.serviceZonesImportSummary", {
        inserted: result.insertedCount,
        updated: result.updatedCount,
        skippedSuffix: result.skippedCount > 0 ? t("admin.toast.skippedSuffix", { skipped: result.skippedCount }) : "",
      });

      if (result.skippedCount > 0) {
        toast.warning(summary);
        for (const warning of result.warnings.slice(0, 5)) {
          toast.error(warning);
        }
      } else {
        toast.success(summary);
      }
    } catch (error) {
      console.error("Failed to import service zones file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import service zones file.");
    } finally {
      setIsImportingServiceZones(false);
      if (serviceZonesCsvInputRef.current) {
        serviceZonesCsvInputRef.current.value = "";
      }
    }
  };

  const handleServiceZonesCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    await importServiceZonesFromSheet(file);
  };

  const parsedProductVariants = useMemo(
    () =>
      productForm.productVariants
        .split(",")
        .map((value) => value.trim())
        .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index),
    [productForm.productVariants],
  );

  const addProductVariantTag = (rawValue: string) => {
    const normalizedValue = rawValue.trim();
    if (!normalizedValue) return;
    if (parsedProductVariants.includes(normalizedValue)) {
      setProductVariantInput("");
      return;
    }

    setProductForm((current) => ({
      ...current,
      productVariants: [...parsedProductVariants, normalizedValue].join(", "),
    }));
    setProductVariantInput("");
  };

  const removeProductVariantTag = (variantToRemove: string) => {
    setProductForm((current) => ({
      ...current,
      productVariants: parsedProductVariants.filter((variant) => variant !== variantToRemove).join(", "),
    }));
  };

  const saveMasterProduct = async () => {
    const parsedMeasurementValue = productForm.measurementValue.trim()
      ? Number(productForm.measurementValue)
      : null;
    const parsedForm = masterProductFormSchema.safeParse({
      name: productForm.name,
      nameFr: productForm.nameFr,
      nameAr: productForm.nameAr,
      productVariants: parsedProductVariants,
      brandId: productForm.brandId.trim() ? productForm.brandId : null,
      categoryId: productForm.categoryId,
      measurementValue: parsedMeasurementValue,
      measurementUnit: productForm.measurementUnit,
      popularityScore: Number(productForm.popularityScore),
    });

    if (!parsedForm.success) {
      toast.error(t("admin.toast.invalidProductData"));
      return;
    }

    const selectedCategory = activeCategories.find((category) => category.id === productForm.categoryId);
    if (!selectedCategory) {
      toast.error(t("admin.toast.invalidSelectedCategory"));
      return;
    }

    if (!editingProductId && !productImageFile) {
      toast.error(t("admin.toast.productImageRequired"));
      return;
    }

    try {
      setIsUploadingProduct(true);
      let imageUrl = editingProductId ? currentProductImageUrl : null;

      if (productImageFile) {
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Invalid image format."));
          };
          reader.onerror = () => reject(new Error("Unable to read image."));
          reader.readAsDataURL(productImageFile);
        });

        const uploaded = await uploadMasterProductImageToStorage({
          data: {
            fileName: productImageFile.name,
            contentType: productImageFile.type || "image/jpeg",
            dataUrl: imageDataUrl,
          },
        });

        imageUrl = uploaded.publicUrl;
      }

      if (editingProductId) {
        const payload = {
          id: editingProductId,
          name: productForm.name.trim(),
          nameFr: productForm.nameFr.trim(),
          nameAr: productForm.nameAr.trim(),
          productVariants: parsedForm.data.productVariants,
          brandId: productForm.brandId.trim() ? productForm.brandId : null,
          categoryId: productForm.categoryId,
          measurementValue: parsedMeasurementValue,
          measurementUnit: productForm.measurementUnit,
          popularityScore: Number(productForm.popularityScore),
          imageUrl: imageUrl ?? null,
        };
        console.log("Payload being sent:", payload);
        await updateMasterProductInDatabase({
          data: {
            ...payload,
          },
        });

        await queryClient.invalidateQueries({ queryKey: ["admin", "master-products"] });
        toast.success(t("admin.toast.masterProductUpdated"));
      } else {
        const payload = {
          name: productForm.name.trim(),
          nameFr: productForm.nameFr.trim(),
          nameAr: productForm.nameAr.trim(),
          productVariants: parsedForm.data.productVariants,
          brandId: productForm.brandId.trim() ? productForm.brandId : null,
          categoryId: productForm.categoryId,
          measurementValue: parsedMeasurementValue,
          measurementUnit: productForm.measurementUnit,
          popularityScore: Number(productForm.popularityScore),
          imageUrl: imageUrl ?? null,
        };
        console.log("Payload being sent:", payload);
        await saveMasterProductToDatabase({
          data: {
            ...payload,
          },
        });

        await queryClient.invalidateQueries({ queryKey: ["admin", "master-products"] });
        toast.success(t("admin.toast.masterProductSaved"));
      }

      setProductForm({
        name: "",
        nameFr: "",
        nameAr: "",
        productVariants: "",
        brandId: "",
        categoryId: "",
        measurementValue: "",
        measurementUnit: "Piece",
        popularityScore: "0",
      });
      setProductVariantInput("");
      setEditingProductId(null);
      setProductImageFile(null);
      setProductImagePreviewUrl(null);
      setCurrentProductImageUrl(null);
      setIsProductModalOpen(false);
    } catch (error) {
      console.error("Failed to save master product:", error);
      const message = error instanceof Error ? error.message : "Failed to save master product.";
      const uiMessage = message.startsWith("Storage Error:") || message.startsWith("DB Error:") ? message : `DB Error: ${message}`;
      toast.error(uiMessage);
    } finally {
      setIsUploadingProduct(false);
    }
  };

  const applyProductImageFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error(t("admin.toast.uploadValidImage"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProductImageFile(file);
      setProductImagePreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => toast.error(t("admin.toast.previewImageFailed"));
    reader.readAsDataURL(file);
  };

  const handleProductImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyProductImageFile(event.target.files?.[0] ?? null);
  };

  const handleProductImageDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    applyProductImageFile(event.dataTransfer.files?.[0] ?? null);
  };

  const openCreateProductModal = () => {
    setEditingProductId(null);
    setProductForm({
      name: "",
      nameFr: "",
      nameAr: "",
      productVariants: "",
      brandId: "",
      categoryId: "",
      measurementValue: "",
      measurementUnit: "Piece",
      popularityScore: "0",
    });
    setProductVariantInput("");
    setProductImageFile(null);
    setProductImagePreviewUrl(null);
    setCurrentProductImageUrl(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: MasterProductEntity) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      nameFr: product.nameFr ?? product.name,
      nameAr: product.nameAr ?? product.name,
      productVariants: Array.isArray(product.productVariants) ? product.productVariants.join(", ") : "",
      brandId: product.brandId ?? "",
      categoryId: product.categoryId ?? "",
      measurementValue:
        product.measurementValue != null && Number.isFinite(product.measurementValue)
          ? String(product.measurementValue)
          : "",
      measurementUnit: product.measurementUnit,
      popularityScore: String(Math.max(0, Math.trunc(product.popularityScore ?? 0))),
    });
    setProductVariantInput("");
    setProductImageFile(null);
    setCurrentProductImageUrl(product.imageUrl ?? null);
    setProductImagePreviewUrl(product.imageUrl ?? fallbackProductImage);
    setIsProductModalOpen(true);
  };

  const resetBrandForm = () => {
    setEditingBrandId(null);
    setBrandForm({ nameEn: "", nameFr: "", nameAr: "", logoUrl: "" });
    setBrandLogoFile(null);
    setBrandLogoPreviewUrl(null);
  };

  const openCreateBrandModal = () => {
    resetBrandForm();
    setIsBrandModalOpen(true);
  };

  const openEditBrandModal = (brand: BrandAdminRow) => {
    setEditingBrandId(brand.id);
    setBrandForm({
      nameEn: brand.name_en,
      nameFr: brand.name_fr ?? "",
      nameAr: brand.name_ar ?? "",
      logoUrl: brand.logo_url ?? "",
    });
    setBrandLogoFile(null);
    setBrandLogoPreviewUrl(brand.logo_url ?? null);
    setIsBrandModalOpen(true);
  };

  const applyBrandLogoFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("admin.toast.uploadValidImage"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrandLogoFile(file);
      setBrandLogoPreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => toast.error(t("admin.toast.previewImageFailed"));
    reader.readAsDataURL(file);
  };

  const handleBrandLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyBrandLogoFile(event.target.files?.[0] ?? null);
  };

  const saveBrandHandler = async () => {
    if (!brandForm.nameEn.trim()) {
      toast.error(t("admin.toast.brandEnglishNameRequired"));
      return;
    }

    try {
      setIsSavingBrand(true);
      let logoUrl = brandForm.logoUrl.trim() || null;

      if (brandLogoFile) {
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Invalid image format."));
          };
          reader.onerror = () => reject(new Error("Unable to read image."));
          reader.readAsDataURL(brandLogoFile);
        });

        const uploaded = await uploadBrandLogoToStorage({
          data: {
            fileName: brandLogoFile.name,
            contentType: brandLogoFile.type || "image/jpeg",
            dataUrl: imageDataUrl,
          },
        });
        logoUrl = uploaded.publicUrl;
      }

      if (editingBrandId) {
        await updateBrandInDatabase({
          data: {
            id: editingBrandId,
            nameEn: brandForm.nameEn.trim(),
            nameFr: brandForm.nameFr.trim() || null,
            nameAr: brandForm.nameAr.trim() || null,
            logoUrl,
          },
        });
      } else {
        await createBrandInDatabase({
          data: {
            nameEn: brandForm.nameEn.trim(),
            nameFr: brandForm.nameFr.trim() || null,
            nameAr: brandForm.nameAr.trim() || null,
            logoUrl,
          },
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
      toast.success(editingBrandId ? t("admin.toast.brandUpdated") : t("admin.toast.brandCreated"));
      setIsBrandModalOpen(false);
      resetBrandForm();
    } catch (error) {
      console.error("Failed to save brand:", error);
      toast.error(t("admin.toast.brandSaveFailed"));
    } finally {
      setIsSavingBrand(false);
    }
  };

  const deleteBrandHandler = async (brand: BrandAdminRow) => {
      if (!window.confirm(t("admin.confirm.deleteBrand", { name: brand.name_en }))) return;
    try {
      await deleteBrandInDatabase({ data: { id: brand.id } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "master-products"] });
      toast.success(t("admin.toast.brandDeleted"));
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast.error(t("admin.toast.brandDeleteFailed"));
    }
  };

  const downloadBrandsCsvTemplate = () => {
    const csvContent = `\uFEFF${BRANDS_CSV_HEADERS.join(";")}\n`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "brands-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importBrandsFromCsv = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error(t("admin.toast.uploadCsvOnly"));
      return;
    }

    try {
      setIsImportingBrands(true);

      const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          delimiter: ";",
          transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        });
      });

      const uploadedHeaders = parsed.meta.fields ?? [];
      const missingHeaders = BRANDS_CSV_HEADERS.filter((header) => !uploadedHeaders.includes(header));

      if (missingHeaders.length > 0) {
        toast.error(`Missing CSV headers: ${missingHeaders.join(", ")}`);
        return;
      }

      const preparedRows = parsed.data
        .map((row) => ({
          nameAr: row["العربية"]?.trim() || null,
          nameEn: row.English?.trim() || "",
          nameFr: row["Français"]?.trim() || null,
          logoUrl: row.Logo?.trim() || null,
        }))
        .filter((row) => row.nameEn.length > 0);

      if (preparedRows.length === 0) {
        toast.error(t("admin.toast.noValidBrandRows"));
        return;
      }

      const result = await importBrandsBulkInDatabase({ data: { rows: preparedRows } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
      toast.success(
        `Brands imported: ${result.totalProcessed} (${result.insertedCount} new, ${result.updatedCount} updated).`,
      );
    } catch (error) {
      console.error("Failed to import brands CSV:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import brands CSV.");
    } finally {
      setIsImportingBrands(false);
      if (brandCsvInputRef.current) {
        brandCsvInputRef.current.value = "";
      }
    }
  };

  const handleBrandsCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    await importBrandsFromCsv(file);
  };

  const downloadMasterProductsCatalogExport = async () => {
    try {
      const exportRows = await fetchMasterProductsForExport();

      const workbook = new ExcelJS.Workbook();
      const templateSheet = workbook.addWorksheet("Catalog");
      const lookupSheet = workbook.addWorksheet("Lookups");
      lookupSheet.state = "veryHidden";

      templateSheet.addRow([...MASTER_PRODUCTS_CSV_HEADERS]);
      templateSheet.getRow(1).font = { bold: true };
      templateSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

      const dropdownRowCount = Math.max(5000, exportRows.length + 100);
      const categoryOptions = Array.from(new Set(categories.map((category) => category.name_en.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      );
      const brandOptions = Array.from(new Set(brands.map((brand) => brand.name_en.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      );
      const unitOptions = measurementUnits;

      lookupSheet.getCell("A1").value = "Category";
      categoryOptions.forEach((value, index) => {
        lookupSheet.getCell(index + 2, 1).value = value;
      });
      lookupSheet.getCell("B1").value = "Brand";
      brandOptions.forEach((value, index) => {
        lookupSheet.getCell(index + 2, 2).value = value;
      });
      lookupSheet.getCell("C1").value = "Measurement_Unit";
      unitOptions.forEach((value, index) => {
        lookupSheet.getCell(index + 2, 3).value = value;
      });

      const categoryFormula = categoryOptions.length > 0 ? `Lookups!$A$2:$A$${categoryOptions.length + 1}` : "\"\"";
      const brandFormula = brandOptions.length > 0 ? `Lookups!$B$2:$B$${brandOptions.length + 1}` : "\"\"";
      const unitFormula = `Lookups!$C$2:$C$${unitOptions.length + 1}`;

      for (const row of exportRows) {
        templateSheet.addRow([
          row.image_url ?? "",
          row.product_name,
          row.name_fr ?? "",
          row.name_ar ?? "",
          row.category_name ?? "",
          row.brand_name ?? "",
          (row.product_variants ?? []).join(", "),
          row.measurement_value != null ? String(row.measurement_value) : "",
          row.measurement_unit,
          row.barcode ?? "",
        ]);
      }

      for (let rowIndex = 2; rowIndex <= dropdownRowCount + 1; rowIndex += 1) {
        templateSheet.getCell(`E${rowIndex}`).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [categoryFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Category",
          error: "Pick a category from the dropdown list.",
        };

        templateSheet.getCell(`F${rowIndex}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [brandFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Brand",
          error: "Pick a brand from the dropdown list.",
        };

        templateSheet.getCell(`I${rowIndex}`).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [unitFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Measurement Unit",
          error: "Pick a measurement unit from the dropdown list.",
        };
      }

      templateSheet.columns = [
        { width: 36 },
        { width: 24 },
        { width: 24 },
        { width: 24 },
        { width: 22 },
        { width: 22 },
        { width: 28 },
        { width: 20 },
        { width: 20 },
        { width: 22 },
      ];

      const bytes = await workbook.xlsx.writeBuffer();
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "master-products-catalog-export.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Catalog export ready: ${exportRows.length} products.`);
    } catch (error) {
      console.error("Failed to export catalog XLSX:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export catalog XLSX.");
    }
  };

  const downloadMasterProductsExampleCsv = () => {
    const csvRows = [
      MASTER_PRODUCTS_CSV_HEADERS.join(";"),
      ...MASTER_PRODUCTS_CSV_EXAMPLE_ROWS.map((row) => row.join(";")),
    ];
    const csvContent = `\uFEFF${csvRows.join("\n")}\n`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "master-products-example.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importMasterProductsFromCsv = async (file: File) => {
    const lowerCaseName = file.name.toLowerCase();
    const isCsv = lowerCaseName.endsWith(".csv");
    const isXlsx = lowerCaseName.endsWith(".xlsx");

    if (!isCsv && !isXlsx) {
      toast.error(t("admin.toast.uploadXlsxOrCsv"));
      return;
    }

    try {
      setIsImportingMasterProducts(true);

      const parseSpreadsheetRows = async () => {
        if (isCsv) {
          const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
            Papa.parse<Record<string, string>>(file, {
              header: true,
              delimiter: ";",
              transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
              skipEmptyLines: true,
              complete: resolve,
              error: reject,
            });
          });

          return {
            uploadedHeaders: parsed.meta.fields ?? [],
            rows: parsed.data,
          };
        }

        const workbook = new ExcelJS.Workbook();
        const rawBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(rawBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error("The uploaded XLSX file has no worksheet.");
        }

        const headerRow = worksheet.getRow(1);
        const uploadedHeaders = MASTER_PRODUCTS_CSV_HEADERS.map((_, index) =>
          String(headerRow.getCell(index + 1).text ?? "")
            .replace(/^\uFEFF/, "")
            .trim(),
        );

        const rows: Array<Record<string, string>> = [];
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
          const row = worksheet.getRow(rowNumber);
          const mappedRow: Record<string, string> = {};
          let hasAnyValue = false;

          MASTER_PRODUCTS_CSV_HEADERS.forEach((header, headerIndex) => {
            const rawValue = String(row.getCell(headerIndex + 1).text ?? "").trim();
            mappedRow[header] = rawValue;
            if (rawValue.length > 0) {
              hasAnyValue = true;
            }
          });

          if (hasAnyValue) {
            rows.push(mappedRow);
          }
        }

        return { uploadedHeaders, rows };
      };

      const parsedSpreadsheet = await parseSpreadsheetRows();
      const uploadedHeaders = parsedSpreadsheet.uploadedHeaders;
      const missingHeaders = MASTER_PRODUCTS_CSV_HEADERS.filter((header) => !uploadedHeaders.includes(header));

      if (missingHeaders.length > 0) {
        toast.error(`Missing required headers: ${missingHeaders.join(", ")}`);
        return;
      }

      const preparedRows = parsedSpreadsheet.rows
        .map((row) => ({
          imageUrl: row.Image_URL?.trim() || null,
          nameEn: row.Name_EN?.trim() || "",
          nameFr: row.Name_FR?.trim() || null,
          nameAr: row.Name_AR?.trim() || null,
          category: row.Category?.trim() || "",
          brand: row.Brand?.trim() || null,
          productVariants: row.Product_Variants
            ? row.Product_Variants.split(",")
                .map((variant) => variant.trim())
                .filter((variant) => variant.length > 0)
            : [],
          measurementValue: row.Measurement_Value?.trim() || null,
          measurementUnit: row.Measurement_Unit?.trim() || "",
          barcode: row.Barcode?.trim() || null,
        }))
        .filter((row) => row.nameEn.length > 0 && row.category.length > 0 && (row.barcode?.length ?? 0) > 0);

      if (preparedRows.length === 0) {
        toast.error("No valid rows found. Fill at least Name_EN, Category and Barcode in one row.");
        return;
      }

      const result = await importMasterProductsBulkInDatabase({ data: { rows: preparedRows } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "master-products"] });

      const summary = `Bulk import done — New inserts: ${result.insertedCount}, Updated existing: ${result.updatedCount}${result.skippedCount > 0 ? `, Skipped: ${result.skippedCount}` : ""}.`;

      if (result.skippedCount > 0) {
        toast.warning(summary);
        for (const warning of result.warnings.slice(0, 5)) {
          toast.error(warning);
        }

        const missingCategoryRows = result.missingCategoryRows ?? [];
        const missingBrandRows = result.missingBrandRows ?? [];

        if (missingCategoryRows.length > 0) {
          const categoryDetails = missingCategoryRows
            .slice(0, 8)
            .map((item) => `L${item.rowNumber}: ${item.category}`)
            .join(" | ");
          toast.error(
            `Missing Category (${missingCategoryRows.length}): ${categoryDetails}${missingCategoryRows.length > 8 ? " | ..." : ""}`,
          );
        }

        if (missingBrandRows.length > 0) {
          const brandDetails = missingBrandRows
            .slice(0, 8)
            .map((item) => `L${item.rowNumber}: ${item.brand}`)
            .join(" | ");
          toast.error(
            `Missing Brand (${missingBrandRows.length}): ${brandDetails}${missingBrandRows.length > 8 ? " | ..." : ""}`,
          );
        }

        toast.warning(`Total skipped rows: ${result.skippedCount}`);
        if (result.warnings.length > 5) {
          toast(`+${result.warnings.length - 5} more skipped rows. Check your file values and retry.`);
        }
      } else {
        toast.success(summary);
      }
    } catch (error) {
      console.error("Failed to import master products file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import bulk products file.");
    } finally {
      setIsImportingMasterProducts(false);
      if (masterProductsCsvInputRef.current) {
        masterProductsCsvInputRef.current.value = "";
      }
    }
  };

  const handleMasterProductsCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    await importMasterProductsFromCsv(file);
  };

  const archiveProduct = async (product: MasterProductEntity) => {
    setPendingArchiveProduct(product);
  };

  const confirmArchiveProduct = async () => {
    if (!pendingArchiveProduct) return;
    try {
      await archiveMasterProductInDatabase({ data: { id: pendingArchiveProduct.id } });
      queryClient.setQueryData(["admin", "master-products"], (current: any[] | undefined) =>
        (current ?? []).filter((row) => row.id !== pendingArchiveProduct.id),
      );
      toast.success("Product archived.");
      setPendingArchiveProduct(null);
    } catch (error) {
      console.error("Failed to archive master product:", error);
      toast.error("Failed to archive product.");
    }
  };

  const applyCategoryImageFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCategoryImageFile(file);
      setCategoryImagePreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => toast.error("Unable to preview selected image.");
    reader.readAsDataURL(file);
  };

  const handleCategoryImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyCategoryImageFile(event.target.files?.[0] ?? null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      id: "",
      nameEn: "",
      nameFr: "",
      nameAr: "",
      imageUrl: "",
      iconName: "Carrot",
      accentColor: "#f3f4f6",
      sortOrder: "0",
      isActive: true,
    });
    setCategoryImageFile(null);
    setCategoryImagePreviewUrl(null);
  };

  const editCategory = (category: CategoryAdminRow) => {
    const resolvedIconName = CATEGORY_ICON_OPTIONS.includes((category.icon_name ?? "") as CategoryIconName)
      ? (category.icon_name as CategoryIconName)
      : "Carrot";

    setCategoryForm({
      id: category.id,
      nameEn: category.name_en,
      nameFr: category.name_fr,
      nameAr: category.name_ar,
      imageUrl: category.image_url ?? "",
      iconName: resolvedIconName,
      accentColor: category.accent_color ?? "#f3f4f6",
      sortOrder: String(category.sort_order),
      isActive: category.is_active,
    });
    setCategoryImageFile(null);
    setCategoryImagePreviewUrl(category.image_url ?? null);
  };

  const saveCategory = async () => {
    if (!categoryForm.nameEn.trim() || !categoryForm.nameFr.trim() || !categoryForm.nameAr.trim()) {
      toast.error("Please enter category names in EN, FR, and AR.");
      return;
    }

    setIsSavingCategory(true);
    try {
      let finalImageUrl = categoryForm.imageUrl.trim() || null;

      if (categoryImageFile) {
        const extension = categoryImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const sanitizedBaseName = categoryImageFile.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 60);
        const fileName = `${crypto.randomUUID()}-${sanitizedBaseName || "category"}.${extension}`;
        const filePath = `categories/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("products")
          .upload(filePath, categoryImageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError || !uploadData?.path) {
          throw new Error(uploadError?.message || "Category image upload failed.");
        }

        const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(uploadData.path);
        finalImageUrl = publicUrlData.publicUrl;
      }

      const payload = {
        nameEn: categoryForm.nameEn.trim(),
        nameFr: categoryForm.nameFr.trim(),
        nameAr: categoryForm.nameAr.trim(),
        imageUrl: finalImageUrl,
        iconName: categoryForm.iconName,
        accentColor: categoryForm.accentColor.trim() || "#f3f4f6",
        sortOrder: Number.parseInt(categoryForm.sortOrder || "0", 10) || 0,
        isActive: categoryForm.isActive,
      };

      if (categoryForm.id) {
        const updated = await updateCategoryInDatabase({
          data: {
            id: categoryForm.id,
            ...payload,
          },
        });

        queryClient.setQueryData(["admin", "categories"], (current: CategoryAdminRow[] | undefined) =>
          (current ?? []).map((row) => (row.id === updated.id ? updated : row)),
        );
        toast.success("Category updated.");
      } else {
        const created = await createCategoryInDatabase({ data: payload });

        queryClient.setQueryData(["admin", "categories"], (current: CategoryAdminRow[] | undefined) =>
          [...(current ?? []), created].sort((a, b) => a.sort_order - b.sort_order),
        );
        toast.success("Category created.");
      }

      resetCategoryForm();
    } catch (error) {
      console.error("Failed to save category:", error);
      toast.error("Failed to save category.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const resetAdForm = () => {
    setAdForm({
      id: "",
      campaignName: "",
      zoneId: "global",
      campaignType: "AD",
      imageAr: "",
      imageFr: "",
      imageEn: "",
      targetUrl: "",
      startDate: "",
      endDate: "",
      isActive: true,
    });
  };

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      id: "",
      title: "",
      messagesEn: [""],
      messagesFr: [""],
      messagesAr: [""],
      startDate: "",
      endDate: "",
      isActive: true,
      bgColor: "#deff9a",
      textColor: "#000000",
    });
  };

  const saveAd = async () => {
    if (!adForm.campaignName.trim()) {
      toast.error("Campaign name is required.");
      return;
    }

    if (!adForm.imageAr.trim() && !adForm.imageFr.trim() && !adForm.imageEn.trim()) {
      toast.error("Add at least one localized image URL.");
      return;
    }

    if (adForm.startDate && adForm.endDate && new Date(adForm.endDate).getTime() < new Date(adForm.startDate).getTime()) {
      toast.error("Expiration date must be after start date.");
      return;
    }

    setIsSavingAd(true);
    try {
      if (adForm.id) {
        await updateSiteAdInDatabase({
          data: {
            id: adForm.id,
            campaignName: adForm.campaignName.trim(),
            zoneId: adForm.zoneId === "global" ? null : adForm.zoneId,
            campaignType: adForm.campaignType,
            imageAr: adForm.imageAr.trim() || null,
            imageFr: adForm.imageFr.trim() || null,
            imageEn: adForm.imageEn.trim() || null,
            targetUrl: adForm.targetUrl.trim() || null,
            startDate: adForm.startDate || null,
            endDate: adForm.endDate || null,
            isActive: adForm.isActive,
          },
        });
        toast.success("Campaign updated.");
      } else {
        await createSiteAdInDatabase({
          data: {
            campaignName: adForm.campaignName.trim(),
            zoneId: adForm.zoneId === "global" ? null : adForm.zoneId,
            campaignType: adForm.campaignType,
            imageAr: adForm.imageAr.trim() || null,
            imageFr: adForm.imageFr.trim() || null,
            imageEn: adForm.imageEn.trim() || null,
            targetUrl: adForm.targetUrl.trim() || null,
            startDate: adForm.startDate || null,
            endDate: adForm.endDate || null,
            isActive: adForm.isActive,
          },
        });
        toast.success("Campaign created.");
      }

      await siteAdsQuery.refetch();
      resetAdForm();
    } catch (error) {
      console.error("Failed to save ad:", error);
      toast.error("Failed to save ad.");
    } finally {
      setIsSavingAd(false);
    }
  };

  const saveAnnouncement = async () => {
    const normalizedTitle = announcementForm.title.trim();
    if (!normalizedTitle) {
      toast.error("Announcement title is required.");
      return;
    }

    const normalizedMessagesEn = announcementForm.messagesEn.map((value) => value.trim()).filter(Boolean);
    const normalizedMessagesFr = announcementForm.messagesFr.map((value) => value.trim()).filter(Boolean);
    const normalizedMessagesAr = announcementForm.messagesAr.map((value) => value.trim()).filter(Boolean);

    if (normalizedMessagesAr.length === 0 && normalizedMessagesFr.length === 0 && normalizedMessagesEn.length === 0) {
      toast.error("Add at least one localized announcement message.");
      return;
    }

    if (
      announcementForm.startDate &&
      announcementForm.endDate &&
      new Date(announcementForm.endDate).getTime() < new Date(announcementForm.startDate).getTime()
    ) {
      toast.error("Expiration date must be after start date.");
      return;
    }

    setIsSavingAnnouncement(true);
    try {
      if (announcementForm.id) {
        await updateAnnouncementInDatabase({
          data: {
            id: announcementForm.id,
            title: normalizedTitle,
            messagesEn: normalizedMessagesEn,
            messagesFr: normalizedMessagesFr,
            messagesAr: normalizedMessagesAr,
            startDate: announcementForm.startDate || null,
            endDate: announcementForm.endDate || null,
            isActive: announcementForm.isActive,
            bgColor: announcementForm.bgColor.trim() || "#deff9a",
            textColor: announcementForm.textColor.trim() || "#000000",
          },
        });
        toast.success("Announcement updated.");
      } else {
        await createAnnouncementInDatabase({
          data: {
            title: normalizedTitle,
            messagesEn: normalizedMessagesEn,
            messagesFr: normalizedMessagesFr,
            messagesAr: normalizedMessagesAr,
            startDate: announcementForm.startDate || null,
            endDate: announcementForm.endDate || null,
            isActive: announcementForm.isActive,
            bgColor: announcementForm.bgColor.trim() || "#deff9a",
            textColor: announcementForm.textColor.trim() || "#000000",
          },
        });
        toast.success("Announcement created.");
      }

      await announcementsQuery.refetch();
      resetAnnouncementForm();
    } catch (error) {
      console.error("Failed to save announcement:", error);
      toast.error("Failed to save announcement.");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const editAd = (ad: {
    id: string;
    campaign_name: string;
    zone_id: string | null;
    campaign_type: "AD" | "PROMO" | "NEWS";
    views_count: number;
    image_ar: string | null;
    image_fr: string | null;
    image_en: string | null;
    target_url: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
  }) => {
    setAdForm({
      id: ad.id,
      campaignName: ad.campaign_name ?? "",
      zoneId: ad.zone_id ?? "global",
      campaignType: ad.campaign_type ?? "AD",
      imageAr: ad.image_ar ?? "",
      imageFr: ad.image_fr ?? "",
      imageEn: ad.image_en ?? "",
      targetUrl: ad.target_url ?? "",
      startDate: ad.start_date ? ad.start_date.slice(0, 16) : "",
      endDate: ad.end_date ? ad.end_date.slice(0, 16) : "",
      isActive: ad.is_active,
    });
  };

  const removeAd = async (id: string) => {
    try {
      await deleteSiteAdInDatabase({ data: { id } });
      await siteAdsQuery.refetch();
      if (adForm.id === id) {
        resetAdForm();
      }
      toast.success("Ad removed.");
    } catch (error) {
      console.error("Failed to remove ad:", error);
      toast.error("Failed to remove ad.");
    }
  };

  const toggleAdActive = async (ad: {
    id: string;
    campaign_name: string;
    zone_id: string | null;
    campaign_type: "AD" | "PROMO" | "NEWS";
    views_count: number;
    image_ar: string | null;
    image_fr: string | null;
    image_en: string | null;
    target_url: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
  }) => {
    try {
      await updateSiteAdInDatabase({
        data: {
          id: ad.id,
          campaignName: ad.campaign_name,
          zoneId: ad.zone_id,
          campaignType: ad.campaign_type,
          imageAr: ad.image_ar,
          imageFr: ad.image_fr,
          imageEn: ad.image_en,
          targetUrl: ad.target_url,
          startDate: ad.start_date,
          endDate: ad.end_date,
          isActive: !ad.is_active,
        },
      });
      await siteAdsQuery.refetch();
      toast.success(!ad.is_active ? "Campaign activated." : "Campaign paused.");
    } catch (error) {
      console.error("Failed to toggle campaign state:", error);
      toast.error("Failed to update campaign state.");
    }
  };

  const editAnnouncement = (announcement: {
    id: string;
    title: string;
    messages_en: string[] | null;
    messages_fr: string[] | null;
    messages_ar: string[] | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
  }) => {
    setAnnouncementForm({
      id: announcement.id,
      title: announcement.title ?? "",
      messagesEn: announcement.messages_en && announcement.messages_en.length > 0 ? announcement.messages_en : [""],
      messagesFr: announcement.messages_fr && announcement.messages_fr.length > 0 ? announcement.messages_fr : [""],
      messagesAr: announcement.messages_ar && announcement.messages_ar.length > 0 ? announcement.messages_ar : [""],
      startDate: announcement.start_date ? announcement.start_date.slice(0, 16) : "",
      endDate: announcement.end_date ? announcement.end_date.slice(0, 16) : "",
      isActive: announcement.is_active,
      bgColor: announcement.bg_color,
      textColor: announcement.text_color,
    });
  };

  const removeAnnouncement = async (id: string) => {
    try {
      await deleteAnnouncementInDatabase({ data: { id } });
      await announcementsQuery.refetch();
      if (announcementForm.id === id) {
        resetAnnouncementForm();
      }
      toast.success("Announcement removed.");
    } catch (error) {
      console.error("Failed to remove announcement:", error);
      toast.error("Failed to remove announcement.");
    }
  };

  const toggleAnnouncementActive = async (announcement: {
    id: string;
    title: string;
    messages_en: string[] | null;
    messages_fr: string[] | null;
    messages_ar: string[] | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
  }) => {
    try {
      await updateAnnouncementInDatabase({
        data: {
          id: announcement.id,
          title: announcement.title,
          messagesEn: (announcement.messages_en ?? []).filter(Boolean),
          messagesFr: (announcement.messages_fr ?? []).filter(Boolean),
          messagesAr: (announcement.messages_ar ?? []).filter(Boolean),
          startDate: announcement.start_date,
          endDate: announcement.end_date,
          isActive: !announcement.is_active,
          bgColor: announcement.bg_color,
          textColor: announcement.text_color,
        },
      });
      await announcementsQuery.refetch();
      toast.success(!announcement.is_active ? "Announcement activated." : "Announcement paused.");
    } catch (error) {
      console.error("Failed to toggle announcement state:", error);
      toast.error("Failed to update announcement state.");
    }
  };

  const saveReceiptSettings = async () => {
    if (
      !receiptForm.id ||
      !receiptForm.receiptStoreName.trim() ||
      !receiptForm.receiptSlogan.trim() ||
      !receiptForm.receiptPhone.trim() ||
      !receiptForm.receiptAddress.trim() ||
      !receiptForm.receiptWebsite.trim() ||
      !receiptForm.receiptFooterMessage.trim() ||
      !receiptForm.receiptSocialSupport.trim()
    ) {
      toast.error("Please complete all required receipt settings.");
      return;
    }

    try {
      setIsSavingReceiptSettings(true);

      let receiptLogoUrl = receiptForm.receiptLogoUrl.trim() || null;
      if (receiptLogoFile) {
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Invalid image format."));
          };
          reader.onerror = () => reject(new Error("Unable to read image."));
          reader.readAsDataURL(receiptLogoFile);
        });

        const uploaded = await uploadReceiptLogoToStorage({
          data: {
            fileName: receiptLogoFile.name,
            contentType: receiptLogoFile.type || "image/png",
            dataUrl: imageDataUrl,
          },
        });
        receiptLogoUrl = uploaded.publicUrl;
      }

      await saveAdminInvoiceSettings({
        data: {
          id: receiptForm.id,
          receiptLogoUrl,
          receiptStoreName: receiptForm.receiptStoreName.trim(),
          receiptSlogan: receiptForm.receiptSlogan.trim(),
          receiptPhone: receiptForm.receiptPhone.trim(),
          receiptAddress: receiptForm.receiptAddress.trim(),
          receiptWebsite: receiptForm.receiptWebsite.trim(),
          taxId: receiptForm.taxId.trim() || null,
          receiptFooterMessage: receiptForm.receiptFooterMessage.trim(),
          receiptSocialSupport: receiptForm.receiptSocialSupport.trim(),
        },
      });

      await adminInvoiceSettingsQuery.refetch();
      setReceiptLogoFile(null);
      toast.success("Configuration saved successfully");
    } catch (error) {
      console.error("Failed to save receipt settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save receipt settings.");
    } finally {
      setIsSavingReceiptSettings(false);
    }
  };

  const saveGlobalSettings = async () => {
    if (!settingsForm.id) {
      toast.error("Global settings are still loading.");
      return;
    }

    const globalDeliveryFee = Number(settingsForm.deliveryFeeMad);
    const minimumOrderAmount = Number(settingsForm.minimumOrderMad);
    const freeDeliveryThreshold = Number(settingsForm.freeDeliveryThresholdMad);
    const normalizedSiteName = settingsForm.siteName.trim();

    if (
      Number.isNaN(globalDeliveryFee) ||
      Number.isNaN(minimumOrderAmount) ||
      Number.isNaN(freeDeliveryThreshold) ||
      globalDeliveryFee < 0 ||
      minimumOrderAmount < 0 ||
      freeDeliveryThreshold < 0
    ) {
      toast.error("Please enter valid non-negative values for global settings.");
      return;
    }

    if (!normalizedSiteName) {
      toast.error("Please provide a site name.");
      return;
    }

    try {
      setIsSavingGlobalSettings(true);

      let siteLogoUrl = settingsForm.siteLogoUrl.trim() || null;
      if (siteLogoFile) {
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Invalid image format."));
          };
          reader.onerror = () => reject(new Error("Unable to read image."));
          reader.readAsDataURL(siteLogoFile);
        });

        const uploaded = await uploadSiteLogoToStorage({
          data: {
            fileName: siteLogoFile.name,
            contentType: siteLogoFile.type || "image/png",
            dataUrl: imageDataUrl,
          },
        });

        siteLogoUrl = uploaded.publicUrl;
      }

      await saveGlobalSettingsToDatabase({
        data: {
          id: settingsForm.id,
          globalDeliveryFee,
          minimumOrderAmount,
          freeDeliveryThreshold,
          marketplaceActive: settingsForm.marketplaceActive,
          siteName: normalizedSiteName,
          siteLogoUrl,
        },
      });

      await globalSettingsQuery.refetch();
      setSiteLogoFile(null);
      toast.success("Settings updated successfully");
    } catch (error) {
      console.error("Failed to save global settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save global settings.");
    } finally {
      setIsSavingGlobalSettings(false);
    }
  };

  const handleFactoryReset = async () => {
    if (factoryResetConfirmationText.trim() !== "RESET_ALL") {
      toast.error("Type RESET_ALL exactly to confirm factory reset.");
      return;
    }

    try {
      setIsResettingFactoryData(true);
      await resetFactoryDataInDatabase({
        data: {
          confirmationText: "RESET_ALL",
        },
      });

      await Promise.all([
        vendorsQuery.refetch(),
        cyclistsQuery.refetch(),
        serviceZonesQuery.refetch(),
        masterProductsQuery.refetch(),
        brandsQuery.refetch(),
        categoriesQuery.refetch(),
        siteAdsQuery.refetch(),
        announcementsQuery.refetch(),
        adminOrdersQuery.refetch(),
        adminCustomersQuery.refetch(),
        globalSettingsQuery.refetch(),
        adminInvoiceSettingsQuery.refetch(),
        markupRulesQuery.refetch(),
        overviewAnalyticsQuery.refetch(),
      ]);

      setFactoryResetConfirmationText("");
      setIsFactoryResetDialogOpen(false);
      toast.success("Factory reset completed successfully.");
    } catch (error) {
      console.error("Factory reset failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to run factory reset.");
    } finally {
      setIsResettingFactoryData(false);
    }
  };

  const resetMarkupRuleForm = () => {
    setEditingMarkupRuleId(null);
    setMarkupRuleForm({
      minPrice: "",
      maxPrice: "",
      markupType: "fixed",
      markupValue: "",
      isActive: true,
    });
  };

  const openCreateMarkupRuleDialog = () => {
    resetMarkupRuleForm();
    setIsMarkupRuleDialogOpen(true);
  };

  const openEditMarkupRuleDialog = (rule: MarkupRuleAdminRow) => {
    setEditingMarkupRuleId(rule.id);
    setMarkupRuleForm({
      minPrice: String(rule.minPrice),
      maxPrice: String(rule.maxPrice),
      markupType: rule.markupType,
      markupValue: String(rule.markupValue),
      isActive: rule.isActive,
    });
    setIsMarkupRuleDialogOpen(true);
  };

  const saveMarkupRule = async () => {
    const minPrice = Number(markupRuleForm.minPrice);
    const maxPrice = Number(markupRuleForm.maxPrice);
    const markupValue = Number(markupRuleForm.markupValue);

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || !Number.isFinite(markupValue)) {
      toast.error("Please enter valid numeric values for pricing rule.");
      return;
    }

    if (minPrice < 0 || maxPrice <= minPrice || markupValue < 0) {
      toast.error("Please ensure range and markup values are valid.");
      return;
    }

    try {
      setIsSavingMarkupRule(true);
      const payload = {
        minPrice,
        maxPrice,
        markupType: markupRuleForm.markupType,
        markupValue,
        isActive: markupRuleForm.isActive,
      };

      if (editingMarkupRuleId) {
        await updateMarkupRuleInDatabase({ data: { id: editingMarkupRuleId, ...payload } });
        toast.success("Pricing rule updated.");
      } else {
        await createMarkupRuleInDatabase({ data: payload });
        toast.success("Pricing rule created.");
      }

      await markupRulesQuery.refetch();
      setIsMarkupRuleDialogOpen(false);
      resetMarkupRuleForm();
    } catch (error) {
      console.error("Failed to save pricing rule:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save pricing rule.");
    } finally {
      setIsSavingMarkupRule(false);
    }
  };

  const removeMarkupRule = async (ruleId: string) => {
    try {
      await deleteMarkupRuleInDatabase({ data: { id: ruleId } });
      await markupRulesQuery.refetch();
      toast.success("Pricing rule deleted.");
    } catch (error) {
      console.error("Failed to delete pricing rule:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete pricing rule.");
    }
  };

  const handleLogout = async () => {
    clearRoleSessions();
    await supabase.auth.signOut();
    toast.success("Logged out successfully.");
    await navigate({ to: "/admin-login" });
  };

  const openCommuneProfile = (communeId: string) => {
    navigate({ to: "/admin/service-zones/$communeId", params: { communeId } });
  };

  return location.pathname !== "/admin" ? (
    <Outlet />
  ) : (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <AdminSidebar activeTab={tab} />
        <SidebarInset className="bg-transparent">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger className="h-9 w-9 rounded-md border border-border" />
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">{t("admin.header.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("admin.header.subtitle")}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <Button variant="soft" className="rounded-lg" onClick={handleLogout}>
                <LogOut className="size-4" />
                <span>{t("admin.actions.logout")}</span>
              </Button>
            </div>
          </header>

          <main className="space-y-5 p-4 md:p-6">
            {!dbHealthQuery.isLoading && !dbHealthQuery.data?.healthy ? (
              <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive shadow-sm">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{t("admin.health.failedTitle")}</p>
                    <p>
                      {dbHealthQuery.data?.error
                        ? dbHealthQuery.data.error
                        : t("admin.health.requiredTablesMissing")}
                    </p>
                    {dbHealthQuery.data?.missingTables?.length ? (
                      <p>{t("admin.health.missingTables", { tables: dbHealthQuery.data.missingTables.join(", ") })}</p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
            <div key={tab} className="animate-in fade-in duration-200">
              {tab === "overview" ? (
                <OverviewSection
                  analytics={overviewAnalyticsQuery.data}
                  isLoading={dbHealthQuery.isLoading || overviewAnalyticsQuery.isLoading}
                  error={overviewAnalyticsQuery.error}
                />
              ) : null}
              {tab === "vendors" ? (
                <VendorsSection
                  vendors={vendors}
                  isLoading={dbHealthQuery.isLoading || vendorsQuery.isLoading}
                  onAddVendor={() => setIsVendorPanelOpen(true)}
                  onManageVendor={openManageVendorPanel}
                  onCollectPlatformDues={openPlatformCollectionQr}
                />
              ) : null}
              {tab === "cyclists" ? (
                <CyclistsSection
                  cyclists={cyclists}
                  isLoading={dbHealthQuery.isLoading || cyclistsQuery.isLoading}
                  onAddCyclist={() => setIsCyclistPanelOpen(true)}
                />
              ) : null}
              {tab === "service-zones" ? (
                <ServiceZonesSection
                  zones={serviceZones}
                  isLoading={dbHealthQuery.isLoading || serviceZonesQuery.isLoading}
                  isImporting={isImportingServiceZones}
                  form={serviceZoneForm}
                  onFormChange={setServiceZoneForm}
                  onSaveCommune={saveCommuneHandler}
                  onSaveNeighborhood={saveNeighborhoodHandler}
                  onDownloadExport={downloadServiceZonesExport}
                  serviceZonesCsvInputRef={serviceZonesCsvInputRef}
                  onImportCsv={handleServiceZonesCsvUpload}
                  onOpenCommuneProfile={openCommuneProfile}
                  localizeCommuneName={getLocalizedCommuneName}
                />
              ) : null}
              {tab === "catalog" ? (
                <CatalogSection
                  products={filteredMasterProducts}
                  allProductsCount={masterProducts.length}
                  categories={categories}
                  brands={brands}
                  isLoading={dbHealthQuery.isLoading || masterProductsQuery.isLoading}
                  isImporting={isImportingMasterProducts}
                  searchTerm={catalogSearchTerm}
                  selectedCategoryId={catalogCategoryFilter}
                  selectedBrandId={catalogBrandFilter}
                  onSearchTermChange={setCatalogSearchTerm}
                  onCategoryChange={setCatalogCategoryFilter}
                  onBrandChange={setCatalogBrandFilter}
                  masterProductsCsvInputRef={masterProductsCsvInputRef}
                  onAddProduct={openCreateProductModal}
                  onDownloadTemplate={downloadMasterProductsCatalogExport}
                  onDownloadExample={downloadMasterProductsExampleCsv}
                  onImportCsv={handleMasterProductsCsvUpload}
                  onEditProduct={openEditProductModal}
                  onArchiveProduct={archiveProduct}
                />
              ) : null}
              {tab === "brands" ? (
                <BrandsSection
                  brands={brands}
                  isLoading={dbHealthQuery.isLoading || brandsQuery.isLoading}
                  isImporting={isImportingBrands}
                  brandCsvInputRef={brandCsvInputRef}
                  onAddBrand={openCreateBrandModal}
                  onDownloadTemplate={downloadBrandsCsvTemplate}
                  onImportCsv={handleBrandsCsvUpload}
                  onEditBrand={openEditBrandModal}
                  onDeleteBrand={deleteBrandHandler}
                />
              ) : null}
              {tab === "categories" ? (
                <CategoriesSection
                  categories={categories}
                  isLoading={dbHealthQuery.isLoading || categoriesQuery.isLoading}
                  form={categoryForm}
                  onFormChange={setCategoryForm}
                  onSave={saveCategory}
                  onEdit={editCategory}
                  onReset={resetCategoryForm}
                  isSaving={isSavingCategory}
                  imageInputRef={categoryImageInputRef}
                  imagePreviewUrl={categoryImagePreviewUrl}
                  onImageChange={handleCategoryImageChange}
                />
              ) : null}
              {tab === "ads-content" ? (
                <AdsContentSection
                  ads={(siteAdsQuery.data ?? []) as Array<{
                    id: string;
                    campaign_name: string;
                    zone_id: string | null;
                    campaign_type: "AD" | "PROMO" | "NEWS";
                    views_count: number;
                    image_ar: string | null;
                    image_fr: string | null;
                    image_en: string | null;
                    target_url: string | null;
                    start_date: string | null;
                    end_date: string | null;
                    is_active: boolean;
                    created_at: string;
                  }>}
                  announcements={(announcementsQuery.data ?? []) as Array<{
                    id: string;
                    title: string;
                    messages_en: string[] | null;
                    messages_fr: string[] | null;
                    messages_ar: string[] | null;
                    start_date: string | null;
                    end_date: string | null;
                    is_active: boolean;
                    bg_color: string;
                    text_color: string;
                    created_at: string;
                  }>}
                  isLoading={
                    dbHealthQuery.isLoading || siteAdsQuery.isLoading || announcementsQuery.isLoading
                  }
                  adTargetZones={adTargetZones}
                  adForm={adForm}
                  onAdFormChange={setAdForm}
                  onSaveAd={saveAd}
                  onEditAd={editAd}
                  onDeleteAd={removeAd}
                  onToggleAdActive={toggleAdActive}
                  onResetAdForm={resetAdForm}
                  isSavingAd={isSavingAd}
                  announcementForm={announcementForm}
                  onAnnouncementFormChange={setAnnouncementForm}
                  onSaveAnnouncement={saveAnnouncement}
                  onEditAnnouncement={editAnnouncement}
                  onDeleteAnnouncement={removeAnnouncement}
                  onToggleAnnouncementActive={toggleAnnouncementActive}
                  onResetAnnouncementForm={resetAnnouncementForm}
                  isSavingAnnouncement={isSavingAnnouncement}
                />
              ) : null}
              {tab === "orders" ? (
                <OrdersSection
                  orders={filteredOrders}
                  isLoading={dbHealthQuery.isLoading || adminOrdersQuery.isLoading}
                  error={adminOrdersQuery.error}
                  statusFilter={ordersStatusFilter}
                  onStatusFilterChange={setOrdersStatusFilter}
                />
              ) : null}
              {tab === "customers" ? (
                <CustomersSection
                  customers={adminCustomers}
                  isLoading={dbHealthQuery.isLoading || adminCustomersQuery.isLoading}
                  error={adminCustomersQuery.error}
                />
              ) : null}
              {tab === "settings" ? (
                <SettingsSection
                  form={settingsForm}
                  onFormChange={setSettingsForm}
                  siteLogoPreviewUrl={siteLogoPreviewUrl}
                  onSiteLogoFileChange={(file: File | null) => setSiteLogoFile(file)}
                  onSiteLogoPreviewChange={(url: string | null) => setSiteLogoPreviewUrl(url)}
                  onSaveGlobalSettings={saveGlobalSettings}
                  isGlobalSettingsLoading={isSavingGlobalSettings || dbHealthQuery.isLoading || globalSettingsQuery.isLoading}
                  receiptForm={receiptForm}
                  receiptLogoPreviewUrl={receiptLogoPreviewUrl}
                  onReceiptLogoFileChange={(file: File | null) => setReceiptLogoFile(file)}
                  onReceiptLogoPreviewChange={(url: string | null) => setReceiptLogoPreviewUrl(url)}
                  onReceiptFormChange={setReceiptForm}
                  onSaveReceiptSettings={saveReceiptSettings}
                  isReceiptSettingsLoading={
                    isSavingReceiptSettings || dbHealthQuery.isLoading || adminInvoiceSettingsQuery.isLoading
                  }
                  markupRules={markupRules}
                  isMarkupRulesLoading={dbHealthQuery.isLoading || markupRulesQuery.isLoading}
                  onAddMarkupRule={openCreateMarkupRuleDialog}
                  onEditMarkupRule={openEditMarkupRuleDialog}
                  onDeleteMarkupRule={removeMarkupRule}
                  markupRuleForm={markupRuleForm}
                  onMarkupRuleFormChange={setMarkupRuleForm}
                  isMarkupRuleDialogOpen={isMarkupRuleDialogOpen}
                  onMarkupRuleDialogOpenChange={setIsMarkupRuleDialogOpen}
                  onSaveMarkupRule={saveMarkupRule}
                  isSavingMarkupRule={isSavingMarkupRule}
                  editingMarkupRuleId={editingMarkupRuleId}
                  onOpenFactoryResetDialog={() => setIsFactoryResetDialogOpen(true)}
                />
              ) : null}
            </div>
          </main>
        </SidebarInset>
      </div>

      <Sheet open={isVendorPanelOpen} onOpenChange={setIsVendorPanelOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("admin.modals.vendor.title")}</SheetTitle>
            <SheetDescription>{t("admin.modals.vendor.description")}</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="store-name" className="text-sm font-medium text-foreground">
                {t("admin.forms.storeName")}
              </label>
              <input
                id="store-name"
                value={vendorForm.storeName}
                onChange={(event) => setVendorForm((current) => ({ ...current, storeName: event.target.value }))}
                placeholder={t("admin.placeholders.storeNameExample")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="owner-name" className="text-sm font-medium text-foreground">
                {t("admin.forms.ownerName")}
              </label>
              <input
                id="owner-name"
                value={vendorForm.ownerName}
                onChange={(event) => setVendorForm((current) => ({ ...current, ownerName: event.target.value }))}
                placeholder={t("admin.placeholders.ownerNameExample")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone-number" className="text-sm font-medium text-foreground">
                {t("admin.forms.phoneNumber")}
              </label>
              <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                <input
                  id="phone-number"
                  value={vendorForm.phoneNumber}
                  onChange={(event) =>
                    setVendorForm((current) => ({
                      ...current,
                      phoneNumber: normalizeMoroccoPhoneInput(event.target.value),
                    }))
                  }
                  placeholder={t("admin.placeholders.phoneNumberShort")}
                  inputMode="numeric"
                  autoComplete="tel"
                  className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="vendor-commune" className="text-sm font-medium text-foreground">
                {t("admin.forms.commune")}
              </label>
              <select
                id="vendor-commune"
                value={vendorForm.communeId}
                onChange={(event) =>
                  setVendorForm((current) => ({
                    ...current,
                    communeId: event.target.value,
                    neighborhoodIds: [],
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              >
                 <option value="">{t("admin.common.selectCommune")}</option>
                {communeOptions.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {getLocalizedCommuneName(commune)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("admin.forms.douarMultiSelect")}</label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3">
                {!vendorForm.communeId ? (
                  <p className="text-sm text-muted-foreground">{t("admin.common.selectCommuneFirst")}</p>
                ) : addVendorNeighborhoodOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.forms.noUnassignedNeighborhoods")}</p>
                ) : (
                  addVendorNeighborhoodOptions.map((neighborhood) => {
                    const isChecked = vendorForm.neighborhoodIds.includes(neighborhood.id);
                    return (
                      <label key={neighborhood.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => toggleVendorNeighborhood(neighborhood.id, event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-foreground">{neighborhood.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {vendorForm.neighborhoodIds.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {addVendorNeighborhoodOptions
                    .filter((n) => vendorForm.neighborhoodIds.includes(n.id))
                    .map((neighborhood) => (
                      <button
                        key={neighborhood.id}
                        type="button"
                        onClick={() => toggleVendorNeighborhood(neighborhood.id, false)}
                        className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                      >
                        {neighborhood.name} ×
                      </button>
                    ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("admin.forms.activeStatus")}</p>
                <p className="text-xs text-muted-foreground">{t("admin.forms.vendorActiveHint")}</p>
              </div>
              <Switch
                checked={vendorForm.isActive}
                onCheckedChange={(checked) => setVendorForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="hero" className="w-full rounded-md" onClick={saveVendor}>
              {t("admin.actions.saveVendor")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isCyclistPanelOpen} onOpenChange={setIsCyclistPanelOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("admin.modals.cyclist.title")}</SheetTitle>
            <SheetDescription>{t("admin.modals.cyclist.description")}</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="cyclist-full-name" className="text-sm font-medium text-foreground">
                {t("admin.forms.fullName")}
              </label>
              <input
                id="cyclist-full-name"
                value={cyclistForm.fullName}
                onChange={(event) => setCyclistForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder={t("admin.placeholders.fullNameExample")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="cyclist-phone-number" className="text-sm font-medium text-foreground">
                {t("admin.forms.phoneNumber")}
              </label>
              <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                <input
                  id="cyclist-phone-number"
                  value={cyclistForm.phoneNumber}
                  onChange={(event) =>
                    setCyclistForm((current) => ({
                      ...current,
                      phoneNumber: normalizeMoroccoPhoneInput(event.target.value),
                    }))
                  }
                  placeholder={t("admin.placeholders.phoneNumberShort")}
                  inputMode="numeric"
                  autoComplete="tel"
                  className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="cyclist-commune" className="text-sm font-medium text-foreground">
                {t("admin.forms.commune")}
              </label>
              <select
                id="cyclist-commune"
                value={cyclistForm.communeId}
                onChange={(event) =>
                  setCyclistForm((current) => ({
                    ...current,
                    communeId: event.target.value,
                    neighborhoodIds: [],
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              >
                <option value="">{t("admin.common.selectCommune")}</option>
                {communeOptions.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {getLocalizedCommuneName(commune)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("admin.forms.douarsMultiSelect")}
              </label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3">
                {!cyclistForm.communeId ? (
                  <p className="text-sm text-muted-foreground">{t("admin.common.selectCommuneFirst")}</p>
                ) : cyclistNeighborhoodOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.forms.noNeighborhoodsInCommune")}</p>
                ) : (
                  cyclistNeighborhoodOptions.map((neighborhood) => {
                    const isChecked = cyclistForm.neighborhoodIds.includes(neighborhood.id);

                    return (
                      <label
                        key={neighborhood.id}
                        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => toggleCyclistNeighborhood(neighborhood.id, event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-foreground">{neighborhood.name}</span>
                      </label>
                    );
                  })
                )}
              </div>

              {cyclistForm.neighborhoodIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("admin.forms.selectedNeighborhoods", { count: cyclistForm.neighborhoodIds.length })}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("admin.forms.activeStatus")}</p>
                <p className="text-xs text-muted-foreground">{t("admin.forms.cyclistActiveHint")}</p>
              </div>
              <Switch
                checked={cyclistForm.isActive}
                onCheckedChange={(checked) => setCyclistForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="hero" className="w-full rounded-md" onClick={saveCyclist}>
              {t("admin.actions.saveCyclist")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isManageVendorPanelOpen}
        onOpenChange={(open) => {
          setIsManageVendorPanelOpen(open);
          if (!open) {
            setSelectedVendor(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0">
          <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendor Profile & Management</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {manageVendorForm.storeName || selectedVendor?.storeName || "Vendor"}
                </h3>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {manageVendorForm.isActive ? "Active" : "Suspended"}
                </span>
                <Switch
                  checked={manageVendorForm.isActive}
                  disabled={isUpdatingVendorState || !manageVendorForm.vendorId}
                  onCheckedChange={handleVendorActiveStateToggle}
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <Tabs defaultValue="edit-details" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="edit-details">Edit Details</TabsTrigger>
                <TabsTrigger value="sales-analytics">Sales Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="edit-details" className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="manage-store-name" className="text-sm font-medium text-foreground">Store Name</label>
                  <input
                    id="manage-store-name"
                    value={manageVendorForm.storeName}
                    onChange={(event) =>
                      setManageVendorForm((current) => ({
                        ...current,
                        storeName: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="manage-owner-name" className="text-sm font-medium text-foreground">Owner Name</label>
                  <input
                    id="manage-owner-name"
                    value={manageVendorForm.ownerName}
                    onChange={(event) =>
                      setManageVendorForm((current) => ({
                        ...current,
                        ownerName: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="manage-phone-number" className="text-sm font-medium text-foreground">Phone Number</label>
                  <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                    <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                    <input
                      id="manage-phone-number"
                      value={manageVendorForm.phoneNumber}
                      onChange={(event) =>
                        setManageVendorForm((current) => ({
                          ...current,
                          phoneNumber: normalizeMoroccoPhoneInput(event.target.value),
                        }))
                      }
                      placeholder="6XXXXXXXX"
                      inputMode="numeric"
                      autoComplete="tel"
                      className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="manage-vendor-commune" className="text-sm font-medium text-foreground">Jamaa Tourabiya</label>
                    <select
                      id="manage-vendor-commune"
                      value={manageVendorForm.communeId}
                      onChange={(event) =>
                        setManageVendorForm((current) => ({
                          ...current,
                          communeId: event.target.value,
                          neighborhoodIds: [],
                        }))
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="">Select commune</option>
                      {communeOptions.map((commune) => (
                        <option key={commune.id} value={commune.id}>
                          {getLocalizedCommuneName(commune)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Hay / Douar (Multi-select)</label>
                    <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3">
                      {!manageVendorForm.communeId ? (
                        <p className="text-sm text-muted-foreground">Select a commune first.</p>
                      ) : manageNeighborhoodOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No available neighborhoods in this commune.</p>
                      ) : (
                        manageNeighborhoodOptions.map((neighborhood) => {
                          const isChecked = manageVendorForm.neighborhoodIds.includes(neighborhood.id);
                          return (
                            <label key={neighborhood.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => toggleManageVendorNeighborhood(neighborhood.id, event.target.checked)}
                                className="h-4 w-4 accent-primary"
                              />
                              <span className="text-foreground">{neighborhood.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {manageVendorForm.neighborhoodIds.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {manageNeighborhoodOptions
                          .filter((n) => manageVendorForm.neighborhoodIds.includes(n.id))
                          .map((neighborhood) => (
                            <button
                              key={neighborhood.id}
                              type="button"
                              onClick={() => toggleManageVendorNeighborhood(neighborhood.id, false)}
                              className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                            >
                              {neighborhood.name} ×
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <Button
                  variant="hero"
                  className="w-full rounded-lg"
                  disabled={isUpdatingVendorDetails}
                  onClick={handleUpdateVendorDetails}
                >
                  {isUpdatingVendorDetails ? "Updating..." : "Update Vendor Details"}
                </Button>
              </TabsContent>

              <TabsContent value="sales-analytics" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
                    <p className="text-xs text-muted-foreground">Today's Revenue (MAD)</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {Math.round((analyticsQuery.data ?? emptyVendorAnalytics).todaysRevenueMad)}
                    </p>
                  </article>
                  <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
                    <p className="text-xs text-muted-foreground">Total All-Time Sales (MAD)</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {Math.round((analyticsQuery.data ?? emptyVendorAnalytics).totalAllTimeSalesMad)}
                    </p>
                  </article>
                  <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
                    <p className="text-xs text-muted-foreground">Total Completed Orders</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {(analyticsQuery.data ?? emptyVendorAnalytics).totalCompletedOrders}
                    </p>
                  </article>
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Order ID</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsQuery.isLoading ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            Loading analytics...
                          </td>
                        </tr>
                      ) : (analyticsQuery.data ?? emptyVendorAnalytics).lastFiveOrders.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            No recent orders for this vendor.
                          </td>
                        </tr>
                      ) : (
                        (analyticsQuery.data ?? emptyVendorAnalytics).lastFiveOrders.map((order) => (
                          <tr key={order.id} className="border-t border-border bg-card">
                            <td className="px-3 py-2 font-medium text-foreground">#{order.id.slice(0, 8)}</td>
                            <td className="px-3 py-2 text-muted-foreground">{order.status}</td>
                            <td className="px-3 py-2 text-muted-foreground">{Math.round(order.totalMad)} MAD</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isInitiateWithdrawalOpen} onOpenChange={setIsInitiateWithdrawalOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Initiate Partial Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {activeCollectionVendor
                ? `Pending commission: ${Number(activeCollectionVendor.platformDuesMad ?? 0).toFixed(2)} MAD`
                : "Select a vendor first."}
            </p>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={Number.isFinite(amountToCollectMad) ? String(amountToCollectMad) : "0"}
              onChange={(event) => setAmountToCollectMad(Number(event.target.value))}
              placeholder="Amount to collect (MAD)"
            />
            <Button className="w-full" onClick={handleGenerateWithdrawalQr}>
              Generate QR
            </Button>
            {platformCollectionQrPayload ? (
              <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
                <QRCodeSVG value={platformCollectionQrPayload} size={220} includeMargin />
              </div>
            ) : null}

            <div className="space-y-2 pt-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Commission Ledger History · سجل دفتر العمولة</h3>
                <p className="text-xs text-muted-foreground">Vendor-only accrual/withdrawal history.</p>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Date / Time</th>
                      <th className="px-3 py-2">Transaction</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformCollectionHistoryQuery.isLoading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground sm:text-sm">
                          Loading collection history...
                        </td>
                      </tr>
                    ) : vendorScopedCollectionHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground sm:text-sm">
                          No collection history yet.
                        </td>
                      </tr>
                    ) : (
                      vendorScopedCollectionHistory.map((row) => (
                        <tr key={row.transactionId} className="border-t border-border bg-card">
                          <td className="px-3 py-2 text-muted-foreground">{formatCollectionDateTime(row.collectedAt)}</td>
                          <td className="px-3 py-2 text-foreground">{row.transactionLabel}</td>
                          <td className="px-3 py-2 text-foreground">{Number(row.amountMad ?? 0).toFixed(2)} MAD</td>
                          <td className="px-3 py-2 text-foreground">{Number(row.remainingBalanceMad ?? 0).toFixed(2)} MAD</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isProductModalOpen}
        onOpenChange={(open) => {
          setIsProductModalOpen(open);
          if (!open) {
            setEditingProductId(null);
            setProductImageFile(null);
            setProductImagePreviewUrl(null);
            setCurrentProductImageUrl(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProductId ? t("admin.catalog.modals.editMasterProduct") : t("admin.catalog.modals.addMasterProduct")}</DialogTitle>
            <DialogDescription>
              {editingProductId
                ? t("admin.catalog.modals.editMasterProductDescription")
                : t("admin.catalog.modals.addMasterProductDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => productImageInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleProductImageDrop}
              className="w-full rounded-md border border-dashed border-border bg-muted/40 p-4 text-center transition hover:border-primary/60"
            >
              <input
                ref={productImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProductImageChange}
              />
              {productImagePreviewUrl ? (
                <img
                  src={productImagePreviewUrl}
                  alt="Selected product preview"
                  className="mx-auto aspect-square w-full max-w-[240px] rounded-md bg-muted/40 object-contain object-center p-2"
                />
              ) : (
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ImagePlus className="size-5" />
                </span>
              )}
                <p className="mt-2 text-sm font-medium text-foreground">
                  {productImagePreviewUrl ? t("admin.catalog.modals.imageSelected") : t("admin.catalog.modals.uploadProductImage")}
                </p>
                <p className="text-xs text-muted-foreground">{t("admin.catalog.modals.clickOrDragImage")}</p>
            </button>

            <div className="space-y-2">
              <label htmlFor="product-name-en" className="text-sm font-medium text-foreground">
                {t("admin.productNameEn")}
              </label>
              <input
                id="product-name-en"
                value={productForm.name}
                onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={t("admin.catalog.modals.placeholders.productNameEn")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="product-name-fr" className="text-sm font-medium text-foreground">
                {t("admin.productNameFr")}
              </label>
              <input
                id="product-name-fr"
                value={productForm.nameFr}
                onChange={(event) => setProductForm((current) => ({ ...current, nameFr: event.target.value }))}
                placeholder={t("admin.catalog.modals.placeholders.productNameFr")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="product-name-ar" className="text-sm font-medium text-foreground">
                {t("admin.productNameAr")}
              </label>
              <input
                id="product-name-ar"
                value={productForm.nameAr}
                onChange={(event) => setProductForm((current) => ({ ...current, nameAr: event.target.value }))}
                placeholder={t("admin.catalog.modals.placeholders.productNameAr")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="product-brand" className="text-sm font-medium text-foreground">
                {t("admin.catalog.modals.brand")}
              </label>
              <Popover open={brandPickerOpen} onOpenChange={setBrandPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={brandPickerOpen}
                    className="h-10 w-full justify-between rounded-md"
                  >
                    <span className="truncate">
                      {brands.find((brand) => brand.id === productForm.brandId)?.name_en || t("admin.catalog.modals.noBrand")}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("admin.catalog.modals.searchBrand")} />
                    <CommandList>
                      <CommandEmpty>{t("admin.catalog.modals.noBrandFound")}</CommandEmpty>
                      <CommandItem
                        value="no-brand"
                        onSelect={() => {
                          setProductForm((current) => ({ ...current, brandId: "" }));
                          setBrandPickerOpen(false);
                        }}
                      >
                        {t("admin.catalog.modals.noBrand")}
                      </CommandItem>
                      {brands.map((brand) => (
                        <CommandItem
                          key={brand.id}
                          value={`${brand.name_en} ${brand.name_fr ?? ""} ${brand.name_ar ?? ""}`}
                          onSelect={() => {
                            setProductForm((current) => ({ ...current, brandId: brand.id }));
                            setBrandPickerOpen(false);
                          }}
                        >
                          <span className="truncate">{brand.name_en}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-foreground">
                {t("admin.catalog.modals.category")}
              </label>
              <select
                id="category"
                value={productForm.categoryId}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              >
                <option value="">{t("admin.catalog.modals.selectCategory")}</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("admin.catalog.modals.measurement")}</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="measurement-value"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={productForm.measurementValue}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      measurementValue: event.target.value,
                    }))
                  }
                  placeholder={t("admin.catalog.modals.placeholders.measurementValue")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                />
                <select
                  id="measurement-unit"
                  value={productForm.measurementUnit}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      measurementUnit: event.target.value as MeasurementUnit,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                >
                  {measurementUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="product-variant-input" className="text-sm font-medium text-foreground">
                {t("admin.catalog.modals.productVariants")}
              </label>
              <Input
                id="product-variant-input"
                value={productVariantInput}
                onChange={(event) => setProductVariantInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addProductVariantTag(productVariantInput);
                  }
                }}
                onBlur={() => {
                  if (productVariantInput.trim().length > 0) {
                    addProductVariantTag(productVariantInput);
                  }
                }}
                placeholder={t("admin.catalog.modals.placeholders.variantInput")}
              />
              {parsedProductVariants.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {parsedProductVariants.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => removeProductVariantTag(variant)}
                      className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                    >
                      {variant} ×
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("admin.catalog.modals.noVariants")}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="popularity-score" className="text-sm font-medium text-foreground">
                {t("admin.catalog.modals.popularityScore")}
              </label>
              <input
                id="popularity-score"
                type="number"
                min={0}
                step={1}
                value={productForm.popularityScore}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    popularityScore: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="hero"
              className="w-full rounded-md"
              onClick={saveMasterProduct}
              disabled={isUploadingProduct}
            >
              {isUploadingProduct ? t("admin.common.uploading") : editingProductId ? t("admin.catalog.modals.updateProduct") : t("admin.catalog.modals.saveProduct")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBrandModalOpen}
        onOpenChange={(open) => {
          setIsBrandModalOpen(open);
          if (!open) {
            resetBrandForm();
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBrandId ? t("admin.brands.modals.editBrand") : t("admin.brands.modals.addNewBrand")}</DialogTitle>
            <DialogDescription>{t("admin.brands.modals.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => brandLogoInputRef.current?.click()}
              className="w-full rounded-md border border-dashed border-border bg-muted/40 p-4 text-center transition hover:border-primary/60"
            >
              <input
                ref={brandLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBrandLogoChange}
              />
              {brandLogoPreviewUrl ? (
                <img
                  src={brandLogoPreviewUrl}
                  alt="Brand logo preview"
                  className="mx-auto h-24 w-24 rounded-md border border-border bg-background object-contain p-2"
                />
              ) : (
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ImagePlus className="size-5" />
                </span>
              )}
              <p className="mt-2 text-sm font-medium text-foreground">{t("admin.brands.modals.uploadBrandLogo")}</p>
            </button>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("admin.brands.modals.nameEn")}</label>
              <Input
                value={brandForm.nameEn}
                onChange={(event) => setBrandForm((current) => ({ ...current, nameEn: event.target.value }))}
                placeholder={t("admin.brands.modals.placeholders.nameEn")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("admin.brands.modals.nameFr")}</label>
              <Input
                value={brandForm.nameFr}
                onChange={(event) => setBrandForm((current) => ({ ...current, nameFr: event.target.value }))}
                placeholder={t("admin.brands.modals.placeholders.nameFr")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("admin.brands.modals.nameAr")}</label>
              <Input
                value={brandForm.nameAr}
                onChange={(event) => setBrandForm((current) => ({ ...current, nameAr: event.target.value }))}
                placeholder={t("admin.brands.modals.placeholders.nameAr")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="hero" className="w-full rounded-md" onClick={saveBrandHandler} disabled={isSavingBrand}>
              {isSavingBrand ? t("admin.common.saving") : editingBrandId ? t("admin.brands.modals.updateBrand") : t("admin.brands.modals.saveBrand")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingArchiveProduct)} onOpenChange={(open) => (!open ? setPendingArchiveProduct(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive product?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingArchiveProduct
                ? `Are you sure you want to archive ${pendingArchiveProduct.name}?`
                : "Are you sure you want to archive this product?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchiveProduct}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isFactoryResetDialogOpen}
        onOpenChange={(open) => {
          setIsFactoryResetDialogOpen(open);
          if (!open) {
            setFactoryResetConfirmationText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Orders Reset (مسح الطلبات فقط)</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع بيانات الطلبات نهائيًا فقط (مع Order ID وكل سجل داخل Orders). لن يتم حذف Customers, Vendors,
              Cyclists, Service Zones, Global Catalog, Brands, Categories, Ads & Content, أو Settings. اكتب RESET_ALL للتأكيد.
              سيتم أيضًا تصفير vendor_earnings و platform_dues لدى كل المتاجر.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label htmlFor="factory-reset-confirmation" className="text-sm font-medium text-foreground">
              Confirmation text
            </label>
            <Input
              id="factory-reset-confirmation"
              value={factoryResetConfirmationText}
              onChange={(event) => setFactoryResetConfirmationText(event.target.value)}
              placeholder="RESET_ALL"
              autoComplete="off"
              className="rounded-md"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingFactoryData}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleFactoryReset();
              }}
              disabled={isResettingFactoryData || factoryResetConfirmationText.trim() !== "RESET_ALL"}
            >
              {isResettingFactoryData ? "Resetting..." : "Reset Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

function AdminSidebar({ activeTab }: { activeTab: AdminTab }) {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{collapsed ? "" : t("admin.sidebar.controlCenter")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.tab}>
                  <SidebarMenuButton asChild isActive={activeTab === item.tab} tooltip={t(item.label)}>
                    <Link
                      to="/admin"
                      search={{ tab: item.tab }}
                      className="flex items-center gap-2 rounded-md hover:bg-sidebar-accent/70"
                    >
                      <item.icon className="size-4" />
                      {!collapsed ? <span>{t(item.label)}</span> : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function OverviewSection({
  analytics,
  isLoading,
  error,
}: {
  analytics: OverviewAnalytics | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  const formatMad = (value: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} MAD`;
  const formatDelta = (value: number, format: "integer" | "currency") => {
    const abs = Math.abs(value);
    return format === "currency" ? `${formatMad(abs)}` : formatNumber(abs);
  };

  if (error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        Failed to load dashboard analytics.
      </section>
    );
  }

  const metrics: Array<{
    label: string;
    subtitle?: string;
    metric: OverviewKpiMetric;
    icon: ComponentType<{ className?: string }>;
    tone: "indigo" | "emerald" | "violet" | "amber";
  }> = [
    { label: "Total Orders", metric: analytics?.kpis.totalOrders ?? { value: 0, previousValue: 0, change: 0, changePercentage: 0, format: "integer" }, icon: PackageCheck, tone: "indigo" },
    { label: "Active Vendors", metric: analytics?.kpis.activeVendors ?? { value: 0, previousValue: 0, change: 0, changePercentage: 0, format: "integer" }, icon: Store, tone: "emerald" },
    {
      label: "Total Gross Volume",
      metric: analytics?.kpis.totalGrossVolume ?? { value: 0, previousValue: 0, change: 0, changePercentage: 0, format: "currency" },
      icon: Wallet,
      tone: "violet",
    },
    { label: "Vendors Revenue", metric: analytics?.kpis.vendorsRevenue ?? { value: 0, previousValue: 0, change: 0, changePercentage: 0, format: "currency" }, icon: CircleDollarSign, tone: "emerald" },
    { label: "Cyclists Earnings", metric: analytics?.kpis.cyclistsEarnings ?? { value: 0, previousValue: 0, change: 0, changePercentage: 0, format: "currency" }, icon: BikeIcon, tone: "amber" },
    {
      label: "Platform Profit",
      subtitle: "Pending Collection / متاح للسحب",
      metric: analytics?.kpis.platformProfit ?? { value: 0, previousValue: 0, change: 0, changePercentage: 0, format: "currency" },
      icon: Landmark,
      tone: "indigo",
    },
  ];

  const toneClasses = {
    indigo: "bg-primary/12 text-primary",
    emerald: "bg-success/16 text-success",
    violet: "bg-highlight/16 text-highlight-foreground",
    amber: "bg-accent/16 text-accent-foreground",
  };

  const zoneChartData = useMemo(() => {
    const top = analytics?.zonePerformance.top ?? [];
    const bottom = analytics?.zonePerformance.bottom ?? [];
    const zones = Array.from(new Set([...top.map((item) => item.zone), ...bottom.map((item) => item.zone)]));

    return zones.map((zone) => {
      const topRow = top.find((item) => item.zone === zone);
      const bottomRow = bottom.find((item) => item.zone === zone);
      return {
        zone,
        topOrders: topRow?.orders ?? 0,
        bottomOrders: bottomRow?.orders ?? 0,
      };
    });
  }, [analytics?.zonePerformance.bottom, analytics?.zonePerformance.top]);

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_10px_30px_-22px_oklch(0.45_0.03_240/0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                {metric.subtitle ? <p className="mt-1 text-[11px] font-medium text-muted-foreground">{metric.subtitle}</p> : null}
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {isLoading
                    ? "..."
                    : metric.metric.format === "currency"
                      ? formatMad(metric.metric.value)
                      : formatNumber(metric.metric.value)}
                </p>
              </div>
              <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", toneClasses[metric.tone])}>
                <metric.icon className="size-4" />
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium">
              {metric.metric.change >= 0 ? (
                <ArrowUpRight className="size-3.5 text-success" />
              ) : (
                <ArrowDownRight className="size-3.5 text-accent" />
              )}
              <span className={metric.metric.change >= 0 ? "text-success" : "text-accent-foreground"}>
                {formatDelta(metric.metric.change, metric.metric.format)} ({Math.abs(metric.metric.changePercentage).toFixed(1)}%)
              </span>
              <span className="text-muted-foreground">vs yesterday</span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_10px_30px_-22px_oklch(0.45_0.03_240/0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Sales & Orders Trends</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Last 7 days
            </span>
          </div>
          {isLoading ? (
            <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              Loading trends...
            </div>
          ) : (
            <ChartContainer config={salesOrdersChartConfig} className="h-72 w-full">
              <AreaChart data={analytics?.salesOrdersTrends ?? []} margin={{ left: 4, right: 4, top: 6, bottom: 6 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} width={42} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Area yAxisId="left" type="monotone" dataKey="orders" stroke="var(--color-orders)" fill="var(--color-orders)" fillOpacity={0.2} strokeWidth={2.2} />
                <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.14} strokeWidth={2.2} />
              </AreaChart>
            </ChartContainer>
          )}
        </article>

        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_10px_30px_-22px_oklch(0.45_0.03_240/0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Delivery Speed by Zone</h2>
            <Gauge className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {(analytics?.deliverySpeedMetrics ?? []).slice(0, 6).map((zone) => (
              <div key={zone.zone} className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{zone.zone}</p>
                  <p className="text-xs text-muted-foreground">{zone.deliveries} deliveries</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                    zone.performance === "fast" && "bg-success/15 text-success",
                    zone.performance === "slow" && "bg-accent/20 text-accent-foreground",
                    zone.performance === "normal" && "bg-muted text-muted-foreground",
                  )}
                >
                  {zone.avgMinutes.toFixed(0)} min
                </span>
              </div>
            ))}
            {!isLoading && (analytics?.deliverySpeedMetrics ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                Not enough completed deliveries yet.
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr_1fr]">
        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_10px_30px_-22px_oklch(0.45_0.03_240/0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Zone Performance</h2>
            <Building2 className="size-4 text-muted-foreground" />
          </div>
          <ChartContainer config={zonePerformanceChartConfig} className="h-72 w-full">
            <BarChart data={zoneChartData} margin={{ left: 4, right: 4, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="zone" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="topOrders" fill="var(--color-topOrders)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="bottomOrders" fill="var(--color-bottomOrders)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </article>

        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_10px_30px_-22px_oklch(0.45_0.03_240/0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Top Neighborhoods</h2>
            <MapPin className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {(analytics?.marketInsights.topNeighborhoods ?? []).map((item, index) => (
              <div key={`${item.neighborhood}-${index}`} className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.neighborhood}</p>
                  <p className="text-xs text-muted-foreground">{item.zone}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{item.orders} orders</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_10px_30px_-22px_oklch(0.45_0.03_240/0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Top Brands & Categories</h2>
            <Trophy className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock3 className="size-3.5" />
                Brands
              </p>
              <div className="space-y-2">
                {(analytics?.marketInsights.topBrands ?? []).slice(0, 3).map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{formatMad(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingDown className="size-3.5" />
                Categories
              </p>
              <div className="space-y-2">
                {(analytics?.marketInsights.topCategories ?? []).slice(0, 3).map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.orders} orders</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function VendorsSection({
  vendors,
  isLoading,
  onAddVendor,
  onManageVendor,
  onCollectPlatformDues,
}: {
  vendors: AdminVendorRecord[];
  isLoading: boolean;
  onAddVendor: () => void;
  onManageVendor: (vendor: AdminVendorRecord) => void;
  onCollectPlatformDues: (vendor: AdminVendorRecord) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("admin.vendors.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.vendors.subtitle")}</p>
        </div>
        <Button variant="hero" className="rounded-md" onClick={onAddVendor}>
          {t("admin.vendors.addNew")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("admin.vendors.table.vendorName")}</th>
              <th className="px-4 py-3">{t("admin.vendors.table.zone")}</th>
              <th className="px-4 py-3">{t("admin.vendors.table.status")}</th>
              <th className="px-4 py-3">{t("admin.vendors.table.action")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState title={t("admin.vendors.loadingTitle")} subtitle={t("admin.vendors.loadingSubtitle")} className="border-0 bg-transparent py-2" />
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState
                      title={t("admin.vendors.emptyTitle")}
                      subtitle={t("admin.vendors.emptySubtitle")}
                    className="border-0 bg-transparent py-2"
                  />
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
              <tr key={vendor.id} className="border-t border-border bg-card">
                <td className="px-4 py-3 font-medium text-foreground">
                  <div className="space-y-0.5">
                    <p>{vendor.storeName}</p>
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="size-3" />
                      {vendor.ownerName}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {vendor.zone}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      vendor.status === "Active"
                        ? "inline-flex rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"
                        : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {vendor.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <Button variant="soft" size="sm" className="rounded-md" onClick={() => onManageVendor(vendor)}>
                      {t("admin.common.manage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-md"
                      onClick={() => onCollectPlatformDues(vendor)}
                      disabled={Number(vendor.platformDuesMad ?? 0) <= 0}
                    >
                      <CircleDollarSign className="size-3.5" />
                      Collect Commission {Number(vendor.platformDuesMad ?? 0).toFixed(2)} MAD
                    </Button>
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      {vendor.phoneNumber}
                    </p>
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}

function CyclistsSection({
  cyclists,
  isLoading,
  onAddCyclist,
}: {
  cyclists: AdminCyclistRecord[];
  isLoading: boolean;
  onAddCyclist: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("admin.cyclists.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.cyclists.subtitle")}</p>
        </div>
        <Button variant="hero" className="rounded-md" onClick={onAddCyclist}>
          {t("admin.cyclists.addNew")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("admin.cyclists.table.cyclist")}</th>
              <th className="px-4 py-3">{t("admin.cyclists.table.assignedZone")}</th>
              <th className="px-4 py-3">{t("admin.cyclists.table.phone")}</th>
              <th className="px-4 py-3">{t("admin.cyclists.table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState title={t("admin.cyclists.loadingTitle")} subtitle={t("admin.cyclists.loadingSubtitle")} className="border-0 bg-transparent py-2" />
                </td>
              </tr>
            ) : cyclists.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState
                      title={t("admin.cyclists.emptyTitle")}
                      subtitle={t("admin.cyclists.emptySubtitle")}
                    className="border-0 bg-transparent py-2"
                  />
                </td>
              </tr>
            ) : (
              cyclists.map((cyclist) => (
                <tr key={cyclist.id} className="border-t border-border bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">{cyclist.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {cyclist.zone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {cyclist.phoneNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        cyclist.status === "Active"
                          ? "inline-flex rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"
                          : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {cyclist.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ServiceZonesSection({
  zones,
  isLoading,
  isImporting,
  form,
  onFormChange,
  onSaveCommune,
  onSaveNeighborhood,
  onDownloadExport,
  serviceZonesCsvInputRef,
  onImportCsv,
  onOpenCommuneProfile,
  localizeCommuneName,
}: {
  zones: ServiceZoneTree;
  isLoading: boolean;
  isImporting: boolean;
  form: {
    communeNameEn: string;
    communeNameFr: string;
    communeNameAr: string;
    neighborhoodCommuneId: string;
    neighborhoodNameEn: string;
    neighborhoodNameFr: string;
    neighborhoodNameAr: string;
    neighborhoodDeliveryFee: string;
  };
  onFormChange: Dispatch<
    SetStateAction<{
      communeNameEn: string;
      communeNameFr: string;
      communeNameAr: string;
      neighborhoodCommuneId: string;
      neighborhoodNameEn: string;
      neighborhoodNameFr: string;
      neighborhoodNameAr: string;
      neighborhoodDeliveryFee: string;
    }>
  >;
  onSaveCommune: () => void;
  onSaveNeighborhood: () => void;
  onDownloadExport: () => void | Promise<void>;
  serviceZonesCsvInputRef: RefObject<HTMLInputElement | null>;
  onImportCsv: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onOpenCommuneProfile: (communeId: string) => void;
  localizeCommuneName: (commune: ServiceZoneTree[number]) => string;
}) {
  const { t } = useTranslation();
  const formatNeighborhoodLabel = (neighborhood: ServiceZoneTree[number]["neighborhoods"][number]) => {
    const labels = [neighborhood.nameEn, neighborhood.nameFr, neighborhood.nameAr]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(labels)).join(" / ");
  };

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("admin.serviceZones.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.serviceZones.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="rounded-md" onClick={onDownloadExport}>
          <Download className="size-4" />
          {t("admin.serviceZones.downloadExportXlsx")}
        </Button>
        <input
          ref={serviceZonesCsvInputRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={onImportCsv}
        />
        <Button
          variant="outline"
          className="rounded-md"
          onClick={() => serviceZonesCsvInputRef.current?.click()}
          disabled={isImporting}
        >
          <FileUp className="size-4" />
          {isImporting ? t("admin.common.importing") : t("admin.serviceZones.importBulk")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <label htmlFor="new-commune" className="text-sm font-medium text-foreground">
            {t("admin.serviceZones.newCommune")}
          </label>
          <input
            id="new-commune"
            value={form.communeNameEn}
            onChange={(event) => onFormChange((current) => ({ ...current, communeNameEn: event.target.value }))}
            placeholder={t("admin.serviceZones.placeholders.communeNameEnExample")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <input
            value={form.communeNameFr}
            onChange={(event) => onFormChange((current) => ({ ...current, communeNameFr: event.target.value }))}
            placeholder={t("admin.serviceZones.placeholders.communeNameFr")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <input
            value={form.communeNameAr}
            onChange={(event) => onFormChange((current) => ({ ...current, communeNameAr: event.target.value }))}
            placeholder={t("admin.serviceZones.placeholders.communeNameArExample")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <Button variant="hero" className="w-full rounded-md" onClick={onSaveCommune}>
            {t("admin.serviceZones.addCommune")}
          </Button>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <label htmlFor="neighborhood-commune" className="text-sm font-medium text-foreground">
            {t("admin.serviceZones.communeForNewDouar")}
          </label>
          <select
            id="neighborhood-commune"
            value={form.neighborhoodCommuneId}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                neighborhoodCommuneId: event.target.value,
              }))
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          >
            <option value="">{t("admin.common.selectCommune")}</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {localizeCommuneName(zone)}
              </option>
            ))}
          </select>
          <input
            id="new-neighborhood"
            value={form.neighborhoodNameEn}
            onChange={(event) => onFormChange((current) => ({ ...current, neighborhoodNameEn: event.target.value }))}
            placeholder={t("admin.serviceZones.placeholders.neighborhoodNameEn")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <input
            value={form.neighborhoodNameFr}
            onChange={(event) => onFormChange((current) => ({ ...current, neighborhoodNameFr: event.target.value }))}
            placeholder={t("admin.serviceZones.placeholders.neighborhoodNameFr")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <input
            value={form.neighborhoodNameAr}
            onChange={(event) => onFormChange((current) => ({ ...current, neighborhoodNameAr: event.target.value }))}
            placeholder={t("admin.serviceZones.placeholders.neighborhoodNameArExample")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <input
            id="neighborhood-delivery-fee"
            type="number"
            min="0"
            step="0.01"
            value={form.neighborhoodDeliveryFee}
            onChange={(event) => onFormChange((current) => ({ ...current, neighborhoodDeliveryFee: event.target.value }))}
            placeholder={t("admin.serviceZones.placeholders.deliveryFeeMad")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <Button variant="hero" className="w-full rounded-md" onClick={onSaveNeighborhood}>
            {t("admin.serviceZones.addNeighborhoodDouar")}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground">
          {t("admin.serviceZones.configuredZones")}
        </div>
        {isLoading ? (
          <div className="p-4">
            <AppEmptyState title={t("admin.serviceZones.loadingTitle")} subtitle={t("admin.serviceZones.loadingSubtitle")} />
          </div>
        ) : zones.length === 0 ? (
          <div className="p-4">
            <AppEmptyState title={t("admin.serviceZones.emptyTitle")} subtitle={t("admin.serviceZones.emptySubtitle")} />
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {zones.map((zone) => (
              <div key={zone.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-sm font-semibold text-foreground underline decoration-border underline-offset-4 transition hover:text-primary"
                    onClick={() => onOpenCommuneProfile(zone.id)}
                  >
                    {localizeCommuneName(zone)}
                  </button>
                  <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => onOpenCommuneProfile(zone.id)}>
                    {t("admin.common.manage")}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {zone.neighborhoods.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t("admin.serviceZones.noNeighborhoodsYet")}</span>
                  ) : (
                    zone.neighborhoods.map((neighborhood) => (
                      <div key={neighborhood.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2 py-1">
                        <span className="text-xs text-foreground">
                          {formatNeighborhoodLabel(neighborhood)} - {Number(neighborhood.deliveryFee ?? 0).toFixed(2)} MAD
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CatalogSection({
  products,
  allProductsCount,
  categories,
  brands,
  isLoading,
  isImporting,
  searchTerm,
  selectedCategoryId,
  selectedBrandId,
  onSearchTermChange,
  onCategoryChange,
  onBrandChange,
  masterProductsCsvInputRef,
  onAddProduct,
  onDownloadTemplate,
  onDownloadExample,
  onImportCsv,
  onEditProduct,
  onArchiveProduct,
}: {
  products: MasterProductEntity[];
  allProductsCount: number;
  categories: CategoryAdminRow[];
  brands: BrandAdminRow[];
  isLoading: boolean;
  isImporting: boolean;
  searchTerm: string;
  selectedCategoryId: string;
  selectedBrandId: string;
  onSearchTermChange: Dispatch<SetStateAction<string>>;
  onCategoryChange: Dispatch<SetStateAction<string>>;
  onBrandChange: Dispatch<SetStateAction<string>>;
  masterProductsCsvInputRef: RefObject<HTMLInputElement | null>;
  onAddProduct: () => void;
  onDownloadTemplate: () => void | Promise<void>;
  onDownloadExample: () => void;
  onImportCsv: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onEditProduct: (product: MasterProductEntity) => void;
  onArchiveProduct: (product: MasterProductEntity) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("admin.catalog.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.catalog.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" className="rounded-md" onClick={onDownloadTemplate}>
            <Download className="size-4" />
            {t("admin.catalog.downloadExportXlsx")}
          </Button>
          <Button variant="outline" className="rounded-md" onClick={onDownloadExample}>
            <Download className="size-4" />
            {t("admin.catalog.downloadExampleCsv")}
          </Button>
          <input
            ref={masterProductsCsvInputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={onImportCsv}
          />
          <Button
            variant="outline"
            className="rounded-md"
            onClick={() => masterProductsCsvInputRef.current?.click()}
            disabled={isImporting}
          >
            <FileUp className="size-4" />
            {isImporting ? t("admin.common.importing") : t("admin.catalog.importBulkProducts")}
          </Button>
          <Button variant="hero" className="rounded-md" onClick={onAddProduct}>
            {t("admin.catalog.addMasterProduct")}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder={t("admin.catalog.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <Select value={selectedCategoryId} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t("admin.catalog.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.catalog.allCategories")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedBrandId} onValueChange={onBrandChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t("admin.catalog.allBrands")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.catalog.allBrands")}</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground">{t("admin.catalog.showingProducts", { shown: products.length, total: allProductsCount })}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {isLoading ? (
          <AppEmptyState title="Loading products..." subtitle="Syncing the master product catalog." className="col-span-full" />
        ) : allProductsCount === 0 ? (
          <AppEmptyState
            title="No master products yet."
            subtitle="Add your first shared product."
            className="col-span-full"
          />
        ) : products.length === 0 ? (
          <AppEmptyState
            title="No products match these filters."
            subtitle="Try changing the search text, category, or brand."
            className="col-span-full"
          />
        ) : (
          products.map((product) => {
            const categoryName = categories.find((category) => category.id === product.categoryId)?.name_en ?? product.category;

            return (
              <article key={product.id} className="rounded-md border border-border bg-background p-3 transition hover:-translate-y-0.5 hover:shadow-sm">
            <div className="mb-2 h-32 overflow-hidden rounded-md border border-border bg-muted/40">
              <img
                src={product.imageUrl || fallbackProductImage}
                alt={`${product.name} product image`}
                className="h-full w-full object-contain object-center p-1.5"
                loading="lazy"
                width={480}
                height={240}
              />
            </div>
            <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
            <p className="mt-1 text-xs font-medium text-foreground">{product.brandNameEn || "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{categoryName}</p>
            <p className="mt-2 text-xs font-semibold text-primary">
              Unit: {product.measurementValue != null ? `${product.measurementValue} ` : ""}
              {product.measurementUnit}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-md px-2 text-xs" onClick={() => onEditProduct(product)}>
                Edit
              </Button>
              <Button type="button" size="sm" variant="destructive" className="h-8 rounded-md px-2 text-xs" onClick={() => onArchiveProduct(product)}>
                Archive
              </Button>
            </div>
          </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function BrandsSection({
  brands,
  isLoading,
  isImporting,
  brandCsvInputRef,
  onAddBrand,
  onDownloadTemplate,
  onImportCsv,
  onEditBrand,
  onDeleteBrand,
}: {
  brands: BrandAdminRow[];
  isLoading: boolean;
  isImporting: boolean;
  brandCsvInputRef: RefObject<HTMLInputElement | null>;
  onAddBrand: () => void;
  onDownloadTemplate: () => void;
  onImportCsv: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onEditBrand: (brand: BrandAdminRow) => void;
  onDeleteBrand: (brand: BrandAdminRow) => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Brands · الماركات</h2>
          <p className="text-sm text-muted-foreground">Centralized multilingual brand registry for all products.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" className="rounded-md" onClick={onDownloadTemplate}>
            <Download className="size-4" />
            Download CSV Template
          </Button>
          <input
            ref={brandCsvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportCsv}
          />
          <Button
            variant="outline"
            className="rounded-md"
            onClick={() => brandCsvInputRef.current?.click()}
            disabled={isImporting}
          >
            <FileUp className="size-4" />
            {isImporting ? "Importing..." : "Import Bulk Brands"}
          </Button>
          <Button variant="hero" className="rounded-md" onClick={onAddBrand}>
            + Add New Brand
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Logo</th>
              <th className="px-3 py-2 font-medium">English</th>
              <th className="px-3 py-2 font-medium">Français</th>
              <th className="px-3 py-2 font-medium">العربية</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                  Loading brands...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                  No brands yet.
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr key={brand.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={`${brand.name_en} logo`}
                        className="h-10 w-10 rounded-md border border-border object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">{brand.name_en}</td>
                  <td className="px-3 py-2 text-muted-foreground">{brand.name_fr || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{brand.name_ar || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-md" onClick={() => onEditBrand(brand)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-md"
                        onClick={() => onDeleteBrand(brand)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CategoriesSection({
  categories,
  isLoading,
  form,
  onFormChange,
  onSave,
  onEdit,
  onReset,
  isSaving,
  imageInputRef,
  imagePreviewUrl,
  onImageChange,
}: {
  categories: CategoryAdminRow[];
  isLoading: boolean;
  form: {
    id: string;
    nameEn: string;
    nameFr: string;
    nameAr: string;
    imageUrl: string;
    iconName: CategoryIconName;
    accentColor: string;
    sortOrder: string;
    isActive: boolean;
  };
  onFormChange: Dispatch<
    SetStateAction<{
      id: string;
      nameEn: string;
      nameFr: string;
      nameAr: string;
      imageUrl: string;
      iconName: CategoryIconName;
      accentColor: string;
      sortOrder: string;
      isActive: boolean;
    }>
  >;
  onSave: () => void;
  onEdit: (category: CategoryAdminRow) => void;
  onReset: () => void;
  isSaving: boolean;
  imageInputRef: RefObject<HTMLInputElement | null>;
  imagePreviewUrl: string | null;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Categories</h2>
        <p className="text-sm text-muted-foreground">Manage multilingual sections for homepage and customer category pages.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-center transition hover:border-primary/60"
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageChange}
              />
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Category image preview"
                  className="mx-auto aspect-square w-full max-w-[220px] rounded-md object-cover"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Upload category cover</span>
              )}
            </button>

            <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-center">
              <div
                className="mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl"
                style={{ backgroundColor: form.accentColor || "#f3f4f6" }}
              >
                <CategoryIcon iconName={form.iconName} className="h-20 w-20 text-foreground" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Name (EN)</label>
              <input
                value={form.nameEn}
                onChange={(event) => onFormChange((current) => ({ ...current, nameEn: event.target.value }))}
                placeholder="e.g. Vegetables"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name (FR)</label>
              <input
                value={form.nameFr}
                onChange={(event) => onFormChange((current) => ({ ...current, nameFr: event.target.value }))}
                placeholder="e.g. Légumes"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name (AR)</label>
              <input
                value={form.nameAr}
                onChange={(event) => onFormChange((current) => ({ ...current, nameAr: event.target.value }))}
                placeholder="مثال: خضروات"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Image URL (optional)</label>
              <input
                value={form.imageUrl}
                onChange={(event) => onFormChange((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="https://..."
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Category Icon</label>
              <Popover open={isIconPickerOpen} onOpenChange={setIsIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isIconPickerOpen}
                    className="h-10 w-full justify-between rounded-md"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon iconName={form.iconName} className="h-4 w-4" />
                      {form.iconName}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search icon..." />
                    <CommandList>
                      <CommandEmpty>No icon found.</CommandEmpty>
                      {CATEGORY_ICON_OPTIONS.map((iconName) => (
                        <CommandItem
                          key={iconName}
                          value={iconName}
                          onSelect={() => {
                            onFormChange((current) => ({ ...current, iconName }));
                            setIsIconPickerOpen(false);
                          }}
                        >
                          <CategoryIcon iconName={iconName} className="h-4 w-4" />
                          <span>{iconName}</span>
                          <span className={cn("ml-auto text-xs", form.iconName === iconName ? "text-primary" : "text-transparent")}>Selected</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(event) => onFormChange((current) => ({ ...current, accentColor: event.target.value }))}
                  className="h-10 w-12 rounded-md border border-input bg-background p-1"
                />
                <input
                  value={form.accentColor}
                  onChange={(event) => onFormChange((current) => ({ ...current, accentColor: event.target.value }))}
                  placeholder="#fef3c7"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => onFormChange((current) => ({ ...current, sortOrder: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => onFormChange((current) => ({ ...current, isActive: checked }))}
              />
              <span className="text-sm text-foreground">Active</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="hero" className="rounded-md" onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving..." : form.id ? "Update Category" : "Add Category"}
            </Button>
            <Button type="button" variant="outline" className="rounded-md" onClick={onReset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <h3 className="text-sm font-semibold text-foreground">Saved Categories</h3>
          {isLoading ? (
            <AppEmptyState title="Loading categories..." subtitle="Please wait while categories are fetched." className="py-5" />
          ) : categories.length === 0 ? (
            <AppEmptyState title="No categories yet." subtitle="Create your first category to organize products." className="py-5" />
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <article key={category.id} className="flex items-center gap-3 rounded-md border border-border bg-card p-2">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: category.accent_color || "#f3f4f6" }}
                  >
                    {category.image_url ? (
                      <img
                        src={category.image_url || fallbackProductImage}
                        alt={`${category.name_en} category icon`}
                        className="h-10 w-10 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <CategoryIcon iconName={category.icon_name} className="h-10 w-10 text-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{category.name_en}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {category.name_fr} • {category.name_ar}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Sort: {category.sort_order}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="rounded-md" onClick={() => onEdit(category)}>
                    Edit
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AdsContentSection({
  ads,
  announcements,
  isLoading,
  adTargetZones,
  adForm,
  onAdFormChange,
  onSaveAd,
  onEditAd,
  onDeleteAd,
  onToggleAdActive,
  onResetAdForm,
  isSavingAd,
  announcementForm,
  onAnnouncementFormChange,
  onSaveAnnouncement,
  onEditAnnouncement,
  onDeleteAnnouncement,
  onToggleAnnouncementActive,
  onResetAnnouncementForm,
  isSavingAnnouncement,
}: {
  ads: Array<{
    id: string;
    campaign_name: string;
    zone_id: string | null;
    campaign_type: "AD" | "PROMO" | "NEWS";
    views_count: number;
    image_ar: string | null;
    image_fr: string | null;
    image_en: string | null;
    target_url: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
  }>;
  announcements: Array<{
    id: string;
    message_en: string | null;
    message_fr: string | null;
    message_ar: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
    created_at: string;
  }>;
  isLoading: boolean;
  adTargetZones: Array<{
    id: string;
    zoneCode: string;
    communeName: string;
    zoneName: string;
  }>;
  adForm: {
    id: string;
    campaignName: string;
    zoneId: string;
    campaignType: "AD" | "PROMO" | "NEWS";
    imageAr: string;
    imageFr: string;
    imageEn: string;
    targetUrl: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
  onAdFormChange: Dispatch<
    SetStateAction<{
      id: string;
      campaignName: string;
      zoneId: string;
      campaignType: "AD" | "PROMO" | "NEWS";
      imageAr: string;
      imageFr: string;
      imageEn: string;
      targetUrl: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
    }>
  >;
  onSaveAd: () => void;
  onEditAd: (ad: {
    id: string;
    campaign_name: string;
    zone_id: string | null;
    campaign_type: "AD" | "PROMO" | "NEWS";
    views_count: number;
    image_ar: string | null;
    image_fr: string | null;
    image_en: string | null;
    target_url: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
  }) => void;
  onDeleteAd: (id: string) => void;
  onToggleAdActive: (ad: {
    id: string;
    campaign_name: string;
    zone_id: string | null;
    campaign_type: "AD" | "PROMO" | "NEWS";
    views_count: number;
    image_ar: string | null;
    image_fr: string | null;
    image_en: string | null;
    target_url: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
  }) => void;
  onResetAdForm: () => void;
  isSavingAd: boolean;
  announcementForm: {
    id: string;
    messageEn: string;
    messageFr: string;
    messageAr: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    bgColor: string;
    textColor: string;
  };
  onAnnouncementFormChange: Dispatch<
    SetStateAction<{
      id: string;
      messageEn: string;
      messageFr: string;
      messageAr: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
      bgColor: string;
      textColor: string;
    }>
  >;
  onSaveAnnouncement: () => void;
  onEditAnnouncement: (announcement: {
    id: string;
    message_en: string | null;
    message_fr: string | null;
    message_ar: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
  }) => void;
  onDeleteAnnouncement: (id: string) => void;
  onToggleAnnouncementActive: (announcement: {
    id: string;
    message_en: string | null;
    message_fr: string | null;
    message_ar: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
  }) => void;
  onResetAnnouncementForm: () => void;
  isSavingAnnouncement: boolean;
}) {
  const getScheduleState = (startDate: string | null, endDate: string | null) => {
    const now = Date.now();
    const startMs = startDate ? new Date(startDate).getTime() : Number.NEGATIVE_INFINITY;
    const endMs = endDate ? new Date(endDate).getTime() : Number.POSITIVE_INFINITY;
    if (Number.isFinite(startMs) && now < startMs) return "scheduled" as const;
    if (Number.isFinite(endMs) && now > endMs) return "expired" as const;
    return "active_window" as const;
  };

  const activeCampaigns = ads.filter((ad) => ad.is_active && getScheduleState(ad.start_date, ad.end_date) === "active_window");
  const inactiveCampaigns = ads.filter((ad) => !(ad.is_active && getScheduleState(ad.start_date, ad.end_date) === "active_window"));

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  };

  const zoneLabelById = new Map(adTargetZones.map((zone) => [zone.id, `${zone.communeName} · ${zone.zoneName}`]));

  const getCampaignTypeBadgeClass = (campaignType: "AD" | "PROMO" | "NEWS") => {
    if (campaignType === "NEWS") return "border-transparent bg-primary/15 text-primary";
    if (campaignType === "PROMO") return "border-transparent bg-success/15 text-success";
    return "border-transparent bg-chart-1/15 text-chart-1";
  };

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Ads & Content CMS</h2>
        <p className="text-sm text-muted-foreground">Manage multilingual campaigns and scheduled announcements.</p>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Ad Campaigns</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={adForm.campaignName}
            onChange={(event) => onAdFormChange((current) => ({ ...current, campaignName: event.target.value }))}
            placeholder="Campaign name"
          />
          <Select
            value={adForm.campaignType}
            onValueChange={(value) =>
              onAdFormChange((current) => ({ ...current, campaignType: value as "AD" | "PROMO" | "NEWS" }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Campaign type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AD">Advertisement (إعلان)</SelectItem>
              <SelectItem value="PROMO">Promotion (ترويج)</SelectItem>
              <SelectItem value="NEWS">News (خبر)</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={adForm.zoneId}
            onValueChange={(value) => onAdFormChange((current) => ({ ...current, zoneId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Target zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global / All Zones</SelectItem>
              {adTargetZones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.communeName} · {zone.zoneName} ({zone.zoneCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={adForm.targetUrl}
            onChange={(event) => onAdFormChange((current) => ({ ...current, targetUrl: event.target.value }))}
            placeholder="Target URL"
          />
        </div>

        <Tabs defaultValue="en" className="space-y-3">
          <TabsList>
            <TabsTrigger value="en">EN</TabsTrigger>
            <TabsTrigger value="fr">FR</TabsTrigger>
            <TabsTrigger value="ar">AR</TabsTrigger>
          </TabsList>
          <TabsContent value="en">
            <Input
              value={adForm.imageEn}
              onChange={(event) => onAdFormChange((current) => ({ ...current, imageEn: event.target.value }))}
              placeholder="English image URL"
            />
          </TabsContent>
          <TabsContent value="fr">
            <Input
              value={adForm.imageFr}
              onChange={(event) => onAdFormChange((current) => ({ ...current, imageFr: event.target.value }))}
              placeholder="French image URL"
            />
          </TabsContent>
          <TabsContent value="ar">
            <Input
              value={adForm.imageAr}
              onChange={(event) => onAdFormChange((current) => ({ ...current, imageAr: event.target.value }))}
              placeholder="Arabic image URL"
            />
          </TabsContent>
        </Tabs>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> Start date</span>
            <Input
              type="datetime-local"
              value={adForm.startDate}
              onChange={(event) => onAdFormChange((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> Expiration date</span>
            <Input
              type="datetime-local"
              value={adForm.endDate}
              onChange={(event) => onAdFormChange((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active</span>
            <Switch
              checked={adForm.isActive}
              onCheckedChange={(checked) => onAdFormChange((current) => ({ ...current, isActive: checked }))}
            />
          </div>
          <div className="ml-auto grid grid-cols-2 gap-2">
            <Button variant="hero" className="rounded-md" onClick={onSaveAd} disabled={isSavingAd}>
              {isSavingAd ? "Saving..." : adForm.id ? "Update Campaign" : "Create Campaign"}
            </Button>
            <Button variant="outline" className="rounded-md" onClick={onResetAdForm}>
              Reset
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <h4 className="text-xs font-semibold text-foreground">Active Campaigns</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[190px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeCampaigns.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No active campaigns</TableCell></TableRow>
              ) : (
                activeCampaigns.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell className="font-medium">{ad.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCampaignTypeBadgeClass(ad.campaign_type)}>
                        <Tag className="mr-1 size-3" />
                        {ad.campaign_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {ad.zone_id ? (zoneLabelById.get(ad.zone_id) ?? "Unknown zone") : "Global / All Zones"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="size-3" />
                        {ad.views_count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>{formatDateTime(ad.start_date)} → {formatDateTime(ad.end_date)}</TableCell>
                    <TableCell><Badge variant="secondary">Active</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onEditAd(ad)}><Pencil className="size-3" />Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => onToggleAdActive(ad)}>Pause</Button>
                        <Button size="sm" variant="destructive" onClick={() => onDeleteAd(ad.id)}><Trash2 className="size-3" />Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <h4 className="text-xs font-semibold text-foreground">Scheduled / Expired Campaigns</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[190px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inactiveCampaigns.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No scheduled or expired campaigns</TableCell></TableRow>
              ) : (
                inactiveCampaigns.map((ad) => {
                  const state = getScheduleState(ad.start_date, ad.end_date);
                  const badgeLabel = !ad.is_active ? "Disabled" : state === "scheduled" ? "Scheduled" : "Expired";
                  return (
                    <TableRow key={ad.id}>
                      <TableCell className="font-medium">{ad.campaign_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getCampaignTypeBadgeClass(ad.campaign_type)}>
                          <Tag className="mr-1 size-3" />
                          {ad.campaign_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {ad.zone_id ? (zoneLabelById.get(ad.zone_id) ?? "Unknown zone") : "Global / All Zones"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="size-3" />
                          {ad.views_count ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>{formatDateTime(ad.start_date)} → {formatDateTime(ad.end_date)}</TableCell>
                      <TableCell><Badge variant="outline">{badgeLabel}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => onEditAd(ad)}><Pencil className="size-3" />Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => onToggleAdActive(ad)}>{ad.is_active ? "Pause" : "Activate"}</Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeleteAd(ad.id)}><Trash2 className="size-3" />Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Announcement Manager</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Textarea
            value={announcementForm.messageEn}
            onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, messageEn: event.target.value }))}
            placeholder="EN message"
            className="min-h-24"
          />
          <Textarea
            value={announcementForm.messageFr}
            onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, messageFr: event.target.value }))}
            placeholder="FR message"
            className="min-h-24"
          />
          <Textarea
            value={announcementForm.messageAr}
            onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, messageAr: event.target.value }))}
            placeholder="AR message"
            className="min-h-24"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> Start date</span>
            <Input
              type="datetime-local"
              value={announcementForm.startDate}
              onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> Expiration date</span>
            <Input
              type="datetime-local"
              value={announcementForm.endDate}
              onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
            <span className="text-muted-foreground">Background</span>
            <input
              type="color"
              value={announcementForm.bgColor}
              onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, bgColor: event.target.value }))}
              className="h-8 w-8 rounded border border-border"
            />
            <Input
              value={announcementForm.bgColor}
              onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, bgColor: event.target.value }))}
              className="h-8"
            />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
            <span className="text-muted-foreground">Text</span>
            <input
              type="color"
              value={announcementForm.textColor}
              onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, textColor: event.target.value }))}
              className="h-8 w-8 rounded border border-border"
            />
            <Input
              value={announcementForm.textColor}
              onChange={(event) => onAnnouncementFormChange((current) => ({ ...current, textColor: event.target.value }))}
              className="h-8"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active</span>
            <Switch
              checked={announcementForm.isActive}
              onCheckedChange={(checked) => onAnnouncementFormChange((current) => ({ ...current, isActive: checked }))}
            />
          </div>
          <div className="ml-auto grid grid-cols-2 gap-2">
            <Button variant="hero" className="rounded-md" onClick={onSaveAnnouncement} disabled={isSavingAnnouncement}>
              {isSavingAnnouncement ? "Saving..." : announcementForm.id ? "Update Announcement" : "Add Announcement"}
            </Button>
            <Button variant="outline" className="rounded-md" onClick={onResetAnnouncementForm}>Reset</Button>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <h4 className="text-xs font-semibold text-foreground">Configured Announcements</h4>
          {isLoading ? (
            <AppEmptyState title="Loading announcements..." subtitle="Fetching content entries." className="py-5" />
          ) : announcements.length === 0 ? (
            <AppEmptyState title="No announcements yet" subtitle="Create the first scheduled announcement." className="py-5" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[190px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => {
                  const state = getScheduleState(announcement.start_date, announcement.end_date);
                  const badgeLabel = !announcement.is_active
                    ? "Disabled"
                    : state === "scheduled"
                      ? "Scheduled"
                      : state === "expired"
                        ? "Expired"
                        : "Active";
                  return (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <div
                          className="rounded-md px-2 py-1 text-xs"
                          style={{ backgroundColor: announcement.bg_color, color: announcement.text_color }}
                        >
                          EN: {announcement.message_en ?? "—"}<br />
                          FR: {announcement.message_fr ?? "—"}<br />
                          AR: {announcement.message_ar ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(announcement.start_date)} → {formatDateTime(announcement.end_date)}</TableCell>
                      <TableCell><Badge variant="outline">{badgeLabel}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => onEditAnnouncement(announcement)}><Pencil className="size-3" />Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => onToggleAnnouncementActive(announcement)}>
                            {announcement.is_active ? "Pause" : "Activate"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeleteAnnouncement(announcement.id)}><Trash2 className="size-3" />Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

function OrdersSection({
  orders,
  isLoading,
  error,
  statusFilter,
  onStatusFilterChange,
}: {
  orders: Array<{
    id: string;
    createdAt: string;
    vendorName: string;
    customerPhone: string;
    totalPrice: number;
    status:
      | "new"
      | "preparing"
      | "ready"
      | "delivering"
      | "delivered"
      | "delivered_cash_with_cyclist"
      | "cash_transferred_to_vendor"
      | "cancelled";
  }>;
  isLoading: boolean;
  error: Error | null;
  statusFilter:
    | "all"
    | "new"
    | "preparing"
    | "ready"
    | "delivering"
    | "delivered"
    | "delivered_cash_with_cyclist"
    | "cash_transferred_to_vendor";
  onStatusFilterChange: Dispatch<
    SetStateAction<
      | "all"
      | "new"
      | "preparing"
      | "ready"
      | "delivering"
      | "delivered"
      | "delivered_cash_with_cyclist"
      | "cash_transferred_to_vendor"
    >
  >;
}) {
  const statusBadgeClass: Record<string, string> = {
    new: "bg-chart-4/15 text-chart-4",
    preparing: "bg-highlight/25 text-highlight-foreground",
    ready: "bg-chart-2/20 text-foreground",
    delivering: "bg-primary/15 text-primary",
    delivered: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
  };

  if (error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        Failed to load global orders.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Global Orders Monitoring</h2>
          <p className="text-sm text-muted-foreground">Live marketplace orders with vendor attribution.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(
              event.target.value as
                | "all"
                | "new"
                | "preparing"
                | "ready"
                | "delivering"
                | "delivered"
                | "delivered_cash_with_cyclist"
                | "cash_transferred_to_vendor",
            )
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="delivering">Dispatched</option>
          <option value="delivered">Delivered</option>
          <option value="delivered_cash_with_cyclist">Delivered (Cash with Cyclist)</option>
          <option value="cash_transferred_to_vendor">Cash Transferred to Vendor</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Customer Phone</th>
              <th className="px-4 py-3">Total Price</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <AppEmptyState title="Loading orders..." subtitle="Fetching order history for selected filters." className="border-0 bg-transparent py-2" />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <AppEmptyState
                    title="No orders found for the selected filter."
                    subtitle="Try switching period or order status."
                    className="border-0 bg-transparent py-2"
                  />
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-border bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">#{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{order.vendorName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.customerPhone}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{Math.round(order.totalPrice)} MAD</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass[order.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomersSection({
  customers,
  isLoading,
  error,
}: {
  customers: Array<{
    id: string;
    fullName: string;
    phone: string;
    address: string;
    joinedAt: string;
    totalOrders: number;
    ltvMad: number;
  }>;
  isLoading: boolean;
  error: Error | null;
}) {
  if (error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        Failed to load customers.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Customers CRM</h2>
        <p className="text-sm text-muted-foreground">Registered customer profiles and purchase value.</p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Joined Date</th>
              <th className="px-4 py-3">Total Orders</th>
              <th className="px-4 py-3">LTV</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <AppEmptyState title="Loading customers..." subtitle="Syncing CRM customer profiles." className="border-0 bg-transparent py-2" />
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <AppEmptyState title="No customers yet." subtitle="Customer profiles will appear after first orders." className="border-0 bg-transparent py-2" />
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-t border-border bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">{customer.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.address}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(customer.joinedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-foreground">{customer.totalOrders}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{customer.ltvMad.toFixed(2)} MAD</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsSection({
  form,
  onFormChange,
  siteLogoPreviewUrl,
  onSiteLogoFileChange,
  onSiteLogoPreviewChange,
  onSaveGlobalSettings,
  isGlobalSettingsLoading,
  receiptForm,
  receiptLogoPreviewUrl,
  onReceiptLogoFileChange,
  onReceiptLogoPreviewChange,
  onReceiptFormChange,
  onSaveReceiptSettings,
  isReceiptSettingsLoading,
  markupRules,
  isMarkupRulesLoading,
  onAddMarkupRule,
  onEditMarkupRule,
  onDeleteMarkupRule,
  markupRuleForm,
  onMarkupRuleFormChange,
  isMarkupRuleDialogOpen,
  onMarkupRuleDialogOpenChange,
  onSaveMarkupRule,
  isSavingMarkupRule,
  editingMarkupRuleId,
  onOpenFactoryResetDialog,
}: {
  form: {
    id: string;
    deliveryFeeMad: string;
    minimumOrderMad: string;
    freeDeliveryThresholdMad: string;
    marketplaceActive: boolean;
    siteName: string;
    siteLogoUrl: string;
  };
  onFormChange: Dispatch<
    SetStateAction<{
      id: string;
      deliveryFeeMad: string;
      minimumOrderMad: string;
      freeDeliveryThresholdMad: string;
      marketplaceActive: boolean;
      siteName: string;
      siteLogoUrl: string;
    }>
  >;
  siteLogoPreviewUrl: string | null;
  onSiteLogoFileChange: (file: File | null) => void;
  onSiteLogoPreviewChange: (url: string | null) => void;
  onSaveGlobalSettings: () => Promise<void>;
  isGlobalSettingsLoading: boolean;
  receiptForm: {
    id: string;
    receiptLogoUrl: string;
    receiptStoreName: string;
    receiptSlogan: string;
    receiptPhone: string;
    receiptAddress: string;
    receiptWebsite: string;
    taxId: string;
    receiptFooterMessage: string;
    receiptSocialSupport: string;
  };
  receiptLogoPreviewUrl: string | null;
  onReceiptLogoFileChange: (file: File | null) => void;
  onReceiptLogoPreviewChange: (url: string | null) => void;
  onReceiptFormChange: Dispatch<
    SetStateAction<{
      id: string;
      receiptLogoUrl: string;
      receiptStoreName: string;
      receiptSlogan: string;
      receiptPhone: string;
      receiptAddress: string;
      receiptWebsite: string;
      taxId: string;
      receiptFooterMessage: string;
      receiptSocialSupport: string;
    }>
  >;
  onSaveReceiptSettings: () => Promise<void>;
  isReceiptSettingsLoading: boolean;
  markupRules: MarkupRuleAdminRow[];
  isMarkupRulesLoading: boolean;
  onAddMarkupRule: () => void;
  onEditMarkupRule: (rule: MarkupRuleAdminRow) => void;
  onDeleteMarkupRule: (id: string) => Promise<void>;
  markupRuleForm: {
    minPrice: string;
    maxPrice: string;
    markupType: "fixed" | "percentage";
    markupValue: string;
    isActive: boolean;
  };
  onMarkupRuleFormChange: Dispatch<
    SetStateAction<{
      minPrice: string;
      maxPrice: string;
      markupType: "fixed" | "percentage";
      markupValue: string;
      isActive: boolean;
    }>
  >;
  isMarkupRuleDialogOpen: boolean;
  onMarkupRuleDialogOpenChange: (open: boolean) => void;
  onSaveMarkupRule: () => Promise<void>;
  isSavingMarkupRule: boolean;
  editingMarkupRuleId: string | null;
  onOpenFactoryResetDialog: () => void;
}) {
  const { i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language || "en") === "ar";

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm md:p-5" dir={isArabic ? "rtl" : "ltr"}>
        <div>
          <h2 className="text-base font-semibold text-foreground">General Settings · إعدادات عامة</h2>
          <p className="text-sm text-muted-foreground">Update storefront brand identity and global defaults.</p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="site-name" className="text-sm font-medium text-foreground">
              Site Name (اسم الموقع)
            </label>
            <Input
              id="site-name"
              value={form.siteName}
              onChange={(event) => onFormChange((current) => ({ ...current, siteName: event.target.value }))}
              className="h-11 rounded-lg"
              placeholder="Bzaf Fresh"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-foreground">Site Logo (شعار الموقع)</label>
            <div className="flex items-center gap-4 rounded-lg border border-border bg-background p-3">
              {siteLogoPreviewUrl ? (
                <img
                  src={siteLogoPreviewUrl}
                  alt="Site logo preview"
                  className="h-12 w-auto max-w-[140px] rounded-md border border-border bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-12 w-28 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                  No logo
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="site-logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    onSiteLogoFileChange(file);
                    if (!file) {
                      onSiteLogoPreviewChange(form.siteLogoUrl || null);
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = () =>
                      onSiteLogoPreviewChange(typeof reader.result === "string" ? reader.result : null);
                    reader.onerror = () => toast.error("Unable to preview selected logo.");
                    reader.readAsDataURL(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => document.getElementById("site-logo-upload")?.click()}
                >
                  Upload Logo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="delivery-fee" className="text-sm font-medium text-foreground">
            Global Delivery Fee (MAD)
          </label>
          <input
            id="delivery-fee"
            type="number"
            min={0}
            value={form.deliveryFeeMad}
            onChange={(event) => onFormChange((current) => ({ ...current, deliveryFeeMad: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="minimum-order" className="text-sm font-medium text-foreground">
            Minimum Order Amount (MAD)
          </label>
          <input
            id="minimum-order"
            type="number"
            min={0}
            value={form.minimumOrderMad}
            onChange={(event) => onFormChange((current) => ({ ...current, minimumOrderMad: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="free-delivery-threshold" className="text-sm font-medium text-foreground">
            Free Delivery Threshold (MAD) · عتبة التوصيل المجاني
          </label>
          <input
            id="free-delivery-threshold"
            type="number"
            min={0}
            value={form.freeDeliveryThresholdMad}
            onChange={(event) => onFormChange((current) => ({ ...current, freeDeliveryThresholdMad: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Marketplace Status</p>
            <p className="text-xs text-muted-foreground">
              {form.marketplaceActive ? "Active" : "Maintenance Mode"}
            </p>
          </div>
          <Switch
            checked={form.marketplaceActive}
            onCheckedChange={(checked) => onFormChange((current) => ({ ...current, marketplaceActive: checked }))}
          />
        </div>
      </div>

      <Button
        variant="hero"
        className="rounded-md"
        onClick={() => {
          void onSaveGlobalSettings();
        }}
        disabled={isGlobalSettingsLoading || !form.id}
      >
        {isGlobalSettingsLoading ? "Saving Global Settings..." : "Save Changes (حفظ التغييرات)"}
      </Button>

      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
        <h3 className="text-sm font-semibold text-destructive">Orders Reset (مسح الطلبات فقط)</h3>
        <p className="mt-1 text-xs text-destructive/90">
          سيمسح هذا الإجراء كل بيانات Orders فقط (بما فيها Order ID) مع تصفير أرباح ومستحقات التجار، ولا يمكن التراجع عنه.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-3 rounded-md"
          onClick={onOpenFactoryResetDialog}
        >
          Reset All Data
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 md:p-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Pricing Rules (إعدادات التسعير)</h3>
            <p className="text-sm text-muted-foreground">Manage dynamic markup tiers by price range.</p>
          </div>
          <Button type="button" className="rounded-md bg-success text-success-foreground hover:bg-success/90" onClick={onAddMarkupRule}>
            <Plus className="size-4" />
            Add New Rule
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Price Range (من - إلى)</th>
                <th className="px-4 py-3">Markup Type</th>
                <th className="px-4 py-3">Value (القيمة)</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isMarkupRulesLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading pricing rules...</td>
                </tr>
              ) : markupRules.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No pricing rules configured.</td>
                </tr>
              ) : (
                markupRules.map((rule) => (
                  <tr key={rule.id} className="border-t border-border bg-card">
                    <td className="px-4 py-3 font-medium text-foreground">{rule.minPrice} - {rule.maxPrice} MAD</td>
                    <td className="px-4 py-3 text-foreground">{rule.markupType === "fixed" ? "درهم ثابت" : "نسبة مئوية"}</td>
                    <td className="px-4 py-3 text-foreground">{rule.markupType === "fixed" ? `${rule.markupValue} MAD` : `${rule.markupValue}%`}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => onEditMarkupRule(rule)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-md"
                          onClick={() => {
                            if (window.confirm("Delete this pricing rule?")) {
                              void onDeleteMarkupRule(rule.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isMarkupRuleDialogOpen} onOpenChange={onMarkupRuleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMarkupRuleId ? "Edit Pricing Rule" : "Add New Pricing Rule"}</DialogTitle>
            <DialogDescription>Set min/max range and markup strategy.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" min={0} step="0.01" placeholder="Min price" value={markupRuleForm.minPrice} onChange={(event) => onMarkupRuleFormChange((current) => ({ ...current, minPrice: event.target.value }))} />
              <Input type="number" min={0} step="0.01" placeholder="Max price" value={markupRuleForm.maxPrice} onChange={(event) => onMarkupRuleFormChange((current) => ({ ...current, maxPrice: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={markupRuleForm.markupType} onValueChange={(value: "fixed" | "percentage") => onMarkupRuleFormChange((current) => ({ ...current, markupType: value }))}>
                <SelectTrigger><SelectValue placeholder="Markup type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">درهم ثابت</SelectItem>
                  <SelectItem value="percentage">نسبة مئوية</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min={0} step="0.01" placeholder={markupRuleForm.markupType === "fixed" ? "Amount" : "Percent"} value={markupRuleForm.markupValue} onChange={(event) => onMarkupRuleFormChange((current) => ({ ...current, markupValue: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
              <span className="text-sm font-medium text-foreground">Active Rule</span>
              <Switch checked={markupRuleForm.isActive} onCheckedChange={(checked) => onMarkupRuleFormChange((current) => ({ ...current, isActive: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onMarkupRuleDialogOpenChange(false)}>Cancel</Button>
            <Button type="button" className="bg-success text-success-foreground hover:bg-success/90" disabled={isSavingMarkupRule} onClick={() => void onSaveMarkupRule()}>
              {isSavingMarkupRule ? "Saving..." : editingMarkupRuleId ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-2 h-px w-full bg-border" />

      <div>
        <h3 className="text-base font-semibold text-foreground">Receipt Settings</h3>
        <p className="text-sm text-muted-foreground">Configure logo, branding and footer details for thermal receipts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-foreground">Receipt Logo</label>
          <div className="flex items-center gap-4 rounded-md border border-border bg-background p-3">
            {receiptLogoPreviewUrl ? (
              <img src={receiptLogoPreviewUrl} alt="Receipt logo preview" className="h-14 w-14 rounded-sm border border-border object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-dashed border-border text-xs text-muted-foreground">No logo</div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="receipt-logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  onReceiptLogoFileChange(file);
                  if (!file) {
                    onReceiptLogoPreviewChange(receiptForm.receiptLogoUrl || null);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => onReceiptLogoPreviewChange(typeof reader.result === "string" ? reader.result : null);
                  reader.onerror = () => toast.error("Unable to preview selected logo.");
                  reader.readAsDataURL(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-md"
                onClick={() => document.getElementById("receipt-logo-upload")?.click()}
              >
                Upload logo
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="receipt-store-name" className="text-sm font-medium text-foreground">
            Store Name
          </label>
          <Input
            id="receipt-store-name"
            value={receiptForm.receiptStoreName}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, receiptStoreName: event.target.value }))}
            className="h-10 rounded-md"
            placeholder={DEFAULT_RECEIPT_STORE_NAME}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="receipt-slogan" className="text-sm font-medium text-foreground">
            Slogan
          </label>
          <Input
            id="receipt-slogan"
            value={receiptForm.receiptSlogan}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, receiptSlogan: event.target.value }))}
            className="h-10 rounded-md"
            placeholder={DEFAULT_RECEIPT_SLOGAN}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="receipt-phone" className="text-sm font-medium text-foreground">
            Phone
          </label>
          <Input
            id="receipt-phone"
            value={receiptForm.receiptPhone}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, receiptPhone: event.target.value }))}
            className="h-10 rounded-md"
            placeholder={DEFAULT_RECEIPT_PHONE}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="receipt-address" className="text-sm font-medium text-foreground">
            Address
          </label>
          <Input
            id="receipt-address"
            value={receiptForm.receiptAddress}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, receiptAddress: event.target.value }))}
            className="h-10 rounded-md"
            placeholder={DEFAULT_RECEIPT_ADDRESS}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="receipt-website" className="text-sm font-medium text-foreground">
            Website
          </label>
          <Input
            id="receipt-website"
            value={receiptForm.receiptWebsite}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, receiptWebsite: event.target.value }))}
            className="h-10 rounded-md"
            placeholder={DEFAULT_RECEIPT_WEBSITE}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="receipt-tax-id" className="text-sm font-medium text-foreground">
            Tax / ICE ID (Optional)
          </label>
          <Input
            id="receipt-tax-id"
            value={receiptForm.taxId}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, taxId: event.target.value }))}
            className="h-10 rounded-md"
            placeholder="ICE123456789"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="receipt-footer" className="text-sm font-medium text-foreground">
            Footer Message
          </label>
          <Input
            id="receipt-footer"
            value={receiptForm.receiptFooterMessage}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, receiptFooterMessage: event.target.value }))}
            className="h-10 rounded-md"
            placeholder={DEFAULT_RECEIPT_FOOTER_MESSAGE}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="receipt-social-support" className="text-sm font-medium text-foreground">
            Social & Support
          </label>
          <Input
            id="receipt-social-support"
            value={receiptForm.receiptSocialSupport}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, receiptSocialSupport: event.target.value }))}
            className="h-10 rounded-md"
            placeholder={DEFAULT_RECEIPT_SOCIAL_SUPPORT}
          />
        </div>
      </div>

      <Button
        variant="hero"
        className="rounded-md"
        onClick={() => {
          void onSaveReceiptSettings();
        }}
        disabled={isReceiptSettingsLoading || !receiptForm.id}
      >
        {isReceiptSettingsLoading ? "Saving Receipt Settings..." : "Save Receipt Settings"}
      </Button>
    </section>
  );
}