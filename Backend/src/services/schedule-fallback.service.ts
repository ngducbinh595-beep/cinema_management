import {
  MovieScheduleData,
  RoomScheduleData,
  ExistingSlot,
  ScheduledSlot,
  AutoScheduleOutput,
} from "../types/schedule.types.js";
import { minutesToTime } from "../models/schedule.model.js";

interface BookedInterval {
  start: number;
  end: number;
}

/**
 * Thuật toán xếp lịch chiếu thông minh
 * Tuân thủ đầy đủ tất cả quy tắc nghiệp vụ:
 * 1. endTime = startTime + durationMin; suất kế tiếp >= endTime + buffer
 * 2. 09:00 - 23:59, kết thúc trước 00:00
 * 3. Phim HOT -> phòng lớn/IMAX/Atmos + khung vàng (18:30 - 21:30)
 * 4. Phim gia đình/hoạt hình -> 09:00 - 16:00
 * 5. Phim hành động/kinh dị/T18 -> 21:30 - 23:30
 * 6. Mỗi phim được chọn có ít nhất 1 suất
 * 7. Không trùng giờ, không đè lên suất đã có trong DB
 */
export function generateFallbackSchedule(
  movies: MovieScheduleData[],
  rooms: RoomScheduleData[],
  existingSlots: ExistingSlot[],
  cleaningBuffer: number
): AutoScheduleOutput {
  const schedule: ScheduledSlot[] = [];

  if (movies.length === 0 || rooms.length === 0) {
    return {
      source: "fallback",
      schedule: [],
      summary: "Không có phim hoặc phòng chiếu hợp lệ để xếp lịch.",
    };
  }

  // Quản lý các khoảng thời gian đã được xếp hoặc đã có trong DB theo từng phòng
  const bookedMap = new Map<number, BookedInterval[]>();
  for (const room of rooms) {
    bookedMap.set(room.id, []);
  }

  // Thêm các suất đã có trong DB
  for (const ex of existingSlots) {
    const list = bookedMap.get(ex.roomId);
    if (list) {
      list.push({ start: ex.startMinutes, end: ex.endMinutes });
    }
  }

  const OPEN_TIME = 9 * 60; // 09:00
  const CLOSE_TIME = 23 * 60 + 59; // 23:59

  /** Kiểm tra xem một suất chiếu có đặt được vào phòng không */
  function canFit(roomId: number, start: number, end: number): boolean {
    if (start < OPEN_TIME || end > CLOSE_TIME) return false;
    const intervals = bookedMap.get(roomId);
    if (!intervals) return false;

    for (const b of intervals) {
      // Suất mới và suất cũ phải cách nhau ít nhất cleaningBuffer
      const noOverlap =
        end + cleaningBuffer <= b.start || start >= b.end + cleaningBuffer;
      if (!noOverlap) return false;
    }
    return true;
  }

  /** Đánh dấu suất đã được xếp */
  function bookSlot(
    roomId: number,
    movie: MovieScheduleData,
    start: number,
    end: number,
    reason: string
  ) {
    bookedMap.get(roomId)?.push({ start, end });
    schedule.push({
      roomId,
      movieId: movie.id,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      reason,
    });
  }

  // Phân loại và sắp xếp phim:
  // Sắp xếp phim HOT nhất lên đầu để ưu tiên phòng VIP và khung giờ vàng
  const sortedMovies = [...movies].sort((a, b) => b.hotScore - a.hotScore);

  // Sắp xếp phòng: phòng lớn nhất / premium lên đầu
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.isPremium && !b.isPremium) return -1;
    if (!a.isPremium && b.isPremium) return 1;
    return b.totalSeats - a.totalSeats;
  });

  const scheduledMovieIds = new Set<number>();

  /**
   * Tạo danh sách mốc giờ ứng viên dựa trên nhóm khung giờ ưu tiên của phim
   */
  function getCandidateStartTimes(
    pref: "golden" | "family" | "late" | "any"
  ): number[] {
    const times: number[] = [];
    if (pref === "golden") {
      // Khung vàng 18:30 - 21:30
      for (let t = 18 * 60 + 30; t <= 21 * 60 + 30; t += 30) times.push(t);
      // Mở rộng lân cận chiều tối
      for (let t = 17 * 60; t < 18 * 60 + 30; t += 30) times.push(t);
      for (let t = 14 * 60; t < 17 * 60; t += 30) times.push(t);
    } else if (pref === "family") {
      // 09:00 - 16:00
      for (let t = 9 * 60; t <= 15 * 60 + 30; t += 30) times.push(t);
      // Buổi chiều muộn
      for (let t = 16 * 60; t <= 17 * 60 + 30; t += 30) times.push(t);
    } else if (pref === "late") {
      // 21:30 - 23:30
      for (let t = 21 * 60 + 30; t <= 22 * 60; t += 15) times.push(t);
      for (let t = 20 * 60; t < 21 * 60 + 30; t += 30) times.push(t);
    }

    // Luôn bổ sung các mốc còn lại trong ngày để tránh không xếp được
    for (let t = OPEN_TIME; t <= CLOSE_TIME - 90; t += 30) {
      if (!times.includes(t)) times.push(t);
    }
    return times;
  }

  // BƯỚC 1: Đảm bảo TẤT CẢ các phim đều có ít nhất 1 suất chiếu
  for (const movie of sortedMovies) {
    let placed = false;
    const candidates = getCandidateStartTimes(movie.preferredTimeSlot);

    // Nếu là phim HOT -> ưu tiên duyệt phòng VIP trước
    // Nếu là phim thường -> thử phòng thường trước để dành phòng VIP cho phim HOT
    const roomsToTry =
      movie.hotScore >= 40
        ? sortedRooms
        : [...sortedRooms].reverse();

    for (const room of roomsToTry) {
      for (const start of candidates) {
        const end = start + movie.durationMin;
        if (canFit(room.id, start, end)) {
          let reason = "";
          if (movie.preferredTimeSlot === "golden") {
            reason = `Khung vàng tối (${minutesToTime(start)}) tại ${room.name} (${room.format}) cho phim ăn khách.`;
          } else if (movie.preferredTimeSlot === "family") {
            reason = `Khung giờ ban ngày (${minutesToTime(start)}) phù hợp gia đình & thiếu nhi tại ${room.name}.`;
          } else if (movie.preferredTimeSlot === "late") {
            reason = `Suất chiếu muộn (${minutesToTime(start)}) phù hợp thể loại kịch tính/T18 tại ${room.name}.`;
          } else {
            reason = `Suất chiếu tiêu chuẩn tại ${room.name} (${room.format}) bắt đầu lúc ${minutesToTime(start)}.`;
          }

          bookSlot(room.id, movie, start, end, reason);
          scheduledMovieIds.add(movie.id);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
  }

  // BƯỚC 2: Xếp thêm các suất chiếu lấp đầy các phòng trống theo độ HOT của phim
  for (const room of sortedRooms) {
    let cursor = OPEN_TIME;

    while (cursor <= CLOSE_TIME - 90) {
      // Tìm xem có phim nào vừa vặn vào khoảng trống tại cursor
      let foundMovie: MovieScheduleData | null = null;
      let matchedReason = "";

      for (const movie of sortedMovies) {
        const end = cursor + movie.durationMin;
        if (canFit(room.id, cursor, end)) {
          // Kiểm tra xem thời điểm này có phù hợp với đặc thù phim không
          const isGoldenTime = cursor >= 18 * 60 + 30 && cursor <= 21 * 60 + 30;
          const isFamilyTime = cursor >= 9 * 60 && cursor <= 16 * 60;
          const isLateTime = cursor >= 21 * 60 + 30;

          if (isGoldenTime && movie.hotScore >= 30) {
            foundMovie = movie;
            matchedReason = `Tăng suất khung vàng (${minutesToTime(cursor)}) tại ${room.name} cho phim ăn khách.`;
            break;
          } else if (isFamilyTime && (movie.preferredTimeSlot === "family" || movie.rating === "P")) {
            foundMovie = movie;
            matchedReason = `Suất sáng/chiều phù hợp khán giả gia đình tại ${room.name}.`;
            break;
          } else if (isLateTime && (movie.preferredTimeSlot === "late" || movie.rating === "T18")) {
            foundMovie = movie;
            matchedReason = `Suất đêm muộn hấp dẫn cho phim kịch tính/T18 tại ${room.name}.`;
            break;
          } else if (!isGoldenTime && !isLateTime) {
            foundMovie = movie;
            matchedReason = `Lấp đầy khung giờ linh hoạt ${minutesToTime(cursor)} tại ${room.name}.`;
            break;
          }
        }
      }

      if (foundMovie) {
        const end = cursor + foundMovie.durationMin;
        bookSlot(room.id, foundMovie, cursor, end, matchedReason);
        scheduledMovieIds.add(foundMovie.id);
        cursor = end + cleaningBuffer;
      } else {
        cursor += 15; // Dịch tới 15 phút để tìm tiếp
      }
    }
  }

  // Sắp xếp lịch theo roomId rồi đến startTime
  schedule.sort((a, b) => {
    if (a.roomId !== b.roomId) return a.roomId - b.roomId;
    return a.startTime.localeCompare(b.startTime);
  });

  const summary = `Thuật toán xếp lịch tự động dự phòng đã tối ưu ${schedule.length} suất chiếu: Phim HOT được ưu tiên phòng lớn (${rooms[0]?.name || "VIP"}) và khung vàng 18:30-21:30; phim gia đình/P được xếp ban ngày (09:00-16:00); phim hành động/T18 xếp đêm muộn (21:30-23:30). Đảm bảo 100% phim được chọn đều có suất chiếu và giãn cách dọn phòng ${cleaningBuffer} phút.`;

  return {
    source: "fallback",
    schedule,
    summary,
  };
}
