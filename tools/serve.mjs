// 本地服务器：node tools/serve.mjs [端口]
// 用 http:// 打开游戏，浏览器才会允许 localStorage 存档。
import { startServer, ROOT } from './harness.mjs';
import path from 'node:path';

const port = Number(process.argv[2] || 8765);
const server = await startServer(port);
console.log('成语果园已启动： http://localhost:' + server.port + '/index.html');
console.log('（index.html 在 ' + path.join(ROOT, 'index.html') + '）');
console.log('按 Ctrl+C 结束。');
