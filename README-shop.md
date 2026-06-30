# blancblanc オンラインショップ（運用ガイド）

静的HTMLのストアフロントに、注文・決済・管理画面の「裏側」を追加した構成です。

## 起動方法

```bash
npm install        # 初回のみ（Stripeライブラリを入れる）
npm start          # http://localhost:8080 で起動
```

- ストアフロント： http://localhost:8080/blancblanc.html
- カート： http://localhost:8080/cart.html
- 管理画面： http://localhost:8080/admin/

データは `data/shop.db`（SQLite）に保存されます。初回起動時に `products.js` の商品が自動で取り込まれます。

## 管理画面ログイン

- 初期ID： `admin`
- 初期パスワード： `blancblanc`
- **本番では必ず変更してください**（下記 config.local.json）。

機能：
- **注文管理**：注文一覧 / 詳細 / ステータス変更（未処理・入金済み・発送済み・キャンセル）／売上集計
- **商品管理**：追加・編集・削除・画像アップロード・表示/非表示・在庫
  - ここで編集した内容は、ストアフロント（`/products.js` を自動生成）に即反映されます。

## 設定（config.local.json）

`config.local.example.json` をコピーして `config.local.json` を作り、値を入れてください（このファイルは公開しないこと）。

```json
{
  "stripeSecretKey": "sk_test_...",
  "stripePublishableKey": "pk_test_...",
  "stripeWebhookSecret": "whsec_...",
  "adminUser": "admin",
  "adminPassword": "強いパスワードに変更",
  "baseUrl": "http://localhost:8080"
}
```

## 実際のカード決済（Stripe）を有効にする手順

1. Stripe（https://stripe.com ）でアカウント作成。
2. ダッシュボードの「APIキー」から、**公開可能キー（pk_…）** と **シークレットキー（sk_…）** を取得。
   - まずは **テストモード** のキー（`pk_test_` / `sk_test_`）で動作確認するのがおすすめ。
3. `config.local.json` に貼り付けて `npm start` を再起動。
   - キーがある状態でレジに進むと、Stripeの決済ページに移動します。
   - テスト用カード番号： `4242 4242 4242 4242` ／ 有効期限：未来の日付 ／ CVC：任意3桁。
4. **入金確定（Webhook）の設定**：
   - 開発中は Stripe CLI： `stripe listen --forward-to localhost:8080/api/stripe/webhook`
   - 本番では Stripeダッシュボードで Webhook エンドポイント `https://（あなたのドメイン）/api/stripe/webhook` を登録し、`checkout.session.completed` を購読。表示される `whsec_…` を `stripeWebhookSecret` に設定。
   - これで支払い完了時に注文が自動で「入金済み」になります。

> キー未設定のときは「テストモード（決済なし）」で動き、注文はそのまま完了ページに進みます（金額・注文記録は保存されます）。

## 本番公開（ざっくり）

- 常時起動できるサーバー（VPS / Render / Railway / Fly.io など Node が動く環境）に配置。
- `baseUrl` を本番URLに変更、`adminPassword` を強固に、Stripeは本番キー（`sk_live_` / `pk_live_`）へ。
- 独自ドメイン＋HTTPS（決済には必須）。
- `data/shop.db` は永続ディスクに置く（消えないように）。

## ファイル構成（裏側）

| ファイル | 役割 |
|---|---|
| `server.js` | アプリサーバー（静的配信＋API＋Stripe＋管理API） |
| `lib/db.js` | SQLite（商品・注文・注文明細）＋初期投入 |
| `lib/loadProducts.js` | `products.js` を読み込むローダー |
| `config.js` / `config.local.json` | 設定・キー |
| `cart.js` | カート（localStorage） |
| `cart.html` / `success.html` | カート・注文完了ページ |
| `admin/index.html` | 管理画面（注文・商品） |
| `data/shop.db` | データ本体（自動生成） |
