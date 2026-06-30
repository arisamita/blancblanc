// products.js（window.PRODUCTS / window.CATS を定義）を Node から読み込むためのローダー。
// storefront 用の静的ファイルをそのまま流用し、初期データ投入に使う。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const file = path.join(__dirname, '..', 'products.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'products.js' });
  return {
    products: sandbox.window.PRODUCTS || [],
    cats: sandbox.window.CATS || [],
  };
}

module.exports = { load };
