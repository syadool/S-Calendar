import { z } from 'zod';
import type { EventDTO } from '@/types/api';

export const shiftEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  memo: z.string().optional().default(''),
  workplaceId: z.string(),
  breakMin: z.number(),
  allDay: z.literal(false).optional(),
});

export type ShiftEvent = z.infer<typeof shiftEventSchema>;

function shiftEventToEventDTO(s: ShiftEvent): EventDTO {
  return {
    id: 'shift:' + s.id,
    title: s.title,
    date: s.start.slice(0, 10),
    startTime: s.start.slice(11, 16),
    endTime: s.end.slice(11, 16),
    color: s.color,
    note: s.memo || null,
    source: 'shift',
  };
}

export function shiftEventsToEventDTOs(items: unknown[]): EventDTO[] {
  const result: EventDTO[] = [];
  for (const item of items) {
    const parsed = shiftEventSchema.safeParse(item);
    if (parsed.success) {
      result.push(shiftEventToEventDTO(parsed.data));
    }
  }
  return result;
}
