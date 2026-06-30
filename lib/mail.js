// blancblanc shop ─ メール送信（Resend）。APIキー未設定ならログ出力のみで安全にスキップ。
const config = require('../config');

async function sendMail({ to, subject, html }) {
  if (!config.resendApiKey) {
    console.log(`[mail] RESEND_API_KEY未設定のため送信スキップ: to=${to} subject=${subject}`);
    return { skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.mailFrom, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[mail] 送信失敗 (${res.status}): ${body}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error('[mail] 送信エラー:', e.message);
    return { ok: false };
  }
}

const yen = (n) => '¥' + Number(n).toLocaleString('ja-JP');

function orderEmailHtml(order, { forOwner = false } = {}) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${i.name}${i.color ? '（' + i.color + '）' : ''}<br><span style="color:#8c857b;font-size:12px">×${i.qty}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${yen(i.price * i.qty)}</td></tr>`
    )
    .join('');
  const customerBlock = forOwner
    ? `<p style="font-size:13px;color:#2c2824;line-height:1.9">
        <b>お名前：</b>${escapeHtml(order.customer_name || '-')}<br>
        <b>メール：</b>${escapeHtml(order.email || '-')}<br>
        <b>電話：</b>${escapeHtml(order.phone || '-')}<br>
        <b>郵便番号：</b>${escapeHtml(order.postal || '-')}<br>
        <b>ご住所：</b>${escapeHtml(order.address || '-')}<br>
        ${order.note ? `<b>備考：</b>${escapeHtml(order.note)}<br>` : ''}
      </p><hr style="border:none;border-top:1px solid #e6dfd4;margin:16px 0">`
    : '';
  return `
  <div style="font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#2c2824;max-width:480px;margin:0 auto">
    <h2 style="font-weight:400;letter-spacing:.05em">${forOwner ? '新しいご注文が入りました' : 'ご注文ありがとうございます'}</h2>
    <p style="font-size:13px;color:#8c857b">注文番号：<b style="color:#b9928a">${order.id}</b></p>
    ${customerBlock}
    <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
    <table style="width:100%;font-size:13px;margin-top:10px">
      <tr><td>小計</td><td style="text-align:right">${yen(order.subtotal)}</td></tr>
      <tr><td>送料</td><td style="text-align:right">${order.shipping ? yen(order.shipping) : '無料'}</td></tr>
      <tr><td style="font-weight:600;padding-top:8px;border-top:1px solid #e6dfd4">合計</td><td style="text-align:right;font-weight:600;padding-top:8px;border-top:1px solid #e6dfd4">${yen(order.total)}</td></tr>
    </table>
    <p style="font-size:12px;color:#8c857b;margin-top:24px">blancblanc ｜ 犬服・ペット雑貨のオンラインストア</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 注文確定後に呼ぶ：お客様への確認メール＋お店への通知メールを送信
async function sendOrderEmails(order) {
  const tasks = [];
  if (order.email) {
    tasks.push(
      sendMail({
        to: order.email,
        subject: `【blancblanc】ご注文ありがとうございます（注文番号：${order.id}）`,
        html: orderEmailHtml(order, { forOwner: false }),
      })
    );
  }
  if (config.ownerEmail) {
    tasks.push(
      sendMail({
        to: config.ownerEmail,
        subject: `【blancblanc】新規注文が入りました（注文番号：${order.id}）`,
        html: orderEmailHtml(order, { forOwner: true }),
      })
    );
  }
  await Promise.allSettled(tasks);
}

module.exports = { sendMail, sendOrderEmails };
