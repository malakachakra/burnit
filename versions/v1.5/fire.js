/* fire.js — the bonfire. Two canvases: back (core, logs, most flames) and
   front (some flames, embers, smoke, ash) so the paper can sit inside the fire. */
const Fire = (() => {
  const back = document.getElementById('fire-back');
  const front = document.getElementById('fire-front');
  const bctx = back.getContext('2d');
  const fctx = front.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, cx = 0, baseY = 0, baseW = 0, ry = 0, sc = 1;
  let flare = 0, time = 0, wind = 0, glow = 0.8;
  let budget = 1;
  let level = 0.1, waking = false;   // the fire starts as embers and wakes on load
  let gust = 0;                      // a passing wind, leans the flames and scatters embers

  const flames = [], embers = [], smoke = [], ash = [], motes = [], fog = [];
  const R = Math.random;
  const stars = Array.from({ length: 90 }, () => ({ x: R(), y: R() * 0.42, s: 0.4 + R() * 1.1, p: R() * 6.28, r: 0.4 + R() * 1.6 }));

  // ---- sprites: soft discs along a heat ramp (white-yellow -> red -> dark) ----
  const ramp = [
    [255, 250, 225], [255, 228, 150], [255, 185, 70], [255, 130, 30],
    [235, 80, 16], [170, 38, 10], [90, 18, 8], [35, 8, 6]
  ];
  const sprites = ramp.map(c => {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`);
    grd.addColorStop(0.28, `rgba(${c[0]},${c[1]},${c[2]},0.8)`);
    grd.addColorStop(0.62, `rgba(${c[0]},${c[1]},${c[2]},0.18)`);
    grd.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return s;
  });
  const smokeSprite = (() => {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(60,52,50,0.35)');
    grd.addColorStop(0.5, 'rgba(50,44,42,0.16)');
    grd.addColorStop(1, 'rgba(40,36,34,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return s;
  })();

  function cssNum(name, fallback) {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    back.width = front.width = W;
    back.height = front.height = H;
    cx = W * cssNum('--fire-cx', 0.6);
    baseW = W * cssNum('--fire-w', 0.4);
    baseY = H * cssNum('--fire-y', 0.8);
    ry = baseW * 0.15;            // the pit is an ellipse on the ground, seen from above
    sc = H / 900;
    budget = Math.min(1, Math.max(0.45, W / 1400)) * (reduce ? 0.5 : 1);
  }

  const gauss = () => (R() + R() + R()) / 3 - 0.5; // -0.5..0.5, centre heavy

  function spawnFlame(big) {
    const dx = gauss() * 1.9;   // -0.95..0.95 across the pit
    const d = gauss() * 2;      // -1..1 back-to-front through the pit
    const centre = 1 - Math.min(1, Math.hypot(dx * 1.15, d * 0.7));
    flames.push({
      x: cx + dx * baseW * 0.5,
      y: baseY + d * ry,
      vx: (R() - 0.5) * 0.5 * sc,
      vy: -(3.0 + R() * 2.4) * sc * (big ? 0.85 : 1),
      age: 0,
      life: (0.8 + R() * 1.0) * (0.4 + centre * 1.0) * (big ? 1.4 : 1),
      size: (11 + R() * 20) * sc * (big ? 1.8 : 1) * (0.7 + centre * 0.5) * (1 + d * 0.12),
      wob: R() * 6.28,
      z: d > 0.4 ? 1 : 0        // flames at the front of the pit draw over whatever is in it
    });
  }

  function spawnEmber(x, y, hot) {
    embers.push({
      x, y,
      vx: (R() - 0.5) * (hot ? 3 : 1.2) * sc,
      vy: -(1.2 + R() * (hot ? 4 : 2.2)) * sc,
      age: 0, life: 1.5 + R() * 2.5,
      size: (1.2 + R() * 2.2) * sc,
      wob: R() * 6.28
    });
  }

  function spawnSmoke() {
    smoke.push({
      x: cx + gauss() * baseW * 0.6,
      y: baseY - H * (0.34 + R() * 0.14),
      vx: (R() - 0.5) * 0.3 * sc,
      vy: -(0.45 + R() * 0.5) * sc,
      age: 0, life: 4 + R() * 4,
      size: (50 + R() * 60) * sc,
      wob: R() * 6.28
    });
  }

  function addAsh(x, y, hot) {
    ash.push({
      x, y,
      vx: (R() - 0.5) * 1.2 * sc,
      vy: -(0.6 + R() * 1.8) * sc,
      rot: R() * 6.28, vr: (R() - 0.5) * 6,
      age: 0, life: 2.5 + R() * 3,
      w: (2 + R() * 5) * sc, h: (1.5 + R() * 3) * sc,
      hot: hot ? 1 : 0,
      wob: R() * 6.28
    });
  }

  function spawnMote() {
    motes.push({
      x: R() * W, y: H * (0.25 + R() * 0.5),
      vx: (R() - 0.5) * 0.25 * sc, vy: -(0.05 + R() * 0.2) * sc,
      age: 0, life: 6 + R() * 8, size: (0.8 + R() * 1.4) * sc, wob: R() * 6.28
    });
  }
  function spawnFog(initial) {
    fog.push({
      x: initial ? R() * W : (wind + gust > 0 ? -W * 0.3 : W * 1.3),
      y: H * (0.4 + R() * 0.3),
      w: W * (0.35 + R() * 0.3), h: H * (0.06 + R() * 0.06),
      a: 0.05 + R() * 0.05, drift: 0.12 + R() * 0.15
    });
  }

  function update(dt) {
    time += dt;
    gust *= Math.exp(-dt * 0.55);
    wind = Math.sin(time * 0.37) * 0.25 + Math.sin(time * 1.3) * 0.12 + gust;
    flare *= Math.exp(-dt * 0.75);
    if (waking && level < 1) level = Math.min(1, level + dt / 3.8);
    const intensity = (1 + flare) * level;
    const frames = dt * 60;

    // the air between us and the fire
    if (motes.length < 26 && R() < 0.4 * frames) spawnMote();
    for (let i = motes.length - 1; i >= 0; i--) {
      const p = motes[i];
      p.age += dt;
      if (p.age >= p.life) { motes[i] = motes[motes.length - 1]; motes.pop(); continue; }
      p.x += (p.vx + wind * 0.5 * sc + Math.sin(p.age * 0.9 + p.wob) * 0.15 * sc) * frames;
      p.y += (p.vy + Math.cos(p.age * 0.7 + p.wob) * 0.1 * sc) * frames;
    }
    if (fog.length < 4 && R() < 0.01 * frames) spawnFog(false);
    for (let i = fog.length - 1; i >= 0; i--) {
      const f = fog[i];
      f.x += (f.drift * (0.6 + wind * 1.4)) * sc * frames;
      if (f.x > W * 1.6 || f.x < -W * 0.6) { fog[i] = fog[fog.length - 1]; fog.pop(); }
    }

    // spawn
    let n = 17 * budget * intensity * frames;
    while (n > 0) { if (R() < n) spawnFlame(R() < 0.08); n -= 1; }
    let e = 0.5 * intensity * intensity * frames;
    while (e > 0) { if (R() < e) spawnEmber(cx + gauss() * baseW * 0.9, baseY - R() * H * 0.1, flare > 0.4); e -= 1; }
    if (R() < 0.3 * budget * frames) spawnSmoke();

    const lift = Math.pow(intensity, 0.4);

    // flames
    for (let i = flames.length - 1; i >= 0; i--) {
      const p = flames[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) { flames[i] = flames[flames.length - 1]; flames.pop(); continue; }
      p.x += (p.vx + Math.sin(p.age * 7 + p.wob) * 0.45 * sc + wind * sc) * frames;
      p.y += p.vy * (1 - t * 0.45) * frames * lift;
      p.vx += (cx - p.x) * 0.0006 * frames; // flames lean inward -> one big tongue
    }
    // embers
    for (let i = embers.length - 1; i >= 0; i--) {
      const p = embers[i];
      p.age += dt;
      if (p.age >= p.life) { embers[i] = embers[embers.length - 1]; embers.pop(); continue; }
      p.x += (p.vx + Math.sin(p.age * 5 + p.wob) * 0.6 * sc + wind * 1.5 * sc) * frames;
      p.y += p.vy * frames;
      p.vy *= 1 - 0.15 * dt;
    }
    // smoke
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.age += dt;
      if (p.age >= p.life) { smoke[i] = smoke[smoke.length - 1]; smoke.pop(); continue; }
      p.x += (p.vx + wind * 1.2 * sc + Math.sin(p.age * 0.8 + p.wob) * 0.2 * sc) * frames;
      p.y += p.vy * frames;
      p.size += 9 * sc * dt;
    }
    // ash
    for (let i = ash.length - 1; i >= 0; i--) {
      const p = ash[i];
      p.age += dt;
      if (p.age >= p.life) { ash[i] = ash[ash.length - 1]; ash.pop(); continue; }
      const t = p.age / p.life;
      p.x += (p.vx + Math.sin(p.age * 4 + p.wob) * 0.9 * sc + wind * 1.4 * sc) * frames;
      p.y += (p.vy * (1 - t * 0.6)) * frames;
      p.rot += p.vr * dt;
    }

    // light spill into the css
    const flick = 0.78 + Math.sin(time * 9.1) * 0.05 + Math.sin(time * 23.7) * 0.04 + Math.sin(time * 3.3) * 0.05;
    glow = Math.min(1.35, (flick + flare * 0.4) * (0.35 + 0.65 * level));
    return intensity;
  }

  function drawStars(ctx) {
    ctx.globalCompositeOperation = 'source-over';
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(time * s.r + s.p);
      ctx.fillStyle = `rgba(210,220,240,${0.12 + tw * 0.3})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.s * sc, 0, 6.2832);
      ctx.fill();
    }
  }

  function drawFog(ctx) {
    ctx.globalCompositeOperation = 'source-over';
    for (const f of fog) {
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.w);
      g.addColorStop(0, `rgba(60,70,90,${f.a})`);
      g.addColorStop(1, 'rgba(60,70,90,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(1, f.h / f.w);
      ctx.beginPath();
      ctx.arc(0, 0, f.w, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMotes(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of motes) {
      const t = p.age / p.life;
      const a = Math.sin(t * Math.PI) * (0.35 + 0.35 * Math.sin(p.age * 2.3 + p.wob));
      ctx.fillStyle = `rgba(255,190,110,${Math.max(0, a) * level})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.2832);
      ctx.fill();
    }
  }

  // the pit: a dark ellipse on the ground, a ring of logs around it, two crossed in the middle.
  // front=false draws the back half (behind the paper), front=true the near half (over it).
  const RING = [-2.6, -2.0, -1.3, -0.55, 0.25, 1.0, 1.8, 2.5];
  function drawLogs(ctx, front) {
    ctx.save();
    ctx.translate(cx, baseY);
    if (!front) {
      ctx.fillStyle = '#0a0605';
      ctx.beginPath();
      ctx.ellipse(0, 0, baseW * 0.46, ry * 0.95, 0, 0, 6.2832);
      ctx.fill();
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, baseW * 0.3);
      g.addColorStop(0, `rgba(255,110,30,${0.18 + glow * 0.2})`);
      g.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, baseW * 0.3, ry * 0.6, 0, 0, 6.2832);
      ctx.fill();
    }
    const th = 10 * sc;
    const log = (x, y, rot, len) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = front ? '#080504' : '#0d0806';
      ctx.beginPath();
      ctx.roundRect(-len / 2, -th / 2, len, th, th / 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,120,30,${0.2 + glow * 0.3})`;
      ctx.lineWidth = 1.2 * sc;
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        const kx = k * len * 0.17 + Math.sin(time * 2 + k) * 2;
        ctx.moveTo(kx, -th * 0.3); ctx.lineTo(kx + 5 * sc, th * 0.25);
      }
      ctx.stroke();
      ctx.restore();
    };
    for (const a of RING) {
      const isFront = Math.sin(a) > 0.2;
      if (isFront !== front) continue;
      const x = Math.cos(a) * baseW * 0.46, y = Math.sin(a) * ry * 0.95;
      // lie along the ring's tangent
      log(x, y, Math.atan2(Math.cos(a) * ry, -Math.sin(a) * baseW * 0.46), baseW * 0.2);
    }
    if (!front) { log(-baseW * 0.04, -ry * 0.1, -0.28, baseW * 0.34); log(baseW * 0.03, -ry * 0.25, 0.32, baseW * 0.3); }
    ctx.restore();
  }

  function drawCore(ctx, intensity) {
    ctx.globalCompositeOperation = 'lighter';
    const pulses = [
      [0, 0.01, 0.42, 0.06, [255, 120, 30]],
      [-0.06, 0.0, 0.22, 0.09, [255, 170, 60]],
      [0.05, 0.01, 0.16, 0.10, [255, 190, 90]],
      [0, 0.02, 0.09, 0.16, [255, 240, 190]]
    ];
    pulses.forEach(([ox, oy, rad, a, c], i) => {
      const r = baseW * rad * (0.9 + Math.sin(time * (4 + i * 1.7) + i) * 0.08) * (1 + flare * 0.25);
      const x = cx + ox * baseW + Math.sin(time * 2.2 + i * 2) * 4 * sc;
      const y = baseY - oy * H - r * 0.45;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a * intensity * 0.9})`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.25, 0, 0, 6.2832);
      ctx.fill();
    });
  }

  function drawFlames(ctx, z) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of flames) {
      if (p.z !== z) continue;
      const t = p.age / p.life;
      const idx = Math.min(7, (t * 7.6) | 0);
      const s = p.size * (1 - t * 0.5);
      ctx.globalAlpha = (1 - t) * (z ? 0.26 : 0.42) * (0.8 + 0.2 * (1 - t));
      // tongues, not discs: stretched along the rise
      ctx.drawImage(sprites[idx], p.x - s * 0.85, p.y - s * 1.5, s * 1.7, s * 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of embers) {
      const t = p.age / p.life;
      const tw = 0.6 + 0.4 * Math.sin(p.age * 20 + p.wob);
      const a = (1 - t) * tw;
      ctx.fillStyle = t < 0.4 ? `rgba(255,220,140,${a})` : `rgba(255,${(150 - t * 120) | 0},20,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, 6.2832);
      ctx.fill();
    }
  }

  function drawSmoke(ctx) {
    ctx.globalCompositeOperation = 'source-over';
    for (const p of smoke) {
      const t = p.age / p.life;
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.3;
      ctx.drawImage(smokeSprite, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawAsh(ctx) {
    ctx.globalCompositeOperation = 'source-over';
    for (const p of ash) {
      const t = p.age / p.life;
      const hot = Math.max(0, p.hot - t * 2.2);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = hot > 0
        ? `rgb(${(120 + hot * 135) | 0},${(70 + hot * 60) | 0},${(60 - hot * 40) | 0})`
        : `rgb(${(95 + t * 40) | 0},${(90 + t * 38) | 0},${(86 + t * 36) | 0})`;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  let glowTick = 0;
  function tick(dt) {
    const intensity = update(dt);
    bctx.globalCompositeOperation = 'source-over';
    bctx.clearRect(0, 0, W, H);
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, W, H);

    drawStars(bctx);
    drawLogs(bctx, false);
    drawCore(bctx, intensity);
    drawFlames(bctx, 0);

    drawSmoke(fctx);
    drawFog(fctx);
    drawLogs(fctx, true);
    drawFlames(fctx, 1);
    drawEmbers(fctx);
    drawAsh(fctx);
    drawMotes(fctx);

    if (++glowTick % 3 === 0) {
      document.documentElement.style.setProperty('--fire-glow', glow.toFixed(3));
    }
    return intensity;
  }

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) spawnEmber(x + (R() - 0.5) * 40 * sc, y + (R() - 0.5) * 30 * sc, true);
  }
  function mouth() { return { x: cx + baseW * 0.02, y: baseY - ry * 0.05 }; }

  addEventListener('resize', resize);
  resize();
  for (let i = 0; i < 3; i++) spawnFog(true);

  return {
    tick,
    burst,
    addAsh,
    mouth,
    wake() { waking = true; },
    gust(g) { gust = Math.max(gust, g); for (let i = 0; i < 14; i++) spawnEmber(cx + gauss() * baseW * 0.8, baseY - R() * H * 0.12, true); },
    pitFront() { return baseY + ry; },
    flare(a) { flare = Math.max(flare, a); },
    intensity() { return 1 + flare; },
    glow() { return glow; }
  };
})();
