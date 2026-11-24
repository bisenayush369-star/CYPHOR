/**
 * Shader source for the city. Everything is drawn procedurally: windows, concrete, wet asphalt, neon, clouds and rain
 * come from a few noise functions and the theme's colours, so there are no image assets to load.
 *
 * Colours arrive as uniforms in linear space and light values go above 1 on purpose: the bloom pass and the tone mapper
 * turn them into glow. Shaders are written in the old GLSL style; three.js converts them for WebGL 2.
 */

export const BLOCKS = 6

/** Noise, fog and the theme's six lights: included at the top of every fragment shader. */
export const COMMON = /* glsl */ `
#define BLOCKS ${BLOCKS}

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), f.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = .5, s = 0.;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; }
  return s;
}

uniform float uTime;
uniform vec3 uFog;
uniform float uFogDensity;
uniform vec3 uLights[6];

vec3 hueColor(float h) { return uLights[int(clamp(floor(h + .5), 0., 5.))]; }
vec3 hueColor01(float h) { return uLights[int(clamp(floor(h * 6.), 0., 5.))]; }

/** How much of the light survives the haze: 1 close up, 0 far away. Thicker near the ground. */
float fogKeep(float dist, float worldY) {
  float d = dist * uFogDensity;
  float low = exp(-max(worldY, 0.) * .011);
  return exp(-d * d * (.35 + .65 * low));
}
vec3 applyFog(vec3 col, float dist, float worldY) { return mix(uFog, col, fogKeep(dist, worldY)); }
`

/* ------------------------------------------------------------------ */
/* Sky                                                                 */
/* ------------------------------------------------------------------ */

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * (position * 10.), 1.);
  gl_Position = p.xyww;
}
`

export const SKY_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uSkyTop;
uniform vec3 uSkyMid;
uniform vec3 uSkyLow;
uniform vec3 uGlow;
varying vec3 vDir;

float skyline(float az, float el, float n, float maxH, float seed, out float lit) {
  float c = floor(az * n);
  float h = pow(hash11(c * 1.37 + seed), 2.4) * maxH + .004;
  float inside = step(el, h);
  vec2 g = vec2(az * n * 7., el * 150.);
  lit = step(.86, hash12(floor(g) + seed)) * inside;
  return inside;
}

void main() {
  vec3 d = normalize(vDir);
  float el = d.y;
  float az = atan(d.x, -d.z) / 6.2831853;
  float t = clamp(el, 0., 1.);

  vec3 col = mix(uSkyLow, uSkyMid, smoothstep(0., .22, t));
  col = mix(col, uSkyTop, smoothstep(.12, .8, t));

  // Low cloud lit from below by the city.
  vec2 cp = d.xz / (abs(el) + .14) * .9 + vec2(uTime * .006, uTime * .002);
  float cl = fbm(cp * 2.1);
  cl = smoothstep(.4, .8, cl) * smoothstep(0., .16, el);
  vec3 cloud = mix(uSkyMid, uGlow, .5) * .75;
  col = mix(col, cloud, cl * .7);

  // The glow at the far end of the street.
  float a = abs(az) * 6.2831853;
  col += uGlow * exp(-a * a * 2.4) * exp(-max(el, 0.) * 8.) * .8;

  // Far towers, three layers, each a little clearer than the one behind.
  float lit;
  float s1 = skyline(az, el, 70., .13, 3., lit);
  col = mix(col, uFog * .55, s1 * .92);
  col += uLights[2] * lit * .55;
  float s2 = skyline(az, el, 120., .08, 11., lit);
  col = mix(col, uFog * .4, s2 * .95);
  col += uLights[0] * lit * .4;
  float s3 = skyline(az, el, 200., .045, 23., lit);
  col = mix(col, uFog * .3, s3);
  col += uLights[1] * lit * .3;

  col = mix(col, uFog, smoothstep(.015, -.08, el));
  gl_FragColor = vec4(col, 1.);
}
`

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

export const BUILDING_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aSize;
attribute vec4 aInfo; // seed, style, lit, block
uniform float uBlockZ[${BLOCKS}];
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vN;
flat varying vec3 vSize;
flat varying vec4 vInfo;
void main() {
  vec3 p = position * aSize;
  vec3 world = aPos + p + vec3(0., 0., uBlockZ[int(aInfo.w + .5)]);
  vWorld = world;
  vLocal = p;
  vN = normal;
  vSize = aSize;
  vInfo = aInfo;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
}
`

export const BUILDING_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uSkyLow;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vN;
flat varying vec3 vSize;
flat varying vec4 vInfo;

void main() {
  vec3 N = normalize(vN);
  float seed = floor(vInfo.x + .5);
  float style = floor(vInfo.y + .5);
  float litAmt = vInfo.z;
  bool neon = mod(style, 2.) >= 1.;
  bool crown = mod(floor(style / 2.), 2.) >= 1.;
  bool glassB = mod(floor(style / 4.), 2.) >= 1.;
  bool brutal = mod(floor(style / 8.), 2.) >= 1.;
  bool fins = mod(floor(style / 32.), 2.) >= 1.;

  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float y = vWorld.y;
  vec3 col;

  if (N.y > .5) {
    col = vec3(.012, .014, .018);
  } else {
    float sideX = step(.5, abs(N.x));
    float hs = sideX > .5 ? vLocal.z * sign(N.x) : -vLocal.x * sign(N.z);
    float faceW = sideX > .5 ? vSize.z : vSize.x;
    float u = hs + faceW * .5;
    vec2 q = vec2(u, y);

    float fh = mix(3.3, 4.3, hash11(seed * .37));
    float cw = glassB ? mix(1.5, 2.0, hash11(seed * .91)) : mix(2.4, 3.8, hash11(seed * .91));
    if (brutal) cw *= 1.5;
    vec2 g = q / vec2(cw, fh);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    vec2 aa = fwidth(g) * 1.2;

    float wx = glassB ? .06 : .16;
    float wy = glassB ? .12 : .22;
    vec2 lo = vec2(wx, wy);
    vec2 hi = vec2(1. - wx, 1. - wy * .8);
    float m = (smoothstep(lo.x - aa.x, lo.x + aa.x, f.x) - smoothstep(hi.x - aa.x, hi.x + aa.x, f.x)) *
              (smoothstep(lo.y - aa.y, lo.y + aa.y, f.y) - smoothstep(hi.y - aa.y, hi.y + aa.y, f.y));
    float cover = (hi.x - lo.x) * (hi.y - lo.y);
    float far = smoothstep(.35, .9, max(aa.x, aa.y));
    m = mix(m, cover, far);

    // Concrete, with weathering streaks.
    float n1 = fbm(q * vec2(.25, .08) + seed);
    vec3 conc = mix(vec3(.014, .016, .021), vec3(.036, .039, .048), n1);
    conc *= mix(vec3(.8, .92, 1.18), vec3(1.18, 1.02, .88), hash11(seed * 5.1));
    conc *= .8 + .4 * vnoise(vec2(q.x * 2., q.y * .04 + seed));
    if (fins) conc += smoothstep(.88, .95, f.x) * .02;

    // Which windows are lit.
    float r = hash12(cell + seed * 17.3);
    float floorBias = .6 + .4 * hash12(vec2(cell.y, seed));
    float on = step(r, litAmt * floorBias * .46);
    float r2 = hash12(cell.yx + seed * 5.7);
    float flick = step(.992, r2) * step(0., sin(uTime * (3. + r2 * 30.)));
    on *= 1. - flick * .9;
    float warm = step(.2, hash12(cell * 1.3 + seed));
    vec3 white = mix(vec3(1., .76, .5), vec3(.72, .86, 1.), hash12(cell + 9.));
    vec3 wc = mix(hueColor01(hash12(cell * 2.1 + seed)), white, warm);
    float inten = .3 + .9 * hash12(cell * 3.7 + seed);
    inten *= mix(1.5, 1., warm);
    vec3 glassDark = vec3(.0025, .0042, .0075) + uSkyLow * .05 * pow(1. - max(dot(N, V), 0.), 3.);
    float blinds = mix(1., .55 + .45 * step(.5, fract(f.y * 7.)), step(.55, hash12(cell * 4.1 + seed)));
    float interior = mix(.55, 1.05, smoothstep(.1, .9, f.y)) * blinds;
    float bevel = smoothstep(0., .1, min(min(f.x - lo.x, hi.x - f.x), min(f.y - lo.y, hi.y - f.y)) * 3.);
    vec3 lit = glassDark + wc * on * inten * .7 * interior * mix(.5, 1., bevel);
    vec3 litAvg = glassDark + vec3(1., .8, .6) * (litAmt * .8 * .46 * .55 * .75);
    vec3 glass = mix(lit, litAvg, far);
    col = mix(conc, glass, m);

    // Shop fronts on the ground floor: a lit window behind a frame, with a sign band above it.
    if (y < 5.4) {
      float sw = 3.6 + 3.2 * hash11(seed);
      float sx = floor(u / sw);
      vec2 sc = vec2(fract(u / sw), y / 5.4);
      float fw = fwidth(u / sw);
      float frameX = smoothstep(.05, .08, sc.x) * (1. - smoothstep(.92, .95, sc.x));
      float frameY = smoothstep(.1, .13, sc.y) * (1. - smoothstep(.78, .81, sc.y));
      float glassM = frameX * frameY;
      float openShop = step(.15, hash12(vec2(sx, seed + 3.)));
      vec3 tint = mix(hueColor01(hash12(vec2(sx, seed))), vec3(1., .82, .58), .5);
      float grad = mix(.3, 1., smoothstep(.1, .78, sc.y));
      float mull = mix(step(.05, abs(fract(sc.x * 3.) - .5)), .85, smoothstep(.12, .35, fw * 3.));
      vec3 interior = tint * grad * (.42 + .22 * vnoise(vec2(u * 2., y * 3.) + seed)) * mull;
      float band = smoothstep(.83, .86, sc.y) * (1. - smoothstep(.95, .98, sc.y)) * frameX;
      vec3 bandCol = hueColor01(hash12(vec2(sx, seed + 7.))) * 1.3 * step(.45, hash12(vec2(sx, seed + 9.)));
      col = mix(col, vec3(.003, .004, .006) + interior * openShop, glassM);
      col += bandCol * band;
    }

    // Neon down the corners and along the crown.
    float edge = sideX > .5 ? abs(vLocal.z) : abs(vLocal.x);
    float hw = faceW * .5;
    if (neon) {
      float strip = smoothstep(hw - .5, hw - .35, edge) * (1. - smoothstep(hw - .12, hw - .02, edge));
      col += hueColor01(hash11(seed * 3.1)) * strip * 3.2 * (.85 + .15 * sin(uTime * 1.6 + seed));
    }
    if (crown) {
      float yt = vLocal.y - vSize.y * .5;
      col += hueColor01(hash11(seed * 7.7 + 1.)) * step(-1.3, yt) * step(yt, -.7) * 2.4;
    }
  }

  col *= mix(1., .8, smoothstep(30., 0., y));
  col = applyFog(col, dist, y);
  gl_FragColor = vec4(col, 1.);
}
`

/* ------------------------------------------------------------------ */
/* The road (drawn by the Reflector, so it can show the street in itself) */
/* ------------------------------------------------------------------ */

export const ROAD_VERT = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec3 vWorld;
void main() {
  vUv = textureMatrix * vec4(position, 1.);
  vWorld = (modelMatrix * vec4(position, 1.)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
`

export const ROAD_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tDiffuse;
uniform vec3 color;
uniform float uScroll;
uniform float uUseRefl;
uniform float uWet;
uniform vec3 uSkyLow;
uniform vec4 uPool[12];
uniform vec3 uPoolCol[12];
varying vec4 vUv;
varying vec3 vWorld;

// Expanding rings where rain lands.
vec2 ripples(vec2 p, float t) {
  vec2 sum = vec2(0.);
  for (int k = 0; k < 2; k++) {
    vec2 pp = p * (1.15 + float(k) * .6) + float(k) * 7.3;
    vec2 id = floor(pp);
    vec2 f = fract(pp) - .5;
    vec2 h = hash22(id);
    float ph = fract(t * (.55 + h.x * .5) + h.y);
    vec2 c = (h - .5) * .5;
    vec2 dv = f - c;
    float d = length(dv);
    float ring = exp(-pow((d - ph * .5) * 16., 2.)) * (1. - ph);
    sum += normalize(dv + 1e-4) * ring;
  }
  return sum;
}

void main() {
  vec2 w = vWorld.xz;
  float zm = vWorld.z - uScroll;
  float ax = abs(vWorld.x);
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  // The cross street at the far end of every 96 m block is open asphalt wall to wall.
  float lz = mod(-zm, 96.);
  float crossing = step(72., lz);
  float onRoad = max(step(ax, 9.), crossing);
  float walk = (1. - onRoad) * step(ax, 13.);

  vec3 asphalt = vec3(.011, .012, .015) * (.6 + .9 * fbm(w * .55));
  vec3 paving = vec3(.03, .032, .038) * (.7 + .6 * vnoise(w * 1.4));
  paving *= .9 + .1 * step(.04, abs(fract(w.x * .83) - .5)) * step(.04, abs(fract(zm * .83) - .5)) ;
  vec3 base = mix(vec3(.012, .013, .016), mix(paving, asphalt, onRoad), clamp(step(ax, 13.) + crossing, 0., 1.));

  // Markings: double yellow centre line, dashed lane lines, edge lines, crossings.
  float dash = step(mod(zm, 9.), 4.5);
  float centre = (1. - crossing) * step(abs(ax - .26), .07);
  float lane = (1. - crossing) * step(abs(ax - 4.6), .07) * dash;
  float edgeL = (1. - crossing) * step(abs(ax - 8.7), .08);
  float zebra = step(70.2, lz) * step(lz, 71.8) * step(.5, fract(vWorld.x / 1.3)) * step(ax, 9.);
  float stopLine = step(68.4, lz) * step(lz, 69.1) * step(ax, 9.) * step(0., vWorld.x);
  float paint = max(max(centre, lane), max(edgeL, max(zebra, stopLine)));
  vec3 paintCol = mix(vec3(.5, .45, .08), vec3(.55, .56, .6), step(.12, centre + lane + edgeL) * step(4., ax) + zebra + stopLine);
  paintCol = mix(paintCol, vec3(.7, .6, .1), centre);
  float wear = .5 + .5 * vnoise(w * 3.);
  base = mix(base, paintCol * (.16 + .26 * wear), paint * onRoad * .9);

  // How wet it is: damp everywhere, puddles in places.
  float damp = smoothstep(.25, .6, fbm(w * .18 + 11.));
  float puddle = smoothstep(.52, .68, fbm(w * .33 + 3.));
  float wet = clamp(uWet * (.55 + .45 * damp) + puddle, 0., 1.);
  float rough = mix(.5, .015, wet);

  // Rain landing in the wet.
  vec2 rip = ripples(w, uTime) * wet;
  vec3 n = normalize(vec3(rip.x * .5, 1., rip.y * .5));

  float fres = .035 + .965 * pow(1. - max(dot(n, V), 0.), 5.);
  vec3 refl;
  if (uUseRefl > .5) {
    vec2 uv = vUv.xy / vUv.w;
    vec2 off = n.xz * (.018 + rough * .05) + (vec2(vnoise(w * 2.1), vnoise(w * 2.1 + 5.)) - .5) * rough * .03;
    uv += off;
    // Wet asphalt smears the reflection up and down, so sample along the vertical.
    float stepV = .0045 + rough * .02;
    vec3 acc = vec3(0.);
    float tw = 0.;
    for (int i = -3; i <= 3; i++) {
      float k = float(i);
      float wt = exp(-k * k * .18);
      acc += texture2D(tDiffuse, uv + vec2(k * stepV * .25, k * stepV)).rgb * wt;
      tw += wt;
    }
    refl = acc / tw;
  } else {
    float s = clamp(V.y * 4., 0., 1.);
    refl = mix(uSkyLow, uFog, .5) * .5;
  }

  // Light pooled on the surface from signs, lamps and shop windows.
  vec3 pools = vec3(0.);
  for (int i = 0; i < 12; i++) {
    vec4 p = uPool[i];
    vec2 dv = w - p.xy;
    float d2 = dot(dv * vec2(1., .55), dv * vec2(1., .55));
    pools += uPoolCol[i] * p.w * exp(-d2 / (p.z * p.z));
  }

  vec3 diffuse = base * (1. + pools * 32.) + pools * .09 * (1. - wet * .5);
  float showRefl = fres * (.35 + .65 * wet);
  vec3 col = mix(diffuse, refl * (.55 + .45 * wet), clamp(showRefl, 0., 1.));
  col = applyFog(col, dist, 0.);
  gl_FragColor = vec4(col, 1.);
}
`

/* ------------------------------------------------------------------ */
/* Signs                                                               */
/* ------------------------------------------------------------------ */

export const SIGN_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aDim;  // width, height, rotation about Y, block
attribute vec4 aInfo; // atlas cell, hue 0..5, seed, kind
uniform float uBlockZ[${BLOCKS}];
uniform float uExt;
uniform float uPush;
varying vec2 vQ;
flat varying vec4 vInfo;
varying vec3 vWorld;
flat varying vec2 vSizeM;
void main() {
  vec2 s = aDim.xy;
  float c = cos(aDim.z);
  float sn = sin(aDim.z);
  vec3 lp = vec3(position.x * s.x * uExt, position.y * s.y * uExt, uPush);
  vec3 rp = vec3(lp.x * c + lp.z * sn, lp.y, -lp.x * sn + lp.z * c);
  vec3 world = aPos + rp + vec3(0., 0., uBlockZ[int(aDim.w + .5)]);
  vQ = position.xy * uExt;
  vInfo = aInfo;
  vWorld = world;
  vSizeM = s;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
}
`

export const SIGN_PANEL_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uAtlas;
varying vec2 vQ;
flat varying vec4 vInfo;
varying vec3 vWorld;
flat varying vec2 vSizeM;

vec4 atlasRect(float c) {
  if (c < 48.) {
    float col = mod(c, 8.);
    float row = floor(c / 8.);
    return vec4(col / 8., 1. - (row + 1.) * .125, .125, .125);
  }
  float k = c - 48.;
  return vec4(k / 16., 0., 1. / 16., .25);
}

void main() {
  if (max(abs(vQ.x), abs(vQ.y)) > .5) discard;
  float kind = floor(vInfo.w + .5);
  float seed = floor(vInfo.z + .5);
  float cellId = floor(vInfo.x + .5);
  float hueId = floor(vInfo.y + .5);
  vec3 hue = hueColor(hueId);
  vec2 p = vQ + .5;
  vec3 col;
  float dist = length(cameraPosition - vWorld);

  if (kind < 1.5) {
    vec4 rect = atlasRect(cellId);
    vec4 t = texture2D(uAtlas, rect.xy + p * rect.zw);
    float buzz = hash11(floor(uTime * 6. + seed)) > .965 ? .3 : 1.;
    vec3 core = mix(hue, vec3(1.), .5) * t.r * 3.4;
    vec3 glow = hue * t.g * 1.5;
    vec3 plate = hue * .05 * t.b + vec3(.004);
    col = (core + glow) * buzz + plate;
  } else {
    // A big screen: bands, drifting blobs and glitch bars in the theme's lights.
    float t = uTime * .35 + seed * .001;
    float bands = .5 + .5 * sin(p.y * 6. + t * 2. + sin(p.x * 3. + t));
    float blobs = fbm(p * vec2(3., 5.) + vec2(t * .3, -t * .5));
    vec3 a = hue;
    vec3 b = hueColor(mod(hueId + 2., 6.));
    vec3 c = hueColor(mod(hueId + 4., 6.));
    vec3 video = mix(a, b, smoothstep(.3, .7, blobs)) * (.35 + bands * .9);
    float bar = step(.5, fract(p.y * 3. + t * .2)) * smoothstep(.6, .9, sin(p.x * 20. + t * 5.) * .5 + .5);
    video += c * bar * bar * 1.2;
    video *= .85 + .15 * sin(p.y * 240.);
    float e = max(abs(vQ.x), abs(vQ.y));
    col = video * 1.7 + hue * smoothstep(.465, .5, e) * 3.;
  }
  col = applyFog(col, dist, vWorld.y);
  gl_FragColor = vec4(col, 1.);
}
`

export const SIGN_GLOW_FRAG = /* glsl */ `
${COMMON}
uniform float uFadeEdge;
varying vec2 vQ;
flat varying vec4 vInfo;
varying vec3 vWorld;
flat varying vec2 vSizeM;
void main() {
  float kind = floor(vInfo.w + .5);
  vec3 hue = hueColor(vInfo.y);
  vec2 d = max(abs(vQ) - .5, 0.);
  float dm = length(d * vSizeM);
  float inside = 1. - step(max(abs(vQ.x), abs(vQ.y)), .5) * .75;
  float k = kind > 1.5 ? .14 : .5;
  float edgeFade = 1. - smoothstep(.55, uFadeEdge, max(abs(vQ.x), abs(vQ.y)));
  float halo = exp(-dm * k) * inside * edgeFade;
  float dist = length(cameraPosition - vWorld);
  vec3 c = hue * halo * (kind > 1.5 ? .2 : .1);
  c *= fogKeep(dist, vWorld.y);
  gl_FragColor = vec4(c, 1.);
}
`

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export const CAR_POS = /* glsl */ `
attribute vec4 aA; // lane x, altitude, start z, speed toward the camera
attribute vec4 aB; // seed, facing (+1 toward camera), length scale, hue
attribute vec4 aC; // 1 for a flyer, blink rate
uniform float uZMin;
uniform float uZMax;
vec3 carCentre() {
  float z = aA.z + aA.w * uTime;
  z = uZMin + mod(z - uZMin, uZMax - uZMin);
  return vec3(aA.x, aA.y, z);
}
`

export const CAR_VERT = /* glsl */ `
uniform float uTime;
${CAR_POS}
varying vec3 vWorld;
varying vec3 vN;
flat varying vec4 vB;
void main() {
  vec3 p = position;
  p.z *= aB.z * aB.y;
  vec3 world = carCentre() + p;
  vWorld = world;
  vN = vec3(normal.xy, normal.z * aB.y);
  vB = aB;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
}
`

export const CAR_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uSkyMid;
varying vec3 vWorld;
varying vec3 vN;
flat varying vec4 vB;
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 tint = hueColor(vB.w);
  float fres = pow(1. - max(dot(N, V), 0.), 3.);
  if (hash12(gl_FragCoord.xy) > smoothstep(7., 20., dist)) discard;
  vec3 col = vec3(.006) + tint * .01 + tint * fres * .28 + uSkyMid * pow(max(N.y, 0.), 4.) * .1;
  col = applyFog(col, dist, vWorld.y);
  gl_FragColor = vec4(col, 1.);
}
`

export const CAR_LIGHT_VERT = /* glsl */ `
uniform float uTime;
${CAR_POS}
attribute vec2 aCorner;
attribute float aLight;
varying vec2 vC;
varying float vKind;
varying float vFade;
varying float vDist;
varying float vY;
void main() {
  vec3 c = carCentre();
  float dir = aB.y;
  float len = aB.z;
  float flyer = aC.x;
  float side = mod(aLight, 2.) < .5 ? -1. : 1.;
  vec3 off;
  float size;
  float on = 1.;
  if (aLight < 1.5) { off = vec3(side * .72, .5, 2.15 * len * dir); size = 1.3 + flyer * .5; vKind = 0.; }
  else if (aLight < 3.5) { off = vec3(side * .74, .52, -2.15 * len * dir); size = .7; vKind = 1.; }
  else if (aLight < 4.5) { off = vec3(0., -.25, 0.); size = flyer > .5 ? 3.4 : 0.; vKind = 2.; }
  else { off = vec3(0., .95, -.6 * len * dir); size = flyer > .5 ? .6 : 0.; vKind = 3.; on = step(.5, sin(uTime * aC.y + aB.x)); }
  vec4 vp = viewMatrix * vec4(c + off, 1.);
  vDist = length(vp.xyz);
  vY = c.y;
  if (size > 0.) size = max(size, vDist * .011);
  vp.xy += aCorner * size * on;
  vC = aCorner;
  vFade = 1.;
  gl_Position = projectionMatrix * vp;
}
`

export const CAR_LIGHT_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uHead;
uniform vec3 uTail;
varying vec2 vC;
varying float vKind;
varying float vDist;
varying float vY;
void main() {
  float r2 = dot(vC, vC);
  float a = (exp(-r2 * 9.) + exp(-r2 * 2.6) * .2) * (1. - smoothstep(.62, 1., sqrt(r2)));
  vec3 c;
  if (vKind < .5) c = uHead * 5.;
  else if (vKind < 1.5) c = uTail * 3.6;
  else if (vKind < 2.5) c = uLights[2] * .55;
  else c = uTail * 3.;
  c *= a * fogKeep(vDist, vY) * smoothstep(5., 16., vDist);
  gl_FragColor = vec4(c, 1.);
}
`

/* ------------------------------------------------------------------ */
/* Lamps, rooftop beacons and traffic lights                           */
/* ------------------------------------------------------------------ */

export const LIGHT_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aInfo; // hue code, size, blink rate, block
attribute vec2 aCorner;
uniform float uBlockZ[${BLOCKS}];
uniform float uTime;
varying vec2 vC;
flat varying vec4 vInfo;
varying float vDist;
varying float vY;
varying float vPulse;
void main() {
  vec3 world = aPos + vec3(0., 0., uBlockZ[int(aInfo.w + .5)]);
  vec4 vp = viewMatrix * vec4(world, 1.);
  vDist = length(vp.xyz);
  vY = world.y;
  float pulse = 1.;
  if (aInfo.z > 0.) pulse = pow(max(0., sin(uTime * aInfo.z * 6.2831853 + aPos.x * .37)), 4.);
  vPulse = pulse;
  float size = max(aInfo.y * (.35 + .65 * pulse), vDist * .01);
  vp.xy += aCorner * size;
  vC = aCorner;
  vInfo = aInfo;
  gl_Position = projectionMatrix * vp;
}
`

export const LIGHT_FRAG = /* glsl */ `
${COMMON}
varying vec2 vC;
flat varying vec4 vInfo;
varying float vDist;
varying float vY;
varying float vPulse;
void main() {
  float r2 = dot(vC, vC);
  float a = (exp(-r2 * 14.) + exp(-r2 * 4.) * .16) * (1. - smoothstep(.62, 1., sqrt(r2)));
  float h = vInfo.x;
  vec3 c = h > -.5 ? hueColor(h) * 2.2 : (h > -1.5 ? vec3(1., .86, .66) * 2.6 : (h > -2.5 ? vec3(1., .04, .02) * 5. : vec3(1., .6, .24) * 2.4));
  c *= a * vPulse * fogKeep(vDist, vY);
  gl_FragColor = vec4(c, 1.);
}
`

/* ------------------------------------------------------------------ */
/* Rain                                                                */
/* ------------------------------------------------------------------ */

export const RAIN_VERT = /* glsl */ `
attribute vec4 aRain; // x, y, z in the rain box (0..1), speed
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uBox;
uniform vec2 uWind;
varying float vA;
void main() {
  float speed = aRain.w;
  vec3 b = aRain.xyz;
  float y = mod(b.y * uBox.y - uTime * speed, uBox.y);
  vec3 p = vec3((b.x - .5) * uBox.x + uWind.x * (y / uBox.y) * 4., y, -b.z * uBox.z + 14.) + vec3(uCam.x, 0., uCam.z);
  vec3 vel = normalize(vec3(uWind.x, -speed, uWind.y));
  float len = .5 + speed * .028;
  vec3 A = (viewMatrix * vec4(p, 1.)).xyz;
  vec3 B = (viewMatrix * vec4(p - vel * len, 1.)).xyz;
  vec3 dirV = B - A;
  vec3 side = normalize(cross(dirV, A) + vec3(1e-5)) * .02 * (1. + length(A) * .02);
  vec3 v = mix(A, B, position.y) + side * position.x;
  vA = (1. - position.y * .7) * smoothstep(0., 3., length(A)) * exp(-length(A) * .011);
  gl_Position = projectionMatrix * vec4(v, 1.);
}
`

export const RAIN_FRAG = /* glsl */ `
uniform vec3 uRainColor;
varying float vA;
void main() { gl_FragColor = vec4(uRainColor * vA, 1.); }
`

/* ------------------------------------------------------------------ */
/* Finishing: a little colour fringing at the edges, vignette, grain    */
/* ------------------------------------------------------------------ */

export const GRADE = {
  uniforms: { tDiffuse: { value: null as unknown }, uTime: { value: 0 }, uRes: { value: [1, 1] as unknown }, uAmount: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uAmount;
    varying vec2 vUv;
    float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 c = vUv - .5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * .014 * uAmount;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1. - smoothstep(.3, 1., r2 * 1.7) * .5;
      col += (h12(vUv * uRes + fract(uTime) * 91.) - .5) * .014 * uAmount;
      gl_FragColor = vec4(max(col, 0.), 1.);
    }
  `,
}
