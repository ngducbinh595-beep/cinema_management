import React from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, Bell, Compass, Volume2, Armchair } from "lucide-react"
import { COMING_SOON_MOVIES } from "@/constants"
import cinemaImage from "@/assets/movies/cinema-interior.png"

interface ComingSoonAndCinemaSectionProps {
  onRemindMovie?: (title: string) => void
}

export const ComingSoonAndCinemaSection: React.FC<
  ComingSoonAndCinemaSectionProps
> = ({ onRemindMovie }) => {
  return (
    <section id="cinema-info" className="mx-auto max-w-[1440px] px-6 py-12 lg:px-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left column: Sắp chạm màn ảnh */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between border-b border-[#1f2c3d]/60 pb-4">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Sắp chạm màn ảnh
            </h2>
            <Link
              to="/movies?filter=upcoming"
              className="group flex items-center gap-1 text-xs font-medium text-[#9ba9ba] transition-colors hover:text-[#caef6b]"
            >
              <span>Khởi chiếu 30/10</span>
              <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COMING_SOON_MOVIES.map((movie) => (
              <div
                key={movie.id}
                className="group relative flex overflow-hidden rounded-xl border border-[#243041] bg-[#121923] p-3.5 transition-all duration-300 hover:border-[#384c66] hover:shadow-xl"
              >
                {/* Poster */}
                <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-lg bg-[#1a2431]">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute left-2 top-2">
                    <span className="rounded border border-[#5c3e1e] bg-[#2d1e10]/90 px-1.5 py-0.5 text-[9px] font-bold text-[#ffbd7a]">
                      {movie.rating}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="ml-4 flex flex-1 flex-col justify-between py-1">
                  <div>
                    <span className="inline-block rounded border border-[#2a3c25] bg-[#162518] px-2 py-0.5 text-[10px] font-semibold text-[#caef6b]">
                      Sắp chiếu
                    </span>
                    <h3 className="mt-2 text-base font-bold text-white transition-colors group-hover:text-[#caef6b]">
                      {movie.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#9ba9ba]">{movie.genre}</p>
                  </div>

                  <button
                    onClick={() => onRemindMovie && onRemindMovie(movie.title)}
                    className="group/btn flex items-center gap-1.5 text-xs font-semibold text-[#caef6b] transition-colors hover:text-[#e4ff91]"
                  >
                    <Bell className="size-3.5" />
                    <span>Nhắc tôi</span>
                    <ArrowUpRight className="size-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Cinema Information */}
        <div className="lg:col-span-5">
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[#243041] bg-gradient-to-br from-[#121923] to-[#0c121a] p-6 shadow-xl transition-all duration-300 hover:border-[#384c66]">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#caef6b]">
                <Compass className="size-4" />
                <span>TRẢI NGHIỆM ĐIỆN ẢNH ĐỈNH CAO</span>
              </div>

              <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-[26px]">
                Một chỗ ngồi. <br />
                <span className="text-[#caef6b]">Ngàn thế giới.</span>
              </h2>

              <p className="mt-3 text-xs sm:text-sm text-[#9ba9ba]">
                Cinema Nguyễn Du · 116 Nguyễn Du, P. Bến Thành, TP.HCM
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#d3dce7]">
                <div className="flex items-center gap-1 rounded-md border border-[#243041] bg-[#192331] px-2.5 py-1">
                  <span>06 phòng chiếu</span>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-[#243041] bg-[#192331] px-2.5 py-1">
                  <Volume2 className="size-3 text-[#caef6b]" />
                  <span>Dolby Atmos</span>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-[#243041] bg-[#192331] px-2.5 py-1">
                  <Armchair className="size-3 text-[#caef6b]" />
                  <span>Ghế VIP & Đôi</span>
                </div>
              </div>
            </div>

            {/* Cinema interior photo */}
            <div className="mt-6 overflow-hidden rounded-xl border border-[#243041] bg-[#192331]">
              <img
                src={cinemaImage}
                alt="Cinema Nguyễn Du - Cinema Interior"
                className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#1f2c3d]/60 pt-4">
              <Link
                to="/cinemas"
                className="group flex items-center gap-1.5 text-xs font-bold text-[#caef6b] transition-colors hover:text-[#e4ff91]"
              >
                <span>Khám phá rạp & giá vé</span>
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
