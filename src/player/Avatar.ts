import * as THREE from 'three';

/**
 * プレイヤーの見た目（キャラクター）。
 * 四角いブロックだけで作ったオリジナルの造形（既存ゲームのキャラクターは再現しない）。
 * 4種類：Boy（男の子）／Girl（女の子）／Pet（ペット）／Robot（ロボット）。
 *
 * 一人称のときは非表示。三人称・前・後ろ視点のときに表示し、歩くと手足が振れる。
 */

/** 選べるキャラクターの種類 */
export type SkinKind = 'boy' | 'girl' | 'pet' | 'robot';

/** 画面に出す名前（英語・小5） */
export const SKIN_LABEL: Record<SkinKind, string> = {
  boy: 'Boy',
  girl: 'Girl',
  pet: 'Pet',
  robot: 'Robot',
};

/** 立方体・直方体のパーツを作る */
function part(w: number, h: number, d: number, color: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  return mesh;
}

/**
 * 手足のように「上端を軸にして振れる」パーツ。
 * 親グループの原点＝肩・つけ根。子のメッシュを下へずらして入れる。
 */
function limb(w: number, h: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const m = part(w, h, d, color);
  m.position.y = -h / 2;
  g.add(m);
  return g;
}

export class Avatar {
  /** シーンに置くルート（位置＝足元、向き＝yaw） */
  readonly root = new THREE.Group();

  private skin: SkinKind = 'boy';
  /** 振れる手足（歩行アニメ用） */
  private swing: { armL?: THREE.Group; armR?: THREE.Group; legL?: THREE.Group; legR?: THREE.Group } = {};
  /** 歩いた距離に応じて進む位相（止まると 0 に戻る） */
  private phase = 0;

  constructor(scene: THREE.Scene) {
    this.root.visible = false;
    scene.add(this.root);
    this.build();
  }

  /** 種類を変える（作り直す） */
  setSkin(kind: SkinKind): void {
    if (this.skin === kind) return;
    this.skin = kind;
    this.build();
  }

  get skinKind(): SkinKind {
    return this.skin;
  }

  setVisible(on: boolean): void {
    this.root.visible = on;
  }

  /**
   * 毎フレームの更新。
   * pos＝足元の位置、yaw＝向き、moving＝動いているか。
   */
  update(pos: THREE.Vector3, yaw: number, moving: boolean, dt: number): void {
    this.root.position.set(pos.x, pos.y, pos.z);
    // カメラの yaw は「-Z を向く」基準なので、モデルもそれに合わせる
    this.root.rotation.y = yaw;

    if (moving) this.phase += dt * 9;
    else this.phase = 0;

    const a = Math.sin(this.phase) * 0.7; // 振れ幅
    const { armL, armR, legL, legR } = this.swing;
    if (armL) armL.rotation.x = a;
    if (armR) armR.rotation.x = -a;
    if (legL) legL.rotation.x = -a;
    if (legR) legR.rotation.x = a;
  }

  /** いまの種類でモデルを組み立て直す */
  private build(): void {
    // 古いパーツを片づける（メモリを残さない）
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      child.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    this.swing = {};

    if (this.skin === 'pet') this.buildPet();
    else if (this.skin === 'robot') this.buildRobot();
    else this.buildKid(this.skin === 'girl');
  }

  /** 男の子・女の子（頭が大きい、かわいい比率） */
  private buildKid(girl: boolean): void {
    const skinColor = girl ? 0xf3c9a6 : 0xe8b98d;
    const hair = girl ? 0xb5651d : 0x4a3728;
    const shirt = girl ? 0x4bbf73 : 0x3f7fd4;
    const pants = girl ? 0xd94f8a : 0x2f4b8f;
    const shoe = 0x30303a;

    // 頭（大きめ）＋顔（目）
    const head = part(0.72, 0.72, 0.72, skinColor);
    head.position.y = 1.44;
    this.root.add(head);
    for (const dx of [-0.16, 0.16]) {
      const eye = part(0.1, 0.12, 0.04, 0x1b2440);
      eye.position.set(dx, 1.48, -0.38); // -Z が正面
      this.root.add(eye);
    }
    // 髪（前髪＋女の子は横にも）
    const bang = part(0.76, 0.16, 0.76, hair);
    bang.position.y = 1.76;
    this.root.add(bang);
    if (girl) {
      for (const dx of [-0.42, 0.42]) {
        const side = part(0.1, 0.5, 0.6, hair);
        side.position.set(dx, 1.42, 0.04);
        this.root.add(side);
      }
    }

    // 体
    const body = part(0.5, 0.55, 0.3, shirt);
    body.position.y = 0.8;
    this.root.add(body);
    // 女の子はスカート
    if (girl) {
      const skirt = part(0.62, 0.18, 0.42, pants);
      skirt.position.y = 0.56;
      this.root.add(skirt);
    }

    // 腕（肩を軸に振れる）
    const armL = limb(0.16, 0.5, 0.2, shirt);
    armL.position.set(-0.33, 1.06, 0);
    const armR = limb(0.16, 0.5, 0.2, shirt);
    armR.position.set(0.33, 1.06, 0);
    // 手（はだ色）
    for (const arm of [armL, armR]) {
      const hand = part(0.16, 0.12, 0.2, skinColor);
      hand.position.y = -0.5;
      arm.add(hand);
    }
    this.root.add(armL, armR);

    // 脚（つけ根を軸に振れる）
    const legL = limb(0.2, 0.5, 0.22, girl ? skinColor : pants);
    legL.position.set(-0.13, 0.53, 0);
    const legR = limb(0.2, 0.5, 0.22, girl ? skinColor : pants);
    legR.position.set(0.13, 0.53, 0);
    for (const leg of [legL, legR]) {
      const foot = part(0.22, 0.12, 0.28, shoe);
      foot.position.set(0, -0.5, -0.03);
      leg.add(foot);
    }
    this.root.add(legL, legR);

    this.swing = { armL, armR, legL, legR };
  }

  /** ペット（四本足の小さな相棒。犬のような形） */
  private buildPet(): void {
    const fur = 0xf0e0c0;
    const ear = 0x8a6a44;
    const dark = 0x2b2b33;

    // 胴（横長）
    const body = part(0.42, 0.38, 0.72, fur);
    body.position.y = 0.52;
    this.root.add(body);

    // 頭（前＝-Z 側）
    const head = part(0.46, 0.42, 0.4, fur);
    head.position.set(0, 0.74, -0.44);
    this.root.add(head);
    // 鼻・目
    const nose = part(0.14, 0.12, 0.1, dark);
    nose.position.set(0, 0.66, -0.66);
    this.root.add(nose);
    for (const dx of [-0.12, 0.12]) {
      const eye = part(0.08, 0.1, 0.04, dark);
      eye.position.set(dx, 0.82, -0.63);
      this.root.add(eye);
    }
    // 耳（たれ耳）
    for (const dx of [-0.22, 0.22]) {
      const e = part(0.12, 0.22, 0.1, ear);
      e.position.set(dx, 0.88, -0.34);
      this.root.add(e);
    }
    // しっぽ
    const tail = part(0.1, 0.24, 0.1, ear);
    tail.position.set(0, 0.76, 0.36);
    tail.rotation.x = -0.5;
    this.root.add(tail);

    // 四本足（前足＝振れる、後ろ足＝振れる）
    const legFL = limb(0.14, 0.34, 0.14, fur);
    legFL.position.set(-0.14, 0.34, -0.24);
    const legFR = limb(0.14, 0.34, 0.14, fur);
    legFR.position.set(0.14, 0.34, -0.24);
    const legBL = limb(0.14, 0.34, 0.14, fur);
    legBL.position.set(-0.14, 0.34, 0.26);
    const legBR = limb(0.14, 0.34, 0.14, fur);
    legBR.position.set(0.14, 0.34, 0.26);
    this.root.add(legFL, legFR, legBL, legBR);

    // 前足と後ろ足が交互に出るように割り当てる
    this.swing = { armL: legFL, armR: legFR, legL: legBR, legR: legBL };
  }

  /** ロボット（四角い体・アンテナ・光る目） */
  private buildRobot(): void {
    const metal = 0x9aa4b0;
    const dark = 0x4a5560;
    const glow = 0x49d6ff;
    const accent = 0xf2b632;

    // 頭＋バイザー（光る目）
    const head = part(0.7, 0.6, 0.7, metal);
    head.position.y = 1.42;
    this.root.add(head);
    const visor = part(0.56, 0.18, 0.06, glow);
    visor.position.set(0, 1.46, -0.36);
    this.root.add(visor);
    // アンテナ
    const rod = part(0.06, 0.24, 0.06, dark);
    rod.position.y = 1.82;
    this.root.add(rod);
    const bulb = part(0.14, 0.14, 0.14, accent);
    bulb.position.y = 1.98;
    this.root.add(bulb);

    // 体（胸に丸いランプ）
    const body = part(0.56, 0.6, 0.34, metal);
    body.position.y = 0.82;
    this.root.add(body);
    const lamp = part(0.16, 0.16, 0.06, accent);
    lamp.position.set(0, 0.92, -0.2);
    this.root.add(lamp);
    const belt = part(0.58, 0.1, 0.36, dark);
    belt.position.y = 0.56;
    this.root.add(belt);

    // 腕・脚（角ばった作り）
    const armL = limb(0.18, 0.5, 0.18, dark);
    armL.position.set(-0.37, 1.06, 0);
    const armR = limb(0.18, 0.5, 0.18, dark);
    armR.position.set(0.37, 1.06, 0);
    for (const arm of [armL, armR]) {
      const hand = part(0.2, 0.14, 0.2, metal);
      hand.position.y = -0.5;
      arm.add(hand);
    }
    this.root.add(armL, armR);

    const legL = limb(0.2, 0.5, 0.2, metal);
    legL.position.set(-0.15, 0.52, 0);
    const legR = limb(0.2, 0.5, 0.2, metal);
    legR.position.set(0.15, 0.52, 0);
    for (const leg of [legL, legR]) {
      const foot = part(0.24, 0.12, 0.3, dark);
      foot.position.set(0, -0.5, -0.03);
      leg.add(foot);
    }
    this.root.add(legL, legR);

    this.swing = { armL, armR, legL, legR };
  }
}
