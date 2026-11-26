export interface Movie {
  id: string
  title: string
  rating: "P" | "T13" | "T16" | "T18"
  genre: string
  duration: string
  poster: string
  synopsis?: string
  releaseDate?: string
  status?: "now_showing" | "coming_soon"
  director?: string
  cast?: string
  country?: string
  format?: string
  ratingDescription?: string
  trailerThumbnail?: string
  trailerDuration?: string
  aiRecommendation?: string
}

export interface Cinema {
  id: string
  name: string
  address: string
  roomsCount: number
  hasDolbyAtmos: boolean
  hasVIPSeats: boolean
  image?: string
}

export interface QuickBookingFormData {
  movieId: string
  cinemaId: string
  date: string
}
