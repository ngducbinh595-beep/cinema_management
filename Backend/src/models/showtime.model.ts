import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface ShowtimeRow {
  id: number;
  movie_id: number;
  movie_title: string;
  room_id: number;
  room_name: string;
  cinema_id: number;
  cinema_name?: string;
  cinema_address?: string;
  start_time_str: string;
  end_time_str: string;
  price_regular: string;
  price_vip: string;
  format: string;
  status: "active" | "cancelled" | "full";
  total_seats?: number;
  booked_seats?: number;
  available_seats?: number;
}

export interface CreateShowtimeInput {
  movieId: number;
  roomId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  priceRegular?: number;
  priceVip?: number;
  format?: string;
}

/** Danh sách suất chiếu còn hiệu lực của 1 ngày (kèm số ghế trống riêng từng suất) */
export async function getShowtimesByDate(date: string): Promise<ShowtimeRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.movie_id, m.title AS movie_title,
            s.room_id, r.name AS room_name, r.cinema_id,
            c.name AS cinema_name,
            CONCAT_WS(', ', c.address, c.district, c.city) AS cinema_address,
            DATE_FORMAT(s.start_time, '%H:%i') AS start_time_str,
            DATE_FORMAT(s.end_time, '%H:%i') AS end_time_str,
            s.price_regular, s.price_vip, s.format, s.status,
            (r.rows_count * r.cols_count) AS total_seats,
            (
              SELECT COUNT(DISTINCT bs.seat_id)
              FROM booking_seats bs
              JOIN bookings b ON bs.booking_id = b.id
              WHERE b.showtime_id = s.id
                AND b.status <> 'cancelled'
                AND b.payment_status <> 'refunded'
            ) AS booked_seats,
            GREATEST(
              0,
              (r.rows_count * r.cols_count) - (
                SELECT COUNT(DISTINCT bs.seat_id)
                FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                WHERE b.showtime_id = s.id
                  AND b.status <> 'cancelled'
                  AND b.payment_status <> 'refunded'
              )
            ) AS available_seats
     FROM showtimes s
     JOIN movies m ON m.id = s.movie_id
     JOIN rooms  r ON r.id = s.room_id
     JOIN cinemas c ON c.id = r.cinema_id
     WHERE DATE(s.start_time) = ? AND s.status <> 'cancelled'
     ORDER BY s.start_time ASC`,
    [date]
  );
  return rows as ShowtimeRow[];
}

/** Phòng còn hoạt động + format/audio để tự điền cột format */
async function getRoomInfo(roomId: number): Promise<{ format: string; audio: string } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT format, audio FROM rooms WHERE id = ? AND status = 'active' LIMIT 1",
    [roomId]
  );
  if (!rows[0]) return null;
  return {
    format: rows[0].format || "2D",
    audio: rows[0].audio || "",
  };
}

/** Kiểm tra trùng giờ trong cùng phòng (bỏ qua suất đã hủy) */
async function findOverlap(
  roomId: number,
  date: string,
  startTime: string,
  endTime: string
): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM showtimes
     WHERE room_id = ?
       AND DATE(start_time) = ?
       AND status <> 'cancelled'
       AND start_time < ?
       AND end_time > ?
     LIMIT 1`,
    [roomId, date, `${date} ${endTime}:00`, `${date} ${startTime}:00`]
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

/** Tạo 1 suất chiếu; trả id hoặc lỗi trùng giờ */
export async function createShowtime(
  input: CreateShowtimeInput
): Promise<{ id?: number; conflict?: number; error?: string }> {
  const room = await getRoomInfo(input.roomId);
  if (!room) return { error: "Phòng chiếu không tồn tại hoặc đã ngừng hoạt động!" };

  const movieRows = await pool.query<RowDataPacket[]>(
    "SELECT id FROM movies WHERE id = ? LIMIT 1",
    [input.movieId]
  );
  if (!movieRows[0].length) return { error: "Phim không tồn tại!" };

  const conflict = await findOverlap(input.roomId, input.date, input.startTime, input.endTime);
  if (conflict) return { conflict };

  const format = input.format || `${room.format} ${room.audio}`.trim();

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO showtimes
       (movie_id, room_id, start_time, end_time, price_regular, price_vip, format, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      input.movieId,
      input.roomId,
      `${input.date} ${input.startTime}:00`,
      `${input.date} ${input.endTime}:00`,
      input.priceRegular ?? 90000,
      input.priceVip ?? 120000,
      format,
    ]
  );

  return { id: result.insertId };
}

//Thêm nhiều suất cùng lúc (AI xếp lịch). Suất trùng giờ bị bỏ qua.
export async function bulkCreateShowtimes(
  date: string,
  slots: Array<{ movieId: number; roomId: number; startTime: string; endTime: string }>
): Promise<{ created: number; skipped: number }> {
  const conn = await pool.getConnection();
  let created = 0;
  let skipped = 0;

  try {
    await conn.beginTransaction();

    for (const slot of slots) {
      const [overlapRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM showtimes
         WHERE room_id = ? AND DATE(start_time) = ? AND status <> 'cancelled'
           AND start_time < ? AND end_time > ?
         LIMIT 1`,
        [slot.roomId, date, `${date} ${slot.endTime}:00`, `${date} ${slot.startTime}:00`]
      );

      if (overlapRows.length > 0) {
        skipped += 1;
        continue;
      }

      const [roomRows] = await conn.query<RowDataPacket[]>(
        "SELECT format, audio FROM rooms WHERE id = ? AND status = 'active' LIMIT 1",
        [slot.roomId]
      );
      const room = roomRows[0];
      const format = room ? `${room.format || "2D"} ${room.audio || ""}`.trim() : "2D";

      await conn.query(
        `INSERT INTO showtimes
           (movie_id, room_id, start_time, end_time, price_regular, price_vip, format, status)
         VALUES (?, ?, ?, ?, 90000, 120000, ?, 'active')`,
        [slot.movieId, slot.roomId, `${date} ${slot.startTime}:00`, `${date} ${slot.endTime}:00`, format]
      );
      created += 1;
    }

    await conn.commit();
    return { created, skipped };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Hủy suất chiếu (mềm: status='cancelled') để giữ lịch sử vé */
export async function cancelShowtime(id: number): Promise<{ ok: boolean; status?: string }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, status FROM showtimes WHERE id = ? LIMIT 1",
    [id]
  );
  if (!rows[0]) return { ok: false };

  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE showtimes SET status = 'cancelled' WHERE id = ? AND status <> 'cancelled'",
    [id]
  );
  return { ok: result.affectedRows > 0, status: rows[0].status };
}
