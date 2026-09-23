import type { SpotDefinition } from './SpotDefinition';
import { katsurahama } from './katsurahama';
import { kochiCastle } from './kochiCastle';
import { harimayaBridge } from './harimayaBridge';
import { nikobuchi } from './nikobuchi';
import { shimanto } from './shimanto';
import { muroto } from './muroto';
import { ashizuri } from './ashizuri';
import { hirome } from './hirome';
import { ryomaStatue } from './ryomaStatue';
import { makino } from './makino';
import { noichi } from './noichi';
import { ryugado } from './ryugado';

/**
 * 高知県の観光地一覧（ハブに並ぶ順）。全12観光地を実装済み。
 * 新しい観光地を追加するときは `src/spots/<id>.ts` を作り、ここに import して並べる。
 * （未実装にしたいカードは `available:false` の SpotDefinition を置けばよい）
 */
export const SPOTS: SpotDefinition[] = [
  katsurahama,
  kochiCastle,
  harimayaBridge,
  nikobuchi,
  shimanto,
  muroto,
  ashizuri,
  hirome,
  ryomaStatue,
  makino,
  noichi,
  ryugado,
];

export function getSpot(id: string): SpotDefinition | undefined {
  return SPOTS.find((s) => s.id === id);
}
