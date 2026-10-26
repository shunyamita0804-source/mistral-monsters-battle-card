import worldMapArt from '@assets/images/ui/worldmap/world_map.webp';
import { DUNGEONS, type DungeonDefinition } from '../../data/dungeons.ts';
import { getMap } from '../../data/maps.ts';
import { DUNGEON_SPOTS, HOME_REGION, TOWN_SPOT, WORLD_MAP_REGIONS, type RegionId, type WorldMapSpot } from '../../data/worldMap.ts';
import { isDeckValid } from '../../game/deck/deck.ts';
import { dungeonRecord, startDungeon } from '../../game/progress/dungeon.ts';
import { messageModal } from '../components/modal.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { sound } from '../sound.ts';
import { t } from '../../i18n/i18n.ts';
import { dungeonDescription, dungeonName } from '../../i18n/content.ts';
import type { ScreenDefinition } from './types.ts';

const regionName = (id: RegionId): string => t(`world.region.${id}`);

/**
 * 世界地図（2026-10-23。それまでは行き先の一覧だけの「壁の地図」）。
 * 地図の上の丸い印（街・ダンジョン）を押すと、下の欄にその場所のことを出す。
 * - 街の南の出口から来たとき：ダンジョンを選んで出発できる
 * - 家の壁の地図から開いたとき：見るだけ（出発は街の南の出口から。2026-10-23 ユーザー案「家の中でも世界地図は見える」）
 */
export const dungeonSelectScreen: ScreenDefinition = {
  id: 'dungeonSelect',
  titleKey: 'world.dungeonSelect.title',
  create(ctx) {
    const store = ctx.store;
    const viewOnly = store.save.location.mapId !== 'town';
    const element = h('main', { class: 'screen dungeon-select' });
    const info = h('div', { class: 'dungeon-select__info' });
    const pins: HTMLElement[] = [];

    const select = (pin: HTMLElement, body: readonly (Node | null)[]): void => {
      for (const p of pins) p.classList.toggle('is-selected', p === pin);
      info.replaceChildren(h('div', { class: 'dungeon-select__item' }, ...body));
    };

    /** 印の絵（2026-10-23 デザイン第7弾）：here＝街（現在地の金の輪つき）、dungeon＝洞窟、cleared＝クリアしたダンジョン（星つき） */
    const pinAt = (spot: WorldMapSpot, label: string, kind: 'here' | 'dungeon' | 'cleared', onTap: (pin: HTMLElement) => void): HTMLElement => {
      const pin = h(
        'button',
        { class: `world-map__pin world-map__pin--${kind}`, attrs: { type: 'button', 'aria-label': label } },
        h('span', { class: 'world-map__dot' }),
        h('span', { class: 'world-map__label', text: label }),
      );
      pin.style.left = `${spot.x * 100}%`;
      pin.style.top = `${spot.y * 100}%`;
      pin.addEventListener('click', () => onTap(pin));
      pins.push(pin);
      return pin;
    };

    const showTown = (pin: HTMLElement): void =>
      select(pin, [
        h('p', { class: 'dungeon-select__region', text: regionName(TOWN_SPOT.region) }),
        h('h2', { class: 'dungeon-select__name' }, t('world.dungeonSelect.town'), h('span', { class: 'dungeon-select__here', text: t('world.dungeonSelect.here') })),
        h('p', { class: 'dungeon-select__desc', text: t('world.dungeonSelect.townDesc') }),
      ]);

    const showDungeon = (pin: HTMLElement, d: DungeonDefinition, spot: WorldMapSpot): void => {
      const record = dungeonRecord(store.save, d.id);
      const chestTotal = d.floors.reduce((n, f) => n + (getMap(f)?.objects.filter((o) => o.type === 'chest').length ?? 0), 0);
      const depart = once(() => {
        // ダンジョンの門を開けて入る
        sound.play('gateOpen');
        store.update((s) => startDungeon(s, d.id));
        store.dungeonIntro = d.id;
        ctx.reset('world');
      });
      const go = (): void => {
        if (!isDeckValid(store.save.deck, store.save.collection)) {
          messageModal(element, t('world.dungeonSelect.deckInvalid'));
          return;
        }
        depart();
      };
      select(pin, [
        h('p', { class: 'dungeon-select__region', text: regionName(spot.region) }),
        h('h2', { class: 'dungeon-select__name', text: dungeonName(d) }),
        h('p', { class: 'dungeon-select__desc', text: dungeonDescription(d) }),
        h('p', {
          class: 'dungeon-select__progress',
          text: t(record.bossDefeated ? 'world.dungeonSelect.progressBoss' : 'world.dungeonSelect.progress', {
            clears: record.clears,
            opened: record.openedChests.length,
            total: chestTotal,
          }),
        }),
        viewOnly
          ? h('p', { class: 'dungeon-select__view-only', text: t('world.dungeonSelect.viewOnly') })
          : button(t('world.dungeonSelect.depart'), go, 'btn btn--primary'),
      ]);
    };

    const map = h(
      'div',
      { class: 'world-map' },
      h('img', { class: 'world-map__art', attrs: { src: worldMapArt, alt: '', draggable: 'false' } }),
      ...WORLD_MAP_REGIONS.map((r) => {
        const el = h('span', { class: `world-map__region${r.id === HOME_REGION ? ' is-home' : ''}`, text: regionName(r.id) });
        el.style.left = `${r.x * 100}%`;
        el.style.top = `${r.y * 100}%`;
        return el;
      }),
    );
    const townPin = pinAt(TOWN_SPOT, t('world.dungeonSelect.town'), 'here', showTown);
    map.append(townPin);
    let first: (() => void) | null = null;
    for (const d of DUNGEONS) {
      const spot = DUNGEON_SPOTS[d.id];
      if (!spot) continue;
      const kind = dungeonRecord(store.save, d.id).clears > 0 ? 'cleared' : 'dungeon';
      const pin = pinAt(spot, dungeonName(d), kind, (p) => showDungeon(p, d, spot));
      map.append(pin);
      first ??= () => showDungeon(pin, d, spot);
    }

    element.append(
      createScreenHeader({ title: t('world.dungeonSelect.header'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
      map,
      h('p', { class: 'notice', text: t(viewOnly ? 'world.dungeonSelect.viewNotice' : 'world.dungeonSelect.notice') }),
      info,
    );
    if (first) first();
    else showTown(townPin);
    return { element };
  },
};
