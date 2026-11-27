import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import {
    Check,
    Clock,
    ChevronLeft,
    AlertCircle,
    Loader2,
    MapPin,
    Armchair,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NOW_SHOWING_MOVIES, COMING_SOON_MOVIES } from "@/constants"
import {
    bookingService,
    type ShowtimeSlotInfo,
    type PriceBreakdown,
} from "@/services/booking.service"
import { API_BASE_URL } from "@/services/api"
import { resolveCinemaLocation } from "@/lib/ticketPdf"

// Mẫu ghế dự phòng khác nhau cho từng khung giờ khi chạy offline (không kết nối được Backend)
const OFFLINE_SOLD_BY_SLOT: Record<string, string[]> = {
    "09:30": ["C5", "C6", "D5", "D6", "D7", "D8", "E6", "E7", "F6", "F7"],
    "14:00": ["B6", "B7", "C8", "C9", "E4", "E5"],
    "16:45": ["D4", "D5", "E8", "E9", "F8", "F9", "F10", "G6"],
    "19:30": ["B4", "B5", "C6", "C7", "C8", "D5", "D6", "D7", "D8", "E6", "E7", "E8", "E9", "F5", "F6", "G7", "G8"],
    "21:50": ["E5", "E6", "F5", "F6", "H7", "H8"],
}

function buildOfflineSlots(
    movieTitle: string,
    cinemaName: string,
    showDate: string,
    requestedTime?: string
): ShowtimeSlotInfo[] {
    const loc = resolveCinemaLocation(cinemaName)
    const times = ["09:30", "14:00", "16:45", "19:30", "21:50"]
    if (requestedTime && !times.includes(requestedTime)) {
        times.push(requestedTime)
        times.sort()
    }
    const rooms = [
        { id: 1, name: "Phòng 01", rows: 7, cols: 14, vipRows: "F,G" },
        { id: 2, name: "Phòng 02", rows: 7, cols: 12, vipRows: "F,G" },
        { id: 3, name: "Phòng 03", rows: 8, cols: 14, vipRows: "E,F,G" },
        { id: 1, name: "Phòng 01", rows: 7, cols: 14, vipRows: "F,G" },
        { id: 5, name: "Phòng 05", rows: 8, cols: 12, vipRows: "E,F,G" },
    ]

    return times.map((time, idx) => {
        const rm = rooms[idx % rooms.length]
        const totalSeats = rm.rows * rm.cols
        const soldList = (OFFLINE_SOLD_BY_SLOT[time] || []).filter((code) => {
            const rIdx = code.charCodeAt(0) - 65
            const col = parseInt(code.slice(1), 10)
            return rIdx >= 0 && rIdx < rm.rows && col >= 1 && col <= rm.cols
        })
        const showtimeId = 1000 + idx + 1
        return {
            showtimeId,
            movieId: 1,
            movieTitle,
            roomId: rm.id,
            roomName: rm.name,
            cinemaId: 1,
            cinemaName,
            cinemaAddress: loc.address,
            cinemaPhone: loc.phone,
            startTime: time,
            endTime: "21:30",
            showDate,
            dateISO: "2026-10-24",
            rowsCount: rm.rows,
            colsCount: rm.cols,
            vipRows: rm.vipRows,
            format: "2D Dolby Atmos",
            priceRegular: 90000,
            priceVip: 120000,
            priceSweetbox: 160000,
            totalSeats,
            bookedCount: soldList.length,
            lockedCount: 0,
            availableSeats: Math.max(0, totalSeats - soldList.length),
        }
    })
}

export const SeatSelectionPage = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()

    const movieTitle = searchParams.get("movie") || "Tín hiệu từ ngày mai"
    const cinemaName = searchParams.get("cinema") || "Cinema Nguyễn Du"
    const showDate = searchParams.get("date") || "Thứ Bảy, 24/10/2026"
    const initialTimeParam = searchParams.get("time") || "19:30"
    const initialRoomParam = searchParams.get("room") || "Phòng 01"
    const initialShowtimeIdParam = Number(searchParams.get("showtimeId")) || 0

    const allMovies = useMemo(() => [...NOW_SHOWING_MOVIES, ...COMING_SOON_MOVIES], [])
    const movie =
        allMovies.find((m) => m.title.toLowerCase() === movieTitle.toLowerCase()) ||
        NOW_SHOWING_MOVIES[0]

    // Session ID duy nhất cho phiên chọn ghế của tab trình duyệt
    const sessionId = useRef(
        sessionParamsOrCreate(searchParams.get("sessionId"))
    ).current

    // Danh sách các khung giờ chiếu của phim (mỗi suất có showtimeId & số ghế trống riêng)
    const [slots, setSlots] = useState<ShowtimeSlotInfo[]>([])
    const [activeShowtimeId, setActiveShowtimeId] = useState<number>(initialShowtimeIdParam)
    const [activeTime, setActiveTime] = useState<string>(initialTimeParam)
    const [activeEndTime, setActiveEndTime] = useState<string>("21:28")
    const [activeRoom, setActiveRoom] = useState<string>(initialRoomParam)
    const [activeFormat, setActiveFormat] = useState<string>(movie.format || "2D Dolby Atmos")
    const [cinemaAddress, setCinemaAddress] = useState<string>(
        () => resolveCinemaLocation(cinemaName, searchParams.get("address")).address
    )

    // Cấu hình sơ đồ ghế của suất đang chọn
    const [rowsCount, setRowsCount] = useState<number>(8)
    const [colsCount, setColsCount] = useState<number>(14)
    const [vipRowsStr, setVipRowsStr] = useState<string>("E,F,G")
    const [priceRegular, setPriceRegular] = useState<number>(90000)
    const [priceVip, setPriceVip] = useState<number>(120000)
    const [priceSweetbox, setPriceSweetbox] = useState<number>(160000)

    // Trạng thái ghế của ĐÚNG suất chiếu đang chọn
    const [soldSeats, setSoldSeats] = useState<Set<string>>(new Set())
    const [lockedByOthers, setLockedByOthers] = useState<Set<string>>(new Set())
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
    const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(true)
    const [isLoadingSeats, setIsLoadingSeats] = useState<boolean>(true)
    const [isLocking, setIsLocking] = useState<boolean>(false)
    const [conflictSeats, setConflictSeats] = useState<string[]>([])

    // Giá từ Backend sau khi giữ chỗ
    const [backendPrice, setBackendPrice] = useState<number | null>(null)
    const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null)

    // Đếm ngược 5 phút giữ chỗ
    const [countdown, setCountdown] = useState<number>(0)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const seatFetchSeqRef = useRef<number>(0)
    const activeShowtimeRef = useRef<number>(activeShowtimeId)
    activeShowtimeRef.current = activeShowtimeId

    const formatVND = (amount: number) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)

    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0")
        const s = (seconds % 60).toString().padStart(2, "0")
        return `${m}:${s}`
    }

    const clearCountdownTimer = useCallback(() => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
        }
        setCountdown(0)
    }, [])

    const startCountdown = useCallback((seconds: number) => {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setCountdown(seconds)
        countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    if (countdownRef.current) clearInterval(countdownRef.current)
                    setSelectedSeatIds([])
                    setBackendPrice(null)
                    setPriceBreakdown(null)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [])

    // ─── 1. Tải danh sách khung giờ chiếu của phim kèm số ghế trống riêng từng suất ───
    useEffect(() => {
        let cancelled = false
        setIsLoadingSlots(true)

        const loadSlots = async () => {
            const res = await bookingService.getMovieShowtimes({
                movieId: Number(movie.id) || undefined,
                movie: movie.title,
                cinema: cinemaName,
                date: showDate,
                sessionId,
                time: initialTimeParam,
            })

            if (cancelled) return

            let resolvedSlots: ShowtimeSlotInfo[] = []
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                resolvedSlots = res.data
            } else {
                resolvedSlots = buildOfflineSlots(movie.title, cinemaName, showDate, initialTimeParam)
            }

            setSlots(resolvedSlots)

            // Chọn đúng suất từ URL (ưu tiên showtimeId nếu khớp, sau đó khớp theo khung giờ)
            const matched =
                (initialShowtimeIdParam > 0
                    ? resolvedSlots.find((s) => s.showtimeId === initialShowtimeIdParam)
                    : undefined) ||
                resolvedSlots.find((s) => s.startTime === initialTimeParam) ||
                resolvedSlots[0]

            if (matched) {
                setActiveShowtimeId(matched.showtimeId)
                setActiveTime(matched.startTime)
                setActiveEndTime(matched.endTime)
                setActiveRoom(matched.roomName)
                setActiveFormat(matched.format)
                setCinemaAddress(matched.cinemaAddress || resolveCinemaLocation(cinemaName).address)
                setRowsCount(matched.rowsCount)
                setColsCount(matched.colsCount)
                setVipRowsStr(matched.vipRows)
                setPriceRegular(matched.priceRegular)
                setPriceVip(matched.priceVip)
                setPriceSweetbox(matched.priceSweetbox)
            }
            setIsLoadingSlots(false)
        }

        void loadSlots()
        return () => {
            cancelled = true
        }
    }, [movie.id, movie.title, cinemaName, showDate, sessionId])

    // ─── 2. Tải trạng thái ghế RIÊNG BIỆT mỗi khi activeShowtimeId thay đổi ────────
    useEffect(() => {
        if (!activeShowtimeId) return

        const currentSeq = ++seatFetchSeqRef.current
        setIsLoadingSeats(true)

        const fetchSeatsForShowtime = async () => {
            // Chế độ offline dự phòng nếu showtimeId >= 1000
            if (activeShowtimeId >= 1000) {
                const offlineSlot = slots.find((s) => s.showtimeId === activeShowtimeId)
                const slotTime = offlineSlot?.startTime || activeTime
                const rCount = offlineSlot?.rowsCount || rowsCount
                const cCount = offlineSlot?.colsCount || colsCount
                const validSold = (OFFLINE_SOLD_BY_SLOT[slotTime] || []).filter((code) => {
                    const rIdx = code.charCodeAt(0) - 65
                    const col = parseInt(code.slice(1), 10)
                    return rIdx >= 0 && rIdx < rCount && col >= 1 && col <= cCount
                })
                if (currentSeq !== seatFetchSeqRef.current) return
                setSoldSeats(new Set(validSold))
                setLockedByOthers(new Set())
                setIsLoadingSeats(false)
                return
            }

            const res = await bookingService.getOccupiedSeats(activeShowtimeId, sessionId)
            if (currentSeq !== seatFetchSeqRef.current) return

            if (res.success && res.data) {
                const d = res.data
                const booked = new Set(d.bookedSeats || [])
                const others = new Set(d.lockedByOthers || [])

                setSoldSeats(booked)
                setLockedByOthers(others)
                setRowsCount(d.rowsCount || 8)
                setColsCount(d.colsCount || 14)
                setVipRowsStr(d.vipRows || "E,F,G")
                setPriceRegular(d.priceRegular || 90000)
                setPriceVip(d.priceVip || 120000)
                setPriceSweetbox(d.priceSweetbox || (d.priceVip || 120000) + 40000)
                setActiveRoom(d.roomName || activeRoom)
                setActiveFormat(d.format || activeFormat)
                setActiveEndTime(d.endTime || activeEndTime)
                if (d.cinemaAddress) setCinemaAddress(d.cinemaAddress)

                // Đồng bộ lại số ghế trống chính xác của suất này trên thanh chọn suất chiếu
                setSlots((prev) =>
                    prev.map((slot) =>
                        slot.showtimeId === activeShowtimeId
                            ? {
                                  ...slot,
                                  totalSeats: d.totalSeats,
                                  availableSeats: d.availableSeats,
                                  roomName: d.roomName || slot.roomName,
                              }
                            : slot
                    )
                )

                // Khôi phục ghế đang giữ của chính phiên này (nếu người dùng quay lại từ trang thanh toán)
                if (Array.isArray(d.myLockedSeats) && d.myLockedSeats.length > 0 && d.expiresInSeconds > 0) {
                    setSelectedSeatIds(d.myLockedSeats)
                    startCountdown(d.expiresInSeconds)
                }
            }
            setIsLoadingSeats(false)
        }

        void fetchSeatsForShowtime()
    }, [activeShowtimeId, sessionId, startCountdown])

    // ─── 3. Đổi khung giờ chiếu: giải phóng ghế suất cũ & tải sơ đồ ghế riêng suất mới ─
    const handleSelectShowtimeSlot = (slot: ShowtimeSlotInfo) => {
        if (slot.showtimeId === activeShowtimeId) return

        const prevShowtimeId = activeShowtimeId
        const hadSelectedSeats = selectedSeatIds.length > 0

        // Xóa ngay toàn bộ trạng thái chọn ghế của suất cũ để không bị trùng sang suất mới
        clearCountdownTimer()
        setSelectedSeatIds([])
        setConflictSeats([])
        setBackendPrice(null)
        setPriceBreakdown(null)
        setSoldSeats(new Set())
        setLockedByOthers(new Set())
        setIsLoadingSeats(true)

        // Hủy giữ chỗ tạm thời ở suất cũ (nếu có)
        if (hadSelectedSeats && prevShowtimeId > 0 && prevShowtimeId < 1000) {
            void bookingService.releaseSeats(prevShowtimeId, sessionId)
        }

        // Chuyển sang suất chiếu mới
        setActiveShowtimeId(slot.showtimeId)
        setActiveTime(slot.startTime)
        setActiveEndTime(slot.endTime)
        setActiveRoom(slot.roomName)
        setActiveFormat(slot.format)
        if (slot.cinemaAddress) setCinemaAddress(slot.cinemaAddress)
        setRowsCount(slot.rowsCount)
        setColsCount(slot.colsCount)
        setVipRowsStr(slot.vipRows)
        setPriceRegular(slot.priceRegular)
        setPriceVip(slot.priceVip)
        setPriceSweetbox(slot.priceSweetbox)

        // Đồng bộ URL để F5 hoặc quay lại từ trang Thanh toán vẫn giữ đúng suất chiếu
        const nextParams = new URLSearchParams(searchParams)
        nextParams.set("movie", movie.title)
        nextParams.set("cinema", cinemaName)
        nextParams.set("date", showDate)
        nextParams.set("time", slot.startTime)
        nextParams.set("room", slot.roomName)
        nextParams.set("showtimeId", String(slot.showtimeId))
        setSearchParams(nextParams, { replace: true })
    }

    // ─── 4. Giải phóng ghế khi đóng tab (không hủy giữ chỗ khi chuyển sang bước Checkout) ─
    const navigatingToCheckoutRef = useRef<boolean>(false)

    useEffect(() => {
        const handleUnload = () => {
            const stId = activeShowtimeRef.current
            if (stId > 0 && stId < 1000) {
                const payload = new Blob(
                    [JSON.stringify({ showtimeId: stId, sessionId })],
                    { type: "application/json" }
                )
                navigator.sendBeacon(`${API_BASE_URL}/booking/release-seats`, payload)
            }
        }
        window.addEventListener("beforeunload", handleUnload)
        return () => {
            window.removeEventListener("beforeunload", handleUnload)
            if (countdownRef.current) clearInterval(countdownRef.current)
            const stId = activeShowtimeRef.current
            if (!navigatingToCheckoutRef.current && stId > 0 && stId < 1000) {
                bookingService.releaseSeats(stId, sessionId).catch(() => {})
            }
        }
    }, [sessionId])

    // ─── Phân loại hàng ghế & tính giá từng ghế ────────────────────────────
    const rows = useMemo(
        () => Array.from({ length: rowsCount }, (_, idx) => String.fromCharCode(65 + idx)),
        [rowsCount]
    )

    const vipRowSet = useMemo(
        () =>
            new Set(
                vipRowsStr
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean)
            ),
        [vipRowsStr]
    )

    const sweetboxRowChar = rowsCount >= 8 ? rows[rows.length - 1] : null

    const getSeatType = useCallback(
        (seatId: string): "regular" | "vip" | "sweetbox" => {
            const row = (seatId[0] || "A").toUpperCase()
            if (sweetboxRowChar && row === sweetboxRowChar) return "sweetbox"
            if (vipRowSet.has(row)) return "vip"
            return "regular"
        },
        [sweetboxRowChar, vipRowSet]
    )

    const getSeatPrice = useCallback(
        (seatId: string): number => {
            const type = getSeatType(seatId)
            if (type === "sweetbox") return priceSweetbox
            if (type === "vip") return priceVip
            return priceRegular
        },
        [getSeatType, priceRegular, priceVip, priceSweetbox]
    )

    // Thống kê số ghế của suất chiếu hiện tại
    const totalRoomSeats = rowsCount * colsCount
    const occupiedByOthersCount = useMemo(() => {
        const union = new Set<string>([...soldSeats, ...lockedByOthers])
        return union.size
    }, [soldSeats, lockedByOthers])
    const baseAvailableSeats = Math.max(0, totalRoomSeats - occupiedByOthersCount)
    const remainingAvailableSeats = Math.max(0, baseAvailableSeats - selectedSeatIds.length)

    // ─── Toggle chọn ghế & khóa ghế theo đúng activeShowtimeId ──────────────
    const toggleSeat = async (seatId: string, isUnavailable: boolean) => {
        if (isUnavailable || isLocking || isLoadingSeats) return
        setConflictSeats([])

        const newSelected = selectedSeatIds.includes(seatId)
            ? selectedSeatIds.filter((id) => id !== seatId)
            : [...selectedSeatIds, seatId]

        setSelectedSeatIds(newSelected)

        if (activeShowtimeId >= 1000) {
            const localSum = newSelected.reduce((sum, s) => sum + getSeatPrice(s), 0)
            setBackendPrice(localSum)
            if (newSelected.length > 0) startCountdown(300)
            else clearCountdownTimer()
            return
        }

        setIsLocking(true)
        try {
            const savedUserStr = localStorage.getItem("user")
            const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null

            const result = await bookingService.lockSeats({
                showtimeId: activeShowtimeId,
                seats: newSelected,
                userId: savedUser?.id,
                sessionId,
                regularPrice: priceRegular,
                vipPrice: priceVip,
            })

            const payloadData = result.data || (result as unknown as LockSeatsResponseCompat)

            if (result.success && payloadData) {
                setBackendPrice(payloadData.totalPrice ?? null)
                setPriceBreakdown(payloadData.breakdown ?? null)
                if (newSelected.length > 0) {
                    startCountdown(payloadData.expiresInSeconds || 300)
                } else {
                    clearCountdownTimer()
                }
            } else {
                const conflicts = payloadData?.conflictingSeats || []
                if (conflicts.length > 0) {
                    setConflictSeats(conflicts)
                    setLockedByOthers((prev) => new Set([...prev, ...conflicts]))
                    setSelectedSeatIds(newSelected.filter((s) => !conflicts.includes(s)))
                }
            }
        } catch {
            const localPrice = newSelected.reduce((sum, s) => sum + getSeatPrice(s), 0)
            setBackendPrice(localPrice)
            if (newSelected.length > 0) startCountdown(300)
            else clearCountdownTimer()
        } finally {
            setIsLocking(false)
        }
    }

    const totalPrice =
        backendPrice ?? selectedSeatIds.reduce((sum, seatId) => sum + getSeatPrice(seatId), 0)
    const formattedPrice = formatVND(totalPrice)

    // Định dạng chuỗi ghế kèm phân loại để chuyển sang trang Thanh toán
    const formattedSelectedSeatsLabel = useMemo(() => {
        if (selectedSeatIds.length === 0) return ""
        const sorted = [...selectedSeatIds].sort((a, b) => {
            if (a[0] !== b[0]) return a[0].localeCompare(b[0])
            return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)
        })
        const types = new Set(sorted.map((s) => getSeatType(s)))
        const labels: string[] = []
        if (types.has("sweetbox")) labels.push("Sweetbox")
        if (types.has("vip")) labels.push("VIP")
        if (types.has("regular")) labels.push("Thường")
        return `${sorted.join(", ")}${labels.length > 0 ? ` (${labels.join(", ")})` : ""}`
    }, [selectedSeatIds, getSeatType])

    const handleContinue = () => {
        if (selectedSeatIds.length === 0) return
        navigatingToCheckoutRef.current = true
        const qs = new URLSearchParams({
            movie: movie.title,
            cinema: cinemaName,
            address: cinemaAddress,
            date: showDate,
            time: activeTime,
            endTime: activeEndTime,
            room: activeRoom,
            format: activeFormat,
            seats: formattedSelectedSeatsLabel,
            total: String(totalPrice),
            sessionId,
            showtimeId: String(activeShowtimeId),
        })
        navigate(`/booking/checkout?${qs.toString()}`)
    }

    const aisleLeft = Math.min(4, Math.floor(colsCount / 3))
    const aisleRight = Math.max(aisleLeft + 2, colsCount - aisleLeft)

    return (
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
            {/* 1. Step Indicator Bar */}
            <div className="mb-8 flex items-center justify-between border-b border-[#1f2c3d] pb-6">
                <Link
                    to={`/movies/${movie.id}`}
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
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#9ba9ba]">
                    <span className="font-semibold text-white">{movie.title}</span>
                    <span>·</span>
                    <span>{showDate}</span>
                    <span>·</span>
                    <span className="text-[#caef6b] font-semibold">{activeTime}</span>
                    <span>·</span>
                    <span>
                        {cinemaName} ({activeRoom})
                    </span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9ba9ba]">
                    <MapPin className="size-3.5 text-[#caef6b] shrink-0" />
                    <span>{cinemaAddress}</span>
                </p>
            </div>

            {/* 3. Showtime Filter Tabs — Mỗi suất chiếu hiển thị đúng số ghế trống riêng */}
            <div className="mb-8 rounded-2xl border border-[#1f2c3d] bg-[#121923]/90 p-4">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#9ba9ba]">
                        Đổi khung giờ chiếu ({showDate}):
                    </span>
                    <span className="text-[11px] text-[#9ba9ba]">
                        Mỗi khung giờ có sơ đồ ghế và lượng ghế trống độc lập
                    </span>
                </div>

                {isLoadingSlots ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-[#9ba9ba]">
                        <Loader2 className="size-4 animate-spin text-[#caef6b]" />
                        <span>Đang tải danh sách suất chiếu và số ghế trống...</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-3">
                        {slots.map((slot) => {
                            const isActive = slot.showtimeId === activeShowtimeId
                            const displayAvail = isActive
                                ? remainingAvailableSeats
                                : slot.availableSeats
                            const displayTotal = isActive ? totalRoomSeats : slot.totalSeats
                            const isSoldOut = displayAvail <= 0

                            return (
                                <button
                                    key={slot.showtimeId}
                                    type="button"
                                    onClick={() => handleSelectShowtimeSlot(slot)}
                                    className={`flex flex-col items-start rounded-xl px-4 py-2.5 text-left transition-all cursor-pointer border ${
                                        isActive
                                            ? "border-[#caef6b] bg-[#caef6b] text-[#090d14] shadow-md shadow-[#caef6b]/15"
                                            : "border-[#243041] bg-[#0e141d] text-white hover:border-[#3d516b]"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black">{slot.startTime}</span>
                                        <span
                                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                                isActive
                                                    ? "bg-[#090d14]/15 text-[#090d14]"
                                                    : "bg-[#192331] text-[#9ba9ba]"
                                            }`}
                                        >
                                            {slot.roomName}
                                        </span>
                                    </div>
                                    <span
                                        className={`mt-1 text-[11px] font-semibold ${
                                            isActive
                                                ? "text-[#090d14]/85"
                                                : isSoldOut
                                                  ? "text-red-400"
                                                  : "text-[#caef6b]"
                                        }`}
                                    >
                                        {isSoldOut
                                            ? "Hết ghế"
                                            : `Còn ${displayAvail}/${displayTotal} ghế trống`}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 4. Main Two-Column Layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left / Center Column: Seat Map */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-8">
                    {/* Thanh thống kê ghế thực tế của suất chiếu đang chọn */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1f2c3d] bg-[#0c121a] px-4 py-3 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-white">
                            <Armchair className="size-4 text-[#caef6b]" />
                            <span>
                                Suất {activeTime} · {activeRoom}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-[11px]">
                            <span className="text-[#9ba9ba]">
                                Ghế trống:{" "}
                                <strong className="text-[#caef6b]">
                                    {remainingAvailableSeats}/{totalRoomSeats}
                                </strong>
                            </span>
                            <span className="text-[#9ba9ba]">
                                Đã đặt:{" "}
                                <strong className="text-white">{occupiedByOthersCount}</strong>
                            </span>
                            {selectedSeatIds.length > 0 && (
                                <span className="text-[#9ba9ba]">
                                    Đang chọn:{" "}
                                    <strong className="text-[#caef6b]">
                                        {selectedSeatIds.length}
                                    </strong>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Curved Screen */}
                    <div className="mx-auto mb-10 max-w-lg text-center">
                        <div className="relative h-4 w-full overflow-hidden">
                            <div className="h-10 w-full rounded-[100%] border-t-4 border-[#caef6b]/80 shadow-[0_-15px_30px_rgba(202,239,107,0.3)]" />
                        </div>
                        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9ba9ba]">
                            MÀN HÌNH · {activeRoom.toUpperCase()}
                        </span>
                    </div>

                    {/* Seat Matrix */}
                    {isLoadingSeats ? (
                        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-xs text-[#9ba9ba]">
                            <Loader2 className="size-7 animate-spin text-[#caef6b]" />
                            <span>Đang tải sơ đồ ghế của suất {activeTime}...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto pb-4">
                            <div className="min-w-[560px] flex flex-col items-center gap-2.5">
                                {rows.map((row) => {
                                    const isSweetboxRow = sweetboxRowChar === row
                                    const isVipRow = !isSweetboxRow && vipRowSet.has(row)
                                    return (
                                        <div key={row} className="flex items-center gap-2">
                                            <span className="w-5 text-center text-xs font-bold text-[#9ba9ba]">
                                                {row}
                                            </span>

                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                {Array.from({ length: colsCount }, (_, i) => i + 1).map(
                                                    (col) => {
                                                        const seatId = `${row}${col}`
                                                        const isSold = soldSeats.has(seatId)
                                                        const isLockedByOther = lockedByOthers.has(seatId)
                                                        const isSelected = selectedSeatIds.includes(seatId)
                                                        const isConflict = conflictSeats.includes(seatId)
                                                        const isAisle = col === aisleLeft || col === aisleRight

                                                        return (
                                                            <button
                                                                key={`${activeShowtimeId}-${seatId}`}
                                                                type="button"
                                                                disabled={
                                                                    isSold || isLockedByOther || isLocking
                                                                }
                                                                onClick={() =>
                                                                    toggleSeat(
                                                                        seatId,
                                                                        isSold || isLockedByOther
                                                                    )
                                                                }
                                                                title={`${seatId} (${
                                                                    isSweetboxRow
                                                                        ? `Sweetbox ${formatVND(priceSweetbox)}`
                                                                        : isVipRow
                                                                          ? `VIP ${formatVND(priceVip)}`
                                                                          : `Thường ${formatVND(priceRegular)}`
                                                                })${
                                                                    isSold
                                                                        ? " - Đã bán"
                                                                        : isLockedByOther
                                                                          ? " - Đang được khách khác giữ chỗ"
                                                                          : ""
                                                                }`}
                                                                className={`flex size-7 sm:size-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                                                                    isAisle ? "mr-4" : ""
                                                                } ${
                                                                    isConflict
                                                                        ? "bg-red-500/40 border border-red-500 text-red-300 animate-pulse"
                                                                        : isSelected
                                                                          ? "bg-[#caef6b] text-[#090d14] shadow-[0_0_12px_rgba(202,239,107,0.5)] scale-105 cursor-pointer"
                                                                          : isSold || isLockedByOther
                                                                            ? "bg-[#18202b] text-[#3e5066] cursor-not-allowed border border-[#243041]/40 line-through"
                                                                            : isSweetboxRow
                                                                              ? "border border-[#7c3aed] bg-[#2e1065] text-[#c084fc] hover:border-[#c084fc] cursor-pointer"
                                                                              : isVipRow
                                                                                ? "border border-[#2a3c25] bg-[#17261a] text-[#caef6b] hover:border-[#caef6b] cursor-pointer"
                                                                                : "border border-[#243041] bg-[#1a2431] text-[#9ba9ba] hover:border-white hover:text-white cursor-pointer"
                                                                }`}
                                                            >
                                                                {isLocking && isSelected ? (
                                                                    <Loader2 className="size-3 animate-spin" />
                                                                ) : (
                                                                    col
                                                                )}
                                                            </button>
                                                        )
                                                    }
                                                )}
                                            </div>

                                            <span className="w-5 text-center text-xs font-bold text-[#9ba9ba]">
                                                {row}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Seat Legend */}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-[#1f2c3d] pt-6 text-xs text-[#9ba9ba]">
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md border border-[#243041] bg-[#1a2431]" />
                            <span>Ghế thường ({formatVND(priceRegular)})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md border border-[#2a3c25] bg-[#17261a]" />
                            <span>Ghế VIP ({formatVND(priceVip)})</span>
                        </div>
                        {sweetboxRowChar && (
                            <div className="flex items-center gap-2">
                                <div className="size-4 rounded-md border border-[#7c3aed] bg-[#2e1065]" />
                                <span>Ghế Sweetbox ({formatVND(priceSweetbox)})</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md bg-[#caef6b]" />
                            <span className="font-semibold text-white">Đang chọn</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-4 rounded-md bg-[#18202b] border border-[#243041]/40" />
                            <span>Đã bán / Đang giữ</span>
                        </div>
                    </div>

                    {/* Conflict Alert */}
                    {conflictSeats.length > 0 && (
                        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-900/20 p-4 text-xs text-red-400">
                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            <span>
                                Ghế <strong className="text-red-300">{conflictSeats.join(", ")}</strong>{" "}
                                của suất {activeTime} vừa được đặt hoặc giữ chỗ bởi khách khác. Vui lòng chọn ghế khác!
                            </span>
                        </div>
                    )}

                    {/* 5-minute Hold Timer Notice */}
                    {selectedSeatIds.length > 0 && countdown > 0 && (
                        <div
                            className={`mt-5 flex items-center gap-2.5 rounded-2xl border p-4 text-xs transition-colors ${
                                countdown <= 60
                                    ? "border-red-500/40 bg-red-900/20 text-red-400"
                                    : "border-[#2a3c25] bg-[#121f15] text-[#caef6b]"
                            }`}
                        >
                            <Clock className="size-4 shrink-0" />
                            <span>
                                Ghế <strong>{selectedSeatIds.join(", ")}</strong> (suất{" "}
                                <strong>{activeTime}</strong>) được tạm giữ trong{" "}
                                <strong className={countdown <= 60 ? "text-red-300" : ""}>
                                    {formatCountdown(countdown)}
                                </strong>{" "}
                                phút để hoàn tất thanh toán.
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
                                <h3 className="text-sm font-bold text-white line-clamp-2">
                                    {movie.title}
                                </h3>
                                <p className="text-[11px] text-[#9ba9ba]">{movie.genre}</p>
                                <p className="text-[11px] text-[#caef6b] font-medium">
                                    {activeFormat}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-3 divide-y divide-[#1f2c3d]/60 text-xs">
                            <div className="flex justify-between gap-3 pt-2">
                                <span className="text-[#9ba9ba] shrink-0">Rạp chiếu</span>
                                <span className="font-semibold text-white text-right">
                                    {cinemaName}
                                </span>
                            </div>
                            <div className="flex justify-between gap-3 pt-3">
                                <span className="text-[#9ba9ba] shrink-0">Địa chỉ</span>
                                <span className="text-[11px] text-[#d3dce7] text-right">
                                    {cinemaAddress}
                                </span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Phòng chiếu</span>
                                <span className="font-semibold text-white">{activeRoom}</span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Suất chiếu</span>
                                <span className="font-semibold text-white">
                                    {activeTime} · {showDate}
                                </span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Số ghế trống</span>
                                <span className="font-semibold text-[#caef6b]">
                                    {remainingAvailableSeats}/{totalRoomSeats} ghế
                                </span>
                            </div>
                            <div className="flex justify-between gap-3 pt-3">
                                <span className="text-[#9ba9ba] shrink-0">Ghế đã chọn</span>
                                <span className="font-bold text-[#caef6b] text-right">
                                    {selectedSeatIds.length > 0
                                        ? formattedSelectedSeatsLabel
                                        : "Chưa chọn ghế"}
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
                                    {(priceBreakdown.sweetboxCount || 0) > 0 && (
                                        <div className="flex justify-between">
                                            <span>
                                                Ghế Sweetbox × {priceBreakdown.sweetboxCount}
                                            </span>
                                            <span>
                                                {formatVND(priceBreakdown.sweetboxTotal || 0)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between pt-3">
                                <span className="text-sm font-bold text-white">Tổng thanh toán</span>
                                <span className="text-base font-black text-[#caef6b]">
                                    {formattedPrice}
                                </span>
                            </div>
                        </div>

                        <Button
                            disabled={selectedSeatIds.length === 0 || isLoadingSeats}
                            onClick={handleContinue}
                            className="mt-6 w-full rounded-xl bg-[#caef6b] py-2.5 font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-lg shadow-[#caef6b]/10 disabled:opacity-40 cursor-pointer"
                        >
                            Tiếp tục thanh toán
                        </Button>

                        <p className="mt-3 text-center text-[10px] text-[#9ba9ba] leading-tight">
                            Bằng việc chọn ghế, bạn đồng ý với chính sách giữ chỗ 5 phút và hủy vé của rạp.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface LockSeatsResponseCompat {
    totalPrice?: number
    breakdown?: PriceBreakdown
    expiresInSeconds?: number
    conflictingSeats?: string[]
}

function sessionParamsOrCreate(existingParam: string | null): string {
    if (existingParam && existingParam.trim().length > 4) {
        return existingParam.trim()
    }
    return `seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
