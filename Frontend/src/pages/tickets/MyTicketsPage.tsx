import { useState, useEffect, useCallback } from "react"
import { useOutletContext } from "react-router-dom"
import {
    Ticket,
    Clock,
    MapPin,
    PhoneCall,
    CheckCircle2,
    ChevronRight,
    Download,
    Loader2,
    XCircle,
    AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { NOW_SHOWING_MOVIES, COMING_SOON_MOVIES } from "@/constants"
import { paymentService, type TicketDetail } from "@/services/payment.service"
import type { MainLayoutContextType } from "@/layouts/MainLayout"

interface DisplayTicket {
    id: string | number
    code: string
    movieTitle: string
    poster: string
    cinema: string
    room: string
    showtime: string
    date: string
    seats: string
    totalPrice: string
    status: "upcoming" | "completed" | "cancelled"
    format: string
    qrCode?: string | null
}

const DEFAULT_POSTER = NOW_SHOWING_MOVIES[0].poster

function findPoster(title: string): string {
    const all = [...NOW_SHOWING_MOVIES, ...COMING_SOON_MOVIES]
    const found = all.find(
        (m) => m.title.toLowerCase().trim() === title.toLowerCase().trim()
    )
    return found?.poster || DEFAULT_POSTER
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)
}

export const MyTicketsPage = () => {
    const { showToast } = useOutletContext<MainLayoutContextType>()

    // Current user from localStorage
    const storedUser = localStorage.getItem("user")
    const user = storedUser ? JSON.parse(storedUser) : null
    const userId = user?.id || 1

    // States
    const [tickets, setTickets] = useState<DisplayTicket[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [selectedTicketId, setSelectedTicketId] = useState<string | number>("")
    const [filterTab, setFilterTab] = useState<"all" | "upcoming" | "completed" | "cancelled">("all")
    const [memberPoints, setMemberPoints] = useState<number>(user?.points || 120)

    // Cancel modal state
    const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false)
    const [isCancelling, setIsCancelling] = useState<boolean>(false)

    // Load tickets from MySQL Database
    const loadTickets = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await paymentService.getMyTickets(userId)
            if (res.success && res.data) {
                const fetchedTickets = res.data.tickets || []
                const mapped: DisplayTicket[] = fetchedTickets.map((t: TicketDetail) => ({
                    id: t.id,
                    code: t.bookingCode,
                    movieTitle: t.movieTitle || "Tín hiệu từ ngày mai",
                    poster: findPoster(t.movieTitle || ""),
                    cinema: t.cinemaName || "Cinema Nguyễn Du",
                    room: t.roomName || "Phòng 01",
                    showtime: t.showtime ? `${t.showtime} - ${t.endTime || "21:30"}` : "19:30 - 21:28",
                    date: t.showDate || "24/10/2026",
                    seats: t.seats || "F7, F8 (VIP)",
                    totalPrice: formatVND(t.totalPrice || t.finalPrice || 240000),
                    status: (t.status as "upcoming" | "completed" | "cancelled") || "upcoming",
                    format: t.format || "2D Dolby Atmos",
                    qrCode: t.qrCode,
                }))

                setTickets(mapped)
                if (mapped.length > 0) {
                    setSelectedTicketId((prev) => prev || mapped[0].id)
                }
                if (res.data.stats?.memberPoints !== undefined) {
                    setMemberPoints(res.data.stats.memberPoints)
                }
            }
        } catch (error) {
            console.error("Lỗi tải vé từ backend:", error)
        } finally {
            setIsLoading(false)
        }
    }, [userId])

    useEffect(() => {
        loadTickets()
    }, [loadTickets])

    // Filter tickets
    const filteredTickets = tickets.filter((ticket) => {
        if (filterTab === "all") return true
        return ticket.status === filterTab
    })

    const selectedTicket =
        tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null

    // Handle cancel ticket
    const handleConfirmCancel = async () => {
        if (!selectedTicket) return
        setIsCancelling(true)

        try {
            const res = await paymentService.cancelTicket(selectedTicket.code, userId)
            if (res.success) {
                showToast(`Đã hủy vé ${selectedTicket.code} thành công!`)
                // Cập nhật trạng thái vé trực tiếp
                setTickets((prev) =>
                    prev.map((t) =>
                        t.id === selectedTicket.id ? { ...t, status: "cancelled" } : t
                    )
                )
                setShowCancelDialog(false)
            } else {
                showToast(res.message || "Hủy vé thất bại. Vui lòng thử lại!")
            }
        } catch {
            showToast("Lỗi kết nối khi hủy vé. Vui lòng thử lại sau!")
        } finally {
            setIsCancelling(false)
        }
    }

    // Download ticket text
    const handleDownloadTicket = (ticket: DisplayTicket) => {
        const text = `
═══════════════════════════════════════
       CINEMA MANAGEMENT — VÉ ĐIỆN TỬ
═══════════════════════════════════════
Mã đặt vé: ${ticket.code}
Phim: ${ticket.movieTitle}
Rạp: ${ticket.cinema} (${ticket.room})
Suất: ${ticket.showtime} · ${ticket.date}
Ghế: ${ticket.seats}
Định dạng: ${ticket.format}
Tổng tiền: ${ticket.totalPrice}
Trạng thái: ${ticket.status === "upcoming" ? "Sắp chiếu (Đã thanh toán)" : ticket.status === "completed" ? "Đã xem" : "Đã hủy"}
═══════════════════════════════════════
Quét mã QR tại máy soát vé trước giờ chiếu 15 phút.
Hotline hỗ trợ: 0123 456 789
`.trim()
        const blob = new Blob([text], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `ve-${ticket.code}.txt`
        a.click()
        URL.revokeObjectURL(url)
        showToast(`Đã lưu vé ${ticket.code} vào thiết bị!`)
    }

    // Stats count
    const upcomingCount = tickets.filter((t) => t.status === "upcoming").length
    const completedCount = tickets.filter((t) => t.status === "completed").length
    const cancelledCount = tickets.filter((t) => t.status === "cancelled").length

    return (
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
            {/* 1. Header & Title */}
            <div className="mb-8">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                    Những buổi hẹn của bạn
                </span>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Vé của tôi & Lịch sử đặt vé
                </h1>
                <p className="mt-2 text-sm text-[#9ba9ba]">
                    Quản lý các vé đã thanh toán, xuất mã QR Check-in và theo dõi điểm tích lũy thành viên.
                </p>
            </div>

            {/* 2. Top Stats Overview */}
            <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-2xl border border-[#2a3c25] bg-[#121f15] p-5 shadow-lg">
                    <div>
                        <div className="text-3xl font-extrabold text-[#caef6b]">
                            {String(upcomingCount).padStart(2, "0")}
                        </div>
                        <div className="mt-1 text-xs font-medium text-[#9ba9ba]">Vé sắp xem</div>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[#caef6b]/10 text-[#caef6b]">
                        <Ticket className="size-5" />
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div>
                        <div className="text-3xl font-extrabold text-white">
                            {String(completedCount).padStart(2, "0")}
                        </div>
                        <div className="mt-1 text-xs font-medium text-[#9ba9ba]">Đã xem xong</div>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[#1a2431] text-[#9ba9ba]">
                        <Clock className="size-5" />
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div>
                        <div className="text-3xl font-extrabold text-[#caef6b]">
                            {memberPoints}
                        </div>
                        <div className="mt-1 text-xs font-medium text-[#9ba9ba]">Điểm VIP tích lũy</div>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[#1a2431] text-[#caef6b]">
                        <CheckCircle2 className="size-5" />
                    </div>
                </div>
            </div>

            {/* 3. Filter Tabs */}
            <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#1f2c3d] pb-4">
                <button
                    onClick={() => setFilterTab("all")}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${filterTab === "all"
                        ? "bg-[#caef6b] text-[#090d14]"
                        : "bg-[#121923] text-[#9ba9ba] hover:text-white"
                        }`}
                >
                    Tất cả · {tickets.length}
                </button>
                <button
                    onClick={() => setFilterTab("upcoming")}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${filterTab === "upcoming"
                        ? "bg-[#caef6b] text-[#090d14]"
                        : "bg-[#121923] text-[#9ba9ba] hover:text-white"
                        }`}
                >
                    Sắp xem · {upcomingCount}
                </button>
                <button
                    onClick={() => setFilterTab("completed")}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${filterTab === "completed"
                        ? "bg-[#caef6b] text-[#090d14]"
                        : "bg-[#121923] text-[#9ba9ba] hover:text-white"
                        }`}
                >
                    Đã xem · {completedCount}
                </button>
                <button
                    onClick={() => setFilterTab("cancelled")}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${filterTab === "cancelled"
                        ? "bg-[#caef6b] text-[#090d14]"
                        : "bg-[#121923] text-[#9ba9ba] hover:text-white"
                        }`}
                >
                    Đã hủy · {cancelledCount}
                </button>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                    <Loader2 className="size-8 text-[#caef6b] animate-spin mb-3" />
                    <p className="text-sm text-[#9ba9ba]">Đang tải danh sách vé từ cơ sở dữ liệu...</p>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredTickets.length === 0 && (
                <div className="py-16 rounded-3xl border border-[#1f2c3d] bg-[#121923] text-center p-8">
                    <Ticket className="mx-auto size-12 text-[#9ba9ba]/40 mb-3" />
                    <h3 className="text-lg font-bold text-white">Chưa có vé nào</h3>
                    <p className="text-xs text-[#9ba9ba] mt-1 max-w-sm mx-auto">
                        Bạn chưa có buổi hẹn nào trong danh mục này. Hãy chọn một bộ phim yêu thích và đặt vé ngay!
                    </p>
                </div>
            )}

            {/* 4. Two-Column Layout */}
            {!isLoading && filteredTickets.length > 0 && selectedTicket && (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    {/* Left Column: Tickets List */}
                    <div className="space-y-4 lg:col-span-7">
                        {filteredTickets.map((ticket) => {
                            const isSelected = ticket.id === selectedTicket.id
                            return (
                                <div
                                    key={ticket.id}
                                    onClick={() => setSelectedTicketId(ticket.id)}
                                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${isSelected
                                        ? "border-[#caef6b] bg-[#121923] shadow-[0_0_25px_rgba(202,239,107,0.1)]"
                                        : "border-[#1f2c3d] bg-[#0e141d] hover:border-[#2f4057]"
                                        }`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                        {/* Poster */}
                                        <img
                                            src={ticket.poster}
                                            alt={ticket.movieTitle}
                                            className="h-28 w-20 shrink-0 rounded-xl object-cover shadow-md"
                                        />

                                        {/* Info */}
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                {ticket.status === "upcoming" ? (
                                                    <span className="rounded border border-[#2a3c25] bg-[#162518] px-2 py-0.5 text-[10px] font-bold text-[#caef6b]">
                                                        Sắp xem
                                                    </span>
                                                ) : ticket.status === "completed" ? (
                                                    <span className="rounded border border-[#243041] bg-[#16202c] px-2 py-0.5 text-[10px] font-semibold text-[#9ba9ba]">
                                                        Đã xem
                                                    </span>
                                                ) : (
                                                    <span className="rounded border border-red-900/40 bg-red-950/40 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                                                        Đã hủy
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-mono text-[#9ba9ba]">
                                                    {ticket.code}
                                                </span>
                                            </div>

                                            <h3 className="text-base font-bold text-white group-hover:text-[#caef6b] transition-colors">
                                                {ticket.movieTitle}
                                            </h3>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9ba9ba]">
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="size-3 text-[#caef6b]" />
                                                    {ticket.cinema} ({ticket.room})
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="size-3 text-[#caef6b]" />
                                                    {ticket.showtime} · {ticket.date}
                                                </span>
                                            </div>

                                            <div className="text-xs text-[#9ba9ba]">
                                                Ghế: <span className="font-semibold text-white">{ticket.seats}</span> ·{" "}
                                                {ticket.format}
                                            </div>

                                            <div className="pt-2 flex items-center justify-between">
                                                <div className="text-sm font-black text-[#caef6b]">
                                                    {ticket.totalPrice}
                                                </div>

                                                {ticket.status === "upcoming" ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="rounded-xl border border-[#2a3c25] bg-[#1a2c1d] px-3 py-1 text-xs font-semibold text-[#caef6b]">
                                                            Xem QR Code
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-xs text-[#9ba9ba] group-hover:text-white">
                                                        Chi tiết vé <ChevronRight className="size-3" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Right Column: Selected Ticket Details Card */}
                    <div className="lg:col-span-5">
                        <div className="sticky top-28 rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                            <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                                <div className="flex items-center gap-2">
                                    <Ticket className="size-5 text-[#caef6b]" />
                                    <h2 className="text-base font-bold text-white">Chi tiết vé điện tử</h2>
                                </div>
                                {selectedTicket.status === "upcoming" && (
                                    <span className="rounded-full border border-[#2a3c25] bg-[#162518] px-2.5 py-0.5 text-[10px] font-bold text-[#caef6b]">
                                        Hợp lệ Check-in
                                    </span>
                                )}
                                {selectedTicket.status === "cancelled" && (
                                    <span className="rounded-full border border-red-900/40 bg-red-950/40 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                                        Đã hủy
                                    </span>
                                )}
                            </div>

                            {/* QR Code Box */}
                            <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-[#243041] bg-[#090d14] p-6 text-center">
                                <div className={`relative flex size-40 items-center justify-center rounded-2xl bg-white p-3 shadow-inner ${selectedTicket.status === "cancelled" ? "opacity-30 grayscale" : ""}`}>
                                    {/* SVG QR Code Simulation */}
                                    <svg viewBox="0 0 100 100" className="size-full text-[#090d14]" fill="currentColor">
                                        <rect x="5" y="5" width="26" height="26" rx="4" />
                                        <rect x="9" y="9" width="18" height="18" fill="white" />
                                        <rect x="13" y="13" width="10" height="10" />

                                        <rect x="69" y="5" width="26" height="26" rx="4" />
                                        <rect x="73" y="9" width="18" height="18" fill="white" />
                                        <rect x="77" y="13" width="10" height="10" />

                                        <rect x="5" y="69" width="26" height="26" rx="4" />
                                        <rect x="9" y="73" width="18" height="18" fill="white" />
                                        <rect x="13" y="77" width="10" height="10" />

                                        <rect x="36" y="10" width="8" height="8" />
                                        <rect x="48" y="10" width="14" height="8" />
                                        <rect x="36" y="24" width="20" height="8" />
                                        <rect x="10" y="36" width="8" height="16" />
                                        <rect x="22" y="38" width="14" height="14" />
                                        <rect x="42" y="38" width="16" height="16" rx="2" fill="#caef6b" />
                                        <rect x="64" y="36" width="26" height="8" />
                                        <rect x="64" y="48" width="12" height="12" />
                                        <rect x="80" y="48" width="10" height="24" />
                                        <rect x="36" y="60" width="22" height="12" />
                                        <rect x="36" y="78" width="12" height="14" />
                                        <rect x="52" y="78" width="24" height="14" />
                                    </svg>
                                </div>
                                <div className="mt-3 text-xs font-mono font-bold tracking-wider text-[#caef6b]">
                                    {selectedTicket.code}
                                </div>
                                <p className="mt-1 text-[11px] text-[#9ba9ba]">
                                    {selectedTicket.status === "cancelled"
                                        ? "Vé này đã bị hủy, mã QR không còn giá trị check-in."
                                        : "Quét mã QR tại quầy hoặc cửa soát vé trước giờ chiếu 15 phút."}
                                </p>
                            </div>

                            {/* Ticket Metadata Breakdown */}
                            <div className="space-y-3 divide-y divide-[#1f2c3d]/60 text-xs">
                                <div className="flex justify-between pt-2">
                                    <span className="text-[#9ba9ba]">Phim</span>
                                    <span className="font-semibold text-white">{selectedTicket.movieTitle}</span>
                                </div>
                                <div className="flex justify-between pt-3">
                                    <span className="text-[#9ba9ba]">Suất chiếu</span>
                                    <span className="font-semibold text-white">
                                        {selectedTicket.showtime} · {selectedTicket.date}
                                    </span>
                                </div>
                                <div className="flex justify-between pt-3">
                                    <span className="text-[#9ba9ba]">Rạp chiếu</span>
                                    <span className="font-semibold text-white">
                                        {selectedTicket.cinema} ({selectedTicket.room})
                                    </span>
                                </div>
                                <div className="flex justify-between pt-3">
                                    <span className="text-[#9ba9ba]">Ghế ngồi</span>
                                    <span className="font-semibold text-[#caef6b]">{selectedTicket.seats}</span>
                                </div>
                                <div className="flex justify-between pt-3">
                                    <span className="text-[#9ba9ba]">Định dạng</span>
                                    <span className="font-semibold text-white">{selectedTicket.format}</span>
                                </div>
                                <div className="flex justify-between pt-3">
                                    <span className="text-[#9ba9ba]">Tổng tiền đã thanh toán</span>
                                    <span className="text-sm font-black text-[#caef6b]">
                                        {selectedTicket.totalPrice}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            {selectedTicket.status === "upcoming" && (
                                <div className="mt-6 flex flex-col gap-2.5">
                                    <Button
                                        onClick={() => handleDownloadTicket(selectedTicket)}
                                        className="w-full rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] cursor-pointer"
                                    >
                                        <Download className="mr-1.5 size-4" />
                                        Tải vé điện tử
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCancelDialog(true)}
                                        className="w-full rounded-xl border-red-900/40 bg-red-950/20 text-xs font-semibold text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors cursor-pointer"
                                    >
                                        <XCircle className="mr-1.5 size-4" />
                                        Hủy vé
                                    </Button>
                                </div>
                            )}

                            {/* Support Box */}
                            <div className="mt-6 rounded-xl border border-[#1f2c3d] bg-[#0e141d] p-4 text-xs">
                                <div className="flex items-center gap-2 font-semibold text-white">
                                    <PhoneCall className="size-3.5 text-[#caef6b]" />
                                    <span>Cần trợ giúp vé? Hotline 0123 456 789</span>
                                </div>
                                <p className="mt-1 text-[11px] text-[#9ba9ba]">
                                    Hỗ trợ xử lý hoàn hủy hoặc đổi vé theo chính sách rạp trước giờ chiếu 60 phút.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Dialog */}
            {showCancelDialog && selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl border border-[#243041] bg-[#121923] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                                <AlertTriangle className="size-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Xác nhận hủy vé</h3>
                                <p className="text-xs text-[#9ba9ba]">Mã đặt vé: {selectedTicket.code}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[#1f2c3d] bg-[#090d14] p-4 text-xs space-y-2">
                            <p className="text-white">
                                Bạn có chắc chắn muốn hủy vé cho phim{" "}
                                <strong className="text-[#caef6b]">{selectedTicket.movieTitle}</strong> không?
                            </p>
                            <p className="text-[#9ba9ba] text-[11px]">
                                • Suất chiếu: {selectedTicket.showtime} · {selectedTicket.date}
                                <br />
                                • Ghế: {selectedTicket.seats}
                                <br />
                                • Số tiền hoàn lại: {selectedTicket.totalPrice}
                            </p>
                            <p className="text-[11px] text-amber-400">
                                * Tiền sẽ được hoàn về phương thức thanh toán ban đầu trong vòng 24h.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                disabled={isCancelling}
                                onClick={() => setShowCancelDialog(false)}
                                className="rounded-xl border-[#243041] bg-[#1a2431] text-xs font-semibold text-white hover:bg-[#243041]"
                            >
                                Giữ vé
                            </Button>
                            <Button
                                disabled={isCancelling}
                                onClick={handleConfirmCancel}
                                className="rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {isCancelling ? (
                                    <span className="flex items-center gap-1.5">
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Đang hủy vé...
                                    </span>
                                ) : (
                                    "Xác nhận hủy vé"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
