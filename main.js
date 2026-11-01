/* main.js — the ritual, first person: write, walk up, throw, look down, watch, look up. */
(() => {
  const root = document.documentElement;
  const pov = document.getElementById('pov');
  const note = document.getElementById('note');
  const msg = document.getElementById('msg');
  const btn = document.getElementById('burn-btn');
  const count = document.getElementById('count');
  const mute = document.getElementById('mute');
  const hint = document.getElementById('sound-hint');
  const fade = document.getElementById('fade');
  const cam = World.cam;
  let busy = false;

  if (document.fonts && document.fonts.load) {
    document.fonts.load('26px "Libre Caslon Text"').catch(() => {});
  }
  const setVar = (k, v) => root.style.setProperty(k, v);
  const smooth = u => u * u * (3 - 2 * u);
  const easeInOut = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

  // ---- tiny tween runner for the camera ----
  const tweens = [];
  function tween(key, to, dur, ease, done) {
    tweens.push({ key, from: cam[key], to, t: 0, dur, ease: ease || easeInOut, done });
  }
  function runTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur);
      cam[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(u);
      if (u >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
    }
  }

  // ---- the walk: you, toward the fire ----
  const WALK = 3.8;
  let walk = null;
  function startWalk() {
    walk = { t: 0, steps: 0 };
  }
  function runWalk(dt) {
    walk.t += dt;
    const u = Math.min(1, walk.t / WALK);
    const e = smooth(u);
    cam.dist = 1 - e;
    cam.walk += dt * 9 * (0.3 + Math.sin(u * Math.PI) * 0.9);     // the ground slides under you
    const env = Math.sin(u * Math.PI);                              // steps ease in and out
    const phase = walk.t * Math.PI * 2 * 1.9;
    cam.bob = Math.abs(Math.sin(phase)) * -innerHeight * 0.018 * env;
    cam.sway = Math.sin(phase * 0.5) * innerWidth * 0.006 * env;
    const stepNow = Math.floor(walk.t * 1.9 * 2);
    if (stepNow > walk.steps) { walk.steps = stepNow; Ambient.footstep(0.6 + env * 0.5); }
    if (u >= 1) { walk = null; cam.bob = 0; cam.sway = 0; arrive(); }
  }

  // ---- arrival: your arm comes up with the note, throws, drops ----
  let pending = '';
  function arrive() {
    Arm.start({
      onRelease(x, y, size) {
        Burn.throw(x, y, pending, {
          anchor: World.pit,
          size,
          onLand(x, y) {
            World.flare(1.7);
            Fire.burst(x, y, 70);
            Ambient.flare();
          },
          onDone(x, y, rx, ry) { release(x, y, rx, ry); }
        });
        pending = '';
        // and look down into the pit after it
        setTimeout(() => tween('tilt', 1, 1.6), 450);
      }
    });
  }

  // ---- after the burn: the wind takes the ash, you look up with it ----
  function release(x, y, rx, ry) {
    Fire.ashCloud(x, y, rx, ry, 140);
    World.gust(3.2);
    Ambient.gust(1.1);
    setTimeout(() => {
      tween('tilt', -0.12, 3.8, easeInOut, () => {
        fade.classList.add('is-on');
        setTimeout(reset, 1000);
      });
    }, 700);
  }

  function reset() {
    cam.dist = 1; cam.tilt = 0; cam.bob = 0; cam.sway = 0;
    msg.value = '';
    pov.classList.remove('is-down');
    busy = false;
    refresh();
    setTimeout(() => {
      fade.classList.remove('is-on');
      setTimeout(() => msg.focus({ preventScroll: true }), 600);
    }, 250);
  }

  // ---- render loop ----
  let last = performance.now(), audioTick = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    runTweens(dt);
    if (walk) runWalk(dt);
    Arm.tick(dt);
    const w = World.tick(dt);
    Fire.tick(dt, w.shift);
    Burn.tick(dt);
    if (++audioTick % 10 === 0) Ambient.setFire(w.intensity);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- the sheet ----
  function refresh() {
    const has = msg.value.trim().length > 0;
    btn.disabled = !has || busy;
    count.textContent = msg.value.length > 300 ? `${400 - msg.value.length} left` : '';
  }
  msg.addEventListener('input', () => { refresh(); Ambient.scratch(); });
  msg.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); note.requestSubmit(); }
  });

  note.addEventListener('submit', e => {
    e.preventDefault();
    const text = msg.value.trim();
    if (!text || busy) return;
    busy = true;
    pending = text;
    Ambient.start();
    btn.disabled = true;
    msg.blur();
    pov.classList.add('is-down');          // hands drop out of frame
    setTimeout(startWalk, 650);             // and you walk
  });

  // ---- opening: out of black, the fire wakes ----
  setTimeout(() => { fade.classList.remove('is-on'); World.wake(); }, 350);
  if (!World.ok) {
    // no webgl: the browser has it switched off (hardware acceleration, or a privacy extension)
    const p = document.createElement('p');
    p.className = 'hint nogl';
    p.textContent = 'the fire needs webgl, and this browser has it switched off. turn on hardware acceleration, or try another browser.';
    document.body.appendChild(p);
  }

  // ---- weather ----
  (function windLoop() {
    setTimeout(() => {
      const g = 1.4 + Math.random() * 1.4;
      World.gust(g);
      Ambient.gust(g / 3);
      windLoop();
    }, 16000 + Math.random() * 26000);
  })();

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
