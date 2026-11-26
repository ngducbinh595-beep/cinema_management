import React from "react"
import { Link } from "react-router-dom"
import { Sparkles, ArrowRight } from "lucide-react"

export const AIFeatureBanner: React.FC = () => {
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8 lg:px-12">
      <div className="relative overflow-hidden rounded-2xl border border-[#2b442e] bg-gradient-to-r from-[#111f13] via-[#152718] to-[#122214] p-6 shadow-xl sm:p-8 lg:p-10">
        {/* Glow effects */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-60 rounded-full bg-[#caef6b]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 size-60 rounded-full bg-[#caef6b]/5 blur-3xl" />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          {/* Left: Icon & Text */}
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#355239] bg-[#1a331e] text-[#caef6b] shadow-inner">
              <Sparkles className="size-7 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#caef6b]">
                Cinema AI · CHỌN PHIM THEO CẢM XÚC
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-[26px]">
                Tối nay, bạn muốn cảm thấy thế nào?
              </h2>
              <p className="max-w-2xl text-xs sm:text-sm text-[#9ba9ba]">
                Kể một chút về gu của bạn. AI sẽ gợi ý phim có trong lịch chiếu,
                kèm lý do phù hợp.
              </p>
            </div>
          </div>

          {/* Right: CTA button chuyển hướng sang /ai */}
          <div className="w-full shrink-0 sm:w-auto">
            <Link
              to="/ai"
              className="inline-flex items-center justify-center w-full sm:w-auto h-11 rounded-lg bg-[#caef6b] px-6 text-xs sm:text-sm font-bold text-[#090d14] shadow-[0_4px_20px_rgba(202,239,107,0.25)] hover:bg-[#b8df5b] hover:shadow-[0_4px_25px_rgba(202,239,107,0.4)] transition-all"
            >
              <span>Tìm phim hợp gu</span>
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
