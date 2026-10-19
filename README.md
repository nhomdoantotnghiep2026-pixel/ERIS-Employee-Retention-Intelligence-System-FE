# ERIS Frontend

Frontend độc lập cho ERIS, tách từ bản làm việc hiện tại. Repo này chứa giao diện React, dữ liệu demo và kiểm tra frontend cho bốn role: HR, Data / AI Analyst, System Administrator, Employee / ESS.

## Chạy trên máy

Cài Node.js 24 trở lên. Mở terminal ngay tại thư mục repo (ví dụ D:/ERIS-FE):

```powershell
npm ci
npm run dev
```

Mở địa chỉ Local mà Vite hiển thị. Cổng mặc định là 5173; nếu đang bận, Vite dùng cổng khác.

## Kiểm tra

```powershell
npm test
npm run typecheck
npm run build
```

Tests bao gồm phân quyền theo role, nhập CSV/XLSX, dữ liệu demo theo hợp đồng ERD, khảo sát, chuẩn bị dữ liệu, mô hình/dự đoán mẫu và Employee gửi yêu cầu → HR duyệt → Employee xem kết quả.

## Phạm vi frontend

- Dữ liệu hiện tại là demo trong trình duyệt; đổi role trong cùng tab giữ dữ liệu của phiên.
- Mô hình và kết quả AI là minh họa, chưa phải dịch vụ suy luận thật.
- Các kiểu dữ liệu/quan hệ ERD trong src/erd phục vụ giao diện và kiểm tra dữ liệu demo; không tạo database PostgreSQL.
- src/lib/supabase.ts và src/services là mã client dành cho tích hợp sau. Không có thông tin đăng nhập hoặc cấu hình dự án Supabase được chuyển sang.
- Repo FE không chứa backend server, SQL hoặc migration. Bài kiểm tra schema PostgreSQL và công cụ sinh SQL được giữ ở dự án cũ, không thuộc bộ kiểm tra frontend này.
- Không đưa node_modules, dist, .env hay thư mục .git của dự án cũ vào repo.

## Nhánh làm việc

Bản chuyển frontend nằm trên nhánh frontend/role-workflows để nhóm review. Chưa merge vào main. Dự án cũ và repo cũ được giữ nguyên.

## Ảnh giới thiệu trên landing

Landing dùng ba ảnh chụp dashboard HR, System Admin và Employee / ESS do nhóm cung cấp trong public/product-previews. Component LandingProductPreview hiển thị đồng thời ba ảnh xòe như cánh quạt: HR ở trước, Admin bên trái, Employee bên phải; bấm từng ảnh để mở ảnh gốc; các số liệu trong ảnh là trạng thái demo lúc chụp, không phải dữ liệu đang cập nhật. Các ảnh người dùng ở trang login vẫn được giữ nguyên.

## Hướng dẫn sử dụng

Nút ? trên thanh đầu trang mở hướng dẫn tương ứng với role đang đăng nhập ở mọi trang làm việc. Mỗi bước có liên kết đến chức năng được cấp quyền. Chọn bước sẽ đóng hướng dẫn; có thể đóng bằng nút X, Escape hoặc bấm ra ngoài. Hướng dẫn không còn hiển thị thành khối trên dashboard.

Sidebar ghi nhớ các nhóm menu đang mở riêng cho từng role trong cùng tab trình duyệt. Chuyển trang hoặc tải lại không tự thu gọn nhóm; bấm tên nhóm để chủ động đóng/mở.

## Trang giới thiệu ERIS

Bốn trang công khai: `/giai-phap`, `/vai-tro`, `/quy-trinh`, `/bao-mat`. Thanh điều hướng chung mở bảng nội dung khi rê chuột hoặc bấm tên mục; phím ArrowDown mở bảng và chuyển focus vào liên kết, Escape đóng bảng. Trên màn hình nhỏ, dùng nút menu để chọn chủ đề. Các liên kết dẫn đến đúng phần trong trang chi tiết.

Nội dung bám theo bốn role và luồng làm việc hiện có, phân biệt rõ dữ liệu demo trong trình duyệt với xác thực, phân quyền máy chủ và PostgreSQL cần tích hợp sau.
