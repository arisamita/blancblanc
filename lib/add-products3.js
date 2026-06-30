// 新商品（バラ型スナッフルマット）をDBに追加： node lib/add-products3.js
const { db } = require('./db');

const items = [
  {
    id: 'rosemat', name: 'ローズ スナッフルマット（全3色）', cat: 'toy', tag: 'TOY / NOSE WORK',
    price: 3300, badge: 'NEW', imgs: ['rosemat.png', 'rosemat-dog.png'],
    colors: JSON.stringify(['レッド', 'ブルー', 'アイボリー']),
    lead: '本物のバラのように花びらが幾重にも重なった、まるくてかわいいスナッフルマット。花びらの間にフードやおやつを隠せば、鼻を使って夢中で探すノーズワークタイムに。早食い防止や留守番中の知育にもおすすめです。',
    set_items: JSON.stringify(['ローズ スナッフルマット（お好きな1色）']),
    material: 'ポリエステル（フリース・フェルト）', size: '約 直径28cm', target: '超小型犬〜中型犬', stock: 100, active: 1,
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
