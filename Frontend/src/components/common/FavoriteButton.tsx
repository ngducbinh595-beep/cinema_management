import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  /** Đang được yêu thích hay chưa */
  active: boolean
  onClick: () => void
  disabled?: boolean
  /** "icon" = nút tròn trên poster phim, "button" = nút có chữ */
  variant?: "icon" | "button"
  className?: string
}

/**
 * Nút tim dùng chung cho card phim & trang chi tiết.
 * Không tự gọi API — nhận `active` + `onClick` từ page để tránh gọi API N lần cho N card.
 */
export const FavoriteButton = ({
  active,
  onClick,
  disabled = false,
  variant = "icon",
  className,
}: FavoriteButtonProps) => {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!disabled) onClick()
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition-all cursor-pointer",
          active
            ? "border-[#caef6b] bg-[#162518] text-[#caef6b]"
            : "border-[#2d3e54] bg-[#1a2431] text-white hover:bg-[#243346]",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <Heart className={cn("mr-1.5 size-4", active && "fill-[#caef6b]")} />
        {active ? "Đã lưu phim" : "Lưu phim"}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={active ? "Bỏ yêu thích phim" : "Yêu thích phim"}
      aria-pressed={active}
      className={cn(
        "flex size-8 items-center justify-center rounded-full border backdrop-blur-md transition-all cursor-pointer",
        active
          ? "border-[#caef6b]/70 bg-[#162518]/90 text-[#caef6b]"
          : "border-[#243041]/80 bg-[#090d14]/70 text-[#9ba9ba] hover:border-[#caef6b]/60 hover:text-[#caef6b]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <Heart className={cn("size-4", active && "fill-[#caef6b]")} />
    </button>
  )
}
