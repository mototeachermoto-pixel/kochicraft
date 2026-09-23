import * as THREE from 'three';
import type { World } from '@/world/World';

/**
 * ボクセル世界に対するAABB（直方体）衝突解決。
 * 軸ごとに移動→めり込み補正を行うシンプルで安定した方式。
 * 1フレームの移動量がブロック幅未満であることを前提にしている。
 */

const EPS = 1e-3;

export interface CollideResult {
  /** 地面に接地しているか */
  onGround: boolean;
}

/** 現在のAABBがいずれかの固体ブロックと重なっているか */
function collides(world: World, pos: THREE.Vector3, halfW: number, height: number): boolean {
  const minX = Math.floor(pos.x - halfW + EPS);
  const maxX = Math.floor(pos.x + halfW - EPS);
  const minY = Math.floor(pos.y + EPS);
  const maxY = Math.floor(pos.y + height - EPS);
  const minZ = Math.floor(pos.z - halfW + EPS);
  const maxZ = Math.floor(pos.z + halfW - EPS);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (world.isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

/**
 * 速度に従って位置を更新し、ブロックへのめり込みを補正する。
 * pos / vel は破壊的に更新される。
 */
export function moveAndCollide(
  world: World,
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  dt: number,
  halfW: number,
  height: number,
  stepHeight = 0,
  grounded = false,
): CollideResult {
  let onGround = false;

  // 自動ステップ判定のため、移動前の位置と「行きたかった量」を控える
  const startX = pos.x;
  const startZ = pos.z;
  const startY = pos.y;
  const wantX = vel.x * dt;
  const wantZ = vel.z * dt;

  // --- X軸 ---
  pos.x += wantX;
  let blockedX = false;
  if (collides(world, pos, halfW, height)) {
    if (vel.x > 0) pos.x = Math.floor(pos.x + halfW) - halfW - EPS;
    else if (vel.x < 0) pos.x = Math.floor(pos.x - halfW) + 1 + halfW + EPS;
    vel.x = 0;
    blockedX = true;
  }

  // --- Z軸 ---
  pos.z += wantZ;
  let blockedZ = false;
  if (collides(world, pos, halfW, height)) {
    if (vel.z > 0) pos.z = Math.floor(pos.z + halfW) - halfW - EPS;
    else if (vel.z < 0) pos.z = Math.floor(pos.z - halfW) + 1 + halfW + EPS;
    vel.z = 0;
    blockedZ = true;
  }

  // --- 自動ステップ：低い段差なら持ち上げて前進する（接地時のみ） ---
  // 段差を「歩いて越える」ためのUX改善。1ブロック程度の段なら、
  // 本来の水平目標を stepHeight だけ上げて衝突しなければ、その上に乗せる。
  if (stepHeight > 0 && grounded && (blockedX || blockedZ) && (wantX !== 0 || wantZ !== 0)) {
    const resolvedX = pos.x;
    const resolvedZ = pos.z;
    pos.x = startX + wantX;
    pos.z = startZ + wantZ;
    pos.y = startY + stepHeight;
    if (collides(world, pos, halfW, height)) {
      // 段差ではなく壁だった → 従来の解決位置へ戻す
      pos.x = resolvedX;
      pos.z = resolvedZ;
      pos.y = startY;
    }
    // 成功時は段の上に持ち上げたまま（着地は下のY軸処理に任せる）
  }

  // --- Y軸（重力・ジャンプ） ---
  pos.y += vel.y * dt;
  if (collides(world, pos, halfW, height)) {
    if (vel.y > 0) {
      // 天井に頭をぶつけた
      pos.y = Math.floor(pos.y + height) - height - EPS;
    } else if (vel.y < 0) {
      // 着地
      pos.y = Math.floor(pos.y) + 1 + EPS;
      onGround = true;
    }
    vel.y = 0;
  }

  return { onGround };
}
