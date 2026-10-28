import { getMonster } from '../../data/cards.ts';
import { personOfOpponent } from '../../data/people.ts';
import type { TournamentDefinition } from '../../data/tournaments.ts';
import { entrantOpponent, leagueMatch, leagueStandings, nextOpponent, pairsOf } from '../../game/progress/tournament.ts';
import { PLAYER_ENTRANT } from '../../game/progress/tournamentDraw.ts';
import type { ActiveTournament, Gender, TournamentMatch } from '../../game/save/saveData.ts';
import { cardName, opponentName, personEpithet } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';
import { openModal } from './modal.ts';
import { faceKeyOf, opponentFaceUrl } from './opponentFace.ts';
import { personFace } from './personFace.ts';
import heroMale from '@assets/images/characters/face_hero_male.webp';
import heroFemale from '@assets/images/characters/face_hero_female.webp';
import leagueGrid from '@assets/images/ui/tournament/league_grid.webp';
import leagueFaceFrame from '@assets/images/ui/tournament/league_face_frame.webp';
import leagueNext from '@assets/images/ui/tournament/league_next.webp';
import leagueRow from '@assets/images/ui/tournament/league_row.webp';
import cardNormal from '@assets/images/ui/tournament/bracket_card.webp';
import cardWin from '@assets/images/ui/tournament/bracket_card_win.webp';
import cardOut from '@assets/images/ui/tournament/bracket_card_out.webp';
import finalLine from '@assets/images/ui/tournament/bracket_final.webp';
import finalGlow from '@assets/images/ui/tournament/bracket_final_glow.webp';
import pedestalArt from '@assets/images/ui/tournament/bracket_pedestal.webp';
import swordsArt from '@assets/images/ui/tournament/bracket_swords.webp';
import trophyArt from '@assets/images/ui/tournament/trophy.webp';
import joinA from '@assets/images/ui/tournament/bracket_join_a.webp';
import joinBar1 from '@assets/images/ui/tournament/bracket_join_bar1.webp';
import joinMid from '@assets/images/ui/tournament/bracket_join_mid.webp';
import joinBar2 from '@assets/images/ui/tournament/bracket_join_bar2.webp';
import joinB from '@assets/images/ui/tournament/bracket_join_b.webp';
import joinTopA from '@assets/images/ui/tournament/bracket_join_top_a.webp';
import joinTopBar1 from '@assets/images/ui/tournament/bracket_join_top_bar1.webp';
import joinTopMid from '@assets/images/ui/tournament/bracket_join_top_mid.webp';
import joinTopBar2 from '@assets/images/ui/tournament/bracket_join_top_bar2.webp';
import joinTopB from '@assets/images/ui/tournament/bracket_join_top_b.webp';
import joinBottomA from '@assets/images/ui/tournament/bracket_join_bottom_a.webp';
import joinBottomBar1 from '@assets/images/ui/tournament/bracket_join_bottom_bar1.webp';
import joinBottomMid from '@assets/images/ui/tournament/bracket_join_bottom_mid.webp';
import joinBottomBar2 from '@assets/images/ui/tournament/bracket_join_bottom_bar2.webp';
import joinBottomB from '@assets/images/ui/tournament/bracket_join_bottom_b.webp';

/**
 * 大会の対戦表（E・D の総当たり）とトーナメント表（C〜S）（2026-10-27 指示書「大会の新しい形」。
 * 絵は届いた部品（tools/design/tournament_parts.py で切り出し）。名前・印はゲームが重ねる）
 */

/** 縦の棒（伸ばす所）：絵を背景にして、箱いっぱいに伸ばす */
function barView(src: string): HTMLElement {
  const el = h('span', { class: 'bracket__join-bar' });
  el.style.backgroundImage = `url("${src}")`;
  return el;
}

const img = (src: string, cls: string): HTMLElement => h('img', { class: cls, attrs: { src, alt: '', draggable: 'false', decoding: 'async' } });

/** 出場者の名前（主人公は「あなた」） */
export function entrantName(tour: TournamentDefinition, id: string): string {
  if (id === PLAYER_ENTRANT) return t('battle.side.player');
  const o = entrantOpponent(tour, id);
  return o ? opponentName(o) : id;
}

/** 出場者の顔（主人公は男女の顔。顔の絵が無い常連は人影） */
export function entrantFace(tour: TournamentDefinition, id: string, gender: Gender | null): HTMLElement {
  if (id === PLAYER_ENTRANT) return h('span', { class: 'person-face' }, img(gender === 'female' ? heroFemale : heroMale, 'person-face__img'));
  const o = entrantOpponent(tour, id);
  const url = o ? opponentFaceUrl(faceKeyOf(o)) : undefined;
  if (url) return h('span', { class: 'person-face' }, img(url, 'person-face__img'));
  return personFace(null);
}

/** 常連の二つ名（無い人は null） */
function epithetOf(tour: TournamentDefinition, id: string): string | null {
  const o = entrantOpponent(tour, id);
  const person = o ? personOfOpponent(o) : undefined;
  return person && person.group === 'regular' ? personEpithet(person) : null;
}

/** 出場者の札を押したとき：顔・二つ名・名前・常連なら通算の勝率（仮の固定値）・モンスター */
export function openEntrant(parent: HTMLElement, tour: TournamentDefinition, id: string, gender: Gender | null): void {
  if (id === PLAYER_ENTRANT) return;
  const o = entrantOpponent(tour, id);
  if (!o) return;
  const epithet = epithetOf(tour, id);
  const handle = openModal(parent, {
    className: 'entrant-detail',
    body: [
      h('div', { class: 'entrant-detail__face' }, entrantFace(tour, id, gender)),
      epithet ? h('p', { class: 'entrant-detail__epithet', text: epithet }) : null,
      h('h2', { class: 'entrant-detail__name', text: entrantName(tour, id) }),
      h('p', { class: 'entrant-detail__kind', text: t(o.winRate !== undefined ? 'tournament.regular' : 'tournament.general') }),
      o.winRate !== undefined ? h('p', { class: 'entrant-detail__rate', text: t('tournament.winRate', { n: o.winRate }) }) : null,
      h('p', { class: 'entrant-detail__monsters', text: t('tournament.monsters', { names: o.monsters.map((m) => cardName(getMonster(m))).join(t('common.listSeparator')) }) }),
    ],
    actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
  });
}

/* ---------- 総当たりの対戦表（5×5マス） ---------- */

/** 表の絵（1032×939）のマスの線の位置（左上から。tools/design/tournament_parts.py の league_grid） */
const LEAGUE_SIZE = { w: 1032, h: 939 };
const LEAGUE_COLS = [31, 207, 397, 595, 794, 1002];
const LEAGUE_ROWS = [32, 182, 347, 514, 688, 906];

function place(el: HTMLElement, col: number, row: number, colSpan = 1): HTMLElement {
  const x1 = LEAGUE_COLS[col] as number;
  const x2 = LEAGUE_COLS[col + colSpan] as number;
  const y1 = LEAGUE_ROWS[row] as number;
  const y2 = LEAGUE_ROWS[row + 1] as number;
  el.style.left = `${(x1 / LEAGUE_SIZE.w) * 100}%`;
  el.style.top = `${(y1 / LEAGUE_SIZE.h) * 100}%`;
  el.style.width = `${((x2 - x1) / LEAGUE_SIZE.w) * 100}%`;
  el.style.height = `${((y2 - y1) / LEAGUE_SIZE.h) * 100}%`;
  return el;
}

/**
 * 勝ち・負け・自分どうしの印（2026-10-28 夜 ユーザー決定：コードで描く ○ と ×）：勝ち＝青い○、負け＝赤い×、自分どうし＝斜線1本
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
function leagueMark(kind: 'win' | 'lose' | 'self'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', `league__svg league__svg--${kind}`);
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag: string, attrs: Record<string, string>): void => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  };
  if (kind === 'win') add('circle', { cx: '50', cy: '50', r: '30', fill: 'none', stroke: '#2f7bff', 'stroke-width': '11' });
  else if (kind === 'lose') {
    add('line', { x1: '24', y1: '24', x2: '76', y2: '76', stroke: '#e0352b', 'stroke-width': '11', 'stroke-linecap': 'round' });
    add('line', { x1: '76', y1: '24', x2: '24', y2: '76', stroke: '#e0352b', 'stroke-width': '11', 'stroke-linecap': 'round' });
  } else add('line', { x1: '8', y1: '92', x2: '92', y2: '8', stroke: '#8a7a55', 'stroke-width': '4', 'stroke-linecap': 'round' });
  return svg;
}

/**
 * 本編の総当たり表の4人版：左の列と上の行に顔と名前、自分どうしは斜線1本、終わった試合は勝ち（青い○）・負け（赤い×）、
 * 次の相手のマスを光る枠で囲む。自分の行はうすい帯
 */
export function leagueTable(tour: TournamentDefinition, active: ActiveTournament, gender: Gender | null): HTMLElement {
  const e = active.entrants;
  const next = nextOpponent(tour, active)?.id;
  const cells: HTMLElement[] = [];
  const head = (id: string, col: number, row: number): HTMLElement =>
    place(
      h(
        'div',
        { class: `league__head${id === PLAYER_ENTRANT ? ' is-player' : ''}`, dataset: { entrant: id } },
        h('span', { class: 'league__face' }, entrantFace(tour, id, gender), img(leagueFaceFrame, 'league__frame')),
        h('span', { class: 'league__name', text: entrantName(tour, id) }),
      ),
      col,
      row,
    );
  // 自分の行の帯（表の絵の上・印の下）
  const playerRow = e.indexOf(PLAYER_ENTRANT) + 1;
  cells.push(place(h('div', { class: 'league__band' }, img(leagueRow, 'league__band-img')), 0, playerRow, 5));
  e.forEach((id, i) => {
    cells.push(head(id, i + 1, 0), head(id, 0, i + 1));
  });
  e.forEach((rowId, i) => {
    e.forEach((colId, j) => {
      const cell = place(h('div', { class: 'league__cell', dataset: { row: rowId, col: colId } }), j + 1, i + 1);
      if (i === j) cell.append(leagueMark('self'));
      else {
        const m = leagueMatch(active, rowId, colId);
        if (m) {
          const won = m.winner === rowId;
          cell.classList.add(won ? 'is-win' : 'is-lose');
          cell.append(leagueMark(won ? 'win' : 'lose'));
        } else if (next && ((rowId === PLAYER_ENTRANT && colId === next) || (colId === PLAYER_ENTRANT && rowId === next))) {
          cell.classList.add('is-next');
          cell.append(img(leagueNext, 'league__next'));
        }
      }
      cells.push(cell);
    });
  });
  return h('div', { class: 'league', attrs: { role: 'table', 'aria-label': t('tournament.leagueTitle') } }, img(leagueGrid, 'league__grid'), ...cells);
}

/** 総当たりの順位表（3試合が終わったら） */
export function standingsTable(tour: TournamentDefinition, active: ActiveTournament, gender: Gender | null): HTMLElement {
  const rows = leagueStandings(active);
  return h(
    'div',
    { class: 'standings' },
    h('p', { class: 'standings__title', text: t('tournament.standings') }),
    h(
      'table',
      { class: 'standings__table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { text: '' }),
          h('th', { text: '' }),
          ...(['colWins', 'colLosses', 'colLeft', 'colDamage'] as const).map((k) => h('th', { text: t(`tournament.${k}`) })),
        ),
      ),
      h(
        'tbody',
        {},
        ...rows.map((r, i) =>
          h(
            'tr',
            { class: `${r.id === PLAYER_ENTRANT ? 'is-player' : ''}${i === 0 ? ' is-first' : ''}`, dataset: { entrant: r.id } },
            h('td', { class: 'standings__rank', text: t('tournament.rankN', { n: i + 1 }) }),
            h('td', { class: 'standings__who' }, h('span', { class: 'standings__face' }, entrantFace(tour, r.id, gender)), h('span', { text: entrantName(tour, r.id) })),
            h('td', { text: String(r.wins) }),
            h('td', { text: String(r.losses) }),
            h('td', { text: String(r.left) }),
            h('td', { text: String(r.damage) }),
          ),
        ),
      ),
    ),
    h('p', { class: 'standings__note', text: t('tournament.standingsNote') }),
  );
}

/** 主人公の順位（1始まり） */
export function playerPlace(active: ActiveTournament): number {
  return leagueStandings(active).findIndex((r) => r.id === PLAYER_ENTRANT) + 1;
}

/* ---------- 8人のトーナメント表 ---------- */

/** 配置（論理 px。幅 370 の箱の中。左の山を計算し、右の山は左右反転） */
const BOX_W = 370;
const TREE_TOP = 112;
const CARD = { w: 108, h: 41 };
/** 1つの山の4枚の札の上の位置（2人ずつの組の間を少しあける） */
const CARD_TOPS = [0, 54, 124, 178];
/** 2人をまとめる線：1回戦（左の位置・幅）・準決勝 */
const JOIN_R1 = { left: 90, w: 60 };
const JOIN_SF = { left: 143, w: 38 };
/** 線の絵の、上の腕・下の腕の中心が絵の上端・下端からどれだけか（幅に対する割合）と、縦の棒の位置（幅に対する割合） */
const ARM_TOP = 0.062;
const ARM_BOTTOM = 0.054;
const BAR_X = 0.47;
const FINAL_W = 96;

const JOIN_ART = {
  normal: [joinA, joinBar1, joinMid, joinBar2, joinB],
  top: [joinTopA, joinTopBar1, joinTopMid, joinTopBar2, joinTopB],
  bottom: [joinBottomA, joinBottomBar1, joinBottomMid, joinBottomBar2, joinBottomB],
} as const;

const centerOf = (slot: number): number => TREE_TOP + (CARD_TOPS[slot] as number) + CARD.h / 2;

/** 2人をまとめる線（上の腕〜下の腕の間の長さに合わせて、縦の棒だけを伸ばす） */
function joinView(kind: keyof typeof JOIN_ART, left: number, width: number, yTop: number, yBottom: number, mirror: boolean): HTMLElement {
  const [a, bar1, mid, bar2, b] = JOIN_ART[kind];
  const el = h(
    'div',
    { class: `bracket__join is-${kind}${mirror ? ' is-mirror' : ''}` },
    img(a, 'bracket__join-fixed'),
    barView(bar1),
    img(mid, 'bracket__join-fixed'),
    barView(bar2),
    img(b, 'bracket__join-fixed'),
  );
  const top = yTop - ARM_TOP * width;
  el.style.left = `${mirror ? BOX_W - left - width : left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${width}px`;
  el.style.height = `${yBottom + ARM_BOTTOM * width - top}px`;
  return el;
}

/** 決まった試合の線：上の人が勝ち・下の人が勝ち・まだ */
const joinKind = (m: TournamentMatch | undefined): keyof typeof JOIN_ART => (!m ? 'normal' : m.winner === m.a ? 'top' : 'bottom');

/**
 * 縦長の画面に8人を左右4人ずつ。真ん中の上に優勝杯。出場者の札は勝ち残り・敗退で見た目を変え、勝ち上がった線が光る。いま戦う対戦に剣の印
 */
export function bracketView(tour: TournamentDefinition, active: ActiveTournament, gender: Gender | null, onCard: (id: string) => void): HTMLElement {
  const e = active.entrants;
  const byRound = (r: number): TournamentMatch[] => active.matches.filter((m) => m.round === r);
  const lost = new Set(active.matches.map((m) => (m.winner === m.a ? m.b : m.a)));
  const played = new Set(active.matches.flatMap((m) => [m.a, m.b]));
  const final = byRound(2)[0];
  const parts: HTMLElement[] = [];

  // 優勝杯と台座（決勝が終わったら優勝した人の名前）
  parts.push(
    h(
      'div',
      { class: 'bracket__trophy' },
      img(trophyArt, 'bracket__cup'),
      img(pedestalArt, 'bracket__pedestal'),
      final ? h('span', { class: 'bracket__champion', text: entrantName(tour, final.winner) }) : null,
    ),
  );

  // 線（札より下に描く）
  for (const side of [0, 1] as const) {
    const mirror = side === 1;
    const r1 = byRound(0);
    for (const pair of [0, 1] as const) {
      parts.push(joinView(joinKind(r1[side * 2 + pair]), JOIN_R1.left, JOIN_R1.w, centerOf(pair * 2), centerOf(pair * 2 + 1), mirror));
    }
    const sfTop = (centerOf(0) + centerOf(1)) / 2;
    const sfBottom = (centerOf(2) + centerOf(3)) / 2;
    parts.push(joinView(joinKind(byRound(1)[side]), JOIN_SF.left, JOIN_SF.w, sfTop, sfBottom, mirror));
  }
  const finalY = (centerOf(0) + centerOf(3)) / 2;
  const finalEl = img(final ? finalGlow : finalLine, 'bracket__final');
  finalEl.style.left = `${(BOX_W - FINAL_W) / 2}px`;
  finalEl.style.top = `${finalY}px`;
  finalEl.style.width = `${FINAL_W}px`;
  parts.push(finalEl);

  // 札
  e.forEach((id, i) => {
    const side = i < 4 ? 0 : 1;
    const slot = i % 4;
    const state = lost.has(id) ? 'out' : played.has(id) ? 'win' : 'normal';
    const epithet = epithetOf(tour, id);
    const card = h(
      'button',
      {
        class: `bracket__card is-${state}${id === PLAYER_ENTRANT ? ' is-player' : ''}${side ? ' is-right' : ''}`,
        attrs: { type: 'button', 'aria-label': entrantName(tour, id) },
        dataset: { entrant: id },
        on: { click: () => onCard(id) },
      },
      img(state === 'out' ? cardOut : state === 'win' ? cardWin : cardNormal, 'bracket__card-art'),
      h('span', { class: 'bracket__card-face' }, entrantFace(tour, id, gender)),
      h('span', { class: 'bracket__card-name', text: entrantName(tour, id) }),
      epithet ? h('span', { class: 'bracket__epithet', text: epithet }) : null,
    );
    card.style.left = `${side ? BOX_W - CARD.w : 0}px`;
    card.style.top = `${TREE_TOP + (CARD_TOPS[slot] as number)}px`;
    parts.push(card);
  });

  // いま戦う対戦に剣の印
  if (active.status === 'inProgress') {
    const pairs = pairsOf(tour, active, active.round);
    const index = pairs.findIndex((p) => p.includes(PLAYER_ENTRANT));
    let x = 0;
    let y = 0;
    if (active.round === 0) {
      const pair = index % 2;
      const side = index < 2 ? 0 : 1;
      x = JOIN_R1.left + JOIN_R1.w * BAR_X;
      y = (centerOf(pair * 2) + centerOf(pair * 2 + 1)) / 2;
      if (side) x = BOX_W - x;
    } else if (active.round === 1) {
      x = JOIN_SF.left + JOIN_SF.w * BAR_X;
      y = finalY;
    } else {
      x = BOX_W / 2;
      y = finalY;
    }
    const swords = img(swordsArt, 'bracket__swords');
    swords.style.left = `${x}px`;
    swords.style.top = `${y}px`;
    parts.push(swords);
  }
  return h('div', { class: 'bracket', attrs: { 'aria-label': t('tournament.bracketTitle') } }, ...parts);
}
