import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("HR survey management uses KPI cards, quick filters, progress, and non-destructive close styling", async () => {
  const source = (
    await Promise.all([
      "../src/screens/ErdSurveys.tsx",
      "../src/features/surveys/surveyUtils.ts",
      "../src/features/surveys/CompactOptionInputs.tsx",
      "../src/features/surveys/SurveyKpiCard.tsx",
      "../src/features/surveys/SurveyDraftEditor.tsx",
      "../src/features/surveys/SurveyQuestionWizards.tsx",
      "../src/features/surveys/SurveyPreviewModal.tsx",
      "../src/features/surveys/surveyStyles.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")))
  ).join("\n")

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
  assert.match(source, /surveyResponseRate\(survey, result, totalEmployees\)/)
  assert.match(source, /from-blue-300 to-blue-500/)
  assert.match(source, /from-teal-400 to-emerald-500/)
  assert.match(source, /Thời lượng:/)
  assert.match(source, /Đã chọn: \$\{draft\.categoryIds\.length\} chủ đề/)
  assert.match(source, /value="publish"/)
  assert.doesNotMatch(source, /Chờ backend hỗ trợ lưu phạm vi/)
  assert.match(source, /tr\("Bản nháp", "Drafts"\)/)
  assert.match(source, /Đã kết thúc & Lưu trữ/)
  assert.match(source, /Câu hỏi tự tạo/)
  assert.match(source, /value="SINGLE_CHOICE"/)
  assert.match(source, /value="MULTIPLE_CHOICE"/)
  assert.match(source, /function SurveyPreviewModal/)
  assert.match(source, /Xem trước & xuất bản/)
  assert.match(source, /exportSurveyCsv/)
  assert.match(source, /function SurveyDraftEditor/)
  assert.match(source, /Chỉnh sửa bản nháp/)
  assert.match(source, /Lưu thay đổi bản nháp/)
  assert.match(source, /Lưu & Xuất bản ngay/)
  assert.match(source, /function SurveyQuestionWizard/)
  assert.match(source, /function SurveyDraftQuestionWizard/)
  assert.match(source, /function CompactOptionInputs/)
  assert.match(source, /role="tablist"/)
  assert.match(source, /role="tabpanel"/)
  assert.match(source, /aria-selected=\{selected\}/)
  assert.match(source, /aria-controls=\{`survey-create-panel-/)
  assert.match(source, /aria-controls=\{`survey-edit-panel-/)
  assert.match(source, /onMouseDown=\{\(event\) => \{/)
  assert.match(source, /if \(event\.target === event\.currentTarget\) onClose\(\)/)
  assert.match(source, /animate-in[^"]*fade-in[^"]*duration-200/)
  assert.match(source, /useDialogBehavior\(true, onClose\)/)
  assert.match(source, /topicLabelsVi/)
  assert.match(source, /"compensation benefits": "Thu nhập & Phúc lợi"/)
  assert.match(source, /"work life balance": "Cân bằng công việc & Cuộc sống"/)
  assert.match(source, /✓ Đã thêm vào khảo sát/)
  const bank = source.slice(source.indexOf("function BankGroup"), source.indexOf("type SurveyQuestionWizardProps"))
  assert.equal((bank.match(/type="checkbox"/g) ?? []).length, 1)
  assert.doesNotMatch(bank, /type="radio"|<QuestionSample/)
  assert.match(source, /selectAllBankQuestions/)
  assert.match(source, /clearBankQuestions/)
  assert.match(source, /lg:grid-cols-12/)
  assert.match(source, /lg:col-span-4.*lg:overflow-y-auto/)
  assert.match(source, /lg:col-span-8/)
  assert.match(source, /min-h-0 flex-1 bg-slate-50\/50 p-4 lg:overflow-y-auto/)
  assert.match(source, /preview-topic-/)
  assert.match(source, /CHẾ ĐỘ XEM TRƯỚC/)
  assert.match(source, /Mô phỏng giao diện khảo sát thực tế của nhân viên/)
  assert.match(source, /Hoàn toàn không đồng ý/)
  assert.match(source, /Hoàn toàn đồng ý/)
  assert.match(source, /renderQuestionText/)
  assert.match(source, /grid gap-2 sm:grid-cols-2 lg:grid-cols-1/)
  assert.doesNotMatch(source, /block h-full w-1\/3 rounded-full/)
  assert.doesNotMatch(source, /tr\("Xem trước", "Preview"\)<\/Button>/)
  assert.match(source, /openGroups/)
  assert.match(source, /Core scoring question|Câu hỏi chuẩn tính điểm/)
  assert.match(source, /Xem phản hồi/)
  assert.match(source, /Xóa bộ lọc/)
  assert.doesNotMatch(
    source,
    /variant="danger"[\s\S]{0,180}Đóng khảo sát/,
  )
})

test("survey screen delegates large authoring dialogs to focused feature components", async () => {
  const source = await readFile(
    new URL("../src/screens/ErdSurveys.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /import \{ SurveyDraftEditor \}/)
  assert.match(source, /import \{ SurveyPreviewModal \}/)
  assert.match(source, /import \{ SurveyQuestionWizard \}/)
  assert.match(source, /<SurveyDraftEditor/)
  assert.match(source, /<SurveyPreviewModal/)
  assert.match(source, /<SurveyQuestionWizard/)
  assert.doesNotMatch(source, /function SurveyEditorStudio/)
  assert.doesNotMatch(source, /function SurveyPreviewModal/)
  assert.doesNotMatch(source, /function SurveyQuestionWizard/)
})

test("survey result drawer keeps large participant directories searchable and paginated", async () => {
  const source = await readFile(
    new URL("../src/components/SurveyResultDetails.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /NOT_SUBMITTED/)
  assert.match(source, /const perPage = 10/)
  assert.match(source, /max-h-\[430px\]/)
  assert.match(source, /departmentName/)
  assert.match(source, /Gửi nhắc nhở người chưa nộp/)
  assert.match(source, /Backend chưa có endpoint gửi nhắc nhở/)
})
