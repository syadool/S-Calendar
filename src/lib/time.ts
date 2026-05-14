import { z } from 'zod';

/**
 * "HH:mm" -> 0時からの分数。書式不正なら throw。
 */
export function toMinutes(hhmm: string): number {
  if (!isValidHHmm(hhmm)) {
    throw new Error(`Invalid HH:mm format: "${hhmm}"`);
  }
  const [h, m] = hhmm.split(':').map((s) => Number(s));
  return h * 60 + m;
}

/**
 * 0..1439 の分数 -> "HH:mm"。範囲外なら throw。
 */
export function fromMinutes(minutes: number): string {
  if (minutes < 0 || minutes > 1439) {
    throw new Error(`Minutes out of range: ${minutes}`);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 2 つの "HH:mm" の差分 (分)。end が start より前なら負値。
 */
export function diffMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}

/**
 * "HH:mm" 形式かつ 00:00..23:59 であることを検証。
 */
export function isValidHHmm(s: string): boolean {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * Zod 互換: "HH:mm" バリデータ。
 */
export const timeStringSchema: z.ZodString = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Must be HH:mm');
