import React, { useState, useEffect } from "react"
import { Play, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import heroImage1 from "@/assets/movies/hero-featured.png"
import heroImage2 from "@/assets/movies/hero-qua-mien-ky-uc.jpg"
import heroImage3 from "@/assets/movies/hero-thanh-pho-khong-ngu.jpg"

interface HeroSectionProps {
  onWatchTrailer?: (title: string) => void
  onBookNow?: (title: string) => void
}

const HERO_SLIDES = [
  {
    id: "1",
    title: "TÍN HIỆU",
    titleHighlight: "TỪ NGÀY MAI",
    movieTitle: "Tín hiệu từ ngày mai",
    tag: "TÂM ĐIỂM TUẦN NÀY",
    subTag: "Độc quyền tại Cinema",
    rating: "T13",
    genre: "Khoa học viễn tưởng",
    duration: "118 phút",
    format: "2D Dolby Atmos",
    description:
      "Một tín hiệu từ tương lai. Một lựa chọn thay đổi tất cả. Cùng An bước qua ranh giới của thời gian để tìm lại điều quan trọng nhất.",
    image: heroImage1,
  },
  {
    id: "2",
    title: "QUA MIỀN",
    titleHighlight: "KÝ ỨC",
    movieTitle: "Qua miền ký ức",
    tag: "XU HƯỚNG YÊU THÍCH",
    subTag: "Trải nghiệm điện ảnh đỉnh cao",
    rating: "T13",
    genre: "Khoa học viễn tưởng · Tâm lý",
    duration: "106 phút",
    format: "2D IMAX Laser",
    description:
      "Khi những mảnh ghép ký ức có thể tái hiện trước mắt, liệu bạn có dám đối diện với sự thật đằng sau người mình từng yêu thương nhất?",
    image: heroImage2,
  },
  {
    id: "3",
    title: "THÀNH PHỐ",
    titleHighlight: "KHÔNG NGỦ",
    movieTitle: "Thành phố không ngủ",
    tag: "BOM TẤN HÀNH ĐỘNG",
    subTag: "Suất chiếu đặc biệt tối nay",
    rating: "T18",
    genre: "Hành động · Giật gân",
    duration: "125 phút",
    format: "2D Dolby Atmos",
    description:
      "Những lời nói dối nguy hiểm. Những sự thật chết người. Giữa lòng đô thị rực sáng không bao giờ tắt đèn, cuộc truy đuổi sinh tử bắt đầu.",
    image: heroImage3,
  },
]

export const HeroSection: React.FC<HeroSectionProps> = ({
  onWatchTrailer,
  onBookNow,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Auto-play slide every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [currentSlide])

  const slide = HERO_SLIDES[currentSlide]

  return (
    <section className="relative w-full overflow-hidden border-b border-[#1f2c3d]/40 select-none">
      {/* Background Graphic with Cross-fade */}
      <div className="absolute inset-0 z-0">
        {HERO_SLIDES.map((s, idx) => (
          <img
            key={s.id}
            src={s.image}
            alt={s.movieTitle}
            className={`absolute inset-0 h-full w-full object-cover object-center lg:object-[80%_center] transition-opacity duration-700 ease-in-out ${idx === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
              }`}
          />
        ))}

        {/* Cinematic Scrims & Lighting Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090d14] via-[#090d14]/85 to-transparent sm:via-[#090d14]/70 lg:via-[#090d14]/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(202,239,107,0.06),transparent_50%)]" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 mx-auto flex min-h-[500px] max-w-[1440px] flex-col justify-end px-6 pb-14 pt-20 lg:px-12">
        <div className="max-w-2xl space-y-5 transition-all duration-500 key={slide.id}">
          {/* Status Badge */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-md border border-[#2a3c25] bg-[#162518]/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
              {slide.tag}
            </span>
            <span className="text-xs font-medium text-[#9ba9ba]">
              {slide.subTag}
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[58px]">
            {slide.title} <br />
            <span className="text-[#f4f6f7]">{slide.titleHighlight}</span>
          </h1>

          {/* Film Metadata */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#d3dce7]/90 font-medium">
            <span className="rounded bg-[#1a2431]/90 px-2 py-0.5 font-bold text-white border border-[#2d3e54]">
              {slide.rating}
            </span>
            <span>·</span>
            <span>{slide.genre}</span>
            <span>·</span>
            <span>{slide.duration}</span>
            <span>·</span>
            <span>{slide.format}</span>
          </div>

          {/* Description */}
          <p className="max-w-xl text-sm leading-relaxed text-[#9ba9ba] sm:text-[15px] min-h-[44px]">
            {slide.description}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Button
              onClick={() => onBookNow?.(slide.movieTitle)}
              className="h-11 rounded-lg bg-[#caef6b] px-6 text-sm font-bold text-[#090d14] shadow-[0_4px_20px_rgba(202,239,107,0.3)] hover:bg-[#b5dc53] hover:shadow-[0_4px_25px_rgba(202,239,107,0.45)] transition-all cursor-pointer"
            >
              <Ticket className="size-4 mr-2" />
              Đặt vé ngay
            </Button>

            <Button
              variant="outline"
              onClick={() => onWatchTrailer?.(slide.movieTitle)}
              className="h-11 rounded-lg border-[#2a3748] bg-[#121923]/80 px-5 text-sm font-semibold text-white backdrop-blur-sm hover:border-[#3d4f66] hover:bg-[#1a2431] transition-all cursor-pointer"
            >
              <Play className="size-4 mr-2 fill-current" />
              Xem trailer
            </Button>
          </div>
        </div>

        {/* Carousel Slide Indicators (Pagination) */}
        <div className="mt-8 flex items-center gap-2">
          {HERO_SLIDES.map((s, idx) => {
            const isActive = idx === currentSlide
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Chuyển đến phim ${s.movieTitle}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${isActive
                    ? "w-8 bg-[#caef6b] shadow-[0_0_10px_rgba(202,239,107,0.5)]"
                    : "w-4 bg-[#243041] hover:bg-[#3d4f66]"
                  }`}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
