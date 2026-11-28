import { Router } from "express";
import {
  initSeatLocksTable,
  getOccupiedSeats,
  getMovieShowtimeSlots,
  getCinemaScheduleByDate,
  lockSeatsWithPriceCalculation,
  releaseSeats,
} from "../models/booking.model.js";

const bookingRouter = Router();

// Tự động kiểm tra, khởi tạo bảng seat_locks và dữ liệu ghế mẫu theo suất chiếu
initSeatLocksTable();

// [GET] /api/booking/movie-showtimes - Lấy các suất chiếu của phim kèm số ghế trống riêng từng suất
bookingRouter.get("/movie-showtimes", async (req, res) => {
  try {
    const movieId = req.query.movieId ? Number(req.query.movieId) : undefined;
    const movieTitle = req.query.movie ? String(req.query.movie) : undefined;
    const cinemaId = req.query.cinemaId ? Number(req.query.cinemaId) : undefined;
    const cinemaName = req.query.cinema ? String(req.query.cinema) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined;
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : "";
    const requestedTime = req.query.time ? String(req.query.time) : undefined;
    const ensureSlots = req.query.ensure !== "false";

    const slots = await getMovieShowtimeSlots({
      movieId,
      movieTitle,
      cinemaId,
      cinemaName,
      date,
      sessionId,
      requestedTime,
      ensureSlots,
    });

    return res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách suất chiếu theo phim:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải danh sách suất chiếu và số ghế trống!",
    });
  }
});

// [GET] /api/booking/cinema-schedule - Lịch chiếu của rạp theo ngày kèm số ghế trống riêng mỗi suất
bookingRouter.get("/cinema-schedule", async (req, res) => {
  try {
    const cinemaId = req.query.cinemaId ? Number(req.query.cinemaId) : undefined;
    const cinemaName = req.query.cinema ? String(req.query.cinema) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined;

    const schedule = await getCinemaScheduleByDate({
      cinemaId,
      cinemaName,
      date,
    });

    return res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error("Lỗi tải lịch chiếu cụm rạp:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải lịch chiếu và ghế trống của rạp!",
    });
  }
});

// [GET] /api/booking/occupied-seats - Lấy sơ đồ ghế đã bán & đang giữ riêng cho showtimeId
bookingRouter.get("/occupied-seats", async (req, res) => {
  try {
    const showtimeId = Number(req.query.showtimeId) || 1;
    const sessionId = (req.query.sessionId as string) || "guest";

    const data = await getOccupiedSeats(showtimeId, sessionId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách ghế đã đặt/khóa:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải sơ đồ ghế!",
    });
  }
});

// [POST] /api/booking/lock-seats - Khóa ghế tạm thời 5 phút theo đúng showtimeId & tính tiền
bookingRouter.post("/lock-seats", async (req, res) => {
  try {
    const {
      showtimeId,
      seats,
      userId,
      sessionId,
      regularPrice,
      vipPrice,
    } = req.body || {};

    if (!showtimeId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin suất chiếu hoặc phiên chọn ghế (sessionId)!",
      });
    }

    const result = await lockSeatsWithPriceCalculation({
      showtimeId: Number(showtimeId),
      seats: Array.isArray(seats) ? seats : [],
      userId: userId ? Number(userId) : undefined,
      sessionId: String(sessionId),
      regularPrice: regularPrice ? Number(regularPrice) : 90000,
      vipPrice: vipPrice ? Number(vipPrice) : 120000,
    });

    if (!result.success) {
      return res.status(409).json({ ...result, data: result });
    }

    return res.json({ ...result, data: result });
  } catch (error) {
    console.error("Lỗi khóa ghế và tính tiền:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xử lý giữ chỗ ghế!",
    });
  }
});

// [POST] /api/booking/release-seats - Hủy giữ chỗ ghế khi người dùng đổi khung giờ hoặc thoát
bookingRouter.post("/release-seats", async (req, res) => {
  try {
    const { showtimeId, sessionId } = req.body || {};

    if (!showtimeId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin suất chiếu hoặc sessionId!",
      });
    }

    await releaseSeats(Number(showtimeId), String(sessionId));

    return res.json({
      success: true,
      message: "Đã hủy giữ chỗ các ghế thành công.",
    });
  } catch (error) {
    console.error("Lỗi giải phóng ghế:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi hủy giữ chỗ ghế!",
    });
  }
});

export default bookingRouter;
