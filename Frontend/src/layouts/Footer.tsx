import React from "react"

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-[#1f2c3d]/60 bg-[#090d14] py-8">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-6 text-xs text-[#9ba9ba] sm:flex-row lg:px-12">
        <p className="text-center sm:text-left">
          © 2026 <span className="font-semibold text-white">Quản lý rạp chiếu phim</span>{" "}
          · Trọn từng khoảnh khắc, trọn vẹn cảm xúc.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <a
            href="tel:0123456789"
            className="transition-colors hover:text-[#caef6b]"
          >
            Hỗ trợ: <span className="font-bold text-white">0123456789</span>
          </a>
          <span>·</span>
          <a href="#terms" className="transition-colors hover:text-[#caef6b]">
            Điều khoản
          </a>
          <span>·</span>
          <a href="#privacy" className="transition-colors hover:text-[#caef6b]">
            Bảo mật
          </a>
        </div>
      </div>
    </footer>
  )
}
