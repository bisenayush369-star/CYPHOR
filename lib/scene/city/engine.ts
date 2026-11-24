import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { Reflector } from "three/examples/jsm/objects/Reflector.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import type { Palette } from "../palettes"
import { drawAtlas, hasJapaneseFont } from "./atlas"
import {
  BLOCKS,
  BUILDING_FRAG,
  BUILDING_VERT,
  CAR_FRAG,
  CAR_LIGHT_FRAG,
  CAR_LIGHT_VERT,
  CAR_VERT,
  GRADE,
  LIGHT_FRAG,
  LIGHT_VERT,
  RAIN_FRAG,
  RAIN_VERT,
  ROAD_FRAG,
  ROAD_VERT,
  SIGN_GLOW_FRAG,
  SIGN_PANEL_FRAG,
  SIGN_VERT,
  SKY_FRAG,
  SKY_VERT,
} from "./glsl"
import { createGovernor } from "./governor"
import { BLOCK_LEN, CAPACITY, generateBlock, blockSeed, type Block } from "./layout"
import { rng } from "./rng"

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type Quality = "low" | "medium" | "high"
/** full: it moves. subtle: it moves slowly at half the frame rate. still: one frame, redrawn only when something changes. */
export type Motion = "full" | "subtle" | "still"

export interface CityOptions {
  palette: Palette
  quality: Quality
  motion: Motion
  /** Fixes the streets, for tests. Left out, every start builds a different city. */
  seed?: number
  /** Called when the machine cannot keep up even at the lowest quality. */
  onGiveUp?: () => void
  /** Keeps the quality as given and never gives up. For tests and screenshots on a machine with no graphics card. */
  pinned?: boolean
  onQuality?: (q: Quality) => void
}

export interface CityStats {
  fps: number
  frames: number
  quality: Quality
  motion: Motion
}

export type Layer = "sky" | "buildings" | "signs" | "glow" | "lights" | "cars" | "rain" | "road"

export interface City {
  /** Shows or hides parts of the city. For tests and for finding out which part is slow. */
  setLayers(layers: Partial<Record<Layer, boolean>>): void
  setPalette(p: Palette): void
  setMotion(m: Motion): void
  setQuality(q: Quality): void
  resize(width: number, height: number, dpr: number): void
  start(): void
  stop(): void
  /** Moves the city on by `seconds` without drawing (tests and the still view). */
  advance(seconds: number): void
  renderFrame(): void
  dispose(): void
  readonly stats: CityStats
}

interface Tier {
  dpr: number
  refl: number
  bloom: number
  rain: number
  ground: number
  air: number
}

const TIERS: Record<Quality, Tier> = {
  high: { dpr: 1.5, refl: 0.5, bloom: 0.5, rain: 4200, ground: 26, air: 22 },
  medium: { dpr: 1.25, refl: 0.35, bloom: 0.35, rain: 2400, ground: 20, air: 16 },
  low: { dpr: 1, refl: 0, bloom: 0, rain: 1200, ground: 12, air: 10 },
}
const ORDER: Quality[] = ["low", "medium", "high"]

const SPEED: Record<Motion, number> = { full: 9.5, subtle: 4.5, still: 0 }
const Z_MIN = -430
const Z_MAX = 30

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Layout = Record<string, number>

/** A geometry whose per-instance data lives in typed arrays we can rewrite whenever a block of city is rebuilt. */
function instanced(base: BufferGeometry, count: number, layout: Layout) {
  const g = new InstancedBufferGeometry()
  g.index = base.index
  for (const name of Object.keys(base.attributes)) g.setAttribute(name, base.attributes[name])
  const arrays: Record<string, Float32Array> = {}
  for (const [name, size] of Object.entries(layout)) {
    const arr = new Float32Array(count * size)
    arrays[name] = arr
    g.setAttribute(name, new InstancedBufferAttribute(arr, size))
  }
  g.instanceCount = count
  return { geometry: g, arrays }
}

/** Corner quads for lights: four vertices (and an id for which light of a vehicle it is). */
function quadSprites(ids: number): BufferGeometry {
  const g = new BufferGeometry()
  const pos: number[] = []
  const corner: number[] = []
  const id: number[] = []
  const index: number[] = []
  for (let k = 0; k < ids; k++) {
    const o = k * 4
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(0, 0, 0)
      corner.push(cx, cy)
      id.push(k)
    }
    index.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setAttribute("aCorner", new Float32BufferAttribute(corner, 2))
  g.setAttribute("aLight", new Float32BufferAttribute(id, 1))
  g.setIndex(index)
  return g
}

/** A car in side view, extruded across its width: low hood, sloping glass, short tail. Front is +z, 1.9 m wide. */
function carGeometry(flyer: boolean): BufferGeometry {
  const s = new Shape()
  let depth: number
  if (!flyer) {
    depth = 1.6
    s.moveTo(-2.2, 0.28)
    s.lineTo(-2.2, 0.8)
    s.quadraticCurveTo(-2.15, 0.95, -1.8, 0.98)
    s.lineTo(-1.3, 1.02)
    s.lineTo(-0.75, 1.4)
    s.lineTo(0.55, 1.42)
    s.lineTo(1.25, 1.0)
    s.lineTo(2.0, 0.86)
    s.quadraticCurveTo(2.25, 0.78, 2.25, 0.55)
    s.lineTo(2.2, 0.28)
    s.closePath()
  } else {
    depth = 1.3
    s.moveTo(-2.8, 0.3)
    s.lineTo(-2.8, 0.78)
    s.lineTo(-1.4, 0.95)
    s.lineTo(-0.2, 1.22)
    s.lineTo(1.2, 1.02)
    s.lineTo(3.0, 0.62)
    s.lineTo(3.0, 0.46)
    s.lineTo(2.4, 0.3)
    s.closePath()
  }
  const body = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 2, curveSegments: 6 })
  // Shape x becomes the car's length (+z is the front); the extrusion becomes its width, centred on x = 0.
  body.rotateY(-Math.PI / 2)
  body.translate(depth / 2, 0, 0)
  if (!flyer) return body
  const wings = new BoxGeometry(4.6, 0.07, 1.5).toNonIndexed()
  wings.translate(0, 0.62, -0.9)
  return mergeGeometries([body, wings])
}

function shader(vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }>, extra: Partial<ConstructorParameters<typeof ShaderMaterial>[0]> = {}) {
  return new ShaderMaterial({ vertexShader, fragmentShader, uniforms: uniforms as ConstructorParameters<typeof ShaderMaterial>[0] extends { uniforms?: infer U } ? U : never, ...extra })
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/* ------------------------------------------------------------------ */
/* The city                                                            */
/* ------------------------------------------------------------------ */

export async function createCity(canvas: HTMLCanvasElement, options: CityOptions): Promise<City> {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  renderer.setClearColor(0x000000, 1)

  let quality = options.quality
  let motion = options.motion
  let tier = TIERS[quality]
  let width = 1
  let height = 1
  let dpr = 1
  let frames = 0
  let running = false
  let raf = 0
  let lastNow = 0
  let lastDraw = 0
  let disposed = false
  const governor = createGovernor()

  const session = options.seed ?? (Math.floor(Math.random() * 4294967296) >>> 0)
  const random = rng(session ^ 0xa5a5a5a5)

  /* ---------- colours ---------- */
  const lightColors = Array.from({ length: 6 }, () => new Color())
  const shared = {
    uTime: { value: random.range(0, 1000) },
    uScroll: { value: 0 },
    uFog: { value: new Color() },
    uFogDensity: { value: 0.006 },
    uLights: { value: lightColors },
    uSkyTop: { value: new Color() },
    uSkyMid: { value: new Color() },
    uSkyLow: { value: new Color() },
    uGlow: { value: new Color() },
    uHead: { value: new Color() },
    uTail: { value: new Color() },
    uBlockZ: { value: new Array<number>(BLOCKS).fill(0) },
  }
  const rainColor = new Color()
  const tmp = new Color()

  function applyPalette(p: Palette) {
    p.city.lights.forEach((hex, i) => lightColors[i].set(hex))
    shared.uSkyTop.value.set(p.city.sky[0])
    shared.uSkyMid.value.set(p.city.sky[1])
    shared.uGlow.value.set(p.city.sky[2])
    shared.uSkyLow.value.set(p.city.sky[1]).lerp(tmp.set(p.city.sky[2]), 0.55).multiplyScalar(0.55)
    shared.uFog.value.set(p.city.fog).lerp(tmp.set(p.city.sky[2]), 0.2).multiplyScalar(0.55)
    shared.uHead.value.set(p.city.head)
    shared.uTail.value.set(p.city.tail)
    rainColor.set("#b8cbe8").lerp(tmp.set(p.city.sky[2]), 0.22).multiplyScalar(0.34)
  }
  applyPalette(options.palette)

  /* ---------- scene ---------- */
  const scene = new Scene()
  const camera = new PerspectiveCamera(58, 1, 0.5, 900)
  camera.rotation.order = "YXZ"

  // Sky
  const sky = new Mesh(
    new SphereGeometry(1, 32, 16),
    shader(SKY_VERT, SKY_FRAG, shared, { side: DoubleSide, depthTest: false, depthWrite: false })
  )
  sky.renderOrder = -100
  sky.frustumCulled = false
  scene.add(sky)

  // Atlas of signs
  const atlasCanvas = document.createElement("canvas")
  if (document.fonts?.load) {
    try {
      await Promise.race([document.fonts.load('700 48px "Oxanium"'), new Promise((r) => setTimeout(r, 1200))])
    } catch {
      /* the fallback font is fine */
    }
  }
  drawAtlas(atlasCanvas, hasJapaneseFont())
  const atlas = new CanvasTexture(atlasCanvas)
  atlas.generateMipmaps = true
  atlas.minFilter = LinearMipmapLinearFilter
  atlas.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())

  // Buildings
  const nB = BLOCKS * CAPACITY.buildings
  const buildings = instanced(new BoxGeometry(1, 1, 1), nB, { aPos: 3, aSize: 3, aInfo: 4 })
  const buildingMesh = new Mesh(buildings.geometry, shader(BUILDING_VERT, BUILDING_FRAG, shared))
  buildingMesh.frustumCulled = false
  scene.add(buildingMesh)

  // Signs: a solid panel and a soft glow, sharing one set of instance data.
  const nS = BLOCKS * CAPACITY.signs
  const signs = instanced(new PlaneGeometry(1, 1), nS, { aPos: 3, aDim: 4, aInfo: 4 })
  const panelMesh = new Mesh(
    signs.geometry,
    shader(SIGN_VERT, SIGN_PANEL_FRAG, { ...shared, uAtlas: { value: atlas }, uExt: { value: 1 }, uPush: { value: 0 } }, { side: DoubleSide })
  )
  panelMesh.frustumCulled = false
  scene.add(panelMesh)
  const glowMesh = new Mesh(
    signs.geometry,
    shader(SIGN_VERT, SIGN_GLOW_FRAG, { ...shared, uExt: { value: 2.4 }, uPush: { value: 0.05 }, uFadeEdge: { value: 1.2 } }, { side: DoubleSide, transparent: true, blending: AdditiveBlending, depthWrite: false })
  )
  glowMesh.frustumCulled = false
  glowMesh.renderOrder = 5
  scene.add(glowMesh)

  // Lamps, beacons, traffic lights
  const nL = BLOCKS * CAPACITY.lights
  const lights = instanced(quadSprites(1), nL, { aPos: 3, aInfo: 4 })
  const lightMesh = new Mesh(
    lights.geometry,
    shader(LIGHT_VERT, LIGHT_FRAG, shared, { transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  )
  lightMesh.frustumCulled = false
  lightMesh.renderOrder = 6
  scene.add(lightMesh)

  // Traffic
  const carUniforms = { ...shared, uZMin: { value: Z_MIN }, uZMax: { value: Z_MAX } }
  const nGround = TIERS.high.ground
  const nAir = TIERS.high.air
  const ground = instanced(carGeometry(false), nGround, { aA: 4, aB: 4, aC: 4 })
  const air = instanced(carGeometry(true), nAir, { aA: 4, aB: 4, aC: 4 })
  const groundMesh = new Mesh(ground.geometry, shader(CAR_VERT, CAR_FRAG, carUniforms, { side: DoubleSide }))
  const airMesh = new Mesh(air.geometry, shader(CAR_VERT, CAR_FRAG, carUniforms, { side: DoubleSide }))
  groundMesh.frustumCulled = airMesh.frustumCulled = false
  scene.add(groundMesh, airMesh)

  const groundLights = instanced(quadSprites(6), nGround, { aA: 4, aB: 4, aC: 4 })
  const airLights = instanced(quadSprites(6), nAir, { aA: 4, aB: 4, aC: 4 })
  const carLightMat = () => shader(CAR_LIGHT_VERT, CAR_LIGHT_FRAG, carUniforms, { transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  const groundLightMesh = new Mesh(groundLights.geometry, carLightMat())
  const airLightMesh = new Mesh(airLights.geometry, carLightMat())
  groundLightMesh.frustumCulled = airLightMesh.frustumCulled = false
  groundLightMesh.renderOrder = airLightMesh.renderOrder = 6
  scene.add(groundLightMesh, airLightMesh)

  // Fill the cars: where each one is, which way it faces and how fast it passes.
  function seedTraffic(arrs: { aA: Float32Array; aB: Float32Array; aC: Float32Array }[], flyer: boolean, count: number) {
    for (let i = 0; i < count; i++) {
      let x: number, y: number, rv: number, dir: number, len: number
      if (flyer) {
        x = random.range(-38, 38)
        y = random.pick([20, 28, 38, 52, 70, 96, 128]) + random.range(-3, 3)
        rv = random.range(6, 26) * (random.chance(0.5) ? 1 : -1)
        dir = rv > 0 ? 1 : -1
        len = random.range(0.9, 1.3)
      } else if (random.chance(0.62)) {
        x = random.pick([-4.2, -7.4]) + random.range(-0.25, 0.25)
        y = 0
        rv = random.range(16, 28)
        dir = 1
        len = random.chance(0.12) ? random.range(1.8, 2.3) : random.range(0.9, 1.15)
      } else {
        x = 6.6 + random.range(-0.25, 0.25)
        y = 0
        rv = random.range(3, 9)
        dir = -1
        len = random.chance(0.12) ? random.range(1.8, 2.3) : random.range(0.9, 1.15)
      }
      const z0 = random.range(Z_MIN, Z_MAX)
      const seed = random.next() * 100
      const hue = random.int(0, 5)
      for (const a of arrs) {
        a.aA.set([x, y, z0, rv], i * 4)
        a.aB.set([seed, dir, len, hue], i * 4)
        a.aC.set([flyer ? 1 : 0, random.range(2.5, 5), 0, 0], i * 4)
      }
    }
  }
  seedTraffic([ground.arrays as never, groundLights.arrays as never], false, nGround)
  seedTraffic([air.arrays as never, airLights.arrays as never], true, nAir)

  // The road, drawn by a Reflector so wet asphalt shows the street above it.
  const roadUniforms: Record<string, { value: unknown }> = {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uUseRefl: { value: tier.refl > 0 ? 1 : 0 },
    uWet: { value: 0.85 },
    uPool: { value: Array.from({ length: 12 }, () => new Vector4(0, 0, 1, 0)) },
    uPoolCol: { value: Array.from({ length: 12 }, () => new Color()) },
  }
  const road = new Reflector(new PlaneGeometry(90, 640), {
    textureWidth: 256,
    textureHeight: 256,
    clipBias: 0.003,
    multisample: 0,
    shader: { name: "RoadShader", uniforms: roadUniforms as never, vertexShader: ROAD_VERT, fragmentShader: ROAD_FRAG },
  })
  road.rotation.x = -Math.PI / 2
  road.position.set(0, 0, -300)
  road.frustumCulled = false
  // The reflector copies its uniforms; point the shared ones back at the live objects.
  const roadMaterial = road.material as ShaderMaterial
  Object.assign(roadMaterial.uniforms, shared)
  scene.add(road)
  const roadU = roadMaterial.uniforms
  const drawReflection = road.onBeforeRender
  road.onBeforeRender = function (this: unknown, ...args: Parameters<typeof drawReflection>) {
    if (tier.refl > 0) drawReflection.apply(road, args)
  }

  // Rain
  const rainBase = new PlaneGeometry(1, 1)
  rainBase.translate(0, 0.5, 0)
  const nRain = TIERS.high.rain
  const rain = instanced(rainBase, nRain, { aRain: 4 })
  for (let i = 0; i < nRain; i++) rain.arrays.aRain.set([random.next(), random.next(), random.next(), random.range(15, 26)], i * 4)
  const rainUniforms = {
    uTime: shared.uTime,
    uCam: { value: camera.position },
    uBox: { value: new Vector3(64, 40, 150) },
    uWind: { value: new Vector2(1.2, 0.2) },
    uRainColor: { value: rainColor },
  }
  const rainMesh = new Mesh(rain.geometry, shader(RAIN_VERT, RAIN_FRAG, rainUniforms, { transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
  rainMesh.frustumCulled = false
  rainMesh.renderOrder = 7
  scene.add(rainMesh)

  /* ---------- blocks of city ---------- */
  const blocks: Block[] = new Array(BLOCKS)
  const prevU: number[] = new Array(BLOCKS).fill(Infinity)
  let counter = 0
  let scroll = random.range(0, BLOCK_LEN)

  function writeBlock(i: number, b: Block) {
    const bA = buildings.arrays
    for (let k = 0; k < CAPACITY.buildings; k++) {
      const o = (i * CAPACITY.buildings + k) * 3
      const q = (i * CAPACITY.buildings + k) * 4
      const d = b.buildings[k]
      if (!d) {
        bA.aSize.set([0, 0, 0], o)
        continue
      }
      bA.aPos.set([d.x, d.y, d.z], o)
      bA.aSize.set([d.w, d.h, d.d], o)
      bA.aInfo.set([d.seed % 9973, d.style, d.lit, i], q)
    }
    const sA = signs.arrays
    for (let k = 0; k < CAPACITY.signs; k++) {
      const o = (i * CAPACITY.signs + k) * 3
      const q = (i * CAPACITY.signs + k) * 4
      const d = b.signs[k]
      if (!d) {
        sA.aDim.set([0, 0, 0, i], q)
        continue
      }
      sA.aPos.set([d.x, d.y, d.z], o)
      sA.aDim.set([d.w, d.h, d.rot, i], q)
      sA.aInfo.set([d.cell, d.hue, d.seed % 9973, d.kind], q)
    }
    const lA = lights.arrays
    for (let k = 0; k < CAPACITY.lights; k++) {
      const o = (i * CAPACITY.lights + k) * 3
      const q = (i * CAPACITY.lights + k) * 4
      const d = b.lights[k]
      if (!d) {
        lA.aInfo.set([0, 0, 0, i], q)
        continue
      }
      lA.aPos.set([d.x, d.y, d.z], o)
      lA.aInfo.set([d.hue, d.size, d.blink, i], q)
    }
    for (const g of [buildings.geometry, signs.geometry, lights.geometry]) for (const a of Object.values(g.attributes)) if ((a as InstancedBufferAttribute).isInstancedBufferAttribute) a.needsUpdate = true
    blocks[i] = b
  }

  function rebuild(i: number) {
    writeBlock(i, generateBlock(blockSeed(session, counter++)))
  }

  function placeBlocks() {
    for (let i = 0; i < BLOCKS; i++) {
      const u = (i * BLOCK_LEN + scroll) % (BLOCKS * BLOCK_LEN)
      if (u < prevU[i]) rebuild(i)
      prevU[i] = u
      shared.uBlockZ.value[i] = u - (BLOCKS - 1) * BLOCK_LEN
    }
  }

  /* ---------- light on the road ---------- */
  const poolData = roadUniforms.uPool.value as Vector4[]
  const poolCol = roadUniforms.uPoolCol.value as Color[]
  const candidates: { x: number; z: number; r: number; k: number; c: Color; d: number }[] = []
  function updatePools() {
    candidates.length = 0
    for (let i = 0; i < BLOCKS; i++) {
      const b = blocks[i]
      if (!b) continue
      const zo = shared.uBlockZ.value[i]
      for (const s of b.signs) {
        if (s.kind === 2 || s.y > 24) continue
        const z = zo + s.z
        if (z > 14 || z < -130) continue
        candidates.push({ x: s.x * 0.74, z, r: 4.5 + s.w * 0.7, k: s.kind === 1 ? 0.2 : 0.3, c: lightColors[s.hue], d: Math.abs(z + 4) })
      }
      for (const l of b.lights) {
        if (l.hue !== -3 || l.y > 9) continue
        const z = zo + l.z
        if (z > 14 || z < -130) continue
        candidates.push({ x: l.x * 0.8, z, r: 8, k: 0.38, c: tmp.set("#ff9a3c"), d: Math.abs(z + 4) })
      }
    }
    candidates.sort((a, b) => a.d - b.d)
    const dMax = candidates[12]?.d ?? 140
    for (let i = 0; i < 12; i++) {
      const c = candidates[i]
      if (!c) {
        poolData[i].set(0, 0, 1, 0)
        continue
      }
      const w = (1 - smooth(dMax * 0.55, dMax, c.d)) * (1 - smooth(4, 14, c.z))
      poolData[i].set(c.x, c.z, c.r, c.k * w)
      poolCol[i].copy(c.c)
    }
  }

  /* ---------- post processing ---------- */
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.32, 0.45, 1.15)
  composer.addPass(bloom)
  const grade = new ShaderPass({ ...GRADE, uniforms: { tDiffuse: { value: null }, uTime: shared.uTime, uRes: { value: new Vector2(1, 1) }, uAmount: { value: 1 } } } as never)
  composer.addPass(grade)
  composer.addPass(new OutputPass())

  /* ---------- sizing and quality ---------- */
  function applySize() {
    const eff = Math.min(dpr, tier.dpr)
    renderer.setPixelRatio(eff)
    renderer.setSize(width, height, false)
    composer.setPixelRatio(eff)
    composer.setSize(width, height)
    const aspect = width / Math.max(1, height)
    camera.aspect = aspect
    camera.fov = aspect < 1 ? 74 : 58
    camera.updateProjectionMatrix()
    bloom.enabled = tier.bloom > 0
    if (tier.bloom > 0) bloom.resolution.set(Math.max(64, width * eff * tier.bloom), Math.max(64, height * eff * tier.bloom))
    bloom.setSize(Math.max(64, width * eff * Math.max(tier.bloom, 0.25)), Math.max(64, height * eff * Math.max(tier.bloom, 0.25)))
    const rt = road.getRenderTarget()
    const rw = Math.max(64, Math.round(width * eff * Math.max(tier.refl, 0.25)))
    const rh = Math.max(64, Math.round(height * eff * Math.max(tier.refl, 0.25)))
    if (rt.width !== rw || rt.height !== rh) rt.setSize(rw, rh)
    ;(grade.uniforms.uRes.value as Vector2).set(width * eff, height * eff)
    roadU.uUseRefl.value = tier.refl > 0 ? 1 : 0
    rain.geometry.instanceCount = tier.rain
    ground.geometry.instanceCount = groundLights.geometry.instanceCount = tier.ground
    air.geometry.instanceCount = airLights.geometry.instanceCount = tier.air
  }

  /* ---------- time ---------- */
  function placeCamera() {
    const t = shared.uTime.value
    const sway = Math.sin(t * 0.13)
    camera.position.set(1.3 + sway * 0.7, 6.3 + Math.sin(t * 0.09) * 0.9 + Math.sin(t * 0.31) * 0.2, 0)
    camera.rotation.set(0.05 + Math.sin(t * 0.11) * 0.012, Math.sin(t * 0.07) * 0.05 - sway * 0.02, Math.sin(t * 0.17) * 0.006)
  }

  function advance(dt: number) {
    shared.uTime.value += dt
    scroll += SPEED[motion] * dt
    shared.uScroll.value = scroll
    placeCamera()
    placeBlocks()
    updatePools()
  }

  function renderFrame() {
    if (disposed) return
    composer.render()
    frames++
  }

  /* ---------- the loop ---------- */
  /** Judged on every animation callback, drawn or skipped: the gap between them is what the person feels (lib/scene/city/governor.ts). */
  function adapt(dtMs: number) {
    const atLowest = quality === ORDER[0]
    const verdict = governor.frame(dtMs, atLowest)
    if (options.pinned || verdict === "keep") return
    if (verdict === "give-up") options.onGiveUp?.()
    else api.setQuality(verdict === "lowest" ? ORDER[0] : ORDER[Math.max(0, ORDER.indexOf(quality) - 1)])
  }

  function loop(now: number) {
    if (!running || disposed) return
    raf = requestAnimationFrame(loop)
    const dtMs = lastNow ? now - lastNow : 16
    lastNow = now
    adapt(dtMs)
    if (disposed) return // it may just have given up
    if (motion === "subtle" && now - lastDraw < 32) return
    lastDraw = now
    advance(Math.min(dtMs / 1000, 0.1))
    renderFrame()
  }

  const layerMeshes: Record<Layer, Mesh[]> = {
    sky: [sky],
    buildings: [buildingMesh],
    signs: [panelMesh],
    glow: [glowMesh],
    lights: [lightMesh, groundLightMesh, airLightMesh],
    cars: [groundMesh, airMesh],
    rain: [rainMesh],
    road: [road],
  }

  const api: City = {
    setLayers(layers) {
      for (const [name, on] of Object.entries(layers) as [Layer, boolean][]) for (const m of layerMeshes[name] ?? []) m.visible = on
      if (!running) renderFrame()
    },
    setPalette(p) {
      applyPalette(p)
      if (!running) renderFrame()
    },
    setMotion(m) {
      motion = m
      if (!running) renderFrame()
    },
    setQuality(q) {
      quality = q
      tier = TIERS[q]
      governor.settle()
      applySize()
      options.onQuality?.(q)
      if (!running) renderFrame()
    },
    resize(w, h, d) {
      width = Math.max(1, Math.floor(w))
      height = Math.max(1, Math.floor(h))
      dpr = d
      governor.settle()
      applySize()
      if (!running) renderFrame()
    },
    start() {
      if (running || disposed) return
      running = true
      lastNow = 0
      governor.settle()
      raf = requestAnimationFrame(loop)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    advance,
    renderFrame,
    dispose() {
      if (disposed) return
      disposed = true
      running = false
      cancelAnimationFrame(raf)
      scene.traverse((o) => {
        const m = o as Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as ShaderMaterial | undefined
        if (mat?.dispose) mat.dispose()
      })
      road.dispose()
      atlas.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
    get stats() {
      return { fps: Math.round(governor.fps), frames, quality, motion }
    },
  }

  applySize()
  advance(0)
  return api
}
