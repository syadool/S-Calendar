'use client';

import { useEffect, useState } from 'react';
import { CalendarProvider, useCalendar } from '@/providers/CalendarProvider';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { MonthView } from '@/components/calendar/MonthView';
import { Spinner } from '@/components/ui/Spinner';
import type { EventDTO } from '@/types/api';
import { apiFetch } from '@/lib/api-client';
import { getWeekRange, getMonthRange, formatDate } from '@/lib/date';
import { useShiftEvents } from '@/hooks/useShiftEvents';
import { shiftEventsToEventDTOs } from '@/lib/shiftApi/adapter';

function CalendarContent() {
  const { currentView, currentDate } = useCalendar();
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const range = (() => {
    if (currentView === 'day') {
      return { start: currentDate, end: currentDate };
    }
    if (currentView === 'week') return getWeekRange(currentDate);
    return getMonthRange(currentDate);
  })();
  const { events: shiftEvents } = useShiftEvents({
    from: formatDate(range.start),
    to: formatDate(range.end),
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const eventsData = await apiFetch<{ events: EventDTO[] }>(
          `/api/events?startDate=${formatDate(range.start)}&endDate=${formatDate(range.end)}`
        );
        setEvents(eventsData.events ?? []);
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, currentDate]);

  const mergedEvents: EventDTO[] = [
    ...events,
    ...shiftEventsToEventDTOs(shiftEvents as unknown[]),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <CalendarHeader />
      {currentView === 'week' && (
        <WeekView currentDate={currentDate} events={mergedEvents} />
      )}
      {currentView === 'day' && (
        <DayView currentDate={currentDate} events={mergedEvents} />
      )}
      {currentView === 'month' && (
        <MonthView currentDate={currentDate} events={mergedEvents} />
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <CalendarProvider>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">カレンダー</h1>
        <CalendarContent />
      </div>
    </CalendarProvider>
  );
}
