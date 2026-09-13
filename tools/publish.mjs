// 通过 GitHub Contents API 发布（本机 git push 连不上 github.com，但 api.github.com 可用）
// 用法: node tools/publish.mjs [owner/repo]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './harness.mjs';

const repo = process.argv[2] || 'liaoli-hero/idiom-orchard';
const [owner, name] = repo.split('/');
const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
const api = 'https://api.github.com';
const headers = {
  Authorization: 'Bearer ' + token,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'idiom-orchard-publisher',
  'X-GitHub-Api-Version': '2022-11-28',
};

// 先发布"能玩"的最小集合，再补源码
const ESSENTIAL = ['index.html', 'icon.png', 'README.md', '.gitignore'];
const SOURCE_DIRS = ['src', 'tools'];
const SOURCE_FILES = ['start.cmd'];

function walk(dir, base, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = base + '/' + entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'vendor' || entry.name === 'output' || entry.name === '.git') continue;
      walk(abs, rel, out);
    } else if (entry.name !== 'icon-gen.html') {
      out.push(rel);
    }
  }
}

async function apiJson(url, init) {
  const res = await fetch(api + url, { ...init, headers: { ...headers, ...(init && init.headers) } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* 忽略 */ }
  return { status: res.status, json, text };
}

async function putFile(rel, { essentialPass }) {
  const abs = path.join(ROOT, rel);
  const content = fs.readFileSync(abs).toString('base64');
  const existing = await apiJson('/repos/' + repo + '/contents/' + rel + '?ref=main');
  const sha = existing.status === 200 && existing.json ? existing.json.sha : undefined;
  const body = {
    message: (sha ? '更新 ' : '添加 ') + rel,
    content,
    branch: 'main',
    ...(sha ? { sha } : {}),
  };
  const res = await apiJson('/repos/' + repo + '/contents/' + rel, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const ok = res.status === 200 || res.status === 201;
  return { rel, ok, status: res.status, msg: ok ? '' : (res.json && res.json.message) || res.text.slice(0, 160) };
}

const report = { repo, essential: [], source: [], pages: null, url: 'https://' + owner + '.github.io/' + name + '/' };

for (const rel of ESSENTIAL) report.essential.push(await putFile(rel, { essentialPass: true }));

// 启用 Pages（已启用就改成 main 分支根目录）
const pagesBody = { source: { branch: 'main', path: '/' } };
let pages = await apiJson('/repos/' + repo + '/pages', { method: 'POST', body: JSON.stringify(pagesBody) });
if (pages.status === 409) {
  pages = await apiJson('/repos/' + repo + '/pages', { method: 'PUT', body: JSON.stringify(pagesBody) });
}
report.pages = { status: pages.status, url: pages.json && (pages.json.html_url || pages.json.url), status2: pages.json && pages.json.status, msg: pages.json && pages.json.message };

const files = [];
for (const d of SOURCE_DIRS) walk(path.join(ROOT, d), d, files);
files.push(...SOURCE_FILES);
for (const rel of files) report.source.push(await putFile(rel, { essentialPass: false }));

report.essentialFailed = report.essential.filter((r) => !r.ok);
report.sourceFailed = report.source.filter((r) => !r.ok);
console.log(JSON.stringify(report, null, 1));
