import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import {
    Check,
    Clock,
    ChevronLeft,
    AlertCircle,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NOW_SHOWING_MOVIES } from "@/constants"
import { bookingService } from "@/services/booking.service"

export const SeatSelectionPage = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const movieTitle = searchParams.get("movie") || "Tín hiệu từ ngày mai"
    const cinemaName = searchParams.get("cinema") || "Cinema Nguyễn Du"
    const showDate = searchParams.get("date") || "Thứ Bảy, 24/10/2026"
    const showTimeParam = searchParams.get("time") || "19:30"
    const roomName = searchParams.get("room") || "Phòng 03"

    const movie =
        NOW_SHOWING_MOVIES.find((m) => m.title === movieTitle) || NOW_SHOWING_MOVIES[0]

    const [activeTime, setActiveTime] = useState(showTimeParam)

    // ─── Session ID duy nhất cho tab trình duyệt này ───────────────────────
    const sessionId = useRef(
        `seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    ).current
    // Showtime ID (demo: lấy từ URL hoặc mặc định là 1)
    const showtimeId = Number(searchParams.get("showtimeId")) || 1

    // ─── States ─────────────────────────────────────────────────────────────
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
    const [lockedByOthers, setLockedByOthers] = useState<Set<string>>(new Set())
    const [isLocking, setIsLocking] = useState(false)
    const [conflictSeats, setConflictSeats] = useState<string[]>([])
    // Giá từ Backend sau khi lock
    const [backendPrice, setBackendPrice] = useState<number | null>(null)
    const [priceBreakdown, setPriceBreakdown] = useState<{
        regularCount: number; regularPrice: number; regularTotal: number;
        vipCount: number; vipPrice: number; vipTotal: number;
    } | null>(null)
    // Đếm ngược 5 phút
    const [countdown, setCountdown] = useState<number>(0)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ─── Sơ đồ ghế ──────────────────────────────────────────────────────────
    const rows = ["A", "B", "C", "D", "E", "F", "G", "H"]
    const cols = 14

    const soldSet = useMemo(() => {
        return new Set([
            "B4", "B5", "C6", "C7", "C8",
            "D5", "D6", "D7", "D8",
            "E6", "E7", "E8", "E9",
            "F5", "F6", "G7", "G8"
        ])
    }, [])

    // ─── Helper: format tiền VNĐ ─────────────────────────────────────────────
    const formatVND = (amount: number) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)

    // ─── Helper: format đếm ngược mm:ss ─────────────────────────────────────
    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0")
        const s = (seconds % 60).toString().padStart(2, "0")
        return `${m}:${s}`
    }

    // ─── Khởi động đếm ngược 5 phút ─────────────────────────────────────────
    const startCountdown = useCallback((seconds: number) => {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setCountdown(seconds)
        countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!)
                    // Hết hạn → xóa chọn ghế
                    setSelectedSeatIds([])
                    setBackendPrice(null)
                    setPriceBreakdown(null)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [])

    // ─── Giải phóng ghế khi người dùng rời trang ────────────────────────────
    useEffect(() => {
        const handleUnload = () => {
            navigator.sendBeacon(
                "http://localhost:3001/api/booking/release-seats",
                JSON.stringify({ showtimeId, sessionId })
            )
        }
        window.addEventListener("beforeunload", handleUnload)
        return () => {
            window.removeEventListener("beforeunload", handleUnload)
            if (countdownRef.current) clearInterval(countdownRef.current)
            // Giải phóng ghế khi unmount component
            bookingService.releaseSeats(showtimeId, sessionId).catch(() => { })
        }
    }, [showtimeId, sessionId])

    // ─── Toggle ghế và gọi API lock-seats ngay ──────────────────────────────
    const toggleSeat = async (seatId: string, isSold: boolean) => {
        if (isSold || isLocking) return
        setConflictSeats([])

        const newSelected = selectedSeatIds.includes(seatId)
            ? selectedSeatIds.filter((id) => id !== seatId)
            : [...selectedSeatIds, seatId]

        setSelectedSeatIds(newSelected)
        setIsLocking(true)

        try {
            const savedUserStr = localStorage.getItem("user")
            const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null

            const result = await bookingService.lockSeats({
                showtimeId,
                seats: newSelected,
                userId: savedUser?.id,
                sessionId,
                regularPrice: 90000,
                vipPrice: 120000,
            })

            if (result.success && result.data) {
                const data = result.data
                setBackendPrice(data.totalPrice)
                setPriceBreakdown(data.breakdown)
                if (newSelected.length > 0) {
                    startCountdown(data.expiresInSeconds || 300)
                } else {
                    setCountdown(0)
                    if (countdownRef.current) clearInterval(countdownRef.current)
                }
            } else if (!result.success && result.data) {
                // Conflict: có người khác đặt trùng ghế
                const data = result.data as any
                if (data?.conflictingSeats) {
                    setConflictSeats(data.conflictingSeats)
                    setLockedByOthers(new Set([...lockedByOthers, ...data.conflictingSeats]))
                    // Bỏ các ghế bị xung đột ra khỏi selection
                    setSelectedSeatIds(newSelected.filter((s) => !data.conflictingSeats.includes(s)))
                }
            }
        } catch {
            // Nếu backend không kết nối được, vẫn giữ UI hoạt động bình thường (offline mode)
            const localPrice = newSelected.reduce((sum, s) => {
                return sum + (["E", "F", "G"].includes(s[0]) ? 120000 : 90000)
            }, 0)
            setBackendPrice(localPrice)
            if (newSelected.length > 0) startCountdown(300)
            else { setCountdown(0); if (countdownRef.current) clearInterval(countdownRef.current) }
        } finally {
            setIsLocking(false)
        }
    }

    // ─── Tổng tiền hiển thị (ưu tiên giá từ Backend) ────────────────────────
    const totalPrice = backendPrice ?? selectedSeatIds.reduce((sum, seatId) => {
        return sum + (["E", "F", "G"].includes(seatId[0]) ? 120000 : 90000)
    }, 0)
    const formattedPrice = formatVND(totalPrice)

    const handleContinue = () => {
        if (selectedSeatIds.length === 0) return
        navigate(
            `/booking/checkout?movie=${encodeURIComponent(movie.title)}&cinema=${encodeURIComponent(
                cinemaName
            )}&date=${encodeURIComponent(showDate)}&time=${encodeURIComponent(
                activeTime
            )}&room=${encodeURIComponent(roomName)}&seats=${encodeURIComponent(
                selectedSeatIds.join(", ")
            )}&total=${totalPrice}&sessionId=${encodeURIComponent(sessionId)}&showtimeId=${showtimeId}`
        )
    }

    return (
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
            {/* 1. Step Indicator Bar */}
            <div className="mb-8 flex items-center justify-between border-b border-[#1f2c3d] pb-6">
                <Link
                    to={`/movies`}
                    className="flex items-center gap-1.5 text-xs text-[#9ba9ba] hover:text-white transition-colors"
                >
                    <ChevronLeft className="size-4" /> Quay lại phim
                </Link>

                <div className="flex items-center gap-6 sm:gap-10 text-xs font-semibold">
                    <div className="flex items-center gap-2 text-[#caef6b]">
                        <span className="flex size-6 items-center justify-center rounded-full bg-[#162518] border border-[#2a3c25] text-xs">
                            <Check className="size-3.5" />
                        </span>
                        <span className="hidden sm:inline">1. Chọn suất chiếu</span>
                    </div>

                    <div className="flex items-center gap-2 text-white">
                        <span className="flex size-6 items-center justify-center rounded-full bg-[#caef6b] text-[#090d14] text-xs font-bold">
                            2
                        </span>
                        <span>2. Chọn ghế</span>
                    </div>

                    <div className="flex items-center gap-2 text-[#9ba9ba]">
                        <span className="flex size-6 items-center justify-center rounded-full border border-[#243041] bg-[#121923] text-xs">
                            3
                        </span>
                        <span className="hidden sm:inline">3. Thanh toán</span>
                    </div>
                </div>
            </div>

            {/* 2. Header */}
            <div className="mb-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                    ĐẶT VÉ TRỰC TUYẾN · BƯỚC 2/3
                </span>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Chọn chỗ cho câu chuyện của bạn
                </h1>
                <p className="mt-1 text-sm text-[#9ba9ba]">
                    {movie.title} · {showDate} · {activeTime} · {cinemaName} ({roomName})
                </p>
            </div>

            {/* 3. Showtime Filter Tabs */}
            <div className="mb-8 flex items-center gap-3">
                <span className="text-xs font-semibold text-[#9ba9ba]">Suất chiếu:</span>
                {["14:00", "16:45", "19:30", "21:50"].map((slot) => (
                    <button
                        key={slot}
                        onClick={() => setActiveTime(slot)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTime === slot
                            ? "bg-[#caef6b] text-[#090d14] shadow-md shadow-[#caef6b]/10"
                            : "border border-[#243041] bg-[#121923] text-[#9ba9ba] hover:text-white"
                            }`}
                    >
                        {slot}
                    </button>
                ))}
            </div>

            {/* 4. Main Two-Column Layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left / Center Column: Seat Map */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-8">
                    {/* Curved Screen */}
                    <div className="mx-auto mb-12 max-w-lg text-center">
                        <div className="relative h-4 w-full overflow-hidden">
                            <div className="h-10 w-full rounded-[100%] border-t-4 border-[#caef6b]/80 shadow-[0_-15px_30px_rgba(202,239,107,0.3)]" />
                        </div>
                        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9ba9ba]">
                            MÀN HÌNH
                        </span>
                    </div>

                    {/* Seat Matrix */}
                    <div className="overflow-x-auto pb-4">
                        <div className="min-w-[560px] flex flex-col items-center gap-2.5">
                            {rows.map((row) => {
                                const isSweetboxRow = row === "H"
                                const isVipRow = ["E", "F", "G"].includes(row)
                                return (
                                    <div key={row} className="flex items-center gap-2">
                                        <span className="w-5 text-center text-xs font-bold text-[#9ba9ba]">
                                            {row}
                                        </span>

                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                            {Array.from({ length: cols }, (_, i) => i + 1).map((col) => {
                                                const seatId = `${row}${col}`
                                                const isSold = soldSet.has(seatId)
                                                const isLockedByOther = lockedByOthers.has(seatId)
                                                const isSelected = selectedSeatIds.includes(seatId)
                                                const isConflict = conflictSeats.includes(seatId)

                                                // Add aisle margin
                                                const isAisle = col === 4 || col === 10

                                                return (
                                                    <button
                                                        key={seatId}
                                                        disabled={isSold || isLockedByOther || isLocking}
                                                        onClick={() => toggleSeat(seatId, isSold || isLockedByOther)}
                                                        title={`${seatId} (${isSweetboxRow ? "Sweetbox đôi 160k" : isVipRow ? "VIP 120k" : "Thường 90k"})${isLockedByOther ? " - Đang bị giữ chỗ" : ""}`}
                                                        className={`flex size-7 sm:size-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all ${isAisle ? "mr-4" : ""
                                                            } ${isConflict
                                                                ? "bg-red-500/40 border border-red-500 text-red-300 animate-pulse"
                                                                : isSelected
                                                                    ? "bg-[#caef6b] text-[#090d14] shadow-[0_0_12px_rgba(202,239,107,0.5)] scale-105"
                                                                    : isSold || isLockedByOther
                                                                        ? "bg-[#18202b] text-[#3e5066] cursor-not-allowed border border-[#243041]/40"
                                                                        : isSweetboxRow
                                                                            ? "border border-[#7c3aed] bg-[#2e1065] text-[#c084fc] hover:border-[#c084fc]"
                                                                            : isVipRow
                                                                                ? "border border-[#2a3c25] bg-[#17261a] text-[#caef6b] hover:border-[#caef6b]"
                                                                                : "border border-[#243041] bg-[#1a2431] text-[#9ba9ba] hover:border-white hover:text-white"
                                                            }`}
                                                    >
                                                        {isLocking && isSelected ? <Loader2 className="size-3 animate-spin" /> : col}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <span className="w-5 text-center text-xs font-bold text-[#9ba9ba]">
                                            {row}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Seat Legend */}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-[#1f2c3d] pt-6 text-xs text-[#9ba9ba]">
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md border border-[#243041] bg-[#1a2431]" />
                            <span>Ghế thường (90.000 đ)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md border border-[#2a3c25] bg-[#17261a]" />
                            <span>Ghế VIP (120.000 đ)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md border border-[#7c3aed] bg-[#2e1065]" />
                            <span>Ghế Sweetbox (160.000 đ)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md bg-[#caef6b]" />
                            <span className="font-semibold text-white">Đang chọn</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md bg-[#18202b] border border-[#243041]/40" />
                            <span>Đã bán</span>
                        </div>
                    </div>

                    {/* Conflict Alert */}
                    {conflictSeats.length > 0 && (
                        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-900/20 p-4 text-xs text-red-400">
                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            <span>
                                Ghế <strong className="text-red-300">{conflictSeats.join(", ")}</strong> vừa bị người khác giữ chỗ. Vui lòng chọn ghế khác!
                            </span>
                        </div>
                    )}

                    {/* 5-minute Hold Timer Notice */}
                    {selectedSeatIds.length > 0 && countdown > 0 && (
                        <div className={`mt-5 flex items-center gap-2.5 rounded-2xl border p-4 text-xs transition-colors ${countdown <= 60
                            ? "border-red-500/40 bg-red-900/20 text-red-400"
                            : "border-[#2a3c25] bg-[#121f15] text-[#caef6b]"
                            }`}>
                            <Clock className="size-4 shrink-0" />
                            <span>
                                Ghế <strong>{selectedSeatIds.join(", ")}</strong> được tạm giữ trong{" "}
                                <strong className={countdown <= 60 ? "text-red-300" : ""}>{formatCountdown(countdown)}</strong> phút để bạn hoàn tất thanh toán.
                            </span>
                        </div>
                    )}
                </div>

                {/* Right Column: Booking Summary Card */}
                <div className="lg:col-span-4">
                    <div className="sticky top-28 rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <h2 className="text-base font-bold text-white border-b border-[#1f2c3d] pb-4">
                            Thông tin đặt vé
                        </h2>

                        <div className="mt-4 flex gap-4">
                            <img
                                src={movie.poster}
                                alt={movie.title}
                                className="h-28 w-20 rounded-xl object-cover shadow-md shrink-0"
                            />
                            <div className="space-y-1">
                                <Badge className="border-[#2a3c25] bg-[#162518] text-[#caef6b] text-[10px]">
                                    {movie.rating}
                                </Badge>
                                <h3 className="text-sm font-bold text-white line-clamp-1">{movie.title}</h3>
                                <p className="text-[11px] text-[#9ba9ba]">{movie.genre}</p>
                                <p className="text-[11px] text-[#9ba9ba]">2D Dolby Atmos</p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-3 divide-y divide-[#1f2c3d]/60 text-xs">
                            <div className="flex justify-between pt-2">
                                <span className="text-[#9ba9ba]">Rạp</span>
                                <span className="font-semibold text-white">{cinemaName}</span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Phòng chiếu</span>
                                <span className="font-semibold text-white">{roomName}</span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Suất chiếu</span>
                                <span className="font-semibold text-white">
                                    {activeTime} · {showDate}
                                </span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Ghế đã chọn</span>
                                <span className="font-bold text-[#caef6b]">
                                    {selectedSeatIds.length > 0 ? selectedSeatIds.join(", ") : "Chưa chọn ghế"}
                                </span>
                            </div>
                            {/* Breakdown giá tiền từ Backend */}
                            {priceBreakdown && selectedSeatIds.length > 0 && (
                                <div className="pt-3 space-y-1.5 text-[11px] text-[#9ba9ba]">
                                    {priceBreakdown.regularCount > 0 && (
                                        <div className="flex justify-between">
                                            <span>Ghế thường × {priceBreakdown.regularCount}</span>
                                            <span>{formatVND(priceBreakdown.regularTotal)}</span>
                                        </div>
                                    )}
                                    {priceBreakdown.vipCount > 0 && (
                                        <div className="flex justify-between">
                                            <span>Ghế VIP × {priceBreakdown.vipCount}</span>
                                            <span>{formatVND(priceBreakdown.vipTotal)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex justify-between pt-3">
                                <span className="text-sm font-bold text-white">Tổng thanh toán</span>
                                <span className="text-base font-black text-[#caef6b]">{formattedPrice}</span>
                            </div>
                        </div>

                        <Button
                            disabled={selectedSeatIds.length === 0}
                            onClick={handleContinue}
                            className="mt-6 w-full rounded-xl bg-[#caef6b] py-2.5 font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10 disabled:opacity-40"
                        >
                            Tiếp tục thanh toán
                        </Button>

                        <p className="mt-3 text-center text-[10px] text-[#9ba9ba] leading-tight">
                            Bằng việc chọn ghế, bạn đồng ý với chính sách giữ chỗ và hủy vé của rạp.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
