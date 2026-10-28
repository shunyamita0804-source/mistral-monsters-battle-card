import { getMonster, HIDDEN_MONSTER_ID } from '../../data/cards.ts';
import { FRAGMENT_TOTAL } from '../../data/fragments.ts';
import { canRestoreHidden, fragmentCount, restoreHidden } from '../../game/progress/fragments.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { h } from '../dom.ts';
import { newId, type GameStore } from '../gameStore.ts';
import { sound } from '../sound.ts';
import { createCardView } from './cardView.ts';
import { confirmModal, messageModal, openModal } from './modal.ts';
import restoreSceneArt from '@assets/images/ui/restore/restore_scene.webp';
import restoreFxArt from '@assets/images/effects/fx_restore.webp';

/** 特別復元の光を見せる時間 */
const RESTORE_FX_MS = 1600;

/**
 * 欠片の特別復元（隠しモンスターの復元）。2026-10-28 ユーザー決定でカードショップから研究所へ移した
 * （研究所の解析台を調べる・研究員ルーカスに話しかける）。条件・画面・絵（restore_scene）は前のまま。
 * onDone：窓を閉じたとき
 */
export function openRestore(parent: HTMLElement, store: GameStore, onDone?: () => void): void {
  const save = store.save;
  if (save.hiddenRestored) {
    messageModal(parent, t('shop.restoreDone'), onDone);
    return;
  }
  if (!canRestoreHidden(save)) {
    messageModal(parent, t('shop.restoreNotReady', { n: fragmentCount(save), total: FRAGMENT_TOTAL }), onDone, t('shop.restoreTitle'));
    return;
  }
  const tx = newId('restore');
  // 特別復元の場面（2026-10-26 デザイン第11弾）：欠片の祭壇の絵を確認の窓に、復元したら祭壇に光があふれてから結果を出す
  const scene = (): HTMLElement => h('img', { class: 'restore-scene', attrs: { src: restoreSceneArt, alt: '', draggable: 'false' } });
  let restored = false;
  confirmModal(
    parent,
    t('shop.restoreTitle'),
    [scene(), h('p', { class: 'modal__text', text: t('shop.restoreConfirm') })],
    () => {
      const r = restoreHidden(store.save, tx);
      if (r.status !== 'ok') return;
      restored = true;
      store.update(() => r.save);
      sound.play('reward');
      const fx = h('div', { class: 'restore-fx', attrs: { 'aria-hidden': 'true' } }, scene(), h('img', { class: 'restore-fx__light', attrs: { src: restoreFxArt, alt: '', draggable: 'false' } }));
      parent.append(fx);
      setTimeout(() => {
        fx.remove();
        showResult();
      }, RESTORE_FX_MS);
    },
    // 「はい」のときも先に窓が閉じるので、復元が始まったかを見てから呼ぶ
    () =>
      queueMicrotask(() => {
        if (!restored) onDone?.();
      }),
  );
  const showResult = (): void => {
    const monster = getMonster(HIDDEN_MONSTER_ID);
    const handle = openModal(parent, {
      title: t('shop.restoreSuccess'),
      body: [
        h('div', { class: 'card-detail__card' }, createCardView(monster, 150, true)),
        h('p', { class: 'modal__text', text: t('shop.restoreGot', { name: cardName(monster) }) }),
        h('p', { class: 'modal__text modal__text--sub', text: t('shop.restoreNote') }),
      ],
      actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      ...(onDone ? { onClose: onDone } : {}),
    });
  };
}
