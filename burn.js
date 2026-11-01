/* burn.js — renders the message onto a scrap of paper, throws it into the fire,
   then eats it pixel by pixel from the corner nearest the flames. */
const Burn = (() => {
  const canvas = document.getElementById('burn');
  const ctx = canvas.getContext('2d');
  const PW = 640, PH = 400;              // paper resolution
  const paper = document.createElement('canvas');
  paper.width = PW; paper.height = PH;
  const pctx = paper.getContext('2d', { willReadFrequently: true });

  let W = 0, H = 0;
  let src = null, out = null, thr = null;
  let state = 'idle';
  let fly = null, burnT = 0, L = 0, time = 0;
  const pos = { x: 0, y: 0, rot: 0, scale: 1, flip: 1 };
  let handlers = {};
  const R = Math.random;

  function resize() { W = innerWidth; H = innerHeight; canvas.width = W; canvas.height = H; }
  addEventListener('resize', resize);
  resize();

  // ---------- value noise -> burn threshold field ----------
  function makeField() {
    const f = new Float32Array(PW * PH);
    const octs = [[58, 0.5], [24, 0.32], [9, 0.18]].map(([c, w]) => {
      const gw = Math.ceil(PW / c) + 2, gh = Math.ceil(PH / c) + 2;
      const a = new Float32Array(gw * gh);
      for (let i = 0; i < a.length; i++) a[i] = R();
      return { c, w, gw, a };
    });
    for (let y = 0; y < PH; y++) {
      for (let x = 0; x < PW; x++) {
        let v = 0;
        for (const o of octs) {
          const gx = x / o.c, gy = y / o.c;
          const i0 = gx | 0, j0 = gy | 0;
          let fx = gx - i0, fy = gy - j0;
          fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
          const a = o.a, w = o.gw;
          const n00 = a[j0 * w + i0], n10 = a[j0 * w + i0 + 1];
          const n01 = a[(j0 + 1) * w + i0], n11 = a[(j0 + 1) * w + i0 + 1];
          v += (n00 + (n10 - n00) * fx + (n01 - n00) * fy + (n00 - n10 - n01 + n11) * fx * fy) * o.w;
        }
        f[y * PW + x] = v;
      }
    }
    // ignition: bottom-right corner (nearest the fire), a weaker one bottom-left
    const ax = PW * (0.82 + R() * 0.12), ay = PH * 0.97;
    const bx = PW * (0.05 + R() * 0.12), by = PH * 1.0;
    const maxd = Math.hypot(PW, PH);
    let lo = 1e9, hi = -1e9;
    for (let y = 0; y < PH; y++) {
      for (let x = 0; x < PW; x++) {
        const i = y * PW + x;
        const d = Math.min(Math.hypot(x - ax, y - ay), Math.hypot(x - bx, y - by) * 1.35) / maxd;
        const edge = Math.min(x, PW - 1 - x, y, PH - 1 - y);
        const edgeBias = edge < 28 ? (1 - edge / 28) * 0.09 : 0;
        const t = f[i] * 0.42 + d * 0.58 - edgeBias;
        f[i] = t;
        if (t < lo) lo = t; if (t > hi) hi = t;
      }
    }
    for (let i = 0; i < f.length; i++) f[i] = (f[i] - lo) / (hi - lo);
    return f;
  }

  // ---------- draw the paper with the message ----------
  function wrap(text, font, maxW) {
    pctx.font = font;
    const lines = [];
    for (const para of text.split(/\r?\n/)) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); continue; }
      let line = '';
      for (let w of words) {
        // hard-break absurdly long words
        while (pctx.measureText(w).width > maxW) {
          let k = w.length - 1;
          while (k > 1 && pctx.measureText(w.slice(0, k)).width > maxW) k--;
          if (line) { lines.push(line); line = ''; }
          lines.push(w.slice(0, k)); w = w.slice(k);
        }
        const test = line ? line + ' ' + w : w;
        if (pctx.measureText(test).width <= maxW) line = test;
        else { lines.push(line); line = w; }
      }
      lines.push(line);
    }
    return lines;
  }

  function makePaper(text) {
    pctx.clearRect(0, 0, PW, PH);
    // slightly uneven sheet
    pctx.save();
    pctx.beginPath();
    const j = () => (R() - 0.5) * 11;
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([PW * i / 8 + j(), 2 + j()]);
    for (let i = 1; i <= 5; i++) pts.push([PW - 2 + j(), PH * i / 5 + j()]);
    for (let i = 7; i >= 0; i--) pts.push([PW * i / 8 + j(), PH - 2 + j()]);
    for (let i = 4; i >= 1; i--) pts.push([2 + j(), PH * i / 5 + j()]);
    pctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) pctx.lineTo(x, y);
    pctx.closePath();
    pctx.clip();

    pctx.fillStyle = '#d8c7a1';
    pctx.fillRect(0, 0, PW, PH);
    const g = pctx.createRadialGradient(PW * 0.45, PH * 0.4, PH * 0.2, PW * 0.5, PH * 0.5, PW * 0.75);
    g.addColorStop(0, 'rgba(255,245,220,0.18)');
    g.addColorStop(1, 'rgba(95,62,22,0.38)');
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, PW, PH);
    // a few faint stains
    for (let i = 0; i < 5; i++) {
      const x = R() * PW, y = R() * PH, r = 30 + R() * 90;
      const s = pctx.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, 'rgba(110,70,30,0.10)');
      s.addColorStop(1, 'rgba(110,70,30,0)');
      pctx.fillStyle = s; pctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // paper fibre
    for (let i = 0; i < 2600; i++) {
      pctx.fillStyle = R() < 0.5 ? 'rgba(90,60,25,0.07)' : 'rgba(255,250,235,0.08)';
      pctx.fillRect(R() * PW, R() * PH, 1 + R() * 2.5, 1);
    }
    // the fold
    const fold = pctx.createLinearGradient(0, PH * 0.485, 0, PH * 0.515);
    fold.addColorStop(0, 'rgba(70,44,18,0)');
    fold.addColorStop(0.4, 'rgba(70,44,18,0.18)');
    fold.addColorStop(0.55, 'rgba(255,246,220,0.25)');
    fold.addColorStop(1, 'rgba(255,246,220,0)');
    pctx.fillStyle = fold;
    pctx.fillRect(0, PH * 0.485, PW, PH * 0.03);

    // text: shrink until it fits
    const pad = 44;
    let size = 30, lines;
    for (; size >= 17; size -= 1) {
      lines = wrap(text, `${size}px "Libre Caslon Text", Georgia, serif`, PW - pad * 2);
      if (lines.length * size * 1.42 <= PH - pad * 2) break;
    }
    const lh = size * 1.42;
    pctx.fillStyle = '#2b1d14';
    pctx.textBaseline = 'top';
    let y = pad + 2;
    for (const line of lines) {
      if (y + lh > PH - pad + 8) break;
      pctx.fillText(line, pad, y);
      y += lh;
    }
    pctx.restore();

    src = pctx.getImageData(0, 0, PW, PH);
    out = pctx.createImageData(PW, PH);
    thr = makeField();
  }

  // ---------- burn pass ----------
  function renderBurn() {
    const s = src.data, o = out.data;
    const lo = L - 0.08, hi = L + 0.06;
    for (let i = 0, p = 0; i < thr.length; i++, p += 4) {
      const a = s[p + 3];
      if (!a) { o[p + 3] = 0; continue; }
      const t = thr[i];
      if (t < lo) { o[p + 3] = 0; continue; }
      if (t < L) {
        const k = (t - lo) / 0.08;           // 0 at the eaten edge -> 1 at charred paper
        if (k < 0.3) {
          const q = k / 0.3;
          o[p] = 255; o[p + 1] = 240 - 120 * q; o[p + 2] = 190 - 170 * q;
          o[p + 3] = a * (0.25 + 0.75 * q);
        } else {
          const q = (k - 0.3) / 0.7;
          o[p] = 255 - 225 * q; o[p + 1] = 120 - 108 * q; o[p + 2] = 20 - 12 * q;
          o[p + 3] = a;
        }
        continue;
      }
      if (t < hi) {
        const q = (t - L) / 0.06;            // 0 at char -> 1 at clean paper
        const d = 0.3 + 0.7 * q;
        o[p] = s[p] * d; o[p + 1] = s[p + 1] * d * (0.85 + 0.15 * q); o[p + 2] = s[p + 2] * d * (0.7 + 0.3 * q);
        o[p + 3] = a;
        continue;
      }
      o[p] = s[p]; o[p + 1] = s[p + 1]; o[p + 2] = s[p + 2]; o[p + 3] = a;
    }
    pctx.putImageData(out, 0, 0);
  }

  // paper pixel -> screen (matches the draw transform below)
  function toScreen(px, py) {
    let x = px - PW / 2, y = py - PH / 2;
    x += -0.12 * L * y; y *= 1 - 0.1 * L;
    x *= pos.scale; y *= pos.scale * pos.flip;
    const c = Math.cos(pos.rot), s = Math.sin(pos.rot);
    return { x: pos.x + x * c - y * s, y: pos.y + x * s + y * c };
  }

  function shedAsh() {
    const lo = L - 0.11, gone = L - 0.08;
    for (let k = 0; k < 70; k++) {
      const i = (R() * thr.length) | 0;
      if (!src.data[i * 4 + 3]) continue;
      const t = thr[i];
      if (t >= lo && t < gone) {
        const sp = toScreen(i % PW, (i / PW) | 0);
        Fire.addAsh(sp.x, sp.y, R() < 0.5);
      } else if (t >= gone && t < L && R() < 0.12) {
        const sp = toScreen(i % PW, (i / PW) | 0);
        Fire.burst(sp.x, sp.y, 1);
      }
    }
  }

  // ---------- public ----------
  function throwPaper(sx, sy, text, h) {
    handlers = h || {};
    makePaper(text);
    fly = { sx, sy, t: 0, dur: 0.95, s0: (handlers.size || Math.min(560, W * 0.42)) * 1.15 / PW };
    state = 'flying';
    L = 0; burnT = 0;
  }

  // where the paper sits in the pit, in screen terms, for the camera as it is right now
  function landing() {
    const a = handlers.anchor();
    return {
      x: a.x, y: a.y - a.ry * 0.05,
      scale: Math.max(0.3, a.rx * 0.95 / PW),
      flip: Math.max(0.42, Math.min(0.95, (a.ry / a.rx) * 1.35))
    };
  }

  function tick(dt) {
    time += dt;
    if (state === 'idle') return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (state === 'flying') {
      fly.t += dt / fly.dur;
      const u = Math.min(1, fly.t);
      const eo = 1 - Math.pow(1 - u, 1.6);
      const Lp = landing();
      // out of your hand, up, tumbling, and down into the pit, shrinking as it goes away from you
      pos.x = fly.sx + (Lp.x - fly.sx) * eo;
      pos.y = fly.sy + (Lp.y - fly.sy) * (u * u * (3 - 2 * u)) - Math.sin(u * Math.PI) * H * 0.05;
      pos.rot = -0.35 + u * 0.5;
      pos.scale = fly.s0 + (Lp.scale - fly.s0) * eo;
      pos.flip = (1 - u) * (0.4 + 0.6 * Math.abs(Math.cos(u * Math.PI * 2))) + u * Lp.flip;
      if (u >= 1) {
        state = 'burning'; burnT = 0; L = 0;
        pos.rot = 0.05;
        if (handlers.onLand) handlers.onLand(pos.x, pos.y);
      }
    } else if (state === 'burning') {
      // the paper stays put in the pit while the camera moves
      const Lp = landing();
      pos.x = Lp.x; pos.y = Lp.y; pos.scale = Lp.scale; pos.flip = Lp.flip;
      burnT += dt;
      L = burnT < 1 ? burnT * 0.045 : 0.045 + (burnT - 1) / 6.3;
      if (L > 1.12) {
        state = 'idle';
        const a = handlers.anchor();
        if (handlers.onDone) handlers.onDone(a.x, a.y, a.rx * 0.5, a.ry * 0.5);
        return;
      }
      renderBurn();
      shedAsh();
    }

    const bob = state === 'burning' ? Math.sin(burnT * 3.1) * 2.5 : 0;
    const wob = state === 'burning' ? Math.sin(burnT * 2.3) * 0.02 : 0;
    ctx.translate(pos.x, pos.y + bob);
    ctx.rotate(pos.rot + wob);
    ctx.scale(pos.scale, pos.scale * pos.flip);
    ctx.transform(1, 0, -0.12 * L, 1 - 0.1 * L, 0, 0);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18 / pos.scale;
    ctx.shadowOffsetY = 10 / pos.scale;
    ctx.drawImage(paper, -PW / 2, -PH / 2);
  }

  return { throw: throwPaper, tick, state: () => state };
})();
