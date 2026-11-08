import * as THREE from 'three';
import { CAMERA_FAR } from '@/config/constants';
import type { EnvironmentState } from '@/types';
import { styleUniforms } from '@/world/blockStyles';

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

  constructor() {
    // 環境光：全体の明るさの底上げ
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambient);

    // 半球光：空（上）と地面（下）からの柔らかい光で立体感を出す
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a6b3a, 0.4);
    this.scene.add(this.hemi);

    // 太陽：平行光源（昼夜で位置・色・強さが変わる）
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    this.sun.position.set(60, 100, 40);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // 背景色と霧（遠景をなじませる）。観光地のまわりの景色（Surroundings）が、遠くで空にとけこむ距離
    this.scene.background = this.bgColor;
    this.fog = new THREE.Fog(this.bgColor.getHex(), 90, 290);
    this.scene.fog = this.fog;

    // 空のドーム：上ほど濃い青、地平線に近いほど白っぽい青（霧と同じ色）
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: this.zenith }, horizon: { value: this.bgColor } },
      vertexShader: `varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
        void main() { float h = clamp(normalize(vDir).y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.6)), 1.0);
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
    // 水のゆらぎ（ブロックの模様）の時間
    styleUniforms.kcTime.value = this.time;
    for (const c of this.clouds.children) {
      c.position.x += dt * 1.2;
      if (c.position.x > 48 + 230) c.position.x -= 460;
    }
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
