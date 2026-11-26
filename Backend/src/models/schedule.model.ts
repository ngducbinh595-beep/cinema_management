import { pool } from "../config/db.js";
import {
  MovieScheduleData,
  RoomScheduleData,
  ExistingSlot,
} from "../types/schedule.types.js";

/** Chuyển "HH:mm" thành số phút từ 00:00 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/** Chuyển số phút từ 00:00 thành "HH:mm" */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Lấy danh sách phim theo danh sách ID kèm doanh thu 7 ngày gần nhất và xác định độ HOT
export async function getMoviesForSchedule(
  movieIds: number[]
): Promise<MovieScheduleData[]> {
  if (!movieIds.length) return [];

  // 1. Lấy thông tin phim
  const [movieRows] = await pool.query<any[]>(
    `SELECT id, title, rating, genre, duration_min, is_featured, status
     FROM movies
     WHERE id IN (?)`,
    [movieIds]
  );

  if (!movieRows.length) return [];

  // 2. Lấy doanh thu 7 ngày gần nhất từ bookings
  const [revenueRows] = await pool.query<any[]>(
    `SELECT s.movie_id, COALESCE(SUM(b.total_price), 0) AS revenue_7d
     FROM showtimes s
     JOIN bookings b ON b.showtime_id = s.id
     WHERE b.payment_status = 'paid'
       AND b.created_at >= NOW() - INTERVAL 7 DAY
       AND s.movie_id IN (?)
     GROUP BY s.movie_id`,
    [movieIds]
  );

  const revenueMap = new Map<number, number>();
  for (const row of revenueRows) {
    revenueMap.set(Number(row.movie_id), Number(row.revenue_7d || 0));
  }

  // 3. Tính hotScore và nhóm khung giờ ưu tiên
  return movieRows.map((row) => {
    const id = Number(row.id);
    const revenue7d = revenueMap.get(id) || 0;
    const isFeatured = Boolean(row.is_featured);
    const rating = row.rating as "P" | "T13" | "T16" | "T18";
    const genre = (row.genre || "").toLowerCase();

    // Hot score: is_featured (+50 điểm) + doanh thu theo đơn vị 100k VNĐ (+1 điểm/100k)
    let hotScore = (isFeatured ? 50 : 10) + Math.min(50, Math.floor(revenue7d / 100000));

    // Xác định nhóm khung giờ theo quy tắc nghiệp vụ
    let preferredTimeSlot: "golden" | "family" | "late" | "any" = "any";

    if (
      genre.includes("hoạt hình") ||
      genre.includes("gia đình") ||
      rating === "P"
    ) {
      preferredTimeSlot = "family"; // 09:00 - 16:00
    } else if (
      rating === "T18" ||
      genre.includes("hành động") ||
      genre.includes("kinh dị") ||
      genre.includes("giật gân")
    ) {
      preferredTimeSlot = "late"; // 21:30 - 23:30 (hoặc tối muộn)
    }

    // Nếu phim là Featured hoặc có điểm Hot cao -> ưu tiên khung vàng (18:30 - 21:30)
    if (isFeatured || hotScore >= 40) {
      if (preferredTimeSlot !== "family") {
        preferredTimeSlot = "golden";
      }
    }

    return {
      id,
      title: row.title,
      rating,
      genre: row.genre,
      durationMin: Number(row.duration_min),
      isFeatured,
      revenue7d,
      hotScore,
      preferredTimeSlot,
    };
  });
}

/**
 * Lấy danh sách phòng chiếu đang hoạt động
 */
export async function getRoomsForSchedule(
  roomIds?: number[]
): Promise<RoomScheduleData[]> {
  let query = `
    SELECT id, cinema_id, name, total_seats, format, audio, status
    FROM rooms
    WHERE status = 'active'
  `;
  const params: any[] = [];

  if (roomIds && roomIds.length > 0) {
    query += ` AND id IN (?)`;
    params.push(roomIds);
  }

  query += ` ORDER BY total_seats DESC, id ASC`;

  const [rows] = await pool.query<any[]>(query, params);

  return rows.map((r) => {
    const formatUpper = (r.format || "").toUpperCase();
    const audioUpper = (r.audio || "").toUpperCase();
    const isPremium =
      formatUpper.includes("IMAX") ||
      formatUpper.includes("4DX") ||
      audioUpper.includes("DOLBY ATMOS") ||
      Number(r.total_seats) >= 120;

    return {
      id: Number(r.id),
      cinemaId: Number(r.cinema_id),
      name: r.name,
      totalSeats: Number(r.total_seats),
      format: r.format,
      audio: r.audio,
      isPremium,
    };
  });
}

// Lấy các suất chiếu đã tồn tại trong DB cùng ngày để tránh bị trùng lịch
export async function getExistingShowtimes(
  date: string,
  roomIds?: number[]
): Promise<ExistingSlot[]> {
  let query = `
    SELECT id, room_id, movie_id,
           DATE_FORMAT(start_time, '%H:%i') AS start_time_str,
           DATE_FORMAT(end_time, '%H:%i') AS end_time_str
    FROM showtimes
    WHERE status != 'cancelled'
      AND DATE(start_time) = ?
  `;
  const params: any[] = [date];

  if (roomIds && roomIds.length > 0) {
    query += ` AND room_id IN (?)`;
    params.push(roomIds);
  }

  const [rows] = await pool.query<any[]>(query, params);

  return rows.map((r) => {
    const startStr = r.start_time_str || "00:00";
    const endStr = r.end_time_str || "00:00";
    return {
      id: Number(r.id),
      roomId: Number(r.room_id),
      movieId: Number(r.movie_id),
      startMinutes: timeToMinutes(startStr),
      endMinutes: timeToMinutes(endStr),
      startTimeStr: startStr,
      endTimeStr: endStr,
    };
  });
}
