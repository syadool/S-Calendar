import { z } from 'zod';
import { isValidHHmm, toMinutes } from './time';

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
