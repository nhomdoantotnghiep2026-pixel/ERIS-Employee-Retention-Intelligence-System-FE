# Chạy frontend local

Yêu cầu Node.js 24 trở lên. Tại thư mục repo FE:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev -- --port 5177 --strictPort
```

Nếu đã có `.env.local`, giữ file hiện tại và đối chiếu với mẫu trước khi thay đổi.
Mở URL Local mà Vite in ra, thường là http://127.0.0.1:5177.

Frontend gọi `/api` cùng origin, Vite chuyển tiếp tới `VITE_BACKEND_URL` (mẫu dùng cổng 3001).
`VITE_BACKEND_ALLOWED_ORIGIN` phải bằng `CORS_ORIGIN` của backend. Proxy chỉ chuẩn hóa
Origin của trang FE local cùng host; request từ website ngoài vẫn giữ Origin để BE từ chối.

Backend, PostgreSQL, Redis, SMTP và cấu hình bản đồ cần được chạy/cấu hình riêng trong
dự án BE. Repo này không chứa backend, SQL, migrations hay mật khẩu. Các chức năng HR
EMP, phòng ban và chức danh cần đúng phiên bản API tương ứng ở backend đang chạy.
Thông báo `Failed to fetch`, 502/500 từ proxy hoặc lỗi Origin cần kiểm tra server và các giá trị trên.

Không commit `.env.local`. Mọi biến `VITE_*` có thể được nhìn thấy ở trình duyệt;
chỉ đặt URL/cấu hình công khai, không đặt mật khẩu hoặc token bí mật.

Proxy này chỉ phục vụ `npm run dev`. Khi triển khai bản build, máy chủ web phải chuyển
tiếp `/api` tới backend hoặc đặt `VITE_API_BASE_URL` phù hợp lúc build và cấu hình CORS của BE.

Kiểm tra trước commit/push:

```powershell
npm test
npm run typecheck
npm run build
git diff --check
```
