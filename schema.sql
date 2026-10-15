-- =====================================================================
--  NIDHULAN – THE PRECIOUS PEARLS — POS & INVENTORY SCHEMA
--  Target: Supabase PostgreSQL exposed through the public REST API
--
--  HOW TO USE
--  1. Supabase Dashboard -> SQL Editor -> New Query
--  2. Paste this file and click Run
--  3. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
--
--  Safe on a brand-new database. Existing databases need the idempotent
--  UPGRADE statements at the very bottom before using the app.
-- =====================================================================

-- CATEGORIES ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCTS & SERVICES ---------------------------------------------------
--   item_type = 'PRODUCT' -> physical item, tracks stock
--   item_type = 'SERVICE' -> delivery / packing / add-on, stock is NULL
CREATE TABLE IF NOT EXISTS products (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT,
  category           TEXT NOT NULL DEFAULT 'General',
  gst_rate           NUMERIC NOT NULL DEFAULT 0,
  hsn_code           TEXT,
  selling_price      NUMERIC NOT NULL DEFAULT 0,

  item_type          TEXT NOT NULL DEFAULT 'PRODUCT'
                     CHECK (item_type IN ('PRODUCT', 'SERVICE')),
  cost_price         NUMERIC NOT NULL DEFAULT 0,   -- records only
  current_stock      NUMERIC,                      -- NULL for services
  low_stock_alert    NUMERIC,                      -- NULL for services
  offer_discount_pct NUMERIC NOT NULL DEFAULT 0,
  offer_price        NUMERIC,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_type     ON products (item_type);

-- CUSTOMERS -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE is required: the POS upserts customers with ON CONFLICT (phone).
-- The index is created at the bottom after checking existing databases for duplicates.

-- ORDERS (invoices) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT NOT NULL REFERENCES customers (id),
  source           TEXT NOT NULL DEFAULT 'OFFLINE'
                   CHECK (source IN ('ONLINE', 'OFFLINE')),
  status           TEXT NOT NULL DEFAULT 'COMPLETED'
                   CHECK (status IN ('COMPLETED', 'PENDING')),
  is_gst           BOOLEAN NOT NULL DEFAULT FALSE,

  -- subtotal is GST-exclusive; grand_total = subtotal - discount + gst_amount + delivery_fee
  subtotal         NUMERIC NOT NULL DEFAULT 0,
  discount_type    TEXT NOT NULL DEFAULT 'FIXED'
                   CHECK (discount_type IN ('PERCENT', 'FIXED')),
  discount_value   NUMERIC NOT NULL DEFAULT 0,
  discount_amount  NUMERIC NOT NULL DEFAULT 0,
  gst_percentage   NUMERIC NOT NULL DEFAULT 0,
  gst_amount       NUMERIC NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC NOT NULL DEFAULT 0,
  grand_total      NUMERIC NOT NULL DEFAULT 0,

  cash_received    NUMERIC NOT NULL DEFAULT 0,
  split_cash       NUMERIC NOT NULL DEFAULT 0,
  split_gpay       NUMERIC NOT NULL DEFAULT 0,
  payment_mode     TEXT NOT NULL DEFAULT 'CASH'
                   CHECK (payment_mode IN ('CASH', 'GPAY', 'SPLIT')),

  bill_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer  ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_bill_date ON orders (bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders (created_at DESC);

-- ORDER ITEMS (invoice lines - name/price are snapshotted) --------------
CREATE TABLE IF NOT EXISTS order_items (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id     TEXT REFERENCES products (id) ON DELETE SET NULL,
  snapshot_name  TEXT NOT NULL,
  snapshot_price NUMERIC NOT NULL DEFAULT 0,
  quantity       NUMERIC NOT NULL DEFAULT 1,
  offer_pct      NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC  -- catalogue price before the offer
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- EXPENSES --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount        NUMERIC NOT NULL DEFAULT 0,
  payment_mode  TEXT NOT NULL DEFAULT 'CASH',
  notes         TEXT,
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date DESC);

-- ADVANCE ORDERS (partial-payment holds, revenue only once finalized) ----
CREATE TABLE IF NOT EXISTS advance_orders (
  id                   TEXT PRIMARY KEY,
  customer_id          TEXT NOT NULL REFERENCES customers (id),
  status               TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING', 'READY', 'COMPLETED', 'CANCELLED')),
  subtotal             NUMERIC NOT NULL DEFAULT 0,
  total_amount         NUMERIC NOT NULL DEFAULT 0,
  deposit_amount       NUMERIC NOT NULL DEFAULT 0,
  deposit_payment_mode TEXT NOT NULL DEFAULT 'CASH'
                       CHECK (deposit_payment_mode IN ('CASH', 'GPAY', 'SPLIT')),
  delivery_date        DATE,
  notes                TEXT,
  -- bill-level charges at booking (NULL on orders booked before they were stored)
  discount_type        TEXT,
  discount_value       NUMERIC,
  discount_amount      NUMERIC,
  delivery_fee         NUMERIC,
  is_gst               BOOLEAN,
  gst_percentage       NUMERIC,
  gst_amount           NUMERIC,
  finalized_order_id   TEXT,
  finalized_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advance_customer ON advance_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_advance_status   ON advance_orders (status);

CREATE TABLE IF NOT EXISTS advance_order_items (
  id               TEXT PRIMARY KEY,
  advance_order_id TEXT NOT NULL REFERENCES advance_orders (id) ON DELETE CASCADE,
  product_id       TEXT REFERENCES products (id) ON DELETE SET NULL,
  snapshot_name    TEXT NOT NULL,
  snapshot_desc    TEXT,
  snapshot_price   NUMERIC NOT NULL DEFAULT 0,
  quantity         NUMERIC NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_advance_items_order
  ON advance_order_items (advance_order_id);

-- STAFF & ATTENDANCE ------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  base_salary  NUMERIC NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per staff member per day. status is NULL until it is set or the
-- staff member clocks in.
CREATE TABLE IF NOT EXISTS staff_attendance (
  id               TEXT PRIMARY KEY,
  staff_id         TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  attendance_date  DATE NOT NULL,
  status           TEXT CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE')),
  clock_in         TIMESTAMPTZ,
  clock_out        TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance (attendance_date);

-- SHOP SETTINGS (single row, id = 'default') -----------------------------
CREATE TABLE IF NOT EXISTS shop_settings (
  id             TEXT PRIMARY KEY,
  owner_name     TEXT NOT NULL DEFAULT '',
  shop_name      TEXT NOT NULL DEFAULT '',
  tagline        TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  owner_phone    TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  location       TEXT NOT NULL DEFAULT '',
  instagram_url  TEXT NOT NULL DEFAULT '',
  business_hours TEXT NOT NULL DEFAULT '',
  services       TEXT NOT NULL DEFAULT '',
  gstin          TEXT NOT NULL DEFAULT '',
  accent_color   TEXT NOT NULL DEFAULT '#C5A059',
  logo_data_url  TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO shop_settings (
  id, owner_name, shop_name, tagline, phone, owner_phone, email,
  address, location, instagram_url, business_hours, services, gstin, logo_data_url, accent_color
) VALUES (
  'default',
  'Ajay Kumar',
  'NIDHULAN',
  'THE PRECIOUS PEARLS',
  '9871480705 / 8920980965',
  '',
  'nidhulan21@gmail.com',
  'Door Number 615A, Salem Road, Namakkal – 637212',
  'Namakkal, Tamil Nadu',
  'https://www.instagram.com/nidhulan.official/',
  '10:00 AM – 9:00 PM • Open Daily',
  'Precious Pearls • Exclusive Pearl Jewelry • Custom Pearl Necklaces & Bangles • Bridal & Traditional Pearl Sets',
  '',
  NULL,
  '#C5A059'
)
ON CONFLICT (id) DO NOTHING;

-- Starter categories ----------------------------------------------------
-- Removed to give a blank slate. Add your own from the POS category
-- manager (Sidebar -> Categories). Products fall back to 'General'.
-- INSERT INTO categories (id, name) VALUES
--   (gen_random_uuid()::text, 'Blouses'),
--   (gen_random_uuid()::text, 'Sarees'),
--   (gen_random_uuid()::text, 'Kurtis'),
--   (gen_random_uuid()::text, 'Alterations'),
--   (gen_random_uuid()::text, 'Services')
-- ON CONFLICT (name) DO NOTHING;

-- OFFERS -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  discount_type  TEXT NOT NULL DEFAULT 'PERCENT'
                 CHECK (discount_type IN ('PERCENT', 'FIXED')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  start_date     DATE,
  end_date       DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BIRTHDAY SETTINGS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS birthday_settings (
  id                TEXT PRIMARY KEY,
  message_template  TEXT NOT NULL,
  selected_offer_id TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BIRTHDAY LOGS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS birthday_logs (
  id             TEXT PRIMARY KEY,
  customer_id    TEXT,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  offer_name     TEXT,
  message        TEXT NOT NULL,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'OPENED_WHATSAPP'
);

-- =====================================================================
--  UPGRADE BLOCK - apply to an EXISTING database before using the app.
--  The application uses PostgREST and cannot run DDL migrations at runtime.
-- =====================================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_cash NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_gpay NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_alert NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_discount_pct NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS offer_pct NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS original_price NUMERIC;
ALTER TABLE advance_orders ADD COLUMN IF NOT EXISTS discount_type TEXT;
ALTER TABLE advance_orders ADD COLUMN IF NOT EXISTS discount_value NUMERIC;
ALTER TABLE advance_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
ALTER TABLE advance_orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC;
ALTER TABLE advance_orders ADD COLUMN IF NOT EXISTS is_gst BOOLEAN;
ALTER TABLE advance_orders ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC;
ALTER TABLE advance_orders ADD COLUMN IF NOT EXISTS gst_amount NUMERIC;
ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#C5A059';
ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS owner_phone TEXT NOT NULL DEFAULT '';

DO $$
DECLARE
  payment_mode_constraint TEXT;
BEGIN
  FOR payment_mode_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_mode%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', payment_mode_constraint);
  END LOOP;

  ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_mode_check
    CHECK (payment_mode IN ('CASH', 'GPAY', 'SPLIT'));
END
$$;

CREATE TABLE IF NOT EXISTS offers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  discount_type  TEXT NOT NULL DEFAULT 'PERCENT'
                 CHECK (discount_type IN ('PERCENT', 'FIXED')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  start_date     DATE,
  end_date       DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS birthday_settings (
  id                TEXT PRIMARY KEY,
  message_template  TEXT NOT NULL,
  selected_offer_id TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS birthday_logs (
  id             TEXT PRIMARY KEY,
  customer_id    TEXT,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  offer_name     TEXT,
  message        TEXT NOT NULL,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'OPENED_WHATSAPP'
);

-- Stop instead of deleting customer records if duplicates prevent a safe unique index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM customers GROUP BY phone HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate customers.phone values before applying the unique index';
  END IF;
END
$$;
DROP INDEX IF EXISTS idx_customers_phone;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_dob ON customers (dob);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_type ON products (item_type);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- The app's service-role key is server-only and needs table ACLs in addition
-- to bypassing row-level security.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.categories,
  public.products,
  public.customers,
  public.orders,
  public.order_items,
  public.expenses,
  public.advance_orders,
  public.advance_order_items,
  public.staff,
  public.staff_attendance,
  public.shop_settings,
  public.offers,
  public.birthday_settings,
  public.birthday_logs
TO service_role;
