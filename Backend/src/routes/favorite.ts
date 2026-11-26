import { Router } from "express";
import {
  initFavoritesTable,
  getFavoriteMovieIds,
  toggleFavorite,
  removeFavorite,
} from "../models/favorite.model.js";

const favoriteRouter = Router();

// Tự động tạo bảng favorites khi server start
initFavoritesTable();

/** Đọc userId từ query/body, trả null nếu không hợp lệ */
function parseUserId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Chuẩn hóa movieId: string, 1..20 ký tự */
function parseMovieId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > 20) return null;
  return id;
}

// GET /api/favorites?userId=1 - Lấy danh sách phim yêu thích của người dùng
favoriteRouter.get("/", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu hoặc sai userId!",
      });
    }

    const movieIds = await getFavoriteMovieIds(userId);

    return res.json({
      success: true,
      data: { movieIds, total: movieIds.length },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách phim yêu thích:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải danh sách phim yêu thích!",
    });
  }
});

//POST /api/favorites/toggle - Body: { userId: number, movieId: string } - Bật/tắt yêu thích, trả về danh sách mới để frontend cập nhật ngay
favoriteRouter.post("/toggle", async (req, res) => {
  try {
    const userId = parseUserId(req.body?.userId);
    const movieId = parseMovieId(req.body?.movieId);

    if (!userId || !movieId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin userId hoặc movieId hợp lệ!",
      });
    }

    const result = await toggleFavorite(userId, movieId);

    return res.json({
      success: true,
      message: result.favorited
        ? "Đã thêm phim vào danh sách yêu thích!"
        : "Đã bỏ phim khỏi danh sách yêu thích.",
      data: result,
    });
  } catch (error) {
    console.error("Lỗi bật/tắt yêu thích:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật phim yêu thích!",
    });
  }
});

//DELETE /api/favorites/:movieId?userId=1 - Xóa 1 phim khỏi danh sách yêu thích
favoriteRouter.delete("/:movieId", async (req, res) => {
  try {
    const userId = parseUserId(req.query.userId);
    const movieId = parseMovieId(req.params.movieId);

    if (!userId || !movieId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin userId hoặc movieId hợp lệ!",
      });
    }

    const movieIds = await removeFavorite(userId, movieId);

    return res.json({
      success: true,
      message: "Đã xóa phim khỏi danh sách yêu thích.",
      data: { movieIds, total: movieIds.length },
    });
  } catch (error) {
    console.error("Lỗi xóa phim yêu thích:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa phim yêu thích!",
    });
  }
});

export default favoriteRouter;
