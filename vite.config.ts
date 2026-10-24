import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * GitHub Pages（プロジェクトサイト）は https://<owner>.github.io/<repo>/ で配信されるため、
 * 本番ビルドの base はリポジトリ名のサブパスにする。
 *
 * - `npm run dev`        : base = '/'
 * - `npm run build`      : base = '/'（ローカル確認・汎用ホスティング向け）
 * - `npm run build:pages`: base = '/mistral-monsters-battle-card/'（GitHub Pages 向け）
 * - 環境変数 VITE_BASE_PATH を指定した場合はそれを最優先（独自ドメイン等）
 *
 * GitHub Actions（ci.yml・deploy-pages.yml）は VITE_BASE_PATH に「実際のリポジトリ名」を渡す。
 * そのため GitHub 上の改名が済む前に公開しても、旧URLに base の合わない壊れた版が出ることはない。
 */
/** GitHub 上のリポジトリ名（= Pages の base パス）。2026-10-24 正式名称ミストラルモンスターズへ改名（docs/rename-migration.md） */
export const REPO_NAME = 'mistral-monsters-battle-card';
/** 改名前のリポジトリ名（記録用。旧 Pages URL のパス） */
export const OLD_REPO_NAME = 'sacred-monsters-battle-card';
/** さらに前のリポジトリ名（2026-10-22 まで） */
export const OLDER_REPO_NAME = 'mirtill-monsters-battle-card';
export const PAGES_BASE = `/${REPO_NAME}/`;

export function resolveBase(mode: string, envBase?: string): string {
  if (envBase && envBase.trim() !== '') {
    const trimmed = envBase.trim();
    const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withLead.endsWith('/') ? withLead : `${withLead}/`;
  }
  return mode === 'pages' ? PAGES_BASE : '/';
}

export default defineConfig(({ mode }) => ({
  base: resolveBase(mode, process.env.VITE_BASE_PATH),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@assets': fileURLToPath(new URL('./assets', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    sourcemap: true,
    // 画像は小さくてもファイルとして出力し、base 配下のパスで解決させる
    assetsInlineLimit: 0,
  },
  server: {
    host: true, // 同一ネットワークのスマホ実機から確認できるようにする
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
