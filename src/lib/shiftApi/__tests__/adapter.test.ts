import { describe, it, expect } from 'vitest';
import { shiftEventsToEventDTOs } from '../adapter';

const validItem = {
  id: 'abc',
  title: 'シフト',
  start: '2026-05-15T09:00:00+09:00',
  end: '2026-05-15T17:00:00+09:00',
  color: '#10B981',
  memo: 'メモ',
  workplaceId: 'wp1',
  breakMin: 60,
  allDay: false,
};

describe('shiftEventsToEventDTOs', () => {
  it('converts a valid item', () => {
    const result = shiftEventsToEventDTOs([validItem]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('shift:abc');
    expect(result[0].date).toBe('2026-05-15');
    expect(result[0].startTime).toBe('09:00');
    expect(result[0].endTime).toBe('17:00');
    expect(result[0].source).toBe('shift');
  });

  it('skips invalid items without throwing', () => {
    const invalid = { id: 123, title: null, start: 'bad', end: 'bad', color: 'not-hex' };
    const result = shiftEventsToEventDTOs([invalid, validItem]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('shift:abc');
  });

  it('converts memo empty string to note null', () => {
    const item = { ...validItem, memo: '' };
    const result = shiftEventsToEventDTOs([item]);
    expect(result[0].note).toBeNull();
  });

  it('returns empty array for empty input', () => {
    expect(shiftEventsToEventDTOs([])).toEqual([]);
  });

  it('returns empty array when all items are invalid', () => {
    expect(shiftEventsToEventDTOs([{ foo: 'bar' }, null, 42])).toEqual([]);
  });
});
