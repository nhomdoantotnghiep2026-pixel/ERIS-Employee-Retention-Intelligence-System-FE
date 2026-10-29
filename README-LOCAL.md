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

### API quản lý tài khoản từ repo System-

Repo `ERIS-Employee-Retention-Intelligence-System-`, nhánh `backend-maintenance`
(commit `da6102b`), có GET `/api/users`, GET `/api/users/:id` và PATCH trạng thái.
Chạy backend nguyên bản trong checkout riêng, dùng cùng database và cấu hình bí mật
của BE bên ngoài repo FE. Đặt `PORT=3001`, `CORS_ORIGIN=http://127.0.0.1:5173`
trong môi trường tiến trình trước khi khởi chạy. Không sửa source BE để chạy kết nối này.

FE local dùng `/api` tới BE nhân sự cổng 3000 và `/admin-api` tới BE tài khoản cổng 3001.
Vite đổi prefix `/admin-api` thành `/api` khi chuyển tiếp và tách đường dẫn refresh
cookie thành `/admin-api`, tránh dùng nhầm cookie giữa hai BE. Sau khi xác thực đăng
nhập ở BE chính, tài khoản ADMIN đăng nhập bằng chính thông tin vừa nhập vào BE
admin để nhận token riêng. HR/EMPLOYEE tiếp tục dùng BE chính; không chuyển token
giữa các BE. Chỉ lưu token phiên, không lưu mật khẩu.

Khi bật cấu hình này, admin đang đăng nhập cần đăng nhập lại một lần. Nếu BE admin
chưa chạy, màn hình sẽ báo lỗi kết nối thay vì hiển thị dữ liệu mẫu. Khi triển khai,
cần cấu hình reverse proxy cho cả `/api` và `/admin-api`; Vite proxy chỉ hoạt động
trong môi trường phát triển.

Proxy này chỉ phục vụ `npm run dev`. Khi triển khai bản build, máy chủ web phải chuyển
tiếp `/api` tới backend hoặc đặt `VITE_API_BASE_URL` phù hợp lúc build và cấu hình CORS của BE.

### Khảo sát

BE chính trên cổng 3000 đã mount `/api/surveys`, bao gồm kết quả và nhận xét
ẩn danh. Các request survey dùng chung `VITE_BACKEND_URL` với các API nhân sự khác.
Không cấu hình cổng survey riêng trong `.env.local`.

Kiểm tra trước commit/push:

```powershell
npm test
npm run typecheck
npm run build
git diff --check
```
