import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface RoomRow {
  id: number;
  cinema_id: number;
  cinema_name: string;
  name: string;
  total_seats: number;
  regular_count: number;
  vip_count: number;
  format: string;
  audio: string;
  rows_count: number;
  cols_count: number;
  vip_rows: string | null;
  status: "active" | "maintenance";
  active_showtimes: number;
}

export interface RoomInput {
  cinemaId?: number;
  name?: string;
  totalSeats?: number;
  regularCount?: number;
  vipCount?: number;
  format?: string;
  audio?: string;
  rowsCount?: number;
  colsCount?: number;
  vipRows?: string;
  status?: "active" | "maintenance";
}

/** Danh sách phòng (kèm tên rạp + số suất chiếu chưa hủy) */
export async function getRooms(cinemaId?: number): Promise<RoomRow[]> {
  let query = `
    SELECT r.id, r.cinema_id, c.name AS cinema_name, r.name,
           r.total_seats, r.regular_count, r.vip_count,
           r.format, r.audio, r.rows_count, r.cols_count, r.vip_rows, r.status,
           (SELECT COUNT(*) FROM showtimes s
             WHERE s.room_id = r.id AND s.status <> 'cancelled') AS active_showtimes
    FROM rooms r
    JOIN cinemas c ON c.id = r.cinema_id
  `;
  const params: unknown[] = [];

  if (cinemaId) {
    query += " WHERE r.cinema_id = ?";
    params.push(cinemaId);
  }
  query += " ORDER BY r.id ASC";

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return rows as RoomRow[];
}

export async function findRoomById(id: number): Promise<RoomRow | null> {
  const rooms = await getRooms();
  return rooms.find((room) => room.id === id) || null;
}

async function hasRoomName(
  name: string,
  cinemaId: number,
  excludeId?: number
): Promise<boolean> {
  let query = "SELECT id FROM rooms WHERE name = ? AND cinema_id = ?";
  const params: unknown[] = [name, cinemaId];
  if (excludeId) {
    query += " AND id <> ?";
    params.push(excludeId);
  }
  query += " LIMIT 1";
  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return rows.length > 0;
}

/** Thêm phòng chiếu mới */
export async function createRoom(
  input: Required<Pick<RoomInput, "name" | "cinemaId">> & RoomInput
): Promise<{ id?: number; duplicate?: boolean }> {
  if (await hasRoomName(input.name!, input.cinemaId)) {
    return { duplicate: true };
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO rooms
       (cinema_id, name, total_seats, regular_count, vip_count,
        format, audio, rows_count, cols_count, vip_rows, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      input.cinemaId,
      input.name,
      input.totalSeats ?? 120,
      input.regularCount ?? 80,
      input.vipCount ?? 40,
      input.format || "2D",
      input.audio || "Dolby Atmos",
      input.rowsCount ?? 8,
      input.colsCount ?? 14,
      input.vipRows ?? "F,G",
    ]
  );

  return { id: result.insertId };
}

/** Cập nhật cấu hình phòng (partial) */
export async function updateRoomById(id: number, input: RoomInput): Promise<boolean> {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    fields.push("name = ?");
    params.push(input.name);
  }
  if (input.totalSeats !== undefined) {
    fields.push("total_seats = ?");
    params.push(input.totalSeats);
  }
  if (input.regularCount !== undefined) {
    fields.push("regular_count = ?");
    params.push(input.regularCount);
  }
  if (input.vipCount !== undefined) {
    fields.push("vip_count = ?");
    params.push(input.vipCount);
  }
  if (input.format !== undefined) {
    fields.push("format = ?");
    params.push(input.format);
  }
  if (input.audio !== undefined) {
    fields.push("audio = ?");
    params.push(input.audio);
  }
  if (input.rowsCount !== undefined) {
    fields.push("rows_count = ?");
    params.push(input.rowsCount);
  }
  if (input.colsCount !== undefined) {
    fields.push("cols_count = ?");
    params.push(input.colsCount);
  }
  if (input.vipRows !== undefined) {
    fields.push("vip_rows = ?");
    params.push(input.vipRows);
  }

  if (fields.length === 0) return false;

  params.push(id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE rooms SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

/**
 * Đổi trạng thái phòng.
 * Khi chuyển sang 'maintenance': hủy các suất chiếu TƯƠNG LAI của phòng
 * (start_time >= NOW()) để không bán vé cho phòng đã ngừng.
 */
export async function setRoomStatus(
  id: number,
  status: "active" | "maintenance"
): Promise<{ ok: boolean; cancelledShowtimes: number }> {
  const conn = await pool.getConnection();
  let cancelled = 0;

  try {
    await conn.beginTransaction();

    const [result] = await conn.query<ResultSetHeader>(
      "UPDATE rooms SET status = ? WHERE id = ?",
      [status, id]
    );

    if (status === "maintenance") {
      const [cancel] = await conn.query<ResultSetHeader>(
        `UPDATE showtimes
         SET status = 'cancelled'
         WHERE room_id = ? AND status <> 'cancelled' AND start_time >= NOW()`,
        [id]
      );
      cancelled = cancel.affectedRows;
    }

    await conn.commit();
    return { ok: result.affectedRows > 0, cancelledShowtimes: cancelled };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Kiểm tra trùng tên phòng khi đổi tên */
export async function isRoomNameTaken(
  name: string,
  cinemaId: number,
  excludeId: number
): Promise<boolean> {
  return hasRoomName(name, cinemaId, excludeId);
}
