/* world.js — the whole scene drawn by one fragment shader from a first-person camera:
   sky, stars, horizon fog, the ground scrolling under you as you walk, the pit, the coals,
   the fire, its smoke and heat. A second pass draws the pit's near flames over the paper. */
let World_error = null;
const World = (() => {
  const back = document.getElementById('world');
  const front = document.getElementById('world-front');

  const VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime, uHorizon, uWind, uLevel, uFlare, uFront, uWalk, uSway, uGlow, uFH;
uniform vec4 uPit;    // cx, cy, rx, ry  (canvas px, y down)

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a*noise(p); p = mat2(1.6,1.2,-1.2,1.6)*p; a *= 0.5; }
  return v;
}

vec3 ramp(float t){
  vec3 c = mix(vec3(0.12,0.01,0.0), vec3(0.78,0.10,0.02), smoothstep(0.0,0.22,t));
  c = mix(c, vec3(1.0,0.40,0.05), smoothstep(0.18,0.5,t));
  c = mix(c, vec3(1.0,0.78,0.22), smoothstep(0.48,0.84,t));
  c = mix(c, vec3(1.0,0.95,0.78), smoothstep(0.84,1.0,t));
  return c;
}

// flame density. p.x across the base (1 = half width), p.y up from the base (1 = full height).
// the coordinates are warped by slower noise so the fire breaks into tongues instead of a smudge.
float flameD(vec2 p, float seed, float top){
  if (p.y < -0.25 || p.y > top || abs(p.x) > 1.35) return 0.0;
  float y = max(p.y, 0.0);
  p.x -= clamp(uWind, -2.2, 2.2) * y * y * 0.26;
  float t = uTime;
  vec2 q = vec2(fbm(vec2(p.x*1.9 + seed, y*2.3 - t*1.5 + seed*3.0)),
                fbm(vec2(p.x*1.9 + 5.2 + seed, y*2.3 - t*1.15)));
  vec2 w = p + (q - 0.5)*vec2(0.6, 0.9);
  float n  = fbm(vec2(w.x*2.6 + seed, w.y*3.4 - t*2.3));
  float n2 = noise(vec2(w.x*9.0 + seed*2.0, w.y*13.0 - t*4.8));
  float width = 1.0 - y*0.55;
  float shape = 1.0 - smoothstep(0.55, 1.15, abs(w.x)/max(width, 0.05));
  shape *= smoothstep(top, top*0.38, y);
  shape *= smoothstep(-0.25, 0.08, p.y);
  float d = shape*(0.46 + n*1.3) + (n2 - 0.5)*0.22 - 0.46;
  d *= (0.5 + uLevel*0.45 + uFlare*0.45);
  return clamp(smoothstep(0.0, 1.0, d), 0.0, 1.0);
}

// one row of fire across the pit. k is where the row stands in the pit's depth (-1 back .. 1 front)
float row(vec2 frag, float k, float seed, float hgt, float top){
  float baseY = uPit.y + uPit.w*k;
  float chord = sqrt(max(0.0, 1.0 - k*k*0.85));
  float halfW = uPit.z*chord*0.98;
  vec2 p = vec2((frag.x - uPit.x)/halfW, (baseY - frag.y)/(uFH*hgt));
  return flameD(p, seed, top);
}

void addFlame(inout vec3 col, float d){
  col = col*(1.0 - d*0.5) + ramp(d)*d*1.1 + vec3(1.0,0.93,0.78)*pow(max(d, 0.0), 3.0)*0.3;
}

void main(){
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  if (uFront > 0.5) {
    // the near rows of the fire: they stand in front of whatever lies in the pit
    float d1 = row(frag, 0.38, 2.7, 0.62, 1.2);
    float d2 = row(frag, 0.82, 4.2, 0.42, 1.0);
    vec3 c = vec3(0.0); float a = 0.0;
    c = c*(1.0 - d1*0.5) + ramp(d1)*d1*1.1 + vec3(1.0,0.93,0.78)*pow(max(d1, 0.0), 3.0)*0.3; a = a*(1.0 - d1*0.5) + d1*0.6;
    c = c*(1.0 - d2*0.5) + ramp(d2)*d2*1.1 + vec3(1.0,0.93,0.78)*pow(max(d2, 0.0), 3.0)*0.3; a = a*(1.0 - d2*0.5) + d2*0.6;
    c = 1.0 - exp(-c*1.35);
    gl_FragColor = vec4(c*min(a, 1.0), min(a, 1.0));
    return;
  }

  float fireBase = uPit.y - uPit.w*0.75;
  // heat shimmer bends the background above the flames
  float heat = smoothstep(uPit.z*2.2, 0.0, abs(frag.x - uPit.x))
             * smoothstep(fireBase + uPit.w*1.6, fireBase - uFH*0.5, frag.y)
             * smoothstep(fireBase - uFH*2.6, fireBase - uFH*1.1, frag.y);
  vec2 bg = frag + vec2(fbm(vec2(frag.x*0.012, frag.y*0.012 - uTime*1.8)) - 0.5) * 10.0 * heat * (0.5 + uLevel);

  // sky: everything above the horizon pans with the camera
  float h = uHorizon;
  float hs = max(h, 1.0);
  float st = clamp(bg.y / hs, 0.0, 1.0);
  vec3 col = mix(vec3(0.045,0.04,0.055), vec3(0.10,0.075,0.065), st*st);
  vec2 sky = vec2(bg.x - uSway*0.3, bg.y - h);
  vec2 sp = floor(sky / 22.0);
  float sh = hash(sp);
  if (bg.y < h && sh > 0.975) {
    vec2 c = (sp + 0.5)*22.0 + (vec2(hash(sp+1.0), hash(sp+2.0)) - 0.5)*14.0;
    float dd = length(sky - c);
    float tw = 0.5 + 0.5*sin(uTime*(1.0 + hash(sp+3.0)*2.0) + sh*50.0);
    col += vec3(0.7,0.75,0.9) * smoothstep(1.6, 0.0, dd) * (0.15 + 0.35*tw) * (1.0 - st);
  }
  // fog on the horizon, drifting with the wind
  float fz = (bg.y - h)/(uRes.y*0.08);
  float fogb = exp(-fz*fz);
  col = mix(col, vec3(0.13,0.14,0.17), fogb*0.5);
  float drift = fbm(vec2(sky.x*0.0025 - uTime*0.02 - uWind*0.03, sky.y*0.01));
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
  vec2 pr = vec2((frag.x - uPit.x)/(uPit.z*1.7), (frag.y - uPit.y)/(uPit.w*2.2));
  float pool = exp(-dot(pr,pr)*1.3) * (0.3 + uGlow*0.5) * uLevel;
  if (frag.y > h) col += vec3(1.0,0.42,0.1) * pool * 0.45;

  // the pit: a ring of stones, coals inside
  vec2 pe = vec2((frag.x - uPit.x)/uPit.z, (frag.y - uPit.y)/uPit.w);
  float e = dot(pe, pe);
  if (e < 1.35) {
    float ring = smoothstep(0.82, 0.95, e) * smoothstep(1.3, 1.08, e);
    float ang = atan(pe.y, pe.x);
    float sn = noise(vec2(ang*6.5 + e*1.5, e*5.0 + 3.0));
    float sn2 = noise(vec2(ang*23.0, e*30.0));
    float stones = smoothstep(0.3, 0.62, sn)*(0.7 + sn2*0.5);
    float lit = 0.5 + 0.5*clamp(-pe.y, -1.0, 1.0);   // the far stones face the fire; the near ones face us
    vec3 stone = vec3(0.075,0.06,0.055)*(0.3 + stones*1.1) + vec3(0.6,0.22,0.05)*uGlow*stones*lit*0.9;
    col = mix(col, stone, ring);
    float inside = smoothstep(0.95, 0.75, e);
    vec2 cp = vec2(pe.x*uPit.z, pe.y*uPit.w*2.0)*0.07;
    float big = fbm(cp*0.22 + 7.0);                      // which parts of the bed are alive
    float coal = fbm(cp + vec2(0.0, uTime*0.05));
    float cracks = noise(cp*3.5);
    float pulse = 0.55 + 0.45*sin(uTime*1.4 + coal*16.0 + big*6.0);
    float centre = smoothstep(0.95, 0.1, e);
    float alive = smoothstep(0.3, 0.65, big)*(0.45 + centre*0.55);
    float hot = pow(max(coal, 0.0), 3.5)*3.4*smoothstep(0.45, 0.8, cracks)*pulse*alive*(0.3 + uLevel*0.7 + uFlare*0.6);
    hot += pow(max(noise(cp*14.0 + vec2(uTime*0.3, 0.0)), 0.0), 7.0)*alive*2.5*(0.5 + 0.5*pulse);   // embers in the ash
    float char = noise(cp*8.0);
    vec3 coals = vec3(0.028,0.016,0.012)*(0.5 + char*0.9);
    coals = mix(coals, vec3(0.85,0.2,0.02), clamp(hot,0.0,1.0)) + vec3(1.0,0.62,0.2)*clamp(hot-0.75,0.0,1.0)*1.1;
    // the bed under the flames glows through the ash
    coals += vec3(0.7,0.22,0.03)*centre*alive*uLevel*(0.2 + uGlow*0.25);
    col = mix(col, coals, inside);
  }

  // glow around the fire
  vec2 gr = vec2((frag.x - uPit.x)/(uPit.z*1.5), (frag.y - (fireBase - uFH*0.35))/(uFH*0.85));
  float glow = exp(-dot(gr,gr)*1.2) * (0.35 + uGlow*0.4) * uLevel;
  col += vec3(1.0,0.4,0.1)*glow*0.55;

  // smoke above the flames
  vec2 sm = vec2((frag.x - uPit.x)/uPit.z, (fireBase - frag.y)/uFH);
  if (sm.y > 0.7 && sm.y < 3.0) {
    float sx = sm.x - uWind*(sm.y-0.7)*0.9;
    float sn = fbm(vec2(sx*1.6, sm.y*1.2 - uTime*0.55));
    float sw = 1.0 - smoothstep(0.0, 1.0, abs(sx)/(0.5 + (sm.y-0.7)*0.7));
    float smoke = sw * smoothstep(0.7, 1.2, sm.y) * smoothstep(3.0, 1.8, sm.y) * smoothstep(0.35, 0.75, sn) * 0.55 * uLevel;
    col = mix(col, vec3(0.16,0.14,0.14), smoke);
  }

  // the fire: the back rows, standing across the depth of the pit. the near rows are drawn by the front pass.
  addFlame(col, row(frag, -0.72, 0.0, 1.0, 1.55));
  addFlame(col, row(frag, -0.25, 1.4, 0.86, 1.35));

  col = 1.0 - exp(-col * 1.35);
  gl_FragColor = vec4(col, 1.0);
}`;

  const NAMES = ['uRes', 'uTime', 'uHorizon', 'uWind', 'uLevel', 'uFlare', 'uFront', 'uWalk', 'uSway', 'uGlow', 'uFH', 'uPit'];
  function makeGL(canvas, alpha) {
    const opts = { alpha, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return null;
    const prog = gl.createProgram();
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('shader:', gl.getShaderInfoLog(s)); World_error = gl.getShaderInfoLog(s); }
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
  let geo = { horizon: 0, cx: 0, pitY: 0, rx: 1, ry: 1, fh: 1 };
  let last = null;

  function resize() {
    W = innerWidth; H = innerHeight;
    S = Math.min(1, 1000 / W);                  // render a touch under full res on wide screens
    back.width = front.width = Math.round(W * S);
    back.height = front.height = Math.round(H * S);
    if (ok) { B.gl.viewport(0, 0, back.width, back.height); F.gl.viewport(0, 0, front.width, front.height); }
  }

  function layout() {
    const d = cam.dist, t = cam.tilt;
    const horizon = H * (0.5 - t * 0.85) + cam.bob;
    const nearY = H * (0.70 + (1 - d) * 0.22);
    const pitY = nearY + (H * 0.58 - nearY) * t + cam.bob;
    // the pit is sized off the width, but on a tall narrow screen it goes by the height instead so it stays readable
    const rx = Math.min(W * 0.46, Math.max(W * (0.165 + (1 - d) * 0.135), H * (0.11 + (1 - d) * 0.1))) * (1 + t * 0.08);
    const ry = rx * (0.16 + t * 0.4);
    const fh = Math.min(H * (0.42 + (1 - d) * 0.22), rx * 2.3) * (1 - t * 0.2);
    geo = { horizon, cx: W * 0.5 + cam.sway, pitY, rx, ry, fh };
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
    if (++glowTick % 4 === 0) document.documentElement.style.setProperty('--fire-glow', glow.toFixed(3));
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
    gl.uniform1f(u.uFH, g.fh * S);
    gl.uniform4f(u.uPit, g.cx * S, g.pitY * S, g.rx * S, g.ry * S);
    if (isFront) gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(dt) {
    update(dt);
    const g = layout();
    // how far the world slid on screen this frame, near the pit and up in the sky
    const shift = last ? { pit: g.pitY - last.pitY, sky: g.horizon - last.horizon } : { pit: 0, sky: 0 };
    last = { pitY: g.pitY, horizon: g.horizon };
    if (ok) { pass(B, false, g); pass(F, true, g); }
    return { intensity: (1 + flare) * level, shift };
  }

  addEventListener('resize', resize);
  resize();

  return {
    tick, cam,
    ok, error: () => World_error,
    pit() { return { x: geo.cx, y: geo.pitY, rx: geo.rx, ry: geo.ry, fh: geo.fh, horizon: geo.horizon }; },
    wind() { return wind; },
    level() { return level; },
    wake() { waking = true; },
    gust(g) { gust = Math.max(gust, g); },
    flare(a) { flare = Math.max(flare, a); },
    intensity() { return (1 + flare) * level; }
  };
})();
