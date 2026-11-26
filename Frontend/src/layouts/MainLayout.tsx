import { useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { Navbar } from "./Navbar"
import { Footer } from "./Footer"
import { TrailerModal } from "@/components/common/TrailerModal"
import { AIMoodModal } from "@/components/common/AIMoodModal"
import { BookingModal } from "@/components/common/BookingModal"

export interface MainLayoutContextType {
  openBooking: (movieTitle?: string, cinema?: string, date?: string) => void
  openTrailer: (movieTitle?: string) => void
  openAIModal: () => void
  showToast: (msg: string) => void
}

export const MainLayout = () => {
  const navigate = useNavigate()
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [activeMovie, setActiveMovie] = useState("Tín hiệu từ ngày mai")
  const [activeCinema, setActiveCinema] = useState("Cinema Nguyễn Du")
  const [activeDate, setActiveDate] = useState("24/10/2026")
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const openBooking = (movieTitle?: string, cinema?: string, date?: string) => {
    // Kiểm tra xem khách đã đăng nhập chưa
    const savedUser = localStorage.getItem("user")
    if (!savedUser) {
      showToast("Vui lòng đăng nhập trước khi tiến hành đặt vé xem phim!")
      navigate("/login")
      return
    }

    if (movieTitle) setActiveMovie(movieTitle)
    if (cinema) setActiveCinema(cinema)
    if (date) setActiveDate(date)
    setIsBookingOpen(true)
  }

  const openTrailer = (movieTitle?: string) => {
    if (movieTitle) setActiveMovie(movieTitle)
    setIsTrailerOpen(true)
  }

  const openAIModal = () => {
    setIsAIModalOpen(true)
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-[#f4f6f7] selection:bg-[#caef6b] selection:text-[#090d14]">
      {/* Stellar Mist Ambient Background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 140% 50% at 15% 60%, rgba(124, 58, 237, 0.11), transparent 48%),
            radial-gradient(ellipse 90% 80% at 85% 25%, rgba(245, 101, 101, 0.09), transparent 58%),
            radial-gradient(ellipse 120% 65% at 40% 90%, rgba(34, 197, 94, 0.13), transparent 52%),
            radial-gradient(ellipse 100% 45% at 70% 5%, rgba(251, 191, 36, 0.07), transparent 42%),
            radial-gradient(ellipse 80% 75% at 90% 80%, rgba(168, 85, 247, 0.10), transparent 55%),
            #000000
          `,
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-[#2d4c33] bg-[#122416] px-4 py-3 text-xs font-semibold text-[#caef6b] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navbar (high stacking layer so dropdown menu floats above main content) */}
      <Navbar onOpenAIModal={openAIModal} />

      {/* Main Page Slot */}
      <main className="relative z-0 flex-1">
        <Outlet
          context={{
            openBooking,
            openTrailer,
            openAIModal,
            showToast,
          } satisfies MainLayoutContextType}
        />
      </main>

      {/* Footer */}
      <div className="relative z-0">
        <Footer />
      </div>

      {/* Global Shared Modals */}
      <TrailerModal
        isOpen={isTrailerOpen}
        onClose={() => setIsTrailerOpen(false)}
        movieTitle={activeMovie}
      />

      <AIMoodModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSelectMovie={(title) => openBooking(title)}
      />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        movieTitle={activeMovie}
        cinema={activeCinema}
        date={activeDate}
      />
    </div>
  )
}
