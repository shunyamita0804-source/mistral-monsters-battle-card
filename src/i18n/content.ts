import { cardCatalog } from '../data/cards.ts';
import type { DungeonDefinition } from '../data/dungeons.ts';
import type { PackDefinition } from '../data/economy.ts';
import type { MapDefinition, MapObject } from '../data/maps.ts';
import { personOfOpponent, type LocalText, type Person } from '../data/people.ts';
import type { OpponentDefinition, TournamentDefinition } from '../data/tournaments.ts';
import type { CardDefinition } from '../game/cards/cardTypes.ts';
import { CONTENT_EN } from './contentEn.ts';
import { getLanguage } from './i18n.ts';

/**
 * data/ の固有名・説明を、いまの言語で返す。
 * 日本語は data/ の値、英語は contentEn.ts の「種類:ID:項目」。英語がなければ日本語に戻す。
 * カードの ID・数値・勝敗のデータとは切り離して、表示するときにだけ使う。
 */
const missing = new Set<string>();

export function contentText(domain: string, id: string, field: string, ja: string): string {
  if (getLanguage() !== 'en') return ja;
  const en = CONTENT_EN[`${domain}:${id}:${field}`];
  if (en !== undefined) return en;
  missing.add(`${domain}:${id}:${field}`);
  return ja;
}

/** 英語表示で見つからず日本語に戻したもの（QA 用） */
export function contentMissing(): readonly string[] {
  return [...missing];
}

export function cardName(card: CardDefinition | string): string {
  const c = typeof card === 'string' ? cardCatalog.get(card) : card;
  if (!c) return typeof card === 'string' ? card : '';
  return contentText('card', c.id, 'name', c.name);
}

/** モンスターの説明（仮モンスターは共通の説明） */
export function cardDescription(card: CardDefinition): string {
  if (card.kind !== 'monster') return '';
  const key = `card:${card.id}:description` in CONTENT_EN ? card.id : 'monster';
  return contentText('card', key, 'description', card.description);
}

export const packName = (p: PackDefinition): string => contentText('pack', p.id, 'name', p.name);
export const packDescription = (p: PackDefinition): string => contentText('pack', p.id, 'description', p.description);
export const packUnlockHint = (p: PackDefinition): string => contentText('pack', p.id, 'unlockHint', p.unlockHint);
export const tournamentName = (t: TournamentDefinition): string => contentText('tournament', t.id, 'name', t.name);
export const tournamentDescription = (t: TournamentDefinition): string =>
  contentText('tournament', t.id, 'description', t.description);
/** 相手の名前。人物（src/data/people.ts）なら人物の名前（見えない番人は「？？？」） */
export function opponentName(o: OpponentDefinition): string {
  const person = personOfOpponent(o);
  return person ? personName(person) : contentText('opponent', o.id, 'name', o.name);
}

/** 人物の文（日本語・英語は people.ts にまとめて書いてある） */
export const localText = (text: LocalText): string => (getLanguage() === 'en' ? text.en : text.ja);
export const personName = (person: Person): string => localText(person.name);
export const personTitle = (person: Person): string => localText(person.title);
export const personLine = (person: Person): string => localText(person.line);
export const personEpithet = (person: Person): string | null => (person.epithet ? localText(person.epithet) : null);
export const dungeonName = (d: DungeonDefinition): string => contentText('dungeon', d.id, 'name', d.name);
export const dungeonDescription = (d: DungeonDefinition): string => contentText('dungeon', d.id, 'description', d.description);
export const mapName = (m: MapDefinition): string => contentText('map', m.id, 'name', m.name);

/** マップ上の物の名前（扉・家具など） */
export function objectLabel(o: MapObject): string {
  return o.type === 'interact' || o.type === 'warp' ? contentText('object', o.id, 'label', o.label) : '';
}

/** マップ上の物を調べたときの文 */
export function objectMessage(o: MapObject): string | undefined {
  return o.type === 'interact' && o.message !== undefined ? contentText('object', o.id, 'message', o.message) : undefined;
}
