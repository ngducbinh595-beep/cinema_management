import { NOW_SHOWING_MOVIES } from "@/constants"

/** 1 suất chiếu do AI trả về */
export interface ScheduledSlot {
  roomId: number
  movieId: number
  startTime: string
  endTime: string
  reason: string
}

/** Kết quả API POST /api/ai/admin/auto-schedule */
export interface AutoScheduleResult {
  source: "ai" | "fallback"
  schedule: ScheduledSlot[]
  summary: string
}

/** Block hiển thị trên timeline của trang Suất chiếu (nguồn: bản ghi DB) */
export interface TimelineBlock {
  id: string
  room: string
  movieTitle: string
  startTime: string
  endTime: string
  startHour: number
  durationHours: number
  format: string
  isSelected?: boolean
  source?: "db"
  roomId?: number
  movieId?: number
}

export interface RoomMeta {
  id: number
  name: string
  format: string
  audio: string
  seats: number
}

/** Phòng của Cinema Nguyễn Du (khớp bảng rooms trong DB) */
export const ADMIN_ROOMS: RoomMeta[] = [
  { id: 1, name: "Phòng 01", format: "2D", audio: "Dolby Atmos", seats: 120 },
  { id: 2, name: "Phòng 02", format: "2D", audio: "Dolby Atmos", seats: 96 },
  { id: 3, name: "Phòng 03", format: "2D", audio: "Dolby Atmos", seats: 120 },
  { id: 4, name: "Phòng 04", format: "IMAX", audio: "Dolby Atmos", seats: 160 },
  { id: 5, name: "Phòng 05", format: "2D", audio: "Dolby Atmos", seats: 80 },
  { id: 6, name: "Phòng 06", format: "4DX", audio: "Dolby Atmos", seats: 110 },
]

/** Phim đang chiếu (id số khớp bảng movies: 1..6) */
export const ADMIN_MOVIES = NOW_SHOWING_MOVIES.map((movie) => ({
  id: Number(movie.id),
  title: movie.title,
  duration: movie.duration,
  rating: movie.rating,
  poster: movie.poster,
})).filter((movie) => Number.isFinite(movie.id))

/** "IMAX · Dolby Atmos" */
export function roomFormatLabel(roomId: number): string {
  const room = ADMIN_ROOMS.find((item) => item.id === roomId)
  if (!room) return `Phòng #${roomId}`
  return `${room.format} · ${room.audio}`
}

export function roomName(roomId: number): string {
  return ADMIN_ROOMS.find((item) => item.id === roomId)?.name || `Phòng #${roomId}`
}

export function movieTitle(movieId: number): string {
  return ADMIN_MOVIES.find((movie) => movie.id === movieId)?.title || `Phim #${movieId}`
}

/** "2026-10-29" -> "29/10/2026" */
export function formatISOToVN(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

/** Hôm nay theo định dạng YYYY-MM-DD (giờ máy) */
export function todayISO(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}
