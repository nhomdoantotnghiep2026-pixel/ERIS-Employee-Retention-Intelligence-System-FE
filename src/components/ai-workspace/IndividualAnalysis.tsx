import { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Play } from "lucide-react"
import {
  getAiResult,
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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog"

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
  }
  illustrative?: boolean
}
type Busy = "" | "preview" | "predict" | "save" | "result"
type FailedAction = { type: "predict" } | { type: "result"; id: number } | null

const FEATURE_GROUPS = [
  {
    title: "Thông tin cơ bản",
    keys: ["Department", "Gender", "Age", "Education_Level"],
  },
  {
    title: "Quá trình làm việc",
    keys: ["Hire_Date", "Years_At_Company", "Monthly_Salary", "Promotions"],
  },
  {
    title: "Công việc và trải nghiệm",
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
  const [confirmation, setConfirmation] = useState(false)
  const predictionLock = useRef(false)
  const selectionVersion = useRef(0)
  const [busy, setBusy] = useState<Busy>("")
  const [dataError, setDataError] = useState("")
  const [result, setResult] = useState<AiPrediction | null>(null)
  const [savedResults, setSavedResults] = useState<AiPrediction[]>([])
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
  const headingRef = useRef<HTMLHeadingElement>(null)
  const openedInitialResult = useRef(false)

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
    if (result) headingRef.current?.focus({ preventScroll: true })
  }, [result, mobileTab])

  function chooseEmployee(id?: number) {
    selectionVersion.current++
    snapSeq.current++
    setSave(false)
    setConfirmation(false)
    setEmployeeId(id)
    setSnapshotId(undefined)
    setResult(null)
    setResultError("")
    setFailedAction(null)
    setMobileTab("data")
    onSelectionChange({ employeeId: id })
  }

  function chooseSnapshot(id?: number) {
    selectionVersion.current++
    snapSeq.current++
    setSave(false)
    setConfirmation(false)
    setSnapshotId(id)
    setSnapshot(null)
    setResult(null)
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
    setConfirmation(false)
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
      setResult(response.data)
      rememberSaved(response.data)
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

      setResultError(getApiErrorMessage(error, "Không chạy được mô hình AI."))
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
    setResultError("")
    setFailedAction(null)
    setMobileTab("result")
    try {
      const response = await apiRef.current.getResult(id)
      const nextSnapshot = response.data.preview
      if (employeeId && nextSnapshot.employee.id !== employeeId) throw new Error("Kết quả không thuộc nhân viên đang chọn.");
      rememberSaved(response.data)
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
        ? "Đang dự đoán và lưu kết quả…"
        : "Đang phân tích dữ liệu…"
  const dataVisible =
    mobileTab === "data" ? "block h-full" : "hidden h-full min-[1200px]:block"
  const resultVisible =
    mobileTab === "result" ? "block h-full" : "hidden h-full min-[1200px]:block"

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
        aria-label="Nội dung dự đoán cá nhân"
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

      <div className="grid items-stretch gap-6 min-[1200px]:grid-cols-[minmax(0,39fr)_minmax(0,61fr)]">
        <div className={dataVisible}>
          <section
            className="panel flex h-full flex-col overflow-hidden"
            aria-labelledby="prediction-input-heading"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-600">
                  Dữ liệu đánh giá
                </p>
                <h2
                  id="prediction-input-heading"
                  className="mt-1 text-base font-semibold"
                >
                  {snapshot?.snapshotId
                    ? `Bản dữ liệu #${snapshot.snapshotId}`
                    : "Chưa chọn bản dữ liệu"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Ngày tạo:{" "}
                  {formatDateTime(
                    snapshot?.snapshotDate || snapshot?.capturedAt,
                  )}
                </p>
              </div>
              <SnapshotStatus status={snapshotStatus} />
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
                  <div className="mb-4 rounded-lg bg-slate-100 px-3 py-2.5 text-sm">
                    <span className="font-medium">
                      {snapshot.employee.fullName}
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      · {snapshot.employee.employeeCode}
                    </span>
                  </div>
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={save}
                  disabled={!!busy}
                  onChange={(event) => setSave(event.target.checked)}
                />
                Lưu kết quả
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!snapshot?.ready || !!busy}
                onClick={() => setConfirmation(true)}
              >
                <Play className="h-4 w-4" aria-hidden />
                {busy === "predict" ? "Đang dự đoán…" : "Dự đoán"}
              </button>
            </div>
          </section>
        </div>
        <div className={resultVisible}>
          <EmployeePredictionDashboard
            history={savedResults.filter(item => item.preview.employee.id === employeeId)}
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
                    else setConfirmation(true)
                  }
                : undefined
            }
            onPredict={() => setConfirmation(true)}
            onOpenSaved={(id) => void openResult(id)}
          />
        </div>
      </div>
      <Dialog open={confirmation} onOpenChange={setConfirmation}>
        <DialogContent>
          <DialogTitle>
            {save ? "Xác nhận dự đoán và lưu kết quả" : "Xác nhận dự đoán"}
          </DialogTitle>
          <DialogDescription>
            {save
              ? "Kết quả dự đoán thành công sẽ được lưu vào lịch sử của nhân viên."
              : "Kết quả sẽ chỉ được hiển thị tạm thời và không được lưu vào lịch sử. Bạn có muốn tiếp tục?"}
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <button
              autoFocus
              className="btn btn-secondary"
              onClick={() => setConfirmation(false)}
            >
              Hủy
            </button>
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() => void runPrediction()}
            >
              {save ? "Dự đoán và lưu" : "Dự đoán không lưu"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
  const grouped = new Set(FEATURE_GROUPS.flatMap((group) => group.keys))
  const extra = Object.keys(snapshot.features).filter(
    (key) => !grouped.has(key),
  )
  const groups = [
    ...FEATURE_GROUPS,
    ...(extra.length ? [{ title: "Thông tin khác", keys: extra }] : []),
  ]
  return groups.map((group) => {
    const keys = group.keys.filter((key) => key in snapshot.features)
    if (!keys.length) return null
    return (
      <details key={group.title} open>
        <summary className="cursor-pointer text-sm font-semibold">
          {group.title}
        </summary>
        <dl className="mt-2">
          {keys.map((key) => (
            <div
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-3 border-b py-2 text-sm last:border-0"
            >
              <dt className="text-slate-500">{featureLabel(key)}</dt>
              <dd className="tabular break-words text-right font-medium">
                {key === "Hire_Date"
                  ? formatDateTime(String(snapshot.features[key]))
                  : String(snapshot.features[key] ?? "—")}
                {FEATURE_UNITS[key] && key !== "Hire_Date" && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    {FEATURE_UNITS[key]}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    )
  })
}
