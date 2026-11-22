import { useEffect, useState } from "react"
import { FileDown, RefreshCw } from "lucide-react"

import { AppShell } from "../components/AppShell"

import { Button, SectionHeader } from "../components/ui"

import { useLanguage } from "../context/LanguageContext"

import {
  listAiEmployees,
  listEmployeeProfiles,
  listDepartments,
  listPositions,
  getApiErrorMessage,
  type AiEmployee,
} from "../services/api"

import { IndividualAnalysis } from "../components/ai-workspace/IndividualAnalysis"

import "../components/ai-workspace/workspace.css"

export default function AiAnalysis() {
  const { t } = useLanguage()

  const [employees, setEmployees] = useState<AiEmployee[]>([])

  const [error, setError] = useState("")

  const [loading, setLoading] = useState(true)

  const [reload, setReload] = useState(0)
  const [hasResult, setHasResult] = useState(false)

  useEffect(() => {
    let live = true

    setLoading(true)
    setError("")

    Promise.all([
      listAiEmployees(),
      listEmployeeProfiles({ limit: Number.MAX_SAFE_INTEGER }),
      listDepartments(undefined, { limit: Number.MAX_SAFE_INTEGER }),
      listPositions(undefined, { limit: Number.MAX_SAFE_INTEGER }),
    ])
      .then(([response, profiles, departments, positions]) => {
        if (!live) return
        const profileById = new Map(profiles.data.map(profile => [profile.id, profile]))
        const departmentById = new Map(departments.data.map(item => [item.id, item.name]))
        const positionById = new Map(positions.data.map(item => [item.id, item.name]))
        setEmployees(response.data.map(employee => {
          const profile = profileById.get(employee.id)
          return profile ? {
            ...employee,
            departmentId: profile.departmentId,
            departmentName: departmentById.get(profile.departmentId) ?? null,
            positionId: profile.positionId,
            positionName: positionById.get(profile.positionId) ?? null,
            hireDate: profile.hireDate,
            employmentType: profile.employmentType,
            employmentStatus: profile.employmentStatus,
            currentSalary: profile.currentSalary,
          } : employee
        }))
      })
      .catch((e) => {
        if (live)
          setError(
            getApiErrorMessage(
              e,
              "Không tải được dữ liệu phân tích. Vui lòng thử lại.",
            ),
          )
      })

      .finally(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
    }
  }, [reload])

  return (
    <AppShell breadcrumb={["Quản lý nhân tài", "Đánh giá mức độ gắn kết"]}>
      <SectionHeader
        title={t("Hồ sơ sức khỏe nhân sự & Kế hoạch giữ chân")}
        description={t(
          "Đánh giá rủi ro thôi việc và đề xuất lộ trình giữ chân dựa trên dữ liệu làm việc thực tế.",
        )}
      >
        <Button variant="secondary" onClick={() => setReload(v => v + 1)}><RefreshCw size={16} /><span className="sr-only">{t("Kiểm tra dữ liệu")}</span>{t("Cập nhật dữ liệu từ HRIS")}</Button>
        <Button variant="secondary" disabled={!hasResult} title={!hasResult ? t("Hãy hoàn thành một lần đánh giá trước khi tải bản tóm tắt.") : undefined} onClick={() => window.print()}><FileDown size={16} />{t("Tải tóm tắt nhân sự (PDF)")}</Button>
      </SectionHeader>
      <div className="ai-workspace text-slate-900">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {t(error)}
            <Button
              className="ml-3"
              variant="secondary"
              onClick={() => setReload((v) => v + 1)}
            >
              {t("Thử lại")}
            </Button>
          </div>
        )}
        {loading ? (
          <p role="status" className="py-8">
            {t("Đang tải dữ liệu…")}
          </p>
        ) : (
          <IndividualAnalysis
            employees={employees}
            initial={{}}
            onSelectionChange={() => {}}
            onResultAvailabilityChange={setHasResult}
          />
        )}
      </div>
    </AppShell>
  )
}
