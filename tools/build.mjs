// 把 src/* 合成为单文件 index.html
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

function read(name) {
  return fs.readFileSync(path.join(SRC, name), 'utf8');
}

// art.js 在 Node 里跑一遍，拿到内联 SVG sprite
await import('file://' + path.join(SRC, 'art.js').replace(/\\/g, '/'));
const sprite = globalThis.OrchardArt.sprite();

const template = read('index.template.html');
const parts = {
  '{{CSS}}': read('style.css'),
  '{{SPRITE}}': sprite,
  '{{DATA}}': read('data.gen.js'),
  '{{ENGINE}}': read('engine.js'),
  '{{ART}}': read('art.js'),
  '{{AUDIO}}': read('audio.js'),
  '{{GAME}}': read('game.js'),
};

let html = template;
for (const [key, value] of Object.entries(parts)) {
  if (!html.includes(key)) throw new Error('模板缺少占位符 ' + key);
  html = html.replace(key, () => value);
}
if (/\{\{[A-Z]+\}\}/.test(html)) throw new Error('还有未替换的占位符');

const out = path.join(ROOT, 'index.html');
fs.writeFileSync(out, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
console.log(JSON.stringify({
  out,
  bytes: Buffer.byteLength(html, 'utf8'),
  kb: kb + ' KB',
  parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, (Buffer.byteLength(v, 'utf8') / 1024).toFixed(0) + ' KB'])),
}, null, 1));
