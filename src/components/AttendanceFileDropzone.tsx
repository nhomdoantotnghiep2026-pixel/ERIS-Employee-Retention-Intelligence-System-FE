import { useId, useRef, useState } from "react"
import { FileSpreadsheet, UploadCloud } from "lucide-react"
import { useLanguage } from "../context/LanguageContext"
import { downloadAttendanceTemplate } from "../utils/attendanceTemplate"

export default function AttendanceFileDropzone({ file, busy, onSelect }: {
  file: File | null
  busy: boolean
  onSelect: (file: File | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => language === "vi" ? vi : en

  return <>
    <div
      className={`relative flex min-h-48 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-5 py-6 text-center transition-colors duration-200 motion-reduce:transition-none ${dragging && !busy ? "border-orange-400 bg-orange-50" : "border-slate-300 bg-slate-50 hover:border-orange-300"} ${busy ? "opacity-60" : ""}`}
      onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={event => {
        event.preventDefault()
        setDragging(false)
        if (!busy && event.dataTransfer.files.length) onSelect(event.dataTransfer.files[0])
      }}
    >
      <button
        type="button"
        aria-label={tr("Chọn tệp chấm công Excel", "Choose attendance Excel file")}
        aria-describedby={hintId}
        disabled={busy}
        onClick={() => input.current?.click()}
        className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 disabled:cursor-not-allowed"
      />
      <div className="pointer-events-none flex max-w-full flex-col items-center gap-2">
        <UploadCloud className="mb-1 text-orange-600" aria-hidden="true" />
        <span className="max-w-full text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">
          {file?.name || tr("Kéo thả tệp vào đây hoặc bấm để chọn", "Drop a file here or click to choose")}
        </span>
        <span id={hintId} className="text-sm font-medium text-slate-600">
          {tr("Tệp .xlsx hoặc .xls · tối đa 10 MiB", ".xlsx or .xls file · up to 10 MiB")}
        </span>
      </div>
      <button
        type="button"
        onClick={downloadAttendanceTemplate}
        className="relative z-10 inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none"
      >
        <FileSpreadsheet size={16} aria-hidden="true" />
        {tr("Tải tệp mẫu", "Download template")}
      </button>
    </div>
    <input
      ref={input}
      hidden
      type="file"
      accept=".xlsx,.xls"
      disabled={busy}
      aria-label={tr("Tệp chấm công", "Attendance file")}
      onChange={event => {
        const next = event.currentTarget.files?.[0]
        if (next) onSelect(next)
        event.currentTarget.value = ""
      }}
    />
  </>
}
