// Перерисовывает пиксельные значки в index.html по tools/sprites.json (копия icons/sprites.json из kit.txt).
//   node tools/build.js           переписать значки в index.html
//   node tools/build.js --check   ничего не писать; код выхода 1, если index.html устарел
//
// В index.html значок стоит между метками, всё между ними заменяется:
//   <!--sprite:aura-->…<!--/sprite-->           обычный значок: соседние пиксели слиты в полоски
//   <!--sprite:core pixels-->…<!--/sprite-->    каждый пиксель отдельно и со своим номером --i:
//                                               так значок в шапке собирается из пикселей при открытии
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = path.join(root, 'index.html');
const { colors, sprites } = JSON.parse(fs.readFileSync(path.join(__dirname, 'sprites.json'), 'utf8'));

function rowsOf(name) {
  const rows = sprites[name];
  if (!rows) throw new Error('В sprites.json нет значка «' + name + '». Есть: ' + Object.keys(sprites).join(', '));
  for (const row of rows) if (row.length !== rows[0].length) throw new Error('Строки разной длины в значке «' + name + '»');
  return rows;
}

// Значок вписывается в квадрат и встаёт по его середине — как на странице-образце kit.txt
function open(rows) {
  const cols = rows[0].length, size = Math.max(cols, rows.length);
  const box = [-(size - cols) / 2, -(size - rows.length) / 2, size, size].join(' ');
  return '<svg viewBox="' + box + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">';
}

function merged(name) {
  const rows = rowsOf(name);
  let out = open(rows);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let end = x;
      while (end < row.length && row[end] === row[x]) end++;
      if (row[x] !== '.') out += '<rect x="' + x + '" y="' + y + '" width="' + (end - x) + '" height="1" fill="' + colors[row[x]] + '"/>';
      x = end;
    }
  });
  return out + '</svg>';
}

// Номер пикселя задаёт его очередь в анимации: значок складывается снизу вверх, с лёгким разбросом в строке
function pixels(name) {
  const rows = rowsOf(name);
  let out = open(rows);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      const i = (rows.length - 1 - y) * 2 + ((x * 7 + y * 3) % 4);
      out += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + colors[row[x]] + '" style="--i:' + i + '"/>';
    }
  });
  return out + '</svg>';
}

const before = fs.readFileSync(page, 'utf8');
let count = 0;
const after = before.replace(/<!--sprite:([a-z0-9-]+)( pixels)?-->[\s\S]*?<!--\/sprite-->/g, (all, name, mode) => {
  count++;
  return '<!--sprite:' + name + (mode || '') + '-->' + (mode ? pixels(name) : merged(name)) + '<!--/sprite-->';
});
if (!count) throw new Error('В index.html не найдено ни одной метки <!--sprite:…-->');

if (process.argv.includes('--check')) {
  console.log(after === before ? 'index.html совпадает со sprites.json (' + count + ' значков)' : 'index.html устарел: запустите node tools/build.js');
  process.exit(after === before ? 0 : 1);
}
if (after !== before) fs.writeFileSync(page, after);
console.log((after === before ? 'Без изменений' : 'Записано') + ': значков — ' + count);
