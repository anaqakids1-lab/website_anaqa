// src/lib/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://btlelhyclzswnyleryox.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3py8Q3GPQ8M1ALXG2x2DzA_cG5cRO49';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth ──────────────────────────────────────────────────────
export async function signUp(email, password, name, phone) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    await supabase.from('customers').insert({ auth_id: data.user.id, name, email, phone: phone || null });
  }
  return data;
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export async function isAdmin() {
  const session = await getSession();
  if (!session) return false;
  const { data } = await supabase.from('admins').select('id').eq('auth_id', session.user.id).single();
  return !!data;
}

// ── Products ──────────────────────────────────────────────────
export async function getProducts({ category, search, page = 1, limit = 12, featured, newArrivals } = {}) {
  let query = supabase.from('products').select('*', { count: 'exact' });
  if (category && category !== 'all') query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);
  if (featured) query = query.eq('is_featured', true);
  if (newArrivals) query = query.eq('is_new_arrival', true);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });
  const { data, error, count } = await query;
  if (error) throw error;
  return { products: data, total: count };
}
export async function getProduct(id) {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
export async function createProduct(product) {
  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw error;
  return data;
}
export async function updateProduct(id, updates) {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ── Image Upload (multiple) ────────────────────────────────────
export async function uploadProductImage(file) {
  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage.from('product-images').upload(filename, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ── Orders ─────────────────────────────────────────────────────
export async function createOrder(order) {
  const { data, error } = await supabase.from('orders').insert(order).select().single();
  if (error) throw error;
  return data;
}
export async function getOrders({ page = 1, limit = 20, status } = {}) {
  let query = supabase.from('orders').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });
  const { data, error, count } = await query;
  if (error) throw error;
  return { orders: data, total: count };
}
export async function updateOrderStatus(id, status) {
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Customers ──────────────────────────────────────────────────
export async function getCustomers({ page = 1, limit = 20 } = {}) {
  const from = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from('customers').select('*', { count: 'exact' })
    .range(from, from + limit - 1).order('created_at', { ascending: false });
  if (error) throw error;
  return { customers: data, total: count };
}

export async function getDashboardStats() {
  const [products, orders, customers] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('total_amount, status'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
  ]);
  const totalRevenue = orders.data?.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0) || 0;
  const pendingOrders = orders.data?.filter(o => o.status === 'pending').length || 0;
  return {
    totalProducts: products.count || 0,
    totalOrders: orders.data?.length || 0,
    totalCustomers: customers.count || 0,
    totalRevenue,
    pendingOrders,
  };
}
