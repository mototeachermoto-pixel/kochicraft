import './ui/styles/main.css';
import { Engine } from '@/core/Engine';

/**
 * アプリのエントリーポイント。
 * Engine を生成してワールドを起動する。
 */
function main(): void {
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('#app 要素が見つかりません');
  }

  const engine = new Engine(container);
  // 確かめ用（?qa=1 のときだけ）：開発者の道具からエンジンをさわれるようにする。子どもの画面には影響しない
  if (new URLSearchParams(location.search).has('qa')) (window as unknown as { __kc: Engine }).__kc = engine;
  engine.start().catch((err) => {
    console.error('[KochiCraft] 起動に失敗しました:', err);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `<div class="loading__title">エラー</div>
        <div class="loading__sub">起動に失敗しました。ページを再読み込みしてください。</div>`;
    }
  });
}

main();
