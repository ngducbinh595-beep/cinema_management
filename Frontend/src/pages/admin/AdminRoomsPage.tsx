import { useCallback, useEffect, useState } from "react"
import {
    Plus,
    Settings2,
    Loader2,
    AlertCircle,
    AlertTriangle,
    Power,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AddRoomModal } from "@/components/admin/AddRoomModal"
import { roomService, type AdminRoom } from "@/services/room.service"
import { pricingService, type PricingTier } from "@/services/pricing.service"

const formatVND = (value: number) =>
    `${new Intl.NumberFormat("vi-VN").format(value)} đ`

export const AdminRoomsPage = () => {
    const [rooms, setRooms] = useState<AdminRoom[]>([])
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [statusTarget, setStatusTarget] = useState<AdminRoom | null>(null)
    const [isStatusUpdating, setIsStatusUpdating] = useState(false)

    // Form cấu hình
    const [roomName, setRoomName] = useState("")
    const [formRows, setFormRows] = useState("8")
    const [formCols, setFormCols] = useState("14")
    const [formFormat, setFormFormat] = useState("2D")
    const [formAudio, setFormAudio] = useState("Dolby Atmos")
    const [formVipRows, setFormVipRows] = useState("F,G")
    const [formTotalSeats, setFormTotalSeats] = useState("120")
    const [formRegularCount, setFormRegularCount] = useState("80")
    const [formVipCount, setFormVipCount] = useState("40")

    const applyRoomToForm = (room: AdminRoom) => {
        setSelectedId(room.id)
        setRoomName(room.name)
        setFormRows(String(room.rows_count))
        setFormCols(String(room.cols_count))
        setFormFormat(room.format)
        setFormAudio(room.audio)
        setFormVipRows(room.vip_rows || "")
        setFormTotalSeats(String(room.total_seats))
        setFormRegularCount(String(room.regular_count))
        setFormVipCount(String(room.vip_count))
        setNotice(null)
    }

    const loadRooms = useCallback(async (keepId?: number | null) => {
        setIsLoading(true)
        setError(null)

        const res = await roomService.getRooms(1)
        if (res.success && res.data) {
            setRooms(res.data)
            const target =
                (keepId ? res.data.find((room) => room.id === keepId) : undefined) ||
                res.data[0]
            if (target) applyRoomToForm(target)
        } else {
            setError(res.message || "Không tải được danh sách phòng từ database.")
        }

        setIsLoading(false)
    }, [])

    useEffect(() => {
        void loadRooms(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Bảng giá vé (lưu database) ─────────────────────────────
    const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([])
    const [isPricingLoading, setIsPricingLoading] = useState(true)
    const [pricingError, setPricingError] = useState<string | null>(null)
    const [pricingNotice, setPricingNotice] = useState<string | null>(null)
    const [editingTierId, setEditingTierId] = useState<number | null>(null)
    const [tierRegular, setTierRegular] = useState("")
    const [tierVip, setTierVip] = useState("")
    const [tierApplyShowtimes, setTierApplyShowtimes] = useState(true)
    const [isTierSaving, setIsTierSaving] = useState(false)

    const loadPricing = useCallback(async () => {
        setIsPricingLoading(true)
        const res = await pricingService.getTiers(1)
        if (res.success && res.data) {
            setPricingTiers(res.data)
            setPricingError(null)
        } else {
            setPricingError(res.message || "Không tải được bảng giá vé từ database.")
        }
        setIsPricingLoading(false)
    }, [])

    useEffect(() => {
        void loadPricing()
    }, [loadPricing])

    const startEditTier = (tier: PricingTier) => {
        setEditingTierId(tier.id)
        setTierRegular(String(tier.regularPrice))
        setTierVip(String(tier.vipPrice))
        setTierApplyShowtimes(tier.canApplyToShowtimes)
        setPricingError(null)
        setPricingNotice(null)
    }

    const cancelEditTier = () => {
        setEditingTierId(null)
        setPricingError(null)
    }

    const handleSaveTier = async (tier: PricingTier) => {
        const regular = Number(tierRegular)
        const vip = Number(tierVip)
        if (!Number.isInteger(regular) || !Number.isInteger(vip) || regular < 10000 || vip < 10000) {
            setPricingError("Giá vé phải là số nguyên, tối thiểu 10.000 đ.")
            return
        }
        if (vip < regular) {
            setPricingError("Giá ghế VIP không được thấp hơn giá ghế thường.")
            return
        }

        setIsTierSaving(true)
        setPricingError(null)
        const res = await pricingService.updateTier(tier.id, {
            regularPrice: regular,
            vipPrice: vip,
            applyToShowtimes: tier.canApplyToShowtimes && tierApplyShowtimes,
        })
        setIsTierSaving(false)

        if (res.success) {
            setEditingTierId(null)
            setPricingNotice(res.message || "Đã cập nhật bảng giá vé.")
            await loadPricing()
        } else {
            setPricingError(res.message || "Không thể cập nhật giá vé. Vui lòng thử lại.")
        }
    }

    const selectedRoom = rooms.find((room) => room.id === selectedId) || null

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedId) return

        if (!roomName.trim()) {
            setError("Tên phòng không được để trống.")
            return
        }

        setIsSaving(true)
        setError(null)
        setNotice(null)

        const res = await roomService.updateRoom(selectedId, {
            name: roomName.trim(),
            rowsCount: Number(formRows) || 8,
            colsCount: Number(formCols) || 14,
            format: formFormat.trim() || "2D",
            audio: formAudio.trim() || "Dolby Atmos",
            vipRows: formVipRows.trim(),
            totalSeats: Number(formTotalSeats) || 100,
            regularCount: Number(formRegularCount) || 0,
            vipCount: Number(formVipCount) || 0,
        })

        setIsSaving(false)

        if (res.success) {
            await loadRooms(selectedId)
            setNotice(res.message || "Đã lưu cấu hình phòng.")
        } else {
            setError(res.message || "Không thể lưu cấu hình phòng.")
        }
    }

    const handleChangeStatus = async (room: AdminRoom, status: "active" | "maintenance") => {
        setIsStatusUpdating(true)
        setError(null)
        setNotice(null)

        const res = await roomService.setStatus(room.id, status)
        setIsStatusUpdating(false)

        if (res.success) {
            setStatusTarget(null)
            await loadRooms(room.id)
            setNotice(res.message || "Đã cập nhật trạng thái phòng.")
        } else {
            setError(res.message || "Không thể đổi trạng thái phòng.")
            setStatusTarget(null)
        }
    }

    const totalSeats = rooms.reduce((sum, room) => sum + room.total_seats, 0)
    const totalRegular = rooms.reduce((sum, room) => sum + room.regular_count, 0)
    const totalVip = rooms.reduce((sum, room) => sum + room.vip_count, 0)

    const rowsCount = Number(formRows) || 8
    const colsCount = Number(formCols) || 14
    const vipRowLetters = formVipRows
        .split(",")
        .map((row) => row.trim().toUpperCase())
        .filter(Boolean)
    const rowLabels = Array.from({ length: Math.min(rowsCount, 20) }, (_, index) =>
        String.fromCharCode(65 + index)
    )

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                        HẠ TẦNG & CHÍNH SÁCH VÉ
                    </span>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
                        Phòng chiếu, ghế ngồi & giá vé
                    </h1>
                    <p className="mt-1 text-xs text-[#9ba9ba]">
                        {rooms.length} phòng · {totalSeats} ghế · {totalRegular} ghế thường ·{" "}
                        {totalVip} ghế VIP
                    </p>
                </div>

                <Button
                    onClick={() => setIsAddOpen(true)}
                    className="rounded-xl bg-[#caef6b] px-4 py-2 text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                >
                    <Plus className="mr-1.5 size-4" />
                    Thêm phòng chiếu
                </Button>
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

            {/* Three columns */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Room list */}
                <div className="space-y-3 lg:col-span-3">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#9ba9ba]">
                        Danh sách phòng
                    </h2>

                    {isLoading && rooms.length === 0 && (
                        <div className="rounded-2xl border border-[#1f2c3d] bg-[#121923] p-6 text-center text-xs text-[#9ba9ba]">
                            <Loader2 className="mx-auto mb-2 size-4 animate-spin text-[#caef6b]" />
                            Đang tải phòng...
                        </div>
                    )}

                    {rooms.map((room) => {
                        const isSelected = room.id === selectedId
                        const isMaintenance = room.status === "maintenance"
                        return (
                            <div
                                key={room.id}
                                onClick={() => applyRoomToForm(room)}
                                className={`cursor-pointer rounded-2xl border p-4 transition-all ${isSelected
                                    ? "border-[#caef6b] bg-[#162518] shadow-md shadow-[#caef6b]/10"
                                    : "border-[#1f2c3d] bg-[#121923] hover:border-[#2f4057]"
                                    } ${isMaintenance ? "opacity-70" : ""}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-white">{room.name}</span>
                                    <div className="flex items-center gap-1">
                                        <Badge className="border-[#2a3c25] bg-[#090d14] text-[9px] text-[#caef6b]">
                                            {room.format}
                                        </Badge>
                                        {isMaintenance && (
                                            <Badge className="border-[#5c3e1e] bg-[#2d1e10] text-[9px] text-[#ffbd7a]">
                                                Bảo trì
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-1 text-[11px] text-[#9ba9ba]">
                                    {room.total_seats} ghế · {room.audio}
                                </div>
                                <div className="mt-1 text-[10px] text-[#9ba9ba]">
                                    {room.active_showtimes} suất chiếu · ID #{room.id}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Seat map */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-5">
                    <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                        <h3 className="text-sm font-bold text-white">
                            Sơ đồ ghế — {selectedRoom?.name || "—"}
                        </h3>
                        <span className="text-[11px] font-semibold text-[#caef6b]">
                            {rowsCount * colsCount} ghế hiển thị
                        </span>
                    </div>

                    <div className="mx-auto my-8 max-w-sm text-center">
                        <div className="relative h-3 w-full overflow-hidden">
                            <div className="h-8 w-full rounded-[100%] border-t-2 border-[#caef6b]" />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#9ba9ba]">
                            MÀN HÌNH
                        </span>
                    </div>

                    <div className="overflow-x-auto pb-4">
                        <div className="flex min-w-[340px] flex-col items-center gap-1.5">
                            {rowLabels.map((row) => {
                                const isVip = vipRowLetters.includes(row)
                                return (
                                    <div key={row} className="flex items-center gap-1.5">
                                        <span className="w-4 text-[10px] font-bold text-[#9ba9ba]">{row}</span>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(colsCount, 20) }, (_, i) => i + 1).map((col) => {
                                                const isAisle = col === 4 || col === 10
                                                return (
                                                    <div
                                                        key={col}
                                                        className={`flex size-4 items-center justify-center rounded text-[8px] font-bold sm:size-5 ${isAisle ? "mr-1.5" : ""
                                                            } ${isVip
                                                                ? "border border-[#2a3c25] bg-[#1a2f1c] text-[#caef6b]"
                                                                : "border border-[#243041] bg-[#16202c] text-[#9ba9ba]"
                                                            }`}
                                                    >
                                                        {col}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-6 border-t border-[#1f2c3d] pt-4 text-[11px] text-[#9ba9ba]">
                        <div className="flex items-center gap-1.5">
                            <div className="size-3 rounded border border-[#243041] bg-[#16202c]" />
                            <span>Ghế thường</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="size-3 rounded border border-[#2a3c25] bg-[#1a2f1c]" />
                            <span>Ghế VIP ({vipRowLetters.join(", ") || "—"})</span>
                        </div>
                    </div>
                </div>

                {/* Config form */}
                <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl lg:col-span-4">
                    <div className="flex items-center gap-2 border-b border-[#1f2c3d] pb-4">
                        <Settings2 className="size-4 text-[#caef6b]" />
                        <h3 className="text-base font-bold text-white">Cấu hình phòng</h3>
                    </div>

                    {selectedRoom ? (
                        <form onSubmit={handleSaveConfig} className="mt-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="r-name">Tên phòng *</Label>
                                <Input
                                    id="r-name"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="r-rows">Số hàng</Label>
                                    <Input
                                        id="r-rows"
                                        type="number"
                                        min={1}
                                        value={formRows}
                                        onChange={(e) => setFormRows(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="r-cols">Ghế/hàng</Label>
                                    <Input
                                        id="r-cols"
                                        type="number"
                                        min={1}
                                        value={formCols}
                                        onChange={(e) => setFormCols(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="r-format">Định dạng</Label>
                                    <Input
                                        id="r-format"
                                        value={formFormat}
                                        onChange={(e) => setFormFormat(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="r-audio">Âm thanh</Label>
                                    <Input
                                        id="r-audio"
                                        value={formAudio}
                                        onChange={(e) => setFormAudio(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="r-total">Tổng ghế</Label>
                                    <Input
                                        id="r-total"
                                        type="number"
                                        value={formTotalSeats}
                                        onChange={(e) => setFormTotalSeats(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="r-regular">Thường</Label>
                                    <Input
                                        id="r-regular"
                                        type="number"
                                        value={formRegularCount}
                                        onChange={(e) => setFormRegularCount(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="r-vip-count">VIP</Label>
                                    <Input
                                        id="r-vip-count"
                                        type="number"
                                        value={formVipCount}
                                        onChange={(e) => setFormVipCount(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="r-vip">Hàng ghế VIP</Label>
                                <Input
                                    id="r-vip"
                                    value={formVipRows}
                                    onChange={(e) => setFormVipRows(e.target.value)}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="mt-4 w-full rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
                            >
                                {isSaving ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="size-4 animate-spin" />
                                        Đang lưu...
                                    </span>
                                ) : (
                                    "Lưu cấu hình"
                                )}
                            </Button>

                            {selectedRoom.status === "maintenance" ? (
                                <button
                                    type="button"
                                    onClick={() => void handleChangeStatus(selectedRoom, "active")}
                                    disabled={isStatusUpdating}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2a3c25] bg-[#162518] px-4 py-2.5 text-xs font-bold text-[#caef6b] transition-colors hover:bg-[#1c301f] disabled:opacity-50"
                                >
                                    <Power className="size-4" />
                                    Mở lại phòng chiếu
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setStatusTarget(selectedRoom)}
                                    disabled={isStatusUpdating}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-4 py-2.5 text-xs font-bold text-[#ff8e8e] transition-colors hover:bg-[#3a1a1a] disabled:opacity-50"
                                >
                                    <Power className="size-4" />
                                    Ngừng phòng chiếu
                                </button>
                            )}
                            <p className="text-center text-[10px] text-[#9ba9ba]">
                                Ngừng phòng sẽ hủy các suất chiếu tương lai của phòng này.
                            </p>
                        </form>
                    ) : (
                        <p className="mt-6 text-xs text-[#9ba9ba]">Chọn một phòng để cấu hình.</p>
                    )}
                </div>
            </div>

            {/* Pricing table — chỉnh sửa được, lưu vào database */}
            <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#1f2c3d] pb-4">
                    <div>
                        <h3 className="text-base font-bold text-white">Bảng giá vé áp dụng</h3>
                        <p className="text-xs text-[#9ba9ba]">
                            Giá theo khung giờ · Đơn vị tiền tệ: VNĐ · Bấm "Sửa" để thay đổi giá
                        </p>
                    </div>
                </div>

                {pricingError && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#682424] bg-[#2d1515] px-3 py-2 text-[11px] font-semibold text-[#ffb4b4]">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        {pricingError}
                    </p>
                )}
                {pricingNotice && (
                    <p className="mt-4 rounded-xl border border-[#2a3c25] bg-[#121f15] px-3 py-2 text-[11px] font-semibold text-[#caef6b]">
                        {pricingNotice}
                    </p>
                )}

                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-[#1f2c3d] text-[11px] font-bold uppercase text-[#9ba9ba]">
                            <tr>
                                <th className="px-4 py-3">Khung giờ</th>
                                <th className="px-4 py-3">Ghế thường</th>
                                <th className="px-4 py-3">Ghế VIP</th>
                                <th className="px-4 py-3">Áp dụng</th>
                                <th className="px-4 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1f2c3d]/60">
                            {isPricingLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-[#9ba9ba]">
                                        <Loader2 className="mx-auto size-4 animate-spin" />
                                    </td>
                                </tr>
                            ) : pricingTiers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-[#9ba9ba]">
                                        Chưa có bảng giá trong database.
                                    </td>
                                </tr>
                            ) : (
                                pricingTiers.map((tier) => {
                                    const isEditing = editingTierId === tier.id
                                    return (
                                        <tr key={tier.id} className="align-top hover:bg-[#16202c]">
                                            <td className="px-4 py-3.5 font-semibold text-white">{tier.timeSlot}</td>
                                            <td className="px-4 py-3.5 font-mono text-[#caef6b]">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        min={10000}
                                                        step={1000}
                                                        value={tierRegular}
                                                        onChange={(e) => setTierRegular(e.target.value)}
                                                        className="h-9 w-32"
                                                        aria-label="Giá ghế thường"
                                                    />
                                                ) : (
                                                    formatVND(tier.regularPrice)
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-[#caef6b]">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        min={10000}
                                                        step={1000}
                                                        value={tierVip}
                                                        onChange={(e) => setTierVip(e.target.value)}
                                                        className="h-9 w-32"
                                                        aria-label="Giá ghế VIP"
                                                    />
                                                ) : (
                                                    formatVND(tier.vipPrice)
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-[#9ba9ba]">
                                                {tier.applyDays}
                                                {isEditing && (
                                                    tier.canApplyToShowtimes ? (
                                                        <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] text-[#d3dce7]">
                                                            <input
                                                                type="checkbox"
                                                                checked={tierApplyShowtimes}
                                                                onChange={(e) => setTierApplyShowtimes(e.target.checked)}
                                                                className="mt-0.5 accent-[#caef6b]"
                                                            />
                                                            <span>Áp dụng luôn cho các suất chiếu sắp tới thuộc khung giờ này</span>
                                                        </label>
                                                    ) : (
                                                        <p className="mt-2 text-[10px] text-[#9ba9ba]">
                                                            Ngày lễ không tự áp xuống suất chiếu — chỉnh giá từng suất khi lên lịch.
                                                        </p>
                                                    )
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={cancelEditTier}
                                                            disabled={isTierSaving}
                                                            className="rounded-lg border border-[#243041] px-3 py-1.5 text-[11px] font-semibold text-[#9ba9ba] hover:text-white disabled:opacity-50"
                                                        >
                                                            Hủy
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleSaveTier(tier)}
                                                            disabled={isTierSaving}
                                                            className="rounded-lg bg-[#caef6b] px-3 py-1.5 text-[11px] font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
                                                        >
                                                            {isTierSaving ? "Đang lưu..." : "Lưu"}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditTier(tier)}
                                                        className="rounded-lg border border-[#243041] px-3 py-1.5 text-[11px] font-semibold text-[#caef6b] hover:bg-[#162518]"
                                                    >
                                                        Sửa
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal thêm phòng */}
            {isAddOpen && (
                <AddRoomModal
                    onClose={() => setIsAddOpen(false)}
                    onCreated={async (room) => {
                        setIsAddOpen(false)
                        await loadRooms(room.id)
                        setNotice(`Đã thêm ${room.name} vào database.`)
                    }}
                />
            )}

            {/* Modal xác nhận ngừng phòng */}
            {statusTarget && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Xác nhận ngừng phòng chiếu"
                    onClick={() => {
                        if (!isStatusUpdating) setStatusTarget(null)
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
                                    <h2 className="text-base font-bold text-white">Ngừng phòng chiếu?</h2>
                                    <p className="text-[11px] text-[#9ba9ba]">
                                        {statusTarget.name} sẽ chuyển sang trạng thái Bảo trì.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStatusTarget(null)}
                                disabled={isStatusUpdating}
                                aria-label="Đóng"
                                className="rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#16202c] hover:text-white disabled:opacity-40"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <p className="mt-4 text-[11px] leading-relaxed text-[#ffbd7a]">
                            Các suất chiếu <b>tương lai</b> của phòng sẽ bị hủy tự động. Lịch sử vé và
                            doanh thu đã ghi nhận vẫn được giữ nguyên.
                        </p>

                        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#1f2c3d] pt-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setStatusTarget(null)}
                                disabled={isStatusUpdating}
                                className="rounded-xl border border-[#243041] px-4 py-2.5 text-xs font-semibold text-[#9ba9ba] transition-colors hover:text-white disabled:opacity-40"
                            >
                                Hủy
                            </button>
                            <Button
                                onClick={() => void handleChangeStatus(statusTarget, "maintenance")}
                                disabled={isStatusUpdating}
                                className="h-10 rounded-xl bg-[#d9534f] px-5 text-xs font-bold text-white hover:bg-[#c9302c] disabled:opacity-60"
                            >
                                {isStatusUpdating ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="size-4 animate-spin" />
                                        Đang cập nhật...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Power className="size-4" />
                                        Ngừng phòng
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
