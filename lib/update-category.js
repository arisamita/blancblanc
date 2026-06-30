// ドーナツ・アイスバケツを PLUSH に変更（名前・説明のノーズワーク表記も修正）
const { db } = require('./db');

const updates = [
  {
    id: 'donut',
    name: 'カラフルドーナツ トイ（3個）',
    tag: 'TOY / PLUSH',
    lead: 'チョコ・ストロベリー・抹茶の3色ドーナツのやわらかトイ。くわえて運んだり、ふみふみしたり。カフェごっこ遊びにもぴったりです。',
  },
  {
    id: 'icebucket',
    name: 'アイスクリームバケツ トイ',
    tag: 'TOY / PLUSH',
    lead: '「ICE CREAM」バケツの中に、にこにこ顔のアイスボールがいっぱい。出し入れしたり、ころころ転がしたり、くわえて運んで遊べるやわらかトイです。',
  },
];

updates.forEach((u) => {
  const r = db.prepare('UPDATE products SET name=@name, tag=@tag, lead=@lead WHERE id=@id').run(u);
  console.log(`${u.id}: ${r.changes ? 'OK → ' + u.tag : '見つかりません'}`);
});
