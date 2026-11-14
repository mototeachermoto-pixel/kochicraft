import * as THREE from 'three';
import type { SceneObject } from '@/spots/SpotDefinition';

/**
 * 名所の「光の柱」（2026-11-14 先生の希望：遠くからでも、ここが名所だと分かるうっすらとした目印。
 * 近くに行ったら消えて、名所の名前が出るように。黄色い枠線は分かりづらいのでやめる）。
 *
 *  - 名所の代表点（focus）の真下から空へ、細く半透明の光の筋が立ちのぼる。根もとが明るく、上ほど空にとける。
 *    まわりにもう一回り太い、ごく薄い光（にじみ）をかさね、根もとの地面には丸い光のしみ。
 *  - 光の帯がゆっくり上へ流れる（動きをへらす設定の端末では止める）。
 *  - 近づくほど薄くなり、正面で向き合って名前が出たら（WorldManager の near）すっと消える。
 *  - 一度名前を見た（または説明を開いた）名所は、光を弱くする＝「まだ行っていない名所」が目立つ。
 *  - 色は1色（あたたかい白っぽい金色）。形（柱）で分かるようにし、色だけにたよらない。
 *  本物のライトは使わず、半透明の形だけで光らせる（ゲーム用スキル 3D の基準）。柱は明るい空の上でも見えるよう、
 *  光を足すのではなく色をうすく重ねる。根もとの光のしみだけは、地面を明るくするため光を足す。
 */

/** 光の色（あたたかい白っぽい金色） */
const BEAM_COLOR = new THREE.Color('#ffd36b');
/** 柱の上の端（名所のてっぺんより、これだけ高くまで） */
const BEAM_ABOVE = 16;
/** これより近いと、いちばん薄くなる（ブロック） */
const NEAR_FADE_IN = 3.5;
/** これより遠いと、いちばん濃い */
const NEAR_FADE_OUT = 11;
/** 名前を見たあとの明るさ（まだ行っていない名所の何倍か） */
const VISITED_DIM = 0.3;

const beamVertex = /* glsl */ `
  varying float vH;
  varying float vFace;
  uniform float uHeight;
  void main() {
    vH = position.y / uHeight; // 0=根もと 1=上の端
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // 筒の真ん中（こちらを向いている面）ほど明るく、ふち（横から見える面）ほど薄く＝やわらかい光の筋に見える
    vFace = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const beamFragment = /* glsl */ `
  varying float vH;
  varying float vFace;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSoft;
  void main() {
    // 根もとが明るく、上へいくほど消える
    float fall = pow(1.0 - clamp(vH, 0.0, 1.0), 1.6);
    // 根もとのすぐ下はぼかす（地面とのさかいめをやわらかく）
    fall *= smoothstep(0.0, 0.04, vH);
    // ゆっくり上へ流れる光の帯
    float band = 0.82 + 0.18 * sin(vH * 26.0 - uTime * 2.2);
    float edge = pow(vFace, uSoft);
    float a = uOpacity * fall * band * edge;
    // 明るい空の上でも見えるよう、光を足すのではなく、あたたかい色をうすく重ねる
    gl_FragColor = vec4(uColor, a);
  }
`;

const glowFragment = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = uOpacity * pow(clamp(1.0 - r, 0.0, 1.0), 2.0);
    gl_FragColor = vec4(uColor * a, a);
  }
`;
const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

interface Beacon {
  obj: SceneObject;
  group: THREE.Group;
  core: THREE.ShaderMaterial;
  halo: THREE.ShaderMaterial;
  glow: THREE.ShaderMaterial;
  /** 今の明るさ（0〜1。なめらかに変わる） */
  shown: number;
}

export class SpotBeacons {
  readonly group = new THREE.Group();
  private beacons: Beacon[] = [];
  /** 観光地ごとの「名前を見た名所」（この画面を開いている間だけ覚える） */
  private readonly visited = new Map<string, Set<string>>();
  private spotId = '';
  private time = 0;
  private readonly reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'SpotBeacons';
    this.group.renderOrder = 5;
    scene.add(this.group);
  }

  /** 観光地に入ったとき：その観光地の名所ごとに柱を立てる */
  setObjects(spotId: string, objects: SceneObject[]): void {
    this.clear();
    this.spotId = spotId;
    for (const obj of objects) this.beacons.push(this.make(obj));
  }

  clear(): void {
    for (const b of this.beacons) {
      this.group.remove(b.group);
      b.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      b.core.dispose();
      b.halo.dispose();
      b.glow.dispose();
    }
    this.beacons = [];
  }

  /** 名前を見た・説明を開いた名所に印をつける（光を弱くする） */
  markVisited(obj: SceneObject): void {
    let set = this.visited.get(this.spotId);
    if (!set) {
      set = new Set();
      this.visited.set(this.spotId, set);
    }
    set.add(obj.id);
  }

  private make(obj: SceneObject): Beacon {
    const r = obj.region;
    const baseY = r.min.y + 1; // 名所の足もと（いちばん下のブロックの上）
    const height = Math.max(r.max.y + 1 - baseY, 2) + BEAM_ABOVE;
    const group = new THREE.Group();
    group.position.set(obj.focus.x + 0.5, baseY, obj.focus.z + 0.5);

    const beamMat = (soft: number): THREE.ShaderMaterial =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: BEAM_COLOR },
          uOpacity: { value: 0 },
          uTime: { value: 0 },
          uHeight: { value: height },
          uSoft: { value: soft },
        },
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
    const core = beamMat(2.2);
    const halo = beamMat(3.0);
    // 細い芯
    const coreGeo = new THREE.CylinderGeometry(0.42, 0.55, height, 16, 1, true);
    coreGeo.translate(0, height / 2, 0);
    const coreMesh = new THREE.Mesh(coreGeo, core);
    // まわりのにじみ（太く、ごく薄く）
    const haloGeo = new THREE.CylinderGeometry(1.1, 1.5, height, 20, 1, true);
    haloGeo.translate(0, height / 2, 0);
    const haloMesh = new THREE.Mesh(haloGeo, halo);
    // 根もとの地面の光のしみ
    const glow = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: BEAM_COLOR }, uOpacity: { value: 0 } },
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const glowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    glowGeo.rotateX(-Math.PI / 2);
    glowGeo.translate(0, 0.04, 0);
    const glowMesh = new THREE.Mesh(glowGeo, glow);
    for (const m of [haloMesh, coreMesh, glowMesh]) {
      m.renderOrder = 5;
      m.frustumCulled = true;
      group.add(m);
    }
    this.group.add(group);
    return { obj, group, core, halo, glow, shown: 0 };
  }

  /**
   * 毎フレーム呼ぶ。
   * @param viewer  明るさを決める基準の位置（歩くときはキャラクター、空から見るときはカメラ）
   * @param nearId  今、正面で向き合って名前が出ている名所（その柱は消す）
   * @param visible 柱を出すか（作るモードのときは出さない）
   */
  update(dt: number, viewer: THREE.Vector3, nearId: string | null, visible: boolean): void {
    if (!this.reduceMotion) this.time += dt;
    const seen = this.visited.get(this.spotId);
    const k = 1 - Math.exp(-6 * dt);
    for (const b of this.beacons) {
      let target = 0;
      if (visible && b.obj.id !== nearId) {
        const dx = viewer.x - (b.obj.focus.x + 0.5);
        const dz = viewer.z - (b.obj.focus.z + 0.5);
        const d = Math.sqrt(dx * dx + dz * dz);
        // 近いほど薄く（すぐそばでも、向き合うまではうっすら残す）
        const t = THREE.MathUtils.smoothstep(d, NEAR_FADE_IN, NEAR_FADE_OUT);
        target = 0.22 + 0.78 * t;
        if (seen?.has(b.obj.id)) target *= VISITED_DIM;
      }
      b.shown += (target - b.shown) * k;
      if (b.shown < 0.005 && target === 0) b.shown = 0;
      b.group.visible = b.shown > 0.005;
      b.core.uniforms.uOpacity.value = 0.62 * b.shown;
      b.halo.uniforms.uOpacity.value = 0.2 * b.shown;
      b.glow.uniforms.uOpacity.value = 0.5 * b.shown;
      b.core.uniforms.uTime.value = this.time;
      b.halo.uniforms.uTime.value = this.time + 1.3;
    }
  }
}
