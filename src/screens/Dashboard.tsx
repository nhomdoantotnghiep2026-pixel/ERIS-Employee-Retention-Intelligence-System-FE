import { normalizeOverviewGender } from '../utils/retentionOverview';
import { Input } from '../components/ui/input';
import { OverviewChartPanel, EligibilityDonut, ScoreHistogram } from '../components/RetentionOverviewCharts';
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react"
import { AppShell } from "../components/AppShell"
import { Button } from "../components/ui/button"
import { FilterMenu } from "../components/ui/filter-menu"
import { useLanguage } from "../context/LanguageContext"
import { useRole } from "../context/RoleContext"
import {
  getApiErrorMessage,
  listEmployeeProfiles,
  listAiEmployees,
  listDepartments,
  listSurveys,
  listPolicyRecommendations,
  type EmployeeProfile,
  type ApiDepartment,
  type AiEmployee,
  type SurveySummary,
} from "../services/api"
import {
  overviewPriorities,
  type OverviewRecommendation,
} from "../utils/retentionOverview"

const panel = "min-w-0 rounded-xl border border-slate-200 bg-white"
export default function Dashboard() {
  const { t, language } = useLanguage()
  const { user } = useRole()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [employees, setEmployees] = useState<EmployeeProfile[] | null>(null)
  const [eligible, setEligible] = useState<AiEmployee[] | null>(null)
  const [departments, setDepartments] = useState<ApiDepartment[]>([])
  const [surveys, setSurveys] = useState<SurveySummary[] | null>(null)
  const [recommendations, setRecommendations] =
    useState<OverviewRecommendation[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [department, setDepartment] = useState("all")
  const [gender, setGender] = useState('all')
  const [employmentType, setEmploymentType] = useState('all')
  const [eligibility, setEligibility] = useState('all')
  const [search, setSearch] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setLoading(true)
    setErrors([])
    setEmployees(null)
    setEligible(null)
    setSurveys(null)
    setRecommendations(null)
    setDepartments([])
    void Promise.allSettled([
      listEmployeeProfiles({ limit: Number.MAX_SAFE_INTEGER }),
      listAiEmployees(),
      listDepartments(undefined, { limit: Number.MAX_SAFE_INTEGER }),
      listSurveys(),
      listPolicyRecommendations(),
    ]).then((results) => {
      if (!live) return
      const [people, ai, groups, surveysResult, policies] = results
      if (people.status === "fulfilled") setEmployees(people.value.data)
      if (ai.status === "fulfilled") setEligible(ai.value.data)
      if (groups.status === "fulfilled") setDepartments(groups.value.data)
      if (surveysResult.status === "fulfilled")
        setSurveys(surveysResult.value.data)
      if (policies.status === "fulfilled")
        setRecommendations(policies.value.data)
      setErrors(
        results.flatMap((r, index) =>
          r.status === "rejected"
            ? [
                `${["Employees", "AI employees", "Departments", "Surveys", "Recommendations"][index]}: ${getApiErrorMessage(r.reason, "Không tải được dữ liệu.")}`,
              ]
            : [],
        ),
      )
      setUpdatedAt(new Date().toISOString())
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [reload])
  const active = useMemo(
    () => employees?.filter((e) => e.employmentStatus === "ACTIVE") ?? [],
    [employees],
  )
  const eligibleIds = new Set(eligible?.map(e => Number(e.id)) ?? []);
  const scoped = active.filter(e => (department === 'all' || String(e.departmentId) === department) && (gender === 'all' || normalizeOverviewGender(e.gender) === gender) && (employmentType === 'all' || e.employmentType === employmentType) && (eligibility === 'all' || (eligible !== null && (eligibility === 'yes' ? eligibleIds.has(Number(e.id)) : !eligibleIds.has(Number(e.id))))) && (!search.trim() || (e.fullName+' '+e.employeeCode).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const scopedIds = new Set(scoped.map((e) => Number(e.id)))
  const aiCount = eligible?.filter((e) => scopedIds.has(Number(e.id))).length
  const priorities = overviewPriorities(scoped, recommendations ?? [])
  const stored = recommendations?.filter(
    (r) =>
      scopedIds.has(Number(r.employee.id)) &&
      r.dataSource === "STORED" &&
      r.modelVersion?.startsWith("mexwell-"),
  )
  const departmentCounts = departments
    .map((d) => ({
      ...d,
      count: scoped.filter((e) => Number(e.departmentId) === Number(d.id))
        .length,
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
  const unknownCount = scoped.filter(
    (e) => !departments.some((d) => Number(d.id) === Number(e.departmentId)),
  ).length
  const statuses = [
    { status: "ACTIVE", label: tr("Đang mở", "Open"), color: "bg-emerald-600" },
    { status: "DRAFT", label: tr("Bản nháp", "Draft"), color: "bg-slate-500" },
    { status: "CLOSED", label: tr("Đã đóng", "Closed"), color: "bg-blue-600" },
  ]
  const metrics = [
    {label:tr('Nhân viên đang làm việc','Active employees'),value:employees?scoped.length:null},
    {label:tr('Đủ điều kiện AI','AI eligible'),value:employees&&eligible?aiCount:null},
    {label:tr('Tỷ lệ đủ điều kiện AI','AI eligibility rate'),value:employees&&eligible&&scoped.length?Math.round(aiCount!/scoped.length*100)+'%':null},
    {label:tr('Có đề xuất AI đã lưu','With saved AI suggestions'),value:employees&&recommendations?priorities.length:null},
    {label:tr('Đề xuất AI đã lưu','Saved AI suggestions'),value:employees&&recommendations?stored?.length:null},
    {label:tr('Phòng ban có nhân sự','Departments with employees'),value:employees&&departments.length?departmentCounts.length:null},
    {label:tr('Chưa đủ điều kiện AI','Not AI eligible'),value:employees&&eligible?scoped.length-aiCount!:null},
    {label:tr('Khảo sát đang mở','Open surveys'),value:surveys?.filter(s=>s.status==='ACTIVE').length??null},
    {label:tr('Khảo sát bản nháp','Draft surveys'),value:surveys?.filter(s=>s.status==='DRAFT').length??null},
    {label:tr('Khảo sát đã đóng','Closed surveys'),value:surveys?.filter(s=>s.status==='CLOSED').length??null},
  ];
  const resetFilters=()=>{setDepartment('all');setGender('all');setEmploymentType('all');setEligibility('all');setSearch('');};
  return <AppShell breadcrumb={['Overview']}><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="grid items-stretch lg:grid-cols-[210px_minmax(0,1fr)]">
    <aside aria-label={tr('Bộ lọc tổng quan','Overview filters')} className="border-b border-slate-200 bg-slate-50 p-4 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-2"><h2 className="text-base font-bold text-slate-900">{tr('Bộ lọc tổng quan','Global filters')}</h2><Button variant="ghost" className="h-8 rounded-md px-2 text-xs text-slate-700" onClick={resetFilters}>{tr('Đặt lại','Reset')}</Button></div><p className="mt-2 text-xs leading-5 text-slate-600">{tr('Áp dụng cho nhân sự và kết quả AI đã lưu.','Applies to employees and saved AI results.')}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div><p className="mb-1.5 text-xs font-semibold text-slate-700">{tr('Phòng ban','Department')}</p><FilterMenu className="w-full" label={tr('Lọc phòng ban','Filter department')} value={department} onChange={setDepartment} options={[{value:'all',label:tr('Tất cả phòng ban','All departments')},...departments.map(d=>({value:String(d.id),label:t(d.name)}))]}/></div>
        <div><p className="mb-1.5 text-xs font-semibold text-slate-700">{tr('Giới tính','Gender')}</p><FilterMenu className="w-full" label={tr('Lọc giới tính','Filter gender')} value={gender} onChange={setGender} options={[{value:'all',label:tr('Tất cả giới tính','All genders')},...[{value:'male',label:tr('Nam','Male')},{value:'female',label:tr('Nữ','Female')},{value:'other',label:tr('Khác','Other')},{value:'unknown',label:tr('Chưa xác định','Unspecified')}].filter(option=>active.some(e=>normalizeOverviewGender(e.gender)===option.value))]}/></div>
        <div><p className="mb-1.5 text-xs font-semibold text-slate-700">{tr('Loại hợp đồng','Employment type')}</p><FilterMenu className="w-full" label={tr('Lọc loại hợp đồng','Filter employment type')} value={employmentType} onChange={setEmploymentType} options={[{value:'all',label:tr('Tất cả loại hợp đồng','All employment types')},...[...new Set(active.map(e=>e.employmentType).filter((v):v is string=>!!v))].map(v=>({value:v,label:t(v)}))]}/></div>
        <div><p className="mb-1.5 text-xs font-semibold text-slate-700">{tr('Điều kiện phân tích','Analysis eligibility')}</p><FilterMenu className="w-full" label={tr('Lọc điều kiện AI','Filter AI eligibility')} value={eligibility} onChange={setEligibility} options={[{value:'all',label:tr('Tất cả nhân viên','All employees')},{value:'yes',label:tr('Đủ điều kiện AI','AI eligible')},{value:'no',label:tr('Chưa đủ điều kiện AI','Not AI eligible')}]}/></div>
      </div><div className="mt-6 border-t border-slate-200 pt-4"><h3 className="text-xs font-semibold text-slate-800">{tr('Phạm vi dữ liệu','Data scope')}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{tr('Hồ sơ đang hoạt động. Các chỉ số khảo sát là toàn tổ chức, không áp dụng bộ lọc nhân sự.','Active profiles. Survey metrics are organization-wide and do not follow employee filters.')}</p><p className="mt-4 text-xs text-slate-600">{tr('Xin chào','Welcome')}, {user.name}</p></div>
      <p role="status" className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-600">{loading?tr('Đang tải dữ liệu…','Loading data…'):updatedAt?tr('Cập nhật lúc','Updated at')+' '+new Date(updatedAt).toLocaleTimeString(language==='vi'?'vi-VN':'en-US'):''}</p>
    </aside>
    <div className="min-w-0 p-4 sm:p-5"><header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4"><div><h1 className="text-xl font-bold tracking-tight text-slate-900">{tr('Tổng quan giữ chân nhân viên','Employee retention overview')}</h1><p className="mt-1 text-xs text-slate-600">{tr('Nhân sự · Phân tích AI · Khảo sát','Workforce · AI analysis · Surveys')}</p></div><div className="flex gap-2"><Button variant="outline" className="h-9 rounded-md border-slate-300 text-slate-800" disabled={loading} onClick={()=>setReload(n=>n+1)} aria-label={tr('Làm mới','Refresh')}><RefreshCw className={loading?'animate-spin':''}/></Button><Button asChild className="h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700"><Link to="/ai-analysis"><BrainCircuit/>{tr('Phân tích AI','AI analysis')}</Link></Button></div></header>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">{tr('Dữ liệu trực tiếp từ hệ thống ERIS','Live data from ERIS')}</p><div className="w-full sm:w-64"><Input aria-label={tr('Tìm nhân viên','Search employees')} placeholder={tr('Tìm tên hoặc mã nhân viên…','Search employee name or code…')} value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
    {errors.length>0&&<div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>{tr('Một số dữ liệu chưa tải được. Các chỉ số liên quan hiển thị —.','Some data could not be loaded. Affected metrics show —.')}</strong>{errors.map(error=><p key={error}>{t(error)}</p>)}</div>}
    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-5">{metrics.map((metric,index)=><section key={metric.label} className="flex min-h-24 flex-col justify-between rounded-md border border-slate-200 bg-white p-3 shadow-xs"><h2 className="text-xs font-medium leading-5 text-slate-600">{metric.label}</h2><p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{metric.value??'—'}</p>{index>=7&&<span className="mt-1 text-[10px] text-slate-600">{tr('Toàn tổ chức','Organization-wide')}</span>}</section>)}</div>
    <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-2">
      <OverviewChartPanel title={tr('Nhân sự theo phòng ban','Employees by department')} description={tr('Số nhân viên đang làm việc trong phạm vi bộ lọc.','Active employees in the current filter.')}><div className="flex min-h-64 flex-col justify-center gap-3">{employees&&departmentCounts.map(d=><div key={d.id} className="grid grid-cols-[minmax(70px,.8fr)_minmax(0,1.2fr)_24px] items-center gap-2"><span className="text-xs text-slate-700">{t(d.name)}</span><div className="h-5 bg-slate-100"><div className="h-full bg-blue-500" style={{width:d.count/Math.max(...departmentCounts.map(d=>d.count),1)*100+'%'}}/></div><strong className="text-right text-xs text-slate-800">{d.count}</strong></div>)}{unknownCount>0&&<p className="text-xs text-slate-600">{tr('Chưa có tên phòng ban','Department name unavailable')}: {unknownCount}</p>}{(!employees||!scoped.length)&&<p className="text-sm text-slate-600">{tr('Chưa có dữ liệu để hiển thị.','No data to display.')}</p>}</div></OverviewChartPanel>
      <OverviewChartPanel title={tr('Ma trận mức độ sẵn sàng','Readiness matrix')} description={tr('Phòng ban × hồ sơ, điều kiện AI và đề xuất đã lưu.','Department: profiles, AI eligibility and saved suggestions.')}><div className="min-h-64 overflow-x-auto"><table className="w-full text-center text-xs"><thead><tr><th className="p-2 text-left font-medium text-slate-600">{tr('Phòng ban','Department')}</th>{[tr('Nhân sự','Staff'),tr('Đủ ĐK AI','AI eligible'),tr('Có đề xuất','With suggestions')].map(label=><th key={label} className="p-2 font-medium text-slate-600">{label}</th>)}</tr></thead><tbody>{departmentCounts.map(d=>{const ids=new Set(scoped.filter(e=>Number(e.departmentId)===Number(d.id)).map(e=>Number(e.id)));const values=[d.count,eligible?eligible.filter(e=>ids.has(Number(e.id))).length:null,recommendations?priorities.filter(r=>ids.has(Number(r.employee.id))).length:null];return <tr key={d.id}><th className="p-2 text-left font-medium text-slate-700">{t(d.name)}</th>{values.map((value,index)=><td key={index} className="border-2 border-white p-3 font-semibold text-slate-900" style={{backgroundColor:value===null?'#f1f5f9':'rgba(59,130,246,'+(.08+value/Math.max(scoped.length,1)*.45)+')'}}>{value??'—'}</td>)}</tr>})}</tbody></table>{!departmentCounts.length&&<p className="mt-6 text-center text-sm text-slate-600">{tr('Chưa có dữ liệu để hiển thị.','No data to display.')}</p>}</div></OverviewChartPanel>
      <OverviewChartPanel title={tr('Mức độ sẵn sàng phân tích AI','AI analysis readiness')} description={tr('Hồ sơ và tài khoản hoạt động; không phải tỷ lệ rủi ro.','Active profiles and accounts; not a risk percentage.')}><EligibilityDonut total={employees?scoped.length:null} eligible={employees&&eligible?aiCount??0:null}/></OverviewChartPanel>
      <OverviewChartPanel title={tr('Phân bố điểm AI đã lưu','Saved AI score distribution')} description={tr('Mỗi nhân viên một kết quả có đề xuất đã lưu; các khoảng điểm không phải mức rủi ro.','One result per employee with saved suggestions; score bands are not risk categories.')}><ScoreHistogram scores={priorities.map(r=>r.attritionProbability!)} available={!!employees&&!!recommendations}/></OverviewChartPanel>
    </div><div className="my-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldCheck size={16} className="mt-0.5 shrink-0"/><p>{tr('AI hiện dùng mô hình demo, chưa có ngưỡng phân loại rủi ro được xác nhận. Điểm số chỉ hỗ trợ HR xem xét; không kết luận nhân viên sẽ nghỉ việc.','AI uses a demo model without validated risk thresholds. Scores support HR review, not conclusions that employees will leave.')}</p></div>
      <section className={`${panel} mb-5 overflow-hidden`}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {tr(
                "Nhân viên HR nên xem xét trước",
                "Employees to review first",
              )}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {tr(
                "Kết quả gần nhất của mỗi nhân viên có đề xuất AI đã lưu, sắp theo điểm giảm dần. Không bao gồm demo cố định; không đại diện toàn bộ lịch sử phân tích.",
                "Latest result per employee with saved AI recommendations, sorted by score. Excludes fixed demos and does not represent the full analysis history.",
              )}
            </p>
          </div>
        </div>
        {!employees || !recommendations ? (
          <p className="p-6 text-sm text-slate-600">
            {loading
              ? tr("Đang tải danh sách…", "Loading list…")
              : tr(
                  "Chưa tải được nguồn dữ liệu để lập danh sách.",
                  "The data needed for this list is unavailable.",
                )}
          </p>
        ) : priorities.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  {[
                    tr("Nhân viên", "Employee"),
                    tr("Phòng ban", "Department"),
                    tr("Điểm AI demo", "Demo AI score"),
                    tr("Đề xuất đã lưu", "Saved recommendations"),
                    tr("Thao tác", "Action"),
                  ].map((label) => (
                    <th key={label} className="px-5 py-3 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priorities.slice(0, 10).map((item) => (
                  <tr key={item.employee.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {item.employee.fullName}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.employee.employeeCode}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {t(
                        departments.find(
                          (d) =>
                            Number(d.id) === Number(item.profile.departmentId),
                        )?.name || tr("Chưa xác định", "Unspecified"),
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold tabular-nums text-orange-800">
                      {(item.attritionProbability! * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-4 text-slate-700">{item.count}</td>
                    <td className="px-5 py-4">
                      <Button
                        asChild
                        variant="outline"
                        className="rounded-md border-slate-300 text-slate-800"
                      >
                        <Link
                          to="/ai-analysis"
                        >
                          {tr("Mở phân tích AI", "Open AI analysis")}
                          <ArrowRight />
                        </Link>
                      </Button>
                      <p className="mt-1 text-xs text-slate-600">{tr("Mã kết quả", "Result ID")}: #{item.predictionResultId}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <h3 className="font-semibold text-slate-900">
              {tr(
                "Chưa có đề xuất AI đã lưu trong phạm vi này",
                "No saved AI recommendations in this scope",
              )}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {tr(
                "Mở Phân tích AI để kiểm tra dữ liệu và xem kết quả của nhân viên. Tổng quan không tạo dự đoán hay ghi dữ liệu tự động.",
                "Open AI analysis to check employee data and results. The overview does not automatically create predictions or write data.",
              )}
            </p>
          </div>
        )}
      </section>
</div></div></div></AppShell>;
}
