import { useState } from "react"
import { AlertCircle, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { roomService, type AdminRoom } from "@/services/room.service"

interface AddRoomModalProps {
  onClose: () => void
  onCreated: (room: AdminRoom) => void
}

/** Modal thêm phòng chiếu mới (ghi thẳng vào database) */
export const AddRoomModal = ({ onClose, onCreated }: AddRoomModalProps) => {
  const [name, setName] = useState("")
  const [format, setFormat] = useState("2D")
  const [audio, setAudio] = useState("Dolby Atmos")
  const [rows, setRows] = useState("8")
  const [cols, setCols] = useState("14")
  const [totalSeats, setTotalSeats] = useState("112")
  const [regularCount, setRegularCount] = useState("72")
  const [vipCount, setVipCount] = useState("40")
  const [vipRows, setVipRows] = useState("F,G,H")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError("Tên phòng không được để trống.")
      return
    }

    setIsSaving(true)
    setError(null)

    const res = await roomService.createRoom({
      cinemaId: 1,
      name: name.trim(),
      format: format.trim() || "2D",
      audio: audio.trim() || "Dolby Atmos",
      rowsCount: Number(rows) || 8,
      colsCount: Number(cols) || 14,
      totalSeats: Number(totalSeats) || Number(rows) * Number(cols) || 112,
      regularCount: Number(regularCount) || 0,
      vipCount: Number(vipCount) || 0,
      vipRows: vipRows.trim(),
    })

    setIsSaving(false)

    if (res.success && res.room) {
      onCreated(res.room)
      return
    }

    setError(res.message || "Không thể thêm phòng chiếu.")
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Thêm phòng chiếu"
      onClick={() => {
        if (!isSaving) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-[#2a3c25] bg-[#0b1310] p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#1f2c3d] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#caef6b]/15 text-[#caef6b]">
              <Plus className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Thêm phòng chiếu</h2>
              <p className="text-[11px] text-[#9ba9ba]">Phòng mới sẽ được lưu vào database.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#16202c] hover:text-white disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nr-name">Tên phòng *</Label>
            <Input
              id="nr-name"
              placeholder="Ví dụ: Phòng 07"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nr-format">Định dạng</Label>
              <Input id="nr-format" value={format} onChange={(e) => setFormat(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nr-audio">Âm thanh</Label>
              <Input id="nr-audio" value={audio} onChange={(e) => setAudio(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nr-rows">Số hàng</Label>
              <Input
                id="nr-rows"
                type="number"
                min={1}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nr-cols">Ghế / hàng</Label>
              <Input
                id="nr-cols"
                type="number"
                min={1}
                value={cols}
                onChange={(e) => setCols(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nr-total">Tổng ghế</Label>
              <Input
                id="nr-total"
                type="number"
                min={1}
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nr-regular">Ghế thường</Label>
              <Input
                id="nr-regular"
                type="number"
                min={0}
                value={regularCount}
                onChange={(e) => setRegularCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nr-vip">Ghế VIP</Label>
              <Input
                id="nr-vip"
                type="number"
                min={0}
                value={vipCount}
                onChange={(e) => setVipCount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nr-vip-rows">Hàng ghế VIP</Label>
            <Input
              id="nr-vip-rows"
              placeholder="F,G,H"
              value={vipRows}
              onChange={(e) => setVipRows(e.target.value)}
            />
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
              disabled={isSaving}
              className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white disabled:opacity-40"
            >
              Hủy
            </button>
            <Button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-xl bg-[#caef6b] px-5 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Đang lưu...
                </span>
              ) : (
                "Thêm phòng"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
