// src/admin.js — Anaqa Kids Admin Dashboard
import {
  supabase, signIn, signOut, getSession, isAdmin,
  getProducts, createProduct, updateProduct, deleteProduct, uploadProductImage,
  getOrders, updateOrderStatus, getCustomers, getDashboardStats
} from './lib/supabase.js';

let adminState = { session: null, tab: 'dashboard', editingProductId: null, uploadedImages: [] };

async function init() {
  adminState.session = await getSession();
  if (!adminState.session) { showAuthSection(); return; }
  const admin = await isAdmin();
  if (!admin) { showAccessDenied(); return; }
  showAdminUI();
  loadDashboard();
}

function showAuthSection() {
  document.getElementById('adminAuthSection').style.display = 'flex';
  document.getElementById('tab-dashboard').style.display = 'none';
  document.getElementById('adminLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('adminLoginMsg');
    try {
      await signIn(document.getElementById('alEmail').value, document.getElementById('alPass').value);
      const admin = await isAdmin();
      if (!admin) { msg.innerHTML = `<div class="auth-msg error">This account does not have admin access.</div>`; await signOut(); return; }
      document.getElementById('adminAuthSection').style.display = 'none';
      showAdminUI(); loadDashboard();
    } catch (err) { msg.innerHTML = `<div class="auth-msg error">${escHtml(err.message)}</div>`; }
  });
}

function showAccessDenied() {
  document.getElementById('accessDenied').style.display = 'flex';
  document.getElementById('tab-dashboard').style.display = 'none';
}

function showAdminUI() {
  document.getElementById('adminEmail').textContent = adminState.session?.user?.email || '';
  document.getElementById('dashGreeting').textContent = `Good ${timeOfDay()}, Admin!`;
  document.getElementById('adminSignOut').addEventListener('click', async () => { await signOut(); window.location.reload(); });
  bindSidebar();
  bindProductModal();
}

async function loadDashboard() {
  try {
    const stats = await getDashboardStats();
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="stat-value">${stats.totalProducts}</div><div class="stat-label">Products</div></div>
      <div class="stat-card revenue"><div class="stat-value">₹${stats.totalRevenue.toLocaleString('en-IN',{maximumFractionDigits:0})}</div><div class="stat-label">Revenue</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalOrders}</div><div class="stat-label">Orders</div></div>
      <div class="stat-card pending"><div class="stat-value">${stats.pendingOrders}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalCustomers}</div><div class="stat-label">Customers</div></div>`;
    const { orders } = await getOrders({ limit: 10 });
    renderOrdersTable(orders, 'recentOrders', true);
  } catch (e) { console.error(e); }
}

async function loadProducts() {
  const search = document.getElementById('productSearch').value;
  const category = document.getElementById('productCatFilter').value;
  try {
    const { products } = await getProducts({ search, category: category || 'all', limit: 50 });
    const wrap = document.getElementById('productsTable');
    if (!products.length) { wrap.innerHTML = '<p style="color:var(--text-muted);padding:20px">No products found.</p>'; return; }
    wrap.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Images</th><th>Name</th><th>Category</th><th>Price</th><th>Sizes</th><th>Stock</th><th>Actions</th></tr></thead>
      <tbody>${products.map(p => {
        const imgs = p.images && p.images.length ? p.images : (p.image_url ? [p.image_url] : []);
        const thumbs = imgs.slice(0,3).map(u => `<img class="product-thumb" src="${escHtml(u)}" style="width:36px;height:40px;margin-right:3px">`).join('');
        const moreCount = imgs.length > 3 ? `<span style="font-size:11px;color:var(--text-muted)">+${imgs.length-3}</span>` : '';
        return `<tr>
          <td style="display:flex;align-items:center;gap:2px;padding-top:10px">${thumbs || '<div class="product-thumb"></div>'}${moreCount}</td>
          <td><strong>${escHtml(p.name)}</strong></td>
          <td>${escHtml(p.category)}</td>
          <td>₹${p.price}${p.original_price ? `<br><small style="color:var(--text-muted)">was ₹${p.original_price}</small>` : ''}</td>
          <td style="font-size:12px">${p.sizes && p.sizes.length ? p.sizes.join(', ') : '—'}</td>
          <td style="${p.stock===0?'color:var(--danger)':p.stock<5?'color:#E67E22':''}">${p.stock}</td>
          <td><div class="table-actions">
            <button class="action-btn action-btn-edit" data-id="${p.id}">Edit</button>
            <button class="action-btn action-btn-delete" data-id="${p.id}">Delete</button>
          </div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
    wrap.querySelectorAll('.action-btn-edit').forEach(btn => btn.addEventListener('click', () => openProductModal(products.find(p => p.id === btn.dataset.id))));
    wrap.querySelectorAll('.action-btn-delete').forEach(btn => btn.addEventListener('click', async () => {
      if (confirm('Delete this product?')) {
        try { await deleteProduct(btn.dataset.id); showToast('Product deleted'); loadProducts(); } catch (e) { showToast(e.message, 'error'); }
      }
    }));
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadOrders() {
  const status = document.getElementById('orderStatusFilter').value;
  try {
    const { orders } = await getOrders({ status: status || undefined, limit: 100 });
    renderOrdersTable(orders, 'ordersTable', false);
  } catch (e) { showToast(e.message, 'error'); }
}

function renderOrdersTable(orders, containerId, compact) {
  const el = document.getElementById(containerId);
  if (!orders.length) { el.innerHTML = '<p style="color:var(--text-muted);padding:20px">No orders found.</p>'; return; }
  el.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Items</th><th>Total</th><th>Status</th>${compact ? '' : '<th>Actions</th>'}</tr></thead>
    <tbody>${orders.map(o => `
      <tr>
        <td style="font-size:12px;white-space:nowrap">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
        <td><strong>${escHtml(o.customer_name)}</strong></td>
        <td><a href="tel:${escHtml(o.customer_phone)}" style="color:var(--teal)">${escHtml(o.customer_phone)}</a></td>
        <td style="font-size:12px">${Array.isArray(o.items) ? o.items.map(i => `${escHtml(i.name)}${i.size ? ` (${i.size})` : ''} ×${i.qty}`).join(', ') : '—'}</td>
        <td><strong>₹${Number(o.total_amount).toFixed(2)}</strong></td>
        <td>${compact
          ? `<span class="status-badge status-${o.status}">${o.status}</span>`
          : `<select class="status-select" data-id="${o.id}">${['pending','confirmed','shipped','delivered','cancelled'].map(s=>`<option value="${s}"${o.status===s?' selected':''}>${s}</option>`).join('')}</select>`}
        </td>
        ${compact ? '' : `<td><div class="table-actions"><a href="https://wa.me/${o.customer_phone.replace(/\D/g,'')}" target="_blank" class="action-btn action-btn-wa">WhatsApp</a></div></td>`}
      </tr>`).join('')}
    </tbody></table></div>`;
  if (!compact) {
    el.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async () => { try { await updateOrderStatus(sel.dataset.id, sel.value); showToast('Status updated', 'success'); } catch (e) { showToast(e.message, 'error'); } });
    });
  }
}

async function loadCustomers() {
  try {
    const { customers } = await getCustomers({ limit: 100 });
    const el = document.getElementById('customersTable');
    if (!customers.length) { el.innerHTML = '<p style="color:var(--text-muted);padding:20px">No customers yet.</p>'; return; }
    el.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Joined</th></tr></thead>
      <tbody>${customers.map(c => `
        <tr><td><strong>${escHtml(c.name)}</strong></td><td>${escHtml(c.email)}</td>
        <td>${escHtml(c.phone||'—')}</td><td>${escHtml(c.city||'—')}</td>
        <td style="font-size:12px">${new Date(c.created_at).toLocaleDateString('en-IN')}</td></tr>`).join('')}
      </tbody></table></div>`;
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Product Modal ──────────────────────────────────────────────
function openProductModal(product = null) {
  adminState.editingProductId = product?.id || null;
  adminState.uploadedImages = (product?.images && product.images.length) ? [...product.images] : (product?.image_url ? [product.image_url] : []);

  document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('pId').value = product?.id || '';
  document.getElementById('pName').value = product?.name || '';
  document.getElementById('pCategory').value = product?.category || '';
  document.getElementById('pDesc').value = product?.description || '';
  document.getElementById('pPrice').value = product?.price || '';
  document.getElementById('pOrigPrice').value = product?.original_price || '';
  document.getElementById('pStock').value = product?.stock ?? 0;
  document.getElementById('pFeatured').checked = product?.is_featured || false;
  document.getElementById('pNewArrival').checked = product?.is_new_arrival || false;
  // Sizes
  document.getElementById('pSizes').value = product?.sizes ? product.sizes.join(', ') : '';
  document.getElementById('productFormMsg').innerHTML = '';

  renderImagePreviews();
  document.getElementById('productModalOverlay').classList.add('open');
}

function renderImagePreviews() {
  const container = document.getElementById('pImagesPreview');
  if (!adminState.uploadedImages.length) { container.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">No images yet</p>'; return; }
  container.innerHTML = adminState.uploadedImages.map((url, i) => `
    <div style="position:relative;display:inline-block;margin:0 6px 6px 0">
      <img src="${escHtml(url)}" style="width:72px;height:80px;object-fit:cover;border-radius:8px;border:${i===0?'2px solid var(--teal)':'1px solid var(--border)'}">
      ${i===0 ? '<span style="position:absolute;bottom:0;left:0;right:0;background:var(--teal);color:#fff;font-size:9px;text-align:center;border-radius:0 0 6px 6px;padding:2px">Main</span>' : ''}
      <button onclick="removeImage(${i})" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:var(--danger);color:#fff;border:none;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    </div>`).join('');
}

window.removeImage = function(idx) {
  adminState.uploadedImages.splice(idx, 1);
  renderImagePreviews();
};

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
  document.getElementById('productForm').reset();
  adminState.editingProductId = null;
  adminState.uploadedImages = [];
}

function bindProductModal() {
  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
  document.getElementById('productModalClose').addEventListener('click', closeProductModal);
  document.getElementById('productCancelBtn').addEventListener('click', closeProductModal);
  document.getElementById('productModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeProductModal(); });

  // Multiple image upload
  document.getElementById('pImages').addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const preview = document.getElementById('pImagesPreview');
    preview.innerHTML = `<p style="font-size:12px;color:var(--text-muted)">Uploading ${files.length} image(s)…</p>`;
    try {
      for (const file of files) {
        const url = await uploadProductImage(file);
        adminState.uploadedImages.push(url);
      }
      renderImagePreviews();
      showToast(`${files.length} image(s) uploaded`, 'success');
    } catch (err) {
      preview.innerHTML = `<p style="font-size:12px;color:var(--danger)">Upload failed: ${escHtml(err.message)}</p>`;
    }
    e.target.value = '';
  });

  document.getElementById('productForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msgEl = document.getElementById('productFormMsg');
    const btn = document.getElementById('productSubmitBtn');
    btn.textContent = 'Saving…'; btn.disabled = true;

    // Parse sizes from comma-separated input
    const sizesRaw = document.getElementById('pSizes').value;
    const sizes = sizesRaw ? sizesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const data = {
      name: document.getElementById('pName').value.trim(),
      category: document.getElementById('pCategory').value,
      description: document.getElementById('pDesc').value.trim(),
      price: parseFloat(document.getElementById('pPrice').value),
      original_price: parseFloat(document.getElementById('pOrigPrice').value) || null,
      stock: parseInt(document.getElementById('pStock').value) || 0,
      images: adminState.uploadedImages,
      image_url: adminState.uploadedImages[0] || null, // backwards compat
      sizes: sizes,
      is_featured: document.getElementById('pFeatured').checked,
      is_new_arrival: document.getElementById('pNewArrival').checked,
    };

    try {
      if (adminState.editingProductId) {
        await updateProduct(adminState.editingProductId, data);
        showToast('Product updated!', 'success');
      } else {
        await createProduct(data);
        showToast('Product added!', 'success');
      }
      closeProductModal(); loadProducts();
    } catch (err) {
      msgEl.innerHTML = `<div class="auth-msg error">${escHtml(err.message)}</div>`;
    } finally { btn.textContent = 'Save Product'; btn.disabled = false; }
  });
}

function bindSidebar() {
  document.querySelectorAll('.sidebar-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
      document.getElementById(`tab-${tab}`).classList.remove('hidden');
      adminState.tab = tab;
      if (tab === 'products') loadProducts();
      else if (tab === 'orders') loadOrders();
      else if (tab === 'customers') loadCustomers();
      else if (tab === 'dashboard') loadDashboard();
    });
  });
  let st;
  document.getElementById('productSearch').addEventListener('input', () => { clearTimeout(st); st = setTimeout(loadProducts, 400); });
  document.getElementById('productCatFilter').addEventListener('change', loadProducts);
  document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);
}

function showToast(msg, type = '') {
  let c = document.querySelector('.toast-container');
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
}
function escHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function timeOfDay() { const h = new Date().getHours(); return h<12?'morning':h<17?'afternoon':'evening'; }

init();
