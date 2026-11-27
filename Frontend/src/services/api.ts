// Cấu hình API cơ sở cho kết nối Frontend -> Backend
export const API_BASE_URL = "http://localhost:3001/api";

// Mặc định 30s: tránh trường hợp request treo khiến UI quay vô hạn
export const DEFAULT_TIMEOUT_MS = 30000;

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  token?: string;
  data?: T;
  user?: T;
  cached?: boolean;
}
export const ApiResponse = {};

export interface ApiRequestInit extends RequestInit {
  /** Thời gian chờ tối đa (ms) cho request này */
  timeoutMs?: number;
}

// Hàm gọi API tổng quát (bọc fetch với xử lý JSON, timeout và bắt lỗi)
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestInit = {}
): Promise<ApiResponse<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = options;
  const url = `${API_BASE_URL}${endpoint}`;

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };

  // Hủy request sau timeoutMs để không phải chờ vô hạn
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort);

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ...(typeof data === "object" && data !== null ? data : {}),
        success: false,
        message: data.message || data.error || `Lỗi yêu cầu: mã lỗi ${response.status}`,
      };
    }

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error(`Lỗi kết nối API tại ${endpoint}:`, error);

    // Timeout do chính mình chủ động hủy (không phải caller hủy)
    if (controller.signal.aborted && !signal?.aborted) {
      return {
        success: false,
        message: `Máy chủ phản hồi quá lâu (quá ${Math.round(timeoutMs / 1000)}s). Vui lòng thử lại!`,
      };
    }

    return {
      success: false,
      message: "Không thể kết nối đến máy chủ Backend (Port 3001). Vui lòng kiểm tra server!",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}
