import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameDay,
  isBefore,
  isAfter,
  parseISO,
} from 'date-fns';

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export function formatDate(date: Date, formatStr: string = 'yyyy-MM-dd'): string {
  return format(date, formatStr);
}

export function formatDateJa(date: Date, formatStr: string = 'yyyy年MM月dd日'): string {
  return format(date, formatStr);
}

export function getDayOfWeekJa(dayOfWeek: DayOfWeek): string {
  const map: Record<DayOfWeek, string> = {
    MONDAY: '月曜',
    TUESDAY: '火曜',
    WEDNESDAY: '水曜',
    THURSDAY: '木曜',
    FRIDAY: '金曜',
    SATURDAY: '土曜',
    SUNDAY: '日曜',
  };
  return map[dayOfWeek];
}

export function getDayOfWeekShort(dayOfWeek: DayOfWeek): string {
  const map: Record<DayOfWeek, string> = {
    MONDAY: '月',
    TUESDAY: '火',
    WEDNESDAY: '水',
    THURSDAY: '木',
    FRIDAY: '金',
    SATURDAY: '土',
    SUNDAY: '日',
  };
  return map[dayOfWeek];
}

export function dateToDayOfWeek(date: Date): DayOfWeek {
  const day = date.getDay();
  const map: Record<number, DayOfWeek> = {
    0: 'SUNDAY',
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
  };
  return map[day];
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // 月曜始まり
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start, end };
}

export function getWeekDays(date: Date): Date[] {
  const { start } = getWeekRange(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export {
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isBefore,
  isAfter,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
};
