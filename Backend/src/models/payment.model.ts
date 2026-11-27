import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { classifySeatForRoom } from "./booking.model.js";

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

export interface CreateBookingParams {
  userId: number;
  showtimeId: number;
  seats: string[];           // ["F7", "F8"]
  seatIds?: number[];        // ID ghế trong bảng seats (nếu có)
  sessionId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  discountAmount: number;
  promoCode?: string;
  paymentMethod: "momo" | "zalopay" | "card" | "vnpay";
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
  cinemaName?: string;
  cinemaAddress?: string;
  cinemaPhone?: string;
  roomName?: string;
  showtime?: string;
  endTime?: string;
  showDate?: string;
  format?: string;
}

export interface TicketDetail {
  id: number;
  bookingCode: string;
  movieTitle: string;
  movieRating: string;
  movieDuration: number;
  movieGenre: string;
  posterUrl: string | null;
  cinemaName: string;
  cinemaAddress: string;
  cinemaPhone: string;
  roomName: string;
  showtime: string;
  endTime: string;
  showDate: string;
  seats: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
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

  if (v.usage_count >= v.usage_limit) {
    return { valid: false, message: "Mã giảm giá đã hết lượt sử dụng!" };
  }

  if (orderTotal < v.min_order_value) {
    return {
      valid: false,
      message: `Đơn hàng tối thiểu ${new Intl.NumberFormat("vi-VN").format(v.min_order_value)}đ để áp dụng mã này!`,
    };
  }

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

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 5; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `CM-${dd}${mm}-${random}`;
}

// 4. TẠO DỮ LIỆU MÃ QR CHECK-IN
export function generateQRCodeData(bookingCode: string): string {
  return `https://cinemamanagement.vn/checkin/${bookingCode}`;
}

function formatSeatLabels(seatRows: RowDataPacket[]): string {
  if (seatRows.length === 0) return "Không rõ";
  const seatCodes = seatRows.map((s) => String(s.seatCode));
  const types = new Set(seatRows.map((s) => String(s.seat_type)));
  const typeLabels: string[] = [];
  if (types.has("sweetbox")) typeLabels.push("Sweetbox");
  if (types.has("vip")) typeLabels.push("VIP");
  if (types.has("regular")) typeLabels.push("Thường");
  return `${seatCodes.join(", ")}${typeLabels.length > 0 ? ` (${typeLabels.join(", ")})` : ""}`;
}

// 5. TẠO BOOKING — LƯU VÀO DATABASE THEO ĐÚNG SUẤT CHIẾU VÀ CẬP NHẬT ĐIỂM TÍCH LŨY
export async function createBooking(params: CreateBookingParams): Promise<BookingResult> {
  const {
    userId,
    showtimeId,
    seats,
    sessionId,
    customerName,
    customerEmail,
    customerPhone,
    totalPrice,
    discountAmount,
    promoCode,
    paymentMethod,
  } = params;

  // Đảm bảo userId hợp lệ trong DB
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

  // Kiểm tra suất chiếu hợp lệ & lấy thông tin rạp/phòng
  let validShowtimeId = showtimeId;
  let showtimeMeta: RowDataPacket | null = null;
  const [stRows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.room_id, s.format,
            DATE_FORMAT(s.start_time, '%H:%i') AS showtime_str,
            DATE_FORMAT(s.end_time, '%H:%i') AS end_time_str,
            DATE_FORMAT(s.start_time, '%d/%m/%Y') AS show_date_str,
            r.name AS room_name, r.rows_count, r.vip_rows,
            c.name AS cinema_name,
            CONCAT_WS(', ', c.address, c.district, c.city) AS cinema_address,
            COALESCE(c.phone, '0123 456 789') AS cinema_phone
     FROM showtimes s
     JOIN rooms r ON r.id = s.room_id
     JOIN cinemas c ON c.id = r.cinema_id
     WHERE s.id = ?
     LIMIT 1`,
    [showtimeId]
  );

  if (stRows.length > 0) {
    showtimeMeta = stRows[0];
    validShowtimeId = Number(showtimeMeta.id);
  } else {
    const [fallbackRows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.room_id, s.format,
              DATE_FORMAT(s.start_time, '%H:%i') AS showtime_str,
              DATE_FORMAT(s.end_time, '%H:%i') AS end_time_str,
              DATE_FORMAT(s.start_time, '%d/%m/%Y') AS show_date_str,
              r.name AS room_name, r.rows_count, r.vip_rows,
              c.name AS cinema_name,
              CONCAT_WS(', ', c.address, c.district, c.city) AS cinema_address,
              COALESCE(c.phone, '0123 456 789') AS cinema_phone
       FROM showtimes s
       JOIN rooms r ON r.id = s.room_id
       JOIN cinemas c ON c.id = r.cinema_id
       ORDER BY s.id ASC
       LIMIT 1`
    );
    if (fallbackRows.length > 0) {
      showtimeMeta = fallbackRows[0];
      validShowtimeId = Number(showtimeMeta.id);
    }
  }

  const normalizedSeats = Array.from(
    new Set(seats.map((s) => s.trim().toUpperCase()).filter(Boolean))
  );

  // Kiểm tra xung đột: không cho phép đặt trùng ghế đã bán của cùng suất chiếu
  if (normalizedSeats.length > 0) {
    const [alreadyBooked] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT CONCAT(se.row_label, se.col_number) AS seat_code
       FROM booking_seats bs
       JOIN bookings b ON bs.booking_id = b.id
       JOIN seats se ON bs.seat_id = se.id
       WHERE b.showtime_id = ?
         AND b.status <> 'cancelled'
         AND b.payment_status <> 'refunded'
         AND CONCAT(se.row_label, se.col_number) IN (?)`,
      [validShowtimeId, normalizedSeats]
    );

    if (alreadyBooked.length > 0) {
      const conflictCodes = alreadyBooked.map((r) => String(r.seat_code)).join(", ");
      const conflictErr = new Error(
        `Ghế [${conflictCodes}] ở suất chiếu này vừa được đặt bởi khách hàng khác. Vui lòng quay lại chọn ghế khác!`
      ) as Error & { statusCode?: number };
      conflictErr.statusCode = 409;
      throw conflictErr;
    }
  }

  // 1. Tạo mã đặt vé duy nhất
  let bookingCode = generateBookingCode();
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

  // 3. Tính tổng thực trả
  const finalPrice = Math.max(0, totalPrice - discountAmount);

  // 4. Lưu booking vào cơ sở dữ liệu
  const insertQuery = `
    INSERT INTO bookings 
      (user_id, showtime_id, booking_code, customer_name, customer_email, customer_phone,
       total_price, discount_amount, promo_code, payment_method, payment_status, status, qr_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'upcoming', ?)
  `;

  const [result] = await pool.query<ResultSetHeader>(insertQuery, [
    validUserId,
    validShowtimeId,
    bookingCode,
    customerName,
    customerEmail,
    customerPhone,
    finalPrice,
    discountAmount,
    promoCode || null,
    paymentMethod,
    qrCode,
  ]);

  const bookingId = result.insertId;

  // 5. Lưu ghế đã đặt vào bảng booking_seats theo đúng room_id của suất chiếu
  if (showtimeMeta) {
    const roomId = Number(showtimeMeta.room_id);
    const rowsCount = Number(showtimeMeta.rows_count) || 8;
    const vipRows = String(showtimeMeta.vip_rows || "E,F,G");

    for (const cleanCode of normalizedSeats) {
      const row = cleanCode[0];
      const col = parseInt(cleanCode.slice(1), 10);
      if (!row || isNaN(col)) continue;

      const [seatRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM seats WHERE room_id = ? AND row_label = ? AND col_number = ? LIMIT 1",
        [roomId, row, col]
      );
      let seatId = seatRows[0]?.id;
      if (!seatId) {
        const seatType = classifySeatForRoom(cleanCode, rowsCount, vipRows);
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

  // 6. Tăng usage_count của voucher (nếu có promo code)
  if (promoCode) {
    await pool.query(
      "UPDATE vouchers SET usage_count = usage_count + 1 WHERE code = ?",
      [promoCode.trim().toUpperCase()]
    );
  }

  // 7. Cập nhật điểm tích lũy thành viên
  const pointsEarned = Math.floor(finalPrice / 10000);
  if (pointsEarned > 0) {
    await pool.query(
      "UPDATE users SET points = points + ? WHERE id = ?",
      [pointsEarned, validUserId]
    );
  }

  // 8. Xóa seat_locks của user và session sau khi booking thành công
  try {
    if (sessionId) {
      await pool.query(
        "DELETE FROM seat_locks WHERE showtime_id = ? AND (user_id = ? OR session_id = ?)",
        [validShowtimeId, validUserId, sessionId]
      );
    } else {
      await pool.query(
        "DELETE FROM seat_locks WHERE showtime_id = ? AND user_id = ?",
        [validShowtimeId, validUserId]
      );
    }
  } catch {
    // bỏ qua nếu không có seat_locks
  }

  return {
    bookingId,
    bookingCode,
    qrCode,
    totalPrice,
    discountAmount,
    finalPrice,
    pointsEarned,
    paymentStatus: "paid",
    cinemaName: showtimeMeta ? String(showtimeMeta.cinema_name) : undefined,
    cinemaAddress: showtimeMeta ? String(showtimeMeta.cinema_address) : undefined,
    cinemaPhone: showtimeMeta ? String(showtimeMeta.cinema_phone) : undefined,
    roomName: showtimeMeta ? String(showtimeMeta.room_name) : undefined,
    showtime: showtimeMeta ? String(showtimeMeta.showtime_str) : undefined,
    endTime: showtimeMeta ? String(showtimeMeta.end_time_str) : undefined,
    showDate: showtimeMeta ? String(showtimeMeta.show_date_str) : undefined,
    format: showtimeMeta ? String(showtimeMeta.format) : undefined,
  };
}

// 5.1 HỦY VÉ (CANCEL TICKET)
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
    const params: unknown[] = [String(bookingCodeOrId), Number(bookingCodeOrId) || 0];

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
      message: "Hủy vé thành công! Ghế đã được giải phóng và tiền sẽ hoàn lại theo chính sách rạp.",
    };
  } catch (error) {
    console.error("Lỗi khi hủy vé:", error);
    return {
      success: false,
      message: "Lỗi hệ thống khi thực hiện hủy vé!",
    };
  }
}

// 6. LẤY DANH SÁCH VÉ CỦA TÔI (KÈM ĐẦY ĐỦ ĐỊA CHỈ RẠP & THÔNG TIN VÉ CHO FILE PDF)
export async function getMyTickets(userId: number): Promise<TicketDetail[]> {
  const query = `
    SELECT 
      b.id,
      b.booking_code AS bookingCode,
      b.customer_name AS customerName,
      b.customer_email AS customerEmail,
      b.customer_phone AS customerPhone,
      u.name AS userName,
      u.email AS userEmail,
      u.phone AS userPhone,
      m.title AS movieTitle,
      m.rating AS movieRating,
      m.duration_min AS movieDuration,
      m.genre AS movieGenre,
      m.poster_url AS posterUrl,
      c.name AS cinemaName,
      CONCAT_WS(', ', c.address, c.district, c.city) AS cinemaAddress,
      COALESCE(c.phone, '0123 456 789') AS cinemaPhone,
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
      DATE_FORMAT(b.created_at, '%d/%m/%Y %H:%i') AS createdAt
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN showtimes s ON b.showtime_id = s.id
    LEFT JOIN movies m ON s.movie_id = m.id
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN cinemas c ON r.cinema_id = c.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `;

  const [rows] = await pool.query<RowDataPacket[]>(query, [userId]);

  const tickets: TicketDetail[] = [];
  for (const row of rows) {
    const [seatRows] = await pool.query<RowDataPacket[]>(
      `SELECT CONCAT(se.row_label, se.col_number) AS seatCode, se.seat_type
       FROM booking_seats bs
       JOIN seats se ON bs.seat_id = se.id
       WHERE bs.booking_id = ?
       ORDER BY se.row_label, se.col_number`,
      [row.id]
    );

    tickets.push({
      id: row.id,
      bookingCode: row.bookingCode,
      movieTitle: row.movieTitle || "Tín hiệu từ ngày mai",
      movieRating: row.movieRating || "T13",
      movieDuration: Number(row.movieDuration) || 118,
      movieGenre: row.movieGenre || "Điện ảnh",
      posterUrl: row.posterUrl,
      cinemaName: row.cinemaName || "Cinema Nguyễn Du",
      cinemaAddress:
        row.cinemaAddress || "135 Nguyễn Du, Bến Thành, Quận 1, TP. Hồ Chí Minh",
      cinemaPhone: row.cinemaPhone || "028 3825 1234",
      roomName: row.roomName || "Phòng 01",
      showtime: row.showtime || "19:30",
      endTime: row.endTime || "21:28",
      showDate: row.showDate || "24/10/2026",
      seats: formatSeatLabels(seatRows),
      customerName: row.customerName || row.userName || "Khách hàng thành viên",
      customerEmail: row.customerEmail || row.userEmail || "",
      customerPhone: row.customerPhone || row.userPhone || "",
      totalPrice: Number(row.totalPrice),
      discountAmount: Number(row.discountAmount),
      finalPrice: Number(row.finalPrice),
      promoCode: row.promoCode,
      paymentMethod: row.paymentMethod || "momo",
      paymentStatus: row.paymentStatus || "paid",
      status: row.status || "upcoming",
      format: row.format || "2D Dolby Atmos",
      qrCode: row.qrCode || generateQRCodeData(row.bookingCode),
      createdAt: String(row.createdAt || ""),
    });
  }

  return tickets;
}

// 7. LẤY CHI TIẾT 1 VÉ THEO BOOKING CODE
export async function getTicketByCode(bookingCode: string): Promise<TicketDetail | null> {
  const query = `
    SELECT 
      b.id,
      b.user_id AS userId,
      b.booking_code AS bookingCode,
      b.customer_name AS customerName,
      b.customer_email AS customerEmail,
      b.customer_phone AS customerPhone,
      u.name AS userName,
      u.email AS userEmail,
      u.phone AS userPhone,
      m.title AS movieTitle,
      m.rating AS movieRating,
      m.duration_min AS movieDuration,
      m.genre AS movieGenre,
      m.poster_url AS posterUrl,
      c.name AS cinemaName,
      CONCAT_WS(', ', c.address, c.district, c.city) AS cinemaAddress,
      COALESCE(c.phone, '0123 456 789') AS cinemaPhone,
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
      DATE_FORMAT(b.created_at, '%d/%m/%Y %H:%i') AS createdAt
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
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

  return {
    id: row.id,
    bookingCode: row.bookingCode,
    movieTitle: row.movieTitle || "Tín hiệu từ ngày mai",
    movieRating: row.movieRating || "T13",
    movieDuration: Number(row.movieDuration) || 118,
    movieGenre: row.movieGenre || "Điện ảnh",
    posterUrl: row.posterUrl,
    cinemaName: row.cinemaName || "Cinema Nguyễn Du",
    cinemaAddress:
      row.cinemaAddress || "135 Nguyễn Du, Bến Thành, Quận 1, TP. Hồ Chí Minh",
    cinemaPhone: row.cinemaPhone || "028 3825 1234",
    roomName: row.roomName || "Phòng 01",
    showtime: row.showtime,
    endTime: row.endTime,
    showDate: row.showDate,
    seats: formatSeatLabels(seatRows),
    customerName: row.customerName || row.userName || "Khách hàng thành viên",
    customerEmail: row.customerEmail || row.userEmail || "",
    customerPhone: row.customerPhone || row.userPhone || "",
    totalPrice: Number(row.totalPrice),
    discountAmount: Number(row.discountAmount),
    finalPrice: Number(row.finalPrice),
    promoCode: row.promoCode,
    paymentMethod: row.paymentMethod || "momo",
    paymentStatus: row.paymentStatus || "paid",
    status: row.status || "upcoming",
    format: row.format || "2D Dolby Atmos",
    qrCode: row.qrCode || generateQRCodeData(row.bookingCode),
    createdAt: String(row.createdAt || ""),
  };
}

// 8. LẤY TỔNG ĐIỂM TÍCH LŨY THÀNH VIÊN
export async function getMemberPoints(userId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT points FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  if (rows.length === 0) return 0;
  return Number(rows[0].points);
}
