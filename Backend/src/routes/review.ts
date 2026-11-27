import { Router, type Request } from "express";
import {
  initReviewsTable,
  getReviewsByMovie,
  getReviewSummary,
  getUserReview,
  getReviewById,
  upsertReview,
  deleteReviewById,
} from "../models/review.model.js";
import { findMovieById } from "../models/movie.model.js";
import { authenticateToken, type TokenPayload } from "./auth.js";

const reviewRouter = Router();

// Tự động tạo bảng reviews khi server start
initReviewsTable();

const MAX_COMMENT_LENGTH = 1000;

type AuthedRequest = Request & { user?: TokenPayload };

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/reviews/movie/:movieId?page=1&limit=10 - Danh sách đánh giá + thống kê (công khai)
reviewRouter.get("/movie/:movieId", async (req, res) => {
  try {
    const movieId = parseId(req.params.movieId);
    if (!movieId) {
      return res.status(400).json({ success: false, message: "ID phim không hợp lệ!" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [reviews, summary] = await Promise.all([
      getReviewsByMovie(movieId, limit, (page - 1) * limit),
      getReviewSummary(movieId),
    ]);

    return res.json({
      success: true,
      data: { reviews, summary, page, limit, hasMore: page * limit < summary.total },
    });
  } catch (error) {
    console.error("Lỗi lấy đánh giá phim:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tải đánh giá phim!" });
  }
});

// GET /api/reviews/movie/:movieId/mine - Đánh giá của chính người đang đăng nhập
reviewRouter.get("/movie/:movieId/mine", authenticateToken, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const movieId = parseId(req.params.movieId);
    if (!user || !movieId) {
      return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ!" });
    }
    const review = await getUserReview(movieId, user.id);
    return res.json({ success: true, data: { review } });
  } catch (error) {
    console.error("Lỗi lấy đánh giá của tôi:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tải đánh giá của bạn!" });
  }
});

// POST /api/reviews - Body: { movieId, rating (1-5), comment? } - Tạo mới hoặc cập nhật đánh giá
reviewRouter.post("/", authenticateToken, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Vui lòng đăng nhập!" });
    }
    if (user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Chỉ tài khoản khách hàng mới có thể đánh giá phim!",
      });
    }

    const movieId = parseId(req.body?.movieId);
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment ?? "").trim();

    if (!movieId) {
      return res.status(400).json({ success: false, message: "Thiếu hoặc sai ID phim!" });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Điểm đánh giá phải từ 1 đến 5 sao!" });
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Nhận xét tối đa ${MAX_COMMENT_LENGTH} ký tự!`,
      });
    }

    const movie = await findMovieById(movieId);
    if (!movie) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phim!" });
    }

    const { id, created } = await upsertReview(user.id, movieId, rating, comment);
    const review = await getReviewById(id);
    const summary = await getReviewSummary(movieId);

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Cảm ơn bạn đã đánh giá phim!" : "Đã cập nhật đánh giá của bạn.",
      data: { review, summary },
    });
  } catch (error) {
    console.error("Lỗi gửi đánh giá:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi gửi đánh giá!" });
  }
});

// DELETE /api/reviews/:id - Chủ đánh giá hoặc admin/manager (kiểm duyệt) được xóa
reviewRouter.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const id = parseId(req.params.id);
    if (!user || !id) {
      return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ!" });
    }

    const review = await getReviewById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá!" });
    }

    const isOwner = review.userId === user.id;
    const isModerator = user.role === "admin" || user.role === "manager";
    if (!isOwner && !isModerator) {
      return res
        .status(403)
        .json({ success: false, message: "Bạn không có quyền xóa đánh giá này!" });
    }

    await deleteReviewById(id);
    const summary = await getReviewSummary(review.movieId);

    return res.json({ success: true, message: "Đã xóa đánh giá.", data: { summary } });
  } catch (error) {
    console.error("Lỗi xóa đánh giá:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi xóa đánh giá!" });
  }
});

export default reviewRouter;
