export interface ShiftEvent {
  id: string;
  title: string;
  start: string; // ISO with +09:00
  end: string; // ISO with +09:00
  allDay: false;
  color: string; // #RRGGBB
  workplaceId: string;
  breakMin: number;
  memo: string;
}
