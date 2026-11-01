/* audio.js — a slow dark-jazz ambient bed, synthesised live. No samples.
   Drone in D, rolled minor-ninth chords, brushed hiss, a rare horn, and the fire. */
const Ambient = (() => {
  let ctx = null, master = null, muteGain = null, conv = null;
  let started = false, muted = false;
  let fireBed = null, crackle = null, fireLevel = 1;
  const R = Math.random;
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);

  try { muted = localStorage.getItem('burnit-muted') === '1'; } catch (e) {}

  function noiseBuffer(seconds, brown) {
    const n = (ctx.sampleRate * seconds) | 0;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const w = R() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else d[i] = w;
      }
    }
    return b;
  }

  function impulse(seconds, decay) {
    const n = (ctx.sampleRate * seconds) | 0;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  // route a node dry to master and (optionally) into the reverb
  function out(node, wetAmt) {
    node.connect(master);
    if (wetAmt) {
      const g = ctx.createGain(); g.gain.value = wetAmt;
      node.connect(g).connect(conv);
    }
  }

  function drone() {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 1.1;
    const g = ctx.createGain(); g.gain.value = 0.09;
    lp.connect(g); out(g, 0.35);

    const mk = (type, m, det, vol) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = midi(m); o.detune.value = det;
      const v = ctx.createGain(); v.gain.value = vol;
      o.connect(v).connect(lp); o.start();
      return o;
    };
    mk('sawtooth', 38, 0, 0.5);
    mk('triangle', 38, 7, 0.6);
    mk('sine', 26, 0, 0.9);

    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
    const lg = ctx.createGain(); lg.gain.value = 80;
    lfo.connect(lg).connect(lp.frequency); lfo.start();
  }

  function hiss() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(3, false); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const g = ctx.createGain(); g.gain.value = 0.011;
    src.connect(bp).connect(lp).connect(g); out(g, 0.3);
    src.start();
    // the brush sweep
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.19;
    const lg = ctx.createGain(); lg.gain.value = 0.006;
    lfo.connect(lg).connect(g.gain); lfo.start();
  }

  // voicings in midi; D minor, kept low and close
  const voicings = [
    [50, 53, 57, 60, 64],   // Dm9
    [43, 50, 53, 57, 58],   // Gm9 with the A/Bb rub
    [46, 53, 57, 60, 62],   // Bbmaj9
    [45, 51, 55, 60],       // Am7b5 — wants to fall back to D
    [50, 53, 57, 60, 64]
  ];
  let lastChord = 0;

  function playChord(notes) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.4;
    const bus = ctx.createGain(); bus.gain.value = 1;
    lp.connect(bus); out(bus, 0.85);
    const t0 = ctx.currentTime;
    notes.forEach((m, i) => {
      const at = t0 + i * (0.12 + R() * 0.16);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.028, at + 1.8);
      g.gain.setValueAtTime(0.028, at + 4.2);
      g.gain.exponentialRampToValueAtTime(0.0004, at + 9.5);
      g.connect(lp);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = midi(m); o.detune.value = (R() - 0.5) * 7;
      const o2 = ctx.createOscillator(); o2.type = 'sine';
      o2.frequency.value = midi(m + 12); o2.detune.value = (R() - 0.5) * 5;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2).connect(g);
      o.start(at); o2.start(at); o.stop(at + 10); o2.stop(at + 10);
    });
  }

  function chordLoop() {
    let next;
    if (lastChord === 3) next = 0;
    else next = R() < 0.45 ? 0 : 1 + ((R() * 3) | 0);
    lastChord = next;
    playChord(voicings[next]);
    setTimeout(chordLoop, 9000 + R() * 5000);
  }

  function horn() {
    const m = [57, 60, 62, 65, 67][(R() * 5) | 0];
    const t0 = ctx.currentTime, hold = 2 + R() * 2.5;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(m);
    o.detune.setValueAtTime(-45, t0); o.detune.linearRampToValueAtTime(0, t0 + 0.6);
    const vib = ctx.createOscillator(); vib.frequency.value = 4.6;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(7, t0 + 1.6);
    vib.connect(vg).connect(o.detune);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 680; bp.Q.value = 2.2;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.026, t0 + 1.4);
    g.gain.setValueAtTime(0.026, t0 + 1.4 + hold);
    g.gain.exponentialRampToValueAtTime(0.0003, t0 + 1.4 + hold + 2.6);
    o.connect(bp).connect(lp).connect(g); out(g, 0.9);
    o.start(t0); vib.start(t0);
    o.stop(t0 + hold + 5); vib.stop(t0 + hold + 5);
  }
  function hornLoop() { horn(); setTimeout(hornLoop, 22000 + R() * 24000); }

  function fire() {
    const bed = ctx.createBufferSource(); bed.buffer = noiseBuffer(4, true); bed.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
    fireBed = ctx.createGain(); fireBed.gain.value = 0.05;
    bed.connect(lp).connect(fireBed); out(fireBed, 0.15); bed.start();

    const cr = ctx.createBufferSource(); cr.buffer = noiseBuffer(2, false); cr.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800;
    crackle = ctx.createGain(); crackle.gain.value = 0;
    cr.connect(hp).connect(crackle); out(crackle, 0.2); cr.start();
    pop();
  }
  function pop() {
    const now = ctx.currentTime;
    const g = crackle.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime((0.015 + R() * 0.06) * Math.min(2, fireLevel), now + 0.003);
    g.exponentialRampToValueAtTime(0.0001, now + 0.012 + R() * 0.05);
    setTimeout(pop, (30 + R() * 130) / Math.min(2.5, fireLevel));
  }

  function start() {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();

    master = ctx.createGain(); master.gain.value = 0;
    muteGain = ctx.createGain(); muteGain.gain.value = muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3; comp.knee.value = 14; comp.release.value = 0.4;
    master.connect(comp).connect(muteGain).connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);

    conv = ctx.createConvolver(); conv.buffer = impulse(3.8, 2.4);
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 2400;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    conv.connect(rlp).connect(wet).connect(master);

    drone(); hiss(); fire();
    setTimeout(chordLoop, 1200);
    setTimeout(hornLoop, 14000 + R() * 10000);
  }

  function flare() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // whoosh
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(2, false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(220, t0); bp.frequency.exponentialRampToValueAtTime(1500, t0 + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.28, t0 + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.6);
    n.connect(bp).connect(g); out(g, 0.5); n.start(t0); n.stop(t0 + 2);
    // a low thump underneath
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.5);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.22, t0); og.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.7);
    o.connect(og); out(og, 0.3); o.start(t0); o.stop(t0 + 0.8);
  }

  // a step on gravel: a short thud with a little grit on top
  function footstep(vol) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.3, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420 + R() * 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.11 * vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.14);
    n.connect(lp).connect(g); out(g, 0.25); n.start(t0); n.stop(t0 + 0.3);
    const c = ctx.createBufferSource(); c.buffer = noiseBuffer(0.1, false);
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600 + R() * 1200; hp.Q.value = 0.8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, t0 + 0.005); cg.gain.linearRampToValueAtTime(0.022 * vol, t0 + 0.015);
    cg.gain.exponentialRampToValueAtTime(0.0003, t0 + 0.07);
    c.connect(hp).connect(cg); out(cg, 0.2); c.start(t0); c.stop(t0 + 0.12);
  }

  // wind through the dark
  function gust(strength) {
    if (!ctx) return;
    const t0 = ctx.currentTime, dur = 2.2 + R() * 1.4;
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(4, false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(260, t0);
    bp.frequency.exponentialRampToValueAtTime(900, t0 + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(220, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.045 * strength, t0 + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0003, t0 + dur);
    n.connect(bp).connect(g); out(g, 0.5); n.start(t0); n.stop(t0 + dur + 0.1);
  }

  // the pen on the paper
  function scratch() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.05, false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 + R() * 1800; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.012 + R() * 0.008, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0003, t0 + 0.03 + R() * 0.02);
    n.connect(bp).connect(g); out(g, 0.1); n.start(t0); n.stop(t0 + 0.06);
  }

  function setFire(level) {
    fireLevel = level;
    if (fireBed) fireBed.gain.setTargetAtTime(0.05 * Math.pow(level, 1.4), ctx.currentTime, 0.25);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('burnit-muted', m ? '1' : '0'); } catch (e) {}
    if (muteGain) muteGain.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.08);
  }

  return { start, flare, setFire, setMuted, footstep, gust, scratch, muted: () => muted, started: () => started };
})();
