import poster1 from "@/assets/movies/poster-tin-hieu-tu-ngay-mai.png"
import poster2 from "@/assets/movies/poster-qua-mien-ky-uc.png"
import poster3 from "@/assets/movies/poster-chuyen-tau-binh-minh.png"
import poster4 from "@/assets/movies/poster-thanh-pho-khong-ngu.png"
import poster5 from "@/assets/movies/poster-khu-rung-biet-noi.png"
import poster6 from "@/assets/movies/poster-mua-he-o-lai.png"
import comingPoster1 from "@/assets/movies/poster-quy-dao-cuoi-cung.png"
import comingPoster2 from "@/assets/movies/poster-sau-con-mua.png"
import trailerTinHieu from "@/assets/movies/trailer-tin-hieu-tu-ngay-mai.png"
import type { Movie } from "@/types"

export const NAV_LINKS = [
  { name: "Trang chủ", path: "/homepage" },
  { name: "Phim", path: "/movies" },
  { name: "Lịch chiếu", path: "/showtimes" },
  { name: "Rạp & giá vé", path: "/cinemas" },
]

export const NOW_SHOWING_MOVIES: Movie[] = [
  {
    id: "1",
    title: "Tín hiệu từ ngày mai",
    rating: "T13",
    genre: "Khoa học viễn tưởng · Tâm lý",
    duration: "118 phút",
    poster: poster1,
    synopsis: "Khi một kỹ sư trẻ nhận được tín hiệu vô tuyến từ chính mình ở tương lai, cô phải lựa chọn giữa cứu một thành phố và giữ lại người thân yêu. Một hành trình về ký ức, lòng can đảm và những điều ta không muốn đánh mất.",
    status: "now_showing",
    director: "Trần Minh Khoa",
    cast: "Hà An, Lê Duy, Nguyễn Phương",
    releaseDate: "16/10/2026",
    country: "Việt Nam",
    format: "2D · Phụ đề Việt",
    ratingDescription: "T13 · Phim dành cho khán giả từ đủ 13 tuổi trở lên.",
    trailerThumbnail: trailerTinHieu,
    trailerDuration: "02:14",
    aiRecommendation: "Yếu tố tương lai và cảm xúc gia đình, không thiên về kinh dị. Phù hợp buổi hẹn thích một câu chuyện có chiều sâu.",
  },
  {
    id: "2",
    title: "Qua miền ký ức",
    rating: "T13",
    genre: "Khoa học viễn tưởng",
    duration: "106 phút",
    poster: poster2,
    status: "now_showing",
  },
  {
    id: "3",
    title: "Chuyến tàu bình minh",
    rating: "P",
    genre: "Phiêu lưu",
    duration: "112 phút",
    poster: poster3,
    status: "now_showing",
  },
  {
    id: "4",
    title: "Thành phố không ngủ",
    rating: "T18",
    genre: "Hành động",
    duration: "124 phút",
    poster: poster4,
    status: "now_showing",
  },
  {
    id: "5",
    title: "Khu rừng biết nói",
    rating: "P",
    genre: "Hoạt hình",
    duration: "95 phút",
    poster: poster5,
    status: "now_showing",
  },
  {
    id: "6",
    title: "Mùa hè ở lại",
    rating: "T13",
    genre: "Tình cảm",
    duration: "102 phút",
    poster: poster6,
    status: "now_showing",
  },
]

export const COMING_SOON_MOVIES: Movie[] = [
  {
    id: "c1",
    title: "Quỹ đạo cuối cùng",
    rating: "T16",
    genre: "Khoa học viễn tưởng",
    duration: "130 phút",
    poster: comingPoster1,
    releaseDate: "30/10/2026",
    status: "coming_soon",
  },
  {
    id: "c2",
    title: "Sau cơn mưa",
    rating: "T13",
    genre: "Tâm lý",
    duration: "110 phút",
    poster: comingPoster2,
    releaseDate: "05/11/2026",
    status: "coming_soon",
  },
]

export const CINEMAS = [
  "Cinema Nguyễn Du",
  "Cinema Thảo Điền",
  "Cinema Landmark 81",
  "Cinema Ba Tháng Hai",
]
