import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { calculateFreeSlots } from '@/lib/free-slots';
import { toEventDTO } from '@/lib/dto';
import { freeSlotsQuerySchema } from '@/lib/validation';
import { parseISO } from '@/lib/date';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const { searchParams } = new URL(req.url);

  const raw = {
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    dayStart: searchParams.get('dayStart') ?? undefined,
    dayEnd: searchParams.get('dayEnd') ?? undefined,
    minDuration: searchParams.get('minDuration') ?? undefined,
  };

  const parsed = freeSlotsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: 'ValidationError', message: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { startDate, endDate, dayStart, dayEnd, minDuration } = parsed.data;
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const eventsSnap = await adminDb
    .collection('users')
    .doc(user.uid)
    .collection('events')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date')
    .get();

  const events = eventsSnap.docs.map((d) => toEventDTO(d.id, d.data()));

  const freeSlots = calculateFreeSlots(events, start, end, dayStart, dayEnd, minDuration);

  return Response.json({ freeSlots });
});
