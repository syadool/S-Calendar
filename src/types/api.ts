export interface EventDTO {
  id: string;
  title: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  color: string;
  note: string | null;
}

export interface FreeSlot {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: string; // 表示用 "月曜" など
  startTime: string;
  endTime: string;
  duration: number; // 分
  displayText: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface CreateEventRequest {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  color?: string;
  note?: string | null;
}

export interface UpdateEventRequest {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  color?: string;
  note?: string | null;
}
