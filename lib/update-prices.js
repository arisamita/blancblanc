// おもちゃカテゴリの価格を表示順（左→右・上→下）で一括更新： node lib/update-prices.js
const { db } = require('./db');

// 表示順（goods.html と同じ：sort ASC, created_at ASC）の「おもちゃ」一覧
const toys = db.prepare("SELECT id,name,price FROM products WHERE cat='toy' ORDER BY sort ASC, created_at ASC").all();

// 1番から順の新価格
const prices = [2990,1990,1800,2990,1500,2990,3000,2490,3990,1990,1990,1990,1990,1500,990,3500,2500,2990,1290,1290,990,1690,1990,1990,1990,3990,1300,1990,1600];

if (toys.length !== prices.length) {
  console.error(`件数不一致: 商品 ${toys.length} / 価格 ${prices.length}`);
  process.exit(1);
}

const upd = db.prepare('UPDATE products SET price=? WHERE id=?');
toys.forEach((t, i) => {
  const before = t.price, after = prices[i];
  upd.run(after, t.id);
  console.log(`${String(i + 1).padStart(2)}. ${t.name}  ¥${before.toLocaleString('ja-JP')} → ¥${after.toLocaleString('ja-JP')}`);
});
console.log('更新完了:', toys.length, '件');
