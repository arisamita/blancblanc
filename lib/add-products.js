// 新商品をDBに追加する一回限りのスクリプト： node lib/add-products.js
const { db } = require('./db');

const items = [
  {
    id: 'tulipmat', name: 'チューリップ なめ皿 スローフィーダーマット', cat: 'toy', tag: 'TOY / LICK MAT',
    price: 2640, badge: 'NEW', imgs: ['tulipmat.png', 'tulipmat-dog.png'],
    lead: 'チューリップとリーフの形がかわいい、シリコン製のなめ皿マット。表面のさまざまな凹凸にペーストやおやつを塗り広げれば、舐めて夢中になる早食い防止＆リラックストイに。お風呂や壁にも貼れます。',
    set_items: JSON.stringify(['チューリップ（花）マット', 'リーフ（葉）マット']),
    material: 'シリコン', size: '約 花18×16cm／葉18×11cm', target: '超小型犬〜中型犬', stock: 100, active: 1,
  },
  {
    id: 'flowerset', name: 'お花の花束 ノーズワーク 6点セット', cat: 'toy', tag: 'TOY / NOSE WORK',
    price: 4180, badge: 'NEW', imgs: ['flowerset.png', 'flowerset-dog.png'],
    lead: 'お花とラッピングを組み合わせて遊ぶ、花束のノーズワークトイ。鉢や包みの中におやつを隠して、嗅いで・探して・引き抜く知育遊びが楽しめます。並べて飾ってもとびきりキュート。',
    set_items: JSON.stringify(['ピンクのお花', 'ひまわり', 'チューリップ', 'ブルーのラッピング', 'イエローの鉢', 'ピンクの鉢']),
    material: 'ポリエステル（ボア・フェルト）', size: '各 約12〜22cm', target: '超小型犬〜中型犬', stock: 100, active: 1,
  },
];

const cols = ['id','name','cat','tag','price','badge','imgs','colors','lead','set_items','material','size','target','stock','active','sort'];
const maxSort = db.prepare('SELECT COALESCE(MAX(sort),0) AS m FROM products').get().m;

items.forEach((p, i) => {
  const exists = db.prepare('SELECT id FROM products WHERE id=?').get(p.id);
  const data = {
    colors: '[]', badge: null, sort: maxSort + 1 + i, ...p,
    imgs: JSON.stringify(p.imgs),
  };
  if (exists) {
    db.prepare(`UPDATE products SET name=@name,cat=@cat,tag=@tag,price=@price,badge=@badge,imgs=@imgs,colors=@colors,
      lead=@lead,set_items=@set_items,material=@material,size=@size,target=@target,stock=@stock,active=@active,sort=@sort WHERE id=@id`).run(data);
    console.log('更新:', p.id);
  } else {
    db.prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map((c)=>'@'+c).join(',')})`).run(data);
    console.log('追加:', p.id);
  }
});

const total = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
console.log('現在の商品数:', total);
