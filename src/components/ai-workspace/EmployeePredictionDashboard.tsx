import { forwardRef, useId, useMemo, useState } from "react";
import { buildInsights } from "./insight-engine";
import { InsightPlaybook } from "./InsightPlaybook";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  Minus,
  RefreshCw,
  RotateCcw,
  Save,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { AiEmployee, AiPrediction, AiSnapshot } from "../../services/api";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import {
  featureLabel,
  formatDateTime,
  formatPercent,
  toPoints,
} from "./analysis";

export type PredictionDashboardState = "idle" | "loading" | "success" | "error";
type Props = {
  state: PredictionDashboardState;
  result?: AiPrediction | null;
  snapshot?: AiSnapshot | null;
  employee?: AiEmployee | null;
  error?: string;
  loadingLabel?: string;
  illustrative?: boolean;
  busy?: boolean;
  onRetry?: () => void;
  onPredict: () => void;
  onSave: () => void;
  history?: AiPrediction[];
  historyLoading?: boolean;
  historyError?: string;
  onOpenSaved: (id: number) => void;
  policyBusy?: boolean;
  policyError?: string;
  onAnalyzePolicy?: (options: { from: string; to: string; save: boolean }) => void;
};

const riskConfig = (percent: number) =>
  percent < 25
    ? {
        label: "NGUY CƠ THẤP",
        status: "Ổn định",
        text: "text-emerald-700",
        surface: "border-emerald-200 bg-emerald-50",
        stroke: "#059669",
        gradientFrom: "#10b981",
        gradientTo: "#14b8a6",
        hero: "border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/30",
        glow: "drop-shadow-[0_0_5px_rgba(16,185,129,0.35)]",
      }
    : percent <= 60
      ? {
          label: "CẦN THEO DÕI",
          status: "Cần lưu ý",
          text: "text-amber-700",
          surface: "border-amber-200 bg-amber-50",
          stroke: "#d97706",
          gradientFrom: "#f59e0b",
          gradientTo: "#f97316",
          hero: "border-amber-200/60 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30",
          glow: "drop-shadow-[0_0_5px_rgba(245,158,11,0.35)]",
        }
      : {
          label: "ƯU TIÊN QUAN TÂM",
          status: "Cần quan tâm",
          text: "text-rose-700",
          surface: "border-rose-200 bg-rose-50",
          stroke: "#e11d48",
          gradientFrom: "#f43f5e",
          gradientTo: "#dc2626",
          hero: "border-rose-200/60 bg-gradient-to-br from-rose-50/70 via-white to-orange-50/30",
          glow: "drop-shadow-[0_0_5px_rgba(244,63,94,0.35)]",
        };

export const EmployeePredictionDashboard = forwardRef<
  HTMLHeadingElement,
  Props
>(function EmployeePredictionDashboard(
  {
    state,
    result,
    snapshot,
    employee,
    error,
    loadingLabel,
    illustrative = false,
    busy = false,
    onRetry,
    onPredict,
    onSave,
    onOpenSaved,
    history = [],
    historyLoading = false,
    historyError = "",
    policyBusy = false,
    policyError = "",
    onAnalyzePolicy,
  },
  ref,
) {
  const [activeTab, setActiveTab] = useState(0);
  const [focusFeature, setFocusFeature] = useState<string | null>(null);
  const gaugeGradientId = useId();
  const insights = useMemo(() => buildInsights(result?.model.contributions, result ? {
    ...result.preview.features,
    __capturedAt: result.preview.capturedAt,
    __snapshotDate: result.preview.snapshotDate,
  } : {}), [result]);
  const resultKey = result ? JSON.stringify([result.preview.employee.id, result.predictionId, result.createdAt, result.model.score, result.preview.features]) : "empty";
  const source = result?.preview ?? snapshot;
  const percent = result
    ? Math.min(100, Math.max(0, toPoints(result.model.score)))
    : 0;
  const risk = riskConfig(percent);
  const orderedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "") ||
          (b.predictionId ?? 0) - (a.predictionId ?? 0),
      ),
    [history],
  );
  const currentIndex = result?.predictionId
    ? orderedHistory.findIndex(
        (item) => Number(item.predictionId) === Number(result.predictionId),
      )
    : -1;
  const previous = result
    ? currentIndex >= 0
      ? orderedHistory[currentIndex + 1]
      : orderedHistory[0]
    : undefined;
  const currentNumber =
    currentIndex >= 0 ? orderedHistory.length - currentIndex : undefined;
  const previousNumber = previous
    ? currentIndex >= 0
      ? orderedHistory.length - currentIndex - 1
      : orderedHistory.length
    : undefined;
  const delta =
    result && previous
      ? toPoints(result.model.score - previous.model.score)
      : null;

  return (
    <section
      aria-label="Mức độ gắn kết tổng thể"
      className="panel min-h-[620px] w-full min-w-0"
      aria-busy={state === "loading"}
    >
      <div className="p-5 sm:p-6">
        <div
          role="tablist"
          aria-label="Hồ sơ gắn kết"
          className="mb-5 flex flex-wrap gap-1 border-b border-slate-200 pb-3"
        >
          {[
            "1. Tình trạng gắn kết",
            "2. Nguyên nhân & Tín hiệu",
            "3. Kế hoạch hành động",
          ].map((label, index) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === index}
              key={label}
              onClick={() => setActiveTab(index)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab === index ? "bg-gradient-to-r from-slate-950 to-slate-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div hidden={activeTab !== 0}>
          {state === "idle" && <EmptyResult employee={employee} ready={Boolean(snapshot?.ready)} busy={busy} onPredict={onPredict} />}
          {state === "loading" && (
            <div
              role="status"
              className="flex min-h-80 flex-col items-center justify-center text-center"
            >
              <Loader2
                className="h-8 w-8 animate-spin text-orange-600"
                aria-hidden
              />
              <h3 className="mt-4 font-semibold text-slate-900">
                {loadingLabel ?? "Đang xử lý dữ liệu…"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Dữ liệu đầu vào vẫn được giữ nguyên.
              </p>
            </div>
          )}
          {state === "error" && (
            <ErrorResult error={error} busy={busy} onRetry={onRetry} />
          )}
          {state === "success" && result && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="metadata-label">Theo dõi nhân sự</p>
                  <h2
                    ref={ref}
                    tabIndex={-1}
                    className="mt-1 text-lg font-semibold text-slate-900"
                  >
                    Mức độ gắn kết tổng thể
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={busy}
                  onClick={onPredict}
                >
                  <RefreshCw aria-hidden />
                  Đánh giá lại
                </Button>
              </div>
              {illustrative && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Kết quả tham khảo; cần trao đổi thêm với nhân viên trước khi
                  quyết định.
                </p>
              )}
              <Hero
                result={result}
                percent={percent}
                risk={risk}
                gradientId={gaugeGradientId}
              />
              <StatusCards
                result={result}
                previous={previous}
                currentNumber={currentNumber}
                previousNumber={previousNumber}
                delta={delta}
                busy={busy}
                onSave={onSave}
              />
              <HistoryToolbar
                history={orderedHistory}
                result={result}
                busy={busy}
                loading={historyLoading}
                error={historyError}
                onOpenSaved={onOpenSaved}
              />
            </div>
          )}
        </div>

        {activeTab !== 0 && (result ? <InsightPlaybook
          key={resultKey}
          engine={insights}
          tab={activeTab === 1 ? 'insights' : 'policies'}
          features={source?.features}
          focusFeature={focusFeature}
          onPolicy={(feature) => { setFocusFeature(feature); setActiveTab(2); }}
          snapshot={source}
          policyAnalysis={result.policyAnalysis}
          policyBusy={policyBusy}
          policyError={policyError}
          onAnalyzePolicy={onAnalyzePolicy}
        /> : <p className="text-sm text-slate-600">Hãy chọn một kết quả đánh giá để xem các tín hiệu.</p>)}
      </div>
    </section>
  );
});

function Hero({
  result,
  percent,
  risk,
  gradientId,
}: {
  result: AiPrediction;
  percent: number;
  risk: ReturnType<typeof riskConfig>;
  gradientId: string;
}) {
  return (
    <article className={`rounded-xl border p-5 shadow-sm ${risk.hero}`}>
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
        <div className="relative mx-auto h-32 w-52 shrink-0">
          <svg
            viewBox="0 0 160 96"
            className="h-full w-full"
            role="img"
            aria-label={`Nguy cơ rời bỏ ${formatPercent(result.model.score)}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={risk.gradientFrom} />
                <stop offset="100%" stopColor={risk.gradientTo} />
              </linearGradient>
            </defs>
            <path d="M20 82 A60 60 0 0 1 140 82" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" pathLength="100" />
            <path
              d="M20 82 A60 60 0 0 1 140 82"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${percent} 100`}
              stroke={`url(#${gradientId})`}
              className={risk.glow}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center"><span className="block tabular-nums text-3xl font-bold tracking-tight text-slate-900">{formatPercent(result.model.score)}</span><span className="mt-0.5 block text-xs font-medium text-slate-500">Nguy cơ rời bỏ</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="metadata-label">Phân loại hiện tại</p><h3 className="mt-1 font-semibold text-slate-900">Tín hiệu nguy cơ rời bỏ</h3></div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${risk.surface} ${risk.text}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {risk.label}
            </span>
          </div>
          <div className="mt-5">
            <div className="relative flex h-3 overflow-visible rounded-full bg-slate-100 shadow-inner">
              <span className="h-full w-1/4 rounded-l-full bg-gradient-to-r from-emerald-500 to-teal-400" />
              <span className="h-full w-[35%] bg-gradient-to-r from-amber-300 to-orange-400" />
              <span className="h-full flex-1 rounded-r-full bg-gradient-to-r from-rose-400 to-rose-600" />
              <span
                className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950 shadow-[0_0_0_3px_rgba(255,255,255,0.9),0_0_10px_rgba(15,23,42,0.35)]"
                style={{ left: `${percent}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-[25fr_35fr_40fr] text-[11px] font-semibold text-slate-600">
              <span>0–25% · Thấp</span><span className="text-center">25–60% · Trung bình</span><span className="text-right">60–100% · Cao</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusCards({
  result,
  previous,
  currentNumber,
  previousNumber,
  delta,
  busy,
  onSave,
}: {
  result: AiPrediction;
  previous?: AiPrediction;
  currentNumber?: number;
  previousNumber?: number;
  delta: number | null;
  busy: boolean;
  onSave: () => void;
}) {
  const DeltaIcon =
    delta === null || delta === 0
      ? Minus
      : delta > 0
        ? TrendingUp
        : TrendingDown;
  const deltaLabel =
    delta === null
      ? "Chưa đủ dữ liệu so sánh"
      : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(2)}%`;
  const time = result.createdAt
    ? formatAssessmentTime(result.createdAt)
    : `Vừa xong · ${new Date().toLocaleDateString("vi-VN")}`;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <article
        className={`rounded-xl border p-4 shadow-sm ${delta === 0 ? "border-sky-200 bg-gradient-to-br from-white to-sky-50/80" : "border-slate-200 bg-white"}`}
      >
        <div className="flex items-center justify-between">
          <p className="metadata-label">Biến động so với phiên trước</p>
          <span
            className={`grid h-8 w-8 place-items-center rounded-lg ${delta === 0 ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}
          >
            <DeltaIcon className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p
            className={`tabular text-xl font-semibold ${previous ? "text-slate-900" : "text-slate-500"}`}
          >
            {deltaLabel}
          </p>
          {delta === 0 && previous && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
              <Minus className="h-3.5 w-3.5" aria-hidden />
              Ổn định · Không đổi
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          {previous
            ? delta === 0
              ? `Giữ nguyên so với phiên #${previousNumber} (${formatPercent(previous.model.score)})`
              : `So với phiên #${previousNumber} (${formatPercent(previous.model.score)})`
            : currentNumber === 1
              ? "Đây là lần đánh giá đầu tiên · Chưa có phiên trước để so sánh"
              : "Cần tối thiểu 2 lần đánh giá để tính xu hướng"}
        </p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="metadata-label">Thời điểm & Lưu hồ sơ</p>
          <Clock3 className="h-4 w-4 text-slate-500" aria-hidden />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">{time}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {result.saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Đã lưu hồ sơ{currentNumber ? ` · Phiên #${currentNumber}` : ""}
            </span>
          ) : (
            <>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                Bản nháp
              </span>
              <Button size="sm" disabled={busy} onClick={onSave} className="bg-slate-900 text-white hover:bg-slate-800">
                {busy ? <Loader2 className="animate-spin" /> : <Save />}Lưu
                phiên này
              </Button>
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function HistoryToolbar({
  history,
  result,
  busy,
  loading,
  error,
  onOpenSaved,
}: {
  history: AiPrediction[];
  result: AiPrediction;
  busy: boolean;
  loading: boolean;
  error: string;
  onOpenSaved: (id: number) => void;
}) {
  const [compareOpen, setCompareOpen] = useState(false);
  const selectedId = result.predictionId ?? "";
  const selectedIndex = history.findIndex(
    (item) => Number(item.predictionId) === Number(selectedId),
  );
  const selected = selectedIndex >= 0 ? history[selectedIndex] : undefined;
  const selectedPrevious =
    selectedIndex >= 0 ? history[selectedIndex + 1] : undefined;
  const selectedNumber =
    selectedIndex >= 0 ? history.length - selectedIndex : undefined;
  const previousNumber = selectedPrevious
    ? history.length - selectedIndex - 1
    : undefined;
  return (
    <section
      aria-label="Lịch sử đánh giá"
      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 shadow-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-700">
            <span className="shrink-0">Phiên đánh giá:</span>
            <select
              className="field h-10 min-w-[280px] flex-1"
              disabled={busy || loading || history.length === 0}
              value={selectedId}
              onChange={(event) => {
                const id = event.target.value ? Number(event.target.value) : "";
                if (id) onOpenSaved(id);
              }}
            >
              <option value="">
                {loading
                  ? "Đang tải lịch sử…"
                  : "Chưa có lịch sử phiên đánh giá"}
              </option>
              {history.map((item, index) => (
                <option key={item.predictionId} value={item.predictionId}>
                  Phiên #{history.length - index} ·{" "}
                  {formatHistoryOption(item.createdAt)} ·{" "}
                  {formatPercent(item.model.score)}
                  {index === 0 ? " (Mới nhất)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={busy || history.length === 0 || !selected?.predictionId}
            onClick={() =>
              selected?.predictionId && onOpenSaved(selected.predictionId)
            }
          >
            <RotateCcw />
            Tải lại dữ liệu phiên này
          </Button>
          <Button
            variant="outline"
            disabled={busy || history.length === 0 || !selectedPrevious}
            onClick={() => setCompareOpen(true)}
          >
            <ArrowRightLeft />
            So sánh với phiên trước
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent wide className="max-h-[90vh] overflow-y-auto">
          {selected && selectedPrevious ? (
            <ComparisonPanel
              older={selectedPrevious}
              current={selected}
              olderNumber={previousNumber}
              currentNumber={selectedNumber}
              onClose={() => setCompareOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

const compareGroups = [
  {
    title: "Thông tin cơ bản",
    fields: ["Department", "Gender", "Age", "Education_Level"],
  },
  {
    title: "Quá trình làm việc",
    fields: ["Hire_Date", "Years_At_Company", "Monthly_Salary", "Promotions"],
  },
  {
    title: "Công việc và trải nghiệm",
    fields: [
      "Work_Hours_Per_Week",
      "Overtime_Hours",
      "Sick_Days",
      "Employee_Satisfaction_Score",
    ],
  },
] as const;

const numericCompareKeys = new Set([
  "Age",
  "Years_At_Company",
  "Monthly_Salary",
  "Promotions",
  "Work_Hours_Per_Week",
  "Overtime_Hours",
  "Sick_Days",
  "Employee_Satisfaction_Score",
]);

const compareUnits: Record<string, string> = {
  Age: " năm",
  Years_At_Company: " năm",
  Monthly_Salary: " USD/tháng",
  Promotions: " lần",
  Work_Hours_Per_Week: " giờ/tuần",
  Overtime_Hours: " giờ",
  Sick_Days: " ngày",
  Employee_Satisfaction_Score: " / 5.0",
};

function ComparisonPanel({
  older,
  current,
  olderNumber,
  currentNumber,
  onClose,
}: {
  older: AiPrediction;
  current: AiPrediction;
  olderNumber?: number;
  currentNumber?: number;
  onClose: () => void;
}) {
  const riskDelta = toPoints(current.model.score - older.model.score);
  const rows = compareGroups.flatMap((group) =>
    group.fields.map((key) => {
      const before = older.preview.features[key];
      const after = current.preview.features[key];
      const numeric = numericCompareKeys.has(key);
      const beforeNumber = numeric ? Number(before) : NaN;
      const afterNumber = numeric ? Number(after) : NaN;
      const hasNumericValues =
        numeric && Number.isFinite(beforeNumber) && Number.isFinite(afterNumber);
      const delta = hasNumericValues ? afterNumber - beforeNumber : null;
      const changed = hasNumericValues
        ? Math.abs(delta ?? 0) > 1e-9
        : String(before ?? "") !== String(after ?? "");
      return { group: group.title, key, before, after, delta, changed };
    }),
  );
  const changedRows = rows.filter((row) => row.changed);
  return (
    <>
      <DialogTitle>
        So sánh phiên #{olderNumber ?? older.predictionId} với #{currentNumber ?? current.predictionId}
      </DialogTitle>
      <DialogDescription>
        Đối chiếu đầy đủ 12 thông tin đầu vào giữa hai lần đánh giá. Các trường
        thay đổi được làm nổi bật để HR rà soát nhanh.
      </DialogDescription>
      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="metadata-label">Phiên trước</p>
          <p className="mt-1 font-semibold text-slate-900">
            Phiên #{olderNumber ?? older.predictionId} · {formatPercent(older.model.score)}
          </p>
        </div>
        <ArrowRightLeft className="hidden h-5 w-5 text-slate-400 sm:block" aria-hidden />
        <div className="sm:text-right">
          <p className="metadata-label">Phiên đang xem</p>
          <p className="mt-1 font-semibold text-slate-900">
            Phiên #{currentNumber ?? current.predictionId} · {formatPercent(current.model.score)}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {compareGroups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{group.title}</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {rows
                .filter((row) => row.group === group.title)
                .map((row) => (
                  <div
                    key={row.key}
                    className={`rounded-lg border px-3 py-3 text-sm ${row.changed ? "border-amber-200 bg-amber-50/80" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-slate-800">{featureLabel(row.key)}</strong>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.changed ? "bg-amber-100 text-amber-800" : "bg-sky-50 text-sky-700"}`}
                      >
                        {row.changed ? "Có thay đổi" : "Không đổi"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <span className="min-w-0 break-words text-slate-600">
                        {formatCompareValue(row.key, row.before)}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="min-w-0 break-words text-right font-medium text-slate-900">
                        {formatCompareValue(row.key, row.after)}
                        {row.changed && row.delta !== null && (
                          <small className="ml-1 text-amber-700">
                            ({row.delta > 0 ? "+" : ""}{formatNumber(row.delta)}{compareUnits[row.key] ?? ""})
                          </small>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
      <p
        className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${riskDelta === 0 && changedRows.length === 0 ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
      >
        <strong>
          {riskDelta === 0 ? "Kết quả giữ mức ổn định." : `Nguy cơ ${riskDelta > 0 ? "tăng" : "giảm"} ${Math.abs(riskDelta).toFixed(2)} điểm phần trăm.`}
        </strong>{" "}
        {changedRows.length === 0
          ? "Toàn bộ thông tin đầu vào không thay đổi so với phiên trước."
          : `${changedRows.length}/12 thông tin đầu vào có thay đổi; HR nên rà soát các ô được đánh dấu trước khi kết luận.`}
      </p>
      <div className="mt-5 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </>
  );
}

function formatCompareValue(key: string, value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "Chưa có";
  if (key === "Hire_Date") {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
  }
  if (key === "Gender")
    return ({ Male: "Nam", Female: "Nữ", Other: "Khác" } as Record<string, string>)[String(value)] ?? String(value);
  if (key === "Education_Level")
    return ({ "High School": "Trung học", Bachelor: "Đại học", Master: "Thạc sĩ", PhD: "Tiến sĩ" } as Record<string, string>)[String(value)] ?? String(value);
  if (numericCompareKeys.has(key) && Number.isFinite(Number(value)))
    return `${formatNumber(Number(value))}${compareUnits[key] ?? ""}`;
  return String(value);
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function dateTimeParts(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function formatAssessmentTime(value?: string) {
  const p = dateTimeParts(value);
  return p
    ? `${p.day}/${p.month}/${p.year} · ${p.hour}:${p.minute}`
    : "Chưa có phiên đánh giá";
}
function formatHistoryOption(value?: string) {
  const p = dateTimeParts(value);
  return p ? `${p.day}/${p.month} ${p.hour}:${p.minute}` : "Chưa có thời gian";
}
function EmptyResult({ employee, ready, busy, onPredict }: { employee?: AiEmployee | null; ready: boolean; busy: boolean; onPredict: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
        <BarChart3 className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-4 font-semibold text-slate-900">
        Chưa có kết quả đánh giá
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        {employee
          ? ready
            ? `Dữ liệu hồ sơ của ${employee.fullName} đã được nạp đầy đủ. Bấm nút “Đánh giá mức độ gắn kết” ở cột bên trái để chạy phân tích.`
            : `Hồ sơ của ${employee.fullName} cần được bổ sung trước khi đánh giá.`
          : "Vui lòng chọn nhân viên ở thanh tìm kiếm để nạp hồ sơ và bắt đầu đánh giá."}
      </p>
      {employee && <Button className="mt-5 bg-orange-500 text-white hover:bg-orange-600" disabled={!ready || busy} onClick={onPredict}>{busy ? <Loader2 className="animate-spin" /> : <BarChart3 />}Chạy phân tích ngay</Button>}
    </div>
  );
}
function ErrorResult({
  error,
  busy,
  onRetry,
}: {
  error?: string;
  busy: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-80 flex-col items-center justify-center text-center"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-700">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-4 font-semibold text-slate-900">
        Không thể hoàn thành đánh giá
      </h3>
      <p className="mt-2 max-w-72 text-sm leading-6 text-slate-600">
        {error || "Vui lòng thử lại sau."}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          className="mt-5"
          disabled={busy}
          onClick={onRetry}
        >
          <RefreshCw />
          Thử lại
        </Button>
      )}
    </div>
  );
}
function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">
        Nội dung sẽ được bổ sung sau.
      </p>
    </div>
  );
}
