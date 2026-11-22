import { useAutoDismissState } from '../../hooks/useAutoDismissState';
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  Banknote,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react"
import {
  getAiResult,
  listAiEmployeeResults,
  getApiErrorMessage,
  predictAiEmployee,
  previewAiEmployee,
  type AiEmployee,
  type AiPrediction,
  type AiSnapshot,
} from "../../services/api"
import { featureLabel, formatDateTime } from "./analysis"
import {
  EmployeePredictionDashboard,
  type PredictionDashboardState,
} from "./EmployeePredictionDashboard"
import { Empty, Loading } from "./States"

type Sel = {
  employeeId?: number | undefined
  resultId?: number | undefined
}
type Props = {
  employees: AiEmployee[]
  initial: Sel
  onSelectionChange: (s: Sel) => void
  adapter?: {
    preview: typeof previewAiEmployee
    predict: typeof predictAiEmployee
    getResult: typeof getAiResult
    listResults?: typeof listAiEmployeeResults
  }
  illustrative?: boolean
}
type Busy = "" | "preview" | "predict" | "save" | "result"
type FailedAction = { type: "predict" } | { type: "result"; id: number } | null

export function IndividualAnalysis({
  employees,
  initial,
  onSelectionChange,
  adapter,
  illustrative = false,
}: Props) {
  const apiRef = useRef(
    adapter ?? {
      preview: previewAiEmployee,
      predict: predictAiEmployee,
      getResult: getAiResult,
      listResults: listAiEmployeeResults,
    },
  )
  const [employeeId, setEmployeeId] = useState<number | undefined>(
    initial.employeeId,
  )
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [employeeQuery, setEmployeeQuery] = useState("")
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [save, setSave] = useState(false)
  const predictionLock = useRef(false)
  const selectionVersion = useRef(0)
  const [busy, setBusy] = useState<Busy>("")
  const [dataError, setDataError] = useState("")
  const [result, setResult] = useState<AiPrediction | null>(null)
  const resultRef = useRef<AiPrediction | null>(null)
  const [savedResults, setSavedResults] = useState<AiPrediction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [saveNotice, setSaveNotice] = useAutoDismissState()
  function rememberSaved(value: AiPrediction) {
    if (!value.saved || !value.predictionId) return;
    setSavedResults(current => [value, ...current.filter(item => item.predictionId !== value.predictionId)]
      .sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0)));
  }
  const [resultError, setResultError] = useState("")
  const [failedAction, setFailedAction] = useState<FailedAction>(null)
  const [mobileTab, setMobileTab] = useState<"data" | "result">("data")
  const profileSeq = useRef(0)
  const historySeq = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const openedInitialResult = useRef(false)

  useEffect(() => {
    const api = apiRef.current
    const my = ++historySeq.current
    setSavedResults([])
    setHistoryError("")
    setHistoryLoading(!!employeeId)
    if (!employeeId || !api.listResults) {
      setHistoryLoading(false)
      return
    }
    api.listResults(employeeId)
      .then(async response => {
        const details = await Promise.allSettled(response.data.map(item => api.getResult(item.predictionId)))
        if (my !== historySeq.current) return
        const loaded = details.flatMap(item => item.status === "fulfilled" ? [item.value.data] : [])
        const ordered = loaded.sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0))
        setSavedResults(ordered)
        if (loaded.length !== response.data.length) setHistoryError("Một số lần đánh giá cũ chưa thể tải chi tiết.")
      })
      .catch(error => {
        if (my === historySeq.current) setHistoryError(getApiErrorMessage(error, "Không tải được lịch sử đánh giá."))
      })
      .finally(() => {
        if (my === historySeq.current) setHistoryLoading(false)
      })
  }, [employeeId])

  useEffect(() => {
    const api = apiRef.current
    const my = ++profileSeq.current
    setDataError("")
    setSnapshot(null)
    setSnapshotLoading(false)
    if (!employeeId) return
    setSnapshotLoading(true)
    api
      .preview(employeeId, {})
      .then((response) => {
        if (my !== profileSeq.current) return
        setSnapshot(response.data)
        onSelectionChange({ employeeId })
      })
      .catch(
        (error) =>
          my === profileSeq.current &&
          setDataError(
            normalizeProfileError(getApiErrorMessage(error, "Không tải được hồ sơ hiện tại.")),
          ),
      )
      .finally(() => my === profileSeq.current && setSnapshotLoading(false))
  }, [employeeId, employees])

  useEffect(() => {
    if (openedInitialResult.current || !initial.resultId) return
    openedInitialResult.current = true
    void openResult(initial.resultId)
    // The URL result is opened once; later selections are explicit user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (result) {
      const frame = window.requestAnimationFrame(() => {
        const main = headingRef.current?.closest("main")
        main?.scrollTo({ top: 0, behavior: "auto" })
        headingRef.current?.focus({ preventScroll: true })
      })
      resultRef.current = result
      return () => window.cancelAnimationFrame(frame)
    }
    resultRef.current = result
  }, [result, mobileTab])

  function chooseEmployee(id?: number) {
    selectionVersion.current++
    profileSeq.current++
    setSave(false)
    setEmployeeId(id)
    setResult(null)
    resultRef.current = null
    setResultError("")
    setFailedAction(null)
    setMobileTab("data")
    if (!id) setEmployeeQuery("")
    onSelectionChange({ employeeId: id })
  }

  async function runPrediction(
    saveOption = save,
    action: "predict" | "save" = "predict",
  ) {
    if (
      !employeeId ||
      !snapshot?.snapshotId ||
      !snapshot.ready ||
      busy ||
      predictionLock.current
    )
      return
    predictionLock.current = true
    const version = selectionVersion.current
    setBusy(action)
    setResult(null)
    setResultError("")
    setFailedAction(null)
    setMobileTab("result")
    try {
      const response = await apiRef.current.predict(
        employeeId,
        snapshot.snapshotId,
        saveOption,
      )
      if (version !== selectionVersion.current) return
      resultRef.current = response.data
      setResult(response.data)
      rememberSaved(response.data)
      if (response.data.saved) setSaveNotice("Đã lưu kết quả vào hồ sơ theo dõi.")
      if (response.data.saved && response.data.predictionId && !response.data.createdAt) {
        void apiRef.current.getResult(response.data.predictionId).then(detail => {
          rememberSaved(detail.data);
          if (version === selectionVersion.current) setResult(current => current?.predictionId === detail.data.predictionId ? detail.data : current);
        }).catch(() => {});
      }
      if (response.data.saved && response.data.predictionId)
        onSelectionChange({
          employeeId,
          resultId: response.data.predictionId,
        })
    } catch (error) {
      if (version !== selectionVersion.current) return

      setResultError(getApiErrorMessage(error, "Không hoàn thành được lần đánh giá."))
      setFailedAction({ type: "predict" })
    } finally {
      predictionLock.current = false
      setBusy("")
    }
  }

  async function openResult(id: number) {
    if (busy) return
    setBusy("result")
      setResult(null)
      resultRef.current = null
    setResultError("")
    setFailedAction(null)
    setMobileTab("result")
    try {
      const response = await apiRef.current.getResult(id)
      const nextSnapshot = response.data.preview
      if (employeeId && nextSnapshot.employee.id !== employeeId) throw new Error("Kết quả không thuộc nhân viên đang chọn.");
      rememberSaved(response.data)
      resultRef.current = response.data
      setResult(response.data)
      setSnapshot(nextSnapshot)
      setEmployeeId(nextSnapshot.employee.id)
      onSelectionChange({
        employeeId: nextSnapshot.employee.id,
        resultId: id,
      })
    } catch (error) {
      setResultError(getApiErrorMessage(error, "Không mở được kết quả đã lưu."))
      setFailedAction({ type: "result", id })
    } finally {
      setBusy("")
    }
  }

  const employee = employees.find((item) => item.id === employeeId)
  const employeeMatches = employees.filter(item => {
    const query = employeeQuery.trim().toLocaleLowerCase("vi-VN")
    return !query || `${item.employeeCode} ${item.fullName}`.toLocaleLowerCase("vi-VN").includes(query)
  }).slice(0, 12)
  const snapshotStatus = !snapshot
    ? null
    : snapshot.invalidFeatures?.length
      ? "invalid"
      : !snapshot.ready || snapshot.missingFeatures.length
        ? "missing"
        : "ready"
  const profileProblems = snapshot ? [
    ...snapshot.missingFeatures.map(key => `Thiếu ${featureLabel(key)}`),
    ...(snapshot.invalidFeatures ?? []).map(key => `Không hợp lệ: ${featureLabel(key)}`),
    ...snapshot.issues.filter(issue => !isInternalProfileMessage(issue)),
  ] : []
  const profileWarning = profileProblems.join(". ") || dataError
  const eligibilityMessage = employee && /Thiếu (Ngày vào làm|Hire Date)/i.test(profileWarning)
    ? `Thiếu Ngày vào làm của nhân viên ${employee.employeeCode}.`
    : profileWarning
  const dashboardState: PredictionDashboardState =
    busy === "predict" || busy === "save" || busy === "result"
      ? "loading"
      : resultError
        ? "error"
        : result
          ? "success"
          : "idle"
  const loadingLabel =
    busy === "result"
      ? "Đang mở kết quả đã lưu…"
      : busy === "save"
        ? "Đang đánh giá và lưu kết quả…"
        : "Đang phân tích dữ liệu…"
  const dataVisible =
    mobileTab === "data" ? "block min-w-0" : "hidden min-w-0 min-[1200px]:block"
  const resultVisible =
    mobileTab === "result" ? "block min-w-0" : "hidden min-w-0 min-[1200px]:block"

  return (
    <div className="space-y-5">
      <section className={`panel flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 ${mobileTab === "result" ? "hidden min-[1200px]:flex" : ""}`} aria-labelledby="prediction-selector-heading">
        <div className="relative min-w-0 flex-1" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSelectorOpen(false) }}>
          <h2 id="prediction-selector-heading" className="sr-only">Chọn nhân viên</h2>
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            aria-label="Tìm và chọn nhân viên"
            disabled={!!busy}
            className="field h-11 pl-10"
            value={employeeQuery}
            placeholder="Tìm nhân viên theo tên hoặc mã (VD: EMP005 - Hoàng Gia Hưng)..."
            onFocus={() => setSelectorOpen(true)}
            onChange={(event) => { setEmployeeQuery(event.target.value); setSelectorOpen(true) }}
          />
          {selectorOpen && <div className="absolute left-0 right-0 top-12 z-40 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {employeeMatches.length ? employeeMatches.map(item => <button key={item.id} type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50" onMouseDown={event => event.preventDefault()} onClick={() => { chooseEmployee(item.id); setEmployeeQuery(`${item.employeeCode} · ${item.fullName}`); setSelectorOpen(false) }}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{getInitials(item.fullName)}</span>
              <span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{item.fullName}</strong><span className="block truncate text-xs text-slate-500">{item.employeeCode}{snapshot?.employee.id === item.id && snapshot.features.Department ? ` · ${snapshot.features.Department}` : ""}</span></span>
            </button>) : <p className="px-3 py-5 text-center text-sm text-slate-500">Không tìm thấy nhân viên phù hợp.</p>}
          </div>}
        </div>
        {employee && <div className="flex flex-wrap items-center gap-2">
          {snapshot?.features.Department && <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">Phòng {snapshot.features.Department}</span>}
          {snapshot && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">Thâm niên: {formatTenure(snapshot.features.Years_At_Company)}</span>}
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Đang làm việc</span>
        </div>}
      </section>

      <div
        role="tablist"
        aria-label="Nội dung đánh giá cá nhân"
        className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 min-[1200px]:hidden"
      >
        {(["data", "result"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
            className={`h-9 rounded-md text-sm font-medium ${
              mobileTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            {tab === "data" ? "Dữ liệu" : "Kết quả"}
          </button>
        ))}
      </div>

      <div className="grid items-stretch gap-5 min-[1200px]:grid-cols-[minmax(0,38fr)_minmax(0,62fr)]">
        <div className={dataVisible}>
          <section
            className="panel flex min-h-[680px] w-full flex-col overflow-hidden"
            aria-labelledby="prediction-input-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 ${snapshot ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}>
                  {getInitials(employee?.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="metadata-label">Hồ sơ nhân viên</p>
                  <h2 id="prediction-input-heading" className="mt-1 truncate font-semibold text-slate-900">
                    {employee?.fullName || "Chưa chọn nhân viên"}
                  </h2>
                  {employee && <p className="mt-1 text-xs font-medium text-slate-600">{employee.employeeCode} · {String(snapshot?.features.Position ?? snapshot?.features.Department ?? "Chưa cập nhật chức danh")}</p>}
                </div>
              </div>
              <ProfileStatus status={snapshotStatus} loading={snapshotLoading} />
            </div>
            <div className="min-h-72 flex-1 overflow-y-auto px-5 py-4">
              {snapshotLoading ? (
                <Loading label="Đang nạp hồ sơ hiện tại…" />
              ) : !employee ? (
                <Empty>
                  Vui lòng chọn nhân viên ở thanh tìm kiếm phía trên để nạp hồ sơ.
                </Empty>
              ) : !snapshot ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Hồ sơ chưa đủ điều kiện đánh giá</p><p className="mt-1 leading-6">{eligibilityMessage || `Chưa thể nạp đủ dữ liệu của nhân viên ${employee.employeeCode}.`}</p><Link className="mt-3 inline-flex font-semibold text-amber-950 underline underline-offset-2" to={`/employees/${employee.id}/edit`}>Bấm vào đây để cập nhật hồ sơ</Link></div>
              ) : (
                <>
                  {snapshotStatus !== "ready" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Hồ sơ chưa đủ điều kiện đánh giá</p><p className="mt-1 leading-6">{eligibilityMessage || `Hồ sơ nhân viên ${employee.employeeCode} còn thiếu thông tin bắt buộc.`}</p><Link className="mt-3 inline-flex font-semibold text-amber-950 underline underline-offset-2" to={`/employees/${employee.id}/edit`}>Bấm vào đây để cập nhật hồ sơ</Link></div>
                  )}
                  <div className={`${snapshotStatus === "ready" ? "" : "mt-3"} space-y-3`}>
                    <FeatureGroups snapshot={snapshot} />
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white px-5 py-4">
              <button
                type="button"
                role="switch"
                aria-checked={save}
                disabled={!!busy}
                onClick={() => setSave(current => !current)}
                className="group flex items-center gap-2.5 rounded-md text-left text-sm font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              >
                <span
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${save ? "bg-orange-500" : "bg-slate-200"}`}
                  aria-hidden
                >
                  <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${save ? "translate-x-4" : "translate-x-0"}`} />
                </span>
                <span>Lưu vào hồ sơ theo dõi định kỳ</span>
              </button>
              <span title={!snapshot?.ready ? profileWarning || "Hồ sơ chưa đủ dữ liệu bắt buộc để đánh giá." : undefined}>
                <button type="button" className="btn btn-primary" disabled={!snapshot?.ready || !!busy} onClick={() => void runPrediction(save, "predict")}>{busy === "predict" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BrainCircuit className="h-4 w-4" aria-hidden />}{busy === "predict" ? "Đang đánh giá…" : "Đánh giá mức độ gắn kết"}</button>
              </span>
            </div>
          </section>
        </div>
        <div className={resultVisible}>
          <EmployeePredictionDashboard
            history={savedResults.filter(item => item.preview.employee.id === employeeId)}
            historyLoading={historyLoading}
            historyError={historyError}
            ref={headingRef}
            state={dashboardState}
            result={result}
            snapshot={snapshot}
            employee={employee}
            error={resultError}
            loadingLabel={loadingLabel}
            illustrative={illustrative}
            busy={!!busy}
            onRetry={
              failedAction
                ? () => {
                    if (failedAction.type === "result")
                      void openResult(failedAction.id)
                    else void runPrediction(save, "predict")
                  }
                : undefined
            }
            onPredict={() => void runPrediction(save, "predict")}
            onSave={() => void runPrediction(true, "save")}
            onOpenSaved={(id) => void openResult(id)}
          />
        </div>
      </div>
      {saveNotice && <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg"><CheckCircle2 className="h-4 w-4" aria-hidden />{saveNotice}</div>}
    </div>
  )
}

function ProfileStatus({
  status,
  loading,
}: {
  status: "ready" | "missing" | "invalid" | null
  loading: boolean
}) {
  if (loading) return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600"><Loader2 className="size-3.5 animate-spin" />Đang nạp hồ sơ</span>
  if (status === "ready") return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="size-3.5" />Dữ liệu hợp lệ · Sẵn sàng đánh giá</span>
  if (status) return <span className="inline-flex rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Hồ sơ cần bổ sung</span>
  return null
}

function FeatureGroups({ snapshot }: { snapshot: AiSnapshot }) {
  const f = snapshot.features
  const satisfaction = Number(f.Employee_Satisfaction_Score)
  const years = Number(f.Years_At_Company)
  const lastRaise = Number(f.Months_Since_Last_Raise ?? f.Last_Salary_Increase_Months)
  const onTime = Number(f.On_Time_Rate ?? f.Attendance_Rate)
  return <div>
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity className="size-4 text-slate-500" />Dữ liệu làm việc hiện tại</div>
    <div className="grid grid-cols-2 gap-2">
      <Metric label="Thời gian làm thêm" value={`${formatNumber(f.Overtime_Hours)} giờ`} />
      <Metric label="Nghỉ phép / Nghỉ ốm" value={`${formatNumber(f.Sick_Days)} ngày`} />
      <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-medium text-slate-500">Hài lòng gần nhất</p><p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{Number.isFinite(satisfaction) ? satisfaction.toFixed(2) : '—'} <span className="text-xs font-medium text-slate-500">/ 5.0</span></p><SatisfactionBar value={satisfaction} /></div>
      <Metric label="Thâm niên công tác" value={Number.isFinite(years) ? `${Math.round(years * 12)} tháng` : "—"} />
      <Metric label="Tăng lương gần nhất" value={Number.isFinite(lastRaise) ? `${lastRaise} tháng trước` : "Chưa có dữ liệu"} />
      <Metric label="Tỷ lệ đúng giờ" value={Number.isFinite(onTime) ? `${onTime.toFixed(1)}%` : "Chưa có dữ liệu"} />
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <Metric label="Ngày vào làm" value={formatDisplayValue(snapshot, 'Hire_Date')} />
      <Metric label="Lương cơ bản" value={formatDisplayValue(snapshot, 'Monthly_Salary')} icon={<Banknote className="size-4 text-slate-500" />} />
      <Metric label="Giờ làm / tuần" value={`${formatNumber(f.Work_Hours_Per_Week)} giờ`} />
      <Metric label="Đã thăng chức" value={`${formatNumber(f.Promotions)} lần`} />
    </div>
  </div>
}

function Metric({label, value, note, icon}: {label: string; value: string; note?: string; icon?: ReactNode}) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <div className="mt-1 flex items-center gap-1.5">{icon}<p className="text-base font-semibold tabular-nums text-slate-900">{value}</p></div>
    {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
  </div>
}
function formatNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('vi-VN', {maximumFractionDigits: 2}) : '—'
}
function formatTenure(value: unknown) {
  const years = Number(value)
  if (!Number.isFinite(years)) return "Chưa cập nhật"
  return `${years.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} năm`
}
function isInternalProfileMessage(message: string) {
  return /Chọn ngày bắt đầu hợp lệ|ngày hiện tại tại Việt Nam làm ngày chốt/i.test(message)
}
function normalizeProfileError(message: string) {
  if (isInternalProfileMessage(message)) return "Thiếu Ngày vào làm trong hồ sơ nhân viên."
  return message
}

function getInitials(name?: string) {
  if (!name) return "—"
  const parts = name.trim().split(/\s+/)
  return `${parts.at(-2)?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase()
}

function formatDisplayValue(snapshot: AiSnapshot, key: string) {
  const value = snapshot.features[key]
  if (value === null || value === undefined || value === "") return "—"
  if (key === "Gender") return ({ Male: "Nam", Female: "Nữ" } as Record<string, string>)[String(value)] ?? String(value)
  if (key === "Education_Level") return ({ Master: "Thạc sĩ", Bachelor: "Đại học", PhD: "Tiến sĩ", "High School": "Trung học phổ thông" } as Record<string, string>)[String(value)] ?? String(value)
  if (key === "Hire_Date") return formatDateTime(String(value))
  if (key === "Monthly_Salary" && Number.isFinite(Number(value)))
    return `${Number(value).toLocaleString("en-US")} USD/tháng`
  if (key === "Employee_Satisfaction_Score" && Number.isFinite(Number(value)))
    return `${Number(value).toFixed(2)} / 5.0`
  return String(value)
}

function SatisfactionBar({ value }: { value: number }) {
  const score = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0
  const colors = ['bg-orange-300', 'bg-amber-300', 'bg-lime-300', 'bg-teal-300', 'bg-emerald-400']
  return <span className="mt-2 flex gap-1" aria-hidden>{colors.map((color, index) => <span key={color} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${color}`} style={{width: `${Math.max(0, Math.min(1, score - index)) * 100}%`}} /></span>)}</span>
}
