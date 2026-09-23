import * as THREE from 'three';
import { DAY_LENGTH_SEC } from '@/config/constants';
import type { EnvironmentState } from '@/types';

/** 線形補間 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// 空・光の基準色
const SKY_DAY = new THREE.Color('#87ceeb');
const SKY_NIGHT = new THREE.Color('#0a1228');
const SUN_DAY = new THREE.Color('#fff4e0');
const SUN_NIGHT = new THREE.Color('#9fb6ff');

/**
 * ゲーム内時間と昼夜の管理。
 * t は 0..1（0.5 が正午、0/1 が真夜中）。
 * 自動サイクルのほか、ボタンによる昼/夜の即時切替に対応する。
 */
export class Clock {
  /** 時刻 0..1 */
  private t = 0.5;
  /** 自動で時間を進めるか */
  auto = false;

  // 計算結果を使い回す一時オブジェクト
  private readonly skyColor = new THREE.Color();
  private readonly sunColor = new THREE.Color();

  /** 現在の時刻（0..1）を取得（保存用） */
  getTime(): number {
    return this.t;
  }

  /** 時刻（0..1）を設定（読込用） */
  setTime(t: number): void {
    this.t = ((t % 1) + 1) % 1;
  }

  /** 自動サイクル時、時間を進める */
  update(dt: number): void {
    if (this.auto) {
      this.t = (this.t + dt / DAY_LENGTH_SEC) % 1;
    }
  }

  /** 昼 ⇄ 夜 を即時に切り替える */
  toggleDayNight(): void {
    this.t = this.isDay() ? 0.0 : 0.5;
  }

  /** 自動サイクルのオン/オフを切り替えて、現在の状態を返す */
  toggleAuto(): boolean {
    this.auto = !this.auto;
    return this.auto;
  }

  /** 現在が昼か */
  isDay(): boolean {
    return this.computeDayFactor() > 0.4;
  }

  /** 太陽高度から昼の度合い（0..1）を求める */
  private computeDayFactor(): number {
    const theta = this.t * Math.PI * 2;
    const sunY = -Math.cos(theta); // t=0.5 → 1（正午）, t=0 → -1（真夜中）
    return clamp01((sunY + 0.1) / 0.6);
  }

  /** SceneManager に渡す環境パラメータを算出 */
  getEnvironment(): EnvironmentState {
    const theta = this.t * Math.PI * 2;
    const sunY = -Math.cos(theta);
    const sunX = Math.sin(theta);
    const dayFactor = clamp01((sunY + 0.1) / 0.6);

    this.skyColor.copy(SKY_NIGHT).lerp(SKY_DAY, dayFactor);
    this.sunColor.copy(SUN_NIGHT).lerp(SUN_DAY, dayFactor);

    return {
      sunDir: { x: sunX, y: Math.max(sunY, 0.08), z: 0.35 },
      skyColor: `#${this.skyColor.getHexString()}`,
      sunColor: `#${this.sunColor.getHexString()}`,
      sunIntensity: lerp(0.18, 1.15, dayFactor),
      ambientIntensity: lerp(0.32, 0.7, dayFactor),
      dayFactor,
    };
  }
}
