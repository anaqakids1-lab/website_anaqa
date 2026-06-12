-- ============================================================
-- ANAQA KIDS - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  category TEXT NOT NULL,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_new_arrival BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADMINS TABLE (to track admin users)
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Helper: is current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PRODUCTS: public read, admin write
CREATE POLICY "Products are publicly readable" ON products FOR SELECT USING (true);
CREATE POLICY "Admins can insert products" ON products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update products" ON products FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete products" ON products FOR DELETE USING (is_admin());

-- CUSTOMERS: own data + admin
CREATE POLICY "Customers can view own profile" ON customers FOR SELECT USING (auth_id = auth.uid() OR is_admin());
CREATE POLICY "Customers can insert own profile" ON customers FOR INSERT WITH CHECK (auth_id = auth.uid() OR is_admin());
CREATE POLICY "Customers can update own profile" ON customers FOR UPDATE USING (auth_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can view all customers" ON customers FOR SELECT USING (is_admin());

-- ORDERS: own orders + admin
CREATE POLICY "Customers can view own orders" ON orders FOR SELECT USING (
  customer_id IN (SELECT id FROM customers WHERE auth_id = auth.uid()) OR is_admin()
);
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update orders" ON orders FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete orders" ON orders FOR DELETE USING (is_admin());

-- ADMINS: admins only
CREATE POLICY "Admins can view admin list" ON admins FOR SELECT USING (is_admin());

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admins can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND is_admin());
CREATE POLICY "Admins can delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND is_admin());

-- ============================================================
-- SEED: Insert admin user (run AFTER creating auth user)
-- Replace the UUID below with the actual auth.users id of admin@anaqakids.com
-- ============================================================
-- INSERT INTO admins (auth_id, email) VALUES ('<AUTH_USER_UUID>', 'admin@anaqakids.com');

-- ============================================================
-- SEED: Sample Products
-- ============================================================
INSERT INTO products (name, description, price, original_price, category, stock, is_featured, is_new_arrival, tags) VALUES
('Boys Cotton Kurta Set', 'Soft premium cotton kurta with matching pyjama. Perfect for Eid and special occasions.', 899, 1299, 'boys', 25, true, true, ARRAY['eid','traditional','cotton']),
('Girls Embroidered Frock', 'Beautiful hand-embroidered frock with intricate kashmir-inspired patterns.', 1199, 1599, 'girls', 18, true, true, ARRAY['embroidered','frock','traditional']),
('Kids Winter Jacket', 'Warm padded jacket with hood. Ideal for Srinagar winters.', 1499, 1999, 'winter', 30, false, true, ARRAY['winter','jacket','warm']),
('Baby Woolen Suit', 'Soft merino wool suit for babies 0-12 months. Machine washable.', 799, null, 'baby', 40, true, false, ARRAY['baby','wool','winter']),
('Girls Salwar Kameez', 'Traditional salwar kameez with dupatta set for girls aged 4-12.', 999, 1299, 'girls', 22, false, false, ARRAY['salwar','traditional','eid']),
('Boys Denim Jeans', 'Comfortable stretchable denim jeans for active boys.', 649, 849, 'boys', 35, false, true, ARRAY['denim','casual','everyday']),
('Baby Onesie Pack (3pcs)', 'Soft 100% cotton onesies pack. Available in multiple colors.', 599, 799, 'baby', 50, true, false, ARRAY['baby','cotton','everyday']),
('Girls Party Dress', 'Sparkly net layered party dress perfect for birthdays and celebrations.', 1299, 1699, 'girls', 15, true, true, ARRAY['party','dress','celebration']);

-- ============================================================
-- MIGRATION: Add multi-image + sizes support to products
-- Run this if you already ran schema.sql before
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT '{}';

-- Migrate existing single image_url into images array
UPDATE products SET images = ARRAY[image_url] WHERE image_url IS NOT NULL AND (images IS NULL OR images = '{}');
