import { describe, it, expect } from 'vitest';
import { toMinutes, fromMinutes, isValidHHmm } from '../time';

describe('isValidHHmm', () => {
  it('accepts 00:00', () => expect(isValidHHmm('00:00')).toBe(true));
  it('accepts 23:59', () => expect(isValidHHmm('23:59')).toBe(true));
  it('rejects 24:00', () => expect(isValidHHmm('24:00')).toBe(false));
  it('rejects negative-like -1:00', () => expect(isValidHHmm('-1:00')).toBe(false));
  it('rejects empty string', () => expect(isValidHHmm('')).toBe(false));
  it('rejects non-numeric', () => expect(isValidHHmm('ab:cd')).toBe(false));
});

describe('toMinutes', () => {
  it('converts 00:00 to 0', () => expect(toMinutes('00:00')).toBe(0));
  it('converts 23:59 to 1439', () => expect(toMinutes('23:59')).toBe(1439));
  it('throws on 24:00', () => expect(() => toMinutes('24:00')).toThrow());
  it('throws on invalid format', () => expect(() => toMinutes('-1:00')).toThrow());
});

describe('fromMinutes', () => {
  it('converts 0 to 00:00', () => expect(fromMinutes(0)).toBe('00:00'));
  it('converts 1439 to 23:59', () => expect(fromMinutes(1439)).toBe('23:59'));
  it('throws on negative', () => expect(() => fromMinutes(-1)).toThrow());
  it('throws on 1440', () => expect(() => fromMinutes(1440)).toThrow());
});
