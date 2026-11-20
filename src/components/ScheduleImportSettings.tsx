import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useState, type FormEvent } from "react"
import { Button, Card } from "./ui"
import { useLanguage } from "../context/LanguageContext"
import { updateWorkSchedule, type WorkSchedule } from "../services/api"
import { attendanceMessage } from "../services/attendance"
export const defaultImportPolicy: Record<string, number> = {
  early_arrival_minutes: 240,
  late_arrival_minutes: 480,
  early_departure_minutes: 480,
  late_departure_minutes: 480,
  unusual_duration_minutes: 960,
  max_duration_minutes: 1440,
}
export default function ScheduleImportSettings({
  schedule,
  onClose,
  onSaved,
}: {
  schedule: WorkSchedule
  onClose: () => void
  onSaved: () => void
}) {
  const { language } = useLanguage(),
    tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [code, setCode] = useState(schedule.shift_type || ""),
    [policy, setPolicy] = useState({
      ...defaultImportPolicy,
      ...schedule.attendance_policy,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useAutoDismissState()
  const fields = [
    [
      "early_arrival_minutes",
      "Cho phép vào trước ca (phút)",
      "Early arrival window (minutes)",
    ],
    [
      "late_arrival_minutes",
      "Cho phép vào sau đầu ca (phút)",
      "Late arrival window (minutes)",
    ],
    [
      "early_departure_minutes",
      "Cho phép ra trước cuối ca (phút)",
      "Early departure window (minutes)",
    ],
    [
      "late_departure_minutes",
      "Cho phép ra sau ca (phút)",
      "Late departure window (minutes)",
    ],
    [
      "unusual_duration_minutes",
      "Ngưỡng cảnh báo thời lượng (phút)",
      "Unusual duration threshold (minutes)",
    ],
    [
      "max_duration_minutes",
      "Thời lượng tối đa (phút)",
      "Maximum duration (minutes)",
    ],
  ]
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (
      !Object.values(policy).every(
        (n) => Number.isInteger(n) && n >= 0 && n <= 2880,
      ) ||
      policy.max_duration_minutes < 1 ||
      policy.unusual_duration_minutes > policy.max_duration_minutes
    ) {
      setError(
        tr(
          "Ngưỡng phải từ 0–2880 phút, thời lượng tối đa ít nhất 1 và không nhỏ hơn ngưỡng cảnh báo.",
          "Thresholds must be 0–2880 minutes; maximum duration must be positive and at least the warning threshold.",
        ),
      )
      return
    }
    setBusy(true)
    setError("")
    try {
      await updateWorkSchedule(schedule.id, {
        shift_type: code.trim(),
        attendance_policy: policy,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(
        attendanceMessage(
          e,
          tr(
            "Không lưu được mã ca hoặc ngưỡng nhập.",
            "Could not save shift code or import policy.",
          ),
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="mb-4 p-5">
      <h2 className="font-bold">
        {tr("Mã ca & ngưỡng nhập", "Shift code & import windows")} ·{" "}
        {schedule.name}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {tr(
          "Mã ca phải duy nhất. Các ngưỡng giúp tìm ngày bắt đầu ca, không phải quy định trả lương. Thay đổi không tính lại bản ghi đã lưu.",
          "Shift code must be unique. Windows identify the shift date; these are not payroll rules. Saved records are not recalculated.",
        )}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-red-800">
          {error}
        </p>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            {tr("Mã ca", "Shift code")}
            <input
              required
              maxLength={100}
              className="mt-1 w-full rounded-xl border p-3"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {fields.map(([key, vi, en]) => (
            <label key={key} className="text-sm">
              {tr(vi, en)}
              <input
                required
                type="number"
                min={key === "max_duration_minutes" ? 1 : 0}
                max={2880}
                step="1"
                className="mt-1 w-full rounded-xl border p-3"
                value={Number.isNaN(policy[key]) ? "" : policy[key]}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    [key]: e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
          <div className="flex gap-2">
            <Button type="submit">
              {tr("Lưu mã ca và ngưỡng", "Save shift code and windows")}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tr("Đóng", "Close")}
            </Button>
          </div>
        </fieldset>
      </form>
    </Card>
  )
}
