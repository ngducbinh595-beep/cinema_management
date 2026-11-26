import { useNavigate, useOutletContext } from "react-router-dom"
import type { MainLayoutContextType } from "@/layouts/MainLayout"
import { NOW_SHOWING_MOVIES } from "@/constants"
import { HeroSection } from "./components/HeroSection"
import { QuickBookingBar } from "./components/QuickBookingBar"
import { NowShowingSection } from "./components/NowShowingSection"
import { AIFeatureBanner } from "./components/AIFeatureBanner"
import { ComingSoonAndCinemaSection } from "./components/ComingSoonAndCinemaSection"

export const HomePage = () => {
  const navigate = useNavigate()
  const { openTrailer, showToast } =
    useOutletContext<MainLayoutContextType>()

  const handleBookMovie = (movieTitleOrId?: string) => {
    if (!movieTitleOrId) {
      navigate("/movies/1")
      return
    }
    const found = NOW_SHOWING_MOVIES.find(
      (m) => m.title.toLowerCase() === movieTitleOrId.toLowerCase() || m.id === movieTitleOrId
    )
    navigate(`/movies/${found ? found.id : "1"}`)
  }

  return (
    <div className="flex flex-col">
      {/* Featured Hero Banner */}
      <HeroSection
        onWatchTrailer={(movie) => openTrailer(movie)}
        onBookNow={(movie) => handleBookMovie(movie)}
      />

      {/* Quick Booking bar */}
      <QuickBookingBar
        onSearchShowtime={(data) => {
          handleBookMovie(data.movie)
        }}
      />

      {/* Now Showing / Coming Soon Grid */}
      <NowShowingSection
        onSelectMovie={(movie) => {
          navigate(`/movies/${movie.id}`)
        }}
        onRemindMovie={(movie) => {
          showToast(`Đã bật nhắc nhở cho phim "${movie.title}". Chúng tôi sẽ thông báo khi mở bán vé!`)
        }}
      />

      {/* AI Movie Recommendation Banner */}
      <AIFeatureBanner />

      {/* Coming Soon & Cinema Experience Section */}
      <ComingSoonAndCinemaSection
        onRemindMovie={(title) => {
          showToast(`Đã bật nhắc nhở cho phim "${title}". Chúng tôi sẽ thông báo khi mở bán vé!`)
        }}
      />
    </div>
  )
}
