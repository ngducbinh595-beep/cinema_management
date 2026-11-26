Dưới đây là bản `README.md` gọn gàng, khái quát (không đánh mã FR, dễ mở rộng về sau khi nhóm bạn cập nhật thêm tính năng):

````markdown
# 🎬 Cinema Management — Ứng Dụng Quản Lý Rạp Chiếu Phim Tích Hợp AI Dự Báo Doanh Thu

> Hệ thống đặt vé xem phim trực tuyến kết hợp trí tuệ nhân tạo (AI) hỗ trợ tư vấn khách hàng, vận hành rạp và dự báo doanh thu.

---

## ✨ Giới thiệu tổng quan

**Cinema Management** là nền tảng web phục vụ đồng thời trải nghiệm đặt vé của khán giả và công tác quản lý, vận hành tại rạp chiếu phim:

- **Dành cho Khách hàng:** Tra cứu phim đang chiếu/sắp chiếu, xem trailer & đánh giá, lọc lịch chiếu theo rạp, chọn ghế trực quan, áp dụng ưu đãi, thanh toán trực tuyến và nhận vé điện tử QR.
- **Trợ lý AI thông minh:** Tư vấn và gợi ý phim phù hợp theo tâm trạng, sở thích và nhu cầu của người xem.
- **Dành cho Quản lý & Admin:** Quản lý danh mục phim, phòng chiếu, suất chiếu, giá vé, tài khoản phân quyền; tích hợp AI hỗ trợ xếp lịch chiếu tự động, thống kê và dự báo doanh thu.

---

## 🛠️ Công nghệ sử dụng

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router
- **Backend:** Node.js, Express, TypeScript, JWT, `bcryptjs`
- **Database:** MySQL (`mysql2`)
- **AI Integration:** Google Gemini API (`@google/genai`)

---

## 📂 Cấu trúc dự án

```text
cinema_management/
├── Backend/                  # API Server, xác thực, nghiệp vụ & tích hợp AI
├── Frontend/                 # Giao diện khách hàng & bảng điều khiển quản trị
└── cinema_management.sql     # Script khởi tạo cơ sở dữ liệu MySQL
```

---

## 🚀 Hướng dẫn cài đặt & Chạy dự án

### 1. Clone mã nguồn
```bash
git clone https://github.com/ngducbinh595-beep/cinema_management.git
cd cinema_management
```

### 2. Khởi tạo Cơ sở dữ liệu
Import file `cinema_management.sql` vào **MySQL** để tạo cơ sở dữ liệu và dữ liệu mẫu ban đầu.

### 3. Chạy Backend
```bash
cd Backend
npm install
```
Tạo file `.env` dựa trên file `.env.example` (cấu hình thông tin kết nối MySQL, `JWT_SECRET` và `GEMINI_API_KEY`), sau đó chạy:
```bash
npm run dev
```

### 4. Chạy Frontend
Mở một terminal mới:
```bash
cd Frontend
npm install
npm run dev
```
Sau khi khởi chạy, truy cập giao diện web theo đường dẫn hiển thị trên terminal (mặc định `http://localhost:5173`).

---

> 📌 *Dự án hiện đang trong quá trình phát triển và tiếp tục cập nhật các tính năng mới.*
````
