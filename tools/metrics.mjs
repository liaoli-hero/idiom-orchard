// 布局诊断：node tools/metrics.mjs [宽] [高] [查询串]
import { startServer, runEdge } from './harness.mjs';

const w = process.argv[2] || '390';
const h = process.argv[3] || '844';
const query = process.argv[4] || 'metrics=1&demo=3';

const server = await startServer(8768);
try {
  const r = await runEdge([
    '--window-size=' + w + ',' + h,
    '--virtual-time-budget=4000',
    '--dump-dom',
    'http://127.0.0.1:8768/index.html?' + query,
  ], { timeout: 90000 });
  const m = r.out.match(/<pre id="metrics"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) {
    console.log('没有拿到诊断数据', r.out.slice(-600));
    process.exit(1);
  }
  const txt = m[1]
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  console.log(JSON.stringify(JSON.parse(txt), null, 1));
} finally {
  await server.close();
}
