// 新商品（キャリーバッグ2点）をDBに追加： node lib/add-products2.js
const { db } = require('./db');

const items = [
  {
    id: 'ginghambag', name: 'ギンガムチェック ペットキャリートート', cat: 'carry', tag: 'GOODS / CARRY',
    price: 9900, badge: 'NEW', imgs: ['ginghambag.png', 'ginghambag-sub.png'],
    lead: 'モノトーンのギンガムチェックがおしゃれな、キルティングのペットキャリートート。中はクッション入りでふかふか、両サイドにポケット、お揃いのうんち袋ポーチ付き。お散歩からお出かけまで毎日活躍します。',
    set_items: JSON.stringify(['キャリートート本体', 'お揃いポーチ']),
    material: 'ポリエステル（キルティング）', size: '約 幅40×高さ27×奥行20cm', target: '体重〜5kgの小型犬', stock: 50, active: 1,
  },
  {
    id: 'meshbag', name: 'メッシュ ペットキャリーバッグ／ピンク', cat: 'carry', tag: 'GOODS / CARRY',
    price: 8800, badge: 'NEW', imgs: ['meshbag.png', 'meshbag-sub.png'],
    lead: 'やさしいピンク×生成りの、通気性ばつぐんメッシュキャリーバッグ。中が見えて愛犬も安心、フロントポケット・取り外せるショルダー付き。お散歩・通院・電車でのおでかけにぴったりです。',
    set_items: JSON.stringify(['キャリーバッグ本体', 'ショルダーストラップ']),
    material: 'ポリエステル／メッシュ', size: '約 幅34×高さ26×奥行22cm', target: '体重〜5kgの小型犬', stock: 50, active: 1,
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
