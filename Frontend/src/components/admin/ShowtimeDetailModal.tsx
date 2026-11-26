import { useState } from "react"
import { AlertTriangle, CalendarClock, Clock, MapPin, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TimelineBlock } from "@/constants/adminSchedule"

interface ShowtimeDetailModalProps {
  block: TimelineBlock
  onClose: () => void
  onCancel: (block: TimelineBlock) => void
}

const SOURCE_LABEL: Record<string, string> = {
  mock: "Dữ liệu mẫu",
  manual: "Admin tạo tay",
  ai: "AI xếp lịch",
  db: "Lịch trong database",
}

/** Xem chi tiết 1 suất chiếu và hủy nó khỏi timeline */
export const ShowtimeDetailModal = ({ block, onClose, onCancel }: ShowtimeDetailModalProps) => {
  const [confirming, setConfirming] = useState(false)
  const source = block.source || "db"

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết suất chiếu"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[#243041] bg-[#0b1310] p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#1f2c3d] pb-4">
          <div>
            <h2 className="text-base font-bold text-white">Chi tiết suất chiếu</h2>
            <p className="mt-0.5 text-[11px] text-[#9ba9ba]">Bấm hủy để xóa khỏi timeline.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#16202c] hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="rounded-2xl border border-[#243041] bg-[#121923] p-4">
            <div className="text-sm font-bold text-white">{block.movieTitle}</div>
            <div className="mt-3 space-y-2 text-[#d3dce7]">
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-[#caef6b]" />
                {block.room}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 text-[#caef6b]" />
                {block.startTime} - {block.endTime}
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="size-3.5 text-[#caef6b]" />
                {block.format}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#243041] bg-[#0e141d] px-3 py-2">
            <span className="text-[#9ba9ba]">Nguồn suất chiếu</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2d3e54] bg-[#16202c] px-2 py-0.5 text-[10px] font-bold text-[#d3dce7]">
              {SOURCE_LABEL[source] || "Không rõ"}
            </span>
          </div>

          {confirming ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-3 py-2.5 text-[11px] text-[#ffb4b4]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Xác nhận hủy suất <b>{block.startTime}</b> tại <b>{block.room}</b>? Thao tác này
                không thể hoàn tác.
              </span>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#9ba9ba]">
              Hủy suất sẽ bỏ suất này khỏi timeline hiện tại. Suất do AI xếp cũng sẽ bị xóa khỏi lịch
              đã áp dụng.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#1f2c3d] pt-4 sm:flex-row sm:justify-end">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white"
              >
                Không hủy
              </button>
              <Button
                onClick={() => onCancel(block)}
                className="h-10 rounded-xl bg-[#d9534f] px-5 text-xs font-bold text-white hover:bg-[#c9302c]"
              >
                <Trash2 className="mr-1.5 size-4" />
                Xác nhận hủy
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white"
              >
                Đóng
              </button>
              <Button
                onClick={() => setConfirming(true)}
                className="h-10 rounded-xl border border-[#682424] bg-[#2d1515] px-5 text-xs font-bold text-[#ff8e8e] hover:bg-[#3a1a1a]"
              >
                <Trash2 className="mr-1.5 size-4" />
                Hủy suất chiếu
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
