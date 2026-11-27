import { pool } from "../config/db.js";
import type { RowDataPacket } from "mysql2";

export interface PricingTier {
  id: number;
  cinemaId: number;
  timeSlot: string;
  applyDays: string;
  regularPrice: number;
  vipPrice: number;
  /** Khung giờ này có thể tự áp giá xuống các suất chiếu sắp tới hay không */
  canApplyToShowtimes: boolean;
}

type TierKind = "weekday_day" | "weekday_evening" | "weekend";

/** Suy ra loại khung giờ từ tên (ngày lễ không có quy tắc tự động nên trả null) */
function tierKind(timeSlot: string): TierKind | null {
  const s = timeSlot.toLowerCase();
  if (s.includes("lễ")) return null;
  if (s.includes("cuối tuần")) return "weekend";
  if (s.includes("từ 17")) return "weekday_evening";
  if (s.includes("trước 17")) return "weekday_day";
  return null;
}

const KIND_CONDITION: Record<TierKind, string> = {
  weekday_day: "WEEKDAY(s.start_time) < 5 AND HOUR(s.start_time) < 17",
  weekday_evening: "WEEKDAY(s.start_time) < 5 AND HOUR(s.start_time) >= 17",
  weekend: "WEEKDAY(s.start_time) >= 5",
};

function mapTier(row: RowDataPacket): PricingTier {
  return {
    id: Number(row.id),
    cinemaId: Number(row.cinema_id),
    timeSlot: String(row.time_slot),
    applyDays: String(row.apply_days),
    regularPrice: Number(row.regular_price),
    vipPrice: Number(row.vip_price),
    canApplyToShowtimes: tierKind(String(row.time_slot)) !== null,
  };
}

export async function initPricingTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_tiers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        cinema_id INT UNSIGNED NOT NULL,
        time_slot VARCHAR(80) NOT NULL,
        apply_days VARCHAR(50) NOT NULL,
        regular_price DECIMAL(10,0) NOT NULL,
        vip_price DECIMAL(10,0) NOT NULL,
        FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed bảng giá mặc định cho rạp đầu tiên nếu bảng đang trống
    const [count] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM pricing_tiers");
    if (Number(count[0].cnt) > 0) return;
    const [cinemas] = await pool.query<RowDataPacket[]>("SELECT id FROM cinemas ORDER BY id ASC LIMIT 1");
    if (cinemas.length === 0) return;
    const cinemaId = cinemas[0].id;
    await pool.query(
      `INSERT INTO pricing_tiers (cinema_id, time_slot, apply_days, regular_price, vip_price) VALUES
        (?, 'Ngày thường (Trước 17:00)', 'Thứ Hai - Thứ Sáu', 70000, 100000),
        (?, 'Ngày thường (Từ 17:00)', 'Thứ Hai - Thứ Sáu', 90000, 120000),
        (?, 'Cuối tuần (Cả ngày)', 'Thứ Bảy - Chủ Nhật', 90000, 120000),
        (?, 'Ngày lễ (Cả ngày)', 'Ngày Lễ Quốc Gia', 110000, 140000)`,
      [cinemaId, cinemaId, cinemaId, cinemaId]
    );
  } catch (err) {
    console.error("Lỗi khởi tạo bảng pricing_tiers:", err);
  }
}

export async function getPricingTiers(cinemaId?: number): Promise<PricingTier[]> {
  const [rows] = cinemaId
    ? await pool.query<RowDataPacket[]>(
        "SELECT * FROM pricing_tiers WHERE cinema_id = ? ORDER BY id ASC",
        [cinemaId]
      )
    : await pool.query<RowDataPacket[]>("SELECT * FROM pricing_tiers ORDER BY cinema_id, id ASC");
  return rows.map(mapTier);
}

/**
 * Cập nhật giá của 1 khung giờ. Nếu applyToShowtimes = true, đồng thời cập nhật giá
 * của các suất chiếu SẮP TỚI (đang active) thuộc cùng rạp và cùng khung giờ.
 * Suất đã đặt vé không bị ảnh hưởng vì vé lưu giá tại thời điểm thanh toán.
 */
export async function updatePricingTier(
  id: number,
  regularPrice: number,
  vipPrice: number,
  applyToShowtimes: boolean
): Promise<{ tier: PricingTier | null; updatedShowtimes: number }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM pricing_tiers WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return { tier: null, updatedShowtimes: 0 };
    }

    await conn.query(
      "UPDATE pricing_tiers SET regular_price = ?, vip_price = ? WHERE id = ?",
      [regularPrice, vipPrice, id]
    );

    let updatedShowtimes = 0;
    const kind = tierKind(String(rows[0].time_slot));
    if (applyToShowtimes && kind) {
      const [result] = await conn.query<import("mysql2").ResultSetHeader>(
        `UPDATE showtimes s
         JOIN rooms r ON r.id = s.room_id
         SET s.price_regular = ?, s.price_vip = ?
         WHERE r.cinema_id = ? AND s.status = 'active' AND s.start_time > NOW()
           AND ${KIND_CONDITION[kind]}`,
        [regularPrice, vipPrice, rows[0].cinema_id]
      );
      updatedShowtimes = result.affectedRows;
    }

    await conn.commit();

    const [fresh] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM pricing_tiers WHERE id = ? LIMIT 1",
      [id]
    );
    return { tier: fresh[0] ? mapTier(fresh[0]) : null, updatedShowtimes };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
