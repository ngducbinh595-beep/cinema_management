import { Type } from "@google/genai";
import { ai, GEMINI_MODEL } from "../config/gemini.js";
import {
  MovieScheduleData,
  RoomScheduleData,
  ExistingSlot,
  AutoScheduleOutput,
} from "../types/schedule.types.js";
import { validateAndCleanSchedule } from "./schedule-validator.service.js";
import { generateFallbackSchedule } from "./schedule-fallback.service.js";

const SCHEDULE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    schedule: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          roomId: { type: Type.INTEGER },
          movieId: { type: Type.INTEGER },
          startTime: { type: Type.STRING },
          endTime: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["roomId", "movieId", "startTime", "endTime", "reason"],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ["schedule", "summary"],
};

/**
 * Xếp lịch chiếu thông minh bằng AI Gemini, kết hợp kiểm tra xác thực và dự phòng
 */
export async function scheduleWithAI(
  date: string,
  movies: MovieScheduleData[],
  rooms: RoomScheduleData[],
  existingSlots: ExistingSlot[],
  cleaningBuffer: number
): Promise<AutoScheduleOutput> {
  // Chuẩn bị dữ liệu ngữ cảnh ngắn gọn cho AI
  const promptContext = {
    date,
    cleaningBufferMinutes: cleaningBuffer,
    operatingHours: "09:00 - 23:59",
    movies: movies.map((m) => ({
      id: m.id,
      title: m.title,
      rating: m.rating,
      genre: m.genre,
      durationMin: m.durationMin,
      isFeatured: m.isFeatured,
      revenue7d: m.revenue7d,
      hotScore: m.hotScore,
      preferredTimeSlot: m.preferredTimeSlot,
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      totalSeats: r.totalSeats,
      format: r.format,
      audio: r.audio,
      isPremium: r.isPremium,
    })),
    existingShowtimesInDB: existingSlots.map((e) => ({
      roomId: e.roomId,
      movieId: e.movieId,
      startTime: e.startTimeStr,
      endTime: e.endTimeStr,
    })),
  };

  const systemPrompt = `Bạn là chuyên gia điều hành và tối ưu hóa lịch chiếu rạp rạp Cinema Management.
Nhiệm vụ: Lập lịch chiếu tối ưu cho ngày ${date} dựa trên dữ liệu thật cung cấp.

BẮT BUỘC TUÂN THỦ CÁC QUY TẮC NGHIỆP VỤ SAU:
1. Giờ hoạt động rạp: từ 09:00 đến 23:59. Mọi suất chiếu phải kết thúc trước 00:00 (endTime <= 23:59).
2. Thời gian kết thúc: endTime = startTime + durationMin (thời lượng phim).
3. Thời gian dọn phòng: Suất kế tiếp trong cùng phòng phải bắt đầu >= endTime của suất trước + ${cleaningBuffer} phút.
4. Ưu tiên phòng và khung giờ:
   - Phim HOT (isFeatured = true hoặc hotScore cao hoặc doanh thu 7 ngày cao): Bắt buộc xếp vào phòng lớn nhất/IMAX/Dolby Atmos và khung giờ vàng (18:30 - 21:30).
   - Phim gia đình / Hoạt hình / Phân loại P: Xếp khung giờ ban ngày (09:00 - 16:00).
   - Phim hành động / Kinh dị / Phân loại T18: Xếp khung giờ tối muộn (21:30 - 23:30).
5. Đảm bảo độ bao phủ: TẤT CẢ các phim trong danh sách đều BẮT BUỘC có ít nhất 1 suất chiếu.
6. Tuyệt đối không trùng giờ trong cùng một phòng chiếu và KHÔNG ĐÈ LÊN các suất đã có trong DB (existingShowtimesInDB).
7. Lý do (reason): Mô tả ngắn gọn (1 câu tiếng Việt) giải thích lý do chọn phòng và khung giờ đó cho từng suất.
8. Tóm tắt (summary): Tóm tắt chiến lược tổng thể về việc phân bổ rạp, suất vàng, và tối ưu doanh thu.`;

  try {
    console.log(
      `[AI Auto-Schedule] Đang gọi Gemini (${GEMINI_MODEL}) cho ngày ${date}, ${movies.length} phim, ${rooms.length} phòng...`
    );

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nDữ liệu đầu vào chi tiết dạng JSON:\n${JSON.stringify(
                promptContext,
                null,
                2
              )}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2, // Nhiệt độ thấp để AI tuân thủ nghiêm ngặt logic lịch chiếu
        maxOutputTokens: 3000,
        responseMimeType: "application/json",
        responseSchema: SCHEDULE_RESPONSE_SCHEMA,
      },
    });

    const rawText = response.text || "";
    let parsed: { schedule?: any[]; summary?: string } = {};

    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn("[AI Auto-Schedule] Gemini trả JSON hỏng, chuyển sang fallback.", parseErr);
      return generateFallbackSchedule(movies, rooms, existingSlots, cleaningBuffer);
    }

    const rawSchedule = parsed.schedule || [];
    const aiSummary = parsed.summary || "Lịch chiếu tối ưu được tạo bởi AI Gemini.";

    // Backend tự validate kết quả trả về từ Gemini
    console.log(`[AI Auto-Schedule] Gemini trả về ${rawSchedule.length} suất. Đang kiểm tra tính hợp lệ...`);
    const validation = validateAndCleanSchedule(
      rawSchedule,
      movies,
      rooms,
      existingSlots,
      cleaningBuffer
    );

    if (validation.isValid && validation.schedule.length > 0) {
      console.log(`[AI Auto-Schedule] Lịch chiếu AI hợp lệ (${validation.schedule.length} suất)!`);
      return {
        source: "ai",
        schedule: validation.schedule,
        summary: aiSummary,
      };
    }

    console.warn(
      "[AI Auto-Schedule] Kết quả từ AI không vượt qua bước validate nghiêm ngặt:",
      validation.errors
    );
    console.log("[AI Auto-Schedule] Kích hoạt thuật toán Fallback dự phòng...");
    return generateFallbackSchedule(movies, rooms, existingSlots, cleaningBuffer);
  } catch (error: any) {
    console.error("[AI Auto-Schedule] Lỗi khi gọi Gemini (mạng/timeout/quota):", error?.message || error);
    console.log("[AI Auto-Schedule] Chuyển hướng sang thuật toán Fallback dự phòng...");
    return generateFallbackSchedule(movies, rooms, existingSlots, cleaningBuffer);
  }
}
