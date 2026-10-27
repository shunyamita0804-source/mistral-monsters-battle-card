import { assetRelativePath } from '../../core/assetCategories.ts';
import type { CardDefinition } from './cardTypes.ts';

/**
 * カードデータの点検（正式カード・正式画像を入れる前の土台。tests/dataIntegrity.test.ts で毎回動かす）。
 *
 * 仮カードと正式カードで基準を分ける：
 * - 仮カード（isPlaceholder: true）：名前は「仮」で始まる（隠し・未確定は「？？？」「隠し技（未確定）」も可）。画像はなくてよい（仮の絵で表示）
 * - 正式カード（isPlaceholder: false）：名前に「仮」を付けない。画像（art）が必須で、ファイルが実在すること（絵が未定と記したもの〔pendingSpec に 'art'〕は除く）。英語名が必要
 * どちらも：ID の重複なし・技の適合モンスターが実在する・画像を指定したならファイルが実在する・ファイル名が命名規則どおり
 */
export interface CardDataIssue {
  readonly cardId: string;
  readonly code:
    | 'duplicateId'
    | 'missingMonster'
    | 'placeholderName'
    | 'officialNamedAsPlaceholder'
    | 'officialWithoutArt'
    | 'artFileMissing'
    | 'artFileNameInvalid'
    | 'missingEnglishName';
}

export interface CardDataCheckOptions {
  /** assets/ からの相対パスのファイルがあるか */
  readonly artExists: (relativePath: string) => boolean;
  /** 英語名があるか（正式カードだけ確かめる） */
  readonly hasEnglishName: (cardId: string) => boolean;
}

const PLACEHOLDER_NAME = /^(仮|？？？|隠し技（未確定）)/;

export function checkCardData(cards: readonly CardDefinition[], options: CardDataCheckOptions): CardDataIssue[] {
  const issues: CardDataIssue[] = [];
  const seen = new Set<string>();
  const monsters = new Set(cards.filter((c) => c.kind === 'monster').map((c) => c.id));
  for (const card of cards) {
    const add = (code: CardDataIssue['code']): void => {
      issues.push({ cardId: card.id, code });
    };
    if (seen.has(card.id)) add('duplicateId');
    seen.add(card.id);
    if (card.kind === 'skill' && !monsters.has(card.monsterId)) add('missingMonster');
    if (card.isPlaceholder) {
      if (!PLACEHOLDER_NAME.test(card.name)) add('placeholderName');
    } else {
      if (card.name.startsWith('仮')) add('officialNamedAsPlaceholder');
      // 絵がまだ決まっていない正式カード（pendingSpec に 'art'）は、絵なしでよい（仮の絵で表示）。
      // 名前・LIFE 入りの1枚絵を持たず、バトル用の絵を重ねて描くモンスター（2026-10-27 ミュロル）も絵ありとする
      const layered = card.kind === 'monster' && !!card.battleArt;
      if (!card.art && !layered && !card.pendingSpec?.includes('art')) add('officialWithoutArt');
      if (!options.hasEnglishName(card.id)) add('missingEnglishName');
    }
    if (card.art) {
      let path: string | null = null;
      try {
        path = assetRelativePath(card.art.category, card.art.file);
      } catch {
        add('artFileNameInvalid');
      }
      if (path !== null && !options.artExists(path)) add('artFileMissing');
    }
  }
  return issues;
}
