import { useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import {
    Check,
    CreditCard,
    ShieldCheck,
    ChevronLeft,
    Download,
    CheckCircle2,
    Loader2,
    Sparkles,
    Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { NOW_SHOWING_MOVIES } from "@/constants"
import { paymentService, type CheckoutResult } from "@/services/payment.service"

export const CheckoutPage = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const movieTitle = searchParams.get("movie") || "Tín hiệu từ ngày mai"
    const cinemaName = searchParams.get("cinema") || "Cinema Nguyễn Du"
    const showDate = searchParams.get("date") || "Thứ Bảy, 24/10/2026"
    const showTime = searchParams.get("time") || "19:30"
    const roomName = searchParams.get("room") || "Phòng 03"
    const seatsParam = searchParams.get("seats") || "F7, F8 (VIP)"
    const totalParam = searchParams.get("total") || "240000"
    const showtimeId = Number(searchParams.get("showtimeId")) || 1

    // Parse seats thành array (VD: "F7, F8 (VIP)" → ["F7", "F8"])
    const seatsArray = seatsParam
        .replace(/\s*\(.*?\)\s*/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

    const movie =
        NOW_SHOWING_MOVIES.find((m) => m.title === movieTitle) || NOW_SHOWING_MOVIES[0]

    // Lấy user từ localStorage
    const storedUser = localStorage.getItem("user")
    const user = storedUser ? JSON.parse(storedUser) : null

    // Form states
    const [customerName, setCustomerName] = useState(user?.name || "Nguyễn Minh Anh")
    const [customerPhone, setCustomerPhone] = useState(user?.phone || "0912 345 678")
    const [customerEmail, setCustomerEmail] = useState(user?.email || "minhanh.nguyen@email.com")

    // Payment method
    const [paymentMethod, setPaymentMethod] = useState<"momo" | "zalopay" | "card" | "vnpay">("momo")

    // Promo code — kết nối Backend
    const [promoCode, setPromoCode] = useState("")
    const [discount, setDiscount] = useState(0)
    const [promoMessage, setPromoMessage] = useState("")
    const [promoApplied, setPromoApplied] = useState(false)
    const [promoLoading, setPromoLoading] = useState(false)

    // Agree
    const [agreeTerms, setAgreeTerms] = useState(true)

    // Payment states
    const [isProcessing, setIsProcessing] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [bookingResult, setBookingResult] = useState<CheckoutResult | null>(null)
    const [errorMessage, setErrorMessage] = useState("")

    const numTotal = parseInt(totalParam, 10) || 240000
    const finalPrice = Math.max(0, numTotal - discount)

    const formatPrice = (val: number) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val)

    // ── Áp dụng mã giảm giá (gọi Backend) ──────────────────────
    const handleApplyPromo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!promoCode.trim()) return

        setPromoLoading(true)
        setPromoMessage("")

        try {
            const res = await paymentService.validateVoucher(promoCode.trim(), numTotal)

            if (res.success && res.data) {
                setDiscount(res.data.discountAmount)
                setPromoApplied(true)
                setPromoMessage(res.message || `Áp dụng mã ${promoCode} thành công!`)
            } else {
                setDiscount(0)
                setPromoApplied(false)
                setPromoMessage(res.message || "Mã giảm giá không hợp lệ!")
            }
        } catch {
            setPromoMessage("Lỗi kết nối. Vui lòng thử lại!")
        } finally {
            setPromoLoading(false)
        }
    }

    // Simulation state
    const [simulatingPayment, setSimulatingPayment] = useState<boolean>(false)
    const [simulationStep, setSimulationStep] = useState<"gateway" | "processing" | "success">("gateway")

    // ── Thanh toán (gọi Backend) ─────────────────────────────────
    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!agreeTerms) {
            setErrorMessage("Vui lòng đồng ý với điều khoản sử dụng!")
            return
        }

        const effectiveUserId = user?.id || 1
        const cleanSeats = seatsArray.length > 0 ? seatsArray : ["F7", "F8"]

        setIsProcessing(true)
        setErrorMessage("")
        setSimulatingPayment(true)
        setSimulationStep("gateway")

        try {
            // Bước 1: Mô phỏng mở cổng thanh toán (0.8s)
            await new Promise((r) => setTimeout(r, 800))
            setSimulationStep("processing")

            // Bước 2: Gọi API lưu booking vào database
            const res = await paymentService.checkout({
                userId: effectiveUserId,
                showtimeId: showtimeId || 1,
                seats: cleanSeats,
                customerName: customerName.trim() || "Nguyễn Minh Anh",
                customerEmail: customerEmail.trim() || "minhanh.nguyen@email.com",
                customerPhone: customerPhone.trim() || "0912 345 678",
                totalPrice: numTotal,
                discountAmount: discount,
                promoCode: promoApplied ? promoCode.trim().toUpperCase() : undefined,
                paymentMethod,
            })

            // Bước 3: Mô phỏng xác nhận giao dịch thành công (0.8s)
            await new Promise((r) => setTimeout(r, 800))
            setSimulationStep("success")

            await new Promise((r) => setTimeout(r, 600))
            setSimulatingPayment(false)

            if (res.success && res.data) {
                setBookingResult(res.data)
                setIsSuccess(true)

                // Cập nhật points trong localStorage
                const currentUser = user || { id: 1, name: customerName, points: 120 }
                if (res.data.pointsEarned > 0) {
                    const updatedUser = { ...currentUser, points: (currentUser.points || 0) + res.data.pointsEarned }
                    localStorage.setItem("user", JSON.stringify(updatedUser))
                }
            } else {
                setErrorMessage(res.message || "Thanh toán thất bại! Vui lòng thử lại.")
            }
        } catch {
            setSimulatingPayment(false)
            setErrorMessage("Lỗi kết nối máy chủ. Vui lòng thử lại sau!")
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
            {/* 1. Step Indicator Bar */}
            <div className="mb-8 flex items-center justify-between border-b border-[#1f2c3d] pb-6">
                <Link
                    to={`/booking/seats?movie=${encodeURIComponent(movieTitle)}`}
                    className="flex items-center gap-1.5 text-xs text-[#9ba9ba] hover:text-white transition-colors"
                >
                    <ChevronLeft className="size-4" /> Quay lại chọn ghế
                </Link>

                <div className="flex items-center gap-6 sm:gap-10 text-xs font-semibold">
                    <div className="flex items-center gap-2 text-[#caef6b]">
                        <span className="flex size-6 items-center justify-center rounded-full bg-[#162518] border border-[#2a3c25] text-xs">
                            <Check className="size-3.5" />
                        </span>
                        <span className="hidden sm:inline">1. Chọn suất chiếu</span>
                    </div>

                    <div className="flex items-center gap-2 text-[#caef6b]">
                        <span className="flex size-6 items-center justify-center rounded-full bg-[#162518] border border-[#2a3c25] text-xs">
                            <Check className="size-3.5" />
                        </span>
                        <span className="hidden sm:inline">2. Chọn ghế</span>
                    </div>

                    <div className="flex items-center gap-2 text-white">
                        <span className="flex size-6 items-center justify-center rounded-full bg-[#caef6b] text-[#090d14] text-xs font-bold">
                            3
                        </span>
                        <span>3. Thanh toán</span>
                    </div>
                </div>
            </div>

            {/* 2. Header */}
            <div className="mb-8">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#caef6b]">
                    BƯỚC 3/3 · XÁC NHẬN ĐƠN HÀNG
                </span>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Hoàn tất buổi hẹn điện ảnh
                </h1>
                <p className="mt-1 text-sm text-[#9ba9ba]">
                    Kiểm tra thông tin đặt vé và chọn phương thức thanh toán.
                </p>
            </div>

            {/* 3. Main Two-Column Layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left Column: Customer Form & Payment Methods */}
                <div className="space-y-6 lg:col-span-8">
                    {/* Customer info card */}
                    <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <h2 className="text-base font-bold text-white mb-4">Thông tin nhận vé</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="c-name">Họ và tên *</Label>
                                <Input
                                    id="c-name"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="c-phone">Số điện thoại *</Label>
                                <Input
                                    id="c-phone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="mt-4 space-y-1.5">
                            <Label htmlFor="c-email">Email nhận vé điện tử *</Label>
                            <Input
                                id="c-email"
                                type="email"
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                                required
                            />
                            <p className="text-[11px] text-[#9ba9ba] pt-1">
                                Vé điện tử và mã QR sẽ được gửi trực tiếp đến email và số điện thoại trên.
                            </p>
                        </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <h2 className="text-base font-bold text-white mb-4">Phương thức thanh toán</h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {/* MoMo */}
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("momo")}
                                className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${paymentMethod === "momo"
                                        ? "border-[#caef6b] bg-[#162518] shadow-md shadow-[#caef6b]/10"
                                        : "border-[#243041] bg-[#1a2431] hover:border-[#3b4c63]"
                                    }`}
                            >
                                <div className="flex size-9 items-center justify-center rounded-xl bg-[#a50064] text-white font-black text-xs">
                                    MoMo
                                </div>
                                <span className="mt-2 text-xs font-bold text-white">Ví MoMo</span>
                                <span className="text-[10px] text-[#9ba9ba]">Quét mã QR</span>
                            </button>

                            {/* ZaloPay */}
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("zalopay")}
                                className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${paymentMethod === "zalopay"
                                        ? "border-[#caef6b] bg-[#162518] shadow-md shadow-[#caef6b]/10"
                                        : "border-[#243041] bg-[#1a2431] hover:border-[#3b4c63]"
                                    }`}
                            >
                                <div className="flex size-9 items-center justify-center rounded-xl bg-[#0068ff] text-white font-black text-xs">
                                    Zalo
                                </div>
                                <span className="mt-2 text-xs font-bold text-white">ZaloPay</span>
                                <span className="text-[10px] text-[#9ba9ba]">Ví hoặc ngân hàng</span>
                            </button>

                            {/* Bank Card */}
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("card")}
                                className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${paymentMethod === "card"
                                        ? "border-[#caef6b] bg-[#162518] shadow-md shadow-[#caef6b]/10"
                                        : "border-[#243041] bg-[#1a2431] hover:border-[#3b4c63]"
                                    }`}
                            >
                                <div className="flex size-9 items-center justify-center rounded-xl bg-[#243041] text-[#caef6b]">
                                    <CreditCard className="size-5" />
                                </div>
                                <span className="mt-2 text-xs font-bold text-white">Thẻ ngân hàng</span>
                                <span className="text-[10px] text-[#9ba9ba]">ATM / Visa / Master</span>
                            </button>

                            {/* VNPAY */}
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("vnpay")}
                                className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${paymentMethod === "vnpay"
                                        ? "border-[#caef6b] bg-[#162518] shadow-md shadow-[#caef6b]/10"
                                        : "border-[#243041] bg-[#1a2431] hover:border-[#3b4c63]"
                                    }`}
                            >
                                <div className="flex size-9 items-center justify-center rounded-xl bg-[#005ba6] text-white font-black text-[10px]">
                                    VNPAY
                                </div>
                                <span className="mt-2 text-xs font-bold text-white">Cổng VNPAY</span>
                                <span className="text-[10px] text-[#9ba9ba]">VNPAY-QR / Ví</span>
                            </button>
                        </div>
                    </div>

                    {/* Promo Code Box — Kết nối Backend */}
                    <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl">
                        <h2 className="text-base font-bold text-white mb-3">Mã giảm giá / Voucher</h2>
                        <form onSubmit={handleApplyPromo} className="flex gap-2">
                            <Input
                                placeholder="Nhập mã ưu đãi (thử: CMVIP, WELCOME50)"
                                value={promoCode}
                                onChange={(e) => {
                                    setPromoCode(e.target.value)
                                    if (promoApplied) {
                                        setPromoApplied(false)
                                        setDiscount(0)
                                        setPromoMessage("")
                                    }
                                }}
                                className="h-10"
                                disabled={promoLoading}
                            />
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={promoLoading || !promoCode.trim()}
                                className="shrink-0 border-[#2a3c25] bg-[#162518] text-[#caef6b] hover:bg-[#1f3521]"
                            >
                                {promoLoading ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    "Áp dụng"
                                )}
                            </Button>
                        </form>
                        {promoMessage && (
                            <p className={`mt-2 text-xs font-semibold ${promoApplied ? "text-[#caef6b]" : "text-red-400"}`}>
                                {promoApplied ? "✓ " : "✗ "}{promoMessage}
                            </p>
                        )}
                    </div>

                    {/* Terms Agreement & Submit Button */}
                    <div className="rounded-3xl border border-[#1f2c3d] bg-[#121923] p-6 shadow-xl space-y-4">
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#9ba9ba]">
                            <Checkbox checked={agreeTerms} onCheckedChange={setAgreeTerms} />
                            <span>
                                Tôi đã kiểm tra kỹ thông tin đặt vé, đồng ý với điều khoản sử dụng và quy định độ tuổi của phim.
                            </span>
                        </label>

                        {errorMessage && (
                            <p className="text-xs font-semibold text-red-400 bg-red-400/10 rounded-xl px-4 py-2.5">
                                ✗ {errorMessage}
                            </p>
                        )}

                        <Button
                            onClick={handlePaymentSubmit}
                            disabled={!agreeTerms || isProcessing || isSuccess}
                            className="w-full rounded-2xl bg-[#caef6b] py-3 text-base font-black text-[#090d14] hover:bg-[#b8df5b] shadow-xl shadow-[#caef6b]/15 transition-all disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="size-5 animate-spin" />
                                    Đang xử lý thanh toán...
                                </span>
                            ) : isSuccess ? (
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 className="size-5" />
                                    Đã thanh toán thành công!
                                </span>
                            ) : (
                                `Thanh toán ${formatPrice(finalPrice)}`
                            )}
                        </Button>
                    </div>
                </div>

                {/* Right Column: Order Summary */}
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
                                <span className="text-[#9ba9ba]">Phòng</span>
                                <span className="font-semibold text-white">{roomName}</span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Suất chiếu</span>
                                <span className="font-semibold text-white">
                                    {showTime} · {showDate}
                                </span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Ghế đã chọn</span>
                                <span className="font-bold text-[#caef6b]">{seatsParam}</span>
                            </div>
                            <div className="flex justify-between pt-3">
                                <span className="text-[#9ba9ba]">Tạm tính</span>
                                <span className="font-semibold text-white">{formatPrice(numTotal)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between pt-3">
                                    <span className="text-[#caef6b]">Khuyến mãi</span>
                                    <span className="font-semibold text-[#caef6b]">-{formatPrice(discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-3">
                                <span className="text-sm font-bold text-white">Tổng thanh toán</span>
                                <span className="text-lg font-black text-[#caef6b]">
                                    {formatPrice(finalPrice)}
                                </span>
                            </div>
                        </div>

                        {/* Khu vực mô phỏng quét mã QR thanh toán */}
                        <div className="mt-5 rounded-2xl border border-[#243041] bg-[#090d14] p-4 text-center">
                            <div className="mb-2.5 flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-white">Quét mã thanh toán</span>
                                <span className="rounded-full border border-[#2a3c25] bg-[#162518] px-2 py-0.5 text-[10px] font-bold text-[#caef6b]">
                                    {paymentMethod === "momo" && "MoMo QR"}
                                    {paymentMethod === "zalopay" && "ZaloPay QR"}
                                    {paymentMethod === "card" && "VietQR Pro"}
                                    {paymentMethod === "vnpay" && "VNPAY-QR"}
                                </span>
                            </div>

                            {/* QR Code Container */}
                            <div className="relative mx-auto my-1 flex size-36 items-center justify-center rounded-2xl bg-white p-2.5 shadow-md">
                                <svg viewBox="0 0 100 100" className="size-full text-[#090d14]" fill="currentColor">
                                    {/* Top-left marker */}
                                    <rect x="5" y="5" width="26" height="26" rx="4" />
                                    <rect x="9" y="9" width="18" height="18" fill="white" />
                                    <rect x="13" y="13" width="10" height="10" />

                                    {/* Top-right marker */}
                                    <rect x="69" y="5" width="26" height="26" rx="4" />
                                    <rect x="73" y="9" width="18" height="18" fill="white" />
                                    <rect x="77" y="13" width="10" height="10" />

                                    {/* Bottom-left marker */}
                                    <rect x="5" y="69" width="26" height="26" rx="4" />
                                    <rect x="9" y="73" width="18" height="18" fill="white" />
                                    <rect x="13" y="77" width="10" height="10" />

                                    {/* Data pattern */}
                                    <rect x="36" y="10" width="8" height="8" />
                                    <rect x="48" y="10" width="14" height="8" />
                                    <rect x="36" y="24" width="20" height="8" />
                                    <rect x="10" y="36" width="8" height="16" />
                                    <rect x="22" y="38" width="14" height="14" />
                                    <rect x="42" y="38" width="16" height="16" rx="3" fill={paymentMethod === "momo" ? "#a50064" : paymentMethod === "zalopay" ? "#0068ff" : paymentMethod === "vnpay" ? "#005ba6" : "#090d14"} />
                                    <rect x="64" y="36" width="26" height="8" />
                                    <rect x="64" y="48" width="12" height="12" />
                                    <rect x="80" y="48" width="10" height="24" />
                                    <rect x="36" y="60" width="22" height="12" />
                                    <rect x="36" y="78" width="12" height="14" />
                                    <rect x="52" y="78" width="24" height="14" />
                                </svg>

                                {/* Center logo badge */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className={`size-7 rounded-lg border-2 border-white flex items-center justify-center text-white text-[9px] font-black shadow-md ${
                                        paymentMethod === "momo" ? "bg-[#a50064]" : paymentMethod === "zalopay" ? "bg-[#0068ff]" : paymentMethod === "vnpay" ? "bg-[#005ba6]" : "bg-[#090d14]"
                                    }`}>
                                        {paymentMethod === "momo" ? "M" : paymentMethod === "zalopay" ? "Z" : paymentMethod === "vnpay" ? "V" : "QR"}
                                    </div>
                                </div>
                            </div>

                            <p className="mt-2 text-[11px] font-semibold text-[#caef6b]">
                                {formatPrice(finalPrice)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#9ba9ba]">
                                Mở ứng dụng ngân hàng hoặc ví để quét mã mô phỏng thanh toán
                            </p>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[#2a3c25] bg-[#121f15] p-3 text-center text-xs text-[#caef6b]">
                            <ShieldCheck className="mx-auto mb-1 size-4" />
                            Giao dịch được mã hóa an toàn 256-bit SSL
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Success Card — Hiển thị khi thanh toán thành công */}
            {isSuccess && bookingResult && (
                <div className="mt-14 overflow-hidden rounded-3xl border border-[#2a3c25] bg-[#121f15] p-6 sm:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="size-6 text-[#caef6b]" />
                                <h3 className="text-xl font-black text-white">Vé đã sẵn sàng!</h3>
                            </div>
                            <p className="text-xs text-[#9ba9ba]">
                                Chúc mừng bạn đã hoàn tất đặt vé. Mã vé điện tử đã được kích hoạt.
                            </p>
                            <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#9ba9ba]">
                                <span>Phim: <strong className="text-white">{movie.title}</strong></span>
                                <span>Rạp: <strong className="text-white">{cinemaName} ({roomName})</strong></span>
                                <span>Suất: <strong className="text-white">{showTime} · {showDate}</strong></span>
                                <span>Ghế: <strong className="text-[#caef6b]">{seatsParam}</strong></span>
                                <span>Mã vé: <strong className="font-mono text-[#caef6b]">{bookingResult.bookingCode}</strong></span>
                            </div>

                            {/* Thông tin bổ sung */}
                            <div className="pt-3 flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-1.5 rounded-xl border border-[#2a3c25] bg-[#162518] px-3 py-1.5 text-xs">
                                    <Sparkles className="size-3.5 text-[#caef6b]" />
                                    <span className="text-[#caef6b] font-semibold">+{bookingResult.pointsEarned} điểm tích lũy</span>
                                </div>
                                {bookingResult.discountAmount > 0 && (
                                    <div className="flex items-center gap-1.5 rounded-xl border border-[#243041] bg-[#1a2431] px-3 py-1.5 text-xs">
                                        <Star className="size-3.5 text-amber-400" />
                                        <span className="text-white font-semibold">Đã giảm {formatPrice(bookingResult.discountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 rounded-xl border border-[#243041] bg-[#1a2431] px-3 py-1.5 text-xs">
                                    <span className="text-white font-semibold">Thanh toán: {formatPrice(bookingResult.finalPrice)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <Button
                                onClick={() => {
                                    // Tạo dữ liệu vé text để download
                                    const ticketText = `
═══════════════════════════════════════
         CINEMA MANAGEMENT — VÉ ĐIỆN TỬ
═══════════════════════════════════════
Mã vé: ${bookingResult.bookingCode}
Phim: ${movie.title}
Rạp: ${cinemaName} (${roomName})
Suất: ${showTime} · ${showDate}
Ghế: ${seatsParam}
Tổng: ${formatPrice(bookingResult.finalPrice)}
QR Check-in: ${bookingResult.qrCode}
═══════════════════════════════════════
Quét mã QR tại quầy trước giờ chiếu 15p.
`.trim()
                                    const blob = new Blob([ticketText], { type: "text/plain" })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement("a")
                                    a.href = url
                                    a.download = `ve-${bookingResult.bookingCode}.txt`
                                    a.click()
                                    URL.revokeObjectURL(url)
                                }}
                                variant="outline"
                                className="rounded-xl border-[#2a3c25] bg-[#162518] text-xs font-bold text-[#caef6b] hover:bg-[#1e3321]"
                            >
                                <Download className="mr-1.5 size-4" />
                                Lưu vé
                            </Button>
                            <Button
                                onClick={() => navigate("/my-tickets")}
                                className="rounded-xl bg-[#caef6b] text-xs font-bold text-[#090d14] hover:bg-[#b8df5b]"
                            >
                                Xem vé của tôi
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Online Payment Simulation Modal Overlay */}
            {simulatingPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-md rounded-3xl border border-[#243041] bg-[#121923] p-7 shadow-2xl text-center space-y-5">
                        {/* Gateway Branding */}
                        <div className="flex items-center justify-center gap-3">
                            {paymentMethod === "momo" && (
                                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#a50064] text-white font-black text-xl shadow-lg shadow-[#a50064]/30">
                                    M
                                </div>
                            )}
                            {paymentMethod === "zalopay" && (
                                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0068ff] text-white font-black text-xl shadow-lg shadow-[#0068ff]/30">
                                    Z
                                </div>
                            )}
                            {paymentMethod === "card" && (
                                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#1f2c3d] text-[#caef6b] shadow-lg">
                                    <CreditCard className="size-6" />
                                </div>
                            )}
                            {paymentMethod === "vnpay" && (
                                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#005ba6] text-white font-black text-sm shadow-lg shadow-[#005ba6]/30">
                                    VNPAY
                                </div>
                            )}
                            <div className="text-left">
                                <h4 className="text-base font-bold text-white">
                                    {paymentMethod === "momo" && "Cổng thanh toán Ví MoMo"}
                                    {paymentMethod === "zalopay" && "Cổng thanh toán ZaloPay"}
                                    {paymentMethod === "card" && "Cổng thanh toán Thẻ OnePay"}
                                    {paymentMethod === "vnpay" && "Cổng thanh toán VNPAY-QR"}
                                </h4>
                                <p className="text-[11px] text-[#9ba9ba]">Mô phỏng giao dịch trực tuyến an toàn</p>
                            </div>
                        </div>

                        {/* Amount */}
                        <div className="rounded-2xl border border-[#1f2c3d] bg-[#090d14] p-4">
                            <span className="text-[11px] text-[#9ba9ba]">Số tiền thanh toán:</span>
                            <p className="text-2xl font-black text-[#caef6b] mt-0.5">
                                {formatPrice(finalPrice)}
                            </p>
                            <p className="text-[10px] text-[#9ba9ba] mt-1">
                                Vé: {movie.title} · {seatsParam}
                            </p>
                        </div>

                        {/* Status animation */}
                        <div className="py-2 flex flex-col items-center gap-3">
                            {simulationStep === "gateway" && (
                                <>
                                    <Loader2 className="size-8 text-[#caef6b] animate-spin" />
                                    <p className="text-sm font-semibold text-white">
                                        Đang kết nối cổng thanh toán...
                                    </p>
                                    <span className="text-xs text-[#9ba9ba]">
                                        Khởi tạo phiên mã hóa 256-bit
                                    </span>
                                </>
                            )}
                            {simulationStep === "processing" && (
                                <>
                                    <div className="relative flex items-center justify-center">
                                        <div className="size-10 rounded-full border-2 border-[#caef6b]/30 animate-ping absolute" />
                                        <Loader2 className="size-8 text-[#caef6b] animate-spin" />
                                    </div>
                                    <p className="text-sm font-semibold text-white">
                                        Đang xác thực và trừ tiền...
                                    </p>
                                    <span className="text-xs text-[#caef6b]">
                                        Lưu vé vào cơ sở dữ liệu Cinema Management
                                    </span>
                                </>
                            )}
                            {simulationStep === "success" && (
                                <>
                                    <CheckCircle2 className="size-10 text-[#caef6b] animate-bounce" />
                                    <p className="text-sm font-bold text-[#caef6b]">
                                        Giao dịch thành công!
                                    </p>
                                    <span className="text-xs text-[#9ba9ba]">
                                        Đang xuất mã QR và hoàn tất đặt vé...
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
