import * as THREE from 'three';

/**
 * 空中をゆっくり舞う、花びら・木の葉・光のつぶ（2026-11-15 見た目の改善・第5段階）。
 * 世界が止まって見えないように、カメラのまわりに少しだけ舞わせる。
 *
 * 軽くするための作り：
 *  - 点（四角いつぶ）を数十こ、1回でまとめて描く。
 *  - 動きはすべて絵をかく計算の中で行い、毎フレームの計算はカメラの位置と時間を渡すだけ。
 *  - カメラから離れたつぶは、反対側へ回りこませる（いつもカメラのまわりにいる）。
 * 動きをへらす設定（prefers-reduced-motion）の端末では出さない。
 */
const BOX = new THREE.Vector3(26, 12, 26);

/** 観光地ごとの色（花びら・葉・光）。屋内やどうくつの中では出さない */
const PALETTES: Record<string, string[]> = {
  default: ['#ffffff', '#fff3c4', '#cfe9a8'],
  'kochi-castle': ['#ffc4d8', '#ffdbe6', '#ffffff'],
  makino: ['#ffc4d8', '#cfe9a8', '#fff3c4'],
  nikobuchi: ['#bfe6a4', '#e8f7c8', '#ffffff'],
  shimanto: ['#cfe9a8', '#ffffff', '#fff3c4'],
  katsurahama: ['#ffffff', '#fff3c4', '#e6f4ff'],
  muroto: ['#ffffff', '#e6f4ff', '#fff3c4'],
  ashizuri: ['#ffffff', '#ff9aa8', '#e6f4ff'], // 椿の花びら
};
const INDOOR = new Set(['hirome', 'ryugado']);

export class AmbientMotes {
  readonly points: THREE.Points;
  private readonly mat: THREE.ShaderMaterial;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly count: number;
  private readonly seeds: Float32Array;
  private readonly reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private allowed = false;

  constructor(touchDevice: boolean) {
    this.count = touchDevice ? 36 : 64;
    const pos = new Float32Array(this.count * 3);
    const col = new Float32Array(this.count * 3);
    this.seeds = new Float32Array(this.count * 3);
    // 毎回同じ並びになる小さな乱数（見た目だけに使う）
    let a = 9173;
    const rand = (): number => {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      return a / 0x7fffffff;
    };
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = rand() * BOX.x;
      pos[i * 3 + 1] = rand() * BOX.y;
      pos[i * 3 + 2] = rand() * BOX.z;
      this.seeds[i * 3] = rand();
      this.seeds[i * 3 + 1] = rand();
      this.seeds[i * 3 + 2] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.colorAttr = new THREE.BufferAttribute(col, 3);
    geo.setAttribute('color', this.colorAttr);
    geo.setAttribute('seed', new THREE.BufferAttribute(this.seeds, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uBox: { value: BOX },
        uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 seed;
        attribute vec3 color;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uBox;
        uniform float uScale;
        varying vec3 vColor;
        varying float vFade;
        void main() {
          // 風に流され、ゆらゆらしながら、ゆっくり落ちる
          vec3 p = position;
          p.x += uTime * (0.55 + seed.x * 0.5) + sin(uTime * (0.7 + seed.y) + seed.z * 6.28) * 0.7;
          p.y -= uTime * (0.28 + seed.y * 0.3);
          p.z += uTime * 0.18 + cos(uTime * (0.5 + seed.x) + seed.y * 6.28) * 0.6;
          // カメラのまわりの箱の中へ回りこませる
          vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
          rel.y += uBox.y * 0.28; // 少し上のほうに多く
          vec4 mv = modelViewMatrix * vec4(uCam + rel, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = -mv.z;
          gl_PointSize = uScale * (0.085 + seed.z * 0.07) / max(dist, 0.5);
          // 近すぎ・遠すぎるつぶは、うすくする（目の前に急に出ないように）
          vFade = smoothstep(2.5, 5.5, dist) * (1.0 - smoothstep(10.0, 13.5, dist));
          vColor = color;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(vColor, 0.85 * vFade);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.visible = false;
    this.setSpot(null);
  }

  /** 観光地に合わせて色を変える。屋内（ひろめ市場・龍河洞）や一覧の画面では出さない */
  setSpot(id: string | null): void {
    this.allowed = !!id && !INDOOR.has(id) && !this.reduce;
    const pal = (PALETTES[id ?? ''] ?? PALETTES.default).map((h) => new THREE.Color(h));
    for (let i = 0; i < this.count; i++) {
      const c = pal[Math.floor(this.seeds[i * 3 + 1] * pal.length) % pal.length];
      this.colorAttr.setXYZ(i, c.r, c.g, c.b);
    }
    this.colorAttr.needsUpdate = true;
    this.points.visible = this.allowed;
  }

  /** 水の中などで、一時的にかくす */
  setHidden(hidden: boolean): void {
    this.points.visible = this.allowed && !hidden;
  }

  update(time: number, cam: THREE.Vector3, viewportHeight: number): void {
    if (!this.points.visible) return;
    this.mat.uniforms.uTime.value = time;
    (this.mat.uniforms.uCam.value as THREE.Vector3).copy(cam);
    this.mat.uniforms.uScale.value = viewportHeight;
  }
}
