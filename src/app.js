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
  supabase.auth.onAuthStateChange(async (_e, session) => {
    state.session = session;
    state.admin = session ? await isAdmin() : false;
    updateAuthBtn();
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
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Order via WhatsApp
    </button>`;

  document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
  itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key; const action = btn.dataset.action;
      const it = cart.getItems().find(i => i.cartKey === key);
      if (it) cart.updateQty(key, action === 'inc' ? it.qty + 1 : it.qty - 1);
      renderCartDrawer(); renderCartBadge();
    });
  });
  itemsEl.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => { cart.remove(btn.dataset.key); renderCartDrawer(); renderCartBadge(); });
  });
}

function openCheckout() {
  const items = cart.getItems();
  if (!items.length) return;
  document.getElementById('checkoutSummary').innerHTML = `
    <p class="order-summary-title">Order Summary</p>
    ${items.map(i => `<div class="order-summary-item"><span>${escHtml(i.name)}${i.size ? ` (${i.size})` : ''} ×${i.qty}</span><span>₹${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
    <div class="order-summary-total"><span>Total</span><span>₹${cart.getTotal().toFixed(2)}</span></div>`;
  openModal('checkoutOverlay');
}

function renderAuthModal() {
  if (state.session) {
    document.getElementById('authModalTitle').textContent = 'My Account';
    document.getElementById('authContent').innerHTML = `
      <div class="auth-form">
        <p style="margin-bottom:14px">Signed in as <strong>${escHtml(state.session.user.email)}</strong></p>
        ${state.admin ? `<a href="admin.html" class="btn btn-primary btn-block" style="margin-bottom:12px">Admin Dashboard</a>` : ''}
        <button class="btn btn-secondary btn-block" id="signOutBtn">Sign Out</button>
      </div>`;
    document.getElementById('signOutBtn').addEventListener('click', async () => { await signOut(); closeModal('authOverlay'); showToast('Signed out'); });
    return;
  }
  document.getElementById('authModalTitle').textContent = 'Sign In / Register';
  document.getElementById('authContent').innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab active" data-tab="signin">Sign In</button>
      <button class="auth-tab" data-tab="signup">Create Account</button>
    </div><div id="authTabContent"></div>`;
  renderAuthTab('signin');
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => { document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); renderAuthTab(tab.dataset.tab); });
  });
}

function renderAuthTab(tab) {
  const content = document.getElementById('authTabContent');
  if (tab === 'signin') {
    content.innerHTML = `<form class="auth-form" id="signinForm"><div id="signinMsg"></div>
      <div class="form-group"><label>Email</label><input type="email" id="siEmail" required /></div>
      <div class="form-group"><label>Password</label><input type="password" id="siPass" required /></div>
      <button type="submit" class="btn btn-primary btn-block">Sign In</button></form>`;
    document.getElementById('signinForm').addEventListener('submit', async e => {
      e.preventDefault();
      try { await signIn(document.getElementById('siEmail').value, document.getElementById('siPass').value); closeModal('authOverlay'); showToast('Welcome back!', 'success'); }
      catch (err) { document.getElementById('signinMsg').innerHTML = `<div class="auth-msg error">${escHtml(err.message)}</div>`; }
    });
  } else {
    content.innerHTML = `<form class="auth-form" id="signupForm"><div id="signupMsg"></div>
      <div class="form-group"><label>Full Name</label><input type="text" id="suName" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="suEmail" required /></div>
      <div class="form-group"><label>Phone</label><input type="tel" id="suPhone" /></div>
      <div class="form-group"><label>Password</label><input type="password" id="suPass" required minlength="6" /></div>
      <button type="submit" class="btn btn-primary btn-block">Create Account</button></form>`;
    document.getElementById('signupForm').addEventListener('submit', async e => {
      e.preventDefault();
      try { await signUp(document.getElementById('suEmail').value, document.getElementById('suPass').value, document.getElementById('suName').value, document.getElementById('suPhone').value); document.getElementById('signupMsg').innerHTML = `<div class="auth-msg success">Account created! Check your email to verify.</div>`; }
      catch (err) { document.getElementById('signupMsg').innerHTML = `<div class="auth-msg error">${escHtml(err.message)}</div>`; }
    });
  }
}

function updateAuthBtn() { const btn = document.getElementById('authBtn'); if (btn) btn.title = state.session ? 'My Account' : 'Sign In'; }

function bindEvents() {
  document.getElementById('categoryFilters').querySelectorAll('.cat-pill').forEach(pill =>
    pill.addEventListener('click', () => { document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active')); pill.classList.add('active'); state.category = pill.dataset.cat; state.page = 1; loadProducts(); })
  );
  document.getElementById('searchToggle').addEventListener('click', () => { document.getElementById('searchBar').classList.toggle('open'); if (document.getElementById('searchBar').classList.contains('open')) document.getElementById('searchInput').focus(); });
  document.getElementById('searchClose').addEventListener('click', () => document.getElementById('searchBar').classList.remove('open'));
  let st;
  document.getElementById('searchInput').addEventListener('input', e => { clearTimeout(st); st = setTimeout(() => { state.search = e.target.value; state.page = 1; loadProducts(); }, 400); });
  document.getElementById('cartBtn').addEventListener('click', () => { renderCartDrawer(); openCartDrawer(); });
  document.getElementById('cartClose').addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay').addEventListener('click', closeCartDrawer);
  document.getElementById('authBtn').addEventListener('click', () => { renderAuthModal(); openModal('authOverlay'); });
  document.getElementById('authClose').addEventListener('click', () => closeModal('authOverlay'));
  document.getElementById('authOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('authOverlay'); });
  document.getElementById('checkoutClose').addEventListener('click', () => closeModal('checkoutOverlay'));
  document.getElementById('checkoutOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('checkoutOverlay'); });
  document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
  document.getElementById('checkoutForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('coName').value.trim();
    const phone = document.getElementById('coPhone').value.trim();
    const address = document.getElementById('coAddress').value.trim();
    if (!name || !phone) { showToast('Name and phone are required', 'error'); return; }
    try { await createOrder({ customer_name: name, customer_phone: phone, customer_address: address, items: cart.getItems(), total_amount: cart.getTotal(), status: 'pending' }); } catch {}
    const msg = cart.buildWhatsAppMessage(name, phone, address || 'Not provided');
    window.open(`https://wa.me/919103228518?text=${msg}`, '_blank');
    cart.clear(); renderCartBadge();
    closeModal('checkoutOverlay'); closeCartDrawer();
    showToast('Order sent via WhatsApp! 🎉', 'success');
  });
  window.addEventListener('cart:updated', renderCartBadge);
}

function openCartDrawer() { document.getElementById('cartDrawer').classList.add('open'); document.getElementById('cartOverlay').classList.add('open'); }
function closeCartDrawer() { document.getElementById('cartDrawer').classList.remove('open'); document.getElementById('cartOverlay').classList.remove('open'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(msg, type = '') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3200);
}
function escHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

init();
