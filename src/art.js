/* 成语果园 · 美术层：全部是手写 SVG，无外部素材
 * 导出 window.OrchardArt
 */
(function (root) {
  'use strict';

  var FRUITS = [
    { key: 'apple', name: '苹果', symbol: 'f-apple', color: '#e4543a', deep: '#b22f22' },
    { key: 'strawberry', name: '草莓', symbol: 'f-strawberry', color: '#e8455f', deep: '#a8203b' },
    { key: 'peach', name: '桃子', symbol: 'f-peach', color: '#f79a86', deep: '#e06a5c' },
    { key: 'pear', name: '雪梨', symbol: 'f-pear', color: '#cbd94f', deep: '#93a42c' },
    { key: 'orange', name: '橘子', symbol: 'f-orange', color: '#f5a623', deep: '#cf7a10' },
    { key: 'lemon', name: '柠檬', symbol: 'f-lemon', color: '#f6d13c', deep: '#d4a80f' },
    { key: 'watermelon', name: '西瓜', symbol: 'f-watermelon', color: '#e6455a', deep: '#2f8f46' },
    { key: 'grape', name: '葡萄', symbol: 'f-grape', color: '#8b5cc7', deep: '#5f3a95' },
    { key: 'cherry', name: '樱桃', symbol: 'f-cherry', color: '#cf2b3f', deep: '#8f1626' },
    { key: 'blueberry', name: '蓝莓', symbol: 'f-blueberry', color: '#4a67c8', deep: '#2c3f8f' },
  ];

  var GRADIENTS =
    '<linearGradient id="g-red" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#ff8a6b"/><stop offset=".55" stop-color="#e4543a"/><stop offset="1" stop-color="#a82a1e"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-straw" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#ff7d92"/><stop offset=".5" stop-color="#e8455f"/><stop offset="1" stop-color="#a01f38"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-peach" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#ffd0b8"/><stop offset=".55" stop-color="#f79a86"/><stop offset="1" stop-color="#d9655a"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-pear" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#e9f27e"/><stop offset=".5" stop-color="#cbd94f"/><stop offset="1" stop-color="#8b9a26"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-orange" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#ffcb5c"/><stop offset=".6" stop-color="#f5a623"/><stop offset="1" stop-color="#c06f0c"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-lemon" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#fff3a8"/><stop offset=".55" stop-color="#f6d13c"/><stop offset="1" stop-color="#c99f0c"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-grape" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#b28ce8"/><stop offset=".5" stop-color="#8b5cc7"/><stop offset="1" stop-color="#4e2d80"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-cherry" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#f0576b"/><stop offset=".5" stop-color="#cf2b3f"/><stop offset="1" stop-color="#7d1020"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-blue" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#7f9bea"/><stop offset=".5" stop-color="#4a67c8"/><stop offset="1" stop-color="#26357a"/>' +
    '</linearGradient>' +
    '<radialGradient id="g-watermelon" cx=".5" cy=".12" r=".95">' +
    '<stop offset="0" stop-color="#ff7a86"/><stop offset=".7" stop-color="#e6455a"/><stop offset="1" stop-color="#c32b41"/>' +
    '</radialGradient>' +
    '<linearGradient id="g-wood" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="#d9a05b"/><stop offset=".45" stop-color="#c1854a"/><stop offset="1" stop-color="#a4682f"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-trunk" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="#9a6134"/><stop offset=".5" stop-color="#7d4a20"/><stop offset="1" stop-color="#5c3414"/>' +
    '</linearGradient>' +
    '<linearGradient id="g-sky-spring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6f7"/><stop offset="1" stop-color="#eef7dc"/></linearGradient>' +
    '<linearGradient id="g-sky-summer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd4f2"/><stop offset="1" stop-color="#f0f8d6"/></linearGradient>' +
    '<linearGradient id="g-sky-autumn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fc9e6"/><stop offset=".55" stop-color="#e6e3c4"/><stop offset="1" stop-color="#ffe6b8"/></linearGradient>' +
    '<linearGradient id="g-sky-winter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ef"/><stop offset="1" stop-color="#f6f8fb"/></linearGradient>' +
    '<radialGradient id="g-vignette" cx=".5" cy=".44" r=".8">' +
    '<stop offset=".5" stop-color="#3a2a1d" stop-opacity="0"/><stop offset="1" stop-color="#3a2a1d" stop-opacity=".32"/>' +
    '</radialGradient>';

  function symbol(id, body) {
    return '<symbol id="' + id + '" viewBox="0 0 100 100">' + body + '</symbol>';
  }

  var HL = '<ellipse cx="38" cy="42" rx="8" ry="12" fill="#fff" opacity=".38" transform="rotate(-24 38 42)"/>';
  var HL_S = '<ellipse cx="40" cy="46" rx="5" ry="7" fill="#fff" opacity=".45" transform="rotate(-24 40 46)"/>';
  var LEAF = '<path d="M50 26c1-9 7-15 17-16-1 10-7 16-17 16z" fill="#5c9c3f"/><path d="M50 26c-1-8-6-13-14-14 1 9 6 14 14 14z" fill="#79b657"/>';
  var STEM = '<path d="M50 30c0-6 1-9 3-13" stroke="#7d4a20" stroke-width="3.4" fill="none" stroke-linecap="round"/>';

  var SYMBOLS =
    symbol('f-apple',
      '<path d="M50 30c-8-11-31-13-38 4-8 20 6 44 20 50 6 3 11-2 18-2s12 5 18 2c14-6 28-30 20-50-7-17-30-15-38-4z" fill="url(#g-red)"/>' +
      HL + STEM + LEAF) +
    symbol('f-strawberry',
      '<path d="M50 92c-18 0-34-20-36-38-1-12 10-22 24-22h24c14 0 25 10 24 22-2 18-18 38-36 38z" fill="url(#g-straw)"/>' +
      '<g fill="#ffe9a8" opacity=".95">' +
      '<ellipse cx="38" cy="52" rx="2.4" ry="3.4"/><ellipse cx="54" cy="48" rx="2.4" ry="3.4"/>' +
      '<ellipse cx="46" cy="64" rx="2.4" ry="3.4"/><ellipse cx="62" cy="60" rx="2.4" ry="3.4"/>' +
      '<ellipse cx="34" cy="68" rx="2.4" ry="3.4"/><ellipse cx="50" cy="78" rx="2.4" ry="3.4"/>' +
      '</g>' +
      '<path d="M30 34c4-8 12-12 20-12s16 4 20 12c-6 4-13 6-20 6s-14-2-20-6z" fill="#4f8a3a"/>' +
      '<path d="M50 22l2-10" stroke="#4f8a3a" stroke-width="4" stroke-linecap="round"/>' +
      '<ellipse cx="38" cy="60" rx="6" ry="10" fill="#fff" opacity=".22" transform="rotate(-18 38 60)"/>') +
    symbol('f-peach',
      '<path d="M50 30c-6 0-12-6-22-6C15 24 8 40 10 55c3 22 22 37 40 37s37-15 40-37c2-15-5-31-18-31-10 0-16 6-22 6z" fill="url(#g-peach)"/>' +
      '<path d="M50 30c1 18 0 42-4 60" stroke="#e07a68" stroke-width="2.6" fill="none" opacity=".7"/>' +
      HL + STEM + LEAF) +
    symbol('f-pear',
      '<path d="M50 90c-16 0-27-13-27-28 0-12 9-18 12-28 3-9 5-14 15-14s12 5 15 14c3 10 12 16 12 28 0 15-11 28-27 28z" fill="url(#g-pear)"/>' +
      '<ellipse cx="41" cy="62" rx="6" ry="12" fill="#fff" opacity=".3" transform="rotate(-12 41 62)"/>' +
      STEM + LEAF) +
    symbol('f-orange',
      '<circle cx="50" cy="58" r="33" fill="url(#g-orange)"/>' +
      '<path d="M50 25c0-4 2-7 5-9" stroke="#8a5a1e" stroke-width="3" fill="none"/>' +
      '<ellipse cx="40" cy="74" rx="8" ry="6" fill="#fff" opacity=".18"/>' +
      HL_S + LEAF) +
    symbol('f-lemon',
      '<path d="M22 72c-8-16-2-38 14-46 14-8 34-2 42 12 8 14 3 33-11 42-15 10-37 6-45-8z" fill="url(#g-lemon)"/>' +
      '<path d="M22 72c-4-6-4-10-2-16M78 26c4 6 4 10 2 16" stroke="#c99f0c" stroke-width="3" fill="none"/>' +
      HL_S + '<ellipse cx="36" cy="42" rx="7" ry="10" fill="#fff" opacity=".34" transform="rotate(-30 36 42)"/>') +
    symbol('f-watermelon',
      '<path d="M8 62c0-26 19-45 42-45s42 19 42 45z" fill="#2f8f46"/>' +
      '<path d="M14 60c0-23 16-39 36-39s36 16 36 39z" fill="#f7f3e2"/>' +
      '<path d="M19 58c0-20 14-34 31-34s31 14 31 34z" fill="url(#g-watermelon)"/>' +
      '<g fill="#3a2b20" opacity=".85">' +
      '<ellipse cx="34" cy="44" rx="2.6" ry="3.6" transform="rotate(-14 34 44)"/>' +
      '<ellipse cx="50" cy="38" rx="2.6" ry="3.6"/>' +
      '<ellipse cx="64" cy="46" rx="2.6" ry="3.6" transform="rotate(14 64 46)"/>' +
      '<ellipse cx="42" cy="55" rx="2.6" ry="3.6" transform="rotate(-8 42 55)"/>' +
      '<ellipse cx="58" cy="56" rx="2.6" ry="3.6" transform="rotate(8 58 56)"/>' +
      '</g>' +
      '<path d="M22 36c8-9 18-13 29-13" stroke="#fff" stroke-width="4" opacity=".3" fill="none" stroke-linecap="round"/>') +
    symbol('f-grape',
      '<g fill="url(#g-grape)">' +
      '<circle cx="38" cy="44" r="11"/><circle cx="58" cy="42" r="11"/><circle cx="48" cy="58" r="11"/>' +
      '<circle cx="34" cy="64" r="11"/><circle cx="62" cy="62" r="11"/><circle cx="48" cy="76" r="11"/>' +
      '<circle cx="48" cy="30" r="10"/></g>' +
      '<path d="M48 24c2-8 8-12 16-13" stroke="#7d4a20" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="66" cy="24" rx="10" ry="6" fill="#79b657" transform="rotate(20 66 24)"/>' +
      '<ellipse cx="40" cy="40" rx="3" ry="4" fill="#fff" opacity=".4"/>' +
      '<ellipse cx="50" cy="54" rx="3" ry="4" fill="#fff" opacity=".32"/>') +
    symbol('f-cherry',
      '<path d="M52 40C54 26 62 18 74 16" stroke="#5c9c3f" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M46 42C42 30 36 24 28 20" stroke="#5c9c3f" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
      '<circle cx="34" cy="66" r="20" fill="url(#g-cherry)"/>' +
      '<circle cx="70" cy="70" r="17" fill="url(#g-cherry)"/>' +
      '<ellipse cx="27" cy="58" rx="4.5" ry="6" fill="#fff" opacity=".4" transform="rotate(-24 27 58)"/>' +
      '<ellipse cx="64" cy="63" rx="4" ry="5.5" fill="#fff" opacity=".36" transform="rotate(-24 64 63)"/>' +
      '<path d="M68 22c6-6 15-8 22-6-4 7-13 10-22 6z" fill="#79b657"/>') +
    symbol('f-blueberry',
      '<g fill="url(#g-blue)">' +
      '<circle cx="38" cy="60" r="19"/><circle cx="61" cy="52" r="16"/><circle cx="66" cy="72" r="14"/>' +
      '</g>' +
      '<g fill="#dfe6ff" opacity=".55">' +
      '<path d="M38 52l3 4 5 1-4 3 1 5-5-3-4 3 1-5-4-3 5-1z"/>' +
      '<path d="M61 45l2.6 3.4 4.4.9-3.4 2.6.8 4.4-4.4-2.6-3.7 2.6.7-4.4-3.4-2.6 4.4-.9z"/>' +
      '</g>' +
      '<ellipse cx="31" cy="53" rx="4" ry="6" fill="#fff" opacity=".34" transform="rotate(-28 31 53)"/>');

  // 水果形状 + 果汁颜色（粒子用）
  function sprite() {
    return '<svg id="art-sprite" aria-hidden="true" focusable="false" ' +
      'style="position:absolute;width:0;height:0;overflow:hidden">' +
      '<defs>' + GRADIENTS + '</defs>' + SYMBOLS + '</svg>';
  }

  /* ---------- 果园场景 ---------- */
  var CLOUD = '<path d="M0 22c0-9 7-16 16-16 5-9 20-9 26 0 9 0 15 7 15 16H0z" fill="#fff" opacity=".85"/>';

  function tree(x, y, scale, tone) {
    function u(sym, px, py, size) {
      return '<use href="#' + sym + '" xlink:href="#' + sym + '" x="' + px + '" y="' + py +
        '" width="' + size + '" height="' + size + '"/>';
    }
    var g = '<g transform="translate(' + x + ',' + y + ') scale(' + scale + ')" class="tree tree-' + tone +
      '"' + (tone === 'far' ? ' opacity=".78"' : '') + '>';
    return g +
      '<path class="trunk" d="M0 0c-4-30-6-58-4-88 2-24 10-38 22-52-14 20-18 34-16 54 2 22 6 52 10 86z" fill="url(#g-trunk)"/>' +
      '<path class="branch" d="M-2-70c-16-10-30-14-48-16 20-2 36 2 50 12z" fill="#7d4a20"/>' +
      '<path class="branch" d="M4-96c14-12 30-18 50-20-20 6-34 14-48 24z" fill="#7d4a20"/>' +
      '<g class="canopy">' +
      '<ellipse cx="-40" cy="-132" rx="52" ry="42" fill="var(--leaf-2)"/>' +
      '<ellipse cx="34" cy="-140" rx="56" ry="44" fill="var(--leaf-2)"/>' +
      '<ellipse cx="-4" cy="-166" rx="64" ry="48" fill="var(--leaf-1)"/>' +
      '<ellipse cx="-66" cy="-160" rx="38" ry="32" fill="var(--leaf-1)"/>' +
      '<ellipse cx="54" cy="-172" rx="40" ry="34" fill="var(--leaf-1)"/>' +
      '<ellipse cx="-20" cy="-196" rx="34" ry="26" fill="var(--leaf-1)" opacity=".92"/>' +
      '</g>' +
      '<g class="tree-fruit">' +
      u('f-apple', -72, -176, 26) +
      u('f-orange', -18, -150, 24) +
      u('f-pear', 40, -160, 26) +
      u('f-peach', 4, -198, 28) +
      u('f-cherry', -52, -118, 24) +
      '</g></g>';
  }

  function bush(x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<ellipse cx="0" cy="0" rx="42" ry="22" fill="var(--leaf-2)"/>' +
      '<ellipse cx="-16" cy="-8" rx="26" ry="18" fill="var(--leaf-1)"/>' +
      '<ellipse cx="20" cy="-4" rx="22" ry="15" fill="var(--leaf-1)"/>' +
      '</g>';
  }

  /** 果园背景（季节靠 CSS 变量切换颜色） */
  function scene() {
    return '<svg class="scene" id="art-scene" viewBox="0 0 600 460" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<rect class="sky" width="600" height="460" fill="var(--sky)"/>' +
      '<circle class="sun-glow" cx="468" cy="78" r="86" fill="var(--sun)" opacity=".26"/>' +
      '<circle class="sun" cx="468" cy="78" r="40" fill="var(--sun)"/>' +
      '<g class="cloud cloud-a" transform="translate(64 54) scale(1.05)">' + CLOUD + '</g>' +
      '<g class="cloud cloud-b" transform="translate(286 30) scale(.7)">' + CLOUD + '</g>' +
      '<g class="cloud cloud-c" transform="translate(150 104) scale(.52)">' + CLOUD + '</g>' +
      '<path class="hill-far" d="M0 322c66-40 128-56 196-44 58 10 98 36 152 32 60-4 118-34 252-10v160H0z" fill="var(--hill-far)"/>' +
      '<g opacity=".5">' +
      '<path d="M40 318l14-22 14 22zM84 314l12-18 12 18zM470 312l13-20 13 20zM518 316l11-16 11 16z" fill="var(--leaf-2)"/>' +
      '</g>' +
      '<path class="hill-mid" d="M0 372c84-28 146-24 212-6 62 16 118 6 176-12 66-22 128-14 212 10v96H0z" fill="var(--hill-mid)"/>' +
      tree(300, 412, .5, 'far') +
      tree(96, 416, 1, 'left') +
      tree(528, 412, .84, 'right') +
      bush(214, 424, .82) + bush(392, 428, .96) + bush(300, 432, .7) +
      '<g class="fence" stroke="var(--wood-dark)" stroke-width="3" opacity=".38">' +
      '<path d="M14 424v-26M40 428v-28M66 432v-28"/>' +
      '<path d="M6 412h72M6 400h72" stroke-width="2.2"/>' +
      '</g>' +
      '<rect class="ground" y="436" width="600" height="24" fill="var(--ground)"/>' +
      '<rect width="600" height="460" fill="url(#g-vignette)" opacity=".5" pointer-events="none"/>' +
      '</svg>';
  }

  /** 藤蔓节点位置：每行 12 个，最多 5 行 */
  function vineNodes() {
    var rows = 5;
    var perRow = 12;
    var out = [];
    for (var r = 0; r < rows; r++) {
      var y = 338 - r * 58;
      var dir = r % 2 === 0 ? 1 : -1;
      for (var i = 0; i < perRow; i++) {
        var t = i / (perRow - 1);
        var x = dir > 0 ? 48 + t * 504 : 552 - t * 504;
        var yy = y + Math.sin(t * Math.PI) * (r % 2 === 0 ? -12 : 12);
        out.push({ x: Math.round(x * 10) / 10, y: Math.round(yy * 10) / 10 });
      }
    }
    return out;
  }

  /** 棚架：两根立柱 + 上下两道横梁，别抢藤蔓的戏 */
  function trellis() {
    return '<g class="trellis" opacity=".92">' +
      '<rect x="24" y="86" width="11" height="348" rx="5" fill="url(#g-wood)"/>' +
      '<rect x="565" y="86" width="11" height="348" rx="5" fill="url(#g-wood)"/>' +
      '<rect x="20" y="92" width="560" height="9" rx="4" fill="url(#g-wood)"/>' +
      '<rect x="20" y="330" width="560" height="7" rx="3.5" fill="url(#g-wood)" opacity=".75"/>' +
      '<path d="M30 402h540" stroke="var(--wood-dark)" stroke-width="2" stroke-dasharray="7 9" opacity=".28"/>' +
      '<path d="M30 214h540" stroke="var(--wood-dark)" stroke-width="2" stroke-dasharray="7 9" opacity=".18"/>' +
      '</g>';
  }

  root.OrchardArt = {
    FRUITS: FRUITS,
    sprite: sprite,
    scene: scene,
    trellis: trellis,
    vineNodes: vineNodes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
