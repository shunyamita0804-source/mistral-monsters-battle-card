import { backupFileName, BACKUP_MAX_BYTES, createBackup, parseBackup, serializeBackup, summarize, type BackupSummary } from '../../game/save/backup.ts';
import type { GameSettings } from '../../game/settings/settings.ts';
import { t, type Language } from '../../i18n/i18n.ts';
import { confirmModal, messageModal } from '../components/modal.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { pickTextFile, saveTextFile } from '../fileTransfer.ts';
import { sound } from '../sound.ts';
import { formatDateTime } from './settingsScreen.ts';
import type { ScreenDefinition } from './types.ts';
import iconLanguage from '@assets/images/ui/settings/icon_language.webp';
import iconSound from '@assets/images/ui/settings/icon_sound.webp';
import iconBackup from '@assets/images/ui/settings/icon_backup.webp';
import iconHowto from '@assets/images/ui/settings/icon_howto.webp';

/** 遊び方の挿絵（2026-10-26 デザイン第11弾。街・デッキ・ショップ・ダンジョン・大会の順。遊び方の5行と同じ順） */
const HOWTO_ART = Object.values(
  import.meta.glob<string>('/assets/images/ui/howto/howto_*.webp', { eager: true, query: '?url', import: 'default' }),
);

/** 見出しの帯（左の丸い台にアイコン。2026-10-26 デザイン第11弾） */
const heading = (text: string, icon: string): HTMLElement =>
  h('h2', { class: 'settings__heading settings__heading--icon' }, h('img', { class: 'settings__heading-icon', attrs: { src: icon, alt: '', draggable: 'false' } }), h('span', { text }));

/**
 * 設定：言語・音量（効果音／BGM〔将来用〕／ミュート）・セーブのバックアップ（書き出し・復元）・遊び方。
 * タイトルとベッドから開ける。バトルからは開けない（対戦中は言語が変わらない）。
 */
export const optionsScreen: ScreenDefinition = {
  id: 'options',
  titleKey: 'options.title',
  create(ctx) {
    const store = ctx.store;
    const settings = store.settings;
    const element = h('main', { class: 'screen options' });
    let scrollTop = 0;

    const change = (patch: Partial<GameSettings>): void => {
      settings.update(patch);
      render();
    };

    const languageButton = (lang: Language, label: string): HTMLButtonElement => {
      const active = settings.value.language === lang;
      const b = button(label, () => change({ language: lang }), `btn options__choice${active ? ' is-active' : ''}`);
      b.setAttribute('aria-pressed', String(active));
      b.lang = lang;
      return b;
    };

    /** 0〜100 のスライダー。動かしている間は数字だけ更新し、離したら保存する */
    const slider = (id: string, label: string, value: number, onChange: (v: number) => void, note?: string): HTMLElement => {
      const valueEl = h('span', { class: 'options__value', text: t('options.volume', { n: value }) });
      const input = h('input', {
        class: 'options__range',
        attrs: { type: 'range', min: '0', max: '100', step: '5', value: String(value), id, 'aria-label': label },
        on: {
          input: () => {
            valueEl.textContent = t('options.volume', { n: Number(input.value) });
            wrap.style.setProperty('--fill', input.value);
          },
          change: () => onChange(Number(input.value)),
        },
      });
      // 溝の絵の上に、音量に合わせた長さの金色の棒を重ねる（2026-10-23 デザイン第7弾）。つまみは input の見た目
      const wrap = h('div', { class: 'options__range-wrap' }, h('span', { class: 'options__range-gold', attrs: { 'aria-hidden': 'true' } }), input);
      wrap.style.setProperty('--fill', String(value));
      return h(
        'div',
        { class: 'options__slider' },
        h('label', { class: 'options__label', text: label, attrs: { for: id } }),
        wrap,
        valueEl,
        note ? h('p', { class: 'options__note', text: note }) : null,
      );
    };

    const summaryLine = (key: 'options.importSummary' | 'options.importCurrent', s: BackupSummary): string =>
      t(key, {
        coins: s.coins,
        cards: s.cards,
        kinds: s.kinds,
        rank: s.rank,
        won: s.battlesWon,
        lost: s.battlesLost,
        fragments: s.fragments,
      });

    const exportSave = async (): Promise<void> => {
      if (!store.hasSave) {
        messageModal(element, t('options.exportNoSave'));
        return;
      }
      store.persist();
      const name = backupFileName();
      const result = await saveTextFile(name, serializeBackup(createBackup(store.save, settings.value)));
      if (result === 'failed') messageModal(element, t('options.exportFailed'));
      else if (result !== 'cancelled') messageModal(element, t('options.exportDone', { file: name }));
    };

    const importSave = async (): Promise<void> => {
      const picked = await pickTextFile('.json,application/json', BACKUP_MAX_BYTES);
      if (!picked) return;
      if ('error' in picked) {
        showImportError(picked.error === 'tooLarge' ? t('options.error.tooLarge') : t('options.error.read'));
        return;
      }
      const check = parseBackup(picked.text);
      if (!check.ok) {
        const details = check.details.slice(0, 8).join(', ');
        const message =
          check.error === 'unknownCards'
            ? t('options.error.unknownCards', { ids: details })
            : check.error === 'outOfRange'
              ? t('options.error.outOfRange', { fields: details })
              : t(`options.error.${check.error}`);
        showImportError(message);
        return;
      }
      const lines = [
        summaryLine('options.importSummary', check.summary),
        check.summary.exportedAt ? t('options.importDate', { date: formatDateTime(check.summary.exportedAt) }) : null,
        store.hasSave ? summaryLine('options.importCurrent', summarize(store.save)) : t('options.importNoCurrent'),
        t('options.importReplace'),
      ].filter((l): l is string => l !== null);
      confirmModal(
        element,
        t('options.importConfirm'),
        lines.map((l) => h('p', { class: 'modal__text', text: l })),
        () => {
          if (!store.restoreSave(check.save)) {
            messageModal(element, t('options.importWriteFailed'));
            return;
          }
          // 言語・音量も、バックアップに入っていれば戻す
          if (check.settings) settings.update(check.settings);
          messageModal(element, t('options.importDone'), () => ctx.reset('title'));
        },
        undefined,
        'warn',
      );
    };

    const showImportError = (message: string): void => {
      messageModal(element, `${message}\n${t('options.importKept')}`, undefined, t('options.importFailedTitle'));
    };

    const render = (): void => {
      scrollTop = element.querySelector('.options__body')?.scrollTop ?? scrollTop;
      const s = settings.value;
      const exportBtn = button(t('options.export'), () => void exportSave(), 'btn btn--primary');
      exportBtn.disabled = !store.hasSave;
      const muteBtn = button(t('options.muteState', { state: t(s.muted ? 'options.on' : 'options.off') }), () => {
        change({ muted: !s.muted });
        if (s.muted) sound.play('cardDraw'); // ミュートを解いたら試しに鳴らす
      }, `btn options__toggle${s.muted ? ' is-active' : ''}`);
      muteBtn.setAttribute('aria-pressed', String(s.muted));
      element.replaceChildren(
        createScreenHeader({ title: t('options.title'), back: { label: t('common.back'), onTap: () => ctx.back('title') } }),
        h(
          'div',
          { class: 'options__body' },
          heading(t('options.language'), iconLanguage),
          h('div', { class: 'options__choices' }, languageButton('ja', t('options.languageJa')), languageButton('en', t('options.languageEn'))),

          heading(t('options.sound'), iconSound),
          slider('opt-se', t('options.se'), s.seVolume, (v) => {
            change({ seVolume: v });
            sound.play('cardDraw'); // 新しい音量で試しに鳴らす
          }),
          slider('opt-bgm', t('options.bgm'), s.bgmVolume, (v) => change({ bgmVolume: v }), t('options.bgmNote')),
          muteBtn,
          settings.lastSaveOk ? null : h('p', { class: 'notice notice--warn', text: t('options.notSaved') }),

          heading(t('options.backup'), iconBackup),
          h('p', { class: 'settings__note', text: t('options.backupNote') }),
          exportBtn,
          button(t('options.import'), () => void importSave(), 'btn'),

          heading(t('options.help'), iconHowto),
          h(
            'ol',
            { class: 'options__help options__help--art' },
            ...t('options.helpSteps')
              .split('\n')
              .map((line, i) =>
                h(
                  'li',
                  { class: 'options__help-item' },
                  HOWTO_ART[i] ? h('img', { class: 'options__help-art', attrs: { src: HOWTO_ART[i], alt: '', draggable: 'false' } }) : null,
                  h('span', { class: 'options__help-no', text: String(i + 1) }),
                  h('span', { class: 'options__help-text', text: line.replace(/^\d+\.\s*/, '') }),
                ),
              ),
          ),
          h('p', { class: 'settings__note', text: t('options.helpNote') }),

          h('h2', { class: 'settings__heading', text: t('options.credits') }),
          // 素材のクレジットは巻物の上に（2026-10-27 デザイン33点の 27。上の軸・紙・下の軸。ui33.css）
          h('div', { class: 'credits-scroll' }, h('p', { class: 'settings__note credits-scroll__text', text: t('options.creditsText') })),
        ),
      );
      const body = element.querySelector('.options__body');
      if (body) body.scrollTop = scrollTop;
    };

    render();
    return { element };
  },
};
