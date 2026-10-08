import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Vite 設定。
 * - base: './' とすることで、ビルド成果物を任意の場所（ローカルファイル/学校サーバ）に
 *   置いても相対パスで動作する（インターネット接続不要の方針に対応）。
 * - alias '@' は src/ を指す。
 * - HTTPS=1 のときだけ自己署名証明書で HTTPS 配信する（`npm run preview:https`）。
 *   タブレット等で「HTTPS-Only モード」が有効だと http:// が開けないため、その回避用。
 *   ふだんの `npm run dev` は今までどおり http のまま（証明書の警告が出ない）。
 */
const useHttps = process.env.HTTPS === '1';

/**
 * GAS 用（`npm run build:gas`）：Google Apps Script はファイルを1つずつしか配信できないため、
 * プログラムと見た目を index.html 1枚に詰め込み、gas/ に出力する。写真（public）は含めない。
 */
const gasBuild = defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'gas',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: false,
  },
});

export default defineConfig(({ mode }) => mode === 'gas' ? gasBuild : {
  base: './',
  plugins: useHttps ? [basicSsl()] : [],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    // 公開用の成果物には開発用のソースマップを含めない
    // （読み込みが軽くなり、ソースコードも見えなくなる。
    //   開発中は npm run dev 側で常にソースマップが使えるので支障はない）
    sourcemap: false,
    // Three.js を別チャンクに分離し、アプリ本体と分けてキャッシュ効率を上げる
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
