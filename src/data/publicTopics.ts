export type PublicTopicId = 'solutions' | 'roles' | 'workflow' | 'security';
export type PublicSection = { id: string; title: string; summary: string; details: string[]; result: string; role?: string };
export type PublicTopic = {
  id: PublicTopicId; label: string; path: string; eyebrow: string; title: string; summary: string;
  menuIntro: string; takeaway: string; sections: PublicSection[]; current: string; next: string;
};

export const PUBLIC_TOPICS: Record<PublicTopicId, PublicTopic> = {
  solutions: {
    id: 'solutions', label: 'Giải pháp', path: '/giai-phap', eyebrow: 'Từ dữ liệu đến hành động',
    title: 'Hiểu nhân sự trong cùng một hệ thống.',
    summary: 'ERIS kết nối dữ liệu nhân viên, phản hồi khảo sát và phân tích rủi ro để HR có căn cứ xem xét, ưu tiên và theo dõi hoạt động giữ chân.',
    menuIntro: 'Khám phá những nhóm chức năng chính của Employee Retention Intelligence System.',
    takeaway: 'Dữ liệu có bối cảnh. Phân tích có giải thích. Hành động có người theo dõi.',
    sections: [
      { id: 'du-lieu-nhan-su', title: 'Dữ liệu nhân sự tập trung', summary: 'Hồ sơ, phòng ban, vị trí và các nguồn lịch sử liên quan.', details: ['HR và Data / AI Analyst quản lý hồ sơ nhân viên, thông tin công việc, học vấn và kinh nghiệm trong phạm vi được cấp quyền.', 'Nhập CSV hoặc Excel qua bước kiểm tra định dạng, trùng lặp và tham chiếu; xem trước và xác nhận trước khi lưu.', 'Các dữ liệu còn thiếu được chỉ rõ để người phụ trách bổ sung, thay vì tự điền giá trị không có căn cứ.'], result: 'Hồ sơ nhất quán là nguồn đầu vào cho các bước khảo sát và phân tích.' },
      { id: 'khao-sat-gan-ket', title: 'Khảo sát gắn kết', summary: 'HR tổ chức khảo sát, nhân viên gửi phản hồi của mình.', details: ['HR thiết lập câu hỏi, thời gian nhận phản hồi và theo dõi kết quả khảo sát.', 'Employee / ESS trả lời khảo sát đang mở bằng tài khoản liên kết với hồ sơ của mình; các câu bắt buộc cần được hoàn thành.', 'Câu trả lời được liên kết với đúng khảo sát và nhân viên. Không mô tả khảo sát này là ẩn danh.'], result: 'Phản hồi bổ sung bối cảnh để HR hiểu mức độ hài lòng và môi trường làm việc.' },
      { id: 'phan-tich-rui-ro', title: 'Phân tích và giải thích rủi ro', summary: 'Chuẩn bị dữ liệu theo kỳ trước khi tạo kết quả phân tích.', details: ['Chọn kỳ và phạm vi nhân viên đang hoạt động, kiểm tra dữ liệu rồi tạo bản đầu vào cho lần phân tích.', 'Data / AI Analyst đánh giá và kích hoạt mô hình trước khi tạo dự đoán. Thay đổi dữ liệu nguồn yêu cầu kiểm tra lại bản đầu vào.', 'HR xem nhóm rủi ro và những yếu tố tác động. Nhân viên chưa có dự đoán được thể hiện riêng, không tự xếp vào nhóm rủi ro thấp.'], result: 'Kết quả hỗ trợ ưu tiên xem xét, không tự động quyết định về nhân sự.' },
      { id: 'hanh-dong-giu-chan', title: 'Hành động giữ chân và báo cáo', summary: 'Từ xem xét bối cảnh đến ghi nhận hành động và kết quả.', details: ['HR lựa chọn nhân viên cần quan tâm, ghi kế hoạch, người phụ trách, thời gian và ghi chú theo dõi.', 'Kết quả thực tế của nhân viên được ghi nhận riêng với điểm rủi ro và tiến độ hành động.', 'Bộ lọc tổ chức, danh sách nhân viên và xuất báo cáo giúp tổng hợp thông tin phục vụ xem xét.'], result: 'Có thể theo dõi việc đã làm và kết quả quan sát được theo thời gian.' },
    ],
    current: 'Có thể trải nghiệm các màn hình và luồng thao tác bằng dữ liệu demo trong trình duyệt. Điểm dự đoán và chỉ số đánh giá mô hình hiện là dữ liệu mẫu.',
    next: 'Kết nối API, PostgreSQL và dịch vụ mô hình để dùng dữ liệu được lưu tập trung và kết quả phân tích thực tế.',
  },
  roles: {
    id: 'roles', label: 'Vai trò', path: '/vai-tro', eyebrow: 'Bốn vai trò, một luồng phối hợp',
    title: 'Mỗi người có một không gian làm việc phù hợp.',
    summary: 'Bốn actor đã xác định của ERIS phối hợp từ quản trị tài khoản, chuẩn bị dữ liệu đến HR xem xét và nhân viên tự phục vụ.',
    menuIntro: 'Xem trách nhiệm và các công việc chính của từng vai trò trong đồ án.',
    takeaway: 'Đúng người, đúng chức năng và đúng phạm vi dữ liệu.',
    sections: [
      { id: 'hr', role: 'HR', title: 'HR', summary: 'Quản lý hồ sơ, xem xét rủi ro và theo dõi hành động giữ chân.', details: ['Quản lý hồ sơ, nhập dữ liệu, tổ chức khảo sát và chuẩn bị dữ liệu theo kỳ.', 'Xem dashboard, lọc nhân viên theo rủi ro, đọc dự đoán và giải thích sau khi Analyst tạo kết quả.', 'Quản lý hành động giữ chân, ghi nhận kết quả, xuất báo cáo và duyệt các yêu cầu nhân viên trong luồng demo.'], result: 'HR xem xét bối cảnh và chịu trách nhiệm cho quyết định nghiệp vụ; không kích hoạt mô hình hay chạy dự đoán.' },
      { id: 'data-ai-analyst', role: 'Data / AI Analyst', title: 'Data / AI Analyst', summary: 'Chuẩn bị đầu vào và vận hành luồng phân tích.', details: ['Quản lý dữ liệu nhân viên, nhập tệp, kiểm tra lỗi và bổ sung các giá trị đầu vào còn thiếu.', 'Chọn kỳ, phạm vi và tạo bản dữ liệu; đánh giá, kích hoạt phiên bản mô hình rồi tạo dự đoán.', 'Xem kết quả lần chạy, giải thích và nhật ký xử lý của mình. Màn xem xét rủi ro cá nhân và báo cáo HR được giới hạn theo quyền.'], result: 'Cung cấp kết quả và giải thích cho HR xem xét, không thay HR ra quyết định giữ chân.' },
      { id: 'system-administrator', role: 'System Administrator', title: 'System Administrator', summary: 'Quản trị tài khoản, quyền truy cập và vận hành hệ thống.', details: ['Quản lý bản ghi tài khoản, trạng thái và liên kết tài khoản với hồ sơ nhân viên.', 'Kiểm tra phạm vi quyền của bốn role, cấu hình hệ thống và theo dõi nhật ký hoạt động.', 'Các màn trạng thái dịch vụ phân biệt dữ liệu demo với kết nối backend chưa được xác minh.'], result: 'Quản trị vận hành không đồng nghĩa có quyền thực hiện mọi nghiệp vụ HR hoặc Analyst.' },
      { id: 'employee-ess', role: 'Employee / ESS', title: 'Employee / ESS', summary: 'Truy cập hồ sơ của mình và thực hiện các công việc tự phục vụ.', details: ['Xem hồ sơ cá nhân và các thông tin công việc được liên kết với tài khoản.', 'Gửi yêu cầu nghỉ phép, tăng ca, đổi ca hoặc làm việc từ xa; xem quyết định và phản hồi sau khi HR xử lý.', 'Trả lời khảo sát; trải nghiệm các tiện ích chấm công, phiếu lương, mục tiêu và nghỉ việc trong phạm vi demo.'], result: 'Không mở danh bạ toàn bộ nhân viên, dashboard rủi ro của HR hoặc chức năng quản trị.' },
    ],
    current: 'Màn đăng nhập dùng bốn tài khoản demo để kiểm tra luồng theo role. Đổi tài khoản trong cùng tab giữ dữ liệu của phiên để thử các bước phối hợp.',
    next: 'Tài khoản thật cần được xác thực và phân quyền ở backend; chọn role trên giao diện không thay thế cơ chế đó.',
  },
  workflow: {
    id: 'workflow', label: 'Quy trình', path: '/quy-trinh', eyebrow: 'Phối hợp từ đầu vào đến kết quả',
    title: 'Một quy trình rõ ràng để giữ chân có căn cứ.',
    summary: 'ERIS tổ chức các bước tiếp nhận, kiểm tra, phân tích và xem xét thành một luồng có trách nhiệm cụ thể. Dữ liệu thiếu hoặc kết quả chưa sẵn sàng đều cần được xử lý trước khi đi tiếp.',
    menuIntro: 'Theo dõi các bước chính và việc bàn giao giữa HR, Analyst và nhân viên.',
    takeaway: 'Kiểm tra đầu vào trước, giải thích kết quả sau, HR xem xét cuối cùng.',
    sections: [
      { id: 'tiep-nhan', title: '01 · Tiếp nhận dữ liệu', summary: 'HR / Analyst quản lý hồ sơ hoặc nhập tệp.', details: ['Tải mẫu, điền dữ liệu và đưa CSV hoặc Excel vào bước kiểm tra.', 'Xử lý lỗi định dạng, trùng mã/email hoặc tham chiếu không phù hợp; xem trước và xác nhận nhập dữ liệu.'], result: 'Hồ sơ nhân viên hợp lệ, có thể dùng cho các bước tiếp theo.' },
      { id: 'thu-thap-phan-hoi', title: '02 · Thu thập phản hồi', summary: 'HR mở khảo sát, Employee / ESS trả lời.', details: ['HR xác định câu hỏi và khoảng thời gian khảo sát.', 'Nhân viên gửi câu trả lời của mình; HR theo dõi phản hồi để bổ sung bối cảnh nhân sự.'], result: 'Câu trả lời gắn với đúng người và đúng khảo sát.' },
      { id: 'chuan-bi', title: '03 · Chuẩn bị theo kỳ', summary: 'HR / Analyst chọn kỳ và phạm vi dữ liệu.', details: ['Tạo bản đầu vào theo thời điểm và phạm vi nhân viên đang hoạt động.', 'Nếu thiếu dữ liệu, mở hồ sơ để sửa rồi tạo lại và kiểm tra. Thay đổi nguồn sẽ làm bản dữ liệu cũ cần được xem xét lại.'], result: 'Bản đầu vào hợp lệ và còn khớp dữ liệu nguồn.' },
      { id: 'danh-gia-mo-hinh', title: '04 · Đánh giá và kích hoạt', summary: 'Data / AI Analyst lựa chọn mô hình sử dụng.', details: ['Xem các chỉ số đánh giá như Precision, Recall và F1 trước khi kích hoạt.', 'Xác nhận phiên bản hoạt động. Không tự kích hoạt một mô hình chỉ vì người dùng mở màn hình.'], result: 'Một mô hình đã đánh giá và được chủ động kích hoạt.' },
      { id: 'du-doan', title: '05 · Tạo dự đoán và giải thích', summary: 'Data / AI Analyst thực hiện lần chạy.', details: ['Kiểm tra điều kiện dữ liệu và mô hình trước khi xác nhận tạo dự đoán.', 'Lưu liên kết giữa lần chạy, nhân viên, đầu vào, kết quả và yếu tố giải thích để có thể tra lại.'], result: 'Kết quả và giải thích được chuyển sang bước HR xem xét.' },
      { id: 'hr-xem-xet', title: '06 · Xem xét và theo dõi', summary: 'HR xác minh bối cảnh và quyết định hành động.', details: ['Lọc nhân viên cần quan tâm, xem rủi ro và những yếu tố tác động.', 'Lập hành động giữ chân, ghi nhận kết quả quan sát và tổng hợp báo cáo; không coi điểm AI là quyết định tự động.'], result: 'Hành động có người phụ trách, có tiến độ và có kết quả theo dõi.' },
    ],
    current: 'Có thể thử luồng từ nhập dữ liệu đến xem kết quả mẫu trong frontend. Yêu cầu của Employee và phản hồi HR dùng chung dữ liệu demo khi đổi role trong cùng tab.',
    next: 'API, lưu trữ tập trung và dịch vụ suy luận thật cần được tích hợp để các tài khoản trên nhiều thiết bị phối hợp với nhau.',
  },
  security: {
    id: 'security', label: 'Bảo mật', path: '/bao-mat', eyebrow: 'Phạm vi truy cập có chủ đích',
    title: 'Thiết kế quyền theo đúng trách nhiệm.',
    summary: 'Dữ liệu nhân sự cần được truy cập đúng người và đúng mục đích. ERIS thể hiện các ranh giới vai trò trong giao diện, đồng thời phân biệt rõ bản thử nghiệm với các yêu cầu bảo vệ dữ liệu khi triển khai thật.',
    menuIntro: 'Tìm hiểu phân quyền, liên kết tài khoản, kiểm tra dữ liệu và phạm vi xác thực.',
    takeaway: 'Phân quyền giao diện cần đi cùng xác thực và kiểm soát truy cập tại máy chủ.',
    sections: [
      { id: 'phan-quyen', title: 'Phạm vi theo vai trò', summary: 'Chức năng và đường dẫn được giới hạn theo actor.', details: ['HR, Analyst, Admin và Employee / ESS có menu và phạm vi chức năng riêng.', 'Các trang nội bộ kiểm tra quyền và hiển thị trạng thái không được truy cập khi role không phù hợp.', 'Kiểm tra ở frontend hỗ trợ trải nghiệm và luồng demo; bản triển khai thật vẫn phải kiểm tra quyền tại từng API.'], result: 'Một ma trận trách nhiệm rõ ràng để tiếp tục triển khai kiểm soát tại backend.' },
      { id: 'du-lieu-ca-nhan', title: 'Tài khoản gắn với hồ sơ', summary: 'Nhân viên mở đúng hồ sơ cá nhân được liên kết.', details: ['Tài khoản Employee / ESS dùng liên kết hồ sơ do quản trị viên thiết lập.', 'Nếu chưa liên kết, giao diện yêu cầu cấu hình lại thay vì tự lấy hồ sơ của người khác.', 'Câu trả lời khảo sát và yêu cầu nhân viên được gắn với người gửi. Khảo sát hiện không phải khảo sát ẩn danh.'], result: 'Xác định rõ chủ thể của dữ liệu trong luồng tự phục vụ.' },
      { id: 'kiem-tra-va-nhat-ky', title: 'Kiểm tra và truy vết thao tác', summary: 'Xác nhận các bước ghi dữ liệu và lưu dấu hoạt động.', details: ['Tệp nhập được kiểm tra trước khi lưu; các thao tác quan trọng có bước xem xét hoặc xác nhận.', 'Nhật ký demo thể hiện tài khoản, thao tác, đối tượng và thời điểm để Admin tra cứu.', 'Nhật ký và dữ liệu lưu trong trình duyệt có thể bị thay đổi hoặc mất khi xóa dữ liệu; đây chưa phải nhật ký bảo mật tại máy chủ.'], result: 'Có luồng kiểm tra rõ ràng, không nhầm dữ liệu trình duyệt với bằng chứng audit bất biến.' },
      { id: 'xac-thuc', title: 'Đăng nhập và tích hợp backend', summary: 'Tài khoản được quản lý, không có đăng ký công khai.', details: ['Màn login hiện chọn một trong bốn tài khoản và dùng mật khẩu demo; chưa phải cơ chế xác thực doanh nghiệp.', 'Thiết kế hướng tới tài khoản do Admin cấp. Xác thực thật, quản lý phiên và OTP cần được triển khai khi kết nối backend.', 'Khi tích hợp PostgreSQL, cần thực thi quyền truy cập và ràng buộc dữ liệu ở máy chủ trước khi sử dụng dữ liệu nhân sự thật.'], result: 'Phạm vi bản thử nghiệm được công bố rõ; các yêu cầu xác thực thật được tách cho giai đoạn tích hợp.' },
    ],
    current: 'Bản hiện tại là frontend demo, chưa có xác thực doanh nghiệp, OTP hay kết nối cơ sở dữ liệu sản xuất được xác minh.',
    next: 'Triển khai và kiểm tra xác thực, quyền tại API, quyền dữ liệu PostgreSQL và nhật ký máy chủ trước khi vận hành thật.',
  },
};
