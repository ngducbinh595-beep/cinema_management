import { apiRequest, type ApiResponse } from "./api";

export interface FavoriteListData {
  movieIds: string[];
  total: number;
}

export interface ToggleFavoriteData extends FavoriteListData {
  favorited: boolean;
}

// Service quản lý phim yêu thích của người dùng
export const favoriteService = {
  // Danh sách id phim yêu thích của user
  async getMyFavorites(userId: number): Promise<ApiResponse<FavoriteListData>> {
    return apiRequest<FavoriteListData>(`/favorites?userId=${userId}`);
  },

  // Bật/tắt yêu thích 1 phim, trả về danh sách mới
  async toggle(userId: number, movieId: string): Promise<ApiResponse<ToggleFavoriteData>> {
    return apiRequest<ToggleFavoriteData>("/favorites/toggle", {
      method: "POST",
      body: JSON.stringify({ userId, movieId }),
    });
  },

  /** Xóa 1 phim khỏi danh sách yêu thích */
  async remove(userId: number, movieId: string): Promise<ApiResponse<FavoriteListData>> {
    return apiRequest<FavoriteListData>(`/favorites/${encodeURIComponent(movieId)}?userId=${userId}`, {
      method: "DELETE",
    });
  },
};
