'use client';

import type { EventDTO } from '@/types/api';
import { formatDate } from '@/lib/date';
import { toMinutes } from '@/lib/time';

interface DayViewProps {
  currentDate: Date;
  events: EventDTO[];
}

export function DayView({ currentDate, events }: DayViewProps) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8時〜22時
  const dateStr = formatDate(currentDate);

  const dayEvents = events
    .filter((e) => e.date === dateStr)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold">
          {currentDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </h3>
      </div>

      <div className="overflow-y-auto max-h-[600px]">
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter((e) => {
            const startHour = Math.floor(toMinutes(e.startTime) / 60);
            return startHour === hour;
          });

          return (
            <div key={hour} className="flex border-b border-gray-100">
              <div className="w-20 p-2 text-sm text-gray-500 border-r border-gray-200">
                {hour}:00
              </div>
              <div className="flex-1 p-2 min-h-[80px]">
                {hourEvents.map((event, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg mb-2 text-white"
                    style={{ backgroundColor: event.color }}
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm opacity-90 mt-1">
                      {event.startTime} - {event.endTime}
                    </div>
                    {event.note && (
                      <div className="text-xs opacity-80 mt-1">{event.note}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
