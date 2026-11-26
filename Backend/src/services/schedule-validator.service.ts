import {
  ScheduledSlot,
  MovieScheduleData,
  RoomScheduleData,
  ExistingSlot,
} from "../types/schedule.types.js";
import { timeToMinutes, minutesToTime } from "../models/schedule.model.js";

export interface ValidationResult {
  isValid: boolean;
  schedule: ScheduledSlot[];
  errors: string[];
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const OPEN_TIME = 9 * 60; // 09:00
const CLOSE_TIME = 23 * 60 + 59; // 23:59

/**
 * Kiểm tra và chuẩn hóa kết quả xếp lịch do AI đề xuất
 */
export function validateAndCleanSchedule(
  rawSchedule: any[],
  movies: MovieScheduleData[],
  rooms: RoomScheduleData[],
  existingSlots: ExistingSlot[],
  cleaningBuffer: number
): ValidationResult {
  const errors: string[] = [];
  const movieMap = new Map<number, MovieScheduleData>();
  for (const m of movies) movieMap.set(m.id, m);

  const roomMap = new Map<number, RoomScheduleData>();
  for (const r of rooms) roomMap.set(r.id, r);

  if (!Array.isArray(rawSchedule) || rawSchedule.length === 0) {
    return {
      isValid: false,
      schedule: [],
      errors: ["AI trả về danh sách lịch rỗng hoặc không phải mảng."],
    };
  }

  // 1. Lọc và tự sửa lỗi nhỏ từng suất chiếu
  const candidateSlots: Array<{
    roomId: number;
    movieId: number;
    startMin: number;
    endMin: number;
    reason: string;
  }> = [];

  for (let i = 0; i < rawSchedule.length; i++) {
    const item = rawSchedule[i];
    const roomId = Number(item?.roomId);
    const movieId = Number(item?.movieId);
    const startTimeStr = String(item?.startTime || "").trim();
    const reason = String(item?.reason || "Suất chiếu đề xuất bởi AI").trim();

    // Kiểm tra roomId hợp lệ
    if (!roomMap.has(roomId)) {
      errors.push(`Slot #${i + 1}: roomId ${roomId} không nằm trong danh sách phòng hợp lệ.`);
      continue;
    }

    // Kiểm tra movieId hợp lệ
    const movie = movieMap.get(movieId);
    if (!movie) {
      errors.push(`Slot #${i + 1}: movieId ${movieId} không nằm trong danh sách phim được yêu cầu.`);
      continue;
    }

    // Kiểm tra định dạng giờ
    if (!TIME_REGEX.test(startTimeStr)) {
      errors.push(`Slot #${i + 1}: startTime "${startTimeStr}" không đúng định dạng HH:mm.`);
      continue;
    }

    const startMin = timeToMinutes(startTimeStr);

    // Tự sửa thời lượng: endTime = startMin + movie.durationMin
    const endMin = startMin + movie.durationMin;

    // Giờ hoạt động rạp: 09:00 - 23:59 (kết thúc trước 00:00)
    if (startMin < OPEN_TIME) {
      errors.push(`Slot #${i + 1}: Bắt đầu lúc ${startTimeStr} trước giờ mở cửa (09:00). Bị loại bỏ.`);
      continue;
    }

    if (endMin > CLOSE_TIME) {
      errors.push(`Slot #${i + 1}: Kết thúc lúc ${minutesToTime(endMin)} sau giờ đóng cửa (23:59). Bị loại bỏ.`);
      continue;
    }

    candidateSlots.push({
      roomId,
      movieId,
      startMin,
      endMin,
      reason,
    });
  }

  // 2. Nhóm theo phòng và kiểm tra va chạm (trùng lịch, buffer dọn phòng, đè lên DB)
  // Sắp xếp các suất theo startTime tăng dần
  candidateSlots.sort((a, b) => a.startMin - b.startMin);

  const finalSlots: ScheduledSlot[] = [];
  const bookedByRoom = new Map<number, Array<{ start: number; end: number }>>();

  // Khởi tạo các suất đã có trong DB
  for (const r of rooms) {
    bookedByRoom.set(r.id, []);
  }
  for (const ex of existingSlots) {
    bookedByRoom.get(ex.roomId)?.push({
      start: ex.startMinutes,
      end: ex.endMinutes,
    });
  }

  for (const slot of candidateSlots) {
    const intervals = bookedByRoom.get(slot.roomId) || [];

    // Kiểm tra xung đột với bất kỳ suất nào trước đó trong phòng
    let conflict = false;
    for (const b of intervals) {
      const isSeparated =
        slot.endMin + cleaningBuffer <= b.start ||
        slot.startMin >= b.end + cleaningBuffer;

      if (!isSeparated) {
        conflict = true;
        errors.push(
          `Trùng lịch hoặc không đủ buffer ${cleaningBuffer}p tại phòng ${slot.roomId}: suất ${minutesToTime(slot.startMin)}-${minutesToTime(slot.endMin)} chạm khoảng ${minutesToTime(b.start)}-${minutesToTime(b.end)}.`
        );
        break;
      }
    }

    if (!conflict) {
      intervals.push({ start: slot.startMin, end: slot.endMin });
      finalSlots.push({
        roomId: slot.roomId,
        movieId: slot.movieId,
        startTime: minutesToTime(slot.startMin),
        endTime: minutesToTime(slot.endMin),
        reason: slot.reason,
      });
    }
  }

  // 3. Kiểm tra các điều kiện tiên quyết nghiêm ngặt (Lỗi nặng -> Fallback)
  // Quy tắc: "Mỗi phim được chọn phải có ít nhất 1 suất"
  const scheduledMovieIds = new Set(finalSlots.map((s) => s.movieId));
  for (const m of movies) {
    if (!scheduledMovieIds.has(m.id)) {
      errors.push(`Phim "${m.title}" (ID: ${m.id}) không có suất chiếu nào sau khi AI xếp lịch.`);
      return {
        isValid: false,
        schedule: [],
        errors,
      };
    }
  }

  // Nếu lịch cuối cùng trống
  if (finalSlots.length === 0) {
    errors.push("Toàn bộ suất chiếu do AI đề xuất đều không hợp lệ.");
    return {
      isValid: false,
      schedule: [],
      errors,
    };
  }

  // Sắp xếp lại danh sách kết quả theo roomId rồi đến startTime
  finalSlots.sort((a, b) => {
    if (a.roomId !== b.roomId) return a.roomId - b.roomId;
    return a.startTime.localeCompare(b.startTime);
  });

  return {
    isValid: true,
    schedule: finalSlots,
    errors,
  };
}
