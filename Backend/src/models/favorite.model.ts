import { pool } from "../config/db.js";
import type { RowDataPacket } from "mysql2";

export async function initFavoritesTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS favorites (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      movie_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_movie (user_id, movie_id),
      INDEX idx_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await pool.query(query);
  } catch (err) {
    console.error("Lỗi khởi tạo bảng favorites:", err);
  }
}

export async function getFavoriteMovieIds(userId: number): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT movie_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC, id DESC",
    [userId]
  );
  return rows.map((row) => String(row.movie_id));
}

export async function toggleFavorite(
  userId: number,
  movieId: string | number
): Promise<{ favorited: boolean; movieIds: string[]; total: number }> {
  const numMovieId = Number(movieId);
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM favorites WHERE user_id = ? AND movie_id = ? LIMIT 1",
    [userId, numMovieId]
  );

  const wasFavorited = existing.length > 0;

  if (wasFavorited) {
    await pool.query("DELETE FROM favorites WHERE user_id = ? AND movie_id = ?", [
      userId,
      numMovieId,
    ]);
  } else {
    await pool.query("INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)", [
      userId,
      numMovieId,
    ]);
  }

  const movieIds = await getFavoriteMovieIds(userId);
  return { favorited: !wasFavorited, movieIds, total: movieIds.length };
}

/** Xóa 1 phim khỏi danh sách yêu thích (dùng cho nút tim ở trang Yêu thích) */
export async function removeFavorite(
  userId: number,
  movieId: string | number
): Promise<string[]> {
  const numMovieId = Number(movieId);
  await pool.query("DELETE FROM favorites WHERE user_id = ? AND movie_id = ?", [
    userId,
    numMovieId,
  ]);
  return getFavoriteMovieIds(userId);
}

/** Đếm nhanh số phim yêu thích (dùng cho badge trên Navbar sau này) */
export async function countFavorites(userId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?",
    [userId]
  );
  return Number(rows[0]?.total || 0);
}
