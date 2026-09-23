import * as THREE from 'three';
import { CAMERA_FAR } from '@/config/constants';
import type { EnvironmentState } from '@/types';

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

  // 背景・霧色の使い回し用
  private readonly bgColor = new THREE.Color('#87ceeb');

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

    // 背景色と霧（遠景をなじませる）
    this.scene.background = this.bgColor;
    this.fog = new THREE.Fog(this.bgColor.getHex(), 90, CAMERA_FAR);
    this.scene.fog = this.fog;
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
    this.bgColor.set(env.skyColor);
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
