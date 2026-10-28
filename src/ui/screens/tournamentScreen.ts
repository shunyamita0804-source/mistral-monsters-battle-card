import { getMonster } from '../../data/cards.ts';
import { getPack } from '../../data/economy.ts';
import { getTournament, TOURNAMENTS, type TournamentDefinition } from '../../data/tournaments.ts';
import {
  claimTournamentRewards,
  enterTournament,
  entryCheck,
  nextOpponent,
  recordMatch,
  tournamentRecord,
  withdraw,
} from '../../game/progress/tournament.ts';
import { TOURNAMENT_ROUNDS } from '../../game/progress/tournamentDraw.ts';
import { randomSeed } from '../../game/rng.ts';
import { cardName, dungeonName, opponentName, packName, tournamentDescription, tournamentName } from '../../i18n/content.ts';
import { getDungeon } from '../../data/dungeons.ts';
import { t as tr } from '../../i18n/i18n.ts';
import { confirmModal, openModal } from '../components/modal.ts';
import coinIcon from '@assets/images/icons/coin.png';
import medalIcon from '@assets/images/icons/prize_medal.webp';
import pouchIcon from '@assets/images/icons/prize_pouch.webp';
import { bgm } from '../bgm.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { newId, once } from '../gameStore.ts';
import type { ScreenDefinition } from './types.ts';
import { bracketView, leagueTable, openEntrant, playerPlace, standingsTable } from '../components/tournamentBoards.ts';
import { rewardGlow } from '../components/rewardGlow.ts';
import { celebrationBanner, dungeonFoundBanner } from '../components/celebrationBanner.ts';
import type { RankId } from '../../data/economy.ts';
import { sound } from '../sound.ts';
import faceReceptionist from '@assets/images/characters/face_receptionist.webp';
import arenaBg from '@assets/images/backgrounds/battle_arena.webp';
import arenaDBg from '@assets/images/backgrounds/battle_arena_d.webp';
import trophyArt from '@assets/images/ui/tournament/trophy.webp';
import medalLoseArt from '@assets/images/ui/tournament/medal_lose.webp';

/** 大会の対戦の背景（2026-10-23 納品「UI画像10種」の対戦背景：中央が空の紺のテーブル） */
export const TOURNAMENT_BATTLE_BG = arenaBg;

/**
 * 大会ごとの対戦の背景（2026-10-27 デザイン第13弾：D ランクは大理石の縁の一段格の高い台）。無い大会は TOURNAMENT_BATTLE_BG。
 * C〜S は当面 D と同じ（2026-10-27 指示書「大会の新しい形」）
 */
const TOURNAMENT_BG: Readonly<Record<string, string>> = {
  'tournament-d': arenaDBg,
  'tournament-c': arenaDBg,
  'tournament-b': arenaDBg,
  'tournament-a': arenaDBg,
  'tournament-s': arenaDBg,
};

/** 何試合目か（総当たりは「第n試合」、トーナメントは「1回戦・準決勝・決勝」） */
function roundLabel(t: TournamentDefinition, i: number): string {
  if (t.format === 'league') return tr('tournament.matchN', { n: i + 1 });
  const left = TOURNAMENT_ROUNDS - i;
  if (left === 1) return tr('tournament.roundFinal');
  if (left === 2) return tr('tournament.roundSemi');
  return tr('tournament.roundN', { n: i + 1 });
}

/** 参加のきまり（総当たり・トーナメント） */
const ruleText = (t: TournamentDefinition): string =>
  tr(t.format === 'league' ? 'tournament.enterRuleLeague' : 'tournament.enterRuleBracket', { n: TOURNAMENT_ROUNDS, players: t.participants });

const packLabel = (id: string): string => {
  const pack = getPack(id);
  return pack ? packName(pack) : id;
};

interface PrizeLine {
  /** 景品のアイコン（ミスモンのアイテムの絵：参加報酬＝金貨、初回優勝＝勲章、再優勝＝小袋） */
  readonly icon: string;
  readonly text: string;
}

function prizeLines(t: TournamentDefinition): PrizeLine[] {
  const fw = t.rewards.firstWin;
  const first = [
    tr('common.coins', { n: fw.coins }),
    ...fw.unlockPacks.map((p) => tr('tournament.prizePack', { pack: packLabel(p) })),
    ...(fw.rankUp ? [tr('tournament.prizeRank', { rank: fw.rankUp })] : []),
    ...fw.cards.map((c) => tr('tournament.prizeCard', { name: cardName(c.cardId), n: c.count })),
  ];
  return [
    { icon: coinIcon, text: tr('tournament.participation', { n: t.rewards.participationCoins }) },
    { icon: medalIcon, text: tr('tournament.firstWin', { rewards: first.join(tr('tournament.prizeSeparator')) }) },
    { icon: pouchIcon, text: tr('tournament.repeatWin', { n: t.rewards.repeatWin.coins }) },
  ];
}

/**
 * 大会会場の受付：受付 → 参加条件・景品 → 対戦 → 結果 → 次戦 → 優勝 → 景品。
 * 進行状況はセーブに保存されるので、途中でやめても次回ここから再開できる。
 */
export const tournamentScreen: ScreenDefinition = {
  id: 'tournament',
  titleKey: 'tournament.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen tournament' });
    bgm.play('tournament');

    const startMatch = once((t: TournamentDefinition, round: number) => {
      const active = store.save.activeTournament;
      const opponent = active ? nextOpponent(t, active) : undefined;
      if (!opponent) return;
      store.pendingBattle = {
        title: tr('tournament.battleTitle', { name: tournamentName(t), round: roundLabel(t, round) }),
        opponent,
        allowSurrender: true,
        bgm: 'tournamentBattle',
        background: TOURNAMENT_BG[t.id] ?? TOURNAMENT_BATTLE_BG,
        onFinish: (winner, summary) => {
          const won = winner === 'player';
          // 残ったモンスター・与えたダメージは総当たりの順位に使う。同じ回のほかの人の試合はここで自動で決まる
          store.update((s) => ({
            ...recordMatch(s, round, { won, ...summary }),
            stats: { ...s.stats, battlesWon: s.stats.battlesWon + (won ? 1 : 0), battlesLost: s.stats.battlesLost + (won ? 0 : 1) },
          }));
          ctx.back('tournament');
        },
      };
      ctx.navigate('battle');
    });

    const claim = once(() => {
      const r = claimTournamentRewards(store.save);
      if (r.status !== 'ok') {
        render();
        return;
      }
      store.update(() => r.save);
      sound.play('reward');
      if (r.summary.coins > 0) sound.play('coins', 250);
      const s = r.summary;
      const lines = [
        tr('tournament.received', { n: s.coins }),
        ...s.unlockedPacks.map((p) => tr('tournament.packUnlocked', { pack: packLabel(p) })),
        ...(s.rankUp ? [tr('tournament.rankUp', { rank: s.rankUp })] : []),
        ...s.cards.map((c) => tr('tournament.cardGot', { name: cardName(c.cardId), n: c.count })),
      ];
      // ランクが上がって開放したダンジョン（2026-10-27 指示書「ダンジョン7つ」）：2026-10-28 から「新しいダンジョン発見」の帯の上に出す
      const found = s.unlockedDungeons.map((id) => {
        const d = getDungeon(id);
        const name = d ? dungeonName(d) : id;
        return dungeonFoundBanner(tr('tournament.dungeonFoundLead'), name, tr('tournament.dungeonFound', { name }));
      });
      const handle = openModal(element, {
        title: tr(s.won ? (s.firstWin ? 'tournament.rewardFirst' : 'tournament.rewardWin') : 'tournament.rewardEntry'),
        // 優勝・ランクアップは特別な帯（2026-10-26 デザイン第8弾）。参加報酬だけのときは今までどおり金貨の光
        body: [
          s.won ? celebrationBanner(tr(s.rankUp ? 'tournament.bannerRankUp' : 'tournament.bannerChampion'), (s.rankUp as RankId | null) ?? null) : rewardGlow(coinIcon),
          ...found,
          ...lines.map((t) => h('p', { class: 'modal__text', text: t })),
        ],
        actions: [{ label: tr('common.ok'), primary: true, onTap: () => handle.close() }],
        onClose: render,
      });
    });

    const tournamentCard = (t: TournamentDefinition): HTMLElement => {
      const check = entryCheck(store.save, t);
      const record = tournamentRecord(store.save, t.id);
      const join = button(tr('tournament.enter'), () => {
        confirmModal(
          element,
          tr('tournament.enterConfirm', { name: tournamentName(t) }),
          [
            h('p', { class: 'modal__text', text: ruleText(t) }),
            ...prizeLines(t).map((l) => h('p', { class: 'modal__text', text: l.text })),
            h('p', { class: 'modal__text modal__text--sub', text: tr('tournament.resumeNote') }),
          ],
          () => {
            store.update((s) => enterTournament(s, t.id, newId('entry'), randomSeed()));
            render();
          },
        );
      }, 'btn btn--primary');
      join.disabled = !check.ok;
      return h(
        'div',
        { class: `tournament__item${check.ok ? '' : ' is-locked'}`, dataset: { id: t.id } },
        h('h2', { class: 'tournament__name', text: tr('tournament.nameTemp', { name: tournamentName(t) }) }),
        h('p', { class: 'tournament__desc', text: tournamentDescription(t) }),
        h('p', { class: 'tournament__cond', text: tr('tournament.condition', { rank: t.requiredRank, n: TOURNAMENT_ROUNDS, players: t.participants }) }),
        h(
          'ul',
          { class: 'tournament__prizes' },
          ...prizeLines(t).map((l) =>
            h('li', {}, h('img', { class: 'tournament__prize-icon', attrs: { src: l.icon, alt: '', draggable: 'false' } }), h('span', { text: l.text })),
          ),
        ),
        h('p', {
          class: 'tournament__record',
          text: tr(record.firstWinClaimed ? 'tournament.recordClaimed' : 'tournament.record', { entries: record.entries, wins: record.wins }),
        }),
        check.ok ? null : h('p', { class: 'tournament__ng', text: check.reasons.join(tr('tournament.issueSeparator')) }),
        join,
      );
    };

    const board = (t: TournamentDefinition, active: NonNullable<typeof store.save.activeTournament>): HTMLElement => {
      const gender = store.save.player.gender;
      return h(
        'div',
        { class: 'tournament__board' },
        t.format === 'league' ? leagueTable(t, active, gender) : bracketView(t, active, gender, (id) => openEntrant(element, t, id, gender)),
        t.format === 'bracket' ? h('p', { class: 'tournament__hint', text: tr('tournament.cardHint') }) : null,
      );
    };

    const render = (): void => {
      const save = store.save;
      const active = save.activeTournament;
      const t = active ? getTournament(active.tournamentId) : undefined;
      const body: (HTMLElement | null)[] = [];
      if (!active || !t) {
        body.push(
          h('div', { class: 'tournament__desk' }, h('img', { class: 'tournament__clerk shop-menu__face', attrs: { src: faceReceptionist, alt: tr('tournament.clerk'), draggable: 'false' } }), h('p', { class: 'shop-menu__bubble', text: tr('tournament.welcome', { rank: save.rank }) })),
          ...TOURNAMENTS.map(tournamentCard),
        );
      } else if (active.status === 'inProgress') {
        // 対戦表（総当たり）・トーナメント表（2026-10-27 指示書「大会の新しい形」）。札を押すと出場者をくわしく
        const opponent = nextOpponent(t, active);
        body.push(
          h('h2', { class: 'tournament__name', text: tr('tournament.inProgress', { name: tournamentName(t) }) }),
          board(t, active),
          opponent
            ? h('p', { class: 'tournament__next', text: tr('tournament.nextVs', { round: roundLabel(t, active.round), name: opponentName(opponent) }) })
            : null,
          opponent
            ? h('p', { class: 'tournament__opponent', text: tr('tournament.opponents', { names: opponent.monsters.map((m) => cardName(getMonster(m))).join(tr('common.listSeparator')) }) })
            : null,
          button(tr('tournament.fightNow'), () => startMatch(t, active.round), 'btn btn--primary btn--large'),
          h('p', { class: 'notice', text: tr('tournament.leaveNote') }),
          button(tr('tournament.withdraw'), () => {
            confirmModal(element, tr('tournament.withdrawConfirm'), [h('p', { class: 'modal__text', text: tr('tournament.withdrawText') })], () => {
              store.update(withdraw);
              render();
            }, undefined, 'warn');
          }, 'btn btn--ghost'),
        );
      } else {
        const won = active.status === 'won';
        // 負けたとき：総当たりは順位、トーナメントは負けた回戦
        const lostRound = active.matches.find((m) => (m.a === 'player' || m.b === 'player') && m.winner !== 'player')?.round ?? active.round;
        const lostSub = t.format === 'league' ? tr('tournament.lostLeague', { n: playerPlace(active) }) : tr('tournament.lostSub', { round: roundLabel(t, lostRound) });
        body.push(
          h('div', { class: `tournament__result${won ? ' is-won' : ''}` },
            // 優勝＝優勝杯、負け＝ひびの入った盾のメダル（2026-10-26 デザイン第8弾）。
            // 優勝のときは後ろに優勝の場面の絵（2026-10-27 デザイン第13弾。絵の中に優勝杯があるので小さな優勝杯は uiParts12.css で隠す）
            h('img', { class: `tournament__result-art${won ? ' is-trophy' : ''}`, attrs: { src: won ? trophyArt : medalLoseArt, alt: '', draggable: 'false' } }),
            h('p', { class: 'tournament__result-title', text: tr(won ? 'tournament.won' : 'tournament.lost', { name: tournamentName(t) }) }),
            h('p', { class: 'tournament__result-sub', text: won ? tr('tournament.wonSub') : lostSub }),
          ),
          // 3試合が終わったら順位表（総当たり）・埋まったトーナメント表
          t.format === 'league' ? standingsTable(t, active, save.player.gender) : board(t, active),
          button(tr('tournament.claim'), claim, 'btn btn--primary btn--large'),
        );
      }
      element.replaceChildren(
        createScreenHeader({ title: tr('tournament.title'), back: { label: tr('common.back'), onTap: () => ctx.back('world') } }),
        h('div', { class: 'tournament__body' }, ...body),
      );
    };

    render();
    return { element };
  },
};
