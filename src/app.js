// src/app.js — Anaqa Kids Storefront
import { supabase, getProducts, signIn, signUp, signOut, getSession, isAdmin, createOrder } from './lib/supabase.js';
import { cart } from './lib/cart.js';

let state = { category: 'all', search: '', page: 1, total: 0, session: null, admin: false };
const PER_PAGE = 12;

async function init() {
  state.session = await getSession();
  state.admin = state.session ? await isAdmin() : false;
  updateAuthBtn();
  renderCartBadge();
  loadProducts();
  loadFeatured();
  loadArrivals();
  bindEvents();
  
  // Handlers for dynamic session changes and confirmation redirects
  supabase.auth.onAuthStateChange(async (event, session) => {
    state.session = session;
    state.admin = session ? await isAdmin() : false;
    updateAuthBtn();

    // Catch the successful email confirmation redirect automatically from Brevo links
    if (event === 'SIGNED_IN' && session) {
      console.log('Email verified successfully:', session.user);
      
      // 1. Notify the customer
      if (typeof showToast === 'function') {
        showToast('Email confirmed successfully! Welcome to Anaqa Kids. ✨', 'success');
      } else {
        alert('Email confirmed successfully! Welcome to Anaqa Kids. ✨');
      }
      
      // 2. Wipe out the internal security hash parameters from the browser address bar
      if (window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  });
}

async function loadProducts() {
  showSkeletons();
  try {
    const { products, total } = await getProducts({ category: state.category, search: state.search, page: state.page, limit: PER_PAGE });
    state.total = total;
    renderProducts(products, 'productsGrid');
    renderPagination();
    document.getElementById('productsCount').textContent = `${total} item${total !== 1 ? 's' : ''}`;
    document.getElementById('productsTitle').textContent = state.category === 'all' ? 'All Products' : capitalize(state.category) + "'s Collection";
  } catch (e) {
    document.getElementById('productsGrid').innerHTML = `<p style="color:var(--danger);grid-column:1/-1">Failed to load products.</p>`;
  }
}

async function loadFeatured() {
  try { const { products } = await getProducts({ featured: true, limit: 4 }); renderProducts(products, 'featuredGrid'); } catch {}
}
async function loadArrivals() {
  try { const { products } = await getProducts({ newArrivals: true, limit: 4 }); renderProducts(products, 'arrivalsGrid'); } catch {}
}

function showSkeletons() {
  document.getElementById('productsGrid').innerHTML = Array(8).fill('<div class="product-skeleton"></div>').join('');
}

function renderProducts(products, containerId) {
  const grid = document.getElementById(containerId);
  if (!products || !products.length) { grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px 0">No products found.</p>'; return; }
  grid.innerHTML = products.map(p => productCardHTML(p)).join('');

  // Click on card → product detail page
  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('add-to-cart-btn') || e.target.closest('.add-to-cart-btn')) return;
      window.location.href = `product.html?id=${card.dataset.id}`;
    });
  });

  // Add to cart buttons
  grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const product = products.find(p => p.id === id);
      if (!product) return;
      // If product has sizes, send to product page instead
      if (product.sizes && product.sizes.length > 0) {
        showToast('Please select a size first', '');
        window.location.href = `product.html?id=${id}`;
        return;
      }
      cart.add(product, 1, '');
      showToast(`${product.name} added to cart! 🛍️`, 'success');
      renderCartBadge();
    });
  });
}

function productCardHTML(p) {
  // Use first image from images array, fall back to image_url
  const img = (p.images && p.images[0]) || p.image_url || null;
  const discount = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  const outOfStock = p.stock === 0;
  const badge = outOfStock ? '<span class="product-badge badge-out">Out of Stock</span>'
    : p.is_new_arrival ? '<span class="product-badge badge-new">New</span>'
    : p.is_featured ? '<span class="product-badge badge-featured">Featured</span>' : '';

  // Show image count badge if multiple photos
  const photoCount = p.images && p.images.length > 1
    ? `<span style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:3px 7px;border-radius:10px">📷 ${p.images.length}</span>`
    : '';

  const imgHTML = img
    ? `<img src="${escHtml(img)}" alt="${escHtml(p.name)}" loading="lazy" />`
    : `<div class="product-img-placeholder"><svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>No image</span></div>`;

  const hasSizes = p.sizes && p.sizes.length > 0;

  return `
  <div class="product-card" data-id="${p.id}" style="cursor:pointer">
    <div class="product-img-wrap">${imgHTML}${badge}${photoCount}</div>
    <div class="product-body">
      <p class="product-category">${escHtml(p.category)}</p>
      <h3 class="product-name">${escHtml(p.name)}</h3>
      <div class="product-price-row">
        <span class="product-price">₹${p.price}</span>
        ${p.original_price ? `<span class="product-original">₹${p.original_price}</span>` : ''}
        ${discount > 0 ? `<span class="product-discount">${discount}% OFF</span>` : ''}
      </div>
      ${hasSizes ? `<p style="font-size:11px;color:var(--teal);margin-bottom:8px;font-weight:600">Sizes: ${p.sizes.join(' · ')}</p>` : ''}
      <p class="product-stock ${p.stock < 5 && p.stock > 0 ? 'low' : ''}">
        ${outOfStock ? 'Out of stock' : p.stock < 5 ? `Only ${p.stock} left!` : 'In stock'}
      </p>
      <button class="add-to-cart-btn" data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>${outOfStock ? 'Out of Stock' : hasSizes ? 'Select Size' : 'Add to Cart'}</button>
    </div>
  </div>`;
}

function renderPagination() {
  const totalPages = Math.ceil(state.total / PER_PAGE);
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map(n => `<button class="page-btn ${n === state.page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('');
  el.querySelectorAll('.page-btn').forEach(btn =>
    btn.addEventListener('click', () => { state.page = +btn.dataset.page; loadProducts(); window.scrollTo({ top: 0, behavior: 'smooth' }); })
  );
}

function renderCartBadge() {
  const count = cart.getCount();
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function renderCartDrawer() {
  const items = cart.getItems();
  const itemsEl = document.getElementById('cartItems');
  const footerEl = document.getElementById('cartFooter');
  if (!items.length) {
    itemsEl.innerHTML = `<div class="cart-empty"><svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><p>Your cart is empty</p></div>`;
    footerEl.innerHTML = ''; return;
  }
  itemsEl.innerHTML = items.map(item => `
    <div class="cart-item">
      ${item.image_url ? `<img class="cart-item-img" src="${escHtml(item.image_url)}" alt="${escHtml(item.name)}" />` : `<div class="cart-item-img"></div>`}
      <div class="cart-item-info">
        <p class="cart-item-name">${escHtml(item.name)}${item.size ? ` <span style="color:var(--teal);font-size:12px">(${escHtml(item.size)})</span>` : ''}</p>
        <p class="cart-item-price">₹${(item.price * item.qty).toFixed(2)}</p>
        <div class="cart-item-qty">
          <button class="qty-btn" data-action="dec" data-key="${item.cartKey}">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" data-action="inc" data-key="${item.cartKey}">+</button>
        </div>
      </div>
      <span class="cart-remove" data-key="${item.cartKey}">✕</span>
    </div>`).join('');

  footerEl.innerHTML = `
    <div class="cart-total-row"><span class="cart-total-label">Total</span><span class="cart-total-amount">₹${cart.getTotal().toFixed(2)}</span></div>
    <button class="btn btn-whatsapp btn-block" id="checkoutBtn">
