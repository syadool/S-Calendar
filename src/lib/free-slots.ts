import type { EventDTO, FreeSlot } from '@/types/api';
import { toMinutes, fromMinutes } from './time';
import { formatDuration } from './utils';
import { getDayOfWeekJa, dateToDayOfWeek, formatDate } from './date';
import { addDays, isAfter, parseISO } from './date';

interface BusyInterval {
  startMinutes: number;
  endMinutes: number;
}

function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.startMinutes - b.startMinutes);
  const merged: BusyInterval[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const interval = sorted[i];
    if (interval.startMinutes <= current.endMinutes) {
      current.endMinutes = Math.max(current.endMinutes, interval.endMinutes);
    } else {
      merged.push(current);
      current = { ...interval };
    }
  }
  merged.push(current);
  return merged;
}

function calculateDayFreeSlots(
  events: EventDTO[],
  date: string,
  dayStart: string,
  dayEnd: string,
  minDuration: number
): FreeSlot[] {
  const freeSlots: FreeSlot[] = [];
  const dayStartMinutes = toMinutes(dayStart);
  const dayEndMinutes = toMinutes(dayEnd);

  const busyIntervals: BusyInterval[] = events
    .filter((e) => e.date === date)
    .map((e) => ({
      startMinutes: toMinutes(e.startTime),
      endMinutes: toMinutes(e.endTime),
    }));

  const merged = mergeIntervals(busyIntervals);

  let current = dayStartMinutes;

  for (const busy of merged) {
    if (current < busy.startMinutes) {
      const duration = busy.startMinutes - current;
      if (duration >= minDuration) {
        const parsedDate = parseISO(date);
        const dayOfWeek = getDayOfWeekJa(dateToDayOfWeek(parsedDate));
        const startTime = fromMinutes(current);
        const endTime = fromMinutes(busy.startMinutes);

        freeSlots.push({
          date,
          dayOfWeek,
          startTime,
          endTime,
          duration,
          displayText: `${dayOfWeek} ${startTime}〜${endTime}（${formatDuration(duration)}）`,
        });
      }
    }
    current = Math.max(current, busy.endMinutes);
  }

  if (current < dayEndMinutes) {
    const duration = dayEndMinutes - current;
    if (duration >= minDuration) {
      const parsedDate = parseISO(date);
      const dayOfWeek = getDayOfWeekJa(dateToDayOfWeek(parsedDate));
      const startTime = fromMinutes(current);
      const endTime = fromMinutes(dayEndMinutes);

      freeSlots.push({
        date,
        dayOfWeek,
        startTime,
        endTime,
        duration,
        displayText: `${dayOfWeek} ${startTime}〜${endTime}（${formatDuration(duration)}）`,
      });
    }
  }

  return freeSlots;
}

export function calculateFreeSlots(
  events: EventDTO[],
  startDate: Date,
  endDate: Date,
  dayStart: string = '08:00',
  dayEnd: string = '22:00',
  minDuration: number = 30
): FreeSlot[] {
  const freeSlots: FreeSlot[] = [];
  let current = new Date(startDate);

  while (!isAfter(current, endDate)) {
    const dateStr = formatDate(current);
    const dayFreeSlots = calculateDayFreeSlots(events, dateStr, dayStart, dayEnd, minDuration);
    freeSlots.push(...dayFreeSlots);
    current = addDays(current, 1);
  }

  return freeSlots;
}
