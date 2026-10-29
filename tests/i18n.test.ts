import { afterEach, describe, expect, it } from 'vitest';
import { APP_INFO, localizedGameName } from '../src/config/app.ts';
import { cardCatalog, MONSTERS, SKILLS, SUPPORTS } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { PACKS } from '../src/data/economy.ts';
import { EXAM_OPPONENT } from '../src/data/introV2.ts';
import { PETE_OPPONENT } from '../src/game/story/pete.ts';
import { ITEMS } from '../src/data/items.ts';
import { MAPS } from '../src/data/maps.ts';
import { TOURNAMENTS, tournamentOpponents } from '../src/data/tournaments.ts';
import { describeSkill, describeSupport, statLabel, supportShortText } from '../src/game/cards/cardTypes.ts';
import { validateDeck } from '../src/game/deck/deck.ts';
import { cardName, contentText, packName } from '../src/i18n/content.ts';
import { CONTENT_EN } from '../src/i18n/contentEn.ts';
import { format, getLanguage, onLanguageChange, placeholdersOf, setLanguage, t, tKey } from '../src/i18n/i18n.ts';
import { MESSAGE_GROUPS, MESSAGES } from '../src/i18n/messages/index.ts';
import { getSkill } from '../src/data/cards.ts';

afterEach(() => setLanguage('ja'));

const entries = Object.entries(MESSAGES) as [string, { ja: string; en: string }][];

describe('辞書（固定キー → ja/en）', () => {
  it('すべてのキーに日本語と英語があり、空でない', () => {
    const empty = entries.filter(([, e]) => e.ja.trim() === '' || e.en.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('日本語と英語でプレースホルダーが同じ', () => {
    const mismatch = entries
      .filter(([, e]) => placeholdersOf(e.ja).join(',') !== placeholdersOf(e.en).join(','))
      .map(([k, e]) => `${k}: ja[${placeholdersOf(e.ja)}] en[${placeholdersOf(e.en)}]`);
    expect(mismatch).toEqual([]);
  });

  it('同じキーが2つの分野にない', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const [group, messages] of Object.entries(MESSAGE_GROUPS)) {
      for (const key of Object.keys(messages)) {
        if (seen.has(key)) dup.push(`${key}（${seen.get(key)} と ${group}）`);
        seen.set(key, group);
      }
    }
    expect(dup).toEqual([]);
  });

  it('キーは分野の名前で始まる', () => {
    const bad = entries.map(([k]) => k).filter((k) => !/^[a-z][A-Za-z0-9]*\.[A-Za-z0-9.]+$/.test(k));
    expect(bad).toEqual([]);
  });

  it('長い同じ日本語文が2つのキーに重複していない（短い語は除く）', () => {
    const byText = new Map<string, string[]>();
    for (const [k, e] of entries) {
      if (e.ja.length < 8) continue;
      byText.set(e.ja, [...(byText.get(e.ja) ?? []), k]);
    }
    const dup = [...byText.entries()].filter(([, keys]) => keys.length > 1).map(([text, keys]) => `${keys.join(' / ')}: ${text}`);
    expect(dup).toEqual([]);
  });
});

describe('t() と言語の切り替え', () => {
  it('初期値は日本語で、英語に切り替えられる', () => {
    expect(getLanguage()).toBe('ja');
    expect(t('common.back')).toBe('戻る');
    setLanguage('en');
    expect(t('common.back')).toBe('Back');
  });

  it('プレースホルダーと英語の単数・複数', () => {
    expect(format('{n} {n|card|cards}', { n: 1 })).toBe('1 card');
    expect(format('{n} {n|card|cards}', { n: 3 })).toBe('3 cards');
    expect(t('common.cardCount', { n: 2 }, 'ja')).toBe('2枚');
    expect(t('common.cardCount', { n: 1 }, 'en')).toBe('1 card');
    // 埋めるものがないプレースホルダーはそのまま残す（欠けに気づけるように）
    expect(format('{a}と{b}', { a: 'x' })).toBe('xと{b}');
  });

  it('辞書にないキーは fallback に戻す', () => {
    expect(tKey('nothing.here', {}, 'フォールバック')).toBe('フォールバック');
    expect(tKey('card.rarity.R')).toBe('レア');
  });

  it('切り替えを知らせ、同じ言語なら知らせない', () => {
    const seen: string[] = [];
    const off = onLanguageChange((l) => seen.push(l));
    setLanguage('en');
    setLanguage('en');
    setLanguage('ja');
    off();
    setLanguage('en');
    expect(seen).toEqual(['en', 'ja']);
  });

  it('ゲーム名は言語で変わる（正式名称）', () => {
    expect(localizedGameName('ja')).toBe(APP_INFO.gameName);
    expect(localizedGameName('en')).toBe('Mistral Monsters Battle Card');
  });
});

describe('カードの文字（ID と表示を分ける）', () => {
  it('カード名は ID から引き、英語がなければ日本語に戻す', () => {
    const card = MONSTERS[0]!;
    expect(cardName(card.id)).toBe(card.name);
    setLanguage('en');
    expect(cardName(card.id)).toMatch(/^Temp Monster /);
    expect(contentText('card', 'no-such-card', 'name', '日本語')).toBe('日本語');
  });

  it('効果説明は言語ごとに組み立て、数値は同じ', () => {
    const skill = getSkill('skl-a-1');
    const ja = describeSkill(skill);
    setLanguage('en');
    const en = describeSkill(skill);
    expect(ja).toContain(String(skill.stat?.value));
    expect(en).toContain(String(skill.stat?.value));
    expect(en).toContain(statLabel(skill.stat?.type ?? 'force'));
    expect(en).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
  });

  it('英語表示ではすべてのカード説明に日本語が残らない', () => {
    setLanguage('en');
    const texts = [
      ...SKILLS.map(describeSkill),
      ...SUPPORTS.map(describeSupport),
      ...SUPPORTS.map(supportShortText),
      ...cardCatalog.all().map((c) => cardName(c)),
    ];
    expect(texts.filter((x) => /[ぁ-んァ-ヶ一-龠]/.test(x))).toEqual([]);
  });

  it('言語を変えてもデッキの判定（データ）は変わらない', () => {
    const deck = { monsters: ['mon-a'], skills: [] };
    const ja = validateDeck(deck).map((i) => i.code);
    setLanguage('en');
    const en = validateDeck(deck);
    expect(en.map((i) => i.code)).toEqual(ja);
    expect(en[0]?.message).toBe('You need 3 monsters (now 1)');
  });
});

describe('data/ の固有名の英語（仮訳）', () => {
  /** 英語がない固有名（あれば一覧に出す。いまは仮訳で全部そろっている） */
  const missing = (): string[] => {
    const keys: string[] = [
      ...cardCatalog.all().map((c) => `card:${c.id}:name`),
      ...PACKS.flatMap((p) => ['name', 'description', 'unlockHint'].map((f) => `pack:${p.id}:${f}`)),
      ...TOURNAMENTS.flatMap((t) => [`tournament:${t.id}:name`, `tournament:${t.id}:description`, ...tournamentOpponents(t).map((r) => `opponent:${r.id}:name`)]),
      ...DUNGEONS.flatMap((d) => [`dungeon:${d.id}:name`, `dungeon:${d.id}:description`]),
      ...Object.values(ENCOUNTERS).map((e) => `opponent:${e.id}:name`),
      `opponent:${EXAM_OPPONENT.id}:name`,
      ...MAPS.map((m) => `map:${m.id}:name`),
      ...MAPS.flatMap((m) =>
        m.objects.flatMap((o) =>
          o.type === 'interact' || o.type === 'warp'
            ? [`object:${o.id}:label`, ...(o.type === 'interact' && o.message ? [`object:${o.id}:message`] : [])]
            : [],
        ),
      ),
    ];
    return keys.filter((k) => CONTENT_EN[k] === undefined);
  };

  it('すべての固有名に英語（仮訳）がある', () => {
    expect(missing()).toEqual([]);
  });

  it('英語表の項目は実在する ID だけ', () => {
    const ids = new Set<string>([
      ...cardCatalog.all().map((c) => `card:${c.id}`),
      'card:monster',
      ...PACKS.map((p) => `pack:${p.id}`),
      ...ITEMS.map((i) => `item:${i.id}`),
      ...TOURNAMENTS.map((t) => `tournament:${t.id}`),
      ...TOURNAMENTS.flatMap((t) => tournamentOpponents(t).map((r) => `opponent:${r.id}`)),
      ...DUNGEONS.map((d) => `dungeon:${d.id}`),
      ...Object.values(ENCOUNTERS).map((e) => `opponent:${e.id}`),
      `opponent:${EXAM_OPPONENT.id}`,
      `opponent:${PETE_OPPONENT.id}`,
      ...MAPS.map((m) => `map:${m.id}`),
      ...MAPS.flatMap((m) => m.objects.map((o) => `object:${o.id}`)),
    ]);
    const stale = Object.keys(CONTENT_EN).filter((k) => !ids.has(k.split(':').slice(0, 2).join(':')));
    expect(stale).toEqual([]);
  });

  it('仮データの英語は「Temp」などで仮とわかる', () => {
    setLanguage('en');
    for (const p of PACKS) expect(packName(p)).toContain('(Temp)');
    for (const c of cardCatalog.all()) {
      if (c.isPlaceholder) expect(cardName(c)).toMatch(/^(Temp |Hidden Skill \(TBD\)|\?\?\?)/);
    }
  });
});
