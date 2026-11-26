import React from "react"
import { X, Play } from "lucide-react"

interface TrailerModalProps {
  isOpen: boolean
  onClose: () => void
  movieTitle?: string
}

export const TrailerModal: React.FC<TrailerModalProps> = ({
  isOpen,
  onClose,
  movieTitle = "Tín hiệu từ ngày mai",
}) => {
  if (!isOpen) return null

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

        {/* Video / Player mockup */}
        <div className="relative aspect-video w-full bg-black flex flex-col items-center justify-center p-8 text-center">
          <div className="size-20 rounded-full border-2 border-[#caef6b] bg-[#caef6b]/20 flex items-center justify-center text-[#caef6b] shadow-[0_0_30px_rgba(202,239,107,0.3)] animate-pulse">
            <Play className="size-8 fill-current ml-1" />
          </div>
          <p className="mt-4 text-base font-bold text-white">
            {movieTitle} — Official Teaser Trailer
          </p>
          <p className="mt-1 text-xs text-[#9ba9ba] max-w-md">
            Chất lượng 4K UHD · Âm thanh Dolby Atmos độc quyền tại hệ thống rạp của chúng tôi.
          </p>
        </div>
      </div>
    </div>
  )
}
