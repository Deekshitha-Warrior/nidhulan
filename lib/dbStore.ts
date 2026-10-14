import { getSupabaseClient } from './db';
import type {
  Product,
  Category,
  Customer,
  OrderItemRow,
  OrderWithRelations,
  CartItem,
  Expense,
  PaymentMode,
  AdvanceOrderItemRow,
  AdvanceOrderStatus,
  AdvanceOrderWithRelations,
  ItemType,
  Staff,
  AttendanceRecord,
  AttendanceStatus,
  Offer,
  BirthdaySettings,
  BirthdayLog,
} from './types';
import { advanceCharges } from './advanceCharges';

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

async function run<T>(
  request: PromiseLike<QueryResult>,
  emptyValue: T,
): Promise<T> {
  const { data, error } = await request;
  if (error) {
    const code = error.code ? ` (${error.code})` : '';
    throw new Error(`Supabase request failed${code}: ${error.message}`);
  }
  return (data ?? emptyValue) as T;
}

const uid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const PAGE_SIZE = 1000;
const rows = <T>(request: PromiseLike<QueryResult>) => run<T[]>(request, []);
const maybeOne = <T>(request: PromiseLike<QueryResult>) => run<T | null>(request, null);
const execute = (request: PromiseLike<QueryResult>) => run<null>(request, null);

async function allRows<T>(
  buildRequest: (from: number, to: number) => PromiseLike<QueryResult>,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await rows<T>(buildRequest(offset, offset + PAGE_SIZE - 1));
    result.push(...page);
    if (page.length < PAGE_SIZE) return result;
  }
}

async function filterLiveProductIds(ids: (string | null | undefined)[]): Promise<Set<string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Set();
  const existing = await rows<{ id: string }>(
    getSupabaseClient().from('products').select('id').in('id', wanted),
  );
  return new Set(existing.map((row) => row.id));
}

async function getOrderItemsByOrderId(orderIds: string[]): Promise<OrderItemRow[]> {
  if (orderIds.length === 0) return [];
  const client = getSupabaseClient();
  const result: OrderItemRow[] = [];
  for (let offset = 0; offset < orderIds.length; offset += 500) {
    const ids = orderIds.slice(offset, offset + 500);
    result.push(
      ...(await allRows<OrderItemRow>((from, to) =>
        client.from('order_items').select('*').in('order_id', ids).range(from, to),
      )),
    );
  }
  return result;
}

async function getOrderCustomerDetails(customerIds: string[]) {
  const ids = [...new Set(customerIds)];
  type CustomerDetails = Pick<Customer, 'id' | 'name' | 'phone' | 'address'>;
  if (ids.length === 0) return new Map<string, CustomerDetails>();
  const client = getSupabaseClient();
  const customers: CustomerDetails[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500);
    customers.push(
      ...(await allRows<CustomerDetails>((from, to) =>
        client
          .from('customers')
          .select('id,name,phone,address')
          .in('id', batch)
          .range(from, to),
      )),
    );
  }
  return new Map(customers.map((customer) => [customer.id, customer]));
}

async function getAdvanceOrderItems(orderIds: string[]): Promise<AdvanceOrderItemRow[]> {
  if (orderIds.length === 0) return [];
  const client = getSupabaseClient();
  const result: AdvanceOrderItemRow[] = [];
  for (let offset = 0; offset < orderIds.length; offset += 500) {
    const ids = orderIds.slice(offset, offset + 500);
    result.push(
      ...(await allRows<AdvanceOrderItemRow>((from, to) =>
        client
          .from('advance_order_items')
          .select('*')
          .in('advance_order_id', ids)
          .range(from, to),
      )),
    );
  }
  return result;
}

async function saveAttendance(
  staffId: string,
  date: string,
  patch: { status?: AttendanceStatus | null; clock_in?: string; clock_out?: string },
): Promise<void> {
  const client = getSupabaseClient();
  const existing = await maybeOne<{ id: string; status: AttendanceStatus | null }>(
    client
      .from('staff_attendance')
      .select('id,status')
      .eq('staff_id', staffId)
      .eq('attendance_date', date)
      .maybeSingle(),
  );
  const now = new Date().toISOString();
  const value = {
    id: existing?.id ?? uid(),
    staff_id: staffId,
    attendance_date: date,
    status: patch.status !== undefined ? patch.status : existing?.status ?? 'PRESENT',
    ...(patch.clock_in ? { clock_in: now } : {}),
    ...(patch.clock_out ? { clock_out: now } : {}),
    updated_at: now,
  };
  await execute(
    client
      .from('staff_attendance')
      .upsert(value, { onConflict: 'staff_id,attendance_date' }),
  );
}

export const dbStore = {
  async listCategories(): Promise<Category[]> {
    const client = getSupabaseClient();
    return allRows<Category>((from, to) =>
      client.from('categories').select('*').order('name', { ascending: true }).range(from, to),
    );
  },

  async addCategory(name: string): Promise<Category> {
    const result = await maybeOne<Category>(
      getSupabaseClient()
        .from('categories')
        .upsert({ id: uid(), name }, { onConflict: 'name' })
        .select('*')
        .single(),
    );
    if (!result) throw new Error('Supabase did not return the saved category.');
    return result;
  },

  async updateCategory(id: string, name: string): Promise<Category | null> {
    const client = getSupabaseClient();
    const existing = await maybeOne<Category>(
      client.from('categories').select('*').eq('id', id).maybeSingle(),
    );
    if (!existing) return null;
    const newName = name.trim();
    if (!newName || newName === existing.name) return existing;

    const updated = await maybeOne<Category>(
      client.from('categories').update({ name: newName }).eq('id', id).select('*').maybeSingle(),
    );
    if (!updated) return null;
    await execute(
      client.from('products').update({ category: newName }).eq('category', existing.name),
    );
    return updated;
  },

  async deleteCategory(id: string): Promise<void> {
    await execute(getSupabaseClient().from('categories').delete().eq('id', id));
  },

  async listProducts(): Promise<Product[]> {
    const client = getSupabaseClient();
    return allRows<Product>((from, to) =>
      client.from('products').select('*').order('name', { ascending: true }).range(from, to),
    );
  },

  async getProduct(id: string): Promise<Product | null> {
    return maybeOne<Product>(
      getSupabaseClient().from('products').select('*').eq('id', id).maybeSingle(),
    );
  },

  async addProduct(input: {
    name: string;
    description: string | null;
    category: string;
    gst_rate: number;
    hsn_code: string | null;
    selling_price: number;
    item_type?: ItemType;
    cost_price?: number;
    current_stock?: number | null;
    low_stock_alert?: number | null;
    offer_discount_pct?: number;
    offer_price?: number | null;
    is_active?: boolean;
  }): Promise<Product> {
    const isService = input.item_type === 'SERVICE';
    const result = await maybeOne<Product>(
      getSupabaseClient()
        .from('products')
        .insert({
          id: uid(),
          name: input.name,
          description: input.description,
          category: input.category,
          gst_rate: input.gst_rate,
          hsn_code: input.hsn_code,
          selling_price: input.selling_price,
          item_type: isService ? 'SERVICE' : 'PRODUCT',
          cost_price: input.cost_price ?? 0,
          current_stock: isService ? null : input.current_stock ?? 0,
          low_stock_alert: isService ? null : input.low_stock_alert ?? 0,
          offer_discount_pct: input.offer_discount_pct ?? 0,
          offer_price: input.offer_price ?? null,
          is_active: input.is_active ?? true,
        })
        .select('*')
        .single(),
    );
    if (!result) throw new Error('Supabase did not return the saved product.');
    return result;
  },

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
    if (Object.keys(patch).length === 0) return this.getProduct(id);
    const update: Partial<Product> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.gst_rate !== undefined) update.gst_rate = patch.gst_rate;
    if (patch.hsn_code !== undefined) update.hsn_code = patch.hsn_code;
    if (patch.selling_price !== undefined) update.selling_price = patch.selling_price;
    if (patch.item_type !== undefined) update.item_type = patch.item_type;
    if (patch.cost_price !== undefined) update.cost_price = patch.cost_price;
    if (patch.current_stock !== undefined) update.current_stock = patch.current_stock;
    if (patch.low_stock_alert !== undefined) update.low_stock_alert = patch.low_stock_alert;
    if (patch.offer_discount_pct !== undefined) update.offer_discount_pct = patch.offer_discount_pct;
    if (patch.offer_price !== undefined) update.offer_price = patch.offer_price;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;

    const needsStockCheck =
      patch.item_type === 'SERVICE' ||
      patch.current_stock !== undefined ||
      patch.low_stock_alert !== undefined;
    const existing = needsStockCheck ? await this.getProduct(id) : null;
    if (patch.item_type === 'SERVICE') {
      update.current_stock = null;
      update.low_stock_alert = null;
    } else if (existing?.item_type === 'SERVICE') {
      update.current_stock = null;
      update.low_stock_alert = null;
    }
    if (Object.keys(update).length === 0) return this.getProduct(id);
    const client = getSupabaseClient();
    const changed = await maybeOne<Product>(
      client.from('products').update(update).eq('id', id).select('*').maybeSingle(),
    );
    return changed;
  },

  async decrementStock(productId: string, qty: number): Promise<void> {
    const amount = Number(qty) || 0;
    if (amount <= 0) return;

    const client = getSupabaseClient();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const product = await maybeOne<Pick<Product, 'id' | 'item_type' | 'current_stock'>>(
        client
          .from('products')
          .select('id,item_type,current_stock')
          .eq('id', productId)
          .maybeSingle(),
      );
      if (!product || product.item_type !== 'PRODUCT' || product.current_stock === null) return;

      const nextStock = Math.max(0, Number(product.current_stock) - amount);
      const updated = await maybeOne<{ id: string }>(
        client
          .from('products')
          .update({ current_stock: nextStock })
          .eq('id', productId)
          .eq('current_stock', product.current_stock)
          .select('id')
          .maybeSingle(),
      );
      if (updated) return;
    }
    throw new Error(`Could not decrement stock for ${productId} because it kept changing.`);
  },

  async deleteProduct(id: string): Promise<void> {
    await execute(getSupabaseClient().from('products').delete().eq('id', id));
  },

  async listCustomers(search?: string): Promise<Customer[]> {
    const client = getSupabaseClient();
    const trimmed = search?.trim();
    if (trimmed) {
      const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return allRows<Customer>((from, to) =>
        client
          .from('customers')
          .select('*')
          .or(`name.ilike."%${escaped}%",phone.ilike."%${escaped}%"`)
          .order('name', { ascending: true })
          .range(from, to),
      );
    }
    return allRows<Customer>((from, to) =>
      client.from('customers').select('*').order('name', { ascending: true }).range(from, to),
    );
  },

  async getCustomer(id: string): Promise<Customer | null> {
    return maybeOne<Customer>(
      getSupabaseClient().from('customers').select('*').eq('id', id).maybeSingle(),
    );
  },

  async upsertCustomer(
    name: string,
    phone: string,
    address?: string | null,
    dob?: string | null,
  ): Promise<Customer> {
    const client = getSupabaseClient();
    const existing = await maybeOne<Customer>(
      client.from('customers').select('*').eq('phone', phone).maybeSingle(),
    );
    const result = await maybeOne<Customer>(
      client
        .from('customers')
        .upsert(
          {
            id: existing?.id ?? uid(),
            name,
            phone,
            address: address ?? existing?.address ?? null,
            dob: dob ?? existing?.dob ?? null,
          },
          { onConflict: 'phone' },
        )
        .select('*')
        .single(),
    );
    if (!result) throw new Error('Supabase did not return the saved customer.');
    return result;
  },

  async addCustomer(data: {
    name: string;
    phone: string;
    address?: string | null;
    dob?: string | null;
  }): Promise<Customer> {
    return this.upsertCustomer(data.name, data.phone, data.address, data.dob);
  },

  async updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer | null> {
    const update: Partial<Customer> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.phone !== undefined) update.phone = patch.phone;
    if (patch.address !== undefined) update.address = patch.address;
    if (patch.dob !== undefined) update.dob = patch.dob || null;
    if (Object.keys(update).length === 0) return this.getCustomer(id);
    return maybeOne<Customer>(
      getSupabaseClient().from('customers').update(update).eq('id', id).select('*').maybeSingle(),
    );
  },

  async deleteCustomer(id: string): Promise<void> {
    await execute(getSupabaseClient().from('customers').delete().eq('id', id));
  },

  async orderIdExists(id: string): Promise<boolean> {
    return Boolean(
      await maybeOne<{ id: string }>(
        getSupabaseClient().from('orders').select('id').eq('id', id).maybeSingle(),
      ),
    );
  },

  async listOrdersWithRelations(): Promise<OrderWithRelations[]> {
    const client = getSupabaseClient();
    const orders = await allRows<Record<string, unknown> & { id: string; customer_id: string }>(
      (from, to) =>
        client
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to),
    );
    if (orders.length === 0) return [];

    const [customers, items] = await Promise.all([
      getOrderCustomerDetails(orders.map((order) => order.customer_id)),
      getOrderItemsByOrderId(orders.map((order) => order.id)),
    ]);
    return orders.map((order) => {
      const customer = customers.get(order.customer_id);
      return {
        ...order,
        customer_name: customer?.name ?? '',
        customer_phone: customer?.phone ?? '',
        customer_address: customer?.address ?? null,
        items: items.filter((item) => item.order_id === order.id),
      };
    }) as unknown as OrderWithRelations[];
  },

  async getOrderWithRelations(id: string): Promise<OrderWithRelations | null> {
    const order = await maybeOne<Record<string, unknown> & { id: string; customer_id: string }>(
      getSupabaseClient().from('orders').select('*').eq('id', id).maybeSingle(),
    );
    if (!order) return null;
    const [customers, items] = await Promise.all([
      getOrderCustomerDetails([order.customer_id]),
      getOrderItemsByOrderId([order.id]),
    ]);
    const customer = customers.get(order.customer_id);
    return {
      ...order,
      customer_name: customer?.name ?? '',
      customer_phone: customer?.phone ?? '',
      customer_address: customer?.address ?? null,
      items,
    } as unknown as OrderWithRelations;
  },

  async deleteOrder(id: string): Promise<void> {
    await execute(getSupabaseClient().from('orders').delete().eq('id', id));
  },

  async listExpenses(): Promise<Expense[]> {
    const client = getSupabaseClient();
    return allRows<Expense>((from, to) =>
      client
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to),
    );
  },

  async addExpense(input: {
    title: string;
    category: string;
    amount: number;
    payment_mode: string;
    notes: string | null;
    expense_date: string;
  }): Promise<Expense> {
    const result = await maybeOne<Expense>(
      getSupabaseClient().from('expenses').insert({ id: uid(), ...input }).select('*').single(),
    );
    if (!result) throw new Error('Supabase did not return the saved expense.');
    return result;
  },

  async updateExpense(id: string, patch: Partial<Expense>): Promise<Expense | null> {
    const client = getSupabaseClient().from('expenses');
    if (Object.keys(patch).length === 0) {
      return maybeOne<Expense>(client.select('*').eq('id', id).maybeSingle());
    }
    const update: Partial<Expense> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.amount !== undefined) update.amount = patch.amount;
    if (patch.payment_mode !== undefined) update.payment_mode = patch.payment_mode;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.expense_date !== undefined) update.expense_date = patch.expense_date;
    if (Object.keys(update).length === 0) {
      return maybeOne<Expense>(client.select('*').eq('id', id).maybeSingle());
    }
    return maybeOne<Expense>(client.update(update).eq('id', id).select('*').maybeSingle());
  },

  async deleteExpense(id: string): Promise<void> {
    await execute(getSupabaseClient().from('expenses').delete().eq('id', id));
  },

  async submitOrder(payload: {
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
  }): Promise<{ orderId: string }> {
    const customer = await this.upsertCustomer(
      payload.customerName,
      payload.customerPhone,
      payload.customerAddress,
    );
    const liveProductIds = await filterLiveProductIds(
      payload.items.map((item) => item.product_id),
    );
    const subtotalExclusive =
      payload.grandTotal + payload.discountAmount - payload.gstAmount - payload.deliveryFee;

    await execute(
      getSupabaseClient().from('orders').insert({
        id: payload.orderId,
        customer_id: customer.id,
        source: payload.source,
        status: 'COMPLETED',
        is_gst: payload.isGst,
        subtotal: subtotalExclusive,
        discount_type: payload.discountType,
        discount_value: payload.discountValue,
        discount_amount: payload.discountAmount,
        gst_percentage: payload.gstPercentage,
        gst_amount: payload.gstAmount,
        delivery_fee: payload.deliveryFee,
        grand_total: payload.grandTotal,
        cash_received: payload.cashReceived,
        split_cash: payload.splitCash ?? 0,
        split_gpay: payload.splitGpay ?? 0,
        payment_mode: payload.paymentMode,
        bill_date: payload.billDate,
        created_at: new Date().toISOString(),
      }),
    );

    const finalOrderItems = payload.items.map((item) => ({
      id: uid(),
      order_id: payload.orderId,
      product_id: item.product_id && liveProductIds.has(item.product_id) ? item.product_id : null,
      snapshot_name: item.name,
      snapshot_price: item.price,
      quantity: item.qty,
      offer_pct: item.offerPct ?? 0,
      original_price: (item.offerPct ?? 0) > 0 ? item.originalPrice ?? null : null,
    }));
    if (finalOrderItems.length > 0) {
      await execute(getSupabaseClient().from('order_items').insert(finalOrderItems));
    }

    await Promise.all(
      payload.items
        .filter((item) => item.product_id)
        .map((item) => this.decrementStock(item.product_id as string, item.qty)),
    );
    return { orderId: payload.orderId };
  },

  async listAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
    const client = getSupabaseClient();
    const orders = await allRows<Record<string, unknown> & { id: string; customer_id: string }>(
      (from, to) =>
        client
          .from('advance_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to),
    );
    if (orders.length === 0) return [];

    const [customers, items] = await Promise.all([
      getOrderCustomerDetails(orders.map((order) => order.customer_id)),
      getAdvanceOrderItems(orders.map((order) => order.id)),
    ]);
    return orders.map((order) => {
      const customer = customers.get(order.customer_id);
      return {
        ...order,
        customer_name: customer?.name ?? '',
        customer_phone: customer?.phone ?? '',
        customer_address: customer?.address ?? null,
        items: items.filter((item) => item.advance_order_id === order.id),
      };
    }) as unknown as AdvanceOrderWithRelations[];
  },

  async getAdvanceOrder(id: string): Promise<AdvanceOrderWithRelations | null> {
    const order = await maybeOne<Record<string, unknown> & { id: string; customer_id: string }>(
      getSupabaseClient().from('advance_orders').select('*').eq('id', id).maybeSingle(),
    );
    if (!order) return null;
    const [customers, items] = await Promise.all([
      getOrderCustomerDetails([order.customer_id]),
      getAdvanceOrderItems([order.id]),
    ]);
    const customer = customers.get(order.customer_id);
    return {
      ...order,
      customer_name: customer?.name ?? '',
      customer_phone: customer?.phone ?? '',
      customer_address: customer?.address ?? null,
      items,
    } as unknown as AdvanceOrderWithRelations;
  },

  async advanceOrderIdExists(id: string): Promise<boolean> {
    return Boolean(
      await maybeOne<{ id: string }>(
        getSupabaseClient().from('advance_orders').select('id').eq('id', id).maybeSingle(),
      ),
    );
  },

  async createAdvanceOrder(payload: {
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
    const customer = await this.upsertCustomer(
      payload.customerName,
      payload.customerPhone,
      payload.customerAddress,
    );
    await execute(
      getSupabaseClient().from('advance_orders').insert({
        id: payload.advanceOrderId,
        customer_id: customer.id,
        status: 'PENDING',
        subtotal: payload.subtotal,
        total_amount: payload.totalAmount,
        deposit_amount: payload.depositAmount,
        deposit_payment_mode: payload.depositPaymentMode,
        delivery_date: payload.deliveryDate,
        notes: payload.notes,
        discount_type: payload.discountType,
        discount_value: payload.discountValue,
        discount_amount: payload.discountAmount,
        delivery_fee: payload.deliveryFee,
        is_gst: payload.isGst,
        gst_percentage: payload.isGst ? payload.gstPercentage : 0,
        gst_amount: payload.isGst ? payload.gstAmount : 0,
      }),
    );

    const liveProductIds = await filterLiveProductIds(payload.items.map((item) => item.product_id));
    const items = payload.items.map((item) => ({
      id: uid(),
      advance_order_id: payload.advanceOrderId,
      product_id:
        item.product_id && liveProductIds.has(item.product_id) ? item.product_id : null,
      snapshot_name: item.snapshot_name,
      snapshot_desc: item.snapshot_desc,
      snapshot_price: item.snapshot_price,
      quantity: item.quantity,
    }));
    if (items.length > 0) {
      await execute(getSupabaseClient().from('advance_order_items').insert(items));
    }
    return { advanceOrderId: payload.advanceOrderId };
  },

  async updateAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
    await execute(getSupabaseClient().from('advance_orders').update({ status }).eq('id', id));
  },

  async cancelAdvanceOrder(id: string): Promise<void> {
    await execute(
      getSupabaseClient()
        .from('advance_orders')
        .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
        .eq('id', id),
    );
  },

  async deleteAdvanceOrder(id: string): Promise<void> {
    await execute(getSupabaseClient().from('advance_orders').delete().eq('id', id));
  },

  async finalizeAdvanceOrder(payload: {
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
    const advance = await this.getAdvanceOrder(payload.advanceOrderId);
    if (!advance) throw new Error('Advance order not found');
    if (advance.status === 'COMPLETED') throw new Error('Advance order already finalized');
    if (advance.status === 'CANCELLED') throw new Error('Advance order was cancelled');

    const liveProductIds = await filterLiveProductIds(advance.items.map((item) => item.product_id));
    const unlinkedNames = new Set(
      advance.items
        .filter((item) => !item.product_id || !liveProductIds.has(item.product_id))
        .map((item) => item.snapshot_name.trim().toLowerCase()),
    );
    const productIdByName = new Map<string, string>();
    if (unlinkedNames.size > 0) {
      const client = getSupabaseClient();
      const products = await allRows<{ id: string; name: string }>(
        (from, to) => client.from('products').select('id,name').range(from, to),
      );
      for (const product of products) {
        const key = product.name.trim().toLowerCase();
        if (unlinkedNames.has(key) && !productIdByName.has(key)) {
          productIdByName.set(key, product.id);
        }
      }
    }

    const cart: CartItem[] = advance.items.map((item) => ({
      id: item.id,
      product_id:
        item.product_id && liveProductIds.has(item.product_id)
          ? item.product_id
          : productIdByName.get(item.snapshot_name.trim().toLowerCase()) ?? null,
      name: item.snapshot_name,
      desc: item.snapshot_desc || '',
      price: Number(item.snapshot_price),
      qty: Number(item.quantity) || 0,
    }));

    const booked = advanceCharges(advance);
    const rawSubtotal = cart.reduce((total, item) => total + item.price * item.qty, 0);
    const balanceDue = Math.max(0, booked.total - (Number(advance.deposit_amount) || 0));
    const balanceDiscount = Math.min(Math.max(0, payload.discountAmount), balanceDue);
    const gstRate = booked.isGst ? booked.gstPercentage : 0;
    const totalDiscount = round2(booked.discountAmount + balanceDiscount / (1 + gstRate / 100));
    const taxableValue = Math.max(0, rawSubtotal - totalDiscount);
    const gstAmount = round2(taxableValue * (gstRate / 100));
    const grandTotal = round2(taxableValue + gstAmount + booked.deliveryFee);
    const discountIsPercent = balanceDiscount === 0 && booked.discountType === 'PERCENT';

    const { orderId } = await this.submitOrder({
      orderId: payload.invoiceId,
      customerName: advance.customer_name,
      customerPhone: advance.customer_phone,
      customerAddress: advance.customer_address,
      source: 'OFFLINE',
      isGst: booked.isGst,
      billDate: payload.billDate,
      items: cart,
      discountType: discountIsPercent ? 'PERCENT' : 'FIXED',
      discountValue: discountIsPercent ? booked.discountValue : totalDiscount,
      discountAmount: totalDiscount,
      gstPercentage: gstRate,
      gstAmount,
      deliveryFee: booked.deliveryFee,
      grandTotal,
      cashReceived: grandTotal,
      paymentMode: payload.paymentMode,
    });
    await execute(
      getSupabaseClient()
        .from('advance_orders')
        .update({
          status: 'COMPLETED',
          finalized_order_id: orderId,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', payload.advanceOrderId),
    );
    return { orderId };
  },

  async listStaff(): Promise<Staff[]> {
    const client = getSupabaseClient();
    const staff = await allRows<Staff>((from, to) =>
      client.from('staff').select('*').order('name', { ascending: true }).range(from, to),
    );
    return staff.map((member) => ({
      ...member,
      base_salary: Number(member.base_salary) || 0,
    }));
  },

  async addStaff(input: {
    name: string;
    role: string;
    phone: string;
    base_salary: number;
    is_active: boolean;
  }): Promise<Staff> {
    const result = await maybeOne<Staff>(
      getSupabaseClient()
        .from('staff')
        .insert({ id: uid(), ...input })
        .select('*')
        .single(),
    );
    if (!result) throw new Error('Supabase did not return the saved staff member.');
    return result;
  },

  async updateStaff(
    id: string,
    input: { name: string; role: string; phone: string; base_salary: number; is_active: boolean },
  ): Promise<Staff | null> {
    return maybeOne<Staff>(
      getSupabaseClient().from('staff').update(input).eq('id', id).select('*').maybeSingle(),
    );
  },

  async deleteStaff(id: string): Promise<void> {
    await execute(getSupabaseClient().from('staff').delete().eq('id', id));
  },

  async listAttendance(fromDate: string, toDate: string): Promise<AttendanceRecord[]> {
    const client = getSupabaseClient();
    return allRows<AttendanceRecord>((from, to) =>
      client
        .from('staff_attendance')
        .select('id,staff_id,attendance_date,status,clock_in,clock_out')
        .gte('attendance_date', fromDate)
        .lte('attendance_date', toDate)
        .range(from, to),
    );
  },

  async setAttendanceStatus(
    staffId: string,
    date: string,
    status: AttendanceStatus | null,
  ): Promise<void> {
    await saveAttendance(staffId, date, { status });
  },

  async clockIn(staffId: string, date: string): Promise<void> {
    await saveAttendance(staffId, date, { clock_in: new Date().toISOString() });
  },

  async clockOut(staffId: string, date: string): Promise<void> {
    await saveAttendance(staffId, date, { clock_out: new Date().toISOString() });
  },

  async listOffers(): Promise<Offer[]> {
    const client = getSupabaseClient();
    return allRows<Offer>((from, to) =>
      client.from('offers').select('*').order('created_at', { ascending: false }).range(from, to),
    );
  },

  async addOffer(data: {
    name: string;
    discount_type: 'PERCENT' | 'FIXED';
    discount_value: number;
    start_date?: string | null;
    end_date?: string | null;
    is_active?: boolean;
  }): Promise<Offer> {
    const result = await maybeOne<Offer>(
      getSupabaseClient()
        .from('offers')
        .insert({
          id: uid(),
          name: data.name,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          is_active: data.is_active ?? true,
        })
        .select('*')
        .single(),
    );
    if (!result) throw new Error('Supabase did not return the saved offer.');
    return result;
  },

  async updateOffer(id: string, patch: Partial<Offer>): Promise<Offer | null> {
    const update: Partial<Offer> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.discount_type !== undefined) update.discount_type = patch.discount_type;
    if (patch.discount_value !== undefined) update.discount_value = patch.discount_value;
    if (patch.start_date !== undefined) update.start_date = patch.start_date || null;
    if (patch.end_date !== undefined) update.end_date = patch.end_date || null;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;
    if (Object.keys(update).length === 0) {
      return maybeOne<Offer>(
        getSupabaseClient().from('offers').select('*').eq('id', id).maybeSingle(),
      );
    }
    return maybeOne<Offer>(
      getSupabaseClient().from('offers').update(update).eq('id', id).select('*').maybeSingle(),
    );
  },

  async deleteOffer(id: string): Promise<void> {
    await execute(getSupabaseClient().from('offers').delete().eq('id', id));
  },

  async getBirthdaySettings(): Promise<BirthdaySettings> {
    const client = getSupabaseClient();
    const existing = await maybeOne<BirthdaySettings>(
      client.from('birthday_settings').select('*').eq('id', 'default').maybeSingle(),
    );
    if (existing) return existing;
    const defaultTemplate = `Hi {name}! 🎂 Happy Birthday!\n\nHere's a special treat from Universal Look:\n🎁 {offer}\n\nVisit us in store or call +91 91596 00067.\nFollow us on Instagram @universallook600067\n\n— Universal Look`;
    const inserted = await maybeOne<BirthdaySettings>(
      client
        .from('birthday_settings')
        .upsert(
          { id: 'default', message_template: defaultTemplate, updated_at: new Date().toISOString() },
          { onConflict: 'id' },
        )
        .select('*')
        .single(),
    );
    if (!inserted) throw new Error('Supabase did not return the birthday settings.');
    return inserted;
  },

  async saveBirthdaySettings(
    template: string,
    selectedOfferId?: string | null,
  ): Promise<BirthdaySettings> {
    const result = await maybeOne<BirthdaySettings>(
      getSupabaseClient()
        .from('birthday_settings')
        .upsert(
          {
            id: 'default',
            message_template: template,
            selected_offer_id: selectedOfferId || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        .select('*')
        .single(),
    );
    if (!result) throw new Error('Supabase did not return the saved birthday settings.');
    return result;
  },

  async logBirthdaySend(data: {
    customer_id?: string | null;
    customer_name: string;
    customer_phone: string;
    offer_name?: string | null;
    message: string;
    status?: string;
  }): Promise<BirthdayLog> {
    const result = await maybeOne<BirthdayLog>(
      getSupabaseClient()
        .from('birthday_logs')
        .insert({
          id: uid(),
          customer_id: data.customer_id || null,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          offer_name: data.offer_name || null,
          message: data.message,
          sent_at: new Date().toISOString(),
          status: data.status || 'OPENED_WHATSAPP',
        })
        .select('*')
        .single(),
    );
    if (!result) throw new Error('Supabase did not return the birthday log.');
    return result;
  },

  async listBirthdayLogs(): Promise<BirthdayLog[]> {
    return rows<BirthdayLog>(
      getSupabaseClient()
        .from('birthday_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100),
    );
  },
};
