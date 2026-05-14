import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { calculateFreeSlots } from '@/lib/free-slots';
import { toEventDTO } from '@/lib/dto';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate'); // "YYYY-MM-DD"
  const endDate = searchParams.get('endDate'); // "YYYY-MM-DD"
  const dayStart = searchParams.get('dayStart') ?? '08:00';
  const dayEnd = searchParams.get('dayEnd') ?? '22:00';
  const minDuration = parseInt(searchParams.get('minDuration') ?? '30', 10);

  if (!startDate || !endDate) {
    return Response.json(
      { error: 'ValidationError', message: 'startDateとendDateは必須です' },
      { status: 400 }
    );
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

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
