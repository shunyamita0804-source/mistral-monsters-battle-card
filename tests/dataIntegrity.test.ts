import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardCatalog, MONSTERS, SKILLS, SUPPORTS } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { MAPS } from '../src/data/maps.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { isValidAssetFileName } from '../src/core/assetCategories.ts';
import { checkCardData } from '../src/game/cards/dataChecks.ts';
import type { CardDefinition, MonsterCard, SkillCard } from '../src/game/cards/cardTypes.ts';
import { CONTENT_EN } from '../src/i18n/contentEn.ts';

const options = {
  artExists: (path: string) => existsSync(join('assets', path)),
  hasEnglishName: (id: string) => CONTENT_EN[`card:${id}:name`] !== undefined,
};

describe('カードデータの点検（正式データを入れる前の土台）', () => {
  it('いまのカードデータに問題がない', () => {
    expect(checkCardData(cardCatalog.all(), options)).toEqual([]);
  });

  it('正式カードはソラモ・ラズック・ガウル・ノビトン・ミュロル（モンスターと技16種ずつ）だけで、ほかはすべて仮', () => {
    const official = [...MONSTERS, ...SKILLS, ...SUPPORTS].filter((c) => !c.isPlaceholder).map((c) => c.id);
    const skillIds = (key: string, nos: readonly number[]): string[] => nos.map((n) => `skl-${key}-${String(n).padStart(2, '0')}`);
    const all = Array.from({ length: 16 }, (_, i) => i + 1);
    // ラズックは表示の番号の順（07・08＝旧09・10、09・10＝旧07・08、11＝いたずら、12・13＝旧11・12）。旧13 クロスガードは削除
    const lazuck = [...skillIds('lazuck', [1, 2, 3, 4, 5, 6, 9, 10, 7, 8]), 'skl-lazuck-itazura', ...skillIds('lazuck', [11, 12, 14, 15, 16])];
    expect(official).toEqual([
      'mon-soramo',
      'mon-lazuck',
      'mon-gauul',
      'mon-nobiton',
      'mon-myurol',
      ...skillIds('soramo', all),
      ...lazuck,
      ...skillIds('gauul', all),
      ...skillIds('nobiton', all),
      ...skillIds('myurol', all),
    ]);
  });

  it('問題のあるデータを見つけられる', () => {
    const monster = MONSTERS[0] as MonsterCard;
    const skill = SKILLS[0] as SkillCard;
    const bad: CardDefinition[] = [
      monster,
      { ...monster }, // ID の重複
      { ...skill, id: 'skl-x', monsterId: 'mon-nobody' }, // 適合モンスターがいない
      { ...skill, id: 'skl-y', name: 'テスト技' }, // 仮なのに「仮」がない
      { ...monster, id: 'mon-official', name: '仮ドラゴン', isPlaceholder: false }, // 正式なのに「仮」・画像なし・英語名なし
      { ...monster, id: 'mon-art', art: { category: 'monsterCards', file: 'nothing_here.png', layout: 'full' } }, // 画像ファイルがない
      { ...monster, id: 'mon-art2', art: { category: 'monsterCards', file: 'Bad Name.PNG', layout: 'full' } }, // ファイル名が規則外
    ];
    expect(checkCardData(bad, options).map((i) => `${i.cardId}:${i.code}`)).toEqual([
      `${monster.id}:duplicateId`,
      'skl-x:missingMonster',
      'skl-y:placeholderName',
      'mon-official:officialNamedAsPlaceholder',
      'mon-official:officialWithoutArt',
      'mon-official:missingEnglishName',
      'mon-art:artFileMissing',
      'mon-art2:artFileNameInvalid',
    ]);
  });

  it('仮カードは画像がなくても問題にしない（仮の絵で表示する）。画像があるのは正式カード（ソラモ・ラズック・ガウル・ノビトン、ミュロルは技だけ）だけ', () => {
    expect(cardCatalog.all().filter((c) => c.art && c.isPlaceholder)).toEqual([]);
    expect(cardCatalog.all().filter((c) => c.art).map((c) => c.id)).toEqual([
      'mon-soramo',
      'mon-lazuck',
      'mon-gauul',
      'mon-nobiton',
      ...SKILLS.filter((s) => !s.isPlaceholder).map((s) => s.id),
    ]);
    expect(checkCardData(cardCatalog.all(), options).filter((i) => i.code === 'officialWithoutArt')).toEqual([]);
  });
});

describe('カードの参照先', () => {
  const known = (id: string): boolean => cardCatalog.get(id) !== undefined;

  it('大会・ダンジョンの相手のモンスターがすべて実在するモンスター', () => {
    const opponents = [...TOURNAMENTS.flatMap((t) => t.rounds), ...Object.values(ENCOUNTERS)];
    const bad = opponents.flatMap((o) => o.monsters.filter((m) => cardCatalog.get(m)?.kind !== 'monster').map((m) => `${o.id}:${m}`));
    expect(bad).toEqual([]);
  });

  it('景品・宝箱のカードがすべて実在する', () => {
    const rewards = [
      ...TOURNAMENTS.flatMap((t) => t.rewards.firstWin.cards),
      ...MAPS.flatMap((m) => m.objects.flatMap((o) => (o.type === 'chest' ? o.reward.cards : []))),
    ];
    expect(rewards.filter((r) => !known(r.cardId))).toEqual([]);
  });
});

describe('素材ファイル', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

  it('assets/ のファイル名はすべて命名規則どおり', () => {
    const bad = walk('assets')
      .map((p) => p.split('/').pop() as string)
      .filter((name) => !name.startsWith('.') && name !== 'README.md' && !isValidAssetFileName(name));
    expect(bad).toEqual([]);
  });

  it('画面で使う public/ のアイコンがそろっている', () => {
    for (const f of ['icon-512.png', 'icon-192.png', 'apple-touch-icon.png', 'favicon-48.png', 'favicon-32.png', 'favicon-16.png']) {
      expect(existsSync(join('public/icons', f))).toBe(true);
    }
  });
});
