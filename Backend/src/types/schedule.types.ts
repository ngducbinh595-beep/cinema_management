export interface AutoScheduleInput {
  date: string;
  movieIds: number[];
  roomIds?: number[];
  cleaningBufferMinutes?: number;
}

export interface ScheduledSlot {
  roomId: number;
  movieId: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  reason: string;
}

export interface AutoScheduleOutput {
  source: "ai" | "fallback";
  schedule: ScheduledSlot[];
  summary: string;
}

export interface MovieScheduleData {
  id: number;
  title: string;
  rating: "P" | "T13" | "T16" | "T18";
  genre: string;
  durationMin: number;
  isFeatured: boolean;
  revenue7d: number;
  hotScore: number;
  preferredTimeSlot: "golden" | "family" | "late" | "any";
}

export interface RoomScheduleData {
  id: number;
  cinemaId: number;
  name: string;
  totalSeats: number;
  format: string;
  audio: string;
  isPremium: boolean; // IMAX hoặc Dolby Atmos hoặc ghế lớn
}

export interface ExistingSlot {
  id: number;
  roomId: number;
  movieId: number;
  startMinutes: number; // số phút từ 00:00
  endMinutes: number;
  startTimeStr: string;
  endTimeStr: string;
}
