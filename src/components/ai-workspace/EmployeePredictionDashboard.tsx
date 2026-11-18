import { forwardRef, useId } from "react"
import { AlertTriangle, Database, Loader2, RefreshCw } from "lucide-react"
import type { AiEmployee, AiPrediction, AiSnapshot } from "../../services/api"
import {
  formatDateTime,
  formatPercent,
  getPredictionRisk,
  toPoints,
} from "./analysis"

export type PredictionDashboardState = "idle" | "loading" | "success" | "error"

type Props = {
  state: PredictionDashboardState
  result?: AiPrediction | null | undefined
  snapshot?: AiSnapshot | null | undefined
  employee?: AiEmployee | null | undefined
  error?: string | undefined
  loadingLabel?: string | undefined
  illustrative?: boolean | undefined
  busy?: boolean | undefined
  onRetry?: (() => void) | undefined
  onPredict: () => void
  history?: AiPrediction[]
  onOpenSaved: (id: number) => void
}

/** Basic individual prediction result only. SHAP, insights and policy recommendations belong to later modules. */
export const EmployeePredictionDashboard =
  forwardRef<HTMLHeadingElement, Props>(function EmployeePredictionDashboard(
    {
      state,
      result,
      snapshot,
      error,
      loadingLabel,
      illustrative = false,
      busy = false,
      onRetry,
      onPredict,
      onOpenSaved,
      history = [],
    },
    ref,
  ) {
    const gradientId = useId();
    const source = result?.preview ?? snapshot
    const snapshotId = result?.snapshotId ?? source?.snapshotId
    const risk = result ? getPredictionRisk(result.model) : null
    const percent = result
      ? Math.min(100, Math.max(0, toPoints(result.model.score)))
      : 0
    const hue = 120 * (1 - percent / 100);
    const captured = source?.capturedAt || source?.snapshotDate
    const age = captured
      ? Math.floor((Date.now() - Date.parse(captured)) / 86400000)
      : NaN

    return (
      <section
        aria-label="Kết quả đánh giá"
        className="panel h-full min-w-0"
        aria-busy={state === "loading"}
      >
        <div className="p-5">
          <details className="border-b py-4 text-sm">
            <summary className="cursor-pointer font-medium">
              Thông tin kỹ thuật
            </summary>
            <div className="mt-3 space-y-2 break-all">
              <p>Model: {result?.model.model_id || "—"}</p>
              <p>Schema: {result?.model.schema_version || "—"}</p>
              <p>Kết quả: {result?.predictionId ?? "—"}</p>
              <p>Snapshot: {snapshotId ?? "—"}</p>
              {result?.warning && <p>{result.warning}</p>}
            </div>
          </details>
          {state === "idle" && (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
                <Database className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold">
                Chưa có kết quả dự đoán
              </h3>
              <p className="mt-2 max-w-64 text-sm leading-6 text-slate-500">
                Kiểm tra dữ liệu bên trái và chọn Dự đoán để bắt đầu.
              </p>
            </div>
          )}

          {state === "loading" && (
            <div
              role="status"
              className="flex min-h-72 flex-col items-center justify-center text-center"
            >
              <Loader2
                className="h-8 w-8 animate-spin text-orange-600"
                aria-hidden
              />
              <h3 className="mt-4 text-base font-semibold">
                {loadingLabel ?? "Đang phân tích dữ liệu…"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Dữ liệu đầu vào vẫn được giữ nguyên.
              </p>
              <div className="mt-6 w-full max-w-56 space-y-2" aria-hidden>
                <div className="h-3 animate-pulse rounded bg-slate-100" />
                <div className="mx-auto h-3 w-2/3 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          )}

          {state === "error" && (
            <div
              role="alert"
              className="flex min-h-72 flex-col items-center justify-center text-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-700">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold">
                Không thể hoàn thành dự đoán
              </h3>
              <p className="mt-2 max-w-72 text-sm leading-6 text-slate-500">
                {error || "Vui lòng thử lại sau."}
              </p>
              {onRetry && (
                <button
                  type="button"
                  className="btn btn-secondary mt-5"
                  disabled={busy}
                  onClick={onRetry}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Thử lại
                </button>
              )}
            </div>
          )}

          {state === "success" && result && risk && (
            <div>
              <div className="mb-3 mt-5 flex items-center justify-between gap-3">
                <h2 ref={ref} tabIndex={-1} className="font-semibold">
                  Kết quả đánh giá
                </h2>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {result.saved ? "Kết quả đã lưu" : "Kết quả mới · Chưa lưu"}
                </span>
              </div>
              {illustrative && (
                <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-xs leading-5 text-slate-700">
                  Kết quả minh họa, không phải dự đoán Mexwell thật.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-6 rounded-xl bg-orange-50 p-5 sm:justify-between">
                <div className="relative h-36 w-36 text-orange-600">
                  <svg
                    viewBox="0 0 112 112"
                    className="h-full w-full -rotate-90"
                    role="img"
                    aria-label={`Xác suất dự đoán ${formatPercent(result.model.score)}`}
                  >
                    <defs><linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={`hsl(${Math.min(120, hue + 18)}, 75%, 42%)`} /><stop offset="100%" stopColor={`hsl(${hue}, 85%, 45%)`} /></linearGradient></defs>
                    <circle
                      cx="56"
                      cy="56"
                      r="46"
                      fill="none"
                      strokeWidth="9"
                      stroke="#e2e8f0"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="46"
                      fill="none"
                      strokeWidth="9"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={`${percent} 100`}
                      stroke={`url(#${gradientId})`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex rotate-0 flex-col items-center justify-center text-slate-900">
                    <span className="tabular text-3xl font-semibold tracking-tight">
                      {formatPercent(result.model.score)}
                    </span>
                  </div>
                </div>
                <div className="min-w-52 flex-1 text-center sm:text-left">
                  <p className="text-base font-medium">
                    Xác suất dự đoán nghỉ việc
                  </p>
                  <div className="mt-3 max-w-56" aria-label="Thang màu xác suất từ 0 đến 100 phần trăm">
                    <div className="h-1.5 rounded-full" style={{background: "linear-gradient(to right, hsl(120,85%,45%), hsl(60,85%,45%), hsl(0,85%,45%))"}} />
                    <div className="mt-1 flex justify-between text-xs text-slate-500"><span>0%</span><span>100%</span></div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {result.createdAt
                      ? `Đánh giá lúc ${formatDateTime(result.createdAt)}`
                      : "Chưa có thông tin ngày đánh giá."}
                  </p>
                  {risk.source === "backend" && risk.level !== "unknown" && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-sm text-slate-500">
                        Mức cảnh báo
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${risk.surfaceClass}`}
                      >
                        {risk.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <StatusItem
                  label="Lưu kết quả"
                  value={result.saved ? "Đã lưu" : "Chưa lưu"}
                />
                <StatusItem
                  label="Thời gian đánh giá"
                  value={
                    result.createdAt
                      ? formatDateTime(result.createdAt)
                      : "Chưa có thông tin ngày đánh giá."
                  }
                />
              </dl>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 min-[1200px]:grid-cols-1">
                <button
                  type="button"
                  className={`btn ${
                    result.saved ? "btn-primary" : "btn-secondary"
                  }`}
                  disabled={busy}
                  onClick={onPredict}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Dự đoán lại
                </button>
              </div>
            </div>
          )}

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatusItem
              label="So với lần đánh giá trước"
              value="Chưa đủ dữ liệu so sánh"
            />
            <StatusItem
              label="Độ mới của dữ liệu"
              value={
                Number.isFinite(age) && age >= 0
                  ? `${
                      age === 0 ? "Tạo hôm nay" : `Tạo ${age} ngày trước`
                    } · ${formatDateTime(captured)}`
                  : "Chưa có thông tin"
              }
            />
          </dl>
          <section className="mt-6 rounded-xl border border-slate-200 p-4" aria-label="Lịch sử dự đoán">
            <h3 className="font-semibold">Lịch sử dự đoán</h3>
            <label className="mt-3 block text-sm">Kết quả đã lưu
              <select className="field mt-2" disabled={busy || !history.length} value={result?.saved ? result.predictionId ?? "" : ""} onChange={event => { if(event.target.value) onOpenSaved(Number(event.target.value)); }}>
                <option value="">{history.length ? "Chọn bản ghi để xem kết quả" : "Chưa có kết quả đã lưu trong phiên này"}</option>
                {history.map(item => <option key={item.predictionId} value={item.predictionId}>Lần đánh giá — {item.createdAt ? formatDateTime(item.createdAt) : "Chưa có thông tin ngày đánh giá"} · {formatPercent(item.model.score)}</option>)}
              </select>
            </label>
            <p className="mt-2 text-sm text-slate-500">Các kết quả đã lưu được tải trong phiên làm việc này.</p>
          </section>
        </div>
      </section>
    )
  })

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-100 px-3 py-2.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="tabular mt-2 break-words text-base font-medium text-slate-900">
        {value}
      </dd>
    </div>
  )
}
