import { Router } from "express";
import {
  getAllMovies,
  findMovieById,
  createMovie,
  updateMovieById,
  countShowtimesByMovie,
  deleteMovieById,
  type MovieInput,
} from "../models/movie.model.js";
import { authenticateToken, requireManagerOrAdmin } from "./auth.js";

const movieRouter = Router();

const RATINGS = ["P", "T13", "T16", "T18"];
const STATUSES = ["now_showing", "coming_soon", "ended"];

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Chuẩn hóa dữ liệu phim gửi lên (chỉ nhận field hợp lệ) */
function normalizeMovieInput(body: Record<string, unknown>): {
  data: MovieInput;
  error?: string;
} {
  const data: MovieInput = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return { data, error: "Tên phim không được để trống!" };
    data.title = title;
  }
  if (body.genre !== undefined) {
    const genre = String(body.genre).trim();
    if (!genre) return { data, error: "Thể loại không được để trống!" };
    data.genre = genre;
  }
  if (body.duration_min !== undefined) {
    const duration = Number(body.duration_min);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
      return { data, error: "Thời lượng phải là số phút từ 1 đến 600!" };
    }
    data.duration_min = duration;
  }
  if (body.rating !== undefined) {
    const rating = String(body.rating);
    if (!RATINGS.includes(rating)) {
      return { data, error: "Phân loại độ tuổi không hợp lệ!" };
    }
    data.rating = rating;
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!STATUSES.includes(status)) {
      return { data, error: "Trạng thái phim không hợp lệ!" };
    }
    data.status = status;
  }
  if (body.synopsis !== undefined) data.synopsis = String(body.synopsis);
  if (body.director !== undefined) data.director = String(body.director);
  if (body.cast_members !== undefined) data.cast_members = String(body.cast_members);
  if (body.country !== undefined) data.country = String(body.country);
  if (body.format !== undefined) data.format = String(body.format);
  if (body.poster_url !== undefined) data.poster_url = String(body.poster_url);
  if (body.trailer_url !== undefined) data.trailer_url = String(body.trailer_url);
  if (body.ai_recommendation !== undefined) {
    data.ai_recommendation = String(body.ai_recommendation);
  }
  if (body.is_featured !== undefined) data.is_featured = Boolean(body.is_featured);

  if (body.release_date !== undefined) {
    if (body.release_date === null || body.release_date === "") {
      data.release_date = null;
    } else {
      const value = String(body.release_date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { data, error: "Ngày khởi chiếu phải có định dạng YYYY-MM-DD!" };
      }
      data.release_date = value;
    }
  }

  return { data };
}

// GET /api/movies - Danh sách phim (công khai) kèm showtime_count để admin biết phim nào đang có lịch chiếu
movieRouter.get("/", async (_req, res) => {
  try {
    const movies = await getAllMovies();
    return res.json({ success: true, data: movies });
  } catch (error) {
    console.error("Lỗi lấy danh sách phim:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tải danh sách phim!",
    });
  }
});

// POST /api/movies (admin) - Thêm phim mới vào database
movieRouter.post("/", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { data, error } = normalizeMovieInput(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    if (!data.title || !data.genre || data.duration_min === undefined) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập Tên phim, Thể loại và Thời lượng!",
      });
    }

    const id = await createMovie({
      ...data,
      title: data.title,
      genre: data.genre,
      duration_min: data.duration_min,
    });
    const movie = await findMovieById(id);

    return res.status(201).json({
      success: true,
      message: "Đã thêm phim mới vào database!",
      movie,
    });
  } catch (error) {
    console.error("Lỗi thêm phim:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi thêm phim!",
    });
  }
});

// PUT /api/movies/:id (admin) - Cập nhật thông tin phim
movieRouter.put("/:id", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "ID phim không hợp lệ!" });
    }

    const existing = await findMovieById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phim!" });
    }

    const { data, error } = normalizeMovieInput(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    const updated = await updateMovieById(id, data);
    if (!updated) {
      return res.status(400).json({ success: false, message: "Không có thay đổi nào để lưu!" });
    }

    const movie = await findMovieById(id);
    return res.json({ success: true, message: "Đã cập nhật phim!", movie });
  } catch (error) {
    console.error("Lỗi cập nhật phim:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật phim!",
    });
  }
});

// DELETE /api/movies/:id (admin) - Chặn xóa nếu phim còn suất chiếu (tránh cascade làm mất lịch sử đặt vé)
movieRouter.delete("/:id", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "ID phim không hợp lệ!" });
    }

    const existing = await findMovieById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phim!" });
    }

    const showtimeCount = await countShowtimesByMovie(id);
    if (showtimeCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Phim đang có ${showtimeCount} suất chiếu nên không thể xóa. Hãy chuyển trạng thái sang "Ngừng chiếu" thay thế.`,
        showtimeCount,
      });
    }

    await deleteMovieById(id);
    return res.json({ success: true, message: `Đã xóa phim ${existing.title}.` });
  } catch (error: any) {
    console.error("Lỗi xóa phim:", error);
    if (error?.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Phim đang được tham chiếu bởi suất chiếu/đơn đặt vé nên không thể xóa!",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa phim!",
    });
  }
});

export default movieRouter;
