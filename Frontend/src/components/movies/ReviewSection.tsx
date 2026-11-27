import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Star, Loader2, Trash2, BadgeCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { authService } from "@/services/auth.service"
import {
  reviewService,
  type MovieReview,
  type ReviewSummary,
} from "@/services/review.service"

interface ReviewSectionProps {
  movieId: string
  movieTitle: string
  onNotify?: (message: string) => void
}

const MAX_COMMENT = 1000
const RATING_LABELS = ["", "Rất tệ", "Tệ", "Bình thường", "Hay", "Xuất sắc"]

const EMPTY_SUMMARY: ReviewSummary = {
  average: 0,
  total: 0,
  distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** Hàng sao hiển thị (chỉ xem) */
function StarsRow({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${
            n <= Math.round(value) ? "fill-[#ffd166] text-[#ffd166]" : "text-[#384c66]"
          }`}
        />
      ))}
    </div>
  )
}

export const ReviewSection = ({ movieId, movieTitle, onNotify }: ReviewSectionProps) => {
  const user = authService.getCurrentUser()
  const isLoggedIn = Boolean(user?.id)
  const isCustomer = user?.role === "customer"

  const [reviews, setReviews] = useState<MovieReview[]>([])
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form
  const [myReview, setMyReview] = useState<MovieReview | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadReviews = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const res = await reviewService.getByMovie(movieId, 1)
    if (res.success && res.data) {
      setReviews(res.data.reviews)
      setSummary(res.data.summary)
      setPage(1)
      setHasMore(res.data.hasMore)
    } else {
      setLoadError(res.message || "Không tải được đánh giá.")
    }
    setIsLoading(false)
  }, [movieId])

  const loadMine = useCallback(async () => {
    if (!isLoggedIn) {
      setMyReview(null)
      setRating(0)
      setComment("")
      return
    }
    const res = await reviewService.getMine(movieId)
    const mine = res.success ? res.data?.review ?? null : null
    setMyReview(mine)
    setRating(mine?.rating ?? 0)
    setComment(mine?.comment ?? "")
  }, [movieId, isLoggedIn])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    const next = page + 1
    const res = await reviewService.getByMovie(movieId, next)
    if (res.success && res.data) {
      const incoming = res.data.reviews
      setReviews((prev) => [...prev, ...incoming.filter((r) => !prev.some((p) => p.id === r.id))])
      setPage(next)
      setHasMore(res.data.hasMore)
    }
    setIsLoadingMore(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setFormError("Vui lòng chọn số sao để đánh giá.")
      return
    }
    setIsSubmitting(true)
    setFormError(null)

    const res = await reviewService.submit(movieId, rating, comment.trim())
    setIsSubmitting(false)

    if (res.success && res.data) {
      onNotify?.(res.message || "Đã gửi đánh giá!")
      await Promise.all([loadReviews(), loadMine()])
    } else {
      setFormError(res.message || "Không thể gửi đánh giá. Vui lòng thử lại.")
    }
  }

  const handleDelete = async (review: MovieReview) => {
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá này?")) return
    setDeletingId(review.id)
    const res = await reviewService.remove(review.id)
    setDeletingId(null)

    if (res.success) {
      onNotify?.("Đã xóa đánh giá.")
      if (review.userId === user?.id) {
        setMyReview(null)
        setRating(0)
        setComment("")
      }
      await loadReviews()
    } else {
      onNotify?.(res.message || "Không thể xóa đánh giá.")
    }
  }

  const canModerate = user?.role === "admin" || user?.role === "manager"
  const activeStars = hoverRating || rating

  return (
    <section className="mt-14 rounded-2xl border border-[#1f2c3d] bg-[#121923] p-5 sm:p-7 lg:p-8">
      <h2 className="text-xl font-bold text-white sm:text-2xl">Đánh giá từ khán giả</h2>
      <p className="mt-1 text-xs text-[#9ba9ba]">Chia sẻ cảm nhận của bạn về “{movieTitle}”.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        {/* Tổng quan điểm */}
        <div className="lg:col-span-4">
          <div className="flex items-end gap-3">
            <span className="text-5xl font-black leading-none text-white">
              {summary.total > 0 ? summary.average.toFixed(1) : "–"}
            </span>
            <span className="pb-1 text-sm text-[#9ba9ba]">/ 5</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StarsRow value={summary.average} size="size-5" />
            <span className="text-xs text-[#9ba9ba]">{summary.total} đánh giá</span>
          </div>

          <div className="mt-5 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[String(star)] || 0
              const percent = summary.total > 0 ? (count / summary.total) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-2 text-[11px] text-[#9ba9ba]">
                  <span className="w-3 text-right">{star}</span>
                  <Star className="size-3 fill-[#ffd166] text-[#ffd166]" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a2431]">
                    <div className="h-full rounded-full bg-[#caef6b]" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Form + danh sách */}
        <div className="lg:col-span-8">
          {/* Form gửi đánh giá */}
          {!isLoggedIn ? (
            <div className="rounded-xl border border-[#243041] bg-[#16202c] p-4 text-sm text-[#9ba9ba]">
              <Link to="/login" className="font-bold text-[#caef6b] hover:underline">
                Đăng nhập
              </Link>{" "}
              để chấm điểm và viết nhận xét về phim này.
            </div>
          ) : !isCustomer ? (
            <div className="rounded-xl border border-[#243041] bg-[#16202c] p-4 text-sm text-[#9ba9ba]">
              Chỉ tài khoản khách hàng mới có thể đánh giá phim.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-xl border border-[#243041] bg-[#16202c] p-4">
              <p className="text-sm font-bold text-white">
                {myReview ? "Chỉnh sửa đánh giá của bạn" : "Đánh giá của bạn"}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      aria-label={`${n} sao`}
                      className="cursor-pointer rounded p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`size-7 ${
                          n <= activeStars ? "fill-[#ffd166] text-[#ffd166]" : "text-[#384c66]"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-[#ffd166]">
                  {RATING_LABELS[activeStars] || ""}
                </span>
              </div>

              <Textarea
                rows={3}
                value={comment}
                maxLength={MAX_COMMENT}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Bạn thấy bộ phim này thế nào? (không bắt buộc)"
                className="mt-3"
              />
              <div className="mt-1 text-right text-[10px] text-[#9ba9ba]">
                {comment.length}/{MAX_COMMENT}
              </div>

              {formError && <p className="mt-2 text-xs font-semibold text-red-400">{formError}</p>}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-3 h-10 cursor-pointer rounded-xl bg-[#caef6b] px-5 text-sm font-bold text-[#090d14] hover:bg-[#b8df5b] disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Đang gửi...
                  </span>
                ) : myReview ? (
                  "Cập nhật đánh giá"
                ) : (
                  "Gửi đánh giá"
                )}
              </Button>
            </form>
          )}

          {/* Danh sách đánh giá */}
          <div className="mt-6 space-y-4">
            {isLoading ? (
              <p className="flex items-center gap-2 text-xs text-[#9ba9ba]">
                <Loader2 className="size-4 animate-spin" /> Đang tải đánh giá...
              </p>
            ) : loadError ? (
              <p className="text-xs text-red-400">{loadError}</p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-[#9ba9ba]">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-[#1f2c3d] bg-[#101722]/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-[#1a2431] text-sm font-bold text-[#caef6b]">
                        {review.userName.trim().charAt(0).toUpperCase() || "K"}
                      </span>
                      <div>
                        <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                          {review.userName}
                          {review.userId === user?.id && (
                            <span className="rounded bg-[#162518] px-1.5 py-0.5 text-[10px] font-semibold text-[#caef6b]">
                              Bạn
                            </span>
                          )}
                          {review.verified && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#a4c8f5]"
                              title="Đã mua vé xem phim này"
                            >
                              <BadgeCheck className="size-3.5" /> Đã xem
                            </span>
                          )}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <StarsRow value={review.rating} size="size-3.5" />
                          <span className="text-[10px] text-[#9ba9ba]">{formatDate(review.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {(review.userId === user?.id || canModerate) && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(review)}
                        disabled={deletingId === review.id}
                        aria-label="Xóa đánh giá"
                        className="cursor-pointer rounded-lg p-1.5 text-[#9ba9ba] transition-colors hover:bg-[#2d1515] hover:text-[#ffb4b4] disabled:opacity-50"
                      >
                        {deletingId === review.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {review.comment && (
                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-[#d3dce7]">
                      {review.comment}
                    </p>
                  )}
                </article>
              ))
            )}

            {hasMore && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
                className="cursor-pointer rounded-xl border-[#243041] bg-transparent text-xs font-semibold text-[#9ba9ba] hover:text-white"
              >
                {isLoadingMore ? "Đang tải..." : "Xem thêm đánh giá"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
