import { apiRequest, type ApiResponse } from "./api";

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

export interface CinemaScheduleSlot {
  showtimeId: number | null;
  startTime: string;
  endTime: string;
  roomName: string;
  format: string;
  category: "2D" | "IMAX";
  priceRegular: number;
  totalSeats: number;
  availableSeats: number;
}

export interface CinemaScheduleData {
  cinemaId: number;
  cinemaName: string;
  cinemaAddress: string;
  dateISO: string;
  slotsByMovie: Record<string, CinemaScheduleSlot[]>;
}

export interface OccupiedSeatsData {
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

export interface LockSeatsPayload {
  showtimeId: number;
  seats: string[];
  userId?: number;
  sessionId: string;
  regularPrice?: number;
  vipPrice?: number;
}

export interface PriceBreakdown {
  regularCount: number;
  regularPrice: number;
  regularTotal: number;
  vipCount: number;
  vipPrice: number;
  vipTotal: number;
  sweetboxCount?: number;
  sweetboxPrice?: number;
  sweetboxTotal?: number;
}

export interface LockSeatsResponse {
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

export const bookingService = {
  // 1. Lấy danh sách các suất chiếu của phim kèm số ghế trống riêng từng suất
  async getMovieShowtimes(params: {
    movieId?: number;
    movie?: string;
    cinemaId?: number;
    cinema?: string;
    date?: string;
    sessionId?: string;
    time?: string;
    ensure?: boolean;
  }): Promise<ApiResponse<ShowtimeSlotInfo[]>> {
    const qs = new URLSearchParams();
    if (params.movieId) qs.set("movieId", String(params.movieId));
    if (params.movie) qs.set("movie", params.movie);
    if (params.cinemaId) qs.set("cinemaId", String(params.cinemaId));
    if (params.cinema) qs.set("cinema", params.cinema);
    if (params.date) qs.set("date", params.date);
    if (params.sessionId) qs.set("sessionId", params.sessionId);
    if (params.time) qs.set("time", params.time);
    if (params.ensure === false) qs.set("ensure", "false");

    return apiRequest<ShowtimeSlotInfo[]>(`/booking/movie-showtimes?${qs.toString()}`);
  },

  // 2. Lấy lịch chiếu toàn rạp theo ngày kèm số ghế trống thực tế của mỗi suất
  async getCinemaSchedule(params: {
    cinema?: string;
    cinemaId?: number;
    date?: string;
  }): Promise<ApiResponse<CinemaScheduleData>> {
    const qs = new URLSearchParams();
    if (params.cinema) qs.set("cinema", params.cinema);
    if (params.cinemaId) qs.set("cinemaId", String(params.cinemaId));
    if (params.date) qs.set("date", params.date);

    return apiRequest<CinemaScheduleData>(`/booking/cinema-schedule?${qs.toString()}`);
  },

  // 3. Lấy sơ đồ ghế đã bán và đang bị giữ chỗ riêng cho từng showtimeId
  async getOccupiedSeats(
    showtimeId: number,
    sessionId: string
  ): Promise<ApiResponse<OccupiedSeatsData>> {
    return apiRequest<OccupiedSeatsData>(
      `/booking/occupied-seats?showtimeId=${showtimeId}&sessionId=${encodeURIComponent(sessionId)}`
    );
  },

  // 4. Khóa ghế tạm thời 5 phút & tính toán chi phí từ Backend
  async lockSeats(payload: LockSeatsPayload): Promise<ApiResponse<LockSeatsResponse>> {
    return apiRequest<LockSeatsResponse>("/booking/lock-seats", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // 5. Giải phóng ghế khi người dùng đổi khung giờ hoặc thoát trang
  async releaseSeats(showtimeId: number, sessionId: string): Promise<ApiResponse> {
    return apiRequest("/booking/release-seats", {
      method: "POST",
      body: JSON.stringify({ showtimeId, sessionId }),
    });
  },
};
