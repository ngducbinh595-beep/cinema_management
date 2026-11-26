import { apiRequest, type ApiResponse } from "./api";

export interface OccupiedSeatsData {
  bookedSeats: string[];
  lockedByOthers: string[];
  myLockedSeats: string[];
  expiresInSeconds: number;
}

export interface LockSeatsPayload {
  showtimeId: number;
  seats: string[];
  userId?: number;
  sessionId: string;
  regularPrice?: number;
  vipPrice?: number;
}

export interface LockSeatsResponse {
  success: boolean;
  message: string;
  showtimeId: number;
  lockedSeats: string[];
  totalPrice: number;
  breakdown: {
    regularCount: number;
    regularPrice: number;
    regularTotal: number;
    vipCount: number;
    vipPrice: number;
    vipTotal: number;
  };
  expiresInSeconds: number;
  expiresAt: string;
  conflictingSeats?: string[];
}

// Service quản lý đặt vé & giữ chỗ ghế tạm thời trong 5 phút
export const bookingService = {
  // 1. Lấy danh sách ghế đã bán và ghế đang bị người khác giữ chỗ
  async getOccupiedSeats(showtimeId: number, sessionId: string): Promise<ApiResponse<OccupiedSeatsData>> {
    return apiRequest<OccupiedSeatsData>(
      `/booking/occupied-seats?showtimeId=${showtimeId}&sessionId=${encodeURIComponent(sessionId)}`
    );
  },

  // 2. Khóa ghế tạm thời trong 5 phút & tự động tính toán tổng số tiền từ Backend
  async lockSeats(payload: LockSeatsPayload): Promise<ApiResponse<LockSeatsResponse>> {
    return apiRequest<LockSeatsResponse>("/booking/lock-seats", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // 3. Giải phóng ghế khi người dùng hủy chọn hoặc thoát
  async releaseSeats(showtimeId: number, sessionId: string): Promise<ApiResponse> {
    return apiRequest("/booking/release-seats", {
      method: "POST",
      body: JSON.stringify({ showtimeId, sessionId }),
    });
  },
};
