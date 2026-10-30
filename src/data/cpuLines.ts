import type { LocalText } from './people.ts';
import type { AiStyle, OpponentDefinition } from './tournaments.ts';

/**
 * CPU のセリフ（2026-10-31 指示書 AB【2】）。腕前 C の CPU が攻撃を見送った（迷う）・守れるのに守らなかった（守りそこねる）とき、
 * 記録の帯の説明文（「〇〇は迷っている…」など）の代わりに、相手の顔とふきだしでキャラクターが自分で言う。
 * セリフはあとでユーザーが試遊しながら直すので、この表にまとめる（構えごと。2つあるものは cpuRoll でどちらか）。英語は仮訳。
 * 人物ごとに変えるときは CPU_LINES_BY_OPPONENT に相手の ID（tournaments.ts・dungeons.ts の OpponentDefinition.id）で足す（いまは無い。常連・ボスも構えのセリフ）
 */
export type CpuLineKind = 'hesitate' | 'misguard';

export type CpuLineSet = Readonly<Record<CpuLineKind, readonly LocalText[]>>;

export const CPU_LINES: Readonly<Record<AiStyle, CpuLineSet>> = {
  normal: {
    hesitate: [
      { ja: 'うーん、これかなぁ……いや、やめとこ', en: 'Hmm, this one...? No, never mind.' },
      { ja: 'どれを出せばいいんだろう……', en: 'Which card should I play...?' },
    ],
    misguard: [
      { ja: 'あっ、しまった！', en: 'Oh no!' },
      { ja: 'わわっ、間に合わなかった……', en: "Whoa, I wasn't fast enough..." },
    ],
  },
  aggressive: {
    hesitate: [
      { ja: 'チッ、いい手がねえ！', en: 'Tch, nothing good in hand!' },
      { ja: '……次でまとめてぶっとばす！', en: "...I'll blow you all away next turn!" },
    ],
    misguard: [{ ja: '守りなんて性に合わねえんだよ！', en: "Guarding just isn't my style!" }],
  },
  guard: {
    hesitate: [{ ja: 'まだ動くときではありませんね', en: 'It is not yet time to move.' }],
    misguard: [{ ja: 'くっ……読み違えました', en: 'Ugh... I misread that.' }],
  },
  flashy: {
    hesitate: [{ ja: 'もっと派手な一撃のために、今は我慢！', en: "Holding back for an even flashier strike!" }],
    misguard: [{ ja: 'きゃっ、よそ見してたわ！', en: 'Eek, I was looking away!' }],
  },
  hunter: {
    hesitate: [{ ja: '……狙いが定まらない', en: "...Can't get a clean shot." }],
    misguard: [{ ja: '……油断した', en: '...I let my guard down.' }],
  },
  disrupt: {
    hesitate: [{ ja: 'ふふ、今は待つのが正解さ', en: 'Heh, waiting is the right move now.' }],
    misguard: [{ ja: 'おっと、計算外だね', en: "Oops, didn't see that coming." }],
  },
};

/** 人物ごとの上書き（相手の ID → そのセリフ。書いた種類だけ構えのセリフの代わりに使う） */
export const CPU_LINES_BY_OPPONENT: Readonly<Record<string, Partial<CpuLineSet>>> = {};

/** その相手のセリフの候補（人物ごとの上書き → 構え〔無ければ normal〕の順） */
export function cpuLineChoices(opponent: Pick<OpponentDefinition, 'id' | 'ai'>, kind: CpuLineKind): readonly LocalText[] {
  const own = CPU_LINES_BY_OPPONENT[opponent.id]?.[kind];
  if (own && own.length > 0) return own;
  return CPU_LINES[opponent.ai ?? 'normal'][kind];
}

/** roll（0 以上 1 未満。ai.ts の cpuRoll）で候補から1つ選ぶ */
export function pickCpuLine(opponent: Pick<OpponentDefinition, 'id' | 'ai'>, kind: CpuLineKind, roll: number): LocalText {
  const choices = cpuLineChoices(opponent, kind);
  return choices[Math.min(choices.length - 1, Math.floor(roll * choices.length))] as LocalText;
}
