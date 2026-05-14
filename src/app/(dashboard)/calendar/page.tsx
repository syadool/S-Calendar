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

function CalendarContent() {
  const { currentView, currentDate } = useCalendar();
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        let startDate: Date;
        let endDate: Date;
        if (currentView === 'day') {
          startDate = currentDate;
          endDate = currentDate;
        } else if (currentView === 'week') {
          const range = getWeekRange(currentDate);
          startDate = range.start;
          endDate = range.end;
        } else {
          const range = getMonthRange(currentDate);
          startDate = range.start;
          endDate = range.end;
        }

        const eventsData = await apiFetch<{ events: EventDTO[] }>(
          `/api/events?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`
        );
        setEvents(eventsData.events ?? []);
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentView, currentDate]);

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
        <WeekView currentDate={currentDate} events={events} />
      )}
      {currentView === 'day' && (
        <DayView currentDate={currentDate} events={events} />
      )}
      {currentView === 'month' && (
        <MonthView currentDate={currentDate} events={events} />
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
