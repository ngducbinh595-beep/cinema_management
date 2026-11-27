import { buildTicketQRPayload, generateQRMatrix } from "./qrcode"

export interface TicketPdfData {
  bookingCode: string
  movieTitle: string
  movieRating?: string
  movieGenre?: string
  movieDuration?: string | number
  posterUrl?: string | null
  cinemaName: string
  cinemaAddress?: string
  cinemaPhone?: string
  roomName: string
  showtime: string
  showDate: string
  seats: string
  format?: string
  totalPriceText: string
  discountAmount?: number
  paymentMethod?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  status?: "upcoming" | "completed" | "cancelled" | string
  qrCode?: string | null
  createdAt?: string
}

interface CinemaLocationMeta {
  address: string
  phone: string
}

const CINEMA_DIRECTORY: Record<string, CinemaLocationMeta> = {
  "cinema nguyễn du": {
    address: "135 Nguyễn Du, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
    phone: "028 3825 1234",
  },
  "cinema thảo điền": {
    address: "Masteri Thảo Điền, 159 Xa Lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh",
    phone: "028 3744 5678",
  },
  "cinema landmark 81": {
    address: "Tầng 4, Vincom Center Landmark 81, Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh",
    phone: "028 3512 9000",
  },
  "cinema ba tháng hai": {
    address: "750 Ba Tháng Hai, Phường 11, Quận 10, TP. Hồ Chí Minh",
    phone: "028 3853 4321",
  },
}

/**
 * Tra cứu địa chỉ đầy đủ & số điện thoại của rạp (ưu tiên dữ liệu từ DB, dự phòng danh bạ chuẩn).
 */
export function resolveCinemaLocation(
  cinemaName: string,
  explicitAddress?: string | null,
  explicitPhone?: string | null
): CinemaLocationMeta {
  const key = (cinemaName || "").trim().toLowerCase()
  const matched =
    CINEMA_DIRECTORY[key] ||
    Object.entries(CINEMA_DIRECTORY).find(([k]) => key.includes(k) || k.includes(key))?.[1] || {
      address: "135 Nguyễn Du, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
      phone: "028 3825 1234",
    }

  return {
    address: explicitAddress && explicitAddress.trim().length > 5 ? explicitAddress.trim() : matched.address,
    phone: explicitPhone && explicitPhone.trim().length > 5 ? explicitPhone.trim() : matched.phone,
  }
}

function formatPaymentMethodLabel(method?: string): string {
  switch ((method || "").toLowerCase()) {
    case "momo":
      return "Ví điện tử MoMo (Đã thanh toán)"
    case "zalopay":
      return "Ví điện tử ZaloPay (Đã thanh toán)"
    case "vnpay":
      return "Cổng thanh toán VNPAY-QR (Đã thanh toán)"
    case "card":
      return "Thẻ ngân hàng nội địa / Quốc tế"
    default:
      return "Thanh toán trực tuyến (Đã xác nhận)"
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = (text || "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]

  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = words[i]
      if (lines.length === maxLines - 1) {
        for (let j = i + 1; j < words.length; j++) {
          const nextTry = `${current} ${words[j]}`
          if (ctx.measureText(`${nextTry}…`).width <= maxWidth) {
            current = nextTry
          } else {
            current = `${current}…`
            break
          }
        }
        break
      }
    }
  }
  lines.push(current)
  return lines.slice(0, maxLines)
}

function loadImageSafe(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    const timer = window.setTimeout(() => resolve(null), 1800)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = src
  })
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || ""
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Đóng gói ảnh JPEG độ phân giải cao thành tài liệu PDF 1.4 chuẩn quốc tế (A4 Portrait: 595.28 x 841.89 pt).
 */
function buildPdfFromJpegBytes(
  jpegBytes: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
  docTitle: string
): Uint8Array {
  const pageWidthPt = 595.28
  const pageHeightPt = 841.89
  const encoder = new TextEncoder()

  const chunks: Uint8Array[] = []
  const offsets: number[] = [0]
  let currentLength = 0

  const appendBytes = (arr: Uint8Array) => {
    chunks.push(arr)
    currentLength += arr.length
  }

  const appendAscii = (str: string) => {
    appendBytes(encoder.encode(str))
  }

  // Header nhị phân PDF 1.4
  appendBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  // Object 1: Catalog
  offsets.push(currentLength)
  appendAscii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

  // Object 2: Pages
  offsets.push(currentLength)
  appendAscii("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")

  // Object 3: Page A4
  offsets.push(currentLength)
  appendAscii(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  )

  // Object 4: Image XObject (DCTDecode JPEG)
  offsets.push(currentLength)
  appendAscii(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  )
  appendBytes(jpegBytes)
  appendAscii("\nendstream\nendobj\n")

  // Object 5: Page Content Stream
  const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`
  const contentBytes = encoder.encode(contentStream)
  offsets.push(currentLength)
  appendAscii(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`)
  appendBytes(contentBytes)
  appendAscii("endstream\nendobj\n")

  // Object 6: Document Info
  const safeTitle = docTitle.replace(/[()\\]/g, "")
  offsets.push(currentLength)
  appendAscii(
    `6 0 obj\n<< /Title (${safeTitle}) /Producer (Cinema Management E-Ticket Engine) /Creator (Cinema Management) >>\nendobj\n`
  )

  // Bảng tham chiếu chéo xref chính xác từng byte
  const xrefOffset = currentLength
  const totalObjects = offsets.length
  let xrefTable = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`
  for (let i = 1; i < totalObjects; i++) {
    xrefTable += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  }
  appendAscii(xrefTable)
  appendAscii(
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  )

  const output = new Uint8Array(currentLength)
  let pos = 0
  for (const chunk of chunks) {
    output.set(chunk, pos)
    pos += chunk.length
  }
  return output
}

/**
 * Thiết kế, căn chỉnh bố cục vé điện tử (kèm QR Code thật & địa chỉ rạp) và tải xuống file .pdf
 */
export async function exportTicketToPdf(ticket: TicketPdfData): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {})
  }

  const posterImg = await loadImageSafe(ticket.posterUrl)
  const location = resolveCinemaLocation(
    ticket.cinemaName,
    ticket.cinemaAddress,
    ticket.cinemaPhone
  )

  // Kích thước A4 ở mật độ cao (1600 x 2263 px)
  const W = 1600
  const H = 2263
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ xuất đồ họa PDF Canvas.")
  }

  const fontStack = "'Figtree Variable', 'Segoe UI', Roboto, Arial, sans-serif"
  const monoStack = "'Consolas', 'Courier New', monospace"

  // 1. NỀN TRANG A4 SÁNG THANH LỊCH (TIẾT KIỆM MỰC KHI IN & NỔI BẬT THẺ VÉ)
  ctx.fillStyle = "#eef2f6"
  ctx.fillRect(0, 0, W, H)

  // Họa tiết chấm lưới nhẹ phía trên nền
  ctx.fillStyle = "#dde4ee"
  for (let gx = 48; gx < W; gx += 48) {
    for (let gy = 48; gy < H; gy += 48) {
      ctx.fillRect(gx, gy, 3, 3)
    }
  }

  // 2. KHUNG THẺ VÉ CHÍNH (CARD CONTAINER)
  const cardX = 84
  const cardY = 72
  const cardW = W - cardX * 2 // 1432
  const cardH = H - cardY * 2 // 2119
  const cardR = 36

  ctx.save()
  ctx.shadowColor = "rgba(15, 23, 42, 0.14)"
  ctx.shadowBlur = 42
  ctx.shadowOffsetY = 16
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.restore()

  // 3. HEADER THƯƠNG HIỆU CINEMA MANAGEMENT (DARK LUXURY BANNER)
  const headerH = 228
  ctx.save()
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.clip()

  const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH)
  headerGrad.addColorStop(0, "#090d14")
  headerGrad.addColorStop(0.55, "#111a27")
  headerGrad.addColorStop(1, "#16241b")
  ctx.fillStyle = headerGrad
  ctx.fillRect(cardX, cardY, cardW, headerH)

  // Thanh viền điểm nhấn xanh cốm đặc trưng trên đỉnh
  ctx.fillStyle = "#caef6b"
  ctx.fillRect(cardX, cardY, cardW, 10)

  // Logo icon cuống vé bên trái
  const logoX = cardX + 56
  const logoY = cardY + 62
  drawRoundedRect(ctx, logoX, logoY, 82, 82, 20)
  ctx.fillStyle = "#caef6b"
  ctx.fill()

  ctx.fillStyle = "#090d14"
  ctx.font = `900 32px ${fontStack}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("CM", logoX + 41, logoY + 43)

  // Tên thương hiệu & tiêu đề vé
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#caef6b"
  ctx.font = `700 18px ${fontStack}`
  ctx.fillText("VÉ XEM PHIM ĐIỆN TỬ · OFFICIAL E-TICKET", logoX + 106, logoY + 26)

  ctx.fillStyle = "#ffffff"
  ctx.font = `900 38px ${fontStack}`
  ctx.fillText("CINEMA MANAGEMENT", logoX + 106, logoY + 70)

  // Trạng thái vé & Mã đặt vé góc phải header
  const isCancelled = ticket.status === "cancelled"
  const isCompleted = ticket.status === "completed"
  const statusText = isCancelled
    ? "ĐÃ HỦY VÉ"
    : isCompleted
      ? "ĐÃ SỬ DỤNG"
      : "ĐÃ THANH TOÁN · HỢP LỆ"

  const badgeW = 290
  const badgeH = 44
  const badgeX = cardX + cardW - 56 - badgeW
  const badgeY = cardY + 56

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 22)
  ctx.fillStyle = isCancelled ? "#3b1219" : "#182c1b"
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = isCancelled ? "#f87171" : "#caef6b"
  ctx.stroke()

  ctx.fillStyle = isCancelled ? "#fca5a5" : "#caef6b"
  ctx.font = `800 17px ${fontStack}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(statusText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1)

  ctx.textAlign = "right"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#9ba9ba"
  ctx.font = `600 17px ${fontStack}`
  ctx.fillText("MÃ ĐẶT VÉ", cardX + cardW - 56, badgeY + 76)

  ctx.fillStyle = "#ffffff"
  ctx.font = `800 30px ${monoStack}`
  ctx.fillText(ticket.bookingCode, cardX + cardW - 56, badgeY + 112)
  ctx.restore()

  // 4. KHU VỰC THÔNG TIN PHIM & ĐỊA CHỈ CỤM RẠP (HERO SECTION)
  const padX = cardX + 56 // 140
  const innerW = cardW - 112 // 1320
  const heroTop = cardY + headerH + 46 // 346

  // 4.1. Poster phim (250 x 366 px)
  const posterW = 250
  const posterH = 366
  ctx.save()
  drawRoundedRect(ctx, padX, heroTop, posterW, posterH, 22)
  ctx.fillStyle = "#0f172a"
  ctx.fill()
  ctx.clip()

  if (posterImg) {
    const scale = Math.max(posterW / posterImg.width, posterH / posterImg.height)
    const dw = posterImg.width * scale
    const dh = posterImg.height * scale
    ctx.drawImage(posterImg, padX + (posterW - dw) / 2, heroTop + (posterH - dh) / 2, dw, dh)
  } else {
    const fallbackGrad = ctx.createLinearGradient(padX, heroTop, padX + posterW, heroTop + posterH)
    fallbackGrad.addColorStop(0, "#121923")
    fallbackGrad.addColorStop(1, "#1e293b")
    ctx.fillStyle = fallbackGrad
    ctx.fillRect(padX, heroTop, posterW, posterH)

    ctx.fillStyle = "#caef6b"
    ctx.font = `900 26px ${fontStack}`
    ctx.textAlign = "center"
    ctx.fillText("CINEMA", padX + posterW / 2, heroTop + posterH / 2 - 12)
    ctx.fillStyle = "#94a3b8"
    ctx.font = `600 18px ${fontStack}`
    ctx.fillText("MOVIE PASS", padX + posterW / 2, heroTop + posterH / 2 + 22)
  }
  ctx.restore()

  // Viền mỏng cho poster + Nhãn độ tuổi
  drawRoundedRect(ctx, padX, heroTop, posterW, posterH, 22)
  ctx.lineWidth = 2
  ctx.strokeStyle = "#cbd5e1"
  ctx.stroke()

  const ratingLabel = ticket.movieRating || "T13"
  drawRoundedRect(ctx, padX + 16, heroTop + 16, 66, 36, 10)
  ctx.fillStyle = "#090d14"
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = "#caef6b"
  ctx.stroke()
  ctx.fillStyle = "#caef6b"
  ctx.font = `800 18px ${fontStack}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(ratingLabel, padX + 49, heroTop + 35)

  // 4.2. Chi tiết phim & Hộp địa chỉ rạp nổi bật bên phải Poster
  const infoX = padX + posterW + 42 // 432
  const infoW = padX + innerW - infoX // 1028

  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"

  // Định dạng & Thể loại
  const formatBadgeText = (ticket.format || "2D Dolby Atmos").toUpperCase()
  ctx.font = `800 17px ${fontStack}`
  const fmtWidth = ctx.measureText(formatBadgeText).width + 32
  drawRoundedRect(ctx, infoX, heroTop + 2, fmtWidth, 36, 10)
  ctx.fillStyle = "#ecfccb"
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = "#84cc16"
  ctx.stroke()

  ctx.fillStyle = "#365314"
  ctx.fillText(formatBadgeText, infoX + 16, heroTop + 26)

  const durationText = ticket.movieDuration
    ? typeof ticket.movieDuration === "number"
      ? `${ticket.movieDuration} phút`
      : String(ticket.movieDuration)
    : "118 phút"
  const subMeta = [ticket.movieGenre, durationText].filter(Boolean).join(" · ")
  if (subMeta) {
    ctx.fillStyle = "#64748b"
    ctx.font = `600 19px ${fontStack}`
    ctx.fillText(subMeta, infoX + fmtWidth + 16, heroTop + 26)
  }

  // Tên bộ phim (tối đa 2 dòng)
  ctx.fillStyle = "#0f172a"
  ctx.font = `900 44px ${fontStack}`
  const titleLines = wrapLines(ctx, ticket.movieTitle, infoW, 2)
  let titleBottomY = heroTop + 88
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, infoX, heroTop + 88 + idx * 52)
    titleBottomY = heroTop + 88 + idx * 52
  })

  // Hộp thông tin Rạp & Địa chỉ chi tiết (cố định đáy khớp với đáy Poster = heroTop + posterH)
  const addrBoxY = Math.max(titleBottomY + 28, heroTop + 178)
  const addrBoxH = heroTop + posterH - addrBoxY // ~188 px

  drawRoundedRect(ctx, infoX, addrBoxY, infoW, addrBoxH, 20)
  ctx.fillStyle = "#f8fafc"
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#cbd5e1"
  ctx.stroke()

  // Thanh điểm nhấn trái cho hộp địa chỉ
  ctx.save()
  drawRoundedRect(ctx, infoX, addrBoxY, infoW, addrBoxH, 20)
  ctx.clip()
  ctx.fillStyle = "#65a30d"
  ctx.fillRect(infoX, addrBoxY, 10, addrBoxH)
  ctx.restore()

  // Tên cụm rạp + Phòng chiếu
  const addrInnerX = infoX + 32
  ctx.fillStyle = "#0f172a"
  ctx.font = `800 27px ${fontStack}`
  ctx.fillText(`${ticket.cinemaName}  —  ${ticket.roomName}`, addrInnerX, addrBoxY + 46)

  // Vẽ biểu tượng Pin địa chỉ + Địa chỉ đầy đủ
  const pinX = addrInnerX + 10
  const pinY = addrBoxY + 84
  ctx.beginPath()
  ctx.arc(pinX, pinY - 6, 9, 0, Math.PI * 2)
  ctx.fillStyle = "#65a30d"
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(pinX - 6, pinY - 2)
  ctx.lineTo(pinX + 6, pinY - 2)
  ctx.lineTo(pinX, pinY + 11)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(pinX, pinY - 6, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()

  ctx.fillStyle = "#1e293b"
  ctx.font = `600 22px ${fontStack}`
  const addressLines = wrapLines(ctx, `Địa chỉ: ${location.address}`, infoW - 72, 2)
  addressLines.forEach((line, idx) => {
    ctx.fillText(line, addrInnerX + 28, addrBoxY + 91 + idx * 30)
  })

  // Hotline cụm rạp
  const hotlineY = addrBoxY + addrBoxH - 22
  ctx.fillStyle = "#64748b"
  ctx.font = `600 19px ${fontStack}`
  ctx.fillText(`Hotline rạp: ${location.phone}   ·   Quầy vé & Cổng soát vé tự động`, addrInnerX + 28, hotlineY)

  // 5. DẢI 3 Ô THÔNG TIN QUAN TRỌNG: NGÀY CHIẾU — GIỜ CHIẾU — GHẾ NGỒI
  const stripY = heroTop + posterH + 38 // 750
  const stripH = 180
  const colGap = 24
  const colW = (innerW - colGap * 2) / 3 // 424

  // Ô 1: Ngày chiếu
  drawRoundedRect(ctx, padX, stripY, colW, stripH, 22)
  ctx.fillStyle = "#f8fafc"
  ctx.fill()
  ctx.lineWidth = 1.8
  ctx.strokeStyle = "#e2e8f0"
  ctx.stroke()

  ctx.fillStyle = "#64748b"
  ctx.font = `700 17px ${fontStack}`
  ctx.fillText("NGÀY CHIẾU / DATE", padX + 28, stripY + 42)
  ctx.fillStyle = "#0f172a"
  ctx.font = `900 34px ${fontStack}`
  ctx.fillText(ticket.showDate, padX + 28, stripY + 98)
  ctx.fillStyle = "#475569"
  ctx.font = `500 19px ${fontStack}`
  ctx.fillText("Suất chiếu đã xác nhận", padX + 28, stripY + 142)

  // Ô 2: Khung giờ chiếu
  const col2X = padX + colW + colGap
  drawRoundedRect(ctx, col2X, stripY, colW, stripH, 22)
  ctx.fillStyle = "#f8fafc"
  ctx.fill()
  ctx.strokeStyle = "#e2e8f0"
  ctx.stroke()

  ctx.fillStyle = "#64748b"
  ctx.font = `700 17px ${fontStack}`
  ctx.fillText("KHUNG GIỜ / SHOWTIME", col2X + 28, stripY + 42)
  ctx.fillStyle = "#0f172a"
  ctx.font = `900 34px ${fontStack}`
  ctx.fillText(ticket.showtime, col2X + 28, stripY + 98)
  ctx.fillStyle = "#4d7c0f"
  ctx.font = `700 19px ${fontStack}`
  ctx.fillText("Check-in trước 15 phút", col2X + 28, stripY + 142)

  // Ô 3: Phòng & Ghế ngồi (nổi bật)
  const col3X = col2X + colW + colGap
  drawRoundedRect(ctx, col3X, stripY, colW, stripH, 22)
  ctx.fillStyle = "#f7fee7"
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#84cc16"
  ctx.stroke()

  ctx.fillStyle = "#3f6212"
  ctx.font = `800 17px ${fontStack}`
  ctx.fillText(`PHÒNG & GHẾ (${ticket.roomName.toUpperCase()})`, col3X + 28, stripY + 42)

  ctx.fillStyle = "#1a2e05"
  ctx.font = `900 29px ${fontStack}`
  const seatLines = wrapLines(ctx, ticket.seats, colW - 56, 2)
  if (seatLines.length === 1) {
    ctx.fillText(seatLines[0], col3X + 28, stripY + 98)
    ctx.fillStyle = "#4d7c0f"
    ctx.font = `600 19px ${fontStack}`
    ctx.fillText("Vui lòng ngồi đúng số ghế", col3X + 28, stripY + 142)
  } else {
    ctx.font = `900 25px ${fontStack}`
    ctx.fillText(seatLines[0], col3X + 28, stripY + 88)
    ctx.fillText(seatLines[1], col3X + 28, stripY + 124)
    ctx.fillStyle = "#4d7c0f"
    ctx.font = `600 17px ${fontStack}`
    ctx.fillText("Ngồi đúng vị trí ghế", col3X + 28, stripY + 156)
  }

  // 6. ĐƯỜNG RĂNG CƯA XÉ VÉ (PERFORATED TEAR LINE)
  const tearY = stripY + stripH + 54 // 984
  ctx.save()
  ctx.setLineDash([16, 12])
  ctx.lineWidth = 2.5
  ctx.strokeStyle = "#cbd5e1"
  ctx.beginPath()
  ctx.moveTo(cardX + 34, tearY)
  ctx.lineTo(cardX + cardW - 34, tearY)
  ctx.stroke()
  ctx.restore()

  // Nhãn giữa đường xé vé
  const stubTagW = 350
  drawRoundedRect(ctx, W / 2 - stubTagW / 2, tearY - 18, stubTagW, 36, 18)
  ctx.fillStyle = "#f1f5f9"
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = "#cbd5e1"
  ctx.stroke()
  ctx.fillStyle = "#475569"
  ctx.font = `800 15px ${fontStack}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("PHẦN SOÁT VÉ ĐIỆN TỬ · CHECK-IN STUB", W / 2, tearY + 1)

  // Hai khuyết bán nguyệt hai bên mép vé
  ctx.fillStyle = "#eef2f6"
  ctx.beginPath()
  ctx.arc(cardX, tearY, 26, -Math.PI / 2, Math.PI / 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cardX + cardW, tearY, 26, Math.PI / 2, (Math.PI * 3) / 2)
  ctx.fill()

  // 7. PHẦN CUỐNG VÉ: BẢNG ĐƠN VÉ & KHÁCH HÀNG (TRÁI) + MÃ QR VÉ QUÉT THẬT (PHẢI)
  const stubTop = tearY + 52 // 1036
  const stubH = 716
  const leftW = 776
  const rightW = innerW - leftW - 40 // 504
  const rightX = padX + leftW + 40

  // 7.1. Cột trái: Chi tiết khách hàng & Thanh toán
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#0f172a"
  ctx.font = `800 23px ${fontStack}`
  ctx.fillText("THÔNG TIN KHÁCH HÀNG & THANH TOÁN", padX, stubTop + 26)

  ctx.fillStyle = "#65a30d"
  ctx.fillRect(padX, stubTop + 40, 68, 5)

  const contactParts = [ticket.customerPhone, ticket.customerEmail].filter(Boolean).join(" · ")
  const detailRows: Array<{ label: string; value: string; mono?: boolean; highlight?: boolean }> = [
    { label: "Mã đặt vé", value: ticket.bookingCode, mono: true },
    { label: "Khách hàng", value: ticket.customerName || "Khách hàng thành viên" },
    { label: "Thông tin liên hệ", value: contactParts || "Đã xác thực qua tài khoản" },
    { label: "Cụm rạp & Phòng", value: `${ticket.cinemaName} (${ticket.roomName})` },
    { label: "Phương thức TT", value: formatPaymentMethodLabel(ticket.paymentMethod) },
    {
      label: "Thời điểm xuất vé",
      value: ticket.createdAt || new Date().toLocaleString("vi-VN"),
    },
  ]

  if (ticket.discountAmount && ticket.discountAmount > 0) {
    const formattedDiscount = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(ticket.discountAmount)
    detailRows.push({
      label: "Ưu đãi Voucher",
      value: `-${formattedDiscount}`,
      highlight: true,
    })
  }

  const rowStartY = stubTop + 92
  const rowStep = 72

  detailRows.forEach((item, index) => {
    const ry = rowStartY + index * rowStep
    ctx.fillStyle = "#64748b"
    ctx.font = `600 20px ${fontStack}`
    ctx.textAlign = "left"
    ctx.fillText(item.label, padX, ry)

    ctx.fillStyle = item.highlight ? "#15803d" : "#0f172a"
    ctx.font = item.mono ? `800 22px ${monoStack}` : `700 21px ${fontStack}`
    ctx.textAlign = "right"
    const fitted = wrapLines(ctx, item.value, leftW - 220, 1)[0]
    ctx.fillText(fitted, padX + leftW, ry)

    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(padX, ry + 24)
    ctx.lineTo(padX + leftW, ry + 24)
    ctx.stroke()
  })

  // Hộp Tổng tiền thanh toán ở đáy cột trái (căn thẳng đáy với khung QR bên phải!)
  const totalBoxH = 122
  const totalBoxY = stubTop + stubH - totalBoxH
  drawRoundedRect(ctx, padX, totalBoxY, leftW, totalBoxH, 24)
  ctx.fillStyle = "#090d14"
  ctx.fill()

  ctx.textAlign = "left"
  ctx.fillStyle = "#caef6b"
  ctx.font = `800 19px ${fontStack}`
  ctx.fillText("TỔNG THANH TOÁN", padX + 34, totalBoxY + 52)
  ctx.fillStyle = "#9ba9ba"
  ctx.font = `500 17px ${fontStack}`
  ctx.fillText("Đã bao gồm thuế GTGT (VAT)", padX + 34, totalBoxY + 84)

  ctx.textAlign = "right"
  ctx.fillStyle = "#caef6b"
  ctx.font = `900 42px ${fontStack}`
  ctx.fillText(ticket.totalPriceText, padX + leftW - 34, totalBoxY + 76)

  // 7.2. Cột phải: Hộp Mã QR Vé Điện Tử chuẩn ISO/IEC 18004
  drawRoundedRect(ctx, rightX, stubTop, rightW, stubH, 26)
  ctx.fillStyle = "#f8fafc"
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#cbd5e1"
  ctx.stroke()

  ctx.textAlign = "center"
  ctx.fillStyle = "#0f172a"
  ctx.font = `800 21px ${fontStack}`
  ctx.fillText("MÃ QR SOÁT VÉ CHECK-IN", rightX + rightW / 2, stubTop + 48)

  // Khung trắng chứa ma trận QR
  const qrBoxSize = 376
  const qrBoxX = rightX + (rightW - qrBoxSize) / 2
  const qrBoxY = stubTop + 74

  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 22)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#e2e8f0"
  ctx.stroke()

  // Vẽ 4 góc định vị thẩm mỹ quanh QR
  const bracketLen = 28
  const bracketPad = 14
  ctx.strokeStyle = "#090d14"
  ctx.lineWidth = 4
  const corners: Array<[number, number, number, number]> = [
    [qrBoxX + bracketPad, qrBoxY + bracketPad, 1, 1],
    [qrBoxX + qrBoxSize - bracketPad, qrBoxY + bracketPad, -1, 1],
    [qrBoxX + bracketPad, qrBoxY + qrBoxSize - bracketPad, 1, -1],
    [qrBoxX + qrBoxSize - bracketPad, qrBoxY + qrBoxSize - bracketPad, -1, -1],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + dy * bracketLen)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + dx * bracketLen, cy)
    ctx.stroke()
  }

  // Tạo & vẽ ma trận QR nét tuyệt đối (integer module size)
  const qrPayload = buildTicketQRPayload({
    bookingCode: ticket.bookingCode,
    movieTitle: ticket.movieTitle,
    cinemaName: ticket.cinemaName,
    roomName: ticket.roomName,
    showDate: ticket.showDate,
    showtime: ticket.showtime,
    seats: ticket.seats,
    qrUrl: ticket.qrCode,
  })
  const qrMatrix = generateQRMatrix(qrPayload)
  const quietModules = 3
  const totalModules = qrMatrix.length + quietModules * 2
  const modulePx = Math.floor((qrBoxSize - 56) / totalModules)
  const actualQrPx = modulePx * totalModules
  const qrOriginX = Math.floor(qrBoxX + (qrBoxSize - actualQrPx) / 2)
  const qrOriginY = Math.floor(qrBoxY + (qrBoxSize - actualQrPx) / 2)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = isCancelled ? "#94a3b8" : "#090d14"
  for (let r = 0; r < qrMatrix.length; r++) {
    for (let c = 0; c < qrMatrix.length; c++) {
      if (qrMatrix[r][c]) {
        ctx.fillRect(
          qrOriginX + (c + quietModules) * modulePx,
          qrOriginY + (r + quietModules) * modulePx,
          modulePx,
          modulePx
        )
      }
    }
  }
  ctx.restore()

  if (isCancelled) {
    ctx.save()
    ctx.translate(qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize / 2)
    ctx.rotate(-0.32)
    drawRoundedRect(ctx, -130, -28, 260, 56, 12)
    ctx.fillStyle = "rgba(185, 28, 28, 0.92)"
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = `900 24px ${fontStack}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("VÉ ĐÃ HỦY", 0, 1)
    ctx.restore()
  }

  // Nhãn mã đặt vé bên dưới QR
  const codePillW = rightW - 96
  const codePillX = rightX + 48
  const codePillY = qrBoxY + qrBoxSize + 24
  drawRoundedRect(ctx, codePillX, codePillY, codePillW, 52, 14)
  ctx.fillStyle = "#090d14"
  ctx.fill()

  ctx.fillStyle = "#caef6b"
  ctx.font = `800 24px ${monoStack}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(ticket.bookingCode, rightX + rightW / 2, codePillY + 27)

  // Hướng dẫn quét QR
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#475569"
  ctx.font = `500 18px ${fontStack}`
  const qrNoteLines = wrapLines(
    ctx,
    isCancelled
      ? "Vé đã hủy, mã QR này không còn hiệu lực qua cổng soát vé."
      : "Đưa mã QR vào máy quét tự động hoặc xuất trình tại quầy trước giờ chiếu 15 phút.",
    rightW - 64,
    3
  )
  qrNoteLines.forEach((line, idx) => {
    ctx.fillText(line, rightX + rightW / 2, codePillY + 90 + idx * 27)
  })

  // 8. CHÂN VÉ: QUY ĐỊNH RẠP & ĐỊA CHỈ HỖ TRỢ
  const footerBoxY = stubTop + stubH + 44 // 1796
  const footerBoxH = 248
  drawRoundedRect(ctx, padX, footerBoxY, innerW, footerBoxH, 22)
  ctx.fillStyle = "#f1f5f9"
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = "#cbd5e1"
  ctx.stroke()

  ctx.textAlign = "left"
  ctx.fillStyle = "#0f172a"
  ctx.font = `800 20px ${fontStack}`
  ctx.fillText("HƯỚNG DẪN CHECK-IN & QUY ĐỊNH RẠP CHIẾU", padX + 32, footerBoxY + 42)

  const rules = [
    `• Địa điểm chiếu phim: ${ticket.cinemaName} — ${location.address}.`,
    "• Quý khách vui lòng có mặt trước giờ chiếu ít nhất 15 phút. Vé chỉ có giá trị cho 01 lần quét mã hợp lệ.",
    "• Phim có phân loại độ tuổi (T13, T16, T18): Vui lòng mang theo giấy tờ tùy thân để xác minh khi soát vé.",
    `• Hỗ trợ đổi/hoàn vé trước giờ chiếu 60 phút · Hotline rạp: ${location.phone} · Tổng đài CSKH: 0123 456 789.`,
  ]

  ctx.fillStyle = "#475569"
  ctx.font = `500 18.5px ${fontStack}`
  let ruleCursorY = footerBoxY + 84
  for (const rule of rules) {
    const lines = wrapLines(ctx, rule, innerW - 64, 2)
    for (const line of lines) {
      ctx.fillText(line, padX + 32, ruleCursorY)
      ruleCursorY += 34
    }
  }

  // Dòng xác thực bản in dưới cùng thẻ vé
  ctx.textAlign = "center"
  ctx.fillStyle = "#94a3b8"
  ctx.font = `600 16px ${fontStack}`
  ctx.fillText(
    `Cinema Management E-Ticket  ·  Xuất bản PDF lúc ${new Date().toLocaleString("vi-VN")}  ·  Chúc quý khách xem phim vui vẻ!`,
    W / 2,
    cardY + cardH - 36
  )

  // Viền ngoài của thẻ vé
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.lineWidth = 2
  ctx.strokeStyle = "#cbd5e1"
  ctx.stroke()

  // 9. KẾT XUẤT RA FILE .PDF VÀ TẢI VỀ THIẾT BỊ
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95)
  const jpegBytes = dataUrlToBytes(jpegDataUrl)
  const pdfBytes = buildPdfFromJpegBytes(
    jpegBytes,
    W,
    H,
    `Ve xem phim ${ticket.bookingCode}`
  )

  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `ve-${ticket.bookingCode}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}
