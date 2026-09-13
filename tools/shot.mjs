// 无头截图（PC + 手机 + 水果专场）
import fs from 'node:fs';
import path from 'node:path';
import { startServer, runEdge, ROOT } from './harness.mjs';

const OUT = path.join(ROOT, 'output');
fs.mkdirSync(OUT, { recursive: true });

const shots = [
  { name: 'desktop-play.png', size: '1400,900', url: 'index.html?demo=15' },
  { name: 'desktop-fruitround.png', size: '1400,900', url: 'index.html?demo=5' },
  { name: 'desktop-help.png', size: '1400,900', url: 'index.html?panel=help' },
  { name: 'desktop-book.png', size: '1400,900', url: 'index.html?panel=book' },
  { name: 'mobile-play.png', size: '390,844', url: 'index.html?demo=8' },
  { name: 'mobile-390.png', size: '520,986', url: 'tools/mobile-frame.html?w=390&h=844&q=demo=8' },
  { name: 'mobile-390-fruit.png', size: '520,986', url: 'tools/mobile-frame.html?w=390&h=844&q=demo=5' },
];

const server = await startServer(8766);
const results = [];
try {
  for (const shot of shots) {
    const file = path.join(OUT, shot.name);
    const t = Date.now();
    const { code, err } = await runEdge([
      '--window-size=' + shot.size,
      '--screenshot=' + file,
      '--force-prefers-reduced-motion',
      '--virtual-time-budget=6000',
      'http://127.0.0.1:8766/' + shot.url,
    ], { timeout: 90000 });
    results.push({
      name: shot.name,
      ok: fs.existsSync(file) && fs.statSync(file).size > 1000,
      kb: fs.existsSync(file) ? Math.round(fs.statSync(file).size / 1024) : 0,
      ms: Date.now() - t,
      exit: code,
      stderr: err.trim() ? err.trim().split('\n').slice(-2).join(' | ') : '',
    });
  }
} finally {
  await server.close();
}
console.log(JSON.stringify(results, null, 1));
process.exit(results.every((r) => r.ok) ? 0 : 1);
