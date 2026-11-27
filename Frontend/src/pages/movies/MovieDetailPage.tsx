import { useState, useRef } from "react"
import { useParams, Link, useNavigate, useOutletContext } from "react-router-dom"
import {
  Ticket,
  Play,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Volume2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/common/FavoriteButton"
import { ReviewSection } from "@/components/movies/ReviewSection"
import { NOW_SHOWING_MOVIES, COMING_SOON_MOVIES } from "@/constants"
import { useFavorites } from "@/hooks/useFavorites"
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

interface ShowtimeOption {
  time: string
  room: string
  price: string
}

const SHOWTIME_OPTIONS: ShowtimeOption[] = [
  { time: "14:00", room: "Phòng 01", price: "từ 90.000 đ" },
  { time: "16:45", room: "Phòng 02", price: "từ 90.000 đ" },
  { time: "19:30", room: "Phòng 03", price: "từ 90.000 đ" },
  { time: "21:50", room: "Phòng 01", price: "từ 90.000 đ" },
]

export const MovieDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { openTrailer, openAIModal, showToast } =
    useOutletContext<MainLayoutContextType>()

  // Find movie by id, default to first movie ("Tín hiệu từ ngày mai")
  const allMovies: Movie[] = [...NOW_SHOWING_MOVIES, ...COMING_SOON_MOVIES]
  const movie: Movie =
    allMovies.find((m) => m.id === id) || NOW_SHOWING_MOVIES[0]

  // State
  const [selectedDate, setSelectedDate] = useState<DateOption>(DATE_OPTIONS[2]) // Default 24/10
  const [selectedTime, setSelectedTime] = useState<ShowtimeOption>(SHOWTIME_OPTIONS[2]) // Default 19:30

  // Phim yêu thích: lấy từ backend theo user đang đăng nhập
  const { isFavorite, toggle, isToggling } = useFavorites()
  const isSaved = isFavorite(movie.id)

  // Ref to scroll down to showtime picker
  const showtimeSectionRef = useRef<HTMLDivElement>(null)

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

  const handleSelectSeat = () => {
    navigate(
      `/booking/seats?movie=${encodeURIComponent(movie.title)}&cinema=${encodeURIComponent(
        "Cinema Nguyễn Du"
      )}&date=${encodeURIComponent(
        `${selectedDate.dayName}, ${selectedDate.fullDate}`
      )}&time=${encodeURIComponent(
        selectedTime.time
      )}&room=${encodeURIComponent(selectedTime.room)}&showtimeId=${movie.id === "1" ? "1" : "3"}`
    )
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
            {/* Status & tags */}
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

            {/* Title */}
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl lg:text-5xl tracking-tight leading-tight">
              {movie.title}
            </h1>

            {/* Meta */}
            <p className="mt-3 text-xs sm:text-sm text-[#9ba9ba]">
              {movie.genre} · {movie.duration}
            </p>

            {/* Synopsis */}
            <p className="mt-5 text-sm leading-relaxed text-[#d3dce7] line-clamp-4 sm:line-clamp-none">
              {movie.synopsis ||
                "Một tác phẩm điện ảnh xuất sắc, mang đến những cung bậc cảm xúc chân thực và ấn tượng khó quên cho người xem."}
            </p>

            {/* Divider */}
            <div className="my-6 border-t border-[#1f2c3d]" />

            {/* Detailed metadata */}
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

          {/* Action buttons */}
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
          {/* Trailer Preview Card */}
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

              {/* Big neon play button */}
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

          {/* AI Advisor Card */}
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

      {/* 3. Bottom Section: Showtime Picker ("Chọn một buổi hẹn với màn ảnh") */}
      <div
        ref={showtimeSectionRef}
        className="mt-14 overflow-hidden rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 sm:p-7 lg:p-8"
      >
        {/* Section Heading */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Chọn một buổi hẹn với màn ảnh
          </h2>
          <p className="mt-1 text-xs text-[#9ba9ba]">
            Cinemas Nguyễn Du · 116 Nguyễn Du, P. Bến Thành, TP.HCM
          </p>
        </div>

        {/* Date choices (Horizontal 7-day row) */}
        <div className="mt-6 flex gap-2.5 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-7 sm:gap-3">
          {DATE_OPTIONS.map((item) => {
            const isSelected = item.dateStr === selectedDate.dateStr
            return (
              <button
                key={item.dateStr}
                onClick={() => setSelectedDate(item)}
                className={`flex min-w-[90px] flex-col items-center justify-center rounded-xl py-3 px-2 transition-all cursor-pointer ${isSelected
                  ? "bg-[#caef6b] text-[#090d14] font-bold shadow-md"
                  : "border border-[#243041] bg-[#192331]/80 text-[#9ba9ba] hover:border-[#384c66] hover:text-white"
                  }`}
              >
                <span className={`text-[11px] ${isSelected ? "text-[#090d14]" : "text-[#9ba9ba]"}`}>
                  {item.dayName}
                </span>
                <span
                  className={`mt-1 text-base sm:text-lg font-black tracking-tight ${isSelected ? "text-[#090d14]" : "text-white"
                    }`}
                >
                  {item.dateStr}
                </span>
              </button>
            )
          })}
        </div>

        {/* Divider */}
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
              <p className="text-xs text-[#9ba9ba]">Âm thanh Dolby Atmos</p>
            </div>
          </div>

          {/* Time Slot Buttons */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {SHOWTIME_OPTIONS.map((slot) => {
              const isSelected = slot.time === selectedTime.time
              return (
                <button
                  key={slot.time}
                  onClick={() => setSelectedTime(slot)}
                  className={`flex flex-col items-start rounded-xl px-4 py-2.5 transition-all text-left cursor-pointer ${isSelected
                    ? "border border-[#caef6b] bg-[#162518] shadow-md shadow-[#caef6b]/5"
                    : "border border-[#243041] bg-[#192331] hover:border-[#384c66]"
                    }`}
                >
                  <span
                    className={`text-base font-bold ${isSelected ? "text-[#caef6b]" : "text-white"
                      }`}
                  >
                    {slot.time}
                  </span>
                  <span className="mt-0.5 text-[10px] text-[#9ba9ba]">
                    {slot.room} · {slot.price}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Showtime Footer Note & CTA */}
        <div className="mt-8 flex flex-col gap-4 border-t border-[#1f2c3d]/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#9ba9ba]">
            Vui lòng đến trước giờ chiếu 15 phút. Trẻ em cần đáp ứng phân loại độ tuổi.
          </p>

          <Button
            onClick={handleSelectSeat}
            className="h-11 rounded-xl bg-[#caef6b] px-6 text-sm font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10 cursor-pointer self-start sm:self-auto"
          >
            <ArrowRight className="size-4 mr-1.5" />
            {selectedTime.time} · Chọn ghế
          </Button>
        </div>
      </div>

      {/* 4. Đánh giá phim: chấm sao & nhận xét */}
      <ReviewSection movieId={movie.id} movieTitle={movie.title} onNotify={showToast} />
    </div>
  )
}
