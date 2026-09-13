/* 成语果园 · 音效层：全部用 Web Audio 现场合成，不加载任何音频文件
 * 导出 window.OrchardAudio
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var sfxBus = null;
  var musicBus = null;
  var noiseBuffer = null;
  var enabled = { sfx: true, music: true };
  var bgmTimer = null;
  var bgmStep = 0;
  var nextNoteTime = 0;
  var started = false;
  var broken = false;

  // 五声音阶（宫调）：C D E G A
  var PENTA = [0, 2, 4, 7, 9];
  var BASE = 261.63; // C4

  function noteFreq(step) {
    var octave = Math.floor(step / PENTA.length);
    var semi = PENTA[((step % PENTA.length) + PENTA.length) % PENTA.length] + octave * 12;
    return BASE * Math.pow(2, semi / 12);
  }

  function makeNoise() {
    var len = Math.floor(ctx.sampleRate * 1.2);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }

  function init() {
    if (ctx || broken) return ctx;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error('no AudioContext');
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = enabled.sfx ? 0.85 : 0;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = enabled.music ? 0.3 : 0;
      musicBus.connect(master);
      noiseBuffer = makeNoise();
    } catch (e) {
      broken = true;
    }
    return ctx;
  }

  function unlock() {
    var c = init();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(function () {});
    if (!started) {
      started = true;
      if (enabled.music) startBGM();
    }
  }

  function now() {
    return ctx.currentTime;
  }

  /** 马林巴/八音盒质感的单音 */
  function tone(freq, opt) {
    if (!ctx || !enabled.sfx) return;
    opt = opt || {};
    var t0 = now() + (opt.delay || 0);
    var dur = opt.dur || 0.5;
    var gain = ctx.createGain();
    var out = opt.bus === 'music' ? musicBus : sfxBus;
    gain.connect(out);
    var osc = ctx.createOscillator();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opt.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opt.glide), t0 + dur);
    var peak = (opt.gain == null ? 0.3 : opt.gain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    if (opt.bell) {
      var o2 = ctx.createOscillator();
      var g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(freq * 3.01, t0);
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.exponentialRampToValueAtTime(peak * 0.22, t0 + 0.008);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
      o2.connect(g2); g2.connect(out);
      o2.start(t0); o2.stop(t0 + dur);
    }
  }

  function noise(opt) {
    if (!ctx || !enabled.sfx) return;
    opt = opt || {};
    var t0 = now() + (opt.delay || 0);
    var dur = opt.dur || 0.3;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = opt.filter || 'bandpass';
    filter.frequency.setValueAtTime(opt.freq || 1200, t0);
    if (opt.freqTo) filter.frequency.exponentialRampToValueAtTime(opt.freqTo, t0 + dur);
    filter.Q.value = opt.q == null ? 0.9 : opt.q;
    var gain = ctx.createGain();
    var out = opt.bus === 'music' ? musicBus : sfxBus;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opt.gain == null ? 0.2 : opt.gain, t0 + (opt.attack || 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(out);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  var SFX = {
    tap: function () {
      tone(520, { dur: 0.09, gain: 0.16, type: 'triangle' });
      noise({ dur: 0.06, gain: 0.08, freq: 2600, filter: 'highpass' });
    },
    hover: function () {
      tone(880, { dur: 0.05, gain: 0.05, type: 'triangle' });
    },
    pick: function () {
      tone(392, { dur: 0.16, gain: 0.2, type: 'triangle' });
      noise({ dur: 0.12, gain: 0.12, freq: 1800, freqTo: 700 });
    },
    correct: function (combo) {
      var c = Math.max(1, combo || 1);
      var step = Math.min(14, c + 4);
      tone(noteFreq(step), { dur: 0.42, gain: 0.26, bell: true });
      tone(noteFreq(step + 2), { dur: 0.34, gain: 0.16, delay: 0.055 });
      if (c >= 3) tone(noteFreq(step + 4) , { dur: 0.5, gain: 0.1, delay: 0.11 });
      noise({ dur: 0.16, gain: 0.08, freq: 3200, filter: 'highpass', delay: 0.02 });
    },
    wrong: function () {
      tone(150, { dur: 0.34, gain: 0.24, type: 'sine', glide: 96 });
      tone(112, { dur: 0.3, gain: 0.16, type: 'triangle', glide: 74, delay: 0.02 });
      noise({ dur: 0.22, gain: 0.14, freq: 420, filter: 'lowpass' });
    },
    soft: function () {
      tone(320, { dur: 0.18, gain: 0.14, type: 'sine', glide: 280 });
    },
    harvest: function () {
      for (var i = 0; i < 6; i++) {
        tone(noteFreq(7 + i), { dur: 0.6, gain: 0.2 - i * 0.014, delay: i * 0.075, bell: true });
      }
      noise({ dur: 1.1, gain: 0.1, freq: 5200, filter: 'highpass', attack: 0.2 });
    },
    fruitRound: function () {
      tone(noteFreq(9), { dur: 0.9, gain: 0.24, bell: true });
      tone(noteFreq(12), { dur: 0.8, gain: 0.16, delay: 0.12, bell: true });
      tone(noteFreq(16), { dur: 0.9, gain: 0.12, delay: 0.24, bell: true });
    },
    fruitHit: function () {
      tone(noteFreq(12), { dur: 0.3, gain: 0.22, bell: true });
    },
    item: function () {
      tone(noteFreq(10), { dur: 0.3, gain: 0.2, type: 'triangle' });
      tone(noteFreq(14), { dur: 0.28, gain: 0.14, delay: 0.08 });
    },
    tick: function () {
      tone(1180, { dur: 0.06, gain: 0.12 });
    },
    levelUp: function () {
      tone(noteFreq(6), { dur: 0.4, gain: 0.2, bell: true });
      tone(noteFreq(10), { dur: 0.45, gain: 0.15, delay: 0.09, bell: true });
    },
    gameOver: function () {
      [9, 6, 4, 2].forEach(function (n, i) {
        tone(noteFreq(n) / 2, { dur: 0.7, gain: 0.22 - i * 0.03, delay: i * 0.16 });
      });
      noise({ dur: 0.9, gain: 0.08, freq: 260, filter: 'lowpass', delay: 0.4 });
    },
  };

  function play(name, arg) {
    if (!enabled.sfx) return;
    if (!ctx) return;
    var fn = SFX[name];
    if (!fn) return;
    try { fn(arg); } catch (e) { /* 音效失败不影响游戏 */ }
  }

  /* ---------- 背景音乐：轻柔的八音盒琶音循环 ---------- */
  var PROGRESS = [[0, 2, 4, 7], [4, 6, 9, 11], [2, 5, 7, 9], [5, 7, 9, 12]];
  var barIndex = 0;

  function scheduleBGM() {
    if (!ctx || !enabled.music) return;
    var lookahead = 0.25;
    while (nextNoteTime < ctx.currentTime + lookahead) {
      var bar = Math.floor(bgmStep / 8) % PROGRESS.length;
      var chord = PROGRESS[bar];
      var stepInBar = bgmStep % 8;
      var noteIndex = stepInBar % chord.length;
      var octave = stepInBar >= 4 ? 12 : 0;
      var semi = chord[noteIndex] + octave;
      var f = BASE / 2 * Math.pow(2, semi / 12);
      var delay = Math.max(0, nextNoteTime - ctx.currentTime);
      tone(f, { dur: 0.9, gain: 0.085, delay: delay, bus: 'music', bell: true });
      if (stepInBar === 0) {
        tone(f / 2, { dur: 1.6, gain: 0.06, delay: delay, bus: 'music' });
      }
      if (stepInBar === 4) {
        noise({ dur: 0.3, gain: 0.02, freq: 6000, filter: 'highpass', delay: delay, bus: 'music' });
      }
      nextNoteTime += 0.34;
      bgmStep++;
      if (bar !== barIndex) barIndex = bar;
    }
  }

  function startBGM() {
    if (!ctx || bgmTimer) return;
    nextNoteTime = ctx.currentTime + 0.2;
    bgmTimer = setInterval(scheduleBGM, 60);
    scheduleBGM();
  }
  function stopBGM() {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  function setEnabled(opts) {
    if (typeof opts.sfx === 'boolean') {
      enabled.sfx = opts.sfx;
      if (sfxBus) sfxBus.gain.value = opts.sfx ? 0.85 : 0;
    }
    if (typeof opts.music === 'boolean') {
      enabled.music = opts.music;
      if (musicBus) musicBus.gain.value = opts.music ? 0.3 : 0;
      if (opts.music) startBGM(); else stopBGM();
    }
  }

  function state() {
    return { sfx: enabled.sfx, music: enabled.music, ready: !!ctx, broken: broken };
  }

  root.OrchardAudio = {
    init: init,
    unlock: unlock,
    play: play,
    setEnabled: setEnabled,
    startBGM: startBGM,
    stopBGM: stopBGM,
    state: state,
    _sfx: SFX,
  };
})(typeof window !== 'undefined' ? window : globalThis);
