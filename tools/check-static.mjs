// 静态检查：脚本语法、id ↔ 引用双向核对、CSS 括号配平
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8');

const problems = [];
const info = {};

// 1) 语法检查：每个 <script> 块
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
info.scriptBlocks = scripts.length;
scripts.forEach((src, i) => {
  try {
    new vm.Script(src, { filename: 'inline-' + i + '.js' });
  } catch (e) {
    problems.push('内联脚本 ' + i + ' 语法错误: ' + e.message);
  }
});

// 2) CSS 括号配平 + 变量引用检查
let depth = 0;
for (const ch of css) {
  if (ch === '{') depth++;
  else if (ch === '}') depth--;
  if (depth < 0) { problems.push('CSS 出现多余的 }'); break; }
}
if (depth !== 0) problems.push('CSS 括号不配平: ' + depth);
const declaredVars = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
[...css.matchAll(/var\((--[a-z0-9-]+)/g)].forEach((m) => {
  if (!declaredVars.has(m[1]) && !['--sky', '--sun', '--leaf-1', '--leaf-2'].includes(m[1])) {
    problems.push('CSS 用了未声明的变量 ' + m[1]);
  }
});

// 3) id 双向核对
const declaredIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const dynamicIds = new Set(['vinePaths', 'vineFruits', 'bookSearch', 'bookList', 'again', 'switchTimed', 'openBook',
  'resultShare', 'copyLink', 'selftest-report', 'metrics']);
const referenced = new Set();
[...game.matchAll(/\$\('([^']+)'\)/g)].forEach((m) => referenced.add(m[1]));
const cacheList = game.match(/\[\s*'app',[\s\S]*?\]\.forEach/);
if (!cacheList) problems.push('找不到 cacheUi 的 id 清单');
else [...cacheList[0].matchAll(/'([A-Za-z][A-Za-z0-9]+)'/g)].forEach((m) => referenced.add(m[1]));

referenced.forEach((id) => {
  if (!declaredIds.has(id) && !dynamicIds.has(id)) problems.push('引用了不存在的 id: #' + id);
});
info.ids = declaredIds.size;
info.referencedIds = referenced.size;
const unusedIds = [...declaredIds].filter((id) => !referenced.has(id) && !/^(art|selftest|probe)/.test(id));
info.unusedIds = unusedIds;

// 4) 模板占位符 & 单文件体积
info.kb = +(Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
// icon.png 是唯一允许的外部引用（部署目录里跟 index.html 同级的应用图标）
const external = [...html.matchAll(/<(script|link|img)[^>]+(?:src|href)="([^"]+)"/g)]
  .map((m) => m[2])
  .filter((u) => !/^(data:|#)/.test(u) && u !== './icon.png');
info.externalRefs = external;
info.hasExternalRefs = external.length > 0;
if (info.hasExternalRefs) problems.push('单文件里出现了外部资源引用');

console.log(JSON.stringify({ ok: problems.length === 0, problems, info }, null, 1));
process.exit(problems.length ? 1 : 0);
