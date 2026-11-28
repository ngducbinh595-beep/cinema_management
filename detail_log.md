
### 2. Chi tiết **18 file** mã nguồn (gồm **3 file tạo mới** + **15 file chỉnh sửa**)

#### A. Các file **TẠO MỚI** (3 file mã nguồn + 1 file Excel báo cáo)

| STT | File tạo mới | Mục đích tạo |
| :-: | :--- | :--- |
| 1 | [qrcode.ts](cinema_management-main/Frontend/src/lib/qrcode.ts) | Thuật toán sinh ma trận mã QR chuẩn quốc tế ISO/IEC 18004 (quét thật bằng camera điện thoại, không cần cài thêm thư viện npm). |
| 2 | [TicketQRCode.tsx](cinema_management-main/Frontend/src/components/common/TicketQRCode.tsx) | Component hiển thị mã QR vé sắc nét dạng SVG trên giao diện Thanh toán và Vé của tôi. |
| 3 | [ticketPdf.ts](cinema_management-main/Frontend/src/lib/ticketPdf.ts) | Bộ dàn trang & xuất file vé `.pdf` (`ve-<MÃ_VÉ>.pdf`) khổ A4 căn chỉnh bố cục đẹp, có mã QR vé, địa chỉ rạp và hotline. |

---

#### B. Các file **CHỈNH SỬA** (15 file: 6 file Backend/SQL + 9 file Frontend)

**Nhóm Database & Backend (6 file):**

| STT | File chỉnh sửa | Nội dung sửa |
| :-: | :--- | :--- |
| 1 | [cinema_management.sql](cinema_management-main/cinema_management.sql) | Bổ sung dữ liệu ghế mẫu (`seats`, `booking_seats`) riêng biệt cho từng suất chiếu để không bị trùng nhau. |
| 2 | [booking.model.ts](cinema_management-main/Backend/src/models/booking.model.ts) | Bỏ mảng ghế mẫu cố định; truy vấn ghế đã bán/đang giữ riêng theo từng `showtimeId`, tính đúng số ghế trống từng suất và giá Thường/VIP/Sweetbox. |
| 3 | [booking.ts](cinema_management-main/Backend/src/routes/booking.ts) | Mở thêm API lấy suất chiếu theo phim (`/movie-showtimes`) và lịch rạp (`/cinema-schedule`) kèm số ghế trống riêng của mỗi suất. |
| 4 | [showtime.model.ts](cinema_management-main/Backend/src/models/showtime.model.ts) | Trả thêm `total_seats`, `booked_seats`, `available_seats` và `cinema_address` cho danh sách suất chiếu theo ngày. |
| 5 | [payment.model.ts](cinema_management-main/Backend/src/models/payment.model.ts) | Lấy thêm địa chỉ cụm rạp (`cinemaAddress`), SĐT rạp (`cinemaPhone`), thông tin khách & phim cho file PDF; kiểm tra chống đặt trùng ghế và giải phóng `seat_locks` theo `sessionId`. |
| 6 | [payment.ts](cinema_management-main/Backend/src/routes/payment.ts) | Cho phép thanh toán cổng `vnpay`, nhận `sessionId` và trả mã lỗi `409` nếu trùng ghế lúc thanh toán. |

**Nhóm Frontend (9 file):**

| STT | File chỉnh sửa | Nội dung sửa |
| :-: | :--- | :--- |
| 7 | [api.ts](cinema_management-main/Frontend/src/services/api.ts) | Giữ nguyên dữ liệu chi tiết lỗi trả về từ Backend (như `conflictingSeats` khi trùng ghế `409`). |
| 8 | [booking.service.ts](cinema_management-main/Frontend/src/services/booking.service.ts) | Khai báo hàm gọi API lấy danh sách khung giờ chiếu và số ghế trống riêng từng suất. |
| 9 | [payment.service.ts](cinema_management-main/Frontend/src/services/payment.service.ts) | Bổ sung các trường địa chỉ rạp, hotline, thông tin khách hàng vào kiểu dữ liệu vé `TicketDetail` / `CheckoutResult`. |
| 10 | [SeatSelectionPage.tsx](cinema_management-main/Frontend/src/pages/booking/SeatSelectionPage.tsx) | **Sửa lỗi chính Mục 2:** Đổi khung giờ chiếu sẽ giải phóng ghế giữ tạm của giờ cũ, xóa lựa chọn cũ, đổi `showtimeId` và tải đúng sơ đồ ghế + số ghế trống riêng của giờ mới. |
| 11 | [MovieDetailPage.tsx](cinema_management-main/Frontend/src/pages/movies/MovieDetailPage.tsx) | Hiển thị đúng `Còn X/Y ghế trống` riêng cho từng khung giờ chiếu và truyền đúng `showtimeId` sang trang chọn ghế. |
| 12 | [ShowtimesPage.tsx](cinema_management-main/Frontend/src/pages/showtimes/ShowtimesPage.tsx) | Bỏ text cứng `"120 ghế trống"` / `"85 ghế trống"`, đồng bộ số ghế trống thực tế và địa chỉ rạp theo từng khung giờ. |
| 13 | [BookingModal.tsx](cinema_management-main/Frontend/src/components/common/BookingModal.tsx) | Hiển thị số ghế trống từng khung giờ trong popup đặt nhanh và chuyển sang đúng trang chọn ghế của suất đó. |
| 14 | [CheckoutPage.tsx](cinema_management-main/Frontend/src/pages/booking/CheckoutPage.tsx) | **Mục 3:** Hiển thị địa chỉ rạp, mã QR vé thật sau khi thanh toán và thay nút tải `.txt` bằng nút **Xuất vé PDF**. |
| 15 | [MyTicketsPage.tsx](cinema_management-main/Frontend/src/pages/tickets/MyTicketsPage.tsx) | **Mục 3:** Thay hình QR giả lập cũ bằng mã QR thật, bổ sung dòng Địa chỉ rạp và đổi nút tải vé `.txt` thành **Tải vé điện tử (PDF)**. |