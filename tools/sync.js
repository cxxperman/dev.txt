// Заново копирует общие файлы из kit.txt. Руками эти копии не правятся — меняется kit.txt, потом запускается эта команда.
//   node tools/sync.js путь/к/kit.txt
'use strict';
const fs = require('fs');
const path = require('path');

const kit = process.argv[2];
if (!kit || !fs.existsSync(path.join(kit, 'tokens', 'tokens.json'))) {
  console.error('Укажите папку kit.txt: node tools/sync.js путь/к/kit.txt');
  process.exit(1);
}
const root = path.join(__dirname, '..');
const files = [
  ['dist/tokens.css', 'assets/tokens.css'],
  ['ui/kit.css', 'assets/kit.css'],
  ['dist/icons/core.png', 'assets/core.png'],
  ['dist/icons/core.ico', 'assets/core.ico'],
  ['icons/sprites.json', 'tools/sprites.json'],
];
for (const [from, to] of files) {
  fs.copyFileSync(path.join(kit, from), path.join(root, to));
  console.log(from + ' → ' + to);
}
console.log('Готово. Теперь перерисуйте значки: node tools/build.js');
