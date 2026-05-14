'use client';

import type { EventDTO } from '@/types/api';
import { getWeekDays, formatDate, dateToDayOfWeek, getDayOfWeekShort } from '@/lib/date';
import { toMinutes } from '@/lib/time';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  currentDate: Date;
  events: EventDTO[];
}

export function WeekView({ currentDate, events }: WeekViewProps) {
  const weekDays = getWeekDays(currentDate);
  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8時〜22時

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-8 border-b border-gray-200">
        <div className="p-2 text-sm font-medium text-gray-500">時刻</div>
        {weekDays.map((day, i) => {
          const isToday = formatDate(day) === formatDate(new Date());
          return (
            <div
              key={i}
              className={cn(
                'p-2 text-center text-sm font-medium',
                isToday ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
              )}
            >
              <div>{getDayOfWeekShort(dateToDayOfWeek(day))}</div>
              <div className="text-xs">{day.getDate()}</div>
            </div>
          );
        })}
      </div>

      <div className="overflow-y-auto max-h-[600px]">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
            <div className="p-2 text-xs text-gray-500 border-r border-gray-200">
              {hour}:00
            </div>
            {weekDays.map((day, i) => {
              const dateStr = formatDate(day);
              const dayEvents = events
                .filter((e) => e.date === dateStr)
                .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
              const hourEvents = dayEvents.filter((e) => {
                const startHour = Math.floor(toMinutes(e.startTime) / 60);
                return startHour === hour;
              });

              return (
                <div key={i} className="p-1 border-r border-gray-100 min-h-[60px]">
                  {hourEvents.map((event, j) => (
                    <div
                      key={j}
                      className="text-xs p-1 rounded mb-1 text-white"
                      style={{ backgroundColor: event.color }}
                    >
                      {event.title}
                      <div className="text-[10px] opacity-80">
                        {event.startTime}-{event.endTime}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
