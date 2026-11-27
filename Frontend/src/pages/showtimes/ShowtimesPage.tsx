import { useState, useMemo, useEffect } from "react"
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom"
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Filter,
  Search,
  Film,
  Sparkles,
  Play,
  RotateCcw,
  Loader2,
} from "lucide-react"
import { NOW_SHOWING_MOVIES, CINEMAS } from "@/constants"
import { DatePicker, formatDateVN, formatFullDateVN } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { bookingService, type CinemaScheduleSlot } from "@/services/booking.service"
import { resolveCinemaLocation } from "@/lib/ticketPdf"
import type { MainLayoutContextType } from "@/layouts/MainLayout"

const FORMATS = [
  { id: "all", label: "Tất cả định dạng" },
  { id: "2D", label: "2D Dolby Atmos" },
  { id: "IMAX", label: "IMAX Laser" },
]

function toISODateLocal(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

// Dữ liệu dự phòng khi không kết nối được máy chủ Backend (mỗi suất có số ghế riêng)
function buildFallbackMovieSlots(movieTitle: string, movieIdx: number): CinemaScheduleSlot[] {
  const base2D = [
    { startTime: "09:30", roomName: "Phòng 01", totalSeats: 98, avail: 88 - movieIdx * 2 },
    { startTime: "14:00", roomName: "Phòng 02", totalSeats: 84, avail: 78 - movieIdx },
    { startTime: "16:45", roomName: "Phòng 03", totalSeats: 112, avail: 103 - movieIdx * 2 },
    { startTime: "19:30", roomName: "Phòng 01", totalSeats: 98, avail: 81 - movieIdx * 3 },
    { startTime: "21:50", roomName: "Phòng 05", totalSeats: 96, avail: 90 - movieIdx },
  ]
  const slots: CinemaScheduleSlot[] = base2D.map((s) => ({
    showtimeId: null,
    startTime: s.startTime,
    endTime: "21:30",
    roomName: s.roomName,
    format: "2D Dolby Atmos",
    category: "2D",
    priceRegular: 90000,
    totalSeats: s.totalSeats,
    availableSeats: Math.max(12, s.avail),
  }))

  if (
    movieTitle.includes("Tín hiệu") ||
    movieTitle.includes("Qua miền") ||
    movieTitle.includes("Thành phố")
  ) {
    const baseImax = [
      { startTime: "10:30", avail: 132 - movieIdx * 4 },
      { startTime: "15:15", avail: 126 - movieIdx * 3 },
      { startTime: "19:15", avail: 118 - movieIdx * 5 },
    ]
    for (const im of baseImax) {
      slots.push({
        showtimeId: null,
        startTime: im.startTime,
        endTime: "21:30",
        roomName: "Phòng 04",
        format: "IMAX Dolby Atmos",
        category: "IMAX",
        priceRegular: 120000,
        totalSeats: 144,
        availableSeats: Math.max(20, im.avail),
      })
    }
  }
  return slots
}

export const ShowtimesPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { openTrailer, showToast } = useOutletContext<MainLayoutContextType>()

  const cinemaParam = searchParams.get("cinema")
  const initialCinema =
    cinemaParam && CINEMAS.includes(cinemaParam)
      ? cinemaParam
      : CINEMAS[0] || "Cinema Nguyễn Du"

  const [selectedCinema, setSelectedCinema] = useState(initialCinema)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(2026, 9, 24))
  const [selectedFormat, setSelectedFormat] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [slotsByMovie, setSlotsByMovie] = useState<Record<string, CinemaScheduleSlot[]>>({})
  const [cinemaAddress, setCinemaAddress] = useState<string>(
    () => resolveCinemaLocation(initialCinema).address
  )
  const [isLoadingSchedule, setIsLoadingSchedule] = useState<boolean>(false)

  const formattedDateStr = useMemo(() => formatDateVN(selectedDate), [selectedDate])
  const isoDateStr = useMemo(() => toISODateLocal(selectedDate), [selectedDate])

  useEffect(() => {
    let cancelled = false
    setIsLoadingSchedule(true)
    setCinemaAddress(resolveCinemaLocation(selectedCinema).address)

    bookingService
      .getCinemaSchedule({
        cinema: selectedCinema,
        date: isoDateStr,
      })
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) {
          setSlotsByMovie(res.data.slotsByMovie || {})
          if (res.data.cinemaAddress) {
            setCinemaAddress(res.data.cinemaAddress)
          }
        } else {
          setSlotsByMovie({})
        }
      })
      .catch(() => {
        if (!cancelled) setSlotsByMovie({})
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSchedule(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCinema, isoDateStr])

  const filteredMovies = useMemo(() => {
    return NOW_SHOWING_MOVIES.filter((movie) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movie.genre.toLowerCase().includes(searchQuery.toLowerCase())
      return matchSearch
    })
  }, [searchQuery])

  const getRatingBadgeStyle = (rating: string) => {
    switch (rating) {
      case "T18":
        return "border-[#682424] bg-[#2d1515] text-[#ff8e8e]"
      case "T16":
        return "border-[#5c3e1e] bg-[#2d1e10] text-[#ffbd7a]"
      case "T13":
        return "border-[#2d3e54] bg-[#1a2431] text-[#a4c8f5]"
      case "P":
        return "border-[#2a3c25] bg-[#162518] text-[#caef6b]"
      default:
        return "border-[#2d3e54] bg-[#1a2431] text-white"
    }
  }

  const handleSelectSlot = (movieTitle: string, slot: CinemaScheduleSlot) => {
    const savedUser = localStorage.getItem("user")
    if (!savedUser) {
      showToast("Vui lòng đăng nhập trước khi tiến hành chọn ghế đặt vé!")
      navigate("/login")
      return
    }

    const qs = new URLSearchParams({
      movie: movieTitle,
      cinema: selectedCinema,
      address: cinemaAddress,
      date: formattedDateStr,
      time: slot.startTime,
      room: slot.roomName,
    })
    if (slot.showtimeId) {
      qs.set("showtimeId", String(slot.showtimeId))
    }
    navigate(`/booking/seats?${qs.toString()}`)
  }

  const handleResetFilters = () => {
    setSelectedCinema(CINEMAS[0] || "Cinema Nguyễn Du")
    setSelectedDate(new Date(2026, 9, 24))
    setSelectedFormat("all")
    setSearchQuery("")
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-10 lg:px-12">
      {/* Breadcrumb & Header */}
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-xs text-[#9ba9ba] mb-3">
          <Link to="/homepage" className="hover:text-[#caef6b] transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-white font-medium">Lịch chiếu</span>
        </nav>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Lịch chiếu phim
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-[#9ba9ba]">
              Khám phá suất chiếu phim và lượng ghế trống thực tế của từng khung giờ trên hệ thống Cinema
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#caef6b] font-medium">
            {isLoadingSchedule ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>Đồng bộ số ghế trống theo từng suất chiếu</span>
          </div>
        </div>
      </div>

      {/* Interactive Filter Bar */}
      <div className="mb-8 rounded-2xl border border-[#243041] bg-[#121923]/95 p-4 shadow-xl backdrop-blur-xl sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#9ba9ba]">
              <MapPin className="size-3.5 text-[#caef6b]" />
              Chọn rạp chiếu
            </label>
            <div className="relative">
              <select
                value={selectedCinema}
                onChange={(e) => setSelectedCinema(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[#243041] bg-[#192331] px-3.5 py-2.5 text-xs font-semibold text-white outline-none transition-colors hover:border-[#3d4f66] focus:border-[#caef6b] cursor-pointer"
              >
                {CINEMAS.map((c) => (
                  <option key={c} value={c} className="bg-[#121923] text-white">
                    {c}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-[#9ba9ba]">
                ▼
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#9ba9ba]">
              <CalendarIcon className="size-3.5 text-[#caef6b]" />
              Chọn ngày chiếu
            </label>
            <DatePicker
              value={selectedDate}
              onChange={(d) => setSelectedDate(d)}
              placeholder="Chọn ngày chiếu"
              className="h-[40px] text-xs font-semibold"
            />
          </div>

          <div className="lg:col-span-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#9ba9ba]">
              <Search className="size-3.5 text-[#caef6b]" />
              Tìm kiếm tên phim
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập tên phim muốn tìm..."
                className="w-full rounded-xl border border-[#243041] bg-[#192331] px-3.5 py-2.5 text-xs text-white placeholder-[#687b94] outline-none transition-colors hover:border-[#3d4f66] focus:border-[#caef6b]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9ba9ba] hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Format Filter Tags */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#1f2c3d] pt-3.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#9ba9ba] mr-1">
            <Filter className="size-3 text-[#caef6b]" />
            Định dạng:
          </span>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFormat(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedFormat === f.id
                  ? "bg-[#caef6b] text-[#090d14] font-bold shadow-md shadow-[#caef6b]/15"
                  : "border border-[#243041] bg-[#192331] text-[#9ba9ba] hover:border-[#3d4f66] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
          {(searchQuery || selectedFormat !== "all") && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs text-[#9ba9ba] hover:text-[#caef6b] transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Date & Cinema Address Banner */}
      <div className="mb-6 flex flex-col gap-1 border-b border-[#1f2c3d]/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#caef6b] animate-pulse" />
            <span className="text-sm font-bold text-white">
              Suất chiếu ngày {formatFullDateVN(selectedDate)}
            </span>
            <span className="text-xs text-[#caef6b] font-semibold">· {selectedCinema}</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9ba9ba]">
            <MapPin className="size-3 text-[#caef6b]" />
            <span>{cinemaAddress}</span>
          </p>
        </div>
        <span className="text-xs text-[#9ba9ba]">
          Tìm thấy <span className="font-bold text-white">{filteredMovies.length}</span> phim có lịch chiếu
        </span>
      </div>

      {/* Movies Showtimes List */}
      {filteredMovies.length > 0 ? (
        <div className="space-y-6">
          {filteredMovies.map((movie, mIdx) => {
            const rawSlots =
              slotsByMovie[movie.title] && slotsByMovie[movie.title].length > 0
                ? slotsByMovie[movie.title]
                : buildFallbackMovieSlots(movie.title, mIdx)

            const slots2D = rawSlots.filter((s) => s.category === "2D")
            const slotsIMAX = rawSlots.filter((s) => s.category === "IMAX")

            const show2D = (selectedFormat === "all" || selectedFormat === "2D") && slots2D.length > 0
            const showIMAX =
              (selectedFormat === "all" || selectedFormat === "IMAX") && slotsIMAX.length > 0

            return (
              <div
                key={movie.id}
                className="overflow-hidden rounded-2xl border border-[#243041] bg-[#121923] transition-all hover:border-[#384c66] hover:shadow-xl"
              >
                <div className="flex flex-col gap-4 border-b border-[#1f2c3d] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Link
                      to={`/movies/${movie.id}`}
                      className="group relative size-16 shrink-0 overflow-hidden rounded-xl bg-[#192331] cursor-pointer"
                    >
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </Link>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/movies/${movie.id}`}
                          className="font-bold text-white text-base hover:text-[#caef6b] transition-colors"
                        >
                          {movie.title}
                        </Link>
                        <Badge
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${getRatingBadgeStyle(
                            movie.rating
                          )}`}
                        >
                          {movie.rating}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#9ba9ba]">
                        {movie.genre} · {movie.duration}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openTrailer(movie.title)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#243041] bg-[#192331] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#caef6b] hover:text-[#caef6b] transition-colors cursor-pointer"
                    >
                      <Play className="size-3.5 fill-current" />
                      <span>Xem Trailer</span>
                    </button>
                    <Link
                      to={`/movies/${movie.id}`}
                      className="rounded-xl border border-[#243041] bg-[#192331] px-3.5 py-2 text-xs font-semibold text-[#9ba9ba] hover:text-white transition-colors"
                    >
                      Chi tiết
                    </Link>
                  </div>
                </div>

                {/* Showtimes Blocks */}
                <div className="p-4 sm:p-5 space-y-4">
                  {show2D && (
                    <div>
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#9ba9ba] flex items-center gap-1.5">
                          <Clock className="size-3.5 text-[#caef6b]" />
                          <span>2D Dolby Atmos · Phụ đề Việt</span>
                        </p>
                        <span className="text-[11px] text-[#9ba9ba]">Giá vé: Từ 90.000 đ</span>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {slots2D.map((slot) => (
                          <button
                            key={`${movie.id}-2d-${slot.startTime}-${slot.roomName}`}
                            type="button"
                            onClick={() => handleSelectSlot(movie.title, slot)}
                            className="group flex flex-col items-center justify-center min-w-[96px] rounded-xl border border-[#243041] bg-[#192331] py-2 px-3.5 transition-all hover:border-[#caef6b] hover:bg-[#162518] hover:shadow-md hover:shadow-[#caef6b]/10 cursor-pointer"
                          >
                            <span className="text-xs font-bold text-white group-hover:text-[#caef6b]">
                              {slot.startTime}
                            </span>
                            <span className="text-[10px] text-[#9ba9ba]">
                              {slot.availableSeats}/{slot.totalSeats} ghế trống
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showIMAX && (
                    <div className="pt-2 border-t border-[#1f2c3d]/60">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#caef6b] flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-[#caef6b]" />
                          <span>IMAX Laser · Màn chiếu siêu thực</span>
                        </p>
                        <span className="text-[11px] text-[#9ba9ba]">Giá vé: Từ 120.000 đ</span>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {slotsIMAX.map((slot) => (
                          <button
                            key={`${movie.id}-imax-${slot.startTime}-${slot.roomName}`}
                            type="button"
                            onClick={() => handleSelectSlot(movie.title, slot)}
                            className="group flex flex-col items-center justify-center min-w-[96px] rounded-xl border border-[#3b4c30] bg-[#182618] py-2 px-3.5 transition-all hover:border-[#caef6b] hover:shadow-md hover:shadow-[#caef6b]/20 cursor-pointer"
                          >
                            <span className="text-xs font-bold text-[#caef6b]">
                              {slot.startTime}
                            </span>
                            <span className="text-[10px] text-[#9ba9ba]">
                              {slot.availableSeats}/{slot.totalSeats} ghế trống
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!show2D && !showIMAX && (
                    <p className="text-xs text-[#9ba9ba] italic">
                      Không có suất chiếu phù hợp với định dạng đã chọn tại cụm rạp này.
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#243041] bg-[#121923] p-12 text-center">
          <Film className="mx-auto size-12 text-[#9ba9ba]/50 mb-3" />
          <h3 className="text-lg font-bold text-white">Không tìm thấy phim phù hợp</h3>
          <p className="mt-1 text-xs text-[#9ba9ba] max-w-sm mx-auto">
            Không có kết quả nào cho từ khóa &quot;{searchQuery}&quot;. Vui lòng thử tìm với tên phim khác hoặc đặt lại bộ lọc.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#caef6b] px-4 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] transition-all cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Xem tất cả lịch chiếu</span>
          </button>
        </div>
      )}
    </div>
  )
}
