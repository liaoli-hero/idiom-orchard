// 从 cnchar 数据包中抽取成语表 + 拼音表，生成游戏内嵌数据。
// 用法: node tools/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const VENDOR = path.join(ROOT, 'tools', 'vendor');
const CNCHAR = path.join(VENDOR, 'cnchar-3.2.6', 'package', 'cnchar.min.js');
const IDIOM_PKG = path.join(VENDOR, 'cnchar-idiom-3.2.6', 'package', 'cnchar.idiom.min.js');
const POLY_PKG = path.join(VENDOR, 'cnchar-poly-3.2.6', 'package', 'cnchar.poly.min.js');

const cnchar = require(CNCHAR);
cnchar.use(require(POLY_PKG));

/** 找出文件里那段巨大的成语 JSON 数组并解析 */
function extractIdioms(source) {
  const marker = source.indexOf('["');
  if (marker < 0) throw new Error('找不到成语数组');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = marker; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        const json = source.slice(marker, i + 1);
        return JSON.parse(json);
      }
    }
  }
  throw new Error('成语数组括号不闭合');
}

const CJK = /^[\u4e00-\u9fa5]+$/;

function pinyinsOf(char) {
  let raw;
  try {
    raw = cnchar.spell(char, 'low', 'poly');
  } catch {
    return [];
  }
  if (typeof raw !== 'string') return [];
  const inner = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw;
  const list = inner
    .split('|')
    .map((s) => s.trim())
    .filter((s) => /^[a-z]+$/.test(s));
  return [...new Set(list)];
}

// 水果相关字（用于「水果专场」玩法）
const FRUITS = [
  ['桃', '桃子', 0], ['李', '李子', 1], ['梅', '青梅', 2], ['杏', '杏子', 3],
  ['梨', '雪梨', 4], ['枣', '红枣', 5], ['瓜', '西瓜', 6], ['橘', '橘子', 7],
  ['橙', '甜橙', 8], ['柚', '柚子', 9], ['荔', '荔枝', 10], ['柿', '柿子', 11],
  ['蕉', '香蕉', 12], ['莓', '草莓', 13], ['樱', '樱桃', 14], ['葡', '葡萄', 15],
  ['苹', '苹果', 16], ['榴', '石榴', 17], ['枇', '枇杷', 18], ['柠', '柠檬', 19],
];

function main() {
  const source = fs.readFileSync(IDIOM_PKG, 'utf8');
  const raw = extractIdioms(source);
  const seen = new Set();
  const idioms = [];
  let droppedNonCjk = 0;
  let droppedLen = 0;
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const word = item.trim();
    if (!CJK.test(word)) {
      droppedNonCjk++;
      continue;
    }
    if (word.length < 3 || word.length > 8) {
      droppedLen++;
      continue;
    }
    if (seen.has(word)) continue;
    seen.add(word);
    idioms.push(word);
  }
  idioms.sort();

  // 单字拼音表（只收成语里出现过的字）
  const chars = new Set();
  for (const word of idioms) for (const ch of word) chars.add(ch);
  const pyEntries = [];
  const missing = [];
  for (const ch of [...chars].sort()) {
    const list = pinyinsOf(ch);
    if (!list.length) missing.push(ch);
    else pyEntries.push([ch, list]);
  }

  const startExact = new Map();
  const startPy = new Map();
  const pyOfChar = new Map(pyEntries);
  for (const word of idioms) {
    const first = word[0];
    if (!startExact.has(first)) startExact.set(first, []);
    startExact.get(first).push(word);
    for (const p of pyOfChar.get(first) || []) {
      if (!startPy.has(p)) startPy.set(p, []);
      startPy.get(p).push(word);
    }
  }

  const tailExact = new Map();
  const tailPy = new Map();
  for (const word of idioms) {
    const last = word[word.length - 1];
    tailExact.set(last, (tailExact.get(last) || 0) + 1);
    for (const p of pyOfChar.get(last) || []) tailPy.set(p, (tailPy.get(p) || 0) + 1);
  }

  let deadExact = 0;
  let deadHomo = 0;
  for (const tail of tailExact.keys()) {
    const exact = startExact.get(tail);
    if (!exact || !exact.length) deadExact++;
    const pys = pyOfChar.get(tail) || [];
    const homo = pys.some((p) => (startPy.get(p) || []).length > 0);
    if (!homo) deadHomo++;
  }

  const reach = [...tailExact.keys()];
  const totalStarts = reach.reduce((n, t) => n + (startExact.get(t) || []).length, 0);

  const fruitReport = FRUITS.map(([ch, name, idx]) => {
    const all = idioms.filter((w) => w.includes(ch));
    const head = startExact.get(ch) || [];
    return { ch, name, idx, total: all.length, head: head.length };
  });

  const outDir = path.join(ROOT, 'src');
  fs.mkdirSync(outDir, { recursive: true });
  const idiomStr = idioms.join('|');
  const pyStr = pyEntries.map(([ch, list]) => ch + list.join(',')).join('|');
  const header =
    '// 自动生成，请勿手改：由 tools/build-data.mjs 从 cnchar 数据包生成\n' +
    '// 数据来源: cnchar (Apache-2.0) / cnchar-idiom / cnchar-poly\n';
  const gen =
    header +
    '(function (root) {\n' +
    '  var DATA = {\n' +
    '    idioms: ' + JSON.stringify(idiomStr) + ',\n' +
    '    pinyin: ' + JSON.stringify(pyStr) + ',\n' +
    '    fruits: ' + JSON.stringify(FRUITS.map(([ch, name, idx]) => ({ ch, name, idx }))) + ',\n' +
    '    meta: ' + JSON.stringify({ count: idioms.length, chars: pyEntries.length, source: 'cnchar-idiom' }) + '\n' +
    '  };\n' +
    '  root.IDIOM_DATA = DATA;\n' +
    "})(typeof globalThis !== 'undefined' ? globalThis : this);\n";
  fs.writeFileSync(path.join(outDir, 'data.gen.js'), gen, 'utf8');

  const stats = {
    rawCount: raw.length,
    kept: idioms.length,
    droppedNonCjk,
    droppedLen,
    uniqueChars: chars.size,
    charsWithPinyin: pyEntries.length,
    missingPinyin: missing.length,
    missingSample: missing.slice(0, 20).join(''),
    lengthDist: [...idioms.reduce((m, w) => m.set(w.length, (m.get(w.length) || 0) + 1), new Map())].sort(),
    tails: tailExact.size,
    deadExact,
    deadHomophone: deadHomo,
    avgOutDegreeExact: +(totalStarts / reach.length).toFixed(2),
    headChars: startExact.size,
    pinyinHeads: startPy.size,
    topHeads: [...startExact.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8)
      .map(([c, l]) => c + ':' + l.length),
    tailOfChain: [...tailExact.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => c + ':' + n),
    fruits: fruitReport,
    genBytes: Buffer.byteLength(gen, 'utf8'),
    idiomStrBytes: Buffer.byteLength(idiomStr, 'utf8'),
    pyStrBytes: Buffer.byteLength(pyStr, 'utf8'),
  };
  console.log(JSON.stringify(stats, null, 1));
}

main();
