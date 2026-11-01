/* arm.js — your arm, sackcloth, seen from your own eyes.
   One forearm with a mitt swings in from the bottom right, pivoting off-screen where the elbow would be:
   it rises with the folded note, draws back close to your face, swings forward, lets go,
   follows through and drops out of frame. The idle hands get the same cloth. */
const Arm = (() => {
  const svg = document.getElementById('arm-svg');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  // ---- cloth: a tapered, stuffed limb with lumpy sides (base at 0,0 pointing up to 0,-len) ----
  function bone(len, w0, w1, seed) {
    const N = 16, L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, y = -len * u;
      const w = (w0 + (w1 - w0) * u) / 2;
      const bl = 1 + 0.07 * Math.sin(u * 9.0 + seed) + 0.05 * Math.sin(u * 17.3 + seed * 2.1) + 0.03 * Math.sin(u * 31 + seed * 3.3);
      const br = 1 + 0.07 * Math.sin(u * 8.3 + seed + 2) + 0.05 * Math.sin(u * 15.1 + seed * 1.7) + 0.03 * Math.sin(u * 27 + seed * 2.9);
      L.push([-w * bl, y]); R.push([w * br, y]);
    }
    const tipW = (w1 / 2) * 1.02, baseW = (w0 / 2) * 1.02;
    let d = `M ${L[0][0]} ${baseW * 0.9}`;
    for (const [x, y] of L) d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    d += ` A ${tipW.toFixed(1)} ${tipW.toFixed(1)} 0 0 1 ${R[N][0].toFixed(1)} ${R[N][1].toFixed(1)}`;
    for (let i = N; i >= 0; i--) d += ` L ${R[i][0].toFixed(1)} ${R[i][1].toFixed(1)}`;
    d += ` L ${R[0][0].toFixed(1)} ${baseW * 0.9} Z`;
    return d;
  }
  // one seam up the cloth, with a few stitches across it
  function seam(len, seed, from, to) {
    const sw = Math.sin(seed) * len * 0.05;
    return `M ${(-sw * 0.3).toFixed(1)} ${(-len * from).toFixed(1)} Q ${sw.toFixed(1)} ${(-len * (from + to) / 2).toFixed(1)} ${(sw * 0.2).toFixed(1)} ${(-len * to).toFixed(1)}`;
  }
  function ticks(len, seed, from, to, n, size) {
    const sw = Math.sin(seed) * len * 0.05;
    let d = '';
    for (let i = 0; i < n; i++) {
      const u = from + (to - from) * (i + 0.5) / n, y = len * u;
      const cx = -sw * 0.3 * (1 - u) + sw * 2 * u * (1 - u) + sw * 0.2 * u;
      const j = Math.sin(y * 0.37 + seed) * 2;
      d += ` M ${(cx - size + j).toFixed(1)} ${(-y - size * 0.4).toFixed(1)} L ${(cx + size + j).toFixed(1)} ${(-y + size * 0.4).toFixed(1)}`;
    }
    return d;
  }

  // the mitt, in a 900-tall unit space, wrist at the origin, fingers up. thumb to the left, pinching the note.
  const PALM = 'M -46 10 C -62 -34 -64 -94 -48 -136 C -36 -168 -10 -188 16 -184 C 44 -180 62 -144 60 -100 C 60 -68 52 -24 48 12 Z';
  const THUMB = 'M -14 -84 C -50 -100 -80 -82 -82 -56 C -84 -32 -62 -14 -40 -18 C -24 -22 -16 -52 -14 -84 Z';
  const PAPER = 'M -112 -156 L -82 -160 L -52 -157 L -22 -161 L 8 -158 L 12 -120 L 9 -84 L 13 -50 L -22 -47 L -52 -51 L -82 -48 L -112 -52 L -109 -84 L -113 -120 Z';
  const FOLD = 'M -112 -104 L 11 -104';

  // ---- build ----
  let W = 0, H = 0, k = 1, L = 0;
  const g = {};
  function build() {
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: 'sack', x: '-15%', y: '-15%', width: '130%', height: '130%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '3', seed: '7', result: 'n' }, f);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '10', xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    const f2 = el('filter', { id: 'sack-s', x: '-15%', y: '-15%', width: '130%', height: '130%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.06', numOctaves: '3', seed: '3', result: 'n' }, f2);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '7', xChannelSelector: 'R', yChannelSelector: 'G' }, f2);

    // the rim-lit copy behind, the dark cloth in front
    const rim = el('g', { class: 'arm-rim' }, svg);
    el('use', { href: '#arm-root' }, rim);
    const dark = el('g', { class: 'arm-dark' }, svg);
    g.root = el('g', { id: 'arm-root' }, dark);
    g.fore = el('path', { class: 'cloth', filter: 'url(#sack)' }, g.root);
    g.seam = el('path', { class: 'seam' }, g.root);
    g.ticks = el('path', { class: 'tick' }, g.root);
    g.hd = el('g', {}, g.root);
    g.palm = el('path', { class: 'cloth', d: PALM, filter: 'url(#sack)' }, g.hd);
    g.paper = el('g', { class: 'held' }, g.hd);
    el('path', { class: 'paper', d: PAPER }, g.paper);
    el('path', { class: 'fold', d: FOLD }, g.paper);
    g.thumb = el('path', { class: 'cloth', d: THUMB, filter: 'url(#sack)' }, g.hd);
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    k = Math.min(H, W * 1.3) / 900;             // the arm is sized off the height, unless the screen is narrow
    const U = k * 900;
    L = U * 0.9;                                // from the off-screen elbow to the wrist
    g.fore.setAttribute('d', bone(L, U * 0.2, U * 0.115, 2.7));
    g.seam.setAttribute('d', seam(L, 2.7, 0.3, 0.9));
    g.ticks.setAttribute('d', ticks(L, 2.7, 0.3, 0.9, 7, 7 * k));
    g.seam.setAttribute('stroke-width', (2.4 * k).toFixed(2));
    g.ticks.setAttribute('stroke-width', (1.8 * k).toFixed(2));
    pose(KEYS[0]);
  }

  // ---- posing: the arm pivots about a point below the bottom-right corner ----
  function pose(key) {
    const px = W * key.x, py = H * key.y;
    g.root.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${key.a.toFixed(2)}) scale(${key.s.toFixed(3)})`);
    g.hd.setAttribute('transform', `translate(0 ${(-L).toFixed(1)}) rotate(${key.r.toFixed(2)}) scale(${(k * 1.05).toFixed(3)})`);
    g.paper.style.opacity = key.p > 0.5 ? 1 : 0;
  }

  // ---- the throw: a = angle from straight up (positive leans right), s = how close it is to you,
  //      y = where the pivot sits (fraction of the height), r = the wrist ----
  const KEYS = [
    { t: 0.00, x: 0.90, a: 40,  s: 1.00, y: 1.60, r: 0,   p: 1 },
    { t: 0.65, x: 0.90, a: -26, s: 1.00, y: 1.26, r: -6,  p: 1, e: 'out' },     // up: the note, folded, in front of you
    { t: 1.25, x: 0.90, a: -28, s: 1.00, y: 1.25, r: -6,  p: 1, e: 'inout' },   // a last look
    { t: 1.72, x: 0.85, a: 4,   s: 1.14, y: 1.30, r: 24,  p: 1, e: 'inout' },   // draw back, close to your face
    { t: 1.84, x: 0.84, a: 7,   s: 1.16, y: 1.31, r: 28,  p: 1, e: 'out' },
    { t: 2.08, x: 0.90, a: -58, s: 0.90, y: 1.08, r: -34, p: 1, e: 'in' },      // the swing
    { t: 2.46, x: 0.92, a: -80, s: 0.82, y: 1.00, r: -50, p: 0, e: 'out' },     // follow through
    { t: 3.00, x: 0.92, a: -70, s: 0.86, y: 1.60, r: -40, p: 0, e: 'in' }       // and out of frame
  ];
  const RELEASE = 2.03;
  const EASE = {
    out: u => 1 - Math.pow(1 - u, 2.2),
    in: u => Math.pow(u, 2.4),
    inout: u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2,
    lin: u => u
  };
  let play = null;

  function start(h) {
    play = { t: 0, released: false, h: h || {} };
    svg.style.visibility = 'visible';
  }

  function tick(dt) {
    if (!play) return;
    play.t += dt;
    const t = play.t;
    let i = 1;
    while (i < KEYS.length - 1 && KEYS[i].t < t) i++;
    const a = KEYS[i - 1], b = KEYS[i];
    const u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    const e = EASE[b.e || 'lin'](u);
    pose({
      x: a.x + (b.x - a.x) * e,
      a: a.a + (b.a - a.a) * e, s: a.s + (b.s - a.s) * e,
      y: a.y + (b.y - a.y) * e, r: a.r + (b.r - a.r) * e,
      p: t < RELEASE ? 1 : 0
    });
    if (!play.released && t >= RELEASE) {
      play.released = true;
      const r = g.paper.getBoundingClientRect();
      if (play.h.onRelease) play.h.onRelease(r.left + r.width / 2, r.top + r.height / 2, r.width);
    }
    if (t >= KEYS[KEYS.length - 1].t) {
      const h = play.h; play = null;
      svg.style.visibility = 'hidden';
      if (h.onDone) h.onDone();
    }
  }

  // ---- the idle hands get the same cloth ----
  function dressHands() {
    document.querySelectorAll('.hand').forEach((hand, n) => {
      const seed = 4.1 + n * 1.9;
      const d = bone(312, 112, 74, seed);
      hand.querySelectorAll('.bone').forEach(p => p.setAttribute('d', d));
      const s = hand.querySelector('.seam'); if (s) s.setAttribute('d', seam(312, seed, 0.12, 0.62));
      const t = hand.querySelector('.tick'); if (t) t.setAttribute('d', ticks(312, seed, 0.12, 0.62, 4, 6));
    });
  }

  build();
  resize();
  dressHands();
  svg.style.visibility = 'hidden';
  addEventListener('resize', resize);

  return { start, tick, playing: () => !!play };
})();
