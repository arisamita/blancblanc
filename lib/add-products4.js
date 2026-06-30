// 新商品（くまロープリング・食パントイ）をDBに追加： node lib/add-products4.js
const { db } = require('./db');

const items = [
  {
    id: 'bearrope', name: 'くまさん ロープリングトイ', cat: 'toy', tag: 'TOY / ROPE',
    price: 1980, badge: 'NEW', imgs: ['bearrope.png', 'bearrope-dog.png'],
    lead: 'にっこり笑顔のくまさんが、コットンロープのリングを抱えたキュートなトイ。引っ張りっこや噛みごこちが楽しく、ロープがデンタルケアにも。ふわふわのお顔と手足で抱き心地もばつぐんです。',
    set_items: JSON.stringify(['くまさん ロープリング']),
    material: 'ポリエステル（ボア）／コットンロープ', size: '約 高さ20×幅16cm', target: '超小型犬〜中型犬', stock: 100, active: 1,
  },
  {
    id: 'breadplush', name: 'にっこり食パン もちもちトイ', cat: 'toy', tag: 'TOY / PLUSH',
    price: 2200, badge: 'NEW', imgs: ['breadplush.png', 'breadplush-dog.png'],
    lead: 'こんがり耳とにっこり笑顔がかわいい、もちもち食パンのぬいぐるみトイ。やさしいタオル地のような肌ざわりで、くわえて運んだり、抱っこしたり、ふみふみ遊びにぴったりです。',
    set_items: JSON.stringify(['食パン ぬいぐるみ']),
    material: 'ポリエステル（パイル・ボア）', size: '約 16×15cm', target: '超小型犬〜中型犬', stock: 100, active: 1,
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
