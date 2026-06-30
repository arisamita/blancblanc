// blancblanc shop ─ アプリケーションサーバー
// 静的配信 + 商品/注文API + Stripe決済 + 管理API（注文管理・商品管理）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./config');
const { db, seedIfEmpty, rowToProduct } = require('./lib/db');
const { load } = require('./lib/loadProducts');

const root = __dirname;
const PUBLIC_DIR = root;

// Stripe（キーがあれば有効化）
let stripe = null;
if (config.stripeSecretKey) {
  try { stripe = require('stripe')(config.stripeSecretKey); }
  catch (e) { console.warn('Stripe初期化に失敗:', e.message); }
}

// 初回シード
const seed = seedIfEmpty();
console.log(seed.seeded ? `商品を初期投入しました（${seed.count}件）` : `商品データ ${seed.count}件`);

// ───────────────────────── 共通ユーティリティ ─────────────────────────
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
};

// 静的配信を禁止するパス（機密・サーバー内部）
const BLOCKED = ['/config.local.json', '/config.js', '/server.js', '/package.json', '/package-lock.json'];
function isBlocked(url) {
  const u = url.toLowerCase();
  if (u.startsWith('/data/') || u.startsWith('/lib/') || u.startsWith('/node_modules/') || u.startsWith('/.git/')) return true;
  return BLOCKED.includes(u);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}
function sendJson(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}
async function readJson(req) {
  const raw = await readBody(req);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// ───────────────────────── 管理ログイン（簡易セッション） ─────────────────────────
const adminTokens = new Set();
function isAdmin(req) {
  const c = parseCookies(req);
  return c.bb_admin && adminTokens.has(c.bb_admin);
}

// ───────────────────────── 商品（DB） ─────────────────────────
function listProducts({ activeOnly = true } = {}) {
  const sql = activeOnly
    ? 'SELECT * FROM products WHERE active=1 ORDER BY sort ASC, created_at ASC'
    : 'SELECT * FROM products ORDER BY sort ASC, created_at ASC';
  return db.prepare(sql).all().map(rowToProduct);
}
function getProduct(id) {
  const r = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  return r ? rowToProduct(r) : null;
}

// storefront 用の動的 products.js を生成（既存HTMLを変えずにDB駆動化）
function buildProductsJs() {
  const products = listProducts({ activeOnly: true });
  const { cats } = load(); // カテゴリ定義は元ファイルから流用
  return `/* 自動生成（DB由来）─ 編集は管理画面から */\n` +
    `window.PRODUCTS = ${JSON.stringify(products)};\n` +
    `window.CATS = ${JSON.stringify(cats)};\n`;
}

// ───────────────────────── 注文 ─────────────────────────
function genOrderId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const like = `BB-${ymd}-%`;
  const row = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE id LIKE ?').get(like);
  return `BB-${ymd}-${String(row.n + 1).padStart(4, '0')}`;
}

// バリエーション（色/タイプ）に応じた単価を返す。価格つきバリエーションがあればそちらを優先
function priceOf(p, label) {
  if (Array.isArray(p.variants) && p.variants.length) {
    const v = p.variants.find((v) => v.label === label);
    return (v ? v.price : p.variants[0].price);
  }
  return p.price;
}

// クライアントのカート（id,qty,color）から、サーバー側で正しい金額を組み立てる
function buildOrderFromCart(items) {
  const lines = [];
  let subtotal = 0;
  for (const it of items || []) {
    const p = getProduct(it.id);
    if (!p || !p.active) continue;
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    const unit = priceOf(p, it.color);
    const lineTotal = unit * qty;
    subtotal += lineTotal;
    lines.push({ product_id: p.id, name: p.name, price: unit, qty, color: it.color || null, img: (p.imgs || [])[0] || null });
  }
  const shipping = subtotal > 0 && subtotal < config.freeShippingThreshold ? config.shippingFee : 0;
  return { lines, subtotal, shipping, total: subtotal + shipping };
}

function saveOrder(order, customer) {
  const id = genOrderId();
  db.prepare(`INSERT INTO orders (id,customer_name,email,phone,postal,address,note,subtotal,shipping,total,status,payment_status)
    VALUES (@id,@customer_name,@email,@phone,@postal,@address,@note,@subtotal,@shipping,@total,'pending','unpaid')`).run({
    id,
    customer_name: customer.name || null,
    email: customer.email || null,
    phone: customer.phone || null,
    postal: customer.postal || null,
    address: customer.address || null,
    note: customer.note || null,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
  });
  const ins = db.prepare('INSERT INTO order_items (order_id,product_id,name,price,qty,color) VALUES (?,?,?,?,?,?)');
  order.lines.forEach((l) => ins.run(id, l.product_id, l.name, l.price, l.qty, l.color));
  return id;
}

function getOrderFull(id) {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (!o) return null;
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id);
  return o;
}

// ───────────────────────── ルーティング ─────────────────────────
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(urlObj.pathname);
  const method = req.method;

  try {
    // 動的 products.js
    if (pathname === '/products.js') {
      return send(res, 200, buildProductsJs(), { 'Content-Type': mimeTypes['.js'], 'Cache-Control': 'no-store' });
    }

    // 公開API ----------------------------------------------------------
    if (pathname === '/api/config' && method === 'GET') {
      return sendJson(res, 200, {
        stripePublishableKey: config.stripePublishableKey || '',
        stripeEnabled: !!stripe,
        freeShippingThreshold: config.freeShippingThreshold,
        shippingFee: config.shippingFee,
      });
    }

    if (pathname === '/api/products' && method === 'GET') {
      return sendJson(res, 200, listProducts({ activeOnly: true }));
    }

    // チェックアウト：注文作成 + Stripe Checkout セッション
    if (pathname === '/api/checkout' && method === 'POST') {
      const body = await readJson(req);
      const order = buildOrderFromCart(body.items);
      if (order.lines.length === 0) return sendJson(res, 400, { error: 'カートが空です' });
      const orderId = saveOrder(order, body.customer || {});

      if (!stripe) {
        // Stripe未設定：テスト用にそのまま完了ページへ（決済なし）
        return sendJson(res, 200, { mode: 'mock', orderId, redirectUrl: `/success.html?order=${orderId}&mock=1` });
      }

      const line_items = order.lines.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: 'jpy',
          unit_amount: l.price, // JPYはゼロ十進数（そのまま円）
          product_data: { name: l.name + (l.color ? `（${l.color}）` : '') },
        },
      }));
      if (order.shipping > 0) {
        line_items.push({
          quantity: 1,
          price_data: { currency: 'jpy', unit_amount: order.shipping, product_data: { name: '送料' } },
        });
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items,
        customer_email: body.customer?.email || undefined,
        metadata: { orderId },
        success_url: `${config.baseUrl}/success.html?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.baseUrl}/cart.html?canceled=1`,
      });
      db.prepare('UPDATE orders SET stripe_session_id=? WHERE id=?').run(session.id, orderId);
      return sendJson(res, 200, { mode: 'stripe', orderId, redirectUrl: session.url });
    }

    // 注文照会（完了ページ用・最小情報）
    if (pathname.startsWith('/api/order/') && method === 'GET') {
      const id = pathname.split('/').pop();
      const o = getOrderFull(id);
      if (!o) return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 200, {
        id: o.id, status: o.status, payment_status: o.payment_status,
        subtotal: o.subtotal, shipping: o.shipping, total: o.total,
        items: o.items.map((i) => ({ name: i.name, price: i.price, qty: i.qty, color: i.color })),
      });
    }

    // Stripe Webhook（決済確定）
    if (pathname === '/api/stripe/webhook' && method === 'POST') {
      const raw = await readBody(req);
      let event;
      try {
        if (stripe && config.stripeWebhookSecret) {
          event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], config.stripeWebhookSecret);
        } else {
          event = JSON.parse(raw);
        }
      } catch (e) {
        return send(res, 400, `Webhook Error: ${e.message}`);
      }
      if (event.type === 'checkout.session.completed') {
        const s = event.data.object;
        const orderId = s.metadata?.orderId;
        if (orderId) {
          db.prepare("UPDATE orders SET status='paid', payment_status='paid' WHERE id=?").run(orderId);
        }
      }
      return sendJson(res, 200, { received: true });
    }

    // 管理API ----------------------------------------------------------
    if (pathname === '/admin/api/login' && method === 'POST') {
      const b = await readJson(req);
      if (b.user === config.adminUser && b.password === config.adminPassword) {
        const token = crypto.randomBytes(24).toString('hex');
        adminTokens.add(token);
        return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `bb_admin=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400` });
      }
      return sendJson(res, 401, { error: 'IDまたはパスワードが違います' });
    }
    if (pathname === '/admin/api/logout' && method === 'POST') {
      const c = parseCookies(req); adminTokens.delete(c.bb_admin);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'bb_admin=; Path=/; Max-Age=0' });
    }
    if (pathname === '/admin/api/me' && method === 'GET') {
      return sendJson(res, 200, { admin: isAdmin(req) });
    }

    if (pathname.startsWith('/admin/api/')) {
      if (!isAdmin(req)) return sendJson(res, 401, { error: '未ログイン' });

      // 注文一覧 / 詳細 / ステータス更新
      if (pathname === '/admin/api/orders' && method === 'GET') {
        const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
        return sendJson(res, 200, rows);
      }
      if (pathname.startsWith('/admin/api/orders/') && method === 'GET') {
        const id = pathname.split('/').pop();
        const o = getOrderFull(id);
        return o ? sendJson(res, 200, o) : sendJson(res, 404, { error: 'not found' });
      }
      if (pathname.startsWith('/admin/api/orders/') && method === 'PATCH') {
        const id = pathname.split('/').pop();
        const b = await readJson(req);
        const allowed = ['pending', 'paid', 'shipped', 'cancelled'];
        if (!allowed.includes(b.status)) return sendJson(res, 400, { error: 'invalid status' });
        db.prepare('UPDATE orders SET status=? WHERE id=?').run(b.status, id);
        return sendJson(res, 200, { ok: true });
      }

      // 商品 CRUD
      if (pathname === '/admin/api/products' && method === 'GET') {
        return sendJson(res, 200, listProducts({ activeOnly: false }));
      }
      if (pathname === '/admin/api/products' && method === 'POST') {
        const b = await readJson(req);
        return sendJson(res, 200, upsertProduct(b, true));
      }
      if (pathname.startsWith('/admin/api/products/') && method === 'PUT') {
        const id = pathname.split('/').pop();
        const b = await readJson(req); b.id = id;
        return sendJson(res, 200, upsertProduct(b, false));
      }
      if (pathname.startsWith('/admin/api/products/') && method === 'DELETE') {
        const id = pathname.split('/').pop();
        db.prepare('DELETE FROM products WHERE id=?').run(id);
        return sendJson(res, 200, { ok: true });
      }

      // 画像アップロード（base64）
      if (pathname === '/admin/api/upload' && method === 'POST') {
        const b = await readJson(req);
        const safe = (b.filename || '').replace(/[^a-zA-Z0-9._-]/g, '');
        if (!safe || !b.data) return sendJson(res, 400, { error: 'filename/data 必須' });
        const b64 = String(b.data).replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(path.join(PUBLIC_DIR, safe), Buffer.from(b64, 'base64'));
        return sendJson(res, 200, { ok: true, filename: safe });
      }

      return sendJson(res, 404, { error: 'unknown admin endpoint' });
    }

    // 静的ファイル ------------------------------------------------------
    if (isBlocked(pathname)) return send(res, 403, 'Forbidden');
    let urlPath = pathname;
    if (urlPath === '/') urlPath = '/blancblanc.html';      // トップページ
    else if (urlPath.endsWith('/')) urlPath += 'index.html'; // ディレクトリ → index.html
    else if (!path.extname(urlPath)) {                        // 拡張子なし（/admin など）
      try { if (fs.statSync(path.join(PUBLIC_DIR, urlPath)).isDirectory()) urlPath += '/index.html'; } catch (_) {}
    }
    const filePath = path.join(PUBLIC_DIR, urlPath);
    if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
    fs.readFile(filePath, (err, data) => {
      if (err) { send(res, 404, 'Not Found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, data, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: 'server error', detail: e.message });
  }
});

// 商品の作成/更新
function upsertProduct(b, isNew) {
  const id = (b.id || '').trim();
  if (!id) return { error: 'id 必須' };
  const data = {
    id,
    name: b.name || '',
    cat: b.cat || null,
    tag: b.tag || null,
    price: parseInt(b.price, 10) || 0,
    badge: b.badge || null,
    imgs: JSON.stringify(Array.isArray(b.imgs) ? b.imgs : (b.imgs ? String(b.imgs).split(',').map((s) => s.trim()).filter(Boolean) : [])),
    colors: JSON.stringify(Array.isArray(b.colors) ? b.colors : (b.colors ? String(b.colors).split(',').map((s) => s.trim()).filter(Boolean) : [])),
    variants: JSON.stringify(Array.isArray(b.variants) ? b.variants : []),
    pick: b.pick && b.pick.options ? JSON.stringify(b.pick) : null,
    color_img: b.colorImg && Object.keys(b.colorImg).length ? JSON.stringify(b.colorImg) : null,
    lead: b.lead || null,
    set_items: JSON.stringify(Array.isArray(b.set) ? b.set : (b.set ? String(b.set).split(',').map((s) => s.trim()).filter(Boolean) : [])),
    material: b.material || null,
    size: b.size || null,
    target: b.target || null,
    stock: b.stock != null ? parseInt(b.stock, 10) : 100,
    active: b.active === false || b.active === 0 ? 0 : 1,
    sort: b.sort != null ? parseInt(b.sort, 10) : 0,
  };
  const exists = db.prepare('SELECT id FROM products WHERE id=?').get(id);
  if (exists) {
    db.prepare(`UPDATE products SET name=@name,cat=@cat,tag=@tag,price=@price,badge=@badge,imgs=@imgs,colors=@colors,variants=@variants,pick=@pick,color_img=@color_img,
      lead=@lead,set_items=@set_items,material=@material,size=@size,target=@target,stock=@stock,active=@active,sort=@sort WHERE id=@id`).run(data);
  } else {
    db.prepare(`INSERT INTO products (id,name,cat,tag,price,badge,imgs,colors,variants,pick,color_img,lead,set_items,material,size,target,stock,active,sort)
      VALUES (@id,@name,@cat,@tag,@price,@badge,@imgs,@colors,@variants,@pick,@color_img,@lead,@set_items,@material,@size,@target,@stock,@active,@sort)`).run(data);
  }
  return { ok: true, id };
}

server.listen(config.port, () => {
  console.log(`blancblanc shop  →  http://localhost:${config.port}/`);
  console.log(`管理画面          →  http://localhost:${config.port}/admin/`);
  console.log(stripe ? 'Stripe: 有効' : 'Stripe: 未設定（決済はモック動作）');
});
