import { describe, it, expect } from 'vitest';
import { createEventSchema, updateEventSchema, freeSlotsQuerySchema } from '../validation';

describe('createEventSchema', () => {
  const base = {
    title: 'テスト',
    date: '2026-05-15',
    startTime: '09:00',
    endTime: '10:00',
  };

  it('accepts valid input', () => {
    expect(createEventSchema.safeParse(base).success).toBe(true);
  });

  it('rejects when endTime <= startTime', () => {
    const result = createEventSchema.safeParse({ ...base, endTime: '09:00' });
    expect(result.success).toBe(false);
  });

  it('rejects when endTime < startTime', () => {
    const result = createEventSchema.safeParse({ ...base, endTime: '08:00' });
    expect(result.success).toBe(false);
  });

  it('rejects title longer than 100', () => {
    const result = createEventSchema.safeParse({ ...base, title: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('updateEventSchema', () => {
  it('accepts only startTime update', () => {
    const result = updateEventSchema.safeParse({ startTime: '10:00' });
    expect(result.success).toBe(true);
  });

  it('accepts only endTime update', () => {
    const result = updateEventSchema.safeParse({ endTime: '11:00' });
    expect(result.success).toBe(true);
  });

  it('validates end > start when both provided', () => {
    const result = updateEventSchema.safeParse({ startTime: '10:00', endTime: '09:00' });
    expect(result.success).toBe(false);
  });

  it('accepts empty object', () => {
    expect(updateEventSchema.safeParse({}).success).toBe(true);
  });
});

describe('freeSlotsQuerySchema', () => {
  const base = {
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  };

  it('accepts valid input with defaults', () => {
    const result = freeSlotsQuerySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dayStart).toBe('08:00');
      expect(result.data.dayEnd).toBe('22:00');
      expect(result.data.minDuration).toBe(30);
    }
  });

  it('rejects minDuration=NaN', () => {
    const result = freeSlotsQuerySchema.safeParse({ ...base, minDuration: 'NaN' });
    expect(result.success).toBe(false);
  });

  it('rejects minDuration=-1', () => {
    const result = freeSlotsQuerySchema.safeParse({ ...base, minDuration: '-1' });
    expect(result.success).toBe(false);
  });

  it('rejects minDuration=abc', () => {
    const result = freeSlotsQuerySchema.safeParse({ ...base, minDuration: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects period > 366 days', () => {
    const result = freeSlotsQuerySchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2027-01-03',
    });
    expect(result.success).toBe(false);
  });

  it('accepts period of exactly 366 days', () => {
    const result = freeSlotsQuerySchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2027-01-02',
    });
    expect(result.success).toBe(true);
  });

  it('rejects endDate < startDate', () => {
    const result = freeSlotsQuerySchema.safeParse({
      startDate: '2026-05-31',
      endDate: '2026-05-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects dayEnd <= dayStart', () => {
    const result = freeSlotsQuerySchema.safeParse({ ...base, dayStart: '22:00', dayEnd: '08:00' });
    expect(result.success).toBe(false);
  });
});
