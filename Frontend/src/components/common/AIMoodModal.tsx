import React, { useState } from "react"
import { X, Sparkles, Film, ArrowRight, CheckCircle2, MessageSquare, Bot, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { aiService, type AIMoodRecommendation } from "@/services"

interface AIMoodModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMovie?: (title: string) => void
}

export const AIMoodModal: React.FC<AIMoodModalProps> = ({
  isOpen,
  onClose,
  onSelectMovie,
}) => {
  // Mặc định không chọn cảm xúc nào, người dùng có thể bấm 1 lần để chọn, bấm lần nữa để tắt
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState<string>("")
  const [analyzing, setAnalyzing] = useState(false)
  const [recommendation, setRecommendation] = useState<AIMoodRecommendation | null>(null)
  const [recommendedHistory, setRecommendedHistory] = useState<string[]>([])
  const [isFallback, setIsFallback] = useState(false)

  const moods = [
    { id: "1", label: "Tò mò & khám phá", icon: "🌌" },
    { id: "2", label: "Chữa lành & nhẹ nhàng", icon: "🌿" },
    { id: "3", label: "Hồi hộp, giật gân", icon: "⚡" },
    { id: "4", label: "Phiêu lưu, xúc động", icon: "🚂" },
    { id: "5", label: "Ngọt ngào, hoài niệm", icon: "🌸" },
  ]

  const quickSuggestions = [
    "Xem cùng người yêu, lãng mạn nhẹ nhàng 💖",
    "Cần giải tỏa căng thẳng sau tuần làm việc 🌿",
    "Phim hành động kỹ xảo đỉnh cao, rượt đuổi 💥",
    "Phim khoa học viễn tưởng, kết bất ngờ 🤯",
  ]

  // Bấm 1 lần là chọn, bấm lần thứ 2 là tắt bỏ chọn
  const handleToggleMood = (label: string) => {
    setSelectedMood((prev) => (prev === label ? null : label))
    setRecommendation(null)
  }

  const FALLBACK_CATALOG = [
    {
      title: "Thành phố không ngủ",
      genre: "Hành động / Giật gân · 124 phút",
      matchScore: 98,
      keywords: ["hành động", "kịch tính", "gay cấn", "hồi hộp", "rượt đuổi", "đánh", "bắn"],
      moods: ["Hồi hộp, giật gân"],
      aiReply: "Chuẩn bị tinh thần cho những cú rượt đuổi nghẹt thở trong màn đêm đô thị nhé!",
      reason: "Tiết tấu dồn dập, những pha rượt đuổi nghẹt thở trong màn đêm đô thị chuẩn Dolby Atmos sẽ giữ trọn sự tập trung của bạn đến phút cuối cùng.",
    },
    {
      title: "Mùa hè ở lại",
      genre: "Tình cảm / Lãng mạn · 102 phút",
      matchScore: 97,
      keywords: ["yêu", "lãng mạn", "tình cảm", "hẹn hò", "ngọt ngào", "thanh xuân", "bạn gái", "người yêu"],
      moods: ["Ngọt ngào, hoài niệm"],
      aiReply: "Giai điệu thanh xuân trong trẻo sẽ làm dịu êm tâm hồn bạn với những rung động chân thật nhất.",
      reason: "Giai điệu thanh xuân trong trẻo bên bờ biển ngập tràn nắng vàng, mang lại cảm xúc dịu êm và rung động chân thành.",
    },
    {
      title: "Khu rừng biết nói",
      genre: "Hoạt hình / Gia đình · 95 phút",
      matchScore: 96,
      keywords: ["chữa lành", "thư giãn", "hoạt hình", "trẻ em", "gia đình", "căng thẳng", "vui vẻ", "nhẹ nhàng"],
      moods: ["Chữa lành & nhẹ nhàng"],
      aiReply: "Một lựa chọn tuyệt vời để xua tan mọi mệt mỏi! Tác phẩm này sẽ đem lại cho bạn không gian trong lành và an yên.",
      reason: "Hình ảnh thiên nhiên thơ mộng, âm nhạc du dương êm dịu giúp giải tỏa mọi căng thẳng sau ngày làm việc dài.",
    },
    {
      title: "Chuyến tàu bình minh",
      genre: "Phiêu lưu / Cảm động · 112 phút",
      matchScore: 97,
      keywords: ["phiêu lưu", "xúc động", "du lịch", "khám phá", "hành trình", "núi"],
      moods: ["Phiêu lưu, xúc động"],
      aiReply: "Chuyến tàu này mang theo những hoài bão tuổi trẻ và phong cảnh tráng lệ, rất đáng để thưởng thức trên màn ảnh lớn.",
      reason: "Hành trình kỳ diệu trên chuyến tàu xuyên mây qua những dãy núi hùng vĩ, khơi gợi khát khao tuổi trẻ và ước mơ.",
    },
    {
      title: "Qua miền ký ức",
      genre: "Khoa học viễn tưởng / Tâm lý · 106 phút",
      matchScore: 96,
      keywords: ["ký ức", "tâm lý", "nghệ thuật", "sâu sắc", "triết lý", "suy ngẫm"],
      moods: ["Tò mò & khám phá"],
      aiReply: "Chuyến du hành vào những tầng ký ức sâu thẳm, âm nhạc xúc động, giàu tính nghệ thuật.",
      reason: "Chuyến du hành vào những tầng ký ức sâu thẳm, âm nhạc xúc động, khung hình nghệ thuật giàu chiều sâu.",
    },
    {
      title: "Tín hiệu từ ngày mai",
      genre: "Khoa học viễn tưởng · Tâm lý · 118 phút",
      matchScore: 98,
      keywords: ["viễn tưởng", "tương lai", "vũ trụ", "thời gian", "kỹ xảo", "tò mò"],
      moods: ["Tò mò & khám phá"],
      aiReply: "AI đã phân tích và chọn ra tác phẩm viễn tưởng đỉnh cao này dành riêng cho bạn tối nay.",
      reason: "Bộ phim đưa bạn vào hành trình vượt thời gian đầy bí ẩn, triết lý nhân sinh sâu sắc và kỹ xảo hình ảnh vũ trụ đỉnh cao chuẩn Dolby Atmos.",
    },
  ]

  // Fallback thông minh phân tích theo từ khóa thực tế và loại trừ các phim đã xem/không thích
  const getSmartFallback = (
    mood: string | null,
    input: string,
    excludeTitles: string[] = []
  ): AIMoodRecommendation => {
    const text = (input || "").toLowerCase()
    const isNegativeOrChange = /không thích|đổi|khác|chán|bỏ qua|phim khác|bộ khác/i.test(text)

    // Lọc ra các phim chưa nằm trong danh sách loại trừ
    let candidates = FALLBACK_CATALOG.filter(
      (m) => !excludeTitles.some((ex) => ex.toLowerCase() === m.title.toLowerCase())
    )
    if (candidates.length === 0) candidates = [...FALLBACK_CATALOG]

    // 1. Tìm theo từ khóa trong input nếu có
    let matched = candidates.find((m) =>
      m.keywords.some((k) => text.includes(k))
    )

    // 2. Tìm theo mood đã chọn nếu có
    if (!matched && mood) {
      matched = candidates.find((m) => m.moods.includes(mood))
    }

    // 3. Nếu khách nói "không thích phim này" hoặc không khớp từ khóa nào, chọn phim đầu tiên trong candidates
    const chosen = matched || candidates[0]

    let reply = chosen.aiReply
    if (isNegativeOrChange) {
      reply = `AI rất tiếc vì bộ phim trước chưa làm bạn hài lòng! Mình đã đổi sang tác phẩm "${chosen.title}" với phong cách hoàn toàn mới, kịch tính và hấp dẫn hơn để bạn thưởng thức tối nay!`
    } else if (input.trim()) {
      reply = `Dựa trên ý kiến "${input.trim()}" của bạn, AI xin gợi ý ngay bộ phim "${chosen.title}" rất phù hợp với gu thưởng thức của bạn!`
    }

    return {
      title: chosen.title,
      genre: chosen.genre,
      matchScore: chosen.matchScore,
      aiReply: reply,
      reason: chosen.reason,
    }
  }

  const handleAnalyze = async (forceNext = false) => {
    setAnalyzing(true)
    setIsFallback(false)

    // Xác định các phim cần loại trừ
    const isNegativeOrChange =
      forceNext || /không thích|đổi|khác|chán|bỏ qua|phim khác|bộ khác/i.test(customInput)
    const excludes = [...recommendedHistory]
    if (recommendation && !excludes.includes(recommendation.title)) {
      excludes.push(recommendation.title)
    }

    try {
      const res = await aiService.getMoodRecommendation({
        mood: selectedMood || undefined,
        userInput: customInput.trim() || undefined,
        excludeTitles: (isNegativeOrChange || excludes.length > 0) ? excludes : undefined,
      })

      if (res.success && res.data) {
        setRecommendation(res.data)
        setRecommendedHistory((prev) => [...new Set([...prev, res.data!.title])])
      } else {
        setIsFallback(true)
        const fallback = getSmartFallback(selectedMood, customInput, excludes)
        setRecommendation(fallback)
        setRecommendedHistory((prev) => [...new Set([...prev, fallback.title])])
      }
    } catch {
      setIsFallback(true)
      const fallback = getSmartFallback(selectedMood, customInput, excludes)
      setRecommendation(fallback)
      setRecommendedHistory((prev) => [...new Set([...prev, fallback.title])])
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReset = () => {
    setRecommendation(null)
    setIsFallback(false)
    setCustomInput("")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[#2b442e] bg-[#0d1610] p-6 shadow-2xl custom-scrollbar">
        {/* Glow hiệu ứng nền */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#caef6b]/15 blur-2xl" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1c3021] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#caef6b]/20 text-[#caef6b] shadow-[0_0_12px_rgba(202,239,107,0.2)]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                Cinema AI · Trợ Lý Gợi Ý Phim
                <span className="rounded-full bg-[#caef6b]/20 px-2 py-0.5 text-[10px] font-semibold text-[#caef6b] border border-[#caef6b]/30">
                  Gemini AI
                </span>
              </h3>
              <p className="text-xs text-[#9ba9ba]">
                Gợi ý chuẩn xác theo cảm xúc và mong muốn riêng của bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#18291c] hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-4">
          {/* Section 1: Chọn cảm xúc (Bấm 1 lần chọn, 2 lần tắt) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#caef6b] uppercase tracking-wider block">
                1. Chọn cảm xúc bạn muốn trải nghiệm tối nay:
              </label>
              {selectedMood && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMood(null)
                    setRecommendation(null)
                  }}
                  className="text-[11px] font-medium text-[#caef6b] hover:underline transition-all cursor-pointer"
                >
                  ✕ Bỏ chọn cảm xúc
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#718576] mb-2.5">
              (Bấm 1 lần để chọn, bấm lần thứ 2 để tắt bỏ chọn. Bạn có thể chỉ cần nhập mong muốn bên dưới mà không cần chọn cảm xúc).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {moods.map((m) => {
                const isSelected = selectedMood === m.label
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleMood(m.label)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#caef6b] bg-[#1d3521] text-white shadow-[0_0_12px_rgba(202,239,107,0.25)] ring-1 ring-[#caef6b]"
                        : "border-[#1e3423] bg-[#122015] text-[#9ba9ba] hover:border-[#2f5336] hover:text-white"
                    }`}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="truncate">{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Ô nhập ý kiến của người dùng */}
          <div>
            <label className="text-xs font-semibold text-[#caef6b] uppercase tracking-wider flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-[#caef6b]" />
                2. Nhập ý kiến / mong muốn cụ thể của bạn:
              </span>
              {customInput && (
                <button
                  onClick={() => setCustomInput("")}
                  className="text-[11px] font-normal text-[#9ba9ba] hover:text-[#caef6b] transition-colors cursor-pointer"
                >
                  Xóa nội dung
                </button>
              )}
            </label>

            {/* Input textarea */}
            <div className="relative">
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Tối nay mình đi xem cùng người yêu, muốn một bộ phim lãng mạn nhưng cũng có chút hài hước vui vẻ..."
                className="w-full rounded-xl border border-[#1e3423] bg-[#122015] p-3 text-xs text-white placeholder-[#687b6d] focus:border-[#caef6b] focus:outline-none focus:ring-1 focus:ring-[#caef6b] transition-all resize-none"
              />
            </div>

            {/* Quick suggestions pills */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-[#6e8373] self-center mr-1">Gợi ý nhanh:</span>
              {quickSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCustomInput(sug)}
                  className="rounded-lg border border-[#1f3825] bg-[#142318] px-2 py-1 text-[11px] text-[#a1b3a5] hover:border-[#caef6b]/50 hover:bg-[#1a3320] hover:text-white transition-all cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Nút gửi yêu cầu tới AI */}
          <Button
            onClick={() => handleAnalyze()}
            disabled={analyzing}
            className="w-full h-11 rounded-xl bg-[#caef6b] font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-[0_0_20px_rgba(202,239,107,0.2)] transition-all cursor-pointer"
          >
            {analyzing ? (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 animate-spin text-[#090d14]" />
                Gemini AI đang lắng nghe và phân tích mong muốn thực tế...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Xem phim AI gợi ý cho bạn
              </span>
            )}
          </Button>

          {/* AI Recommendation Result */}
          {recommendation && (
            <div className="mt-4 rounded-xl border border-[#2d4c33] bg-[#142618] p-4 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {isFallback && (
                <p className="rounded-lg border border-[#3a4b2f] bg-[#1a2915] px-3 py-2 text-[11px] leading-relaxed text-[#c9d6b8]">
                  ⏳ AI đang bận hoặc phản hồi quá lâu, đây là gợi ý phù hợp dựa trên nội dung yêu cầu của bạn.
                </p>
              )}

              {/* AI Reply Bubble */}
              {recommendation.aiReply && (
                <div className="rounded-xl border border-[#23452b] bg-[#0c1810] p-3.5 space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-2 text-[#caef6b] text-xs font-bold">
                    <Bot className="size-4" />
                    <span>AI Trả lời ý kiến của bạn:</span>
                  </div>
                  <p className="text-xs text-[#d3dce7] leading-relaxed italic">
                    "{recommendation.aiReply}"
                  </p>
                </div>
              )}

              {/* Thông tin phim đề xuất */}
              <div className="flex items-start justify-between gap-3 border-b border-[#23452b] pb-3">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 rounded bg-[#caef6b]/15 px-2 py-0.5 text-[10px] font-bold text-[#caef6b] border border-[#caef6b]/30">
                    <CheckCircle2 className="size-3" />
                    Phù hợp nhất ({recommendation.matchScore}% tương thích)
                  </span>
                  <h4 className="text-base font-bold text-white flex items-center gap-2 pt-1">
                    <Film className="size-4 text-[#caef6b]" />
                    {recommendation.title}
                  </h4>
                  <p className="text-xs text-[#9ba9ba]">{recommendation.genre}</p>
                </div>
              </div>

              {/* Lý do chọn */}
              <div className="text-xs text-[#d3dce7] leading-relaxed bg-[#0e1b11] p-3 rounded-lg border border-[#1d3423]">
                <span className="font-semibold text-white">💡 Phân tích & Lý do gợi ý:</span>{" "}
                {recommendation.reason}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  onClick={() => {
                    if (onSelectMovie) onSelectMovie(recommendation.title)
                    onClose()
                  }}
                  className="flex-1 h-9 rounded-lg bg-[#caef6b] text-xs font-bold text-[#090d14] hover:bg-[#b8df5b] shadow-sm cursor-pointer"
                >
                  <span>Đặt vé phim {recommendation.title} ngay</span>
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
                <button
                  onClick={() => handleAnalyze(true)}
                  disabled={analyzing}
                  className="h-9 px-3 rounded-lg border border-[#caef6b]/40 bg-[#172e1c] text-xs font-semibold text-[#caef6b] hover:bg-[#203e27] hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Gợi ý một bộ phim khác phù hợp hơn"
                >
                  <RotateCcw className={`size-3.5 ${analyzing ? "animate-spin" : ""}`} />
                  <span>Đổi phim khác</span>
                </button>
                <button
                  onClick={handleReset}
                  className="h-9 px-3 rounded-lg border border-[#23452b] bg-[#122015] text-xs font-medium text-[#9ba9ba] hover:text-white hover:bg-[#1a3320] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Nhập lại</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
