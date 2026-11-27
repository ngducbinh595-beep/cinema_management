import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface ReviewItem {
  id: number;
  movieId: number;
  userId: number;
  userName: string;
  rating: number;
  comment: string;
  /** true nếu người đánh giá đã có vé đã thanh toán cho phim này */
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  average: number;
  total: number;
  /** Số lượt theo từng mức sao: { "1": n, ..., "5": n } */
  distribution: Record<string, number>;
}

export async function initReviewsTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS reviews (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      movie_id INT UNSIGNED NOT NULL,
      rating TINYINT UNSIGNED NOT NULL,
      comment TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_review_user_movie (user_id, movie_id),
      INDEX idx_review_movie (movie_id, created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await pool.query(query);
  } catch (err) {
    console.error("Lỗi khởi tạo bảng reviews:", err);
  }
}

function mapRow(row: RowDataPacket): ReviewItem {
  return {
    id: Number(row.id),
    movieId: Number(row.movie_id),
    userId: Number(row.user_id),
    userName: String(row.user_name || "Khách hàng"),
    rating: Number(row.rating),
    comment: row.comment ? String(row.comment) : "",
    verified: Number(row.verified) === 1,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const SELECT_REVIEW = `
  SELECT r.id, r.user_id, r.movie_id, r.rating, r.comment, r.created_at, r.updated_at,
         u.name AS user_name,
         EXISTS(
           SELECT 1 FROM bookings b
           JOIN showtimes s ON s.id = b.showtime_id
           WHERE b.user_id = r.user_id AND s.movie_id = r.movie_id
             AND b.payment_status = 'paid' AND b.status <> 'cancelled'
         ) AS verified
  FROM reviews r
  JOIN users u ON u.id = r.user_id
`;

export async function getReviewsByMovie(
  movieId: number,
  limit: number,
  offset: number
): Promise<ReviewItem[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT_REVIEW} WHERE r.movie_id = ? ORDER BY r.updated_at DESC, r.id DESC LIMIT ? OFFSET ?`,
    [movieId, limit, offset]
  );
  return rows.map(mapRow);
}

export async function getUserReview(
  movieId: number,
  userId: number
): Promise<ReviewItem | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT_REVIEW} WHERE r.movie_id = ? AND r.user_id = ? LIMIT 1`,
    [movieId, userId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getReviewById(id: number): Promise<ReviewItem | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT_REVIEW} WHERE r.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getReviewSummary(movieId: number): Promise<ReviewSummary> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT rating, COUNT(*) AS cnt FROM reviews WHERE movie_id = ? GROUP BY rating",
    [movieId]
  );
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let total = 0;
  let sum = 0;
  for (const row of rows) {
    const rating = Number(row.rating);
    const cnt = Number(row.cnt);
    distribution[String(rating)] = cnt;
    total += cnt;
    sum += rating * cnt;
  }
  return {
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    distribution,
  };
}

/** Mỗi người dùng chỉ có 1 đánh giá / phim: gửi lại sẽ cập nhật đánh giá cũ */
export async function upsertReview(
  userId: number,
  movieId: number,
  rating: number,
  comment: string
): Promise<{ id: number; created: boolean }> {
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM reviews WHERE user_id = ? AND movie_id = ? LIMIT 1",
    [userId, movieId]
  );

  if (existing.length > 0) {
    await pool.query(
      "UPDATE reviews SET rating = ?, comment = ? WHERE id = ?",
      [rating, comment || null, existing[0].id]
    );
    return { id: Number(existing[0].id), created: false };
  }

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO reviews (user_id, movie_id, rating, comment) VALUES (?, ?, ?, ?)",
    [userId, movieId, rating, comment || null]
  );
  return { id: result.insertId, created: true };
}

export async function deleteReviewById(id: number): Promise<void> {
  await pool.query("DELETE FROM reviews WHERE id = ?", [id]);
}
