import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Calendar, MapPin, Ticket, Film, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { bookingService, type ShowtimeSlotInfo } from "@/services/booking.service"
import { resolveCinemaLocation } from "@/lib/ticketPdf"

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  movieTitle?: string
  cinema?: string
  date?: string
}

const DEFAULT_MODAL_SLOTS = [
  { showtimeId: 1001, startTime: "09:30", roomName: "Phòng 01", availableSeats: 88, totalSeats: 98 },
  { showtimeId: 1002, startTime: "14:00", roomName: "Phòng 02", availableSeats: 78, totalSeats: 84 },
  { showtimeId: 1003, startTime: "16:45", roomName: "Phòng 03", availableSeats: 104, totalSeats: 112 },
  { showtimeId: 1004, startTime: "19:30", roomName: "Phòng 01", availableSeats: 81, totalSeats: 98 },
  { showtimeId: 1005, startTime: "21:50", roomName: "Phòng 05", availableSeats: 90, totalSeats: 96 },
]

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  movieTitle = "Tín hiệu từ ngày mai",
  cinema = "Cinema Nguyễn Du",
  date = "24/10/2026",
}) => {
  const navigate = useNavigate()
  const [slots, setSlots] = useState(DEFAULT_MODAL_SLOTS)
  const [selectedSlot, setSelectedSlot] = useState(DEFAULT_MODAL_SLOTS[3])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setIsLoading(true)

    bookingService
      .getMovieShowtimes({
        movie: movieTitle,
        cinema,
        date,
      })
      .then((res) => {
        if (cancelled) return
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((s: ShowtimeSlotInfo) => ({
            showtimeId: s.showtimeId,
            startTime: s.startTime,
            roomName: s.roomName,
            availableSeats: s.availableSeats,
            totalSeats: s.totalSeats,
          }))
          setSlots(mapped)
          setSelectedSlot(mapped.find((s) => s.startTime === "19:30") || mapped[0])
        } else {
          setSlots(DEFAULT_MODAL_SLOTS)
          setSelectedSlot(DEFAULT_MODAL_SLOTS[3])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots(DEFAULT_MODAL_SLOTS)
          setSelectedSlot(DEFAULT_MODAL_SLOTS[3])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, movieTitle, cinema, date])

  if (!isOpen) return null

  const cinemaLocation = resolveCinemaLocation(cinema)

  const handleProceedToSeatSelection = () => {
    const savedUser = localStorage.getItem("user")
    if (!savedUser) {
      onClose()
      navigate("/login")
      return
    }

    onClose()
    const qs = new URLSearchParams({
      movie: movieTitle,
      cinema,
      address: cinemaLocation.address,
      date,
      time: selectedSlot.startTime,
      room: selectedSlot.roomName,
      showtimeId: String(selectedSlot.showtimeId),
    })
    navigate(`/booking/seats?${qs.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#243041] bg-[#121923] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
          <div className="flex items-center gap-2">
            <Ticket className="size-5 text-[#caef6b]" />
            <h3 className="font-bold text-white text-base">Chọn khung giờ chiếu</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#192331] hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Film & Location details */}
          <div className="rounded-xl border border-[#1f2c3d] bg-[#0c121a] p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <Film className="size-4 text-[#caef6b]" />
              <span>{movieTitle}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[#9ba9ba]">
              <span className="flex items-center gap-1">
                <MapPin className="size-3 text-[#caef6b]" />
                {cinema}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3 text-[#caef6b]" />
                {date}
              </span>
            </div>
            <p className="text-[11px] text-[#9ba9ba]">{cinemaLocation.address}</p>
          </div>

          {/* Showtime Selection with Available Seats */}
          <div>
            <label className="text-xs font-semibold text-[#caef6b] uppercase tracking-wider block mb-2">
              Chọn suất chiếu (số ghế trống riêng từng suất):
            </label>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-[#9ba9ba]">
                <Loader2 className="size-4 animate-spin text-[#caef6b]" />
                <span>Đang tải suất chiếu...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {slots.map((slot) => {
                  const isSelected = slot.showtimeId === selectedSlot.showtimeId
                  return (
                    <button
                      key={slot.showtimeId}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`flex flex-col items-start rounded-xl p-3 text-left transition-all border cursor-pointer ${
                        isSelected
                          ? "border-[#caef6b] bg-[#caef6b] text-[#090d14]"
                          : "border-[#243041] bg-[#192331] text-[#d3dce7] hover:border-[#3d4f66]"
                      }`}
                    >
                      <span className="text-sm font-black">{slot.startTime}</span>
                      <span
                        className={`text-[10px] ${
                          isSelected ? "text-[#090d14]/80" : "text-[#9ba9ba]"
                        }`}
                      >
                        {slot.roomName} · Còn {slot.availableSeats} ghế
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between border-t border-[#1f2c3d] pt-4">
            <div className="text-xs text-[#9ba9ba]">
              Suất <strong className="text-white">{selectedSlot.startTime}</strong> · Còn{" "}
              <strong className="text-[#caef6b]">{selectedSlot.availableSeats}</strong> ghế trống
            </div>
            <Button
              onClick={handleProceedToSeatSelection}
              className="h-10 rounded-xl bg-[#caef6b] px-5 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-[0_0_15px_rgba(202,239,107,0.25)] cursor-pointer"
            >
              <span>Chọn ghế ngồi</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
