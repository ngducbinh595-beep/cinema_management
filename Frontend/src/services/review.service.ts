import { apiRequest, type ApiResponse } from "./api";

export interface MovieReview {
  id: number;
  movieId: number;
  userId: number;
  userName: string;
  rating: number;
  comment: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  average: number;
  total: number;
  distribution: Record<string, number>;
}

export interface ReviewListData {
  reviews: MovieReview[];
  summary: ReviewSummary;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReviewMutationData {
  review?: MovieReview | null;
  summary: ReviewSummary;
}

// Service đánh giá phim (chấm sao 1-5 + nhận xét)
export const reviewService = {
  async getByMovie(movieId: string | number, page = 1, limit = 10): Promise<ApiResponse<ReviewListData>> {
    return apiRequest<ReviewListData>(`/reviews/movie/${movieId}?page=${page}&limit=${limit}`);
  },

  async getMine(movieId: string | number): Promise<ApiResponse<{ review: MovieReview | null }>> {
    return apiRequest<{ review: MovieReview | null }>(`/reviews/movie/${movieId}/mine`);
  },

  async submit(movieId: string | number, rating: number, comment: string): Promise<ApiResponse<ReviewMutationData>> {
    return apiRequest<ReviewMutationData>("/reviews", {
      method: "POST",
      body: JSON.stringify({ movieId: Number(movieId), rating, comment }),
    });
  },

  async remove(reviewId: number): Promise<ApiResponse<ReviewMutationData>> {
    return apiRequest<ReviewMutationData>(`/reviews/${reviewId}`, { method: "DELETE" });
  },
};
