import React, { useState } from "react"
import { ArrowRight, Film, MapPin, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CINEMAS, NOW_SHOWING_MOVIES } from "@/constants"
import { DatePicker, formatDateVN } from "@/components/ui/date-picker"

interface QuickBookingBarProps {
  onSearchShowtime?: (data: { movie: string; cinema: string; date: string }) => void
}

export const QuickBookingBar: React.FC<QuickBookingBarProps> = ({
  onSearchShowtime,
}) => {
  const [selectedMovie, setSelectedMovie] = useState("Tín hiệu từ ngày mai")
  const [selectedCinema, setSelectedCinema] = useState(CINEMAS[0] || "Cinema Nguyễn Du")
  const [selectedDate, setSelectedDate] = useState(() => formatDateVN(new Date()))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearchShowtime) {
      onSearchShowtime({
        movie: selectedMovie,
        cinema: selectedCinema,
        date: selectedDate,
      })
    }
  }

  return (
    <section id="quick-booking" className="relative z-20 mx-auto mt-8 lg:mt-10 max-w-[1440px] px-6 lg:px-12">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#243041] bg-[#121923]/95 p-5 shadow-2xl backdrop-blur-xl lg:p-6"
      >
        <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-2 lg:grid-cols-12">
          {/* Header Tag */}
          <div className="lg:col-span-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
              CHỌN NHANH. XEM NGAY.
            </span>
            <h2 className="text-xl font-bold text-white sm:text-[22px]">
              Đặt vé nhanh
            </h2>
          </div>

          {/* Film selector */}
          <div className="lg:col-span-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#9ba9ba]">
              <Film className="size-3.5 text-[#caef6b]" />
              Phim
            </label>
            <div className="relative">
              <select
                value={selectedMovie}
                onChange={(e) => setSelectedMovie(e.target.value)}
                className="h-[42px] w-full appearance-none rounded-lg border border-[#263548] bg-[#192331] px-3.5 py-2 text-xs font-medium text-white outline-none transition-colors hover:border-[#384c66] focus:border-[#caef6b] focus:ring-1 focus:ring-[#caef6b]"
              >
                {NOW_SHOWING_MOVIES.map((m) => (
                  <option key={m.id} value={m.title} className="bg-[#121923] text-white">
                    {m.title}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9ba9ba]">
                ▼
              </div>
            </div>
          </div>

          {/* Cinema selector */}
          <div className="lg:col-span-2">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#9ba9ba]">
              <MapPin className="size-3.5 text-[#caef6b]" />
              Rạp chiếu
            </label>
            <div className="relative">
              <select
                value={selectedCinema}
                onChange={(e) => setSelectedCinema(e.target.value)}
                className="h-[42px] w-full appearance-none rounded-lg border border-[#263548] bg-[#192331] px-3.5 py-2 text-xs font-medium text-white outline-none transition-colors hover:border-[#384c66] focus:border-[#caef6b] focus:ring-1 focus:ring-[#caef6b]"
              >
                {CINEMAS.map((c) => (
                  <option key={c} value={c} className="bg-[#121923] text-white">
                    {c}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9ba9ba]">
                ▼
              </div>
            </div>
          </div>

          {/* Date selector */}
          <div className="lg:col-span-2">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#9ba9ba]">
              <Calendar className="size-3.5 text-[#caef6b]" />
              Ngày chiếu
            </label>
            <DatePicker
              value={selectedDate}
              onChange={(_, str) => setSelectedDate(str)}
              className="h-[42px] rounded-lg"
            />
          </div>

          {/* Submit button */}
          <div className="lg:col-span-2 flex flex-col justify-end self-end">
            <div
              className="hidden lg:flex items-center gap-1.5 text-xs font-semibold mb-1.5 opacity-0 select-none pointer-events-none"
              aria-hidden="true"
            >
              <span className="size-3.5" />
              <span>&nbsp;</span>
            </div>
            <Button
              type="submit"
              className="w-full h-[42px] rounded-lg bg-[#caef6b] px-4 text-xs font-bold text-[#090d14] shadow-md hover:bg-[#b8df5b] hover:shadow-[0_0_15px_rgba(202,239,107,0.3)] transition-all cursor-pointer"
            >
              <span>Tìm suất chiếu</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </form>
    </section>
  )
}
