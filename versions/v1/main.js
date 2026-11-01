/* main.js — wires the sheet, the walk, the fire and the sound together. */
(() => {
  const root = document.documentElement;
  const figure = document.getElementById('figure');
  const pov = document.getElementById('pov');
  const note = document.getElementById('note');
  const msg = document.getElementById('msg');
  const btn = document.getElementById('burn-btn');
  const count = document.getElementById('count');
  const mute = document.getElementById('mute');
  const hint = document.getElementById('sound-hint');
  const hand = document.getElementById('hand');
  const fade = document.getElementById('fade');
  let busy = false;

  if (document.fonts && document.fonts.load) {
    document.fonts.load('26px "Libre Caslon Text"').catch(() => {});
  }

  const cssNum = (name, fb) => { const v = parseFloat(getComputedStyle(root).getPropertyValue(name)); return isNaN(v) ? fb : v; };
  const setVar = (k, v) => root.style.setProperty(k, v);

  function setFigure(state) {
    figure.classList.remove('is-walk', 'is-throw', 'is-watch');
    if (state) figure.classList.add(state);
  }

  // ---- the walk: out from under the camera, toward the fire ----
  const WALK = 3.4;
  let walk = null;
  function startWalk() {
    const W = innerWidth, H = innerHeight;
    const figH = parseFloat(getComputedStyle(figure).height) || H * 0.72;
    const s0 = 2.3, s1 = 0.5;
    const fireX = cssNum('--fire-cx', 0.6) * W, fireW = cssNum('--fire-w', 0.34) * W, fireY = cssNum('--fire-y', 0.74) * H;
    const figW = figH * 200 / 340;
    walk = {
      t: 0,
      x0: -W * 0.04, x1: (fireX - fireW * 0.5 - figW * s1 * 0.45) - W * 0.5,
      y0: figH * s0 - H * 0.24, y1: -(H - fireY),
      s0, s1
    };
    applyWalk(0);
    figure.classList.add('has-paper');
    setFigure('is-walk');
  }
  function applyWalk(u) {
    const e = u * u * (3 - 2 * u);
    setVar('--fx', (walk.x0 + (walk.x1 - walk.x0) * e).toFixed(1) + 'px');
    setVar('--fy', (walk.y0 + (walk.y1 - walk.y0) * e).toFixed(1) + 'px');
    setVar('--fs', (walk.s0 + (walk.s1 - walk.s0) * e).toFixed(4));
  }

  // ---- render loop ----
  let last = performance.now(), audioTick = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    const intensity = Fire.tick(dt);
    Burn.tick(dt);
    if (walk) {
      walk.t += dt;
      const u = Math.min(1, walk.t / WALK);
      applyWalk(u);
      if (u >= 1) { walk = null; throwIt(); }
    }
    if (++audioTick % 10 === 0) Ambient.setFire(intensity);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- the sheet ----
  function refresh() {
    const has = msg.value.trim().length > 0;
    btn.disabled = !has || busy;
    count.textContent = msg.value.length > 300 ? `${400 - msg.value.length} left` : '';
  }
  msg.addEventListener('input', refresh);
  msg.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); note.requestSubmit(); }
  });

  let pending = '';
  note.addEventListener('submit', e => {
    e.preventDefault();
    const text = msg.value.trim();
    if (!text || busy) return;
    busy = true;
    pending = text;
    Ambient.start();
    btn.disabled = true;
    msg.blur();
    pov.classList.add('is-down');          // hands lower out of frame
    setTimeout(startWalk, 750);             // then the figure steps out from under the camera
  });

  function throwIt() {
    setFigure('is-throw');
    // release point of the throw animation (see @keyframes throw)
    setTimeout(() => {
      const r = hand.getBoundingClientRect();
      figure.classList.remove('has-paper');
      Burn.throw(r.left + r.width / 2, r.top + r.height / 2, pending, {
        onLand(x, y) {
          Fire.flare(1.7);
          Fire.burst(x, y, 70);
          Ambient.flare();
        },
        onDone() { setTimeout(reset, 1500); }
      });
      pending = '';
    }, 540);
    setTimeout(() => setFigure('is-watch'), 1000);
  }

  function reset() {
    fade.classList.add('is-on');            // a cut: dip to black
    setTimeout(() => {
      setFigure(null);
      setVar('--fy', '300vh');
      msg.value = '';
      pov.classList.remove('is-down');
      busy = false;
      refresh();
      fade.classList.remove('is-on');
      setTimeout(() => msg.focus({ preventScroll: true }), 600);
    }, 1000);
  }

  // ---- sound ----
  function startAudio() {
    Ambient.start();
    hint.classList.add('is-gone');
  }
  addEventListener('pointerdown', startAudio, { once: true });
  addEventListener('keydown', startAudio, { once: true });

  function paintMute() {
    const m = Ambient.muted();
    mute.setAttribute('aria-pressed', String(m));
    mute.setAttribute('aria-label', m ? 'unmute sound' : 'mute sound');
  }
  mute.addEventListener('click', () => { Ambient.setMuted(!Ambient.muted()); paintMute(); });
  paintMute();
  refresh();
})();
