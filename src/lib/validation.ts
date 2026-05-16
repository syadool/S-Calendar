import { z } from 'zod';
import { isValidHHmm, toMinutes } from './time';
import { parseISO } from './date';

export const hhmmSchema = z.string().refine(isValidHHmm, 'Must be HH:mm');

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createEventSchema = z
  .object({
    title: z.string().min(1).max(100),
    date: dateStringSchema,
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    note: z.string().max(500).optional().nullable(),
  })
  .refine((d) => toMinutes(d.endTime) > toMinutes(d.startTime), {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const updateEventSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    date: dateStringSchema.optional(),
    startTime: hhmmSchema.optional(),
    endTime: hhmmSchema.optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    note: z.string().max(500).optional().nullable(),
  })
  .refine(
    (d) => {
      if (d.startTime && d.endTime) {
        return toMinutes(d.endTime) > toMinutes(d.startTime);
      }
      return true;
    },
    {
      message: 'endTime must be after startTime',
      path: ['endTime'],
    }
  );

export const eventsListQuerySchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

export const freeSlotsQuerySchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    dayStart: hhmmSchema.default('08:00'),
    dayEnd: hhmmSchema.default('22:00'),
    minDuration: z.coerce.number().int().positive().default(30),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'endDate must be >= startDate',
    path: ['endDate'],
  })
  .refine((d) => toMinutes(d.dayEnd) > toMinutes(d.dayStart), {
    message: 'dayEnd must be after dayStart',
    path: ['dayEnd'],
  })
  .refine(
    (d) => {
      const diffMs = parseISO(d.endDate).getTime() - parseISO(d.startDate).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= 366;
    },
    {
      message: 'endDate - startDate must be <= 366 days',
      path: ['endDate'],
    }
  );
