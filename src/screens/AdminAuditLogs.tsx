import { Fragment, useEffect, useRef, useState } from "react"

import { CalendarDays, Eye } from "lucide-react"

import { AppShell } from "../components/AppShell"

import { Button, Card, SectionHeader } from "../components/ui"

import { useLanguage } from "../context/LanguageContext"

import {
  listAuditLogs,
  getAuditLog,
  getApiErrorMessage,
  type AuditLogEntry,
  type AuditLogDetail,
} from "../services/api"

import { downloadTextFile, toCsv } from "../utils/demoActions"

import { auditDateMatches } from "../utils/auditDateFilter"

import { employeeDate } from "../utils/employeeDates"

const actionLabels: Record<string, string> = {
  CREATE: "Create",
  IMPORT: "Import Excel file",
  UPDATE: "Update",
  SOFT_DELETE: "Deactivate",
  DELETE: "Delete",
}

const entityLabels: Record<string, string> = {
  employees: "Employees",
  departments: "Departments",
  positions: "Positions",
  employee_educations: "Employee education",
  employee_work_experiences: "Employee work experience",
  surveys: "Surveys",
  work_schedules: "Work schedules",
  employee_schedule_assignments: "Employee schedule assignments",
}

export default function AdminAuditLogs() {
  const { t, language } = useLanguage()

  const [entries, setEntries] = useState<AuditLogEntry[]>([])

  const [search, setSearch] = useState("")

  const [fromDate, setFromDate] = useState("")

  const [toDate, setToDate] = useState("")

  const [revision, setRevision] = useState(0)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [detail, setDetail] = useState<AuditLogDetail | null>(null)

  const [detailError, setDetailError] = useState("")

  const [detailRevision, setDetailRevision] = useState(0)

  const detailRegion = useRef<HTMLElement>(null)

  const detailTrigger = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (selectedId !== null) {
      detailRegion.current?.scrollIntoView({ block: "start" })

      detailRegion.current?.focus({ preventScroll: true })
    }
  }, [selectedId])

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setError("")
    setEntries([])
    setSelectedId(null)

    void listAuditLogs(controller.signal)

      .then((result) => {
        if (!controller.signal.aborted) setEntries(result.data)
      })

      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(getApiErrorMessage(cause, "Could not load audit logs."))
      })

      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    const controller = new AbortController()

    setDetail(null)
    setDetailError("")

    if (selectedId !== null)
      void getAuditLog(selectedId, controller.signal)

        .then((result) => {
          if (!controller.signal.aborted) setDetail(result.data)
        })

        .catch((cause) => {
          if (!controller.signal.aborted)
            setDetailError(
              getApiErrorMessage(cause, "Could not load audit log details."),
            )
        })

    return () => controller.abort()
  }, [selectedId, detailRevision])

  const actionLabel = (value: string | null) =>
    t(value ? actionLabels[value] || value : "—")

  const entityLabel = (value: string | null) =>
    t(value ? entityLabels[value.toLowerCase()] || value : "—")

  const invalidDateRange = !!fromDate && !!toDate && fromDate > toDate

  const visible = entries.filter(
    (entry) =>
      auditDateMatches(entry.createdAt, fromDate, toDate) &&
      [
        entry.id,
        entry.userId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.actor?.fullName,
        entry.actor?.email,
        actionLabel(entry.action),
        entityLabel(entry.entityType),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  )

  const formatTime = (value: string) => {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString(language === "vi" ? "vi-VN" : "en-US", {
          timeZone: "Asia/Ho_Chi_Minh",
        })
  }

  const timeOnly = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleTimeString(language === "vi" ? "vi-VN" : "en-US", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour12: false,
        })
  }

  const dayKey = (value: string) => employeeDate(value) || value.slice(0, 10)

  const dayLabel = (value: string) => {
    const date = new Date(value)
    const same = dayKey(value) === employeeDate(new Date().toISOString())
    return `${
      same
        ? t("Today")
        : date.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
            timeZone: "Asia/Ho_Chi_Minh",
            weekday: "long",
          })
    } — ${date.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { timeZone: "Asia/Ho_Chi_Minh" })}`
  }

  const actionStyle = (action: string | null) =>
    ({
      CREATE: "border-emerald-200 bg-emerald-50 text-emerald-700",
      IMPORT: "border-blue-200 bg-blue-50 text-blue-700",
      UPDATE: "border-amber-200 bg-amber-50 text-amber-700",
      DELETE: "border-rose-200 bg-rose-50 text-rose-700",
      SOFT_DELETE: "border-rose-200 bg-rose-50 text-rose-700",
    })[action || ""] || "border-slate-200 bg-slate-50 text-slate-700"

  const humanEntity = (entry: AuditLogEntry) => {
    const key = (entry.entityType || "").toLowerCase()
    const label =
      ({
      ai_input: language === 'vi' ? 'Hồ sơ phân tích rủi ro nhân sự' : 'Employee risk analysis profile',
      demo_dataset: language === 'vi' ? 'Tập dữ liệu mẫu thử nghiệm' : 'Experimental sample dataset',
      users: language === 'vi' ? 'Tài khoản người dùng' : 'User account',
      employee_imports: language === 'vi' ? 'Danh sách hồ sơ nhân viên (Excel)' : 'Employee profile list (Excel)',
      employees: language === 'vi' ? 'Hồ sơ nhân sự' : 'Employee profile',
      } as Record<string, string>)[key] || entityLabel(entry.entityType)
    return `${label}${entry.entityId !== null ? ` (#${entry.entityId})` : ""}`
  }

  const actorName = (entry: AuditLogEntry) =>
    entry.actor?.fullName ||
    entry.actor?.email ||
    (entry.userId === null ? t("System") : `${t("User")} #${entry.userId}`)

  function exportLogs() {
    downloadTextFile(
      "audit-log.csv",
      toCsv(
        visible.map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt,
          userId: entry.userId,
          fullName: entry.actor?.fullName ?? "",
          email: entry.actor?.email ?? "",
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
        })),
      ),
      "text/csv;charset=utf-8",
    )
  }

  return (
    <AppShell breadcrumb={["System", "Activity"]}>
      <SectionHeader
        title={t("System audit logs")}
        description={t(
          "Review recorded system actions from the server. Open an entry to view its before and after values.",
        )}
      >
        <Button
          variant="secondary"
          disabled={loading || !!error || invalidDateRange || !visible.length}
          onClick={exportLogs}
        >
          {t("Export displayed logs")}
        </Button>
      </SectionHeader>
      <Card className="p-5">
        <div className="mb-2 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_11rem_11rem_auto]">
          <label className="block text-sm text-slate-600 sm:col-span-2 xl:col-span-1">
            {t("Search action, user or record")}
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 p-3"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-600">
            {t("From date")}
            <input
              type="date"
              max={toDate || undefined}
              aria-invalid={invalidDateRange}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value)
                setSelectedId(null)
              }}
            />
          </label>
          <label className="block text-sm text-slate-600">
            {t("To date")}
            <input
              type="date"
              min={fromDate || undefined}
              aria-invalid={invalidDateRange}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value)
                setSelectedId(null)
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1">
            {(fromDate || toDate) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setFromDate("")
                  setToDate("")
                  setSelectedId(null)
                }}
              >
                {t("Clear date filter")}
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("Refresh")}
            </Button>
          </div>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          {t("Dates use Vietnam time (UTC+7), including the entire end date.")}
        </p>
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slate-500">
            {t("Loading audit logs...")}
          </p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            <p>{t(error)}</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("Retry")}
            </Button>
          </div>
        ) : invalidDateRange ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {t("The end date must be on or after the start date.")}
          </p>
        ) : !visible.length ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {t(
              entries.length
                ? "No audit logs match these filters."
                : "No audit logs have been recorded.",
            )}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {t("Showing {count} audit logs", { count: visible.length })}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    {["Time", "User", "Action", "Entity", "Details"].map(
                      (label) => (
                        <th className="p-3" key={label}>
                          {t(label)}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry, index) => (
                    <Fragment key={entry.id}>
                      {(index === 0 ||
                        dayKey(visible[index - 1].createdAt) !==
                          dayKey(entry.createdAt)) && (
                        <tr>
                          <td
                            colSpan={5}
                            className="border-y border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-700"
                          >
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays className="size-4 text-orange-500" />
                              {dayLabel(entry.createdAt)} ·{" "}
                              {
                                visible.filter(
                                  (item) =>
                                    dayKey(item.createdAt) ===
                                    dayKey(entry.createdAt),
                                ).length
                              }{" "}
                            {language === 'vi' ? 'thao tác được ghi nhận' : 'actions recorded'}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-100 align-top transition-colors hover:bg-orange-50/30">
                        <td className="whitespace-nowrap p-3 font-mono text-xs text-slate-600">
                          {timeOnly(entry.createdAt)}
                        </td>
                        <td className="p-3">
                          <p>{actorName(entry)}</p>
                          {entry.actor?.email && entry.actor.fullName && (
                            <p className="mt-1 text-xs text-slate-500">
                              {entry.actor.email}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${actionStyle(entry.action)}`}
                          >
                            {entry.action === "CREATE"
                              ? "+ "
                              : entry.action === "IMPORT"
                                ? "↥ "
                                : entry.action === "UPDATE"
                                  ? "✎ "
                                  : "− "}
                            {actionLabel(entry.action)}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {humanEntity(entry)}
                        </td>
                        <td className="p-3">
                          <button
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-orange-600"
                            aria-expanded={selectedId === entry.id}
                            onClick={(event) => {
                              detailTrigger.current = event.currentTarget
                              setDetail(null)
                              setDetailError("")
                              setSelectedId((value) =>
                                value === entry.id ? null : entry.id,
                              )
                            }}
                          >
                            <Eye className="size-3.5" />
                            {t("Details")} →
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      {selectedId !== null && (
        <section
          ref={detailRegion}
          tabIndex={-1}
          role="region"
          aria-label={t("Audit log details")}
          className="scroll-mt-5 outline-none"
        >
          <Card className="mt-5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-bold">
                {t("Audit log details")} #{selectedId}
              </h2>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedId(null)
                  detailTrigger.current?.focus()
                }}
              >
                {t("Close")}
              </Button>
            </div>
            {detailError ? (
              <div
                role="alert"
                className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                <p>{t(detailError)}</p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setDetailRevision((value) => value + 1)}
                >
                  {t("Retry")}
                </Button>
              </div>
            ) : !detail ? (
              <p role="status" className="text-sm text-slate-500">
                {t("Loading audit log details...")}
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-600">
                  {formatTime(detail.createdAt)} · {actorName(detail)} ·{" "}
                  {actionLabel(detail.action)} ·{" "}
                  {entityLabel(detail.entityType)} #{detail.entityId ?? "—"}
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {[
                    ["Before change", detail.oldValue],
                    ["After change", detail.newValue],
                  ].map(([label, value]) => (
                    <section key={String(label)} className="min-w-0">
                      <h3 className="mb-2 text-sm font-semibold">
                        {t(String(label))}
                      </h3>
                      {value == null ? (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                          {t("No recorded value")}
                        </p>
                      ) : (
                        <pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>
      )}
    </AppShell>
  )
}
