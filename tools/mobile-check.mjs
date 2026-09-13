// 用 iframe 精确模拟多种手机宽度，检查是否横向溢出、果篮/木牌是否被裁
import { startServer, runEdge } from './harness.mjs';

const server = await startServer(0);
try {
  const r = await runEdge([
    '--window-size=1600,1200',
    '--virtual-time-budget=20000',
    '--dump-dom',
    'http://127.0.0.1:' + server.port + '/tools/mobile-check.html',
  ], { timeout: 120000 });
  const m = r.out.match(/<pre id="mobile-report">([\s\S]*?)<\/pre>/);
  if (!m || m[1].indexOf('pending') === 0) {
    console.log('没有拿到移动端报告', r.out.slice(-600));
    process.exit(1);
  }
  const txt = m[1]
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const data = JSON.parse(txt);
  const bad = data.filter((d) => d.canScrollX || d.signClipped || d.tagCount !== 6 || d.error ||
    (d.containers || []).some((c) => c.right > Number(d.inner.split('x')[0]) + 1));
  console.log(JSON.stringify({ ok: bad.length === 0, sizes: data.length, bad, all: data }, null, 1));
  process.exit(bad.length ? 1 : 0);
} finally {
  await server.close();
}
