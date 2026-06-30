/* blancblanc カート（ブラウザ内 localStorage 管理） */
(function () {
  const KEY = 'bb_cart';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadge();
    document.dispatchEvent(new CustomEvent('bb-cart-change'));
  }

  const Cart = {
    items: read,
    count() { return read().reduce((n, i) => n + i.qty, 0); },
    add(id, qty = 1, color = null) {
      const items = read();
      const found = items.find((i) => i.id === id && (i.color || null) === (color || null));
      if (found) found.qty = Math.min(99, found.qty + qty);
      else items.push({ id, qty: Math.max(1, qty), color: color || null });
      write(items);
    },
    setQty(id, color, qty) {
      const items = read();
      const it = items.find((i) => i.id === id && (i.color || null) === (color || null));
      if (it) { it.qty = Math.max(1, Math.min(99, qty)); write(items); }
    },
    remove(id, color) {
      write(read().filter((i) => !(i.id === id && (i.color || null) === (color || null))));
    },
    clear() { write([]); },
  };

  function updateBadge() {
    const n = Cart.count();
    document.querySelectorAll('[data-cart-badge]').forEach((el) => {
      el.textContent = n;
      el.style.display = n > 0 ? '' : 'none';
    });
  }

  window.Cart = Cart;
  document.addEventListener('DOMContentLoaded', updateBadge);
})();
