// 新商品（陶器フードボウル 全7色）をDBに追加： node lib/add-products5.js
const { db } = require('./db');

const items = [
  {
    id: 'foodbowl', name: 'カラー陶器 フードボウル（全7色）', cat: 'interior', tag: 'GOODS / TABLEWARE',
    price: 2420, badge: 'NEW', imgs: ['foodbowl.png', 'foodbowl-dog.png'],
    colors: JSON.stringify(['レッド', 'ミント', 'スカイブルー', 'グリーン', 'ブラック', 'アイボリー', 'イエロー']),
    lead: 'コロンと丸いフォルムがかわいい、つやつや陶器のフードボウル。重さがあって安定し、食べこぼれしにくい設計。電子レンジ・食洗機にも対応で毎日のお食事を清潔に。お部屋に合わせて選べる全7色です。',
    set_items: JSON.stringify(['フードボウル（お好きな1色）']),
    material: '陶器', size: '約 直径16×高さ7cm（容量約600ml）', target: '超小型犬〜中型犬', stock: 100, active: 1,
  },
];

const cols = ['id','name','cat','tag','price','badge','imgs','colors','lead','set_items','material','size','target','stock','active','sort'];
const maxSort = db.prepare('SELECT COALESCE(MAX(sort),0) AS m FROM products').get().m;

items.forEach((p, i) => {
  const exists = db.prepare('SELECT id FROM products WHERE id=?').get(p.id);
  const data = { colors: '[]', sort: maxSort + 1 + i, ...p, imgs: JSON.stringify(p.imgs) };
  if (exists) {
    db.prepare(`UPDATE products SET name=@name,cat=@cat,tag=@tag,price=@price,badge=@badge,imgs=@imgs,colors=@colors,
      lead=@lead,set_items=@set_items,material=@material,size=@size,target=@target,stock=@stock,active=@active,sort=@sort WHERE id=@id`).run(data);
    console.log('更新:', p.id);
  } else {
    db.prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map((c)=>'@'+c).join(',')})`).run(data);
    console.log('追加:', p.id);
  }
});

console.log('現在の商品数:', db.prepare('SELECT COUNT(*) AS n FROM products').get().n);
