import { auth } from '@/lib/firebase-client';
import type { ShiftEvent } from './types';

export class ShiftApiUnauthorizedError extends Error {
  constructor(message = 'Shift API unauthorized') {
    super(message);
    this.name = 'ShiftApiUnauthorizedError';
  }
}

export class ShiftApiNotConfiguredError extends Error {
  constructor(message = 'NEXT_PUBLIC_SHIFT_API_BASE is not set') {
    super(message);
    this.name = 'ShiftApiNotConfiguredError';
  }
}

export interface FetchShiftEventsParams {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  workplaceId?: string;
}

export async function fetchShiftEvents(
  params: FetchShiftEventsParams
): Promise<ShiftEvent[]> {
  const base = process.env.NEXT_PUBLIC_SHIFT_API_BASE;
  if (!base) throw new ShiftApiNotConfiguredError();

  const user = auth.currentUser;
  if (!user) throw new ShiftApiUnauthorizedError('Not signed in');
  const token = await user.getIdToken();

  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.workplaceId) qs.set('workplaceId', params.workplaceId);

  const res = await fetch(`${base}/api/shifts?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) throw new ShiftApiUnauthorizedError();
  if (!res.ok) throw new Error(`Shift API error: HTTP ${res.status}`);

  const body = (await res.json()) as { events: ShiftEvent[] };
  return body.events ?? [];
}
