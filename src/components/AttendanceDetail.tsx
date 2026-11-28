import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Clock3, History, X } from "lucide-react";
import { validScheduleTimeline } from "../utils/scheduleTimeline";
import { Button } from "./ui";
import type { AttendanceAudit, ImportedAttendance } from "../services/attendance";

type Translate = (vi: string, en: string) => string;

export const displayTime = (value?: string | null) =>
    value?.match(/(?:^|[T ])(\d{2}:\d{2})(?::|$)/)?.[1] ?? "—";

export const durationLabel = (value: number) => {
    const minutes = Math.max(0, Math.round(Number(value) || 0));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours.toFixed(1)}h`;
};

export function attendanceState(row: ImportedAttendance, tr: Translate) {
    const neutral = "border-slate-200 bg-slate-100 text-slate-700";
    if (row.record_status === "CANCEL") return { kind: "neutral", label: tr("Đã hủy", "Cancelled"), tone: neutral };
    if (row.attendance_status === "HOLIDAY") return { kind: "neutral", label: tr("Ngày lễ", "Holiday"), tone: neutral };
    if (row.attendance_status === "ON_LEAVE") return { kind: "neutral", label: tr("Nghỉ phép", "On leave"), tone: neutral };
    if (row.attendance_status === "ABSENT") return { kind: "neutral", label: tr("Vắng mặt", "Absent"), tone: neutral };
    if (!row.check_in || !row.check_out) return { kind: "missing", label: tr("Thiếu quẹt thẻ", "Missing punch"), tone: "border-rose-200 bg-rose-50 text-rose-800" };
    if (row.late_mins > 0 || row.early_mins > 0) return { kind: "review", label: tr("Chờ giải trình / bù công", "Awaiting explanation / adjustment"), tone: "border-amber-200 bg-amber-50 text-amber-800" };
    return { kind: "recorded", label: tr("Đã chốt công", "Attendance finalized"), tone: "border-emerald-200 bg-emerald-50 text-emerald-800" };
}

export function attendanceInitials(name: string) {
    return name?.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase() || "—";
}

type Schedule = {
    shift_type?: string | null;
    name?: string;
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
};

export function recordedSchedule(logs: AttendanceAudit[]): Schedule | null {
    const creation = logs.find((log) => log.action === "CREATE");
    const values = creation?.new_values as { calculation_schedule?: Partial<Schedule> } | undefined;
    const schedule = values?.calculation_schedule;
    if (!schedule || typeof schedule.start_time !== "string" || typeof schedule.end_time !== "string") return null;
    const breakStart = schedule.break_start ?? null;
    const breakEnd = schedule.break_end ?? null;
    if (!validScheduleTimeline(schedule.start_time, schedule.end_time, breakStart, breakEnd)) return null;
    return { ...schedule, start_time: schedule.start_time, end_time: schedule.end_time, break_start: breakStart, break_end: breakEnd };
}

function shiftMinutes(schedule: Schedule) {
    const minutes = (value: string) => {
        const [hour, minute, second = 0] = value.split(":").map(Number);
        return hour * 60 + minute + second / 60;
    };
    const elapsed = (start: string, end: string) => (minutes(end) - minutes(start) + 1440) % 1440;
    const pause = schedule.break_start && schedule.break_end ? elapsed(schedule.break_start, schedule.break_end) : 0;
    return elapsed(schedule.start_time, schedule.end_time) - pause;
}

function auditLabel(action: string, tr: Translate) {
    switch (action.toUpperCase()) {
        case "CREATE": return tr("Tạo bản ghi chấm công", "Created attendance record");
        case "IMPORT": return tr("Nhập dữ liệu chấm công", "Imported attendance");
        case "CANCEL": return tr("Hủy bản ghi chấm công", "Cancelled attendance record");
        case "UPDATE": return tr("Cập nhật bản ghi chấm công", "Updated attendance record");
        default: return tr("Ghi nhận thao tác", "Recorded activity");
    }
}

interface AttendanceDetailProps {
    row: ImportedAttendance;
    department?: string;
    position?: string;
    schedule: Schedule | null;
    scheduleFromCatalog?: boolean;
    own: boolean;
    busy: boolean;
    reason: string;
    error: string;
    logs: AttendanceAudit[];
    logsLoading: boolean;
    logError: string;
    logOffset: number;
    tr: Translate;
    onLogOffset: (offset: number) => void;
    onReason: (reason: string) => void;
    onClose: () => void;
    onCancelRecord: (event: FormEvent) => void;
}

export default function AttendanceDetail({
    row, department, position, schedule, scheduleFromCatalog, own, busy, reason, error, logs, logsLoading,
    logError, logOffset, tr, onLogOffset, onReason, onClose, onCancelRecord,
}: AttendanceDetailProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [showCancel, setShowCancel] = useState(false);
    useEffect(() => {
        const dialog = dialogRef.current;
        const previousOverflow = document.body.style.overflow;
        dialog?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = previousOverflow;
        };
    }, []);
    const close = (explicit = false) => {
        if (!busy && (explicit || !reason.trim())) onClose();
    };
    const state = attendanceState(row, tr);
    const locale = tr("vi-VN", "en-GB");
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" })
        .format(new Date(`${row.work_date}T00:00:00Z`));
    const shiftNames: Record<string, string> = {
        GENERAL: tr("Ca hành chính", "General shift"),
        SHIFT_1: tr("Ca sáng", "Morning shift"),
        SHIFT_2: tr("Ca chiều", "Afternoon shift"),
    };
    const standardMinutes = schedule ? shiftMinutes(schedule) : null;
    const planMinutes = scheduleFromCatalog ? null : standardMinutes;
    const note = (minutes: number, label: string) => (
        minutes > 0 ? `${label} ${minutes} ${tr("phút", "min")}` : tr("Đúng giờ", "On time")
    );
    const late = note(row.late_mins, tr("Muộn", "Late"));
    const early = note(row.early_mins, tr("Sớm", "Early"));
    const missing = !row.check_in && !row.check_out
        ? tr("Thiếu cả giờ vào và giờ ra.", "Both punches are missing.")
        : row.check_in ? tr("Thiếu giờ ra.", "Check-out is missing.") : tr("Thiếu giờ vào.", "Check-in is missing.");
    const violations = [row.late_mins > 0 && late, row.early_mins > 0 && early].filter(Boolean).join(" · ");
    const formatAuditTime = (value?: string | null) => {
        const time = value ? new Date(value) : null;
        return time && Number.isFinite(time.getTime())
            ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(time)
            : "—";
    };
    return (
        <dialog ref={dialogRef} aria-labelledby="attendance-detail-title"
            onCancel={(event) => { event.preventDefault(); close(); }}
            onClick={(event) => { if (event.target === event.currentTarget) close(); }}
            className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent text-slate-950 backdrop:bg-slate-950/45">
            <div className="ml-auto flex h-full w-[520px] max-w-full flex-col overflow-y-auto bg-white shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200">
                <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 id="attendance-detail-title" className="text-xs font-semibold uppercase tracking-wide text-slate-600">{tr("Phiếu đối soát ngày công", "Attendance review")}</h2>
                            <p className="mt-1 wrap-break-word text-xl font-semibold">{row.full_name}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" autoFocus disabled={busy}
                            aria-label={tr("Đóng chi tiết", "Close details")} onClick={() => close(true)}><X size={18} /></Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {[row.employee_code, department, position].filter(Boolean).map((label) => <span key={label} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{label}</span>)}
                        <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${state.tone}`}>
                            {state.kind === "recorded" && <CheckCircle2 size={14} aria-hidden="true" />}
                            {(state.kind === "missing" || state.kind === "review") && <AlertTriangle size={14} aria-hidden="true" />}
                            {state.label}
                        </span>
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={15} aria-hidden="true" />{date}</p>
                </header>

                <div className="space-y-6 p-5 sm:p-6">
                    <section className="overflow-hidden rounded-xl border border-slate-200 shadow-sm" aria-label={tr("Đối chiếu ca làm việc", "Shift comparison")}>
                        <div className="grid min-[430px]:grid-cols-2 min-[430px]:divide-x divide-slate-200">
                            <div className="min-w-0 space-y-3 bg-slate-50/70 p-4">
                                <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList size={16} className="shrink-0 text-slate-600" />{tr("Ca làm việc quy định", "Scheduled shift")}</h3>
                                {schedule ? <>
                                {scheduleFromCatalog && <p className="text-xs text-slate-600">{tr("Thông tin tham chiếu từ danh mục ca hiện tại.", "Reference details from the current shift catalog.")}</p>}
                                <dl className="space-y-3 text-sm">
                                    <Metric label={tr("Ca làm việc", "Shift")} value={shiftNames[schedule.shift_type ?? ""] ?? (schedule.shift_type || schedule.name || "—")} />
                                    <Metric label={tr("Khung giờ", "Shift hours")} value={`${displayTime(schedule.start_time)} – ${displayTime(schedule.end_time)}`} />
                                    <Metric label={tr("Giờ nghỉ giữa ca", "Break")} value={schedule.break_start && schedule.break_end ? `${displayTime(schedule.break_start)} – ${displayTime(schedule.break_end)}` : tr("Không có", "None")} />
                                    <Metric label={tr("Thời lượng quy định", "Standard duration")} value={durationLabel(standardMinutes ?? 0)} />
                                </dl></> : <p className="text-sm text-slate-600">{logsLoading ? tr("Đang tải ca làm việc…", "Loading scheduled shift…") : tr("Chi tiết ca làm việc hiện không khả dụng.", "Scheduled shift details are unavailable.")}</p>}
                            </div>
                            <div className="min-w-0 space-y-3 border-t border-slate-200 p-4 min-[430px]:border-t-0">
                                <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="shrink-0 text-slate-600" />{tr("Thực tế ghi nhận", "Recorded attendance")}</h3>
                                <dl className="space-y-3 text-sm">
                                    <Metric label={tr("Giờ vào", "Check-in")} value={displayTime(row.check_in)} note={row.check_in && (schedule || row.late_mins > 0) ? late : undefined} />
                                    <Metric label={tr("Giờ ra", "Check-out")} value={displayTime(row.check_out)} note={row.check_out && (schedule || row.early_mins > 0) ? early : undefined} />
                                    <Metric label={tr("Thời lượng làm việc", "Working time")} value={durationLabel(row.working_minutes)} />
                                    <Metric label={tr("Tăng ca", "Overtime")} value={durationLabel(row.overtime_minutes)} />
                                </dl>
                            </div>
                        </div>
                        {planMinutes !== null && planMinutes > 0 && row.check_in && row.check_out && state.kind !== "neutral" && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <p>{tr("Thời lượng so với ca", "Duration against shift")} <strong className="tabular-nums">{(row.working_minutes / planMinutes * 100).toFixed(1)}%</strong></p>
                                {violations && <p className="font-medium text-amber-800">{violations}</p>}
                            </div>
                        )}
                    </section>

                    {state.kind !== "neutral" && (
                        <section className={`rounded-xl border p-4 text-sm leading-relaxed ${state.tone}`}>
                            <h3 className="font-semibold">{state.label}</h3>
                            {state.kind === "missing" && <p className="mt-1">{missing}</p>}
                            {state.kind === "review" && <p className="mt-1">{violations}. {tr("Đối chiếu giờ ghi nhận với ca làm việc và xác minh với nhân viên.", "Compare the punches with the scheduled shift and confirm with the employee.")}</p>}
                            {state.kind === "recorded" && <p className="mt-1">{planMinutes !== null && row.working_minutes >= planMinutes ? tr("Bản ghi đủ hai lượt quẹt và đạt thời lượng quy định.", "Both punches are recorded and the scheduled duration was met.") : tr("Bản ghi đủ lượt quẹt, không ghi nhận đi muộn hoặc về sớm.", "Both punches are recorded with no late arrival or early departure.")}</p>}
                        </section>
                    )}
                    {row.record_status === "CANCEL" && (
                        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                            <h3 className="font-semibold">{tr("Lý do hủy", "Cancellation reason")}</h3>
                            <p className="mt-1 whitespace-pre-wrap wrap-break-word text-slate-700">{row.cancellation_reason || "—"}</p>
                            <p className="mt-2 text-xs text-slate-600">{[row.cancelled_by_name, formatAuditTime(row.cancelled_at)].filter(Boolean).join(" · ")}</p>
                        </section>
                    )}

                    {!own && row.record_status === "ACTIVE" && (
                        <section className="rounded-xl border border-slate-200">
                            <button type="button" aria-controls="attendance-cancel-form" aria-expanded={showCancel}
                                onClick={() => setShowCancel(!showCancel)}
                                className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-500">
                                {tr("Hủy bản ghi", "Cancel record")}<ChevronDown size={16} className={`transition-transform ${showCancel ? "rotate-180" : ""}`} />
                            </button>
                            {showCancel && <form id="attendance-cancel-form" onSubmit={onCancelRecord} className="space-y-3 border-t border-slate-200 p-4">
                                <p className="text-sm text-slate-600">{tr("Nếu giờ vào hoặc giờ ra sai, hãy hủy bản ghi và nhập lại dữ liệu đã sửa.", "If a punch is incorrect, cancel the record and import the corrected data.")}</p>
                                <label className="block text-sm font-semibold">{tr("Lý do hủy (bắt buộc)", "Cancellation reason (required)")}
                                    <textarea required maxLength={1000} disabled={busy} value={reason} onChange={(event) => onReason(event.target.value)}
                                        className="mt-2 min-h-20 w-full resize-y rounded-md border border-slate-300 p-2 text-sm focus-visible:outline-2 focus-visible:outline-orange-500" />
                                </label>
                                {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
                                <Button variant="danger" type="submit" disabled={busy || !reason.trim()}>
                                    {busy ? tr("Đang hủy…", "Cancelling…") : tr("Xác nhận hủy", "Confirm cancellation")}
                                </Button>
                            </form>}
                        </section>
                    )}

                    {!own && row.record_status !== "CANCEL" && (
                        <section aria-labelledby="attendance-audit-title">
                            <h3 id="attendance-audit-title" className="flex items-center gap-2 text-sm font-semibold"><History size={16} />{tr("Lịch sử thao tác", "Activity history")}</h3>
                            {logsLoading && <p role="status" className="mt-3 text-sm text-slate-600">{tr("Đang tải lịch sử…", "Loading history…")}</p>}
                            {logError && <p role="alert" className="mt-3 text-sm text-rose-800">{logError}</p>}
                            {!logsLoading && !logError && !logs.length && <p className="mt-3 text-sm text-slate-600">{tr("Chưa ghi nhận thao tác nào.", "No activity recorded.")}</p>}
                            {!!logs.length && <ol className="ml-2 mt-4 space-y-4 border-l border-slate-200">
                                {logs.map((log) => {
                                    const actor = [log.actor_name, log.actor_full_name].find((value): value is string => typeof value === "string" && Boolean(value.trim()));
                                    return <li key={String(log.id)} className="relative pl-5">
                                        <span aria-hidden="true" className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-orange-400 ring-4 ring-white" />
                                        <p className="text-xs tabular-nums text-slate-600">{formatAuditTime(log.occurred_at)}</p>
                                        <p className="mt-1 text-sm font-semibold">{auditLabel(log.action, tr)}</p>
                                        {actor && <p className="text-sm text-slate-600">{actor}</p>}
                                        {log.reason && <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-slate-700">{log.reason}</p>}
                                    </li>;
                                })}
                            </ol>}
                            {(logOffset > 0 || logs.length === 20) && <div className="mt-4 flex gap-2">
                                <Button variant="secondary" size="sm" disabled={logsLoading || !logOffset} onClick={() => onLogOffset(logOffset - 20)}>{tr("Trước", "Previous")}</Button>
                                <Button variant="secondary" size="sm" disabled={logsLoading || logs.length < 20} onClick={() => onLogOffset(logOffset + 20)}>{tr("Sau", "Next")}</Button>
                            </div>}
                        </section>
                    )}
                </div>
            </div>
        </dialog>
    );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
    return <div><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-0.5 wrap-break-word font-semibold tabular-nums">{value}{note && <span className="ml-1 text-xs font-normal text-slate-600">· {note}</span>}</dd></div>;
}

