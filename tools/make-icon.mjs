// 生成应用图标 icon.png（512×512）：用 canvas 现画，不依赖任何素材
import fs from 'node:fs';
import path from 'node:path';
import { startServer, runEdge, ROOT } from './harness.mjs';

const SIZE = 512;
const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>icon</title></head>
<body style="margin:0"><canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<pre id="png"></pre>
<script>
var S = ${SIZE};
var c = document.getElementById('c');
var g = c.getContext('2d');

function rr(x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 背景：奶油纸 + 木色描边
var bg = g.createLinearGradient(0, 0, 0, S);
bg.addColorStop(0, '#fffaf0');
bg.addColorStop(.55, '#f7ead0');
bg.addColorStop(1, '#eeddba');
g.fillStyle = bg;
g.fillRect(0, 0, S, S);

// 背后一圈暖光
var glow = g.createRadialGradient(S * .5, S * .44, S * .05, S * .5, S * .44, S * .5);
glow.addColorStop(0, 'rgba(255,214,140,.95)');
glow.addColorStop(1, 'rgba(255,214,140,0)');
g.fillStyle = glow;
g.fillRect(0, 0, S, S);

// 影子
g.save();
g.globalAlpha = .18;
g.fillStyle = '#5c3414';
g.beginPath();
g.ellipse(S * .5, S * .795, S * .3, S * .045, 0, 0, Math.PI * 2);
g.fill();
g.restore();

// 苹果
function apple(cx, cy, r) {
  var grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#ff9a72');
  grad.addColorStop(.45, '#e4543a');
  grad.addColorStop(1, '#a52b1c');
  g.beginPath();
  g.moveTo(cx, cy - r * .62);
  g.bezierCurveTo(cx - r * .55, cy - r * 1.02, cx - r * 1.06, cy - r * .5, cx - r * .98, cy + r * .08);
  g.bezierCurveTo(cx - r * .9, cy + r * .72, cx - r * .42, cy + r * 1.02, cx, cy + r * .86);
  g.bezierCurveTo(cx + r * .42, cy + r * 1.02, cx + r * .9, cy + r * .72, cx + r * .98, cy + r * .08);
  g.bezierCurveTo(cx + r * 1.06, cy - r * .5, cx + r * .55, cy - r * 1.02, cx, cy - r * .62);
  g.closePath();
  g.fillStyle = grad;
  g.fill();
  // 高光
  g.save();
  g.globalAlpha = .38;
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(cx - r * .38, cy - r * .18, r * .16, r * .26, -.42, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// 叶子 + 果梗
function stemLeaf(cx, cy, r) {
  g.strokeStyle = '#7d4a20';
  g.lineWidth = r * .09;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, cy - r * .6);
  g.quadraticCurveTo(cx + r * .04, cy - r * .92, cx + r * .12, cy - r * 1.16);
  g.stroke();

  g.fillStyle = '#5c9c3f';
  g.beginPath();
  g.moveTo(cx + r * .1, cy - r * 1.02);
  g.bezierCurveTo(cx + r * .34, cy - r * 1.34, cx + r * .74, cy - r * 1.3, cx + r * .82, cy - r * 1.22);
  g.bezierCurveTo(cx + r * .6, cy - r * .96, cx + r * .28, cy - r * .94, cx + r * .1, cy - r * 1.02);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.beginPath();
  g.moveTo(cx + r * .22, cy - r * 1.04);
  g.bezierCurveTo(cx + r * .38, cy - r * 1.2, cx + r * .58, cy - r * 1.2, cx + r * .68, cy - r * 1.18);
  g.bezierCurveTo(cx + r * .5, cy - r * 1.06, cx + r * .34, cy - r * 1.02, cx + r * .22, cy - r * 1.04);
  g.closePath();
  g.fill();
}

// 梨（右下，小一点，做出"果园"的层次）
function pear(cx, cy, r) {
  var grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#f2f7a6');
  grad.addColorStop(.5, '#cbd94f');
  grad.addColorStop(1, '#8b9a26');
  g.beginPath();
  g.moveTo(cx, cy - r * .72);
  g.bezierCurveTo(cx - r * .34, cy - r * .74, cx - r * .44, cy - r * .18, cx - r * .8, cy + r * .28);
  g.bezierCurveTo(cx - r * 1.06, cy + r * .74, cx - r * .5, cy + r * 1.04, cx, cy + r * 1.04);
  g.bezierCurveTo(cx + r * .5, cy + r * 1.04, cx + r * 1.06, cy + r * .74, cx + r * .8, cy + r * .28);
  g.bezierCurveTo(cx + r * .44, cy - r * .18, cx + r * .34, cy - r * .74, cx, cy - r * .72);
  g.closePath();
  g.fillStyle = grad;
  g.fill();
  g.save();
  g.globalAlpha = .34;
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(cx - r * .3, cy + r * .22, r * .12, r * .26, .2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = '#7d4a20';
  g.lineWidth = r * .1;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, cy - r * .7);
  g.quadraticCurveTo(cx + r * .06, cy - r * .98, cx + r * .16, cy - r * 1.14);
  g.stroke();
}

pear(S * .74, S * .58, S * .115);
apple(S * .455, S * .5, S * .225);
stemLeaf(S * .455, S * .5, S * .225);

document.getElementById('png').textContent = c.toDataURL('image/png');
</script></body></html>`;

fs.writeFileSync(path.join(ROOT, 'tools', 'icon-gen.html'), page, 'utf8');

const server = await startServer(0);
try {
  const r = await runEdge([
    '--window-size=900,900',
    '--virtual-time-budget=3000',
    '--dump-dom',
    'http://127.0.0.1:' + server.port + '/tools/icon-gen.html',
  ], { timeout: 90000 });
  const m = r.out.match(/<pre id="png">data:image\/png;base64,([A-Za-z0-9+/=]+)<\/pre>/);
  if (!m) {
    console.log('没拿到图标数据', r.out.slice(-400));
    process.exit(1);
  }
  const buf = Buffer.from(m[1], 'base64');
  fs.writeFileSync(path.join(ROOT, 'icon.png'), buf);
  fs.writeFileSync(path.join(ROOT, 'output', 'icon-preview.png'), buf);
  console.log(JSON.stringify({ ok: true, bytes: buf.length, file: path.join(ROOT, 'icon.png') }, null, 1));
} finally {
  await server.close();
}
