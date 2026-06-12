# 🛍️ Anaqa Kids — Production eCommerce Platform

**Store:** Anaqa Kids | Baghi Mehtab, Near J&K Bank, Srinagar, J&K  
**WhatsApp:** +91 9103228518  
**Stack:** Vanilla JS + Supabase + Netlify + GitHub

---

## 📁 Project Structure

```
anaqa-kids/
├── index.html              # Main storefront
├── admin.html              # Admin dashboard
├── netlify.toml            # Netlify config
├── sql/
│   └── schema.sql          # Complete DB schema + RLS + seed data
├── src/
│   ├── app.js              # Storefront logic
│   ├── admin.js            # Admin dashboard logic
│   ├── lib/
│   │   ├── supabase.js     # Supabase client + all DB helpers
│   │   └── cart.js         # Cart (localStorage)
│   └── styles/
│       ├── main.css        # Storefront styles
│       └── admin.css       # Admin styles
```

---

## ⚡ Quick Setup (30 minutes)

### Step 1 — Supabase Database

1. Go to [supabase.com](https://supabase.com) → your project
2. Open **SQL Editor**
3. Copy-paste the entire contents of `sql/schema.sql` and run it
4. This creates all tables, RLS policies, storage bucket, and sample products

### Step 2 — Create Admin User

1. In Supabase dashboard → **Authentication → Users → Invite user**
2. Email: `admin@anaqakids.com` | Password: `anaqa2024`
3. After creating, go to **SQL Editor** and run:

```sql
INSERT INTO admins (auth_id, email)
SELECT id, email FROM auth.users WHERE email = 'admin@anaqakids.com';
```

### Step 3 — GitHub

```bash
git init
git add .
git commit -m "Initial Anaqa Kids deployment"
git remote add origin https://github.com/YOUR_USERNAME/anaqa-kids.git
git push -u origin main
```

### Step 4 — Netlify

1. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
2. Connect your GitHub repo
3. Build settings: leave blank (static site)
4. Publish directory: `.` (root)
5. Click **Deploy site**

That's it! Your store is live. 🎉

---

## 🔐 Supabase Credentials

```
URL:  https://btlelhyclzswnyleryox.supabase.co
Key:  sb_publishable_3py8Q3GPQ8M1ALXG2x2DzA_cG5cRO49
```

These are already set in `src/lib/supabase.js`. No environment variables needed for a static site.

---

## 🛡️ Security

- **Row Level Security (RLS)** is enabled on all tables
- Public can only **read** products
- Only authenticated admins can **create/update/delete** products
- Customers can only see their own orders and profile
- The `is_admin()` function checks the `admins` table server-side

---

## 🏪 Features

### Storefront (`index.html`)
- ✅ Product grid with category filters (All/Girls/Boys/Baby/Winter)
- ✅ Real-time search with debounce
- ✅ Featured products section
- ✅ New arrivals section
- ✅ Cart drawer (add/remove/qty/clear)
- ✅ WhatsApp checkout with order auto-saved to Supabase
- ✅ Customer sign up / sign in modal
- ✅ Mobile-first responsive design
- ✅ Skeleton loading states
- ✅ Pagination
- ✅ Discount badges, stock warnings

### Admin Dashboard (`admin.html`)
- ✅ Stats: Revenue, Orders, Products, Customers, Pending
- ✅ Product CRUD (create, read, update, delete)
- ✅ Image upload to Supabase Storage
- ✅ Order management with status updates
- ✅ Customer list
- ✅ WhatsApp shortcut from order row
- ✅ Admin-only access with Supabase auth check

---

## 📦 Order Flow

1. Customer browses and adds items to cart
2. Clicks "Order via WhatsApp"
3. Fills name + phone + address
4. Order is saved to Supabase `orders` table
5. WhatsApp opens with pre-filled message to `+91 9103228518`
6. Admin confirms on WhatsApp and updates order status in dashboard

---

## 🖼️ Adding Product Images

In the Admin Dashboard → Products → Add/Edit Product:
1. Click the **image file input**
2. Select an image from your device
3. Image uploads automatically to Supabase Storage (`product-images` bucket)
4. Public URL is saved with the product

---

## 🔄 Updating After Deployment

```bash
git add .
git commit -m "Update: added new products"
git push
```
Netlify auto-deploys on every push to `main`.

---

## 📞 Support

- **Store:** Baghi Mehtab, Near J&K Bank, Srinagar
- **WhatsApp:** [+91 9103228518](https://wa.me/919103228518)
- **Admin email:** admin@anaqakids.com
