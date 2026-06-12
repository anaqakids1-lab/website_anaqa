// src/lib/cart.js
const CART_KEY = 'anaqa_cart';

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
}

export const cart = {
  getItems: () => loadCart(),

  // cartKey = id + size so same product in different sizes = separate line items
  add(product, qty = 1, size = '') {
    const items = loadCart();
    const key = product.id + (size ? '_' + size : '');
    const idx = items.findIndex(i => i.cartKey === key);
    if (idx >= 0) {
      items[idx].qty += qty;
    } else {
      items.push({
        cartKey: key,
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: (product.images && product.images[0]) || product.image_url || null,
        size: size || '',
        qty,
      });
    }
    saveCart(items);
  },

  remove(cartKey) { saveCart(loadCart().filter(i => i.cartKey !== cartKey)); },

  updateQty(cartKey, qty) {
    if (qty < 1) return cart.remove(cartKey);
    const items = loadCart();
    const idx = items.findIndex(i => i.cartKey === cartKey);
    if (idx >= 0) { items[idx].qty = qty; saveCart(items); }
  },

  clear() { saveCart([]); },

  getCount: () => loadCart().reduce((s, i) => s + i.qty, 0),
  getTotal: () => loadCart().reduce((s, i) => s + i.price * i.qty, 0),

  buildWhatsAppMessage(customerName, phone, address) {
    const items = loadCart();
    const lines = items.map(i =>
      `• ${i.name}${i.size ? ` (Size: ${i.size})` : ''} × ${i.qty} = ₹${(i.price * i.qty).toFixed(2)}`
    ).join('\n');

    // Collect product image URLs to attach
    const imageUrls = [...new Set(items.filter(i => i.image_url).map(i => i.image_url))];
    const imageSection = imageUrls.length
      ? `\n\n🖼️ *Product images:*\n${imageUrls.join('\n')}`
      : '';

    const total = cart.getTotal();
    return encodeURIComponent(
      `🛍️ *New Order — Anaqa Kids*\n\n` +
      `👤 *Customer:* ${customerName}\n` +
      `📞 *Phone:* ${phone}\n` +
      `📍 *Address:* ${address}\n\n` +
      `*Items ordered:*\n${lines}\n\n` +
      `💰 *Total: ₹${total.toFixed(2)}*` +
      imageSection +
      `\n\n_Ordered via AnaqaKids.com_`
    );
  },
};
