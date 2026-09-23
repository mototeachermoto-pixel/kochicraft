import * as THREE from 'three';
import type { BlockType } from '@/types';
import { BLOCK_TYPES } from './blocks/blockTypes';

/** 空気ブロックのID */
export const AIR = 0;

/**
 * ブロック定義の参照を提供するレジストリ。
 * id / key から BlockType を引け、色やフラグを高速に参照するための配列も持つ。
 */
class BlockRegistry {
  private byId = new Map<number, BlockType>();
  private byKey = new Map<string, BlockType>();

  /** id をインデックスにした高速参照テーブル */
  private solidTable: boolean[] = [];
  private transparentTable: boolean[] = [];
  private colorTable: THREE.Color[] = [];

  constructor(types: BlockType[]) {
    let maxId = 0;
    for (const t of types) maxId = Math.max(maxId, t.id);

    this.solidTable = new Array(maxId + 1).fill(false);
    this.transparentTable = new Array(maxId + 1).fill(true);
    this.colorTable = new Array(maxId + 1);

    for (const t of types) {
      this.byId.set(t.id, t);
      this.byKey.set(t.key, t);
      this.solidTable[t.id] = t.solid;
      this.transparentTable[t.id] = t.transparent;
      this.colorTable[t.id] = new THREE.Color(t.color);
    }
  }

  /** id から定義を取得（無ければ undefined） */
  get(id: number): BlockType | undefined {
    return this.byId.get(id);
  }

  /** key から定義を取得 */
  getByKey(key: string): BlockType | undefined {
    return this.byKey.get(key);
  }

  /** 衝突判定を持つか（範囲外idは false 扱い） */
  isSolid(id: number): boolean {
    return this.solidTable[id] ?? false;
  }

  /** 半透明か（範囲外idは true=空気扱い） */
  isTransparent(id: number): boolean {
    return this.transparentTable[id] ?? true;
  }

  /** 色を取得（範囲外idは黒） */
  getColor(id: number): THREE.Color {
    return this.colorTable[id] ?? new THREE.Color(0x000000);
  }

  /** 全ブロック定義（空気を除く） */
  all(): BlockType[] {
    return BLOCK_TYPES.filter((b) => b.id !== AIR);
  }
}

/** アプリ共有のブロックレジストリ */
export const blockRegistry = new BlockRegistry(BLOCK_TYPES);
