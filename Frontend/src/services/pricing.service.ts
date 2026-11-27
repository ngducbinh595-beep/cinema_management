import { apiRequest, type ApiResponse } from "./api";

export interface PricingTier {
  id: number;
  cinemaId: number;
  timeSlot: string;
  applyDays: string;
  regularPrice: number;
  vipPrice: number;
  canApplyToShowtimes: boolean;
}

export interface UpdateTierResponse {
  success: boolean;
  message?: string;
  data?: { tier: PricingTier; updatedShowtimes: number };
}

// Service bảng giá vé theo khung giờ
export const pricingService = {
  async getTiers(cinemaId?: number): Promise<ApiResponse<PricingTier[]>> {
    return apiRequest<PricingTier[]>(`/pricing${cinemaId ? `?cinemaId=${cinemaId}` : ""}`);
  },

  /** Admin/Manager: sửa giá 1 khung giờ (tùy chọn áp xuống các suất chiếu sắp tới) */
  async updateTier(
    id: number,
    payload: { regularPrice: number; vipPrice: number; applyToShowtimes: boolean }
  ): Promise<UpdateTierResponse> {
    return apiRequest(`/pricing/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }) as unknown as Promise<UpdateTierResponse>;
  },
};
