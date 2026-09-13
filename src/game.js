/* 成语果园 · 渲染与交互层 */
(function () {
  'use strict';

  var Engine = window.OrchardEngine;
  var Audio = window.OrchardAudio;
  var Art = window.OrchardArt;
  var DATA = window.IDIOM_DATA;
  var NS = 'http://www.w3.org/2000/svg';
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  var MODE_LABEL = { endless: '无尽果园', timed: '六十秒', daily: '每日一果' };
  var ITEMS = [
    { key: 'lemon', fruit: 'f-lemon', name: '柠檬', desc: '果汁 +5 秒' },
    { key: 'cherry', fruit: 'f-cherry', name: '樱桃', desc: '提示能接的果子' },
    { key: 'melon', fruit: 'f-watermelon', name: '西瓜', desc: '跳过这一手' },
    { key: 'berry', fruit: 'f-strawberry', name: '草莓', desc: '15 秒双倍分' },
  ];
  window.__ERRORS__ = [];
  window.addEventListener('error', function (e) {
    window.__ERRORS__.push(String(e.message || e.error || 'error'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__ERRORS__.push('unhandledrejection: ' + String(e.reason));
  });

  var $ = function (id) { return document.getElementById(id); };
  var index = null;
  var state = null;
  var store = null;
  var save = null;
  var paused = false;
  var lastFrame = 0;
  var ui = {};
  var vine = { nodes: Art.vineNodes(), count: 0, paths: null, fruits: null, extra: 0 };
  var fx = { ctx: null, dpr: 1, parts: [], w: 0, h: 0 };
  var flags = { tickAt: 0, overShown: false, tapped: false, selftest: false };

  function safeStorage() {
    try {
      var s = window.localStorage;
      s.setItem('__probe__', '1');
      s.removeItem('__probe__');
      return s;
    } catch (e) {
      return null;
    }
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fruitSymbol(word) {
    var h = 0;
    for (var i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
    return Art.FRUITS[h % Art.FRUITS.length].symbol;
  }
  function fruitColor(word) {
    var h = 0;
    for (var i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
    return Art.FRUITS[h % Art.FRUITS.length].color;
  }
  function useTag(symbol, w, h) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#' + symbol + '" xlink:href="#' + symbol +
      '" width="100" height="100"></use></svg>';
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    index = Engine.buildIndex(DATA);
    store = Engine.createStore(safeStorage(), 'idiom-orchard-v1');
    save = Engine.loadSave(store);
    cacheUi();
    buildScenery();
    ui.brandMark.innerHTML = '<svg viewBox="0 0 100 100"><use href="#f-apple" xlink:href="#f-apple" width="100" height="100"></use>' +
      '<use href="#f-pear" xlink:href="#f-pear" x="46" y="34" width="58" height="58"></use></svg>';
    bind();
    renderChrome();
    newGame('endless');
    Audio.setEnabled({ sfx: save.sound, music: save.sound });
    document.body.classList.toggle('is-touch', matchMedia('(hover: none)').matches);
    requestAnimationFrame(frame);
    var demo = location.search.match(/demo=(\d+)/);
    var panel = (location.search.match(/panel=(\w+)/) || [])[1];
    if (location.search.indexOf('selftest') >= 0) { flags.selftest = true; setTimeout(runSelfTest, 60); }
    else if (demo) setTimeout(function () { autoPlayDemo(Number(demo[1])); }, 80);
    else if (panel === 'book') setTimeout(showBook, 120);
    else if (panel === 'help' || !save.tutorialDone) setTimeout(showHelp, 320);
    if (location.search.indexOf('metrics') >= 0) setTimeout(dumpMetrics, 420);
  }

  /** 布局诊断：?metrics=1 输出页面宽度与所有越界元素 */
  function dumpMetrics() {
    var out = {
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      bodyScrollW: document.body.scrollWidth,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      offenders: [],
    };
    Array.prototype.forEach.call(document.querySelectorAll('body *'), function (n) {
      var r = n.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right > window.innerWidth + 1 || r.left < -1) {
        var cls = typeof n.className === 'string' ? n.className.split(' ').slice(0, 2).join('.') : '';
        out.offenders.push({
          sel: n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (cls ? '.' + cls : ''),
          left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        });
      }
    });
    out.offenders = out.offenders.slice(0, 24);
    var pre = document.createElement('pre');
    pre.id = 'metrics';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }

  /** 演示/截图用：自动接 N 手，把界面跑到中局状态 */
  function autoPlayDemo(n) {
    var i = 0;
    var timer = setInterval(function () {
      if (i >= n || !state || state.status === 'over') { clearInterval(timer); return; }
      i++;
      if (state.status === 'fruit-round') {
        var v = state.fruitRound.options.filter(function (o) { return o.valid; });
        for (var k = 0; k < v.length && state.status === 'fruit-round'; k++) {
          var t = ui.basket.querySelector('[data-word="' + v[k].word + '"]');
          if (t) t.click(); else { Engine.submitFruitPick(index, state, v[k].word); pump(); renderAll(); }
        }
        return;
      }
      var opt = state.basket.options.filter(function (o) { return o.valid; })[0];
      if (!opt) return;
      var tag = ui.basket.querySelector('[data-word="' + opt.word + '"]');
      if (tag) tag.click();
      else submitAnswer(opt.word, false, null);
      state.juice = state.juiceMax;
      if (state.items.lemon > 0 && i === 2) state.items.cherry = Math.max(state.items.cherry, 1);
    }, 70);
  }

  function cacheUi() {
    ['app', 'stage', 'scenery', 'fx', 'floaties', 'sign', 'curWord', 'signNote', 'chainChar',
      'score', 'combo', 'comboWrap', 'best', 'bestChain', 'chainList', 'items', 'basket', 'fruitBar',
      'juice', 'juiceFill', 'juiceText', 'toast', 'banner', 'overlay', 'sheet', 'typeForm', 'typeInput',
      'suggest', 'btnRestart', 'btnSound', 'btnHelp', 'btnBook', 'bookCount', 'miniWords', 'miniRounds',
      'miniTyped', 'modes', 'brandMark'].forEach(function (id) {
      ui[id] = $(id);
    });
    fx.ctx = ui.fx.getContext('2d');
  }

  function buildScenery() {
    ui.scenery.innerHTML = Art.scene() +
      '<svg class="vine-layer" viewBox="0 0 600 460" aria-hidden="true">' +
      Art.trellis() +
      '<g id="vinePaths"></g><g id="vineFruits"></g></svg>';
    vine.paths = $('vinePaths');
    vine.fruits = $('vineFruits');
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    ui.modes.addEventListener('click', function (e) {
      var btn = e.target.closest('.mode');
      if (!btn) return;
      Audio.unlock();
      newGame(btn.dataset.mode);
    });
    ui.basket.addEventListener('click', function (e) {
      var tag = e.target.closest('.tag');
      if (!tag || tag.disabled) return;
      Audio.unlock();
      if (state.status === 'fruit-round') {
        fruitPick(tag.dataset.word, tag);
      } else {
        submitAnswer(tag.dataset.word, false, tag);
      }
    });
    ui.items.addEventListener('click', function (e) {
      var item = e.target.closest('.item');
      if (!item || item.disabled) return;
      useItem(item.dataset.item);
    });
    ui.typeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      Audio.unlock();
      var v = ui.typeInput.value.trim();
      if (!v) return;
      submitAnswer(v, true, null);
      ui.typeInput.value = '';
      hideSuggest();
    });
    ui.typeInput.addEventListener('input', function () {
      showSuggest(ui.typeInput.value.trim());
    });
    ui.typeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideSuggest();
    });
    ui.suggest.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      Audio.unlock();
      submitAnswer(b.dataset.word, true, null);
      ui.typeInput.value = '';
      hideSuggest();
      if (!matchMedia('(hover: none)').matches) ui.typeInput.focus();
    });
    ui.stage.addEventListener('click', function (e) {
      if (e.target.closest('.tag')) return;
      if (!flags.tapped) { Audio.unlock(); flags.tapped = true; }
      if (!matchMedia('(hover: none)').matches && state.status !== 'over') ui.typeInput.focus();
    });
    ui.btnRestart.addEventListener('click', function () { newGame(state.mode); });
    ui.btnHelp.addEventListener('click', showHelp);
    ui.btnBook.addEventListener('click', showBook);
    ui.btnSound.addEventListener('click', function () {
      save.sound = !save.sound;
      Audio.setEnabled({ sfx: save.sound, music: save.sound });
      persist();
      renderChrome();
      if (save.sound) Audio.play('tap');
    });
    ui.overlay.addEventListener('click', function (e) {
      if (e.target === ui.overlay || e.target.dataset.close !== undefined) closeSheet();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeSheet(); hideSuggest(); }
      if (e.target === ui.typeInput) return;
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        var it = ITEMS[Number(e.key) - 1];
        if (it) useItem(it.key);
      }
      if (e.key === '/') { e.preventDefault(); ui.typeInput.focus(); }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { lastFrame = performance.now(); }
    });
    window.addEventListener('resize', function () { fxResize(); });
  }

  /* ---------------- 开新局 ---------------- */
  function newGame(mode) {
    mode = mode || 'endless';
    var opts = { mode: mode };
    if (mode === 'daily') opts.seed = Engine.dailySeed(todayString());
    state = Engine.startGame(index, opts);
    vine.count = 0; vine.extra = 0;
    if (vine.paths) vine.paths.innerHTML = '';
    if (vine.fruits) vine.fruits.innerHTML = '';
    fx.parts.length = 0;
    ui.floaties.innerHTML = '';
    flags.overShown = false;
    flags.tickAt = 0;
    closeSheet();
    document.body.dataset.mode = mode;
    Array.prototype.forEach.call(ui.modes.querySelectorAll('.mode'), function (b) {
      b.setAttribute('aria-selected', String(b.dataset.mode === mode));
    });
    Engine.drainEvents(state);
    renderAll();
    pumpkin();
    setTimeout(function () { if (!matchMedia('(hover: none)').matches && state.status !== 'over') ui.typeInput.focus(); }, 120);
  }

  function todayString() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function pumpkin() {
    ui.stage.classList.toggle('fruit-mode', state.status === 'fruit-round');
    ui.sign.classList.toggle('fruit', state.status === 'fruit-round');
  }

  /* ---------------- 提交 / 判定 ---------------- */
  function submitAnswer(word, typed, tagEl) {
    if (!state || state.status === 'over' || state.status === 'fruit-round') return;
    var res = Engine.submit(index, state, word, { typed: typed });
    if (!res.ok) {
      if (tagEl) {
        tagEl.classList.add('wrongpick');
        tagEl.disabled = true;
        setTimeout(function () {
          tagEl.classList.remove('wrongpick');
          if (state.status === 'playing' && tagEl.isConnected) tagEl.disabled = false;
        }, 620);
      }
      if (res.reason === 'empty') Engine.drainEvents(state);
    } else if (tagEl) {
      tagEl.classList.add('picked');
      tagEl.disabled = true;
    } else if (typed) {
      var input = ui.typeInput;
      input.style.transition = 'none';
      input.style.borderColor = '#6aa84f';
      setTimeout(function () { input.style.transition = ''; input.style.borderColor = ''; }, 420);
    }
    pump();
    renderAll();
  }

  function fruitPick(word, tagEl) {
    var fr = state.fruitRound;
    var already = fr.found.indexOf(word) >= 0;
    if (already) return;
    var valid = fr.options.filter(function (o) { return o.word === word; })[0];
    var res = Engine.submitFruitPick(index, state, word);
    if (valid && valid.valid) {
      if (tagEl) tagEl.classList.add('correct');
    } else {
      if (tagEl) tagEl.classList.add('wrongpick');
    }
    pump();
    renderAll();
    if (!res.ok && !valid) {
      // 选错：亮出正确答案
      Array.prototype.forEach.call(ui.basket.querySelectorAll('.tag'), function (t) {
        var opt = fr.options.filter(function (o) { return o.word === t.dataset.word; })[0];
        if (opt && opt.valid) t.classList.add('hint');
      });
    }
  }

  function useItem(key) {
    if (!state || state.status === 'over') return;
    var res = Engine.useItem(index, state, key);
    if (!res.ok) {
      if (res.reason === 'none') toast('这个水果道具用完了', 'bad');
      else if (res.reason === 'busy') toast('这一手不能用西瓜', 'bad');
      return;
    }
    if (key === 'cherry' && state.hint) toast('樱桃标出了能接的果子', 'good');
    else toast(res.label, 'good');
    Audio.play('item');
    pump();
    renderAll();
  }

  /* ---------------- 事件消费 ---------------- */
  function pump() {
    var events = Engine.drainEvents(state);
    var lastBound = null;
    var missBanner = false;
    events.forEach(function (ev) {
      if (ev.type === 'correct') {
        Audio.play('correct', ev.combo);
        addVine(ev.word);
        var rect = ui.sign.getBoundingClientRect();
        var stageRect = ui.stage.getBoundingClientRect();
        var x = rect.left - stageRect.left + rect.width / 2;
        var y = rect.top - stageRect.top + rect.height - 4;
        burst(x, y, fruitColor(ev.word), ev.combo > 4 ? 13 : 9);
        float(x, y - 10, '+' + fmt(ev.gained), ev.kind === 'homo' ? '同音' : (ev.typed ? '手打' : ''));
        ui.sign.classList.remove('flash-ok');
        void ui.sign.offsetWidth;
        ui.sign.classList.add('flash-ok');
        ui.chainChar.classList.remove('bump');
        void ui.chainChar.offsetWidth;
        ui.chainChar.classList.add('bump');
        if (ev.combo >= 3) comboPop(ev.combo);
        if (ev.chainLength > 1 && (ev.chainLength - 1) % Engine.CONFIG.fruitRoundEvery === 0) {
          switchSeason();
        }
      } else if (ev.type === 'wrong') {
        Audio.play('wrong');
        toast(ev.message, 'bad');
        ui.sign.classList.remove('flash-bad');
        void ui.sign.offsetWidth;
        ui.sign.classList.add('flash-bad');
        var r2 = ui.sign.getBoundingClientRect(), s2 = ui.stage.getBoundingClientRect();
        burst(r2.left - s2.left + r2.width / 2, r2.top - s2.top + r2.height * 0.5, '#d8574a', 8);
      } else if (ev.type === 'notice') {
        Audio.play('soft');
        toast(ev.message, '');
      } else if (ev.type === 'harvest') {
        Audio.play('harvest');
        banner('丰收时刻 · 双倍分');
        fruitRain(18);
      } else if (ev.type === 'item') {
        Audio.play('item');
        toast('连击奖励：' + itemName(ev.item), 'good');
      } else if (ev.type === 'fruit-round-start') {
        Audio.play('fruitRound');
        banner('水果专场 · 找出含「' + ev.fruit + '」的成语');
        switchSeason();
      } else if (ev.type === 'fruit-hit') {
        Audio.play('fruitHit');
        addVine(null, ev.word);
        var r3 = ui.stage.getBoundingClientRect();
        burst(r3.width * 0.5, r3.height * 0.42, '#e8a63c', 18);
        float(r3.width * 0.5, r3.height * 0.36, '+120');
      } else if (ev.type === 'fruit-miss') {
        Audio.play('wrong');
        toast('「' + ev.word + '」里没有「' + ev.answer + '」', 'bad');
        if (ev.solutions && ev.solutions.length) {
          banner('正确答案：' + ev.solutions.join(' · '));
          missBanner = true;
        }
      } else if (ev.type === 'fruit-round-end') {
        if (ev.perfect) {
          banner('全中！果园大丰收');
          fruitRain(26);
          float(ui.stage.clientWidth * 0.5, ui.stage.clientHeight * 0.3, '+400', '奖励');
        } else if (!missBanner) {
          banner('专场结束 · 继续接龙');
        }
      } else if (ev.type === 'item-used') {
        // 已在 useItem 里提示
      } else if (ev.type === 'dead-end') {
        toast('这个字接不下去了，帮你自动接一条：' + ev.word, '');
        addVine(ev.word);
      } else if (ev.type === 'game-over') {
        Audio.play('gameOver');
        onGameOver();
      }
      if (ev.word) lastBound = ev.word;
    });
    return lastBound;
  }

  function itemName(key) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].key === key) return ITEMS[i].name;
    return '水果';
  }

  function onGameOver() {
    if (flags.overShown) return;
    flags.overShown = true;
    var unlocked = Engine.applyResult(save, state, index);
    persist();
    renderChrome();
    setTimeout(function () { showResult(unlocked); }, 620);
  }

  function persist() {
    if (!store) return;
    var ok = store.write(save);
    if (!ok && !flags.warnedStorage) {
      flags.warnedStorage = true;
      toast('这个浏览器不让本地存档，本局成绩只保存在内存里', '');
    }
  }

  /* ---------------- 渲染 ---------------- */
  function renderAll() {
    pumpkin();
    renderHud();
    renderSign();
    renderBasket();
    renderItems();
    renderChain();
  }

  function renderChrome() {
    ui.best.textContent = fmt(save.best[state ? state.mode : 'endless'] || 0);
    ui.bestChain.textContent = fmt(save.bestChain);
    ui.bookCount.textContent = fmt(save.collected.length);
    ui.btnSound.setAttribute('aria-pressed', String(!!save.sound));
  }

  function renderHud() {
    ui.score.textContent = fmt(state.score);
    ui.combo.textContent = state.combo > 0 ? '×' + state.combo : '0';
    ui.comboWrap.classList.toggle('hot', state.combo >= 5);
    var pct = state.juiceMax ? Math.max(0, Math.min(1, state.juice / state.juiceMax)) : 0;
    ui.juiceFill.style.width = (pct * 100).toFixed(1) + '%';
    ui.juice.classList.toggle('low', pct < 0.25 && state.status === 'playing');
    ui.juiceText.textContent = state.mode === 'timed'
      ? Math.max(0, state.juice).toFixed(1) + ' 秒'
      : '果汁 ' + Math.max(0, state.juice).toFixed(1) + 's';
    ui.miniWords.textContent = state.chain.length;
    ui.miniRounds.textContent = state.roundsDone;
    ui.miniTyped.textContent = state.stats.typed;
  }

  function renderSign() {
    var fr = state.fruitRound;
    if (state.status === 'fruit-round' && fr) {
      var names = {};
      for (var i = 0; i < DATA.fruits.length; i++) names[DATA.fruits[i].ch] = DATA.fruits[i].name;
      var sym = fruitSymbolForChar(fr.fruit);
      ui.curWord.innerHTML = '<span class="fruit-hero">' + useTag(sym) +
        '<span class="hero-text"><span class="hero-title">找出含「' + esc(fr.fruit) + '」的成语</span>' +
        '<span class="hero-sub">' + esc(names[fr.fruit] || '水果') + ' · 选中所有正确答案' +
        '<span class="dots">' + fr.options.filter(function (o) { return o.valid; }).map(function (o, idx) {
          return '<i class="' + (idx < fr.found.length ? 'on' : '') + '"></i>';
        }).join('') + '</span></span></span></span>';
      ui.signNote.textContent = '这一轮不计时，慢慢找';
      ui.chainChar.innerHTML = '<span class="cc-char">' + esc(fr.fruit) + '</span><span class="cc-py">水果专场</span>';
      return;
    }
    ui.curWord.textContent = state.current || '—';
    var py = Engine.pinyinOf(index, state.chainChar);
    ui.chainChar.innerHTML = '<span class="cc-char">' + esc(state.chainChar) + '</span><span class="cc-py">' +
      esc(py.length ? py.join('/') : '—') + '</span>';
    var note = state.mode === 'daily'
      ? '每日一果 · ' + todayString()
      : (state.combo >= 5 ? '手感正好，继续接' : '用「' + state.chainChar + '」开头接一条成语');
    ui.signNote.textContent = note;
  }

  function fruitSymbolForChar(ch) {
    for (var i = 0; i < DATA.fruits.length; i++) if (DATA.fruits[i].ch === ch) return DATA.fruits[i].symbol;
    return 'f-apple';
  }
  function fruitNameForChar(ch) {
    for (var i = 0; i < DATA.fruits.length; i++) if (DATA.fruits[i].ch === ch) return DATA.fruits[i].name;
    return '水果';
  }

  function renderBasket() {
    var fr = state.fruitRound;
    var round = state.status === 'fruit-round' && fr;
    ui.fruitBar.hidden = !round;
    var host = ui.basket;
    if (round) {
      ui.fruitBar.innerHTML = '<div class="mini-row" style="justify-content:center">找出含「' +
        esc(fr.fruit) + '」的成语 · 还要 ' + Math.max(0, fr.need - fr.found.length) + ' 个</div>';
      host.classList.add('is-fruit');
    } else {
      ui.fruitBar.innerHTML = '';
      host.classList.remove('is-fruit');
    }
    host.innerHTML = '';
    var options = round ? fr.options : (state.basket ? state.basket.options : []);
    options.forEach(function (opt) {
      var tag = el('button', 'tag');
      tag.type = 'button';
      tag.dataset.word = opt.word;
      var sym = fruitSymbol(opt.word);
      tag.innerHTML = useTag(sym) + '<span>' + esc(opt.word) + '</span>';
      if (!round && state.hint && state.hint.indexOf(opt.word) >= 0) tag.classList.add('hint');
      if (round && fr.found.indexOf(opt.word) >= 0) { tag.classList.add('correct'); tag.disabled = true; }
      if (state.status === 'over') tag.disabled = true;
      host.appendChild(tag);
    });
    if (!options.length) host.innerHTML = '<div class="mini-row" style="grid-column:1/-1">这一手没有可选的果子，用打字接吧</div>';
  }

  function renderItems() {
    ui.items.innerHTML = '';
    ITEMS.forEach(function (it, i) {
      var n = state.items[it.key] || 0;
      var b = el('button', 'item' + (n > 0 ? ' ready' : ''));
      b.type = 'button';
      b.dataset.item = it.key;
      b.disabled = n <= 0 || state.status === 'over';
      b.title = it.name + '：' + it.desc + '（快捷键 ' + (i + 1) + '）';
      b.innerHTML = useTag(it.fruit) + '<span>' + it.name + '</span><b>' + n + '</b>';
      ui.items.appendChild(b);
    });
  }

  function renderChain() {
    var words = state.chain;
    ui.chainList.innerHTML = '';
    var shown = words.slice(-40).reverse();
    shown.forEach(function (w, i) {
      var li = el('li', i === 0 ? 'fresh' : '');
      var head = w[0], tail = w[w.length - 1];
      var linked = state.answers.filter(function (a) { return a.word === w; })[0];
      li.className += linked && linked.kind === 'homo' ? ' homo' : '';
      li.innerHTML = esc(w) + ' <em>→ ' + esc(tail) + '</em>';
      ui.chainList.appendChild(li);
    });
  }

  /* ---------------- 藤蔓 ---------------- */
  function addVine(word, forceWord) {
    var i = vine.count;
    vine.count++;
    if (i >= vine.nodes.length) { vine.extra++; return; }
    var n = vine.nodes[i];
    var prev = i > 0 ? vine.nodes[i - 1] : null;
    if (prev) {
      var cx = (prev.x + n.x) / 2;
      var cy = (prev.y + n.y) / 2 - 14;
      var d = 'M' + prev.x + ' ' + prev.y + ' Q' + cx + ' ' + cy + ' ' + n.x + ' ' + n.y;
      ['vine-halo wet', 'vine-seg wet'].forEach(function (cls) {
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', cls);
        vine.paths.appendChild(path);
      });
    }
    var sym = (word || forceWord) ? fruitSymbol(word || forceWord) : Art.FRUITS[i % Art.FRUITS.length].symbol;
    var u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + sym);
    u.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + sym);
    u.setAttribute('x', n.x - 15);
    u.setAttribute('y', n.y - 17);
    u.setAttribute('width', 32);
    u.setAttribute('height', 32);
    u.setAttribute('class', 'vine-fruit');
    u.style.animationDelay = '0.04s';
    vine.fruits.appendChild(u);
    var leaf = document.createElementNS(NS, 'ellipse');
    leaf.setAttribute('cx', n.x + 14);
    leaf.setAttribute('cy', n.y - 6);
    leaf.setAttribute('rx', 9);
    leaf.setAttribute('ry', 5);
    leaf.setAttribute('fill', 'var(--leaf-1)');
    leaf.setAttribute('class', 'vine-leaf');
    leaf.setAttribute('transform', 'rotate(-18 ' + (n.x + 14) + ' ' + (n.y - 6) + ')');
    vine.fruits.appendChild(leaf);
  }

  /* ---------------- 季节 / 横幅 / 提示 ---------------- */
  function switchSeason() {
    var tier = Engine.tierOf(state);
    var season = SEASONS[(tier - 1) % SEASONS.length];
    if (document.body.classList.contains('season-' + season)) return;
    SEASONS.forEach(function (s) { document.body.classList.remove('season-' + s); });
    document.body.classList.add('season-' + season);
    if (!flags.seasonWarned) { flags.seasonWarned = true; }
    toast('果园换季了：' + { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[season] + '天', '');
  }

  var toastTimer = 0;
  function toast(msg, kind) {
    ui.toast.className = 'toast on' + (kind ? ' ' + kind : '');
    ui.toast.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.classList.remove('on'); }, 2100);
  }

  var bannerTimer = 0;
  function banner(text) {
    ui.banner.textContent = text;
    ui.banner.classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { ui.banner.classList.remove('on'); }, 2600);
  }

  function comboPop(combo) {
    var f = el('div', 'float');
    f.innerHTML = combo + '<small>连击</small>';
    f.style.left = '50%';
    f.style.top = '18%';
    f.style.transform = 'translateX(-50%)';
    f.style.fontSize = '30px';
    ui.floaties.appendChild(f);
    setTimeout(function () { f.remove(); }, 1200);
  }

  function float(x, y, text, sub) {
    var f = el('div', 'float');
    f.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    f.style.left = Math.round(x) + 'px';
    f.style.top = Math.round(y) + 'px';
    f.style.fontSize = '26px';
    f.style.transform = 'translate(-50%,-50%)';
    ui.floaties.appendChild(f);
    setTimeout(function () { f.remove(); }, 1200);
  }

  /* ---------------- 粒子 ---------------- */
  function fxResize() {
    var rect = ui.fx.getBoundingClientRect();
    fx.dpr = Math.min(2, window.devicePixelRatio || 1);
    fx.w = rect.width; fx.h = rect.height;
    ui.fx.width = Math.max(1, Math.round(rect.width * fx.dpr));
    ui.fx.height = Math.max(1, Math.round(rect.height * fx.dpr));
    fx.ctx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
  }

  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 70 + Math.random() * 170;
      fx.parts.push({
        type: 'drop', x: x, y: y,
        vx: Math.cos(a) * sp * 0.9, vy: Math.sin(a) * sp * 0.45 - 30,
        life: 0.42 + Math.random() * 0.3, age: 0,
        r: 2 + Math.random() * 3.4, color: color,
      });
    }
  }

  function fruitRain(n) {
    for (var i = 0; i < n; i++) {
      var f = Art.FRUITS[(Math.random() * Art.FRUITS.length) | 0];
      fx.parts.push({
        type: 'fruit',
        x: Math.random() * fx.w,
        y: -30 - Math.random() * 220,
        vx: (Math.random() - 0.5) * 52, vy: 130 + Math.random() * 150,
        life: 2.1, age: 0, r: 7 + Math.random() * 7,
        color: f.color, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 8,
      });
    }
  }

  function fxFrame(dt) {
    if (!fx.ctx) { fxResize(); return; }
    if (ui.fx.width !== Math.round(fx.w * fx.dpr) || ui.fx.height !== Math.round(fx.h * fx.dpr)) fxResize();
    var c = fx.ctx;
    c.clearRect(0, 0, fx.w, fx.h);
    if (!fx.parts.length) return;
    for (var i = fx.parts.length - 1; i >= 0; i--) {
      var p = fx.parts[i];
      p.age += dt;
      if (p.age >= p.life) { fx.parts.splice(i, 1); continue; }
      p.vy += (p.type === 'fruit' ? 420 : 900) * dt;
      if (p.type === 'fruit') p.vx *= 0.995;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'fruit') p.rot += p.spin * dt;
      var k = 1 - p.age / p.life;
      c.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.r * (p.type === 'fruit' ? 1 : k * 0.5 + 0.5), 0, Math.PI * 2);
      c.fill();
      if (p.type === 'fruit') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = '#5c9c3f';
        c.beginPath();
        c.ellipse(p.r * 0.7, -p.r * 0.7, p.r * 0.5, p.r * 0.24, -0.5, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  /* ---------------- 打字联想 ---------------- */
  function showSuggest(text) {
    if (!text || !/^[\u4e00-\u9fa5]+$/.test(text)) { hideSuggest(); return; }
    var pool = [];
    var exact = index.byFirst.get(text[0]) || [];
    for (var i = 0; i < exact.length; i++) {
      if (exact[i].indexOf(text) === 0) pool.push(exact[i]);
      if (pool.length > 60) break;
    }
    if (Engine.checkAnswer(index, state, text).ok && pool.indexOf(text) < 0) pool.unshift(text);
    pool.sort(function (a, b) { return index.commonness(b) - index.commonness(a); });
    pool = pool.slice(0, 8);
    if (!pool.length) { hideSuggest(); return; }
    ui.suggest.innerHTML = pool.map(function (w, idx) {
      var okLink = state.chainChar === w[0];
      var okHomo = !okLink && Engine.checkAnswer(index, state, w).ok;
      return '<button type="button" data-word="' + esc(w) + '" class="' + (idx === 0 ? 'sel ' : '') +
        (okLink || okHomo ? 'sug-ok' : '') + '"><span>' + esc(w) + '</span><small>' +
        (okLink ? '接得上' : okHomo ? '同音可接' : '接不上') + '</small></button>';
    }).join('');
    ui.suggest.hidden = false;
  }
  function hideSuggest() { ui.suggest.hidden = true; ui.suggest.innerHTML = ''; }

  /* ---------------- 面板 ---------------- */
  function openSheet(html) {
    ui.sheet.innerHTML = html;
    ui.overlay.hidden = false;
    paused = true;
  }
  function closeSheet() {
    if (ui.overlay.hidden) return;
    ui.overlay.hidden = true;
    ui.sheet.innerHTML = '';
    paused = false;
    if (save && !save.tutorialDone) { save.tutorialDone = true; persist(); }
  }

  function showHelp() {
    var inWeChat = /MicroMessenger/i.test(navigator.userAgent);
    openSheet(
      '<h2>怎么玩</h2>' +
      '<p>屏幕上挂着一个成语，你要接的下一个成语，<b>第一个字要跟它的最后一个字一样</b>。接对了，藤上就结一颗果子。</p>' +
      '<ul>' +
      '<li><b>同音也算接上</b>：上一句以「渴」结尾，你也可以用「可」开头的成语，只是分数打八折。</li>' +
      '<li><b>两种输入</b>：点下面的果篮（念不出来的生僻成语也能玩），或者直接在输入框打字 —— 打字多给 50% 分。</li>' +
      '<li><b>果汁条就是命</b>：接对回果汁，发呆掉果汁，掉光这一局就结束。</li>' +
      '<li><b>连击越长相隔越好吃</b>：连击每 5 次触发「丰收时刻」，8 秒内分数双倍。</li>' +
      '<li><b>水果专场</b>：每接 5 条成语来一轮，找出全部含指定水果字的成语，全中额外 +400 分。</li>' +
      '<li><b>水果道具</b>：柠檬加时、樱桃提示、西瓜跳过、草莓双倍分，快捷键 <kbd>1</kbd>–<kbd>4</kbd>。</li>' +
      '<li>三档难度会自动爬升：时间变短、干扰项变刁钻、果园一季一换。</li>' +
      '</ul>' +
      '<p style="margin-top:12px">' + (inWeChat
        ? '想让朋友一起刷果？点右上角 <b>···</b> → <b>发送给朋友</b>，对方点开就能直接玩，不用下载。'
        : '把这个链接发给朋友，对方点开就能直接玩，不用下载。') + '</p>' +
      '<div class="row"><button class="btn-primary" data-close="1">开始接龙</button>' +
      '<button class="btn-secondary" id="copyLink">复制游戏链接</button>' +
      '<button class="btn-secondary" data-close="1">知道了</button></div>'
    );
    var copy = $('copyLink');
    if (copy) copy.addEventListener('click', copyLink);
  }

  function copyLink() {
    var url = location.href.split('#')[0];
    // 剪贴板被浏览器拦住时的兜底：给一个可选中的链接，别用 prompt（会卡住无头浏览器）
    var manual = function () {
      openSheet(
        '<h2>复制链接</h2>' +
        '<p>长按或双击下面的链接 → 全选 → 复制，粘贴到微信就能发给朋友。</p>' +
        '<input class="book-search" id="shareUrl" readonly value="' + esc(url) + '" ' +
        'style="font-family:var(--font-num);font-size:13px;letter-spacing:0">' +
        '<div class="row"><button class="btn-primary" data-close="1">好，去发</button></div>'
      );
      var box = $('shareUrl');
      if (box) {
        box.focus();
        if (box.select) box.select();
      }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          toast('链接已复制，粘贴到微信就能发给朋友', 'good');
        }, manual);
        return;
      }
    } catch (e) { /* 落到下面的兜底 */ }
    manual();
  }

  function showBook() {
    var total = index.words.length;
    var got = save.collected.slice().sort();
    openSheet(
      '<h2>果园图鉴</h2>' +
      '<p>接过的成语都会收进图鉴，一共 ' + fmt(total) + ' 条成语等着你摘。</p>' +
      '<div class="score-grid">' +
      '<div class="score-cell"><span>已收集</span><b>' + fmt(got.length) + '</b></div>' +
      '<div class="score-cell"><span>收集进度</span><b>' + (got.length / total * 100).toFixed(1) + '%</b></div>' +
      '<div class="score-cell"><span>总对局</span><b>' + fmt(save.plays) + '</b></div>' +
      '<div class="score-cell"><span>累计接对</span><b>' + fmt(save.totalAnswers) + '</b></div>' +
      '</div>' +
      '<h3 style="margin-top:14px">成就 ' + save.achievements.length + '/' + Engine.ACHIEVEMENTS.length + '</h3>' +
      '<div class="ach-list">' + Engine.ACHIEVEMENTS.map(function (a) {
        var on = save.achievements.indexOf(a.id) >= 0;
        return '<div class="ach' + (on ? ' got' : '') + '">' + useTag(on ? 'f-cherry' : 'f-blueberry') +
          '<span><b>' + esc(a.name) + '</b><i>' + esc(a.desc) + '</i></span></div>';
      }).join('') + '</div>' +
      '<h3 style="margin-top:16px">我的果子（' + fmt(got.length) + '）</h3>' +
      '<input class="book-search" id="bookSearch" placeholder="搜索：输入一个字，比如「一」" aria-label="搜索已收集成语">' +
      '<div class="book-list" id="bookList"></div>' +
      '<div class="row"><button class="btn-secondary" data-close="1">收好</button></div>'
    );
    var list = $('bookList');
    var render = function (kw) {
      var items = kw ? got.filter(function (w) { return w.indexOf(kw) >= 0; }) : got;
      var shown = items.slice(0, 400);
      list.innerHTML = shown.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('') ||
        '<p>还没有收集到，去接几条成语吧。</p>';
      if (items.length > shown.length) {
        list.innerHTML += '<span>……还有 ' + (items.length - shown.length) + ' 条</span>';
      }
    };
    render('');
    $('bookSearch').addEventListener('input', function (e) { render(e.target.value.trim()); });
  }

  function showResult(unlocked) {
    var r = state.over || { score: state.score, chain: state.chain.length, maxCombo: state.maxCombo, longest: state.stats.longestChain, answers: state.stats.answers, mistakes: state.stats.mistakes, fruits: state.gainedFruits.length, rounds: state.roundsDone, elapsed: Math.round(state.elapsed) };
    var isBest = r.score >= (save.best[state.mode] || 0) && r.score > 0;
    var reason = r.reason === 'time' ? '六十秒到了' : '果汁喝完了';
    openSheet(
      '<h2>' + (isBest ? '新纪录！' : '这一局摘完了') + '</h2>' +
      '<p>' + reason + ' · ' + MODE_LABEL[state.mode] + ' · 用时 ' + r.elapsed + ' 秒' +
      (state.mode === 'daily' ? '（每日一果 · ' + todayStrSafe() + '）' : '') + '</p>' +
      '<div class="score-grid">' +
      '<div class="score-cell"><span>分数</span><b>' + fmt(r.score) + '</b></div>' +
      '<div class="score-cell"><span>最长链</span><b>' + fmt(r.longest) + '</b></div>' +
      '<div class="score-cell"><span>最高连击</span><b>×' + fmt(r.maxCombo) + '</b></div>' +
      '<div class="score-cell"><span>用词</span><b>' + fmt(r.answers) + '</b></div>' +
      '<div class="score-cell"><span>打字</span><b>' + fmt(state.stats.typed) + '</b></div>' +
      '<div class="score-cell"><span>水果专场</span><b>' + fmt(r.rounds) + '</b></div>' +
      '</div>' +
      '<p>果园里一共结出 <b>' + fmt(state.chain.length) + '</b> 颗果子，图鉴已收 ' + fmt(save.collected.length) + ' 条成语。</p>' +
      (unlocked.length ? '<h3 style="margin-top:12px">解锁成就</h3><div class="ach-list">' + unlocked.map(function (id) {
        var a = Engine.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
        return a ? '<div class="ach got">' + useTag('f-cherry') + '<span><b>' + esc(a.name) + '</b><i>' + esc(a.desc) + '</i></span></div>' : '';
      }).join('') + '</div>' : '') +
      '<div class="row">' +
      '<button class="btn-primary" id="again">再来一局</button>' +
      '<button class="btn-secondary" id="switchTimed">试试六十秒</button>' +
      '<button class="btn-secondary" id="openBook">看果园图鉴</button>' +
      '<button class="btn-secondary" id="resultShare">把链接发给朋友</button>' +
      '</div>'
    );
    $('again').addEventListener('click', function () { newGame(state.mode); });
    $('switchTimed').addEventListener('click', function () { newGame(state.mode === 'timed' ? 'endless' : 'timed'); });
    $('openBook').addEventListener('click', showBook);
    $('resultShare').addEventListener('click', copyLink);
  }

  function todayStrSafe() {
    try { return todayString(); } catch (e) { return ''; }
  }

  /* ---------------- 主循环 ---------------- */
  function frame(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    if (state && !paused && !document.hidden) {
      Engine.tick(index, state, dt);
      var events = pump();
      if (state.status === 'over' && !flags.overShown) onGameOver();
      renderHud();
      if (state.status === 'playing' && state.juice / state.juiceMax < 0.25) {
        flags.tickAt += dt;
        if (flags.tickAt > 0.9) { flags.tickAt = 0; Audio.play('tick'); }
      } else {
        flags.tickAt = 0;
      }
    }
    fxFrame(dt);
    requestAnimationFrame(frame);
  }

  /* ---------------- 自测（?selftest=1） ---------------- */
  async function runSelfTest() {
    var checks = [];
    var errs = [];
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    function tagOf(word) { return ui.basket.querySelector('[data-word="' + word + '"]'); }
    function finishFruitRoundSync() {
      var guard = 0;
      while (state.status === 'fruit-round' && guard++ < 20) {
        var v = state.fruitRound.options.filter(function (o) { return o.valid; })[0];
        if (!v) break;
        Engine.submitFruitPick(index, state, v.word);
        pump(); renderAll();
      }
    }
    async function check(name, fn) {
      try {
        var r = await fn();
        checks.push({ name: name, ok: r !== false });
      } catch (e) {
        checks.push({ name: name, ok: false, error: String(e && e.message || e) });
        errs.push(name + ': ' + (e && e.message));
      }
    }
    await check('页面初始渲染：木牌有字、果篮 6 个果子', function () {
      newGame('endless');
      return ui.curWord.textContent.length >= 2 &&
        ui.basket.querySelectorAll('.tag').length === Engine.CONFIG.basketSize;
    });
    await check('点击果篮正确项：分数上升、藤上结果、链条 +1', function () {
      var before = state.score, chainBefore = state.chain.length;
      var tag = Array.prototype.filter.call(ui.basket.querySelectorAll('.tag'), function (t) {
        return state.basket.options.filter(function (o) { return o.word === t.dataset.word; })[0].valid;
      })[0];
      tag.click();
      return state.score > before && state.chain.length === chainBefore + 1 &&
        vine.fruits.querySelectorAll('use').length >= 1;
    });
    await check('点错果子：连击清零、果汁减少、有提示', function () {
      state.combo = 4;
      var juiceBefore = state.juice;
      var tag = Array.prototype.filter.call(ui.basket.querySelectorAll('.tag'), function (t) {
        return !state.basket.options.filter(function (o) { return o.word === t.dataset.word; })[0].valid;
      })[0];
      tag.click();
      return state.combo === 0 && state.juice < juiceBefore && ui.toast.textContent.length > 0;
    });
    await check('打字输入：合法成语被接受并给 1.5 倍分', function () {
      ui.typeInput.value = state.basket.options.filter(function (o) { return o.valid; })[0].word;
      var before = state.score;
      ui.typeForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      return state.score > before && state.stats.typed === 1;
    });
    await check('联想列表：输入首字能给出候选', function () {
      ui.typeInput.value = state.chainChar;
      showSuggest(state.chainChar);
      var n = ui.suggest.querySelectorAll('button').length;
      hideSuggest();
      return n > 0;
    });
    await check('连续 40 手不断链：果篮始终可玩、无重复、DOM 同步', function () {
      for (var i = 0; i < 40; i++) {
        state.juice = state.juiceMax;
        if (state.status === 'fruit-round') {
          var fr = state.fruitRound;
          var valids = fr.options.filter(function (o) { return o.valid; });
          valids.slice(0, fr.need).forEach(function (o) { Engine.submitFruitPick(index, state, o.word); });
          pump(); renderAll();
          if (ui.basket.querySelectorAll('.tag').length !== Engine.CONFIG.basketSize) throw new Error('专场后果篮没重建');
          continue;
        }
        var opt = state.basket.options.filter(function (o) { return o.valid; })[0];
        if (!opt) throw new Error('第 ' + i + ' 手没有可选果子, chainChar=' + state.chainChar);
        Engine.submit(index, state, opt.word, { typed: false });
        pump(); renderAll();
        if (ui.basket.querySelectorAll('.tag').length !== Engine.CONFIG.basketSize) throw new Error('第 ' + i + ' 手后果篮数量不对');
        if (state.status === 'playing' && ui.curWord.textContent !== state.current) throw new Error('木牌与状态不同步：' + ui.curWord.textContent + ' != ' + state.current);
      }
      var uniq = {};
      state.used.forEach(function (w) { uniq[w] = 1; });
      if (Object.keys(uniq).length !== state.used.length) throw new Error('出现重复用词');
      return true;
    });
    await check('道具：四种都能用且不报错', function () {
      finishFruitRoundSync();
      state.items = { lemon: 3, cherry: 3, melon: 3, berry: 3 };
      state.basket = Engine.buildBasket(index, state, Engine.mulberry32(9));
      renderAll();
      ['lemon', 'cherry', 'melon', 'berry'].forEach(function (k) { useItem(k); });
      return state.doubleLeft > 0 && Array.isArray(state.hint) && state.hint.length > 0 &&
        state.items.lemon === 2 && state.items.berry === 2;
    });
    await check('水果专场：进入 / 选错扣时间并亮答案 / 全中回接龙', function () {
      newGame('endless');
      for (var i = 0; i < 30 && state.status === 'playing'; i++) {
        var opt = state.basket.options.filter(function (o) { return o.valid; })[0];
        Engine.submit(index, state, opt.word, {});
        pump(); renderAll();
        state.juice = state.juiceMax;
      }
      if (state.status !== 'fruit-round') throw new Error('没进入水果专场');
      if (!ui.fruitBar.textContent) throw new Error('没有显示专场提示');
      if (ui.basket.querySelectorAll('.tag').length !== Engine.CONFIG.basketSize) throw new Error('专场果篮数量不对');
      var wrong = state.fruitRound.options.filter(function (o) { return !o.valid; })[0];
      var solutions = state.fruitRound.options.filter(function (o) { return o.valid; }).map(function (o) { return o.word; });
      var tag = tagOf(wrong.word);
      if (!tag) throw new Error('找不到错误选项对应的果子');
      var before = state.juice;
      tag.click();
      var okMiss = state.juice < before && state.status === 'playing' &&
        ui.banner.textContent.indexOf('正确答案') >= 0 &&
        solutions.some(function (s) { return ui.banner.textContent.indexOf(s) >= 0; });
      // 再走一轮，验证全中奖励
      var perfect = false;
      for (var k = 0; k < 60 && state.status !== 'over'; k++) {
        if (state.status === 'fruit-round') {
          var valids = state.fruitRound.options.filter(function (o) { return o.valid; });
          valids.forEach(function (o) {
            if (state.status === 'fruit-round') { var t = tagOf(o.word); if (t) t.click(); }
          });
          if (state.perfectRounds > 0) { perfect = true; break; }
          continue;
        }
        var o2 = state.basket.options.filter(function (o) { return o.valid; })[0];
        if (!o2) break;
        Engine.submit(index, state, o2.word, {});
        pump(); renderAll();
        state.juice = state.juiceMax;
      }
      return okMiss && perfect;
    });
    await check('图鉴 / 玩法面板能打开关闭', function () {
      showHelp();
      var ok1 = !ui.overlay.hidden && ui.sheet.textContent.indexOf('怎么玩') >= 0;
      var shareBtn = $('copyLink');
      if (!shareBtn) throw new Error('玩法面板缺"复制游戏链接"按钮');
      shareBtn.click();
      closeSheet();
      showBook();
      var ok2 = !ui.overlay.hidden && ui.sheet.textContent.indexOf('果园图鉴') >= 0;
      closeSheet();
      return ok1 && ok2 && ui.overlay.hidden;
    });
    await check('音效引擎：初始化 + 全部音效不报错 + 开关能持久化', function () {
      Audio.init();
      var st = Audio.state();
      if (st.broken) throw new Error('AudioContext 不可用');
      ['tap', 'pick', 'correct', 'wrong', 'soft', 'harvest', 'fruitRound', 'fruitHit', 'item', 'tick', 'levelUp', 'gameOver']
        .forEach(function (name) { Audio.play(name, 6); });
      Audio.setEnabled({ sfx: false, music: false });
      var off = Audio.state();
      Audio.setEnabled({ sfx: true, music: true });
      ui.btnSound.click();
      var after = ui.btnSound.getAttribute('aria-pressed');
      var raw = store.read();
      ui.btnSound.click();
      return st.ready && !off.sfx && after === 'false' && raw && raw.sound === false;
    });
    await check('重开一局：状态彻底重置', function () {
      state.score = 9999; state.combo = 7;
      newGame('endless');
      return state.score === 0 && state.combo === 0 && state.chain.length === 1 &&
        vine.fruits.querySelectorAll('use').length === 0 && ui.chainList.querySelectorAll('li').length === 1;
    });
    await check('换模式：限时模式 60 秒、每日模式固定开局', function () {
      newGame('timed');
      var ok1 = state.juiceMax === 60;
      newGame('daily');
      var a = state.current;
      newGame('daily');
      var ok2 = a === state.current;
      newGame('endless');
      return ok1 && ok2;
    });
    await check('存档：写入 localStorage 后能读回', function () {
      save.collected.push('一心一意');
      save.best.endless = Math.max(save.best.endless, 4321);
      persist();
      var raw = store.read();
      return raw && raw.best.endless >= 4321 && raw.collected.indexOf('一心一意') >= 0;
    });
    await check('时间耗尽：自动结算并弹出结算面板', function () {
      newGame('endless');
      var tag = tagOf(state.basket.options.filter(function (o) { return o.valid; })[0].word);
      tag.click();
      Engine.tick(index, state, 999);
      pump();
      return sleep(800).then(function () {
        return state.status === 'over' && !ui.overlay.hidden &&
          ui.sheet.textContent.indexOf('再来一局') >= 0;
      });
    });
    var report = {
      url: location.href,
      passed: checks.filter(function (c) { return c.ok; }).length,
      total: checks.length,
      checks: checks,
      errors: window.__ERRORS__,
      notes: errs,
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    };
    window.__SELFTEST__ = report;
    var node = document.createElement('pre');
    node.id = 'selftest-report';
    node.textContent = JSON.stringify(report);
    node.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(node);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
