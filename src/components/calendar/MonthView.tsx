'use client';

import type { EventDTO } from '@/types/api';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
} from 'date-fns';
import { formatDate, isAfter } from '@/lib/date';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  currentDate: Date;
  events: EventDTO[];
}

export function MonthView({ currentDate, events }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (!isAfter(day, calendarEnd)) {
    days.push(day);
    day = addDays(day, 1);
  }

  const eventCountByDate: Record<string, number> = {};
  events.forEach((e) => {
    eventCountByDate[e.date] = (eventCountByDate[e.date] ?? 0) + 1;
  });

  const todayStr = formatDate(new Date());

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['月', '火', '水', '木', '金', '土', '日'].map((d) => (
          <div key={d} className="p-2 text-center text-sm font-medium text-gray-700">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const dateStr = formatDate(d);
          const eventCount = eventCountByDate[dateStr] ?? 0;
          const isCurrentMonth = isSameMonth(d, currentDate);
          const isToday = dateStr === todayStr;

          return (
            <div
              key={i}
              className={cn(
                'min-h-[100px] p-2 border-b border-r border-gray-100',
                !isCurrentMonth && 'bg-gray-50',
                isToday && 'bg-primary-50'
              )}
            >
              <div
                className={cn(
                  'text-sm font-medium mb-1',
                  !isCurrentMonth && 'text-gray-400',
                  isToday && 'text-primary-700'
                )}
              >
                {d.getDate()}
              </div>
              {eventCount > 0 && (
                <div className="text-xs text-gray-600">{eventCount}件の予定</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
