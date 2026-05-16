'use client';

import { useEffect, useState } from 'react';
import { fetchShiftEvents, ShiftApiUnauthorizedError, ShiftApiNotConfiguredError } from '@/lib/shiftApi/client';
import type { ShiftEvent } from '@/lib/shiftApi/types';

export interface ShiftEventsRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  workplaceId?: string;
}

export interface UseShiftEventsResult {
  events: ShiftEvent[];
  loading: boolean;
  error: Error | null;
  unauthorized: boolean;
}

export function useShiftEvents(range: ShiftEventsRange | null): UseShiftEventsResult {
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const from = range?.from;
  const to = range?.to;
  const workplaceId = range?.workplaceId;

  useEffect(() => {
    if (!from || !to) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUnauthorized(false);

    fetchShiftEvents({ from, to, workplaceId })
      .then((data) => {
        if (cancelled) return;
        setEvents(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ShiftApiNotConfiguredError) {
          setEvents([]);
        } else if (e instanceof ShiftApiUnauthorizedError) {
          setUnauthorized(true);
          setEvents([]);
        } else {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, workplaceId]);

  return { events, loading, error, unauthorized };
}
