import type { DocumentData } from 'firebase-admin/firestore';
import type { EventDTO } from '@/types/api';

export function toEventDTO(id: string, d: DocumentData): EventDTO {
  return {
    id,
    title: d.title as string,
    date: d.date as string,
    startTime: d.startTime as string,
    endTime: d.endTime as string,
    color: d.color as string,
    note: (d.note as string | undefined) ?? null,
  };
}
