// 用 file:// 打开跑一遍自测，确认"双击即玩"时存档是否可用
import path from 'node:path';
import { runEdge, ROOT } from './harness.mjs';

const fileUrl = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?selftest=1';
const r = await runEdge(['--virtual-time-budget=12000', '--dump-dom', fileUrl], { timeout: 90000 });
const m = r.out.match(/<pre id="selftest-report"[^>]*>([\s\S]*?)<\/pre>/);
if (!m) {
  console.log('没有产出报告', r.out.slice(-500));
  process.exit(1);
}
const txt = m[1]
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const rep = JSON.parse(txt);
console.log(JSON.stringify({
  url: fileUrl,
  passed: rep.passed,
  total: rep.total,
  failed: rep.checks.filter((c) => !c.ok),
  errors: rep.errors,
}, null, 1));
