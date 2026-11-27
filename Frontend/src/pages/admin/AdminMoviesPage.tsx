import { useCallback, useEffect, useState } from "react"
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    AlertCircle,
    AlertTriangle,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { COMING_SOON_MOVIES, NOW_SHOWING_MOVIES } from "@/constants"
import {
    movieService,
    type AdminMovie,
    type MovieRating,
    type MovieStatus,
} from "@/services/movie.service"

const STATUS_LABEL: Record<MovieStatus, string> = {
    now_showing: "Đang chiếu",
    coming_soon: "Sắp chiếu",
    ended: "Ngừng chiếu",
}

/** Ảnh poster dự phòng: DB chưa lưu poster_url nên map theo tên phim từ mock */
const POSTER_BY_TITLE: Record<string, string> = Object.fromEntries(
    [...NOW_SHOWING_MOVIES, ...COMING_SOON_MOVIES].map((movie) => [movie.title, movie.poster])
)
const FALLBACK_POSTER = NOW_SHOWING_MOVIES[0]?.poster || ""

function posterOf(movie: AdminMovie): string {
    return movie.poster_url || POSTER_BY_TITLE[movie.title] || FALLBACK_POSTER
}

export const AdminMoviesPage = () => {
    const [movies, setMovies] = useState<AdminMovie[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const [activeTab, setActiveTab] = useState<MovieStatus>("now_showing")
    const [searchTerm, setSearchTerm] = useState("")

    // Phim đang sửa / tạo mới
    const [editingId, setEditingId] = useState<number | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [togglingId, setTogglingId] = useState<number | null>(null)

    // Form
    const [formTitle, setFormTitle] = useState("")
    const [formGenre, setFormGenre] = useState("")
    const [formDuration, setFormDuration] = useState("120")
    const [formSynopsis, setFormSynopsis] = useState("")
    const [formRating, setFormRating] = useState<MovieRating>("T13")
    const [formStatus, setFormStatus] = useState<MovieStatus>("now_showing")
    const [formPosterUrl, setFormPosterUrl] = useState("")

    // Xóa phim
    const [deleteTarget, setDeleteTarget] = useState<AdminMovie | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const applyMovieToForm = (movie: AdminMovie | null) => {
        setIsCreating(false)
        setEditingId(movie?.id ?? null)
        setFormTitle(movie?.title ?? "")
        setFormGenre(movie?.genre ?? "")
        setFormDuration(String(movie?.duration_min ?? 120))
        setFormSynopsis(movie?.synopsis ?? "")
        setFormRating(movie?.rating ?? "T13")
        setFormStatus(movie?.status ?? "now_showing")
        setFormPosterUrl(movie?.poster_url ?? "")
        setNotice(null)
    }

    const loadMovies = useCallback(async (keepId?: number | null) => {
        setIsLoading(true)
        setError(null)

        const res = await movieService.getMovies()
        if (res.success && res.data) {
            const list = res.data
            setMovies(list)

            const target =
                (keepId ? list.find((movie) => movie.id === keepId) : undefined) || list[0] || null
            if (target) applyMovieToForm(target)
        } else {
            setError(res.message || "Không tải được danh sách phim từ database.")
        }

        setIsLoading(false)
    }, [])

    useEffect(() => {
        void loadMovies(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const editingMovie = movies.find((movie) => movie.id === editingId) || null

    const startCreate = () => {
        setIsCreating(true)
        setEditingId(null)
        setFormTitle("")
        setFormGenre("")
        setFormDuration("120")
        setFormSynopsis("")
        setFormRating("T13")
        setFormStatus("coming_soon")
        setFormPosterUrl("")
        setNotice(null)
        setError(null)
    }

    const handleSaveMovie = async (e: React.FormEvent) => {
        e.preventDefault()

        const duration = Number(formDuration)
        if (!formTitle.trim() || !formGenre.trim()) {
            setError("Tên phim và thể loại không được để trống.")
            return
        }
        if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
            setError("Thời lượng phải là số phút từ 1 đến 600.")
            return
        }

        setIsSaving(true)
        setError(null)
        setNotice(null)

        const payload = {
            title: formTitle.trim(),
            genre: formGenre.trim(),
            duration_min: duration,
            synopsis: formSynopsis,
            rating: formRating,
            status: formStatus,
            poster_url: formPosterUrl.trim(),
        }

        const res = isCreating
            ? await movieService.createMovie(payload)
            : editingId
                ? await movieService.updateMovie(editingId, payload)
                : { success: false, message: "Chưa chọn phim để lưu." }

        setIsSaving(false)

        if (res.success) {
            const movieId = res.movie?.id ?? editingId
            await loadMovies(movieId)
            setIsCreating(false)
            setNotice(res.message || "Đã lưu thay đổi vào database.")
        } else {
            setError(res.message || "Không thể lưu phim. Vui lòng thử lại.")
        }
    }

    const handleToggleStatus = async (movie: AdminMovie) => {
        const nextStatus: MovieStatus = movie.status === "now_showing" ? "coming_soon" : "now_showing"
        setTogglingId(movie.id)
        const res = await movieService.updateMovie(movie.id, { status: nextStatus })
        setTogglingId(null)

        if (res.success) {
            await loadMovies(movie.id)
            setNotice(`Đã chuyển "${movie.title}" sang ${STATUS_LABEL[nextStatus]}.`)
        } else {
            setError(res.message || "Không thể đổi trạng thái phim.")
        }
    }

    const handleDeleteMovie = async () => {
        if (!deleteTarget) return

        setIsDeleting(true)
        setDeleteError(null)

        const res = await movieService.deleteMovie(deleteTarget.id)
        setIsDeleting(false)

        if (res.success) {
            setDeleteTarget(null)
            await loadMovies(null)
            setNotice(res.message || "Đã xóa phim.")
            return
        }

        setDeleteError(res.message || "Không thể xóa phim. Vui lòng thử lại.")
    }

    const counts = {
        now_showing: movies.filter((movie) => movie.status === "now_showing").length,
        coming_soon: movies.filter((movie) => movie.status === "coming_soon").length,
        ended: movies.filter((movie) => movie.status === "ended").length,
    }

    const keyword = searchTerm.trim().toLowerCase()
    const filteredMovies = movies.filter((movie) => {
        const matchesTab = movie.status === activeTab
        const matchesSearch =
            !keyword ||
            movie.title.toLowerCase().includes(keyword) ||
            movie.genre.toLowerCase().includes(keyword)
        return matchesTab && matchesSearch
    })

    return (
        <div className="space-y-8">
            {/* 1. Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                        DANH MỤC ĐIỆN ẢNH
                    </span>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Quản lý phim</h1>
                    <p className="mt-1 text-xs text-[#9ba9ba]">
                        Dữ liệu lấy trực tiếp từ database · {movies.length} phim
                    </p>
                </div>

                <Button
                    onClick={startCreate}
                    className="rounded-xl bg-[#caef6b] px-4 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                >
                    <Plus className="mr-1.5 size-4" />
                    Thêm phim mới
                </Button>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-4 py-3 text-xs text-[#ffb4b4]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* 2. Main Grid */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-8">
                    {/* Tabs & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#1f2c3d] bg-[#121923] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {(["now_showing", "coming_soon", "ended"] as MovieStatus[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setActiveTab(status)}
                                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${activeTab === status
                                        ? "bg-[#caef6b] text-[#090d14]"
                                        : "text-[#9ba9ba] hover:text-white"
                                        }`}
                                >
                                    {STATUS_LABEL[status]} ({counts[status]})
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 size-3.5 text-[#9ba9ba]" />
                            <Input
                                placeholder="Tìm phim, thể loại..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs bg-[#090d14]"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-3xl border border-[#1f2c3d] bg-[#121923] shadow-xl">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-[#1f2c3d] bg-[#0c121a] text-[11px] font-bold uppercase text-[#9ba9ba]">
                                <tr>
                                    <th className="p-4">Phim</th>
                                    <th className="p-4">Phân loại</th>
                                    <th className="p-4">Trạng thái</th>
                                    <th className="p-4">Thời lượng</th>
                                    <th className="p-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f2c3d]/60">
                                {isLoading && movies.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-[#9ba9ba]">
                                            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-[#caef6b]" />
                                            Đang tải phim từ database...
                                        </td>
                                    </tr>
                                )}

                                {!isLoading && filteredMovies.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-[#9ba9ba]">
                                            Không có phim nào ở mục này.
                                        </td>
                                    </tr>
                                )}

                                {filteredMovies.map((movie) => {
                                    const isSelected = editingId === movie.id && !isCreating
                                    return (
                                        <tr
                                            key={movie.id}
                                            onClick={() => applyMovieToForm(movie)}
                                            className={`cursor-pointer transition-colors ${isSelected ? "bg-[#17261a]" : "hover:bg-[#16202c]"
                                                }`}
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={posterOf(movie)}
                                                        alt={movie.title}
                                                        className="size-10 rounded-lg object-cover shrink-0"
                                                    />
                                                    <div>
                                                        <div className="font-bold text-white hover:text-[#caef6b]">
                                                            {movie.title}
                                                        </div>
                                                        <div className="text-[10px] text-[#9ba9ba]">
                                                            {movie.genre}
                                                            {movie.showtime_count
                                                                ? ` · ${movie.showtime_count} suất chiếu`
                                                                : ""}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <Badge className="border-[#2a3c25] bg-[#162518] text-[#caef6b] text-[10px] font-bold">
                                                    {movie.rating}
                                                </Badge>
                                            </td>

                                            <td className="p-4" onClick={(event) => event.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={movie.status === "now_showing"}
                                                        disabled={togglingId === movie.id}
                                                        onCheckedChange={() => void handleToggleStatus(movie)}
                                                    />
                                                    <span className="text-[11px] text-[#9ba9ba]">
                                                        {STATUS_LABEL[movie.status]}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="p-4 text-[#9ba9ba]">{movie.duration_min} phút</td>

                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            applyMovieToForm(movie)
                                                        }}
                                                        title="Chỉnh sửa phim"
                                                        className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#1f2c3d] hover:text-[#caef6b] transition-colors"
                                                    >
                                                        <Edit2 className="size-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            setDeleteError(null)
                                                            setDeleteTarget(movie)
                                                        }}
                                                        title="Xóa phim"
                                                        className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#2d1515] hover:text-[#ff8e8e]"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Edit Panel */}
                <div className="lg:col-span-4">
                    <div className="sticky top-24 rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <h2 className="text-base font-bold text-white border-b border-[#1f2c3d] pb-4">
                            {isCreating ? "Thêm phim mới" : "Chỉnh sửa thông tin phim"}
                        </h2>

                        {(isCreating || editingMovie) ? (
                            <form onSubmit={handleSaveMovie} className="mt-5 space-y-4">
                                <div className="flex items-center gap-4">
                                    <img
                                        src={formPosterUrl.trim() || (editingMovie ? posterOf(editingMovie) : FALLBACK_POSTER)}
                                        alt={formTitle || "Poster"}
                                        className="h-24 w-18 rounded-xl object-cover border border-[#243041] shadow-md"
                                    />
                                    <div className="flex-1 space-y-1">
                                        <span className="block text-xs font-bold text-white line-clamp-1">
                                            {formTitle || "Phim mới"}
                                        </span>
                                        <span className="text-[10px] text-[#9ba9ba]">
                                            {editingMovie ? `ID #${editingMovie.id}` : "Chưa lưu vào database"}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="m-title">Tên phim *</Label>
                                    <Input
                                        id="m-title"
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m-genre">Thể loại *</Label>
                                        <Input
                                            id="m-genre"
                                            value={formGenre}
                                            onChange={(e) => setFormGenre(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m-duration">Thời lượng (phút) *</Label>
                                        <Input
                                            id="m-duration"
                                            type="number"
                                            min={1}
                                            max={600}
                                            value={formDuration}
                                            onChange={(e) => setFormDuration(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m-rating">Phân loại</Label>
                                        <select
                                            id="m-rating"
                                            value={formRating}
                                            onChange={(e) => setFormRating(e.target.value as MovieRating)}
                                            className="flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] focus:border-[#caef6b] focus:outline-none"
                                        >
                                            <option value="P">P</option>
                                            <option value="T13">T13</option>
                                            <option value="T16">T16</option>
                                            <option value="T18">T18</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m-status">Trạng thái</Label>
                                        <select
                                            id="m-status"
                                            value={formStatus}
                                            onChange={(e) => setFormStatus(e.target.value as MovieStatus)}
                                            className="flex h-10 w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2 text-sm text-[#f4f6f7] focus:border-[#caef6b] focus:outline-none"
                                        >
                                            <option value="now_showing">Đang chiếu</option>
                                            <option value="coming_soon">Sắp chiếu</option>
                                            <option value="ended">Ngừng chiếu</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="m-synopsis">Tóm tắt nội dung</Label>
                                    <Textarea
                                        id="m-synopsis"
                                        rows={3}
                                        value={formSynopsis}
                                        onChange={(e) => setFormSynopsis(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="m-poster">Poster URL (tùy chọn)</Label>
                                    <Input
                                        id="m-poster"
                                        placeholder="/src/assets/... hoặc https://..."
                                        value={formPosterUrl}
                                        onChange={(e) => setFormPosterUrl(e.target.value)}
                                    />
                                </div>

                                {notice && (
                                    <p className="rounded-xl border border-[#2a3c25] bg-[#121f15] px-3 py-2 text-[11px] font-semibold text-[#caef6b]">
                                        {notice}
                                    </p>
                                )}

                                <div className="flex gap-2 pt-2">
                                    {isCreating && (
                                        <button
                                            type="button"
                                            onClick={() => applyMovieToForm(movies[0] || null)}
                                            className="rounded-xl border border-[#243041] px-3 text-xs font-semibold text-[#9ba9ba] hover:text-white"
                                        >
                                            Hủy
                                        </button>
                                    )}
                                    <Button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-1 rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
                                    >
                                        {isSaving ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="size-4 animate-spin" />
                                                Đang lưu...
                                            </span>
                                        ) : (
                                            "Lưu thay đổi"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <p className="mt-6 text-xs text-[#9ba9ba]">
                                Chọn một bộ phim để chỉnh sửa hoặc bấm "Thêm phim mới".
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal xóa phim */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Xác nhận xóa phim"
                    onClick={() => {
                        if (!isDeleting) setDeleteTarget(null)
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-3xl border border-[#682424] bg-[#0b1310] p-5 shadow-2xl sm:p-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-[#1f2c3d] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-[#2d1515] text-[#ff8e8e]">
                                    <AlertTriangle className="size-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Xóa phim?</h2>
                                    <p className="text-[11px] text-[#9ba9ba]">Hành động này không thể hoàn tác.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                aria-label="Đóng"
                                className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#16202c] hover:text-white disabled:opacity-40"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[#243041] bg-[#121923] p-4">
                            <div className="text-sm font-bold text-white">{deleteTarget.title}</div>
                            <div className="mt-1 text-[11px] text-[#9ba9ba]">
                                {deleteTarget.genre} · {deleteTarget.duration_min} phút
                            </div>
                            <div className="mt-2 text-[11px] text-[#d3dce7]">
                                Suất chiếu hiện có: <b>{deleteTarget.showtime_count || 0}</b>
                            </div>
                        </div>

                        {(deleteTarget.showtime_count || 0) > 0 ? (
                            <p className="mt-3 rounded-xl border border-[#5c3e1e] bg-[#2d1e10] px-3 py-2.5 text-[11px] leading-relaxed text-[#ffbd7a]">
                                Phim đang có {deleteTarget.showtime_count} suất chiếu nên không thể xóa. Hãy
                                chuyển trạng thái sang <b>Ngừng chiếu</b> để ẩn phim mà vẫn giữ lịch sử.
                            </p>
                        ) : (
                            <p className="mt-3 text-[11px] leading-relaxed text-[#9ba9ba]">
                                Phim chưa có suất chiếu nào. Xóa sẽ gỡ phim khỏi database vĩnh viễn.
                            </p>
                        )}

                        {deleteError && (
                            <div className="mt-3 rounded-xl border border-[#682424] bg-[#2d1515] px-3 py-2.5 text-[11px] text-[#ffb4b4]">
                                {deleteError}
                            </div>
                        )}

                        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#1f2c3d] pt-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white disabled:opacity-40"
                            >
                                {deleteTarget.showtime_count ? "Đóng" : "Hủy"}
                            </button>
                            {(deleteTarget.showtime_count || 0) === 0 && (
                                <Button
                                    onClick={() => void handleDeleteMovie()}
                                    disabled={isDeleting}
                                    className="h-10 rounded-xl bg-[#d9534f] px-5 text-xs font-bold text-white hover:bg-[#c9302c] disabled:opacity-60"
                                >
                                    {isDeleting ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="size-4 animate-spin" />
                                            Đang xóa...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Trash2 className="size-4" />
                                            Xóa vĩnh viễn
                                        </span>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
