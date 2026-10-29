import { HIDDEN_MONSTER_ID, MONSTERS, SKILLS, SUPPORTS, skillsOf } from './cards.ts';
import { GAUUL_MONSTER_ID } from './gauul.ts';
import { GEOL_MONSTER_ID } from './geol.ts';
import { FLUNE_MONSTER_ID } from './flune.ts';
import { SEREPHINE_MONSTER_ID } from './serephine.ts';
import { KALSHELL_MONSTER_ID } from './kalshell.ts';
import { LAZUCK_MONSTER_ID } from './lazuck.ts';
import { MYUROL_MONSTER_ID } from './myurol.ts';
import { NOBITON_MONSTER_ID } from './nobiton.ts';
import { PUKARIM_MONSTER_ID } from './pukarim.ts';
import { SORAMO_MONSTER_ID } from './soramo.ts';
import type { CardDefinition, SkillCard } from '../game/cards/cardTypes.ts';

/**
 * カード図鑑の番号（No.001〜）の表（2026-10-27 指示書「人物の名前・名刺図鑑・カード図鑑」）。番号はここ1か所で決める。
 * 並び：モンスターごとに「本体 → そのモンスターの技」→ サポートカード → 最後に隠しモンスター（本体 → 技）。
 * モンスターの並びは、それまで図鑑に出ていた順。正式カードが増えたら下の表に足す（足した所より後ろの番号はずれる）。
 * 仮のカード（「仮」の名前のもの）は番号に入れず、一覧のいちばん最後に「仮」の区切りでまとめる
 */
export const NUMBERED_MONSTERS: readonly string[] = [
  SORAMO_MONSTER_ID,
  LAZUCK_MONSTER_ID,
  GAUUL_MONSTER_ID,
  NOBITON_MONSTER_ID,
  MYUROL_MONSTER_ID,
  KALSHELL_MONSTER_ID,
  PUKARIM_MONSTER_ID,
  // 2026-10-29 ジオルの最終：プカリムのあと（No.106〜120）
  GEOL_MONSTER_ID,
  // 2026-10-29 フルーネの最終：ジオルのあと（No.121〜135）
  FLUNE_MONSTER_ID,
  // 2026-10-29 セレフィーンの最終：フルーネのあと（No.136〜150）
  SEREPHINE_MONSTER_ID,
];

/** 番号を付けるサポートカード（いまは正式なサポートカードが無い。仮サポートは「仮」の区切りへ） */
export const NUMBERED_SUPPORTS: readonly string[] = [];

/** 区切り：モンスターの ID・サポート・隠しモンスター・仮 */
export type BookSection = { readonly kind: 'monster'; readonly monsterId: string } | { readonly kind: 'support' } | { readonly kind: 'hidden' } | { readonly kind: 'temp' };

export interface BookEntry {
  readonly card: CardDefinition;
  /** 番号（仮のカードは null） */
  readonly no: number | null;
  readonly section: BookSection;
}

/** 技の並び（正式の番号があればその順） */
function orderedSkills(monsterId: string): SkillCard[] {
  return [...skillsOf(monsterId)].sort((a, b) => (a.displayNo ?? 0) - (b.displayNo ?? 0));
}

const byId = new Map<string, CardDefinition>([...MONSTERS, ...SKILLS, ...SUPPORTS].map((c) => [c.id, c]));

/** 図鑑の並び（番号つき → 仮） */
export function cardBookEntries(): BookEntry[] {
  const out: BookEntry[] = [];
  let no = 0;
  const push = (card: CardDefinition | undefined, section: BookSection): void => {
    if (card) out.push({ card, no: ++no, section });
  };
  for (const id of NUMBERED_MONSTERS) {
    const section: BookSection = { kind: 'monster', monsterId: id };
    push(byId.get(id), section);
    for (const s of orderedSkills(id)) push(s, section);
  }
  for (const id of NUMBERED_SUPPORTS) push(byId.get(id), { kind: 'support' });
  push(byId.get(HIDDEN_MONSTER_ID), { kind: 'hidden' });
  for (const s of orderedSkills(HIDDEN_MONSTER_ID)) push(s, { kind: 'hidden' });
  // 仮のカード：モンスター（本体 → 技）→ サポートの順
  const numbered = new Set(out.map((e) => e.card.id));
  const temp: CardDefinition[] = [];
  for (const m of MONSTERS) {
    if (numbered.has(m.id)) continue;
    temp.push(m, ...orderedSkills(m.id));
  }
  temp.push(...SUPPORTS.filter((c) => !numbered.has(c.id)));
  for (const card of temp) if (!numbered.has(card.id)) out.push({ card, no: null, section: { kind: 'temp' } });
  return out;
}

/** 区切りの見出しを1つにまとめるためのキー */
export function sectionKey(section: BookSection): string {
  return section.kind === 'monster' ? `monster:${section.monsterId}` : section.kind;
}
