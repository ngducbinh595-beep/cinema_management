import { useState, useEffect, useCallback } from "react"
import { useOutletContext } from "react-router-dom"
import {
    Ticket,
    Clock,
    MapPin,
    PhoneCall,
    CheckCircle2,
    ChevronRight,
    FileDown,
    Loader2,
    XCircle,
    AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TicketQRCode } from "@/components/common/TicketQRCode"
import { NOW_SHOWING_MOVIES, COMING_SOON_MOVIES } from "@/constants"
import { paymentService, type TicketDetail } from "@/services/payment.service"
import { buildTicketQRPayload } from "@/lib/qrcode"
import { exportTicketToPdf, resolveCinemaLocation } from "@/lib/ticketPdf"
import type { MainLayoutContextType } from "@/layouts/MainLayout"

interface DisplayTicket {
    id: string | number
    code: string
    movieTitle: string
    movieRating: string
    movieGenre: string
    movieDuration: string
    poster: string
    cinema: string
    cinemaAddress: string
    cinemaPhone: string
    room: string
    showtime: string
    date: string
    seats: string
    totalPrice: string
    discountAmount: number
    paymentMethod: string
    customerName: string
    customerEmail: string
    customerPhone: string
    status: "upcoming" | "completed" | "cancelled"
    format: string
    qrCode?: string | null
    createdAt: string
}

const DEFAULT_POSTER = NOW_SHOWING_MOVIES[0].poster

function findMovieMeta(title: string) {
    const all = [...NOW_SHOWING_MOVIES, ...COMING_SOON_MOVIES]
    return all.find(
        (m) => m.title.toLowerCase().trim() === title.toLowerCase().trim()
    )
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)
}

export const MyTicketsPage = () => {
    const { showToast } = useOutletContext<MainLayoutContextType>()

    const storedUser = localStorage.getItem("user")
    const user = storedUser ? JSON.parse(storedUser) : null
    const userId = user?.id || 1

    const [tickets, setTickets] = useState<DisplayTicket[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [selectedTicketId, setSelectedTicketId] = useState<string | number>("")
    const [filterTab, setFilterTab] = useState<"all" | "upcoming" | "completed" | "cancelled">("all")
    const [memberPoints, setMemberPoints] = useState<number>(user?.points || 120)
    const [exportingCode, setExportingCode] = useState<string | null>(null)

    const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false)
    const [isCancelling, setIsCancelling] = useState<boolean>(false)

    // Load tickets from MySQL Database
    const loadTickets = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await paymentService.getMyTickets(userId)
            if (res.success && res.data) {
                const fetchedTickets = res.data.tickets || []
                const mapped: DisplayTicket[] = fetchedTickets.map((t: TicketDetail) => {
                    const mTitle = t.movieTitle || "Tín hiệu từ ngày mai"
                    const localMovie = findMovieMeta(mTitle)
                    const cName = t.cinemaName || "Cinema Nguyễn Du"
                    const loc = resolveCinemaLocation(cName, t.cinemaAddress, t.cinemaPhone)

                    return {
                        id: t.id,
                        code: t.bookingCode,
                        movieTitle: mTitle,
                        movieRating: t.movieRating || localMovie?.rating || "T13",
                        movieGenre: t.movieGenre || localMovie?.genre || "Điện ảnh",
                        movieDuration: t.movieDuration
                            ? `${t.movieDuration} phút`
                            : localMovie?.duration || "118 phút",
                        poster: localMovie?.poster || DEFAULT_POSTER,
                        cinema: cName,
                        cinemaAddress: loc.address,
                        cinemaPhone: loc.phone,
                        room: t.roomName || "Phòng 01",
                        showtime: t.showtime
                            ? `${t.showtime} - ${t.endTime || "21:30"}`
                            : "19:30 - 21:28",
                        date: t.showDate || "24/10/2026",
                        seats: t.seats || "F7, F8 (VIP)",
                        totalPrice: formatVND(t.totalPrice || t.finalPrice || 240000),
                        discountAmount: Number(t.discountAmount || 0),
                        paymentMethod: t.paymentMethod || "momo",
                        customerName: t.customerName || user?.name || "Khách hàng thành viên",
                        customerEmail: t.customerEmail || user?.email || "",
                        customerPhone: t.customerPhone || user?.phone || "",
                        status: (t.status as "upcoming" | "completed" | "cancelled") || "upcoming",
                        format: t.format || "2D Dolby Atmos",
                        qrCode: t.qrCode,
                        createdAt: t.createdAt || "",
                    }
                })

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
    }, [userId, user?.name, user?.email, user?.phone])

    useEffect(() => {
        void loadTickets()
    }, [loadTickets])

    const filteredTickets = tickets.filter((ticket) => {
        if (filterTab === "all") return true
        return ticket.status === filterTab
    })

    const selectedTicket =
        filteredTickets.find((t) => t.id === selectedTicketId) ||
        filteredTickets[0] ||
        tickets.find((t) => t.id === selectedTicketId) ||
        tickets[0] ||
        null

    const handleConfirmCancel = async () => {
        if (!selectedTicket) return
        setIsCancelling(true)

        try {
            const res = await paymentService.cancelTicket(selectedTicket.code, userId)
            if (res.success) {
                showToast(`Đã hủy vé ${selectedTicket.code} thành công!`)
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

    // Xuất vé điện tử ra file PDF bố cục chuẩn kèm mã QR quét thật và địa chỉ rạp
    const handleDownloadTicketPdf = async (ticket: DisplayTicket) => {
        if (exportingCode) return
        setExportingCode(ticket.code)
        try {
            await exportTicketToPdf({
                bookingCode: ticket.code,
                movieTitle: ticket.movieTitle,
                movieRating: ticket.movieRating,
                movieGenre: ticket.movieGenre,
                movieDuration: ticket.movieDuration,
                posterUrl: ticket.poster,
                cinemaName: ticket.cinema,
                cinemaAddress: ticket.cinemaAddress,
                cinemaPhone: ticket.cinemaPhone,
                roomName: ticket.room,
                showtime: ticket.showtime,
                showDate: ticket.date,
                seats: ticket.seats,
                format: ticket.format,
                totalPriceText: ticket.totalPrice,
                discountAmount: ticket.discountAmount,
                paymentMethod: ticket.paymentMethod,
                customerName: ticket.customerName,
                customerPhone: ticket.customerPhone,
                customerEmail: ticket.customerEmail,
                status: ticket.status,
                qrCode: ticket.qrCode,
                createdAt: ticket.createdAt,
            })
            showToast(`Đã xuất file vé PDF ve-${ticket.code}.pdf thành công!`)
        } catch (err) {
            console.error("Lỗi xuất PDF:", err)
            showToast("Không thể xuất file PDF. Vui lòng thử lại!")
        } finally {
            setExportingCode(null)
        }
    }

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
                    Quản lý các vé đã thanh toán, xuất file vé PDF kèm mã QR Check-in và địa chỉ rạp chi tiết.
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
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        filterTab === "all"
                            ? "bg-[#caef6b] text-[#090d14]"
                            : "bg-[#121923] text-[#9ba9ba] hover:text-white"
                    }`}
                >
                    Tất cả · {tickets.length}
                </button>
                <button
                    onClick={() => setFilterTab("upcoming")}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        filterTab === "upcoming"
                            ? "bg-[#caef6b] text-[#090d14]"
                            : "bg-[#121923] text-[#9ba9ba] hover:text-white"
                    }`}
                >
                    Sắp xem · {upcomingCount}
                </button>
                <button
                    onClick={() => setFilterTab("completed")}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        filterTab === "completed"
                            ? "bg-[#caef6b] text-[#090d14]"
                            : "bg-[#121923] text-[#9ba9ba] hover:text-white"
                    }`}
                >
                    Đã xem · {completedCount}
                </button>
                <button
                    onClick={() => setFilterTab("cancelled")}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        filterTab === "cancelled"
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
                    <p className="text-sm text-[#9ba9ba]">
                        Đang tải danh sách vé từ cơ sở dữ liệu...
                    </p>
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
                                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
                                        isSelected
                                            ? "border-[#caef6b] bg-[#121923] shadow-[0_0_25px_rgba(202,239,107,0.1)]"
                                            : "border-[#1f2c3d] bg-[#0e141d] hover:border-[#2f4057]"
                                    }`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                        <img
                                            src={ticket.poster}
                                            alt={ticket.movieTitle}
                                            className="h-32 w-22 shrink-0 rounded-xl object-cover shadow-md"
                                        />

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
                                                <span className="flex items-center gap-1 text-white font-medium">
                                                    <MapPin className="size-3 text-[#caef6b]" />
                                                    {ticket.cinema} ({ticket.room})
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="size-3 text-[#caef6b]" />
                                                    {ticket.showtime} · {ticket.date}
                                                </span>
                                            </div>

                                            <p className="text-[11px] text-[#9ba9ba] line-clamp-1">
                                                Địa chỉ: {ticket.cinemaAddress}
                                            </p>

                                            <div className="text-xs text-[#9ba9ba]">
                                                Ghế:{" "}
                                                <span className="font-semibold text-white">
                                                    {ticket.seats}
                                                </span>{" "}
                                                · {ticket.format}
                                            </div>

                                            <div className="pt-2 flex items-center justify-between">
                                                <div className="text-sm font-black text-[#caef6b]">
                                                    {ticket.totalPrice}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {ticket.status !== "cancelled" && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                void handleDownloadTicketPdf(ticket)
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-xl border border-[#2a3c25] bg-[#1a2c1d] px-3 py-1 text-xs font-semibold text-[#caef6b] hover:bg-[#223925] transition-colors cursor-pointer"
                                                        >
                                                            <FileDown className="size-3.5" />
                                                            <span>Xuất PDF</span>
                                                        </button>
                                                    )}
                                                    <span className="flex items-center gap-1 text-xs text-[#9ba9ba] group-hover:text-white">
                                                        Chi tiết <ChevronRight className="size-3" />
                                                    </span>
                                                </div>
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
                                    <h2 className="text-base font-bold text-white">
                                        Chi tiết vé điện tử
                                    </h2>
                                </div>
                                {selectedTicket.status === "upcoming" && (
                                    <span className="rounded-full border border-[#2a3c25] bg-[#162518] px-2.5 py-0.5 text-[10px] font-bold text-[#caef6b]">
                                        Hợp lệ Check-in
                                    </span>
                                )}
                                {selectedTicket.status === "completed" && (
                                    <span className="rounded-full border border-[#243041] bg-[#16202c] px-2.5 py-0.5 text-[10px] font-bold text-[#d3dce7]">
                                        Đã xem
                                    </span>
                                )}
                                {selectedTicket.status === "cancelled" && (
                                    <span className="rounded-full border border-red-900/40 bg-red-950/40 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                                        Đã hủy
                                    </span>
                                )}
                            </div>

                            {/* Real Scannable QR Code Box */}
                            <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-[#243041] bg-[#090d14] p-6 text-center">
                                <div
                                    className={`relative flex items-center justify-center rounded-2xl bg-white p-3 shadow-inner ${
                                        selectedTicket.status === "cancelled"
                                            ? "opacity-35 grayscale"
                                            : ""
                                    }`}
                                >
                                    <TicketQRCode
                                        value={buildTicketQRPayload({
                                            bookingCode: selectedTicket.code,
                                            movieTitle: selectedTicket.movieTitle,
                                            cinemaName: selectedTicket.cinema,
                                            roomName: selectedTicket.room,
                                            showDate: selectedTicket.date,
                                            showtime: selectedTicket.showtime,
                                            seats: selectedTicket.seats,
                                            qrUrl: selectedTicket.qrCode,
                                        })}
                                        size={156}
                                    />
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

                            {/* Ticket Metadata Breakdown (bao gồm Địa chỉ rạp) */}
                            <div className="space-y-3 divide-y divide-[#1f2c3d]/60 text-xs">
                                <div className="flex justify-between gap-3 pt-2">
                                    <span className="text-[#9ba9ba] shrink-0">Phim</span>
                                    <span className="font-semibold text-white text-right">
                                        {selectedTicket.movieTitle}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-3 pt-3">
                                    <span className="text-[#9ba9ba] shrink-0">Suất chiếu</span>
                                    <span className="font-semibold text-white text-right">
                                        {selectedTicket.showtime} · {selectedTicket.date}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-3 pt-3">
                                    <span className="text-[#9ba9ba] shrink-0">Rạp & Phòng</span>
                                    <span className="font-semibold text-white text-right">
                                        {selectedTicket.cinema} ({selectedTicket.room})
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4 pt-3">
                                    <span className="text-[#9ba9ba] shrink-0">Địa chỉ rạp</span>
                                    <span className="font-medium text-[#d3dce7] text-right">
                                        {selectedTicket.cinemaAddress}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-3 pt-3">
                                    <span className="text-[#9ba9ba] shrink-0">Ghế ngồi</span>
                                    <span className="font-semibold text-[#caef6b] text-right">
                                        {selectedTicket.seats}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-3 pt-3">
                                    <span className="text-[#9ba9ba] shrink-0">Định dạng</span>
                                    <span className="font-semibold text-white text-right">
                                        {selectedTicket.format}
                                    </span>
                                </div>
                                <div className="flex justify-between pt-3">
                                    <span className="text-[#9ba9ba]">Tổng tiền đã thanh toán</span>
                                    <span className="text-sm font-black text-[#caef6b]">
                                        {selectedTicket.totalPrice}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-6 flex flex-col gap-2.5">
                                {selectedTicket.status !== "cancelled" && (
                                    <Button
                                        disabled={exportingCode === selectedTicket.code}
                                        onClick={() => void handleDownloadTicketPdf(selectedTicket)}
                                        className="w-full rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] cursor-pointer"
                                    >
                                        {exportingCode === selectedTicket.code ? (
                                            <Loader2 className="mr-1.5 size-4 animate-spin" />
                                        ) : (
                                            <FileDown className="mr-1.5 size-4" />
                                        )}
                                        Tải vé điện tử (PDF)
                                    </Button>
                                )}

                                {selectedTicket.status === "upcoming" && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCancelDialog(true)}
                                        className="w-full rounded-xl border-red-900/40 bg-red-950/20 text-xs font-semibold text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors cursor-pointer"
                                    >
                                        <XCircle className="mr-1.5 size-4" />
                                        Hủy vé
                                    </Button>
                                )}
                            </div>

                            {/* Support Box */}
                            <div className="mt-6 rounded-xl border border-[#1f2c3d] bg-[#0e141d] p-4 text-xs">
                                <div className="flex items-center gap-2 font-semibold text-white">
                                    <PhoneCall className="size-3.5 text-[#caef6b]" />
                                    <span>
                                        Hotline rạp: {selectedTicket.cinemaPhone} · CSKH: 0123 456 789
                                    </span>
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
                                <p className="text-xs text-[#9ba9ba]">
                                    Mã đặt vé: {selectedTicket.code}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[#1f2c3d] bg-[#090d14] p-4 text-xs space-y-2">
                            <p className="text-white">
                                Bạn có chắc chắn muốn hủy vé cho phim{" "}
                                <strong className="text-[#caef6b]">
                                    {selectedTicket.movieTitle}
                                </strong>{" "}
                                không?
                            </p>
                            <p className="text-[#9ba9ba] text-[11px]">
                                • Rạp: {selectedTicket.cinema} ({selectedTicket.room})
                                <br />
                                • Địa chỉ: {selectedTicket.cinemaAddress}
                                <br />
                                • Suất chiếu: {selectedTicket.showtime} · {selectedTicket.date}
                                <br />
                                • Ghế: {selectedTicket.seats}
                                <br />• Số tiền hoàn lại: {selectedTicket.totalPrice}
                            </p>
                            <p className="text-[11px] text-amber-400">
                                * Ghế sẽ được mở trống lại ngay lập tức và tiền hoàn về phương thức thanh toán ban đầu trong 24h.
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
