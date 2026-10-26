import worldMapArt from '@assets/images/ui/worldmap/world_map.webp';
import { DUNGEONS } from '../../data/dungeons.ts';
import { isRunDungeon } from '../../data/dungeonRun.ts';
import { DUNGEON_SPOTS, TOWN_SPOT, type WorldMapSpot } from '../../data/worldMap.ts';
import { isDeckValid } from '../../game/deck/deck.ts';
import { startRun } from '../../game/dungeon/run.ts';
import { dungeonRecord, startDungeon } from '../../game/progress/dungeon.ts';
import { randomSeed } from '../../game/rng.ts';
import { messageModal } from '../components/modal.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { sound } from '../sound.ts';
import { t } from '../../i18n/i18n.ts';
import { dungeonName } from '../../i18n/content.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 世界地図（2026-10-23。それまでは行き先の一覧だけの「壁の地図」）。
 * 2026-10-26 ユーザー指示：地方の名前は出さない。ダンジョンの名前と印を大きくし、印を押すとそのままダンジョンへ。
 * 街の印を押すと街の入り口（南の出口の手前）に戻る。下の説明の欄はやめた
 * - 家の壁の地図から開いたとき：見るだけ（ダンジョンの印を押すと「街の南の出口から出発できます」。2026-10-23 ユーザー案）
 */
export const dungeonSelectScreen: ScreenDefinition = {
  id: 'dungeonSelect',
  titleKey: 'world.dungeonSelect.title',
  create(ctx) {
    const store = ctx.store;
    const viewOnly = store.save.location.mapId !== 'town';
    const element = h('main', { class: 'screen dungeon-select' });

    /** 印の絵（2026-10-23 デザイン第7弾）：here＝街（現在地の金の輪つき）、dungeon＝洞窟、cleared＝クリアしたダンジョン（星つき） */
    const pinAt = (spot: WorldMapSpot, label: string, kind: 'here' | 'dungeon' | 'cleared', onTap: () => void): HTMLElement => {
      const pin = h(
        'button',
        { class: `world-map__pin world-map__pin--${kind}`, attrs: { type: 'button', 'aria-label': label }, on: { click: onTap } },
        h('span', { class: 'world-map__dot' }),
        h('span', { class: 'world-map__label', text: label }),
      );
      pin.style.left = `${spot.x * 100}%`;
      pin.style.top = `${spot.y * 100}%`;
      return pin;
    };

    // 街の印：街の入り口に戻る（南の出口から来たときは、出口の1マス手前に立っている）
    const backToTown = once(() => ctx.back('world'));

    const depart = once((dungeonId: string) => {
      // ダンジョンの門を開けて入る
      sound.play('gateOpen');
      store.dungeonIntro = dungeonId;
      // ランダム生成のダンジョン（2026-10-26 試作。いまは太古の遺跡だけ）は、毎回ちがう形の階で挑戦を始める
      if (isRunDungeon(dungeonId)) {
        store.update((s) => startRun(s, dungeonId, randomSeed()));
        ctx.reset('dungeonRun');
        return;
      }
      store.update((s) => startDungeon(s, dungeonId));
      ctx.reset('world');
    });
    const go = (dungeonId: string): void => {
      if (viewOnly) {
        messageModal(element, t('world.dungeonSelect.viewOnly'));
        return;
      }
      if (!isDeckValid(store.save.deck, store.save.collection)) {
        messageModal(element, t('world.dungeonSelect.deckInvalid'));
        return;
      }
      depart(dungeonId);
    };

    const map = h(
      'div',
      { class: 'world-map' },
      h('img', { class: 'world-map__art', attrs: { src: worldMapArt, alt: '', draggable: 'false' } }),
      pinAt(TOWN_SPOT, t('world.dungeonSelect.town'), 'here', backToTown),
    );
    for (const d of DUNGEONS) {
      const spot = DUNGEON_SPOTS[d.id];
      if (!spot) continue;
      const kind = dungeonRecord(store.save, d.id).clears > 0 ? 'cleared' : 'dungeon';
      map.append(pinAt(spot, dungeonName(d), kind, () => go(d.id)));
    }

    element.append(
      createScreenHeader({ title: t('world.dungeonSelect.header'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
      map,
      h('p', { class: 'notice', text: t(viewOnly ? 'world.dungeonSelect.viewNotice' : 'world.dungeonSelect.notice') }),
    );
    return { element };
  },
};
