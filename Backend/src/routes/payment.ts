import { Router } from "express";
import {
  initVouchersTable,
  validateVoucher,
  createBooking,
  cancelTicket,
  getMyTickets,
  getTicketByCode,
  getMemberPoints,
} from "../models/payment.model.js";

const paymentRouter = Router();

// Tự động khởi tạo bảng vouchers khi server start
initVouchersTable();

// ══════════════════════════════════════════════════════════════
// [POST] /api/payment/validate-voucher
// Xác thực mã giảm giá (Voucher promo code)
// Body: { code: string, orderTotal: number }
// ══════════════════════════════════════════════════════════════

paymentRouter.post("/validate-voucher", async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mã giảm giá!",
      });
    }

    const result = await validateVoucher(
      String(code),
      Number(orderTotal) || 0
    );

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({
      success: true,
      message: result.message,
      data: {
        voucher: result.voucher,
        discountAmount: result.discountAmount,
      },
    });
  } catch (error) {
    console.error("Lỗi xác thực voucher:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xác thực mã giảm giá!",
    });
  }
});

// ══════════════════════════════════════════════════════════════
// [POST] /api/payment/checkout
// Thanh toán & Xuất vé QR
// Body: {
//   userId, showtimeId, seats[], customerName, customerEmail,
//   customerPhone, totalPrice, discountAmount, promoCode,
//   paymentMethod: 'momo' | 'zalopay' | 'card'
// }
// ══════════════════════════════════════════════════════════════

paymentRouter.post("/checkout", async (req, res) => {
  try {
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
    } = req.body;

    // Validate dữ liệu đầu vào
    if (!userId || !showtimeId || !seats || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin đặt vé bắt buộc (userId, showtimeId, seats)!",
      });
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin nhận vé (Họ tên, Email, SĐT)!",
      });
    }

    if (!paymentMethod || !["momo", "zalopay", "card", "vnpay"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Phương thức thanh toán không hợp lệ! Chọn: momo, zalopay, card, hoặc vnpay.",
      });
    }

    // Mô phỏng thanh toán online (trong thực tế sẽ gọi API gateway MoMo/ZaloPay)
    // Giả lập thời gian xử lý thanh toán
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Tạo booking
    const result = await createBooking({
      userId: Number(userId),
      showtimeId: Number(showtimeId),
      seats: seats as string[],
      sessionId: sessionId ? String(sessionId) : undefined,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).trim(),
      customerPhone: String(customerPhone).trim(),
      totalPrice: Number(totalPrice) || 0,
      discountAmount: Number(discountAmount) || 0,
      promoCode: promoCode ? String(promoCode).trim().toUpperCase() : undefined,
      paymentMethod,
    });

    return res.json({
      success: true,
      message: "Thanh toán thành công! Vé đã được xuất.",
      data: result,
    });
  } catch (error: unknown) {
    const errObj = error as { statusCode?: number; message?: string };
    if (errObj?.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: errObj.message || "Ghế bạn chọn vừa có người đặt trước!",
      });
    }
    console.error("Lỗi thanh toán:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xử lý thanh toán! Vui lòng thử lại.",
    });
  }
});

// [GET] /api/payment/my-tickets?userId=xxx - Lấy danh sách vé của tôi (Vé của tôi)
paymentRouter.get("/my-tickets", async (req, res) => {
  try {
    const userId = Number(req.query.userId) || 1;

    const tickets = await getMyTickets(userId);

    // Lấy điểm tích lũy
    const points = await getMemberPoints(userId);

    // Thống kê
    const upcomingCount = tickets.filter((t) => t.status === "upcoming").length;
    const completedCount = tickets.filter((t) => t.status === "completed").length;
    const cancelledCount = tickets.filter((t) => t.status === "cancelled").length;

    return res.json({
      success: true,
      data: {
        tickets,
        stats: {
          upcomingCount,
          completedCount,
          cancelledCount,
          totalTickets: tickets.length,
          memberPoints: points,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách vé:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải danh sách vé!",
    });
  }
});

// [POST] /api/payment/cancel-ticket - Hủy vé & Hoàn tiền - Body: { bookingCode?: string, bookingId?: number, userId?: number }
paymentRouter.post("/cancel-ticket", async (req, res) => {
  try {
    const { bookingCode, bookingId, userId } = req.body;
    const identifier = bookingCode || bookingId;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin mã đặt vé hoặc ID vé cần hủy!",
      });
    }

    const result = await cancelTicket(
      identifier,
      userId ? Number(userId) : undefined
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error("Lỗi hủy vé:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi hủy vé!",
    });
  }
});

// [GET] /api/payment/ticket/:bookingCode - Lấy chi tiết 1 vé theo mã booking
paymentRouter.get("/ticket/:bookingCode", async (req, res) => {
  try {
    const { bookingCode } = req.params;

    if (!bookingCode) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã đặt vé!",
      });
    }

    const ticket = await getTicketByCode(bookingCode);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vé với mã đặt vé này!",
      });
    }

    return res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết vé:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải chi tiết vé!",
    });
  }
});

// [GET] /api/payment/member-points?userId=xxx - Lấy điểm tích lũy thành viên
paymentRouter.get("/member-points", async (req, res) => {
  try {
    const userId = Number(req.query.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin người dùng!",
      });
    }

    const points = await getMemberPoints(userId);

    return res.json({
      success: true,
      data: { userId, points },
    });
  } catch (error) {
    console.error("Lỗi lấy điểm tích lũy:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải thông tin điểm tích lũy!",
    });
  }
});

export default paymentRouter;
