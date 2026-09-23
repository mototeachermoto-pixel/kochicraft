import * as THREE from 'three';
import type { InputManager } from '@/core/InputManager';
import type { MoveInput } from '@/types';
import type { World } from '@/world/World';
import type { Player } from './Player';

/**
 * 入力（InputManager）とプレイヤー・カメラを結びつけるコントローラ。
 * 毎フレーム：マウス視点 → 移動入力 → 物理更新 → カメラ同期 の順で処理する。
 */
export class PlayerController {
  private readonly eye = new THREE.Vector3();

  constructor(
    private readonly player: Player,
    private readonly input: InputManager,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly world: World,
  ) {}

  update(dt: number): void {
    // 操作中（ロック中）のみ視点・移動を受け付ける
    if (this.input.isLocked) {
      const md = this.input.consumeMouseDelta();
      if (md.dx !== 0 || md.dy !== 0) {
        this.player.applyLook(md.dx, md.dy);
      }
    }

    const move: MoveInput = {
      forward: this.input.isDown('KeyW') || this.input.isDown('ArrowUp'),
      back: this.input.isDown('KeyS') || this.input.isDown('ArrowDown'),
      left: this.input.isDown('KeyA') || this.input.isDown('ArrowLeft'),
      right: this.input.isDown('KeyD') || this.input.isDown('ArrowRight'),
      jump: this.input.isDown('Space'),
      sprint: this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight'),
    };

    this.player.update(dt, move, this.world);

    // カメラをプレイヤーの目の位置・視点に同期
    this.player.getEyePosition(this.eye);
    this.camera.position.copy(this.eye);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
  }
}
