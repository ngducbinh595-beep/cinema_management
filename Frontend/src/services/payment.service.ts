import { apiRequest, type ApiResponse } from "./api";

// ══════════════════════════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════════════════════════

export interface VoucherInfo {
  code: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  maxDiscount: number;
  minOrderValue: number;
  usageLeft: number;
}

export interface ValidateVoucherResponse {
  voucher: VoucherInfo;
  discountAmount: number;
}

export interface CheckoutPayload {
  userId: number;
  showtimeId: number;
  seats: string[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  discountAmount: number;
  promoCode?: string;
  paymentMethod: "momo" | "zalopay" | "card" | "vnpay";
}

export interface CheckoutResult {
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
  status: "upcoming" | "completed" | "cancelled";
  format: string;
  qrCode: string | null;
  createdAt: string;
}

export interface MyTicketsData {
  tickets: TicketDetail[];
  stats: {
    upcomingCount: number;
    completedCount: number;
    cancelledCount: number;
    totalTickets: number;
    memberPoints: number;
  };
}

// ══════════════════════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════════════════════

export const paymentService = {
  // Xác thực mã giảm giá (Voucher promo code)
  async validateVoucher(code: string, orderTotal: number): Promise<ApiResponse<ValidateVoucherResponse>> {
    return apiRequest<ValidateVoucherResponse>("/payment/validate-voucher", {
      method: "POST",
      body: JSON.stringify({ code, orderTotal }),
    });
  },

  // Thanh toán & Xuất vé QR
  async checkout(payload: CheckoutPayload): Promise<ApiResponse<CheckoutResult>> {
    return apiRequest<CheckoutResult>("/payment/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  //Lấy danh sách vé của tôi
  async getMyTickets(userId: number): Promise<ApiResponse<MyTicketsData>> {
    return apiRequest<MyTicketsData>(`/payment/my-tickets?userId=${userId}`);
  },

  //4. Lấy chi tiết 1 vé theo mã booking
  async getTicketByCode(bookingCode: string): Promise<ApiResponse<TicketDetail>> {
    return apiRequest<TicketDetail>(`/payment/ticket/${encodeURIComponent(bookingCode)}`);
  },

  //5. Lấy điểm tích lũy thành viên
  async getMemberPoints(userId: number): Promise<ApiResponse<{ userId: number; points: number }>> {
    return apiRequest<{ userId: number; points: number }>(`/payment/member-points?userId=${userId}`);
  },

  //6. Hủy vé & Hoàn tiền
  async cancelTicket(bookingCode: string, userId?: number): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiRequest<{ success: boolean; message: string }>("/payment/cancel-ticket", {
      method: "POST",
      body: JSON.stringify({ bookingCode, userId }),
    });
  },
};
