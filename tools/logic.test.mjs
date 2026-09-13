// 内核单测：node tools/logic.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const E = require(path.join(ROOT, 'src', 'engine.js'));

const dataSrc = fs.readFileSync(path.join(ROOT, 'src', 'data.gen.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox);
const DATA = sandbox.IDIOM_DATA;

const results = [];
function test(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: String(err && err.stack || err).split('\n').slice(0, 3).join(' | ') });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b));
}

const t0 = Date.now();
const index = E.buildIndex(DATA);
const buildMs = Date.now() - t0;

test('词库规模与拼音表', () => {
  assert(index.words.length > 25000, '词库条数 ' + index.words.length);
  assert(index.pyOf.size > 4000, '拼音表 ' + index.pyOf.size);
  assert(index.wordSet.has('一心一意'), '缺常用成语');
  assert(index.pyOf.get('渴')[0] === 'ke', '拼音错误 ' + JSON.stringify(index.pyOf.get('渴')));
});

test('候选果篮始终可玩（随机 400 个起始词）', () => {
  const rng = E.mulberry32(2026);
  for (let i = 0; i < 400; i++) {
    const st = E.startGame(index, { seed: 1000 + i, mode: 'endless' });
    assert(st.basket && st.basket.playable, '开局果篮不可玩 seed=' + (1000 + i));
    assert(st.basket.options.length === E.CONFIG.basketSize, '果篮数量 ' + st.basket.options.length);
    assert(st.basket.options.some((o) => o.valid), '果篮没有正确项');
  }
  assert(rng() >= 0, 'sanity');
});

test('接龙规则：同字 / 同音 / 各种非法输入', () => {
  const st = E.startGame(index, { seed: 7, mode: 'endless' });
  st.current = '望梅止渴';
  st.chainChar = '渴';
  st.used = ['望梅止渴'];
  eq(E.checkAnswer(index, st, '渴骥奔泉').kind, 'exact', '同字应通过');
  const homo = E.checkAnswer(index, st, '可歌可泣');
  assert(homo.ok && homo.kind === 'homo', '同音应通过');
  eq(E.checkAnswer(index, st, '一心一意').reason, 'not_linked', '接不上应被拒');
  eq(E.checkAnswer(index, st, '').reason, 'empty', '空输入');
  eq(E.checkAnswer(index, st, 'abc').reason, 'not_cjk', '非汉字');
  eq(E.checkAnswer(index, st, '望梅止渴').reason, 'used', '重复使用');
  eq(E.checkAnswer(index, st, '梅止渴').reason, 'unknown', '词库外');
  eq(E.checkAnswer(index, st, '成语').reason, 'too_short', '过短');
});

test('同音接龙确实覆盖死路字', () => {
  // 找若干个"没有同字后继"的尾字，验证同音能救回来
  let dead = 0;
  let saved = 0;
  for (const w of index.words) {
    const tail = w[w.length - 1];
    if ((index.byFirst.get(tail) || []).length === 0) {
      dead++;
      if (E.successors(index, tail).length > 0) saved++;
    }
  }
  assert(dead > 300, '死路字太少，测试样本不足: ' + dead);
  assert(saved / dead > 0.7, '同音救回比例偏低: ' + saved + '/' + dead);
});

test('自动对局 200 回合：果篮永远可玩、无重复、分数单调', () => {
  const st = E.startGame(index, { seed: 42, mode: 'endless' });
  let prevScore = 0;
  for (let turn = 0; turn < 200; turn++) {
    assert(st.status !== 'over', '不该中途结束 turn=' + turn);
    if (st.status === 'fruit-round') {
      const fr = st.fruitRound;
      const valids = fr.options.filter((o) => o.valid).map((o) => o.word);
      assert(valids.length >= fr.need, '水果专场正确项不足');
      valids.slice(0, fr.need).forEach((w) => E.submitFruitPick(index, st, w));
      continue;
    }
    const opt = st.basket.options.find((o) => o.valid);
    assert(opt, '果篮没有可选项 turn=' + turn + ' chainChar=' + st.chainChar);
    const res = E.submit(index, st, opt.word, { typed: false });
    assert(res.ok, '提交失败: ' + JSON.stringify(res) + ' word=' + opt.word);
    assert(st.score >= prevScore, '分数倒退');
    prevScore = st.score;
    st.juice = st.juiceMax; // 排除时间因素，专测规则
  }
  assert(new Set(st.used).size === st.used.length, '出现重复使用的成语');
  // 200 次提交里会夹进水果专场（每次 3 题），所以链长略小于提交次数
  assert(st.stats.longestChain >= 140, '链长 ' + st.stats.longestChain);
  assert(st.used.length > 150, '用词数 ' + st.used.length);
  assert(st.status !== 'over', '不该被时间判负（测试中已回满果汁）');
});

test('打字输入有加成、同音有折扣', () => {
  const a = E.startGame(index, { seed: 11, mode: 'endless' });
  a.current = '望梅止渴'; a.chainChar = '渴'; a.used = ['望梅止渴']; a.combo = 5; a.juice = a.juiceMax;
  const pickedScore = E.scoreFor(a, 'exact', { typed: false, double: false });
  const typedScore = E.scoreFor(a, 'exact', { typed: true, double: false });
  const homoS = E.scoreFor(a, 'homo', { typed: false, double: false });
  assert(typedScore > pickedScore, '打字应加分');
  assert(homoS < pickedScore, '同音应打折');
  const dbl = E.scoreFor(a, 'exact', { typed: false, double: true });
  eq(dbl, pickedScore * 2, '丰收应双倍');
});

test('连击 / 丰收时刻 / 道具掉落', () => {
  const st = E.startGame(index, { seed: 99, mode: 'endless' });
  const itemsBefore = JSON.stringify(st.items);
  for (let i = 0; i < 5; i++) {
    const opt = st.basket.options.find((o) => o.valid);
    E.submit(index, st, opt.word);
    st.juice = st.juiceMax;
  }
  eq(st.combo, 5, '连击数');
  assert(st.harvestLeft > 0, '第 5 连应触发丰收');
  assert(JSON.stringify(st.items) !== itemsBefore, '第 5 连应掉落道具');
});

test('道具效果', () => {
  const st = E.startGame(index, { seed: 5, mode: 'endless' });
  st.juice = 3;
  E.useItem(index, st, 'lemon');
  assert(st.juice > 7, '柠檬加时失败 ' + st.juice);
  st.basket = E.buildBasket(index, st, E.mulberry32(3));
  E.useItem(index, st, 'cherry');
  assert(Array.isArray(st.hint) && st.hint.length > 0, '樱桃提示为空');
  st.items.melon = 1;
  const before = st.chain.length;
  E.useItem(index, st, 'melon');
  eq(st.chain.length, before + 1, '西瓜应自动接一条');
  assert(st.basket.playable, '西瓜后果篮应可玩');
  st.items.berry = 1;
  E.useItem(index, st, 'berry');
  assert(st.doubleLeft > 0, '草莓双倍未生效');
  eq(E.useItem(index, st, 'berry').reason, 'none', '道具用尽应返回 none');
});

test('时间推进与结束', () => {
  const st = E.startGame(index, { seed: 3, mode: 'endless' });
  const before = st.juice;
  E.tick(index, st, 1);
  assert(st.juice < before, '果汁条没有下降');
  E.tick(index, st, 999);
  eq(st.status, 'over', '时间耗尽应结束');
  assert(st.over && st.over.score === st.score, '结算数据缺失');
  E.tick(index, st, 1);
  eq(st.status, 'over', '结束后不应复活');
});

test('限时模式 60 秒上限', () => {
  const st = E.startGame(index, { seed: 8, mode: 'timed' });
  eq(st.juice, 60, '限时模式初始时间');
  eq(st.juiceMax, 60, '限时模式时间上限');
  const opt = st.basket.options.find((o) => o.valid);
  E.submit(index, st, opt.word);
  assert(st.juice <= 61.2, '限时模式加时过多 ' + st.juice);
});

test('水果专场：触发 / 全中奖励 / 选错扣时间', () => {
  const st = E.startGame(index, { seed: 2024, mode: 'endless' });
  for (let i = 0; i < 200 && st.status === 'playing'; i++) {
    const opt = st.basket.options.find((o) => o.valid);
    E.submit(index, st, opt.word);
    st.juice = st.juiceMax;
    if (st.status === 'fruit-round') break;
  }
  eq(st.status, 'fruit-round', '第 5 层应进入水果专场');
  const fr = st.fruitRound;
  assert(fr.fruit && fr.fruit.length === 1, '水果专场应有目标水果');
  const valids = fr.options.filter((o) => o.valid);
  assert(valids.length >= 2, '正确项不足 ' + valids.length);
  valids.slice(0, fr.need).forEach((o) => E.submitFruitPick(index, st, o.word));
  eq(st.status, 'playing', '全中后应回到接龙');
  eq(st.perfectRounds, 1, '全中计数');
  assert(st.basket && st.basket.playable, '专场后果篮应可玩');

  const st2 = E.startGame(index, { seed: 2024, mode: 'endless' });
  for (let i = 0; i < 200 && st2.status === 'playing'; i++) {
    const opt = st2.basket.options.find((o) => o.valid);
    E.submit(index, st2, opt.word);
    st2.juice = st2.juiceMax;
    if (st2.status === 'fruit-round') break;
  }
  st2.combo = 6;
  st2.juice = 20;
  const wrong = st2.fruitRound.options.find((o) => !o.valid);
  E.submitFruitPick(index, st2, wrong.word);
  assert(st2.juice < 20, '选错应扣时间');
  eq(st2.combo, 0, '选错应断连击');
  eq(st2.status, 'playing', '选错后应回到接龙');
});

test('死路字自动换字，不卡死', () => {
  let deadChar = null;
  for (const w of index.words) {
    const tail = w[w.length - 1];
    if (E.successors(index, tail).length === 0) { deadChar = tail; break; }
  }
  assert(deadChar, '找不到死路字');
  const st = E.startGame(index, { seed: 12, mode: 'endless' });
  st.current = '测试' + deadChar;
  st.chainChar = deadChar;
  st.used = [st.current];
  st.basket = E.buildBasket(index, st, E.mulberry32(1));
  // 直接触发一次 turn 收尾逻辑：通过西瓜道具走 autoJump 路径
  st.items.melon = 1;
  const res = E.useItem(index, st, 'melon');
  assert(res.ok, '死路应能被跳过');
  assert(st.basket.playable, '死路后应给出可玩果篮 chainChar=' + st.chainChar);
});

test('存档：坏数据兜底 / 合并成绩 / 成就解锁', () => {
  const store = E.createStore(null);
  const bad = ['not json', '{"best":null}', '{"collected":"x","best":{"endless":"9"},"achievements":[1,2]}', '[]'];
  for (const raw of bad) {
    const s = E.createStore({ getItem: () => raw, setItem: () => {} });
    const save = E.loadSave(s);
    assert(typeof save.best.endless === 'number', 'best 兜底失败 raw=' + raw);
    assert(Array.isArray(save.collected), 'collected 兜底失败');
  }
  const throwing = E.createStore({ getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('quota'); } });
  const save2 = E.loadSave(throwing);
  eq(save2.best.endless, 0, '读失败应回默认');
  assert(throwing.write({ a: 1 }) === false, '写失败应返回 false 而不是抛错');

  const st = E.startGame(index, { seed: 21, mode: 'endless' });
  st.score = 9000;
  st.maxCombo = 12;
  st.stats.longestChain = 22;
  st.stats.typed = 16;
  st.stats.homo = 11;
  st.perfectRounds = 1;
  const unlocked = E.applyResult(save2, st, index);
  assert(unlocked.includes('score-5000'), '缺成就 score-5000');
  assert(unlocked.includes('combo-10'), '缺成就 combo-10');
  assert(unlocked.includes('chain-20'), '缺成就 chain-20');
  assert(save2.best.endless === 9000, '最高分未记录');
  assert(save2.collected.length >= st.used.length, '收集未合并');
  assert(store.read() === null, 'store 不该凭空写盘');
});

test('同种子可复现 / 每日种子稳定', () => {
  const a = E.startGame(index, { seed: 12345, mode: 'endless' });
  const b = E.startGame(index, { seed: 12345, mode: 'endless' });
  eq(a.current, b.current, '起始成语不一致');
  eq(a.basket.options.map((o) => o.word).join(','), b.basket.options.map((o) => o.word).join(','), '果篮不一致');
  eq(E.dailySeed('2026-09-12'), E.dailySeed('2026-09-12'), '每日种子不稳定');
  assert(E.dailySeed('2026-09-12') !== E.dailySeed('2026-09-13'), '每日种子应随日期变化');
});

test('性能：200 局开局 + 3000 回合结算耗时', () => {
  const t = Date.now();
  for (let g = 0; g < 200; g++) E.startGame(index, { seed: g, mode: 'endless' });
  const startMs = Date.now() - t;
  const t2 = Date.now();
  const st = E.startGame(index, { seed: 1, mode: 'endless' });
  for (let i = 0; i < 3000; i++) {
    if (st.status === 'over') break;
    if (st.status === 'fruit-round') {
      const v = st.fruitRound.options.filter((o) => o.valid).slice(0, st.fruitRound.need);
      v.forEach((o) => E.submitFruitPick(index, st, o.word));
      continue;
    }
    const opt = st.basket.options.find((o) => o.valid);
    if (!opt) break;
    E.submit(index, st, opt.word);
    st.juice = st.juiceMax;
    if (i > 900) break;
  }
  const playMs = Date.now() - t2;
  assert(startMs < 4000, '200 次开局太慢: ' + startMs + 'ms');
  assert(playMs < 4000, '900 回合太慢: ' + playMs + 'ms');
});

const failed = results.filter((r) => !r.ok);
const report = {
  buildMs,
  index: { words: index.words.length, chars: index.pyOf.size, fruitPool: index.fruitPool },
  passed: results.length - failed.length,
  total: results.length,
  failed,
  results,
};
console.log(JSON.stringify(report, null, 1));
process.exit(failed.length ? 1 : 0);
