import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { createEventSchema } from '@/lib/validation';
import { toEventDTO } from '@/lib/dto';

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate'); // "YYYY-MM-DD"
  const endDate = searchParams.get('endDate'); // "YYYY-MM-DD"

  let query: FirebaseFirestore.Query = adminDb
    .collection('users')
    .doc(user.uid)
    .collection('events');

  if (startDate) {
    query = query.where('date', '>=', startDate);
  }
  if (endDate) {
    query = query.where('date', '<=', endDate);
  }
  query = query.orderBy('date').orderBy('startTime');

  const snap = await query.get();
  const events = snap.docs.map((d) => toEventDTO(d.id, d.data()));
  return Response.json({ events });
});

export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'BadRequest', message: '無効なJSONです' }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'ValidationError', message: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const ref = await adminDb
    .collection('users')
    .doc(user.uid)
    .collection('events')
    .add({
      title: parsed.data.title,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      color: parsed.data.color ?? '#10B981',
      note: parsed.data.note ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  const doc = await ref.get();
  return Response.json({ event: toEventDTO(doc.id, doc.data()!) }, { status: 201 });
});
