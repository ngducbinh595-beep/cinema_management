import { ArrowRight, CalendarDays, CheckCircle2, Clock, Cpu, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  formatISOToVN,
  roomFormatLabel,
  roomName,
  movieTitle,
  type AutoScheduleResult,
} from "@/constants/adminSchedule"

interface AutoScheduleResultViewProps {
  result: AutoScheduleResult
  date: string
  applied: boolean
  applying?: boolean
  onApply: () => void
  onRetry: () => void
}

/** Bảng kết quả AI xếp lịch: nguồn, tóm tắt chiến lược, suất chiếu theo phòng */
export const AutoScheduleResultView = ({
  result,
  date,
  applied,
  applying = false,
  onApply,
  onRetry,
}: AutoScheduleResultViewProps) => {
  const isAI = result.source === "ai"
  const roomIds = Array.from(new Set(result.schedule.map((slot) => slot.roomId)))

  return (
    <div className="space-y-4">
      {/* Nguồn + tóm tắt */}
      <div className="rounded-2xl border border-[#2a3c25] bg-[#121f15] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              isAI
                ? "border-[#caef6b]/40 bg-[#caef6b]/15 text-[#caef6b]"
                : "border-[#5c3e1e] bg-[#2d1e10] text-[#ffbd7a]"
            }`}
          >
            {isAI ? <Sparkles className="size-3.5" /> : <Cpu className="size-3.5" />}
            {isAI ? "AI Gemini" : "Thuật toán tối ưu"}
          </span>

          <div className="flex items-center gap-4 text-[11px] text-[#9ba9ba]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-[#caef6b]" />
              {formatISOToVN(date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-[#caef6b]" />
              {result.schedule.length} suất · {roomIds.length} phòng
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#d3dce7]">
          <span className="font-bold text-white">Chiến lược: </span>
          {result.summary}
        </p>
      </div>

      {/* Suất chiếu theo từng phòng */}
      <div className="space-y-3">
        {roomIds.map((roomId) => {
          const slots = result.schedule
            .filter((slot) => slot.roomId === roomId)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))

          return (
            <div key={roomId} className="overflow-hidden rounded-2xl border border-[#243041] bg-[#0e141d]">
              <div className="flex items-center justify-between border-b border-[#243041] bg-[#121923] px-4 py-2.5">
                <span className="text-xs font-bold text-white">{roomName(roomId)}</span>
                <span className="text-[10px] font-semibold text-[#9ba9ba]">{roomFormatLabel(roomId)}</span>
              </div>

              <div className="divide-y divide-[#1f2c3d]/60">
                {slots.map((slot, index) => (
                  <div key={`${roomId}-${slot.startTime}-${index}`} className="flex gap-3 px-4 py-2.5">
                    <div className="w-28 shrink-0 text-xs font-bold text-[#caef6b]">
                      {slot.startTime} - {slot.endTime}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">
                        {movieTitle(slot.movieId)}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-[#9ba9ba]">{slot.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hành động */}
      <div className="flex flex-col gap-2 border-t border-[#1f2c3d] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white"
        >
          Xếp lại với cấu hình khác
        </button>

        {applied ? (
          <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2a3c25] bg-[#162518] px-4 py-2.5 text-xs font-bold text-[#caef6b]">
            <CheckCircle2 className="size-4" />
            Đã thêm {result.schedule.length} suất vào database
          </span>
        ) : (
          <Button
            onClick={onApply}
            disabled={applying}
            className="h-10 rounded-xl bg-[#caef6b] px-5 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
          >
            {applying ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Đang lưu vào database...
              </>
            ) : (
              <>
                Áp dụng vào lịch chiếu
                <ArrowRight className="ml-1.5 size-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
