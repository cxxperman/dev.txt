# Сайт dev.txt™

Одна статическая страница: что такое dev.txt™, какие есть приложения и как они связаны. Сборки нет — папку можно отдавать любым хостингом статических файлов как есть.

## Что где

| Файл | Что это |
|---|---|
| `index.html` | вся страница |
| `site.css` | только раскладка страницы; своих цветов, радиусов и длительностей в нём нет |
| `assets/tokens.css`, `assets/kit.css` | токены и общие элементы из kit.txt — **копии, руками не правятся** |
| `assets/core.png`, `assets/core.ico` | значок сайта — значок core.txt из kit.txt, тоже копия |
| `assets/kapsula.png` | значок Kapsula: кадр 256 px из `assets/kapsula.ico` её репозитория (в `sprites.json` этого значка пока нет) |
| `assets/core-apps.png`, `assets/core-settings.png` | снимки окна core.txt из его `docs/` |
| `tools/sprites.json` | копия `icons/sprites.json` из kit.txt — тоже не правится руками |
| `tools/sync.js` | заново копирует всё перечисленное из kit.txt |
| `tools/build.js` | перерисовывает пиксельные значки в `index.html` по `tools/sprites.json` |

## Обновить общий вид

Вид меняется в kit.txt, а не здесь:

```bash
node tools/sync.js путь/к/kit.txt
node tools/build.js
```

`node tools/build.js --check` ничего не пишет и завершается с кодом 1, если значки в `index.html` отстали от `tools/sprites.json`.

## Значки в странице

Значок в `index.html` стоит между метками, всё между ними пишет `tools/build.js`:

```html
<!--sprite:aura-->…<!--/sprite-->
<!--sprite:core pixels-->…<!--/sprite-->
```

Второй вид — каждый пиксель отдельно: так значок в шапке собирается из пикселей при открытии страницы. У dock.txt значка пока нет — в плитке стоит буква, как в core.txt у приложений без значка.

## Посмотреть у себя

```bash
node -e "const h=require('http'),f=require('fs'),p=require('path');const t={'.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.ico':'image/x-icon'};h.createServer((q,s)=>{const n=p.join('.',decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));f.readFile(n,(e,b)=>{s.writeHead(e?404:200,{'Content-Type':t[p.extname(n)]||'application/octet-stream'});s.end(e?'':b)})}).listen(48951,'127.0.0.1')"
```

и открыть `http://127.0.0.1:48951/`. Страница открывается и просто файлом, без сервера.

## Правила

- Никаких внешних запросов: ни шрифтов, ни CDN, ни счётчиков. Всё лежит в этой папке.
- Тёмная тема; при системной настройке «Меньше движения» анимации появления нет.
- В тексте только то, что есть в README приложений: без выдуманных возможностей, цифр и отзывов.
- Перед публикацией: в `og:image` нужен полный адрес картинки (сейчас относительный — адрес сайта ещё не известен), и стоит добавить `og:url` и `<link rel="canonical">`.
