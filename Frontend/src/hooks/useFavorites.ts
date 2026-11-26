import { useCallback, useEffect, useState } from "react"
import { authService } from "@/services/auth.service"
import { favoriteService } from "@/services/favorite.service"

/**
 * Kết quả toggle: dùng interface "phẳng" (không phải union) để `res.reason` /
 * `res.message` luôn tồn tại trên type — tránh lỗi narrowing ở editor/TS cũ.
 */
export interface ToggleResult {
  ok: boolean
  favorited?: boolean
  movieIds?: string[]
  reason?: "login" | "error"
  message?: string
}

/**
 * Hook quản lý danh sách phim yêu thích của người dùng đang đăng nhập.
 * - Tự tải danh sách id khi mount (hoặc khi đổi user)
 * - `toggle(movieId)` gọi API và đồng bộ lại toàn bộ danh sách
 */
export function useFavorites() {
  const user = authService.getCurrentUser()
  const userId = user?.id

  const [movieIds, setMovieIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const reload = useCallback(async () => {
    if (!userId) {
      setMovieIds([])
      return
    }
    setIsLoading(true)
    try {
      const res = await favoriteService.getMyFavorites(userId)
      if (res.success && res.data) setMovieIds(res.data.movieIds)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const isFavorite = useCallback(
    (movieId: string) => movieIds.includes(movieId),
    [movieIds]
  )

  const toggle = useCallback(
    async (movieId: string): Promise<ToggleResult> => {
      if (!userId) {
        return { ok: false, reason: "login" }
      }
      setIsToggling(true)
      try {
        const res = await favoriteService.toggle(userId, movieId)
        if (res.success && res.data) {
          setMovieIds(res.data.movieIds)
          return {
            ok: true,
            favorited: res.data.favorited,
            movieIds: res.data.movieIds,
          }
        }
        return { ok: false, reason: "error", message: res.message }
      } finally {
        setIsToggling(false)
      }
    },
    [userId]
  )

  return {
    movieIds,
    isFavorite,
    toggle,
    reload,
    isLoading,
    isToggling,
    isLoggedIn: Boolean(userId),
  }
}
