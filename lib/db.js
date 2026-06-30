// blancblanc shop ─ データベース層（Node 組み込み node:sqlite を使用）
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { load } = require('./loadProducts');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'shop.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS products (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    cat       TEXT,
    tag       TEXT,
    price     INTEGER NOT NULL DEFAULT 0,
    badge     TEXT,
    imgs      TEXT,            -- JSON 配列
    colors    TEXT,            -- JSON 配列
    lead      TEXT,
    set_items TEXT,            -- JSON 配列
    material  TEXT,
    size      TEXT,
    target    TEXT,
    variants  TEXT,            -- JSON 配列 [{label,price}]（価格つきバリエーション）
    stock     INTEGER NOT NULL DEFAULT 100,
    active    INTEGER NOT NULL DEFAULT 1,
    sort      INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             TEXT PRIMARY KEY,        -- 注文番号 例: BB-20260628-0001
    customer_name  TEXT,
    email          TEXT,
    phone          TEXT,
    postal         TEXT,
    address        TEXT,
    note           TEXT,
    subtotal       INTEGER NOT NULL DEFAULT 0,
    shipping       INTEGER NOT NULL DEFAULT 0,
    total          INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending',   -- pending/paid/shipped/cancelled
    payment_status TEXT NOT NULL DEFAULT 'unpaid',    -- unpaid/paid/refunded
    stripe_session_id TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT NOT NULL,
    product_id TEXT,
    name       TEXT,
    price      INTEGER NOT NULL DEFAULT 0,
    qty        INTEGER NOT NULL DEFAULT 1,
    color      TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
`);

// ---- マイグレーション：既存DBに不足列を追加 ----
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('products', 'variants', 'variants TEXT');
ensureColumn('products', 'pick', 'pick TEXT'); // 複数選択 {count, options}（例：4種から3本）
ensureColumn('products', 'color_img', 'color_img TEXT'); // 色別メイン画像 {colorLabel: imgFile}

// ---- 初回シード：products テーブルが空なら products.js から投入 ----
function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  if (row.n > 0) return { seeded: false, count: row.n };
  const { products } = load();
  const insert = db.prepare(`
    INSERT INTO products (id,name,cat,tag,price,badge,imgs,colors,variants,pick,color_img,lead,set_items,material,size,target,stock,active,sort)
    VALUES (@id,@name,@cat,@tag,@price,@badge,@imgs,@colors,@variants,@pick,@color_img,@lead,@set_items,@material,@size,@target,@stock,@active,@sort)
  `);
  products.forEach((p, i) => {
    insert.run({
      id: p.id,
      name: p.name,
      cat: p.cat || null,
      tag: p.tag || null,
      price: p.price || 0,
      badge: p.badge || null,
      imgs: JSON.stringify(p.imgs || []),
      colors: JSON.stringify(p.colors || []),
      variants: JSON.stringify(p.variants || []),
      pick: p.pick ? JSON.stringify(p.pick) : null,
      color_img: p.colorImg ? JSON.stringify(p.colorImg) : null,
      lead: p.lead || null,
      set_items: JSON.stringify(p.set || []),
      material: p.material || null,
      size: p.size || null,
      target: p.target || null,
      stock: 100,
      active: 1,
      sort: i,
    });
  });
  return { seeded: true, count: products.length };
}

// DB の行を storefront/フロント用の形に整形
function rowToProduct(r) {
  return {
    id: r.id,
    name: r.name,
    cat: r.cat,
    tag: r.tag,
    price: r.price,
    badge: r.badge || undefined,
    imgs: JSON.parse(r.imgs || '[]'),
    colors: JSON.parse(r.colors || '[]'),
    variants: JSON.parse(r.variants || '[]'),
    pick: r.pick ? JSON.parse(r.pick) : null,
    colorImg: r.color_img ? JSON.parse(r.color_img) : null,
    lead: r.lead || '',
    set: JSON.parse(r.set_items || '[]'),
    material: r.material || '',
    size: r.size || '',
    target: r.target || '',
    stock: r.stock,
    active: !!r.active,
    sort: r.sort,
  };
}

module.exports = { db, seedIfEmpty, rowToProduct };
