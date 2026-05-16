import { describe, it, expect } from 'vitest';
import { calculateFreeSlots } from '../free-slots';
import { parseISO } from '../date';
import type { EventDTO } from '@/types/api';

const makeEvent = (date: string, startTime: string, endTime: string): EventDTO => ({
  id: `${date}-${startTime}`,
  title: 'test',
  date,
  startTime,
  endTime,
  color: '#10B981',
  note: null,
});

describe('calculateFreeSlots', () => {
  it('returns full day slot when no events', () => {
    const slots = calculateFreeSlots(
      [],
      parseISO('2026-05-15'),
      parseISO('2026-05-15')
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe('08:00');
    expect(slots[0].endTime).toBe('22:00');
    expect(slots[0].duration).toBe(840);
  });

  it('returns empty when day is fully booked', () => {
    const events = [makeEvent('2026-05-15', '08:00', '22:00')];
    const slots = calculateFreeSlots(
      events,
      parseISO('2026-05-15'),
      parseISO('2026-05-15')
    );
    expect(slots).toHaveLength(0);
  });

  it('merges adjacent events', () => {
    const events = [
      makeEvent('2026-05-15', '09:00', '10:00'),
      makeEvent('2026-05-15', '10:00', '11:00'),
    ];
    const slots = calculateFreeSlots(
      events,
      parseISO('2026-05-15'),
      parseISO('2026-05-15')
    );
    const times = slots.map((s) => `${s.startTime}-${s.endTime}`);
    expect(times).toContain('08:00-09:00');
    expect(times).toContain('11:00-22:00');
    expect(times).not.toContain('10:00-10:00');
  });

  it('filters out slots shorter than minDuration', () => {
    const events = [
      makeEvent('2026-05-15', '08:00', '09:00'),
      makeEvent('2026-05-15', '09:20', '22:00'),
    ];
    const slots = calculateFreeSlots(
      events,
      parseISO('2026-05-15'),
      parseISO('2026-05-15'),
      '08:00',
      '22:00',
      30
    );
    // 09:00〜09:20 は 20 分なので minDuration=30 に届かずフィルタされる
    const shortSlot = slots.find((s) => s.startTime === '09:00');
    expect(shortSlot).toBeUndefined();
    expect(slots).toHaveLength(0);
  });

  it('covers multiple days', () => {
    const slots = calculateFreeSlots(
      [],
      parseISO('2026-05-15'),
      parseISO('2026-05-16')
    );
    expect(slots).toHaveLength(2);
    expect(slots[0].date).toBe('2026-05-15');
    expect(slots[1].date).toBe('2026-05-16');
  });
});
