import { useCallback, useEffect, useState } from "react"
import {
    CalendarClock,
    Plus,
    Sparkles,
    Loader2,
    AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AutoScheduleModal } from "@/components/admin/AutoScheduleModal"
import { ShowtimeDetailModal } from "@/components/admin/ShowtimeDetailModal"
import { ADMIN_ROOMS, type TimelineBlock } from "@/constants/adminSchedule"
import { showtimeService, type ShowtimeRow } from "@/services/showtime.service"
import { movieService, type AdminMovie } from "@/services/movie.service"

/** Ngày mặc định trùng dữ liệu seed của đồ án */
const DEFAULT_DATE = "2026-10-24"
const BASE_ROOMS = ["Phòng 01", "Phòng 02", "Phòng 03", "Phòng 04"]
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function toMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number)
    return (h || 0) * 60 + (m || 0)
}

function addMinutes(time: string, minutes: number): string {
    const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59)
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function rowToBlock(row: ShowtimeRow): TimelineBlock {
    const start = toMinutes(row.start_time_str)
    const end = toMinutes(row.end_time_str)
    const duration = end > start ? end - start : end + 24 * 60 - start

    return {
        id: `db-${row.id}`,
        room: row.room_name,
        movieTitle: row.movie_title,
        startTime: row.start_time_str,
        endTime: row.end_time_str,
        startHour: start / 60,
        durationHours: duration / 60,
        format: row.format,
        source: "db",
        roomId: row.room_id,
        movieId: row.movie_id,
    }
}

export const AdminShowtimesPage = () => {
    const [date, setDate] = useState(DEFAULT_DATE)
    const [showtimes, setShowtimes] = useState<ShowtimeRow[]>([])
    const [movies, setMovies] = useState<AdminMovie[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const [isAIModalOpen, setIsAIModalOpen] = useState(false)
    const [selectedBlock, setSelectedBlock] = useState<TimelineBlock | null>(null)

    // Form tạo suất
    const [formMovieId, setFormMovieId] = useState("")
    const [formRoomId, setFormRoomId] = useState("1")
    const [formStart, setFormStart] = useState("19:30")
    const [formEnd, setFormEnd] = useState("21:28")
    const [formPriceRegular, setFormPriceRegular] = useState("90000")
    const [formPriceVip, setFormPriceVip] = useState("120000")
    const [isCreating, setIsCreating] = useState(false)

    const loadShowtimes = useCallback(async (targetDate: string) => {
        setIsLoading(true)
        setError(null)

        const res = await showtimeService.getByDate(targetDate)
        if (res.success && res.data) {
            setShowtimes(res.data)
        } else {
            setError(res.message || "Không tải được lịch chiếu từ database.")
        }

        setIsLoading(false)
    }, [])

    useEffect(() => {
        void loadShowtimes(date)
    }, [date, loadShowtimes])

    useEffect(() => {
        void movieService.getMovies().then((res) => {
            if (res.success && res.data) {
                const active = res.data.filter((movie) => movie.status !== "ended")
                setMovies(active)
                if (active[0]) setFormMovieId(String(active[0].id))
            }
        })
    }, [])

    const selectedMovie = movies.find((movie) => movie.id === Number(formMovieId)) || null

    const handleStartChange = (value: string) => {
        setFormStart(value)
        if (selectedMovie && TIME_RE.test(value)) {
            setFormEnd(addMinutes(value, selectedMovie.duration_min))
        }
    }

    const handleMovieChange = (value: string) => {
        setFormMovieId(value)
        const movie = movies.find((item) => item.id === Number(value))
        if (movie && TIME_RE.test(formStart)) {
            setFormEnd(addMinutes(formStart, movie.duration_min))
        }
    }

    const handleCreateShowtime = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formMovieId) {
            setError("Vui lòng chọn phim.")
            return
        }
        if (!TIME_RE.test(formStart) || !TIME_RE.test(formEnd)) {
            setError("Giờ phải theo định dạng HH:mm.")
            return
        }
        if (formStart >= formEnd) {
            setError("Giờ kết thúc phải sau giờ bắt đầu.")
            return
        }

        setIsCreating(true)
        setError(null)
        setNotice(null)

        const res = await showtimeService.create({
            movieId: Number(formMovieId),
            roomId: Number(formRoomId),
            date,
            startTime: formStart,
            endTime: formEnd,
            priceRegular: Number(formPriceRegular) || 90000,
            priceVip: Number(formPriceVip) || 120000,
        })

        setIsCreating(false)

        if (res.success) {
            await loadShowtimes(date)
            setNotice(res.message || "Đã tạo suất chiếu.")
        } else {
            setError(res.message || "Không thể tạo suất chiếu.")
        }
    }

    const handleCancelShowtime = async (block: TimelineBlock) => {
        if (block.source !== "db") {
            setSelectedBlock(null)
            return
        }

        const id = Number(block.id.replace("db-", ""))
        const res = await showtimeService.cancel(id)

        if (res.success) {
            setSelectedBlock(null)
            await loadShowtimes(date)
            setNotice(res.message || "Đã hủy suất chiếu.")
        } else {
            setError(res.message || "Không thể hủy suất chiếu.")
        }
    }

    const applyAISchedule = async (
        result: { schedule: Array<{ movieId: number; roomId: number; startTime: string; endTime: string }> },
        aiDate: string
    ) => {
        const res = await showtimeService.bulkCreate(
            aiDate,
            result.schedule.map((slot) => ({
                movieId: slot.movieId,
                roomId: slot.roomId,
                startTime: slot.startTime,
                endTime: slot.endTime,
            }))
        )

        if (res.success) {
            setDate(aiDate)
            await loadShowtimes(aiDate)
            setNotice(res.message || "Đã thêm lịch AI vào database.")
        }

        return { success: res.success, message: res.message }
    }

    const blocks = showtimes.map(rowToBlock)
    const rooms = Array.from(new Set([...BASE_ROOMS, ...blocks.map((block) => block.room)]))

    const seatLabel = (room: string) => {
        const info = ADMIN_ROOMS.find((item) => item.name === room)
        return info ? `${info.seats} ghế · ${info.format}` : ""
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                        ĐIỀU HÀNH LỊCH CHIẾU
                    </span>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
                        Đúng phim. Đúng phòng. Đúng giờ.
                    </h1>
                    <p className="mt-1 text-xs text-[#9ba9ba]">
                        Lịch chiếu lấy từ database · {blocks.length} suất đang hoạt động
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-10 rounded-xl border border-[#243041] bg-[#121923] px-3 text-xs text-white [color-scheme:dark] focus:border-[#caef6b] focus:outline-none"
                    />

                    <Button
                        onClick={() => setIsAIModalOpen(true)}
                        className="rounded-xl border border-[#caef6b]/50 bg-[#162518] px-4 py-2 text-xs font-bold text-[#caef6b] shadow-[0_0_16px_rgba(202,239,107,0.15)] hover:bg-[#1c301f] hover:border-[#caef6b]"
                    >
                        <Sparkles className="mr-1.5 size-4" />
                        AI Xếp lịch tự động
                    </Button>

                    <Button
                        onClick={() => {
                            document.getElementById("create-showtime-panel")?.scrollIntoView({ behavior: "smooth" })
                        }}
                        className="rounded-xl bg-[#caef6b] px-4 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                    >
                        <Plus className="mr-1.5 size-4" />
                        Tạo suất chiếu
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-4 py-3 text-xs text-[#ffb4b4]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {notice && (
                <div className="rounded-xl border border-[#2a3c25] bg-[#121f15] px-4 py-3 text-xs text-[#caef6b]">
                    {notice}
                </div>
            )}

            {/* Timeline + Form */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-8">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="size-4 text-[#caef6b]" />
                            <h3 className="text-sm font-bold text-white">Lịch chiếu theo phòng</h3>
                        </div>
                        <span className="text-xs text-[#9ba9ba]">
                            {new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")}
                        </span>
                    </div>

                    <p className="mt-2 text-[11px] text-[#9ba9ba]">
                        💡 Bấm vào một suất chiếu để xem chi tiết hoặc hủy suất.
                    </p>

                    <div className="mt-4 overflow-x-auto pb-4">
                        <div className="min-w-[680px]">
                            <div className="grid grid-cols-8 border-b border-[#1f2c3d]/60 pb-2 text-center text-[11px] font-bold text-[#9ba9ba]">
                                {[9, 11, 13, 15, 17, 19, 21, 23].map((hour) => (
                                    <div key={hour}>{hour}:00</div>
                                ))}
                            </div>

                            <div className="divide-y divide-[#1f2c3d]/40 pt-2">
                                {isLoading && (
                                    <div className="py-10 text-center text-xs text-[#9ba9ba]">
                                        <Loader2 className="mx-auto mb-2 size-5 animate-spin text-[#caef6b]" />
                                        Đang tải lịch chiếu từ database...
                                    </div>
                                )}

                                {!isLoading && blocks.length === 0 && (
                                    <div className="py-10 text-center text-xs text-[#9ba9ba]">
                                        Chưa có suất chiếu nào cho ngày này. Hãy tạo mới hoặc chọn ngày khác.
                                    </div>
                                )}

                                {!isLoading && rooms.map((room) => {
                                    const roomShowtimes = blocks.filter((block) => block.room === room)
                                    return (
                                        <div key={room} className="py-3">
                                            <div className="mb-2 flex items-center justify-between text-xs font-bold text-white">
                                                <span>{room}</span>
                                                <span className="text-[10px] font-normal text-[#9ba9ba]">
                                                    {seatLabel(room)}
                                                </span>
                                            </div>

                                            <div className="relative h-14 w-full rounded-xl border border-[#1f2c3d] bg-[#090d14] p-1">
                                                {roomShowtimes.map((block) => {
                                                    const left = Math.max(0, ((block.startHour - 9) / 15) * 100)
                                                    const width = Math.min(100 - left, (block.durationHours / 15) * 100)

                                                    return (
                                                        <div
                                                            key={block.id}
                                                            style={{ left: `${left}%`, width: `${width}%` }}
                                                            onClick={() => setSelectedBlock(block)}
                                                            title={`${block.movieTitle} · ${block.startTime}-${block.endTime} · ${block.format}`}
                                                            className="absolute top-1 bottom-1 cursor-pointer truncate rounded-lg border border-[#caef6b]/60 bg-[#1a2f1c] px-2 py-1 text-[10px] font-semibold text-[#caef6b] transition-all hover:border-[#caef6b] hover:shadow-md hover:shadow-[#caef6b]/20"
                                                        >
                                                            <div className="truncate font-bold">{block.movieTitle}</div>
                                                            <div className="truncate text-[9px] text-[#9ba9ba]">
                                                                {block.startTime} - {block.endTime}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form tạo suất */}
                <div id="create-showtime-panel" className="lg:col-span-4">
                    <div className="sticky top-24 rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <div className="flex items-center gap-2 border-b border-[#1f2c3d] pb-4">
                            <Plus className="size-4 text-[#caef6b]" />
                            <h3 className="text-base font-bold text-white">Tạo suất chiếu</h3>
                        </div>

                        <form onSubmit={handleCreateShowtime} className="mt-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="st-movie">Phim *</Label>
                                <select
                                    id="st-movie"
                                    value={formMovieId}
                                    onChange={(e) => handleMovieChange(e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] focus:border-[#caef6b] focus:outline-none"
                                >
                                    {movies.map((movie) => (
                                        <option key={movie.id} value={movie.id}>
                                            {movie.title} ({movie.rating} · {movie.duration_min} phút)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="st-room">Phòng chiếu *</Label>
                                <select
                                    id="st-room"
                                    value={formRoomId}
                                    onChange={(e) => setFormRoomId(e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] focus:border-[#caef6b] focus:outline-none"
                                >
                                    {ADMIN_ROOMS.map((room) => (
                                        <option key={room.id} value={room.id}>
                                            {room.name} ({room.seats} ghế · {room.format})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="st-start">Bắt đầu</Label>
                                    <Input
                                        id="st-start"
                                        type="time"
                                        value={formStart}
                                        onChange={(e) => handleStartChange(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="st-end">Kết thúc</Label>
                                    <Input
                                        id="st-end"
                                        type="time"
                                        value={formEnd}
                                        onChange={(e) => setFormEnd(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Giá thường</Label>
                                    <Input
                                        value={formPriceRegular}
                                        onChange={(e) => setFormPriceRegular(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Giá VIP</Label>
                                    <Input
                                        value={formPriceVip}
                                        onChange={(e) => setFormPriceVip(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="rounded-xl border border-[#2a3c25] bg-[#121f15] p-3 text-[11px] text-[#caef6b]">
                                Ngày chiếu: {new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")} ·
                                kiểm tra trùng giờ tự động theo phòng.
                            </div>

                            <Button
                                type="submit"
                                disabled={isCreating}
                                className="w-full rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
                            >
                                {isCreating ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="size-4 animate-spin" />
                                        Đang lưu vào database...
                                    </span>
                                ) : (
                                    "Tạo suất chiếu"
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Modal AI xếp lịch (ghi thẳng vào DB) */}
            {isAIModalOpen && (
                <AutoScheduleModal
                    onClose={() => setIsAIModalOpen(false)}
                    onApply={applyAISchedule}
                    onApplied={(_, result) =>
                        setNotice(`Đã thêm ${result.schedule.length} suất chiếu từ AI vào database.`)
                    }
                />
            )}

            {/* Modal chi tiết / hủy suất chiếu */}
            {selectedBlock && (
                <ShowtimeDetailModal
                    block={selectedBlock}
                    onClose={() => setSelectedBlock(null)}
                    onCancel={(block) => void handleCancelShowtime(block)}
                />
            )}
        </div>
    )
}
