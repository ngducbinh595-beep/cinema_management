import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type SeatCategory = "regular" | "vip" | "sweetbox";

export interface SeatCalculation {
  seatCode: string;
  type: SeatCategory;
  price: number;
}

export interface PriceBreakdown {
  regularCount: number;
  regularPrice: number;
  regularTotal: number;
  vipCount: number;
  vipPrice: number;
  vipTotal: number;
  sweetboxCount: number;
  sweetboxPrice: number;
  sweetboxTotal: number;
}

export interface LockResult {
  success: boolean;
  message: string;
  showtimeId: number;
  lockedSeats: string[];
  totalPrice: number;
  breakdown: PriceBreakdown;
  expiresInSeconds: number;
  expiresAt: string;
  conflictingSeats?: string[];
}

export interface ShowtimeSlotInfo {
  showtimeId: number;
  movieId: number;
  movieTitle: string;
  roomId: number;
  roomName: string;
  cinemaId: number;
  cinemaName: string;
  cinemaAddress: string;
  cinemaPhone: string;
  startTime: string;
  endTime: string;
  showDate: string;
  dateISO: string;
  rowsCount: number;
  colsCount: number;
  vipRows: string;
  format: string;
  priceRegular: number;
  priceVip: number;
  priceSweetbox: number;
  totalSeats: number;
  bookedCount: number;
  lockedCount: number;
  availableSeats: number;
}

export interface OccupiedSeatsResult {
  showtimeId: number;
  bookedSeats: string[];
  lockedByOthers: string[];
  myLockedSeats: string[];
  expiresInSeconds: number;
  totalSeats: number;
  availableSeats: number;
  roomName: string;
  cinemaName: string;
  cinemaAddress: string;
  cinemaPhone: string;
  startTime: string;
  endTime: string;
  showDate: string;
  rowsCount: number;
  colsCount: number;
  vipRows: string;
  priceRegular: number;
  priceVip: number;
  priceSweetbox: number;
  format: string;
}

const DEFAULT_SLOT_TIMES = ["09:30", "14:00", "16:45", "19:30", "21:50"];

// Các mẫu ghế đã đặt khác nhau cho dữ liệu mẫu ban đầu (nếu bảng booking_seats đang trống)
const SAMPLE_BOOKING_SEAT_PATTERNS: string[][] = [
  ["C5", "C6", "D5", "D6", "D7", "D8", "E6", "E7", "F6", "F7"],
  ["B6", "B7", "C8", "C9", "E4", "E5"],
  ["B4", "B5", "C6", "C7", "C8", "D5", "D6", "D7", "D8", "E6", "E7", "E8", "E9", "F5", "F6", "G7", "G8"],
  ["C4", "C5", "D9", "D10", "F4", "F5", "F6", "G8", "G9"],
  ["A6", "A7", "B8", "B9", "D6", "D7", "E7", "E8", "E9", "F8", "F9", "G5", "G6"],
  ["B3", "B4", "C3", "C4", "E5", "E6"],
  ["D7", "D8", "D9", "E7", "E8", "E9", "E10", "F7", "F8", "F9", "F10", "G7", "G8", "H8", "H9"],
  ["C6", "C7", "E5", "E6", "F5", "F6", "G9", "G10", "G11", "H10", "H11"],
];

/** Chuyển đổi ngày linh hoạt ("2026-10-24", "24/10/2026", "Thứ Bảy, 24/10/2026") sang YYYY-MM-DD */
export function parseFlexibleDateToISO(rawDate?: string): string {
  const input = (rawDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  const dmyMatch = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, "0");
    const mm = dmyMatch[2].padStart(2, "0");
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMinutesToTimeStr(timeHHMM: string, durationMin: number): string {
  const [hh, mm] = timeHHMM.split(":").map((n) => parseInt(n, 10) || 0);
  const total = Math.min(hh * 60 + mm + durationMin, 23 * 60 + 59);
  const endH = String(Math.floor(total / 60)).padStart(2, "0");
  const endM = String(total % 60).padStart(2, "0");
  return `${endH}:${endM}`;
}

export function classifySeatForRoom(
  seatCode: string,
  rowsCount: number,
  vipRowsStr: string | null | undefined
): SeatCategory {
  const row = (seatCode.trim()[0] || "A").toUpperCase();
  const lastRowChar = String.fromCharCode(65 + Math.max(0, rowsCount - 1));
  if (rowsCount >= 8 && row === lastRowChar) {
    return "sweetbox";
  }
  const vipSet = new Set(
    (vipRowsStr || "E,F,G")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
  if (vipSet.has(row)) {
    return "vip";
  }
  return "regular";
}

// 1. Khởi tạo bảng seat_locks trong MySQL và seed booking_seats mẫu nếu DB cũ chưa có dữ liệu ghế
export async function initSeatLocksTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS seat_locks (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      showtime_id INT UNSIGNED NOT NULL,
      seat_code VARCHAR(10) NOT NULL,
      user_id INT UNSIGNED DEFAULT NULL,
      session_id VARCHAR(100) NOT NULL,
      seat_type VARCHAR(20) NOT NULL DEFAULT 'regular',
      price DECIMAL(10,0) NOT NULL DEFAULT 90000,
      locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      UNIQUE KEY uq_showtime_seat (showtime_id, seat_code),
      INDEX idx_showtime (showtime_id),
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await pool.query(query);
    await pool.query(
      "ALTER TABLE seat_locks MODIFY COLUMN seat_type VARCHAR(20) NOT NULL DEFAULT 'regular'"
    ).catch(() => {});
    await seedSampleBookingSeatsIfEmpty();
  } catch (err) {
    console.error("Lỗi khởi tạo bảng seat_locks:", err);
  }
}

async function seedSampleBookingSeatsIfEmpty(): Promise<void> {
  try {
    const [countRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM booking_seats"
    );
    if (Number(countRows[0]?.cnt || 0) > 0) return;

    const [bookingRows] = await pool.query<RowDataPacket[]>(
      `SELECT b.id AS booking_id, b.showtime_id, s.room_id, r.rows_count, r.cols_count, r.vip_rows
       FROM bookings b
       JOIN showtimes s ON b.showtime_id = s.id
       JOIN rooms r ON s.room_id = r.id
       WHERE b.status <> 'cancelled' AND b.payment_status = 'paid'
       ORDER BY b.id ASC`
    );

    for (let i = 0; i < bookingRows.length; i++) {
      const b = bookingRows[i];
      const rowsCount = Number(b.rows_count) || 7;
      const colsCount = Number(b.cols_count) || 14;
      const pattern = SAMPLE_BOOKING_SEAT_PATTERNS[i % SAMPLE_BOOKING_SEAT_PATTERNS.length];

      for (const code of pattern) {
        const rowLabel = code[0].toUpperCase();
        const colNum = parseInt(code.slice(1), 10);
        const rowIndex = rowLabel.charCodeAt(0) - 65;
        if (rowIndex < 0 || rowIndex >= rowsCount || isNaN(colNum) || colNum < 1 || colNum > colsCount) {
          continue;
        }

        const seatType = classifySeatForRoom(code, rowsCount, b.vip_rows);
        await pool.query(
          `INSERT IGNORE INTO seats (room_id, row_label, col_number, seat_type)
           VALUES (?, ?, ?, ?)`,
          [b.room_id, rowLabel, colNum, seatType]
        );

        const [seatRows] = await pool.query<RowDataPacket[]>(
          "SELECT id FROM seats WHERE room_id = ? AND row_label = ? AND col_number = ? LIMIT 1",
          [b.room_id, rowLabel, colNum]
        );
        if (seatRows[0]?.id) {
          await pool.query(
            "INSERT IGNORE INTO booking_seats (booking_id, seat_id) VALUES (?, ?)",
            [b.booking_id, seatRows[0].id]
          );
        }
      }
    }
  } catch (err) {
    console.error("Lỗi khởi tạo dữ liệu mẫu booking_seats:", err);
  }
}

// 2. Tự động dọn dẹp các ghế bị khóa đã hết hạn (> 5 phút)
export async function cleanupExpiredLocks(): Promise<void> {
  try {
    await pool.query("DELETE FROM seat_locks WHERE expires_at < NOW()");
  } catch (err) {
    console.error("Lỗi xóa ghế lock hết hạn:", err);
  }
}

// 3. Lấy danh sách suất chiếu của 1 phim theo rạp & ngày kèm số ghế trống riêng từng suất
export async function getMovieShowtimeSlots(params: {
  movieId?: number;
  movieTitle?: string;
  cinemaId?: number;
  cinemaName?: string;
  date?: string;
  sessionId?: string;
  requestedTime?: string;
  ensureSlots?: boolean;
}): Promise<ShowtimeSlotInfo[]> {
  await cleanupExpiredLocks();

  const dateISO = parseFlexibleDateToISO(params.date);
  const sessionId = params.sessionId || "";

  // Tìm phim
  let movieRow: RowDataPacket | null = null;
  if (params.movieId && params.movieId > 0) {
    const [mRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, title, duration_min, format FROM movies WHERE id = ? LIMIT 1",
      [params.movieId]
    );
    movieRow = mRows[0] || null;
  }
  if (!movieRow && params.movieTitle) {
    const [mRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, title, duration_min, format FROM movies WHERE LOWER(title) = LOWER(?) LIMIT 1",
      [params.movieTitle.trim()]
    );
    movieRow = mRows[0] || null;
  }
  if (!movieRow) {
    const [mRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, title, duration_min, format FROM movies ORDER BY id ASC LIMIT 1"
    );
    movieRow = mRows[0] || null;
  }
  if (!movieRow) return [];

  // Tìm rạp
  let cinemaRow: RowDataPacket | null = null;
  if (params.cinemaId && params.cinemaId > 0) {
    const [cRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, address, district, city, phone FROM cinemas WHERE id = ? LIMIT 1",
      [params.cinemaId]
    );
    cinemaRow = cRows[0] || null;
  }
  if (!cinemaRow && params.cinemaName) {
    const [cRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, address, district, city, phone FROM cinemas WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [params.cinemaName.trim()]
    );
    cinemaRow = cRows[0] || null;
  }
  if (!cinemaRow) {
    const [cRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, address, district, city, phone FROM cinemas ORDER BY id ASC LIMIT 1"
    );
    cinemaRow = cRows[0] || null;
  }
  if (!cinemaRow) return [];

  const [roomRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM rooms WHERE cinema_id = ? AND status = 'active' ORDER BY id ASC",
    [cinemaRow.id]
  );

  // Kiểm tra các suất chiếu hiện có trong DB cho (movie, cinema, date)
  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, DATE_FORMAT(s.start_time, '%H:%i') AS start_str
     FROM showtimes s
     JOIN rooms r ON r.id = s.room_id
     WHERE s.movie_id = ? AND r.cinema_id = ? AND DATE(s.start_time) = ? AND s.status <> 'cancelled'
     ORDER BY s.start_time ASC`,
    [movieRow.id, cinemaRow.id, dateISO]
  );

  const shouldEnsure = params.ensureSlots !== false && roomRows.length > 0;
  const reqTime =
    params.requestedTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(params.requestedTime.trim())
      ? params.requestedTime.trim()
      : null;

  if (shouldEnsure) {
    const existingTimes = existingRows.map((r) => String(r.start_str));
    const candidateTimes = [...DEFAULT_SLOT_TIMES];
    if (reqTime && !candidateTimes.includes(reqTime)) {
      candidateTimes.push(reqTime);
    }

    const needMoreBaseSlots = existingTimes.length < 4;
    const durationMin = Number(movieRow.duration_min) || 115;

    for (let idx = 0; idx < candidateTimes.length; idx++) {
      const slotTime = candidateTimes[idx];
      const isExplicitlyRequested = reqTime === slotTime;

      if (!needMoreBaseSlots && !isExplicitlyRequested) continue;
      if (existingTimes.includes(slotTime)) continue;

      // Nếu không phải giờ người dùng vừa click đích danh, tránh tạo sát giờ đã có (< 45 phút)
      if (!isExplicitlyRequested) {
        const [sh, sm] = slotTime.split(":").map(Number);
        const slotMins = sh * 60 + sm;
        const tooClose = existingTimes.some((et) => {
          const [eh, em] = et.split(":").map(Number);
          return Math.abs(eh * 60 + em - slotMins) < 45;
        });
        if (tooClose) continue;
      }

      const endTime = addMinutesToTimeStr(slotTime, durationMin);
      const startDT = `${dateISO} ${slotTime}:00`;
      const endDT = `${dateISO} ${endTime}:00`;

      // Chọn phòng chưa bị trùng lịch tại thời điểm này trong cụm rạp
      let chosenRoom = roomRows[idx % roomRows.length];
      for (const candidateRoom of roomRows) {
        const [overlap] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM showtimes
           WHERE room_id = ? AND DATE(start_time) = ? AND status <> 'cancelled'
             AND start_time < ? AND end_time > ?
           LIMIT 1`,
          [candidateRoom.id, dateISO, endDT, startDT]
        );
        if (overlap.length === 0) {
          chosenRoom = candidateRoom;
          break;
        }
      }

      const isImaxOr4dx = ["IMAX", "4DX", "VIP Lounge"].includes(String(chosenRoom.format));
      const priceRegular = isImaxOr4dx ? 120000 : 90000;
      const priceVip = isImaxOr4dx ? 160000 : 120000;
      const roomFormat = `${chosenRoom.format || "2D"} ${chosenRoom.audio || "Dolby Atmos"}`.trim();

      await pool.query(
        `INSERT INTO showtimes (movie_id, room_id, start_time, end_time, price_regular, price_vip, format, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [movieRow.id, chosenRoom.id, startDT, endDT, priceRegular, priceVip, roomFormat]
      );
      existingTimes.push(slotTime);
    }
  }

  // Truy vấn danh sách đầy đủ các suất chiếu kèm số ghế đã bán & đang giữ riêng cho từng suất
  const [fullRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id AS showtime_id,
       s.movie_id,
       m.title AS movie_title,
       s.room_id,
       r.name AS room_name,
       r.rows_count,
       r.cols_count,
       r.vip_rows,
       c.id AS cinema_id,
       c.name AS cinema_name,
       CONCAT_WS(', ', c.address, c.district, c.city) AS cinema_address,
       COALESCE(c.phone, '0123 456 789') AS cinema_phone,
       DATE_FORMAT(s.start_time, '%H:%i') AS start_time_str,
       DATE_FORMAT(s.end_time, '%H:%i') AS end_time_str,
       DATE_FORMAT(s.start_time, '%d/%m/%Y') AS show_date_str,
       DATE_FORMAT(s.start_time, '%Y-%m-%d') AS date_iso,
       s.price_regular,
       s.price_vip,
       s.format,
       (
         SELECT COUNT(DISTINCT bs.seat_id)
         FROM booking_seats bs
         JOIN bookings b ON bs.booking_id = b.id
         WHERE b.showtime_id = s.id
           AND b.status <> 'cancelled'
           AND b.payment_status <> 'refunded'
       ) AS booked_count,
       (
         SELECT COUNT(DISTINCT sl.seat_code)
         FROM seat_locks sl
         WHERE sl.showtime_id = s.id
           AND sl.expires_at > NOW()
           AND sl.session_id <> ?
       ) AS locked_count
     FROM showtimes s
     JOIN movies m ON m.id = s.movie_id
     JOIN rooms r ON r.id = s.room_id
     JOIN cinemas c ON c.id = r.cinema_id
     WHERE s.movie_id = ?
       AND r.cinema_id = ?
       AND DATE(s.start_time) = ?
       AND s.status <> 'cancelled'
     ORDER BY s.start_time ASC, s.id ASC`,
    [sessionId, movieRow.id, cinemaRow.id, dateISO]
  );

  return fullRows.map((r) => {
    const rowsCount = Number(r.rows_count) || 8;
    const colsCount = Number(r.cols_count) || 14;
    const totalSeats = rowsCount * colsCount;
    const bookedCount = Number(r.booked_count) || 0;
    const lockedCount = Number(r.locked_count) || 0;
    const priceRegular = Number(r.price_regular) || 90000;
    const priceVip = Number(r.price_vip) || 120000;
    const availableSeats = Math.max(0, totalSeats - bookedCount - lockedCount);

    return {
      showtimeId: Number(r.showtime_id),
      movieId: Number(r.movie_id),
      movieTitle: String(r.movie_title),
      roomId: Number(r.room_id),
      roomName: String(r.room_name),
      cinemaId: Number(r.cinema_id),
      cinemaName: String(r.cinema_name),
      cinemaAddress: String(r.cinema_address || ""),
      cinemaPhone: String(r.cinema_phone || "0123 456 789"),
      startTime: String(r.start_time_str),
      endTime: String(r.end_time_str),
      showDate: String(r.show_date_str),
      dateISO: String(r.date_iso),
      rowsCount,
      colsCount,
      vipRows: String(r.vip_rows || "E,F,G"),
      format: String(r.format || "2D Dolby Atmos"),
      priceRegular,
      priceVip,
      priceSweetbox: priceVip + 40000,
      totalSeats,
      bookedCount,
      lockedCount,
      availableSeats,
    };
  });
}

// 4. Lịch chiếu toàn cụm rạp theo ngày kèm số ghế trống thực tế của từng suất (dùng cho ShowtimesPage)
export async function getCinemaScheduleByDate(params: {
  cinemaName?: string;
  cinemaId?: number;
  date?: string;
}): Promise<{
  cinemaId: number;
  cinemaName: string;
  cinemaAddress: string;
  dateISO: string;
  slotsByMovie: Record<
    string,
    Array<{
      showtimeId: number | null;
      startTime: string;
      endTime: string;
      roomName: string;
      format: string;
      category: "2D" | "IMAX";
      priceRegular: number;
      totalSeats: number;
      availableSeats: number;
    }>
  >;
}> {
  await cleanupExpiredLocks();
  const dateISO = parseFlexibleDateToISO(params.date);

  let cinemaRow: RowDataPacket | null = null;
  if (params.cinemaId && params.cinemaId > 0) {
    const [cRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, address, district, city FROM cinemas WHERE id = ? LIMIT 1",
      [params.cinemaId]
    );
    cinemaRow = cRows[0] || null;
  }
  if (!cinemaRow && params.cinemaName) {
    const [cRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, address, district, city FROM cinemas WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [params.cinemaName.trim()]
    );
    cinemaRow = cRows[0] || null;
  }
  if (!cinemaRow) {
    const [cRows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, address, district, city FROM cinemas ORDER BY id ASC LIMIT 1"
    );
    cinemaRow = cRows[0] || null;
  }

  if (!cinemaRow) {
    return {
      cinemaId: 1,
      cinemaName: params.cinemaName || "Cinema Nguyễn Du",
      cinemaAddress: "135 Nguyễn Du, Bến Thành, Quận 1, TP. Hồ Chí Minh",
      dateISO,
      slotsByMovie: {},
    };
  }

  const [movies] = await pool.query<RowDataPacket[]>(
    "SELECT id, title, duration_min FROM movies WHERE status = 'now_showing' ORDER BY id ASC"
  );
  const [rooms] = await pool.query<RowDataPacket[]>(
    "SELECT id, name, format, audio, rows_count, cols_count FROM rooms WHERE cinema_id = ? AND status = 'active' ORDER BY id ASC",
    [cinemaRow.id]
  );

  const [dbShowtimes] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id AS showtime_id,
       s.movie_id,
       m.title AS movie_title,
       r.name AS room_name,
       r.format AS room_format,
       r.rows_count,
       r.cols_count,
       DATE_FORMAT(s.start_time, '%H:%i') AS start_time_str,
       DATE_FORMAT(s.end_time, '%H:%i') AS end_time_str,
       s.price_regular,
       s.format,
       (
         SELECT COUNT(DISTINCT bs.seat_id)
         FROM booking_seats bs
         JOIN bookings b ON bs.booking_id = b.id
         WHERE b.showtime_id = s.id
           AND b.status <> 'cancelled'
           AND b.payment_status <> 'refunded'
       ) AS booked_count,
       (
         SELECT COUNT(DISTINCT sl.seat_code)
         FROM seat_locks sl
         WHERE sl.showtime_id = s.id
           AND sl.expires_at > NOW()
       ) AS locked_count
     FROM showtimes s
     JOIN movies m ON m.id = s.movie_id
     JOIN rooms r ON r.id = s.room_id
     WHERE r.cinema_id = ?
       AND DATE(s.start_time) = ?
       AND s.status <> 'cancelled'
     ORDER BY s.start_time ASC`,
    [cinemaRow.id, dateISO]
  );

  const regularRooms = rooms.filter((r) => String(r.format).toUpperCase() !== "IMAX");
  const imaxRooms = rooms.filter((r) => String(r.format).toUpperCase() === "IMAX");
  const fallbackRoom = rooms[0] || { name: "Phòng 01", rows_count: 7, cols_count: 14, format: "2D" };

  const slotsByMovie: Record<
    string,
    Array<{
      showtimeId: number | null;
      startTime: string;
      endTime: string;
      roomName: string;
      format: string;
      category: "2D" | "IMAX";
      priceRegular: number;
      totalSeats: number;
      availableSeats: number;
    }>
  > = {};

  for (let mIdx = 0; mIdx < movies.length; mIdx++) {
    const movie = movies[mIdx];
    const title = String(movie.title);
    const durationMin = Number(movie.duration_min) || 115;

    const movieDbRows = dbShowtimes.filter((r) => Number(r.movie_id) === Number(movie.id));
    const list: Array<{
      showtimeId: number | null;
      startTime: string;
      endTime: string;
      roomName: string;
      format: string;
      category: "2D" | "IMAX";
      priceRegular: number;
      totalSeats: number;
      availableSeats: number;
    }> = [];

    for (const row of movieDbRows) {
      const totalSeats = (Number(row.rows_count) || 8) * (Number(row.cols_count) || 14);
      const occupied = (Number(row.booked_count) || 0) + (Number(row.locked_count) || 0);
      const isImax =
        String(row.format || "").toUpperCase().includes("IMAX") ||
        String(row.room_format || "").toUpperCase() === "IMAX";
      list.push({
        showtimeId: Number(row.showtime_id),
        startTime: String(row.start_time_str),
        endTime: String(row.end_time_str),
        roomName: String(row.room_name),
        format: String(row.format || "2D Dolby Atmos"),
        category: isImax ? "IMAX" : "2D",
        priceRegular: Number(row.price_regular) || (isImax ? 120000 : 90000),
        totalSeats,
        availableSeats: Math.max(0, totalSeats - occupied),
      });
    }

    // Bổ sung khung giờ tiêu chuẩn nếu phim chưa có đủ lịch trong DB ngày này
    for (let tIdx = 0; tIdx < DEFAULT_SLOT_TIMES.length; tIdx++) {
      const slotTime = DEFAULT_SLOT_TIMES[tIdx];
      const alreadyHas = list.some((s) => s.startTime === slotTime);
      if (alreadyHas) continue;
      if (list.filter((s) => s.category === "2D").length >= 5) continue;

      const roomPool = regularRooms.length > 0 ? regularRooms : [fallbackRoom];
      const assignedRoom = roomPool[(mIdx + tIdx) % roomPool.length];
      const totalSeats =
        (Number(assignedRoom.rows_count) || 7) * (Number(assignedRoom.cols_count) || 14);

      list.push({
        showtimeId: null,
        startTime: slotTime,
        endTime: addMinutesToTimeStr(slotTime, durationMin),
        roomName: String(assignedRoom.name),
        format: "2D Dolby Atmos",
        category: "2D",
        priceRegular: 90000,
        totalSeats,
        availableSeats: totalSeats,
      });
    }

    // Nếu rạp có phòng IMAX và phim nổi bật, hiển thị thêm các khung giờ IMAX
    const hasImaxMovie =
      title.includes("Tín hiệu") || title.includes("Qua miền") || title.includes("Thành phố");
    if (hasImaxMovie && imaxRooms.length > 0) {
      const imaxTimes = ["10:30", "15:15", "19:15"];
      for (let iIdx = 0; iIdx < imaxTimes.length; iIdx++) {
        const iTime = imaxTimes[iIdx];
        if (list.some((s) => s.startTime === iTime && s.category === "IMAX")) continue;
        const iRoom = imaxRooms[iIdx % imaxRooms.length];
        const totalSeats = (Number(iRoom.rows_count) || 9) * (Number(iRoom.cols_count) || 16);
        list.push({
          showtimeId: null,
          startTime: iTime,
          endTime: addMinutesToTimeStr(iTime, durationMin),
          roomName: String(iRoom.name),
          format: "IMAX Dolby Atmos",
          category: "IMAX",
          priceRegular: 120000,
          totalSeats,
          availableSeats: totalSeats,
        });
      }
    }

    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    slotsByMovie[title] = list;
  }

  return {
    cinemaId: Number(cinemaRow.id),
    cinemaName: String(cinemaRow.name),
    cinemaAddress: [cinemaRow.address, cinemaRow.district, cinemaRow.city].filter(Boolean).join(", "),
    dateISO,
    slotsByMovie,
  };
}

// 5. Lấy danh sách ghế đã bán và ghế đang bị người khác giữ chỗ RIÊNG cho từng showtimeId
export async function getOccupiedSeats(
  showtimeId: number,
  sessionId: string
): Promise<OccupiedSeatsResult> {
  await cleanupExpiredLocks();

  // Thông tin phòng & suất chiếu của đúng showtimeId này
  const [metaRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id AS showtime_id,
       r.name AS room_name,
       r.rows_count,
       r.cols_count,
       r.vip_rows,
       c.name AS cinema_name,
       CONCAT_WS(', ', c.address, c.district, c.city) AS cinema_address,
       COALESCE(c.phone, '0123 456 789') AS cinema_phone,
       DATE_FORMAT(s.start_time, '%H:%i') AS start_time_str,
       DATE_FORMAT(s.end_time, '%H:%i') AS end_time_str,
       DATE_FORMAT(s.start_time, '%d/%m/%Y') AS show_date_str,
       s.price_regular,
       s.price_vip,
       s.format
     FROM showtimes s
     JOIN rooms r ON r.id = s.room_id
     JOIN cinemas c ON c.id = r.cinema_id
     WHERE s.id = ?
     LIMIT 1`,
    [showtimeId]
  );

  const meta = metaRows[0];
  const rowsCount = Number(meta?.rows_count) || 8;
  const colsCount = Number(meta?.cols_count) || 14;
  const vipRows = String(meta?.vip_rows || "E,F,G");
  const priceRegular = Number(meta?.price_regular) || 90000;
  const priceVip = Number(meta?.price_vip) || 120000;
  const priceSweetbox = priceVip + 40000;
  const totalSeats = rowsCount * colsCount;

  // Ghế thực tế đã bán của ĐÚNG suất chiếu showtimeId trong MySQL
  const [soldRows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT CONCAT(se.row_label, se.col_number) AS seat_code
     FROM booking_seats bs
     JOIN bookings b ON bs.booking_id = b.id
     JOIN seats se ON bs.seat_id = se.id
     WHERE b.showtime_id = ?
       AND b.status <> 'cancelled'
       AND b.payment_status <> 'refunded'`,
    [showtimeId]
  );
  const bookedSeats = soldRows.map((r) => String(r.seat_code));

  // Ghế đang bị khóa tạm thời bởi phiên người dùng khác trên suất chiếu này
  const [otherLocks] = await pool.query<RowDataPacket[]>(
    "SELECT seat_code FROM seat_locks WHERE showtime_id = ? AND expires_at > NOW() AND session_id != ?",
    [showtimeId, sessionId]
  );
  const lockedByOthers = otherLocks.map((r) => String(r.seat_code));

  // Ghế đang được giữ bởi chính phiên hiện tại trên suất chiếu này
  const [myLocks] = await pool.query<RowDataPacket[]>(
    "SELECT seat_code, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS remaining_seconds FROM seat_locks WHERE showtime_id = ? AND expires_at > NOW() AND session_id = ?",
    [showtimeId, sessionId]
  );
  const myLockedSeats = myLocks.map((r) => String(r.seat_code));
  const expiresInSeconds =
    myLocks.length > 0 ? Math.max(0, Number(myLocks[0].remaining_seconds) || 0) : 0;

  const occupiedByOthersSet = new Set([...bookedSeats, ...lockedByOthers]);
  const availableSeats = Math.max(0, totalSeats - occupiedByOthersSet.size);

  return {
    showtimeId,
    bookedSeats,
    lockedByOthers,
    myLockedSeats,
    expiresInSeconds,
    totalSeats,
    availableSeats,
    roomName: String(meta?.room_name || "Phòng 01"),
    cinemaName: String(meta?.cinema_name || "Cinema Nguyễn Du"),
    cinemaAddress: String(meta?.cinema_address || "135 Nguyễn Du, Bến Thành, Quận 1, TP. Hồ Chí Minh"),
    cinemaPhone: String(meta?.cinema_phone || "0123 456 789"),
    startTime: String(meta?.start_time_str || "19:30"),
    endTime: String(meta?.end_time_str || "21:28"),
    showDate: String(meta?.show_date_str || "24/10/2026"),
    rowsCount,
    colsCount,
    vipRows,
    priceRegular,
    priceVip,
    priceSweetbox,
    format: String(meta?.format || "2D Dolby Atmos"),
  };
}

// 6. Khóa ghế tạm thời trong 5 phút & tự động tính chi phí theo đúng phòng và suất chiếu
export async function lockSeatsWithPriceCalculation(params: {
  showtimeId: number;
  seats: string[];
  userId?: number;
  sessionId: string;
  regularPrice?: number;
  vipPrice?: number;
}): Promise<LockResult> {
  const { showtimeId, seats, userId, sessionId } = params;

  await cleanupExpiredLocks();

  // Lấy cấu hình phòng & giá vé của suất chiếu
  const [stRows] = await pool.query<RowDataPacket[]>(
    `SELECT s.price_regular, s.price_vip, r.rows_count, r.vip_rows
     FROM showtimes s
     JOIN rooms r ON r.id = s.room_id
     WHERE s.id = ?
     LIMIT 1`,
    [showtimeId]
  );
  const stMeta = stRows[0];
  const rowsCount = Number(stMeta?.rows_count) || 8;
  const vipRows = String(stMeta?.vip_rows || "E,F,G");
  const regularPrice = Number(stMeta?.price_regular) || params.regularPrice || 90000;
  const vipPrice = Number(stMeta?.price_vip) || params.vipPrice || 120000;
  const sweetboxPrice = vipPrice + 40000;

  const emptyBreakdown: PriceBreakdown = {
    regularCount: 0,
    regularPrice,
    regularTotal: 0,
    vipCount: 0,
    vipPrice,
    vipTotal: 0,
    sweetboxCount: 0,
    sweetboxPrice,
    sweetboxTotal: 0,
  };

  // Hủy chọn toàn bộ ghế -> giải phóng ghế của phiên này trên suất chiếu này
  if (!seats || seats.length === 0) {
    await pool.query(
      "DELETE FROM seat_locks WHERE showtime_id = ? AND session_id = ?",
      [showtimeId, sessionId]
    );
    return {
      success: true,
      message: "Đã giải phóng toàn bộ ghế được chọn.",
      showtimeId,
      lockedSeats: [],
      totalPrice: 0,
      breakdown: emptyBreakdown,
      expiresInSeconds: 0,
      expiresAt: new Date().toISOString(),
    };
  }

  const normalizedSeats = Array.from(new Set(seats.map((s) => s.trim().toUpperCase()).filter(Boolean)));

  // 1a. Kiểm tra ghế đã bán trong booking_seats của suất chiếu này
  const [soldConflicts] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT CONCAT(se.row_label, se.col_number) AS seat_code
     FROM booking_seats bs
     JOIN bookings b ON bs.booking_id = b.id
     JOIN seats se ON bs.seat_id = se.id
     WHERE b.showtime_id = ?
       AND b.status <> 'cancelled'
       AND b.payment_status <> 'refunded'
       AND CONCAT(se.row_label, se.col_number) IN (?)`,
    [showtimeId, normalizedSeats]
  );

  // 1b. Kiểm tra ghế đang bị người khác giữ chỗ trên suất chiếu này
  const [lockConflicts] = await pool.query<RowDataPacket[]>(
    `SELECT seat_code FROM seat_locks
     WHERE showtime_id = ? AND expires_at > NOW() AND session_id != ? AND seat_code IN (?)`,
    [showtimeId, sessionId, normalizedSeats]
  );

  const conflictSet = new Set<string>([
    ...soldConflicts.map((r) => String(r.seat_code)),
    ...lockConflicts.map((r) => String(r.seat_code)),
  ]);

  if (conflictSet.size > 0) {
    const conflictingSeats = Array.from(conflictSet);
    return {
      success: false,
      message: `Ghế [${conflictingSeats.join(", ")}] đã có người đặt hoặc giữ chỗ ở suất chiếu này. Vui lòng chọn ghế khác!`,
      showtimeId,
      lockedSeats: [],
      totalPrice: 0,
      breakdown: emptyBreakdown,
      expiresInSeconds: 0,
      expiresAt: new Date().toISOString(),
      conflictingSeats,
    };
  }

  // 2. Phân loại ghế & tính tổng tiền chính xác
  let regularCount = 0;
  let vipCount = 0;
  let sweetboxCount = 0;

  const seatDetails: SeatCalculation[] = normalizedSeats.map((seat) => {
    const category = classifySeatForRoom(seat, rowsCount, vipRows);
    if (category === "sweetbox") {
      sweetboxCount++;
      return { seatCode: seat, type: "sweetbox", price: sweetboxPrice };
    }
    if (category === "vip") {
      vipCount++;
      return { seatCode: seat, type: "vip", price: vipPrice };
    }
    regularCount++;
    return { seatCode: seat, type: "regular", price: regularPrice };
  });

  const regularTotal = regularCount * regularPrice;
  const vipTotal = vipCount * vipPrice;
  const sweetboxTotal = sweetboxCount * sweetboxPrice;
  const totalPrice = regularTotal + vipTotal + sweetboxTotal;

  // 3. Cập nhật lại các ghế lock của session này trên đúng suất chiếu hiện tại
  await pool.query(
    "DELETE FROM seat_locks WHERE showtime_id = ? AND session_id = ?",
    [showtimeId, sessionId]
  );

  const lockQueries = seatDetails.map((s) =>
    pool.query(
      `INSERT INTO seat_locks (showtime_id, seat_code, user_id, session_id, seat_type, price, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         session_id = VALUES(session_id),
         seat_type = VALUES(seat_type),
         price = VALUES(price),
         expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)`,
      [showtimeId, s.seatCode, userId || null, sessionId, s.type, s.price]
    )
  );
  await Promise.all(lockQueries);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  return {
    success: true,
    message: `Đã giữ chỗ thành công ${normalizedSeats.length} ghế trong 5 phút.`,
    showtimeId,
    lockedSeats: normalizedSeats,
    totalPrice,
    breakdown: {
      regularCount,
      regularPrice,
      regularTotal,
      vipCount,
      vipPrice,
      vipTotal,
      sweetboxCount,
      sweetboxPrice,
      sweetboxTotal,
    },
    expiresInSeconds: 300,
    expiresAt,
  };
}

// 7. Giải phóng ghế đang giữ chỗ khi người dùng đổi suất chiếu hoặc rời trang
export async function releaseSeats(showtimeId: number, sessionId: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM seat_locks WHERE showtime_id = ? AND session_id = ?",
    [showtimeId, sessionId]
  );
  return result.affectedRows > 0;
}
