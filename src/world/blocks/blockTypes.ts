import type { BlockType } from '@/types';

/**
 * ブロック種類の定義データ。
 * Phase 1 では地形生成に使う自然系を中心に利用するが、
 * 仕様のブロック一覧（建材・装飾）も将来の建築モードに向けて登録しておく。
 *
 * id=0 は「空気（air）」固定。
 */
export const BLOCK_TYPES: BlockType[] = [
  { id: 0, key: 'air', name: '空気', nameEn: 'Air', color: '#000000', transparent: true, solid: false, category: 'nature' },

  // ----- 自然系 -----
  { id: 1, key: 'grass', name: '草', nameEn: 'Grass', color: '#5aa641', transparent: false, solid: true, category: 'nature' },
  { id: 2, key: 'dirt', name: '土', nameEn: 'Dirt', color: '#8a5a33', transparent: false, solid: true, category: 'nature' },
  { id: 3, key: 'stone', name: '石', nameEn: 'Stone', color: '#8d8d8d', transparent: false, solid: true, category: 'nature' },
  { id: 4, key: 'sand', name: '砂', nameEn: 'Sand', color: '#e3d49b', transparent: false, solid: true, category: 'nature' },
  { id: 5, key: 'water', name: '水', nameEn: 'Water', color: '#3a86c8', transparent: true, solid: false, category: 'nature' },
  { id: 6, key: 'wood', name: '木', nameEn: 'Wood', color: '#7a5230', transparent: false, solid: true, category: 'nature' },
  { id: 7, key: 'leaves', name: '葉', nameEn: 'Leaves', color: '#3f8b34', transparent: false, solid: true, category: 'nature' },
  { id: 8, key: 'bamboo', name: '竹', nameEn: 'Bamboo', color: '#7fb04f', transparent: false, solid: true, category: 'nature' },
  { id: 9, key: 'flower', name: '花', nameEn: 'Flower', color: '#e36ba0', transparent: false, solid: true, category: 'decor' },

  // ----- 建材系 -----
  { id: 10, key: 'tile', name: '瓦', nameEn: 'Roof Tile', color: '#54616e', transparent: false, solid: true, category: 'build' },
  { id: 11, key: 'brick', name: 'レンガ', nameEn: 'Brick', color: '#b05a3c', transparent: false, solid: true, category: 'build' },
  { id: 12, key: 'glass', name: 'ガラス', nameEn: 'Glass', color: '#bfe6f5', transparent: true, solid: true, category: 'build' },
  { id: 13, key: 'bridge', name: '橋', nameEn: 'Bridge', color: '#9c6b3f', transparent: false, solid: true, category: 'build' },
  { id: 14, key: 'road', name: '道路', nameEn: 'Road', color: '#5b5b5b', transparent: false, solid: true, category: 'build' },
  { id: 15, key: 'stonewall', name: '石垣', nameEn: 'Stone Wall', color: '#9a958a', transparent: false, solid: true, category: 'build' },
  { id: 16, key: 'roof', name: '屋根', nameEn: 'Roof', color: '#7a3b2e', transparent: false, solid: true, category: 'build' },
  { id: 17, key: 'turf', name: '芝生', nameEn: 'Turf', color: '#6cbf4a', transparent: false, solid: true, category: 'build' },
  { id: 18, key: 'castlewall', name: '城壁', nameEn: 'Castle Wall', color: '#e9e4d6', transparent: false, solid: true, category: 'build' },

  // ----- 装飾系 -----
  { id: 19, key: 'sakura', name: '桜', nameEn: 'Sakura', color: '#f2b6d0', transparent: false, solid: true, category: 'decor' },
  { id: 20, key: 'torii', name: '鳥居', nameEn: 'Torii', color: '#c63b2f', transparent: false, solid: true, category: 'decor' },
  { id: 21, key: 'lantern', name: '灯籠', nameEn: 'Lantern', color: '#cfc2a0', transparent: false, solid: true, category: 'decor' },
];
