import { useEffect, useState } from "react"
import { AlertCircle, Check, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AutoScheduleResultView } from "./AutoScheduleResultView"
import { aiService } from "@/services"
import {
  ADMIN_MOVIES,
  ADMIN_ROOMS,
  todayISO,
  type AutoScheduleResult,
} from "@/constants/adminSchedule"

interface AutoScheduleModalProps {
  onClose: () => void
  /** Ghi kết quả vào DB (bulk create showtimes) — bắt buộc để "Áp dụng" hoạt động */
  onApply?: (result: AutoScheduleResult, date: string) => Promise<{ success: boolean; message?: string }>
  onApplied?: (date: string, result: AutoScheduleResult) => void
}

const DEFAULT_ROOM_IDS = [1, 2, 3, 4]

/**
 * Modal Admin: chọn ngày / phim / phòng / buffer rồi gọi
 * POST /api/ai/admin/auto-schedule (Gemini + validate + fallback).
 * Component chỉ được mount khi mở (parent render có điều kiện) nên state luôn mới.
 */
export const AutoScheduleModal = ({ onClose, onApply, onApplied }: AutoScheduleModalProps) => {
  const [date, setDate] = useState(todayISO())
  const [movieIds, setMovieIds] = useState<number[]>(ADMIN_MOVIES.map((m) => m.id))
  const [roomIds, setRoomIds] = useState<number[]>(DEFAULT_ROOM_IDS)
  const [buffer, setBuffer] = useState(15)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AutoScheduleResult | null>(null)
  const [applied, setApplied] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Đóng bằng phím Esc
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isLoading, onClose])

  const toggleNumber = (
    value: number,
    list: number[],
    setList: (next: number[]) => void
  ) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  const handleGenerate = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Vui lòng chọn ngày chiếu hợp lệ.")
      return
    }
    if (movieIds.length === 0) {
      setError("Vui lòng chọn ít nhất 1 phim để xếp lịch.")
      return
    }
    if (roomIds.length === 0) {
      setError("Vui lòng chọn ít nhất 1 phòng chiếu.")
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    setApplied(false)

    const res = await aiService.autoSchedule({
      date,
      movieIds,
      roomIds,
      cleaningBufferMinutes: buffer,
    })

    setIsLoading(false)

    if (res.success && Array.isArray(res.schedule) && res.schedule.length > 0) {
      setResult({
        source: res.source === "ai" ? "ai" : "fallback",
        schedule: res.schedule,
        summary: res.summary || "Lịch chiếu được tối ưu tự động.",
      })
      return
    }

    setError(
      res.message ||
        res.error ||
        "AI chưa tạo được lịch chiếu. Vui lòng thử lại hoặc kiểm tra đăng nhập admin."
    )
  }

  const handleApply = async () => {
    if (!result || !onApply) return

    setIsApplying(true)
    setError(null)

    const res = await onApply(result, date)
    setIsApplying(false)

    if (!res.success) {
      setError(res.message || "Không thể ghi lịch chiếu vào database. Vui lòng thử lại.")
      return
    }

    setApplied(true)
    onApplied?.(date, result)
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AI xếp lịch chiếu tự động"
      onClick={() => {
        if (!isLoading) onClose()
      }}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#2a3c25] bg-[#0b1310] p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1f2c3d] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#caef6b]/15 text-[#caef6b]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Xếp lịch tự động</h2>
              <p className="text-[11px] text-[#9ba9ba]">
                Gemini phân bổ phim theo phòng, khung giờ vàng và thời gian dọn phòng.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#16202c] hover:text-white disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        {!result ? (
          <div className="mt-5 space-y-5">
            {/* Ngày + buffer */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="ai-date" className="text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
                  Ngày chiếu
                </label>
                <input
                  id="ai-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#243041] bg-[#121923] px-3 text-sm text-[#f4f6f7] [color-scheme:dark] focus:border-[#caef6b] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ai-buffer" className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
                  <span>Buffer dọn phòng</span>
                  <span className="text-[#f4f6f7]">{buffer} phút</span>
                </label>
                <input
                  id="ai-buffer"
                  type="range"
                  min={15}
                  max={20}
                  step={1}
                  value={buffer}
                  onChange={(event) => setBuffer(Number(event.target.value))}
                  className="h-10 w-full accent-[#caef6b]"
                />
                <p className="text-[10px] text-[#9ba9ba]">Cho phép 15–20 phút giữa 2 suất cùng phòng.</p>
              </div>
            </div>

            {/* Phim */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
                  Phim cần xếp lịch ({movieIds.length}/{ADMIN_MOVIES.length})
                </span>
                <div className="flex gap-2 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setMovieIds(ADMIN_MOVIES.map((m) => m.id))}
                    className="text-[#9ba9ba] hover:text-white"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovieIds([])}
                    className="text-[#9ba9ba] hover:text-white"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              <div className="grid max-h-40 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {ADMIN_MOVIES.map((movie) => {
                  const active = movieIds.includes(movie.id)
                  return (
                    <label
                      key={movie.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[11px] transition-colors ${
                        active
                          ? "border-[#caef6b]/60 bg-[#162518] text-white"
                          : "border-[#243041] bg-[#121923] text-[#9ba9ba] hover:border-[#35465d]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleNumber(movie.id, movieIds, setMovieIds)}
                        className="size-3.5 accent-[#caef6b]"
                      />
                      <span className="truncate font-semibold">{movie.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-[#9ba9ba]">{movie.duration}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Phòng */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
                  Phòng chiếu ({roomIds.length}/{ADMIN_ROOMS.length})
                </span>
                <div className="flex gap-2 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setRoomIds(ADMIN_ROOMS.map((r) => r.id))}
                    className="text-[#9ba9ba] hover:text-white"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomIds([])}
                    className="text-[#9ba9ba] hover:text-white"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {ADMIN_ROOMS.map((room) => {
                  const active = roomIds.includes(room.id)
                  return (
                    <label
                      key={room.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[11px] transition-colors ${
                        active
                          ? "border-[#caef6b]/60 bg-[#162518] text-white"
                          : "border-[#243041] bg-[#121923] text-[#9ba9ba] hover:border-[#35465d]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleNumber(room.id, roomIds, setRoomIds)}
                        className="size-3.5 accent-[#caef6b]"
                      />
                      <span className="font-semibold">{room.name}</span>
                      <span className="ml-auto text-[10px] text-[#9ba9ba]">{room.format}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-3 py-2.5 text-[11px] text-[#ffb4b4]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-[#1f2c3d] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white disabled:opacity-40"
              >
                Hủy
              </button>
              <Button
                onClick={() => void handleGenerate()}
                disabled={isLoading}
                className="h-10 rounded-xl bg-[#caef6b] px-5 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Gemini đang tối ưu lịch...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4" />
                    Xếp lịch bằng AI
                  </span>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {applied && (
              <div className="flex items-center gap-2 rounded-xl border border-[#2a3c25] bg-[#162518] px-3 py-2 text-[11px] font-semibold text-[#caef6b]">
                <Check className="size-4" />
                Đã ghi lịch chiếu vào database. Mở trang Suất chiếu để xem.
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-3 py-2.5 text-[11px] text-[#ffb4b4]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <AutoScheduleResultView
              result={result}
              date={date}
              applied={applied}
              applying={isApplying}
              onApply={() => void handleApply()}
              onRetry={() => {
                setResult(null)
                setApplied(false)
                setError(null)
              }}
            />

            <div className="flex justify-end border-t border-[#1f2c3d] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
