import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import {
    TrendingUp,
    Calendar,
    Sparkles,
    Download,
    ArrowRight,
    Building2,
    DoorOpen,
    Film,
    ChevronDown,
    ChevronUp,
    Search,
    RotateCw,
    Ticket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AutoScheduleModal } from "@/components/admin/AutoScheduleModal"
import { AIForecastCard } from "@/components/admin/AIForecastCard"
import { showtimeService } from "@/services/showtime.service"
import {
    roomService,
    type RevenueReportData,
    type RoomRevenueItem,
} from "@/services/room.service"
import { formatISOToVN } from "@/constants/adminSchedule"

interface LastAppliedInfo {
    date: string
    count: number
}

function getTodayStr(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())
}

function getCurrentMonthStr(): string {
    const today = getTodayStr()
    return today.slice(0, 7)
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " đ"
}

export const AdminOverviewPage = () => {
    // Filter states
    const [periodType, setPeriodType] = useState<"day" | "month" | "range">("day")
    const [selectedDate, setSelectedDate] = useState<string>("2026-10-24") // default demo date with showtimes & bookings
    const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr())
    const [selectedCinemaId, setSelectedCinemaId] = useState<string>("all")
    const [searchRoomQuery, setSearchRoomQuery] = useState("")

    // Data & loading states
    const [reportData, setReportData] = useState<RevenueReportData | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedRooms, setExpandedRooms] = useState<Record<number, boolean>>({})

    // AI modal state
    const [isAIModalOpen, setIsAIModalOpen] = useState(false)
    const [lastApplied, setLastApplied] = useState<LastAppliedInfo | null>(null)

    const fetchRevenueReport = useCallback(async () => {
        setLoading(true)
        try {
            const res = await roomService.getRevenueBreakdown({
                periodType,
                date: periodType === "day" ? selectedDate : undefined,
                month: periodType === "month" ? selectedMonth : undefined,
                cinemaId: selectedCinemaId,
            })

            if (res.success && res.data) {
                const report = res.data
                setReportData(report)
                // Mặc định mở rộng phòng đầu tiên có doanh thu hoặc phòng 1
                if (report.roomsBreakdown.length > 0) {
                    const firstRoomId = report.roomsBreakdown[0].roomId
                    setExpandedRooms((prev) => ({
                        ...prev,
                        [firstRoomId]: true,
                    }))
                }
            }
        } catch (err) {
            console.error("Lỗi tải báo cáo doanh thu:", err)
        } finally {
            setLoading(false)
        }
    }, [periodType, selectedDate, selectedMonth, selectedCinemaId])

    useEffect(() => {
        fetchRevenueReport()
    }, [fetchRevenueReport])

    const toggleRoomExpand = (roomId: number) => {
        setExpandedRooms((prev) => ({
            ...prev,
            [roomId]: !prev[roomId],
        }))
    }

    // Xuất báo cáo CSV UTF-8 thật
    const handleExportCSV = () => {
        if (!reportData) return

        let csvContent = "\uFEFF" // UTF-8 BOM để Excel hiển thị đúng tiếng Việt
        csvContent += `BÁO CÁO DOANH THU CHI TIẾT CINEMA MANAGEMENT\n`
        csvContent += `Kỳ thống kê:,${periodType === "day" ? `Ngày ${selectedDate}` : periodType === "month" ? `Tháng ${selectedMonth}` : "Tùy chọn"}\n`
        csvContent += `Cụm rạp:,${selectedCinemaId === "all" ? "Tất cả rạp" : `Rạp ID ${selectedCinemaId}`}\n`
        csvContent += `Tổng doanh thu:,${reportData.summary.totalRevenue} VND\n`
        csvContent += `Tổng vé đã bán:,${reportData.summary.totalTickets}\n`
        csvContent += `Tổng suất chiếu:,${reportData.summary.totalShowtimes}\n`
        csvContent += `Tỷ lệ lấp đầy TB:,${reportData.summary.avgOccupancyRate}%\n\n`

        csvContent += `CHI TIẾT THEO PHÒNG CHIẾU VÀ TỪNG PHIM\n`
        csvContent += `Cụm rạp,Tên phòng,Định dạng,Tổng ghế,Tên phim,Thể loại,Số suất chiếu,Vé đã bán,Doanh thu (VND),Tỷ lệ lấp đầy (%)\n`

        for (const room of reportData.roomsBreakdown) {
            if (room.movies.length === 0) {
                csvContent += `"${room.cinemaName}","${room.roomName}","${room.format}",${room.totalSeats},"(Không có suất chiếu)","-",0,0,0,0%\n`
            } else {
                for (const m of room.movies) {
                    csvContent += `"${room.cinemaName}","${room.roomName}","${room.format}",${room.totalSeats},"${m.movieTitle}","${m.genre}",${m.showtimesCount},${m.ticketsSold},${m.revenue},${m.occupancyRate}%\n`
                }
            }
        }

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute(
            "download",
            `Bao_cao_doanh_thu_${periodType}_${selectedDate || selectedMonth}.csv`
        )
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Lọc danh sách phòng theo search query
    const filteredRooms: RoomRevenueItem[] = (reportData?.roomsBreakdown || []).filter((r) => {
        if (!searchRoomQuery.trim()) return true
        const q = searchRoomQuery.toLowerCase()
        return (
            r.roomName.toLowerCase().includes(q) ||
            r.cinemaName.toLowerCase().includes(q) ||
            r.format.toLowerCase().includes(q) ||
            r.movies.some((m) => m.movieTitle.toLowerCase().includes(q))
        )
    })

    // Tính toán max revenue cho Bar Chart
    const maxBarValue = Math.max(
        ...(reportData?.dailyTrend || []).map((d) => d.revenue),
        1000000
    )

    return (
        <div className="space-y-8">
            {/* 1. Header with Live Filter Bar */}
            <div className="flex flex-col gap-4 rounded-3xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-xl sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                            BẢNG ĐIỀU KHIỂN & BÁO CÁO DOANH THU
                        </span>
                        <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Thống kê Doanh thu & Vận hành
                        </h1>
                        <p className="mt-1 text-xs text-[#9ba9ba]">
                            Báo cáo chi tiết theo từng phòng chiếu, từng phim trong phòng, theo ngày và theo tháng.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <Button
                            variant="outline"
                            onClick={fetchRevenueReport}
                            disabled={loading}
                            className="rounded-xl border-[#243041] bg-[#16202c] px-3 py-2 text-xs text-[#d3dce7] hover:bg-[#1f2c3d]"
                        >
                            <RotateCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
                            Tải lại
                        </Button>

                        <Button
                            onClick={handleExportCSV}
                            disabled={!reportData}
                            className="rounded-xl bg-[#caef6b] px-4 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                        >
                            <Download className="mr-1.5 size-3.5" />
                            Xuất CSV / Excel
                        </Button>
                    </div>
                </div>

                {/* Interactive Filter Controls - Cả 4 thanh được căn chuẩn bằng nhau 100% */}
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-[#1f2c3d]/60 pt-4">
                    {/* 1. Chế độ xem */}
                    <div className="flex flex-col">
                        <label className="text-[11px] font-semibold text-[#9ba9ba] h-4 mb-1.5 flex items-center">
                            Chế độ xem
                        </label>
                        <div className="flex h-10 w-full items-center rounded-xl border border-[#243041] bg-[#0c1219] p-1">
                            <button
                                type="button"
                                onClick={() => setPeriodType("day")}
                                className={`flex-1 h-full flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === "day"
                                        ? "bg-[#caef6b] text-[#090d14] shadow"
                                        : "text-[#9ba9ba] hover:text-white"
                                }`}
                            >
                                Theo ngày
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriodType("month")}
                                className={`flex-1 h-full flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === "month"
                                        ? "bg-[#caef6b] text-[#090d14] shadow"
                                        : "text-[#9ba9ba] hover:text-white"
                                }`}
                            >
                                Theo tháng
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriodType("range")}
                                className={`flex-1 h-full flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === "range"
                                        ? "bg-[#caef6b] text-[#090d14] shadow"
                                        : "text-[#9ba9ba] hover:text-white"
                                }`}
                            >
                                7 ngày qua
                            </button>
                        </div>
                    </div>

                    {/* 2. Chọn ngày / tháng */}
                    <div className="flex flex-col">
                        <label className="text-[11px] font-semibold text-[#9ba9ba] h-4 mb-1.5 flex items-center">
                            {periodType === "day"
                                ? "Chọn ngày báo cáo"
                                : periodType === "month"
                                ? "Chọn tháng báo cáo"
                                : "Chu kỳ báo cáo"}
                        </label>
                        <div className="flex h-10 w-full items-center rounded-xl border border-[#243041] bg-[#0c1219] px-3">
                            <Calendar className="mr-2 size-4 text-[#caef6b] shrink-0" />
                            {periodType === "day" ? (
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="h-full w-full bg-transparent text-xs text-white outline-none cursor-pointer [color-scheme:dark]"
                                />
                            ) : periodType === "month" ? (
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="h-full w-full bg-transparent text-xs text-white outline-none cursor-pointer [color-scheme:dark]"
                                />
                            ) : (
                                <span className="text-xs text-white">7 ngày gần nhất (Tự động)</span>
                            )}
                        </div>
                    </div>

                    {/* 3. Cụm rạp */}
                    <div className="flex flex-col">
                        <label className="text-[11px] font-semibold text-[#9ba9ba] h-4 mb-1.5 flex items-center">
                            Cụm rạp
                        </label>
                        <div className="flex h-10 w-full items-center rounded-xl border border-[#243041] bg-[#0c1219] px-3">
                            <Building2 className="mr-2 size-4 text-[#caef6b] shrink-0" />
                            <select
                                value={selectedCinemaId}
                                onChange={(e) => setSelectedCinemaId(e.target.value)}
                                className="h-full w-full bg-transparent text-xs text-white outline-none cursor-pointer [color-scheme:dark]"
                            >
                                <option value="all">Tất cả cụm rạp</option>
                                <option value="1">Cinema Nguyễn Du (Quận 1)</option>
                                <option value="2">Cinema Thảo Điền (TP. Thủ Đức)</option>
                                <option value="3">Cinema Landmark 81 (Bình Thạnh)</option>
                                <option value="4">Cinema Ba Tháng Hai (Quận 10)</option>
                            </select>
                        </div>
                    </div>

                    {/* 4. Trạng thái hiển thị */}
                    <div className="flex flex-col">
                        <label className="text-[11px] font-semibold text-[#9ba9ba] h-4 mb-1.5 flex items-center">
                            Trạng thái hiển thị
                        </label>
                        <div className="flex h-10 w-full items-center justify-between rounded-xl border border-[#2a3c25] bg-[#162518] px-3 text-xs">
                            <span className="text-[#9ba9ba] shrink-0">Đang hiển thị:</span>
                            <span className="font-bold text-[#caef6b] truncate ml-1 text-right">
                                {periodType === "day"
                                    ? `Ngày ${formatISOToVN(selectedDate)}`
                                    : periodType === "month"
                                    ? `Tháng ${selectedMonth}`
                                    : "7 ngày gần nhất"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Top Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Doanh thu */}
                <div className="rounded-2xl border border-[#2a3c25] bg-[#121f15] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Doanh thu kỳ này</span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#caef6b]">
                            <TrendingUp className="size-3" /> Thực tế
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">
                        {loading
                            ? "Đang tính..."
                            : formatVND(reportData?.summary.totalRevenue || 0)}
                    </div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">
                        Từ {reportData?.summary.totalBookings || 0} lượt đặt vé đã thanh toán
                    </div>
                </div>

                {/* Vé đã bán */}
                <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Vé đã bán</span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#caef6b]">
                            <Ticket className="size-3" /> Tổng vé
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">
                        {loading ? "..." : (reportData?.summary.totalTickets || 0).toLocaleString("vi-VN")}
                    </div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">Vé điện tử & quầy</div>
                </div>

                {/* Tỷ lệ lấp đầy */}
                <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Tỷ lệ lấp đầy ghế TB</span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#caef6b]">
                            <TrendingUp className="size-3" /> Hiệu suất
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">
                        {loading ? "..." : `${reportData?.summary.avgOccupancyRate || 0}%`}
                    </div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">Trên tổng số ghế phòng chiếu</div>
                </div>

                {/* Suất chiếu */}
                <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#9ba9ba]">Suất chiếu hoạt động</span>
                        <span className="rounded border border-[#2a3c25] bg-[#162518] px-2 py-0.5 text-[9px] font-bold text-[#caef6b]">
                            Đã xếp lịch
                        </span>
                    </div>
                    <div className="mt-3 text-2xl font-black text-white">
                        {loading ? "..." : reportData?.summary.totalShowtimes || 0}
                    </div>
                    <div className="mt-1 text-[11px] text-[#9ba9ba]">
                        Tại {reportData?.roomsBreakdown.length || 0} phòng chiếu
                    </div>
                </div>
            </div>

            {/* 2.5. Quick action: AI xếp lịch tự động */}
            <div className="relative overflow-hidden rounded-3xl border border-[#2a3c25] bg-gradient-to-r from-[#121f15] via-[#0f1a12] to-[#121923] p-5 shadow-xl sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#caef6b]/15 text-[#caef6b]">
                            <Sparkles className="size-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">AI Xếp lịch tự động</h3>
                            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#9ba9ba]">
                                Chọn ngày, phim và phòng chiếu — Gemini sẽ phân bổ suất theo khung giờ vàng,
                                tránh trùng lịch và chừa thời gian dọn phòng.
                            </p>
                            {lastApplied && (
                                <p className="mt-2 text-[11px] font-semibold text-[#caef6b]">
                                    Đã thêm {lastApplied.count} suất cho{" "}
                                    {formatISOToVN(lastApplied.date)} ·{" "}
                                    <Link to="/admin/showtimes" className="underline underline-offset-2">
                                        Xem lịch chiếu
                                    </Link>
                                </p>
                            )}
                        </div>
                    </div>

                    <Button
                        onClick={() => setIsAIModalOpen(true)}
                        className="shrink-0 rounded-xl bg-[#caef6b] px-4 py-2.5 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                    >
                        <Sparkles className="mr-1.5 size-4" />
                        Mở AI xếp lịch
                        <ArrowRight className="ml-1.5 size-3.5" />
                    </Button>
                </div>
            </div>

            {/* 3. Middle Section: Dynamic Revenue Chart + Top Movies */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Revenue Bar Chart */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-7">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <div>
                            <h3 className="text-base font-bold text-white">
                                {periodType === "month"
                                    ? `Doanh thu các ngày trong Tháng ${selectedMonth}`
                                    : "Biến động doanh thu theo chu kỳ"}
                            </h3>
                            <p className="text-xs text-[#9ba9ba]">
                                {reportData?.startDate} đến {reportData?.endDate}
                            </p>
                        </div>
                        <span className="rounded-lg border border-[#2a3c25] bg-[#162518] px-2.5 py-1 text-xs font-bold text-[#caef6b]">
                            {reportData?.dailyTrend.length || 0} mốc thời gian
                        </span>
                    </div>

                    {/* Bar Chart Container */}
                    <div className="mt-8 flex h-56 items-end justify-between gap-1.5 overflow-x-auto px-2 sm:px-4">
                        {(reportData?.dailyTrend || []).map((item) => {
                            const heightPercent =
                                maxBarValue > 0 ? Math.max(5, (item.revenue / maxBarValue) * 100) : 5
                            const isSelected = item.date === selectedDate

                            return (
                                <div
                                    key={item.date}
                                    className="flex flex-1 min-w-[32px] flex-col items-center gap-2 group cursor-pointer"
                                    onClick={() => {
                                        if (periodType !== "day") {
                                            setSelectedDate(item.date)
                                            setPeriodType("day")
                                        }
                                    }}
                                >
                                    <span className="text-[9px] font-bold text-[#9ba9ba] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        {formatVND(item.revenue)}
                                    </span>
                                    <div className="w-full max-w-[36px] rounded-t-xl bg-[#1a2431] p-1 flex items-end h-44">
                                        <div
                                            style={{ height: `${heightPercent}%` }}
                                            className={`w-full rounded-t-lg transition-all duration-500 ${
                                                isSelected || item.revenue > 0
                                                    ? "bg-[#caef6b] shadow-[0_0_12px_rgba(202,239,107,0.3)]"
                                                    : "bg-[#25364b] group-hover:bg-[#344d6b]"
                                            }`}
                                        />
                                    </div>
                                    <span
                                        className={`text-[10px] font-bold whitespace-nowrap ${
                                            isSelected ? "text-[#caef6b]" : "text-[#9ba9ba]"
                                        }`}
                                    >
                                        {item.dayLabel.split(" ")[0]}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Top Movies by Revenue */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-5">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <h3 className="text-base font-bold text-white">Top phim có doanh thu cao</h3>
                        <span className="text-xs text-[#9ba9ba]">Kỳ lọc hiện tại</span>
                    </div>

                    <div className="mt-4 space-y-3">
                        {(reportData?.topMovies || []).length === 0 ? (
                            <div className="py-8 text-center text-xs text-[#9ba9ba]">
                                Chưa có dữ liệu doanh thu phim trong khoảng thời gian này.
                            </div>
                        ) : (
                            reportData?.topMovies.map((movie, idx) => (
                                <div
                                    key={movie.movieId}
                                    className="flex items-center justify-between rounded-xl border border-[#1f2c3d] bg-[#0e141d] p-3 text-xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-6 items-center justify-center rounded-lg bg-[#1a2431] font-bold text-[#caef6b] text-xs">
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <div className="font-bold text-white">{movie.title}</div>
                                            <div className="text-[11px] text-[#9ba9ba]">
                                                {movie.tickets} vé · Lấp đầy: {movie.fillRate}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-[#caef6b]">
                                            {formatVND(movie.revenue)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* 4. PHẦN MỚI: BÁO CÁO DOANH THU CHI TIẾT THEO TỪNG PHÒNG VÀ TỪNG PHIM */}
            <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1f2c3d] pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <DoorOpen className="size-5 text-[#caef6b]" />
                            <h2 className="text-lg font-black text-white">
                                Báo cáo Doanh thu chi tiết theo từng Phòng chiếu & Phim
                            </h2>
                        </div>
                        <p className="mt-1 text-xs text-[#9ba9ba]">
                            Nhấp vào từng phòng để xem danh sách chi tiết các phim đã chiếu trong phòng đó.
                        </p>
                    </div>

                    {/* Search box for rooms */}
                    <div className="flex items-center gap-2 rounded-xl border border-[#243041] bg-[#0c1219] px-3 py-1.5 sm:w-64">
                        <Search className="size-3.5 text-[#9ba9ba]" />
                        <input
                            type="text"
                            placeholder="Tìm phòng, rạp, phim..."
                            value={searchRoomQuery}
                            onChange={(e) => setSearchRoomQuery(e.target.value)}
                            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#52637a]"
                        />
                    </div>
                </div>

                {/* Rooms Breakdown List / Table */}
                <div className="mt-6 space-y-4">
                    {loading ? (
                        <div className="py-12 text-center text-xs text-[#9ba9ba]">
                            <RotateCw className="mx-auto mb-2 size-5 animate-spin text-[#caef6b]" />
                            Đang tổng hợp báo cáo doanh thu phòng và phim...
                        </div>
                    ) : filteredRooms.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[#9ba9ba]">
                            Không tìm thấy phòng chiếu nào khớp với điều kiện lọc.
                        </div>
                    ) : (
                        filteredRooms.map((room) => {
                            const isExpanded = !!expandedRooms[room.roomId]

                            return (
                                <div
                                    key={room.roomId}
                                    className="overflow-hidden rounded-2xl border border-[#1f2c3d] bg-[#0e141d] transition-all hover:border-[#2f4258]"
                                >
                                    {/* Room Header Row */}
                                    <div
                                        onClick={() => toggleRoomExpand(room.roomId)}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 cursor-pointer hover:bg-[#141d29]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1a2431] text-[#caef6b]">
                                                <DoorOpen className="size-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-sm">
                                                        {room.roomName}
                                                    </span>
                                                    <span className="rounded bg-[#1f2c3d] px-2 py-0.5 text-[10px] font-bold text-[#caef6b]">
                                                        {room.format}
                                                    </span>
                                                    <span
                                                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                                            room.status === "active"
                                                                ? "bg-[#162518] text-[#caef6b]"
                                                                : "bg-[#2d1b1b] text-[#ef6b6b]"
                                                        }`}
                                                    >
                                                        {room.status === "active" ? "Hoạt động" : "Bảo trì"}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 text-xs text-[#9ba9ba]">
                                                    {room.cinemaName} · {room.totalSeats} ghế · {room.showtimesCount} suất chiếu
                                                </div>
                                            </div>
                                        </div>

                                        {/* Financial & Performance Summary */}
                                        <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-[#1f2c3d]/60 sm:border-0 pt-3 sm:pt-0">
                                            <div className="text-left sm:text-right">
                                                <div className="text-[10px] font-semibold text-[#9ba9ba]">
                                                    Vé bán ra: <span className="text-white font-bold">{room.ticketsSold}</span>
                                                </div>
                                                <div className="text-[10px] text-[#9ba9ba]">
                                                    Lấp đầy: <span className="text-[#caef6b] font-bold">{room.occupancyRate}%</span>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-xs text-[#9ba9ba]">Doanh thu</div>
                                                <div className="text-base font-black text-[#caef6b]">
                                                    {formatVND(room.totalRevenue)}
                                                </div>
                                            </div>

                                            <div className="text-[#9ba9ba]">
                                                {isExpanded ? (
                                                    <ChevronUp className="size-4" />
                                                ) : (
                                                    <ChevronDown className="size-4" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Detail: List of Movies in this Room */}
                                    {isExpanded && (
                                        <div className="border-t border-[#1f2c3d] bg-[#090d14]/70 p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="text-xs font-bold text-[#caef6b] uppercase tracking-wider flex items-center gap-1.5">
                                                    <Film className="size-3.5" />
                                                    Phân rã doanh thu từng phim trong {room.roomName}
                                                </span>
                                                <span className="text-[11px] text-[#9ba9ba]">
                                                    {room.movies.length} phim đã chiếu
                                                </span>
                                            </div>

                                            {room.movies.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-[#1f2c3d] p-4 text-center text-xs text-[#9ba9ba]">
                                                    Chưa có phim nào chiếu trong phòng này trong khoảng thời gian đã chọn.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs">
                                                        <thead>
                                                            <tr className="border-b border-[#1f2c3d] text-[#9ba9ba]">
                                                                <th className="pb-2 font-semibold">Tên phim</th>
                                                                <th className="pb-2 font-semibold">Thể loại</th>
                                                                <th className="pb-2 font-semibold text-center">Suất chiếu</th>
                                                                <th className="pb-2 font-semibold text-center">Vé đã bán</th>
                                                                <th className="pb-2 font-semibold text-center">Lấp đầy ghế</th>
                                                                <th className="pb-2 font-semibold text-right">Doanh thu</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[#1f2c3d]/50">
                                                            {room.movies.map((m) => (
                                                                <tr key={m.movieId} className="hover:bg-[#121923]/50">
                                                                    <td className="py-2.5 font-bold text-white flex items-center gap-2">
                                                                        <Film className="size-3 text-[#caef6b] shrink-0" />
                                                                        <span>{m.movieTitle}</span>
                                                                    </td>
                                                                    <td className="py-2.5 text-[#9ba9ba]">{m.genre}</td>
                                                                    <td className="py-2.5 text-center text-white font-medium">
                                                                        {m.showtimesCount}
                                                                    </td>
                                                                    <td className="py-2.5 text-center text-white font-medium">
                                                                        {m.ticketsSold}
                                                                    </td>
                                                                    <td className="py-2.5 text-center">
                                                                        <span className="rounded bg-[#162518] px-2 py-0.5 text-[10px] font-bold text-[#caef6b]">
                                                                            {m.occupancyRate}%
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 text-right font-black text-[#caef6b]">
                                                                        {formatVND(m.revenue)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* 5. Bottom Section: AI Forecast + Operational Health */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* AI Revenue Forecast Card */}
                <AIForecastCard />

                {/* Operational Health Card */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-5">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <h3 className="text-base font-bold text-white">Sức khỏe vận hành rạp</h3>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#caef6b]">
                            <span className="size-2 rounded-full bg-[#caef6b] animate-ping" /> Tốt
                        </span>
                    </div>

                    <div className="mt-4 space-y-3 text-xs">
                        <div className="flex justify-between">
                            <span className="text-[#9ba9ba]">Tổng phòng chiếu toàn hệ thống</span>
                            <span className="font-bold text-white">
                                {reportData?.roomsBreakdown.length || 23} phòng (4 cụm rạp)
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#9ba9ba]">Phòng đang hoạt động</span>
                            <span className="font-bold text-[#caef6b]">
                                {(reportData?.roomsBreakdown || []).filter((r) => r.status === "active").length} phòng
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#9ba9ba]">Suất chiếu trễ / Sự cố</span>
                            <span className="font-bold text-[#caef6b]">0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#9ba9ba]">Máy chiếu & Âm thanh</span>
                            <span className="font-bold text-[#caef6b]">Dolby Atmos & IMAX chuẩn</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal AI xếp lịch — ghi thẳng vào database */}
            {isAIModalOpen && (
                <AutoScheduleModal
                    onClose={() => setIsAIModalOpen(false)}
                    onApply={async (result, aiDate) => {
                        const res = await showtimeService.bulkCreate(
                            aiDate,
                            result.schedule.map((slot) => ({
                                movieId: slot.movieId,
                                roomId: slot.roomId,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                            }))
                        )
                        return { success: res.success, message: res.message }
                    }}
                    onApplied={(aiDate, result) => {
                        setLastApplied({ date: aiDate, count: result.schedule.length })
                        fetchRevenueReport()
                    }}
                />
            )}
        </div>
    )
}
