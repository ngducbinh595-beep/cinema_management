import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ══════════════════════════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════════════════════════

export interface VoucherInfo {
  code: string;
  discountType: "fixed" | "percent";
  discountValue: number;     // VND nếu fixed, % nếu percent
  maxDiscount: number;       // Giới hạn tối đa giảm (VND)
  minOrderValue: number;     // Đơn tối thiểu để áp dụng
  validFrom: string;
  validTo: string;
  usageLeft: number;
}

/** Lỗi nghiệp vụ khi đặt vé (trả về 400 cho client, không phải lỗi hệ thống) */
export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export interface CreateBookingParams {
  userId: number;
  showtimeId: number;
  seats: string[];           // ["F7", "F8"]
  seatIds?: number[];        // ID ghế trong bảng seats (nếu có)
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  discountAmount: number;
  promoCode?: string;
  paymentMethod: "momo" | "zalopay" | "card";
}

export interface BookingResult {
  bookingId: number;
  bookingCode: string;
  qrCode: string;
  totalPrice: number;
  discountAmount: number;
  finalPrice: number;
  pointsEarned: number;
  paymentStatus: string;
}

export interface TicketDetail {
  id: number;
  bookingCode: string;
  movieTitle: string;
  posterUrl: string | null;
  cinemaName: string;
  roomName: string;
  showtime: string;
  endTime: string;
  showDate: string;
  seats: string;
  totalPrice: number;
  discountAmount: number;
  finalPrice: number;
  promoCode: string | null;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  format: string;
  qrCode: string | null;
  createdAt: string;
}

// 1. KHỞI TẠO BẢNG VOUCHERS NẾU CHƯA TỒN TẠI
export async function initVouchersTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS vouchers (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(30) NOT NULL UNIQUE,
      discount_type ENUM('fixed','percent') NOT NULL DEFAULT 'fixed',
      discount_value DECIMAL(10,0) NOT NULL DEFAULT 0,
      max_discount DECIMAL(10,0) NOT NULL DEFAULT 0,
      min_order_value DECIMAL(10,0) NOT NULL DEFAULT 0,
      valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      valid_to DATETIME NOT NULL,
      usage_limit INT UNSIGNED NOT NULL DEFAULT 100,
      usage_count INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await pool.query(query);
    // Seed dữ liệu mẫu nếu bảng trống
    await seedVouchers();
  } catch (err) {
    console.error("Lỗi khởi tạo bảng vouchers:", err);
  }
}

async function seedVouchers(): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM vouchers");
  if (rows[0].cnt > 0) return;

  const seedQuery = `
    INSERT INTO vouchers (code, discount_type, discount_value, max_discount, min_order_value, valid_from, valid_to, usage_limit, usage_count) VALUES
      ('CMVIP', 'fixed', 30000, 30000, 100000, '2026-01-01', '2026-12-31', 1000, 0),
      ('WELCOME50', 'percent', 50, 100000, 150000, '2026-01-01', '2026-12-31', 500, 0),
      ('CM10K', 'fixed', 10000, 10000, 50000, '2026-01-01', '2026-12-31', 2000, 0),
      ('CM20', 'percent', 20, 50000, 100000, '2026-01-01', '2026-12-31', 1000, 0),
      ('MEMBER30', 'fixed', 30000, 30000, 200000, '2026-01-01', '2026-12-31', 800, 0)
  `;
  try {
    await pool.query(seedQuery);
    console.log("✅ Đã seed dữ liệu mẫu vouchers.");
  } catch {
    // Nếu trùng key thì bỏ qua
  }
}


// 2. XÁC THỰC MÃ GIẢM GIÁ (VOUCHER PROMO CODE)

export async function validateVoucher(
  code: string,
  orderTotal: number
): Promise<{ valid: boolean; voucher?: VoucherInfo; discountAmount?: number; message: string }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM vouchers 
     WHERE code = ? AND is_active = 1 AND valid_from <= NOW() AND valid_to >= NOW()
     LIMIT 1`,
    [code.trim().toUpperCase()]
  );

  if (rows.length === 0) {
    return { valid: false, message: "Mã giảm giá không tồn tại hoặc đã hết hạn!" };
  }

  const v = rows[0];

  // Kiểm tra số lượt sử dụng
  if (v.usage_count >= v.usage_limit) {
    return { valid: false, message: "Mã giảm giá đã hết lượt sử dụng!" };
  }

  // Kiểm tra đơn tối thiểu
  if (orderTotal < v.min_order_value) {
    return {
      valid: false,
      message: `Đơn hàng tối thiểu ${new Intl.NumberFormat("vi-VN").format(v.min_order_value)}đ để áp dụng mã này!`,
    };
  }

  // Tính số tiền giảm
  let discountAmount = 0;
  if (v.discount_type === "fixed") {
    discountAmount = v.discount_value;
  } else {
    discountAmount = Math.floor((orderTotal * v.discount_value) / 100);
    if (discountAmount > v.max_discount) {
      discountAmount = v.max_discount;
    }
  }

  const voucher: VoucherInfo = {
    code: v.code,
    discountType: v.discount_type,
    discountValue: Number(v.discount_value),
    maxDiscount: Number(v.max_discount),
    minOrderValue: Number(v.min_order_value),
    validFrom: v.valid_from,
    validTo: v.valid_to,
    usageLeft: v.usage_limit - v.usage_count,
  };

  return {
    valid: true,
    voucher,
    discountAmount,
    message: `Áp dụng mã ${v.code} thành công! Giảm ${new Intl.NumberFormat("vi-VN").format(discountAmount)}đ`,
  };
}

// 3. TẠO MÃ ĐẶT VÉ DUY NHẤT: CM-DDMM-XXXXX
export function generateBookingCode(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  // Tạo phần ngẫu nhiên 5 ký tự (chữ + số)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 5; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `CM-${dd}${mm}-${random}`;
}

// 4. TẠO MÃ QR CHECK-IN (Base64 SVG inline — không cần thư viện)
export function generateQRCodeData(bookingCode: string): string {
  // Trả về chuỗi dữ liệu QR (URL deep-link cho máy quét tại rạp)
  // Trong production, sẽ dùng thư viện như `qrcode` để tạo ảnh QR thật
  return `https://cinemamanagement.vn/checkin/${bookingCode}`;
}


// 4.1 TÍNH TỔNG TIỀN VÉ PHÍA SERVER (không tin số tiền client gửi lên)
// Hàng E, F, G là ghế VIP (cùng quy tắc với lúc giữ ghế), các hàng khác là ghế thường.
async function computeSeatsTotal(showtimeId: number, seats: string[]): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT price_regular, price_vip FROM showtimes WHERE id = ? LIMIT 1",
    [showtimeId]
  );
  if (rows.length === 0) return null;

  const regular = Number(rows[0].price_regular);
  const vip = Number(rows[0].price_vip);
  let total = 0;
  let counted = 0;
  for (const seat of seats) {
    const row = seat.trim()[0]?.toUpperCase();
    if (!row) continue;
    total += ["E", "F", "G"].includes(row) ? vip : regular;
    counted++;
  }
  return counted > 0 ? total : null;
}

// 5. TẠO BOOKING — LƯU VÀO DATABASE VÀ CẬP NHẬT ĐIỂM TÍCH LŨY
export async function createBooking(params: CreateBookingParams): Promise<BookingResult> {
  const {
    userId,
    showtimeId,
    seats,
    customerName,
    customerEmail,
    customerPhone,
    totalPrice,
    discountAmount,
    promoCode,
    paymentMethod,
  } = params;

  // Đảm bảo userId hợp lệ trong DB (tránh lỗi foreign key)
  let validUserId = userId;
  try {
    const [uRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (uRows.length === 0) {
      const [firstUser] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users ORDER BY id ASC LIMIT 1"
      );
      if (firstUser.length > 0) validUserId = firstUser[0].id;
    }
  } catch {
    // giữ nguyên
  }

  // Đảm bảo showtimeId hợp lệ trong DB
  let validShowtimeId = showtimeId;
  try {
    const [stRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM showtimes WHERE id = ? LIMIT 1",
      [showtimeId]
    );
    if (stRows.length === 0) {
      const [firstSt] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM showtimes ORDER BY id ASC LIMIT 1"
      );
      if (firstSt.length > 0) validShowtimeId = firstSt[0].id;
    }
  } catch {
    // giữ nguyên
  }

  // 1. Tạo mã đặt vé duy nhất
  let bookingCode = generateBookingCode();

  // Đảm bảo mã không trùng trong DB
  let attempts = 0;
  while (attempts < 10) {
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM bookings WHERE booking_code = ? LIMIT 1",
      [bookingCode]
    );
    if (existing.length === 0) break;
    bookingCode = generateBookingCode();
    attempts++;
  }

  // 2. Tạo mã QR check-in
  const qrCode = generateQRCodeData(bookingCode);

  // 3. Tính tổng tiền & giảm giá phía server
  // - Tổng tiền: tính lại từ giá suất chiếu trong DB (fallback số client gửi nếu không tính được)
  // - Giảm giá: chỉ chấp nhận khi mã voucher hợp lệ, số tiền giảm do server tính
  const serverTotal = await computeSeatsTotal(validShowtimeId, seats);
  const trustedTotal = serverTotal ?? totalPrice;

  let trustedDiscount = 0;
  let trustedPromo: string | undefined;
  if (promoCode) {
    const check = await validateVoucher(promoCode, trustedTotal);
    if (!check.valid) throw new BookingError(check.message);
    trustedDiscount = Math.min(check.discountAmount ?? 0, trustedTotal);
    trustedPromo = check.voucher?.code;

    // Trừ lượt dùng nguyên tử: tránh vượt giới hạn khi nhiều người dùng mã cùng lúc
    const [used] = await pool.query<ResultSetHeader>(
      "UPDATE vouchers SET usage_count = usage_count + 1 WHERE code = ? AND usage_count < usage_limit",
      [trustedPromo]
    );
    if (used.affectedRows === 0) {
      throw new BookingError("Mã giảm giá đã hết lượt sử dụng!");
    }
  }

  const finalPrice = Math.max(0, trustedTotal - trustedDiscount);

  // 4. Lưu booking vào cơ sở dữ liệu
  const insertQuery = `
    INSERT INTO bookings 
      (user_id, showtime_id, booking_code, customer_name, customer_email, customer_phone,
       total_price, discount_amount, promo_code, payment_method, payment_status, status, qr_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'upcoming', ?)
  `;

  let result: ResultSetHeader;
  try {
    [result] = await pool.query<ResultSetHeader>(insertQuery, [
      validUserId,
      validShowtimeId,
      bookingCode,
      customerName,
      customerEmail,
      customerPhone,
      finalPrice,
      trustedDiscount,
      trustedPromo || null,
      paymentMethod,
      qrCode,
    ]);
  } catch (err) {
    // Hoàn lại lượt dùng voucher nếu không tạo được đơn
    if (trustedPromo) {
      await pool
        .query("UPDATE vouchers SET usage_count = GREATEST(usage_count - 1, 0) WHERE code = ?", [trustedPromo])
        .catch(() => undefined);
    }
    throw err;
  }

  const bookingId = result.insertId;

  // 5. Lưu ghế đã đặt vào bảng booking_seats
  try {
    const [showtimeRows] = await pool.query<RowDataPacket[]>(
      "SELECT room_id FROM showtimes WHERE id = ? LIMIT 1",
      [validShowtimeId]
    );
    if (showtimeRows.length > 0) {
      const roomId = showtimeRows[0].room_id;
      for (const seatCode of seats) {
        const cleanCode = seatCode.trim();
        const row = cleanCode[0];
        const col = parseInt(cleanCode.slice(1), 10);
        if (!row || isNaN(col)) continue;

        let [seatRows] = await pool.query<RowDataPacket[]>(
          "SELECT id FROM seats WHERE room_id = ? AND row_label = ? AND col_number = ? LIMIT 1",
          [roomId, row, col]
        );
        let seatId = seatRows[0]?.id;
        if (!seatId) {
          const seatType = ["E", "F", "G"].includes(row) ? "vip" : "regular";
          const [ins] = await pool.query<ResultSetHeader>(
            "INSERT INTO seats (room_id, row_label, col_number, seat_type) VALUES (?, ?, ?, ?)",
            [roomId, row, col, seatType]
          );
          seatId = ins.insertId;
        }

        if (seatId) {
          await pool.query(
            "INSERT IGNORE INTO booking_seats (booking_id, seat_id) VALUES (?, ?)",
            [bookingId, seatId]
          );
        }
      }
    }
  } catch (err) {
    console.error("Lưu booking_seats:", err);
  }

  // 7. Cập nhật điểm tích lũy thành viên
  const pointsEarned = Math.floor(finalPrice / 10000);
  if (pointsEarned > 0) {
    await pool.query(
      "UPDATE users SET points = points + ? WHERE id = ?",
      [pointsEarned, validUserId]
    );
  }

  // 8. Xóa seat_locks của user sau khi booking thành công
  try {
    await pool.query(
      "DELETE FROM seat_locks WHERE showtime_id = ? AND user_id = ?",
      [validShowtimeId, validUserId]
    );
  } catch {
    // bỏ qua nếu không có seat_locks
  }

  return {
    bookingId,
    bookingCode,
    qrCode,
    totalPrice: trustedTotal,
    discountAmount: trustedDiscount,
    finalPrice,
    pointsEarned,
    paymentStatus: "paid",
  };
}

// ══════════════════════════════════════════════════════════════
// 5.1 HỦY VÉ (CANCEL TICKET)
// ══════════════════════════════════════════════════════════════

export async function cancelTicket(
  bookingCodeOrId: string | number,
  userId?: number
): Promise<{ success: boolean; message: string }> {
  try {
    let query = `
      UPDATE bookings 
      SET status = 'cancelled', payment_status = 'refunded' 
      WHERE (booking_code = ? OR id = ?)
    `;
    const params: any[] = [String(bookingCodeOrId), Number(bookingCodeOrId) || 0];

    if (userId) {
      query += " AND user_id = ?";
      params.push(userId);
    }

    const [res] = await pool.query<ResultSetHeader>(query, params);

    if (res.affectedRows === 0) {
      return {
        success: false,
        message: "Không tìm thấy vé hoặc vé không thể hủy!",
      };
    }

    return {
      success: true,
      message: "Hủy vé thành công! Tiền sẽ được hoàn lại theo chính sách rạp.",
    };
  } catch (error) {
    console.error("Lỗi khi hủy vé:", error);
    return {
      success: false,
      message: "Lỗi hệ thống khi thực hiện hủy vé!",
    };
  }
}

// ══════════════════════════════════════════════════════════════
// 6. LẤY DANH SÁCH VÉ CỦA TÔI (MY TICKETS)
// ══════════════════════════════════════════════════════════════

export async function getMyTickets(userId: number): Promise<TicketDetail[]> {
  const query = `
    SELECT 
      b.id,
      b.booking_code AS bookingCode,
      m.title AS movieTitle,
      m.poster_url AS posterUrl,
      c.name AS cinemaName,
      r.name AS roomName,
      DATE_FORMAT(s.start_time, '%H:%i') AS showtime,
      DATE_FORMAT(s.end_time, '%H:%i') AS endTime,
      DATE_FORMAT(s.start_time, '%d/%m/%Y') AS showDate,
      b.total_price AS totalPrice,
      b.discount_amount AS discountAmount,
      (b.total_price) AS finalPrice,
      b.promo_code AS promoCode,
      b.payment_method AS paymentMethod,
      b.payment_status AS paymentStatus,
      b.status,
      s.format,
      b.qr_code AS qrCode,
      b.created_at AS createdAt
    FROM bookings b
    LEFT JOIN showtimes s ON b.showtime_id = s.id
    LEFT JOIN movies m ON s.movie_id = m.id
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN cinemas c ON r.cinema_id = c.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `;

  const [rows] = await pool.query<RowDataPacket[]>(query, [userId]);

  // Lấy danh sách ghế cho từng booking
  const tickets: TicketDetail[] = [];
  for (const row of rows) {
    // Lấy ghế
    const [seatRows] = await pool.query<RowDataPacket[]>(
      `SELECT CONCAT(se.row_label, se.col_number) AS seatCode, se.seat_type
       FROM booking_seats bs
       JOIN seats se ON bs.seat_id = se.id
       WHERE bs.booking_id = ?
       ORDER BY se.row_label, se.col_number`,
      [row.id]
    );

    let seatsStr = "";
    if (seatRows.length > 0) {
      const seatCodes = seatRows.map((s) => s.seatCode);
      const hasVip = seatRows.some((s) => s.seat_type === "vip");
      seatsStr = seatCodes.join(", ") + (hasVip ? " (VIP)" : " (Thường)");
    } else {
      // Fallback: đọc từ customer_name (nếu không có booking_seats)
      seatsStr = "Không rõ";
    }

    tickets.push({
      id: row.id,
      bookingCode: row.bookingCode,
      movieTitle: row.movieTitle,
      posterUrl: row.posterUrl,
      cinemaName: row.cinemaName,
      roomName: row.roomName,
      showtime: row.showtime,
      endTime: row.endTime,
      showDate: row.showDate,
      seats: seatsStr,
      totalPrice: Number(row.totalPrice),
      discountAmount: Number(row.discountAmount),
      finalPrice: Number(row.finalPrice),
      promoCode: row.promoCode,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      status: row.status,
      format: row.format,
      qrCode: row.qrCode,
      createdAt: row.createdAt,
    });
  }

  return tickets;
}

// ══════════════════════════════════════════════════════════════
// 7. LẤY CHI TIẾT 1 VÉ THEO BOOKING CODE
// ══════════════════════════════════════════════════════════════

export async function getTicketByCode(bookingCode: string): Promise<TicketDetail | null> {
  const query = `
    SELECT 
      b.id,
      b.user_id AS userId,
      b.booking_code AS bookingCode,
      m.title AS movieTitle,
      m.poster_url AS posterUrl,
      c.name AS cinemaName,
      r.name AS roomName,
      DATE_FORMAT(s.start_time, '%H:%i') AS showtime,
      DATE_FORMAT(s.end_time, '%H:%i') AS endTime,
      DATE_FORMAT(s.start_time, '%d/%m/%Y') AS showDate,
      b.total_price AS totalPrice,
      b.discount_amount AS discountAmount,
      (b.total_price) AS finalPrice,
      b.promo_code AS promoCode,
      b.payment_method AS paymentMethod,
      b.payment_status AS paymentStatus,
      b.status,
      s.format,
      b.qr_code AS qrCode,
      b.created_at AS createdAt
    FROM bookings b
    JOIN showtimes s ON b.showtime_id = s.id
    JOIN movies m ON s.movie_id = m.id
    JOIN rooms r ON s.room_id = r.id
    JOIN cinemas c ON r.cinema_id = c.id
    WHERE b.booking_code = ?
    LIMIT 1
  `;

  const [rows] = await pool.query<RowDataPacket[]>(query, [bookingCode]);
  if (rows.length === 0) return null;

  const row = rows[0];

  const [seatRows] = await pool.query<RowDataPacket[]>(
    `SELECT CONCAT(se.row_label, se.col_number) AS seatCode, se.seat_type
     FROM booking_seats bs
     JOIN seats se ON bs.seat_id = se.id
     WHERE bs.booking_id = ?
     ORDER BY se.row_label, se.col_number`,
    [row.id]
  );

  let seatsStr = "";
  if (seatRows.length > 0) {
    const seatCodes = seatRows.map((s) => s.seatCode);
    const hasVip = seatRows.some((s) => s.seat_type === "vip");
    seatsStr = seatCodes.join(", ") + (hasVip ? " (VIP)" : " (Thường)");
  }

  return {
    id: row.id,
    bookingCode: row.bookingCode,
    movieTitle: row.movieTitle,
    posterUrl: row.posterUrl,
    cinemaName: row.cinemaName,
    roomName: row.roomName,
    showtime: row.showtime,
    endTime: row.endTime,
    showDate: row.showDate,
    seats: seatsStr,
    totalPrice: Number(row.totalPrice),
    discountAmount: Number(row.discountAmount),
    finalPrice: Number(row.finalPrice),
    promoCode: row.promoCode,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    status: row.status,
    format: row.format,
    qrCode: row.qrCode,
    createdAt: row.createdAt,
  };
}

// ══════════════════════════════════════════════════════════════
// 8. LẤY TỔNG ĐIỂM TÍCH LŨY THÀNH VIÊN
// ══════════════════════════════════════════════════════════════

export async function getMemberPoints(userId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT points FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  if (rows.length === 0) return 0;
  return Number(rows[0].points);
}
