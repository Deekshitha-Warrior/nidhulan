"use server";

import { dbStore } from "@/lib/dbStore";
import {
  checkDatabaseConnection,
  getSanitizedSupabaseUrl,
  isDatabaseConfigured,
} from "@/lib/db";
import { Product, OrderWithRelations, CartItem, Expense, PaymentMode, Category, AdvanceOrderWithRelations, AdvanceOrderStatus, ShopSettings, ItemType, Staff, AttendanceRecord, AttendanceStatus, Customer, Offer, BirthdaySettings, BirthdayLog } from "@/lib/types";
import { getShopSettings, saveShopSettings, normalizeHex, DEFAULT_ACCENT } from "@/lib/shopSettings";

// Helper to serialize Date objects from Postgres to strings
function serialize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}

export async function verifyPasscode(enteredPasscode: string): Promise<{ success: boolean; role?: 'staff' | 'admin' }> {
  const adminPasscode = process.env.ADMIN_PASSCODE || "admin123";
  const staffPasscode = process.env.STAFF_PASSCODE || process.env.NEXT_PUBLIC_STAFF_PASSCODE || "staff123";

  const normalizedEntered = enteredPasscode.replace(/\s/g, "");

  if (normalizedEntered === adminPasscode) {
    return { success: true, role: 'admin' };
  }
  if (normalizedEntered === staffPasscode) {
    return { success: true, role: 'staff' };
  }

  return { success: false };
}

// Categories
export async function fetchCategories(): Promise<Category[]> {
  return serialize(await dbStore.listCategories());
}

export async function createCategory(name: string): Promise<Category> {
  return serialize(await dbStore.addCategory(name.trim()));
}

export async function renameCategory(id: string, name: string): Promise<Category | null> {
  return serialize(await dbStore.updateCategory(id, name.trim()));
}

export async function removeCategory(id: string): Promise<void> {
  return await dbStore.deleteCategory(id);
}

// Products
export async function fetchProducts(): Promise<Product[]> {
  return serialize(await dbStore.listProducts());
}

// Blank or non-numeric form values arrive as NaN; never let them reach SQL.
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : num(v);

export async function createProduct(data: { name: string; description: string | null; category: string; gst_rate: number; hsn_code: string | null; selling_price: number; item_type?: ItemType; cost_price?: number; current_stock?: number | null; low_stock_alert?: number | null; offer_discount_pct?: number; offer_price?: number | null; is_active?: boolean }): Promise<Product> {
  const name = data.name.trim();
  if (!name) throw new Error("Product name is required");
  return serialize(
    await dbStore.addProduct({
      ...data,
      name,
      category: data.category.trim() || "General",
      gst_rate: Math.max(0, num(data.gst_rate)),
      selling_price: Math.max(0, num(data.selling_price)),
      cost_price: Math.max(0, num(data.cost_price)),
      current_stock: numOrNull(data.current_stock),
      low_stock_alert: numOrNull(data.low_stock_alert),
      offer_discount_pct: Math.min(100, Math.max(0, num(data.offer_discount_pct))),
      offer_price: numOrNull(data.offer_price),
    }),
  );
}

export async function editProduct(id: string, data: Partial<Product>): Promise<Product | null> {
  return serialize(await dbStore.updateProduct(id, data));
}

export async function removeProduct(id: string): Promise<void> {
  return await dbStore.deleteProduct(id);
}

// Orders
export async function fetchOrders(): Promise<OrderWithRelations[]> {
  return serialize(await dbStore.listOrdersWithRelations());
}

export async function fetchOrderById(id: string): Promise<OrderWithRelations | null> {
  return serialize(await dbStore.getOrderWithRelations(id));
}

export async function orderIdExists(id: string): Promise<boolean> {
  return await dbStore.orderIdExists(id);
}

export async function submitOrder(payload: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  source: 'ONLINE' | 'OFFLINE';
  isGst: boolean;
  billDate: string;
  items: CartItem[];
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  gstPercentage: number;
  gstAmount: number;
  deliveryFee: number;
  grandTotal: number;
  cashReceived: number;
  splitCash?: number;
  splitGpay?: number;
  paymentMode: PaymentMode;
}): Promise<{ orderId: string } | { error: string }> {
  try {
    return await dbStore.submitOrder(payload);
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] submitOrder failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err,
    );
    return { error: "Could not save the sale. Check the database setup and try again." };
  }
}

export async function removeOrder(id: string): Promise<void> {
  return await dbStore.deleteOrder(id);
}

// Expenses
export async function fetchExpenses(): Promise<Expense[]> {
  return serialize(await dbStore.listExpenses());
}

export async function createExpense(data: {
  title: string;
  category: string;
  amount: number;
  payment_mode: string;
  notes: string | null;
  expense_date: string;
}): Promise<Expense> {
  return serialize(await dbStore.addExpense(data));
}

export async function editExpense(id: string, data: Partial<Expense>): Promise<Expense | null> {
  return serialize(await dbStore.updateExpense(id, data));
}

export async function removeExpense(id: string): Promise<void> {
  return await dbStore.deleteExpense(id);
}

// Advance Orders (partial-payment holds — not revenue until finalized)
export async function fetchAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
  return serialize(await dbStore.listAdvanceOrders());
}

export async function fetchAdvanceOrderById(id: string): Promise<AdvanceOrderWithRelations | null> {
  return serialize(await dbStore.getAdvanceOrder(id));
}

export async function advanceOrderIdExists(id: string): Promise<boolean> {
  return await dbStore.advanceOrderIdExists(id);
}

export async function createAdvanceOrder(payload: {
  advanceOrderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  subtotal: number;
  totalAmount: number;
  depositAmount: number;
  depositPaymentMode: PaymentMode;
  deliveryDate: string | null;
  notes: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  deliveryFee: number;
  isGst: boolean;
  gstPercentage: number;
  gstAmount: number;
  items: {
    product_id: string | null;
    snapshot_name: string;
    snapshot_desc: string | null;
    snapshot_price: number;
    quantity: number;
  }[];
}): Promise<{ advanceOrderId: string }> {
  return await dbStore.createAdvanceOrder({
    ...payload,
    discountType: payload.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED',
    discountValue: Math.max(0, num(payload.discountValue)),
    discountAmount: Math.max(0, num(payload.discountAmount)),
    deliveryFee: Math.max(0, num(payload.deliveryFee)),
    isGst: Boolean(payload.isGst),
    gstPercentage: Math.max(0, num(payload.gstPercentage)),
    gstAmount: Math.max(0, num(payload.gstAmount)),
  });
}

export async function setAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
  return await dbStore.updateAdvanceOrderStatus(id, status);
}

export async function cancelAdvanceOrder(id: string): Promise<void> {
  return await dbStore.cancelAdvanceOrder(id);
}

export async function removeAdvanceOrder(id: string): Promise<void> {
  return await dbStore.deleteAdvanceOrder(id);
}

export async function finalizeAdvanceOrder(payload: {
  advanceOrderId: string;
  invoiceId: string;
  isGst: boolean;
  gstPercentage: number;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  deliveryFee: number;
  paymentMode: PaymentMode;
  billDate: string;
}): Promise<{ orderId: string }> {
  return await dbStore.finalizeAdvanceOrder(payload);
}

// Shop settings (single profile row)
export async function fetchShopSettings(): Promise<ShopSettings> {
  return serialize(await getShopSettings());
}

export async function updateShopSettings(data: ShopSettings): Promise<ShopSettings> {
  const clean: ShopSettings = {
    owner_name: data.owner_name.trim(),
    shop_name: data.shop_name.trim() || "My Shop",
    tagline: data.tagline.trim(),
    phone: data.phone.trim(),
    owner_phone: data.owner_phone.trim(),
    email: data.email.trim(),
    address: data.address.trim(),
    location: data.location.trim(),
    instagram_url: data.instagram_url.trim(),
    business_hours: data.business_hours.trim(),
    services: data.services.trim(),
    gstin: data.gstin.trim(),
    accent_color: normalizeHex(data.accent_color) || DEFAULT_ACCENT,
    logo_data_url: data.logo_data_url || null,
  };
  return serialize(await saveShopSettings(clean));
}

// Staff & attendance
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"];

function assertDate(date: string): string {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`);
  return date;
}

type StaffInput = { name: string; role: string; phone: string; base_salary: number; is_active: boolean };

function cleanStaff(data: StaffInput): StaffInput {
  const name = data.name.trim();
  if (!name) throw new Error("Staff name is required");
  return {
    name,
    role: data.role.trim(),
    phone: data.phone.replace(/\D/g, "").slice(-10),
    base_salary: Math.max(0, Number(data.base_salary) || 0),
    is_active: Boolean(data.is_active),
  };
}

export async function fetchStaff(): Promise<Staff[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    return serialize(await dbStore.listStaff());
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] fetchStaff failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function createStaff(data: StaffInput): Promise<Staff> {
  try {
    return serialize(await dbStore.addStaff(cleanStaff(data)));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] createStaff failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not add staff member to database."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function editStaff(id: string, data: StaffInput): Promise<Staff | null> {
  try {
    return serialize(await dbStore.updateStaff(id, cleanStaff(data)));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] editStaff failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not update staff member in database."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function removeStaff(id: string): Promise<void> {
  try {
    return await dbStore.deleteStaff(id);
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] removeStaff failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not delete staff member from database."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function fetchAttendance(fromDate: string, toDate: string): Promise<AttendanceRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    return serialize(await dbStore.listAttendance(assertDate(fromDate), assertDate(toDate)));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] fetchAttendance failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function setAttendanceStatus(
  staffId: string,
  date: string,
  status: AttendanceStatus | null,
): Promise<void> {
  if (status !== null && !ATTENDANCE_STATUSES.includes(status)) {
    throw new Error(`Invalid attendance status: ${status}`);
  }
  try {
    return await dbStore.setAttendanceStatus(staffId, assertDate(date), status);
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] setAttendanceStatus failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not update attendance status."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function clockInStaff(staffId: string, date: string): Promise<void> {
  try {
    return await dbStore.clockIn(staffId, assertDate(date));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] clockInStaff failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not record clock in."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function clockOutStaff(staffId: string, date: string): Promise<void> {
  try {
    return await dbStore.clockOut(staffId, assertDate(date));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] clockOutStaff failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not record clock out."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

// Customers
export async function fetchCustomers(search?: string): Promise<Customer[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    return serialize(await dbStore.listCustomers(search));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] fetchCustomers failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  address?: string | null;
  dob?: string | null;
}): Promise<Customer> {
  const name = data.name.trim();
  const phone = data.phone.replace(/\D/g, "").slice(-10);
  if (!name) throw new Error("Customer name is required");
  if (!phone || phone.length < 10) throw new Error("Valid 10-digit phone number is required");
  try {
    return serialize(await dbStore.addCustomer({ ...data, name, phone }));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] createCustomer failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not add customer to database."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function editCustomer(id: string, patch: Partial<Customer>): Promise<Customer | null> {
  try {
    return serialize(await dbStore.updateCustomer(id, patch));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] editCustomer failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not update customer in database."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function removeCustomer(id: string): Promise<void> {
  try {
    return await dbStore.deleteCustomer(id);
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] removeCustomer failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not delete customer from database."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

// Offers
export async function fetchOffers(): Promise<Offer[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    return serialize(await dbStore.listOffers());
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] fetchOffers failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function createOffer(data: {
  name: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
}): Promise<Offer> {
  const name = data.name.trim();
  if (!name) throw new Error("Offer name is required");
  try {
    return serialize(await dbStore.addOffer({ ...data, name, discount_value: Number(data.discount_value) || 0 }));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] createOffer failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not create offer."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function editOffer(id: string, patch: Partial<Offer>): Promise<Offer | null> {
  try {
    return serialize(await dbStore.updateOffer(id, patch));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] editOffer failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not update offer."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function removeOffer(id: string): Promise<void> {
  try {
    return await dbStore.deleteOffer(id);
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] removeOffer failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not delete offer."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

// Birthday Settings & Logs
export async function fetchBirthdaySettings(): Promise<BirthdaySettings> {
  const defaultTemplate = `Hi {name}! 🎂 Happy Birthday!\n\nHere's a special treat from Universal Look:\n🎁 {offer}\n\nVisit us in store or call +91 91596 00067.\nFollow us on Instagram @universallook600067\n\n— Universal Look`;
  if (!isDatabaseConfigured()) {
    return {
      id: "default",
      message_template: defaultTemplate,
      selected_offer_id: null,
      updated_at: new Date().toISOString(),
    };
  }
  try {
    return serialize(await dbStore.getBirthdaySettings());
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] fetchBirthdaySettings failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    return {
      id: "default",
      message_template: defaultTemplate,
      selected_offer_id: null,
      updated_at: new Date().toISOString(),
    };
  }
}

export async function saveBirthdaySettingsAction(template: string, selectedOfferId?: string | null): Promise<BirthdaySettings> {
  try {
    return serialize(await dbStore.saveBirthdaySettings(template, selectedOfferId));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] saveBirthdaySettings failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    throw new Error(
      isDatabaseConfigured()
        ? "Could not save birthday settings."
        : "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
}

export async function recordBirthdaySend(data: {
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  offer_name?: string | null;
  message: string;
  status?: string;
}): Promise<BirthdayLog> {
  try {
    return serialize(await dbStore.logBirthdaySend(data));
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] recordBirthdaySend failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    return {
      id: `local-${Date.now()}`,
      ...data,
      sent_at: new Date().toISOString(),
      status: data.status || 'OPENED_WHATSAPP',
    };
  }
}

export async function fetchBirthdayLogs(): Promise<BirthdayLog[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    return serialize(await dbStore.listBirthdayLogs());
  } catch (err: unknown) {
    console.error(
      `[Server Diagnostic] fetchBirthdayLogs failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function checkDatabaseConfigured(): Promise<{ configured: boolean; message: string }> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      message: "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    };
  }

  try {
    await checkDatabaseConnection();
    return { configured: true, message: "Connected to Supabase database." };
  } catch (err) {
    console.error(
      `[Server Diagnostic] Supabase connection check failed (${getSanitizedSupabaseUrl()}):`,
      err instanceof Error ? err.message : err,
    );
    return {
      configured: false,
      message: `Supabase is configured, but the connection check failed: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    };
  }
}
