-- =====================================================
-- CINEMA MANAGEMENT — SQL Setup Script
-- MySQL 9.x | Charset: utf8mb4
-- =====================================================
-- Chạy file này để tạo toàn bộ database + seed data
-- Lệnh: mysql -u root -p < cinema_management.sql
-- =====================================================

-- 0. Tạo và chọn database
CREATE DATABASE IF NOT EXISTS quanlyrapchieuphim
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quanlyrapchieuphim;

-- =====================================================
-- BẢNG 1: users — Tài khoản người dùng
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  phone         VARCHAR(20)   DEFAULT NULL,
  date_of_birth DATE          DEFAULT NULL,      -- ngày sinh
  password      VARCHAR(255)  NOT NULL,          -- bcrypt hash
  role          ENUM('customer','manager','admin') NOT NULL DEFAULT 'customer',
  status        ENUM('active','locked','unverified') NOT NULL DEFAULT 'active',
  avatar_url    VARCHAR(500)  DEFAULT NULL,
  points        INT UNSIGNED  DEFAULT 0,         -- điểm tích lũy quy đổi hạng thành viên
  last_login    DATETIME      DEFAULT NULL,      -- thời gian đăng nhập cuối
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 2: cinemas — Cụm rạp Cinema Management
-- =====================================================
CREATE TABLE IF NOT EXISTS cinemas (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(150)  NOT NULL,
  address           TEXT          NOT NULL,
  district          VARCHAR(100)  DEFAULT NULL,
  city              VARCHAR(100)  DEFAULT NULL,
  phone             VARCHAR(20)   DEFAULT NULL,
  has_dolby_atmos   TINYINT(1)    NOT NULL DEFAULT 0,
  has_vip_seats     TINYINT(1)    NOT NULL DEFAULT 0,
  has_imax          TINYINT(1)    NOT NULL DEFAULT 0,
  has_4dx           TINYINT(1)    NOT NULL DEFAULT 0,
  image_url         VARCHAR(500)  DEFAULT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 3: rooms — Phòng chiếu
-- =====================================================
CREATE TABLE IF NOT EXISTS rooms (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cinema_id     INT UNSIGNED NOT NULL,
  name          VARCHAR(50)  NOT NULL,           -- ví dụ: "Phòng 01"
  total_seats   SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  regular_count SMALLINT UNSIGNED NOT NULL DEFAULT 80,
  vip_count     SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  format        VARCHAR(20)  NOT NULL DEFAULT '2D', -- 2D, IMAX, 4DX
  audio         VARCHAR(50)  NOT NULL DEFAULT 'Dolby Atmos',
  rows_count    TINYINT UNSIGNED NOT NULL DEFAULT 8,
  cols_count    TINYINT UNSIGNED NOT NULL DEFAULT 14,
  vip_rows      VARCHAR(50)  DEFAULT 'F,G',      -- ký hiệu hàng VIP
  status        ENUM('active','maintenance') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 4: movies — Phim
-- =====================================================
CREATE TABLE IF NOT EXISTS movies (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title               VARCHAR(200) NOT NULL,
  rating              ENUM('P','T13','T16','T18') NOT NULL DEFAULT 'T13',
  rating_description  VARCHAR(200) DEFAULT NULL,
  genre               VARCHAR(100) NOT NULL,
  duration_min        SMALLINT UNSIGNED NOT NULL,         -- thời lượng phút
  synopsis            TEXT DEFAULT NULL,
  director            VARCHAR(100) DEFAULT NULL,
  cast_members        TEXT DEFAULT NULL,
  release_date        DATE DEFAULT NULL,
  country             VARCHAR(100) DEFAULT NULL,
  format              VARCHAR(50)  DEFAULT '2D · Phụ đề Việt',
  poster_url          VARCHAR(500) DEFAULT NULL,
  trailer_url         VARCHAR(500) DEFAULT NULL,
  ai_recommendation   TEXT DEFAULT NULL,
  status              ENUM('now_showing','coming_soon','ended') NOT NULL DEFAULT 'now_showing',
  is_featured         TINYINT(1) NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 5: showtimes — Suất chiếu
-- =====================================================
CREATE TABLE IF NOT EXISTS showtimes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  movie_id      INT UNSIGNED NOT NULL,
  room_id       INT UNSIGNED NOT NULL,
  start_time    DATETIME     NOT NULL,
  end_time      DATETIME     NOT NULL,
  price_regular DECIMAL(10,0) NOT NULL DEFAULT 70000,
  price_vip     DECIMAL(10,0) NOT NULL DEFAULT 100000,
  format        VARCHAR(50)  DEFAULT '2D Dolby Atmos',
  status        ENUM('active','cancelled','full') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id)  REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 6: seats — Sơ đồ ghế từng phòng
-- =====================================================
CREATE TABLE IF NOT EXISTS seats (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id       INT UNSIGNED NOT NULL,
  row_label     CHAR(2)      NOT NULL,   -- A, B, C, D, E, F, G, H
  col_number    TINYINT UNSIGNED NOT NULL,
  seat_type     ENUM('regular','vip','sweetbox') NOT NULL DEFAULT 'regular',
  UNIQUE KEY uq_seat (room_id, row_label, col_number),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 7: bookings — Đơn đặt vé
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  showtime_id     INT UNSIGNED NOT NULL,
  booking_code    VARCHAR(30)  NOT NULL UNIQUE,  -- CM-DDMM-XXXXX
  customer_name   VARCHAR(100) DEFAULT NULL,
  customer_email  VARCHAR(150) DEFAULT NULL,
  customer_phone  VARCHAR(20)  DEFAULT NULL,
  total_price     DECIMAL(10,0) NOT NULL,
  discount_amount DECIMAL(10,0) NOT NULL DEFAULT 0,
  promo_code      VARCHAR(30)  DEFAULT NULL,
  payment_method  ENUM('momo','zalopay','card','vnpay') NOT NULL DEFAULT 'momo',
  payment_status  ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  hold_expires_at DATETIME     DEFAULT NULL,      -- thời điểm hết hạn giữ ghế (10 phút)
  status          ENUM('upcoming','completed','cancelled') NOT NULL DEFAULT 'upcoming',
  qr_code         VARCHAR(500) DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 8: booking_seats — Ghế trong từng đơn đặt vé
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_seats (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT UNSIGNED NOT NULL,
  seat_id     INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_booking_seat (booking_id, seat_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id)    REFERENCES seats(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- BẢNG 9: pricing_tiers — Bảng giá theo khung giờ
-- =====================================================
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cinema_id     INT UNSIGNED NOT NULL,
  time_slot     VARCHAR(80)  NOT NULL,       -- ví dụ: "Ngày thường (Trước 17:00)"
  apply_days    VARCHAR(50)  NOT NULL,       -- "Thứ Hai - Thứ Sáu"
  regular_price DECIMAL(10,0) NOT NULL,
  vip_price     DECIMAL(10,0) NOT NULL,
  FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- ██████████████  SEED DATA  ██████████████
-- =====================================================

-- ── USERS ───────────────────────────────────────────
-- Mật khẩu mặc định cho toàn bộ tài khoản mẫu: "password123"
INSERT INTO users (name, email, phone, password, role, status, points) VALUES
  ('Nguyễn Minh Anh',    'minhanh.nguyen@email.com', '0912345678', '$2b$10$1U17.i265JBNWnNLB5WhfOdd8d0E2/LKnRBvmZ8ICL5ZNp4i0MtyW', 'customer', 'active', 120),
  ('Trần Thu Hà',        'thuha@cinemamanagement.vn',            '0912345679', '$2b$10$1U17.i265JBNWnNLB5WhfOdd8d0E2/LKnRBvmZ8ICL5ZNp4i0MtyW', 'admin',    'active', 0),
  ('Nguyễn Hoàng Nam',   'hoangnam@cinemamanagement.vn',         '0908765432', '$2b$10$1U17.i265JBNWnNLB5WhfOdd8d0E2/LKnRBvmZ8ICL5ZNp4i0MtyW', 'admin',    'active', 0),
  ('Lê Thị Thanh Hương', 'thanh.huong@email.com',     '0978123456', '$2b$10$1U17.i265JBNWnNLB5WhfOdd8d0E2/LKnRBvmZ8ICL5ZNp4i0MtyW', 'customer', 'active', 0),
  ('Phạm Văn Đức',       'vanduc.pham@email.com',     '0961234567', '$2b$10$1U17.i265JBNWnNLB5WhfOdd8d0E2/LKnRBvmZ8ICL5ZNp4i0MtyW',  'customer', 'active', 45),
  ('Hoàng Thị Lan',      'hlan@email.com',             '0937654321', '$2b$10$1U17.i265JBNWnNLB5WhfOdd8d0E2/LKnRBvmZ8ICL5ZNp4i0MtyW',  'customer', 'locked', 10);

-- ── CINEMAS ─────────────────────────────────────────
INSERT INTO cinemas (name, address, district, city, phone, has_dolby_atmos, has_vip_seats, has_imax, has_4dx) VALUES
  ('Cinema Nguyễn Du',  '135 Nguyễn Du, Bến Thành',             'Quận 1',      'TP. Hồ Chí Minh', '028 3825 1234', 1, 1, 0, 1),
  ('Cinema Thảo Điền',  'Masteri Thảo Điền, 159 Xa Lộ Hà Nội', 'TP. Thủ Đức', 'TP. Hồ Chí Minh', '028 3744 5678', 1, 1, 1, 0),
  ('Cinema Landmark 81','Vinhomes Central Park, Điện Biên Phủ', 'Bình Thạnh',   'TP. Hồ Chí Minh', '028 3512 9000', 1, 1, 1, 1),
  ('Cinema Ba Tháng Hai','750 Ba Tháng Hai, Phường 11',         'Quận 10',     'TP. Hồ Chí Minh', '028 3853 4321', 1, 1, 0, 0);

-- ── ROOMS (Cinema Nguyễn Du — 6 phòng) ──────────────
INSERT INTO rooms (cinema_id, name, total_seats, regular_count, vip_count, format, audio, rows_count, cols_count, vip_rows) VALUES
  (1, 'Phòng 01', 120, 80, 40, '2D',   'Dolby Atmos', 7, 14, 'F,G'),
  (1, 'Phòng 02',  96, 64, 32, '2D',   'Dolby Atmos', 7, 12, 'F,G'),
  (1, 'Phòng 03', 120, 70, 50, '2D',   'Dolby Atmos', 8, 14, 'F,G,H'),
  (1, 'Phòng 04', 160,100, 60, 'IMAX', 'Dolby Atmos', 9, 16, 'G,H,I'),
  (1, 'Phòng 05',  80, 50, 30, '2D',   'Dolby Atmos', 7, 10, 'F,G'),
  (1, 'Phòng 06', 110, 70, 40, '4DX',  'Dolby Atmos', 8, 12, 'F,G,H');

-- ── ROOMS (Cinema Thảo Điền — 4 phòng) ──────────────
INSERT INTO rooms (cinema_id, name, total_seats, regular_count, vip_count, format, audio, rows_count, cols_count, vip_rows) VALUES
  (2, 'Phòng 01',  96, 64, 32, '2D',   'Dolby Atmos', 7, 12, 'F,G'),
  (2, 'Phòng 02', 120, 80, 40, '2D',   'Dolby Atmos', 7, 14, 'F,G'),
  (2, 'Phòng 03', 180,110, 70, 'IMAX', 'Dolby Atmos', 9, 18, 'G,H,I'),
  (2, 'Phòng 04',  80, 50, 30, '2D',   'Dolby Atmos', 7, 10, 'F,G');

-- ── ROOMS (Cinema Landmark 81 — 8 phòng) ─────────────
INSERT INTO rooms (cinema_id, name, total_seats, regular_count, vip_count, format, audio, rows_count, cols_count, vip_rows) VALUES
  (3, 'Phòng 01', 120, 80, 40, '2D',        'Dolby Atmos', 7, 14, 'F,G'),
  (3, 'Phòng 02',  96, 64, 32, '2D',        'Dolby Atmos', 7, 12, 'F,G'),
  (3, 'Phòng 03', 200,130, 70, 'IMAX',      'Dolby Atmos', 9, 20, 'G,H,I'),
  (3, 'Phòng 04', 110, 70, 40, '4DX',       'Dolby Atmos', 8, 12, 'F,G,H'),
  (3, 'Phòng 05', 150, 90, 60, '2D',        'Dolby Atmos', 8, 16, 'F,G,H'),
  (3, 'Phòng 06',  80, 50, 30, '2D',        'Stereo',      7, 10, 'F,G'),
  (3, 'Phòng 07', 120, 80, 40, '2D',        'Dolby Atmos', 7, 14, 'F,G'),
  (3, 'Phòng 08',  60,  0, 60, 'VIP Lounge','Dolby Atmos', 5,  10, 'A,B,C,D,E');

-- ── ROOMS (Cinema Ba Tháng Hai — 5 phòng) ────────────
INSERT INTO rooms (cinema_id, name, total_seats, regular_count, vip_count, format, audio, rows_count, cols_count, vip_rows) VALUES
  (4, 'Phòng 01', 120, 80, 40, '2D',   'Dolby Atmos', 7, 14, 'F,G'),
  (4, 'Phòng 02',  96, 64, 32, '2D',   'Dolby Atmos', 7, 12, 'F,G'),
  (4, 'Phòng 03', 120, 70, 50, '2D',   'Dolby Atmos', 8, 14, 'F,G,H'),
  (4, 'Phòng 04',  80, 50, 30, '2D',   'Stereo',      7, 10, 'F,G'),
  (4, 'Phòng 05', 100, 60, 40, '2D',   'Dolby Atmos', 7, 12, 'F,G');

-- ── MOVIES (Đang chiếu — 6 phim) ─────────────────────
INSERT INTO movies (title, rating, rating_description, genre, duration_min, synopsis, director, cast_members, release_date, country, format, ai_recommendation, status, is_featured) VALUES
  (
    'Tín hiệu từ ngày mai', 'T13',
    'T13 · Phim dành cho khán giả từ đủ 13 tuổi trở lên.',
    'Khoa học viễn tưởng · Tâm lý', 118,
    'Khi một kỹ sư trẻ nhận được tín hiệu vô tuyến từ chính mình ở tương lai, cô phải lựa chọn giữa cứu một thành phố và giữ lại người thân yêu. Một hành trình về ký ức, lòng can đảm và những điều ta không muốn đánh mất.',
    'Trần Minh Khoa', 'Hà An, Lê Duy, Nguyễn Phương',
    '2026-10-16', 'Việt Nam', '2D · Phụ đề Việt',
    'Yếu tố tương lai và cảm xúc gia đình, không thiên về kinh dị. Phù hợp buổi hẹn thích một câu chuyện có chiều sâu.',
    'now_showing', 1
  ),
  (
    'Qua miền ký ức', 'T13', NULL,
    'Khoa học viễn tưởng', 106, NULL, NULL, NULL,
    '2026-10-10', 'Việt Nam', '2D · Phụ đề Việt', NULL,
    'now_showing', 1
  ),
  (
    'Chuyến tàu bình minh', 'P', NULL,
    'Phiêu lưu', 112, NULL, NULL, NULL,
    '2026-10-05', 'Việt Nam', '2D · Lồng tiếng', NULL,
    'now_showing', 0
  ),
  (
    'Thành phố không ngủ', 'T18', NULL,
    'Hành động', 124, NULL, NULL, NULL,
    '2026-10-12', 'Việt Nam', '2D · Phụ đề Việt', NULL,
    'now_showing', 1
  ),
  (
    'Khu rừng biết nói', 'P', NULL,
    'Hoạt hình', 95, NULL, NULL, NULL,
    '2026-10-01', 'Việt Nam', '2D · Lồng tiếng', NULL,
    'now_showing', 0
  ),
  (
    'Mùa hè ở lại', 'T13', NULL,
    'Tình cảm', 102, NULL, NULL, NULL,
    '2026-10-08', 'Việt Nam', '2D · Phụ đề Việt', NULL,
    'now_showing', 0
  );

-- ── MOVIES (Sắp chiếu — 2 phim) ──────────────────────
INSERT INTO movies (title, rating, genre, duration_min, release_date, country, format, status, is_featured) VALUES
  ('Quỹ đạo cuối cùng', 'T16', 'Khoa học viễn tưởng', 130, '2026-10-30', 'Việt Nam', '2D · Phụ đề Việt', 'coming_soon', 0),
  ('Sau cơn mưa',       'T13', 'Tâm lý',               110, '2026-11-05', 'Việt Nam', '2D · Phụ đề Việt', 'coming_soon', 0);

-- ── SHOWTIMES — Phòng 01 (cinema Nguyễn Du) ngày 24/10/2026 ──
INSERT INTO showtimes (movie_id, room_id, start_time, end_time, price_regular, price_vip, format, status) VALUES
  (1, 1, '2026-10-24 09:30:00', '2026-10-24 11:28:00', 90000, 120000, '2D Dolby Atmos', 'active'),
  (4, 1, '2026-10-24 14:00:00', '2026-10-24 16:04:00', 90000, 120000, '2D Dolby Atmos', 'active'),
  (1, 1, '2026-10-24 19:30:00', '2026-10-24 21:28:00', 90000, 120000, '2D Dolby Atmos', 'active');

-- ── SHOWTIMES — Phòng 03 (cinema Nguyễn Du) ngày 24/10/2026 ──
INSERT INTO showtimes (movie_id, room_id, start_time, end_time, price_regular, price_vip, format, status) VALUES
  (2, 3, '2026-10-24 10:00:00', '2026-10-24 11:46:00', 90000, 120000, '2D Dolby Atmos', 'active'),
  (3, 3, '2026-10-24 14:00:00', '2026-10-24 15:52:00', 90000, 120000, '2D Dolby Atmos', 'active'),
  (5, 3, '2026-10-24 09:00:00', '2026-10-24 10:35:00', 90000, 120000, '2D Dolby Atmos', 'active');

-- ── SHOWTIMES — Phòng 04 IMAX ngày 25/10/2026 ───────
INSERT INTO showtimes (movie_id, room_id, start_time, end_time, price_regular, price_vip, format, status) VALUES
  (1, 4, '2026-10-25 18:45:00', '2026-10-25 20:43:00', 120000, 160000, 'IMAX Dolby Atmos', 'active'),
  (4, 4, '2026-10-25 21:00:00', '2026-10-25 23:04:00', 120000, 160000, 'IMAX Dolby Atmos', 'active');

-- ── PRICING TIERS (Nguyễn Du) ─────────────────────────
INSERT INTO pricing_tiers (cinema_id, time_slot, apply_days, regular_price, vip_price) VALUES
  (1, 'Ngày thường (Trước 17:00)', 'Thứ Hai - Thứ Sáu', 70000, 100000),
  (1, 'Ngày thường (Từ 17:00)',    'Thứ Hai - Thứ Sáu', 90000, 120000),
  (1, 'Cuối tuần (Cả ngày)',       'Thứ Bảy - Chủ Nhật', 90000, 120000),
  (1, 'Ngày lễ (Cả ngày)',         'Ngày Lễ Quốc Gia',  110000, 140000);

-- ── PRICING TIERS (Landmark 81 — IMAX) ──────────────
INSERT INTO pricing_tiers (cinema_id, time_slot, apply_days, regular_price, vip_price) VALUES
  (3, 'Ngày thường (Trước 17:00)', 'Thứ Hai - Thứ Sáu', 90000,  130000),
  (3, 'Ngày thường (Từ 17:00)',    'Thứ Hai - Thứ Sáu', 110000, 150000),
  (3, 'Cuối tuần (Cả ngày)',       'Thứ Bảy - Chủ Nhật', 120000, 160000),
  (3, 'Ngày lễ (Cả ngày)',         'Ngày Lễ Quốc Gia',  130000, 170000);

-- =====================================================
-- BẢNG 10: favorites — Phim yêu thích của người dùng
-- (Backend cũng tự tạo bảng này khi start, mục ở đây để cài mới đầy đủ)
-- =====================================================
CREATE TABLE IF NOT EXISTS favorites (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  movie_id    INT UNSIGNED NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_movie (user_id, movie_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── SAMPLE BOOKING ────────────────────────────────────
INSERT INTO bookings (user_id, showtime_id, booking_code, customer_name, customer_email, customer_phone, total_price, discount_amount, payment_method, payment_status, status, qr_code, created_at)
VALUES
  (1, 1, 'CM-2410-TNH01', 'Nguyễn Minh Anh',    'minhanh.nguyen@email.com', '0912345678', 1020000, 0, 'momo',    'paid', 'completed', 'https://cinemamanagement.vn/checkin/CM-2410-TNH01', '2026-10-24 08:15:00'),
  (4, 2, 'CM-2410-TPK02', 'Lê Thị Thanh Hương', 'thanh.huong@email.com',    '0978123456',  540000, 0, 'zalopay', 'paid', 'completed', 'https://cinemamanagement.vn/checkin/CM-2410-TPK02', '2026-10-24 13:20:00'),
  (1, 3, 'CM-2410-TNH78', 'Nguyễn Minh Anh',    'minhanh.nguyen@email.com', '0912345678', 1770000, 0, 'momo',    'paid', 'upcoming',  'https://cinemamanagement.vn/checkin/CM-2410-TNH78', '2026-10-24 18:45:00'),
  (5, 4, 'CM-2410-QMK04', 'Phạm Văn Đức',       'vanduc.pham@email.com',    '0961234567',  990000, 0, 'vnpay',   'paid', 'completed', 'https://cinemamanagement.vn/checkin/CM-2410-QMK04', '2026-10-24 09:10:00'),
  (5, 5, 'CM-2410-CTB42', 'Phạm Văn Đức',       'vanduc.pham@email.com',    '0961234567', 1380000, 0, 'card',    'paid', 'completed', 'https://cinemamanagement.vn/checkin/CM-2410-CTB42', '2026-10-24 12:30:00'),
  (4, 6, 'CM-2410-KRB06', 'Lê Thị Thanh Hương', 'thanh.huong@email.com',    '0978123456',  540000, 0, 'momo',    'paid', 'completed', 'https://cinemamanagement.vn/checkin/CM-2410-KRB06', '2026-10-24 08:40:00'),
  (1, 7, 'CM-2510-IMX07', 'Nguyễn Minh Anh',    'minhanh.nguyen@email.com', '0912345678', 2000000, 0, 'card',    'paid', 'upcoming',  'https://cinemamanagement.vn/checkin/CM-2510-IMX07', '2026-10-25 17:00:00'),
  (5, 8, 'CM-2510-IMX08', 'Phạm Văn Đức',       'vanduc.pham@email.com',    '0961234567', 1640000, 0, 'zalopay', 'paid', 'upcoming',  'https://cinemamanagement.vn/checkin/CM-2510-IMX08', '2026-10-25 19:30:00');

-- ── SAMPLE SEATS & BOOKING_SEATS (Mỗi suất chiếu có sơ đồ ghế đã bán riêng biệt) ──
INSERT IGNORE INTO seats (room_id, row_label, col_number, seat_type) VALUES
  -- Phòng 01 (room_id = 1)
  (1, 'B', 4, 'regular'), (1, 'B', 5, 'regular'), (1, 'B', 6, 'regular'), (1, 'B', 7, 'regular'),
  (1, 'C', 5, 'regular'), (1, 'C', 6, 'regular'), (1, 'C', 7, 'regular'), (1, 'C', 8, 'regular'), (1, 'C', 9, 'regular'),
  (1, 'D', 5, 'regular'), (1, 'D', 6, 'regular'), (1, 'D', 7, 'regular'), (1, 'D', 8, 'regular'),
  (1, 'E', 4, 'regular'), (1, 'E', 5, 'regular'), (1, 'E', 6, 'regular'), (1, 'E', 7, 'regular'), (1, 'E', 8, 'regular'), (1, 'E', 9, 'regular'),
  (1, 'F', 5, 'vip'),     (1, 'F', 6, 'vip'),     (1, 'F', 7, 'vip'),
  (1, 'G', 7, 'vip'),     (1, 'G', 8, 'vip'),
  -- Phòng 03 (room_id = 3)
  (3, 'A', 6, 'regular'), (3, 'A', 7, 'regular'),
  (3, 'B', 3, 'regular'), (3, 'B', 4, 'regular'), (3, 'B', 8, 'regular'), (3, 'B', 9, 'regular'),
  (3, 'C', 3, 'regular'), (3, 'C', 4, 'regular'), (3, 'C', 5, 'regular'),
  (3, 'D', 6, 'regular'), (3, 'D', 7, 'regular'), (3, 'D', 9, 'regular'), (3, 'D', 10, 'regular'),
  (3, 'E', 5, 'regular'), (3, 'E', 6, 'regular'), (3, 'E', 7, 'regular'), (3, 'E', 8, 'regular'), (3, 'E', 9, 'regular'),
  (3, 'F', 4, 'vip'),     (3, 'F', 5, 'vip'),     (3, 'F', 6, 'vip'),     (3, 'F', 8, 'vip'),     (3, 'F', 9, 'vip'),
  (3, 'G', 5, 'vip'),     (3, 'G', 6, 'vip'),     (3, 'G', 8, 'vip'),     (3, 'G', 9, 'vip'),
  -- Phòng 04 IMAX (room_id = 4)
  (4, 'C', 6, 'regular'), (4, 'C', 7, 'regular'),
  (4, 'D', 7, 'regular'), (4, 'D', 8, 'regular'), (4, 'D', 9, 'regular'),
  (4, 'E', 5, 'regular'), (4, 'E', 6, 'regular'), (4, 'E', 7, 'regular'), (4, 'E', 8, 'regular'), (4, 'E', 9, 'regular'), (4, 'E', 10, 'regular'),
  (4, 'F', 5, 'regular'), (4, 'F', 6, 'regular'), (4, 'F', 7, 'regular'), (4, 'F', 8, 'regular'), (4, 'F', 9, 'regular'), (4, 'F', 10, 'regular'),
  (4, 'G', 7, 'vip'),     (4, 'G', 8, 'vip'),     (4, 'G', 9, 'vip'),     (4, 'G', 10, 'vip'),    (4, 'G', 11, 'vip'),
  (4, 'H', 8, 'vip'),     (4, 'H', 9, 'vip'),     (4, 'H', 10, 'vip'),    (4, 'H', 11, 'vip');

-- Suất 1 (09:30 Phòng 01): 10 ghế
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 1, id FROM seats WHERE room_id = 1 AND CONCAT(row_label, col_number) IN ('C5','C6','D5','D6','D7','D8','E6','E7','F6','F7');

-- Suất 2 (14:00 Phòng 01): 6 ghế khác biệt
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 2, id FROM seats WHERE room_id = 1 AND CONCAT(row_label, col_number) IN ('B6','B7','C8','C9','E4','E5');

-- Suất 3 (19:30 Phòng 01): 17 ghế giờ vàng
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 3, id FROM seats WHERE room_id = 1 AND CONCAT(row_label, col_number) IN ('B4','B5','C6','C7','C8','D5','D6','D7','D8','E6','E7','E8','E9','F5','F6','G7','G8');

-- Suất 4 (10:00 Phòng 03): 9 ghế
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 4, id FROM seats WHERE room_id = 3 AND CONCAT(row_label, col_number) IN ('C4','C5','D9','D10','F4','F5','F6','G8','G9');

-- Suất 5 (14:00 Phòng 03): 13 ghế
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 5, id FROM seats WHERE room_id = 3 AND CONCAT(row_label, col_number) IN ('A6','A7','B8','B9','D6','D7','E7','E8','E9','F8','F9','G5','G6');

-- Suất 6 (09:00 Phòng 03): 6 ghế
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 6, id FROM seats WHERE room_id = 3 AND CONCAT(row_label, col_number) IN ('B3','B4','C3','C4','E5','E6');

-- Suất 7 (18:45 Phòng 04 IMAX): 15 ghế
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 7, id FROM seats WHERE room_id = 4 AND CONCAT(row_label, col_number) IN ('D7','D8','D9','E7','E8','E9','E10','F7','F8','F9','F10','G7','G8','H8','H9');

-- Suất 8 (21:00 Phòng 04 IMAX): 11 ghế
INSERT IGNORE INTO booking_seats (booking_id, seat_id)
SELECT 8, id FROM seats WHERE room_id = 4 AND CONCAT(row_label, col_number) IN ('C6','C7','E5','E6','F5','F6','G9','G10','G11','H10','H11');

-- =====================================================
-- Xác nhận import thành công
-- =====================================================
SELECT 'Database quanlyrapchieuphim đã được tạo và import dữ liệu thành công! ✅' AS result;
SELECT CONCAT('users: ', COUNT(*))    AS info FROM users    UNION ALL
SELECT CONCAT('cinemas: ', COUNT(*))  FROM cinemas          UNION ALL
SELECT CONCAT('rooms: ', COUNT(*))    FROM rooms            UNION ALL
SELECT CONCAT('movies: ', COUNT(*))   FROM movies           UNION ALL
SELECT CONCAT('showtimes: ', COUNT(*)) FROM showtimes       UNION ALL
SELECT CONCAT('bookings: ', COUNT(*)) FROM bookings;
