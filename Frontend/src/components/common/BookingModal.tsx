import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Calendar, MapPin, Ticket, Check, Film } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  movieTitle?: string
  cinema?: string
  date?: string
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  movieTitle = "Tín hiệu từ ngày mai",
  cinema = "Cinema Nguyễn Du",
  date = "24/10/2026",
}) => {
  const navigate = useNavigate()
  const [selectedTime, setSelectedTime] = useState("19:30")
  const [selectedSeatType, setSelectedSeatType] = useState("VIP")
  const [ticketCount, setTicketCount] = useState(2)
  const [booked, setBooked] = useState(false)

  if (!isOpen) return null

  const showtimes = ["14:15", "16:45", "19:30", "21:45", "23:50"]
  const seatPrices: Record<string, number> = {
    Standard: 95000,
    VIP: 120000,
    Sweetbox: 240000,
  }

  const handleBookingConfirm = () => {
    const savedUser = localStorage.getItem("user")
    if (!savedUser) {
      onClose()
      navigate("/login")
      return
    }

    setBooked(true)
    setTimeout(() => {
      setBooked(false)
      onClose()
    }, 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#243041] bg-[#121923] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
          <div className="flex items-center gap-2">
            <Ticket className="size-5 text-[#caef6b]" />
            <h3 className="font-bold text-white text-base">Đặt vé xem phim</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#192331] hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {booked ? (
          <div className="my-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="size-16 rounded-full bg-[#caef6b]/20 flex items-center justify-center text-[#caef6b]">
              <Check className="size-8" />
            </div>
            <h4 className="text-xl font-bold text-white">Đặt vé thành công!</h4>
            <p className="text-xs text-[#9ba9ba]">
              Mã vé đã được gửi về thông báo tài khoản của bạn. Hẹn gặp bạn tại rạp!
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Film & Location details */}
            <div className="rounded-xl border border-[#1f2c3d] bg-[#0c121a] p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Film className="size-4 text-[#caef6b]" />
                <span>{movieTitle}</span>
              </div>
              <div className="flex items-center gap-4 text-[#9ba9ba]">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-[#caef6b]" />
                  {cinema}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3 text-[#caef6b]" />
                  {date}
                </span>
              </div>
            </div>

            {/* Showtime Selection */}
            <div>
              <label className="text-xs font-semibold text-[#caef6b] uppercase tracking-wider block mb-2">
                Chọn suất chiếu:
              </label>
              <div className="grid grid-cols-5 gap-2">
                {showtimes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTime(t)}
                    className={`rounded-lg py-2 text-xs font-bold transition-all border ${selectedTime === t
                      ? "border-[#caef6b] bg-[#caef6b] text-[#090d14]"
                      : "border-[#243041] bg-[#192331] text-[#d3dce7] hover:border-[#3d4f66]"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Seat Type */}
            <div>
              <label className="text-xs font-semibold text-[#caef6b] uppercase tracking-wider block mb-2">
                Loại ghế:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Standard", "VIP", "Sweetbox"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedSeatType(type)}
                    className={`rounded-lg p-2.5 text-left text-xs transition-all border ${selectedSeatType === type
                      ? "border-[#caef6b] bg-[#1a2c1f] text-white"
                      : "border-[#243041] bg-[#192331] text-[#9ba9ba] hover:border-[#3d4f66]"
                      }`}
                  >
                    <div className="font-bold">{type}</div>
                    <div className="text-[11px] text-[#caef6b]">
                      {seatPrices[type].toLocaleString("vi-VN")} đ
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket count */}
            <div className="flex items-center justify-between border-t border-[#1f2c3d] pt-3">
              <span className="text-xs text-[#9ba9ba]">Số lượng vé:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="size-7 rounded border border-[#243041] bg-[#192331] text-sm font-bold text-white hover:border-[#caef6b]"
                >
                  -
                </button>
                <span className="text-sm font-bold text-white">{ticketCount}</span>
                <button
                  onClick={() => setTicketCount(Math.min(99, ticketCount + 1))}
                  className="size-7 rounded border border-[#243041] bg-[#192331] text-sm font-bold text-white hover:border-[#caef6b]"
                >
                  +
                </button>
              </div>
            </div>

            {/* Total price & CTA */}
            <div className="flex items-center justify-between border-t border-[#1f2c3d] pt-3">
              <div>
                <span className="text-[11px] text-[#9ba9ba]">Tạm tính:</span>
                <div className="text-base font-extrabold text-[#caef6b]">
                  {(seatPrices[selectedSeatType] * ticketCount).toLocaleString("vi-VN")} đ
                </div>
              </div>
              <Button
                onClick={handleBookingConfirm}
                className="h-10 rounded-lg bg-[#caef6b] px-6 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-[0_0_15px_rgba(202,239,107,0.25)]"
              >
                Xác nhận đặt vé
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
