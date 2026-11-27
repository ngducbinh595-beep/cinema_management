import React from "react"
import { X, Play, ExternalLink } from "lucide-react"
import { getYouTubeEmbedUrl } from "@/lib/trailer"

interface TrailerModalProps {
  isOpen: boolean
  onClose: () => void
  movieTitle?: string
  /** Link trailer lấy từ database (YouTube sẽ được nhúng trực tiếp) */
  trailerUrl?: string | null
  /** Đang tra cứu link trailer */
  isLoading?: boolean
}

export const TrailerModal: React.FC<TrailerModalProps> = ({
  isOpen,
  onClose,
  movieTitle = "Tín hiệu từ ngày mai",
  trailerUrl = null,
  isLoading = false,
}) => {
  if (!isOpen) return null

  const embedUrl = getYouTubeEmbedUrl(trailerUrl)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[#243041] bg-[#0f1722] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f2c3d] px-6 py-4">
          <div className="flex items-center gap-2">
            <Play className="size-4 text-[#caef6b] fill-current" />
            <h3 className="font-bold text-white">Trailer: {movieTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#192331] hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Trình phát trailer */}
        <div className="relative aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`Trailer ${movieTitle}`}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
              <div className="size-20 rounded-full border-2 border-[#caef6b] bg-[#caef6b]/20 flex items-center justify-center text-[#caef6b] shadow-[0_0_30px_rgba(202,239,107,0.3)] animate-pulse">
                <Play className="size-8 fill-current ml-1" />
              </div>
              <p className="mt-4 text-base font-bold text-white">
                {isLoading ? "Đang tải trailer..." : `${movieTitle} — Official Teaser Trailer`}
              </p>
              {trailerUrl && !isLoading ? (
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#caef6b] px-4 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                >
                  <ExternalLink className="size-3.5" />
                  Mở trailer ở tab mới
                </a>
              ) : (
                <p className="mt-1 text-xs text-[#9ba9ba] max-w-md">
                  {isLoading
                    ? "Vui lòng đợi trong giây lát."
                    : "Phim này chưa có trailer. Vui lòng quay lại sau!"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
