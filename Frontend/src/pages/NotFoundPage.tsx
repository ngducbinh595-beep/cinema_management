import { Link } from "react-router-dom"
import { Home, Frown } from "lucide-react"

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="text-7xl font-black text-[#1f2c3d]">404</div>
      <Frown className="mt-4 size-12 text-[#caef6b]/50" />
      <h1 className="mt-4 text-2xl font-bold text-white">Trang không tồn tại</h1>
      <p className="mt-2 max-w-sm text-sm text-[#9ba9ba]">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
      </p>
      <Link
        to="/"
        className="mt-6 flex items-center gap-2 rounded-lg bg-[#caef6b] px-6 py-2.5 text-sm font-bold text-[#090d14] hover:bg-[#b8df5b] transition-colors"
      >
        <Home className="size-4" />
        Về trang chủ
      </Link>
    </div>
  )
}
