import { cardCatalog, getMonster, HIDDEN_MONSTER_ID } from '../../data/cards.ts';
import { PACKS, type PackDefinition } from '../../data/economy.ts';
import { FRAGMENT_TOTAL } from '../../data/fragments.ts';
import { kindLabel, rarityLabel } from '../../game/cards/cardTypes.ts';
import { packCardRates, purchasePack } from '../../game/economy/gacha.ts';
import { canRestoreHidden, fragmentCount, restoreHidden } from '../../game/progress/fragments.ts';
import { randomSeed } from '../../game/rng.ts';
import { cardName, packDescription, packName, packUnlockHint } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { openCardDetail } from '../components/cardDetail.ts';
import { createCardView } from '../components/cardView.ts';
import { confirmModal, messageModal, openModal } from '../components/modal.ts';
import { coinIcon } from '../components/coinIcon.ts';
import { rarityBadge } from '../components/rarityBadge.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { newId } from '../gameStore.ts';
import type { ScreenDefinition } from './types.ts';
import { sound } from '../sound.ts';
import faceClerk from '@assets/images/characters/face_clerk.webp';
import pack01Art from '@assets/images/ui/packs/pack_01.webp';
import packLockedArt from '@assets/images/ui/packs/pack_locked.webp';
import gachaMachineArt from '@assets/images/ui/gacha_machine.webp';
import pack02Art from '@assets/images/ui/packs/pack_02.webp';
import pack03Art from '@assets/images/ui/packs/pack_03.webp';

/**
 * パックの絵（2026-10-23 納品「UI画像10種」のカードパック3種：紺・緑・赤）。
 * パックの中身・価格・提供割合は仮のまま。絵の割り当て（第1弾＝紺・第2弾＝緑・第3弾＝赤）も仮
 */
const PACK_ART: Readonly<Record<string, string>> = { 'pack-01': pack01Art, 'pack-02': pack02Art, 'pack-03': pack03Art };

/** ショップの店員メニュー：カードを見る／売る（価格未確定のため無効）／ガチャ／特別復元（欠片を持っているときだけ） */
export const shopMenuScreen: ScreenDefinition = {
  id: 'shopMenu',
  titleKey: 'shop.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen shop-menu' });
    const render = (): void => {
      const save = store.save;
      const fragments = fragmentCount(save);
      const sell = button(t('shop.sell'), () => undefined, 'shop-menu__item');
      sell.disabled = true;
      element.replaceChildren(
        createScreenHeader({ title: t('shop.title'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
        h(
          'div',
          { class: 'shop-menu__clerk' },
          h('img', { class: 'shop-menu__clerk-figure shop-menu__face', attrs: { src: faceClerk, alt: t('shop.clerk'), draggable: 'false' } }),
          h('p', { class: 'shop-menu__bubble', text: t('shop.greeting') }),
        ),
        h('p', { class: 'shop-menu__coins' }, coinIcon(), t('shop.coins', { n: save.coins })),
        h(
          'nav',
          { class: 'shop-menu__items' },
          button(t('shop.viewCards'), () => ctx.navigate('cardList'), 'shop-menu__item'),
          h('div', { class: 'shop-menu__disabled' }, sell, h('span', { class: 'shop-menu__note', text: t('shop.sellNote') })),
          button(t('shop.gacha'), () => ctx.navigate('gacha'), 'shop-menu__item'),
          fragments > 0 || save.hiddenRestored ? button(t('shop.restore', { n: fragments, total: FRAGMENT_TOTAL }), () => openRestore(), 'shop-menu__item shop-menu__item--special') : null,
        ),
      );
    };

    const openRestore = (): void => {
      const save = store.save;
      if (save.hiddenRestored) {
        messageModal(element, t('shop.restoreDone'));
        return;
      }
      if (!canRestoreHidden(save)) {
        messageModal(element, t('shop.restoreNotReady', { n: fragmentCount(save), total: FRAGMENT_TOTAL }), undefined, t('shop.restoreTitle'));
        return;
      }
      const tx = newId('restore');
      confirmModal(element, t('shop.restoreTitle'), [h('p', { class: 'modal__text', text: t('shop.restoreConfirm') })], () => {
        const r = restoreHidden(store.save, tx);
        if (r.status !== 'ok') return;
        store.update(() => r.save);
        sound.play('reward');
        const monster = getMonster(HIDDEN_MONSTER_ID);
        const handle = openModal(element, {
          title: t('shop.restoreSuccess'),
          body: [
            h('div', { class: 'card-detail__card' }, createCardView(monster, 150, true)),
            h('p', { class: 'modal__text', text: t('shop.restoreGot', { name: cardName(monster) }) }),
            h('p', { class: 'modal__text modal__text--sub', text: t('shop.restoreNote') }),
          ],
          actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
          onClose: render,
        });
      });
    };

    render();
    return { element };
  },
};

/** カードガチャマシン（カプセルではなくカードパックが出る） */
export const gachaScreen: ScreenDefinition = {
  id: 'gacha',
  titleKey: 'shop.gacha',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen gacha' });

    const showRates = (pack: PackDefinition): void => {
      const rates = packCardRates(pack);
      const total = rates.reduce((s, r) => s + r.rate, 0);
      const handle = openModal(element, {
        title: t('gacha.ratesTitle', { pack: packName(pack) }),
        className: 'gacha-rates',
        body: [
          h('p', { class: 'modal__text modal__text--warn', text: t('gacha.ratesWarn') }),
          h('p', { class: 'modal__text', text: t('gacha.ratesPerCard', { n: pack.cardsPerPack }) }),
          h('p', { class: 'modal__text', text: t('gacha.ratesByRarity', { rates: (['C', 'U', 'R'] as const).map((r) => `${rarityLabel(r)} ${pack.rarityRates[r]}%`).join(' / ') }) }),
          h(
            'table',
            { class: 'gacha-rates__table' },
            h('thead', {}, h('tr', {}, h('th', { text: t('gacha.colCard') }), h('th', { text: t('gacha.colKind') }), h('th', { text: t('gacha.colRarity') }), h('th', { text: t('gacha.colRate') }))),
            h(
              'tbody',
              {},
              ...rates.map((r) => {
                const card = cardCatalog.get(r.cardId);
                return h(
                  'tr',
                  {},
                  h('td', { text: card ? cardName(card) : r.cardId }),
                  h('td', { text: card ? kindLabel(card.kind) : '' }),
                  h('td', { text: r.rarity }),
                  h('td', { text: `${r.rate.toFixed(3)}%` }),
                );
              }),
            ),
            h('tfoot', {}, h('tr', {}, h('td', { text: t('gacha.total'), attrs: { colspan: '3' } }), h('td', { text: `${total.toFixed(3)}%` }))),
          ),
        ],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    const buy = (pack: PackDefinition): void => {
      const save = store.save;
      if (save.coins < pack.price) {
        messageModal(element, t('gacha.notEnough', { price: pack.price }));
        return;
      }
      // 購入確認を開いた時点で購入IDを1つ作る。同じIDの購入は1回しか処理されない（二重決済防止）
      const tx = newId('purchase');
      confirmModal(
        element,
        t('gacha.confirmTitle'),
        [
          h('p', { class: 'modal__text', text: t('gacha.confirmText', { pack: packName(pack), price: pack.price }) }),
          h('p', { class: 'modal__text', text: t('gacha.confirmCoins', { before: save.coins, after: save.coins - pack.price }) }),
          h('p', { class: 'modal__text modal__text--sub', text: t('gacha.confirmNote') }),
        ],
        () => {
          const before = store.save.collection;
          const r = purchasePack(store.save, pack.id, tx, randomSeed());
          // 先に画面を描き直してから演出を重ねる（描き直しで演出が消えないように）
          render();
          if (r.status === 'ok') {
            // お金を払う（レジ）→ パックを開ける
            sound.play('register');
            store.update(() => r.save);
            render();
            openPack(pack, r.cards, before);
          } else if (r.status === 'error') {
            messageModal(element, r.message);
          }
        },
      );
    };

    /** パック開封の演出：パックが震えて開き、カードを1枚ずつめくる */
    const openPack = (pack: PackDefinition, cards: readonly string[], before: Readonly<Record<string, number>>): void => {
      const seen = new Set<string>();
      // 詳細は演出の上に重ねる（演出の下に隠れて閉じられなくならないように）
      const overlay = h('div', { class: 'pack-open' });
      const slots = cards.map((id) => {
        const card = cardCatalog.get(id);
        const isNew = (before[id] ?? 0) === 0 && !seen.has(id);
        seen.add(id);
        const face = card ? createCardView(card, 92, false) : h('div');
        return h(
          'button',
          { class: 'pack-open__card', attrs: { type: 'button' }, on: { click: () => card && openCardDetail(overlay, card, { owned: store.save.collection[id] ?? 0 }) } },
          h('div', { class: 'pack-open__back' }),
          h('div', { class: 'pack-open__face' }, face),
          h('span', { class: 'pack-open__name', text: card ? cardName(card) : id }),
          card ? rarityBadge(card.rarity, 22) : null,
          isNew ? h('span', { class: 'pack-open__new', text: t('gacha.new') }) : null,
        );
      });
      const packEl = h('div', { class: `pack-open__pack${PACK_ART[pack.id] ? ' has-art' : ''}`, text: packName(pack) });
      if (PACK_ART[pack.id]) packEl.style.setProperty('--pack-art', `url("${PACK_ART[pack.id]}")`);
      const cardsEl = h('div', { class: 'pack-open__cards' }, ...slots);
      const done = button(t('common.close'), () => overlay.remove(), 'btn btn--primary');
      done.disabled = true;
      overlay.append(packEl, cardsEl, h('p', { class: 'pack-open__hint', text: t('gacha.openHint') }), done);
      element.append(overlay);
      setTimeout(() => packEl.classList.add('is-opening'), 50);
      sound.play('packOpen', 450);
      setTimeout(() => {
        packEl.classList.add('is-open');
        slots.forEach((s, i) => setTimeout(() => s.classList.add('is-revealed'), 250 * i));
        setTimeout(() => {
          done.disabled = false;
        }, 250 * slots.length);
      }, 800);
    };

    const render = (): void => {
      const save = store.save;
      const packs = PACKS.map((pack) => {
        const unlocked = save.unlockedPacks.includes(pack.id);
        const buyBtn = button(t('gacha.buyPrice', { price: pack.price }), () => buy(pack), 'btn btn--primary btn--small');
        buyBtn.disabled = !unlocked;
        return h(
          'div',
          { class: `gacha__pack${unlocked ? '' : ' is-locked'}`, dataset: { id: pack.id } },
          !unlocked
            ? // まだ買えないパック：鎖と鍵の絵（2026-10-26 デザイン第8弾）
              h('div', { class: 'gacha__pack-art has-art' }, h('img', { attrs: { src: packLockedArt, alt: t('gacha.lockedState'), draggable: 'false' } }))
            : PACK_ART[pack.id]
              ? h('div', { class: 'gacha__pack-art has-art' }, h('img', { attrs: { src: PACK_ART[pack.id] ?? '', alt: packName(pack), draggable: 'false' } }))
              : h('div', { class: 'gacha__pack-art', text: packName(pack).replace(/（仮）| \(Temp\)/, '') }),
          h(
            'div',
            { class: 'gacha__pack-info' },
            h('p', { class: 'gacha__pack-name', text: packName(pack) }),
            h('p', { class: 'gacha__pack-desc', text: unlocked ? packDescription(pack) : t('gacha.locked', { hint: packUnlockHint(pack) }) }),
            h('p', { class: 'gacha__pack-meta', text: t('gacha.meta', { n: pack.cardsPerPack, state: t(unlocked ? 'gacha.unlocked' : 'gacha.lockedState') }) }),
            h('div', { class: 'gacha__pack-actions' }, button(t('gacha.rates'), () => showRates(pack), 'btn btn--small'), buyBtn),
          ),
        );
      });
      element.replaceChildren(
        createScreenHeader({ title: t('shop.gacha'), back: { label: t('common.back'), onTap: () => ctx.back('shopMenu') } }),
        // パックの販売機の絵（デザイン第4弾）
        h('img', { class: 'gacha__machine-art', attrs: { src: gachaMachineArt, alt: t('gacha.machine'), draggable: 'false' } }),
        h('p', { class: 'gacha__coins' }, coinIcon(), t('shop.coins', { n: save.coins })),
        h('div', { class: 'gacha__packs' }, ...packs),
      );
    };

    render();
    return { element };
  },
};
