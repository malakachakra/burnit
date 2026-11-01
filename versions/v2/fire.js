/* fire.js — the things that leave the fire: embers, ash, the motes in the air.
   Drawn on the 2D front canvas above the shader world. */
const Fire = (() => {
  const front = document.getElementById('fire-front');
  const fctx = front.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, sc = 1, time = 0;
  const embers = [], ash = [], motes = [];
  const R = Math.random;
  const gauss = () => (R() + R() + R()) / 3 - 0.5;

  function resize() { W = innerWidth; H = innerHeight; front.width = W; front.height = H; sc = H / 900; }

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

  function addAsh(x, y, hot, long) {
    ash.push({
      x, y,
      vx: (R() - 0.5) * 1.2 * sc,
      vy: -(0.6 + R() * 1.8) * sc,
      rot: R() * 6.28, vr: (R() - 0.5) * 6,
      age: 0, life: (2.5 + R() * 3) * (long ? 2.2 : 1),
      w: (2 + R() * 5) * sc, h: (1.5 + R() * 3) * sc,
      hot: hot ? 1 : 0,
      wob: R() * 6.28
    });
  }

  function spawnMote() {
    motes.push({
      x: R() * W, y: H * (0.2 + R() * 0.55),
      vx: (R() - 0.5) * 0.25 * sc, vy: -(0.05 + R() * 0.2) * sc,
      age: 0, life: 6 + R() * 8, size: (0.8 + R() * 1.4) * sc, wob: R() * 6.28
    });
  }

  function tick(dt, shift) {
    time += dt;
    const wind = World.wind(), level = World.level(), intensity = World.intensity();
    const pit = World.pit();
    const frames = dt * 60;

    // embers off the fire
    let e = 0.5 * intensity * intensity * frames * (reduce ? 0.5 : 1);
    while (e > 0) { if (R() < e) spawnEmber(pit.x + gauss() * pit.rx * 1.7, pit.y - pit.ry * 0.2 - R() * pit.fh * 0.35, intensity > 1.4); e -= 1; }
    if (motes.length < 26 && R() < 0.4 * frames) spawnMote();

    for (let i = embers.length - 1; i >= 0; i--) {
      const p = embers[i];
      p.age += dt;
      if (p.age >= p.life) { embers[i] = embers[embers.length - 1]; embers.pop(); continue; }
      p.x += (p.vx + Math.sin(p.age * 5 + p.wob) * 0.6 * sc + wind * 1.5 * sc) * frames;
      p.y += p.vy * frames + shift;
      p.vy *= 1 - 0.15 * dt;
    }
    for (let i = ash.length - 1; i >= 0; i--) {
      const p = ash[i];
      p.age += dt;
      if (p.age >= p.life) { ash[i] = ash[ash.length - 1]; ash.pop(); continue; }
      const t = p.age / p.life;
      p.x += (p.vx + Math.sin(p.age * 4 + p.wob) * 0.9 * sc + wind * 1.4 * sc) * frames;
      p.y += (p.vy * (1 - t * 0.6)) * frames + shift;
      p.rot += p.vr * dt;
    }
    for (let i = motes.length - 1; i >= 0; i--) {
      const p = motes[i];
      p.age += dt;
      if (p.age >= p.life) { motes[i] = motes[motes.length - 1]; motes.pop(); continue; }
      p.x += (p.vx + wind * 0.5 * sc + Math.sin(p.age * 0.9 + p.wob) * 0.15 * sc) * frames;
      p.y += (p.vy + Math.cos(p.age * 0.7 + p.wob) * 0.1 * sc) * frames + shift * 0.6;
    }

    const ctx = fctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

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
    for (const p of motes) {
      const t = p.age / p.life;
      const a = Math.sin(t * Math.PI) * (0.35 + 0.35 * Math.sin(p.age * 2.3 + p.wob));
      ctx.fillStyle = `rgba(255,190,110,${Math.max(0, a) * level})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.2832);
      ctx.fill();
    }

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

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) spawnEmber(x + (R() - 0.5) * 40 * sc, y + (R() - 0.5) * 30 * sc, true);
  }
  // the last of the paper lifting off as the wind takes it
  function ashCloud(x, y, rx, ry, n) {
    for (let i = 0; i < n; i++) addAsh(x + gauss() * rx * 2, y + gauss() * ry * 2, R() < 0.25, true);
  }

  addEventListener('resize', resize);
  resize();

  return { tick, burst, addAsh, ashCloud };
})();
