/* world.js — the whole scene drawn by one fragment shader from a first-person camera:
   sky, stars, horizon fog, the ground scrolling under you as you walk, the pit, the coals,
   the fire, its smoke and heat. A second pass draws the pit's front flames over the paper. */
const World = (() => {
  const back = document.getElementById('world');
  const front = document.getElementById('world-front');

  const VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
  const FS = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uHorizon, uWind, uLevel, uFlare, uFront, uWalk, uSway, uGlow;
uniform vec4 uPit;    // cx, cy, rx, ry  (canvas px, y down)
uniform vec3 uFlame;  // baseY, halfW, height

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a*noise(p); p = mat2(1.6,1.2,-1.2,1.6)*p; a *= 0.5; }
  return v;
}

vec3 ramp(float t){
  vec3 c = mix(vec3(0.10,0.01,0.0), vec3(0.72,0.10,0.02), smoothstep(0.0,0.22,t));
  c = mix(c, vec3(1.0,0.42,0.06), smoothstep(0.18,0.48,t));
  c = mix(c, vec3(1.0,0.82,0.30), smoothstep(0.42,0.78,t));
  c = mix(c, vec3(1.0,0.97,0.82), smoothstep(0.72,1.0,t));
  return c;
}

// flame density at a screen point. x across the base (1 = half width), y up from the base (1 = full height)
float flame(vec2 frag, float seed, float top){
  vec2 p = vec2((frag.x - uPit.x)/uFlame.y, (uFlame.x - frag.y)/uFlame.z);
  if (p.y < -0.2 || p.y > top) return 0.0;
  float y = max(p.y, 0.0);
  p.x -= clamp(uWind, -2.2, 2.2) * y * y * 0.28;
  float n  = fbm(vec2(p.x*2.4 + seed, y*3.2 - uTime*1.7 + seed*3.1));
  float n2 = fbm(vec2(p.x*5.5 - uTime*0.3 + seed*2.0, y*7.0 - uTime*3.0));
  float n3 = noise(vec2(p.x*14.0 + seed*5.0, y*18.0 - uTime*5.0));
  float width = 1.0 - y*0.7;
  float shape = 1.0 - smoothstep(0.0, 1.0, abs(p.x)/max(width, 0.04));
  shape *= smoothstep(top, top*0.45, y);
  shape *= smoothstep(-0.2, 0.1, p.y);
  float d = shape*(0.2 + n*1.15) + n2*0.32 + (n3 - 0.5)*0.12 - 0.4;
  d = d*(0.5 + uLevel*0.45 + uFlare*0.4);
  d = smoothstep(0.02, 0.9, d) * 1.05;
  return clamp(d, 0.0, 1.0);
}

void main(){
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  if (uFront > 0.5) {
    // the near lip of the fire: short licks that pass in front of whatever is in the pit
    float d = flame(frag, 4.2, 1.0);
    vec3 c = ramp(d) * d;
    float a = d * 0.85;
    gl_FragColor = vec4(c * a, a);
    return;
  }

  // heat shimmer bends the background above the flames
  float heat = smoothstep(uFlame.y*2.2, 0.0, abs(frag.x - uPit.x))
             * smoothstep(uFlame.x + 40.0, uFlame.x - uFlame.z*0.6, frag.y)
             * smoothstep(uFlame.x - uFlame.z*2.6, uFlame.x - uFlame.z*1.2, frag.y);
  vec2 bg = frag + vec2(fbm(vec2(frag.x*0.012, frag.y*0.012 - uTime*1.8)) - 0.5) * 9.0 * heat * (0.5 + uLevel);

  // sky
  float h = max(uHorizon, 1.0);
  float st = clamp(bg.y / h, 0.0, 1.0);
  vec3 col = mix(vec3(0.045,0.04,0.055), vec3(0.10,0.075,0.065), st*st);
  // stars
  vec2 sp = floor(bg / 22.0);
  float sh = hash(sp);
  if (bg.y < h && sh > 0.975) {
    vec2 c = (sp + 0.5)*22.0 + (vec2(hash(sp+1.0), hash(sp+2.0)) - 0.5)*14.0;
    float dd = length(bg - c);
    float tw = 0.5 + 0.5*sin(uTime*(1.0 + hash(sp+3.0)*2.0) + sh*50.0);
    col += vec3(0.7,0.75,0.9) * smoothstep(1.6, 0.0, dd) * (0.15 + 0.35*tw) * (1.0 - st);
  }
  // fog on the horizon, drifting with the wind
  float fogb = exp(-pow((bg.y - h)/(uRes.y*0.08), 2.0));
  col = mix(col, vec3(0.13,0.14,0.17), fogb*0.5);
  float drift = fbm(vec2(bg.x*0.0025 - uTime*0.02 - uWind*0.03, bg.y*0.01));
  col = mix(col, vec3(0.12,0.13,0.16), fogb*drift*0.5);

  // the ground, in perspective, scrolling under us as we walk
  float below = bg.y - h;
  if (below > 0.0) {
    float depth = (uRes.y*0.55) / max(below, 1.0);
    vec2 wp = vec2((bg.x - uRes.x*0.5 + uSway)*depth*0.02, depth*18.0 + uWalk);
    float g = fbm(wp*0.35);
    float g2 = noise(wp*2.5);
    vec3 ground = vec3(0.05,0.032,0.024)*(0.35 + g*0.8 + g2*0.2);
    float near = smoothstep(0.0, uRes.y*0.16, below);
    col = mix(col, ground, near);
  }

  // light pool from the pit, on the ground
  vec2 pr = vec2((frag.x - uPit.x)/(uPit.z*1.6), (frag.y - uPit.y)/(uPit.w*2.0));
  float pool = exp(-dot(pr,pr)*1.3) * (0.3 + uGlow*0.45) * uLevel;
  if (frag.y > h) col += vec3(1.0,0.42,0.1) * pool * 0.4;

  // the pit: a ring of stones, coals inside
  vec2 pe = vec2((frag.x - uPit.x)/uPit.z, (frag.y - uPit.y)/uPit.w);
  float e = dot(pe, pe);
  if (e < 1.35) {
    float ring = smoothstep(0.82, 0.95, e) * smoothstep(1.3, 1.08, e);
    float stones = noise(vec2(atan(pe.y, pe.x)*9.0, e*14.0));
    vec3 stone = vec3(0.10,0.08,0.07)*(0.45 + stones*0.9) + vec3(0.35,0.12,0.02)*pool*stones;
    col = mix(col, stone, ring);
    float inside = smoothstep(0.95, 0.75, e);
    vec2 cp = vec2(pe.x*uPit.z, pe.y*uPit.w*2.0)*0.045;
    float coal = fbm(cp + vec2(0.0, uTime*0.04));
    float pulse = 0.55 + 0.45*sin(uTime*1.6 + coal*14.0);
    float centre = smoothstep(0.9, 0.2, e);
    float hot = pow(coal, 5.5)*3.2*pulse*(0.25 + uLevel*0.6 + uFlare*0.5)*(0.3 + centre*0.7);
    float char = noise(cp*9.0);
    vec3 coals = vec3(0.028,0.016,0.012)*(0.6 + char*0.8);
    coals = mix(coals, vec3(0.75,0.17,0.02), clamp(hot,0.0,1.0)) + vec3(1.0,0.55,0.15)*clamp(hot-0.85,0.0,1.0)*0.8;
    col = mix(col, coals, inside);
  }

  // glow around the fire
  vec2 gr = vec2((frag.x - uPit.x)/(uFlame.y*1.6), (frag.y - (uFlame.x - uFlame.z*0.35))/(uFlame.z*0.8));
  float glow = exp(-dot(gr,gr)*1.2) * (0.35 + uGlow*0.35) * uLevel;
  col += vec3(1.0,0.4,0.1)*glow*0.5;

  // smoke above the flames
  vec2 sm = vec2((frag.x - uPit.x)/uFlame.y, (uFlame.x - frag.y)/uFlame.z);
  if (sm.y > 0.7 && sm.y < 3.0) {
    float sx = sm.x - uWind*(sm.y-0.7)*0.9;
    float sn = fbm(vec2(sx*1.6, sm.y*1.2 - uTime*0.55));
    float sw = 1.0 - smoothstep(0.0, 1.0, abs(sx)/(0.5 + (sm.y-0.7)*0.7));
    float smoke = sw * smoothstep(0.7, 1.2, sm.y) * smoothstep(3.0, 1.8, sm.y) * smoothstep(0.35, 0.75, sn) * 0.55 * uLevel;
    col = mix(col, vec3(0.16,0.14,0.14), smoke);
  }

  // the fire
  float d = flame(frag, 0.0, 1.5);
  float d2 = flame(frag, 2.7, 1.1);
  float fd = clamp(d + d2*0.3, 0.0, 1.0);
  col += ramp(fd) * fd * 1.1;
  col += vec3(1.0,0.9,0.7) * pow(fd, 4.0) * 0.4;

  col = 1.0 - exp(-col * 1.35);
  gl_FragColor = vec4(col, 1.0);
}`;

  const NAMES = ['uRes', 'uTime', 'uHorizon', 'uWind', 'uLevel', 'uFlare', 'uFront', 'uWalk', 'uSway', 'uGlow', 'uPit', 'uFlame'];
  function makeGL(canvas, alpha) {
    const gl = canvas.getContext('webgl', { alpha, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    const prog = gl.createProgram();
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('shader:', gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    };
    sh(gl.VERTEX_SHADER, VS); sh(gl.FRAGMENT_SHADER, FS);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error('link:', gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const u = {};
    for (const n of NAMES) u[n] = gl.getUniformLocation(prog, n);
    if (alpha) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    return { gl, u };
  }
  const B = makeGL(back, false);
  const F = makeGL(front, true);
  const ok = !!(B && F);

  // ---- camera: dist 1 = where you start, 0 = at the pit. tilt 0 = looking ahead, 1 = looking down. ----
  const cam = { dist: 1, tilt: 0, bob: 0, sway: 0, walk: 0 };
  let W = 0, H = 0, S = 1, time = 0;
  let wind = 0, gust = 0, level = 0.1, waking = false, flare = 0, glow = 0.8, glowTick = 0;
  let geo = { horizon: 0, cx: 0, pitY: 0, rx: 1, ry: 1, fh: 1, flameBase: 0 };
  let lastPitY = null;

  function resize() {
    W = innerWidth; H = innerHeight;
    S = Math.min(1, 1100 / W);                  // render a touch under full res on wide screens
    back.width = front.width = Math.round(W * S);
    back.height = front.height = Math.round(H * S);
    if (ok) { B.gl.viewport(0, 0, back.width, back.height); F.gl.viewport(0, 0, front.width, front.height); }
  }

  function layout() {
    const d = cam.dist, t = cam.tilt;
    const horizon = H * (0.5 - t * 0.85) + cam.bob;
    const nearY = H * (0.70 + (1 - d) * 0.24);
    const pitY = nearY + (H * 0.60 - nearY) * t + cam.bob;
    const rx = W * (0.15 + (1 - d) * 0.17) * (1 + t * 0.1);
    const ry = rx * (0.16 + t * 0.4);
    const fh = H * (0.34 + (1 - d) * 0.28) * (1 - t * 0.22);
    geo = { horizon, cx: W * 0.5 + cam.sway, pitY, rx, ry, fh, flameBase: pitY - ry * 0.05 };
    return geo;
  }

  function update(dt) {
    time += dt;
    gust *= Math.exp(-dt * 0.55);
    wind = Math.sin(time * 0.37) * 0.25 + Math.sin(time * 1.3) * 0.12 + gust;
    flare *= Math.exp(-dt * 0.75);
    if (waking && level < 1) level = Math.min(1, level + dt / 3.8);
    const flick = 0.78 + Math.sin(time * 9.1) * 0.05 + Math.sin(time * 23.7) * 0.04 + Math.sin(time * 3.3) * 0.05;
    glow = Math.min(1.35, (flick + flare * 0.4) * (0.35 + 0.65 * level));
    if (++glowTick % 3 === 0) document.documentElement.style.setProperty('--fire-glow', glow.toFixed(3));
  }

  function pass(C, isFront, g) {
    const gl = C.gl, u = C.u;
    gl.uniform2f(u.uRes, back.width, back.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uHorizon, g.horizon * S);
    gl.uniform1f(u.uWind, wind);
    gl.uniform1f(u.uLevel, level);
    gl.uniform1f(u.uFlare, flare);
    gl.uniform1f(u.uFront, isFront ? 1 : 0);
    gl.uniform1f(u.uWalk, cam.walk);
    gl.uniform1f(u.uSway, cam.sway * S);
    gl.uniform1f(u.uGlow, glow);
    gl.uniform4f(u.uPit, g.cx * S, g.pitY * S, g.rx * S, g.ry * S);
    if (isFront) gl.uniform3f(u.uFlame, (g.pitY + g.ry * 0.75) * S, g.rx * 0.75 * S, g.fh * 0.4 * S);
    else gl.uniform3f(u.uFlame, g.flameBase * S, g.rx * 0.9 * S, g.fh * S);
    if (isFront) gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(dt) {
    update(dt);
    const g = layout();
    const shift = lastPitY === null ? 0 : g.pitY - lastPitY;   // how far the world slid on screen this frame
    lastPitY = g.pitY;
    if (ok) { pass(B, false, g); pass(F, true, g); }
    return { intensity: (1 + flare) * level, shift };
  }

  addEventListener('resize', resize);
  resize();

  return {
    tick, cam,
    ok,
    pit() { return { x: geo.cx, y: geo.pitY, rx: geo.rx, ry: geo.ry, fh: geo.fh }; },
    wind() { return wind; },
    level() { return level; },
    wake() { waking = true; },
    gust(g) { gust = Math.max(gust, g); },
    flare(a) { flare = Math.max(flare, a); },
    intensity() { return (1 + flare) * level; }
  };
})();
