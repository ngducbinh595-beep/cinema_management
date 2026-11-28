import { pool } from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface MovieRow {
  id: number;
  title: string;
  rating: "P" | "T13" | "T16" | "T18";
  genre: string;
  duration_min: number;
  synopsis: string | null;
  director: string | null;
  cast_members: string | null;
  release_date: string | null;
  country: string | null;
  format: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  ai_recommendation: string | null;
  status: "now_showing" | "coming_soon" | "ended";
  is_featured: number;
  created_at: Date;
  updated_at: Date;
  showtime_count?: number;
}

export interface MovieInput {
  title?: string;
  rating?: string;
  genre?: string;
  duration_min?: number;
  synopsis?: string;
  director?: string;
  cast_members?: string;
  release_date?: string | null;
  country?: string;
  format?: string;
  poster_url?: string;
  trailer_url?: string;
  ai_recommendation?: string;
  status?: string;
  is_featured?: boolean;
}

/** Toàn bộ phim kèm số suất chiếu (để UI biết phim nào xóa được) */
export async function getAllMovies(): Promise<MovieRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.*,
            (SELECT COUNT(*) FROM showtimes s WHERE s.movie_id = m.id AND s.status <> 'cancelled') AS showtime_count
     FROM movies m
     ORDER BY m.id ASC`
  );
  return rows as MovieRow[];
}

export async function findMovieById(id: number): Promise<MovieRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.*,
            (SELECT COUNT(*) FROM showtimes s WHERE s.movie_id = m.id AND s.status <> 'cancelled') AS showtime_count
     FROM movies m
     WHERE m.id = ?
     LIMIT 1`,
    [id]
  );
  return (rows[0] as MovieRow) || null;
}

/** Tạo phim mới, trả về id */
export async function createMovie(data: Required<Pick<MovieInput, "title" | "genre" | "duration_min">> & MovieInput): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO movies
       (title, rating, genre, duration_min, synopsis, director, cast_members,
        release_date, country, format, poster_url, trailer_url, ai_recommendation,
        status, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.rating || "T13",
      data.genre,
      data.duration_min,
      data.synopsis || null,
      data.director || null,
      data.cast_members || null,
      data.release_date || null,
      data.country || null,
      data.format || "2D · Phụ đề Việt",
      data.poster_url || null,
      data.trailer_url || null,
      data.ai_recommendation || null,
      data.status || "now_showing",
      data.is_featured ? 1 : 0,
    ]
  );
  return result.insertId;
}

/** Cập nhật phim (chỉ các field được truyền) */
export async function updateMovieById(id: number, data: MovieInput): Promise<boolean> {
  const fields: string[] = [];
  const params: unknown[] = [];

  const push = (column: string, value: unknown) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };

  if (data.title !== undefined) push("title", data.title);
  if (data.rating !== undefined) push("rating", data.rating);
  if (data.genre !== undefined) push("genre", data.genre);
  if (data.duration_min !== undefined) push("duration_min", data.duration_min);
  if (data.synopsis !== undefined) push("synopsis", data.synopsis);
  if (data.director !== undefined) push("director", data.director);
  if (data.cast_members !== undefined) push("cast_members", data.cast_members);
  if (data.release_date !== undefined) push("release_date", data.release_date);
  if (data.country !== undefined) push("country", data.country);
  if (data.format !== undefined) push("format", data.format);
  if (data.poster_url !== undefined) push("poster_url", data.poster_url);
  if (data.trailer_url !== undefined) push("trailer_url", data.trailer_url);
  if (data.ai_recommendation !== undefined) push("ai_recommendation", data.ai_recommendation);
  if (data.status !== undefined) push("status", data.status);
  if (data.is_featured !== undefined) push("is_featured", data.is_featured ? 1 : 0);

  if (fields.length === 0) return false;

  params.push(id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE movies SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

/** Đếm suất chiếu (chặn xóa phim đã có lịch chiếu) */
export async function countShowtimesByMovie(id: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM showtimes WHERE movie_id = ? AND status <> 'cancelled'",
    [id]
  );
  return Number(rows[0]?.total || 0);
}

/** Xóa phim (FK showtimes là CASCADE, nhưng route sẽ chặn nếu còn suất chiếu) */
export async function deleteMovieById(id: number): Promise<void> {
  await pool.query("DELETE FROM movies WHERE id = ?", [id]);
}
