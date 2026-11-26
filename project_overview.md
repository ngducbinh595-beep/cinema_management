# 🎬 Cinema Management — Tổng Quan Dự Án

> **Website đặt vé xem phim + AI tư vấn & AI vận hành rạp** (Đồ án Tích hợp Hệ thống).  
> **Cập nhật:** 22/11/2026 · **GitHub:** [cinema_management](https://github.com/ngducbinh595-beep/cinema_management.git) (`main`)

---

## 1. Công nghệ & Môi trường

| Phân hệ | Công nghệ | Cổng / Đường dẫn | Trạng thái |
|---|---|---|---|
| **Frontend** | React 19 · TS 6 · Vite 8 · Tailwind v4 · shadcn/ui · React Router 7 | `http://localhost:5173` | Hoạt động |
| **Backend** | Express 5 · TS ESM · mysql2 (SQL thuần) · JWT · bcryptjs | `http://localhost:3001` | Hoạt động |
| **Database** | MySQL (`quanlyrapchieuphim`, `utf8mb4`) | `localhost:3306` | File: `cinema_management.sql` |
| **AI Model** | Google GenAI SDK (`gemini-3.5-flash-lite`) | API Google | Tích hợp qua `.env` |
| **API Base** | `http://localhost:3001/api` | Quản lý tại: `Frontend/src/services/api.ts` |

---

## 2. Phân quyền Người dùng (RBAC)

*Bắt buộc đăng nhập để đặt vé và thanh toán. Không có luồng thanh toán khách vãng lai.*

| Vai trò | Phạm vi truy cập & Quyền hạn | Điều hướng mặc định |
|---|---|---|
| **`customer`** | Xem phim, tra cứu lịch, dùng AI tư vấn, chọn ghế, thanh toán, nhận vé PDF/QR, đánh giá phim | `/homepage` |
| **`manager`** | Quản lý phim, duyệt lịch chiếu AI, cấu hình phòng, xem báo cáo doanh thu | `/admin` |
| **`admin`** | Toàn quyền hệ thống + Quản lý danh sách tài khoản và phân quyền | `/admin` |

---

## 3. Trạng thái Mã nguồn trên GitHub

* **Đã đẩy lên GitHub (21 file):**
  * Thiết lập & môi trường: `package.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `cinema_management.sql`.
  * **FR01 – FR05:** Toàn bộ code giao diện và API của Đăng ký, Đăng nhập, Tài khoản, Phim và Lịch chiếu.
* **Bảo vệ cục bộ (Chưa public):** Sơ đồ ghế nâng cao, cổng thanh toán, thuật toán giữ ghế real-time, AI Forecast doanh thu.

---

## 4. Bảng Chi Tiết 17 Use Case (FR01 – FR17)

### A. Nhóm Khách Hàng & Xem Phim (Đã đẩy GitHub)
| Mã | Chức năng | Mô tả ngắn | File chính (FE / BE) |
|---|---|---|---|
| **FR01** | **Đăng ký tài khoản** | Kiểm tra trùng Email/SĐT, băm mật khẩu bcrypt | `RegisterPage.tsx` / `routes/auth.ts` |
| **FR02** | **Đăng nhập / Đăng xuất** | Cấp JWT Token 7 ngày, điều hướng theo Role | `LoginPage.tsx` / `routes/auth.ts` |
| **FR03** | **Quản lý tài khoản** | Đổi thông tin, xem điểm tích lũy, đổi mật khẩu | `AccountPage.tsx` / `routes/user.ts` |
| **FR04** | **Danh sách & Chi tiết phim** | Lọc thể loại, tìm kiếm, xem trailer, diễn viên | `MoviesPage.tsx`, `MovieDetailPage.tsx` / `routes/movie.ts` |
| **FR05** | **Tra cứu lịch chiếu** | Lọc lịch theo phim, cụm rạp và ngày chiếu | `ShowtimesPage.tsx` / `routes/showtime.ts` |

### B. Nhóm Đặt Vé & Thanh Toán
| Mã | Chức năng | Mô tả ngắn | File chính (FE / BE) |
|---|---|---|---|
| **FR06** | **Chọn ghế & Giữ ghế** | Sơ đồ ghế (Thường/VIP/Đôi), giữ ghế 10 phút | `pages/booking/` / `routes/booking.ts` |
| **FR07** | **Áp dụng Voucher** | Nhập mã giảm giá, trừ trực tiếp vào tổng tiền | `pages/booking/` / `routes/booking.ts` |
| **FR08** | **Thanh toán trực tuyến** | Quét mã QR thanh toán (MoMo / Ngân hàng) | `pages/booking/` / `routes/payment.ts` |
| **FR09** | **Vé điện tử & Xuất PDF** | Hiển thị mã QR check-in, xuất PDF vé + Google Maps chỉ rạp | `pages/tickets/` / `routes/booking.ts` |

### C. Nhóm AI & Tiện Ích
| Mã | Chức năng | Mô tả ngắn | File chính (FE / BE) |
|---|---|---|---|
| **FR10** | **AI Tư vấn phim (`/ai`)** | Gợi ý phim theo tâm trạng, cảm xúc, dịp xem | `pages/ai/` / `routes/ai.ts` |
| **FR11** | **Đánh giá phim** | Chấm điểm sao (1-5★) và bình luận sau xem | `MovieDetailPage.tsx` |
| **FR12** | **Đề xuất rạp gần nhất** | Định vị và gợi ý cụm rạp gần vị trí khách nhất | `pages/cinemas/` |

### D. Nhóm Quản Trị & Vận Hành (Admin / Manager)
| Mã | Chức năng | Mô tả ngắn | File chính (FE / BE) |
|---|---|---|---|
| **FR13** | **Quản lý phim & Trailer** | Thêm/sửa phim, nhúng link trailer YouTube | `admin/AdminMoviesPage.tsx` / `routes/movie.ts` |
| **FR14** | **Quản lý phòng & Giá vé** | Thiết lập loại phòng (2D/3D/IMAX), sửa giá vé | `admin/AdminRoomsPage.tsx` / `routes/room.ts` |
| **FR15** | **AI Xếp lịch tự động** | Tự xếp suất chiếu theo khung giờ vàng và phòng | `admin/AdminShowtimesPage.tsx` / `services/schedule-ai.service.ts` |
| **FR16** | **AI Dự báo & Thống kê** | Dự báo doanh thu, thống kê theo phòng và theo phim | `admin/AdminOverviewPage.tsx` / `services/insights-ai.service.ts` |
| **FR17** | **Quản lý người dùng** | Phân quyền tài khoản (Chỉ riêng quyền Admin) | `admin/AdminUsersPage.tsx` / `routes/user.ts` |

---

## 5. Danh Sách Việc Cần Làm (Todo / Backlog)

- [ ] **1. Sửa lỗi ghế theo suất chiếu:** Đổi khung giờ chiếu phải tải lại đúng số ghế trống theo `showtime_id`.
- [ ] **2. Xuất vé PDF đẹp:** Canh chỉnh layout thẻ vé, chèn mã QR check-in, thêm địa chỉ rạp và link Google Maps.
- [ ] **3. Thêm Trailer phim:** Bổ sung ô nhập link YouTube trailer khi thêm phim trong Admin.
- [ ] **4. Tính năng Đánh giá phim:** Thêm chấm điểm sao và bình luận ở trang chi tiết phim.
- [ ] **5. Voucher & Sửa giá vé:** Thêm ô áp voucher ở thanh toán và chức năng sửa giá vé trong Admin.
- [x] **6. Báo cáo doanh thu nâng cao:** Thống kê doanh số chi tiết theo từng phòng và theo từng phim (Đã hoàn thiện kèm bộ lọc ngày/tháng và xuất CSV).
- [ ] **7. Sửa sơ đồ Use Case:** Cập nhật tài liệu: bỏ khách vãng lai, gộp AI vào khách hàng, vẽ lại luồng quên mật khẩu.
