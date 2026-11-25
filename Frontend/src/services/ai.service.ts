import { apiRequest } from "./api";
import type { AutoScheduleResult } from "@/constants/adminSchedule";

export interface AIMoodRecommendation {
  title: string;
  genre: string;
  matchScore: number;
  reason: string;
  aiReply?: string;
}

export interface AIMoodRequestParams {
  mood?: string;
  userInput?: string;
  excludeTitles?: string[];
}

export interface AIMoodResponse {
  success: boolean;
  data?: AIMoodRecommendation;
  recommendation?: string;
  mood?: string;
  error?: string;
  message?: string;
}

export interface AutoSchedulePayload {
  date: string; // YYYY-MM-DD
  movieIds: number[];
  roomIds: number[];
  cleaningBufferMinutes: number;
}

/** Backend trả các field ở top-level: { success, source, schedule, summary } */
export interface AutoScheduleResponse extends Partial<AutoScheduleResult> {
  success: boolean;
  message?: string;
  error?: string;
}

export const aiService = {
  /**
   * Gửi cảm xúc và ý kiến/nhu cầu của khách hàng tới AI để nhận gợi ý phim thông minh
   */
  async getMoodRecommendation(params: AIMoodRequestParams): Promise<AIMoodResponse> {
    const res = await apiRequest<AIMoodRecommendation>("/ai/mood-recommend", {
      method: "POST",
      body: JSON.stringify(params),
      // AI có 25s; quá thời gian này modal tự dùng gợi ý dự phòng
      timeoutMs: 25000,
    });

    if (res.success && res.data) {
      return {
        success: true,
        data: res.data,
      };
    }

    return {
      success: false,
      message: res.message || "Không thể lấy gợi ý từ AI",
    };
  },

  /**
   * Gửi câu hỏi chat tới AI tư vấn rạp phim
   */
  async chatWithAI(
    message: string
  ): Promise<{ success: boolean; reply?: string; recommendedMovies?: any[]; error?: string }> {
    const res = await apiRequest<{ success: boolean; reply: string; recommendedMovies?: any[] }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
      timeoutMs: 25000,
    });

    if (res.success && (res as any).reply) {
      return {
        success: true,
        reply: (res as any).reply,
        recommendedMovies: (res as any).recommendedMovies || [],
      };
    }

    return {
      success: false,
      reply: (res as any)?.reply,
      error: res.message || "Lỗi trò chuyện với AI",
    };
  },

  /**
   * Admin: nhờ AI xếp lịch chiếu tự động cho 1 ngày.
   * Yêu cầu tài khoản admin (JWT có role="admin") — `apiRequest` tự gắn Bearer token.
   */
  async autoSchedule(payload: AutoSchedulePayload): Promise<AutoScheduleResponse> {
    const res = await apiRequest<AutoScheduleResult>("/ai/admin/auto-schedule", {
      method: "POST",
      body: JSON.stringify(payload),
      // AI + validate có thể lâu hơn chat thường
      timeoutMs: 60000,
    });

    return res as AutoScheduleResponse;
  },

  /**
   * Admin: Dự báo doanh thu và phân tích chuyên sâu từ AI
   */
  async getForecastInsights(
    payload: ForecastInsightsPayload = {}
  ): Promise<ForecastInsightsResponse> {
    const res = await apiRequest<ForecastInsightsResponse>(
      "/ai/admin/forecast-insights",
      {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 30000,
      }
    );

    return res as ForecastInsightsResponse;
  },
};

export interface RiskyShowtimeItem {
  showtimeId: number;
  movie: string;
  time: string;
  fillRate: number;
  suggestion: string;
}

export interface RecommendationItem {
  type: "add_showtime" | "promotion" | "pricing";
  text: string;
}

export interface ForecastData {
  tomorrowRevenue: number;
  weekRevenue: number;
  growthPercent: number;
}

export interface ForecastInsightsPayload {
  date?: string;
  forceRefresh?: boolean;
}

export interface ForecastInsightsResponse {
  success: boolean;
  source?: "ai" | "fallback";
  forecast?: ForecastData;
  riskyShowtimes?: RiskyShowtimeItem[];
  executiveSummary?: string;
  recommendations?: RecommendationItem[];
  message?: string;
  error?: string;
}

