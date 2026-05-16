import type { DocumentData } from 'firebase-admin/firestore';
import type { EventDTO } from '@/types/api';

export function toEventDTO(id: string, d: DocumentData): EventDTO {
  if (typeof d.title !== 'string') throw new Error(`toEventDTO: invalid title for id=${id}`);
  if (typeof d.date !== 'string') throw new Error(`toEventDTO: invalid date for id=${id}`);
  if (typeof d.startTime !== 'string') throw new Error(`toEventDTO: invalid startTime for id=${id}`);
  if (typeof d.endTime !== 'string') throw new Error(`toEventDTO: invalid endTime for id=${id}`);
  if (typeof d.color !== 'string') throw new Error(`toEventDTO: invalid color for id=${id}`);

  return {
    id,
    title: d.title,
    date: d.date,
    startTime: d.startTime,
    endTime: d.endTime,
    color: d.color,
    note: typeof d.note === 'string' ? d.note : null,
  };
}
