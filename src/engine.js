/* 成语果园 · 游戏内核
 * 纯逻辑，无 DOM 依赖：浏览器里挂 window.OrchardEngine，Node 里 require 即可单测。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OrchardEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CONFIG = {
    baseTimeStart: 13,        // 第一层的时间上限（秒）
    baseTimeMin: 6.5,         // 时间上限下限
    baseTimeStep: 1.15,       // 每层递减
    gainTimeExact: 2.6,       // 接对回血（秒）
    gainTimeHomo: 2.0,        // 同音接龙回血（秒）
    gainTimeTyped: 0.9,       // 打字输入额外奖励
    maxTimeFactor: 1.6,       // 时间条上限 = base * factor
    baseScore: 100,
    comboStep: 0.12,
    comboCap: 3.0,
    typedBonus: 1.5,
    homoFactor: 0.8,
    harvestEvery: 5,          // 每 5 连触发丰收时刻
    harvestDuration: 8,
    harvestFactor: 2,
    fruitRoundEvery: 5,       // 每 5 层来一轮水果专场
    fruitRoundQuestions: 3,
    fruitRoundValidEarly: 2,
    fruitRoundValidLate: 3,
    basketSize: 6,
    basketValidEarly: 3,
    basketValidLate: 2,
    timedModeDuration: 60,
    wrongPenalty: 3,
    hintPenalty: 0,
    itemMax: 3,
    comboItemMilestone: 5,
  };

  var FRUIT_MIN_POOL = 5; // 含该水果字的成语少于这个数就不出题

  /* ---------------- 随机数（可复现） ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function shuffled(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** 只数个数，不建数组：初始化时筛"好接的字"用 */
  function successorCount(index, chainChar, cache) {
    if (cache && cache.has(chainChar)) return cache.get(chainChar);
    var chars = linkSet(index, chainChar);
    var n = 0;
    chars.forEach(function (c) {
      n += (index.byFirst.get(c) || []).length;
    });
    if (cache) cache.set(chainChar, n);
    return n;
  }
  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  /* ---------------- 词库索引 ---------------- */
  function buildIndex(data, opts) {
    opts = opts || {};
    var maxLen = opts.maxLen || 999;
    var words = String(data.idioms).split('|').filter(function (w) {
      return w.length <= maxLen;
    });
    var pyOf = new Map();
    String(data.pinyin).split('|').forEach(function (entry) {
      if (!entry) return;
      var ch = entry[0];
      var list = entry.slice(1).split(',').filter(Boolean);
      if (list.length) pyOf.set(ch, list);
    });
    var byFirst = new Map();
    var byFirstPy = new Map();
    var charFreq = new Map();
    var wordSet = new Set();
    var fruitWords = new Map(); // 水果字 -> 含该字的成语

    var fruits = (data.fruits || []).map(function (f) { return f.ch; });
    var fruitSet = new Set(fruits);

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      wordSet.add(w);
      var first = w[0];
      var bucket = byFirst.get(first);
      if (!bucket) byFirst.set(first, (bucket = []));
      bucket.push(w);
      var pys = pyOf.get(first);
      if (pys) {
        for (var p = 0; p < pys.length; p++) {
          var pb = byFirstPy.get(pys[p]);
          if (!pb) byFirstPy.set(pys[p], (pb = []));
          if (pb.indexOf(w) < 0) pb.push(w);
        }
      }
      var seen = new Set();
      for (var c = 0; c < w.length; c++) {
        var ch = w[c];
        if (seen.has(ch)) continue;
        seen.add(ch);
        charFreq.set(ch, (charFreq.get(ch) || 0) + 1);
        if (fruitSet.has(ch)) {
          var fw = fruitWords.get(ch);
          if (!fw) fruitWords.set(ch, (fw = []));
          fw.push(w);
        }
      }
    }

    // 字频排名：越靠前越"常见"，用于挑出玩家更可能认识的候选
    var order = Array.from(charFreq.keys()).sort(function (a, b) {
      return charFreq.get(b) - charFreq.get(a);
    });
    var charRank = new Map();
    var total = order.length || 1;
    order.forEach(function (ch, idx) {
      charRank.set(ch, 1 - idx / total); // 1 = 最常见
    });
    function commonness(word) {
      var seen2 = new Set();
      var sum = 0;
      for (var k = 0; k < word.length; k++) {
        var ch = word[k];
        if (seen2.has(ch)) continue;
        seen2.add(ch);
        sum += charRank.get(ch) || 0;
      }
      return sum / word.length;
    }

    var idx = {
      words: words,
      wordSet: wordSet,
      pyOf: pyOf,
      byFirst: byFirst,
      byFirstPy: byFirstPy,
      charFreq: charFreq,
      fruitWords: fruitWords,
      fruitChars: fruits,
      commonness: commonness,
      fruitPool: fruits.filter(function (ch) {
        return (fruitWords.get(ch) || []).length >= FRUIT_MIN_POOL;
      }),
    };
    // 预计算开局池：尾字好接的 4 字成语（避免每局都遍历 3 万条）
    var starters = [];
    var countCache = new Map();
    for (var s = 0; s < words.length; s++) {
      var w0 = words[s];
      if (w0.length !== 4) continue;
      if (successorCount(idx, w0[3], countCache) >= 8) starters.push(w0);
    }
    idx.successorCount = function (ch) { return successorCount(idx, ch, countCache); };
    idx.starterPoolSize = starters.length;
    var shuffledStarters = shuffled(starters, mulberry32(20260912));
    idx.starterPool = shuffledStarters.slice(0, 6000);
    idx.jumpPool = shuffled(starters, mulberry32(777)).slice(0, 6000);
    idx.starterHead = idx.starterPool.slice().sort(function (a, b) {
      return idx.commonness(b) - idx.commonness(a);
    }).slice(0, Math.max(80, Math.ceil(idx.starterPool.length * 0.3)));
    return idx;
  }

  function pinyinOf(index, ch) {
    var list = index.pyOf.get(ch);
    return list && list.length ? list : [];
  }

  /* ---------------- 接龙判定 ---------------- */
  function successors(index, chainChar) {
    var exact = index.byFirst.get(chainChar) || [];
    var out = [];
    var seen = new Set();
    var i;
    for (i = 0; i < exact.length; i++) {
      if (!seen.has(exact[i])) { seen.add(exact[i]); out.push(exact[i]); }
    }
    var pys = pinyinOf(index, chainChar);
    for (i = 0; i < pys.length; i++) {
      var bucket = index.byFirstPy.get(pys[i]) || [];
      for (var j = 0; j < bucket.length; j++) {
        if (!seen.has(bucket[j])) { seen.add(bucket[j]); out.push(bucket[j]); }
      }
    }
    return out;
  }

  function isExactLink(chainChar, word) {
    return word[0] === chainChar;
  }
  function isHomoLink(index, chainChar, word) {
    if (isExactLink(chainChar, word)) return false;
    var a = pinyinOf(index, chainChar);
    if (!a.length) return false;
    var b = pinyinOf(index, word[0]);
    if (!b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) >= 0) return true;
    }
    return false;
  }

  /** 判定玩家给出的成语是否可以接上 */
  function checkAnswer(index, state, rawWord) {
    var word = String(rawWord == null ? '' : rawWord).replace(/\s/g, '');
    if (!word) return { ok: false, reason: 'empty', message: '还没输入成语呢' };
    if (!/^[\u4e00-\u9fa5]+$/.test(word)) {
      return { ok: false, reason: 'not_cjk', message: '只能输入汉字成语' };
    }
    if (word.length < 3) return { ok: false, reason: 'too_short', message: '成语至少三个字' };
    if (state.used.indexOf(word) >= 0) {
      return { ok: false, reason: 'used', message: '「' + word + '」这一局已经结过果了' };
    }
    if (state.status === 'fruit-round') {
      return { ok: false, reason: 'fruit_round', message: '先完成水果专场' };
    }
    if (!index.wordSet.has(word)) {
      return { ok: false, reason: 'unknown', message: '词库里没有「' + word + '」，换个说法试试' };
    }
    if (isExactLink(state.chainChar, word)) return { ok: true, kind: 'exact' };
    if (isHomoLink(index, state.chainChar, word)) return { ok: true, kind: 'homo' };
    return {
      ok: false,
      reason: 'not_linked',
      message: '要用「' + state.chainChar + '」开头',
    };
  }

  /* ---------------- 候选果篮 ---------------- */
  function linkSet(index, chainChar) {
    var set = new Set([chainChar]);
    var pys = pinyinOf(index, chainChar);
    for (var i = 0; i < pys.length; i++) {
      var bucket = index.byFirstPy.get(pys[i]) || [];
      for (var j = 0; j < bucket.length; j++) set.add(bucket[j][0]);
    }
    return set;
  }

  function pickValid(index, chainChar, used, count, rng) {
    var usedSet = new Set(used);
    var pool = successors(index, chainChar).filter(function (w) {
      return !usedSet.has(w);
    });
    if (!pool.length) return [];
    // 偏向玩家更可能认识的成语：先按常见度排序，再在前 60% 里随机
    pool.sort(function (a, b) {
      return index.commonness(b) - index.commonness(a);
    });
    var head = pool.slice(0, Math.max(count * 3, Math.ceil(pool.length * 0.6)));
    return shuffled(head, rng).slice(0, count);
  }

  function pickDecoys(index, chainChar, used, count, rng, hard, prevChars) {
    var banned = linkSet(index, chainChar);
    var usedSet = new Set(used);
    var wantTricky = hard && prevChars && prevChars.length > 1;
    var tricky = [];
    var normal = [];
    var guard = 0;
    var pool = index.words;
    var wantNormal = count * 3;
    while (((normal.length < wantNormal) || (wantTricky && tricky.length < count)) && guard < 3000) {
      guard++;
      var w = pool[Math.floor(rng() * pool.length)];
      if (banned.has(w[0]) || usedSet.has(w)) continue;
      if (normal.indexOf(w) >= 0 || tricky.indexOf(w) >= 0) continue;
      if (wantTricky && prevChars.indexOf(w[0]) >= 0) tricky.push(w);
      else normal.push(w);
    }
    var source = tricky.length >= count ? tricky : normal.concat(tricky);
    source.sort(function (a, b) {
      return index.commonness(b) - index.commonness(a);
    });
    var head = source.slice(0, Math.max(count * 4, 24));
    return shuffled(head, rng).slice(0, count);
  }

  function buildBasket(index, state, rng) {
    var tier = tierOf(state);
    var hard = tier >= 3;
    var validCount = tier >= 3 ? CONFIG.basketValidLate : CONFIG.basketValidEarly;
    var prevChars = state.current ? state.current.split('') : [];
    var valid = pickValid(index, state.chainChar, state.used, validCount, rng);
    var decoys = pickDecoys(
      index, state.chainChar, state.used,
      Math.max(1, CONFIG.basketSize - valid.length), rng, hard, prevChars
    );
    var options = valid.map(function (w) { return { word: w, valid: true }; })
      .concat(decoys.map(function (w) { return { word: w, valid: false }; }));
    return {
      options: shuffled(options, rng),
      validCount: valid.length,
      playable: valid.length > 0,
    };
  }

  /* ---------------- 水果专场 ---------------- */
  function buildFruitQuestion(index, state, rng) {
    var tier = tierOf(state);
    var want = tier >= 4 ? CONFIG.fruitRoundValidLate : CONFIG.fruitRoundValidEarly;
    var pool = index.fruitPool.length ? index.fruitPool : index.fruitChars.slice(0, 3);
    var tried = {};
    var target = null;
    var hits = [];
    for (var attempt = 0; attempt < 12; attempt++) {
      var ch = pick(pool, rng);
      if (tried[ch] && attempt < 6) continue;
      tried[ch] = true;
      var words = (index.fruitWords.get(ch) || []).filter(function (w) {
        return state.used.indexOf(w) < 0;
      });
      if (words.length >= want) {
        target = ch;
        words.sort(function (a, b) { return index.commonness(b) - index.commonness(a); });
        hits = shuffled(words.slice(0, Math.max(want * 3, 10)), rng).slice(0, want);
        break;
      }
    }
    if (!target) return null;
    var decoys = [];
    var guard = 0;
    while (decoys.length < CONFIG.basketSize - hits.length && guard < 4000) {
      guard++;
      var w = pick(index.words, rng);
      if (w.indexOf(target) >= 0) continue;
      if (state.used.indexOf(w) >= 0) continue;
      if (decoys.indexOf(w) >= 0 || hits.indexOf(w) >= 0) continue;
      decoys.push(w);
    }
    var options = hits.map(function (w) { return { word: w, valid: true }; })
      .concat(decoys.map(function (w) { return { word: w, valid: false }; }));
    return {
      fruit: target,
      options: shuffled(options, rng),
      need: hits.length,
      found: [],
      index: (state.fruitRound && state.fruitRound.index ? state.fruitRound.index : 0) + 1,
      total: CONFIG.fruitRoundQuestions,
    };
  }

  /* ---------------- 难度 ---------------- */
  function tierOf(state) {
    return Math.min(6, 1 + Math.floor(Math.max(0, state.level - 1) / CONFIG.fruitRoundEvery));
  }
  function baseTimeOf(state) {
    if (state.mode === 'timed') return CONFIG.timedModeDuration;
    return Math.max(CONFIG.baseTimeMin, CONFIG.baseTimeStart - (state.level - 1) * CONFIG.baseTimeStep);
  }

  /* ---------------- 局内状态 ---------------- */
  function createState(opts) {
    opts = opts || {};
    var mode = opts.mode || 'endless';
    var seed = opts.seed == null ? Math.floor(Math.random() * 1e9) : opts.seed >>> 0;
    var rng = mulberry32(seed);
    var state = {
      mode: mode,
      seed: seed,
      status: 'playing',
      level: 1,
      chain: [],
      current: null,
      chainChar: '',
      used: [],
      score: 0,
      combo: 0,
      maxCombo: 0,
      harvestLeft: 0,
      doubleLeft: 0,
      juice: 0,
      juiceMax: 0,
      items: { lemon: 1, cherry: 1, melon: 1, berry: 0 },
      fruitRound: null,
      roundsDone: 0,
      perfectRounds: 0,
      basket: null,
      hint: null,
      elapsed: 0,
      stats: { answers: 0, exact: 0, homo: 0, typed: 0, picked: 0, mistakes: 0, longestChain: 0 },
      gainedFruits: [],
      answers: [],
      over: null,
      events: [],
    };
    state._rng = rng;
    return state;
  }

  function pushEvent(state, ev) {
    state.events.push(ev);
  }

  function startGame(index, opts) {
    var state = createState(opts);
    var rng = state._rng;
    var head = index.starterHead && index.starterHead.length ? index.starterHead : index.words;
    var starter = opts && opts.starter && index.wordSet.has(opts.starter)
      ? opts.starter
      : pick(head.length ? head : index.words, rng);
    state.chain = [starter];
    state.current = starter;
    state.chainChar = starter[starter.length - 1];
    state.used = [starter];
    state.harvestLeft = 0;
    state.doubleLeft = 0;
    state.juiceMax = baseTimeOf(state) * CONFIG.maxTimeFactor;
    state.juice = state.juiceMax;
    if (state.mode === 'timed') {
      state.juiceMax = CONFIG.timedModeDuration;
      state.juice = CONFIG.timedModeDuration;
    }
    state.basket = buildBasket(index, state, rng);
    pushEvent(state, { type: 'start', starter: starter });
    return state;
  }

  function scoreFor(state, kind, extras) {
    extras = extras || {};
    var mult = Math.min(CONFIG.comboCap, 1 + Math.max(0, state.combo) * CONFIG.comboStep);
    var speed = 1 + (state.juiceMax ? Math.max(0, Math.min(1, state.juice / state.juiceMax)) * 0.5 : 0);
    var val = CONFIG.baseScore * mult * speed;
    if (kind === 'homo') val *= CONFIG.homoFactor;
    if (extras.typed) val *= CONFIG.typedBonus;
    if (extras.double) val *= CONFIG.harvestFactor;
    return Math.round(val);
  }

  /** 玩家提交一个成语（打字或点选） */
  function submit(index, state, rawWord, input) {
    input = input || {};
    if (state.status === 'over') return { ok: false, reason: 'over', message: '本局已结束' };
    var result = checkAnswer(index, state, rawWord);
    if (!result.ok) {
      var penalty = result.reason === 'empty' ? 0 : CONFIG.wrongPenalty;
      if (penalty) {
        state.juice = Math.max(0, state.juice - penalty);
        state.combo = 0;
        state.stats.mistakes++;
        pushEvent(state, { type: 'wrong', reason: result.reason, message: result.message, penalty: penalty });
        if (state.juice <= 0) endGame(state, 'juice');
      } else {
        pushEvent(state, { type: 'notice', message: result.message });
      }
      return result;
    }
    var word = String(rawWord).replace(/\s/g, '');
    var typed = !!input.typed;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    var doubleNow = state.doubleLeft > 0;
    var gained = scoreFor(state, result.kind, { typed: typed, double: doubleNow });
    state.score += gained;
    var gain = result.kind === 'exact' ? CONFIG.gainTimeExact : CONFIG.gainTimeHomo;
    if (typed) gain += CONFIG.gainTimeTyped;
    if (state.mode === 'timed') gain = Math.min(gain, 1.2);
    state.juice = Math.min(state.juiceMax, state.juice + gain);
    state.chain.push(word);
    state.current = word;
    state.chainChar = word[word.length - 1];
    state.used.push(word);
    state.level += 1;
    state.stats.answers++;
    state.stats[result.kind === 'exact' ? 'exact' : 'homo']++;
    state.stats[typed ? 'typed' : 'picked']++;
    state.stats.longestChain = Math.max(state.stats.longestChain, state.chain.length);
    state.answers.push({ word: word, kind: result.kind, typed: typed, score: gained, combo: state.combo });
    pushEvent(state, {
      type: 'correct', word: word, kind: result.kind, typed: typed,
      combo: state.combo, gained: gained, double: doubleNow,
      chainLength: state.chain.length, gainTime: gain,
    });
    if (state.combo > 0 && state.combo % CONFIG.harvestEvery === 0) {
      state.harvestLeft = CONFIG.harvestDuration;
      pushEvent(state, { type: 'harvest', combo: state.combo });
    }
    if (state.combo > 0 && state.combo % CONFIG.comboItemMilestone === 0) {
      var kinds = ['lemon', 'cherry', 'melon', 'berry'];
      var kindItem = kinds[Math.floor(rngSafe(state) * kinds.length)];
      state.items[kindItem] = Math.min(CONFIG.itemMax, state.items[kindItem] + 1);
      pushEvent(state, { type: 'item', item: kindItem });
    }
    // 每 5 层来一轮水果专场
    if (state.level > 1 && (state.level - 1) % CONFIG.fruitRoundEvery === 0 && !state.fruitRound) {
      startFruitRound(index, state);
      return { ok: true, kind: result.kind, gained: gained };
    }
    finishTurn(index, state);
    return { ok: true, kind: result.kind, gained: gained };
  }

  function rngSafe(state) {
    return state._rng();
  }

  function finishTurn(index, state) {
    state.juiceMax = state.mode === 'timed'
      ? CONFIG.timedModeDuration
      : baseTimeOf(state) * CONFIG.maxTimeFactor;
    state.juice = Math.min(state.juice, state.juiceMax);
    var basket = buildBasket(index, state, state._rng);
    if (!basket.playable) {
      // 理论上锁死了：免费换一个新起点，保住连击
      var jump = autoJump(index, state);
      pushEvent(state, { type: 'dead-end', word: jump });
      basket = buildBasket(index, state, state._rng);
    }
    state.basket = basket;
    state.hint = null;
  }

  function autoJump(index, state) {
    var candidates = successors(index, state.chainChar).filter(function (w) {
      return state.used.indexOf(w) < 0;
    });
    if (!candidates.length) {
      // 整条链无解，直接换一个全新的起始成语
      var usedSet = new Set(state.used);
      var pool = (index.jumpPool || []).filter(function (w) { return !usedSet.has(w); });
      var fallback = index.words.filter(function (w) { return !usedSet.has(w); });
      var w2 = pick(pool.length ? pool : (fallback.length ? fallback : index.words), state._rng);
      state.chain.push(w2);
      state.current = w2;
      state.chainChar = w2[w2.length - 1];
      state.used.push(w2);
      state.level += 1;
      return w2;
    }
    var w3 = pick(candidates, state._rng);
    state.chain.push(w3);
    state.current = w3;
    state.chainChar = w3[w3.length - 1];
    state.used.push(w3);
    state.level += 1;
    return w3;
  }

  function startFruitRound(index, state) {
    state.status = 'fruit-round';
    var q = buildFruitQuestion(index, state, state._rng);
    if (!q) q = { fruit: pick(index.fruitChars, state._rng), options: [], need: 0, found: [], index: 1, total: 1 };
    state.fruitRound = q;
    pushEvent(state, { type: 'fruit-round-start', fruit: q.fruit, need: q.need });
  }

  function submitFruitPick(index, state, word) {
    if (state.status !== 'fruit-round' || !state.fruitRound) {
      return { ok: false, reason: 'not_in_round' };
    }
    var fr = state.fruitRound;
    var opt = fr.options.filter(function (o) { return o.word === word; })[0];
    if (!opt) return { ok: false, reason: 'unknown_option' };
    if (opt.valid) {
      if (fr.found.indexOf(word) >= 0) return { ok: false, reason: 'already' };
      fr.found.push(word);
      state.used.push(word);
      state.gainedFruits.push(word);
      state.score += 120 * Math.max(1, state.combo);
      var done = fr.found.length >= fr.need;
      pushEvent(state, { type: 'fruit-hit', word: word, left: fr.need - fr.found.length });
      if (done) finishFruitRound(index, state);
      return { ok: true, done: done };
    }
    state.juice = Math.max(0, state.juice - CONFIG.wrongPenalty);
    state.combo = 0;
    state.stats.mistakes++;
    pushEvent(state, {
      type: 'fruit-miss', word: word, answer: fr.fruit,
      solutions: fr.options.filter(function (o) { return o.valid; }).map(function (o) { return o.word; }),
    });
    finishFruitRound(index, state);
    return { ok: false, reason: 'wrong', done: true };
  }

  function finishFruitRound(index, state) {
    var fr = state.fruitRound;
    var perfect = fr && fr.found.length >= fr.need;
    if (perfect) {
      state.perfectRounds += 1;
      state.score += 400;
      state.juice = Math.min(state.juiceMax, state.juice + 3);
      state.items.lemon = Math.min(CONFIG.itemMax, state.items.lemon + 1);
      for (var i = 0; i < fr.found.length; i++) state.gainedFruits.push(fr.found[i]);
    }
    state.roundsDone += 1;
    pushEvent(state, { type: 'fruit-round-end', perfect: perfect, fruit: fr ? fr.fruit : '' });
    state.fruitRound = null;
    state.status = 'playing';
    if (index) finishTurn(index, state);
  }

  /* ---------------- 道具 ---------------- */
  function useItem(index, state, item) {
    if (state.status === 'over') return { ok: false };
    if (!state.items[item]) return { ok: false, reason: 'none' };
    var label = '';
    if (item === 'lemon') {
      state.items.lemon--;
      state.juice = Math.min(state.juiceMax, state.juice + 5);
      label = '柠檬 +5 秒';
    } else if (item === 'cherry') {
      if (!state.basket || state.status !== 'playing') return { ok: false, reason: 'no-basket' };
      state.items.cherry--;
      var keep = state.basket.options.filter(function (o) { return o.valid; }).map(function (o) { return o.word; });
      state.hint = keep;
      label = '樱桃提示';
    } else if (item === 'melon') {
      if (state.status !== 'playing') return { ok: false, reason: 'busy' };
      state.items.melon--;
      var w = autoJump(index, state);
      state.basket = buildBasket(index, state, state._rng);
      label = '西瓜跳过 → ' + w;
    } else if (item === 'berry') {
      state.items.berry--;
      state.doubleLeft = 15;
      label = '草莓双倍分 15 秒';
    } else {
      return { ok: false, reason: 'unknown' };
    }
    pushEvent(state, { type: 'item-used', item: item, label: label });
    return { ok: true, label: label };
  }

  /* ---------------- 时间推进 ---------------- */
  function tick(index, state, dt) {
    if (state.status === 'over') return;
    if (!(dt > 0)) return;
    state.elapsed += dt;
    if (state.harvestLeft > 0) state.harvestLeft = Math.max(0, state.harvestLeft - dt);
    if (state.doubleLeft > 0) state.doubleLeft = Math.max(0, state.doubleLeft - dt);
    if (state.status !== 'playing') return; // 水果专场不计时
    state.juice = Math.max(0, state.juice - dt);
    if (state.juice <= 0) endGame(state, state.mode === 'timed' ? 'time' : 'juice');
  }

  function endGame(state, reason) {
    if (state.status === 'over') return;
    state.status = 'over';
    state.over = {
      reason: reason,
      score: state.score,
      chain: state.chain.length,
      maxCombo: state.maxCombo,
      longest: state.stats.longestChain,
      answers: state.stats.answers,
      mistakes: state.stats.mistakes,
      fruits: state.gainedFruits.length,
      rounds: state.roundsDone,
      elapsed: Math.round(state.elapsed),
    };
    pushEvent(state, { type: 'game-over', reason: reason, report: state.over });
  }

  function drainEvents(state) {
    var out = state.events;
    state.events = [];
    return out;
  }

  /* ---------------- 存档（含异常兜底） ---------------- */
  function createStore(storage, key) {
    key = key || 'idiom-orchard-v1';
    var memory = null;
    function read() {
      if (!storage) return memory;
      try {
        var raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return memory;
      }
    }
    function write(value) {
      memory = value;
      if (!storage) return false;
      try {
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    }
    return { read: read, write: write, key: key };
  }

  var DEFAULT_SAVE = {
    version: 1,
    best: { endless: 0, timed: 0, daily: 0 },
    bestChain: 0,
    bestCombo: 0,
    collected: [],
    plays: 0,
    totalAnswers: 0,
    achievements: [],
    sound: true,
    bgm: true,
    tutorialDone: false,
  };

  function loadSave(store) {
    var raw = store.read();
    var save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    if (raw && typeof raw === 'object') {
      if (raw.best && typeof raw.best === 'object') {
        save.best.endless = num(raw.best.endless);
        save.best.timed = num(raw.best.timed);
        save.best.daily = num(raw.best.daily);
      }
      save.bestChain = num(raw.bestChain);
      save.bestCombo = num(raw.bestCombo);
      save.plays = num(raw.plays);
      save.totalAnswers = num(raw.totalAnswers);
      save.collected = Array.isArray(raw.collected) ? raw.collected.filter(function (w) {
        return typeof w === 'string';
      }) : [];
      save.achievements = Array.isArray(raw.achievements) ? raw.achievements.filter(function (a) {
        return typeof a === 'string';
      }) : [];
      save.sound = raw.sound !== false;
      save.bgm = raw.bgm !== false;
      save.tutorialDone = !!raw.tutorialDone;
    }
    return save;
  }

  function num(v) {
    v = Number(v);
    return isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }

  var ACHIEVEMENTS = [
    { id: 'first-fruit', name: '第一颗果', desc: '接对第一条成语' },
    { id: 'combo-10', name: '十连丰收', desc: '连击达到 10' },
    { id: 'combo-20', name: '二十连瀑', desc: '连击达到 20' },
    { id: 'chain-20', name: '长藤绕树', desc: '一条链条接到 20 条成语' },
    { id: 'chain-40', name: '参天果树', desc: '一条链条接到 40 条成语' },
    { id: 'typist', name: '手写高手', desc: '一局中打字输入 15 条成语' },
    { id: 'collector-100', name: '百果图鉴', desc: '累计收集 100 条成语' },
    { id: 'collector-500', name: '五百果园', desc: '累计收集 500 条成语' },
    { id: 'score-5000', name: '五千分', desc: '单局得分超过 5000' },
    { id: 'score-15000', name: '万五果园主', desc: '单局得分超过 15000' },
    { id: 'fruit-round', name: '水果专场全中', desc: '在一轮水果专场中全部找对' },
    { id: 'homo-master', name: '同音大师', desc: '用同音接龙接上 10 次' },
  ];

  /** 把一局的成绩并入存档，返回本次新解锁的成就 */
  function applyResult(save, state, index) {
    var unlocked = [];
    save.plays += 1;
    save.totalAnswers += state.stats.answers;
    var mode = state.mode;
    if (state.score > (save.best[mode] || 0)) save.best[mode] = state.score;
    save.bestChain = Math.max(save.bestChain, state.stats.longestChain);
    save.bestCombo = Math.max(save.bestCombo, state.maxCombo);
    var have = new Set(save.collected);
    for (var i = 0; i < state.used.length; i++) have.add(state.used[i]);
    save.collected = Array.from(have);
    var got = function (id) {
      if (save.achievements.indexOf(id) < 0) {
        save.achievements.push(id);
        unlocked.push(id);
      }
    };
    if (state.stats.answers >= 1) got('first-fruit');
    if (state.maxCombo >= 10) got('combo-10');
    if (state.maxCombo >= 20) got('combo-20');
    if (state.stats.longestChain >= 20) got('chain-20');
    if (state.stats.longestChain >= 40) got('chain-40');
    if (state.stats.typed >= 15) got('typist');
    if (save.collected.length >= 100) got('collector-100');
    if (save.collected.length >= 500) got('collector-500');
    if (state.score >= 5000) got('score-5000');
    if (state.score >= 15000) got('score-15000');
    if (state.stats.homo >= 10) got('homo-master');
    if (state.perfectRounds > 0) got('fruit-round');
    return unlocked;
  }

  function dailySeed(dateStr) {
    return hashString('orchard-' + dateStr) % 1000000;
  }

  return {
    CONFIG: CONFIG,
    ACHIEVEMENTS: ACHIEVEMENTS,
    DEFAULT_SAVE: DEFAULT_SAVE,
    buildIndex: buildIndex,
    startGame: startGame,
    createState: createState,
    submit: submit,
    submitFruitPick: submitFruitPick,
    useItem: useItem,
    tick: tick,
    endGame: endGame,
    checkAnswer: checkAnswer,
    successors: successors,
    pinyinOf: pinyinOf,
    buildBasket: buildBasket,
    buildFruitQuestion: buildFruitQuestion,
    tierOf: tierOf,
    baseTimeOf: baseTimeOf,
    scoreFor: scoreFor,
    drainEvents: drainEvents,
    createStore: createStore,
    loadSave: loadSave,
    applyResult: applyResult,
    dailySeed: dailySeed,
    mulberry32: mulberry32,
    hashString: hashString,
  };
});
