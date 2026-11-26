import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { Clock, Film, Heart, Loader2, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/common/FavoriteButton"
import { COMING_SOON_MOVIES, NOW_SHOWING_MOVIES } from "@/constants"
import { useFavorites } from "@/hooks/useFavorites"
import type { MainLayoutContextType } from "@/layouts/MainLayout"
import type { Movie } from "@/types"

const ALL_MOVIES: Movie[] = [...NOW_SHOWING_MOVIES, ...COMING_SOON_MOVIES]

const BOOKING_DATE = new Date().toLocaleDateString("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

/** Map id phim -> thông tin phim (bỏ các id không còn trong danh mục) */
function resolveMovies(movieIds: string[]): Movie[] {
  return movieIds
    .map((id) => ALL_MOVIES.find((movie) => movie.id === id))
    .filter((movie): movie is Movie => Boolean(movie))
}

interface FavoriteCardProps {
  movie: Movie
  isToggling: boolean
  onRemove: () => void
  onBook: () => void
}

const FavoriteCard = ({ movie, isToggling, onRemove, onBook }: FavoriteCardProps) => {
  const isComingSoon = movie.status === "coming_soon"

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[#1f2c3d]/70 bg-[#0e141d] transition-all duration-300 hover:-translate-y-1 hover:border-[#2f4057] hover:shadow-xl">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-lg bg-[#16202c]">
        <Link to={`/movies/${movie.id}`} aria-label={`Xem chi tiết ${movie.title}`}>
          <img
            src={movie.poster}
            alt={movie.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-transparent to-transparent opacity-60" />
        </Link>

        <span className="absolute left-2.5 top-2.5 rounded border border-[#2d3e54] bg-[#1a2431] px-1.5 py-0.5 text-[10px] font-bold text-[#a4c8f5]">
          {movie.rating}
        </span>

        <div className="absolute right-2.5 top-2.5">
          <FavoriteButton
            active
            disabled={isToggling}
            onClick={onRemove}
            className="shadow-lg"
          />
        </div>

        {isComingSoon && (
          <span className="absolute bottom-2.5 left-2.5 rounded border border-[#2a3c25] bg-[#162518] px-1.5 py-0.5 text-[9px] font-bold text-[#caef6b]">
            Sắp chiếu
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <Link
          to={`/movies/${movie.id}`}
          className="line-clamp-1 text-sm font-semibold text-white transition-colors hover:text-[#caef6b]"
        >
          {movie.title}
        </Link>
        <p className="mt-1 flex items-center gap-1 line-clamp-1 text-[11px] text-[#9ba9ba]">
          <Clock className="size-3" />
          {movie.genre} · {movie.duration}
        </p>

        <div className="mt-3 flex gap-2">
          <Button
            onClick={onBook}
            disabled={isComingSoon}
            className="h-9 flex-1 rounded-lg bg-[#caef6b] text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Ticket className="mr-1.5 size-3.5" />
            {isComingSoon ? "Sắp chiếu" : "Đặt vé"}
          </Button>
          <Link
            to={`/movies/${movie.id}`}
            className="flex h-9 items-center justify-center rounded-lg border border-[#2d3e54] bg-[#1a2431] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#243346]"
          >
            Chi tiết
          </Link>
        </div>
      </div>
    </article>
  )
}

export const MyFavoritesPage = () => {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<MainLayoutContextType>()
  const { movieIds, toggle, isLoading, isToggling } = useFavorites()

  const favorites = resolveMovies(movieIds)

  const handleRemove = async (movie: Movie) => {
    const res = await toggle(movie.id)
    if (res.ok) {
      showToast(
        res.favorited
          ? `Đã thêm "${movie.title}" vào yêu thích!`
          : `Đã bỏ "${movie.title}" khỏi danh sách yêu thích.`
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

  const handleBook = (movie: Movie) => {
    navigate(
      `/booking/seats?movie=${encodeURIComponent(movie.title)}&cinema=${encodeURIComponent(
        "Cinema Nguyễn Du"
      )}&date=${encodeURIComponent(BOOKING_DATE)}&time=${encodeURIComponent(
        "19:30"
      )}&room=${encodeURIComponent("Phòng 03")}&showtimeId=${movie.id === "1" ? "1" : "3"}`
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-[#9ba9ba]">
        <Link to="/homepage" className="transition-colors hover:text-[#caef6b]">
          Trang chủ
        </Link>
        <span>/</span>
        <span className="text-white">Phim yêu thích</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#1f2c3d]/60 pb-6">
        <div>
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
            <Heart className="size-3.5 fill-[#caef6b]" />
            Bộ sưu tập của bạn
          </span>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Phim yêu thích của tôi
          </h1>
          <p className="mt-2 text-sm text-[#9ba9ba]">
            {isLoading
              ? "Đang tải danh sách..."
              : `Bạn đang lưu ${favorites.length} bộ phim. Chọn phim để đặt vé và chọn ghế ngay.`}
          </p>
        </div>
        <Link
          to="/movies"
          className="flex items-center gap-1.5 text-sm font-semibold text-[#caef6b] transition-colors hover:text-[#b8df5b]"
        >
          <Film className="size-4" />
          Khám phá thêm phim
        </Link>
      </div>

      {/* Loading */}
      {isLoading && favorites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[#9ba9ba]">
          <Loader2 className="mb-3 size-7 animate-spin text-[#caef6b]" />
          <p className="text-sm">Đang tải phim yêu thích...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && favorites.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#243041] bg-[#0e141d] px-6 py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-[#2a3c25] bg-[#162518]">
            <Heart className="size-6 text-[#caef6b]" />
          </div>
          <h2 className="text-lg font-bold text-white">Chưa có phim yêu thích nào</h2>
          <p className="mt-2 max-w-md text-sm text-[#9ba9ba]">
            Bấm nút trái tim trên poster phim (ở trang Phim hoặc Chi tiết phim) để lưu lại
            và đặt vé nhanh tại đây.
          </p>
          <Button
            onClick={() => navigate("/movies")}
            className="mt-6 h-10 rounded-xl bg-[#caef6b] px-5 text-sm font-bold text-[#090d14] hover:bg-[#b8df5b]"
          >
            <Film className="mr-1.5 size-4" />
            Khám phá phim
          </Button>
        </div>
      )}

      {/* Grid */}
      {favorites.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-6">
          {favorites.map((movie) => (
            <FavoriteCard
              key={movie.id}
              movie={movie}
              isToggling={isToggling}
              onRemove={() => void handleRemove(movie)}
              onBook={() => handleBook(movie)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
