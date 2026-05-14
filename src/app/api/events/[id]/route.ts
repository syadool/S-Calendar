import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { updateEventSchema } from '@/lib/validation';
import { toEventDTO } from '@/lib/dto';

export const PUT = withAuth(
  async (req: NextRequest, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return Response.json({ error: 'BadRequest', message: 'IDが必要です' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'BadRequest', message: '無効なJSONです' }, { status: 400 });
    }

    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'ValidationError', message: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const docRef = adminDb
      .collection('users')
      .doc(user.uid)
      .collection('events')
      .doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return Response.json({ error: 'NotFound', message: 'イベントが見つかりません' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
    if (parsed.data.startTime !== undefined) updateData.startTime = parsed.data.startTime;
    if (parsed.data.endTime !== undefined) updateData.endTime = parsed.data.endTime;
    if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
    if (parsed.data.note !== undefined) updateData.note = parsed.data.note;

    await docRef.update(updateData);
    const updated = await docRef.get();
    return Response.json({ event: toEventDTO(updated.id, updated.data()!) });
  }
);

export const DELETE = withAuth(
  async (_req: NextRequest, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return Response.json({ error: 'BadRequest', message: 'IDが必要です' }, { status: 400 });
    }

    const docRef = adminDb
      .collection('users')
      .doc(user.uid)
      .collection('events')
      .doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return Response.json({ error: 'NotFound', message: 'イベントが見つかりません' }, { status: 404 });
    }

    await docRef.delete();
    return new Response(null, { status: 204 });
  }
);
