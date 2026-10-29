import { describe, expect, it } from 'vitest';
import { BOOSTERS } from '../src/data/introV2.ts';
import { receivedCardList } from '../src/game/cards/receivedCards.ts';
import { canDecideName, graphemes, limitNameInput, MAX_NAME_LENGTH, nameLength, normalizeName, readSavedName } from '../src/game/player/playerName.ts';
import { createNewGameSave, createNewSave, migrate, normalizeSave, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { heroName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const cp = (...codes: number[]): string => String.fromCodePoint(...codes);
/** 絵文字（笑顔・家族の合成・国旗・キーキャップ） */
const SMILE = cp(0x1f600);
const FAMILY = cp(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
const FLAG_JP = cp(0x1f1ef, 0x1f1f5);
const KEYCAP_1 = `1${cp(0xfe0f, 0x20e3)}`;

describe('主人公の名前の決まり（2026-10-28）', () => {
  it('最大8文字。見た目の1文字を1文字と数える（濁点を分けた「か＋゛」も1文字）', () => {
    expect(MAX_NAME_LENGTH).toBe(8);
    expect(nameLength('ああああああああ')).toBe(8);
    expect(nameLength('ＷＷＷＷＷＷＷＷ')).toBe(8);
    expect(nameLength('WWWWWWWW')).toBe(8);
    expect(nameLength(`か${cp(0x3099)}`)).toBe(1);
    expect(graphemes('ミレイユ')).toEqual(['ミ', 'レ', 'イ', 'ユ']);
  });

  it('8文字を超えた分は切る（入力の途中でも）。漢字・ひらがな・カタカナ・英数字はそのまま', () => {
    expect(limitNameInput('ああああああああああ')).toBe('ああああああああ');
    expect(normalizeName('山田太郎たろうタロウTaro99')).toBe('山田太郎たろうタ');
    expect(normalizeName('Mireille2')).toBe('Mireille');
    expect(normalizeName('勇者ゆうしゃ')).toBe('勇者ゆうしゃ');
  });

  it('前後の空白（半角・全角）は消す。間の空白は残す', () => {
    expect(normalizeName('  ミレ イユ　')).toBe('ミレ イユ');
    expect(normalizeName('　　　')).toBe('');
    // 入力の途中では前後の空白を消さない（打っている途中の空白で決定が灰色にならないように、決めるときに消す）
    expect(limitNameInput(' ミレ ')).toBe(' ミレ ');
  });

  it('絵文字・危ない記号（< > / \\ & " \' `）・改行などの見えない文字は入らない', () => {
    expect(normalizeName(`ミレ${SMILE}イユ`)).toBe('ミレイユ');
    expect(normalizeName(`${FAMILY}${FLAG_JP}${KEYCAP_1}たろう`)).toBe('1たろう');
    expect(normalizeName('<b>ミレ</b>')).toBe('bミレb');
    expect(normalizeName('a/b\\c&d"e\'f`g')).toBe('abcdefg');
    expect(normalizeName(`ミレ\nイユ\t${cp(0x202e)}`)).toBe('ミレイユ');
    // 絵文字を除いてから8文字にそろえる
    expect(normalizeName(`${SMILE}ああああああああ${SMILE}`)).toBe('ああああああああ');
  });

  it('1文字も無いときは決められない', () => {
    expect(canDecideName('')).toBe(false);
    expect(canDecideName('   ')).toBe(false);
    expect(canDecideName(SMILE)).toBe(false);
    expect(canDecideName('<>')).toBe(false);
    expect(canDecideName('あ')).toBe(true);
  });

  it('セーブから読んだ名前：文字列でなければ・空なら null（まだ決めていない）。長すぎる・記号入りは直す', () => {
    expect(readSavedName(undefined)).toBeNull();
    expect(readSavedName(null)).toBeNull();
    expect(readSavedName(12)).toBeNull();
    expect(readSavedName('  ')).toBeNull();
    expect(readSavedName('ミレイユ')).toBe('ミレイユ');
    expect(readSavedName('ああああああああああ<>')).toBe('ああああああああ');
  });

  it('画面に出す名前：決めた名前。まだ無い前のセーブは「あなた」（英語は You）', () => {
    setLanguage('ja');
    expect(heroName('ミレイユの友')).toBe('ミレイユの友');
    expect(heroName(null)).toBe('あなた');
    setLanguage('en');
    expect(heroName(null)).toBe('You');
    expect(heroName('ああ')).toBe('ああ');
    setLanguage('ja');
  });
});

describe('名前のセーブ（SAVE_VERSION 22 で足した）', () => {
  it('新しいセーブは名前なし（主人公を選んだあとに決める）', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(22);
    expect(createNewSave().player).toEqual({ gender: null, name: null });
    expect(createNewGameSave().player.name).toBeNull();
  });

  it('前のセーブ（version 21）は name: null を足して読む。ほかの中身はそのまま', () => {
    const v21 = { ...createNewSave(), version: 21, player: { gender: 'female' }, coins: 4321 } as Record<string, unknown>;
    const migrated = migrate(v21);
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.player).toEqual({ gender: 'female', name: null });
    const save = normalizeSave(v21);
    expect(save?.player).toEqual({ gender: 'female', name: null });
    expect(save?.coins).toBe(4321);
  });

  it('player が壊れていても読める（名前なし）', () => {
    const save = normalizeSave({ ...createNewSave(), version: 21, player: 'x' });
    expect(save?.player).toEqual({ gender: null, name: null });
  });

  it('名前を入れたセーブは、書いて読み直しても同じ名前。おかしな名前は直して読む', () => {
    const named = { ...createNewSave(), player: { gender: 'male' as const, name: 'ＷＷＷＷＷＷＷＷ' } };
    expect(normalizeSave(JSON.parse(JSON.stringify(named)))?.player.name).toBe('ＷＷＷＷＷＷＷＷ');
    expect(normalizeSave({ ...named, player: { gender: 'male', name: `<${SMILE}>` } })?.player.name).toBeNull();
  });
});

describe('取得カードの並び（2026-10-28）', () => {
  it('箱の中身：モンスター3体（箱の順）→ 技カード（モンスターの順・番号順）→ サポート。枚数は箱と同じ', () => {
    for (const b of BOOSTERS) {
      const deck = boosterDeck(b.key);
      const list = receivedCardList([...deck.monsters, ...deck.skills]);
      expect(list.slice(0, 3).map((r) => r.card.id)).toEqual(deck.monsters);
      expect(list.reduce((n, r) => n + r.count, 0)).toBe(63);
      const kinds = list.map((r) => r.card.kind);
      const order = { monster: 0, skill: 1, support: 2 } as const;
      expect([...kinds].sort((a, c) => order[a] - order[c])).toEqual(kinds);
      // 技は、もらったモンスターの順に並ぶ
      const skillOwners = list.flatMap((r) => (r.card.kind === 'skill' ? [deck.monsters.indexOf(r.card.monsterId)] : []));
      expect([...skillOwners].sort((a, c) => a - c)).toEqual(skillOwners);
    }
  });

  it('同じカードは1行にまとめて枚数（×3 など）。台帳に無い ID は数えない', () => {
    const [m] = boosterDeck('booster-1').monsters;
    const list = receivedCardList(['skl-x-unknown', m as string, m as string]);
    expect(list).toHaveLength(1);
    expect(list[0]?.count).toBe(2);
    expect(receivedCardList([])).toEqual([]);
  });
});
