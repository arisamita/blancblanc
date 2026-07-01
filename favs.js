/* blancblanc お気に入り（localStorage管理） */
(function () {
  const KEY = 'bb_favorites';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function write(ids) {
    localStorage.setItem(KEY, JSON.stringify(ids));
    updateBadge();
    document.dispatchEvent(new CustomEvent('bb-fav-change'));
  }

  const Favs = {
    ids: read,
    has: (id) => read().includes(id),
    toggle(id) {
      const ids = read();
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1); else ids.push(id);
      write(ids);
      return ids.includes(id);
    },
    remove: (id) => write(read().filter((x) => x !== id)),
    count: () => read().length,
  };

  function updateBadge() {
    const n = Favs.count();
    document.querySelectorAll('[data-fav-badge]').forEach((el) => {
      el.textContent = n;
      el.style.display = n > 0 ? 'flex' : 'none';
    });
  }

  window.Favs = Favs;
  document.addEventListener('DOMContentLoaded', updateBadge);
})();
