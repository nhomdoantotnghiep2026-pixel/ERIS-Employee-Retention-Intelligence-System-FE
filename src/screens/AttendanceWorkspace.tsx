import { SelectControl } from "../components/ui/select-control"
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, CalendarCheck2, CalendarRange, Clock3, Download, FileSpreadsheet, Inbox, RotateCcw, Search, Upload, X, } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Card, SectionHeader } from "../components/ui";
import { downloadAttendanceTemplate } from "../utils/attendanceTemplate";
import AttendanceImport, { type AttendanceImportStage, } from "../components/AttendanceImport";
import AttendanceDetail, { attendanceInitials, attendanceState, displayTime, durationLabel, recordedSchedule } from "../components/AttendanceDetail";
import AttendanceReconcile from "../components/AttendanceReconcile";
import { useLanguage } from "../context/LanguageContext";
import { useAutoDismissFeedback } from "../hooks/useAutoDismissState";
import { getPositionById, listDepartments, listEmployeeProfiles, listWorkSchedules, type EmployeeProfile, } from "../services/api";
import { fetchAttendance, fetchAttendanceDetail, fetchCancelledAttendance, fetchCancelledAttendanceDetail, fetchAttendanceAudit, cancelAttendance, attendanceMessage, type ImportedAttendance, type AttendanceAudit, type RecordFilters, } from "../services/attendance";
const control = "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100";
const workDayFormat = {
    vi: new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }),
    en: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }),
};
const isoDate = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(value => String(value).padStart(2, "0")).join("-");
const getWeekRange = (anchor = new Date()) => {
    const date = new Date(anchor);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    const from = new Date(date);
    const to = new Date(date);
    to.setDate(to.getDate() + 6);
    return { from: isoDate(from), to: isoDate(to) };
};
const defaultPeriod = getWeekRange();
const previousPeriod = (() => {
    const anchor = new Date(`${defaultPeriod.from}T00:00:00`);
    anchor.setDate(anchor.getDate() - 7);
    return getWeekRange(anchor);
})();
const formatShortDate = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
};
type PeriodPreset = "CURRENT_WEEK" | "PREVIOUS_WEEK" | "CURRENT_MONTH" | "CUSTOM";
const eventFilters = ["ALL", "LATE", "EARLY", "OVERTIME", "ON_TIME", "INCOMPLETE"] as const;
type EventFilter = typeof eventFilters[number];
function matchesEvent(row: ImportedAttendance, filter: EventFilter) {
    if (filter === "ALL") return true;
    if (row.record_status !== "ACTIVE") return false;
    if (filter === "LATE") return row.late_mins > 0;
    if (filter === "EARLY") return row.early_mins > 0;
    if (filter === "OVERTIME") return row.overtime_minutes > 0;
    if (filter === "INCOMPLETE") return (!row.check_in || !row.check_out) && !["ABSENT", "HOLIDAY", "ON_LEAVE"].includes(row.attendance_status ?? "");
    return Boolean(row.check_in && row.check_out && !row.late_mins && !row.early_mins);
}
async function loadAttendanceRange(filters: RecordFilters, own: boolean, signal: AbortSignal, firstLimit = 200) {
    const read = async (cancelled: boolean) => {
        const records: ImportedAttendance[] = [];
        let limit = firstLimit;
        for (let offset = 0; ; offset = records.length) {
            const query = { ...filters, limit, offset };
            const response = cancelled ? await fetchCancelledAttendance(query, signal) : await fetchAttendance(query, own, signal);
            records.push(...response.data);
            if (response.data.length < (response.limit || limit)) return records;
            limit = 200;
        }
    };
    if (!own && filters.record_status === "CANCEL") return read(true);
    if (own || filters.record_status !== "ALL") return read(false);
    const [active, cancelled] = await Promise.all([read(false), read(true)]);
    return [...active, ...cancelled].sort((a, b) => b.work_date.localeCompare(a.work_date) ||
        String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
}
export default function AttendanceWorkspace({ own = false, }: {
    own?: boolean;
}) {
    const { language } = useLanguage();
    const navigate = useNavigate();
    const tr = (vi: string, en: string) => (language === "vi" ? vi : en);
    const [filters, setFilters] = useState<RecordFilters>({
        ...defaultPeriod,
        record_status: "ACTIVE",
    }), [draft, setDraft] = useState<RecordFilters>({
        ...defaultPeriod,
        record_status: "ACTIVE",
    });
    const [rows, setRows] = useState<ImportedAttendance[]>([]);
    const [hasAnyRecords, setHasAnyRecords] = useState<boolean | null>(null);
    const [selected, setSelected] = useState<ImportedAttendance | null>(null), [logs, setLogs] = useState<AttendanceAudit[]>([]), [logOffset, setLogOffset] = useState(0);
    const [offset, setOffset] = useState(0), [pageSize, setPageSize] = useState(25), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
    const { error, message: notice, setError, setMessage: setNotice, } = useAutoDismissFeedback();
    const [logError, setLogError] = useState("");
    const [logsLoading, setLogsLoading] = useState(false);
    const [schedule, setSchedule] = useState<ReturnType<typeof recordedSchedule>>(null);
    const [detailError, setDetailError] = useState("");
    const [position, setPosition] = useState("");
    const [reason, setReason] = useState("");
    const [importOpen, setImportOpen] = useState(false);
    const recordsHeading = useRef<HTMLHeadingElement>(null);
    const [importBusy, setImportBusy] = useState(false);
    const [importStage, setImportStage] = useState<AttendanceImportStage | "complete">("idle");
    const [reconcileOpen, setReconcileOpen] = useState(false);
    const [reconcileBusy, setReconcileBusy] = useState(false);
    const [activeShiftTypes, setActiveShiftTypes] = useState<string[]>([]);
    const [scheduleCheck, setScheduleCheck] = useState<"loading" | "ready" | "missing" | "error">("loading");
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [departments, setDepartments] = useState<Array<{
        id: number;
        name: string;
    }>>([]);
    const [departmentId, setDepartmentId] = useState("");
    const [tableSearch, setTableSearch] = useState("");
    const deferredSearch = useDeferredValue(tableSearch);
    const [eventFilter, setEventFilter] = useState<EventFilter>("ALL");
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("CURRENT_WEEK");
    const [previousPeriodRows, setPreviousPeriodRows] = useState<ImportedAttendance[]>([]);
    useEffect(() => {
        const c = new AbortController();
        setLoading(true);
        setError("");
        setRows([]);
        void loadAttendanceRange(filters, own, c.signal, pageSize)
            .then((response) => {
            if (!c.signal.aborted)
                setRows(response);
        })
            .catch((e) => {
            if (!c.signal.aborted)
                setError(attendanceMessage(e, tr("Không tải được chấm công.", "Could not load attendance.")));
        })
            .finally(() => {
            if (!c.signal.aborted)
                setLoading(false);
        });
        return () => c.abort();
    }, [filters, revision, own, pageSize]);
    useEffect(() => {
        const c = new AbortController();
        const probe = { limit: 1, offset: 0 };
        void Promise.allSettled([
            fetchAttendance(probe, own, c.signal),
            ...(own ? [] : [fetchCancelledAttendance(probe, c.signal)]),
        ]).then((results) => {
            if (!c.signal.aborted) setHasAnyRecords(results.some((result) => result.status === "fulfilled" && result.value.data.length > 0));
        });
        return () => c.abort();
    }, [revision, own]);
    useEffect(() => {
        if (own)
            return;
        let live = true;
        setScheduleCheck("loading");
        void listWorkSchedules()
            .then((response) => {
            if (!live)
                return;
            const shiftTypes = Array.from(new Set(response.data
                .filter((schedule) => schedule.status === "ACTIVE" && schedule.shift_type?.trim())
                .map((schedule) => schedule.shift_type!.trim())));
            setActiveShiftTypes(shiftTypes);
            setScheduleCheck(shiftTypes.length ? "ready" : "missing");
        })
            .catch(() => {
            if (live)
                setScheduleCheck("error");
        });
        return () => {
            live = false;
        };
    }, [own, revision]);
    useEffect(() => {
        if (own)
            return;
        const controller = new AbortController();
        const from = filters.from || defaultPeriod.from;
        const to = filters.to || defaultPeriod.to;
        const start = new Date(`${from}T00:00:00`);
        const end = new Date(`${to}T00:00:00`);
        const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        const previousEnd = new Date(start);
        previousEnd.setDate(previousEnd.getDate() - 1);
        const previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - span + 1);
        void Promise.allSettled([
            listEmployeeProfiles({ page: 1, limit: 1000, employmentStatus: "ACTIVE" }, controller.signal),
            listDepartments(controller.signal, { limit: 1000 }),
            loadAttendanceRange({
                from: isoDate(previousStart),
                to: isoDate(previousEnd),
                record_status: "ACTIVE",
            }, false, controller.signal),
        ]).then((results) => {
            if (controller.signal.aborted)
                return;
            const [employeeResult, departmentResult, previousResult] = results;
            if (employeeResult.status === "fulfilled")
                setEmployees(employeeResult.value.data);
            if (departmentResult.status === "fulfilled")
                setDepartments(departmentResult.value.data);
            if (previousResult.status === "fulfilled")
                setPreviousPeriodRows(previousResult.value);
        });
        return () => controller.abort();
    }, [own, filters.from, filters.to, revision]);
    useEffect(() => {
        if (!selected || own || selected.record_status === "CANCEL") return;
        let live = true;
        setLogs([]);
        setLogError("");
        setLogsLoading(true);
        void fetchAttendanceAudit(selected.id, logOffset)
            .then((result) => {
                if (!live) return;
                setLogs(result.data);
                const originalSchedule = recordedSchedule(result.data);
                if (originalSchedule) setSchedule(originalSchedule);
            })
            .catch((e) => {
                if (live) setLogError(attendanceMessage(e, tr("Không tải được lịch sử thao tác.", "Could not load activity history.")));
            })
            .finally(() => { if (live) setLogsLoading(false); });
        return () => { live = false; };
    }, [selected, logOffset, own]);

    useEffect(() => {
        if (!importOpen && !reconcileOpen)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented || busy || importBusy || reconcileBusy)
                return;
            setImportOpen(false);
            setReconcileOpen(false);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [
        importOpen,
        reconcileOpen,
        busy,
        importBusy,
        reconcileBusy,
    ]);
    async function open(row: ImportedAttendance) {
        if (busy)
            return;
        setBusy(true);
        setError("");
        try {
            const r = await (row.record_status === "CANCEL" ? fetchCancelledAttendanceDetail(row.id) : fetchAttendanceDetail(row.id));
            setDetailError("");
            setSchedule(null);
            setLogs([]);
            setLogError("");
            setLogsLoading(!own && r.data.record_status !== "CANCEL");
            setSelected(r.data);
            setLogOffset(0);
            setReason("");
        }
        catch (e) {
            setError(attendanceMessage(e, tr("Không tải được bản ghi.", "Could not load record.")));
        }
        finally {
            setBusy(false);
        }
    }
    async function save(e: FormEvent) {
        e.preventDefault();
        if (own || selected?.record_status !== "ACTIVE" || busy || !reason.trim())
            return;
        setBusy(true);
        setDetailError("");
        setNotice("");
        try {
            await cancelAttendance(selected, reason);
            setSelected(null);
            setNotice(tr("Đã hủy bản ghi. Hãy nhập lại tệp nếu cần bản ghi thay thế.", "Record cancelled. Import a replacement if needed."));
            setRevision((v) => v + 1);
        }
        catch (e) {
            setDetailError(attendanceMessage(e, tr("Không hủy được bản ghi. Vui lòng thử lại.", "Could not cancel the record. Please try again.")));
        }
        finally {
            setBusy(false);
        }
    }
    const invalid = !!(draft.from && draft.to && draft.from > draft.to);
    const employeeByCode = useMemo(() => new Map(employees.map(employee => [employee.employeeCode, employee])), [employees]);
    const directoryRows = useMemo(() => {
        const normalize = (value: string) => value.toLocaleLowerCase(language === "vi" ? "vi-VN" : "en-US");
        const query = normalize(deferredSearch.trim());
        return rows.filter(row =>
            (!departmentId || String(employeeByCode.get(row.employee_code)?.departmentId ?? "") === departmentId)
            && (!query || normalize(`${row.employee_code} ${row.full_name}`).includes(query)),
        );
    }, [rows, deferredSearch, departmentId, employeeByCode, language]);
    const filteredRows = useMemo(() => directoryRows.filter(row => matchesEvent(row, eventFilter)), [directoryRows, eventFilter]);
    const eventCounts = useMemo(() => eventFilters.map(event => directoryRows.filter(row => matchesEvent(row, event)).length), [directoryRows]);
    const filteredRowCount = filteredRows.length;
    const pageCount = Math.max(1, Math.ceil(filteredRowCount / pageSize));
    const currentPage = Math.min(Math.floor(offset / pageSize) + 1, pageCount);
    const pageOffset = (currentPage - 1) * pageSize;
    const visibleRows = useMemo(() => filteredRows.slice(pageOffset, pageOffset + pageSize), [filteredRows, pageOffset, pageSize]);
    const hasNextPage = currentPage < pageCount;
    const filteredPeriodRows = useMemo(() => rows.filter(row =>
        row.record_status === "ACTIVE" && (!departmentId || String(employeeByCode.get(row.employee_code)?.departmentId ?? "") === departmentId)
    ), [rows, departmentId, employeeByCode]);
    const punctuality = useMemo(() => {
        const completed = filteredPeriodRows.filter(row => row.check_in && row.check_out);
        return completed.length ? completed.filter(row => matchesEvent(row, "ON_TIME")).length / completed.length * 100 : null;
    }, [filteredPeriodRows]);
    const officeMetrics = useMemo(() => filteredPeriodRows.reduce((metrics, row) => ({
        worked: metrics.worked + (Number(row.working_minutes) || 0),
        overtime: metrics.overtime + (Number(row.overtime_minutes) || 0),
        review: metrics.review + Number(Boolean(row.late_mins || row.early_mins || matchesEvent(row, "INCOMPLETE"))),
    }), { worked: 0, overtime: 0, review: 0 }), [filteredPeriodRows]);
    const filteredPreviousRows = departmentId
        ? previousPeriodRows.filter((row) => String(employeeByCode.get(row.employee_code)?.departmentId || "") ===
            departmentId)
        : previousPeriodRows;
    const previousOnTimeRate = filteredPreviousRows.length
        ? (filteredPreviousRows.filter((row) => !row.late_mins && !row.early_mins)
            .length /
            filteredPreviousRows.length) *
            100
        : null;
    const pageStart = visibleRows.length ? pageOffset + 1 : 0;
    const pageEnd = pageOffset + visibleRows.length;
    const selectedEmployee = selected ? employeeByCode.get(selected.employee_code) : undefined;
    const selectedDepartment = departments.find((department) => department.id === selectedEmployee?.departmentId)?.name;
    const positionId = selectedEmployee?.positionId;
    useEffect(() => {
        setPosition("");
        if (!positionId) return;
        const controller = new AbortController();
        void getPositionById(positionId, controller.signal).then((result) => {
            if (!controller.signal.aborted) setPosition(result.name);
        }).catch(() => undefined);
        return () => controller.abort();
    }, [positionId]);

    const periodLabel = filters.from && filters.to
        ? `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}`
        : "—";
    const startImport = () => {
        setImportStage("idle");
        setImportOpen(true);
    };
    return (<AppShell breadcrumb={[
            tr("Nhân sự", "Workforce"),
            tr(own ? "Chấm công của tôi" : "Quản lý chấm công", own ? "My attendance" : "Attendance data"),
        ]}>
      <SectionHeader title={tr(own ? "Chấm công của tôi" : "Dữ liệu chấm công", own ? "My attendance" : "Attendance data")} description={tr(own
            ? "Xem dữ liệu chấm công do HR đã thu thập từ tệp nguồn."
            : "HR nhập tệp chấm công từ nguồn bên ngoài; hệ thống kiểm tra và lưu dữ liệu, không tự động chấm công.", own
            ? "View attendance data collected by HR from source files."
            : "HR imports attendance files from an external source; the system validates and stores data but does not record attendance automatically.")}>
        {!own ? (<div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate("/attendance/dashboard")}>
              <BarChart3 size={16}/>
              {tr("Xem tổng quan", "View dashboard")}
            </Button>
            <span className="inline-flex" title={scheduleCheck === "missing"
                ? tr("Cần có lịch làm việc đang hoạt động trước khi đối soát.", "An active work schedule is required before reconciliation.")
                : undefined}>
              <Button type="button" variant="secondary" disabled={scheduleCheck === "loading" || scheduleCheck === "missing"} onClick={() => setReconcileOpen(true)}>
                <CalendarRange size={16}/>
                {tr("Đối soát & điều chỉnh nghỉ", "Reconcile & leave adjust")}
              </Button>
            </span>
            <Button type="button" variant="secondary" onClick={downloadAttendanceTemplate} className="hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
              <Download size={16} aria-hidden="true"/>
              {tr("Tải tệp mẫu", "Download template")}
            </Button>
            <span className="inline-flex" title={scheduleCheck === "missing"
                ? tr("Cần tạo ít nhất một ca đang hoạt động trước khi nhập.", "Create at least one active schedule before importing.")
                : undefined}>
              <Button type="button" disabled={scheduleCheck === "loading" || scheduleCheck === "missing"} onClick={startImport}>
                <Upload size={16}/>
                {tr("Nhập chấm công", "Import attendance")}
              </Button>
            </span>
          </div>) : (<Button variant="secondary" disabled={loading || busy} onClick={() => setRevision((v) => v + 1)}>
            {tr("Tải lại", "Refresh")}
          </Button>)}
      </SectionHeader>
      {!own && (<section aria-label={tr("Chỉ số chấm công", "Attendance metrics")} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
            { label: tr("Tỷ lệ đúng giờ", "Punctuality rate"), value: punctuality === null ? "—" : `${punctuality.toFixed(1)}%`, detail: previousOnTimeRate === null ? tr("Chưa có đối chiếu kỳ trước", "No previous period comparison") : tr(`Kỳ trước: ${previousOnTimeRate.toFixed(1)}%`, `Previous period: ${previousOnTimeRate.toFixed(1)}%`), tone: "from-orange-50 to-white", Icon: Clock3 },
            { label: tr("Tổng giờ làm việc", "Total working hours"), value: tr(`${(officeMetrics.worked / 60).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ`, `${(officeMetrics.worked / 60).toLocaleString("en-US", { maximumFractionDigits: 1 })} h`), detail: tr("Giờ làm & tăng ca được ghi riêng", "Working hours and overtime are tracked separately"), tone: "from-emerald-50 to-white", Icon: CalendarCheck2 },
            { label: tr("Quỹ giờ tăng ca", "Overtime"), value: `${(officeMetrics.overtime / 60).toFixed(1)}h OT`, detail: tr("Theo giờ tăng ca đã ghi nhận", "Based on recorded overtime"), tone: "from-violet-50 to-white", Icon: BarChart3 },
            { label: tr("Trường hợp cần rà soát", "Records to review"), value: officeMetrics.review, detail: tr("Đi trễ, về sớm hoặc thiếu lượt quẹt", "Late, early or missing punch"), tone: "from-amber-50 to-white", Icon: AlertTriangle },
        ].map(({ label, value, detail, tone, Icon }) => <Card key={label} className={`bg-gradient-to-br ${tone} p-4 shadow-sm sm:p-5`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{loading ? "—" : value}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></div><Icon className="size-5 shrink-0 text-slate-500" aria-hidden="true" /></div>
        </Card>)}
      </section>)}
      {error && (<p role="alert" className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
          {error}
        </p>)}
      {notice && (<p role="status" className="mb-4 rounded-md bg-emerald-50 p-4 text-emerald-800">
          {notice}
        </p>)}
      {!own && scheduleCheck === "missing" && (<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true"/>
            <p className="leading-5">
              <span className="font-semibold">
                {tr("Thiếu lịch làm việc hoạt động.", "No active work schedule.")}
              </span>{" "}
              {tr("Tạo và gán ca trước khi nhập hoặc đối soát chấm công.", "Create and assign a schedule before importing or reconciling attendance.")}
            </p>
          </div>
          <Link to="/work-schedules" className="inline-flex min-h-10 items-center rounded-md border border-amber-300 bg-white px-3 font-semibold text-amber-900 transition-colors duration-200 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
            {tr("Tạo ca làm việc", "Create schedule")}
          </Link>
        </div>)}
      {!own && scheduleCheck === "error" && (<p className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          {tr("Không kiểm tra được danh mục ca. Bạn vẫn có thể nhập tệp; hệ thống sẽ kiểm tra lại khi xem trước.", "The schedule catalogue could not be checked. You can still upload; preview will validate it.")}
        </p>)}
      {importOpen && (<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label={tr("Nhập dữ liệu chấm công", "Import attendance data")} onMouseDown={(event) => {
                if (event.target === event.currentTarget && !importBusy) {
                    setImportOpen(false);
                    setImportStage("idle");
                }
            }}>
          <Card className={`relative max-h-[calc(100vh-2rem)] w-full shadow-2xl ${["preview", "saving"].includes(importStage)
                ? "max-w-[96vw] overflow-hidden p-0"
                : "max-w-4xl overflow-y-auto p-5 sm:p-6"}`}>
            {!["preview", "saving"].includes(importStage) && (<button type="button" aria-label={tr("Đóng", "Close")} disabled={importBusy} className="absolute right-5 top-5 z-10 flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={() => {
                    setImportOpen(false);
                    setImportStage("idle");
                }}>
                <X size={20}/>
              </button>)}
            <AttendanceImport activeShiftTypes={activeShiftTypes} onBusyChange={setImportBusy} onStageChange={setImportStage} onCancel={() => {
                setImportOpen(false);
                setImportStage("idle");
            }} onImported={(result, dates) => {
                setImportOpen(false);
                setImportStage("complete");
                if (dates) {
                    const importedScope: RecordFilters = { ...dates, record_status: "ACTIVE" };
                    setPeriodPreset("CUSTOM");
                    setDraft(importedScope);
                    setFilters(importedScope);
                    setDepartmentId("");
                    setTableSearch("");
                    setEventFilter("ALL");
                }
                setOffset(0);
                setRevision((v) => v + 1);
                requestAnimationFrame(() => recordsHeading.current?.scrollIntoView({ block: "start" }));
                setNotice(tr(`Nhập chấm công thành công: đã lưu ${result.inserted} bản ghi, bỏ qua ${result.skipped}, loại ${result.excluded}.`, `Attendance imported successfully: saved ${result.inserted}, skipped ${result.skipped}, excluded ${result.excluded}.`));
            }}/>
          </Card>
        </div>)}
      {reconcileOpen && (<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px] animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label={tr("Bù công ngày lễ và khớp đơn nghỉ phép", "Holiday adjustment and leave matching")} onMouseDown={(event) => {
                if (event.target === event.currentTarget && !reconcileBusy)
                    setReconcileOpen(false);
            }}>
          <Card className="relative max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto p-5 shadow-2xl animate-in slide-in-from-bottom-2 zoom-in-95 duration-200 sm:p-6">
            <button type="button" aria-label={tr("Đóng", "Close")} disabled={reconcileBusy} className="absolute right-5 top-5 z-10 flex size-10 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500" onClick={() => setReconcileOpen(false)}>
              <X size={20}/>
            </button>
            <AttendanceReconcile onBusyChange={setReconcileBusy} onSaved={(result) => {
                setReconcileOpen(false);
                setOffset(0);
                setRevision((v) => v + 1);
                setNotice(tr(`Đối soát thành công: đã tạo ${result.inserted} bản ghi, giữ nguyên ${result.kept}.`, `Reconciliation completed: created ${result.inserted}, kept ${result.kept}.`));
            }}/>
          </Card>
        </div>)}
      {selected && <AttendanceDetail key={String(selected.id)} row={selected}
        department={selectedDepartment} position={position} schedule={schedule} own={own}
        busy={busy} reason={reason} error={detailError} logs={logs} logsLoading={logsLoading}
        logError={logError} logOffset={logOffset} tr={tr} onReason={setReason} onLogOffset={setLogOffset}
        onClose={() => setSelected(null)} onCancelRecord={save} />}
      <Card className="p-5">
        <form className="-mx-5 -mt-5 mb-5 border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5" onSubmit={(event) => {
            event.preventDefault();
            if (invalid)
                return;
            setNotice("");
            setFilters({ ...draft, employee_id: undefined });
            setOffset(0);
            setSelected(null);
        }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-950">
                {tr("Bộ lọc dữ liệu", "Data filters")}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {tr("Lọc theo kỳ công, nhân sự và trạng thái bản ghi.", "Filter by work period, employee and record status.")}
              </p>
            </div>
            {(departmentId ||
            tableSearch ||
            periodPreset !== "CURRENT_WEEK" ||
            draft.record_status !== "ACTIVE") && (<span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                {tr("Đang áp dụng bộ lọc", "Filters applied")}
              </span>)}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
            <label className="text-sm font-semibold text-slate-700 xl:col-span-2">
              {tr("Kỳ làm việc", "Work period")}
              <SelectControl className={control} value={periodPreset} onChange={(event) => {
            const preset = event.target.value as PeriodPreset;
            setPeriodPreset(preset);
            if (preset === "CURRENT_WEEK")
                setDraft((current) => ({ ...current, ...defaultPeriod }));
            if (preset === "CURRENT_MONTH") {
                const now = new Date();
                setDraft(current => ({ ...current, from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }));
            }
            if (preset === "PREVIOUS_WEEK")
                setDraft((current) => ({ ...current, ...previousPeriod }));
        }}>
                <option value="CURRENT_WEEK">
                  {tr("Tuần hiện tại", "Current week")}
                </option>
                <option value="PREVIOUS_WEEK">
                  {tr("Tuần trước", "Previous week")}
                </option>
                <option value="CURRENT_MONTH">{tr("Tháng này", "This month")}</option>
                <option value="CUSTOM">
                  {tr("Khoảng tùy chỉnh", "Custom range")}
                </option>
              </SelectControl>
            </label>
            {periodPreset === "CUSTOM" && (<>
                <label className="text-sm font-semibold text-slate-700 xl:col-span-2">
                  {tr("Từ ngày", "From date")}
                  <input className={control} type="date" value={draft.from || ""} onChange={(event) => setDraft((current) => ({
                ...current,
                from: event.target.value,
            }))}/>
                </label>
                <label className="text-sm font-semibold text-slate-700 xl:col-span-2">
                  {tr("Đến ngày", "To date")}
                  <input className={control} type="date" value={draft.to || ""} onChange={(event) => setDraft((current) => ({
                ...current,
                to: event.target.value,
            }))}/>
                </label>
              </>)}
            {!own && (<label className="text-sm font-semibold text-slate-700 xl:col-span-2">
                {tr("Phòng ban", "Department")}
                <SelectControl className={control} value={departmentId} onChange={(event) => {
                setDepartmentId(event.target.value);
                setOffset(0);
            }}>
                  <option value="">
                    {tr("Tất cả phòng ban", "All departments")}
                  </option>
                  {departments.map((department) => (<option key={department.id} value={department.id}>
                      {department.name}
                    </option>))}
                </SelectControl>
              </label>)}
            <label className="text-sm font-semibold text-slate-700 xl:col-span-2">
              {tr("Trạng thái", "Status")}
              <SelectControl className={control} value={draft.record_status} onChange={(event) => setDraft((current) => ({
            ...current,
            record_status: event.target
                .value as RecordFilters["record_status"],
        }))}>
                <option value="ACTIVE">{tr("Đang sử dụng", "Active")}</option>
                <option value="CANCEL">{tr("Đã hủy", "Cancelled")}</option>
                <option value="ALL">{tr("Tất cả", "All")}</option>
              </SelectControl>
            </label>
            <label className={`text-sm font-semibold text-slate-700 ${periodPreset === "CUSTOM" ? "xl:col-span-4" : "xl:col-span-3"}`}>
              {tr("Tìm nhân viên", "Search employee")}
              <span className="relative mt-1 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true"/>
                <input value={tableSearch} onChange={(event) => {
            setTableSearch(event.target.value);
            setOffset(0);
        }} placeholder={tr("Tên hoặc mã nhân viên (EMP...)", "Name or employee code (EMP...)")} className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"/>
              </span>
            </label>
            <div className={`${periodPreset === "CUSTOM" ? "xl:col-span-2" : "xl:col-span-3"} flex flex-wrap gap-2`}>
              <Button type="submit" disabled={loading || invalid} className="flex-1">
                <Search size={16} aria-hidden="true"/>
                {tr("Lọc", "Filter")}
              </Button>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => {
            const initial: RecordFilters = {
                ...defaultPeriod,
                record_status: "ACTIVE",
            };
            setNotice("");
            setPeriodPreset("CURRENT_WEEK");
            setDraft(initial);
            setFilters(initial);
            setDepartmentId("");
            setTableSearch("");
            setEventFilter("ALL");
            setOffset(0);
            setSelected(null);
        }}>
                <RotateCcw size={16} aria-hidden="true"/>
                {tr("Đặt lại", "Reset")}
              </Button>
            </div>
          </div>
          {invalid && (<p role="alert" className="mt-3 text-sm font-semibold text-red-700">
              {tr("Ngày kết thúc phải từ ngày bắt đầu trở đi.", "End date must be on or after start date.")}
            </p>)}
        </form>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 ref={recordsHeading} className="scroll-mt-24 text-base font-semibold text-slate-950">
              {tr("Dữ liệu chấm công", "Attendance records")}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {tr("Danh sách bản ghi theo điều kiện lọc hiện tại.", "Records matching the current filters.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {filteredRowCount === null
            ? visibleRows.length
            : `${visibleRows.length}/${filteredRowCount}`}{" "}
              {tr("bản ghi trên trang", "records on this page")}
            </span>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {eventFilters.map((event, i) => <button key={event} type="button" aria-pressed={eventFilter === event} onClick={() => { setEventFilter(event); setOffset(0); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${eventFilter === event ? "border-slate-900 bg-slate-900 text-white" : ["border-slate-200 bg-slate-50 text-slate-700", "border-amber-200 bg-amber-50 text-amber-900", "border-orange-200 bg-orange-50 text-orange-900", "border-violet-200 bg-violet-50 text-violet-900", "border-emerald-200 bg-emerald-50 text-emerald-900", "border-rose-200 bg-rose-50 text-rose-900"][i]}`}>
            {[tr("Tất cả", "All"), tr("Đi trễ", "Late"), tr("Về sớm", "Early"), tr("Tăng ca", "Overtime"), tr("Đúng giờ", "On time"), tr("Thiếu quẹt thẻ", "Missing punch")][i]} ({eventCounts[i]})
          </button>)}
        </div>
        {loading ? (<p role="status">{tr("Đang tải…", "Loading…")}</p>) : (<>
            <div className={hasAnyRecords || rows.length ? "max-h-[65vh] overflow-auto" : "hidden"}>
              <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
                <colgroup>
                  {[140, 240, 140, 100, 120, 90, 160, 110].map((width, index) => <col key={index} style={{ width }} />)}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    {[
                tr("Ngày công", "Work date"),
                tr("Nhân viên", "Employee"),
                tr("Vào / ra", "Check in / out"),
                tr("Thời lượng", "Duration"),
                tr("Muộn / sớm", "Late / early"),
                tr("Tăng ca", "Overtime"),
                tr("Trạng thái", "Status"),
                tr("Thao tác", "Actions"),
            ].map((h) => (<th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600" key={h}>
                        {h}
                      </th>))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                const state = attendanceState(r, tr);
                const department = employeeByCode.get(r.employee_code)?.departmentId;
                const avatarTone = ["bg-slate-100 text-slate-700", "bg-indigo-100 text-indigo-800", "bg-teal-100 text-teal-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800"][(Number(department) || 0) % 5];
                return (<tr key={String(r.id)} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="whitespace-nowrap p-3 tabular-nums text-slate-700">{workDayFormat[language === "vi" ? "vi" : "en"].format(new Date(r.work_date + "T00:00:00Z"))}</td>
                        <td className="p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${avatarTone}`}>{attendanceInitials(r.full_name)}</span>
                            <div className="min-w-0">
                              <p className="wrap-break-word font-semibold leading-5 text-slate-950">{r.full_name}</p>
                              <span className="mt-0.5 inline-block max-w-full wrap-break-word rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{r.employee_code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-1 font-mono text-xs font-medium text-slate-700">
                            <Clock3 size={12} aria-hidden="true" />
                            {displayTime(r.check_in)} <span aria-hidden="true">→</span> {displayTime(r.check_out)}
                          </span>
                        </td>
                        <td className="p-3 font-semibold tabular-nums text-slate-800">
                          {durationLabel(r.working_minutes)}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-start gap-1">
                            {r.late_mins ? (<span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
                                {tr("Muộn", "Late")} {r.late_mins}p
                              </span>) : null}
                            {r.early_mins ? (<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                {tr("Sớm", "Early")} {r.early_mins}p
                              </span>) : null}
                            {!r.late_mins && !r.early_mins && (<span className="text-slate-400">—</span>)}
                          </div>
                        </td>
                        <td className="p-3 font-semibold tabular-nums text-violet-700">
                          {r.overtime_minutes
                        ? <span className="inline-flex whitespace-nowrap rounded-md bg-violet-50 px-1.5 py-1 text-xs">{`+${(r.overtime_minutes / 60).toFixed(1)}h OT`}</span>
                        : "—"}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 ${state.tone}`}>
                            {state.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <Button variant="secondary" size="sm" className="h-8 min-h-8 whitespace-nowrap px-2 text-xs hover:border-orange-300 hover:bg-orange-50" disabled={busy} onClick={() => void open(r)}>
                            {tr("Xem chi tiết", "View details")}
                          </Button>
                        </td>
                      </tr>);
            })}
                </tbody>
              </table>
            </div>
            {!visibleRows.length &&
                (hasAnyRecords ? (<div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Inbox size={23}/>
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    {tr("Không có bản ghi trong bộ lọc này.", "No records match these filters.")}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {tr("Hãy thay đổi kỳ làm việc hoặc phòng ban để tìm lại.", "Change the period or department filter.")}
                  </p>
                </div>) : !own ? (<div className="overflow-hidden rounded-2xl border border-dashed border-orange-200 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/50 px-6 py-8 text-center">
                  <div className="mx-auto flex w-fit items-end gap-2 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                      <FileSpreadsheet size={25}/>
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {Array.from({ length: 15 }).map((_, index) => (<span key={index} className={`size-2 rounded-full ${index % 4 === 0
                            ? "bg-orange-400"
                            : index % 3 === 0
                                ? "bg-emerald-400"
                                : "bg-slate-200"}`}/>))}
                    </div>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    {tr(`Chưa có bản ghi chấm công cho kỳ ${periodLabel}`, `No attendance records for ${periodLabel}`)}
                  </h3>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    {tr("Kéo thả tệp Excel chấm công từ máy chấm công hoặc hệ thống nguồn để đối soát mã nhân viên, ca làm việc, đi trễ, về sớm và tăng ca.", "Import the Excel attendance file to validate employees, shifts, late arrivals, early leaves and overtime.")}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <Button type="button" disabled={scheduleCheck === "loading" ||
                        scheduleCheck === "missing"} onClick={startImport}>
                      <Upload size={16}/>
                      {tr("Nhập tệp chấm công ngay", "Import attendance now")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={downloadAttendanceTemplate}>
                      <Download size={16}/>
                      {tr("Tải file mẫu Excel chuẩn", "Download Excel template")}
                    </Button>
                  </div>
                  <div className="mx-auto mt-7 grid max-w-4xl gap-3 text-left sm:grid-cols-3">
                    {[
                        tr("Dùng tệp mẫu có cột Mã NV, Ngày, Ca, Giờ vào và Giờ ra.", "Use the template columns: employee, date, shift, check-in and check-out."),
                        tr("Hệ thống kiểm tra mã nhân sự và phân loại trễ, sớm, OT.", "ERIS validates employee codes and classifies attendance events."),
                        tr("HR xem lại kết quả và chỉ xác nhận lưu các dòng hợp lệ.", "HR reviews and confirms only valid rows."),
                    ].map((text, index) => (<div key={text} className="rounded-xl border border-slate-200 bg-white/90 p-3 text-sm text-slate-600 shadow-sm">
                        <span className="mb-2 flex size-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                          {index + 1}
                        </span>
                        {text}
                      </div>))}
                  </div>
                </div>) : (<div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="text-slate-400"/>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    {tr("Chưa có dữ liệu chấm công.", "No attendance data yet.")}
                  </p>
                </div>))}
          </>)}
        {(hasAnyRecords || rows.length > 0) && (<div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
              <p>
                {tr("Hiển thị", "Showing")} {pageStart} – {pageEnd} {tr("trong tổng số", "of")} {filteredRowCount} {tr("bản ghi", "records")}
              </p>
              <label className="flex items-center gap-2">
                {tr("Số dòng", "Rows")}
                <SelectControl value={pageSize} onChange={(event) => {
                setPageSize(Number(event.target.value));
                setOffset(0);
            }} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700">
                  {[10, 25, 50, 100].map((size) => (<option key={size} value={size}>
                      {size}
                    </option>))}
                </SelectControl>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={loading || currentPage === 1} onClick={() => setOffset(0)}>{tr("Đầu", "First")}</Button>
              <Button variant="secondary" disabled={loading || currentPage === 1} onClick={() => setOffset(pageOffset - pageSize)}>
                {tr("Trước", "Previous")}
              </Button>
              <span className="self-center px-1 text-sm tabular-nums text-slate-700">{tr("Trang", "Page")} {currentPage} / {pageCount}</span>
              <Button variant="secondary" disabled={loading || !hasNextPage} onClick={() => setOffset(pageOffset + pageSize)}>
                {tr("Sau", "Next")}
              </Button>
              <Button variant="secondary" disabled={loading || !hasNextPage} onClick={() => setOffset((pageCount - 1) * pageSize)}>{tr("Cuối", "Last")}</Button>
            </div>
          </div>)}
      </Card>
    </AppShell>);
}
