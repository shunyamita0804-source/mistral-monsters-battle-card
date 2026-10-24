/**
 * public/ に置いた静的ファイルのURLを、デプロイ先の base パスを考慮して組み立てる。
 *
 * GitHub Pages では `/mistral-monsters-battle-card/` 配下で配信されるため、
 * `/images/foo.png` のような絶対パスを直書きするとリンク切れになる。
 * public/ のファイルは必ずこの関数を通して参照する。
 *
 * ※ assets/ のファイルは `import url from '@assets/...'` で読み込めば
 *    Vite が base 付きのURLへ自動変換するため、この関数は不要。
 */
export function resolvePublicPath(path: string, base: string = import.meta.env.BASE_URL): string {
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(path) || path.startsWith('data:')) {
    return path; // 外部URL・data URI はそのまま
  }
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.replace(/^\.?\/+/, '');
  return `${normalizedBase}${normalizedPath}`;
}
