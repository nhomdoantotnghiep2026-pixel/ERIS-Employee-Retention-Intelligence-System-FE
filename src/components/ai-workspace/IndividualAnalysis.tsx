import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Activity,
  Banknote,
  AlertTriangle,
  BriefcaseBusiness,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  UserRound,
} from "lucide-react"
import {
  getAiResult,
  listAiEmployeeResults,
  getAiSnapshot,
  getApiErrorMessage,
  listAiSnapshots,
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
import { Empty, Loading, Notice } from "./States"

type Sel = {
  employeeId?: number | undefined
  snapshotId?: number | undefined
  resultId?: number | undefined
}
type Props = {
  employees: AiEmployee[]
  initial: Sel
  onSelectionChange: (s: Sel) => void
  adapter?: {
    listSnapshots: typeof listAiSnapshots
    getSnapshot: typeof getAiSnapshot
    preview: typeof previewAiEmployee
    predict: typeof predictAiEmployee
    getResult: typeof getAiResult
    listResults?: typeof listAiEmployeeResults
  }
  illustrative?: boolean
}
type Busy = "" | "preview" | "predict" | "save" | "result"
type FailedAction = { type: "predict" } | { type: "result"; id: number } | null
type DataNoticeTone = "warning" | "error"

const FEATURE_GROUPS = [
  {
    icon: UserRound,
    title: "Nhân thân",
    keys: ["Department", "Gender", "Age", "Education_Level"],
  },
  {
    icon: BriefcaseBusiness,
    title: "Chế độ đãi ngộ & Thâm niên",
    keys: ["Hire_Date", "Years_At_Company", "Monthly_Salary", "Promotions"],
  },
  {
    icon: Activity,
    title: "Nhịp độ công việc & Mức độ thỏa mãn",
    keys: [
      "Work_Hours_Per_Week",
      "Overtime_Hours",
      "Sick_Days",
      "Employee_Satisfaction_Score",
    ],
  },
]

export function IndividualAnalysis({
  employees,
  initial,
  onSelectionChange,
  adapter,
  illustrative = false,
}: Props) {
  const apiRef = useRef(
    adapter ?? {
      listSnapshots: listAiSnapshots,
      getSnapshot: getAiSnapshot,
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
  const [save, setSave] = useState(false)
  const predictionLock = useRef(false)
  const selectionVersion = useRef(0)
  const [busy, setBusy] = useState<Busy>("")
  const [dataError, setDataError] = useState("")
  const [dataNoticeTone, setDataNoticeTone] = useState<DataNoticeTone>("warning")
  const [result, setResult] = useState<AiPrediction | null>(null)
  const resultRef = useRef<AiPrediction | null>(null)
  const [savedResults, setSavedResults] = useState<AiPrediction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [saveNotice, setSaveNotice] = useState("")
  function rememberSaved(value: AiPrediction) {
    if (!value.saved || !value.predictionId) return;
    setSavedResults(current => [value, ...current.filter(item => item.predictionId !== value.predictionId)]
      .sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0)));
  }
  const [resultError, setResultError] = useState("")
  const [failedAction, setFailedAction] = useState<FailedAction>(null)
  const [mobileTab, setMobileTab] = useState<"data" | "result">("data")
  const seq = useRef(0)
  const historySeq = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const openedInitialResult = useRef(false)

  useEffect(() => {
    if (!saveNotice) return
    const timer = window.setTimeout(() => setSaveNotice(""), 4000)
    return () => window.clearTimeout(timer)
  }, [saveNotice])

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
    const my = ++seq.current
    setDataError("")
    setDataNoticeTone("warning")
    setSnapshot(null)
    setSnapshotLoading(!!employeeId)
    if (!employeeId) {
      setSnapshotLoading(false)
      return
    }
    api.listSnapshots(employeeId)
      .then(async (response) => {
        if (my !== seq.current) return
        const latest = [...response.data]
          .filter((item) => item.snapshotId)
          .sort((a, b) =>
            (Date.parse(b.snapshotDate || b.capturedAt || "") || 0) -
              (Date.parse(a.snapshotDate || a.capturedAt || "") || 0) ||
            (b.snapshotId ?? 0) - (a.snapshotId ?? 0),
          )[0]
        const current = latest?.snapshotId
          ? await api.getSnapshot(employeeId, latest.snapshotId)
          : await api.preview(employeeId, {})
        if (my !== seq.current) return
        setSnapshot(current.data)
        onSelectionChange({ employeeId })
      })
      .catch((error) => {
        if (my !== seq.current) return
        const message = getApiErrorMessage(error, "Không tải được dữ liệu hiện tại của nhân viên.")
        const profileMessage = formatProfileDataIssue(message)
        setDataNoticeTone(profileMessage ? "warning" : "error")
        setDataError(profileMessage || message)
      })
      .finally(() => my === seq.current && setSnapshotLoading(false))
  }, [employeeId])

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
    setSave(false)
    setEmployeeId(id)
    setDataError("")
    setDataNoticeTone("warning")
    setResult(null)
    resultRef.current = null
    setResultError("")
    setFailedAction(null)
    setMobileTab("data")
    onSelectionChange({ employeeId: id })
  }

  async function runPrediction(
    saveOption = save,
    action: "predict" | "save" = "predict",
  ) {
    if (
      !employeeId ||
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
      const previewResponse = await apiRef.current.preview(employeeId, {})
      if (version !== selectionVersion.current) return
      const currentSnapshot = previewResponse.data
      setSnapshot(currentSnapshot)
      if (!currentSnapshot.snapshotId || !currentSnapshot.ready) {
        setMobileTab("data")
        setDataNoticeTone("warning")
        setDataError(
          currentSnapshot.issues?.map(formatProfileDataIssue).filter(Boolean).join(". ") ||
            "Dữ liệu hiện tại chưa đủ điều kiện để đánh giá. Vui lòng cập nhật hồ sơ nhân viên.",
        )
        return
      }
      const response = await apiRef.current.predict(
        employeeId,
        currentSnapshot.snapshotId,
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
          snapshotId: currentSnapshot.snapshotId,
          resultId: response.data.predictionId,
        })
    } catch (error) {
      if (version !== selectionVersion.current) return
      const message = getApiErrorMessage(error, "Không hoàn thành được lần đánh giá.")
      const profileMessage = formatProfileDataIssue(message)
      if (profileMessage) {
        setMobileTab("data")
        setDataNoticeTone("warning")
        setDataError(profileMessage)
        setResultError("")
        setFailedAction(null)
      } else {
        setResultError(message)
        setFailedAction({ type: "predict" })
      }
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
        snapshotId:
          response.data.snapshotId ?? nextSnapshot.snapshotId ?? undefined,
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
  const selectedEmployee = snapshot?.employee ?? employee
  const snapshotStatus = !snapshot
    ? !employeeId
      ? null
      : snapshotLoading
        ? "loading"
        : dataError && dataNoticeTone === "error"
          ? "unavailable"
          : "missing"
    : snapshot.invalidFeatures?.length
      ? "invalid"
      : !snapshot.ready || snapshot.missingFeatures.length
        ? "missing"
        : "ready"
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
      <section
        className={`panel p-4 ${
          mobileTab === "result" ? "hidden min-[1200px]:block" : ""
        }`}
        aria-labelledby="prediction-selector-heading"
      >
        <h2
          id="prediction-selector-heading"
          className="text-base font-semibold"
        >
          Chọn nhân viên
        </h2>
        <div className="mt-3 max-w-2xl">
          <label className="block text-xs font-medium text-slate-500">
            Nhân viên
            <select
              aria-label="Nhân viên"
              disabled={!!busy}
              className="field mt-1.5 text-slate-900"
              value={employeeId ?? ""}
              onChange={(event) =>
                chooseEmployee(
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
            >
              <option value="">Chọn nhân viên</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.employeeCode} · {item.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
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
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 ${snapshot ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}>
                  {getInitials(selectedEmployee?.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="metadata-label">Hồ sơ nhân viên</p>
                  <h2 id="prediction-input-heading" className="mt-1 truncate font-semibold text-slate-900">
                    {selectedEmployee?.fullName || "Chưa chọn nhân viên"}
                  </h2>
                  {selectedEmployee?.employeeCode && <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{selectedEmployee.employeeCode}</span>}
                  {snapshot && <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                    <span>{snapshot.features.Age} tuổi</span><span aria-hidden>•</span>
                    <span>{formatDisplayValue(snapshot, 'Gender')}</span><span aria-hidden>•</span>
                    <span>{educationTag(snapshot.features.Education_Level)}</span><span aria-hidden>•</span>
                    <span>{snapshot.features.Department}</span>
                  </div>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <SnapshotStatus status={snapshotStatus} />
              </div>
            </div>
            {dataError && (
              <div className="px-5 pt-4">
                <Notice
                  tone={dataNoticeTone}
                  title={dataNoticeTone === "warning" ? "Hồ sơ nhân viên còn thiếu thông tin" : "Chưa tải được hồ sơ"}
                >
                  {dataError}
                </Notice>
              </div>
            )}
            <div className="min-h-72 flex-1 overflow-y-auto px-5 py-4">
              {snapshotLoading ? (
                <Loading label="Đang tải dữ liệu hiện tại…" />
              ) : !snapshot ? (
                <Empty>
                  {!employeeId
                    ? "Chọn nhân viên để tải dữ liệu hiện tại từ hồ sơ."
                    : dataNoticeTone === "warning"
                      ? "Cập nhật các thông tin còn thiếu trong hồ sơ nhân viên để tiếp tục đánh giá."
                      : "Chưa thể tải dữ liệu hồ sơ nhân viên. Vui lòng thử lại."}
                </Empty>
              ) : (
                <>
                  {snapshotStatus !== "ready" && (
                    <Notice
                      tone="warning"
                      title={
                        snapshotStatus === "invalid"
                          ? "Dữ liệu không hợp lệ"
                          : "Dữ liệu còn thiếu"
                      }
                    >
                      {[
                        ...snapshot.missingFeatures.map(
                          (key) => `Thiếu ${featureLabel(key)}`,
                        ),
                        ...(snapshot.invalidFeatures ?? []).map(
                          (key) => `Không hợp lệ: ${featureLabel(key)}`,
                        ),
                        ...snapshot.issues.map((issue) => formatProfileDataIssue(issue) || "Một số thông tin hồ sơ cần được cập nhật."),
                      ].join(". ")}
                    </Notice>
                  )}
                  <div className="mt-3 space-y-3">
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
              <button
                type="button"
                className="btn btn-primary"
                disabled={!snapshot?.ready || !!busy}
                onClick={() => void runPrediction(save, "predict")}
              >
                {busy === "predict" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BrainCircuit className="h-4 w-4" aria-hidden />}
                {busy === "predict" ? "Đang đánh giá…" : "Đánh giá mức độ gắn kết"}
              </button>
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

function formatProfileDataIssue(message: string) {
  const normalized = message.trim().toLocaleLowerCase("vi")
  if (!normalized) return null
  if (/ngày bắt đầu|ngày vào làm|hire[_\s-]?date|start date/.test(normalized))
    return "Nhân viên chưa có ngày vào làm hợp lệ. Vui lòng cập nhật ngày vào làm trong hồ sơ nhân viên."
  if (/lương|salary|monthly[_\s-]?salary/.test(normalized))
    return "Nhân viên chưa có thông tin lương tháng hợp lệ. Vui lòng cập nhật lương trong hồ sơ nhân viên."
  if (/ngày nghỉ|nghỉ\/vắng|sick[_\s-]?days|absence/.test(normalized))
    return "Nhân viên chưa có thông tin ngày nghỉ/vắng cần thiết cho đánh giá. Vui lòng cập nhật hồ sơ liên quan."
  if (/phòng ban|department/.test(normalized))
    return "Nhân viên chưa có thông tin phòng ban hợp lệ. Vui lòng cập nhật phòng ban trong hồ sơ nhân viên."
  if (/thiếu|bắt buộc|required|missing|không hợp lệ|chưa hợp lệ|invalid|phải chọn|hãy chọn/.test(normalized))
    return "Hồ sơ nhân viên còn thiếu hoặc có thông tin chưa hợp lệ. Vui lòng cập nhật hồ sơ trước khi đánh giá."
  return null
}

function SnapshotStatus({
  status,
}: {
  status: "ready" | "missing" | "invalid" | "loading" | "unavailable" | null
}) {
  if (!status)
    return (
      <span className="flex h-10 items-center text-sm text-slate-500">
        Chưa chọn
      </span>
    )
  const config =
    status === "loading"
      ? {
          label: "Đang tải",
          className: "bg-slate-100 text-slate-600",
          Icon: Loader2,
        }
      : status === "ready"
      ? {
          label: "Sẵn sàng",
          className: "bg-orange-50 text-emerald-700",
          Icon: CheckCircle2,
        }
      : {
          label: status === "invalid" ? "Không hợp lệ" : status === "unavailable" ? "Chưa tải được" : "Thiếu dữ liệu",
          className:
            status === "invalid" || status === "unavailable"
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-800",
          Icon: AlertTriangle,
        }
  return (
    <span
      className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium ${config.className}`}
    >
      <config.Icon className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} aria-hidden />
      {config.label}
    </span>
  )
}

function FeatureGroups({ snapshot }: { snapshot: AiSnapshot }) {
  const f = snapshot.features
  const satisfaction = Number(f.Employee_Satisfaction_Score)
  return <div className="grid gap-3">
    <section className="rounded-lg bg-slate-50 p-3.5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><BriefcaseBusiness className="size-4 text-slate-500" />Đãi ngộ & Thâm niên</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Metric label="Ngày vào làm" value={formatDisplayValue(snapshot, 'Hire_Date')} note={formatTenure(f.Years_At_Company)} />
        <Metric label="Lương cơ bản" value={formatDisplayValue(snapshot, 'Monthly_Salary')} icon={<Banknote className="size-4 text-slate-500" />} />
        <Metric label="Đã thăng chức" value={`${formatNumber(f.Promotions, 0)} lần`} />
      </div>
    </section>
    <section>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity className="size-4 text-slate-500" />Vận hành & Cảm xúc</div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Giờ làm / tuần" value={formatMetric(f.Work_Hours_Per_Week, " giờ")} />
        <Metric label="Tăng ca từ đầu năm" value={formatMetric(f.Overtime_Hours, " giờ")} />
        <Metric label="Vắng mặt từ đầu năm" value={formatMetric(f.Sick_Days, " ngày")} />
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">Điểm hài lòng</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{Number.isFinite(satisfaction) ? satisfaction.toFixed(2) : '—'} <span className="text-xs font-medium text-slate-500">/ 5.0</span></p>
          <SatisfactionBar value={satisfaction} />
        </div>
      </div>
    </section>
  </div>
}

function Metric({label, value, note, icon}: {label: string; value: string; note?: string; icon?: ReactNode}) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <div className="mt-1 flex items-center gap-1.5">{icon}<p className="text-base font-semibold tabular-nums text-slate-900">{value}</p></div>
    {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
  </div>
}
function formatNumber(value: unknown, fallback: string | number = '—') {
  const number = Number(value)
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number)
    ? number.toLocaleString('vi-VN', {maximumFractionDigits: 2})
    : String(fallback)
}
function formatMetric(value: unknown, unit: string) {
  const formatted = formatNumber(value)
  return formatted === '—' ? formatted : `${formatted}${unit}`
}
function formatTenure(value: unknown) {
  const formatted = formatNumber(value)
  return formatted === '—' ? 'Thâm niên chưa cập nhật' : `Thâm niên ${formatted} năm`
}
function educationTag(value: unknown) {
  return ({Bachelor: 'Cử nhân (Đại học)', Master: 'Thạc sĩ', PhD: 'Tiến sĩ', 'High School': 'Trung học phổ thông'} as Record<string,string>)[String(value)] ?? String(value ?? '—')
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
