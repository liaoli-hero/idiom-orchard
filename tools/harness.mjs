// 本地静态服务 + Edge 无头调用的公共部分（不需要安装 playwright）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

export const ROOT = path.resolve(import.meta.dirname, '..');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => fs.existsSync(p));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

export function startServer(port = 8765) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = decodeURIComponent(url.pathname);
    if (file === '/') file = '/index.html';
    const target = path.join(ROOT, file);
    if (!target.startsWith(ROOT) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    port: server.address().port,
    close: () => new Promise((r) => server.close(r)),
  })));
}

export function profileDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idiom-orchard-edge-'));
  return dir;
}

function cleanup(dir) {
  try {
    if (dir.startsWith(os.tmpdir()) && dir.includes('idiom-orchard-edge-')) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (e) { /* 临时目录清不掉不影响结果 */ }
}

/** 跑一次 Edge 无头，返回 stdout（--dump-dom 时是 DOM 文本） */
export function runEdge(args, { timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const profile = profileDir();
    const child = spawn(EDGE, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--in-process-gpu',
      '--use-gl=swiftshader',
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--user-data-dir=' + profile,
      ...args,
    ], { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      cleanup(profile);
      reject(new Error('Edge 超时（' + timeout + 'ms）'));
    }, timeout);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); cleanup(profile); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err, browser: EDGE });
      cleanup(profile);
    });
  });
}
