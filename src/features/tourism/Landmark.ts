import * as THREE from 'three';
import type { Lang, Landmark, Vec3 } from '@/types';

export type { Landmark };

/** 表示・読み上げ用の1行（ラベル＋本文） */
export interface GuideLine {
  label: string;
  text: string;
}

/**
 * 観光地の説明を「行のリスト」で返す。
 * guide があれば 紹介/できること/おすすめ の3行、無ければ説明文1行。
 * これを表示にも読み上げにも使うことで、テキストと音声を必ず一致させる。
 */
export function landmarkLines(lm: Landmark, lang: Lang): GuideLine[] {
  if (lm.guide) {
    const g = lm.guide;
    if (lang === 'ja') {
      return [
        { label: 'しょうかい', text: g.introJa },
        { label: 'できること', text: g.canDoJa },
        { label: 'おすすめ', text: g.recommendJa },
      ];
    }
    return [
      { label: 'About', text: g.introEn },
      { label: 'You can', text: g.canDoEn },
      { label: 'Tip', text: g.recommendEn },
    ];
  }
  return [{ label: '', text: lang === 'ja' ? lm.descJa : lm.descEn }];
}

/** 読み上げるテキスト（表示と同じ内容を連結）→ 音声とテキストの整合をとる */
export function landmarkReadText(lm: Landmark, lang: Lang): string {
  return landmarkLines(lm, lang)
    .map((l) => l.text)
    .join(' ');
}

let counter = 0;

/** 観光地を新規作成（不足分は既定値で補う） */
export function createLandmark(position: Vec3, partial: Partial<Landmark> = {}): Landmark {
  counter += 1;
  return {
    id: partial.id ?? `lm_${Date.now()}_${counter}`,
    position: { ...position },
    radius: partial.radius ?? 6,
    titleJa: partial.titleJa ?? 'あたらしい観光地',
    titleEn: partial.titleEn ?? 'New Spot',
    descJa: partial.descJa ?? 'ここに説明を書こう。',
    descEn: partial.descEn ?? 'Write the description here.',
    image: partial.image,
    speech: partial.speech ?? {
      ja: partial.descJa ?? 'ここは あたらしい観光地です。',
      en: partial.descEn ?? 'This is a new spot.',
    },
    phrases: partial.phrases,
    guide: partial.guide,
  };
}

/** 名前ラベル用のスプライトをCanvasから作る */
function makeLabelSprite(text: string): { sprite: THREE.Sprite; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  drawLabel(ctx, canvas, text);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false, // 地形の奥にあっても見えるように
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.2, 1.05, 1);
  sprite.renderOrder = 1000;
  return { sprite, texture };
}

/** ラベルのCanvas描画（角丸の黒背景＋白文字） */
function drawLabel(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const r = 16;
  const w = canvas.width;
  const h = canvas.height;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(4, 4, w - 8, h - 8, r);
  } else {
    ctx.rect(4, 4, w - 8, h - 8);
  }
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const shown = text.length > 10 ? `${text.slice(0, 9)}…` : text;
  ctx.fillText(shown, w / 2, h / 2);
}

/**
 * 観光地の3Dマーカー。
 * 光の柱（ビーコン）＋名前ラベル＋足元のリングで、遠くからでも位置が分かる。
 */
export class LandmarkMarker {
  readonly group = new THREE.Group();

  private readonly sprite: THREE.Sprite;
  private readonly texture: THREE.CanvasTexture;
  private readonly beacon: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly beaconHeight = 12;
  private landmark: Landmark;

  constructor(landmark: Landmark) {
    this.landmark = landmark;

    // 光の柱
    const beaconGeo = new THREE.CylinderGeometry(0.28, 0.28, this.beaconHeight, 8, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd24a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.beacon.position.y = this.beaconHeight / 2;
    this.group.add(this.beacon);

    // 足元のリング（半径の目安）
    const ringGeo = new THREE.RingGeometry(landmark.radius - 0.3, landmark.radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd24a,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;
    this.group.add(this.ring);

    // 名前ラベル
    const { sprite, texture } = makeLabelSprite(landmark.titleJa);
    this.sprite = sprite;
    this.texture = texture;
    this.sprite.position.y = this.beaconHeight + 1.2;
    this.group.add(this.sprite);

    this.applyPosition();
  }

  private applyPosition(): void {
    const p = this.landmark.position;
    this.group.position.set(p.x + 0.5, p.y, p.z + 0.5);
  }

  /** ラベル・位置・半径を最新の内容へ更新 */
  refresh(landmark: Landmark): void {
    this.landmark = landmark;
    const ctx = (this.texture.image as HTMLCanvasElement).getContext('2d')!;
    drawLabel(ctx, this.texture.image as HTMLCanvasElement, landmark.titleJa);
    this.texture.needsUpdate = true;
    this.applyPosition();
  }

  /** 毎フレームのアニメーション（ラベルをふわふわ上下） */
  update(time: number): void {
    this.sprite.position.y = this.beaconHeight + 1.2 + Math.sin(time * 2) * 0.25;
  }

  dispose(): void {
    this.beacon.geometry.dispose();
    (this.beacon.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.texture.dispose();
    (this.sprite.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}
