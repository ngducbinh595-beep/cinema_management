import { useState, useRef, useEffect } from "react"
import { useParams, Link, useNavigate, useOutletContext } from "react-router-dom"
import {
  Ticket,
  Play,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Volume2,
  Loader2,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/common/FavoriteButton"
import { NOW_SHOWING_MOVIES, COMING_SOON_MOVIES } from "@/constants"
import { useFavorites } from "@/hooks/useFavorites"
import { bookingService, type ShowtimeSlotInfo } from "@/services/booking.service"
import type { MainLayoutContextType } from "@/layouts/MainLayout"
import type { Movie } from "@/types"

interface DateOption {
  dayName: string
  dateStr: string
  fullDate: string
}

const DATE_OPTIONS: DateOption[] = [
  { dayName: "Hôm nay", dateStr: "22/10", fullDate: "22/10/2026" },
  { dayName: "Thứ Sáu", dateStr: "23/10", fullDate: "23/10/2026" },
  { dayName: "Thứ Bảy", dateStr: "24/10", fullDate: "24/10/2026" },
  { dayName: "Chủ Nhật", dateStr: "25/10", fullDate: "25/10/2026" },
  { dayName: "Thứ Hai", dateStr: "26/10", fullDate: "26/10/2026" },
  { dayName: "Thứ Ba", dateStr: "27/10", fullDate: "27/10/2026" },
  { dayName: "Thứ Tư", dateStr: "28/10", fullDate: "28/10/2026" },
]

const FALLBACK_SLOTS: Array<{
  showtimeId: number
  startTime: string
  roomName: string
  priceRegular: number
  availableSeats: number
  totalSeats: number
}> = [
  { showtimeId: 1001, startTime: "09:30", roomName: "Phòng 01", priceRegular: 90000, availableSeats: 88, totalSeats: 98 },
  { showtimeId: 1002, startTime: "14:00", roomName: "Phòng 02", priceRegular: 90000, availableSeats: 78, totalSeats: 84 },
  { showtimeId: 1003, startTime: "16:45", roomName: "Phòng 03", priceRegular: 90000, availableSeats: 104, totalSeats: 112 },
  { showtimeId: 1004, startTime: "19:30", roomName: "Phòng 01", priceRegular: 90000, availableSeats: 81, totalSeats: 98 },
  { showtimeId: 1005, startTime: "21:50", roomName: "Phòng 05", priceRegular: 90000, availableSeats: 90, totalSeats: 96 },
]

export const MovieDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { openTrailer, openAIModal, showToast } =
    useOutletContext<MainLayoutContextType>()

  const allMovies: Movie[] = [...NOW_SHOWING_MOVIES, ...COMING_SOON_MOVIES]
  const movie: Movie =
    allMovies.find((m) => m.id === id) || NOW_SHOWING_MOVIES[0]

  const [selectedDate, setSelectedDate] = useState<DateOption>(DATE_OPTIONS[2])
  const [showtimeSlots, setShowtimeSlots] = useState<
    Array<{
      showtimeId: number
      startTime: string
      roomName: string
      priceRegular: number
      availableSeats: number
      totalSeats: number
      cinemaAddress?: string
    }>
  >(FALLBACK_SLOTS)
  const [selectedSlot, setSelectedSlot] = useState(FALLBACK_SLOTS[3])
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false)

  const { isFavorite, toggle, isToggling } = useFavorites()
  const isSaved = isFavorite(movie.id)

  const showtimeSectionRef = useRef<HTMLDivElement>(null)

  // Tải các suất chiếu thực tế & số ghế trống riêng của từng suất từ Backend
  useEffect(() => {
    let cancelled = false
    setIsLoadingSlots(true)

    bookingService
      .getMovieShowtimes({
        movieId: Number(movie.id) || undefined,
        movie: movie.title,
        cinema: "Cinema Nguyễn Du",
        date: selectedDate.fullDate,
      })
      .then((res) => {
        if (cancelled) return
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((s: ShowtimeSlotInfo) => ({
            showtimeId: s.showtimeId,
            startTime: s.startTime,
            roomName: s.roomName,
            priceRegular: s.priceRegular,
            availableSeats: s.availableSeats,
            totalSeats: s.totalSeats,
            cinemaAddress: s.cinemaAddress,
          }))
          setShowtimeSlots(mapped)
          setSelectedSlot(
            mapped.find((m) => m.startTime === "19:30") || mapped[0]
          )
        } else {
          setShowtimeSlots(FALLBACK_SLOTS)
          setSelectedSlot(FALLBACK_SLOTS[3])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowtimeSlots(FALLBACK_SLOTS)
          setSelectedSlot(FALLBACK_SLOTS[3])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [movie.id, movie.title, selectedDate.fullDate])

  const handleScrollToShowtimes = () => {
    showtimeSectionRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleToggleSave = async () => {
    const res = await toggle(movie.id)
    if (res.ok) {
      showToast(
        res.favorited
          ? `Đã lưu "${movie.title}" vào danh sách yêu thích!`
          : `Đã bỏ lưu "${movie.title}".`
      )
      return
    }
    if (res.reason === "login") {
      showToast("Vui lòng đăng nhập để lưu phim yêu thích!")
      navigate("/login")
      return
    }
    showToast(res.message || "Không thể cập nhật phim yêu thích. Vui lòng thử lại!")
  }

  const handleSelectSeat = (slotOverride?: typeof selectedSlot) => {
    const target = slotOverride || selectedSlot
    const qs = new URLSearchParams({
      movie: movie.title,
      cinema: "Cinema Nguyễn Du",
      date: `${selectedDate.dayName}, ${selectedDate.fullDate}`,
      time: target.startTime,
      room: target.roomName,
      showtimeId: String(target.showtimeId),
    })
    navigate(`/booking/seats?${qs.toString()}`)
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
      {/* 1. Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-xs text-[#9ba9ba]">
        <Link to="/movies" className="hover:text-[#caef6b] transition-colors">
          Phim
        </Link>
        <span className="text-[#9ba9ba]/50">/</span>
        <Link to="/movies" className="hover:text-[#caef6b] transition-colors">
          {movie.status === "coming_soon" ? "Sắp chiếu" : "Đang chiếu"}
        </Link>
        <span className="text-[#9ba9ba]/50">/</span>
        <span className="font-medium text-white">{movie.title}</span>
      </nav>

      {/* 2. Top Film Editorial Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left: Poster */}
        <div className="lg:col-span-3">
          <div className="group relative aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-2xl border border-[#1f2c3d] bg-[#121923] shadow-2xl mx-auto lg:mx-0">
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090d14]/80 via-transparent to-transparent opacity-60" />
            <div className="absolute left-3 top-3">
              <span className="rounded border border-[#2d3e54] bg-[#1a2431]/90 px-2.5 py-1 text-xs font-bold text-[#a4c8f5] backdrop-blur-md">
                {movie.rating}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Film Information */}
        <div className="flex flex-col justify-between lg:col-span-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-[#2a3c25] bg-[#162518] px-2.5 py-1 text-xs font-semibold text-[#caef6b]">
                {movie.status === "coming_soon" ? "Sắp chiếu" : "Đang chiếu"}
              </span>
              <span className="rounded border border-[#2d3e54] bg-[#1a2431] px-2.5 py-1 text-xs font-semibold text-[#9ba9ba]">
                {movie.rating}
              </span>
              <span className="rounded border border-[#243041] bg-[#16202c] px-2.5 py-1 text-xs font-semibold text-[#9ba9ba]">
                {movie.format || "2D · Phụ đề Việt"}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl lg:text-5xl tracking-tight leading-tight">
              {movie.title}
            </h1>

            <p className="mt-3 text-xs sm:text-sm text-[#9ba9ba]">
              {movie.genre} · {movie.duration}
            </p>

            <p className="mt-5 text-sm leading-relaxed text-[#d3dce7] line-clamp-4 sm:line-clamp-none">
              {movie.synopsis ||
                "Một tác phẩm điện ảnh xuất sắc, mang đến những cung bậc cảm xúc chân thực và ấn tượng khó quên cho người xem."}
            </p>

            <div className="my-6 border-t border-[#1f2c3d]" />

            <div className="space-y-2 text-xs sm:text-sm text-[#9ba9ba]">
              <p>
                <span className="text-[#9ba9ba]">Đạo diễn: </span>
                <span className="text-white">{movie.director || "Trần Minh Khoa"}</span>
              </p>
              <p>
                <span className="text-[#9ba9ba]">Diễn viên: </span>
                <span className="text-white">
                  {movie.cast || "Hà An, Lê Duy, Nguyễn Phương"}
                </span>
              </p>
              <p>
                <span className="text-[#9ba9ba]">Khởi chiếu: </span>
                <span className="text-white">
                  {movie.releaseDate || "16/10/2026"} · {movie.country || "Việt Nam"}
                </span>
              </p>
              <p className="pt-2 text-xs font-medium text-[#ffd166]">
                {movie.ratingDescription ||
                  `${movie.rating} · Phim dành cho khán giả từ đủ 13 tuổi trở lên.`}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleScrollToShowtimes}
              className="h-11 rounded-xl bg-[#caef6b] px-6 text-sm font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10 cursor-pointer"
            >
              <Ticket className="size-4 mr-1.5" />
              Chọn suất chiếu
            </Button>

            <FavoriteButton
              variant="button"
              active={isSaved}
              disabled={isToggling}
              onClick={() => void handleToggleSave()}
            />
          </div>
        </div>

        {/* Right: Trailer preview & AI advisor panel */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          <div>
            <div
              onClick={() => openTrailer(movie.title)}
              className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-2xl border border-[#1f2c3d] bg-[#121923] shadow-xl"
            >
              <img
                src={movie.trailerThumbnail || movie.poster}
                alt={`Trailer ${movie.title}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[#090d14]/40 transition-colors group-hover:bg-[#090d14]/20" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-[#caef6b] text-[#090d14] shadow-2xl transition-transform duration-300 group-hover:scale-115 group-hover:bg-[#d8ff7a]">
                  <Play className="size-6 fill-current ml-0.5" />
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-xs text-[#9ba9ba] flex items-center gap-1.5">
              <span>Trailer chính thức</span>
              <span>·</span>
              <span>{movie.trailerDuration || "02:14"}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-[#1f2c3d] bg-[#101722]/80 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#caef6b]" />
              <h3 className="text-xs sm:text-sm font-bold text-[#caef6b]">
                Vì sao có thể hợp gu bạn?
              </h3>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-[#9ba9ba]">
              {movie.aiRecommendation ||
                "Yếu tố tương lai và cảm xúc gia đình, không thiên về kinh dị. Phù hợp buổi hẹn thích một câu chuyện có chiều sâu."}
            </p>
            <button
              onClick={openAIModal}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#caef6b] hover:underline cursor-pointer"
            >
              <span>Hỏi Cinema AI thêm</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bottom Section: Showtime Picker */}
      <div
        ref={showtimeSectionRef}
        className="mt-14 overflow-hidden rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 sm:p-7 lg:p-8"
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Chọn một buổi hẹn với màn ảnh
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9ba9ba]">
            <MapPin className="size-3.5 text-[#caef6b]" />
            <span>Cinema Nguyễn Du · 135 Nguyễn Du, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh</span>
          </p>
        </div>

        {/* Date choices */}
        <div className="mt-6 flex gap-2.5 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-7 sm:gap-3">
          {DATE_OPTIONS.map((item) => {
            const isSelected = item.dateStr === selectedDate.dateStr
            return (
              <button
                key={item.dateStr}
                onClick={() => setSelectedDate(item)}
                className={`flex min-w-[90px] flex-col items-center justify-center rounded-xl py-3 px-2 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#caef6b] text-[#090d14] font-bold shadow-md"
                    : "border border-[#243041] bg-[#192331]/80 text-[#9ba9ba] hover:border-[#384c66] hover:text-white"
                }`}
              >
                <span className={`text-[11px] ${isSelected ? "text-[#090d14]" : "text-[#9ba9ba]"}`}>
                  {item.dayName}
                </span>
                <span
                  className={`mt-1 text-base sm:text-lg font-black tracking-tight ${
                    isSelected ? "text-[#090d14]" : "text-white"
                  }`}
                >
                  {item.dateStr}
                </span>
              </button>
            )
          })}
        </div>

        <div className="my-6 border-t border-[#1f2c3d]" />

        {/* Projection type & Showtimes */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-[#243041] bg-[#192331] text-[#caef6b]">
              <Volume2 className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">
                {movie.format || "2D · Phụ đề Việt"}
              </p>
              <p className="text-xs text-[#9ba9ba]">
                Âm thanh Dolby Atmos · Số ghế trống cập nhật theo từng suất
              </p>
            </div>
          </div>

          {/* Time Slot Buttons with Per-Showtime Available Seats */}
          {isLoadingSlots ? (
            <div className="flex items-center gap-2 text-xs text-[#9ba9ba]">
              <Loader2 className="size-4 animate-spin text-[#caef6b]" />
              <span>Đang tải suất chiếu...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              {showtimeSlots.map((slot) => {
                const isSelected = slot.showtimeId === selectedSlot.showtimeId
                return (
                  <button
                    key={slot.showtimeId}
                    onClick={() => setSelectedSlot(slot)}
                    onDoubleClick={() => handleSelectSeat(slot)}
                    className={`flex flex-col items-start rounded-xl px-4 py-2.5 transition-all text-left cursor-pointer ${
                      isSelected
                        ? "border border-[#caef6b] bg-[#162518] shadow-md shadow-[#caef6b]/10"
                        : "border border-[#243041] bg-[#192331] hover:border-[#384c66]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-base font-bold ${
                          isSelected ? "text-[#caef6b]" : "text-white"
                        }`}
                      >
                        {slot.startTime}
                      </span>
                      <span className="text-[10px] text-[#9ba9ba]">· {slot.roomName}</span>
                    </div>
                    <span className="mt-0.5 text-[11px] font-semibold text-[#caef6b]">
                      Còn {slot.availableSeats}/{slot.totalSeats} ghế trống
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Showtime Footer Note & CTA */}
        <div className="mt-8 flex flex-col gap-4 border-t border-[#1f2c3d]/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#9ba9ba]">
            Vui lòng đến trước giờ chiếu 15 phút. Trẻ em cần đáp ứng phân loại độ tuổi.
          </p>

          <Button
            onClick={() => handleSelectSeat()}
            className="h-11 rounded-xl bg-[#caef6b] px-6 text-sm font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10 cursor-pointer self-start sm:self-auto"
          >
            <ArrowRight className="size-4 mr-1.5" />
            {selectedSlot.startTime} ({selectedSlot.availableSeats} ghế trống) · Chọn ghế
          </Button>
        </div>
      </div>
    </div>
  )
}
