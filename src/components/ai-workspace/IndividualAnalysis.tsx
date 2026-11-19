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
import {
  FEATURE_CHOICES,
  FEATURE_UNITS,
  featureLabel,
  formatDateTime,
} from "./analysis"
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
  const [snapshots, setSnapshots] = useState<AiSnapshot[] | null>(null)
  const [snapshotId, setSnapshotId] = useState<number | undefined>(
    initial.snapshotId,
  )
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [supplement, setSupplement] = useState<Record<string, string>>({})
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
  const snapSeq = useRef(0)
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
        const latest = ordered[0]
        if (latest && !resultRef.current && !predictionLock.current) {
          resultRef.current = latest
          setResult(latest)
          setSnapshot(latest.preview)
          setSnapshotId(latest.snapshotId ?? latest.preview.snapshotId ?? undefined)
          onSelectionChange({
            employeeId,
            snapshotId: latest.snapshotId ?? latest.preview.snapshotId ?? undefined,
            resultId: latest.predictionId,
          })
        }
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
    setSnapshots(null)
    setDataError("")
    setSnapshot(null)
    setSupplement({})
    if (!employeeId) return
    api
      .listSnapshots(employeeId)
      .then((response) => my === seq.current && setSnapshots(response.data))
      .catch(
        (error) =>
          my === seq.current &&
          setDataError(
            getApiErrorMessage(error, "Không tải được danh sách bản dữ liệu."),
          ),
      )
  }, [employeeId])

  useEffect(() => {
    const api = apiRef.current
    const my = ++snapSeq.current
    setSnapshotLoading(false)
    if (!employeeId || !snapshotId) return
    setSnapshotLoading(true)
    api
      .getSnapshot(employeeId, snapshotId)
      .then((response) => my === snapSeq.current && setSnapshot(response.data))
      .catch(
        (error) =>
          my === snapSeq.current &&
          setDataError(
            getApiErrorMessage(error, "Không tải được bản dữ liệu."),
          ),
      )
      .finally(() => my === snapSeq.current && setSnapshotLoading(false))
  }, [employeeId, snapshotId])

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
    snapSeq.current++
    setSave(false)
    setEmployeeId(id)
    setSnapshotId(undefined)
    setResult(null)
    resultRef.current = null
    setResultError("")
    setFailedAction(null)
    setMobileTab("data")
    onSelectionChange({ employeeId: id })
  }

  function chooseSnapshot(id?: number) {
    selectionVersion.current++
    snapSeq.current++
    setSave(false)
    setSnapshotId(id)
    setSnapshot(null)
    setResult(null)
    resultRef.current = null
    setResultError("")
    setFailedAction(null)
    setMobileTab("data")
    onSelectionChange({ employeeId, snapshotId: id })
  }

  async function prepare() {
    if (!employeeId || busy) return
    const version = selectionVersion.current
    if (snapshotId) {
      setBusy("preview")
      setDataError("")
      try {
        const response = await apiRef.current.getSnapshot(
          employeeId,
          snapshotId,
        )
        if (version === selectionVersion.current) setSnapshot(response.data)
      } catch (error) {
        if (version === selectionVersion.current)
          setDataError(
            getApiErrorMessage(
              error,
              "Không thể kiểm tra bản dữ liệu. Vui lòng thử lại.",
            ),
          )
      } finally {
        setBusy("")
      }
      return
    }
    const extras: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(supplement))
      if (value.trim())
        extras[key] =
          FEATURE_CHOICES[key] || key === "Hire_Date" ? value : Number(value)
    if (
      Object.values(extras).some(
        (value) => typeof value === "number" && !Number.isFinite(value),
      )
    ) {
      setDataError("Vui lòng kiểm tra các giá trị số.")
      return
    }
    setBusy("preview")
    setDataError("")
    setResult(null)
    setResultError("")
    try {
      const response = await apiRef.current.preview(employeeId, {
        ...(Object.keys(extras).length ? { supplementalFeatures: extras } : {}),
      })
      setSnapshot(response.data)
      if (response.data.snapshotId) {
        setSupplement({})
        setSnapshotId(response.data.snapshotId)
        onSelectionChange({ employeeId, snapshotId: response.data.snapshotId })
        apiRef.current
          .listSnapshots(employeeId)
          .then((next) => setSnapshots(next.data))
          .catch(() => undefined)
      }
    } catch (error) {
      setDataError(getApiErrorMessage(error, "Không kiểm tra được dữ liệu."))
    } finally {
      setBusy("")
    }
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
          snapshotId: snapshot.snapshotId,
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
      setSnapshotId(
        response.data.snapshotId ?? nextSnapshot.snapshotId ?? undefined,
      )
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
  const snapshotStatus = !snapshot
    ? null
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
          Chọn nhân viên và bản dữ liệu
        </h2>
        <div className="mt-3 grid items-end gap-3 min-[768px]:grid-cols-2 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <label className="text-xs font-medium text-slate-500">
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
          <label className="text-xs font-medium text-slate-500">
            Bản dữ liệu
            <select
              aria-label="Bản dữ liệu"
              className="field mt-1.5 text-slate-900"
              value={snapshotId ?? ""}
              disabled={!employeeId || !snapshots || !!busy}
              onChange={(event) =>
                chooseSnapshot(
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
            >
              <option value="">
                {!employeeId
                  ? "Chọn nhân viên trước"
                  : !snapshots
                    ? "Đang tải…"
                    : snapshots.length
                      ? "Chọn bản dữ liệu"
                      : "Chưa có bản dữ liệu"}
              </option>
              {snapshots?.map(
                (item) =>
                  item.snapshotId && (
                    <option key={item.snapshotId} value={item.snapshotId}>
                      Bản {item.snapshotId} ·{" "}
                      {formatDateTime(item.snapshotDate || item.capturedAt)} ·{" "}
                      {item.ready ? "Sẵn sàng" : "Thiếu dữ liệu"}
                    </option>
                  ),
              )}
            </select>
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Trạng thái
            </span>
            <SnapshotStatus status={snapshotStatus} />
          </div>
          <button
            type="button"
            className="btn btn-secondary whitespace-nowrap"
            disabled={!employeeId || !!busy}
            onClick={() => void prepare()}
          >
            {busy === "preview"
              ? "Đang kiểm tra…"
              : snapshotId
                ? "Kiểm tra dữ liệu"
                : "Tạo bản dữ liệu"}
          </button>
        </div>
        {employeeId && (
          <details
            className="mt-3 border-t pt-3 text-sm"
            open={!!snapshot && !snapshot.ready}
          >
            <summary className="cursor-pointer text-xs font-medium text-slate-500">
              Tùy chọn kiểm tra và bổ sung dữ liệu
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {snapshot?.missingFeatures.map((key) => (
                <label key={key} className="text-xs font-medium">
                  {featureLabel(key)}
                  {FEATURE_UNITS[key] ? ` (${FEATURE_UNITS[key]})` : ""}
                  {FEATURE_CHOICES[key] ? (
                    <select
                      className="field mt-1.5"
                      value={supplement[key] || ""}
                      onChange={(event) =>
                        setSupplement((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Chọn giá trị</option>
                      {FEATURE_CHOICES[key].map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="field tabular mt-1.5"
                      type={key === "Hire_Date" ? "date" : "number"}
                      value={supplement[key] || ""}
                      onChange={(event) =>
                        setSupplement((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          </details>
        )}
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
                  {getInitials(snapshot?.employee.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="metadata-label">Hồ sơ nhân viên</p>
                  <h2 id="prediction-input-heading" className="mt-1 truncate font-semibold text-slate-900">
                    {snapshot?.employee.fullName || "Chưa chọn nhân viên"}
                  </h2>
                  {snapshot?.employee.employeeCode && <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{snapshot.employee.employeeCode}</span>}
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
                {snapshot?.snapshotId && <span className="text-xs font-medium text-slate-500">Bản ghi #{snapshot.snapshotId}</span>}
              </div>
            </div>
            {dataError && (
              <div className="px-5 pt-4">
                <Notice tone="error">{dataError}</Notice>
              </div>
            )}
            <div className="min-h-72 flex-1 overflow-y-auto px-5 py-4">
              {snapshotLoading ? (
                <Loading label="Đang tải bản dữ liệu…" />
              ) : !snapshot ? (
                <Empty>
                  Chọn nhân viên và bản dữ liệu, hoặc tạo bản dữ liệu mới từ hồ
                  sơ hiện tại.
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
                        ...snapshot.issues,
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

function SnapshotStatus({
  status,
}: {
  status: "ready" | "missing" | "invalid" | null
}) {
  if (!status)
    return (
      <span className="flex h-10 items-center text-sm text-slate-500">
        Chưa chọn
      </span>
    )
  const config =
    status === "ready"
      ? {
          label: "Sẵn sàng",
          className: "bg-orange-50 text-emerald-700",
          Icon: CheckCircle2,
        }
      : {
          label: status === "invalid" ? "Không hợp lệ" : "Thiếu dữ liệu",
          className:
            status === "invalid"
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-800",
          Icon: AlertTriangle,
        }
  return (
    <span
      className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium ${config.className}`}
    >
      <config.Icon className="h-3.5 w-3.5" aria-hidden />
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
        <Metric label="Ngày vào làm" value={formatDisplayValue(snapshot, 'Hire_Date')} note={`Thâm niên ${f.Years_At_Company} năm`} />
        <Metric label="Lương cơ bản" value={formatDisplayValue(snapshot, 'Monthly_Salary')} icon={<Banknote className="size-4 text-slate-500" />} />
        <Metric label="Đã thăng chức" value={`${f.Promotions} lần`} />
      </div>
    </section>
    <section>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity className="size-4 text-slate-500" />Vận hành & Cảm xúc</div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Giờ làm / tuần" value={`${formatNumber(f.Work_Hours_Per_Week)}h`} />
        <Metric label="Tăng ca YTD" value={`${formatNumber(f.Overtime_Hours)}h`} />
        <Metric label="Vắng mặt YTD" value={`${formatNumber(f.Sick_Days)} ngày`} />
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
function formatNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('vi-VN', {maximumFractionDigits: 2}) : '—'
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
