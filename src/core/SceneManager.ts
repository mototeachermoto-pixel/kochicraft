import * as THREE from 'three';
import { CAMERA_FAR } from '@/config/constants';
import type { EnvironmentState } from '@/types';
import { styleUniforms } from '@/world/blockStyles';
import { shadowState } from '@/world/shadowState';
import { WORLD_WIDTH, WORLD_DEPTH, SEA_LEVEL } from '@/config/constants';

/**
 * 太陽の向き（2026-11-15 見た目の改善・第1段階）。ななめ上（+x・+z 側）から当てて、
 * 建物や木の影が地面に落ちるようにする。ブロックの面の明るさ（ChunkMesher の shadeFor）と同じ向き。
 */
const SUN_DIR = new THREE.Vector3(0.52, 0.86, 0.4).normalize();

/**
 * Three.js のシーンとライティング・空・霧の管理。
 * 昼夜（EnvironmentState）に応じて毎フレーム見た目を更新する。
 */
export class SceneManager {
  readonly scene = new THREE.Scene();

  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly fog: THREE.Fog;

  // 背景・霧色の使い回し用（地平線の色。霧もこの色にして、遠くの景色が空になじむようにする）
  private readonly bgColor = new THREE.Color('#87ceeb').lerp(new THREE.Color('#ffffff'), 0.28);
  /** 空の上のほうの色（地平線より濃い青） */
  private readonly zenith = new THREE.Color('#3f88d8');
  /** 空のドーム（上が濃く、地平線が白っぽい青のグラデーション）。いつもカメラについてくる */
  private readonly sky: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;
  /** ゆっくり流れる、四角い雲 */
  private readonly clouds = new THREE.Group();
  private time = 0;

  /** 水の中の色（にごった青緑）。カメラが水に入ると、霧と背景をこの色にする */
  private readonly waterColor = new THREE.Color('#1d5f86');
  /** 背景・霧に実際に使う色（空の色と水の色をまぜたもの） */
  private readonly mixColor = new THREE.Color();
  /** 0＝水の外、1＝水の中 */
  private underwater = 0;

  /**
   * @param renderer   影をかき直す合図を送る先（無くても動く）
   * @param shadowSize 影の絵の細かさ（パソコン 2048・タッチの端末 1024）
   */
  constructor(
    private readonly renderer?: THREE.WebGLRenderer,
    shadowSize = 2048,
  ) {
    // 「南国土佐の晴れた日」の光：日なたは暖かい色、日かげは少し青い色にして、立体と奥行きを出す。
    // 日なたの明るさの合計は今までとほぼ同じにして、日かげだけを落とす（まぶしすぎない・暗すぎない）。
    // 環境光：日かげの底の明るさ（空の青みを少し）
    this.ambient = new THREE.AmbientLight(0xcfdcff, 0.4);
    this.scene.add(this.ambient);

    // 半球光：空（上）からの青い光と、地面（下）からの暖かい照り返し
    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x9c8a66, 0.52);
    this.scene.add(this.hemi);

    // 太陽：暖かい色の平行な光。影を落とす
    this.sun = new THREE.DirectionalLight(0xffedc8, 1.3);
    const cx = WORLD_WIDTH / 2;
    const cz = WORLD_DEPTH / 2;
    this.sun.target.position.set(cx, SEA_LEVEL, cz);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 150);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    // 観光地（96×96マス）と、そのふちの少し外までを影の範囲にする
    const half = Math.max(WORLD_WIDTH, WORLD_DEPTH) * 0.5 + 24;
    const cam = this.sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 20;
    cam.far = 320;
    cam.updateProjectionMatrix();
    // 影のしま模様（自分の面に自分の影がうつる）を防ぐ
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sun.target.updateMatrixWorld();

    // 背景色と霧（遠景をなじませる）。観光地のまわりの景色（Surroundings）が、遠くで空にとけこむ距離
    this.scene.background = this.bgColor;
    this.fog = new THREE.Fog(this.bgColor.getHex(), 90, 290);
    this.scene.fog = this.fog;

    // 空のドーム：上ほど濃い青、地平線に近いほど白っぽい青（霧と同じ色）
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: this.zenith }, horizon: { value: this.bgColor }, sunDir: { value: SUN_DIR } },
      vertexShader: `varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
        void main() { vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.6));
          // 太陽：まるい光と、そのまわりのやわらかい明るさ
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.93, 0.74) * (pow(s, 24.0) * 0.22 + pow(s, 300.0) * 0.5);
          col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.9990, 0.9994, s));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(CAMERA_FAR * 0.9, 24, 12), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    // 描く直前に、空をカメラの位置へ動かす（どのカメラ・どの画面の動きでも、空の外へ出ないように）
    this.sky.onBeforeRender = (_r, _s, cam) => {
      this.sky.position.copy(cam.position);
      this.sky.updateMatrixWorld();
    };
    this.scene.add(this.sky);

    this.buildClouds();
    this.scene.add(this.clouds);
  }

  /** 四角い雲（平たい白い箱を2〜3こ重ねたもの）を、空のあちこちに置く。毎回同じ並びになる */
  private buildClouds(): void {
    let a = 12345;
    const rand = (): number => {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      return a / 0x7fffffff;
    };
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdde8f2, emissiveIntensity: 0.55 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      const w = 14 + rand() * 22;
      const d = 8 + rand() * 12;
      const parts = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < parts; k++) {
        const m = new THREE.Mesh(geo, mat);
        m.scale.set(w * (1 - k * 0.3), 3, d * (1 - k * 0.25));
        m.position.set((rand() - 0.5) * w * 0.4, k * 2.2, (rand() - 0.5) * d * 0.4);
        cloud.add(m);
      }
      const ang = rand() * Math.PI * 2;
      const r = 40 + rand() * 170;
      cloud.position.set(48 + Math.cos(ang) * r, 62 + rand() * 18, 48 + Math.sin(ang) * r);
      this.clouds.add(cloud);
    }
  }

  /** 雲をゆっくり流し、空をカメラについてこさせる（毎フレーム） */
  update(dt: number, cameraPos: THREE.Vector3): void {
    this.time += dt;
    void cameraPos;
    // ブロックが変わったときだけ、影をかき直す
    if (shadowState.dirty && this.renderer) {
      shadowState.dirty = false;
      this.renderer.shadowMap.needsUpdate = true;
    }
    // 水のゆらぎ（ブロックの模様）の時間
    styleUniforms.kcTime.value = this.time;
    for (const c of this.clouds.children) {
      c.position.x += dt * 1.2;
      if (c.position.x > 48 + 230) c.position.x -= 460;
    }
  }

  /**
   * カメラが水の中にいる度合い（0〜1）。水の中では、霧を近く・青緑にして遠くを見えなくし、
   * 空と雲をかくす（水面の上の空は、水を通して青くかすんで見える）。
   */
  setUnderwater(t: number): void {
    if (t === this.underwater) return;
    this.underwater = t;
    this.mixColor.copy(this.bgColor).lerp(this.waterColor, t);
    this.fog.color.copy(this.mixColor);
    this.fog.near = THREE.MathUtils.lerp(90, 0.5, t);
    this.fog.far = THREE.MathUtils.lerp(290, 24, t);
    this.scene.background = t > 0 ? this.mixColor : this.bgColor;
    const sky = t < 0.5;
    this.sky.visible = sky;
    this.clouds.visible = sky;
  }

  /** 表示オブジェクトを追加 */
  add(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }

  /**
   * 昼夜の環境を反映する。
   * @param env    Clock が算出した環境パラメータ
   * @param center 太陽が追従する中心（通常はプレイヤー位置）
   */
  applyEnvironment(env: EnvironmentState, center: THREE.Vector3): void {
    // 地平線は空の色を白っぽく、上は少し濃い青に
    this.zenith.set(env.skyColor).multiplyScalar(0.72);
    this.zenith.b = Math.min(1, this.zenith.b * 1.18);
    this.bgColor.set(env.skyColor).lerp(new THREE.Color('#ffffff'), 0.28);
    this.fog.color.copy(this.bgColor);

    this.ambient.intensity = env.ambientIntensity;
    this.hemi.intensity = env.ambientIntensity * 0.7;

    this.sun.color.set(env.sunColor);
    this.sun.intensity = env.sunIntensity;

    // 太陽はプレイヤーを中心に一定距離で配置（広い範囲を均一に照らす）
    this.sun.position.set(
      center.x + env.sunDir.x * 90,
      center.y + env.sunDir.y * 90,
      center.z + env.sunDir.z * 90,
    );
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
  }
}
