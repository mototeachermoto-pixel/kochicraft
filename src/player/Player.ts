import * as THREE from 'three';
import {
  GRAVITY,
  JUMP_SPEED,
  MOUSE_SENSITIVITY,
  MOVE_SPEED,
  PLAYER_EYE,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  SPRINT_SPEED,
  STEP_HEIGHT,
} from '@/config/constants';
import type { MoveInput, Vec3 } from '@/types';
import type { World } from '@/world/World';
import { moveAndCollide } from './Physics';

/** ピッチ（上下視点）の限界。真上・真下で固まらないよう少し余裕を持たせる */
const PITCH_LIMIT = Math.PI / 2 - 0.02;

/**
 * プレイヤーの状態と移動処理。
 * position はAABPの足元中心。視点（yaw/pitch）も保持し、カメラ同期に使う。
 */
export class Player {
  /** 足元の位置 */
  readonly position = new THREE.Vector3();
  /** 速度 */
  readonly velocity = new THREE.Vector3();

  /** 左右の視点角（Y軸まわり, ラジアン） */
  yaw = 0;
  /** 上下の視点角（X軸まわり, ラジアン） */
  pitch = 0;
  /** 接地しているか */
  onGround = false;

  /** スポーン位置を設定し、速度をリセット */
  spawn(p: Vec3): void {
    this.position.set(p.x, p.y, p.z);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
  }

  /** マウス移動量から視点を更新 */
  applyLook(dx: number, dy: number): void {
    this.yaw -= dx * MOUSE_SENSITIVITY;
    this.pitch -= dy * MOUSE_SENSITIVITY;
    if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
    if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;
  }

  /** カメラを置くべき目の位置 */
  getEyePosition(target: THREE.Vector3): THREE.Vector3 {
    return target.set(this.position.x, this.position.y + PLAYER_EYE, this.position.z);
  }

  /** 1フレーム分の更新（入力→速度→衝突解決） */
  update(dt: number, input: MoveInput, world: World): void {
    const speed = input.sprint ? SPRINT_SPEED : MOVE_SPEED;

    // yaw を基準にした水平方向ベクトル
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const forwardX = -sin;
    const forwardZ = -cos;
    const rightX = cos;
    const rightZ = -sin;

    let vx = 0;
    let vz = 0;
    if (input.forward) {
      vx += forwardX;
      vz += forwardZ;
    }
    if (input.back) {
      vx -= forwardX;
      vz -= forwardZ;
    }
    if (input.right) {
      vx += rightX;
      vz += rightZ;
    }
    if (input.left) {
      vx -= rightX;
      vz -= rightZ;
    }
    // 斜め移動が速くならないよう正規化
    const len = Math.hypot(vx, vz);
    if (len > 0) {
      vx = (vx / len) * speed;
      vz = (vz / len) * speed;
    }

    this.velocity.x = vx;
    this.velocity.z = vz;
    this.velocity.y -= GRAVITY * dt;

    if (input.jump && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }

    const result = moveAndCollide(
      world,
      this.position,
      this.velocity,
      dt,
      PLAYER_HALF_WIDTH,
      PLAYER_HEIGHT,
      STEP_HEIGHT,
      this.onGround, // 前フレームの接地状態（空中では自動ステップしない）
    );
    this.onGround = result.onGround;

    // 奈落に落ちた場合の保険（スポーン高さ付近へ戻す）
    if (this.position.y < -20) {
      this.position.y = world.spawnPoint.y + 2;
      this.velocity.set(0, 0, 0);
    }
  }
}
