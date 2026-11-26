import { useState, useMemo } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import {
  MapPin,
  Volume2,
  Armchair,
  Star,
  ArrowUpRight,
  Navigation,
  LocateFixed,
  ExternalLink,
  Sparkles,
  RotateCw,
  Building2,
  Lock,
  LogIn,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import cinemaImage from "@/assets/movies/cinema-interior.png"

interface CinemaItem {
  id: string
  name: string
  address: string
  district: string
  lat: number
  lng: number
  rooms: number
  features: string[]
  image: string
  rating: string
  reviewCount: string
}

const CINEMA_LIST: CinemaItem[] = [
  {
    id: "1",
    name: "Cinema Nguyễn Du",
    address: "123 Nguyễn Du, P. Bến Thành, Quận 1, TP.HCM",
    district: "Quận 1",
    lat: 10.7725,
    lng: 106.6948,
    rooms: 6,
    features: ["Dolby Atmos", "Ghế VIP", "Ghế Đôi Sweetbox", "4DX"],
    image: cinemaImage,
    rating: "4.9",
    reviewCount: "2.4k",
  },
  {
    id: "2",
    name: "Cinema Thảo Điền",
    address: "12 Trần Ngọc Diện, Thảo Điền, TP. Thủ Đức, TP.HCM",
    district: "TP. Thủ Đức",
    lat: 10.8037,
    lng: 106.7412,
    rooms: 4,
    features: ["Dolby Atmos", "Ghế VIP", "IMAX"],
    image: cinemaImage,
    rating: "4.8",
    reviewCount: "1.1k",
  },
  {
    id: "3",
    name: "Cinema Landmark 81",
    address: "Tầng 4, Vincom Center Landmark 81, Bình Thạnh, TP.HCM",
    district: "Bình Thạnh",
    lat: 10.7952,
    lng: 106.7218,
    rooms: 8,
    features: ["Dolby Atmos", "IMAX", "4DX", "VIP Lounge"],
    image: cinemaImage,
    rating: "5.0",
    reviewCount: "3.7k",
  },
  {
    id: "4",
    name: "Cinema Ba Tháng Hai",
    address: "200 3 Tháng 2, Phường 12, Quận 10, TP.HCM",
    district: "Quận 10",
    lat: 10.7711,
    lng: 106.6713,
    rooms: 5,
    features: ["Dolby Atmos", "Ghế VIP"],
    image: cinemaImage,
    rating: "4.7",
    reviewCount: "890",
  },
]

// Công thức Haversine tính khoảng cách chính xác theo km giữa 2 tọa độ GPS
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Bán kính Trái Đất (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

// Preset tọa độ các khu vực phổ biến nếu người dùng không bật GPS
const DISTRICT_PRESETS: Record<string, { label: string; lat: number; lng: number }> = {
  q1: { label: "Quận 1 / Quận 3 / Quận 4", lat: 10.7725, lng: 106.6948 },
  binhthanh: { label: "Bình Thạnh / Phú Nhuận / Gò Vấp", lat: 10.8012, lng: 106.7112 },
  thuduc: { label: "TP. Thủ Đức / Quận 2 / Quận 9", lat: 10.8037, lng: 106.7412 },
  q10: { label: "Quận 10 / Quận 5 / Quận 11 / Tân Bình", lat: 10.7711, lng: 106.6713 },
  q7: { label: "Quận 7 / Nhà Bè", lat: 10.7328, lng: 106.7154 },
}

export const CinemasPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Kiểm tra trạng thái đăng nhập của người dùng
  const [isLoggedIn] = useState(() => {
    try {
      const user = localStorage.getItem("user")
      const token = localStorage.getItem("token")
      return !!(user || token)
    } catch {
      return false
    }
  })

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationSource, setLocationSource] = useState<"gps" | "preset" | null>(null)
  const [locationMessage, setLocationMessage] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string>("")

  // Lấy vị trí GPS qua Geolocation API của trình duyệt (Yêu cầu đăng nhập)
  const handleFindNearestWithGPS = () => {
    // 1. Kiểm tra đăng nhập
    if (!isLoggedIn) {
      setLocationMessage("🔒 Chức năng định vị rạp gần nhất yêu cầu đăng nhập tài khoản. Vui lòng đăng nhập để tiếp tục!")
      navigate("/login", { state: { from: location } })
      return
    }

    if (!navigator.geolocation) {
      setLocationMessage("Trình duyệt không hỗ trợ Geolocation. Vui lòng chọn khu vực thủ công.")
      return
    }

    setIsLocating(true)
    setLocationMessage("Đang xác định vị trí của bạn qua GPS...")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ lat: latitude, lng: longitude })
        setLocationSource("gps")
        setIsLocating(false)
        setLocationMessage("Đã định vị thành công! Hệ thống đã tự động sắp xếp các rạp gần bạn nhất.")
      },
      (error) => {
        setIsLocating(false)
        console.warn("Lỗi lấy vị trí GPS:", error.message)
        setLocationMessage(
          "Không thể truy cập GPS (chưa cấp quyền hoặc đang kết nối HTTP). Bạn có thể chọn nhanh khu vực của mình bên dưới."
        )
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Chọn khu vực thủ công khi không bật GPS (Yêu cầu đăng nhập)
  const handleSelectDistrictPreset = (presetKey: string) => {
    // 1. Kiểm tra đăng nhập
    if (!isLoggedIn) {
      setSelectedPreset("")
      setLocationMessage("🔒 Chức năng gợi ý rạp theo khu vực yêu cầu đăng nhập tài khoản. Vui lòng đăng nhập để tiếp tục!")
      navigate("/login", { state: { from: location } })
      return
    }

    setSelectedPreset(presetKey)
    if (!presetKey) {
      setUserLocation(null)
      setLocationSource(null)
      setLocationMessage(null)
      return
    }

    const preset = DISTRICT_PRESETS[presetKey]
    if (preset) {
      setUserLocation({ lat: preset.lat, lng: preset.lng })
      setLocationSource("preset")
      setLocationMessage(`Đang đề xuất rạp dựa trên khu vực: ${preset.label}`)
    }
  }

  // Danh sách rạp kèm khoảng cách và sắp xếp gần nhất lên đầu
  const processedCinemas = useMemo(() => {
    if (!userLocation) {
      return CINEMA_LIST.map((c) => ({ ...c, distanceKm: null, isClosest: false }))
    }

    const withDistance = CINEMA_LIST.map((c) => {
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, c.lat, c.lng)
      return { ...c, distanceKm: dist, isClosest: false }
    })

    // Sắp xếp tăng dần theo khoảng cách
    withDistance.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))

    // Đánh dấu rạp gần nhất
    if (withDistance.length > 0) {
      withDistance[0].isClosest = true
    }

    return withDistance
  }, [userLocation])

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
      {/* 1. Header & Navigation */}
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-xs text-[#9ba9ba] mb-3">
          <Link to="/homepage" className="hover:text-[#caef6b] transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-white">Rạp & giá vé</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
              Hệ Thống Cụm Rạp Cinema
            </h1>
            <p className="mt-2 text-sm text-[#9ba9ba]">
              {CINEMA_LIST.length} cụm rạp cao cấp đạt chuẩn quốc tế tại TP. Hồ Chí Minh với công nghệ âm thanh Dolby Atmos & màn chiếu IMAX.
            </p>
          </div>
        </div>
      </div>

      {/* 2. ĐỀ XUẤT RẠP GẦN NHẤT — LOCATION TOOLBAR */}
      <div className="mb-10 overflow-hidden rounded-3xl border border-[#2a3c25] bg-gradient-to-r from-[#121f15] via-[#0f1913] to-[#121923] p-5 shadow-xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#caef6b]/15 text-[#caef6b]">
              <Navigation className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#caef6b]">
                  TÍNH NĂNG THÔNG MINH
                </span>
                {userLocation ? (
                  <span className="rounded-full bg-[#caef6b] px-2 py-0.5 text-[10px] font-bold text-[#090d14]">
                    {locationSource === "gps" ? "Đã định vị GPS" : "Đã chọn khu vực"}
                  </span>
                ) : !isLoggedIn ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                    <Lock className="size-3" />
                    Yêu cầu đăng nhập
                  </span>
                ) : null}
              </div>
              <h2 className="mt-0.5 text-lg font-black text-white">
                Gợi ý rạp chiếu gần bạn nhất
              </h2>
              <p className="mt-1 text-xs text-[#9ba9ba] max-w-xl">
                Bật định vị hoặc chọn khu vực để hệ thống tự động đo khoảng cách (km) và sắp xếp cụm rạp tiện lợi nhất cho bạn.
              </p>
            </div>
          </div>

          {/* Action buttons & selectors */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              onClick={handleFindNearestWithGPS}
              disabled={isLocating}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg shrink-0 transition-all cursor-pointer ${
                isLoggedIn
                  ? "bg-[#caef6b] text-[#090d14] hover:bg-[#b8df5b] shadow-[#caef6b]/10"
                  : "border border-[#38533d] bg-[#142618] text-[#caef6b] hover:bg-[#1a3420]"
              }`}
            >
              {isLocating ? (
                <RotateCw className="mr-2 size-4 animate-spin" />
              ) : !isLoggedIn ? (
                <Lock className="mr-2 size-4 text-[#caef6b]" />
              ) : (
                <LocateFixed className="mr-2 size-4" />
              )}
              {isLocating ? "Đang định vị..." : !isLoggedIn ? "Đăng nhập để định vị" : "Định vị vị trí của tôi"}
            </Button>

            {/* Manual District Selection */}
            <div className="flex items-center rounded-xl border border-[#243041] bg-[#0c1219] px-3 py-1.5 shrink-0">
              <Building2 className="mr-2 size-4 text-[#9ba9ba] shrink-0" />
              <select
                value={selectedPreset}
                onChange={(e) => handleSelectDistrictPreset(e.target.value)}
                className="bg-transparent text-xs text-white outline-none cursor-pointer [color-scheme:dark]"
              >
                <option value="">Hoặc chọn khu vực...</option>
                {Object.entries(DISTRICT_PRESETS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Location Notification Message */}
        {locationMessage && (
          <div className={`mt-4 rounded-xl border px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            !isLoggedIn
              ? "border-amber-500/40 bg-amber-950/30 text-amber-300"
              : "border-[#1f2c3d] bg-[#0c1219]/80 text-[#caef6b]"
          }`}>
            <div className="flex items-center gap-2">
              {!isLoggedIn ? (
                <Lock className="size-4 shrink-0 text-amber-400" />
              ) : (
                <Sparkles className="size-4 shrink-0" />
              )}
              <span>{locationMessage}</span>
            </div>
            {!isLoggedIn ? (
              <Button
                onClick={() => navigate("/login", { state: { from: location } })}
                size="sm"
                className="h-7 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] px-3 shrink-0 cursor-pointer"
              >
                <LogIn className="size-3 mr-1" />
                Đăng nhập ngay
              </Button>
            ) : userLocation ? (
              <button
                type="button"
                onClick={() => {
                  setUserLocation(null)
                  setLocationSource(null)
                  setLocationMessage(null)
                  setSelectedPreset("")
                }}
                className="text-[11px] underline text-[#9ba9ba] hover:text-white ml-2 cursor-pointer"
              >
                Hủy lọc khoảng cách
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* 3. Cinema Grid — Sắp xếp theo khoảng cách nếu đã định vị */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {processedCinemas.map((cinema) => (
          <div
            key={cinema.id}
            className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-2xl ${
              cinema.isClosest
                ? "border-[#caef6b] bg-[#121f15] shadow-[0_0_25px_rgba(202,239,107,0.15)] ring-1 ring-[#caef6b]/50"
                : "border-[#1f2c3d] bg-[#121923] hover:border-[#384c66]"
            }`}
          >
            {/* Top Badge: Rạp gần bạn nhất */}
            {cinema.isClosest && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-[#caef6b] px-3 py-1 text-xs font-black text-[#090d14] shadow-lg">
                <Sparkles className="size-3.5 fill-[#090d14]" />
                <span>RẠP GẦN BẠN NHẤT (~{cinema.distanceKm} km)</span>
              </div>
            )}

            {/* Distance Badge for other cinemas */}
            {!cinema.isClosest && cinema.distanceKm !== null && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-[#1a2838]/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-[#caef6b] border border-[#2f4057]">
                <MapPin className="size-3" />
                <span>Cách bạn ~{cinema.distanceKm} km</span>
              </div>
            )}

            {/* Image */}
            <div className="relative h-48 overflow-hidden">
              <img
                src={cinema.image}
                alt={cinema.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121923] via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                <Star className="size-3.5 fill-[#caef6b] text-[#caef6b]" />
                <span className="text-xs font-bold text-white">{cinema.rating}</span>
                <span className="text-xs text-[#9ba9ba]">({cinema.reviewCount} đánh giá)</span>
              </div>
            </div>

            {/* Details */}
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-white group-hover:text-[#caef6b] transition-colors">
                  {cinema.name}
                </h2>
                {cinema.distanceKm !== null && (
                  <span className="shrink-0 text-xs font-bold text-[#caef6b]">
                    {cinema.distanceKm} km
                  </span>
                )}
              </div>

              <p className="mt-1 flex items-start gap-1.5 text-xs text-[#9ba9ba]">
                <MapPin className="size-3.5 mt-0.5 shrink-0 text-[#caef6b]" />
                {cinema.address}
              </p>

              {/* Features Tags */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="flex items-center gap-1 rounded-md border border-[#243041] bg-[#192331] px-2.5 py-1 text-[11px] text-[#d3dce7]">
                  {cinema.rooms} phòng chiếu
                </span>
                {cinema.features.map((f) => (
                  <span
                    key={f}
                    className="flex items-center gap-1 rounded-md border border-[#243041] bg-[#192331] px-2.5 py-1 text-[11px] text-[#d3dce7]"
                  >
                    {f === "Dolby Atmos" && <Volume2 className="size-3 text-[#caef6b]" />}
                    {(f === "Ghế VIP" || f === "VIP Lounge") && (
                      <Armchair className="size-3 text-[#caef6b]" />
                    )}
                    {f}
                  </span>
                ))}
              </div>

              {/* Bottom Actions: Chỉ đường Google Maps + Xem lịch chiếu */}
              <div className="mt-5 flex items-center justify-between border-t border-[#1f2c3d]/60 pt-4">
                {/* Nút chỉ đường Google Maps */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${cinema.lat},${cinema.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#9ba9ba] hover:text-[#caef6b] transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Chỉ đường Maps</span>
                </a>

                {/* Nút xem lịch chiếu */}
                <Link
                  to={`/showtimes?cinema=${encodeURIComponent(cinema.name)}`}
                  className={`group/link flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    cinema.isClosest
                      ? "bg-[#caef6b] text-[#090d14] hover:bg-[#b8df5b]"
                      : "border border-[#2a3c25] bg-[#162518] text-[#caef6b] hover:bg-[#1d3021]"
                  }`}
                >
                  <span>Xem lịch chiếu & Đặt vé</span>
                  <ArrowUpRight className="size-3.5 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
