import React, { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { NOW_SHOWING_MOVIES, COMING_SOON_MOVIES } from "@/constants"
import type { Movie } from "@/types"

interface NowShowingSectionProps {
  onSelectMovie?: (movie: Movie) => void
  onRemindMovie?: (movie: Movie) => void
}

export const NowShowingSection: React.FC<NowShowingSectionProps> = ({
  onSelectMovie,
  onRemindMovie,
}) => {
  const [activeTab, setActiveTab] = useState<"now" | "upcoming">("now")
  const displayMovies = activeTab === "now" ? NOW_SHOWING_MOVIES : COMING_SOON_MOVIES

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

  return (
    <section id="now-showing" className="mx-auto max-w-[1440px] px-6 pt-16 pb-12 lg:px-12">
      {/* Section Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#1f2c3d]/60 pb-6 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">
            {activeTab === "now" ? "Điện ảnh đang lên đèn" : "Sắp chạm màn ảnh"}
          </h2>
        </div>

        {/* Filter navigation */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 rounded-full border border-[#243041] bg-[#121923] p-1">
            <button
              onClick={() => setActiveTab("now")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "now"
                  ? "bg-[#1f2c3d] text-[#caef6b]"
                  : "text-[#9ba9ba] hover:text-white"
              }`}
            >
              Đang chiếu
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "upcoming"
                  ? "bg-[#1f2c3d] text-[#caef6b]"
                  : "text-[#9ba9ba] hover:text-white"
              }`}
            >
              Sắp chiếu
            </button>
          </div>

          <Link
            to="/movies"
            className="group flex items-center gap-1 text-xs font-medium text-[#9ba9ba] transition-colors hover:text-[#caef6b]"
          >
            <span>Tất cả phim</span>
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      {/* Movies Grid */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-6">
        {displayMovies.map((movie) => (
          <Link
            key={movie.id}
            to={`/movies/${movie.id}`}
            className="group relative flex flex-col cursor-pointer overflow-hidden rounded-xl border border-transparent bg-[#0e141d] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#2f4057] hover:shadow-xl"
          >
            {/* Poster container with aspect ratio */}
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#16202c]">
              <img
                src={movie.poster}
                alt={movie.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

              {/* Age Rating Badge */}
              <div className="absolute left-2.5 top-2.5">
                <Badge
                  className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded ${getRatingBadgeStyle(
                    movie.rating
                  )}`}
                >
                  {movie.rating}
                </Badge>
              </div>
            </div>

            {/* Movie Info */}
            <div className="flex flex-1 flex-col justify-between pt-3 pb-2 px-1">
              <div>
                <h3 className="line-clamp-1 text-sm font-semibold text-white transition-colors group-hover:text-[#caef6b]">
                  {movie.title}
                </h3>
                <p className="mt-1 line-clamp-1 text-[11px] text-[#9ba9ba]">
                  {movie.genre} · {movie.duration}
                </p>
                {movie.releaseDate && activeTab === "upcoming" && (
                  <p className="mt-1 text-[11px] font-semibold text-[#caef6b]">
                    Khởi chiếu: {movie.releaseDate}
                  </p>
                )}
              </div>

              {/* Action link */}
              {activeTab === "now" ? (
                <div
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelectMovie?.(movie)
                  }}
                  className="mt-3 flex items-center justify-between border-t border-[#1f2c3d]/40 pt-2 text-[11px] font-semibold text-[#caef6b] hover:text-[#d8ff7a]"
                >
                  <span>Đặt vé ngay</span>
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRemindMovie?.(movie)
                  }}
                  className="mt-3 flex items-center justify-between border-t border-[#1f2c3d]/40 pt-2 text-[11px] font-semibold text-[#caef6b] hover:text-[#d8ff7a]"
                >
                  <span className="flex items-center gap-1">
                    <Bell className="size-3" />
                    Nhắc tôi
                  </span>
                  <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
