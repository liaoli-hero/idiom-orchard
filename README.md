# 成语果园 · 水果版成语接龙

**在线玩（微信里点开就能玩，不用下载）：https://liaoli-hero.github.io/idiom-orchard/**

本地玩法：双击 `index.html` 就能玩（单文件、离线、手机浏览器也能开）。
想用本地服务器打开就双击 `start.cmd`，它会打开 http://localhost:8765/index.html

## 玩法

- 木牌上挂着一个成语，你要接的下一个成语**第一个字等于它的最后一个字**。
- 同音也算接上（尾字「渴」可以用「可」开头），只是分数打八折。
- 两种输入：点下面的**果篮**（生僻成语也能玩），或者在输入框**直接打字**（打字有 50% 加分）。
- 果汁条就是命：接对回果汁，发呆掉果汁，掉光本局结束。
- 每 5 连触发**丰收时刻**（8 秒双倍分）；每 5 层来一轮**水果专场**（找出全部含指定水果字的成语，全中 +400 分）。
- 水果道具：柠檬（+5 秒）、樱桃（提示）、西瓜（跳过）、草莓（15 秒双倍），快捷键 `1`–`4`。
- 三种模式：无尽果园、六十秒冲分、每日一果（每天固定开局，可复盘）。

## 代码结构

```
index.html            ← 交付物：单文件游戏（由 src/* 合成，勿手改）
start.cmd             ← 一键起本地服务器并打开浏览器
src/
  index.template.html 页面骨架（含 {{CSS}} 等占位符）
  style.css           全部样式（四季配色、响应式）
  engine.js           游戏内核：接龙判定、计分、连击、道具、存档（纯逻辑，可在 Node 里单测）
  game.js             渲染与交互：木牌、藤蔓生长、粒子、面板、自测脚本
  audio.js            Web Audio 现场合成的音效与背景音乐（不加载音频文件）
  art.js              手写 SVG 水果、果树、棚架（无外部素材）
  data.gen.js         生成的词库（30,185 条成语 + 单字拼音）
tools/
  build-data.mjs      从 cnchar 数据包抽取词库 → src/data.gen.js
  build.mjs           src/* → index.html
  check-static.mjs    静态检查：语法、id 双向核对、CSS 变量、外部依赖
  logic.test.mjs      内核单测（15 项）
  browser-test.mjs    Edge 无头跑 ?selftest=1（页面内 14 项断言）
  mobile-check.mjs    用 iframe 模拟 360/390/430/492 宽度，查横向溢出
  shot.mjs            批量截图到 output/
  metrics.mjs         布局诊断（?metrics=1 输出越界元素）
  file-probe.mjs      验证 file:// 双击打开也正常
```

## 自测怎么跑

```bash
node tools/build.mjs          # 合成 index.html
node tools/check-static.mjs   # 静态检查
node tools/logic.test.mjs     # 内核单测
node tools/browser-test.mjs   # 真浏览器断言
node tools/mobile-check.mjs   # 移动端布局
node tools/shot.mjs           # 截图（output/*.png）
```

## 词库来源

成语与拼音来自 npm 包 `cnchar` / `cnchar-idiom` / `cnchar-poly`（Apache-2.0），
由 `tools/build-data.mjs` 抽取为 30,185 条成语 + 4,438 个带拼音汉字，内嵌进单文件。
4 字成语占 29,349 条；同音接龙把"接不下去的字"从 1,081 个降到 164 个，其余情况由内核自动换字兜底。

## 反馈

- 觉得太难/太简单：`src/engine.js` 顶部的 `CONFIG` 集中了全部手感参数（时长、回血、倍率、每几层来专场）。
- 想加水果：`src/art.js` 顶部的 `FRUITS` 数组（换 SVG symbol 即可）。
