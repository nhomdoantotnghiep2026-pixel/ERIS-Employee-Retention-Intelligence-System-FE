import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("HR survey management uses KPI cards, quick filters, progress, and non-destructive close styling", async () => {
  const source = await readFile(
    new URL("../src/screens/ErdSurveys.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /label=\{tr\("Đang mở", "Active surveys"\)\}/)
  assert.match(source, /label=\{tr\("Lượt phản hồi", "Total responses"\)\}/)
  assert.match(
    source,
    /label=\{tr\("Tỷ lệ tham gia trung bình", "Average response rate"\)\}/,
  )
  assert.match(
    source,
    /label=\{tr\("Điểm gắn kết trung bình", "Average engagement score"\)\}/,
  )
  assert.match(
    source,
    /\["ACTIVE", tr\("🟢 Đang diễn ra", "🟢 Active"\), statusCounts\.ACTIVE\]/,
  )
  assert.match(source, /value="RESPONSE_DESC"/)
  assert.match(source, /role="progressbar"/)
  assert.match(source, /listEmployeeProfiles/)
  assert.match(source, /surveyInvitedCount\(survey, result, totalEmployees\)/)
  assert.match(source, /from-rose-500 to-amber-500/)
  assert.match(source, /from-blue-500 to-teal-400/)
  assert.match(source, /from-teal-400 to-emerald-500/)
  assert.match(source, /Thời lượng:/)
  assert.match(source, /Đã chọn: \$\{draft\.categoryIds\.length\} chủ đề/)
  assert.match(source, /value="publish"/)
  assert.doesNotMatch(source, /Chờ backend hỗ trợ lưu phạm vi/)
  assert.match(source, /Bản nháp đang soạn/)
  assert.match(source, /Đã kết thúc & Lưu trữ/)
  assert.match(source, /Câu hỏi tự tạo/)
  assert.match(source, /value="SINGLE_CHOICE"/)
  assert.match(source, /value="MULTIPLE_CHOICE"/)
  assert.match(source, /function SurveyPreviewModal/)
  assert.match(source, /Xem trước & xuất bản/)
  assert.match(source, /exportSurveyCsv/)
  assert.match(source, /function SurveyEditorStudio/)
  assert.match(source, /Chỉnh sửa bản nháp/)
  assert.match(source, /Lưu thay đổi bản nháp/)
  assert.match(source, /Lưu & Xuất bản ngay/)
  assert.match(source, /Default satisfaction questions cannot be edited|Câu hỏi chuẩn được backend bảo vệ/)
  assert.match(source, /Xem phản hồi/)
  assert.match(source, /Xóa bộ lọc/)
  assert.doesNotMatch(
    source,
    /variant="danger"[\s\S]{0,180}Đóng khảo sát/,
  )
})
