"use client";

import React, { useState, useRef, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  User,
  Receipt,
  Search,
  ChevronDown,
  X,
  PackagePlus,
  ShoppingBag,
  Trash2,
  Plus,
  TrendingUp,
  Trophy,
  IndianRupee,
  BarChart2,
  Package,
  List,
  Globe,
  Zap,
  Menu,
  Printer,
  History,
  ChevronLeft,
  ChevronRight,
  Percent,
  Calendar,
  Download,
  LogOut,
  Eye,
  EyeOff,
  ShieldCheck,
  Shield,
  Lock,
  Pencil,
  Boxes,
  Smartphone,
  Check,
  Wallet,
  TrendingDown,
  Coins,
  Tag,
  Banknote,
  PiggyBank,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Clock,
  MessageSquare,
  Settings2,
  Scissors,
  SlidersHorizontal,
  Undo2,
  Target,
  CheckCircle2,
  Minus,
  UserCheck,
  Gift,
} from "lucide-react";
import {
  verifyPasscode,
  fetchProducts,
  fetchOrders,
  fetchOrderById,
  submitOrder,
  removeOrder,
  createProduct,
  editProduct,
  removeProduct,
  fetchExpenses,
  createExpense,
  editExpense,
  removeExpense,
  fetchCategories,
  createCategory,
  renameCategory,
  removeCategory,
  fetchAdvanceOrders,
  createAdvanceOrder,
  cancelAdvanceOrder,
  removeAdvanceOrder,
  finalizeAdvanceOrder,
  setAdvanceOrderStatus,
  fetchShopSettings,
} from "@/app/pos/actions";
import { Product, Expense, Category, AdvanceOrderWithRelations, AdvanceOrderStatus, ShopSettings, ItemType, effectivePrice } from "@/lib/types";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/shopProfile";
import SettingsPanel from "./SettingsPanel";
import AttendancePanel from "./AttendancePanel";
import BirthdayPanel from "./BirthdayPanel";
import StaffPunch from "./StaffPunch";
import LowStockAlarm, { type LowStockItem } from "./LowStockAlarm";
import { advanceCharges } from "@/lib/advanceCharges";

// Preset expense categories (users can also type a custom one)
const EXPENSE_CATEGORIES = [
  "Stock Purchase",
  "Rent",
  "Salaries",
  "Utilities",
  "Electricity",
  "Transport",
  "Marketing",
  "Repairs & Maintenance",
  "Taxes & Fees",
  "Miscellaneous",
] as const;

const EXPENSE_PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK", "OTHER"] as const;

// Payment options available at the point of sale.
// ORDER_PAYMENT_MODES is used for single-mode contexts (advance deposit / balance).
// POS_PAYMENT_MODES adds Split for full sales at the billing counter.
const ORDER_PAYMENT_MODES = ["CASH", "GPAY"] as const;
const POS_PAYMENT_MODES = ["CASH", "GPAY", "SPLIT"] as const;
type OrderPaymentMode = "CASH" | "GPAY" | "SPLIT";

// Shared date-window test reused by the Expenses tab and the analytics dashboard.
type PeriodKey = "all" | "today" | "week" | "month" | "year" | "custom";
type DateRange = { start: string | null; end: string | null; valid: boolean };

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const normalizeDateKey = (value: string): string | null => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return localDateKey(parsed) === value ? value : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : localDateKey(parsed);
};

const shiftDateKey = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const getDateRange = (
  period: PeriodKey,
  startStr: string,
  endStr: string,
  now = new Date(),
): DateRange => {
  if (period === "all") return { start: null, end: null, valid: true };
  if (period === "custom") {
    const start = startStr ? normalizeDateKey(startStr) : null;
    const end = endStr ? normalizeDateKey(endStr) : null;
    return {
      start,
      end,
      valid:
        (!startStr || start !== null) &&
        (!endStr || end !== null) &&
        (!start || !end || start <= end),
    };
  }

  const today = localDateKey(now);
  if (period === "today") return { start: today, end: today, valid: true };
  if (period === "week") {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const start = shiftDateKey(today, mondayOffset);
    return { start, end: shiftDateKey(start, 6), valid: true };
  }
  if (period === "month") {
    const start = `${today.slice(0, 7)}-01`;
    const nextMonth = shiftDateKey(start, 32).slice(0, 7);
    return { start, end: shiftDateKey(`${nextMonth}-01`, -1), valid: true };
  }
  return {
    start: `${now.getFullYear()}-01-01`,
    end: `${now.getFullYear()}-12-31`,
    valid: true,
  };
};

const getAvailableDateRange = (values: string[]): DateRange => {
  const dateKeys = values
    .map(normalizeDateKey)
    .filter((dateKey): dateKey is string => dateKey !== null)
    .sort();
  return {
    start: dateKeys[0] ?? getLocalDate(),
    end: dateKeys[dateKeys.length - 1] ?? getLocalDate(),
    valid: true,
  };
};

const getSelectedDateRange = (
  period: Exclude<PeriodKey, "custom">,
  values: string[],
): DateRange => {
  const range = getDateRange(period, "", "");
  return period === "all" ? getAvailableDateRange(values) : range;
};

const formatDateKey = (dateKey: string): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const formatDateValue = (value: string): string => {
  const dateKey = normalizeDateKey(value);
  return dateKey ? formatDateKey(dateKey) : "—";
};

const getDateRangeLabel = (
  period: PeriodKey,
  startStr: string,
  endStr: string,
): string => {
  const range = getDateRange(period, startStr, endStr);
  if (!range.valid) return "Choose a valid date range";
  if (period === "all") return "Showing all dates";
  return `Showing ${range.start ? formatDateKey(range.start) : "any date"} – ${range.end ? formatDateKey(range.end) : "any date"}`;
};

const isDateInPeriod = (
  dateStr: string,
  period: PeriodKey,
  startStr: string,
  endStr: string,
): boolean => {
  const dateKey = normalizeDateKey(dateStr);
  if (!dateKey) return false;
  const range = getDateRange(period, startStr, endStr);
  if (!range.valid) return false;
  return (!range.start || dateKey >= range.start) && (!range.end || dateKey <= range.end);
};

type CatalogItem = {
  id: string;
  name: string;
  desc?: string;
  category?: string;
  price?: number;
  gstRate?: number;
  hsnCode?: string;
  productId?: string;
  itemType?: ItemType;
  costPrice?: number;
  stock?: number | null;
  lowStockAlert?: number | null;
  offerPct?: number;
  offerPrice?: number | null;
  isActive?: boolean;
};

type OrderItem = {
  id: string;
  name: string;
  desc: string;
  price: number;
  qty: number;
  product_id?: string | null;
  offerPct?: number; // automatic catalogue offer applied to this line
  originalPrice?: number; // catalogue price before the offer
};

type CompletedOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  source: "ONLINE" | "OFFLINE";
  isGst: boolean;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  discountType?: "PERCENT" | "FIXED";
  discountValue?: number;
  gstPercentage?: number;
  gstAmount?: number;
  deliveryFee: number;
  grandTotal: number;
  cashReceived: number;
  splitCash?: number;
  splitGpay?: number;
  paymentMode: OrderPaymentMode;
  date: string;
  createdAt: string;
  status: "Completed" | "Pending";
};

type PosTab =
  | "billing"
  | "orders"
  | "analytics"
  | "inventory"
  | "expenses"
  | "advance"
  | "attendance"
  | "settings"
  | "birthdays"
  | "coupons";

type PrintPrefs = {
  paper: "thermal" | "a4";
  size: "58" | "80" | "a4" | "a5";
};

const DEFAULT_PRINT_PREFS: PrintPrefs = { paper: "thermal", size: "80" };

const POS_TABS: PosTab[] = [
  "billing",
  "orders",
  "analytics",
  "inventory",
  "expenses",
  "advance",
  "attendance",
  "settings",
  "birthdays",
  "coupons",
];

type AuthorizationSnapshot = "false" | "true:staff" | "true:admin";

function subscribeAuthorization(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("pos-authorization-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("pos-authorization-change", onChange);
  };
}

function getAuthorizationSnapshot(): AuthorizationSnapshot {
  try {
    const authorized =
      sessionStorage.getItem("pos_authorized") === "true" ||
      localStorage.getItem("pos_authorized") === "true";
    if (!authorized) return "false";
    const storedRole =
      sessionStorage.getItem("pos_role") || localStorage.getItem("pos_role");
    return storedRole === "staff" ? "true:staff" : "true:admin";
  } catch {
    return "false";
  }
}

function subscribeActiveTab(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("pos-tab-change", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("pos-tab-change", onChange);
  };
}

function getActiveTabSnapshot(): PosTab {
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  return POS_TABS.find((tab) => tab === requestedTab) ?? "billing";
}

function updateActiveTab(tab: PosTab) {
  const url = new URL(window.location.href);
  if (tab === "billing") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }
  window.history.replaceState(null, "", url.toString());
  window.dispatchEvent(new Event("pos-tab-change"));
}

function getLocalDate(): string {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function readPrintPrefs(): PrintPrefs {
  try {
    const raw = localStorage.getItem("shalistone_print_prefs");
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "paper" in parsed &&
        "size" in parsed &&
        (parsed.paper === "thermal" || parsed.paper === "a4") &&
        (parsed.size === "58" || parsed.size === "80" || parsed.size === "a4" || parsed.size === "a5")
      ) {
        return { paper: parsed.paper, size: parsed.size };
      }
    }
  } catch (err) {
    console.warn("Could not read saved print preferences:", err);
  }
  return DEFAULT_PRINT_PREFS;
}

// Format: DEP-YYYYMMDD-NNNN. Sequential-looking, unique enough for one shop.
const generateAdvanceOrderId = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DEP-${ymd}-${rand}`;
};

export default function POSBilling() {
  const authorization = useSyncExternalStore(
    subscribeAuthorization,
    getAuthorizationSnapshot,
    () => "false",
  );
  const isAuthorized = authorization !== "false";
  const role = authorization === "true:staff" ? "staff" : isAuthorized ? "admin" : null;
  const [passcode, setPasscode] = useState<string>("");
  const [passcodeError, setPasscodeError] = useState<string>("");
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(false);

  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const urlTab = useSyncExternalStore(subscribeActiveTab, getActiveTabSnapshot, () => "billing");
  const activeTab = urlTab;
  const setActiveTab = updateActiveTab;
  const [showLowStockAlarm, setShowLowStockAlarm] = useState(false);
  // Shop profile (name, contact details, logo) — editable from the Settings tab.
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  // The defaults point at the bundled /logo.svg, so logos stay hidden until the
  // real settings arrive — otherwise the old logo flashes before the uploaded one.
  const [shopSettingsLoaded, setShopSettingsLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customOrderDate, setCustomOrderDate] = useState(getLocalDate);
  const [items, setItems] = useState<OrderItem[]>([
    { id: "1", name: "", desc: "", price: 0, qty: 1 },
  ]);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);

  // Advance orders (partial-payment holds) — separate from real revenue.
  const [advanceOrders, setAdvanceOrders] = useState<AdvanceOrderWithRelations[]>([]);
  const [showAdvanceSaveModal, setShowAdvanceSaveModal] = useState(false);
  const [advDeposit, setAdvDeposit] = useState<number | "">("");
  const [advDeliveryDate, setAdvDeliveryDate] = useState<string>("");
  const [advNotes, setAdvNotes] = useState<string>("");
  const [advDepositPaymentMode, setAdvDepositPaymentMode] = useState<OrderPaymentMode>("CASH");
  const [isSavingAdvance, setIsSavingAdvance] = useState(false);

  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceOrderWithRelations | null>(null);
  const [advanceViewMode, setAdvanceViewMode] = useState<"view" | "receive" | null>(null);
  const [receiveDiscountType, setReceiveDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [receiveDiscountValue, setReceiveDiscountValue] = useState<number | "">("");
  const [receivePaymentMode, setReceivePaymentMode] = useState<OrderPaymentMode>("CASH");
  const [receiveIsGst, setReceiveIsGst] = useState(false);
  const [receiveGstPct, setReceiveGstPct] = useState<number>(18);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [advSearchQuery, setAdvSearchQuery] = useState("");
  const [advStatusFilter, setAdvStatusFilter] = useState<"ALL" | AdvanceOrderStatus>("ALL");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    "fixed",
  );
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<OrderPaymentMode>("CASH");
  // Split payment: cash + gpay portions (only used when paymentMode === "SPLIT")
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitGpay, setSplitGpay] = useState<number>(0);
  const [applyGST, setApplyGST] = useState<boolean>(false);
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  // Advance-order bill shown in the same preview modal as invoices.
  const [activeAdvanceBillId, setActiveAdvanceBillId] = useState<string | null>(null);
  const [completedBillData, setCompletedBillData] =
    useState<CompletedOrder | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [printModalData, setPrintModalData] = useState<{ id: string, type: "invoice" | "advance" } | null>(null);
  const [printPrefs, setPrintPrefs] = useState<PrintPrefs>(DEFAULT_PRINT_PREFS);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modal States


  // Analytics filter/navigation states
  const [analyticsPeriod, setAnalyticsPeriod] = useState<
    "all" | "today" | "week" | "month" | "year" | "custom"
  >("all");
  const [analyticsStartDate, setAnalyticsStartDate] = useState(getLocalDate);
  const [analyticsEndDate, setAnalyticsEndDate] = useState(getLocalDate);
  const analyticsDateRange = getDateRange(analyticsPeriod, analyticsStartDate, analyticsEndDate);
  const analyticsDateRangeLabel = getDateRangeLabel(analyticsPeriod, analyticsStartDate, analyticsEndDate);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<
    "revenue" | "today" | "products" | "coupons"
  >("revenue");
  // Which revenue dashboard is shown: all bills, GST invoices only, or non-GST bills only
  const [analyticsGstFilter, setAnalyticsGstFilter] = useState<
    "all" | "gst" | "nongst"
  >("all");
  const [analyticsSearchPhone, setAnalyticsSearchPhone] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [couponSearchQuery, setCouponSearchQuery] = useState("");

  // Expense tracker state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expCustomCategory, setExpCustomCategory] = useState("");
  const [expAmount, setExpAmount] = useState<number | "">("");
  const [expPaymentMode, setExpPaymentMode] = useState<string>("CASH");
  const [expNotes, setExpNotes] = useState("");
  const [expDate, setExpDate] = useState(getLocalDate);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  // Set while the Add Expense form is editing an existing entry.
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expensePeriod, setExpensePeriod] = useState<
    "all" | "today" | "week" | "month" | "year" | "custom"
  >("month");
  const [expenseStartDate, setExpenseStartDate] = useState(getLocalDate);
  const [expenseEndDate, setExpenseEndDate] = useState(getLocalDate);
  const expenseDateRange = getDateRange(expensePeriod, expenseStartDate, expenseEndDate);
  const expenseDateRangeLabel = getDateRangeLabel(expensePeriod, expenseStartDate, expenseEndDate);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("ALL");
  const [expenseSearch, setExpenseSearch] = useState("");

  // Sorting states
  const [expenseSortField, setExpenseSortField] = useState<
    "date" | "title" | "category" | "payment_mode" | "amount"
  >("date");
  const [expenseSortOrder, setExpenseSortOrder] = useState<"asc" | "desc">("desc");

  const [inventorySortField, setInventorySortField] = useState<
    "name" | "price" | "gst"
  >("name");
  const [inventorySortOrder, setInventorySortOrder] = useState<"asc" | "desc">("asc");

  const [orderSortField, setOrderSortField] = useState<
    "date" | "id" | "name" | "total" | "status"
  >("date");
  const [orderSortOrder, setOrderSortOrder] = useState<"asc" | "desc">("desc");

  // Main scroll container ref for resetting scroll to top
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const openPrintModal = (data: { id: string; type: "invoice" | "advance" }) => {
    setPrintPrefs(readPrintPrefs());
    setPrintModalData(data);
  };

  // Whenever activeTab, analyticsSubTab, or analyticsGstFilter changes, reset scroll to top
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab, analyticsSubTab, analyticsGstFilter]);

  const handleVerifyPasscode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const result = await verifyPasscode(passcode);
    if (result && result.success) {
      sessionStorage.setItem("pos_authorized", "true");
      sessionStorage.setItem("pos_role", result.role || "admin");
      window.dispatchEvent(new Event("pos-authorization-change"));
      if (result.role === "staff") {
        setActiveTab("billing");
      }
      setPasscode("");
      setPasscodeError("");
    } else {
      setPasscodeError("Incorrect passcode. Please try again.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("pos_authorized");
    localStorage.removeItem("pos_authorized");
    sessionStorage.removeItem("pos_role");
    localStorage.removeItem("pos_role");
    window.dispatchEvent(new Event("pos-authorization-change"));
    setPasscode("");
    setPasscodeError("");
  };

  const productToCatalogItem = (p: Product): CatalogItem => {
    return {
      id: p.id,
      productId: p.id,
      name: p.name,
      desc: p.description || undefined,
      category: p.category || undefined,
      // Catalog is a pure price list — one selling price per product.
      price: Number(p.selling_price) || 0,
      gstRate: Number(p.gst_rate) || 0,
      hsnCode: p.hsn_code || undefined,
      itemType: p.item_type || "PRODUCT",
      costPrice: Number(p.cost_price) || 0,
      stock: p.current_stock === null || p.current_stock === undefined ? null : Number(p.current_stock),
      lowStockAlert:
        p.low_stock_alert === null || p.low_stock_alert === undefined
          ? null
          : Number(p.low_stock_alert),
      offerPct: Number(p.offer_discount_pct) || 0,
      offerPrice:
        p.offer_price === null || p.offer_price === undefined ? null : Number(p.offer_price),
      isActive: p.is_active === undefined ? true : Boolean(p.is_active),
    };
  };

  const fetchData = async () => {
    try {
      const [productsData, ordersData, expensesData, categoriesData, advanceData, shopData] = await Promise.all([
        fetchProducts(),
        fetchOrders(),
        fetchExpenses(),
        fetchCategories(),
        fetchAdvanceOrders(),
        fetchShopSettings(),
      ]);
      setShopSettings(shopData);
      setShopSettingsLoaded(true);
      setAdvanceOrders(
        advanceData.map((a) => ({
          ...a,
          subtotal: Number(a.subtotal) || 0,
          total_amount: Number(a.total_amount) || 0,
          deposit_amount: Number(a.deposit_amount) || 0,
          items: a.items.map((i) => ({
            ...i,
            snapshot_price: Number(i.snapshot_price) || 0,
            quantity: Number(i.quantity) || 0,
          })),
        })),
      );
      setCatalog(productsData.map(productToCatalogItem));
      setCategories(categoriesData);
      setExpenses(
        expensesData.map((e) => ({ ...e, amount: Number(e.amount) || 0 })),
      );

      setOrders(
        ordersData.map((o) => {
          return {
            id: o.id,
            customerName: o.customer_name || "Guest",
            customerPhone: o.customer_phone,
            customerAddress: o.customer_address || null,
            source: o.source,
            isGst: Boolean(o.is_gst),
            items: o.items.map((i) => ({
              id: i.id,
              name: i.snapshot_name,
              desc: i.snapshot_name === "Custom Item" ? "Custom" : "",
              price: Number(i.snapshot_price) || 0,
              qty: Number(i.quantity) || 0,
            })),
            subtotal: Number(o.subtotal) || 0,
            discount: Number(o.discount_amount) || 0,
            discountType: o.discount_type,
            discountValue: o.discount_value
              ? Number(o.discount_value)
              : undefined,
            gstPercentage: Number(o.gst_percentage) || 0,
            gstAmount: Number(o.gst_amount) || 0,
            deliveryFee: Number(o.delivery_fee) || 0,
            grandTotal: Number(o.grand_total) || 0,
            cashReceived: Number(o.cash_received) || 0,
            splitCash: Number((o as { split_cash?: number }).split_cash) || 0,
            splitGpay: Number((o as { split_gpay?: number }).split_gpay) || 0,
            paymentMode: (POS_PAYMENT_MODES as readonly string[]).includes(
              String(o.payment_mode),
            )
              ? (o.payment_mode as OrderPaymentMode)
              : "CASH",
            date: o.bill_date,
            createdAt: o.created_at,
            status: o.status === "COMPLETED" ? "Completed" : "Pending",
          };
        }),
      );
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  };

  useEffect(() => {
    let active = true;
    const initData = async () => {
      fetchShopSettings()
        .then((data) => {
          if (!active) return;
          setShopSettings(data);
          setShopSettingsLoaded(true);
        })
        .catch((err) => {
          console.error("Error loading shop settings:", err);
          if (active) setShopSettingsLoaded(true);
        });
      await fetchData();
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };
    void initData();
    return () => {
      active = false;
    };
  }, []);

  // Modal State
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CompletedOrder | null>(
    null,
  );
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatPrice, setNewCatPrice] = useState<number | "">("");
  const [newCatGst, setNewCatGst] = useState<number | "">(5);
  const [newCatHsn, setNewCatHsn] = useState<string>("");
  const [newCatCategory, setNewCatCategory] = useState<string>("");
  // Product ⇄ Service switch at the top of the catalog form.
  const [newCatType, setNewCatType] = useState<ItemType>("PRODUCT");
  // Stock + costing only apply to physical products.
  const [newCatCost, setNewCatCost] = useState<number | "">("");
  const [newCatStock, setNewCatStock] = useState<number | "">(0);
  const [newCatLowStock, setNewCatLowStock] = useState<number | "">(0);
  // Automatic offer applied on billing.
  const [newCatOfferPct, setNewCatOfferPct] = useState<number | "">("");
  const [newCatOfferPrice, setNewCatOfferPrice] = useState<number | "">("");
  const [newCatActive, setNewCatActive] = useState(true);

  const [isSavingCatalog, setIsSavingCatalog] = useState<boolean>(false); // guards Save Product against double-clicks
  const [inventorySearch, setInventorySearch] = useState<string>("");

  // Category management (create / rename / delete)
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // ── Stock adjustment (restock / return / loss / reconcile) ───────────────
  type StockAdjustType = "RESTOCK" | "RETURN" | "LOSS" | "RECONCILE";
  const [stockAdjustTarget, setStockAdjustTarget] = useState<CatalogItem | null>(null);
  const [stockAdjustType, setStockAdjustType] = useState<StockAdjustType>("RESTOCK");
  const [stockAdjustQty, setStockAdjustQty] = useState<number>(0);
  const [stockAdjustNote, setStockAdjustNote] = useState("");
  const [isSavingStock, setIsSavingStock] = useState(false);

  const openStockAdjust = (item: CatalogItem) => {
    setStockAdjustTarget(item);
    setStockAdjustType("RESTOCK");
    setStockAdjustQty(0);
    setStockAdjustNote("");
  };

  const closeStockAdjust = () => {
    if (isSavingStock) return;
    setStockAdjustTarget(null);
  };

  // Where the count lands after this adjustment.
  const stockAdjustPreview = (() => {
    if (!stockAdjustTarget) return 0;
    const current = stockAdjustTarget.stock ?? 0;
    const qty = Math.max(0, Number(stockAdjustQty) || 0);
    switch (stockAdjustType) {
      case "RESTOCK":
      case "RETURN":
        return current + qty;
      case "LOSS":
        return Math.max(0, current - qty);
      case "RECONCILE":
        return qty;
    }
  })();

  const stockAdjustDelta = stockAdjustPreview - (stockAdjustTarget?.stock ?? 0);

  const saveStockAdjustment = async () => {
    if (!stockAdjustTarget || isSavingStock) return;
    const target = stockAdjustTarget;
    const qty = Math.max(0, Number(stockAdjustQty) || 0);

    if (stockAdjustType !== "RECONCILE" && qty === 0) {
      alert("Enter a quantity greater than 0.");
      return;
    }
    if (stockAdjustType === "LOSS" && qty > (target.stock ?? 0)) {
      const proceed = window.confirm(
        `Only ${target.stock ?? 0} in stock. Deducting ${qty} will set stock to 0. Continue?`,
      );
      if (!proceed) return;
    }

    setIsSavingStock(true);
    try {
      await editProduct(target.id, {
        current_stock: stockAdjustPreview,
        // Reconcile is an exact count, so align the low-stock warning with it too.
        low_stock_alert:
          stockAdjustType === "RECONCILE"
            ? Math.min(target.lowStockAlert ?? 0, stockAdjustPreview)
            : target.lowStockAlert ?? undefined,
      });
      await fetchData();
      setStockAdjustTarget(null);
    } catch (err) {
      console.error("Failed to adjust stock:", err);
      alert("Could not update stock. Please try again.");
    } finally {
      setIsSavingStock(false);
    }
  };

  // Advance-order receipt modal (shown after creating an advance order)
  const [advanceReceipt, setAdvanceReceipt] = useState<{
    id: string;
    customerName: string;
    customerPhone: string;
    total: number;
    deposit: number;
    balance: number;
  } | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );

  const [activeCatalogRowId, setActiveCatalogRowId] = useState<string | null>(
    null,
  );
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogTargetRowId, setCatalogTargetRowId] = useState<string | null>(
    null,
  );

  // Order search/filters state
  const [orderSearchId, setOrderSearchId] = useState("");
  const [orderSearchName, setOrderSearchName] = useState("");
  const [orderSearchPhone, setOrderSearchPhone] = useState("");
  const [orderFilterSource, setOrderFilterSource] = useState("ALL");
  const [orderFilterStatus, setOrderFilterStatus] = useState("ALL");
  const [historyPeriod, setHistoryPeriod] = useState<
    "all" | "today" | "week" | "month" | "year" | "custom"
  >("all");
  const [historyStartDate, setHistoryStartDate] = useState<string>(getLocalDate);
  const [historyEndDate, setHistoryEndDate] = useState<string>(getLocalDate);
  const historyDateRange = getDateRange(historyPeriod, historyStartDate, historyEndDate);
  const historyDateRangeLabel = getDateRangeLabel(historyPeriod, historyStartDate, historyEndDate);

  const [advPeriod, setAdvPeriod] = useState<
    "all" | "today" | "week" | "month" | "year" | "custom"
  >("all");
  const [advStartDate, setAdvStartDate] = useState<string>(getLocalDate);
  const [advEndDate, setAdvEndDate] = useState<string>(getLocalDate);
  const advDateRange = getDateRange(advPeriod, advStartDate, advEndDate);
  const advDateRangeLabel = getDateRangeLabel(advPeriod, advStartDate, advEndDate);

  const [selectedCoupon, setSelectedCoupon] = useState<string>("none");
  const coupons = [
    { code: "none", label: "No Coupon", type: "fixed", value: 0 },
    {
      code: "WELCOME10",
      label: "WELCOME10 (10% Off)",
      type: "percent",
      value: 10,
    },
    {
      code: "SUPERPOS",
      label: "SUPERPOS (₹100 Off)",
      type: "fixed",
      value: 100,
    },
    {
      code: "FESTIVE15",
      label: "FESTIVE15 (15% Off)",
      type: "percent",
      value: 15,
    },
  ];

  const handleCouponChange = (code: string) => {
    setSelectedCoupon(code);
    const coupon = coupons.find((c) => c.code === code);
    if (coupon) {
      setDiscountType(coupon.type as "fixed" | "percent");
      setDiscountValue(coupon.value);
    }
  };

  const getCouponCodeForOrder = (order: CompletedOrder) => {
    if (order.discount === 0) return "NONE";
    const matched = coupons.find((c) => {
      if (c.code === "none") return false;
      if (order.discountType && order.discountValue) {
        const typeMatches =
          c.type === (order.discountType === "PERCENT" ? "percent" : "fixed");
        const valMatches = c.value === order.discountValue;
        return typeMatches && valMatches;
      }
      if (c.type === "fixed") {
        return c.value === order.discount;
      } else {
        const calculated = order.subtotal * (c.value / 100);
        return Math.abs(calculated - order.discount) < 2;
      }
    });
    return matched ? matched.code.toUpperCase() : "PROMO";
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: Math.random().toString(), name: "", desc: "", price: 0, qty: 1 },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: OrderItem[keyof OrderItem]) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleQtyChange = (id: string, newQty: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const finalQty = Math.max(1, newQty);
        return { ...item, qty: finalQty };
      }),
    );
  };

  const clearOrder = () => {
    setItems([
      { id: Math.random().toString(), name: "", desc: "", price: 0, qty: 1 },
    ]);
  };

  const resetCatalogForm = () => {
    setNewCatName("");
    setNewCatDesc("");
    setNewCatPrice("");
    setNewCatCost("");
    setNewCatGst(5);
    setNewCatHsn("");
    setNewCatCategory("");
    setNewCatType("PRODUCT");
    setNewCatStock(0);
    setNewCatLowStock(0);
    setNewCatOfferPct("");
    setNewCatOfferPrice("");
    setNewCatActive(true);
  };

  const openEditCatalog = (catItem: CatalogItem, targetRowId?: string) => {
    setEditingCatalogId(catItem.id);
    setNewCatName(catItem.name || "");
    setNewCatDesc(catItem.desc || "");
    setNewCatPrice(catItem.price ?? "");
    setNewCatGst(typeof catItem.gstRate === "number" ? catItem.gstRate : 18);
    setNewCatHsn(catItem.hsnCode || "");
    setNewCatCategory(catItem.category || "");
    setNewCatType(catItem.itemType || "PRODUCT");
    setNewCatCost(catItem.costPrice ?? "");
    setNewCatStock(catItem.stock ?? 0);
    setNewCatLowStock(catItem.lowStockAlert ?? 0);
    setNewCatOfferPct(catItem.offerPct ?? "");
    setNewCatOfferPrice(catItem.offerPrice ?? "");
    setNewCatActive(catItem.isActive === undefined ? true : catItem.isActive);

    setCatalogTargetRowId(targetRowId || null);
    setShowCatalogModal(true);
  };

  // ── Category management (create / rename / delete) ──────────────────
  const refreshCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to refresh categories:", err);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      alert("Please enter a category name.");
      return;
    }
    if (
      categories.some((c) => c.name.toLowerCase() === name.toLowerCase())
    ) {
      alert("That category already exists.");
      return;
    }
    setIsSavingCategory(true);
    try {
      await createCategory(name);
      setNewCategoryName("");
      await refreshCategories();
    } catch (err) {
      console.error("Failed to add category:", err);
      alert("Could not add the category. Please try again.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategoryId) return;
    const name = editCategoryName.trim();
    if (!name) {
      alert("Category name cannot be empty.");
      return;
    }
    setIsSavingCategory(true);
    try {
      await renameCategory(editingCategoryId, name);
      setEditingCategoryId(null);
      setEditCategoryName("");
      // Renaming also updates products, so refresh both lists.
      await Promise.all([
        refreshCategories(),
        fetchProducts().then((data) => setCatalog(data.map(productToCatalogItem))),
      ]);
    } catch (err) {
      console.error("Failed to rename category:", err);
      alert("Could not rename the category. Please try again.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (
      !window.confirm(
        `Delete category "${cat.name}"? Products already using it keep their category name.`,
      )
    )
      return;
    try {
      await removeCategory(cat.id);
      await refreshCategories();
    } catch (err) {
      console.error("Failed to delete category:", err);
      alert("Could not delete the category. Please try again.");
    }
  };

  // Offer price preview: derived from the price + % until the user overrides it.
  const computedOfferPrice = useMemo(() => {
    const pct = Number(newCatOfferPct) || 0;
    const base = Number(newCatPrice) || 0;
    if (pct <= 0) return 0;
    return Math.round((base - (base * pct) / 100) * 100) / 100;
  }, [newCatOfferPct, newCatPrice]);

  const addToCatalog = async () => {
    if (!newCatName.trim()) {
      alert(newCatType === "SERVICE" ? "Service name is required." : "Product name is required.");
      return;
    }

    const priceNum = Number(newCatPrice);
    if (newCatPrice === "" || !Number.isFinite(priceNum) || priceNum <= 0) {
      alert("Enter a price greater than 0.");
      return;
    }
    if (priceNum > 99999999.99) {
      alert(
        "The price exceeds the maximum allowable system limit of ₹99,999,999.99.",
      );
      return;
    }

    // An offer can be entered as a % or as a fixed offer price; the other is
    // derived so the bill can show original price, saving and offer price.
    let offerPct = Number(newCatOfferPct) || 0;
    let offerPrice: number | null = null;
    const typedOfferPrice = newCatOfferPrice === "" ? null : Number(newCatOfferPrice);
    if (offerPct > 0) {
      offerPrice =
        typedOfferPrice ?? Math.round((priceNum - (priceNum * offerPct) / 100) * 100) / 100;
    } else if (typedOfferPrice !== null && typedOfferPrice > 0) {
      offerPrice = typedOfferPrice;
      offerPct = Math.round(((priceNum - typedOfferPrice) / priceNum) * 10000) / 100;
    }
    if (offerPct > 100) {
      alert("The offer discount cannot be more than 100%.");
      return;
    }
    if (offerPrice !== null && (offerPrice <= 0 || offerPrice >= priceNum)) {
      alert("The offer price must be more than ₹0 and less than the original price.");
      return;
    }

    const isService = newCatType === "SERVICE";

    const productPayload = {
      name: newCatName.trim(),
      description: newCatDesc || null,
      category: newCatCategory.trim() || "General",
      gst_rate: Number(newCatGst) || 0,
      hsn_code: newCatHsn.trim() || null,
      selling_price: priceNum,
      item_type: newCatType,
      cost_price: newCatCost === "" ? 0 : Number(newCatCost),
      // Services never carry stock — the store nulls these out server-side.
      current_stock: isService ? null : newCatStock === "" ? 0 : Number(newCatStock),
      low_stock_alert: isService ? null : newCatLowStock === "" ? 0 : Number(newCatLowStock),
      offer_discount_pct: offerPct,
      offer_price: offerPrice,
      is_active: newCatActive,
    };

    // Persist a newly-typed category so it appears in the managed list next time.
    const catName = newCatCategory.trim();
    if (
      catName &&
      !categories.some((c) => c.name.toLowerCase() === catName.toLowerCase())
    ) {
      try {
        const created = await createCategory(catName);
        setCategories((prev) =>
          prev.some((c) => c.id === created.id) ? prev : [...prev, created],
        );
      } catch {
        /* non-fatal: product still saves with the category text */
      }
    }

    if (isSavingCatalog) return; // ignore double-clicks
    setIsSavingCatalog(true);
    try {
    if (editingCatalogId) {
      const data = await editProduct(editingCatalogId, productPayload);
      if (!data) {
        alert(
          "Product not found — it may have been removed. Refresh and try again.",
        );
        return;
      }

      setCatalog((prev) =>
        prev.map((c) =>
          c.id === editingCatalogId ? productToCatalogItem(data) : c,
        ),
      );

      if (catalogTargetRowId) {
        updateItem(catalogTargetRowId, "product_id", data.id);
        updateItem(catalogTargetRowId, "name", data.name);
        updateItem(catalogTargetRowId, "price", effectivePrice(data));
        updateItem(catalogTargetRowId, "offerPct", Number(data.offer_discount_pct) || 0);
        updateItem(
          catalogTargetRowId,
          "originalPrice",
          Number(data.offer_discount_pct) > 0 ? Number(data.selling_price) : undefined,
        );
        setCatalogTargetRowId(null);
      }

      resetCatalogForm();
      setEditingCatalogId(null);
      setShowCatalogModal(false);
    } else {
      const product = await createProduct(productPayload);
      const newItem = productToCatalogItem(product);
      setCatalog([...catalog, newItem]);

      if (catalogTargetRowId) {
        // Link the bill row to the new product so selling it reduces stock.
        updateItem(catalogTargetRowId, "product_id", product.id);
        updateItem(catalogTargetRowId, "name", product.name);
        updateItem(catalogTargetRowId, "price", effectivePrice(product));
        updateItem(
          catalogTargetRowId,
          "offerPct",
          Number(product.offer_discount_pct) || 0,
        );
        updateItem(
          catalogTargetRowId,
          "originalPrice",
          Number(product.offer_discount_pct) > 0 ? Number(product.selling_price) : undefined,
        );
        setCatalogTargetRowId(null);
      }

      resetCatalogForm();
      setShowCatalogModal(false);
    }
    } catch (err) {
      console.error("Failed to save catalogue item:", err);
      alert(
        "Could not save this item to the database. Please check your connection and try again.",
      );
    } finally {
      setIsSavingCatalog(false);
    }
  };

  const deleteFromCatalog = async (id: string) => {
    await removeProduct(id);
    setCatalog((prev) => prev.filter((c) => c.id !== id));
  };

  // Stocked products at or below their alert limit (same rule as the Inventory table).
  const lowStockItems = useMemo<LowStockItem[]>(
    () =>
      catalog
        .filter(
          (c) =>
            c.itemType !== "SERVICE" &&
            c.stock !== null &&
            c.stock !== undefined &&
            c.lowStockAlert !== null &&
            c.lowStockAlert !== undefined &&
            Number(c.stock) <= Number(c.lowStockAlert),
        )
        .map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          stock: Number(c.stock) || 0,
          alertAt: Number(c.lowStockAlert) || 0,
        })),
    [catalog],
  );

  // Product prices are GST-exclusive. GST is charged on the discounted subtotal
  // (the taxable value) and added on top of it in the grand total.
  const subtotal = items.reduce((acc, item) => acc + item.price * item.qty, 0);
  const calculatedDiscount =
    discountType === "percent"
      ? subtotal * (discountValue / 100)
      : discountValue;
  const taxableValue = Math.max(0, subtotal - calculatedDiscount);
  const gstAmount =
    applyGST && gstPercentage > 0 ? taxableValue * (gstPercentage / 100) : 0;
  const grandTotal = taxableValue + gstAmount + deliveryFee;

  // Suggest a GST % from the products currently in the cart (their per-product
  // default rate). Used to pre-fill the changeable GST field when a GST invoice
  // is switched on. Falls back to the current value or 18%.
  const suggestGstRate = (): number => {
    for (const item of items) {
      if (!item.name) continue;
      const catItem = catalog.find(
        (c) =>
          (item.product_id &&
            (c.id === item.product_id || c.productId === item.product_id)) ||
          c.name.trim().toLowerCase() === item.name.trim().toLowerCase(),
      );
      if (catItem && typeof catItem.gstRate === "number" && catItem.gstRate > 0) {
        return catItem.gstRate;
      }
    }
    return gstPercentage || 18;
  };

  // Toggle between a GST invoice and a non-GST bill. When switching a GST
  // invoice on, pre-fill the (still editable) rate from the cart's products.
  const setGstBill = (on: boolean) => {
    setApplyGST(on);
    if (on) {
      setGstPercentage(suggestGstRate());
    }
  };

  // ─────────────────────────────────────────
  // ADVANCE ORDERS — deposit-only holds
  // ─────────────────────────────────────────



  const openAdvanceSaveModal = () => {
    if (!customerPhone || customerPhone.length !== 10) {
      alert("Please enter a valid 10-digit mobile contact number before saving an advance order.");
      return;
    }
    const hasInvalidItem = items.some(
      (i) => !i.name || i.name.trim() === "" || i.price === undefined || i.price <= 0,
    );
    if (hasInvalidItem || items.length === 0) {
      alert("Please ensure all items have a valid name and price greater than 0 before saving an advance order.");
      return;
    }
    setAdvDeposit("");
    setAdvDeliveryDate("");
    setAdvNotes("");
    setAdvDepositPaymentMode(paymentMode);
    setShowAdvanceSaveModal(true);
  };

  const saveAdvanceOrder = async () => {
    if (isSavingAdvance) return;
    const deposit = Number(advDeposit) || 0;
    if (deposit <= 0) {
      alert("Deposit amount must be greater than 0.");
      return;
    }
    if (deposit > grandTotal) {
      alert("Deposit cannot exceed the grand total. Use 'Complete Sale' for full payment.");
      return;
    }

    const advId = generateAdvanceOrderId();
    setIsSavingAdvance(true);
    try {
      await createAdvanceOrder({
        advanceOrderId: advId,
        customerName: customerName || "Guest",
        customerPhone,
        customerAddress: customerAddress || null,
        subtotal,
        totalAmount: grandTotal,
        depositAmount: deposit,
        depositPaymentMode: advDepositPaymentMode,
        deliveryDate: advDeliveryDate || null,
        notes: advNotes.trim() || null,
        // Bill-level charges, so the receipt and the final invoice keep them.
        discountType: discountType === "percent" ? "PERCENT" : "FIXED",
        discountValue: Number(discountValue) || 0,
        discountAmount: calculatedDiscount,
        deliveryFee: Number(deliveryFee) || 0,
        isGst: applyGST,
        gstPercentage: applyGST ? gstPercentage : 0,
        gstAmount,
        items: items.map((i) => ({
          product_id: i.product_id || null,
          snapshot_name: i.name,
          snapshot_desc: i.desc || null,
          snapshot_price: i.price,
          quantity: i.qty,
        })),
      });

      // Capture receipt details before clearing the form.
      const receiptCustomerName = customerName || "Guest";
      const receiptCustomerPhone = customerPhone;

      // Reset billing form.
      setItems([{ id: "1", name: "", desc: "", price: 0, qty: 1 }]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscountValue(0);
      setDeliveryFee(0);
      setApplyGST(false);
      setGstPercentage(18);
      setCashReceived(0);
      setSplitCash(0);
      setSplitGpay(0);
      setShowAdvanceSaveModal(false);
      await fetchData();

      // Show a shareable receipt modal (Print / WhatsApp / New Sale).
      setAdvanceReceipt({
        id: advId,
        customerName: receiptCustomerName,
        customerPhone: receiptCustomerPhone,
        total: grandTotal,
        deposit,
        balance: Math.max(0, grandTotal - deposit),
      });
    } catch (err) {
      console.error("Failed to save advance order:", err);
      alert("Could not save the advance order. Please try again.");
    } finally {
      setIsSavingAdvance(false);
    }
  };

  const openReceiveBalance = (adv: AdvanceOrderWithRelations) => {
    setSelectedAdvance(adv);
    setAdvanceViewMode("receive");
    setReceiveDiscountType("FIXED");
    setReceiveDiscountValue("");
    setReceivePaymentMode("CASH");
    setReceiveIsGst(false);
    setReceiveGstPct(18);
  };

  const openAdvanceView = (adv: AdvanceOrderWithRelations) => {
    setSelectedAdvance(adv);
    setAdvanceViewMode("view");
  };

  const closeAdvanceDialog = () => {
    setSelectedAdvance(null);
    setAdvanceViewMode(null);
  };

  // Global Escape key listener to dismiss any open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeInvoiceId || activeAdvanceBillId) {
          setActiveInvoiceId(null);
          setActiveAdvanceBillId(null);
        } else if (printModalData) {
          setPrintModalData(null);
        } else if (selectedAdvance && advanceViewMode) {
          closeAdvanceDialog();
        } else if (showAdvanceSaveModal) {
          setShowAdvanceSaveModal(false);
        } else if (selectedOrder) {
          setSelectedOrder(null);
        } else if (stockAdjustTarget) {
          closeStockAdjust();
        } else if (showCategoryModal) {
          setShowCategoryModal(false);
          setEditingCategoryId(null);
          setNewCategoryName("");
        } else if (showCatalogModal) {
          resetCatalogForm();
          setEditingCatalogId(null);
          setShowCatalogModal(false);
        } else if (completedBillData) {
          setCompletedBillData(null);
        } else if (advanceReceipt) {
          setAdvanceReceipt(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeInvoiceId,
    activeAdvanceBillId,
    printModalData,
    selectedAdvance,
    advanceViewMode,
    showAdvanceSaveModal,
    selectedOrder,
    stockAdjustTarget,
    showCategoryModal,
    showCatalogModal,
    completedBillData,
    advanceReceipt,
  ]);

  const balanceRemaining = (adv: AdvanceOrderWithRelations) =>
    Math.max(0, Number(adv.total_amount) - Number(adv.deposit_amount));

  const advancePeriodOrders = advanceOrders.filter((adv) =>
    isDateInPeriod(adv.created_at, advPeriod, advStartDate, advEndDate),
  );
  const allAdvanceOrderDateKeys = advanceOrders
    .map((adv) => normalizeDateKey(adv.created_at))
    .filter((dateKey): dateKey is string => dateKey !== null)
    .sort();
  const filteredAdvanceOrders = advancePeriodOrders.filter((adv) => {
    if (advStatusFilter !== "ALL" && adv.status !== advStatusFilter) return false;
    const query = advSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      adv.id.toLowerCase().includes(query) ||
      adv.customer_name.toLowerCase().includes(query) ||
      adv.customer_phone.includes(query) ||
      adv.status.toLowerCase().includes(query) ||
      adv.items.some((item) => item.snapshot_name.toLowerCase().includes(query))
    );
  });

  const receiveBalanceDiscountAmount = (() => {
    if (!selectedAdvance) return 0;
    const base = balanceRemaining(selectedAdvance);
    const val = Number(receiveDiscountValue) || 0;
    return receiveDiscountType === "PERCENT" ? base * (val / 100) : val;
  })();

  const receiveBalanceFinalAmount = (() => {
    if (!selectedAdvance) return 0;
    return Math.max(0, balanceRemaining(selectedAdvance) - receiveBalanceDiscountAmount);
  })();

  const confirmReceiveBalance = async () => {
    if (!selectedAdvance || isFinalizing) return;
    if (receiveBalanceDiscountAmount > balanceRemaining(selectedAdvance)) {
      alert("Discount cannot exceed the remaining balance.");
      return;
    }
    setIsFinalizing(true);
    try {
      const invoiceId = `INV-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      await finalizeAdvanceOrder({
        advanceOrderId: selectedAdvance.id,
        invoiceId,
        isGst: receiveIsGst,
        gstPercentage: receiveIsGst ? receiveGstPct : 0,
        discountType: receiveDiscountType,
        discountValue: Number(receiveDiscountValue) || 0,
        discountAmount: receiveBalanceDiscountAmount,
        deliveryFee: 0,
        paymentMode: receivePaymentMode,
        billDate: new Date().toISOString(),
      });
      closeAdvanceDialog();
      await fetchData();

      // Open the shared completion modal (Print / WhatsApp / New Sale) for the new invoice.
      try {
        const created = await fetchOrderById(invoiceId);
        if (created) {
          setCompletedBillData({
            id: created.id,
            customerName: created.customer_name || "Guest",
            customerPhone: created.customer_phone,
            customerAddress: created.customer_address || null,
            source: created.source,
            isGst: Boolean(created.is_gst),
            items: created.items.map((i, idx) => ({
              id: i.id || `oi-${created.id}-${idx}`,
              name: i.snapshot_name,
              desc: "",
              price: Number(i.snapshot_price) || 0,
              qty: Number(i.quantity) || 0,
            })),
            subtotal: Number(created.subtotal) || 0,
            discount: Number(created.discount_amount) || 0,
            discountType: created.discount_type,
            discountValue: created.discount_value
              ? Number(created.discount_value)
              : undefined,
            gstPercentage: Number(created.gst_percentage) || 0,
            gstAmount: Number(created.gst_amount) || 0,
            deliveryFee: Number(created.delivery_fee) || 0,
            grandTotal: Number(created.grand_total) || 0,
            cashReceived: Number(created.cash_received) || 0,
            splitCash: Number((created as { split_cash?: number }).split_cash) || 0,
            splitGpay: Number((created as { split_gpay?: number }).split_gpay) || 0,
            paymentMode: (POS_PAYMENT_MODES as readonly string[]).includes(
              String(created.payment_mode),
            )
              ? (created.payment_mode as OrderPaymentMode)
              : "CASH",
            date: created.bill_date,
            createdAt: created.created_at,
            status: "Completed",
          });
        }
      } catch (mapErr) {
        console.error("Could not open completion modal:", mapErr);
      }
    } catch (err) {
      console.error("Failed to finalize advance order:", err);
      alert("Could not finalize the advance order. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const doCancelAdvance = async (adv: AdvanceOrderWithRelations) => {
    if (!confirm(`Cancel advance order ${adv.id}? The deposit is treated as forfeit/refunded outside the system.`)) return;
    try {
      await cancelAdvanceOrder(adv.id);
      await fetchData();
    } catch (err) {
      console.error("Cancel failed:", err);
      alert("Could not cancel the advance order.");
    }
  };

  const doDeleteAdvance = async (adv: AdvanceOrderWithRelations) => {
    if (!confirm(`Permanently delete advance order ${adv.id}? This cannot be undone.`)) return;
    try {
      await removeAdvanceOrder(adv.id);
      await fetchData();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete the advance order.");
    }
  };

  const toggleAdvanceReady = async (adv: AdvanceOrderWithRelations) => {
    const next: AdvanceOrderStatus = adv.status === "READY" ? "PENDING" : "READY";
    try {
      await setAdvanceOrderStatus(adv.id, next);
      await fetchData();
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  // Completes and saves the sale to the database. Returns the created order
  // (or null if validation/creation failed). WhatsApp sharing is a separate,
  // Completes and saves the sale to the database with instant optimistic updates.
  const completeSale = async (): Promise<CompletedOrder | null> => {
    if (isSubmittingOrder) return null;

    if (!customerPhone || customerPhone.length !== 10) {
      alert(
        "Please enter a valid 10-digit mobile contact number to complete the sale.",
      );
      return null;
    }

    // Strict validation: every single row must have a name and a price > 0
    const hasInvalidItem = items.some(
      (i) =>
        !i.name ||
        i.name.trim() === "" ||
        i.price === undefined ||
        i.price <= 0,
    );

    if (hasInvalidItem || items.length === 0) {
      alert(
        "Please ensure all items have a valid name and a price greater than 0. Remove any empty rows before proceeding.",
      );
      return null;
    }
    const itemsToSave = items;

    // Recalculate values locally to avoid React state lag issues
    const localSubtotal = itemsToSave.reduce(
      (acc, item) => acc + item.price * item.qty,
      0,
    );
    const localCalculatedDiscount =
      discountType === "percent"
        ? localSubtotal * (discountValue / 100)
        : discountValue;
    // Prices are GST-exclusive: GST is added on top of the discounted subtotal.
    const localTaxableValue = Math.max(0, localSubtotal - localCalculatedDiscount);
    const localGstAmount =
      applyGST && gstPercentage > 0
        ? localTaxableValue * (gstPercentage / 100)
        : 0;
    const localGrandTotal = localTaxableValue + localGstAmount + deliveryFee;

    // Validate totals against PostgreSQL numeric(10,2) overflow limit (99,999,999.99)
    const MAX_LIMIT = 99999999.99;
    if (
      localSubtotal > MAX_LIMIT ||
      localGrandTotal > MAX_LIMIT ||
      cashReceived > MAX_LIMIT ||
      deliveryFee > MAX_LIMIT
    ) {
      alert(
        "The order totals exceed the maximum allowable system limit of ₹99,999,999.99. Please adjust the item prices, delivery fee, or cash received.",
      );
      return null;
    }

    // Validate individual item prices
    const hasTooExpensiveItem = itemsToSave.some(
      (i) => i.price > MAX_LIMIT || i.price * i.qty > MAX_LIMIT,
    );
    if (hasTooExpensiveItem) {
      alert(
        "One or more item prices exceed the maximum system limit of ₹99,999,999.99. Please correct the item prices.",
      );
      return null;
    }

    const currentTimeStr = new Date().toTimeString().split(" ")[0];
    let orderTimestamp = new Date().toISOString();
    if (customOrderDate) {
      const parsedDate = new Date(`${customOrderDate}T${currentTimeStr}`);
      if (!isNaN(parsedDate.getTime())) {
        orderTimestamp = parsedDate.toISOString();
      }
    }

    // Resolve the amount tendered and the split breakdown per payment mode.
    let receivedAmount = cashReceived;
    let splitCashVal = 0;
    let splitGpayVal = 0;
    if (paymentMode === "SPLIT") {
      splitCashVal = Number(splitCash) || 0;
      splitGpayVal = Number(splitGpay) || 0;
      receivedAmount = splitCashVal + splitGpayVal;
    } else if (paymentMode === "GPAY") {
      // GPay is an exact digital transfer — no change to return.
      receivedAmount = cashReceived > 0 ? cashReceived : localGrandTotal;
    }

    setIsSubmittingOrder(true);

    try {
      const submitResult = await submitOrder({
        orderId: `INV-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        customerName: customerName || "Guest",
        customerPhone: customerPhone,
        customerAddress: customerAddress || null,
        source: isOnline ? "ONLINE" : "OFFLINE",
        isGst: applyGST,
        billDate: orderTimestamp,
        items: itemsToSave.map((i) => ({
          id: i.id,
          product_id: i.product_id || null,
          name: i.name,
          desc: i.desc,
          price: i.price,
          qty: i.qty,
          offerPct: i.offerPct ?? 0,
          originalPrice: (i.offerPct ?? 0) > 0 ? i.originalPrice ?? null : null,
        })),
        discountType: discountType === "percent" ? "PERCENT" : "FIXED",
        discountValue: discountValue,
        discountAmount: localCalculatedDiscount,
        gstPercentage: applyGST ? gstPercentage : 0,
        gstAmount: localGstAmount,
        deliveryFee: deliveryFee,
        grandTotal: localGrandTotal,
        cashReceived: receivedAmount,
        splitCash: splitCashVal,
        splitGpay: splitGpayVal,
        paymentMode: paymentMode,
      });
      if ("error" in submitResult) {
        throw new Error(submitResult.error);
      }
      const newOrderId = submitResult.orderId;

      // Construct mappedOrder directly in memory to respond with ZERO blocking delay
      const mappedOrder: CompletedOrder = {
        id: newOrderId,
        customerName: customerName.trim() || "Guest",
        customerPhone: customerPhone,
        customerAddress: customerAddress.trim() || null,
        source: isOnline ? "ONLINE" : "OFFLINE",
        isGst: Boolean(applyGST),
        items: itemsToSave.map((i, idx) => ({
          id: `oi-${newOrderId}-${idx}`,
          name: i.name,
          desc: i.name === "Custom Item" ? "Custom" : (i.desc || ""),
          price: Number(i.price) || 0,
          qty: Number(i.qty) || 0,
          offerPct: i.offerPct ?? 0,
          originalPrice: i.originalPrice,
        })),
        subtotal: Number(localSubtotal) || 0,
        discount: Number(localCalculatedDiscount) || 0,
        discountType: discountType === "percent" ? "PERCENT" : "FIXED",
        discountValue: discountValue ? Number(discountValue) : undefined,
        gstPercentage: applyGST ? Number(gstPercentage) : 0,
        gstAmount: Number(localGstAmount) || 0,
        deliveryFee: Number(deliveryFee) || 0,
        grandTotal: Number(localGrandTotal) || 0,
        cashReceived: Number(receivedAmount) || 0,
        splitCash: splitCashVal,
        splitGpay: splitGpayVal,
        paymentMode: paymentMode,
        date: orderTimestamp,
        createdAt: new Date().toISOString(),
        status: "Completed",
      };

      // Instantly update orders history and open the completed receipt banner
      setOrders((prev) => [mappedOrder, ...prev]);
      setCompletedBillData(mappedOrder as unknown as CompletedOrder);

      // Non-blocking sync with backend database in the background
      fetchProducts()
        .then((data) => setCatalog(data.map(productToCatalogItem)))
        .catch((err) => console.error("Background sync error:", err));

      // Reset Form immediately
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomOrderDate(new Date().toISOString().split("T")[0]);
      setItems([{ id: "1", name: "", desc: "", price: 0, qty: 1 }]);
      setDiscountValue(0);
      setDeliveryFee(0);
      setCashReceived(0);
      setSplitCash(0);
      setSplitGpay(0);
      setPaymentMode("CASH");
      setApplyGST(false);
      setGstPercentage(18);

      return mappedOrder;
    } catch (err: unknown) {
      console.error("Failed to complete sale:", err);
      alert("An error occurred while saving the sale. Please try again.");
      return null;
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Completes the sale first, then shares the saved bill over WhatsApp.
  const handleCompleteAndSendWhatsApp = async () => {
    if (!customerPhone || customerPhone.length !== 10) {
      alert(
        "Please enter a valid 10-digit mobile contact number to send bill via WhatsApp.",
      );
      return;
    }

    // Pre-open blank tab on desktop to prevent popup blocker from blocking WhatsApp after async await
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let popupWindow: Window | null = null;
    if (!isMobile) {
      popupWindow = window.open("about:blank", "_blank");
    }

    try {
      const order = await completeSale();
      if (order) {
        resendWhatsApp(order, popupWindow);
      } else if (popupWindow) {
        popupWindow.close();
      }
    } catch (err) {
      if (popupWindow) popupWindow.close();
      console.error(err);
    }
  };

  const resendWhatsApp = (
    order: CompletedOrder,
    existingWindow?: Window | null,
  ) => {
    if (!order.customerPhone || order.customerPhone.length < 10) {
      alert("Invalid customer phone number for this order.");
      if (existingWindow) existingWindow.close();
      return;
    }
    const domain = window.location.origin;
    const invoiceUrl = `${domain}/invoice/${order.id}`;
    const shopEmoji = String.fromCodePoint(0x2728);
    const checkEmoji = String.fromCodePoint(0x2705);
    const moneyEmoji = String.fromCodePoint(0x1f4b0);
    const receiptEmoji = String.fromCodePoint(0x1f4e6);
    let message = `${shopEmoji} *${shopSettings.shop_name}* ${shopEmoji}\n\n`;
    message += `${checkEmoji} Here are your ${order.isGst ? "GST invoice" : "bill"} details!\n\n`;

    const offerSavings = order.items.reduce(
      (sum, i) =>
        (i.offerPct ?? 0) > 0 && i.originalPrice
          ? sum + (i.originalPrice - i.price) * i.qty
          : sum,
      0,
    );
    if (offerSavings > 0.009) {
      message += `Offer items:\n`;
      for (const i of order.items) {
        if ((i.offerPct ?? 0) > 0 && i.originalPrice) {
          message += `• ${i.name}: ₹${i.originalPrice.toLocaleString("en-IN")} → ₹${i.price.toLocaleString("en-IN")} (${i.offerPct}% off)\n`;
        }
      }
      message += `You saved ₹${offerSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })} on offers!\n\n`;
    }
    message += `Subtotal: ₹${order.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    if (order.discount > 0) {
      message += `Discount Applied: -₹${order.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    }

    // GST is split into CGST + SGST (intra-state standard)
    const gstOnBill = Number(order.gstAmount) || 0;
    if (order.isGst && gstOnBill > 0.01) {
      const halfRate = (order.gstPercentage || 0) / 2;
      const fmtRate = Number.isInteger(halfRate) ? halfRate.toString() : halfRate.toFixed(1);
      const halfAmount = gstOnBill / 2;
      message += `CGST (${fmtRate}%): +₹${halfAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
      message += `SGST (${fmtRate}%): +₹${halfAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    }

    if (order.deliveryFee > 0) {
      message += `Delivery Fee: ₹${order.deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    }

    message += `\n${moneyEmoji} *Total Amount: ₹${order.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}*\n`;
    message += `Payment: ${order.paymentMode}\n\n`;
    message += `${receiptEmoji} View and download your detailed digital receipt here:\n${invoiceUrl}`;
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = order.customerPhone.replace(/\D/g, "").slice(-10);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodedMessage}`;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (existingWindow && !isMobile) {
      existingWindow.location.href = whatsappUrl;
    } else if (isMobile) {
      window.location.href = whatsappUrl;
    } else {
      window.open(whatsappUrl, "_blank");
    }
  };

  // Opens the Print Settings Modal for advance receipts
  const printAdvanceReceipt = (advId: string) => {
    openPrintModal({ id: advId, type: "advance" });
  };

  // Shares the advance-order receipt link over WhatsApp.
  const shareAdvanceReceiptWhatsApp = (receipt: {
    id: string;
    customerName: string;
    customerPhone: string;
    total: number;
    deposit: number;
    balance: number;
  }) => {
    if (typeof window === "undefined") return;
    const domain = window.location.origin;
    const receiptUrl = `${domain}/advance/${receipt.id}`;
    const fmt = (n: number) =>
      n.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const shopEmoji = String.fromCodePoint(0x2728);
    const receiptEmoji = String.fromCodePoint(0x1f4e6);
    let message = `${shopEmoji} *${shopSettings.shop_name}* ${shopEmoji}\n\n`;
    message += `Advance order confirmed!\n\n`;
    message += `Order Total: ₹${fmt(receipt.total)}\n`;
    message += `Deposit Paid: ₹${fmt(receipt.deposit)}\n`;
    message += `Balance Due: ₹${fmt(receipt.balance)}\n\n`;
    message += `${receiptEmoji} View your advance receipt here:\n${receiptUrl}`;
    const encoded = encodeURIComponent(message);
    const cleanPhone = (receipt.customerPhone || "").replace(/\D/g, "").slice(-10);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, "_blank");
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this invoice? This action cannot be undone.",
      )
    )
      return;
    await removeOrder(orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    if (selectedOrder?.id === orderId) setSelectedOrder(null);
    if (completedBillData?.id === orderId) setCompletedBillData(null);
    if (activeInvoiceId === orderId) setActiveInvoiceId(null);
  };

  // ── Expense tracker: handlers ──────────────────────────────────────
  const handleAddExpense = async () => {
    const amountNum =
      typeof expAmount === "number" ? expAmount : parseFloat(String(expAmount));
    const category =
      (expCategory === "__custom__" ? expCustomCategory : expCategory).trim() ||
      "General";
    if (!expTitle.trim()) {
      alert("Please enter what the expense was for.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    const payload = {
      title: expTitle.trim(),
      category,
      amount: amountNum,
      payment_mode: expPaymentMode,
      notes: expNotes.trim() || null,
      expense_date: expDate,
    };
    setIsSavingExpense(true);
    try {
      if (editingExpenseId) {
        const updated = await editExpense(editingExpenseId, payload);
        if (!updated) {
          alert("This expense no longer exists - it may have been deleted.");
          setExpenses((prev) => prev.filter((e) => e.id !== editingExpenseId));
        } else {
          setExpenses((prev) =>
            prev.map((e) =>
              e.id === editingExpenseId
                ? { ...updated, amount: Number(updated.amount) || 0 }
                : e,
            ),
          );
        }
        cancelEditExpense();
        return;
      }
      const created = await createExpense(payload);
      setExpenses((prev) => [
        { ...created, amount: Number(created.amount) || 0 },
        ...prev,
      ]);
      // Keep category / payment mode / date for fast repeat entry
      setExpTitle("");
      setExpAmount("");
      setExpNotes("");
      if (expCategory === "__custom__") {
        setExpCategory(category);
        setExpCustomCategory("");
      }
    } catch (err) {
      console.error("Error adding expense:", err);
      alert("Could not save the expense. Please try again.");
    } finally {
      setIsSavingExpense(false);
    }
  };

  const startEditExpense = (e: Expense) => {
    setEditingExpenseId(e.id);
    setExpTitle(e.title);
    setExpAmount(Number(e.amount) || "");
    // Show the date as the user's local calendar day, matching the list.
    setExpDate(new Date(e.expense_date).toLocaleDateString("en-CA"));
    if ((EXPENSE_CATEGORIES as readonly string[]).includes(e.category)) {
      setExpCategory(e.category);
      setExpCustomCategory("");
    } else {
      setExpCategory("__custom__");
      setExpCustomCategory(e.category);
    }
    setExpPaymentMode(e.payment_mode);
    setExpNotes(e.notes || "");
    document
      .getElementById("expense-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEditExpense = () => {
    setEditingExpenseId(null);
    setExpTitle("");
    setExpAmount("");
    setExpNotes("");
    setExpCustomCategory("");
    setExpCategory(EXPENSE_CATEGORIES[0]);
    setExpPaymentMode("CASH");
    setExpDate(new Date().toLocaleDateString("en-CA"));
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    try {
      await removeExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      if (editingExpenseId === id) cancelEditExpense();
    } catch (err) {
      console.error("Error deleting expense:", err);
      alert("Could not delete the expense.");
    }
  };

  // Expenses filtered for the Expenses tab (period + category + search)
  const expenseStats = React.useMemo(() => {
    const filtered = expenses.filter((e) => {
      if (
        !isDateInPeriod(
          e.expense_date,
          expensePeriod,
          expenseStartDate,
          expenseEndDate,
        )
      )
        return false;
      if (expenseCategoryFilter !== "ALL" && e.category !== expenseCategoryFilter)
        return false;
      if (expenseSearch) {
        const q = expenseSearch.toLowerCase();
        if (
          !e.title.toLowerCase().includes(q) &&
          !e.category.toLowerCase().includes(q) &&
          !(e.notes || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    const sortedFiltered = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (expenseSortField === "date") {
        comparison =
          new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime();
      } else if (expenseSortField === "title") {
        comparison = (a.title || "").localeCompare(b.title || "");
      } else if (expenseSortField === "category") {
        comparison = (a.category || "").localeCompare(b.category || "");
      } else if (expenseSortField === "payment_mode") {
        comparison = (a.payment_mode || "").localeCompare(b.payment_mode || "");
      } else if (expenseSortField === "amount") {
        comparison = a.amount - b.amount;
      }
      return expenseSortOrder === "asc" ? comparison : -comparison;
    });

    const total = filtered.reduce((acc, e) => acc + e.amount, 0);
    const byCategory: Record<string, number> = {};
    filtered.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const topCategory = categoryBreakdown[0]?.category || "None";
    const allCategories = Array.from(
      new Set(expenses.map((e) => e.category)),
    ).sort();
    return {
      filtered: sortedFiltered,
      total,
      categoryBreakdown,
      topCategory,
      count: filtered.length,
      allCategories,
    };
  }, [
    expenses,
    expensePeriod,
    expenseStartDate,
    expenseEndDate,
    expenseCategoryFilter,
    expenseSearch,
    expenseSortField,
    expenseSortOrder,
  ]);

  // Total expenses within the CURRENT analytics window (drives Net Profit on the dashboard)
  const analyticsExpensesTotal = React.useMemo(() => {
    return expenses
      .filter((e) =>
        isDateInPeriod(
          e.expense_date,
          analyticsPeriod,
          analyticsStartDate,
          analyticsEndDate,
        ),
      )
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses, analyticsPeriod, analyticsStartDate, analyticsEndDate]);

  // Real-time analytics derived from orders with period filtering
  const {
    analyticsFilteredOrders,
    totalOrdersCount,
    totalRevenueAmount,
    gstRevenue,
    nonGstRevenue,
    gstOrdersCount,
    nonGstOrdersCount,
    avgOrderValue,
    onlineOrders,
    offlineOrders,
    onlineRevenue,
    offlineRevenue,
    topItems,
    currentWeekNumber,
    weekRevenue,
    maxWeekRevenue,
    monthRevenue,
    maxMonthRevenue,
    totalYearRevenue,
    avgMonthRevenue,
    todayOrders,
    todayRevenue,
    todayOrdersCount,
    todayOnlineOrdersCount,
    todayOfflineOrdersCount,
    todayOnlineRevenue,
    todayOfflineRevenue,
    todayItemsSold,
    todayTopItems,
    monthlyRevenue,
    totalItemsSold,
    topCategory,
    topProduct,
    dayNames,
    monthNames,
    itemSales,
    now,
  } = React.useMemo(() => {
    const now = new Date();

    // GST dashboard scope: "all" bills, GST invoices only, or non-GST bills only.
    const passesGst = (o: CompletedOrder) =>
      analyticsGstFilter === "all" ||
      (analyticsGstFilter === "gst" ? o.isGst : !o.isGst);

    const analyticsFilteredOrders = orders.filter((o) => {
      if (!passesGst(o)) return false;
      if (
        analyticsSearchPhone &&
        !o.customerPhone.includes(analyticsSearchPhone)
      ) {
        return false;
      }
      return isDateInPeriod(
        o.date,
        analyticsPeriod,
        analyticsStartDate,
        analyticsEndDate,
      );
    });

    const totalOrdersCount = analyticsFilteredOrders.length;
    const totalRevenueAmount = analyticsFilteredOrders.reduce(
      (acc, o) => acc + o.grandTotal,
      0,
    );
    const avgOrderValue =
      totalOrdersCount > 0 ? totalRevenueAmount / totalOrdersCount : 0;

    const gstOrders = analyticsFilteredOrders.filter((o) => o.isGst);
    const nonGstOrders = analyticsFilteredOrders.filter((o) => !o.isGst);
    const gstRevenue = gstOrders.reduce((acc, o) => acc + o.grandTotal, 0);
    const nonGstRevenue = nonGstOrders.reduce(
      (acc, o) => acc + o.grandTotal,
      0,
    );
    const gstOrdersCount = gstOrders.length;
    const nonGstOrdersCount = nonGstOrders.length;

    // Split channels
    const onlineOrders = analyticsFilteredOrders.filter(
      (o) => o.source === "ONLINE",
    ).length;
    const offlineOrders = analyticsFilteredOrders.filter(
      (o) => o.source === "OFFLINE",
    ).length;

    // Split revenues
    const onlineRevenue = analyticsFilteredOrders
      .filter((o) => o.source === "ONLINE")
      .reduce((acc, o) => acc + o.grandTotal, 0);
    const offlineRevenue = analyticsFilteredOrders
      .filter((o) => o.source === "OFFLINE")
      .reduce((acc, o) => acc + o.grandTotal, 0);

    // Top items by revenue in analyticsFilteredOrders
    const itemSales: Record<
      string,
      { name: string; revenue: number; qty: number }
    > = {};
    analyticsFilteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!item.name || item.name.startsWith("GST (")) return;
        if (!itemSales[item.name])
          itemSales[item.name] = { name: item.name, revenue: 0, qty: 0 };
        itemSales[item.name].revenue += item.price * item.qty;
        itemSales[item.name].qty += item.qty;
      });
    });
    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Helper to get ISO week number of the year
    const getWeekOfYear = (d: Date) => {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7; // Monday = 0, Sunday = 6
      target.setDate(target.getDate() - dayNr + 3); // Nearest Thursday
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };
    const currentWeekNumber = getWeekOfYear(now);

    // Revenue per day of current week (Mon–Sun) - CONSTANT (independent of analyticsPeriod filters)
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekRevenue = [0, 0, 0, 0, 0, 0, 0];

    // Find Monday to Sunday of current calendar week
    const currentDayOfWeek = now.getDay();
    const distToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const mondayOfThisWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + distToMon,
    );
    mondayOfThisWeek.setHours(0, 0, 0, 0);

    const sundayOfThisWeek = new Date(mondayOfThisWeek);
    sundayOfThisWeek.setDate(mondayOfThisWeek.getDate() + 6);
    sundayOfThisWeek.setHours(23, 59, 59, 999);

    orders.forEach((order) => {
      if (!passesGst(order)) return;
      if (analyticsSearchPhone) {
        const q = analyticsSearchPhone.toLowerCase();
        const matchPhone = order.customerPhone.includes(q);
        const matchInvoice = order.id.toLowerCase().includes(q);
        if (!matchPhone && !matchInvoice) {
          return;
        }
      }
      const orderDate = new Date(order.date);
      const orderTime = orderDate.getTime();
      if (
        orderTime >= mondayOfThisWeek.getTime() &&
        orderTime <= sundayOfThisWeek.getTime()
      ) {
        const day = (orderDate.getDay() + 6) % 7;
        weekRevenue[day] += order.grandTotal;
      }
    });
    const maxWeekRevenue = Math.max(...weekRevenue, 1);

    // Revenue per month of current year - CONSTANT (independent of analyticsPeriod filters)
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthRevenue = Array(12).fill(0);
    orders.forEach((order) => {
      if (!passesGst(order)) return;
      if (analyticsSearchPhone) {
        const q = analyticsSearchPhone.toLowerCase();
        const matchPhone = order.customerPhone.includes(q);
        const matchInvoice = order.id.toLowerCase().includes(q);
        if (!matchPhone && !matchInvoice) {
          return;
        }
      }
      const d = new Date(order.date);
      if (d.getFullYear() === now.getFullYear()) {
        monthRevenue[d.getMonth()] += order.grandTotal;
      }
    });
    const maxMonthRevenue = Math.max(...monthRevenue, 1);
    const totalYearRevenue = monthRevenue.reduce((a, b) => a + b, 0);
    const avgMonthRevenue = totalYearRevenue / 12;

    // New Detailed KPI Computations based on analyticsFilteredOrders
    const todayOrders = orders.filter((o) => {
      if (!passesGst(o)) return false;
      if (analyticsSearchPhone) {
        const q = analyticsSearchPhone.toLowerCase();
        const matchPhone = o.customerPhone.includes(q);
        const matchInvoice = o.id.toLowerCase().includes(q);
        if (!matchPhone && !matchInvoice) {
          return false;
        }
      }
      const d = new Date(o.date);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });

    const todayRevenue = todayOrders.reduce((acc, o) => acc + o.grandTotal, 0);

    const todayOrdersCount = todayOrders.length;
    const todayOnlineOrdersCount = todayOrders.filter(
      (o) => o.source === "ONLINE",
    ).length;
    const todayOfflineOrdersCount = todayOrders.filter(
      (o) => o.source === "OFFLINE",
    ).length;

    const todayOnlineRevenue = todayOrders
      .filter((o) => o.source === "ONLINE")
      .reduce((acc, o) => acc + o.grandTotal, 0);
    const todayOfflineRevenue = todayOrders
      .filter((o) => o.source === "OFFLINE")
      .reduce((acc, o) => acc + o.grandTotal, 0);

    const todayItemsSold = todayOrders.reduce(
      (acc, o) =>
        acc +
        o.items.reduce((sum, item) => {
          const isGST = item.name && item.name.startsWith("GST (");
          return sum + (isGST ? 0 : item.qty);
        }, 0),
      0,
    );

    // Today's top items
    const todayItemSales: Record<
      string,
      { name: string; revenue: number; qty: number }
    > = {};
    todayOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!item.name || item.name.startsWith("GST (")) return;
        if (!todayItemSales[item.name])
          todayItemSales[item.name] = { name: item.name, revenue: 0, qty: 0 };
        todayItemSales[item.name].revenue += item.price * item.qty;
        todayItemSales[item.name].qty += item.qty;
      });
    });
    const todayTopItems = Object.values(todayItemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const monthlyRevenue = orders
      .filter((o) => {
        if (!passesGst(o)) return false;
        const d = new Date(o.date);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((acc, o) => acc + o.grandTotal, 0);

    const totalItemsSold = analyticsFilteredOrders.reduce(
      (acc, o) =>
        acc +
        o.items.reduce((sum, item) => {
          const isGST = item.name && item.name.startsWith("GST (");
          return sum + (isGST ? 0 : item.qty);
        }, 0),
      0,
    );

    const categorySales: Record<string, number> = {};
    analyticsFilteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.name && item.name.startsWith("GST (")) return;
        const cat = item.desc || "Uncategorized";
        if (!categorySales[cat]) categorySales[cat] = 0;
        categorySales[cat] += item.price * item.qty;
      });
    });
    const topCategory =
      Object.keys(categorySales).length > 0
        ? Object.entries(categorySales).sort((a, b) => b[1] - a[1])[0][0]
        : "None";
    const topProduct = topItems[0]?.name || "None";
    return {
      analyticsFilteredOrders,
      totalOrdersCount,
      totalRevenueAmount,
      gstRevenue,
      nonGstRevenue,
      gstOrdersCount,
      nonGstOrdersCount,
      avgOrderValue,
      onlineOrders,
      offlineOrders,
      onlineRevenue,
      offlineRevenue,
      topItems,
      currentWeekNumber,
      weekRevenue,
      maxWeekRevenue,
      monthRevenue,
      maxMonthRevenue,
      totalYearRevenue,
      avgMonthRevenue,
      todayOrders,
      todayRevenue,
      todayOrdersCount,
      todayOnlineOrdersCount,
      todayOfflineOrdersCount,
      todayOnlineRevenue,
      todayOfflineRevenue,
      todayItemsSold,
      todayTopItems,
      monthlyRevenue,
      totalItemsSold,
      topCategory,
      topProduct,
      dayNames,
      monthNames,
      itemSales,
      now,
    };
  }, [
    orders,
    analyticsSearchPhone,
    analyticsPeriod,
    analyticsStartDate,
    analyticsEndDate,
    analyticsGstFilter,
  ]);

  // Inventory-derived data (pure catalog — stock tracking removed).
  const inventoryProducts = catalog.filter((c) => !c.id.startsWith("default-"));

  const filteredInventory = inventoryProducts
    .filter((p) => {
      if (!inventorySearch.trim()) return true;
      const q = inventorySearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.desc || "").toLowerCase().includes(q) ||
        (p.hsnCode || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      if (inventorySortField === "name") {
        comparison = (a.name || "").localeCompare(b.name || "");
      } else if (inventorySortField === "price") {
        comparison = (a.price ?? 0) - (b.price ?? 0);
      } else if (inventorySortField === "gst") {
        comparison = (a.gstRate ?? 0) - (b.gstRate ?? 0);
      }
      return inventorySortOrder === "asc" ? comparison : -comparison;
    });

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
          <span className="text-xs text-[#171717] font-bold uppercase tracking-wider">
            Verifying Session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] text-[#171717] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-[420px] bg-white border border-[#D4AF37]/40 rounded-[2rem] sm:rounded-[2.25rem] p-6 sm:p-8 shadow-[0_20px_55px_rgba(23,23,23,0.10)] flex flex-col items-center text-center">
          <div className="w-full h-1 bg-[#D4AF37] rounded-full mb-6" />

          <div className="mb-4">
            <div className="w-28 h-28 sm:w-32 sm:h-32 mx-auto rounded-2xl bg-white border border-[#D4AF37]/40 p-2 overflow-hidden flex items-center justify-center shadow-xs">
              <img
                src={shopSettings.logo_data_url || "/nidulan-logo.jpeg"}
                alt={`${shopSettings.shop_name} - THE PRECIOUS PEARLS`}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-serif font-extrabold text-[#171717] tracking-[0.18em] uppercase mb-1">
            {shopSettings.shop_name}
          </h1>
          <p className="text-[#A47B16] text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-[0.24em] mb-5 sm:mb-6">
            THE PRECIOUS PEARLS • TERMINAL ACCESS
          </p>

          {/* Form */}
          <form
            onSubmit={handleVerifyPasscode}
            className="w-full space-y-4 text-left"
          >
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-[#8A6815] uppercase tracking-[0.22em] ml-1">
                Security Passcode
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A47B16] group-focus-within/input:text-[#171717] transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPasscode ? "text" : "password"}
                  name="update-pos-passcode"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-white border border-[#D1D5DB] hover:border-[#D4AF37] focus:border-[#D4AF37] focus:bg-white rounded-xl sm:rounded-2xl pl-11 pr-11 py-3 text-[#171717] font-mono tracking-widest text-base sm:text-lg focus:outline-none transition-all placeholder:text-[#9CA3AF] shadow-sm"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (passcodeError) setPasscodeError("");
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#8A6815] transition-colors cursor-pointer"
                >
                  {showPasscode ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {passcodeError && (
                <p className="text-xs text-[#EF4444] font-semibold mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
                  {passcodeError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 sm:py-3.5 bg-[#D4AF37] hover:bg-[#C5A02E] active:scale-[0.98] text-[#171717] rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-[0.22em] transition-all shadow-sm flex items-center justify-center gap-2 mt-4 cursor-pointer border border-[#C5A02E]"
            >
              Authenticate
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Status Badge */}
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/35 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A47B16] animate-pulse" />
            <span className="text-[9px] font-bold text-[#8A6815] tracking-[0.2em] uppercase">
              SYSTEM ONLINE • ENCRYPTED
            </span>
          </div>
        </div>

        {/* Footnote */}
        <div className="mt-5 text-[#6B7280] text-[9.5px] font-medium tracking-[0.2em] uppercase text-center">
          {shopSettings.shop_name} Terminal • Door No 615A, Namakkal
        </div>
      </div>
    );
  }

  // Filtered orders for Order History tab
  const historyFilteredOrders = orders.filter((order) => {
    const matchId = order.id
      .toLowerCase()
      .includes(orderSearchId.toLowerCase());
    const matchName = order.customerName
      .toLowerCase()
      .includes(orderSearchName.toLowerCase());
    const matchPhone = (order.customerPhone || "").includes(orderSearchPhone);
    const matchSource =
      orderFilterSource === "ALL" || order.source === orderFilterSource;
    const matchStatus =
      orderFilterStatus === "ALL" ||
      order.status.toUpperCase() === orderFilterStatus.toUpperCase();

    const matchPeriod = isDateInPeriod(
      order.date,
      historyPeriod,
      historyStartDate,
      historyEndDate,
    );

    return (
      matchId &&
      matchName &&
      matchPhone &&
      matchSource &&
      matchStatus &&
      matchPeriod
    );
  }).sort((a, b) => {
    let comparison = 0;
    if (orderSortField === "date") {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (orderSortField === "id") {
      comparison = (a.id || "").localeCompare(b.id || "");
    } else if (orderSortField === "name") {
      comparison = (a.customerName || "").localeCompare(b.customerName || "");
    } else if (orderSortField === "total") {
      comparison = (a.grandTotal || 0) - (b.grandTotal || 0);
    } else if (orderSortField === "status") {
      comparison = (a.status || "").localeCompare(b.status || "");
    }
    return orderSortOrder === "asc" ? comparison : -comparison;
  });

  const handleExportCSV = () => {
    if (historyFilteredOrders.length === 0) {
      alert("No orders available to export.");
      return;
    }

    // CSV Headers padded with spaces to ensure columns default to a readable width in Excel
    const headers = [
      "Order ID          ",
      "Date                   ",
      "Customer Name           ",
      "Customer Phone          ",
      "Source        ",
      "Subtotal      ",
      "Discount      ",
      "Delivery Fee  ",
      "Grand Total   ",
      "Status        ",
      "Items                                                                               ",
    ];

    // CSV Rows
    const rows = historyFilteredOrders.map((o) => {
      const itemsStr = o.items.map((i) => `${i.name} (x${i.qty})`).join("; ");

      // Formatting date: MM/DD/YYYY HH:MM AM/PM as an Excel text formula to prevent ### errors.
      // Date comes from the (backdatable) bill_date; the time comes from the real
      // transaction timestamp (created_at) rendered in IST.
      const dateStr = new Date(o.date).toLocaleDateString("en-IN");
      const timeStr = new Date(o.createdAt || o.date).toLocaleTimeString(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        },
      );
      const formattedDate = `"=""${dateStr} ${timeStr}"""`;

      // Formatting phone number as an Excel text formula to prevent scientific notation
      const formattedPhone = o.customerPhone
        ? `"=""${o.customerPhone}"""`
        : `"N/A"`;

      return [
        o.id,
        formattedDate,
        o.customerName,
        formattedPhone,
        o.source,
        o.subtotal,
        o.discount,
        o.deliveryFee,
        o.grandTotal,
        o.status,
        `"${itemsStr.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((val) => {
            if (typeof val === "string" && !val.startsWith('"')) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Order_History_${historyPeriod}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportInventoryCSV = () => {
    if (inventoryProducts.length === 0) {
      alert("No products in inventory to export.");
      return;
    }
    const headers = [
      "Product ID",
      "Name",
      "Type",
      "Description",
      "Category",
      "Price",
      "Cost Price",
      "Stock",
      "Low Stock Alert",
      "Offer %",
      "Offer Price",
      "Active",
    ];
    const rows = inventoryProducts.map((p) => [
      p.id,
      p.name,
      p.itemType === "SERVICE" ? "SERVICE" : "PRODUCT",
      p.desc || "",
      p.category || "",
      p.price ?? "",
      p.costPrice ?? "",
      // Services have no stock by design.
      p.itemType === "SERVICE" ? "" : (p.stock ?? ""),
      p.itemType === "SERVICE" ? "" : (p.lowStockAlert ?? ""),
      p.offerPct ?? 0,
      p.offerPrice ?? "",
      p.isActive === false ? "No" : "Yes",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((v) => {
            const s = String(v ?? "");
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Inventory_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="pos-dashboard min-h-screen bg-[#F7F7F8] text-[#171717] flex flex-row font-sans overflow-hidden selection:bg-[var(--accent)] selection:text-[#171717]"
    >
      {/* Stock Adjustment Modal — restock / return / loss / reconcile */}
      {stockAdjustTarget && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
          onClick={closeStockAdjust}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(23,23,23,0.15)] border border-[#C5A059]/30 w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 bg-[#FAF8F5] border-b border-[#C5A059]/25 text-[#171717]">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#8A6815] flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black tracking-tight truncate text-[#171717]">
                    Adjust Inventory Stock
                  </h3>
                  <p className="text-[10px] font-semibold text-zinc-500">
                    Restock, return, deduct loss, or reconcile count
                  </p>
                </div>
              </div>
              <button
                onClick={closeStockAdjust}
                disabled={isSavingStock}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close stock adjustment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Target + current stock */}
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#181820] border border-[#C5A059]/25">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] mb-0.5 flex items-center gap-1.5">
                    <Package className="w-3 h-3" /> Target Item
                  </p>
                  <p className="text-sm font-bold text-[#FAF7F2] truncate">
                    {stockAdjustTarget.name}
                  </p>
                  {stockAdjustTarget.hsnCode && (
                    <p className="text-[10px] font-mono text-[#B8B5AE] mt-0.5">
                      HSN {stockAdjustTarget.hsnCode}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#B8B5AE]">
                    Current Stock
                  </p>
                  <p className="text-lg font-black text-[#FAF7F2] leading-tight">
                    {stockAdjustTarget.stock ?? 0}
                    <span className="text-[10px] font-bold text-[#B8B5AE] ml-1">
                      units
                    </span>
                  </p>
                </div>
              </div>
              {/* Adjustment type */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#B8B5AE] mb-2">
                  Select Adjustment Type <span className="text-red-400">*</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { key: "RESTOCK", label: "Restock", sub: "+ Add", Icon: Plus, tone: "text-emerald-400" },
                      { key: "RETURN", label: "Return", sub: "+ Add", Icon: Undo2, tone: "text-blue-400" },
                      { key: "LOSS", label: "Loss / Dmg", sub: "− Deduct", Icon: Minus, tone: "text-red-400" },
                      { key: "RECONCILE", label: "Reconcile", sub: "Exact Set", Icon: Target, tone: "text-amber-400" },
                    ] as const
                  ).map(({ key, label, sub, Icon, tone }) => {
                    const active = stockAdjustType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setStockAdjustType(key);
                          setStockAdjustQty(
                            key === "RECONCILE" ? stockAdjustTarget.stock ?? 0 : 0,
                          );
                        }}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 transition-all cursor-pointer ${
                          active
                            ? "border-[var(--accent)] bg-[#25221B] shadow-xs"
                            : "border-[#C5A059]/20 bg-[#181820] hover:border-[#C5A059]/50"
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                            active
                              ? "border-[var(--accent)]/40 bg-[var(--accent)]/20"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          <Icon
                            className={`w-3.5 h-3.5 ${active ? "text-[var(--accent)]" : tone}`}
                          />
                        </span>
                        <span className="text-[10px] font-black text-[#FAF7F2] leading-tight">
                          {label}
                        </span>
                        <span
                          className={`text-[9px] font-bold leading-tight ${
                            sub.startsWith("+")
                              ? "text-emerald-400"
                              : sub.startsWith("−")
                                ? "text-red-400"
                                : "text-amber-400"
                          }`}
                        >
                          {sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Quantity */}
              <div
                className={`rounded-xl border p-3.5 transition-colors ${
                  stockAdjustType === "LOSS"
                    ? "border-red-900/50 bg-red-950/20"
                    : "border-[#C5A059]/30 bg-[#181820]"
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-[#B8B5AE] mb-2.5">
                  {stockAdjustType === "RECONCILE"
                    ? "New Counted Quantity"
                    : stockAdjustType === "LOSS"
                      ? "Quantity to Deduct"
                      : "Quantity to Add"}{" "}
                  <span className="text-red-400">*</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStockAdjustQty((q) => Math.max(0, q - 1))}
                    className="w-10 h-10 shrink-0 rounded-lg border border-[#C5A059]/30 bg-[#252532] hover:bg-[#2F2F40] text-[#FAF7F2] flex items-center justify-center font-black text-lg cursor-pointer transition-colors"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={stockAdjustQty === 0 ? "" : stockAdjustQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setStockAdjustQty(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="flex-1 min-w-0 text-center text-lg font-black text-[#FAF7F2] bg-[#131317] border border-[#C5A059]/30 rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setStockAdjustQty((q) => q + 1)}
                    className="w-10 h-10 shrink-0 rounded-lg border border-[#C5A059]/30 bg-[#252532] hover:bg-[#2F2F40] text-[#FAF7F2] flex items-center justify-center font-black text-lg cursor-pointer transition-colors"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8B5AE] mr-0.5">
                    Quick:
                  </span>
                  {[1, 5, 10, 25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setStockAdjustQty((q) =>
                          stockAdjustType === "RECONCILE" ? n : q + n,
                        )
                      }
                      className="px-2 py-1 rounded-md border border-[#C5A059]/25 bg-[#181820] hover:border-[var(--accent)] text-[#FAF7F2] text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      {stockAdjustType === "RECONCILE" ? n : `+${n}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result preview */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[#C5A059]/30 bg-[#181820] text-[11px] font-bold">
                <span className="text-[#B8B5AE]">
                  Current:{" "}
                  <span className="text-[#FAF7F2] font-black">
                    {stockAdjustTarget.stock ?? 0}
                  </span>
                  <span className="mx-1.5">→</span>
                  New Stock:{" "}
                  <span className="text-[var(--accent)] font-black">
                    {stockAdjustPreview}
                  </span>{" "}
                  units
                </span>
                <span
                  className={`font-black ${
                    stockAdjustDelta > 0
                      ? "text-emerald-400"
                      : stockAdjustDelta < 0
                        ? "text-red-400"
                        : "text-[#B8B5AE]"
                  }`}
                >
                  {stockAdjustDelta > 0 ? `+${stockAdjustDelta}` : stockAdjustDelta}
                </span>
              </div>

              {/* Note */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#B8B5AE] mb-1.5">
                  Adjustment Note{" "}
                  <span className="text-[#B8B5AE]/60 normal-case">(optional)</span>
                </p>
                <input
                  value={stockAdjustNote}
                  onChange={(e) => setStockAdjustNote(e.target.value)}
                  placeholder="e.g. Received new stock shipment"
                  className="w-full bg-[#181820] border border-[#C5A059]/25 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 p-5 border-t border-[#C5A059]/20 bg-[#16161D]">
              <button
                type="button"
                onClick={closeStockAdjust}
                disabled={isSavingStock}
                className="px-4 py-2.5 rounded-lg border border-[#C5A059]/25 bg-[#181820] hover:bg-[#252532] text-[11px] font-black uppercase tracking-wider text-[#FAF7F2] cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveStockAdjustment}
                disabled={isSavingStock}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] disabled:opacity-50 text-[#0C0C0E] text-[11px] font-black uppercase tracking-wider cursor-pointer transition-colors shadow-xs"
              >
                {isSavingStock ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {isSavingStock
                  ? "Updating..."
                  : `Update (${stockAdjustDelta > 0 ? `+${stockAdjustDelta}` : stockAdjustDelta})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={() => {
            setShowCategoryModal(false);
            setEditingCategoryId(null);
            setEditCategoryName("");
            setNewCategoryName("");
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(23,23,23,0.15)] border border-[#C5A059]/30 w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between p-5 border-b border-[#C5A059]/25 bg-[#FAF8F5]">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#8A6815]" />
                <div>
                  <h3 className="text-base font-black text-[#171717] tracking-tight">
                    Manage Categories
                  </h3>
                  <p className="text-[10px] font-semibold text-zinc-500">
                    Create, rename or delete product categories
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryId(null);
                  setEditCategoryName("");
                  setNewCategoryName("");
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 transition-colors cursor-pointer shadow-xs"
                aria-label="Close dialog"
                title="Close (Esc)"
              >
                <X className="w-4.5 h-4.5 text-zinc-700" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Add new category */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                    New Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Sarees, Blouses, Fabrics"
                    className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-semibold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                    }}
                  />
                </div>
                <button
                  onClick={handleAddCategory}
                  disabled={isSavingCategory}
                  className="py-2.5 px-4 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 text-[#0C0C0E] rounded-lg font-black text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingCategory ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </button>
              </div>

              {/* Category list */}
              <div className="border border-[#C5A059]/25 rounded-lg divide-y divide-white/5 max-h-[320px] overflow-y-auto bg-[#181820]">
                {categories.length === 0 ? (
                  <div className="p-6 text-center text-xs font-semibold text-[#B8B5AE]">
                    No categories yet. Add your first one above.
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-2 p-2.5"
                    >
                      {editingCategoryId === cat.id ? (
                        <>
                          <input
                            type="text"
                            className="flex-1 bg-[#131317] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-lg px-3 py-1.5 text-sm font-semibold text-[#FAF7F2] focus:outline-none"
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEditCategory();
                            }}
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEditCategory}
                            disabled={isSavingCategory}
                            className="text-[10px] font-bold text-white bg-[#16A34A] hover:bg-[#15803D] px-2.5 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingCategoryId(null);
                              setEditCategoryName("");
                            }}
                            className="text-[10px] font-bold text-[#FAF7F2] bg-white/10 hover:bg-white/15 px-2.5 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-bold text-[#FAF7F2] truncate">
                            {cat.name}
                          </span>
                          <button
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditCategoryName(cat.name);
                            }}
                            className="text-[10px] font-bold text-[var(--accent)] hover:text-[#0C0C0E] hover:bg-[var(--accent)] border border-[var(--accent)]/30 px-2.5 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-[10px] font-bold text-[#EF4444] hover:text-white hover:bg-[#DC2626] border border-[#DC2626]/30 px-2.5 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Modal */}
      {showCatalogModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => {
            resetCatalogForm();
            setEditingCatalogId(null);
            setShowCatalogModal(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(23,23,23,0.15)] border border-[#C5A059]/30 w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="px-6 py-5 bg-[#FAF8F5] border-b border-[#C5A059]/25 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D4AF37]/15 border border-[#D4AF37]/30 rounded-xl flex items-center justify-center text-[#8A6815]">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#171717] tracking-tight">
                    {editingCatalogId
                      ? "Edit Catalog Item"
                      : newCatType === "SERVICE"
                        ? "Add New Service"
                        : "Add New Product"}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {editingCatalogId
                      ? "Modify item parameters"
                      : newCatType === "SERVICE"
                        ? "Register a chargeable service"
                        : "Set pricing, stock and category for this item"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCatalogForm();
                  setEditingCatalogId(null);
                  setShowCatalogModal(false);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 transition-colors cursor-pointer shadow-xs"
                aria-label="Close dialog"
                title="Close (Esc)"
              >
                <X className="w-4.5 h-4.5 text-zinc-700" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto bg-white">
              {/* Product ⇄ Service switch */}
              <div>
                <p className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Item Type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCatType("PRODUCT")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer border ${
                      newCatType === "PRODUCT"
                        ? "bg-[#D4AF37] text-[#171717] font-black border-[#C5A02E] shadow-sm"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-[#D4AF37] hover:text-[#171717]"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatType("SERVICE")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer border ${
                      newCatType === "SERVICE"
                        ? "bg-[#D4AF37] text-[#171717] font-black border-[#C5A02E] shadow-sm"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-[#D4AF37] hover:text-[#171717]"
                    }`}
                  >
                    <Scissors className="w-4 h-4" />
                    Service
                  </button>
                </div>
                <p className="text-[9px] text-[#B8B5AE]/80 font-semibold mt-1.5">
                  {newCatType === "SERVICE"
                    ? "Services = delivery, packing, add-ons and other chargeable work. No stock is tracked."
                    : "Products = physical items sold. Stock and low-stock alerts are tracked."}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                  {newCatType === "SERVICE" ? "Service Name" : "Product Name"}{" "}
                  <span className="text-[var(--accent)]">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    newCatType === "SERVICE"
                      ? "e.g., Alteration Charges / Delivery"
                      : "e.g., Designer Silk Saree / Bridal Blouse"
                  }
                  className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                  Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder={
                    newCatType === "SERVICE"
                      ? "e.g., Includes stitching and finishing"
                      : "e.g., Pure Kanjeevaram Silk, Pink & Gold Zari, Size 38"
                  }
                  className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-semibold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    list="catalog-category-list"
                    placeholder="e.g., Blouses, Sarees, Services"
                    className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-semibold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                    value={newCatCategory}
                    onChange={(e) => setNewCatCategory(e.target.value)}
                  />
                  <datalist id="catalog-category-list">
                    {categories.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  <p className="text-[9px] text-[#B8B5AE]/70 font-semibold mt-1">
                    Pick an existing category or type a new one (it will be added automatically)
                  </p>
                </div>

                {/* Stock alerts exist only for physical products */}
                {newCatType === "PRODUCT" && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="5"
                      className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                      value={newCatLowStock}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) =>
                        setNewCatLowStock(
                          e.target.value === "" ? "" : parseFloat(e.target.value),
                        )
                      }
                    />
                    <p className="text-[9px] text-[#B8B5AE]/70 font-semibold mt-1">
                      Warns you in Inventory when stock falls to this level.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                    {newCatType === "SERVICE" ? "Service Price (₹)" : "Original Price (₹)"}{" "}
                    <span className="text-[var(--accent)]">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                    value={newCatPrice}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      setNewCatPrice(
                        e.target.value === "" ? "" : parseFloat(e.target.value),
                      )
                    }
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                    value={newCatCost}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      setNewCatCost(
                        e.target.value === "" ? "" : parseFloat(e.target.value),
                      )
                    }
                  />
                </div>

                {newCatType === "PRODUCT" && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                      Current Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                      value={newCatStock}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) =>
                        setNewCatStock(
                          e.target.value === "" ? "" : parseFloat(e.target.value),
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <p className="text-[9px] text-[#B8B5AE]/70 font-semibold -mt-2">
                Cost price is for your records only — it is never used in billing.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    placeholder="5"
                    className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                    value={newCatGst}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      setNewCatGst(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                  />
                  <p className="text-[9px] text-[#B8B5AE]/70 font-semibold mt-1">
                    Pre-fills the GST % when this item is on a GST invoice.
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    className="w-full bg-[#181820] border border-[#C5A059]/25 hover:border-[var(--accent)] focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-semibold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors shadow-xs"
                    value={newCatHsn}
                    onChange={(e) => setNewCatHsn(e.target.value)}
                  />
                </div>
              </div>

              {/* Automatic offer — applied whenever the item is added to a bill */}
              <div className="border border-[#C5A059]/30 bg-[#181820] rounded-xl p-3.5 space-y-3">
                <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {newCatType === "SERVICE" ? "Service Offer" : "Product Special Offer"}{" "}
                  (Automatic on Billing)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                      Offer Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 10"
                      className="w-full bg-[#131317] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors"
                      value={newCatOfferPct}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        setNewCatOfferPct(
                          e.target.value === "" ? "" : parseFloat(e.target.value),
                        );
                        // The offer price is re-derived from the new %.
                        setNewCatOfferPrice("");
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-widest mb-1.5">
                      Discounted Offer Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder={
                        Number(newCatOfferPct) > 0
                          ? String(computedOfferPrice)
                          : "Offer Price"
                      }
                      className="w-full bg-[#131317] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none transition-colors"
                      value={newCatOfferPrice}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        setNewCatOfferPrice(
                          e.target.value === "" ? "" : parseFloat(e.target.value),
                        );
                        // A fixed offer price sets the % (derived on save).
                        setNewCatOfferPct("");
                      }}
                    />
                  </div>
                </div>
                <p className="text-[9px] text-[#B8B5AE]/70 font-semibold">
                  Whenever this {newCatType === "SERVICE" ? "service" : "product"} is
                  added to a bill, the offer price is applied automatically and shown
                  on the invoice.
                </p>
              </div>

              {/* Visibility in the Billing Panel */}
              <button
                type="button"
                onClick={() => setNewCatActive((prev) => !prev)}
                className="w-full flex items-center gap-3 border border-[#C5A059]/25 hover:border-[var(--accent)] rounded-xl px-3.5 py-3 cursor-pointer transition-colors text-left bg-[#181820]"
              >
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                    newCatActive
                      ? "bg-[var(--accent)] border-[var(--accent)] text-[#0C0C0E]"
                      : "bg-[#131317] border-[#C5A059]/25 text-transparent"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-[#FAF7F2]">
                  Active (visible in Billing Panel)
                </span>
              </button>

              <button
                onClick={addToCatalog}
                disabled={isSavingCatalog}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 text-[#0C0C0E] rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingCatalog ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PackagePlus className="w-4 h-4" />
                )}
                {editingCatalogId
                  ? "Save Changes"
                  : newCatType === "SERVICE"
                    ? "Save Service"
                    : "Save Product to Catalog"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile/Tablet Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* Collapsible Left Sidebar */}
      {/* Collapsible Left Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 bottom-0 left-0 bg-white border-r border-[#C5A059]/25 text-[#171717] flex flex-col justify-between h-screen shrink-0 shadow-lg z-40 transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-64 translate-x-0" : "w-0 min-w-0 border-r-0 -translate-x-64 overflow-hidden"}`}
      >
        <div className="w-64 flex flex-col justify-between h-full shrink-0 overflow-hidden relative">
          <div className="flex flex-col">
            {/* Header branding */}
            <div className="p-5 border-b border-[#C5A059]/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 aspect-square bg-white rounded-xl flex items-center justify-center shadow-xs overflow-hidden shrink-0 border border-[#D4AF37]/40 p-0.5">
                  <img
                    src={shopSettings.logo_data_url || "/nidulan-logo.jpeg"}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm tracking-tight text-[#171717] block leading-tight">
                      {shopSettings.shop_name || "NIDHULAN"}
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-amber-600 text-amber-700 bg-amber-50 tracking-widest">
                      ADMIN
                    </span>
                  </div>
                  <span className="text-[9px] text-[#A47B16] font-bold tracking-wider block mt-0.5">
                    {(!shopSettings.tagline || shopSettings.tagline === "POS & INVENTORY MANAGEMENT" || shopSettings.tagline === "Customer birthdays & retail POS")
                      ? "THE PRECIOUS PEARLS"
                      : shopSettings.tagline}
                  </span>
                </div>
              </div>

              {/* Collapse Button Inside Sidebar */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 transition-all cursor-pointer border border-zinc-200"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="px-3 py-5 space-y-1.5">
              {/* 1. Billing Panel */}
              <button
                onClick={() => {
                  setActiveTab("billing");
                  setCompletedBillData(null);
                  if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "billing"
                    ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                    : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                }`}
              >
                <Receipt className={`w-4.5 h-4.5 shrink-0 ${activeTab === "billing" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                Billing Panel
              </button>

              {/* 2. Inventory & Barcodes */}
              {role === "admin" && (
                <button
                  onClick={() => {
                    setActiveTab("inventory");
                    setCompletedBillData(null);
                    if (lowStockItems.length > 0) setShowLowStockAlarm(true);
                    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "inventory"
                      ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                      : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                  }`}
                >
                  <Boxes className={`w-4.5 h-4.5 shrink-0 ${activeTab === "inventory" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                  Inventory &amp; Barcodes
                  {lowStockItems.length > 0 && (
                    <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-black flex items-center justify-center bg-[#DC2626] text-white">
                      {lowStockItems.length}
                    </span>
                  )}
                </button>
              )}

              {/* 3. Advance Orders */}
              <button
                onClick={() => {
                  setActiveTab("advance");
                  setCompletedBillData(null);
                  if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer relative ${
                  activeTab === "advance"
                    ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                    : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                }`}
              >
                <Clock className={`w-4.5 h-4.5 shrink-0 ${activeTab === "advance" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                Advance Orders
                {advanceOrders.filter((a) => a.status === "PENDING" || a.status === "READY").length > 0 && (
                  <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-black flex items-center justify-center bg-[#D97706] text-white">
                    {advanceOrders.filter((a) => a.status === "PENDING" || a.status === "READY").length}
                  </span>
                )}
              </button>

              {/* 4. Birthdays */}
              <button
                onClick={() => {
                  setActiveTab("birthdays");
                  setCompletedBillData(null);
                  if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "birthdays"
                    ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                    : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                }`}
              >
                <Gift className={`w-4.5 h-4.5 shrink-0 ${activeTab === "birthdays" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                Birthdays
              </button>

              {/* 5. Expenses */}
              {role === "admin" && (
                <button
                  onClick={() => {
                    setActiveTab("expenses");
                    setCompletedBillData(null);
                    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "expenses"
                      ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                      : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                  }`}
                >
                  <Wallet className={`w-4.5 h-4.5 shrink-0 ${activeTab === "expenses" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                  Expenses
                </button>
              )}

              {/* 6. Order History */}
              <button
                onClick={() => {
                  setActiveTab("orders");
                  setCompletedBillData(null);
                  if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "orders"
                    ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                    : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                }`}
              >
                <History className={`w-4.5 h-4.5 shrink-0 ${activeTab === "orders" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                Order History
              </button>

              {/* 7. Analytics Dashboard */}
              {role === "admin" && (
                <button
                  onClick={() => {
                    setActiveTab("analytics");
                    setCompletedBillData(null);
                    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "analytics"
                      ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                      : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                  }`}
                >
                  <BarChart2 className={`w-4.5 h-4.5 shrink-0 ${activeTab === "analytics" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                  Analytics Dashboard
                </button>
              )}

              {/* 8. Coupons */}
              {role === "admin" && (
                <button
                  onClick={() => {
                    setActiveTab("coupons");
                    setCompletedBillData(null);
                    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "coupons"
                      ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                      : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                  }`}
                >
                  <Tag className={`w-4.5 h-4.5 shrink-0 ${activeTab === "coupons" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                  Coupons
                </button>
              )}

              {/* Attendance */}
              {(role === "admin" || role === "staff") && (
                <button
                  onClick={() => {
                    setActiveTab("attendance");
                    setCompletedBillData(null);
                    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "attendance"
                      ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                      : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                  }`}
                >
                  <UserCheck className={`w-4.5 h-4.5 shrink-0 ${activeTab === "attendance" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                  Attendance
                </button>
              )}

              {/* Settings */}
              {role === "admin" && (
                <button
                  onClick={() => {
                    setActiveTab("settings");
                    setCompletedBillData(null);
                    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "settings"
                      ? "bg-[#D4AF37] text-[#171717] font-black shadow-xs border border-[#C5A02E]"
                      : "text-zinc-700 hover:bg-[#FAF8F2] hover:text-[#8A6815] border border-transparent hover:border-[#D4AF37]/30"
                  }`}
                >
                  <Settings2 className={`w-4.5 h-4.5 shrink-0 ${activeTab === "settings" ? "text-[#171717]" : "text-[#8A6815]"}`} />
                  Settings
                </button>
              )}

              <div className="pt-4 border-t border-[#C5A059]/20 mt-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-[#171717] bg-[#F3F4F6] hover:bg-[#E5E7EB] hover:shadow-xs border border-zinc-300 hover:border-[#D4AF37] transition-all cursor-pointer"
                >
                  <LogOut className="w-4.5 h-4.5 text-[#8A6815]" />
                  Log Out
                </button>
              </div>
            </nav>
          </div>

          {/* Footer branding */}
          <div className="p-4 border-t border-[#C5A059]/20 bg-[#F9FAFB] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#8A6815] font-black text-xs uppercase">
              {role === "admin" ? "A" : "S"}
            </div>
            <div>
              <span className="text-xs font-bold text-[#171717] block uppercase tracking-wider">
                {role === "admin" ? "Admin Access" : "Staff Access"}
              </span>
              <span className="text-[9px] text-[#A47B16] font-bold tracking-wider block">
                NIDHULAN • TERMINAL
              </span>
            </div>
          </div>
        </div>
      </aside>
      {/* Main Content Area */}
      <main
        id="pos-main"
        ref={mainScrollRef}
        className="flex-1 h-screen overflow-y-auto overflow-x-hidden min-w-0 px-3 sm:px-8 lg:px-12 pt-3 pb-8 relative flex flex-col animate-in fade-in duration-300"
      >
        {/* Global Top Navbar */}
        <header className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center py-3.5 border-b border-[#C5A059]/20 w-full mb-6 gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="w-9 h-9 bg-white border border-[#C5A059]/30 hover:border-[#D4AF37] hover:bg-[#FAF8F2] rounded-lg flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
                title="Open Menu"
              >
                <Menu className="w-4.5 h-4.5 text-[#8A6815]" />
              </button>
            )}
            <div className="w-10 h-10 aspect-square bg-white rounded-xl border border-[#D4AF37]/40 p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img
                src={shopSettings.logo_data_url || "/nidulan-logo.jpeg"}
                alt={shopSettings.shop_name}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#171717] tracking-tight">
                {shopSettings.shop_name}
              </h1>
            </div>
          </div>

          {/* OFFLINE / ONLINE Toggle (only shown when billing tab is active) */}
          {activeTab === "billing" && (
            <div className="flex items-center bg-[#F3F4F6] border border-[#C5A059]/30 rounded-full p-1 shadow-xs">
              <button
                onClick={() => setIsOnline(false)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider transition-all uppercase cursor-pointer ${
                  !isOnline
                    ? "bg-white text-[#171717] border border-[#C5A059]/40 shadow-xs"
                    : "text-zinc-600 hover:text-[#171717]"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
                OFFLINE (POS)
              </button>
              <button
                onClick={() => setIsOnline(true)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider transition-all uppercase cursor-pointer ${
                  isOnline
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-zinc-600 hover:text-[#171717]"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white"></span>
                ONLINE ORDER
              </button>
            </div>
          )}
        </header>


        {/* Bill Generated — shown as a modal over the billing screen (not a new page) */}
        {completedBillData && (
          <div
            className="fixed inset-0 z-[390] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setCompletedBillData(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col gap-4 w-full max-w-[640px] min-w-0 bg-[#131317] border border-[#C5A059]/30 rounded-2xl shadow-2xl p-4 sm:p-5 max-h-[94vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            >
              {/* Header Bar */}
              <div className="flex justify-between items-center pb-2 border-b border-[#C5A059]/25">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-[#FAF7F2] tracking-tight">
                      Bill Generated
                    </h1>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${completedBillData.isGst ? "bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]" : "bg-white/10 text-[#FAF7F2]"}`}
                    >
                      {completedBillData.isGst ? "GST" : "Non-GST"}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono font-bold text-[var(--accent)] mt-0.5">
                    #{completedBillData.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletedBillData(null)}
                    className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                    aria-label="Close bill"
                    title="Close (Esc)"
                  >
                    <X className="w-4.5 h-4.5 text-zinc-700" />
                  </button>
                  <button
                    onClick={() => setCompletedBillData(null)}
                    className="bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] hover:brightness-110 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Sale
                  </button>
                </div>
              </div>

              {/* Payment Receipt Card */}
              <div className="bg-[#181820] rounded-xl p-4 sm:p-5 border border-[#C5A059]/25 shadow-xs space-y-3">
                <div className="text-[10px] font-extrabold text-[#B8B5AE] uppercase tracking-widest border-b border-white/5 pb-2 flex justify-between items-center">
                  <span>Payment Receipt</span>
                  <span className="text-[9px] font-black text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2 py-0.5 rounded">
                    {completedBillData.paymentMode === "SPLIT"
                      ? "Split · Cash + GPay"
                      : completedBillData.paymentMode === "GPAY"
                        ? "GPay"
                        : "Cash"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#B8B5AE]">
                    Grand Total
                  </span>
                  <span className="text-xl font-black text-[var(--accent)]">
                    ₹
                    {completedBillData.grandTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {completedBillData.paymentMode === "SPLIT" && (
                  <>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#B8B5AE]">
                        Paid by Cash
                      </span>
                      <span className="text-sm font-bold text-[#FAF7F2]">
                        ₹
                        {(completedBillData.splitCash || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#B8B5AE]">
                        Paid by GPay
                      </span>
                      <span className="text-sm font-bold text-[#FAF7F2]">
                        ₹
                        {(completedBillData.splitGpay || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#B8B5AE]">
                    {completedBillData.paymentMode === "GPAY"
                      ? "Paid via GPay"
                      : completedBillData.paymentMode === "SPLIT"
                        ? "Total Received"
                        : "Amount Received"}
                  </span>
                  <span className="text-sm font-black text-[#FAF7F2]">
                    ₹
                    {(
                      completedBillData.cashReceived ||
                      completedBillData.grandTotal
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Balance Returned Box — cash change only */}
                {completedBillData.paymentMode !== "GPAY" && (
                  <div className="bg-[#1F1F28] border border-[#C5A059]/25 rounded-lg p-3 sm:p-3.5 flex justify-between items-center mt-1">
                    <span className="text-xs font-bold text-[#FAF7F2]">
                      Balance Returned
                    </span>
                    <span className="text-base sm:text-lg font-black text-[var(--accent)]">
                      ₹
                      {Math.max(
                        0,
                        (completedBillData.cashReceived || 0) -
                          completedBillData.grandTotal,
                      ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => openPrintModal({ id: completedBillData.id, type: "invoice" })}
                  className="bg-[#181820] border border-[#C5A059]/25 hover:bg-[#252532] text-[#FAF7F2] py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Print Receipt
                </button>
                <button
                  onClick={() => setActiveInvoiceId(completedBillData.id)}
                  className="bg-[#181820] border border-[#C5A059]/25 hover:bg-[#252532] text-[#FAF7F2] py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[var(--accent)]" />
                  View
                </button>
                <button
                  onClick={() => resendWhatsApp(completedBillData)}
                  className="bg-[#10B981] hover:bg-[#059669] text-white py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                  WhatsApp Invoice
                </button>
              </div>

              {/* Items Sold Card */}
              <div className="bg-[#181820] rounded-xl p-4 sm:p-5 border border-[#C5A059]/25 shadow-xs space-y-3">
                <div className="text-[10px] font-extrabold text-[#B8B5AE] uppercase tracking-widest border-b border-white/5 pb-2">
                  Items Sold
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {completedBillData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-xs py-1 border-b border-white/5 last:border-none"
                    >
                      <span className="font-semibold text-[#FAF7F2]">
                        {item.name}{" "}
                        <span className="text-[#B8B5AE] font-bold text-[10px] ml-1">
                          × {item.qty} {item.qty === 1 ? "piece" : "pieces"}
                        </span>
                      </span>
                      <span className="font-bold text-[#FAF7F2]">
                        ₹
                        {(item.price * item.qty).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Advance Order created — shareable receipt modal ─────── */}
        {advanceReceipt && (
          <div
            className="fixed inset-0 z-[395] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => {
              setAdvanceReceipt(null);
              setActiveTab("advance");
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col gap-4 w-full max-w-[520px] min-w-0 bg-[#131317] border border-[#C5A059]/30 rounded-2xl shadow-2xl p-4 sm:p-5 max-h-[94vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#C5A059]/25">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-[#FAF7F2] tracking-tight">
                      Advance Order Saved
                    </h1>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#FEF3C7]/15 border border-[#FEF3C7]/30 text-[#F59E0B]">
                      Deposit
                    </span>
                  </div>
                  <p className="text-[11px] font-mono font-bold text-[var(--accent)] mt-0.5">
                    #{advanceReceipt.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceReceipt(null);
                      setActiveTab("advance");
                    }}
                    className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                    aria-label="Close receipt"
                    title="Close (Esc)"
                  >
                    <X className="w-4.5 h-4.5 text-zinc-700" />
                  </button>
                  <button
                    onClick={() => {
                      setAdvanceReceipt(null);
                      setActiveTab("advance");
                    }}
                    className="bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] hover:brightness-110 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Sale
                  </button>
                </div>
              </div>

              {/* Deposit Receipt Card */}
              <div className="bg-[#181820] rounded-xl p-4 sm:p-5 border border-[#C5A059]/25 shadow-xs space-y-3">
                <div className="text-[10px] font-extrabold text-[#B8B5AE] uppercase tracking-widest border-b border-white/5 pb-2">
                  Advance Receipt — {advanceReceipt.customerName}
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#B8B5AE]">Order Total</span>
                  <span className="text-lg font-black text-[#FAF7F2]">
                    ₹{advanceReceipt.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#B8B5AE]">Deposit Paid</span>
                  <span className="text-sm font-black text-[#34D399]">
                    ₹{advanceReceipt.deposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-red-950/25 border border-red-500/30 rounded-lg p-3 sm:p-3.5 flex justify-between items-center mt-1">
                  <span className="text-xs font-bold text-red-400">Balance Due</span>
                  <span className="text-base sm:text-lg font-black text-red-400">
                    ₹{advanceReceipt.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => printAdvanceReceipt(advanceReceipt.id)}
                  className="bg-[#181820] border border-[#C5A059]/25 hover:bg-[#252532] text-[#FAF7F2] py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Print Receipt
                </button>
                <button
                  onClick={() => shareAdvanceReceiptWhatsApp(advanceReceipt)}
                  className="bg-[#10B981] hover:bg-[#059669] text-white py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={() => {
                    setAdvanceReceipt(null);
                    setActiveTab("advance");
                  }}
                  className="bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] hover:brightness-110 py-2.5 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Sale
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "billing" && (
            <div className="flex-1 flex flex-col gap-6 max-w-[1400px] min-w-0 mx-auto w-full">
              {/* Subheader Accent Bar and Title */}
              <div className="flex justify-between items-center py-2 border-b border-[#C5A059]/20 w-full">
                <div className="flex items-center gap-4">
                  <span className="w-1.5 h-8 bg-[var(--accent)] rounded-full"></span>
                  <div>
                    <h2 className="text-xl font-black text-[#FAF7F2] tracking-tight">
                      POS Billing Panel
                    </h2>
                    <p className="text-[11px] text-[#FAF7F2]/65 font-semibold mt-0.5">
                      Quick Invoice generator & database synced checkout
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid Layout */}
              <div className="flex flex-col lg:flex-row gap-8 w-full">
                {/* Left Column */}
                <div className="w-full lg:w-[60%] xl:w-[65%] flex flex-col gap-6 h-auto lg:h-full">
                  {/* Customer Details */}
                  <div className="flex-shrink-0 bg-[#131317] border border-[#C5A059]/25 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-300 relative overflow-hidden group">
                    <h2 className="text-base font-black flex items-center gap-3 text-[#FAF7F2] mb-6 tracking-tight">
                      <User className="w-4 h-4 text-[var(--accent)]" />
                      Customer Details
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
                      <div>
                        <label className="block text-[10px] font-bold text-[#FAF7F2]/75 uppercase tracking-[0.15em] mb-2">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          placeholder="Walk-in Customer"
                          className="w-full bg-[#181820] border border-[#C5A059]/30 hover:border-[#C5A059]/50 focus:border-[var(--accent)] focus:bg-[#1E1E26] rounded-lg px-4 py-2.5 text-[#FAF7F2] text-sm font-semibold focus:outline-none transition-colors placeholder:text-[#FAF7F2]/30 shadow-inner"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#FAF7F2]/75 uppercase tracking-[0.15em] mb-2">
                          Mobile Number (WhatsApp)
                        </label>
                        <input
                          type="tel"
                          placeholder="Enter 10-digit number"
                          maxLength={10}
                          className="w-full bg-[#181820] border border-[#C5A059]/30 hover:border-[#C5A059]/50 focus:border-[var(--accent)] focus:bg-[#1E1E26] rounded-lg px-4 py-2.5 text-[#FAF7F2] text-sm font-semibold focus:outline-none transition-colors placeholder:text-[#FAF7F2]/30 shadow-inner"
                          value={customerPhone}
                          onChange={(e) =>
                            setCustomerPhone(
                              e.target.value.replace(/\D/g, "").slice(0, 10),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#FAF7F2]/75 uppercase tracking-[0.15em] mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                            Bill Date
                          </span>
                          <span className="text-[9px] text-[var(--accent)] font-extrabold uppercase">
                            Custom / Past
                          </span>
                        </label>
                        <input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          className="w-full bg-[#181820] border border-[#C5A059]/30 hover:border-[#C5A059]/50 focus:border-[var(--accent)] focus:bg-[#1E1E26] rounded-lg px-4 py-2.5 text-[#FAF7F2] text-sm font-bold focus:outline-none transition-colors cursor-pointer shadow-inner"
                          value={customOrderDate}
                          onChange={(e) => setCustomOrderDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-6">
                      <label className="block text-[10px] font-bold text-[#FAF7F2]/75 uppercase tracking-[0.15em] mb-2">
                        Customer Address (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter full address"
                        className="w-full bg-[#181820] border border-[#C5A059]/30 hover:border-[#C5A059]/50 focus:border-[var(--accent)] focus:bg-[#1E1E26] rounded-lg px-4 py-2.5 text-[#FAF7F2] text-sm font-semibold focus:outline-none transition-colors placeholder:text-[#FAF7F2]/30 shadow-inner"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Order Items Ledger */}
                  <div className="flex-1 bg-[#131317] border border-[#C5A059]/25 rounded-xl shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-300 flex flex-col overflow-visible">
                    <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-transparent gap-4">
                      <h2 className="text-base font-black flex items-center gap-3 text-[#FAF7F2] tracking-tight">
                        <Receipt className="w-4 h-4 text-[var(--accent)]" />
                        Order Items
                      </h2>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                        <button
                          onClick={clearOrder}
                          className="text-[10px] font-bold text-[#FAF7F2]/80 bg-[#181820] hover:bg-[#202028] border border-[#C5A059]/25 px-4 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" /> Clear Order
                        </button>
                        <button
                          onClick={() => {
                            resetCatalogForm();
                            setNewCatType("SERVICE");
                            setCatalogTargetRowId(null);
                            setShowCatalogModal(true);
                          }}
                          className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 px-4 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Scissors className="w-3.5 h-3.5" /> Add Service
                        </button>
                        <button
                          onClick={() => {
                            resetCatalogForm();
                            setNewCatType("PRODUCT");
                            setCatalogTargetRowId(null);
                            setShowCatalogModal(true);
                          }}
                          className="text-[10px] font-bold text-[#FAF7F2] bg-[#181820] hover:bg-[#202028] border border-[#C5A059]/25 px-4 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <PackagePlus className="w-3.5 h-3.5 text-[var(--accent)]" />{" "}
                          Add To Catalog
                        </button>
                        <button
                          onClick={addItem}
                          className="text-[10px] font-bold text-[#0C0C0E] bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 border border-[#E5C378] px-4 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer font-black shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Custom Item
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 px-4 sm:px-6 pb-4 sm:pb-6 overflow-visible">
                      {/* Table Header */}
                      <div className="hidden sm:grid grid-cols-12 gap-4 pb-3 border-b border-[#C5A059]/20 text-[9px] font-black text-[#FAF7F2]/70 uppercase tracking-[0.15em] mt-4 mb-2">
                        <div className="col-span-7 pl-2">
                          Item Name / Description
                        </div>
                        <div className="col-span-2 text-center">Price (₹)</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-4 pt-2 overflow-visible">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 items-stretch sm:items-center group border-b border-transparent pb-4 pt-1 overflow-visible relative"
                          >
                            {/* Item Name / Description Input + Catalog Button */}
                            <div className="col-span-7 relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                              <input
                                type="text"
                                placeholder="Type custom item name..."
                                className="flex-1 bg-[#181820] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-lg px-4 py-2 text-xs font-semibold text-[#FAF7F2] focus:outline-none transition-colors placeholder:text-[#FAF7F2]/30 min-w-0"
                                value={item.name}
                                onChange={(e) =>
                                  updateItem(item.id, "name", e.target.value)
                                }
                              />
                              <button
                                onClick={() => {
                                  setActiveCatalogRowId(
                                    activeCatalogRowId === item.id
                                      ? null
                                      : item.id,
                                  );
                                  setCatalogSearch("");
                                }}
                                className="flex items-center justify-center gap-1.5 border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 px-3 py-2 rounded-lg text-[10px] font-bold transition-colors uppercase tracking-wider shrink-0 cursor-pointer w-full sm:w-auto"
                              >
                                <List className="w-3.5 h-3.5" />
                                Catalog
                              </button>

                              {/* Automatic offer applied to this line */}
                              {(item.offerPct ?? 0) > 0 && (
                                <span className="absolute -top-1 right-0 sm:right-[calc(100%+0.5rem)] text-[9px] font-black uppercase tracking-widest text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/35 px-1.5 py-0.5 rounded">
                                  Offer −{item.offerPct}%
                                  {item.originalPrice
                                    ? ` · ₹${item.originalPrice.toLocaleString("en-IN")} → ₹${item.price.toLocaleString("en-IN")}`
                                    : " applied"}
                                </span>
                              )}

                              {/* Catalog Dropdown Popover */}
                              {activeCatalogRowId === item.id && (
                                <div className="absolute z-[80] top-full left-0 mt-1 w-full sm:w-80 max-w-[calc(100vw-2.5rem)] bg-[#131317] border border-[#C5A059]/40 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                  <div className="p-2 border-b border-[#C5A059]/20 bg-[#181820] space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <input
                                        type="text"
                                        placeholder="Search catalog items..."
                                        className="w-full bg-[#141419] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-md px-3 py-1.5 text-xs font-semibold text-[#FAF7F2] placeholder:text-[#FAF7F2]/30 focus:outline-none transition-colors"
                                        value={catalogSearch}
                                        onChange={(e) =>
                                          setCatalogSearch(e.target.value)
                                        }
                                        autoFocus
                                      />
                                      <button
                                        onClick={() =>
                                          setActiveCatalogRowId(null)
                                        }
                                        className="text-[#FAF7F2]/60 hover:text-[var(--accent)] cursor-pointer"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <select
                                      value={activeCategory}
                                      onChange={(e) =>
                                        setActiveCategory(e.target.value)
                                      }
                                      className="w-full bg-[#141419] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-md px-3 py-1.5 text-xs font-bold text-[#FAF7F2] focus:outline-none transition-colors cursor-pointer"
                                    >
                                      <option value="ALL">All categories</option>
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.name}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto">
                                    {(() => {
                                      const list = catalog.filter(
                                        (c) =>
                                          (activeCategory === "ALL" ||
                                            (c.category || "General") ===
                                              activeCategory) &&
                                          (c.isActive === undefined ||
                                            c.isActive) &&
                                          c.name
                                            .toLowerCase()
                                            .includes(
                                              catalogSearch.toLowerCase(),
                                            ),
                                      );
                                      return list.length > 0 ? (
                                        list.map((catItem) => {
                                          return (
                                            <div
                                              key={catItem.id}
                                              className="w-full flex items-center border-b border-transparent last:border-0 hover:bg-[#FFFFFF] transition-colors"
                                            >
                                              <button
                                                className="flex-1 text-left px-4 py-2.5 flex flex-col cursor-pointer"
                                                onClick={() => {
                                                  updateItem(
                                                    item.id,
                                                    "name",
                                                    catItem.name,
                                                  );
                                                  updateItem(
                                                    item.id,
                                                    "desc",
                                                    catItem.desc || "",
                                                  );
                                                  updateItem(
                                                    item.id,
                                                    "product_id",
                                                    catItem.productId ||
                                                      catItem.id,
                                                  );
                                                  const onOffer =
                                                    (catItem.offerPct ?? 0) > 0 &&
                                                    (catItem.offerPrice ?? 0) > 0;
                                                  if (catItem.price !== undefined) {
                                                    updateItem(
                                                      item.id,
                                                      "price",
                                                      onOffer
                                                        ? (catItem.offerPrice as number)
                                                        : catItem.price,
                                                    );
                                                  }
                                                  updateItem(
                                                    item.id,
                                                    "offerPct",
                                                    onOffer
                                                      ? (catItem.offerPct as number)
                                                      : 0,
                                                  );
                                                  updateItem(
                                                    item.id,
                                                    "originalPrice",
                                                    onOffer ? catItem.price : undefined,
                                                  );
                                                  setActiveCatalogRowId(null);
                                                }}
                                              >
                                                <div className="flex justify-between items-center w-full">
                                                  <span className="text-xs font-bold text-[#FAF7F2] flex items-center gap-1.5">
                                                    {catItem.name}
                                                    {catItem.itemType === "SERVICE" && (
                                                      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--accent)] bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-1.5 py-0.5 rounded">
                                                        Service
                                                      </span>
                                                    )}
                                                    {(catItem.offerPct ?? 0) > 0 && (
                                                      <span className="text-[8px] font-black uppercase tracking-widest text-[#34D399] bg-[#34D399]/15 border border-[#34D399]/30 px-1.5 py-0.5 rounded">
                                                        −{catItem.offerPct}%
                                                      </span>
                                                    )}
                                                  </span>
                                                </div>
                                                {catItem.desc && (
                                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B8B5AE] mt-0.5">
                                                    {catItem.desc}
                                                  </span>
                                                )}
                                                {catItem.price !==
                                                  undefined && (
                                                  <span className="text-[10px] font-bold text-[var(--accent)] mt-0.5">
                                                    ₹{catItem.price}
                                                  </span>
                                                )}
                                              </button>
                                              <div className="flex shrink-0">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditCatalog(
                                                      catItem,
                                                      item.id,
                                                    );
                                                    setActiveCatalogRowId(null);
                                                  }}
                                                  className="px-3 py-2.5 text-[#B8B5AE] hover:text-[var(--accent)] transition-colors cursor-pointer"
                                                  title="Edit item"
                                                >
                                                  <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (
                                                      window.confirm(
                                                        "Are you sure you want to delete this item from the catalog?",
                                                      )
                                                    ) {
                                                      deleteFromCatalog(
                                                        catItem.id,
                                                      );
                                                    }
                                                  }}
                                                  className="px-3 py-2.5 text-[#B8B5AE] hover:text-red-400 transition-colors cursor-pointer"
                                                  title="Delete item"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="px-4 py-4 text-center">
                                          <div className="text-xs text-[#FAF7F2] font-semibold mb-2">
                                            No items match &quot;{catalogSearch}&quot;
                                          </div>
                                          <button
                                            onClick={() => {
                                              setNewCatName(catalogSearch);
                                              setCatalogTargetRowId(item.id);
                                              setShowCatalogModal(true);
                                              setActiveCatalogRowId(null);
                                            }}
                                            className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 px-3 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer"
                                          >
                                            + Add to Catalog
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Price, Qty, and Trash (Grid on mobile to prevent overflow, grid on desktop) */}
                            <div className="col-span-5 grid grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-5 gap-2 sm:gap-4 w-full items-center">
                              {/* Price Input */}
                              <div className="sm:col-span-2 flex items-center gap-1.5 sm:gap-2 sm:block min-w-0 w-full">
                                <span className="text-[10px] font-bold text-[#FAF7F2]/75 uppercase sm:hidden shrink-0">
                                  Price:
                                </span>
                                <input
                                  type="number"
                                  className="w-full min-w-0 text-center bg-[#181820] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-lg px-2 sm:px-3 py-2 text-xs font-semibold text-[#FAF7F2] focus:outline-none transition-colors"
                                  value={item.price || ""}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "price",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0"
                                />
                              </div>

                              {/* Quantity Counter */}
                              <div className="sm:col-span-2 flex items-center justify-end gap-1.5 sm:gap-2 sm:block shrink-0">
                                <span className="text-[10px] font-bold text-[#FAF7F2]/75 uppercase sm:hidden shrink-0">
                                  Qty:
                                </span>
                                <div className="flex items-center border border-[#C5A059]/30 bg-[#181820] rounded-lg overflow-hidden h-[36px] max-w-[90px] shrink-0">
                                  <button
                                    className="w-7 h-full flex items-center justify-center text-[#FAF7F2]/80 hover:bg-[#252530] hover:text-[#FAF7F2] font-bold text-xs transition-colors cursor-pointer"
                                    onClick={() =>
                                      handleQtyChange(item.id, item.qty - 1)
                                    }
                                  >
                                    −
                                  </button>
                                  <span className="flex-1 text-center font-bold text-xs text-[#FAF7F2] min-w-[18px]">
                                    {item.qty}
                                  </span>
                                  <button
                                    className="w-7 h-full flex items-center justify-center text-[#FAF7F2]/80 hover:bg-[#252530] hover:text-[#FAF7F2] font-bold text-xs transition-colors cursor-pointer"
                                    onClick={() =>
                                      handleQtyChange(item.id, item.qty + 1)
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Trash Button */}
                              <div className="sm:col-span-1 flex justify-end shrink-0">
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="text-[#FAF7F2]/50 hover:text-[#EF4444] hover:bg-[#252530] p-2 rounded-lg border border-[#C5A059]/25 transition-colors flex items-center justify-center cursor-pointer"
                                  title="Remove Item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>{" "}
                {/* Right Column - Premium Order Panel */}
                <div className="w-full lg:w-[40%] xl:w-[35%] flex flex-col shrink-0 bg-[#131317] text-[#FAF7F2] border border-[#C5A059]/25 rounded-2xl shadow-xl lg:sticky lg:top-28 lg:self-start transition-all duration-500 overflow-hidden group">
                  <div className="p-4 sm:p-6 pb-4 border-b border-[#C5A059]/20 flex justify-between items-center bg-[#181820]">
                    <h2 className="text-base font-black flex items-center gap-3 text-[#FAF7F2] tracking-tight">
                      <ShoppingBag className="w-4 h-4 text-[var(--accent)]" />
                      Current Order
                    </h2>
                    <span
                      className={`flex items-center gap-2 bg-[#101015] border border-[#C5A059]/30 px-3 py-1 rounded-full font-bold text-[9px] ${isOnline ? "text-[#34D399]" : "text-[#FAF7F2]/80"}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#34D399]" : "bg-[var(--accent)]"}`}
                      ></span>
                      {isOnline ? "ONLINE ORDER" : "OFFLINE (POS)"}
                    </span>
                  </div>

                  <div className="p-4 sm:p-6 space-y-5">
                    {/* Customer Details Box */}
                    <div className="bg-[#181820] border border-[#C5A059]/20 rounded-xl p-4 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#FAF7F2]/65 font-semibold">
                          SOURCE
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest border ${isOnline ? "border-[#00A86B] text-[#34D399] bg-[#00A86B]/15" : "border-[#C5A059]/40 text-[var(--accent)] bg-[var(--accent)]/10"}`}
                        >
                          {isOnline ? "ONLINE" : "OFFLINE"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#FAF7F2]/65 font-semibold">
                          CUSTOMER
                        </span>
                        <span className="font-bold text-[#FAF7F2] truncate max-w-[65%] text-right">
                          {customerName || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#FAF7F2]/65 font-semibold">
                          PHONE
                        </span>
                        <span className="font-bold text-[#FAF7F2]">
                          {customerPhone || "-"}
                        </span>
                      </div>

                      {/* Items summary list inside customer details box */}
                      <div className="border-t border-[#C5A059]/20 pt-2.5 mt-2.5">
                        {items.filter((i) => i.name).length === 0 ? (
                          <div className="text-center py-2 text-[10px] text-[#FAF7F2]/45 font-semibold italic">
                            No items added yet
                          </div>
                        ) : (
                          <div className="max-h-24 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
                            {items
                              .filter((i) => i.name)
                              .map((item) => (
                                <div
                                  key={item.id}
                                  className="flex justify-between items-center text-[10px]"
                                >
                                  <span className="text-[#FAF7F2]/85 font-semibold">
                                    {item.qty}x {item.name}
                                  </span>
                                  <span className="font-bold text-[var(--accent)]">
                                    ₹
                                    {(item.price * item.qty).toLocaleString(
                                      undefined,
                                      { minimumFractionDigits: 2 },
                                    )}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Discounts section */}
                    <div className="space-y-4 pt-1">
                      {/* Manual Discount */}
                      <div>
                        <label className="block text-[10px] font-bold text-[#FAF7F2]/70 uppercase tracking-[0.1em] mb-1.5">
                          Manual Discount
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={discountType}
                            onChange={(e) => {
                              setDiscountType(
                                e.target.value as "fixed" | "percent",
                              );
                              setSelectedCoupon("none");
                            }}
                            className="bg-[#181820] border border-[#C5A059]/30 text-[#FAF7F2] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                          >
                            <option value="fixed">₹</option>
                            <option value="percent">%</option>
                          </select>
                          <input
                            type="number"
                            className="flex-1 text-right bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-xs font-bold text-[#FAF7F2] placeholder:text-[#FAF7F2]/30 focus:outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                            value={discountValue || ""}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) => {
                              setDiscountValue(parseFloat(e.target.value) || 0);
                              setSelectedCoupon("none");
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Subtotal & Delivery Breakdown */}
                      <div className="space-y-2.5 pt-2 border-t border-[#C5A059]/20">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-[#FAF7F2]/75">
                            Subtotal (
                            {items
                              .filter((i) => i.name)
                              .reduce((sum, i) => sum + i.qty, 0)}{" "}
                            items){applyGST && <span className="text-[9px] font-bold text-[var(--accent)] uppercase"> excl. GST</span>}
                          </span>
                          <span className="font-bold text-[#FAF7F2]">
                            ₹
                            {subtotal.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-[#FAF7F2]/75">Delivery</span>
                          <input
                            type="number"
                            className="w-20 text-right bg-[#181820] border border-[#C5A059]/30 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#FAF7F2] placeholder:text-[#FAF7F2]/30 focus:outline-none focus:border-[var(--accent)]"
                            value={deliveryFee || ""}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) =>
                              setDeliveryFee(parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                          />
                        </div>

                        {/* Bill Type: GST Invoice vs Non-GST Bill */}
                        <div className="pt-2 space-y-2.5">
                          <div className="flex items-center bg-[#131317] border border-[#C5A059]/30 rounded-full p-1 w-full">
                            <button
                              type="button"
                              onClick={() => setGstBill(false)}
                              className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                                !applyGST
                                  ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black border border-[#E5C378] shadow-sm"
                                  : "text-[#FAF7F2]/70 hover:text-[#FAF7F2]"
                              }`}
                            >
                              Non-GST Bill
                            </button>
                            <button
                              type="button"
                              onClick={() => setGstBill(true)}
                              className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                                applyGST
                                  ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black border border-[#E5C378] shadow-sm"
                                  : "text-[#FAF7F2]/70 hover:text-[#FAF7F2]"
                              }`}
                            >
                              GST Invoice
                            </button>
                          </div>
                          {applyGST && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-[#FAF7F2] uppercase tracking-wider">
                                  GST <span className="text-[9px] font-bold text-[var(--accent)]">(+ added)</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      className="w-14 text-right bg-[#181820] border border-[#C5A059]/30 rounded-lg px-2 py-1 text-xs font-bold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      value={gstPercentage || ""}
                                      onChange={(e) =>
                                        setGstPercentage(
                                          parseFloat(e.target.value) || 0,
                                        )
                                      }
                                      placeholder="%"
                                    />
                                    <span className="text-xs font-bold text-[#FAF7F2]">
                                      %
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold text-[var(--accent)] w-20 text-right">
                                    ₹
                                    {gstAmount.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </div>
                              {gstAmount > 0 && (
                                <div className="flex justify-between text-[10px] font-semibold text-[#B8B5AE] pt-0.5">
                                  <span>CGST ({(gstPercentage / 2).toFixed(1).replace(/\.0$/, "")}%): ₹{(gstAmount / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  <span>SGST ({(gstPercentage / 2).toFixed(1).replace(/\.0$/, "")}%): ₹{(gstAmount / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Financial Option — payment method */}
                      <div className="pt-2 space-y-1.5">
                        <span className="block text-[9px] font-bold text-[#FAF7F2]/70 uppercase tracking-wider">
                          Financial Option
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {POS_PAYMENT_MODES.map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setPaymentMode(mode)}
                              className={`py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer border ${
                                paymentMode === mode
                                  ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black border-[#E5C378] shadow-[0_2px_10px_rgba(197,160,89,0.25)]"
                                  : "bg-[#181820] text-[#FAF7F2]/80 border-[#C5A059]/25 hover:border-[var(--accent)] hover:text-[#FAF7F2]"
                              }`}
                            >
                              {mode === "GPAY" ? "GPay" : mode === "SPLIT" ? "Split" : mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Grand Total */}
                      <div className="flex justify-between items-center text-sm font-bold pt-4 border-t border-[#C5A059]/20">
                        <span className="text-[#FAF7F2] uppercase tracking-wider font-extrabold">
                          Grand Total
                        </span>
                        <span className="text-xl text-[var(--accent)] font-black">
                          ₹
                          {grandTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {/* Payment inputs — per selected method */}
                      {paymentMode === "SPLIT" ? (
                        <div className="bg-[#181820] border border-[#C5A059]/25 rounded-xl p-4 mt-2 space-y-3">
                          <span className="block text-[9px] font-bold text-[#FAF7F2]/70 uppercase tracking-wider">
                            Split Payment
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-[#FAF7F2]/75 mb-1.5">
                                Cash (₹)
                              </label>
                              <input
                                type="number"
                                className="w-full bg-[#141419] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-lg px-3 py-2 text-base font-bold text-[#FAF7F2] placeholder:text-[#FAF7F2]/30 focus:outline-none transition-colors"
                                value={splitCash || ""}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) =>
                                  setSplitCash(parseFloat(e.target.value) || 0)
                                }
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#FAF7F2]/75 mb-1.5">
                                GPay (₹)
                              </label>
                              <input
                                type="number"
                                className="w-full bg-[#141419] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-lg px-3 py-2 text-base font-bold text-[#FAF7F2] placeholder:text-[#FAF7F2]/30 focus:outline-none transition-colors"
                                value={splitGpay || ""}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) =>
                                  setSplitGpay(parseFloat(e.target.value) || 0)
                                }
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-[#C5A059]/20">
                            <span className="font-bold text-[#FAF7F2]/75 uppercase tracking-[0.05em]">
                              Total Received
                            </span>
                            <span className="font-black text-sm text-[var(--accent)]">
                              ₹
                              {(splitCash + splitGpay).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          {splitCash + splitGpay < grandTotal ? (
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-[#FAF7F2]/75 uppercase tracking-[0.05em]">
                                Balance Remaining
                              </span>
                              <span className="font-black text-sm text-[#EF4444]">
                                ₹
                                {(grandTotal - (splitCash + splitGpay)).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-[#FAF7F2]/75 uppercase tracking-[0.05em]">
                                Change to Return
                              </span>
                              <span className="font-black text-sm text-[#10B981]">
                                ₹
                                {(splitCash + splitGpay - grandTotal).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-[#181820] border border-[#C5A059]/25 rounded-xl p-4 mt-2">
                          <span className="block text-[9px] font-bold text-[#FAF7F2]/70 uppercase tracking-wider mb-0.5">
                            {paymentMode === "CASH" ? "Cash Payment" : "GPay Payment"}
                          </span>
                          <label className="block text-[10px] font-bold text-[#FAF7F2]/75 mb-2.5">
                            {paymentMode === "CASH" ? "Amount Received (₹)" : "GPay Amount (₹)"}
                          </label>
                          <input
                            type="number"
                            className="w-full bg-[#141419] border border-[#C5A059]/30 focus:border-[var(--accent)] rounded-lg px-3 py-2 text-base font-bold text-[#FAF7F2] placeholder:text-[#FAF7F2]/30 focus:outline-none transition-colors"
                            value={cashReceived || ""}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) =>
                              setCashReceived(parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      {/* Change Return — cash only */}
                      {paymentMode === "CASH" && cashReceived > 0 && (
                        <div className="flex justify-between items-center bg-[#181820] border border-[#C5A059]/25 rounded-lg p-3 text-xs">
                          <span className="font-bold text-[#FAF7F2]/75 uppercase tracking-[0.05em]">
                            Change Return
                          </span>
                          <span
                            className={`font-black text-sm ${cashReceived >= grandTotal ? "text-[#10B981]" : "text-[#EF4444]"}`}
                          >
                            ₹
                            {Math.max(
                              0,
                              cashReceived - grandTotal,
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      )}

                      {/* Complete Sale — saves the order to the database */}
                      <button
                        onClick={() => completeSale()}
                        disabled={isSubmittingOrder}
                        className={`w-full mt-2 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 text-[#0C0C0E] py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_6px_22px_rgba(197,160,89,0.32)] border border-[#E5C378] ${
                          isSubmittingOrder
                            ? "opacity-60 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                      >
                        {isSubmittingOrder ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing Sale...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Complete Sale</span>
                          </>
                        )}
                      </button>

                      {/* Save as Advance Order — partial payment hold, not counted as revenue */}
                      <button
                        onClick={openAdvanceSaveModal}
                        disabled={isSubmittingOrder}
                        className={`w-full mt-2 bg-[#1A1A22] border border-[#D97706]/40 hover:bg-[#252530] text-[#F59E0B] py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.12em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                          isSubmittingOrder ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>Save as Advance Order</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* ── Save-as-Advance modal (opens from billing) ─────────── */}
        {showAdvanceSaveModal && (
          <div
            className="fixed inset-0 z-[400] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowAdvanceSaveModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#131317] border border-[#C5A059]/30 rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#C5A059]/25">
                <div>
                  <h3 className="text-lg font-black text-[#FAF7F2] tracking-tight">Save as Advance Order</h3>
                  <p className="text-[10px] font-bold text-[#C5A059] mt-0.5 uppercase tracking-wider">Not counted as revenue until fully paid</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanceSaveModal(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  aria-label="Close dialog"
                  title="Close (Esc)"
                >
                  <X className="w-4.5 h-4.5 text-zinc-700" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="bg-[#181820] border border-[#C5A059]/25 rounded-lg p-3">
                  <div className="flex justify-between text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider">
                    <span>Order Total</span>
                    <span className="text-[#FAF7F2] font-black">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1.5">Deposit Amount (₹) *</label>
                  <input
                    type="number"
                    value={advDeposit}
                    onChange={(e) => setAdvDeposit(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3 py-2.5 text-sm font-bold text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none"
                    placeholder="0.00"
                    autoFocus
                  />
                  {typeof advDeposit === "number" && advDeposit > 0 && (
                    <p className="mt-1.5 text-[10px] font-bold text-[var(--accent)]">
                      Balance due: ₹{Math.max(0, grandTotal - Number(advDeposit)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1.5">Deposit Payment Mode</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ORDER_PAYMENT_MODES.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setAdvDepositPaymentMode(mode)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                          advDepositPaymentMode === mode ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black border-[var(--accent)]" : "bg-[#181820] text-[#B8B5AE] border-[#C5A059]/20 hover:border-[var(--accent)]"
                        }`}
                      >
                        {mode === "GPAY" ? "GPay" : mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1.5">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={advDeliveryDate}
                    onChange={(e) => setAdvDeliveryDate(e.target.value)}
                    className="w-full bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3 py-2 text-sm font-bold text-[#FAF7F2] focus:outline-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                  <textarea
                    value={advNotes}
                    onChange={(e) => setAdvNotes(e.target.value)}
                    className="w-full bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3 py-2 text-sm text-[#FAF7F2] placeholder-[#B8B5AE]/40 focus:outline-none min-h-[60px] resize-none"
                    placeholder="e.g. Colour preference, follow-up needed..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanceSaveModal(false)}
                    className="w-1/3 py-3 rounded-lg font-bold text-[11px] uppercase tracking-wider border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAdvanceOrder}
                    disabled={isSavingAdvance}
                    className={`flex-1 py-3 rounded-lg font-black text-[11px] uppercase tracking-[0.1em] flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] hover:brightness-110 shadow-md transition-all ${
                      isSavingAdvance ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    {isSavingAdvance ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></>) : (<><Clock className="w-4 h-4" /><span>Confirm Advance Order</span></>)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Advance Order VIEW / RECEIVE-BALANCE dialog ────────── */}
        {selectedAdvance && advanceViewMode && (
          <div
            className="fixed inset-0 z-[400] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={closeAdvanceDialog}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#131317] border border-[#C5A059]/30 rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#C5A059]/25">
                <div>
                  <p className="text-[11px] font-mono font-bold text-[var(--accent)]">{selectedAdvance.id}</p>
                  <h3 className="text-lg font-black text-[#FAF7F2] tracking-tight">
                    {advanceViewMode === "receive" ? "Receive Remaining Payment" : "Advance Order Details"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeAdvanceDialog}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  aria-label="Close dialog"
                  title="Close (Esc)"
                >
                  <X className="w-4.5 h-4.5 text-zinc-700" />
                </button>
              </div>

              {/* Customer + Items summary (both modes) */}
              <div className="mt-4 space-y-3">
                <div className="bg-[#181820] border border-[#C5A059]/25 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Customer</p>
                  <p className="text-sm font-black text-[#FAF7F2]">{selectedAdvance.customer_name}</p>
                  <p className="text-[11px] font-bold text-[#C5A059]">{selectedAdvance.customer_phone}</p>
                  {selectedAdvance.customer_address && (
                    <p className="text-[11px] text-[#B8B5AE] mt-0.5">{selectedAdvance.customer_address}</p>
                  )}
                </div>

                <div className="border border-[#C5A059]/25 rounded-lg divide-y divide-white/5 bg-[#181820]">
                  {selectedAdvance.items.map((it) => (
                    <div key={it.id} className="flex justify-between items-center p-2.5 text-xs">
                      <div>
                        <p className="font-bold text-[#FAF7F2]">{it.snapshot_name}</p>
                        <p className="text-[10px] text-[#B8B5AE]">Qty: {it.quantity} × ₹{Number(it.snapshot_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <p className="font-black text-[#FAF7F2]">₹{(Number(it.snapshot_price) * it.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>

                {(() => {
                  const c = advanceCharges(selectedAdvance);
                  const money = (n: number) =>
                    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  if (c.discountAmount <= 0 && c.gstAmount <= 0 && c.deliveryFee <= 0) return null;
                  return (
                    <div className="border border-[#C5A059]/25 bg-[#181820] rounded-lg p-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-semibold text-[#B8B5AE]">Subtotal</span>
                        <span className="font-bold text-[#FAF7F2]">₹{money(c.subtotal)}</span>
                      </div>
                      {c.discountAmount > 0 && (
                        <div className="flex justify-between text-[#34D399]">
                          <span className="font-semibold">
                            Discount{c.discountType === "PERCENT" ? ` (${c.discountValue}%)` : ""}
                          </span>
                          <span className="font-bold">− ₹{money(c.discountAmount)}</span>
                        </div>
                      )}
                      {c.gstAmount > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-semibold text-[#B8B5AE]">CGST ({(c.gstPercentage / 2).toFixed(1).replace(/\.0$/, "")}%)</span>
                            <span className="font-bold text-[#FAF7F2]">+ ₹{money(c.gstAmount / 2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-semibold text-[#B8B5AE]">SGST ({(c.gstPercentage / 2).toFixed(1).replace(/\.0$/, "")}%)</span>
                            <span className="font-bold text-[#FAF7F2]">+ ₹{money(c.gstAmount / 2)}</span>
                          </div>
                        </>
                      )}
                      {c.deliveryFee > 0 && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-[#B8B5AE]">Delivery</span>
                          <span className="font-bold text-[#FAF7F2]">+ ₹{money(c.deliveryFee)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#181820] border border-[#C5A059]/25 rounded-lg p-2.5">
                    <p className="text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider">Total</p>
                    <p className="text-sm font-black text-[#FAF7F2]">₹{Number(selectedAdvance.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-lg p-2.5">
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Paid</p>
                    <p className="text-sm font-black text-emerald-400">₹{Number(selectedAdvance.deposit_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-red-950/25 border border-red-500/30 rounded-lg p-2.5">
                    <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Balance</p>
                    <p className="text-sm font-black text-red-400">₹{balanceRemaining(selectedAdvance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {selectedAdvance.delivery_date && (
                  <p className="text-[11px] font-bold text-[#FAF7F2]"><Calendar className="w-3 h-3 inline mr-1 text-[var(--accent)]" />Delivery: {new Date(selectedAdvance.delivery_date).toLocaleDateString()}</p>
                )}
                {selectedAdvance.notes && (
                  <div className="bg-[#181820] border border-[#C5A059]/30 rounded-lg p-2.5 text-[11px] text-[#FAF7F2]">
                    <span className="font-bold text-[var(--accent)]">Notes: </span>{selectedAdvance.notes}
                  </div>
                )}

                {/* Print / Share the advance receipt (view mode) */}
                {advanceViewMode === "view" && (
                  <div className="pt-3 border-t border-[#C5A059]/20 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => printAdvanceReceipt(selectedAdvance.id)}
                        className="bg-[#181820] border border-[#C5A059]/25 hover:bg-[#252532] text-[#FAF7F2] py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                        Print Receipt
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          shareAdvanceReceiptWhatsApp({
                            id: selectedAdvance.id,
                            customerName: selectedAdvance.customer_name || "Guest",
                            customerPhone: selectedAdvance.customer_phone,
                            total: Number(selectedAdvance.total_amount) || 0,
                            deposit: Number(selectedAdvance.deposit_amount) || 0,
                            balance: balanceRemaining(selectedAdvance),
                          })
                        }
                        className="bg-[#10B981] hover:bg-[#059669] text-white py-2.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      Share Receipt
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={closeAdvanceDialog}
                    className="w-full py-2.5 rounded-xl border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    Close Window
                  </button>
                </div>
                )}

                {/* Receive-payment specific fields */}
                {advanceViewMode === "receive" && selectedAdvance.status !== "COMPLETED" && selectedAdvance.status !== "CANCELLED" && (
                  <div className="pt-3 border-t border-[#C5A059]/20 space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1.5">Manual Discount</label>
                      <div className="flex gap-2">
                        <select
                          value={receiveDiscountType}
                          onChange={(e) => setReceiveDiscountType(e.target.value as "FIXED" | "PERCENT")}
                          className="bg-[#181820] border border-[#C5A059]/25 text-[#FAF7F2] rounded-lg px-2 py-2 text-xs font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="FIXED">₹</option>
                          <option value="PERCENT">%</option>
                        </select>
                        <input
                          type="number"
                          value={receiveDiscountValue}
                          onChange={(e) => setReceiveDiscountValue(e.target.value === "" ? "" : parseFloat(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="flex-1 bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3 py-2 text-sm font-bold text-[#FAF7F2] focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1.5">Payment Method</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ORDER_PAYMENT_MODES.map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setReceivePaymentMode(mode)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                              receivePaymentMode === mode ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black border-[var(--accent)]" : "bg-[#181820] text-[#B8B5AE] border-[#C5A059]/20 hover:border-[var(--accent)]"
                            }`}
                          >
                            {mode === "GPAY" ? "GPay" : mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-lg p-3 text-center">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Final Amount to Collect</p>
                      <p className="text-2xl font-black text-emerald-400">₹{receiveBalanceFinalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>

                    <p className="text-[10px] font-bold text-[var(--accent)] bg-[#181820] border border-[#C5A059]/30 rounded-lg p-2.5">
                      Confirmation marks the order Completed, creates one official invoice, and recognizes the full ₹{Number(selectedAdvance.total_amount - receiveBalanceDiscountAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} as revenue.
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeAdvanceDialog}
                        className="w-1/3 py-3 rounded-lg font-bold text-[11px] uppercase tracking-wider border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmReceiveBalance}
                        disabled={isFinalizing}
                        className={`flex-1 py-3 rounded-lg font-black text-[11px] uppercase tracking-[0.1em] flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white shadow-md transition-all ${
                          isFinalizing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        {isFinalizing ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Finalizing...</span></>) : (<><Check className="w-4 h-4" /><span>Confirm Final Payment</span></>)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Advance Orders tab ─────────────────────────────────── */}
        {activeTab === "advance" && (
          <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full pb-8 pr-2 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h2 className="text-[28px] font-black text-[#FAF7F2] tracking-tight flex items-center gap-3">
                  <Clock className="w-7 h-7 text-[var(--accent)]" />
                  Advance Orders
                </h2>
                <p className="text-xs text-[#B8B5AE] font-semibold mt-1">Partial-payment holds — revenue is recognized only when the balance is collected.</p>
              </div>

              {advanceOrders.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div className="flex flex-wrap items-center bg-[#131317] border border-[#C5A059]/25 rounded-xl p-1 gap-1 max-w-full">
                    <span className="text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider px-2">
                      Period:
                    </span>
                    {(["all", "today", "week", "month", "year"] as const).map(
                      (p) => {
                        const displayLabel =
                          p === "all"
                            ? "All Time"
                            : p === "today"
                              ? "Today"
                              : p === "week"
                                ? "This Week"
                                : p === "month"
                                  ? "This Month"
                                  : "This Year";
                        const isActive = advPeriod === p;
                        return (
                          <button
                            key={p}
                            onClick={() => {
                              setAdvPeriod(p);
                              const range = getDateRange(p, "", "");
                              setAdvStartDate(
                                range.start ??
                                  allAdvanceOrderDateKeys[0] ??
                                  getLocalDate(),
                              );
                              setAdvEndDate(
                                range.end ??
                                  allAdvanceOrderDateKeys[
                                    allAdvanceOrderDateKeys.length - 1
                                  ] ??
                                  getLocalDate(),
                              );
                            }}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              isActive
                                ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black shadow-sm"
                                : "text-[#FAF7F2]/80 hover:bg-[#1E1E26]"
                            }`}
                          >
                            {displayLabel}
                          </button>
                        );
                      },
                    )}
                  </div>

                  <div className="flex flex-wrap items-center border border-[#C5A059]/25 rounded-xl px-3 py-1.5 gap-2 shadow-sm bg-[#131317] min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        From:
                      </span>
                      <input
                        type="date"
                        value={advStartDate}
                        max={advEndDate || undefined}
                        onChange={(e) => {
                          setAdvPeriod("custom");
                          setAdvStartDate(e.target.value);
                        }}
                        className="text-xs font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-[#FAF7F2] w-[115px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        To:
                      </span>
                      <input
                        type="date"
                        value={advEndDate}
                        min={advStartDate || undefined}
                        onChange={(e) => {
                          setAdvPeriod("custom");
                          setAdvEndDate(e.target.value);
                        }}
                        className="text-xs font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-[#FAF7F2] w-[115px]"
                      />
                    </div>
                  </div>
                  <span
                    aria-live="polite"
                    className={`w-full text-[10px] font-semibold lg:text-right ${
                      advDateRange.valid ? "text-[#B8B5AE]" : "text-red-400"
                    }`}
                  >
                    {advDateRangeLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {(() => {
                const pending = advancePeriodOrders.filter((a) => a.status === "PENDING" || a.status === "READY");
                const outstanding = pending.reduce((acc, a) => acc + balanceRemaining(a), 0);
                const ready = advancePeriodOrders.filter((a) => a.status === "READY").length;
                const completed = advancePeriodOrders.filter((a) => a.status === "COMPLETED").length;
                return (
                  <>
                    <div className="bg-[#131317] border border-[#C5A059]/25 rounded-xl p-4 shadow-xs flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">Outstanding Balance</p>
                        <p className="text-xl font-black text-[#FAF7F2]">₹{outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-[#FEE2E2]/15 border border-[#DC2626]/30 flex items-center justify-center">
                        <IndianRupee className="w-5 h-5 text-[#EF4444]" />
                      </div>
                    </div>
                    <div className="bg-[#131317] border border-[#C5A059]/25 rounded-xl p-4 shadow-xs flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">Ready For Collection</p>
                        <p className="text-xl font-black text-[#FAF7F2]">{ready}</p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-[#DBEAFE]/15 border border-[#2563EB]/30 flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#60A5FA]" />
                      </div>
                    </div>
                    <div className="bg-[#131317] border border-[#C5A059]/25 rounded-xl p-4 shadow-xs flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">Completed Deposits</p>
                        <p className="text-xl font-black text-[#FAF7F2]">{completed}</p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-[#DCFCE7]/15 border border-[#16A34A]/30 flex items-center justify-center">
                        <Check className="w-5 h-5 text-[#34D399]" />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Search + status filter */}
            <div className="bg-[#131317] border border-[#C5A059]/25 rounded-xl p-3 mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-[var(--accent)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={advSearchQuery}
                  onChange={(e) => setAdvSearchQuery(e.target.value)}
                  placeholder="Search by ID, customer, phone, product or status"
                  className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold text-[#FAF7F2] placeholder:text-[#FAF7F2]/30 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["ALL", "PENDING", "READY", "COMPLETED", "CANCELLED"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setAdvStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      advStatusFilter === s ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] shadow-sm" : "bg-[#181820] text-[#FAF7F2]/80 border border-[#C5A059]/20 hover:bg-[#202028]"
                    }`}
                  >
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="bg-[#131317] border border-[#C5A059]/25 rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-[1.1fr_1.3fr_1.5fr_1.5fr_0.9fr_1.1fr_1.4fr] gap-3 px-4 py-3 border-b border-[#C5A059]/20 text-[10px] font-black uppercase tracking-wider text-[var(--accent)] bg-[#181820]">
                <span>Deposit ID</span>
                <span>Customer</span>
                <span>Product</span>
                <span>Total / Paid / Balance</span>
                <span>Delivery</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              {(() => {
                const filtered = filteredAdvanceOrders;
                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs font-bold text-[#FAF7F2]">
                      No advance orders match the current filters.
                    </div>
                  );
                }
                return filtered.map((a) => {
                  const bal = balanceRemaining(a);
                  const statusStyles: Record<AdvanceOrderStatus, string> = {
                    PENDING: "bg-[#FEF3C7]/15 text-[#F59E0B] border-[#F59E0B]/30",
                    READY: "bg-[#DBEAFE]/15 text-[#60A5FA] border-[#2563EB]/30",
                    COMPLETED: "bg-[#DCFCE7]/15 text-[#34D399] border-[#16A34A]/30",
                    CANCELLED: "bg-[#FEE2E2]/15 text-[#EF4444] border-[#DC2626]/30",
                  };
                  return (
                    <div key={a.id} className="grid grid-cols-1 md:grid-cols-[1.1fr_1.3fr_1.5fr_1.5fr_0.9fr_1.1fr_1.4fr] gap-3 px-4 py-3 border-b border-[#C5A059]/15 items-center text-xs hover:bg-[#181820]/60">
                      <div>
                        <p className="font-mono font-black text-[11px] text-[#FAF7F2]">{a.id}</p>
                        <p className="text-[9px] font-bold text-[var(--accent)]">{formatDateValue(a.created_at)}</p>
                      </div>
                      <div>
                        <p className="font-black text-[#FAF7F2]">{a.customer_name}</p>
                        <p className="text-[10px] text-[#B8B5AE]">{a.customer_phone}</p>
                      </div>
                      <div className="text-[11px]">
                        {a.items.slice(0, 2).map((i) => (
                          <p key={i.id} className="font-bold text-[#FAF7F2] truncate">
                            {i.quantity}× {i.snapshot_name}
                          </p>
                        ))}
                        {a.items.length > 2 && (
                          <p className="text-[10px] text-[var(--accent)]">+{a.items.length - 2} more</p>
                        )}
                      </div>
                      <div className="text-[11px]">
                        <p className="font-bold text-[#FAF7F2]">Total: ₹{Number(a.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[#34D399] font-bold">Paid: ₹{Number(a.deposit_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[#EF4444] font-bold">Balance: ₹{bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-[11px] font-bold text-[#B8B5AE]">
                        {a.delivery_date ? formatDateValue(a.delivery_date) : "—"}
                      </div>
                      <div>
                        <span className={`inline-block px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusStyles[a.status]}`}>
                          {a.status}
                        </span>
                        {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                          <button
                            onClick={() => toggleAdvanceReady(a)}
                            className="block mt-1 text-[9px] font-black uppercase tracking-wider text-[var(--accent)] hover:underline cursor-pointer"
                          >
                            Mark as {a.status === "READY" ? "Pending" : "Ready"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        <button onClick={() => shareAdvanceReceiptWhatsApp({
                          id: a.id,
                          customerName: a.customer_name,
                          customerPhone: a.customer_phone,
                          total: Number(a.total_amount),
                          deposit: Number(a.deposit_amount),
                          balance: bal
                        })} title="Send on WhatsApp" className="flex items-center justify-center w-8 h-8 bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#34D399] rounded-md transition-colors cursor-pointer shrink-0">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                          </svg>
                        </button>
                        <button onClick={() => setActiveAdvanceBillId(a.id)} title={a.status === "COMPLETED" ? "Open Advance Order Bill" : "Open Advance Receipt"} className="flex items-center justify-center w-8 h-8 bg-[var(--accent)]/15 hover:bg-[var(--accent)]/25 text-[var(--accent)] rounded-md transition-colors cursor-pointer shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button onClick={() => openAdvanceView(a)} title="View details" className="flex items-center justify-center w-8 h-8 bg-[#181820] hover:bg-[#22222D] text-[#FAF7F2] border border-[#C5A059]/20 rounded-md transition-colors cursor-pointer shrink-0">
                          <Eye className="w-4 h-4" />
                        </button>
                        {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                          <button onClick={() => openReceiveBalance(a)} title="Receive balance" className="flex items-center justify-center w-8 h-8 bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#34D399] rounded-md transition-colors cursor-pointer shrink-0">
                            <IndianRupee className="w-4 h-4" />
                          </button>
                        )}
                        {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                          <button onClick={() => doCancelAdvance(a)} title="Cancel" className="flex items-center justify-center w-8 h-8 bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] rounded-md transition-colors cursor-pointer shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {role === "admin" && (
                          <button onClick={() => doDeleteAdvance(a)} title="Delete" className="flex items-center justify-center w-8 h-8 bg-[#DC2626]/15 hover:bg-[#DC2626]/25 text-[#EF4444] rounded-md transition-colors cursor-pointer shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full pb-8 pr-2 animate-in fade-in duration-300">
            {/* Header Panel */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h2 className="text-[28px] font-black text-[#FAF7F2] tracking-tight flex items-center gap-3">
                  <History className="w-7 h-7 text-[var(--accent)]" />
                  Order History
                </h2>
                <p className="text-xs text-[#B8B5AE] font-semibold mt-1">
                  Manage and track past invoices
                </p>
              </div>

              {orders.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div className="flex flex-wrap items-center bg-[#131317] border border-[#C5A059]/25 rounded-xl p-1 gap-1 max-w-full">
                    <span className="text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider px-2">
                      Period:
                    </span>
                    {(["all", "today", "week", "month", "year"] as const).map(
                      (p) => {
                        const displayLabel =
                          p === "all"
                            ? "All Time"
                            : p === "today"
                              ? "Today"
                              : p === "week"
                                ? "This Week"
                                : p === "month"
                                  ? "This Month"
                                  : "This Year";
                        const isActive = historyPeriod === p;
                        return (
                          <button
                            key={p}
                            onClick={() => {
                              setHistoryPeriod(p);
                              const range = getSelectedDateRange(
                                p,
                                orders.map((order) => order.date),
                              );
                              setHistoryStartDate(range.start ?? "");
                              setHistoryEndDate(range.end ?? "");
                            }}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              isActive
                                ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black shadow-sm"
                                : "text-[#FAF7F2]/80 hover:bg-[#1E1E26]"
                            }`}
                          >
                            {displayLabel}
                          </button>
                        );
                      },
                    )}
                  </div>

                  <div className="flex flex-wrap items-center border border-[#C5A059]/25 rounded-xl px-3 py-1.5 gap-2 shadow-sm bg-[#131317] min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        From:
                      </span>
                      <input
                        type="date"
                        value={historyStartDate}
                        max={historyEndDate || undefined}
                        onChange={(e) => {
                          setHistoryPeriod("custom");
                          setHistoryStartDate(e.target.value);
                        }}
                        className="text-xs font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-[#FAF7F2] w-[115px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        To:
                      </span>
                      <input
                        type="date"
                        value={historyEndDate}
                        min={historyStartDate || undefined}
                        onChange={(e) => {
                          setHistoryPeriod("custom");
                          setHistoryEndDate(e.target.value);
                        }}
                        className="text-xs font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-[#FAF7F2] w-[115px]"
                      />
                    </div>
                  </div>

                  <span
                    aria-live="polite"
                    className={`basis-full text-[10px] font-semibold text-right ${
                      historyDateRange.valid ? "text-[#B8B5AE]" : "text-red-400"
                    }`}
                  >
                    {historyDateRangeLabel}
                  </span>

                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-4 py-2 border-2 border-[var(--accent)] bg-transparent text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#0C0C0E] rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              )}
            </div>

            {orders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#C5A059]/20 rounded-xl bg-[#131317] py-12">
                <p className="text-[#FAF7F2] font-semibold">
                  No past transactions yet.
                </p>
                <p className="text-xs text-[#B8B5AE] mt-1">New completed sales will appear here automatically.</p>
              </div>
            ) : (
              <>
                {/* Search and Filters Bar */}
                <div className="bg-[#131317] border border-[#C5A059]/25 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    <div>
                      <label className="block text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                        Search Order ID
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#C5A059] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. INV-..."
                          className="w-full bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-[#FAF7F2] placeholder-[#FAF7F2]/30 focus:outline-none"
                          value={orderSearchId}
                          onChange={(e) => setOrderSearchId(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        placeholder="Search name..."
                        className="w-full bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#FAF7F2] placeholder-[#FAF7F2]/30 focus:outline-none"
                        value={orderSearchName}
                        onChange={(e) => setOrderSearchName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                        Customer Phone
                      </label>
                      <input
                        type="text"
                        placeholder="Search phone..."
                        className="w-full bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#FAF7F2] placeholder-[#FAF7F2]/30 focus:outline-none"
                        value={orderSearchPhone}
                        onChange={(e) => setOrderSearchPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                        Order Source
                      </label>
                      <select
                        className="w-full bg-[#181820] border border-[#C5A059]/25 focus:border-[var(--accent)] rounded-lg px-3 py-1.5 text-xs font-bold text-[#FAF7F2] focus:outline-none cursor-pointer"
                        value={orderFilterSource}
                        onChange={(e) => setOrderFilterSource(e.target.value)}
                      >
                        <option value="ALL" className="bg-[#181820] text-[#FAF7F2]">All Sources</option>
                        <option value="ONLINE" className="bg-[#181820] text-[#FAF7F2]">Online Orders</option>
                        <option value="OFFLINE" className="bg-[#181820] text-[#FAF7F2]">Offline (POS)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {(() => {
                  const filteredOrders = historyFilteredOrders;

                  if (filteredOrders.length === 0) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#C5A059]/20 rounded-xl bg-[#131317] py-12">
                        <p className="text-[#FAF7F2] font-semibold">
                          No transactions match your search filters.
                        </p>
                        <p className="text-xs text-[#B8B5AE] mt-1">Try adjusting the period, order ID or customer details.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-[#131317] border border-[#C5A059]/25 rounded-xl shadow-sm overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#181820] border-b border-[#C5A059]/25 select-none">
                            <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">
                              Order ID
                            </th>
                            <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">
                              Date &amp; Time
                            </th>
                            <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">
                              Customer Name
                            </th>
                            <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">
                              Mobile Number
                            </th>
                            <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">
                              Source
                            </th>
                            <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">
                              Total Due
                            </th>
                            <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest text-right">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map((order) => (
                            <tr
                              key={order.id}
                              className="border-b border-white/5 hover:bg-[#181820] transition-colors"
                            >
                              <td className="p-4 text-xs font-semibold text-[#FAF7F2]">
                                {order.id}
                              </td>
                              <td className="p-4 text-xs font-bold text-[#FAF7F2] whitespace-nowrap">
                                {new Date(order.date).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                                <span className="block text-[10px] font-semibold text-[#B8B5AE]">
                                  {new Date(
                                    order.createdAt || order.date,
                                  ).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Asia/Kolkata",
                                  })}
                                </span>
                              </td>
                              <td className="p-4 text-xs font-bold text-[#FAF7F2]">
                                {order.customerName}
                              </td>
                              <td className="p-4 text-xs font-mono font-bold text-[#FAF7F2]">
                                {order.customerPhone || "-"}
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col items-start gap-1">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest border ${order.source === "ONLINE" ? "border-[#00A86B] text-[#00A86B] bg-[#00A86B]/10" : "border-[#C5A059]/30 text-[#B8B5AE] bg-[#181820]"}`}
                                  >
                                    {order.source}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest border ${order.isGst ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10 text-[#B8B5AE] bg-white/5"}`}
                                  >
                                    {order.isGst ? "GST" : "NON-GST"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-sm font-black text-[var(--accent)]">
                                ₹{order.grandTotal.toLocaleString()}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex flex-row items-center justify-end gap-1.5">
                                  <span className="px-3 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-[10px] font-bold uppercase tracking-wider hidden lg:inline-block mr-1">
                                    {order.status}
                                  </span>
                                  <button
                                    onClick={() => resendWhatsApp(order)}
                                    title="Send on WhatsApp"
                                    aria-label="Send on WhatsApp"
                                    className="flex items-center justify-center w-8 h-8 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] rounded-md transition-colors cursor-pointer"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setActiveInvoiceId(order.id)}
                                    title="View invoice"
                                    aria-label="View invoice"
                                    className="flex items-center justify-center w-8 h-8 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] rounded-md transition-colors cursor-pointer"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    title="Order details"
                                    aria-label="Order details"
                                    className="flex items-center justify-center w-8 h-8 bg-white/5 hover:bg-white/10 text-[#FAF7F2] rounded-md transition-colors cursor-pointer border border-white/5"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                      />
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                      />
                                    </svg>
                                  </button>
                                  {role === "admin" && (
                                    <button
                                      onClick={() =>
                                        handleDeleteOrder(order.id)
                                      }
                                      title="Delete order"
                                      aria-label="Delete order"
                                      className="flex items-center justify-center w-8 h-8 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] rounded-md transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {role === "admin" && activeTab === "analytics" && (
          <div className="flex-1 flex flex-col max-w-[1400px] min-w-0 mx-auto w-full pb-8 pr-2">
            {/* Header Panel */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
              <div>
                <h2 className="text-[28px] font-black text-[#FAF7F2] tracking-tight flex items-center gap-3">
                  <BarChart2 className="w-7 h-7 text-[var(--accent)]" />
                  {analyticsGstFilter === "gst"
                    ? "GST Revenue"
                    : analyticsGstFilter === "nongst"
                      ? "Non-GST Revenue"
                      : "Revenue Analytics"}
                </h2>
                <p className="text-xs text-[#B8B5AE] font-semibold mt-1">
                  {analyticsGstFilter === "gst"
                    ? "GST invoices only — taxable sales dashboard"
                    : analyticsGstFilter === "nongst"
                      ? "Non-GST bills only — retail sales dashboard"
                      : "All bills — full store & channel insights"}
                </p>
              </div>

              {/* Period Filters & Refresh Button */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {analyticsSubTab !== "today" && (
                  <>
                    <div className="flex flex-wrap items-center bg-[#131317] border border-[#C5A059]/25 rounded-xl p-1 gap-1 max-w-full">
                      <span className="text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider px-2">
                        Period:
                      </span>
                      {(["all", "today", "week", "month", "year"] as const).map(
                        (p) => {
                          const displayLabel =
                            p === "all"
                              ? "All Time"
                              : p === "today"
                                ? "Today"
                                : p === "week"
                                  ? "This Week"
                                  : p === "month"
                                    ? "This Month"
                                    : "This Year";
                          const isActive = analyticsPeriod === p;
                          return (
                            <button
                              key={p}
                              onClick={() => {
                                setAnalyticsPeriod(p);
                                const range = getSelectedDateRange(
                                  p,
                                  orders.map((order) => order.date),
                                );
                                setAnalyticsStartDate(range.start ?? "");
                                setAnalyticsEndDate(range.end ?? "");
                              }}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                isActive
                                  ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black shadow-sm"
                                  : "text-[#FAF7F2]/80 hover:bg-[#1E1E26]"
                              }`}
                            >
                              {displayLabel}
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="flex flex-wrap items-center border border-[#C5A059]/25 rounded-xl px-3 py-1.5 gap-2 shadow-sm bg-[#131317] min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                          From:
                        </span>
                        <input
                          type="date"
                          value={analyticsStartDate}
                          max={analyticsEndDate || undefined}
                          onChange={(e) => {
                            setAnalyticsPeriod("custom");
                            setAnalyticsStartDate(e.target.value);
                          }}
                          className="text-xs font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-[#FAF7F2] w-[115px]"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                          To:
                        </span>
                        <input
                          type="date"
                          value={analyticsEndDate}
                          min={analyticsStartDate || undefined}
                          onChange={(e) => {
                            setAnalyticsPeriod("custom");
                            setAnalyticsEndDate(e.target.value);
                          }}
                          className="text-xs font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-[#FAF7F2] w-[115px]"
                        />
                      </div>
                    </div>
                    <span
                      aria-live="polite"
                      className={`basis-full text-[10px] font-semibold text-right ${
                        analyticsDateRange.valid ? "text-[#B8B5AE]" : "text-red-400"
                      }`}
                    >
                      {analyticsDateRangeLabel}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* GST / Non-GST Dashboard Switch */}
            <div className="flex items-center gap-1 bg-[#131317] border border-[#C5A059]/25 rounded-xl p-1 mb-6 w-full sm:w-auto sm:self-start">
              {(
                [
                  ["all", "All Bills"],
                  ["gst", "GST Invoices"],
                  ["nongst", "Non-GST Bills"],
                ] as const
              ).map(([key, label]) => {
                const isActive = analyticsGstFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setAnalyticsGstFilter(key)}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black shadow-sm"
                        : "text-[#FAF7F2]/80 hover:bg-[#1E1E26]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Sub Navigation Tabs */}
            <div className="flex border-b border-[#C5A059]/20 mb-6 gap-6 overflow-x-auto scrollbar-none pb-0.5 w-full shrink-0">
              {(["revenue", "today", "products", "coupons"] as const).map(
                (tab) => {
                  const isActive = analyticsSubTab === tab;
                  const displayLabel =
                    tab === "today"
                      ? "Today's Sales"
                      : tab === "revenue"
                        ? "Revenue"
                        : tab === "products"
                          ? "Products"
                          : "Coupons";
                  return (
                    <button
                      key={tab}
                      onClick={() => setAnalyticsSubTab(tab)}
                      className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer shrink-0 ${
                        isActive
                          ? "text-[var(--accent)]"
                          : "text-[#B8B5AE] hover:text-[#FAF7F2]"
                      }`}
                    >
                      {displayLabel}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
                      )}
                    </button>
                  );
                },
              )}
            </div>

            {/* Tab Contents */}
            {analyticsSubTab === "today" && (
              <>
                {/* Today's KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4 mb-8">
                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Today&apos;s Revenue
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[#10B981]/15 flex items-center justify-center">
                        <IndianRupee className="w-3 h-3 text-[#10B981] animate-pulse" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      ₹{todayRevenue.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      Completed today
                    </div>
                  </div>

                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Today&apos;s Bills
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[#C5A059]/15 flex items-center justify-center">
                        <Trophy className="w-3 h-3 text-[#C5A059] animate-swing" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      {todayOrdersCount}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      Completed today
                    </div>
                  </div>

                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Today&apos;s Items Sold
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                        <Package className="w-3 h-3 text-[var(--accent)] animate-pop" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      {todayItemsSold} pcs
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      Quantity sold today
                    </div>
                  </div>
                </div>

                {/* Today's Detailed Split */}
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 mb-8">
                  {/* Left Side: Today's Order Source & Leaderboard */}
                  <div className="col-span-8 w-full flex flex-col gap-6">
                    {/* Today's Transactions Table */}
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm flex-1">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <h3 className="font-bold text-[#FAF7F2] text-sm">
                          Today&apos;s Transactions
                        </h3>

                        {/* Contact Search Input */}
                        <div className="flex items-center border border-[#C5A059]/30 bg-[#181820] rounded-lg px-3 py-1.5 gap-2 shadow-xs w-full sm:w-auto animate-in fade-in duration-200">
                          <Search className="w-3.5 h-3.5 text-[#C5A059]" />
                          <input
                            type="text"
                            placeholder="Search contact/invoice..."
                            className="text-xs font-semibold bg-transparent border-none outline-none focus:ring-0 text-[#FAF7F2] placeholder:text-[#B8B5AE] w-full sm:w-[170px]"
                            value={analyticsSearchPhone}
                            onChange={(e) =>
                              setAnalyticsSearchPhone(e.target.value)
                            }
                          />
                        </div>
                      </div>
                      {todayOrders.length === 0 ? (
                        <div className="text-center text-[#B8B5AE] text-xs font-semibold py-12">
                          {analyticsSearchPhone
                            ? "No matching transactions found."
                            : "No orders placed today."}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-[#181820]/80 border-b border-[#C5A059]/20">
                                <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                                  Invoice ID
                                </th>
                                <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                                  Customer No
                                </th>
                                <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                                  Source
                                </th>
                                <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider text-right">
                                  Items
                                </th>
                                <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider text-right">
                                  Grand Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {todayOrders.map((order) => (
                                <tr
                                  key={order.id}
                                  className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                                >
                                  <td className="p-3 text-xs font-semibold text-[#FAF7F2]">
                                    {order.id}
                                  </td>
                                  <td className="p-3 text-xs font-mono font-bold text-[#FAF7F2]">
                                    {order.customerPhone || "-"}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest border ${order.source === "ONLINE" ? "border-[#00A86B]/40 text-[#10B981] bg-[#00A86B]/10" : "border-[#C5A059]/40 text-[#FAF7F2] bg-white/5"}`}
                                    >
                                      {order.source}
                                    </span>
                                  </td>
                                  <td className="p-3 text-xs font-semibold text-[#FAF7F2] text-right">
                                    {order.items.reduce(
                                      (sum, i) =>
                                        sum +
                                        (i.name && !i.name.startsWith("GST (")
                                          ? i.qty
                                          : 0),
                                      0,
                                    )}{" "}
                                    pcs
                                  </td>
                                  <td className="p-3 text-xs font-black text-[var(--accent)] text-right">
                                    ₹{order.grandTotal.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Channel Split & Top items */}
                  <div className="col-span-4 w-full flex flex-col gap-6">
                    {/* Today's Channel Split Card */}
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm">
                      <h3 className="font-bold text-[#FAF7F2] mb-4 text-sm">
                        Today&apos;s Channel Split
                      </h3>
                      {todayOrdersCount === 0 ? (
                        <div className="text-center text-[#B8B5AE] text-xs font-semibold py-6">
                          No sales today.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-[#FAF7F2] uppercase tracking-wider w-14">
                              Offline
                            </span>
                            <div className="flex-1 h-2.5 bg-[#181820] rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full bg-[#C5A059] rounded-full transition-all duration-700"
                                style={{
                                  width: `${(todayOfflineOrdersCount / todayOrdersCount) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-black text-[#FAF7F2] w-12 text-right">
                              ₹{todayOfflineRevenue.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider w-14">
                              Online
                            </span>
                            <div className="flex-1 h-2.5 bg-[#181820] rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full bg-[#00A86B] rounded-full transition-all duration-700"
                                style={{
                                  width: `${(todayOnlineOrdersCount / todayOrdersCount) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-black text-[#FAF7F2] w-12 text-right">
                              ₹{todayOnlineRevenue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Today's Top Products Sold Card */}
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm flex-1">
                      <h3 className="font-bold text-[#FAF7F2] text-sm mb-4">
                        Today&apos;s Top Items
                      </h3>
                      {todayTopItems.length === 0 ? (
                        <div className="text-center text-[#B8B5AE] text-xs font-semibold py-6">
                          No items sold today.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {todayTopItems.map((item, idx) => (
                            <div
                              key={item.name}
                              className="flex items-center gap-3"
                            >
                              <span className="text-[11px] font-black text-[#C5A059] w-4">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-bold text-[#FAF7F2]">
                                    {item.name}
                                  </span>
                                  <span className="text-xs font-black text-[var(--accent)]">
                                    ₹{item.revenue.toLocaleString()}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-[#181820] rounded-full overflow-hidden border border-white/5">
                                  <div
                                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-700"
                                    style={{
                                      width: `${(item.revenue / todayTopItems[0].revenue) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] text-[#B8B5AE] font-semibold w-10 text-right">
                                {item.qty} pcs
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {analyticsSubTab === "revenue" && (
              <>
                {/* Profit Summary — ONLY visible when viewing All Bills */}
                {analyticsGstFilter === "all" && (
                  <div className="space-y-3 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Card 1: Net Earnings (GST + Non-GST - Expenses) */}
                      {(() => {
                        const netProfit =
                          gstRevenue + nonGstRevenue - analyticsExpensesTotal;
                        const positive = netProfit >= 0;
                        const accent = positive ? "#059669" : "#B91C1C";
                        return (
                          <div
                            className="rounded-2xl p-5 shadow-sm text-white hover:shadow-md transition-all"
                            style={{
                              background: `linear-gradient(135deg, ${accent}, #18181B)`,
                            }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                                Net Earnings
                              </span>
                              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                                <PiggyBank className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <div className="text-2xl font-black text-white">
                              {positive ? "" : "− "}₹
                              {Math.abs(netProfit).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[9px] text-white/95 font-black mt-1 tracking-wide">
                              GST + Non-GST − Expenses
                            </div>
                          </div>
                        );
                      })()}

                      {/* Card 2: GST Revenue */}
                      <div className="bg-[#131317] border border-[var(--accent)]/30 rounded-2xl p-5 shadow-sm hover:border-[var(--accent)]/50 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                            GST Sales
                          </span>
                          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                            <IndianRupee className="w-4 h-4 text-[var(--accent)]" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-[var(--accent)]">
                          ₹
                          {gstRevenue.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[9px] text-[#B8B5AE] font-semibold mt-1">
                          {gstOrdersCount} GST invoices
                        </div>
                      </div>

                      {/* Card 3: Non-GST Revenue */}
                      <div className="bg-[#131317] border border-[#059669]/30 rounded-2xl p-5 shadow-sm hover:border-[#059669]/50 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                            Non-GST Sales
                          </span>
                          <div className="w-8 h-8 rounded-full bg-[#059669]/15 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-[#10B981]" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-[#10B981]">
                          + ₹
                          {nonGstRevenue.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[9px] text-[#B8B5AE] font-semibold mt-1">
                          {nonGstOrdersCount} retail bills
                        </div>
                      </div>

                      {/* Card 4: Total Expenses */}
                      <div className="bg-[#131317] border border-[#B91C1C]/30 rounded-2xl p-5 shadow-sm hover:border-[#B91C1C]/50 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                            Total Expenses
                          </span>
                          <div className="w-8 h-8 rounded-full bg-[#B91C1C]/15 flex items-center justify-center">
                            <TrendingDown className="w-4 h-4 text-[#EF4444]" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-[#EF4444]">
                          − ₹
                          {analyticsExpensesTotal.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <button
                          onClick={() => setActiveTab("expenses")}
                          className="text-[9px] text-[#EF4444] font-bold mt-1 underline underline-offset-2 cursor-pointer hover:opacity-80 block"
                        >
                          Money out — Expense Tracker
                        </button>
                      </div>
                    </div>

                    {/* Formula Calculation Banner */}
                    <div className="bg-[#181820] border border-[#C5A059]/20 rounded-xl px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/30 px-2 py-0.5 rounded-md">
                          Calculation Formula
                        </span>
                        <span className="text-[#B8B5AE] font-semibold">
                          GST (₹
                          {gstRevenue.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                          ) + Non-GST (₹
                          {nonGstRevenue.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                          ) − Expenses (₹
                          {analyticsExpensesTotal.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                          )
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-[#B8B5AE]">= Net Profit:</span>
                        <span
                          className={`font-black font-mono text-sm ${
                            gstRevenue +
                              nonGstRevenue -
                              analyticsExpensesTotal >=
                            0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          ₹
                          {(
                            gstRevenue +
                            nonGstRevenue -
                            analyticsExpensesTotal
                          ).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 5x2 KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* Row 1 */}
                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Total Revenue
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[#10B981]/15 flex items-center justify-center">
                        <IndianRupee className="w-3 h-3 text-[#10B981] animate-pulse" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      ₹
                      {totalRevenueAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      {analyticsGstFilter === "all"
                        ? `GST (₹${gstRevenue.toLocaleString("en-IN")}) + Non-GST (₹${nonGstRevenue.toLocaleString("en-IN")})`
                        : "POS + manual combined"}
                    </div>
                  </div>

                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Completed Bills
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[#10B981]/15 flex items-center justify-center">
                        <Trophy className="w-3 h-3 text-[#10B981] animate-swing" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      {totalOrdersCount}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      POS + manual bills
                    </div>
                  </div>

                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Offline Bills
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[#06B6D4]/15 flex items-center justify-center">
                        <IndianRupee className="w-3 h-3 text-[#06B6D4] animate-bounce" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      ₹
                      {offlineRevenue.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      Walk-in POS sales
                    </div>
                  </div>

                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Online Bills
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[var(--accent-strong)]/15 flex items-center justify-center">
                        <IndianRupee className="w-3 h-3 text-[var(--accent-strong)] animate-float" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      ₹
                      {onlineRevenue.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      Online POS sales
                    </div>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 ${
                    analyticsGstFilter === "all"
                      ? "lg:grid-cols-4"
                      : "lg:grid-cols-3"
                  } gap-4 mb-8`}
                >
                  {/* Row 2 */}
                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Total Offline Bills
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[#C5A059]/15 flex items-center justify-center">
                        <ShoppingBag className="w-3 h-3 text-[#C5A059] animate-pulse" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      {offlineOrders}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      Walk-in POS orders
                    </div>
                  </div>

                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Total Online Bills
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[var(--accent-strong)]/15 flex items-center justify-center">
                        <Globe className="w-3 h-3 text-[var(--accent-strong)] animate-float" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      {onlineOrders}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      Online channel orders
                    </div>
                  </div>

                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Total Items Sold
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                        <Package className="w-3 h-3 text-[var(--accent)] animate-pop" />
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#FAF7F2] mb-1">
                      {totalItemsSold}
                    </div>
                    <div className="text-[9px] text-[#B8B5AE] font-semibold">
                      From completed bills
                    </div>
                  </div>

                  {/* Top Product - only shown in All Bills; omitted in GST and Non-GST */}
                  {analyticsGstFilter === "all" && (
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm hover:border-[#C5A059]/40 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                          Top Product
                        </span>
                        <div className="w-6 h-6 rounded-full bg-[#EC4899]/15 flex items-center justify-center">
                          <Trophy className="w-3 h-3 text-[#EC4899] animate-pop" />
                        </div>
                      </div>
                      <div
                        className="text-xl font-black text-[#FAF7F2] mb-1 truncate"
                        title={topProduct}
                      >
                        {topProduct}
                      </div>
                      <div className="text-[9px] text-[#B8B5AE] font-semibold">
                        Most sold item
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Charts & Breakdowns */}
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6">
                  {/* Left Chart Column */}
                  <div className="col-span-8 w-full flex flex-col gap-6">
                    {/* Monthly Revenue Trend Chart */}
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm hover:border-[#C5A059]/40 transition-all flex flex-col min-h-[300px]">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="font-bold text-[#FAF7F2] text-sm mb-2 flex items-center">
                            Revenue Trend This Year{" "}
                            <span className="text-[var(--accent)] font-black ml-1.5">
                              {now.getFullYear()}
                            </span>
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-[#FAF7F2]">
                              ₹{totalYearRevenue.toLocaleString()}
                            </span>
                            {avgMonthRevenue > 0 && (
                              <span className="bg-[#181820] border border-[#C5A059]/30 text-[var(--accent)] px-2 py-0.5 rounded text-[10px] font-bold">
                                Avg ₹
                                {Math.round(avgMonthRevenue).toLocaleString()}
                                /mo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {orders.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-[#B8B5AE] text-sm font-semibold">
                          Process orders to see yearly revenue trend.
                        </div>
                      ) : (
                        <div className="flex-1 overflow-x-auto scrollbar-thin pb-2">
                          <div className="flex items-end justify-between px-2 gap-1 relative mt-4 min-w-[500px] h-[170px] pt-10">
                            {monthNames.map((month, i) => (
                              <div
                                key={month}
                                className="flex flex-col items-center gap-1.5 w-full group/bar relative outline-none"
                                tabIndex={0}
                              >
                                {/* Monthly sales text on top for mobile/visibility */}
                                <span className="text-[8px] font-black text-[var(--accent)] h-3 flex items-end">
                                  {monthRevenue[i] > 0
                                    ? monthRevenue[i] >= 1000
                                      ? `₹${(monthRevenue[i] / 1000).toFixed(1)}k`
                                      : `₹${monthRevenue[i]}`
                                    : ""}
                                </span>

                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0C0C0E] border border-[#C5A059]/30 text-[#FAF7F2] text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 group-hover/bar:opacity-100 group-focus/bar:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                  <div className="text-[9px] text-[#B8B5AE] font-semibold mb-0.5">
                                    {monthNames[i]}
                                  </div>
                                  ₹{(monthRevenue[i] || 0).toLocaleString()}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0C0C0E]"></div>
                                </div>
                                <div
                                  className="w-full max-w-[24px] bg-[var(--accent)] rounded-t-sm transition-all duration-1000 group-hover/bar:bg-[#E5C378] cursor-pointer min-h-[4px]"
                                  style={{
                                    height: `${Math.max(4, (monthRevenue[i] / maxMonthRevenue) * 100)}px`,
                                  }}
                                />
                                <span className="text-[10px] font-bold text-[#B8B5AE] uppercase">
                                  {month}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Weekly Revenue Bar Chart */}
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm hover:border-[#C5A059]/40 transition-all flex flex-col min-h-[250px]">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="font-bold text-[#FAF7F2] text-sm flex items-center">
                            Revenue This Week{" "}
                            <span className="text-[var(--accent)] font-black ml-1.5">
                              (Week {currentWeekNumber} of {now.getFullYear()})
                            </span>
                          </h3>
                          <p className="text-[10px] text-[#B8B5AE] font-semibold mt-1">
                            ₹
                            {weekRevenue
                              .reduce((a, b) => a + b, 0)
                              .toLocaleString()}{" "}
                            total
                          </p>
                        </div>
                      </div>

                      {orders.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-[#B8B5AE] text-sm font-semibold">
                          Process orders to see weekly revenue.
                        </div>
                      ) : (
                        <div className="flex-1 flex items-end justify-between px-2 gap-2">
                          {dayNames.map((day, i) => (
                            <div
                              key={day}
                              className="flex flex-col items-center gap-3 w-full group/bar relative outline-none"
                              tabIndex={0}
                            >
                              <span className="text-[9px] font-black text-[var(--accent)]">
                                {weekRevenue[i] > 0
                                  ? `₹${weekRevenue[i] >= 1000 ? (weekRevenue[i] / 1000).toFixed(1) + "k" : weekRevenue[i]}`
                                  : ""}
                              </span>

                              {/* Tooltip for exact weekly revenue */}
                              <div className="absolute bottom-[52px] mb-2 left-1/2 -translate-x-1/2 bg-[#0C0C0E] border border-[#C5A059]/30 text-[#FAF7F2] text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 group-hover/bar:opacity-100 group-focus/bar:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                <div className="text-[9px] text-[#B8B5AE] font-semibold mb-0.5">
                                  {dayNames[i]}
                                </div>
                                ₹{(weekRevenue[i] || 0).toLocaleString()}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0C0C0E]"></div>
                              </div>

                              <div className="w-full max-w-[20px] h-32 bg-[#181820] rounded-full relative overflow-hidden cursor-pointer border border-white/5">
                                <div
                                  className="absolute bottom-0 w-full bg-[var(--accent)] rounded-full transition-all duration-1000 group-hover/bar:bg-[#E5C378]"
                                  style={{
                                    height: `${(weekRevenue[i] / maxWeekRevenue) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-[#B8B5AE] uppercase">
                                {day}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column (Breakdowns) */}
                  <div className="col-span-4 w-full flex flex-col gap-6">
                    {/* Order Source Breakdown */}
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm hover:border-[#C5A059]/40 transition-all">
                      <h3 className="font-bold text-[#FAF7F2] mb-4 text-sm">
                        Order Source
                      </h3>
                      {totalOrdersCount === 0 ? (
                        <div className="text-center text-[#B8B5AE] text-sm font-semibold py-6">
                          No orders yet.
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-[10px] font-bold text-[#FAF7F2] uppercase tracking-wider w-14">
                              Offline
                            </span>
                            <div className="flex-1 h-2.5 bg-[#181820] rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full bg-[#C5A059] rounded-full transition-all duration-700"
                                style={{
                                  width: `${(offlineOrders / totalOrdersCount) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-black text-[#FAF7F2] w-8 text-right">
                              {offlineOrders}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider w-14">
                              Online
                            </span>
                            <div className="flex-1 h-2.5 bg-[#181820] rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full bg-[#00A86B] rounded-full transition-all duration-700"
                                style={{
                                  width: `${(onlineOrders / totalOrdersCount) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-black text-[#FAF7F2] w-8 text-right">
                              {onlineOrders}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Top Items by Revenue */}
                    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm hover:border-[#C5A059]/40 transition-all flex-1">
                      <h3 className="font-bold text-[#FAF7F2] text-sm mb-4">
                        Top Items by Revenue
                      </h3>
                      {topItems.length === 0 ? (
                        <div className="text-center text-[#B8B5AE] text-sm font-semibold py-6">
                          No items sold yet.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {topItems.map((item, idx) => (
                            <div
                              key={item.name}
                              className="flex items-center gap-3"
                            >
                              <span className="text-[11px] font-black text-[#C5A059] w-4">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-xs font-bold text-[#FAF7F2]">
                                    {item.name}
                                  </span>
                                  <span className="text-xs font-black text-[var(--accent)]">
                                    ₹{item.revenue.toLocaleString()}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-[#181820] rounded-full overflow-hidden border border-white/5">
                                  <div
                                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-700"
                                    style={{
                                      width: `${(item.revenue / topItems[0].revenue) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] text-[#B8B5AE] font-semibold w-10 text-right">
                                {item.qty} pcs
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {analyticsSubTab === "products" && (
              <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="font-bold text-[#FAF7F2] text-sm">
                    Product Sales Leaderboard
                  </h3>

                  {/* Product Search Input */}
                  <div className="flex items-center border border-[#C5A059]/30 bg-[#181820] rounded-lg px-3 py-1.5 gap-2 shadow-xs w-full sm:w-auto animate-in fade-in duration-200">
                    <Search className="w-3.5 h-3.5 text-[#C5A059]" />
                    <input
                      type="text"
                      placeholder="Search product..."
                      className="text-xs font-semibold bg-transparent border-none outline-none focus:ring-0 text-[#FAF7F2] placeholder:text-[#B8B5AE] w-full sm:w-[180px]"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {Object.keys(itemSales).length === 0 ? (
                  <div className="text-center text-[#B8B5AE] text-sm font-semibold py-12">
                    No products sold in this period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#181820]/80 border-b border-[#C5A059]/20">
                          <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                            Rank
                          </th>
                          <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                            Product Name
                          </th>
                          <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider text-right">
                            Qty Sold
                          </th>
                          <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider text-right">
                            Revenue
                          </th>
                          <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                            Market Share
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(itemSales).filter((item) =>
                          item.name
                            .toLowerCase()
                            .includes(productSearchQuery.toLowerCase()),
                        ).length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="text-center py-12 text-sm font-semibold text-[#B8B5AE]"
                            >
                              No matching products found.
                            </td>
                          </tr>
                        ) : (
                          Object.values(itemSales)
                            .filter((item) =>
                              item.name
                                .toLowerCase()
                                .includes(productSearchQuery.toLowerCase()),
                            )
                            .sort((a, b) => b.revenue - a.revenue)
                            .map((item, idx) => {
                              const share =
                                totalRevenueAmount > 0
                                  ? (item.revenue / totalRevenueAmount) * 100
                                  : 0;
                              return (
                                <tr
                                  key={item.name}
                                  className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                                >
                                  <td className="p-3 text-xs font-black text-[#C5A059]">
                                    {idx + 1}
                                  </td>
                                  <td className="p-3 text-xs font-bold text-[#FAF7F2]">
                                    {item.name}
                                  </td>
                                  <td className="p-3 text-xs font-bold text-[#FAF7F2] text-right">
                                    {item.qty} pcs
                                  </td>
                                  <td className="p-3 text-xs font-black text-[var(--accent)] text-right">
                                    ₹{item.revenue.toLocaleString()}
                                  </td>
                                  <td className="p-3 w-1/4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 h-2 bg-[#181820] rounded-full overflow-hidden border border-white/5">
                                        <div
                                          className="h-full bg-[var(--accent)] rounded-full"
                                          style={{ width: `${share}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-[#B8B5AE] w-8">
                                        {share.toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {analyticsSubTab === "coupons" && (
              <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
                <div className="col-span-1 w-full bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm flex flex-col gap-6">
                  <h3 className="font-bold text-[#FAF7F2] text-sm">
                    Discount Summary
                  </h3>

                  <div className="p-4 bg-[#181820] border border-[#C5A059]/20 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Total Discounts Given
                      </span>
                      <Percent className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <span className="text-2xl font-black text-[var(--accent)]">
                      ₹
                      {analyticsFilteredOrders
                        .reduce((acc, o) => acc + o.discount, 0)
                        .toLocaleString()}
                    </span>
                  </div>

                  <div className="p-4 bg-[#181820] border border-[#C5A059]/20 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Discounted Orders
                      </span>
                      <Calendar className="w-4 h-4 text-[#C5A059]" />
                    </div>
                    <span className="text-2xl font-black text-[#FAF7F2]">
                      {
                        analyticsFilteredOrders.filter((o) => o.discount > 0)
                          .length
                      }
                    </span>
                  </div>

                  <div className="p-4 bg-[#181820] border border-[#C5A059]/20 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                        Avg Discount Per Order
                      </span>
                      <IndianRupee className="w-4 h-4 text-[#10B981]" />
                    </div>
                    <span className="text-2xl font-black text-[#FAF7F2]">
                      ₹
                      {Math.round(
                        analyticsFilteredOrders.filter((o) => o.discount > 0)
                          .length > 0
                          ? analyticsFilteredOrders.reduce(
                              (acc, o) => acc + o.discount,
                              0,
                            ) /
                              analyticsFilteredOrders.filter(
                                (o) => o.discount > 0,
                              ).length
                          : 0,
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 w-full bg-[#131317] border border-[#C5A059]/20 rounded-xl p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h3 className="font-bold text-[#FAF7F2] text-sm">
                      Promo Campaign Performance
                    </h3>

                    {/* Coupons Search Input */}
                    <div className="flex items-center border border-[#C5A059]/30 bg-[#181820] rounded-lg px-3 py-1.5 gap-2 shadow-xs w-full sm:w-auto animate-in fade-in duration-200">
                      <Search className="w-3.5 h-3.5 text-[#C5A059]" />
                      <input
                        type="text"
                        placeholder="Search code/mobile/amount..."
                        className="text-xs font-semibold bg-transparent border-none outline-none focus:ring-0 text-[#FAF7F2] placeholder:text-[#B8B5AE] w-full sm:w-[220px]"
                        value={couponSearchQuery}
                        onChange={(e) => setCouponSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {analyticsFilteredOrders.filter((o) => o.discount > 0)
                    .length === 0 ? (
                    <div className="text-center text-[#B8B5AE] text-sm font-semibold py-12">
                      No promotional discounts given in this period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#181820]/80 border-b border-[#C5A059]/20">
                            <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                              Transaction ID
                            </th>
                            <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                              Customer Mobile
                            </th>
                            <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider text-right">
                              Order Total
                            </th>
                            <th className="p-3 text-[10px] font-bold text-[#C5A059] uppercase tracking-wider text-right">
                              Discount Applied
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsFilteredOrders
                            .filter((o) => o.discount > 0)
                            .filter((o) => {
                              const q = couponSearchQuery.toLowerCase();
                              const couponCode =
                                getCouponCodeForOrder(o).toLowerCase();
                              return (
                                o.id.toLowerCase().includes(q) ||
                                couponCode.includes(q) ||
                                (o.customerPhone || "").includes(q) ||
                                o.discount.toString().includes(q) ||
                                o.grandTotal.toString().includes(q)
                              );
                            }).length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="text-center py-12 text-sm font-semibold text-[#B8B5AE]"
                              >
                                No matching coupon performance records found.
                              </td>
                            </tr>
                          ) : (
                            analyticsFilteredOrders
                              .filter((o) => o.discount > 0)
                              .filter((o) => {
                                const q = couponSearchQuery.toLowerCase();
                                const couponCode =
                                  getCouponCodeForOrder(o).toLowerCase();
                                return (
                                  o.id.toLowerCase().includes(q) ||
                                  couponCode.includes(q) ||
                                  (o.customerPhone || "").includes(q) ||
                                  o.discount.toString().includes(q) ||
                                  o.grandTotal.toString().includes(q)
                                );
                              })
                              .map((order) => (
                                <tr
                                  key={order.id}
                                  className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                                >
                                  <td className="p-3 text-xs font-semibold text-[#FAF7F2]">
                                    {order.id}
                                  </td>
                                  <td className="p-3 text-xs font-mono font-bold text-[#FAF7F2]">
                                    {order.customerPhone || "-"}
                                  </td>
                                  <td className="p-3 text-xs font-bold text-right text-[#FAF7F2]">
                                    ₹{order.grandTotal.toLocaleString()}
                                  </td>
                                  <td className="p-3 text-xs font-black text-[#E5C378] text-right">
                                    -₹{order.discount.toLocaleString()}
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {role === "admin" && activeTab === "expenses" && (
          <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full pb-8 pr-2 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h2 className="text-[28px] font-black text-[#FAF7F2] tracking-tight flex items-center gap-3">
                  <Wallet className="w-7 h-7 text-[var(--accent)]" />
                  Expense Tracker
                </h2>
                <p className="text-xs text-[#B8B5AE] font-semibold mt-1">
                  Record what the shop spends. Expenses are offset against sales
                  to show your real Net Profit on the dashboard.
                </p>
              </div>
              {/* Period filter */}
              <div className="flex flex-wrap items-center gap-1.5 bg-[#181820] border border-[#C5A059]/20 rounded-xl p-1">
                {(
                  [
                    ["today", "Today"],
                    ["week", "Week"],
                    ["month", "Month"],
                    ["year", "Year"],
                    ["all", "All"],
                    ["custom", "Custom"],
                  ] as [PeriodKey, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setExpensePeriod(key);
                      if (key !== "custom") {
                        const range = getSelectedDateRange(
                          key,
                          expenses.map((expense) => expense.expense_date),
                        );
                        setExpenseStartDate(range.start ?? "");
                        setExpenseEndDate(range.end ?? "");
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      expensePeriod === key
                        ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black shadow-sm"
                        : "text-[#B8B5AE] hover:text-[#FAF7F2] hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-6 bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={expenseStartDate}
                  max={expenseEndDate || undefined}
                  onChange={(e) => {
                    setExpensePeriod("custom");
                    setExpenseStartDate(e.target.value);
                  }}
                  className="bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={expenseEndDate}
                  min={expenseStartDate || undefined}
                  onChange={(e) => {
                    setExpensePeriod("custom");
                    setExpenseEndDate(e.target.value);
                  }}
                  className="bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <p
                aria-live="polite"
                className={`basis-full text-[10px] font-semibold ${
                  expenseDateRange.valid ? "text-[#B8B5AE]" : "text-red-400"
                }`}
              >
                {expenseDateRangeLabel}
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl p-5 shadow-sm text-white bg-gradient-to-br from-[var(--accent)] to-[#181820] border border-[#C5A059]/30">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                    Total Expenses
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="text-2xl font-black">
                  ₹
                  {expenseStats.total.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-[9px] text-white/80 font-semibold mt-1 uppercase tracking-wider">
                  {expenseDateRangeLabel}
                </div>
              </div>
              <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-5 shadow-sm hover:border-[#C5A059]/40 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                    Entries
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-[#8A6815]" />
                  </div>
                </div>
                <div className="text-2xl font-black text-black">
                  {expenseStats.count}
                </div>
                <div className="text-[9px] text-zinc-500 font-semibold mt-1">
                  Expenses recorded
                </div>
              </div>
              <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-5 shadow-sm hover:border-[#C5A059]/40 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">
                    Top Category
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center">
                    <Tag className="w-4 h-4 text-[#8A6815]" />
                  </div>
                </div>
                <div className="text-lg font-black text-black truncate">
                  {expenseStats.topCategory}
                </div>
                <div className="text-[9px] text-zinc-500 font-semibold mt-1">
                  Highest spend
                </div>
              </div>
            </div>

            {/* Two-column: add form + category breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
              {/* Add expense form */}
              <div
                id="expense-form"
                className={`lg:col-span-2 bg-[#131317] border rounded-2xl p-5 shadow-sm h-fit scroll-mt-4 ${
                  editingExpenseId ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/15" : "border-[#C5A059]/20"
                }`}
              >
                <h3 className="text-sm font-black text-[#FAF7F2] uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                  {editingExpenseId ? "Edit Expense" : "Add Expense"}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                      What for?
                    </label>
                    <input
                      type="text"
                      value={expTitle}
                      onChange={(e) => setExpTitle(e.target.value)}
                      placeholder="e.g. October shop rent"
                      className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] placeholder:text-[#B8B5AE]/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={expAmount}
                        onChange={(e) =>
                          setExpAmount(
                            e.target.value === ""
                              ? ""
                              : parseFloat(e.target.value),
                          )
                        }
                        placeholder="0.00"
                        className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] placeholder:text-[#B8B5AE]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={expDate}
                        onChange={(e) => setExpDate(e.target.value)}
                        className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                      Category
                    </label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c} className="bg-[#181820] text-[#FAF7F2]">
                          {c}
                        </option>
                      ))}
                      <option value="__custom__" className="bg-[#181820] text-[#FAF7F2]">+ Custom category…</option>
                    </select>
                  </div>
                  {expCategory === "__custom__" && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                        Custom category name
                      </label>
                      <input
                        type="text"
                        value={expCustomCategory}
                        onChange={(e) => setExpCustomCategory(e.target.value)}
                        placeholder="e.g. Festival decorations"
                        className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] placeholder:text-[#B8B5AE]/50"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                      Paid via
                    </label>
                    <select
                      value={expPaymentMode}
                      onChange={(e) => setExpPaymentMode(e.target.value)}
                      className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                    >
                      {EXPENSE_PAYMENT_MODES.map((m) => (
                        <option key={m} value={m} className="bg-[#181820] text-[#FAF7F2]">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={expNotes}
                      onChange={(e) => setExpNotes(e.target.value)}
                      placeholder="Reference / supplier / bill no."
                      className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-lg px-3 py-2 text-sm text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] placeholder:text-[#B8B5AE]/50"
                    />
                  </div>
                  <button
                    onClick={handleAddExpense}
                    disabled={isSavingExpense}
                    className="w-full mt-1 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:opacity-90 disabled:opacity-60 text-[#0C0C0E] py-3 rounded-lg font-black text-[11px] uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-sm cursor-pointer"
                  >
                    {editingExpenseId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isSavingExpense
                      ? "Saving…"
                      : editingExpenseId
                        ? "Update Expense"
                        : "Add Expense"}
                  </button>
                  {editingExpenseId && (
                    <button
                      type="button"
                      onClick={cancelEditExpense}
                      disabled={isSavingExpense}
                      className="w-full bg-white/5 hover:bg-white/10 text-[#FAF7F2] py-2.5 rounded-lg font-black text-[11px] uppercase tracking-[0.1em] cursor-pointer transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Category breakdown */}
              <div className="lg:col-span-3 bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-black text-[#FAF7F2] uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                  Spend by Category
                </h3>
                {expenseStats.categoryBreakdown.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-[#C5A059]/15 flex items-center justify-center mx-auto mb-4">
                      <PiggyBank className="w-7 h-7 text-[#C5A059]" />
                    </div>
                    <p className="text-sm font-bold text-[#FAF7F2]">
                      No expenses in this period yet.
                    </p>
                    <p className="text-xs font-semibold text-[#B8B5AE] mt-1">
                      Add your first expense to see the breakdown.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenseStats.categoryBreakdown.map((row) => {
                      const max = expenseStats.categoryBreakdown[0].amount || 1;
                      const pct = expenseStats.total
                        ? (row.amount / expenseStats.total) * 100
                        : 0;
                      return (
                        <div key={row.category}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-black flex items-center gap-1.5">
                              <Tag className="w-3 h-3 text-[#8A6815]" />
                              {row.category}
                            </span>
                            <span className="text-xs font-black text-black">
                              ₹
                              {row.amount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              <span className="text-[10px] font-bold text-zinc-500 ml-1.5">
                                {pct.toFixed(0)}%
                              </span>
                            </span>
                          </div>
                          <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--accent)] to-[#D4AF37] rounded-full transition-all duration-700"
                              style={{ width: `${(row.amount / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Expenses list */}
            <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border-b border-[#C5A059]/20">
                <h3 className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                  <List className="w-4 h-4 text-[#8A6815]" />
                  Expense Log
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={expenseCategoryFilter}
                    onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                    className="bg-white border border-[#C5A059]/30 rounded-lg px-3 py-2 text-xs font-bold text-black focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                  >
                    <option value="ALL" className="bg-white text-black">All categories</option>
                    {expenseStats.allCategories.map((c) => (
                      <option key={c} value={c} className="bg-white text-black">
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#8A6815] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      placeholder="Search expenses…"
                      className="bg-white border border-[#C5A059]/30 rounded-lg pl-8 pr-3 py-2 text-xs text-black focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-400 w-44 shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {expenseStats.filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#C5A059]/15 flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-7 h-7 text-[#C5A059]" />
                  </div>
                  <p className="text-sm font-bold text-[#FAF7F2]">
                    No expenses found.
                  </p>
                  <p className="text-xs font-semibold text-[#B8B5AE] mt-1">
                    Try a different period or add a new expense.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead className="bg-[#181820]/80 border-b border-[#C5A059]/20 select-none">
                      <tr>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">
                          Date
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">
                          Expense
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">
                          Category
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">
                          Paid via
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider text-right">
                          Amount
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider text-center">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseStats.filtered.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-zinc-200/80 hover:bg-[#FAF8F5] transition-colors"
                        >
                          <td className="p-3 text-xs font-semibold text-black whitespace-nowrap">
                            {new Date(e.expense_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="p-3">
                            <p className="text-sm font-bold text-black">
                              {e.title}
                            </p>
                            {e.notes && (
                              <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                                {e.notes}
                              </p>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-black bg-[#FAF8F5] border border-[#C5A059]/40 px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                              <Tag className="w-3 h-3 text-[#8A6815]" />
                              {e.category}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-zinc-700">
                              <Banknote className="w-3 h-3 text-zinc-500" />
                              {e.payment_mode}
                            </span>
                          </td>
                          <td className="p-3 text-right text-sm font-black text-[#DC2626] whitespace-nowrap">
                            − ₹
                            {e.amount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => startEditExpense(e)}
                                title="Edit expense"
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${
                                  editingExpenseId === e.id
                                    ? "bg-[var(--accent)] text-[#0C0C0E] font-bold"
                                    : "bg-white/5 hover:bg-white/10 text-[#FAF7F2]"
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(e.id)}
                                title="Delete expense"
                                className="inline-flex items-center justify-center w-8 h-8 bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#181820]/80 border-t border-[#C5A059]/20">
                        <td
                          colSpan={4}
                          className="p-3 text-[10px] font-black text-[#FAF7F2] uppercase tracking-wider text-right"
                        >
                          Total ({expensePeriod})
                        </td>
                        <td className="p-3 text-right text-sm font-black text-[#EF4444] whitespace-nowrap">
                          − ₹
                          {expenseStats.total.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {role === "admin" && activeTab === "inventory" && (
          <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full pb-8 pr-2 animate-in fade-in duration-300">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h2 className="text-[28px] font-black text-[#FAF7F2] tracking-tight flex items-center gap-3">
                  <Boxes className="w-7 h-7 text-[var(--accent)]" />
                  Inventory
                </h2>
                <p className="text-xs text-[#B8B5AE] font-semibold mt-1">
                  Manage products and categories — add, edit and delete.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1 lg:flex-none">
                  <Search className="w-3.5 h-3.5 text-[#C5A059] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search products…"
                    className="pl-9 pr-3 py-2 bg-[#181820] border border-[#C5A059]/30 rounded-lg text-xs font-semibold text-[#FAF7F2] placeholder:text-[#B8B5AE] focus:outline-none focus:border-[var(--accent)] w-full lg:w-48"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                  />
                </div>
                <button
                  onClick={exportInventoryCSV}
                  className="text-[10px] font-bold text-[#FAF7F2] bg-[#181820] border border-[#C5A059]/30 hover:bg-white/5 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--accent)]" /> Inventory CSV
                </button>
                <button
                  onClick={() => {
                    setNewCategoryName("");
                    setEditingCategoryId(null);
                    setEditCategoryName("");
                    setShowCategoryModal(true);
                  }}
                  className="text-[10px] font-bold text-[var(--accent)] bg-[#181820] border border-[var(--accent)]/40 hover:bg-[var(--accent)]/10 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" /> Manage Categories
                </button>
                <button
                  onClick={() => {
                    resetCatalogForm();
                    setNewCatType("SERVICE");
                    setEditingCatalogId(null);
                    setCatalogTargetRowId(null);
                    setShowCatalogModal(true);
                  }}
                  className="text-[10px] font-black text-[#0C0C0E] bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:opacity-90 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Scissors className="w-3.5 h-3.5" /> Add Service
                </button>
                <button
                  onClick={() => {
                    resetCatalogForm();
                    setNewCatType("PRODUCT");
                    setEditingCatalogId(null);
                    setCatalogTargetRowId(null);
                    setShowCatalogModal(true);
                  }}
                  className="text-[10px] font-black text-[#0C0C0E] bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:opacity-90 px-3 py-2 rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product
                </button>
              </div>
            </div>

            {inventoryProducts.length === 0 ? (
              <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-[var(--accent)]/15 flex items-center justify-center mx-auto mb-4">
                  <Boxes className="w-7 h-7 text-[var(--accent)]" />
                </div>
                <p className="text-base font-bold text-[#FAF7F2]">
                  No products yet.
                </p>
                <p className="text-xs font-semibold text-[#B8B5AE] mt-1 mb-4">
                  Add your first product or service to start managing your catalog.
                </p>
                <button
                  onClick={() => {
                    resetCatalogForm();
                    setEditingCatalogId(null);
                    setCatalogTargetRowId(null);
                    setShowCatalogModal(true);
                  }}
                  className="text-[10px] font-black text-[#0C0C0E] bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:opacity-90 px-4 py-2 rounded-lg uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Product
                </button>
              </div>
            ) : (
              <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-[#181820]/80 border-b border-[#C5A059]/20 select-none">
                      <tr>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">
                          Product
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">
                          Type
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider text-right">
                          Stock
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider text-right">
                          Price
                        </th>
                        <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredInventory.map((p) => {
                        const isExpanded = expandedProductId === p.id;
                        return (
                          <React.Fragment key={p.id}>
                            <tr
                              className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                              onClick={() =>
                                setExpandedProductId(isExpanded ? null : p.id)
                              }
                            >
                              <td className="p-3">
                                <div className="flex items-start gap-2.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedProductId(isExpanded ? null : p.id);
                                    }}
                                    className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                                      isExpanded
                                        ? "bg-[var(--accent)] text-[#0C0C0E] shadow-xs"
                                        : "bg-white/5 hover:bg-white/10 text-[#B8B5AE] hover:text-[#FAF7F2]"
                                    }`}
                                    title={
                                      isExpanded
                                        ? "Click to collapse details"
                                        : "Click dropdown to open product details"
                                    }
                                    aria-label="Toggle details dropdown"
                                  >
                                    <ChevronDown
                                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                        isExpanded ? "rotate-180 text-[#0C0C0E]" : ""
                                      }`}
                                    />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-[#FAF7F2] flex items-center gap-2 flex-wrap">
                                      <span>{p.name}</span>
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedProductId(isExpanded ? null : p.id);
                                        }}
                                        className="text-[9px] text-[var(--accent)] hover:underline font-bold cursor-pointer inline-flex items-center gap-0.5"
                                      >
                                        {isExpanded ? "▲ Hide Details" : "▼ Open in detail"}
                                      </span>
                                    </div>
                                    {p.desc && (
                                      <div className="text-[10px] font-semibold text-[#B8B5AE] mt-0.5">
                                        {p.desc}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border inline-block ${
                                    p.itemType === "SERVICE"
                                      ? "text-[var(--accent-strong)] bg-[var(--accent-strong)]/10 border-[var(--accent-strong)]/25"
                                      : "text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/25"
                                  }`}
                                >
                                  {p.itemType === "SERVICE" ? "Service" : "Product"}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {p.itemType === "SERVICE" ? (
                                  <span className="text-[10px] font-semibold text-[#B8B5AE]/40">
                                    —
                                  </span>
                                ) : (
                                  (() => {
                                    const stock = Number(p.stock) || 0;
                                    const alertAt = p.lowStockAlert;
                                    const isLow =
                                      alertAt !== null &&
                                      alertAt !== undefined &&
                                      stock <= Number(alertAt);
                                    return (
                                      <span
                                        className={`text-sm font-black ${
                                          isLow ? "text-[#EF4444]" : "text-[#FAF7F2]"
                                        }`}
                                      >
                                        {stock}
                                        {isLow && (
                                          <span className="text-[9px] font-bold uppercase tracking-wider ml-1">
                                            Low
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })()
                                )}
                              </td>
                              <td className="p-3 text-right text-sm font-black text-[#FAF7F2]">
                                ₹
                                {(p.price ?? 0).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                                {(p.offerPct ?? 0) > 0 && (
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#10B981]">
                                    −{p.offerPct}% → ₹
                                    {(p.offerPrice ?? 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div
                                  className="flex justify-end gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1 ${
                                      isExpanded
                                        ? "bg-[var(--accent)] text-[#0C0C0E] shadow-xs"
                                        : "text-[var(--accent)] hover:bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                                    }`}
                                    title={
                                      isExpanded
                                        ? "Collapse product details"
                                        : "Open product details"
                                    }
                                  >
                                    <ChevronDown
                                      className={`w-3 h-3 transition-transform duration-200 ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                    {isExpanded ? "Close" : "Details"}
                                  </button>
                                  <button
                                    onClick={() => openEditCatalog(p)}
                                    className="text-[10px] font-bold text-[var(--accent)] hover:text-[#0C0C0E] hover:bg-[var(--accent)] border border-[var(--accent)]/30 px-2.5 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Pencil className="w-3 h-3" /> Edit
                                  </button>
                                  {p.itemType !== "SERVICE" && (
                                    <button
                                      onClick={() => openStockAdjust(p)}
                                      className="text-[10px] font-bold text-[#FAF7F2] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 border border-white/10 px-2.5 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1"
                                      title="Adjust stock — restock, return, loss or reconcile"
                                    >
                                      <SlidersHorizontal className="w-3 h-3" /> Stock
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Delete "${p.name}" from inventory? This cannot be undone.`,
                                        )
                                      ) {
                                        deleteFromCatalog(p.id);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-[#EF4444] hover:text-white hover:bg-[#EF4444] border border-[#EF4444]/30 px-2.5 py-1.5 rounded uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-[#181820]/60 border-b border-white/5">
                                <td colSpan={5} className="p-4">
                                  <div className="bg-[#131317] border border-[#C5A059]/20 rounded-xl p-4 shadow-sm">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-white/5">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                                        <h4 className="text-xs font-black text-[#FAF7F2] uppercase tracking-wider">
                                          Product Detail — {p.name}
                                        </h4>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => openEditCatalog(p)}
                                          className="text-[10px] font-black text-[#0C0C0E] bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:opacity-90 px-3 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                                        >
                                          <Pencil className="w-3 h-3" /> Edit
                                        </button>
                                        {p.itemType !== "SERVICE" && (
                                          <button
                                            onClick={() => openStockAdjust(p)}
                                            className="text-[10px] font-bold text-[#FAF7F2] bg-[#181820] hover:bg-[var(--accent)] hover:text-[#0C0C0E] border border-[#C5A059]/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                            title="Adjust stock — restock, return, loss or reconcile"
                                          >
                                            <SlidersHorizontal className="w-3 h-3" /> Adjust Stock
                                          </button>
                                        )}
                                        <button
                                          onClick={() => setExpandedProductId(null)}
                                          className="text-[10px] font-bold text-[#B8B5AE] hover:text-[#FAF7F2] bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                        >
                                          Close
                                        </button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                                      <div>
                                        <div className="text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-0.5">
                                          Selling Price
                                        </div>
                                        <div className="font-black text-[#FAF7F2]">
                                          ₹
                                          {(p.price ?? 0).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                          })}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-0.5">
                                          Category
                                        </div>
                                        <div className="font-bold text-[#FAF7F2]">
                                          {p.category || "General"}
                                        </div>
                                      </div>
                                      {p.desc && (
                                        <div className="col-span-2 sm:col-span-3">
                                          <div className="text-[9px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-0.5">
                                            Description
                                          </div>
                                          <div className="font-semibold text-[#B8B5AE]">
                                            {p.desc}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {filteredInventory.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-8 text-center text-xs font-semibold text-[#B8B5AE]"
                          >
                            No products match &quot;{inventorySearch}&quot;.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order Details Modal */}
        {selectedOrder && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#131317] border border-[#C5A059]/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[#C5A059]/20 flex justify-between items-center bg-[#181820]">
                <div>
                  <h3 className="text-xl font-bold text-[#FAF7F2]">
                    Order Details
                  </h3>
                  <p className="text-sm text-[#B8B5AE] font-mono mt-1">
                    {selectedOrder.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  aria-label="Close dialog"
                  title="Close (Esc)"
                >
                  <X className="w-4.5 h-4.5 text-zinc-700" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <div className="text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                      Customer Name
                    </div>
                    <div className="text-sm font-semibold text-[#FAF7F2]">
                      {selectedOrder.customerName}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                      Contact Number
                    </div>
                    <div className="text-sm font-semibold text-[#FAF7F2] font-mono">
                      {selectedOrder.customerPhone || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                      Address
                    </div>
                    <div className="text-sm font-semibold text-[#FAF7F2]">
                      {selectedOrder.customerAddress || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                      Order Source
                    </div>
                    <div className="text-sm font-semibold text-[#FAF7F2]">
                      {selectedOrder.source}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                      Bill Type
                    </div>
                    <span
                      className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border ${selectedOrder.isGst ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30" : "bg-white/5 text-[#FAF7F2] border-white/10"}`}
                    >
                      {selectedOrder.isGst ? "GST Invoice" : "Non-GST Bill"}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#B8B5AE] uppercase tracking-wider mb-1">
                      Date & Time
                    </div>
                    <div className="text-sm font-semibold text-[#FAF7F2]">
                      {new Date(selectedOrder.date).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mb-4 text-[11px] font-bold text-[#C5A059] uppercase tracking-[0.1em] border-b border-[#C5A059]/20 pb-2">
                  Order Items
                </div>
                <div className="space-y-3 mb-8">
                  {selectedOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center py-1 border-b border-white/5"
                    >
                      <div>
                        <div className="text-sm font-bold text-[#FAF7F2]">
                          {item.name}
                        </div>
                        {item.desc && (
                          <div className="text-[10px] text-[#B8B5AE] font-medium">
                            {item.desc}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#FAF7F2]">
                          ₹{(item.price * item.qty).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#B8B5AE] font-medium">
                          {item.qty} x ₹{item.price.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#C5A059]/20 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#B8B5AE] font-semibold">
                      Subtotal
                    </span>
                    <span className="text-[#FAF7F2] font-bold">
                      ₹{selectedOrder.subtotal.toLocaleString()}
                    </span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#B8B5AE] font-semibold">
                        Discount
                      </span>
                      <span className="text-[#E5C378] font-bold">
                        -₹{selectedOrder.discount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {(selectedOrder.gstAmount ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#B8B5AE] font-semibold">
                          CGST ({((selectedOrder.gstPercentage ?? 0) / 2).toFixed(1).replace(/\.0$/, "")}%)
                        </span>
                        <span className="text-[#FAF7F2] font-bold">
                          ₹{((selectedOrder.gstAmount ?? 0) / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#B8B5AE] font-semibold">
                          SGST ({((selectedOrder.gstPercentage ?? 0) / 2).toFixed(1).replace(/\.0$/, "")}%)
                        </span>
                        <span className="text-[#FAF7F2] font-bold">
                          ₹{((selectedOrder.gstAmount ?? 0) / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}
                  {selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#B8B5AE] font-semibold">
                        Delivery Fee
                      </span>
                      <span className="text-[#FAF7F2] font-bold">
                        ₹{selectedOrder.deliveryFee.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg pt-2 mt-2 border-t border-[#C5A059]/20">
                    <span className="text-[#FAF7F2] font-black uppercase tracking-tight">
                      Total{" "}
                    </span>
                    <span className="text-[var(--accent)] font-black">
                      ₹{selectedOrder.grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#181820] border-t border-[#C5A059]/20 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2.5 rounded-xl border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Modal */}
        {(activeInvoiceId || activeAdvanceBillId) && (() => {
          const previewId = activeAdvanceBillId ?? activeInvoiceId;
          const previewPath = activeAdvanceBillId
            ? `/advance/${activeAdvanceBillId}`
            : `/invoice/${activeInvoiceId}`;
          const closePreview = () => {
            setActiveInvoiceId(null);
            setActiveAdvanceBillId(null);
          };
          return (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[400] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
            onClick={closePreview}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#131317] rounded-xl shadow-2xl w-full max-w-4xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden border border-[#C5A059]/30 transform scale-100 animate-in zoom-in-95 duration-150"
            >
              <div className="px-4 py-2.5 flex justify-between items-center bg-[#0A0A0C] text-[#FAF7F2] border-b border-[#C5A059]/20 shrink-0">
                <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-[#FAF7F2]">
                  <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Invoice Preview • #{previewId}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={previewPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-[#B8B5AE] hover:text-[#FAF7F2] px-2.5 py-1 bg-[#181820] hover:bg-[#22222c] border border-[#C5A059]/30 rounded transition-colors"
                  >
                    Open Full Page ↗
                  </a>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                    aria-label="Close preview"
                    title="Close (Esc)"
                  >
                    <X className="w-4.5 h-4.5 text-zinc-700" />
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-[#0A0A0C] overflow-hidden relative">
                <iframe
                  src={`${previewPath}?embed=true`}
                  className="w-full h-full border-none absolute inset-0"
                  title={`Invoice ${previewId}`}
                />
              </div>
            </div>
          </div>
          );
        })()}

        {/* Print Settings Modal */}
        {printModalData && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPrintModalData(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#131317] border border-[#C5A059]/30 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200"
            >
              <div className="bg-[#181820] px-5 py-4 flex items-center justify-between border-b border-[#C5A059]/20">
                <h3 className="font-bold text-[#FAF7F2] text-sm uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[var(--accent)]" />
                  Print Settings
                </h3>
                <button
                  type="button"
                  onClick={() => setPrintModalData(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  aria-label="Close dialog"
                  title="Close (Esc)"
                >
                  <X className="w-4.5 h-4.5 text-zinc-700" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-xs font-black text-[#FAF7F2] uppercase tracking-wider mb-3">Printer Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPrintPrefs({ ...printPrefs, paper: "thermal", size: printPrefs.size === "a4" || printPrefs.size === "a5" ? "80" : printPrefs.size })}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${printPrefs.paper === "thermal" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[#C5A059]/20 hover:border-[#C5A059]/40 bg-[#181820] text-[#B8B5AE]"}`}
                    >
                      <span className="font-bold text-sm">Thermal Roll</span>
                    </button>
                    <button
                      onClick={() => setPrintPrefs({ ...printPrefs, paper: "a4", size: printPrefs.size === "58" || printPrefs.size === "80" ? "a4" : printPrefs.size })}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${printPrefs.paper === "a4" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[#C5A059]/20 hover:border-[#C5A059]/40 bg-[#181820] text-[#B8B5AE]"}`}
                    >
                      <span className="font-bold text-sm">Sheet (A4/A5)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#FAF7F2] uppercase tracking-wider mb-3">Paper Size</label>
                  <div className="grid grid-cols-2 gap-3">
                    {printPrefs.paper === "thermal" ? (
                      <>
                        <button onClick={() => setPrintPrefs({ ...printPrefs, size: "58" })} className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${printPrefs.size === "58" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[#C5A059]/20 hover:border-[#C5A059]/40 bg-[#181820] text-[#B8B5AE]"}`}>58 mm</button>
                        <button onClick={() => setPrintPrefs({ ...printPrefs, size: "80" })} className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${printPrefs.size === "80" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[#C5A059]/20 hover:border-[#C5A059]/40 bg-[#181820] text-[#B8B5AE]"}`}>80 mm</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setPrintPrefs({ ...printPrefs, size: "a4" })} className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${printPrefs.size === "a4" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[#C5A059]/20 hover:border-[#C5A059]/40 bg-[#181820] text-[#B8B5AE]"}`}>A4 Sheet</button>
                        <button onClick={() => setPrintPrefs({ ...printPrefs, size: "a5" })} className={`py-2 rounded-lg border-2 font-bold text-xs transition-all cursor-pointer ${printPrefs.size === "a5" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[#C5A059]/20 hover:border-[#C5A059]/40 bg-[#181820] text-[#B8B5AE]"}`}>A5 Sheet</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-[#181820] px-6 py-4 flex justify-end border-t border-[#C5A059]/20 gap-3">
                <button
                  onClick={() => setPrintModalData(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-[#B8B5AE] hover:text-[#FAF7F2] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("shalistone_print_prefs", JSON.stringify(printPrefs));
                    const baseUrl = printModalData.type === "invoice" ? `/invoice/${printModalData.id}` : `/advance/${printModalData.id}`;
                    window.open(`${baseUrl}?print=true&paper=${printPrefs.paper}&size=${printPrefs.size}`, "_blank");
                    setPrintModalData(null);
                  }}
                  className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:opacity-90 text-[#0C0C0E] shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Now
                </button>
              </div>
            </div>
          </div>
        )}

        {role === "admin" && showLowStockAlarm && lowStockItems.length > 0 && (
          <LowStockAlarm items={lowStockItems} onClose={() => setShowLowStockAlarm(false)} />
        )}

        {/* ── Birthdays tab ────────────────────────────────────────── */}
        {activeTab === "birthdays" && (
          <BirthdayPanel
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(true)}
          />
        )}

        {/* ── Coupons tab ──────────────────────────────────────────── */}
        {activeTab === "coupons" && (
          <div className="space-y-6">
            <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-[#FAF7F2] uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-5 h-5 text-[var(--accent)]" />
                    Coupons &amp; Promotions
                  </h2>
                  <p className="text-xs text-[#B8B5AE] mt-1">
                    Track coupon redemption, discount analytics, and promotional campaign performance.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab("analytics");
                    setAnalyticsSubTab("coupons");
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                >
                  View Full Analytics
                </button>
              </div>

              {/* Coupons List / Performance View */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#181820] border border-[#C5A059]/20 rounded-xl p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">Available Coupons</span>
                  <div className="text-2xl font-black text-[#FAF7F2] mt-1">{coupons.filter(c => c.code !== "none").length}</div>
                  <span className="text-[10px] text-[var(--accent)] font-semibold mt-1 block">Active in Billing Panel</span>
                </div>
                <div className="bg-[#181820] border border-[#C5A059]/20 rounded-xl p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">Total Discount Given</span>
                  <div className="text-2xl font-black text-[#E5C378] mt-1">
                    ₹{orders.reduce((sum, o) => sum + (o.discount || 0), 0).toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-[#B8B5AE] font-semibold mt-1 block">All completed bills</span>
                </div>
                <div className="bg-[#181820] border border-[#C5A059]/20 rounded-xl p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8B5AE]">Orders with Discount</span>
                  <div className="text-2xl font-black text-[#FAF7F2] mt-1">
                    {orders.filter(o => o.discount > 0).length}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold mt-1 block">Customer incentives</span>
                </div>
              </div>

              {/* Coupon Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-[#181820]/80 border-b border-[#C5A059]/20 select-none">
                    <tr>
                      <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">Coupon Code</th>
                      <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider">Type</th>
                      <th className="p-3 text-[10px] font-black text-[#C5A059] uppercase tracking-wider text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {coupons.filter(c => c.code !== "none").map(c => (
                      <tr key={c.code} className="hover:bg-white/[0.03]">
                        <td className="p-3 font-mono font-bold text-xs text-[var(--accent)]">{c.code}</td>
                        <td className="p-3 text-xs font-semibold text-[#FAF7F2] capitalize">{c.type}</td>
                        <td className="p-3 text-xs font-bold text-[#FAF7F2] text-right">
                          {c.type === "percent" ? `${c.value}%` : `₹${c.value}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Attendance tab (admin: full panel, staff: punch in/out) ── */}
        {activeTab === "attendance" &&
          (role === "admin" ? <AttendancePanel /> : role === "staff" ? <StaffPunch /> : null)}

        {/* ── Settings tab (admin only) ─────────────────────────────── */}
        {role === "admin" && activeTab === "settings" && (
          <SettingsPanel
            shop={shopSettings}
            products={catalog.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.desc ?? null,
              category: c.category ?? "General",
              gst_rate: c.gstRate ?? 0,
              hsn_code: c.hsnCode ?? null,
              selling_price: c.price ?? 0,
              item_type: c.itemType ?? "PRODUCT",
              cost_price: c.costPrice ?? 0,
              current_stock: c.stock ?? null,
              low_stock_alert: c.lowStockAlert ?? null,
              offer_discount_pct: c.offerPct ?? 0,
              offer_price: c.offerPrice ?? null,
              is_active: c.isActive ?? true,
              created_at: "",
            }))}
            categories={categories}
            onSaved={setShopSettings}
            onCatalogueChanged={fetchData}
            onOpenInventory={() => {
              setActiveTab("inventory");
              setCompletedBillData(null);
              if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
          />
        )}

        {/* Classy Footer */}
        <footer className="mt-auto pt-6 pb-3 border-t border-[#C5A059]/20 grid grid-cols-1 md:grid-cols-3 items-center text-[10px] text-[#B8B5AE] font-semibold gap-4">
          <div className="text-[#B8B5AE]">
            © {new Date().getFullYear()} All Rights Reserved. {shopSettings.shop_name}.
          </div>
          <div className="text-center text-sm font-semibold tracking-normal normal-case text-[#7D8B7A]">
            Powered by{" "}
            <a
              href="https://www.cenexasystems.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-inherit hover:underline font-semibold transition-all"
            >
              Cenexa Systems
            </a>{" "}
            © {new Date().getFullYear()}
          </div>
          <div className="italic text-tertiary font-bold tracking-[0.15em] flex items-center gap-1.5 md:justify-end">
            <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full"></span>
            {(!shopSettings.tagline || shopSettings.tagline === "THE PRECIOUS PEARLS") ? "POS & INVENTORY MANAGEMENT" : shopSettings.tagline}
          </div>
        </footer>
      </main>
    </div>
  );
}
