import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardCatalog, MONSTERS, SKILLS, SUPPORTS } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { MAPS } from '../src/data/maps.ts';
import { TOURNAMENTS, tournamentOpponents } from '../src/data/tournaments.ts';
import { isValidAssetFileName } from '../src/core/assetCategories.ts';
import { checkCardData } from '../src/game/cards/dataChecks.ts';
import type { CardDefinition, MonsterCard, SkillCard } from '../src/game/cards/cardTypes.ts';
import { CONTENT_EN } from '../src/i18n/contentEn.ts';
import { AJ_SKILLS } from '../src/data/skillRebuildAJ.ts';

const options = {
  artExists: (path: string) => existsSync(join('assets', path)),
  hasEnglishName: (id: string) => CONTENT_EN[`card:${id}:name`] !== undefined,
};

describe('カードデータの点検（正式データを入れる前の土台）', () => {
  it('いまのカードデータに問題がない', () => {
    expect(checkCardData(cardCatalog.all(), options)).toEqual([]);
  });

  it('正式カードは15体（ソラモ・ラズック・ガウル・ノビトン・ミュロル・カルシェル・プカリム・ジオル・フルーネ・セレフィーン・ツムジ・ヒョウズク・シシエン・ハクラン・デスオル）と、指示書 AJ の表の技12種ずつ・サポートだけで、ほかはすべて仮', () => {
    const official = [...MONSTERS, ...SKILLS, ...SUPPORTS].filter((c) => !c.isPlaceholder).map((c) => c.id);
    const monsters = [
      'mon-soramo',
      'mon-lazuck',
      'mon-gauul',
      'mon-nobiton',
      'mon-myurol',
      'mon-kalshell',
      'mon-pukarim',
      'mon-geol',
      'mon-flune',
      'mon-serephine',
      'mon-tsumuji',
      'mon-hyouzuku',
      'mon-shishien',
      'mon-hakuran',
      'mon-desuoru',
    ];
    // 2026-11-01 指示書 AJ：技はモンスターの並びの順に、表（src/data/skillRebuildAJ.ts）の12枚ずつ（表の順＝表示の番号）
    const skills = monsters.flatMap((m) => (AJ_SKILLS[m] ?? []).map((r) => r.id));
    expect(skills).toHaveLength(15 * 12);
    expect(official).toEqual([
      ...monsters,
      ...skills,
      // サポート11種類（2026-10-30 指示書 Y。表示の番号 S01〜S07・F01〜F04 の順）
      ...[7, 2, 1, 8, 3, 9, 10, 4, 5, 6, 11].map((n) => `sup-${n}`),
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

  it('仮カードは画像がなくても問題にしない（仮の絵で表示する）。画像があるのは正式カード（ソラモ・ラズック・ガウル・ノビトン・ミュロル〔2026-10-31 指示書 AC【3】〕・カルシェル〔2026-10-30〕・プカリム・ジオル・フルーネ・セレフィーン・ツムジ・ヒョウズク・シシエン）だけ', () => {
    expect(cardCatalog.all().filter((c) => c.art && c.isPlaceholder)).toEqual([]);
    expect(cardCatalog.all().filter((c) => c.art).map((c) => c.id)).toEqual([
      'mon-soramo',
      'mon-lazuck',
      'mon-gauul',
      'mon-nobiton',
      'mon-myurol',
      'mon-kalshell',
      'mon-pukarim',
      'mon-geol',
      'mon-flune',
      'mon-serephine',
      'mon-tsumuji',
      'mon-hyouzuku',
      'mon-shishien',
      'mon-hakuran',
      'mon-desuoru',
      ...SKILLS.filter((s) => !s.isPlaceholder).map((s) => s.id),
      // サポート11種類（2026-10-30 指示書 Z で絵が入った）
      ...SUPPORTS.map((s) => s.id),
    ]);
    expect(checkCardData(cardCatalog.all(), options).filter((i) => i.code === 'officialWithoutArt')).toEqual([]);
  });
});

describe('カードの参照先', () => {
  const known = (id: string): boolean => cardCatalog.get(id) !== undefined;

  it('大会・ダンジョンの相手のモンスターがすべて実在するモンスター', () => {
    const opponents = [...TOURNAMENTS.flatMap(tournamentOpponents), ...Object.values(ENCOUNTERS)];
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
