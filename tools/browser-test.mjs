// 真浏览器自测：Edge 无头打开 ?selftest=1，读回页面里的断言报告
import { startServer, runEdge } from './harness.mjs';

const server = await startServer(8765);
try {
  const { out, err, code, browser } = await runEdge([
    '--virtual-time-budget=12000',
    '--dump-dom',
    'http://127.0.0.1:8765/index.html?selftest=1',
  ], { timeout: 90000 });

  const m = out.match(/<pre id="selftest-report"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) {
    console.log(JSON.stringify({
      ok: false,
      reason: '页面没有产出 selftest 报告',
      browser,
      edgeExit: code,
      stderrTail: err.split('\n').slice(-8).join('\n'),
      domTail: out.slice(-1200),
    }, null, 1));
    process.exit(1);
  }
  const decoded = m[1]
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const report = JSON.parse(decoded);
  const failed = report.checks.filter((c) => !c.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0 && report.errors.length === 0,
    passed: report.passed,
    total: report.total,
    failed,
    consoleErrors: report.errors,
    viewport: report.viewport,
    browser,
  }, null, 1));
  process.exit(failed.length || report.errors.length ? 1 : 0);
} finally {
  await server.close();
}
