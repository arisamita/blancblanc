// 設定。実際のキーは config.local.json（gitに入れない）または環境変数で上書きします。
const fs = require('fs');
const path = require('path');

let local = {};
try {
  local = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.local.json'), 'utf8'));
} catch (_) { /* なければ既定値を使う */ }

module.exports = {
  port: process.env.PORT || local.port || 8080,

  // Stripe（テスト/本番ともここに設定）。未設定でもサイトは動き、決済時のみ案内します。
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || local.stripeSecretKey || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || local.stripePublishableKey || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || local.stripeWebhookSecret || '',

  // 管理画面ログイン
  adminUser: process.env.ADMIN_USER || local.adminUser || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || local.adminPassword || 'blancblanc',

  // メール通知（Resend）。未設定でもサイトは動き、メール送信だけスキップされます。
  resendApiKey: process.env.RESEND_API_KEY || local.resendApiKey || '',
  mailFrom: process.env.MAIL_FROM || local.mailFrom || 'blancblanc <onboarding@resend.dev>',
  ownerEmail: process.env.OWNER_EMAIL || local.ownerEmail || 'info@blancblanc.jp',

  // 送料設定（フロントと合わせる）
  freeShippingThreshold: 10000, // 円
  shippingFee: 600,             // 円

  // 決済完了後の戻り先（サーバーURL）
  baseUrl: process.env.BASE_URL || local.baseUrl || 'http://localhost:8080',
};
