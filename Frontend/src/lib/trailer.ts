/**
 * Lấy ID video từ các dạng link YouTube phổ biến:
 * youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
 */
export function getYouTubeId(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "")
    let id: string | null = null

    if (host === "youtu.be") {
      id = u.pathname.slice(1).split("/")[0]
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v")
      else {
        const match = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/)
        id = match ? match[1] : null
      }
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** Link nhúng iframe an toàn (youtube-nocookie) — null nếu không phải link YouTube */
export function getYouTubeEmbedUrl(url?: string | null, autoplay = true): string | null {
  const id = getYouTubeId(url)
  if (!id) return null
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${autoplay ? "&autoplay=1" : ""}`
}

export function getYouTubeThumbnail(url?: string | null): string | null {
  const id = getYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

/** Chỉ cho phép link http(s) (rỗng cũng hợp lệ vì trailer là tùy chọn) */
export function isValidTrailerUrl(url: string): boolean {
  const value = url.trim()
  if (!value) return true
  if (value.length > 500) return false
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}
