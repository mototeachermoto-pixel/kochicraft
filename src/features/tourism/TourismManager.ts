import * as THREE from 'three';
import { WORLD_HEIGHT } from '@/config/constants';
import type { Lang, Landmark, Vec3 } from '@/types';
import type { World } from '@/world/World';
import type { Player } from '@/player/Player';
import type { SpeechService } from '@/features/language/SpeechService';
import { createLandmark, landmarkReadText, LandmarkMarker } from './Landmark';

/**
 * 観光モードの管理。
 * 観光地（ランドマーク）とそのマーカーを保持し、プレイヤーの接近を判定して
 * 説明ポップアップの表示・音声読み上げのきっかけを通知する。
 */
export class TourismManager {
  /** 観光モードが有効か（建築中に邪魔しないよう既定はオフ） */
  enabled = false;
  /** 表示・読み上げの言語 */
  lang: Lang = 'ja';

  /** マーカーをまとめるグループ（シーンに追加される） */
  readonly group = new THREE.Group();

  // UIへの通知
  onShow?: (landmark: Landmark, lang: Lang) => void;
  onHide?: () => void;
  onEnabledChange?: (enabled: boolean) => void;

  private landmarks: Landmark[] = [];
  private markers = new Map<string, LandmarkMarker>();
  private currentId: string | null = null;

  constructor(
    private readonly world: World,
    private readonly speech: SpeechService,
  ) {
    this.group.name = 'TourismGroup';
  }

  // ===== 有効/無効・言語 =====
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.speech.cancel();
      this.currentId = null;
      this.onHide?.();
    }
    this.onEnabledChange?.(enabled);
  }

  toggleEnabled(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setLang(lang: Lang): void {
    this.lang = lang;
    // 表示中なら新しい言語で再表示（読み上げは行わない）
    if (this.currentId) {
      const lm = this.get(this.currentId);
      if (lm) this.onShow?.(lm, this.lang);
    }
  }

  // ===== 観光地の追加・取得・更新・削除 =====
  add(landmark: Landmark): Landmark {
    this.landmarks.push(landmark);
    const marker = new LandmarkMarker(landmark);
    this.markers.set(landmark.id, marker);
    this.group.add(marker.group);
    return landmark;
  }

  /** プレイヤー位置などから新しい観光地を作って追加する */
  addAt(position: Vec3, partial: Partial<Landmark> = {}): Landmark {
    return this.add(createLandmark(position, partial));
  }

  get(id: string): Landmark | undefined {
    return this.landmarks.find((l) => l.id === id);
  }

  getAll(): Landmark[] {
    return this.landmarks;
  }

  /** 観光地の内容を更新（編集後）→ マーカーへ反映 */
  refresh(id: string): void {
    const lm = this.get(id);
    const marker = this.markers.get(id);
    if (lm && marker) marker.refresh(lm);
    // 表示中の観光地なら再描画
    if (this.currentId === id && lm) this.onShow?.(lm, this.lang);
  }

  remove(id: string): void {
    const marker = this.markers.get(id);
    if (marker) {
      marker.dispose();
      this.markers.delete(id);
    }
    this.landmarks = this.landmarks.filter((l) => l.id !== id);
    if (this.currentId === id) {
      this.currentId = null;
      this.onHide?.();
    }
  }

  /** すべての観光地とマーカーを破棄する（読込前のクリア用） */
  clear(): void {
    for (const marker of this.markers.values()) marker.dispose();
    this.markers.clear();
    this.landmarks = [];
    this.currentId = null;
    this.onHide?.();
  }

  /** 観光地一覧を読み込み直す（保存データの適用） */
  loadLandmarks(list: Landmark[]): void {
    this.clear();
    for (const lm of list) this.add(lm);
  }

  /**
   * 指定の観光地へワープする。
   * 観光地の手前（南側）に立ち、観光地の方を向かせる。観光モードもオンにする。
   */
  warpTo(lm: Landmark, player: Player): void {
    const cx = lm.position.x;
    const cz = lm.position.z;
    // 観光地の手前（南側）で、土台と同じ高さの平らな所を探して立つ
    // （地形が低い所だと半径から外れて説明が出ないため）
    let off = lm.radius - 1;
    while (off > 3) {
      const g = this.groundY(cx, cz + off);
      if (Math.abs(g - lm.position.y) <= 2) break;
      off--;
    }
    const standZ = cz + off;
    const gy = this.groundY(cx, standZ);
    player.position.set(cx + 0.5, gy, standZ + 0.5);
    player.velocity.set(0, 0, 0);
    player.yaw = 0; // -Z（=観光地の方向）を向く
    player.pitch = 0;

    // 観光モードをオンにし、その場で説明ポップアップ＋読み上げを出す
    this.setEnabled(true);
    this.currentId = lm.id;
    this.onShow?.(lm, this.lang);
    this.autoSpeak(lm);
  }

  /** 指定座標の地表の高さ（マーカーを地面に置くために使用） */
  groundY(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (this.world.isSolid(x, y, z)) return y + 1;
    }
    return 1;
  }

  // ===== 毎フレーム =====
  update(playerPos: THREE.Vector3, time: number): void {
    for (const marker of this.markers.values()) marker.update(time);

    if (!this.enabled) return;

    // 最も近い「半径内」の観光地を探す
    let found: Landmark | null = null;
    let bestDist = Infinity;
    for (const lm of this.landmarks) {
      const dx = playerPos.x - (lm.position.x + 0.5);
      const dy = playerPos.y - lm.position.y;
      const dz = playerPos.z - (lm.position.z + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist <= lm.radius && dist < bestDist) {
        bestDist = dist;
        found = lm;
      }
    }

    if (found) {
      // 別の観光地に入ったときだけ表示＆読み上げ
      if (found.id !== this.currentId) {
        this.currentId = found.id;
        this.onShow?.(found, this.lang);
        this.autoSpeak(found);
      }
    } else if (this.currentId) {
      this.currentId = null;
      this.onHide?.();
    }
  }

  private autoSpeak(lm: Landmark): void {
    // 表示と同じ文を読み上げて、音声とテキストを一致させる
    this.speech.speak(landmarkReadText(lm, this.lang), this.lang);
  }
}
